import { getProductionPool } from '../postgisPool.mjs'
import { parseMaybeJson } from './repositoryUtils.mjs'
import {
  compilePostgisSqlWhere,
  compileTwinQueryWhere,
  normalizeTwinQuery,
  normalizePostgisSqlText,
  twinQueryContract,
} from '../../services/twinQuery/twinQueryCompiler.mjs'
import { twinQueryRuntimeClassPriorityCaseSql } from '../../services/semanticLayer/semanticVocabularyAdapter.mjs'
import { hashTwinQuery } from './analysisSelectionRepository.mjs'

const MAX_TWIN_QUERY_LIMIT = integerEnv('TWIN_STUDIO_TWIN_QUERY_MAX_LIMIT', 300000)
const DEFAULT_TWIN_QUERY_TILE_LIMIT = integerEnv('TWIN_STUDIO_TWIN_QUERY_MVT_DEFAULT_LIMIT', 5000)
const MAX_TWIN_QUERY_TILE_LIMIT = integerEnv('TWIN_STUDIO_TWIN_QUERY_MVT_MAX_LIMIT', 20000)
const MAX_TWIN_QUERY_SELECTION_LIMIT = integerEnv('TWIN_STUDIO_TWIN_QUERY_SELECTION_MAX_LIMIT', 300000)
const DEFAULT_TWIN_QUERY_GEOJSON_LIMIT = integerEnv('TWIN_STUDIO_TWIN_QUERY_GEOJSON_DEFAULT_LIMIT', 5000)
const MAX_TWIN_QUERY_GEOJSON_LIMIT = integerEnv('TWIN_STUDIO_TWIN_QUERY_GEOJSON_MAX_LIMIT', 20000)
const DEFAULT_TWIN_QUERY_CESIUM_PRIMITIVES_LIMIT = integerEnv('TWIN_STUDIO_TWIN_QUERY_CESIUM_PRIMITIVES_DEFAULT_LIMIT', 50000)
const MAX_TWIN_QUERY_CESIUM_PRIMITIVES_LIMIT = integerEnv('TWIN_STUDIO_TWIN_QUERY_CESIUM_PRIMITIVES_MAX_LIMIT', 50000)
const DEFAULT_TWIN_QUERY_SCENE_MANIFEST_LIMIT = integerEnv('TWIN_STUDIO_TWIN_QUERY_SCENE_MANIFEST_DEFAULT_LIMIT', 5000)
const MAX_TWIN_QUERY_SCENE_MANIFEST_LIMIT = integerEnv('TWIN_STUDIO_TWIN_QUERY_SCENE_MANIFEST_MAX_LIMIT', 20000)
const DEFAULT_TWIN_QUERY_CITY_SQL_LIMIT = integerEnv('TWIN_STUDIO_TWIN_QUERY_CITY_SQL_DEFAULT_LIMIT', 5000)
const MAX_TWIN_QUERY_CITY_SQL_LIMIT = integerEnv('TWIN_STUDIO_TWIN_QUERY_CITY_SQL_MAX_LIMIT', 20000)
const TWIN_QUERY_CITY_SQL_TIMEOUT_MS = integerEnv('TWIN_STUDIO_TWIN_QUERY_CITY_SQL_TIMEOUT_MS', 5000)
const HIGH_CAPACITY_VISUAL_INTENTS = new Set(['visual-capacity', 'stress-city-3d', 'stress-civic-xr'])

function integerEnv(name, fallback) {
  const number = Math.trunc(Number(process.env[name]))
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

function normalizedPayload(query, surface, intent) {
  return {
    ...query,
    surface,
    intent,
  }
}

function emptyTwinQuerySummary(extra = {}) {
  return {
    resultCount: 0,
    returned: 0,
    truncated: false,
    countsBySemanticClass: {},
    countsByLayer: {},
    countsByClause: {},
    ...extra,
  }
}

function geojsonTransportPolicy(query = {}) {
  const transport = String(query.render?.transport ?? '').trim()
  const active = query.render?.mode !== 'count' && (!transport || transport === 'geojson')
  if (!active) {
    return {
      active: false,
      transport,
      requestedMaxFeatures: Number(query.render?.maxFeatures ?? 0),
      effectiveMaxFeatures: Number(query.render?.maxFeatures ?? 0),
      limitApplied: false,
    }
  }

  const requested = Math.trunc(Number(query.render?.maxFeatures))
  const requestedMaxFeatures = Number.isFinite(requested) && requested > 0
    ? requested
    : DEFAULT_TWIN_QUERY_GEOJSON_LIMIT
  const legacyDefaultRequest = !transport && requestedMaxFeatures >= MAX_TWIN_QUERY_LIMIT
  const desiredMaxFeatures = legacyDefaultRequest
    ? DEFAULT_TWIN_QUERY_GEOJSON_LIMIT
    : requestedMaxFeatures
  const effectiveMaxFeatures = Math.max(1, Math.min(MAX_TWIN_QUERY_GEOJSON_LIMIT, desiredMaxFeatures))

  return {
    active: true,
    transport: 'geojson',
    mode: 'preview',
    requestedMaxFeatures,
    effectiveMaxFeatures,
    limitApplied: legacyDefaultRequest || effectiveMaxFeatures < requestedMaxFeatures,
    recommendedTransports: ['mvt', 'pmtiles', '3d-tiles', 'scene-manifest'],
  }
}

function geojsonTransportPolicySummary(policy, totalCount, returned, truncated) {
  if (!policy?.active) return null
  const resultCount = Number(totalCount ?? 0)
  const returnedCount = Number(returned ?? 0)
  const effectiveMaxFeatures = Number(policy.effectiveMaxFeatures ?? returnedCount)
  const limitApplied = Boolean(policy.limitApplied || truncated || (resultCount > 0 && returnedCount < resultCount))
  return {
    transport: 'geojson',
    mode: policy.mode || 'preview',
    limitApplied,
    requestedMaxFeatures: policy.requestedMaxFeatures,
    effectiveMaxFeatures,
    returned: returnedCount,
    resultCount,
    recommendedTransports: policy.recommendedTransports,
    warning: limitApplied
      ? `GeoJSON preview limited to ${effectiveMaxFeatures} features. Use MVT, PMTiles, 3D Tiles, or scene manifest for full-city viewers.`
      : `GeoJSON preview mode is capped at ${effectiveMaxFeatures} features. Use native viewer transports for full-city rendering.`,
  }
}

function directVisualTransportBudget(transport) {
  if (transport === 'cesium-primitives') {
    return {
      defaultMaxFeatures: DEFAULT_TWIN_QUERY_CESIUM_PRIMITIVES_LIMIT,
      maxFeatures: MAX_TWIN_QUERY_CESIUM_PRIMITIVES_LIMIT,
      recommendedTransports: ['analysis-selection', '3d-tiles', 'viewer-artifact'],
    }
  }
  if (transport === 'scene-manifest') {
    return {
      defaultMaxFeatures: DEFAULT_TWIN_QUERY_SCENE_MANIFEST_LIMIT,
      maxFeatures: MAX_TWIN_QUERY_SCENE_MANIFEST_LIMIT,
      recommendedTransports: ['analysis-selection', 'xr-scene-chunks', '3d-tiles', 'viewer-artifact'],
    }
  }
  return null
}

function planTwinQueryVisualTransport(query = {}, { intent = '', metadata = {} } = {}) {
  const transport = String(query.render?.transport ?? '').trim()
  const budget = directVisualTransportBudget(transport)
  if (!budget || query.render?.mode === 'count') {
    return { query, policy: null }
  }

  const requested = Math.trunc(Number(query.render?.maxFeatures))
  const requestedMaxFeatures = Number.isFinite(requested) && requested > 0
    ? requested
    : budget.defaultMaxFeatures
  const highCapacity = HIGH_CAPACITY_VISUAL_INTENTS.has(String(intent || '')) || metadata.allowHighCapacityVisualPayload === true
  const effectiveMaxFeatures = highCapacity
    ? Math.max(1, Math.min(MAX_TWIN_QUERY_LIMIT, requestedMaxFeatures))
    : Math.max(1, Math.min(budget.maxFeatures, requestedMaxFeatures))

  return {
    query: {
      ...query,
      render: {
        ...(query.render || {}),
        maxFeatures: effectiveMaxFeatures,
      },
    },
    policy: {
      transport,
      mode: 'direct-visual-payload',
      requestedMaxFeatures,
      effectiveMaxFeatures,
      maxAllowedFeatures: highCapacity ? MAX_TWIN_QUERY_LIMIT : budget.maxFeatures,
      limitApplied: effectiveMaxFeatures < requestedMaxFeatures,
      highCapacity,
      recommendedTransports: budget.recommendedTransports,
    },
  }
}

function directVisualTransportPolicySummary(policy, totalCount, returned, truncated) {
  if (!policy) return null
  const resultCount = Number(totalCount ?? 0)
  const returnedCount = Number(returned ?? 0)
  return {
    ...policy,
    resultCount,
    returned: returnedCount,
    truncated: Boolean(truncated || policy.limitApplied || (resultCount > 0 && returnedCount < resultCount)),
    note: policy.limitApplied
      ? 'TwinQuery capped the direct 3D/XR payload to protect browser memory. Persist the query as an analysis selection and materialize a viewer artifact for larger results.'
      : 'TwinQuery allowed this direct 3D/XR payload inside the active visual budget.',
  }
}

function selectionReferenceTransportPolicySummary(query = {}, totalCount = 0) {
  const transport = String(query.render?.transport ?? '').trim()
  if (transport !== 'selection-reference') return null
  return {
    transport,
    mode: 'reference-only',
    resultCount: Number(totalCount ?? 0),
    returned: 0,
    truncated: false,
    featurePayload: false,
    recommendedTransports: ['analysis-selection', '3d-tiles', 'viewer-artifact'],
    note: 'TwinQuery returned a selection reference for 3D surfaces without returning render geometry. Materialize the query as an analysis selection or viewer artifact before full-city 3D highlighting.',
  }
}

function twinQueryNeedsFeaturePayload(query = {}) {
  const transport = String(query.render?.transport ?? '').trim()
  return query.render?.mode !== 'count' && !['mvt', 'metadata', 'selection-reference'].includes(transport)
}

function citySqlLimit(query = {}) {
  const requested = Math.trunc(Number(query.render?.maxFeatures))
  const fallback = DEFAULT_TWIN_QUERY_CITY_SQL_LIMIT
  const value = Number.isFinite(requested) && requested > 0 ? requested : fallback
  return Math.max(1, Math.min(MAX_TWIN_QUERY_CITY_SQL_LIMIT, value))
}

function geometryFromCitySqlRow(row = {}) {
  const geometry = row.__geometry ?? row.geometry_geojson ?? row.geometry ?? null
  if (!geometry) return null
  if (typeof geometry === 'object') return geometry
  return parseMaybeJson(geometry, null)
}

function semanticClassFromCitySqlRow(row = {}) {
  return row.semantic_class || row.semanticClass || (
    row.entity_type === 'building' ? 'buildings' :
    row.entity_type === 'road' ? 'roads' :
    row.layer_key || row.display_layer_key || 'features'
  )
}

function layerKeyFromCitySqlRow(row = {}) {
  return row.display_layer_key || row.layer_key || row.layerKey || semanticClassFromCitySqlRow(row)
}

function objectIdFromCitySqlRow(row = {}, index = 0) {
  return String(row.object_id || row.objectId || row.stable_id || row.stableId || row.id || `city-sql-row-${index + 1}`)
}

function citySqlRowToFeature(row = {}, index = 0) {
  const geometry = geometryFromCitySqlRow(row)
  if (!geometry) return null
  const objectId = objectIdFromCitySqlRow(row, index)
  const semanticClass = semanticClassFromCitySqlRow(row)
  const layerKey = layerKeyFromCitySqlRow(row)
  const { __geometry, geometry_geojson, geom, geometry: rowGeometry, ...attributes } = row
  return {
    type: 'Feature',
    id: objectId,
    properties: {
      ...attributes,
      objectId,
      stableId: row.stable_id || row.stableId || objectId,
      label: row.label || row.name || objectId,
      semanticClass,
      layerKey,
      queryLayerKey: layerKey,
      entityType: row.entity_type || row.entityType || null,
      authorityStatus: row.authority_status || row.authorityStatus || null,
      confidence: row.confidence || null,
      sourceCoverageStatus: row.source_coverage_status || row.sourceCoverageStatus || null,
      provider: row.provider || null,
      modelEnrichments: row.model_enrichments && typeof row.model_enrichments === 'object' ? row.model_enrichments : {},
    },
    geometry,
  }
}

function citySqlTableColumns(rows = []) {
  return unique(rows.flatMap((row) => Object.keys(row || {}))).filter((column) => (
    !['__geometry', 'geom', 'geometry', 'geometry_geojson'].includes(column)
  ))
}

function citySqlTableRow(row = {}) {
  const { __geometry, geometry_geojson, geom, geometry, ...tableRow } = row
  return tableRow
}

function incrementCount(target, key) {
  const normalized = compactText(key, 'features')
  target[normalized] = Number(target[normalized] ?? 0) + 1
}

function citySqlLimitedCounts(rows = []) {
  const countsBySemanticClass = {}
  const countsByLayer = {}
  rows.forEach((row) => {
    incrementCount(countsBySemanticClass, semanticClassFromCitySqlRow(row))
    incrementCount(countsByLayer, layerKeyFromCitySqlRow(row))
  })
  return { countsBySemanticClass, countsByLayer }
}

function citySqlRequiresCityIdError(error) {
  return error?.code === '42703' && String(error?.message ?? '').includes('city_id')
}

function citySqlMissingGeomError(error) {
  return error?.code === '42703' && String(error?.message ?? '').includes('geom')
}

async function executeReadOnlyCitySql(pool, cityId, query = {}, limit = DEFAULT_TWIN_QUERY_CITY_SQL_LIMIT) {
  const sqlText = normalizePostgisSqlText(query.sqlText)
  if (!sqlText) {
    throw new Error('POSTGIS_SQL_SELECT_REQUIRED')
  }

  const effectiveLimit = Math.max(1, Math.min(MAX_TWIN_QUERY_CITY_SQL_LIMIT, Math.trunc(Number(limit)) || DEFAULT_TWIN_QUERY_CITY_SQL_LIMIT))
  const runWrappedQuery = async (includeGeometry = true) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN READ ONLY')
      await client.query(`SET LOCAL statement_timeout = '${Math.max(1, TWIN_QUERY_CITY_SQL_TIMEOUT_MS)}ms'`)
      const wrappedSql = includeGeometry
        ? `
          WITH city_sql AS MATERIALIZED (
            ${sqlText}
          ),
          city_filtered AS (
            SELECT *
            FROM city_sql
            WHERE city_id = $2
          ),
          query_bounds AS (
            SELECT ST_Extent(geom) AS extent
            FROM city_filtered
            WHERE geom IS NOT NULL
              AND NOT ST_IsEmpty(geom)
          ),
          limited AS (
            SELECT *
            FROM city_filtered
            LIMIT $1
          )
          SELECT
            (SELECT count(*)::int FROM city_filtered) AS total_count,
            (
              SELECT CASE
                WHEN extent IS NULL THEN NULL
                ELSE ST_AsGeoJSON(ST_SetSRID(extent::geometry, 4326))::jsonb
              END
              FROM query_bounds
            ) AS bounds_geometry,
            COALESCE(
              jsonb_agg(
                to_jsonb(limited) || jsonb_build_object(
                  '__geometry',
                  CASE
                    WHEN limited.geom IS NULL THEN NULL
                    ELSE ST_AsGeoJSON(limited.geom)::jsonb
                  END
                )
              ),
              '[]'::jsonb
            ) AS rows
          FROM limited
        `
        : `
          WITH city_sql AS MATERIALIZED (
            ${sqlText}
          ),
          city_filtered AS (
            SELECT *
            FROM city_sql
            WHERE city_id = $2
          ),
          limited AS (
            SELECT *
            FROM city_filtered
            LIMIT $1
          )
          SELECT
            (SELECT count(*)::int FROM city_filtered) AS total_count,
            NULL::jsonb AS bounds_geometry,
            COALESCE(jsonb_agg(to_jsonb(limited)), '[]'::jsonb) AS rows
          FROM limited
        `
      const result = await client.query(wrappedSql, [effectiveLimit + 1, cityId])
      await client.query('COMMIT')
      const row = result.rows[0] ?? {}
      const rawRows = Array.isArray(row.rows) ? row.rows : []
      const rows = rawRows.slice(0, effectiveLimit)
      return {
        geometryEnabled: includeGeometry,
        totalCount: Number(row.total_count ?? 0),
        rows,
        boundsGeometry: row.bounds_geometry ?? null,
        truncated: rawRows.length > effectiveLimit || Number(row.total_count ?? 0) > rows.length,
      }
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // Ignore rollback errors; the original query error is more useful.
      }
      throw error
    } finally {
      client.release()
    }
  }

  try {
    return await runWrappedQuery(true)
  } catch (error) {
    if (citySqlRequiresCityIdError(error)) {
      throw new Error('POSTGIS_SQL_SELECT_REQUIRES_CITY_ID')
    }
    if (!citySqlMissingGeomError(error)) {
      throw error
    }
  }

  try {
    return await runWrappedQuery(false)
  } catch (error) {
    if (citySqlRequiresCityIdError(error)) {
      throw new Error('POSTGIS_SQL_SELECT_REQUIRES_CITY_ID')
    }
    throw error
  }
}

async function executeReadOnlyCitySqlGeometrySummary(pool, cityId, query = {}) {
  const sqlText = normalizePostgisSqlText(query.sqlText)
  if (!sqlText) {
    throw new Error('POSTGIS_SQL_SELECT_REQUIRED')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN READ ONLY')
    await client.query(`SET LOCAL statement_timeout = '${Math.max(1, TWIN_QUERY_CITY_SQL_TIMEOUT_MS)}ms'`)
    const result = await client.query(
      `
        WITH city_sql AS MATERIALIZED (
          ${sqlText}
        ),
        city_filtered AS (
          SELECT *
          FROM city_sql
          WHERE city_id = $1
        ),
        query_bounds AS (
          SELECT ST_Extent(geom) AS extent
          FROM city_filtered
          WHERE geom IS NOT NULL
            AND NOT ST_IsEmpty(geom)
        ),
        row_properties AS (
          SELECT to_jsonb(city_filtered) AS properties
          FROM city_filtered
        ),
        counts_by_class AS (
          SELECT COALESCE(properties->>'semantic_class', properties->>'semanticClass', 'features') AS semantic_class, count(*)::int AS feature_count
          FROM row_properties
          GROUP BY COALESCE(properties->>'semantic_class', properties->>'semanticClass', 'features')
        ),
        counts_by_layer AS (
          SELECT COALESCE(properties->>'display_layer_key', properties->>'layer_key', properties->>'layerKey', properties->>'semantic_class', 'features') AS display_layer_key, count(*)::int AS feature_count
          FROM row_properties
          GROUP BY COALESCE(properties->>'display_layer_key', properties->>'layer_key', properties->>'layerKey', properties->>'semantic_class', 'features')
        )
        SELECT
          (SELECT count(*)::int FROM city_filtered) AS total_count,
          COALESCE(
            (SELECT jsonb_object_agg(semantic_class, feature_count) FROM counts_by_class),
            '{}'::jsonb
          ) AS counts_by_semantic_class,
          COALESCE(
            (SELECT jsonb_object_agg(display_layer_key, feature_count) FROM counts_by_layer),
            '{}'::jsonb
          ) AS counts_by_layer,
          (
            SELECT CASE
              WHEN extent IS NULL THEN NULL
              ELSE ST_AsGeoJSON(ST_SetSRID(extent::geometry, 4326))::jsonb
            END
            FROM query_bounds
          ) AS bounds_geometry
      `,
      [cityId],
    )
    await client.query('COMMIT')
    const row = result.rows[0] ?? {}
    return {
      totalCount: Number(row.total_count ?? 0),
      countsBySemanticClass: row.counts_by_semantic_class ?? {},
      countsByLayer: row.counts_by_layer ?? {},
      boundsGeometry: row.bounds_geometry ?? null,
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Ignore rollback errors; the original query error is more useful.
    }
    if (citySqlRequiresCityIdError(error)) {
      throw new Error('POSTGIS_SQL_SELECT_REQUIRES_CITY_ID')
    }
    if (citySqlMissingGeomError(error)) {
      throw new Error('POSTGIS_SQL_SELECT_REQUIRES_GEOM')
    }
    throw error
  } finally {
    client.release()
  }
}

function selectionReferenceForQuery({ cityId, query, summary = {}, surface, intent } = {}) {
  const transport = String(query?.render?.transport ?? '').trim()
  if (transport !== 'selection-reference') return null
  const cityPath = encodeURIComponent(cityId || 'current')
  return {
    kind: 'twin-query-selection-reference',
    version: '2026-06-29',
    cityId,
    queryHash: hashTwinQuery(query),
    surface,
    intent,
    resultCount: Number(summary.resultCount ?? 0),
    returned: 0,
    bounds: summary.bounds ?? null,
    countsBySemanticClass: summary.countsBySemanticClass ?? {},
    countsByLayer: summary.countsByLayer ?? {},
    countsByClause: summary.countsByClause ?? {},
    renderPlan: {
      base: 'registered-3d-tiles',
      overlay: 'selection-style-or-filter',
      featurePayload: false,
      note: 'Use active 3D Tiles for base city geometry; use this query hash/scope to materialize or highlight a selection without resending city geometry.',
    },
    materialization: {
      analysisSelection: {
        method: 'POST',
        href: `/api/live/${cityPath}/analysis-selections/query`,
        body: {
          query,
          surface,
          intent,
          selectionKind: 'twinql-selection',
        },
      },
      viewerArtifacts: {
        method: 'POST',
        href: `/api/live/${cityPath}/operations/data-factory/viewer-artifacts`,
        note: 'Future heavy path: materialize query-scoped 3D Tiles or selection overlays through Data Factory.',
      },
    },
    artifacts: {
      threeDTilesets: {
        href: `/api/live/${cityPath}/3d-tilesets?status=ready&limit=10`,
        transport: '3d-tiles',
      },
    },
  }
}

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeSurface(value) {
  const surface = compactText(value, 'api')
  return ['map', 'municipal3d', 'immersive', 'api'].includes(surface) ? surface : 'api'
}

function normalizeIntent(value) {
  const intent = compactText(value, 'analysis')
  return ['inspection', 'analysis', 'simulation', 'operations', 'embed', 'export', 'visual-capacity', 'stress-city-3d', 'stress-civic-xr', 'unknown'].includes(intent)
    ? intent
    : 'unknown'
}

function scopeCteSql(scope, addParam) {
  if (scope.key === 'radius') {
    return `
      SELECT
        ST_Buffer(
          ST_SetSRID(ST_MakePoint(${addParam(scope.center[0])}::double precision, ${addParam(scope.center[1])}::double precision), 4326)::geography,
          ${addParam(scope.radiusMeters)}::double precision
        )::geometry AS geom
    `
  }

  if (scope.key === 'viewport') {
    return `
      SELECT ST_MakeEnvelope(
        ${addParam(scope.bbox[0])}::double precision,
        ${addParam(scope.bbox[1])}::double precision,
        ${addParam(scope.bbox[2])}::double precision,
        ${addParam(scope.bbox[3])}::double precision,
        4326
      ) AS geom
    `
  }

  if (scope.key === 'customPolygon') {
    return `
      SELECT ST_SetSRID(ST_GeomFromGeoJSON(${addParam(JSON.stringify(scope.geometry))}), 4326) AS geom
    `
  }

  return `
    SELECT geom
    FROM latest_boundary
  `
}

function layerPriorityCaseSql() {
  return twinQueryRuntimeClassPriorityCaseSql('semantic_class')
}

function clippedGeometrySql(sourceGeom = 'co.geom', scopeGeom = 'qs.geom', scopeKeySql = null) {
  const noClipCondition = scopeKeySql
    ? `${scopeGeom} IS NULL OR ${scopeKeySql} = 'city'`
    : `${scopeGeom} IS NULL`

  return `
    CASE
      WHEN ${noClipCondition} THEN ${sourceGeom}
      WHEN GeometryType(${sourceGeom}) IN ('POINT', 'MULTIPOINT') THEN ${sourceGeom}
      WHEN GeometryType(${sourceGeom}) IN ('LINESTRING', 'MULTILINESTRING') THEN
        ST_CollectionExtract(ST_Intersection(ST_MakeValid(${sourceGeom}), ST_MakeValid(${scopeGeom})), 2)
      WHEN GeometryType(${sourceGeom}) IN ('POLYGON', 'MULTIPOLYGON') THEN
        ST_CollectionExtract(ST_Intersection(ST_MakeValid(${sourceGeom}), ST_MakeValid(${scopeGeom})), 3)
      ELSE ST_Intersection(ST_MakeValid(${sourceGeom}), ST_MakeValid(${scopeGeom}))
    END
  `
}

function clampEventLimit(value, fallback = 12) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(100, Math.max(1, number))
}

function clampTileLimit(value, fallback = DEFAULT_TWIN_QUERY_TILE_LIMIT) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(MAX_TWIN_QUERY_TILE_LIMIT, Math.max(1, number))
}

function clampSelectionLimit(value, fallback = MAX_TWIN_QUERY_SELECTION_LIMIT) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(MAX_TWIN_QUERY_SELECTION_LIMIT, Math.max(1, number))
}

function normalizeTileCoordinate(value, name, z = null) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) {
    throw new Error(`${String(name).toUpperCase()}_TILE_COORDINATE_REQUIRED`)
  }
  if (name === 'z') {
    if (number < 0 || number > 22) throw new Error('Z_TILE_COORDINATE_OUT_OF_RANGE')
    return number
  }
  if (z != null) {
    const max = (2 ** z) - 1
    if (number < 0 || number > max) {
      throw new Error(`${String(name).toUpperCase()}_TILE_COORDINATE_OUT_OF_RANGE`)
    }
  }
  return number
}

function twinQueryTileOptions(input = {}) {
  const z = normalizeTileCoordinate(input.z, 'z')
  return {
    z,
    x: normalizeTileCoordinate(input.x, 'x', z),
    y: normalizeTileCoordinate(input.y, 'y', z),
    limit: clampTileLimit(input.limit ?? input.tileLimit),
  }
}

function normalizeStatusFilter(value) {
  const status = compactText(value)
  return ['completed', 'failed', 'partial'].includes(status) ? status : ''
}

function rowToTwinQueryEvent(row = {}) {
  const resultCount = Number(row.result_count ?? 0)
  const latencyMs = row.latency_ms == null ? null : Number(row.latency_ms)
  const query = parseMaybeJson(row.query, {})
  const clauses = Array.isArray(query?.clauses) ? query.clauses : []
  const classes = Array.isArray(row.classes) ? row.classes : []
  return {
    id: row.id,
    cityId: row.city_id,
    surface: row.surface,
    queryKind: row.query_kind,
    intent: row.intent,
    query,
    scope: parseMaybeJson(row.scope, {}),
    classes,
    filters: parseMaybeJson(row.filters, []),
    render: parseMaybeJson(row.render, {}),
    resultCount,
    truncated: Boolean(row.truncated),
    status: row.status,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    consumerKey: row.consumer_key,
    shareKey: row.share_key,
    embedKey: row.embed_key,
    requestPath: row.request_path,
    requestId: row.request_id,
    latencyMs: Number.isFinite(latencyMs) ? latencyMs : null,
    metadata: parseMaybeJson(row.metadata, {}),
    createdAt: row.created_at?.toISOString?.() ?? row.created_at ?? null,
    summary: {
      classLabel: classes.join(', ') || 'Any city object',
      clauseCount: clauses.length || (query?.scope?.key === 'multiClause' ? query.scope.clauses?.length ?? 0 : 0),
      operation: query?.operation || 'query',
    },
  }
}

async function recordTwinQueryEvent(pool, event) {
  try {
    await pool.query(
      `
        INSERT INTO ldt_viewer.semantic_query_events (
          city_id,
          surface,
          query_kind,
          intent,
          query,
          scope,
          classes,
          filters,
          render,
          result_count,
          truncated,
          status,
          actor_user_id,
          actor_role,
          consumer_key,
          share_key,
          embed_key,
          request_path,
          request_id,
          latency_ms,
          metadata
        )
        VALUES (
          $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::text[], $8::jsonb, $9::jsonb,
          $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb
        )
      `,
      [
        event.cityId,
        event.surface,
        event.queryKind,
        event.intent,
        JSON.stringify(event.query),
        JSON.stringify(event.scope),
        event.classes,
        JSON.stringify(event.filters ?? []),
        JSON.stringify(event.render),
        event.resultCount,
        event.truncated,
        event.status,
        event.actorUserId,
        event.actorRole,
        event.consumerKey,
        event.shareKey,
        event.embedKey,
        event.requestPath,
        event.requestId,
        event.latencyMs,
        JSON.stringify(event.metadata ?? {}),
      ],
    )
  } catch {
    // Query execution must not fail because usage telemetry is unavailable.
  }
}

export async function listCityTwinQueryEvents(cityId, options = {}) {
  const pool = getProductionPool()
  const limit = clampEventLimit(options.limit)
  const surface = normalizeSurface(options.surface)
  const status = normalizeStatusFilter(options.status)

  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      events: [],
      summary: {
        totalReturned: 0,
        limit,
      },
      error: null,
    }
  }

  const values = [cityId, surface, limit]
  let statusSql = ''
  if (status) {
    values.push(status)
    statusSql = `AND status = $${values.length}`
  }

  try {
    const result = await pool.query(
      `
        SELECT
          id,
          city_id,
          surface,
          query_kind,
          intent,
          query,
          scope,
          classes,
          filters,
          render,
          result_count,
          truncated,
          status,
          actor_user_id,
          actor_role,
          consumer_key,
          share_key,
          embed_key,
          request_path,
          request_id,
          latency_ms,
          metadata,
          created_at
        FROM ldt_viewer.semantic_query_events
        WHERE city_id = $1
          AND surface = $2
          ${statusSql}
        ORDER BY created_at DESC
        LIMIT $3
      `,
      values,
    )

    const events = result.rows.map(rowToTwinQueryEvent)
    return {
      configured: true,
      ok: true,
      cityId,
      events,
      summary: {
        totalReturned: events.length,
        limit,
        surface,
        status: status || null,
      },
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      events: [],
      summary: {
        totalReturned: 0,
        limit,
        surface,
        status: status || null,
      },
      error: String(error?.message ?? 'TWIN_QUERY_EVENTS_UNAVAILABLE'),
    }
  }
}

function rowToFeature(row) {
  const properties = row.properties && typeof row.properties === 'object' ? row.properties : {}
  return {
    type: 'Feature',
    id: row.object_id,
    properties: {
      ...properties,
      objectId: row.object_id,
      stableId: row.object_id,
      label: row.label || row.object_id,
      semanticClass: row.semantic_class,
      layerKey: row.display_layer_key,
      queryLayerKey: row.display_layer_key,
      entityType: row.entity_type,
      authorityStatus: row.authority_status,
      confidence: row.confidence,
      sourceCoverageStatus: row.source_coverage_status,
      provider: row.provider,
      sourceFormat: row.source_format,
      sourceFamily: row.source_family,
      roadClass: row.road_class,
      buildingType: row.building_type,
      heightMeters: row.height_m == null ? null : Number(row.height_m),
      floors: row.floors == null ? null : Number(row.floors),
      sapScore: row.sap_score == null ? null : Number(row.sap_score),
      energyLabel: row.energy_label ?? null,
      modelEnrichments: row.model_enrichments && typeof row.model_enrichments === 'object' ? row.model_enrichments : {},
      landUseClass: row.land_use_class,
      category: row.category,
      distanceMeters: row.distance_m == null ? null : Number(row.distance_m),
      clauseId: row.clause_id ?? null,
      clauseLabel: row.clause_label ?? null,
    },
    geometry: parseMaybeJson(row.geometry, null),
  }
}

function boundsFromGeometry(geometry) {
  const parsed = parseMaybeJson(geometry, null)
  if (!parsed?.coordinates) return null
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  const visit = (value) => {
    if (!Array.isArray(value)) return
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      const lon = Number(value[0])
      const lat = Number(value[1])
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return
      minLon = Math.min(minLon, lon)
      minLat = Math.min(minLat, lat)
      maxLon = Math.max(maxLon, lon)
      maxLat = Math.max(maxLat, lat)
      return
    }
    value.forEach(visit)
  }
  visit(parsed.coordinates)
  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) return null
  return { minLon, minLat, maxLon, maxLat }
}

function rowToSelectionObject(row = {}) {
  return {
    cityEntityId: row.city_entity_id || null,
    objectId: row.object_id || '',
    stableId: row.object_id || '',
    semanticClass: row.semantic_class || '',
    layerKey: row.layer_key || '',
    entityType: row.entity_type || '',
    label: row.label || row.object_id || '',
    geometryType: row.geometry_type || null,
    geometrySnapshot: parseMaybeJson(row.geometry_snapshot, null),
    clauseId: row.clause_id || null,
    clauseLabel: row.clause_label || null,
    distanceMeters: row.distance_m == null ? null : Number(row.distance_m),
    centroid: (
      Number.isFinite(Number(row.centroid_lon)) &&
      Number.isFinite(Number(row.centroid_lat))
    )
      ? [Number(row.centroid_lon), Number(row.centroid_lat)]
      : null,
    attributes: parseMaybeJson(row.attributes, {}),
  }
}

export function getTwinQueryContract() {
  return twinQueryContract()
}

async function getCityReadOnlySqlMvtTile(pool, cityId, query, tileOptions, normalized) {
  try {
    const sqlText = normalizePostgisSqlText(query.sqlText)
    if (!sqlText) {
      throw new Error('POSTGIS_SQL_SELECT_REQUIRED')
    }

    const result = await pool.query(
      `
        WITH city_sql AS MATERIALIZED (
          ${sqlText}
        ),
        bounds AS (
          SELECT
            ST_TileEnvelope($2::int, $3::int, $4::int) AS geom_3857,
            ST_Transform(ST_TileEnvelope($2::int, $3::int, $4::int), 4326) AS geom_4326
        ),
        city_filtered AS (
          SELECT *
          FROM city_sql
          WHERE city_id = $1
            AND geom IS NOT NULL
            AND NOT ST_IsEmpty(geom)
        ),
        query_bounds AS (
          SELECT ST_Extent(geom) AS extent
          FROM city_filtered
        ),
        row_properties AS (
          SELECT to_jsonb(city_filtered) AS properties
          FROM city_filtered
        ),
        tile_rows AS (
          SELECT
            city_filtered.*,
            to_jsonb(city_filtered) AS properties,
            row_number() OVER () AS city_sql_row_index
          FROM city_filtered
          CROSS JOIN bounds
          WHERE geom && bounds.geom_4326
            AND ST_Intersects(geom, bounds.geom_4326)
          LIMIT $5
        ),
        mvt_features AS (
          SELECT
            ST_AsMVTGeom(ST_Transform(tile_rows.geom, 3857), bounds.geom_3857, 4096, 64, true) AS geom,
            COALESCE(
              properties->>'object_id',
              properties->>'objectId',
              properties->>'stable_id',
              properties->>'stableId',
              properties->>'id',
              'city-sql-row-' || city_sql_row_index::text
            ) AS "objectId",
            COALESCE(
              properties->>'stable_id',
              properties->>'stableId',
              properties->>'object_id',
              properties->>'objectId',
              properties->>'id',
              'city-sql-row-' || city_sql_row_index::text
            ) AS "stableId",
            COALESCE(properties->>'entity_type', properties->>'entityType') AS "entityType",
            COALESCE(
              properties->>'display_layer_key',
              properties->>'layer_key',
              properties->>'layerKey',
              properties->>'semantic_class',
              properties->>'semanticClass',
              'features'
            ) AS "layerKey",
            COALESCE(
              properties->>'display_layer_key',
              properties->>'layer_key',
              properties->>'layerKey',
              properties->>'semantic_class',
              properties->>'semanticClass',
              'features'
            ) AS "queryLayerKey",
            COALESCE(properties->>'semantic_class', properties->>'semanticClass', 'features') AS "semanticClass",
            COALESCE(properties->>'label', properties->>'name', properties->>'object_id', properties->>'objectId') AS label,
            properties->>'authority_status' AS "authorityStatus",
            properties->>'confidence' AS confidence,
            properties->>'source_coverage_status' AS "sourceCoverageStatus",
            properties->>'provider' AS provider,
            properties->>'road_class' AS "roadClass",
            properties->>'building_type' AS "buildingType",
            properties->>'height_m' AS "heightMeters",
            properties->>'floors' AS floors,
            properties->>'sap_score' AS "sapScore",
            properties->>'energy_label' AS "energyLabel",
            properties->>'land_use_class' AS "landUseClass",
            properties->>'category' AS category
          FROM tile_rows
          CROSS JOIN bounds
        ),
        counts_by_class AS (
          SELECT COALESCE(properties->>'semantic_class', properties->>'semanticClass', 'features') AS semantic_class, count(*)::int AS feature_count
          FROM row_properties
          GROUP BY COALESCE(properties->>'semantic_class', properties->>'semanticClass', 'features')
        ),
        counts_by_layer AS (
          SELECT COALESCE(properties->>'display_layer_key', properties->>'layer_key', properties->>'layerKey', properties->>'semantic_class', 'features') AS display_layer_key, count(*)::int AS feature_count
          FROM row_properties
          GROUP BY COALESCE(properties->>'display_layer_key', properties->>'layer_key', properties->>'layerKey', properties->>'semantic_class', 'features')
        )
        SELECT
          COALESCE((SELECT ST_AsMVT(mvt_features, 'features', 4096, 'geom') FROM mvt_features), ''::bytea) AS tile,
          (SELECT count(*)::int FROM city_filtered) AS tile_feature_count,
          COALESCE(
            (SELECT jsonb_object_agg(semantic_class, feature_count) FROM counts_by_class),
            '{}'::jsonb
          ) AS counts_by_semantic_class,
          COALESCE(
            (SELECT jsonb_object_agg(display_layer_key, feature_count) FROM counts_by_layer),
            '{}'::jsonb
          ) AS counts_by_layer,
          (
            SELECT CASE
              WHEN extent IS NULL THEN NULL
              ELSE ST_AsGeoJSON(ST_SetSRID(extent::geometry, 4326))::jsonb
            END
            FROM query_bounds
          ) AS bounds_geometry,
          '{}'::jsonb AS counts_by_clause
      `,
      [cityId, tileOptions.z, tileOptions.x, tileOptions.y, tileOptions.limit],
    )

    const row = result.rows[0] ?? {}
    const tile = Buffer.isBuffer(row.tile) ? row.tile : Buffer.from(row.tile ?? '')
    const tileFeatureCount = Number(row.tile_feature_count ?? 0)

    return {
      configured: true,
      ok: true,
      cityId,
      query: normalized,
      tile,
      byteLength: tile.byteLength,
      summary: {
        tileFeatureCount,
        tileLimit: tileOptions.limit,
        truncatedTile: tileFeatureCount > tileOptions.limit,
        z: tileOptions.z,
        x: tileOptions.x,
        y: tileOptions.y,
        countsBySemanticClass: row.counts_by_semantic_class ?? {},
        countsByLayer: row.counts_by_layer ?? {},
        countsByClause: row.counts_by_clause ?? {},
        bounds: boundsFromGeometry(row.bounds_geometry),
      },
      error: null,
    }
  } catch (error) {
    const message = citySqlRequiresCityIdError(error)
      ? 'POSTGIS_SQL_SELECT_REQUIRES_CITY_ID'
      : citySqlMissingGeomError(error)
        ? 'POSTGIS_SQL_SELECT_MVT_REQUIRES_GEOM'
        : String(error?.message ?? 'POSTGIS_SQL_SELECT_MVT_UNAVAILABLE')
    return {
      configured: true,
      ok: false,
      cityId,
      query: normalized,
      tile: Buffer.alloc(0),
      byteLength: 0,
      summary: {
        tileFeatureCount: 0,
        tileLimit: tileOptions.limit,
        z: tileOptions.z,
        x: tileOptions.x,
        y: tileOptions.y,
      },
      error: message,
    }
  }
}

export async function getTwinQueryMvtTile(cityId, input = {}) {
  const pool = getProductionPool()
  const query = normalizeTwinQuery(input.query && typeof input.query === 'object' ? input.query : input)
  const surface = normalizeSurface(input.surface ?? input.query?.surface)
  const intent = normalizeIntent(input.intent ?? input.query?.intent)
  const tileOptions = twinQueryTileOptions(input)
  const normalized = normalizedPayload(query, surface, intent)

  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      query: normalized,
      tile: Buffer.alloc(0),
      byteLength: 0,
      summary: {
        tileFeatureCount: 0,
        tileLimit: tileOptions.limit,
        z: tileOptions.z,
        x: tileOptions.x,
        y: tileOptions.y,
      },
      error: null,
    }
  }

  if (query.sqlMode === 'select' && query.sqlText) {
    return getCityReadOnlySqlMvtTile(pool, cityId, query, tileOptions, normalized)
  }

  const values = []
  const addParam = (value) => {
    values.push(value)
    return `$${values.length}`
  }

  const cityParam = addParam(cityId)
  const zParam = addParam(tileOptions.z)
  const xParam = addParam(tileOptions.x)
  const yParam = addParam(tileOptions.y)
  const limitParam = addParam(tileOptions.limit)
  const layerPriorityCase = layerPriorityCaseSql()

  try {
    let filteredSql = ''
    let clauseSummarySql = `'{}'::jsonb`

    if (Array.isArray(query.clauses) && query.clauses.length) {
      const clauseSql = query.clauses.map((clause, index) => {
        const scopeName = `query_scope_${index}`
        const filteredName = `filtered_${index}`
        const clauseIdParam = addParam(clause.id)
        const clauseLabelParam = addParam(clause.label)
        const clauseClassParam = addParam(clause.classes)
        const clauseScopeKeyParam = addParam(clause.scope.key)
        const clauseCenterLonParam = addParam(clause.scope.center?.[0] ?? null)
        const clauseCenterLatParam = addParam(clause.scope.center?.[1] ?? null)
        const scopeSql = scopeCteSql(clause.scope, addParam)
        const whereSql = [
          compileTwinQueryWhere(clause.where, addParam),
          compilePostgisSqlWhere(clause.sqlWhere ?? query.sqlWhere),
        ].filter(Boolean).join('\n')

        return {
          scopeName,
          filteredName,
          sql: `
            ${scopeName} AS (
              ${scopeSql}
            ),
            ${filteredName} AS (
              SELECT
                co.*,
                ${clauseIdParam}::text AS clause_id,
                ${clauseLabelParam}::text AS clause_label,
                ${index}::int AS clause_priority,
                ${clippedGeometrySql('co.geom', 'qs.geom', clauseScopeKeyParam)} AS display_geom,
                CASE
                  WHEN ${clauseScopeKeyParam} = 'radius' THEN ST_DistanceSphere(
                    ST_PointOnSurface(co.geom),
                    ST_SetSRID(ST_MakePoint(
                      ${clauseCenterLonParam}::double precision,
                      ${clauseCenterLatParam}::double precision
                    ), 4326)
                  )
                  ELSE NULL
                END AS distance_m
              FROM ldt_query.city_objects_enriched co
              CROSS JOIN bounds tb
              CROSS JOIN ${scopeName} qs
              WHERE co.city_id = ${cityParam}
                AND co.geom IS NOT NULL
                AND co.semantic_class = ANY(${clauseClassParam}::text[])
                AND co.geom && tb.geom_4326
                AND ST_Intersects(co.geom, tb.geom_4326)
                AND (qs.geom IS NULL OR (co.geom && qs.geom AND ST_Intersects(co.geom, qs.geom)))
                ${whereSql}
            )
          `,
        }
      })

      filteredSql = `
        ${clauseSql.map((clause) => clause.sql).join(',\n')},
        all_filtered AS (
          ${clauseSql.map((clause) => `SELECT * FROM ${clause.filteredName}`).join('\n          UNION ALL\n          ')}
        ),
        filtered AS (
          SELECT *
          FROM (
            SELECT
              *,
              row_number() OVER (
                PARTITION BY object_id
                ORDER BY clause_priority ASC, semantic_class ASC, object_id ASC
              ) AS query_clause_rank
            FROM all_filtered
            WHERE display_geom IS NOT NULL
              AND NOT ST_IsEmpty(display_geom)
          ) ranked
          WHERE query_clause_rank = 1
        )
      `
      clauseSummarySql = `
        COALESCE(
          (
            SELECT jsonb_object_agg(
              clause_id,
              jsonb_build_object('label', clause_label, 'count', feature_count)
            )
            FROM (
              SELECT clause_id, max(clause_label) AS clause_label, count(*)::int AS feature_count
              FROM filtered
              GROUP BY clause_id
            ) counts_by_clause
          ),
          '{}'::jsonb
        )
      `
    } else {
      const classParam = addParam(query.classes)
      const scopeKeyParam = addParam(query.scope.key)
      const centerLonParam = addParam(query.scope.center?.[0] ?? null)
      const centerLatParam = addParam(query.scope.center?.[1] ?? null)
      const scopeSql = scopeCteSql(query.scope, addParam)
      const whereSql = [
        compileTwinQueryWhere(query.where, addParam),
        compilePostgisSqlWhere(query.sqlWhere),
      ].filter(Boolean).join('\n')

      filteredSql = `
        query_scope AS (
          ${scopeSql}
        ),
        raw_filtered AS (
          SELECT
                co.*,
                NULL::text AS clause_id,
                NULL::text AS clause_label,
                0::int AS clause_priority,
                ${clippedGeometrySql('co.geom', 'qs.geom', scopeKeyParam)} AS display_geom,
                CASE
                  WHEN ${scopeKeyParam} = 'radius' THEN ST_DistanceSphere(
                ST_PointOnSurface(co.geom),
                ST_SetSRID(ST_MakePoint(
                  ${centerLonParam}::double precision,
                  ${centerLatParam}::double precision
                ), 4326)
              )
              ELSE NULL
            END AS distance_m
          FROM ldt_query.city_objects_enriched co
          CROSS JOIN bounds tb
          CROSS JOIN query_scope qs
          WHERE co.city_id = ${cityParam}
            AND co.geom IS NOT NULL
            AND co.semantic_class = ANY(${classParam}::text[])
            AND co.geom && tb.geom_4326
            AND ST_Intersects(co.geom, tb.geom_4326)
            AND (qs.geom IS NULL OR (co.geom && qs.geom AND ST_Intersects(co.geom, qs.geom)))
            ${whereSql}
        ),
        filtered AS (
          SELECT *
          FROM raw_filtered
          WHERE display_geom IS NOT NULL
            AND NOT ST_IsEmpty(display_geom)
        )
      `
    }

    const result = await pool.query(
      `
        WITH latest_boundary AS (
          SELECT geom
          FROM ldt_core.city_boundaries
          WHERE city_id = ${cityParam}
            AND lower(COALESCE(boundary_role, '')) NOT LIKE '%test%'
            AND lower(COALESCE(properties->>'source', '')) NOT LIKE '%smoke%'
          ORDER BY CASE boundary_role WHEN 'municipality' THEN 0 WHEN 'administrative' THEN 1 ELSE 2 END,
            created_at DESC,
            id DESC
          LIMIT 1
        ),
        bounds AS (
          SELECT
            ST_TileEnvelope(${zParam}::int, ${xParam}::int, ${yParam}::int) AS geom_3857,
            ST_Transform(ST_TileEnvelope(${zParam}::int, ${xParam}::int, ${yParam}::int), 4326) AS geom_4326
        ),
        ${filteredSql},
        query_bounds AS (
          SELECT ST_Extent(display_geom) AS extent
          FROM filtered
          WHERE display_geom IS NOT NULL
            AND NOT ST_IsEmpty(display_geom)
        ),
        tile_rows AS (
          SELECT
            *,
            ${layerPriorityCase} AS layer_priority
          FROM filtered
          WHERE display_geom IS NOT NULL
            AND NOT ST_IsEmpty(display_geom)
          ORDER BY clause_priority ASC, layer_priority ASC, object_id ASC
          LIMIT ${limitParam}
        ),
        mvt_features AS (
          SELECT
            ST_AsMVTGeom(ST_Transform(tile_rows.display_geom, 3857), bounds.geom_3857, 4096, 64, true) AS geom,
            tile_rows.object_id AS "objectId",
            tile_rows.object_id AS "stableId",
            tile_rows.entity_type AS "entityType",
            tile_rows.display_layer_key AS "layerKey",
            tile_rows.display_layer_key AS "queryLayerKey",
            tile_rows.semantic_class AS "semanticClass",
            tile_rows.label AS label,
            tile_rows.authority_status AS "authorityStatus",
            tile_rows.confidence AS confidence,
            tile_rows.source_coverage_status AS "sourceCoverageStatus",
            tile_rows.provider AS provider,
            tile_rows.source_format AS "sourceFormat",
            tile_rows.source_family AS "sourceFamily",
            tile_rows.road_class AS "roadClass",
            tile_rows.road_class AS highway,
            tile_rows.building_type AS "buildingType",
            tile_rows.height_m AS "heightMeters",
            tile_rows.floors AS floors,
            tile_rows.sap_score AS "sapScore",
            tile_rows.energy_label AS "energyLabel",
            tile_rows.land_use_class AS "landUseClass",
            tile_rows.category AS category,
            tile_rows.distance_m AS "distanceMeters",
            tile_rows.clause_id AS "clauseId",
            tile_rows.clause_label AS "clauseLabel"
          FROM tile_rows
          CROSS JOIN bounds
          WHERE tile_rows.display_geom IS NOT NULL
            AND NOT ST_IsEmpty(tile_rows.display_geom)
        )
        SELECT
          COALESCE((SELECT ST_AsMVT(mvt_features, 'features', 4096, 'geom') FROM mvt_features), ''::bytea) AS tile,
          (SELECT count(*)::int FROM filtered) AS tile_feature_count,
          COALESCE(
            (
              SELECT jsonb_object_agg(semantic_class, feature_count)
              FROM (
                SELECT semantic_class, count(*)::int AS feature_count
                FROM filtered
                GROUP BY semantic_class
              ) counts_by_class
            ),
            '{}'::jsonb
          ) AS counts_by_semantic_class,
          COALESCE(
            (
              SELECT jsonb_object_agg(display_layer_key, feature_count)
              FROM (
                SELECT display_layer_key, count(*)::int AS feature_count
                FROM filtered
                GROUP BY display_layer_key
              ) counts_by_layer
            ),
            '{}'::jsonb
          ) AS counts_by_layer,
          (
            SELECT CASE
              WHEN extent IS NULL THEN NULL
              ELSE ST_AsGeoJSON(ST_SetSRID(extent::geometry, 4326))::jsonb
            END
            FROM query_bounds
          ) AS bounds_geometry,
          ${clauseSummarySql} AS counts_by_clause
      `,
      values,
    )

    const row = result.rows[0] ?? {}
    const tile = Buffer.isBuffer(row.tile) ? row.tile : Buffer.from(row.tile ?? '')
    const tileFeatureCount = Number(row.tile_feature_count ?? 0)

    return {
      configured: true,
      ok: true,
      cityId,
      query: normalized,
      tile,
      byteLength: tile.byteLength,
      summary: {
        tileFeatureCount,
        tileLimit: tileOptions.limit,
        truncatedTile: tileFeatureCount > tileOptions.limit,
        z: tileOptions.z,
        x: tileOptions.x,
        y: tileOptions.y,
        countsBySemanticClass: row.counts_by_semantic_class ?? {},
        countsByLayer: row.counts_by_layer ?? {},
        countsByClause: row.counts_by_clause ?? {},
        bounds: boundsFromGeometry(row.bounds_geometry),
      },
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      query: normalized,
      tile: Buffer.alloc(0),
      byteLength: 0,
      summary: {
        tileFeatureCount: 0,
        tileLimit: tileOptions.limit,
        z: tileOptions.z,
        x: tileOptions.x,
        y: tileOptions.y,
      },
      error: String(error?.message ?? 'TWIN_QUERY_MVT_TILE_UNAVAILABLE'),
    }
  }
}

async function runCityTwinQueryClauses(pool, cityId, input, query, surface, intent, startedAt, visualPolicy = null) {
  const values = []
  const addParam = (value) => {
    values.push(value)
    return `$${values.length}`
  }

  try {
    const cityParam = addParam(cityId)
    const transport = String(query.render?.transport ?? '').trim()
    const geojsonPolicy = geojsonTransportPolicy(query)
    const needsFeaturePayload = twinQueryNeedsFeaturePayload(query)
    const requestedFeatureLimit = geojsonPolicy.active ? geojsonPolicy.effectiveMaxFeatures : query.render.maxFeatures
    const limit = needsFeaturePayload ? Math.min(MAX_TWIN_QUERY_LIMIT, requestedFeatureLimit) : 0
    const queryLimit = limit <= 0 ? 0 : Math.min(MAX_TWIN_QUERY_LIMIT + 1, limit + 1)
    const limitParam = addParam(queryLimit)
    const layerPriorityCase = layerPriorityCaseSql()

    const clauseSql = query.clauses.map((clause, index) => {
      const scopeName = `query_scope_${index}`
      const filteredName = `filtered_${index}`
      const clauseIdParam = addParam(clause.id)
      const clauseLabelParam = addParam(clause.label)
      const clauseClassParam = addParam(clause.classes)
      const clauseScopeKeyParam = addParam(clause.scope.key)
      const clauseCenterLonParam = addParam(clause.scope.center?.[0] ?? null)
      const clauseCenterLatParam = addParam(clause.scope.center?.[1] ?? null)
      const scopeSql = scopeCteSql(clause.scope, addParam)
      const whereSql = [
        compileTwinQueryWhere(clause.where, addParam),
        compilePostgisSqlWhere(clause.sqlWhere ?? query.sqlWhere),
      ].filter(Boolean).join('\n')

      return {
        scopeName,
        filteredName,
        sql: `
          ${scopeName} AS (
            ${scopeSql}
          ),
          ${filteredName} AS (
            SELECT
              co.*,
              ${clauseIdParam}::text AS clause_id,
              ${clauseLabelParam}::text AS clause_label,
              ${index}::int AS clause_priority,
              ${clippedGeometrySql('co.geom', 'qs.geom', clauseScopeKeyParam)} AS display_geom,
              CASE
                WHEN ${clauseScopeKeyParam} = 'radius' THEN ST_DistanceSphere(
                  ST_PointOnSurface(co.geom),
                  ST_SetSRID(ST_MakePoint(
                    ${clauseCenterLonParam}::double precision,
                    ${clauseCenterLatParam}::double precision
                  ), 4326)
                )
                ELSE NULL
              END AS distance_m
            FROM ldt_query.city_objects_enriched co
            CROSS JOIN ${scopeName} qs
            WHERE co.city_id = ${cityParam}
              AND (qs.geom IS NULL OR (co.geom && qs.geom AND ST_Intersects(co.geom, qs.geom)))
              AND co.semantic_class = ANY(${clauseClassParam}::text[])
              ${whereSql}
          )
        `,
      }
    })

    const result = await pool.query(
      `
        WITH latest_boundary AS (
          SELECT geom
          FROM ldt_core.city_boundaries
          WHERE city_id = ${cityParam}
            AND lower(COALESCE(boundary_role, '')) NOT LIKE '%test%'
            AND lower(COALESCE(properties->>'source', '')) NOT LIKE '%smoke%'
          ORDER BY CASE boundary_role WHEN 'municipality' THEN 0 WHEN 'administrative' THEN 1 ELSE 2 END,
            created_at DESC,
            id DESC
          LIMIT 1
        ),
        ${clauseSql.map((clause) => clause.sql).join(',\n')},
        all_filtered AS (
          ${clauseSql.map((clause) => `SELECT * FROM ${clause.filteredName}`).join('\n          UNION ALL\n          ')}
        ),
        deduped AS (
          SELECT *
          FROM (
            SELECT
              *,
              row_number() OVER (
                PARTITION BY object_id
                ORDER BY clause_priority ASC, semantic_class ASC, object_id ASC
              ) AS query_clause_rank
            FROM all_filtered
            WHERE display_geom IS NOT NULL
              AND NOT ST_IsEmpty(display_geom)
          ) ranked
          WHERE query_clause_rank = 1
        ),
        query_bounds AS (
          SELECT ST_Extent(display_geom) AS extent
          FROM deduped
          WHERE display_geom IS NOT NULL
            AND NOT ST_IsEmpty(display_geom)
        ),
        limited AS (
          SELECT
            *,
            ${layerPriorityCase} AS layer_priority
          FROM deduped
          WHERE display_geom IS NOT NULL
            AND NOT ST_IsEmpty(display_geom)
          ORDER BY clause_priority ASC, layer_priority ASC, object_id ASC
          LIMIT ${limitParam}
        ),
        counts_by_class AS (
          SELECT semantic_class, count(*)::int AS feature_count
          FROM deduped
          GROUP BY semantic_class
        ),
        counts_by_layer AS (
          SELECT display_layer_key, count(*)::int AS feature_count
          FROM deduped
          GROUP BY display_layer_key
        ),
        counts_by_clause AS (
          SELECT clause_id, max(clause_label) AS clause_label, count(*)::int AS feature_count
          FROM deduped
          GROUP BY clause_id
        )
        SELECT
          (SELECT count(*)::int FROM deduped) AS total_count,
          COALESCE(
            (SELECT jsonb_object_agg(semantic_class, feature_count) FROM counts_by_class),
            '{}'::jsonb
          ) AS counts_by_semantic_class,
          COALESCE(
            (SELECT jsonb_object_agg(display_layer_key, feature_count) FROM counts_by_layer),
            '{}'::jsonb
          ) AS counts_by_layer,
          COALESCE(
            (SELECT jsonb_object_agg(
              clause_id,
              jsonb_build_object('label', clause_label, 'count', feature_count)
            ) FROM counts_by_clause),
            '{}'::jsonb
          ) AS counts_by_clause,
          (
            SELECT CASE
              WHEN extent IS NULL THEN NULL
              ELSE ST_AsGeoJSON(ST_SetSRID(extent::geometry, 4326))::jsonb
            END
            FROM query_bounds
          ) AS bounds_geometry,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'object_id', object_id,
                'entity_type', entity_type,
                'display_layer_key', display_layer_key,
                'semantic_class', semantic_class,
                'label', label,
                'authority_status', authority_status,
                'confidence', confidence,
                'source_coverage_status', source_coverage_status,
                'provider', provider,
                'source_format', source_format,
                'source_family', source_family,
                'road_class', road_class,
                'building_type', building_type,
                'height_m', height_m,
                'floors', floors,
                'sap_score', sap_score,
                'energy_label', energy_label,
                'model_enrichments', model_enrichments,
                'land_use_class', land_use_class,
                'category', category,
                'distance_m', distance_m,
                'clause_id', clause_id,
                'clause_label', clause_label,
                'properties', properties,
                'geometry', ST_AsGeoJSON(display_geom)::jsonb
              )
              ORDER BY clause_priority ASC, layer_priority ASC, object_id ASC
            ) FILTER (WHERE object_id IS NOT NULL),
            '[]'::jsonb
          ) AS rows
        FROM limited
      `,
      values,
    )

    const row = result.rows[0] ?? {}
    const totalCount = Number(row.total_count ?? 0)
    const rawRows = Array.isArray(row.rows) ? row.rows : []
    const rows = needsFeaturePayload ? rawRows.slice(0, limit) : []
    const features = rows.map(rowToFeature).filter((feature) => feature.geometry)
    const truncated = needsFeaturePayload && totalCount > features.length && limit < totalCount
    const transportPolicy =
      geojsonTransportPolicySummary(geojsonPolicy, totalCount, features.length, truncated) ||
      selectionReferenceTransportPolicySummary(query, totalCount) ||
      directVisualTransportPolicySummary(visualPolicy, totalCount, features.length, truncated)
    const latencyMs = Date.now() - startedAt
    const normalized = normalizedPayload(query, surface, intent)
    const summary = {
      resultCount: totalCount,
      returned: features.length,
      truncated,
      countsBySemanticClass: row.counts_by_semantic_class ?? {},
      countsByLayer: row.counts_by_layer ?? {},
      countsByClause: row.counts_by_clause ?? {},
      bounds: boundsFromGeometry(row.bounds_geometry),
      ...(transportPolicy ? { transportPolicy } : {}),
    }
    const selectionReference = selectionReferenceForQuery({
      cityId,
      query,
      summary,
      surface,
      intent,
    })

    await recordTwinQueryEvent(pool, {
      cityId,
      surface,
      queryKind: query.language,
      intent,
      query: normalized,
      scope: query.scope,
      classes: query.classes,
      filters: query.clauses.map((clause) => ({
        clauseId: clause.id,
        where: clause.where,
      })),
      render: query.render,
      resultCount: totalCount,
      truncated,
      status: 'completed',
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      consumerKey: input.consumerKey ?? null,
      shareKey: input.shareKey ?? null,
      embedKey: input.embedKey ?? null,
      requestPath: input.requestPath ?? null,
      requestId: input.requestId ?? null,
      latencyMs,
      metadata: {
        ...(input.metadata ?? {}),
        operation: query.operation,
        payloadMode: needsFeaturePayload ? 'features' : 'tiles-only',
        ...(transportPolicy ? { transportPolicy } : {}),
      },
    })

    return {
      configured: true,
      ok: true,
      cityId,
      contract: getTwinQueryContract(),
      query: normalized,
      summary,
      ...(selectionReference ? { selectionReference } : {}),
      geojson: {
        type: 'FeatureCollection',
        features,
      },
      error: null,
    }
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    await recordTwinQueryEvent(pool, {
      cityId,
      surface,
      queryKind: query.language,
      intent,
      query: normalizedPayload(query, surface, intent),
      scope: query.scope,
      classes: query.classes,
      filters: query.clauses.map((clause) => ({
        clauseId: clause.id,
        where: clause.where,
      })),
      render: query.render,
      resultCount: 0,
      truncated: false,
      status: 'failed',
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      consumerKey: input.consumerKey ?? null,
      shareKey: input.shareKey ?? null,
      embedKey: input.embedKey ?? null,
      requestPath: input.requestPath ?? null,
      requestId: input.requestId ?? null,
      latencyMs,
      metadata: {
        ...(input.metadata ?? {}),
        operation: query.operation,
        error: String(error?.message ?? 'UNKNOWN_TWIN_QUERY_ERROR'),
      },
    })

    return {
      configured: true,
      ok: false,
      cityId,
      contract: getTwinQueryContract(),
      query: normalizedPayload(query, surface, intent),
      summary: emptyTwinQuerySummary(),
      geojson: { type: 'FeatureCollection', features: [] },
      error: String(error?.message ?? 'UNKNOWN_TWIN_QUERY_ERROR'),
    }
  }
}

async function runCityReadOnlySqlQuery(pool, cityId, input, query, surface, intent, startedAt) {
  const normalized = normalizedPayload(query, surface, intent)

  try {
    const limit = citySqlLimit(query)
    const requestedTransport = String(query.render?.transport ?? '').trim()
    if (requestedTransport === 'mvt') {
      try {
        const execution = await executeReadOnlyCitySqlGeometrySummary(pool, cityId, query)
        const totalCount = Number(execution.totalCount ?? 0)
        const latencyMs = Date.now() - startedAt
        const summary = {
          resultCount: totalCount,
          returned: 0,
          returnedFeatures: 0,
          returnedRows: 0,
          truncated: false,
          countsBySemanticClass: execution.countsBySemanticClass,
          countsByLayer: execution.countsByLayer,
          countsByClause: {},
          bounds: boundsFromGeometry(execution.boundsGeometry),
          transportPolicy: {
            transport: 'mvt',
            mode: 'read-only-city-sql-tiles',
            requestedMaxFeatures: limit,
            effectiveMaxFeatures: limit,
            returned: 0,
            resultCount: totalCount,
            truncated: false,
            featurePayload: false,
            note: 'Read-only city SQL exposed geom and is served to the map as MVT tiles.',
          },
        }

        await recordTwinQueryEvent(pool, {
          cityId,
          surface,
          queryKind: query.language,
          intent,
          query: normalized,
          scope: query.scope,
          classes: query.classes,
          filters: [{ sqlMode: 'select', sqlText: query.sqlText }],
          render: query.render,
          resultCount: totalCount,
          truncated: false,
          status: 'completed',
          actorUserId: input.actorUserId ?? null,
          actorRole: input.actorRole ?? null,
          consumerKey: input.consumerKey ?? null,
          shareKey: input.shareKey ?? null,
          embedKey: input.embedKey ?? null,
          requestPath: input.requestPath ?? null,
          requestId: input.requestId ?? null,
          latencyMs,
          metadata: {
            ...(input.metadata ?? {}),
            operation: query.operation,
            sqlMode: 'select',
            payloadMode: 'mvt',
            transportPolicy: summary.transportPolicy,
          },
        })

        return {
          configured: true,
          ok: true,
          cityId,
          contract: getTwinQueryContract(),
          query: normalized,
          summary,
          geojson: { type: 'FeatureCollection', features: [] },
          transport: 'mvt',
          error: null,
        }
      } catch (error) {
        if (String(error?.message ?? '') !== 'POSTGIS_SQL_SELECT_REQUIRES_GEOM') {
          throw error
        }
      }
    }

    const execution = await executeReadOnlyCitySql(pool, cityId, query, limit)
    const features = execution.rows.map(citySqlRowToFeature).filter((feature) => feature?.geometry)
    const tableRows = execution.rows.map(citySqlTableRow)
    const counts = citySqlLimitedCounts(execution.rows)
    const totalCount = Number(execution.totalCount ?? 0)
    const returned = features.length || tableRows.length
    const truncated = Boolean(execution.truncated || totalCount > execution.rows.length)
    const latencyMs = Date.now() - startedAt
    const transport = features.length ? 'geojson' : 'table'
    const summary = {
      resultCount: totalCount,
      returned,
      returnedFeatures: features.length,
      returnedRows: tableRows.length,
      truncated,
      countsBySemanticClass: counts.countsBySemanticClass,
      countsByLayer: counts.countsByLayer,
      countsByClause: {},
      bounds: boundsFromGeometry(execution.boundsGeometry),
      transportPolicy: {
        transport,
        mode: 'read-only-city-sql',
        requestedMaxFeatures: limit,
        effectiveMaxFeatures: limit,
        returned,
        resultCount: totalCount,
        truncated,
        featurePayload: features.length > 0,
        note: features.length
          ? 'Read-only city SQL returned map features from the selected geom column.'
          : 'Read-only city SQL returned tabular rows because the SELECT did not expose a geom column.',
      },
    }

    await recordTwinQueryEvent(pool, {
      cityId,
      surface,
      queryKind: query.language,
      intent,
      query: normalized,
      scope: query.scope,
      classes: query.classes,
      filters: [{ sqlMode: 'select', sqlText: query.sqlText }],
      render: query.render,
      resultCount: totalCount,
      truncated,
      status: 'completed',
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      consumerKey: input.consumerKey ?? null,
      shareKey: input.shareKey ?? null,
      embedKey: input.embedKey ?? null,
      requestPath: input.requestPath ?? null,
      requestId: input.requestId ?? null,
      latencyMs,
      metadata: {
        ...(input.metadata ?? {}),
        operation: query.operation,
        sqlMode: 'select',
        payloadMode: features.length ? 'features' : 'table',
        transportPolicy: summary.transportPolicy,
      },
    })

    return {
      configured: true,
      ok: true,
      cityId,
      contract: getTwinQueryContract(),
      query: normalized,
      summary,
      geojson: {
        type: 'FeatureCollection',
        features,
      },
      table: {
        columns: citySqlTableColumns(execution.rows),
        rows: tableRows,
      },
      transport,
      error: null,
    }
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    await recordTwinQueryEvent(pool, {
      cityId,
      surface,
      queryKind: query.language,
      intent,
      query: normalized,
      scope: query.scope,
      classes: query.classes,
      filters: [{ sqlMode: 'select', sqlText: query.sqlText }],
      render: query.render,
      resultCount: 0,
      truncated: false,
      status: 'failed',
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      consumerKey: input.consumerKey ?? null,
      shareKey: input.shareKey ?? null,
      embedKey: input.embedKey ?? null,
      requestPath: input.requestPath ?? null,
      requestId: input.requestId ?? null,
      latencyMs,
      metadata: {
        ...(input.metadata ?? {}),
        operation: query.operation,
        sqlMode: 'select',
        error: String(error?.message ?? 'UNKNOWN_CITY_SQL_ERROR'),
      },
    })

    return {
      configured: true,
      ok: false,
      cityId,
      contract: getTwinQueryContract(),
      query: normalized,
      summary: emptyTwinQuerySummary(),
      geojson: { type: 'FeatureCollection', features: [] },
      table: { columns: [], rows: [] },
      transport: 'table',
      error: String(error?.message ?? 'UNKNOWN_CITY_SQL_ERROR'),
    }
  }
}

function citySqlRowToSelectionObject(row = {}, index = 0) {
  const geometry = geometryFromCitySqlRow(row)
  const objectId = objectIdFromCitySqlRow(row, index)
  const geometryType = geometry?.type ? `ST_${geometry.type}` : null
  return {
    cityEntityId: row.city_entity_id || row.id || null,
    objectId,
    stableId: row.stable_id || row.stableId || objectId,
    semanticClass: semanticClassFromCitySqlRow(row),
    layerKey: layerKeyFromCitySqlRow(row),
    entityType: row.entity_type || row.entityType || '',
    label: row.label || row.name || objectId,
    geometryType,
    geometrySnapshot: geometry,
    clauseId: row.clause_id || null,
    clauseLabel: row.clause_label || null,
    distanceMeters: row.distance_m == null ? null : Number(row.distance_m),
    centroid: null,
    attributes: citySqlTableRow(row),
  }
}

export async function listCityTwinQueryObjectRows(cityId, input = {}, options = {}) {
  const pool = getProductionPool()
  const query = normalizeTwinQuery(input)
  const surface = normalizeSurface(input.surface ?? input.query?.surface)
  const intent = normalizeIntent(input.intent ?? input.query?.intent)
  const normalized = normalizedPayload(query, surface, intent)
  const rowLimit = clampSelectionLimit(options.limit ?? input.selectionLimit ?? input.maxSelectionMembers)

  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      query: normalized,
      rows: [],
      summary: emptyTwinQuerySummary({ rowLimit }),
      error: null,
    }
  }

  if (query.sqlMode === 'select' && query.sqlText) {
    try {
      const execution = await executeReadOnlyCitySql(pool, cityId, query, rowLimit)
      const rows = execution.rows.slice(0, rowLimit).map(citySqlRowToSelectionObject)
      const counts = citySqlLimitedCounts(execution.rows)
      const totalCount = Number(execution.totalCount ?? 0)
      return {
        configured: true,
        ok: true,
        cityId,
        query: normalized,
        rows,
        summary: {
          resultCount: totalCount,
          returned: rows.length,
          truncated: Boolean(execution.truncated || totalCount > rows.length),
          rowLimit,
          countsBySemanticClass: counts.countsBySemanticClass,
          countsByLayer: counts.countsByLayer,
          countsByClause: {},
          bounds: boundsFromGeometry(execution.boundsGeometry),
        },
        error: null,
      }
    } catch (error) {
      return {
        configured: true,
        ok: false,
        cityId,
        query: normalized,
        rows: [],
        summary: emptyTwinQuerySummary({ rowLimit }),
        error: String(error?.message ?? 'TWIN_QUERY_SELECTION_ROWS_UNAVAILABLE'),
      }
    }
  }

  const values = []
  const addParam = (value) => {
    values.push(value)
    return `$${values.length}`
  }

  const objectJsonSql = `
    jsonb_build_object(
      'city_entity_id', id::text,
      'object_id', object_id,
      'entity_type', entity_type,
      'layer_key', display_layer_key,
      'semantic_class', semantic_class,
      'label', label,
      'geometry_type', ST_GeometryType(display_geom),
      'geometry_snapshot', ST_AsGeoJSON(display_geom)::jsonb,
      'clause_id', clause_id,
      'clause_label', clause_label,
      'distance_m', distance_m,
      'centroid_lon', ST_X(ST_PointOnSurface(display_geom)),
      'centroid_lat', ST_Y(ST_PointOnSurface(display_geom)),
      'attributes', jsonb_strip_nulls(jsonb_build_object(
        'authorityStatus', authority_status,
        'confidence', confidence,
        'sourceCoverageStatus', source_coverage_status,
        'provider', provider,
        'sourceFormat', source_format,
        'sourceFamily', source_family,
        'roadClass', road_class,
        'buildingType', building_type,
        'heightMeters', height_m,
        'floors', floors,
        'sapScore', sap_score,
        'energyLabel', energy_label,
        'modelEnrichments', model_enrichments,
        'landUseClass', land_use_class,
        'category', category,
        'placeType', place_type,
        'footprintAreaM2', footprint_area_m2,
        'builtFormProxy', built_form_proxy,
        'heatProxy', heat_proxy,
        'airRoughnessProxy', air_roughness_proxy,
        'greenBlueCoolingProxy', green_blue_cooling_proxy,
        'solarExposureProxy', solar_exposure_proxy,
        'waterFlowProxy', water_flow_proxy,
        'weatherAirTemperatureC', weather_air_temperature_c,
        'weatherWindSpeedMs', weather_wind_speed_ms,
        'weatherWindDirectionDeg', weather_wind_direction_deg
      ))
    )
  `

  try {
    const cityParam = addParam(cityId)
    const limitParam = addParam(rowLimit + 1)
    const layerPriorityCase = layerPriorityCaseSql()
    let filteredSql = ''
    let clauseSummarySql = `'{}'::jsonb`

    if (Array.isArray(query.clauses) && query.clauses.length) {
      const clauseSql = query.clauses.map((clause, index) => {
        const scopeName = `query_scope_${index}`
        const filteredName = `filtered_${index}`
        const clauseIdParam = addParam(clause.id)
        const clauseLabelParam = addParam(clause.label)
        const clauseClassParam = addParam(clause.classes)
        const clauseScopeKeyParam = addParam(clause.scope.key)
        const clauseCenterLonParam = addParam(clause.scope.center?.[0] ?? null)
        const clauseCenterLatParam = addParam(clause.scope.center?.[1] ?? null)
        const scopeSql = scopeCteSql(clause.scope, addParam)
        const whereSql = [
          compileTwinQueryWhere(clause.where, addParam),
          compilePostgisSqlWhere(clause.sqlWhere ?? query.sqlWhere),
        ].filter(Boolean).join('\n')

        return {
          filteredName,
          sql: `
            ${scopeName} AS (
              ${scopeSql}
            ),
            ${filteredName} AS (
              SELECT
                co.*,
                ${clauseIdParam}::text AS clause_id,
                ${clauseLabelParam}::text AS clause_label,
                ${index}::int AS clause_priority,
                ${clippedGeometrySql('co.geom', 'qs.geom', clauseScopeKeyParam)} AS display_geom,
                CASE
                  WHEN ${clauseScopeKeyParam} = 'radius' THEN ST_DistanceSphere(
                    ST_PointOnSurface(co.geom),
                    ST_SetSRID(ST_MakePoint(
                      ${clauseCenterLonParam}::double precision,
                      ${clauseCenterLatParam}::double precision
                    ), 4326)
                  )
                  ELSE NULL
                END AS distance_m
              FROM ldt_query.city_objects_enriched co
              CROSS JOIN ${scopeName} qs
              WHERE co.city_id = ${cityParam}
                AND co.geom IS NOT NULL
                AND co.semantic_class = ANY(${clauseClassParam}::text[])
                AND (qs.geom IS NULL OR (co.geom && qs.geom AND ST_Intersects(co.geom, qs.geom)))
                ${whereSql}
            )
          `,
        }
      })

      filteredSql = `
        ${clauseSql.map((clause) => clause.sql).join(',\n')},
        all_filtered AS (
          ${clauseSql.map((clause) => `SELECT * FROM ${clause.filteredName}`).join('\n          UNION ALL\n          ')}
        ),
        filtered AS (
          SELECT *
          FROM (
            SELECT
              *,
              row_number() OVER (
                PARTITION BY object_id
                ORDER BY clause_priority ASC, semantic_class ASC, object_id ASC
              ) AS query_clause_rank
            FROM all_filtered
            WHERE display_geom IS NOT NULL
              AND NOT ST_IsEmpty(display_geom)
          ) ranked
          WHERE query_clause_rank = 1
        )
      `
      clauseSummarySql = `
        COALESCE(
          (
            SELECT jsonb_object_agg(
              clause_id,
              jsonb_build_object('label', clause_label, 'count', feature_count)
            )
            FROM (
              SELECT clause_id, max(clause_label) AS clause_label, count(*)::int AS feature_count
              FROM filtered
              GROUP BY clause_id
            ) counts_by_clause
          ),
          '{}'::jsonb
        )
      `
    } else {
      const classParam = addParam(query.classes)
      const scopeKeyParam = addParam(query.scope.key)
      const centerLonParam = addParam(query.scope.center?.[0] ?? null)
      const centerLatParam = addParam(query.scope.center?.[1] ?? null)
      const scopeSql = scopeCteSql(query.scope, addParam)
      const whereSql = [
        compileTwinQueryWhere(query.where, addParam),
        compilePostgisSqlWhere(query.sqlWhere),
      ].filter(Boolean).join('\n')

      filteredSql = `
        query_scope AS (
          ${scopeSql}
        ),
        raw_filtered AS (
          SELECT
            co.*,
            NULL::text AS clause_id,
            NULL::text AS clause_label,
            0::int AS clause_priority,
            ${clippedGeometrySql('co.geom', 'qs.geom', scopeKeyParam)} AS display_geom,
            CASE
              WHEN ${scopeKeyParam} = 'radius' THEN ST_DistanceSphere(
                ST_PointOnSurface(co.geom),
                ST_SetSRID(ST_MakePoint(
                  ${centerLonParam}::double precision,
                  ${centerLatParam}::double precision
                ), 4326)
              )
              ELSE NULL
            END AS distance_m
          FROM ldt_query.city_objects_enriched co
          CROSS JOIN query_scope qs
          WHERE co.city_id = ${cityParam}
            AND co.geom IS NOT NULL
            AND co.semantic_class = ANY(${classParam}::text[])
            AND (qs.geom IS NULL OR (co.geom && qs.geom AND ST_Intersects(co.geom, qs.geom)))
            ${whereSql}
        ),
        filtered AS (
          SELECT *
          FROM raw_filtered
          WHERE display_geom IS NOT NULL
            AND NOT ST_IsEmpty(display_geom)
        )
      `
    }

    const result = await pool.query(
      `
        WITH latest_boundary AS (
          SELECT geom
          FROM ldt_core.city_boundaries
          WHERE city_id = ${cityParam}
            AND lower(COALESCE(boundary_role, '')) NOT LIKE '%test%'
            AND lower(COALESCE(properties->>'source', '')) NOT LIKE '%smoke%'
          ORDER BY CASE boundary_role WHEN 'municipality' THEN 0 WHEN 'administrative' THEN 1 ELSE 2 END,
            created_at DESC,
            id DESC
          LIMIT 1
        ),
        ${filteredSql},
        query_bounds AS (
          SELECT ST_Extent(display_geom) AS extent
          FROM filtered
          WHERE display_geom IS NOT NULL
            AND NOT ST_IsEmpty(display_geom)
        ),
        limited AS (
          SELECT
            *,
            ${layerPriorityCase} AS layer_priority
          FROM filtered
          WHERE display_geom IS NOT NULL
            AND NOT ST_IsEmpty(display_geom)
          ORDER BY clause_priority ASC, layer_priority ASC, object_id ASC
          LIMIT ${limitParam}
        ),
        counts_by_class AS (
          SELECT semantic_class, count(*)::int AS feature_count
          FROM filtered
          GROUP BY semantic_class
        ),
        counts_by_layer AS (
          SELECT display_layer_key, count(*)::int AS feature_count
          FROM filtered
          GROUP BY display_layer_key
        )
        SELECT
          (SELECT count(*)::int FROM filtered) AS total_count,
          COALESCE(
            (SELECT jsonb_object_agg(semantic_class, feature_count) FROM counts_by_class),
            '{}'::jsonb
          ) AS counts_by_semantic_class,
          COALESCE(
            (SELECT jsonb_object_agg(display_layer_key, feature_count) FROM counts_by_layer),
            '{}'::jsonb
          ) AS counts_by_layer,
          ${clauseSummarySql} AS counts_by_clause,
          (
            SELECT CASE
              WHEN extent IS NULL THEN NULL
              ELSE ST_AsGeoJSON(ST_SetSRID(extent::geometry, 4326))::jsonb
            END
            FROM query_bounds
          ) AS bounds_geometry,
          COALESCE(
            jsonb_agg(${objectJsonSql} ORDER BY clause_priority ASC, layer_priority ASC, object_id ASC)
              FILTER (WHERE object_id IS NOT NULL),
            '[]'::jsonb
          ) AS rows
        FROM limited
      `,
      values,
    )

    const row = result.rows[0] ?? {}
    const totalCount = Number(row.total_count ?? 0)
    const rawRows = Array.isArray(row.rows) ? row.rows : []
    const rows = rawRows.slice(0, rowLimit).map(rowToSelectionObject)
    const truncated = totalCount > rows.length

    return {
      configured: true,
      ok: true,
      cityId,
      query: normalized,
      rows,
      summary: {
        resultCount: totalCount,
        returned: rows.length,
        truncated,
        rowLimit,
        countsBySemanticClass: row.counts_by_semantic_class ?? {},
        countsByLayer: row.counts_by_layer ?? {},
        countsByClause: row.counts_by_clause ?? {},
        bounds: boundsFromGeometry(row.bounds_geometry),
      },
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      query: normalized,
      rows: [],
      summary: emptyTwinQuerySummary({ rowLimit }),
      error: String(error?.message ?? 'TWIN_QUERY_SELECTION_ROWS_UNAVAILABLE'),
    }
  }
}

export async function runCityTwinQuery(cityId, input = {}) {
  const pool = getProductionPool()
  const rawQuery = normalizeTwinQuery(input)
  const surface = normalizeSurface(input.surface ?? input.query?.surface)
  const intent = normalizeIntent(input.intent ?? input.query?.intent)
  const visualPlan = planTwinQueryVisualTransport(rawQuery, {
    intent,
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
  })
  const query = visualPlan.query
  const startedAt = Date.now()

  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      query: normalizedPayload(query, surface, intent),
      summary: emptyTwinQuerySummary(),
      geojson: { type: 'FeatureCollection', features: [] },
      error: null,
    }
  }

  if (Array.isArray(query.clauses) && query.clauses.length) {
    return runCityTwinQueryClauses(pool, cityId, input, query, surface, intent, startedAt, visualPlan.policy)
  }

  if (query.sqlMode === 'select' && query.sqlText) {
    return runCityReadOnlySqlQuery(pool, cityId, input, query, surface, intent, startedAt)
  }

  const values = []
  const addParam = (value) => {
    values.push(value)
    return `$${values.length}`
  }

  try {
    const cityParam = addParam(cityId)
    const classParam = addParam(query.classes)
    const scopeKeyParam = addParam(query.scope.key)
    const transport = String(query.render?.transport ?? '').trim()
    const geojsonPolicy = geojsonTransportPolicy(query)
    const needsFeaturePayload = twinQueryNeedsFeaturePayload(query)
    const requestedFeatureLimit = geojsonPolicy.active ? geojsonPolicy.effectiveMaxFeatures : query.render.maxFeatures
    const limit = needsFeaturePayload ? Math.min(MAX_TWIN_QUERY_LIMIT, requestedFeatureLimit) : 0
    const queryLimit = limit <= 0 ? 0 : Math.min(MAX_TWIN_QUERY_LIMIT + 1, limit + 1)
    const limitParam = addParam(queryLimit)
    const scopeSql = scopeCteSql(query.scope, addParam)
    const whereSql = [
      compileTwinQueryWhere(query.where, addParam),
      compilePostgisSqlWhere(query.sqlWhere),
    ].filter(Boolean).join('\n')
    const layerPriorityCase = layerPriorityCaseSql()

    const result = await pool.query(
      `
        WITH latest_boundary AS (
          SELECT geom
          FROM ldt_core.city_boundaries
          WHERE city_id = ${cityParam}
            AND lower(COALESCE(boundary_role, '')) NOT LIKE '%test%'
            AND lower(COALESCE(properties->>'source', '')) NOT LIKE '%smoke%'
          ORDER BY CASE boundary_role WHEN 'municipality' THEN 0 WHEN 'administrative' THEN 1 ELSE 2 END,
            created_at DESC,
            id DESC
          LIMIT 1
        ),
        query_scope AS (
          ${scopeSql}
        ),
        raw_filtered AS (
          SELECT
            co.*,
            ${clippedGeometrySql('co.geom', 'qs.geom', scopeKeyParam)} AS display_geom,
            CASE
              WHEN ${scopeKeyParam} = 'radius' THEN ST_DistanceSphere(
                ST_PointOnSurface(co.geom),
                ST_SetSRID(ST_MakePoint(
                  ${(query.scope.center ? addParam(query.scope.center[0]) : addParam(null))}::double precision,
                  ${(query.scope.center ? addParam(query.scope.center[1]) : addParam(null))}::double precision
                ), 4326)
              )
              ELSE NULL
            END AS distance_m
          FROM ldt_query.city_objects_enriched co
          CROSS JOIN query_scope qs
          WHERE co.city_id = ${cityParam}
            AND (qs.geom IS NULL OR (co.geom && qs.geom AND ST_Intersects(co.geom, qs.geom)))
            AND co.semantic_class = ANY(${classParam}::text[])
            ${whereSql}
        ),
        filtered AS (
          SELECT *
          FROM raw_filtered
          WHERE display_geom IS NOT NULL
            AND NOT ST_IsEmpty(display_geom)
        ),
        query_bounds AS (
          SELECT ST_Extent(display_geom) AS extent
          FROM filtered
          WHERE display_geom IS NOT NULL
            AND NOT ST_IsEmpty(display_geom)
        ),
        limited AS (
          SELECT
            *,
            ${layerPriorityCase} AS layer_priority
          FROM filtered
          WHERE display_geom IS NOT NULL
            AND NOT ST_IsEmpty(display_geom)
          ORDER BY layer_priority ASC, object_id ASC
          LIMIT ${limitParam}
        ),
        counts_by_class AS (
          SELECT semantic_class, count(*)::int AS feature_count
          FROM filtered
          GROUP BY semantic_class
        ),
        counts_by_layer AS (
          SELECT display_layer_key, count(*)::int AS feature_count
          FROM filtered
          GROUP BY display_layer_key
        )
        SELECT
          (SELECT count(*)::int FROM filtered) AS total_count,
          COALESCE(
            (SELECT jsonb_object_agg(semantic_class, feature_count) FROM counts_by_class),
            '{}'::jsonb
          ) AS counts_by_semantic_class,
          COALESCE(
            (SELECT jsonb_object_agg(display_layer_key, feature_count) FROM counts_by_layer),
            '{}'::jsonb
          ) AS counts_by_layer,
          (
            SELECT CASE
              WHEN extent IS NULL THEN NULL
              ELSE ST_AsGeoJSON(ST_SetSRID(extent::geometry, 4326))::jsonb
            END
            FROM query_bounds
          ) AS bounds_geometry,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'object_id', object_id,
                'entity_type', entity_type,
                'display_layer_key', display_layer_key,
                'semantic_class', semantic_class,
                'label', label,
                'authority_status', authority_status,
                'confidence', confidence,
                'source_coverage_status', source_coverage_status,
                'provider', provider,
                'source_format', source_format,
                'source_family', source_family,
                'road_class', road_class,
                'building_type', building_type,
                'height_m', height_m,
                'floors', floors,
                'sap_score', sap_score,
                'energy_label', energy_label,
                'model_enrichments', model_enrichments,
                'land_use_class', land_use_class,
                'category', category,
                'distance_m', distance_m,
                'properties', properties,
                'geometry', ST_AsGeoJSON(display_geom)::jsonb
              )
              ORDER BY layer_priority ASC, object_id ASC
            ) FILTER (WHERE object_id IS NOT NULL),
            '[]'::jsonb
          ) AS rows
        FROM limited
      `,
      values,
    )

    const row = result.rows[0] ?? {}
    const totalCount = Number(row.total_count ?? 0)
    const rawRows = Array.isArray(row.rows) ? row.rows : []
    const rows = needsFeaturePayload ? rawRows.slice(0, limit) : []
    const features = rows.map(rowToFeature).filter((feature) => feature.geometry)
    const truncated = needsFeaturePayload && totalCount > features.length && limit < totalCount
    const transportPolicy =
      geojsonTransportPolicySummary(geojsonPolicy, totalCount, features.length, truncated) ||
      selectionReferenceTransportPolicySummary(query, totalCount) ||
      directVisualTransportPolicySummary(visualPlan.policy, totalCount, features.length, truncated)
    const latencyMs = Date.now() - startedAt
    const normalized = normalizedPayload(query, surface, intent)
    const summary = {
      resultCount: totalCount,
      returned: features.length,
      truncated,
      countsBySemanticClass: row.counts_by_semantic_class ?? {},
      countsByLayer: row.counts_by_layer ?? {},
      countsByClause: {},
      bounds: boundsFromGeometry(row.bounds_geometry),
      ...(transportPolicy ? { transportPolicy } : {}),
    }
    const selectionReference = selectionReferenceForQuery({
      cityId,
      query,
      summary,
      surface,
      intent,
    })

    await recordTwinQueryEvent(pool, {
      cityId,
      surface,
      queryKind: query.language,
      intent,
      query: normalized,
      scope: query.scope,
      classes: query.classes,
      filters: query.where ? [query.where] : [],
      render: query.render,
      resultCount: totalCount,
      truncated,
      status: 'completed',
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      consumerKey: input.consumerKey ?? null,
      shareKey: input.shareKey ?? null,
      embedKey: input.embedKey ?? null,
      requestPath: input.requestPath ?? null,
      requestId: input.requestId ?? null,
      latencyMs,
      metadata: {
        ...(input.metadata ?? {}),
        payloadMode: needsFeaturePayload ? 'features' : 'tiles-only',
        ...(transportPolicy ? { transportPolicy } : {}),
      },
    })

    return {
      configured: true,
      ok: true,
      cityId,
      contract: getTwinQueryContract(),
      query: normalized,
      summary,
      ...(selectionReference ? { selectionReference } : {}),
      geojson: {
        type: 'FeatureCollection',
        features,
      },
      error: null,
    }
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    await recordTwinQueryEvent(pool, {
      cityId,
      surface,
      queryKind: query.language,
      intent,
      query: normalizedPayload(query, surface, intent),
      scope: query.scope,
      classes: query.classes,
      filters: query.where ? [query.where] : [],
      render: query.render,
      resultCount: 0,
      truncated: false,
      status: 'failed',
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      consumerKey: input.consumerKey ?? null,
      shareKey: input.shareKey ?? null,
      embedKey: input.embedKey ?? null,
      requestPath: input.requestPath ?? null,
      requestId: input.requestId ?? null,
      latencyMs,
      metadata: {
        ...(input.metadata ?? {}),
        error: String(error?.message ?? 'UNKNOWN_TWIN_QUERY_ERROR'),
      },
    })
    return {
      configured: true,
      ok: false,
      cityId,
      contract: getTwinQueryContract(),
      query: normalizedPayload(query, surface, intent),
      summary: emptyTwinQuerySummary(),
      geojson: { type: 'FeatureCollection', features: [] },
      error: String(error?.message ?? 'UNKNOWN_TWIN_QUERY_ERROR'),
    }
  }
}
