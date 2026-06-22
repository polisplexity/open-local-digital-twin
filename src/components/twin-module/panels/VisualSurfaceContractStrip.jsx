'use client'

import { formatCount } from '../viewerStateModel'

export default function VisualSurfaceContractStrip({
  contract,
  payload,
  selectedAreaSummary,
  viewerId,
}) {
  const layerSummary = contract?.layerSummary ?? {}
  const counts = contract?.counts ?? {}
  const modules = contract?.modules ?? {}
  const manifest = contract?.manifest ?? {}
  const bimReady =
    Number(layerSummary.bimLayerCount ?? 0) > 0 ||
    Number(layerSummary.threeDMetadataLayerCount ?? 0) > 0 ||
    Boolean(modules?.bim?.available)
  const storyReady = Boolean(manifest?.controls?.storyStops)
  const validationItems = [
    {
      label: 'Base inventory',
      value: formatCount(counts.totalEntities ?? payload?.inventory?.totals?.buildingsDiscovered ?? 0),
      note: 'Consolidated city objects available to this visual surface.',
    },
    {
      label: viewerId === 'immersive' ? 'Story controls' : '3D/BIM readiness',
      value: viewerId === 'immersive' ? (storyReady ? 'Available' : 'Limited') : (bimReady ? 'Linked' : 'Metadata only'),
      note: viewerId === 'immersive'
        ? 'Public story controls come from the same visual manifest.'
        : (bimReady ? 'Provider 3D/BIM records are discoverable.' : 'The scene validates the city canvas before full BIM authority.'),
    },
    {
      label: 'Selected scope',
      value: selectedAreaSummary?.area?.areaKm2
        ? `${Number(selectedAreaSummary.area.areaKm2).toLocaleString('en-US', { maximumFractionDigits: 1 })} km²`
        : (manifest?.selectionScopes?.length ? `${manifest.selectionScopes.length} scopes` : 'City'),
      note: selectedAreaSummary?.featureCount
        ? `${formatCount(selectedAreaSummary.featureCount)} city entities in the active area.`
        : 'Area inspection follows the same manifest contract as the analytical map.',
    },
  ]

  return (
    <section className="dt-validation-strip" aria-label="Municipal validation status">
      {validationItems.map((item) => (
        <article className="dt-validation-strip__item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p>{item.note}</p>
        </article>
      ))}
    </section>
  )
}
