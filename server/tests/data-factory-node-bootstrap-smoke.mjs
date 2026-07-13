import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { closeProductionPool, getProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import { bootstrapDataFactoryNode } from '../tools/bootstrap-data-factory-node.mjs'

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
assert.equal(
  packageJson.scripts['ops:bootstrap-data-factory-node'],
  'node server/tools/bootstrap-data-factory-node.mjs',
  'DATA_FACTORY_NODE_BOOTSTRAP_SCRIPT_MISSING',
)

const suffix = crypto.randomUUID().slice(0, 8)
const localNodeKey = `bootstrap-local-${suffix}`
const localOutputDir = path.join(os.tmpdir(), `tbs-datafactory-bootstrap-local-${suffix}`)
fs.rmSync(localOutputDir, { recursive: true, force: true })

const localBootstrap = await bootstrapDataFactoryNode({
  nodeKey: localNodeKey,
  providerType: 'server-to-server-pull',
  runtimeKind: 'docker',
  twinStudioUrl: 'http://127.0.0.1:4292',
  outputDir: localOutputDir,
  register: false,
  runtimeToken: `test-token-${suffix}`,
  stageBindings: ['semantic-materialization', 'viewer-artifacts'],
})

assert.equal(localBootstrap.ok, true, 'DATA_FACTORY_NODE_BOOTSTRAP_LOCAL_NOT_OK')
assert.equal(localBootstrap.registered, false, 'DATA_FACTORY_NODE_BOOTSTRAP_LOCAL_REGISTERED')
assert.equal(localBootstrap.providerType, 'server-to-server-pull', 'DATA_FACTORY_NODE_BOOTSTRAP_PROVIDER_MISMATCH')
assert.equal(localBootstrap.connectionMode, 'pull', 'DATA_FACTORY_NODE_BOOTSTRAP_CONNECTION_DEFAULT_MISMATCH')
assert.equal(localBootstrap.stageBindingCount, 2, 'DATA_FACTORY_NODE_BOOTSTRAP_STAGE_COUNT_MISMATCH')
assert.equal(fs.existsSync(localBootstrap.bootstrapFile), true, 'DATA_FACTORY_NODE_BOOTSTRAP_JSON_MISSING')
assert.equal(fs.existsSync(localBootstrap.envFile), true, 'DATA_FACTORY_NODE_BOOTSTRAP_ENV_MISSING')
assert.equal(fs.existsSync(localBootstrap.installScript), true, 'DATA_FACTORY_NODE_BOOTSTRAP_INSTALL_SCRIPT_MISSING')

const bootstrapJson = JSON.parse(fs.readFileSync(localBootstrap.bootstrapFile, 'utf8'))
assert.equal(bootstrapJson.schemaVersion, '2026-06-27.data-factory-node-bootstrap.v1', 'DATA_FACTORY_NODE_BOOTSTRAP_SCHEMA_MISMATCH')
assert.equal(bootstrapJson.node.nodeKey, localNodeKey, 'DATA_FACTORY_NODE_BOOTSTRAP_NODE_KEY_MISMATCH')
assert.equal(bootstrapJson.controlPlane.heartbeat.url, localBootstrap.heartbeatUrl, 'DATA_FACTORY_NODE_BOOTSTRAP_HEARTBEAT_MISMATCH')
assert.equal(bootstrapJson.security.tokenStoredIn, '.env.datafactory.node', 'DATA_FACTORY_NODE_BOOTSTRAP_TOKEN_LOCATION_MISMATCH')

const envText = fs.readFileSync(localBootstrap.envFile, 'utf8')
assert.match(envText, new RegExp(`DATAFACTORY_NODE_KEY=${localNodeKey}`), 'DATA_FACTORY_NODE_BOOTSTRAP_ENV_NODE_MISSING')
assert.match(envText, /TWIN_STUDIO_DATA_FACTORY_TOKEN=test-token-/, 'DATA_FACTORY_NODE_BOOTSTRAP_ENV_TOKEN_MISSING')
assert.match(envText, /DATAFACTORY_HEARTBEAT_URL=http:\/\/127\.0\.0\.1:4292\/api\/data-factory\/processing-nodes\//, 'DATA_FACTORY_NODE_BOOTSTRAP_ENV_HEARTBEAT_MISSING')

const installText = fs.readFileSync(localBootstrap.installScript, 'utf8')
assert.match(installText, /docker compose --env-file \.env\.datafactory/, 'DATA_FACTORY_NODE_BOOTSTRAP_INSTALL_DOCKER_MISSING')
assert.match(installText, /ops:datafactory:doctor/, 'DATA_FACTORY_NODE_BOOTSTRAP_INSTALL_DOCTOR_MISSING')

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({
    ok: true,
    skippedDatabase: true,
    contract: 'data-factory-node-bootstrap.v1',
    generatedFiles: ['bootstrap.json', '.env.datafactory.node', 'install-datafactory-node.sh', 'commands.txt'],
  }, null, 2))
  process.exit(0)
}

await runProductionMigrations()

const dbNodeKey = `bootstrap-db-${suffix}`
const dbStoreKey = `bootstrap-db-store-${suffix}`
const dbOutputDir = path.join(os.tmpdir(), `tbs-datafactory-bootstrap-db-${suffix}`)
fs.rmSync(dbOutputDir, { recursive: true, force: true })

try {
  const dbBootstrap = await bootstrapDataFactoryNode({
    nodeKey: dbNodeKey,
    providerType: 'server-to-server-pull',
    runtimeKind: 'docker',
    twinStudioUrl: 'http://127.0.0.1:4292',
    outputDir: dbOutputDir,
    artifactStoreKey: dbStoreKey,
    stageBindings: ['ingestion-queue', 'semantic-materialization', 'viewer-artifacts'],
    registeredBy: 'data-factory-node-bootstrap-smoke',
  })

  assert.equal(dbBootstrap.ok, true, 'DATA_FACTORY_NODE_BOOTSTRAP_DB_NOT_OK')
  assert.equal(dbBootstrap.registered, true, 'DATA_FACTORY_NODE_BOOTSTRAP_DB_NOT_REGISTERED')
  assert.equal(dbBootstrap.tokenPrinted, false, 'DATA_FACTORY_NODE_BOOTSTRAP_TOKEN_PRINTED')
  assert.equal(dbBootstrap.stageBindingCount, 3, 'DATA_FACTORY_NODE_BOOTSTRAP_DB_STAGE_COUNT_MISMATCH')
  assert.equal(fs.existsSync(dbBootstrap.envFile), true, 'DATA_FACTORY_NODE_BOOTSTRAP_DB_ENV_MISSING')

  const pool = getProductionPool()
  const nodeResult = await pool.query(`
    SELECT node_key, provider_type, connection_mode, status, lifecycle_status
    FROM ldt_ops.processing_nodes
    WHERE node_key = $1
  `, [dbNodeKey])
  assert.equal(nodeResult.rowCount, 1, 'DATA_FACTORY_NODE_BOOTSTRAP_DB_NODE_NOT_FOUND')
  assert.equal(nodeResult.rows[0].provider_type, 'server-to-server-pull', 'DATA_FACTORY_NODE_BOOTSTRAP_DB_PROVIDER_MISMATCH')
  assert.equal(nodeResult.rows[0].connection_mode, 'pull', 'DATA_FACTORY_NODE_BOOTSTRAP_DB_CONNECTION_MISMATCH')

  const tokenResult = await pool.query(`
    SELECT count(1)::int AS count
    FROM ldt_ops.processing_node_tokens token
    JOIN ldt_ops.processing_nodes node ON node.id = token.node_id
    WHERE node.node_key = $1 AND token.status = 'active'
  `, [dbNodeKey])
  assert.equal(Number(tokenResult.rows[0]?.count ?? 0), 1, 'DATA_FACTORY_NODE_BOOTSTRAP_DB_TOKEN_NOT_FOUND')

  console.log(JSON.stringify({
    ok: true,
    contract: 'data-factory-node-bootstrap.v1',
    nodeKey: dbNodeKey,
    providerType: nodeResult.rows[0].provider_type,
    connectionMode: nodeResult.rows[0].connection_mode,
    generatedFiles: ['bootstrap.json', '.env.datafactory.node', 'install-datafactory-node.sh', 'commands.txt'],
  }, null, 2))
} finally {
  const pool = getProductionPool()
  if (pool) {
    await pool.query('DELETE FROM ldt_ops.processing_nodes WHERE node_key = $1', [dbNodeKey])
    await pool.query('DELETE FROM ldt_ops.artifact_stores WHERE store_key = $1', [dbStoreKey])
  }
  await closeProductionPool()
}
