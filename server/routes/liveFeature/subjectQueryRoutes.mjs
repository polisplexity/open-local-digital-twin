import { requireLiveAccess } from '../liveRouteHelpers.mjs'
import {
  executeCitySubjectQuery,
  executeSubjectQueryBlueprint,
  getCitySubjectQueryContract,
  listCitySubjectQueryBlueprints,
  saveCitySubjectQueryBlueprint,
} from '../../services/subjectQuery/subjectQueryService.mjs'

function actorUserId(request, access = {}) {
  return access.userId
    ?? access.user?.id
    ?? request.user?.id
    ?? request.session?.user?.id
    ?? request.session?.userId
    ?? null
}

function errorStatus(error) {
  const message = String(error?.message ?? '')
  if (message === 'SUBJECT_QUERY_BLUEPRINT_NOT_FOUND') return 404
  if (message.includes('REQUIRED') || message.includes('INVALID') || message.includes('NOT_FOUND')) return 422
  return 502
}

async function withAccess(request, response, options, callback) {
  try {
    const access = requireLiveAccess(request, response, options.requireLiveCityAccess, options.requestedCityId)
    if (!access) return
    await callback(access)
  } catch (error) {
    response.status(errorStatus(error)).json({
      ok: false,
      error: 'SUBJECT_QUERY_REQUEST_FAILED',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

function requestedCity(request, current = false) {
  return current ? 'current' : request.params.cityId
}

export function registerSubjectQueryRoutes(app, { requireLiveCityAccess }) {
  const contract = (current) => (request, response) => withAccess(request, response, {
    requireLiveCityAccess,
    requestedCityId: requestedCity(request, current),
  }, async (access) => {
    response.json({
      ok: true,
      cityId: access.cityId,
      contract: await getCitySubjectQueryContract(access.cityId),
      error: null,
    })
  })

  const query = (current) => (request, response) => withAccess(request, response, {
    requireLiveCityAccess,
    requestedCityId: requestedCity(request, current),
  }, async (access) => {
    response.json(await executeCitySubjectQuery(access.cityId, request.body ?? {}, actorUserId(request, access)))
  })

  const listBlueprints = (current) => (request, response) => withAccess(request, response, {
    requireLiveCityAccess,
    requestedCityId: requestedCity(request, current),
  }, async (access) => {
    response.json(await listCitySubjectQueryBlueprints(access.cityId, { limit: request.query.limit }))
  })

  const saveBlueprint = (current) => (request, response) => withAccess(request, response, {
    requireLiveCityAccess,
    requestedCityId: requestedCity(request, current),
  }, async (access) => {
    response.status(201).json(await saveCitySubjectQueryBlueprint(
      access.cityId,
      request.body?.blueprint ?? request.body ?? {},
      actorUserId(request, access),
    ))
  })

  const executeBlueprint = (current) => (request, response) => withAccess(request, response, {
    requireLiveCityAccess,
    requestedCityId: requestedCity(request, current),
  }, async (access) => {
    response.json(await executeSubjectQueryBlueprint(
      access.cityId,
      request.params.blueprintKey,
      request.body ?? {},
      actorUserId(request, access),
    ))
  })

  app.get('/api/live/current/subject-query-contract', contract(true))
  app.get('/api/live/:cityId/subject-query-contract', contract(false))
  app.post('/api/live/current/subject-query', query(true))
  app.post('/api/live/:cityId/subject-query', query(false))
  app.get('/api/live/current/subject-query-blueprints', listBlueprints(true))
  app.get('/api/live/:cityId/subject-query-blueprints', listBlueprints(false))
  app.post('/api/live/current/subject-query-blueprints', saveBlueprint(true))
  app.post('/api/live/:cityId/subject-query-blueprints', saveBlueprint(false))
  app.post('/api/live/current/subject-query-blueprints/:blueprintKey/execute', executeBlueprint(true))
  app.post('/api/live/:cityId/subject-query-blueprints/:blueprintKey/execute', executeBlueprint(false))
}
