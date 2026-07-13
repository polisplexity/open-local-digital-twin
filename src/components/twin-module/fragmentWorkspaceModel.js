'use client'

import { normalizeSemanticQueryGeojson, transportForViewer } from './semanticQueryClient'
import {
  analysisSelectionCountLabel,
  analysisSelectionLabel,
  analysisSelectionSourceQuery,
  groupAnalysisSelections,
} from './query/querySelectionModel'

export const FRAGMENT_PALETTE = [
  '#007c89',
  '#d94873',
  '#c57c17',
  '#256f48',
  '#355fc8',
  '#c44d2d',
  '#6f5fb8',
  '#0f8f5f',
]

const VALUE_PALETTE = [
  '#007c89',
  '#d94873',
  '#c57c17',
  '#256f48',
  '#355fc8',
  '#c44d2d',
  '#6f5fb8',
  '#0f8f5f',
  '#6f7480',
]

export const FRAGMENT_COLOR_FIELDS = [
  { key: '__fragment', label: 'World' },
  { key: 'semanticClass', label: 'Semantic class' },
  { key: 'layerKey', label: 'Layer key' },
  { key: 'buildingType', label: 'Building type' },
  { key: 'roadClass', label: 'Road class' },
  { key: 'energy_label', label: 'Energy label' },
  { key: 'sap_score', label: 'SAP score' }, // gitleaks:allow -- public property identifier
  { key: 'distanceMeters', label: 'Distance meters' },
  { key: 'provider', label: 'Provider' },
  { key: 'baseline_energy_kwh', label: 'Baseline energy' },
  { key: 'simulated_energy_kwh', label: 'Simulated energy' },
  { key: 'energy_delta_kwh', label: 'Energy delta' },
  { key: 'baseline_co2_kg', label: 'Baseline CO2' },
  { key: 'simulated_co2_kg', label: 'Simulated CO2' }, // gitleaks:allow -- public property identifier
  { key: 'co2_delta_kg', label: 'CO2 delta' },
  { key: 'scenarioKind', label: 'Scenario kind' },
  { key: 'authorityStatus', label: 'Authority status' },
]

const FEATURE_LIMIT_BY_VIEWER = {
  map: 0,
  '3d': 0,
  immersive: 12000,
}

export function formatFragmentCount(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number.toLocaleString('en-US') : '0'
}

export function compactFragmentLabel(value, fallback = 'Answer', limit = 38) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  return text.length > limit ? `${text.slice(0, limit - 1).trim()}...` : text
}

export function fragmentDateLabel(value) {
  const time = Date.parse(value || '')
  if (!Number.isFinite(time)) return ''
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(time))
}

function hashText(value) {
  const text = String(value ?? '')
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

function colorForValue(value) {
  if (value == null || value === '') return '#6f7480'
  return VALUE_PALETTE[hashText(value) % VALUE_PALETTE.length]
}

function numericColor(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '#6f7480'
  const spread = Math.max(1, Number(max) - Number(min))
  const position = Math.min(1, Math.max(0, (number - min) / spread))
  if (position < 0.2) return '#2374ab'
  if (position < 0.4) return '#149b86'
  if (position < 0.6) return '#73a942'
  if (position < 0.8) return '#d69f21'
  return '#c44536'
}

function propertyValue(properties = {}, key = '') {
  if (!key) return undefined
  if (Object.prototype.hasOwnProperty.call(properties, key)) return properties[key]
  const snake = key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)
  if (Object.prototype.hasOwnProperty.call(properties, snake)) return properties[snake]
  const camel = key.replace(/[_-]([a-z])/g, (_, match) => match.toUpperCase())
  if (Object.prototype.hasOwnProperty.call(properties, camel)) return properties[camel]
  return undefined
}

function normalizeFragmentQuery(query = {}, { source = 'fragment-workspace', viewerId = 'map', surface = 'map', intent = 'analysis' } = {}) {
  const render = query.render && typeof query.render === 'object' ? query.render : {}
  const metadata = query.metadata && typeof query.metadata === 'object' ? query.metadata : {}
  const transport = transportForViewer(viewerId)
  return {
    ...query,
    render: {
      ...render,
      mode: render.mode === 'count' ? 'isolate' : render.mode || 'isolate',
      transport,
      maxFeatures: FEATURE_LIMIT_BY_VIEWER[viewerId] || FEATURE_LIMIT_BY_VIEWER.map,
    },
    surface,
    intent,
    metadata: {
      ...metadata,
      source,
      previousSource: metadata.source || null,
      previousTransport: render.transport || null,
      transportBoundary: 'visual-fragment-workspace-native',
    },
  }
}

export function fragmentFromSelection(selection = {}, index = 0) {
  const query = analysisSelectionSourceQuery(selection)
  if (!query) return null
  const id = selection.id || selection.selectionGroupKey || selection.queryHash || `saved-fragment-${index + 1}`
  return {
    id,
    color: selection.style?.color || FRAGMENT_PALETTE[index % FRAGMENT_PALETTE.length],
    countLabel: analysisSelectionCountLabel(selection),
    query,
    queryHash: selection.queryHash || '',
    source: 'analysis-selection',
    selectionSetId: selection.id,
    title: analysisSelectionLabel(selection),
    updatedAt: selection.updatedAt || selection.createdAt || '',
    worldKind: 'selection-snapshot',
  }
}

export function fragmentFromSimulationWorld(world = {}, index = 0) {
  if (!world.id) return null
  return {
    id: `simulation-${world.id}`,
    color: FRAGMENT_PALETTE[(index + 2) % FRAGMENT_PALETTE.length],
    countLabel: formatFragmentCount(world.entityCount),
    modelKey: world.modelKey,
    scenarioKind: world.scenarioKind,
    simulationRunId: world.id,
    source: 'simulation-world',
    title: world.title || `${world.modelName || world.modelKey || 'Simulation'} / ${world.scenarioKind || 'world'}`,
    updatedAt: world.generatedAt || world.finishedAt || world.startedAt || '',
    worldKind: 'simulation',
  }
}

export function fragmentFromQueryResult(queryResult = null) {
  if (!queryResult?.query) return null
  const resultCount = Number(queryResult.resultCount ?? queryResult.summary?.resultCount ?? queryResult.returned ?? 0)
  return {
    id: 'current-query',
    color: FRAGMENT_PALETTE[0],
    countLabel: `${formatFragmentCount(resultCount)}${queryResult.truncated ? '+' : ''}`,
    query: queryResult.query,
    queryHash: queryResult.queryHash || queryResult.summary?.queryHash || '',
    source: 'current-query',
    title: 'Current query',
    updatedAt: '',
  }
}

export function fragmentOptionsFromQueryState({
  queryResult = null,
  querySelections = { selections: [] },
  simulationWorlds = [],
} = {}) {
  const current = fragmentFromQueryResult(queryResult)
  const simulations = (Array.isArray(simulationWorlds) ? simulationWorlds : [])
    .map(fragmentFromSimulationWorld)
    .filter(Boolean)
  const saved = groupAnalysisSelections(querySelections.selections || [])
    .map(fragmentFromSelection)
    .filter(Boolean)
  return current ? [current, ...simulations, ...saved] : [...simulations, ...saved]
}

export function buildFragmentQueryRequest(fragment = {}, options = {}) {
  return normalizeFragmentQuery(fragment.query || {}, {
    ...options,
    source: fragment.source === 'current-query'
      ? 'visual-fragment-workspace-current-query'
      : 'visual-fragment-workspace-saved-selection',
  })
}

export function enrichFragmentGeojson({
  colorBy = '__fragment',
  fragment = {},
  geojson,
  index = 0,
  numericRange = null,
} = {}) {
  const normalized = normalizeSemanticQueryGeojson(geojson)
  const fragmentColor = fragment.color || FRAGMENT_PALETTE[index % FRAGMENT_PALETTE.length]
  return {
    type: 'FeatureCollection',
    features: (normalized.features || []).map((feature) => {
      const properties = feature.properties || {}
      const rawValue = colorBy === '__fragment' ? fragment.title : propertyValue(properties, colorBy)
      const numeric = Number(rawValue)
      const nextColor = colorBy === '__fragment'
        ? fragmentColor
        : Number.isFinite(numeric) && numericRange
          ? numericColor(numeric, numericRange.min, numericRange.max)
          : colorForValue(rawValue)
      return {
        ...feature,
        properties: {
          ...properties,
          __fragmentColor: nextColor,
          __fragmentId: fragment.id,
          __fragmentIndex: index,
          __fragmentTitle: fragment.title,
          __fragmentValue: rawValue == null ? '' : String(rawValue),
        },
      }
    }),
  }
}

export function numericRangeForResults(results = [], colorBy = '__fragment') {
  if (!colorBy || colorBy === '__fragment') return null
  const values = []
  results.forEach((entry) => {
    ;(entry.rawGeojson?.features || []).forEach((feature) => {
      const value = Number(propertyValue(feature.properties || {}, colorBy))
      if (Number.isFinite(value)) values.push(value)
    })
  })
  if (!values.length) return null
  return { min: Math.min(...values), max: Math.max(...values) }
}

function countResultFeatures(entry = {}) {
  const summary = entry.summary || {}
  const geojsonCount = Number(entry.geojson?.features?.length ?? entry.rawGeojson?.features?.length ?? 0)
  if (geojsonCount > 0) return geojsonCount
  const primitiveCount = Number(entry.primitives?.features?.length ?? 0)
  if (primitiveCount > 0) return primitiveCount
  const sceneCount = Number(entry.sceneManifest?.objects?.length ?? 0)
  if (sceneCount > 0) return sceneCount
  return Number(summary.returned ?? summary.resultCount ?? 0)
}

function normalizeBounds(bounds = null) {
  const minLon = Number(bounds?.minLon ?? bounds?.west ?? bounds?.[0])
  const minLat = Number(bounds?.minLat ?? bounds?.south ?? bounds?.[1])
  const maxLon = Number(bounds?.maxLon ?? bounds?.east ?? bounds?.[2])
  const maxLat = Number(bounds?.maxLat ?? bounds?.north ?? bounds?.[3])
  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) return null
  return {
    minLon: Math.min(minLon, maxLon),
    minLat: Math.min(minLat, maxLat),
    maxLon: Math.max(minLon, maxLon),
    maxLat: Math.max(minLat, maxLat),
  }
}

function expandBounds(current = null, next = null) {
  const bounds = normalizeBounds(next)
  if (!bounds) return current
  if (!current) return bounds
  return {
    minLon: Math.min(current.minLon, bounds.minLon),
    minLat: Math.min(current.minLat, bounds.minLat),
    maxLon: Math.max(current.maxLon, bounds.maxLon),
    maxLat: Math.max(current.maxLat, bounds.maxLat),
  }
}

export function combineFragmentGeojson(results = []) {
  const features = results.flatMap((entry) => entry.geojson?.features || [])
  return features.length ? { type: 'FeatureCollection', features } : null
}

export function fragmentWorkspaceSummary(results = []) {
  const rendered = results.reduce((sum, entry) => sum + countResultFeatures(entry), 0)
  const total = results.reduce((sum, entry) => sum + Number(entry.summary?.resultCount ?? entry.summary?.returned ?? countResultFeatures(entry)), 0)
  const truncated = results.some((entry) => Boolean(entry.summary?.truncated || entry.summary?.transportPolicy?.warning))
  const bounds = results.reduce((current, entry) => expandBounds(current, entry.summary?.bounds), null)
  return {
    bounds,
    fragmentCount: results.length,
    rendered,
    total,
    truncated,
  }
}
