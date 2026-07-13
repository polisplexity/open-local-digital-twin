import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import pg from 'pg'

import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations, getProductionDatabaseUrl } from '../db/migrate.mjs'

const { Client } = pg

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

await runProductionMigrations()

const client = new Client({ connectionString: getProductionDatabaseUrl() })
await client.connect()

const suffix = crypto.randomUUID().slice(0, 8)
const nodeKey = `smoke-node-${suffix}`
const storeKey = `smoke-store-${suffix}`

async function expectCheckFailure(query, params, expectedConstraint) {
  await client.query('SAVEPOINT expected_check_failure')
  try {
    await client.query(query, params)
    throw new Error(`EXPECTED_CHECK_FAILURE_NOT_RAISED:${expectedConstraint}`)
  } catch (error) {
    assert.equal(error.constraint, expectedConstraint, `UNEXPECTED_CONSTRAINT:${error.constraint}`)
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_check_failure')
    await client.query('RELEASE SAVEPOINT expected_check_failure')
  }
}

try {
  const tableResult = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'ldt_ops'
      AND table_name = ANY($1::text[])
  `, [[
    'artifact_stores',
    'processing_nodes',
    'processing_node_heartbeats',
    'processing_node_tokens',
    'processing_node_stage_bindings',
    'data_factory_dispatches',
  ]])
  const foundTables = new Set(tableResult.rows.map((row) => row.table_name))
  for (const tableName of [
    'artifact_stores',
    'processing_nodes',
    'processing_node_heartbeats',
    'processing_node_tokens',
    'processing_node_stage_bindings',
    'data_factory_dispatches',
  ]) {
    assert.ok(foundTables.has(tableName), `PROCESSING_NODE_TABLE_MISSING:${tableName}`)
  }

  await client.query('BEGIN')

  const store = await client.query(`
    INSERT INTO ldt_ops.artifact_stores (
      store_key,
      display_name,
      store_type,
      uri,
      visibility,
      public_config
    )
    VALUES ($1, 'Smoke Local Store', 'local-filesystem', 'file:///tmp/twin-datafactory-smoke', 'private', '{"root":"/tmp"}'::jsonb)
    RETURNING id
  `, [storeKey])

  const node = await client.query(`
    INSERT INTO ldt_ops.processing_nodes (
      node_key,
      display_name,
      provider_type,
      connection_mode,
      runtime_kind,
      runtime_version,
      image_ref,
      status,
      lifecycle_status,
      default_artifact_store_id,
      capabilities_json,
      public_config_json
    )
    VALUES (
      $1,
      'Smoke Server To Server Node',
      'server-to-server-pull',
      'pull',
      'docker',
      '2026.06.smoke',
      'twin-base-studio-datafactory:smoke',
      'online',
      'validated',
      $2,
      '{"cpuCores":4,"supports":["mvt-build","pmtiles-pack"]}'::jsonb,
      '{"connection":"poll"}'::jsonb
    )
    RETURNING id
  `, [nodeKey, store.rows[0].id])
  const nodeId = node.rows[0].id

  await client.query(`
    INSERT INTO ldt_ops.processing_node_heartbeats (
      node_id,
      status,
      doctor_status,
      runtime_version,
      image_ref,
      cpu_core_count,
      memory_bytes,
      free_disk_bytes,
      running_job_count,
      capabilities_json,
      doctor_json
    )
    VALUES (
      $1,
      'online',
      'passed',
      '2026.06.smoke',
      'twin-base-studio-datafactory:smoke',
      4,
      17179869184,
      107374182400,
      0,
      '{"provider":"server-to-server-pull"}'::jsonb,
      '{"ok":true}'::jsonb
    )
  `, [nodeId])

  await client.query(`
    INSERT INTO ldt_ops.processing_node_tokens (
      node_id,
      token_name,
      token_hash,
      token_scope,
      status
    )
    VALUES ($1, 'smoke-runtime-token', $2, 'runtime', 'active')
  `, [nodeId, `sha256:${crypto.randomUUID()}`])

  await client.query(`
    INSERT INTO ldt_ops.processing_node_stage_bindings (
      node_id,
      stage_key,
      enabled,
      resource_policy
    )
    VALUES ($1, 'viewer-artifacts', true, '{"maxZoom":14}'::jsonb)
  `, [nodeId])

  await client.query(`
    INSERT INTO ldt_ops.data_factory_dispatches (
      node_id,
      stage_key,
      provider_type,
      connection_mode,
      status,
      artifact_store_id,
      dispatch_checksum,
      input_contract,
      artifact_manifest
    )
    VALUES (
      $1,
      'viewer-artifacts',
      'server-to-server-pull',
      'pull',
      'prepared',
      $2,
      'sha256:smoke-dispatch',
      '{"cityId":"smoke"}'::jsonb,
      '{"expected":["pmtiles","mvt-directory","3d-tiles"]}'::jsonb
    )
  `, [nodeId, store.rows[0].id])

  await expectCheckFailure(`
    INSERT INTO ldt_ops.processing_nodes (
      node_key,
      display_name,
      provider_type,
      connection_mode
    )
    VALUES ($1, 'Bad Node', 'specific-kvm4', 'pull')
  `, [`bad-node-${suffix}`], 'processing_nodes_provider_type_check')

  await expectCheckFailure(`
    INSERT INTO ldt_ops.processing_node_tokens (
      node_id,
      token_name,
      token_hash
    )
    VALUES ($1, 'plaintext-token', 'twin_plaintext_token')
  `, [nodeId], 'processing_node_tokens_plaintext_check')

  const summary = await client.query(`
    SELECT
      (SELECT count(*)::int FROM ldt_ops.processing_nodes WHERE node_key = $1) AS nodes,
      (SELECT count(*)::int FROM ldt_ops.processing_node_heartbeats WHERE node_id = $2) AS heartbeats,
      (SELECT count(*)::int FROM ldt_ops.processing_node_tokens WHERE node_id = $2) AS tokens,
      (SELECT count(*)::int FROM ldt_ops.processing_node_stage_bindings WHERE node_id = $2) AS stage_bindings,
      (SELECT count(*)::int FROM ldt_ops.data_factory_dispatches WHERE node_id = $2) AS dispatches
  `, [nodeKey, nodeId])

  assert.equal(summary.rows[0].nodes, 1, 'PROCESSING_NODE_INSERT_MISSING')
  assert.equal(summary.rows[0].heartbeats, 1, 'PROCESSING_NODE_HEARTBEAT_INSERT_MISSING')
  assert.equal(summary.rows[0].tokens, 1, 'PROCESSING_NODE_TOKEN_INSERT_MISSING')
  assert.equal(summary.rows[0].stage_bindings, 1, 'PROCESSING_NODE_STAGE_BINDING_INSERT_MISSING')
  assert.equal(summary.rows[0].dispatches, 1, 'DATA_FACTORY_DISPATCH_INSERT_MISSING')

  await client.query('ROLLBACK')

  console.log(JSON.stringify({
    ok: true,
    contract: 'twin-base-studio-processing-nodes-schema.v1',
    tables: Array.from(foundTables).sort(),
    smoke: {
      providerType: 'server-to-server-pull',
      connectionMode: 'pull',
      artifactStore: 'local-filesystem',
    },
  }, null, 2))
} catch (error) {
  try {
    await client.query('ROLLBACK')
  } catch {}
  throw error
} finally {
  await client.end()
  await closeProductionPool()
}
