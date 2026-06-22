import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button } from 'react-bootstrap'
import {
  apiStatusTone,
  compactList,
  formatCount,
  formatDate,
  operationViewTabs,
  statusVariant,
  titleize,
} from '../ldtWorkspaceModel'
import { MetricTile, ReadinessList } from '../WorkspacePanelPrimitives'

export default function OperationsWorkspacePanel({
  apiCatalogRows,
  apiUsageRows,
  checksByCategory,
  counts,
  ingestionRows,
  layerCapabilities,
  metricsError,
  metricsSummary,
  metricsFamilyRows,
  openApiDocument,
  openApiError,
  openApiRows,
  operationsError,
  operationsReport,
  operationsView,
  setOperationsView,
  slowRouteRows,
  workflowRuns,
  activeCityId = 'kharkiv',
  refreshWorkspace,
}) {
  const [workflowControl, setWorkflowControl] = useState({
    loading: false,
    error: '',
    message: '',
    definitions: [],
    runs: [],
    capabilities: null,
    selectedRun: null,
  })
  const [sourcePackage, setSourcePackage] = useState({
    layerKey: '',
    action: 'geojson',
    sourceFormat: 'geojson',
    sourceUri: '',
    sourceVersion: '',
    posture: 'open-data-native',
    queueForExecution: false,
    extractorKeys: {
      terrainDem: true,
      weatherField: true,
      hydrologyGrid: true,
    },
    refreshViewerAggregates: true,
    refreshConsolidation: true,
    refreshTwinQuerySurfaces: true,
  })
  const phase14Workflow = useMemo(
    () => workflowControl.definitions.find((workflow) => workflow.workflowKey === 'phase14-open-data-workflow-runner'),
    [workflowControl.definitions],
  )
  const controlledWorkflowRuns = workflowControl.runs.length ? workflowControl.runs : (operationsReport?.workflowRuns ?? workflowRuns)
  const workflowLabel = useCallback((runOrWorkflow = {}) => {
    const key = runOrWorkflow.workflowKey ?? runOrWorkflow.workflow_key
    if (key === 'phase14-open-data-workflow-runner') return 'Open Data Import Runner'
    if (key === 'standards-publication-refresh') return 'Standards Publication Refresh'
    return runOrWorkflow.workflowName || runOrWorkflow.name || key || 'Workflow'
  }, [])
  const layerOptions = useMemo(() => (layerCapabilities?.layers ?? [])
    .map((layer) => ({
      key: layer.key || layer.layerKey || layer.id || '',
      label: layer.label || layer.name || layer.key || layer.layerKey || layer.id || 'Layer',
      capability: layer.capability || layer.sourceKind || layer.kind || layer.type || '',
    }))
    .filter((layer) => layer.key)
    .filter((layer) => !/(^|[-_\s])(e2e|smoke|test)([-_\s]|$)/i.test(`${layer.key} ${layer.label}`))
    .sort((a, b) => a.label.localeCompare(b.label)), [layerCapabilities])
  const [manualLayerKey, setManualLayerKey] = useState('')
  const [usesManualLayerKey, setUsesManualLayerKey] = useState(false)
  const selectedLayer = useMemo(() => layerOptions.find((layer) => layer.key === sourcePackage.layerKey), [layerOptions, sourcePackage.layerKey])
  const selectedExtractorKeys = useMemo(() => [
    sourcePackage.extractorKeys.terrainDem ? 'terrain-dem' : null,
    sourcePackage.extractorKeys.weatherField ? 'weather-field' : null,
    sourcePackage.extractorKeys.hydrologyGrid ? 'hydrology-grid' : null,
  ].filter(Boolean), [sourcePackage.extractorKeys])
  const adapterRows = useMemo(() => (
    workflowControl.capabilities?.capabilities ?? []
  ).filter((capability) => [
    sourcePackage.action,
    sourcePackage.sourceFormat,
    'osm-local-extract',
    'mvt-cache-refresh',
  ].includes(capability.key)).slice(0, 6), [workflowControl.capabilities, sourcePackage.action, sourcePackage.sourceFormat])

  const cityBootstrapPreset = useMemo(() => {
    const cityId = String(activeCityId || 'kharkiv').trim() || 'kharkiv'
    const normalizedCityId = cityId.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'city'
    const citySlug = cityId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'city'
    const kharkivDefaults = cityId === 'kharkiv'
    return {
      cityId,
      citySlug,
      rawSchema: kharkivDefaults ? 'raw_osm_kharkiv' : `raw_osm_${normalizedCityId}`,
      sourceSlug: kharkivDefaults ? 'kharkiv-geofabrik-osm-pbf' : `${citySlug}-osm-pbf`,
      sourceUrl: kharkivDefaults ? 'https://download.geofabrik.de/europe/ukraine-latest.osm.pbf' : '',
      sourcePath: kharkivDefaults ? '/app/runtime-data/extracts/kharkiv/ukraine-latest.osm.pbf' : `/app/runtime-data/extracts/${citySlug}/latest.osm.pbf`,
      overtureRelease: '2026-04-15.0',
    }
  }, [activeCityId])

  const cityBootstrapTargets = useMemo(() => {
    const byKey = (pattern) => layerOptions.find((layer) => pattern.test(`${layer.key} ${layer.label}`))
    const roadsLayer = byKey(/(^|[-_\s])(roads|road|transport|streets|street)([-_\s]|$)/i)
    const overtureBuildingsLayer = byKey(/overture.*build|build.*overture/i)
    const buildingsLayer = overtureBuildingsLayer ?? byKey(/(^|[-_\s])buildings?([-_\s]|$)/i)
    const refreshLayer = buildingsLayer ?? roadsLayer ?? layerOptions[0]
    return {
      roadsLayer,
      buildingsLayer,
      refreshLayer,
      ready: Boolean(roadsLayer && buildingsLayer),
    }
  }, [layerOptions])

  const cityBootstrapChecks = useMemo(() => [
    { label: 'Selected city', value: cityBootstrapPreset.cityId },
    { label: 'OSM raw schema', value: cityBootstrapPreset.rawSchema },
    { label: 'OSM target', value: cityBootstrapTargets.roadsLayer?.label || 'Road layer missing' },
    { label: 'Overture target', value: cityBootstrapTargets.buildingsLayer?.label || 'Building layer missing' },
    { label: 'Viewer refresh', value: cityBootstrapTargets.refreshLayer?.label || 'Layer missing' },
  ], [cityBootstrapPreset, cityBootstrapTargets])

  async function readJson(response) {
    const body = await response.json().catch(() => ({}))
    if (!response.ok || body?.ok === false) {
      throw new Error(body?.error || body?.detail || `HTTP_${response.status}`)
    }
    return body
  }

  const loadWorkflowControl = useCallback(async (message = '') => {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message }))
    try {
      const [definitionsBody, runsBody, capabilitiesBody] = await Promise.all([
        fetch('/api/admin/workflows', { credentials: 'same-origin' }).then(readJson),
        fetch(`/api/admin/workflow-runs?cityId=${encodeURIComponent(activeCityId || 'kharkiv')}&limit=12`, { credentials: 'same-origin' }).then(readJson),
        fetch('/api/admin/provider-ingestion/capabilities', { credentials: 'same-origin' }).then(readJson),
      ])
      setWorkflowControl((current) => ({
        loading: false,
        error: '',
        message,
        definitions: definitionsBody.workflows ?? [],
        runs: runsBody.runs ?? [],
        capabilities: capabilitiesBody,
        selectedRun: current.selectedRun,
      }))
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'WORKFLOW_CONTROL_UNAVAILABLE'),
      }))
    }
  }, [activeCityId])


  async function createCityBootstrapRun() {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const providerPackages = [
        cityBootstrapTargets.roadsLayer ? {
          layerKey: cityBootstrapTargets.roadsLayer.key,
          action: 'osm-local-extract',
          sourceFormat: 'raw-osm-pbf',
          sourceUri: `file://${cityBootstrapPreset.sourcePath}`,
          sourceVersion: cityBootstrapPreset.sourceSlug,
          posture: 'open-data-native',
          queueForExecution: true,
          metadata: {
            rawSchema: cityBootstrapPreset.rawSchema,
            sourceSlug: cityBootstrapPreset.sourceSlug,
            sourceUrl: cityBootstrapPreset.sourceUrl || null,
            sourcePath: cityBootstrapPreset.sourcePath,
          },
        } : null,
        cityBootstrapTargets.buildingsLayer ? {
          layerKey: cityBootstrapTargets.buildingsLayer.key,
          action: 'overture-buildings',
          sourceFormat: 'overture-buildings',
          sourceUri: null,
          sourceVersion: cityBootstrapPreset.overtureRelease,
          release: cityBootstrapPreset.overtureRelease,
          posture: 'open-data-native',
          queueForExecution: true,
          metadata: {
            source: 'Overture Maps Buildings',
            release: cityBootstrapPreset.overtureRelease,
            bboxSource: 'active-city-boundary',
          },
        } : null,
        cityBootstrapTargets.roadsLayer ? {
          layerKey: cityBootstrapTargets.roadsLayer.key,
          action: 'overture-roads',
          sourceFormat: 'overture-roads',
          sourceUri: null,
          sourceVersion: cityBootstrapPreset.overtureRelease,
          release: cityBootstrapPreset.overtureRelease,
          posture: 'open-data-native',
          queueForExecution: true,
          metadata: {
            source: 'Overture Maps Transportation',
            release: cityBootstrapPreset.overtureRelease,
            bboxSource: 'active-city-boundary',
          },
        } : null,
      ].filter(Boolean)

      const body = await fetch('/api/admin/workflows/phase14-open-data-workflow-runner/runs', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cityId: cityBootstrapPreset.cityId,
          triggerKind: 'operator-ui',
          input: {
            sourcePlan: {
              kind: 'city-open-data-bootstrap',
              posture: 'open-data-native',
              target: `${cityBootstrapPreset.cityId}-city-open-data-bootstrap`,
              cityId: cityBootstrapPreset.cityId,
              preset: cityBootstrapPreset,
            },
            providerPackages,
            extractorKeys: ['terrain-dem', 'weather-field', 'hydrology-grid'],
            refreshViewerAggregates: true,
            refreshConsolidation: true,
            refreshTwinQuerySurfaces: true,
            validationMode: 'city-open-data-bootstrap',
          },
        }),
      }).then(readJson)
      await loadWorkflowControl(`Created ${workflowLabel(body.run)} city bootstrap run`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'CITY_BOOTSTRAP_RUN_CREATE_FAILED'),
      }))
    }
  }

  async function createPhase14Run() {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const providerPackage = {
        layerKey: sourcePackage.layerKey.trim(),
        action: sourcePackage.action,
        sourceFormat: sourcePackage.sourceFormat,
        sourceUri: sourcePackage.sourceUri.trim() || null,
        sourceVersion: sourcePackage.sourceVersion.trim() || null,
        posture: sourcePackage.posture,
        queueForExecution: sourcePackage.queueForExecution,
      }
      const body = await fetch('/api/admin/workflows/phase14-open-data-workflow-runner/runs', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cityId: activeCityId || 'kharkiv',
          triggerKind: 'operator-ui',
          input: {
            sourcePlan: {
              kind: sourcePackage.sourceUri.trim() ? 'operator-source-package' : 'operator-registered-source-intent',
              posture: sourcePackage.posture,
              target: `${activeCityId || 'kharkiv'}-open-data-import`,
            },
            providerPackages: [providerPackage],
            extractorKeys: selectedExtractorKeys,
            refreshViewerAggregates: sourcePackage.refreshViewerAggregates,
            refreshConsolidation: sourcePackage.refreshConsolidation,
            refreshTwinQuerySurfaces: sourcePackage.refreshTwinQuerySurfaces,
            validationMode: sourcePackage.sourceUri.trim() ? 'operator-source-validation' : 'operator-source-required',
          },
        }),
      }).then(readJson)
      await loadWorkflowControl(`Created ${workflowLabel(body.run)} run`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'WORKFLOW_RUN_CREATE_FAILED'),
      }))
    }
  }

  async function approveRun(run) {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const detail = await fetch(`/api/admin/workflow-runs/${run.id}`, { credentials: 'same-origin' }).then(readJson)
      const approvals = detail.run?.approvals ?? []
      for (const approval of approvals.filter((entry) => entry.status === 'requested')) {
        await fetch(`/api/admin/workflow-runs/${run.id}/approvals/${approval.approvalKey}/decision`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            decision: 'approved',
            reason: `Operator approval for ${approval.approvalKey}`,
          }),
        }).then(readJson)
      }
      await loadWorkflowControl(`Approved ${approvals.filter((entry) => entry.status === 'requested').length} decisions`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'WORKFLOW_APPROVAL_FAILED'),
      }))
    }
  }

  async function promoteIngestionJob(row) {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      await fetch(`/api/admin/ingestion-jobs/${row.key}/promote`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ submittedBy: 'open-data-operator-ui' }),
      }).then(readJson)
      await loadWorkflowControl(`Queued ${row.layer}`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'INGESTION_JOB_PROMOTE_FAILED'),
      }))
    }
  }

  async function inspectRun(run) {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const detail = await fetch(`/api/admin/workflow-runs/${run.id}`, { credentials: 'same-origin' }).then(readJson)
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: '',
        selectedRun: detail.run,
      }))
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'WORKFLOW_INSPECTION_FAILED'),
      }))
    }
  }

  async function executeRun(run) {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      await fetch(`/api/admin/workflow-runs/${run.id}/execute`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workerId: 'open-data-operator-ui' }),
      }).then(readJson)
      await loadWorkflowControl(`Executed ${workflowLabel(run)}`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'WORKFLOW_EXECUTION_FAILED'),
      }))
    }
  }

  useEffect(() => {
    if (operationsView === 'workflows') loadWorkflowControl()
  }, [operationsView, loadWorkflowControl])

  const operationsCounts = operationsReport?.counts ?? {}
  const operationsReadiness = operationsReport?.readiness ?? []
  const apiMetrics = metricsSummary?.api ?? {}
  const ingestionMetrics = metricsSummary?.ingestion ?? {}
  const workflowMetrics = metricsSummary?.workflows ?? {}

  return (
    <section className="ldt-module-panel">
      <div className="ldt-module-panel__header">
        <h2>Operations</h2>
        <p>API catalog, usage telemetry, ingestion jobs, workflow runs, and operator approvals for the active city backend.</p>
      </div>
      {operationsError ? <Alert variant="warning">Operations report is unavailable: {operationsError}</Alert> : null}
      {metricsError ? <Alert variant="warning">Metrics summary is unavailable: {metricsError}</Alert> : null}
      <div className="ldt-metric-grid">
        <MetricTile label="API catalog" value={operationsCounts.catalogEntries ?? 0} tone="Published routes" />
        <MetricTile label="API events" value={operationsCounts.apiEvents ?? counts.apiEvents} tone={`${operationsCounts.apiFamilies ?? 0} families observed`} />
        <MetricTile label="Ingestion jobs" value={operationsCounts.ingestionJobs ?? counts.ingestionJobs} tone={`${operationsCounts.activeIngestionJobs ?? 0} active`} />
        <MetricTile label="Pending approvals" value={operationsCounts.pendingApprovals ?? counts.pendingWorkflowApprovals} tone="Governance queue" />
      </div>

      <nav className="ldt-ops-switcher" aria-label="Operations sections">
        {operationViewTabs.map((tab) => (
          <button
            className={operationsView === tab.key ? 'is-active' : ''}
            key={tab.key}
            type="button"
            onClick={() => setOperationsView(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {operationsView === 'overview' ? (
        <>
          <div className="ldt-module-panel__header">
            <h3>Open-source observability core</h3>
            <p>App-native JSON metrics from `ldt_ops` and PostGIS. Prometheus and Grafana stay optional for operators who want them later.</p>
          </div>
          <div className="ldt-metric-grid">
            <MetricTile label="24h API events" value={apiMetrics.totalEvents ?? 0} tone={`${apiMetrics.errorRate ?? 0}% errors`} />
            <MetricTile label="P95 latency" value={apiMetrics.p95LatencyMs === null || apiMetrics.p95LatencyMs === undefined ? 'n/a' : `${apiMetrics.p95LatencyMs} ms`} tone={`${apiMetrics.avgLatencyMs ?? 0} ms avg`} />
            <MetricTile label="Active ingestion" value={ingestionMetrics.activeJobs ?? 0} tone={`${ingestionMetrics.failedJobs ?? 0} failed`} />
            <MetricTile label="Workflow control" value={workflowMetrics.activeRuns ?? 0} tone={`${workflowMetrics.pendingApprovals ?? 0} approvals`} />
          </div>
          <div className="ldt-source-flow-grid">
            <article>
              <span>Core runtime</span>
              <strong>{titleize(metricsSummary?.posture?.mode || 'core-json-observability')}</strong>
              <p>{compactList(metricsSummary?.posture?.requiredServices, 'application, postgis')}</p>
            </article>
            <article>
              <span>Optional ops pack</span>
              <strong>{compactList(metricsSummary?.posture?.optionalPacks, 'prometheus, grafana')}</strong>
              <p>Install only when a city/operator needs dashboard-grade infrastructure.</p>
            </article>
            <article>
              <span>Inventory signal</span>
              <strong>{formatCount(metricsSummary?.inventory?.cityEntities ?? counts.cityEntities)}</strong>
              <p>{formatCount(metricsSummary?.inventory?.sourceFeatures ?? 0)} source features and {formatCount(metricsSummary?.inventory?.catalogDatasets ?? 0)} catalog datasets.</p>
            </article>
          </div>

          <div className="ldt-source-flow-grid">
            {operationsReadiness.map((item) => (
              <article key={item.key}>
                <span>{item.label}</span>
                <strong>{titleize(item.status)}</strong>
                <p>{item.evidence}</p>
              </article>
            ))}
          </div>

          <div className="ldt-action-row">
            <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/operations/report">Operations report JSON</Link>
            <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/operations/metrics-summary">Metrics summary JSON</Link>
            <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/openapi.json">OpenAPI 3.1 JSON</Link>
            <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/standards/ogc/collections">OGC collections</Link>
            <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/standards/dcat">DCAT catalog</Link>
          </div>
        </>
      ) : null}

      {operationsView === 'apis' ? (
        <>
          <div className="ldt-module-panel__header">
            <h3>API explorer</h3>
            <p>Canonical city APIs and versioned aliases for the single-city product path.</p>
          </div>
          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table ldt-inventory-table--operations">
              <thead>
                <tr>
                  <th>API</th>
                  <th>Method</th>
                  <th>Contract</th>
                  <th>Access</th>
                  <th>State</th>
                  <th>Use</th>
                </tr>
              </thead>
              <tbody>
                {apiCatalogRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <strong>{row.path}</strong>
                      {row.versionedPath ? <span>v1 alias: {row.versionedPath}</span> : null}
                      <span>{row.purpose}</span>
                    </td>
                    <td><Badge bg="secondary">{row.method}</Badge></td>
                    <td>
                      <strong>{row.standard}</strong>
                      <span>{row.version}</span>
                    </td>
                    <td>{row.access}</td>
                    <td><Badge bg={statusVariant(row.state === 'ready' ? 'ready' : 'partial')}>{titleize(row.state)}</Badge></td>
                    <td>
                      {row.testHref ? (
                        <Link className="ldt-inline-link" href={row.testHref}>Open</Link>
                      ) : (
                        <span>Controlled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ldt-module-panel__header">
            <h3>OpenAPI 3.1 contract</h3>
            <p>Machine-readable route contract generated from the same operations catalog used by this cockpit module.</p>
          </div>
          {openApiError ? <Alert variant="warning">OpenAPI document is unavailable: {openApiError}</Alert> : null}
          <div className="ldt-source-flow-grid">
            <article>
              <span>Spec</span>
              <strong>{openApiDocument?.openapi || 'Not loaded'}</strong>
              <p>{openApiDocument?.info?.summary || 'OpenAPI contract pending.'}</p>
            </article>
            <article>
              <span>Operations</span>
              <strong>{formatCount(openApiRows.length)}</strong>
              <p>{formatCount(Object.keys(openApiDocument?.paths ?? {}).length)} paths grouped by capability, standards, analysis, and workflow domains.</p>
            </article>
            <article>
              <span>Security</span>
              <strong>Session scoped</strong>
              <p>City and admin routes use the same authenticated session boundary as the cockpit.</p>
            </article>
          </div>
          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table ldt-inventory-table--operations">
              <thead>
                <tr>
                  <th>Operation</th>
                  <th>Method</th>
                  <th>Tag</th>
                  <th>Body</th>
                  <th>Security</th>
                  <th>Responses</th>
                </tr>
              </thead>
              <tbody>
                {openApiRows.length ? openApiRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <strong>{row.path}</strong>
                      {row.aliasFor ? <span>Alias for {row.aliasFor}</span> : null}
                      <span>{row.summary} · {row.operationId}</span>
                    </td>
                    <td><Badge bg="secondary">{row.method}</Badge></td>
                    <td>{row.tag}</td>
                    <td>{row.requestBody}</td>
                    <td>{row.security}</td>
                    <td>{row.response}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6}>No OpenAPI operations loaded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {operationsView === 'telemetry' ? (
        <>
          <div className="ldt-module-panel__header">
            <h3>Metrics by route family</h3>
            <p>Recent traffic grouped by API domain, with error rate and latency from the same event table agents can read.</p>
          </div>
          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table">
              <thead>
                <tr>
                  <th>Family</th>
                  <th>Events</th>
                  <th>Errors</th>
                  <th>Error rate</th>
                  <th>Avg ms</th>
                  <th>P95 ms</th>
                  <th>Latest</th>
                </tr>
              </thead>
              <tbody>
                {metricsFamilyRows.length ? metricsFamilyRows.map((row) => (
                  <tr key={row.key}>
                    <td><strong>{row.family}</strong></td>
                    <td>{formatCount(row.events)}</td>
                    <td>{formatCount(row.errors)}</td>
                    <td>{row.errorRate}%</td>
                    <td>{row.avgLatencyMs === null ? 'n/a' : row.avgLatencyMs}</td>
                    <td>{row.p95LatencyMs === null ? 'n/a' : row.p95LatencyMs}</td>
                    <td>{row.latestEventAt}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7}>No route-family metrics recorded in the current window.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="ldt-module-panel__header">
            <h3>Slow route watch</h3>
            <p>Routes with the highest recent p95 latency before adding any external dashboard stack.</p>
          </div>
          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Method</th>
                  <th>Events</th>
                  <th>Avg ms</th>
                  <th>P95 ms</th>
                  <th>Latest</th>
                </tr>
              </thead>
              <tbody>
                {slowRouteRows.length ? slowRouteRows.map((row) => (
                  <tr key={row.key}>
                    <td><strong>{row.path}</strong></td>
                    <td>{row.method}</td>
                    <td>{formatCount(row.events)}</td>
                    <td>{row.avgLatencyMs === null ? 'n/a' : row.avgLatencyMs}</td>
                    <td>{row.p95LatencyMs === null ? 'n/a' : row.p95LatencyMs}</td>
                    <td>{row.latestEventAt}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6}>No slow-route samples recorded in the current window.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="ldt-module-panel__header">
            <h3>API usage</h3>
            <p>Observed requests by route family, method, status, and latency.</p>
          </div>
          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table">
              <thead>
                <tr>
                  <th>Route family</th>
                  <th>Method</th>
                  <th>Events</th>
                  <th>Errors</th>
                  <th>Status</th>
                  <th>Avg ms</th>
                  <th>Latest</th>
                </tr>
              </thead>
              <tbody>
                {apiUsageRows.length ? apiUsageRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <strong>{row.family}</strong>
                      <span>{row.path}</span>
                    </td>
                    <td>{row.method}</td>
                    <td>{formatCount(row.events)}</td>
                    <td>{formatCount(row.errors)}</td>
                    <td><Badge bg={statusVariant(apiStatusTone(row.lastStatusCode))}>{row.lastStatusCode || 'n/a'}</Badge></td>
                    <td>{row.avgLatencyMs === null ? 'n/a' : row.avgLatencyMs}</td>
                    <td>{row.lastSeenAt}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7}>No API usage events recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {operationsView === 'workflows' ? (
        <>
          <div className="ldt-module-panel__header">
            <h3>Open data import control</h3>
            <p>{workflowLabel(phase14Workflow)} - {titleize(phase14Workflow?.lifecycleStatus || 'current')}</p>
          </div>
          {workflowControl.error ? <Alert variant="warning">Workflow control is unavailable: {workflowControl.error}</Alert> : null}
          {workflowControl.message ? <Alert variant="success">{workflowControl.message}</Alert> : null}
          <div className="ldt-action-row">
            <Button variant="outline-secondary" size="sm" disabled={workflowControl.loading} onClick={() => loadWorkflowControl('Workflow control refreshed')}>
              Refresh workflows
            </Button>
            <Button variant="success" size="sm" disabled={workflowControl.loading || !cityBootstrapTargets.ready} onClick={createCityBootstrapRun}>
              Create city bootstrap
            </Button>
            <Button variant="primary" size="sm" disabled={workflowControl.loading || !sourcePackage.layerKey.trim()} onClick={createPhase14Run}>
              Create data import run
            </Button>
          </div>

          <div className="ldt-source-flow-grid">
            <article>
              <span>City bootstrap</span>
              <strong>{titleize(cityBootstrapPreset.cityId)}</strong>
              <p>Creates the city open-data run: local OSM promotion, Overture buildings and roads, extractor registration, and viewer/query refresh.</p>
            </article>
            <article>
              <span>Bootstrap sources</span>
              <strong>{cityBootstrapPreset.sourceSlug}</strong>
              <p>{cityBootstrapPreset.sourceUrl || cityBootstrapPreset.sourcePath}</p>
            </article>
            <article>
              <span>Overture release</span>
              <strong>{cityBootstrapPreset.overtureRelease}</strong>
              <p>Buildings and roads use the active city boundary unless a worker request overrides the bbox.</p>
            </article>
            <article>
              <span>Bootstrap readiness</span>
              <strong>{cityBootstrapTargets.ready ? 'Ready' : 'Needs layer targets'}</strong>
              <p>{compactList(cityBootstrapChecks.map((item) => `${item.label}: ${item.value}`), 'No city bootstrap checks')}</p>
            </article>
          </div>

          <div className="ldt-source-flow-grid ldt-source-flow-grid--forms">
            <article>
              <span>Source package</span>
              <label>Target layer
                <select value={usesManualLayerKey ? '__manual__' : sourcePackage.layerKey} onChange={(event) => {
                  const value = event.target.value
                  setUsesManualLayerKey(value === '__manual__')
                  setSourcePackage((current) => ({ ...current, layerKey: value === '__manual__' ? manualLayerKey : value }))
                }}>
                  <option value="">Select a city layer</option>
                  {layerOptions.map((layer) => (
                    <option key={layer.key} value={layer.key}>{layer.label}</option>
                  ))}
                  <option value="__manual__">Manual layer key</option>
                </select>
              </label>
              {usesManualLayerKey ? (
                <label>Manual key<input value={manualLayerKey} onChange={(event) => {
                  const value = event.target.value
                  setManualLayerKey(value)
                  setSourcePackage((current) => ({ ...current, layerKey: value }))
                }} placeholder="layer key" /></label>
              ) : null}
              {selectedLayer ? <p>{selectedLayer.key}{selectedLayer.capability ? ` - ${titleize(selectedLayer.capability)}` : ''}</p> : null}
              <label>Source URI<input value={sourcePackage.sourceUri} onChange={(event) => setSourcePackage((current) => ({ ...current, sourceUri: event.target.value }))} placeholder="https://, s3://, file://, gs://" /></label>
            </article>
            <article>
              <span>Adapter</span>
              <label>Action<select value={sourcePackage.action} onChange={(event) => setSourcePackage((current) => ({ ...current, action: event.target.value, sourceFormat: event.target.value === 'ogc-features' ? 'ogc-api-features' : event.target.value }))}><option value="geojson">GeoJSON</option><option value="csv">CSV</option><option value="ogc-features">OGC API Features</option><option value="stac">STAC / raster catalog</option><option value="cityjson">CityJSON</option><option value="package">Package inspection</option><option value="overture-buildings">Overture buildings</option><option value="overture-roads">Overture roads</option><option value="osm-local-extract">Local OSM extract</option><option value="mvt-cache-refresh">Viewer/MVT refresh</option></select></label>
              <label>Version<input value={sourcePackage.sourceVersion} onChange={(event) => setSourcePackage((current) => ({ ...current, sourceVersion: event.target.value }))} placeholder="optional" /></label>
            </article>
            <article>
              <span>Execution gates</span>
              <label><input type="checkbox" checked={sourcePackage.queueForExecution} onChange={(event) => setSourcePackage((current) => ({ ...current, queueForExecution: event.target.checked }))} /> Queue when source validates</label>
              <label><input type="checkbox" checked={sourcePackage.refreshConsolidation} onChange={(event) => setSourcePackage((current) => ({ ...current, refreshConsolidation: event.target.checked }))} /> Refresh city twin records</label>
              <label><input type="checkbox" checked={sourcePackage.refreshViewerAggregates} onChange={(event) => setSourcePackage((current) => ({ ...current, refreshViewerAggregates: event.target.checked }))} /> Refresh viewer outputs</label>
              <label><input type="checkbox" checked={sourcePackage.refreshTwinQuerySurfaces} onChange={(event) => setSourcePackage((current) => ({ ...current, refreshTwinQuerySurfaces: event.target.checked }))} /> Refresh query surfaces</label>
            </article>
            <article>
              <span>Extractor runs</span>
              <label><input type="checkbox" checked={sourcePackage.extractorKeys.terrainDem} onChange={(event) => setSourcePackage((current) => ({ ...current, extractorKeys: { ...current.extractorKeys, terrainDem: event.target.checked } }))} /> Terrain</label>
              <label><input type="checkbox" checked={sourcePackage.extractorKeys.weatherField} onChange={(event) => setSourcePackage((current) => ({ ...current, extractorKeys: { ...current.extractorKeys, weatherField: event.target.checked } }))} /> Weather</label>
              <label><input type="checkbox" checked={sourcePackage.extractorKeys.hydrologyGrid} onChange={(event) => setSourcePackage((current) => ({ ...current, extractorKeys: { ...current.extractorKeys, hydrologyGrid: event.target.checked } }))} /> Hydrology</label>
            </article>
          </div>
          {workflowControl.capabilities ? (
            <div className="ldt-source-flow-grid">
              <article>
                <span>Executable adapters</span>
                <strong>{formatCount(workflowControl.capabilities.supportedActions?.length ?? 0)}</strong>
                <p>{compactList(workflowControl.capabilities.supportedActions, 'No executable adapters detected')}</p>
              </article>
              <article>
                <span>Metadata-only</span>
                <strong>{formatCount(workflowControl.capabilities.metadataOnlyActions?.length ?? 0)}</strong>
                <p>{compactList(workflowControl.capabilities.metadataOnlyActions, 'No metadata-only adapters')}</p>
              </article>
              <article>
                <span>Missing tools</span>
                <strong>{formatCount(workflowControl.capabilities.missingToolActions?.length ?? 0)}</strong>
                <p>{compactList(workflowControl.capabilities.missingToolActions, 'No missing tool-backed actions')}</p>
              </article>
              <article>
                <span>Pending adapters</span>
                <strong>{formatCount(workflowControl.capabilities.pendingAdapters?.length ?? 0)}</strong>
                <p>{compactList(workflowControl.capabilities.pendingAdapters, 'No pending adapters')}</p>
              </article>
            </div>
          ) : null}

          {adapterRows.length ? (
            <div className="ldt-inventory-table-wrap">
              <table className="ldt-inventory-table ldt-inventory-table--operations">
                <thead>
                  <tr>
                    <th>Adapter</th>
                    <th>State</th>
                    <th>Tools</th>
                    <th>Writes</th>
                  </tr>
                </thead>
                <tbody>
                  {adapterRows.map((capability) => (
                    <tr key={capability.key}>
                      <td><strong>{capability.label}</strong><span>{capability.key}</span></td>
                      <td><Badge bg={statusVariant(capability.canExecute ? 'ready' : capability.runtimeStatus === 'pending-adapter' ? 'construction' : 'partial')}>{titleize(capability.runtimeStatus)}</Badge></td>
                      <td>{compactList((capability.tools ?? []).map((tool) => `${tool.tool}: ${tool.available ? 'ready' : 'missing'}`), 'App-native')}</td>
                      <td>{compactList(capability.writes, 'Metadata')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table ldt-inventory-table--operations">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>Status</th>
                  <th>Approvals</th>
                  <th>Artifacts</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {controlledWorkflowRuns.length ? controlledWorkflowRuns.slice(0, 8).map((run) => {
                  const approvalCount = Array.isArray(run.approvals) ? run.approvals.length : run.pendingApprovals ?? 0
                  const artifactCount = Array.isArray(run.artifacts) ? run.artifacts.length : run.artifactCount ?? 0
                  return (
                    <tr key={run.id}>
                      <td>
                        <strong>{workflowLabel(run)}</strong>
                        <span>{run.id}</span>
                      </td>
                      <td><Badge bg={statusVariant(run.status === 'succeeded' || run.status === 'queued' ? 'ready' : 'partial')}>{titleize(run.status)}</Badge></td>
                      <td>{formatCount(approvalCount)}</td>
                      <td>{formatCount(artifactCount)}</td>
                      <td>{formatDate(run.updatedAt || run.createdAt)}</td>
                      <td>
                        {run.status === 'approval_required' ? (
                          <Button variant="outline-primary" size="sm" disabled={workflowControl.loading} onClick={() => approveRun(run)}>
                            Approve
                          </Button>
                        ) : null}
                        {run.status === 'queued' && run.workflowKey === 'phase14-open-data-workflow-runner' ? (
                          <Button variant="outline-success" size="sm" disabled={workflowControl.loading} onClick={() => executeRun(run)}>
                            Execute
                          </Button>
                        ) : null}
                        {run.status === 'queued' && run.workflowKey !== 'phase14-open-data-workflow-runner' ? <span>Queued</span> : null}
                        {!['approval_required', 'queued'].includes(run.status) ? <span>{titleize(run.status)}</span> : null}
                        <Button variant="outline-secondary" size="sm" disabled={workflowControl.loading} onClick={() => inspectRun(run)}>
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={6}>No workflow runs loaded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {workflowControl.selectedRun ? (
            <div className="ldt-source-flow-grid">
              <article><span>Selected run</span><strong>{workflowLabel(workflowControl.selectedRun)}</strong><p>{workflowControl.selectedRun.id}</p></article>
              <article><span>Steps</span><strong>{formatCount(workflowControl.selectedRun.steps?.length ?? 0)}</strong><p>{compactList((workflowControl.selectedRun.steps ?? []).map((step) => `${step.stepKey}: ${step.status}`), 'No steps loaded')}</p></article>
              <article><span>Artifacts</span><strong>{formatCount(workflowControl.selectedRun.artifacts?.length ?? 0)}</strong><p>{compactList((workflowControl.selectedRun.artifacts ?? []).map((artifact) => artifact.artifactKind), 'No artifacts loaded')}</p></article>
              <article><span>Approvals</span><strong>{formatCount(workflowControl.selectedRun.approvals?.length ?? 0)}</strong><p>{compactList((workflowControl.selectedRun.approvals ?? []).map((approval) => `${approval.approvalKey}: ${approval.status}`), 'No approvals loaded')}</p></article>
              <article><span>Provider jobs</span><strong>{formatCount(workflowControl.selectedRun.output?.providerJobs?.length ?? 0)}</strong><p>{compactList((workflowControl.selectedRun.output?.providerJobs ?? []).map((job) => `${job.layerKey}: ${job.status}`), 'No provider jobs')}</p></article>
              <article><span>Extractor state</span><strong>{formatCount(workflowControl.selectedRun.output?.extractorRuns?.length ?? 0)}</strong><p>{compactList((workflowControl.selectedRun.output?.extractorRuns ?? []).map((run) => `${run.extractorKey}: ${run.status || run.sourceStatus}`), 'No extractor runs')}</p></article>
              <article><span>Refresh plan</span><strong>{titleize(workflowControl.selectedRun.output?.refreshPlan?.executionState || 'not scheduled')}</strong><p>{compactList(Object.entries(workflowControl.selectedRun.output?.refreshPlan ?? {}).filter(([, value]) => value === true).map(([key]) => key), 'No refresh requested')}</p></article>
              <article><span>Worker capability</span><strong>{formatCount(workflowControl.selectedRun.output?.workerCapability?.supportedActions?.length ?? 0)}</strong><p>{compactList(workflowControl.selectedRun.output?.workerCapability?.supportedActions, 'No adapter capability recorded')}</p></article>
            </div>
          ) : null}

          <div className="ldt-module-panel__header">
            <h3>Ingestion jobs</h3>
            <p>Open-data and provider-layer jobs registered for this city, including validation report counts and queue state.</p>
          </div>
          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table">
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Provider</th>
                  <th>Format</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Reports</th>
                  <th>Source</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {ingestionRows.length ? ingestionRows.map((row) => (
                  <tr key={row.key}>
                    <td><strong>{row.layer}</strong></td>
                    <td>{row.provider}</td>
                    <td>{row.format}</td>
                    <td><Badge bg={statusVariant(row.status === 'succeeded' || row.status === 'registered' ? 'ready' : 'partial')}>{titleize(row.status)}</Badge></td>
                    <td>{formatCount(row.attempts)}</td>
                    <td>{formatCount(row.reports)}</td>
                    <td>
                      <strong>{titleize(row.sourceState)}</strong>
                      <span>{row.validationSummary}</span>
                    </td>
                    <td>{row.updatedAt}</td>
                    <td>
                      {row.status === 'registered' && row.canQueue ? (
                        <Button variant="outline-success" size="sm" disabled={workflowControl.loading} onClick={() => promoteIngestionJob(row)}>
                          Queue
                        </Button>
                      ) : <span>{row.status === 'registered' ? 'Registered' : titleize(row.status)}</span>}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={9}>No ingestion jobs recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="ldt-module-panel__header">
            <h3>Workflow runs</h3>
            <p>Controlled executions that keep agents, data changes, and publication approvals separated from automatic publication.</p>
          </div>
          <div className="ldt-compact-list">
            {(operationsReport?.workflowRuns ?? workflowRuns).slice(0, 8).map((run) => (
              <div key={run.id}>
                <span>{run.workflowDomain ? titleize(run.workflowDomain) : 'Workflow'}</span>
                <strong>{run.workflowName || run.workflowKey} · {titleize(run.status)}</strong>
              </div>
            ))}
          </div>
          <ReadinessList category="operations" checksByCategory={checksByCategory} />
        </>
      ) : null}
    </section>
  )
}
