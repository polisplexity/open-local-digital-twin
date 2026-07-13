import assert from 'node:assert/strict'

import {
  createWorkflowRun,
  decideWorkflowApproval,
  executeWorkflowRunOnce,
  getWorkflowRun,
  listEuLdtIntegrationProfiles,
} from '../services/ldtOpsService.mjs'

const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
const cityId = cityArg ? cityArg.split('=').slice(1).join('=').trim() : 'guanajuato'

const profiles = await listEuLdtIntegrationProfiles({ platformKind: 'marketplace-agent' })
assert.equal(profiles.ok, true, profiles.error || 'MARKETPLACE_PROFILES_NOT_OK')
assert.ok(
  profiles.profiles.some((profile) => profile.profileKey === 'local-eu-ldt-marketplace-agent'),
  'LOCAL_MARKETPLACE_AGENT_PROFILE_MISSING',
)

const created = await createWorkflowRun({
  workflowKey: 'eu-ldt-marketplace-agent-publish',
  cityId,
  input: {
    dryRun: true,
    publishToHub: true,
    integrationProfileKeys: ['local-eu-ldt-marketplace-agent'],
    assetType: 'oldt.semantic-layer',
    title: 'OLDT Marketplace smoke semantic layer',
    description: 'Dry-run OLDT package used to verify Marketplace Agent workflow contracts.',
    licence: 'CC-BY-4.0',
    categories: ['iot-data'],
    compatibilityTargets: ['oldt', 'data-platform', 'play-visualise'],
    payload: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'marketplace-smoke-1',
          properties: {
            name: 'Marketplace smoke feature',
            semanticClass: 'SmokeTest',
          },
          geometry: {
            type: 'Point',
            coordinates: [-101.2574, 21.019],
          },
        },
      ],
    },
  },
  requestedBy: 'eu-ldt-marketplace-agent-publish-smoke',
  requestedByKind: 'system-smoke',
  triggerKind: 'smoke-test',
})
assert.equal(created.ok, true, created.error || 'MARKETPLACE_WORKFLOW_CREATE_FAILED')
assert.equal(created.run.status, 'approval_required', 'MARKETPLACE_WORKFLOW_SHOULD_REQUIRE_APPROVAL')
assert.ok(
  created.run.steps.some((step) => step.stepKey === 'upload-marketplace-agent-assets'),
  'MARKETPLACE_UPLOAD_STEP_MISSING',
)

for (const approval of created.run.approvals) {
  const decided = await decideWorkflowApproval({
    runId: created.run.id,
    approvalKey: approval.approvalKey,
    decision: 'approved',
    decidedBy: 'eu-ldt-marketplace-agent-publish-smoke',
    reason: 'Smoke test approval for dry-run Marketplace publication.',
  })
  assert.equal(decided.ok, true, decided.error || `MARKETPLACE_APPROVAL_FAILED:${approval.approvalKey}`)
}

const executed = await executeWorkflowRunOnce({
  runId: created.run.id,
  workerId: 'eu-ldt-marketplace-agent-publish-smoke',
})
assert.equal(executed.ok, true, executed.error || 'MARKETPLACE_WORKFLOW_EXECUTE_FAILED')
assert.equal(executed.summary?.dryRun, true, 'MARKETPLACE_DRY_RUN_SUMMARY_MISSING')
assert.equal(executed.summary?.uploadedCount, 1, 'MARKETPLACE_DRY_RUN_UPLOAD_COUNT_MISMATCH')
assert.equal(executed.summary?.publishedCount, 1, 'MARKETPLACE_DRY_RUN_PUBLISH_COUNT_MISMATCH')
assert.equal(executed.summary?.package?.packageType, 'oldt.semantic-layer', 'MARKETPLACE_PACKAGE_TYPE_MISMATCH')
assert.ok(executed.summary?.package?.sha256, 'MARKETPLACE_PACKAGE_CHECKSUM_MISSING')

const detail = await getWorkflowRun(created.run.id)
assert.equal(detail.ok, true, detail.error || 'MARKETPLACE_WORKFLOW_DETAIL_FAILED')
assert.equal(detail.run.status, 'succeeded', 'MARKETPLACE_WORKFLOW_STATUS_MISMATCH')
assert.ok(
  detail.run.artifacts.some((artifact) => artifact.artifactKind === 'marketplace-publication-summary'),
  'MARKETPLACE_SUMMARY_ARTIFACT_MISSING',
)

console.log(JSON.stringify({
  ok: true,
  cityId,
  runId: detail.run.id,
  status: detail.run.status,
  summary: executed.summary,
  artifacts: detail.run.artifacts.map((artifact) => artifact.artifactKind),
}, null, 2))
