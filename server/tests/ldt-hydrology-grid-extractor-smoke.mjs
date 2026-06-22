import assert from 'node:assert/strict'
import pg from 'pg'

import {
  closeLdtHydrologyGridExtractorPool,
  runHydrologyGridExtractor,
} from '../services/ldtHydrologyGridExtractorService.mjs'
import {
  closeLdtEnvironmentalPool,
  getLdtEnvironmentalCells,
  getLdtObjectEnvironmentalObservations,
} from '../services/ldtEnvironmentalService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

const cityId = argValue('city') || 'kharkiv'
const scenarioKey = argValue('scenario') || 'baseline'
const sourceGridKey = argValue('source-grid-key') || undefined
const layerKey = 'hydrology_surface_water_signal'

const pool = new pg.Pool({
  connectionString: process.env.TWIN_STUDIO_DATABASE_URL || process.env.DATABASE_URL,
})

try {
  const result = await runHydrologyGridExtractor({
    cityIds: [cityId],
    scenarioKey,
    sourceGridKey,
  })
  assert.equal(result.ok, true, 'HYDROLOGY_RESULT_NOT_OK')
  assert.equal(result.cities.length, 1, 'HYDROLOGY_CITY_COUNT_INVALID')
  const city = result.cities[0]
  assert(city.cellsWritten > 0, 'HYDROLOGY_NO_CELLS_WRITTEN')
  assert(city.objectObservations > 0, 'HYDROLOGY_NO_OBJECT_OBSERVATIONS')

  const checks = await pool.query(
    `
      SELECT
        (SELECT count(*)::int
         FROM ldt_environment.phenomenon_cells cells
         JOIN ldt_environment.phenomenon_layers layers ON layers.id = cells.layer_id
         WHERE cells.city_id = $1
           AND cells.scenario_key = $2
           AND layers.layer_key = $3) AS hydrology_cells,
        (SELECT count(*)::int
         FROM ldt_environment.object_observations observations
         JOIN ldt_environment.phenomenon_layers layers ON layers.id = observations.layer_id
         WHERE observations.city_id = $1
           AND observations.scenario_key = $2
           AND layers.layer_key = $3) AS object_observations,
        (SELECT count(*)::int
         FROM ldt_environment.extractor_runs
         WHERE city_id = $1
           AND scenario_key = $2
           AND extractor_key = 'hydrology-grid'
           AND status = 'completed'
           AND source_status = 'source-backed-open-data') AS completed_runs,
        (SELECT source_status
         FROM ldt_environment.phenomenon_layers
         WHERE layer_key = $3) AS layer_source_status,
        (SELECT enabled
         FROM ldt_environment.phenomenon_layers
         WHERE layer_key = $3) AS layer_enabled
    `,
    [cityId, scenarioKey, layerKey],
  )
  const row = checks.rows[0]
  assert(row.hydrology_cells > 0, 'HYDROLOGY_CELLS_MISSING')
  assert(row.object_observations > 0, 'HYDROLOGY_OBJECT_OBSERVATIONS_MISSING')
  assert(row.completed_runs > 0, 'HYDROLOGY_COMPLETED_RUN_MISSING')
  assert.equal(row.layer_source_status, 'source-backed-open-data', 'HYDROLOGY_LAYER_SOURCE_STATUS_INVALID')
  assert.equal(row.layer_enabled, true, 'HYDROLOGY_LAYER_NOT_ENABLED')

  const cells = await getLdtEnvironmentalCells(cityId, { layerKey, limit: 10 })
  assert.equal(cells.type, 'FeatureCollection', 'HYDROLOGY_CELLS_NOT_FEATURE_COLLECTION')
  assert(cells.features.length > 0, 'HYDROLOGY_CELLS_API_EMPTY')
  assert(Number.isFinite(Number(cells.features[0].properties.value)), 'HYDROLOGY_CELL_VALUE_INVALID')
  assert.equal(cells.features[0].properties.layerKey, layerKey, 'HYDROLOGY_CELL_LAYER_INVALID')

  const objectRow = await pool.query(
    `
      SELECT object_id
      FROM ldt_query.city_objects
      WHERE city_id = $1
        AND environmental_observations ? $2
      LIMIT 1
    `,
    [cityId, layerKey],
  )
  assert(objectRow.rowCount > 0, 'HYDROLOGY_QUERY_VIEW_OBSERVATION_MISSING')
  const observations = await getLdtObjectEnvironmentalObservations(cityId, {
    objectId: objectRow.rows[0].object_id,
  })
  assert(observations.ok, 'HYDROLOGY_OBJECT_LOOKUP_FAILED')
  assert(
    observations.observations.some((observation) => observation.layerKey === layerKey),
    'HYDROLOGY_OBJECT_LOOKUP_LAYER_MISSING',
  )

  console.log(JSON.stringify({
    ok: true,
    cityId,
    scenarioKey,
    sourceGridKey: city.sourceGridKey,
    cellsWritten: city.cellsWritten,
    objectObservations: city.objectObservations,
    waterEvidenceCount: city.waterEvidenceCount,
    sampledObjectId: objectRow.rows[0].object_id,
  }, null, 2))
} finally {
  await pool.end()
  await closeLdtEnvironmentalPool()
  await closeLdtHydrologyGridExtractorPool()
}
