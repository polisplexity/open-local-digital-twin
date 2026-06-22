import { haversineKm } from './geoUtils.mjs'

export function parseBuildingHeight(tags = {}) {
  const explicitHeight = Number.parseFloat(String(tags.height ?? '').replace(/[^\d.]/g, ''))
  if (Number.isFinite(explicitHeight) && explicitHeight > 0) {
    return Number(explicitHeight.toFixed(1))
  }
  const levels = Number.parseFloat(String(tags['building:levels'] ?? '').replace(/[^\d.]/g, ''))
  if (Number.isFinite(levels) && levels > 0) {
    return Number((Math.max(levels, 1) * 3.2).toFixed(1))
  }
  return 8
}

export function polygonBoxFromScenePoints(points, height) {
  if (!points.length) return null
  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minZ = Math.min(minZ, point.z)
    maxX = Math.max(maxX, point.x)
    maxZ = Math.max(maxZ, point.z)
  }
  return {
    x: Number(((minX + maxX) / 2).toFixed(2)),
    z: Number(((minZ + maxZ) / 2).toFixed(2)),
    width: Number(Math.max(maxX - minX, 6).toFixed(2)),
    depth: Number(Math.max(maxZ - minZ, 6).toFixed(2)),
    height: Number(height.toFixed(2)),
  }
}

export function toTitleCase(value) {
  return String(value ?? '')
    .replaceAll(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export function compactLabel(value, fallback) {
  const raw = String(value ?? '').trim()
  return raw ? toTitleCase(raw) : fallback
}

export function categoryInSet(feature, set) {
  return set.has(String(feature?.properties?.category ?? '').trim())
}

export function filterFeatureCollection(collection, predicate) {
  return {
    type: 'FeatureCollection',
    features: (collection?.features ?? []).filter(predicate),
  }
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function estimatedFloorsFromHeight(height) {
  const numericHeight = Number(height)
  if (!Number.isFinite(numericHeight) || numericHeight <= 0) return 1
  return Math.max(1, Math.round(numericHeight / 3.2))
}

export function nearestFeatureSummary(origin, features = [], geometryAccessor) {
  if (!origin || !Array.isArray(features) || !features.length) return null
  let nearest = null
  let nearestDistanceKm = Infinity
  for (const feature of features) {
    const coords = geometryAccessor(feature)
    if (!Array.isArray(coords) || coords.length < 2) continue
    const distanceKm = haversineKm([origin.lon, origin.lat], coords)
    if (distanceKm < nearestDistanceKm) {
      nearest = feature
      nearestDistanceKm = distanceKm
    }
  }
  if (!nearest || !Number.isFinite(nearestDistanceKm)) return null
  return {
    label: nearest.properties?.label || 'Nearest feature',
    distanceM: Math.round(nearestDistanceKm * 1000),
  }
}

export function classifyPlanningReadiness({ footprintArea, nearestRoadDistanceM, hasExplicitHeight }) {
  if (footprintArea >= 800 && nearestRoadDistanceM <= 120 && hasExplicitHeight) return 'planning-ready'
  if (footprintArea >= 250 && nearestRoadDistanceM <= 220) return 'starter-ready'
  return 'context-only'
}

export function countBy(values, accessor, fallback = 'Other') {
  const counts = new Map()
  for (const value of values) {
    const key = accessor(value) || fallback
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
}
