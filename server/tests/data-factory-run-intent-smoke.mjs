import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const routeSource = await readFile('server/routes/adminWorkflowRoutes.mjs', 'utf8')
const serviceSource = await readFile('server/services/ldtOps/dataFactoryRunIntentService.mjs', 'utf8')
const serviceExports = await readFile('server/services/ldtOpsService.mjs', 'utf8')
const apiCatalog = await readFile('server/services/ldtOps/apiCatalog.mjs', 'utf8')
const operationsControl = await readFile('src/components/twin-module/workspace/panels/operations/useOperationsControl.js', 'utf8')
const dataFactoryPanel = await readFile('src/components/twin-module/workspace/panels/OperationsDataFactoryControlPanel.jsx', 'utf8')
const packageJson = JSON.parse(await readFile('package.json', 'utf8'))

assert.match(
  routeSource,
  /\/api\/admin\/cities\/:cityId\/data-factory\/runs/,
  'DATA_FACTORY_RUN_INTENT_ROUTE_MISSING',
)
assert.match(routeSource, /createDataFactoryRunIntent/, 'DATA_FACTORY_RUN_INTENT_ROUTE_NOT_WIRED')
assert.match(serviceExports, /createDataFactoryRunIntent/, 'DATA_FACTORY_RUN_INTENT_EXPORT_MISSING')

for (const required of [
  'createRegisteredCityInputPackage',
  'latestCityInputPackage',
  'runOfflineDataFactoryJob',
  'server-to-server-pull',
  'same-server-sidecar',
  'hpc-batch',
  'cloud-batch',
  'workerCommandHints',
  'city-boundary-quality-gate',
  'requireBoundaryGatePassed',
  'requireProcessingNodePreflight',
  'stageInputScope',
  'inputScope',
  'DATA_FACTORY_TOKEN',
  'restore-city-input',
  'upload-artifact-bundle',
  'no-activate',
]) {
  assert.match(serviceSource, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `DATA_FACTORY_RUN_INTENT_CONTRACT_MISSING:${required}`)
}

assert.match(apiCatalog, /data-factory-run-intent/, 'DATA_FACTORY_RUN_INTENT_API_CATALOG_MISSING')
assert.match(operationsControl, /prepareDataFactoryProviderRun/, 'DATA_FACTORY_RUN_INTENT_UI_HOOK_MISSING')
assert.match(operationsControl, /\/data-factory\/runs/, 'DATA_FACTORY_RUN_INTENT_UI_ENDPOINT_MISSING')
assert.match(dataFactoryPanel, /Prepare provider run/, 'DATA_FACTORY_RUN_INTENT_UI_ACTION_MISSING')

assert.equal(
  packageJson.scripts['test:data-factory-run-intent-smoke'],
  'node server/tests/data-factory-run-intent-smoke.mjs',
  'DATA_FACTORY_RUN_INTENT_SMOKE_SCRIPT_MISSING',
)

console.log(JSON.stringify({
  ok: true,
  route: '/api/admin/cities/:cityId/data-factory/runs',
  contract: '2026-06-28.data-factory-run-intent.v1',
  productFlow: [
    'city input package',
    'processing node/provider',
    'external dispatch',
    'worker command hints',
    'artifact transfer policy',
    'promotion policy',
  ],
}, null, 2))
