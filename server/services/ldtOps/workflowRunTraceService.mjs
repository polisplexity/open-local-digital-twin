import { getWorkflowRun } from './workflowService.mjs'
import { withClient } from './dbUtils.mjs'
import { workflowManifestFor, workflowStatusSemantics } from './workflowContractsService.mjs'

const TRACE_SCHEMA_VERSION = '2026-07-06.workflow-run-trace.v1'

function normalizeJob(row = {}) {
  return {
    id: row.id,
    cityId: row.city_id,
    providerId: row.provider_id,
    layerId: row.layer_id,
    layerName: row.layer_name == null ? null : row.layer_name,
    layerKey: row.layer_key || (row.metadata && row.metadata.layerKey) || null,
    requestedAction: row.requested_action,
    ingestionMode: row.ingestion_mode,
    sourceFormat: row.source_format,
    sourceUri: row.source_uri,
    status: row.status,
    submittedBy: row.submitted_by,
    validationSummary: row.validation_summary || {},
    stats: row.stats || {},
    metadata: row.metadata || {},
    idempotencyKey: row.idempotency_key,
    attemptCount: Number(row.attempt_count == null ? 0 : row.attempt_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}

function normalizeExtractorRun(row = {}) {
  return {
    id: row.id,
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
    inputSummary: row.input_summary || {},
    outputSummary: row.output_summary || {},
    validationReport: row.validation_report || {},
    error: row.error || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function runIngestionJobs(runId) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT job.*, layer.key AS layer_key, layer.name AS layer_name
         FROM public.layer_ingestion_jobs job
         LEFT JOIN public.layer_definitions layer ON layer.id = job.layer_id
        WHERE job.metadata->>'workflowRunId' = $1
           OR job.metadata->'offlineDataFactory'->>'runId' = $1
        ORDER BY job.created_at ASC`,
      [runId],
    )
    return result.rows.map(normalizeJob)
  })
}

async function runExtractorRuns(runId) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT *
         FROM ldt_environment.extractor_runs
        WHERE workflow_run_id = $1
        ORDER BY created_at ASC`,
      [runId],
    )
    return result.rows.map(normalizeExtractorRun)
  })
}

function countByStatus(rows = []) {
  return rows.reduce((counts, row) => {
    const key = String(row.status == null ? 'unknown' : row.status)
    counts[key] = (counts[key] || 0) + 1
    return counts
  }, {})
}

function jobExecutionStatus(jobs = []) {
  if (!jobs.length) return 'not_applicable'
  const statuses = new Set(jobs.map((job) => String(job.status == null ? 'unknown' : job.status)))
  if ([...statuses].every((status) => status === 'completed' || status === 'succeeded')) return 'executed'
  if (statuses.has('failed')) return statuses.size === 1 ? 'failed' : 'partial'
  if (statuses.has('running')) return 'running'
  if (statuses.has('queued')) return 'queued'
  if (statuses.has('registered')) return 'registered_only'
  return 'unknown'
}

function dataFactoryExecutionStatus(run) {
  const output = run.output || {}
  const input = run.input || {}
  const promotion = output.promotion || input.promotion || null
  const externalRunStatus = (output.externalRun && output.externalRun.status) || (output.resultSummary && output.resultSummary.runner && output.resultSummary.runner.status) || null
  if (externalRunStatus) return externalRunStatus
  if (promotion) return String(run.status == null ? 'unknown' : run.status) === 'succeeded' ? 'executed' : String(run.status == null ? 'unknown' : run.status)
  return String(run.status == null ? 'unknown' : run.status)
}

function promotionStatus(run, jobs = []) {
  const output = run.output || {}
  const promotion = output.promotion || {}
  const direct = (promotion.postgis && promotion.postgis.status) || (promotion.viewerArtifacts && promotion.viewerArtifacts.status)
  if (direct) return direct
  if (run.workflowKey === 'phase14-open-data-workflow-runner') {
    if (!jobs.length) return 'not_promoted'
    if (jobExecutionStatus(jobs) === 'executed') return 'post_ingestion_bridge_expected'
    return 'not_promoted'
  }
  if (run.workflowKey === 'standards-publication-refresh') return 'not_applicable'
  if (run.workflowKey === 'external-model-enrichment-exchange') return run.status === 'succeeded' ? 'promoted_to_enrichment' : 'not_promoted'
  return 'unknown'
}

function publicationStatus(run) {
  if (run.workflowKey === 'standards-publication-refresh') {
    return run.status === 'succeeded' ? 'published' : 'queued_refresh'
  }
  if (run.status === 'succeeded') return 'refresh_required'
  return 'not_applicable'
}

function executionStatus(run, jobs = []) {
  if (run.workflowKey === 'offline-data-factory-handoff') return dataFactoryExecutionStatus(run)
  if (run.workflowKey === 'phase14-open-data-workflow-runner') return jobExecutionStatus(jobs)
  if (run.workflowKey === 'standards-publication-refresh') return run.status === 'succeeded' ? 'executed' : String(run.status == null ? 'unknown' : run.status)
  if (run.workflowKey === 'external-model-enrichment-exchange') return run.status === 'succeeded' ? 'executed' : String(run.status == null ? 'unknown' : run.status)
  return String(run.status == null ? 'unknown' : run.status)
}

function traceState(run, jobs = []) {
  const manifest = workflowManifestFor(run.workflowKey, { cityId: run.cityId })
  return {
    orchestrationStatus: run.status,
    executionStatus: executionStatus(run, jobs),
    promotionStatus: promotionStatus(run, jobs),
    publicationStatus: publicationStatus(run),
    authorityStatus: (manifest && manifest.statusDefaults && manifest.statusDefaults.authorityStatus) || (run.output && run.output.authorityStatus) || 'unknown',
  }
}

function traceNextActions(run, jobs = []) {
  const manifest = workflowManifestFor(run.workflowKey, { cityId: run.cityId })
  const base = manifest && manifest.nextWorkflowSuggestions ? manifest.nextWorkflowSuggestions : []
  const dynamic = []
  if (run.workflowKey === 'phase14-open-data-workflow-runner') {
    const jobStatus = jobExecutionStatus(jobs)
    if (['registered_only', 'queued', 'partial'].includes(jobStatus)) {
      dynamic.push({ key: 'provider-ingestion-worker', label: 'Execute provider ingestion jobs', reason: `Current job execution state is ${jobStatus}.` })
    }
    if (jobStatus === 'executed') {
      dynamic.push({ key: 'offline-data-factory-handoff:viewer-artifacts', label: 'Build or register viewer artifacts', reason: 'PostGIS data is ready for MVT, PMTiles, and 3D Tiles packaging.' })
    }
  }
  if (run.status === 'succeeded' && run.workflowKey !== 'standards-publication-refresh') {
    dynamic.push({ key: 'standards-publication-refresh', label: 'Refresh standards publication', reason: 'Successful data or model changes should be projected to DCAT, OGC, NGSI-LD, and readiness.' })
  }
  const merged = [...dynamic, ...base]
  const seen = new Set()
  return merged.filter((action) => {
    const key = action.key || action.label
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function tableWriteSummary(run, jobs = [], extractorRuns = []) {
  const writes = new Set()
  const manifest = workflowManifestFor(run.workflowKey, { cityId: run.cityId })
  const manifestWrites = manifest && manifest.writes ? manifest.writes : []
  for (const entry of manifestWrites) writes.add(entry)
  if (jobs.length) writes.add('public.layer_ingestion_jobs')
  if (extractorRuns.length) writes.add('ldt_environment.extractor_runs')
  const outputWrites = run.output && run.output.writes ? run.output.writes : []
  for (const entry of outputWrites) writes.add(entry)
  return [...writes]
}

export async function getWorkflowRunTrace(runId) {
  const normalizedRunId = String(runId == null ? '' : runId).trim()
  if (!normalizedRunId) return { ok: false, error: 'WORKFLOW_RUN_ID_REQUIRED' }
  const detail = await getWorkflowRun(normalizedRunId)
  if (!detail.ok || !detail.run) return detail
  const run = detail.run
  const [jobs, extractorRuns] = await Promise.all([
    runIngestionJobs(normalizedRunId).catch(() => []),
    runExtractorRuns(normalizedRunId).catch(() => []),
  ])
  const steps = run.steps || []
  const artifacts = run.artifacts || []
  const approvals = run.approvals || []
  const state = traceState(run, jobs)
  return {
    ok: true,
    schemaVersion: TRACE_SCHEMA_VERSION,
    run,
    manifest: workflowManifestFor(run.workflowKey, { cityId: run.cityId }),
    statusSemantics: workflowStatusSemantics(),
    trace: {
      state,
      sourcePlan: run.input && run.input.sourcePlan ? run.input.sourcePlan : null,
      decisions: run.input || {},
      steps: {
        count: steps.length,
        byStatus: countByStatus(steps),
        rows: steps,
      },
      jobs: {
        count: jobs.length,
        byStatus: countByStatus(jobs),
        executionStatus: jobExecutionStatus(jobs),
        rows: jobs,
      },
      extractorRuns: {
        count: extractorRuns.length,
        byStatus: countByStatus(extractorRuns),
        rows: extractorRuns,
      },
      artifacts: {
        count: artifacts.length,
        kinds: artifacts.map((artifact) => artifact.artifactKind),
        rows: artifacts,
      },
      approvals: {
        count: approvals.length,
        byStatus: countByStatus(approvals),
        rows: approvals,
      },
      writes: tableWriteSummary(run, jobs, extractorRuns),
      nextActions: traceNextActions(run, jobs),
    },
  }
}
