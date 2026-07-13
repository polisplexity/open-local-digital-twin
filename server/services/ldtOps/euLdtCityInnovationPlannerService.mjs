import { withClient } from './dbUtils.mjs'
import { resolveEuLdtIntegrationTarget } from './euLdtIntegrationService.mjs'

const CORE_CONTEXT = 'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.9.jsonld'
const ALLOWED_AGGREGATIONS = new Set(['value', 'count', 'avg', 'sum', 'min', 'max'])

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

function normalizedKey(value, fallback = 'cip-binding') {
  const normalized = textValue(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{1,128}$/.test(normalized)) throw new Error('CIP_BINDING_KEY_INVALID')
  return normalized
}

function normalizedProperty(value, fallback = 'observedValue') {
  const normalized = textValue(value, fallback).replace(/[^A-Za-z0-9_]+/g, '')
  if (!/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(normalized)) throw new Error('CIP_NGSI_PROPERTY_INVALID')
  return normalized
}

function normalizedFormulaParameter(value, fallback = 'OldtValue') {
  const normalized = textValue(value, fallback).replace(/[^A-Za-z0-9_]+/g, '')
  if (!/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(normalized)) throw new Error('CIP_FORMULA_PARAMETER_INVALID')
  return normalized
}

function isoValue(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function resourceUrl(target, endpointKey, resourcePath) {
  const explicit = textValue(target.profile?.endpoints?.[endpointKey])
  if (explicit) return explicit.replace(/\/+$/, '')
  return `${target.endpoint.replace(/\/+$/, '')}/${String(resourcePath).replace(/^\/+/, '')}`
}

let cipRequestGate = Promise.resolve()
let lastCipRequestAt = 0

async function waitForCipRequestSlot(minIntervalMs) {
  const previous = cipRequestGate
  let release
  cipRequestGate = new Promise((resolve) => { release = resolve })
  await previous
  const waitMs = Math.max(0, Number(minIntervalMs) - (Date.now() - lastCipRequestAt))
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs))
  lastCipRequestAt = Date.now()
  release()
}

export async function requestCipJson(url, {
  method = 'GET',
  headers = {},
  body,
  expectedStatuses = [200],
  timeoutMs = 15000,
  maxRetries = 6,
  minIntervalMs = Number(process.env.EU_LDT_CIP_MIN_REQUEST_INTERVAL_MS || 0),
} = {}) {
  const retries = Math.max(0, Math.min(10, Number(maxRetries) || 0))
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await waitForCipRequestSlot(minIntervalMs)
    let response
    try {
      response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(Number(timeoutMs) || 15000),
      })
    } catch (error) {
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(10000, 500 * (2 ** attempt))))
        continue
      }
      throw new Error(`CIP_REQUEST_FAILED:${String(error?.message ?? error)}`)
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
    if (expectedStatuses.includes(response.status)) {
      return {
        ok: true,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: parsed,
      }
    }
    if ([429, 502, 503, 504].includes(response.status) && attempt < retries) {
      const retryAfterSeconds = Number(response.headers.get('retry-after'))
      const retryMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : Math.min(30000, 1000 * (2 ** attempt))
      await new Promise((resolve) => setTimeout(resolve, retryMs))
      continue
    }
    const detail = typeof parsed === 'string'
      ? parsed.slice(0, 500)
      : textValue(parsed?.message ?? parsed?.error ?? parsed?.detail, response.statusText)
    const error = new Error(`CIP_HTTP_${response.status}:${detail}`)
    error.status = response.status
    error.body = parsed
    throw error
  }
  throw new Error('CIP_RETRY_EXHAUSTED')
}

export async function resolveCipTarget(client, profileKey) {
  const key = textValue(profileKey)
  if (!key) throw new Error('CIP_INTEGRATION_PROFILE_REQUIRED')
  return resolveEuLdtIntegrationTarget(client, key, {
    platformKind: 'city-innovation-planner',
    endpointKey: 'apiBaseUrl',
  })
}

export async function fetchCipCollection(target, resource, options = {}) {
  const endpointKeys = {
    kpis: 'kpisUrl',
    'kpi-measurements': 'kpiMeasurementsUrl',
    initiatives: 'initiativesUrl',
  }
  const baseUrl = resourceUrl(target, endpointKeys[resource], resource)
  const pageSize = boundedInteger(options.pageSize ?? options.size, 100, 1, 500)
  const maxPages = boundedInteger(options.maxPages, 20, 1, 200)
  const content = []
  let page = 0
  let total = null
  while (page < maxPages) {
    const url = new URL(baseUrl)
    url.searchParams.set('page', String(page))
    url.searchParams.set('size', String(pageSize))
    const result = await requestCipJson(url.toString(), { headers: target.headers })
    const rows = Array.isArray(result.body?.content) ? result.body.content : []
    content.push(...rows)
    total = finiteNumber(result.body?.metadata?.total, total)
    if (!rows.length || rows.length < pageSize || (total != null && content.length >= total)) break
    page += 1
  }
  return {
    content,
    metadata: {
      total: total ?? content.length,
      fetched: content.length,
      pageSize,
      pages: page + 1,
    },
  }
}

export async function getCipKpi(target, kpiId) {
  const id = textValue(kpiId)
  if (!id) throw new Error('CIP_KPI_ID_REQUIRED')
  const url = `${resourceUrl(target, 'kpisUrl', 'kpis')}/${encodeURIComponent(id)}`
  const result = await requestCipJson(url, { headers: target.headers })
  return result.body ?? {}
}

function datasourceMatches(datasource = {}, config = {}) {
  return datasource.connectorType === 'broker'
    && textValue(datasource.config?.entityId) === config.entityId
    && textValue(datasource.formulaParameter) === config.formulaParameter
}

export async function ensureCipBrokerDatasource(target, options = {}) {
  const property = normalizedProperty(options.ngsiProperty)
  const formulaParameter = normalizedFormulaParameter(options.formulaParameter)
  const entityId = textValue(options.ngsiEntityId)
  const scope = textValue(options.ngsiScope)
  const entityType = textValue(options.ngsiEntityType, 'KeyPerformanceIndicatorSource')
  const kpiName = textValue(options.kpiName, `OLDT ${formulaParameter}`).slice(0, 50)
  const kpiU4SSCCode = textValue(options.kpiU4SSCCode ?? options.u4sscCode)
  const u4sscStandard = options.u4sscStandard === true || Boolean(kpiU4SSCCode)
  if (!entityId) throw new Error('CIP_NGSI_ENTITY_ID_REQUIRED')

  const datasource = {
    name: textValue(options.datasourceName, `OLDT ${formulaParameter}`).slice(0, 50),
    resultJsonPath: textValue(options.resultJsonPath, `$.${property}.value`),
    formulaParameter,
    connectorType: 'broker',
    config: {
      entityId,
      scope,
      type: entityType,
      datatype: 'context',
      entity: entityId,
    },
  }

  let kpiId = textValue(options.cipKpiId)
  let kpi = null
  let createdKpi = false
  let reusedKpi = false
  if (!kpiId) {
    if (options.createKpi === false) throw new Error('CIP_KPI_ID_REQUIRED')
    const existing = options.reuseKpiLookup === false
      ? { content: [] }
      : await fetchCipCollection(target, 'kpis', { pageSize: 200, maxPages: 10 })
    const match = existing.content.find((entry) => (
      (kpiU4SSCCode && textValue(entry?.kpiU4SSCCode) === kpiU4SSCCode)
      || textValue(entry?.name).toLowerCase() === kpiName.toLowerCase()
    ))
    if (match?.id) {
      if (kpiU4SSCCode && textValue(match.kpiU4SSCCode) !== kpiU4SSCCode) {
        throw new Error(`CIP_KPI_NAME_CONFLICT:${kpiName}`)
      }
      kpiId = textValue(match.id)
      kpi = await getCipKpi(target, kpiId)
      reusedKpi = true
    }
  }
  if (!kpiId) {
    const payload = {
      name: kpiName,
      description: textValue(options.kpiDescription, 'KPI backed by an explainable OLDT metric source published through EU LDT Data Platform.').slice(0, 255),
      unit: textValue(options.unit) || null,
      status: textValue(options.kpiStatus, 'SAVED'),
      type: textValue(options.kpiType, 'STANDARD'),
      frequency: textValue(options.frequency, 'DAILY'),
      calculationFormula: textValue(options.calculationFormula, `mean(${formulaParameter})`),
      u4sscStandard,
      kpiU4SSCCode: kpiU4SSCCode || null,
    }
    const result = await requestCipJson(resourceUrl(target, 'kpisUrl', 'kpis'), {
      method: 'POST',
      headers: target.headers,
      body: payload,
      expectedStatuses: [200, 201],
    })
    kpiId = textValue(result.body?.id)
    if (!kpiId) throw new Error('CIP_KPI_CREATE_ID_MISSING')
    createdKpi = true
    kpi = await getCipKpi(target, kpiId)
  } else if (!kpi) {
    kpi = await getCipKpi(target, kpiId)
  }

  if (kpiU4SSCCode && (
    kpi?.u4sscStandard !== true
    || textValue(kpi?.kpiU4SSCCode) !== kpiU4SSCCode
  )) {
    throw new Error(`CIP_U4SSC_BINDING_MISMATCH:${kpiU4SSCCode}`)
  }

  let remoteDatasource = (Array.isArray(kpi?.datasources) ? kpi.datasources : [])
    .find((entry) => datasourceMatches(entry, { entityId, formulaParameter }))
  let createdDatasource = false
  if (!remoteDatasource) {
    const result = await requestCipJson(`${target.endpoint.replace(/\/+$/, '')}/datasources`, {
      method: 'POST',
      headers: target.headers,
      body: { ...datasource, kpiId },
      expectedStatuses: [200, 201],
    })
    remoteDatasource = { ...datasource, id: result.body?.id ?? '', kpiId }
    createdDatasource = true
  }

  return {
    kpiId,
    kpiName: textValue(kpi?.name, options.kpiName),
    datasourceId: textValue(remoteDatasource?.id),
    datasource: remoteDatasource,
    createdKpi,
    reusedKpi,
    createdDatasource,
    u4sscStandard: Boolean(kpi?.u4sscStandard),
    kpiU4SSCCode: textValue(kpi?.kpiU4SSCCode),
  }
}

export async function requestCipKpiCalculation(target, kpiId) {
  const url = `${resourceUrl(target, 'kpisUrl', 'kpis')}/${encodeURIComponent(kpiId)}/calculate`
  const result = await requestCipJson(url, { headers: target.headers })
  return result.body ?? { success: true }
}

export async function resolveSelectionMetric(client, options = {}) {
  const cityId = textValue(options.cityId)
  if (!cityId) throw new Error('CIP_CITY_ID_REQUIRED')
  const explicitValue = finiteNumber(options.value)
  const selectionSetId = textValue(options.selectionSetId)
  const aggregation = textValue(options.aggregation, explicitValue == null ? 'value' : 'value').toLowerCase()
  if (!ALLOWED_AGGREGATIONS.has(aggregation)) throw new Error('CIP_AGGREGATION_INVALID')

  if (explicitValue != null && !selectionSetId) {
    return {
      value: explicitValue,
      aggregation: 'value',
      sampleSize: 1,
      selection: null,
      source: 'operator-value',
    }
  }
  if (!selectionSetId) throw new Error('CIP_SELECTION_SET_OR_VALUE_REQUIRED')

  const selectionResult = await client.query(`
    SELECT id, city_id, title, query_hash, source_query, scope, semantic_classes,
           result_count, returned_count, bounds, metrics, created_at, updated_at
    FROM ldt_analysis.selection_sets
    WHERE id = $1::uuid AND city_id = $2
  `, [selectionSetId, cityId])
  if (!selectionResult.rowCount) throw new Error('CIP_SELECTION_SET_NOT_FOUND')
  const selection = selectionResult.rows[0]

  const metricKey = textValue(options.metricKey)
  const attributeKey = textValue(options.attributeKey)
  if (explicitValue != null) {
    return {
      value: explicitValue,
      aggregation: 'value',
      sampleSize: Number(selection.returned_count ?? selection.result_count ?? 1),
      selection,
      source: 'operator-value-with-selection',
    }
  }
  if (metricKey) {
    const metricResult = await client.query(`
      SELECT metric_key, label, value, unit, properties
      FROM ldt_analysis.selection_metrics
      WHERE selection_set_id = $1::uuid AND metric_key = $2
    `, [selectionSetId, metricKey])
    if (!metricResult.rowCount || finiteNumber(metricResult.rows[0].value) == null) {
      throw new Error(`CIP_SELECTION_METRIC_NOT_FOUND:${metricKey}`)
    }
    return {
      value: finiteNumber(metricResult.rows[0].value),
      aggregation: 'value',
      sampleSize: Number(selection.returned_count ?? selection.result_count ?? 1),
      selection,
      metric: metricResult.rows[0],
      source: 'selection-metric',
    }
  }
  if (attributeKey) {
    const aggregate = aggregation === 'value' ? 'avg' : aggregation
    const aggregateResult = await client.query(`
      WITH numeric_values AS (
        SELECT CASE
          WHEN replace(attributes ->> $2, ',', '.') ~ '^-?[0-9]+([.][0-9]+)?$'
            THEN replace(attributes ->> $2, ',', '.')::numeric
          ELSE NULL
        END AS value
        FROM ldt_analysis.selection_set_members
        WHERE selection_set_id = $1::uuid
      )
      SELECT
        count(value)::int AS sample_count,
        CASE $3
          WHEN 'count' THEN count(value)::numeric
          WHEN 'sum' THEN sum(value)
          WHEN 'min' THEN min(value)
          WHEN 'max' THEN max(value)
          ELSE avg(value)
        END AS aggregate_value
      FROM numeric_values
    `, [selectionSetId, attributeKey, aggregate])
    const value = finiteNumber(aggregateResult.rows[0]?.aggregate_value)
    if (value == null) throw new Error(`CIP_SELECTION_ATTRIBUTE_NOT_NUMERIC:${attributeKey}`)
    return {
      value,
      aggregation: aggregate,
      sampleSize: Number(aggregateResult.rows[0]?.sample_count ?? 0),
      selection,
      attributeKey,
      source: 'selection-member-attribute',
    }
  }

  return {
    value: Number(selection.result_count ?? 0),
    aggregation: 'count',
    sampleSize: Number(selection.returned_count ?? selection.result_count ?? 0),
    selection,
    metric: { metric_key: 'result_count', unit: 'objects' },
    source: 'selection-result-count',
  }
}

export function buildCipMetricSourceEntity(options = {}) {
  const property = normalizedProperty(options.ngsiProperty)
  const entityId = textValue(options.ngsiEntityId)
  if (!entityId) throw new Error('CIP_NGSI_ENTITY_ID_REQUIRED')
  const value = finiteNumber(options.value)
  if (value == null) throw new Error('CIP_METRIC_VALUE_REQUIRED')
  const selection = options.selection ?? null
  const unit = textValue(options.unit ?? options.metric?.unit)
  const observedAt = isoValue(options.observedAt) ?? new Date().toISOString()
  const indicatorKey = textValue(options.indicatorKey)
  const indicatorExternalCode = textValue(options.indicatorExternalCode ?? options.kpiU4SSCCode)
  const indicatorCatalogKey = textValue(options.indicatorCatalogKey)
  const indicatorValueKind = textValue(options.indicatorValueKind, 'numeric')
  const payload = {
    id: entityId,
    type: textValue(options.ngsiEntityType, 'KeyPerformanceIndicatorSource'),
    [property]: {
      type: 'Property',
      value,
      ...(unit ? { unitCode: unit } : {}),
      observedAt,
    },
    observedAt: { type: 'Property', value: observedAt },
    aggregationMethod: { type: 'Property', value: textValue(options.aggregation, 'value') },
    sampleSize: { type: 'Property', value: Math.max(0, Number(options.sampleSize ?? 0)) },
    sourceSystem: { type: 'Property', value: 'OLDT' },
    sourceKind: { type: 'Property', value: textValue(options.source, 'oldt-metric') },
    cityId: { type: 'Property', value: textValue(options.cityId) },
    bindingKey: { type: 'Property', value: textValue(options.bindingKey) },
    authorityStatus: { type: 'Property', value: 'derived-planning-input' },
    ...(indicatorKey ? { indicatorKey: { type: 'Property', value: indicatorKey } } : {}),
    ...(indicatorExternalCode ? { indicatorExternalCode: { type: 'Property', value: indicatorExternalCode } } : {}),
    ...(indicatorCatalogKey ? { indicatorCatalogKey: { type: 'Property', value: indicatorCatalogKey } } : {}),
    ...(indicatorValueKind ? { indicatorValueKind: { type: 'Property', value: indicatorValueKind } } : {}),
    ...(selection ? {
      sourceSelectionId: { type: 'Property', value: String(selection.id) },
      sourceSelectionTitle: { type: 'Property', value: textValue(selection.title) },
      sourceQueryHash: { type: 'Property', value: textValue(selection.query_hash) },
      sourceResultCount: { type: 'Property', value: Number(selection.result_count ?? 0) },
      sourceBounds: { type: 'Property', value: selection.bounds ?? null },
    } : {}),
    '@context': [CORE_CONTEXT],
  }
  return payload
}

async function requestDataPlatformJson(url, { method = 'GET', headers = {}, body, expectedStatuses = [200], scope = '' } = {}) {
  const requestHeaders = {
    Accept: 'application/ld+json, application/json',
    ...(body === undefined ? {} : { 'Content-Type': 'application/ld+json' }),
    ...(scope ? { scope } : {}),
    ...headers,
  }
  let response
  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
  } catch (error) {
    throw new Error(`DATA_PLATFORM_REQUEST_FAILED:${String(error?.message ?? error)}`)
  }
  const text = await response.text()
  let parsed = null
  if (text) {
    try { parsed = JSON.parse(text) } catch { parsed = text }
  }
  if (!expectedStatuses.includes(response.status)) {
    const detail = typeof parsed === 'string' ? parsed.slice(0, 500) : textValue(parsed?.detail ?? parsed?.message, response.statusText)
    const error = new Error(`DATA_PLATFORM_HTTP_${response.status}:${detail}`)
    error.status = response.status
    error.body = parsed
    throw error
  }
  return { ok: true, status: response.status, body: parsed }
}

export async function publishCipMetricSourceToDataPlatform(target, payload, options = {}) {
  const base = target.endpoint.replace(/\/+$/, '')
  const entityUrl = `${base}/api/v1/entities/${encodeURIComponent(payload.id)}`
  const scope = textValue(options.scope)
  let exists = false
  try {
    await requestDataPlatformJson(entityUrl, { headers: target.headers, scope })
    exists = true
  } catch (error) {
    if (Number(error?.status) !== 404) throw error
  }

  if (exists) {
    const attributes = { ...payload }
    delete attributes.id
    await requestDataPlatformJson(entityUrl, {
      method: 'PATCH',
      headers: target.headers,
      body: attributes,
      expectedStatuses: [200, 204],
      scope,
    })
  } else {
    await requestDataPlatformJson(`${base}/api/v1/entities`, {
      method: 'POST',
      headers: target.headers,
      body: payload,
      expectedStatuses: [200, 201],
      scope,
    })
  }
  const readback = await requestDataPlatformJson(entityUrl, { headers: target.headers, scope })
  return {
    created: !exists,
    updated: exists,
    entityId: payload.id,
    status: readback.status,
    entity: readback.body,
  }
}

export async function upsertCipMetricBinding(client, payload = {}) {
  const bindingKey = normalizedKey(payload.bindingKey)
  const aggregation = textValue(payload.aggregation, 'value').toLowerCase()
  if (!ALLOWED_AGGREGATIONS.has(aggregation)) throw new Error('CIP_AGGREGATION_INVALID')
  const result = await client.query(`
    INSERT INTO ldt_interop.cip_metric_bindings (
      city_id, cip_profile_key, data_platform_profile_key, selection_set_id,
      cip_kpi_id, cip_datasource_id, binding_key, kpi_name, formula_parameter,
      result_json_path, ngsi_entity_id, ngsi_entity_type, ngsi_scope, ngsi_property,
      aggregation, metric_key, attribute_key, unit, status, last_published_value,
      last_published_at, last_verified_at, source_workflow_run_id, metadata
    )
    VALUES (
      $1, $2, $3, NULLIF($4, '')::uuid,
      $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19, $20,
      $21, $22, NULLIF($23, '')::uuid, $24::jsonb
    )
    ON CONFLICT (cip_profile_key, binding_key) DO UPDATE SET
      city_id = EXCLUDED.city_id,
      data_platform_profile_key = EXCLUDED.data_platform_profile_key,
      selection_set_id = EXCLUDED.selection_set_id,
      cip_kpi_id = EXCLUDED.cip_kpi_id,
      cip_datasource_id = EXCLUDED.cip_datasource_id,
      kpi_name = EXCLUDED.kpi_name,
      formula_parameter = EXCLUDED.formula_parameter,
      result_json_path = EXCLUDED.result_json_path,
      ngsi_entity_id = EXCLUDED.ngsi_entity_id,
      ngsi_entity_type = EXCLUDED.ngsi_entity_type,
      ngsi_scope = EXCLUDED.ngsi_scope,
      ngsi_property = EXCLUDED.ngsi_property,
      aggregation = EXCLUDED.aggregation,
      metric_key = EXCLUDED.metric_key,
      attribute_key = EXCLUDED.attribute_key,
      unit = EXCLUDED.unit,
      status = EXCLUDED.status,
      last_published_value = EXCLUDED.last_published_value,
      last_published_at = EXCLUDED.last_published_at,
      last_verified_at = EXCLUDED.last_verified_at,
      source_workflow_run_id = EXCLUDED.source_workflow_run_id,
      metadata = ldt_interop.cip_metric_bindings.metadata || EXCLUDED.metadata,
      updated_at = now()
    RETURNING *
  `, [
    payload.cityId,
    payload.cipProfileKey,
    payload.dataPlatformProfileKey,
    textValue(payload.selectionSetId),
    payload.cipKpiId,
    textValue(payload.cipDatasourceId),
    bindingKey,
    textValue(payload.kpiName),
    normalizedFormulaParameter(payload.formulaParameter),
    textValue(payload.resultJsonPath, `$.${normalizedProperty(payload.ngsiProperty)}.value`),
    payload.ngsiEntityId,
    textValue(payload.ngsiEntityType, 'KeyPerformanceIndicatorSource'),
    textValue(payload.ngsiScope),
    normalizedProperty(payload.ngsiProperty),
    aggregation,
    textValue(payload.metricKey),
    textValue(payload.attributeKey),
    textValue(payload.unit),
    textValue(payload.status, 'active'),
    finiteNumber(payload.lastPublishedValue),
    isoValue(payload.lastPublishedAt),
    isoValue(payload.lastVerifiedAt),
    textValue(payload.sourceWorkflowRunId),
    JSON.stringify(payload.metadata ?? {}),
  ])
  return result.rows[0]
}

async function upsertCipIndicatorObservation(client, options = {}) {
  const indicatorKey = textValue(options.binding?.metadata?.indicatorKey)
  const measurementId = textValue(options.measurement?.id)
  const measure = finiteNumber(options.measurement?.measure)
  if (!indicatorKey || !measurementId || measure == null) return null
  if (textValue(options.measurement?.status).toLowerCase() !== 'success') return null

  const definition = await client.query(`
    SELECT id, indicator_key, unit
    FROM ldt_science.indicator_definitions
    WHERE indicator_key = $1 AND active IS DISTINCT FROM false
    LIMIT 1
  `, [indicatorKey])
  if (!definition.rowCount) return null

  const observedAt = isoValue(options.measurement?.measureDate) ?? new Date().toISOString()
  const observationKey = `cip:${textValue(options.cipProfileKey)}:${measurementId}`
  const result = await client.query(`
    INSERT INTO ldt_science.indicator_observations (
      city_id, indicator_id, observation_key, geography_level, observed_at,
      period_start, period_end, value_kind, value, value_json, unit,
      quality, validation_status, authority_status, source_ref, source_quality,
      method, metadata, updated_at
    ) VALUES (
      $1, $2, $3, 'city', $4,
      $4, $4, 'numeric', $5, $6::jsonb, $7,
      'external-integration-lab', 'lab', 'integration-lab', $8,
      'cip-calculated-readback', $9::jsonb, $10::jsonb, now()
    )
    ON CONFLICT (observation_key) DO UPDATE SET
      observed_at=EXCLUDED.observed_at,
      period_start=EXCLUDED.period_start,
      period_end=EXCLUDED.period_end,
      value=EXCLUDED.value,
      value_json=EXCLUDED.value_json,
      unit=EXCLUDED.unit,
      quality=EXCLUDED.quality,
      validation_status=EXCLUDED.validation_status,
      authority_status=EXCLUDED.authority_status,
      source_ref=EXCLUDED.source_ref,
      source_quality=EXCLUDED.source_quality,
      method=EXCLUDED.method,
      metadata=EXCLUDED.metadata,
      updated_at=now()
    RETURNING *
  `, [
    options.cityId,
    definition.rows[0].id,
    observationKey,
    observedAt,
    measure,
    JSON.stringify({
      value: measure,
      cipMeasurementId: measurementId,
      cipKpiId: textValue(options.measurement?.kpiId),
      remoteStatus: textValue(options.measurement?.status),
    }),
    textValue(options.binding?.unit, definition.rows[0].unit),
    `cip:${textValue(options.cipProfileKey)}:${measurementId}`,
    JSON.stringify({
      calculation: 'EU LDT City Innovation Planner KPI calculation',
      transport: 'EU LDT Data Platform NGSI-LD broker datasource',
      bindingId: options.binding?.id ?? null,
    }),
    JSON.stringify({
      indicatorKey,
      externalCode: textValue(options.binding?.metadata?.indicatorExternalCode),
      catalogKey: textValue(options.binding?.metadata?.indicatorCatalogKey),
      cipProfileKey: textValue(options.cipProfileKey),
      cipKpiId: textValue(options.measurement?.kpiId),
      cipMeasurementId: measurementId,
      bindingKey: textValue(options.binding?.metadata?.bindingKey),
      integrationEvidence: true,
      standardValueIsNotOfficial: true,
      remotePayload: options.measurement ?? {},
    }),
  ])
  return result.rows[0]
}

export async function storeCipMeasurementReceipts(client, options = {}) {
  const cityId = textValue(options.cityId)
  const profileKey = textValue(options.cipProfileKey)
  const runId = textValue(options.sourceWorkflowRunId)
  const measurements = Array.isArray(options.measurements) ? options.measurements : []
  const kpiMap = options.kpiMap instanceof Map ? options.kpiMap : new Map()
  let inserted = 0
  let updated = 0
  let bound = 0
  let observationsUpserted = 0
  const receipts = []
  const observations = []
  for (const measurement of measurements) {
    const measurementId = textValue(measurement?.id)
    const kpiId = textValue(measurement?.kpiId)
    if (!measurementId || !kpiId) continue
    const bindingResult = await client.query(`
      SELECT id, unit, metadata FROM ldt_interop.cip_metric_bindings
      WHERE city_id = $1 AND cip_profile_key = $2 AND cip_kpi_id = $3 AND status = 'active'
      ORDER BY updated_at DESC LIMIT 1
    `, [cityId, profileKey, kpiId])
    const binding = bindingResult.rows[0] ?? null
    const bindingId = binding?.id ?? null
    if (!bindingId && options.includeUnbound !== true) continue
    if (bindingId) bound += 1
    const existed = await client.query(`
      SELECT id FROM ldt_interop.cip_measurement_receipts
      WHERE cip_profile_key = $1 AND cip_measurement_id = $2
    `, [profileKey, measurementId])
    const result = await client.query(`
      INSERT INTO ldt_interop.cip_measurement_receipts (
        city_id, cip_profile_key, binding_id, cip_kpi_id, cip_measurement_id,
        measure_date, measure, status, failing_reason, errors, kpi_snapshot,
        remote_payload, source_workflow_run_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, NULLIF($13, '')::uuid)
      ON CONFLICT (cip_profile_key, cip_measurement_id) DO UPDATE SET
        binding_id = COALESCE(EXCLUDED.binding_id, ldt_interop.cip_measurement_receipts.binding_id),
        cip_kpi_id = EXCLUDED.cip_kpi_id,
        measure_date = EXCLUDED.measure_date,
        measure = EXCLUDED.measure,
        status = EXCLUDED.status,
        failing_reason = EXCLUDED.failing_reason,
        errors = EXCLUDED.errors,
        kpi_snapshot = EXCLUDED.kpi_snapshot,
        remote_payload = EXCLUDED.remote_payload,
        source_workflow_run_id = EXCLUDED.source_workflow_run_id,
        last_received_at = now(),
        updated_at = now()
      RETURNING *
    `, [
      cityId,
      profileKey,
      bindingId,
      kpiId,
      measurementId,
      isoValue(measurement.measureDate),
      finiteNumber(measurement.measure),
      textValue(measurement.status),
      textValue(measurement.failingReason),
      textValue(measurement.errors),
      JSON.stringify(kpiMap.get(kpiId) ?? {}),
      JSON.stringify(measurement),
      runId,
    ])
    if (existed.rowCount) updated += 1
    else inserted += 1
    receipts.push(result.rows[0])
    const observation = await upsertCipIndicatorObservation(client, {
      cityId,
      cipProfileKey: profileKey,
      binding,
      measurement,
    })
    if (observation) {
      observationsUpserted += 1
      observations.push(observation)
    }
  }
  return { inserted, updated, bound, observationsUpserted, receipts, observations }
}

export async function storeCipInitiativeLinks(client, options = {}) {
  const cityId = textValue(options.cityId)
  const profileKey = textValue(options.cipProfileKey)
  const runId = textValue(options.sourceWorkflowRunId)
  const initiatives = Array.isArray(options.initiatives) ? options.initiatives : []
  const explicitLinks = new Map((Array.isArray(options.links) ? options.links : [])
    .map((entry) => [textValue(entry?.initiativeId ?? entry?.cipInitiativeId), textValue(entry?.selectionSetId)]))
  let inserted = 0
  let updated = 0
  let linked = 0
  const rows = []
  for (const initiative of initiatives) {
    const initiativeId = textValue(initiative?.id)
    if (!initiativeId) continue
    const selectionSetId = explicitLinks.get(initiativeId) ?? ''
    if (selectionSetId) {
      const selection = await client.query(
        'SELECT id FROM ldt_analysis.selection_sets WHERE id = $1::uuid AND city_id = $2',
        [selectionSetId, cityId],
      )
      if (!selection.rowCount) throw new Error(`CIP_INITIATIVE_SELECTION_NOT_FOUND:${initiativeId}`)
      linked += 1
    }
    const existed = await client.query(`
      SELECT id FROM ldt_interop.cip_initiative_links
      WHERE cip_profile_key = $1 AND cip_initiative_id = $2
    `, [profileKey, initiativeId])
    const result = await client.query(`
      INSERT INTO ldt_interop.cip_initiative_links (
        city_id, cip_profile_key, cip_initiative_id, selection_set_id,
        name, description, initiative_status, progress_status, percentage_progress,
        global_risk_score, budget, start_date, end_date, remote_updated_at,
        initiative_snapshot, link_metadata, source_workflow_run_id, last_synced_at
      )
      VALUES (
        $1, $2, $3, NULLIF($4, '')::uuid,
        $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15::jsonb, $16::jsonb, NULLIF($17, '')::uuid, now()
      )
      ON CONFLICT (cip_profile_key, cip_initiative_id) DO UPDATE SET
        city_id = EXCLUDED.city_id,
        selection_set_id = COALESCE(EXCLUDED.selection_set_id, ldt_interop.cip_initiative_links.selection_set_id),
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        initiative_status = EXCLUDED.initiative_status,
        progress_status = EXCLUDED.progress_status,
        percentage_progress = EXCLUDED.percentage_progress,
        global_risk_score = EXCLUDED.global_risk_score,
        budget = EXCLUDED.budget,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        remote_updated_at = EXCLUDED.remote_updated_at,
        initiative_snapshot = EXCLUDED.initiative_snapshot,
        link_metadata = ldt_interop.cip_initiative_links.link_metadata || EXCLUDED.link_metadata,
        source_workflow_run_id = EXCLUDED.source_workflow_run_id,
        last_synced_at = now(),
        updated_at = now()
      RETURNING *
    `, [
      cityId,
      profileKey,
      initiativeId,
      selectionSetId,
      textValue(initiative.name),
      textValue(initiative.description),
      textValue(initiative.status),
      textValue(initiative.progressStatus),
      finiteNumber(initiative.percentageProgress),
      textValue(initiative.globalRiskScore),
      finiteNumber(initiative.budget),
      isoValue(initiative.startDate),
      isoValue(initiative.endDate),
      isoValue(initiative.updatedAt),
      JSON.stringify(initiative),
      JSON.stringify(selectionSetId ? { linkedBy: 'explicit-workflow-input' } : {}),
      runId,
    ])
    if (existed.rowCount) updated += 1
    else inserted += 1
    rows.push(result.rows[0])
  }
  return { inserted, updated, linked, rows }
}

function bindingFromRow(row = {}) {
  return {
    id: row.id,
    cityId: row.city_id,
    cipProfileKey: row.cip_profile_key,
    dataPlatformProfileKey: row.data_platform_profile_key,
    selectionSetId: row.selection_set_id,
    cipKpiId: row.cip_kpi_id,
    cipDatasourceId: row.cip_datasource_id,
    bindingKey: row.binding_key,
    kpiName: row.kpi_name,
    formulaParameter: row.formula_parameter,
    resultJsonPath: row.result_json_path,
    ngsiEntityId: row.ngsi_entity_id,
    ngsiEntityType: row.ngsi_entity_type,
    ngsiScope: row.ngsi_scope,
    ngsiProperty: row.ngsi_property,
    aggregation: row.aggregation,
    metricKey: row.metric_key,
    attributeKey: row.attribute_key,
    unit: row.unit,
    status: row.status,
    lastPublishedValue: row.last_published_value == null ? null : Number(row.last_published_value),
    lastPublishedAt: row.last_published_at,
    lastVerifiedAt: row.last_verified_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function receiptFromRow(row = {}) {
  return {
    id: row.id,
    cityId: row.city_id,
    cipProfileKey: row.cip_profile_key,
    bindingId: row.binding_id,
    cipKpiId: row.cip_kpi_id,
    cipMeasurementId: row.cip_measurement_id,
    measureDate: row.measure_date,
    measure: row.measure == null ? null : Number(row.measure),
    status: row.status,
    failingReason: row.failing_reason,
    errors: row.errors,
    kpiSnapshot: row.kpi_snapshot ?? {},
    remotePayload: row.remote_payload ?? {},
    lastReceivedAt: row.last_received_at,
  }
}

function initiativeFromRow(row = {}) {
  return {
    id: row.id,
    cityId: row.city_id,
    cipProfileKey: row.cip_profile_key,
    cipInitiativeId: row.cip_initiative_id,
    selectionSetId: row.selection_set_id,
    selectionTitle: row.selection_title ?? null,
    name: row.name,
    description: row.description,
    initiativeStatus: row.initiative_status,
    progressStatus: row.progress_status,
    percentageProgress: row.percentage_progress == null ? null : Number(row.percentage_progress),
    globalRiskScore: row.global_risk_score,
    budget: row.budget == null ? null : Number(row.budget),
    startDate: row.start_date,
    endDate: row.end_date,
    remoteUpdatedAt: row.remote_updated_at,
    initiativeSnapshot: row.initiative_snapshot ?? {},
    linkMetadata: row.link_metadata ?? {},
    lastSyncedAt: row.last_synced_at,
  }
}

export async function listCipExchangeState(filters = {}) {
  return withClient(async (client) => {
    const cityId = textValue(filters.cityId, 'guanajuato')
    const profileKey = textValue(filters.cipProfileKey ?? filters.profileKey)
    const limit = boundedInteger(filters.limit, 50, 1, 250)
    const params = [cityId, limit]
    const profileClause = profileKey ? `AND cip_profile_key = $${params.push(profileKey)}` : ''
    const bindings = await client.query(`
      SELECT * FROM ldt_interop.cip_metric_bindings
      WHERE city_id = $1 ${profileClause}
      ORDER BY updated_at DESC LIMIT $2
    `, params)
    const receipts = await client.query(`
      SELECT * FROM ldt_interop.cip_measurement_receipts
      WHERE city_id = $1 ${profileClause}
      ORDER BY measure_date DESC NULLS LAST, last_received_at DESC LIMIT $2
    `, params)
    const initiatives = await client.query(`
      SELECT initiative.*, selection.title AS selection_title
      FROM ldt_interop.cip_initiative_links initiative
      LEFT JOIN ldt_analysis.selection_sets selection ON selection.id = initiative.selection_set_id
      WHERE initiative.city_id = $1 ${profileClause.replaceAll('cip_profile_key', 'initiative.cip_profile_key')}
      ORDER BY initiative.last_synced_at DESC LIMIT $2
    `, params)
    return {
      ok: true,
      cityId,
      profileKey: profileKey || null,
      bindings: bindings.rows.map(bindingFromRow),
      measurements: receipts.rows.map(receiptFromRow),
      initiatives: initiatives.rows.map(initiativeFromRow),
      counts: {
        bindings: bindings.rowCount,
        measurements: receipts.rowCount,
        initiatives: initiatives.rowCount,
        linkedInitiatives: initiatives.rows.filter((row) => row.selection_set_id).length,
      },
    }
  })
}

export async function linkCipInitiativeSelection(payload = {}) {
  return withClient(async (client) => {
    const cityId = textValue(payload.cityId, 'guanajuato')
    const profileKey = textValue(payload.cipProfileKey ?? payload.profileKey)
    const initiativeId = textValue(payload.cipInitiativeId ?? payload.initiativeId)
    const selectionSetId = textValue(payload.selectionSetId)
    if (!profileKey || !initiativeId || !selectionSetId) throw new Error('CIP_INITIATIVE_LINK_FIELDS_REQUIRED')
    const selection = await client.query(
      'SELECT id, title FROM ldt_analysis.selection_sets WHERE id = $1::uuid AND city_id = $2',
      [selectionSetId, cityId],
    )
    if (!selection.rowCount) throw new Error('CIP_INITIATIVE_SELECTION_NOT_FOUND')
    const result = await client.query(`
      UPDATE ldt_interop.cip_initiative_links
      SET selection_set_id = $4::uuid,
          link_metadata = link_metadata || $5::jsonb,
          updated_at = now()
      WHERE city_id = $1 AND cip_profile_key = $2 AND cip_initiative_id = $3
      RETURNING *
    `, [
      cityId,
      profileKey,
      initiativeId,
      selectionSetId,
      JSON.stringify({ linkedBy: textValue(payload.linkedBy, 'oldt-operator'), linkedAt: new Date().toISOString() }),
    ])
    if (!result.rowCount) throw new Error('CIP_INITIATIVE_NOT_SYNCED')
    return { ok: true, initiative: initiativeFromRow({ ...result.rows[0], selection_title: selection.rows[0].title }) }
  })
}
