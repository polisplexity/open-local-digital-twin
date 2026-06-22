import {
  getCityProductionStorageSummary,
  listCityLayerIngestionJobs,
  listCityLayerRegistry,
} from '../db/productionTwinStore.mjs'
import { getCityCacheStatus } from './baseTwinService.mjs'

const REQUIRED_BASE_LAYERS = [
  'boundary',
  'roads',
  'buildings',
  'facilities',
  'greenBlue',
  'places',
  'center',
]

const BASE_OPEN_DATA_SOURCES = [
  {
    key: 'osm',
    name: 'OpenStreetMap / Overpass',
    role: 'roads, buildings, amenities, green-blue geometry, places, and base spatial fabric',
    productionFlow: 'Use bounded regional extracts or controlled Overpass-compatible mirrors for full cities; use tiled Overpass only as a bootstrap path.',
  },
  {
    key: 'nominatim',
    name: 'Nominatim',
    role: 'city boundary, centroid, and geocoding anchor',
    productionFlow: 'Cache source artifacts and prefer official/city-maintained boundaries when available.',
  },
  {
    key: 'wikipedia',
    name: 'Wikipedia REST',
    role: 'public city description and municipal context seed',
    productionFlow: 'Store as source artifact and treat as descriptive context, not authoritative municipal data.',
  },
]

const PROVIDER_LAYER_CLASSES = [
  'flood maps and hydraulic risk',
  'fire and civil-protection risk',
  'satellite imagery and STAC catalogs',
  'IoT streams and HTTP/MQTT sensor feeds',
  'BIM, IFC, CityJSON, 3D Tiles, and facility models',
  'city-owned operational datasets through GeoJSON, CSV, OGC API Features, WFS, Shapefile, and GeoPackage',
]

function layerCount(layers, key) {
  return Number(layers.find((layer) => layer.key === key)?.featureCount ?? 0)
}

function estimateTier(featureCount) {
  if (featureCount >= 1_000_000) return 'large-city'
  if (featureCount >= 250_000) return 'medium-city'
  if (featureCount >= 50_000) return 'small-city'
  return 'starter-or-partial'
}

function estimateStorage(featureCount, layerCountValue) {
  const observedFeatures = Math.max(0, Number(featureCount ?? 0))
  const plannedFeatures = Math.max(observedFeatures, 100_000)
  const featureBytes = plannedFeatures * Number(process.env.TWIN_STUDIO_STORAGE_ESTIMATE_BYTES_PER_FEATURE ?? 1800)
  const indexBytes = featureBytes * 0.45
  const artifactBytes = Math.max(layerCountValue, REQUIRED_BASE_LAYERS.length) * Number(process.env.TWIN_STUDIO_STORAGE_ESTIMATE_BYTES_PER_ARTIFACT_CLASS ?? 25 * 1024 * 1024)
  const totalBytes = Math.ceil(featureBytes + indexBytes + artifactBytes)
  return {
    estimateBasis: observedFeatures > 0 ? 'observed-feature-count-with-floor' : 'starter-floor',
    plannedFeatureFloor: plannedFeatures,
    featureBytes: Math.ceil(featureBytes),
    indexBytes: Math.ceil(indexBytes),
    artifactBytes: Math.ceil(artifactBytes),
    totalBytes,
    totalGiB: Number((totalBytes / 1024 / 1024 / 1024).toFixed(2)),
    note: 'Estimate covers vector features, PostGIS indexes, and source-artifact metadata. Raster COGs, LiDAR, BIM binaries, and imagery should live in object storage and be referenced from PostGIS metadata.',
  }
}

function completeness(layers, storage = {}) {
  return REQUIRED_BASE_LAYERS.map((key) => {
    const count = key === 'boundary'
      ? Number(storage.boundaries?.count ?? storage.totals?.boundaries ?? layerCount(layers, key))
      : layerCount(layers, key)
    return {
      key,
      present: count > 0,
      featureCount: count,
    }
  })
}

function missingCapabilities(layers, jobs, storage = {}) {
  const completedJobs = jobs.filter((job) => job.status === 'completed').length
  const missingBaseLayers = completeness(layers, storage).filter((item) => !item.present).map((item) => item.key)
  const missing = []
  if (missingBaseLayers.length > 0) missing.push(`base layers incomplete: ${missingBaseLayers.join(', ')}`)
  if (completedJobs === 0) missing.push('no completed provider ingestion job recorded')
  if (!layers.some((layer) => layer.authorityStatus === 'city-authoritative')) {
    missing.push('no city-authoritative layer marked yet')
  }
  if (!layers.some((layer) => ['ifc', 'cityjson', '3d-tiles', 'bim'].some((term) => JSON.stringify(layer).toLowerCase().includes(term)))) {
    missing.push('no BIM/3D provider layer connected yet')
  }
  return missing
}

export async function buildCityProductionPlan(cityConfig) {
  const cityId = cityConfig.id
  const [storage, registry, jobsResult] = await Promise.all([
    getCityProductionStorageSummary(cityId),
    listCityLayerRegistry(cityId),
    listCityLayerIngestionJobs(cityId, 50),
  ])
  const layers = registry.layers ?? []
  const jobs = jobsResult.jobs ?? []
  const featureCount = Number(storage.totals?.features ?? layers.reduce((sum, layer) => sum + Number(layer.featureCount ?? 0), 0))
  const storageEstimate = estimateStorage(featureCount, layers.length)
  const baseCompleteness = completeness(layers, storage)
  const missing = missingCapabilities(layers, jobs, storage)

  return {
    ok: storage.ok !== false && registry.ok !== false && jobsResult.ok !== false,
    cityId,
    city: {
      id: cityConfig.id,
      name: cityConfig.name,
      country: cityConfig.country,
      region: cityConfig.region,
      lat: cityConfig.lat,
      lon: cityConfig.lon,
    },
    posture: missing.length === 0 ? 'production-ready-starter-twin' : 'production-work-in-progress',
    tier: estimateTier(featureCount),
    currentState: {
      cache: getCityCacheStatus(cityId),
      layerCount: layers.length,
      featureCount,
      sourceArtifactCount: Number(storage.totals?.sourceArtifacts ?? 0),
      recentJobCount: jobs.length,
      completedJobCount: jobs.filter((job) => job.status === 'completed').length,
    },
    baseTwin: {
      promise: 'Every city can start with an open-data base twin assembled from public spatial sources, stored in PostGIS, and extended by provider layers.',
      requiredLayers: baseCompleteness,
      openDataSources: BASE_OPEN_DATA_SOURCES,
    },
    providerExtension: {
      promise: 'External providers connect through APIs and queued ingestion jobs, then publish layers beside the open-data base without changing the core twin.',
      layerClasses: PROVIDER_LAYER_CLASSES,
      supportedNow: [
        'GeoJSON',
        'CSV points or CSV GeoJSON geometry',
        'OGC API Features / WFS GeoJSON',
        'STAC item and collection footprints',
        'CityJSON centroids',
        'Shapefile and GeoPackage native vectors through GDAL',
        'HTTP-safe package registration for COG, WMS, MQTT, HTTP JSON, sensor feeds, BIM packages, IFC, and 3D Tiles metadata',
      ],
      stillNeeded: [
        'production object-storage upload backend',
        'IFC/BIM native parser and 3D anchoring worker',
        'formal NGSI-LD/JSON-LD/DCAT federation endpoints',
        'provider-specific conformance tests',
      ],
    },
    storageEstimate,
    productionFlow: [
      'Register or import the city and boundary.',
      'Build the open-data base twin using controlled OSM/Nominatim/Wikipedia sources.',
      'Persist normalized base layers and source artifacts in PostGIS.',
      'Register city or vendor providers and layer contracts.',
      'Queue provider ingestion jobs; workers validate, transform, and write layer features.',
      'Serve the viewer from PostGIS with browser-specific feature caps, not by shrinking stored city data.',
      'Expose validated provider and city layers through stable APIs for public, municipal, and cockpit views.',
    ],
    gaps: missing,
    storage,
    registry,
    jobs: jobsResult,
  }
}
