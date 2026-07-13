import assert from 'node:assert/strict'

import {
  createWorkflowRun,
  decideWorkflowApproval,
  executeWorkflowRunOnce,
  getCityCapabilityState,
  getWorkflowRun,
  listDataSpaceAssetPackages,
  listEuLdtIntegrationProfiles,
  testEuLdtIntegrationProfile,
} from '../services/ldtOpsService.mjs'
import { withClient } from '../services/ldtOps/dbUtils.mjs'

const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
const cityId = cityArg ? cityArg.split('=').slice(1).join('=').trim() : 'guanajuato'
const providerProfileKey = process.env.EU_LDT_DATA_SPACE_PROVIDER_PROFILE ?? 'local-eu-ldt-data-space-provider'
const consumerProfileKey = process.env.EU_LDT_DATA_SPACE_CONSUMER_PROFILE ?? 'local-eu-ldt-data-space-consumer'

const profiles = await listEuLdtIntegrationProfiles({ platformKind: 'data-space-ready', cityId })
assert.equal(profiles.ok, true, profiles.error || 'DATA_SPACE_PROFILES_NOT_OK')
assert.ok(profiles.profiles.some((profile) => profile.profileKey === providerProfileKey), 'DATA_SPACE_PROVIDER_PROFILE_MISSING')
assert.ok(profiles.profiles.some((profile) => profile.profileKey === consumerProfileKey), 'DATA_SPACE_CONSUMER_PROFILE_MISSING')

const providerCheck = await testEuLdtIntegrationProfile(providerProfileKey)
const consumerCheck = await testEuLdtIntegrationProfile(consumerProfileKey)
assert.equal(providerCheck.result?.checks?.length, 3, 'DATA_SPACE_PROVIDER_CHECK_COUNT_MISMATCH')
assert.equal(consumerCheck.result?.checks?.length, 3, 'DATA_SPACE_CONSUMER_CHECK_COUNT_MISMATCH')
assert.equal(providerCheck.profile?.status, 'validated', `DATA_SPACE_PROVIDER_NOT_VALIDATED:${providerCheck.profile?.status}`)
assert.equal(consumerCheck.profile?.status, 'validated', `DATA_SPACE_CONSUMER_NOT_VALIDATED:${consumerCheck.profile?.status}`)

const created = await createWorkflowRun({
  workflowKey: 'eu-ldt-data-space-query-exchange',
  cityId,
  input: {
    providerIntegrationProfileKey: providerProfileKey,
    consumerIntegrationProfileKey: consumerProfileKey,
    title: `OLDT Guanajuato roads EDC exchange ${Date.now()}`,
    description: 'Bounded OLDT roads TwinQuery used to prove provider publication, consumer negotiation, transfer, and checksum receipt.',
    licence: 'CC-BY-4.0',
    format: 'geojson',
    limit: 25,
    timeoutMs: 120000,
    query: {
      language: 'twinql-json',
      classes: ['roads'],
      scope: { key: 'city' },
      render: { mode: 'isolate', transport: 'geojson', maxFeatures: 25 },
      surface: 'api',
      intent: 'governed-edc-export',
      actorUserId: 'eu-ldt-data-space-ready-smoke',
      metadata: {
        source: 'eu-ldt-data-space-ready-exchange-smoke',
        center: [-101.2574, 21.019],
      },
    },
  },
  requestedBy: 'eu-ldt-data-space-ready-smoke',
  requestedByKind: 'system-smoke',
  triggerKind: 'integration-smoke',
})
assert.equal(created.ok, true, created.error || 'DATA_SPACE_WORKFLOW_CREATE_FAILED')
assert.equal(created.run.status, 'approval_required', 'DATA_SPACE_WORKFLOW_SHOULD_REQUIRE_APPROVAL')
assert.equal(created.run.steps.length, 12, 'DATA_SPACE_WORKFLOW_STEP_COUNT_MISMATCH')

let approvedRun = created.run
for (const approval of approvedRun.approvals.filter((entry) => entry.status === 'requested')) {
  const decision = await decideWorkflowApproval({
    runId: approvedRun.id,
    approvalKey: approval.approvalKey,
    decision: 'approved',
    decidedBy: 'eu-ldt-data-space-ready-smoke',
    reason: 'Approve real EDC provider-to-consumer transfer and checksum verification.',
  })
  assert.equal(decision.ok, true, decision.error || `DATA_SPACE_APPROVAL_FAILED:${approval.approvalKey}`)
  approvedRun = decision.run
}
assert.equal(approvedRun.status, 'queued', 'DATA_SPACE_WORKFLOW_NOT_QUEUED')

const executed = await executeWorkflowRunOnce({
  runId: approvedRun.id,
  workerId: 'eu-ldt-data-space-ready-smoke',
})
assert.equal(executed.ok, true, executed.error || 'DATA_SPACE_WORKFLOW_EXECUTE_FAILED')
assert.equal(executed.run?.status, 'succeeded', 'DATA_SPACE_WORKFLOW_NOT_SUCCEEDED')
assert.equal(executed.summary?.transferState, 'COMPLETED', 'DATA_SPACE_TRANSFER_NOT_COMPLETED')
assert.equal(executed.summary?.receiptStatus, 'verified', 'DATA_SPACE_RECEIPT_NOT_VERIFIED')
assert.equal(executed.summary?.checksumVerified, true, 'DATA_SPACE_CHECKSUM_NOT_VERIFIED')
assert.ok(executed.summary?.assetId, 'DATA_SPACE_ASSET_ID_MISSING')
assert.ok(executed.summary?.agreementId, 'DATA_SPACE_AGREEMENT_ID_MISSING')
assert.ok(executed.summary?.transferId, 'DATA_SPACE_TRANSFER_ID_MISSING')
assert.ok(executed.summary?.sha256, 'DATA_SPACE_SHA256_MISSING')
assert.equal(executed.summary?.rowCount, 25, 'DATA_SPACE_QUERY_ROW_COUNT_MISMATCH')

const detail = await getWorkflowRun(approvedRun.id)
assert.equal(detail.ok, true, detail.error || 'DATA_SPACE_WORKFLOW_DETAIL_FAILED')
assert.ok(detail.run.steps.every((step) => step.status === 'succeeded'), 'DATA_SPACE_WORKFLOW_STEP_NOT_SUCCEEDED')
const requiredArtifacts = [
  'data-space-package',
  'edc-policy',
  'edc-asset',
  'edc-contract-definition',
  'edc-catalog-offer',
  'edc-contract-agreement',
  'edc-transfer',
  'data-space-transfer-receipt',
  'data-space-exchange-summary',
]
for (const artifactKind of requiredArtifacts) {
  assert.ok(detail.run.artifacts.some((artifact) => artifact.artifactKind === artifactKind), `DATA_SPACE_ARTIFACT_MISSING:${artifactKind}`)
}

const persistence = await withClient(async (client) => {
  const result = await client.query(
    `
      SELECT
        package.id AS package_id,
        package.status AS package_status,
        package.byte_size AS package_byte_size,
        package.sha256 AS package_sha256,
        receipt.id AS receipt_id,
        receipt.status AS receipt_status,
        receipt.byte_size AS receipt_byte_size,
        receipt.sha256 AS receipt_sha256
      FROM ldt_interop.data_space_asset_packages package
      JOIN ldt_interop.data_space_transfer_receipts receipt ON receipt.package_id = package.id
      WHERE package.workflow_run_id = $1
    `,
    [approvedRun.id],
  )
  return result.rows[0]
})
assert.ok(persistence, 'DATA_SPACE_PERSISTENCE_EVIDENCE_MISSING')
assert.equal(persistence.package_status, 'transferred', 'DATA_SPACE_PACKAGE_STATUS_MISMATCH')
assert.equal(persistence.receipt_status, 'verified', 'DATA_SPACE_RECEIPT_DB_STATUS_MISMATCH')
assert.equal(persistence.package_sha256, persistence.receipt_sha256, 'DATA_SPACE_DB_SHA256_MISMATCH')
assert.equal(Number(persistence.package_byte_size), Number(persistence.receipt_byte_size), 'DATA_SPACE_DB_BYTE_SIZE_MISMATCH')

const packages = await listDataSpaceAssetPackages({ cityId, limit: 10 })
assert.ok(packages.packages.some((entry) => entry.id === persistence.package_id), 'DATA_SPACE_PACKAGE_NOT_LISTED')

const isolationCreated = await createWorkflowRun({
  workflowKey: 'eu-ldt-data-space-query-exchange',
  cityId,
  input: {
    providerIntegrationProfileKey: `missing-data-space-provider-${Date.now()}`,
    consumerIntegrationProfileKey: consumerProfileKey,
    title: 'Missing provider isolation test',
    format: 'geojson',
    limit: 1,
    query: {
      language: 'twinql-json',
      classes: ['roads'],
      scope: { key: 'city' },
      render: { mode: 'isolate', transport: 'geojson', maxFeatures: 1 },
    },
  },
  requestedBy: 'eu-ldt-data-space-ready-smoke',
  requestedByKind: 'system-smoke',
  triggerKind: 'standalone-isolation-smoke',
})
assert.equal(isolationCreated.ok, true, isolationCreated.error || 'DATA_SPACE_ISOLATION_RUN_CREATE_FAILED')
let isolationRun = isolationCreated.run
for (const approval of isolationRun.approvals.filter((entry) => entry.status === 'requested')) {
  const decision = await decideWorkflowApproval({
    runId: isolationRun.id,
    approvalKey: approval.approvalKey,
    decision: 'approved',
    decidedBy: 'eu-ldt-data-space-ready-smoke',
    reason: 'Verify a missing optional data-space profile fails only its own workflow.',
  })
  assert.equal(decision.ok, true, decision.error || `DATA_SPACE_ISOLATION_APPROVAL_FAILED:${approval.approvalKey}`)
  isolationRun = decision.run
}
const isolatedFailure = await executeWorkflowRunOnce({
  runId: isolationRun.id,
  workerId: 'eu-ldt-data-space-ready-isolation-smoke',
})
assert.equal(isolatedFailure.ok, false, 'MISSING_DATA_SPACE_PROFILE_SHOULD_FAIL_WORKFLOW')
assert.match(isolatedFailure.error, /EU_LDT_PROFILE_NOT_FOUND/, 'MISSING_DATA_SPACE_PROFILE_ERROR_MISMATCH')
assert.equal(isolatedFailure.run?.status, 'failed', 'MISSING_DATA_SPACE_PROFILE_RUN_NOT_FAILED')
const standaloneCapability = await getCityCapabilityState(cityId)
assert.equal(standaloneCapability.ok, true, standaloneCapability.error || 'OLDT_CAPABILITY_FAILED_AFTER_DATA_SPACE_ERROR')
assert.ok(Number(standaloneCapability.counts?.entities ?? 0) > 0, 'OLDT_CANONICAL_ENTITIES_UNAVAILABLE_AFTER_DATA_SPACE_ERROR')

console.log(JSON.stringify({
  ok: true,
  cityId,
  profiles: {
    provider: { key: providerProfileKey, status: providerCheck.profile.status },
    consumer: { key: consumerProfileKey, status: consumerCheck.profile.status },
  },
  workflowRunId: approvedRun.id,
  packageId: persistence.package_id,
  assetId: executed.summary.assetId,
  agreementId: executed.summary.agreementId,
  transferId: executed.summary.transferId,
  receiptId: persistence.receipt_id,
  rowCount: executed.summary.rowCount,
  byteSize: Number(persistence.package_byte_size),
  sha256: persistence.package_sha256,
  transferState: executed.summary.transferState,
  receiptStatus: persistence.receipt_status,
  isolation: {
    workflowRunId: isolationRun.id,
    workflowStatus: isolatedFailure.run?.status,
    oldtCapabilityStillAvailable: standaloneCapability.ok,
    canonicalEntityCount: Number(standaloneCapability.counts?.entities ?? 0),
  },
  artifacts: detail.run.artifacts.map((artifact) => artifact.artifactKind),
}, null, 2))
