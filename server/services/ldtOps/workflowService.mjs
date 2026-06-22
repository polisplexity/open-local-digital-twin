import { createHash } from 'node:crypto'

import { inspectProviderIngestionCapabilities } from '../providerLayerIngestionService.mjs'
import { withClient } from './dbUtils.mjs'

function normalizeWorkflowRun(row) {
  if (!row) return null
  return {
    id: row.id,
    workflowId: row.workflow_id,
    workflowKey: row.workflow_key,
    workflowName: row.workflow_name ?? row.name ?? null,
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

function normalizeWorkflowApproval(row) {
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

function normalizeWorkflowStep(row) {
  return {
    id: row.id,
    runId: row.run_id,
    stepKey: row.step_key,
    stepOrder: row.step_order,
    title: row.title,
    status: row.status,
    toolKind: row.tool_kind,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    input: row.input ?? {},
    output: row.output ?? {},
    error: row.error ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeWorkflowArtifact(row) {
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
    datasetId: row.dataset_id,
    sourceFeatureId: row.source_feature_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

function normalizeExtractorRun(row) {
  return {
    id: row.id,
    extractorId: row.extractor_id,
    extractorKey: row.extractor_key,
    cityId: row.city_id,
    workflowRunId: row.workflow_run_id,
    runKey: row.run_key,
    scenarioKey: row.scenario_key,
    status: row.status,
    sourceStatus: row.source_status,
    requestedBy: row.requested_by,
    requestedByKind: row.requested_by_kind,
    triggerKind: row.trigger_kind,
    inputSummary: row.input_summary ?? {},
    outputSummary: row.output_summary ?? {},
    validationReport: row.validation_report ?? {},
    error: row.error ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function workflowStepTemplates(workflowKey) {
  const shared = [
    { stepKey: 'prepare-run-context', title: 'Prepare run context', toolKind: 'system' },
    { stepKey: 'validate-input-contract', title: 'Validate input contract', toolKind: 'system' },
  ]
  const templates = {
    'open-data-city-bootstrap': [
      ...shared,
      { stepKey: 'collect-open-sources', title: 'Collect open source datasets', toolKind: 'workflow-worker' },
      { stepKey: 'build-provenance-catalog', title: 'Build catalog and provenance records', toolKind: 'workflow-worker' },
      { stepKey: 'refresh-consolidated-inventory', title: 'Refresh consolidated inventory', toolKind: 'workflow-worker' },
      { stepKey: 'produce-quality-report', title: 'Produce source quality report', toolKind: 'workflow-worker' },
    ],
    'phase14-open-data-workflow-runner': [
      ...shared,
      { stepKey: 'resolve-source-plan', title: 'Resolve city source plan', toolKind: 'workflow-worker' },
      { stepKey: 'enqueue-open-data-bootstrap', title: 'Enqueue OSM and open-data bootstrap jobs', toolKind: 'provider-ingestion-worker' },
      { stepKey: 'validate-provider-exchange-package', title: 'Validate provider exchange package posture', toolKind: 'workflow-worker' },
      { stepKey: 'register-environmental-extractor-runs', title: 'Register environmental extractor runs', toolKind: 'workflow-worker' },
      { stepKey: 'write-artifact-and-validation-records', title: 'Write artifacts and validation records', toolKind: 'workflow-worker' },
      { stepKey: 'publish-workspace-run-summary', title: 'Publish Workspace run summary', toolKind: 'workflow-worker' },
    ],
    'private-provider-validation': [
      ...shared,
      { stepKey: 'inspect-provider-package', title: 'Inspect provider package', toolKind: 'workflow-worker' },
      { stepKey: 'validate-license-and-access', title: 'Validate license and access policy', toolKind: 'human-review' },
      { stepKey: 'stage-provider-evidence', title: 'Stage provider evidence', toolKind: 'workflow-worker' },
      { stepKey: 'request-publication-approval', title: 'Request publication approval', toolKind: 'human-review' },
    ],
    'standards-publication-refresh': [
      ...shared,
      { stepKey: 'refresh-dcat', title: 'Refresh DCAT catalog export', toolKind: 'workflow-worker' },
      { stepKey: 'refresh-ngsi-ld', title: 'Refresh NGSI-LD projections', toolKind: 'workflow-worker' },
      { stepKey: 'refresh-ogc-api-features', title: 'Refresh OGC API Features outputs', toolKind: 'workflow-worker' },
      { stepKey: 'refresh-readiness-report', title: 'Refresh capability readiness report', toolKind: 'workflow-worker' },
    ],
  }
  return templates[workflowKey] ?? shared
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function phase14ProviderAction(entry) {
  const explicit = String(entry?.action ?? entry?.requestedAction ?? entry?.requested_action ?? entry?.mode ?? '').trim().toLowerCase()
  if (explicit) return explicit === 'ogc' ? 'ogc-features' : explicit
  const sourceFormat = String(entry?.sourceFormat ?? entry?.source_format ?? '').trim().toLowerCase()
  if (sourceFormat === 'geojson') return 'geojson'
  if (sourceFormat === 'csv') return 'csv'
  if (sourceFormat === 'ogc-api-features' || sourceFormat === 'ogc') return 'ogc-features'
  if (sourceFormat === 'stac') return 'stac'
  if (sourceFormat === 'cityjson') return 'cityjson'
  if (sourceFormat === 'overture-buildings') return 'overture-buildings'
  if (sourceFormat === 'overture-roads') return 'overture-roads'
  return 'package'
}

function phase14SourceValidation(providerPackage) {
  const issues = []
  const sourceUri = providerPackage.sourceUri || ''
  const sourceScheme = sourceUri.includes('://') ? sourceUri.split('://')[0].toLowerCase() : ''
  const hasSourceUri = Boolean(sourceUri)
  const isOpenConnectorAction = providerPackage.action.startsWith('overture-') || providerPackage.action === 'osm-local-extract' || providerPackage.action === 'mvt-cache-refresh'
  const hasRawOsmSchema = providerPackage.action === 'osm-local-extract' && Boolean(providerPackage.metadata?.rawSchema || providerPackage.metadata?.raw_schema)
  const isViewerRefresh = providerPackage.action === 'mvt-cache-refresh'
  const isPackageMetadataOnly = providerPackage.action === 'package' && !hasSourceUri && Object.keys(providerPackage.metadata ?? {}).length > 0
  const isSmokeOnly = sourceScheme === 'memory' || sourceScheme === 'test' || sourceUri.includes('smoke')
  const isSupportedRealScheme = ['http', 'https', 's3', 'gs', 'az', 'file'].includes(sourceScheme)
  if (!providerPackage.layerKey) {
    issues.push({ severity: 'error', code: 'LAYER_KEY_REQUIRED', message: 'Provider package must target a registered layer key.' })
  }
  if (!hasSourceUri && !isOpenConnectorAction && !isPackageMetadataOnly) {
    issues.push({ severity: 'warning', code: 'SOURCE_URI_RECOMMENDED', message: 'Provider package should include a source URI before worker execution.' })
  }
  if (hasSourceUri && !isSupportedRealScheme) {
    issues.push({ severity: isSmokeOnly ? 'warning' : 'error', code: 'SOURCE_URI_SCHEME_NOT_EXECUTABLE', message: `Source URI scheme "${sourceScheme || 'none'}" is not executable by production workers.` })
  }
  if (isSmokeOnly) {
    issues.push({ severity: 'warning', code: 'SMOKE_SOURCE_NOT_QUEUEABLE', message: 'Smoke or memory sources can be registered but must not be queued for worker execution.' })
  }
  const hasBlockingIssue = issues.some((issue) => issue.severity === 'error')
  const canQueue = !hasBlockingIssue && !isSmokeOnly && (isSupportedRealScheme || hasRawOsmSchema || isViewerRefresh || isOpenConnectorAction || isPackageMetadataOnly)
  const sourceState = canQueue ? 'queueable' : hasSourceUri || isOpenConnectorAction || isPackageMetadataOnly ? 'register-only' : 'source-required'
  return {
    sourceState,
    sourceScheme: sourceScheme || null,
    canQueue,
    issues,
  }
}

function normalizePhase14ProviderPackage(entry, index) {
  const layerKey = String(entry?.layerKey ?? entry?.layer_key ?? entry?.key ?? `provider-package-${index + 1}`).trim()
  const action = phase14ProviderAction(entry)
  const sourceFormat = String(entry?.sourceFormat ?? entry?.source_format ?? action).trim() || action
  const sourceUri = String(entry?.sourceUri ?? entry?.source_uri ?? '').trim() || null
  const providerPackage = {
    layerKey,
    action,
    sourceFormat,
    posture: String(entry?.posture ?? entry?.sourcePosture ?? entry?.source_posture ?? 'receive-only').trim() || 'receive-only',
    sourceUri,
    sourceVersion: String(entry?.sourceVersion ?? entry?.source_version ?? entry?.version ?? '').trim() || null,
    release: String(entry?.release ?? entry?.overtureRelease ?? entry?.overture_release ?? entry?.sourceVersion ?? entry?.source_version ?? '').trim() || null,
    providerKey: String(entry?.providerKey ?? entry?.provider_key ?? '').trim() || null,
    connectorKey: String(entry?.connectorKey ?? entry?.connector_key ?? '').trim() || null,
    metadata: entry?.metadata ?? {},
    queueForExecution: entry?.queueForExecution === true || entry?.queue_for_execution === true,
  }
  const validation = phase14SourceValidation(providerPackage)
  return {
    ...providerPackage,
    sourceValidation: validation,
    jobStatus: validation.canQueue ? 'ready-for-provider-ingestion-job' : validation.sourceState,
  }
}

function phase14ProviderJobIdempotencyKey(run, providerPackage) {
  return createHash('sha256')
    .update(stableJson({
      workflowRunId: run.id,
      cityId: run.cityId,
      layerKey: providerPackage.layerKey,
      action: providerPackage.action,
      sourceFormat: providerPackage.sourceFormat,
      sourceUri: providerPackage.sourceUri,
      sourceVersion: providerPackage.sourceVersion,
    }))
    .digest('hex')
}

function phase14ArtifactUri(runId, artifactKind) {
  return `ldt://workflow-runs/${runId}/${artifactKind}.json`
}

function workflowApprovalTemplates(workflowKey) {
  const templates = {
    'open-data-city-bootstrap': [
      {
        approvalKey: 'run-open-data-refresh',
        policy: {
          requiredBeforeExecution: true,
          reason: 'Open data refresh can update catalog, provenance, inventory, and viewer aggregates.',
        },
      },
      {
        approvalKey: 'accept-source-quality-report',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'A city analyst must review coverage gaps before authority or production claims.',
        },
      },
    ],
    'phase14-open-data-workflow-runner': [
      {
        approvalKey: 'approve-open-data-workflow-run',
        policy: {
          requiredBeforeExecution: true,
          reason: 'Phase 14 workflow runs can enqueue data jobs, create artifacts, and refresh source-backed evidence.',
        },
      },
      {
        approvalKey: 'accept-provider-exchange-classification',
        policy: {
          requiredBeforeProviderAttachment: true,
          reason: 'Provider packages must be classified as receive-only, open-data-native, or hybrid before attachment.',
        },
      },
      {
        approvalKey: 'accept-extractor-validation-summary',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Extractor outputs must keep source and validation state visible before product claims.',
        },
      },
    ],
    'private-provider-validation': [
      {
        approvalKey: 'accept-private-data-for-validation',
        policy: {
          requiredBeforeExecution: true,
          reason: 'Private/provider data must be explicitly accepted before validation.',
        },
      },
      {
        approvalKey: 'publish-provider-evidence',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Provider evidence cannot enrich the public twin without approval.',
        },
      },
    ],
    'standards-publication-refresh': [
      {
        approvalKey: 'run-standards-refresh',
        policy: {
          requiredBeforeExecution: true,
          reason: 'Standards exports are public-facing API contracts.',
        },
      },
      {
        approvalKey: 'accept-versioned-publication',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Versioned publication must be approved before external use.',
        },
      },
    ],
  }
  return templates[workflowKey] ?? [
    {
      approvalKey: 'operator-approval',
      policy: {
        requiredBeforeExecution: true,
        reason: 'Unknown workflow requires explicit operator approval.',
      },
    },
  ]
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

  const steps = await client.query(
    `
      SELECT *
      FROM ldt_ops.workflow_steps
      WHERE run_id = $1
      ORDER BY step_order, step_key
    `,
    [runId],
  )
  const approvals = await client.query(
    `
      SELECT *
      FROM ldt_ops.workflow_approvals
      WHERE run_id = $1
      ORDER BY created_at, approval_key
    `,
    [runId],
  )
  const artifacts = await client.query(
    `
      SELECT *
      FROM ldt_ops.workflow_artifacts
      WHERE run_id = $1
      ORDER BY created_at DESC
    `,
    [runId],
  )

  return {
    ...normalizeWorkflowRun(runResult.rows[0]),
    steps: steps.rows.map(normalizeWorkflowStep),
    approvals: approvals.rows.map(normalizeWorkflowApproval),
    artifacts: artifacts.rows.map(normalizeWorkflowArtifact),
  }
}

async function updateWorkflowRunStatus(client, runId, status, output = {}, error = {}) {
  const result = await client.query(
    `
      UPDATE ldt_ops.workflow_runs
      SET
        status = $2,
        output = COALESCE(output, '{}'::jsonb) || $3::jsonb,
        error = $4::jsonb,
        started_at = CASE
          WHEN $2 IN ('running', 'succeeded', 'failed') THEN COALESCE(started_at, now())
          ELSE started_at
        END,
        finished_at = CASE
          WHEN $2 IN ('succeeded', 'failed') THEN now()
          ELSE finished_at
        END,
        updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [runId, status, JSON.stringify(output ?? {}), JSON.stringify(error ?? {})],
  )
  if (result.rowCount === 0) throw new Error('WORKFLOW_RUN_NOT_FOUND')
  return result.rows[0]
}

async function updateWorkflowStepStatus(client, runId, stepKey, status, output = {}, error = {}) {
  const result = await client.query(
    `
      UPDATE ldt_ops.workflow_steps
      SET
        status = $3,
        output = COALESCE(output, '{}'::jsonb) || $4::jsonb,
        error = $5::jsonb,
        started_at = CASE
          WHEN $3 IN ('running', 'succeeded', 'failed') THEN COALESCE(started_at, now())
          ELSE started_at
        END,
        finished_at = CASE
          WHEN $3 IN ('succeeded', 'failed') THEN now()
          ELSE finished_at
        END,
        updated_at = now()
      WHERE run_id = $1
        AND step_key = $2
      RETURNING *
    `,
    [runId, stepKey, status, JSON.stringify(output ?? {}), JSON.stringify(error ?? {})],
  )
  if (result.rowCount === 0) throw new Error(`WORKFLOW_STEP_NOT_FOUND:${stepKey}`)
  return result.rows[0]
}

async function recordWorkflowArtifact(client, {
  runId,
  stepId,
  cityId,
  artifactKind,
  artifactUri,
  mediaType = 'application/json',
  metadata = {},
}) {
  const existing = await client.query(
    `
      SELECT *
      FROM ldt_ops.workflow_artifacts
      WHERE run_id = $1
        AND artifact_uri = $2
      LIMIT 1
    `,
    [runId, artifactUri],
  )
  if (existing.rowCount > 0) return existing.rows[0]

  const result = await client.query(
    `
      INSERT INTO ldt_ops.workflow_artifacts (
        run_id,
        step_id,
        city_id,
        artifact_kind,
        artifact_uri,
        media_type,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *
    `,
    [runId, stepId, cityId, artifactKind, artifactUri, mediaType, JSON.stringify(metadata ?? {})],
  )
  return result.rows[0]
}

async function enqueuePhase14ProviderIngestionJob(client, { run, providerPackage, workerId }) {
  if (!providerPackage.layerKey) {
    return {
      ok: false,
      layerKey: providerPackage.layerKey,
      status: 'layer-key-required',
      error: 'LAYER_KEY_REQUIRED',
    }
  }

  const layerResult = await client.query(
    `
      SELECT
        ld.id,
        ld.key,
        ld.name,
        ld.provider_id,
        pc.id AS connector_id
      FROM public.layer_definitions ld
      LEFT JOIN public.provider_connectors pc
        ON pc.provider_id = ld.provider_id
        AND pc.connector_key = $3
      WHERE ld.city_id = $1
        AND ld.key = $2
      LIMIT 1
    `,
    [run.cityId, providerPackage.layerKey, providerPackage.connectorKey],
  )
  if (layerResult.rowCount === 0) {
    return {
      ok: false,
      layerKey: providerPackage.layerKey,
      status: 'layer-not-registered',
      error: 'LAYER_NOT_REGISTERED',
    }
  }

  const layer = layerResult.rows[0]
  const idempotencyKey = phase14ProviderJobIdempotencyKey(run, providerPackage)
  const validationReport = providerPackage.sourceValidation?.issues ?? []
  const shouldQueue = providerPackage.queueForExecution && providerPackage.sourceValidation?.canQueue === true
  const jobStatus = shouldQueue ? 'queued' : 'registered'
  const jobMode = shouldQueue ? 'queued' : 'registered'
  const jobResult = await client.query(
    `
      INSERT INTO public.layer_ingestion_jobs (
        city_id,
        provider_id,
        layer_id,
        connector_id,
        job_kind,
        requested_action,
        ingestion_mode,
        source_format,
        source_uri,
        status,
        submitted_by,
        validation_summary,
        stats,
        metadata,
        idempotency_key,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4,
        'provider-layer-ingestion',
        $5,
        $12,
        $6,
        $7,
        $13,
        $8,
        $9::jsonb,
        '{}'::jsonb,
        $10::jsonb,
        $11,
        now()
      )
      ON CONFLICT (city_id, layer_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
      DO UPDATE SET
        requested_action = EXCLUDED.requested_action,
        ingestion_mode = EXCLUDED.ingestion_mode,
        source_format = EXCLUDED.source_format,
        source_uri = EXCLUDED.source_uri,
        status = EXCLUDED.status,
        submitted_by = EXCLUDED.submitted_by,
        validation_summary = EXCLUDED.validation_summary,
        metadata = EXCLUDED.metadata,
        updated_at = now()
      RETURNING id, status, requested_action, source_format, source_uri, idempotency_key
    `,
    [
      run.cityId,
      providerPackage.providerKey || layer.provider_id,
      layer.id,
      layer.connector_id,
      providerPackage.action,
      providerPackage.sourceFormat,
      providerPackage.sourceUri,
      workerId,
      JSON.stringify({
        state: jobStatus,
        phase: '14',
        sourceState: providerPackage.sourceValidation?.sourceState ?? 'unknown',
        canQueue: providerPackage.sourceValidation?.canQueue === true,
        queueRequested: providerPackage.queueForExecution === true,
        action: providerPackage.action,
        sourceFormat: providerPackage.sourceFormat,
        reportCount: validationReport.length,
      }),
      JSON.stringify({
        ...(providerPackage.metadata ?? {}),
        workflowRunId: run.id,
        workflowKey: run.workflowKey,
        layerKey: providerPackage.layerKey,
        request: providerPackage,
        sourceValidation: providerPackage.sourceValidation ?? {},
      }),
      idempotencyKey,
      jobMode,
      jobStatus,
    ],
  )

  const job = jobResult.rows[0]
  return {
    ok: true,
    layerKey: providerPackage.layerKey,
    layerName: layer.name,
    providerId: providerPackage.providerKey || layer.provider_id,
    jobId: job.id,
    status: job.status,
    action: job.requested_action,
    sourceFormat: job.source_format,
    sourceUri: job.source_uri,
    idempotencyKey: job.idempotency_key,
    sourceValidation: providerPackage.sourceValidation ?? {},
    validationReport,
  }
}

async function registerPhase14ExtractorRun(client, {
  run,
  extractorKey,
  workerId,
  scenarioKey = 'baseline',
}) {
  const definition = await client.query(
    `
      SELECT *
      FROM ldt_environment.extractor_definitions
      WHERE extractor_key = $1
        AND enabled = true
      LIMIT 1
    `,
    [extractorKey],
  )
  if (definition.rowCount === 0) {
    return {
      extractorKey,
      ok: false,
      status: 'definition-missing',
      error: 'EXTRACTOR_DEFINITION_NOT_FOUND',
    }
  }

  const definitionRow = definition.rows[0]
  const runKey = `phase14-${run.id.slice(0, 8)}-${extractorKey}`
  const result = await client.query(
    `
      INSERT INTO ldt_environment.extractor_runs (
        extractor_id,
        extractor_key,
        city_id,
        workflow_run_id,
        run_key,
        scenario_key,
        status,
        source_status,
        requested_by,
        requested_by_kind,
        trigger_kind,
        input_summary,
        output_summary,
        validation_report
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        'registered',
        'source-required',
        $7,
        'workflow-worker',
        'workflow-run',
        $8::jsonb,
        $9::jsonb,
        $10::jsonb
      )
      ON CONFLICT (city_id, extractor_key, scenario_key, run_key)
      DO UPDATE SET
        workflow_run_id = EXCLUDED.workflow_run_id,
        status = EXCLUDED.status,
        source_status = EXCLUDED.source_status,
        requested_by = EXCLUDED.requested_by,
        requested_by_kind = EXCLUDED.requested_by_kind,
        trigger_kind = EXCLUDED.trigger_kind,
        input_summary = EXCLUDED.input_summary,
        output_summary = EXCLUDED.output_summary,
        validation_report = EXCLUDED.validation_report,
        error = '{}'::jsonb,
        updated_at = now()
      RETURNING *
    `,
    [
      definitionRow.id,
      extractorKey,
      run.cityId,
      run.id,
      runKey,
      scenarioKey,
      workerId,
      JSON.stringify({
        workflowRunId: run.id,
        sourcePlan: run.input?.sourcePlan ?? null,
        validationMode: run.input?.validationMode ?? 'phase14-runner',
      }),
      JSON.stringify({
        state: 'registered',
        nextAction: 'execute-extractor-worker',
        outputLayerKeys: definitionRow.output_layer_keys ?? [],
      }),
      JSON.stringify({
        ok: true,
        validationState: 'registered-no-heavy-data',
        sourceStatus: 'source-required',
      }),
    ],
  )
  return {
    ok: true,
    ...normalizeExtractorRun(result.rows[0]),
  }
}

export async function listAgenticWorkflowDefinitions() {
  return withClient(async (client) => {
    const result = await client.query(`
      SELECT
        workflow_key,
        name,
        purpose,
        domain,
        lifecycle_status,
        default_mode,
        agent_policy,
        input_contract,
        output_contract,
        standards_mapping,
        updated_at
      FROM ldt_ops.workflow_definitions
      ORDER BY domain, workflow_key
    `)

    return {
      configured: true,
      ok: true,
      workflows: result.rows.map((row) => ({
        workflowKey: row.workflow_key,
        name: row.name,
        purpose: row.purpose,
        domain: row.domain,
        lifecycleStatus: row.lifecycle_status,
        defaultMode: row.default_mode,
        agentPolicy: row.agent_policy,
        inputContract: row.input_contract,
        outputContract: row.output_contract,
        standardsMapping: row.standards_mapping,
        updatedAt: row.updated_at,
      })),
      error: null,
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    workflows: [],
    error: String(error?.message ?? 'WORKFLOW_DEFINITIONS_UNAVAILABLE'),
  }))
}

export async function executePhase14WorkflowRunOnce({ runId, workerId = 'phase14-workflow-runner' } = {}) {
  if (!runId) {
    return {
      configured: true,
      ok: false,
      run: null,
      extractorRuns: [],
      artifacts: [],
      error: 'WORKFLOW_RUN_ID_REQUIRED',
    }
  }

  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const initialRun = await workflowRunDetail(client, runId)
      if (!initialRun) throw new Error('WORKFLOW_RUN_NOT_FOUND')
      if (initialRun.workflowKey !== 'phase14-open-data-workflow-runner') {
        throw new Error('PHASE14_WORKFLOW_RUN_REQUIRED')
      }
      if (!['queued', 'running'].includes(initialRun.status)) {
        throw new Error(`WORKFLOW_RUN_NOT_EXECUTABLE:${initialRun.status}`)
      }

      await updateWorkflowRunStatus(client, runId, 'running', {
        executor: workerId,
        phase: '14',
      })

      const run = await workflowRunDetail(client, runId)
      const stepByKey = new Map(run.steps.map((step) => [step.stepKey, step]))
      const providerPackages = Array.isArray(run.input?.providerPackages)
        ? run.input.providerPackages.map(normalizePhase14ProviderPackage)
        : []
      const refreshPlan = {
        consolidation: run.input?.refreshConsolidation === true,
        viewerAggregates: run.input?.refreshViewerAggregates === true,
        twinQuerySurfaces: run.input?.refreshTwinQuerySurfaces === true,
        executionState: 'scheduled-after-worker-success',
      }
      const workerCapability = await inspectProviderIngestionCapabilities()
      const extractorKeys = Array.isArray(run.input?.extractorKeys) && run.input.extractorKeys.length > 0
        ? run.input.extractorKeys.map((key) => String(key).trim()).filter(Boolean)
        : ['terrain-dem', 'weather-field', 'hydrology-grid']
      const isSmokeRun = run.input?.smoke === true || String(run.input?.validationMode ?? '').includes('smoke')
      const refreshLayerKey = providerPackages.find((entry) => entry.layerKey)?.layerKey || 'buildings'
      if (refreshPlan.viewerAggregates || refreshPlan.twinQuerySurfaces) {
        providerPackages.push(normalizePhase14ProviderPackage({
          layerKey: refreshLayerKey,
          action: 'mvt-cache-refresh',
          sourceFormat: 'viewer-cache-refresh',
          posture: 'open-data-native',
          queueForExecution: !isSmokeRun,
          metadata: {
            generatedBy: 'phase14-open-data-workflow-runner',
            refreshPlan,
            gridKey: 'city-density-2km',
            cellSizeM: 2000,
          },
        }, providerPackages.length))
      }

      await updateWorkflowStepStatus(client, runId, 'prepare-run-context', 'succeeded', {
        cityId: run.cityId,
        workflowKey: run.workflowKey,
        workerId,
      })
      await updateWorkflowStepStatus(client, runId, 'validate-input-contract', 'succeeded', {
        sourcePlanPresent: Boolean(run.input?.sourcePlan),
        providerPackageCount: providerPackages.length,
        extractorKeyCount: extractorKeys.length,
        refreshPlan,
        workerCapability,
      })
      await updateWorkflowStepStatus(client, runId, 'resolve-source-plan', 'succeeded', {
        sourcePlan: run.input?.sourcePlan ?? null,
      })

      const providerJobs = []
      for (const providerPackage of providerPackages) {
        providerJobs.push(await enqueuePhase14ProviderIngestionJob(client, {
          run,
          providerPackage,
          workerId,
        }))
      }
      const bootstrapStep = await updateWorkflowStepStatus(client, runId, 'enqueue-open-data-bootstrap', 'succeeded', {
        providerPackageCount: providerPackages.length,
        providerJobCount: providerJobs.filter((entry) => entry.ok).length,
        queuedProviderJobCount: providerJobs.filter((entry) => entry.status === 'queued').length,
        packages: providerPackages,
        providerJobs,
      })
      await updateWorkflowStepStatus(client, runId, 'validate-provider-exchange-package', 'succeeded', {
        packages: providerPackages,
        providerJobs,
        acceptedPostures: ['receive-only', 'open-data-native', 'hybrid'],
      })

      const extractorRuns = []
      for (const extractorKey of extractorKeys) {
        extractorRuns.push(await registerPhase14ExtractorRun(client, {
          run,
          extractorKey,
          workerId,
        }))
      }
      await updateWorkflowStepStatus(client, runId, 'register-environmental-extractor-runs', 'succeeded', {
        extractorRuns,
      })

      const artifactSpecs = [
        {
          artifactKind: 'source-plan',
          stepKey: 'resolve-source-plan',
          metadata: { sourcePlan: run.input?.sourcePlan ?? null },
        },
        {
          artifactKind: 'provider-exchange-classification',
          stepKey: 'validate-provider-exchange-package',
          metadata: { packages: providerPackages, providerJobs },
        },
        {
          artifactKind: 'extractor-validation-summary',
          stepKey: 'register-environmental-extractor-runs',
          metadata: { extractorRuns },
        },
        {
          artifactKind: 'post-job-refresh-plan',
          stepKey: 'write-artifact-and-validation-records',
          metadata: { refreshPlan, workerCapability },
        },
        {
          artifactKind: 'operator-inspection-summary',
          stepKey: 'publish-workspace-run-summary',
          metadata: {
            sourceStates: providerPackages.map((entry) => ({ layerKey: entry.layerKey, sourceValidation: entry.sourceValidation })),
            providerJobs: providerJobs.map((entry) => ({ layerKey: entry.layerKey, status: entry.status, jobId: entry.jobId ?? null, sourceValidation: entry.sourceValidation ?? {} })),
            extractorRuns: extractorRuns.map((entry) => ({ extractorKey: entry.extractorKey, status: entry.status, sourceStatus: entry.sourceStatus })),
          },
        },
        {
          artifactKind: 'workspace-run-summary',
          stepKey: 'publish-workspace-run-summary',
          metadata: {
            cityId: run.cityId,
            workflowKey: run.workflowKey,
            providerPackageCount: providerPackages.length,
            extractorRunCount: extractorRuns.filter((entry) => entry.ok).length,
            refreshPlan,
            workerCapability,
          },
        },
      ]
      const artifacts = []
      for (const spec of artifactSpecs) {
        const step = stepByKey.get(spec.stepKey) ?? bootstrapStep
        artifacts.push(await recordWorkflowArtifact(client, {
          runId,
          stepId: step?.id ?? null,
          cityId: run.cityId,
          artifactKind: spec.artifactKind,
          artifactUri: phase14ArtifactUri(runId, spec.artifactKind),
          metadata: {
            phase: '14',
            workflowRunId: runId,
            ...spec.metadata,
          },
        }))
      }

      await updateWorkflowStepStatus(client, runId, 'write-artifact-and-validation-records', 'succeeded', {
        artifactCount: artifacts.length,
        artifactKinds: artifacts.map((artifact) => artifact.artifact_kind),
      })
      await updateWorkflowStepStatus(client, runId, 'publish-workspace-run-summary', 'succeeded', {
        status: 'succeeded',
        message: 'Open data import workflow registered source plan, provider classification, extractor runs, refresh plan, and inspection artifacts.',
        refreshPlan,
      })

      await updateWorkflowRunStatus(client, runId, 'succeeded', {
        phase: '14',
        executor: workerId,
        providerPackages,
        providerJobs,
        extractorRuns,
        refreshPlan,
        workerCapability,
        artifacts: artifacts.map(normalizeWorkflowArtifact),
      })

      await client.query('COMMIT')
      return {
        configured: true,
        ok: true,
        run: await workflowRunDetail(client, runId),
        extractorRuns,
        artifacts: artifacts.map(normalizeWorkflowArtifact),
        error: null,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      try {
        await updateWorkflowRunStatus(client, runId, 'failed', {}, {
          message: String(error?.message ?? 'PHASE14_WORKFLOW_EXECUTION_FAILED'),
        })
      } catch {}
      throw error
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    run: null,
    extractorRuns: [],
    artifacts: [],
    error: String(error?.message ?? 'PHASE14_WORKFLOW_EXECUTION_FAILED'),
  }))
}

export async function listWorkflowRuns({ cityId, workflowKey, status, limit = 25 } = {}) {
  return withClient(async (client) => {
    const filters = []
    const params = []
    if (cityId) {
      params.push(cityId)
      filters.push(`run.city_id = $${params.length}`)
    }
    if (workflowKey) {
      params.push(workflowKey)
      filters.push(`run.workflow_key = $${params.length}`)
    }
    if (status) {
      params.push(status)
      filters.push(`run.status = $${params.length}`)
    }
    const normalizedLimit = Math.max(1, Math.min(Number(limit) || 25, 100))
    params.push(normalizedLimit)
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
    const result = await client.query(
      `
        SELECT run.*, definition.name AS workflow_name
        FROM ldt_ops.workflow_runs run
        LEFT JOIN ldt_ops.workflow_definitions definition ON definition.id = run.workflow_id
        ${whereClause}
        ORDER BY run.created_at DESC
        LIMIT $${params.length}
      `,
      params,
    )
    return {
      configured: true,
      ok: true,
      runs: result.rows.map(normalizeWorkflowRun),
      error: null,
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    runs: [],
    error: String(error?.message ?? 'WORKFLOW_RUNS_UNAVAILABLE'),
  }))
}

export async function recordApiUsageEvent({
  requestId = null,
  routeFamily,
  method,
  pathTemplate,
  statusCode,
  latencyMs = null,
  cityId = null,
  actorUserId = null,
  actorRole = null,
  apiVersion = 'compat',
  consumerKey = null,
  errorCode = null,
  metadata = {},
} = {}) {
  return withClient(async (client) => {
    const normalizedRouteFamily = String(routeFamily ?? '').trim() || 'api'
    const normalizedMethod = String(method ?? '').trim().toUpperCase() || 'GET'
    const normalizedPathTemplate = String(pathTemplate ?? '').trim() || '/api'
    const normalizedStatusCode = Number(statusCode ?? 0)
    if (!Number.isFinite(normalizedStatusCode) || normalizedStatusCode <= 0) {
      throw new Error('STATUS_CODE_REQUIRED')
    }

    const result = await client.query(
      `
        INSERT INTO ldt_ops.api_usage_events (
          request_id,
          route_family,
          method,
          path_template,
          status_code,
          latency_ms,
          city_id,
          actor_user_id,
          actor_role,
          api_version,
          consumer_key,
          error_code,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
        RETURNING id, created_at
      `,
      [
        requestId,
        normalizedRouteFamily,
        normalizedMethod,
        normalizedPathTemplate,
        normalizedStatusCode,
        Number.isFinite(Number(latencyMs)) ? Math.max(0, Math.round(Number(latencyMs))) : null,
        cityId ? String(cityId) : null,
        actorUserId ? String(actorUserId) : null,
        actorRole ? String(actorRole) : null,
        String(apiVersion ?? 'compat') || 'compat',
        consumerKey ? String(consumerKey) : null,
        errorCode ? String(errorCode) : null,
        JSON.stringify(metadata ?? {}),
      ],
    )

    return {
      configured: true,
      ok: true,
      event: result.rows[0],
      error: null,
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    event: null,
    error: String(error?.message ?? 'API_USAGE_EVENT_RECORD_FAILED'),
  }))
}

export async function createWorkflowRun({
  workflowKey,
  cityId,
  input = {},
  requestedBy = null,
  requestedByKind = 'human',
  triggerKind = 'manual',
} = {}) {
  return withClient(async (client) => {
    const normalizedWorkflowKey = String(workflowKey ?? '').trim()
    const normalizedCityId = String(cityId ?? '').trim()
    if (!normalizedWorkflowKey) throw new Error('WORKFLOW_KEY_REQUIRED')
    if (!normalizedCityId) throw new Error('CITY_ID_REQUIRED')

    await client.query('BEGIN')
    try {
      const workflowResult = await client.query(
        `
          SELECT *
          FROM ldt_ops.workflow_definitions
          WHERE workflow_key = $1
        `,
        [normalizedWorkflowKey],
      )
      if (workflowResult.rowCount === 0) throw new Error('WORKFLOW_DEFINITION_NOT_FOUND')

      const cityResult = await client.query('SELECT id FROM ldt_core.cities WHERE id = $1', [normalizedCityId])
      if (cityResult.rowCount === 0) throw new Error('CITY_NOT_FOUND')

      const workflow = workflowResult.rows[0]
      const runResult = await client.query(
        `
          INSERT INTO ldt_ops.workflow_runs (
            workflow_id,
            workflow_key,
            city_id,
            requested_by,
            requested_by_kind,
            trigger_kind,
            status,
            input
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'approval_required', $7::jsonb)
          RETURNING *
        `,
        [
          workflow.id,
          workflow.workflow_key,
          normalizedCityId,
          requestedBy,
          requestedByKind,
          triggerKind,
          JSON.stringify({
            ...(input ?? {}),
            cityId: normalizedCityId,
            workflowKey: workflow.workflow_key,
          }),
        ],
      )
      const run = runResult.rows[0]

      for (const [index, step] of workflowStepTemplates(workflow.workflow_key).entries()) {
        await client.query(
          `
            INSERT INTO ldt_ops.workflow_steps (
              run_id,
              step_key,
              step_order,
              title,
              tool_kind,
              status
            )
            VALUES ($1, $2, $3, $4, $5, 'pending')
            ON CONFLICT (run_id, step_key) DO NOTHING
          `,
          [run.id, step.stepKey, index + 1, step.title, step.toolKind],
        )
      }

      for (const approval of workflowApprovalTemplates(workflow.workflow_key)) {
        await client.query(
          `
            INSERT INTO ldt_ops.workflow_approvals (
              run_id,
              approval_key,
              status,
              requested_by,
              policy
            )
            VALUES ($1, $2, 'requested', $3, $4::jsonb)
            ON CONFLICT (run_id, approval_key) DO NOTHING
          `,
          [run.id, approval.approvalKey, requestedBy, JSON.stringify(approval.policy ?? {})],
        )
      }

      await client.query('COMMIT')
      return {
        configured: true,
        ok: true,
        run: await workflowRunDetail(client, run.id),
        error: null,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    run: null,
    error: String(error?.message ?? 'WORKFLOW_RUN_CREATE_FAILED'),
  }))
}

export async function getWorkflowRun(runId) {
  return withClient(async (client) => {
    const run = await workflowRunDetail(client, runId)
    return {
      configured: true,
      ok: Boolean(run),
      run,
      error: run ? null : 'WORKFLOW_RUN_NOT_FOUND',
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    run: null,
    error: String(error?.message ?? 'WORKFLOW_RUN_UNAVAILABLE'),
  }))
}

export async function decideWorkflowApproval({
  runId,
  approvalKey,
  decision,
  decidedBy = null,
  reason = '',
} = {}) {
  return withClient(async (client) => {
    const normalizedDecision = String(decision ?? '').trim().toLowerCase()
    if (!['approved', 'rejected'].includes(normalizedDecision)) throw new Error('APPROVAL_DECISION_INVALID')
    if (!runId) throw new Error('WORKFLOW_RUN_ID_REQUIRED')
    if (!approvalKey) throw new Error('APPROVAL_KEY_REQUIRED')

    await client.query('BEGIN')
    try {
      const approvalResult = await client.query(
        `
          UPDATE ldt_ops.workflow_approvals
          SET
            status = $1,
            decided_by = $2,
            decided_at = now(),
            decision_reason = $3,
            updated_at = now()
          WHERE run_id = $4
            AND approval_key = $5
          RETURNING *
        `,
        [normalizedDecision, decidedBy, reason, runId, approvalKey],
      )
      if (approvalResult.rowCount === 0) throw new Error('WORKFLOW_APPROVAL_NOT_FOUND')

      const approvalCounts = await client.query(
        `
          SELECT
            count(*) FILTER (WHERE status = 'requested')::int AS requested,
            count(*) FILTER (WHERE status = 'approved')::int AS approved,
            count(*) FILTER (WHERE status = 'rejected')::int AS rejected
          FROM ldt_ops.workflow_approvals
          WHERE run_id = $1
        `,
        [runId],
      )
      const counts = approvalCounts.rows[0]
      const nextStatus =
        Number(counts.rejected) > 0
          ? 'rejected'
          : Number(counts.requested) === 0
            ? 'queued'
            : 'approval_required'

      await client.query(
        `
          UPDATE ldt_ops.workflow_runs
          SET status = $1, updated_at = now()
          WHERE id = $2
        `,
        [nextStatus, runId],
      )

      await client.query('COMMIT')
      return {
        configured: true,
        ok: true,
        approval: normalizeWorkflowApproval(approvalResult.rows[0]),
        run: await workflowRunDetail(client, runId),
        error: null,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    approval: null,
    run: null,
    error: String(error?.message ?? 'WORKFLOW_APPROVAL_DECISION_FAILED'),
  }))
}

export {
  normalizeWorkflowRun,
}
