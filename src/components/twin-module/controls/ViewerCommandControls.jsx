'use client'

import { Button } from 'react-bootstrap'
import { Camera, Download, Map, Navigation, Sliders, Target } from 'react-feather'

function commandIcon(viewerId, command) {
  if (viewerId === '3d') return <Camera size={14} />
  if (viewerId === 'immersive') return <Navigation size={14} />
  if (command?.value === 'scope') return <Target size={14} />
  return <Map size={14} />
}

export default function ViewerCommandControls({
  commands = [],
  downloadLabel,
  onCommand,
  onDownload,
  title = 'View controls',
  viewerId = 'map',
}) {
  if (!commands.length && !onDownload) return null

  return (
    <section className="dt-control-section">
      <div className="dt-control-section__header">
        <Sliders size={15} />
        <span>{title}</span>
      </div>
      <div className="dt-sidebar-chip-grid">
        {onDownload ? (
          <Button
            className="dt-sidebar-button"
            onClick={onDownload}
            variant="outline-primary"
          >
            <Download size={14} />
            <span>{downloadLabel || 'Download snapshot'}</span>
          </Button>
        ) : null}
        {commands.map((command) => (
          <Button
            className="dt-sidebar-button"
            key={command.id}
            onClick={() => onCommand?.(command)}
            variant={command.emphasis ? 'primary' : 'outline-secondary'}
          >
            {commandIcon(viewerId, command)}
            <span>{command.label}</span>
          </Button>
        ))}
      </div>
    </section>
  )
}
