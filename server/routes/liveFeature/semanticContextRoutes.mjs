import { getEntitySemanticContext } from '../../db/productionTwinStore.mjs'
import { requireLiveAccess } from '../liveRouteHelpers.mjs'

function entityIdentifier(request) {
  return request.params.entityId
    || request.query.entityId
    || request.query.objectId
    || request.query.stableId
    || request.query.id
    || ''
}

async function sendSemanticContext(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const identifier = entityIdentifier(request)
    if (!identifier) {
      response.status(422).json({
        ok: false,
        cityId: access.cityId,
        error: 'ENTITY_IDENTIFIER_REQUIRED',
      })
      return
    }

    const result = await getEntitySemanticContext(access.cityId, identifier, {
      includeGeometry: request.query.includeGeometry,
      ruleCheckLimit: request.query.ruleCheckLimit ?? request.query.limit,
    })

    if (!result.ok && result.error === 'ENTITY_NOT_FOUND') {
      response.status(404).json(result)
      return
    }
    response.status(result.ok ? 200 : 502).json(result)
  } catch (error) {
    response.status(502).json({
      error: 'ENTITY_SEMANTIC_CONTEXT_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

export function registerSemanticContextRoutes(app, { requireLiveCityAccess }) {
  app.get('/api/live/current/entities/:entityId/semantic-context', (request, response) => sendSemanticContext(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/entities/:entityId/semantic-context', (request, response) => sendSemanticContext(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/semantic-context', (request, response) => sendSemanticContext(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/semantic-context', (request, response) => sendSemanticContext(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))
}
