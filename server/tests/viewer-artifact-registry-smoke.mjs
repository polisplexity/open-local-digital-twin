import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import { getRuntimeDir } from '../services/stateStore.mjs'
import {
  registerMvtDirectoryArtifact,
  registerPmtilesArtifact,
  registerThreeDTilesArtifact,
} from '../services/viewerArtifacts/viewerArtifactScanner.mjs'
import {
  listDeliverableThreeDTilesArtifacts,
  resolveMvtTileArtifact,
  resolvePmtilesArtifact,
  resolveThreeDTilesArtifactAsset,
  viewerArtifactResponseHeaders,
} from '../services/viewerArtifacts/viewerArtifactDelivery.mjs'
import {
  activateViewerArtifactRecord,
  listViewerArtifactRecords,
} from '../db/productionTwinStore/viewerArtifactRepository.mjs'
import { getProductionPool } from '../db/postgisPool.mjs'
import { upsertCity3dTilesetRecord } from '../db/productionTwinStore/city3dTilesetRepository.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
const version = `smoke-${Date.now()}`
const runtimeDir = getRuntimeDir()
let previousActiveArtifacts = []

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`)
}

function writeSmokeMvtDirectory() {
  const root = path.join(runtimeDir, 'artifacts', cityId, 'mvt', version)
  fs.mkdirSync(path.join(root, '10', '1'), { recursive: true })
  fs.writeFileSync(path.join(root, '10', '1', '1.mvt'), Buffer.from([0x1a, 0x00]))
  writeJson(path.join(root, 'manifest.json'), {
    cityId,
    version,
    transport: 'mvt-directory',
    generatedAt: new Date().toISOString(),
    bbox: [-101.3, 20.9, -101.2, 21.0],
    minZoom: 10,
    maxZoom: 10,
    limit: 50,
    totals: {
      tileCount: 1,
      nonEmptyTileCount: 1,
      featureCount: 1,
      byteSize: 2,
    },
    elapsedMs: 1,
  })
  return root
}


function writeSmokeThreeDTilesPackage() {
  const tilesetKey = 'smoke-buildings'
  const root = path.join(runtimeDir, '3d-tiles', cityId, tilesetKey, version)
  fs.mkdirSync(root, { recursive: true })
  const tilesetPath = path.join(root, 'tileset.json')
  const glbPath = path.join(root, 'buildings.glb')
  const featuresPath = path.join(root, 'features.json')
  const manifestPath = path.join(root, 'manifest.json')
  writeJson(tilesetPath, {
    asset: { version: '1.1', generator: 'viewer-artifact-registry-smoke' },
    geometricError: 0,
    root: {
      boundingVolume: { region: [-1.769, 0.365, -1.768, 0.366, 0, 24] },
      geometricError: 0,
      refine: 'ADD',
      content: { uri: 'buildings.glb' },
    },
    extras: { twinBaseStudio: { transport: '3d-tiles', semanticClasses: ['buildings'] } },
  })
  fs.writeFileSync(glbPath, Buffer.from('glTF smoke 3d tiles payload\n', 'utf8'))
  writeJson(featuresPath, { cityId, tilesetKey, version, features: [{ objectId: 'smoke-building-1' }] })
  writeJson(manifestPath, { cityId, tilesetKey, version, transport: '3d-tiles', featureCount: 1 })
  return { tilesetKey, root, tilesetPath, glbPath, byteSize: directorySize(root) }
}

function directorySize(directoryPath) {
  let total = 0
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const fullPath = path.join(directoryPath, entry.name)
    if (entry.isDirectory()) total += directorySize(fullPath)
    if (entry.isFile()) total += fs.statSync(fullPath).size
  }
  return total
}

function writeSmokePmtilesPackage() {
  const root = path.join(runtimeDir, 'artifacts', cityId, 'pmtiles')
  fs.mkdirSync(root, { recursive: true })
  const pmtilesPath = path.join(root, `${version}.pmtiles`)
  fs.writeFileSync(pmtilesPath, Buffer.from('PMTiles smoke artifact\n', 'utf8'))
  writeJson(path.join(root, `${version}.manifest.json`), {
    ok: true,
    cityId,
    version,
    transport: 'pmtiles',
    sourceMvtDir: path.join(runtimeDir, 'artifacts', cityId, 'mvt', version),
    pmtilesPath,
    tileCount: 1,
    tileBytes: 2,
    pmtilesBytes: fs.statSync(pmtilesPath).size,
    bbox: [-101.3, 20.9, -101.2, 21.0],
    minZoom: 10,
    maxZoom: 10,
  })
  return pmtilesPath
}

async function archiveSmokeArtifacts() {
  const pool = getProductionPool()
  if (!pool) return
  await pool.query(`
    UPDATE ldt_viewer.viewer_artifacts
    SET status = 'archived', active = false, updated_at = now()
    WHERE city_id = $1
      AND version = $2
      AND artifact_key IN ('base-city-mvt', 'base-city-pmtiles', 'smoke-buildings')
  `, [cityId, version])
  await pool.query(`
    UPDATE ldt_viewer.city_3d_tilesets
    SET status = 'archived', updated_at = now()
    WHERE city_id = $1
      AND tileset_key = 'smoke-buildings'
      AND version = $2
  `, [cityId, version])
}

async function restorePreviousActiveArtifacts() {
  for (const artifact of previousActiveArtifacts) {
    await activateViewerArtifactRecord(cityId, {
      artifactKey: artifact.artifactKey,
      artifactType: artifact.artifactType,
      version: artifact.version,
    })
  }
}

try {
  await runProductionMigrations()
  previousActiveArtifacts = (await listViewerArtifactRecords(cityId, { active: true, limit: 50 }))
    .filter((artifact) => ['base-city-mvt', 'base-city-pmtiles', 'smoke-buildings'].includes(artifact.artifactKey))
  const mvtRoot = writeSmokeMvtDirectory()
  const pmtilesPath = writeSmokePmtilesPackage()
  const threeDTilesPackage = writeSmokeThreeDTilesPackage()

  const mvtArtifact = await registerMvtDirectoryArtifact(cityId, version, { activate: true })
  const pmtilesArtifact = await registerPmtilesArtifact(cityId, version, { activate: true })
  const threeDTilesRecord = await upsertCity3dTilesetRecord({
    cityId,
    tilesetKey: threeDTilesPackage.tilesetKey,
    version,
    status: 'ready',
    contentState: 'generated',
    sourceQuery: { language: 'smoke', classes: ['buildings'] },
    semanticClasses: ['buildings'],
    assetRoot: threeDTilesPackage.root,
    tilesetUrl: `/api/live/${encodeURIComponent(cityId)}/3d-tiles/${threeDTilesPackage.tilesetKey}/${version}/tileset.json`,
    tilesetPath: threeDTilesPackage.tilesetPath,
    featureCount: 1,
    objectCount: 1,
    byteSize: threeDTilesPackage.byteSize,
    geometricError: 0,
    boundingVolume: { region: [-1.769, 0.365, -1.768, 0.366, 0, 24] },
    metadata: { generator: 'viewer-artifact-registry-smoke' },
  })
  const threeDTilesArtifact = await registerThreeDTilesArtifact(cityId, threeDTilesRecord, { activate: true })

  assert.equal(mvtArtifact.artifactType, 'mvt-directory')
  assert.equal(mvtArtifact.active, true)
  assert.equal(mvtArtifact.tileCount, 1)
  assert.ok(mvtArtifact.checksum?.startsWith('sha256:'), 'MVT_CHECKSUM_REQUIRED')
  assert.equal(pmtilesArtifact.artifactType, 'pmtiles')
  assert.equal(pmtilesArtifact.active, true)
  assert.ok(pmtilesArtifact.byteSize > 0, 'PMTILES_BYTE_SIZE_REQUIRED')
  assert.ok(pmtilesArtifact.checksum?.startsWith('sha256:'), 'PMTILES_CHECKSUM_REQUIRED')
  assert.equal(threeDTilesArtifact.artifactType, '3d-tiles')
  assert.equal(threeDTilesArtifact.active, true)
  assert.equal(threeDTilesArtifact.featureCount, 1)
  assert.ok(threeDTilesArtifact.byteSize > 0, 'THREED_TILES_BYTE_SIZE_REQUIRED')
  assert.ok(threeDTilesArtifact.checksum?.startsWith('sha256:'), 'THREED_TILES_CHECKSUM_REQUIRED')
  assert.ok(threeDTilesArtifact.localPath.endsWith(`${path.sep}${version}`), 'THREED_TILES_LOCAL_PATH_SHOULD_BE_PACKAGE_ROOT')

  const activatedMvt = await activateViewerArtifactRecord(cityId, {
    artifactKey: 'base-city-mvt',
    artifactType: 'mvt-directory',
    version,
  })
  assert.equal(activatedMvt.active, true)

  const artifacts = await listViewerArtifactRecords(cityId, { limit: 20 })
  assert.ok(artifacts.some((artifact) => artifact.artifactType === 'mvt-directory' && artifact.version === version), 'MVT_ARTIFACT_LIST_MISSING')
  assert.ok(artifacts.some((artifact) => artifact.artifactType === 'pmtiles' && artifact.version === version), 'PMTILES_ARTIFACT_LIST_MISSING')
  assert.ok(artifacts.some((artifact) => artifact.artifactType === '3d-tiles' && artifact.version === version), 'THREED_TILES_ARTIFACT_LIST_MISSING')

  const exactMvtRecords = await listViewerArtifactRecords(cityId, {
    artifactKey: 'base-city-mvt',
    artifactType: 'mvt-directory',
    version,
    limit: 5,
  })
  assert.equal(exactMvtRecords.length, 1, 'VIEWER_ARTIFACT_EXACT_FILTER_MISSING')

  const mvtDelivery = await resolveMvtTileArtifact({ cityId, version, z: 10, x: 1, y: 1 })
  assert.equal(mvtDelivery?.artifact?.id, mvtArtifact.id, 'MVT_DELIVERY_ARTIFACT_MISMATCH')
  assert.equal(mvtDelivery?.filePath, path.join(mvtRoot, '10', '1', '1.mvt'), 'MVT_DELIVERY_PATH_MISMATCH')
  assert.ok(viewerArtifactResponseHeaders(mvtDelivery.artifact)['X-Twin-Viewer-Artifact-Checksum'], 'MVT_DELIVERY_HEADERS_CHECKSUM_MISSING')

  const pmtilesDelivery = await resolvePmtilesArtifact({ cityId, version })
  assert.equal(pmtilesDelivery?.artifact?.id, pmtilesArtifact.id, 'PMTILES_DELIVERY_ARTIFACT_MISMATCH')
  assert.equal(pmtilesDelivery?.filePath, pmtilesPath, 'PMTILES_DELIVERY_PATH_MISMATCH')

  const threeDTilesDelivery = await resolveThreeDTilesArtifactAsset({
    cityId,
    tilesetKey: threeDTilesPackage.tilesetKey,
    version,
    assetName: 'tileset.json',
  })
  assert.equal(threeDTilesDelivery?.artifact?.id, threeDTilesArtifact.id, 'THREED_TILES_DELIVERY_ARTIFACT_MISMATCH')
  assert.equal(threeDTilesDelivery?.filePath, threeDTilesPackage.tilesetPath, 'THREED_TILES_DELIVERY_PATH_MISMATCH')

  const deliverableTilesets = await listDeliverableThreeDTilesArtifacts(cityId, {
    tilesetKey: threeDTilesPackage.tilesetKey,
    includeSmoke: true,
  })
  assert.ok(deliverableTilesets.some((record) => record.viewerArtifact?.id === threeDTilesArtifact.id), 'THREED_TILES_DELIVERABLE_LIST_MISSING')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    version,
    mvt: {
      id: mvtArtifact.id,
      active: mvtArtifact.active,
      checksum: mvtArtifact.checksum,
      localPath: mvtRoot,
    },
    pmtiles: {
      id: pmtilesArtifact.id,
      active: pmtilesArtifact.active,
      checksum: pmtilesArtifact.checksum,
      localPath: pmtilesPath,
    },
    threeDTiles: {
      id: threeDTilesArtifact.id,
      active: threeDTilesArtifact.active,
      checksum: threeDTilesArtifact.checksum,
      localPath: threeDTilesArtifact.localPath,
      uri: threeDTilesArtifact.uri,
    },
  }, null, 2))
} finally {
  await archiveSmokeArtifacts().catch(() => {})
  await restorePreviousActiveArtifacts().catch(() => {})
  await closeProductionPool()
}
