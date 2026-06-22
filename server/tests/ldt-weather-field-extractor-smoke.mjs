import assert from 'node:assert/strict'
import pg from 'pg'

import {
  closeLdtWeatherFieldExtractorPool,
  runWeatherFieldExtractor,
} from '../services/ldtWeatherFieldExtractorService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

const cityId = argValue('city') || 'kharkiv'
const scenarioKey = argValue('scenario') || 'baseline'
const gridResolutionM = argValue('grid-resolution-m') || process.env.TWIN_STUDIO_WEATHER_GRID_RESOLUTION_M || 6000
const endpoint = argValue('endpoint') || process.env.TWIN_STUDIO_WEATHER_OPEN_METEO_ENDPOINT || undefined

const pool = new pg.Pool({
  connectionString: process.env.TWIN_STUDIO_DATABASE_URL || process.env.DATABASE_URL,
})

try {
  const result = await runWeatherFieldExtractor({
    cityIds: [cityId],
    scenarioKey,
    gridResolutionM,
    endpoint,
    batchSize: 40,
  })
  assert.equal(result.ok, true, 'WEATHER_FIELD_RESULT_NOT_OK')
  assert.equal(result.cities.length, 1, 'WEATHER_FIELD_CITY_COUNT_INVALID')
  const city = result.cities[0]
  assert(city.sampledCells > 0, 'WEATHER_FIELD_NO_SAMPLED_CELLS')
  assert(city.cellsWritten >= city.sampledCells * 3, 'WEATHER_FIELD_CELLS_WRITTEN_LOW')
  assert(city.objectObservations > 0, 'WEATHER_FIELD_NO_OBJECT_OBSERVATIONS')
  assert(city.objectSummaries > 0, 'WEATHER_FIELD_NO_OBJECT_SUMMARIES')

  const checks = await pool.query(
    `
      SELECT
        (SELECT count(*)::int
         FROM ldt_environment.phenomenon_cells cells
         JOIN ldt_environment.phenomenon_layers layers ON layers.id = cells.layer_id
         WHERE cells.city_id = $1
           AND cells.scenario_key = $2
           AND layers.layer_key = 'weather_air_temperature_c') AS temperature_cells,
        (SELECT count(*)::int
         FROM ldt_environment.phenomenon_cells cells
         JOIN ldt_environment.phenomenon_layers layers ON layers.id = cells.layer_id
         WHERE cells.city_id = $1
           AND cells.scenario_key = $2
           AND layers.layer_key = 'weather_wind_speed_ms') AS wind_speed_cells,
        (SELECT count(*)::int
         FROM ldt_environment.object_observations observations
         JOIN ldt_environment.phenomenon_layers layers ON layers.id = observations.layer_id
         WHERE observations.city_id = $1
           AND observations.scenario_key = $2
           AND layers.layer_key IN ('weather_air_temperature_c', 'weather_wind_speed_ms', 'weather_wind_direction_deg')) AS object_observations,
        (SELECT count(*)::int
         FROM ldt_environment.object_observation_summary
         WHERE city_id = $1
           AND scenario_key = $2
           AND weather_air_temperature_c IS NOT NULL) AS summary_temperature_rows,
        (SELECT count(*)::int
         FROM ldt_environment.extractor_runs
         WHERE city_id = $1
           AND scenario_key = $2
           AND extractor_key = 'weather-field'
           AND status = 'completed'
           AND source_status = 'source-backed-open-data') AS completed_runs,
        (SELECT count(*)::int
         FROM ldt_catalog.datasets
         WHERE city_id = $1
           AND identifier = $3) AS datasets
    `,
    [cityId, scenarioKey, city.datasetIdentifier],
  )
  const row = checks.rows[0]
  assert(row.temperature_cells > 0, 'WEATHER_FIELD_TEMPERATURE_CELLS_MISSING')
  assert(row.wind_speed_cells > 0, 'WEATHER_FIELD_WIND_SPEED_CELLS_MISSING')
  assert(row.object_observations > 0, 'WEATHER_FIELD_OBJECT_OBSERVATIONS_MISSING')
  assert(row.summary_temperature_rows > 0, 'WEATHER_FIELD_SUMMARY_ROWS_MISSING')
  assert(row.completed_runs > 0, 'WEATHER_FIELD_COMPLETED_RUN_MISSING')
  assert(row.datasets > 0, 'WEATHER_FIELD_DATASET_MISSING')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    scenarioKey,
    gridResolutionM: city.gridResolutionM,
    sampledCells: city.sampledCells,
    failedBatches: city.failedBatches,
    cellsWritten: city.cellsWritten,
    objectObservations: city.objectObservations,
    objectSummaries: city.objectSummaries,
    observedAt: city.observedAt,
  }, null, 2))
} finally {
  await pool.end()
  await closeLdtWeatherFieldExtractorPool()
}
