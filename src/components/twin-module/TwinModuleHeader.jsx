'use client'

import classNames from 'classnames'
import { Button, Badge } from 'react-bootstrap'
import { ChevronLeft, ChevronRight, RefreshCw } from 'react-feather'

const TwinModuleHeader = ({
  title,
  eyebrow,
  summary,
  sidebarOpen,
  onToggleSidebar,
  onRefresh,
  statusLabel,
}) => {
  return (
    <header className="invoice-header dt-module-header">
      <div className="d-flex align-items-start gap-3 dt-module-header__lead">
        <div
          className={classNames('hk-sidebar-togglable', { active: !sidebarOpen })}
          onClick={onToggleSidebar}
          role="button"
          tabIndex={0}
        >
          <span className="feather-icon">
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </span>
        </div>
        <div className="invoiceapp-title dt-module-header__copy">
          {eyebrow ? <div className="dt-module-header__eyebrow">{eyebrow}</div> : null}
          <h1>{title}</h1>
          {summary ? <p>{summary}</p> : null}
        </div>
      </div>
      <div className="invoice-options-wrap dt-module-header__actions">
        {statusLabel ? <Badge bg="primary" className="rounded-pill px-3 py-2">{statusLabel}</Badge> : null}
        {onRefresh ? (
          <Button variant="outline-light" className="btn-icon btn-rounded" onClick={onRefresh}>
            <span className="feather-icon">
              <RefreshCw size={16} />
            </span>
          </Button>
        ) : null}
      </div>
    </header>
  )
}

export default TwinModuleHeader
