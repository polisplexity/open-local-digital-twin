import { withClient } from './dbUtils.mjs'
import {
  assertDataModellerSchemaApproved,
  buildDataModellerSchemaPayload,
  createDataModellerSchema,
  dataModellerOutputValue,
  generateDataModellerFixture,
  getDataModellerSchema,
  selectDataModellerCanonicalRows,
} from './euLdtDataModellerService.mjs'
import { resolveEuLdtIntegrationTarget } from './euLdtIntegrationService.mjs'

function textValue(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function boundedInteger(value, fallback, minimum = 1, maximum = 250) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(minimum, Math.min(Math.floor(numeric), maximum))
}

function normalizedKey(value, fallback, errorCode) {
  const normalized = textValue(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{1,128}$/.test(normalized)) throw new Error(errorCode)
  return normalized
}

function workflowArtifactUri(runId, artifactKind) {
  return `ldt://workflow-runs/${runId}/${artifactKind}.json`
}

function normalizeRun(row = {}) {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    workflowKey: row.workflow_key,
    canonicalWorkflowKey: row.workflow_key,
    workflowName: row.workflow_name ?? null,
    cityId: row.city_id,
    requestedBy: row.requested_by,
    requestedByKind: row.requested_by_kind,
    triggerKind: row.trigger_kind,
    status: row.status,
    input: row.input ?? {},
    output: row.output ?? {},
    error: row.error ?? {},
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeStep(row = {}) {
  return {
    id: row.id,
    runId: row.run_id,
    stepKey: row.step_key,
    stepOrder: row.step_order,
    title: row.title,
    status: row.status,
    toolKind: row.tool_kind,
    input: row.input ?? {},
    output: row.output ?? {},
    error: row.error ?? {},
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeApproval(row = {}) {
  return {
    id: row.id,
    runId: row.run_id,
    approvalKey: row.approval_key,
    status: row.status,
    requestedBy: row.requested_by,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionReason: row.decision_reason,
    policy: row.policy ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeArtifact(row = {}) {
  return {
    id: row.id,
    runId: row.run_id,
    stepId: row.step_id,
    cityId: row.city_id,
    artifactKind: row.artifact_kind,
    artifactUri: row.artifact_uri,
    mediaType: row.media_type,
    byteSize: row.byte_size ? Number(row.byte_size) : null,
    checksum: row.checksum,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

async function workflowRunDetail(client, runId) {
  const runResult = await client.query(
    `
      SELECT run.*, definition.name AS workflow_name
      FROM ldt_ops.workflow_runs run
      LEFT JOIN ldt_ops.workflow_definitions definition ON definition.id = run.workflow_id
      WHERE run.id = $1
    `,
    [runId],
  )
  if (runResult.rowCount === 0) return null
  const steps = await client.query('SELECT * FROM ldt_ops.workflow_steps WHERE run_id = $1 ORDER BY step_order, step_key', [runId])
  const approvals = await client.query('SELECT * FROM ldt_ops.workflow_approvals WHERE run_id = $1 ORDER BY created_at, approval_key', [runId])
  const artifacts = await client.query('SELECT * FROM ldt_ops.workflow_artifacts WHERE run_id = $1 ORDER BY created_at DESC', [runId])
  return {
    ...normalizeRun(runResult.rows[0]),
    steps: steps.rows.map(normalizeStep),
    approvals: approvals.rows.map(normalizeApproval),
    artifacts: artifacts.rows.map(normalizeArtifact),
  }
}

async function updateRun(client, runId, status, output = {}, error = {}) {
  const result = await client.query(
    `
      UPDATE ldt_ops.workflow_runs
      SET status = $2,
          output = COALESCE(output, '{}'::jsonb) || $3::jsonb,
          error = $4::jsonb,
          started_at = CASE WHEN $2 IN ('running', 'succeeded', 'failed') THEN COALESCE(started_at, now()) ELSE started_at END,
          finished_at = CASE WHEN $2 IN ('succeeded', 'failed') THEN now() ELSE finished_at END,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [runId, status, JSON.stringify(output ?? {}), JSON.stringify(error ?? {})],
  )
  if (!result.rowCount) throw new Error('WORKFLOW_RUN_NOT_FOUND')
  return result.rows[0]
}

async function updateStep(client, runId, stepKey, status, output = {}, error = {}) {
  const result = await client.query(
    `
      UPDATE ldt_ops.workflow_steps
      SET status = $3,
          output = COALESCE(output, '{}'::jsonb) || $4::jsonb,
          error = $5::jsonb,
          started_at = CASE WHEN $3 IN ('running', 'succeeded', 'failed') THEN COALESCE(started_at, now()) ELSE started_at END,
          finished_at = CASE WHEN $3 IN ('succeeded', 'failed') THEN now() ELSE finished_at END,
          updated_at = now()
      WHERE run_id = $1 AND step_key = $2
      RETURNING *
    `,
    [runId, stepKey, status, JSON.stringify(output ?? {}), JSON.stringify(error ?? {})],
  )
  if (!result.rowCount) throw new Error(`WORKFLOW_STEP_NOT_FOUND:${stepKey}`)
  return result.rows[0]
}

async function recordArtifact(client, { runId, stepId, cityId, artifactKind, metadata = {} }) {
  const artifactUri = workflowArtifactUri(runId, artifactKind)
  const existing = await client.query(
    'SELECT * FROM ldt_ops.workflow_artifacts WHERE run_id = $1 AND artifact_uri = $2 LIMIT 1',
    [runId, artifactUri],
  )
  if (existing.rowCount) return existing.rows[0]
  const result = await client.query(
    `
      INSERT INTO ldt_ops.workflow_artifacts (
        run_id, step_id, city_id, artifact_kind, artifact_uri, media_type, metadata
      )
      VALUES ($1, $2, $3, $4, $5, 'application/json', $6::jsonb)
      RETURNING *
    `,
    [runId, stepId, cityId, artifactKind, artifactUri, JSON.stringify(metadata ?? {})],
  )
  return result.rows[0]
}

function stepMap(run) {
  return new Map((run?.steps ?? []).map((step) => [step.stepKey, step]))
}

function profileFrontendUrl(profile = {}) {
  return textValue(
    profile.endpoints?.publicFrontendUrl
      ?? profile.endpoints?.frontendUrl
      ?? profile.baseUrl,
  )
}

async function markFailed(client, runId, error, fallbackCode) {
  const message = String(error?.message ?? fallbackCode)
  try {
    await updateRun(client, runId, 'failed', {}, { message })
    return await workflowRunDetail(client, runId)
  } catch {
    return null
  }
}

function prepareSchemaResult(error, run = null) {
  return {
    configured: true,
    ok: false,
    run,
    artifacts: [],
    summary: null,
    error: String(error?.message ?? error ?? 'EU_LDT_DATA_MODELLER_SCHEMA_FAILED'),
  }
}

export async function executeEuLdtDataModellerPrepareSchemaOnce({ runId, workerId = 'eu-ldt-data-modeller-schema-worker' } = {}) {
  if (!runId) return prepareSchemaResult('WORKFLOW_RUN_ID_REQUIRED')

  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const initialRun = await workflowRunDetail(client, runId)
      if (!initialRun) throw new Error('WORKFLOW_RUN_NOT_FOUND')
      if (initialRun.workflowKey !== 'eu-ldt-data-modeller-prepare-schema') throw new Error('EU_LDT_DATA_MODELLER_SCHEMA_WORKFLOW_RUN_REQUIRED')
      if (!['queued', 'running'].includes(initialRun.status)) throw new Error(`WORKFLOW_RUN_NOT_EXECUTABLE:${initialRun.status}`)

      const input = initialRun.input ?? {}
      const integrationProfileKey = textValue(input.integrationProfileKey ?? input.integration_profile_key)
      if (!integrationProfileKey) throw new Error('DATA_MODELLER_INTEGRATION_PROFILE_REQUIRED')
      const target = await resolveEuLdtIntegrationTarget(client, integrationProfileKey, {
        platformKind: 'data-modeller',
        endpointKey: 'backendApiUrl',
      })
      const entityType = textValue(input.entityType ?? input.entity_type, 'building')
      const limit = boundedInteger(input.limit, 25)

      await updateRun(client, runId, 'running', {
        executor: workerId,
        integrationProfileKey: target.profileKey,
        integrationProfileName: target.displayName,
        externalSystem: `eu-ldt-data-modeller:${target.profileKey}`,
      })
      const run = await workflowRunDetail(client, runId)
      const steps = stepMap(run)
      await updateStep(client, runId, 'prepare-run-context', 'succeeded', {
        cityId: run.cityId,
        workerId,
        integrationProfileKey: target.profileKey,
      })
      await updateStep(client, runId, 'validate-input-contract', 'succeeded', {
        entityType,
        limit,
        endpoint: target.endpoint,
      })

      const selected = await selectDataModellerCanonicalRows(client, {
        cityId: run.cityId,
        entityType,
        limit,
      })
      if (!selected.rows.length) throw new Error('DATA_MODELLER_CANONICAL_SAMPLE_EMPTY')
      await updateStep(client, runId, 'select-canonical-sample', 'succeeded', {
        entityType: selected.entityType,
        selectedCount: selected.rows.length,
        entityIds: selected.rows.map((row) => row.entity_id),
      })

      const schemaPackage = buildDataModellerSchemaPayload(selected.rows, {
        entityType: selected.entityType,
        schemaName: input.schemaName ?? input.schema_name,
        referenceName: input.referenceName ?? input.reference_name,
        version: input.version,
        ownership: input.ownership,
        description: input.description,
        tags: Array.isArray(input.tags) ? input.tags : textValue(input.tags).split(',').map((entry) => entry.trim()).filter(Boolean),
        outputField: input.outputField ?? input.output_field,
        outputMinimum: input.outputMinimum ?? input.output_minimum,
        outputMaximum: input.outputMaximum ?? input.output_maximum,
      })
      await updateStep(client, runId, 'infer-synth-schema', 'succeeded', {
        referenceName: schemaPackage.referenceName,
        sampleCount: schemaPackage.sampleCount,
        outputField: schemaPackage.outputField,
        fields: Object.keys(schemaPackage.schema.content).filter((key) => key !== 'type'),
        fieldMap: schemaPackage.fieldMap,
      })

      const created = await createDataModellerSchema({
        endpoint: target.endpoint,
        headers: target.headers,
        payload: schemaPackage.payload,
        timeoutMs: input.timeoutMs ?? input.timeout_ms,
      })
      await updateStep(client, runId, 'register-data-modeller-schema', 'succeeded', {
        schemaId: created.schemaId,
        status: created.status,
        apiBase: created.apiBase,
      })

      const readback = await getDataModellerSchema({
        endpoint: target.endpoint,
        headers: target.headers,
        schemaId: created.schemaId,
        timeoutMs: input.timeoutMs ?? input.timeout_ms,
      })
      const remoteSchema = readback.schema ?? {}
      if (textValue(remoteSchema.id) !== created.schemaId) throw new Error('DATA_MODELLER_SCHEMA_READBACK_ID_MISMATCH')
      await updateStep(client, runId, 'verify-data-modeller-schema', 'succeeded', {
        schemaId: created.schemaId,
        name: remoteSchema.name,
        referenceName: remoteSchema.referenceName,
        status: remoteSchema.status,
        isApproved: remoteSchema.isApproved === true,
        evaluationScore: Number(remoteSchema.evaluationScore ?? 0),
      })

      const summary = {
        cityId: run.cityId,
        integrationProfileKey: target.profileKey,
        integrationProfileName: target.displayName,
        externalSystem: `eu-ldt-data-modeller:${target.profileKey}`,
        dataModellerUrl: profileFrontendUrl(target.profile),
        schemaId: created.schemaId,
        schemaName: remoteSchema.name ?? schemaPackage.payload.name,
        referenceName: remoteSchema.referenceName ?? schemaPackage.referenceName,
        schemaStatus: remoteSchema.status ?? 'COMPLETED',
        isApproved: remoteSchema.isApproved === true,
        evaluationScore: Number(remoteSchema.evaluationScore ?? 0),
        entityType: selected.entityType,
        selectedCount: selected.rows.length,
        outputField: schemaPackage.outputField,
        authorityStatus: 'operator-prepared-schema',
        publicationStatus: 'external-schema-registered',
        nextAction: 'evaluate-and-approve-in-data-modeller',
      }
      const specs = [
        { kind: 'data-modeller-profile', step: 'prepare-run-context', metadata: { profile: target.profile } },
        {
          kind: 'canonical-sample',
          step: 'select-canonical-sample',
          metadata: {
            entityType: selected.entityType,
            selectedCount: selected.rows.length,
            rows: selected.rows,
          },
        },
        { kind: 'synth-schema', step: 'infer-synth-schema', metadata: { schema: schemaPackage.schema, fieldMap: schemaPackage.fieldMap, outputField: schemaPackage.outputField } },
        { kind: 'data-modeller-schema-registration', step: 'register-data-modeller-schema', metadata: { schemaId: created.schemaId, response: created.body, readback: remoteSchema } },
        { kind: 'data-modeller-schema-summary', step: 'write-data-modeller-schema-artifacts', metadata: summary },
      ]
      const artifacts = []
      for (const spec of specs) {
        artifacts.push(await recordArtifact(client, {
          runId,
          stepId: steps.get(spec.step)?.id ?? null,
          cityId: run.cityId,
          artifactKind: spec.kind,
          metadata: {
            workflowRunId: runId,
            workflowKey: run.workflowKey,
            integrationProfileKey: target.profileKey,
            ...spec.metadata,
          },
        }))
      }
      await updateStep(client, runId, 'write-data-modeller-schema-artifacts', 'succeeded', {
        artifactCount: artifacts.length,
        artifactKinds: artifacts.map((artifact) => artifact.artifact_kind),
        summary,
      })
      await updateRun(client, runId, 'succeeded', {
        executor: workerId,
        integrationProfileKey: target.profileKey,
        integrationProfileName: target.displayName,
        externalSystem: `eu-ldt-data-modeller:${target.profileKey}`,
        summary,
        artifacts: artifacts.map(normalizeArtifact),
      })
      await client.query('COMMIT')
      return {
        configured: true,
        ok: true,
        run: await workflowRunDetail(client, runId),
        artifacts: artifacts.map(normalizeArtifact),
        summary,
        error: null,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      const run = await markFailed(client, runId, error, 'EU_LDT_DATA_MODELLER_SCHEMA_FAILED')
      return prepareSchemaResult(error, run)
    }
  }).catch((error) => prepareSchemaResult(error))
}

function fixtureResult(error, run = null) {
  return {
    configured: true,
    ok: false,
    run,
    artifacts: [],
    summary: null,
    imported: [],
    error: String(error?.message ?? error ?? 'EU_LDT_DATA_MODELLER_FIXTURE_IMPORT_FAILED'),
  }
}

export async function executeEuLdtDataModellerFixtureImportOnce({ runId, workerId = 'eu-ldt-data-modeller-fixture-worker' } = {}) {
  if (!runId) return fixtureResult('WORKFLOW_RUN_ID_REQUIRED')

  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const initialRun = await workflowRunDetail(client, runId)
      if (!initialRun) throw new Error('WORKFLOW_RUN_NOT_FOUND')
      if (initialRun.workflowKey !== 'eu-ldt-data-modeller-fixture-import') throw new Error('EU_LDT_DATA_MODELLER_FIXTURE_WORKFLOW_RUN_REQUIRED')
      if (!['queued', 'running'].includes(initialRun.status)) throw new Error(`WORKFLOW_RUN_NOT_EXECUTABLE:${initialRun.status}`)

      const input = initialRun.input ?? {}
      const integrationProfileKey = textValue(input.integrationProfileKey ?? input.integration_profile_key)
      if (!integrationProfileKey) throw new Error('DATA_MODELLER_INTEGRATION_PROFILE_REQUIRED')
      const schemaId = textValue(input.schemaId ?? input.schema_id)
      if (!schemaId) throw new Error('DATA_MODELLER_SCHEMA_ID_REQUIRED')
      const entityType = textValue(input.entityType ?? input.entity_type, 'building')
      const recordCount = boundedInteger(input.recordCount ?? input.record_count, 25)
      const modelKey = normalizedKey(input.modelKey ?? input.model_key, 'eu-ldt-data-modeller-fixture', 'DATA_MODELLER_MODEL_KEY_INVALID')
      const modelVersion = textValue(input.modelVersion ?? input.model_version, 'data-modeller-synthetic')
      const outputField = textValue(input.outputField ?? input.output_field, 'synthetic_score')
      const outputKey = normalizedKey(input.outputKey ?? input.output_key, 'synthetic-score', 'DATA_MODELLER_OUTPUT_KEY_INVALID')
      const unit = textValue(input.unit) || null
      const minimumEvaluationScore = Number(input.minimumEvaluationScore ?? input.minimum_evaluation_score ?? 80)
      const target = await resolveEuLdtIntegrationTarget(client, integrationProfileKey, {
        platformKind: 'data-modeller',
        endpointKey: 'backendApiUrl',
      })

      await updateRun(client, runId, 'running', {
        executor: workerId,
        integrationProfileKey: target.profileKey,
        integrationProfileName: target.displayName,
        externalSystem: `eu-ldt-data-modeller:${target.profileKey}`,
      })
      const run = await workflowRunDetail(client, runId)
      const steps = stepMap(run)
      await updateStep(client, runId, 'prepare-run-context', 'succeeded', {
        cityId: run.cityId,
        workerId,
        integrationProfileKey: target.profileKey,
      })
      await updateStep(client, runId, 'validate-input-contract', 'succeeded', {
        schemaId,
        entityType,
        recordCount,
        modelKey,
        modelVersion,
        outputField,
        outputKey,
      })

      const readback = await getDataModellerSchema({
        endpoint: target.endpoint,
        headers: target.headers,
        schemaId,
        timeoutMs: input.timeoutMs ?? input.timeout_ms,
      })
      const gate = assertDataModellerSchemaApproved(readback.schema, minimumEvaluationScore)
      await updateStep(client, runId, 'verify-approved-data-modeller-schema', 'succeeded', {
        schemaId,
        schemaName: readback.schema?.name,
        referenceName: readback.schema?.referenceName,
        ...gate,
      })

      const selected = await selectDataModellerCanonicalRows(client, {
        cityId: run.cityId,
        entityType,
        limit: recordCount,
      })
      if (!selected.rows.length) throw new Error('DATA_MODELLER_FIXTURE_TARGETS_EMPTY')
      await updateStep(client, runId, 'select-fixture-target-entities', 'succeeded', {
        entityType: selected.entityType,
        selectedCount: selected.rows.length,
        entityIds: selected.rows.map((row) => row.entity_id),
      })

      const generated = await generateDataModellerFixture({
        endpoint: target.endpoint,
        headers: target.headers,
        schemaId,
        recordCount: selected.rows.length,
        timeoutMs: input.timeoutMs ?? input.timeout_ms,
      })
      const pairCount = Math.min(selected.rows.length, generated.records.length)
      if (!pairCount) throw new Error('DATA_MODELLER_FIXTURE_PAIRING_EMPTY')
      await updateStep(client, runId, 'generate-data-modeller-fixture', 'succeeded', {
        schemaId,
        requestedCount: selected.rows.length,
        generatedCount: generated.records.length,
        pairedCount: pairCount,
        referenceName: generated.referenceName,
      })

      const fixtureArtifact = await recordArtifact(client, {
        runId,
        stepId: steps.get('generate-data-modeller-fixture')?.id ?? null,
        cityId: run.cityId,
        artifactKind: 'synthetic-fixture',
        metadata: {
          workflowRunId: runId,
          workflowKey: run.workflowKey,
          integrationProfileKey: target.profileKey,
          schemaId,
          referenceName: generated.referenceName,
          generatedCount: generated.records.length,
          records: generated.records,
          authorityStatus: 'simulated',
        },
      })

      const imported = []
      const mapping = []
      for (let index = 0; index < pairCount; index += 1) {
        const entity = selected.rows[index]
        const record = generated.records[index]
        const output = dataModellerOutputValue(record, outputField)
        const inserted = await client.query(
          `
            INSERT INTO ldt_enrichment.entity_model_outputs (
              city_id,
              entity_id,
              workflow_run_id,
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
              warnings,
              generated_at
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              'computed', $8, $9, $10::jsonb, $11,
              'synthetic', 'simulated', $12::jsonb, $13::jsonb, $14::jsonb, now()
            )
            RETURNING id, city_id, entity_id, model_key, model_version, output_key, value_numeric, value_text, authority_status, generated_at
          `,
          [
            run.cityId,
            entity.entity_id,
            runId,
            fixtureArtifact.id,
            modelKey,
            modelVersion,
            outputKey,
            output.valueNumeric,
            output.valueText,
            JSON.stringify({
              ...output.valueJson,
              rawRecord: record,
              outputField,
              schemaId,
            }),
            unit,
            JSON.stringify({
              generator: 'EU LDT Data Modeller',
              integrationProfileKey: target.profileKey,
              integrationProfileName: target.displayName,
              schemaId,
              schemaEvaluationScore: gate.evaluationScore,
              workflowRunId: runId,
              pairing: 'stable-id-order-to-generated-record-order',
            }),
            JSON.stringify([
              {
                kind: 'data-modeller-synthetic-fixture',
                integrationProfileKey: target.profileKey,
                schemaId,
                sourceArtifactId: fixtureArtifact.id,
                generatedRecordIndex: index,
              },
            ]),
            JSON.stringify([
              {
                code: 'SYNTHETIC_FIXTURE_NOT_OBSERVED_DATA',
                message: 'Generated value is simulated test data and must not be presented as a municipal observation.',
              },
            ]),
          ],
        )
        imported.push(inserted.rows[0])
        mapping.push({
          entityId: entity.entity_id,
          stableId: entity.stable_id,
          generatedRecordIndex: index,
          outputValue: output.value,
          modelOutputId: inserted.rows[0].id,
        })
      }
      await updateStep(client, runId, 'import-simulated-model-outputs', 'succeeded', {
        importedCount: imported.length,
        modelKey,
        modelVersion,
        outputKey,
        outputField,
        authorityStatus: 'simulated',
      })

      const summary = {
        cityId: run.cityId,
        integrationProfileKey: target.profileKey,
        integrationProfileName: target.displayName,
        externalSystem: `eu-ldt-data-modeller:${target.profileKey}`,
        dataModellerUrl: profileFrontendUrl(target.profile),
        schemaId,
        schemaName: readback.schema?.name ?? null,
        schemaEvaluationScore: gate.evaluationScore,
        minimumEvaluationScore: gate.minimumEvaluationScore,
        entityType: selected.entityType,
        selectedCount: selected.rows.length,
        generatedCount: generated.records.length,
        importedCount: imported.length,
        modelKey,
        modelVersion,
        outputField,
        outputKey,
        authorityStatus: 'simulated',
        promotionStatus: 'promoted-to-enrichment-output',
        publicationStatus: 'refresh_required',
      }
      const specs = [
        { kind: 'data-modeller-schema-gate', step: 'verify-approved-data-modeller-schema', metadata: { schema: readback.schema, gate } },
        { kind: 'fixture-entity-mapping', step: 'select-fixture-target-entities', metadata: { mapping } },
        { kind: 'imported-simulated-outputs', step: 'import-simulated-model-outputs', metadata: { imported } },
        { kind: 'data-modeller-fixture-summary', step: 'write-data-modeller-fixture-artifacts', metadata: summary },
      ]
      const artifacts = [fixtureArtifact]
      for (const spec of specs) {
        artifacts.push(await recordArtifact(client, {
          runId,
          stepId: steps.get(spec.step)?.id ?? null,
          cityId: run.cityId,
          artifactKind: spec.kind,
          metadata: {
            workflowRunId: runId,
            workflowKey: run.workflowKey,
            integrationProfileKey: target.profileKey,
            schemaId,
            ...spec.metadata,
          },
        }))
      }
      await updateStep(client, runId, 'write-data-modeller-fixture-artifacts', 'succeeded', {
        artifactCount: artifacts.length,
        artifactKinds: artifacts.map((artifact) => artifact.artifact_kind),
        summary,
      })
      await updateRun(client, runId, 'succeeded', {
        executor: workerId,
        integrationProfileKey: target.profileKey,
        integrationProfileName: target.displayName,
        externalSystem: `eu-ldt-data-modeller:${target.profileKey}`,
        summary,
        artifacts: artifacts.map(normalizeArtifact),
      })
      await client.query('COMMIT')
      return {
        configured: true,
        ok: true,
        run: await workflowRunDetail(client, runId),
        artifacts: artifacts.map(normalizeArtifact),
        summary,
        imported,
        error: null,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      const run = await markFailed(client, runId, error, 'EU_LDT_DATA_MODELLER_FIXTURE_IMPORT_FAILED')
      return fixtureResult(error, run)
    }
  }).catch((error) => fixtureResult(error))
}
