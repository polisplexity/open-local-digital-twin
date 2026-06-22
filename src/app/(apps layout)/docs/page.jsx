'use client'

import { useEffect, useMemo, useState } from 'react'
import TwinInfoPage from '@/components/twin-module/TwinInfoPage'
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
      value: `${Number(totals.scopeAreaKm2 ?? 0).toFixed(1)} km²`,
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

  const cityLabel = activeCity ? `${getCityDisplayName(activeCity)}, ${activeCity.country}, ${activeCity.region}.` : `${twinOverview.city}, ${twinOverview.country}, ${twinOverview.region}.`
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
  const cards = [
    {
      id: 'docs-brief',
      title: 'City brief',
      items: [
        cityLabel,
        twinOverview.tagline,
        twinOverview.summary,
      ],
    },
    {
      id: 'docs-pack',
      title: 'Institutional document pack',
      items: documentPack.map((document) => `${document.title} (${document.type}): ${document.description}`),
    },
    {
      id: 'docs-model',
      title: 'Current product posture',
      items: [
        'Base twin: active and visible.',
        'Logical twin: active through layer definitions, bundles, counts, and viewer state.',
        'Semantic seeds: visible, but still inferred from public data.',
        'Interoperability: still pending as a formal exchange and federation layer.',
      ],
    },
    {
      id: 'docs-delivery',
      title: 'Delivery and viewer posture',
      items: [
        'Jampack provides the application shell, module navigation, theme handling, and responsive app structure.',
        'Next serves the digital twin routes while Express keeps the auth, API, and live viewers in the same product boundary.',
        'Map, 3D, and immersive remain product-native viewers because they are the differentiating surfaces of the twin.',
        'All three viewers start from the same active-city payload, but each one filters and stages it differently according to base, logical, and inferred semantic reading.',
        'Future semantic packs should attach to the current base and logical twin without changing the shell.',
        'A future building digital starter layer can attach to the current base records without requiring full BIM coverage from day one.',
      ],
    },
  ]
  const tables = [
    {
      id: 'docs-sources',
      title: 'Current source and derivation register',
      columns: ['Source', 'Category', 'Scope', 'Status'],
      rows: publicSources.map((source) => ({
        id: source.source,
        Source: source.source,
        Category: source.category,
        Scope: source.scope,
        Status: source.status,
      })),
    },
    {
      id: 'docs-register',
      title: 'Current layer taxonomy',
      columns: ['Layer', 'Type', 'Count', 'Source', 'Status', 'Reading'],
      rows: liveLayerRegister.map((layer) => ({
        id: layer.id,
        Layer: layer.label,
        Type: layer.type,
        Count: String(layer.count),
        Source: layer.source,
        Status: layer.status,
        Reading: layer.note,
      })),
    },
    {
      id: 'docs-viewers',
      title: 'Viewer surface register',
      columns: ['Surface', 'Base twin shown', 'Logical twin shown', 'Semantic seeds shown', 'Transport posture'],
      rows: viewerSurfaceRegister,
    },
    {
      id: 'docs-seeds',
      title: 'Current semantic seed register',
      columns: ['Seed', 'Current basis', 'Current meaning', 'Future enrichment'],
      rows: semanticSeedRegister,
    },
    {
      id: 'docs-interoperability',
      title: 'Interoperability and transport register',
      columns: ['Topic', 'Current status', 'What exists now', 'Next step'],
      rows: interoperabilityRegister,
    },
    {
      id: 'docs-packs',
      title: 'Future semantic pack roadmap',
      columns: ['Pack', 'What it adds', 'Probable inputs'],
      rows: futureSemanticPacks,
    },
    {
      id: 'docs-ws2',
      title: 'WS2 pilot-detail alignment register',
      columns: ['Requirement', 'Manual expectation', 'Current platform posture'],
      rows: ws2PilotDetailRegister,
    },
  ]

  return (
    <TwinInfoPage
      cards={cards}
      config={docsPageConfig}
      sidebarBody={[
        `Use this module as the institutional evidence pack of the current ${getCityWorkspaceLabel(activeCity)} workspace.`,
        'It records what is public base today, what is already an inferred semantic seed, what the logical twin contributes, and what still belongs to future semantic packs or interoperability work.',
        'Not all visible data is semantic, and not all semantic meaning is already interoperable. This module keeps those layers explicitly separate.',
      ]}
      stats={liveStats}
      tables={tables}
    />
  )
}

export default DocsPage
