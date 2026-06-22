import {
  executeCitySemanticQuery,
  getCitySemanticQueryContract,
} from '../../services/liveFeature/semanticQueryUseCaseService.mjs'
import { requireLiveAccess } from '../liveRouteHelpers.mjs'
import { semanticQueryPayload } from './semanticQueryHttpAdapter.mjs'

function mapSurfaceMode(request) {
  return String(request.query.mode || 'cockpit')
}

function viewerSurface(request) {
  return String(request.query.surface || request.query.viewer || 'map')
}

async function sendSemanticQueryContract(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const contract = await getCitySemanticQueryContract(access.cityId, {
      surface: viewerSurface(request),
      mode: mapSurfaceMode(request),
    })
    response.status(contract.ok ? 200 : 502).json(contract)
  } catch (error) {
    response.status(502).json({
      error: 'LIVE_SEMANTIC_QUERY_CONTRACT_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendSemanticQuery(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const result = await executeCitySemanticQuery(access.cityId, semanticQueryPayload(request, access))
    response.status(result.ok ? 200 : 422).json(result)
  } catch (error) {
    response.status(422).json({
      error: 'LIVE_SEMANTIC_QUERY_FAILED',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

export function registerSemanticQueryRoutes(app, { requireLiveCityAccess }) {
  app.get('/api/live/current/semantic-query-contract', (request, response) => sendSemanticQueryContract(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/semantic-query-contract', (request, response) => sendSemanticQueryContract(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/semantic-query', (request, response) => sendSemanticQuery(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/semantic-query', (request, response) => sendSemanticQuery(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.post('/api/live/current/semantic-query', (request, response) => sendSemanticQuery(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.post('/api/live/:cityId/semantic-query', (request, response) => sendSemanticQuery(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))
}
