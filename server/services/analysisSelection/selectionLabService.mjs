import {
  compareAnalysisSelections,
  createAnalysisSession,
  getAnalysisSelection,
  listAnalysisSelectionMembers,
  listAnalysisSelections,
  persistAnalysisSelection,
} from '../../db/productionTwinStore/analysisSelectionRepository.mjs'
import { getEntitySemanticContext } from '../../db/productionTwinStore/semanticContextRepository.mjs'
import { listCityTwinQueryObjectRows } from '../../db/productionTwinStore/twinQueryRepository.mjs'

const DEFAULT_SELECTION_MEMBER_LIMIT = 100000
const DEFAULT_SEMANTIC_CONTEXT_MEMBER_LIMIT = 25

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function positiveInteger(value, fallback) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number) || number <= 0) return fallback
  return number
}

function boundedInteger(value, fallback, min, max) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function flagEnabled(value) {
  if (value === true) return true
  const text = String(value ?? '').trim().toLowerCase()
  return ['1', 'true', 'yes', 'on'].includes(text)
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

function memberSemanticIdentifier(member = {}) {
  return compactText(member.cityEntityId || member.objectId || member.stableId)
}

function semanticContextLink(cityId, member = {}) {
  const identifier = memberSemanticIdentifier(member)
  if (!identifier) return ''
  return `/api/live/${encodeURIComponent(cityId)}/entities/${encodeURIComponent(identifier)}/semantic-context`
}

function attachSemanticContextLink(cityId, member = {}) {
  const link = semanticContextLink(cityId, member)
  if (!link) return member
  return {
    ...member,
    links: {
      ...(member.links && typeof member.links === 'object' ? member.links : {}),
      semanticContext: link,
    },
  }
}

function compactSemanticContext(context = {}) {
  if (!context?.ok) {
    return {
      ok: false,
      error: context?.error || 'ENTITY_SEMANTIC_CONTEXT_UNAVAILABLE',
    }
  }
  return {
    ok: true,
    entity: context.entity ? {
      id: context.entity.id,
      stableId: context.entity.stableId,
      entityType: context.entity.entityType,
      label: context.entity.label,
      authorityStatus: context.entity.authorityStatus,
      confidence: context.entity.confidence,
      lifecycleStatus: context.entity.lifecycleStatus,
    } : null,
    summary: context.summary ?? {},
    semanticTags: (context.semanticTags ?? []).map((tag) => ({
      semanticClassKey: tag.semanticClassKey,
      semanticClassLabel: tag.semanticClassLabel,
      tagKey: tag.tagKey,
      tagLabel: tag.tagLabel,
      tagValue: tag.tagValue,
      method: tag.method,
      confidence: tag.confidence,
      authorityStatus: tag.authorityStatus,
      reviewState: tag.reviewState,
    })),
    ruleChecks: (context.ruleChecks ?? []).map((check) => ({
      packKey: check.packKey,
      ruleKey: check.ruleKey,
      result: check.result,
      severity: check.severity,
      authorityStatus: check.authorityStatus,
      reviewState: check.reviewState,
    })),
  }
}

async function attachSemanticContext(cityId, members = [], options = {}) {
  const withLinks = members.map((member) => attachSemanticContextLink(cityId, member))
  if (!flagEnabled(options.includeSemanticContext)) return withLinks

  const contextLimit = boundedInteger(
    options.semanticContextLimit ?? options.contextLimit,
    DEFAULT_SEMANTIC_CONTEXT_MEMBER_LIMIT,
    1,
    50,
  )
  const ruleCheckLimit = boundedInteger(options.ruleCheckLimit, 5, 0, 25)
  const enriched = []
  for (let index = 0; index < withLinks.length; index += 1) {
    const member = withLinks[index]
    if (index >= contextLimit) {
      enriched.push(member)
      continue
    }
    const identifier = memberSemanticIdentifier(member)
    if (!identifier) {
      enriched.push(member)
      continue
    }
    const context = await getEntitySemanticContext(cityId, identifier, {
      includeGeometry: false,
      ruleCheckLimit,
    })
    enriched.push({
      ...member,
      semanticContext: compactSemanticContext(context),
    })
  }
  return enriched
}

function selectionPreview(cityId, rows = [], limit = 25) {
  return rows.slice(0, limit).map((row) => attachSemanticContextLink(cityId, {
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
    previewMembers: selectionPreview(cityId, selectionRows.rows),
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
  const result = await getAnalysisSelection(cityId, selectionId, {
    ...options,
    includeMembers: false,
  })
  if (!result.ok || !result.selection) return result
  const membersResult = flagEnabled(options.includeMembers)
    ? await listCityAnalysisSelectionMembers(cityId, selectionId, options)
    : null
  return {
    ...result,
    selection: {
      ...result.selection,
      links: selectionLinks(cityId, result.selection.id),
    },
    members: membersResult?.members ?? [],
  }
}

export async function listCityAnalysisSelectionMembers(cityId, selectionId, options = {}) {
  const result = await listAnalysisSelectionMembers(cityId, selectionId, options)
  if (!result.ok) return result
  const members = await attachSemanticContext(cityId, result.members, options)
  return {
    ...result,
    members,
    summary: {
      ...result.summary,
      semanticContextLinks: members.filter((member) => member.links?.semanticContext).length,
      semanticContextIncluded: flagEnabled(options.includeSemanticContext),
      semanticContextReturned: members.filter((member) => member.semanticContext).length,
    },
  }
}

export async function compareCityAnalysisSelections(cityId, payload = {}) {
  return compareAnalysisSelections(cityId, {
    ...payload,
    operation: compactText(payload.operation, 'intersection'),
  })
}
