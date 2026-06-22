'use client'

import { Crosshair, Eye, Layers, Tag } from 'react-feather'
import {
  DEFAULT_LAYER_DETAIL,
  groupLayers,
  hasLayerLabels,
  smartControlLabel,
  supportsSmartDetail,
} from './visualRailModel'

export default function LayerVisibilityControls({
  layerControls = {},
  layerDefinitions = [],
  onLayerControlChange,
  onLayerFocus,
  onLayerSolo,
  onLayerToggle,
  visibleLayers = {},
}) {
  const layerGroups = groupLayers(layerDefinitions)
  if (!layerGroups.length) return null

  return (
    <section className="dt-control-section">
      <div className="dt-control-section__header">
        <Layers size={15} />
        <span>Layer visibility</span>
      </div>
      <div className="dt-layer-groups">
        {layerGroups.map((group) => (
          <section className="dt-layer-group" key={group.key}>
            <div className="dt-layer-group__header">
              <strong>{group.title}</strong>
              <p>{group.note}</p>
            </div>
            <div className="dt-layer-list">
              {group.layers.map((layer) => (
                <div className="dt-layer-row" key={layer.key}>
                  <label className="dt-layer-row__toggle">
                    <input
                      checked={Boolean(visibleLayers[layer?.key])}
                      onChange={() => onLayerToggle?.(layer.key)}
                      type="checkbox"
                    />
                    <span className="dt-layer-row__body">
                      <strong>{layer.label}</strong>
                      <small>{layer.semanticState || layer.description || layer.cluster}</small>
                    </span>
                  </label>
                  <div className="dt-layer-tools" aria-label={`${layer.label} controls`}>
                    <button
                      aria-label={`Focus ${layer.label}`}
                      className="dt-layer-tool-button"
                      onClick={() => onLayerFocus?.(layer.key)}
                      title="Focus layer"
                      type="button"
                    >
                      <Crosshair size={13} />
                    </button>
                    <button
                      aria-label={`Solo ${layer.label}`}
                      className="dt-layer-tool-button"
                      onClick={() => onLayerSolo?.(layer.key)}
                      title="Show only this layer"
                      type="button"
                    >
                      <Eye size={13} />
                    </button>
                    {hasLayerLabels(layer) ? (
                      <button
                        aria-pressed={Boolean(layerControls[layer.key]?.labels)}
                        aria-label={`Toggle ${layer.label} labels`}
                        className={layerControls[layer.key]?.labels ? 'dt-layer-tool-button is-active' : 'dt-layer-tool-button'}
                        onClick={() =>
                          onLayerControlChange?.(layer.key, {
                            labels: !Boolean(layerControls[layer.key]?.labels),
                          })
                        }
                        title="Toggle labels"
                        type="button"
                      >
                        <Tag size={13} />
                      </button>
                    ) : null}
                  </div>
                  {supportsSmartDetail(layer) ? (
                    <div className="dt-layer-smart">
                      <span>{smartControlLabel(layer)}</span>
                      <input
                        aria-label={`${layer.label} smart detail`}
                        max="100"
                        min="10"
                        onChange={(event) => onLayerControlChange?.(layer.key, { detail: Number(event.target.value) })}
                        onInput={(event) => onLayerControlChange?.(layer.key, { detail: Number(event.currentTarget.value) })}
                        type="range"
                        value={Number(layerControls[layer.key]?.detail ?? DEFAULT_LAYER_DETAIL)}
                      />
                      <strong>{Number(layerControls[layer.key]?.detail ?? DEFAULT_LAYER_DETAIL)}%</strong>
                    </div>
                  ) : (
                    <div className="dt-layer-smart dt-layer-smart--locked">
                      <span>{layer.key === 'unclassifiedLand' ? 'Fallback land' : 'Municipal mask'}</span>
                      <strong>Fixed</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
