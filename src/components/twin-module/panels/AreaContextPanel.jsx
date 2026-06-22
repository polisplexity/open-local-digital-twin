'use client'

function formatCount(value) {
  const next = Number(value ?? 0)
  if (!Number.isFinite(next)) return '0'
  return new Intl.NumberFormat('en-US').format(next)
}

function formatArea(value) {
  const next = Number(value ?? 0)
  if (!Number.isFinite(next) || next <= 0) return '0 km²'
  return `${next.toLocaleString('en-US', { maximumFractionDigits: next >= 100 ? 1 : 2 })} km²`
}

export default function AreaContextPanel({
  loading,
  error,
  selectedAreaSummary,
  selectionUnits,
  surfaceManifest,
}) {
  const summary = selectedAreaSummary?.ok ? selectedAreaSummary : null
  const manifestScopes = surfaceManifest?.selectionScopes ?? []
  const availableScopes = new Set(selectionUnits?.summary?.availableScopes ?? [])
  const missingScopes = new Set(selectionUnits?.summary?.missingScopes ?? [])
  const visibleScopes = manifestScopes.slice(0, 6)

  return (
    <div className="dt-area-context">
      <div className="dt-sidebar-summary dt-sidebar-summary--area">
        <div className="dt-sidebar-stat">
          <span>Area</span>
          <strong>{loading ? '...' : formatArea(summary?.area?.areaKm2)}</strong>
        </div>
        <div className="dt-sidebar-stat">
          <span>Entities</span>
          <strong>{loading ? '...' : formatCount(summary?.featureCount)}</strong>
        </div>
      </div>
      <div className="dt-area-context__meta">
        {error ? <span className="is-warning">{error}</span> : null}
        {!error && summary?.area?.label ? <span>{summary.area.label}</span> : null}
        {!error && !summary && !loading ? <span>No active area loaded</span> : null}
        {summary?.sourceEvidence?.sourceLayerCount ? (
          <span>{formatCount(summary.sourceEvidence.sourceLayerCount)} source layers</span>
        ) : null}
      </div>
      {visibleScopes.length ? (
        <div className="dt-scope-chips" aria-label="Selection scopes">
          {visibleScopes.map((scope) => {
            const key = scope.key ?? scope.scope
            const missing = missingScopes.has(key) || scope.status === 'needed' || scope.status === 'missing-source'
            const available = availableScopes.has(key) || scope.status === 'available'
            return (
              <span
                className={available && !missing ? 'dt-scope-chip is-available' : 'dt-scope-chip'}
                key={key}
              >
                {scope.label ?? key}
              </span>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
