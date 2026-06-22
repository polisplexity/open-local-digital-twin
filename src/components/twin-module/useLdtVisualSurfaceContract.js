'use client'

import { useEffect, useMemo, useState } from 'react'

const CONTRACT_ENDPOINTS = [
  { key: 'capabilities', template: '/api/live/{cityId}/capabilities', required: true },
  { key: 'layerCapabilities', template: '/api/live/{cityId}/layer-capabilities', required: true },
  { key: 'viewerSummary', template: '/api/live/{cityId}/viewer-summary', required: true },
  { key: 'viewerManifest', template: '/api/live/{cityId}/viewer-manifest?surface={surface}', required: true },
  { key: 'semanticQueryContract', template: '/api/live/{cityId}/semantic-query-contract?surface={surface}', required: false },
  { key: 'twinQueryContract', template: '/api/live/{cityId}/twin-query-contract', required: false },
  { key: 'selectionUnits', template: '/api/live/{cityId}/selection-units?scope=available&limit=12', required: false },
  { key: 'citySelectionSummary', template: '/api/live/{cityId}/selection-summary?scope=city', required: false },
]

function endpointFor(cityId, surface, template) {
  return template
    .replace('{cityId}', encodeURIComponent(cityId || 'current'))
    .replace('{surface}', encodeURIComponent(surface || 'map'))
}

async function fetchContractPart(cityId, surface, descriptor) {
  const response = await fetch(endpointFor(cityId, surface, descriptor.template), { credentials: 'same-origin' })
  if (!response.ok) {
    return {
      key: descriptor.key,
      required: descriptor.required,
      ok: false,
      status: response.status,
      payload: null,
      error: `${descriptor.key.toUpperCase()}_${response.status}`,
    }
  }
  return {
    key: descriptor.key,
    required: descriptor.required,
    ok: true,
    status: response.status,
    payload: await response.json(),
    error: null,
  }
}

function normalizeSurfaceStatus(capabilities) {
  if (!capabilities?.ok) return 'blocked'
  if (capabilities.readiness === 'ready') return 'ready'
  if (capabilities.readiness === 'partial') return 'partial'
  if (capabilities.readinessSummary?.partial || capabilities.readinessGaps?.length) return 'partial'
  return 'ready'
}

function normalizeLayer(layer) {
  const transports = layer?.recommendedTransports ?? []
  const capabilities = layer?.capabilities ?? {}
  return {
    key: layer?.key ?? '',
    name: layer?.name ?? layer?.key ?? 'Layer',
    family: layer?.family ?? layer?.layerFamily ?? 'city-layer',
    geometryType: layer?.geometryType ?? 'unknown',
    authorityStatus: layer?.authorityStatus ?? 'unknown',
    semanticStatus: layer?.semanticStatus ?? 'unknown',
    featureCount: Number(layer?.featureCount ?? 0),
    transports,
    hasGeojsonWindow: Boolean(capabilities.geojsonWindow?.available),
    hasVectorTile: Boolean(capabilities.vectorTile?.available),
    hasBim: Boolean(capabilities.bim?.available),
    hasRasterCatalog: Boolean(capabilities.rasterCatalog?.available),
    hasThreeDPackage: Boolean(capabilities.threeDPackage?.available),
  }
}

function normalizeContract(cityId, surface, parts) {
  const byKey = Object.fromEntries(parts.map((part) => [part.key, part]))
  const capabilities = byKey.capabilities?.payload ?? null
  const layerCapabilities = byKey.layerCapabilities?.payload ?? null
  const viewerSummary = byKey.viewerSummary?.payload ?? null
  const viewerManifest = byKey.viewerManifest?.payload?.manifest ?? null
  const semanticQueryContract = byKey.semanticQueryContract?.payload?.contract ?? null
  const twinQueryContract = byKey.twinQueryContract?.payload?.contract ?? null
  const selectionUnits = byKey.selectionUnits?.payload ?? null
  const citySelectionSummary = byKey.citySelectionSummary?.payload ?? null
  const failedParts = parts.filter((part) => !part.ok && part.required)
  const optionalFailures = parts.filter((part) => !part.ok && !part.required)
  const layers = (layerCapabilities?.layers ?? []).map(normalizeLayer)
  const layerFamilies = layers.reduce((groups, layer) => {
    const family = layer.family || 'city-layer'
    groups[family] = groups[family] || []
    groups[family].push(layer)
    return groups
  }, {})

  return {
    ok: failedParts.length === 0,
    cityId,
    surface,
    city: capabilities?.city ?? viewerSummary?.summary?.city ?? viewerSummary?.city ?? null,
    generatedAt: new Date().toISOString(),
    status: normalizeSurfaceStatus(capabilities),
    errors: failedParts.map((part) => part.error),
    warnings: optionalFailures.map((part) => part.error),
    readiness: {
      state: capabilities?.readiness ?? 'unknown',
      summary: capabilities?.readinessSummary ?? null,
      gaps: capabilities?.readinessGaps ?? [],
      checks: capabilities?.readinessChecks ?? [],
    },
    counts: {
      ...(capabilities?.counts ?? {}),
      ...(viewerSummary?.summary?.inventory ?? {}),
    },
    modules: capabilities?.modules ?? {},
    layerSummary: layerCapabilities?.summary ?? {},
    layers,
    layerFamilies,
    manifest: viewerManifest,
    semanticQueryContract,
    twinQueryContract,
    selectionUnits,
    citySelectionSummary,
    viewerSummary,
    raw: {
      capabilities,
      layerCapabilities,
      viewerSummary,
      viewerManifest,
      semanticQueryContract,
      twinQueryContract,
      selectionUnits,
      citySelectionSummary,
    },
  }
}

export function useLdtVisualSurfaceContract(cityId = 'current', surface = 'map') {
  const [state, setState] = useState({
    loading: true,
    error: '',
    contract: null,
  })

  useEffect(() => {
    let cancelled = false

    async function loadContract() {
      setState((current) => ({
        ...current,
        loading: true,
        error: '',
      }))

      try {
        const parts = await Promise.all(
          CONTRACT_ENDPOINTS.map((descriptor) => fetchContractPart(cityId, surface, descriptor)),
        )
        if (cancelled) return
        const contract = normalizeContract(cityId, surface, parts)
        setState({
          loading: false,
          error: contract.ok ? '' : contract.errors.join(', '),
          contract,
        })
      } catch (error) {
        if (cancelled) return
        setState({
          loading: false,
          error: String(error?.message ?? 'VISUAL_CONTRACT_UNAVAILABLE'),
          contract: null,
        })
      }
    }

    loadContract()
    return () => {
      cancelled = true
    }
  }, [cityId, surface])

  return useMemo(() => ({
    loading: state.loading,
    error: state.error,
    contract: state.contract,
    ready: Boolean(state.contract?.ok && !state.loading),
    status: state.contract?.status ?? (state.loading ? 'loading' : 'blocked'),
  }), [state.contract, state.error, state.loading])
}
