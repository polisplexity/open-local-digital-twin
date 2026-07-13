'use client'

import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Card, Col, Container, Row, Table } from 'react-bootstrap'
import SimpleBar from 'simplebar-react'
import classNames from 'classnames'
import { Activity, CheckCircle, FileText, XCircle } from 'react-feather'
import TwinModuleHeader from '@/components/twin-module/TwinModuleHeader'
import DesktopFirstGate from '@/components/twin-module/DesktopFirstGate'
import { capabilitiesPageConfig } from '@/data/digital-twin/moduleConfig'
import { usePlatformContext } from '@/context/PlatformContext'

function formatCount(value) {
  const next = Number(value ?? 0)
  if (!Number.isFinite(next)) return '0'
  return new Intl.NumberFormat('en-US').format(next)
}

function titleize(value) {
  return String(value ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatEvidenceValue(value) {
  if (typeof value === 'number') return formatCount(value)
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (value && typeof value === 'object') return `${formatCount(Object.keys(value).length)} entries`
  return String(value ?? '')
}

function statusVariant(status) {
  const value = String(status ?? '').toLowerCase()
  if (value.includes('ready')) return 'success'
  if (value.includes('implemented')) return 'success'
  if (value.includes('partial')) return 'warning'
  if (value.includes('schema')) return 'warning'
  if (value.includes('blocked')) return 'danger'
  if (value.includes('missing')) return 'danger'
  if (value.includes('construction')) return 'dark'
  if (value.includes('lab')) return 'info'
  if (value.includes('documented')) return 'info'
  return 'secondary'
}

function readinessVariant(status) {
  if (status === 'ready') return 'success'
  if (status === 'blocked') return 'danger'
  return 'warning'
}

const CapabilitySidebar = ({ modules, counts }) => {
  const activeModules = Object.values(modules ?? {}).filter(Boolean).length
  const totalModules = Object.keys(modules ?? {}).length

  return (
    <nav className="invoiceapp-sidebar dt-control-sidebar">
      <SimpleBar className="nicescroll-bar">
        <div className="menu-content-wrap">
          <div className="nav-header">
            <span>Capability status</span>
          </div>
          <div className="dt-sidebar-copy">
            <p>
              Use this surface as the product contract before adding more UI,
              workflows, or agent automation.
            </p>
            <p>
              It reads the active city capability API and separates working
              modules from partial or missing product promises.
            </p>
          </div>
          <div className="menu-gap" />
          <div className="dt-status-grid">
            <div className="dt-status-tile">
              <span>Modules ready</span>
              <strong>{activeModules} / {totalModules}</strong>
            </div>
            <div className="dt-status-tile">
              <span>Entities</span>
              <strong>{formatCount(counts?.entities)}</strong>
            </div>
          </div>
          <div className="menu-gap" />
          <div className="nav-header">
            <span>Reference contents</span>
          </div>
          <div className="menu-group">
            <ul className="nav-light navbar-nav flex-column nav">
              {capabilitiesPageConfig.sections.map((section) => (
                <li className="nav-item" key={section.id}>
                  <a className="nav-link" href={`#${section.id}`}>
                    <span className="nav-icon-wrap">
                      <span className="feather-icon">
                        <FileText size={14} />
                      </span>
                    </span>
                    <span className="nav-link-text">{section.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SimpleBar>
    </nav>
  )
}

const CapabilitiesPage = () => {
  const { activeCity } = usePlatformContext()
  const [showSidebar, setShowSidebar] = useState(true)
  const [state, setState] = useState({ loading: true, error: null, payload: null })

  useEffect(() => {
    let ignore = false

    async function loadCapabilities() {
      setState((current) => ({ ...current, loading: true, error: null }))
      try {
        const response = await fetch('/api/live/current/capabilities', { credentials: 'same-origin' })
        const payload = await response.json()
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || `HTTP_${response.status}`)
        }
        if (!ignore) setState({ loading: false, error: null, payload })
      } catch (error) {
        if (!ignore) {
          setState({
            loading: false,
            error: String(error?.message ?? 'CAPABILITIES_UNAVAILABLE'),
            payload: null,
          })
        }
      }
    }

    loadCapabilities()
    return () => {
      ignore = true
    }
  }, [activeCity])

  const payload = state.payload
  const modules = useMemo(() => payload?.modules ?? {}, [payload])
  const counts = useMemo(() => payload?.counts ?? {}, [payload])
  const productCapabilities = useMemo(() => payload?.productCapabilities ?? [], [payload])
  const readinessChecks = useMemo(() => payload?.readinessChecks ?? [], [payload])
  const readinessGaps = useMemo(() => payload?.readinessGaps ?? [], [payload])
  const readinessSummary = useMemo(() => payload?.readinessSummary ?? {}, [payload])
  const moduleRows = useMemo(
    () =>
      Object.entries(modules).map(([key, available]) => ({
        key,
        label: titleize(key),
        available,
      })),
    [modules],
  )
  const gapRows = productCapabilities.filter((capability) => !String(capability.status).toLowerCase().includes('implemented'))

  return (
    <div className="hk-pg-body py-0">
      <DesktopFirstGate
        description="Use a desktop browser to review the product capability contract and city readiness tables."
        surfaceName={capabilitiesPageConfig.title}
      />
      <div className={classNames('invoiceapp-wrap', 'dt-module-wrap', { 'invoiceapp-sidebar-toggle': !showSidebar })}>
        <CapabilitySidebar modules={modules} counts={counts} />
        <div className="invoiceapp-content">
          <div className="invoiceapp-detail-wrap">
            <TwinModuleHeader
              eyebrow={capabilitiesPageConfig.eyebrow}
              onToggleSidebar={() => setShowSidebar((current) => !current)}
              sidebarOpen={showSidebar}
              statusLabel={state.loading ? 'Loading contract' : 'Contract ready'}
              summary={capabilitiesPageConfig.summary}
              title={capabilitiesPageConfig.title}
            />
            <Container fluid="xxl" className="py-4">
              {state.error ? (
                <Alert variant="danger">Could not load the active city capability contract: {state.error}</Alert>
              ) : null}
              {state.loading ? (
                <Alert variant="info">Loading active city capability contract...</Alert>
              ) : null}

              {payload ? (
                <>
                  <Row className="g-3 mb-4">
                    <Col xl={3} md={6}>
                      <Card className="card-border h-100">
                        <Card.Body>
                          <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Readiness</div>
                          <h3 className="mb-2">
                            <Badge bg={readinessVariant(payload.readiness?.status)}>{titleize(payload.readiness?.status)}</Badge>
                          </h3>
                          <p className="mb-0">{formatCount(readinessGaps.length)} gaps need action before Phase 10 can be accepted.</p>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col xl={3} md={6}>
                      <Card className="card-border h-100">
                        <Card.Body>
                          <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Consolidated inventory</div>
                          <h3 className="mb-2">{formatCount(counts.entities)}</h3>
                          <p className="mb-0">{formatCount(counts.sourceFeatures)} source features and {formatCount(counts.datasets)} catalog datasets.</p>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col xl={3} md={6}>
                      <Card className="card-border h-100">
                        <Card.Body>
                          <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Standards outputs</div>
                          <h3 className="mb-2">{formatCount(counts.ngsiProjections)}</h3>
                          <p className="mb-0">{formatCount(counts.ogcCollections)} OGC collections and NGSI-LD projections generated.</p>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col xl={3} md={6}>
                      <Card className="card-border h-100">
                        <Card.Body>
                          <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Product contract</div>
                          <h3 className="mb-2">{formatCount(productCapabilities.length)}</h3>
                          <p className="mb-0">{formatCount(gapRows.length)} capabilities still need UI, API, workflow, or operations work.</p>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  <Card className="card-border mb-4" id="capability-readiness">
                    <Card.Header>
                      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                        <h6 className="mb-0">Phase 10 Readiness Gate</h6>
                        <div className="d-flex flex-wrap gap-2">
                          {Object.entries(readinessSummary).map(([key, value]) => (
                            <Badge bg={statusVariant(key)} key={key}>
                              {titleize(key)} {formatCount(value)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </Card.Header>
                    <Card.Body className="p-0">
                      <Table responsive hover className="mb-0 align-middle">
                        <thead>
                          <tr>
                            <th>Gate</th>
                            <th>Category</th>
                            <th>Status</th>
                            <th>Evidence</th>
                            <th>Next action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {readinessChecks.map((check) => (
                            <tr key={check.key}>
                              <td>
                                <div className="fw-semibold">{check.label}</div>
                                <div className="text-muted">{check.summary}</div>
                              </td>
                              <td>{titleize(check.category)}</td>
                              <td><Badge bg={statusVariant(check.status)}>{titleize(check.status)}</Badge></td>
                              <td>
                                {Object.entries(check.evidence ?? {}).slice(0, 4).map(([key, value]) => (
                                  <div key={`${check.key}-${key}`}>
                                    <span className="text-muted">{titleize(key)}:</span>{' '}
                                    {formatEvidenceValue(value)}
                                  </div>
                                ))}
                              </td>
                              <td>{check.action || 'No immediate action.'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>

                  <Card className="card-border mb-4" id="capability-modules">
                    <Card.Header>
                      <h6 className="mb-0">Active City Modules</h6>
                    </Card.Header>
                    <Card.Body>
                      <Row className="g-2">
                        {moduleRows.map((module) => (
                          <Col xl={3} md={4} sm={6} key={module.key}>
                            <div className="dt-capability-pill">
                              <span className="feather-icon">
                                {module.available ? <CheckCircle size={16} /> : <XCircle size={16} />}
                              </span>
                              <span>{module.label}</span>
                              <Badge bg={module.available ? 'success' : 'secondary'}>{module.available ? 'Ready' : 'Missing'}</Badge>
                            </div>
                          </Col>
                        ))}
                      </Row>
                    </Card.Body>
                  </Card>

                  <Card className="card-border mb-4" id="capability-counts">
                    <Card.Header>
                      <h6 className="mb-0">City Data Counts</h6>
                    </Card.Header>
                    <Card.Body className="p-0">
                      <Table responsive hover className="mb-0 align-middle">
                        <thead>
                          <tr>
                            <th>Measure</th>
                            <th>Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(counts).map(([key, value]) => (
                            <tr key={key}>
                              <td>{titleize(key)}</td>
                              <td>{formatCount(value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>

                  <Card className="card-border mb-4" id="capability-contract">
                    <Card.Header>
                      <h6 className="mb-0">Product Capability Contract</h6>
                    </Card.Header>
                    <Card.Body className="p-0">
                      <Table responsive hover className="mb-0 align-middle">
                        <thead>
                          <tr>
                            <th>Capability</th>
                            <th>Status</th>
                            <th>Standards</th>
                            <th>Database</th>
                            <th>API families</th>
                            <th>Product gap</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productCapabilities.map((capability) => (
                            <tr key={capability.key}>
                              <td>
                                <div className="fw-semibold">{capability.title}</div>
                                <div className="text-muted">{capability.promise}</div>
                              </td>
                              <td><Badge bg={statusVariant(capability.status)}>{capability.status}</Badge></td>
                              <td>{(capability.standards ?? []).join(', ')}</td>
                              <td>{(capability.databaseSchemas ?? []).join(', ')}</td>
                              <td>{(capability.apiFamilies ?? []).join(', ')}</td>
                              <td>{capability.productGap}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>

                  <Card className="card-border" id="capability-gaps">
                    <Card.Header>
                      <h6 className="mb-0">Next Build Gaps</h6>
                    </Card.Header>
                    <Card.Body>
                      <Row className="g-3">
                        {gapRows.map((capability) => (
                          <Col xl={4} md={6} key={`gap-${capability.key}`}>
                            <Card className="card-border h-100">
                              <Card.Body>
                                <div className="d-flex align-items-start gap-2 mb-2">
                                  <span className="feather-icon text-primary"><Activity size={16} /></span>
                                  <div>
                                    <h6 className="mb-1">{capability.title}</h6>
                                    <Badge bg={statusVariant(capability.status)}>{capability.status}</Badge>
                                  </div>
                                </div>
                                <p className="mb-0">{capability.productGap}</p>
                              </Card.Body>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </Card.Body>
                  </Card>
                </>
              ) : null}
            </Container>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CapabilitiesPage
