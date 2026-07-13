import Link from 'next/link'
import { Alert, Badge } from 'react-bootstrap'
import { formatCount, productLifecycleState, statusVariant, titleize } from '../ldtWorkspaceModel'
import { MetricTile } from '../WorkspacePanelPrimitives'

export default function OperationsApiPanel({
  apiCatalogRows,
  openApiDocument,
  openApiError,
  openApiRows,
}) {
  return (
    <>
          <div className="ldt-module-panel__header">
            <h3>API explorer</h3>
            <p>Canonical city APIs and versioned aliases for the single-city product path.</p>
          </div>
          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table ldt-inventory-table--operations">
              <thead>
                <tr>
                  <th>API</th>
                  <th>Method</th>
                  <th>Contract</th>
                  <th>Access</th>
                  <th>State</th>
                  <th>Use</th>
                </tr>
              </thead>
              <tbody>
                {apiCatalogRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <strong>{row.path}</strong>
                      {row.versionedPath ? <span>v1 alias: {row.versionedPath}</span> : null}
                      <span>{row.purpose}</span>
                    </td>
                    <td><Badge bg="secondary">{row.method}</Badge></td>
                    <td>
                      <strong>{row.standard}</strong>
                      <span>{row.version}</span>
                    </td>
                    <td>{row.access}</td>
                    <td><Badge bg={statusVariant(productLifecycleState(row.state))}>{titleize(productLifecycleState(row.state))}</Badge></td>
                    <td>
                      {row.testHref ? (
                        <Link className="ldt-inline-link" href={row.testHref}>Open</Link>
                      ) : (
                        <span>Controlled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ldt-module-panel__header">
            <h3>OpenAPI 3.1 contract</h3>
            <p>Machine-readable route contract generated from the same operations catalog used by this cockpit module.</p>
          </div>
          {openApiError ? <Alert variant="warning">OpenAPI document is unavailable: {openApiError}</Alert> : null}
          <div className="ldt-source-flow-grid">
            <article>
              <span>Spec</span>
              <strong>{openApiDocument?.openapi || 'Not loaded'}</strong>
              <p>{openApiDocument?.info?.summary || 'OpenAPI contract pending.'}</p>
            </article>
            <article>
              <span>Operations</span>
              <strong>{formatCount(openApiRows.length)}</strong>
              <p>{formatCount(Object.keys(openApiDocument?.paths ?? {}).length)} paths grouped by capability, standards, analysis, and workflow domains.</p>
            </article>
            <article>
              <span>Security</span>
              <strong>Session scoped</strong>
              <p>City and admin routes use the same authenticated session boundary as the cockpit.</p>
            </article>
          </div>
          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table ldt-inventory-table--operations">
              <thead>
                <tr>
                  <th>Operation</th>
                  <th>Method</th>
                  <th>Tag</th>
                  <th>Body</th>
                  <th>Security</th>
                  <th>Responses</th>
                </tr>
              </thead>
              <tbody>
                {openApiRows.length ? openApiRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <strong>{row.path}</strong>
                      {row.aliasFor ? <span>Alias for {row.aliasFor}</span> : null}
                      <span>{row.summary} · {row.operationId}</span>
                    </td>
                    <td><Badge bg="secondary">{row.method}</Badge></td>
                    <td>{row.tag}</td>
                    <td>{row.requestBody}</td>
                    <td>{row.security}</td>
                    <td>{row.response}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6}>No OpenAPI operations loaded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
    </>
  )
}
