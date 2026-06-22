import { runCityTwinQuery } from '../db/productionTwinStore.mjs'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { findCityConfig, getActiveCityConfig } from '../services/cityRegistry.mjs'
import { visualTwinQueryResult } from '../routes/liveFeature/twinQueryHttpAdapter.mjs'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
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

const city = cityFromArgs()
assert(city?.id, 'CITY_NOT_FOUND')

const center = [Number(city.lon), Number(city.lat)]
assert(center.every(Number.isFinite), 'CITY_CENTER_MISSING')

try {
  const queryResult = await runCityTwinQuery(city.id, {
    language: 'twinql-json',
    operation: 'union',
    clauses: [
      {
        id: 'civic-xr-buildings',
        label: 'Civic XR buildings',
        classes: ['buildings'],
        scope: {
          key: 'radius',
          center,
          radiusMeters: 1800,
        },
      },
      {
        id: 'civic-xr-roads',
        label: 'Civic XR roads',
        classes: ['roads'],
        scope: {
          key: 'radius',
          center,
          radiusMeters: 2200,
        },
      },
    ],
    render: {
      mode: 'isolate',
      transport: 'scene-manifest',
      maxFeatures: 120,
    },
    surface: 'immersive',
    intent: 'embed',
    actorUserId: 'civic-xr-scene-manifest-smoke',
  })

  assert(queryResult.ok, `CIVIC_XR_QUERY_FAILED:${queryResult.error ?? 'unknown'}`)
  assert(queryResult.geojson?.features?.length > 0, 'CIVIC_XR_QUERY_GEOJSON_SOURCE_EMPTY')

  const responsePayload = visualTwinQueryResult({
    headers: {
      host: '127.0.0.1:4192',
    },
    query: {},
  }, city.id, queryResult)

  const manifest = responsePayload.sceneManifest
  assert(responsePayload.transport === 'scene-manifest', 'CIVIC_XR_TRANSPORT_NOT_SCENE_MANIFEST')
  assert(!responsePayload.geojson, 'CIVIC_XR_SCENE_MANIFEST_LEAKS_GEOJSON')
  assert(manifest?.kind === 'twin-query-scene-manifest', 'CIVIC_XR_SCENE_MANIFEST_KIND_MISSING')
  assert(manifest.version === '2026-06-04', 'CIVIC_XR_SCENE_MANIFEST_VERSION_MISMATCH')
  assert(manifest.schemaVersion === 1, 'CIVIC_XR_SCENE_MANIFEST_SCHEMA_MISSING')
  assert(manifest.cityId === city.id, 'CIVIC_XR_SCENE_MANIFEST_CITY_MISMATCH')
  assert(Array.isArray(manifest.objects), 'CIVIC_XR_SCENE_MANIFEST_OBJECTS_MISSING')
  assert(manifest.objects.length > 0, 'CIVIC_XR_SCENE_MANIFEST_OBJECTS_EMPTY')
  assert(manifest.objects.length === queryResult.geojson.features.length, 'CIVIC_XR_SCENE_MANIFEST_OBJECT_COUNT_MISMATCH')
  assert(manifest.layers && typeof manifest.layers === 'object', 'CIVIC_XR_SCENE_MANIFEST_LAYERS_MISSING')
  assert(manifest.materials?.buildings && manifest.materials?.roads, 'CIVIC_XR_SCENE_MANIFEST_MATERIALS_MISSING')
  assert(manifest.renderContract?.schemaVersion === 1, 'CIVIC_XR_SCENE_MANIFEST_RENDER_CONTRACT_SCHEMA_MISSING')
  assert(manifest.renderContract?.objectRenderStyle === 'civic-xr-building-v1', 'CIVIC_XR_SCENE_MANIFEST_RENDER_CONTRACT_STYLE_MISSING')
  assert(
    ['walk', 'compare', 'overlay'].every((mode) => manifest.renderContract?.modePolicies?.includes(mode)),
    'CIVIC_XR_SCENE_MANIFEST_RENDER_CONTRACT_MODE_POLICIES_MISSING',
  )
  assert(manifest.sampling?.returnedObjects === manifest.objects.length, 'CIVIC_XR_SCENE_MANIFEST_SAMPLING_MISMATCH')
  assert(manifest.bounds, 'CIVIC_XR_SCENE_MANIFEST_BOUNDS_MISSING')
  assert(
    manifest.objects.every((object) =>
      object.id &&
      object.layerKey &&
      object.semanticClass &&
      object.geometry?.kind &&
      Array.isArray(object.geometry.coordinates)),
    'CIVIC_XR_SCENE_MANIFEST_OBJECT_CONTRACT_INVALID',
  )
  const buildingObject = manifest.objects.find((object) => object.layerKey === 'buildings')
  assert(buildingObject, 'CIVIC_XR_SCENE_MANIFEST_BUILDING_OBJECT_MISSING')
  assert(buildingObject.render?.renderStyle?.schemaVersion === 1, 'CIVIC_XR_SCENE_MANIFEST_BUILDING_RENDER_STYLE_SCHEMA_MISSING')
  assert(buildingObject.render?.renderStyle?.visualIntent === 'building-facade', 'CIVIC_XR_SCENE_MANIFEST_BUILDING_RENDER_STYLE_INTENT_MISMATCH')
  ;['heightMeters', 'floors', 'footprintAreaM2', 'buildingType', 'provider', 'sourceFamily', 'confidence', 'semanticClass'].forEach((field) => {
    assert(Object.hasOwn(buildingObject.render.renderStyle, field), `CIVIC_XR_SCENE_MANIFEST_BUILDING_RENDER_STYLE_FIELD_MISSING:${field}`)
  })
  assert(
    manifest.objects.every((object) => object.clauseId),
    'CIVIC_XR_SCENE_MANIFEST_OBJECT_CLAUSE_PROVENANCE_MISSING',
  )
  assert(
    manifest.summary?.countsByClause?.['civic-xr-buildings'] &&
      manifest.summary?.countsByClause?.['civic-xr-roads'],
    'CIVIC_XR_SCENE_MANIFEST_SUMMARY_CLAUSE_PROVENANCE_MISSING',
  )

  const roadQueryResult = await runCityTwinQuery(city.id, {
    language: 'twinql-json',
    operation: 'union',
    clauses: [
      {
        id: 'civic-xr-roads-only',
        label: 'Civic XR roads only',
        classes: ['roads'],
        scope: {
          key: 'radius',
          center,
          radiusMeters: 900,
        },
      },
    ],
    render: {
      mode: 'isolate',
      transport: 'scene-manifest',
      maxFeatures: 24,
    },
    surface: 'immersive',
    intent: 'embed',
    actorUserId: 'civic-xr-scene-manifest-smoke',
  })
  assert(roadQueryResult.ok, `CIVIC_XR_ROAD_QUERY_FAILED:${roadQueryResult.error ?? 'unknown'}`)
  const roadManifest = visualTwinQueryResult({
    headers: {
      host: '127.0.0.1:4192',
    },
    query: {},
  }, city.id, roadQueryResult).sceneManifest
  const roadObject = roadManifest.objects.find((object) => object.layerKey === 'roads')
  assert(roadObject, 'CIVIC_XR_SCENE_MANIFEST_ROAD_OBJECT_MISSING')
  assert(roadObject.render?.renderStyle?.schemaVersion === 1, 'CIVIC_XR_SCENE_MANIFEST_ROAD_RENDER_STYLE_SCHEMA_MISSING')
  assert(roadObject.render?.renderStyle?.visualIntent === 'semantic-object', 'CIVIC_XR_SCENE_MANIFEST_ROAD_RENDER_STYLE_INTENT_MISMATCH')

  console.log(JSON.stringify({
    ok: true,
    cityId: city.id,
    transport: responsePayload.transport,
    resultCount: queryResult.summary.resultCount,
    objects: manifest.objects.length,
    layers: Object.keys(manifest.layers),
    truncated: manifest.sampling.truncated,
    roadObjects: roadManifest.objects.length,
  }, null, 2))
} finally {
  await closeProductionPool()
}
