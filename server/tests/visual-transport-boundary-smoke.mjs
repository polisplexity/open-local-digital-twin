import {
  runCityTwinQuery,
} from '../db/productionTwinStore.mjs'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { visualTwinQueryResult } from '../routes/liveFeature/twinQueryHttpAdapter.mjs'
import { findCityConfig, getActiveCityConfig } from '../services/cityRegistry.mjs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function cityFromArgs() {
  const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID
  return cityId ? findCityConfig(cityId) : getActiveCityConfig()
}

function requestStub(transport = '') {
  return {
    headers: { host: '127.0.0.1:4192' },
    protocol: 'http',
    query: transport ? { transport } : {},
  }
}

function assertNoGeojsonPayload(payload, label) {
  assert(payload && typeof payload === 'object', `${label}_PAYLOAD_MISSING`)
  assert(payload.geojson === undefined, `${label}_LEAKED_GEOJSON`)
  assert(payload.summary?.transportPolicy?.transport !== 'geojson', `${label}_GEOJSON_POLICY_LEAKED`)
}

function assertGeojsonPreviewPayload(payload, label) {
  assert(payload?.transport === 'geojson', `${label}_TRANSPORT_INVALID`)
  assert(payload.geojson?.type === 'FeatureCollection', `${label}_GEOJSON_MISSING`)
  assert(Array.isArray(payload.geojson.features), `${label}_GEOJSON_FEATURES_INVALID`)
  assert(payload.summary?.transportPolicy?.transport === 'geojson', `${label}_POLICY_MISSING`)
  assert(payload.summary.transportPolicy.mode === 'preview', `${label}_POLICY_MODE_INVALID`)
  assert(
    Array.isArray(payload.summary.transportPolicy.recommendedTransports) &&
      payload.summary.transportPolicy.recommendedTransports.includes('mvt'),
    `${label}_RECOMMENDED_TRANSPORTS_MISSING`,
  )
}

async function runQuery(cityId, query, label) {
  const result = await runCityTwinQuery(cityId, {
    language: 'twinql-json',
    actorUserId: 'visual-transport-boundary-smoke',
    ...query,
  })
  assert(result.ok, `${label}_QUERY_FAILED:${result.error ?? 'unknown'}`)
  return result
}

const city = cityFromArgs()
assert(city?.id, 'CITY_NOT_FOUND')
const center = [Number(city.lon), Number(city.lat)]
assert(center.every(Number.isFinite), 'CITY_CENTER_MISSING')

try {
  const mapQuery = await runQuery(city.id, {
    classes: ['buildings'],
    scope: { key: 'city' },
    render: { mode: 'isolate', transport: 'mvt', maxFeatures: 5000 },
    surface: 'map',
    intent: 'analysis',
  }, 'MAP_MVT')
  const mapPayload = visualTwinQueryResult(requestStub('mvt'), city.id, mapQuery)
  assert(mapPayload.transport === 'mvt', 'MAP_MVT_TRANSPORT_INVALID')
  assertNoGeojsonPayload(mapPayload, 'MAP_MVT')
  assert(mapPayload.links?.vectorTileTemplate?.includes('.mvt'), 'MAP_MVT_TILE_TEMPLATE_MISSING')

  const city3dQuery = await runQuery(city.id, {
    classes: ['buildings'],
    scope: { key: 'city' },
    render: { mode: 'highlight', transport: 'selection-reference', maxFeatures: 0 },
    surface: 'municipal3d',
    intent: 'analysis',
  }, 'CITY_3D_SELECTION_REFERENCE')
  const city3dPayload = visualTwinQueryResult(requestStub('selection-reference'), city.id, city3dQuery)
  assert(city3dPayload.transport === 'selection-reference', 'CITY_3D_SELECTION_REFERENCE_TRANSPORT_INVALID')
  assertNoGeojsonPayload(city3dPayload, 'CITY_3D_SELECTION_REFERENCE')
  assert(city3dPayload.selectionReference?.queryHash, 'CITY_3D_SELECTION_REFERENCE_QUERY_HASH_MISSING')
  assert(city3dPayload.links?.threeDTilesets, 'CITY_3D_SELECTION_REFERENCE_3D_TILESETS_LINK_MISSING')

  const city3dPreviewQuery = await runQuery(city.id, {
    classes: ['buildings'],
    scope: { key: 'radius', center, radiusMeters: 1600 },
    render: { mode: 'isolate', transport: 'cesium-primitives', maxFeatures: 120 },
    surface: 'municipal3d',
    intent: 'analysis',
  }, 'CITY_3D_PRIMITIVES_PREVIEW')
  const city3dPreviewPayload = visualTwinQueryResult(requestStub('cesium-primitives'), city.id, city3dPreviewQuery)
  assert(city3dPreviewPayload.transport === 'cesium-primitives', 'CITY_3D_PRIMITIVES_PREVIEW_TRANSPORT_INVALID')
  assertNoGeojsonPayload(city3dPreviewPayload, 'CITY_3D_PRIMITIVES_PREVIEW')
  assert(Array.isArray(city3dPreviewPayload.primitives?.features), 'CITY_3D_PRIMITIVES_PREVIEW_FEATURES_MISSING')
  assert(city3dPreviewPayload.primitives.features.length > 0, 'CITY_3D_PRIMITIVES_PREVIEW_FEATURES_EMPTY')

  const xrQuery = await runQuery(city.id, {
    operation: 'union',
    clauses: [
      {
        id: 'xr-buildings',
        label: 'XR buildings',
        classes: ['buildings'],
        scope: { key: 'radius', center, radiusMeters: 1600 },
      },
      {
        id: 'xr-roads',
        label: 'XR roads',
        classes: ['roads'],
        scope: { key: 'radius', center, radiusMeters: 1800 },
      },
    ],
    render: { mode: 'isolate', transport: 'scene-manifest', maxFeatures: 120 },
    surface: 'immersive',
    intent: 'embed',
  }, 'CIVIC_XR_SCENE_MANIFEST')
  const xrPayload = visualTwinQueryResult(requestStub('scene-manifest'), city.id, xrQuery)
  assert(xrPayload.transport === 'scene-manifest', 'CIVIC_XR_SCENE_MANIFEST_TRANSPORT_INVALID')
  assertNoGeojsonPayload(xrPayload, 'CIVIC_XR_SCENE_MANIFEST')
  assert(Array.isArray(xrPayload.sceneManifest?.objects), 'CIVIC_XR_SCENE_MANIFEST_OBJECTS_MISSING')
  assert(xrPayload.sceneManifest.objects.length > 0, 'CIVIC_XR_SCENE_MANIFEST_OBJECTS_EMPTY')

  const referenceQuery = await runQuery(city.id, {
    classes: ['buildings'],
    scope: { key: 'city' },
    render: { mode: 'highlight', transport: 'selection-reference', maxFeatures: 300000 },
    surface: 'municipal3d',
    intent: 'analysis',
  }, 'SELECTION_REFERENCE')
  const referencePayload = visualTwinQueryResult(requestStub('selection-reference'), city.id, referenceQuery)
  assert(referencePayload.transport === 'selection-reference', 'SELECTION_REFERENCE_TRANSPORT_INVALID')
  assertNoGeojsonPayload(referencePayload, 'SELECTION_REFERENCE')
  assert(referencePayload.selectionReference?.queryHash, 'SELECTION_REFERENCE_QUERY_HASH_MISSING')
  assert(referencePayload.links?.threeDTilesets, 'SELECTION_REFERENCE_3D_TILESETS_LINK_MISSING')

  const geojsonQuery = await runQuery(city.id, {
    classes: ['buildings'],
    scope: { key: 'radius', center, radiusMeters: 900 },
    render: { mode: 'isolate', transport: 'geojson', maxFeatures: 80 },
    surface: 'map',
    intent: 'analysis',
  }, 'EXPLICIT_GEOJSON_PREVIEW')
  const geojsonPayload = visualTwinQueryResult(requestStub('geojson'), city.id, geojsonQuery)
  assertGeojsonPreviewPayload(geojsonPayload, 'EXPLICIT_GEOJSON_PREVIEW')

  console.log(JSON.stringify({
    ok: true,
    cityId: city.id,
    checked: [
      {
        viewer: 'map',
        transport: mapPayload.transport,
        vectorTileTemplate: Boolean(mapPayload.links?.vectorTileTemplate),
        geojsonPayload: Boolean(mapPayload.geojson),
      },
      {
        viewer: 'city-3d',
        transport: city3dPayload.transport,
        featurePayload: Boolean(city3dPayload.geojson || city3dPayload.primitives),
        threeDTilesets: Boolean(city3dPayload.links?.threeDTilesets),
        geojsonPayload: Boolean(city3dPayload.geojson),
      },
      {
        viewer: 'city-3d-preview-compat',
        transport: city3dPreviewPayload.transport,
        primitives: city3dPreviewPayload.primitives.features.length,
        geojsonPayload: Boolean(city3dPreviewPayload.geojson),
      },
      {
        viewer: 'civic-xr',
        transport: xrPayload.transport,
        objects: xrPayload.sceneManifest.objects.length,
        geojsonPayload: Boolean(xrPayload.geojson),
      },
      {
        viewer: 'city-3d-selection-reference',
        transport: referencePayload.transport,
        featurePayload: Boolean(referencePayload.geojson),
      },
      {
        viewer: 'explicit-preview',
        transport: geojsonPayload.transport,
        previewFeatures: geojsonPayload.geojson.features.length,
      },
    ],
  }, null, 2))
} finally {
  await closeProductionPool()
}
