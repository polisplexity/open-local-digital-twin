'use client'

import { Target } from 'react-feather'

export default function CityCoverageControl({
  cityCoverage = 0,
  onCityCoverageChange,
}) {
  return (
    <section className="dt-control-section">
      <div className="dt-control-section__header">
        <Target size={15} />
        <span>City coverage</span>
      </div>
      <div className="dt-city-scale-control">
        <div className="dt-fidelity-control">
          <div className="dt-fidelity-control__labels">
            <span>Empty</span>
            <strong>{cityCoverage}%</strong>
            <span>Full city</span>
          </div>
          <input
            aria-label="Visible city coverage"
            className="dt-fidelity-control__range"
            max="100"
            min="0"
            onChange={(event) => onCityCoverageChange?.(Number(event.target.value))}
            onInput={(event) => onCityCoverageChange?.(Number(event.currentTarget.value))}
            step="1"
            type="range"
            value={cityCoverage}
          />
          <div className="dt-fidelity-control__labels">
            <span>Coverage</span>
            <input
              aria-label="Visible city coverage percent"
              className="form-control form-control-sm"
              max="100"
              min="0"
              onChange={(event) => onCityCoverageChange?.(Number(event.target.value))}
              step="1"
              style={{ maxWidth: 92 }}
              type="number"
              value={cityCoverage}
            />
            <span>%</span>
          </div>
        </div>
        <p>Starts empty and expands the visible city radius from the center. Moving it back removes out-of-radius features.</p>
      </div>
    </section>
  )
}
