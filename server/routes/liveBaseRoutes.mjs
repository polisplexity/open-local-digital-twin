import { getCityBasePayload } from '../services/baseTwinService.mjs'
import { requireLiveAccess } from './liveRouteHelpers.mjs'

async function sendBasePayload(request, response, {
  requireLiveCityAccess,
  requireAdminRefreshAccess,
  requestedCityId,
  payloadCityId,
}) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const forceRefresh = request.query.refresh === '1'
    if (!requireAdminRefreshAccess(request, response, forceRefresh)) return
    response.json(await getCityBasePayload({
      cityId: payloadCityId ?? access.cityId,
      forceRefresh,
    }))
  } catch (error) {
    response.status(502).json({
      error: 'LIVE_DATA_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

export function registerLiveBaseRoutes(app, { requireLiveCityAccess, requireAdminRefreshAccess }) {
  app.get('/api/live/current/base', (request, response) => sendBasePayload(request, response, {
    requireLiveCityAccess,
    requireAdminRefreshAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/base', (request, response) => sendBasePayload(request, response, {
    requireLiveCityAccess,
    requireAdminRefreshAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/adazi/base', (request, response) => sendBasePayload(request, response, {
    requireLiveCityAccess,
    requireAdminRefreshAccess,
    requestedCityId: 'adazi',
    payloadCityId: 'adazi',
  }))
}
