'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart2,
  Box,
  Check,
  Eye,
  EyeOff,
  Grid,
  Layers,
  Map as MapIcon,
  Maximize2,
  RefreshCw,
  Sliders,
  X,
} from 'react-feather'
import { usePlatformContext } from '@/context/PlatformContext'
import { normalizeSemanticQueryGeojson } from './semanticQueryClient'
import {
  analysisSelectionCountLabel,
  analysisSelectionLabel,
  analysisSelectionSourceQuery,
  groupAnalysisSelections,
} from './query/querySelectionModel'
import {
  clearQueryPassport,
  readQueryPassport,
} from './query/queryPassportModel'

const FRAGMENT_PALETTE = [
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

const INTERNAL_PROPERTY_PREFIX = '__'
const DEFAULT_CENTER = [-101.2574, 21.019]
const DEFAULT_ZOOM = 11
const CANVAS_DIRECT_FEATURE_PREVIEW_LIMIT = 50000
const CANVAS_TILE_SOURCE_LAYER = 'features'
const CANVAS_FALLBACK_SOURCE_ID = 'fragment-data'
const CANVAS_FALLBACK_LAYER_IDS = [
  'fragment-fill',
  'fragment-extrusion',
  'fragment-line',
  'fragment-outline',
  'fragment-points',
]

function formatCount(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number.toLocaleString('en-US') : '0'
}

function compactText(value, fallback = 'Answer', limit = 48) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  return text.length > limit ? `${text.slice(0, limit - 1).trim()}...` : text
}

function dateLabel(value) {
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

function humanizeKey(value) {
  return String(value || '')
    .replace(/^_+|_+$/g, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (match) => match.toUpperCase())
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

function numericProperty(properties = {}, keys = []) {
  for (const key of keys) {
    const value = Number(String(propertyValue(properties, key) ?? '').replace(/[^0-9.+-]+/g, ''))
    if (Number.isFinite(value)) return value
  }
  return null
}

function heightMetersForFeature(feature = {}) {
  const properties = feature.properties || {}
  const explicit = numericProperty(properties, [
    'heightMeters',
    'height_meters',
    'height_m',
    'height',
    'building:height',
  ])
  if (explicit != null) return Math.max(1, explicit)
  const floors = numericProperty(properties, ['floors', 'levels', 'building:levels', 'estimated_floors'])
  if (floors != null) return Math.max(2, floors * 3.2)
  const semanticClass = String(properties.semanticClass || properties.semantic_class || '').toLowerCase()
  return semanticClass.includes('building') ? 9 : 2
}

function normalizeFragment(selection = {}, index = 0) {
  const query = analysisSelectionSourceQuery(selection)
  if (!query) return null
  const id = selection.id || selection.selectionGroupKey || selection.queryHash || `fragment-${index + 1}`
  return {
    id,
    color: selection.style?.color || FRAGMENT_PALETTE[index % FRAGMENT_PALETTE.length],
    countLabel: analysisSelectionCountLabel(selection),
    query,
    queryHash: selection.queryHash || '',
    selectionSetId: selection.id,
    semanticClasses: Array.isArray(selection.semanticClasses) ? selection.semanticClasses : [],
    source: 'analysis-selection',
    title: analysisSelectionLabel(selection),
    updatedAt: selection.updatedAt || selection.createdAt || '',
    worldKind: 'selection-snapshot',
  }
}

function normalizeSimulationWorld(world = {}, index = 0) {
  if (!world.id) return null
  return {
    id: `simulation-${world.id}`,
    color: FRAGMENT_PALETTE[(index + 2) % FRAGMENT_PALETTE.length],
    countLabel: formatCount(world.entityCount),
    modelKey: world.modelKey,
    workflowRunId: world.workflowRunId || null,
    authorityStatuses: Array.isArray(world.authorityStatuses) ? world.authorityStatuses : [],
    parameters: world.parameters && typeof world.parameters === 'object' ? world.parameters : {},
    query: null,
    queryHash: '',
    scenarioKind: world.scenarioKind,
    semanticClasses: ['buildings'],
    simulationRunId: world.id,
    source: 'simulation-world',
    title: world.title || `${world.modelName || world.modelKey || 'Simulation'} / ${world.scenarioKind || 'world'}`,
    updatedAt: world.generatedAt || world.finishedAt || world.startedAt || '',
    generatedAt: world.generatedAt || world.finishedAt || world.startedAt || '',
    worldKind: 'simulation',
  }
}

function defaultActiveFragmentIds(fragments = [], passportFragment = null) {
  const simulations = fragments.filter((fragment) => fragment.worldKind === 'simulation')
  const newest = simulations[0]
  const sameWorkflow = newest?.workflowRunId
    ? simulations.filter((fragment) => fragment.workflowRunId === newest.workflowRunId)
    : simulations.filter((fragment) => fragment.modelKey && fragment.modelKey === newest?.modelKey)
  const pair = (sameWorkflow.length >= 2 ? sameWorkflow : simulations).slice(0, 2)
  const baseIds = pair.length ? pair.map((fragment) => fragment.id) : fragments.slice(0, 2).map((fragment) => fragment.id)
  return passportFragment
    ? [passportFragment.id, ...baseIds.filter((id) => id !== passportFragment.id)].slice(0, 3)
    : baseIds
}

function fragmentMetaLabel(fragment = {}) {
  const dated = fragment.updatedAt ? dateLabel(fragment.updatedAt) : ''
  if (fragment.worldKind === 'simulation') {
    const authority = fragment.authorityStatuses?.[0] || 'simulated'
    return [fragment.scenarioKind || 'simulation', authority, dated].filter(Boolean).join(' / ')
  }
  if (fragment.worldKind === 'selection-snapshot') return ['saved snapshot', dated].filter(Boolean).join(' / ')
  return ['current query', dated].filter(Boolean).join(' / ')
}

function queryClasses(query = {}) {
  if (Array.isArray(query.classes)) return query.classes.filter(Boolean)
  if (Array.isArray(query.clauses)) {
    return query.clauses.map((clause) => clause.classKey).filter(Boolean)
  }
  return []
}

function normalizePassportFragment(passport = {}) {
  const query = passport.query
  if (!query || typeof query !== 'object') return null
  const count = Number(passport.queryResult?.resultCount ?? passport.queryResult?.summary?.resultCount ?? 0)
  const classes = queryClasses(query)
  const source = passport.sourceViewer === '3d'
    ? 'City 3D'
    : passport.sourceViewer === 'immersive'
      ? 'Civic XR'
      : 'Analytical Map'
  return {
    id: `passport-${passport.id || Date.now()}`,
    color: '#111827',
    countLabel: count > 0 ? formatCount(count) : 'working',
    query,
    queryHash: passport.queryResult?.queryHash || query.metadata?.queryHash || '',
    semanticClasses: classes,
    source: 'query-passport',
    title: `${source} current query`,
    updatedAt: passport.createdAt || '',
    worldKind: 'live-query',
  }
}

function normalizeQueryForVisualizer(query = {}) {
  const render = query.render && typeof query.render === 'object' ? query.render : {}
  const metadata = query.metadata && typeof query.metadata === 'object' ? query.metadata : {}
  return {
    ...query,
    render: {
      ...render,
      mode: render.mode === 'count' ? 'isolate' : render.mode || 'isolate',
      transport: 'mvt',
      maxFeatures: 0,
    },
    surface: 'fragment-visualizer',
    intent: 'analysis',
    metadata: {
      ...metadata,
      source: 'fragment-visualizer',
      previousSource: metadata.source || null,
      previousTransport: render.transport || null,
      directFeaturePreviewMaxFeatures: CANVAS_DIRECT_FEATURE_PREVIEW_LIMIT,
    },
  }
}

function emptyFeatureCollection() {
  return { type: 'FeatureCollection', features: [] }
}

function hasFeatureCollection(collection = null) {
  return Array.isArray(collection?.features) && collection.features.length > 0
}

function walkCoordinates(geometry, callback) {
  if (!geometry?.coordinates) return
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

function boundsForGeojson(geojson = emptyFeatureCollection()) {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  ;(geojson.features || []).forEach((feature) => {
    walkCoordinates(feature.geometry, ([lon, lat]) => {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return
      minLon = Math.min(minLon, lon)
      minLat = Math.min(minLat, lat)
      maxLon = Math.max(maxLon, lon)
      maxLat = Math.max(maxLat, lat)
    })
  })
  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) return null
  return [[minLon, minLat], [maxLon, maxLat]]
}

function boundsForSummary(summary = {}) {
  const bounds = summary?.bounds
  if (!bounds || typeof bounds !== 'object') return null
  const minLon = Number(bounds.minLon)
  const minLat = Number(bounds.minLat)
  const maxLon = Number(bounds.maxLon)
  const maxLat = Number(bounds.maxLat)
  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) return null
  return [[minLon, minLat], [maxLon, maxLat]]
}

function mergeBounds(left, right) {
  if (!left) return right
  if (!right) return left
  return [
    [Math.min(left[0][0], right[0][0]), Math.min(left[0][1], right[0][1])],
    [Math.max(left[1][0], right[1][0]), Math.max(left[1][1], right[1][1])],
  ]
}

function boundsForTileEntries(entries = []) {
  return entries.reduce((bounds, entry) => mergeBounds(bounds, boundsForSummary(entry.result?.summary)), null)
}

function hasTileTransport(result = {}) {
  return Boolean(result?.links?.vectorTileTemplate || result?.vectorTileTemplate)
}

function tileTemplateForResult(result = {}) {
  return String(result?.links?.vectorTileTemplate || result?.vectorTileTemplate || '')
}

function safeMapId(value) {
  return String(value || 'answer')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'answer'
}

function tileColorExpression(colorBy, fallbackColor) {
  const fallback = fallbackColor || '#111827'
  if (colorBy === 'semanticClass') {
    return [
      'match',
      ['coalesce', ['get', 'semanticClass'], ['get', 'semantic_class'], ''],
      'buildings', '#256f48',
      'builtFabric', '#256f48',
      'roads', '#007c89',
      'mobilityNetwork', '#007c89',
      'greenBlue', '#73a942',
      'civicServices', '#355fc8',
      'places', '#c57c17',
      fallback,
    ]
  }
  if (colorBy === 'layerKey') {
    return [
      'match',
      ['coalesce', ['get', 'layerKey'], ['get', 'layer_key'], ['get', 'display_layer_key'], ''],
      'buildings', '#256f48',
      'roads', '#007c89',
      'greenBlue', '#73a942',
      'civic', '#355fc8',
      'places', '#c57c17',
      fallback,
    ]
  }
  return fallback
}

function propertyOptionsFromResults(results = []) {
  const preferred = [
    'semanticClass',
    'layerKey',
    'buildingType',
    'height_m',
    'floors',
    'sap_score',
    'energy_label',
    'roadClass',
    'category',
    'place_type',
    'provider',
    'sourceCoverageStatus',
    'authorityStatus',
  ]
  const counts = new Map()
  results.forEach((entry) => {
    ;(entry.result?.geojson?.features || []).forEach((feature) => {
      Object.entries(feature.properties || {}).forEach(([key, value]) => {
        if (!key || key.startsWith(INTERNAL_PROPERTY_PREFIX)) return
        if (value == null || typeof value === 'object') return
        counts.set(key, (counts.get(key) || 0) + 1)
      })
    })
  })
  const keys = Array.from(counts.keys()).sort((left, right) => {
    const leftPreferred = preferred.indexOf(left)
    const rightPreferred = preferred.indexOf(right)
    if (leftPreferred !== -1 || rightPreferred !== -1) {
      return (leftPreferred === -1 ? 999 : leftPreferred) - (rightPreferred === -1 ? 999 : rightPreferred)
    }
    return (counts.get(right) || 0) - (counts.get(left) || 0) || left.localeCompare(right)
  })
  return [
    { key: '__fragment', label: 'Answer' },
    ...keys.slice(0, 22).map((key) => ({ key, label: humanizeKey(key) })),
  ]
}

function numericDomainForProperty(results = [], colorBy = '') {
  if (!colorBy || colorBy === '__fragment') return null
  let min = Infinity
  let max = -Infinity
  let count = 0
  results.forEach((entry) => {
    ;(entry.result?.geojson?.features || []).forEach((feature) => {
      const value = Number(propertyValue(feature.properties || {}, colorBy))
      if (!Number.isFinite(value)) return
      min = Math.min(min, value)
      max = Math.max(max, value)
      count += 1
    })
  })
  return count ? { min, max } : null
}

function buildFeatureCollection(results = [], colorBy = '__fragment') {
  const numericDomain = numericDomainForProperty(results, colorBy)
  const features = results.flatMap((entry) => {
    const fragment = entry.fragment
    return (entry.result?.geojson?.features || []).map((feature) => {
      const properties = feature.properties || {}
      const rawValue = colorBy === '__fragment' ? fragment.id : propertyValue(properties, colorBy)
      const styleColor = colorBy === '__fragment'
        ? fragment.color
        : numericDomain
          ? numericColor(rawValue, numericDomain.min, numericDomain.max)
          : colorForValue(rawValue)
      return {
        ...feature,
        properties: {
          ...properties,
          __fragmentId: fragment.id,
          __fragmentTitle: fragment.title,
          __fragmentColor: fragment.color,
          __styleColor: styleColor,
          __styleValue: rawValue == null || rawValue === '' ? 'No value' : String(rawValue),
          __heightMeters: heightMetersForFeature(feature),
        },
      }
    })
  })
  return { type: 'FeatureCollection', features }
}

function featureIdentity(feature = {}) {
  const properties = feature.properties || {}
  return String(
    properties.objectId
    || properties.object_id
    || properties.stableId
    || properties.stable_id
    || feature.id
    || '',
  )
}

function semanticCountsForFeatures(features = []) {
  return features.reduce((counts, feature) => {
    const properties = feature.properties || {}
    const key = properties.semanticClass || properties.semantic_class || 'cityObject'
    counts[key] = Number(counts[key] || 0) + 1
    return counts
  }, {})
}

function resultWithFeatures(entry = {}, features = [], summaryExtra = {}) {
  const sourceSummary = entry.result?.summary || {}
  return {
    ...entry,
    result: {
      ...entry.result,
      geojson: { type: 'FeatureCollection', features },
      summary: {
        ...sourceSummary,
        sourceResultCount: Number(sourceSummary.sourceResultCount ?? sourceSummary.resultCount ?? features.length),
        resultCount: features.length,
        returned: features.length,
        countsBySemanticClass: semanticCountsForFeatures(features),
        truncated: false,
        ...summaryExtra,
      },
    },
  }
}

function applySelectionMask(results = [], enabled = false) {
  if (!enabled) return results
  const referenceIds = new Set(
    results
      .filter((entry) => entry.fragment.worldKind !== 'simulation')
      .flatMap((entry) => entry.result?.geojson?.features || [])
      .map(featureIdentity)
      .filter(Boolean),
  )
  if (!referenceIds.size) return results
  return results.map((entry) => {
    if (entry.fragment.worldKind !== 'simulation') return entry
    const features = (entry.result?.geojson?.features || []).filter((feature) => referenceIds.has(featureIdentity(feature)))
    return resultWithFeatures(entry, features, { selectionMaskCount: referenceIds.size })
  })
}

const WORLD_FILTER_OPERATORS = [
  { key: 'gte', label: '>=' },
  { key: 'gt', label: '>' },
  { key: 'lte', label: '<=' },
  { key: 'lt', label: '<' },
  { key: 'eq', label: '=' },
]

function numericWorldPropertyOptions(results = []) {
  const counts = new Map()
  results
    .filter((entry) => entry.fragment.worldKind === 'simulation')
    .forEach((entry) => {
      ;(entry.result?.geojson?.features || []).forEach((feature) => {
        Object.entries(feature.properties || {}).forEach(([key, value]) => {
          if (!key || key.startsWith(INTERNAL_PROPERTY_PREFIX) || !Number.isFinite(Number(value))) return
          counts.set(key, (counts.get(key) || 0) + 1)
        })
      })
    })
  return Array.from(counts.keys())
    .sort((left, right) => (counts.get(right) || 0) - (counts.get(left) || 0) || left.localeCompare(right))
    .map((key) => ({ key, label: humanizeKey(key) }))
}

function numericFilterMatches(value, operator, threshold) {
  const number = Number(value)
  if (!Number.isFinite(number)) return false
  if (operator === 'gt') return number > threshold
  if (operator === 'lte') return number <= threshold
  if (operator === 'lt') return number < threshold
  if (operator === 'eq') return number === threshold
  return number >= threshold
}

function applyWorldOutputFilter(results = [], filter = {}) {
  const threshold = Number(filter.value)
  if (!filter.field || !Number.isFinite(threshold)) return results
  return results.map((entry) => {
    if (entry.fragment.worldKind !== 'simulation') return entry
    const features = (entry.result?.geojson?.features || []).filter((feature) => (
      numericFilterMatches(propertyValue(feature.properties || {}, filter.field), filter.operator, threshold)
    ))
    return resultWithFeatures(entry, features, {
      worldFilter: { field: filter.field, operator: filter.operator, value: threshold },
    })
  })
}

function pairedSimulationResults(results = []) {
  const simulations = results.filter((entry) => entry.fragment.worldKind === 'simulation')
  const baseline = simulations.find((entry) => entry.fragment.scenarioKind === 'baseline')
  const intervention = simulations.find((entry) => entry.fragment.scenarioKind === 'intervention')
  if (baseline && intervention) return [baseline, intervention]
  return simulations.slice(0, 2)
}

function deltaColor(value, maxAbsolute) {
  const number = Number(value)
  if (!Number.isFinite(number) || Math.abs(number) < 1e-9) return '#6f7480'
  const ratio = Math.min(1, Math.abs(number) / Math.max(1e-9, maxAbsolute))
  if (number < 0) return ratio > 0.66 ? '#14795b' : ratio > 0.33 ? '#2f9c72' : '#79bea0'
  return ratio > 0.66 ? '#b63c32' : ratio > 0.33 ? '#d7654f' : '#e9a08b'
}

function buildDeltaWorld(results = [], metric = '') {
  const pair = pairedSimulationResults(results)
  if (pair.length !== 2 || !metric) {
    return { featureCollection: emptyFeatureCollection(), pair, summary: null }
  }
  const [baseline, intervention] = pair
  const baselineById = new Map(
    (baseline.result?.geojson?.features || []).map((feature) => [featureIdentity(feature), feature]),
  )
  const rows = (intervention.result?.geojson?.features || []).map((feature) => {
    const identity = featureIdentity(feature)
    const baselineFeature = baselineById.get(identity)
    const baselineValue = Number(propertyValue(baselineFeature?.properties || {}, metric))
    const interventionValue = Number(propertyValue(feature.properties || {}, metric))
    if (!baselineFeature || !Number.isFinite(baselineValue) || !Number.isFinite(interventionValue)) return null
    return { feature, baselineValue, interventionValue, delta: interventionValue - baselineValue }
  }).filter(Boolean)
  const maxAbsolute = Math.max(1e-9, ...rows.map((row) => Math.abs(row.delta)))
  const features = rows.map(({ feature, baselineValue, interventionValue, delta }) => ({
    ...feature,
    properties: {
      ...(feature.properties || {}),
      __baselineValue: baselineValue,
      __interventionValue: interventionValue,
      __deltaValue: delta,
      __fragmentId: `delta-${baseline.fragment.id}-${intervention.fragment.id}`,
      __fragmentTitle: `${humanizeKey(metric)} delta`,
      __styleColor: deltaColor(delta, maxAbsolute),
      __styleValue: `${delta > 0 ? '+' : ''}${delta.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
    },
  }))
  const deltas = rows.map((row) => row.delta)
  return {
    pair,
    featureCollection: { type: 'FeatureCollection', features },
    summary: {
      count: deltas.length,
      decreased: deltas.filter((value) => value < 0).length,
      unchanged: deltas.filter((value) => Math.abs(value) < 1e-9).length,
      increased: deltas.filter((value) => value > 0).length,
      average: deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : 0,
      min: deltas.length ? Math.min(...deltas) : 0,
      max: deltas.length ? Math.max(...deltas) : 0,
    },
  }
}

function summaryRows(results = []) {
  return results.map((entry) => {
    const summary = entry.result?.summary || {}
    const tileTransport = hasTileTransport(entry.result)
    const returned = tileTransport
      ? Number(summary.resultCount ?? summary.returned ?? 0)
      : Number(summary.returned ?? entry.result?.geojson?.features?.length ?? 0)
    const total = Number(summary.resultCount ?? returned)
    return {
      color: entry.fragment.color,
      id: entry.fragment.id,
      label: entry.fragment.title,
      returned,
      total,
      truncated: Boolean(!tileTransport && summary.truncated),
    }
  })
}

function semanticRows(results = []) {
  const counts = new Map()
  results.forEach((entry) => {
    const summaryCounts = entry.result?.summary?.countsBySemanticClass
    if (summaryCounts && typeof summaryCounts === 'object' && Object.keys(summaryCounts).length) {
      Object.entries(summaryCounts).forEach(([key, value]) => {
        counts.set(key, (counts.get(key) || 0) + Number(value || 0))
      })
      return
    }
    ;(entry.result?.geojson?.features || []).forEach((feature) => {
      const key = feature.properties?.semanticClass || feature.properties?.semantic_class || 'cityObject'
      counts.set(key, (counts.get(key) || 0) + 1)
    })
  })
  return Array.from(counts.entries())
    .map(([key, value]) => ({ key, value }))
    .sort((left, right) => right.value - left.value)
}

function MapSurface({ colorBy, featureCollection, fragments = [], height = '100%', opacity = 0.74, results = [], selectedFeature, setSelectedFeature, viewMode = 'flat' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const maplibreRef = useRef(null)
  const mapReadyRef = useRef(false)
  const tileEntries = useMemo(
    () => results.filter((entry) => hasTileTransport(entry.result)),
    [results],
  )
  const tileLayerIdsRef = useRef([])
  const tileSourceIdsRef = useRef([])

  const removeTileSources = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    tileLayerIdsRef.current.forEach((layerId) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
    })
    tileSourceIdsRef.current.forEach((sourceId) => {
      if (map.getSource(sourceId)) map.removeSource(sourceId)
    })
    tileLayerIdsRef.current = []
    tileSourceIdsRef.current = []
  }, [])

  const removeFallbackSource = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    CANVAS_FALLBACK_LAYER_IDS.forEach((layerId) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
    })
    if (map.getSource(CANVAS_FALLBACK_SOURCE_ID)) map.removeSource(CANVAS_FALLBACK_SOURCE_ID)
  }, [])

  const installTileSources = useCallback(() => {
    const map = mapRef.current
    if (!map || !mapReadyRef.current) return
    removeTileSources()
    const polygonFilter = ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']]
    const lineFilter = ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']]
    const pointFilter = ['any', ['==', ['geometry-type'], 'Point'], ['==', ['geometry-type'], 'MultiPoint']]
    tileEntries.forEach((entry, index) => {
      const template = tileTemplateForResult(entry.result)
      if (!template) return
      const sourceId = `answer-tile-${index}-${safeMapId(entry.fragment.id)}`
      const colorExpression = tileColorExpression(colorBy, entry.fragment.color)
      map.addSource(sourceId, {
        type: 'vector',
        tiles: [template],
        minzoom: 0,
        maxzoom: 20,
      })
      tileSourceIdsRef.current.push(sourceId)
      const layerPrefix = `${sourceId}-`
      if (viewMode === 'extruded') {
        const layerId = `${layerPrefix}extrusion`
        map.addLayer({
          id: layerId,
          type: 'fill-extrusion',
          source: sourceId,
          'source-layer': CANVAS_TILE_SOURCE_LAYER,
          filter: polygonFilter,
          paint: {
            'fill-extrusion-color': colorExpression,
            'fill-extrusion-height': ['to-number', ['coalesce', ['get', 'heightMeters'], ['get', 'height_m'], ['get', 'height'], 8]],
            'fill-extrusion-opacity': Math.min(0.9, Math.max(0.1, opacity)),
            'fill-extrusion-base': 0,
          },
        })
        tileLayerIdsRef.current.push(layerId)
      } else {
        const layerId = `${layerPrefix}fill`
        map.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          'source-layer': CANVAS_TILE_SOURCE_LAYER,
          filter: polygonFilter,
          paint: {
            'fill-color': colorExpression,
            'fill-opacity': Math.min(0.86, Math.max(0.08, opacity)),
          },
        })
        tileLayerIdsRef.current.push(layerId)
      }
      const outlineId = `${layerPrefix}outline`
      map.addLayer({
        id: outlineId,
        type: 'line',
        source: sourceId,
        'source-layer': CANVAS_TILE_SOURCE_LAYER,
        filter: polygonFilter,
        paint: {
          'line-color': colorExpression,
          'line-opacity': 0.92,
          'line-width': viewMode === 'extruded' ? 0.8 : 1.15,
        },
      })
      tileLayerIdsRef.current.push(outlineId)
      const lineId = `${layerPrefix}line`
      map.addLayer({
        id: lineId,
        type: 'line',
        source: sourceId,
        'source-layer': CANVAS_TILE_SOURCE_LAYER,
        filter: lineFilter,
        paint: {
          'line-color': colorExpression,
          'line-opacity': 0.94,
          'line-width': viewMode === 'extruded' ? 3 : 2.25,
        },
      })
      tileLayerIdsRef.current.push(lineId)
      const pointId = `${layerPrefix}points`
      map.addLayer({
        id: pointId,
        type: 'circle',
        source: sourceId,
        'source-layer': CANVAS_TILE_SOURCE_LAYER,
        filter: pointFilter,
        paint: {
          'circle-color': colorExpression,
          'circle-opacity': 0.96,
          'circle-radius': viewMode === 'extruded' ? 5 : 4,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.25,
        },
      })
      tileLayerIdsRef.current.push(pointId)
    })
  }, [colorBy, opacity, removeTileSources, tileEntries, viewMode])

  const installLayers = useCallback(() => {
    const map = mapRef.current
    if (!map || !map.getSource(CANVAS_FALLBACK_SOURCE_ID)) return
    CANVAS_FALLBACK_LAYER_IDS.forEach((layerId) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
    })
    const polygonFilter = ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']]
    const lineFilter = ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']]
    const pointFilter = ['any', ['==', ['geometry-type'], 'Point'], ['==', ['geometry-type'], 'MultiPoint']]

    if (viewMode === 'extruded') {
      map.addLayer({
        id: 'fragment-extrusion',
        type: 'fill-extrusion',
        source: CANVAS_FALLBACK_SOURCE_ID,
        filter: polygonFilter,
        paint: {
          'fill-extrusion-color': ['get', '__styleColor'],
          'fill-extrusion-height': ['get', '__heightMeters'],
          'fill-extrusion-opacity': Math.min(0.9, Math.max(0.1, opacity)),
          'fill-extrusion-base': 0,
        },
      })
    } else {
      map.addLayer({
        id: 'fragment-fill',
        type: 'fill',
        source: CANVAS_FALLBACK_SOURCE_ID,
        filter: polygonFilter,
        paint: {
          'fill-color': ['get', '__styleColor'],
          'fill-opacity': Math.min(0.86, Math.max(0.08, opacity)),
        },
      })
    }

    map.addLayer({
      id: 'fragment-outline',
      type: 'line',
      source: CANVAS_FALLBACK_SOURCE_ID,
      filter: polygonFilter,
      paint: {
        'line-color': ['get', '__styleColor'],
        'line-opacity': 0.92,
        'line-width': viewMode === 'extruded' ? 0.8 : 1.15,
      },
    })
    map.addLayer({
      id: 'fragment-line',
      type: 'line',
      source: CANVAS_FALLBACK_SOURCE_ID,
      filter: lineFilter,
      paint: {
        'line-color': ['get', '__styleColor'],
        'line-opacity': 0.94,
        'line-width': viewMode === 'extruded' ? 3 : 2.25,
      },
    })
    map.addLayer({
      id: 'fragment-points',
      type: 'circle',
      source: CANVAS_FALLBACK_SOURCE_ID,
      filter: pointFilter,
      paint: {
        'circle-color': ['get', '__styleColor'],
        'circle-opacity': 0.96,
        'circle-radius': viewMode === 'extruded' ? 5 : 4,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.25,
      },
    })
  }, [opacity, viewMode])

  const latestFeatureCollectionRef = useRef(featureCollection)
  const installLayersRef = useRef(installLayers)
  const installTileSourcesRef = useRef(installTileSources)

  useEffect(() => {
    latestFeatureCollectionRef.current = featureCollection
  }, [featureCollection])

  useEffect(() => {
    installLayersRef.current = installLayers
  }, [installLayers])

  useEffect(() => {
    installTileSourcesRef.current = installTileSources
  }, [installTileSources])

  useEffect(() => {
    let disposed = false
    async function createMap() {
      if (!containerRef.current || mapRef.current) return
      const maplibreModule = await import('maplibre-gl')
      if (disposed) return
      const maplibregl = maplibreModule.default || maplibreModule
      maplibreRef.current = maplibregl
      const map = new maplibregl.Map({
        attributionControl: false,
        center: DEFAULT_CENTER,
        container: containerRef.current,
        pitch: 0,
        bearing: 0,
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: 'background',
              type: 'background',
              paint: { 'background-color': '#f7fafb' },
            },
          ],
        },
        zoom: DEFAULT_ZOOM,
      })
      mapRef.current = map
      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-left')
      map.on('load', () => {
        mapReadyRef.current = true
        const latestFeatures = latestFeatureCollectionRef.current || emptyFeatureCollection()
        if (hasFeatureCollection(latestFeatures)) {
          map.addSource(CANVAS_FALLBACK_SOURCE_ID, {
            type: 'geojson',
            data: latestFeatures,
          })
          installLayersRef.current()
        }
        installTileSourcesRef.current()
      })
      map.on('click', (event) => {
        const hits = map.queryRenderedFeatures(event.point, {
          layers: [
            'fragment-points',
            'fragment-line',
            'fragment-outline',
            'fragment-fill',
            'fragment-extrusion',
            ...tileLayerIdsRef.current,
          ].filter((layerId) => map.getLayer(layerId)),
        })
        if (hits[0]) setSelectedFeature?.(hits[0].properties || null)
      })
      map.on('mousemove', (event) => {
        const hits = map.queryRenderedFeatures(event.point, {
          layers: [
            'fragment-points',
            'fragment-line',
            'fragment-outline',
            'fragment-fill',
            'fragment-extrusion',
            ...tileLayerIdsRef.current,
          ].filter((layerId) => map.getLayer(layerId)),
        })
        map.getCanvas().style.cursor = hits.length ? 'pointer' : ''
      })
    }
    createMap()
    return () => {
      disposed = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        mapReadyRef.current = false
      }
    }
  }, [setSelectedFeature])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const applyLayers = () => {
      const fallbackFeatures = featureCollection || emptyFeatureCollection()
      if (!hasFeatureCollection(fallbackFeatures)) {
        removeFallbackSource()
        installTileSources()
        return
      }
      if (!map.getSource(CANVAS_FALLBACK_SOURCE_ID)) {
        map.addSource(CANVAS_FALLBACK_SOURCE_ID, {
          type: 'geojson',
          data: fallbackFeatures,
        })
        installLayers()
        installTileSources()
        return
      }
      map.getSource(CANVAS_FALLBACK_SOURCE_ID)?.setData(fallbackFeatures)
      installLayers()
      installTileSources()
    }
    if (!mapReadyRef.current) {
      map.once('load', applyLayers)
      return
    }
    applyLayers()
  }, [colorBy, featureCollection, installLayers, installTileSources, opacity, removeFallbackSource, viewMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const bounds = mergeBounds(boundsForGeojson(featureCollection), boundsForTileEntries(tileEntries))
    if (!bounds) return
    const timer = window.setTimeout(() => {
      map.fitBounds(bounds, {
        animate: false,
        maxZoom: viewMode === 'extruded' ? 15.5 : 16.5,
        padding: 54,
      })
      if (viewMode === 'extruded') {
        map.easeTo({ pitch: 54, bearing: -18, duration: 0 })
      } else {
        map.easeTo({ pitch: 0, bearing: 0, duration: 0 })
      }
    }, 80)
    return () => window.clearTimeout(timer)
  }, [featureCollection, tileEntries, viewMode])

  useEffect(() => {
    if (!containerRef.current || !mapRef.current || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => mapRef.current?.resize())
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="dt-fragment-map" style={{ height }}>
      <div className="dt-fragment-map__canvas" ref={containerRef} />
      <div className="dt-fragment-map__legend">
        {fragments.slice(0, 8).map((fragment) => (
          <span key={fragment.id}>
            <i style={{ background: fragment.color }} />
            {compactText(fragment.title, 'Answer', 22)}
          </span>
        ))}
      </div>
      {selectedFeature ? (
        <div className="dt-fragment-map__selection">
          <button aria-label="Clear selected object" onClick={() => setSelectedFeature?.(null)} type="button">
            <X size={13} />
          </button>
          <strong>{compactText(selectedFeature.label || selectedFeature.name || selectedFeature.objectId || selectedFeature.object_id || 'Selected object', 'Selected object', 54)}</strong>
          <span>{selectedFeature.__fragmentTitle || 'Answer'} / {selectedFeature.__styleValue || colorBy}</span>
        </div>
      ) : null}
    </div>
  )
}

function FragmentBar({ color = '#007c89', label, max = 1, value }) {
  const width = Math.max(3, Math.min(100, (Number(value || 0) / Math.max(1, Number(max || 1))) * 100))
  return (
    <div className="dt-fragment-viz-bar">
      <div>
        <span>{compactText(label, 'Item', 30)}</span>
        <strong>{formatCount(value)}</strong>
      </div>
      <i style={{ '--bar-color': color, width: `${width}%` }} />
    </div>
  )
}

function FragmentControlPanel({
  activeIds,
  colorBy,
  deltaMetric,
  deltaSummary,
  fragments,
  hidden,
  loading,
  maskAvailable,
  mode,
  numericFilterOptions,
  opacity,
  propertyOptions,
  refresh,
  results,
  selectionMaskEnabled,
  setActiveIds,
  setColorBy,
  setDeltaMetric,
  setHidden,
  setMode,
  setOpacity,
  setSelectionMaskEnabled,
  setViewMode,
  setWorldFilter,
  summary,
  viewMode,
  worldFilter,
}) {
  if (hidden) {
    return (
      <button className="dt-fragment-viz__panel-reopen" onClick={() => setHidden(false)} type="button">
        <Sliders size={15} />
        <span>Panel</span>
      </button>
    )
  }

  const activeCount = activeIds.length
  const runningCount = results.filter((entry) => entry.status === 'loading').length
  const maxFragmentValue = Math.max(1, ...summary.byFragment.map((row) => row.total || row.returned || 0))
  const maxSemanticValue = Math.max(1, ...summary.bySemantic.map((row) => row.value || 0))
  const visualPropertyOptions = mode === 'delta' ? numericFilterOptions : propertyOptions

  const toggleFragment = (fragmentId) => {
    setActiveIds((current) =>
      current.includes(fragmentId)
        ? current.filter((id) => id !== fragmentId)
        : [...current, fragmentId],
    )
  }

  return (
    <aside className="dt-fragment-viz-panel">
      <div className="dt-fragment-viz-panel__head">
        <div>
          <span>World compare</span>
          <strong>{activeCount ? `${activeCount} active` : 'Select worlds'}</strong>
        </div>
        <div>
          <button disabled={loading} onClick={refresh} title="Refresh answers" type="button">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setHidden(true)} title="Hide panel" type="button">
            <EyeOff size={14} />
          </button>
        </div>
      </div>

      <div className="dt-fragment-viz-panel__metrics">
        <span><strong>{formatCount(summary.totalFeatures)}</strong> features</span>
        <span><strong>{formatCount(summary.totalResultCount)}</strong> total</span>
        <span><strong>{runningCount}</strong> loading</span>
      </div>

      <div className="dt-fragment-viz-switch dt-fragment-viz-switch--three" aria-label="Visualizer mode">
        <button className={mode === 'overlay' ? 'is-active' : ''} onClick={() => setMode('overlay')} type="button">
          <Layers size={14} />
          <span>Overlay</span>
        </button>
        <button className={mode === 'compare' ? 'is-active' : ''} onClick={() => setMode('compare')} type="button">
          <Grid size={14} />
          <span>Compare</span>
        </button>
        <button className={mode === 'delta' ? 'is-active' : ''} onClick={() => setMode('delta')} type="button">
          <BarChart2 size={14} />
          <span>Delta</span>
        </button>
      </div>

      <div className="dt-fragment-viz-switch" aria-label="Spatial mode">
        <button className={viewMode === 'flat' ? 'is-active' : ''} onClick={() => setViewMode('flat')} type="button">
          <MapIcon size={14} />
          <span>2D</span>
        </button>
        <button className={viewMode === 'extruded' ? 'is-active' : ''} onClick={() => setViewMode('extruded')} type="button">
          <Box size={14} />
          <span>3D</span>
        </button>
      </div>

      <label className="dt-fragment-viz-field">
        <span>{mode === 'delta' ? 'Delta metric' : 'Color fill by'}</span>
        <select
          disabled={mode === 'delta' && !visualPropertyOptions.length}
          onChange={(event) => (mode === 'delta' ? setDeltaMetric(event.target.value) : setColorBy(event.target.value))}
          value={mode === 'delta' ? deltaMetric : colorBy}
        >
          {visualPropertyOptions.map((option) => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </select>
      </label>

      <div className="dt-fragment-viz-world-filter">
        <label className="dt-fragment-viz-world-filter__mask">
          <input
            checked={selectionMaskEnabled && maskAvailable}
            disabled={!maskAvailable}
            onChange={(event) => setSelectionMaskEnabled(event.target.checked)}
            type="checkbox"
          />
          <span>Selection mask</span>
        </label>
        <div className="dt-fragment-viz-world-filter__condition">
          <select
            aria-label="Simulation output"
            onChange={(event) => setWorldFilter((current) => ({ ...current, field: event.target.value }))}
            value={worldFilter.field}
          >
            <option value="">Simulation output</option>
            {numericFilterOptions.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
          <select
            aria-label="Simulation comparison operator"
            disabled={!worldFilter.field}
            onChange={(event) => setWorldFilter((current) => ({ ...current, operator: event.target.value }))}
            value={worldFilter.operator}
          >
            {WORLD_FILTER_OPERATORS.map((operator) => (
              <option key={operator.key} value={operator.key}>{operator.label}</option>
            ))}
          </select>
          <input
            aria-label="Simulation comparison value"
            disabled={!worldFilter.field}
            inputMode="decimal"
            onChange={(event) => setWorldFilter((current) => ({ ...current, value: event.target.value }))}
            placeholder="Value"
            type="number"
            value={worldFilter.value}
          />
        </div>
      </div>

      {mode === 'delta' && deltaSummary ? (
        <div className="dt-fragment-viz-delta-metrics">
          <span><strong>{formatCount(deltaSummary.decreased)}</strong> decreased</span>
          <span><strong>{formatCount(deltaSummary.unchanged)}</strong> unchanged</span>
          <span><strong>{formatCount(deltaSummary.increased)}</strong> increased</span>
        </div>
      ) : null}

      <label className="dt-fragment-viz-field">
        <span>Layer opacity</span>
        <input
          max="0.95"
          min="0.15"
          onChange={(event) => setOpacity(Number(event.target.value))}
          step="0.05"
          type="range"
          value={opacity}
        />
      </label>

      <div className="dt-fragment-viz-list">
        <div className="dt-fragment-viz-list__head">
          <span>Worlds and snapshots</span>
          <em>{formatCount(fragments.length)}</em>
        </div>
        {!fragments.length ? (
          <div className="dt-fragment-viz-empty">No saved query snapshots or simulation runs are available.</div>
        ) : null}
        {fragments.map((fragment) => {
          const result = results.find((entry) => entry.fragment.id === fragment.id)
          const active = activeIds.includes(fragment.id)
          return (
            <button
              className={active ? 'dt-fragment-viz-item is-active' : 'dt-fragment-viz-item'}
              key={fragment.id}
              onClick={() => toggleFragment(fragment.id)}
              type="button"
            >
              <i style={{ background: fragment.color }} />
              <span>
                <strong>{compactText(fragment.title, 'Saved world', 42)}</strong>
                <small>
                  {result?.status === 'error'
                    ? result.error
                    : `${fragment.countLabel} objects / ${fragmentMetaLabel(fragment)}`}
                </small>
              </span>
              {active ? <Check size={14} /> : <Eye size={14} />}
            </button>
          )
        })}
      </div>

      <div className="dt-fragment-viz-summary">
        <div className="dt-fragment-viz-summary__head">
          <BarChart2 size={14} />
          <span>Summary</span>
        </div>
        {summary.byFragment.slice(0, 8).map((row) => (
          <FragmentBar
            color={row.color}
            key={row.id}
            label={row.label}
            max={maxFragmentValue}
            value={row.total || row.returned}
          />
        ))}
        {summary.bySemantic.length ? (
          <div className="dt-fragment-viz-summary__head dt-fragment-viz-summary__head--sub">
            <span>Semantic classes</span>
          </div>
        ) : null}
        {summary.bySemantic.slice(0, 6).map((row) => (
          <FragmentBar
            color={colorForValue(row.key)}
            key={row.key}
            label={humanizeKey(row.key)}
            max={maxSemanticValue}
            value={row.value}
          />
        ))}
      </div>

    </aside>
  )
}

export default function FragmentVisualizerPage() {
  const { activeCityId } = usePlatformContext()
  const cityId = activeCityId ?? 'current'
  const queryPassportLoadedRef = useRef(false)
  const [libraryState, setLibraryState] = useState({ status: 'idle', fragments: [], error: '' })
  const [passportFragment, setPassportFragment] = useState(null)
  const [activeIds, setActiveIds] = useState([])
  const [resultState, setResultState] = useState({})
  const [mode, setMode] = useState('compare')
  const [viewMode, setViewMode] = useState('flat')
  const [colorBy, setColorBy] = useState('__fragment')
  const [deltaMetric, setDeltaMetric] = useState('')
  const [opacity, setOpacity] = useState(0.74)
  const [selectionMaskEnabled, setSelectionMaskEnabled] = useState(false)
  const [worldFilter, setWorldFilter] = useState({ field: '', operator: 'gte', value: '' })
  const [panelHidden, setPanelHidden] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState(null)

  useEffect(() => {
    if (queryPassportLoadedRef.current) return
    queryPassportLoadedRef.current = true
    const passport = readQueryPassport()
    if (!passport?.query || !['canvas', 'fragment-visualizer'].includes(passport.targetViewer)) return
    const fragment = normalizePassportFragment(passport)
    if (!fragment) return
    setPassportFragment(fragment)
    setActiveIds((current) => [fragment.id, ...current.filter((id) => id !== fragment.id)].slice(0, 4))
    clearQueryPassport(passport.id || '')
  }, [])

  const loadLibrary = useCallback(async () => {
    try {
      setLibraryState((current) => ({ ...current, status: 'loading', error: '' }))
      const [libraryResponse, simulationResponse] = await Promise.all([
        fetch(`/api/live/${encodeURIComponent(cityId)}/query-library?surface=map&limit=80`, {
          credentials: 'same-origin',
        }),
        fetch(`/api/live/${encodeURIComponent(cityId)}/simulation-worlds?limit=40`, {
          credentials: 'same-origin',
        }),
      ])
      const [libraryResult, simulationResult] = await Promise.all([
        libraryResponse.json(),
        simulationResponse.json(),
      ])
      if (!libraryResponse.ok || !libraryResult?.ok) {
        throw new Error(libraryResult?.error || libraryResult?.detail || `QUERY_LIBRARY_${libraryResponse.status}`)
      }
      if (!simulationResponse.ok || !simulationResult?.ok) {
        throw new Error(simulationResult?.error || simulationResult?.detail || `SIMULATION_WORLDS_${simulationResponse.status}`)
      }
      const selections = libraryResult.buckets?.analysisSelections?.items || []
      const simulationFragments = (simulationResult.worlds || [])
        .map(normalizeSimulationWorld)
        .filter(Boolean)
      const selectionFragments = groupAnalysisSelections(selections)
        .map(normalizeFragment)
        .filter(Boolean)
      const fragments = [...simulationFragments, ...selectionFragments]
      setLibraryState({ status: 'ready', fragments, error: '' })
      setActiveIds((current) => {
        const availableFragments = passportFragment
          ? [passportFragment, ...fragments.filter((fragment) => fragment.id !== passportFragment.id)]
          : fragments
        const valid = current.filter((id) =>
          availableFragments.some((fragment) => fragment.id === id) ||
          String(id).startsWith('passport-'),
        )
        const defaults = defaultActiveFragmentIds(availableFragments, passportFragment)
        if (passportFragment && valid.length === 1 && valid[0] === passportFragment.id) return defaults
        return valid.length ? valid : defaults
      })
    } catch (error) {
      setLibraryState({
        status: 'error',
        fragments: [],
        error: String(error?.message ?? 'FRAGMENT_LIBRARY_UNAVAILABLE'),
      })
    }
  }, [cityId, passportFragment])

  useEffect(() => {
    setResultState({})
    loadLibrary()
  }, [loadLibrary])

  const fragments = useMemo(
    () => (passportFragment
      ? [passportFragment, ...libraryState.fragments.filter((fragment) => fragment.id !== passportFragment.id)]
      : libraryState.fragments),
    [libraryState.fragments, passportFragment],
  )
  const activeFragments = useMemo(
    () => fragments.filter((fragment) => activeIds.includes(fragment.id)),
    [activeIds, fragments],
  )

  const runFragment = useCallback(async (fragment) => {
    setResultState((current) => ({
      ...current,
      [fragment.id]: {
        fragment,
        status: 'loading',
        result: null,
        error: '',
      },
    }))
    try {
      const worldEndpoint = fragment.simulationRunId
        ? `/api/live/${encodeURIComponent(cityId)}/simulation-worlds/${encodeURIComponent(fragment.simulationRunId)}/geojson`
        : fragment.selectionSetId
          ? `/api/live/${encodeURIComponent(cityId)}/analysis-selections/${encodeURIComponent(fragment.selectionSetId)}/geojson`
          : ''
      const response = worldEndpoint
        ? await fetch(worldEndpoint, { credentials: 'same-origin' })
        : await fetch(`/api/live/${encodeURIComponent(cityId)}/twin-query`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalizeQueryForVisualizer(fragment.query)),
        })
      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || result?.detail || `TWIN_QUERY_${response.status}`)
      }
      if (!result.geojson?.features && !hasTileTransport(result)) {
        throw new Error(result.transport === 'table' ? 'Answer returned table rows, not map geometry.' : 'Answer did not return map geometry or vector tiles.')
      }
      const geojson = result.geojson?.features
        ? normalizeSemanticQueryGeojson(result.geojson)
        : emptyFeatureCollection()
      setResultState((current) => ({
        ...current,
        [fragment.id]: {
          fragment,
          status: 'ready',
          result: {
            ...result,
            geojson,
          },
          error: '',
        },
      }))
    } catch (error) {
      setResultState((current) => ({
        ...current,
        [fragment.id]: {
          fragment,
          status: 'error',
          result: null,
          error: String(error?.message ?? 'FRAGMENT_QUERY_FAILED'),
        },
      }))
    }
  }, [cityId])

  useEffect(() => {
    activeFragments.forEach((fragment) => {
      const current = resultState[fragment.id]
      if (!current) runFragment(fragment)
    })
  }, [activeFragments, resultState, runFragment])

  const loadedResults = useMemo(
    () => activeFragments
      .map((fragment) => resultState[fragment.id])
      .filter((entry) => entry?.status === 'ready' && entry.result),
    [activeFragments, resultState],
  )

  const maskAvailable = useMemo(() => (
    loadedResults.some((entry) => entry.fragment.worldKind === 'simulation')
    && loadedResults.some((entry) => (
      entry.fragment.worldKind !== 'simulation'
      && (entry.result?.geojson?.features || []).length > 0
    ))
  ), [loadedResults])

  useEffect(() => {
    if (!maskAvailable && selectionMaskEnabled) setSelectionMaskEnabled(false)
  }, [maskAvailable, selectionMaskEnabled])

  const maskedResults = useMemo(
    () => applySelectionMask(loadedResults, selectionMaskEnabled && maskAvailable),
    [loadedResults, maskAvailable, selectionMaskEnabled],
  )

  const activeResults = useMemo(
    () => applyWorldOutputFilter(maskedResults, worldFilter),
    [maskedResults, worldFilter],
  )

  const allResultEntries = useMemo(
    () => activeFragments.map((fragment) => resultState[fragment.id] || { fragment, status: 'idle', result: null, error: '' }),
    [activeFragments, resultState],
  )

  const featureCollection = useMemo(
    () => buildFeatureCollection(activeResults, colorBy),
    [activeResults, colorBy],
  )

  const propertyOptions = useMemo(
    () => propertyOptionsFromResults(activeResults),
    [activeResults],
  )

  const numericFilterOptions = useMemo(
    () => numericWorldPropertyOptions(maskedResults),
    [maskedResults],
  )

  useEffect(() => {
    if (!propertyOptions.some((option) => option.key === colorBy)) setColorBy('__fragment')
  }, [colorBy, propertyOptions])

  useEffect(() => {
    const numericKeys = new Set(numericFilterOptions.map((option) => option.key))
    if (numericKeys.has(deltaMetric)) return
    const preferred = ['simulated_co2_kg', 'simulated_energy_kwh', 'co2_delta_kg', 'energy_delta_kwh']
      .find((key) => numericKeys.has(key))
    setDeltaMetric(preferred || numericFilterOptions[0]?.key || '')
  }, [deltaMetric, numericFilterOptions])

  const deltaWorld = useMemo(
    () => buildDeltaWorld(activeResults, deltaMetric),
    [activeResults, deltaMetric],
  )

  const summary = useMemo(() => {
    const byFragment = summaryRows(activeResults)
    return {
      byFragment,
      bySemantic: semanticRows(activeResults),
      totalFeatures: byFragment.reduce((sum, row) => sum + Number(row.returned || row.total || 0), 0),
      totalResultCount: byFragment.reduce((sum, row) => sum + Number(row.total || row.returned || 0), 0),
    }
  }, [activeResults])

  const loading = libraryState.status === 'loading'
  const hasActive = Boolean(activeFragments.length)

  return (
    <div className="hk-pg-body py-0">
      <main className="dt-fragment-viz">
        <section className="dt-fragment-viz-stage">
          <header className="dt-fragment-viz-topbar">
            <div>
              <span>World compare</span>
              <strong>{mode === 'overlay' ? 'Overlay workspace' : mode === 'delta' ? 'Delta workspace' : 'Compare workspace'}</strong>
            </div>
            <div className="dt-fragment-viz-topbar__actions">
              <button onClick={() => setPanelHidden((current) => !current)} type="button">
                <Maximize2 size={14} />
                <span>{panelHidden ? 'Show panel' : 'Focus map'}</span>
              </button>
            </div>
          </header>

          {libraryState.error ? (
            <div className="dt-fragment-viz-alert">{libraryState.error}</div>
          ) : null}

          {!hasActive && !loading ? (
            <div className="dt-fragment-viz-empty-state">
              <Layers size={28} />
              <strong>No worlds selected</strong>
              <span>Choose a saved snapshot or simulation from the panel.</span>
            </div>
          ) : null}

          {hasActive && mode === 'overlay' ? (
            <MapSurface
              colorBy={colorBy}
              featureCollection={featureCollection}
              fragments={activeFragments}
              opacity={opacity}
              results={activeResults}
              selectedFeature={selectedFeature}
              setSelectedFeature={setSelectedFeature}
              viewMode={viewMode}
            />
          ) : null}

          {hasActive && mode === 'compare' ? (
            <div className="dt-fragment-compare-grid">
              {activeResults.map((entry) => (
                <section className="dt-fragment-compare-panel" key={entry.fragment.id}>
                  <header>
                    <i style={{ background: entry.fragment.color }} />
                    <span>{compactText(entry.fragment.title, 'Answer', 40)}</span>
                    <em>{formatCount(entry.result?.summary?.resultCount ?? entry.result?.geojson?.features?.length ?? 0)}</em>
                  </header>
                  <MapSurface
                    colorBy={colorBy}
                    featureCollection={buildFeatureCollection([entry], colorBy)}
                    fragments={[entry.fragment]}
                    height="100%"
                    opacity={opacity}
                    results={[entry]}
                    selectedFeature={selectedFeature}
                    setSelectedFeature={setSelectedFeature}
                    viewMode={viewMode}
                  />
                </section>
              ))}
              {!activeResults.length ? (
                <div className="dt-fragment-viz-empty-state">
                  <RefreshCw size={24} />
                  <strong>Loading active worlds</strong>
                  <span>The compare grid will render when geometry is ready.</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {hasActive && mode === 'delta' && deltaWorld.pair.length === 2 ? (
            <MapSurface
              colorBy="__deltaValue"
              featureCollection={deltaWorld.featureCollection}
              fragments={deltaWorld.pair.map((entry) => entry.fragment)}
              opacity={opacity}
              results={[]}
              selectedFeature={selectedFeature}
              setSelectedFeature={setSelectedFeature}
              viewMode={viewMode}
            />
          ) : null}

          {hasActive && mode === 'delta' && deltaWorld.pair.length !== 2 ? (
            <div className="dt-fragment-viz-empty-state">
              <BarChart2 size={28} />
              <strong>Two simulation worlds required</strong>
              <span>Delta</span>
            </div>
          ) : null}
        </section>

        <FragmentControlPanel
          activeIds={activeIds}
          colorBy={colorBy}
          deltaMetric={deltaMetric}
          deltaSummary={deltaWorld.summary}
          fragments={fragments}
          hidden={panelHidden}
          loading={loading}
          maskAvailable={maskAvailable}
          mode={mode}
          numericFilterOptions={numericFilterOptions}
          opacity={opacity}
          propertyOptions={propertyOptions}
          refresh={loadLibrary}
          results={allResultEntries}
          selectionMaskEnabled={selectionMaskEnabled}
          setActiveIds={setActiveIds}
          setColorBy={setColorBy}
          setDeltaMetric={setDeltaMetric}
          setHidden={setPanelHidden}
          setMode={setMode}
          setOpacity={setOpacity}
          setSelectionMaskEnabled={setSelectionMaskEnabled}
          setViewMode={setViewMode}
          setWorldFilter={setWorldFilter}
          summary={summary}
          viewMode={viewMode}
          worldFilter={worldFilter}
        />
      </main>
    </div>
  )
}
