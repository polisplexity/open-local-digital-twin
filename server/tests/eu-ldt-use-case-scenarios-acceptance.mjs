import assert from 'node:assert/strict'

import {
  createWorkflowRun,
  decideWorkflowApproval,
  executeWorkflowRunOnce,
  listUcsExchangeState,
  testEuLdtIntegrationProfile,
  upsertEuLdtIntegrationProfile,
} from '../services/ldtOpsService.mjs'
import {
  finishEuLdtAcceptanceRun,
  getEuLdtAcceptanceRun,
  recordEuLdtAcceptanceCase,
  startEuLdtAcceptanceRun,
} from '../services/ldtOps/euLdtAcceptanceService.mjs'
import { withClient } from '../services/ldtOps/dbUtils.mjs'

const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
const cityId = cityArg ? cityArg.split('=').slice(1).join('=').trim() : 'guanajuato'
const timestamp = Date.now()
const ucsProfileKey = process.env.EU_LDT_UCS_PROFILE_KEY ?? 'local-eu-ldt-use-case-scenarios'
const dataPlatformProfileKey = process.env.EU_LDT_DATA_PLATFORM_PROFILE_KEY ?? 'local-eu-ldt-data-platform'
const clientSecret = String(process.env.EU_LDT_UCS_CLIENT_SECRET ?? '').trim()
const baseUrl = String(process.env.EU_LDT_UCS_BASE_URL ?? 'http://host.docker.internal:3001').replace(/\/+$/, '')
const frontendUrl = String(process.env.EU_LDT_UCS_FRONTEND_URL ?? 'http://localhost:5002').replace(/\/+$/, '')

assert.ok(clientSecret, 'EU_LDT_UCS_CLIENT_SECRET_REQUIRED')

const acceptanceRun = await startEuLdtAcceptanceRun({
  cityId,
  suiteKey: 'oldt-ucs-baseline-intervention-v1',
  toolKind: 'use-case-scenarios',
  environment: {
    ucsProfileKey,
    dataPlatformProfileKey,
    baseUrl,
    frontendUrl,
    modelNamespace: 'dev',
    modelName: 'echo-model',
  },
})

const recordedCases = []

async function recordCase(payload) {
  const entry = await recordEuLdtAcceptanceCase({
    acceptanceRunId: acceptanceRun.id,
    ...payload,
  })
  recordedCases.push(entry)
  return entry
}

async function latestSelectionSet() {
  return withClient(async (client) => {
    const result = await client.query(`
      SELECT id, title, result_count, returned_count, query_hash
      FROM ldt_analysis.selection_sets
      WHERE city_id = $1 AND status = 'ready' AND result_count > 0
      ORDER BY created_at DESC
      LIMIT 1
    `, [cityId])
    if (!result.rowCount) throw new Error('UCS_ACCEPTANCE_SELECTION_SET_REQUIRED')
    return result.rows[0]
  })
}

async function approveAndExecute(input) {
  const created = await createWorkflowRun({
    workflowKey: 'eu-ldt-use-case-scenarios-roundtrip',
    cityId,
    requestedBy: 'eu-ldt-ucs-acceptance',
    requestedByKind: 'integration-test',
    triggerKind: 'eu-ldt-ucs-acceptance',
    input,
  })
  assert.equal(created.ok, true, created.error || 'UCS_WORKFLOW_CREATE_FAILED')
  let run = created.run
  for (const approval of run.approvals.filter((entry) => entry.status === 'requested')) {
    const decision = await decideWorkflowApproval({
      runId: run.id,
      approvalKey: approval.approvalKey,
      decision: 'approved',
      decidedBy: 'eu-ldt-ucs-acceptance',
      reason: 'Acceptance suite approved the bounded baseline/intervention integration run.',
    })
    assert.equal(decision.ok, true, decision.error || `UCS_APPROVAL_FAILED:${approval.approvalKey}`)
    run = decision.run
  }
  const executed = await executeWorkflowRunOnce({ runId: run.id, workerId: 'eu-ldt-ucs-acceptance' })
  assert.equal(executed.ok, true, executed.error || 'UCS_WORKFLOW_EXECUTION_FAILED')
  assert.equal(executed.run?.status, 'succeeded', 'UCS_WORKFLOW_NOT_SUCCEEDED')
  return executed
}

try {
  await upsertEuLdtIntegrationProfile({
    profileKey: ucsProfileKey,
    displayName: 'Local EU LDT Use Case & Scenarios',
    platformKind: 'use-case-scenarios',
    baseUrl,
    cityId,
    remoteCityId: cityId,
    status: 'registered',
    authConfig: {
      type: 'oauth2-client-credentials',
      tokenUrl: 'http://host.docker.internal:9080/realms/LDT/protocol/openid-connect/token',
      clientId: 'tool2-workflow',
      clientSecret,
      scope: 'openid profile email',
    },
    endpoints: {
      apiBaseUrl: `${baseUrl}/api/v1`,
      healthUrl: `${baseUrl}/api/v1/health`,
      openApiUrl: `${baseUrl}/documentation/json`,
      casesUrl: `${baseUrl}/api/v1/cases`,
      scenariosUrl: `${baseUrl}/api/v1/scenarios`,
      experimentExecutionsUrl: `${baseUrl}/api/v1/experiment-executions`,
      dataPlatformScopesUrl: `${baseUrl}/api/v1/data-platform/scopes`,
      aiNamespacesUrl: `${baseUrl}/api/v1/ai-notebook/namespaces`,
      aiNotebookInferenceUrl: 'http://host.docker.internal:3333/ain/inference',
      publicFrontendUrl: frontendUrl,
      publicApiDocsUrl: 'http://localhost:3001/documentation',
      publicAirflowUrl: 'http://localhost:8085',
    },
    capabilities: {
      caseLifecycle: true,
      baselineInterventionScenarios: true,
      dataPlatformSources: true,
      airflowExecution: true,
      aiNotebookModels: true,
      executionReadback: true,
      oldtProvenanceBinding: true,
    },
    metadata: {
      origin: 'oldt-acceptance-suite',
      optionalAddon: true,
    },
    registeredBy: 'eu-ldt-ucs-acceptance',
  })

  const profileStartedAt = Date.now()
  const profileCheck = await testEuLdtIntegrationProfile(ucsProfileKey)
  assert.equal(profileCheck.ok, true, JSON.stringify(profileCheck.result))
  assert.equal(profileCheck.result?.checks?.length, 5, 'UCS_PROFILE_CHECK_COUNT_MISMATCH')
  assert.equal(profileCheck.result.checks.every((entry) => entry.ok), true, 'UCS_PROFILE_CHECK_FAILED')
  await recordCase({
    caseKey: 'ucs-profile-and-dependencies',
    category: 'connectivity',
    title: 'UCS profile reaches health, OpenAPI, cases, Data Platform, and AI Notebook',
    status: 'passed',
    durationMs: Date.now() - profileStartedAt,
    expected: { checks: 5, status: 'validated' },
    actual: { checks: profileCheck.result.checks.length, status: profileCheck.profile.status },
    evidence: { checks: profileCheck.result.checks },
  })

  const selection = await latestSelectionSet()
  const bindingKey = `ucs-acceptance-${timestamp}`
  const workflowStartedAt = Date.now()
  const executed = await approveAndExecute({
    ucsProfileKey,
    dataPlatformProfileKey,
    selectionSetId: selection.id,
    bindingKey,
    metricKey: 'result_count',
    aggregation: 'value',
    unit: 'objects',
    interventionDeltaPercent: -20,
    caseName: `OLDT UCS acceptance ${timestamp}`,
    modelNamespace: 'dev',
    modelName: 'echo-model',
    ngsiScope: 'default',
    executionTimeoutMs: 240000,
    pollIntervalMs: 1000,
  })
  const summary = executed.summary
  assert.ok(summary?.caseId, 'UCS_CASE_ID_MISSING')
  assert.equal(summary?.selectionSetId, selection.id, 'UCS_SELECTION_BINDING_MISMATCH')
  assert.equal(Number(summary?.baseline?.value), Number(selection.result_count), 'UCS_BASELINE_VALUE_MISMATCH')
  assert.equal(Number(summary?.intervention?.value), Number((selection.result_count * 0.8).toFixed(6)), 'UCS_INTERVENTION_VALUE_MISMATCH')
  await recordCase({
    caseKey: 'oldt-metric-to-data-platform',
    category: 'data-exchange',
    title: 'OLDT publishes distinct baseline and intervention NGSI-LD entities',
    status: 'passed',
    workflowRunId: executed.run.id,
    durationMs: Date.now() - workflowStartedAt,
    expected: { selectionSetId: selection.id, baseline: Number(selection.result_count), deltaPercent: -20 },
    actual: {
      baseline: summary.baseline.value,
      intervention: summary.intervention.value,
      baselineEntityId: summary.baseline.entityId,
      interventionEntityId: summary.intervention.entityId,
    },
    evidence: {
      artifactKinds: executed.artifacts.map((entry) => entry.artifactKind),
      dataPlatformArtifact: executed.artifacts.find((entry) => entry.artifactKind === 'ucs-data-platform-publication'),
    },
  })

  assert.ok(summary.baseline.scenarioId && summary.intervention.scenarioId, 'UCS_SCENARIO_IDS_MISSING')
  assert.ok(summary.baseline.dataSourceId && summary.intervention.dataSourceId, 'UCS_DATA_SOURCE_IDS_MISSING')
  assert.ok(summary.baseline.dataModelId && summary.intervention.dataModelId, 'UCS_DATA_MODEL_IDS_MISSING')
  assert.ok(summary.baseline.experimentId && summary.intervention.experimentId, 'UCS_EXPERIMENT_IDS_MISSING')
  await recordCase({
    caseKey: 'ucs-case-and-scenario-structure',
    category: 'ucs-domain',
    title: 'UCS stores one case with two executable scenario branches',
    status: 'passed',
    workflowRunId: executed.run.id,
    expected: { cases: 1, scenarios: 2, dataSources: 2, dataModels: 2, experiments: 2 },
    actual: {
      caseId: summary.caseId,
      scenarioIds: [summary.baseline.scenarioId, summary.intervention.scenarioId],
      dataSourceIds: [summary.baseline.dataSourceId, summary.intervention.dataSourceId],
      dataModelIds: [summary.baseline.dataModelId, summary.intervention.dataModelId],
      experimentIds: [summary.baseline.experimentId, summary.intervention.experimentId],
    },
    evidence: {
      caseArtifact: executed.artifacts.find((entry) => entry.artifactKind === 'ucs-case-structure'),
    },
  })

  assert.equal(summary.baseline.status, 'COMPLETED', 'UCS_BASELINE_NOT_COMPLETED')
  assert.equal(summary.intervention.status, 'COMPLETED', 'UCS_INTERVENTION_NOT_COMPLETED')
  assert.notEqual(summary.baseline.executionId, summary.intervention.executionId, 'UCS_EXECUTION_IDS_NOT_DISTINCT')
  await recordCase({
    caseKey: 'airflow-ai-notebook-dual-execution',
    category: 'execution',
    title: 'Airflow and AI Notebook complete both scenario executions with effective output',
    status: 'passed',
    workflowRunId: executed.run.id,
    expected: { baselineStatus: 'COMPLETED', interventionStatus: 'COMPLETED', modelName: 'echo-model' },
    actual: {
      baselineStatus: summary.baseline.status,
      interventionStatus: summary.intervention.status,
      baselineExecutionId: summary.baseline.executionId,
      interventionExecutionId: summary.intervention.executionId,
      modelName: summary.modelName,
    },
    evidence: {
      executionArtifact: executed.artifacts.find((entry) => entry.artifactKind === 'ucs-experiment-executions'),
    },
  })

  const state = await listUcsExchangeState({ cityId, ucsProfileKey, limit: 100 })
  const binding = state.bindings.find((entry) => entry.bindingKey === bindingKey)
  assert.ok(binding, 'UCS_BINDING_NOT_PERSISTED')
  assert.equal(binding.status, 'completed', 'UCS_BINDING_NOT_COMPLETED')
  assert.equal(binding.caseId, summary.caseId, 'UCS_BINDING_CASE_MISMATCH')
  assert.equal(binding.sourceWorkflowRunId, executed.run.id, 'UCS_BINDING_WORKFLOW_MISMATCH')
  await recordCase({
    caseKey: 'oldt-provenance-binding',
    category: 'persistence',
    title: 'OLDT persists the complete UCS roundtrip and its source selection',
    status: 'passed',
    workflowRunId: executed.run.id,
    expected: { bindingKey, status: 'completed', selectionSetId: selection.id },
    actual: binding,
    evidence: { stateCounts: state.counts },
  })

  const finished = await finishEuLdtAcceptanceRun({
    acceptanceRunId: acceptanceRun.id,
    status: 'passed',
    summary: {
      workflowRunId: executed.run.id,
      bindingKey,
      caseId: summary.caseId,
      baselineExecutionId: summary.baseline.executionId,
      interventionExecutionId: summary.intervention.executionId,
    },
  })
  const detail = await getEuLdtAcceptanceRun(acceptanceRun.id)
  assert.equal(finished.status, 'passed')
  assert.equal(detail.cases.length, 5)
  assert.equal(detail.cases.every((entry) => entry.status === 'passed'), true)

  console.log(JSON.stringify({
    ok: true,
    cityId,
    acceptanceRunId: acceptanceRun.id,
    workflowRunId: executed.run.id,
    bindingKey,
    caseId: summary.caseId,
    baseline: summary.baseline,
    intervention: summary.intervention,
    acceptance: {
      status: finished.status,
      cases: detail.cases.map((entry) => ({ caseKey: entry.caseKey, status: entry.status })),
    },
  }, null, 2))
} catch (error) {
  await recordCase({
    caseKey: 'ucs-acceptance-failure',
    category: 'failure',
    title: 'UCS acceptance suite failure evidence',
    status: 'failed',
    expected: { status: 'passed' },
    actual: { recordedCases: recordedCases.length },
    evidence: {},
    error: String(error?.stack ?? error?.message ?? error),
  }).catch(() => {})
  await finishEuLdtAcceptanceRun({
    acceptanceRunId: acceptanceRun.id,
    status: 'failed',
    summary: { error: String(error?.message ?? error) },
  }).catch(() => {})
  throw error
}
