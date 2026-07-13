import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { getProductionPool } from '../db/postgisPool.mjs'
import { upsertCity3dTilesetRecord } from '../db/productionTwinStore/city3dTilesetRepository.mjs'
import { getRuntimeDir } from '../services/stateStore.mjs'
import { buildExtrudedBuildingGlb, regionBoundingVolume } from '../services/city3dTiles/glbBuilder.mjs'

function argValue(name, fallback = null) {
  const prefix = `--${name}=`
  const entry = process.argv.find((item) => item.startsWith(prefix))
  return entry ? entry.slice(prefix.length) : fallback
}

function intArg(name, fallback) {
  const value = Number(argValue(name, fallback))
  return Number.isFinite(value) ? Math.trunc(value) : fallback
}

function parseJson(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function radians(degrees) {
  return (Number(degrees) * Math.PI) / 180
}

function normalizeFeature(row) {
  return {
    objectId: row.object_id,
    label: row.label,
    semanticClass: row.semantic_class,
    heightMeters: row.height_m == null ? null : Number(row.height_m),
    floors: row.floors == null ? null : Number(row.floors),
    buildingType: row.building_type,
    authorityStatus: row.authority_status,
    confidence: row.confidence,
    provider: row.provider,
    sourceFormat: row.source_format,
    sourceFamily: row.source_family,
    sourceCoverageStatus: row.source_coverage_status,
    footprintAreaM2: row.footprint_area_m2 == null ? null : Number(row.footprint_area_m2),
    lon: row.lon == null ? null : Number(row.lon),
    lat: row.lat == null ? null : Number(row.lat),
    geometry: parseJson(row.geometry, null),
  }
}

function regionUnion(children) {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  let minHeight = 0
  let maxHeight = 20
  for (const child of children) {
    const region = child.boundingVolume.region
    west = Math.min(west, region[0])
    south = Math.min(south, region[1])
    east = Math.max(east, region[2])
    north = Math.max(north, region[3])
    minHeight = Math.min(minHeight, region[4])
    maxHeight = Math.max(maxHeight, region[5])
  }
  return [west, south, east, north, minHeight, maxHeight]
}

async function loadPartition(client, { cityId, tileIndex, partitionCount, limit }) {
  const result = await client.query(`
    SELECT
      object_id,
      label,
      semantic_class,
      height_m,
      floors,
      building_type,
      authority_status,
      confidence,
      provider,
      source_format,
      source_family,
      source_coverage_status,
      footprint_area_m2,
      ST_X(ST_PointOnSurface(geom)) AS lon,
      ST_Y(ST_PointOnSurface(geom)) AS lat,
      ST_AsGeoJSON(ST_MakeValid(geom), 6)::jsonb AS geometry
    FROM (
      SELECT
        *,
        ntile($3::int) OVER (
          ORDER BY
            ST_X(ST_PointOnSurface(geom)) ASC,
            ST_Y(ST_PointOnSurface(geom)) ASC,
            object_id ASC
        ) AS tile_number
      FROM ldt_query.city_objects
      WHERE city_id = $1
        AND semantic_class = 'buildings'
        AND geom IS NOT NULL
        AND NOT ST_IsEmpty(geom)
        AND GeometryType(geom) IN ('POLYGON', 'MULTIPOLYGON')
    ) partitioned
    WHERE tile_number = $2
    ORDER BY object_id ASC
    LIMIT $4
  `, [cityId, tileIndex, partitionCount, limit])
  return result.rows.map(normalizeFeature).filter((feature) => feature.geometry)
}

const cityId = String(argValue('city', process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato')).trim()
const tilesetKey = String(argValue('tileset-key', 'base-buildings-partitioned')).trim()
const version = String(argValue('version', new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'))).trim()
const partitionCount = intArg('partitions', 16)
const partitionLimit = intArg('partition-limit', 12000)

const pool = getProductionPool()
if (!pool) throw new Error('DATABASE_URL_REQUIRED')

const started = performance.now()
const client = await pool.connect()
const packageDir = path.join(getRuntimeDir(), '3d-tiles', cityId, tilesetKey, version)
fs.rmSync(packageDir, { recursive: true, force: true })
fs.mkdirSync(packageDir, { recursive: true })

try {
  const children = []
  const manifestChildren = []
  let totalFeatureCount = 0
  let totalVertexCount = 0
  let totalTriangleCount = 0
  let totalByteSize = 0

  for (let tileIndex = 1; tileIndex <= partitionCount; tileIndex += 1) {
    const tileStart = performance.now()
    const features = await loadPartition(client, { cityId, tileIndex, partitionCount, limit: partitionLimit })
    if (!features.length) continue
    const boundingVolume = regionBoundingVolume(features)
    const glbStats = buildExtrudedBuildingGlb(features, {
      metadata: {
        cityId,
        tilesetKey,
        version,
        partition: { tileIndex, partitionCount },
      },
    })
    const childName = `buildings-${String(tileIndex).padStart(3, '0')}.glb`
    const featuresName = `features-${String(tileIndex).padStart(3, '0')}.json`
    fs.writeFileSync(path.join(packageDir, childName), glbStats.glb)
    fs.writeFileSync(path.join(packageDir, featuresName), `${JSON.stringify({
      cityId,
      tilesetKey,
      version,
      tileIndex,
      generatedAt: new Date().toISOString(),
      features: glbStats.featureIndex,
    }, null, 2)}\n`)

    const childByteSize = fs.statSync(path.join(packageDir, childName)).size + fs.statSync(path.join(packageDir, featuresName)).size
    totalFeatureCount += glbStats.featureIndex.length
    totalVertexCount += glbStats.vertexCount
    totalTriangleCount += glbStats.triangleCount
    totalByteSize += childByteSize
    children.push({
      boundingVolume: { region: boundingVolume.region },
      geometricError: 0,
      refine: 'ADD',
      content: { uri: childName },
      metadata: {
        class: 'city_building_partition',
        properties: {
          tileIndex,
          featureCount: glbStats.featureIndex.length,
          vertexCount: glbStats.vertexCount,
          triangleCount: glbStats.triangleCount,
        },
      },
    })
    manifestChildren.push({
      tileIndex,
      featureCount: glbStats.featureIndex.length,
      vertexCount: glbStats.vertexCount,
      triangleCount: glbStats.triangleCount,
      byteSize: childByteSize,
      elapsedMs: Math.round(performance.now() - tileStart),
      files: {
        glb: childName,
        features: featuresName,
      },
      boundingVolume,
    })
  }

  if (!children.length) throw new Error('NO_3D_TILE_PARTITIONS_GENERATED')

  const tileset = {
    asset: {
      version: '1.1',
      generator: 'Twin Base Studio city-3d-tiles-partitioned-builder-v0',
    },
    geometricError: 360,
    root: {
      boundingVolume: { region: regionUnion(children) },
      geometricError: 180,
      refine: 'ADD',
      children,
    },
    extras: {
      twinBaseStudio: {
        transport: '3d-tiles',
        mode: 'partitioned-building-extrusion',
        cityId,
        semanticClasses: ['buildings'],
        partitionCount,
        partitionLimit,
        featureCount: totalFeatureCount,
      },
    },
  }
  const manifest = {
    cityId,
    tilesetKey,
    version,
    generatedAt: new Date().toISOString(),
    transport: '3d-tiles',
    mode: 'partitioned-building-extrusion',
    partitionCount,
    partitionLimit,
    content: {
      featureCount: totalFeatureCount,
      vertexCount: totalVertexCount,
      triangleCount: totalTriangleCount,
      byteSize: totalByteSize,
      partitions: manifestChildren,
    },
    elapsedMs: Math.round(performance.now() - started),
  }
  fs.writeFileSync(path.join(packageDir, 'tileset.json'), `${JSON.stringify(tileset, null, 2)}\n`)
  fs.writeFileSync(path.join(packageDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  totalByteSize += fs.statSync(path.join(packageDir, 'tileset.json')).size + fs.statSync(path.join(packageDir, 'manifest.json')).size

  await upsertCity3dTilesetRecord({
    cityId,
    tilesetKey,
    version,
    status: 'ready',
    contentState: 'generated',
    sourceQuery: {
      language: 'twinql-json',
      cityId,
      classes: ['buildings'],
      scope: { key: 'city' },
      render: { transport: '3d-tiles', mode: 'partitioned-package', partitionCount, partitionLimit },
    },
    semanticClasses: ['buildings'],
    assetRoot: packageDir,
    tilesetUrl: `/api/live/${encodeURIComponent(cityId)}/3d-tiles/${encodeURIComponent(tilesetKey)}/${encodeURIComponent(version)}/tileset.json`,
    tilesetPath: path.join(packageDir, 'tileset.json'),
    featureCount: totalFeatureCount,
    objectCount: totalFeatureCount,
    byteSize: totalByteSize,
    geometricError: tileset.geometricError,
    boundingVolume: { region: tileset.root.boundingVolume.region },
    metadata: {
      files: manifestChildren,
      vertexCount: totalVertexCount,
      triangleCount: totalTriangleCount,
      elapsedMs: manifest.elapsedMs,
    },
  })

  console.log(JSON.stringify({ ok: true, packageDir, manifest }, null, 2))
} finally {
  client.release()
  await pool.end()
}
