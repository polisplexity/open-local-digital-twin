import assert from 'node:assert/strict'
import pg from 'pg'

import {
  closeLdtTerrainDemExtractorPool,
  runTerrainDemExtractor,
} from '../services/ldtTerrainDemExtractorService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

const cityId = argValue('city') || 'kharkiv'
const scenarioKey = argValue('scenario') || 'baseline'
const gridKey = argValue('grid-key') || 'city-density-2km'
const tileZoom = argValue('tile-zoom') || process.env.TWIN_STUDIO_TERRAIN_DEM_ZOOM || 12

const pool = new pg.Pool({
  connectionString: process.env.TWIN_STUDIO_DATABASE_URL || process.env.DATABASE_URL,
})

try {
  const result = await runTerrainDemExtractor({
    cityIds: [cityId],
    scenarioKey,
    gridKey,
    tileZoom,
  })
  assert.equal(result.ok, true, 'TERRAIN_DEM_RESULT_NOT_OK')
  assert.equal(result.cities.length, 1, 'TERRAIN_DEM_CITY_COUNT_INVALID')
  const city = result.cities[0]
  assert(city.sampledCells > 0, 'TERRAIN_DEM_NO_SAMPLED_CELLS')
  assert(city.cellsWritten >= city.sampledCells * 2, 'TERRAIN_DEM_CELLS_WRITTEN_LOW')
  assert(city.objectObservations > 0, 'TERRAIN_DEM_NO_OBJECT_OBSERVATIONS')
  assert(city.tileCount > 0, 'TERRAIN_DEM_TILE_COUNT_LOW')

  const checks = await pool.query(
    `
      SELECT
        (SELECT count(*)::int
         FROM ldt_environment.phenomenon_cells cells
         JOIN ldt_environment.phenomenon_layers layers ON layers.id = cells.layer_id
         WHERE cells.city_id = $1
           AND cells.scenario_key = $2
           AND layers.layer_key = 'terrain_elevation_m') AS elevation_cells,
        (SELECT count(*)::int
         FROM ldt_environment.phenomenon_cells cells
         JOIN ldt_environment.phenomenon_layers layers ON layers.id = cells.layer_id
         WHERE cells.city_id = $1
           AND cells.scenario_key = $2
           AND layers.layer_key = 'terrain_slope_deg') AS slope_cells,
        (SELECT count(*)::int
         FROM ldt_environment.object_observations observations
         JOIN ldt_environment.phenomenon_layers layers ON layers.id = observations.layer_id
         WHERE observations.city_id = $1
           AND observations.scenario_key = $2
           AND layers.layer_key IN ('terrain_elevation_m', 'terrain_slope_deg')) AS object_observations,
        (SELECT count(*)::int
         FROM ldt_environment.extractor_runs
         WHERE city_id = $1
           AND scenario_key = $2
           AND extractor_key = 'terrain-dem'
           AND status = 'completed'
           AND source_status = 'source-backed-open-data') AS completed_runs,
        (SELECT count(*)::int
         FROM ldt_catalog.datasets
         WHERE city_id = $1
           AND identifier = $3) AS datasets
    `,
    [cityId, scenarioKey, `${cityId}:mapzen-terrain-tiles-dem:z${city.tileZoom}`],
  )
  const row = checks.rows[0]
  assert(row.elevation_cells > 0, 'TERRAIN_DEM_ELEVATION_CELLS_MISSING')
  assert(row.slope_cells > 0, 'TERRAIN_DEM_SLOPE_CELLS_MISSING')
  assert(row.object_observations > 0, 'TERRAIN_DEM_OBJECT_OBSERVATIONS_MISSING')
  assert(row.completed_runs > 0, 'TERRAIN_DEM_COMPLETED_RUN_MISSING')
  assert(row.datasets > 0, 'TERRAIN_DEM_DATASET_MISSING')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    scenarioKey,
    sampledCells: city.sampledCells,
    failedCells: city.failedCells,
    tileCount: city.tileCount,
    cellsWritten: city.cellsWritten,
    objectObservations: city.objectObservations,
  }, null, 2))
} finally {
  await pool.end()
  await closeLdtTerrainDemExtractorPool()
}
