import { createHash } from 'node:crypto'
import {
  addLayerIngestionValidationReport,
  createQueuedLayerIngestionJob,
  failLayerIngestionJob,
  getLayerIngestionJob,
  listQueuedLayerIngestionJobs,
  listLayerIngestionValidationReport,
} from '../../db/productionTwinStore.mjs'
import { findCityConfig } from '../cityRegistry.mjs'
import { refreshLdtAfterProviderIngestion } from './ldtPostIngestionBridge.mjs'

const ASYNC_INGESTION_ACTIONS = new Set([
  'geojson',
  'csv',
  'ogc-features',
  'stac',
  'cityjson',
  'package',
  'overture-buildings',
  'overture-roads',
  'osm-local-extract',
  'mvt-cache-refresh',
])

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sourceFormatForAction(action, body = {}) {
  if (action === 'geojson') return 'geojson'
  if (action === 'csv') return 'csv'
  if (action === 'ogc-features') return 'ogc-api-features'
  if (action === 'stac') return 'stac'
  if (action === 'cityjson') return 'cityjson'
  if (action === 'overture-buildings') return 'overture-buildings'
  if (action === 'overture-roads') return 'overture-roads'
  if (action === 'osm-local-extract') return 'raw-osm-pbf'
  if (action === 'mvt-cache-refresh') return 'viewer-cache-refresh'
  if (action === 'package') return String(body.sourceFormat ?? body.source_format ?? 'package-metadata').trim()
  return 'unknown'
}

function normalizeIngestionAction(value) {
  const action = String(value ?? '').trim().toLowerCase()
  if (action === 'ogc') return 'ogc-features'
  if (action === 'register-package') return 'package'
  if (action === 'overture' || action === 'overture-building') return 'overture-buildings'
  if (action === 'overture-road' || action === 'overture-transportation' || action === 'overture-segment') return 'overture-roads'
  if (action === 'osm' || action === 'osm-local' || action === 'raw-osm-pbf') return 'osm-local-extract'
  if (action === 'mvt' || action === 'mvt-refresh' || action === 'viewer-cache-refresh') return 'mvt-cache-refresh'
  return action
}

function providerJobIdempotencyKey(cityId, layerKey, action, body = {}) {
  const explicit = String(body.idempotencyKey ?? body.idempotency_key ?? '').trim()
  if (explicit) return explicit
  const sourceUri = String(body.sourceUri ?? body.source_uri ?? '').trim()
  const sourceVersion = String(body.sourceVersion ?? body.source_version ?? body.version ?? '').trim()
  const inlineMarker = body.geojson || body.csvText || body.csv || body.stac || body.cityjson || body.cityJson || body.city_json || body.ifcText || body.ifc_text || body.ifc
    ? createHash('sha256').update(stableJson({
      geojson: body.geojson ?? null,
      csvText: body.csvText ?? body.csv_text ?? body.csv ?? null,
      stac: body.stac ?? null,
      cityjson: body.cityjson ?? body.cityJson ?? body.city_json ?? null,
      ifcText: body.ifcText ?? body.ifc_text ?? body.ifc ?? null,
    })).digest('hex').slice(0, 24)
    : ''
  return createHash('sha256')
    .update(stableJson({
      cityId,
      layerKey,
      action,
      sourceFormat: sourceFormatForAction(action, body),
      sourceUri,
      sourceVersion,
      inlineMarker,
    }))
    .digest('hex')
}

function cityConfigFromJob(job) {
  const city = findCityConfig(job.cityId)
  if (!city) {
    throw new Error('INGESTION_JOB_CITY_NOT_FOUND')
  }
  return city
}

export async function enqueueProviderLayerIngestionJob(cityConfig, layerKey, body = {}) {
  const action = normalizeIngestionAction(body.action ?? body.requestedAction ?? body.requested_action ?? body.mode)
  if (!ASYNC_INGESTION_ACTIONS.has(action)) {
    throw new Error('INGESTION_ACTION_UNSUPPORTED')
  }

  const sourceFormat = sourceFormatForAction(action, body)
  const sourceUri = String(body.sourceUri ?? body.source_uri ?? '').trim()
  const idempotencyKey = providerJobIdempotencyKey(cityConfig.id, layerKey, action, body)
  const validationReports = []
  if (!sourceUri && !body.geojson && !body.csvText && !body.csv_text && !body.csv && !body.stac && !body.cityjson && !body.cityJson && !body.city_json && !['package', 'overture-buildings', 'overture-roads', 'osm-local-extract', 'mvt-cache-refresh'].includes(action)) {
    validationReports.push({
      severity: 'warning',
      code: 'SOURCE_URI_OR_INLINE_PAYLOAD_RECOMMENDED',
      message: 'Production jobs should include a source URI or inline payload.',
    })
  }
  if (action === 'package' && !sourceUri && !Object.keys(body.metadata ?? {}).length) {
    validationReports.push({
      severity: 'error',
      code: 'PACKAGE_SOURCE_URI_OR_METADATA_REQUIRED',
      message: 'Package metadata jobs require a source URI or metadata.',
    })
  }

  const result = await createQueuedLayerIngestionJob(cityConfig, {
    ...body,
    layerKey,
    requestedAction: action,
    sourceFormat,
    sourceUri: sourceUri || null,
    idempotencyKey,
    validationSummary: {
      state: 'queued',
      action,
      sourceFormat,
      reportCount: validationReports.length,
      ...(body.validationSummary ?? body.validation_summary ?? {}),
    },
    metadata: {
      ...(body.metadata ?? {}),
      request: {
        ...body,
        action,
      },
    },
  })

  if (result.ok && validationReports.length) {
    await addLayerIngestionValidationReport(result.jobId, validationReports)
  }
  return {
    ...result,
    action,
    sourceFormat,
    idempotencyKey,
    validationReportCount: validationReports.length,
  }
}

export async function runProviderLayerIngestionJob(jobId, options = {}, handlers = {}) {
  const loaded = await getLayerIngestionJob(jobId)
  if (!loaded.ok) return loaded

  const job = loaded.job
  if (job.status === 'cancelled') {
    return {
      configured: true,
      ok: false,
      jobId,
      error: 'INGESTION_JOB_CANCELLED',
    }
  }
  if (!['queued', 'registered', 'running'].includes(job.status)) {
    return {
      configured: true,
      ok: false,
      jobId,
      status: job.status,
      error: 'INGESTION_JOB_NOT_RUNNABLE',
    }
  }
  if (job.status === 'registered') {
    const sourceUri = String(job.sourceUri ?? '')
    const sourceIsSmokeOnly = /^(memory|test):\/\//i.test(sourceUri)
    if (job.validationSummary?.canQueue !== true || sourceIsSmokeOnly) {
      return {
        configured: true,
        ok: false,
        jobId,
        status: job.status,
        error: 'INGESTION_JOB_REGISTERED_SAFE_QUEUE_GATE_REQUIRED',
      }
    }
  }
  if (!job.layer?.key) {
    throw new Error('INGESTION_JOB_LAYER_REQUIRED')
  }

  const request = job.metadata?.request ?? {}
  const action = normalizeIngestionAction(job.requestedAction ?? request.action ?? request.mode)
  const body = {
    ...request,
    existingJobId: job.id,
    workerId: options.workerId ?? options.worker_id ?? 'api-worker',
    submittedBy: request.submittedBy ?? request.submitted_by ?? options.submittedBy ?? options.submitted_by ?? job.submittedBy,
  }
  const cityConfig = cityConfigFromJob(job)

  try {
    let result
    if (action === 'geojson') {
      result = await handlers.geojson(cityConfig, job.layer.key, body)
    } else if (action === 'csv') {
      result = await handlers.csv(cityConfig, job.layer.key, body)
    } else if (action === 'ogc-features') {
      result = await handlers.ogcFeatures(cityConfig, job.layer.key, body)
    } else if (action === 'stac') {
      result = await handlers.stac(cityConfig, job.layer.key, body)
    } else if (action === 'cityjson') {
      result = await handlers.cityJson(cityConfig, job.layer.key, body)
    } else if (action === 'overture-buildings') {
      result = await handlers.overtureBuildings(cityConfig, job.layer.key, body)
    } else if (action === 'overture-roads') {
      result = await handlers.overtureRoads(cityConfig, job.layer.key, body)
    } else if (action === 'osm-local-extract') {
      result = await handlers.osmLocalExtract(cityConfig, job.layer.key, body)
    } else if (action === 'mvt-cache-refresh') {
      result = await handlers.mvtCacheRefresh(cityConfig, job.layer.key, body)
    } else if (action === 'package') {
      const packageFormat = String(body.sourceFormat ?? body.source_format ?? '').trim()
      if (['shapefile', 'geopackage'].includes(packageFormat)) {
        result = await handlers.nativeVectorPackage(cityConfig, job.layer.key, body)
      } else if (packageFormat === 'ifc') {
        result = await handlers.ifc(cityConfig, job.layer.key, body)
      } else {
        result = await handlers.inspectPackage(cityConfig, job.layer.key, body)
      }
    } else {
      throw new Error('INGESTION_ACTION_UNSUPPORTED')
    }
    const ldtBridge = await refreshLdtAfterProviderIngestion({
      cityId: cityConfig.id,
      action,
      body,
    })
    if (!ldtBridge.skipped) {
      await addLayerIngestionValidationReport(job.id, [{
        severity: 'info',
        code: 'LDT_POST_INGESTION_BRIDGE_REFRESHED',
        message: 'Provider features were reingested into LDT provenance, consolidated inventory, and viewer aggregates.',
        payload: {
          cityId: cityConfig.id,
          action,
          reingestFeatureCount: ldtBridge.reingest?.cities?.[0]?.sourceFeatureCount ?? null,
          entityCounts: ldtBridge.consolidate?.cities?.[0]?.entityCounts ?? null,
          viewerBuildingCount: ldtBridge.viewerAggregates?.cities?.[0]?.buildingCount ?? null,
          viewerRoadCount: ldtBridge.viewerAggregates?.cities?.[0]?.roadCount ?? null,
        },
      }])
    }
    return {
      ...result,
      ldtBridge,
      jobId: job.id,
      action,
    }
  } catch (error) {
    await failLayerIngestionJob(job.id, String(error?.message ?? 'INGESTION_JOB_FAILED'), {
      action,
    })
    await addLayerIngestionValidationReport(job.id, [{
      severity: 'error',
      code: String(error?.message ?? 'INGESTION_JOB_FAILED').split(':')[0],
      message: String(error?.message ?? 'INGESTION_JOB_FAILED'),
      payload: {
        action,
      },
    }])
    throw error
  }
}

export async function listProviderLayerIngestionJobReport(jobId, limit = 250) {
  return listLayerIngestionValidationReport(jobId, limit)
}

export async function runQueuedProviderLayerIngestionJobs(options = {}, handlers = {}) {
  const limit = Number(options.limit ?? process.env.TWIN_STUDIO_WORKER_BATCH_SIZE ?? 5)
  const queued = await listQueuedLayerIngestionJobs(limit)
  if (!queued.ok) return queued

  const results = []
  for (const job of queued.jobs) {
    try {
      const result = await runProviderLayerIngestionJob(job.id, {
        workerId: options.workerId ?? options.worker_id ?? process.env.TWIN_STUDIO_WORKER_ID ?? 'provider-worker',
      }, handlers)
      results.push({
        jobId: job.id,
        ok: result.ok,
        status: 'completed',
        action: result.action,
      })
    } catch (error) {
      results.push({
        jobId: job.id,
        ok: false,
        status: 'failed',
        error: String(error?.message ?? 'INGESTION_JOB_FAILED'),
      })
    }
  }

  return {
    configured: true,
    ok: true,
    scanned: queued.jobs.length,
    completed: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  }
}
