'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Alert, Badge, Spinner } from 'react-bootstrap'
import DigitalTwinSurfaceShell from '@/components/twin-module/shell/DigitalTwinSurfaceShell'
import { usePlatformContext } from '@/context/PlatformContext'
import StandardsWorkspacePanel from '../workspace/panels/StandardsWorkspacePanel'
import {
  buildLdtComplianceRows,
  buildStandardsRows,
  formatCount,
  ldtStateDefinitions,
  ldtStateVariant,
  operationViewTabs,
  titleize,
} from '../workspace/ldtWorkspaceModel'
import { MetricTile } from '../workspace/WorkspacePanelPrimitives'

const initialState = {
  loading: false,
  capabilityLoading: true,
  error: '',
  capabilities: null,
  layerCapabilities: null,
  openApiDocument: null,
  dcatCatalog: null,
  layerError: '',
  openApiError: '',
  dcatError: '',
}

async function parseRequiredResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || body?.detail || `HTTP_${response.status}`)
  }
  return body
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

export default function StandardsSurfacePage({ operationsMode = false } = {}) {
  const { activeCity, activeCityId } = usePlatformContext()
  const [state, setState] = useState(initialState)

  const loadStandards = useCallback(async () => {
    setState((current) => ({
      ...current,
      capabilityLoading: true,
      loading: operationsMode,
      error: '',
      capabilities: null,
      layerCapabilities: null,
      openApiDocument: null,
      dcatCatalog: null,
      layerError: '',
      openApiError: '',
      dcatError: '',
    }))
    const optionalRequests = Promise.all([
      parseOptional(fetch('/api/live/current/layer-capabilities', { credentials: 'same-origin' }), null, 'LAYER_CAPABILITIES_UNAVAILABLE'),
      parseOptional(fetch('/api/live/current/openapi.json', { credentials: 'same-origin' }), 'openapi', 'OPENAPI_DOCUMENT_UNAVAILABLE'),
      parseOptional(fetch('/api/live/current/standards/dcat', { credentials: 'same-origin' }), 'dcat:dataset', 'DCAT_CATALOG_UNAVAILABLE'),
    ])

    optionalRequests.then(([layer, openApi, dcat]) => {
      setState((current) => ({
        ...current,
        layerCapabilities: layer.data,
        openApiDocument: openApi.data,
        dcatCatalog: dcat.data,
        layerError: layer.error,
        openApiError: openApi.error,
        dcatError: dcat.error,
      }))
    })

    try {
      const capabilities = await fetch('/api/live/current/capabilities', { credentials: 'same-origin' }).then(parseRequiredResponse)
      setState((current) => ({
        ...current,
        loading: false,
        capabilityLoading: false,
        error: '',
        capabilities,
      }))
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        capabilityLoading: false,
        error: String(error?.message ?? 'STANDARDS_UNAVAILABLE'),
      }))
    }
  }, [operationsMode])

  useEffect(() => {
    loadStandards()
  }, [activeCityId, loadStandards])

  const checksByCategory = useMemo(() => (
    (state.capabilities?.readinessChecks ?? []).reduce((groups, check) => {
      const key = check.category || 'other'
      return { ...groups, [key]: [...(groups[key] ?? []), check] }
    }, {})
  ), [state.capabilities])
  const counts = useMemo(() => state.capabilities?.counts ?? {}, [state.capabilities])
  const standardsRows = useMemo(
    () => buildStandardsRows({ counts, layerCapabilities: state.layerCapabilities }),
    [counts, state.layerCapabilities],
  )
  const complianceRows = useMemo(
    () => buildLdtComplianceRows({
      counts,
      layerCapabilities: state.layerCapabilities,
      openApiDocument: state.openApiDocument,
    }),
    [counts, state.layerCapabilities, state.openApiDocument],
  )
  const generatedCount = complianceRows.filter((row) => row.currentState === 'generated').length
  const validatedCount = complianceRows.filter((row) => row.currentState === 'validated').length
  const federatedCount = complianceRows.filter((row) => row.currentState === 'federated').length
  const authorityCount = complianceRows.filter((row) => row.currentState === 'authority-approved').length
  const blockRender = operationsMode && state.capabilityLoading && !state.capabilities

  function renderComplianceView() {
    return (
      <>
        <section className="ldt-module-panel ldt-standards-brief">
          <div className="ldt-module-panel__header">
            <h2>LDT compliance and EU readiness</h2>
            <p>
              Capabilities are product functions the platform can execute. Assessments are review frameworks
              that score evidence, gaps, visibility, and approval posture without pretending that review equals implementation.
            </p>
          </div>
          <div className="ldt-metric-grid">
            <MetricTile label="Implemented mappings" value={formatCount(complianceRows.length)} tone="Architecture" />
            <MetricTile label="Generated outputs" value={formatCount(generatedCount)} tone="Current city" />
            <MetricTile label="Validated outputs" value={formatCount(validatedCount)} tone="Smoke gates" />
            <MetricTile label="Federated / approved" value={`${formatCount(federatedCount)} / ${formatCount(authorityCount)}`} tone="External state" />
          </div>
          <div className="ldt-standards-ladder" aria-label="LDT standards state ladder">
            {ldtStateDefinitions.map((definition) => (
              <div className="ldt-standards-ladder__step" key={definition.key} title={definition.rule}>
                <Badge bg={ldtStateVariant(definition.key)}>{definition.label}</Badge>
                <span>{complianceRows.filter((row) => row.currentState === definition.key).length}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="ldt-module-panel">
          <div className="ldt-module-panel__header">
            <h2>Evidence rules</h2>
            <p>These rules keep generated data, tested outputs, federation, and authority approval separate.</p>
          </div>
          <div className="ldt-evidence-grid">
            {ldtStateDefinitions.map((definition) => (
              <article className="ldt-evidence-card" key={definition.key}>
                <Badge bg={ldtStateVariant(definition.key)}>{definition.label}</Badge>
                <strong>{definition.rule}</strong>
                <p>{definition.evidence}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ldt-module-panel">
          <div className="ldt-module-panel__header">
            <h2>EU / Local Digital Twin mapping</h2>
            <p>Current posture by standard family, without counting future federation or authority review as done.</p>
          </div>
          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Domain</th>
                  <th>Standard</th>
                  <th>State</th>
                  <th>Evidence</th>
                  <th>Quality gate</th>
                  <th>Visibility</th>
                  <th>Next</th>
                </tr>
              </thead>
              <tbody>
                {complianceRows.map((row) => (
                  <tr key={row.key}>
                    <td><Badge bg={row.kind === 'Assessment' ? 'secondary' : 'dark'}>{row.kind}</Badge></td>
                    <td><strong>{row.domain}</strong><span>{row.euMapping}</span></td>
                    <td>{row.standard}</td>
                    <td><Badge bg={ldtStateVariant(row.currentState)}>{titleize(row.currentState)}</Badge></td>
                    <td>
                      <span>{row.evidence}</span>
                      {row.endpoint?.startsWith('/') ? (
                        <Link className="ldt-inline-link" href={row.endpoint}>{row.endpoint}</Link>
                      ) : row.endpoint ? (
                        <span>{row.endpoint}</span>
                      ) : null}
                    </td>
                    <td>{row.qualityGate}</td>
                    <td>{row.visibility}</td>
                    <td>{row.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <StandardsWorkspacePanel
          checksByCategory={checksByCategory}
          cityId={activeCityId}
          counts={counts}
          dcatCatalog={state.dcatCatalog}
          openApiDocument={state.openApiDocument}
          standardsRows={standardsRows}
          technicalDefaultOpen
        />
      </>
    )
  }

  return (
    <DigitalTwinSurfaceShell
      badge={state.loading ? 'Loading' : operationsMode ? 'EU readiness' : 'LDT readiness'}
      showSurfaceSidebar={false}
      title={`${activeCity?.name || 'City'} ${operationsMode ? 'LDT Compliance' : 'Standards'}`}
    >
      <div className="ldt-standards-surface">
        {state.error ? <Alert variant="danger">Could not load standards: {state.error}</Alert> : null}
        {state.layerError ? <Alert variant="warning">Layer capability posture unavailable: {state.layerError}</Alert> : null}
        {state.openApiError ? <Alert variant="warning">OpenAPI posture unavailable: {state.openApiError}</Alert> : null}
        {state.dcatError ? <Alert variant="warning">DCAT catalog unavailable: {state.dcatError}</Alert> : null}
        {operationsMode ? (
          <nav className="ldt-ops-switcher" aria-label="Operations sections">
            {operationViewTabs.map((tab) => (
              <Link
                className={tab.key === 'compliance' ? 'is-active' : ''}
                href={tab.href}
                key={tab.key}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        ) : null}
        {state.loading || blockRender ? (
          <div className="ldt-workspace-loading">
            <Spinner animation="border" size="sm" />
            Loading standards posture
          </div>
        ) : null}
        {!state.loading && !blockRender ? (
          operationsMode ? renderComplianceView() : (
            <StandardsWorkspacePanel
              checksByCategory={checksByCategory}
              capabilityLoading={state.capabilityLoading}
              cityId={activeCityId}
              counts={counts}
              dcatCatalog={state.dcatCatalog}
              openApiDocument={state.openApiDocument}
              standardsRows={standardsRows}
            />
          )
        ) : null}
      </div>
    </DigitalTwinSurfaceShell>
  )
}
