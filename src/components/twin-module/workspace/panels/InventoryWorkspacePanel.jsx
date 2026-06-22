import { Alert, Badge } from 'react-bootstrap'
import { formatCount, statusVariant, titleize } from '../ldtWorkspaceModel'
import { MetricTile, ReadinessList } from '../WorkspacePanelPrimitives'

export default function InventoryWorkspacePanel({
  checksByCategory,
  counts,
  inventoryRows,
  layerCapabilities,
  layerError,
}) {
  return (
    <section className="ldt-module-panel">
      <div className="ldt-module-panel__header">
        <h2>Consolidated city inventory</h2>
        <p>Entity base, runtime layers, source evidence, standards mapping, and readiness.</p>
      </div>
      <div className="ldt-inventory-summary">
        <MetricTile label="Runtime layers" value={layerCapabilities?.summary?.layerCount ?? 0} tone="Layer registry" />
        <MetricTile label="Queryable vectors" value={layerCapabilities?.summary?.vectorTileLayerCount ?? 0} tone="MVT / window API" />
        <MetricTile label="Entity records" value={counts.entities} tone="Consolidated inventory" />
        <MetricTile label="Source evidence" value={counts.sourceFeatures} tone="Provenance features" />
      </div>
      {layerError ? <Alert variant="warning">Layer capability inventory is unavailable: {layerError}</Alert> : null}
      <div className="ldt-inventory-table-wrap">
        <table className="ldt-inventory-table">
          <thead>
            <tr>
              <th>Layer</th>
              <th>Family</th>
              <th>Count</th>
              <th>Source</th>
              <th>Standard</th>
              <th>State</th>
              <th>Latest</th>
            </tr>
          </thead>
          <tbody>
            {inventoryRows.map((row) => (
              <tr key={row.key}>
                <td>
                  <strong>{row.name}</strong>
                  <span>{row.geometryType} · {row.semantic}</span>
                </td>
                <td>{row.family}</td>
                <td>{formatCount(row.count)}</td>
                <td>
                  <strong>{row.source}</strong>
                  <span>{row.license}</span>
                </td>
                <td>{row.standard}</td>
                <td><Badge bg={statusVariant(row.status)}>{titleize(row.status)}</Badge></td>
                <td>{row.latest}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ReadinessList category="inventory" checksByCategory={checksByCategory} />
    </section>
  )
}
