'use client'

import { Target } from 'react-feather'

export default function FidelityControl({
  fidelity = 60,
  hint = 'Low keeps the scene light. High pulls in more city detail.',
  label = 'Scene fidelity',
  onChange,
  title = 'Drawing density',
}) {
  return (
    <section className="dt-control-section">
      <div className="dt-control-section__header">
        <Target size={15} />
        <span>{title}</span>
      </div>
      <div className="dt-side-note">
        <strong>{label}</strong>
        <p>{hint}</p>
        <div className="dt-fidelity-control">
          <div className="dt-fidelity-control__labels">
            <span>Light</span>
            <strong>{fidelity}%</strong>
            <span>Dense</span>
          </div>
          <input
            aria-label={label}
            className="dt-fidelity-control__range"
            max="100"
            min="10"
            onChange={(event) => onChange?.(Number(event.target.value))}
            onInput={(event) => onChange?.(Number(event.currentTarget.value))}
            type="range"
            value={fidelity}
          />
        </div>
      </div>
    </section>
  )
}
