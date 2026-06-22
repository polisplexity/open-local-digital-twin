import Link from 'next/link'
import { Badge } from 'react-bootstrap'
import { formatCount, statusVariant, titleize } from '../ldtWorkspaceModel'
import { MetricTile, ReadinessList } from '../WorkspacePanelPrimitives'

export default function SourcesWorkspacePanel({
  checksByCategory,
  counts,
  sourceItems,
  sourceRows,
}) {
  return (
    <section className="ldt-module-panel">
      <div className="ldt-module-panel__header">
        <h2>Sources and evidence</h2>
        <p>Open datasets, provenance, licenses, evidence volume, and the inventory families they feed.</p>
      </div>
      <div className="ldt-metric-grid">
        <MetricTile label="Datasets" value={counts.datasets} tone="DCAT catalog" />
        <MetricTile label="Source features" value={counts.sourceFeatures} tone="Provenance store" />
        <MetricTile label="Source layers" value={sourceItems.length} tone="Open-data inputs" />
        <MetricTile label="Provider layers" value={counts.providerLayers} tone="Extension point" />
      </div>
      <div className="ldt-source-flow-grid">
        <article>
          <span>Catalog</span>
          <strong>DCAT datasets</strong>
          <p>City-scoped source descriptions, licenses, distributions, quality reports, and spatial extents.</p>
        </article>
        <article>
          <span>Evidence</span>
          <strong>PROV source features</strong>
          <p>Normalized source geometries and properties retained before consolidation into city entities.</p>
        </article>
        <article>
          <span>Inventory</span>
          <strong>Consolidated entities</strong>
          <p>Buildings, roads, places, facilities, and land systems become one city inventory with traceable evidence.</p>
        </article>
      </div>
      <div className="ldt-action-row">
        <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/standards/dcat">
          DCAT catalog
        </Link>
        <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/layer-capabilities">
          Layer capabilities
        </Link>
        <Link className="btn btn-outline-secondary btn-sm" href="/docs">
          Provider contract
        </Link>
      </div>
      <div className="ldt-inventory-table-wrap">
        <table className="ldt-inventory-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Role</th>
              <th>Evidence</th>
              <th>Feeds</th>
              <th>License</th>
              <th>Standard</th>
              <th>State</th>
              <th>Latest</th>
            </tr>
          </thead>
          <tbody>
            {sourceRows.map((row) => (
              <tr key={row.key}>
                <td><strong>{row.name}</strong></td>
                <td>{row.role}</td>
                <td>{formatCount(row.evidenceCount)}</td>
                <td>{row.feeds}</td>
                <td>{row.license}</td>
                <td>{row.standard}</td>
                <td><Badge bg={statusVariant(row.status)}>{titleize(row.status)}</Badge></td>
                <td>{row.latest}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ReadinessList category="sources" checksByCategory={checksByCategory} />
    </section>
  )
}
