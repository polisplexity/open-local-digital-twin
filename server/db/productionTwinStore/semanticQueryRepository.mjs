import { getProductionPool } from '../postgisPool.mjs'
import { semanticClassDefinitions } from '../../services/baseTwin/viewerContracts/semanticQueryContract.mjs'
import { viewerFeatureProperties } from './featurePresentation.mjs'
import { parseMaybeJson } from './repositoryUtils.mjs'

const DEFAULT_SEMANTIC_QUERY_LIMIT = integerEnv('TWIN_STUDIO_SEMANTIC_QUERY_DEFAULT_LIMIT', 5000)
const MAX_SEMANTIC_QUERY_LIMIT = integerEnv('TWIN_STUDIO_SEMANTIC_QUERY_MAX_LIMIT', 50000)
const DEFAULT_CLASSES = ['buildings', 'roads', 'greenBlue', 'places', 'accessSeeds']
const SURFACES = new Set(['map', 'municipal3d', 'immersive', 'api'])
const INTENTS = new Set(['inspection', 'analysis', 'simulation', 'operations', 'embed', 'export', 'unknown'])
const STRING_OPERATORS = new Set(['eq', 'neq', 'in', 'contains', 'exists'])
const NUMBER_OPERATORS = new Set(['eq', 'neq', 'in', 'gte', 'lte', 'between', 'exists'])

const SEMANTIC_CLASSES = semanticClassDefinitions()
const SEMANTIC_CLASS_BY_KEY = new Map(SEMANTIC_CLASSES.map((entry) => [entry.key, entry]))

function integerEnv(name, fallback) {
  const number = Math.trunc(Number(process.env[name]))
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function clampInteger(value, fallback, min, max) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function parseJsonish(value, fallback = null) {
  if (value == null || value === '') return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch {
    return fallback
  }
}

function normalizeTextArray(value, fallback = []) {
  if (Array.isArray(value)) {
    const values = value.map((entry) => compactText(entry)).filter(Boolean)
    return values.length ? values : fallback
  }
  const parsed = parseJsonish(value, null)
  if (Array.isArray(parsed)) return normalizeTextArray(parsed, fallback)
  const values = String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return values.length ? values : fallback
}

function normalizeSurface(value) {
  const surface = compactText(value, 'map')
  return SURFACES.has(surface) ? surface : 'map'
}

function normalizeIntent(value) {
  const intent = compactText(value, 'analysis')
  return INTENTS.has(intent) ? intent : 'unknown'
}

function normalizePoint(value) {
  if (value == null || value === '') return null
  const raw = Array.isArray(value) ? value : String(value).split(',')
  const numbers = raw.map(finiteNumber)
  if (numbers.length !== 2 || numbers.some((entry) => entry == null)) return null
  const [lon, lat] = numbers
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null
  return [lon, lat]
}

function normalizeBbox(value) {
  if (value == null || value === '') return null
  const raw = Array.isArray(value) ? value : String(value).split(',')
  const numbers = raw.map(finiteNumber)
  if (numbers.length !== 4 || numbers.some((entry) => entry == null)) return null
  const [minLon, minLat, maxLon, maxLat] = numbers
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90 || minLon >= maxLon || minLat >= maxLat) return null
  return [minLon, minLat, maxLon, maxLat]
}

function normalizeScope(rawScope = {}, source = {}) {
  const scope = rawScope && typeof rawScope === 'object' ? { ...rawScope } : {}
  const key = compactText(
    scope.key ?? scope.mode ?? scope.type ?? source.scopeKey ?? source.scopeType ?? source.scope,
    source.bbox ? 'viewport' : 'city',
  )
  const bbox = normalizeBbox(scope.bbox ?? source.bbox)
  const center = normalizePoint(scope.center ?? source.center)
  const radiusMeters = finiteNumber(scope.radiusMeters ?? scope.radius ?? source.radiusMeters ?? source.radius)
  const geometry = scope.geometry ?? parseJsonish(source.geometry, null)

  if (key === 'radius') {
    if (!center || radiusMeters == null || radiusMeters <= 0) {
      throw new Error('SEMANTIC_QUERY_RADIUS_REQUIRES_CENTER_AND_POSITIVE_RADIUS')
    }
    return { key, center, radiusMeters }
  }

  if (key === 'viewport' || key === 'bbox') {
    if (!bbox) throw new Error('SEMANTIC_QUERY_VIEWPORT_REQUIRES_BBOX')
    return { key: 'viewport', bbox }
  }

  if (key === 'customPolygon') {
    if (!geometry || typeof geometry !== 'object') {
      throw new Error('SEMANTIC_QUERY_CUSTOM_POLYGON_REQUIRES_GEOJSON_GEOMETRY')
    }
    return { key, geometry }
  }

  return { key: 'city' }
}

function normalizeRender(rawRender = {}, source = {}) {
  const render = rawRender && typeof rawRender === 'object' ? rawRender : {}
  return {
    mode: compactText(render.mode ?? source.renderMode ?? source.mode, 'isolate'),
    maxFeatures: clampInteger(
      render.maxFeatures ?? source.maxFeatures ?? source.limit,
      DEFAULT_SEMANTIC_QUERY_LIMIT,
      0,
      MAX_SEMANTIC_QUERY_LIMIT,
    ),
  }
}

function normalizeFilters(value) {
  const raw = parseJsonish(value, value)
  if (!Array.isArray(raw)) return []
  return raw
    .map((filter) => {
      if (!filter || typeof filter !== 'object') return null
      const field = compactText(filter.field)
      const operator = compactText(filter.operator, 'eq')
      if (!field || !operator) return null
      return {
        field,
        operator,
        value: filter.value,
      }
    })
    .filter(Boolean)
}

function normalizeSemanticQuery(input = {}) {
  const query = input.query && typeof input.query === 'object' ? input.query : input
  const classes = normalizeTextArray(query.classes ?? query.class ?? input.classes, DEFAULT_CLASSES)
    .filter((key) => SEMANTIC_CLASS_BY_KEY.has(key))
  const selectedClasses = classes.length ? Array.from(new Set(classes)) : DEFAULT_CLASSES
  const filters = normalizeFilters(query.filters ?? input.filters)
  const scope = normalizeScope(query.scope, input)
  const render = normalizeRender(query.render, input)

  return {
    classes: selectedClasses,
    scope,
    filters,
    combine: compactText(query.combine ?? input.combine, 'and') === 'or' ? 'or' : 'and',
    render,
  }
}

function semanticClassLayerKeys(classKeys) {
  return Array.from(new Set(classKeys.flatMap((key) => SEMANTIC_CLASS_BY_KEY.get(key)?.layerKeys ?? [])))
}

function semanticClassEntityTypes(classKeys) {
  return Array.from(new Set(classKeys.flatMap((key) => SEMANTIC_CLASS_BY_KEY.get(key)?.entityTypes ?? [])))
}

function fieldExpression(field) {
  const text = (sql) => ({ sql, type: 'text' })
  const number = (sql) => ({ sql, type: 'number' })
  switch (field) {
    case 'authorityStatus':
      return text('cf.authority_status')
    case 'confidence':
      return text('cf.confidence')
    case 'sourceCoverageStatus':
      return text("cf.properties->>'source_coverage_status'")
    case 'label':
      return text('cf.label')
    case 'layerKey':
      return text('COALESCE(ld.key, cf.feature_type)')
    case 'entityType':
      return text('cf.feature_type')
    case 'roadClass':
      return text("cf.properties->>'highway'")
    case 'name':
      return text("COALESCE(cf.properties->>'name', cf.label)")
    case 'heightMeters':
      return number("NULLIF((regexp_match(COALESCE(cf.properties->>'height_m', cf.properties->>'height', cf.properties->>'building:height', ''), '[-+]?[0-9]+(\\.[0-9]+)?'))[1], '')::double precision")
    case 'floors':
      return number("NULLIF((regexp_match(COALESCE(cf.properties->>'levels', cf.properties->>'building:levels', cf.properties->>'estimated_floors', ''), '[-+]?[0-9]+(\\.[0-9]+)?'))[1], '')::double precision")
    case 'buildingType':
      return text("cf.properties->>'building'")
    case 'bimStatus':
      return text("cf.properties->>'bim_status'")
    case 'category':
    case 'landUseCategory':
      return text("COALESCE(cf.properties->>'category', cf.properties->>'amenity', cf.properties->>'shop', cf.properties->>'public_transport', cf.properties->>'landuse', cf.properties->>'natural', cf.properties->>'leisure')")
    case 'placeType':
      return text("cf.properties->>'place'")
    case 'seedFamily':
      return text('COALESCE(ld.key, cf.feature_type)')
    case 'packKey':
      return text("cf.properties->>'pack_key'")
    case 'serviceDomain':
      return text("cf.properties->>'service_domain'")
    case 'provider':
      return text("COALESCE(ld.provider_id, cf.properties->>'provider', cf.properties->>'source')")
    case 'sourceFormat':
      return text("COALESCE(ld.metadata->>'sourceFormat', ld.metadata->>'source_format', cf.properties->>'source_format')")
    case 'gapRatio':
      return number("NULLIF((regexp_match(COALESCE(cf.properties->>'gap_ratio', cf.properties->>'gapRatio', ''), '[-+]?[0-9]+(\\.[0-9]+)?'))[1], '')::double precision")
    default:
      return null
  }
}

function buildFilterSql(filter, addParam) {
  const expression = fieldExpression(filter.field)
  if (!expression) {
    throw new Error(`SEMANTIC_QUERY_UNSUPPORTED_FIELD:${filter.field}`)
  }
  const allowedOperators = expression.type === 'number' ? NUMBER_OPERATORS : STRING_OPERATORS
  if (!allowedOperators.has(filter.operator)) {
    throw new Error(`SEMANTIC_QUERY_UNSUPPORTED_OPERATOR:${filter.field}:${filter.operator}`)
  }

  const sql = expression.sql
  if (filter.operator === 'exists') {
    return filter.value === false ? `${sql} IS NULL` : `${sql} IS NOT NULL`
  }

  if (expression.type === 'number') {
    if (filter.operator === 'between') {
      const values = Array.isArray(filter.value) ? filter.value.map(finiteNumber) : []
      if (values.length !== 2 || values.some((entry) => entry == null)) {
        throw new Error(`SEMANTIC_QUERY_BETWEEN_REQUIRES_TWO_NUMBERS:${filter.field}`)
      }
      return `${sql} BETWEEN ${addParam(values[0])}::double precision AND ${addParam(values[1])}::double precision`
    }
    if (filter.operator === 'in') {
      const values = Array.isArray(filter.value) ? filter.value.map(finiteNumber).filter((entry) => entry != null) : []
      if (!values.length) throw new Error(`SEMANTIC_QUERY_IN_REQUIRES_VALUES:${filter.field}`)
      return `${sql} = ANY(${addParam(values)}::double precision[])`
    }
    const value = finiteNumber(filter.value)
    if (value == null) throw new Error(`SEMANTIC_QUERY_NUMERIC_VALUE_REQUIRED:${filter.field}`)
    if (filter.operator === 'eq') return `${sql} = ${addParam(value)}::double precision`
    if (filter.operator === 'neq') return `${sql} <> ${addParam(value)}::double precision`
    if (filter.operator === 'gte') return `${sql} >= ${addParam(value)}::double precision`
    if (filter.operator === 'lte') return `${sql} <= ${addParam(value)}::double precision`
  }

  if (filter.operator === 'in') {
    const values = normalizeTextArray(filter.value)
    if (!values.length) throw new Error(`SEMANTIC_QUERY_IN_REQUIRES_VALUES:${filter.field}`)
    return `${sql} = ANY(${addParam(values)}::text[])`
  }
  if (filter.operator === 'contains') {
    return `${sql} ILIKE ${addParam(`%${compactText(filter.value)}%`)}`
  }
  const value = compactText(filter.value)
  if (filter.operator === 'eq') return `${sql} = ${addParam(value)}`
  if (filter.operator === 'neq') return `${sql} <> ${addParam(value)}`
  throw new Error(`SEMANTIC_QUERY_UNSUPPORTED_OPERATOR:${filter.operator}`)
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

function semanticClassCaseSql() {
  return `
    CASE
      WHEN display_layer_key = 'buildings' THEN 'buildings'
      WHEN display_layer_key = 'roads' THEN 'roads'
      WHEN display_layer_key = 'boundary' THEN 'boundary'
      WHEN display_layer_key = 'unclassifiedLand' THEN 'landUseCoverageGap'
      WHEN display_layer_key = 'greenBlue' THEN 'greenBlue'
      WHEN display_layer_key = 'places' THEN 'places'
      WHEN display_layer_key IN ('civic', 'mobility', 'commerce', 'wasteSeeds', 'facilities') THEN 'accessSeeds'
      WHEN display_layer_key = 'semanticPacks' THEN 'semanticPacks'
      WHEN display_layer_key = 'providerOverlays' THEN 'providerOverlays'
      ELSE display_layer_key
    END
  `
}

function layerPriorityCaseSql() {
  return `
    CASE semantic_class_key
      WHEN 'boundary' THEN 0
      WHEN 'roads' THEN 1
      WHEN 'greenBlue' THEN 2
      WHEN 'accessSeeds' THEN 3
      WHEN 'places' THEN 4
      WHEN 'buildings' THEN 5
      WHEN 'semanticPacks' THEN 6
      ELSE 9
    END
  `
}

function normalizedQueryPayload(query, surface, intent) {
  return {
    classes: query.classes,
    scope: query.scope,
    filters: query.filters,
    combine: query.combine,
    render: query.render,
    surface,
    intent,
  }
}

async function recordSemanticQueryEvent(pool, event) {
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
        JSON.stringify(event.filters),
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
    // Query execution must not fail just because observability is unavailable.
  }
}

function rowToFeature(row) {
  return {
    type: 'Feature',
    id: row.stable_id,
    properties: {
      ...viewerFeatureProperties(row),
      semanticClass: row.semantic_class_key,
      queryLayerKey: row.display_layer_key,
      distanceMeters: row.distance_m == null ? null : Number(row.distance_m),
    },
    geometry: parseMaybeJson(row.geometry, null),
  }
}

export async function runCitySemanticQuery(cityId, input = {}) {
  const pool = getProductionPool()
  const query = normalizeSemanticQuery(input)
  const surface = normalizeSurface(input.surface ?? input.query?.surface)
  const intent = normalizeIntent(input.intent ?? input.query?.intent)
  const startedAt = Date.now()

  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      query: normalizedQueryPayload(query, surface, intent),
      summary: {
        resultCount: 0,
        returned: 0,
        truncated: false,
        countsBySemanticClass: {},
        countsByLayer: {},
      },
      geojson: { type: 'FeatureCollection', features: [] },
      error: null,
    }
  }

  const values = []
  const addParam = (value) => {
    values.push(value)
    return `$${values.length}`
  }

  try {
    const layerKeys = semanticClassLayerKeys(query.classes)
    const entityTypes = semanticClassEntityTypes(query.classes)
    const classParam = addParam(query.classes)
    const layerParam = addParam(layerKeys.length ? layerKeys : null)
    const entityParam = addParam(entityTypes.length ? entityTypes : null)
    const cityParam = addParam(cityId)
    const limit = query.render.mode === 'count' ? 0 : query.render.maxFeatures
    const queryLimit = Math.min(MAX_SEMANTIC_QUERY_LIMIT + 1, limit + 1)
    const limitParam = addParam(queryLimit)
    const scopeKeyParam = addParam(query.scope.key)
    const filterSql = query.filters.map((filter) => buildFilterSql(filter, addParam))
    const filterJoin = query.combine === 'or' ? ' OR ' : ' AND '
    const scopeSql = scopeCteSql(query.scope, addParam)
    const semanticClassCase = semanticClassCaseSql()
    const layerPriorityCase = layerPriorityCaseSql()

    const result = await pool.query(
      `
        WITH latest_boundary AS (
          SELECT geom
          FROM city_boundaries
          WHERE city_id = ${cityParam}
          ORDER BY created_at DESC
          LIMIT 1
        ),
        query_scope AS (
          ${scopeSql}
        ),
        base_features AS (
          SELECT
            cf.stable_id,
            cf.feature_type,
            cf.label,
            cf.authority_status,
            cf.confidence,
            cf.properties,
            cf.updated_at,
            COALESCE(ld.key, cf.feature_type) AS layer_key,
            CASE
              WHEN cf.feature_type = 'buildingCandidateNew' THEN 'buildings'
              ELSE COALESCE(ld.key, cf.feature_type)
            END AS display_layer_key,
            ld.name AS layer_name,
            ld.layer_family,
            ld.geometry_type AS layer_geometry_type,
            NULL::text AS observed_stable_id,
            NULL::text AS observed_label,
            NULL::text AS observed_confidence,
            NULL::jsonb AS observed_properties,
            NULL::int AS source_evidence_count,
            cf.geom AS display_geom,
            CASE
              WHEN ${scopeKeyParam} = 'radius' THEN ST_DistanceSphere(
                ST_PointOnSurface(cf.geom),
                ST_SetSRID(ST_MakePoint(
                  ${(query.scope.center ? addParam(query.scope.center[0]) : addParam(null))}::double precision,
                  ${(query.scope.center ? addParam(query.scope.center[1]) : addParam(null))}::double precision
                ), 4326)
              )
              ELSE NULL
            END AS distance_m
          FROM city_features cf
          LEFT JOIN layer_definitions ld ON ld.id = cf.layer_id
          CROSS JOIN query_scope qs
          WHERE cf.city_id = ${cityParam}
            AND cf.feature_type <> 'buildingCandidateMatched'
            AND (qs.geom IS NULL OR (cf.geom && qs.geom AND ST_Intersects(cf.geom, qs.geom)))
            AND (
              ${layerParam}::text[] IS NULL
              OR COALESCE(ld.key, cf.feature_type) = ANY(${layerParam}::text[])
              OR cf.feature_type = ANY(${entityParam}::text[])
              OR ('buildings' = ANY(${layerParam}::text[]) AND cf.feature_type = 'buildingCandidateNew')
            )
            ${filterSql.length ? `AND (${filterSql.join(filterJoin)})` : ''}
        ),
        matched AS (
          SELECT
            *,
            ${semanticClassCase} AS semantic_class_key
          FROM base_features
        ),
        filtered AS (
          SELECT *
          FROM matched
          WHERE semantic_class_key = ANY(${classParam}::text[])
        ),
        limited AS (
          SELECT
            *,
            ${layerPriorityCase} AS layer_priority
          FROM filtered
          ORDER BY layer_priority ASC, stable_id ASC
          LIMIT ${limitParam}
        ),
        counts_by_class AS (
          SELECT semantic_class_key, count(*)::int AS feature_count
          FROM filtered
          GROUP BY semantic_class_key
        ),
        counts_by_layer AS (
          SELECT display_layer_key, count(*)::int AS feature_count
          FROM filtered
          GROUP BY display_layer_key
        )
        SELECT
          (SELECT count(*)::int FROM filtered) AS total_count,
          COALESCE(
            (SELECT jsonb_object_agg(semantic_class_key, feature_count) FROM counts_by_class),
            '{}'::jsonb
          ) AS counts_by_semantic_class,
          COALESCE(
            (SELECT jsonb_object_agg(display_layer_key, feature_count) FROM counts_by_layer),
            '{}'::jsonb
          ) AS counts_by_layer,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'stable_id', stable_id,
                'feature_type', feature_type,
                'label', label,
                'authority_status', authority_status,
                'confidence', confidence,
                'properties', properties,
                'updated_at', updated_at,
                'layer_key', layer_key,
                'display_layer_key', display_layer_key,
                'layer_name', layer_name,
                'layer_family', layer_family,
                'layer_geometry_type', layer_geometry_type,
                'observed_stable_id', observed_stable_id,
                'observed_label', observed_label,
                'observed_confidence', observed_confidence,
                'observed_properties', observed_properties,
                'source_evidence_count', source_evidence_count,
                'distance_m', distance_m,
                'semantic_class_key', semantic_class_key,
                'footprint_area_m2',
                  CASE
                    WHEN GeometryType(display_geom) IN ('POLYGON', 'MULTIPOLYGON') THEN ST_Area(ST_Transform(display_geom, 3857))
                    ELSE NULL
                  END,
                'geometry', ST_AsGeoJSON(display_geom)::jsonb
              )
              ORDER BY layer_priority ASC, stable_id ASC
            ) FILTER (WHERE stable_id IS NOT NULL),
            '[]'::jsonb
          ) AS rows
        FROM limited
      `,
      values,
    )

    const row = result.rows[0] ?? {}
    const totalCount = Number(row.total_count ?? 0)
    const rawRows = Array.isArray(row.rows) ? row.rows : []
    const rows = rawRows.slice(0, limit)
    const features = rows.map(rowToFeature).filter((feature) => feature.geometry)
    const truncated = query.render.mode !== 'count' && totalCount > features.length && limit < totalCount
    const latencyMs = Date.now() - startedAt
    const normalized = normalizedQueryPayload(query, surface, intent)

    await recordSemanticQueryEvent(pool, {
      cityId,
      surface,
      queryKind: 'semantic-selector',
      intent,
      query: normalized,
      scope: query.scope,
      classes: query.classes,
      filters: query.filters,
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
      metadata: input.metadata ?? {},
    })

    return {
      configured: true,
      ok: true,
      cityId,
      query: normalized,
      summary: {
        resultCount: totalCount,
        returned: features.length,
        truncated,
        countsBySemanticClass: row.counts_by_semantic_class ?? {},
        countsByLayer: row.counts_by_layer ?? {},
      },
      geojson: {
        type: 'FeatureCollection',
        features,
      },
      error: null,
    }
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    await recordSemanticQueryEvent(pool, {
      cityId,
      surface,
      queryKind: 'semantic-selector',
      intent,
      query: normalizedQueryPayload(query, surface, intent),
      scope: query.scope,
      classes: query.classes,
      filters: query.filters,
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
        error: String(error?.message ?? 'UNKNOWN_SEMANTIC_QUERY_ERROR'),
      },
    })
    return {
      configured: true,
      ok: false,
      cityId,
      query: normalizedQueryPayload(query, surface, intent),
      summary: {
        resultCount: 0,
        returned: 0,
        truncated: false,
        countsBySemanticClass: {},
        countsByLayer: {},
      },
      geojson: { type: 'FeatureCollection', features: [] },
      error: String(error?.message ?? 'UNKNOWN_SEMANTIC_QUERY_ERROR'),
    }
  }
}
