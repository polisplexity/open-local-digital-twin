'use client'

import { Box, Layers, MapPin, Target } from 'react-feather'

export default function SelectionPanel({ selection }) {
  if (!selection) {
    return (
      <div className="dt-side-note dt-side-note--empty">
        <strong>No feature selected</strong>
        <p>Click a road, building, anchor, or seed in the viewer to inspect what layer it belongs to.</p>
      </div>
    )
  }

  return (
    <div className="dt-side-note">
      <strong>{selection.properties?.label || selection.meta?.label || 'Selected element'}</strong>
      <p>{selection.meta?.description || 'Current city element inside the twin.'}</p>
      <div className="dt-selection-chips">
        {selection.meta?.twinCategory ? (
          <span className="dt-selection-chip">
            <Layers size={12} />
            {selection.meta.twinCategory}
          </span>
        ) : null}
        {selection.meta?.system ? (
          <span className="dt-selection-chip">
            <Layers size={12} />
            {selection.meta.system}
          </span>
        ) : null}
        {selection.meta?.ldtLayer ? (
          <span className="dt-selection-chip">
            <MapPin size={12} />
            {selection.meta.ldtLayer}
          </span>
        ) : null}
        {selection.meta?.capability ? (
          <span className="dt-selection-chip">
            <Target size={12} />
            {selection.meta.capability}
          </span>
        ) : null}
      </div>
      {selection.properties?.kind === 'building' ? (
        <div className="dt-building-record">
          <strong>Building starter record</strong>
          <p>
            {selection.properties?.bim_status || 'No BIM linked yet'}.
            {' '}Generated from the current public city model.
          </p>
          <div className="dt-selection-chips">
            <span className="dt-selection-chip">
              <Box size={12} />
              {selection.properties?.digital_record_stage || 'base-record'}
            </span>
            <span className="dt-selection-chip">
              <MapPin size={12} />
              {selection.properties?.planning_readiness || 'context-only'}
            </span>
            {selection.properties?.estimated_floors ? (
              <span className="dt-selection-chip">
                <Target size={12} />
                {selection.properties.estimated_floors} floors est.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
