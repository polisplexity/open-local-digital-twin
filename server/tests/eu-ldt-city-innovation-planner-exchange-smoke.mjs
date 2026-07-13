import assert from 'node:assert/strict'

import {
  createWorkflowRun,
  decideWorkflowApproval,
  executeWorkflowRunOnce,
  listCipExchangeState,
  testEuLdtIntegrationProfile,
} from '../services/ldtOpsService.mjs'
import { requestCipJson } from '../services/ldtOps/euLdtCityInnovationPlannerService.mjs'
import { withClient } from '../services/ldtOps/dbUtils.mjs'

const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
const cityId = cityArg ? cityArg.split('=').slice(1).join('=').trim() : 'guanajuato'
const timestamp = Date.now()
const cipProfileKey = process.env.EU_LDT_CIP_PROFILE_KEY ?? 'local-eu-ldt-city-innovation-planner'
const dataPlatformProfileKey = process.env.EU_LDT_DATA_PLATFORM_PROFILE_KEY ?? 'local-eu-ldt-data-platform'
const cipApi = String(process.env.EU_LDT_CIP_API_URL ?? 'http://host.docker.internal:4351/api/v1').replace(/\/+$/, '')

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function waitForCalculatedMeasurement(kpiId, expectedValue, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  let lastRows = []
  while (Date.now() < deadline) {
    lastRows = []
    for (let page = 0; page < 20; page += 1) {
      const result = await requestCipJson(`${cipApi}/kpi-measurements?page=${page}&size=200`)
      const rows = Array.isArray(result.body?.content) ? result.body.content : []
      lastRows.push(...rows)
      const total = Number(result.body?.metadata?.total ?? lastRows.length)
      if (!rows.length || rows.length < 200 || lastRows.length >= total) break
    }
    const measurement = lastRows
      .filter((entry) => entry.kpiId === kpiId && entry.status === 'success')
      .sort((left, right) => String(right.measureDate ?? '').localeCompare(String(left.measureDate ?? '')))[0]
    if (measurement && Number(measurement.measure) === Number(expectedValue)) return measurement
    await delay(1000)
  }
  throw new Error(`CIP_CALCULATED_MEASUREMENT_TIMEOUT:${kpiId}:rows=${lastRows.length}`)
}

async function latestSelectionSet() {
  return withClient(async (client) => {
    const result = await client.query(`
      SELECT id, title, result_count
      FROM ldt_analysis.selection_sets
      WHERE city_id = $1 AND status = 'ready' AND result_count > 0
      ORDER BY created_at DESC
      LIMIT 1
    `, [cityId])
    if (!result.rowCount) throw new Error('CIP_SMOKE_SELECTION_SET_REQUIRED')
    return result.rows[0]
  })
}

async function approveAndExecute(workflowKey, input) {
  const created = await createWorkflowRun({
    workflowKey,
    cityId,
    requestedBy: 'eu-ldt-cip-smoke',
    requestedByKind: 'integration-test',
    triggerKind: 'eu-ldt-cip-smoke',
    input,
  })
  assert.equal(created.ok, true, created.error || `${workflowKey}:CREATE_FAILED`)
  let run = created.run
  for (const approval of run.approvals.filter((entry) => entry.status === 'requested')) {
    const decision = await decideWorkflowApproval({
      runId: run.id,
      approvalKey: approval.approvalKey,
      decision: 'approved',
      decidedBy: 'eu-ldt-cip-smoke',
      reason: `Integration smoke approved ${workflowKey}.`,
    })
    assert.equal(decision.ok, true, decision.error || `${workflowKey}:APPROVAL_FAILED`)
    run = decision.run
  }
  const executed = await executeWorkflowRunOnce({ runId: run.id, workerId: 'eu-ldt-cip-smoke' })
  assert.equal(executed.ok, true, executed.error || `${workflowKey}:EXECUTION_FAILED`)
  assert.equal(executed.run?.status, 'succeeded', `${workflowKey}:RUN_NOT_SUCCEEDED`)
  return executed
}

const profileCheck = await testEuLdtIntegrationProfile(cipProfileKey)
assert.ok(['validated', 'warning'].includes(profileCheck.profile?.status), 'CIP_PROFILE_CHECK_FAILED')
assert.equal(profileCheck.result?.checks?.length, 4, 'CIP_PROFILE_CHECK_COUNT_MISMATCH')
assert.equal(profileCheck.result.checks.find((entry) => entry.url.includes('/documentation/json'))?.ok, true, 'CIP_OPENAPI_CHECK_FAILED')
assert.equal(profileCheck.result.checks.find((entry) => entry.url.includes('/api/v1/kpis'))?.ok, true, 'CIP_KPI_API_CHECK_FAILED')
assert.equal(profileCheck.result.checks.find((entry) => entry.url.includes('/api/v1/initiatives'))?.ok, true, 'CIP_INITIATIVE_API_CHECK_FAILED')

const selection = await latestSelectionSet()
const bindingKey = `cip-smoke-${timestamp}`
const publication = await approveAndExecute('eu-ldt-cip-publish-metric-source', {
  cipProfileKey,
  dataPlatformProfileKey,
  selectionSetId: selection.id,
  bindingKey,
  metricKey: 'result_count',
  aggregation: 'value',
  unit: 'objects',
  ngsiProperty: 'observedValue',
  createKpi: true,
  kpiName: `OLDT selected objects ${timestamp}`,
  requestCalculation: true,
})

const publicationSummary = publication.summary
assert.ok(publicationSummary?.cipKpiId, 'CIP_KPI_ID_MISSING')
assert.ok(publicationSummary?.cipDatasourceId, 'CIP_DATASOURCE_ID_MISSING')
assert.equal(publicationSummary?.selectionSetId, selection.id, 'CIP_SELECTION_BINDING_MISMATCH')
assert.equal(Number(publicationSummary?.value), Number(selection.result_count), 'CIP_METRIC_VALUE_MISMATCH')

const calculatedMeasurement = await waitForCalculatedMeasurement(
  publicationSummary.cipKpiId,
  publicationSummary.value,
)
const measurementId = calculatedMeasurement.id
assert.ok(measurementId, 'CIP_MEASUREMENT_CREATE_ID_MISSING')

const initiativeCreate = await requestCipJson(`${cipApi}/initiatives`, {
  method: 'POST',
  body: {
    name: `OLDT CIP spatial initiative ${timestamp}`,
    description: 'Integration evidence linking a CIP initiative to an existing OLDT saved selection.',
    status: 'SAVED',
    budget: 125000,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  expectedStatuses: [200, 201],
})
const initiativeId = initiativeCreate.body?.id
assert.ok(initiativeId, 'CIP_INITIATIVE_CREATE_ID_MISSING')

const measurementSync = await approveAndExecute('eu-ldt-cip-sync-measurements', {
  cipProfileKey,
  kpiIds: [publicationSummary.cipKpiId],
})
assert.ok(Number(measurementSync.summary?.inserted ?? 0) + Number(measurementSync.summary?.updated ?? 0) >= 1, 'CIP_MEASUREMENT_NOT_SYNCED')

const initiativeSync = await approveAndExecute('eu-ldt-cip-sync-initiatives', {
  cipProfileKey,
  initiativeIds: [initiativeId],
  links: [{ initiativeId, selectionSetId: selection.id }],
})
assert.equal(initiativeSync.summary?.linked, 1, 'CIP_INITIATIVE_NOT_LINKED')

const state = await listCipExchangeState({ cityId, cipProfileKey, limit: 100 })
const binding = state.bindings.find((entry) => entry.bindingKey === bindingKey)
const receipt = state.measurements.find((entry) => entry.cipMeasurementId === measurementId)
const initiative = state.initiatives.find((entry) => entry.cipInitiativeId === initiativeId)
assert.ok(binding, 'CIP_BINDING_NOT_PERSISTED')
assert.ok(receipt, 'CIP_MEASUREMENT_RECEIPT_NOT_PERSISTED')
assert.ok(initiative, 'CIP_INITIATIVE_NOT_PERSISTED')
assert.equal(initiative.selectionSetId, selection.id, 'CIP_INITIATIVE_SELECTION_NOT_PERSISTED')

console.log(JSON.stringify({
  ok: true,
  cityId,
  cipProfileKey,
  dataPlatformProfileKey,
  selectionSetId: selection.id,
  bindingKey,
  ngsiEntityId: publicationSummary.ngsiEntityId,
  cipKpiId: publicationSummary.cipKpiId,
  cipDatasourceId: publicationSummary.cipDatasourceId,
  measurementId,
  initiativeId,
  counts: state.counts,
}, null, 2))
