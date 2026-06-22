import { closeSharedProductionPool, withProductionClient as withClient } from './serviceDatabase.mjs'
import { refreshLdtObjectObservationSummary } from './ldtObservationSummaryService.mjs'

const DEFAULT_CITY_IDS = ['adazi', 'kharkiv']
const DEFAULT_GRID_KEY = 'city-density-2km'
const DEFAULT_SCENARIO_KEY = 'baseline'
const DEFAULT_CELL_LIMIT = 2000
const MAX_CELL_LIMIT = 50000
const TERRAIN_LAYER_KEYS = new Set(['terrain_elevation_m', 'terrain_slope_deg'])

const ENVIRONMENTAL_LAYERS = [
  {
    layerKey: 'built_form_proxy',
    viewerMode: 'builtIntensity',
    metricKey: 'builtIntensity',
  },
  {
    layerKey: 'heat_proxy',
    viewerMode: 'heatProxy',
    metricKey: 'heatProxy',
  },
  {
    layerKey: 'air_roughness_proxy',
    viewerMode: 'airflowFriction',
    metricKey: 'airflowFriction',
  },
  {
    layerKey: 'green_blue_cooling_proxy',
    viewerMode: 'greenBlueCooling',
    metricKey: 'greenBlueCooling',
  },
  {
    layerKey: 'solar_exposure_proxy',
    viewerMode: 'solarExposureProxy',
    metricKey: 'solarExposureProxy',
  },
  {
    layerKey: 'water_flow_proxy',
    viewerMode: 'waterFlowProxy',
    metricKey: 'waterFlowProxy',
  },
  {
    layerKey: 'surface_runoff_screening',
    viewerMode: 'surfaceRunoff',
    metricKey: 'surfaceRunoffScreening',
  },
]

const LAYER_ALIASES = new Map([
  ['builtintensity', 'built_form_proxy'],
  ['builtform', 'built_form_proxy'],
  ['built_form', 'built_form_proxy'],
  ['built_form_proxy', 'built_form_proxy'],
  ['heatproxy', 'heat_proxy'],
  ['heat_proxy', 'heat_proxy'],
  ['thermal', 'heat_proxy'],
  ['airflowfriction', 'air_roughness_proxy'],
  ['airproxy', 'air_roughness_proxy'],
  ['air_roughness_proxy', 'air_roughness_proxy'],
  ['windproxy', 'air_roughness_proxy'],
  ['wind', 'air_roughness_proxy'],
  ['greenbluecooling', 'green_blue_cooling_proxy'],
  ['coolingproxy', 'green_blue_cooling_proxy'],
  ['green_blue_cooling_proxy', 'green_blue_cooling_proxy'],
  ['solarexposureproxy', 'solar_exposure_proxy'],
  ['solarproxy', 'solar_exposure_proxy'],
  ['sun', 'solar_exposure_proxy'],
  ['solar_exposure_proxy', 'solar_exposure_proxy'],
  ['waterflowproxy', 'water_flow_proxy'],
  ['waterflow', 'water_flow_proxy'],
  ['waterproxy', 'water_flow_proxy'],
  ['water_flow_proxy', 'water_flow_proxy'],
  ['water', 'hydrology_surface_water_signal'],
  ['hydrology', 'hydrology_surface_water_signal'],
  ['surfacewater', 'hydrology_surface_water_signal'],
  ['surface_water', 'hydrology_surface_water_signal'],
  ['hydrologysignal', 'hydrology_surface_water_signal'],
  ['watersignal', 'hydrology_surface_water_signal'],
  ['hydrology_surface_water_signal', 'hydrology_surface_water_signal'],
  ['surfacerunoff', 'surface_runoff_screening'],
  ['surface_runoff', 'surface_runoff_screening'],
  ['runoff', 'surface_runoff_screening'],
  ['runoffscreening', 'surface_runoff_screening'],
  ['surface_runoff_screening', 'surface_runoff_screening'],
  ['terrain', 'terrain_elevation_m'],
  ['elevation', 'terrain_elevation_m'],
  ['altitude', 'terrain_elevation_m'],
  ['terrain_elevation_m', 'terrain_elevation_m'],
  ['slope', 'terrain_slope_deg'],
  ['terrain_slope_deg', 'terrain_slope_deg'],
  ['temperature', 'weather_air_temperature_c'],
  ['airtemperature', 'weather_air_temperature_c'],
  ['air_temperature', 'weather_air_temperature_c'],
  ['weather_air_temperature_c', 'weather_air_temperature_c'],
  ['windspeed', 'weather_wind_speed_ms'],
  ['wind_speed', 'weather_wind_speed_ms'],
  ['weather_wind_speed_ms', 'weather_wind_speed_ms'],
  ['winddirection', 'weather_wind_direction_deg'],
  ['wind_direction', 'weather_wind_direction_deg'],
  ['weather_wind_direction_deg', 'weather_wind_direction_deg'],
])

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function integerValue(value, fallback, min, max) {
  const number = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeBbox(value) {
  const values = Array.isArray(value)
    ? value
    : String(value ?? '').split(',')
  if (values.length < 4) return null
  const bbox = values.slice(0, 4).map((item) => finiteNumber(item))
  if (bbox.some((item) => item == null)) return null
  const [west, south, east, north] = bbox
  return [
    Math.min(west, east),
    Math.min(south, north),
    Math.max(west, east),
    Math.max(south, north),
  ]
}

function normalizeCenter(value) {
  const values = Array.isArray(value)
    ? value
    : String(value ?? '').split(',')
  if (values.length < 2) return null
  const lon = finiteNumber(values[0])
  const lat = finiteNumber(values[1])
  if (lon == null || lat == null) return null
  return [lon, lat]
}

function normalizeLayerKey(value, fallback = '') {
  const raw = compactText(value, fallback)
  const key = raw.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
  return LAYER_ALIASES.get(key) || raw
}

async function listCityIds(client, requestedCityIds) {
  if (requestedCityIds.length > 0) return requestedCityIds
  const result = await client.query('SELECT id FROM ldt_core.cities ORDER BY id')
  return result.rows.map((row) => row.id)
}

async function refreshEnvironmentalCells(client, cityId, {
  gridKey = DEFAULT_GRID_KEY,
  scenarioKey = DEFAULT_SCENARIO_KEY,
} = {}) {
  await client.query(
    `
      DELETE FROM ldt_environment.object_observation_summary
      WHERE city_id = $1
        AND scenario_key = $2
    `,
    [cityId, scenarioKey],
  )

  await client.query(
    `
      DELETE FROM ldt_environment.object_observations observations
      USING ldt_environment.phenomenon_layers layers
      WHERE observations.layer_id = layers.id
        AND observations.city_id = $1
        AND observations.scenario_key = $2
        AND layers.source_status = 'open-data-derived'
    `,
    [cityId, scenarioKey],
  )

  await client.query(
    `
      DELETE FROM ldt_environment.phenomenon_cells cells
      USING ldt_environment.phenomenon_layers layers
      WHERE cells.layer_id = layers.id
        AND cells.city_id = $1
        AND cells.scenario_key = $2
        AND cells.source_grid_key = $3
        AND layers.source_status = 'open-data-derived'
    `,
    [cityId, scenarioKey, gridKey],
  )

  const result = await client.query(
    `
      WITH source_grid AS (
        SELECT
          cell_id,
          geom,
          metrics,
          NULLIF(metrics->>'builtIntensity', '')::numeric AS built_intensity,
          NULLIF(metrics->>'heatProxy', '')::numeric AS heat_proxy,
          NULLIF(metrics->>'airflowFriction', '')::numeric AS air_roughness_proxy,
          NULLIF(metrics->>'greenBlueCooling', '')::numeric AS green_blue_cooling_proxy,
          COALESCE(NULLIF(metrics->>'greenBlueCount', '')::numeric, 0) AS green_blue_count
        FROM ldt_viewer.density_grids
        WHERE city_id = $1
          AND grid_key = $3
      ),
      values_by_layer AS (
        SELECT
          sg.cell_id,
          sg.geom,
          sg.metrics,
          layer_values.layer_key,
          round(LEAST(100, GREATEST(0, layer_values.value))::numeric, 1) AS value,
          layer_values.method
        FROM source_grid sg
        CROSS JOIN LATERAL (
          VALUES
            (
              'built_form_proxy',
              COALESCE(sg.built_intensity, 0),
              'Derived from open-data building, road, and facility density.'
            ),
            (
              'heat_proxy',
              COALESCE(sg.heat_proxy, 0),
              'Derived from built fabric and road intensity minus green-blue cooling signal.'
            ),
            (
              'air_roughness_proxy',
              COALESCE(sg.air_roughness_proxy, 0),
              'Derived from built and road density as an urban wind-roughness proxy.'
            ),
            (
              'green_blue_cooling_proxy',
              COALESCE(sg.green_blue_cooling_proxy, 0),
              'Derived from open-data green-blue system density.'
            ),
            (
              'solar_exposure_proxy',
              COALESCE(sg.heat_proxy, 0) * 0.58
                + COALESCE(sg.built_intensity, 0) * 0.28
                - COALESCE(sg.green_blue_cooling_proxy, 0) * 0.22
                + 12,
              'Derived from urban form and weak green-blue cooling signal. Not a timestamped shadow model.'
            ),
            (
              'water_flow_proxy',
              CASE
                WHEN sg.green_blue_count > 0
                  THEN COALESCE(sg.green_blue_cooling_proxy, 0)
                ELSE 0
              END,
              'Derived from green-blue open-data cells. Not a hydraulic or drainage simulation.'
            )
        ) AS layer_values(layer_key, value, method)
      )
      INSERT INTO ldt_environment.phenomenon_cells (
        city_id,
        layer_id,
        cell_key,
        source_grid_key,
        source_cell_id,
        scenario_key,
        observed_at,
        value,
        confidence,
        geom,
        metrics,
        provenance,
        generated_at
      )
      SELECT
        $1,
        layers.id,
        values_by_layer.cell_id,
        $3,
        values_by_layer.cell_id,
        $2,
        NULL,
        values_by_layer.value,
        'proxy',
        values_by_layer.geom,
        values_by_layer.metrics || jsonb_build_object(
          'phenomenonLayerKey', values_by_layer.layer_key,
          'phenomenonValue', values_by_layer.value,
          'phenomenonMethod', values_by_layer.method
        ),
        jsonb_build_object(
          'source', 'ldt_viewer.density_grids',
          'sourceGridKey', $3,
          'sourceCellId', values_by_layer.cell_id,
          'method', values_by_layer.method,
          'authorityStatus', 'derived-open-data-proxy',
          'reproducible', true,
          'cityPortable', true
        ),
        now()
      FROM values_by_layer
      JOIN ldt_environment.phenomenon_layers layers ON layers.layer_key = values_by_layer.layer_key
      ON CONFLICT (city_id, layer_id, cell_key, scenario_key) DO UPDATE SET
        value = EXCLUDED.value,
        geom = EXCLUDED.geom,
        metrics = EXCLUDED.metrics,
        provenance = EXCLUDED.provenance,
        generated_at = now()
      RETURNING id
    `,
    [cityId, scenarioKey, gridKey],
  )

  return result.rowCount
}

async function refreshObjectObservations(client, cityId, {
  scenarioKey = DEFAULT_SCENARIO_KEY,
  gridKey = DEFAULT_GRID_KEY,
} = {}) {
  await client.query(
    `
      DELETE FROM ldt_environment.object_observations observations
      USING ldt_environment.phenomenon_layers layers
      WHERE observations.layer_id = layers.id
        AND observations.city_id = $1
        AND observations.scenario_key = $2
        AND layers.source_status = 'open-data-derived'
    `,
    [cityId, scenarioKey],
  )

  await client.query('DROP TABLE IF EXISTS tmp_environment_entity_points')
  await client.query(
    `
      CREATE TEMP TABLE tmp_environment_entity_points ON COMMIT DROP AS
      SELECT
        id AS entity_id,
        ST_PointOnSurface(ST_MakeValid(geom)) AS point_geom
      FROM ldt_core.city_entities
      WHERE city_id = $1
        AND geom IS NOT NULL
        AND lifecycle_status = 'active'
        AND entity_type IN (
          'building',
          'road',
          'facility',
          'green_blue_system',
          'land_use',
          'place',
          'mobility_asset',
          'service_point'
        )
    `,
    [cityId],
  )
  await client.query('CREATE INDEX tmp_environment_entity_points_gix ON tmp_environment_entity_points USING gist (point_geom)')
  await client.query('CREATE INDEX tmp_environment_entity_points_entity_idx ON tmp_environment_entity_points (entity_id)')
  await client.query('ANALYZE tmp_environment_entity_points')

  await client.query('DROP TABLE IF EXISTS tmp_environment_cells')
  await client.query(
    `
      CREATE TEMP TABLE tmp_environment_cells ON COMMIT DROP AS
      SELECT
        cells.id AS cell_id,
        cells.source_cell_id,
        cells.layer_id,
        cells.value,
        cells.confidence,
        cells.metrics,
        cells.provenance,
        cells.geom
      FROM ldt_environment.phenomenon_cells cells
      WHERE cells.city_id = $1
        AND cells.scenario_key = $2
        AND cells.source_grid_key = $3
    `,
    [cityId, scenarioKey, gridKey],
  )
  await client.query('CREATE INDEX tmp_environment_cells_gix ON tmp_environment_cells USING gist (geom)')
  await client.query('CREATE INDEX tmp_environment_cells_layer_idx ON tmp_environment_cells (layer_id)')
  await client.query('ANALYZE tmp_environment_cells')

  const result = await client.query(
    `
      WITH attached AS (
        SELECT DISTINCT ON (ep.entity_id, cells.layer_id)
          ep.entity_id,
          cells.layer_id,
          cells.cell_id,
          cells.value,
          cells.confidence,
          COALESCE(cells.provenance->>'method', 'Spatially attached from open-data proxy grid.') AS method,
          jsonb_build_object(
            'sourceCellId', cells.source_cell_id,
            'sourceGridKey', $3::text,
            'attachmentMethod', 'point-on-surface-within-grid-cell',
            'authorityStatus', 'derived-open-data-proxy'
          ) AS properties
        FROM tmp_environment_entity_points ep
        JOIN tmp_environment_cells cells ON cells.geom && ep.point_geom
          AND ST_Covers(cells.geom, ep.point_geom)
        ORDER BY ep.entity_id, cells.layer_id, cells.value DESC
      )
      INSERT INTO ldt_environment.object_observations (
        city_id,
        entity_id,
        layer_id,
        source_cell_id,
        scenario_key,
        observed_at,
        value,
        confidence,
        method,
        properties,
        generated_at
      )
      SELECT
        $1,
        entity_id,
        layer_id,
        cell_id,
        $2::text,
        NULL,
        value,
        confidence,
        method,
        properties,
        now()
      FROM attached
      ON CONFLICT (city_id, entity_id, layer_id, scenario_key) DO UPDATE SET
        source_cell_id = EXCLUDED.source_cell_id,
        value = EXCLUDED.value,
        confidence = EXCLUDED.confidence,
        method = EXCLUDED.method,
        properties = EXCLUDED.properties,
        generated_at = now()
      RETURNING id
    `,
    [cityId, scenarioKey, gridKey],
  )

  return result.rowCount
}

async function refreshObjectObservationSummary(client, cityId, {
  scenarioKey = DEFAULT_SCENARIO_KEY,
} = {}) {
  return refreshLdtObjectObservationSummary(client, cityId, { scenarioKey })
}

export async function refreshLdtEnvironmentalPhenomena({
  cityIds = DEFAULT_CITY_IDS,
  scenarioKey = DEFAULT_SCENARIO_KEY,
  gridKey = DEFAULT_GRID_KEY,
} = {}) {
  return await withClient(async (client) => {
    await client.query('BEGIN')
    try {
      await client.query('SET LOCAL max_parallel_workers_per_gather = 0')
      await client.query("SET LOCAL work_mem = '24MB'")
      const targetCityIds = await listCityIds(client, cityIds)
      const cities = []
      for (const cityId of targetCityIds) {
        const cells = await refreshEnvironmentalCells(client, cityId, { scenarioKey, gridKey })
        const objectObservations = await refreshObjectObservations(client, cityId, { scenarioKey, gridKey })
        const objectSummaries = await refreshObjectObservationSummary(client, cityId, { scenarioKey })
        cities.push({ cityId, cells, objectObservations, objectSummaries })
      }
      await client.query('COMMIT')
      return {
        ok: true,
        schema: 'ldt_environment',
        scenarioKey,
        gridKey,
        cityCount: cities.length,
        cities,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

export async function getLdtEnvironmentalLayers(cityId) {
  return await withClient(async (client) => {
    const result = await client.query(
      `
        SELECT
          layers.layer_key,
          layers.display_name,
          layers.phenomenon_family,
          layers.value_unit,
          layers.value_kind,
          layers.spatial_model,
          layers.source_status,
          layers.authority_status,
          layers.description,
          layers.metadata,
          COALESCE(cells.cell_count, 0)::int AS cell_count,
          COALESCE(observations.observation_count, 0)::int AS observation_count
        FROM ldt_environment.phenomenon_layers layers
        LEFT JOIN (
          SELECT layer_id, count(*) AS cell_count
          FROM ldt_environment.phenomenon_cells
          WHERE city_id = $1
          GROUP BY layer_id
        ) cells ON cells.layer_id = layers.id
        LEFT JOIN (
          SELECT layer_id, count(*) AS observation_count
          FROM ldt_environment.object_observations
          WHERE city_id = $1
          GROUP BY layer_id
        ) observations ON observations.layer_id = layers.id
        WHERE layers.enabled
        ORDER BY
          CASE layers.layer_key
            WHEN 'built_form_proxy' THEN 1
            WHEN 'heat_proxy' THEN 2
            WHEN 'air_roughness_proxy' THEN 3
            WHEN 'green_blue_cooling_proxy' THEN 4
            WHEN 'solar_exposure_proxy' THEN 5
            WHEN 'water_flow_proxy' THEN 6
            WHEN 'hydrology_surface_water_signal' THEN 7
            WHEN 'surface_runoff_screening' THEN 8
            WHEN 'weather_air_temperature_c' THEN 9
            WHEN 'weather_wind_speed_ms' THEN 10
            WHEN 'weather_wind_direction_deg' THEN 11
            WHEN 'terrain_elevation_m' THEN 12
            WHEN 'terrain_slope_deg' THEN 13
            ELSE 20
          END
      `,
      [cityId],
    )
    return {
      ok: true,
      cityId,
      layers: result.rows.map((row) => ({
        key: row.layer_key,
        label: row.display_name,
        family: row.phenomenon_family,
        valueUnit: row.value_unit,
        valueKind: row.value_kind,
        spatialModel: row.spatial_model,
        sourceStatus: row.source_status,
        authorityStatus: row.authority_status,
        description: row.description,
        metadata: row.metadata || {},
        cellCount: row.cell_count,
        observationCount: row.observation_count,
      })),
    }
  })
}

export async function getLdtEnvironmentalCells(cityId, {
  layerKey = 'heat_proxy',
  scenarioKey = DEFAULT_SCENARIO_KEY,
  limit = DEFAULT_CELL_LIMIT,
  bbox,
  center,
  radiusMeters,
} = {}) {
  const normalizedLayerKey = normalizeLayerKey(layerKey, 'heat_proxy')
  const rowLimit = integerValue(limit, DEFAULT_CELL_LIMIT, 1, MAX_CELL_LIMIT)
  const isTerrainLayer = TERRAIN_LAYER_KEYS.has(normalizedLayerKey)
  const bboxFilter = normalizeBbox(bbox)
  const centerFilter = normalizeCenter(center)
  const radiusFilter = finiteNumber(radiusMeters)
  return await withClient(async (client) => {
    const params = [cityId, scenarioKey, normalizedLayerKey, rowLimit, isTerrainLayer]
    const spatialClauses = []
    if (bboxFilter) {
      const start = params.length + 1
      params.push(...bboxFilter)
      spatialClauses.push(`
        AND cells.geom && ST_MakeEnvelope($${start}, $${start + 1}, $${start + 2}, $${start + 3}, 4326)
        AND ST_Intersects(cells.geom, ST_MakeEnvelope($${start}, $${start + 1}, $${start + 2}, $${start + 3}, 4326))
      `)
    }
    if (centerFilter && radiusFilter != null && radiusFilter > 0) {
      const start = params.length + 1
      params.push(centerFilter[0], centerFilter[1], radiusFilter)
      spatialClauses.push(`
        AND ST_DWithin(
          cells.geom::geography,
          ST_SetSRID(ST_MakePoint($${start}, $${start + 1}), 4326)::geography,
          $${start + 2}::double precision
        )
      `)
    }
    const result = await client.query(
      `
        SELECT
          cells.id,
          cells.cell_key,
          cells.source_grid_key,
          cells.source_cell_id,
          cells.scenario_key,
          cells.value,
          cells.confidence,
          cells.metrics,
          cells.provenance,
          layers.layer_key,
          layers.display_name,
          layers.phenomenon_family,
          layers.value_unit,
          layers.authority_status,
          ST_AsGeoJSON(cells.geom)::jsonb AS geometry
        FROM ldt_environment.phenomenon_cells cells
        JOIN ldt_environment.phenomenon_layers layers ON layers.id = cells.layer_id
        WHERE cells.city_id = $1
          AND cells.scenario_key = $2
          AND layers.layer_key = $3
          ${spatialClauses.join('\n')}
        ORDER BY
          CASE WHEN $5::boolean THEN cells.cell_key END ASC,
          CASE WHEN NOT $5::boolean THEN cells.value END DESC,
          cells.cell_key
        LIMIT $4
      `,
      params,
    )
    return {
      type: 'FeatureCollection',
      ok: true,
      cityId,
      layerKey: normalizedLayerKey,
      scenarioKey,
      numberReturned: result.rowCount,
      filters: {
        bbox: bboxFilter,
        center: centerFilter,
        radiusMeters: radiusFilter,
      },
      features: result.rows.map((row) => ({
        type: 'Feature',
        id: row.id,
        geometry: row.geometry,
        properties: {
          cellId: row.cell_key,
          sourceGridKey: row.source_grid_key,
          sourceCellId: row.source_cell_id,
          scenarioKey: row.scenario_key,
          layerKey: row.layer_key,
          label: row.display_name,
          phenomenonFamily: row.phenomenon_family,
          valueUnit: row.value_unit,
          authorityStatus: row.authority_status,
          value: Number(row.value),
          confidence: row.confidence,
          metrics: row.metrics || {},
          provenance: row.provenance || {},
        },
      })),
    }
  })
}

export async function getLdtObjectEnvironmentalObservations(cityId, {
  objectId,
  entityId,
} = {}) {
  const stableObjectId = compactText(objectId)
  const stableEntityId = compactText(entityId)
  return await withClient(async (client) => {
    const result = await client.query(
      `
        SELECT
          object_id,
          entity_id,
          entity_type,
          label,
          layer_key,
          display_name,
          phenomenon_family,
          value_unit,
          value_kind,
          value,
          confidence,
          method,
          scenario_key,
          observed_at,
          generated_at,
          properties
        FROM ldt_environment.object_environment_observations
        WHERE city_id = $1
          AND ($2::text = '' OR object_id = $2)
          AND ($3::uuid IS NULL OR entity_id = $3::uuid)
        ORDER BY object_id, layer_key
        LIMIT 200
      `,
      [cityId, stableObjectId, stableEntityId || null],
    )
    return {
      ok: true,
      cityId,
      objectId: stableObjectId || null,
      entityId: stableEntityId || null,
      observations: result.rows.map((row) => ({
        objectId: row.object_id,
        entityId: row.entity_id,
        entityType: row.entity_type,
        label: row.label,
        layerKey: row.layer_key,
        labelName: row.display_name,
        family: row.phenomenon_family,
        valueUnit: row.value_unit,
        valueKind: row.value_kind,
        value: Number(row.value),
        confidence: row.confidence,
        method: row.method,
        scenarioKey: row.scenario_key,
        observedAt: row.observed_at,
        generatedAt: row.generated_at,
        properties: row.properties || {},
      })),
    }
  })
}

export async function closeLdtEnvironmentalPool() {
  await closeSharedProductionPool()
}

export function environmentalLayerAliases() {
  return ENVIRONMENTAL_LAYERS.map((layer) => ({ ...layer }))
}
