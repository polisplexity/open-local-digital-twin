import { getVisualShareManifest } from '../db/productionTwinStore.mjs'
import { requireLiveAccess } from './liveRouteHelpers.mjs'
import { buildMapSurfaceManifest } from '../services/baseTwin/viewerContracts/mapSurfaceManifest.mjs'
import { buildViewerSurfaceManifest } from '../services/baseTwin/viewerContracts/viewerSurfaceManifest.mjs'
import {
  twinQueryEventsQuery,
  twinQueryPayload,
  twinQueryTilePayload,
  visualTwinQueryResult,
} from './liveFeature/twinQueryHttpAdapter.mjs'
import {
  executeCityTwinQuery,
  getCityTwinQueryContract,
  getCityTwinQueryTile,
  listCityTwinQueryRunEvents,
} from '../services/twinQuery/twinQueryUseCaseService.mjs'
import { registerSemanticQueryRoutes } from './liveFeature/semanticQueryRoutes.mjs'
import { registerSelectionRoutes } from './liveFeature/selectionRoutes.mjs'
import { registerShareManifestRoutes } from './liveFeature/shareManifestRoutes.mjs'
import { registerViewportFeatureRoutes } from './liveFeature/viewportFeatureRoutes.mjs'
import { registerAnalysisSelectionRoutes } from './liveFeature/analysisSelectionRoutes.mjs'

function mapSurfaceMode(request) {
  return String(request.query.mode || 'cockpit')
}

function viewerSurface(request) {
  return String(request.query.surface || request.query.viewer || 'map')
}

async function sendMapManifest(request, response, { requireLiveCityAccess, requestedCityId }) {
  const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
  if (!access) return
  response.json({
    ok: true,
    cityId: access.cityId,
    manifest: buildMapSurfaceManifest({
      cityId: access.cityId,
      mode: mapSurfaceMode(request),
    }),
  })
}

async function sendViewerManifest(request, response, { requireLiveCityAccess, requestedCityId }) {
  const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
  if (!access) return
  response.json({
    ok: true,
    cityId: access.cityId,
    manifest: buildViewerSurfaceManifest({
      cityId: access.cityId,
      surface: viewerSurface(request),
      mode: mapSurfaceMode(request),
    }),
  })
}

async function sendTwinQueryContract(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    response.json({
      ok: true,
      cityId: access.cityId,
      contract: getCityTwinQueryContract(),
    })
  } catch (error) {
    response.status(502).json({
      error: 'LIVE_TWIN_QUERY_CONTRACT_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendTwinQuery(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const result = await executeCityTwinQuery(access.cityId, twinQueryPayload(request, access))
    response.status(result.ok ? 200 : 422).json(visualTwinQueryResult(request, access.cityId, result))
  } catch (error) {
    response.status(422).json({
      error: 'LIVE_TWIN_QUERY_FAILED',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendTwinQueryMvtTile(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const query = await twinQueryTilePayload(request, access, {
      loadShareManifest: getVisualShareManifest,
    })
    const tile = await getCityTwinQueryTile(access.cityId, {
      z: request.params.z,
      x: request.params.x,
      y: request.params.y,
      limit: request.query.limit,
      query,
      surface: query.surface,
      intent: query.intent,
    })
    if (!tile.ok) {
      response.status(422).json({
        ok: false,
        cityId: access.cityId,
        error: tile.error || 'LIVE_TWIN_QUERY_TILE_FAILED',
        summary: tile.summary,
      })
      return
    }
    response.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile')
    response.setHeader('Cache-Control', 'private, max-age=45')
    response.setHeader('X-Twin-Query-Tile-Features', String(tile.summary?.tileFeatureCount ?? 0))
    response.send(tile.tile)
  } catch (error) {
    response.status(400).json({
      error: 'LIVE_TWIN_QUERY_TILE_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendTwinQueryEvents(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const result = await listCityTwinQueryRunEvents(access.cityId, twinQueryEventsQuery(request))
    response.status(result.ok ? 200 : 502).json(result)
  } catch (error) {
    response.status(502).json({
      error: 'LIVE_TWIN_QUERY_EVENTS_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

export function registerLiveFeatureRoutes(app, { requireLiveCityAccess }) {
  app.get('/api/live/current/map-manifest', (request, response) => sendMapManifest(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/map-manifest', (request, response) => sendMapManifest(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/viewer-manifest', (request, response) => sendViewerManifest(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/viewer-manifest', (request, response) => sendViewerManifest(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/twin-query-contract', (request, response) => sendTwinQueryContract(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/twin-query-contract', (request, response) => sendTwinQueryContract(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/twin-query-events', (request, response) => sendTwinQueryEvents(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/twin-query-events', (request, response) => sendTwinQueryEvents(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/twin-query', (request, response) => sendTwinQuery(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/twin-query', (request, response) => sendTwinQuery(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.post('/api/live/current/twin-query', (request, response) => sendTwinQuery(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.post('/api/live/:cityId/twin-query', (request, response) => sendTwinQuery(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/twin-query-tiles/:z/:x/:y.mvt', (request, response) => sendTwinQueryMvtTile(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/twin-query-tiles/:z/:x/:y.mvt', (request, response) => sendTwinQueryMvtTile(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  registerViewportFeatureRoutes(app, { requireLiveCityAccess })
  registerSemanticQueryRoutes(app, { requireLiveCityAccess })
  registerSelectionRoutes(app, { requireLiveCityAccess })
  registerAnalysisSelectionRoutes(app, { requireLiveCityAccess })
  registerShareManifestRoutes(app, { requireLiveCityAccess })
}
