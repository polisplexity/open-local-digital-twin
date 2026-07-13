'use client'

import { useEffect, useMemo, useState } from 'react'
import { Alert, Spinner } from 'react-bootstrap'
import DigitalTwinSurfaceShell from '@/components/twin-module/shell/DigitalTwinSurfaceShell'
import { usePlatformContext } from '@/context/PlatformContext'
import OperationsWorkspacePanel from '../workspace/panels/OperationsWorkspacePanel'
import {
  buildApiCatalogRows,
  buildApiUsageRows,
  buildIngestionRows,
  buildMetricsFamilyRows,
  buildOpenApiRows,
  buildSlowRouteRows,
} from '../workspace/ldtWorkspaceModel'

const initialState = {
  loading: true,
  error: '',
  capabilities: null,
  layerCapabilities: null,
  operationsReport: null,
  metricsSummary: null,
  openApiDocument: null,
  layerError: '',
  operationsError: '',
  metricsError: '',
  openApiError: '',
}

async function parseOptional(fetchPromise, expectedKey, fallbackError) {
  try {
    const response = await fetchPromise
    const body = await response.json().catch(() => ({}))
    const hasExpectedPayload = expectedKey ? Boolean(body?.[expectedKey]) : body?.ok !== false
    if (response.ok && hasExpectedPayload) return { data: body, error: '' }
    return { data: null, error: body?.error || body?.detail || `HTTP_${response.status}` }
  } catch (error) {
    return { data: null, error: String(error?.message ?? fallbackError) }
  }
}

function fallbackCapabilitiesFromOperationsReport(report) {
  if (!report) return null
  return {
    counts: report.counts ?? {},
    readinessChecks: (report.readiness ?? []).map((check) => ({
      ...check,
      category: check.category || 'operations',
      summary: check.summary || check.evidence || '',
    })),
    workflowRuns: report.workflowRuns ?? [],
  }
}

export default function OperationsSurfacePage({ view = 'overview' }) {
  const { activeCity, activeCityId } = usePlatformContext()
  const [operationsView, setOperationsView] = useState(view)
  const [state, setState] = useState(initialState)

  async function loadOperations() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const operations = await parseOptional(
        fetch('/api/live/current/operations/report', { credentials: 'same-origin' }),
        null,
        'OPERATIONS_REPORT_UNAVAILABLE',
      )
      const fallbackCapabilities = fallbackCapabilitiesFromOperationsReport(operations.data)
      if (!fallbackCapabilities) {
        throw new Error(operations.error || 'OPERATIONS_REPORT_UNAVAILABLE')
      }
      setState({
        loading: false,
        error: '',
        capabilities: fallbackCapabilities,
        layerCapabilities: null,
        operationsReport: operations.data,
        metricsSummary: null,
        openApiDocument: null,
        layerError: '',
        operationsError: operations.error,
        metricsError: '',
        openApiError: '',
      })

      Promise.all([
        parseOptional(fetch('/api/live/current/capabilities', { credentials: 'same-origin' }), null, 'CAPABILITIES_UNAVAILABLE'),
        parseOptional(fetch('/api/live/current/layer-capabilities', { credentials: 'same-origin' }), null, 'LAYER_CAPABILITIES_UNAVAILABLE'),
        parseOptional(fetch('/api/live/current/operations/metrics-summary', { credentials: 'same-origin' }), null, 'METRICS_SUMMARY_UNAVAILABLE'),
        parseOptional(fetch('/api/live/current/openapi.json', { credentials: 'same-origin' }), 'openapi', 'OPENAPI_DOCUMENT_UNAVAILABLE'),
      ]).then(([capabilities, layer, metrics, openApi]) => {
        setState((current) => ({
          ...current,
          capabilities: capabilities.data ?? current.capabilities,
          layerCapabilities: layer.data,
          metricsSummary: metrics.data,
          openApiDocument: openApi.data,
          layerError: layer.error,
          metricsError: metrics.error,
          openApiError: openApi.error,
        }))
      })
    } catch (error) {
      setState({
        ...initialState,
        loading: false,
        error: String(error?.message ?? 'OPERATIONS_UNAVAILABLE'),
      })
    }
  }

  useEffect(() => {
    setOperationsView(view)
  }, [view])

  useEffect(() => {
    loadOperations()
  }, [activeCityId])

  const checksByCategory = useMemo(() => (
    (state.capabilities?.readinessChecks ?? []).reduce((groups, check) => {
      const key = check.category || 'other'
      return { ...groups, [key]: [...(groups[key] ?? []), check] }
    }, {})
  ), [state.capabilities])
  const counts = state.capabilities?.counts ?? {}
  const apiCatalogRows = useMemo(() => buildApiCatalogRows(state.operationsReport), [state.operationsReport])
  const apiUsageRows = useMemo(() => buildApiUsageRows(state.operationsReport), [state.operationsReport])
  const ingestionRows = useMemo(() => buildIngestionRows(state.operationsReport), [state.operationsReport])
  const metricsFamilyRows = useMemo(() => buildMetricsFamilyRows(state.metricsSummary), [state.metricsSummary])
  const openApiRows = useMemo(() => buildOpenApiRows(state.openApiDocument), [state.openApiDocument])
  const slowRouteRows = useMemo(() => buildSlowRouteRows(state.metricsSummary), [state.metricsSummary])

  return (
    <DigitalTwinSurfaceShell
      badge={state.loading ? 'Loading' : 'Live'}
      showSurfaceSidebar={false}
      title={`${activeCity?.name || 'City'} Operations`}
    >
      <div className="ldt-operations-surface">
        {state.error ? <Alert variant="danger">Could not load operations: {state.error}</Alert> : null}
        {state.loading ? (
          <div className="ldt-workspace-loading">
            <Spinner animation="border" size="sm" />
            Loading operations
          </div>
        ) : null}
        {state.capabilities ? (
          <OperationsWorkspacePanel
            activeCityId={activeCityId}
            apiCatalogRows={apiCatalogRows}
            apiUsageRows={apiUsageRows}
            checksByCategory={checksByCategory}
            counts={counts}
            ingestionRows={ingestionRows}
            layerCapabilities={state.layerCapabilities}
            metricsError={state.metricsError}
            metricsFamilyRows={metricsFamilyRows}
            metricsSummary={state.metricsSummary}
            openApiDocument={state.openApiDocument}
            openApiError={state.openApiError}
            openApiRows={openApiRows}
            operationsError={state.operationsError}
            operationsReport={state.operationsReport}
            operationsView={operationsView}
            refreshWorkspace={loadOperations}
            setOperationsView={setOperationsView}
            slowRouteRows={slowRouteRows}
            workflowRuns={state.capabilities?.workflowRuns ?? []}
          />
        ) : null}
      </div>
    </DigitalTwinSurfaceShell>
  )
}
