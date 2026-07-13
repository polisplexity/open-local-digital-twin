import { requireLiveAccess } from '../liveRouteHelpers.mjs'
import { getCityQueryLibrary } from '../../services/queryLibrary/queryLibraryService.mjs'

function queryOptions(request) {
  return {
    surface: request.query.surface,
    limit: request.query.limit,
  }
}

async function sendQueryLibrary(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const library = await getCityQueryLibrary(access.cityId, queryOptions(request))
    response.status(library.ok ? 200 : 502).json(library)
  } catch (error) {
    response.status(502).json({
      ok: false,
      error: 'LIVE_QUERY_LIBRARY_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

export function registerQueryLibraryRoutes(app, { requireLiveCityAccess }) {
  app.get('/api/live/current/query-library', (request, response) => sendQueryLibrary(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/query-library', (request, response) => sendQueryLibrary(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))
}
