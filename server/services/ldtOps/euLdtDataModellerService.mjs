const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_OUTPUT_FIELD = 'synthetic_score'

function textValue(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function clampNumber(value, fallback, minimum, maximum) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(minimum, Math.min(numeric, maximum))
}

function safeFieldName(value, fallback = 'field') {
  const normalized = textValue(value, fallback)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || fallback
}

function normalizeEntityType(value) {
  const normalized = textValue(value, 'building').toLowerCase()
  if (normalized === 'buildings') return 'building'
  if (normalized === 'roads') return 'road'
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(normalized)) throw new Error('DATA_MODELLER_ENTITY_TYPE_INVALID')
  return normalized
}

function dataModellerApiBase(value) {
  const normalized = textValue(value).replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(normalized)) throw new Error('DATA_MODELLER_API_URL_INVALID')
  if (/\/api\/v1$/i.test(normalized)) return normalized
  return `${normalized}/api/v1`
}

function requestHeaders(headers = {}) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(headers ?? {}),
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: requestHeaders(options.headers),
    signal: options.signal ?? AbortSignal.timeout(Number(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)),
  })
  const text = await response.text()
  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: text.slice(0, 2_000) }
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body,
  }
}

function scalarEntries(row = {}) {
  const attributes = row.attributes && typeof row.attributes === 'object' && !Array.isArray(row.attributes)
    ? row.attributes
    : {}
  return {
    entity_type: row.entity_type,
    semantic_class: row.semantic_class,
    layer_key: row.layer_key,
    authority_status: row.authority_status,
    confidence: row.confidence,
    ...attributes,
  }
}

function observedValues(rows, key) {
  return rows
    .map((row) => scalarEntries(row)[key])
    .filter((value) => value !== null && value !== undefined && value !== '')
}

function categoricalWeights(values) {
  const counts = new Map()
  for (const rawValue of values) {
    const value = String(rawValue).slice(0, 255)
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return Object.fromEntries([...counts.entries()].slice(0, 32))
}

function synthFieldFromValues(values) {
  if (!values.length) return null
  const optional = values.some((value) => value == null)
  const present = values.filter((value) => value !== null && value !== undefined && value !== '')
  if (!present.length) return null

  if (present.every((value) => typeof value === 'boolean')) {
    return {
      type: 'bool',
      frequency: present.filter(Boolean).length / present.length,
      ...(optional ? { optional: true } : {}),
    }
  }

  if (present.every((value) => typeof value === 'number' && Number.isFinite(value))) {
    const low = Math.min(...present)
    const high = Math.max(...present)
    if (low === high) {
      return {
        type: 'number',
        subtype: Number.isInteger(low) ? 'i64' : 'f64',
        constant: low,
        ...(optional ? { optional: true } : {}),
      }
    }
    const integers = present.every(Number.isInteger)
    return {
      type: 'number',
      subtype: integers ? 'i64' : 'f64',
      range: {
        low,
        high,
        step: integers ? 1 : Math.max(Number(((high - low) / 100).toFixed(6)), 0.000001),
      },
      ...(optional ? { optional: true } : {}),
    }
  }

  const primitive = present.filter((value) => ['string', 'number', 'boolean'].includes(typeof value))
  if (!primitive.length) return null
  return {
    type: 'string',
    categorical: categoricalWeights(primitive),
    ...(optional ? { optional: true } : {}),
  }
}

function prioritizedFieldKeys(rows) {
  const priority = [
    'entity_type',
    'semantic_class',
    'layer_key',
    'buildingType',
    'roadClass',
    'heightMeters',
    'floors',
    'footprintAreaM2',
    'sapScore',
    'energyLabel',
    'landUseClass',
    'category',
    'weatherAirTemperatureC',
    'weatherWindSpeedMs',
  ]
  const available = new Set(rows.flatMap((row) => Object.keys(scalarEntries(row))))
  return [
    ...priority.filter((key) => available.has(key)),
    ...[...available].filter((key) => !priority.includes(key)).sort(),
  ]
}

export async function selectDataModellerCanonicalRows(client, { cityId, entityType, limit = 25 } = {}) {
  const normalizedCityId = textValue(cityId)
  if (!normalizedCityId) throw new Error('CITY_ID_REQUIRED')
  const normalizedEntityType = normalizeEntityType(entityType)
  const normalizedLimit = Math.floor(clampNumber(limit, 25, 1, 250))
  const result = await client.query(
    `
      SELECT
        co.id::text AS entity_id,
        co.stable_id,
        co.entity_type,
        co.semantic_class,
        co.layer_key,
        co.label,
        co.authority_status,
        co.confidence,
        jsonb_strip_nulls(to_jsonb(co) - 'id' - 'city_id' - 'stable_id' - 'geom') AS attributes
      FROM ldt_query.city_objects_enriched co
      WHERE co.city_id = $1
        AND co.entity_type = $2
        AND co.geom IS NOT NULL
      ORDER BY co.stable_id, co.id
      LIMIT $3
    `,
    [normalizedCityId, normalizedEntityType, normalizedLimit],
  )
  return {
    cityId: normalizedCityId,
    entityType: normalizedEntityType,
    limit: normalizedLimit,
    rows: result.rows,
  }
}

export function buildDataModellerSynthSchema(rows = [], options = {}) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('DATA_MODELLER_CANONICAL_SAMPLE_EMPTY')
  const outputField = safeFieldName(options.outputField, DEFAULT_OUTPUT_FIELD)
  const outputMinimum = clampNumber(options.outputMinimum, 0, -1_000_000, 1_000_000)
  const outputMaximum = clampNumber(options.outputMaximum, 100, outputMinimum + 0.000001, 1_000_000)
  const maxFields = Math.floor(clampNumber(options.maxFields, 14, 1, 32))
  const content = { type: 'object' }
  const fieldMap = {}

  for (const sourceKey of prioritizedFieldKeys(rows)) {
    if (Object.keys(content).length - 1 >= maxFields) break
    const targetKey = safeFieldName(sourceKey)
    if (!targetKey || targetKey === outputField || content[targetKey]) continue
    const values = rows.map((row) => scalarEntries(row)[sourceKey])
    const field = synthFieldFromValues(values)
    if (!field) continue
    content[targetKey] = field
    fieldMap[targetKey] = sourceKey
  }

  content[outputField] = {
    type: 'number',
    subtype: 'f64',
    range: {
      low: outputMinimum,
      high: outputMaximum,
      step: Math.max(Number(((outputMaximum - outputMinimum) / 100).toFixed(6)), 0.000001),
    },
  }
  fieldMap[outputField] = null

  return {
    schema: {
      type: 'array',
      length: { type: 'number', subtype: 'u64', constant: rows.length },
      content,
    },
    fieldMap,
    outputField,
    sampleCount: rows.length,
  }
}

export function buildDataModellerSchemaPayload(rows = [], options = {}) {
  const inferred = buildDataModellerSynthSchema(rows, options)
  const referenceName = safeFieldName(options.referenceName, `oldt_${textValue(options.entityType, 'city_objects')}`)
  return {
    payload: {
      name: textValue(options.schemaName, `OLDT ${textValue(options.entityType, 'city objects')} synthetic fixture`),
      referenceName,
      version: textValue(options.version, '1.0.0'),
      ownership: textValue(options.ownership, 'OLDT operator'),
      tags: Array.isArray(options.tags) ? options.tags.map(String).filter(Boolean) : ['OLDT', 'EU LDT'],
      description: textValue(options.description, 'Synth-compatible fixture schema inferred from an OLDT canonical city-object sample.'),
      privacyDisclaimer: textValue(options.privacyDisclaimer, 'Synthetic fixture only; canonical identifiers and geometries are excluded.'),
      transparencyNotes: textValue(options.transparencyNotes, 'Generated by an operator-approved OLDT workflow. Approval remains in Data Modeller.'),
      copyrightInfo: textValue(options.copyrightInfo, 'Source metadata follows the configured OLDT city data licences.'),
      publishDate: null,
      status: 'COMPLETED',
      JSON: JSON.stringify(inferred.schema),
      refSchemaIds: [],
      validate: true,
      isAutoGenerated: true,
    },
    ...inferred,
    referenceName,
  }
}

export async function createDataModellerSchema({ endpoint, headers, payload, timeoutMs } = {}) {
  const apiBase = dataModellerApiBase(endpoint)
  const response = await fetchJson(`${apiBase}/schemas`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    timeoutMs,
  })
  if (!response.ok) throw new Error(`DATA_MODELLER_SCHEMA_CREATE_HTTP_${response.status}`)
  const schemaId = textValue(response.body?.id ?? response.body?.data?.id ?? response.body?.entity?.id)
  if (!schemaId) throw new Error('DATA_MODELLER_SCHEMA_ID_MISSING')
  return { ...response, apiBase, schemaId }
}

export async function getDataModellerSchema({ endpoint, headers, schemaId, timeoutMs } = {}) {
  const normalizedSchemaId = textValue(schemaId)
  if (!normalizedSchemaId) throw new Error('DATA_MODELLER_SCHEMA_ID_REQUIRED')
  const apiBase = dataModellerApiBase(endpoint)
  const response = await fetchJson(`${apiBase}/schemas/${encodeURIComponent(normalizedSchemaId)}`, {
    method: 'GET',
    headers,
    timeoutMs,
  })
  if (!response.ok) throw new Error(`DATA_MODELLER_SCHEMA_READ_HTTP_${response.status}`)
  return { ...response, apiBase, schema: response.body }
}

export function assertDataModellerSchemaApproved(schema = {}, minimumEvaluationScore = 80) {
  const threshold = clampNumber(minimumEvaluationScore, 80, 0, 100)
  const evaluationScore = Number(schema.evaluationScore ?? schema.evaluation_score ?? 0)
  const isApproved = schema.isApproved === true || schema.is_approved === true
  if (!isApproved) throw new Error('DATA_MODELLER_SCHEMA_NOT_APPROVED')
  if (!Number.isFinite(evaluationScore) || evaluationScore < threshold) {
    throw new Error(`DATA_MODELLER_SCHEMA_SCORE_BELOW_THRESHOLD:${evaluationScore}:${threshold}`)
  }
  return { isApproved, evaluationScore, minimumEvaluationScore: threshold }
}

export async function generateDataModellerFixture({ endpoint, headers, schemaId, recordCount = 25, timeoutMs } = {}) {
  const normalizedSchemaId = textValue(schemaId)
  if (!normalizedSchemaId) throw new Error('DATA_MODELLER_SCHEMA_ID_REQUIRED')
  const normalizedRecordCount = Math.floor(clampNumber(recordCount, 25, 1, 1_000))
  const apiBase = dataModellerApiBase(endpoint)
  const response = await fetchJson(`${apiBase}/data-generator`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ schemaId: normalizedSchemaId, recordCount: normalizedRecordCount }),
    timeoutMs,
  })
  if (!response.ok) throw new Error(`DATA_MODELLER_GENERATE_HTTP_${response.status}`)
  const syntheticData = response.body?.syntheticData ?? response.body?.synthetic_data ?? {}
  const referenceName = textValue(response.body?.schema?.referenceName ?? response.body?.schema?.reference_name)
  const records = referenceName && Array.isArray(syntheticData?.[referenceName])
    ? syntheticData[referenceName]
    : Object.values(syntheticData ?? {}).find(Array.isArray) ?? []
  if (!Array.isArray(records) || records.length === 0) throw new Error('DATA_MODELLER_GENERATED_FIXTURE_EMPTY')
  return {
    ...response,
    apiBase,
    recordCount: normalizedRecordCount,
    referenceName,
    records,
  }
}

export function dataModellerOutputValue(record = {}, outputField = DEFAULT_OUTPUT_FIELD) {
  const parts = textValue(outputField, DEFAULT_OUTPUT_FIELD).split('.').filter(Boolean)
  let value = record
  for (const part of parts) value = value && typeof value === 'object' ? value[part] : undefined
  if (value === undefined) throw new Error(`DATA_MODELLER_OUTPUT_FIELD_MISSING:${outputField}`)
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { value, valueNumeric: value, valueText: null, valueJson: { value } }
  }
  if (typeof value === 'string') {
    return { value, valueNumeric: null, valueText: value, valueJson: { value } }
  }
  if (typeof value === 'boolean') {
    return { value, valueNumeric: null, valueText: String(value), valueJson: { value } }
  }
  return { value, valueNumeric: null, valueText: null, valueJson: { value } }
}

export const dataModellerInternals = {
  dataModellerApiBase,
  normalizeEntityType,
  safeFieldName,
}
