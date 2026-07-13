import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { closeProductionPool, getProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import { buildExternalDataFactoryResult } from '../tools/run-external-data-factory-dispatch.mjs'
import { getRuntimeDir } from '../services/stateStore.mjs'
import {
  claimServerToServerPullDispatch,
  receiveServerToServerPullRuntimeArtifactBundle,
  registerProcessingNode,
  runOfflineDataFactoryJob,
  submitServerToServerPullDispatchResult,
} from '../services/ldtOpsService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
const stageKey = argValue('stage') || 'semantic-materialization'

function sha256File(filePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
assert.equal(
  packageJson.scripts['ops:server-to-server-pull-worker'],
  'node server/tools/server-to-server-pull-worker.mjs',
  'SERVER_TO_SERVER_PULL_WORKER_SCRIPT_MISSING',
)
assert.equal(
  packageJson.scripts['test:data-factory-server-to-server-pull-smoke'],
  'node server/tests/data-factory-server-to-server-pull-smoke.mjs',
  'SERVER_TO_SERVER_PULL_SMOKE_SCRIPT_MISSING',
)

const routesSource = fs.readFileSync('server/routes/adminWorkflowRoutes.mjs', 'utf8')
for (const route of [
  '/api/data-factory/processing-nodes/:nodeKey/dispatches/claim',
  '/api/data-factory/processing-nodes/:nodeKey/dispatches/:dispatchId/result',
  '/api/data-factory/processing-nodes/:nodeKey/dispatches/:dispatchId/artifacts/runtime-bundle',
]) {
  assert.ok(routesSource.includes(route), `SERVER_TO_SERVER_PULL_ROUTE_MISSING:${route}`)
}
assert.ok(routesSource.includes('claimServerToServerPullDispatch'), 'SERVER_TO_SERVER_PULL_CLAIM_SERVICE_NOT_ROUTED')
assert.ok(routesSource.includes('submitServerToServerPullDispatchResult'), 'SERVER_TO_SERVER_PULL_RESULT_SERVICE_NOT_ROUTED')
assert.ok(routesSource.includes('receiveServerToServerPullRuntimeArtifactBundle'), 'SERVER_TO_SERVER_PULL_RUNTIME_BUNDLE_SERVICE_NOT_ROUTED')

const apiCatalogSource = fs.readFileSync('server/services/ldtOps/apiCatalog.mjs', 'utf8')
for (const key of [
  'data-factory-pull-dispatch-claim',
  'data-factory-pull-dispatch-result',
  'data-factory-pull-runtime-artifact-bundle',
]) {
  assert.ok(apiCatalogSource.includes(key), `SERVER_TO_SERVER_PULL_API_CATALOG_MISSING:${key}`)
}

const workerSource = fs.readFileSync('server/tools/server-to-server-pull-worker.mjs', 'utf8')
assert.ok(workerSource.includes('/dispatches/claim'), 'SERVER_TO_SERVER_PULL_WORKER_CLAIM_PATH_MISSING')
assert.ok(workerSource.includes('/artifacts/runtime-bundle'), 'SERVER_TO_SERVER_PULL_WORKER_RUNTIME_BUNDLE_PATH_MISSING')
assert.ok(workerSource.includes('upload-artifact-bundle'), 'SERVER_TO_SERVER_PULL_WORKER_UPLOAD_BUNDLE_OPTION_MISSING')
assert.ok(workerSource.includes('restore-city-input'), 'SERVER_TO_SERVER_PULL_WORKER_CITY_INPUT_RESTORE_OPTION_MISSING')
assert.ok(workerSource.includes('city-input-package'), 'SERVER_TO_SERVER_PULL_WORKER_CITY_INPUT_PACKAGE_OPTION_MISSING')
assert.ok(workerSource.includes('writeExternalDataFactoryResult'), 'SERVER_TO_SERVER_PULL_WORKER_RUNNER_MISSING')
assert.ok(workerSource.includes('TWIN_STUDIO_DATA_FACTORY_TOKEN'), 'SERVER_TO_SERVER_PULL_WORKER_TOKEN_ENV_MISSING')

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({
    ok: true,
    skippedDatabase: true,
    contract: 'server-to-server-pull-worker.v1',
    staticContract: 'routes-catalog-cli',
  }, null, 2))
  process.exit(0)
}

await runProductionMigrations()

const suffix = crypto.randomUUID().slice(0, 8)
const nodeKey = `pull-smoke-node-${suffix}`
const storeKey = `pull-smoke-store-${suffix}`
let storeId = null

try {
  const registered = await registerProcessingNode({
    nodeKey,
    displayName: 'Server-To-Server Pull Smoke Node',
    providerType: 'server-to-server-pull',
    connectionMode: 'pull',
    runtimeKind: 'docker',
    runtimeVersion: '2026.06.pull-smoke',
    imageRef: 'twin-base-studio-datafactory:pull-smoke',
    status: 'registered',
    lifecycleStatus: 'generated',
    capabilities: {
      providerContract: 'server-to-server-pull-provider.v1',
      supports: [stageKey],
    },
    publicConfig: {
      connection: 'poll',
    },
    artifactStore: {
      storeKey,
      displayName: 'Server-To-Server Pull Smoke Store',
      storeType: 'local-filesystem',
      uri: 'file:///tmp/twin-datafactory-pull-smoke',
      publicConfig: {
        root: '/tmp/twin-datafactory-pull-smoke',
      },
    },
    stageBindings: [stageKey],
    issueRuntimeToken: true,
    tokenName: 'pull-smoke-runtime-token',
    registeredBy: 'data-factory-server-to-server-pull-smoke',
  })

  assert.equal(registered.ok, true, registered.error || 'PULL_NODE_REGISTER_NOT_OK')
  assert.ok(registered.runtimeToken?.startsWith('twin_df_'), 'PULL_NODE_RUNTIME_TOKEN_NOT_RETURNED')
  assert.equal(registered.node.providerType, 'server-to-server-pull', 'PULL_NODE_PROVIDER_MISMATCH')
  assert.equal(registered.node.connectionMode, 'pull', 'PULL_NODE_CONNECTION_MISMATCH')
  storeId = registered.node.artifactStore?.id ?? null

  const invalidClaim = await claimServerToServerPullDispatch({
    nodeKey,
    rawToken: 'not-the-runtime-token',
    cityId,
    stageKey,
    runnerId: 'pull-smoke',
  })
  assert.equal(invalidClaim.ok, false, 'PULL_INVALID_TOKEN_ACCEPTED')
  assert.equal(invalidClaim.error, 'PROCESSING_NODE_TOKEN_INVALID', 'PULL_INVALID_TOKEN_ERROR_MISMATCH')

  const prepared = await runOfflineDataFactoryJob({
    cityId,
    stageKey,
    executorProfile: 'external-worker',
    requestedBy: 'data-factory-server-to-server-pull-smoke',
    submittedBy: 'data-factory-server-to-server-pull-smoke',
    runnerOptions: {
      serverToServerPullSmoke: true,
    },
  })

  assert.equal(prepared.ok, true, prepared.error || 'PULL_DISPATCH_PREPARE_NOT_OK')
  assert.ok(prepared.dispatch?.dispatch?.checksum, 'PULL_DISPATCH_CHECKSUM_MISSING')

  const claim = await claimServerToServerPullDispatch({
    nodeKey,
    rawToken: registered.runtimeToken,
    cityId,
    stageKey,
    runId: prepared.runId,
    runnerId: 'pull-smoke',
  })

  assert.equal(claim.ok, true, claim.error || 'PULL_CLAIM_NOT_OK')
  assert.equal(claim.claimed, true, 'PULL_CLAIM_EMPTY')
  assert.ok(claim.dispatchId, 'PULL_DISPATCH_ID_MISSING')
  assert.equal(claim.cityId, cityId, 'PULL_CLAIM_CITY_MISMATCH')
  assert.equal(claim.stageKey, stageKey, 'PULL_CLAIM_STAGE_MISMATCH')
  assert.equal(claim.dispatchChecksum, prepared.dispatch.dispatch.checksum, 'PULL_CLAIM_CHECKSUM_MISMATCH')
  assert.equal(claim.dispatchPackage.runId, prepared.runId, 'PULL_CLAIM_PACKAGE_RUN_MISMATCH')
  assert.equal(claim.dispatchPackage.executorProfile, 'external-worker', 'PULL_CLAIM_PROFILE_MISMATCH')

  const runtimeDir = getRuntimeDir()
  const smokeRuntimeRelativePath = path.join('artifacts', cityId, 'mvt', `pull-smoke-${suffix}`, 'manifest.json')
  const smokeRuntimePath = path.join(runtimeDir, smokeRuntimeRelativePath)
  fs.mkdirSync(path.dirname(smokeRuntimePath), { recursive: true })
  fs.writeFileSync(smokeRuntimePath, `${JSON.stringify({
    ok: true,
    cityId,
    stageKey,
    smoke: 'server-to-server-runtime-artifact-bundle',
  }, null, 2)}\n`)
  const smokeBundlePath = path.join(runtimeDir, 'artifacts', cityId, 'offline-data-factory', prepared.runId, 'pull-smoke-runtime-artifacts.tgz')
  fs.mkdirSync(path.dirname(smokeBundlePath), { recursive: true })
  const tar = spawnSync('tar', ['-czf', smokeBundlePath, '-C', runtimeDir, smokeRuntimeRelativePath], {
    encoding: 'utf8',
  })
  assert.equal(tar.status, 0, tar.stderr || tar.stdout || 'PULL_RUNTIME_BUNDLE_TAR_FAILED')
  const uploadedBundle = await receiveServerToServerPullRuntimeArtifactBundle({
    nodeKey,
    rawToken: registered.runtimeToken,
    dispatchId: claim.dispatchId,
    uploadStream: fs.createReadStream(smokeBundlePath),
    contentLength: fs.statSync(smokeBundlePath).size,
    checksum: sha256File(smokeBundlePath),
    fileName: 'pull-smoke-runtime-artifacts.tgz',
    submittedBy: 'data-factory-server-to-server-pull-smoke',
  })
  assert.equal(uploadedBundle.ok, true, uploadedBundle.error || 'PULL_RUNTIME_BUNDLE_UPLOAD_NOT_OK')
  assert.equal(uploadedBundle.artifact.extractedMemberCount >= 1, true, 'PULL_RUNTIME_BUNDLE_NO_EXTRACTED_MEMBERS')

  const secondClaim = await claimServerToServerPullDispatch({
    nodeKey,
    rawToken: registered.runtimeToken,
    cityId,
    stageKey,
    runId: prepared.runId,
    runnerId: 'pull-smoke-second',
  })
  assert.equal(secondClaim.ok, true, secondClaim.error || 'PULL_SECOND_CLAIM_NOT_OK')
  assert.equal(secondClaim.claimed, false, 'PULL_DUPLICATE_CLAIM_ALLOWED')

  const resultPackage = buildExternalDataFactoryResult({
    dispatchPackage: claim.dispatchPackage,
    dispatchChecksum: claim.dispatchChecksum,
    runnerId: 'pull-smoke',
    submittedBy: 'data-factory-server-to-server-pull-smoke',
  })

  const submitted = await submitServerToServerPullDispatchResult({
    nodeKey,
    rawToken: registered.runtimeToken,
    dispatchId: claim.dispatchId,
    resultPackage,
    submittedBy: 'data-factory-server-to-server-pull-smoke',
  })

  assert.equal(submitted.ok, true, submitted.error || 'PULL_RESULT_SUBMIT_NOT_OK')
  assert.equal(submitted.status, 'validated', 'PULL_RESULT_STATUS_NOT_VALIDATED')
  assert.equal(submitted.imported?.result?.dispatch?.returnStatus, 'validated-return', 'PULL_RESULT_RETURN_STATUS_MISSING')
  assert.equal(submitted.imported?.result?.externalRun?.runnerId, 'pull-smoke', 'PULL_RESULT_RUNNER_ID_MISMATCH')

  const pool = getProductionPool()
  const dispatchLedger = await pool.query(`
    SELECT status, result_checksum, output_contract, node_id
    FROM ldt_ops.data_factory_dispatches
    WHERE id = $1
  `, [claim.dispatchId])
  assert.equal(dispatchLedger.rowCount, 1, 'PULL_LEDGER_ROW_MISSING')
  assert.equal(dispatchLedger.rows[0].status, 'validated', 'PULL_LEDGER_STATUS_NOT_VALIDATED')
  assert.ok(dispatchLedger.rows[0].result_checksum, 'PULL_LEDGER_RESULT_CHECKSUM_MISSING')

  const heartbeat = await pool.query(`
    SELECT heartbeat.status, heartbeat.running_job_count, heartbeat.capabilities_json
    FROM ldt_ops.processing_node_heartbeats heartbeat
    JOIN ldt_ops.processing_nodes node ON node.id = heartbeat.node_id
    WHERE node.node_key = $1
    ORDER BY heartbeat.observed_at DESC, heartbeat.received_at DESC
    LIMIT 1
  `, [nodeKey])
  assert.equal(heartbeat.rowCount, 1, 'PULL_HEARTBEAT_MISSING')
  assert.equal(heartbeat.rows[0].status, 'online', 'PULL_HEARTBEAT_NOT_ONLINE')
  assert.equal(Number(heartbeat.rows[0].running_job_count ?? 0), 0, 'PULL_HEARTBEAT_JOB_COUNT_NOT_ZERO')

  console.log(JSON.stringify({
    ok: true,
    contract: 'server-to-server-pull-worker.v1',
    cityId,
    stageKey,
    nodeKey,
    dispatchId: claim.dispatchId,
    workflowRunId: claim.workflowRunId,
    resultStatus: submitted.status,
    runnerId: submitted.imported.result.externalRun.runnerId,
  }, null, 2))
} finally {
  const pool = getProductionPool()
  if (pool) {
    await pool.query('DELETE FROM ldt_ops.processing_nodes WHERE node_key = $1', [nodeKey])
    if (storeId) {
      await pool.query('DELETE FROM ldt_ops.artifact_stores WHERE id = $1', [storeId])
    } else {
      await pool.query('DELETE FROM ldt_ops.artifact_stores WHERE store_key = $1', [storeKey])
    }
  }
  await closeProductionPool()
}
