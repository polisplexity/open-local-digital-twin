import {
  getCityLayerCapabilities,
  runCitySemanticQuery,
} from '../db/productionTwinStore.mjs'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { buildSemanticQueryContract } from '../services/baseTwin/viewerContracts/semanticQueryContract.mjs'
import { findCityConfig, getActiveCityConfig } from '../services/cityRegistry.mjs'

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

const layerCapabilities = await getCityLayerCapabilities(city.id)
assert(layerCapabilities.ok, `LAYER_CAPABILITIES_FAILED:${layerCapabilities.error ?? 'unknown'}`)

const contract = buildSemanticQueryContract({
  cityId: city.id,
  surface: 'map',
  mode: 'embedded-analyst',
  layerCapabilities: layerCapabilities.layers ?? [],
})

for (const classKey of ['buildings', 'roads', 'greenBlue', 'accessSeeds']) {
  assert(
    contract.classes.some((semanticClass) => semanticClass.key === classKey),
    `SEMANTIC_CLASS_MISSING:${classKey}`,
  )
}

const cityQuery = await runCitySemanticQuery(city.id, {
  classes: ['buildings', 'roads'],
  scope: { key: 'city' },
  filters: [],
  render: { mode: 'isolate', maxFeatures: 50 },
  surface: 'map',
  intent: 'analysis',
  actorUserId: 'semantic-query-smoke',
})

assert(cityQuery.ok, `CITY_QUERY_FAILED:${cityQuery.error ?? 'unknown'}`)
assert(cityQuery.summary.resultCount > 0, 'CITY_QUERY_EMPTY')
assert(cityQuery.summary.returned > 0, 'CITY_QUERY_RETURNED_EMPTY')
assert(cityQuery.geojson.type === 'FeatureCollection', 'CITY_QUERY_GEOJSON_MISSING')
assert(cityQuery.geojson.features.length === cityQuery.summary.returned, 'CITY_QUERY_FEATURE_COUNT_MISMATCH')
assert(
  cityQuery.geojson.features.every((feature) => feature.properties?.semanticClass && feature.properties?.layerKey),
  'CITY_QUERY_FEATURE_SEMANTICS_MISSING',
)

const radiusQuery = await runCitySemanticQuery(city.id, {
  classes: ['buildings', 'roads', 'greenBlue', 'accessSeeds'],
  scope: {
    key: 'radius',
    center: [Number(city.lon), Number(city.lat)],
    radiusMeters: 2500,
  },
  filters: [],
  render: { mode: 'isolate', maxFeatures: 100 },
  surface: 'map',
  intent: 'analysis',
  actorUserId: 'semantic-query-smoke',
})

assert(radiusQuery.ok, `RADIUS_QUERY_FAILED:${radiusQuery.error ?? 'unknown'}`)
assert(radiusQuery.summary.resultCount > 0, 'RADIUS_QUERY_EMPTY')
assert(radiusQuery.summary.returned > 0, 'RADIUS_QUERY_RETURNED_EMPTY')
assert(radiusQuery.query.scope.key === 'radius', 'RADIUS_QUERY_SCOPE_NOT_NORMALIZED')

const roadNameQuery = await runCitySemanticQuery(city.id, {
  classes: ['roads'],
  scope: { key: 'city' },
  filters: [{ field: 'roadClass', operator: 'exists', value: true }],
  render: { mode: 'isolate', maxFeatures: 25 },
  surface: 'map',
  intent: 'analysis',
  actorUserId: 'semantic-query-smoke',
})

assert(roadNameQuery.ok, `ROAD_QUERY_FAILED:${roadNameQuery.error ?? 'unknown'}`)
assert(roadNameQuery.summary.resultCount > 0, 'ROAD_QUERY_EMPTY')

console.log(JSON.stringify({
  ok: true,
  cityId: city.id,
  contract: {
    version: contract.version,
    classes: contract.classes.map((semanticClass) => semanticClass.key),
  },
  cityQuery: {
    resultCount: cityQuery.summary.resultCount,
    returned: cityQuery.summary.returned,
    truncated: cityQuery.summary.truncated,
    countsBySemanticClass: cityQuery.summary.countsBySemanticClass,
  },
  radiusQuery: {
    resultCount: radiusQuery.summary.resultCount,
    returned: radiusQuery.summary.returned,
    truncated: radiusQuery.summary.truncated,
    countsBySemanticClass: radiusQuery.summary.countsBySemanticClass,
  },
  roadQuery: {
    resultCount: roadNameQuery.summary.resultCount,
    returned: roadNameQuery.summary.returned,
  },
}, null, 2))

await closeProductionPool()
