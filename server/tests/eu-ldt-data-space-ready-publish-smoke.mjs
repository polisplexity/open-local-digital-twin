import assert from 'node:assert/strict'

import {
  createWorkflowRun,
  decideWorkflowApproval,
  executeWorkflowRunOnce,
  getWorkflowRun,
  listDataSpaceAssetPackages,
  listEuLdtIntegrationProfiles,
  testEuLdtIntegrationProfile,
} from '../services/ldtOpsService.mjs'
import { withClient } from '../services/ldtOps/dbUtils.mjs'

const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
const cityId = cityArg ? cityArg.split('=').slice(1).join('=').trim() : 'guanajuato'
const providerProfileKey = process.env.EU_LDT_DATA_SPACE_PROVIDER_PROFILE ?? 'local-eu-ldt-data-space-provider'

const profiles = await listEuLdtIntegrationProfiles({ platformKind: 'data-space-ready', cityId })
assert.equal(profiles.ok, true, profiles.error || 'DATA_SPACE_PROFILES_NOT_OK')
assert.ok(profiles.profiles.some((profile) => profile.profileKey === providerProfileKey), 'DATA_SPACE_PROVIDER_PROFILE_MISSING')

const providerCheck = await testEuLdtIntegrationProfile(providerProfileKey)
assert.equal(providerCheck.result?.checks?.length, 3, 'DATA_SPACE_PROVIDER_CHECK_COUNT_MISMATCH')
assert.equal(providerCheck.profile?.status, 'validated', `DATA_SPACE_PROVIDER_NOT_VALIDATED:${providerCheck.profile?.status}`)

const created = await createWorkflowRun({
  workflowKey: 'eu-ldt-data-space-publish',
  cityId,
  input: {
    providerIntegrationProfileKey: providerProfileKey,
    title: `OLDT Guanajuato roads provider-only publication ${Date.now()}`,
    description: 'Bounded OLDT roads TwinQuery published for independent discovery, negotiation, and transfer in Data Space Ready.',
    licence: 'CC-BY-4.0',
    format: 'geojson',
    limit: 12,
    timeoutMs: 120000,
    query: {
      language: 'twinql-json',
      classes: ['roads'],
      scope: { key: 'city' },
      render: { mode: 'isolate', transport: 'geojson', maxFeatures: 12 },
      surface: 'api',
      intent: 'governed-edc-publication',
      actorUserId: 'eu-ldt-data-space-ready-publish-smoke',
      metadata: {
        source: 'eu-ldt-data-space-ready-publish-smoke',
        center: [-101.2574, 21.019],
      },
    },
  },
  requestedBy: 'eu-ldt-data-space-ready-publish-smoke',
  requestedByKind: 'system-smoke',
  triggerKind: 'provider-publication-smoke',
})
assert.equal(created.ok, true, created.error || 'DATA_SPACE_PUBLISH_WORKFLOW_CREATE_FAILED')
assert.equal(created.run.status, 'approval_required', 'DATA_SPACE_PUBLISH_WORKFLOW_SHOULD_REQUIRE_APPROVAL')
assert.equal(created.run.steps.length, 8, 'DATA_SPACE_PUBLISH_WORKFLOW_STEP_COUNT_MISMATCH')
assert.equal(created.run.approvals.length, 1, 'DATA_SPACE_PUBLISH_APPROVAL_COUNT_MISMATCH')

const approval = created.run.approvals[0]
const decision = await decideWorkflowApproval({
  runId: created.run.id,
  approvalKey: approval.approvalKey,
  decision: 'approved',
  decidedBy: 'eu-ldt-data-space-ready-publish-smoke',
  reason: 'Approve provider-only publication; consumer actions remain independent.',
})
assert.equal(decision.ok, true, decision.error || 'DATA_SPACE_PUBLISH_APPROVAL_FAILED')
assert.equal(decision.run.status, 'queued', 'DATA_SPACE_PUBLISH_WORKFLOW_NOT_QUEUED')

const executed = await executeWorkflowRunOnce({
  runId: created.run.id,
  workerId: 'eu-ldt-data-space-ready-publish-smoke',
})
assert.equal(executed.ok, true, executed.error || 'DATA_SPACE_PUBLISH_WORKFLOW_EXECUTE_FAILED')
assert.equal(executed.run?.status, 'succeeded', 'DATA_SPACE_PUBLISH_WORKFLOW_NOT_SUCCEEDED')
assert.equal(executed.summary?.publicationStatus, 'edc-published', 'DATA_SPACE_PUBLICATION_STATUS_MISMATCH')
assert.equal(executed.summary?.consumerActionRequired, true, 'DATA_SPACE_CONSUMER_ACTION_FLAG_MISSING')
assert.equal(executed.summary?.transferStarted, false, 'DATA_SPACE_PUBLISH_SHOULD_NOT_START_TRANSFER')
assert.equal(executed.summary?.rowCount, 12, 'DATA_SPACE_PUBLISH_ROW_COUNT_MISMATCH')
assert.ok(executed.summary?.assetId, 'DATA_SPACE_PUBLISH_ASSET_ID_MISSING')
assert.ok(executed.summary?.policyId, 'DATA_SPACE_PUBLISH_POLICY_ID_MISSING')
assert.ok(executed.summary?.contractDefinitionId, 'DATA_SPACE_PUBLISH_CONTRACT_ID_MISSING')
assert.ok(executed.summary?.providerDspUrl, 'DATA_SPACE_PUBLISH_DSP_URL_MISSING')
assert.ok(executed.summary?.catalogExplorerUrl, 'DATA_SPACE_PUBLISH_CATALOG_URL_MISSING')

const detail = await getWorkflowRun(created.run.id)
assert.equal(detail.ok, true, detail.error || 'DATA_SPACE_PUBLISH_WORKFLOW_DETAIL_FAILED')
assert.ok(detail.run.steps.every((step) => step.status === 'succeeded'), 'DATA_SPACE_PUBLISH_STEP_NOT_SUCCEEDED')
const requiredArtifacts = [
  'data-space-package',
  'edc-policy',
  'edc-asset',
  'edc-contract-definition',
  'data-space-publication-summary',
]
for (const artifactKind of requiredArtifacts) {
  assert.ok(detail.run.artifacts.some((artifact) => artifact.artifactKind === artifactKind), `DATA_SPACE_PUBLISH_ARTIFACT_MISSING:${artifactKind}`)
}

const persistence = await withClient(async (client) => {
  const result = await client.query(
    `
      SELECT
        package.id AS package_id,
        package.status AS package_status,
        package.byte_size AS package_byte_size,
        package.sha256 AS package_sha256,
        COUNT(receipt.id)::integer AS receipt_count
      FROM ldt_interop.data_space_asset_packages package
      LEFT JOIN ldt_interop.data_space_transfer_receipts receipt ON receipt.package_id = package.id
      WHERE package.workflow_run_id = $1
      GROUP BY package.id
    `,
    [created.run.id],
  )
  return result.rows[0]
})
assert.ok(persistence, 'DATA_SPACE_PUBLISH_PERSISTENCE_EVIDENCE_MISSING')
assert.equal(persistence.package_status, 'published', 'DATA_SPACE_PUBLISH_PACKAGE_STATUS_MISMATCH')
assert.equal(Number(persistence.receipt_count), 0, 'DATA_SPACE_PUBLISH_SHOULD_NOT_CREATE_RECEIPT')

const packages = await listDataSpaceAssetPackages({ cityId, limit: 10 })
assert.ok(packages.packages.some((entry) => entry.id === persistence.package_id), 'DATA_SPACE_PUBLISH_PACKAGE_NOT_LISTED')

console.log(JSON.stringify({
  ok: true,
  cityId,
  providerProfile: { key: providerProfileKey, status: providerCheck.profile.status },
  workflowRunId: created.run.id,
  packageId: persistence.package_id,
  assetId: executed.summary.assetId,
  policyId: executed.summary.policyId,
  contractDefinitionId: executed.summary.contractDefinitionId,
  providerDspUrl: executed.summary.providerDspUrl,
  providerParticipantId: executed.summary.providerParticipantId,
  catalogExplorerUrl: executed.summary.catalogExplorerUrl,
  rowCount: executed.summary.rowCount,
  byteSize: Number(persistence.package_byte_size),
  sha256: persistence.package_sha256,
  packageStatus: persistence.package_status,
  receiptCount: Number(persistence.receipt_count),
  artifacts: detail.run.artifacts.map((artifact) => artifact.artifactKind),
}, null, 2))
