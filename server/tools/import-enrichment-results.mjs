import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import pg from 'pg'

import {
  getProductionDatabaseUrl,
  productionDatabaseConfigured,
  runProductionMigrationsForDatabaseUrl,
} from '../db/migrate.mjs'

const { Pool } = pg

const DEFAULT_WORKFLOW_KEY = 'external-model-enrichment-exchange'
const COMPUTED_STATUSES = new Set(['computed', 'not_computable', 'invalid', 'warning'])
const ENERGY_LABELS = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G'])

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function usage() {
  return [
    'Usage:',
    '  npm run ops:import-enrichment-results -- --manifest=/tmp/oldt-enrichment-cycle/.../manifest.json --results=/tmp/oldt-enrichment-cycle/.../results.jsonl',
    '',
    'Options:',
    '  --manifest=<path>          Required OLDT enrichment input manifest.',
    '  --results=<path>           Required external enrichment result JSONL.',
    '  --database-url=<url>       Defaults to TWIN_STUDIO_DATABASE_URL.',
    '  --submitted-by=<label>     Audit label.',
    '  --skip-migrations          Do not run pending DB migrations first.',
  ].join('\n')
}

function requireText(value, code) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(code)
  return text
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(`sha256:${hash.digest('hex')}`))
  })
}

async function readJson(filePath) {
  return JSON.parse(await fs.promises.readFile(filePath, 'utf8'))
}

async function readJsonl(filePath) {
  const text = await fs.promises.readFile(filePath, 'utf8')
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(`INVALID_JSONL_LINE:${index + 1}:${error.message}`)
      }
    })
}

function normalizeStatus(value) {
  const status = String(value ?? 'computed').trim().toLowerCase()
  return COMPUTED_STATUSES.has(status) ? status : 'invalid'
}

function normalizeOutputValue(output) {
  if (output && typeof output === 'object' && !Array.isArray(output)) {
    return {
      raw: output,
      value: Object.hasOwn(output, 'value') ? output.value : output,
      unit: output.unit ?? null,
      confidence: output.confidence ?? null,
      uncertainty: output.uncertainty ?? {},
      warnings: output.warnings ?? [],
    }
  }
  return {
    raw: { value: output },
    value: output,
    unit: null,
    confidence: null,
    uncertainty: {},
    warnings: [],
  }
}

function buildValueColumns(outputKey, output) {
  const normalized = normalizeOutputValue(output)
  if (typeof normalized.value === 'number' && Number.isFinite(normalized.value)) {
    return {
      valueNumeric: normalized.value,
      valueText: null,
      valueJson: normalized.raw,
      unit: normalized.unit,
      confidence: normalized.confidence,
      uncertainty: normalized.uncertainty,
      warnings: normalized.warnings,
    }
  }

  if (typeof normalized.value === 'string') {
    return {
      valueNumeric: null,
      valueText: normalized.value,
      valueJson: normalized.raw,
      unit: normalized.unit,
      confidence: normalized.confidence,
      uncertainty: normalized.uncertainty,
      warnings: normalized.warnings,
    }
  }

  return {
    valueNumeric: null,
    valueText: null,
    valueJson: normalized.raw,
    unit: normalized.unit,
    confidence: normalized.confidence,
    uncertainty: normalized.uncertainty,
    warnings: normalized.warnings,
  }
}

function validateOutput(outputKey, valueColumns, status) {
  if (status !== 'computed' && status !== 'warning') return null
  if (outputKey === 'sap_score') {
    if (typeof valueColumns.valueNumeric !== 'number') return 'SAP_SCORE_NUMERIC_REQUIRED'
    if (valueColumns.valueNumeric < 0 || valueColumns.valueNumeric > 100) return 'SAP_SCORE_OUT_OF_RANGE'
  }
  if (outputKey === 'energy_label') {
    if (!valueColumns.valueText) return 'ENERGY_LABEL_TEXT_REQUIRED'
    if (!ENERGY_LABELS.has(valueColumns.valueText)) return 'ENERGY_LABEL_OUT_OF_RANGE'
  }
  return null
}

async function getEntityMap(client, cityId, entityIds) {
  const result = await client.query(
    `
      SELECT id::text, stable_id, city_id, entity_type
      FROM ldt_core.city_entities
      WHERE city_id = $1
        AND id = ANY($2::uuid[])
    `,
    [cityId, entityIds],
  )
  return new Map(result.rows.map((row) => [row.id, row]))
}

async function ensureStep(client, { runId, stepKey, stepOrder, title, status, toolKind, input = {}, output = {}, error = {} }) {
  const result = await client.query(
    `
      INSERT INTO ldt_ops.workflow_steps (
        run_id,
        step_key,
        step_order,
        title,
        status,
        tool_kind,
        input,
        output,
        error,
        started_at,
        finished_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb,
        CASE WHEN $5 IN ('running', 'succeeded', 'failed') THEN now() ELSE NULL END,
        CASE WHEN $5 IN ('succeeded', 'failed') THEN now() ELSE NULL END,
        now()
      )
      ON CONFLICT (run_id, step_key) DO UPDATE SET
        status = EXCLUDED.status,
        input = COALESCE(ldt_ops.workflow_steps.input, '{}'::jsonb) || EXCLUDED.input,
        output = COALESCE(ldt_ops.workflow_steps.output, '{}'::jsonb) || EXCLUDED.output,
        error = EXCLUDED.error,
        started_at = COALESCE(ldt_ops.workflow_steps.started_at, EXCLUDED.started_at),
        finished_at = EXCLUDED.finished_at,
        updated_at = now()
      RETURNING id
    `,
    [
      runId,
      stepKey,
      stepOrder,
      title,
      status,
      toolKind,
      JSON.stringify(input ?? {}),
      JSON.stringify(output ?? {}),
      JSON.stringify(error ?? {}),
    ],
  )
  return result.rows[0].id
}

async function recordArtifact(client, { runId, stepId, cityId, artifactKind, artifactUri, mediaType, byteSize, checksum, metadata = {} }) {
  const existing = await client.query(
    `
      SELECT id
      FROM ldt_ops.workflow_artifacts
      WHERE run_id = $1
        AND artifact_uri = $2
      LIMIT 1
    `,
    [runId, artifactUri],
  )
  if (existing.rowCount > 0) return existing.rows[0].id

  const result = await client.query(
    `
      INSERT INTO ldt_ops.workflow_artifacts (
        run_id,
        step_id,
        city_id,
        artifact_kind,
        artifact_uri,
        media_type,
        byte_size,
        checksum,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      RETURNING id
    `,
    [runId, stepId, cityId, artifactKind, artifactUri, mediaType, byteSize, checksum, JSON.stringify(metadata ?? {})],
  )
  return result.rows[0].id
}

async function upsertSimulationModel(client, { modelKey, modelVersion, manifest }) {
  const result = await client.query(
    `
      INSERT INTO ldt_science.simulation_models (
        model_key,
        name,
        model_family,
        version,
        definition
      )
      VALUES ($1, $2, 'external_enrichment_model', $3, $4::jsonb)
      ON CONFLICT (model_key) DO UPDATE SET
        name = EXCLUDED.name,
        model_family = EXCLUDED.model_family,
        version = EXCLUDED.version,
        definition = EXCLUDED.definition
      RETURNING id
    `,
    [
      modelKey,
      modelKey === 'eu-ldt-ecobuild' ? 'EU LDT EcoBuild Matrix enrichment' : modelKey,
      modelVersion,
      JSON.stringify({
        source: 'external-enrichment-exchange',
        requestedOutputs: manifest.requested_outputs ?? [],
        contractVersion: manifest.contract_version,
        packageKey: manifest.package_key,
      }),
    ],
  )
  return result.rows[0].id
}

async function upsertSimulationRun(client, { cityId, modelId, modelKey, workflowRunId, manifest, validation, resultChecksum }) {
  const runKey = `${modelKey}:${cityId}:${workflowRunId}`
  const result = await client.query(
    `
      INSERT INTO ldt_science.simulation_runs (
        city_id,
        model_id,
        run_key,
        scenario_key,
        status,
        inputs,
        outputs,
        uncertainty,
        started_at,
        finished_at
      )
      VALUES ($1, $2, $3, 'baseline', 'completed', $4::jsonb, $5::jsonb, $6::jsonb, now(), now())
      ON CONFLICT (run_key) DO UPDATE SET
        status = EXCLUDED.status,
        inputs = EXCLUDED.inputs,
        outputs = EXCLUDED.outputs,
        uncertainty = EXCLUDED.uncertainty,
        finished_at = now()
      RETURNING id, run_key
    `,
    [
      cityId,
      modelId,
      runKey,
      JSON.stringify({
        manifest: {
          packageKey: manifest.package_key,
          workflowRunId,
          objectCount: manifest.object_count,
          requestedOutputs: manifest.requested_outputs ?? [],
        },
      }),
      JSON.stringify({
        validation,
        resultChecksum,
        writes: ['ldt_enrichment.entity_model_outputs'],
      }),
      JSON.stringify({ status: 'external-model-provided' }),
    ],
  )
  return result.rows[0]
}

async function insertOutput(client, {
  cityId,
  entityId,
  workflowRunId,
  simulationRunId,
  sourceArtifactId,
  modelKey,
  modelVersion,
  outputKey,
  status,
  valueColumns,
  confidence,
  authorityStatus,
  method,
  inputSources,
  generatedAt,
}) {
  await client.query(
    `
      INSERT INTO ldt_enrichment.entity_model_outputs (
        city_id,
        entity_id,
        workflow_run_id,
        simulation_run_id,
        source_artifact_id,
        model_key,
        model_version,
        output_key,
        status,
        value_numeric,
        value_text,
        value_json,
        unit,
        confidence,
        authority_status,
        method,
        input_sources,
        uncertainty,
        warnings,
        generated_at,
        valid_from
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12::jsonb, $13,
        $14, $15, $16::jsonb, $17::jsonb, $18::jsonb, $19::jsonb,
        $20, $20
      )
    `,
    [
      cityId,
      entityId,
      workflowRunId,
      simulationRunId,
      sourceArtifactId,
      modelKey,
      modelVersion,
      outputKey,
      status,
      valueColumns.valueNumeric,
      valueColumns.valueText,
      JSON.stringify(valueColumns.valueJson ?? {}),
      valueColumns.unit,
      valueColumns.confidence ?? confidence,
      authorityStatus,
      JSON.stringify(method ?? {}),
      JSON.stringify(inputSources ?? []),
      JSON.stringify(valueColumns.uncertainty ?? {}),
      JSON.stringify(valueColumns.warnings ?? []),
      generatedAt,
    ],
  )
}

function buildValidation({ manifest, rows, entityMap }) {
  const allowedOutputs = new Set(manifest.return_contract?.output_keys ?? manifest.requested_outputs ?? [])
  const errors = []
  const outputRows = []
  const seenEntities = new Set()

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 1
    const entityId = String(row.entity_id ?? '').trim()
    const stableId = String(row.stable_id ?? '').trim()
    const entity = entityMap.get(entityId)
    const status = normalizeStatus(row.status)
    const modelKey = String(row.model_key ?? manifest.model_key ?? '').trim()
    const modelVersion = String(row.model_version ?? manifest.model_version ?? '').trim()
    const generatedAt = row.generated_at ? new Date(row.generated_at) : new Date()

    if (!entityId) errors.push({ row: rowNumber, code: 'ENTITY_ID_REQUIRED' })
    if (!entity) errors.push({ row: rowNumber, entityId, code: 'ENTITY_NOT_FOUND' })
    if (entity && stableId && entity.stable_id !== stableId) {
      errors.push({ row: rowNumber, entityId, code: 'STABLE_ID_MISMATCH', expected: entity.stable_id, actual: stableId })
    }
    if (!modelKey) errors.push({ row: rowNumber, entityId, code: 'MODEL_KEY_REQUIRED' })
    if (!modelVersion) errors.push({ row: rowNumber, entityId, code: 'MODEL_VERSION_REQUIRED' })
    if (Number.isNaN(generatedAt.getTime())) errors.push({ row: rowNumber, entityId, code: 'GENERATED_AT_INVALID' })

    seenEntities.add(entityId)

    const outputs = row.outputs && typeof row.outputs === 'object' ? row.outputs : {}
    let outputKeys = Object.keys(outputs)
    if (outputKeys.length === 0 && status !== 'computed') {
      outputKeys = [...allowedOutputs]
      for (const outputKey of outputKeys) {
        outputs[outputKey] = {
          value: null,
          warnings: row.warnings ?? [],
        }
      }
    }
    if (outputKeys.length === 0 && status === 'computed') errors.push({ row: rowNumber, entityId, code: 'OUTPUTS_REQUIRED' })

    for (const outputKey of outputKeys) {
      if (allowedOutputs.size > 0 && !allowedOutputs.has(outputKey)) {
        errors.push({ row: rowNumber, entityId, outputKey, code: 'OUTPUT_NOT_ALLOWED' })
        continue
      }
      const valueColumns = buildValueColumns(outputKey, outputs[outputKey])
      valueColumns.warnings = [
        ...(Array.isArray(row.warnings) ? row.warnings : []),
        ...(Array.isArray(valueColumns.warnings) ? valueColumns.warnings : []),
      ]
      const outputError = validateOutput(outputKey, valueColumns, status)
      if (outputError) errors.push({ row: rowNumber, entityId, outputKey, code: outputError })
      outputRows.push({
        rowNumber,
        entityId,
        stableId,
        modelKey,
        modelVersion,
        outputKey,
        status,
        valueColumns,
        confidence: row.confidence ?? 'model-derived',
        authorityStatus: row.authority_status ?? 'derived-model-output',
        method: row.method ?? {},
        inputSources: row.input_sources ?? [],
        generatedAt: generatedAt.toISOString(),
      })
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    outputRows,
    summary: {
      resultRows: rows.length,
      uniqueEntities: seenEntities.size,
      outputRows: outputRows.length,
      errors: errors.length,
    },
  }
}

async function main() {
  if (hasFlag('help') || process.argv.includes('-h')) {
    console.log(usage())
    return
  }

  const manifestPath = path.resolve(requireText(argValue('manifest'), 'MANIFEST_REQUIRED'))
  const resultsPath = path.resolve(requireText(argValue('results') || argValue('result'), 'RESULTS_REQUIRED'))
  const submittedBy = argValue('submitted-by') || argValue('submittedBy') || 'enrichment-import-cli'
  const databaseUrl = argValue('database-url') || argValue('databaseUrl') || getProductionDatabaseUrl()

  if (!databaseUrl && !productionDatabaseConfigured()) throw new Error('DATABASE_URL_REQUIRED')
  if (!hasFlag('skip-migrations')) {
    const migrationResult = await runProductionMigrationsForDatabaseUrl(databaseUrl)
    if (migrationResult.configured && !migrationResult.ok) throw new Error(`MIGRATIONS_FAILED:${migrationResult.error}`)
  }

  const manifest = await readJson(manifestPath)
  const rows = await readJsonl(resultsPath)
  const cityId = requireText(manifest.city_id, 'MANIFEST_CITY_REQUIRED')
  const workflowRunId = requireText(manifest.workflow_run_id, 'MANIFEST_WORKFLOW_RUN_REQUIRED')
  const modelKey = requireText(manifest.model_key, 'MANIFEST_MODEL_KEY_REQUIRED')
  const modelVersion = requireText(manifest.model_version, 'MANIFEST_MODEL_VERSION_REQUIRED')
  const resultStats = await fs.promises.stat(resultsPath)
  const resultChecksum = await sha256File(resultsPath)

  const pool = new Pool({ connectionString: databaseUrl })
  const client = await pool.connect()
  try {
    const entityIds = [...new Set(rows.map((row) => String(row.entity_id ?? '').trim()).filter(Boolean))]
    const entityMap = await getEntityMap(client, cityId, entityIds)
    const validation = buildValidation({ manifest, rows, entityMap })
    if (!validation.ok) {
      const error = new Error(`ENRICHMENT_RESULT_VALIDATION_FAILED:${validation.errors.length}`)
      error.validation = validation
      throw error
    }

    await client.query('BEGIN')
    try {
      const externalStepId = await ensureStep(client, {
        runId: workflowRunId,
        stepKey: 'external-model-execution',
        stepOrder: 20,
        title: 'External model enriches package',
        status: 'succeeded',
        toolKind: 'external-model-runner',
        output: {
          resultRows: validation.summary.resultRows,
          outputRows: validation.summary.outputRows,
          resultChecksum,
        },
      })
      const importStepId = await ensureStep(client, {
        runId: workflowRunId,
        stepKey: 'import-enrichment-results',
        stepOrder: 30,
        title: 'Import enrichment results',
        status: 'succeeded',
        toolKind: 'oldt-enrichment-importer',
        input: {
          manifestPath,
          resultsPath,
          submittedBy,
        },
        output: validation.summary,
      })
      await ensureStep(client, {
        runId: workflowRunId,
        stepKey: 'publish-enrichment-read-model',
        stepOrder: 40,
        title: 'Publish enrichment read model',
        status: 'succeeded',
        toolKind: 'system',
        output: {
          readModels: [
            'ldt_enrichment.entity_model_output_current',
            'ldt_enrichment.entity_model_output_summary',
            'ldt_query.city_objects_enriched',
          ],
        },
      })

      const sourceArtifactId = await recordArtifact(client, {
        runId: workflowRunId,
        stepId: importStepId,
        cityId,
        artifactKind: 'enrichment-result-objects',
        artifactUri: `file://${resultsPath}`,
        mediaType: 'application/x-ndjson',
        byteSize: resultStats.size,
        checksum: resultChecksum,
        metadata: {
          packageKey: manifest.package_key,
          modelKey,
          modelVersion,
          resultRows: validation.summary.resultRows,
          outputRows: validation.summary.outputRows,
          externalStepId,
        },
      })

      const modelId = await upsertSimulationModel(client, { modelKey, modelVersion, manifest })
      const simulationRun = await upsertSimulationRun(client, {
        cityId,
        modelId,
        modelKey,
        workflowRunId,
        manifest,
        validation: validation.summary,
        resultChecksum,
      })

      await client.query(
        `
          DELETE FROM ldt_enrichment.entity_model_outputs
          WHERE workflow_run_id = $1
            AND model_key = $2
        `,
        [workflowRunId, modelKey],
      )

      for (const outputRow of validation.outputRows) {
        await insertOutput(client, {
          cityId,
          entityId: outputRow.entityId,
          workflowRunId,
          simulationRunId: simulationRun.id,
          sourceArtifactId,
          modelKey: outputRow.modelKey,
          modelVersion: outputRow.modelVersion,
          outputKey: outputRow.outputKey,
          status: outputRow.status,
          valueColumns: outputRow.valueColumns,
          confidence: outputRow.confidence,
          authorityStatus: outputRow.authorityStatus,
          method: outputRow.method,
          inputSources: outputRow.inputSources,
          generatedAt: outputRow.generatedAt,
        })
      }

      await client.query(
        `
          UPDATE ldt_ops.workflow_runs
          SET status = 'succeeded',
              output = COALESCE(output, '{}'::jsonb) || $2::jsonb,
              finished_at = now(),
              updated_at = now()
          WHERE id = $1
        `,
        [
          workflowRunId,
          JSON.stringify({
            modelKey,
            modelVersion,
            resultChecksum,
            resultRows: validation.summary.resultRows,
            outputRows: validation.summary.outputRows,
            simulationRunId: simulationRun.id,
            simulationRunKey: simulationRun.run_key,
            sourceArtifactId,
            writes: ['ldt_enrichment.entity_model_outputs'],
          }),
        ],
      )

      await client.query('COMMIT')
      console.log(JSON.stringify({
        ok: true,
        workflowRunId,
        simulationRunId: simulationRun.id,
        simulationRunKey: simulationRun.run_key,
        sourceArtifactId,
        resultChecksum,
        validation: validation.summary,
      }, null, 2))
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message ?? 'ENRICHMENT_IMPORT_FAILED'),
    validation: error.validation ?? undefined,
  }, null, 2))
  process.exit(1)
})
