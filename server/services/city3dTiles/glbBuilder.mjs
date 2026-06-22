const WGS84_A = 6378137
const WGS84_F = 1 / 298.257223563
const WGS84_E2 = WGS84_F * (2 - WGS84_F)
const DEGREES_TO_RADIANS = Math.PI / 180
const METERS_PER_DEGREE_LAT = 111320

function finiteNumber(value, fallback = null) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function radians(degrees) {
  return degrees * DEGREES_TO_RADIANS
}

function geodeticToEcef(lonDegrees, latDegrees, heightMeters = 0) {
  const lon = radians(lonDegrees)
  const lat = radians(latDegrees)
  const sinLat = Math.sin(lat)
  const cosLat = Math.cos(lat)
  const sinLon = Math.sin(lon)
  const cosLon = Math.cos(lon)
  const normalRadius = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat)

  return [
    (normalRadius + heightMeters) * cosLat * cosLon,
    (normalRadius + heightMeters) * cosLat * sinLon,
    (normalRadius * (1 - WGS84_E2) + heightMeters) * sinLat,
  ]
}

function eastNorthUpMatrix(lonDegrees, latDegrees, heightMeters = 0) {
  const lon = radians(lonDegrees)
  const lat = radians(latDegrees)
  const sinLat = Math.sin(lat)
  const cosLat = Math.cos(lat)
  const sinLon = Math.sin(lon)
  const cosLon = Math.cos(lon)
  const origin = geodeticToEcef(lonDegrees, latDegrees, heightMeters)
  const east = [-sinLon, cosLon, 0]
  const north = [-sinLat * cosLon, -sinLat * sinLon, cosLat]
  const up = [cosLat * cosLon, cosLat * sinLon, sinLat]

  return [
    east[0], east[1], east[2], 0,
    north[0], north[1], north[2], 0,
    up[0], up[1], up[2], 0,
    origin[0], origin[1], origin[2], 1,
  ]
}

function localMeters([lon, lat], center) {
  const centerLatRadians = radians(center.lat)
  return [
    (lon - center.lon) * Math.cos(centerLatRadians) * METERS_PER_DEGREE_LAT,
    (lat - center.lat) * METERS_PER_DEGREE_LAT,
  ]
}

function geometryRings(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return []
  if (geometry.type === 'Polygon') return geometry.coordinates.slice(0, 1)
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((polygon) => polygon?.[0])
      .filter((ring) => Array.isArray(ring))
  }
  return []
}

function cleanRing(ring) {
  const cleaned = ring
    .map((coordinate) => [
      finiteNumber(coordinate?.[0]),
      finiteNumber(coordinate?.[1]),
    ])
    .filter(([lon, lat]) => lon != null && lat != null)

  if (cleaned.length > 2) {
    const first = cleaned[0]
    const last = cleaned[cleaned.length - 1]
    if (Math.abs(first[0] - last[0]) < 1e-12 && Math.abs(first[1] - last[1]) < 1e-12) {
      cleaned.pop()
    }
  }

  return cleaned.length >= 3 ? cleaned : []
}

function featureHeightMeters(feature) {
  const explicitHeight = finiteNumber(feature.heightMeters)
  if (explicitHeight != null && explicitHeight > 0) return Math.min(220, Math.max(2.5, explicitHeight))
  const floors = finiteNumber(feature.floors)
  if (floors != null && floors > 0) return Math.min(220, Math.max(3, floors * 3.2))
  return 8
}

function pushExtrudedRing({ ring, feature, center, positions, indices, featureIndex }) {
  const localRing = ring.map((coordinate) => localMeters(coordinate, center))
  const height = featureHeightMeters(feature)
  const vertexStart = positions.length / 3
  const indexStart = indices.length

  const bottomOffset = vertexStart
  for (const [x, y] of localRing) {
    positions.push(x, y, 0)
  }

  const topOffset = positions.length / 3
  for (const [x, y] of localRing) {
    positions.push(x, y, height)
  }

  const centerOffset = positions.length / 3
  const centerPoint = localRing.reduce((accumulator, [x, y]) => {
    accumulator[0] += x
    accumulator[1] += y
    return accumulator
  }, [0, 0])
  positions.push(centerPoint[0] / localRing.length, centerPoint[1] / localRing.length, height)

  for (let index = 0; index < localRing.length; index += 1) {
    const next = (index + 1) % localRing.length
    indices.push(bottomOffset + index, bottomOffset + next, topOffset + next)
    indices.push(bottomOffset + index, topOffset + next, topOffset + index)
    indices.push(centerOffset, topOffset + index, topOffset + next)
  }

  return {
    objectId: feature.objectId,
    label: feature.label,
    semanticClass: feature.semanticClass,
    heightMeters: height,
    vertexStart,
    vertexCount: (positions.length / 3) - vertexStart,
    indexStart,
    indexCount: indices.length - indexStart,
    featureIndex,
  }
}

function paddedBuffer(buffer, padByte = 0) {
  const padding = (4 - (buffer.length % 4)) % 4
  if (!padding) return buffer
  return Buffer.concat([buffer, Buffer.alloc(padding, padByte)])
}

function minMaxPositions(positions) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[index + axis]
      min[axis] = Math.min(min[axis], value)
      max[axis] = Math.max(max[axis], value)
    }
  }
  return { min, max }
}

function buildGlb({ positions, indices, center, metadata }) {
  const positionArray = Float32Array.from(positions)
  const indexComponentType = positions.length / 3 > 65535 ? 5125 : 5123
  const indexArray = indexComponentType === 5125
    ? Uint32Array.from(indices)
    : Uint16Array.from(indices)

  const positionBuffer = Buffer.from(positionArray.buffer)
  const indexBuffer = Buffer.from(indexArray.buffer)
  const indexByteOffset = paddedBuffer(positionBuffer).length
  const binBuffer = paddedBuffer(Buffer.concat([paddedBuffer(positionBuffer), indexBuffer]))
  const bounds = minMaxPositions(positions)

  const gltf = {
    asset: {
      version: '2.0',
      generator: 'Twin Base Studio city-3d-tiles-builder-v0',
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{
      mesh: 0,
      matrix: eastNorthUpMatrix(center.lon, center.lat, 0),
    }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0 },
        indices: 1,
        material: 0,
        mode: 4,
      }],
    }],
    materials: [{
      pbrMetallicRoughness: {
        baseColorFactor: [0.66, 0.74, 0.82, 0.72],
        metallicFactor: 0,
        roughnessFactor: 0.82,
      },
      alphaMode: 'BLEND',
      doubleSided: true,
    }],
    buffers: [{ byteLength: binBuffer.length }],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: positionBuffer.length,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: indexByteOffset,
        byteLength: indexBuffer.length,
        target: 34963,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        byteOffset: 0,
        componentType: 5126,
        count: positionArray.length / 3,
        type: 'VEC3',
        min: bounds.min,
        max: bounds.max,
      },
      {
        bufferView: 1,
        byteOffset: 0,
        componentType: indexComponentType,
        count: indexArray.length,
        type: 'SCALAR',
      },
    ],
    extras: {
      twinBaseStudio: metadata,
    },
  }

  const jsonBuffer = paddedBuffer(Buffer.from(JSON.stringify(gltf), 'utf8'), 0x20)
  const totalLength = 12 + 8 + jsonBuffer.length + 8 + binBuffer.length
  const header = Buffer.alloc(12)
  header.write('glTF', 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(totalLength, 8)

  const jsonHeader = Buffer.alloc(8)
  jsonHeader.writeUInt32LE(jsonBuffer.length, 0)
  jsonHeader.writeUInt32LE(0x4E4F534A, 4)

  const binHeader = Buffer.alloc(8)
  binHeader.writeUInt32LE(binBuffer.length, 0)
  binHeader.writeUInt32LE(0x004E4942, 4)

  return Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, binBuffer])
}

export function buildExtrudedBuildingGlb(features, options = {}) {
  const centers = features
    .map((feature) => ({
      lon: finiteNumber(feature.lon),
      lat: finiteNumber(feature.lat),
    }))
    .filter((center) => center.lon != null && center.lat != null)

  if (!centers.length) {
    throw new Error('TILESET_FEATURE_CENTER_REQUIRED')
  }

  const center = {
    lon: centers.reduce((total, entry) => total + entry.lon, 0) / centers.length,
    lat: centers.reduce((total, entry) => total + entry.lat, 0) / centers.length,
  }

  const positions = []
  const indices = []
  const featureIndex = []

  for (const feature of features) {
    for (const rawRing of geometryRings(feature.geometry)) {
      const ring = cleanRing(rawRing)
      if (!ring.length || ring.length > 500) continue
      featureIndex.push(pushExtrudedRing({
        ring,
        feature,
        center,
        positions,
        indices,
        featureIndex: featureIndex.length,
      }))
    }
  }

  if (!positions.length || !indices.length) {
    throw new Error('TILESET_GEOMETRY_EMPTY')
  }

  const glb = buildGlb({
    positions,
    indices,
    center,
    metadata: {
      semanticClasses: ['buildings'],
      generatedAt: new Date().toISOString(),
      source: 'ldt_query.city_objects',
      ...options.metadata,
    },
  })

  return {
    glb,
    center,
    featureIndex,
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
  }
}

export function regionBoundingVolume(features) {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  let maxHeight = 0

  for (const feature of features) {
    maxHeight = Math.max(maxHeight, featureHeightMeters(feature))
    for (const rawRing of geometryRings(feature.geometry)) {
      for (const coordinate of rawRing) {
        const lon = finiteNumber(coordinate?.[0])
        const lat = finiteNumber(coordinate?.[1])
        if (lon == null || lat == null) continue
        west = Math.min(west, lon)
        south = Math.min(south, lat)
        east = Math.max(east, lon)
        north = Math.max(north, lat)
      }
    }
  }

  if (![west, south, east, north].every(Number.isFinite)) {
    throw new Error('TILESET_BOUNDING_REGION_EMPTY')
  }

  return {
    region: [
      radians(west),
      radians(south),
      radians(east),
      radians(north),
      0,
      Math.max(20, maxHeight),
    ],
    degrees: { west, south, east, north },
  }
}

