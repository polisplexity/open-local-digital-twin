import { requireRateLimit } from '../http/rateLimit.mjs'
import { registerAdminFiwareRoutes } from './adminFiwareRoutes.mjs'
import { registerAdminLayerRoutes } from './adminLayerRoutes.mjs'
import { registerAdminWorkflowRoutes } from './adminWorkflowRoutes.mjs'
import {
  getCityBasePayload,
  getCityCacheStatus,
  listCityCacheStatuses,
  readCachedCityBasePayload,
} from '../services/baseTwinService.mjs'
import { buildCityProductionPlan } from '../services/cityProductionPlanService.mjs'
import { findCityConfig, getCityRegistry, updateCityRegistry } from '../services/cityRegistry.mjs'
import { getBimAssetPath } from '../services/bimAssetStore.mjs'
import { requireAdmin } from '../services/authService.mjs'
import {
  getCityLayerBimPayload,
  getCityProductionStorageSummary,
  ingestBaseTwinPayload,
  listRegisteredProviders,
  upsertRegisteredProvider,
} from '../db/productionTwinStore.mjs'

function normalizeCityUpsertPayload(body = {}) {
  const rawCities = Array.isArray(body.cities)
    ? body.cities
    : body.city
      ? [body.city]
      : []

  return rawCities
    .map((city) => ({
      ...(city ?? {}),
      id: String(city?.id ?? city?.name ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    }))
    .filter((city) => city.id)
}

function buildUpsertedCityRegistry(body = {}, options = {}) {
  const registry = getCityRegistry()
  const incomingCities = normalizeCityUpsertPayload(body)
  const citiesById = new Map(registry.cities.map((city) => [city.id, city]))

  incomingCities.forEach((city) => {
    citiesById.set(city.id, {
      ...(citiesById.get(city.id) ?? {}),
      ...city,
    })
  })

  const requestedActiveCityId = String(body.activeCityId ?? body.setActiveCityId ?? '').trim()
  const singleIncomingCityId = incomingCities.length === 1 ? incomingCities[0].id : ''
  const activeCityId =
    requestedActiveCityId ||
    (body.setActive === true ? singleIncomingCityId : '') ||
    registry.activeCityId

  return updateCityRegistry(
    {
      ...registry,
      activeCityId,
      cities: Array.from(citiesById.values()),
    },
    options,
  )
}

export function registerAdminRoutes(app) {
  app.get('/api/admin/cities', (_request, response) => {
    response.json(getCityRegistry())
  })

  app.post('/api/admin/cities', (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:cities-save', { limit: 30, windowMs: 5 * 60_000 })) return
      const admin = requireAdmin(request)
      const updated = updateCityRegistry(request.body ?? {}, {
        actorUserId: admin?.user?.id ?? null,
        reason: 'city_registry.saved',
      })
      response.json(updated)
    } catch (error) {
      response.status(400).json({
        error: 'CITY_REGISTRY_UPDATE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/cities/upsert', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:cities-upsert', { limit: 30, windowMs: 5 * 60_000 })) return
      const admin = requireAdmin(request)
      let updated = buildUpsertedCityRegistry(request.body ?? {}, {
        actorUserId: admin?.user?.id ?? null,
        reason: 'city_registry.upserted',
      })
      const requestedCities = normalizeCityUpsertPayload(request.body ?? {})
      const preload = request.query.preload === '1' || request.body?.preload === true
      const forceRefresh = request.query.refresh === '1' || request.body?.refresh === true
      const preloadResults = []

      if (preload) {
        for (const city of requestedCities) {
          const payload = await getCityBasePayload({ cityId: city.id, forceRefresh })
          preloadResults.push({
            cityId: city.id,
            fetchedAt: payload?.fetchedAt ?? null,
            cache: getCityCacheStatus(city.id),
          })
        }

        const preloadedCityIds = new Set(preloadResults.map((result) => result.cityId))
        updated = updateCityRegistry(
          {
            ...updated,
            cities: updated.cities.map((city) => (
              preloadedCityIds.has(city.id)
                ? { ...city, preloaded: true }
                : city
            )),
          },
          {
            actorUserId: admin?.user?.id ?? null,
            reason: 'city_registry.preloaded',
          },
        )
      }

      response.json({
        ok: true,
        registry: updated,
        upsertedCityIds: requestedCities.map((city) => city.id),
        preloadResults,
      })
    } catch (error) {
      response.status(400).json({
        error: 'CITY_UPSERT_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/city-caches', (_request, response) => {
    const registry = getCityRegistry()
    response.json({
      activeCityId: registry.activeCityId,
      caches: listCityCacheStatuses(registry.cities.map((city) => city.id)),
    })
  })

  app.get('/api/admin/providers', async (_request, response) => {
    try {
      response.json(await listRegisteredProviders())
    } catch (error) {
      response.status(500).json({
        error: 'PROVIDER_REGISTRY_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/providers', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:providers-upsert', { limit: 30, windowMs: 5 * 60_000 })) return
      const result = await upsertRegisteredProvider(request.body?.provider ?? request.body ?? {})
      response.status(201).json({
        ...result,
        registry: await listRegisteredProviders(),
      })
    } catch (error) {
      response.status(400).json({
        error: 'PROVIDER_REGISTRY_WRITE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  registerAdminWorkflowRoutes(app)

  registerAdminFiwareRoutes(app)

  app.get('/api/admin/cities/:cityId/storage', async (request, response) => {
    try {
      const cityId = request.params.cityId
      if (!findCityConfig(cityId)) {
        response.status(404).json({ error: 'CITY_NOT_FOUND' })
        return
      }
      response.json(await getCityProductionStorageSummary(cityId))
    } catch (error) {
      response.status(500).json({
        error: 'CITY_STORAGE_STATUS_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/cities/:cityId/production-plan', async (request, response) => {
    try {
      const city = findCityConfig(request.params.cityId)
      if (!city) {
        response.status(404).json({ error: 'CITY_NOT_FOUND' })
        return
      }
      response.json(await buildCityProductionPlan(city))
    } catch (error) {
      response.status(500).json({
        error: 'CITY_PRODUCTION_PLAN_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/cities/:cityId/layers/:layerKey/bim-payload', async (request, response) => {
    try {
      const city = findCityConfig(request.params.cityId)
      if (!city) {
        response.status(404).json({ error: 'CITY_NOT_FOUND' })
        return
      }
      const result = await getCityLayerBimPayload(city.id, request.params.layerKey)
      response.status(result.ok ? 200 : 404).json(result)
    } catch (error) {
      response.status(500).json({
        error: 'CITY_LAYER_BIM_PAYLOAD_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/cities/:cityId/layers/:layerKey/bim-assets/:bundleId/:assetName', (request, response) => {
    const filePath = getBimAssetPath({
      cityId: request.params.cityId,
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

  registerAdminLayerRoutes(app)

  app.post('/api/admin/cities/:cityId/ingest-base-cache', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:base-cache-ingest', { limit: 12, windowMs: 10 * 60_000 })) return
      const cityId = request.params.cityId
      if (!findCityConfig(cityId)) {
        response.status(404).json({ error: 'CITY_NOT_FOUND' })
        return
      }
      const payload = readCachedCityBasePayload(cityId, { allowStale: true })
      if (!payload) {
        response.status(404).json({
          error: 'CITY_CACHE_NOT_FOUND',
          cache: getCityCacheStatus(cityId),
        })
        return
      }
      const ingestion = await ingestBaseTwinPayload(payload, { strict: true })
      response.json({
        ok: true,
        cityId,
        ingestion,
        storage: await getCityProductionStorageSummary(cityId),
      })
    } catch (error) {
      response.status(502).json({
        error: 'CITY_BASE_CACHE_INGEST_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/cities/:cityId/preload', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:city-preload', { limit: 20, windowMs: 10 * 60_000 })) return
      const admin = requireAdmin(request)
      const cityId = request.params.cityId
      if (!findCityConfig(cityId)) {
        response.status(404).json({ error: 'CITY_NOT_FOUND' })
        return
      }
      const forceRefresh = request.query.refresh === '1' || request.body?.refresh === true
      const payload = await getCityBasePayload({ cityId, forceRefresh })
      const registry = getCityRegistry()
      updateCityRegistry(
        {
          ...registry,
          cities: registry.cities.map((city) => (
            city.id === cityId ? { ...city, preloaded: true } : city
          )),
        },
        {
          actorUserId: admin?.user?.id ?? null,
          reason: 'city_registry.preloaded',
        },
      )
      response.json({
        ok: true,
        cityId,
        fetchedAt: payload?.fetchedAt ?? null,
        cache: getCityCacheStatus(cityId),
      })
    } catch (error) {
      response.status(502).json({
        error: 'CITY_PRELOAD_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })
}
