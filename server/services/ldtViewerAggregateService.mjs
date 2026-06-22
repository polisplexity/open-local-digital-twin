import { closeSharedProductionPool, withProductionClient as withClient } from './serviceDatabase.mjs'

const DEFAULT_CITY_IDS = ['adazi', 'kharkiv']
const DEFAULT_CELL_SIZE_M = 2000
const MIN_CELL_SIZE_M = 250
const MAX_CELL_SIZE_M = 10000
const DEFAULT_GRID_KEY = 'city-density-2km'

async function withLowMemoryTransaction(client, callback) {
  await client.query('BEGIN')
  try {
    await client.query('SET LOCAL max_parallel_workers_per_gather = 0')
    await client.query("SET LOCAL work_mem = '16MB'")
    const result = await callback()
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

export async function closeLdtViewerAggregatePool() {
  await closeSharedProductionPool()
}

function parseCellSize(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CELL_SIZE_M
  return Math.min(MAX_CELL_SIZE_M, Math.max(MIN_CELL_SIZE_M, parsed))
}

async function listCityIds(client, requestedCityIds) {
  if (requestedCityIds.length > 0) return requestedCityIds
  const result = await client.query('SELECT id FROM ldt_core.cities ORDER BY id')
  return result.rows.map((row) => row.id)
}

async function refreshCitySummary(client, cityId) {
  const result = await client.query(
    `
      WITH city AS (
        SELECT id, name, country, region
        FROM ldt_core.cities
        WHERE id = $1
      ),
      boundary AS (
        SELECT
          ST_UnaryUnion(ST_Collect(geom)) AS geom,
          ST_Area(ST_UnaryUnion(ST_Collect(geom))::geography) / 1000000.0 AS area_km2
        FROM ldt_core.city_boundaries
        WHERE city_id = $1
      ),
      entity_counts AS (
        SELECT
          entity_type,
          count(*)::int AS count
        FROM ldt_core.city_entities
        WHERE city_id = $1
        GROUP BY entity_type
      ),
      evidence AS (
        SELECT
          count(*)::int AS evidence_links,
          count(*) FILTER (WHERE sf.source_layer = 'overture-buildings')::int AS overture_links,
          count(*) FILTER (WHERE ese.evidence_role = 'confirms-open-source')::int AS matched_overture_links,
          count(*) FILTER (WHERE ese.evidence_role = 'primary-open-provider')::int AS provider_only_links
        FROM ldt_prov.entity_source_evidence ese
        JOIN ldt_core.city_entities ce ON ce.id = ese.entity_id
        LEFT JOIN ldt_prov.source_features sf ON sf.id = ese.source_feature_id
        WHERE ce.city_id = $1
      ),
      roads AS (
        SELECT
          count(*)::int AS road_count,
          COALESCE(sum(ST_Length(ce.geom::geography)) / 1000.0, 0) AS road_km
        FROM ldt_core.city_entities ce
        WHERE ce.city_id = $1
          AND ce.entity_type = 'road'
          AND ce.geom IS NOT NULL
      ),
      buildings AS (
        SELECT
          count(*)::int AS building_count,
          count(*) FILTER (WHERE be.source_coverage_status = 'open-provider-only')::int AS open_provider_only_buildings,
          count(*) FILTER (WHERE be.source_coverage_status = 'base-source-only')::int AS base_source_only_buildings,
          COALESCE(avg(be.height_m) FILTER (WHERE be.height_m IS NOT NULL), 8.0) AS average_height_m
        FROM ldt_core.city_entities ce
        LEFT JOIN ldt_core.building_entities be ON be.entity_id = ce.id
        WHERE ce.city_id = $1
          AND ce.entity_type = 'building'
      ),
      green_blue AS (
        SELECT
          count(*)::int AS feature_count,
          COALESCE(sum(ST_Area(ST_MakeValid(ce.geom)::geography)) / 1000000.0, 0) AS area_km2
        FROM ldt_core.city_entities ce
        WHERE ce.city_id = $1
          AND ce.entity_type = 'green_blue_system'
          AND ce.geom IS NOT NULL
          AND GeometryType(ce.geom) IN ('POLYGON', 'MULTIPOLYGON')
      ),
      interop AS (
        SELECT
          (SELECT count(*)::int FROM ldt_interop.ogc_collections WHERE city_id = $1) AS ogc_collections,
          (
            SELECT count(*)::int
            FROM ldt_interop.ngsi_entity_projections nep
            JOIN ldt_core.city_entities ce ON ce.id = nep.entity_id
            WHERE ce.city_id = $1
          ) AS ngsi_projections,
          (SELECT count(*)::int FROM ldt_interop.dcat_exports WHERE city_id = $1) AS dcat_exports
      )
      SELECT
        jsonb_build_object(
          'city', jsonb_build_object(
            'id', city.id,
            'name', city.name,
            'country', city.country,
            'region', city.region
          ),
          'areaKm2', round(COALESCE(boundary.area_km2, 0)::numeric, 2),
          'entityCounts', COALESCE(
            (
              SELECT jsonb_object_agg(entity_type, count)
              FROM entity_counts
            ),
            '{}'::jsonb
          ),
          'inventory', jsonb_build_object(
            'buildings', buildings.building_count,
            'roads', roads.road_count,
            'roadKm', round(roads.road_km::numeric, 1),
            'greenBlueFeatures', green_blue.feature_count,
            'evidenceLinks', evidence.evidence_links,
            'overtureEvidenceLinks', evidence.overture_links,
            'matchedOvertureLinks', evidence.matched_overture_links,
            'providerOnlyBuildings', buildings.open_provider_only_buildings
          ),
          'indicators', jsonb_build_array(
            jsonb_build_object(
              'key', 'built_fabric_density',
              'label', 'Built fabric density',
              'value', CASE WHEN boundary.area_km2 > 0 THEN round((buildings.building_count / boundary.area_km2)::numeric, 1) ELSE 0 END,
              'unit', 'buildings/km2',
              'method', 'Consolidated building entities divided by municipal boundary area.',
              'quality', 'open-data-derived'
            ),
            jsonb_build_object(
              'key', 'road_granularity',
              'label', 'Road granularity',
              'value', CASE WHEN boundary.area_km2 > 0 THEN round((roads.road_count / boundary.area_km2)::numeric, 1) ELSE 0 END,
              'unit', 'road geometries/km2',
              'method', 'Consolidated road geometries divided by municipal boundary area.',
              'quality', 'open-data-derived'
            ),
            jsonb_build_object(
              'key', 'road_density',
              'label', 'Road length density',
              'value', CASE WHEN boundary.area_km2 > 0 THEN round((roads.road_km / boundary.area_km2)::numeric, 2) ELSE 0 END,
              'unit', 'km/km2',
              'method', 'Total consolidated road length divided by municipal boundary area.',
              'quality', 'open-data-derived'
            ),
            jsonb_build_object(
              'key', 'green_blue_coverage',
              'label', 'Green-blue coverage',
              'value', CASE WHEN boundary.area_km2 > 0 THEN round((100.0 * green_blue.area_km2 / boundary.area_km2)::numeric, 1) ELSE 0 END,
              'unit', '% of municipal area',
              'method', 'Open green-blue polygon area clipped to city boundary.',
              'quality', 'partial-open-data'
            ),
            jsonb_build_object(
              'key', 'open_provider_building_uplift',
              'label', 'Open building uplift',
              'value', CASE
                WHEN buildings.building_count - buildings.open_provider_only_buildings > 0
                  THEN round((100.0 * buildings.open_provider_only_buildings / (buildings.building_count - buildings.open_provider_only_buildings))::numeric, 1)
                ELSE 0
              END,
              'unit', '% over base buildings',
              'method', 'Provider-only open building candidates compared with base-source building inventory.',
              'quality', 'candidate-evidence'
            ),
            jsonb_build_object(
              'key', 'standards_projection_coverage',
              'label', 'Standards projection coverage',
              'value', CASE
                WHEN (SELECT sum(count) FROM entity_counts) > 0
                  THEN round((100.0 * interop.ngsi_projections / (SELECT sum(count) FROM entity_counts))::numeric, 1)
                ELSE 0
              END,
              'unit', '% projected to NGSI-LD',
              'method', 'NGSI-LD projections divided by consolidated inventory count.',
              'quality', 'runtime-generated'
            )
          ),
          'interop', jsonb_build_object(
            'dcatExports', interop.dcat_exports,
            'ogcCollections', interop.ogc_collections,
            'ngsiProjections', interop.ngsi_projections
          ),
          'caveats', jsonb_build_array(
            'Open-data base twin, not an authority-complete city record.',
            'Provider-only building footprints remain candidate evidence until official/manual validation.',
            'Large-city browsers should use summaries, grids, tiles, and viewport APIs before feature-level full-city rendering.'
          ),
          'refreshedAt', now()
        ) AS payload
      FROM city, boundary, roads, buildings, green_blue, evidence, interop
    `,
    [cityId],
  )

  if (result.rowCount === 0) throw new Error(`LDT_CITY_NOT_FOUND:${cityId}`)
  const payload = result.rows[0].payload
  await client.query(
    `
      INSERT INTO ldt_viewer.city_summary_cache (
        city_id,
        summary_key,
        payload,
        refreshed_at,
        generated_by,
        metadata
      )
      VALUES (
        $1,
        'default',
        $2::jsonb,
        now(),
        'phase-6-viewer-aggregates',
        '{"phase":"phase-6-large-city-viewer-aggregates"}'::jsonb
      )
      ON CONFLICT (city_id) DO UPDATE SET
        summary_key = EXCLUDED.summary_key,
        payload = EXCLUDED.payload,
        refreshed_at = now(),
        generated_by = EXCLUDED.generated_by,
        metadata = EXCLUDED.metadata
    `,
    [cityId, JSON.stringify(payload)],
  )
  return payload
}

async function refreshDensityGrid(client, cityId, { cellSizeM = DEFAULT_CELL_SIZE_M, gridKey = DEFAULT_GRID_KEY } = {}) {
  const size = parseCellSize(cellSizeM)
  await client.query(
    `
      DELETE FROM ldt_viewer.density_grids
      WHERE city_id = $1
        AND grid_key = $2
    `,
    [cityId, gridKey],
  )

  const result = await client.query(
    `
      WITH boundary AS (
        SELECT ST_Transform(ST_UnaryUnion(ST_Collect(geom)), 3857) AS geom
        FROM ldt_core.city_boundaries
        WHERE city_id = $1
      ),
      bounds AS (
        SELECT
          (floor((ST_XMin(ST_Envelope(geom)))::numeric / $3::numeric) * $3::numeric)::numeric AS xmin,
          (ceil((ST_XMax(ST_Envelope(geom)))::numeric / $3::numeric) * $3::numeric)::numeric AS xmax,
          (floor((ST_YMin(ST_Envelope(geom)))::numeric / $3::numeric) * $3::numeric)::numeric AS ymin,
          (ceil((ST_YMax(ST_Envelope(geom)))::numeric / $3::numeric) * $3::numeric)::numeric AS ymax,
          geom
        FROM boundary
        WHERE geom IS NOT NULL
      ),
      grid AS (
        SELECT
          ((x - xmin) / $3::numeric)::int AS gx,
          ((y - ymin) / $3::numeric)::int AS gy,
          ST_MakeEnvelope(
            x::double precision,
            y::double precision,
            (x + $3::numeric)::double precision,
            (y + $3::numeric)::double precision,
            3857
          ) AS cell_3857
        FROM bounds,
          generate_series(xmin, xmax - $3::numeric, $3::numeric) AS x,
          generate_series(ymin, ymax - $3::numeric, $3::numeric) AS y
      ),
      scoped AS (
        SELECT
          gx,
          gy,
          'cell-' || gx || '-' || gy AS cell_id,
          cell_3857
        FROM grid
        CROSS JOIN boundary
        WHERE ST_Intersects(cell_3857, boundary.geom)
      ),
      entity_points AS (
        SELECT
          ce.entity_type,
          ST_Transform(ST_PointOnSurface(ST_MakeValid(ce.geom)), 3857) AS point_3857,
          CASE
            WHEN ce.entity_type = 'road' THEN ST_Length(ce.geom::geography) / 1000.0
            ELSE 0
          END AS road_km
        FROM ldt_core.city_entities ce
        WHERE ce.city_id = $1
          AND ce.entity_type IN ('building', 'facility', 'green_blue_system', 'road')
          AND ce.geom IS NOT NULL
      ),
      entity_bins AS (
        SELECT
          floor((ST_X(point_3857) - bounds.xmin) / $3::numeric)::int AS gx,
          floor((ST_Y(point_3857) - bounds.ymin) / $3::numeric)::int AS gy,
          entity_type,
          road_km
        FROM entity_points
        CROSS JOIN bounds
        WHERE point_3857 IS NOT NULL
      ),
      metrics AS (
        SELECT
          gx,
          gy,
          count(*) FILTER (WHERE entity_type = 'building')::int AS building_count,
          count(*) FILTER (WHERE entity_type = 'facility')::int AS facility_count,
          count(*) FILTER (WHERE entity_type = 'green_blue_system')::int AS green_blue_count,
          round(COALESCE(sum(road_km) FILTER (WHERE entity_type = 'road'), 0)::numeric, 3) AS road_km
        FROM entity_bins
        GROUP BY gx, gy
      ),
      ranked AS (
        SELECT
          s.cell_id,
          s.cell_3857,
          COALESCE(m.building_count, 0)::int AS building_count,
          COALESCE(m.facility_count, 0)::int AS facility_count,
          COALESCE(m.green_blue_count, 0)::int AS green_blue_count,
          COALESCE(m.road_km, 0)::numeric AS road_km,
          ntile(5) OVER (ORDER BY COALESCE(m.building_count, 0), s.cell_id) AS building_density_rank,
          ntile(5) OVER (ORDER BY COALESCE(m.road_km, 0), s.cell_id) AS road_density_rank,
          ntile(5) OVER (ORDER BY COALESCE(m.green_blue_count, 0), s.cell_id) AS green_blue_rank
        FROM scoped s
        LEFT JOIN metrics m ON m.gx = s.gx AND m.gy = s.gy
      )
      INSERT INTO ldt_viewer.density_grids (
        city_id,
        grid_key,
        zoom_hint,
        cell_id,
        geom,
        metrics,
        refreshed_at
      )
      SELECT
        $1,
        $2,
        CASE
          WHEN $3::int >= 3000 THEN 10
          WHEN $3::int >= 1500 THEN 11
          ELSE 12
        END,
        r.cell_id,
        ST_Transform(r.cell_3857, 4326)::geometry(Polygon, 4326),
        jsonb_build_object(
          'cellSizeM', $3::int,
          'buildingCount', r.building_count,
          'facilityCount', r.facility_count,
          'greenBlueCount', r.green_blue_count,
          'roadKm', r.road_km,
          'buildingDensityRank', r.building_density_rank,
          'roadDensityRank', r.road_density_rank,
          'greenBlueRank', r.green_blue_rank,
          'builtIntensity', round(LEAST(100, GREATEST(0, (
            r.building_density_rank * 17
            + r.road_density_rank * 6
            + LEAST(r.facility_count, 20) * 0.6
          )))::numeric, 1),
          'heatProxy', round(LEAST(100, GREATEST(0, (
            r.building_density_rank * 14
            + r.road_density_rank * 7
            + LEAST(r.facility_count, 20) * 0.7
            - r.green_blue_rank * 5
          )))::numeric, 1),
          'airflowFriction', round(LEAST(100, GREATEST(0, (
            r.building_density_rank * 15
            + r.road_density_rank * 4
            - r.green_blue_rank * 4
          )))::numeric, 1),
          'greenBlueCooling', round(LEAST(100, GREATEST(0, (
            r.green_blue_rank * 18
            + LEAST(r.green_blue_count, 12) * 1.2
          )))::numeric, 1),
          'phenomena', jsonb_build_object(
            'version', 'open-data-phenomena-v0',
            'method', 'Derived from normalized city inventory density grid: building counts, road length, facilities, and green-blue feature counts.',
            'authorityStatus', 'derived-open-data-proxy',
            'reproducible', true,
            'cityPortable', true
          )
        ),
        now()
      FROM ranked r
      RETURNING cell_id
    `,
    [cityId, gridKey, size],
  )
  return {
    gridKey,
    cellSizeM: size,
    cellCount: result.rowCount,
  }
}

async function refreshCityAggregates(client, cityId, options = {}) {
  const city = await client.query('SELECT id, name FROM ldt_core.cities WHERE id = $1', [cityId])
  if (city.rowCount === 0) throw new Error(`LDT_CITY_NOT_FOUND:${cityId}`)

  const summary = await refreshCitySummary(client, cityId)
  const densityGrid = await refreshDensityGrid(client, cityId, options)

  return {
    cityId,
    name: city.rows[0].name,
    summary,
    densityGrid,
  }
}

export async function refreshLdtViewerAggregates({
  cityIds = DEFAULT_CITY_IDS,
  cellSizeM = DEFAULT_CELL_SIZE_M,
  gridKey = DEFAULT_GRID_KEY,
} = {}) {
  return await withClient(async (client) => {
    return await withLowMemoryTransaction(client, async () => {
      const targetCityIds = await listCityIds(client, cityIds)
      const cities = []
      for (const cityId of targetCityIds) {
        cities.push(await refreshCityAggregates(client, cityId, { cellSizeM, gridKey }))
      }
      return {
        ok: true,
        cityCount: cities.length,
        cities: cities.map((city) => ({
          cityId: city.cityId,
          name: city.name,
          areaKm2: city.summary.areaKm2,
          buildingCount: city.summary.inventory.buildings,
          roadCount: city.summary.inventory.roads,
          densityGrid: city.densityGrid,
        })),
      }
    })
  })
}

export async function getLdtViewerSummary(cityId) {
  return await withClient(async (client) => {
    const result = await client.query(
      `
        SELECT
          city_id,
          summary_key,
          payload,
          refreshed_at,
          generated_by,
          metadata
        FROM ldt_viewer.city_summary_cache
        WHERE city_id = $1
      `,
      [cityId],
    )
    if (result.rowCount === 0) throw new Error(`LDT_VIEWER_SUMMARY_NOT_FOUND:${cityId}`)
    return {
      ok: true,
      ...result.rows[0],
    }
  })
}

export async function getLdtDensityGrid(cityId, { gridKey = DEFAULT_GRID_KEY, limit = 500 } = {}) {
  return await withClient(async (client) => {
    const rowLimit = Math.min(2000, Math.max(1, Number.parseInt(String(limit ?? 500), 10) || 500))
    const result = await client.query(
      `
        SELECT
          cell_id,
          metrics,
          ST_AsGeoJSON(geom)::jsonb AS geometry
        FROM ldt_viewer.density_grids
        WHERE city_id = $1
          AND grid_key = $2
        ORDER BY (metrics->>'buildingCount')::int DESC, cell_id
        LIMIT $3
      `,
      [cityId, gridKey, rowLimit],
    )
    return {
      type: 'FeatureCollection',
      cityId,
      gridKey,
      numberReturned: result.rowCount,
      features: result.rows.map((row) => ({
        type: 'Feature',
        id: row.cell_id,
        geometry: row.geometry,
        properties: {
          cellId: row.cell_id,
          ...row.metrics,
        },
      })),
    }
  })
}
