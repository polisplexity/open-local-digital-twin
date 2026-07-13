'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildRawTwinQueryRequest,
  buildSqlTwinQueryRequest,
  buildTwinQueryRequest,
  maxFeaturesForViewer,
  normalizeSemanticQueryGeojson,
  normalizeTwinQueryForViewer,
} from '../semanticQueryClient'
import {
  DEFAULT_QUERY_RADIUS_PERCENT,
  defaultTwinQueryBuilder,
  intentForViewer,
} from '../viewerStateModel'
import {
  buildTwinQuerySharePayload,
  builderFromShare,
  initialQueryShareState,
  isTwinQueryShare,
  twinQueryShareTitle,
  twinQueryFromShare,
} from './queryShareModel'
import {
  analysisSelectionSourceQuery,
  initialAnalysisSelectionState,
} from './querySelectionModel'
import {
  clearQueryPassport,
  passportTargetsViewer,
  readQueryPassport,
} from './queryPassportModel'

function initialQueryState() {
  return {
    status: 'idle',
    result: null,
    error: '',
  }
}

function initialHistoryState() {
  return {
    status: 'idle',
    events: [],
    error: '',
  }
}

function initialSelectionIdFromLocation() {
  if (typeof window === 'undefined') return ''
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('selectionId') || params.get('selection') || ''
  } catch {
    return ''
  }
}

function initialExportState() {
  return {
    status: 'idle',
    format: 'csv',
    error: '',
  }
}

function initialDataSpaceState() {
  return {
    status: 'idle',
    profiles: [],
    result: null,
    error: '',
  }
}

function filenameFromDisposition(disposition = '', fallback = 'twin-query-export.csv') {
  const text = String(disposition || '')
  const match = text.match(/filename="([^"]+)"/i) || text.match(/filename=([^;]+)/i)
  return match ? match[1].trim() : fallback
}

function downloadBlob(blob, filename) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function initialPresetRequestFromLocation() {
  if (typeof window === 'undefined') return { presetId: '', run: false }
  try {
    const params = new URLSearchParams(window.location.search)
    const presetId = params.get('queryPreset') || params.get('presetId') || params.get('preset') || ''
    const runValue = String(params.get('run') || params.get('autorun') || '').toLowerCase()
    return {
      presetId,
      run: ['1', 'true', 'yes'].includes(runValue),
    }
  } catch {
    return { presetId: '', run: false }
  }
}

function initialPresetState() {
  return {
    status: 'idle',
    presets: [],
    error: '',
  }
}

function resultTransport(result) {
  return String(result?.transport || result?.query?.render?.transport || '').trim()
}

function normalizeResultForViewer(result) {
  if (!result || typeof result !== 'object') return result
  const { geojson, ...rest } = result
  if (resultTransport(result) === 'geojson' && geojson) {
    return {
      ...rest,
      geojson: normalizeSemanticQueryGeojson(geojson),
    }
  }
  return rest
}

function isRawQueryBuilder(builder = {}) {
  return builder?.mode === 'raw'
}

function isSqlQueryBuilder(builder = {}) {
  return builder?.mode === 'sql'
}

function isSubjectQueryBuilder(builder = {}) {
  return builder?.mode === 'subject'
}

function isExternalQueryBuilder(builder = {}) {
  return isRawQueryBuilder(builder) || isSqlQueryBuilder(builder) || isSubjectQueryBuilder(builder)
}

export function useTwinQueryController({
  cityCoverage,
  cityId,
  iframeLoaded,
  payload,
  postToViewer,
  refreshIndex,
  supportsCityScale,
  surfaceKey,
  twinQueryContract,
  viewerId,
  visualState,
}) {
  const initialSelectionIdRef = useRef(initialSelectionIdFromLocation())
  const initialSelectionAppliedRef = useRef(false)
  const initialPresetRequestRef = useRef(initialPresetRequestFromLocation())
  const initialPresetAppliedRef = useRef(false)
  const initialPresetRunRef = useRef(false)
  const initialCity3dPreviewRunRef = useRef('')
  const queryPassportAppliedRef = useRef(false)
  const [queryBuilder, setQueryBuilder] = useState(() => defaultTwinQueryBuilder(supportsCityScale))
  const [queryState, setQueryState] = useState(initialQueryState)
  const [queryHistory, setQueryHistory] = useState(initialHistoryState)
  const [queryPresets, setQueryPresets] = useState(initialPresetState)
  const [queryShares, setQueryShares] = useState(initialQueryShareState)
  const [querySelections, setQuerySelections] = useState(initialAnalysisSelectionState)
  const [queryExport, setQueryExport] = useState(initialExportState)
  const [queryDataSpace, setQueryDataSpace] = useState(initialDataSpaceState)

  const postQueryResult = useCallback((result) => {
    if (!result?.query) return
    const transport = resultTransport(result)
    if (result.query.language === 'oldt-subject-query' && transport === 'table') {
      postToViewer({ type: 'twin:clear-semantic-query' })
      return
    }
    const shouldUseDirectPayload = (transport === 'geojson' && result.geojson) || transport === 'table'
    const vectorTileTemplate = result.links?.vectorTileTemplate ||
      (!shouldUseDirectPayload && typeof window !== 'undefined' && result.query
        ? `${window.location.origin}/api/live/${encodeURIComponent(cityId)}/twin-query-tiles/{z}/{x}/{y}.mvt?limit=5000&query=${encodeURIComponent(JSON.stringify(result.query))}`
        : '')
    postToViewer({
      type: 'twin:set-semantic-query',
      query: result.query,
      summary: result.summary,
      ...(transport === 'geojson' && result.geojson ? { geojson: result.geojson } : {}),
      ...(result.table ? { table: result.table } : {}),
      ...(result.primitives ? { primitives: result.primitives } : {}),
      ...(result.sceneManifest ? { sceneManifest: result.sceneManifest } : {}),
      ...(result.selectionReference ? { selectionReference: result.selectionReference } : {}),
      transport,
      vectorTileTemplate,
      links: {
        ...(result.links && typeof result.links === 'object' ? result.links : {}),
        ...(vectorTileTemplate ? { vectorTileTemplate } : {}),
      },
      ...(result.selection ? { selection: result.selection } : {}),
    })
  }, [cityId, postToViewer])

  const resetQuery = useCallback(() => {
    setQueryState(initialQueryState())
    setQueryHistory((current) => ({
      ...current,
      status: current.events.length ? current.status : 'idle',
      error: '',
    }))
    setQueryShares((current) => ({
      ...current,
      status: current.shares.length ? current.status : 'idle',
      saved: null,
      error: '',
    }))
    setQuerySelections((current) => ({
      ...current,
      active: null,
      saved: null,
      error: '',
    }))
    setQueryExport(initialExportState())
    setQueryDataSpace((current) => ({
      ...initialDataSpaceState(),
      profiles: current.profiles,
    }))
    setQueryBuilder(defaultTwinQueryBuilder(supportsCityScale))
  }, [supportsCityScale])

  const clearQuery = useCallback(() => {
    setQueryState(initialQueryState())
    setQueryExport(initialExportState())
    setQuerySelections((current) => ({
      ...current,
      active: null,
      saved: null,
      error: '',
    }))
    postToViewer({ type: 'twin:clear-semantic-query' })
  }, [postToViewer])

  const loadQueryLibrary = useCallback(async () => {
    try {
      setQueryHistory((current) => ({
        ...current,
        status: 'loading',
        error: '',
      }))
      setQueryPresets((current) => ({
        ...current,
        status: 'loading',
        error: '',
      }))
      setQueryShares((current) => ({
        ...current,
        status: 'loading',
        error: '',
      }))
      setQuerySelections((current) => ({
        ...current,
        status: 'loading',
        error: '',
      }))

      const params = new URLSearchParams({
        surface: surfaceKey,
        limit: '80',
      })
      const response = await fetch(`/api/live/${cityId}/query-library?${params.toString()}`, {
        credentials: 'same-origin',
      })
      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.detail || `QUERY_LIBRARY_${response.status}`)
      }
      const analysisBucket = result.buckets?.analysisSelections ?? {}
      const presetsBucket = result.buckets?.queryPresets ?? {}
      const recordedBucket = result.buckets?.recordedActivity ?? {}
      const savedViewsBucket = result.buckets?.savedViews ?? {}
      const shares = Array.isArray(savedViewsBucket.items) ? savedViewsBucket.items.filter(isTwinQueryShare) : []
      setQueryPresets({
        status: 'ready',
        presets: Array.isArray(presetsBucket.items) ? presetsBucket.items : [],
        error: presetsBucket.error || '',
      })
      setQueryHistory({
        status: 'ready',
        events: Array.isArray(recordedBucket.items) ? recordedBucket.items : [],
        error: recordedBucket.error || '',
      })
      setQueryShares({
        status: 'ready',
        shares,
        saved: null,
        error: savedViewsBucket.error || '',
      })
      setQuerySelections((current) => ({
        status: 'ready',
        selections: Array.isArray(analysisBucket.items) ? analysisBucket.items : [],
        groups: Array.isArray(analysisBucket.groups) ? analysisBucket.groups : [],
        active: current.active,
        saved: current.saved,
        error: analysisBucket.error || '',
      }))
    } catch (error) {
      const message = String(error?.message ?? 'QUERY_LIBRARY_UNAVAILABLE')
      setQueryHistory((current) => ({
        ...current,
        status: 'error',
        error: message,
      }))
      setQueryPresets((current) => ({
        ...current,
        status: 'error',
        error: message,
      }))
      setQueryShares((current) => ({
        ...current,
        status: 'error',
        error: message,
      }))
      setQuerySelections((current) => ({
        ...current,
        status: 'error',
        error: message,
      }))
    }
  }, [cityId, surfaceKey])

  const loadQueryHistory = loadQueryLibrary
  const loadQueryShares = loadQueryLibrary
  const loadAnalysisSelections = loadQueryLibrary

  const changeQueryBuilder = useCallback((nextBuilder) => {
    const incomingBuilder = nextBuilder && typeof nextBuilder === 'object' ? nextBuilder : {}
    const fallbackBuilder = defaultTwinQueryBuilder(supportsCityScale)
    setQueryBuilder({
      mode: incomingBuilder.mode === 'sql'
        ? 'sql'
        : incomingBuilder.mode === 'raw'
          ? 'raw'
          : 'builder',
      presetId: typeof incomingBuilder.presetId === 'string' ? incomingBuilder.presetId : '',
      presetTitle: typeof incomingBuilder.presetTitle === 'string' ? incomingBuilder.presetTitle : '',
      rawText: typeof incomingBuilder.rawText === 'string' ? incomingBuilder.rawText : '',
      sqlText: typeof incomingBuilder.sqlText === 'string' ? incomingBuilder.sqlText : '',
      operation: incomingBuilder.operation || 'union',
      clauses: Array.isArray(incomingBuilder.clauses) && incomingBuilder.clauses.length
        ? incomingBuilder.clauses
        : fallbackBuilder.clauses,
      classKey: incomingBuilder.classKey || 'buildings',
      scopeKey: incomingBuilder.scopeKey || (supportsCityScale ? 'radius' : 'city'),
      radiusPercent: Math.min(100, Math.max(0, Number(incomingBuilder.radiusPercent ?? DEFAULT_QUERY_RADIUS_PERCENT) || 0)),
      radiusMeters: incomingBuilder.radiusMeters ?? '',
      predicateMode: String(incomingBuilder.predicateMode || 'and').toLowerCase() === 'or' ? 'or' : 'and',
      predicates: Array.isArray(incomingBuilder.predicates) && incomingBuilder.predicates.length
        ? incomingBuilder.predicates
        : fallbackBuilder.predicates,
      renderMode: incomingBuilder.renderMode || 'isolate',
      subjectQuery: incomingBuilder.subjectQuery && typeof incomingBuilder.subjectQuery === 'object'
        ? incomingBuilder.subjectQuery
        : fallbackBuilder.subjectQuery,
    })
  }, [supportsCityScale])

  const buildCurrentQueryRequest = useCallback(() => {
    if (isSubjectQueryBuilder(queryBuilder)) {
      return {
        ...(queryBuilder.subjectQuery && typeof queryBuilder.subjectQuery === 'object' ? queryBuilder.subjectQuery : {}),
        metadata: {
          ...(queryBuilder.subjectQuery?.metadata && typeof queryBuilder.subjectQuery.metadata === 'object'
            ? queryBuilder.subjectQuery.metadata
            : {}),
          source: 'visual-secondary-rail-subject-query',
          surface: surfaceKey,
          viewerId,
        },
      }
    }
    if (isRawQueryBuilder(queryBuilder)) {
      return buildRawTwinQueryRequest({
        rawText: queryBuilder.rawText,
        surface: surfaceKey,
        viewerId,
      })
    }
    if (isSqlQueryBuilder(queryBuilder)) {
      return buildSqlTwinQueryRequest({
        presetId: queryBuilder.presetId,
        presetTitle: queryBuilder.presetTitle,
        sqlText: queryBuilder.sqlText,
        surface: surfaceKey,
        viewerId,
      })
    }
    return buildTwinQueryRequest({
      builder: queryBuilder,
      cityCoverage,
      payload,
      surface: surfaceKey,
      viewerId,
    })
  }, [
    cityCoverage,
    payload,
    queryBuilder,
    surfaceKey,
    viewerId,
  ])

  const applyQueryPreset = useCallback((preset) => {
    if (!preset || typeof preset !== 'object') return
    if (preset.mode === 'builder' || (preset.builder && typeof preset.builder === 'object')) {
      changeQueryBuilder({
        ...defaultTwinQueryBuilder(supportsCityScale),
        ...(preset.builder && typeof preset.builder === 'object' ? preset.builder : {}),
        mode: 'builder',
        presetId: preset.id || preset.key || '',
        presetTitle: preset.title || preset.label || '',
        sqlText: preset.sqlText || preset.query?.sqlText || '',
      })
      return
    }
    if (preset.mode === 'sql' || preset.language === 'postgis-sql' || preset.sqlWhere || preset.sqlText || preset.query?.sqlWhere || preset.query?.sqlText) {
      changeQueryBuilder({
        ...defaultTwinQueryBuilder(supportsCityScale),
        mode: 'sql',
        presetId: preset.id || preset.key || '',
        presetTitle: preset.title || preset.label || '',
        sqlText: preset.sqlText || preset.query?.sqlText || preset.sqlWhere || preset.query?.sqlWhere || '',
      })
      return
    }
    if (preset.query && typeof preset.query === 'object') {
      changeQueryBuilder({
        ...defaultTwinQueryBuilder(supportsCityScale),
        mode: 'raw',
        presetId: preset.id || preset.key || '',
        presetTitle: preset.title || preset.label || '',
        rawText: JSON.stringify(preset.query, null, 2),
      })
    }
  }, [changeQueryBuilder, supportsCityScale])

  const runQuery = useCallback(async () => {
    if (!payload && !isExternalQueryBuilder(queryBuilder)) return
    const endpoint = isSubjectQueryBuilder(queryBuilder)
      ? `/api/live/${cityId}/subject-query`
      : `/api/live/${cityId}/twin-query`

    try {
      setQueryState((current) => ({
        ...current,
        status: 'running',
        error: '',
      }))
      setQuerySelections((current) => ({
        ...current,
        active: null,
        saved: null,
        error: '',
      }))
      const requestPayload = buildCurrentQueryRequest()
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })
      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.detail || `SEMANTIC_QUERY_${response.status}`)
      }
      const nextResult = normalizeResultForViewer(result)
      setQueryState({
        status: 'ready',
        result: nextResult,
        error: '',
      })
      postQueryResult(nextResult)
      loadQueryLibrary()
    } catch (error) {
      setQueryState({
        status: 'error',
        result: null,
        error: String(error?.message ?? 'SEMANTIC_QUERY_FAILED'),
      })
      postToViewer({ type: 'twin:clear-semantic-query' })
    }
  }, [
    buildCurrentQueryRequest,
    cityId,
    loadQueryLibrary,
    payload,
    postQueryResult,
    postToViewer,
    queryBuilder,
  ])

  const exportQuery = useCallback(async (format = 'csv') => {
    if (!payload && !isExternalQueryBuilder(queryBuilder)) return
    const normalizedFormat = String(format || 'csv').toLowerCase()

    try {
      setQueryExport({
        status: 'running',
        format: normalizedFormat,
        error: '',
      })
      const requestPayload = buildCurrentQueryRequest()
      const response = await fetch(`/api/live/${cityId}/twin-query/export`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: requestPayload,
          format: normalizedFormat,
          limit: normalizedFormat === 'geojson' || normalizedFormat === 'cityjson' ? 20000 : 50000,
          surface: surfaceKey,
          intent: 'export',
          metadata: { source: 'visual-secondary-rail-download' },
        }),
      })
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.detail || errorPayload?.error || `TWIN_QUERY_EXPORT_${response.status}`)
      }
      const blob = await response.blob()
      const filename = filenameFromDisposition(
        response.headers.get('content-disposition'),
        `twin-query-export.${normalizedFormat}`,
      )
      downloadBlob(blob, filename)
      setQueryExport({
        status: 'ready',
        format: normalizedFormat,
        error: '',
      })
    } catch (error) {
      setQueryExport({
        status: 'error',
        format: normalizedFormat,
        error: String(error?.message ?? 'TWIN_QUERY_EXPORT_FAILED'),
      })
    }
  }, [
    buildCurrentQueryRequest,
    cityId,
    payload,
    queryBuilder,
    surfaceKey,
  ])

  const loadDataSpaceProfiles = useCallback(async () => {
    try {
      setQueryDataSpace((current) => ({ ...current, status: 'loading', error: '' }))
      const params = new URLSearchParams({ platformKind: 'data-space-ready' })
      const response = await fetch(`/api/admin/eu-ldt/integrations?${params.toString()}`, {
        credentials: 'same-origin',
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.detail || `DATA_SPACE_PROFILES_${response.status}`)
      }
      setQueryDataSpace((current) => ({
        ...current,
        status: 'ready',
        profiles: Array.isArray(result.profiles) ? result.profiles : [],
        error: '',
      }))
      return result.profiles ?? []
    } catch (error) {
      setQueryDataSpace((current) => ({
        ...current,
        status: 'error',
        error: String(error?.message ?? 'DATA_SPACE_PROFILES_UNAVAILABLE'),
      }))
      return []
    }
  }, [])

  const publishQueryToDataSpace = useCallback(async (options = {}) => {
    if (!payload && !isExternalQueryBuilder(queryBuilder)) return null
    const providerIntegrationProfileKey = String(options.providerIntegrationProfileKey || '').trim()
    if (!providerIntegrationProfileKey) {
      setQueryDataSpace((current) => ({
        ...current,
        status: 'error',
        error: 'Select a data-space provider.',
      }))
      return null
    }
    try {
      setQueryDataSpace((current) => ({ ...current, status: 'publishing', result: null, error: '' }))
      const requestPayload = buildCurrentQueryRequest()
      const createResponse = await fetch('/api/admin/workflows/eu-ldt-data-space-publish/runs', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityId,
          triggerKind: 'operator-query-publication',
          input: {
            providerIntegrationProfileKey,
            query: requestPayload,
            title: String(options.title || `${cityId} OLDT query package`).trim(),
            description: String(options.description || 'Bounded OLDT TwinQuery package published as a governed EDC offer.').trim(),
            licence: String(options.licence || 'CC-BY-4.0').trim(),
            format: String(options.format || 'geojson').toLowerCase(),
            limit: Number(options.limit) || 500,
          },
        }),
      })
      const created = await createResponse.json().catch(() => ({}))
      if (!createResponse.ok || !created?.ok || !created.run?.id) {
        throw new Error(created?.error || created?.detail || `DATA_SPACE_RUN_CREATE_${createResponse.status}`)
      }

      for (const approval of created.run.approvals ?? []) {
        const approvalResponse = await fetch(
          `/api/admin/workflow-runs/${encodeURIComponent(created.run.id)}/approvals/${encodeURIComponent(approval.approvalKey)}/decision`,
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              decision: 'approved',
              reason: 'Operator initiated the governed query publication from the OLDT query workspace.',
            }),
          },
        )
        const approvalResult = await approvalResponse.json().catch(() => ({}))
        if (!approvalResponse.ok || !approvalResult?.ok) {
          throw new Error(approvalResult?.error || approvalResult?.detail || `DATA_SPACE_APPROVAL_${approvalResponse.status}`)
        }
      }

      const executeResponse = await fetch(`/api/admin/workflow-runs/${encodeURIComponent(created.run.id)}/execute`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId: 'oldt-query-data-space-publish-ui' }),
      })
      const executed = await executeResponse.json().catch(() => ({}))
      if (!executeResponse.ok || !executed?.ok) {
        throw new Error(executed?.error || executed?.detail || `DATA_SPACE_PUBLICATION_${executeResponse.status}`)
      }
      setQueryDataSpace((current) => ({
        ...current,
        status: 'ready',
        result: executed.summary ?? null,
        error: '',
      }))
      return executed.summary ?? null
    } catch (error) {
      setQueryDataSpace((current) => ({
        ...current,
        status: 'error',
        result: null,
        error: String(error?.message ?? 'DATA_SPACE_PUBLICATION_FAILED'),
      }))
      return null
    }
  }, [buildCurrentQueryRequest, cityId, payload, queryBuilder])

  const fetchAnalysisSelection = useCallback(async (selectionId) => {
    const response = await fetch(`/api/live/${cityId}/analysis-selections/${encodeURIComponent(selectionId)}`, {
      credentials: 'same-origin',
    })
    const result = await response.json()
    if (!response.ok || !result?.ok || !result.selection) {
      throw new Error(result?.error || result?.detail || `ANALYSIS_SELECTION_${response.status}`)
    }
    return result.selection
  }, [cityId])

  const replayAnalysisSelection = useCallback(async (selectionOrId) => {
    try {
      const selection = typeof selectionOrId === 'string'
        ? await fetchAnalysisSelection(selectionOrId)
        : selectionOrId
      const sourceQuery = analysisSelectionSourceQuery(selection)
      if (!sourceQuery) return

      const endpoint = `/api/live/${cityId}/twin-query`
      const requestPayload = {
        ...normalizeTwinQueryForViewer(sourceQuery, {
          surface: surfaceKey,
          viewerId,
          intent: intentForViewer(viewerId),
        }),
        metadata: {
          ...(sourceQuery.metadata && typeof sourceQuery.metadata === 'object'
            ? sourceQuery.metadata
            : {}),
          source: 'visual-secondary-rail-analysis-selection',
          selectionId: selection.id,
          queryHash: selection.queryHash,
          selectionResultCount: selection.resultCount,
        },
      }

      setQueryState((current) => ({
        ...current,
        status: 'running',
        error: '',
      }))
      setQuerySelections((current) => ({
        ...current,
        status: current.selections.length ? current.status : 'loading',
        active: selection,
        error: '',
      }))
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })
      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.detail || `SEMANTIC_QUERY_${response.status}`)
      }
      const nextResult = {
        ...normalizeResultForViewer(result),
        selection,
      }
      setQueryState({
        status: 'ready',
        result: nextResult,
        error: '',
      })
      setQuerySelections((current) => ({
        ...current,
        status: 'ready',
        active: selection,
        saved: current.saved,
        error: '',
      }))
      postQueryResult(nextResult)
      loadQueryLibrary()
    } catch (error) {
      setQueryState({
        status: 'error',
        result: null,
        error: String(error?.message ?? 'ANALYSIS_SELECTION_REPLAY_FAILED'),
      })
      setQuerySelections((current) => ({
        ...current,
        status: 'error',
        error: String(error?.message ?? 'ANALYSIS_SELECTION_REPLAY_FAILED'),
      }))
      postToViewer({ type: 'twin:clear-semantic-query' })
    }
  }, [
    cityId,
    fetchAnalysisSelection,
    loadQueryLibrary,
    postQueryResult,
    postToViewer,
    surfaceKey,
    viewerId,
  ])

  const saveAnalysisSelection = useCallback(async () => {
    if (!payload && !isExternalQueryBuilder(queryBuilder)) return
    try {
      setQuerySelections((current) => ({
        ...current,
        status: 'saving',
        saved: null,
        error: '',
      }))
      const requestPayload = buildCurrentQueryRequest()
      if (isSubjectQueryBuilder(queryBuilder)) {
        const indicatorLabel = queryBuilder.subjectQuery?.indicator?.key || 'context'
        const subjectLabel = queryBuilder.subjectQuery?.subject?.types?.[0] || 'subjects'
        const selectionTitle = queryBuilder.presetTitle || `${subjectLabel} by ${indicatorLabel}`
        const response = await fetch(`/api/live/${cityId}/subject-query-blueprints`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: selectionTitle,
            blueprintKey: `${subjectLabel}-${indicatorLabel}-${Date.now()}`,
            portabilityScope: 'city',
            visibility: 'municipal',
            query: requestPayload,
            renderer: queryState.result?.manifest ?? {},
          }),
        })
        const result = await response.json()
        if (!response.ok || !result?.ok || !result.blueprint) {
          throw new Error(result?.error || result?.detail || `SUBJECT_QUERY_BLUEPRINT_SAVE_${response.status}`)
        }
        setQuerySelections((current) => ({
          ...current,
          status: 'ready',
          saved: result.blueprint,
          error: '',
        }))
        setQueryBuilder((current) => ({
          ...current,
          presetId: result.blueprint.id,
          presetTitle: result.blueprint.title,
        }))
        loadQueryLibrary()
        return
      }
      const selectionTitle = queryBuilder.presetTitle
        ? `${queryBuilder.presetTitle} fragment`
        : `${twinQueryShareTitle(queryBuilder, supportsCityScale)} selection`
      const response = await fetch(`/api/live/${cityId}/analysis-selections/query`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selectionTitle,
          selectionKind: 'twinql-selection',
          maxSelectionMembers: 100000,
          surface: surfaceKey,
          intent: intentForViewer(viewerId),
          query: requestPayload,
        }),
      })
      const result = await response.json()
      if (!response.ok || !result?.ok || !result.selection) {
        throw new Error(result?.error || result?.detail || `ANALYSIS_SELECTION_SAVE_${response.status}`)
      }
      const savedSelection = result.selection
      setQuerySelections((current) => ({
        status: 'ready',
        selections: [
          savedSelection,
          ...current.selections.filter((selection) => selection.id !== savedSelection.id),
        ],
        groups: current.groups,
        active: savedSelection,
        saved: savedSelection,
        error: '',
      }))
      loadQueryLibrary()
    } catch (error) {
      setQuerySelections((current) => ({
        ...current,
        status: 'error',
        saved: null,
        error: String(error?.message ?? 'ANALYSIS_SELECTION_SAVE_FAILED'),
      }))
    }
  }, [
    buildCurrentQueryRequest,
    cityId,
    loadQueryLibrary,
    payload,
    queryBuilder,
    queryState.result,
    surfaceKey,
    supportsCityScale,
    viewerId,
  ])

  const replayQuery = useCallback(async (event) => {
    if (!event?.query) return
    const endpoint = `/api/live/${cityId}/twin-query`
    const previousRender = event.query.render && typeof event.query.render === 'object' ? event.query.render : {}
    const requestPayload = {
      ...normalizeTwinQueryForViewer(event.query, {
        surface: surfaceKey,
        viewerId,
        intent: intentForViewer(viewerId),
      }),
      metadata: {
        ...(event.metadata && typeof event.metadata === 'object' ? event.metadata : {}),
        source: 'visual-secondary-rail-query-history',
        replayEventId: event.id,
        replayOriginalMaxFeatures: previousRender.maxFeatures ?? null,
        replayViewerMaxFeatures: maxFeaturesForViewer(viewerId),
      },
    }

    try {
      setQueryState((current) => ({
        ...current,
        status: 'running',
        error: '',
      }))
      setQuerySelections((current) => ({
        ...current,
        active: null,
        saved: null,
        error: '',
      }))
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })
      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.detail || `SEMANTIC_QUERY_${response.status}`)
      }
      const nextResult = normalizeResultForViewer(result)
      setQueryState({
        status: 'ready',
        result: nextResult,
        error: '',
      })
      postQueryResult(nextResult)
      loadQueryLibrary()
    } catch (error) {
      setQueryState({
        status: 'error',
        result: null,
        error: String(error?.message ?? 'SEMANTIC_QUERY_REPLAY_FAILED'),
      })
      postToViewer({ type: 'twin:clear-semantic-query' })
    }
  }, [
    cityId,
    loadQueryLibrary,
    postQueryResult,
    postToViewer,
    surfaceKey,
    viewerId,
  ])

  const saveQueryShare = useCallback(async () => {
    if (!payload && !isExternalQueryBuilder(queryBuilder)) return
    try {
      setQueryShares((current) => ({
        ...current,
        status: 'saving',
        saved: null,
        error: '',
      }))
      const sharePayload = buildTwinQuerySharePayload({
        builder: queryBuilder,
        cityCoverage,
        payload,
        surfaceKey,
        supportsCityScale,
        viewerId,
        visualState,
      })
      const response = await fetch(`/api/live/${cityId}/viewer-share-manifests`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sharePayload),
      })
      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.detail || `QUERY_SHARE_SAVE_${response.status}`)
      }
      const savedShare = result.share ?? null
      setQueryShares((current) => ({
        status: 'ready',
        shares: savedShare
          ? [savedShare, ...current.shares.filter((share) => share.shareKey !== savedShare.shareKey)].filter(isTwinQueryShare)
          : current.shares,
        saved: savedShare,
        error: '',
      }))
    } catch (error) {
      setQueryShares((current) => ({
        ...current,
        status: 'error',
        saved: null,
        error: String(error?.message ?? 'QUERY_SHARE_SAVE_FAILED'),
      }))
    }
  }, [
    cityCoverage,
    cityId,
    payload,
    queryBuilder,
    surfaceKey,
    supportsCityScale,
    viewerId,
    visualState,
  ])

  const publishQueryShare = useCallback(async (share) => {
    if (!share?.shareKey) return
    try {
      setQueryShares((current) => ({
        ...current,
        status: 'publishing',
        saved: null,
        error: '',
      }))
      const response = await fetch(`/api/live/${cityId}/viewer-share-manifests/${share.shareKey}/publish`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessPolicy: 'signed-token',
          publicationStatus: 'published',
        }),
      })
      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.detail || `QUERY_SHARE_PUBLISH_${response.status}`)
      }
      const publishedShare = result.share ?? null
      setQueryShares((current) => ({
        status: 'ready',
        shares: publishedShare
          ? current.shares
              .map((entry) => (entry.shareKey === publishedShare.shareKey ? publishedShare : entry))
              .concat(current.shares.some((entry) => entry.shareKey === publishedShare.shareKey) ? [] : [publishedShare])
              .filter(isTwinQueryShare)
          : current.shares,
        saved: publishedShare,
        error: '',
      }))
    } catch (error) {
      setQueryShares((current) => ({
        ...current,
        status: 'error',
        saved: null,
        error: String(error?.message ?? 'QUERY_SHARE_PUBLISH_FAILED'),
      }))
    }
  }, [cityId])

  const replayQueryShare = useCallback(async (share) => {
    const shareQuery = twinQueryFromShare(share, { surfaceKey, viewerId })
    if (!shareQuery) return
    const endpoint = `/api/live/${cityId}/twin-query`
    const requestPayload = normalizeTwinQueryForViewer(shareQuery, {
      surface: surfaceKey,
      viewerId,
      intent: intentForViewer(viewerId),
    })

    try {
      setQueryState((current) => ({
        ...current,
        status: 'running',
        error: '',
      }))
      setQuerySelections((current) => ({
        ...current,
        active: null,
        saved: null,
        error: '',
      }))
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })
      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.detail || `SEMANTIC_QUERY_${response.status}`)
      }
      const nextResult = normalizeResultForViewer(result)
      const savedBuilder = builderFromShare(share)
      if (savedBuilder) changeQueryBuilder(savedBuilder)
      setQueryState({
        status: 'ready',
        result: nextResult,
        error: '',
      })
      postQueryResult(nextResult)
      loadQueryLibrary()
    } catch (error) {
      setQueryState({
        status: 'error',
        result: null,
        error: String(error?.message ?? 'QUERY_SHARE_REPLAY_FAILED'),
      })
      postToViewer({ type: 'twin:clear-semantic-query' })
    }
  }, [
    changeQueryBuilder,
    cityId,
    loadQueryLibrary,
    postQueryResult,
    postToViewer,
    surfaceKey,
    viewerId,
  ])

  const applyQueryPassport = useCallback(async (passport) => {
    if (!passport?.query) return
    const sourceMetadata = passport.query.metadata && typeof passport.query.metadata === 'object'
      ? passport.query.metadata
      : {}
    const requestPayload = {
      ...normalizeTwinQueryForViewer(passport.query, {
        surface: surfaceKey,
        viewerId,
        intent: intentForViewer(viewerId),
      }),
      metadata: {
        ...sourceMetadata,
        source: 'visualization-studio-query-passport',
        previousSource: sourceMetadata.source || null,
        sourceViewer: passport.sourceViewer || '',
        targetViewer: viewerId,
        passportId: passport.id || '',
        passportCreatedAt: passport.createdAt || '',
      },
    }

    try {
      if (passport.builder && typeof passport.builder === 'object') {
        changeQueryBuilder(passport.builder)
      }
      setQueryState((current) => ({
        ...current,
        status: 'running',
        error: '',
      }))
      setQuerySelections((current) => ({
        ...current,
        active: null,
        saved: null,
        error: '',
      }))
      const response = await fetch(`/api/live/${cityId}/twin-query`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })
      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.detail || `QUERY_PASSPORT_${response.status}`)
      }
      const nextResult = normalizeResultForViewer(result)
      setQueryState({
        status: 'ready',
        result: nextResult,
        error: '',
      })
      postQueryResult(nextResult)
      loadQueryLibrary()
    } catch (error) {
      setQueryState({
        status: 'error',
        result: null,
        error: String(error?.message ?? 'QUERY_PASSPORT_FAILED'),
      })
      postToViewer({ type: 'twin:clear-semantic-query' })
    } finally {
      clearQueryPassport(passport.id || '')
    }
  }, [
    changeQueryBuilder,
    cityId,
    loadQueryLibrary,
    postQueryResult,
    postToViewer,
    surfaceKey,
    viewerId,
  ])

  useEffect(() => {
    if (!twinQueryContract) return
    loadQueryLibrary()
  }, [loadQueryLibrary, refreshIndex, twinQueryContract])

  useEffect(() => {
    if (
      queryPassportAppliedRef.current ||
      initialSelectionIdRef.current ||
      !payload ||
      !iframeLoaded ||
      !twinQueryContract
    ) {
      return
    }
    const passport = readQueryPassport()
    if (!passportTargetsViewer(passport, viewerId)) return
    queryPassportAppliedRef.current = true
    applyQueryPassport(passport)
  }, [
    applyQueryPassport,
    iframeLoaded,
    payload,
    twinQueryContract,
    viewerId,
  ])

  useEffect(() => {
    const requestedPresetId = initialPresetRequestRef.current.presetId
    if (
      !requestedPresetId ||
      initialSelectionIdRef.current ||
      initialPresetAppliedRef.current ||
      !payload ||
      !twinQueryContract ||
      queryPresets.status !== 'ready'
    ) {
      return
    }
    initialPresetAppliedRef.current = true
    const preset = queryPresets.presets.find((entry) => entry.id === requestedPresetId || entry.key === requestedPresetId)
    if (preset) applyQueryPreset(preset)
  }, [applyQueryPreset, payload, queryPresets, twinQueryContract])

  useEffect(() => {
    const requestedPreset = initialPresetRequestRef.current
    if (
      !requestedPreset.presetId ||
      !requestedPreset.run ||
      initialSelectionIdRef.current ||
      initialPresetRunRef.current ||
      queryBuilder.presetId !== requestedPreset.presetId ||
      queryState.status !== 'idle' ||
      !payload ||
      !iframeLoaded ||
      !twinQueryContract
    ) {
      return
    }
    initialPresetRunRef.current = true
    runQuery()
  }, [
    iframeLoaded,
    payload,
    queryBuilder.presetId,
    queryState.status,
    runQuery,
    twinQueryContract,
  ])

  useEffect(() => {
    if (
      !initialSelectionIdRef.current ||
      initialSelectionAppliedRef.current ||
      !payload ||
      !iframeLoaded ||
      !twinQueryContract
    ) {
      return
    }
    initialSelectionAppliedRef.current = true
    replayAnalysisSelection(initialSelectionIdRef.current)
  }, [iframeLoaded, payload, replayAnalysisSelection, twinQueryContract])

  useEffect(() => {
    if (
      viewerId !== '3d' ||
      !iframeLoaded ||
      !payload ||
      !twinQueryContract ||
      queryState.status !== 'idle' ||
      initialSelectionIdRef.current
    ) {
      return
    }
    const previewKey = `${cityId}:${refreshIndex}`
    if (initialCity3dPreviewRunRef.current === previewKey) return
    initialCity3dPreviewRunRef.current = previewKey
    runQuery()
  }, [
    cityId,
    iframeLoaded,
    payload,
    queryState.status,
    refreshIndex,
    runQuery,
    twinQueryContract,
    viewerId,
  ])

  useEffect(() => {
    if (!iframeLoaded || queryState.status !== 'ready' || !queryState.result) return
    postQueryResult(queryState.result)
  }, [iframeLoaded, postQueryResult, queryState])

  return {
    queryBuilder,
    queryError: queryState.error,
    queryExport,
    queryDataSpace,
    queryHistory,
    queryPresets,
    queryResult: queryState.result,
    querySelections,
    queryShares,
    queryStatus: queryState.status,
    changeQueryBuilder,
    clearQuery,
    exportQuery,
    loadDataSpaceProfiles,
    loadQueryHistory,
    loadAnalysisSelections,
    loadQueryShares,
    applyQueryPreset,
    replayAnalysisSelection,
    replayQuery,
    replayQueryShare,
    resetQuery,
    runQuery,
    saveAnalysisSelection,
    saveQueryShare,
    publishQueryShare,
    publishQueryToDataSpace,
    buildCurrentQueryRequest,
  }
}
