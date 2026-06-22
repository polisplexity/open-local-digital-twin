'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
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
}) {
  const initialSelectionIdRef = useRef(initialSelectionIdFromLocation())
  const initialSelectionAppliedRef = useRef(false)
  const [queryBuilder, setQueryBuilder] = useState(() => defaultTwinQueryBuilder(supportsCityScale))
  const [queryState, setQueryState] = useState(initialQueryState)
  const [queryHistory, setQueryHistory] = useState(initialHistoryState)
  const [queryShares, setQueryShares] = useState(initialQueryShareState)
  const [querySelections, setQuerySelections] = useState(initialAnalysisSelectionState)

  const postQueryResult = useCallback((result) => {
    if (!result?.query) return
    const vectorTileTemplate = result.links?.vectorTileTemplate ||
      (typeof window !== 'undefined' && result.query
        ? `${window.location.origin}/api/live/${encodeURIComponent(cityId)}/twin-query-tiles/{z}/{x}/{y}.mvt?limit=300000&query=${encodeURIComponent(JSON.stringify(result.query))}`
        : '')
    postToViewer({
      type: 'twin:set-semantic-query',
      query: result.query,
      summary: result.summary,
      ...(result.geojson ? { geojson: result.geojson } : {}),
      ...(result.primitives ? { primitives: result.primitives } : {}),
      ...(result.sceneManifest ? { sceneManifest: result.sceneManifest } : {}),
      transport: result.transport || result.query?.render?.transport || '',
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
    setQueryBuilder(defaultTwinQueryBuilder(supportsCityScale))
  }, [supportsCityScale])

  const clearQuery = useCallback(() => {
    setQueryState(initialQueryState())
    setQuerySelections((current) => ({
      ...current,
      active: null,
      saved: null,
      error: '',
    }))
    postToViewer({ type: 'twin:clear-semantic-query' })
  }, [postToViewer])

  const loadQueryHistory = useCallback(async () => {
    try {
      setQueryHistory((current) => ({
        ...current,
        status: 'loading',
        error: '',
      }))
      const params = new URLSearchParams({
        surface: surfaceKey,
        limit: '80',
      })
      const response = await fetch(`/api/live/${cityId}/twin-query-events?${params.toString()}`, {
        credentials: 'same-origin',
      })
      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.detail || `TWIN_QUERY_EVENTS_${response.status}`)
      }
      setQueryHistory({
        status: 'ready',
        events: Array.isArray(result.events) ? result.events : [],
        error: '',
      })
    } catch (error) {
      setQueryHistory((current) => ({
        ...current,
        status: 'error',
        error: String(error?.message ?? 'TWIN_QUERY_EVENTS_UNAVAILABLE'),
      }))
    }
  }, [cityId, surfaceKey])

  const loadQueryShares = useCallback(async () => {
    try {
      setQueryShares((current) => ({
        ...current,
        status: 'loading',
        error: '',
      }))
      const params = new URLSearchParams({
        surface: surfaceKey,
        mode: 'twin-query-manifest',
        limit: '20',
      })
      const response = await fetch(`/api/live/${cityId}/viewer-share-manifests?${params.toString()}`, {
        credentials: 'same-origin',
      })
      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.detail || `QUERY_SHARE_MANIFESTS_${response.status}`)
      }
      const shares = Array.isArray(result.shares) ? result.shares.filter(isTwinQueryShare) : []
      setQueryShares({
        status: 'ready',
        shares,
        saved: null,
        error: '',
      })
    } catch (error) {
      setQueryShares((current) => ({
        ...current,
        status: 'error',
        error: String(error?.message ?? 'QUERY_SHARE_MANIFESTS_UNAVAILABLE'),
      }))
    }
  }, [cityId, surfaceKey])

  const loadAnalysisSelections = useCallback(async () => {
    try {
      setQuerySelections((current) => ({
        ...current,
        status: 'loading',
        error: '',
      }))
      const params = new URLSearchParams({
        limit: '80',
      })
      const response = await fetch(`/api/live/${cityId}/analysis-selections?${params.toString()}`, {
        credentials: 'same-origin',
      })
      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.detail || `ANALYSIS_SELECTIONS_${response.status}`)
      }
      setQuerySelections((current) => ({
        status: 'ready',
        selections: Array.isArray(result.selections) ? result.selections : [],
        groups: Array.isArray(result.groups) ? result.groups : [],
        active: current.active,
        saved: current.saved,
        error: '',
      }))
    } catch (error) {
      setQuerySelections((current) => ({
        ...current,
        status: 'error',
        error: String(error?.message ?? 'ANALYSIS_SELECTIONS_UNAVAILABLE'),
      }))
    }
  }, [cityId])

  const changeQueryBuilder = useCallback((nextBuilder) => {
    const fallbackBuilder = defaultTwinQueryBuilder(supportsCityScale)
    setQueryBuilder({
      operation: nextBuilder.operation || 'union',
      clauses: Array.isArray(nextBuilder.clauses) && nextBuilder.clauses.length
        ? nextBuilder.clauses
        : fallbackBuilder.clauses,
      classKey: nextBuilder.classKey || 'buildings',
      scopeKey: nextBuilder.scopeKey || (supportsCityScale ? 'radius' : 'city'),
      radiusPercent: Math.min(100, Math.max(0, Number(nextBuilder.radiusPercent ?? DEFAULT_QUERY_RADIUS_PERCENT) || 0)),
      radiusMeters: nextBuilder.radiusMeters ?? '',
      predicateMode: String(nextBuilder.predicateMode || 'and').toLowerCase() === 'or' ? 'or' : 'and',
      predicates: Array.isArray(nextBuilder.predicates) && nextBuilder.predicates.length
        ? nextBuilder.predicates
        : fallbackBuilder.predicates,
      renderMode: nextBuilder.renderMode || 'isolate',
    })
  }, [supportsCityScale])

  const runQuery = useCallback(async () => {
    if (!payload) return
    const endpoint = `/api/live/${cityId}/twin-query`
    const requestPayload = buildTwinQueryRequest({
      builder: queryBuilder,
      cityCoverage,
      payload,
      surface: surfaceKey,
      viewerId,
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
      const nextResult = {
        ...result,
        ...(result.geojson ? { geojson: normalizeSemanticQueryGeojson(result.geojson) } : {}),
      }
      setQueryState({
        status: 'ready',
        result: nextResult,
        error: '',
      })
      postQueryResult(nextResult)
      loadQueryHistory()
      loadQueryShares()
      loadAnalysisSelections()
    } catch (error) {
      setQueryState({
        status: 'error',
        result: null,
        error: String(error?.message ?? 'SEMANTIC_QUERY_FAILED'),
      })
      postToViewer({ type: 'twin:clear-semantic-query' })
    }
  }, [
    cityCoverage,
    cityId,
    loadQueryHistory,
    loadAnalysisSelections,
    loadQueryShares,
    payload,
    postQueryResult,
    postToViewer,
    queryBuilder,
    surfaceKey,
    viewerId,
  ])

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
        ...result,
        ...(result.geojson ? { geojson: normalizeSemanticQueryGeojson(result.geojson) } : {}),
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
      loadQueryHistory()
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
    loadQueryHistory,
    postQueryResult,
    postToViewer,
    surfaceKey,
    viewerId,
  ])

  const saveAnalysisSelection = useCallback(async () => {
    if (!payload) return
    const requestPayload = buildTwinQueryRequest({
      builder: queryBuilder,
      cityCoverage,
      payload,
      surface: surfaceKey,
      viewerId,
    })
    try {
      setQuerySelections((current) => ({
        ...current,
        status: 'saving',
        saved: null,
        error: '',
      }))
      const response = await fetch(`/api/live/${cityId}/analysis-selections/query`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${twinQueryShareTitle(queryBuilder, supportsCityScale)} selection`,
          selectionKind: 'visual-analysis-selection',
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
      loadAnalysisSelections()
    } catch (error) {
      setQuerySelections((current) => ({
        ...current,
        status: 'error',
        saved: null,
        error: String(error?.message ?? 'ANALYSIS_SELECTION_SAVE_FAILED'),
      }))
    }
  }, [
    cityCoverage,
    cityId,
    loadAnalysisSelections,
    payload,
    queryBuilder,
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
      const nextResult = {
        ...result,
        ...(result.geojson ? { geojson: normalizeSemanticQueryGeojson(result.geojson) } : {}),
      }
      setQueryState({
        status: 'ready',
        result: nextResult,
        error: '',
      })
      postQueryResult(nextResult)
      loadQueryHistory()
      loadAnalysisSelections()
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
    loadQueryHistory,
    loadAnalysisSelections,
    postQueryResult,
    postToViewer,
    surfaceKey,
    viewerId,
  ])

  const saveQueryShare = useCallback(async () => {
    if (!payload) return
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
      const nextResult = {
        ...result,
        ...(result.geojson ? { geojson: normalizeSemanticQueryGeojson(result.geojson) } : {}),
      }
      const savedBuilder = builderFromShare(share)
      if (savedBuilder) changeQueryBuilder(savedBuilder)
      setQueryState({
        status: 'ready',
        result: nextResult,
        error: '',
      })
      postQueryResult(nextResult)
      loadQueryHistory()
      loadAnalysisSelections()
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
    loadQueryHistory,
    loadAnalysisSelections,
    postQueryResult,
    postToViewer,
    surfaceKey,
    viewerId,
  ])

  useEffect(() => {
    if (!twinQueryContract) return
    loadQueryHistory()
    loadQueryShares()
    loadAnalysisSelections()
  }, [loadAnalysisSelections, loadQueryHistory, loadQueryShares, refreshIndex, twinQueryContract])

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
    if (!iframeLoaded || queryState.status !== 'ready' || !queryState.result) return
    postQueryResult(queryState.result)
  }, [iframeLoaded, postQueryResult, queryState])

  return {
    queryBuilder,
    queryError: queryState.error,
    queryHistory,
    queryResult: queryState.result,
    querySelections,
    queryShares,
    queryStatus: queryState.status,
    changeQueryBuilder,
    clearQuery,
    loadQueryHistory,
    loadAnalysisSelections,
    loadQueryShares,
    replayAnalysisSelection,
    replayQuery,
    replayQueryShare,
    resetQuery,
    runQuery,
    saveAnalysisSelection,
    saveQueryShare,
    publishQueryShare,
  }
}
