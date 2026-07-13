import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { getProductionPool } from '../db/postgisPool.mjs'
import { getRuntimeDir } from '../services/stateStore.mjs'
import { registerMvtDirectoryArtifact } from '../services/viewerArtifacts/viewerArtifactScanner.mjs'

function argValue(name, fallback = null) {
  const prefix = `--${name}=`
  const entry = process.argv.find((item) => item.startsWith(prefix))
  return entry ? entry.slice(prefix.length) : fallback
}

function intArg(name, fallback) {
  const value = Number(argValue(name, fallback))
  return Number.isFinite(value) ? Math.trunc(value) : fallback
}

function optionalPositiveIntArg(name) {
  const raw = argValue(name, '')
  if (raw === null || raw === '') return null
  const value = Number(raw)
  if (!Number.isFinite(value)) return null
  const normalized = Math.trunc(value)
  return normalized > 0 ? normalized : null
}

function lon2tile(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z)
}

function lat2tile(lat, z) {
  const rad = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z)
}

function tileRangeForBbox([west, south, east, north], z) {
  const minX = lon2tile(west, z)
  const maxX = lon2tile(east, z)
  const minY = lat2tile(north, z)
  const maxY = lat2tile(south, z)
  const tiles = []
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      tiles.push({ z, x, y })
    }
  }
  return tiles
}

async function cityBbox(client, cityId) {
  const result = await client.query(`
    SELECT
      ST_XMin(box)::float AS west,
      ST_YMin(box)::float AS south,
      ST_XMax(box)::float AS east,
      ST_YMax(box)::float AS north
    FROM (
      SELECT COALESCE(
        (SELECT ST_Extent(geom) FROM public.city_boundaries WHERE city_id = $1),
        (SELECT ST_Extent(geom) FROM ldt_query.city_objects WHERE city_id = $1)
      ) AS box
    ) bounds
  `, [cityId])
  const row = result.rows[0]
  if (!row) throw new Error('CITY_BBOX_NOT_FOUND')
  return [row.west, row.south, row.east, row.north].map(Number)
}

async function buildTile(client, { cityId, z, x, y, maxFeaturesPerTile }) {
  const result = await client.query(`
    WITH bounds AS (
      SELECT
        ST_TileEnvelope($2, $3, $4) AS geom_3857,
        ST_Transform(ST_TileEnvelope($2, $3, $4), 4326) AS geom_4326
    ),
    source_features AS (
      SELECT
        object_id::text AS "objectId",
        semantic_class AS "semanticClass",
        label,
        authority_status AS "authorityStatus",
        source_format AS "sourceFormat",
        ST_AsMVTGeom(
          ST_Transform(geom, 3857),
          bounds.geom_3857,
          4096,
          64,
          true
        ) AS geom
      FROM ldt_query.city_objects
      CROSS JOIN bounds
      WHERE city_id = $1
        AND semantic_class IN ('buildings', 'roads')
        AND geom && bounds.geom_4326
        AND ST_Intersects(geom, bounds.geom_4326)
      ORDER BY semantic_class ASC, object_id ASC
    ),
    limited_features AS (
      SELECT
        *,
        count(*) OVER ()::int AS matched_count
      FROM source_features
      LIMIT $5
    ),
    mvt_features AS (
      SELECT
        "objectId",
        "semanticClass",
        label,
        "authorityStatus",
        "sourceFormat",
        geom
      FROM limited_features
      WHERE geom IS NOT NULL
    ),
    tile_stats AS (
      SELECT COALESCE(max(matched_count), 0)::int AS matched_count
      FROM limited_features
    )
    SELECT
      tile_stats.matched_count,
      tile_agg.feature_count,
      tile_agg.tile
    FROM tile_stats
    CROSS JOIN LATERAL (
      SELECT
        count(*)::int AS feature_count,
        COALESCE(ST_AsMVT(mvt_features, 'features', 4096, 'geom'), ''::bytea) AS tile
      FROM mvt_features
    ) tile_agg
  `, [cityId, z, x, y, maxFeaturesPerTile])
  const row = result.rows[0] ?? {}
  const featureCount = Number(row.feature_count ?? 0)
  const matchedCount = Number(row.matched_count ?? featureCount)

  return {
    featureCount,
    matchedCount,
    tile: Buffer.from(row.tile ?? []),
    truncated: maxFeaturesPerTile !== null && matchedCount > featureCount,
  }
}

const cityId = String(argValue('city', process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato')).trim()
const minZoom = intArg('min-zoom', 10)
const maxZoom = intArg('max-zoom', 14)
const maxFeaturesPerTile = optionalPositiveIntArg('max-features-per-tile') ?? optionalPositiveIntArg('limit')
const activate = process.argv.includes('--activate')
const version = String(argValue('version', new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'))).trim()
const outputRoot = path.join(getRuntimeDir(), 'artifacts', cityId, 'mvt', version)

const pool = getProductionPool()
if (!pool) throw new Error('DATABASE_URL_REQUIRED')

const started = performance.now()
const client = await pool.connect()
try {
  const bbox = await cityBbox(client, cityId)
  fs.rmSync(outputRoot, { recursive: true, force: true })
  fs.mkdirSync(outputRoot, { recursive: true })

  const manifest = {
    cityId,
    version,
    transport: 'mvt-directory',
    generatedAt: new Date().toISOString(),
    bbox,
    minZoom,
    maxZoom,
    maxFeaturesPerTile,
    tiles: [],
    totals: {
      tileCount: 0,
      nonEmptyTileCount: 0,
      featureCount: 0,
      byteSize: 0,
      truncatedTileCount: 0,
    },
  }

  for (let z = minZoom; z <= maxZoom; z += 1) {
    for (const tileCoord of tileRangeForBbox(bbox, z)) {
      const tileStart = performance.now()
      const { featureCount, matchedCount, tile, truncated } = await buildTile(client, {
        cityId,
        ...tileCoord,
        maxFeaturesPerTile,
      })
      const tilePath = path.join(outputRoot, String(z), String(tileCoord.x), `${tileCoord.y}.mvt`)
      fs.mkdirSync(path.dirname(tilePath), { recursive: true })
      fs.writeFileSync(tilePath, tile)
      const byteSize = tile.byteLength
      manifest.tiles.push({
        ...tileCoord,
        featureCount,
        matchedCount,
        byteSize,
        truncated,
        elapsedMs: Math.round(performance.now() - tileStart),
        path: path.relative(outputRoot, tilePath).replaceAll(path.sep, '/'),
      })
      manifest.totals.tileCount += 1
      manifest.totals.nonEmptyTileCount += byteSize > 0 ? 1 : 0
      manifest.totals.featureCount += featureCount
      manifest.totals.byteSize += byteSize
      manifest.totals.truncatedTileCount += truncated ? 1 : 0
    }
  }

  manifest.elapsedMs = Math.round(performance.now() - started)
  fs.writeFileSync(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  const artifact = await registerMvtDirectoryArtifact(cityId, version, { activate })
  console.log(JSON.stringify({ ok: true, outputRoot, manifest, artifact }, null, 2))
} finally {
  client.release()
  await pool.end()
}
