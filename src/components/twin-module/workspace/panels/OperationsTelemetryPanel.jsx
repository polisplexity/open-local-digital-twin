import { Badge } from 'react-bootstrap'
import { apiStatusTone, formatCount, statusVariant } from '../ldtWorkspaceModel'

export default function OperationsTelemetryPanel({
  apiUsageRows,
  metricsFamilyRows,
  slowRouteRows,
}) {
  return (
    <>
          <div className="ldt-module-panel__header">
            <h3>Metrics by route family</h3>
            <p>Recent traffic grouped by API domain, with error rate and latency from the same event table agents can read.</p>
          </div>
          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table">
              <thead>
                <tr>
                  <th>Family</th>
                  <th>Events</th>
                  <th>Errors</th>
                  <th>Error rate</th>
                  <th>Avg ms</th>
                  <th>P95 ms</th>
                  <th>Latest</th>
                </tr>
              </thead>
              <tbody>
                {metricsFamilyRows.length ? metricsFamilyRows.map((row) => (
                  <tr key={row.key}>
                    <td><strong>{row.family}</strong></td>
                    <td>{formatCount(row.events)}</td>
                    <td>{formatCount(row.errors)}</td>
                    <td>{row.errorRate}%</td>
                    <td>{row.avgLatencyMs === null ? 'n/a' : row.avgLatencyMs}</td>
                    <td>{row.p95LatencyMs === null ? 'n/a' : row.p95LatencyMs}</td>
                    <td>{row.latestEventAt}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7}>No route-family metrics recorded in the current window.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="ldt-module-panel__header">
            <h3>Slow route watch</h3>
            <p>Routes with the highest recent p95 latency before adding any external dashboard stack.</p>
          </div>
          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Method</th>
                  <th>Events</th>
                  <th>Avg ms</th>
                  <th>P95 ms</th>
                  <th>Latest</th>
                </tr>
              </thead>
              <tbody>
                {slowRouteRows.length ? slowRouteRows.map((row) => (
                  <tr key={row.key}>
                    <td><strong>{row.path}</strong></td>
                    <td>{row.method}</td>
                    <td>{formatCount(row.events)}</td>
                    <td>{row.avgLatencyMs === null ? 'n/a' : row.avgLatencyMs}</td>
                    <td>{row.p95LatencyMs === null ? 'n/a' : row.p95LatencyMs}</td>
                    <td>{row.latestEventAt}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6}>No slow-route samples recorded in the current window.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="ldt-module-panel__header">
            <h3>API usage</h3>
            <p>Observed requests by route family, method, status, and latency.</p>
          </div>
          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table">
              <thead>
                <tr>
                  <th>Route family</th>
                  <th>Method</th>
                  <th>Events</th>
                  <th>Errors</th>
                  <th>Status</th>
                  <th>Avg ms</th>
                  <th>Latest</th>
                </tr>
              </thead>
              <tbody>
                {apiUsageRows.length ? apiUsageRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <strong>{row.family}</strong>
                      <span>{row.path}</span>
                    </td>
                    <td>{row.method}</td>
                    <td>{formatCount(row.events)}</td>
                    <td>{formatCount(row.errors)}</td>
                    <td><Badge bg={statusVariant(apiStatusTone(row.lastStatusCode))}>{row.lastStatusCode || 'n/a'}</Badge></td>
                    <td>{row.avgLatencyMs === null ? 'n/a' : row.avgLatencyMs}</td>
                    <td>{row.lastSeenAt}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7}>No API usage events recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
    </>
  )
}
