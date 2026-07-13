import {
  DEFAULT_TWIN_QUERY_RUNTIME_CLASS_KEYS,
  normalizeTwinQueryRuntimeClassKeys,
  normalizeTwinQuerySemanticClassFilterValue,
  semanticVocabularyContract,
  twinQueryRuntimeClassContractKeys,
} from '../semanticLayer/semanticVocabularyAdapter.mjs'

const DEFAULT_QUERY_CLASSES = DEFAULT_TWIN_QUERY_RUNTIME_CLASS_KEYS
const DEFAULT_QUERY_LIMIT = integerEnv('TWIN_STUDIO_TWIN_QUERY_DEFAULT_LIMIT', 300000)
const MAX_QUERY_LIMIT = integerEnv('TWIN_STUDIO_TWIN_QUERY_MAX_LIMIT', 300000)
const MAX_QUERY_CLAUSES = 8

const FIELD_DEFINITIONS = [
  ['object_id', 'co.object_id', 'text', ['objectId', 'stable_id', 'stableId', 'id']],
  ['semantic_class', 'co.semantic_class', 'text', ['semanticClass', 'class']],
  ['layer_key', 'co.display_layer_key', 'text', ['layerKey', 'display_layer_key', 'displayLayerKey']],
  ['entity_type', 'co.entity_type', 'text', ['entityType', 'type']],
  ['label', 'co.label', 'text', ['name']],
  ['authority_status', 'co.authority_status', 'text', ['authorityStatus']],
  ['confidence', 'co.confidence', 'text', []],
  ['source_coverage_status', 'co.source_coverage_status', 'text', ['sourceCoverageStatus']],
  ['provider', 'co.provider', 'text', []],
  ['source_format', 'co.source_format', 'text', ['sourceFormat']],
  ['source_family', 'co.source_family', 'text', ['sourceFamily']],
  ['road_class', 'co.road_class', 'text', ['roadClass', 'highway']],
  ['building_type', 'co.building_type', 'text', ['buildingType', 'building']],
  ['height_m', 'co.height_m', 'number', ['height', 'heightMeters', 'heightMetersValue']],
  ['floors', 'co.floors', 'number', ['levels', 'buildingLevels']],
  ['land_use_class', 'co.land_use_class', 'text', ['landUseClass', 'landUseCategory', 'landuse']],
  ['category', 'co.category', 'text', []],
  ['place_type', 'co.place_type', 'text', ['placeType']],
  ['footprint_area_m2', 'co.footprint_area_m2', 'number', ['footprintAreaM2', 'area_m2', 'areaM2']],
  ['sap_score', 'co.sap_score', 'number', ['sapScore', 'ecoBuildSapScore', 'euLdtSapScore']],
  ['energy_label', 'co.energy_label', 'text', ['energyLabel', 'ecoBuildEnergyLabel', 'euLdtEnergyLabel']],
  ['built_form_proxy', 'co.built_form_proxy', 'number', ['builtIntensity', 'builtFormProxy']],
  ['heat_proxy', 'co.heat_proxy', 'number', ['heatProxy', 'thermalProxy']],
  ['air_roughness_proxy', 'co.air_roughness_proxy', 'number', ['airflowFriction', 'airProxy', 'windProxy']],
  ['green_blue_cooling_proxy', 'co.green_blue_cooling_proxy', 'number', ['greenBlueCooling', 'coolingProxy']],
  ['solar_exposure_proxy', 'co.solar_exposure_proxy', 'number', ['solarExposureProxy', 'sunProxy']],
  ['water_flow_proxy', 'co.water_flow_proxy', 'number', ['waterFlowProxy', 'waterProxy']],
  ['hydrology_surface_water_signal', "NULLIF(co.environmental_observations->>'hydrology_surface_water_signal', '')::numeric", 'number', ['surfaceWaterSignal', 'hydrologySignal', 'waterSignal']],
  ['surface_runoff_screening', "NULLIF(co.environmental_observations->>'surface_runoff_screening', '')::numeric", 'number', ['surfaceRunoffScreening', 'runoffScreening', 'runoffRisk', 'rainRunoff', 'runoff']],
  ['weather_air_temperature_c', 'co.weather_air_temperature_c', 'number', ['airTemperature', 'temperatureC', 'weatherTemperature']],
  ['weather_wind_speed_ms', 'co.weather_wind_speed_ms', 'number', ['windSpeedMs', 'weatherWindSpeed']],
  ['weather_wind_direction_deg', 'co.weather_wind_direction_deg', 'number', ['windDirectionDeg', 'weatherWindDirection']],
  ['geometry_type', 'co.geometry_type', 'text', ['geometryType']],
  ['updated_at', 'co.updated_at', 'text', ['updatedAt']],
]

const FIELD_BY_ALIAS = new Map()
for (const [field, sql, type, aliases] of FIELD_DEFINITIONS) {
  FIELD_BY_ALIAS.set(field.toLowerCase(), { field, sql, type })
  for (const alias of aliases) {
    FIELD_BY_ALIAS.set(String(alias).toLowerCase(), { field, sql, type })
  }
}

const TEXT_OPERATORS = new Set(['eq', 'neq', 'in', 'contains', 'exists'])
const NUMBER_OPERATORS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'between', 'exists'])
const VALID_SCOPES = new Set(['city', 'radius', 'viewport', 'customPolygon'])
const VALID_RENDER_MODES = new Set(['count', 'isolate', 'highlight', 'table'])
const VALID_RENDER_TRANSPORTS = new Set(['metadata', 'mvt', 'cesium-primitives', 'scene-manifest', 'selection-reference', 'geojson', 'table'])
const VALID_LANGUAGES = new Set(['twinql-json', 'cql2-json', 'postgis-sql'])
const VALID_QUERY_OPERATIONS = new Set(['union'])
const INDICATOR_VALUE_KINDS = new Set(['numeric', 'boolean', 'ordinal', 'categorical', 'json'])
const INDICATOR_OPERATORS = new Set(['exists', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in'])
const INDICATOR_SUBJECT_MODES = new Set(['self', 'city'])
const RELATED_SUBJECT_MODES = new Set(['spatial', 'explicit', 'any'])
const DEFAULT_INDICATOR_VALIDATION_STATUSES = ['validated', 'lab', 'simulated']
const DEFAULT_INDICATOR_AUTHORITY_STATUSES = [
  'authority-approved',
  'municipal-provided',
  'municipal-authoritative',
  'operator-accepted',
  'official',
  'verified',
  'integration-lab',
  'development-synthetic',
]
const MAX_POSTGIS_SQL_WHERE_LENGTH = 4000
const MAX_POSTGIS_SQL_TEXT_LENGTH = 12000
const FORBIDDEN_POSTGIS_SQL_PATTERNS = [
  /;/,
  /--/,
  /\/\*/,
  /\*\//,
  /\$\$/,
  /\b(select|insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|execute|call|do|set|reset|vacuum|analyze|merge|into|from|join|union|with)\b/i,
  /\b(pg_|information_schema|current_setting|pg_sleep|dblink|lo_|http_|file|program)\b/i,
]
const FORBIDDEN_POSTGIS_SELECT_SQL_PATTERNS = [
  /;/,
  /--/,
  /\/\*/,
  /\*\//,
  /\$\$/,
  /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|execute|call|do|set|reset|vacuum|analyze|merge|into)\b/i,
  /\b(pg_|information_schema|current_setting|pg_sleep|dblink|lo_|http_|file|program)\b/i,
]
const ALLOWED_POSTGIS_SELECT_SCHEMAS = new Set([
  'ldt_query',
  'ldt_enrichment',
  'ldt_analysis',
  'ldt_viewer',
  'ldt_core',
])

function integerEnv(name, fallback) {
  const number = Math.trunc(Number(process.env[name]))
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function clampInteger(value, fallback, min, max) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function parseJsonish(value, fallback = null) {
  if (value == null || value === '') return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch {
    return fallback
  }
}

function normalizeTextArray(value, fallback = []) {
  if (Array.isArray(value)) {
    const values = value.map((entry) => compactText(entry)).filter(Boolean)
    return values.length ? values : fallback
  }
  const parsed = parseJsonish(value, null)
  if (Array.isArray(parsed)) return normalizeTextArray(parsed, fallback)
  const values = String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return values.length ? values : fallback
}

function normalizePoint(value) {
  if (value == null || value === '') return null
  const raw = Array.isArray(value) ? value : String(value).split(',')
  const numbers = raw.map(finiteNumber)
  if (numbers.length !== 2 || numbers.some((entry) => entry == null)) return null
  const [lon, lat] = numbers
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null
  return [lon, lat]
}

function normalizeBbox(value) {
  if (value == null || value === '') return null
  const raw = Array.isArray(value) ? value : String(value).split(',')
  const numbers = raw.map(finiteNumber)
  if (numbers.length !== 4 || numbers.some((entry) => entry == null)) return null
  const [minLon, minLat, maxLon, maxLat] = numbers
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90 || minLon >= maxLon || minLat >= maxLat) return null
  return [minLon, minLat, maxLon, maxLat]
}

function normalizeScope(rawScope = {}, source = {}) {
  const scope = rawScope && typeof rawScope === 'object' ? { ...rawScope } : {}
  const key = compactText(
    scope.key ?? scope.type ?? scope.mode ?? source.scopeKey ?? source.scopeType ?? source.scope,
    source.bbox ? 'viewport' : 'city',
  )
  const normalizedKey = key === 'bbox' ? 'viewport' : key
  if (!VALID_SCOPES.has(normalizedKey)) return { key: 'city' }

  if (normalizedKey === 'radius') {
    const center = normalizePoint(scope.center ?? source.center)
    const radiusMeters = finiteNumber(scope.radiusMeters ?? scope.radius ?? source.radiusMeters ?? source.radius)
    if (!center || radiusMeters == null || radiusMeters <= 0) {
      throw new Error('TWIN_QUERY_RADIUS_REQUIRES_CENTER_AND_POSITIVE_RADIUS')
    }
    return { key: 'radius', center, radiusMeters }
  }

  if (normalizedKey === 'viewport') {
    const bbox = normalizeBbox(scope.bbox ?? source.bbox)
    if (!bbox) throw new Error('TWIN_QUERY_VIEWPORT_REQUIRES_BBOX')
    return { key: 'viewport', bbox }
  }

  if (normalizedKey === 'customPolygon') {
    const geometry = scope.geometry ?? parseJsonish(source.geometry, null)
    if (!geometry || typeof geometry !== 'object') {
      throw new Error('TWIN_QUERY_CUSTOM_POLYGON_REQUIRES_GEOJSON_GEOMETRY')
    }
    return { key: 'customPolygon', geometry }
  }

  return { key: 'city' }
}

function normalizeRender(rawRender = {}, source = {}) {
  const render = rawRender && typeof rawRender === 'object' ? rawRender : {}
  const mode = compactText(render.mode ?? source.renderMode ?? source.mode, 'isolate')
  const transport = compactText(render.transport ?? source.transport, '')
  return {
    mode: VALID_RENDER_MODES.has(mode) ? mode : 'isolate',
    ...(VALID_RENDER_TRANSPORTS.has(transport) ? { transport } : {}),
    maxFeatures: clampInteger(
      render.maxFeatures ?? source.maxFeatures ?? source.limit,
      DEFAULT_QUERY_LIMIT,
      0,
      MAX_QUERY_LIMIT,
    ),
  }
}

function normalizeLanguage(value) {
  const language = compactText(value, 'twinql-json')
  return VALID_LANGUAGES.has(language) ? language : 'twinql-json'
}

function normalizePostgisSqlWhere(value) {
  const sql = compactText(value)
  if (!sql) return ''
  const withoutLeadingWhere = sql.replace(/^\s*where\b/i, '').trim()
  if (!withoutLeadingWhere) return ''
  if (withoutLeadingWhere.length > MAX_POSTGIS_SQL_WHERE_LENGTH) {
    throw new Error('POSTGIS_SQL_WHERE_TOO_LONG')
  }
  const forbidden = FORBIDDEN_POSTGIS_SQL_PATTERNS.find((pattern) => pattern.test(withoutLeadingWhere))
  if (forbidden) {
    throw new Error('POSTGIS_SQL_WHERE_UNSAFE_TOKEN')
  }
  return withoutLeadingWhere
}

function unquoteIdentifier(value) {
  return String(value ?? '').replace(/^"|"$/g, '').replace(/""/g, '"')
}

function normalizeRelationToken(value) {
  return String(value ?? '').trim().replace(/,$/, '').replace(/\s+.*$/, '')
}

export function isPostgisSelectSql(value) {
  const sql = compactText(value)
  return /^(select|with)\b/i.test(sql)
}

export function normalizePostgisSqlText(value) {
  const sql = compactText(value)
  if (!sql) return ''
  if (!isPostgisSelectSql(sql)) return ''
  if (sql.length > MAX_POSTGIS_SQL_TEXT_LENGTH) {
    throw new Error('POSTGIS_SQL_TEXT_TOO_LONG')
  }
  const forbidden = FORBIDDEN_POSTGIS_SELECT_SQL_PATTERNS.find((pattern) => pattern.test(sql))
  if (forbidden) {
    throw new Error('POSTGIS_SQL_TEXT_UNSAFE_TOKEN')
  }

  const relationPattern = /\b(from|join)\s+((?:"[^"]+"|[a-z_][a-z0-9_]*)(?:\s*\.\s*(?:"[^"]+"|[a-z_][a-z0-9_]*))?|\()/ig
  let relationMatch = relationPattern.exec(sql)
  while (relationMatch) {
    const relation = normalizeRelationToken(relationMatch[2])
    if (relation && relation !== '(' && relation.includes('.')) {
      const [schema] = relation.split('.').map((part) => unquoteIdentifier(part.trim()))
      if (!ALLOWED_POSTGIS_SELECT_SCHEMAS.has(schema)) {
        throw new Error(`POSTGIS_SQL_SCHEMA_NOT_ALLOWED:${schema}`)
      }
    }
    relationMatch = relationPattern.exec(sql)
  }

  return sql
}

function normalizeOperation(value) {
  const operation = compactText(value, 'union').toLowerCase()
  return VALID_QUERY_OPERATIONS.has(operation) ? operation : 'union'
}

function fieldDefinition(field) {
  const key = compactText(field).toLowerCase()
  const definition = FIELD_BY_ALIAS.get(key)
  if (!definition) throw new Error(`TWIN_QUERY_UNSUPPORTED_FIELD:${field}`)
  return definition
}

function normalizeOperator(value) {
  const op = compactText(value, 'eq').toLowerCase()
  const aliases = {
    '=': 'eq',
    '==': 'eq',
    eq: 'eq',
    is: 'eq',
    '!=': 'neq',
    '<>': 'neq',
    neq: 'neq',
    not_eq: 'neq',
    '>': 'gt',
    gt: 'gt',
    '>=': 'gte',
    gte: 'gte',
    '<': 'lt',
    lt: 'lt',
    '<=': 'lte',
    lte: 'lte',
    in: 'in',
    contains: 'contains',
    like: 'contains',
    ilike: 'contains',
    between: 'between',
    exists: 'exists',
    isnull: 'exists',
    'is null': 'exists',
    isnotnull: 'exists',
    'is not null': 'exists',
  }
  return aliases[op] ?? op
}

function valueAsTextArray(value) {
  const values = normalizeTextArray(value)
  if (!values.length) throw new Error('TWIN_QUERY_IN_REQUIRES_VALUES')
  return values
}

function valueAsNumberArray(value) {
  const values = Array.isArray(value) ? value.map(finiteNumber).filter((entry) => entry != null) : []
  if (!values.length) throw new Error('TWIN_QUERY_IN_REQUIRES_VALUES')
  return values
}

function predicateValue(definition, value) {
  return definition.field === 'semantic_class'
    ? normalizeTwinQuerySemanticClassFilterValue(value)
    : value
}

function normalizedEnum(value, allowed, fallback) {
  const normalized = compactText(value, fallback).toLowerCase()
  if (!allowed.has(normalized)) throw new Error(`TWIN_QUERY_ENUM_INVALID:${normalized}`)
  return normalized
}

function normalizedIndicatorStatuses(value, fallback) {
  const statuses = normalizeTextArray(value, fallback)
    .map((entry) => compactText(entry).toLowerCase())
    .filter(Boolean)
  return Array.from(new Set(statuses.length ? statuses : fallback))
}

function indicatorComparisonSql(predicate = {}, valueAlias, addParam) {
  const valueKind = normalizedEnum(predicate.valueKind, INDICATOR_VALUE_KINDS, 'numeric')
  const operator = normalizedEnum(predicate.operator, INDICATOR_OPERATORS, 'exists')
  if (operator === 'exists') return ''

  const column = valueKind === 'boolean'
    ? `${valueAlias}.boolean_value`
    : valueKind === 'categorical'
      ? `${valueAlias}.value_text`
      : `${valueAlias}.value`

  if (valueKind === 'json') {
    throw new Error('TWIN_QUERY_INDICATOR_JSON_ONLY_SUPPORTS_EXISTS')
  }

  if (valueKind === 'boolean') {
    if (!['eq', 'neq'].includes(operator)) {
      throw new Error(`TWIN_QUERY_INDICATOR_BOOLEAN_OPERATOR_INVALID:${operator}`)
    }
    const booleanValue = predicate.value === true || String(predicate.value).toLowerCase() === 'true'
    return `${column} ${operator === 'eq' ? '=' : '<>'} ${addParam(booleanValue)}::boolean`
  }

  if (valueKind === 'categorical') {
    if (!['eq', 'neq', 'in'].includes(operator)) {
      throw new Error(`TWIN_QUERY_INDICATOR_CATEGORY_OPERATOR_INVALID:${operator}`)
    }
    if (operator === 'in') {
      return `${column} = ANY(${addParam(valueAsTextArray(predicate.values ?? predicate.value))}::text[])`
    }
    const value = compactText(predicate.value)
    if (!value) throw new Error('TWIN_QUERY_INDICATOR_CATEGORY_VALUE_REQUIRED')
    return `${column} ${operator === 'eq' ? '=' : '<>'} ${addParam(value)}::text`
  }

  if (operator === 'between') {
    const low = finiteNumber(Array.isArray(predicate.value) ? predicate.value[0] : predicate.value)
    const high = finiteNumber(Array.isArray(predicate.value) ? predicate.value[1] : predicate.valueMax)
    if (low == null || high == null) throw new Error('TWIN_QUERY_INDICATOR_BETWEEN_VALUES_REQUIRED')
    return `${column} BETWEEN ${addParam(low)}::double precision AND ${addParam(high)}::double precision`
  }
  if (operator === 'in') {
    const values = Array.isArray(predicate.values) ? predicate.values : predicate.value
    return `${column} = ANY(${addParam(valueAsNumberArray(values))}::double precision[])`
  }
  const value = finiteNumber(predicate.value)
  if (value == null) throw new Error('TWIN_QUERY_INDICATOR_NUMERIC_VALUE_REQUIRED')
  const sqlOperator = {
    eq: '=',
    neq: '<>',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
  }[operator]
  if (!sqlOperator) throw new Error(`TWIN_QUERY_INDICATOR_OPERATOR_INVALID:${operator}`)
  return `${column} ${sqlOperator} ${addParam(value)}::double precision`
}

function indicatorEvidenceConditions(predicate, valueAlias, addParam) {
  const validationStatuses = normalizedIndicatorStatuses(
    predicate.validationStatuses ?? predicate.validationStatus,
    DEFAULT_INDICATOR_VALIDATION_STATUSES,
  )
  const authorityStatuses = normalizedIndicatorStatuses(
    predicate.authorityStatuses ?? predicate.authorityStatus,
    DEFAULT_INDICATOR_AUTHORITY_STATUSES,
  )
  const conditions = [
    `${valueAlias}.validation_status = ANY(${addParam(validationStatuses)}::text[])`,
    `${valueAlias}.authority_status = ANY(${addParam(authorityStatuses)}::text[])`,
  ]
  if (compactText(predicate.scenarioKey)) {
    conditions.push(`${valueAlias}.scenario_key = ${addParam(compactText(predicate.scenarioKey))}`)
  } else if (predicate.includeScenarios !== true) {
    conditions.push(`${valueAlias}.scenario_key IS NULL`)
  }
  return conditions
}

function compileIndicatorPredicate(predicate = {}, addParam) {
  const indicatorKey = compactText(predicate.indicatorKey ?? predicate.key)
  if (!indicatorKey) throw new Error('TWIN_QUERY_INDICATOR_KEY_REQUIRED')
  const subjectMode = normalizedEnum(
    predicate.subjectMode ?? predicate.subject,
    INDICATOR_SUBJECT_MODES,
    'self',
  )
  const valueAlias = 'indicator_value'
  const conditions = [
    `${valueAlias}.city_id = co.city_id`,
    `${valueAlias}.indicator_key = ${addParam(indicatorKey)}`,
    subjectMode === 'self'
      ? `${valueAlias}.physical_entity_id = co.id`
      : `${valueAlias}.subject_kind = 'city'`,
    ...indicatorEvidenceConditions(predicate, valueAlias, addParam),
  ]
  const comparison = indicatorComparisonSql(predicate, valueAlias, addParam)
  if (comparison) conditions.push(comparison)
  return `EXISTS (
    SELECT 1
    FROM ldt_query.indicator_subject_values ${valueAlias}
    WHERE ${conditions.join('\n      AND ')}
  )`
}

function compileRelatedIndicatorPredicate(predicate = {}, subjectAlias, addParam) {
  const indicatorKey = compactText(predicate.indicatorKey ?? predicate.key)
  if (!indicatorKey) throw new Error('TWIN_QUERY_RELATED_INDICATOR_KEY_REQUIRED')
  const valueAlias = 'related_indicator_value'
  const conditions = [
    `${valueAlias}.city_id = co.city_id`,
    `${valueAlias}.indicator_key = ${addParam(indicatorKey)}`,
    `${valueAlias}.context_subject_id = ${subjectAlias}.context_subject_id`,
    ...indicatorEvidenceConditions(predicate, valueAlias, addParam),
  ]
  const comparison = indicatorComparisonSql(predicate, valueAlias, addParam)
  if (comparison) conditions.push(comparison)
  return `EXISTS (
    SELECT 1
    FROM ldt_query.indicator_subject_values ${valueAlias}
    WHERE ${conditions.join('\n        AND ')}
  )`
}

function compileRelatedSubjectPredicate(input = {}, addParam) {
  const predicate = input.relatedSubject && typeof input.relatedSubject === 'object'
    ? { ...input.relatedSubject, kind: input.kind }
    : input
  const subjectAlias = 'related_subject'
  const subjectTypes = normalizeTextArray(predicate.subjectTypes ?? predicate.subjectType)
  if (!subjectTypes.length) throw new Error('TWIN_QUERY_RELATED_SUBJECT_TYPE_REQUIRED')
  const relationMode = normalizedEnum(predicate.relationMode, RELATED_SUBJECT_MODES, 'spatial')
  const privacyClasses = normalizedIndicatorStatuses(
    predicate.privacyClasses ?? predicate.privacyClass,
    ['public', 'aggregate'],
  )
  const conditions = [
    `${subjectAlias}.city_id = co.city_id`,
    `${subjectAlias}.subject_kind = 'context'`,
    `${subjectAlias}.context_subject_id IS NOT NULL`,
    `${subjectAlias}.subject_type = ANY(${addParam(subjectTypes)}::text[])`,
    `${subjectAlias}.privacy_class = ANY(${addParam(privacyClasses)}::text[])`,
  ]
  const spatial = `(
    ${subjectAlias}.geom IS NOT NULL
    AND co.geom && ${subjectAlias}.geom
    AND ST_Intersects(ST_PointOnSurface(co.geom), ${subjectAlias}.geom)
  )`
  const relationType = compactText(predicate.relationType)
  const explicitConditions = [
    'related_relation.city_id = co.city_id',
    `(
      (related_relation.source_entity_id = co.id AND related_relation.target_subject_id = ${subjectAlias}.context_subject_id)
      OR (related_relation.target_entity_id = co.id AND related_relation.source_subject_id = ${subjectAlias}.context_subject_id)
    )`,
    '(related_relation.valid_to IS NULL OR related_relation.valid_to >= now())',
  ]
  if (relationType) explicitConditions.push(`related_relation.relation_type = ${addParam(relationType)}`)
  const explicit = `EXISTS (
    SELECT 1
    FROM ldt_context.subject_relations related_relation
    WHERE ${explicitConditions.join('\n      AND ')}
  )`
  conditions.push(relationMode === 'spatial' ? spatial : relationMode === 'explicit' ? explicit : `(${spatial} OR ${explicit})`)

  const indicators = Array.isArray(predicate.indicators)
    ? predicate.indicators
    : predicate.indicator
      ? [predicate.indicator]
      : []
  if (indicators.length) {
    const mode = compactText(predicate.indicatorMode, 'and').toLowerCase() === 'or' ? 'OR' : 'AND'
    const indicatorSql = indicators
      .slice(0, 8)
      .map((entry) => compileRelatedIndicatorPredicate(entry, subjectAlias, addParam))
    conditions.push(`(${indicatorSql.join(` ${mode} `)})`)
  }

  return `EXISTS (
    SELECT 1
    FROM ldt_query.subjects ${subjectAlias}
    WHERE ${conditions.join('\n      AND ')}
  )`
}

function compilePredicate({ field, operator = 'eq', value }, addParam) {
  const definition = fieldDefinition(field)
  const op = normalizeOperator(operator)
  const normalizedValue = predicateValue(definition, value)
  const allowed = definition.type === 'number' ? NUMBER_OPERATORS : TEXT_OPERATORS
  if (!allowed.has(op)) {
    throw new Error(`TWIN_QUERY_UNSUPPORTED_OPERATOR:${definition.field}:${operator}`)
  }

  const sql = definition.sql
  if (op === 'exists') {
    return normalizedValue === false || operator === 'isnull' || operator === 'is null'
      ? `${sql} IS NULL`
      : `${sql} IS NOT NULL`
  }

  if (definition.type === 'number') {
    if (op === 'between') {
      const values = Array.isArray(normalizedValue) ? normalizedValue.map(finiteNumber) : []
      if (values.length !== 2 || values.some((entry) => entry == null)) {
        throw new Error(`TWIN_QUERY_BETWEEN_REQUIRES_TWO_NUMBERS:${definition.field}`)
      }
      return `${sql} BETWEEN ${addParam(values[0])}::double precision AND ${addParam(values[1])}::double precision`
    }
    if (op === 'in') {
      return `${sql} = ANY(${addParam(valueAsNumberArray(normalizedValue))}::double precision[])`
    }
    const number = finiteNumber(normalizedValue)
    if (number == null) throw new Error(`TWIN_QUERY_NUMERIC_VALUE_REQUIRED:${definition.field}`)
    if (op === 'eq') return `${sql} = ${addParam(number)}::double precision`
    if (op === 'neq') return `${sql} <> ${addParam(number)}::double precision`
    if (op === 'gt') return `${sql} > ${addParam(number)}::double precision`
    if (op === 'gte') return `${sql} >= ${addParam(number)}::double precision`
    if (op === 'lt') return `${sql} < ${addParam(number)}::double precision`
    if (op === 'lte') return `${sql} <= ${addParam(number)}::double precision`
  }

  if (op === 'in') {
    return `${sql} = ANY(${addParam(valueAsTextArray(normalizedValue))}::text[])`
  }
  if (op === 'contains') {
    return `${sql} ILIKE ${addParam(`%${compactText(normalizedValue)}%`)}`
  }
  const text = compactText(normalizedValue)
  if (op === 'eq') return `${sql} = ${addParam(text)}`
  if (op === 'neq') return `${sql} <> ${addParam(text)}`

  throw new Error(`TWIN_QUERY_UNSUPPORTED_OPERATOR:${operator}`)
}

function propertyName(node) {
  if (typeof node === 'string') return node
  if (node && typeof node === 'object') return node.property ?? node.field ?? node.name
  return ''
}

function cqlValue(node) {
  if (node && typeof node === 'object' && 'literal' in node) return node.literal
  return node
}

function compileCqlExpression(node, addParam) {
  if (!node) return ''
  if (Array.isArray(node)) {
    const children = node.map((child) => compileCqlExpression(child, addParam)).filter(Boolean)
    return children.length ? `(${children.join(' AND ')})` : ''
  }
  if (node.kind === 'indicator' || node.indicatorKey) return compileIndicatorPredicate(node, addParam)
  if (node.kind === 'related-subject' || node.relatedSubject) return compileRelatedSubjectPredicate(node, addParam)
  if (node.field) return compilePredicate(node, addParam)
  const op = compactText(node.op).toLowerCase()
  const args = Array.isArray(node.args) ? node.args : []

  if (op === 'and' || op === 'or') {
    const children = args.map((child) => compileCqlExpression(child, addParam)).filter(Boolean)
    if (!children.length) return ''
    return `(${children.join(` ${op.toUpperCase()} `)})`
  }

  if (op === 'not') {
    const child = compileCqlExpression(args[0], addParam)
    return child ? `(NOT ${child})` : ''
  }

  if (['=', '==', '!=', '<>', '>', '>=', '<', '<=', 'like', 'ilike'].includes(op)) {
    return compilePredicate({
      field: propertyName(args[0]),
      operator: op,
      value: cqlValue(args[1]),
    }, addParam)
  }

  if (op === 'in') {
    return compilePredicate({
      field: propertyName(args[0]),
      operator: 'in',
      value: Array.isArray(args[1]) ? args[1].map(cqlValue) : args.slice(1).map(cqlValue),
    }, addParam)
  }

  if (op === 'between') {
    return compilePredicate({
      field: propertyName(args[0]),
      operator: 'between',
      value: [cqlValue(args[1]), cqlValue(args[2])],
    }, addParam)
  }

  if (op === 'isnull' || op === 'is null') {
    return compilePredicate({ field: propertyName(args[0]), operator: 'exists', value: false }, addParam)
  }

  if (op === 'isnotnull' || op === 'is not null' || op === 'exists') {
    return compilePredicate({ field: propertyName(args[0]), operator: 'exists', value: true }, addParam)
  }

  throw new Error(`TWIN_QUERY_UNSUPPORTED_CQL_OPERATOR:${node.op}`)
}

export function normalizeTwinQuery(input = {}) {
  const query = input.query && typeof input.query === 'object' ? input.query : input
  const language = normalizeLanguage(query.language ?? input.language)
  const rawSql = compactText(query.sqlText ?? input.sqlText ?? query.sql ?? input.sql ?? query.sqlWhere ?? input.sqlWhere)
  const sqlText = normalizePostgisSqlText(rawSql)
  const sqlWhere = sqlText ? '' : normalizePostgisSqlWhere(query.sqlWhere ?? query.sql ?? input.sqlWhere ?? input.sql)
  const sqlMode = sqlText ? 'select' : sqlWhere ? 'where' : ''
  const classes = normalizeTwinQueryRuntimeClassKeys(
    normalizeTextArray(query.classes ?? query.class ?? input.classes, DEFAULT_QUERY_CLASSES),
    { fallback: DEFAULT_QUERY_CLASSES },
  )
  const render = normalizeRender(query.render, input)
  const rawClauses = Array.isArray(query.clauses ?? input.clauses) ? (query.clauses ?? input.clauses) : []
  if (rawClauses.length) {
    const fallbackScopeSource = {
      ...input,
      ...query,
    }
    const clauses = rawClauses.slice(0, MAX_QUERY_CLAUSES).map((rawClause, index) => {
      const clause = rawClause && typeof rawClause === 'object' ? rawClause : {}
      const clauseClasses = normalizeTwinQueryRuntimeClassKeys(
        normalizeTextArray(clause.classes ?? clause.class ?? classes, classes),
        { fallback: classes },
      )
      const clauseId = compactText(clause.id ?? clause.key, `clause-${index + 1}`).slice(0, 96)
      const clauseLabel = compactText(clause.label ?? clause.title, clauseClasses.join(', ') || clauseId).slice(0, 160)
      return {
        id: clauseId,
        label: clauseLabel,
        classes: Array.from(new Set(clauseClasses)),
        scope: normalizeScope(clause.scope ?? query.scope, fallbackScopeSource),
        where: parseJsonish(clause.where ?? clause.filter ?? clause.filters, null),
        sqlWhere: normalizePostgisSqlWhere(clause.sqlWhere ?? clause.sql ?? sqlWhere),
        sqlText: '',
        sqlMode: sqlWhere ? 'where' : '',
      }
    })

    return {
      language,
      operation: normalizeOperation(query.operation ?? input.operation),
      classes: Array.from(new Set(clauses.flatMap((clause) => clause.classes))),
      scope: {
        key: 'multiClause',
        clauses: clauses.map((clause) => ({
          id: clause.id,
          scope: clause.scope,
        })),
      },
      where: null,
      sqlWhere,
      sqlText: '',
      sqlMode: sqlWhere ? 'where' : '',
      clauses,
      render,
      orderBy: compactText(query.orderBy ?? input.orderBy, ''),
    }
  }

  return {
    language,
    classes: Array.from(new Set(classes)),
    scope: normalizeScope(query.scope, input),
    where: parseJsonish(query.where ?? query.filter ?? input.where ?? input.filter, null),
    sqlWhere,
    sqlText,
    sqlMode,
    render,
    orderBy: compactText(query.orderBy ?? input.orderBy, ''),
  }
}

export function compileTwinQueryWhere(where, addParam) {
  if (!where) return ''
  const sql = compileCqlExpression(where, addParam)
  return sql ? `AND ${sql}` : ''
}

export function compilePostgisSqlWhere(sqlWhere) {
  const sql = normalizePostgisSqlWhere(sqlWhere)
  return sql ? `AND (${sql})` : ''
}

export function twinQueryFieldCatalog() {
  return FIELD_DEFINITIONS.map(([field, , type, aliases]) => ({
    field,
    type,
    aliases,
  }))
}

export function twinQueryContract() {
  return {
    version: '2026-07-12',
    languages: ['twinql-json', 'cql2-json', 'postgis-sql'],
    classes: twinQueryRuntimeClassContractKeys(),
    semanticVocabulary: semanticVocabularyContract(),
    fields: twinQueryFieldCatalog(),
    scopes: ['city', 'radius', 'viewport', 'customPolygon'],
    operations: Array.from(VALID_QUERY_OPERATIONS),
    conditionKinds: ['property', 'indicator', 'related-subject'],
    indicator: {
      valueKinds: Array.from(INDICATOR_VALUE_KINDS),
      operators: Array.from(INDICATOR_OPERATORS),
      subjectModes: Array.from(INDICATOR_SUBJECT_MODES),
      relatedSubjectModes: Array.from(RELATED_SUBJECT_MODES),
      defaultValidationStatuses: DEFAULT_INDICATOR_VALIDATION_STATUSES,
    },
    maxClauses: MAX_QUERY_CLAUSES,
    renderModes: Array.from(VALID_RENDER_MODES),
    renderTransports: Array.from(VALID_RENDER_TRANSPORTS),
    transports: {
      metadata: '/api/live/{cityId}/twin-query',
      vectorTileTemplate: '/api/live/{cityId}/twin-query-tiles/{z}/{x}/{y}.mvt?query={encodedTwinQuery}',
      cesiumPrimitives: '/api/live/{cityId}/twin-query',
      sceneManifest: '/api/live/{cityId}/twin-query',
      selectionReference: '/api/live/{cityId}/twin-query',
      geojsonExport: '/api/live/{cityId}/twin-query?transport=geojson',
      table: '/api/live/{cityId}/twin-query',
      queryExport: '/api/live/{cityId}/twin-query/export',
    },
    exportFormats: [
      { format: 'csv', mediaType: 'text/csv', role: 'tabular-download' },
      { format: 'json', mediaType: 'application/json', role: 'tabular-api' },
      { format: 'jsonl', mediaType: 'application/x-ndjson', role: 'pipeline-stream' },
      { format: 'geojson', mediaType: 'application/geo+json', role: 'spatial-download' },
      { format: 'cityjson', mediaType: 'application/city+json', role: 'city-model-footprint-export' },
      { format: 'ifc', mediaType: 'application/x-step', role: 'requires-native-bim-exporter', available: false },
      { format: 'citygml', mediaType: 'application/gml+xml', role: 'requires-city-model-exporter', available: false },
    ],
    sql: {
      language: 'postgis-sql',
      mode: 'read-only-city-sql',
      shorthandRelation: 'ldt_query.city_objects_enriched co',
      supports: ['where-expression', 'select', 'with-select'],
      allowedSchemas: Array.from(ALLOWED_POSTGIS_SELECT_SCHEMAS),
      note: 'Expert SQL accepts either a shorthand WHERE expression over ldt_query.city_objects_enriched as co, or a read-only SELECT/WITH query over allowlisted city schemas. SELECT results must expose city_id; visual map results should expose geom plus object identifiers.',
    },
    note: 'SQL-grade read-only query contract over ldt_query.city_objects_enriched. Visual surfaces use MVT, Cesium primitive payloads, scene manifests, selection references, or table results; GeoJSON and query export formats are explicit interop/export paths, not the runtime map transport.',
  }
}
