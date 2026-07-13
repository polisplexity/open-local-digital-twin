import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { finished } from 'node:stream/promises'

import pg from 'pg'

import {
  getProductionDatabaseUrl,
  productionDatabaseConfigured,
  runProductionMigrationsForDatabaseUrl,
} from '../db/migrate.mjs'

const { Pool } = pg

const DEFAULT_CONTRACT_VERSION = '0.1.0'
const DEFAULT_WORKFLOW_KEY = 'external-model-enrichment-exchange'

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
    '  npm run ops:export-enrichment-package -- --city=guanajuato --entity-type=building --model-key=eu-ldt-ecobuild --out=/tmp/oldt-enrichment-cycle --limit=500',
    '',
    'Options:',
    '  --city=<city-id>              Required city id.',
    '  --entity-type=<type>          Default: building.',
    '  --model-key=<key>             Default: eu-ldt-ecobuild.',
    '  --model-version=<version>     Default: external-candidate.',
    '  --outputs=<a,b>               Default: sap_score,energy_label.',
    '  --out=<directory>             Output root directory.',
    '  --limit=<n>                   Optional row limit for toy/model runs.',
    '  --database-url=<url>          Defaults to TWIN_STUDIO_DATABASE_URL.',
    '  --submitted-by=<label>        Audit label.',
    '  --skip-migrations             Do not run pending DB migrations first.',
  ].join('\n')
}

function requireText(value, code) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(code)
  return text
}

function parseLimit(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.min(parsed, 100000)
}

function safeKey(value) {
  return String(value ?? 'package')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'package'
}

function timestampKey(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-')
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

async function writeJson(filePath, value) {
  await fs.promises.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function writeObjectsJsonl(filePath, rows) {
  const stream = fs.createWriteStream(filePath, { encoding: 'utf8' })
  for (const row of rows) {
    stream.write(`${JSON.stringify(row)}\n`)
  }
  stream.end()
  await finished(stream)
}

async function queryCanonicalObjects(client, { cityId, entityType, limit }) {
  const params = [cityId, entityType]
  const limitSql = limit ? `LIMIT $${params.push(limit)}` : ''
  const result = await client.query(
    `
      SELECT
        ce.id::text AS entity_id,
        ce.stable_id,
        ce.city_id,
        ce.entity_type,
        ce.label,
        ce.authority_status,
        ce.confidence,
        ce.lifecycle_status,
        ce.properties,
        b.building_type,
        b.use_class,
        b.levels,
        b.height_m,
        b.footprint_area_m2,
        CASE
          WHEN b.footprint_area_m2 IS NOT NULL AND b.levels IS NOT NULL AND b.levels > 0
            THEN b.footprint_area_m2 * b.levels
          WHEN b.footprint_area_m2 IS NOT NULL
            THEN b.footprint_area_m2
          WHEN ce.geom IS NOT NULL AND GeometryType(ce.geom) IN ('POLYGON', 'MULTIPOLYGON')
            THEN ST_Area(ce.geom::geography)
          ELSE NULL
        END AS surface_m2_candidate,
        CASE
          WHEN ce.geom IS NOT NULL THEN ST_AsGeoJSON(ce.geom)::jsonb
          ELSE NULL
        END AS geometry
      FROM ldt_core.city_entities ce
      LEFT JOIN ldt_core.building_entities b ON b.entity_id = ce.id
      WHERE ce.city_id = $1
        AND ce.entity_type = $2
        AND ce.lifecycle_status = 'active'
      ORDER BY ce.stable_id
      ${limitSql}
    `,
    params,
  )

  return result.rows.map((row) => ({
    entity_id: row.entity_id,
    stable_id: row.stable_id,
    city_id: row.city_id,
    entity_type: row.entity_type,
    label: row.label,
    geometry: row.geometry ?? null,
    attributes: {
      authority_status: row.authority_status,
      confidence: row.confidence,
      lifecycle_status: row.lifecycle_status,
      building_type: row.building_type,
      use_class: row.use_class,
      levels: row.levels === null ? null : Number(row.levels),
      height_m: row.height_m === null ? null : Number(row.height_m),
      footprint_area_m2: row.footprint_area_m2 === null ? null : Number(row.footprint_area_m2),
      surface_m2_candidate: row.surface_m2_candidate === null ? null : Number(row.surface_m2_candidate),
    },
    properties: row.properties ?? {},
  }))
}

async function ensureWorkflowDefinition(client) {
  const result = await client.query(
    `
      INSERT INTO ldt_ops.workflow_definitions (
        workflow_key,
        name,
        purpose,
        domain,
        lifecycle_status,
        default_mode,
        input_contract,
        output_contract,
        standards_mapping,
        updated_at
      )
      VALUES (
        $1,
        'External Model Enrichment',
        'Exports canonical OLDT objects to external model runners and ingests returned entity-level enrichment outputs without changing canonical object identity.',
        'model-enrichment',
        'generated',
        'assisted',
        $2::jsonb,
        $3::jsonb,
        $4::jsonb,
        now()
      )
      ON CONFLICT (workflow_key) DO UPDATE SET
        name = EXCLUDED.name,
        purpose = EXCLUDED.purpose,
        domain = EXCLUDED.domain,
        lifecycle_status = EXCLUDED.lifecycle_status,
        input_contract = EXCLUDED.input_contract,
        output_contract = EXCLUDED.output_contract,
        standards_mapping = EXCLUDED.standards_mapping,
        updated_at = now()
      RETURNING id
    `,
    [
      DEFAULT_WORKFLOW_KEY,
      JSON.stringify({
        packageType: 'oldt-enrichment-input',
        requiredFields: ['entity_id', 'stable_id', 'city_id', 'entity_type'],
        rules: ['preserve_entity_id', 'do_not_create_entities', 'do_not_modify_geometry'],
      }),
      JSON.stringify({
        packageType: 'oldt-enrichment-result',
        requiredFields: ['entity_id', 'stable_id', 'model_key', 'model_version', 'outputs'],
        writes: ['ldt_enrichment.entity_model_outputs'],
      }),
      JSON.stringify({
        context: ['NGSI-LD', 'OGC API Features'],
        provenance: 'PROV-O',
        contract: 'OLDT Enrichment Exchange 0.1.0',
      }),
    ],
  )
  return result.rows[0].id
}

async function insertWorkflowRun(client, { workflowId, cityId, submittedBy, input }) {
  const result = await client.query(
    `
      INSERT INTO ldt_ops.workflow_runs (
        workflow_id,
        workflow_key,
        city_id,
        requested_by,
        requested_by_kind,
        trigger_kind,
        status,
        input,
        started_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, 'operator', 'manual', 'awaiting_external_result', $5::jsonb, now(), now())
      RETURNING id
    `,
    [workflowId, DEFAULT_WORKFLOW_KEY, cityId, submittedBy, JSON.stringify(input)],
  )
  return result.rows[0].id
}

async function upsertWorkflowStep(client, { runId, stepKey, stepOrder, title, status, toolKind, input = {}, output = {}, error = {} }) {
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
        step_order = EXCLUDED.step_order,
        title = EXCLUDED.title,
        status = EXCLUDED.status,
        tool_kind = EXCLUDED.tool_kind,
        input = EXCLUDED.input,
        output = EXCLUDED.output,
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

async function main() {
  if (hasFlag('help') || process.argv.includes('-h')) {
    console.log(usage())
    return
  }

  const cityId = requireText(argValue('city') || argValue('city-id') || argValue('cityId'), 'CITY_REQUIRED')
  const entityType = argValue('entity-type') || argValue('entityType') || 'building'
  const modelKey = argValue('model-key') || argValue('modelKey') || 'eu-ldt-ecobuild'
  const modelVersion = argValue('model-version') || argValue('modelVersion') || 'external-candidate'
  const requestedOutputs = (argValue('outputs') || 'sap_score,energy_label')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  const limit = parseLimit(argValue('limit'))
  const submittedBy = argValue('submitted-by') || argValue('submittedBy') || 'enrichment-export-cli'
  const outputRoot = path.resolve(argValue('out') || argValue('output') || path.join(process.cwd(), 'exports', 'enrichment-exchange'))
  const databaseUrl = argValue('database-url') || argValue('databaseUrl') || getProductionDatabaseUrl()

  if (!databaseUrl && !productionDatabaseConfigured()) throw new Error('DATABASE_URL_REQUIRED')
  if (!hasFlag('skip-migrations')) {
    const migrationResult = await runProductionMigrationsForDatabaseUrl(databaseUrl)
    if (migrationResult.configured && !migrationResult.ok) throw new Error(`MIGRATIONS_FAILED:${migrationResult.error}`)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const client = await pool.connect()
  try {
    const exportedAt = new Date()
    const packageKey = safeKey(`${cityId}-${entityType}-${modelKey}-${timestampKey(exportedAt)}`)
    const packageRoot = path.join(outputRoot, packageKey)
    await fs.promises.mkdir(packageRoot, { recursive: true })

    const objects = await queryCanonicalObjects(client, { cityId, entityType, limit })
    if (objects.length === 0) throw new Error(`NO_CANONICAL_OBJECTS:${cityId}:${entityType}`)

    const workflowId = await ensureWorkflowDefinition(client)
    const runId = await insertWorkflowRun(client, {
      workflowId,
      cityId,
      submittedBy,
      input: {
        cityId,
        entityType,
        modelKey,
        modelVersion,
        requestedOutputs,
        limit,
        contractVersion: DEFAULT_CONTRACT_VERSION,
      },
    })

    const exportStepId = await upsertWorkflowStep(client, {
      runId,
      stepKey: 'export-canonical-objects',
      stepOrder: 10,
      title: 'Export canonical OLDT objects',
      status: 'succeeded',
      toolKind: 'oldt-enrichment-exporter',
      output: {
        packageKey,
        objectCount: objects.length,
      },
    })
    await upsertWorkflowStep(client, {
      runId,
      stepKey: 'external-model-execution',
      stepOrder: 20,
      title: 'External model enriches package',
      status: 'pending',
      toolKind: 'external-model-runner',
    })
    await upsertWorkflowStep(client, {
      runId,
      stepKey: 'import-enrichment-results',
      stepOrder: 30,
      title: 'Import enrichment results',
      status: 'pending',
      toolKind: 'oldt-enrichment-importer',
    })
    await upsertWorkflowStep(client, {
      runId,
      stepKey: 'publish-enrichment-read-model',
      stepOrder: 40,
      title: 'Publish enrichment read model',
      status: 'pending',
      toolKind: 'system',
    })

    const objectsPath = path.join(packageRoot, 'objects.jsonl')
    await writeObjectsJsonl(objectsPath, objects)
    const objectsStats = await fs.promises.stat(objectsPath)
    const objectsChecksum = await sha256File(objectsPath)

    const manifest = {
      package_type: 'oldt-enrichment-input',
      contract_version: DEFAULT_CONTRACT_VERSION,
      package_key: packageKey,
      workflow_run_id: runId,
      city_id: cityId,
      entity_type: entityType,
      model_key: modelKey,
      model_version: modelVersion,
      requested_outputs: requestedOutputs,
      exported_at: exportedAt.toISOString(),
      submitted_by: submittedBy,
      object_count: objects.length,
      files: {
        objects: {
          path: 'objects.jsonl',
          media_type: 'application/x-ndjson',
          byte_size: objectsStats.size,
          checksum: objectsChecksum,
        },
      },
      rules: {
        preserve_entity_id: true,
        preserve_stable_id: true,
        do_not_create_entities: true,
        do_not_modify_geometry: true,
        return_not_computable_rows: true,
      },
      return_contract: {
        package_type: 'oldt-enrichment-result',
        required_fields: ['entity_id', 'stable_id', 'model_key', 'model_version', 'outputs', 'status', 'generated_at'],
        accepted_statuses: ['computed', 'not_computable', 'invalid', 'warning'],
        output_keys: requestedOutputs,
      },
    }
    const manifestPath = path.join(packageRoot, 'manifest.json')
    await writeJson(manifestPath, manifest)
    const manifestStats = await fs.promises.stat(manifestPath)
    const manifestChecksum = await sha256File(manifestPath)

    await recordArtifact(client, {
      runId,
      stepId: exportStepId,
      cityId,
      artifactKind: 'enrichment-input-objects',
      artifactUri: `file://${objectsPath}`,
      mediaType: 'application/x-ndjson',
      byteSize: objectsStats.size,
      checksum: objectsChecksum,
      metadata: {
        packageKey,
        contractVersion: DEFAULT_CONTRACT_VERSION,
        modelKey,
        modelVersion,
        entityType,
        objectCount: objects.length,
      },
    })
    await recordArtifact(client, {
      runId,
      stepId: exportStepId,
      cityId,
      artifactKind: 'enrichment-input-manifest',
      artifactUri: `file://${manifestPath}`,
      mediaType: 'application/json',
      byteSize: manifestStats.size,
      checksum: manifestChecksum,
      metadata: {
        packageKey,
        contractVersion: DEFAULT_CONTRACT_VERSION,
        modelKey,
        modelVersion,
        entityType,
        objectCount: objects.length,
        objectsChecksum,
      },
    })

    await client.query(
      `
        UPDATE ldt_ops.workflow_runs
        SET output = COALESCE(output, '{}'::jsonb) || $2::jsonb,
            updated_at = now()
        WHERE id = $1
      `,
      [
        runId,
        JSON.stringify({
          packageKey,
          packageRoot,
          manifestPath,
          objectsPath,
          manifestChecksum,
          objectsChecksum,
          objectCount: objects.length,
        }),
      ],
    )

    console.log(JSON.stringify({
      ok: true,
      workflowRunId: runId,
      packageKey,
      packageRoot,
      manifestPath,
      objectsPath,
      objectCount: objects.length,
      manifestChecksum,
      objectsChecksum,
    }, null, 2))
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message ?? 'ENRICHMENT_EXPORT_FAILED'),
  }, null, 2))
  process.exit(1)
})
