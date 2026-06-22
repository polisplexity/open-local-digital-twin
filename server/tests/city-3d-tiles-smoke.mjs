import assert from 'node:assert/strict'
import fs from 'node:fs'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured } from '../db/migrate.mjs'
import { buildCity3dBuildingTileset } from '../services/city3dTiles/buildCityTilesetService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || 'kharkiv'
const version = `smoke-${Date.now()}`

try {
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
  assert.equal(tileset.asset.version, '1.1')
  assert.equal(tileset.root.content.uri, 'buildings.glb')
  assert.equal(tileset.extras.twinBaseStudio.transport, '3d-tiles')

  const glb = fs.readFileSync(result.files.glbPath)
  assert.equal(glb.subarray(0, 4).toString('utf8'), 'glTF')
  assert.equal(glb.readUInt32LE(4), 2)

  const featureIndex = JSON.parse(fs.readFileSync(result.files.featuresPath, 'utf8'))
  assert.ok(Array.isArray(featureIndex.features), 'FEATURE_INDEX_REQUIRED')
  assert.ok(featureIndex.features.length > 0, 'FEATURE_INDEX_EMPTY')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    tilesetUrl: result.tilesetUrl,
    counts: result.counts,
  }, null, 2))
} finally {
  await closeProductionPool()
}

