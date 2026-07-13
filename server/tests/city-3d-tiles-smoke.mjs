import assert from 'node:assert/strict'
import fs from 'node:fs'
import { closeProductionPool, getProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured } from '../db/migrate.mjs'
import { buildCity3dBuildingTileset } from '../services/city3dTiles/buildCityTilesetService.mjs'
import { listCity3dTilesetRecords } from '../db/productionTwinStore/city3dTilesetRepository.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || 'guanajuato'
const version = `smoke-${Date.now()}`

function assertGlbHeader(filePath) {
  const glb = fs.readFileSync(filePath)
  assert.equal(glb.subarray(0, 4).toString('utf8'), 'glTF')
  assert.equal(glb.readUInt32LE(4), 2)
}

function assertTilesetJson(tileset, label) {
  assert.equal(tileset.asset.version, '1.1', `${label}:ASSET_VERSION`)
  assert.equal(tileset.extras.twinBaseStudio.transport, '3d-tiles', `${label}:TRANSPORT`)
  const hasSingleContent = Boolean(tileset.root?.content?.uri)
  const hasPartitionChildren = Array.isArray(tileset.root?.children) && tileset.root.children.length > 0
  assert.ok(hasSingleContent || hasPartitionChildren, `${label}:ROOT_CONTENT_OR_CHILDREN_REQUIRED`)
}

function assertRegisteredTileset(record) {
  assert.equal(record.status, 'ready')
  assert.ok(record.featureCount > 0, `${record.tilesetKey}:FEATURE_COUNT_REQUIRED`)
  assert.ok(record.byteSize > 0, `${record.tilesetKey}:BYTE_SIZE_REQUIRED`)
  assert.ok(record.tilesetUrl.includes('/3d-tiles/'), `${record.tilesetKey}:TILESET_URL_REQUIRED`)
  assert.ok(fs.existsSync(record.tilesetPath), `${record.tilesetKey}:TILESET_PATH_MISSING`)

  const tileset = JSON.parse(fs.readFileSync(record.tilesetPath, 'utf8'))
  assertTilesetJson(tileset, record.tilesetKey)

  if (Array.isArray(tileset.root?.children) && tileset.root.children.length > 0) {
    const firstChild = tileset.root.children.find((child) => child?.content?.uri)
    assert.ok(firstChild, `${record.tilesetKey}:PARTITION_CONTENT_REQUIRED`)
    assertGlbHeader(new URL(firstChild.content.uri, `file://${record.assetRoot.replace(/\/?$/, '/')}`).pathname)
  }
}

function isSmokeTilesetRecord(record) {
  return String(record?.tilesetKey ?? '').startsWith('smoke-') ||
    String(record?.version ?? '').includes('smoke')
}

async function markSmokeTilesetComplete({ cityId, tilesetKey, version }) {
  const pool = getProductionPool()
  if (!pool) return
  await pool.query(`
    UPDATE ldt_viewer.city_3d_tilesets
    SET status = 'archived', updated_at = now()
    WHERE city_id = $1
      AND tileset_key = $2
      AND version = $3
  `, [cityId, tilesetKey, version])
  await pool.query(`
    UPDATE ldt_viewer.viewer_artifacts
    SET status = 'archived', active = false, updated_at = now()
    WHERE city_id = $1
      AND artifact_key = $2
      AND artifact_type = '3d-tiles'
      AND version = $3
  `, [cityId, tilesetKey, version])
}

try {
  const readyTilesets = await listCity3dTilesetRecords(cityId, { status: 'ready', limit: 20 })
  const stableReadyTilesets = readyTilesets.filter((record) => !isSmokeTilesetRecord(record))
  for (const record of stableReadyTilesets) {
    assertRegisteredTileset(record)
  }

  const result = await buildCity3dBuildingTileset({
    cityId,
    tilesetKey: 'smoke-buildings',
    version,
    limit: 25,
  })

  assert.equal(result.ok, true)
  assert.equal(result.cityId, cityId)
  assert.equal(result.tilesetKey, 'smoke-buildings')
  assert.ok(result.counts.renderedFeatures > 0, 'RENDERED_FEATURES_REQUIRED')
  assert.ok(result.counts.vertices > 0, 'VERTICES_REQUIRED')
  assert.ok(result.counts.triangles > 0, 'TRIANGLES_REQUIRED')

  const tileset = JSON.parse(fs.readFileSync(result.files.tilesetPath, 'utf8'))
  assertTilesetJson(tileset, 'smoke-buildings')
  assert.equal(tileset.root.content.uri, 'buildings.glb')
  assertGlbHeader(result.files.glbPath)

  const featureIndex = JSON.parse(fs.readFileSync(result.files.featuresPath, 'utf8'))
  assert.ok(Array.isArray(featureIndex.features), 'FEATURE_INDEX_REQUIRED')
  assert.ok(featureIndex.features.length > 0, 'FEATURE_INDEX_EMPTY')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    tilesetUrl: result.tilesetUrl,
    readyTilesetsChecked: stableReadyTilesets.map((record) => ({
      tilesetKey: record.tilesetKey,
      version: record.version,
      featureCount: record.featureCount,
      byteSize: record.byteSize,
    })),
    counts: result.counts,
  }, null, 2))

  await markSmokeTilesetComplete({
    cityId,
    tilesetKey: result.tilesetKey,
    version: result.version,
  })
} finally {
  await closeProductionPool()
}
