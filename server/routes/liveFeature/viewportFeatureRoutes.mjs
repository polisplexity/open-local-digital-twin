import {
  requireLiveAccess,
  sendViewportPayload,
  viewportQuery,
} from '../liveRouteHelpers.mjs'
import {
  getCityBuildingCoverage,
  getCityFeatureVectorTile,
  getCityLayerCapabilitiesForViewer,
  getCityViewportFeatures,
} from '../../services/liveFeature/viewportFeatureUseCaseService.mjs'
import {
  resolveMvtTileArtifact,
  resolvePmtilesArtifact,
  viewerArtifactResponseHeaders,
} from '../../services/viewerArtifacts/viewerArtifactDelivery.mjs'

function hasLiveScopeQuery(request) {
  return Boolean(request.query?.bbox || request.query?.center || request.query?.radiusMeters)
}

function setArtifactHeaders(response, artifact) {
  for (const [key, value] of Object.entries(viewerArtifactResponseHeaders(artifact))) {
    response.setHeader(key, value)
  }
}

async function sendBuildingCoverage(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const coverage = await getCityBuildingCoverage(access.cityId)
    response.status(coverage.ok ? 200 : 502).json(coverage)
  } catch (error) {
    response.status(502).json({
      error: 'BUILDING_COVERAGE_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendViewportFeatures(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    sendViewportPayload(response, await getCityViewportFeatures(access.cityId, viewportQuery(request)))
  } catch (error) {
    response.status(400).json({
      error: 'LIVE_VIEWPORT_FEATURES_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendLayerCapabilities(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const capabilities = await getCityLayerCapabilitiesForViewer(access.cityId)
    response.status(capabilities.ok ? 200 : 502).json(capabilities)
  } catch (error) {
    response.status(502).json({
      error: 'LIVE_LAYER_CAPABILITIES_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendFeatureVectorTile(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const tile = await getCityFeatureVectorTile(access.cityId, {
      z: request.params.z,
      x: request.params.x,
      y: request.params.y,
      ...viewportQuery(request),
    })
    if (!tile.ok) {
      response.status(502).json(tile)
      return
    }
    response.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile')
    response.setHeader('Cache-Control', 'private, max-age=60')
    response.send(tile.tile)
  } catch (error) {
    response.status(400).json({
      error: 'LIVE_VECTOR_TILE_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendCachedFeatureVectorTile(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    if (!hasLiveScopeQuery(request)) {
      const materialized = await resolveMvtTileArtifact({
        cityId: access.cityId,
        version: request.params.version,
        z: request.params.z,
        x: request.params.x,
        y: request.params.y,
      })
      if (materialized?.filePath) {
        response.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile')
        response.setHeader('Cache-Control', 'private, max-age=3600')
        response.setHeader('X-Twin-Tile-Source', 'materialized-mvt')
        setArtifactHeaders(response, materialized.artifact)
        response.sendFile(materialized.filePath)
        return
      }
    }
    await sendFeatureVectorTile(request, response, { requireLiveCityAccess, requestedCityId })
  } catch (error) {
    response.status(400).json({
      error: 'LIVE_CACHED_VECTOR_TILE_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendPmtilesArchive(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const artifactFile = await resolvePmtilesArtifact({
      cityId: access.cityId,
      version: request.params.version,
    })
    if (!artifactFile?.filePath) {
      response.status(404).json({ error: 'PMTILES_ARCHIVE_NOT_FOUND' })
      return
    }
    response.setHeader('Cache-Control', 'private, max-age=3600')
    response.setHeader('Content-Type', artifactFile.artifact.mediaType || 'application/vnd.pmtiles')
    response.setHeader('X-Twin-Tile-Source', 'pmtiles')
    setArtifactHeaders(response, artifactFile.artifact)
    response.sendFile(artifactFile.filePath)
  } catch (error) {
    response.status(400).json({
      error: 'LIVE_PMTILES_ARCHIVE_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

export function registerViewportFeatureRoutes(app, { requireLiveCityAccess }) {
  app.get('/api/live/current/building-coverage', (request, response) => sendBuildingCoverage(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/building-coverage', (request, response) => sendBuildingCoverage(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/features', (request, response) => sendViewportFeatures(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/features', (request, response) => sendViewportFeatures(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/:cityId/tiles/:z/:x/:y.mvt', (request, response) => sendFeatureVectorTile(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/:cityId/cached-tiles/:version/:z/:x/:y.mvt', (request, response) => sendCachedFeatureVectorTile(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/:cityId/pmtiles/:version.pmtiles', (request, response) => sendPmtilesArchive(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/layer-capabilities', (request, response) => sendLayerCapabilities(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/layer-capabilities', (request, response) => sendLayerCapabilities(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))
}
