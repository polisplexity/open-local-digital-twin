import assert from 'node:assert/strict'
import { getCityOperationsReport } from '../services/ldtOpsService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'

const report = await getCityOperationsReport(cityId)
assert.equal(report.ok, true, report.error || 'OPERATIONS_REPORT_NOT_OK')
assert.equal(report.cityId, cityId, 'CITY_ID_MISMATCH')

assert.equal(report.dataFactory?.key, 'data-factory', 'DATA_FACTORY_CONTRACT_MISSING')
assert.ok(Array.isArray(report.dataFactory.stages), 'DATA_FACTORY_STAGES_MISSING')
assert.ok(report.dataFactory.stages.length >= 6, 'DATA_FACTORY_STAGE_COUNT_TOO_LOW')
assert.ok(
  report.dataFactory.stages.some((stage) => stage.key === 'postgis-twin' && stage.state === 'validated'),
  'POSTGIS_TWIN_STAGE_NOT_VALIDATED',
)
assert.ok(
  report.dataFactory.stages.some((stage) => stage.key === 'viewer-artifacts'),
  'VIEWER_ARTIFACT_STAGE_MISSING',
)
assert.ok(
  report.dataFactory.stages.every((stage) => ['generated', 'validated', 'blocked', 'deferred'].includes(stage.state)),
  'DATA_FACTORY_STAGE_STATE_INVALID',
)
assert.ok(Array.isArray(report.dataFactory.executionModes), 'DATA_FACTORY_EXECUTION_MODES_MISSING')
assert.ok(
  report.dataFactory.executionModes.some((mode) => mode.key === 'offline-data-factory'),
  'OFFLINE_DATA_FACTORY_MODE_MISSING',
)
assert.ok(Array.isArray(report.dataFactory.offlineCandidateStages), 'OFFLINE_DATA_FACTORY_CANDIDATES_MISSING')
assert.ok(
  report.dataFactory.offlineCandidateStages.includes('semantic-materialization'),
  'SEMANTIC_MATERIALIZATION_NOT_OFFLINE_CANDIDATE',
)
assert.ok(
  report.dataFactory.stages.every((stage) => stage.execution?.preferredMode && Array.isArray(stage.execution.availableModes)),
  'DATA_FACTORY_STAGE_EXECUTION_POLICY_MISSING',
)
assert.ok(
  report.dataFactory.stages.every((stage) => stage.execution?.recommendedMode && stage.execution?.selectedMode && typeof stage.execution.operatorOverride === 'boolean'),
  'DATA_FACTORY_STAGE_MODE_SELECTION_MISSING',
)
assert.ok(
  report.dataFactory.stages.every((stage) => stage.execution.availableModes.includes(stage.execution.selectedMode)),
  'DATA_FACTORY_STAGE_SELECTED_MODE_INVALID',
)
assert.ok(
  report.dataFactory.stages.every((stage) => stage.stageContract?.schemaVersion === '2026-06-26.data-factory-stage-contract.v1'),
  'DATA_FACTORY_STAGE_CONTRACT_MISSING',
)
assert.ok(
  report.dataFactory.stages.every((stage) => Array.isArray(stage.stageContract.inputs) && Array.isArray(stage.stageContract.outputs)),
  'DATA_FACTORY_STAGE_IO_CONTRACT_MISSING',
)
assert.ok(
  report.dataFactory.stages.every((stage) => Array.isArray(stage.stageContract.validations) && stage.stageContract.validations.length >= 3),
  'DATA_FACTORY_STAGE_VALIDATION_CONTRACT_MISSING',
)
assert.ok(
  report.dataFactory.stages.every((stage) => Array.isArray(stage.stageContract.allowedRunnerProfiles) && stage.stageContract.allowedRunnerProfiles.length >= 1),
  'DATA_FACTORY_STAGE_RUNNER_PROFILE_CONTRACT_MISSING',
)
const stagesByKey = new Map(report.dataFactory.stages.map((stage) => [stage.key, stage]))
for (const key of ['ingestion-queue', 'environmental-extractors', 'viewer-artifacts', 'semantic-materialization']) {
  const stage = stagesByKey.get(key)
  assert.ok(stage, `DATA_FACTORY_PORTABLE_STAGE_MISSING:${key}`)
  assert.ok(stage.stageContract.allowedRunnerProfiles.includes('local-process'), `DATA_FACTORY_LOCAL_RUNNER_NOT_ALLOWED:${key}`)
  assert.ok(stage.stageContract.allowedRunnerProfiles.includes('external-worker'), `DATA_FACTORY_EXTERNAL_RUNNER_NOT_ALLOWED:${key}`)
  assert.ok(Array.isArray(stage.stageContract.artifacts), `DATA_FACTORY_ARTIFACT_CONTRACT_MISSING:${key}`)
}
assert.ok(
  ['mvt-directory', 'pmtiles', '3d-tiles'].every((artifactKind) => (
    stagesByKey.get('viewer-artifacts')?.stageContract?.artifacts ?? []
  ).some((artifact) => artifact.artifactKind === artifactKind)),
  'VIEWER_ARTIFACT_PORTABLE_CONTRACT_INCOMPLETE',
)
const apiCatalogKeys = new Set((report.apiCatalog ?? []).map((entry) => entry.key))
for (const key of [
  'data-factory-stage-mode',
  'data-factory-handoff-create',
  'data-factory-local-run',
  'data-factory-handoff-run',
  'data-factory-result-import',
]) {
  assert.ok(apiCatalogKeys.has(key), `DATA_FACTORY_API_CATALOG_MISSING:${key}`)
}

assert.equal(report.providerAssist?.key, 'provider-assist', 'PROVIDER_ASSIST_CONTRACT_MISSING')
assert.ok(Array.isArray(report.providerAssist.machineGates), 'PROVIDER_ASSIST_GATES_MISSING')
assert.ok(Array.isArray(report.providerAssist.capabilities), 'PROVIDER_ASSIST_CAPABILITIES_MISSING')
assert.ok(
  report.providerAssist.machineGates.some((gate) => gate.key === 'city-boundary-only'),
  'CITY_BOUNDARY_ONLY_GATE_MISSING',
)
assert.ok(
  report.providerAssist.machineGates.some((gate) => gate.key === 'semantic-mapping' && gate.state === 'validated'),
  'SEMANTIC_MAPPING_GATE_NOT_VALIDATED',
)
assert.ok(
  report.providerAssist.capabilities.some((capability) => capability.key === 'geojson' && capability.state === 'validated'),
  'GEOJSON_PROVIDER_ASSIST_NOT_VALIDATED',
)

console.log(JSON.stringify({
  ok: true,
  cityId,
  dataFactory: {
    summary: report.dataFactory.summary,
    executionModes: report.dataFactory.executionModes.map((mode) => mode.key),
    offlineCandidateStages: report.dataFactory.offlineCandidateStages,
    stages: report.dataFactory.stages.map((stage) => ({
      key: stage.key,
      state: stage.state,
      recommendedExecution: stage.execution.recommendedMode,
      selectedExecution: stage.execution.selectedMode,
      operatorOverride: stage.execution.operatorOverride,
      contract: {
        inputs: stage.stageContract.inputs.length,
        outputs: stage.stageContract.outputs.length,
        artifacts: stage.stageContract.artifacts.length,
        runnerProfiles: stage.stageContract.allowedRunnerProfiles,
      },
    })),
  },
  providerAssist: {
    summary: report.providerAssist.summary,
    gates: report.providerAssist.machineGates.map((gate) => ({
      key: gate.key,
      state: gate.state,
    })),
  },
}, null, 2))
