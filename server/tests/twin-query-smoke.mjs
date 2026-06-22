import {
  getTwinQueryContract,
  listCityTwinQueryEvents,
  runCityTwinQuery,
} from '../db/productionTwinStore.mjs'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { findCityConfig, getActiveCityConfig } from '../services/cityRegistry.mjs'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function walkCoordinates(geometry, callback) {
  if (!geometry?.coordinates) return
  const visit = (value) => {
    if (!Array.isArray(value)) return
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      callback(value)
      return
    }
    value.forEach(visit)
  }
  visit(geometry.coordinates)
}

function distanceMeters(a, b) {
  const radius = 6371008.8
  const lat1 = a[1] * Math.PI / 180
  const lat2 = b[1] * Math.PI / 180
  const dLat = (b[1] - a[1]) * Math.PI / 180
  const dLon = (b[0] - a[0]) * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function maxDistanceFromFeatures(features, center) {
  let maxDistance = 0
  features.forEach((feature) => {
    walkCoordinates(feature.geometry, (coordinate) => {
      maxDistance = Math.max(maxDistance, distanceMeters(center, coordinate))
    })
  })
  return maxDistance
}

function assertBounds(bounds, message) {
  assert(bounds, `${message}_MISSING`)
  assert(Number.isFinite(Number(bounds.minLon)), `${message}_MIN_LON_INVALID`)
  assert(Number.isFinite(Number(bounds.minLat)), `${message}_MIN_LAT_INVALID`)
  assert(Number.isFinite(Number(bounds.maxLon)), `${message}_MAX_LON_INVALID`)
  assert(Number.isFinite(Number(bounds.maxLat)), `${message}_MAX_LAT_INVALID`)
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

const contract = getTwinQueryContract()
assert(contract.languages.includes('twinql-json'), 'TWINQL_LANGUAGE_MISSING')
assert(contract.languages.includes('cql2-json'), 'CQL2_LANGUAGE_MISSING')
assert(contract.classes.includes('buildings'), 'BUILDING_CLASS_MISSING')
assert(contract.classes.includes('roads'), 'ROADS_CLASS_MISSING')
assert(contract.fields.some((field) => field.field === 'semantic_class'), 'SEMANTIC_CLASS_FIELD_MISSING')
assert(contract.fields.some((field) => field.field === 'road_class'), 'ROAD_CLASS_FIELD_MISSING')

const cityBuildingQuery = await runCityTwinQuery(city.id, {
  language: 'twinql-json',
  classes: ['buildings'],
  scope: { key: 'city' },
  render: { mode: 'isolate', maxFeatures: 25 },
  surface: 'api',
  intent: 'analysis',
  actorUserId: 'twin-query-smoke',
})

assert(cityBuildingQuery.ok, `CITY_BUILDING_QUERY_FAILED:${cityBuildingQuery.error ?? 'unknown'}`)
assert(cityBuildingQuery.summary.resultCount > 0, 'CITY_BUILDING_QUERY_EMPTY')
assert(cityBuildingQuery.summary.returned > 0, 'CITY_BUILDING_QUERY_RETURNED_EMPTY')
assert(cityBuildingQuery.geojson.type === 'FeatureCollection', 'CITY_BUILDING_GEOJSON_MISSING')
assertBounds(cityBuildingQuery.summary.bounds, 'CITY_BUILDING_QUERY_BOUNDS')
assert(
  cityBuildingQuery.geojson.features.every((feature) => feature.properties?.semanticClass === 'buildings'),
  'CITY_BUILDING_SEMANTIC_CLASS_MISMATCH',
)

const radiusRoadQuery = await runCityTwinQuery(city.id, {
  language: 'cql2-json',
  classes: ['roads'],
  scope: {
    key: 'radius',
    center: [Number(city.lon), Number(city.lat)],
    radiusMeters: 2500,
  },
  where: {
    op: 'isNotNull',
    args: [{ property: 'road_class' }],
  },
  render: { mode: 'isolate', maxFeatures: 25 },
  surface: 'map',
  intent: 'analysis',
  actorUserId: 'twin-query-smoke',
})

assert(radiusRoadQuery.ok, `RADIUS_ROAD_QUERY_FAILED:${radiusRoadQuery.error ?? 'unknown'}`)
assert(radiusRoadQuery.summary.resultCount > 0, 'RADIUS_ROAD_QUERY_EMPTY')
assert(radiusRoadQuery.summary.returned > 0, 'RADIUS_ROAD_QUERY_RETURNED_EMPTY')
assert(radiusRoadQuery.query.scope.key === 'radius', 'RADIUS_ROAD_SCOPE_NOT_NORMALIZED')
assertBounds(radiusRoadQuery.summary.bounds, 'RADIUS_ROAD_QUERY_BOUNDS')
assert(
  maxDistanceFromFeatures(radiusRoadQuery.geojson.features, radiusRoadQuery.query.scope.center) <= 2800,
  'RADIUS_ROAD_GEOMETRY_NOT_CLIPPED_TO_RADIUS',
)
assert(
  radiusRoadQuery.geojson.features.every((feature) => feature.properties?.semanticClass === 'roads'),
  'RADIUS_ROAD_SEMANTIC_CLASS_MISMATCH',
)

const countQuery = await runCityTwinQuery(city.id, {
  language: 'cql2-json',
  classes: ['buildings', 'roads', 'greenBlue'],
  scope: { key: 'city' },
  where: {
    op: 'in',
    args: [{ property: 'semantic_class' }, ['buildings', 'roads', 'greenBlue']],
  },
  render: { mode: 'count', maxFeatures: 0 },
  surface: 'api',
  intent: 'analysis',
  actorUserId: 'twin-query-smoke',
})

assert(countQuery.ok, `COUNT_QUERY_FAILED:${countQuery.error ?? 'unknown'}`)
assert(countQuery.summary.resultCount > 0, 'COUNT_QUERY_EMPTY')
assert(countQuery.summary.returned === 0, 'COUNT_QUERY_SHOULD_NOT_RETURN_FEATURES')
assert(countQuery.summary.countsBySemanticClass.buildings > 0, 'COUNT_QUERY_BUILDINGS_MISSING')
assert(countQuery.summary.countsBySemanticClass.roads > 0, 'COUNT_QUERY_ROADS_MISSING')

const compoundPredicateQuery = await runCityTwinQuery(city.id, {
  language: 'cql2-json',
  classes: ['buildings'],
  scope: {
    key: 'radius',
    center: [Number(city.lon), Number(city.lat)],
    radiusMeters: 4000,
  },
  where: {
    op: 'or',
    args: [
      { op: 'isNotNull', args: [{ property: 'height_m' }] },
      { op: 'isNotNull', args: [{ property: 'object_id' }] },
    ],
  },
  render: { mode: 'isolate', maxFeatures: 25 },
  surface: 'api',
  intent: 'analysis',
  actorUserId: 'twin-query-smoke',
})

assert(compoundPredicateQuery.ok, `COMPOUND_QUERY_FAILED:${compoundPredicateQuery.error ?? 'unknown'}`)
assert(compoundPredicateQuery.summary.resultCount > 0, 'COMPOUND_QUERY_EMPTY')
assertBounds(compoundPredicateQuery.summary.bounds, 'COMPOUND_QUERY_BOUNDS')

const multiClauseQuery = await runCityTwinQuery(city.id, {
  language: 'twinql-json',
  operation: 'union',
  clauses: [
    {
      id: 'core-buildings',
      label: 'Core buildings',
      classes: ['buildings'],
      scope: {
        key: 'radius',
        center: [Number(city.lon), Number(city.lat)],
        radiusMeters: 2500,
      },
    },
    {
      id: 'access-roads',
      label: 'Access roads',
      classes: ['roads'],
      scope: {
        key: 'radius',
        center: [Number(city.lon), Number(city.lat)],
        radiusMeters: 5000,
      },
      where: {
        field: 'road_class',
        operator: 'in',
        value: ['primary', 'secondary', 'tertiary'],
      },
    },
  ],
  render: { mode: 'isolate', maxFeatures: 50 },
  surface: 'map',
  intent: 'analysis',
  actorUserId: 'twin-query-smoke',
})

assert(multiClauseQuery.ok, `MULTI_CLAUSE_QUERY_FAILED:${multiClauseQuery.error ?? 'unknown'}`)
assert(multiClauseQuery.query.operation === 'union', 'MULTI_CLAUSE_OPERATION_NOT_NORMALIZED')
assert(multiClauseQuery.summary.resultCount > 0, 'MULTI_CLAUSE_QUERY_EMPTY')
assertBounds(multiClauseQuery.summary.bounds, 'MULTI_CLAUSE_QUERY_BOUNDS')
assert(Object.keys(multiClauseQuery.summary.countsByClause ?? {}).length > 0, 'MULTI_CLAUSE_COUNTS_MISSING')
assert(
  multiClauseQuery.geojson.features.every((feature) => feature.properties?.clauseId),
  'MULTI_CLAUSE_FEATURE_PROVENANCE_MISSING',
)

const recentQueryEvents = await listCityTwinQueryEvents(city.id, { surface: 'map', limit: 20 })
assert(recentQueryEvents.ok, `TWIN_QUERY_EVENTS_FAILED:${recentQueryEvents.error ?? 'unknown'}`)
assert(
  recentQueryEvents.events.some((event) =>
    event.actorUserId === 'twin-query-smoke' &&
    event.queryKind === 'twinql-json' &&
    Number(event.summary?.clauseCount ?? 0) >= 2,
  ),
  'TWIN_QUERY_EVENTS_DO_NOT_RECORD_MULTI_CLAUSE_RUN',
)

console.log(JSON.stringify({
  ok: true,
  cityId: city.id,
  contract: {
    version: contract.version,
    languages: contract.languages,
    classes: contract.classes,
  },
  cityBuildingQuery: {
    resultCount: cityBuildingQuery.summary.resultCount,
    returned: cityBuildingQuery.summary.returned,
    truncated: cityBuildingQuery.summary.truncated,
    countsBySemanticClass: cityBuildingQuery.summary.countsBySemanticClass,
  },
  radiusRoadQuery: {
    resultCount: radiusRoadQuery.summary.resultCount,
    returned: radiusRoadQuery.summary.returned,
    truncated: radiusRoadQuery.summary.truncated,
    countsBySemanticClass: radiusRoadQuery.summary.countsBySemanticClass,
  },
  countQuery: {
    resultCount: countQuery.summary.resultCount,
    returned: countQuery.summary.returned,
    countsBySemanticClass: countQuery.summary.countsBySemanticClass,
  },
  compoundPredicateQuery: {
    resultCount: compoundPredicateQuery.summary.resultCount,
    returned: compoundPredicateQuery.summary.returned,
    countsBySemanticClass: compoundPredicateQuery.summary.countsBySemanticClass,
  },
  multiClauseQuery: {
    resultCount: multiClauseQuery.summary.resultCount,
    returned: multiClauseQuery.summary.returned,
    countsBySemanticClass: multiClauseQuery.summary.countsBySemanticClass,
    countsByClause: multiClauseQuery.summary.countsByClause,
  },
  recentQueryEvents: {
    returned: recentQueryEvents.events.length,
    latest: recentQueryEvents.events[0]
      ? {
          queryKind: recentQueryEvents.events[0].queryKind,
          resultCount: recentQueryEvents.events[0].resultCount,
          clauseCount: recentQueryEvents.events[0].summary?.clauseCount ?? 0,
        }
      : null,
  },
}, null, 2))

await closeProductionPool()
