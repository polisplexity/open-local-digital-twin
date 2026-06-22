import {
  acceptCityLayerAuthority,
  getLayerIngestionJob,
  listCityLayerIngestionJobs,
  listCityLayerRegistry,
  upsertCityProviderLayer,
  upsertRegisteredProvider,
} from '../db/productionTwinStore.mjs'
import { findCityConfig, getActiveCityConfig } from '../services/cityRegistry.mjs'
import { buildCityProductionPlan } from '../services/cityProductionPlanService.mjs'
import {
  enqueueProviderLayerIngestionJob,
  ingestProviderGeoJsonLayer,
  runProviderLayerIngestionJob,
} from '../services/providerLayerIngestionService.mjs'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function cityFromArgs() {
  const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
  const cityId = cityArg ? cityArg.slice('--city='.length) : process.env.TWIN_STUDIO_E2E_CITY_ID
  return cityId ? findCityConfig(cityId) : getActiveCityConfig()
}

const city = cityFromArgs()
assert(city?.id, 'CITY_NOT_FOUND')

const providerId = 'e2e-city-smoke-provider'
const geojsonLayerKey = 'e2e-smoke-geojson'
const csvLayerKey = 'e2e-smoke-csv'
const runNonce = String(Date.now())

await upsertRegisteredProvider({
  id: providerId,
  name: 'E2E City Smoke Provider',
  providerType: 'test-provider',
  metadata: {
    purpose: 'repeatable city smoke test',
  },
  connectors: [
    {
      connectorKey: 'geojson-direct',
      displayName: 'GeoJSON direct connector',
      connectorType: 'api',
      status: 'active',
      supportedFormats: ['geojson'],
      authMode: 'test',
    },
    {
      connectorKey: 'csv-queued',
      displayName: 'CSV queued connector',
      connectorType: 'api',
      status: 'active',
      supportedFormats: ['csv'],
      authMode: 'test',
    },
  ],
})

await upsertCityProviderLayer(city, {
  key: geojsonLayerKey,
  name: 'E2E smoke GeoJSON',
  layerFamily: 'test',
  geometryType: 'Point',
  authorityStatus: 'provider-supplied',
  accessLevel: 'city-private',
  providerId,
})

await upsertCityProviderLayer(city, {
  key: csvLayerKey,
  name: 'E2E smoke CSV',
  layerFamily: 'test',
  geometryType: 'Point',
  authorityStatus: 'provider-supplied',
  accessLevel: 'city-private',
  providerId,
})

const geojsonResult = await ingestProviderGeoJsonLayer(city, geojsonLayerKey, {
  sourceName: 'e2e-smoke-inline-geojson',
  sourceFormat: 'geojson',
  submittedBy: 'e2e-city-smoke',
  geojson: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          id: 'e2e-geojson-1',
          name: 'E2E GeoJSON feature',
        },
        geometry: {
          type: 'Point',
          coordinates: [Number(city.lon ?? 0), Number(city.lat ?? 0)],
        },
      },
    ],
  },
})
assert(geojsonResult.ok, `GEOJSON_INGEST_FAILED:${geojsonResult.error ?? 'unknown'}`)

const queueResult = await enqueueProviderLayerIngestionJob(city, csvLayerKey, {
  action: 'csv',
  sourceFormat: 'csv',
  sourceVersion: runNonce,
  sourceName: 'e2e-smoke-inline-csv',
  submittedBy: 'e2e-city-smoke',
  csvText: `id,name,lat,lon\ne2e-csv-1,E2E CSV feature,${Number(city.lat ?? 0)},${Number(city.lon ?? 0)}\n`,
  metadata: {
    e2e: true,
    nonce: runNonce,
  },
})
assert(queueResult.ok, `CSV_QUEUE_FAILED:${queueResult.error ?? 'unknown'}`)

const runResult = await runProviderLayerIngestionJob(queueResult.jobId, {
  workerId: 'e2e-city-smoke',
  submittedBy: 'e2e-city-smoke',
})
assert(runResult.ok, `CSV_JOB_RUN_FAILED:${runResult.error ?? 'unknown'}`)

const authorityResult = await acceptCityLayerAuthority(city, 'boundary', {
  acceptedBy: 'e2e-city-smoke',
  evidenceLabel: 'E2E smoke boundary acceptance',
  note: 'Marks the stored boundary layer as city-authoritative to verify the acceptance workflow.',
})
assert(authorityResult.ok, `AUTHORITY_ACCEPT_FAILED:${authorityResult.error ?? 'unknown'}`)

const job = await getLayerIngestionJob(queueResult.jobId)
assert(job.ok && job.job?.status === 'completed', `CSV_JOB_NOT_COMPLETED:${job.job?.status ?? job.error}`)

const registry = await listCityLayerRegistry(city.id)
const jobs = await listCityLayerIngestionJobs(city.id, 10)
const plan = await buildCityProductionPlan(city)
const geojsonLayer = registry.layers.find((layer) => layer.key === geojsonLayerKey)
const csvLayer = registry.layers.find((layer) => layer.key === csvLayerKey)

assert(Number(geojsonLayer?.featureCount ?? 0) >= 1, 'GEOJSON_FEATURE_NOT_STORED')
assert(Number(csvLayer?.featureCount ?? 0) >= 1, 'CSV_FEATURE_NOT_STORED')
assert(plan.ok, 'CITY_PRODUCTION_PLAN_NOT_OK')

console.log(JSON.stringify({
  ok: true,
  cityId: city.id,
  providerId,
  directGeoJson: {
    layerKey: geojsonLayerKey,
    featureCount: geojsonLayer.featureCount,
  },
  authorityAccepted: {
    layerKey: authorityResult.layerKey,
    authorityStatus: authorityResult.authorityStatus,
  },
  queuedCsv: {
    layerKey: csvLayerKey,
    jobId: queueResult.jobId,
    status: job.job.status,
    featureCount: csvLayer.featureCount,
  },
  productionPlan: {
    posture: plan.posture,
    tier: plan.tier,
    featureCount: plan.currentState.featureCount,
    estimatedStorageGiB: plan.storageEstimate.totalGiB,
    gaps: plan.gaps,
  },
  recentJobCount: jobs.jobs.length,
}, null, 2))
