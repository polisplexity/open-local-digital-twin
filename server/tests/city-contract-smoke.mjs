import { spawnSync } from 'node:child_process'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
const fullSemanticMaterialization = process.argv.includes('--full-semantic-materialization')
const semanticMaterializationArgs = fullSemanticMaterialization ? [] : ['--limit-per-type=1000']

const requiredCityTests = [
  ['city-source-plan', 'server/tests/city-source-plan-smoke.mjs', [`--city=${cityId}`]],
  ['query-library-boundary', 'server/tests/query-library-boundary-smoke.mjs', [`--city=${cityId}`]],
  ['ldt-ops', 'server/tests/ldt-ops-smoke.mjs', [`--city=${cityId}`]],
  ['data-factory-contract', 'server/tests/data-factory-contract-smoke.mjs', [`--city=${cityId}`]],
  ['data-factory-execution-mode', 'server/tests/data-factory-execution-mode-smoke.mjs', [`--city=${cityId}`]],
  ['offline-data-factory-handoff', 'server/tests/offline-data-factory-handoff-smoke.mjs', [`--city=${cityId}`]],
  ['offline-data-factory-result', 'server/tests/offline-data-factory-result-smoke.mjs', [`--city=${cityId}`]],
  ['offline-data-factory-semantic-promotion', 'server/tests/offline-data-factory-semantic-promotion-smoke.mjs', [`--city=${cityId}`]],
  ['offline-data-factory-external-dispatch', 'server/tests/offline-data-factory-external-dispatch-smoke.mjs', [`--city=${cityId}`]],
  ['offline-data-factory-external-result', 'server/tests/offline-data-factory-external-result-smoke.mjs', [`--city=${cityId}`]],
  ['offline-data-factory-external-runner', 'server/tests/offline-data-factory-external-runner-smoke.mjs', [`--city=${cityId}`]],
  ['offline-data-factory-ingestion-queue-runner', 'server/tests/offline-data-factory-ingestion-queue-runner-smoke.mjs', [`--city=${cityId}`]],
  ['offline-data-factory-environmental-extractors-runner', 'server/tests/offline-data-factory-environmental-extractors-runner-smoke.mjs', [`--city=${cityId}`]],
  ['offline-data-factory-runner', 'server/tests/offline-data-factory-runner-smoke.mjs', [`--city=${cityId}`, ...semanticMaterializationArgs]],
  ['offline-data-factory-viewer-artifacts-runner', 'server/tests/offline-data-factory-viewer-artifacts-runner-smoke.mjs', [`--city=${cityId}`]],
  ['entity-semantic-tags', 'server/tests/entity-semantic-tags-smoke.mjs', [`--city=${cityId}`, ...semanticMaterializationArgs]],
  ['semantic-context-api', 'server/tests/semantic-context-api-smoke.mjs', [`--city=${cityId}`]],
  ['semantic-query', 'server/tests/semantic-query-smoke.mjs', [`--city=${cityId}`]],
  ['semantic-pack-reconstruction', 'server/tests/ldt-semantic-packs-smoke.mjs', [`--city=${cityId}`, '--pack=reconstruction-service-core']],
  ['semantic-pack-planning-compliance', 'server/tests/ldt-semantic-packs-smoke.mjs', [`--city=${cityId}`, '--pack=municipal-planning-compliance-pack']],
  ['semantic-pack-urban-risk', 'server/tests/ldt-semantic-packs-smoke.mjs', [`--city=${cityId}`, '--pack=urban-risk-preparedness-pack']],
  ['semantic-vocabulary-adapter', 'server/tests/semantic-vocabulary-adapter-smoke.mjs', []],
  ['twin-query', 'server/tests/twin-query-smoke.mjs', [`--city=${cityId}`]],
  ['twin-query-export', 'server/tests/twin-query-export-smoke.mjs', [`--city=${cityId}`]],
  ['twin-query-mvt', 'server/tests/twin-query-mvt-smoke.mjs', [`--city=${cityId}`]],
  ['analysis-selection-lab', 'server/tests/analysis-selection-lab-smoke.mjs', [`--city=${cityId}`]],
  ['selection-share', 'server/tests/selection-share-smoke.mjs', [`--city=${cityId}`]],
  ['city-3d-tiles', 'server/tests/city-3d-tiles-smoke.mjs', [`--city=${cityId}`]],
  ['viewer-artifact-registry', 'server/tests/viewer-artifact-registry-smoke.mjs', [`--city=${cityId}`]],
]

const invariantTests = [
  ['semantic-pack-definition-contract', 'server/tests/semantic-pack-definition-contract-smoke.mjs', []],
  ['semantic-pack-catalog', 'server/tests/semantic-pack-catalog-smoke.mjs', []],
  ['environmental-extractor-city-required', 'server/tests/environmental-extractor-city-required-smoke.mjs', []],
  ['offline-data-factory-ui-run-contract', 'server/tests/offline-data-factory-ui-run-contract-smoke.mjs', []],
  ['civic-xr-ray-side-effect', 'server/tests/civic-xr-ray-side-effect-smoke.mjs', []],
  ['phase14-boundary-quality-gate', 'server/tests/phase14-boundary-quality-gate-smoke.mjs', []],
]

const optionalCityTests = cityId === 'guanajuato'
  ? [['phase14-guanajuato-bootstrap', 'server/tests/phase14-guanajuato-bootstrap-smoke.mjs', []]]
  : []

function runSmoke([name, file, args]) {
  const startedAt = Date.now()
  const result = spawnSync(process.execPath, [file, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TWIN_STUDIO_E2E_CITY_ID: cityId,
      TWIN_STUDIO_SMOKE_CITY_ID: cityId,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const durationMs = Date.now() - startedAt
  if (result.stdout) process.stdout.write(result.stdout.endsWith('\n') ? result.stdout : `${result.stdout}\n`)
  if (result.stderr) process.stderr.write(result.stderr.endsWith('\n') ? result.stderr : `${result.stderr}\n`)
  return {
    name,
    file,
    ok: result.status === 0,
    status: result.status,
    durationMs,
  }
}

const tests = [
  ...requiredCityTests,
  ...invariantTests,
  ...optionalCityTests,
]
const results = tests.map(runSmoke)
const failed = results.filter((result) => !result.ok)

console.log(JSON.stringify({
  ok: failed.length === 0,
  cityId,
  semanticMaterializationMode: fullSemanticMaterialization ? 'full-city' : 'bounded-1000-per-entity-type',
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
}, null, 2))

if (failed.length) process.exit(1)
