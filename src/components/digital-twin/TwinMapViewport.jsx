'use client'

import { useState } from 'react'
import { Button, Card } from 'react-bootstrap'
import HkBadge from '@/components/@hk-badge/@hk-badge'

const defaultState = {
  boundary: true,
  roads: true,
  buildings: true,
  civic: true,
  greenBlue: true,
  waste: true,
}

const TwinMapViewport = ({ layers }) => {
  const [visible, setVisible] = useState(defaultState)

  const toggleLayer = (id) => {
    setVisible((current) => ({ ...current, [id]: !current[id] }))
  }

  return (
    <Card className="card-border h-100">
      <Card.Header className="card-header-action">
        <div>
          <h6 className="mb-1">Territorial canvas</h6>
          <p className="fs-7 mb-0">Own viewer component mounted inside Jampack cards and controls.</p>
        </div>
        <HkBadge bg="primary" soft>Map-first</HkBadge>
      </Card.Header>
      <Card.Body>
        <div className="dt-viewer-toolbar">
          {layers.map((layer) => (
            <Button
              key={layer.id}
              variant={visible[layer.id] ? 'primary' : 'outline-light'}
              size="sm"
              onClick={() => toggleLayer(layer.id)}
            >
              {layer.label}
            </Button>
          ))}
        </div>
        <div className="dt-viewer-shell mt-3">
          <div className="dt-map-scene">
            <svg viewBox="0 0 920 520" role="img" aria-label="Digital twin territorial canvas">
              <rect x="0" y="0" width="920" height="520" className="dt-scene-bg" />
              <g className={visible.greenBlue ? '' : 'dt-hidden'}>
                <path className="dt-map-water" d="M38 72 C110 42 162 56 215 92 L180 164 L84 152 Z" />
                <path className="dt-map-park" d="M564 84 L768 110 L842 228 L670 310 L524 186 Z" />
                <path className="dt-map-park" d="M162 318 L290 280 L382 332 L324 436 L154 430 Z" />
              </g>
              <g className={visible.boundary ? '' : 'dt-hidden'}>
                <path className="dt-map-boundary" d="M182 118 L422 82 L710 128 L822 258 L748 410 L468 468 L244 430 L140 248 Z" />
              </g>
              <g className={visible.roads ? '' : 'dt-hidden'}>
                <path className="dt-map-road" d="M210 136 L440 202 L648 182 L748 246" />
                <path className="dt-map-road secondary" d="M236 238 L394 228 L490 350 L622 392" />
                <path className="dt-map-road secondary" d="M340 128 L324 278 L266 398" />
                <path className="dt-map-road secondary" d="M520 112 L496 232 L590 432" />
                <path className="dt-map-road minor" d="M402 138 L530 170 L548 242 L462 286" />
              </g>
              <g className={visible.buildings ? '' : 'dt-hidden'}>
                <rect className="dt-map-building" x="336" y="188" width="52" height="36" />
                <rect className="dt-map-building" x="398" y="204" width="38" height="28" />
                <rect className="dt-map-building" x="442" y="194" width="34" height="24" />
                <rect className="dt-map-building" x="370" y="242" width="58" height="36" />
                <rect className="dt-map-building" x="448" y="254" width="48" height="28" />
                <rect className="dt-map-building" x="520" y="232" width="42" height="30" />
                <rect className="dt-map-building" x="328" y="298" width="60" height="40" />
                <rect className="dt-map-building" x="412" y="312" width="36" height="22" />
                <rect className="dt-map-building" x="470" y="320" width="48" height="24" />
              </g>
              <g className={visible.civic ? '' : 'dt-hidden'}>
                <circle className="dt-map-anchor civic" cx="410" cy="226" r="11" />
                <circle className="dt-map-anchor civic" cx="520" cy="248" r="10" />
                <circle className="dt-map-anchor civic" cx="350" cy="312" r="10" />
              </g>
              <g className={visible.waste ? '' : 'dt-hidden'}>
                <rect className="dt-map-anchor waste" x="470" y="176" width="12" height="12" />
                <rect className="dt-map-anchor waste" x="388" y="280" width="12" height="12" />
                <rect className="dt-map-anchor waste" x="548" y="332" width="12" height="12" />
              </g>
            </svg>
          </div>
          <div className="dt-viewer-legend">
            {layers.map((layer) => (
              <div key={layer.id} className="dt-layer-item">
                <div className="d-flex align-items-center justify-content-between gap-3">
                  <div>
                    <div className="fw-semibold">{layer.label}</div>
                    <div className="fs-8">{layer.note}</div>
                  </div>
                  <HkBadge bg={layer.theme} soft>{layer.count}</HkBadge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}

export default TwinMapViewport
