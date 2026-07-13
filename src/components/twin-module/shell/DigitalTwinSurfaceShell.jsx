'use client'

import { useState } from 'react'
import classNames from 'classnames'
import SimpleBar from 'simplebar-react'
import DigitalTwinAppSidebar from './DigitalTwinAppSidebar'
import DigitalTwinAppHeader from './DigitalTwinAppHeader'

const DigitalTwinSurfaceShell = ({
  title,
  badge,
  sections = [],
  controlSidebar = null,
  showSurfaceSidebar = true,
  children,
}) => {
  const [showSidebar, setShowSidebar] = useState(true)
  const hasSurfaceSidebar = Boolean(showSurfaceSidebar)

  return (
    <div className="hk-pg-body py-0">
      <div
        className={classNames('invoiceapp-wrap', 'dt-module-wrap', {
          'invoiceapp-sidebar-toggle': hasSurfaceSidebar && !showSidebar,
          'dt-module-wrap--no-surface-sidebar': !hasSurfaceSidebar,
        })}
      >
        {hasSurfaceSidebar ? (
          <DigitalTwinAppSidebar controlSidebar={controlSidebar} sections={sections} />
        ) : null}
        <div className="invoiceapp-content">
          <div className="invoiceapp-detail-wrap">
            <DigitalTwinAppHeader
              title={title}
              badge={badge}
              toggleSidebar={() => setShowSidebar((current) => !current)}
              show={showSidebar}
              canToggleSidebar={hasSurfaceSidebar}
            />
            <div className="invoice-body">
              <SimpleBar className="nicescroll-bar">
                <div className="container-fluid py-4 px-3 px-md-4 px-xxl-5">
                  {children}
                </div>
              </SimpleBar>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DigitalTwinSurfaceShell
