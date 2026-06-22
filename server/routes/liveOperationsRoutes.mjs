import {
  getCityCapabilityState,
  getCityMetricsSummary,
  getCityOperationsReport,
} from '../services/ldtOpsService.mjs'
import { requireLiveAccess } from './liveRouteHelpers.mjs'

async function sendCityOperationResponse(request, response, {
  requireLiveCityAccess,
  requestedCityId,
  load,
  error,
}) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const result = await load(access.cityId)
    response.status(result.ok ? 200 : 502).json(result)
  } catch (caughtError) {
    response.status(502).json({
      error,
      detail: String(caughtError?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

export function registerLiveOperationsRoutes(app, { requireLiveCityAccess }) {
  app.get('/api/live/current/capabilities', (request, response) => sendCityOperationResponse(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
    load: getCityCapabilityState,
    error: 'CITY_CAPABILITIES_UNAVAILABLE',
  }))

  app.get('/api/live/:cityId/capabilities', (request, response) => sendCityOperationResponse(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
    load: getCityCapabilityState,
    error: 'CITY_CAPABILITIES_UNAVAILABLE',
  }))

  app.get('/api/live/current/operations/report', (request, response) => sendCityOperationResponse(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
    load: getCityOperationsReport,
    error: 'CITY_OPERATIONS_REPORT_UNAVAILABLE',
  }))

  app.get('/api/live/:cityId/operations/report', (request, response) => sendCityOperationResponse(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
    load: getCityOperationsReport,
    error: 'CITY_OPERATIONS_REPORT_UNAVAILABLE',
  }))

  app.get('/api/live/current/operations/metrics-summary', (request, response) => sendCityOperationResponse(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
    load: getCityMetricsSummary,
    error: 'CITY_METRICS_SUMMARY_UNAVAILABLE',
  }))

  app.get('/api/live/:cityId/operations/metrics-summary', (request, response) => sendCityOperationResponse(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
    load: getCityMetricsSummary,
    error: 'CITY_METRICS_SUMMARY_UNAVAILABLE',
  }))
}
