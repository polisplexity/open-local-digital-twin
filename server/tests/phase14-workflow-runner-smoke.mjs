import assert from 'node:assert/strict'
import {
  createWorkflowRun,
  decideWorkflowApproval,
  executePhase14WorkflowRunOnce,
  getWorkflowRun,
  listAgenticWorkflowDefinitions,
  listWorkflowRuns,
} from '../services/ldtOpsService.mjs'

const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
const cityId = cityArg ? cityArg.split('=').slice(1).join('=').trim() : 'kharkiv'
const workflowKey = 'phase14-open-data-workflow-runner'

const workflows = await listAgenticWorkflowDefinitions()
assert.equal(workflows.ok, true, workflows.error || 'WORKFLOW_DEFINITIONS_NOT_OK')
const workflow = workflows.workflows.find((entry) => entry.workflowKey === workflowKey)
assert.ok(workflow, 'PHASE14_WORKFLOW_DEFINITION_MISSING')
assert.equal(workflow.lifecycleStatus, 'current', 'PHASE14_WORKFLOW_SHOULD_BE_CURRENT')
assert.equal(workflow.domain, 'open-data-workflows', 'OPEN_DATA_WORKFLOW_DOMAIN_MISMATCH')
assert.ok(workflow.inputContract?.sourcePlanKinds?.includes('osm-local-extract'), 'OSM_SOURCE_PLAN_KIND_MISSING')
assert.ok(workflow.inputContract?.providerPostures?.includes('hybrid'), 'PROVIDER_POSTURE_CONTRACT_MISSING')
assert.ok(workflow.outputContract?.writes?.includes('ldt_environment.extractor_runs'), 'EXTRACTOR_RUN_WRITE_CONTRACT_MISSING')
assert.equal(workflow.agentPolicy?.requiresHumanApprovalForRun, true, 'RUN_APPROVAL_POLICY_MISSING')

const created = await createWorkflowRun({
  workflowKey,
  cityId,
  input: {
    smoke: true,
    sourcePlan: {
      kind: 'osm-local-extract',
      posture: 'open-data-native',
      target: 'kharkiv-repeatable-bootstrap',
    },
    providerPackages: [
      {
        layerKey: 'e2e-smoke-geojson',
        action: 'geojson',
        sourceFormat: 'geojson',
        sourceUri: 'memory://phase14-workflow-runner-smoke.geojson',
        posture: 'receive-only',
      },
    ],
    extractorKeys: ['terrain-dem', 'weather-field', 'hydrology-grid'],
    refreshViewerAggregates: true,
    validationMode: 'smoke-no-side-effects',
  },
  requestedBy: 'phase14-workflow-runner-smoke',
  requestedByKind: 'system-smoke',
  triggerKind: 'smoke-test',
})
assert.equal(created.ok, true, created.error || 'PHASE14_WORKFLOW_RUN_CREATE_FAILED')
assert.equal(created.run.status, 'approval_required', 'PHASE14_RUN_SHOULD_REQUIRE_APPROVAL')
assert.ok(created.run.steps.length >= 8, 'PHASE14_WORKFLOW_STEPS_MISSING')
assert.ok(created.run.steps.some((step) => step.stepKey === 'enqueue-open-data-bootstrap'), 'OPEN_DATA_BOOTSTRAP_STEP_MISSING')
assert.ok(created.run.steps.some((step) => step.stepKey === 'validate-provider-exchange-package'), 'PROVIDER_EXCHANGE_STEP_MISSING')
assert.ok(created.run.steps.some((step) => step.stepKey === 'register-environmental-extractor-runs'), 'EXTRACTOR_RUN_STEP_MISSING')
assert.ok(created.run.approvals.length >= 3, 'PHASE14_APPROVALS_MISSING')

let run = created.run
for (const approval of run.approvals) {
  const decision = await decideWorkflowApproval({
    runId: run.id,
    approvalKey: approval.approvalKey,
    decision: 'approved',
    decidedBy: 'phase14-workflow-runner-smoke',
    reason: `Smoke approval for ${approval.approvalKey}`,
  })
  assert.equal(decision.ok, true, decision.error || `PHASE14_APPROVAL_FAILED:${approval.approvalKey}`)
  run = decision.run
}

const queued = await getWorkflowRun(created.run.id)
assert.equal(queued.ok, true, queued.error || 'PHASE14_WORKFLOW_RUN_DETAIL_FAILED')
assert.equal(queued.run.status, 'queued', 'PHASE14_RUN_SHOULD_QUEUE_AFTER_APPROVALS')
assert.ok(queued.run.approvals.every((approval) => approval.status === 'approved'), 'PHASE14_APPROVALS_NOT_APPROVED')

const executed = await executePhase14WorkflowRunOnce({
  runId: created.run.id,
  workerId: 'phase14-workflow-runner-smoke',
})
assert.equal(executed.ok, true, executed.error || 'PHASE14_WORKFLOW_EXECUTION_FAILED')
assert.equal(executed.run.status, 'succeeded', 'PHASE14_RUN_SHOULD_SUCCEED_AFTER_EXECUTION')
assert.ok(executed.run.steps.every((step) => step.status === 'succeeded'), 'PHASE14_STEPS_SHOULD_SUCCEED')
assert.ok(executed.extractorRuns.length >= 3, 'PHASE14_EXTRACTOR_RUNS_NOT_REGISTERED')
assert.ok(executed.extractorRuns.every((entry) => entry.ok === true), 'PHASE14_EXTRACTOR_RUN_REGISTRATION_FAILED')
assert.ok(executed.artifacts.length >= 4, 'PHASE14_WORKFLOW_ARTIFACTS_NOT_WRITTEN')
assert.ok(executed.run.output?.providerJobs?.some((entry) => entry.ok && entry.jobId), 'PHASE14_PROVIDER_JOB_NOT_REGISTERED')
assert.ok(
  executed.run.output.providerJobs.every((entry) => entry.status === 'registered'),
  'PHASE14_SMOKE_PROVIDER_JOBS_SHOULD_REGISTER_ONLY',
)
const smokeSourceJobs = executed.run.output.providerJobs.filter((entry) => entry.sourceUri?.startsWith?.('memory://') || entry.sourceValidation?.sourceScheme === 'memory')
assert.ok(
  smokeSourceJobs.length >= 1 && smokeSourceJobs.every((entry) => entry.sourceValidation?.canQueue === false),
  'PHASE14_SMOKE_SOURCE_SHOULD_NOT_BE_QUEUEABLE',
)
assert.ok(
  executed.run.output.providerJobs.some((entry) => entry.action === 'mvt-cache-refresh' || entry.sourceFormat === 'viewer-cache-refresh'),
  'PHASE14_REFRESH_JOB_NOT_REGISTERED',
)
assert.ok(
  executed.artifacts.some((artifact) => artifact.artifactKind === 'provider-exchange-classification'),
  'PHASE14_PROVIDER_CLASSIFICATION_ARTIFACT_MISSING',
)
assert.ok(
  executed.artifacts.some((artifact) => artifact.artifactKind === 'post-job-refresh-plan'),
  'OPEN_DATA_REFRESH_PLAN_ARTIFACT_MISSING',
)
assert.ok(
  executed.artifacts.some((artifact) => artifact.artifactKind === 'operator-inspection-summary'),
  'OPEN_DATA_INSPECTION_ARTIFACT_MISSING',
)
assert.ok(
  Array.isArray(executed.run.output?.workerCapability?.capabilities),
  'OPEN_DATA_WORKER_CAPABILITY_OUTPUT_MISSING',
)

const detailed = await getWorkflowRun(created.run.id)
assert.equal(detailed.ok, true, detailed.error || 'PHASE14_WORKFLOW_RUN_DETAIL_FAILED_AFTER_EXECUTION')
assert.equal(detailed.run.status, 'succeeded', 'PHASE14_RUN_DETAIL_SHOULD_BE_SUCCEEDED')
assert.ok(detailed.run.artifacts.length >= 4, 'PHASE14_RUN_DETAIL_ARTIFACTS_MISSING')

const runs = await listWorkflowRuns({ cityId, workflowKey, limit: 5 })
assert.equal(runs.ok, true, runs.error || 'PHASE14_RUN_LIST_FAILED')
assert.ok(runs.runs.some((entry) => entry.id === created.run.id), 'PHASE14_RUN_NOT_LISTED')

console.log(JSON.stringify({
  ok: true,
  cityId,
  workflow: {
    workflowKey: workflow.workflowKey,
    domain: workflow.domain,
    lifecycleStatus: workflow.lifecycleStatus,
    defaultMode: workflow.defaultMode,
  },
  run: {
    id: detailed.run.id,
    status: detailed.run.status,
    steps: detailed.run.steps.map((step) => ({
      stepKey: step.stepKey,
      status: step.status,
    })),
    artifacts: detailed.run.artifacts.map((artifact) => artifact.artifactKind),
    providerJobs: executed.run.output.providerJobs.map((entry) => ({
      layerKey: entry.layerKey,
      status: entry.status,
      jobId: entry.jobId ?? null,
      sourceState: entry.sourceValidation?.sourceState ?? null,
      canQueue: entry.sourceValidation?.canQueue ?? null,
    })),
    extractorRuns: executed.extractorRuns.map((entry) => ({
      extractorKey: entry.extractorKey,
      status: entry.status,
      sourceStatus: entry.sourceStatus,
    })),
    approvals: detailed.run.approvals.map((approval) => ({
      approvalKey: approval.approvalKey,
      status: approval.status,
    })),
  },
}, null, 2))
