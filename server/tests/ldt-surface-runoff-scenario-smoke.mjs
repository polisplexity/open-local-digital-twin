import assert from 'node:assert/strict'
import pg from 'pg'

import {
  closeLdtSurfaceRunoffScenarioPool,
  runSurfaceRunoffScenario,
} from '../services/ldtSurfaceRunoffScenarioService.mjs'
import {
  closeLdtEnvironmentalPool,
  getLdtEnvironmentalCells,
  getLdtObjectEnvironmentalObservations,
} from '../services/ldtEnvironmentalService.mjs'
import { runCityTwinQuery } from '../db/productionTwinStore.mjs'
import { closeProductionPool } from '../db/postgisPool.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

const cityId = argValue('city') || 'kharkiv'
const scenarioKey = argValue('scenario') || 'baseline'
const sourceGridKey = argValue('source-grid-key') || undefined
const rainfallMm = argValue('rainfall-mm') || undefined
const durationHours = argValue('duration-hours') || undefined
const layerKey = 'surface_runoff_screening'

const pool = new pg.Pool({
  connectionString: process.env.TWIN_STUDIO_DATABASE_URL || process.env.DATABASE_URL,
})

try {
  const result = await runSurfaceRunoffScenario({
    cityIds: [cityId],
    scenarioKey,
    sourceGridKey,
    rainfallMm,
    durationHours,
  })
  assert.equal(result.ok, true, 'RUNOFF_RESULT_NOT_OK')
  assert.equal(result.cities.length, 1, 'RUNOFF_CITY_COUNT_INVALID')
  const city = result.cities[0]
  assert(city.cellsWritten > 0, 'RUNOFF_NO_CELLS_WRITTEN')
  assert(city.objectObservations > 0, 'RUNOFF_NO_OBJECT_OBSERVATIONS')
  assert(city.objectSummaries > 0, 'RUNOFF_NO_OBJECT_SUMMARIES')

  const checks = await pool.query(
    `
      SELECT
        (SELECT count(*)::int
         FROM ldt_environment.phenomenon_cells cells
         JOIN ldt_environment.phenomenon_layers layers ON layers.id = cells.layer_id
         WHERE cells.city_id = $1
           AND cells.scenario_key = $2
           AND layers.layer_key = $3) AS runoff_cells,
        (SELECT count(*)::int
         FROM ldt_environment.object_observations observations
         JOIN ldt_environment.phenomenon_layers layers ON layers.id = observations.layer_id
         WHERE observations.city_id = $1
           AND observations.scenario_key = $2
           AND layers.layer_key = $3) AS object_observations,
        (SELECT count(*)::int
         FROM ldt_science.simulation_runs runs
         JOIN ldt_science.simulation_models models ON models.id = runs.model_id
         WHERE runs.city_id = $1
           AND runs.scenario_key = $2
           AND models.model_key = 'surface-runoff-screening-v0'
           AND runs.status = 'completed') AS completed_runs,
        (SELECT count(*)::int
         FROM ldt_science.scenario_outputs outputs
         JOIN ldt_science.scenario_definitions definitions ON definitions.id = outputs.scenario_definition_id
         WHERE outputs.city_id = $1
           AND definitions.scenario_key = 'surface-runoff-screening') AS scenario_outputs,
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
  assert(row.runoff_cells > 0, 'RUNOFF_CELLS_MISSING')
  assert(row.object_observations > 0, 'RUNOFF_OBJECT_OBSERVATIONS_MISSING')
  assert(row.completed_runs > 0, 'RUNOFF_COMPLETED_RUN_MISSING')
  assert(row.scenario_outputs > 0, 'RUNOFF_SCENARIO_OUTPUT_MISSING')
  assert.equal(row.layer_source_status, 'source-backed-open-data', 'RUNOFF_LAYER_SOURCE_STATUS_INVALID')
  assert.equal(row.layer_enabled, true, 'RUNOFF_LAYER_NOT_ENABLED')

  const cells = await getLdtEnvironmentalCells(cityId, { layerKey, limit: 10 })
  assert.equal(cells.type, 'FeatureCollection', 'RUNOFF_CELLS_NOT_FEATURE_COLLECTION')
  assert(cells.features.length > 0, 'RUNOFF_CELLS_API_EMPTY')
  assert(Number.isFinite(Number(cells.features[0].properties.value)), 'RUNOFF_CELL_VALUE_INVALID')
  assert.equal(cells.features[0].properties.layerKey, layerKey, 'RUNOFF_CELL_LAYER_INVALID')

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
  assert(objectRow.rowCount > 0, 'RUNOFF_QUERY_VIEW_OBSERVATION_MISSING')

  const observations = await getLdtObjectEnvironmentalObservations(cityId, {
    objectId: objectRow.rows[0].object_id,
  })
  assert(observations.ok, 'RUNOFF_OBJECT_LOOKUP_FAILED')
  assert(
    observations.observations.some((observation) => observation.layerKey === layerKey),
    'RUNOFF_OBJECT_LOOKUP_LAYER_MISSING',
  )

  const query = await runCityTwinQuery(cityId, {
    query: {
      language: 'twinql-json',
      classes: ['buildings'],
      conditions: [
        {
          field: 'surface_runoff_screening',
          operator: 'gte',
          value: 0,
        },
      ],
      render: {
        mode: 'table',
        maxFeatures: 25,
      },
    },
    actorUserId: 'surface-runoff-smoke',
    intent: 'surface-runoff-smoke',
    surface: 'smoke',
  })
  assert(Number(query.summary?.returned ?? 0) > 0, 'RUNOFF_TWIN_QUERY_EMPTY')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    scenarioKey,
    sourceGridKey: city.sourceGridKey,
    rainfallMm: city.rainfallMm,
    durationHours: city.durationHours,
    cellsWritten: city.cellsWritten,
    objectObservations: city.objectObservations,
    objectSummaries: city.objectSummaries,
    sampledObjectId: objectRow.rows[0].object_id,
    queryReturned: Number(query.summary?.returned ?? 0),
  }, null, 2))
} finally {
  await pool.end()
  await closeLdtEnvironmentalPool()
  await closeProductionPool()
  await closeLdtSurfaceRunoffScenarioPool()
}
