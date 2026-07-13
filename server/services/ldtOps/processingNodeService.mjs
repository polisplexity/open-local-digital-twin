import crypto from 'node:crypto'
import { withClient } from './dbUtils.mjs'

export const PROCESSING_NODE_PROVIDER_TYPES = Object.freeze([
  'same-server-sidecar',
  'server-to-server-pull',
  'server-to-server-push',
  'offline-bundle',
  'hpc-batch',
  'cloud-batch',
  'manual-import',
])

export const PROCESSING_NODE_CONNECTION_MODES = Object.freeze([
  'local',
  'pull',
  'push',
  'offline',
  'batch',
  'cloud',
  'manual',
])

export const PROCESSING_NODE_RUNTIME_KINDS = Object.freeze([
  'docker',
  'docker-compose',
  'podman',
  'apptainer',
  'singularity',
  'slurm',
  'pbs',
  'cloud-provider',
  'manual',
  'unknown',
])

const NODE_STATUSES = new Set(['registered', 'online', 'offline', 'busy', 'draining', 'error', 'disabled'])
const LIFECYCLE_STATUSES = new Set(['generated', 'validated', 'federated', 'authority-approved', 'blocked', 'archived'])
const DOCTOR_STATUSES = new Set(['unknown', 'passed', 'warning', 'failed'])
const PROVIDER_TYPES = new Set(PROCESSING_NODE_PROVIDER_TYPES)
const CONNECTION_MODES = new Set(PROCESSING_NODE_CONNECTION_MODES)
const RUNTIME_KINDS = new Set(PROCESSING_NODE_RUNTIME_KINDS)
const ARTIFACT_STORE_TYPES = new Set(['local-filesystem', 'sftp-rsync', 'object-storage', 'offline-bundle', 'ephemeral-scratch', 'manual'])

function normalizeKey(value, fallback = '') {
  const normalized = String(value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{1,128}$/.test(normalized)) {
    throw new Error('PROCESSING_NODE_KEY_INVALID')
  }
  return normalized
}

function stringValue(value, fallback = '') {
  const normalized = String(value ?? fallback).trim()
  return normalized || fallback
}

function jsonValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value
}

function statusValue(value, fallback = 'registered') {
  const status = stringValue(value, fallback)
  if (!NODE_STATUSES.has(status)) throw new Error('PROCESSING_NODE_STATUS_INVALID')
  return status
}

function doctorStatusValue(value, fallback = 'unknown') {
  const status = stringValue(value, fallback)
  if (!DOCTOR_STATUSES.has(status)) throw new Error('PROCESSING_NODE_DOCTOR_STATUS_INVALID')
  return status
}

function enumValue(value, allowed, fallback, errorCode) {
  const normalized = stringValue(value, fallback)
  if (!allowed.has(normalized)) throw new Error(errorCode)
  return normalized
}

function numberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.trunc(number) : null
}

function nonNegativeNumberOrNull(value) {
  const number = numberOrNull(value)
  return number !== null && number >= 0 ? number : null
}

function hashRuntimeToken(rawToken) {
  return `sha256:${crypto.createHash('sha256').update(String(rawToken ?? '')).digest('hex')}`
}

function generateRuntimeToken() {
  return `twin_df_${crypto.randomBytes(32).toString('base64url')}`
}

function publicArtifactStore(row = {}) {
  if (Object.hasOwn(row, 'artifact_store_id') || Object.hasOwn(row, 'artifact_store_key')) {
    if (!row.artifact_store_id) return null
  } else if (!row?.id || !row?.store_key) {
    return null
  }
  return {
    id: row.artifact_store_id ?? row.id,
    storeKey: row.artifact_store_key ?? row.store_key,
    displayName: row.artifact_store_display_name ?? row.display_name,
    storeType: row.artifact_store_type ?? row.store_type,
    uri: row.artifact_store_uri ?? row.uri,
    status: row.artifact_store_status ?? row.status,
    visibility: row.artifact_store_visibility ?? row.visibility,
    publicConfig: row.artifact_store_public_config ?? row.public_config ?? {},
  }
}

function publicNode(row = {}) {
  return {
    id: row.id,
    nodeKey: row.node_key,
    displayName: row.display_name,
    providerType: row.provider_type,
    connectionMode: row.connection_mode,
    runtimeKind: row.runtime_kind,
    runtimeVersion: row.runtime_version ?? null,
    imageRef: row.image_ref ?? null,
    status: row.status,
    lifecycleStatus: row.lifecycle_status,
    capabilities: row.capabilities_json ?? {},
    publicConfig: row.public_config_json ?? {},
    metadata: row.metadata ?? {},
    registeredBy: row.registered_by ?? null,
    lastSeenAt: row.last_seen_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    artifactStore: publicArtifactStore(row),
    latestHeartbeat: row.heartbeat_id ? {
      id: row.heartbeat_id,
      status: row.heartbeat_status,
      doctorStatus: row.heartbeat_doctor_status,
      observedAt: row.heartbeat_observed_at,
      receivedAt: row.heartbeat_received_at,
      runningJobCount: Number(row.heartbeat_running_job_count ?? 0),
      freeDiskBytes: row.heartbeat_free_disk_bytes === null ? null : Number(row.heartbeat_free_disk_bytes ?? 0),
    } : null,
  }
}

async function upsertArtifactStore(client, artifactStore = {}) {
  if (!artifactStore || typeof artifactStore !== 'object') return null
  const storeKeyRaw = artifactStore.storeKey ?? artifactStore.store_key
  if (!storeKeyRaw) return null
  const storeKey = normalizeKey(storeKeyRaw)
  const storeType = enumValue(
    artifactStore.storeType ?? artifactStore.store_type,
    ARTIFACT_STORE_TYPES,
    'local-filesystem',
    'ARTIFACT_STORE_TYPE_INVALID',
  )
  const result = await client.query(`
    INSERT INTO ldt_ops.artifact_stores (
      store_key,
      display_name,
      store_type,
      uri,
      visibility,
      status,
      checksum_policy,
      public_config,
      secret_ref,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb)
    ON CONFLICT (store_key) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      store_type = EXCLUDED.store_type,
      uri = EXCLUDED.uri,
      visibility = EXCLUDED.visibility,
      status = EXCLUDED.status,
      checksum_policy = EXCLUDED.checksum_policy,
      public_config = EXCLUDED.public_config,
      secret_ref = EXCLUDED.secret_ref,
      metadata = EXCLUDED.metadata,
      updated_at = now()
    RETURNING *
  `, [
    storeKey,
    stringValue(artifactStore.displayName ?? artifactStore.display_name, storeKey),
    storeType,
    stringValue(artifactStore.uri, ''),
    stringValue(artifactStore.visibility, 'private'),
    stringValue(artifactStore.status, 'active'),
    stringValue(artifactStore.checksumPolicy ?? artifactStore.checksum_policy, 'required'),
    JSON.stringify(jsonValue(artifactStore.publicConfig ?? artifactStore.public_config)),
    artifactStore.secretRef ?? artifactStore.secret_ref ?? null,
    JSON.stringify(jsonValue(artifactStore.metadata)),
  ])
  return result.rows[0] ?? null
}

async function upsertStageBindings(client, nodeId, stageBindings = []) {
  const normalizedBindings = (Array.isArray(stageBindings) ? stageBindings : [])
    .map((entry) => {
      if (typeof entry === 'string') return { stageKey: entry }
      return entry && typeof entry === 'object' ? entry : null
    })
    .filter(Boolean)

  for (const binding of normalizedBindings) {
    const stageKey = normalizeKey(binding.stageKey ?? binding.stage_key)
    await client.query(`
      INSERT INTO ldt_ops.processing_node_stage_bindings (
        node_id,
        stage_key,
        enabled,
        priority,
        resource_policy
      )
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (node_id, stage_key) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        priority = EXCLUDED.priority,
        resource_policy = EXCLUDED.resource_policy,
        updated_at = now()
    `, [
      nodeId,
      stageKey,
      binding.enabled !== false,
      Number.isFinite(Number(binding.priority)) ? Math.trunc(Number(binding.priority)) : 100,
      JSON.stringify(jsonValue(binding.resourcePolicy ?? binding.resource_policy)),
    ])
  }
}

async function issueNodeRuntimeToken(client, nodeId, {
  tokenName = 'runtime-token',
  tokenScope = 'runtime',
  createdBy = null,
  expiresAt = null,
} = {}) {
  const rawToken = generateRuntimeToken()
  const tokenHash = hashRuntimeToken(rawToken)
  await client.query(`
    INSERT INTO ldt_ops.processing_node_tokens (
      node_id,
      token_name,
      token_hash,
      token_scope,
      status,
      expires_at,
      created_by
    )
    VALUES ($1, $2, $3, $4, 'active', $5, $6)
  `, [
    nodeId,
    stringValue(tokenName, 'runtime-token'),
    tokenHash,
    stringValue(tokenScope, 'runtime'),
    expiresAt,
    createdBy,
  ])
  return rawToken
}

async function selectNodeByKey(client, nodeKey) {
  const result = await client.query(`
    SELECT
      node.*,
      store.id AS artifact_store_id,
      store.store_key AS artifact_store_key,
      store.display_name AS artifact_store_display_name,
      store.store_type AS artifact_store_type,
      store.uri AS artifact_store_uri,
      store.status AS artifact_store_status,
      store.visibility AS artifact_store_visibility,
      store.public_config AS artifact_store_public_config,
      heartbeat.id AS heartbeat_id,
      heartbeat.status AS heartbeat_status,
      heartbeat.doctor_status AS heartbeat_doctor_status,
      heartbeat.observed_at AS heartbeat_observed_at,
      heartbeat.received_at AS heartbeat_received_at,
      heartbeat.running_job_count AS heartbeat_running_job_count,
      heartbeat.free_disk_bytes AS heartbeat_free_disk_bytes
    FROM ldt_ops.processing_nodes node
    LEFT JOIN ldt_ops.artifact_stores store ON store.id = node.default_artifact_store_id
    LEFT JOIN LATERAL (
      SELECT *
      FROM ldt_ops.processing_node_heartbeats
      WHERE node_id = node.id
      ORDER BY observed_at DESC, received_at DESC
      LIMIT 1
    ) heartbeat ON true
    WHERE node.node_key = $1
  `, [nodeKey])
  return result.rows[0] ?? null
}

export async function registerProcessingNode(input = {}) {
  return withClient(async (client) => {
    const nodeKey = normalizeKey(input.nodeKey ?? input.node_key)
    const providerType = enumValue(
      input.providerType ?? input.provider_type,
      PROVIDER_TYPES,
      'same-server-sidecar',
      'PROCESSING_NODE_PROVIDER_TYPE_INVALID',
    )
    const connectionMode = enumValue(
      input.connectionMode ?? input.connection_mode,
      CONNECTION_MODES,
      'local',
      'PROCESSING_NODE_CONNECTION_MODE_INVALID',
    )
    const runtimeKind = enumValue(
      input.runtimeKind ?? input.runtime_kind,
      RUNTIME_KINDS,
      'unknown',
      'PROCESSING_NODE_RUNTIME_KIND_INVALID',
    )
    const lifecycleStatus = enumValue(
      input.lifecycleStatus ?? input.lifecycle_status,
      LIFECYCLE_STATUSES,
      'generated',
      'PROCESSING_NODE_LIFECYCLE_STATUS_INVALID',
    )

    const artifactStore = await upsertArtifactStore(client, input.artifactStore ?? input.artifact_store)
    const result = await client.query(`
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
        public_config_json,
        metadata,
        registered_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, $14)
      ON CONFLICT (node_key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        provider_type = EXCLUDED.provider_type,
        connection_mode = EXCLUDED.connection_mode,
        runtime_kind = EXCLUDED.runtime_kind,
        runtime_version = EXCLUDED.runtime_version,
        image_ref = EXCLUDED.image_ref,
        status = EXCLUDED.status,
        lifecycle_status = EXCLUDED.lifecycle_status,
        default_artifact_store_id = EXCLUDED.default_artifact_store_id,
        capabilities_json = EXCLUDED.capabilities_json,
        public_config_json = EXCLUDED.public_config_json,
        metadata = EXCLUDED.metadata,
        registered_by = COALESCE(EXCLUDED.registered_by, ldt_ops.processing_nodes.registered_by),
        updated_at = now()
      RETURNING *
    `, [
      nodeKey,
      stringValue(input.displayName ?? input.display_name, nodeKey),
      providerType,
      connectionMode,
      runtimeKind,
      input.runtimeVersion ?? input.runtime_version ?? null,
      input.imageRef ?? input.image_ref ?? null,
      statusValue(input.status, 'registered'),
      lifecycleStatus,
      artifactStore?.id ?? null,
      JSON.stringify(jsonValue(input.capabilities ?? input.capabilities_json)),
      JSON.stringify(jsonValue(input.publicConfig ?? input.public_config ?? input.public_config_json)),
      JSON.stringify(jsonValue(input.metadata)),
      input.registeredBy ?? input.registered_by ?? null,
    ])
    const node = result.rows[0]
    await upsertStageBindings(client, node.id, input.stageBindings ?? input.stage_bindings)

    const token = input.issueRuntimeToken || input.issue_runtime_token
      ? await issueNodeRuntimeToken(client, node.id, {
        tokenName: input.tokenName ?? input.token_name ?? 'runtime-token',
        tokenScope: input.tokenScope ?? input.token_scope ?? 'runtime',
        createdBy: input.registeredBy ?? input.registered_by ?? null,
        expiresAt: input.tokenExpiresAt ?? input.token_expires_at ?? null,
      })
      : null

    const selected = await selectNodeByKey(client, nodeKey)
    return {
      ok: true,
      node: publicNode(selected),
      runtimeToken: token,
      runtimeTokenReturnedOnce: Boolean(token),
    }
  })
}

export async function listProcessingNodes({
  providerType = '',
  status = '',
  limit = 50,
} = {}) {
  return withClient(async (client) => {
    const normalizedLimit = Math.max(1, Math.min(200, Number.isFinite(Number(limit)) ? Math.trunc(Number(limit)) : 50))
    const result = await client.query(`
      SELECT
        node.*,
        store.id AS artifact_store_id,
        store.store_key AS artifact_store_key,
        store.display_name AS artifact_store_display_name,
        store.store_type AS artifact_store_type,
        store.uri AS artifact_store_uri,
        store.status AS artifact_store_status,
        store.visibility AS artifact_store_visibility,
        store.public_config AS artifact_store_public_config,
        heartbeat.id AS heartbeat_id,
        heartbeat.status AS heartbeat_status,
        heartbeat.doctor_status AS heartbeat_doctor_status,
        heartbeat.observed_at AS heartbeat_observed_at,
        heartbeat.received_at AS heartbeat_received_at,
        heartbeat.running_job_count AS heartbeat_running_job_count,
        heartbeat.free_disk_bytes AS heartbeat_free_disk_bytes
      FROM ldt_ops.processing_nodes node
      LEFT JOIN ldt_ops.artifact_stores store ON store.id = node.default_artifact_store_id
      LEFT JOIN LATERAL (
        SELECT *
        FROM ldt_ops.processing_node_heartbeats
        WHERE node_id = node.id
        ORDER BY observed_at DESC, received_at DESC
        LIMIT 1
      ) heartbeat ON true
      WHERE ($1::text = '' OR node.provider_type = $1)
        AND ($2::text = '' OR node.status = $2)
      ORDER BY node.updated_at DESC, node.created_at DESC
      LIMIT $3
    `, [String(providerType || ''), String(status || ''), normalizedLimit])
    return {
      ok: true,
      nodes: result.rows.map(publicNode),
      count: result.rowCount,
    }
  })
}

export async function getProcessingNode(nodeKey) {
  return withClient(async (client) => {
    const normalizedNodeKey = normalizeKey(nodeKey)
    const row = await selectNodeByKey(client, normalizedNodeKey)
    return row
      ? { ok: true, node: publicNode(row) }
      : { ok: false, error: 'PROCESSING_NODE_NOT_FOUND', nodeKey: normalizedNodeKey }
  })
}

export async function validateProcessingNodeRuntimeToken({ nodeKey, rawToken }) {
  return withClient(async (client) => {
    const normalizedNodeKey = normalizeKey(nodeKey)
    const token = String(rawToken ?? '').trim()
    if (!token) return { ok: false, error: 'PROCESSING_NODE_TOKEN_REQUIRED', nodeKey: normalizedNodeKey }
    const node = await selectNodeByKey(client, normalizedNodeKey)
    if (!node) return { ok: false, error: 'PROCESSING_NODE_NOT_FOUND', nodeKey: normalizedNodeKey }
    const tokenHash = hashRuntimeToken(token)
    const result = await client.query(`
      UPDATE ldt_ops.processing_node_tokens
      SET last_used_at = now()
      WHERE node_id = $1
        AND token_hash = $2
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > now())
      RETURNING id, token_scope
    `, [node.id, tokenHash])
    return result.rowCount > 0
      ? { ok: true, node: publicNode(node), tokenScope: result.rows[0]?.token_scope ?? 'runtime' }
      : { ok: false, error: 'PROCESSING_NODE_TOKEN_INVALID', nodeKey: normalizedNodeKey }
  })
}

export async function recordProcessingNodeHeartbeat({
  nodeKey,
  rawToken = '',
  requireToken = true,
  heartbeat = {},
} = {}) {
  return withClient(async (client) => {
    const normalizedNodeKey = normalizeKey(nodeKey)
    const node = await selectNodeByKey(client, normalizedNodeKey)
    if (!node) return { ok: false, error: 'PROCESSING_NODE_NOT_FOUND', nodeKey: normalizedNodeKey }

    if (requireToken) {
      const token = String(rawToken ?? '').trim()
      if (!token) return { ok: false, error: 'PROCESSING_NODE_TOKEN_REQUIRED', nodeKey: normalizedNodeKey }
      const tokenHash = hashRuntimeToken(token)
      const tokenResult = await client.query(`
        UPDATE ldt_ops.processing_node_tokens
        SET last_used_at = now()
        WHERE node_id = $1
          AND token_hash = $2
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > now())
        RETURNING id
      `, [node.id, tokenHash])
      if (tokenResult.rowCount === 0) {
        return { ok: false, error: 'PROCESSING_NODE_TOKEN_INVALID', nodeKey: normalizedNodeKey }
      }
    }

    const status = statusValue(heartbeat.status, 'online')
    const doctorStatus = doctorStatusValue(heartbeat.doctorStatus ?? heartbeat.doctor_status, 'unknown')
    const lifecycleStatus = doctorStatus === 'passed' ? 'validated' : node.lifecycle_status
    const runtimeVersion = heartbeat.runtimeVersion ?? heartbeat.runtime_version ?? node.runtime_version ?? null
    const imageRef = heartbeat.imageRef ?? heartbeat.image_ref ?? node.image_ref ?? null
    const capabilities = jsonValue(heartbeat.capabilities ?? heartbeat.capabilities_json ?? node.capabilities_json)

    const heartbeatResult = await client.query(`
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
        doctor_json,
        metrics_json,
        error,
        observed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, COALESCE($14::timestamptz, now()))
      RETURNING *
    `, [
      node.id,
      status,
      doctorStatus,
      runtimeVersion,
      imageRef,
      nonNegativeNumberOrNull(heartbeat.cpuCoreCount ?? heartbeat.cpu_core_count),
      nonNegativeNumberOrNull(heartbeat.memoryBytes ?? heartbeat.memory_bytes),
      nonNegativeNumberOrNull(heartbeat.freeDiskBytes ?? heartbeat.free_disk_bytes),
      nonNegativeNumberOrNull(heartbeat.runningJobCount ?? heartbeat.running_job_count) ?? 0,
      JSON.stringify(capabilities),
      JSON.stringify(jsonValue(heartbeat.doctor ?? heartbeat.doctor_json)),
      JSON.stringify(jsonValue(heartbeat.metrics ?? heartbeat.metrics_json)),
      JSON.stringify(jsonValue(heartbeat.error)),
      heartbeat.observedAt ?? heartbeat.observed_at ?? null,
    ])

    await client.query(`
      UPDATE ldt_ops.processing_nodes
      SET
        status = $2,
        lifecycle_status = $3,
        runtime_version = $4,
        image_ref = $5,
        capabilities_json = $6::jsonb,
        last_seen_at = now(),
        updated_at = now()
      WHERE id = $1
    `, [
      node.id,
      status,
      lifecycleStatus,
      runtimeVersion,
      imageRef,
      JSON.stringify(capabilities),
    ])

    const selected = await selectNodeByKey(client, normalizedNodeKey)
    return {
      ok: true,
      node: publicNode(selected),
      heartbeat: {
        id: heartbeatResult.rows[0]?.id,
        status,
        doctorStatus,
        receivedAt: heartbeatResult.rows[0]?.received_at,
        observedAt: heartbeatResult.rows[0]?.observed_at,
      },
    }
  })
}
