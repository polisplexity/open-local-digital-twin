'use client'

import { useId, useMemo, useState } from 'react'
import SimpleBar from 'simplebar-react'
import { Bookmark, ChevronDown, Clock, MapPin, Navigation, Play, RefreshCw, Search, Send, Target } from 'react-feather'
import { formatCount, VIEWER_COPY } from './controls/visualRailModel'
import AreaContextPanel from './panels/AreaContextPanel'
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
} from './query/queryShareModel'

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
  return classes.length ? classes.slice(0, 3).join(' + ') : 'Recorded query'
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
  const [activeTab, setActiveTab] = useState('fragments')
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
          <span>Query library</span>
          <strong>{formatCount(fragments.length + recordedRuns.length + savedViews.length)} items</strong>
        </div>
        <button
          disabled={loading}
          onClick={() => {
            onSelectionRefresh?.()
            onHistoryRefresh?.()
            onShareRefresh?.()
          }}
          type="button"
        >
          <RefreshCw size={13} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="dt-query-library__tabs" aria-label="Query library sections">
        {tabButton('fragments', 'Fragments', fragments.length)}
        {tabButton('recorded', 'Recorded', recordedRuns.length)}
        {tabButton('views', 'Views', savedViews.length)}
      </div>

      {activeTab === 'fragments' ? (
        <div className="dt-query-library__list">
          {!fragments.length ? (
            <div className="dt-query-history__empty">Saved fragments will appear here after Save Fragment.</div>
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
                <strong>{analysisSelectionLabel(selection)}</strong>
                <small>{selection.queryHash || dateLabel(selection.updatedAt || selection.createdAt) || 'analysis selection'}</small>
              </span>
              <em>{analysisSelectionCountLabel(selection)}</em>
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === 'recorded' ? (
        <div className="dt-query-library__list">
          {!recordedRuns.length ? (
            <div className="dt-query-history__empty">Recorded runs will appear after running TwinQL queries.</div>
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
            <div className="dt-query-history__empty">Saved views will appear here after saving the current query view.</div>
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
                  <strong>{queryShareLabel(share)}</strong>
                  <small>{querySharePublicationLabel(share)} / {dateLabel(share.updatedAt || share.createdAt) || 'saved view'}</small>
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
          <strong>{fragmentCount ? `${fragmentCount} selected` : 'No fragments selected'}</strong>
        </div>
        <button disabled={loading} onClick={onRefresh} type="button">
          <RefreshCw size={13} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="dt-civic-fragment-workspace__modes" aria-label="Civic XR fragment modes">
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
            Run a query, then save it as a fragment for XR composition.
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
              <strong>{fragment.title}</strong>
              <small>{fragment.source === 'current-query' ? 'Unsaved current query' : fragment.queryHash || fragment.source}</small>
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
  selectedAreaError = '',
  selectedAreaLoading = false,
  selectedAreaSummary = null,
  selectionUnits = null,
  surfaceManifest = null,
  visibleLayerCount,
  visibleRendered,
  viewerReady,
  viewerId = 'map',
  queryBuilder = {},
  queryContract = null,
  queryError = '',
  queryHistory = { status: 'idle', events: [], error: '' },
  queryResult = null,
  querySelections = { status: 'idle', selections: [], groups: [], active: null, saved: null, error: '' },
  queryShares = { status: 'idle', shares: [], saved: null, error: '' },
  queryStatus = 'idle',
  onQueryBuilderChange,
  onCommand,
  onQueryHistoryRefresh,
  onQueryClear,
  onQueryReplay,
  onQueryRun,
  onQuerySharePublish,
  onQueryShareRefresh,
  onQueryShareReplay,
  onQueryShareSave,
  onQuerySelectionRefresh,
  onQuerySelectionSave,
}) => {
  const copy = VIEWER_COPY[viewerId] ?? VIEWER_COPY.map
  const xrFragmentCommands = viewerId === 'immersive'
    ? commands.filter((command) => command.kind === 'xrExperience')
    : []

  return (
    <nav className="invoiceapp-sidebar dt-control-sidebar" aria-label={`${title} rail`}>
      <SimpleBar className="nicescroll-bar">
        <div className="menu-content-wrap dt-control-content">
          <header className="dt-control-head">
            <h2>{copy.title}</h2>
            <p>{body}</p>
            <div className="dt-control-state">
              <span className={viewerReady ? 'is-live' : ''}>{viewerReady ? 'Ready' : 'Loading'}</span>
              <span>{formatCount(visibleLayerCount)} visible layers</span>
            </div>
          </header>

          {queryContract ? (
            <CollapsibleSection defaultOpen={viewerId !== 'immersive'} icon={Search} id={`${viewerId}-city-object-query`} title="City object query">
              <TwinQueryPanel
                cityCoverage={cityCoverage}
                onChange={onQueryBuilderChange}
                onClear={onQueryClear}
                onRun={onQueryRun}
                onSelectionSave={onQuerySelectionSave}
                queryBuilder={queryBuilder}
                queryContract={queryContract}
                queryError={queryError}
                queryResult={queryResult}
                querySelections={querySelections}
                queryStatus={queryStatus}
                supportsCityScale={supportsCityScale}
              />
            </CollapsibleSection>
          ) : null}

          {queryContract ? (
            <CollapsibleSection defaultOpen={viewerId === 'immersive'} icon={Bookmark} id={`${viewerId}-query-library`} title="Query library">
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

          {xrFragmentCommands.length ? (
            <CollapsibleSection icon={Navigation} id={`${viewerId}-civic-fragment-mode`} title="Civic fragment mode">
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

          {(surfaceManifest || selectedAreaSummary || selectedAreaLoading || selectedAreaError) ? (
            <CollapsibleSection icon={Target} id={`${viewerId}-area-context`} title="Area context">
              <AreaContextPanel
                error={selectedAreaError}
                loading={selectedAreaLoading}
                selectedAreaSummary={selectedAreaSummary}
                selectionUnits={selectionUnits}
                surfaceManifest={surfaceManifest}
              />
            </CollapsibleSection>
          ) : null}

          <CollapsibleSection icon={MapPin} id={`${viewerId}-selection`} title="Selection">
            <SelectionPanel selection={selection} />
          </CollapsibleSection>

          <CollapsibleSection icon={Target} id={`${viewerId}-surface-counts`} title="Surface counts">
            <div className="dt-sidebar-summary">
              <div className="dt-sidebar-stat">
                <span>Selected features</span>
                <strong>{formatCount(visibleRendered)}</strong>
              </div>
              <div className="dt-sidebar-stat">
                <span>Visible layers</span>
                <strong>{formatCount(visibleLayerCount)}</strong>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection id={`${viewerId}-movement`} title="Movement">
            <div className="dt-side-note dt-side-note--compact">
              <strong>Movement</strong>
              <p>{copy.movement}</p>
            </div>
          </CollapsibleSection>
        </div>
      </SimpleBar>
    </nav>
  )
}

export default TwinControlSidebar
