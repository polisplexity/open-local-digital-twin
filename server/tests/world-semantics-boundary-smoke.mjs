import assert from 'node:assert/strict'

import { persistAnalysisSelection } from '../db/productionTwinStore/analysisSelectionRepository.mjs'
import { listCityTwinQueryObjectRows } from '../db/productionTwinStore/twinQueryRepository.mjs'
import { withClient } from '../services/ldtOps/dbUtils.mjs'
import { getCitySelectionSnapshotGeojson } from '../services/worldComparisonService.mjs'

const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
const cityId = cityArg ? cityArg.split('=').slice(1).join('=').trim() : 'guanajuato'

const boundary = await withClient(async (client) => {
  const result = await client.query(`
    SELECT
      (SELECT count(*)::integer
       FROM ldt_enrichment.entity_model_outputs
       WHERE city_id = $1 AND simulation_run_id IS NOT NULL) AS simulation_output_count,
      (SELECT count(*)::integer
       FROM ldt_enrichment.entity_model_output_current
       WHERE city_id = $1 AND simulation_run_id IS NOT NULL) AS current_simulation_output_count,
      (
        SELECT count(DISTINCT city_object.id)::integer
        FROM ldt_query.city_objects_enriched city_object
        CROSS JOIN LATERAL jsonb_each(city_object.model_enrichments) model
        CROSS JOIN LATERAL jsonb_each(model.value) output
        WHERE city_object.city_id = $1
          AND NULLIF(output.value->>'simulationRunId', '') IS NOT NULL
      ) AS current_entities_with_simulation,
      (SELECT count(*)::integer
       FROM ldt_core.city_entities
       WHERE city_id = $1) AS canonical_entity_count,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'ldt_analysis'
          AND table_name = 'selection_set_members'
          AND column_name = 'geometry_snapshot'
      ) AS geometry_snapshot_column
  `, [cityId])
  return result.rows[0]
})

assert.ok(Number(boundary.simulation_output_count) > 0, 'WORLD_BOUNDARY_SIMULATION_FIXTURE_REQUIRED')
assert.equal(Number(boundary.current_simulation_output_count), 0, 'WORLD_BOUNDARY_CURRENT_VIEW_LEAK')
assert.equal(Number(boundary.current_entities_with_simulation), 0, 'WORLD_BOUNDARY_ENRICHED_READ_MODEL_LEAK')
assert.equal(boundary.geometry_snapshot_column, true, 'WORLD_BOUNDARY_GEOMETRY_SNAPSHOT_COLUMN_REQUIRED')

const selectionRows = await listCityTwinQueryObjectRows(cityId, {
  classes: ['buildings'],
  scope: { key: 'city' },
  render: { mode: 'isolate', transport: 'metadata', maxFeatures: 2 },
}, { limit: 2 })

assert.equal(selectionRows.ok, true, selectionRows.error || 'WORLD_BOUNDARY_SELECTION_QUERY_FAILED')
assert.equal(selectionRows.rows.length, 2, 'WORLD_BOUNDARY_TWO_SELECTION_ROWS_REQUIRED')
assert.ok(selectionRows.rows.every((row) => row.geometrySnapshot?.type), 'WORLD_BOUNDARY_SELECTION_GEOMETRY_NOT_CAPTURED')

const persisted = await persistAnalysisSelection(cityId, {
  title: `World semantics snapshot smoke ${Date.now()}`,
  selectionKind: 'twinql-selection',
  createdBy: 'world-semantics-boundary-smoke',
  query: selectionRows.query,
  summary: selectionRows.summary,
  rows: selectionRows.rows,
})

assert.equal(persisted.ok, true, persisted.error || 'WORLD_BOUNDARY_SELECTION_PERSIST_FAILED')

try {
  const snapshot = await getCitySelectionSnapshotGeojson(cityId, persisted.selection.id)
  assert.equal(snapshot.ok, true, snapshot.error || 'WORLD_BOUNDARY_SNAPSHOT_READ_FAILED')
  assert.equal(snapshot.summary.geometrySnapshotComplete, true, 'WORLD_BOUNDARY_SNAPSHOT_GEOMETRY_INCOMPLETE')
  assert.equal(snapshot.summary.geometrySnapshotCount, 2, 'WORLD_BOUNDARY_SNAPSHOT_GEOMETRY_COUNT_INVALID')
  assert.ok(snapshot.geojson.features.every((feature) => feature.properties.geometrySnapshotStatus === 'captured'))
} finally {
  await withClient((client) => client.query(
    'DELETE FROM ldt_analysis.selection_sets WHERE city_id = $1 AND id = $2::uuid',
    [cityId, persisted.selection.id],
  ))
}

console.log(JSON.stringify({
  ok: true,
  cityId,
  simulationOutputsPreserved: Number(boundary.simulation_output_count),
  simulationOutputsInCurrentReality: Number(boundary.current_simulation_output_count),
  currentEntitiesWithSimulation: Number(boundary.current_entities_with_simulation),
  canonicalEntityCount: Number(boundary.canonical_entity_count),
  historicalSnapshotGeometry: 'captured',
}, null, 2))
