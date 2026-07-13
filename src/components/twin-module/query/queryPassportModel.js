'use client'

export const QUERY_PASSPORT_STORAGE_KEY = 'oldt:twin-query-passport:v1'

export const QUERY_SURFACE_DESTINATIONS = [
  { key: 'map', label: 'Map', href: '/analytical-map' },
  { key: '3d', label: '3D', href: '/city-3d' },
  { key: 'immersive', label: 'XR', href: '/civic-xr' },
  { key: 'canvas', label: 'Canvas', href: '/fragment-visualizer' },
]

export function routeForQuerySurface(surfaceKey) {
  return QUERY_SURFACE_DESTINATIONS.find((entry) => entry.key === surfaceKey)?.href || '/analytical-map'
}

function browserStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readQueryPassport() {
  const storage = browserStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(QUERY_PASSPORT_STORAGE_KEY)
    if (!raw) return null
    const passport = JSON.parse(raw)
    if (!passport || typeof passport !== 'object' || !passport.query) return null
    return passport
  } catch {
    return null
  }
}

export function clearQueryPassport(passportId = '') {
  const storage = browserStorage()
  if (!storage) return
  try {
    if (passportId) {
      const current = readQueryPassport()
      if (current?.id && current.id !== passportId) return
    }
    storage.removeItem(QUERY_PASSPORT_STORAGE_KEY)
  } catch {
    // localStorage can be unavailable in locked-down browser contexts.
  }
}

export function writeQueryPassport({
  builder = null,
  cityId = '',
  query,
  queryResult = null,
  sourceViewer = '',
  targetViewer = '',
} = {}) {
  const storage = browserStorage()
  if (!storage || !query) return null
  const passport = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    builder,
    cityId,
    createdAt: new Date().toISOString(),
    query,
    queryResult: queryResult
      ? {
          queryHash: queryResult.queryHash || queryResult.summary?.queryHash || '',
          resultCount: queryResult.resultCount ?? queryResult.summary?.resultCount ?? queryResult.returned ?? null,
          summary: queryResult.summary || null,
          transport: queryResult.transport || queryResult.query?.render?.transport || '',
        }
      : null,
    sourceViewer,
    targetViewer,
  }
  try {
    storage.setItem(QUERY_PASSPORT_STORAGE_KEY, JSON.stringify(passport))
    return passport
  } catch {
    return null
  }
}

export function passportTargetsViewer(passport, viewerId) {
  if (!passport?.query) return false
  return !passport.targetViewer || passport.targetViewer === viewerId
}
