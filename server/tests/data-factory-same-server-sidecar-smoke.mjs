import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { closeProductionPool, getProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import {
  buildSameServerSidecarPlan,
  ensureSameServerSidecarProvider,
} from '../services/ldtOps/sameServerSidecarProviderService.mjs'

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
assert.equal(
  packageJson.scripts['ops:ensure-same-server-sidecar'],
  'node server/tools/ensure-same-server-sidecar.mjs',
  'SAME_SERVER_SIDECAR_SCRIPT_MISSING',
)

const routesSource = fs.readFileSync('server/routes/adminWorkflowRoutes.mjs', 'utf8')
assert.ok(
  routesSource.includes('/api/admin/data-factory/providers/same-server-sidecar/ensure'),
  'SAME_SERVER_SIDECAR_ROUTE_MISSING',
)

const apiCatalogSource = fs.readFileSync('server/services/ldtOps/apiCatalog.mjs', 'utf8')
assert.ok(
  apiCatalogSource.includes('data-factory-same-server-sidecar-ensure'),
  'SAME_SERVER_SIDECAR_API_CATALOG_MISSING',
)

const suffix = crypto.randomUUID().slice(0, 8)
const localNodeKey = `same-server-local-${suffix}`
const localOutputDir = path.join(os.tmpdir(), `tbs-sidecar-local-${suffix}`)
const localPlan = buildSameServerSidecarPlan({
  nodeKey: localNodeKey,
  outputDir: localOutputDir,
  cityId: 'guanajuato',
  stageBindings: ['semantic-materialization', 'viewer-artifacts'],
})

assert.equal(localPlan.plan.providerType, 'same-server-sidecar', 'SAME_SERVER_SIDECAR_PROVIDER_MISMATCH')
assert.equal(localPlan.plan.connectionMode, 'local', 'SAME_SERVER_SIDECAR_CONNECTION_MISMATCH')
assert.equal(localPlan.plan.runtimeKind, 'docker-compose', 'SAME_SERVER_SIDECAR_RUNTIME_MISMATCH')
assert.equal(localPlan.plan.stageBindings.length, 2, 'SAME_SERVER_SIDECAR_STAGE_COUNT_MISMATCH')
assert.ok(localPlan.plan.commands.some((command) => command.includes('compose.datafactory.yml')), 'SAME_SERVER_SIDECAR_COMPOSE_COMMAND_MISSING')
assert.ok(localPlan.commandFile.endsWith('same-server-sidecar.commands.sh'), 'SAME_SERVER_SIDECAR_COMMAND_FILE_MISMATCH')

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({
    ok: true,
    skippedDatabase: true,
    contract: 'same-server-sidecar-provider.v1',
    staticContract: 'same-server-sidecar-route-and-plan',
  }, null, 2))
  process.exit(0)
}

await runProductionMigrations()

const nodeKey = `same-server-sidecar-${suffix}`
const storeKey = `${nodeKey}-artifact-store`
const outputDir = path.join(os.tmpdir(), `tbs-sidecar-db-${suffix}`)
fs.rmSync(outputDir, { recursive: true, force: true })

try {
  const ensured = await ensureSameServerSidecarProvider({
    nodeKey,
    cityId: 'guanajuato',
    outputDir,
    stageBindings: ['semantic-materialization', 'viewer-artifacts'],
    runDoctor: false,
    doctorResult: {
      ok: true,
      skipped: false,
      mode: 'offline-data-factory',
      imageContract: 'twin-base-studio-datafactory.v1',
      missingRequiredCommands: [],
      missingModules: [],
    },
    registeredBy: 'data-factory-same-server-sidecar-smoke',
  })

  assert.equal(ensured.ok, true, ensured.error || 'SAME_SERVER_SIDECAR_ENSURE_NOT_OK')
  assert.equal(ensured.providerType, 'same-server-sidecar', 'SAME_SERVER_SIDECAR_ENSURE_PROVIDER_MISMATCH')
  assert.equal(ensured.connectionMode, 'local', 'SAME_SERVER_SIDECAR_ENSURE_CONNECTION_MISMATCH')
  assert.equal(ensured.runtimeKind, 'docker-compose', 'SAME_SERVER_SIDECAR_ENSURE_RUNTIME_MISMATCH')
  assert.equal(ensured.node.providerType, 'same-server-sidecar', 'SAME_SERVER_SIDECAR_NODE_PROVIDER_MISMATCH')
  assert.equal(ensured.node.connectionMode, 'local', 'SAME_SERVER_SIDECAR_NODE_CONNECTION_MISMATCH')
  assert.equal(ensured.node.status, 'online', 'SAME_SERVER_SIDECAR_NODE_NOT_ONLINE')
  assert.equal(ensured.node.lifecycleStatus, 'validated', 'SAME_SERVER_SIDECAR_NODE_NOT_VALIDATED')
  assert.equal(ensured.node.latestHeartbeat?.doctorStatus, 'passed', 'SAME_SERVER_SIDECAR_HEARTBEAT_NOT_PASSED')
  assert.equal(fs.existsSync(ensured.planFile), true, 'SAME_SERVER_SIDECAR_PLAN_FILE_MISSING')
  assert.equal(fs.existsSync(ensured.commandFile), true, 'SAME_SERVER_SIDECAR_COMMAND_FILE_MISSING')

  const pool = getProductionPool()
  const bindingResult = await pool.query(`
    SELECT count(1)::int AS count
    FROM ldt_ops.processing_node_stage_bindings binding
    JOIN ldt_ops.processing_nodes node ON node.id = binding.node_id
    WHERE node.node_key = $1 AND binding.enabled = true
  `, [nodeKey])
  assert.equal(Number(bindingResult.rows[0]?.count ?? 0), 2, 'SAME_SERVER_SIDECAR_STAGE_BINDINGS_NOT_WRITTEN')

  console.log(JSON.stringify({
    ok: true,
    contract: 'same-server-sidecar-provider.v1',
    nodeKey,
    providerType: ensured.node.providerType,
    connectionMode: ensured.node.connectionMode,
    status: ensured.node.status,
    lifecycleStatus: ensured.node.lifecycleStatus,
    planFile: ensured.planFile,
  }, null, 2))
} finally {
  const pool = getProductionPool()
  if (pool) {
    await pool.query('DELETE FROM ldt_ops.processing_nodes WHERE node_key = $1', [nodeKey])
    await pool.query('DELETE FROM ldt_ops.artifact_stores WHERE store_key = $1', [storeKey])
  }
  await closeProductionPool()
}
