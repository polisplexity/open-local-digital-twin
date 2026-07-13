'use client'

import { Box, Layers, MapPin, Target } from 'react-feather'

function numericDisplay(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value ?? 'n/a')
  return numeric.toFixed(2)
}

function modelEnrichmentRows(properties = {}) {
  const rows = []
  const enrichments = properties.modelEnrichments || properties.model_enrichments || {}
  Object.entries(enrichments).forEach(([modelKey, outputs]) => {
    Object.entries(outputs || {}).forEach(([outputKey, output]) => {
      rows.push({
        modelKey,
        outputKey,
        value: output?.valueNumeric ?? output?.valueText ?? output?.value?.value ?? output?.value ?? null,
        confidence: output?.confidence || 'unknown',
        authorityStatus: output?.authorityStatus || 'derived-model-output',
        generatedAt: output?.generatedAt || '',
      })
    })
  })
  if (!rows.length && properties.sapScore != null) {
    rows.push({
      modelKey: 'eu-ldt-building-sap-xgboost',
      outputKey: 'sap-score',
      value: properties.sapScore,
      confidence: properties.confidence || 'derived',
      authorityStatus: properties.authorityStatus || 'derived-model-output',
      generatedAt: '',
    })
  }
  return rows
}

function confidenceLabel(confidence) {
  if (confidence === 'smoke-synthetic') return 'Smoke-synthetic features'
  if (confidence === 'external-platform-derived') return 'External platform derived'
  return confidence
}

export default function SelectionPanel({ selection }) {
  if (!selection) {
    return (
      <div className="dt-side-note dt-side-note--empty">
        <strong>No feature selected</strong>
        <p>Click a road, building, anchor, or seed in the viewer to inspect what layer it belongs to.</p>
      </div>
    )
  }
  const modelRows = modelEnrichmentRows(selection.properties)

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
      {modelRows.length ? (
        <div className="dt-building-record dt-building-record--model">
          <strong>Model enrichments</strong>
          {modelRows.map((row) => (
            <div className="dt-model-enrichment-row" key={`${row.modelKey}:${row.outputKey}`}>
              <div>
                <span>{row.outputKey}</span>
                <strong>{numericDisplay(row.value)}</strong>
              </div>
              <p>{row.modelKey}</p>
              <div className="dt-selection-chips">
                <span className="dt-selection-chip">{row.authorityStatus === 'derived-model-output' ? 'Derived model output' : row.authorityStatus}</span>
                <span className="dt-selection-chip">{confidenceLabel(row.confidence)}</span>
                <span className="dt-selection-chip">Not authority approved</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
