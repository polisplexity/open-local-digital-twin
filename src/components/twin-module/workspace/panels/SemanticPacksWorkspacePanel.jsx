import Link from 'next/link'
import { Alert, Badge } from 'react-bootstrap'
import {
  formatCount,
  qualityStatus,
  semanticBindingSummary,
  statusVariant,
  titleize,
} from '../ldtWorkspaceModel'
import { MetricTile, ReadinessList } from '../WorkspacePanelPrimitives'

export default function SemanticPacksWorkspacePanel({
  checksByCategory,
  counts,
  semanticError,
  semanticFeatureRows,
  semanticReport,
  semanticRows,
  semanticRuleRows,
  semanticWorkflowRows,
}) {
  return (
    <section className="ldt-module-panel">
      <div className="ldt-module-panel__header">
        <h2>Semantic packs</h2>
        <p>Domain logic that attaches to the base twin as explicit rules, indicators, service features, and city-review workflows.</p>
      </div>
      <div className="ldt-metric-grid">
        <MetricTile label="City pack bindings" value={counts.semanticPacks} tone="Registered packs" />
        <MetricTile label="Service indicators" value={counts.semanticIndicators} tone="Semantic outputs" />
        <MetricTile label="Workflow definitions" value={counts.workflowDefinitions} tone="Pack operations" />
        <MetricTile label="Workflow runs" value={counts.workflowRuns} tone="Execution history" />
      </div>
      {semanticError ? <Alert variant="warning">Semantic-pack report is unavailable: {semanticError}</Alert> : null}
      <div className="ldt-source-flow-grid">
        <article>
          <span>Pack</span>
          <strong>{semanticReport?.pack?.name || 'Reconstruction service core'}</strong>
          <p>{semanticReport?.pack?.description || 'Reference semantic pack for reconstruction readiness and critical service continuity.'}</p>
        </article>
        <article>
          <span>Binding</span>
          <strong>{titleize(semanticReport?.binding?.status || 'not loaded')}</strong>
          <p>{semanticBindingSummary(semanticReport?.binding?.qualitySummary)}</p>
        </article>
        <article>
          <span>Authority line</span>
          <strong>{titleize(semanticReport?.pack?.authorityStatus || 'draft')}</strong>
          <p>Damage, population demand, priority, and budget claims stay blocked until official sources arrive.</p>
        </article>
      </div>
      <div className="ldt-action-row">
        <Link className="btn btn-outline-secondary btn-sm" href="/api/live/current/semantic-packs/reconstruction-service-core/report">
          Semantic pack report
        </Link>
        <Link className="btn btn-outline-secondary btn-sm" href="/docs">
          Pack standard docs
        </Link>
      </div>
      <div className="ldt-inventory-table-wrap">
        <table className="ldt-inventory-table">
          <thead>
            <tr>
              <th>Indicator</th>
              <th>Value</th>
              <th>Quality</th>
              <th>Method</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {semanticRows.map((row) => (
              <tr key={row.key}>
                <td><strong>{row.name}</strong></td>
                <td>{row.value}</td>
                <td><Badge bg={statusVariant(qualityStatus(row.quality))}>{titleize(row.quality)}</Badge></td>
                <td>{row.method}</td>
                <td>{row.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ldt-inventory-table-wrap">
        <table className="ldt-inventory-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Type</th>
              <th>Inputs</th>
              <th>Output</th>
              <th>Source quality</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {semanticRuleRows.map((row) => (
              <tr key={row.key}>
                <td><strong>{row.key}</strong></td>
                <td>{row.type}</td>
                <td>{row.inputs}</td>
                <td>{row.output}</td>
                <td>{row.quality}</td>
                <td>{row.confidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ldt-inventory-table-wrap">
        <table className="ldt-inventory-table">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Actions</th>
              <th>Inputs</th>
              <th>Outputs</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {semanticWorkflowRows.map((row) => (
              <tr key={row.key}>
                <td><strong>{row.title}</strong></td>
                <td><Badge bg={statusVariant(row.status === 'ready' ? 'ready' : 'partial')}>{titleize(row.status)}</Badge></td>
                <td>{titleize(row.priority)}</td>
                <td>{formatCount(row.actionItems)}</td>
                <td>{row.inputs}</td>
                <td>{row.outputs}</td>
                <td>{row.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ldt-compact-list">
        {semanticFeatureRows.map((feature) => (
          <div key={feature.key}>
            <span>{feature.role}</span>
            <strong>{formatCount(feature.count)} · {titleize(feature.quality)}</strong>
          </div>
        ))}
      </div>
      <ReadinessList category="analysis" checksByCategory={checksByCategory} />
    </section>
  )
}
