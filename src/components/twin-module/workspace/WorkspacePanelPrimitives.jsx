import { Badge } from 'react-bootstrap'
import { formatCount, statusVariant, titleize } from './ldtWorkspaceModel'

export function MetricTile({ label, value, detail, tone }) {
  const displayValue = typeof value === 'number' ? formatCount(value) : String(value ?? '0')
  return (
    <article className="ldt-metric-tile">
      <span>{label}</span>
      <strong>{displayValue}</strong>
      {tone ? <small>{tone}</small> : null}
      {detail ? <p>{detail}</p> : null}
    </article>
  )
}

export function ReadinessList({ category, checksByCategory }) {
  const rows = checksByCategory?.[category] ?? []
  if (!rows.length) return null
  return (
    <div className="ldt-status-list">
      {rows.map((check) => (
        <div className="ldt-status-list__item" key={check.key}>
          <Badge bg={statusVariant(check.status)}>{titleize(check.status)}</Badge>
          <div>
            <strong>{check.label}</strong>
            <span>{check.summary}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
