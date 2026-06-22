'use client'

import {
  buildSelectedAreaIndicators,
  buildSelectedAreaMetrics,
  formatCount,
} from '../viewerStateModel'

export default function CockpitMapInspector({
  activeTab,
  buildingCoverage,
  config,
  heroMetrics,
  indicators,
  onTabChange,
  selectedAreaLoading,
  selectedAreaSummary,
}) {
  const tabs = [
    { key: 'indicators', label: 'Indicators' },
    { key: 'logic', label: 'Twin logic' },
    { key: 'sources', label: 'Sources' },
    { key: 'buildings', label: 'Buildings' },
  ]
  const selectedIndicators = buildSelectedAreaIndicators(selectedAreaSummary)
  const selectedMetrics = buildSelectedAreaMetrics(selectedAreaSummary)
  const activeIndicators = selectedIndicators.length ? selectedIndicators : indicators

  return (
    <section className="dt-map-inspector" aria-label="Cockpit inspector">
      <div className="dt-map-inspector__tabs" role="tablist" aria-label="Cockpit evidence">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? 'is-active' : ''}
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="dt-map-inspector__body" role="tabpanel">
        {activeTab === 'indicators' ? (
          <div className="dt-map-inspector__grid">
            {selectedAreaLoading || selectedMetrics.length ? (
              <div className="dt-selected-area-bar">
                {selectedAreaLoading ? (
                  <span className="dt-selected-area-bar__loading">Updating selected area</span>
                ) : (
                  selectedMetrics.map((metric) => (
                    <div className="dt-selected-area-bar__metric" key={metric.label}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))
                )}
              </div>
            ) : null}
            <div className="dt-indicator-grid">
              {activeIndicators.map((indicator) => (
                <article className="dt-indicator" key={indicator.label}>
                  <div>
                    <span>{indicator.label}</span>
                    <strong>{indicator.value}</strong>
                  </div>
                  <small>{indicator.status}</small>
                  <p>{indicator.note}</p>
                </article>
              ))}
            </div>
            <div className="dt-map-inspector__metrics">
              {heroMetrics.map((metric) => (
                <div className="dt-map-inspector__metric dt-map-inspector__metric--compact" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === 'logic' ? (
          <div className="dt-map-inspector__grid">
            <div className="dt-map-inspector__cards">
              <article className="dt-map-inspector__card">
                <h3>Base twin</h3>
                <p>Open public geometry and observable facts: boundary, roads, buildings, land-use/open-land polygons, places, and visible municipal coverage gaps.</p>
              </article>
              <article className="dt-map-inspector__card">
                <h3>Inferred twin</h3>
                <p>Computed readings derived from the base: density, coverage, candidate gaps, access anchors, and source overlap. These help the analyst decide what to verify next.</p>
              </article>
              <article className="dt-map-inspector__card">
                <h3>Semantic layer</h3>
                <p>Meaning inferred from public tags, such as civic, mobility, commerce, and waste seeds. These are not official authority packs until accepted by a city or provider workflow.</p>
              </article>
              <article className="dt-map-inspector__card">
                <h3>Who brings it here</h3>
                <p>Base data comes from open sources. Provider and city layers can add authority-grade data later through APIs, ingestion jobs, and accepted-source status.</p>
              </article>
            </div>
          </div>
        ) : null}

        {activeTab === 'sources' ? (
          <div className="dt-map-inspector__bullets dt-map-inspector__bullets--wide">
            {config.content.sources.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}

        {activeTab === 'buildings' && buildingCoverage ? (
          <div className="dt-map-inspector__buildings">
            <div className="dt-map-inspector__metrics dt-map-inspector__metrics--coverage">
              <div className="dt-map-inspector__metric">
                <span>Observed footprints</span>
                <strong>{formatCount(buildingCoverage.observed?.count)}</strong>
                <p>Current OSM-derived building records inside the city boundary.</p>
              </div>
              <div className="dt-map-inspector__metric">
                <span>Open-source footprints</span>
                <strong>{formatCount(buildingCoverage.conflation?.candidateCount)}</strong>
                <p>Independent official, Overture, Microsoft, or Google footprints inside the city scope.</p>
              </div>
              <div className="dt-map-inspector__metric">
                <span>Added to inventory</span>
                <strong>{formatCount(buildingCoverage.conflation?.newCandidateCount)}</strong>
                <p>{buildingCoverage.estimate?.confidence === 'candidate-not-authority' ? 'Footprints not matched to the observed OSM base.' : 'No independent source is connected yet.'}</p>
              </div>
              <div className="dt-map-inspector__metric">
                <span>Matched source evidence</span>
                <strong>{formatCount(buildingCoverage.conflation?.matchedCandidateCount)}</strong>
                <p>Open-source footprints already explained by the observed base.</p>
              </div>
            </div>
            <div className="dt-source-grid dt-source-grid--compact">
              {(buildingCoverage.sources ?? []).map((source) => (
                <div className={source.active ? 'dt-source-pill is-active' : 'dt-source-pill'} key={source.key}>
                  <div>
                    <strong>{source.name}</strong>
                    <span>{source.role}</span>
                  </div>
                  <small>{formatCount(source.count)} · {source.license}</small>
                </div>
              ))}
            </div>
            <p className="dt-coverage-note mb-0">{buildingCoverage.estimate?.note}</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
