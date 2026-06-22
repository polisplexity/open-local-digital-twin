'use client'

import { Layers } from 'react-feather'
import { formatCount } from './visualRailModel'

export default function LayerBundleControls({
  bundles = [],
  onBundleSelect,
  selectedBundleId = '',
  title = 'Layer bundles',
}) {
  if (!bundles.length) return null

  return (
    <section className="dt-control-section">
      <div className="dt-control-section__header">
        <Layers size={15} />
        <span>{title}</span>
      </div>
      <div className="dt-bundle-list">
        {bundles.map((bundle) => (
          <button
            className={selectedBundleId === bundle.id ? 'dt-bundle-button is-active' : 'dt-bundle-button'}
            key={bundle.id}
            onClick={() => onBundleSelect?.(bundle)}
            type="button"
          >
            <span>{bundle.label}</span>
            <small>{formatCount(bundle.layers?.length)} layers</small>
          </button>
        ))}
      </div>
    </section>
  )
}
