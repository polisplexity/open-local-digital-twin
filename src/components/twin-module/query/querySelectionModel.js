'use client'

import { TWIN_QUERY_CLASS_LABELS } from '../semanticQueryClient'

export function initialAnalysisSelectionState() {
  return {
    status: 'idle',
    selections: [],
    groups: [],
    active: null,
    saved: null,
    error: '',
  }
}

function labelForClass(classKey) {
  return TWIN_QUERY_CLASS_LABELS[classKey] ?? classKey
}

export function analysisSelectionLabel(selection = {}) {
  if (selection.title) return selection.title
  const classes = Array.isArray(selection.semanticClasses) ? selection.semanticClasses : []
  const labels = classes.map(labelForClass).filter(Boolean)
  if (labels.length) return labels.slice(0, 3).join(' + ')
  return 'City object selection'
}

export function analysisSelectionCountLabel(selection = {}) {
  const resultCount = Number(selection.resultCount ?? selection.metrics?.resultCount ?? 0)
  const returnedCount = Number(selection.returnedCount ?? selection.metrics?.returnedCount ?? resultCount)
  const count = Number.isFinite(resultCount) && resultCount > 0 ? resultCount : returnedCount
  const suffix = selection.truncated ? '+' : ''
  return `${Number(count || 0).toLocaleString('en-US')}${suffix}`
}

export function analysisSelectionSourceQuery(selection = {}) {
  const query = selection.sourceQuery || selection.source_query || selection.query
  return query && typeof query === 'object' ? query : null
}

export function groupAnalysisSelections(selections = []) {
  const groups = new Map()
  ;(Array.isArray(selections) ? selections : []).forEach((selection) => {
    const key = selection.queryHash || selection.id
    if (!key) return
    const current = groups.get(key)
    if (!current) {
      groups.set(key, {
        ...selection,
        duplicateCount: 1,
        latestSelection: selection,
        selectionGroupKey: key,
      })
      return
    }
    current.duplicateCount += 1
    const currentTime = Date.parse(current.latestSelection?.updatedAt || current.latestSelection?.createdAt || '')
    const nextTime = Date.parse(selection.updatedAt || selection.createdAt || '')
    if (!Number.isFinite(currentTime) || (Number.isFinite(nextTime) && nextTime > currentTime)) {
      current.latestSelection = selection
      Object.assign(current, selection, {
        duplicateCount: current.duplicateCount,
        latestSelection: selection,
        selectionGroupKey: key,
      })
    }
  })
  return Array.from(groups.values())
}
