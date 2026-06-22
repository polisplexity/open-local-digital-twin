import { getProductionPool } from '../postgisPool.mjs'
import { parseMaybeJson } from './repositoryUtils.mjs'

const DEFAULT_SELECTION_UNIT_LIMIT = 120
const MAX_SELECTION_UNIT_LIMIT = 1000
const DEFAULT_DENSITY_GRID_KEY = 'city-density-2km'
const INFERRED_BLOCK_METHOD = 'road-polygonize-open-data'
const DEFAULT_INFERRED_BLOCK_LIMIT = 1500
const MIN_INFERRED_BLOCK_AREA_M2 = 500
const MAX_INFERRED_BLOCK_AREA_M2 = 500000

const MISSING_SOURCE_SCOPES = [
  {
    scope: 'district',
    id: 'district:source-required',
    label: 'District or neighborhood source required',
    authority: 'source-dependent',
    status: 'missing-source',
    geometry: null,
    sourceRequired: true,
    note: 'No authority-grade district or neighborhood selection source is registered for this city yet.',
  },
  {
    scope: 'block',
    id: 'block:source-required',
    label: 'Block or manzana source required',
    authority: 'source-dependent-or-inferred',
    status: 'missing-source',
    geometry: null,
    sourceRequired: true,
    note: 'Block/manzana selection needs city blocks, cadastral/planning blocks, or an explicitly marked inferred block generator.',
  },
  {
    scope: 'customPolygon',
    id: 'customPolygon:future',
    label: 'Custom polygon selection',
    authority: 'analyst-defined',
    status: 'later',
    geometry: null,
    sourceRequired: false,
    note: 'Analyst-drawn or imported polygons are a future viewer workflow, not a stored selection unit yet.',
  },
]

function clampInteger(value, fallback, min, max) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function optionalText(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function numberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeSelectionScope(value, fallback = 'available') {
  const scope = String(value ?? '').trim()
  if (!scope) return fallback
  const aliases = {
    all: 'available',
    grid: 'density-grid',
    density: 'density-grid',
    densityGrid: 'density-grid',
    neighborhoods: 'district',
    neighbourhood: 'district',
    neighbourhoods: 'district',
    manzana: 'block',
    blocks: 'block',
    polygon: 'customPolygon',
    custom: 'customPolygon',
  }
  return aliases[scope] || aliases[scope.toLowerCase()] || scope
}

function normalizeLonLat(value) {
  if (value == null || value === '') return null
  const parts = Array.isArray(value) ? value : String(value).split(',')
  const numbers = parts.map(numberOrNull)
  if (numbers.length !== 2 || numbers.some((number) => number == null)) return null
  const [lon, lat] = numbers
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null
  return [lon, lat]
}

function normalizeBbox(value) {
  if (value == null || value === '') return null
  const parts = Array.isArray(value) ? value : String(value).split(',')
  const numbers = parts.map(numberOrNull)
  if (numbers.length !== 4 || numbers.some((number) => number == null)) return null
  const [minLon, minLat, maxLon, maxLat] = numbers
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90 || minLon >= maxLon || minLat >= maxLat) return null
  return [minLon, minLat, maxLon, maxLat]
}

function densitySortExpression() {
  return `
    CASE
      WHEN metrics->>'buildingCount' ~ '^[0-9]+$' THEN (metrics->>'buildingCount')::int
      WHEN metrics->>'buildings' ~ '^[0-9]+$' THEN (metrics->>'buildings')::int
      ELSE 0
    END
  `
}

function selectionScopeCatalog({ blockAvailable = false } = {}) {
  return [
    { scope: 'city', label: 'City boundary', authority: 'base-boundary', status: 'available' },
    { scope: 'viewport', label: 'Viewport envelope', authority: 'runtime-view', status: 'available' },
    { scope: 'radius', label: 'Center radius', authority: 'runtime-view', status: 'available' },
    { scope: 'density-grid', label: 'Viewer density grid', authority: 'ldt-viewer-aggregate', status: 'available' },
    {
      scope: 'district',
      label: 'District or neighborhood',
      authority: 'source-dependent',
      status: 'missing-source',
      sourceRequired: true,
    },
    {
      scope: 'block',
      label: 'Block or manzana',
      authority: blockAvailable ? 'inferred-open-data' : 'source-dependent-or-inferred',
      status: blockAvailable ? 'available-inferred' : 'missing-source',
      sourceRequired: !blockAvailable,
    },
    {
      scope: 'customPolygon',
      label: 'Custom polygon selection',
      authority: 'analyst-defined',
      status: 'later',
      sourceRequired: false,
    },
  ]
}

async function cityBoundaryUnit(client, cityId) {
  const result = await client.query(
    `
      WITH boundary AS (
        SELECT geom
        FROM ldt_core.city_boundaries
        WHERE city_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      )
      SELECT
        'city' AS scope,
        'city:' || $1::text AS id,
        $1::text AS unit_id,
        'City boundary' AS label,
        'base-boundary' AS authority,
        'available' AS status,
        round((ST_Area(geom::geography) / 1000000.0)::numeric, 3)::float AS area_km2,
        ST_AsGeoJSON(geom)::json AS geometry
      FROM boundary
      WHERE geom IS NOT NULL
        AND NOT ST_IsEmpty(geom)
    `,
    [cityId],
  )
  return result.rows.map((row) => ({
    scope: row.scope,
    id: row.id,
    unitId: row.unit_id,
    label: row.label,
    authority: row.authority,
    status: row.status,
    areaKm2: Number(row.area_km2 ?? 0),
    geometry: parseMaybeJson(row.geometry, null),
  }))
}

async function densityGridUnits(client, cityId, { gridKey = DEFAULT_DENSITY_GRID_KEY, limit = DEFAULT_SELECTION_UNIT_LIMIT } = {}) {
  const normalizedLimit = clampInteger(limit, DEFAULT_SELECTION_UNIT_LIMIT, 1, MAX_SELECTION_UNIT_LIMIT)
  const normalizedGridKey = optionalText(gridKey)
  const result = await client.query(
    `
      SELECT
        'density-grid' AS scope,
        'density-grid:' || grid_key || ':' || cell_id AS id,
        cell_id AS unit_id,
        grid_key,
        zoom_hint,
        metrics,
        'ldt-viewer-aggregate' AS authority,
        'available' AS status,
        round((ST_Area(geom::geography) / 1000000.0)::numeric, 3)::float AS area_km2,
        ST_AsGeoJSON(geom)::json AS geometry
      FROM ldt_viewer.density_grids
      WHERE city_id = $1
        AND ($2::text IS NULL OR grid_key = $2)
      ORDER BY ${densitySortExpression()} DESC, cell_id ASC
      LIMIT $3
    `,
    [cityId, normalizedGridKey, normalizedLimit],
  )
  return result.rows.map((row) => ({
    scope: row.scope,
    id: row.id,
    unitId: row.unit_id,
    gridKey: row.grid_key,
    label: `${row.grid_key} / ${row.unit_id}`,
    authority: row.authority,
    status: row.status,
    areaKm2: Number(row.area_km2 ?? 0),
    zoomHint: Number(row.zoom_hint ?? 0),
    metrics: parseMaybeJson(row.metrics, {}),
    geometry: parseMaybeJson(row.geometry, null),
  }))
}

async function inferredBlockUnits(client, cityId, { limit = DEFAULT_SELECTION_UNIT_LIMIT, unitId = null } = {}) {
  const normalizedLimit = clampInteger(limit, DEFAULT_SELECTION_UNIT_LIMIT, 1, MAX_SELECTION_UNIT_LIMIT)
  const normalizedUnitId = optionalText(unitId)
  const result = await client.query(
    `
      SELECT
        scope,
        'block:' || unit_id AS id,
        unit_id,
        label,
        authority,
        status,
        review_status,
        source_method,
        metrics,
        properties,
        round((ST_Area(geom::geography) / 1000000.0)::numeric, 4)::float AS area_km2,
        ST_AsGeoJSON(geom)::json AS geometry
      FROM ldt_viewer.selection_units
      WHERE city_id = $1
        AND scope = 'block'
        AND status IN ('available', 'available-inferred')
        AND ($2::text IS NULL OR unit_id = $2 OR id::text = $2 OR 'block:' || unit_id = $2)
      ORDER BY
        CASE WHEN review_status = 'accepted' THEN 0 ELSE 1 END,
        ST_Area(geom::geography) ASC,
        unit_id ASC
      LIMIT $3
    `,
    [cityId, normalizedUnitId, normalizedLimit],
  )
  return result.rows.map((row) => ({
    scope: row.scope,
    id: row.id,
    unitId: row.unit_id,
    label: row.label,
    authority: row.authority,
    status: row.status,
    reviewStatus: row.review_status,
    sourceMethod: row.source_method,
    areaKm2: Number(row.area_km2 ?? 0),
    metrics: parseMaybeJson(row.metrics, {}),
    properties: parseMaybeJson(row.properties, {}),
    geometry: parseMaybeJson(row.geometry, null),
  }))
}

export async function generateInferredBlockSelectionUnits(cityId, options = {}) {
  const pool = getProductionPool()
  const limit = clampInteger(options.limit, DEFAULT_INFERRED_BLOCK_LIMIT, 1, MAX_SELECTION_UNIT_LIMIT * 10)
  const minAreaM2 = Math.max(1, Number(options.minAreaM2 ?? MIN_INFERRED_BLOCK_AREA_M2))
  const maxAreaM2 = Math.max(minAreaM2, Number(options.maxAreaM2 ?? MAX_INFERRED_BLOCK_AREA_M2))
  const replace = options.replace !== false

  if (!pool) {
    return {
      configured: false,
      ok: false,
      cityId,
      generated: 0,
      error: 'DATABASE_NOT_CONFIGURED',
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (replace) {
      await client.query(
        `
          DELETE FROM ldt_viewer.selection_units
          WHERE city_id = $1
            AND scope = 'block'
            AND source_method = $2
        `,
        [cityId, INFERRED_BLOCK_METHOD],
      )
    }

    const result = await client.query(
      `
        WITH boundary AS (
          SELECT ST_UnaryUnion(ST_Collect(geom)) AS geom
          FROM ldt_core.city_boundaries
          WHERE city_id = $1
        ),
        road_lines AS (
          SELECT
            (ST_Dump(ST_CollectionExtract(ST_MakeValid(ST_Intersection(ce.geom, b.geom)), 2))).geom AS geom
          FROM ldt_core.city_entities ce
          JOIN boundary b ON b.geom IS NOT NULL
          WHERE ce.city_id = $1
            AND ce.entity_type = 'road'
            AND ce.geom IS NOT NULL
            AND ce.geom && b.geom
            AND ST_Intersects(ce.geom, b.geom)
        ),
        boundary_lines AS (
          SELECT (ST_Dump(ST_Boundary(geom))).geom AS geom
          FROM boundary
          WHERE geom IS NOT NULL
        ),
        linework AS (
          SELECT geom FROM road_lines WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
          UNION ALL
          SELECT geom FROM boundary_lines WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
        ),
        noded AS (
          SELECT (ST_Dump(ST_Node(ST_UnaryUnion(ST_Collect(geom))))).geom AS geom
          FROM linework
        ),
        polygons AS (
          SELECT (ST_Dump(ST_Polygonize(geom))).geom AS geom
          FROM noded
        ),
        clipped AS (
          SELECT
            ST_CollectionExtract(ST_MakeValid(ST_Intersection(p.geom, b.geom)), 3) AS geom
          FROM polygons p
          CROSS JOIN boundary b
          WHERE p.geom IS NOT NULL
            AND b.geom IS NOT NULL
            AND ST_Intersects(p.geom, b.geom)
        ),
        candidates AS (
          SELECT
            geom,
            ST_Area(geom::geography) AS area_m2
          FROM clipped
          WHERE geom IS NOT NULL
            AND NOT ST_IsEmpty(geom)
            AND ST_Area(geom::geography) BETWEEN $2 AND $3
        ),
        ranked AS (
          SELECT
            row_number() OVER (
              ORDER BY ST_Y(ST_PointOnSurface(geom)) DESC, ST_X(ST_PointOnSurface(geom)) ASC
            ) AS sequence_number,
            geom,
            area_m2
          FROM candidates
          ORDER BY ST_Y(ST_PointOnSurface(geom)) DESC, ST_X(ST_PointOnSurface(geom)) ASC
          LIMIT $4
        ),
        source_stats AS (
          SELECT count(*)::int AS road_count
          FROM road_lines
        )
        INSERT INTO ldt_viewer.selection_units (
          city_id,
          scope,
          unit_id,
          label,
          authority,
          source_method,
          status,
          review_status,
          geom,
          metrics,
          properties,
          generated_at,
          updated_at
        )
        SELECT
          $1,
          'block',
          'inferred-block-' || lpad(sequence_number::text, 5, '0'),
          'Inferred block ' || sequence_number::text,
          'inferred-open-data',
          $5::text,
          'available-inferred',
          'unreviewed',
          ST_Multi(geom),
          jsonb_build_object(
            'areaM2', round(area_m2::numeric, 2),
            'sourceRoadCount', source_stats.road_count,
            'method', $5::text,
            'source', 'OpenStreetMap road network and city boundary',
            'authorityGrade', false
          ),
          jsonb_build_object(
            'warning', 'Inferred planning block, not cadastral or authority-grade.',
            'minAreaM2', $2,
            'maxAreaM2', $3
          ),
          now(),
          now()
        FROM ranked
        CROSS JOIN source_stats
        ON CONFLICT (city_id, scope, unit_id) DO UPDATE SET
          label = EXCLUDED.label,
          authority = EXCLUDED.authority,
          source_method = EXCLUDED.source_method,
          status = EXCLUDED.status,
          review_status = EXCLUDED.review_status,
          geom = EXCLUDED.geom,
          metrics = EXCLUDED.metrics,
          properties = EXCLUDED.properties,
          generated_at = EXCLUDED.generated_at,
          updated_at = now()
        RETURNING unit_id
      `,
      [cityId, minAreaM2, maxAreaM2, limit, INFERRED_BLOCK_METHOD],
    )
    await client.query('COMMIT')
    return {
      configured: true,
      ok: true,
      cityId,
      generatedAt: new Date().toISOString(),
      generated: result.rowCount,
      scope: 'block',
      authority: 'inferred-open-data',
      sourceMethod: INFERRED_BLOCK_METHOD,
      limits: { limit, minAreaM2, maxAreaM2 },
      error: null,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    return {
      configured: true,
      ok: false,
      cityId,
      generated: 0,
      scope: 'block',
      authority: 'inferred-open-data',
      sourceMethod: INFERRED_BLOCK_METHOD,
      error: String(error?.message ?? 'UNKNOWN_INFERRED_BLOCK_GENERATION_ERROR'),
    }
  } finally {
    client.release()
  }
}

export async function getCitySelectionUnits(cityId, options = {}) {
  const pool = getProductionPool()
  const scope = normalizeSelectionScope(options.scope)
  const limit = clampInteger(options.limit, DEFAULT_SELECTION_UNIT_LIMIT, 1, MAX_SELECTION_UNIT_LIMIT)
  const gridKey = optionalText(options.gridKey) || DEFAULT_DENSITY_GRID_KEY

  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      scope,
      units: [],
      scopes: selectionScopeCatalog(),
      summary: { totalUnits: 0, availableScopes: [], missingScopes: [] },
      error: null,
    }
  }

  try {
    const units = []
    let blockAvailable = false
    if (scope === 'available' || scope === 'city') {
      units.push(...await cityBoundaryUnit(pool, cityId))
    }
    if (scope === 'available' || scope === 'density-grid') {
      units.push(...await densityGridUnits(pool, cityId, { gridKey, limit }))
    }
    if (scope === 'available' || scope === 'block') {
      const blocks = await inferredBlockUnits(pool, cityId, {
        limit,
        unitId: options.unitId,
      })
      blockAvailable = blocks.length > 0
      units.push(...blocks)
    }
    if (scope === 'available') {
      units.push(...MISSING_SOURCE_SCOPES.filter((unit) => unit.scope !== 'block' || !blockAvailable))
    } else if (['district', 'block', 'customPolygon'].includes(scope) && !(scope === 'block' && blockAvailable)) {
      units.push(...MISSING_SOURCE_SCOPES.filter((unit) => unit.scope === scope))
    }

    const availableScopes = Array.from(new Set(units.filter((unit) => ['available', 'available-inferred'].includes(unit.status)).map((unit) => unit.scope)))
    const missingScopes = Array.from(new Set(units.filter((unit) => !['available', 'available-inferred'].includes(unit.status)).map((unit) => unit.scope)))
    return {
      configured: true,
      ok: true,
      cityId,
      generatedAt: new Date().toISOString(),
      scope,
      gridKey,
      limit,
      units,
      scopes: selectionScopeCatalog({ blockAvailable }),
      summary: {
        totalUnits: units.length,
        availableScopes,
        missingScopes,
      },
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      scope,
      units: [],
      scopes: selectionScopeCatalog(),
      summary: { totalUnits: 0, availableScopes: [], missingScopes: [] },
      error: String(error?.message ?? 'UNKNOWN_SELECTION_UNITS_ERROR'),
    }
  }
}

function areaSelectionSql(cityId, options = {}) {
  const scope = normalizeSelectionScope(options.scope, 'city')
  if (scope === 'city') {
    return {
      scope,
      params: [cityId],
      sql: `
        SELECT
          'city' AS scope,
          $1::text AS unit_id,
          'City boundary' AS label,
          'base-boundary' AS authority,
          'available' AS status,
          geom
        FROM ldt_core.city_boundaries
        WHERE city_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
    }
  }

  if (scope === 'density-grid') {
    const unitId = optionalText(options.unitId) || optionalText(options.cellId)
    const gridKey = optionalText(options.gridKey)
    return {
      scope,
      params: [cityId, unitId, gridKey],
      sql: `
        SELECT
          'density-grid' AS scope,
          grid_key || ':' || cell_id AS unit_id,
          grid_key || ' / ' || cell_id AS label,
          'ldt-viewer-aggregate' AS authority,
          'available' AS status,
          geom
        FROM ldt_viewer.density_grids
        WHERE city_id = $1
          AND (
            $2::text IS NULL
            OR cell_id = $2
            OR grid_key || ':' || cell_id = $2
            OR 'density-grid:' || grid_key || ':' || cell_id = $2
          )
          AND ($3::text IS NULL OR grid_key = $3)
        ORDER BY ${densitySortExpression()} DESC, cell_id ASC
        LIMIT 1
      `,
    }
  }

  if (scope === 'block') {
    const unitId = optionalText(options.unitId) || optionalText(options.blockId)
    return {
      scope,
      params: [cityId, unitId],
      sql: `
        SELECT
          'block' AS scope,
          unit_id,
          label,
          authority,
          status,
          geom
        FROM ldt_viewer.selection_units
        WHERE city_id = $1
          AND scope = 'block'
          AND status IN ('available', 'available-inferred')
          AND (
            $2::text IS NULL
            OR unit_id = $2
            OR id::text = $2
            OR 'block:' || unit_id = $2
          )
        ORDER BY
          CASE WHEN review_status = 'accepted' THEN 0 ELSE 1 END,
          ST_Area(geom::geography) ASC,
          unit_id ASC
        LIMIT 1
      `,
    }
  }

  if (scope === 'radius') {
    const center = normalizeLonLat(options.center)
    const radiusMeters = numberOrNull(options.radiusMeters ?? options.radius)
    if (!center || !radiusMeters || radiusMeters <= 0) {
      return { scope, error: 'RADIUS_REQUIRES_CENTER_AND_POSITIVE_METERS' }
    }
    return {
      scope,
      params: [cityId, center[0], center[1], radiusMeters],
      sql: `
        WITH radius_geom AS (
          SELECT ST_Buffer(
            ST_SetSRID(ST_MakePoint($2::double precision, $3::double precision), 4326)::geography,
            $4::double precision
          )::geometry AS geom
        ),
        boundary AS (
          SELECT ST_UnaryUnion(ST_Collect(geom)) AS geom
          FROM ldt_core.city_boundaries
          WHERE city_id = $1
        )
        SELECT
          'radius' AS scope,
          round($4::numeric)::text || 'm' AS unit_id,
          round(($4::numeric / 1000.0), 2)::text || ' km radius' AS label,
          'runtime-view' AS authority,
          'available' AS status,
          CASE
            WHEN boundary.geom IS NULL THEN radius_geom.geom
            ELSE ST_CollectionExtract(ST_MakeValid(ST_Intersection(boundary.geom, radius_geom.geom)), 3)
          END AS geom
        FROM radius_geom
        LEFT JOIN boundary ON true
      `,
    }
  }

  if (scope === 'viewport') {
    const bbox = normalizeBbox(options.bbox)
    if (!bbox) return { scope, error: 'VIEWPORT_REQUIRES_BBOX' }
    return {
      scope,
      params: [cityId, ...bbox],
      sql: `
        WITH viewport_geom AS (
          SELECT ST_MakeEnvelope($2, $3, $4, $5, 4326) AS geom
        ),
        boundary AS (
          SELECT ST_UnaryUnion(ST_Collect(geom)) AS geom
          FROM ldt_core.city_boundaries
          WHERE city_id = $1
        )
        SELECT
          'viewport' AS scope,
          array_to_string(ARRAY[$2::text, $3::text, $4::text, $5::text], ',') AS unit_id,
          'Current viewport' AS label,
          'runtime-view' AS authority,
          'available' AS status,
          CASE
            WHEN boundary.geom IS NULL THEN viewport_geom.geom
            ELSE ST_CollectionExtract(ST_MakeValid(ST_Intersection(boundary.geom, viewport_geom.geom)), 3)
          END AS geom
        FROM viewport_geom
        LEFT JOIN boundary ON true
      `,
    }
  }

  return { scope, error: 'SELECTION_SCOPE_SOURCE_NOT_AVAILABLE' }
}

function layerCount(counts, keys) {
  return keys.reduce((total, key) => total + Number(counts[key] ?? 0), 0)
}

function selectedAreaIndicators({ areaKm2, layerCounts, featureCount }) {
  const area = Number(areaKm2) > 0 ? Number(areaKm2) : 0
  const buildings = layerCount(layerCounts, ['buildings'])
  const roads = layerCount(layerCounts, ['roads'])
  const seeds = layerCount(layerCounts, ['accessSeeds'])
  const greenBlue = layerCount(layerCounts, ['greenBlue'])
  return [
    {
      key: 'built_fabric_density',
      label: 'Built fabric density',
      value: area ? Number((buildings / area).toFixed(2)) : 0,
      unit: 'buildings/km2',
      method: 'Selected building entities divided by selected area.',
    },
    {
      key: 'road_granularity',
      label: 'Road granularity',
      value: area ? Number((roads / area).toFixed(2)) : 0,
      unit: 'road geometries/km2',
      method: 'Selected road entities divided by selected area.',
    },
    {
      key: 'semantic_seed_density',
      label: 'Semantic seed density',
      value: area ? Number((seeds / area).toFixed(2)) : 0,
      unit: 'seed entities/km2',
      method: 'Selected civic, mobility, service, and inferred seed entities divided by selected area.',
    },
    {
      key: 'green_blue_signal',
      label: 'Green-blue signal',
      value: greenBlue,
      unit: 'features',
      method: 'Selected open green-blue and land-use entities.',
    },
    {
      key: 'selection_inventory',
      label: 'Selection inventory',
      value: Number(featureCount ?? 0),
      unit: 'entities',
      method: 'All selected LDT core entities with geometry.',
    },
  ]
}

export async function getCitySelectionAreaSummary(cityId, options = {}) {
  const pool = getProductionPool()
  const areaSelection = areaSelectionSql(cityId, options)
  const scope = areaSelection.scope

  if (areaSelection.error) {
    return {
      configured: Boolean(pool),
      ok: false,
      cityId,
      scope,
      area: null,
      layerCounts: {},
      indicators: [],
      error: areaSelection.error,
    }
  }

  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      scope,
      area: null,
      layerCounts: {},
      indicators: [],
      error: null,
    }
  }

  try {
    const result = await pool.query(
      `
        WITH area AS (
          ${areaSelection.sql}
        ),
        valid_area AS (
          SELECT *
          FROM area
          WHERE geom IS NOT NULL
            AND NOT ST_IsEmpty(geom)
        ),
        entities AS (
          SELECT
            ce.id,
            ce.stable_id,
            ce.entity_type,
            ce.authority_status,
            ce.confidence,
            CASE
              WHEN ce.entity_type = 'building' THEN 'buildings'
              WHEN ce.entity_type = 'road' THEN 'roads'
              WHEN ce.entity_type IN ('green_blue_system', 'land_use', 'land_use_area') THEN 'greenBlue'
              WHEN ce.entity_type = 'place' THEN 'places'
              WHEN ce.entity_type IN ('facility', 'mobility', 'civic', 'commerce', 'waste_seed') THEN 'accessSeeds'
              ELSE ce.entity_type
            END AS layer_key
          FROM valid_area va
          JOIN ldt_core.city_entities ce
            ON ce.city_id = $1
           AND ce.geom IS NOT NULL
           AND ce.geom && va.geom
           AND ST_Intersects(ce.geom, va.geom)
        ),
        layer_counts AS (
          SELECT layer_key, count(*)::int AS feature_count
          FROM entities
          GROUP BY layer_key
        ),
        authority_counts AS (
          SELECT authority_status, count(*)::int AS feature_count
          FROM entities
          GROUP BY authority_status
        ),
        evidence AS (
          SELECT
            count(DISTINCT ese.id)::int AS evidence_links,
            count(DISTINCT sf.dataset_id)::int AS dataset_count,
            count(DISTINCT sf.source_layer)::int AS source_layer_count,
            array_remove(array_agg(DISTINCT sf.source_layer), NULL) AS source_layers
          FROM entities entity
          LEFT JOIN ldt_prov.entity_source_evidence ese ON ese.entity_id = entity.id
          LEFT JOIN ldt_prov.source_features sf ON sf.id = ese.source_feature_id
        )
        SELECT
          va.scope,
          va.unit_id,
          va.label,
          va.authority,
          va.status,
          round((ST_Area(va.geom::geography) / 1000000.0)::numeric, 3)::float AS area_km2,
          ST_AsGeoJSON(va.geom)::json AS geometry,
          COALESCE((SELECT sum(feature_count)::int FROM layer_counts), 0)::int AS feature_count,
          COALESCE((SELECT jsonb_object_agg(layer_key, feature_count) FROM layer_counts), '{}'::jsonb) AS layer_counts,
          COALESCE((SELECT jsonb_object_agg(authority_status, feature_count) FROM authority_counts), '{}'::jsonb) AS authority_counts,
          evidence.evidence_links,
          evidence.dataset_count,
          evidence.source_layer_count,
          COALESCE(evidence.source_layers, ARRAY[]::text[]) AS source_layers
        FROM valid_area va
        CROSS JOIN evidence
        LIMIT 1
      `,
      areaSelection.params,
    )
    const row = result.rows[0]
    if (!row) {
      return {
        configured: true,
        ok: false,
        cityId,
        scope,
        area: null,
        layerCounts: {},
        indicators: [],
        error: 'SELECTION_AREA_NOT_FOUND',
      }
    }
    const layerCounts = parseMaybeJson(row.layer_counts, {})
    const authorityCounts = parseMaybeJson(row.authority_counts, {})
    const featureCount = Number(row.feature_count ?? 0)
    const areaKm2 = Number(row.area_km2 ?? 0)
    return {
      configured: true,
      ok: true,
      cityId,
      generatedAt: new Date().toISOString(),
      scope: row.scope,
      area: {
        scope: row.scope,
        unitId: row.unit_id,
        label: row.label,
        authority: row.authority,
        status: row.status,
        areaKm2,
        geometry: parseMaybeJson(row.geometry, null),
      },
      featureCount,
      layerCounts,
      authorityCounts,
      sourceEvidence: {
        evidenceLinks: Number(row.evidence_links ?? 0),
        datasets: Number(row.dataset_count ?? 0),
        sourceLayerCount: Number(row.source_layer_count ?? 0),
        sourceLayers: Array.isArray(row.source_layers) ? row.source_layers : [],
      },
      indicators: selectedAreaIndicators({ areaKm2, layerCounts, featureCount }),
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      scope,
      area: null,
      layerCounts: {},
      indicators: [],
      error: String(error?.message ?? 'UNKNOWN_SELECTION_SUMMARY_ERROR'),
    }
  }
}
