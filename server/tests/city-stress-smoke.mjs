import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import {
  closeProductionPool,
} from '../db/postgisPool.mjs'
import {
  getCityFeatureMvtTile,
  getTwinQueryMvtTile,
  runCityTwinQuery,
} from '../db/productionTwinStore.mjs'
import {
  findCityConfig,
  getActiveCityConfig,
} from '../services/cityRegistry.mjs'
import {
  visualTwinQueryResult,
} from '../routes/liveFeature/twinQueryHttpAdapter.mjs'

function argValue(name, fallback = '') {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : fallback
}

function positiveInt(value, fallback) {
  const parsed = Math.trunc(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function lonLatToTile(lon, lat, zoom) {
  const latRad = (lat * Math.PI) / 180
  const scale = 2 ** zoom
  return {
    z: zoom,
    x: Math.floor(((lon + 180) / 360) * scale),
    y: Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * scale),
  }
}

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index]
}

function fakeRequest(transport) {
  return {
    protocol: 'http',
    query: { transport },
    headers: {
      host: 'localhost',
    },
  }
}

function compactResult(value = {}) {
  return {
    resultCount: Number(value.summary?.resultCount ?? 0),
    returned: Number(value.summary?.returned ?? 0),
    truncated: Boolean(value.summary?.truncated),
    transport: value.transport || value.query?.render?.transport || '',
  }
}

function cityFromArgs() {
  const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID
  return cityId ? findCityConfig(cityId) : getActiveCityConfig()
}

async function timed(label, run) {
  const started = performance.now()
  try {
    const details = await run()
    return {
      label,
      ok: true,
      ms: Math.round(performance.now() - started),
      details,
    }
  } catch (error) {
    return {
      label,
      ok: false,
      ms: Math.round(performance.now() - started),
      error: String(error?.message ?? error),
    }
  }
}

async function runLimited(queue, concurrency) {
  const results = []
  let next = 0
  const workers = Array.from({ length: concurrency }, async () => {
    while (next < queue.length) {
      const index = next
      next += 1
      results[index] = await queue[index]()
    }
  })
  await Promise.all(workers)
  return results
}

async function countInventory(city, center) {
  const result = await runCityTwinQuery(city.id, {
    language: 'cql2-json',
    classes: ['buildings', 'roads', 'greenBlue', 'places', 'accessSeeds'],
    scope: { key: 'city' },
    where: {
      op: 'in',
      args: [{ property: 'semantic_class' }, ['buildings', 'roads', 'greenBlue', 'places', 'accessSeeds']],
    },
    render: { mode: 'count', maxFeatures: 0 },
    surface: 'api',
    intent: 'stress-count',
    actorUserId: 'city-stress-smoke',
    metadata: { stressCenter: center },
  })
  assert(result.ok, `COUNT_QUERY_FAILED:${result.error ?? 'unknown'}`)
  assert(Number(result.summary?.resultCount ?? 0) > 0, 'COUNT_QUERY_EMPTY')
  assert(Number(result.summary?.returned ?? 0) === 0, 'COUNT_QUERY_RETURNED_FEATURES')
  return compactResult(result)
}

async function mapMvtMetadata(city, center) {
  const result = await runCityTwinQuery(city.id, {
    language: 'twinql-json',
    classes: ['buildings', 'roads'],
    scope: {
      key: 'radius',
      center,
      radiusMeters: 5000,
    },
    render: {
      mode: 'isolate',
      transport: 'mvt',
      maxFeatures: 0,
    },
    surface: 'map',
    intent: 'stress-map-mvt',
    actorUserId: 'city-stress-smoke',
  })
  assert(result.ok, `MAP_MVT_METADATA_FAILED:${result.error ?? 'unknown'}`)
  assert(Number(result.summary?.resultCount ?? 0) > 0, 'MAP_MVT_METADATA_EMPTY')
  assert(Number(result.summary?.returned ?? 0) === 0, 'MAP_MVT_METADATA_RETURNED_FEATURES')
  return compactResult(result)
}

async function queryMvtTile(city, center, tile) {
  const result = await getTwinQueryMvtTile(city.id, {
    ...tile,
    limit: 50000,
    query: {
      language: 'cql2-json',
      classes: ['buildings', 'roads'],
      scope: {
        key: 'radius',
        center,
        radiusMeters: 5000,
      },
      where: {
        op: 'in',
        args: [{ property: 'semantic_class' }, ['buildings', 'roads']],
      },
      render: { mode: 'isolate', maxFeatures: 0 },
      surface: 'map',
      intent: 'stress-query-mvt-tile',
    },
  })
  assert(result.ok, `QUERY_MVT_TILE_FAILED:${result.error ?? 'unknown'}`)
  assert(Number(result.byteLength ?? 0) > 0, 'QUERY_MVT_TILE_EMPTY')
  assert(Number(result.summary?.tileFeatureCount ?? 0) > 0, 'QUERY_MVT_TILE_FEATURES_EMPTY')
  return {
    byteLength: result.byteLength,
    tileFeatureCount: result.summary.tileFeatureCount,
    truncatedTile: Boolean(result.summary.truncatedTile),
  }
}

async function baseMvtTile(city, center, tile) {
  const result = await getCityFeatureMvtTile(city.id, {
    ...tile,
    layers: ['buildings', 'roads'],
    center,
    radiusMeters: 5000,
    limit: 50000,
  })
  assert(result.ok, `BASE_MVT_TILE_FAILED:${result.error ?? 'unknown'}`)
  assert(Number(result.byteLength ?? 0) > 0, 'BASE_MVT_TILE_EMPTY')
  return {
    byteLength: result.byteLength,
    z: result.z,
    x: result.x,
    y: result.y,
  }
}

async function geojsonPreview(city) {
  const result = await runCityTwinQuery(city.id, {
    language: 'twinql-json',
    classes: ['buildings'],
    scope: { key: 'city' },
    render: {
      mode: 'isolate',
      transport: 'geojson',
      maxFeatures: 300000,
    },
    surface: 'api',
    intent: 'stress-geojson-preview',
    actorUserId: 'city-stress-smoke',
  })
  assert(result.ok, `GEOJSON_PREVIEW_FAILED:${result.error ?? 'unknown'}`)
  const policy = result.summary?.transportPolicy
  assert(policy?.transport === 'geojson', 'GEOJSON_PREVIEW_POLICY_MISSING')
  assert(Number(policy.effectiveMaxFeatures ?? 0) <= 20000, 'GEOJSON_PREVIEW_POLICY_CAP_TOO_HIGH')
  assert(Number(result.summary?.returned ?? 0) <= Number(policy.effectiveMaxFeatures ?? 0), 'GEOJSON_PREVIEW_OVER_LIMIT')
  return {
    ...compactResult(result),
    transportPolicy: policy,
  }
}

async function cesiumPrimitives(city, center) {
  const result = await runCityTwinQuery(city.id, {
    language: 'twinql-json',
    classes: ['buildings'],
    scope: {
      key: 'radius',
      center,
      radiusMeters: 1800,
    },
    render: {
      mode: 'isolate',
      transport: 'cesium-primitives',
      maxFeatures: 500,
    },
    surface: 'municipal3d',
    intent: 'stress-city-3d',
    actorUserId: 'city-stress-smoke',
  })
  assert(result.ok, `CESIUM_PRIMITIVES_QUERY_FAILED:${result.error ?? 'unknown'}`)
  const adapted = visualTwinQueryResult(fakeRequest('cesium-primitives'), city.id, result)
  assert(adapted.transport === 'cesium-primitives', 'CESIUM_PRIMITIVES_TRANSPORT_MISSING')
  assert(!adapted.geojson, 'CESIUM_PRIMITIVES_LEAKS_GEOJSON')
  assert(Number(adapted.primitives?.features?.length ?? 0) > 0, 'CESIUM_PRIMITIVES_EMPTY')
  return {
    ...compactResult(adapted),
    primitives: adapted.primitives.features.length,
  }
}

async function sceneManifest(city, center) {
  const result = await runCityTwinQuery(city.id, {
    language: 'twinql-json',
    classes: ['buildings'],
    scope: {
      key: 'radius',
      center,
      radiusMeters: 1800,
    },
    render: {
      mode: 'isolate',
      transport: 'scene-manifest',
      maxFeatures: 500,
    },
    surface: 'immersive',
    intent: 'stress-civic-xr',
    actorUserId: 'city-stress-smoke',
  })
  assert(result.ok, `SCENE_MANIFEST_QUERY_FAILED:${result.error ?? 'unknown'}`)
  const adapted = visualTwinQueryResult(fakeRequest('scene-manifest'), city.id, result)
  assert(adapted.transport === 'scene-manifest', 'SCENE_MANIFEST_TRANSPORT_MISSING')
  assert(!adapted.geojson, 'SCENE_MANIFEST_LEAKS_GEOJSON')
  assert(Number(adapted.sceneManifest?.objects?.length ?? 0) > 0, 'SCENE_MANIFEST_OBJECTS_EMPTY')
  return {
    ...compactResult(adapted),
    sceneObjects: adapted.sceneManifest.objects.length,
  }
}

function summarize(results) {
  const byLabel = new Map()
  results.forEach((result) => {
    const bucket = byLabel.get(result.label) ?? []
    bucket.push(result)
    byLabel.set(result.label, bucket)
  })
  return Array.from(byLabel.entries()).map(([label, items]) => {
    const durations = items.map((item) => item.ms)
    const failures = items.filter((item) => !item.ok)
    return {
      label,
      count: items.length,
      ok: failures.length === 0,
      failures: failures.length,
      minMs: Math.min(...durations),
      medianMs: percentile(durations, 50),
      p95Ms: percentile(durations, 95),
      maxMs: Math.max(...durations),
      sample: items.find((item) => item.ok)?.details ?? null,
      errors: failures.map((item) => item.error),
    }
  })
}

const city = cityFromArgs()
assert(city?.id, 'CITY_NOT_FOUND')
const center = [Number(city.lon), Number(city.lat)]
assert(Number.isFinite(center[0]) && Number.isFinite(center[1]), 'CITY_CENTER_REQUIRED')

const iterations = positiveInt(argValue('iterations'), 3)
const concurrency = positiveInt(argValue('concurrency'), 2)
const zoom = positiveInt(argValue('z'), 13)
const output = argValue('output')
const tile = lonLatToTile(center[0], center[1], zoom)

const queue = []
for (let i = 0; i < iterations; i += 1) {
  queue.push(() => timed('count-inventory', () => countInventory(city, center)))
  queue.push(() => timed('map-mvt-metadata', () => mapMvtMetadata(city, center)))
  queue.push(() => timed('query-mvt-tile', () => queryMvtTile(city, center, tile)))
  queue.push(() => timed('base-mvt-tile', () => baseMvtTile(city, center, tile)))
  queue.push(() => timed('geojson-preview', () => geojsonPreview(city)))
  queue.push(() => timed('city-3d-primitives', () => cesiumPrimitives(city, center)))
  queue.push(() => timed('civic-xr-scene-manifest', () => sceneManifest(city, center)))
}

const startedAt = new Date().toISOString()
const startedMs = performance.now()
const results = await runLimited(queue, concurrency)
const elapsedMs = Math.round(performance.now() - startedMs)
await closeProductionPool()

const payload = {
  ok: results.every((result) => result.ok),
  cityId: city.id,
  cityName: city.name,
  iterations,
  concurrency,
  center,
  tile,
  startedAt,
  elapsedMs,
  summary: summarize(results),
  failures: results.filter((result) => !result.ok),
}

if (output) {
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, `${JSON.stringify(payload, null, 2)}\n`)
}

console.log(JSON.stringify(payload, null, 2))

if (!payload.ok) {
  process.exitCode = 1
}
