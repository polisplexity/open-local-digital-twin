import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { closeProductionPool, getProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import { buildExternalDataFactoryResult } from '../tools/run-external-data-factory-dispatch.mjs'
import {
  claimServerToServerPullDispatch,
  registerProcessingNode,
  runOfflineDataFactoryJob,
  stageDataFactoryArtifactManifest,
  submitServerToServerPullDispatchResult,
} from '../services/ldtOpsService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

function writeJson(file, value) {
  writeFile(file, `${JSON.stringify(value, null, 2)}\n`)
}

function createArtifactFixtures(root, prefix) {
  const pmtilesPath = path.join(root, `${prefix}.pmtiles`)
  const mvtRoot = path.join(root, `${prefix}-mvt`)
  const threeDTilesRoot = path.join(root, `${prefix}-3d-tiles`)
  const dumpPath = path.join(root, `${prefix}.postgis.sql.gz`)

  writeFile(pmtilesPath, Buffer.from('pmtiles artifact transfer smoke\n', 'utf8'))
  writeFile(path.join(mvtRoot, '10', '1', '1.mvt'), Buffer.from([0x1a, 0x00]))
  writeJson(path.join(mvtRoot, 'manifest.json'), {
    transport: 'mvt-directory',
    tileCount: 1,
    featureCount: 1,
  })
  writeJson(path.join(threeDTilesRoot, 'tileset.json'), {
    asset: { version: '1.1' },
    geometricError: 0,
    root: {
      boundingVolume: { region: [-1.769, 0.365, -1.768, 0.366, 0, 20] },
      geometricError: 0,
      refine: 'ADD',
    },
  })
  writeFile(path.join(threeDTilesRoot, 'buildings.glb'), Buffer.from('glb smoke payload\n', 'utf8'))
  writeFile(dumpPath, Buffer.from('compressed-postgis-dump-smoke\n', 'utf8'))

  return [
    {
      artifactKind: 'pmtiles',
      artifactKey: 'base-city-pmtiles',
      version: prefix,
      sourcePath: pmtilesPath,
      mediaType: 'application/vnd.pmtiles',
    },
    {
      artifactKind: 'mvt-directory',
      artifactKey: 'base-city-mvt',
      version: prefix,
      sourcePath: mvtRoot,
      mediaType: 'application/vnd.mapbox-vector-tile',
    },
    {
      artifactKind: '3d-tiles',
      artifactKey: 'base-buildings',
      version: prefix,
      sourcePath: threeDTilesRoot,
      mediaType: 'application/vnd.ogc.3dtiles+json',
    },
    {
      artifactKind: 'postgis-dump',
      artifactKey: 'city-rebuild-dump',
      version: prefix,
      sourcePath: dumpPath,
      mediaType: 'application/gzip',
    },
  ]
}

async function registerPullNode({ nodeKey, storeKey, storeType, storeUri, storePublicConfig, stageKey }) {
  const registered = await registerProcessingNode({
    nodeKey,
    displayName: `Artifact Transfer Smoke ${nodeKey}`,
    providerType: 'server-to-server-pull',
    connectionMode: 'pull',
    runtimeKind: 'docker',
    runtimeVersion: '2026.06.artifact-transfer-smoke',
    imageRef: 'twin-base-studio-datafactory:artifact-transfer-smoke',
    status: 'registered',
    lifecycleStatus: 'generated',
    capabilities: {
      providerContract: 'server-to-server-pull-provider.v1',
      artifactTransfer: true,
      supports: [stageKey],
    },
    artifactStore: {
      storeKey,
      displayName: `Artifact Transfer Smoke Store ${storeKey}`,
      storeType,
      uri: storeUri,
      publicConfig: storePublicConfig,
    },
    stageBindings: [stageKey],
    issueRuntimeToken: true,
    tokenName: 'artifact-transfer-runtime-token',
    registeredBy: 'data-factory-artifact-transfer-smoke',
  })
  assert.equal(registered.ok, true, registered.error || `ARTIFACT_TRANSFER_NODE_REGISTER_FAILED:${nodeKey}`)
  assert.ok(registered.runtimeToken, `ARTIFACT_TRANSFER_TOKEN_MISSING:${nodeKey}`)
  return registered
}

async function prepareAndClaim({ cityId, stageKey, nodeKey, runtimeToken, runnerId }) {
  const prepared = await runOfflineDataFactoryJob({
    cityId,
    stageKey,
    executorProfile: 'external-worker',
    requestedBy: 'data-factory-artifact-transfer-smoke',
    submittedBy: 'data-factory-artifact-transfer-smoke',
    runnerOptions: {
      artifactTransferSmoke: true,
    },
  })
  assert.equal(prepared.ok, true, prepared.error || 'ARTIFACT_TRANSFER_DISPATCH_PREPARE_FAILED')

  const claim = await claimServerToServerPullDispatch({
    nodeKey,
    rawToken: runtimeToken,
    cityId,
    stageKey,
    runId: prepared.runId,
    runnerId,
  })
  assert.equal(claim.ok, true, claim.error || 'ARTIFACT_TRANSFER_CLAIM_FAILED')
  assert.equal(claim.claimed, true, 'ARTIFACT_TRANSFER_CLAIM_EMPTY')
  return claim
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
assert.equal(
  packageJson.scripts['ops:stage-data-factory-artifacts'],
  'node server/tools/stage-data-factory-artifacts.mjs',
  'ARTIFACT_STAGE_SCRIPT_MISSING',
)
assert.equal(
  packageJson.scripts['test:data-factory-artifact-transfer-smoke'],
  'node server/tests/data-factory-artifact-transfer-smoke.mjs',
  'ARTIFACT_TRANSFER_SMOKE_SCRIPT_MISSING',
)

const routeSource = fs.readFileSync('server/routes/adminWorkflowRoutes.mjs', 'utf8')
assert.ok(routeSource.includes('/api/admin/data-factory/dispatches/:dispatchId/artifacts/stage'), 'ARTIFACT_STAGE_ROUTE_MISSING')
const catalogSource = fs.readFileSync('server/services/ldtOps/apiCatalog.mjs', 'utf8')
assert.ok(catalogSource.includes('data-factory-artifacts-stage'), 'ARTIFACT_STAGE_CATALOG_MISSING')
const serviceSource = fs.readFileSync('server/services/ldtOps/artifactTransferService.mjs', 'utf8')
for (const key of ['pmtiles', 'mvt-directory', '3d-tiles', 'postgis-dump', 'runtime-artifacts', 'sftp-rsync', 'artifact-tarball']) {
  assert.ok(serviceSource.includes(key), `ARTIFACT_TRANSFER_KIND_MISSING:${key}`)
}

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({
    ok: true,
    skippedDatabase: true,
    contract: 'data-factory-artifact-transfer.v1',
    staticContract: 'route-cli-service',
  }, null, 2))
  process.exit(0)
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
const stageKey = argValue('stage') || 'viewer-artifacts'
const suffix = crypto.randomUUID().slice(0, 8)
const localNodeKey = `artifact-local-${suffix}`
const localStoreKey = `artifact-local-store-${suffix}`
const sftpNodeKey = `artifact-rsync-${suffix}`
const sftpStoreKey = `artifact-rsync-store-${suffix}`
const bundleNodeKey = `artifact-bundle-${suffix}`
const bundleStoreKey = `artifact-bundle-store-${suffix}`
const fixtureRoot = path.join(os.tmpdir(), `tbs-artifact-transfer-fixtures-${suffix}`)
const localStoreRoot = path.join(os.tmpdir(), `tbs-artifact-transfer-store-${suffix}`)
const bundleStoreRoot = path.join(os.tmpdir(), `tbs-artifact-transfer-bundle-${suffix}`)
let localStoreId = null
let sftpStoreId = null
let bundleStoreId = null

try {
  await runProductionMigrations()
  fs.rmSync(fixtureRoot, { recursive: true, force: true })
  fs.rmSync(localStoreRoot, { recursive: true, force: true })
  fs.rmSync(bundleStoreRoot, { recursive: true, force: true })
  const localArtifacts = createArtifactFixtures(path.join(fixtureRoot, 'local'), `smoke-${suffix}`)
  const sftpArtifacts = createArtifactFixtures(path.join(fixtureRoot, 'sftp'), `smoke-rsync-${suffix}`)
  const bundleArtifacts = createArtifactFixtures(path.join(fixtureRoot, 'bundle'), `smoke-bundle-${suffix}`)

  const localNode = await registerPullNode({
    nodeKey: localNodeKey,
    storeKey: localStoreKey,
    storeType: 'local-filesystem',
    storeUri: `file://${localStoreRoot}`,
    storePublicConfig: { root: localStoreRoot },
    stageKey,
  })
  localStoreId = localNode.node.artifactStore?.id ?? null

  const localClaim = await prepareAndClaim({
    cityId,
    stageKey,
    nodeKey: localNodeKey,
    runtimeToken: localNode.runtimeToken,
    runnerId: 'artifact-local-smoke',
  })
  const localResultPackage = buildExternalDataFactoryResult({
    dispatchPackage: localClaim.dispatchPackage,
    dispatchChecksum: localClaim.dispatchChecksum,
    runnerId: 'artifact-local-smoke',
    submittedBy: 'data-factory-artifact-transfer-smoke',
  })
  localResultPackage.externalRun.artifacts = [
    ...localResultPackage.externalRun.artifacts,
    ...localArtifacts,
  ]

  const submitted = await submitServerToServerPullDispatchResult({
    nodeKey: localNodeKey,
    rawToken: localNode.runtimeToken,
    dispatchId: localClaim.dispatchId,
    resultPackage: localResultPackage,
    submittedBy: 'data-factory-artifact-transfer-smoke',
  })
  assert.equal(submitted.ok, true, submitted.error || 'ARTIFACT_TRANSFER_RESULT_SUBMIT_FAILED')
  assert.equal(submitted.artifactTransfer?.ok, true, submitted.artifactTransfer?.error || 'ARTIFACT_TRANSFER_MANIFEST_FAILED')
  assert.equal(submitted.artifactTransfer.manifest.summary.heavyArtifactCount, 4, 'ARTIFACT_TRANSFER_HEAVY_COUNT_MISMATCH')
  assert.ok(submitted.artifactTransfer.manifest.summary.byteMovement?.copiedToStore > 0, 'ARTIFACT_TRANSFER_LOCAL_BYTES_NOT_COUNTED')
  assert.equal(submitted.artifactTransfer.manifest.summary.byteMovement?.plannedExternalTransfer, 0, 'ARTIFACT_TRANSFER_LOCAL_SHOULD_NOT_PLAN_BYTES')
  const heavyLocalItems = submitted.artifactTransfer.manifest.items.filter((item) => item.heavy)
  assert.equal(heavyLocalItems.length, 4, 'ARTIFACT_TRANSFER_HEAVY_ITEMS_MISSING')
  for (const item of heavyLocalItems) {
    assert.equal(item.transfer.status, 'staged', `ARTIFACT_NOT_STAGED:${item.artifactKind}`)
    assert.ok(item.checksum?.startsWith('sha256:'), `ARTIFACT_CHECKSUM_MISSING:${item.artifactKind}`)
    assert.ok(item.byteSize > 0, `ARTIFACT_BYTES_MISSING:${item.artifactKind}`)
    assert.ok(item.destination.localPath && fs.existsSync(item.destination.localPath), `ARTIFACT_DESTINATION_MISSING:${item.artifactKind}`)
  }

  const sftpNode = await registerPullNode({
    nodeKey: sftpNodeKey,
    storeKey: sftpStoreKey,
    storeType: 'sftp-rsync',
    storeUri: 'deploy@example.invalid:/srv/twin-artifacts',
    storePublicConfig: { root: '/srv/twin-artifacts' },
    stageKey,
  })
  sftpStoreId = sftpNode.node.artifactStore?.id ?? null
  const sftpClaim = await prepareAndClaim({
    cityId,
    stageKey,
    nodeKey: sftpNodeKey,
    runtimeToken: sftpNode.runtimeToken,
    runnerId: 'artifact-rsync-smoke',
  })
  const planned = await stageDataFactoryArtifactManifest({
    dispatchId: sftpClaim.dispatchId,
    artifacts: sftpArtifacts,
    copyLocal: true,
    submittedBy: 'data-factory-artifact-transfer-smoke',
  })
  assert.equal(planned.ok, true, planned.error || 'ARTIFACT_TRANSFER_RSYNC_PLAN_FAILED')
  assert.equal(planned.manifest.store.storeType, 'sftp-rsync', 'ARTIFACT_TRANSFER_RSYNC_STORE_MISMATCH')
  assert.ok(planned.manifest.summary.byteMovement?.plannedExternalTransfer > 0, 'ARTIFACT_TRANSFER_RSYNC_BYTES_NOT_PLANNED')
  assert.equal(planned.manifest.summary.byteMovement?.copiedToStore, 0, 'ARTIFACT_TRANSFER_RSYNC_SHOULD_NOT_COPY_BYTES')
  assert.equal(planned.manifest.summary.byteMovement?.packagedForTransfer, 0, 'ARTIFACT_TRANSFER_RSYNC_SHOULD_NOT_PACKAGE_BYTES')
  for (const item of planned.manifest.items) {
    assert.equal(item.transfer.status, 'planned', `ARTIFACT_RSYNC_NOT_PLANNED:${item.artifactKind}`)
    assert.equal(item.transfer.mode, 'rsync-plan', `ARTIFACT_RSYNC_MODE_INVALID:${item.artifactKind}`)
    assert.ok(item.transfer.command?.includes('rsync -a --checksum'), `ARTIFACT_RSYNC_COMMAND_MISSING:${item.artifactKind}`)
  }

  const bundleNode = await registerPullNode({
    nodeKey: bundleNodeKey,
    storeKey: bundleStoreKey,
    storeType: 'offline-bundle',
    storeUri: `file://${bundleStoreRoot}`,
    storePublicConfig: { root: bundleStoreRoot },
    stageKey,
  })
  bundleStoreId = bundleNode.node.artifactStore?.id ?? null
  const bundleClaim = await prepareAndClaim({
    cityId,
    stageKey,
    nodeKey: bundleNodeKey,
    runtimeToken: bundleNode.runtimeToken,
    runnerId: 'artifact-bundle-smoke',
  })
  const bundled = await stageDataFactoryArtifactManifest({
    dispatchId: bundleClaim.dispatchId,
    artifacts: bundleArtifacts,
    copyLocal: true,
    submittedBy: 'data-factory-artifact-transfer-smoke',
  })
  assert.equal(bundled.ok, true, bundled.error || 'ARTIFACT_TRANSFER_BUNDLE_FAILED')
  assert.equal(bundled.manifest.store.storeType, 'offline-bundle', 'ARTIFACT_TRANSFER_BUNDLE_STORE_MISMATCH')
  assert.ok(bundled.manifest.bundlePackage?.localPath, 'ARTIFACT_TRANSFER_BUNDLE_PATH_MISSING')
  assert.ok(fs.existsSync(bundled.manifest.bundlePackage.localPath), 'ARTIFACT_TRANSFER_BUNDLE_FILE_MISSING')
  assert.ok(bundled.manifest.bundlePackage.checksum?.startsWith('sha256:'), 'ARTIFACT_TRANSFER_BUNDLE_CHECKSUM_MISSING')
  assert.ok(bundled.manifest.bundlePackage.byteSize > 0, 'ARTIFACT_TRANSFER_BUNDLE_BYTES_MISSING')
  assert.ok(bundled.manifest.summary.byteMovement?.packagedForTransfer > 0, 'ARTIFACT_TRANSFER_BUNDLE_BYTES_NOT_COUNTED')
  assert.equal(bundled.manifest.summary.byteMovement?.tarballByteSize, bundled.manifest.bundlePackage.byteSize, 'ARTIFACT_TRANSFER_BUNDLE_TARBALL_BYTES_MISMATCH')
  assert.equal(bundled.manifest.summary.byteMovement?.plannedExternalTransfer, 0, 'ARTIFACT_TRANSFER_BUNDLE_SHOULD_NOT_PLAN_BYTES')
  for (const item of bundled.manifest.items) {
    assert.equal(item.transfer.status, 'packaged', `ARTIFACT_BUNDLE_ITEM_NOT_PACKAGED:${item.artifactKind}`)
    assert.equal(item.transfer.mode, 'artifact-tarball', `ARTIFACT_BUNDLE_ITEM_MODE_INVALID:${item.artifactKind}`)
    assert.ok(item.destination.uri.includes('artifact-transfer-bundle.tgz#/'), `ARTIFACT_BUNDLE_ITEM_URI_INVALID:${item.artifactKind}`)
  }

  const pool = getProductionPool()
  const manifestRow = await pool.query(`
    SELECT artifact_manifest
    FROM ldt_ops.data_factory_dispatches
    WHERE id = $1
  `, [localClaim.dispatchId])
  assert.equal(manifestRow.rowCount, 1, 'ARTIFACT_TRANSFER_DISPATCH_MANIFEST_ROW_MISSING')
  assert.equal(Number(manifestRow.rows[0].artifact_manifest?.summary?.heavyArtifactCount ?? 0), 4, 'ARTIFACT_TRANSFER_DISPATCH_MANIFEST_NOT_PERSISTED')
  const workflowArtifact = await pool.query(`
    SELECT count(*)::int AS count
    FROM ldt_ops.workflow_artifacts
    WHERE run_id = $1
      AND artifact_kind = 'data-factory-artifact-transfer-manifest'
  `, [localClaim.workflowRunId])
  assert.ok(Number(workflowArtifact.rows[0]?.count ?? 0) >= 1, 'ARTIFACT_TRANSFER_WORKFLOW_ARTIFACT_MISSING')

  console.log(JSON.stringify({
    ok: true,
    contract: 'data-factory-artifact-transfer.v1',
    cityId,
    stageKey,
    local: {
      dispatchId: localClaim.dispatchId,
      heavyArtifactCount: submitted.artifactTransfer.manifest.summary.heavyArtifactCount,
      stagedStatuses: submitted.artifactTransfer.manifest.summary.byStatus,
      byteMovement: submitted.artifactTransfer.manifest.summary.byteMovement,
    },
    rsync: {
      dispatchId: sftpClaim.dispatchId,
      status: planned.manifest.summary.byStatus,
      storeType: planned.manifest.store.storeType,
      byteMovement: planned.manifest.summary.byteMovement,
    },
    bundle: {
      dispatchId: bundleClaim.dispatchId,
      status: bundled.manifest.summary.byStatus,
      checksum: bundled.manifest.bundlePackage.checksum,
      byteSize: bundled.manifest.bundlePackage.byteSize,
      byteMovement: bundled.manifest.summary.byteMovement,
    },
  }, null, 2))
} finally {
  const pool = getProductionPool()
  if (pool) {
    await pool.query('DELETE FROM ldt_ops.processing_nodes WHERE node_key = ANY($1::text[])', [[localNodeKey, sftpNodeKey, bundleNodeKey]])
    if (localStoreId || sftpStoreId || bundleStoreId) {
      await pool.query('DELETE FROM ldt_ops.artifact_stores WHERE id = ANY($1::uuid[])', [[localStoreId, sftpStoreId, bundleStoreId].filter(Boolean)])
    } else {
      await pool.query('DELETE FROM ldt_ops.artifact_stores WHERE store_key = ANY($1::text[])', [[localStoreKey, sftpStoreKey, bundleStoreKey]])
    }
  }
  fs.rmSync(fixtureRoot, { recursive: true, force: true })
  fs.rmSync(localStoreRoot, { recursive: true, force: true })
  fs.rmSync(bundleStoreRoot, { recursive: true, force: true })
  await closeProductionPool()
}
