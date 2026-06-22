import Link from 'next/link'
import { Alert, Badge } from 'react-bootstrap'
import { formatCount, qualityStatus, statusVariant, titleize } from '../ldtWorkspaceModel'
import { MetricTile, ReadinessList } from '../WorkspacePanelPrimitives'

export default function AnalysisWorkspacePanel({
  analysisModelRows,
  analysisRows,
  checksByCategory,
  counts,
  scienceError,
  scienceReport,
  societyError,
  societyReport,
}) {
  return (
    <section className="ldt-module-panel">
      <div className="ldt-module-panel__header">
        <h2>Science, society, and culture</h2>
        <p>Reproducible indicators from `ldt_science`, aggregate civic signals from `ldt_society`, and viewer aggregates for city-scale reading.</p>
      </div>
      <div className="ldt-metric-grid">
        <MetricTile label="Science observations" value={counts.scienceObservations} tone="Urban models" />
        <MetricTile label="Society observations" value={counts.societyObservations} tone="Aggregate signals" />
        <MetricTile label="Density cells" value={counts.densityCells} tone="Viewer aggregates" />
        <MetricTile label="Viewer summaries" value={counts.viewerSummaries} tone="Cached indicators" />
      </div>
      {scienceError ? <Alert variant="warning">Urban science report is unavailable: {scienceError}</Alert> : null}
      {societyError ? <Alert variant="warning">Society/culture report is unavailable: {societyError}</Alert> : null}
      <div className="ldt-source-flow-grid">
        <article>
          <span>Urban science</span>
          <strong>{scienceReport?.standardKey || 'urban-science-core'}</strong>
          <p>Descriptive city indicators, road-network proxies, scaling definitions, and scenario contracts.</p>
        </article>
        <article>
          <span>Society</span>
          <strong>{societyReport?.standardKey || 'society-culture-core'}</strong>
          <p>Public-open social, economic, civic, cultural, and readiness observations without personal microdata.</p>
        </article>
        <article>
          <span>Analyst view</span>
          <strong>Quality first</strong>
          <p>Indicators expose source quality and caveats so city teams can decide what needs validation next.</p>
        </article>
      </div>
      <div className="ldt-action-row">
        <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/science/urban-report">
          Urban science report
        </Link>
        <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/society/report">
          Society report
        </Link>
        <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/density-grid">
          Density grid
        </Link>
        <Link className="btn btn-outline-secondary btn-sm" href="/docs">
          Analyst standard docs
        </Link>
      </div>
      <div className="ldt-inventory-table-wrap">
        <table className="ldt-inventory-table">
          <thead>
            <tr>
              <th>Analytical standard</th>
              <th>Purpose</th>
              <th>Count</th>
              <th>Endpoint</th>
              <th>State</th>
              <th>Caveat</th>
            </tr>
          </thead>
          <tbody>
            {analysisModelRows.map((row) => (
              <tr key={row.key}>
                <td>
                  <strong>{row.name}</strong>
                  <span>{row.standard}</span>
                </td>
                <td>{row.purpose}</td>
                <td>{formatCount(row.count)}</td>
                <td><Link className="ldt-inline-link" href={row.endpoint}>{row.endpoint}</Link></td>
                <td><Badge bg={statusVariant(row.status)}>{titleize(row.status)}</Badge></td>
                <td>{row.caveat}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ldt-inventory-table-wrap">
        <table className="ldt-inventory-table">
          <thead>
            <tr>
              <th>Indicator</th>
              <th>Domain</th>
              <th>Value</th>
              <th>Quality</th>
              <th>Source quality</th>
              <th>Method</th>
              <th>Standard</th>
            </tr>
          </thead>
          <tbody>
            {analysisRows.map((row) => (
              <tr key={row.key}>
                <td>
                  <strong>{row.name}</strong>
                  <span>{row.family}</span>
                </td>
                <td>{row.domain}</td>
                <td>{row.value}</td>
                <td><Badge bg={statusVariant(qualityStatus(row.quality))}>{titleize(row.quality)}</Badge></td>
                <td>{titleize(row.sourceQuality)}</td>
                <td>{row.method}</td>
                <td>{row.standard}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ReadinessList category="analysis" checksByCategory={checksByCategory} />
    </section>
  )
}
