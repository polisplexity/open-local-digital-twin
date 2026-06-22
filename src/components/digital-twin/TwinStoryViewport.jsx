'use client'

import { useState } from 'react'
import { Button, Card } from 'react-bootstrap'
import HkBadge from '@/components/@hk-badge/@hk-badge'

const TwinStoryViewport = ({ stops }) => {
  const [mode, setMode] = useState('walk')
  const [activeStop, setActiveStop] = useState(stops[0]?.id ?? null)

  const currentStop = stops.find((item) => item.id === activeStop) ?? stops[0]

  return (
    <Card className="card-border h-100">
      <Card.Header className="card-header-action">
        <div>
          <h6 className="mb-1">Participatory walkthrough</h6>
          <p className="fs-7 mb-0">Public explanation surface with guided stops and a lighter narrative for non-specialists.</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant={mode === 'walk' ? 'primary' : 'outline-light'} size="sm" onClick={() => setMode('walk')}>Walk mode</Button>
          <Button variant={mode === 'fly' ? 'primary' : 'outline-light'} size="sm" onClick={() => setMode('fly')}>Fly mode</Button>
        </div>
      </Card.Header>
      <Card.Body>
        <div className="dt-story-scene">
          <div className="dt-story-skyline">
            <div className="dt-story-grid" />
            <div className={mode === 'fly' ? 'dt-skyline-glow dt-skyline-glow-active' : 'dt-skyline-glow'} />
            <div className="dt-story-block block-a" />
            <div className="dt-story-block block-b" />
            <div className="dt-story-block block-c" />
            <div className="dt-story-block block-d" />
          </div>
          <div className="dt-story-panel">
            <HkBadge bg="primary" soft>{mode === 'walk' ? 'Street-level narrative' : 'Aerial orientation'}</HkBadge>
            <h5 className="mt-3 mb-2">{currentStop.label}</h5>
            <p className="mb-3">{currentStop.summary}</p>
            <div className="dt-viewer-toolbar">
              {stops.map((stop) => (
                <Button
                  key={stop.id}
                  variant={stop.id === activeStop ? 'primary' : 'outline-light'}
                  size="sm"
                  onClick={() => setActiveStop(stop.id)}
                >
                  {stop.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}

export default TwinStoryViewport
