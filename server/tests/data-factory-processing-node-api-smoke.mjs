import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'

import { closeProductionPool, getProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import {
  getProcessingNode,
  listProcessingNodes,
  recordProcessingNodeHeartbeat,
  registerProcessingNode,
  validateProcessingNodeRuntimeToken,
} from '../services/ldtOpsService.mjs'

const routesSource = fs.readFileSync('server/routes/adminWorkflowRoutes.mjs', 'utf8')
const apiCatalogSource = fs.readFileSync('server/services/ldtOps/apiCatalog.mjs', 'utf8')

for (const route of [
  '/api/admin/data-factory/processing-nodes',
  '/api/admin/data-factory/processing-nodes/:nodeKey',
  '/api/admin/data-factory/processing-nodes/:nodeKey/heartbeats',
  '/api/data-factory/processing-nodes/:nodeKey/heartbeat',
]) {
  assert.ok(routesSource.includes(route), `PROCESSING_NODE_ROUTE_MISSING:${route}`)
}

for (const key of [
  'data-factory-processing-nodes',
  'data-factory-processing-node-register',
  'data-factory-processing-node-admin-heartbeat',
  'data-factory-processing-node-runtime-heartbeat',
]) {
  assert.ok(apiCatalogSource.includes(key), `PROCESSING_NODE_API_CATALOG_MISSING:${key}`)
}

assert.ok(routesSource.includes('x-data-factory-token'), 'PROCESSING_NODE_TOKEN_HEADER_MISSING')
assert.ok(routesSource.includes('request.headers.authorization'), 'PROCESSING_NODE_AUTHORIZATION_HEADER_MISSING')

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: 'DATABASE_URL_NOT_CONFIGURED',
    staticContract: 'processing-node-api-routes.v1',
  }, null, 2))
  process.exit(0)
}

await runProductionMigrations()

const suffix = crypto.randomUUID().slice(0, 8)
const nodeKey = `api-smoke-node-${suffix}`
const storeKey = `api-smoke-store-${suffix}`
let nodeId = null
let storeId = null

try {
  const registered = await registerProcessingNode({
    nodeKey,
    displayName: 'API Smoke Server-To-Server Node',
    providerType: 'server-to-server-pull',
    connectionMode: 'pull',
    runtimeKind: 'docker',
    runtimeVersion: '2026.06.api-smoke',
    imageRef: 'twin-base-studio-datafactory:smoke',
    status: 'registered',
    lifecycleStatus: 'generated',
    capabilities: {
      cpuCores: 4,
      supports: ['viewer-artifacts', 'semantic-materialization'],
    },
    publicConfig: {
      connection: 'poll',
    },
    artifactStore: {
      storeKey,
      displayName: 'API Smoke Store',
      storeType: 'local-filesystem',
      uri: 'file:///tmp/twin-datafactory-api-smoke',
      publicConfig: {
        root: '/tmp/twin-datafactory-api-smoke',
      },
    },
    stageBindings: [
      'viewer-artifacts',
      { stageKey: 'semantic-materialization', priority: 50, resourcePolicy: { minCpuCores: 4 } },
    ],
    issueRuntimeToken: true,
    tokenName: 'api-smoke-runtime-token',
    registeredBy: 'data-factory-processing-node-api-smoke',
  })

  assert.equal(registered.ok, true, registered.error || 'PROCESSING_NODE_REGISTER_NOT_OK')
  assert.ok(registered.node?.id, 'PROCESSING_NODE_ID_MISSING')
  assert.equal(registered.node.nodeKey, nodeKey, 'PROCESSING_NODE_KEY_MISMATCH')
  assert.equal(registered.node.providerType, 'server-to-server-pull', 'PROCESSING_NODE_PROVIDER_MISMATCH')
  assert.equal(registered.node.connectionMode, 'pull', 'PROCESSING_NODE_CONNECTION_MISMATCH')
  assert.equal(registered.node.artifactStore?.storeKey, storeKey, 'PROCESSING_NODE_ARTIFACT_STORE_MISSING')
  assert.ok(registered.runtimeToken?.startsWith('twin_df_'), 'PROCESSING_NODE_RUNTIME_TOKEN_NOT_RETURNED')
  nodeId = registered.node.id
  storeId = registered.node.artifactStore.id

  const invalidToken = await recordProcessingNodeHeartbeat({
    nodeKey,
    rawToken: 'not-the-token',
    heartbeat: { status: 'online', doctorStatus: 'passed' },
  })
  assert.equal(invalidToken.ok, false, 'PROCESSING_NODE_INVALID_TOKEN_ACCEPTED')
  assert.equal(invalidToken.error, 'PROCESSING_NODE_TOKEN_INVALID', 'PROCESSING_NODE_INVALID_TOKEN_ERROR_MISMATCH')

  const validatedToken = await validateProcessingNodeRuntimeToken({
    nodeKey,
    rawToken: registered.runtimeToken,
  })
  assert.equal(validatedToken.ok, true, validatedToken.error || 'PROCESSING_NODE_TOKEN_NOT_VALID')

  const heartbeat = await recordProcessingNodeHeartbeat({
    nodeKey,
    rawToken: registered.runtimeToken,
    heartbeat: {
      status: 'online',
      doctorStatus: 'passed',
      runtimeVersion: '2026.06.api-smoke',
      imageRef: 'twin-base-studio-datafactory:smoke',
      cpuCoreCount: 4,
      memoryBytes: 17179869184,
      freeDiskBytes: 107374182400,
      runningJobCount: 1,
      capabilities: {
        provider: 'server-to-server-pull',
        supports: ['viewer-artifacts', 'semantic-materialization'],
      },
      doctor: {
        ok: true,
        missingRequiredCommands: [],
      },
    },
  })
  assert.equal(heartbeat.ok, true, heartbeat.error || 'PROCESSING_NODE_HEARTBEAT_NOT_OK')
  assert.equal(heartbeat.node.status, 'online', 'PROCESSING_NODE_STATUS_NOT_UPDATED')
  assert.equal(heartbeat.node.lifecycleStatus, 'validated', 'PROCESSING_NODE_LIFECYCLE_NOT_VALIDATED')
  assert.equal(heartbeat.node.latestHeartbeat?.doctorStatus, 'passed', 'PROCESSING_NODE_HEARTBEAT_DOCTOR_MISMATCH')

  const adminHeartbeat = await recordProcessingNodeHeartbeat({
    nodeKey,
    requireToken: false,
    heartbeat: {
      status: 'busy',
      doctorStatus: 'passed',
      runningJobCount: 2,
    },
  })
  assert.equal(adminHeartbeat.ok, true, adminHeartbeat.error || 'PROCESSING_NODE_ADMIN_HEARTBEAT_NOT_OK')
  assert.equal(adminHeartbeat.node.status, 'busy', 'PROCESSING_NODE_ADMIN_STATUS_NOT_UPDATED')

  const listed = await listProcessingNodes({ providerType: 'server-to-server-pull', status: 'busy', limit: 20 })
  assert.equal(listed.ok, true, listed.error || 'PROCESSING_NODE_LIST_NOT_OK')
  assert.ok(listed.nodes.some((node) => node.nodeKey === nodeKey), 'PROCESSING_NODE_NOT_LISTED')

  const fetched = await getProcessingNode(nodeKey)
  assert.equal(fetched.ok, true, fetched.error || 'PROCESSING_NODE_GET_NOT_OK')
  assert.equal(fetched.node.latestHeartbeat.runningJobCount, 2, 'PROCESSING_NODE_LATEST_HEARTBEAT_NOT_RETURNED')

  console.log(JSON.stringify({
    ok: true,
    contract: 'twin-base-studio-processing-node-api.v1',
    node: {
      nodeKey,
      providerType: fetched.node.providerType,
      connectionMode: fetched.node.connectionMode,
      status: fetched.node.status,
      lifecycleStatus: fetched.node.lifecycleStatus,
    },
    routes: 4,
    apiCatalogEntries: 4,
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
