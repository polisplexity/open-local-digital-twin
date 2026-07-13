import assert from 'node:assert/strict'

import {
  createWorkflowRun,
  decideWorkflowApproval,
  executeWorkflowRunOnce,
  getCityCapabilityState,
  testEuLdtIntegrationProfile,
  upsertEuLdtIntegrationProfile,
} from '../services/ldtOpsService.mjs'
import { withClient } from '../services/ldtOps/dbUtils.mjs'

const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
const cityId = cityArg ? cityArg.split('=').slice(1).join('=').trim() : 'guanajuato'
const profileKey = 'local-eu-ldt-data-modeller'
const timestamp = Date.now()
const backendBaseUrl = String(process.env.EU_LDT_DATA_MODELLER_URL ?? 'http://host.docker.internal:4321').replace(/\/+$/, '')

async function approveRun(run, reason) {
  let current = run
  for (const approval of current.approvals.filter((entry) => entry.status === 'requested')) {
    const decision = await decideWorkflowApproval({
      runId: current.id,
      approvalKey: approval.approvalKey,
      decision: 'approved',
      decidedBy: 'eu-ldt-data-modeller-smoke',
      reason,
    })
    assert.equal(decision.ok, true, decision.error || `APPROVAL_FAILED:${approval.approvalKey}`)
    current = decision.run
  }
  assert.equal(current.status, 'queued', 'WORKFLOW_NOT_QUEUED_AFTER_APPROVALS')
  return current
}

const registered = await upsertEuLdtIntegrationProfile({
  profileKey,
  displayName: 'Local EU LDT Data Modeller',
  platformKind: 'data-modeller',
  baseUrl: backendBaseUrl,
  cityId,
  remoteCityId: cityId,
  status: 'registered',
  authConfig: { type: 'none' },
  endpoints: {
    backendApiUrl: `${backendBaseUrl}/api/v1`,
    healthUrl: `${backendBaseUrl}/api/v1/health`,
    openApiUrl: `${backendBaseUrl}/documentation/json`,
    publicFrontendUrl: 'http://localhost:4320',
  },
  capabilities: {
    schemaCrud: true,
    schemaApprovalGate: true,
    syntheticDataGeneration: true,
    appendOnlyOldtImport: true,
  },
  metadata: {
    origin: 'eu-ldt-data-modeller-exchange-smoke',
    optionalAddon: true,
  },
  registeredBy: 'eu-ldt-data-modeller-smoke',
})
assert.equal(registered.ok, true, 'DATA_MODELLER_PROFILE_REGISTER_FAILED')

const checked = await testEuLdtIntegrationProfile(profileKey)
assert.equal(checked.result.checks.length, 2, 'DATA_MODELLER_PROFILE_CHECK_COUNT_MISMATCH')
assert.ok(['validated', 'warning'].includes(checked.profile.status), `DATA_MODELLER_PROFILE_STATUS_INVALID:${checked.profile.status}`)
const healthCheck = checked.result.checks.find((entry) => entry.url.endsWith('/api/v1/health'))
const openApiCheck = checked.result.checks.find((entry) => entry.url.endsWith('/documentation/json'))
assert.ok(healthCheck?.serviceStatus, 'DATA_MODELLER_HEALTH_SERVICE_STATUS_MISSING')
assert.equal(openApiCheck?.ok, true, 'DATA_MODELLER_OPENAPI_CHECK_FAILED')
if (healthCheck.serviceStatus !== 'healthy') {
  assert.equal(checked.profile.status, 'warning', 'DATA_MODELLER_UNHEALTHY_BODY_MUST_WARN')
}

const schemaRunCreated = await createWorkflowRun({
  workflowKey: 'eu-ldt-data-modeller-prepare-schema',
  cityId,
  input: {
    integrationProfileKey: profileKey,
    entityType: 'building',
    limit: 8,
    schemaName: `OLDT Data Modeller Lab ${timestamp}`,
    referenceName: `oldt_data_modeller_lab_${timestamp}`,
    version: '1.0.0',
    ownership: 'OLDT integration lab',
    description: 'Synthetic fixture contract created from an OLDT canonical building sample.',
    tags: ['OLDT', 'EU LDT', 'integration-smoke'],
    outputField: 'synthetic_score',
    outputMinimum: 10,
    outputMaximum: 90,
  },
  requestedBy: 'eu-ldt-data-modeller-smoke',
  requestedByKind: 'system-smoke',
  triggerKind: 'integration-smoke',
})
assert.equal(schemaRunCreated.ok, true, schemaRunCreated.error || 'DATA_MODELLER_SCHEMA_RUN_CREATE_FAILED')
await approveRun(schemaRunCreated.run, 'Approve bounded schema registration smoke.')

const schemaExecuted = await executeWorkflowRunOnce({
  runId: schemaRunCreated.run.id,
  workerId: 'eu-ldt-data-modeller-smoke',
})
assert.equal(schemaExecuted.ok, true, schemaExecuted.error || 'DATA_MODELLER_SCHEMA_EXECUTION_FAILED')
assert.equal(schemaExecuted.run.status, 'succeeded', 'DATA_MODELLER_SCHEMA_RUN_NOT_SUCCEEDED')
assert.ok(schemaExecuted.summary?.schemaId, 'DATA_MODELLER_SCHEMA_ID_MISSING')
assert.equal(schemaExecuted.summary?.isApproved, false, 'DATA_MODELLER_SCHEMA_SHOULD_REQUIRE_EXTERNAL_APPROVAL')

const schemaId = schemaExecuted.summary.schemaId
const approvalResponse = await fetch(`${backendBaseUrl}/api/v1/schemas/${encodeURIComponent(schemaId)}/approve`, {
  method: 'PUT',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  body: JSON.stringify({ evaluationScore: 92 }),
  signal: AbortSignal.timeout(20_000),
})
const approvalBody = await approvalResponse.json().catch(() => ({}))
assert.equal(approvalResponse.ok, true, `DATA_MODELLER_SCHEMA_APPROVAL_FAILED:${approvalResponse.status}:${JSON.stringify(approvalBody)}`)
assert.equal(approvalBody.isApproved, true, 'DATA_MODELLER_SCHEMA_APPROVAL_NOT_PERSISTED')

const fixtureRunCreated = await createWorkflowRun({
  workflowKey: 'eu-ldt-data-modeller-fixture-import',
  cityId,
  input: {
    integrationProfileKey: profileKey,
    schemaId,
    entityType: 'building',
    recordCount: 8,
    minimumEvaluationScore: 80,
    modelKey: 'eu-ldt-data-modeller-fixture',
    modelVersion: `smoke-${timestamp}`,
    outputField: 'synthetic_score',
    outputKey: 'synthetic-score',
    unit: 'score',
  },
  requestedBy: 'eu-ldt-data-modeller-smoke',
  requestedByKind: 'system-smoke',
  triggerKind: 'integration-smoke',
})
assert.equal(fixtureRunCreated.ok, true, fixtureRunCreated.error || 'DATA_MODELLER_FIXTURE_RUN_CREATE_FAILED')
await approveRun(fixtureRunCreated.run, 'Approve controlled synthetic fixture import smoke.')

const fixtureExecuted = await executeWorkflowRunOnce({
  runId: fixtureRunCreated.run.id,
  workerId: 'eu-ldt-data-modeller-smoke',
})
assert.equal(fixtureExecuted.ok, true, fixtureExecuted.error || 'DATA_MODELLER_FIXTURE_EXECUTION_FAILED')
assert.equal(fixtureExecuted.run.status, 'succeeded', 'DATA_MODELLER_FIXTURE_RUN_NOT_SUCCEEDED')
assert.equal(fixtureExecuted.summary?.authorityStatus, 'simulated', 'DATA_MODELLER_FIXTURE_AUTHORITY_MISMATCH')
assert.equal(fixtureExecuted.summary?.importedCount, 8, 'DATA_MODELLER_FIXTURE_IMPORT_COUNT_MISMATCH')

const outputEvidence = await withClient(async (client) => {
  const result = await client.query(
    `
      SELECT
        count(*)::int AS output_count,
        count(*) FILTER (WHERE authority_status = 'simulated')::int AS simulated_count,
        count(*) FILTER (WHERE confidence = 'synthetic')::int AS synthetic_count,
        count(*) FILTER (WHERE source_artifact_id IS NOT NULL)::int AS source_artifact_count
      FROM ldt_enrichment.entity_model_outputs
      WHERE workflow_run_id = $1
    `,
    [fixtureRunCreated.run.id],
  )
  return result.rows[0]
})
assert.equal(outputEvidence.output_count, 8, 'DATA_MODELLER_OUTPUT_DB_COUNT_MISMATCH')
assert.equal(outputEvidence.simulated_count, 8, 'DATA_MODELLER_OUTPUT_SIMULATED_COUNT_MISMATCH')
assert.equal(outputEvidence.synthetic_count, 8, 'DATA_MODELLER_OUTPUT_SYNTHETIC_COUNT_MISMATCH')
assert.equal(outputEvidence.source_artifact_count, 8, 'DATA_MODELLER_OUTPUT_SOURCE_ARTIFACT_MISSING')

const isolatedFailureCreated = await createWorkflowRun({
  workflowKey: 'eu-ldt-data-modeller-prepare-schema',
  cityId,
  input: {
    integrationProfileKey: `missing-data-modeller-${timestamp}`,
    entityType: 'building',
    limit: 1,
  },
  requestedBy: 'eu-ldt-data-modeller-smoke',
  requestedByKind: 'system-smoke',
  triggerKind: 'standalone-isolation-smoke',
})
assert.equal(isolatedFailureCreated.ok, true, isolatedFailureCreated.error || 'DATA_MODELLER_ISOLATION_RUN_CREATE_FAILED')
await approveRun(isolatedFailureCreated.run, 'Approve missing-profile isolation smoke.')
const isolatedFailure = await executeWorkflowRunOnce({
  runId: isolatedFailureCreated.run.id,
  workerId: 'eu-ldt-data-modeller-isolation-smoke',
})
assert.equal(isolatedFailure.ok, false, 'MISSING_DATA_MODELLER_PROFILE_SHOULD_FAIL_WORKFLOW')
assert.match(isolatedFailure.error, /EU_LDT_PROFILE_NOT_FOUND/, 'MISSING_DATA_MODELLER_PROFILE_ERROR_MISMATCH')
assert.equal(isolatedFailure.run?.status, 'failed', 'MISSING_DATA_MODELLER_PROFILE_RUN_NOT_FAILED')

const standaloneCapability = await getCityCapabilityState(cityId)
assert.equal(standaloneCapability.ok, true, standaloneCapability.error || 'OLDT_CAPABILITY_FAILED_AFTER_DATA_MODELLER_ERROR')
assert.ok(Number(standaloneCapability.counts?.entities ?? 0) > 0, 'OLDT_CANONICAL_ENTITIES_UNAVAILABLE_AFTER_DATA_MODELLER_ERROR')

console.log(JSON.stringify({
  ok: true,
  cityId,
  profile: {
    key: checked.profile.profileKey,
    status: checked.profile.status,
    checks: checked.result.checks.map((check) => ({ url: check.url, status: check.status, ok: check.ok })),
  },
  schema: {
    workflowRunId: schemaRunCreated.run.id,
    schemaId,
    evaluationScore: approvalBody.evaluationScore,
    isApproved: approvalBody.isApproved,
  },
  fixture: {
    workflowRunId: fixtureRunCreated.run.id,
    importedCount: fixtureExecuted.summary.importedCount,
    authorityStatus: fixtureExecuted.summary.authorityStatus,
    outputEvidence,
  },
  isolation: {
    workflowRunId: isolatedFailureCreated.run.id,
    workflowStatus: isolatedFailure.run?.status,
    workflowError: isolatedFailure.error,
    oldtCapabilityStillAvailable: standaloneCapability.ok,
    canonicalEntityCount: Number(standaloneCapability.counts?.entities ?? 0),
  },
}, null, 2))
