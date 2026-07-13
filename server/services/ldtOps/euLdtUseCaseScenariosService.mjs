import { withClient } from './dbUtils.mjs'
import { resolveEuLdtIntegrationTarget } from './euLdtIntegrationService.mjs'

const CORE_CONTEXT = 'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.9.jsonld'
const TERMINAL_EXECUTION_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED'])

function textValue(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function finiteNumber(value, fallback = null) {
  const normalized = typeof value === 'string' ? value.replace(',', '.') : value
  const number = Number(normalized)
  return Number.isFinite(number) ? number : fallback
}

function boundedInteger(value, fallback, minimum = 1, maximum = 1000) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, number))
}

function normalizedKey(value, fallback = 'ucs-roundtrip') {
  const normalized = textValue(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{1,128}$/.test(normalized)) throw new Error('UCS_BINDING_KEY_INVALID')
  return normalized
}

function isoValue(value, fallback = null) {
  const date = value ? new Date(value) : null
  if (date && Number.isFinite(date.getTime())) return date.toISOString()
  return fallback
}

function apiBase(value) {
  const normalized = textValue(value).replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(normalized)) throw new Error('UCS_API_URL_INVALID')
  if (/\/api\/v1$/i.test(normalized)) return normalized
  return `${normalized}/api/v1`
}

function extractResourceId(body = {}) {
  return textValue(body?.id ?? body?.data?.id ?? body?.entity?.id ?? body?.content?.id)
}

export async function requestUcsJson(url, {
  method = 'GET',
  headers = {},
  body,
  expectedStatuses = [200],
  timeoutMs = 30_000,
  refreshHeaders,
} = {}) {
  let requestHeaders = headers
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response
    try {
      response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...requestHeaders,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(Number(timeoutMs) || 30_000),
      })
    } catch (error) {
      throw new Error(`UCS_REQUEST_FAILED:${String(error?.message ?? error)}`)
    }

    const responseText = await response.text()
    let parsed = null
    if (responseText) {
      try {
        parsed = JSON.parse(responseText)
      } catch {
        parsed = responseText
      }
    }
    if (response.status === 401 && attempt === 0 && typeof refreshHeaders === 'function') {
      requestHeaders = await refreshHeaders()
      continue
    }
    if (!expectedStatuses.includes(response.status)) {
      const detail = typeof parsed === 'string'
        ? parsed.slice(0, 1000)
        : textValue(parsed?.details?.join?.('; ') ?? parsed?.message ?? parsed?.error ?? parsed?.detail, response.statusText)
      const error = new Error(`UCS_HTTP_${response.status}:${detail}`)
      error.status = response.status
      error.body = parsed
      throw error
    }
    return {
      ok: true,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: parsed,
    }
  }
  throw new Error('UCS_REQUEST_RETRY_EXHAUSTED')
}

export async function resolveUcsTarget(client, profileKey) {
  const key = textValue(profileKey)
  if (!key) throw new Error('UCS_INTEGRATION_PROFILE_REQUIRED')
  const resolve = () => resolveEuLdtIntegrationTarget(client, key, {
    platformKind: 'use-case-scenarios',
    endpointKey: 'apiBaseUrl',
  })
  const target = await resolve()
  target.refreshAuthHeaders = async () => {
    const refreshed = await resolve()
    target.headers = refreshed.headers
    target.purposeHeaders = refreshed.purposeHeaders
    return target.headers
  }
  return target
}

export async function createUcsResource(target, resourcePath, payload, options = {}) {
  const path = String(resourcePath ?? '').replace(/^\/+/, '')
  const result = await requestUcsJson(`${apiBase(target.endpoint)}/${path}`, {
    method: 'POST',
    headers: target.headers,
    body: payload,
    expectedStatuses: options.expectedStatuses ?? [200, 201],
    timeoutMs: options.timeoutMs,
    refreshHeaders: target.refreshAuthHeaders,
  })
  const id = extractResourceId(result.body)
  if (!id && options.requireId !== false) throw new Error(`UCS_RESOURCE_ID_MISSING:${path}`)
  return { ...result, id }
}

export async function getUcsResource(target, resourcePath, options = {}) {
  const path = String(resourcePath ?? '').replace(/^\/+/, '')
  return requestUcsJson(`${apiBase(target.endpoint)}/${path}`, {
    headers: target.headers,
    expectedStatuses: options.expectedStatuses ?? [200],
    timeoutMs: options.timeoutMs,
    refreshHeaders: target.refreshAuthHeaders,
  })
}

export async function associateUcsScenarios(target, caseId, scenarioIds, options = {}) {
  const result = await createUcsResource(target, 'associations/case-scenario', {
    caseId: textValue(caseId),
    scenarioIds: (Array.isArray(scenarioIds) ? scenarioIds : []).map(String).filter(Boolean),
  }, { ...options, requireId: false })
  return result
}

export async function retrieveUcsDataSource(target, dataSourceId, options = {}) {
  const id = textValue(dataSourceId)
  if (!id) throw new Error('UCS_DATA_SOURCE_ID_REQUIRED')
  const result = await getUcsResource(target, `data-sources/${encodeURIComponent(id)}/retrieve-data`, options)
  return result.body
}

export async function getUcsAiModel(target, { namespace = 'dev', modelName = 'echo-model', timeoutMs } = {}) {
  const normalizedNamespace = textValue(namespace, 'dev')
  const normalizedModelName = textValue(modelName, 'echo-model')
  const result = await getUcsResource(
    target,
    `ai-notebook/models/${encodeURIComponent(normalizedNamespace)}/${encodeURIComponent(normalizedModelName)}`,
    { timeoutMs },
  )
  return result.body ?? {}
}

export async function assertUcsAiModelReady(target, { namespace = 'dev', modelName = 'echo-model', timeoutMs } = {}) {
  const normalizedNamespace = textValue(namespace, 'dev')
  const normalizedModelName = textValue(modelName, 'echo-model')
  const result = await getUcsResource(
    target,
    `ai-notebook/models/${encodeURIComponent(normalizedNamespace)}/${encodeURIComponent(normalizedModelName)}/ready`,
    { timeoutMs },
  )
  if (result.body?.ready !== true) throw new Error(`UCS_AI_MODEL_NOT_READY:${normalizedNamespace}:${normalizedModelName}`)
  return result.body
}

export async function executeUcsExperiment(target, experimentId, options = {}) {
  const id = textValue(experimentId)
  if (!id) throw new Error('UCS_EXPERIMENT_ID_REQUIRED')
  const result = await requestUcsJson(`${apiBase(target.endpoint)}/experiments/${encodeURIComponent(id)}/execute`, {
    method: 'PATCH',
    headers: target.headers,
    body: options.parameters ?? {},
    expectedStatuses: [200, 202],
    timeoutMs: options.timeoutMs,
    refreshHeaders: target.refreshAuthHeaders,
  })
  const executionId = textValue(result.body?.executionId)
  if (!executionId) throw new Error('UCS_EXPERIMENT_EXECUTION_ID_MISSING')
  return { ...result.body, executionId }
}

export async function waitForUcsExecution(target, executionId, options = {}) {
  const id = textValue(executionId)
  if (!id) throw new Error('UCS_EXPERIMENT_EXECUTION_ID_REQUIRED')
  const timeoutMs = boundedInteger(options.timeoutMs, 240_000, 5_000, 1_800_000)
  const pollIntervalMs = boundedInteger(options.pollIntervalMs, 2_000, 250, 30_000)
  const deadline = Date.now() + timeoutMs
  let execution = null
  while (Date.now() < deadline) {
    const result = await getUcsResource(target, `experiment-executions/${encodeURIComponent(id)}`, {
      timeoutMs: Math.min(30_000, timeoutMs),
    })
    execution = result.body ?? {}
    const status = textValue(execution.status).toUpperCase()
    if (TERMINAL_EXECUTION_STATUSES.has(status)) {
      if (status !== 'COMPLETED') {
        const error = new Error(`UCS_EXECUTION_${status}:${textValue(execution.errorMessage, 'UNKNOWN_ERROR')}`)
        error.execution = execution
        throw error
      }
      if (execution.inferenceResponse == null || execution.effectiveOutput == null) {
        throw new Error('UCS_EXECUTION_COMPLETED_WITHOUT_OUTPUT')
      }
      return execution
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }
  const error = new Error(`UCS_EXECUTION_TIMEOUT:${id}:${textValue(execution?.status, 'unknown')}`)
  error.execution = execution
  throw error
}

export function buildUcsScenarioMetricEntity(options = {}) {
  const entityId = textValue(options.entityId)
  if (!entityId) throw new Error('UCS_NGSI_ENTITY_ID_REQUIRED')
  const value = finiteNumber(options.value)
  if (value == null) throw new Error('UCS_SCENARIO_VALUE_REQUIRED')
  const observedAt = isoValue(options.observedAt, new Date().toISOString())
  const unit = textValue(options.unit)
  const scenarioKind = textValue(options.scenarioKind, 'baseline')
  const selection = options.selection ?? null
  return {
    id: entityId,
    type: textValue(options.entityType, 'OldtScenarioMetric'),
    observedValue: {
      type: 'Property',
      value,
      ...(unit ? { unitCode: unit } : {}),
      observedAt,
    },
    scenarioKind: { type: 'Property', value: scenarioKind },
    metricKey: { type: 'Property', value: textValue(options.metricKey, 'result_count') },
    aggregationMethod: { type: 'Property', value: textValue(options.aggregation, 'value') },
    sourceSystem: { type: 'Property', value: 'OLDT' },
    cityId: { type: 'Property', value: textValue(options.cityId) },
    bindingKey: { type: 'Property', value: textValue(options.bindingKey) },
    authorityStatus: { type: 'Property', value: 'derived-scenario-input' },
    observedAt: { type: 'Property', value: observedAt },
    ...(selection ? {
      sourceSelectionId: { type: 'Property', value: String(selection.id) },
      sourceSelectionTitle: { type: 'Property', value: textValue(selection.title) },
      sourceQueryHash: { type: 'Property', value: textValue(selection.query_hash) },
      sourceResultCount: { type: 'Property', value: Number(selection.result_count ?? 0) },
      sourceBounds: { type: 'Property', value: selection.bounds ?? null },
    } : {}),
    '@context': [CORE_CONTEXT],
  }
}

export function buildUcsScenarioDatasetEntity(options = {}) {
  const entityId = textValue(options.entityId)
  if (!entityId) throw new Error('UCS_NGSI_ENTITY_ID_REQUIRED')
  const records = Array.isArray(options.records) ? options.records : []
  if (!records.length) throw new Error('UCS_SCENARIO_DATASET_RECORDS_REQUIRED')
  const observedAt = isoValue(options.observedAt, new Date().toISOString())
  const scenarioKind = textValue(options.scenarioKind, 'baseline')
  const selection = options.selection ?? null
  return {
    id: entityId,
    type: textValue(options.entityType, 'OldtScenarioDataset'),
    records: { type: 'Property', value: records },
    recordCount: { type: 'Property', value: records.length },
    observedValue: { type: 'Property', value: records.length, unitCode: 'objects', observedAt },
    scenarioKind: { type: 'Property', value: scenarioKind },
    sourceSystem: { type: 'Property', value: 'OLDT' },
    cityId: { type: 'Property', value: textValue(options.cityId) },
    bindingKey: { type: 'Property', value: textValue(options.bindingKey) },
    authorityStatus: { type: 'Property', value: 'derived-scenario-input' },
    observedAt: { type: 'Property', value: observedAt },
    assumptions: {
      type: 'Property',
      value: Array.isArray(options.assumptions) ? options.assumptions : [],
    },
    ...(selection ? {
      sourceSelectionId: { type: 'Property', value: String(selection.id) },
      sourceSelectionTitle: { type: 'Property', value: textValue(selection.title) },
      sourceQueryHash: { type: 'Property', value: textValue(selection.query_hash) },
      sourceResultCount: { type: 'Property', value: Number(selection.result_count ?? 0) },
      sourceReturnedCount: { type: 'Property', value: Number(selection.returned_count ?? records.length) },
      sourceBounds: { type: 'Property', value: selection.bounds ?? null },
    } : {}),
    '@context': [CORE_CONTEXT],
  }
}

export async function upsertUcsCaseBinding(client, payload = {}) {
  const bindingKey = normalizedKey(payload.bindingKey)
  const result = await client.query(`
    INSERT INTO ldt_interop.ucs_case_bindings (
      city_id, ucs_profile_key, data_platform_profile_key, selection_set_id,
      binding_key, case_id, scope_id, problem_id, objective_id, key_metric_id,
      baseline_scenario_id, intervention_scenario_id,
      baseline_entity_id, intervention_entity_id,
      baseline_data_source_id, intervention_data_source_id,
      baseline_data_model_id, intervention_data_model_id,
      baseline_experiment_id, intervention_experiment_id,
      baseline_execution_id, intervention_execution_id,
      baseline_value, intervention_value, unit, status,
      baseline_result, intervention_result, source_workflow_run_id, metadata
    ) VALUES (
      $1, $2, $3, NULLIF($4, '')::uuid,
      $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26,
      $27::jsonb, $28::jsonb, NULLIF($29, '')::uuid, $30::jsonb
    )
    ON CONFLICT (ucs_profile_key, binding_key) DO UPDATE SET
      city_id = EXCLUDED.city_id,
      data_platform_profile_key = EXCLUDED.data_platform_profile_key,
      selection_set_id = EXCLUDED.selection_set_id,
      case_id = EXCLUDED.case_id,
      scope_id = EXCLUDED.scope_id,
      problem_id = EXCLUDED.problem_id,
      objective_id = EXCLUDED.objective_id,
      key_metric_id = EXCLUDED.key_metric_id,
      baseline_scenario_id = EXCLUDED.baseline_scenario_id,
      intervention_scenario_id = EXCLUDED.intervention_scenario_id,
      baseline_entity_id = EXCLUDED.baseline_entity_id,
      intervention_entity_id = EXCLUDED.intervention_entity_id,
      baseline_data_source_id = EXCLUDED.baseline_data_source_id,
      intervention_data_source_id = EXCLUDED.intervention_data_source_id,
      baseline_data_model_id = EXCLUDED.baseline_data_model_id,
      intervention_data_model_id = EXCLUDED.intervention_data_model_id,
      baseline_experiment_id = EXCLUDED.baseline_experiment_id,
      intervention_experiment_id = EXCLUDED.intervention_experiment_id,
      baseline_execution_id = EXCLUDED.baseline_execution_id,
      intervention_execution_id = EXCLUDED.intervention_execution_id,
      baseline_value = EXCLUDED.baseline_value,
      intervention_value = EXCLUDED.intervention_value,
      unit = EXCLUDED.unit,
      status = EXCLUDED.status,
      baseline_result = EXCLUDED.baseline_result,
      intervention_result = EXCLUDED.intervention_result,
      source_workflow_run_id = EXCLUDED.source_workflow_run_id,
      metadata = ldt_interop.ucs_case_bindings.metadata || EXCLUDED.metadata,
      updated_at = now()
    RETURNING *
  `, [
    payload.cityId,
    payload.ucsProfileKey,
    payload.dataPlatformProfileKey,
    textValue(payload.selectionSetId),
    bindingKey,
    payload.caseId,
    textValue(payload.scopeId),
    textValue(payload.problemId),
    textValue(payload.objectiveId),
    textValue(payload.keyMetricId),
    payload.baselineScenarioId,
    payload.interventionScenarioId,
    payload.baselineEntityId,
    payload.interventionEntityId,
    payload.baselineDataSourceId,
    payload.interventionDataSourceId,
    payload.baselineDataModelId,
    payload.interventionDataModelId,
    payload.baselineExperimentId,
    payload.interventionExperimentId,
    payload.baselineExecutionId,
    payload.interventionExecutionId,
    finiteNumber(payload.baselineValue),
    finiteNumber(payload.interventionValue),
    textValue(payload.unit),
    textValue(payload.status, 'completed'),
    JSON.stringify(payload.baselineResult ?? {}),
    JSON.stringify(payload.interventionResult ?? {}),
    textValue(payload.sourceWorkflowRunId),
    JSON.stringify(payload.metadata ?? {}),
  ])
  return result.rows[0]
}

function bindingFromRow(row = {}) {
  return {
    id: row.id,
    cityId: row.city_id,
    ucsProfileKey: row.ucs_profile_key,
    dataPlatformProfileKey: row.data_platform_profile_key,
    selectionSetId: row.selection_set_id ?? null,
    selectionTitle: row.selection_title ?? null,
    bindingKey: row.binding_key,
    caseId: row.case_id,
    scopeId: row.scope_id,
    problemId: row.problem_id,
    objectiveId: row.objective_id,
    keyMetricId: row.key_metric_id,
    baselineScenarioId: row.baseline_scenario_id,
    interventionScenarioId: row.intervention_scenario_id,
    baselineEntityId: row.baseline_entity_id,
    interventionEntityId: row.intervention_entity_id,
    baselineDataSourceId: row.baseline_data_source_id,
    interventionDataSourceId: row.intervention_data_source_id,
    baselineDataModelId: row.baseline_data_model_id,
    interventionDataModelId: row.intervention_data_model_id,
    baselineExperimentId: row.baseline_experiment_id,
    interventionExperimentId: row.intervention_experiment_id,
    baselineExecutionId: row.baseline_execution_id,
    interventionExecutionId: row.intervention_execution_id,
    baselineValue: finiteNumber(row.baseline_value),
    interventionValue: finiteNumber(row.intervention_value),
    unit: row.unit,
    status: row.status,
    baselineResult: row.baseline_result ?? {},
    interventionResult: row.intervention_result ?? {},
    sourceWorkflowRunId: row.source_workflow_run_id ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listUcsExchangeState({ cityId, ucsProfileKey = null, limit = 50 } = {}) {
  const normalizedCityId = textValue(cityId)
  if (!normalizedCityId) throw new Error('UCS_CITY_ID_REQUIRED')
  const normalizedLimit = boundedInteger(limit, 50, 1, 500)
  return withClient(async (client) => {
    const params = [normalizedCityId]
    let profileFilter = ''
    if (ucsProfileKey) {
      params.push(textValue(ucsProfileKey))
      profileFilter = `AND binding.ucs_profile_key = $${params.length}`
    }
    params.push(normalizedLimit)
    const result = await client.query(`
      SELECT binding.*, selection.title AS selection_title
      FROM ldt_interop.ucs_case_bindings binding
      LEFT JOIN ldt_analysis.selection_sets selection ON selection.id = binding.selection_set_id
      WHERE binding.city_id = $1
        ${profileFilter}
      ORDER BY binding.updated_at DESC
      LIMIT $${params.length}
    `, params)
    const bindings = result.rows.map(bindingFromRow)
    return {
      ok: true,
      cityId: normalizedCityId,
      ucsProfileKey: ucsProfileKey ? textValue(ucsProfileKey) : null,
      bindings,
      counts: {
        bindings: bindings.length,
        completed: bindings.filter((entry) => entry.status === 'completed').length,
        failed: bindings.filter((entry) => entry.status === 'failed').length,
      },
    }
  })
}

export const ucsInternals = {
  apiBase,
  extractResourceId,
  normalizedKey,
}
