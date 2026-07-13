'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Alert, Badge, Button, Spinner } from 'react-bootstrap'
import { Activity, AlertTriangle, CheckCircle, Database, Layers, RefreshCw, Server, Zap } from 'react-feather'
import DigitalTwinSurfaceShell from '@/components/twin-module/shell/DigitalTwinSurfaceShell'
import { usePlatformContext } from '@/context/PlatformContext'
import {
  formatCount,
  formatDate,
  productLifecycleState,
  statusVariant,
  titleize,
} from './workspace/ldtWorkspaceModel'

const initialState = {
  loading: true,
  error: '',
  capabilities: null,
  operations: null,
}

async function readJson(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || body?.detail || `HTTP_${response.status}`)
  }
  return body
}

function countReadyModules(modules = {}) {
  return Object.values(modules).filter(Boolean).length
}

function latestRuns(operations) {
  return (operations?.workflowRuns ?? [])
    .slice()
    .sort((left, right) => Date.parse(right.updatedAt || right.createdAt || 0) - Date.parse(left.updatedAt || left.createdAt || 0))
    .slice(0, 4)
}

function readinessTone(status) {
  const value = String(status ?? '').toLowerCase()
  if (value === 'ready') return CheckCircle
  if (value === 'blocked') return AlertTriangle
  return Activity
}

export default function CockpitExecutivePage() {
  const { activeCity, activeCityId } = usePlatformContext()
  const [state, setState] = useState(initialState)

  async function loadCockpit() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const [capabilities, operations] = await Promise.all([
        fetch('/api/live/current/capabilities', { credentials: 'same-origin' }).then(readJson),
        fetch('/api/live/current/operations/report', { credentials: 'same-origin' }).then(readJson),
      ])
      setState({ loading: false, error: '', capabilities, operations })
    } catch (error) {
      setState({
        loading: false,
        error: String(error?.message ?? 'COCKPIT_UNAVAILABLE'),
        capabilities: null,
        operations: null,
      })
    }
  }

  useEffect(() => {
    loadCockpit()
  }, [activeCityId])

  const payload = state.capabilities
  const operations = state.operations
  const counts = useMemo(() => payload?.counts ?? {}, [payload])
  const readiness = payload?.readiness ?? {}
  const readinessSummary = useMemo(() => payload?.readinessSummary ?? {}, [payload])
  const readinessGaps = payload?.readinessGaps ?? []
  const workflows = latestRuns(operations)
  const modulesReady = countReadyModules(payload?.modules)
  const modulesTotal = Object.keys(payload?.modules ?? {}).length
  const ReadinessIcon = readinessTone(readiness.status)

  const executiveTiles = useMemo(() => [
    {
      label: 'City inventory',
      value: counts.entities,
      tone: `${formatCount(payload?.entityCounts?.building)} buildings / ${formatCount(payload?.entityCounts?.road)} roads`,
      icon: Database,
    },
    {
      label: 'Source evidence',
      value: counts.sourceFeatures,
      tone: `${formatCount(counts.datasets)} catalog datasets`,
      icon: Layers,
    },
    {
      label: 'Interop outputs',
      value: counts.ngsiProjections,
      tone: `${formatCount(counts.ogcCollections)} OGC collections`,
      icon: Server,
    },
    {
      label: 'Open gaps',
      value: readinessGaps.length,
      tone: `${formatCount(readinessSummary.blocked)} blocked / ${formatCount(readinessSummary.partial)} partial`,
      icon: AlertTriangle,
    },
  ], [counts, payload?.entityCounts, readinessGaps.length, readinessSummary])

  return (
    <DigitalTwinSurfaceShell
      badge={state.loading ? 'Loading' : 'Live'}
      showSurfaceSidebar={false}
      title={`${activeCity?.name || 'City'} Cockpit`}
    >
      <div className="ldt-executive-cockpit">
        <section className="ldt-executive-hero">
          <div>
            <span className="ldt-executive-hero__eyebrow">Local Digital Twin cockpit</span>
            <h1>{activeCity?.name || 'Current city'} operational summary</h1>
            <p>
              Executive view of the active city twin: readiness, evidence, open gaps,
              recent workflow state, and direct entry points into the technical workspaces.
            </p>
          </div>
          <div className="ldt-executive-hero__status">
            <Badge bg={statusVariant(readiness.status)}>{titleize(readiness.status || 'loading')}</Badge>
            <Button variant="outline-primary" size="sm" onClick={loadCockpit}>
              <RefreshCw size={14} />
              Refresh
            </Button>
          </div>
        </section>

        {state.error ? (
          <Alert variant="danger">Could not load the cockpit summary: {state.error}</Alert>
        ) : null}

        {state.loading ? (
          <div className="ldt-workspace-loading">
            <Spinner animation="border" size="sm" />
            Loading city cockpit
          </div>
        ) : null}

        {payload ? (
          <>
            <section className="ldt-executive-status">
              <article className="ldt-executive-status__primary">
                <ReadinessIcon size={24} />
                <div>
                  <span>Readiness gate</span>
                  <strong>{titleize(readiness.status || 'unknown')}</strong>
                  <p>{readiness.summary || 'Capability contract loaded for the active city.'}</p>
                </div>
              </article>
              <article>
                <span>Active modules</span>
                <strong>{formatCount(modulesReady)} / {formatCount(modulesTotal)}</strong>
                <p>Detailed modules now live in the technical workspace instead of the cockpit summary.</p>
              </article>
              <article>
                <span>Workflow queue</span>
                <strong>{formatCount(operations?.counts?.pendingApprovals ?? counts.pendingWorkflowApprovals)}</strong>
                <p>Pending approvals before city data changes are treated as controlled operations.</p>
              </article>
            </section>

            <section className="ldt-executive-metrics" aria-label="Executive city twin metrics">
              {executiveTiles.map(({ label, value, tone, icon: Icon }) => (
                <article className="ldt-executive-metric" key={label}>
                  <Icon size={18} />
                  <span>{label}</span>
                  <strong>{formatCount(value)}</strong>
                  <p>{tone}</p>
                </article>
              ))}
            </section>

            <section className="ldt-executive-grid">
              <article className="ldt-executive-panel">
                <div className="ldt-executive-panel__head">
                  <h2>Highest-priority gaps</h2>
                  <Link href="/workspace">Open workspace</Link>
                </div>
                <div className="ldt-executive-gap-list">
                  {readinessGaps.slice(0, 6).map((gap) => (
                    <div key={gap.key || gap.label}>
                      <Badge bg={statusVariant(gap.status)}>{titleize(gap.status)}</Badge>
                      <strong>{gap.label}</strong>
                      <span>{gap.summary}</span>
                    </div>
                  ))}
                  {!readinessGaps.length ? (
                    <div>
                      <Badge bg="success">Ready</Badge>
                      <strong>No open gaps reported</strong>
                      <span>The current capability contract has no blocking gaps.</span>
                    </div>
                  ) : null}
                </div>
              </article>

              <article className="ldt-executive-panel">
                <div className="ldt-executive-panel__head">
                  <h2>Recent controlled runs</h2>
                  <Link href="/operations/workflows">Operations</Link>
                </div>
                <div className="ldt-executive-run-list">
                  {workflows.map((run) => (
                    <div key={run.id}>
                      <Badge bg={statusVariant(productLifecycleState(run.status))}>
                        {titleize(productLifecycleState(run.status))}
                      </Badge>
                      <div>
                        <strong>{run.workflowName || run.workflowKey || 'Workflow'}</strong>
                        <span>{formatDate(run.updatedAt || run.createdAt)} - {run.id}</span>
                      </div>
                    </div>
                  ))}
                  {!workflows.length ? (
                    <div>
                      <Badge bg="secondary">Idle</Badge>
                      <div>
                        <strong>No recent workflow runs</strong>
                        <span>Controlled jobs will appear here after execution.</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            </section>

            <section className="ldt-executive-entrypoints">
              <Link href="/analytical-map">
                <Database size={17} />
                <span>Analytical Map</span>
              </Link>
              <Link href="/city-3d">
                <Layers size={17} />
                <span>City 3D</span>
              </Link>
              <Link href="/civic-xr">
                <Zap size={17} />
                <span>Civic XR</span>
              </Link>
              <Link href="/workspace">
                <Activity size={17} />
                <span>Technical Workspace</span>
              </Link>
              <Link href="/operations">
                <Server size={17} />
                <span>Operations</span>
              </Link>
            </section>
          </>
        ) : null}
      </div>
    </DigitalTwinSurfaceShell>
  )
}
