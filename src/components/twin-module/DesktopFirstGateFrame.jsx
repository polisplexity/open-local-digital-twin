'use client'

import DesktopFirstGate from './DesktopFirstGate'

const DesktopFirstGateFrame = ({ surfaceName, description }) => (
  <div className="hk-pg-body py-0">
    <div className="invoiceapp-wrap dt-module-wrap">
      <div className="invoiceapp-content">
        <div className="invoiceapp-detail-wrap">
          <DesktopFirstGate surfaceName={surfaceName} description={description} />
        </div>
      </div>
    </div>
  </div>
)

export default DesktopFirstGateFrame
