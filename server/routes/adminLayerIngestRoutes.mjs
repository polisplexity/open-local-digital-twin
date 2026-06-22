import { requireRateLimit } from '../http/rateLimit.mjs'
import {
  ingestOvertureBuildingsLayer,
  ingestOvertureRoadsLayer,
  ingestProviderCityJsonLayer,
  ingestProviderCsvLayer,
  ingestProviderGeoJsonLayer,
  ingestProviderIfcLayer,
  ingestProviderOgcFeaturesLayer,
  ingestProviderStacLayer,
  registerProviderPackageMetadataLayer,
} from '../services/providerLayerIngestionService.mjs'
import {
  listCityLayerIngestionJobs,
  listCityLayerRegistry,
} from '../db/productionTwinStore.mjs'
import { requireAdminCity } from './adminLayerRouteHelpers.mjs'

async function sendLayerIngestion(request, response, {
  rateKey,
  rateLimit,
  run,
  error,
}) {
  try {
    if (!requireRateLimit(request, response, rateKey, rateLimit)) return
    const city = requireAdminCity(response, request.params.cityId)
    if (!city) return
    const result = await run(city, request.params.layerKey, request.body ?? {})
    response.status(201).json({
      ...result,
      layers: await listCityLayerRegistry(city.id),
      jobs: await listCityLayerIngestionJobs(city.id),
    })
  } catch (caughtError) {
    response.status(400).json({
      error,
      detail: String(caughtError?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

export function registerAdminLayerIngestRoutes(app) {
  app.post('/api/admin/cities/:cityId/layers/:layerKey/ingest-geojson', (request, response) => sendLayerIngestion(request, response, {
    rateKey: 'admin:layer-geojson-ingest',
    rateLimit: { limit: 20, windowMs: 10 * 60_000 },
    run: ingestProviderGeoJsonLayer,
    error: 'CITY_LAYER_GEOJSON_INGEST_FAILED',
  }))

  app.post('/api/admin/cities/:cityId/layers/:layerKey/ingest-csv', (request, response) => sendLayerIngestion(request, response, {
    rateKey: 'admin:layer-csv-ingest',
    rateLimit: { limit: 20, windowMs: 10 * 60_000 },
    run: ingestProviderCsvLayer,
    error: 'CITY_LAYER_CSV_INGEST_FAILED',
  }))

  app.post('/api/admin/cities/:cityId/layers/:layerKey/ingest-ogc-features', (request, response) => sendLayerIngestion(request, response, {
    rateKey: 'admin:layer-ogc-features-ingest',
    rateLimit: { limit: 20, windowMs: 10 * 60_000 },
    run: ingestProviderOgcFeaturesLayer,
    error: 'CITY_LAYER_OGC_FEATURES_INGEST_FAILED',
  }))

  app.post('/api/admin/cities/:cityId/layers/:layerKey/ingest-cityjson', (request, response) => sendLayerIngestion(request, response, {
    rateKey: 'admin:layer-cityjson-ingest',
    rateLimit: { limit: 12, windowMs: 10 * 60_000 },
    run: ingestProviderCityJsonLayer,
    error: 'CITY_LAYER_CITYJSON_INGEST_FAILED',
  }))

  app.post('/api/admin/cities/:cityId/layers/:layerKey/ingest-ifc', (request, response) => sendLayerIngestion(request, response, {
    rateKey: 'admin:layer-ifc-ingest',
    rateLimit: { limit: 8, windowMs: 10 * 60_000 },
    run: ingestProviderIfcLayer,
    error: 'CITY_LAYER_IFC_INGEST_FAILED',
  }))

  app.post('/api/admin/cities/:cityId/layers/:layerKey/ingest-stac', (request, response) => sendLayerIngestion(request, response, {
    rateKey: 'admin:layer-stac-ingest',
    rateLimit: { limit: 12, windowMs: 10 * 60_000 },
    run: ingestProviderStacLayer,
    error: 'CITY_LAYER_STAC_INGEST_FAILED',
  }))

  app.post('/api/admin/cities/:cityId/layers/:layerKey/ingest-overture-buildings', (request, response) => sendLayerIngestion(request, response, {
    rateKey: 'admin:layer-overture-buildings-ingest',
    rateLimit: { limit: 6, windowMs: 10 * 60_000 },
    run: ingestOvertureBuildingsLayer,
    error: 'CITY_LAYER_OVERTURE_BUILDINGS_INGEST_FAILED',
  }))

  app.post('/api/admin/cities/:cityId/layers/:layerKey/ingest-overture-roads', (request, response) => sendLayerIngestion(request, response, {
    rateKey: 'admin:layer-overture-roads-ingest',
    rateLimit: { limit: 6, windowMs: 10 * 60_000 },
    run: ingestOvertureRoadsLayer,
    error: 'CITY_LAYER_OVERTURE_ROADS_INGEST_FAILED',
  }))

  app.post('/api/admin/cities/:cityId/layers/:layerKey/register-package', (request, response) => sendLayerIngestion(request, response, {
    rateKey: 'admin:layer-package-register',
    rateLimit: { limit: 30, windowMs: 10 * 60_000 },
    run: registerProviderPackageMetadataLayer,
    error: 'CITY_LAYER_PACKAGE_REGISTER_FAILED',
  }))
}
