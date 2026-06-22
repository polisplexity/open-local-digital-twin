import Link from 'next/link'
import { Badge } from 'react-bootstrap'
import { formatCount, statusVariant, titleize } from '../ldtWorkspaceModel'
import { MetricTile, ReadinessList } from '../WorkspacePanelPrimitives'

export default function StandardsWorkspacePanel({
  checksByCategory,
  counts,
  standardsRows,
}) {
  return (
    <section className="ldt-module-panel">
      <div className="ldt-module-panel__header">
        <h2>Standards publication</h2>
        <p>Machine-readable outputs for Local Digital Twin interoperability and city API handoff.</p>
      </div>
      <div className="ldt-metric-grid">
        <MetricTile label="NGSI-LD projections" value={counts.ngsiProjections} tone="FIWARE-ready" />
        <MetricTile label="OGC collections" value={counts.ogcCollections} tone="Feature access" />
        <MetricTile label="DCAT datasets" value={counts.datasets} tone="Catalog" />
        <MetricTile label="FIWARE sync jobs" value={counts.fiwareSyncJobs} tone="Context broker" />
      </div>
      <div className="ldt-source-flow-grid">
        <article>
          <span>Catalog</span>
          <strong>DCAT JSON-LD</strong>
          <p>External teams can discover city datasets, licenses, distributions, quality signals, and services.</p>
        </article>
        <article>
          <span>Entities</span>
          <strong>NGSI-LD / FIWARE</strong>
          <p>The same inventory can be projected as context entities for brokers and downstream apps.</p>
        </article>
        <article>
          <span>Features</span>
          <strong>OGC + MVT</strong>
          <p>Analysts and viewers consume collections, windows, and tiles without knowing the storage internals.</p>
        </article>
      </div>
      <div className="ldt-action-row">
        <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/standards/dcat">
          DCAT
        </Link>
        <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/standards/ngsi-ld/entities?limit=25">
          NGSI-LD
        </Link>
        <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/standards/ogc">
          OGC landing
        </Link>
        <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/standards/ogc/collections">
          Collections
        </Link>
      </div>
      <div className="ldt-inventory-table-wrap">
        <table className="ldt-inventory-table">
          <thead>
            <tr>
              <th>Standard</th>
              <th>Output</th>
              <th>Count</th>
              <th>Endpoint</th>
              <th>Coverage</th>
              <th>State</th>
              <th>Next</th>
            </tr>
          </thead>
          <tbody>
            {standardsRows.map((row) => (
              <tr key={row.key}>
                <td><strong>{row.name}</strong></td>
                <td>{row.output}</td>
                <td>{formatCount(row.count)}</td>
                <td>
                  {row.endpoint.startsWith('/') && !row.endpoint.includes('{') ? (
                    <Link className="ldt-inline-link" href={row.endpoint}>{row.endpoint}</Link>
                  ) : (
                    <span>{row.endpoint}</span>
                  )}
                </td>
                <td>{row.coverage}</td>
                <td><Badge bg={statusVariant(row.status)}>{titleize(row.status)}</Badge></td>
                <td>{row.next}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ReadinessList category="standards" checksByCategory={checksByCategory} />
    </section>
  )
}
