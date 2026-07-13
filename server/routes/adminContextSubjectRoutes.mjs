import { requireRateLimit } from '../http/rateLimit.mjs'
import { requireAdmin } from '../services/authService.mjs'
import {
  saveContextSubject,
  saveSubjectIndicatorObservation,
  saveSubjectRelation,
} from '../services/subjectQuery/subjectQueryService.mjs'

function requireAdminResponse(request, response) {
  const admin = requireAdmin(request)
  if (!admin) {
    response.status(403).json({ error: 'ADMIN_REQUIRED' })
    return null
  }
  return admin
}

function sendError(response, error, code) {
  response.status(422).json({
    ok: false,
    error: code,
    detail: String(error?.message ?? 'UNKNOWN_ERROR'),
  })
}

export function registerAdminContextSubjectRoutes(app) {
  app.post('/api/admin/cities/:cityId/context-subjects', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:context-subject-upsert', { limit: 120, windowMs: 5 * 60_000 })) return
      if (!requireAdminResponse(request, response)) return
      response.status(201).json(await saveContextSubject(request.params.cityId, request.body?.subject ?? request.body ?? {}))
    } catch (error) {
      sendError(response, error, 'CONTEXT_SUBJECT_UPSERT_FAILED')
    }
  })

  app.post('/api/admin/cities/:cityId/subject-relations', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:subject-relation-upsert', { limit: 240, windowMs: 5 * 60_000 })) return
      if (!requireAdminResponse(request, response)) return
      response.status(201).json(await saveSubjectRelation(request.params.cityId, request.body?.relation ?? request.body ?? {}))
    } catch (error) {
      sendError(response, error, 'SUBJECT_RELATION_UPSERT_FAILED')
    }
  })

  app.post('/api/admin/cities/:cityId/subject-indicator-observations', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:subject-indicator-upsert', { limit: 240, windowMs: 5 * 60_000 })) return
      if (!requireAdminResponse(request, response)) return
      response.status(201).json(await saveSubjectIndicatorObservation(
        request.params.cityId,
        request.body?.observation ?? request.body ?? {},
      ))
    } catch (error) {
      sendError(response, error, 'SUBJECT_INDICATOR_OBSERVATION_UPSERT_FAILED')
    }
  })
}
