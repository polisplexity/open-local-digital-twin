import { requireRateLimit } from '../http/rateLimit.mjs'
import {
  listCityLayerRegistry,
  upsertCityProviderLayer,
} from '../db/productionTwinStore.mjs'
import { requireAdminCity } from './adminLayerRouteHelpers.mjs'

export function registerAdminLayerRegistryRoutes(app) {
  app.get('/api/admin/cities/:cityId/layers', async (request, response) => {
    try {
      const city = requireAdminCity(response, request.params.cityId)
      if (!city) return
      response.json(await listCityLayerRegistry(city.id))
    } catch (error) {
      response.status(500).json({
        error: 'CITY_LAYER_REGISTRY_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/cities/:cityId/layers', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:city-layer-upsert', { limit: 30, windowMs: 5 * 60_000 })) return
      const city = requireAdminCity(response, request.params.cityId)
      if (!city) return
      const result = await upsertCityProviderLayer(city, request.body?.layer ?? request.body ?? {})
      response.status(201).json({
        ...result,
        registry: await listCityLayerRegistry(city.id),
      })
    } catch (error) {
      response.status(400).json({
        error: 'CITY_LAYER_REGISTRY_WRITE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })
}
