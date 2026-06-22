'use client'

import { useState } from 'react'
import { Button, Card } from 'react-bootstrap'
import HkBadge from '@/components/@hk-badge/@hk-badge'

const defaultState = {
  built: true,
  services: true,
  green: true,
}

const TwinSpatialViewport = () => {
  const [visible, setVisible] = useState(defaultState)

  return (
    <Card className="card-border h-100">
      <Card.Header className="card-header-action">
        <div>
          <h6 className="mb-1">Spatial operations scene</h6>
          <p className="fs-7 mb-0">Custom 3D-style viewer for municipal reading, built from scratch for the module.</p>
        </div>
        <HkBadge bg="info" soft>3D</HkBadge>
      </Card.Header>
      <Card.Body>
        <div className="dt-viewer-toolbar">
          <Button variant={visible.built ? 'primary' : 'outline-light'} size="sm" onClick={() => setVisible((v) => ({ ...v, built: !v.built }))}>Built fabric</Button>
          <Button variant={visible.services ? 'primary' : 'outline-light'} size="sm" onClick={() => setVisible((v) => ({ ...v, services: !v.services }))}>Services</Button>
          <Button variant={visible.green ? 'primary' : 'outline-light'} size="sm" onClick={() => setVisible((v) => ({ ...v, green: !v.green }))}>Green-blue</Button>
        </div>
        <div className="dt-spatial-scene mt-3">
          <svg viewBox="0 0 920 500" role="img" aria-label="Digital twin municipal spatial scene">
            <rect width="920" height="500" className="dt-scene-bg" />
            <polygon className={visible.green ? 'dt-iso-ground' : 'dt-hidden'} points="100,380 360,250 760,280 540,430" />
            <g className={visible.built ? '' : 'dt-hidden'}>
              <polygon className="dt-iso-top" points="260,260 340,220 418,256 338,292" />
              <polygon className="dt-iso-left" points="260,260 260,342 338,378 338,292" />
              <polygon className="dt-iso-right" points="338,292 418,256 418,340 338,378" />
              <polygon className="dt-iso-top" points="430,220 508,180 598,222 520,262" />
              <polygon className="dt-iso-left" points="430,220 430,320 520,362 520,262" />
              <polygon className="dt-iso-right" points="520,262 598,222 598,320 520,362" />
              <polygon className="dt-iso-top" points="604,264 660,236 716,264 660,292" />
              <polygon className="dt-iso-left" points="604,264 604,326 660,352 660,292" />
              <polygon className="dt-iso-right" points="660,292 716,264 716,324 660,352" />
            </g>
            <g className={visible.services ? '' : 'dt-hidden'}>
              <circle className="dt-iso-node civic" cx="410" cy="326" r="12" />
              <circle className="dt-iso-node civic" cx="566" cy="298" r="10" />
              <circle className="dt-iso-node civic" cx="300" cy="328" r="10" />
            </g>
            <g className={visible.green ? '' : 'dt-hidden'}>
              <polygon className="dt-iso-green" points="120,330 216,286 280,306 170,360" />
              <polygon className="dt-iso-green" points="676,290 756,252 800,268 718,310" />
            </g>
          </svg>
          <div className="dt-scene-caption">
            <div>
              <div className="fw-semibold">Municipal reading</div>
              <div className="fs-7">Use this surface to explain built fabric, service anchors, and the next service attachment.</div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <HkBadge bg="primary" soft>Scenario-ready</HkBadge>
              <HkBadge bg="warning" soft>Waste next</HkBadge>
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}

export default TwinSpatialViewport
