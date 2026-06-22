'use client'

import { isValidElement, useState } from 'react'
import classNames from 'classnames'
import { Card, Col, Container, Nav, Row, Table } from 'react-bootstrap'
import SimpleBar from 'simplebar-react'
import { FileText } from 'react-feather'
import TwinModuleHeader from './TwinModuleHeader'
import DesktopFirstGate from './DesktopFirstGate'

const renderCopy = (value) => {
  if (isValidElement(value)) return value
  if (Array.isArray(value)) return value.map((item, index) => <p key={index}>{item}</p>)
  return <p>{value}</p>
}

const TwinInfoSidebar = ({ title, body, sections = [] }) => (
  <nav className="invoiceapp-sidebar dt-control-sidebar">
    <SimpleBar className="nicescroll-bar">
      <div className="menu-content-wrap">
        <div className="nav-header">
          <span>{title}</span>
        </div>
        <div className="dt-sidebar-copy">
          {renderCopy(body)}
        </div>
        <div className="menu-gap" />
        <div className="nav-header">
          <span>Reference contents</span>
        </div>
        <div className="menu-group">
          <Nav as="ul" className="nav-light navbar-nav flex-column">
            {sections.map((section) => (
              <Nav.Item as="li" key={section.id}>
                <Nav.Link href={`#${section.id}`}>
                  <span className="nav-icon-wrap">
                    <span className="feather-icon">
                      <FileText size={14} />
                    </span>
                  </span>
                  <span className="nav-link-text">{section.label}</span>
                </Nav.Link>
              </Nav.Item>
            ))}
          </Nav>
        </div>
      </div>
    </SimpleBar>
  </nav>
)

const TwinInfoPage = ({ config, cards = [], stats = [], table, tables = [], sidebarBody }) => {
  const [showSidebar, setShowSidebar] = useState(true)
  const tableList = [...tables, ...(table ? [table] : [])]

  return (
    <div className="hk-pg-body py-0">
      <DesktopFirstGate
        description="Use a desktop browser to read the theory, documentation, and tables in the intended institutional layout."
        surfaceName={config.title}
      />
      <div className={classNames('invoiceapp-wrap', 'dt-module-wrap', { 'invoiceapp-sidebar-toggle': !showSidebar })}>
        <TwinInfoSidebar body={sidebarBody} sections={config.sections} title={config.title} />
        <div className="invoiceapp-content">
          <div className="invoiceapp-detail-wrap">
            <TwinModuleHeader
              eyebrow={config.eyebrow}
              onToggleSidebar={() => setShowSidebar((current) => !current)}
              sidebarOpen={showSidebar}
              statusLabel="Reference surface"
              summary={config.summary}
              title={config.title}
            />
            <Container fluid="xxl" className="py-4">
              {stats.length ? (
                <Row className="g-3 mb-4">
                  {stats.map((stat) => (
                    <Col key={stat.label} xl={stat.col ?? 3} md={6}>
                      <Card className="card-border h-100">
                        <Card.Body>
                          <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">{stat.label}</div>
                          <h3 className="mb-2">{stat.value}</h3>
                          <p className="mb-0">{stat.note}</p>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              ) : null}

              <Row className="g-3 mb-4">
                {cards.map((card) => (
                  <Col key={card.title} xl={card.col ?? 6}>
                    <Card className="card-border h-100" id={card.id}>
                      <Card.Header>
                        <h6 className="mb-0">{card.title}</h6>
                      </Card.Header>
                      <Card.Body className="dt-bullet-stack">
                        {Array.isArray(card.items)
                          ? card.items.map((item, index) => <div className="dt-bullet" key={`${card.id}-${index}`}>{item}</div>)
                          : isValidElement(card.body)
                            ? card.body
                            : <p className="mb-0">{card.body}</p>}
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>

              {tableList.length
                ? (
                  <Row className="g-3">
                    {tableList.map((currentTable) => (
                      <Col xl={currentTable.col ?? 12} key={currentTable.id}>
                        <Card className="card-border" id={currentTable.id}>
                          <Card.Header>
                            <h6 className="mb-0">{currentTable.title}</h6>
                          </Card.Header>
                          <Card.Body className="p-0">
                            <Table className="mb-0 align-middle" responsive hover>
                              <thead>
                                <tr>
                                  {currentTable.columns.map((column) => <th key={column}>{column}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {currentTable.rows.map((row) => (
                                  <tr key={row.id}>
                                    {currentTable.columns.map((column) => (
                                      <td key={`${row.id}-${column}`}>{row[column]}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )
                : null}
            </Container>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TwinInfoPage
