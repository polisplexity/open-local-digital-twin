export function closeRing(coords) {
  if (!Array.isArray(coords) || !coords.length) return []
  const normalized = coords
    .map((coord) => [Number(coord[0]), Number(coord[1])])
    .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]))
  if (!normalized.length) return []
  const first = normalized[0]
  const last = normalized[normalized.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    normalized.push([...first])
  }
  return normalized
}

export function centroidFromCoords(coords, city) {
  const points = (coords ?? []).filter((coord) => Array.isArray(coord) && coord.length >= 2)
  if (!points.length) {
    return { lon: city.lon, lat: city.lat }
  }
  const sum = points.reduce(
    (accumulator, [lon, lat]) => ({
      lon: accumulator.lon + Number(lon),
      lat: accumulator.lat + Number(lat),
    }),
    { lon: 0, lat: 0 },
  )
  return {
    lon: sum.lon / points.length,
    lat: sum.lat / points.length,
  }
}

export function projectPoint(lon, lat, originLon, originLat) {
  const cosLat = Math.cos((originLat * Math.PI) / 180)
  const x = (Number(lon) - originLon) * 111320 * cosLat
  const z = (Number(lat) - originLat) * 110540
  return {
    x: Number(x.toFixed(2)),
    z: Number(z.toFixed(2)),
  }
}

export function scenePointsFromCoords(coords, originLon, originLat) {
  return closeRing(coords).map(([lon, lat]) => projectPoint(lon, lat, originLon, originLat))
}

export function bboxFromCoords(coords) {
  const points = (coords ?? []).filter((coord) => Array.isArray(coord) && coord.length >= 2)
  if (!points.length) return null
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const [lon, lat] of points) {
    const nextLon = Number(lon)
    const nextLat = Number(lat)
    if (!Number.isFinite(nextLon) || !Number.isFinite(nextLat)) continue
    minLon = Math.min(minLon, nextLon)
    minLat = Math.min(minLat, nextLat)
    maxLon = Math.max(maxLon, nextLon)
    maxLat = Math.max(maxLat, nextLat)
  }
  if (!Number.isFinite(minLon)) return null
  return [minLon, minLat, maxLon, maxLat]
}

export function expandBounds(bounds, candidate) {
  if (!candidate) return bounds
  if (!bounds) return [...candidate]
  return [
    Math.min(bounds[0], candidate[0]),
    Math.min(bounds[1], candidate[1]),
    Math.max(bounds[2], candidate[2]),
    Math.max(bounds[3], candidate[3]),
  ]
}

export function haversineKm(left, right) {
  if (!left || !right) return 0
  const [lon1, lat1] = left.map(Number)
  const [lon2, lat2] = right.map(Number)
  const earthRadius = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(a))
}

export function lineLengthKm(coords = []) {
  let distance = 0
  for (let index = 1; index < coords.length; index += 1) {
    distance += haversineKm(coords[index - 1], coords[index])
  }
  return Number(distance.toFixed(2))
}

export function projectedPolygonAreaSquareMeters(points = []) {
  if (!Array.isArray(points) || points.length < 3) return 0
  let area = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    area += current.x * next.z - next.x * current.z
  }
  return Math.abs(area) / 2
}

export function boundaryRings(boundary) {
  const geometry = boundary?.features?.[0]?.geometry ?? null
  if (!geometry) return []
  if (geometry.type === 'Polygon') {
    return [(geometry.coordinates ?? [])[0] ?? []]
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates ?? []).map((polygon) => polygon[0] ?? [])
  }
  return []
}

export function geometryExteriorRings(geometry) {
  if (!geometry) return []
  if (geometry.type === 'Polygon') {
    return [(geometry.coordinates ?? [])[0] ?? []]
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates ?? []).map((polygon) => polygon?.[0] ?? [])
  }
  return []
}

export function featureCollectionAreaSquareMeters(collection, center) {
  return (collection?.features ?? []).reduce((sum, feature) => {
    const rings = geometryExteriorRings(feature.geometry)
    return sum + rings.reduce(
      (ringSum, ring) => ringSum + projectedPolygonAreaSquareMeters(scenePointsFromCoords(ring, center.lon, center.lat)),
      0,
    )
  }, 0)
}

export function pointInRing([lon, lat], ring = []) {
  let inside = false
  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index, index += 1) {
    const [currentLon, currentLat] = ring[index] ?? []
    const [previousLon, previousLat] = ring[previousIndex] ?? []
    const intersects =
      Number(currentLat) > lat !== Number(previousLat) > lat &&
      lon <
        ((Number(previousLon) - Number(currentLon)) * (lat - Number(currentLat))) /
          (Number(previousLat) - Number(currentLat) || Number.EPSILON) +
          Number(currentLon)
    if (intersects) inside = !inside
  }
  return inside
}

export function coordinateInBoundary(coord, rings = []) {
  if (!rings.length) return true
  return rings.some((ring) => pointInRing(coord, ring))
}

export function elementIntersectsBoundary(element, rings = []) {
  if (!rings.length) return true
  if (Number.isFinite(Number(element.lon)) && Number.isFinite(Number(element.lat))) {
    return coordinateInBoundary([Number(element.lon), Number(element.lat)], rings)
  }
  return (element.geometry ?? []).some((point) =>
    coordinateInBoundary([Number(point.lon), Number(point.lat)], rings),
  )
}

export function fallbackBoundary(center) {
  const radiusLat = 0.018
  const radiusLon = 0.032
  const coords = closeRing([
    [center.lon - radiusLon, center.lat - radiusLat],
    [center.lon + radiusLon, center.lat - radiusLat],
    [center.lon + radiusLon, center.lat + radiusLat],
    [center.lon - radiusLon, center.lat + radiusLat],
  ])
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { label: 'Fallback scope' },
        geometry: { type: 'Polygon', coordinates: [coords] },
      },
    ],
  }
}

export function buildBoundaryTiles(boundary, center, { maxTiles = 48 } = {}) {
  const rings = boundaryRings(boundary)
  const bounds = bboxFromCoords(rings.flat()) ?? [
    center.lon - 0.032,
    center.lat - 0.018,
    center.lon + 0.032,
    center.lat + 0.018,
  ]
  const [west, south, east, north] = bounds
  const latSpan = Math.max(north - south, 0.001)
  const lonSpan = Math.max(east - west, 0.001)
  maxTiles = Math.max(1, Math.floor(Number(maxTiles) || 48))
  const aspect = Math.max(0.2, lonSpan / latSpan)
  let columns = Math.max(1, Math.ceil(Math.sqrt(maxTiles * aspect)))
  let rows = Math.max(1, Math.ceil(maxTiles / columns))

  while (columns * rows > maxTiles) {
    if (columns >= rows && columns > 1) columns -= 1
    else if (rows > 1) rows -= 1
    else break
  }

  const tiles = []
  const latStep = latSpan / rows
  const lonStep = lonSpan / columns
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const tileSouth = south + row * latStep
      const tileNorth = row === rows - 1 ? north : south + (row + 1) * latStep
      const tileWest = west + column * lonStep
      const tileEast = column === columns - 1 ? east : west + (column + 1) * lonStep
      tiles.push({
        id: `tile-${row + 1}-${column + 1}`,
        south: Number(tileSouth.toFixed(7)),
        west: Number(tileWest.toFixed(7)),
        north: Number(tileNorth.toFixed(7)),
        east: Number(tileEast.toFixed(7)),
      })
    }
  }

  return {
    bounds,
    rows,
    columns,
    tiles,
  }
}

export function collectGeometryCoordinates(geometry) {
  if (!geometry?.coordinates) return []
  const coordinates = []
  const visit = (value) => {
    if (!Array.isArray(value)) return
    if (
      value.length >= 2 &&
      Number.isFinite(Number(value[0])) &&
      Number.isFinite(Number(value[1]))
    ) {
      coordinates.push([Number(value[0]), Number(value[1])])
      return
    }
    value.forEach(visit)
  }
  visit(geometry.coordinates)
  return coordinates
}

export function boundsFromFeatureCollection(collection) {
  return (collection?.features ?? []).reduce(
    (bounds, feature) => expandBounds(bounds, bboxFromCoords(collectGeometryCoordinates(feature.geometry))),
    null,
  )
}
