import {
  getViewerArtifactsReport,
  registerExistingViewerArtifacts,
} from '../services/viewerArtifacts/viewerArtifactScanner.mjs'
import { activateViewerArtifactRecord } from '../db/productionTwinStore/viewerArtifactRepository.mjs'
import { requireLiveAccess } from './liveRouteHelpers.mjs'

function boolQuery(value) {
  return value === true || String(value ?? '').toLowerCase() === 'true' || String(value ?? '') === '1'
}

function artifactOptions(query = {}) {
  return {
    artifactType: query.artifactType,
    artifactKey: query.artifactKey,
    transport: query.transport,
    version: query.version,
    status: query.status,
    active: query.active === undefined ? undefined : boolQuery(query.active),
    limit: query.limit,
    refresh: boolQuery(query.refresh),
    activateLatest: boolQuery(query.activateLatest),
  }
}

async function sendViewerArtifacts(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const report = await getViewerArtifactsReport(access.cityId, artifactOptions(request.query))
    response.json(report)
  } catch (error) {
    response.status(500).json({
      error: 'VIEWER_ARTIFACTS_FAILED',
      message: String(error?.message ?? error),
    })
  }
}

export function registerLiveViewerArtifactRoutes(app, { requireLiveCityAccess }) {
  app.get('/api/live/current/viewer-artifacts', (request, response) => sendViewerArtifacts(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/viewer-artifacts', (request, response) => sendViewerArtifacts(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.post('/api/live/:cityId/viewer-artifacts/register', async (request, response) => {
    try {
      const access = requireLiveAccess(request, response, requireLiveCityAccess, request.params.cityId)
      if (!access) return
      const artifacts = await registerExistingViewerArtifacts(access.cityId, {
        activateLatest: boolQuery(request.body?.activateLatest),
      })
      response.status(201).json({
        ok: true,
        cityId: access.cityId,
        artifactCount: artifacts.length,
        artifacts,
      })
    } catch (error) {
      response.status(500).json({
        error: 'VIEWER_ARTIFACT_REGISTRATION_FAILED',
        message: String(error?.message ?? error),
      })
    }
  })

  app.post('/api/live/:cityId/viewer-artifacts/activate', async (request, response) => {
    try {
      const access = requireLiveAccess(request, response, requireLiveCityAccess, request.params.cityId)
      if (!access) return
      const artifact = await activateViewerArtifactRecord(access.cityId, {
        artifactKey: request.body?.artifactKey,
        artifactType: request.body?.artifactType,
        version: request.body?.version,
      })
      response.json({
        ok: true,
        cityId: access.cityId,
        artifact,
      })
    } catch (error) {
      response.status(400).json({
        error: 'VIEWER_ARTIFACT_ACTIVATION_FAILED',
        message: String(error?.message ?? error),
      })
    }
  })
}
