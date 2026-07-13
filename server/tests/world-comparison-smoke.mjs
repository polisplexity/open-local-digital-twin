import assert from 'node:assert/strict'

import {
  getCitySelectionSnapshotGeojson,
  getCitySimulationWorldGeojson,
  listCitySimulationWorlds,
} from '../services/worldComparisonService.mjs'

const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
const cityId = cityArg ? cityArg.split('=').slice(1).join('=').trim() : 'guanajuato'
const selectionSetId = process.env.WORLD_COMPARISON_SELECTION_SET_ID ?? '60120d5c-225a-41bf-8a92-082b9d37ded8'

const inventory = await listCitySimulationWorlds(cityId, {
  modelKey: 'oldt-urban-energy-scenario',
  limit: 10,
})
assert.equal(inventory.ok, true, inventory.error || 'SIMULATION_WORLD_INVENTORY_FAILED')

const workflowGroups = new Map()
inventory.worlds.forEach((world) => {
  if (!world.workflowRunId) return
  const current = workflowGroups.get(world.workflowRunId) ?? []
  current.push(world)
  workflowGroups.set(world.workflowRunId, current)
})
const pair = Array.from(workflowGroups.values()).find((worlds) => (
  worlds.some((world) => world.scenarioKind === 'baseline')
  && worlds.some((world) => world.scenarioKind === 'intervention')
))
assert.ok(pair, 'SIMULATION_WORLD_BASELINE_INTERVENTION_PAIR_REQUIRED')

const baseline = pair.find((world) => world.scenarioKind === 'baseline')
const intervention = pair.find((world) => world.scenarioKind === 'intervention')
const [baselineWorld, interventionWorld, snapshot] = await Promise.all([
  getCitySimulationWorldGeojson(cityId, baseline.id),
  getCitySimulationWorldGeojson(cityId, intervention.id),
  getCitySelectionSnapshotGeojson(cityId, selectionSetId),
])

for (const result of [baselineWorld, interventionWorld, snapshot]) {
  assert.equal(result.ok, true, result.error || 'WORLD_GEOJSON_FAILED')
  assert.equal(result.geojson.type, 'FeatureCollection')
  assert.equal(result.geojson.features.length, 300)
}

assert.equal(baselineWorld.summary.outputKeys.length, 7)
assert.equal(interventionWorld.summary.outputKeys.length, 7)
assert.equal(baselineWorld.summary.authorityStatus, 'simulated')
assert.equal(interventionWorld.summary.authorityStatus, 'simulated')
assert.equal(snapshot.summary.worldKind, 'selection-snapshot')
assert.ok(Date.parse(baselineWorld.summary.generatedAt))
assert.ok(Date.parse(interventionWorld.summary.generatedAt))
assert.ok(Date.parse(snapshot.summary.snapshotAt))

const ids = (result) => result.geojson.features.map((feature) => String(feature.id)).sort()
assert.deepEqual(ids(baselineWorld), ids(interventionWorld), 'SIMULATION_WORLD_ENTITY_IDS_DIFFER')
assert.deepEqual(ids(baselineWorld), ids(snapshot), 'SIMULATION_AND_SELECTION_ENTITY_IDS_DIFFER')

const baselineEnergy = baselineWorld.geojson.features.reduce(
  (sum, feature) => sum + Number(feature.properties.simulated_energy_kwh || 0),
  0,
)
const interventionEnergy = interventionWorld.geojson.features.reduce(
  (sum, feature) => sum + Number(feature.properties.simulated_energy_kwh || 0),
  0,
)
assert.ok(interventionEnergy < baselineEnergy, 'SIMULATION_WORLD_INTERVENTION_NOT_LOWER')

console.log(JSON.stringify({
  ok: true,
  cityId,
  workflowRunId: baseline.workflowRunId,
  worlds: [
    {
      id: baseline.id,
      scenarioKind: baseline.scenarioKind,
      generatedAt: baseline.generatedAt,
      entities: baselineWorld.geojson.features.length,
      outputKeys: baselineWorld.summary.outputKeys,
      simulatedEnergyKwh: Number(baselineEnergy.toFixed(6)),
    },
    {
      id: intervention.id,
      scenarioKind: intervention.scenarioKind,
      generatedAt: intervention.generatedAt,
      entities: interventionWorld.geojson.features.length,
      outputKeys: interventionWorld.summary.outputKeys,
      simulatedEnergyKwh: Number(interventionEnergy.toFixed(6)),
    },
  ],
  snapshot: {
    id: snapshot.selection.id,
    snapshotAt: snapshot.summary.snapshotAt,
    entities: snapshot.geojson.features.length,
  },
}, null, 2))
