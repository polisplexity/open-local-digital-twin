import assert from 'node:assert/strict'

import { workflowManifestFor } from '../services/ldtOps/workflowContractsService.mjs'
import { workflowStepTemplates } from '../services/ldtOps/workflowService.mjs'

const workflowKey = 'eu-ldt-use-case-scenarios-roundtrip'
const manifest = workflowManifestFor(workflowKey)
const materializedSteps = workflowStepTemplates(workflowKey).map((step) => step.stepKey)

assert.ok(manifest, 'UCS_WORKFLOW_MANIFEST_REQUIRED')
assert.deepEqual(
  materializedSteps,
  manifest.steps,
  'UCS_WORKFLOW_MANIFEST_AND_STEP_TEMPLATE_MUST_MATCH',
)
assert.ok(manifest.inputContract.optional.includes('entityBatchMode'))
assert.ok(manifest.inputContract.optional.includes('retrofitSavingsFraction'))
assert.ok(manifest.writes.includes('ldt_science.simulation_runs'))
assert.ok(manifest.writes.includes('ldt_enrichment.entity_model_outputs'))

console.log(JSON.stringify({
  ok: true,
  workflowKey,
  stepCount: materializedSteps.length,
  steps: materializedSteps,
}, null, 2))
