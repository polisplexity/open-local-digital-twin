import {
  getDcatCatalog,
  getJsonLdContext,
  getNgsiEntities,
  getOgcCollectionItems,
  getOgcCollections,
  getOgcConformance,
  getOgcLanding,
} from '../services/ldtInteropService.mjs'
import { getCityOpenApiDocument } from '../services/ldtOpsService.mjs'

function requestBaseUrl(request) {
  const proto = String(request.headers['x-forwarded-proto'] || request.protocol || 'http').split(',')[0].trim()
  const host = String(request.headers['x-forwarded-host'] || request.get('host') || '').split(',')[0].trim()
  return `${proto}://${host}`
}

async function resolveAccess(request, response, requireLiveCityAccess, cityId) {
  const access = requireLiveCityAccess(request, response, cityId)
  return access || null
}

export function registerStandardsRoutes(app, { requireLiveCityAccess }) {
  app.get('/api/live/current/openapi.json', async (request, response) => {
    try {
      const access = await resolveAccess(request, response, requireLiveCityAccess, 'current')
      if (!access) return
      response.json(getCityOpenApiDocument({
        cityId: access.cityId,
        baseUrl: requestBaseUrl(request),
      }))
    } catch (error) {
      response.status(502).json({
        error: 'CITY_OPENAPI_UNAVAILABLE',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/live/:cityId/openapi.json', async (request, response) => {
    try {
      const access = await resolveAccess(request, response, requireLiveCityAccess, request.params.cityId)
      if (!access) return
      response.json(getCityOpenApiDocument({
        cityId: access.cityId,
        baseUrl: requestBaseUrl(request),
      }))
    } catch (error) {
      response.status(502).json({
        error: 'CITY_OPENAPI_UNAVAILABLE',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/live/current/standards/context/:contextKey', async (request, response) => {
    try {
      const access = await resolveAccess(request, response, requireLiveCityAccess, 'current')
      if (!access) return
      response.setHeader('Content-Type', 'application/ld+json')
      response.json(await getJsonLdContext(request.params.contextKey))
    } catch (error) {
      response.status(404).json({
        error: 'JSONLD_CONTEXT_UNAVAILABLE',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/live/:cityId/standards/context/:contextKey', async (request, response) => {
    try {
      const access = await resolveAccess(request, response, requireLiveCityAccess, request.params.cityId)
      if (!access) return
      response.setHeader('Content-Type', 'application/ld+json')
      response.json(await getJsonLdContext(request.params.contextKey))
    } catch (error) {
      response.status(404).json({
        error: 'JSONLD_CONTEXT_UNAVAILABLE',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/live/current/standards/dcat', async (request, response) => {
    try {
      const access = await resolveAccess(request, response, requireLiveCityAccess, 'current')
      if (!access) return
      response.setHeader('Content-Type', 'application/ld+json')
      response.json(await getDcatCatalog(access.cityId, {
        baseUrl: requestBaseUrl(request),
        refresh: request.query.refresh === '1',
      }))
    } catch (error) {
      response.status(502).json({
        error: 'DCAT_EXPORT_UNAVAILABLE',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/live/:cityId/standards/dcat', async (request, response) => {
    try {
      const access = await resolveAccess(request, response, requireLiveCityAccess, request.params.cityId)
      if (!access) return
      response.setHeader('Content-Type', 'application/ld+json')
      response.json(await getDcatCatalog(access.cityId, {
        baseUrl: requestBaseUrl(request),
        refresh: request.query.refresh === '1',
      }))
    } catch (error) {
      response.status(502).json({
        error: 'DCAT_EXPORT_UNAVAILABLE',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/live/current/standards/ngsi-ld/entities', async (request, response) => {
    try {
      const access = await resolveAccess(request, response, requireLiveCityAccess, 'current')
      if (!access) return
      response.json(await getNgsiEntities(access.cityId, {
        type: request.query.type,
        limit: request.query.limit,
        offset: request.query.offset,
      }))
    } catch (error) {
      response.status(502).json({
        error: 'NGSI_LD_ENTITIES_UNAVAILABLE',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/live/:cityId/standards/ngsi-ld/entities', async (request, response) => {
    try {
      const access = await resolveAccess(request, response, requireLiveCityAccess, request.params.cityId)
      if (!access) return
      response.json(await getNgsiEntities(access.cityId, {
        type: request.query.type,
        limit: request.query.limit,
        offset: request.query.offset,
      }))
    } catch (error) {
      response.status(502).json({
        error: 'NGSI_LD_ENTITIES_UNAVAILABLE',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/live/current/standards/ogc', async (request, response) => {
    try {
      const access = await resolveAccess(request, response, requireLiveCityAccess, 'current')
      if (!access) return
      response.json(await getOgcLanding(access.cityId, { baseUrl: requestBaseUrl(request) }))
    } catch (error) {
      response.status(502).json({
        error: 'OGC_LANDING_UNAVAILABLE',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/live/:cityId/standards/ogc', async (request, response) => {
    try {
      const access = await resolveAccess(request, response, requireLiveCityAccess, request.params.cityId)
      if (!access) return
      response.json(await getOgcLanding(access.cityId, { baseUrl: requestBaseUrl(request) }))
    } catch (error) {
      response.status(502).json({
        error: 'OGC_LANDING_UNAVAILABLE',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/live/current/standards/ogc/conformance', async (request, response) => {
    const access = await resolveAccess(request, response, requireLiveCityAccess, 'current')
    if (!access) return
    response.json(getOgcConformance())
  })

  app.get('/api/live/:cityId/standards/ogc/conformance', async (request, response) => {
    const access = await resolveAccess(request, response, requireLiveCityAccess, request.params.cityId)
    if (!access) return
    response.json(getOgcConformance())
  })

  app.get('/api/live/current/standards/ogc/collections', async (request, response) => {
    try {
      const access = await resolveAccess(request, response, requireLiveCityAccess, 'current')
      if (!access) return
      response.json(await getOgcCollections(access.cityId, { baseUrl: requestBaseUrl(request) }))
    } catch (error) {
      response.status(502).json({
        error: 'OGC_COLLECTIONS_UNAVAILABLE',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/live/:cityId/standards/ogc/collections', async (request, response) => {
    try {
      const access = await resolveAccess(request, response, requireLiveCityAccess, request.params.cityId)
      if (!access) return
      response.json(await getOgcCollections(access.cityId, { baseUrl: requestBaseUrl(request) }))
    } catch (error) {
      response.status(502).json({
        error: 'OGC_COLLECTIONS_UNAVAILABLE',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/live/current/standards/ogc/collections/:collectionKey/items', async (request, response) => {
    try {
      const access = await resolveAccess(request, response, requireLiveCityAccess, 'current')
      if (!access) return
      response.setHeader('Content-Type', 'application/geo+json')
      response.json(await getOgcCollectionItems(access.cityId, request.params.collectionKey, {
        baseUrl: requestBaseUrl(request),
        bbox: request.query.bbox,
        limit: request.query.limit,
        offset: request.query.offset,
      }))
    } catch (error) {
      response.status(400).json({
        error: 'OGC_COLLECTION_ITEMS_UNAVAILABLE',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/live/:cityId/standards/ogc/collections/:collectionKey/items', async (request, response) => {
    try {
      const access = await resolveAccess(request, response, requireLiveCityAccess, request.params.cityId)
      if (!access) return
      response.setHeader('Content-Type', 'application/geo+json')
      response.json(await getOgcCollectionItems(access.cityId, request.params.collectionKey, {
        baseUrl: requestBaseUrl(request),
        bbox: request.query.bbox,
        limit: request.query.limit,
        offset: request.query.offset,
      }))
    } catch (error) {
      response.status(400).json({
        error: 'OGC_COLLECTION_ITEMS_UNAVAILABLE',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })
}
