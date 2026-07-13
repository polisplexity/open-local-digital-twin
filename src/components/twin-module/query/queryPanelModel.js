import {
  createDefaultTwinQueryClause,
  TWIN_QUERY_CLASS_LABELS,
  TWIN_QUERY_FIELD_OPTIONS,
  TWIN_QUERY_NUMBER_OPERATORS,
  TWIN_QUERY_TEXT_OPERATORS,
} from '../semanticQueryClient'

export function formatQueryTimestamp(value) {
  if (!value) return 'Just now'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Just now'
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: '2-digit',
  }).format(date)
}

export function queryClassOptions(contract) {
  const classes = (contract?.classes ?? [])
    .map((entry) => (typeof entry === 'string' ? entry : entry?.key))
    .filter(Boolean)
  const values = classes.length ? classes : ['buildings', 'roads', 'greenBlue', 'places', 'accessSeeds']
  return ['all', ...values].map((key) => ({
    key,
    label: TWIN_QUERY_CLASS_LABELS[key] ?? key,
  }))
}

export function queryFieldsForClass(classKey) {
  if (classKey === 'all') {
    return TWIN_QUERY_FIELD_OPTIONS.filter((option) => !option.classes?.length)
  }
  return TWIN_QUERY_FIELD_OPTIONS.filter((option) => {
    return !option.classes?.length || option.classes.includes(classKey)
  })
}

export function queryFieldOption(field) {
  return TWIN_QUERY_FIELD_OPTIONS.find((option) => option.key === field) ?? TWIN_QUERY_FIELD_OPTIONS[0]
}

export function queryOperatorOptions(field) {
  const option = queryFieldOption(field)
  if (option.type === 'number') return TWIN_QUERY_NUMBER_OPERATORS
  if (option.type === 'text') return TWIN_QUERY_TEXT_OPERATORS
  return []
}

export function indicatorOperatorOptions(valueKind = 'numeric') {
  if (valueKind === 'boolean') {
    return [
      { key: 'exists', label: 'Has value' },
      { key: 'eq', label: 'Equals' },
      { key: 'neq', label: 'Not equal' },
    ]
  }
  if (valueKind === 'categorical') {
    return [
      { key: 'exists', label: 'Has value' },
      { key: 'eq', label: 'Equals' },
      { key: 'neq', label: 'Not equal' },
      { key: 'in', label: 'One of' },
    ]
  }
  return [
    { key: 'exists', label: 'Has value' },
    { key: 'eq', label: '=' },
    { key: 'neq', label: '!=' },
    { key: 'gt', label: '>' },
    { key: 'gte', label: '>=' },
    { key: 'lt', label: '<' },
    { key: 'lte', label: '<=' },
    { key: 'between', label: 'Between' },
  ]
}

export function queryNeedsValue(builder) {
  if (builder?.kind === 'indicator') return Boolean(builder.indicatorKey) && String(builder.operator || 'exists') !== 'exists'
  if (builder?.kind === 'related-subject') return false
  if (!builder?.field) return false
  return String(builder.operator || 'exists') !== 'exists'
}

export function emptyIndicatorCondition(id) {
  return {
    id,
    indicatorKey: '',
    operator: 'exists',
    valueKind: 'numeric',
    value: '',
    valueMax: '',
    values: [],
    validationStatuses: ['validated', 'lab', 'simulated'],
  }
}

function normalizeIndicatorCondition(condition = {}, index = 0) {
  return {
    ...emptyIndicatorCondition(condition.id || `indicator-${index + 1}`),
    ...condition,
    id: condition.id || `indicator-${index + 1}`,
    indicatorKey: condition.indicatorKey || condition.key || '',
    valueKind: condition.valueKind || 'numeric',
    operator: condition.operator || 'exists',
  }
}

export function normalizeQueryPredicates(queryBuilder = {}) {
  if (Array.isArray(queryBuilder.predicates) && queryBuilder.predicates.length) {
    return queryBuilder.predicates.map((predicate, index) => ({
      ...predicate,
      id: predicate.id || `predicate-${index + 1}`,
      kind: ['property', 'indicator', 'related-subject'].includes(predicate.kind) ? predicate.kind : 'property',
      field: predicate.field || '',
      indicatorKey: predicate.indicatorKey || '',
      subjectMode: predicate.subjectMode === 'city' ? 'city' : 'self',
      valueKind: predicate.valueKind || 'numeric',
      operator: predicate.operator || 'exists',
      value: predicate.value ?? '',
      valueMax: predicate.valueMax ?? '',
      relationMode: ['spatial', 'explicit', 'any'].includes(predicate.relationMode) ? predicate.relationMode : 'spatial',
      relationType: predicate.relationType || '',
      subjectTypes: Array.isArray(predicate.subjectTypes) ? predicate.subjectTypes : predicate.subjectType ? [predicate.subjectType] : [],
      indicatorMode: predicate.indicatorMode === 'or' ? 'or' : 'and',
      indicators: Array.isArray(predicate.indicators)
        ? predicate.indicators.map(normalizeIndicatorCondition)
        : [emptyIndicatorCondition(`${predicate.id || `predicate-${index + 1}`}-related-indicator-1`)],
    }))
  }
  return [
    {
      id: 'predicate-1',
      kind: 'property',
      field: queryBuilder.field || '',
      operator: queryBuilder.operator || 'exists',
      value: queryBuilder.value ?? '',
      valueMax: queryBuilder.valueMax ?? '',
    },
  ]
}

export function predicateHasRequiredValue(predicate) {
  if (predicate?.kind === 'indicator') {
    if (!predicate.indicatorKey) return true
    if (!queryNeedsValue(predicate)) return true
    if (predicate.operator === 'between') {
      return String(predicate.value ?? '').trim() !== '' && String(predicate.valueMax ?? '').trim() !== ''
    }
    return String(predicate.value ?? '').trim() !== ''
  }
  if (predicate?.kind === 'related-subject') {
    if (!predicate.subjectTypes?.length) return false
    const indicators = Array.isArray(predicate.indicators) ? predicate.indicators : []
    if (!indicators.length) return true
    return indicators.every((indicator) => {
      if (!indicator.indicatorKey) return false
      if (indicator.operator === 'exists') return true
      if (indicator.operator === 'between') {
        return String(indicator.value ?? '').trim() !== '' && String(indicator.valueMax ?? '').trim() !== ''
      }
      return String(indicator.value ?? '').trim() !== ''
    })
  }
  if (!predicate?.field) return true
  if (!queryNeedsValue(predicate)) return true
  const option = queryFieldOption(predicate.field)
  if (predicate.operator === 'between') {
    return String(predicate.value ?? '').trim() !== '' && String(predicate.valueMax ?? '').trim() !== ''
  }
  if (option.type === 'number') return String(predicate.value ?? '').trim() !== ''
  return String(predicate.value ?? '').trim() !== ''
}

export function queryHasRequiredValue(builder) {
  return normalizeQueryPredicates(builder).every(predicateHasRequiredValue)
}

function normalizeRadiusMeters(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const numeric = Number(text)
  return Number.isFinite(numeric) && numeric > 0 ? text : ''
}

export function normalizeQueryClauses(queryBuilder = {}, supportsCityScale = false) {
  const rawClauses = Array.isArray(queryBuilder.clauses) && queryBuilder.clauses.length
    ? queryBuilder.clauses
    : [queryBuilder]
  return rawClauses.slice(0, 4).map((rawClause, index) => {
    const fallback = createDefaultTwinQueryClause({
      classKey: index === 1 ? 'roads' : index === 2 ? 'greenBlue' : 'buildings',
      id: `clause-${index + 1}`,
      label: `Clause ${index + 1}`,
      supportsCityScale,
    })
    const clause = rawClause && typeof rawClause === 'object' ? rawClause : {}
    const rawScopeKey = clause.scopeKey || fallback.scopeKey
    const scopeKey = supportsCityScale && rawScopeKey === 'city' ? 'radius' : rawScopeKey
    return {
      ...fallback,
      ...clause,
      id: clause.id || fallback.id,
      label: clause.label || fallback.label,
      classKey: clause.classKey || fallback.classKey,
      scopeKey,
      radiusPercent: Math.min(100, Math.max(0, Number(clause.radiusPercent ?? fallback.radiusPercent) || 0)),
      radiusMeters: normalizeRadiusMeters(clause.radiusMeters ?? fallback.radiusMeters),
      predicateMode: String(clause.predicateMode || fallback.predicateMode).toLowerCase() === 'or' ? 'or' : 'and',
      predicates: normalizeQueryPredicates(clause.predicates ? clause : fallback),
    }
  })
}

export function emptyPredicate(id) {
  return {
    id,
    kind: 'property',
    field: '',
    operator: 'exists',
    value: '',
    valueMax: '',
  }
}

export function createTwinQueryClause({
  classKey,
  id,
  label,
  supportsCityScale,
}) {
  return createDefaultTwinQueryClause({
    classKey,
    id,
    label,
    supportsCityScale,
  })
}
