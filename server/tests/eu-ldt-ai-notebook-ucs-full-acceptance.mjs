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
import {
  getUcsResource,
  resolveUcsTarget,
} from '../services/ldtOps/euLdtUseCaseScenariosService.mjs'
import { withClient } from '../services/ldtOps/dbUtils.mjs'

const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
const cityId = cityArg ? cityArg.split('=').slice(1).join('=').trim() : 'guanajuato'
const timestamp = Date.now()
const ucsProfileKey = process.env.EU_LDT_UCS_PROFILE_KEY ?? 'local-eu-ldt-use-case-scenarios'
const dataPlatformProfileKey = process.env.EU_LDT_DATA_PLATFORM_PROFILE_KEY ?? 'local-eu-ldt-data-platform'
const preferredSelectionSetId = process.env.EU_LDT_AI_SELECTION_SET_ID ?? '60120d5c-225a-41bf-8a92-082b9d37ded8'
const clientSecret = String(process.env.EU_LDT_UCS_CLIENT_SECRET ?? '').trim()
const baseUrl = String(process.env.EU_LDT_UCS_BASE_URL ?? 'http://host.docker.internal:3001').replace(/\/+$/, '')
const frontendUrl = String(process.env.EU_LDT_UCS_FRONTEND_URL ?? 'http://localhost:5002').replace(/\/+$/, '')
const modelNamespace = 'kubeflow-ldt-user'
const modelName = 'oldt-urban-energy-scenario'
const modelRecordCount = 300
const retrofitSavingsFraction = 0.25

assert.ok(clientSecret, 'EU_LDT_UCS_CLIENT_SECRET_REQUIRED')

const acceptanceRun = await startEuLdtAcceptanceRun({
  cityId,
  suiteKey: 'oldt-ucs-ai-notebook-building-scenario-v1',
  toolKind: 'ai-notebook',
  environment: {
    ucsProfileKey,
    dataPlatformProfileKey,
    baseUrl,
    frontendUrl,
    modelNamespace,
    modelName,
    modelRecordCount,
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

async function buildingSelection() {
  return withClient(async (client) => {
    const preferred = await client.query(`
      SELECT id, title, result_count, returned_count, query_hash
      FROM ldt_analysis.selection_sets
      WHERE id = NULLIF($1, '')::uuid
        AND city_id = $2
        AND status = 'ready'
        AND result_count > 0
      LIMIT 1
    `, [preferredSelectionSetId, cityId])
    if (preferred.rowCount) return preferred.rows[0]
    const fallback = await client.query(`
      SELECT selection.id, selection.title, selection.result_count, selection.returned_count, selection.query_hash
      FROM ldt_analysis.selection_sets selection
      WHERE selection.city_id = $1
        AND selection.status = 'ready'
        AND selection.result_count > 0
        AND EXISTS (
          SELECT 1
          FROM ldt_analysis.selection_set_members member
          JOIN ldt_core.city_entities entity ON entity.id = member.city_entity_id
          WHERE member.selection_set_id = selection.id
            AND lower(entity.entity_type) LIKE '%building%'
        )
      ORDER BY selection.created_at DESC
      LIMIT 1
    `, [cityId])
    if (!fallback.rowCount) throw new Error('UCS_AI_ACCEPTANCE_BUILDING_SELECTION_REQUIRED')
    return fallback.rows[0]
  })
}

async function canonicalEntityCount() {
  return withClient(async (client) => {
    const result = await client.query(
      'SELECT count(*)::integer AS count FROM ldt_core.city_entities WHERE city_id = $1',
      [cityId],
    )
    return Number(result.rows[0].count)
  })
}

async function approveAndExecute(input) {
  const created = await createWorkflowRun({
    workflowKey: 'eu-ldt-use-case-scenarios-roundtrip',
    cityId,
    requestedBy: 'eu-ldt-ai-notebook-full-acceptance',
    requestedByKind: 'integration-test',
    triggerKind: 'eu-ldt-ai-notebook-full-acceptance',
    input,
  })
  assert.equal(created.ok, true, created.error || 'UCS_AI_WORKFLOW_CREATE_FAILED')
  let run = created.run
  for (const approval of run.approvals.filter((entry) => entry.status === 'requested')) {
    const decision = await decideWorkflowApproval({
      runId: run.id,
      approvalKey: approval.approvalKey,
      decision: 'approved',
      decidedBy: 'eu-ldt-ai-notebook-full-acceptance',
      reason: 'Bounded 300-building EU LDT integration acceptance run.',
    })
    assert.equal(decision.ok, true, decision.error || `UCS_AI_APPROVAL_FAILED:${approval.approvalKey}`)
    run = decision.run
  }
  const executed = await executeWorkflowRunOnce({
    runId: run.id,
    workerId: 'eu-ldt-ai-notebook-full-acceptance',
  })
  assert.equal(executed.ok, true, executed.error || 'UCS_AI_WORKFLOW_EXECUTION_FAILED')
  assert.equal(executed.run?.status, 'succeeded', 'UCS_AI_WORKFLOW_NOT_SUCCEEDED')
  return executed
}

async function ucsResource(path, timeoutMs = 30000) {
  return withClient(async (client) => {
    const target = await resolveUcsTarget(client, ucsProfileKey)
    return (await getUcsResource(target, path, { timeoutMs })).body
  })
}

async function persistedSimulationEvidence(runIds) {
  return withClient(async (client) => {
    const runs = await client.query(`
      SELECT
        run.id,
        run.scenario_key,
        run.status,
        run.inputs,
        run.outputs,
        run.uncertainty,
        run.started_at,
        run.finished_at,
        model.model_key,
        model.version
      FROM ldt_science.simulation_runs run
      JOIN ldt_science.simulation_models model ON model.id = run.model_id
      WHERE run.id = ANY($1::uuid[])
      ORDER BY run.scenario_key
    `, [runIds])
    const outputs = await client.query(`
      SELECT
        simulation_run_id,
        count(*)::integer AS output_count,
        count(DISTINCT entity_id)::integer AS entity_count,
        count(DISTINCT output_key)::integer AS output_key_count,
        min(generated_at) AS first_generated_at,
        max(generated_at) AS last_generated_at,
        array_agg(DISTINCT authority_status ORDER BY authority_status) AS authority_statuses
      FROM ldt_enrichment.entity_model_outputs
      WHERE simulation_run_id = ANY($1::uuid[])
      GROUP BY simulation_run_id
      ORDER BY simulation_run_id
    `, [runIds])
    return { runs: runs.rows, outputs: outputs.rows }
  })
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
      aiNotebookInferenceUrl: 'http://kubeflow.127.0.0.1.nip.io:4380/kserve-proxy',
      publicFrontendUrl: frontendUrl,
      publicApiDocsUrl: 'http://localhost:3001/documentation',
      publicAirflowUrl: 'http://localhost:8085',
      publicAiNotebookUrl: 'https://kubeflow.127.0.0.1.nip.io:4381',
    },
    capabilities: {
      caseLifecycle: true,
      baselineInterventionScenarios: true,
      dataPlatformSources: true,
      airflowExecution: true,
      aiNotebookModels: true,
      kserveV2Inference: true,
      entityBatchSimulation: true,
      executionReadback: true,
      oldtProvenanceBinding: true,
    },
    metadata: {
      origin: 'oldt-ai-notebook-full-acceptance',
      optionalAddon: true,
      modelPosture: 'deterministic-laboratory-scenario-model-not-scientifically-validated',
    },
    registeredBy: 'eu-ldt-ai-notebook-full-acceptance',
  })

  const profileCheck = await testEuLdtIntegrationProfile(ucsProfileKey)
  const requiredProfileChecks = profileCheck.result.checks.filter(
    (entry) => !String(entry.url).includes('/ai-notebook/namespaces'),
  )
  assert.equal(requiredProfileChecks.every((entry) => entry.ok), true, JSON.stringify(profileCheck.result))
  const modelMetadata = await ucsResource(`ai-notebook/models/${modelNamespace}/${modelName}`, 90000)
  const modelReady = await ucsResource(`ai-notebook/models/${modelNamespace}/${modelName}/ready`, 90000)
  assert.equal(modelReady.ready, true, 'UCS_AI_MODEL_NOT_READY')
  assert.equal(modelMetadata.name, modelName, 'UCS_AI_MODEL_NAME_MISMATCH')
  assert.equal(modelMetadata.inputs?.length, 4, 'UCS_AI_MODEL_INPUT_CONTRACT_MISMATCH')
  assert.equal(modelMetadata.outputs?.length, 8, 'UCS_AI_MODEL_OUTPUT_CONTRACT_MISMATCH')
  await recordCase({
    caseKey: 'ai-notebook-kserve-model-ready',
    category: 'connectivity',
    title: 'UCS discovers a ready KServe V2 model from EU LDT AI Notebook',
    status: 'passed',
    expected: { modelName, modelNamespace, inputs: 4, outputs: 8, ready: true },
    actual: {
      profileStatus: profileCheck.result.status,
      modelName: modelMetadata.name,
      platform: modelMetadata.platform,
      inputs: modelMetadata.inputs.length,
      outputs: modelMetadata.outputs.length,
      ready: modelReady.ready,
    },
    evidence: {
      profileChecks: profileCheck.result.checks,
      knownToolboxWarning: profileCheck.result.checks.find(
        (entry) => String(entry.url).includes('/ai-notebook/namespaces') && !entry.ok,
      ) ?? null,
    },
  })

  const selection = await buildingSelection()
  const canonicalCountBefore = await canonicalEntityCount()
  const bindingKey = `ucs-ai-buildings-${timestamp}`
  const workflowStartedAt = Date.now()
  const executed = await approveAndExecute({
    ucsProfileKey,
    dataPlatformProfileKey,
    selectionSetId: selection.id,
    bindingKey,
    metricKey: 'result_count',
    aggregation: 'value',
    unit: 'objects',
    entityBatchMode: true,
    maxEntities: modelRecordCount,
    caseName: `OLDT building energy scenario ${timestamp}`,
    modelNamespace,
    modelName,
    ngsiScope: 'default',
    energyIntensityKwhM2: 145,
    retrofitSavingsFraction,
    gridEmissionFactorKgCo2Kwh: 0.423,
    scenarioYear: 2030,
    executionTimeoutMs: 600000,
    pollIntervalMs: 2000,
  })
  const summary = executed.summary
  assert.equal(summary.entityBatchMode, true, 'UCS_AI_ENTITY_BATCH_MODE_MISSING')
  assert.equal(summary.modelRecordCount, modelRecordCount, 'UCS_AI_MODEL_RECORD_COUNT_MISMATCH')
  assert.equal(summary.selectionSetId, selection.id, 'UCS_AI_SELECTION_MISMATCH')
  assert.ok(summary.baseline.entityId && summary.intervention.entityId, 'UCS_AI_DATASET_ENTITIES_MISSING')
  await recordCase({
    caseKey: 'oldt-data-platform-building-datasets',
    category: 'data-exchange',
    title: 'OLDT publishes the same bounded building set as two NGSI-LD scenario datasets',
    status: 'passed',
    workflowRunId: executed.run.id,
    durationMs: Date.now() - workflowStartedAt,
    expected: { selectionSetId: selection.id, recordsPerBranch: modelRecordCount, branches: 2 },
    actual: {
      selectionSetId: summary.selectionSetId,
      recordsPerBranch: summary.modelRecordCount,
      baselineEntityId: summary.baseline.entityId,
      interventionEntityId: summary.intervention.entityId,
    },
    evidence: {
      publication: executed.artifacts.find((entry) => entry.artifactKind === 'ucs-data-platform-publication'),
    },
  })

  assert.equal(Object.keys(summary.parameterIds).length, 4, 'UCS_AI_PARAMETER_COUNT_MISMATCH')
  assert.ok(summary.transformDagId, 'UCS_AI_TRANSFORM_DAG_MISSING')
  const parameterResources = await Promise.all(
    Object.values(summary.parameterIds).map((id) => ucsResource(`parameters/${id}`)),
  )
  const transformDag = await ucsResource(`dags/${summary.transformDagId}`)
  assert.equal(parameterResources.length, 4)
  assert.equal(transformDag.id, summary.transformDagId, 'UCS_AI_TRANSFORM_DAG_READBACK_MISMATCH')
  await recordCase({
    caseKey: 'ucs-visible-parameters-and-transform-workflow',
    category: 'ucs-domain',
    title: 'UCS stores four visible scenario parameters and one generated transform workflow',
    status: 'passed',
    workflowRunId: executed.run.id,
    expected: { parameters: 4, transformDags: 1 },
    actual: {
      parameterIds: Object.values(summary.parameterIds),
      parameterKeys: parameterResources.map((entry) => entry.key),
      transformDagId: transformDag.id,
      transformDagName: transformDag.name,
    },
    evidence: { transformDag },
  })

  assert.equal(summary.baseline.status, 'COMPLETED', 'UCS_AI_BASELINE_NOT_COMPLETED')
  assert.equal(summary.intervention.status, 'COMPLETED', 'UCS_AI_INTERVENTION_NOT_COMPLETED')
  assert.notEqual(summary.baseline.executionId, summary.intervention.executionId, 'UCS_AI_EXECUTIONS_NOT_DISTINCT')
  assert.equal(summary.baseline.simulation.recordCount, modelRecordCount)
  assert.equal(summary.intervention.simulation.recordCount, modelRecordCount)
  await recordCase({
    caseKey: 'airflow-real-kserve-dual-execution',
    category: 'execution',
    title: 'Airflow transforms Data Platform records and invokes the real KServe model twice',
    status: 'passed',
    workflowRunId: executed.run.id,
    expected: { completedExecutions: 2, modelName, recordsPerExecution: modelRecordCount },
    actual: {
      baselineExecutionId: summary.baseline.executionId,
      interventionExecutionId: summary.intervention.executionId,
      baselineRecords: summary.baseline.simulation.recordCount,
      interventionRecords: summary.intervention.simulation.recordCount,
      modelName: summary.modelName,
    },
    evidence: {
      executions: executed.artifacts.find((entry) => entry.artifactKind === 'ucs-experiment-executions'),
    },
  })

  const baselineSimulationRunId = summary.baseline.simulation.simulationRunId
  const interventionSimulationRunId = summary.intervention.simulation.simulationRunId
  const persistence = await persistedSimulationEvidence([baselineSimulationRunId, interventionSimulationRunId])
  assert.equal(persistence.runs.length, 2, 'UCS_AI_SIMULATION_RUN_COUNT_MISMATCH')
  assert.equal(persistence.outputs.length, 2, 'UCS_AI_SIMULATION_OUTPUT_GROUP_COUNT_MISMATCH')
  for (const output of persistence.outputs) {
    assert.equal(Number(output.entity_count), modelRecordCount, 'UCS_AI_PERSISTED_ENTITY_COUNT_MISMATCH')
    assert.equal(Number(output.output_key_count), 7, 'UCS_AI_PERSISTED_OUTPUT_KEY_COUNT_MISMATCH')
    assert.equal(Number(output.output_count), modelRecordCount * 7, 'UCS_AI_PERSISTED_OUTPUT_COUNT_MISMATCH')
    assert.deepEqual(output.authority_statuses, ['simulated'], 'UCS_AI_PERSISTED_AUTHORITY_MISMATCH')
  }
  await recordCase({
    caseKey: 'oldt-entity-simulation-persistence',
    category: 'persistence',
    title: 'OLDT persists two timestamped simulation worlds and seven outputs per building',
    status: 'passed',
    workflowRunId: executed.run.id,
    expected: { simulationRuns: 2, entitiesPerRun: modelRecordCount, outputsPerEntity: 7, totalOutputs: 4200 },
    actual: {
      simulationRunIds: [baselineSimulationRunId, interventionSimulationRunId],
      runs: persistence.runs,
      outputGroups: persistence.outputs,
      totalOutputs: persistence.outputs.reduce((total, entry) => total + Number(entry.output_count), 0),
    },
    evidence: {
      simulationArtifact: executed.artifacts.find((entry) => entry.artifactKind === 'eu-ldt-ai-notebook-simulation-results'),
    },
  })

  const baselineEnergy = Number(summary.baseline.simulation.simulatedEnergyKwh)
  const interventionEnergy = Number(summary.intervention.simulation.simulatedEnergyKwh)
  const expectedInterventionEnergy = baselineEnergy * (1 - retrofitSavingsFraction)
  const tolerance = Math.max(1, expectedInterventionEnergy * 1e-8)
  assert.ok(Math.abs(interventionEnergy - expectedInterventionEnergy) <= tolerance, 'UCS_AI_ENERGY_REDUCTION_MISMATCH')
  assert.ok(
    Number(summary.intervention.simulation.simulatedCo2Kg) < Number(summary.baseline.simulation.simulatedCo2Kg),
    'UCS_AI_CO2_NOT_REDUCED',
  )
  assert.ok(Date.parse(summary.baseline.simulation.generatedAt), 'UCS_AI_BASELINE_TIMESTAMP_INVALID')
  assert.ok(Date.parse(summary.intervention.simulation.generatedAt), 'UCS_AI_INTERVENTION_TIMESTAMP_INVALID')
  await recordCase({
    caseKey: 'scenario-business-and-temporal-assertions',
    category: 'business-result',
    title: 'The intervention world reduces energy and CO2 while preserving explicit simulation time',
    status: 'passed',
    workflowRunId: executed.run.id,
    expected: { retrofitSavingsFraction, expectedInterventionEnergy, authorityStatus: 'simulated' },
    actual: {
      baselineEnergy,
      interventionEnergy,
      baselineCo2Kg: summary.baseline.simulation.simulatedCo2Kg,
      interventionCo2Kg: summary.intervention.simulation.simulatedCo2Kg,
      baselineGeneratedAt: summary.baseline.simulation.generatedAt,
      interventionGeneratedAt: summary.intervention.simulation.generatedAt,
      authorityStatus: summary.authorityStatus,
    },
    evidence: { modelPosture: summary.modelPosture },
  })

  const canonicalCountAfter = await canonicalEntityCount()
  assert.equal(canonicalCountAfter, canonicalCountBefore, 'UCS_AI_CANONICAL_ENTITY_COUNT_CHANGED')
  const state = await listUcsExchangeState({ cityId, ucsProfileKey, limit: 100 })
  const binding = state.bindings.find((entry) => entry.bindingKey === bindingKey)
  assert.ok(binding, 'UCS_AI_BINDING_NOT_PERSISTED')
  assert.equal(binding.status, 'completed', 'UCS_AI_BINDING_NOT_COMPLETED')
  assert.equal(binding.sourceWorkflowRunId, executed.run.id, 'UCS_AI_BINDING_WORKFLOW_MISMATCH')
  await recordCase({
    caseKey: 'roundtrip-provenance-without-canonical-contamination',
    category: 'governance',
    title: 'OLDT preserves full provenance without creating simulated canonical city entities',
    status: 'passed',
    workflowRunId: executed.run.id,
    expected: { bindingKey, canonicalEntityCountDelta: 0 },
    actual: {
      bindingId: binding.id,
      bindingKey: binding.bindingKey,
      canonicalEntityCountBefore: canonicalCountBefore,
      canonicalEntityCountAfter: canonicalCountAfter,
    },
    evidence: { stateCounts: state.counts },
  })

  const finished = await finishEuLdtAcceptanceRun({
    acceptanceRunId: acceptanceRun.id,
    status: 'passed',
    summary: {
      workflowRunId: executed.run.id,
      bindingKey,
      caseId: summary.caseId,
      baselineSimulationRunId,
      interventionSimulationRunId,
      modelName,
      modelRecordCount,
      totalPersistedOutputs: 4200,
    },
  })
  const detail = await getEuLdtAcceptanceRun(acceptanceRun.id)
  assert.equal(finished.status, 'passed')
  assert.equal(detail.cases.length, 7)
  assert.equal(detail.cases.every((entry) => entry.status === 'passed'), true)

  console.log(JSON.stringify({
    ok: true,
    cityId,
    acceptanceRunId: acceptanceRun.id,
    workflowRunId: executed.run.id,
    bindingKey,
    caseId: summary.caseId,
    model: { namespace: modelNamespace, name: modelName, records: modelRecordCount },
    baseline: summary.baseline,
    intervention: summary.intervention,
    persistence,
    canonicalEntityCount: { before: canonicalCountBefore, after: canonicalCountAfter },
    acceptance: {
      status: finished.status,
      cases: detail.cases.map((entry) => ({ caseKey: entry.caseKey, status: entry.status })),
    },
  }, null, 2))
} catch (error) {
  await recordCase({
    caseKey: 'ai-notebook-full-acceptance-failure',
    category: 'failure',
    title: 'EU LDT AI Notebook full acceptance failure evidence',
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
