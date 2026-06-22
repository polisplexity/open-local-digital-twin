import {
  compareAnalysisSelections,
  createAnalysisSession,
  getAnalysisSelection,
  listAnalysisSelectionMembers,
  listAnalysisSelections,
  persistAnalysisSelection,
} from '../../db/productionTwinStore/analysisSelectionRepository.mjs'
import { listCityTwinQueryObjectRows } from '../../db/productionTwinStore/twinQueryRepository.mjs'

const DEFAULT_SELECTION_MEMBER_LIMIT = 100000

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function positiveInteger(value, fallback) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number) || number <= 0) return fallback
  return number
}

function selectionLinks(cityId, selectionId) {
  const cityPath = encodeURIComponent(cityId)
  const selectionPath = encodeURIComponent(selectionId)
  return {
    self: `/api/live/${cityPath}/analysis-selections/${selectionPath}`,
    members: `/api/live/${cityPath}/analysis-selections/${selectionPath}/members`,
    compare: `/api/live/${cityPath}/analysis-selections/compare`,
    visualQuery: `/api/live/${cityPath}/twin-query`,
    vectorTileTemplate: `/api/live/${cityPath}/twin-query-tiles/{z}/{x}/{y}.mvt`,
  }
}

function selectionPreview(rows = [], limit = 25) {
  return rows.slice(0, limit).map((row) => ({
    cityEntityId: row.cityEntityId,
    objectId: row.objectId,
    semanticClass: row.semanticClass,
    layerKey: row.layerKey,
    label: row.label,
    centroid: row.centroid,
  }))
}

export async function createCityAnalysisSession(cityId, payload = {}) {
  return createAnalysisSession(cityId, payload)
}

export async function runCityAnalysisSelection(cityId, payload = {}) {
  const queryPayload = payload.query && typeof payload.query === 'object' ? payload.query : payload
  const maxSelectionMembers = positiveInteger(
    payload.maxSelectionMembers ?? payload.memberLimit ?? queryPayload.maxSelectionMembers,
    DEFAULT_SELECTION_MEMBER_LIMIT,
  )

  const selectionRows = await listCityTwinQueryObjectRows(cityId, {
    ...queryPayload,
    surface: payload.surface || queryPayload.surface || 'map',
    intent: payload.intent || queryPayload.intent || 'analysis',
  }, {
    limit: maxSelectionMembers,
  })

  if (!selectionRows.ok) {
    return {
      configured: selectionRows.configured,
      ok: false,
      cityId,
      selection: null,
      summary: selectionRows.summary,
      query: selectionRows.query,
      error: selectionRows.error,
    }
  }

  const persisted = await persistAnalysisSelection(cityId, {
    title: payload.title,
    sessionId: payload.sessionId,
    selectionKind: payload.selectionKind,
    actorUserId: payload.actorUserId,
    createdBy: payload.createdBy,
    style: payload.style,
    query: selectionRows.query,
    summary: selectionRows.summary,
    rows: selectionRows.rows,
  })

  if (!persisted.ok) {
    return {
      configured: persisted.configured,
      ok: false,
      cityId,
      selection: null,
      summary: selectionRows.summary,
      query: selectionRows.query,
      error: persisted.error,
    }
  }

  return {
    configured: true,
    ok: true,
    cityId,
    selection: {
      ...persisted.selection,
      links: selectionLinks(cityId, persisted.selection.id),
    },
    summary: selectionRows.summary,
    query: selectionRows.query,
    previewMembers: selectionPreview(selectionRows.rows),
    error: null,
  }
}

export async function listCityAnalysisSelections(cityId, options = {}) {
  const result = await listAnalysisSelections(cityId, options)
  if (!result.ok) return result
  return {
    ...result,
    selections: result.selections.map((selection) => ({
      ...selection,
      links: selectionLinks(cityId, selection.id),
    })),
  }
}

export async function getCityAnalysisSelection(cityId, selectionId, options = {}) {
  const result = await getAnalysisSelection(cityId, selectionId, options)
  if (!result.ok || !result.selection) return result
  return {
    ...result,
    selection: {
      ...result.selection,
      links: selectionLinks(cityId, result.selection.id),
    },
  }
}

export async function listCityAnalysisSelectionMembers(cityId, selectionId, options = {}) {
  return listAnalysisSelectionMembers(cityId, selectionId, options)
}

export async function compareCityAnalysisSelections(cityId, payload = {}) {
  return compareAnalysisSelections(cityId, {
    ...payload,
    operation: compactText(payload.operation, 'intersection'),
  })
}
