import { createDefaultTwinQueryClause } from './semanticQueryClient'

export const DEFAULT_LAYER_DETAIL = 100
export const FIXED_DETAIL_LAYER_KEYS = new Set(['boundary', 'unclassifiedLand'])
export const DEFAULT_QUERY_RADIUS_PERCENT = 35
export const QUERY_IDLE_CONTEXT_LAYERS = new Set(['boundary'])

export function defaultTwinQueryBuilder(supportsCityScale) {
  const firstClause = createDefaultTwinQueryClause({
    id: 'clause-1',
    label: 'Clause 1',
    supportsCityScale,
  })
  return {
    operation: 'union',
    clauses: [firstClause],
    classKey: 'buildings',
    scopeKey: supportsCityScale ? 'radius' : 'city',
    radiusPercent: supportsCityScale ? DEFAULT_QUERY_RADIUS_PERCENT : 0,
    radiusMeters: '',
    predicateMode: 'and',
    predicates: [
      {
        id: 'predicate-1',
        field: '',
        operator: 'exists',
        value: '',
        valueMax: '',
      },
    ],
    renderMode: 'isolate',
  }
}

export function mergeLayerState(current, patch = {}) {
  let changed = false
  const next = { ...current }
  Object.entries(patch).forEach(([key, value]) => {
    const normalized = Boolean(value)
    if (next[key] !== normalized) {
      next[key] = normalized
      changed = true
    }
  })
  return changed ? next : current
}

export function layerDetailRatio(layer, layerControls = {}) {
  if (FIXED_DETAIL_LAYER_KEYS.has(layer?.key)) return 1
  const value = Number(layerControls[layer?.key]?.detail ?? DEFAULT_LAYER_DETAIL)
  if (!Number.isFinite(value)) return 1
  return Math.max(10, Math.min(100, value)) / 100
}

export function countVisibleSelected(layerDefinitions, visibleLayers, layerControls) {
  return layerDefinitions.reduce((sum, layer) => {
    if (!visibleLayers[layer.key]) return sum
    const baseCount = Number(layer.renderedCount ?? layer.count ?? 0)
    return sum + Math.round(baseCount * layerDetailRatio(layer, layerControls))
  }, 0)
}

export function formatCount(value, suffix = '') {
  const next = Number(value ?? 0)
  if (!Number.isFinite(next)) return `0${suffix}`
  return `${new Intl.NumberFormat('en-US').format(next)}${suffix}`
}

export function intentForViewer(viewerId) {
  if (viewerId === '3d') return 'operations'
  if (viewerId === 'immersive') return 'embed'
  return 'analysis'
}

export function buildHeroMetrics(payload) {
  const totals = payload?.inventory?.totals ?? {}
  const semanticSeedTotal =
    Number(totals.civicAnchors ?? 0) +
    Number(totals.mobilityAnchors ?? 0) +
    Number(totals.commerceAnchors ?? 0) +
    Number(totals.wasteSeedCount ?? 0)
  return [
    {
      label: 'Territorial scope',
      value: `${Number(totals.scopeAreaKm2 ?? 0).toFixed(1)} km²`,
      note: `${formatCount(totals.boundaryRings)} boundary ring and ${formatCount(totals.placesDiscovered)} place markers already frame the municipality.`,
    },
    {
      label: 'Named streets',
      value: formatCount(totals.roadNamesDiscovered),
      note: `${formatCount(totals.roadsRendered)} road geometries and ${Number(totals.renderedRoadKm ?? 0).toFixed(1)} km of rendered network.`,
    },
    {
      label: 'Built fabric',
      value: formatCount(totals.buildingsDiscovered),
      note: `${formatCount(totals.buildingsRendered)} buildings already render with average height ${Number(totals.averageBuildingHeight ?? 0).toFixed(1)}m.`,
    },
    {
      label: 'Inferred semantic seeds',
      value: formatCount(semanticSeedTotal),
      note: `${formatCount(totals.civicAnchors)} civic, ${formatCount(totals.mobilityAnchors)} mobility, ${formatCount(totals.commerceAnchors)} daily-economy, and ${formatCount(totals.wasteSeedCount)} waste seeds inferred from public data.`,
    },
  ]
}

export function buildVisibleBundles(bundleDefinitions = [], layerDefinitions = []) {
  const available = new Set(layerDefinitions.map((layer) => layer.key))
  return bundleDefinitions
    .map((bundle) => ({
      ...bundle,
      layers: (bundle.layers ?? []).filter((key) => available.has(key)),
    }))
    .filter((bundle) => bundle.layers.length)
}

export function buildDefaultLayerControls(layerDefinitions = []) {
  return Object.fromEntries(
    layerDefinitions.map((layer) => [
      layer.key,
      {
        detail: FIXED_DETAIL_LAYER_KEYS.has(layer.key) ? 100 : DEFAULT_LAYER_DETAIL,
        labels: false,
      },
    ]),
  )
}

export function buildQueryIdleVisibleLayers(layerDefinitions = []) {
  return Object.fromEntries(
    layerDefinitions.map((layer) => [layer.key, QUERY_IDLE_CONTEXT_LAYERS.has(layer.key)]),
  )
}

export function cityFeatureLimitForCoverage(value) {
  const coverage = Math.min(100, Math.max(0, Number(value) || 0))
  if (coverage <= 0) return 0
  return Math.min(300000, Math.round(18000 + coverage * 2200))
}

export function surfaceKeyForViewer(viewerId) {
  if (viewerId === '3d') return 'municipal3d'
  if (viewerId === 'immersive') return 'immersive'
  return 'map'
}

export function walkGeoJsonCoordinates(geometry, callback) {
  if (!geometry) return
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    callback(geometry.coordinates)
    return
  }
  const visit = (value) => {
    if (!Array.isArray(value)) return
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      callback(value)
      return
    }
    value.forEach(visit)
  }
  visit(geometry.coordinates)
}

export function distanceMeters(a, b) {
  const earthRadius = 6371008.8
  const lat1 = (a[1] * Math.PI) / 180
  const lat2 = (b[1] * Math.PI) / 180
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLon = ((b[0] - a[0]) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function payloadCenter(payload) {
  const lon = Number(payload?.center?.lon ?? payload?.reference?.center?.lon)
  const lat = Number(payload?.center?.lat ?? payload?.reference?.center?.lat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return [lon, lat]
}

export function maxCityRadiusMeters(payload) {
  const center = payloadCenter(payload)
  if (!center) return 0
  let maxDistance = 1000
  ;(payload?.layers?.boundary?.features ?? []).forEach((feature) => {
    walkGeoJsonCoordinates(feature.geometry, (coordinate) => {
      maxDistance = Math.max(maxDistance, distanceMeters(center, coordinate))
    })
  })
  return Math.max(1000, maxDistance * 1.04)
}

export function radiusMetersForCityCoverage(payload, coverage) {
  const percent = Math.min(100, Math.max(0, Number(coverage) || 0))
  if (percent <= 0) return 0
  const maxRadius = maxCityRadiusMeters(payload)
  if (!maxRadius) return 0
  return Math.round(maxRadius * (percent / 100))
}

export function buildFallbackLayerDefinitions(payload) {
  const existing = (payload?.inventory?.layerDefinitions ?? []).filter((layer) => layer.key !== 'center')
  if (existing.length) return existing

  const labels = {
    boundary: 'Boundary',
    unclassifiedLand: 'Land-use coverage gap',
    roads: 'Roads',
    buildings: 'Buildings',
    greenBlue: 'Land use / open land',
    civic: 'Civic anchors',
    mobility: 'Mobility anchors',
    commerce: 'Daily economy',
    wasteSeeds: 'Waste seeds',
    places: 'Places',
  }
  const baseKeys = ['boundary', 'unclassifiedLand', 'roads', 'buildings', 'greenBlue', 'places']
  const semanticKeys = ['civic', 'mobility', 'commerce', 'wasteSeeds']
  return [...baseKeys, ...semanticKeys]
    .filter((key) => Array.isArray(payload?.layers?.[key]?.features))
    .map((key) => {
      const count = payload.layers[key].features.length
      const isSemantic = semanticKeys.includes(key)
      return {
        key,
        label: labels[key] ?? key,
        count,
        renderedCount: count,
        discoveredCount: count,
        visibleByDefault: ['boundary', 'buildings', 'roads', 'greenBlue'].includes(key),
        twinCategoryKey: isSemantic ? 'semanticSeed' : 'base',
        twinCategory: isSemantic ? 'Inferred semantic seed' : 'Base layer',
        semanticState: isSemantic ? 'Public-data classification' : 'Base geometry',
        description: isSemantic ? 'Inferred public-data seed.' : 'Open city base geometry.',
      }
    })
}

export function setBuildingGroupVisibility(layers, visible) {
  const next = { ...layers }
  next.buildings = Boolean(visible)
  return next
}

export function formatCompactRatio(value, suffix = '') {
  const next = Number(value ?? 0)
  if (!Number.isFinite(next)) return `0${suffix}`
  if (next >= 100) return `${Math.round(next).toLocaleString('en-US')}${suffix}`
  if (next >= 10) return `${next.toFixed(1)}${suffix}`
  return `${next.toFixed(2)}${suffix}`
}

export function layerCount(payload, key) {
  return Number(payload?.layers?.[key]?.features?.length ?? 0)
}

export function layerDefinition(payload, key) {
  return (payload?.inventory?.layerDefinitions ?? []).find((layer) => layer.key === key)
}

export function buildCityAnalystIndicators(payload, buildingCoverage) {
  const totals = payload?.inventory?.totals ?? {}
  const area = Math.max(Number(totals.scopeAreaKm2 ?? 0), 0.01)
  const roads = Number(totals.roadsRendered ?? layerCount(payload, 'roads'))
  const buildings = Number(totals.buildingsDiscovered ?? layerCount(payload, 'buildings'))
  const civic = Number(totals.civicAnchors ?? layerCount(payload, 'civic'))
  const mobility = Number(totals.mobilityAnchors ?? layerCount(payload, 'mobility'))
  const commerce = Number(totals.commerceAnchors ?? layerCount(payload, 'commerce'))
  const waste = Number(totals.wasteSeedCount ?? layerCount(payload, 'wasteSeeds'))
  const semantic = civic + mobility + commerce + waste
  const observedBuildings = Number(buildingCoverage?.observed?.count ?? 0)
  const newBuildingCandidates = Number(buildingCoverage?.conflation?.newCandidateCount ?? 0)
  const gapLayer = layerDefinition(payload, 'unclassifiedLand')
  const landUseGap = gapLayer?.displayValue || gapLayer?.count || 'Review'
  const buildingUplift = observedBuildings > 0 ? (newBuildingCandidates / observedBuildings) * 100 : 0

  return [
    {
      label: 'Built fabric density',
      value: `${formatCompactRatio(buildings / area)}/km²`,
      status: 'Base + open enrichment',
      note: 'How much built fabric the current inventory exposes for spatial review.',
    },
    {
      label: 'Road granularity',
      value: `${formatCompactRatio(roads / area)}/km²`,
      status: 'Base geometry',
      note: 'Road geometries per square kilometer from the open public baseline.',
    },
    {
      label: 'Semantic seed density',
      value: `${formatCompactRatio(semantic / area)}/km²`,
      status: 'Inferred semantic layer',
      note: 'Civic, mobility, commerce, and waste anchors inferred from public tags.',
    },
    {
      label: 'Land-use gap',
      value: String(landUseGap),
      status: 'Coverage gap',
      note: 'Municipal area still missing useful thematic land-use classification.',
    },
    {
      label: 'Building uplift',
      value: newBuildingCandidates ? `+${formatCompactRatio(buildingUplift)}%` : '0%',
      status: 'Provider evidence',
      note: 'Open-provider footprints not matched to the observed base yet.',
    },
    {
      label: 'Access seed mix',
      value: `${formatCount(mobility)} / ${formatCount(civic)}`,
      status: 'Mobility vs civic',
      note: 'First signal of movement anchors compared with public-service anchors.',
    },
  ]
}

export function selectedAreaIndicatorValue(indicator) {
  const value = Number(indicator?.value ?? 0)
  const formatted = Number.isFinite(value)
    ? value.toLocaleString('en-US', {
        maximumFractionDigits: value >= 100 ? 0 : 2,
      })
    : '0'
  return `${formatted}${indicator?.unit ? ` ${indicator.unit}` : ''}`
}

export function buildSelectedAreaIndicators(selectedAreaSummary) {
  if (!selectedAreaSummary?.ok) return []
  return (selectedAreaSummary.indicators ?? []).map((indicator) => ({
    label: indicator.label,
    value: selectedAreaIndicatorValue(indicator),
    status: selectedAreaSummary.area?.label ?? 'Selected area',
    note: indicator.method,
  }))
}

export function buildSelectedAreaMetrics(selectedAreaSummary) {
  if (!selectedAreaSummary?.ok) return []
  return [
    {
      label: 'Selected area',
      value: `${Number(selectedAreaSummary.area?.areaKm2 ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} km²`,
    },
    {
      label: 'Inventory',
      value: formatCount(selectedAreaSummary.featureCount),
    },
    {
      label: 'Sources',
      value: formatCount(selectedAreaSummary.sourceEvidence?.sourceLayerCount),
    },
    {
      label: 'Scope',
      value: selectedAreaSummary.area?.scope ?? selectedAreaSummary.scope ?? 'city',
    },
  ]
}
