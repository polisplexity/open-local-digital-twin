'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import { Alert, Badge, Card, Col, Container, Row } from 'react-bootstrap'
import { usePlatformContext } from '@/context/PlatformContext'
import TwinModuleHeader from './TwinModuleHeader'
import TwinControlSidebar from './TwinControlSidebar'
import DesktopFirstGate from './DesktopFirstGate'
import { useLdtVisualSurfaceContract } from './useLdtVisualSurfaceContract'
import CockpitMapInspector from './panels/CockpitMapInspector'
import VisualSurfaceContractStrip from './panels/VisualSurfaceContractStrip'
import { useTwinQueryController } from './query/useTwinQueryController'
import {
  routeForQuerySurface,
  writeQueryPassport,
} from './query/queryPassportModel'
import { visualStateFromShare } from './query/queryShareModel'
import {
  buildFragmentQueryRequest,
  combineFragmentGeojson,
  enrichFragmentGeojson,
  fragmentWorkspaceSummary,
  numericRangeForResults,
} from './fragmentWorkspaceModel'
import {
  buildCityAnalystIndicators,
  buildDefaultLayerControls,
  buildFallbackLayerDefinitions,
  buildHeroMetrics,
  buildQueryIdleVisibleLayers,
  cityFeatureLimitForCoverage,
  DEFAULT_QUERY_RADIUS_PERCENT,
  formatCount,
  intentForViewer,
  mergeLayerState,
  payloadCenter,
  radiusMetersForCityCoverage,
  setBuildingGroupVisibility,
  surfaceKeyForViewer,
} from './viewerStateModel'

const initialFragmentWorkspaceState = () => ({
  error: '',
  fragments: [],
  results: [],
  status: 'idle',
  summary: null,
})

const TwinViewerPage = ({ config, bundles = [] }) => {
  const iframeRef = useRef(null)
  const compactViewportRef = useRef(null)
  const { activeCityId } = usePlatformContext()
  const cityId = activeCityId ?? 'current'
  const isAnalyticalMap = config.surfaceRole === 'analytical-map' || config.routeKey === 'cockpit'
  const queryDrivenInitialView = Boolean(config.queryDriven)
  const surfaceKey = surfaceKeyForViewer(config.viewerId)
  const visualContract = useLdtVisualSurfaceContract(cityId, surfaceKey)
  const [isCompactViewport, setIsCompactViewport] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [payload, setPayload] = useState(null)
  const [buildingCoverage, setBuildingCoverage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewerReady, setViewerReady] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [geometryLoading, setGeometryLoading] = useState(false)
  const [viewportInfo, setViewportInfo] = useState(null)
  const [selection, setSelection] = useState(null)
  const [selectedAreaSummary, setSelectedAreaSummary] = useState(null)
  const [selectedAreaLoading, setSelectedAreaLoading] = useState(false)
  const [selectedAreaError, setSelectedAreaError] = useState('')
  const [visibleLayers, setVisibleLayers] = useState({})
  const [layerControls, setLayerControls] = useState({})
  const [inspectorTab, setInspectorTab] = useState('indicators')
  const [refreshIndex, setRefreshIndex] = useState(0)
  const [fidelity, setFidelity] = useState(config.defaultFidelity ?? 60)
  const [cityCoverage, setCityCoverage] = useState(0)
  const [cityScaleRevision, setCityScaleRevision] = useState(0)
  const [layerRevision, setLayerRevision] = useState(0)
  const [activeXrMode, setActiveXrMode] = useState('walk')
  const [viewerRuntimeState, setViewerRuntimeState] = useState({
    camera: null,
    cameraPolicy: null,
    baseMap: null,
    xrSession: null,
    layers: {},
    mode: '',
    updatedAt: '',
  })
  const [fragmentWorkspaceState, setFragmentWorkspaceState] = useState(initialFragmentWorkspaceState)
  const [simulationWorldState, setSimulationWorldState] = useState({
    error: '',
    status: 'idle',
    worlds: [],
  })

  const visualStateSnapshot = useMemo(() => ({
    ...viewerRuntimeState,
    surface: surfaceKey,
    viewerId: config.viewerId,
    xrMode: config.viewerId === 'immersive' ? activeXrMode : viewerRuntimeState.mode,
    layers: Object.keys(viewerRuntimeState.layers || {}).length ? viewerRuntimeState.layers : visibleLayers,
    viewerConfig: {
      cityCoverage,
      fidelity,
      layerControls,
      supportsCityScale: Boolean(config.supportsCityScale),
      supportsFidelity: Boolean(config.supportsFidelity),
    },
  }), [
    activeXrMode,
    cityCoverage,
    config.supportsCityScale,
    config.supportsFidelity,
    config.viewerId,
    fidelity,
    layerControls,
    surfaceKey,
    viewerRuntimeState,
    visibleLayers,
  ])

  const postToViewer = useCallback((message) => {
    const target = iframeRef.current?.contentWindow
    if (!target) return
    target.postMessage(
      {
        source: 'twin-dashboard',
        viewer: config.viewerId,
        ...message,
      },
      window.location.origin,
    )
  }, [config.viewerId])

  const {
    queryBuilder: twinQueryBuilder,
    queryDataSpace,
    queryError,
    queryExport,
    queryHistory,
    queryPresets,
    queryResult,
    querySelections,
    queryShares,
    queryStatus,
    applyQueryPreset: handleTwinQueryPresetApply,
    changeQueryBuilder: handleTwinQueryBuilderChange,
    clearQuery: handleSemanticQueryClear,
    exportQuery: handleTwinQueryExport,
    loadAnalysisSelections: loadTwinAnalysisSelections,
    loadDataSpaceProfiles: loadTwinDataSpaceProfiles,
    loadQueryHistory: loadTwinQueryHistory,
    loadQueryShares: loadTwinQueryShares,
    publishQueryShare: handleTwinQuerySharePublish,
    publishQueryToDataSpace: handleTwinQueryDataSpacePublish,
    replayQuery: handleTwinQueryReplay,
    replayQueryShare: handleTwinQueryShareReplay,
    resetQuery: resetTwinQuery,
    runQuery: handleTwinQuerySubmit,
    saveAnalysisSelection: handleTwinAnalysisSelectionSave,
    saveQueryShare: handleTwinQueryShareSave,
    buildCurrentQueryRequest: buildCurrentQueryRequest,
  } = useTwinQueryController({
    cityCoverage,
    cityId,
    iframeLoaded,
    payload,
    postToViewer,
    refreshIndex,
    supportsCityScale: Boolean(config.supportsCityScale),
    surfaceKey,
    twinQueryContract: visualContract.contract?.twinQueryContract,
    viewerId: config.viewerId,
    visualState: visualStateSnapshot,
  })

  const loadSimulationWorlds = useCallback(async () => {
    setSimulationWorldState((current) => ({ ...current, error: '', status: 'loading' }))
    try {
      const response = await fetch(`/api/live/${encodeURIComponent(cityId)}/simulation-worlds?limit=40`, {
        credentials: 'same-origin',
      })
      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.detail || `SIMULATION_WORLDS_${response.status}`)
      }
      setSimulationWorldState({ error: '', status: 'ready', worlds: result.worlds || [] })
    } catch (loadError) {
      setSimulationWorldState({
        error: String(loadError?.message ?? 'SIMULATION_WORLDS_UNAVAILABLE'),
        status: 'error',
        worlds: [],
      })
    }
  }, [cityId])

  useEffect(() => {
    loadSimulationWorlds()
  }, [loadSimulationWorlds])

  const layerDefinitions = useMemo(() => buildFallbackLayerDefinitions(payload), [payload])

  useEffect(() => {
    function syncViewport() {
      const compact = window.innerWidth < 1180
      setIsCompactViewport(compact)
      if (compactViewportRef.current === null || compactViewportRef.current !== compact) {
        compactViewportRef.current = compact
        setShowSidebar(!compact)
      }
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  useEffect(() => {
    let ignore = false

    async function loadPayload() {
      try {
        setLoading(true)
        setError('')
        setIframeLoaded(false)
        setViewerReady(false)
        setGeometryLoading(false)
        setViewportInfo(null)
        const [response, coverageResponse] = await Promise.all([
          fetch(`/api/live/${cityId}/base`, { credentials: 'same-origin' }),
          isAnalyticalMap && !queryDrivenInitialView
            ? fetch(`/api/live/${cityId}/building-coverage`, { credentials: 'same-origin' })
            : Promise.resolve(null),
        ])
        if (!response.ok) {
          throw new Error(`DATA_LOAD_FAILED:${response.status}`)
        }
        const nextPayload = await response.json()
        const nextCoverage =
          coverageResponse?.ok
            ? (await coverageResponse.json())?.coverage ?? null
            : null
        if (ignore) return
        setPayload(nextPayload)
        setBuildingCoverage(nextCoverage)
        setSelection(null)
        setSelectedAreaSummary(null)
        setSelectedAreaError('')
        setSelectedAreaLoading(false)
        resetTwinQuery()
        setFragmentWorkspaceState(initialFragmentWorkspaceState())
        setGeometryLoading(false)
        setViewportInfo(null)
        const nextLayerDefinitions = buildFallbackLayerDefinitions(nextPayload)
        const defaultBundle = bundles
          .filter((bundle) => Array.isArray(bundle.layers) && bundle.layers.length)
          .find((bundle) => bundle.id === config.defaultBundleId)
        const bundleVisibleLayers =
          defaultBundle?.layers?.length
            ? Object.fromEntries(
                nextLayerDefinitions.map((layer) => [layer.key, defaultBundle.layers.includes(layer.key)]),
              )
            : Object.fromEntries(
                nextLayerDefinitions.map((layer) => [layer.key, Boolean(layer.visibleByDefault)]),
        )
        const nextVisibleLayers = queryDrivenInitialView
          ? buildQueryIdleVisibleLayers(nextLayerDefinitions, config.queryIdleLayers)
          : defaultBundle?.id === 'building-coverage'
            ? setBuildingGroupVisibility(bundleVisibleLayers, true)
            : bundleVisibleLayers
        setVisibleLayers(nextVisibleLayers)
        setLayerRevision((current) => current + 1)
        const initialCoverage = config.supportsCityScale
          ? Number(config.defaultCityCoverage ?? (queryDrivenInitialView ? 0 : DEFAULT_QUERY_RADIUS_PERCENT))
          : 0
        setLayerControls(
          config.supportsCityScale
            ? buildDefaultLayerControls(nextLayerDefinitions)
            : buildDefaultLayerControls(nextLayerDefinitions),
        )
        setCityCoverage(initialCoverage)
        setCityScaleRevision((current) => current + 1)
        setFidelity(
          config.supportsCityScale
            ? (config.defaultFidelity ?? 58)
            : (config.defaultFidelity ?? 60),
        )
      } catch (nextError) {
        if (!ignore) {
          setError(String(nextError?.message ?? 'UNKNOWN_ERROR'))
          setBuildingCoverage(null)
        }
      } finally {
        if (!ignore) {
          setLoading(false)
          setGeometryLoading(false)
        }
      }
    }

    loadPayload()
    return () => {
      ignore = true
    }
  }, [
    bundles,
    cityId,
    config.defaultBundleId,
    config.defaultCityCoverage,
    config.defaultFidelity,
    config.queryIdleLayers,
    config.routeKey,
    config.supportsCityScale,
    isAnalyticalMap,
    queryDrivenInitialView,
    refreshIndex,
    resetTwinQuery,
  ])

  useEffect(() => {
    function handleMessage(event) {
      const frameWindow = iframeRef.current?.contentWindow
      if (frameWindow && event.source && event.source !== frameWindow) return
      const message = event.data ?? {}
      if (message.source !== 'twin-viewer' || message.viewer !== config.viewerId) return

      if (message.type === 'twin:ready') {
        setIframeLoaded(true)
        setViewerReady(true)
        if (message.layers) {
          setVisibleLayers((current) =>
            Object.keys(current).length ? current : mergeLayerState(current, message.layers),
          )
        }
      }

      if (message.type === 'twin:state') {
        if (message.layers) {
          setVisibleLayers((current) =>
            Object.keys(current).length ? current : mergeLayerState(current, message.layers),
          )
        }
        setViewerRuntimeState((current) => ({
          ...current,
          ...(message.layers && typeof message.layers === 'object' ? { layers: message.layers } : {}),
          ...(message.camera && typeof message.camera === 'object' ? { camera: message.camera } : {}),
          ...(message.cameraPolicy && typeof message.cameraPolicy === 'object' ? { cameraPolicy: message.cameraPolicy } : {}),
          ...(message.baseMap && typeof message.baseMap === 'object' ? { baseMap: message.baseMap } : {}),
          ...(message.xrSession && typeof message.xrSession === 'object' ? { xrSession: message.xrSession } : {}),
          mode: message.mode || message.xrMode || current.mode,
          updatedAt: new Date().toISOString(),
        }))
      }

      if (message.type === 'twin:viewport-loading') {
        setGeometryLoading(Boolean(message.loading))
      }

      if (message.type === 'twin:viewport') {
        setGeometryLoading(false)
        setViewportInfo({
          mode: message.mode ? String(message.mode) : '',
          label: message.label ? String(message.label) : '',
          returned: message.returned == null ? null : Number(message.returned),
          truncated: Boolean(message.truncated),
          error: message.error ? String(message.error) : '',
        })
      }

      if (message.type === 'twin:selection') {
        setSelection(message.selection ?? null)
      }

      if (message.type === 'twin:error') {
        setError(String(message.error ?? 'VIEWER_LOAD_FAILED'))
        setViewerReady(false)
        setGeometryLoading(false)
        setViewportInfo(null)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [config.viewerId])

  useEffect(() => {
    if (!payload || !layerDefinitions.length || Object.keys(visibleLayers).length) return
    if (queryDrivenInitialView) {
      setVisibleLayers(buildQueryIdleVisibleLayers(layerDefinitions, config.queryIdleLayers))
      return
    }
    const fallbackVisibleLayers = Object.fromEntries(
      layerDefinitions.map((layer) => [layer.key, Boolean(layer.visibleByDefault)]),
    )
    if (config.defaultBundleId === 'building-coverage') {
      setVisibleLayers(setBuildingGroupVisibility(fallbackVisibleLayers, true))
      return
    }
    setVisibleLayers(fallbackVisibleLayers)
  }, [config.defaultBundleId, config.queryIdleLayers, layerDefinitions, payload, queryDrivenInitialView, visibleLayers])

  useEffect(() => {
    if (!iframeLoaded) return
    postToViewer({
      type: 'twin:set-visible-layers',
      revision: layerRevision,
      layers: visibleLayers,
    })
  }, [iframeLoaded, layerRevision, postToViewer, visibleLayers])

  useEffect(() => {
    if (!iframeLoaded || !config.supportsFidelity) return
    postToViewer({
      type: 'twin:set-fidelity',
      value: fidelity / 100,
    })
  }, [config.supportsFidelity, fidelity, iframeLoaded, postToViewer])

  useEffect(() => {
    if (!iframeLoaded || !config.supportsCityScale) return
    postToViewer({
      type: 'twin:set-city-scale',
      scale: {
        key: 'coverage',
        coveragePercent: cityCoverage,
        featureLimit: cityFeatureLimitForCoverage(cityCoverage),
        fidelity: (config.defaultFidelity ?? 58) / 100,
        revision: cityScaleRevision,
      },
    })
  }, [cityCoverage, cityScaleRevision, config.defaultFidelity, config.supportsCityScale, iframeLoaded, postToViewer])

  useEffect(() => {
    if (!iframeLoaded) return
    postToViewer({
      type: 'twin:set-layer-controls',
      controls: layerControls,
    })
  }, [iframeLoaded, layerControls, postToViewer])

  useEffect(() => {
    if (!iframeLoaded) return undefined
    const timers = [180, 620, 1200].map((delay) =>
      window.setTimeout(() => {
          postToViewer({
            type: 'twin:set-visible-layers',
            revision: layerRevision,
            layers: visibleLayers,
          })
        if (config.supportsFidelity) {
          postToViewer({
            type: 'twin:set-fidelity',
            value: fidelity / 100,
          })
        }
        if (config.supportsCityScale) {
          postToViewer({
            type: 'twin:set-city-scale',
            scale: {
              key: 'coverage',
              coveragePercent: cityCoverage,
              featureLimit: cityFeatureLimitForCoverage(cityCoverage),
              fidelity: (config.defaultFidelity ?? 58) / 100,
              revision: cityScaleRevision,
            },
          })
        }
        postToViewer({
          type: 'twin:set-layer-controls',
          controls: layerControls,
        })
      }, delay),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [cityCoverage, cityScaleRevision, config.defaultFidelity, config.supportsCityScale, config.supportsFidelity, fidelity, iframeLoaded, layerControls, layerRevision, postToViewer, refreshIndex, visibleLayers])

  useEffect(() => {
    if (!payload) return undefined
    let ignore = false

    async function loadSelectedAreaSummary() {
      if (config.supportsCityScale && cityCoverage <= 0) {
        setSelectedAreaSummary(null)
        setSelectedAreaLoading(false)
        setSelectedAreaError('')
        return
      }

      const params = new URLSearchParams()
      if (config.supportsCityScale) {
        const center = payloadCenter(payload)
        const radiusMeters = radiusMetersForCityCoverage(payload, cityCoverage)
        if (!center || radiusMeters <= 0) {
          setSelectedAreaSummary(null)
          setSelectedAreaLoading(false)
          setSelectedAreaError('SELECTED_AREA_RADIUS_UNAVAILABLE')
          return
        }
        params.set('scope', 'radius')
        params.set('center', center.join(','))
        params.set('radiusMeters', String(radiusMeters))
      } else {
        params.set('scope', 'city')
      }

      try {
        setSelectedAreaLoading(true)
        setSelectedAreaError('')
        const response = await fetch(`/api/live/${cityId}/selection-summary?${params.toString()}`, {
          credentials: 'same-origin',
        })
        if (!response.ok) throw new Error(`SELECTION_SUMMARY_${response.status}`)
        const summary = await response.json()
        if (ignore) return
        setSelectedAreaSummary(summary?.ok ? summary : null)
        setSelectedAreaError(summary?.ok ? '' : String(summary?.error ?? 'SELECTION_SUMMARY_UNAVAILABLE'))
      } catch (error) {
        if (ignore) return
        setSelectedAreaSummary(null)
        setSelectedAreaError(String(error?.message ?? 'SELECTION_SUMMARY_UNAVAILABLE'))
      } finally {
        if (!ignore) setSelectedAreaLoading(false)
      }
    }

    const delay = config.supportsCityScale ? 320 : 80
    const timer = window.setTimeout(loadSelectedAreaSummary, delay)
    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [cityCoverage, cityId, config.supportsCityScale, payload, refreshIndex])

  const postSavedVisualStateToViewer = useCallback((visualState, delay = 0) => {
    if (!visualState || typeof visualState !== 'object') return
    const viewerConfig = visualState.viewerConfig && typeof visualState.viewerConfig === 'object'
      ? visualState.viewerConfig
      : {}
    const layers = visualState.layers && typeof visualState.layers === 'object' ? visualState.layers : null
    const controls = viewerConfig.layerControls && typeof viewerConfig.layerControls === 'object'
      ? viewerConfig.layerControls
      : null
    const send = () => {
      postToViewer({ type: 'twin:apply-visual-state', visualState })
      if (layers) {
        postToViewer({
          type: 'twin:set-visible-layers',
          revision: Date.now(),
          layers,
        })
      }
      if (controls) {
        postToViewer({
          type: 'twin:set-layer-controls',
          controls,
        })
      }
      if (config.supportsFidelity && Number.isFinite(Number(viewerConfig.fidelity))) {
        const nextFidelity = Number(viewerConfig.fidelity)
        postToViewer({
          type: 'twin:set-fidelity',
          value: nextFidelity / 100,
          fidelity: nextFidelity / 100,
        })
      }
      if (config.supportsCityScale && Number.isFinite(Number(viewerConfig.cityCoverage))) {
        const nextCoverage = Math.min(100, Math.max(0, Number(viewerConfig.cityCoverage)))
        postToViewer({
          type: 'twin:set-city-scale',
          scale: {
            key: 'coverage',
            coveragePercent: nextCoverage,
            featureLimit: cityFeatureLimitForCoverage(nextCoverage),
            fidelity: (config.defaultFidelity ?? 58) / 100,
            revision: Date.now(),
          },
        })
      }
      const nextXrMode = visualState.xrMode || visualState.mode
      if (config.viewerId === 'immersive' && nextXrMode) {
        postToViewer({
          type: 'twin:set-xr-mode',
          mode: nextXrMode,
          value: nextXrMode,
        })
      }
    }
    if (delay > 0) window.setTimeout(send, delay)
    else send()
  }, [config.defaultFidelity, config.supportsCityScale, config.supportsFidelity, config.viewerId, postToViewer])

  const applySavedVisualState = useCallback((share, options = {}) => {
    const visualState = visualStateFromShare(share)
    if (!visualState || typeof visualState !== 'object') return
    const viewerConfig = visualState.viewerConfig && typeof visualState.viewerConfig === 'object'
      ? visualState.viewerConfig
      : {}
    if (visualState.layers && typeof visualState.layers === 'object') {
      setVisibleLayers(visualState.layers)
      setLayerRevision((current) => current + 1)
    }
    if (viewerConfig.layerControls && typeof viewerConfig.layerControls === 'object') {
      setLayerControls(viewerConfig.layerControls)
    }
    if (Number.isFinite(Number(viewerConfig.fidelity))) {
      setFidelity(Math.min(100, Math.max(0, Number(viewerConfig.fidelity))))
    }
    if (Number.isFinite(Number(viewerConfig.cityCoverage))) {
      setCityCoverage(Math.min(100, Math.max(0, Number(viewerConfig.cityCoverage))))
      setCityScaleRevision((current) => current + 1)
    }
    const nextXrMode = visualState.xrMode || visualState.mode
    if (config.viewerId === 'immersive' && nextXrMode) {
      setActiveXrMode(nextXrMode)
    }
    setViewerRuntimeState((current) => ({
      ...current,
      ...(visualState.camera ? { camera: visualState.camera } : {}),
      ...(visualState.cameraPolicy ? { cameraPolicy: visualState.cameraPolicy } : {}),
      ...(visualState.baseMap ? { baseMap: visualState.baseMap } : {}),
      ...(visualState.xrSession ? { xrSession: visualState.xrSession } : {}),
      ...(visualState.layers ? { layers: visualState.layers } : {}),
      mode: visualState.mode || visualState.xrMode || current.mode,
      updatedAt: new Date().toISOString(),
    }))
    if (options.post !== false) {
      postSavedVisualStateToViewer(visualState, options.delay || 0)
    }
  }, [config.viewerId, postSavedVisualStateToViewer])

  const handleTwinQueryShareReplayWithVisualState = useCallback(async (share) => {
    applySavedVisualState(share, { post: true })
    await handleTwinQueryShareReplay(share)
    applySavedVisualState(share, { post: true, delay: 80 })
    applySavedVisualState(share, { post: true, delay: 420 })
  }, [applySavedVisualState, handleTwinQueryShareReplay])

  const handleOpenQuerySurface = useCallback((targetViewer) => {
    const href = routeForQuerySurface(targetViewer)
    if (!href) return
    let query = queryResult?.query || null
    try {
      query = query || buildCurrentQueryRequest?.()
    } catch {
      query = queryResult?.query || null
    }
    if (query) {
      writeQueryPassport({
        builder: twinQueryBuilder,
        cityId,
        query,
        queryResult,
        sourceViewer: config.viewerId,
        targetViewer,
      })
    }
    window.location.assign(`${href}?queryPassport=1`)
  }, [
    buildCurrentQueryRequest,
    cityId,
    config.viewerId,
    queryResult,
    twinQueryBuilder,
  ])

  const handleFragmentWorkspaceCommand = useCallback(async (command = {}) => {
    if (command.action === 'clear') {
      setFragmentWorkspaceState(initialFragmentWorkspaceState())
      postToViewer({ type: 'twin:clear-fragment-workspace' })
      return
    }

    const fragments = Array.isArray(command.fragments)
      ? command.fragments.filter((fragment) => (
        fragment?.query || fragment?.simulationRunId || fragment?.selectionSetId
      ))
      : []
    if (!fragments.length) return

    const options = command.options && typeof command.options === 'object' ? command.options : {}
    const colorBy = String(options.colorBy || '__fragment')
    const opacity = Math.min(1, Math.max(0.1, Number(options.opacity ?? 0.78)))

    setFragmentWorkspaceState({
      error: '',
      fragments,
      results: [],
      status: 'running',
      summary: null,
    })

    try {
      const rawResults = await Promise.all(fragments.map(async (fragment, index) => {
        if (fragment.simulationRunId || fragment.selectionSetId) {
          const endpoint = fragment.simulationRunId
            ? `/api/live/${encodeURIComponent(cityId)}/simulation-worlds/${encodeURIComponent(fragment.simulationRunId)}/geojson`
            : `/api/live/${encodeURIComponent(cityId)}/analysis-selections/${encodeURIComponent(fragment.selectionSetId)}/geojson`
          const response = await fetch(endpoint, { credentials: 'same-origin' })
          const result = await response.json()
          if (!response.ok || !result?.ok) {
            throw new Error(result?.error || result?.detail || `WORLD_GEOJSON_${response.status}`)
          }
          return {
            fragment: {
              ...fragment,
              color: fragment.color || undefined,
            },
            index,
            links: {},
            primitives: null,
            query: fragment.query || null,
            rawGeojson: result.geojson?.features ? result.geojson : { type: 'FeatureCollection', features: [] },
            sceneManifest: null,
            summary: result.summary || {},
            transport: 'geojson',
            vectorTileTemplate: '',
          }
        }
        const requestPayload = buildFragmentQueryRequest(fragment, {
          intent: intentForViewer(config.viewerId),
          surface: surfaceKey,
          viewerId: config.viewerId,
        })
        const response = await fetch(`/api/live/${cityId}/twin-query`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload),
        })
        const result = await response.json()
        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || result?.detail || `FRAGMENT_QUERY_${response.status}`)
        }
        return {
          fragment: {
            ...fragment,
            color: fragment.color || undefined,
          },
          index,
          links: result.links && typeof result.links === 'object' ? result.links : {},
          primitives: result.primitives || null,
          query: result.query || requestPayload,
          rawGeojson: result.geojson?.features ? result.geojson : { type: 'FeatureCollection', features: [] },
          sceneManifest: result.sceneManifest || null,
          summary: result.summary || {},
          transport: result.transport || result.query?.render?.transport || requestPayload.render?.transport || '',
          vectorTileTemplate: result.links?.vectorTileTemplate || result.vectorTileTemplate || '',
        }
      }))

      const numericRange = numericRangeForResults(rawResults, colorBy)
      const results = rawResults.map((entry) => ({
        ...entry,
        geojson: entry.rawGeojson?.features?.length
          ? enrichFragmentGeojson({
              colorBy,
              fragment: entry.fragment,
              geojson: entry.rawGeojson,
              index: entry.index,
              numericRange,
            })
          : null,
      }))
      const summary = fragmentWorkspaceSummary(results)
      const combinedGeojson = combineFragmentGeojson(results)
      const workspacePayload = {
        type: 'twin:set-fragment-workspace',
        fragments: results.map((entry) => ({
          color: entry.fragment.color,
          id: entry.fragment.id,
          index: entry.index,
          links: entry.links,
          ...(entry.geojson ? { geojson: entry.geojson } : {}),
          ...(entry.primitives ? { primitives: entry.primitives } : {}),
          query: entry.query,
          ...(entry.sceneManifest ? { sceneManifest: entry.sceneManifest } : {}),
          source: entry.fragment.source,
          summary: entry.summary,
          title: entry.fragment.title,
          transport: entry.transport,
          ...(entry.vectorTileTemplate ? { vectorTileTemplate: entry.vectorTileTemplate } : {}),
        })),
        options: {
          colorBy,
          opacity,
        },
        summary,
        ...(combinedGeojson ? { combinedGeojson } : {}),
      }
      postToViewer(workspacePayload)
      setFragmentWorkspaceState({
        error: '',
        fragments,
        results,
        status: 'ready',
        summary,
      })
    } catch (error) {
      const message = String(error?.message ?? 'FRAGMENT_WORKSPACE_FAILED')
      setFragmentWorkspaceState({
        error: message,
        fragments,
        results: [],
        status: 'error',
        summary: null,
      })
    }
  }, [cityId, config.viewerId, postToViewer, surfaceKey])

  const handleCommand = (command) => {
    if (command?.kind === 'fragmentWorkspace') {
      handleFragmentWorkspaceCommand(command)
      return
    }
    if (command?.kind === 'xrExperience') {
      setActiveXrMode(command.value)
      setViewerRuntimeState((current) => ({
        ...current,
        mode: command.value,
        updatedAt: new Date().toISOString(),
      }))
      postToViewer({
        type: 'twin:set-xr-mode',
        mode: command.value,
        command,
        fragments: Array.isArray(command.fragments) ? command.fragments : [],
        fragmentWorkspace: command.fragmentWorkspace || null,
      })
      return
    }
    postToViewer({
      type: 'twin:command',
      command,
    })
  }

  const heroMetrics = useMemo(() => (payload ? buildHeroMetrics(payload) : []), [payload])
  const cityAnalystIndicators = useMemo(
    () => (payload ? buildCityAnalystIndicators(payload, buildingCoverage) : []),
    [buildingCoverage, payload],
  )
  const visibleLayerCount = layerDefinitions.filter((layer) => visibleLayers[layer.key]).length
  const stageReady = config.viewerId === 'map'
    ? !loading
    : viewerReady && !loading
  const viewerStatusLabel = config.viewerId === 'immersive' ? 'XR' : config.viewerId.toUpperCase()
  const viewerLoaderLabel = config.viewerId === 'immersive' ? 'XR scene' : `${config.viewerId.toUpperCase()} surface`
  const viewportNoun = config.viewerId === '3d'
    ? '3D viewport'
    : config.viewerId === 'immersive'
      ? 'XR scene'
      : 'city tiles'
  const geometryStatusLabel =
    geometryLoading
      ? `Loading visible ${viewportNoun}`
      : viewportInfo?.error
        ? `Visible ${viewportNoun} needs retry`
      : viewportInfo?.mode === 'tiles'
        ? viewportInfo.label || 'Vector tiles active'
      : ['3d-tiles', 'semantic-query-reference'].includes(viewportInfo?.mode)
        ? viewportInfo.label || '3D Tiles active'
      : viewportInfo
        ? `${formatCount(viewportInfo.returned)} features in view${viewportInfo.truncated ? ' +' : ''}`
        : cityCoverage > 0
          ? `Preparing visible ${viewportNoun}`
          : config.viewerId === 'map'
            ? 'No city inventory tiles loaded'
            : `Preparing ${viewportNoun}`
  const viewerSrc = `/live/${cityId}/${config.viewerId}?r=${refreshIndex}`
  const headerStatusLabel =
    visualContract.loading
      ? 'Reading city contract'
      : visualContract.status === 'blocked'
        ? 'Contract needs review'
        : stageReady
          ? 'Live viewer ready'
          : 'Preparing live viewer'

  useEffect(() => {
    if (config.viewerId !== 'map' || stageReady || error) return undefined
    const timer = window.setTimeout(() => {
      if (iframeRef.current?.contentWindow) {
        setIframeLoaded(true)
        setViewerReady(true)
      }
    }, 2800)
    return () => window.clearTimeout(timer)
  }, [config.viewerId, error, stageReady, viewerSrc])

  const handleIframeLoad = () => {
    setIframeLoaded(true)
    if (config.viewerId === 'map') {
      setViewerReady(true)
    }
  }

  return (
    <div className="hk-pg-body py-0">
      <DesktopFirstGate
        description="Use a desktop browser to review maps, 3D scenes, inner controls, and linked semantic layers without losing context."
        surfaceName={config.title}
      />
      <div
        className={classNames('invoiceapp-wrap', 'dt-module-wrap', {
          'invoiceapp-sidebar-toggle': isCompactViewport ? showSidebar : !showSidebar,
          'dt-module-wrap--compact': isCompactViewport,
        })}
      >
        <TwinControlSidebar
          activeXrMode={activeXrMode}
          body={config.controlBody}
          cityCoverage={cityCoverage}
          commands={isAnalyticalMap ? [] : config.commands}
          onCommand={handleCommand}
          onQueryBuilderChange={handleTwinQueryBuilderChange}
          onQueryClear={handleSemanticQueryClear}
          onQueryDataSpaceProfilesLoad={loadTwinDataSpaceProfiles}
          onQueryDataSpacePublish={handleTwinQueryDataSpacePublish}
          onQueryExport={handleTwinQueryExport}
          onQueryHistoryRefresh={loadTwinQueryHistory}
          onQueryPresetApply={handleTwinQueryPresetApply}
          onQueryRun={handleTwinQuerySubmit}
          onQuerySharePublish={handleTwinQuerySharePublish}
          onQueryShareRefresh={loadTwinQueryShares}
          onQueryShareReplay={handleTwinQueryShareReplayWithVisualState}
          onQueryShareSave={handleTwinQueryShareSave}
          onQueryReplay={handleTwinQueryReplay}
          onQuerySelectionRefresh={loadTwinAnalysisSelections}
          onSimulationWorldRefresh={loadSimulationWorlds}
          onQuerySelectionSave={handleTwinAnalysisSelectionSave}
          onOpenQuerySurface={handleOpenQuerySurface}
          sections={config.sections}
          selection={selection}
          supportsCityScale={Boolean(config.supportsCityScale)}
          title={config.controlTitle}
          queryBuilder={twinQueryBuilder}
          queryContract={visualContract.contract?.twinQueryContract}
          queryDataSpace={queryDataSpace}
          queryError={queryError}
          queryExport={queryExport}
          queryHistory={queryHistory}
          queryPresets={queryPresets}
          queryResult={queryResult}
          querySelections={querySelections}
          queryShares={queryShares}
          queryStatus={queryStatus}
          fragmentWorkspaceState={fragmentWorkspaceState}
          simulationWorlds={simulationWorldState}
          viewerId={config.viewerId}
          viewerReady={viewerReady}
          visibleLayerCount={visibleLayerCount}
        />
        <div className="invoiceapp-content">
          <div className="invoiceapp-detail-wrap">
            <TwinModuleHeader
              eyebrow={config.eyebrow}
              onRefresh={() => setRefreshIndex((current) => current + 1)}
              onToggleSidebar={() => setShowSidebar((current) => !current)}
              sidebarOpen={showSidebar}
              statusLabel={headerStatusLabel}
              summary={config.summary}
              title={config.title}
            />

            <Container fluid="xxl" className="py-4">
              {error ? (
                <Alert variant="danger" className="mb-4">
                  Could not load live city data. {error}
                </Alert>
              ) : null}

              <Row className="g-3 mb-4" id={config.sections[1]?.id}>
                <Col xl={12}>
                  <Card className="card-border overflow-hidden dt-live-surface-card">
                    <div className="dt-live-surface-status" aria-label="Viewer status">
                      <Badge bg={stageReady ? 'success' : 'secondary'} className="rounded-pill">{stageReady ? 'Live' : 'Loading'}</Badge>
                      <Badge bg="dark" className="rounded-pill">{viewerStatusLabel}</Badge>
                    </div>
                    <Card.Body className="dt-stage-card">
                      {!error ? (
                        <div className={isAnalyticalMap ? 'dt-stage-shell dt-stage-shell--with-inspector' : 'dt-stage-shell'}>
                          <div className="dt-stage-map-pane">
                            <iframe
                              allow="fullscreen"
                              allowFullScreen
                              className="dt-stage-frame"
                              key={viewerSrc}
                              loading="eager"
                              onLoad={handleIframeLoad}
                              ref={iframeRef}
                              src={viewerSrc}
                              title={config.title}
                            />
                            {(loading && !error) ? (
                              <div className="dt-stage-loader">
                                <div className="dt-stage-loader__pulse" />
                                <div className="dt-stage-loader__copy">
                                  <strong>Preparing the live {viewerLoaderLabel}</strong>
                                  <p>{loading ? 'Loading the city inventory and derived indicators.' : 'Rendering visible layers and synchronizing the viewer controls.'}</p>
                                </div>
                              </div>
                            ) : null}
                            {(stageReady && !error) ? (
                              <div className="dt-geometry-loader" aria-live="polite">
                                {geometryStatusLabel}
                              </div>
                            ) : null}
                          </div>
                          {isAnalyticalMap && payload ? (
                            <CockpitMapInspector
                              activeTab={inspectorTab}
                              buildingCoverage={buildingCoverage}
                              config={config}
                              heroMetrics={heroMetrics}
                              indicators={cityAnalystIndicators}
                              onTabChange={setInspectorTab}
                              selectedAreaLoading={selectedAreaLoading}
                              selectedAreaSummary={selectedAreaSummary}
                            />
                          ) : null}
                          {!isAnalyticalMap && payload ? (
                            <VisualSurfaceContractStrip
                              contract={visualContract.contract}
                              payload={payload}
                              selectedAreaSummary={selectedAreaSummary}
                              viewerId={config.viewerId}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {!isAnalyticalMap && payload ? (
                <Row className="g-3 mb-4" id={config.sections[0]?.id}>
                  {heroMetrics.map((metric) => (
                    <Col key={metric.label} xl={3} md={6}>
                      <Card className="card-border h-100">
                        <Card.Body>
                          <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">{metric.label}</div>
                          <h3 className="mb-2">{metric.value}</h3>
                          <p className="mb-0">{metric.note}</p>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              ) : null}

              {!isAnalyticalMap ? (
              <Row className="g-3">
                <Col xl={6}>
                  <Card className="card-border h-100">
                    <Card.Header>
                      <h6 className="mb-0">{config.content.statusTitle}</h6>
                    </Card.Header>
                    <Card.Body>
                      <p className="mb-0">{config.content.statusBody}</p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xl={6} id={isAnalyticalMap ? config.sections[3]?.id : config.sections[2]?.id}>
                  <Card className="card-border h-100">
                    <Card.Header>
                      <h6 className="mb-0">{isAnalyticalMap ? 'Next institutional move' : config.routeKey === 'city3d' ? 'Immediate municipal decisions' : 'Public benefit'}</h6>
                    </Card.Header>
                    <Card.Body className="dt-bullet-stack">
                      {(config.content.next || config.content.decisions || config.content.benefits || []).map((item) => (
                        <div className="dt-bullet" key={item}>{item}</div>
                      ))}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
              ) : null}

              {!isAnalyticalMap && buildingCoverage ? (
                <Row className="g-3 mt-1">
                  <Col xl={12}>
                    <Card className="card-border">
                      <Card.Header>
                        <h6 className="mb-0">Building coverage</h6>
                      </Card.Header>
                      <Card.Body>
                        <Row className="g-3">
                          <Col xl={3} md={6}>
                            <div className="dt-coverage-stat">
                              <span>Observed footprints</span>
                              <strong>{formatCount(buildingCoverage.observed?.count)}</strong>
                              <p>Current OSM-derived building records inside the city boundary.</p>
                            </div>
                          </Col>
                          <Col xl={3} md={6}>
                            <div className="dt-coverage-stat">
                              <span>Open-source footprints</span>
                              <strong>{formatCount(buildingCoverage.conflation?.candidateCount)}</strong>
                              <p>Independent official, Overture, Microsoft, or Google footprints inside the city scope.</p>
                            </div>
                          </Col>
                          <Col xl={3} md={6}>
                            <div className="dt-coverage-stat">
                              <span>Added to inventory</span>
                              <strong>{formatCount(buildingCoverage.conflation?.newCandidateCount)}</strong>
                              <p>{buildingCoverage.estimate?.confidence === 'candidate-not-authority' ? 'Footprints not matched to the observed OSM base.' : 'No independent source is connected yet.'}</p>
                            </div>
                          </Col>
                          <Col xl={3} md={6}>
                            <div className="dt-coverage-stat">
                              <span>Matched source evidence</span>
                              <strong>{formatCount(buildingCoverage.conflation?.matchedCandidateCount)}</strong>
                              <p>Open-source footprints already explained by the observed base.</p>
                            </div>
                          </Col>
                        </Row>
                        <div className="dt-source-grid mt-3">
                          {(buildingCoverage.sources ?? []).map((source) => (
                            <div className={source.active ? 'dt-source-pill is-active' : 'dt-source-pill'} key={source.key}>
                              <div>
                                <strong>{source.name}</strong>
                                <span>{source.role}</span>
                              </div>
                              <small>{formatCount(source.count)} · {source.license}</small>
                            </div>
                          ))}
                        </div>
                        <p className="dt-coverage-note mt-3 mb-0">{buildingCoverage.estimate?.note}</p>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              ) : null}
            </Container>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TwinViewerPage
