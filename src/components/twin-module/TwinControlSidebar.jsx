'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import SimpleBar from 'simplebar-react'
import { Bookmark, Camera, ChevronDown, Clock, ExternalLink, Layers, MapPin, Navigation, Play, RefreshCw, Search, Send } from 'react-feather'
import { formatCount, VIEWER_COPY } from './controls/visualRailModel'
import {
  FRAGMENT_COLOR_FIELDS,
  compactFragmentLabel,
  formatFragmentCount,
  fragmentOptionsFromQueryState,
} from './fragmentWorkspaceModel'
import SelectionPanel from './panels/SelectionPanel'
import TwinQueryPanel from './query/TwinQueryPanel'
import { groupQueryHistoryEvents } from './query/queryHistoryModel'
import {
  analysisSelectionCountLabel,
  analysisSelectionLabel,
  analysisSelectionSourceQuery,
  groupAnalysisSelections,
} from './query/querySelectionModel'
import {
  queryShareLabel,
  querySharePublicationLabel,
  queryShareVisualSummary,
} from './query/queryShareModel'
import { QUERY_SURFACE_DESTINATIONS } from './query/queryPassportModel'

const CollapsibleSection = ({ children, defaultOpen = true, icon: Icon, id, title }) => {
  const reactId = useId().replaceAll(':', '')
  const panelId = `${id}-${reactId}-panel`
  const toggleId = `${id}-${reactId}-toggle`

  return (
    <section className="dt-control-section">
      <input
        className="dt-control-section__toggle"
        defaultChecked={defaultOpen}
        id={toggleId}
        type="checkbox"
      />
      <label
        aria-controls={panelId}
        className="dt-control-section__header"
        htmlFor={toggleId}
      >
        {Icon ? <Icon size={15} /> : null}
        <span>{title}</span>
        <ChevronDown className="dt-control-section__chevron" size={15} />
      </label>
      <div className="dt-control-section__body" id={panelId}>
        {children}
      </div>
    </section>
  )
}

const fragmentFromSelection = (selection = {}) => ({
  id: selection.id || selection.selectionGroupKey || selection.queryHash || '',
  title: analysisSelectionLabel(selection),
  countLabel: analysisSelectionCountLabel(selection),
  query: analysisSelectionSourceQuery(selection),
  queryHash: selection.queryHash || '',
  source: 'analysis-selection',
  updatedAt: selection.updatedAt || selection.createdAt || '',
})

const fragmentFromQueryResult = (queryResult = null) => {
  if (!queryResult?.query) return null
  const resultCount = Number(queryResult.resultCount ?? queryResult.summary?.resultCount ?? queryResult.returned ?? 0)
  return {
    id: 'current-query',
    title: 'Current query',
    countLabel: `${Number(resultCount || 0).toLocaleString('en-US')}${queryResult.truncated ? '+' : ''}`,
    query: queryResult.query,
    queryHash: queryResult.queryHash || queryResult.summary?.queryHash || '',
    source: 'current-query',
    updatedAt: '',
  }
}

const dateLabel = (value) => {
  const time = Date.parse(value || '')
  if (!Number.isFinite(time)) return ''
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(time))
}

const historyLabel = (event = {}) => {
  const classes = Array.isArray(event.classes)
    ? event.classes
    : Array.isArray(event.query?.classes)
      ? event.query.classes
      : Array.isArray(event.query?.clauses)
        ? event.query.clauses.map((clause) => clause.classKey).filter(Boolean)
        : []
  return classes.length ? compactLabel(classes.slice(0, 3).join(' + '), 'Recorded query') : 'Recorded query'
}

const stripMachineTokens = (value) => String(value || '')
  .replace(/\b[a-f0-9]{18,}\b/gi, '')
  .replace(/\b\d{10,}\b/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const compactLabel = (value, fallback = 'Item', limit = 36) => {
  const cleaned = stripMachineTokens(value)
  if (!cleaned) return fallback
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1).trim()}...` : cleaned
}

const compactId = (value) => {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.length <= 14) return text
  return `${text.slice(0, 6)}...${text.slice(-6)}`
}

const sourceLabel = (source) => {
  if (source === 'current-query') return 'Current answer'
  if (source === 'analysis-selection') return 'Saved selection'
  if (source === 'simulation-world') return 'Simulation'
  if (source === 'query-library-fragment') return 'Saved answer'
  return source ? compactLabel(source, 'Saved answer', 24) : 'Saved answer'
}

const fragmentDetailLabel = (fragment = {}) => {
  const updated = dateLabel(fragment.updatedAt)
  if (updated) return `${sourceLabel(fragment.source)} / ${updated}`
  if (fragment.queryHash) return `${sourceLabel(fragment.source)} / ${compactId(fragment.queryHash)}`
  return sourceLabel(fragment.source)
}

const historyCountLabel = (event = {}) => {
  const count = Number(event.resultCount ?? event.returnedCount ?? event.summary?.resultCount ?? 0)
  return Number(count || 0).toLocaleString('en-US')
}

const QueryLibraryPanel = ({
  onHistoryRefresh,
  onQueryReplay,
  onSelectionRefresh,
  onSharePublish,
  onShareRefresh,
  onShareReplay,
  onShareSave,
  queryHistory = { status: 'idle', events: [], error: '' },
  querySelections = { status: 'idle', selections: [], error: '' },
  queryShares = { status: 'idle', shares: [], error: '' },
}) => {
  const [activeTab, setActiveTab] = useState('analysis')
  const [recordedOpen, setRecordedOpen] = useState(false)
  const fragments = useMemo(
    () => groupAnalysisSelections(querySelections.selections || []),
    [querySelections.selections],
  )
  const recordedRuns = useMemo(
    () => groupQueryHistoryEvents(queryHistory.events || []).slice(0, 8),
    [queryHistory.events],
  )
  const savedViews = useMemo(
    () => (Array.isArray(queryShares.shares) ? queryShares.shares : []).slice(0, 8),
    [queryShares.shares],
  )
  const loading =
    queryHistory.status === 'loading' ||
    querySelections.status === 'loading' ||
    queryShares.status === 'loading'
  const savingView = queryShares.status === 'saving'
  const refreshLibrary = onSelectionRefresh || onHistoryRefresh || onShareRefresh

  const tabButton = (key, label, count) => (
    <button
      className={activeTab === key ? 'is-active' : ''}
      onClick={() => setActiveTab(key)}
      type="button"
    >
      <span>{label}</span>
      <em>{formatCount(count)}</em>
    </button>
  )

  return (
    <div className="dt-query-library">
      <div className="dt-query-library__head">
        <div>
          <span>Saved work</span>
          <strong>{formatCount(fragments.length + recordedRuns.length + savedViews.length)} items</strong>
        </div>
        <button
          disabled={loading}
          onClick={() => refreshLibrary?.()}
          type="button"
        >
          <RefreshCw size={13} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="dt-query-library__tabs" aria-label="Query library sections">
        {tabButton('analysis', 'Answers', fragments.length)}
        {tabButton('views', 'Views', savedViews.length)}
      </div>

      <button
        className="dt-query-library__activity-toggle"
        onClick={() => setRecordedOpen((current) => !current)}
        type="button"
      >
        <Clock size={13} />
        <span>Recorded activity</span>
        <em>{formatCount(recordedRuns.length)}</em>
      </button>

      {recordedOpen ? (
        <div className="dt-query-library__list dt-query-library__list--activity">
          {!recordedRuns.length ? (
            <div className="dt-query-history__empty">Recorded activity will appear after running TwinQL queries.</div>
          ) : null}
          {recordedRuns.map((event) => (
            <button
              className="dt-query-library-item"
              key={event.id || event.historyGroupKey}
              onClick={() => onQueryReplay?.(event)}
              type="button"
            >
              <Clock size={14} />
              <span>
                  <strong>{historyLabel(event)}</strong>
                  <small>{dateLabel(event.createdAt || event.timestamp)}{event.duplicateCount > 1 ? ` / ${event.duplicateCount} runs` : ''}</small>
              </span>
              <em>{historyCountLabel(event)}</em>
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === 'analysis' ? (
        <div className="dt-query-library__list">
          {!fragments.length ? (
            <div className="dt-query-history__empty">Saved answers will appear here after saving a query result.</div>
          ) : null}
          {fragments.slice(0, 8).map((selection) => (
            <button
              className="dt-query-library-item"
              key={selection.id || selection.selectionGroupKey}
              onClick={() => onQueryReplay?.({ query: analysisSelectionSourceQuery(selection), metadata: { source: 'query-library-fragment', selectionId: selection.id } })}
              type="button"
            >
              <Bookmark size={14} />
              <span>
                <strong>{compactLabel(analysisSelectionLabel(selection), 'Saved answer')}</strong>
                <small>{dateLabel(selection.updatedAt || selection.createdAt) || (selection.queryHash ? `Query ${compactId(selection.queryHash)}` : 'Saved selection')}</small>
              </span>
              <em>{analysisSelectionCountLabel(selection)}</em>
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === 'views' ? (
        <div className="dt-query-library__list">
          <button
            className="dt-query-library__save"
            disabled={savingView}
            onClick={onShareSave}
            type="button"
          >
            <Bookmark size={14} />
            <span>{savingView ? 'Saving view' : 'Save current view'}</span>
          </button>
          {!savedViews.length ? (
            <div className="dt-query-history__empty">Saved views will appear here after saving the current visual state.</div>
          ) : null}
          {savedViews.map((share) => (
            <div className="dt-query-library-view" key={share.shareKey || share.id}>
              <button
                className="dt-query-library-item"
                onClick={() => onShareReplay?.(share)}
                type="button"
              >
                <Play size={14} />
                <span>
                  <strong>{compactLabel(queryShareLabel(share), 'Saved view')}</strong>
                  <small>{querySharePublicationLabel(share)} / {queryShareVisualSummary(share)} / {dateLabel(share.updatedAt || share.createdAt) || 'saved view'}</small>
                </span>
              </button>
              <button
                className="dt-query-library-view__publish"
                disabled={querySharePublicationLabel(share) === 'Published'}
                onClick={() => onSharePublish?.(share)}
                title="Publish signed share"
                type="button"
              >
                <Send size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {[queryHistory.error, querySelections.error, queryShares.error].filter(Boolean).slice(0, 1).map((error) => (
        <div className="dt-query-library__error" key={error}>{error}</div>
      ))}
    </div>
  )
}

const FragmentLayerPanel = ({
  onCommand,
  onRefresh,
  onSimulationRefresh,
  queryResult = null,
  querySelections = { status: 'idle', selections: [], error: '' },
  simulationWorlds = { status: 'idle', worlds: [], error: '' },
  viewerId = 'map',
  viewerReady = false,
  workspaceState = { status: 'idle', summary: null, error: '' },
}) => {
  const fragments = useMemo(
    () => fragmentOptionsFromQueryState({
      queryResult,
      querySelections,
      simulationWorlds: simulationWorlds.worlds,
    }),
    [queryResult, querySelections, simulationWorlds.worlds],
  )
  const [selectedIds, setSelectedIds] = useState([])
  const [initialized, setInitialized] = useState(false)
  const [colorBy, setColorBy] = useState('__fragment')
  const [opacity, setOpacity] = useState(78)

  useEffect(() => {
    if (initialized || !fragments.length) return
    setSelectedIds(fragments.slice(0, Math.min(2, fragments.length)).map((fragment) => fragment.id))
    setInitialized(true)
  }, [fragments, initialized])

  const effectiveSelectedIds = selectedIds.filter((id) => fragments.some((fragment) => fragment.id === id))
  const selectedFragments = fragments.filter((fragment) => effectiveSelectedIds.includes(fragment.id))
  const loading = querySelections.status === 'loading'
    || simulationWorlds.status === 'loading'
    || workspaceState.status === 'running'
  const readyLabel = viewerId === '3d' ? 'Cesium overlay' : 'MapLibre overlay'

  const refreshWorlds = () => {
    onRefresh?.()
    onSimulationRefresh?.()
  }

  const toggleFragment = (fragmentId) => {
    setInitialized(true)
    setSelectedIds((current) =>
      current.includes(fragmentId)
        ? current.filter((id) => id !== fragmentId)
        : [...current, fragmentId],
    )
  }

  const applyLayer = () => {
    if (!selectedFragments.length) return
    onCommand?.({
      kind: 'fragmentWorkspace',
      action: 'apply',
      fragments: selectedFragments,
      options: {
        colorBy,
        opacity: Math.min(1, Math.max(0.1, Number(opacity) / 100)),
      },
    })
  }

  const clearLayer = () => {
    onCommand?.({ kind: 'fragmentWorkspace', action: 'clear' })
  }

  return (
    <div className="dt-fragment-layer-panel">
      <div className="dt-fragment-layer-panel__head">
        <div>
          <span>{readyLabel}</span>
          <strong>{effectiveSelectedIds.length ? `${effectiveSelectedIds.length} selected` : 'Choose worlds'}</strong>
        </div>
        <button disabled={loading} onClick={refreshWorlds} type="button">
          <RefreshCw size={13} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="dt-fragment-layer-panel__actions">
        <button disabled={!viewerReady || loading || !selectedFragments.length} onClick={applyLayer} type="button">
          <Layers size={14} />
              <span>{loading ? 'Loading' : 'Apply overlay'}</span>
        </button>
        <button disabled={loading || workspaceState.status === 'idle'} onClick={clearLayer} type="button">
          <span>Clear</span>
        </button>
      </div>

      <label className="dt-fragment-layer-panel__field">
        <span>Color by</span>
        <select value={colorBy} onChange={(event) => setColorBy(event.target.value)}>
          {FRAGMENT_COLOR_FIELDS.map((field) => (
            <option key={field.key} value={field.key}>{field.label}</option>
          ))}
        </select>
      </label>

      <label className="dt-fragment-layer-panel__field">
        <span>Opacity</span>
        <input
          max="100"
          min="15"
          onChange={(event) => setOpacity(event.target.value)}
          step="5"
          type="range"
          value={opacity}
        />
      </label>

      <div className="dt-fragment-layer-panel__list">
        {!fragments.length ? (
          <div className="dt-query-history__empty">Saved query snapshots and simulations appear here.</div>
        ) : null}
        {fragments.slice(0, 14).map((fragment) => (
          <label className="dt-fragment-layer-item" key={fragment.id}>
            <input
              checked={effectiveSelectedIds.includes(fragment.id)}
              onChange={() => toggleFragment(fragment.id)}
              type="checkbox"
            />
            <span>
              <strong>{compactFragmentLabel(fragment.title, 'Saved world')}</strong>
              <small>{fragment.source === 'current-query' ? 'Current answer' : fragmentDetailLabel(fragment)}</small>
            </span>
            <em>{fragment.countLabel}</em>
          </label>
        ))}
      </div>

      {workspaceState.summary ? (
        <div className="dt-fragment-layer-panel__summary">
          <span>{formatFragmentCount(workspaceState.summary.rendered)} rendered</span>
          <span>{formatFragmentCount(workspaceState.summary.total)} total{workspaceState.summary.truncated ? ' +' : ''}</span>
        </div>
      ) : null}

      {workspaceState.error ? (
        <div className="dt-query-library__error">{workspaceState.error}</div>
      ) : null}
    </div>
  )
}

const SurfaceCommandPanel = ({ commands = [], onCommand }) => {
  if (!commands.length) return null
  return (
    <div className="dt-surface-command-panel">
      {commands.map((command) => (
        <button
          className="dt-sidebar-button dt-sidebar-button--compact"
          key={command.id}
          onClick={() => onCommand?.(command)}
          title={command.label}
          type="button"
        >
          <Camera size={14} />
          <span>{command.label}</span>
        </button>
      ))}
    </div>
  )
}

const SIDEBAR_POLICIES = {
  map: {
    answerDefaultOpen: true,
    queryDefaultOpen: true,
    savedDefaultOpen: false,
    showFragmentLayers: false,
    viewToolsDefaultOpen: false,
    viewToolsTitle: 'Map tools',
  },
  '3d': {
    answerDefaultOpen: true,
    queryDefaultOpen: true,
    savedDefaultOpen: false,
    showFragmentLayers: false,
    viewToolsDefaultOpen: false,
    viewToolsTitle: 'Camera presets',
  },
  immersive: {
    answerDefaultOpen: true,
    queryDefaultOpen: true,
    savedDefaultOpen: false,
    showFragmentLayers: false,
    viewToolsDefaultOpen: false,
    viewToolsTitle: 'XR scene',
  },
}

const sidebarPolicyFor = (viewerId) => SIDEBAR_POLICIES[viewerId] || SIDEBAR_POLICIES.map

const queryResultCount = (queryResult = null) => Number(
  queryResult?.resultCount ??
  queryResult?.summary?.resultCount ??
  queryResult?.returned ??
  queryResult?.geojson?.features?.length ??
  0,
)

const queryStatusLabel = (queryStatus, queryResult = null) => {
  if (queryStatus === 'running') return 'Running'
  if (queryStatus === 'error') return 'Needs review'
  if (queryStatus === 'ready') {
    const count = queryResultCount(queryResult)
    return `${formatCount(count)} ${count === 1 ? 'result' : 'results'}`
  }
  return 'Draft'
}

const QueryPassportPanel = ({
  activeViewerId = 'map',
  onOpenSurface,
  queryResult = null,
  queryStatus = 'idle',
}) => {
  const statusLabel = queryStatusLabel(queryStatus, queryResult)
  return (
    <div className="dt-query-passport">
      <div className="dt-query-passport__head">
        <span>Current answer</span>
        <strong>{statusLabel}</strong>
      </div>
      <div className="dt-query-passport__destinations" aria-label="Open current query in another surface">
        {QUERY_SURFACE_DESTINATIONS.map((surface) => {
          const isCurrent = surface.key === activeViewerId
          return (
            <button
              className={isCurrent ? 'is-current' : ''}
              disabled={isCurrent || !onOpenSurface}
              key={surface.key}
              onClick={() => onOpenSurface?.(surface.key)}
              type="button"
            >
              <span>{surface.label}</span>
              {!isCurrent ? <ExternalLink size={12} /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const CivicFragmentWorkspace = ({
  activeXrMode = 'walk',
  commands = [],
  onCommand,
  onRefresh,
  queryResult = null,
  querySelections = { status: 'idle', selections: [], error: '' },
}) => {
  const currentFragment = fragmentFromQueryResult(queryResult)
  const selectionFragments = useMemo(
    () => groupAnalysisSelections(querySelections.selections || []).map(fragmentFromSelection).filter((fragment) => fragment.id),
    [querySelections.selections],
  )
  const fragments = useMemo(
    () => (currentFragment ? [currentFragment, ...selectionFragments] : selectionFragments),
    [currentFragment, selectionFragments],
  )
  const [selectedIds, setSelectedIds] = useState([])
  const effectiveSelectedIds = selectedIds.filter((id) => fragments.some((fragment) => fragment.id === id))
  const selectedFragments = fragments.filter((fragment) => effectiveSelectedIds.includes(fragment.id))
  const fragmentCount = selectedFragments.length
  const loading = querySelections.status === 'loading'

  const toggleFragment = (fragmentId) => {
    setSelectedIds((current) =>
      current.includes(fragmentId)
        ? current.filter((id) => id !== fragmentId)
        : [...current, fragmentId],
    )
  }

  const dispatchMode = (command) => {
    onCommand?.({
      ...command,
      fragments: selectedFragments,
      fragmentWorkspace: {
        fragmentCount,
        fragmentIds: selectedFragments.map((fragment) => fragment.id),
        source: 'civic-fragment-workspace',
      },
    })
  }

  return (
    <div className="dt-civic-fragment-workspace">
      <div className="dt-civic-fragment-workspace__head">
        <div>
          <span>Fragment workspace</span>
              <strong>{fragmentCount ? `${fragmentCount} selected` : 'Choose answers'}</strong>
        </div>
        <button disabled={loading} onClick={onRefresh} type="button">
          <RefreshCw size={13} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="dt-civic-fragment-workspace__modes" aria-label="Civic XR answer modes">
        {commands.map((command) => (
          <button
            className={`dt-sidebar-button dt-civic-fragment-mode ${activeXrMode === command.value ? 'is-active' : ''}`}
            disabled={!fragmentCount}
            key={command.id}
            onClick={() => dispatchMode(command)}
            type="button"
          >
            <Navigation size={14} />
            <span>{command.label}</span>
          </button>
        ))}
      </div>

      <div className="dt-civic-fragment-workspace__list">
        {!fragments.length ? (
          <div className="dt-query-history__empty">
            Run a query, then save the answer for XR composition.
          </div>
        ) : null}
        {fragments.map((fragment) => (
          <label className="dt-civic-fragment-item" key={fragment.id}>
            <input
              checked={effectiveSelectedIds.includes(fragment.id)}
              onChange={() => toggleFragment(fragment.id)}
              type="checkbox"
            />
            <span>
              <strong>{compactLabel(fragment.title, 'Saved answer')}</strong>
              <small>{fragment.source === 'current-query' ? 'Current answer' : fragmentDetailLabel(fragment)}</small>
            </span>
            <em>{fragment.countLabel}</em>
          </label>
        ))}
      </div>
    </div>
  )
}

const TwinControlSidebar = ({
  title,
  body,
  commands = [],
  activeXrMode = 'walk',
  supportsCityScale = false,
  cityCoverage = 0,
  selection,
  visibleLayerCount,
  viewerReady,
  viewerId = 'map',
  queryBuilder = {},
  queryContract = null,
  queryDataSpace = { status: 'idle', profiles: [], result: null, error: '' },
  queryError = '',
  queryExport = { status: 'idle', format: 'csv', error: '' },
  queryHistory = { status: 'idle', events: [], error: '' },
  queryPresets = { status: 'idle', presets: [], error: '' },
  queryResult = null,
  querySelections = { status: 'idle', selections: [], groups: [], active: null, saved: null, error: '' },
  queryShares = { status: 'idle', shares: [], saved: null, error: '' },
  queryStatus = 'idle',
  fragmentWorkspaceState = { status: 'idle', summary: null, error: '' },
  simulationWorlds = { status: 'idle', worlds: [], error: '' },
  onQueryBuilderChange,
  onCommand,
  onQueryDataSpaceProfilesLoad,
  onQueryDataSpacePublish,
  onQueryHistoryRefresh,
  onQueryClear,
  onQueryExport,
  onQueryPresetApply,
  onQueryReplay,
  onQueryRun,
  onQuerySharePublish,
  onQueryShareRefresh,
  onQueryShareReplay,
  onQueryShareSave,
  onQuerySelectionRefresh,
  onQuerySelectionSave,
  onSimulationWorldRefresh,
  onOpenQuerySurface,
}) => {
  const copy = VIEWER_COPY[viewerId] ?? VIEWER_COPY.map
  const policy = sidebarPolicyFor(viewerId)
  const layerCountLabel = `${formatCount(visibleLayerCount)} ${Number(visibleLayerCount) === 1 ? 'layer' : 'layers'}`
  const queryActivityLabel = queryStatusLabel(queryStatus, queryResult)
  const surfaceCommands = viewerId !== 'immersive'
    ? commands.filter((command) => command.kind !== 'xrExperience')
    : []
  const xrFragmentCommands = viewerId === 'immersive'
    ? commands.filter((command) => command.kind === 'xrExperience')
    : []
  const supportsFragmentLayers = policy.showFragmentLayers

  return (
    <nav className="invoiceapp-sidebar dt-control-sidebar" aria-label={`${title} rail`}>
      <SimpleBar className="nicescroll-bar">
        <div className="menu-content-wrap dt-control-content">
          <header className="dt-control-head">
            <h2>{copy.title}</h2>
            <p>{body}</p>
            <div className="dt-control-state">
              <span className={viewerReady ? 'is-live' : ''}>{viewerReady ? 'Ready' : 'Loading'}</span>
              <span>{layerCountLabel}</span>
              <span>{queryActivityLabel}</span>
            </div>
          </header>

          {queryContract ? (
            <CollapsibleSection defaultOpen={policy.queryDefaultOpen} icon={Search} id={`${viewerId}-city-object-query`} title="Question">
              <TwinQueryPanel
                cityCoverage={cityCoverage}
                onChange={onQueryBuilderChange}
                onClear={onQueryClear}
                onDataSpaceProfilesLoad={onQueryDataSpaceProfilesLoad}
                onDataSpacePublish={onQueryDataSpacePublish}
                onExport={onQueryExport}
                onPresetApply={onQueryPresetApply}
                onRun={onQueryRun}
                onSelectionSave={onQuerySelectionSave}
                queryBuilder={queryBuilder}
                queryContract={queryContract}
                queryDataSpace={queryDataSpace}
                queryError={queryError}
                queryExport={queryExport}
                queryPresets={queryPresets}
                queryResult={queryResult}
                querySelections={querySelections}
                queryStatus={queryStatus}
                supportsCityScale={supportsCityScale}
              />
            </CollapsibleSection>
          ) : null}

          {queryContract ? (
            <CollapsibleSection defaultOpen={policy.answerDefaultOpen} icon={ExternalLink} id={`${viewerId}-query-passport`} title="Send answer">
              <QueryPassportPanel
                activeViewerId={viewerId}
                onOpenSurface={onOpenQuerySurface}
                queryResult={queryResult}
                queryStatus={queryStatus}
              />
            </CollapsibleSection>
          ) : null}

          {queryContract ? (
            <CollapsibleSection defaultOpen={policy.savedDefaultOpen} icon={Bookmark} id={`${viewerId}-query-library`} title="Saved work">
              <QueryLibraryPanel
                onHistoryRefresh={onQueryHistoryRefresh}
                onQueryReplay={onQueryReplay}
                onSelectionRefresh={onQuerySelectionRefresh}
                onSharePublish={onQuerySharePublish}
                onShareRefresh={onQueryShareRefresh}
                onShareReplay={onQueryShareReplay}
                onShareSave={onQueryShareSave}
                queryHistory={queryHistory}
                querySelections={querySelections}
                queryShares={queryShares}
              />
            </CollapsibleSection>
          ) : null}

          {surfaceCommands.length ? (
            <CollapsibleSection defaultOpen={policy.viewToolsDefaultOpen} icon={Camera} id={`${viewerId}-view-presets`} title={policy.viewToolsTitle}>
              <SurfaceCommandPanel commands={surfaceCommands} onCommand={onCommand} />
            </CollapsibleSection>
          ) : null}

          {queryContract && supportsFragmentLayers ? (
            <CollapsibleSection defaultOpen={false} icon={Layers} id={`${viewerId}-fragment-layer`} title="Compare overlays">
              <FragmentLayerPanel
                onCommand={onCommand}
                onRefresh={onQuerySelectionRefresh}
                onSimulationRefresh={onSimulationWorldRefresh}
                queryResult={queryResult}
                querySelections={querySelections}
                simulationWorlds={simulationWorlds}
                viewerId={viewerId}
                viewerReady={viewerReady}
                workspaceState={fragmentWorkspaceState}
              />
            </CollapsibleSection>
          ) : null}

          {xrFragmentCommands.length ? (
            <CollapsibleSection defaultOpen={false} icon={Navigation} id={`${viewerId}-civic-fragment-mode`} title="XR modes">
              <CivicFragmentWorkspace
                activeXrMode={activeXrMode}
                commands={xrFragmentCommands}
                onCommand={onCommand}
                onRefresh={onQuerySelectionRefresh}
                queryResult={queryResult}
                querySelections={querySelections}
              />
            </CollapsibleSection>
          ) : null}

          {selection ? (
            <CollapsibleSection icon={MapPin} id={`${viewerId}-selection`} title="Selection">
              <SelectionPanel selection={selection} />
            </CollapsibleSection>
          ) : null}
        </div>
      </SimpleBar>
    </nav>
  )
}

export default TwinControlSidebar
