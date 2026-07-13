import {
  listCityTwinQueryObjectRows,
  runCityTwinQuery,
} from '../../db/productionTwinStore/twinQueryRepository.mjs'

const DEFAULT_EXPORT_LIMIT = 50000
const MAX_EXPORT_LIMIT = 100000
const TABULAR_FORMATS = new Set(['csv', 'json', 'jsonl'])
const SPATIAL_FORMATS = new Set(['geojson', 'cityjson'])
const SUPPORTED_FORMATS = new Set([...TABULAR_FORMATS, ...SPATIAL_FORMATS])
const DECLARED_UNSUPPORTED_FORMATS = new Map([
  ['ifc', 'IFC export needs a native BIM authoring/export pipeline or a stored provider IFC package. The current query layer can ingest IFC evidence but should not fabricate BIM from city footprints.'],
  ['citygml', 'CityGML export needs a full city-model encoder with LoD semantics and schema validation. Use CityJSON or GeoJSON from TwinQuery until that exporter exists.'],
])

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function normalizeFormat(value) {
  return compactText(value, 'csv').toLowerCase().replace(/[^a-z0-9_-]+/g, '')
}

function normalizeLimit(value) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_EXPORT_LIMIT
  return Math.min(MAX_EXPORT_LIMIT, Math.max(1, number))
}

function safeFilePart(value, fallback = 'query-export') {
  return compactText(value, fallback).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || fallback
}

function jsonValue(value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  return JSON.stringify(value)
}

function csvCell(value) {
  const text = String(jsonValue(value) ?? '')
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

function flattenExportRow(row = {}) {
  const attributes = row.attributes && typeof row.attributes === 'object' ? row.attributes : {}
  const centroid = Array.isArray(row.centroid) ? row.centroid : []
  return {
    city_entity_id: row.cityEntityId ?? '',
    object_id: row.objectId ?? '',
    stable_id: row.stableId ?? row.objectId ?? '',
    semantic_class: row.semanticClass ?? '',
    layer_key: row.layerKey ?? '',
    entity_type: row.entityType ?? '',
    label: row.label ?? '',
    geometry_type: row.geometryType ?? '',
    centroid_lon: centroid[0] ?? '',
    centroid_lat: centroid[1] ?? '',
    distance_m: row.distanceMeters ?? '',
    clause_id: row.clauseId ?? '',
    clause_label: row.clauseLabel ?? '',
    ...Object.fromEntries(
      Object.entries(attributes)
        .filter(([key]) => !['geom', 'geometry', 'geometry_geojson', '__geometry'].includes(String(key)))
        .map(([key, value]) => [String(key), value]),
    ),
  }
}

function rowsToCsv(rows = []) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  if (!columns.length) return ''
  return [
    columns.map(csvCell).join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
  ].join('\n') + '\n'
}

function baseQueryFromPayload(payload = {}) {
  const body = payload && typeof payload === 'object' ? payload : {}
  const query = body.query && typeof body.query === 'object' ? body.query : body
  return {
    ...query,
    surface: body.surface || query.surface || 'api',
    intent: body.intent || query.intent || 'export',
    metadata: {
      ...(query.metadata && typeof query.metadata === 'object' ? query.metadata : {}),
      ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
      source: 'twin-query-export',
      exportFormat: normalizeFormat(body.format),
    },
  }
}

function exportFilename(cityId, format) {
  const extension = format === 'cityjson' ? 'city.json' : format
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'z').toLowerCase()
  return `${safeFilePart(cityId)}-twin-query-${stamp}.${extension}`
}

function contentTypeForFormat(format) {
  if (format === 'csv') return 'text/csv; charset=utf-8'
  if (format === 'jsonl') return 'application/x-ndjson; charset=utf-8'
  if (format === 'geojson') return 'application/geo+json; charset=utf-8'
  if (format === 'cityjson') return 'application/city+json; charset=utf-8'
  return 'application/json; charset=utf-8'
}

function featureCollectionWithMetadata(result = {}, cityId, format) {
  const geojson = result.geojson && typeof result.geojson === 'object'
    ? result.geojson
    : { type: 'FeatureCollection', features: [] }
  return {
    ...geojson,
    metadata: {
      ...(geojson.metadata && typeof geojson.metadata === 'object' ? geojson.metadata : {}),
      cityId,
      exportFormat: format,
      query: result.query,
      summary: result.summary,
      generatedAt: new Date().toISOString(),
      source: 'oldt-twin-query-export',
    },
  }
}

function vertexKey(coordinate = []) {
  return [
    Number(coordinate[0] ?? 0).toFixed(7),
    Number(coordinate[1] ?? 0).toFixed(7),
    Number(coordinate[2] ?? 0).toFixed(2),
  ].join(',')
}

function makeVertexStore() {
  const vertices = []
  const index = new Map()
  return {
    vertices,
    indexFor(coordinate = []) {
      const vertex = [
        Number(coordinate[0] ?? 0),
        Number(coordinate[1] ?? 0),
        Number(coordinate[2] ?? 0),
      ]
      const key = vertexKey(vertex)
      if (index.has(key)) return index.get(key)
      const nextIndex = vertices.length
      vertices.push(vertex)
      index.set(key, nextIndex)
      return nextIndex
    },
  }
}

function ensureRingClosed(ring = []) {
  if (ring.length <= 1) return ring
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (Number(first?.[0]) === Number(last?.[0]) && Number(first?.[1]) === Number(last?.[1])) return ring
  return [...ring, first]
}

function polygonToMultiSurfaceBoundaries(polygonCoordinates = [], vertexStore) {
  if (!Array.isArray(polygonCoordinates) || !polygonCoordinates.length) return []
  const surface = polygonCoordinates
    .map((ring) => ensureRingClosed(Array.isArray(ring) ? ring : []))
    .filter((ring) => ring.length >= 4)
    .map((ring) => ring.map((coordinate) => vertexStore.indexFor([coordinate[0], coordinate[1], coordinate[2] ?? 0])))
  return surface.length ? [surface] : []
}

function geometryToCityJsonGeometry(geometry = {}, vertexStore) {
  if (geometry.type === 'Polygon') {
    const boundaries = polygonToMultiSurfaceBoundaries(geometry.coordinates, vertexStore)
    return boundaries.length ? [{ type: 'MultiSurface', lod: '0', boundaries }] : []
  }
  if (geometry.type === 'MultiPolygon') {
    const boundaries = (Array.isArray(geometry.coordinates) ? geometry.coordinates : [])
      .flatMap((polygon) => polygonToMultiSurfaceBoundaries(polygon, vertexStore))
    return boundaries.length ? [{ type: 'MultiSurface', lod: '0', boundaries }] : []
  }
  if (geometry.type === 'Point') {
    return [{
      type: 'MultiPoint',
      lod: '0',
      boundaries: [vertexStore.indexFor([geometry.coordinates?.[0], geometry.coordinates?.[1], geometry.coordinates?.[2] ?? 0])],
    }]
  }
  if (geometry.type === 'LineString') {
    const line = (Array.isArray(geometry.coordinates) ? geometry.coordinates : [])
      .map((coordinate) => vertexStore.indexFor([coordinate[0], coordinate[1], coordinate[2] ?? 0]))
    return line.length >= 2 ? [{ type: 'MultiLineString', lod: '0', boundaries: [line] }] : []
  }
  if (geometry.type === 'MultiLineString') {
    const lines = (Array.isArray(geometry.coordinates) ? geometry.coordinates : [])
      .map((line) => (Array.isArray(line) ? line : [])
        .map((coordinate) => vertexStore.indexFor([coordinate[0], coordinate[1], coordinate[2] ?? 0])))
      .filter((line) => line.length >= 2)
    return lines.length ? [{ type: 'MultiLineString', lod: '0', boundaries: lines }] : []
  }
  return []
}

function cityJsonTypeForFeature(feature = {}) {
  const semanticClass = String(feature.properties?.semanticClass || feature.properties?.semantic_class || '').toLowerCase()
  if (semanticClass === 'buildings') return 'Building'
  if (semanticClass === 'roads') return 'Road'
  if (semanticClass === 'green-blue systems' || semanticClass === 'greenblue') return 'LandUse'
  return 'GenericCityObject'
}

function boundsToExtent(bounds = {}) {
  if (![bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat].every((value) => Number.isFinite(Number(value)))) {
    return undefined
  }
  return [
    Number(bounds.minLon),
    Number(bounds.minLat),
    0,
    Number(bounds.maxLon),
    Number(bounds.maxLat),
    0,
  ]
}

function geojsonToCityJson(featureCollection = {}, result = {}, cityId) {
  const vertexStore = makeVertexStore()
  const cityObjects = {}
  const features = Array.isArray(featureCollection.features) ? featureCollection.features : []
  features.forEach((feature, index) => {
    const geometry = geometryToCityJsonGeometry(feature.geometry, vertexStore)
    if (!geometry.length) return
    const objectId = safeFilePart(feature.id || feature.properties?.objectId || feature.properties?.object_id || `object-${index + 1}`, `object-${index + 1}`)
    cityObjects[objectId] = {
      type: cityJsonTypeForFeature(feature),
      attributes: {
        ...feature.properties,
        source: 'oldt-twin-query-export',
      },
      geometry,
    }
  })

  return {
    type: 'CityJSON',
    version: '2.0',
    metadata: {
      title: `${cityId} TwinQuery CityJSON export`,
      referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/4326',
      geographicalExtent: boundsToExtent(result.summary?.bounds),
      generatedAt: new Date().toISOString(),
      source: 'oldt-twin-query-export',
      query: result.query,
      summary: result.summary,
      note: 'Footprint/query geometry export. This is not a native BIM/IFC conversion and does not claim authority LoD semantics.',
    },
    CityObjects: cityObjects,
    vertices: vertexStore.vertices,
  }
}

function exportEnvelope({ cityId, format, limit, query, rowsResult, rows }) {
  return {
    ok: true,
    cityId,
    format,
    generatedAt: new Date().toISOString(),
    query,
    summary: rowsResult.summary,
    rowCount: rows.length,
    limit,
    rows,
  }
}

function exportSuccess({ cityId, format, body, query, summary, rowCount, filename }) {
  return {
    ok: true,
    cityId,
    format,
    body,
    filename: filename || exportFilename(cityId, format),
    contentType: contentTypeForFormat(format),
    summary: summary ?? {},
    rowCount: Number(rowCount ?? 0),
    query,
  }
}

export async function exportCityTwinQuery(cityId, payload = {}) {
  const format = normalizeFormat(payload.format)
  const limit = normalizeLimit(payload.limit ?? payload.maxRows ?? payload.maxFeatures)
  if (DECLARED_UNSUPPORTED_FORMATS.has(format)) {
    return {
      ok: false,
      cityId,
      format,
      status: 422,
      error: 'TWIN_QUERY_EXPORT_FORMAT_REQUIRES_DEDICATED_EXPORTER',
      detail: DECLARED_UNSUPPORTED_FORMATS.get(format),
      supportedFormats: Array.from(SUPPORTED_FORMATS),
    }
  }
  if (!SUPPORTED_FORMATS.has(format)) {
    return {
      ok: false,
      cityId,
      format,
      status: 400,
      error: 'TWIN_QUERY_EXPORT_FORMAT_UNSUPPORTED',
      detail: `Unsupported TwinQuery export format: ${format || 'unknown'}`,
      supportedFormats: Array.from(SUPPORTED_FORMATS),
    }
  }

  const query = baseQueryFromPayload(payload)
  if (TABULAR_FORMATS.has(format)) {
    const rowsResult = await listCityTwinQueryObjectRows(cityId, query, { limit })
    if (!rowsResult.ok) {
      return {
        ok: false,
        cityId,
        format,
        status: 422,
        error: rowsResult.error || 'TWIN_QUERY_EXPORT_ROWS_UNAVAILABLE',
        summary: rowsResult.summary,
      }
    }
    const rows = (Array.isArray(rowsResult.rows) ? rowsResult.rows : []).map(flattenExportRow)
    const envelope = exportEnvelope({ cityId, format, limit, query: rowsResult.query, rowsResult, rows })
    if (format === 'csv') {
      return exportSuccess({
        cityId,
        format,
        body: rowsToCsv(rows),
        query: rowsResult.query,
        summary: rowsResult.summary,
        rowCount: rows.length,
      })
    }
    if (format === 'jsonl') {
      return exportSuccess({
        cityId,
        format,
        body: rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''),
        query: rowsResult.query,
        summary: rowsResult.summary,
        rowCount: rows.length,
      })
    }
    return exportSuccess({
      cityId,
      format,
      body: JSON.stringify(envelope, null, 2),
      query: rowsResult.query,
      summary: rowsResult.summary,
      rowCount: rows.length,
    })
  }

  const spatialQuery = {
    ...query,
    render: {
      ...(query.render && typeof query.render === 'object' ? query.render : {}),
      mode: 'isolate',
      transport: 'geojson',
      maxFeatures: limit,
    },
  }
  const result = await runCityTwinQuery(cityId, spatialQuery)
  if (!result.ok) {
    return {
      ok: false,
      cityId,
      format,
      status: 422,
      error: result.error || 'TWIN_QUERY_EXPORT_SPATIAL_UNAVAILABLE',
      summary: result.summary,
    }
  }
  const featureCollection = featureCollectionWithMetadata(result, cityId, format)
  const spatialBody = format === 'cityjson'
    ? geojsonToCityJson(featureCollection, result, cityId)
    : featureCollection
  return exportSuccess({
    cityId,
    format,
    body: JSON.stringify(spatialBody, null, 2),
    query: result.query,
    summary: result.summary,
    rowCount: Array.isArray(featureCollection.features) ? featureCollection.features.length : 0,
  })
}
