import { requireLiveAccess } from '../liveRouteHelpers.mjs'
import { twinQueryPayload } from './twinQueryHttpAdapter.mjs'
import {
  compareCityAnalysisSelections,
  createCityAnalysisSession,
  getCityAnalysisSelection,
  listCityAnalysisSelectionMembers,
  listCityAnalysisSelections,
  runCityAnalysisSelection,
} from '../../services/analysisSelection/selectionLabService.mjs'

function bodyPayload(request) {
  return request.body && typeof request.body === 'object' ? request.body : {}
}

function selectionQueryPayload(request, access) {
  const body = bodyPayload(request)
  const payload = twinQueryPayload(request, access)
  return {
    ...payload,
    query: body.query && typeof body.query === 'object' ? {
      ...payload,
      ...body.query,
    } : payload,
    title: body.title,
    sessionId: body.sessionId,
    selectionKind: body.selectionKind,
    maxSelectionMembers: body.maxSelectionMembers ?? body.memberLimit ?? request.query.maxSelectionMembers,
    style: body.style && typeof body.style === 'object' ? body.style : undefined,
    createdBy: body.createdBy || payload.actorUserId,
  }
}

function listOptions(request) {
  return {
    limit: request.query.limit,
    status: request.query.status,
    semanticClass: request.query.semanticClass ?? request.query.class,
  }
}

function memberOptions(request) {
  return {
    includeMembers: request.query.includeMembers === '1' || request.query.includeMembers === 'true',
    limit: request.query.limit,
    offset: request.query.offset,
  }
}

async function sendRunSelection(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const result = await runCityAnalysisSelection(access.cityId, selectionQueryPayload(request, access))
    response.status(result.ok ? 200 : 422).json(result)
  } catch (error) {
    response.status(422).json({
      ok: false,
      error: 'LIVE_ANALYSIS_SELECTION_QUERY_FAILED',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendCreateSession(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const body = bodyPayload(request)
    const result = await createCityAnalysisSession(access.cityId, {
      ...body,
      actorUserId: access.currentUser?.email || access.user?.email || null,
    })
    response.status(result.ok ? 200 : 422).json(result)
  } catch (error) {
    response.status(422).json({
      ok: false,
      error: 'LIVE_ANALYSIS_SESSION_CREATE_FAILED',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendListSelections(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const result = await listCityAnalysisSelections(access.cityId, listOptions(request))
    response.status(result.ok ? 200 : 502).json(result)
  } catch (error) {
    response.status(502).json({
      ok: false,
      error: 'LIVE_ANALYSIS_SELECTIONS_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendGetSelection(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const result = await getCityAnalysisSelection(access.cityId, request.params.selectionId, memberOptions(request))
    response.status(result.ok ? 200 : 404).json(result)
  } catch (error) {
    response.status(502).json({
      ok: false,
      error: 'LIVE_ANALYSIS_SELECTION_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendSelectionMembers(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const result = await listCityAnalysisSelectionMembers(access.cityId, request.params.selectionId, memberOptions(request))
    response.status(result.ok ? 200 : 404).json(result)
  } catch (error) {
    response.status(502).json({
      ok: false,
      error: 'LIVE_ANALYSIS_SELECTION_MEMBERS_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendCompareSelections(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const result = await compareCityAnalysisSelections(access.cityId, {
      ...bodyPayload(request),
      actorUserId: access.currentUser?.email || access.user?.email || null,
    })
    response.status(result.ok ? 200 : 422).json(result)
  } catch (error) {
    response.status(422).json({
      ok: false,
      error: 'LIVE_ANALYSIS_SELECTION_COMPARISON_FAILED',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

export function registerAnalysisSelectionRoutes(app, { requireLiveCityAccess }) {
  app.post('/api/live/current/analysis-sessions', (request, response) => sendCreateSession(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.post('/api/live/:cityId/analysis-sessions', (request, response) => sendCreateSession(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/analysis-selections', (request, response) => sendListSelections(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/analysis-selections', (request, response) => sendListSelections(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.post('/api/live/current/analysis-selections/query', (request, response) => sendRunSelection(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.post('/api/live/:cityId/analysis-selections/query', (request, response) => sendRunSelection(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.post('/api/live/current/analysis-selections/compare', (request, response) => sendCompareSelections(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.post('/api/live/:cityId/analysis-selections/compare', (request, response) => sendCompareSelections(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/analysis-selections/:selectionId/members', (request, response) => sendSelectionMembers(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/analysis-selections/:selectionId/members', (request, response) => sendSelectionMembers(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/analysis-selections/:selectionId', (request, response) => sendGetSelection(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/analysis-selections/:selectionId', (request, response) => sendGetSelection(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))
}
