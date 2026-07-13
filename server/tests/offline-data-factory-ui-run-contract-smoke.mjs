import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const routeSource = await readFile('server/routes/adminWorkflowRoutes.mjs', 'utf8')
const workspacePanelSource = await readFile('src/components/twin-module/workspace/panels/OperationsWorkspacePanel.jsx', 'utf8')
const operationsControlSource = await readFile('src/components/twin-module/workspace/panels/operations/useOperationsControl.js', 'utf8')
const ingestionPanelSource = await readFile('src/components/twin-module/workspace/panels/OperationsIngestionPanel.jsx', 'utf8')
const offlineDataFactorySource = await readFile('server/services/ldtOps/offlineDataFactoryService.mjs', 'utf8')

assert.match(
  routeSource,
  /\/api\/admin\/cities\/:cityId\/data-factory\/offline-runs/,
  'OFFLINE_DATA_FACTORY_DIRECT_RUN_ROUTE_MISSING',
)
assert.match(
  routeSource,
  /\/api\/admin\/cities\/:cityId\/data-factory\/offline-handoffs\/:runId\/run/,
  'OFFLINE_DATA_FACTORY_HANDOFF_RUN_ROUTE_MISSING',
)
assert.match(routeSource, /runOfflineDataFactoryJob/, 'OFFLINE_DATA_FACTORY_ROUTE_DOES_NOT_CALL_RUNNER')
assert.match(routeSource, /runnerOptions/, 'OFFLINE_DATA_FACTORY_ROUTE_OPTIONS_MISSING')
assert.match(workspacePanelSource, /useOperationsControl/, 'OPERATIONS_WORKSPACE_CONTROL_HOOK_MISSING')
assert.match(workspacePanelSource, /runOfflineDataFactoryStage/, 'OPERATIONS_WORKSPACE_STAGE_RUN_HANDLER_MISSING')
assert.match(workspacePanelSource, /runOfflineDataFactoryHandoff/, 'OPERATIONS_WORKSPACE_HANDOFF_RUN_HANDLER_MISSING')
assert.match(operationsControlSource, /executorProfile/, 'OPERATIONS_CONTROL_EXECUTOR_PROFILE_MISSING')
assert.match(operationsControlSource, /result-template/, 'OPERATIONS_CONTROL_RESULT_TEMPLATE_ENDPOINT_MISSING')
assert.match(ingestionPanelSource, /Run locally/, 'OPERATIONS_INGESTION_LOCAL_RUN_BUTTON_MISSING')
assert.match(ingestionPanelSource, /Runner profile/, 'OPERATIONS_INGESTION_RUNNER_PROFILE_MISSING')
assert.match(ingestionPanelSource, /external-worker/, 'OPERATIONS_INGESTION_EXTERNAL_RUNNER_MISSING')
assert.match(ingestionPanelSource, /Prepare dispatch/, 'OPERATIONS_INGESTION_DISPATCH_BUTTON_MISSING')
assert.match(ingestionPanelSource, /Dispatch:/, 'OPERATIONS_INGESTION_DISPATCH_STATUS_MISSING')
assert.match(ingestionPanelSource, /External run:/, 'OPERATIONS_INGESTION_EXTERNAL_RUN_STATUS_MISSING')
assert.match(ingestionPanelSource, /dispatchReturnStatus/, 'OPERATIONS_INGESTION_DISPATCH_RETURN_STATUS_MISSING')
assert.match(offlineDataFactorySource, /dispatchChecksum/, 'OFFLINE_RESULT_TEMPLATE_CHECKSUM_MISSING')
assert.match(offlineDataFactorySource, /externalRun/, 'OFFLINE_RESULT_TEMPLATE_EXTERNAL_RUN_MISSING')
assert.match(ingestionPanelSource, /execute-existing-adapters/, 'OPERATIONS_INGESTION_ENVIRONMENTAL_MODE_MISSING')
assert.match(ingestionPanelSource, /surfaceRunoff/, 'OPERATIONS_INGESTION_RUNOFF_OPTION_MISSING')

console.log(JSON.stringify({
  ok: true,
  routes: [
    '/api/admin/cities/:cityId/data-factory/offline-runs',
    '/api/admin/cities/:cityId/data-factory/offline-handoffs/:runId/run',
  ],
  uiActions: ['Create handoff', 'Run locally', 'Prepare dispatch', 'Import result'],
  runnerProfiles: ['local-process', 'external-worker'],
}, null, 2))
