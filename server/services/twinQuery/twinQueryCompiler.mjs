const DEFAULT_QUERY_CLASSES = ['buildings', 'roads', 'greenBlue', 'places', 'accessSeeds']
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
const VALID_RENDER_TRANSPORTS = new Set(['metadata', 'mvt', 'cesium-primitives', 'scene-manifest', 'geojson'])
const VALID_LANGUAGES = new Set(['twinql-json', 'cql2-json'])
const VALID_QUERY_OPERATIONS = new Set(['union'])

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

function compilePredicate({ field, operator = 'eq', value }, addParam) {
  const definition = fieldDefinition(field)
  const op = normalizeOperator(operator)
  const allowed = definition.type === 'number' ? NUMBER_OPERATORS : TEXT_OPERATORS
  if (!allowed.has(op)) {
    throw new Error(`TWIN_QUERY_UNSUPPORTED_OPERATOR:${definition.field}:${operator}`)
  }

  const sql = definition.sql
  if (op === 'exists') {
    return value === false || operator === 'isnull' || operator === 'is null'
      ? `${sql} IS NULL`
      : `${sql} IS NOT NULL`
  }

  if (definition.type === 'number') {
    if (op === 'between') {
      const values = Array.isArray(value) ? value.map(finiteNumber) : []
      if (values.length !== 2 || values.some((entry) => entry == null)) {
        throw new Error(`TWIN_QUERY_BETWEEN_REQUIRES_TWO_NUMBERS:${definition.field}`)
      }
      return `${sql} BETWEEN ${addParam(values[0])}::double precision AND ${addParam(values[1])}::double precision`
    }
    if (op === 'in') {
      return `${sql} = ANY(${addParam(valueAsNumberArray(value))}::double precision[])`
    }
    const number = finiteNumber(value)
    if (number == null) throw new Error(`TWIN_QUERY_NUMERIC_VALUE_REQUIRED:${definition.field}`)
    if (op === 'eq') return `${sql} = ${addParam(number)}::double precision`
    if (op === 'neq') return `${sql} <> ${addParam(number)}::double precision`
    if (op === 'gt') return `${sql} > ${addParam(number)}::double precision`
    if (op === 'gte') return `${sql} >= ${addParam(number)}::double precision`
    if (op === 'lt') return `${sql} < ${addParam(number)}::double precision`
    if (op === 'lte') return `${sql} <= ${addParam(number)}::double precision`
  }

  if (op === 'in') {
    return `${sql} = ANY(${addParam(valueAsTextArray(value))}::text[])`
  }
  if (op === 'contains') {
    return `${sql} ILIKE ${addParam(`%${compactText(value)}%`)}`
  }
  const text = compactText(value)
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
  const classes = normalizeTextArray(query.classes ?? query.class ?? input.classes, DEFAULT_QUERY_CLASSES)
  const render = normalizeRender(query.render, input)
  const rawClauses = Array.isArray(query.clauses ?? input.clauses) ? (query.clauses ?? input.clauses) : []
  if (rawClauses.length) {
    const fallbackScopeSource = {
      ...input,
      ...query,
    }
    const clauses = rawClauses.slice(0, MAX_QUERY_CLAUSES).map((rawClause, index) => {
      const clause = rawClause && typeof rawClause === 'object' ? rawClause : {}
      const clauseClasses = normalizeTextArray(clause.classes ?? clause.class ?? classes, classes)
      const clauseId = compactText(clause.id ?? clause.key, `clause-${index + 1}`).slice(0, 96)
      const clauseLabel = compactText(clause.label ?? clause.title, clauseClasses.join(', ') || clauseId).slice(0, 160)
      return {
        id: clauseId,
        label: clauseLabel,
        classes: Array.from(new Set(clauseClasses)),
        scope: normalizeScope(clause.scope ?? query.scope, fallbackScopeSource),
        where: parseJsonish(clause.where ?? clause.filter ?? clause.filters, null),
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
    render,
    orderBy: compactText(query.orderBy ?? input.orderBy, ''),
  }
}

export function compileTwinQueryWhere(where, addParam) {
  if (!where) return ''
  const sql = compileCqlExpression(where, addParam)
  return sql ? `AND ${sql}` : ''
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
    version: '2026-05-21',
    languages: ['twinql-json', 'cql2-json'],
    classes: ['boundary', 'landUseCoverageGap', 'roads', 'buildings', 'greenBlue', 'places', 'accessSeeds', 'semanticPacks', 'providerOverlays'],
    fields: twinQueryFieldCatalog(),
    scopes: ['city', 'radius', 'viewport', 'customPolygon'],
    operations: Array.from(VALID_QUERY_OPERATIONS),
    maxClauses: MAX_QUERY_CLAUSES,
    renderModes: Array.from(VALID_RENDER_MODES),
    renderTransports: Array.from(VALID_RENDER_TRANSPORTS),
    transports: {
      metadata: '/api/live/{cityId}/twin-query',
      vectorTileTemplate: '/api/live/{cityId}/twin-query-tiles/{z}/{x}/{y}.mvt?query={encodedTwinQuery}',
      cesiumPrimitives: '/api/live/{cityId}/twin-query',
      sceneManifest: '/api/live/{cityId}/twin-query',
      geojsonExport: '/api/live/{cityId}/twin-query?transport=geojson',
    },
    note: 'SQL-grade read-only query contract over ldt_query.city_objects. Visual surfaces use MVT, Cesium primitive payloads, or scene manifests; GeoJSON is kept for explicit interop/export/inspection, not as the runtime viewer transport.',
  }
}
