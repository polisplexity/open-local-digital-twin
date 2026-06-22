import { getBimAssetPath } from '../services/bimAssetStore.mjs'
import {
  getCityLayerBimPayload,
  listCityLayerRegistry,
} from '../db/productionTwinStore.mjs'
import { requireLiveAccess } from './liveRouteHelpers.mjs'

async function getLiveBimLayers(cityId) {
  const registry = await listCityLayerRegistry(cityId)
  if (!registry.ok) return registry
  const candidates = registry.layers.filter((layer) =>
    String(layer.layerFamily ?? '').toLowerCase().includes('bim') ||
    String(layer.metadata?.sourceFormat ?? '').toLowerCase() === 'ifc',
  )
  const layers = await Promise.all(candidates.map((layer) => getCityLayerBimPayload(cityId, layer.key)))
  return {
    configured: true,
    ok: true,
    cityId,
    layers: layers.filter((layer) => layer.ok),
    error: null,
  }
}

async function sendBimLayers(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const result = await getLiveBimLayers(access.cityId)
    response.status(result.ok ? 200 : 502).json(result)
  } catch (error) {
    response.status(502).json({
      error: 'LIVE_BIM_LAYERS_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

export function registerLiveBimRoutes(app, { requireLiveCityAccess }) {
  app.get('/api/live/current/bim-layers', (request, response) => sendBimLayers(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/bim-layers', (request, response) => sendBimLayers(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/:cityId/bim-assets/:layerKey/:bundleId/:assetName', (request, response) => {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, request.params.cityId)
    if (!access) return
    const filePath = getBimAssetPath({
      cityId: access.cityId,
      layerKey: request.params.layerKey,
      bundleId: request.params.bundleId,
      assetName: request.params.assetName,
    })
    if (!filePath) {
      response.status(404).json({ error: 'BIM_ASSET_NOT_FOUND' })
      return
    }
    response.setHeader('Content-Type', filePath.endsWith('.json') ? 'application/json' : 'application/octet-stream')
    response.sendFile(filePath)
  })
}
