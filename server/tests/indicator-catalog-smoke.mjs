import assert from 'node:assert/strict'
import { createWorkflowRun, decideWorkflowApproval, executeWorkflowRunOnce } from '../services/ldtOpsService.mjs'
import { computeIndicatorObservation, listIndicatorEntityValues, syncCipIndicatorObservations, upsertIndicatorDefinition } from '../services/ldtOps/indicatorCatalogService.mjs'
import { withClient } from '../services/ldtOps/dbUtils.mjs'

const cityId = 'guanajuato'
const batch = String(process.argv.find((argument) => argument.startsWith('--batch=')) ?? '').slice('--batch='.length)
if (!batch) throw new Error('BATCH_REQUIRED')

async function approve(run) {
  let current = run
  for (const approval of current.approvals.filter((entry) => entry.status === 'requested')) {
    const decision = await decideWorkflowApproval({ runId: current.id, approvalKey: approval.approvalKey, decision: 'approved', decidedBy: 'indicator-catalog-smoke', reason: 'Controlled external result import lab.' })
    assert.equal(decision.ok, true, decision.error)
    current = decision.run
  }
  return current
}

const externalIndicator = await upsertIndicatorDefinition({
  cityId,
  indicatorKey: 'building.annual-co2e.lab',
  kind: 'indicator',
  displayName: 'Annual building CO2e (integration lab)',
  description: 'External per-building result imported from EU LDT Data Platform. Lab data only.',
  scope: 'entity',
  sourceMode: 'external',
  modelKey: 'eu-ldt-building-carbon-lab',
  outputKey: 'building.annual-co2e',
  unit: 'kgCO2e/m2/year',
  visualization: { palette: 'warm', queryable: true },
  metadata: { authority: 'external-model', lab: true },
})
assert.equal(externalIndicator.ok, true)

const importRun = await createWorkflowRun({
  workflowKey: 'eu-ldt-data-platform-import-results', cityId,
  requestedBy: 'indicator-catalog-smoke', requestedByKind: 'system-smoke', triggerKind: 'integration-smoke',
  input: { integrationProfileKey: 'local-eu-ldt-data-platform', type: 'BuildingCarbonEstimate', sourceBatchId: batch, limit: 10, modelKey: 'eu-ldt-building-carbon-lab', modelVersion: `lab-${batch}`, outputKey: 'building.annual-co2e', sourceAttribute: 'annualCo2e', unit: 'kgCO2e/m2/year' },
})
assert.equal(importRun.ok, true, importRun.error)
await approve(importRun.run)
const imported = await executeWorkflowRunOnce({ runId: importRun.run.id, workerId: 'indicator-catalog-smoke' })
assert.equal(imported.ok, true, imported.error)
assert.equal(imported.imported.length, 1)

const entityValues = await listIndicatorEntityValues({ cityId, indicatorKey: 'building.annual-co2e.lab', comparison: 'gt', value: 40, limit: 10 })
assert.equal(entityValues.values.length, 0, 'Lab values must not appear in validated entity queries.')
const labExternalObservation = await withClient(async (client) => (await client.query(`
  SELECT observation.validation_status, observation.value
  FROM ldt_science.indicator_observations observation
  JOIN ldt_science.indicator_definitions definition ON definition.id=observation.indicator_id
  WHERE observation.city_id=$1 AND definition.indicator_key='building.annual-co2e.lab'
  ORDER BY observation.updated_at DESC LIMIT 1
`, [cityId])).rows[0])
assert.equal(labExternalObservation.validation_status, 'lab')
assert.equal(Number(labExternalObservation.value), 41.7)

const cityIndicator = await upsertIndicatorDefinition({
  cityId, indicatorKey: 'city.mean-building-co2e.lab', kind: 'indicator', displayName: 'Mean annual building CO2e (integration lab)',
  description: 'Autonomous OLDT mean over the current external per-building CO2e values.', scope: 'city', sourceMode: 'autonomous', unit: 'kgCO2e/m2/year',
  formula: { operation: 'avg', sourceIndicatorKey: 'building.annual-co2e.lab' },
})
assert.equal(cityIndicator.ok, true)
await assert.rejects(
  () => computeIndicatorObservation({ cityId, indicatorKey: 'city.mean-building-co2e.lab' }),
  /INDICATOR_FORMULA_SOURCE_EMPTY/,
)

const binding = await withClient(async (client) => (await client.query(`SELECT id FROM ldt_interop.cip_metric_bindings WHERE city_id=$1 ORDER BY updated_at DESC LIMIT 1`, [cityId])).rows[0])
assert.ok(binding?.id, 'CIP_BINDING_REQUIRED')
const cipKpi = await upsertIndicatorDefinition({
  cityId, indicatorKey: 'cip.selected-objects.lab', kind: 'kpi', displayName: 'CIP selected objects KPI (integration lab)',
  description: 'CIP-maintained planning measurement; it does not overwrite building CO2e values.', scope: 'city', sourceMode: 'cip', unit: 'objects', cipBindingId: binding.id,
  target: { operator: 'gte', value: 1 },
})
assert.equal(cipKpi.ok, true)
const cipSync = await syncCipIndicatorObservations({ cityId, indicatorKey: 'cip.selected-objects.lab' })
assert.ok(cipSync.ok)

console.log(JSON.stringify({ ok: true, batch, workflowRunId: importRun.run.id, labExternalObservation, validatedEntityValueCount: entityValues.values.length, cipObservationImportCount: cipSync.importedCount }, null, 2))
