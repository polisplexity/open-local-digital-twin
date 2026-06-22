import { requireRateLimit } from '../http/rateLimit.mjs'
import { buildCityProductionPlan } from '../services/cityProductionPlanService.mjs'
import { requireAdmin } from '../services/authService.mjs'
import {
  acceptCityLayerAuthority,
  listCityLayerRegistry,
  persistCityBuildingConflationLayers,
} from '../db/productionTwinStore.mjs'
import { requireAdminCity } from './adminLayerRouteHelpers.mjs'

export function registerAdminLayerAuthorityRoutes(app) {
  app.post('/api/admin/cities/:cityId/layers/:layerKey/accept-authority', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:city-layer-authority', { limit: 30, windowMs: 10 * 60_000 })) return
      const admin = requireAdmin(request)
      const city = requireAdminCity(response, request.params.cityId)
      if (!city) return
      const result = await acceptCityLayerAuthority(city, request.params.layerKey, {
        ...(request.body ?? {}),
        acceptedBy: request.body?.acceptedBy ?? request.body?.accepted_by ?? admin?.user?.id ?? 'admin-api',
      })
      response.status(200).json({
        ...result,
        productionPlan: await buildCityProductionPlan(city),
        registry: await listCityLayerRegistry(city.id),
      })
    } catch (error) {
      response.status(400).json({
        error: 'CITY_LAYER_AUTHORITY_ACCEPT_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/cities/:cityId/building-conflation/refresh', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:building-conflation-refresh', { limit: 12, windowMs: 10 * 60_000 })) return
      const city = requireAdminCity(response, request.params.cityId)
      if (!city) return
      const result = await persistCityBuildingConflationLayers(city.id)
      response.status(result.ok ? 200 : 502).json({
        ...result,
        layers: await listCityLayerRegistry(city.id),
      })
    } catch (error) {
      response.status(400).json({
        error: 'CITY_BUILDING_CONFLATION_REFRESH_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })
}
