import {
  getTwinQueryContract,
  getTwinQueryMvtTile,
  listCityTwinQueryEvents,
  runCityTwinQuery,
} from '../db/productionTwinStore.mjs'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { visualTwinQueryResult } from '../routes/liveFeature/twinQueryHttpAdapter.mjs'
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
assert(contract.languages.includes('postgis-sql'), 'POSTGIS_SQL_LANGUAGE_MISSING')
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

const expertSqlQuery = await runCityTwinQuery(city.id, {
  language: 'postgis-sql',
  classes: ['buildings', 'roads', 'greenBlue', 'places', 'accessSeeds', 'semanticPackOutputs', 'providerOverlays'],
  scope: { key: 'city' },
  sqlWhere: "semantic_class = 'buildings' AND ST_Area(co.geom::geography) > 150",
  render: { mode: 'isolate', maxFeatures: 25 },
  surface: 'api',
  intent: 'analysis',
  actorUserId: 'twin-query-smoke',
})

assert(expertSqlQuery.ok, `EXPERT_SQL_QUERY_FAILED:${expertSqlQuery.error ?? 'unknown'}`)
assert(expertSqlQuery.summary.resultCount > 0, 'EXPERT_SQL_QUERY_EMPTY')
assert(expertSqlQuery.summary.returned > 0, 'EXPERT_SQL_QUERY_RETURNED_EMPTY')
assert(
  expertSqlQuery.geojson.features.every((feature) => feature.properties?.semanticClass === 'buildings'),
  'EXPERT_SQL_SEMANTIC_CLASS_MISMATCH',
)
assert(expertSqlQuery.query.language === 'postgis-sql', 'EXPERT_SQL_LANGUAGE_NOT_NORMALIZED')
assert(
  expertSqlQuery.query.sqlWhere.includes('ST_Area(co.geom::geography)'),
  'EXPERT_SQL_WHERE_NOT_PRESERVED',
)

const expertCitySqlSelectQuery = await runCityTwinQuery(city.id, {
  language: 'postgis-sql',
  sqlText: `
    SELECT
      city_id,
      object_id,
      entity_type,
      display_layer_key,
      semantic_class,
      label,
      authority_status,
      confidence,
      source_coverage_status,
      provider,
      model_enrichments,
      geom
    FROM ldt_query.city_objects_enriched
    WHERE semantic_class = 'roads'
    ORDER BY object_id
  `,
  render: { mode: 'isolate', transport: 'mvt', maxFeatures: 12 },
  surface: 'map',
  intent: 'analysis',
  actorUserId: 'twin-query-smoke',
})

assert(expertCitySqlSelectQuery.ok, `EXPERT_CITY_SQL_SELECT_FAILED:${expertCitySqlSelectQuery.error ?? 'unknown'}`)
assert(expertCitySqlSelectQuery.query.sqlMode === 'select', 'EXPERT_CITY_SQL_SELECT_MODE_MISSING')
assert(expertCitySqlSelectQuery.query.sqlText.includes('ldt_query.city_objects_enriched'), 'EXPERT_CITY_SQL_SELECT_NOT_PRESERVED')
assert(expertCitySqlSelectQuery.summary.resultCount > 0, 'EXPERT_CITY_SQL_SELECT_EMPTY')
assert(expertCitySqlSelectQuery.transport === 'mvt', 'EXPERT_CITY_SQL_SELECT_TRANSPORT_INVALID')
assert(expertCitySqlSelectQuery.summary.returnedFeatures === 0, 'EXPERT_CITY_SQL_SELECT_SHOULD_NOT_RETURN_GEOJSON_FEATURES')
assert(expertCitySqlSelectQuery.geojson.features.length === 0, 'EXPERT_CITY_SQL_SELECT_SHOULD_NOT_RETURN_GEOJSON')
assert(expertCitySqlSelectQuery.summary.countsBySemanticClass.roads > 0, 'EXPERT_CITY_SQL_SELECT_ROADS_MISSING')
assertBounds(expertCitySqlSelectQuery.summary.bounds, 'EXPERT_CITY_SQL_SELECT_BOUNDS')

const adaptedExpertCitySqlSelect = visualTwinQueryResult({
  headers: { host: 'localhost' },
  protocol: 'http',
  query: {},
}, city.id, expertCitySqlSelectQuery)
assert(adaptedExpertCitySqlSelect.transport === 'mvt', 'EXPERT_CITY_SQL_SELECT_ADAPTER_TRANSPORT_INVALID')
assert(adaptedExpertCitySqlSelect.links?.vectorTileTemplate?.includes('/twin-query-tiles/'), 'EXPERT_CITY_SQL_SELECT_MVT_TEMPLATE_MISSING')
assert(!adaptedExpertCitySqlSelect.geojson, 'EXPERT_CITY_SQL_SELECT_ADAPTER_LEAKED_GEOJSON')

const expertCitySqlSelectTile = await getTwinQueryMvtTile(city.id, {
  query: expertCitySqlSelectQuery.query,
  z: 13,
  x: 1789,
  y: 3612,
  limit: 5000,
})
assert(expertCitySqlSelectTile.ok, `EXPERT_CITY_SQL_SELECT_TILE_FAILED:${expertCitySqlSelectTile.error ?? 'unknown'}`)
assert(expertCitySqlSelectTile.byteLength > 0, 'EXPERT_CITY_SQL_SELECT_TILE_EMPTY')

const expertCitySqlTableQuery = await runCityTwinQuery(city.id, {
  language: 'postgis-sql',
  sqlText: `
    SELECT
      city_id,
      semantic_class,
      count(*)::int AS object_count
    FROM ldt_query.city_objects_enriched
    GROUP BY city_id, semantic_class
    ORDER BY object_count DESC
  `,
  render: { mode: 'isolate', maxFeatures: 8 },
  surface: 'api',
  intent: 'analysis',
  actorUserId: 'twin-query-smoke',
})

assert(expertCitySqlTableQuery.ok, `EXPERT_CITY_SQL_TABLE_FAILED:${expertCitySqlTableQuery.error ?? 'unknown'}`)
assert(expertCitySqlTableQuery.transport === 'table', 'EXPERT_CITY_SQL_TABLE_TRANSPORT_INVALID')
assert(expertCitySqlTableQuery.summary.returnedRows > 0, 'EXPERT_CITY_SQL_TABLE_ROWS_EMPTY')
assert(expertCitySqlTableQuery.geojson.features.length === 0, 'EXPERT_CITY_SQL_TABLE_SHOULD_NOT_RETURN_FEATURES')
assert(expertCitySqlTableQuery.table?.columns.includes('object_count'), 'EXPERT_CITY_SQL_TABLE_COLUMNS_MISSING')

const expertSqlMvtQuery = await runCityTwinQuery(city.id, {
  language: 'postgis-sql',
  classes: ['buildings', 'roads', 'greenBlue', 'places', 'accessSeeds', 'semanticPackOutputs', 'providerOverlays'],
  scope: { key: 'city' },
  sqlWhere: "semantic_class = 'buildings' AND ST_Area(co.geom::geography) > 150",
  render: { mode: 'isolate', transport: 'mvt', maxFeatures: 5000 },
  surface: 'map',
  intent: 'analysis',
  actorUserId: 'twin-query-smoke',
})
assert(expertSqlMvtQuery.ok, `EXPERT_SQL_MVT_QUERY_FAILED:${expertSqlMvtQuery.error ?? 'unknown'}`)
assert(expertSqlMvtQuery.summary.countsBySemanticClass.buildings > 0, 'EXPERT_SQL_MVT_BUILDINGS_MISSING')
assert(!expertSqlMvtQuery.summary.countsBySemanticClass.roads, 'EXPERT_SQL_MVT_SHOULD_NOT_COUNT_ROADS')
const adaptedExpertSqlMvt = visualTwinQueryResult({
  headers: { host: 'localhost' },
  protocol: 'http',
  query: {},
}, city.id, expertSqlMvtQuery)
assert(adaptedExpertSqlMvt.transport === 'mvt', 'EXPERT_SQL_MVT_ADAPTER_TRANSPORT_INVALID')
assert(adaptedExpertSqlMvt.links?.vectorTileTemplate, 'EXPERT_SQL_MVT_TILE_TEMPLATE_MISSING')
assert(
  adaptedExpertSqlMvt.links.vectorTileTemplate.includes('/twin-query-tiles/'),
  'EXPERT_SQL_MVT_SHOULD_USE_QUERY_TILES',
)
assert(
  !adaptedExpertSqlMvt.links.vectorTileTemplate.includes('/cached-tiles/'),
  'EXPERT_SQL_MVT_SHOULD_NOT_USE_CACHED_TILES',
)

let unsafeSqlError = ''
try {
  await runCityTwinQuery(city.id, {
    language: 'postgis-sql',
    classes: ['buildings'],
    scope: { key: 'city' },
    sqlWhere: 'DELETE FROM ldt_query.city_objects',
    render: { mode: 'count', maxFeatures: 0 },
    surface: 'api',
    intent: 'analysis',
    actorUserId: 'twin-query-smoke',
  })
} catch (error) {
  unsafeSqlError = String(error?.message ?? error)
}
assert(unsafeSqlError.includes('POSTGIS_SQL_WHERE_UNSAFE_TOKEN'), 'UNSAFE_POSTGIS_SQL_SHOULD_FAIL')

let unsafeCitySqlError = ''
try {
  await runCityTwinQuery(city.id, {
    language: 'postgis-sql',
    sqlText: 'SELECT oid AS city_id FROM pg_catalog.pg_class',
    render: { mode: 'count', maxFeatures: 0 },
    surface: 'api',
    intent: 'analysis',
    actorUserId: 'twin-query-smoke',
  })
} catch (error) {
  unsafeCitySqlError = String(error?.message ?? error)
}
assert(
  unsafeCitySqlError.includes('POSTGIS_SQL_TEXT_UNSAFE_TOKEN') ||
    unsafeCitySqlError.includes('POSTGIS_SQL_SCHEMA_NOT_ALLOWED:pg_catalog'),
  'UNSAFE_POSTGIS_SELECT_SQL_SHOULD_FAIL',
)

const geojsonPreviewQuery = await runCityTwinQuery(city.id, {
  language: 'twinql-json',
  classes: ['buildings'],
  scope: { key: 'city' },
  render: { mode: 'isolate', maxFeatures: 300000 },
  surface: 'api',
  intent: 'analysis',
  actorUserId: 'twin-query-smoke',
})

assert(geojsonPreviewQuery.ok, `GEOJSON_PREVIEW_QUERY_FAILED:${geojsonPreviewQuery.error ?? 'unknown'}`)
const geojsonPolicy = geojsonPreviewQuery.summary.transportPolicy
assert(geojsonPolicy?.transport === 'geojson', 'GEOJSON_PREVIEW_POLICY_MISSING')
assert(geojsonPolicy.mode === 'preview', 'GEOJSON_PREVIEW_POLICY_MODE_INVALID')
assert(geojsonPolicy.limitApplied === true, 'GEOJSON_PREVIEW_LIMIT_NOT_APPLIED')
assert(geojsonPolicy.effectiveMaxFeatures < geojsonPolicy.requestedMaxFeatures, 'GEOJSON_PREVIEW_EFFECTIVE_LIMIT_INVALID')
assert(geojsonPreviewQuery.summary.returned <= geojsonPolicy.effectiveMaxFeatures, 'GEOJSON_PREVIEW_RETURNED_OVER_LIMIT')
assert(
  typeof geojsonPolicy.warning === 'string' && geojsonPolicy.warning.includes('GeoJSON preview limited'),
  'GEOJSON_PREVIEW_WARNING_MISSING',
)
if (geojsonPreviewQuery.summary.resultCount > geojsonPolicy.effectiveMaxFeatures) {
  assert(geojsonPreviewQuery.summary.truncated === true, 'GEOJSON_PREVIEW_SHOULD_BE_TRUNCATED')
}

const selectionReferenceQuery = await runCityTwinQuery(city.id, {
  language: 'twinql-json',
  classes: ['buildings'],
  scope: { key: 'city' },
  render: { mode: 'highlight', transport: 'selection-reference', maxFeatures: 300000 },
  surface: 'municipal3d',
  intent: 'analysis',
  actorUserId: 'twin-query-smoke',
})

assert(selectionReferenceQuery.ok, `SELECTION_REFERENCE_QUERY_FAILED:${selectionReferenceQuery.error ?? 'unknown'}`)
assert(selectionReferenceQuery.summary.resultCount > 0, 'SELECTION_REFERENCE_QUERY_EMPTY')
assert(selectionReferenceQuery.summary.returned === 0, 'SELECTION_REFERENCE_SHOULD_NOT_RETURN_FEATURES')
assert(selectionReferenceQuery.geojson.features.length === 0, 'SELECTION_REFERENCE_GEOJSON_SHOULD_BE_EMPTY')
assert(selectionReferenceQuery.selectionReference?.kind === 'twin-query-selection-reference', 'SELECTION_REFERENCE_KIND_MISSING')
assert(selectionReferenceQuery.selectionReference?.queryHash, 'SELECTION_REFERENCE_QUERY_HASH_MISSING')
assert(selectionReferenceQuery.selectionReference?.artifacts?.threeDTilesets?.href, 'SELECTION_REFERENCE_3D_TILESET_LINK_MISSING')
assert(
  selectionReferenceQuery.summary.transportPolicy?.transport === 'selection-reference',
  'SELECTION_REFERENCE_POLICY_MISSING',
)
assert(
  selectionReferenceQuery.summary.transportPolicy?.featurePayload === false,
  'SELECTION_REFERENCE_POLICY_SHOULD_DISABLE_FEATURE_PAYLOAD',
)
const adaptedSelectionReference = visualTwinQueryResult({
  headers: { host: 'localhost' },
  protocol: 'http',
  query: { transport: 'selection-reference' },
}, city.id, selectionReferenceQuery)
assert(adaptedSelectionReference.transport === 'selection-reference', 'SELECTION_REFERENCE_ADAPTER_TRANSPORT_INVALID')
assert(!adaptedSelectionReference.geojson, 'SELECTION_REFERENCE_ADAPTER_LEAKED_GEOJSON')
assert(adaptedSelectionReference.selectionReference?.queryHash, 'SELECTION_REFERENCE_ADAPTER_QUERY_HASH_MISSING')
assert(adaptedSelectionReference.links?.threeDTilesets, 'SELECTION_REFERENCE_ADAPTER_3D_TILESET_LINK_MISSING')

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

const canonicalClassQuery = await runCityTwinQuery(city.id, {
  language: 'cql2-json',
  classes: ['builtFabric', 'mobilityNetwork'],
  scope: { key: 'city' },
  where: {
    op: 'in',
    args: [{ property: 'semantic_class' }, ['builtFabric', 'mobilityNetwork']],
  },
  render: { mode: 'count', maxFeatures: 0 },
  surface: 'api',
  intent: 'analysis',
  actorUserId: 'twin-query-smoke',
})

assert(canonicalClassQuery.ok, `CANONICAL_CLASS_QUERY_FAILED:${canonicalClassQuery.error ?? 'unknown'}`)
assert(
  JSON.stringify(canonicalClassQuery.query.classes) === JSON.stringify(['buildings', 'roads']),
  'CANONICAL_CLASS_QUERY_NOT_RUNTIME_NORMALIZED',
)
assert(canonicalClassQuery.summary.resultCount > 0, 'CANONICAL_CLASS_QUERY_EMPTY')
assert(canonicalClassQuery.summary.countsBySemanticClass.buildings > 0, 'CANONICAL_CLASS_QUERY_BUILDINGS_MISSING')
assert(canonicalClassQuery.summary.countsBySemanticClass.roads > 0, 'CANONICAL_CLASS_QUERY_ROADS_MISSING')

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
  expertSqlQuery: {
    resultCount: expertSqlQuery.summary.resultCount,
    returned: expertSqlQuery.summary.returned,
    truncated: expertSqlQuery.summary.truncated,
    sqlWhere: expertSqlQuery.query.sqlWhere,
  },
  expertSqlMvtQuery: {
    resultCount: expertSqlMvtQuery.summary.resultCount,
    returned: expertSqlMvtQuery.summary.returned,
    countsBySemanticClass: expertSqlMvtQuery.summary.countsBySemanticClass,
    vectorTileTemplate: adaptedExpertSqlMvt.links?.vectorTileTemplate,
  },
  unsafeSqlQuery: {
    rejected: Boolean(unsafeSqlError),
    error: unsafeSqlError,
  },
  geojsonPreviewQuery: {
    resultCount: geojsonPreviewQuery.summary.resultCount,
    returned: geojsonPreviewQuery.summary.returned,
    truncated: geojsonPreviewQuery.summary.truncated,
    transportPolicy: geojsonPreviewQuery.summary.transportPolicy,
  },
  selectionReferenceQuery: {
    resultCount: selectionReferenceQuery.summary.resultCount,
    returned: selectionReferenceQuery.summary.returned,
    queryHash: selectionReferenceQuery.selectionReference?.queryHash,
    transportPolicy: selectionReferenceQuery.summary.transportPolicy,
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
  canonicalClassQuery: {
    resultCount: canonicalClassQuery.summary.resultCount,
    normalizedClasses: canonicalClassQuery.query.classes,
    countsBySemanticClass: canonicalClassQuery.summary.countsBySemanticClass,
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
