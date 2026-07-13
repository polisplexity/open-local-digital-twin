import {
  getSubjectQueryBlueprint,
  getSubjectQueryInventory,
  listSubjectQueryBlueprints,
  querySubjects,
  recordSubjectQueryRun,
  upsertContextSubject,
  upsertSubjectIndicatorObservation,
  upsertSubjectQueryBlueprint,
  upsertSubjectRelation,
} from '../../db/productionTwinStore/subjectQueryRepository.mjs'

const QUERY_VERSION = '2026-07-12'
const SUBJECT_KINDS = new Set(['city', 'context', 'physical'])
const PRIVACY_CLASSES = new Set(['public', 'aggregate'])
const INDICATOR_OPERATORS = new Set(['exists', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in'])
const VALUE_KINDS = new Set(['numeric', 'boolean', 'ordinal', 'categorical', 'json'])
const VALIDATION_STATUSES = new Set(['candidate', 'validated', 'rejected', 'lab', 'simulated'])
const APPROVED_AUTHORITIES = [
  'authority-approved',
  'municipal-provided',
  'municipal-authoritative',
  'operator-accepted',
  'official',
  'verified',
]

function text(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function object(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback
}

function array(value) {
  if (Array.isArray(value)) return value
  if (value === null || value === undefined || value === '') return []
  return [value]
}

function uniqueTextArray(value, allowed = null, maximum = 100) {
  const values = Array.from(new Set(array(value).map((entry) => text(entry)).filter(Boolean)))
  const filtered = allowed ? values.filter((entry) => allowed.has(entry)) : values
  return filtered.slice(0, maximum)
}

function finite(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function positiveInteger(value, fallback = 500, maximum = 5000) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(1, number))
}

function stableKey(value, fallback = '') {
  const normalized = text(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{1,160}$/.test(normalized)) throw new Error('SUBJECT_QUERY_KEY_INVALID')
  return normalized
}

function isoDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error(`SUBJECT_QUERY_DATE_INVALID:${value}`)
  return date.toISOString()
}

function inferValueKind(indicator = {}) {
  const explicit = text(indicator.valueKind ?? indicator.value_kind)
  if (VALUE_KINDS.has(explicit)) return explicit
  if (typeof indicator.value === 'boolean') return 'boolean'
  if (Number.isFinite(Number(indicator.value))) return 'numeric'
  return 'categorical'
}

function normalizeIndicator(value) {
  const indicator = object(value, null)
  if (!indicator || !text(indicator.key ?? indicator.indicatorKey)) return null
  const operator = text(indicator.operator, 'exists').toLowerCase()
  if (!INDICATOR_OPERATORS.has(operator)) throw new Error(`SUBJECT_QUERY_INDICATOR_OPERATOR_INVALID:${operator}`)
  const valueKind = inferValueKind(indicator)
  const normalized = {
    key: text(indicator.key ?? indicator.indicatorKey),
    bindingKey: text(indicator.bindingKey),
    operator,
    valueKind,
    value: indicator.value ?? null,
    valueMax: indicator.valueMax ?? indicator.max ?? null,
    values: uniqueTextArray(indicator.values ?? indicator.value),
    validationStatuses: uniqueTextArray(
      indicator.validationStatuses ?? indicator.validationStatus ?? ['validated'],
      VALIDATION_STATUSES,
    ),
    authorityStatuses: uniqueTextArray(indicator.authorityStatuses ?? APPROVED_AUTHORITIES),
    scenarioKey: text(indicator.scenarioKey),
  }
  if (!normalized.validationStatuses.length) normalized.validationStatuses = ['validated']
  if (!normalized.authorityStatuses.length) normalized.authorityStatuses = APPROVED_AUTHORITIES
  if (operator === 'between') {
    normalized.value = finite(normalized.value)
    normalized.valueMax = finite(normalized.valueMax)
    if (normalized.value === null || normalized.valueMax === null) throw new Error('SUBJECT_QUERY_INDICATOR_BETWEEN_VALUES_REQUIRED')
  } else if (valueKind === 'numeric' || valueKind === 'ordinal') {
    if (operator !== 'exists') {
      normalized.value = finite(normalized.value)
      if (normalized.value === null) throw new Error('SUBJECT_QUERY_INDICATOR_NUMERIC_VALUE_REQUIRED')
    }
  } else if (valueKind === 'boolean' && operator !== 'exists') {
    normalized.value = normalized.value === true || String(normalized.value).toLowerCase() === 'true'
  } else if (valueKind === 'categorical' && operator === 'in' && !normalized.values.length) {
    throw new Error('SUBJECT_QUERY_INDICATOR_VALUES_REQUIRED')
  }
  return normalized
}

function normalizeRelation(value) {
  const relation = object(value, null)
  if (!relation || !text(relation.type ?? relation.relationType)) return null
  const direction = text(relation.direction, 'outgoing').toLowerCase()
  if (!['outgoing', 'incoming'].includes(direction)) throw new Error(`SUBJECT_QUERY_RELATION_DIRECTION_INVALID:${direction}`)
  return {
    type: text(relation.type ?? relation.relationType),
    direction,
    targetKinds: uniqueTextArray(relation.targetKinds ?? relation.targetKind, SUBJECT_KINDS),
    targetTypes: uniqueTextArray(relation.targetTypes ?? relation.targetType),
    minimumCount: positiveInteger(relation.minimumCount, 1, 1000000),
  }
}

export function normalizeSubjectQuery(payload = {}) {
  const source = object(payload.query, payload)
  const subject = object(source.subject)
  const privacyClasses = uniqueTextArray(subject.privacyClasses ?? subject.privacyClass ?? ['public', 'aggregate'], PRIVACY_CLASSES)
  const normalized = {
    version: QUERY_VERSION,
    language: 'oldt-subject-query',
    subject: {
      kinds: uniqueTextArray(subject.kinds ?? subject.kind ?? ['context', 'city'], SUBJECT_KINDS),
      types: uniqueTextArray(subject.types ?? subject.type),
      domainTypes: uniqueTextArray(subject.domainTypes ?? subject.domainType),
      authorityStatuses: uniqueTextArray(subject.authorityStatuses ?? subject.authorityStatus),
      privacyClasses: privacyClasses.length ? privacyClasses : ['public', 'aggregate'],
    },
    indicator: normalizeIndicator(source.indicator),
    relation: normalizeRelation(source.relation),
    period: {
      from: isoDate(source.period?.from ?? source.periodStart),
      to: isoDate(source.period?.to ?? source.periodEnd),
    },
    render: {
      mode: ['auto', 'map', 'choropleth', 'network', 'chart', 'table'].includes(source.render?.mode)
        ? source.render.mode
        : 'auto',
      maxFeatures: positiveInteger(source.render?.maxFeatures ?? source.limit, 500, 5000),
    },
    limit: positiveInteger(source.limit ?? source.render?.maxFeatures, 500, 5000),
    blueprintId: text(source.blueprintId) || null,
    metadata: object(source.metadata),
  }
  if (!normalized.subject.kinds.length) normalized.subject.kinds = ['context', 'city']
  if (normalized.period.from && normalized.period.to && normalized.period.to < normalized.period.from) {
    throw new Error('SUBJECT_QUERY_PERIOD_INVALID')
  }
  return normalized
}

function geometryFamily(geometryType = '') {
  const normalized = String(geometryType).toLowerCase()
  if (normalized.includes('polygon')) return 'polygon'
  if (normalized.includes('line')) return 'line'
  if (normalized.includes('point')) return 'point'
  return 'none'
}

function resultManifest(query, result) {
  const returned = result.rows.length
  const geometryCounts = result.rows.reduce((counts, row) => {
    const family = geometryFamily(row.geometryType)
    counts[family] = Number(counts[family] ?? 0) + 1
    return counts
  }, {})
  const subjectTypes = Array.from(new Set(result.rows.map((row) => row.subjectType).filter(Boolean)))
  const subjectKinds = Array.from(new Set(result.rows.map((row) => row.subjectKind).filter(Boolean)))
  const spatialCount = returned - Number(geometryCounts.none ?? 0)
  let recommendedRenderers = ['table']
  if (Number(geometryCounts.polygon ?? 0) > 0) recommendedRenderers = ['choropleth', 'map', 'table']
  else if (Number(geometryCounts.line ?? 0) > 0 || Number(geometryCounts.point ?? 0) > 0) recommendedRenderers = ['map', 'table']
  else if (query.relation) recommendedRenderers = ['network', 'table']
  else if (query.indicator) recommendedRenderers = ['chart', 'table']
  const requestedRenderer = query.render.mode === 'auto' ? recommendedRenderers[0] : query.render.mode
  const transport = spatialCount > 0 && requestedRenderer !== 'table' && requestedRenderer !== 'chart' && requestedRenderer !== 'network'
    ? 'geojson'
    : 'table'
  return {
    kind: 'oldt-semantic-result-manifest',
    version: QUERY_VERSION,
    grain: {
      subjectKinds,
      subjectTypes,
      mixed: subjectKinds.length > 1 || subjectTypes.length > 1,
    },
    measures: query.indicator ? [{
      indicatorKey: query.indicator.key,
      valueKind: query.indicator.valueKind,
      operator: query.indicator.operator,
    }] : [],
    dimensions: [
      'subjectKind',
      'subjectType',
      'domainType',
      'authorityStatus',
      ...(query.relation ? ['relationCount'] : []),
      ...(query.indicator?.scenarioKey ? ['scenarioKey'] : []),
    ],
    geometry: {
      spatialCount,
      nonSpatialCount: Number(geometryCounts.none ?? 0),
      countsByFamily: geometryCounts,
    },
    recommendedRenderers,
    selectedRenderer: requestedRenderer,
    transport,
    privacy: {
      exposedClasses: query.subject.privacyClasses,
      excludedClasses: ['restricted', 'personal'],
      posture: 'aggregate-and-public-only',
    },
    portability: {
      queryLanguage: 'oldt-subject-query',
      dependencies: {
        subjectTypes: query.subject.types,
        indicatorKeys: query.indicator ? [query.indicator.key] : [],
        relationTypes: query.relation ? [query.relation.type] : [],
      },
    },
    counts: {
      resultCount: result.total,
      returned,
      truncated: result.total > returned,
    },
  }
}

function tableForRows(rows) {
  return {
    columns: [
      'subjectKey', 'label', 'subjectKind', 'subjectType', 'domainType',
      'indicatorKey', 'value', 'valueText', 'booleanValue', 'unit',
      'numerator', 'denominator', 'relationCount', 'observedAt',
    ],
    rows: rows.map((row) => ({
      subjectKey: row.subjectKey,
      label: row.label,
      subjectKind: row.subjectKind,
      subjectType: row.subjectType,
      domainType: row.domainType,
      indicatorKey: row.indicator?.key ?? null,
      value: row.indicator?.value ?? null,
      valueText: row.indicator?.valueText ?? null,
      booleanValue: row.indicator?.booleanValue ?? null,
      unit: row.indicator?.unit ?? null,
      numerator: row.indicator?.numerator ?? null,
      denominator: row.indicator?.denominator ?? null,
      relationCount: row.relationCount,
      observedAt: row.indicator?.observedAt ?? null,
    })),
  }
}

function geojsonForRows(rows, query) {
  return {
    type: 'FeatureCollection',
    features: rows.filter((row) => row.geometry).map((row) => ({
      type: 'Feature',
      id: row.subjectKey,
      geometry: row.geometry,
      properties: {
        objectId: row.subjectKey,
        stableId: row.subjectKey,
        label: row.label,
        semanticClass: row.subjectType,
        layerKey: row.subjectType,
        queryLayerKey: row.subjectType,
        subjectKind: row.subjectKind,
        subjectType: row.subjectType,
        domainType: row.domainType,
        authorityStatus: row.authorityStatus,
        privacyClass: row.privacyClass,
        indicatorKey: row.indicator?.key ?? null,
        indicatorValue: row.indicator?.value ?? null,
        indicatorValueText: row.indicator?.valueText ?? null,
        indicatorBooleanValue: row.indicator?.booleanValue ?? null,
        indicatorUnit: row.indicator?.unit ?? null,
        numerator: row.indicator?.numerator ?? null,
        denominator: row.indicator?.denominator ?? null,
        relationCount: row.relationCount,
        subjectQueryVersion: query.version,
      },
    })),
  }
}

export async function getCitySubjectQueryContract(cityId) {
  const inventory = await getSubjectQueryInventory(cityId)
  return {
    version: QUERY_VERSION,
    language: 'oldt-subject-query',
    endpoint: `/api/live/${encodeURIComponent(cityId)}/subject-query`,
    blueprintEndpoint: `/api/live/${encodeURIComponent(cityId)}/subject-query-blueprints`,
    subjectKinds: Array.from(SUBJECT_KINDS),
    privacyClasses: Array.from(PRIVACY_CLASSES),
    indicatorOperators: Array.from(INDICATOR_OPERATORS),
    valueKinds: Array.from(VALUE_KINDS),
    relationDirections: ['outgoing', 'incoming'],
    renderers: ['auto', 'map', 'choropleth', 'network', 'chart', 'table'],
    inventory,
    guarantees: {
      noPhysicalAssetDuplication: true,
      honestObservationGrain: true,
      aggregateAndPublicOnly: true,
      portableBlueprintBindings: true,
    },
  }
}

export async function executeCitySubjectQuery(cityId, payload = {}, actorUserId = null) {
  const query = normalizeSubjectQuery(payload)
  const result = await querySubjects(cityId, query)
  const manifest = resultManifest(query, result)
  const table = tableForRows(result.rows)
  const geojson = manifest.transport === 'geojson' ? geojsonForRows(result.rows, query) : null
  const countsBySemanticClass = result.rows.reduce((counts, row) => {
    counts[row.subjectType] = Number(counts[row.subjectType] ?? 0) + 1
    return counts
  }, {})
  const run = await recordSubjectQueryRun(cityId, {
    blueprintId: query.blueprintId,
    query,
    manifest,
    resultCount: result.total,
    actorUserId,
  })
  return {
    configured: true,
    ok: true,
    cityId,
    query: {
      ...query,
      classes: query.subject.types.length ? query.subject.types : ['contextSubjects'],
      render: { ...query.render, transport: manifest.transport },
    },
    manifest,
    transport: manifest.transport,
    summary: {
      resultCount: result.total,
      returned: result.rows.length,
      returnedRows: table.rows.length,
      truncated: result.total > result.rows.length,
      countsBySemanticClass,
      countsBySubjectKind: result.rows.reduce((counts, row) => {
        counts[row.subjectKind] = Number(counts[row.subjectKind] ?? 0) + 1
        return counts
      }, {}),
      geometry: manifest.geometry,
    },
    table,
    ...(geojson ? { geojson } : {}),
    run,
    links: {
      contract: `/api/live/${encodeURIComponent(cityId)}/subject-query-contract`,
      blueprints: `/api/live/${encodeURIComponent(cityId)}/subject-query-blueprints`,
    },
    error: null,
  }
}

function applyBlueprintBinding(queryValue, bindingValue) {
  const query = structuredClone(object(queryValue))
  const binding = object(bindingValue)
  if (query.indicator?.bindingKey && binding.indicators?.[query.indicator.bindingKey]) {
    query.indicator.key = binding.indicators[query.indicator.bindingKey]
  }
  if (Array.isArray(query.subject?.types) && binding.subjectTypes) {
    query.subject.types = query.subject.types.map((entry) => binding.subjectTypes[entry] ?? entry)
  }
  if (query.relation?.type && binding.relationTypes?.[query.relation.type]) {
    query.relation.type = binding.relationTypes[query.relation.type]
  }
  return query
}

export async function executeSubjectQueryBlueprint(cityId, keyOrId, payload = {}, actorUserId = null) {
  const blueprint = await getSubjectQueryBlueprint(cityId, keyOrId)
  if (!blueprint) throw new Error('SUBJECT_QUERY_BLUEPRINT_NOT_FOUND')
  const boundQuery = applyBlueprintBinding(blueprint.query, payload.binding ?? blueprint.binding)
  return executeCitySubjectQuery(cityId, {
    ...boundQuery,
    ...object(payload.overrides),
    blueprintId: blueprint.id,
    metadata: {
      ...object(boundQuery.metadata),
      source: 'subject-query-blueprint',
      blueprintKey: blueprint.blueprintKey,
    },
  }, actorUserId)
}

export async function listCitySubjectQueryBlueprints(cityId, options = {}) {
  const blueprints = await listSubjectQueryBlueprints(cityId, options)
  return { ok: true, cityId, count: blueprints.length, blueprints, error: null }
}

export async function saveCitySubjectQueryBlueprint(cityId, payload = {}, actorUserId = null) {
  const query = normalizeSubjectQuery(payload.query ?? payload)
  const title = text(payload.title, 'Saved semantic question')
  const blueprintKey = stableKey(payload.blueprintKey ?? payload.key, `${title}-${Date.now()}`)
  const blueprint = await upsertSubjectQueryBlueprint(cityId, {
    ...payload,
    global: false,
    blueprintKey,
    title,
    query,
    createdBy: actorUserId ?? payload.createdBy,
  })
  return { ok: true, cityId, blueprint, error: null }
}

function validateContextSubjectPayload(payload = {}) {
  const subjectKey = stableKey(payload.subjectKey ?? payload.key)
  const subjectType = stableKey(payload.subjectType ?? payload.type)
  const privacyClass = text(payload.privacyClass, 'aggregate')
  if (!['public', 'aggregate', 'restricted', 'personal'].includes(privacyClass)) throw new Error('CONTEXT_SUBJECT_PRIVACY_INVALID')
  if (payload.geometry && (typeof payload.geometry !== 'object' || !payload.geometry.type)) throw new Error('CONTEXT_SUBJECT_GEOMETRY_INVALID')
  return { ...payload, subjectKey, subjectType, privacyClass }
}

export async function saveContextSubject(cityId, payload = {}) {
  return { ok: true, cityId, subject: await upsertContextSubject(cityId, validateContextSubjectPayload(payload)), error: null }
}

export async function saveSubjectRelation(cityId, payload = {}) {
  const relationKey = stableKey(payload.relationKey ?? payload.key)
  const relationType = stableKey(payload.relationType ?? payload.type)
  if (!object(payload.source).key || !object(payload.target).key) throw new Error('SUBJECT_RELATION_ENDPOINTS_REQUIRED')
  return { ok: true, cityId, relation: await upsertSubjectRelation(cityId, { ...payload, relationKey, relationType }), error: null }
}

export async function saveSubjectIndicatorObservation(cityId, payload = {}) {
  const observationKey = stableKey(payload.observationKey ?? payload.key)
  const indicatorKey = text(payload.indicatorKey)
  if (!indicatorKey) throw new Error('SUBJECT_INDICATOR_KEY_REQUIRED')
  const valueKind = text(payload.valueKind, 'numeric')
  if (!VALUE_KINDS.has(valueKind)) throw new Error('SUBJECT_INDICATOR_VALUE_KIND_INVALID')
  if (payload.denominator !== undefined && finite(payload.denominator) === 0) throw new Error('SUBJECT_INDICATOR_DENOMINATOR_ZERO')
  return {
    ok: true,
    cityId,
    observation: await upsertSubjectIndicatorObservation(cityId, {
      ...payload,
      observationKey,
      indicatorKey,
      valueKind,
    }),
    error: null,
  }
}
