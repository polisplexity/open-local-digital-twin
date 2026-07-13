import Link from 'next/link'
import { compactList, formatCount, titleize } from '../ldtWorkspaceModel'
import { MetricTile } from '../WorkspacePanelPrimitives'

export default function OperationsOverviewPanel({
  apiMetrics,
  counts,
  ingestionMetrics,
  metricsSummary,
  operationsReadiness,
  workflowMetrics,
}) {
  return (
    <>
          <div className="ldt-module-panel__header">
            <h3>Open-source observability core</h3>
            <p>App-native JSON metrics from `ldt_ops` and PostGIS. Prometheus and Grafana stay optional for operators who want them later.</p>
          </div>
          <div className="ldt-metric-grid">
            <MetricTile label="24h API events" value={apiMetrics.totalEvents ?? 0} tone={`${apiMetrics.errorRate ?? 0}% errors`} />
            <MetricTile label="P95 latency" value={apiMetrics.p95LatencyMs === null || apiMetrics.p95LatencyMs === undefined ? 'n/a' : `${apiMetrics.p95LatencyMs} ms`} tone={`${apiMetrics.avgLatencyMs ?? 0} ms avg`} />
            <MetricTile label="Active ingestion" value={ingestionMetrics.activeJobs ?? 0} tone={`${ingestionMetrics.failedJobs ?? 0} failed`} />
            <MetricTile label="Workflow control" value={workflowMetrics.activeRuns ?? 0} tone={`${workflowMetrics.pendingApprovals ?? 0} approvals`} />
          </div>
          <div className="ldt-source-flow-grid">
            <article>
              <span>Core runtime</span>
              <strong>{titleize(metricsSummary?.posture?.mode || 'core-json-observability')}</strong>
              <p>{compactList(metricsSummary?.posture?.requiredServices, 'application, postgis')}</p>
            </article>
            <article>
              <span>Optional ops pack</span>
              <strong>{compactList(metricsSummary?.posture?.optionalPacks, 'prometheus, grafana')}</strong>
              <p>Install only when a city/operator needs dashboard-grade infrastructure.</p>
            </article>
            <article>
              <span>Inventory signal</span>
              <strong>{formatCount(metricsSummary?.inventory?.cityEntities ?? counts.cityEntities)}</strong>
              <p>{formatCount(metricsSummary?.inventory?.sourceFeatures ?? 0)} source features and {formatCount(metricsSummary?.inventory?.catalogDatasets ?? 0)} catalog datasets.</p>
            </article>
          </div>

          <div className="ldt-source-flow-grid">
            {operationsReadiness.map((item) => (
              <article key={item.key}>
                <span>{item.label}</span>
                <strong>{titleize(item.status)}</strong>
                <p>{item.evidence}</p>
              </article>
            ))}
          </div>

          <div className="ldt-action-row">
            <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/operations/report">Operations report JSON</Link>
            <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/operations/metrics-summary">Metrics summary JSON</Link>
            <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/openapi.json">OpenAPI 3.1 JSON</Link>
            <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/standards/ogc/collections">OGC collections</Link>
            <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/standards/dcat">DCAT catalog</Link>
          </div>
    </>
  )
}
