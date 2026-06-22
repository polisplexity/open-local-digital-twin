import {
  getLdtDensityGrid,
  getLdtViewerSummary,
} from '../services/ldtViewerAggregateService.mjs'
import {
  getLdtEnvironmentalCells,
  getLdtEnvironmentalLayers,
  getLdtObjectEnvironmentalObservations,
} from '../services/ldtEnvironmentalService.mjs'
import {
  getLdtEnvironmentalExtractorRuns,
  getLdtEnvironmentalExtractors,
} from '../services/ldtEnvironmentalExtractorService.mjs'
import { getLdtUrbanScienceReport } from '../services/ldtScienceService.mjs'
import { getLdtSocietyReport } from '../services/ldtSocietyService.mjs'
import { getLdtSemanticPackReport } from '../services/ldtSemanticPackService.mjs'
import { requireLiveAccess } from './liveRouteHelpers.mjs'

async function sendAnalyticalReport(request, response, {
  requireLiveCityAccess,
  requestedCityId,
  load,
  error,
}) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    response.json(await load(access.cityId))
  } catch (caughtError) {
    response.status(404).json({
      error,
      detail: String(caughtError?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

export function registerLiveAnalyticsRoutes(app, { requireLiveCityAccess }) {
  app.get('/api/live/current/viewer-summary', (request, response) => sendAnalyticalReport(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
    load: getLdtViewerSummary,
    error: 'LDT_VIEWER_SUMMARY_UNAVAILABLE',
  }))

  app.get('/api/live/:cityId/viewer-summary', (request, response) => sendAnalyticalReport(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
    load: getLdtViewerSummary,
    error: 'LDT_VIEWER_SUMMARY_UNAVAILABLE',
  }))

  app.get('/api/live/current/density-grid', (request, response) => sendDensityGrid(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/density-grid', (request, response) => sendDensityGrid(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/environmental-layers', (request, response) => sendEnvironmentalLayers(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/environmental-layers', (request, response) => sendEnvironmentalLayers(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/environmental-cells', (request, response) => sendEnvironmentalCells(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/environmental-cells', (request, response) => sendEnvironmentalCells(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/environmental-observations', (request, response) => sendEnvironmentalObservations(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/environmental-observations', (request, response) => sendEnvironmentalObservations(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/environmental-extractors', (request, response) => sendEnvironmentalExtractors(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/environmental-extractors', (request, response) => sendEnvironmentalExtractors(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/environmental-extractor-runs', (request, response) => sendEnvironmentalExtractorRuns(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/environmental-extractor-runs', (request, response) => sendEnvironmentalExtractorRuns(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/science/urban-report', (request, response) => sendAnalyticalReport(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
    load: getLdtUrbanScienceReport,
    error: 'LDT_URBAN_SCIENCE_REPORT_UNAVAILABLE',
  }))

  app.get('/api/live/:cityId/science/urban-report', (request, response) => sendAnalyticalReport(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
    load: getLdtUrbanScienceReport,
    error: 'LDT_URBAN_SCIENCE_REPORT_UNAVAILABLE',
  }))

  app.get('/api/live/current/society/report', (request, response) => sendAnalyticalReport(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
    load: getLdtSocietyReport,
    error: 'LDT_SOCIETY_REPORT_UNAVAILABLE',
  }))

  app.get('/api/live/:cityId/society/report', (request, response) => sendAnalyticalReport(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
    load: getLdtSocietyReport,
    error: 'LDT_SOCIETY_REPORT_UNAVAILABLE',
  }))

  app.get('/api/live/current/semantic-packs/:packKey/report', (request, response) => sendSemanticPackReport(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/semantic-packs/:packKey/report', (request, response) => sendSemanticPackReport(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))
}

async function sendDensityGrid(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    response.setHeader('Content-Type', 'application/geo+json')
    response.json(await getLdtDensityGrid(access.cityId, {
      gridKey: request.query.gridKey,
      limit: request.query.limit,
    }))
  } catch (error) {
    response.status(404).json({
      error: 'LDT_DENSITY_GRID_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendEnvironmentalLayers(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    response.json(await getLdtEnvironmentalLayers(access.cityId))
  } catch (error) {
    response.status(404).json({
      error: 'LDT_ENVIRONMENTAL_LAYERS_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendEnvironmentalCells(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    response.setHeader('Content-Type', 'application/geo+json')
    response.json(await getLdtEnvironmentalCells(access.cityId, {
      layerKey: request.query.layerKey || request.query.mode,
      scenarioKey: request.query.scenarioKey,
      limit: request.query.limit,
      bbox: request.query.bbox,
      center: request.query.center,
      radiusMeters: request.query.radiusMeters || request.query.radius,
    }))
  } catch (error) {
    response.status(404).json({
      error: 'LDT_ENVIRONMENTAL_CELLS_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendEnvironmentalObservations(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    response.json(await getLdtObjectEnvironmentalObservations(access.cityId, {
      objectId: request.query.objectId || request.query.object_id,
      entityId: request.query.entityId || request.query.entity_id,
    }))
  } catch (error) {
    response.status(404).json({
      error: 'LDT_ENVIRONMENTAL_OBSERVATIONS_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendEnvironmentalExtractors(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    response.json(await getLdtEnvironmentalExtractors(access.cityId))
  } catch (error) {
    response.status(404).json({
      error: 'LDT_ENVIRONMENTAL_EXTRACTORS_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendEnvironmentalExtractorRuns(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    response.json(await getLdtEnvironmentalExtractorRuns(access.cityId, {
      extractorKey: request.query.extractorKey || request.query.extractor_key,
      scenarioKey: request.query.scenarioKey || request.query.scenario_key,
      limit: request.query.limit,
    }))
  } catch (error) {
    response.status(404).json({
      error: 'LDT_ENVIRONMENTAL_EXTRACTOR_RUNS_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendSemanticPackReport(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    response.json(await getLdtSemanticPackReport(access.cityId, request.params.packKey))
  } catch (error) {
    response.status(404).json({
      error: 'LDT_SEMANTIC_PACK_REPORT_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}
