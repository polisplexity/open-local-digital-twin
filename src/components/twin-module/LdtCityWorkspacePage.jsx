'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Alert, Badge, Button, Col, Row, Spinner } from 'react-bootstrap'
import { RefreshCw } from 'react-feather'
import DigitalTwinSurfaceShell from '@/app/(apps layout)/apps/digital-twin/DigitalTwinSurfaceShell'
import { usePlatformContext } from '@/context/PlatformContext'
import WorkspaceModuleNav from './workspace/WorkspaceModuleNav'
import WorkspaceModulePanel from './workspace/WorkspaceModulePanel'
import {
  buildAnalysisModelRows,
  buildAnalysisRows,
  buildApiCatalogRows,
  buildApiUsageRows,
  buildIngestionRows,
  buildInventoryRows,
  buildMetricsFamilyRows,
  buildModuleRows,
  buildOpenApiRows,
  buildPrimaryIndicators,
  buildSemanticFeatureRows,
  buildSemanticRows,
  buildSemanticRuleRows,
  buildSemanticWorkflowRows,
  buildSlowRouteRows,
  buildSourceRows,
  buildStandardsRows,
  cityModuleTabs,
  formatCount,
  statusVariant,
  titleize,
  visualSurfaces,
} from './workspace/ldtWorkspaceModel'

const initialWorkspaceState = {
  loading: true,
  error: '',
  payload: null,
  layerCapabilities: null,
  scienceReport: null,
  societyReport: null,
  semanticReport: null,
  operationsReport: null,
  metricsSummary: null,
  openApiDocument: null,
  layerError: '',
  scienceError: '',
  societyError: '',
  semanticError: '',
  operationsError: '',
  metricsError: '',
  openApiError: '',
}

async function parseOptionalResponse(result, expectedKey, fallbackError) {
  if (result.status !== 'fulfilled') {
    return { data: null, error: String(result.reason?.message ?? fallbackError) }
  }

  const body = await result.value.json()
  const hasExpectedPayload = expectedKey ? Boolean(body?.[expectedKey]) : body?.ok !== false
  if (result.value.ok && hasExpectedPayload) {
    return { data: body, error: '' }
  }

  return { data: null, error: body?.error || `HTTP_${result.value.status}` }
}

const LdtCityWorkspacePage = () => {
  const { activeCity, activeCityId } = usePlatformContext()
  const searchParams = useSearchParams()
  const [operationsView, setOperationsView] = useState('overview')
  const [state, setState] = useState(initialWorkspaceState)

  async function loadCapabilities() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const [
        capabilitiesResult,
        layerResult,
        scienceResult,
        societyResult,
        semanticResult,
        operationsResult,
        metricsResult,
        openApiResult,
      ] = await Promise.allSettled([
        fetch('/api/live/current/capabilities', { credentials: 'same-origin' }),
        fetch('/api/live/current/layer-capabilities', { credentials: 'same-origin' }),
        fetch('/api/live/current/science/urban-report', { credentials: 'same-origin' }),
        fetch('/api/live/current/society/report', { credentials: 'same-origin' }),
        fetch('/api/live/current/semantic-packs/reconstruction-service-core/report', { credentials: 'same-origin' }),
        fetch('/api/live/current/operations/report', { credentials: 'same-origin' }),
        fetch('/api/live/current/operations/metrics-summary', { credentials: 'same-origin' }),
        fetch('/api/live/current/openapi.json', { credentials: 'same-origin' }),
      ])

      if (capabilitiesResult.status !== 'fulfilled') {
        throw new Error(String(capabilitiesResult.reason?.message ?? 'CAPABILITIES_UNAVAILABLE'))
      }

      const response = capabilitiesResult.value
      const payload = await response.json()
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `HTTP_${response.status}`)

      const [
        layer,
        science,
        society,
        semantic,
        operations,
        metrics,
        openApi,
      ] = await Promise.all([
        parseOptionalResponse(layerResult, null, 'LAYER_CAPABILITIES_UNAVAILABLE'),
        parseOptionalResponse(scienceResult, null, 'SCIENCE_REPORT_UNAVAILABLE'),
        parseOptionalResponse(societyResult, null, 'SOCIETY_REPORT_UNAVAILABLE'),
        parseOptionalResponse(semanticResult, null, 'SEMANTIC_REPORT_UNAVAILABLE'),
        parseOptionalResponse(operationsResult, null, 'OPERATIONS_REPORT_UNAVAILABLE'),
        parseOptionalResponse(metricsResult, null, 'METRICS_SUMMARY_UNAVAILABLE'),
        parseOptionalResponse(openApiResult, 'openapi', 'OPENAPI_DOCUMENT_UNAVAILABLE'),
      ])

      setState({
        loading: false,
        error: '',
        payload,
        layerCapabilities: layer.data,
        scienceReport: science.data,
        societyReport: society.data,
        semanticReport: semantic.data,
        operationsReport: operations.data,
        metricsSummary: metrics.data,
        openApiDocument: openApi.data,
        layerError: layer.error,
        scienceError: science.error,
        societyError: society.error,
        semanticError: semantic.error,
        operationsError: operations.error,
        metricsError: metrics.error,
        openApiError: openApi.error,
      })
    } catch (error) {
      setState({
        ...initialWorkspaceState,
        loading: false,
        error: String(error?.message ?? 'CAPABILITIES_UNAVAILABLE'),
      })
    }
  }

  useEffect(() => {
    loadCapabilities()
  }, [activeCityId])

  const payload = state.payload
  const requestedModule = searchParams.get('module') || 'overview'
  const activeTab = cityModuleTabs.some((tab) => tab.key === requestedModule) ? requestedModule : 'overview'
  const activeModule = cityModuleTabs.find((tab) => tab.key === activeTab) ?? cityModuleTabs[0]
  const workspaceTitle = activeTab === 'overview' ? `${activeCity?.name || 'Kharkiv'} LDT Workspace` : activeModule.label
  const readinessSummary = payload?.readinessSummary ?? {}
  const readinessGaps = payload?.readinessGaps ?? []
  const indicators = useMemo(() => buildPrimaryIndicators(payload), [payload])
  const moduleRows = useMemo(() => buildModuleRows(payload), [payload])
  const readyModules = moduleRows.filter((module) => module.available).length
  const counts = useMemo(() => payload?.counts ?? {}, [payload])
  const readinessChecks = useMemo(() => payload?.readinessChecks ?? [], [payload])
  const workflowRuns = useMemo(() => payload?.workflowRuns ?? [], [payload])
  const layerCapabilities = state.layerCapabilities

  const entityItems = useMemo(() => (
    Object.entries(payload?.entityCounts ?? {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([key, value]) => ({ label: titleize(key), value }))
  ), [payload])
  const sourceItems = useMemo(() => (
    Object.entries(payload?.sourceLayerCounts ?? {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([key, value]) => ({ key, label: titleize(key), value }))
  ), [payload])
  const inventoryRows = useMemo(
    () => buildInventoryRows({ layerCapabilities, entityItems, sourceItems }),
    [layerCapabilities, entityItems, sourceItems],
  )
  const sourceRows = useMemo(
    () => buildSourceRows({ sourceItems, layerCapabilities }),
    [sourceItems, layerCapabilities],
  )
  const standardsRows = useMemo(
    () => buildStandardsRows({ counts, layerCapabilities }),
    [counts, layerCapabilities],
  )
  const analysisRows = useMemo(
    () => buildAnalysisRows({ scienceReport: state.scienceReport, societyReport: state.societyReport }),
    [state.scienceReport, state.societyReport],
  )
  const analysisModelRows = useMemo(
    () => buildAnalysisModelRows({ counts, scienceReport: state.scienceReport, societyReport: state.societyReport }),
    [counts, state.scienceReport, state.societyReport],
  )
  const semanticRows = useMemo(() => buildSemanticRows(state.semanticReport), [state.semanticReport])
  const semanticRuleRows = useMemo(() => buildSemanticRuleRows(state.semanticReport), [state.semanticReport])
  const semanticWorkflowRows = useMemo(() => buildSemanticWorkflowRows(state.semanticReport), [state.semanticReport])
  const semanticFeatureRows = useMemo(() => buildSemanticFeatureRows(state.semanticReport), [state.semanticReport])
  const apiCatalogRows = useMemo(() => buildApiCatalogRows(state.operationsReport), [state.operationsReport])
  const apiUsageRows = useMemo(() => buildApiUsageRows(state.operationsReport), [state.operationsReport])
  const ingestionRows = useMemo(() => buildIngestionRows(state.operationsReport), [state.operationsReport])
  const openApiRows = useMemo(() => buildOpenApiRows(state.openApiDocument), [state.openApiDocument])
  const metricsFamilyRows = useMemo(() => buildMetricsFamilyRows(state.metricsSummary), [state.metricsSummary])
  const slowRouteRows = useMemo(() => buildSlowRouteRows(state.metricsSummary), [state.metricsSummary])
  const checksByCategory = useMemo(() => (
    readinessChecks.reduce((groups, check) => {
      const key = check.category || 'other'
      return { ...groups, [key]: [...(groups[key] ?? []), check] }
    }, {})
  ), [readinessChecks])

  return (
    <DigitalTwinSurfaceShell
      badge={state.loading ? 'Loading' : 'Live'}
      showSurfaceSidebar={false}
      title="Kharkiv LDT Workspace"
    >
      <div className="ldt-workspace">
        <section className="ldt-cockpit-head" id="ldt-overview">
          <div>
            <span className="ldt-cockpit-head__eyebrow">{activeModule.domainLabel}</span>
            <h1>{workspaceTitle}</h1>
            <p>{activeModule.description}</p>
          </div>
          <div className="ldt-cockpit-head__actions">
            <Badge bg={statusVariant(payload?.readiness?.status)}>{titleize(payload?.readiness?.status || 'loading')}</Badge>
            <Button variant="outline-primary" size="sm" onClick={loadCapabilities}>
              <RefreshCw size={14} />
              Refresh
            </Button>
            <Button as={Link} href="/capabilities" variant="outline-secondary" size="sm">
              Capability contract
            </Button>
          </div>
        </section>

        <WorkspaceModuleNav activeTab={activeTab} />

        {state.error ? (
          <Alert variant="danger">Could not load the city capability contract: {state.error}</Alert>
        ) : null}

        {state.loading ? (
          <div className="ldt-workspace-loading">
            <Spinner animation="border" size="sm" />
            Loading city capability contract
          </div>
        ) : null}

        {payload ? (
          <>
            {activeTab === 'overview' ? (
              <>
                <section className="ldt-workspace-hero">
                  <div>
                    <span className="ldt-workspace-hero__eyebrow">Single-city product path</span>
                    <h1>{activeCity?.name || 'Kharkiv'} city twin control room</h1>
                    <p>
                      Standards-native workspace for inventory, evidence,
                      interoperability, analysis, semantic packs, workflows, and API operations.
                    </p>
                  </div>
                  <div className="ldt-workspace-hero__status">
                    <Badge bg={statusVariant(payload?.readiness?.status)}>{titleize(payload?.readiness?.status || 'loading')}</Badge>
                    <Button variant="outline-light" size="sm" onClick={loadCapabilities}>
                      <RefreshCw size={14} />
                      Refresh
                    </Button>
                  </div>
                </section>

                <section className="ldt-readiness-strip" aria-label="Readiness gate">
                  {['ready', 'partial', 'blocked', 'construction'].map((key) => (
                    <div className="ldt-readiness-strip__item" key={key}>
                      <span>{titleize(key)}</span>
                      <strong>{formatCount(readinessSummary[key])}</strong>
                    </div>
                  ))}
                  <div className="ldt-readiness-strip__item ldt-readiness-strip__item--wide">
                    <span>Open gaps</span>
                    <strong>{formatCount(readinessGaps.length)}</strong>
                  </div>
                </section>

                <Row className="g-3">
                  {indicators.map((indicator) => (
                    <Col xl={3} md={6} key={indicator.label}>
                      <article className="ldt-indicator-card">
                        <span>{indicator.label}</span>
                        <strong>{indicator.value}</strong>
                        <small>{indicator.status}</small>
                        <p>{indicator.detail}</p>
                      </article>
                    </Col>
                  ))}
                </Row>
              </>
            ) : null}

            <section className="ldt-section" id="ldt-city-modules">
              {activeTab === 'overview' ? (
                <div className="ldt-section__header">
                  <div>
                    <h2>Workspace modules</h2>
                    <p>Grouped by data engineering and city analysis responsibilities.</p>
                  </div>
                </div>
              ) : null}
              <div className="ldt-tab-shell">
                <WorkspaceModulePanel
                  activeCityId={activeCityId}
                  activeTab={activeTab}
                  analysisModelRows={analysisModelRows}
                  analysisRows={analysisRows}
                  apiCatalogRows={apiCatalogRows}
                  apiUsageRows={apiUsageRows}
                  checksByCategory={checksByCategory}
                  counts={counts}
                  ingestionRows={ingestionRows}
                  inventoryRows={inventoryRows}
                  layerCapabilities={layerCapabilities}
                  metricsFamilyRows={metricsFamilyRows}
                  moduleRows={moduleRows}
                  openApiRows={openApiRows}
                  operationsView={operationsView}
                  readyModules={readyModules}
                  refreshWorkspace={loadCapabilities}
                  semanticFeatureRows={semanticFeatureRows}
                  semanticRows={semanticRows}
                  semanticRuleRows={semanticRuleRows}
                  semanticWorkflowRows={semanticWorkflowRows}
                  setOperationsView={setOperationsView}
                  slowRouteRows={slowRouteRows}
                  sourceItems={sourceItems}
                  sourceRows={sourceRows}
                  standardsRows={standardsRows}
                  state={state}
                  workflowRuns={workflowRuns}
                />
              </div>
            </section>

            <section className="ldt-section" id="ldt-visualization">
              <div className="ldt-section__header">
                <div>
                  <h2>Visualization surfaces</h2>
                  <p>Map, 3D, and public modes connect to the same city capability contract.</p>
                </div>
              </div>
              <div className="ldt-surface-grid">
                {visualSurfaces.map((surface) => (
                  <article className="ldt-surface-tile" key={surface.title}>
                    <div>
                      <Badge bg={statusVariant(surface.status)}>{surface.status}</Badge>
                      <h3>{surface.title}</h3>
                      <p>{surface.summary}</p>
                    </div>
                    <Link className="btn btn-outline-secondary btn-sm" href={surface.href}>
                      Open
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </DigitalTwinSurfaceShell>
  )
}

export default LdtCityWorkspacePage
