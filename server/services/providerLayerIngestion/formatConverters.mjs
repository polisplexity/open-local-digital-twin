const DEFAULT_MAX_CSV_ROWS = 25_000
const DEFAULT_MAX_CITYJSON_OBJECTS = 10_000
const DEFAULT_MAX_STAC_ITEMS = 10_000

function numberEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function parseCsv(text, delimiter = ',') {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === delimiter) {
      row.push(field)
      field = ''
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    if (char === '\r') {
      continue
    }
    field += char
  }

  row.push(field)
  if (row.some((value) => value.trim())) {
    rows.push(row)
  }

  const [headers = [], ...bodyRows] = rows
  const normalizedHeaders = headers.map((header) => header.trim())
  if (normalizedHeaders.length === 0 || normalizedHeaders.some((header) => !header)) {
    throw new Error('CSV_HEADERS_REQUIRED')
  }

  return bodyRows
    .filter((values) => values.some((value) => String(value ?? '').trim()))
    .map((values) => Object.fromEntries(
      normalizedHeaders.map((header, index) => [header, values[index] ?? '']),
    ))
}

function firstExistingField(row, candidates) {
  const fieldsByLower = new Map(Object.keys(row).map((field) => [field.toLowerCase(), field]))
  for (const candidate of candidates) {
    const field = fieldsByLower.get(String(candidate).toLowerCase())
    if (field) return field
  }
  return ''
}

function parseCoordinate(value) {
  const numeric = Number(String(value ?? '').trim())
  return Number.isFinite(numeric) ? numeric : null
}

function parseGeometryField(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  try {
    const geometry = JSON.parse(text)
    if (geometry?.type && Array.isArray(geometry.coordinates)) {
      return geometry
    }
  } catch {
    return null
  }
  return null
}

function cityJsonCoordinate(cityjson, vertexIndex) {
  const vertex = cityjson?.vertices?.[vertexIndex]
  if (!Array.isArray(vertex) || vertex.length < 2) return null
  const transform = cityjson.transform ?? {}
  const scale = Array.isArray(transform.scale) ? transform.scale : [1, 1, 1]
  const translate = Array.isArray(transform.translate) ? transform.translate : [0, 0, 0]
  const x = Number(vertex[0]) * Number(scale[0] ?? 1) + Number(translate[0] ?? 0)
  const y = Number(vertex[1]) * Number(scale[1] ?? 1) + Number(translate[1] ?? 0)
  const z = vertex.length > 2
    ? Number(vertex[2]) * Number(scale[2] ?? 1) + Number(translate[2] ?? 0)
    : null
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return Number.isFinite(z) ? [x, y, z] : [x, y]
}

function collectCityJsonVertexIndexes(value, indexes = new Set()) {
  if (Number.isInteger(value)) {
    indexes.add(value)
    return indexes
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectCityJsonVertexIndexes(item, indexes)
    }
  }
  return indexes
}

function cityJsonObjectCoordinates(cityjson, object) {
  const indexes = new Set()
  for (const geometry of object.geometry ?? []) {
    collectCityJsonVertexIndexes(geometry?.boundaries, indexes)
  }
  return [...indexes]
    .map((vertexIndex) => cityJsonCoordinate(cityjson, vertexIndex))
    .filter(Boolean)
}

function centroidFromCoordinates(coordinates) {
  if (!coordinates.length) return null
  const total = coordinates.reduce((sum, coordinate) => ({
    x: sum.x + coordinate[0],
    y: sum.y + coordinate[1],
    z: sum.z + (Number.isFinite(coordinate[2]) ? coordinate[2] : 0),
    zCount: sum.zCount + (Number.isFinite(coordinate[2]) ? 1 : 0),
  }), {
    x: 0,
    y: 0,
    z: 0,
    zCount: 0,
  })
  const point = [total.x / coordinates.length, total.y / coordinates.length]
  if (total.zCount) point.push(total.z / total.zCount)
  return point
}

function centroidFromExtent(extent) {
  if (!Array.isArray(extent) || extent.length < 4) return null
  const minX = Number(extent[0])
  const minY = Number(extent[1])
  const minZ = Number(extent[2])
  const maxX = Number(extent[extent.length >= 6 ? 3 : 2])
  const maxY = Number(extent[extent.length >= 6 ? 4 : 3])
  const maxZ = Number(extent[5])
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null
  const point = [(minX + maxX) / 2, (minY + maxY) / 2]
  if (Number.isFinite(minZ) && Number.isFinite(maxZ)) point.push((minZ + maxZ) / 2)
  return point
}

function isLonLatPoint(point) {
  return Array.isArray(point) &&
    point.length >= 2 &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]) &&
    point[0] >= -180 &&
    point[0] <= 180 &&
    point[1] >= -90 &&
    point[1] <= 90
}

function bboxToPolygon(bbox) {
  if (!Array.isArray(bbox) || bbox.length < 4) return null
  const minX = Number(bbox[0])
  const minY = Number(bbox[1])
  const maxX = Number(bbox[bbox.length >= 6 ? 3 : 2])
  const maxY = Number(bbox[bbox.length >= 6 ? 4 : 3])
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null
  if (minX < -180 || maxX > 180 || minY < -90 || maxY > 90) return null
  return {
    type: 'Polygon',
    coordinates: [[
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
      [minX, minY],
    ]],
  }
}

function bboxToPoint(bbox) {
  const polygon = bboxToPolygon(bbox)
  if (!polygon) return null
  const ring = polygon.coordinates[0]
  return {
    type: 'Point',
    coordinates: [
      (ring[0][0] + ring[1][0]) / 2,
      (ring[0][1] + ring[2][1]) / 2,
    ],
  }
}

function stacAssetSummary(assets = {}) {
  return Object.fromEntries(
    Object.entries(assets).map(([key, asset]) => [key, {
      href: asset?.href ?? null,
      type: asset?.type ?? null,
      title: asset?.title ?? null,
      roles: Array.isArray(asset?.roles) ? asset.roles : [],
    }]),
  )
}

function stacItemToFeature(item, index = 0) {
  if (!item || item.type !== 'Feature') return null
  const geometry = item.geometry ?? bboxToPolygon(item.bbox) ?? bboxToPoint(item.bbox)
  if (!geometry) return null
  return {
    type: 'Feature',
    geometry,
    properties: {
      ...(item.properties ?? {}),
      id: item.id ?? `stac-item-${index + 1}`,
      label: item.properties?.title ?? item.properties?.datetime ?? item.id ?? `STAC item ${index + 1}`,
      sourceFormat: 'stac',
      stacId: item.id ?? null,
      stacVersion: item.stac_version ?? null,
      stacExtensions: item.stac_extensions ?? [],
      collection: item.collection ?? null,
      bbox: item.bbox ?? null,
      assets: stacAssetSummary(item.assets),
      links: Array.isArray(item.links) ? item.links : [],
    },
  }
}

function stacCollectionToFeature(collection) {
  const bbox = collection?.extent?.spatial?.bbox?.[0] ?? collection?.bbox
  const geometry = bboxToPolygon(bbox)
  if (!geometry) return null
  return {
    type: 'Feature',
    geometry,
    properties: {
      id: collection.id ?? 'stac-collection',
      label: collection.title ?? collection.id ?? 'STAC collection',
      sourceFormat: 'stac',
      stacId: collection.id ?? null,
      stacType: collection.type ?? 'Collection',
      stacVersion: collection.stac_version ?? null,
      description: collection.description ?? null,
      license: collection.license ?? null,
      assets: stacAssetSummary(collection.assets),
      links: Array.isArray(collection.links) ? collection.links : [],
      extent: collection.extent ?? null,
    },
  }
}

function stacDocumentToGeoJson(stac) {
  if (!stac || typeof stac !== 'object') {
    throw new Error('STAC_DOCUMENT_REQUIRED')
  }

  let features = []
  if (stac.type === 'Feature') {
    features = [stacItemToFeature(stac)].filter(Boolean)
  } else if (stac.type === 'FeatureCollection' && Array.isArray(stac.features)) {
    features = stac.features.map((item, index) => stacItemToFeature(item, index)).filter(Boolean)
  } else if (stac.type === 'Collection') {
    features = [stacCollectionToFeature(stac)].filter(Boolean)
  } else if (stac.type === 'Catalog') {
    throw new Error('STAC_CATALOG_LINK_DISCOVERY_NOT_IMPLEMENTED')
  } else {
    throw new Error('STAC_ITEM_OR_COLLECTION_REQUIRED')
  }

  const maxItems = numberEnv('TWIN_STUDIO_STAC_MAX_ITEMS', DEFAULT_MAX_STAC_ITEMS)
  if ((stac.features?.length ?? features.length) > maxItems) {
    throw new Error(`STAC_ITEM_LIMIT_EXCEEDED:${maxItems}`)
  }
  if (!features.length) {
    throw new Error('STAC_NO_VALID_GEOMETRIES')
  }

  return {
    geojson: {
      type: 'FeatureCollection',
      features,
    },
    stats: {
      itemsRead: stac.features?.length ?? 1,
      itemsConverted: features.length,
      itemsSkipped: (stac.features?.length ?? 1) - features.length,
      stacType: stac.type,
      stacVersion: stac.stac_version ?? null,
    },
  }
}

function cityJsonReferenceLooksWgs84(cityjson, options = {}) {
  if (options.assumeWgs84 === true || options.assume_wgs84 === true) return true
  const referenceSystem = String(cityjson?.metadata?.referenceSystem ?? cityjson?.metadata?.reference_system ?? '').toLowerCase()
  if (!referenceSystem) return false
  return referenceSystem.includes('4326') ||
    referenceSystem.includes('crs84') ||
    referenceSystem.includes('wgs84') ||
    referenceSystem.includes('wgs 84')
}

function assertCityJsonDocument(cityjson) {
  if (!cityjson || cityjson.type !== 'CityJSON' || typeof cityjson.CityObjects !== 'object') {
    throw new Error('CITYJSON_DOCUMENT_REQUIRED')
  }
  if (!Array.isArray(cityjson.vertices)) {
    throw new Error('CITYJSON_VERTICES_REQUIRED')
  }
  return cityjson
}

function cityJsonToGeoJson(cityjson, options = {}) {
  assertCityJsonDocument(cityjson)
  const entries = Object.entries(cityjson.CityObjects ?? {})
  const maxObjects = numberEnv('TWIN_STUDIO_CITYJSON_MAX_OBJECTS', DEFAULT_MAX_CITYJSON_OBJECTS)
  if (entries.length > maxObjects) {
    throw new Error(`CITYJSON_OBJECT_LIMIT_EXCEEDED:${maxObjects}`)
  }

  const requiresWgs84 = options.requireWgs84 !== false && options.require_wgs84 !== false
  if (requiresWgs84 && !cityJsonReferenceLooksWgs84(cityjson, options)) {
    throw new Error('CITYJSON_WGS84_REFERENCE_REQUIRED')
  }

  const features = []
  let skipped = 0
  for (const [objectId, object] of entries) {
    const coordinates = cityJsonObjectCoordinates(cityjson, object)
    const centroid = centroidFromCoordinates(coordinates) ?? centroidFromExtent(object?.geographicalExtent)
    if (!isLonLatPoint(centroid)) {
      skipped += 1
      continue
    }
    const geometryTypes = (object.geometry ?? [])
      .map((geometry) => geometry?.type)
      .filter(Boolean)
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: centroid.slice(0, 2),
      },
      properties: {
        id: objectId,
        label: object?.attributes?.name ?? object?.attributes?.Name ?? objectId,
        sourceObjectId: objectId,
        cityObjectType: object.type ?? 'CityObject',
        geometryTypes,
        attributes: object.attributes ?? {},
        parents: object.parents ?? [],
        children: object.children ?? [],
        geometryCount: Array.isArray(object.geometry) ? object.geometry.length : 0,
        vertexCount: coordinates.length,
        sourceFormat: 'cityjson',
      },
    })
  }

  if (features.length === 0) {
    throw new Error('CITYJSON_NO_VALID_WGS84_OBJECTS')
  }

  return {
    geojson: {
      type: 'FeatureCollection',
      features,
    },
    stats: {
      objectsRead: entries.length,
      objectsConverted: features.length,
      objectsSkipped: skipped,
      referenceSystem: cityjson?.metadata?.referenceSystem ?? null,
    },
  }
}

function csvRowsToGeoJson(rows, options = {}) {
  const maxRows = numberEnv('TWIN_STUDIO_CSV_MAX_ROWS', DEFAULT_MAX_CSV_ROWS)
  if (rows.length > maxRows) {
    throw new Error(`CSV_ROW_LIMIT_EXCEEDED:${maxRows}`)
  }

  const features = []
  let skipped = 0

  for (const [index, row] of rows.entries()) {
    const geometryField = options.geometryField ?? options.geometry_field
      ? firstExistingField(row, [options.geometryField ?? options.geometry_field])
      : firstExistingField(row, ['geometry', 'geojson', 'geom'])
    const latField = firstExistingField(row, [
      options.latitudeField ?? options.latitude_field ?? options.latField ?? options.lat_field,
      'lat',
      'latitude',
      'y',
    ].filter(Boolean))
    const lonField = firstExistingField(row, [
      options.longitudeField ?? options.longitude_field ?? options.lonField ?? options.lon_field,
      'lon',
      'lng',
      'long',
      'longitude',
      'x',
    ].filter(Boolean))

    const geometry = parseGeometryField(row[geometryField]) ??
      (() => {
        const lat = parseCoordinate(row[latField])
        const lon = parseCoordinate(row[lonField])
        if (lat == null || lon == null) return null
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
        return {
          type: 'Point',
          coordinates: [lon, lat],
        }
      })()

    if (!geometry) {
      skipped += 1
      continue
    }

    const properties = { ...row }
    const idField = firstExistingField(row, [
      options.idField ?? options.id_field,
      'id',
      'stable_id',
      'stableId',
      'uuid',
      'objectid',
      'OBJECTID',
    ].filter(Boolean))
    if (idField && row[idField]) {
      properties.id = row[idField]
    } else {
      properties.id = `csv-row-${index + 1}`
    }

    features.push({
      type: 'Feature',
      properties,
      geometry,
    })
  }

  if (features.length === 0) {
    throw new Error('CSV_NO_VALID_GEOMETRIES')
  }

  return {
    geojson: {
      type: 'FeatureCollection',
      features,
    },
    stats: {
      rowsRead: rows.length,
      rowsConverted: features.length,
      rowsSkipped: skipped,
    },
  }
}

export {
  cityJsonToGeoJson,
  csvRowsToGeoJson,
  parseCsv,
  stacDocumentToGeoJson,
}
