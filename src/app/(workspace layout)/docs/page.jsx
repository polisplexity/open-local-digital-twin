'use client'

import { useEffect, useMemo, useState } from 'react'
import OldtUserManual from '@/components/twin-module/docs/OldtUserManual'
import { usePlatformContext } from '@/context/PlatformContext'
import { getCityDisplayName, getCityWorkspaceLabel } from '@/data/digital-twin/platformBrand'
import { docsPageConfig } from '@/data/digital-twin/moduleConfig'
import { getTwinOverview } from '@/data/digital-twin/workspaceContent'
import {
  getDocumentPackData,
  getFutureSemanticPacksData,
  getInteroperabilityRegisterData,
  getPublicSourcesData,
  getSemanticSeedRegisterData,
  getTwinHeroMetricsFallback,
  getTwinLayerRegisterData,
  getViewerSurfaceRegisterData,
  getWs2PilotDetailRegisterData,
} from '@/data/digital-twin/cityTwinContent'

function formatCount(value, suffix = '') {
  const next = Number(value ?? 0)
  if (!Number.isFinite(next)) return `0${suffix}`
  return `${new Intl.NumberFormat('en-US').format(next)}${suffix}`
}

function buildHeroMetricsFromPayload(payload, fallbackMetrics) {
  const totals = payload?.inventory?.totals
  if (!totals) return fallbackMetrics
  const semanticSeedTotal =
    Number(totals.civicAnchors ?? 0) +
    Number(totals.mobilityAnchors ?? 0) +
    Number(totals.commerceAnchors ?? 0) +
    Number(totals.wasteSeedCount ?? 0)

  return [
    {
      label: 'Territorial scope',
      value: `${Number(totals.scopeAreaKm2 ?? 0).toFixed(1)} km\u00B2`,
      note: `${formatCount(totals.boundaryRings)} boundary ring and ${formatCount(totals.placesDiscovered)} place markers frame the current city workspace.`,
    },
    {
      label: 'Named streets',
      value: formatCount(totals.roadNamesDiscovered),
      note: `${formatCount(totals.roadsRendered)} road geometries and ${Number(totals.renderedRoadKm ?? 0).toFixed(1)} km of rendered network.`,
    },
    {
      label: 'Built fabric',
      value: formatCount(totals.buildingsDiscovered),
      note: `${formatCount(totals.buildingsRendered)} buildings and average height ${Number(totals.averageBuildingHeight ?? 0).toFixed(1)}m.`,
    },
    {
      label: 'Inferred semantic seeds',
      value: formatCount(semanticSeedTotal),
      note: `${formatCount(totals.civicAnchors)} civic, ${formatCount(totals.mobilityAnchors)} mobility, ${formatCount(totals.commerceAnchors)} daily-economy, and ${formatCount(totals.wasteSeedCount)} waste seeds.`,
    },
  ]
}

function buildLayerRegisterFromPayload(payload, fallbackRegister) {
  const layers = payload?.inventory?.layerDefinitions
  if (!Array.isArray(layers) || !layers.length) return fallbackRegister
  return layers
    .filter((layer) => layer.key !== 'center')
    .map((layer) => ({
      id: layer.key,
      label: layer.label,
      type: layer.twinCategory,
      count: layer.discoveredCount ?? layer.count ?? 0,
      source: layer.transportStatus || layer.description || 'Local twin payload',
      status: layer.semanticState || 'Active',
      note: layer.cityMeaning || layer.nextSemanticStep || layer.description || '',
    }))
}

const DocsPage = () => {
  const { activeCity } = usePlatformContext()
  const twinOverview = useMemo(() => getTwinOverview(activeCity), [activeCity])
  const documentPack = useMemo(() => getDocumentPackData(activeCity), [activeCity])
  const publicSources = useMemo(() => getPublicSourcesData(activeCity), [activeCity])
  const semanticSeedRegister = useMemo(() => getSemanticSeedRegisterData(activeCity), [activeCity])
  const futureSemanticPacks = useMemo(() => getFutureSemanticPacksData(activeCity), [activeCity])
  const interoperabilityRegister = useMemo(() => getInteroperabilityRegisterData(activeCity), [activeCity])
  const viewerSurfaceRegister = useMemo(() => getViewerSurfaceRegisterData(activeCity), [activeCity])
  const ws2PilotDetailRegister = useMemo(() => getWs2PilotDetailRegisterData(activeCity), [activeCity])
  const [payload, setPayload] = useState(null)

  useEffect(() => {
    let ignore = false

    async function loadPayload() {
      try {
        const response = await fetch('/api/live/current/base', { credentials: 'same-origin' })
        if (!response.ok) return
        const nextPayload = await response.json()
        if (!ignore) {
          setPayload(nextPayload)
        }
      } catch {
        // Keep static docs if live payload is unavailable.
      }
    }

    loadPayload()
    return () => {
      ignore = true
    }
  }, [activeCity])

  const cityLabel = activeCity
    ? `${getCityDisplayName(activeCity)}, ${activeCity.region}, ${activeCity.country}`
    : `${twinOverview.city}, ${twinOverview.region}, ${twinOverview.country}`
  const liveLayerRegister = useMemo(
    () => buildLayerRegisterFromPayload(payload, getTwinLayerRegisterData(activeCity)),
    [activeCity, payload],
  )
  const liveStats = useMemo(
    () =>
      buildHeroMetricsFromPayload(payload, getTwinHeroMetricsFallback(activeCity)).map((metric) => ({
        ...metric,
        col: 3,
      })),
    [activeCity, payload],
  )
  const cityEvidence = {
    cityLabel,
    workspaceLabel: getCityWorkspaceLabel(activeCity),
    tagline: twinOverview.tagline,
    summary: twinOverview.summary,
    stats: liveStats,
    sources: publicSources.map((source) => ({
      id: source.source,
      Source: source.source,
      Category: source.category,
      Scope: source.scope,
      Status: source.status,
    })),
    layers: liveLayerRegister.map((layer) => ({
      id: layer.id,
      Layer: layer.label,
      Type: layer.type,
      Count: String(layer.count),
      Source: layer.source,
      Status: layer.status,
      Reading: layer.note,
    })),
    viewers: viewerSurfaceRegister,
    semanticSeeds: semanticSeedRegister,
    interoperability: interoperabilityRegister,
    futurePacks: futureSemanticPacks,
    ws2: ws2PilotDetailRegister,
  }

  return (
    <OldtUserManual
      cityEvidence={cityEvidence}
      config={docsPageConfig}
      documentPack={documentPack}
    />
  )
}

export default DocsPage
