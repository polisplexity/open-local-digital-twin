import {
  addLayerIngestionValidationReport,
  completeLayerIngestionJob,
  markLayerIngestionJobRunning,
} from '../../db/productionTwinStore.mjs'
import { refreshLdtViewerAggregates } from '../ldtViewerAggregateService.mjs'

function compact(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

export async function refreshMvtCacheLayer(cityConfig, layerKey, body = {}) {
  const existingJobId = compact(body.existingJobId ?? body.existing_job_id)
  if (!existingJobId) throw new Error('INGESTION_JOB_ID_REQUIRED_FOR_MVT_CACHE_REFRESH')

  const cityId = compact(cityConfig?.id, compact(body.cityId ?? body.city_id, 'kharkiv'))
  const workerId = compact(body.workerId ?? body.worker_id, 'provider-worker')
  const gridKey = compact(body.gridKey ?? body.grid_key ?? body.metadata?.gridKey, 'city-density-2km')
  const cellSizeM = body.cellSizeM ?? body.cell_size_m ?? body.metadata?.cellSizeM ?? 2000
  const version = `mvt-${cityId}-${Date.now()}`

  const running = await markLayerIngestionJobRunning(existingJobId, {
    workerId,
    stats: { action: 'mvt-cache-refresh', layerKey, gridKey, cellSizeM },
    metadata: { mvtCacheRefresh: { gridKey, cellSizeM, version } },
  })
  if (!running.ok) return running

  const aggregateResult = await refreshLdtViewerAggregates({
    cityIds: [cityId],
    gridKey,
    cellSizeM,
  })
  const cityResult = aggregateResult.cities?.find((entry) => entry.cityId === cityId) ?? null
  const stats = {
    action: 'mvt-cache-refresh',
    layerKey,
    cityId,
    gridKey,
    cellSizeM: Number(cellSizeM),
    version,
    densityGrid: cityResult?.densityGrid ?? null,
    refreshedCityCount: aggregateResult.cityCount ?? 0,
  }

  await completeLayerIngestionJob(existingJobId, {
    stats,
    validationSummary: {
      state: 'completed',
      action: 'mvt-cache-refresh',
      sourceFormat: 'viewer-cache-refresh',
      sourceState: 'executed',
      canQueue: true,
      version,
    },
    metadata: {
      mvtCacheRefresh: {
        version,
        refreshedAt: new Date().toISOString(),
        note: 'TwinQL/MVT tiles are SQL-backed; viewer aggregates and density grid cache were refreshed for the current city.',
      },
    },
  })
  await addLayerIngestionValidationReport(existingJobId, [{
    severity: 'info',
    code: 'MVT_VIEWER_CACHE_REFRESHED',
    message: `Viewer aggregates refreshed for ${cityId}; MVT version marker ${version}.`,
    payload: stats,
  }])

  return {
    configured: true,
    ok: true,
    cityId,
    layerKey,
    jobId: existingJobId,
    action: 'mvt-cache-refresh',
    stats,
  }
}
