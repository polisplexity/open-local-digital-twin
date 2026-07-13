import assert from 'node:assert/strict'
import {
  activeWorkflowStorageKeys,
  createWorkflowRun,
  decideWorkflowApproval,
  getCityCapabilityState,
  getWorkflowRun,
  listAgenticWorkflowDefinitions,
  listWorkflowRuns,
  recordApiUsageEvent,
} from '../services/ldtOpsService.mjs'

const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
const cityId = cityArg ? cityArg.split('=').slice(1).join('=').trim() : 'guanajuato'

const workflows = await listAgenticWorkflowDefinitions()
assert.equal(workflows.ok, true, workflows.error || 'WORKFLOW_DEFINITIONS_NOT_OK')
const workflowKeys = workflows.workflows.map((workflow) => workflow.workflowKey).sort()
assert.deepEqual(workflowKeys, [
  'data-factory-compute-handoff',
  'eu-ldt-cip-publish-metric-source',
  'eu-ldt-cip-sync-initiatives',
  'eu-ldt-cip-sync-measurements',
  'eu-ldt-data-modeller-fixture-import',
  'eu-ldt-data-modeller-prepare-schema',
  'eu-ldt-data-space-publish',
  'eu-ldt-data-space-query-exchange',
  'eu-ldt-data-platform-import-results',
  'eu-ldt-data-platform-publish',
  'eu-ldt-marketplace-agent-publish',
  'eu-ldt-play-visualise-register-layer',
  'eu-ldt-use-case-scenarios-roundtrip',
  'external-model-enrichment',
  'open-source-city-builder',
  'standards-publication-refresh',
].sort(), 'ACTIVE_WORKFLOW_CONTRACTS_MISMATCH')
assert.ok(
  workflows.workflows.every((workflow) => workflow.storageWorkflowKey),
  'WORKFLOW_STORAGE_ALIAS_MISSING',
)
for (const inactiveKey of [
  'open-data-city-bootstrap',
  'private-provider-validation',
  'environmental-source-extractor-refresh',
  'renovation-strategy-readiness-demo',
  'vulnerability-clustering-readiness-demo',
]) {
  assert.ok(!workflowKeys.includes(inactiveKey), `INACTIVE_WORKFLOW_STILL_PUBLISHED:${inactiveKey}`)
}

const retiredCreate = await createWorkflowRun({
  workflowKey: 'open-data-city-bootstrap',
  cityId,
  input: { smoke: true },
  requestedBy: 'ldt-ops-smoke',
  requestedByKind: 'system-smoke',
  triggerKind: 'retired-workflow-guardrail',
})
assert.equal(retiredCreate.ok, false, 'RETIRED_WORKFLOW_CREATE_SHOULD_FAIL')
assert.match(retiredCreate.error, /WORKFLOW_CONTRACT_NOT_ACTIVE/, 'RETIRED_WORKFLOW_ERROR_MISMATCH')

const draftCreate = await createWorkflowRun({
  workflowKey: 'renovation-strategy-readiness-demo',
  cityId,
  input: { smoke: true },
  requestedBy: 'ldt-ops-smoke',
  requestedByKind: 'system-smoke',
  triggerKind: 'draft-workflow-guardrail',
})
assert.equal(draftCreate.ok, false, 'DRAFT_WORKFLOW_CREATE_SHOULD_FAIL')
assert.match(draftCreate.error, /WORKFLOW_CONTRACT_NOT_ACTIVE/, 'DRAFT_WORKFLOW_ERROR_MISMATCH')

const observed = await recordApiUsageEvent({
  requestId: `ldt-ops-smoke-${Date.now()}`,
  routeFamily: 'smoke',
  method: 'GET',
  pathTemplate: '/api/live/:cityId/capabilities',
  statusCode: 200,
  latencyMs: 1,
  cityId,
  actorRole: 'system-smoke',
  apiVersion: 'compat',
  metadata: {
    smoke: true,
    purpose: 'phase-10-readiness-gate',
  },
})
assert.equal(observed.ok, true, observed.error || 'API_USAGE_EVENT_RECORD_FAILED')

const capabilities = await getCityCapabilityState(cityId)
assert.equal(capabilities.ok, true, capabilities.error || 'CITY_CAPABILITIES_NOT_OK')
assert.equal(capabilities.cityId, cityId, 'CITY_ID_MISMATCH')
assert.ok(capabilities.modules.baseInventory, 'BASE_INVENTORY_CAPABILITY_MISSING')
assert.ok(capabilities.modules.catalog, 'CATALOG_CAPABILITY_MISSING')
assert.ok(capabilities.modules.provenance, 'PROVENANCE_CAPABILITY_MISSING')
assert.ok(capabilities.modules.agenticWorkflows, 'AGENTIC_WORKFLOWS_CAPABILITY_MISSING')
assert.ok(Number(capabilities.counts.entities) > 0, 'EXPECTED_CONSOLIDATED_ENTITIES')
assert.ok(Array.isArray(capabilities.readinessChecks), 'READINESS_CHECKS_MISSING')
assert.ok(capabilities.readinessChecks.length >= 8, 'READINESS_CHECKS_TOO_LOW')
assert.ok(Array.isArray(capabilities.readinessGaps), 'READINESS_GAPS_MISSING')
assert.ok(capabilities.readinessSummary?.total >= capabilities.readinessChecks.length, 'READINESS_SUMMARY_MISMATCH')
assert.ok(
  capabilities.readinessChecks.some((check) => check.key === 'api-observability' && check.status === 'ready'),
  'API_OBSERVABILITY_READY_CHECK_MISSING',
)
assert.ok(Number(capabilities.counts.apiEvents) > 0, 'API_OBSERVABILITY_EVENT_COUNT_MISSING')

const created = await createWorkflowRun({
  workflowKey: 'standards-publication-refresh',
  cityId,
  input: {
    smoke: true,
    refreshInterop: true,
    refreshViewerAggregates: true,
  },
  requestedBy: 'ldt-ops-smoke',
  requestedByKind: 'system-smoke',
  triggerKind: 'smoke-test',
})
assert.equal(created.ok, true, created.error || 'WORKFLOW_RUN_CREATE_FAILED')
assert.ok(created.run?.id, 'WORKFLOW_RUN_ID_MISSING')
assert.equal(created.run.status, 'approval_required', 'WORKFLOW_RUN_SHOULD_REQUIRE_APPROVAL')
assert.ok(created.run.steps.length >= 4, 'WORKFLOW_RUN_STEPS_MISSING')
assert.ok(created.run.approvals.length >= 2, 'WORKFLOW_RUN_APPROVALS_MISSING')

const firstApproval = created.run.approvals[0]
const approved = await decideWorkflowApproval({
  runId: created.run.id,
  approvalKey: firstApproval.approvalKey,
  decision: 'approved',
  decidedBy: 'ldt-ops-smoke',
  reason: 'Smoke test approval of first gate.',
})
assert.equal(approved.ok, true, approved.error || 'WORKFLOW_APPROVAL_DECISION_FAILED')
assert.equal(approved.approval.status, 'approved', 'WORKFLOW_APPROVAL_STATUS_MISMATCH')
assert.equal(approved.run.status, 'approval_required', 'WORKFLOW_RUN_SHOULD_WAIT_FOR_REMAINING_APPROVALS')

for (const approval of approved.run.approvals.filter((entry) => entry.status === 'requested')) {
  const next = await decideWorkflowApproval({
    runId: created.run.id,
    approvalKey: approval.approvalKey,
    decision: 'approved',
    decidedBy: 'ldt-ops-smoke',
    reason: 'Smoke test approval of remaining gate.',
  })
  assert.equal(next.ok, true, next.error || `WORKFLOW_APPROVAL_DECISION_FAILED:${approval.approvalKey}`)
}

const detailed = await getWorkflowRun(created.run.id)
assert.equal(detailed.ok, true, detailed.error || 'WORKFLOW_RUN_DETAIL_FAILED')
assert.equal(detailed.run.status, 'queued', 'WORKFLOW_RUN_SHOULD_QUEUE_AFTER_APPROVALS')

const runs = await listWorkflowRuns({ cityId, workflowKey: 'standards-publication-refresh', limit: 5 })
assert.equal(runs.ok, true, runs.error || 'WORKFLOW_RUN_LIST_FAILED')
assert.ok(runs.runs.some((run) => run.id === created.run.id), 'CREATED_WORKFLOW_RUN_NOT_LISTED')

const activeStorageKeys = activeWorkflowStorageKeys()
const defaultRuns = await listWorkflowRuns({ cityId, limit: 20 })
assert.equal(defaultRuns.ok, true, defaultRuns.error || 'DEFAULT_WORKFLOW_RUN_LIST_FAILED')
assert.ok(
  defaultRuns.runs.every((run) => activeStorageKeys.includes(run.workflowKey)),
  'DEFAULT_WORKFLOW_RUN_LIST_INCLUDED_INACTIVE_WORKFLOW',
)

const inactiveRuns = await listWorkflowRuns({ cityId, workflowKey: 'renovation-strategy-readiness-demo', limit: 5 })
assert.equal(inactiveRuns.ok, false, 'INACTIVE_WORKFLOW_RUN_LIST_SHOULD_REQUIRE_ARCHIVE_FLAG')
assert.match(inactiveRuns.error, /WORKFLOW_CONTRACT_NOT_ACTIVE/, 'INACTIVE_WORKFLOW_RUN_LIST_ERROR_MISMATCH')

const archivedInactiveRuns = await listWorkflowRuns({ cityId, workflowKey: 'renovation-strategy-readiness-demo', limit: 5, includeInactive: true })
assert.equal(archivedInactiveRuns.ok, true, archivedInactiveRuns.error || 'ARCHIVED_INACTIVE_WORKFLOW_RUN_LIST_FAILED')

console.log(JSON.stringify({
  ok: true,
  cityId,
  readiness: capabilities.readiness,
  modules: capabilities.modules,
  counts: capabilities.counts,
  readinessSummary: capabilities.readinessSummary,
  readinessGaps: capabilities.readinessGaps.map((gap) => gap.key),
  workflows: workflows.workflows.map((workflow) => workflow.workflowKey),
  workflowRun: {
    id: detailed.run.id,
    workflowKey: detailed.run.workflowKey,
    status: detailed.run.status,
    steps: detailed.run.steps.length,
    approvals: detailed.run.approvals.length,
  },
}, null, 2))
