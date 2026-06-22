import { requireLiveAccess } from '../liveRouteHelpers.mjs'
import {
  getCitySelectionSummaryForViewer,
  getCitySelectionUnitsForViewer,
} from '../../services/liveFeature/selectionUseCaseService.mjs'

function selectionQuery(request) {
  return {
    scope: request.query.scope,
    unitId: request.query.unitId ?? request.query.unit,
    cellId: request.query.cellId,
    gridKey: request.query.gridKey,
    limit: request.query.limit,
    center: request.query.center,
    radiusMeters: request.query.radiusMeters ?? request.query.radius,
    bbox: request.query.bbox,
  }
}

async function sendSelectionUnits(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const selectionUnits = await getCitySelectionUnitsForViewer(access.cityId, selectionQuery(request))
    response.status(selectionUnits.ok ? 200 : 502).json(selectionUnits)
  } catch (error) {
    response.status(502).json({
      error: 'LIVE_SELECTION_UNITS_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendSelectionSummary(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const summary = await getCitySelectionSummaryForViewer(access.cityId, selectionQuery(request))
    response.status(summary.ok ? 200 : 422).json(summary)
  } catch (error) {
    response.status(502).json({
      error: 'LIVE_SELECTION_SUMMARY_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

export function registerSelectionRoutes(app, { requireLiveCityAccess }) {
  app.get('/api/live/current/selection-units', (request, response) => sendSelectionUnits(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/selection-units', (request, response) => sendSelectionUnits(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/selection-summary', (request, response) => sendSelectionSummary(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/selection-summary', (request, response) => sendSelectionSummary(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))
}
