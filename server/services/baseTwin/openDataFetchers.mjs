import { buildBoundaryTiles, fallbackBoundary } from './geoUtils.mjs'

const REQUEST_TIMEOUT_MS = 30000
const DEFAULT_OVERPASS_MAX_TILES = 48

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

async function fetchJson(url, options = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'OpenLocalDigitalTwin/0.1 (+https://github.com/polisplexity/open-local-digital-twin)',
        ...(options.headers ?? {}),
      },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`FETCH_FAILED:${response.status}`)
    }
    return response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

function numberEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function buildOverpassTileQuery(tile) {
  const bbox = `${tile.south},${tile.west},${tile.north},${tile.east}`
  return `
[out:json][timeout:45];
(
  way["building"](${bbox});
  way["highway"]["highway"!~"motorway|trunk|steps|path|cycleway|corridor|proposed|construction"](${bbox});
  node["amenity"](${bbox});
  way["amenity"](${bbox});
  node["public_transport"](${bbox});
  node["shop"](${bbox});
  node["place"~"suburb|quarter|neighbourhood|village|hamlet|locality"](${bbox});
  way["leisure"~"park|playground|pitch|sports_centre|garden|nature_reserve"](${bbox});
  way["landuse"~"forest|residential|industrial|commercial|grass|meadow|recreation_ground|allotments|farmyard"](${bbox});
  way["natural"~"water|wood|wetland|scrub|grassland|heath"](${bbox});
  way["waterway"](${bbox});
);
out geom;
`.trim()
}

export async function fetchBoundary(city) {
  const sourceUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&polygon_geojson=1&limit=1${city.countryCode ? `&countrycodes=${encodeURIComponent(city.countryCode)}` : ''}&q=${encodeURIComponent(city.nominatimQuery)}`
  try {
    const results = await fetchJson(sourceUrl, {
      headers: {
        'Accept-Language': 'en',
      },
    })
    const sourceArtifacts = [
      {
        sourceName: 'Nominatim',
        sourceKind: 'city-boundary-search',
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        payload: results,
        metadata: {
          query: city.nominatimQuery,
          countryCode: city.countryCode || null,
        },
      },
    ]
    const top = Array.isArray(results) ? results[0] : null
    if (!top?.geojson) {
      return {
        center: { lat: city.lat, lon: city.lon },
        boundary: fallbackBoundary({ lat: city.lat, lon: city.lon }),
        sourceArtifacts,
      }
    }
    const center = {
      lat: Number.parseFloat(top.lat) || city.lat,
      lon: Number.parseFloat(top.lon) || city.lon,
    }
    return {
      center,
      boundary: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              label: top.display_name || `${city.name} boundary`,
            },
            geometry: top.geojson,
          },
        ],
      },
      sourceArtifacts,
    }
  } catch {
    return {
      center: { lat: city.lat, lon: city.lon },
      boundary: fallbackBoundary({ lat: city.lat, lon: city.lon }),
      sourceArtifacts: [],
    }
  }
}

export async function fetchOverpass(center, boundary) {
  const tilePlan = buildBoundaryTiles(boundary, center, {
    maxTiles: numberEnv('TWIN_STUDIO_OVERPASS_MAX_TILES', DEFAULT_OVERPASS_MAX_TILES),
  })
  const deduped = new Map()
  const groups = {}
  const diagnostics = []
  const sourceArtifacts = []
  const tileDiagnostics = []

  for (const tile of tilePlan.tiles) {
    const query = buildOverpassTileQuery(tile)
    let success = false
    let matchedElements = []
    let lastError = 'UNKNOWN_ERROR'
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const payload = await fetchJson(endpoint, {
          method: 'POST',
          body: query,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'text/plain;charset=UTF-8',
          },
        })
        matchedElements = Array.isArray(payload?.elements) ? payload.elements : []
        sourceArtifacts.push({
          sourceName: 'Overpass',
          sourceKind: 'overpass-boundary-tile',
          sourceUrl: endpoint,
          fetchedAt: new Date().toISOString(),
          payload,
          metadata: {
            tile,
            query,
            count: matchedElements.length,
            tilePlan: {
              rows: tilePlan.rows,
              columns: tilePlan.columns,
              totalTiles: tilePlan.tiles.length,
              bounds: tilePlan.bounds,
            },
          },
        })
        for (const element of matchedElements) {
          const key = `${element.type}:${element.id}`
          if (!deduped.has(key)) deduped.set(key, element)
        }
        tileDiagnostics.push({
          key: tile.id,
          critical: false,
          endpoint,
          success: true,
          count: matchedElements.length,
          error: null,
          tile,
        })
        success = true
        break
      } catch (error) {
        lastError = String(error?.message ?? 'UNKNOWN_ERROR')
      }
    }
    if (!success) {
      tileDiagnostics.push({
        key: tile.id,
        critical: false,
        endpoint: null,
        success: false,
        count: 0,
        error: lastError,
        tile,
      })
    }
  }

  const elements = Array.from(deduped.values())
  groups.buildings = elements.filter((element) => element.type === 'way' && element.tags?.building)
  groups.roads = elements.filter((element) => element.type === 'way' && element.tags?.highway)
  groups.facilities = elements.filter(
    (element) =>
      (element.type === 'node' || element.type === 'way') &&
      (element.tags?.amenity || element.tags?.shop || element.tags?.public_transport),
  )
  groups.places = elements.filter((element) => element.type === 'node' && element.tags?.place)
  groups.greenBlue = elements.filter(
    (element) =>
      element.type === 'way' &&
      (element.tags?.leisure || element.tags?.natural || element.tags?.landuse || element.tags?.waterway),
  )

  diagnostics.push(
    {
      key: 'buildings',
      critical: true,
      endpoint: 'boundary-tiled-overpass',
      success: groups.buildings.length > 0,
      count: groups.buildings.length,
      error: groups.buildings.length > 0 ? null : 'NO_BUILDINGS_IN_TILES',
    },
    {
      key: 'roads',
      critical: true,
      endpoint: 'boundary-tiled-overpass',
      success: groups.roads.length > 0,
      count: groups.roads.length,
      error: groups.roads.length > 0 ? null : 'NO_ROADS_IN_TILES',
    },
    {
      key: 'facilities',
      critical: false,
      endpoint: 'boundary-tiled-overpass',
      success: groups.facilities.length > 0,
      count: groups.facilities.length,
      error: groups.facilities.length > 0 ? null : 'NO_FACILITIES_IN_TILES',
    },
    {
      key: 'places',
      critical: false,
      endpoint: 'boundary-tiled-overpass',
      success: true,
      count: groups.places.length,
      error: null,
    },
    {
      key: 'greenBlue',
      critical: false,
      endpoint: 'boundary-tiled-overpass',
      success: true,
      count: groups.greenBlue.length,
      error: null,
    },
  )

  return {
    elements,
    groups,
    diagnostics,
    tileDiagnostics,
    tilePlan: {
      rows: tilePlan.rows,
      columns: tilePlan.columns,
      totalTiles: tilePlan.tiles.length,
      bounds: tilePlan.bounds,
    },
    sourceArtifacts,
  }
}

function normalizeReferenceSummary(summary, fallback) {
  if (!summary || typeof summary !== 'object') {
    return fallback
  }
  return {
    title: summary.title || fallback.title,
    description: summary.description || fallback.description,
    extract: summary.extract || fallback.extract,
    pageUrl: summary.content_urls?.desktop?.page || fallback.pageUrl || null,
    imageUrl: summary.originalimage?.source || summary.thumbnail?.source || fallback.imageUrl || null,
    coordinates: summary.coordinates
      ? {
          lat: Number(summary.coordinates.lat) || null,
          lon: Number(summary.coordinates.lon) || null,
        }
      : fallback.coordinates || null,
  }
}

export async function fetchReferenceProfile(city) {
  const townFallback = {
    title: city.name,
    description: 'Town and administrative centre',
    extract: `${city.name} is the anchor place for the current public-data base twin in this platform.`,
    pageUrl: `https://en.wikipedia.org/wiki/${city.wikipediaTownPage}`,
    imageUrl: null,
    coordinates: { lat: city.lat, lon: city.lon },
  }
  const municipalityFallback = {
    title: city.municipalityTitle || `${city.name} Municipality`,
    description: city.municipalityDescription || `Municipality of ${city.country}`,
    extract: `${city.municipalityTitle || `${city.name} Municipality`} is the broader authority territory that gives meaning to the local twin.`,
    pageUrl: `https://en.wikipedia.org/wiki/${city.wikipediaMunicipalityPage}`,
    imageUrl: null,
    coordinates: { lat: city.lat, lon: city.lon },
  }

  const townUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${city.wikipediaTownPage}`
  const municipalityUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${city.wikipediaMunicipalityPage}`
  const [townSummary, municipalitySummary] = await Promise.all([
    fetchJson(townUrl).catch(() => null),
    fetchJson(municipalityUrl).catch(() => null),
  ])
  const sourceArtifacts = [
    townSummary
      ? {
          sourceName: 'Wikipedia REST',
          sourceKind: 'wikipedia-town-summary',
          sourceUrl: townUrl,
          fetchedAt: new Date().toISOString(),
          payload: townSummary,
          metadata: {
            page: city.wikipediaTownPage,
          },
        }
      : null,
    municipalitySummary
      ? {
          sourceName: 'Wikipedia REST',
          sourceKind: 'wikipedia-municipality-summary',
          sourceUrl: municipalityUrl,
          fetchedAt: new Date().toISOString(),
          payload: municipalitySummary,
          metadata: {
            page: city.wikipediaMunicipalityPage,
          },
        }
      : null,
  ].filter(Boolean)

  return {
    town: normalizeReferenceSummary(townSummary, townFallback),
    municipality: normalizeReferenceSummary(municipalitySummary, municipalityFallback),
    sourceArtifacts,
  }
}
