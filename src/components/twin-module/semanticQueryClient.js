'use client'

const DEFAULT_QUERY_CLASSES = ['buildings']
const BROAD_QUERY_CLASSES = ['buildings', 'roads', 'greenBlue', 'places', 'accessSeeds']
export const DEFAULT_QUERY_RADIUS_PERCENT = 10
export const VIEWER_QUERY_FEATURE_BUDGETS = {
  map: 50000,
  '3d': 0,
  immersive: 5000,
}

export const TWIN_QUERY_CLASS_LABELS = {
  accessSeeds: 'Access seeds',
  all: 'All city objects',
  boundary: 'Boundary',
  buildings: 'Buildings',
  greenBlue: 'Green-blue systems',
  landUseCoverageGap: 'Land-use gap',
  places: 'Places',
  providerOverlays: 'Provider overlays',
  roads: 'Roads',
  semanticPacks: 'Semantic packs',
}

export const TWIN_QUERY_FIELD_OPTIONS = [
  { key: '', label: 'Any object', type: 'none', classes: [] },
  { key: 'label', label: 'Label contains', type: 'text', classes: [] },
  { key: 'authority_status', label: 'Authority status', type: 'text', classes: [] },
  { key: 'provider', label: 'Provider', type: 'text', classes: [] },
  { key: 'source_coverage_status', label: 'Source coverage', type: 'text', classes: [] },
  { key: 'road_class', label: 'Road class', type: 'text', classes: ['roads'] },
  { key: 'building_type', label: 'Building type', type: 'text', classes: ['buildings'] },
  { key: 'height_m', label: 'Height meters', type: 'number', classes: ['buildings'] },
  { key: 'floors', label: 'Floors', type: 'number', classes: ['buildings'] },
  { key: 'sap_score', label: 'EcoBuild SAP score', type: 'number', classes: ['buildings'] },
  { key: 'energy_label', label: 'EcoBuild energy label', type: 'text', classes: ['buildings'] },
  { key: 'land_use_class', label: 'Land use', type: 'text', classes: ['greenBlue', 'landUseCoverageGap'] },
  { key: 'category', label: 'Category', type: 'text', classes: ['greenBlue', 'accessSeeds', 'places'] },
  { key: 'place_type', label: 'Place type', type: 'text', classes: ['places'] },
  { key: 'footprint_area_m2', label: 'Footprint area', type: 'number', classes: ['buildings'] },
]

export const TWIN_QUERY_TEXT_OPERATORS = [
  { key: 'exists', label: 'Has value' },
  { key: 'eq', label: 'Equals' },
  { key: 'contains', label: 'Contains' },
]

export const TWIN_QUERY_NUMBER_OPERATORS = [
  { key: 'exists', label: 'Has value' },
  { key: 'gte', label: '>=' },
  { key: 'lte', label: '<=' },
  { key: 'between', label: 'Between' },
]

const CLASS_LAYER_KEY = {
  accessSeeds: 'facilities',
  boundary: 'boundary',
  buildings: 'buildings',
  greenBlue: 'greenBlue',
  landUseCoverageGap: 'unclassifiedLand',
  places: 'places',
  providerOverlays: 'providerOverlays',
  roads: 'roads',
  semanticPacks: 'semanticPacks',
}

const QUERY_CLASS_RULES = [
  {
    key: 'buildings',
    pattern: /\b(building|buildings|built|edificio|edificios|construccion|construcciones)\b/i,
  },
  {
    key: 'roads',
    pattern: /\b(road|roads|street|streets|calle|calles|camino|caminos|carretera|carreteras|vialidad|vialidades)\b/i,
  },
  {
    key: 'greenBlue',
    pattern: /\b(green|blue|park|parks|water|river|forest|land|open land|verde|azul|parque|parques|agua|rio|rios|bosque|tierra|suelo)\b/i,
  },
  {
    key: 'places',
    pattern: /\b(place|places|settlement|settlements|lugar|lugares|asentamiento|asentamientos|barrio|barrios|zona|zonas)\b/i,
  },
  {
    key: 'accessSeeds',
    pattern: /\b(seed|seeds|service|services|access|civic|mobility|commerce|waste|servicio|servicios|acceso|civico|movilidad|comercio|residuo|residuos)\b/i,
  },
  {
    key: 'landUseCoverageGap',
    pattern: /\b(gap|missing land|unclassified|sin clasificar|no clasificado|no clasificada|brecha)\b/i,
  },
  {
    key: 'semanticPacks',
    pattern: /\b(pack|packs|semantic pack|paquete|paquetes|paquete semantico)\b/i,
  },
]

export const SEMANTIC_QUERY_PRESETS = [
  {
    key: 'buildings',
    label: 'Buildings',
    queryText: 'buildings',
    classes: ['buildings'],
  },
  {
    key: 'roads',
    label: 'Roads',
    queryText: 'roads',
    classes: ['roads'],
  },
  {
    key: 'access',
    label: 'Access seeds',
    queryText: 'access seeds',
    classes: ['accessSeeds'],
  },
  {
    key: 'green-blue',
    label: 'Green-blue',
    queryText: 'green blue systems',
    classes: ['greenBlue'],
  },
  {
    key: 'all-open',
    label: 'Open inventory',
    queryText: 'all open semantic objects',
    classes: BROAD_QUERY_CLASSES,
  },
]

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function allowedClassSet(contract) {
  const values = (contract?.classes ?? [])
    .map((entry) => (typeof entry === 'string' ? entry : entry?.key))
    .filter(Boolean)
  return new Set(values.length ? values : BROAD_QUERY_CLASSES)
}

function classesForText(text, contract, fallback = DEFAULT_QUERY_CLASSES) {
  const allowed = allowedClassSet(contract)
  const normalized = String(text ?? '').trim()
  if (/\b(all|everything|todo|todos|todas|inventory|inventario)\b/i.test(normalized)) {
    return BROAD_QUERY_CLASSES.filter((key) => allowed.has(key))
  }
  const matches = QUERY_CLASS_RULES
    .filter((rule) => allowed.has(rule.key) && rule.pattern.test(normalized))
    .map((rule) => rule.key)
  const next = matches.length ? matches : fallback
  return unique(next.filter((key) => allowed.has(key)))
}

function numericValue(text) {
  const match = String(text ?? '').match(/(?:>|>=|over|above|more than|greater than|mas de|mayor a|altura|height|taller than)\s*(\d+(?:[.,]\d+)?)/i)
  if (!match) return null
  const value = Number(String(match[1]).replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

function filtersForText(text, classes) {
  const value = numericValue(text)
  const filters = []
  if (classes.includes('buildings') && value != null && /\b(height|altura|m|meter|meters|metro|metros|tall|taller|alto|altos|alta|altas)\b/i.test(text)) {
    filters.push({ field: 'heightMeters', operator: 'gte', value })
  }

  const roadClasses = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service']
  const selectedRoadClasses = roadClasses.filter((roadClass) => new RegExp(`\\b${roadClass}\\b`, 'i').test(text))
  if (classes.includes('roads') && selectedRoadClasses.length) {
    filters.push({ field: 'roadClass', operator: 'in', value: selectedRoadClasses })
  }

  const nameMatch = String(text ?? '').match(/\b(?:name|nombre|calle)\s*[:=]\s*["']?([^"',;]+)["']?/i)
  if (nameMatch?.[1]) {
    filters.push({ field: classes.includes('roads') ? 'name' : 'label', operator: 'contains', value: nameMatch[1].trim() })
  }

  return filters
}

function payloadCenter(payload) {
  const lon = Number(payload?.center?.lon ?? payload?.reference?.center?.lon)
  const lat = Number(payload?.center?.lat ?? payload?.reference?.center?.lat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return [lon, lat]
}

function walkCoordinates(geometry, callback) {
  if (!geometry?.coordinates) return
  if (geometry.type === 'Point') {
    callback(geometry.coordinates)
    return
  }
  const visit = (value) => {
    if (!Array.isArray(value)) return
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      callback(value)
      return
    }
    value.forEach(visit)
  }
  visit(geometry.coordinates)
}

function distanceMeters(a, b) {
  const earthRadius = 6371008.8
  const lat1 = (a[1] * Math.PI) / 180
  const lat2 = (b[1] * Math.PI) / 180
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLon = ((b[0] - a[0]) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function radiusMetersForCoverage(payload, coverage) {
  const center = payloadCenter(payload)
  const percent = Math.min(100, Math.max(0, Number(coverage) || 0))
  if (!center || percent <= 0) return 0
  let maxDistance = 1000
  ;(payload?.layers?.boundary?.features ?? []).forEach((feature) => {
    walkCoordinates(feature.geometry, (coordinate) => {
      maxDistance = Math.max(maxDistance, distanceMeters(center, coordinate))
    })
  })
  return Math.round(Math.max(1000, maxDistance * 1.04) * (percent / 100))
}

export function radiusPercentForMeters(payload, radiusMeters) {
  const maxRadius = radiusMetersForCoverage(payload, 100)
  const meters = Number(radiusMeters)
  if (!Number.isFinite(maxRadius) || maxRadius <= 0 || !Number.isFinite(meters) || meters <= 0) return 0
  return Math.round(Math.min(100, Math.max(0, (meters / maxRadius) * 100)))
}

export function radiusMetersForQueryPercent(payload, percent) {
  return radiusMetersForCoverage(payload, percent)
}

function scopeForQuery(payload, cityCoverage) {
  const center = payloadCenter(payload)
  const radiusMeters = radiusMetersForCoverage(payload, cityCoverage)
  if (center && radiusMeters > 0) {
    return { key: 'radius', center, radiusMeters }
  }
  return { key: 'city' }
}

export function maxFeaturesForViewer(viewerId) {
  const value = VIEWER_QUERY_FEATURE_BUDGETS[viewerId] ?? VIEWER_QUERY_FEATURE_BUDGETS.immersive
  return Number(value) > 0 ? Number(value) : undefined
}

function renderForViewer(viewerId, render = {}) {
  const maxFeatures = maxFeaturesForViewer(viewerId)
  return {
    ...render,
    mode: render.mode || 'isolate',
    transport: render.transport || transportForViewer(viewerId),
    ...(maxFeatures ? { maxFeatures } : {}),
  }
}

export function transportForViewer(viewerId) {
  if (viewerId === '3d') return 'selection-reference'
  if (viewerId === 'immersive') return 'scene-manifest'
  return 'mvt'
}

export function normalizeTwinQueryForViewer(query = {}, { surface = 'map', viewerId = 'map', intent } = {}) {
  const render = query.render && typeof query.render === 'object' ? query.render : {}
  return {
    ...query,
    render: renderForViewer(viewerId, render),
    surface,
    intent: query.intent || intent,
  }
}

function intentForQueryViewer(viewerId) {
  if (viewerId === '3d') return 'operations'
  if (viewerId === 'immersive') return 'embed'
  return 'analysis'
}

export function parseRawTwinQueryJson(rawText = '') {
  const text = String(rawText ?? '').trim()
  if (!text) {
    const error = new Error('RAW_QUERY_REQUIRED')
    error.code = 'RAW_QUERY_REQUIRED'
    throw error
  }
  let query
  try {
    query = JSON.parse(text)
  } catch (cause) {
    const error = new Error('RAW_QUERY_JSON_INVALID')
    error.code = 'RAW_QUERY_JSON_INVALID'
    error.cause = cause
    throw error
  }
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    const error = new Error('RAW_QUERY_OBJECT_REQUIRED')
    error.code = 'RAW_QUERY_OBJECT_REQUIRED'
    throw error
  }
  return query
}

export function buildRawTwinQueryRequest({
  rawQuery,
  rawText = '',
  surface = 'map',
  viewerId = 'map',
} = {}) {
  const parsedQuery = rawQuery && typeof rawQuery === 'object' && !Array.isArray(rawQuery)
    ? rawQuery
    : parseRawTwinQueryJson(rawText)
  const query = {
    ...parsedQuery,
    language: parsedQuery.language || 'twinql-json',
  }
  const metadata = query.metadata && typeof query.metadata === 'object' ? query.metadata : {}
  return {
    ...normalizeTwinQueryForViewer(query, {
      surface,
      viewerId,
      intent: intentForQueryViewer(viewerId),
    }),
    metadata: {
      ...metadata,
      source: 'visual-secondary-rail-raw-twin-query',
      rawQuery: true,
      previousSource: metadata.source || null,
    },
  }
}

export function buildSqlTwinQueryRequest({
  presetId = '',
  presetTitle = '',
  sqlText = '',
  surface = 'map',
  viewerId = 'map',
} = {}) {
  const sql = String(sqlText ?? '').trim()
  if (!sql) {
    const error = new Error('SQL_QUERY_REQUIRED')
    error.code = 'SQL_QUERY_REQUIRED'
    throw error
  }
  const metadata = {
    source: 'visual-secondary-rail-postgis-sql',
    sqlQuery: true,
    ...(presetId ? { presetId } : {}),
    ...(presetTitle ? { presetTitle } : {}),
  }
  const sqlPayload = /^(select|with)\b/i.test(sql)
    ? { sqlText: sql }
    : { sqlWhere: sql }
  return {
    ...normalizeTwinQueryForViewer({
      language: 'postgis-sql',
      classes: BROAD_QUERY_CLASSES,
      scope: { key: 'city' },
      ...sqlPayload,
      render: { mode: 'isolate' },
      metadata,
    }, {
      surface,
      viewerId,
      intent: intentForQueryViewer(viewerId),
    }),
    metadata,
  }
}

export function normalizeTwinQueryFor3dSelectionReference(query = {}, { surface = 'municipal3d', intent } = {}) {
  const render = query.render && typeof query.render === 'object' ? query.render : {}
  return {
    ...query,
    render: {
      ...render,
      mode: render.mode || 'highlight',
      transport: 'selection-reference',
      maxFeatures: 0,
    },
    surface,
    intent: query.intent || intent,
  }
}

function twinQueryScopeForBuilder({ builder = {}, cityCoverage = 0, payload } = {}) {
  if (builder.scopeKey === 'city') {
    const center = payloadCenter(payload)
    const radiusMeters = radiusMetersForCoverage(payload, cityCoverage || DEFAULT_QUERY_RADIUS_PERCENT)
    if (center && radiusMeters > 0) {
      return { key: 'radius', center, radiusMeters: Math.round(radiusMeters) }
    }
    return { key: 'city' }
  }
  if (builder.scopeKey === 'radius') {
    const center = payloadCenter(payload)
    const explicitMeters = Number(builder.radiusMeters)
    const percent = Number(builder.radiusPercent ?? cityCoverage ?? DEFAULT_QUERY_RADIUS_PERCENT)
    const radiusMeters = Number.isFinite(explicitMeters) && explicitMeters > 0
      ? explicitMeters
      : radiusMetersForCoverage(payload, percent)
    if (center && radiusMeters > 0) {
      return { key: 'radius', center, radiusMeters: Math.round(radiusMeters) }
    }
    return { key: 'city' }
  }
  return scopeForQuery(payload, cityCoverage)
}

function fieldOption(field) {
  return TWIN_QUERY_FIELD_OPTIONS.find((option) => option.key === field) ?? TWIN_QUERY_FIELD_OPTIONS[0]
}

function indicatorValueForQuery(predicate = {}) {
  const valueKind = String(predicate.valueKind || 'numeric')
  if (valueKind === 'boolean') {
    return predicate.value === true || String(predicate.value).toLowerCase() === 'true'
  }
  if (valueKind === 'categorical') return String(predicate.value ?? '').trim()
  return Number(predicate.value)
}

function indicatorPredicateWhere(predicate = {}) {
  const indicatorKey = String(predicate.indicatorKey || predicate.key || '').trim()
  if (!indicatorKey) return null
  const operator = String(predicate.operator || 'exists')
  const valueKind = String(predicate.valueKind || 'numeric')
  const normalized = {
    kind: 'indicator',
    indicatorKey,
    subjectMode: predicate.subjectMode === 'city' ? 'city' : 'self',
    operator,
    valueKind,
    validationStatuses: Array.isArray(predicate.validationStatuses)
      ? predicate.validationStatuses
      : ['validated', 'lab', 'simulated'],
    ...(Array.isArray(predicate.authorityStatuses) ? { authorityStatuses: predicate.authorityStatuses } : {}),
    ...(predicate.scenarioKey ? { scenarioKey: predicate.scenarioKey } : {}),
  }
  if (operator === 'exists') return normalized
  if (operator === 'between') {
    return { ...normalized, value: Number(predicate.value), valueMax: Number(predicate.valueMax) }
  }
  if (operator === 'in') {
    const values = Array.isArray(predicate.values)
      ? predicate.values
      : String(predicate.value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean)
    return { ...normalized, values }
  }
  return { ...normalized, value: indicatorValueForQuery(predicate) }
}

function relatedSubjectPredicateWhere(predicate = {}) {
  const subjectTypes = Array.isArray(predicate.subjectTypes)
    ? predicate.subjectTypes.filter(Boolean)
    : predicate.subjectType
      ? [predicate.subjectType]
      : []
  if (!subjectTypes.length) return null
  const indicators = (Array.isArray(predicate.indicators) ? predicate.indicators : [])
    .map((entry) => indicatorPredicateWhere({ ...entry, subjectMode: 'self' }))
    .filter(Boolean)
    .map(({ subjectMode, ...entry }) => entry)
  return {
    kind: 'related-subject',
    subjectTypes,
    relationMode: ['spatial', 'explicit', 'any'].includes(predicate.relationMode) ? predicate.relationMode : 'spatial',
    ...(predicate.relationType ? { relationType: predicate.relationType } : {}),
    privacyClasses: Array.isArray(predicate.privacyClasses) ? predicate.privacyClasses : ['public', 'aggregate'],
    indicatorMode: predicate.indicatorMode === 'or' ? 'or' : 'and',
    indicators,
  }
}

function predicateWhere(predicate = {}) {
  if (predicate.kind === 'indicator') return indicatorPredicateWhere(predicate)
  if (predicate.kind === 'related-subject') return relatedSubjectPredicateWhere(predicate)
  const field = String(predicate.field ?? '').trim()
  if (!field) return null
  const option = fieldOption(field)
  const operator = String(predicate.operator || 'exists')
  if (operator === 'exists') {
    return { field, operator: 'exists', value: true }
  }
  if (option.type === 'number') {
    if (operator === 'between') {
      return {
        field,
        operator: 'between',
        value: [
          Number(predicate.value),
          Number(predicate.valueMax),
        ],
      }
    }
    return {
      field,
      operator,
      value: Number(predicate.value),
    }
  }
  return {
    field,
    operator,
    value: String(predicate.value ?? '').trim(),
  }
}

function normalizedPredicates(builder = {}) {
  if (Array.isArray(builder.predicates)) {
    return builder.predicates
      .map(predicateWhere)
      .filter(Boolean)
  }
  return [predicateWhere(builder)].filter(Boolean)
}

function twinQueryWhere(builder = {}) {
  const predicates = normalizedPredicates(builder)
  if (!predicates.length) return null
  if (predicates.length === 1) return predicates[0]
  const mode = String(builder.predicateMode || 'and').toLowerCase() === 'or' ? 'or' : 'and'
  return { op: mode, args: predicates }
}

export function createDefaultTwinQueryClause({
  classKey = 'buildings',
  id = 'clause-1',
  label = 'Clause 1',
  supportsCityScale = true,
} = {}) {
  return {
    id,
    label,
    classKey,
    scopeKey: supportsCityScale ? 'radius' : 'city',
    radiusPercent: supportsCityScale ? DEFAULT_QUERY_RADIUS_PERCENT : 0,
    radiusMeters: '',
    predicateMode: 'and',
    predicates: [
      {
        id: `${id}-predicate-1`,
        kind: 'property',
        field: '',
        operator: 'exists',
        value: '',
        valueMax: '',
      },
    ],
  }
}

export function buildSemanticQueryRequest({
  cityCoverage = 0,
  contract,
  payload,
  preset,
  surface = 'map',
  text = '',
  viewerId = 'map',
} = {}) {
  const presetClasses = preset?.classes?.length ? preset.classes : null
  const queryText = String(text || preset?.queryText || '').trim() || 'buildings'
  const classes = unique(
    presetClasses?.filter((key) => allowedClassSet(contract).has(key)) ??
      classesForText(queryText, contract),
  )
  const query = {
    classes: classes.length ? classes : DEFAULT_QUERY_CLASSES,
    scope: scopeForQuery(payload, cityCoverage),
    filters: filtersForText(queryText, classes),
    combine: 'and',
    render: renderForViewer(viewerId),
  }

  return {
    query,
    surface,
    intent: viewerId === '3d' ? 'operations' : viewerId === 'immersive' ? 'embed' : 'analysis',
    metadata: {
      source: 'visual-semantic-query-bar',
      queryText,
      presetKey: preset?.key ?? null,
    },
  }
}

export function buildTwinQueryRequest({
  builder = {},
  cityCoverage = 0,
  payload,
  surface = 'map',
  viewerId = 'map',
} = {}) {
  const render = renderForViewer(viewerId, { mode: String(builder.renderMode || 'isolate') })
  if (Array.isArray(builder.clauses) && builder.clauses.length) {
    const clauses = builder.clauses.map((clause, index) => {
      const classKey = String(clause.classKey || 'buildings')
      const classes = classKey === 'all' ? BROAD_QUERY_CLASSES : [classKey]
      return {
        id: String(clause.id || `clause-${index + 1}`),
        label: String(clause.label || `Clause ${index + 1}`),
        classes,
        scope: twinQueryScopeForBuilder({ builder: clause, cityCoverage, payload }),
        where: twinQueryWhere(clause),
      }
    })
    return {
      language: 'twinql-json',
      operation: 'union',
      clauses,
      render,
      surface,
      intent: viewerId === '3d' ? 'operations' : viewerId === 'immersive' ? 'embed' : 'analysis',
      metadata: {
        source: 'visual-secondary-rail-twin-query',
        builder,
      },
    }
  }

  const classKey = String(builder.classKey || 'buildings')
  const classes = classKey === 'all' ? BROAD_QUERY_CLASSES : [classKey]
  return {
    language: 'twinql-json',
    classes,
    scope: twinQueryScopeForBuilder({ builder, cityCoverage, payload }),
    where: twinQueryWhere(builder),
    render,
    surface,
    intent: viewerId === '3d' ? 'operations' : viewerId === 'immersive' ? 'embed' : 'analysis',
    metadata: {
      source: 'visual-secondary-rail-twin-query',
      builder,
    },
  }
}

function layerKeyForFeature(properties = {}) {
  const direct = properties.layerKey || properties.layerkey || properties.queryLayerKey || properties.querylayerkey
  if (direct) return direct
  const semanticClass = properties.semanticClass || properties.semantic_class || properties.semanticclass
  return CLASS_LAYER_KEY[semanticClass] || properties.featureType || properties.featuretype || 'feature'
}

export function normalizeSemanticQueryGeojson(geojson) {
  return {
    type: 'FeatureCollection',
    features: (geojson?.features ?? [])
      .filter((feature) => feature?.geometry)
      .map((feature) => {
        const properties = feature.properties ?? {}
        const layerKey = layerKeyForFeature(properties)
        return {
          ...feature,
          properties: {
            ...properties,
            layerKey,
            queryLayerKey: properties.queryLayerKey || layerKey,
            label: properties.label || properties.name || properties.stableId || properties.stable_id || layerKey,
          },
        }
      }),
  }
}

export function semanticQueryResultLabel(result) {
  const summary = result?.summary ?? {}
  const returned = Number(summary.returned ?? result?.geojson?.features?.length ?? 0)
  const total = Number(summary.resultCount ?? returned)
  const classKeys = Object.keys(summary.countsBySemanticClass ?? {})
  const classLabel = classKeys.length ? classKeys.join(', ') : (result?.query?.classes ?? []).join(', ')
  if (!Number.isFinite(total)) return 'No result'
  if (result?.transport === 'table') {
    const rowCount = Number(summary.returnedRows ?? result?.table?.rows?.length ?? returned)
    const rowLabel = Number.isFinite(rowCount) ? rowCount.toLocaleString('en-US') : returned.toLocaleString('en-US')
    return `${rowLabel} table ${rowCount === 1 ? 'row' : 'rows'}`
  }
  if ((result?.transport === 'mvt' || result?.query?.render?.transport === 'mvt') && total > 0) {
    return `${total.toLocaleString('en-US')} ${classLabel || 'objects'} as tiles`
  }
  if ((result?.transport === 'scene-manifest' || result?.query?.render?.transport === 'scene-manifest') && total > 0) {
    return `${total.toLocaleString('en-US')} ${classLabel || 'objects'} in scene manifest`
  }
  if ((result?.transport === 'selection-reference' || result?.query?.render?.transport === 'selection-reference') && total > 0) {
    return `${total.toLocaleString('en-US')} ${classLabel || 'objects'} as selection reference`
  }
  const countLabel = total === returned
    ? total.toLocaleString('en-US')
    : `${returned.toLocaleString('en-US')} / ${total.toLocaleString('en-US')}`
  return `${countLabel} ${classLabel || 'objects'}`
}

export function geojsonTransportNotice(result) {
  const policy = result?.summary?.transportPolicy
  if (!policy || policy.transport !== 'geojson') return ''
  const returned = Number(policy.returned ?? result?.summary?.returned ?? result?.geojson?.features?.length ?? 0)
  const total = Number(policy.resultCount ?? result?.summary?.resultCount ?? returned)
  const limit = Number(policy.effectiveMaxFeatures ?? returned)
  const returnedLabel = Number.isFinite(returned) ? returned.toLocaleString('en-US') : 'some'
  const totalLabel = Number.isFinite(total) ? total.toLocaleString('en-US') : 'the available'
  const limitLabel = Number.isFinite(limit) ? limit.toLocaleString('en-US') : 'bounded'
  if (policy.warning) {
    return `${policy.warning} Showing ${returnedLabel} of ${totalLabel} objects.`
  }
  return `GeoJSON preview is limited to ${limitLabel} features. Showing ${returnedLabel} of ${totalLabel} objects; full viewers should use MVT, PMTiles, 3D Tiles, or scene manifests.`
}
