import {
  OPEN_METEO_DOCS_URL,
  OPEN_METEO_TERMS_URL,
  WEATHER_LAYER_KEYS,
} from './weatherFieldConfig.mjs'

export async function writeWeatherSamples(client, cityId, {
  gridKey,
  scenarioKey,
  sourceGridKey,
  samples,
  endpoint,
}) {
  await client.query(
    `
      UPDATE ldt_environment.phenomenon_layers
      SET
        enabled = true,
        source_status = 'source-backed-open-data',
        authority_status = 'open-weather-model-derived',
        value_kind = 'observed_or_modelled_measure',
        spatial_model = 'sampled_grid_and_object',
        metadata = metadata || jsonb_build_object(
          'sourceAdapter', 'open-meteo-current-weather',
          'sourceUrl', $1::text,
          'docsUrl', $2::text,
          'termsUrl', $3::text,
          'lastSourceBackedRunAt', now()
        ),
        updated_at = now()
      WHERE layer_key = ANY($4::text[])
    `,
    [endpoint, OPEN_METEO_DOCS_URL, OPEN_METEO_TERMS_URL, WEATHER_LAYER_KEYS],
  )
  await client.query('DROP TABLE IF EXISTS tmp_weather_samples')
  await client.query(
    `
      CREATE TEMP TABLE tmp_weather_samples ON COMMIT DROP AS
      SELECT *
      FROM jsonb_to_recordset($1::jsonb) AS samples(
        cell_id text,
        lon double precision,
        lat double precision,
        temperature_c numeric,
        wind_speed_ms numeric,
        wind_direction_deg numeric,
        observed_at timestamptz,
        timezone text,
        elevation_m numeric
      )
    `,
    [JSON.stringify(samples.map((sample) => ({
      cell_id: sample.cellId,
      lon: sample.lon,
      lat: sample.lat,
      temperature_c: sample.temperatureC,
      wind_speed_ms: sample.windSpeedMs,
      wind_direction_deg: sample.windDirectionDeg,
      observed_at: sample.observedAt || null,
      timezone: sample.timezone || 'UTC',
      elevation_m: sample.elevationM,
    })))],
  )
  await client.query('CREATE INDEX tmp_weather_samples_cell_idx ON tmp_weather_samples (cell_id)')
  await client.query('ANALYZE tmp_weather_samples')
  await deleteExistingWeatherObservations(client, cityId, scenarioKey)
  return await insertWeatherCells(client, cityId, {
    gridKey,
    scenarioKey,
    sourceGridKey,
    endpoint,
  })
}

async function deleteExistingWeatherObservations(client, cityId, scenarioKey) {
  await client.query(
    `
      DELETE FROM ldt_environment.object_observations observations
      USING ldt_environment.phenomenon_layers layers
      WHERE observations.layer_id = layers.id
        AND observations.city_id = $1
        AND observations.scenario_key = $2
        AND layers.layer_key = ANY($3::text[])
    `,
    [cityId, scenarioKey, WEATHER_LAYER_KEYS],
  )
  await client.query(
    `
      DELETE FROM ldt_environment.phenomenon_cells cells
      USING ldt_environment.phenomenon_layers layers
      WHERE cells.layer_id = layers.id
        AND cells.city_id = $1
        AND cells.scenario_key = $2
        AND layers.layer_key = ANY($3::text[])
    `,
    [cityId, scenarioKey, WEATHER_LAYER_KEYS],
  )
}

async function insertWeatherCells(client, cityId, {
  gridKey,
  scenarioKey,
  sourceGridKey,
  endpoint,
}) {
  const cells = await client.query(
    `
      WITH grid AS (
        SELECT cell_id, geom, metrics
        FROM ldt_viewer.density_grids
        WHERE city_id = $1
          AND grid_key = $2
      ),
      values_by_layer AS (
        SELECT
          samples.cell_id,
          grid.geom,
          grid.metrics,
          samples.lon,
          samples.lat,
          samples.observed_at,
          samples.timezone,
          samples.elevation_m,
          layer_values.layer_key,
          layer_values.value,
          layer_values.value_unit,
          layer_values.method
        FROM tmp_weather_samples samples
        JOIN grid ON grid.cell_id = samples.cell_id
        CROSS JOIN LATERAL (
          VALUES
            (
              'weather_air_temperature_c',
              samples.temperature_c,
              'celsius',
              'Open-Meteo current 2m air temperature sampled at the weather grid cell center.'
            ),
            (
              'weather_wind_speed_ms',
              samples.wind_speed_ms,
              'm_s',
              'Open-Meteo current 10m wind speed sampled at the weather grid cell center.'
            ),
            (
              'weather_wind_direction_deg',
              samples.wind_direction_deg,
              'degree',
              'Open-Meteo current 10m wind direction sampled at the weather grid cell center.'
            )
        ) AS layer_values(layer_key, value, value_unit, method)
        WHERE layer_values.value IS NOT NULL
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
        values_by_layer.cell_id || ':' || values_by_layer.layer_key,
        $4,
        values_by_layer.cell_id,
        $3,
        values_by_layer.observed_at,
        values_by_layer.value,
        'source-backed-open-weather',
        values_by_layer.geom,
        jsonb_build_object(
          'value', values_by_layer.value,
          'valueUnit', values_by_layer.value_unit,
          'temperatureC', CASE WHEN values_by_layer.layer_key = 'weather_air_temperature_c' THEN values_by_layer.value ELSE NULL END,
          'windSpeedMs', CASE WHEN values_by_layer.layer_key = 'weather_wind_speed_ms' THEN values_by_layer.value ELSE NULL END,
          'windDirectionDeg', CASE WHEN values_by_layer.layer_key = 'weather_wind_direction_deg' THEN values_by_layer.value ELSE NULL END,
          'samplePoint', jsonb_build_object('lon', values_by_layer.lon, 'lat', values_by_layer.lat),
          'observedAt', values_by_layer.observed_at,
          'timezone', values_by_layer.timezone,
          'apiElevationM', values_by_layer.elevation_m,
          'weatherGridKey', $2::text
        ) || values_by_layer.metrics,
        jsonb_build_object(
          'source', 'Open-Meteo Forecast API',
          'sourceUrl', $5::text,
          'docsUrl', $6::text,
          'termsUrl', $7::text,
          'method', values_by_layer.method,
          'authorityStatus', 'open-weather-model-derived',
          'reproducible', true,
          'cityPortable', true
        ),
        now()
      FROM values_by_layer
      JOIN ldt_environment.phenomenon_layers layers ON layers.layer_key = values_by_layer.layer_key
      RETURNING id
    `,
    [cityId, gridKey, scenarioKey, sourceGridKey, endpoint, OPEN_METEO_DOCS_URL, OPEN_METEO_TERMS_URL],
  )
  return cells.rowCount
}

export async function attachWeatherObservations(client, cityId, {
  scenarioKey,
  sourceGridKey,
}) {
  await client.query('DROP TABLE IF EXISTS tmp_weather_entity_points')
  await client.query(
    `
      CREATE TEMP TABLE tmp_weather_entity_points ON COMMIT DROP AS
      SELECT
        id AS entity_id,
        ST_PointOnSurface(ST_MakeValid(geom)) AS point_geom
      FROM ldt_core.city_entities
      WHERE city_id = $1
        AND geom IS NOT NULL
        AND lifecycle_status = 'active'
    `,
    [cityId],
  )
  await client.query('CREATE INDEX tmp_weather_entity_points_gix ON tmp_weather_entity_points USING gist (point_geom)')
  await client.query('CREATE INDEX tmp_weather_entity_points_entity_idx ON tmp_weather_entity_points (entity_id)')
  await client.query('ANALYZE tmp_weather_entity_points')
  await client.query('DROP TABLE IF EXISTS tmp_weather_cells')
  await client.query(
    `
      CREATE TEMP TABLE tmp_weather_cells ON COMMIT DROP AS
      SELECT
        cells.id AS cell_id,
        cells.layer_id,
        cells.value,
        cells.confidence,
        cells.metrics,
        cells.provenance,
        cells.observed_at,
        cells.geom
      FROM ldt_environment.phenomenon_cells cells
      JOIN ldt_environment.phenomenon_layers layers ON layers.id = cells.layer_id
      WHERE cells.city_id = $1
        AND cells.scenario_key = $2
        AND cells.source_grid_key = $3
        AND layers.layer_key = ANY($4::text[])
    `,
    [cityId, scenarioKey, sourceGridKey, WEATHER_LAYER_KEYS],
  )
  await client.query('CREATE INDEX tmp_weather_cells_gix ON tmp_weather_cells USING gist (geom)')
  await client.query('CREATE INDEX tmp_weather_cells_layer_idx ON tmp_weather_cells (layer_id)')
  await client.query('ANALYZE tmp_weather_cells')
  const result = await client.query(
    `
      WITH attached AS (
        SELECT DISTINCT ON (points.entity_id, cells.layer_id)
          points.entity_id,
          cells.layer_id,
          cells.cell_id,
          cells.value,
          cells.confidence,
          cells.observed_at,
          COALESCE(cells.provenance->>'method', 'Spatially attached from source-backed weather grid.') AS method,
          jsonb_build_object(
            'sourceCellId', cells.cell_id,
            'sourceGridKey', $3::text,
            'attachmentMethod', 'point-on-surface-within-weather-cell',
            'authorityStatus', 'open-weather-model-derived',
            'source', cells.provenance->>'source',
            'observedAt', cells.observed_at
          ) AS properties
        FROM tmp_weather_entity_points points
        JOIN tmp_weather_cells cells ON cells.geom && points.point_geom
          AND ST_Covers(cells.geom, points.point_geom)
        ORDER BY points.entity_id, cells.layer_id, cells.observed_at DESC NULLS LAST
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
        observed_at,
        value,
        confidence,
        method,
        properties,
        now()
      FROM attached
      ON CONFLICT (city_id, entity_id, layer_id, scenario_key) DO UPDATE SET
        source_cell_id = EXCLUDED.source_cell_id,
        observed_at = EXCLUDED.observed_at,
        value = EXCLUDED.value,
        confidence = EXCLUDED.confidence,
        method = EXCLUDED.method,
        properties = EXCLUDED.properties,
        generated_at = now()
      RETURNING id
    `,
    [cityId, scenarioKey, sourceGridKey],
  )
  return result.rowCount
}
