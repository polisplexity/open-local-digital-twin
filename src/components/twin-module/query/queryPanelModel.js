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

export function queryNeedsValue(builder) {
  if (!builder?.field) return false
  return String(builder.operator || 'exists') !== 'exists'
}

export function normalizeQueryPredicates(queryBuilder = {}) {
  if (Array.isArray(queryBuilder.predicates) && queryBuilder.predicates.length) {
    return queryBuilder.predicates.map((predicate, index) => ({
      id: predicate.id || `predicate-${index + 1}`,
      field: predicate.field || '',
      operator: predicate.operator || 'exists',
      value: predicate.value ?? '',
      valueMax: predicate.valueMax ?? '',
    }))
  }
  return [
    {
      id: 'predicate-1',
      field: queryBuilder.field || '',
      operator: queryBuilder.operator || 'exists',
      value: queryBuilder.value ?? '',
      valueMax: queryBuilder.valueMax ?? '',
    },
  ]
}

export function predicateHasRequiredValue(predicate) {
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
    return {
      ...fallback,
      ...clause,
      id: clause.id || fallback.id,
      label: clause.label || fallback.label,
      classKey: clause.classKey || fallback.classKey,
      scopeKey: clause.scopeKey || fallback.scopeKey,
      radiusPercent: Math.min(100, Math.max(0, Number(clause.radiusPercent ?? fallback.radiusPercent) || 0)),
      radiusMeters: clause.radiusMeters ?? fallback.radiusMeters,
      predicateMode: String(clause.predicateMode || fallback.predicateMode).toLowerCase() === 'or' ? 'or' : 'and',
      predicates: normalizeQueryPredicates(clause.predicates ? clause : fallback),
    }
  })
}

export function emptyPredicate(id) {
  return {
    id,
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
