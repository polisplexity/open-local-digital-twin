import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { getCityBoundaryBbox } from '../../db/productionTwinStore.mjs'

const execFileAsync = promisify(execFile)

const DEFAULT_MAX_GEOJSON_BYTES = 20 * 1024 * 1024
const DEFAULT_MAX_GEOJSON_FEATURES = 10_000
const DEFAULT_MAX_PACKAGE_INSPECTION_BYTES = 5 * 1024 * 1024
const DEFAULT_MAX_OGC_PAGES = 5
const DEFAULT_MAX_OVERTURE_BUILDINGS = 250_000
const DEFAULT_MAX_OVERTURE_ROADS = 250_000
const DEFAULT_FETCH_TIMEOUT_MS = 15_000

function numberEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

async function execTool(command, args, options = {}) {
  try {
    return await execFileAsync(command, args, {
      timeout: Number(options.timeoutMs ?? process.env.TWIN_STUDIO_NATIVE_EXTRACT_TIMEOUT_MS ?? 120_000),
      maxBuffer: Number(options.maxBuffer ?? process.env.TWIN_STUDIO_NATIVE_EXTRACT_MAX_BUFFER ?? 100 * 1024 * 1024),
      windowsHide: true,
    })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`${command.toUpperCase()}_NOT_AVAILABLE`)
    }
    throw error
  }
}

function gdalVectorSourcePath(sourceFormat, sourceUri) {
  const url = new URL(sourceUri)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${sourceFormat.toUpperCase()}_SOURCE_URI_MUST_BE_HTTP_OR_HTTPS`)
  }
  if (sourceFormat === 'shapefile') {
    return `/vsizip/vsicurl/${sourceUri}`
  }
  if (sourceFormat === 'geopackage') {
    return `/vsicurl/${sourceUri}`
  }
  throw new Error('GDAL_VECTOR_FORMAT_UNSUPPORTED')
}

function gdalLayerArgs(body = {}) {
  const layerName = String(body.layerName ?? body.layer_name ?? body.metadata?.layerName ?? body.metadata?.layer_name ?? '').trim()
  return layerName ? [layerName] : []
}

async function nativeVectorPackageToGeoJson(sourceFormat, sourceUri, body = {}) {
  if (!sourceUri) {
    throw new Error(`${sourceFormat.toUpperCase()}_SOURCE_URI_REQUIRED`)
  }
  const sourcePath = gdalVectorSourcePath(sourceFormat, sourceUri)
  const maxFeatures = numberEnv('TWIN_STUDIO_NATIVE_VECTOR_MAX_FEATURES', DEFAULT_MAX_GEOJSON_FEATURES)
  const args = [
    '-f',
    'GeoJSON',
    '/vsistdout/',
    sourcePath,
    '-t_srs',
    'EPSG:4326',
    '-limit',
    String(maxFeatures),
    ...gdalLayerArgs(body),
  ]
  const { stdout, stderr } = await execTool('ogr2ogr', args)
  const geojson = parseGeoJsonText(stdout)
  return {
    geojson,
    stats: {
      sourceFormat,
      featuresConverted: geojson.features.length,
      maxFeatures,
      tool: 'ogr2ogr',
      stderr: String(stderr ?? '').trim().slice(0, 4000),
    },
  }
}

function assertGeoJsonFeatureCollection(geojson) {
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error('GEOJSON_FEATURE_COLLECTION_REQUIRED')
  }

  const maxFeatures = numberEnv('TWIN_STUDIO_GEOJSON_MAX_FEATURES', DEFAULT_MAX_GEOJSON_FEATURES)
  if (geojson.features.length > maxFeatures) {
    throw new Error(`GEOJSON_FEATURE_LIMIT_EXCEEDED:${maxFeatures}`)
  }

  return geojson
}

function parseGeoJsonText(text) {
  try {
    return assertGeoJsonFeatureCollection(JSON.parse(text))
  } catch (error) {
    if (String(error?.message ?? '').startsWith('GEOJSON_')) throw error
    throw new Error('GEOJSON_PARSE_FAILED')
  }
}

function normalizeBbox(value) {
  if (Array.isArray(value)) {
    const bbox = value.map(Number)
    if (bbox.length === 4 && bbox.every(Number.isFinite)) return bbox
  }
  const parts = String(value ?? '')
    .split(',')
    .map((part) => Number(part.trim()))
  if (parts.length === 4 && parts.every(Number.isFinite)) return parts
  return null
}

async function overtureCityBbox(cityConfig, body = {}) {
  const explicit = normalizeBbox(body.bbox ?? body.boundingBox ?? body.bounding_box)
  if (explicit) return explicit
  const boundary = await getCityBoundaryBbox(cityConfig.id)
  if (boundary.ok && boundary.bbox) return boundary.bbox
  const lon = Number(cityConfig.lon)
  const lat = Number(cityConfig.lat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    throw new Error('OVERTURE_CITY_BBOX_REQUIRED')
  }
  const radiusKm = numberEnv('TWIN_STUDIO_OVERTURE_FALLBACK_RADIUS_KM', 6)
  const latDelta = radiusKm / 111
  const lonDelta = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2))
  return [lon - lonDelta, lat - latDelta, lon + lonDelta, lat + latDelta]
}

function overtureRelease(body = {}) {
  return String(
    body.release ??
      body.overtureRelease ??
      body.overture_release ??
      body.sourceVersion ??
      body.source_version ??
      process.env.TWIN_STUDIO_OVERTURE_RELEASE ??
      '2026-04-15.0',
  ).trim() || 'latest'
}

function normalizeOvertureBuildingsGeoJson(geojson, bbox = [], limit = DEFAULT_MAX_OVERTURE_BUILDINGS) {
  const featureCollection = assertGeoJsonFeatureCollection(geojson)
  return {
    type: 'FeatureCollection',
    features: featureCollection.features.slice(0, limit).map((feature, index) => {
      const properties = feature.properties ?? {}
      return {
        type: 'Feature',
        properties: {
          ...properties,
          id: properties.id ?? `overture-building:${index + 1}`,
          stable_id: properties.id ?? properties.stable_id ?? `overture-building:${index + 1}`,
          label: properties.names?.primary || properties.primary_name || properties.id || `Overture building ${index + 1}`,
          kind: 'building',
          building: properties.class ?? properties.subtype ?? 'building',
          source: 'Overture Maps Buildings',
          source_license: 'ODbL',
          record_confidence: 'candidate',
          digital_record_stage: 'candidate-building-footprint',
          bbox_filter: bbox,
        },
        geometry: feature.geometry,
      }
    }).filter((feature) => feature.geometry),
  }
}

function normalizePrimaryName(properties = {}, fallback = null) {
  const names = properties.names
  if (typeof names?.primary === 'string') return names.primary
  if (typeof names?.primary?.value === 'string') return names.primary.value
  if (Array.isArray(names?.common) && Array.isArray(names.common[0])) return names.common[0][1] ?? fallback
  if (Array.isArray(names?.common) && names.common[0]?.value) return names.common[0].value
  return properties.primary_name ?? properties.name ?? fallback
}

function isOvertureRoadFeature(feature, { includeRail = false } = {}) {
  if (includeRail) return true
  const properties = feature?.properties ?? {}
  return properties.subtype !== 'rail' && properties.class !== 'rail' && properties.class !== 'subway'
}

async function buildOvertureQueryContract(cityConfig, body = {}, kind = 'buildings') {
  const bbox = await overtureCityBbox(cityConfig, body)
  const release = overtureRelease(body)
  const overtureType = kind === 'roads' || kind === 'transportation' ? 'segment' : 'building'
  const theme = overtureType === 'segment' ? 'transportation' : 'buildings'
  const cityId = String(cityConfig?.id ?? body.cityId ?? body.city_id ?? '').trim()
  const sourceUri = `overturemaps-cli:${theme}/${overtureType}:${release}`
  return {
    cityId,
    bbox,
    release,
    theme,
    overtureType,
    sourceUri,
    extractionMode: 'overturemaps-cli-bbox',
  }
}

async function queryOvertureBuildings(cityConfig, body = {}) {
  const contract = await buildOvertureQueryContract(cityConfig, body, 'buildings')
  const bbox = contract.bbox
  const [west, south, east, north] = bbox
  const limit = Math.min(
    numberEnv('TWIN_STUDIO_OVERTURE_BUILDINGS_MAX_FEATURES', DEFAULT_MAX_OVERTURE_BUILDINGS),
    Math.max(1, Number(body.limit ?? body.maxFeatures ?? body.max_features ?? DEFAULT_MAX_OVERTURE_BUILDINGS)),
  )
  const release = contract.release
  const sourceUri = contract.sourceUri
  const startedAt = Date.now()
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'twin-overture-buildings-'))
  const outputPath = path.join(tempDir, 'buildings.geojson')
  const bboxText = [west, south, east, north].map((value) => Number(value).toFixed(8)).join(',')

  try {
    const args = [
      '-m',
      'overturemaps',
      'download',
      '--bbox',
      bboxText,
      '-f',
      'geojson',
      '--type',
      'building',
      '--release',
      release,
      '--output',
      outputPath,
    ]
    const { stderr } = await execTool('python3', args, {
      timeoutMs: Number(process.env.TWIN_STUDIO_OVERTURE_BUILDINGS_TIMEOUT_MS ?? 300_000),
      maxBuffer: Number(process.env.TWIN_STUDIO_OVERTURE_BUILDINGS_MAX_BUFFER ?? 20 * 1024 * 1024),
    })
    const rawGeoJson = parseGeoJsonText(await readFile(outputPath, 'utf8'))
    const geojson = normalizeOvertureBuildingsGeoJson(rawGeoJson, bbox, limit)
    return {
      geojson,
      sourceUri,
      bbox,
      stats: {
        tool: 'overturemaps-python-cli',
        sourceFormat: 'overture-buildings',
        sourceUri,
        release,
        bbox,
        featuresRead: rawGeoJson.features.length,
        featuresConverted: geojson.features.length,
        limit,
        truncated: rawGeoJson.features.length > geojson.features.length,
        stderr: String(stderr ?? '').trim().slice(0, 4000),
        durationMs: Date.now() - startedAt,
      },
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

function normalizeOvertureRoadsGeoJson(geojson, bbox = [], limit = DEFAULT_MAX_OVERTURE_ROADS, options = {}) {
  const featureCollection = assertGeoJsonFeatureCollection(geojson)
  const includeRail = options.includeRail === true
  const sourceFeatures = featureCollection.features.filter((feature) => isOvertureRoadFeature(feature, { includeRail }))
  return {
    type: 'FeatureCollection',
    features: sourceFeatures.slice(0, limit).map((feature, index) => {
      const properties = feature.properties ?? {}
      const id = properties.id ?? feature.id ?? properties.gers_id ?? `overture-segment:${index + 1}`
      const roadClass = properties.class ?? properties.subtype ?? properties.road_class ?? 'segment'
      return {
        type: 'Feature',
        properties: {
          ...properties,
          id,
          stable_id: id,
          label: normalizePrimaryName(properties, `Overture road segment ${index + 1}`),
          kind: 'road',
          highway: roadClass,
          road_class: roadClass,
          source: 'Overture Maps Transportation',
          source_license: 'ODbL',
          record_confidence: 'candidate',
          digital_record_stage: 'candidate-road-segment',
          bbox_filter: bbox,
        },
        geometry: feature.geometry,
      }
    }).filter((feature) => feature.geometry),
  }
}

async function queryOvertureRoads(cityConfig, body = {}) {
  const contract = await buildOvertureQueryContract(cityConfig, body, 'roads')
  const bbox = contract.bbox
  const [west, south, east, north] = bbox
  const limit = Math.min(
    numberEnv('TWIN_STUDIO_OVERTURE_ROADS_MAX_FEATURES', DEFAULT_MAX_OVERTURE_ROADS),
    Math.max(1, Number(body.limit ?? body.maxFeatures ?? body.max_features ?? DEFAULT_MAX_OVERTURE_ROADS)),
  )
  const release = contract.release
  const sourceUri = contract.sourceUri
  const startedAt = Date.now()
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'twin-overture-roads-'))
  const outputPath = path.join(tempDir, 'roads.geojson')
  const bboxText = [west, south, east, north].map((value) => Number(value).toFixed(8)).join(',')

  try {
    const args = [
      '-m',
      'overturemaps',
      'download',
      '--bbox',
      bboxText,
      '-f',
      'geojson',
      '--type',
      'segment',
      '--release',
      release,
      '--output',
      outputPath,
    ]
    const { stderr } = await execTool('python3', args, {
      timeoutMs: Number(process.env.TWIN_STUDIO_OVERTURE_ROADS_TIMEOUT_MS ?? 300_000),
      maxBuffer: Number(process.env.TWIN_STUDIO_OVERTURE_ROADS_MAX_BUFFER ?? 20 * 1024 * 1024),
    })
    const rawGeoJson = parseGeoJsonText(await readFile(outputPath, 'utf8'))
    const includeRail = body.includeRail === true || body.include_rail === true
    const roadSegmentCount = rawGeoJson.features.filter((feature) => isOvertureRoadFeature(feature, { includeRail })).length
    const geojson = normalizeOvertureRoadsGeoJson(rawGeoJson, bbox, limit, { includeRail })
    return {
      geojson,
      sourceUri,
      bbox,
      stats: {
        tool: 'overturemaps-python-cli',
        sourceFormat: 'overture-roads',
        sourceUri,
        release,
        bbox,
        overtureType: 'segment',
        featuresRead: rawGeoJson.features.length,
        roadSegmentsRead: roadSegmentCount,
        featuresConverted: geojson.features.length,
        railFiltered: rawGeoJson.features.length - roadSegmentCount,
        limit,
        truncated: rawGeoJson.features.length > geojson.features.length,
        stderr: String(stderr ?? '').trim().slice(0, 4000),
        durationMs: Date.now() - startedAt,
      },
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

function parseJsonText(text, errorCode) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(errorCode)
  }
}

async function fetchGeoJsonFromUri(sourceUri) {
  const url = new URL(sourceUri)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('GEOJSON_SOURCE_URI_MUST_BE_HTTP_OR_HTTPS')
  }

  const maxBytes = numberEnv('TWIN_STUDIO_GEOJSON_MAX_BYTES', DEFAULT_MAX_GEOJSON_BYTES)
  const timeoutMs = numberEnv('TWIN_STUDIO_GEOJSON_FETCH_TIMEOUT_MS', DEFAULT_FETCH_TIMEOUT_MS)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/geo+json, application/json;q=0.9, */*;q=0.1',
        'user-agent': 'TwinBaseStudio/0.1 provider-geojson-ingestion',
      },
    })
    if (!response.ok) {
      throw new Error(`GEOJSON_SOURCE_FETCH_FAILED:${response.status}`)
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0)
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error(`GEOJSON_SOURCE_TOO_LARGE:${maxBytes}`)
    }

    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new Error(`GEOJSON_SOURCE_TOO_LARGE:${maxBytes}`)
    }
    return parseGeoJsonText(text)
  } finally {
    clearTimeout(timeout)
  }
}

function mergeFeatureCollections(collections) {
  const features = collections.flatMap((collection) => collection.features ?? [])
  return assertGeoJsonFeatureCollection({
    type: 'FeatureCollection',
    features,
  })
}

function nextLinkFromFeatureCollection(collection) {
  const links = Array.isArray(collection?.links) ? collection.links : []
  const next = links.find((link) => String(link?.rel ?? '').toLowerCase() === 'next')
  return String(next?.href ?? '').trim()
}

async function fetchOgcFeatureCollection(sourceUri) {
  const maxPages = numberEnv('TWIN_STUDIO_OGC_MAX_PAGES', DEFAULT_MAX_OGC_PAGES)
  const collections = []
  let nextUri = sourceUri

  for (let page = 0; page < maxPages && nextUri; page += 1) {
    const collection = await fetchGeoJsonFromUri(nextUri)
    collections.push(collection)
    const next = nextLinkFromFeatureCollection(collection)
    nextUri = next ? new URL(next, nextUri).toString() : ''
  }

  return {
    geojson: mergeFeatureCollections(collections),
    pagesFetched: collections.length,
  }
}

async function fetchTextFromUri(sourceUri, {
  accept,
  maxBytes,
  errorPrefix,
}) {
  const url = new URL(sourceUri)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${errorPrefix}_SOURCE_URI_MUST_BE_HTTP_OR_HTTPS`)
  }

  const timeoutMs = numberEnv('TWIN_STUDIO_PROVIDER_FETCH_TIMEOUT_MS', DEFAULT_FETCH_TIMEOUT_MS)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept,
        'user-agent': 'TwinBaseStudio/0.1 provider-layer-ingestion',
      },
    })
    if (!response.ok) {
      throw new Error(`${errorPrefix}_SOURCE_FETCH_FAILED:${response.status}`)
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0)
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error(`${errorPrefix}_SOURCE_TOO_LARGE:${maxBytes}`)
    }

    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new Error(`${errorPrefix}_SOURCE_TOO_LARGE:${maxBytes}`)
    }
    return text
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchJsonFromUri(sourceUri, {
  maxBytes = DEFAULT_MAX_PACKAGE_INSPECTION_BYTES,
  errorPrefix = 'JSON',
} = {}) {
  const text = await fetchTextFromUri(sourceUri, {
    accept: 'application/json, application/geo+json;q=0.9, */*;q=0.1',
    maxBytes,
    errorPrefix,
  })
  return parseJsonText(text, `${errorPrefix}_PARSE_FAILED`)
}

async function inspectHttpHeaders(sourceUri, errorPrefix) {
  const url = new URL(sourceUri)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${errorPrefix}_SOURCE_URI_MUST_BE_HTTP_OR_HTTPS`)
  }
  const timeoutMs = numberEnv('TWIN_STUDIO_PROVIDER_FETCH_TIMEOUT_MS', DEFAULT_FETCH_TIMEOUT_MS)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'user-agent': 'TwinBaseStudio/0.1 provider-package-inspection',
      },
    })
    if (!response.ok) {
      throw new Error(`${errorPrefix}_HEAD_FAILED:${response.status}`)
    }
    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
      acceptRanges: response.headers.get('accept-ranges'),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function wmsCapabilitiesUri(sourceUri) {
  const url = new URL(sourceUri)
  if (!url.searchParams.has('service')) url.searchParams.set('service', 'WMS')
  if (!url.searchParams.has('request')) url.searchParams.set('request', 'GetCapabilities')
  return url.toString()
}

function summarizeJson(value) {
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      firstKeys: value[0] && typeof value[0] === 'object' ? Object.keys(value[0]).slice(0, 25) : [],
    }
  }
  if (value && typeof value === 'object') {
    return {
      type: value.type ?? 'object',
      keys: Object.keys(value).slice(0, 50),
      featureCount: value.type === 'FeatureCollection' && Array.isArray(value.features) ? value.features.length : null,
    }
  }
  return {
    type: typeof value,
  }
}

async function inspectProviderPackage(sourceFormat, sourceUri, metadata = {}) {
  if (!sourceUri && !Object.keys(metadata).length) {
    throw new Error('PACKAGE_SOURCE_URI_OR_METADATA_REQUIRED')
  }
  if (sourceFormat === 'raster-cog') {
    if (!sourceUri) throw new Error('RASTER_COG_SOURCE_URI_REQUIRED')
    const headers = await inspectHttpHeaders(sourceUri, 'RASTER_COG')
    return {
      state: 'inspected-raster-cog-headers',
      sourceFormat,
      headers,
      warnings: headers.acceptRanges !== 'bytes' ? ['COG_RANGE_REQUEST_SUPPORT_NOT_DECLARED'] : [],
    }
  }
  if (sourceFormat === 'wms') {
    if (!sourceUri) throw new Error('WMS_SOURCE_URI_REQUIRED')
    const capabilitiesUri = wmsCapabilitiesUri(sourceUri)
    const text = await fetchTextFromUri(capabilitiesUri, {
      accept: 'application/xml, text/xml, */*;q=0.1',
      maxBytes: numberEnv('TWIN_STUDIO_PACKAGE_INSPECTION_MAX_BYTES', DEFAULT_MAX_PACKAGE_INSPECTION_BYTES),
      errorPrefix: 'WMS',
    })
    return {
      state: 'inspected-wms-capabilities',
      sourceFormat,
      capabilitiesUri,
      byteLength: Buffer.byteLength(text, 'utf8'),
      serviceTitle: text.match(/<Title>([^<]+)<\/Title>/i)?.[1] ?? null,
      layerCount: (text.match(/<Layer\b/gi) ?? []).length,
    }
  }
  if (sourceFormat === '3d-tiles') {
    if (!sourceUri) throw new Error('THREE_D_TILES_SOURCE_URI_REQUIRED')
    const tileset = await fetchJsonFromUri(sourceUri, {
      errorPrefix: 'THREE_D_TILES',
    })
    return {
      state: 'inspected-3d-tiles-tileset',
      sourceFormat,
      assetVersion: tileset?.asset?.version ?? null,
      geometricError: tileset?.geometricError ?? null,
      rootBoundingVolume: tileset?.root?.boundingVolume ?? null,
      rootRefine: tileset?.root?.refine ?? null,
    }
  }
  if (sourceFormat === 'http-json' || sourceFormat === 'sensor-feed') {
    if (!sourceUri) throw new Error(`${sourceFormat.toUpperCase().replace(/-/g, '_')}_SOURCE_URI_REQUIRED`)
    const jsonPayload = await fetchJsonFromUri(sourceUri, {
      errorPrefix: sourceFormat === 'sensor-feed' ? 'SENSOR_FEED' : 'HTTP_JSON',
    })
    return {
      state: `inspected-${sourceFormat}`,
      sourceFormat,
      summary: summarizeJson(jsonPayload),
      sample: Array.isArray(jsonPayload) ? jsonPayload.slice(0, 3) : jsonPayload,
    }
  }
  if (sourceFormat === 'mqtt') {
    return {
      state: 'registered-mqtt-feed',
      sourceFormat,
      brokerUri: sourceUri || metadata.brokerUri || metadata.broker_uri || null,
      topic: metadata.topic ?? null,
      note: 'MQTT feed registration is stored for a future subscriber worker.',
    }
  }
  if (sourceFormat === 'bim-package') {
    return {
      state: 'registered-bim-package',
      sourceFormat,
      note: 'BIM package registered. Submit IFC as sourceFormat=ifc for STEP metadata and georeference extraction.',
    }
  }
  return {
    state: 'metadata-registered',
    sourceFormat,
  }
}

export {
  assertGeoJsonFeatureCollection,
  fetchGeoJsonFromUri,
  fetchOgcFeatureCollection,
  fetchTextFromUri,
  inspectProviderPackage,
  nativeVectorPackageToGeoJson,
  parseGeoJsonText,
  parseJsonText,
  buildOvertureQueryContract,
  queryOvertureBuildings,
  queryOvertureRoads,
}
