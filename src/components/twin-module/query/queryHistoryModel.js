const HISTORY_SIGNATURE_SKIP_KEYS = new Set([
  'actorUserId',
  'client',
  'createdAt',
  'eventId',
  'id',
  'maxFeatures',
  'metadata',
  'queryId',
  'requestId',
  'resultCount',
  'timestamp',
  'updatedAt',
])

function stableHistoryValue(value) {
  if (Array.isArray(value)) return value.map(stableHistoryValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !HISTORY_SIGNATURE_SKIP_KEYS.has(key))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nextValue]) => [key, stableHistoryValue(nextValue)]),
    )
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Number(value.toFixed(3)) : value
  }
  return value
}

export function queryHistorySignature(event) {
  const query = event?.query && typeof event.query === 'object' ? event.query : {}
  return JSON.stringify(stableHistoryValue({
    operation: query.operation || 'union',
    clauses: query.clauses || [],
    classKey: query.classKey || '',
    classes: query.classes || event?.classes || [],
    filters: query.filters || event?.filters || [],
    predicateMode: query.predicateMode || '',
    predicates: query.predicates || [],
    render: query.render || {},
    scope: query.scope || event?.scope || {},
    surface: event?.surface || query.surface || '',
  }))
}

export function groupQueryHistoryEvents(events = []) {
  const groups = new Map()
  events.forEach((event) => {
    const key = queryHistorySignature(event)
    const group = groups.get(key)
    if (!group) {
      groups.set(key, {
        ...event,
        duplicateCount: 1,
        historyGroupKey: key,
        latestEvent: event,
      })
      return
    }
    group.duplicateCount += 1
    group.oldestCreatedAt = event.createdAt || group.oldestCreatedAt
  })
  return Array.from(groups.values())
}

export function queryHistorySummary(events = []) {
  const total = Array.isArray(events) ? events.length : 0
  const grouped = groupQueryHistoryEvents(Array.isArray(events) ? events : [])
  return {
    total,
    groups: grouped.length,
    duplicateRuns: Math.max(0, total - grouped.length),
  }
}
