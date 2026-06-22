import crypto from 'node:crypto'
import { closeSharedProductionPool, withProductionClient as withClient } from './serviceDatabase.mjs'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 5000
const DEFAULT_BATCH_SIZE = 100
const MAX_BATCH_SIZE = 500

export async function closeFiwarePool() {
  await closeSharedProductionPool()
}

function parsePositiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

function normalizePath(path = '/ngsi-ld/v1') {
  const value = String(path || '/ngsi-ld/v1').trim()
  return value.startsWith('/') ? value.replace(/\/+$/, '') : `/${value.replace(/\/+$/, '')}`
}

function endpointUrl(connection, suffix) {
  const base = String(connection.broker_url || '').replace(/\/+$/, '')
  const path = normalizePath(connection.ngsi_ld_path)
  return `${base}${path}${suffix}`
}

function payloadHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function normalizedConnectionPayload(payload = {}) {
  const connectionKey = String(payload.connectionKey ?? payload.connection_key ?? '').trim()
  const brokerUrl = String(payload.brokerUrl ?? payload.broker_url ?? '').trim()
  if (!connectionKey) throw new Error('FIWARE_CONNECTION_KEY_REQUIRED')
  if (!brokerUrl) throw new Error('FIWARE_BROKER_URL_REQUIRED')
  return {
    connectionKey,
    brokerUrl,
    tenant: String(payload.tenant ?? '').trim() || null,
    authMode: String(payload.authMode ?? payload.auth_mode ?? 'none').trim() || 'none',
    status: String(payload.status ?? 'active').trim() || 'active',
    ngsiLdPath: normalizePath(payload.ngsiLdPath ?? payload.ngsi_ld_path ?? '/ngsi-ld/v1'),
    batchSize: parsePositiveInteger(payload.batchSize ?? payload.batch_size, DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE),
    headers: payload.headers && typeof payload.headers === 'object' ? payload.headers : {},
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
  }
}

function connectionHeaders(connection, extraHeaders = {}) {
  const headers = {
    Accept: 'application/ld+json, application/json',
    'Content-Type': 'application/ld+json',
    ...connection.headers,
    ...extraHeaders,
  }
  if (connection.tenant) {
    headers['Fiware-Service'] = connection.tenant
    headers['NGSILD-Tenant'] = connection.tenant
  }
  const servicePath = connection.metadata?.servicePath || connection.metadata?.fiwareServicePath
  if (servicePath) headers['Fiware-ServicePath'] = servicePath
  const authHeaderEnv = connection.metadata?.authHeaderEnv
  if (authHeaderEnv && process.env[authHeaderEnv]) headers.Authorization = process.env[authHeaderEnv]
  const bearerTokenEnv = connection.metadata?.bearerTokenEnv
  if (bearerTokenEnv && process.env[bearerTokenEnv]) headers.Authorization = `Bearer ${process.env[bearerTokenEnv]}`
  const apiKeyHeader = connection.metadata?.apiKeyHeader
  const apiKeyEnv = connection.metadata?.apiKeyEnv
  if (apiKeyHeader && apiKeyEnv && process.env[apiKeyEnv]) headers[apiKeyHeader] = process.env[apiKeyEnv]
  return headers
}

async function readConnection(client, connectionKey) {
  const result = await client.query(
    `
      SELECT
        id,
        connection_key,
        broker_url,
        tenant,
        auth_mode,
        status,
        metadata,
        ngsi_ld_path,
        batch_size,
        headers,
        created_at,
        updated_at
      FROM ldt_fiware.context_broker_connections
      WHERE connection_key = $1
    `,
    [connectionKey],
  )
  if (result.rowCount === 0) throw new Error(`FIWARE_CONNECTION_NOT_FOUND:${connectionKey}`)
  return result.rows[0]
}

async function createSyncJob(client, { connectionId, cityId, ngsiType, limit, dryRun }) {
  const result = await client.query(
    `
      INSERT INTO ldt_fiware.context_sync_jobs (
        connection_id,
        city_id,
        direction,
        status,
        started_at,
        job_key,
        ngsi_type,
        requested_limit,
        dry_run,
        stats
      )
      VALUES (
        $1,
        $2,
        'push',
        'running',
        now(),
        $3,
        $4,
        $5,
        $6,
        '{}'::jsonb
      )
      RETURNING id
    `,
    [
      connectionId,
      cityId,
      `fiware-sync:${connectionId}:${cityId}:${Date.now()}`,
      ngsiType || null,
      limit,
      dryRun,
    ],
  )
  return result.rows[0].id
}

async function finishSyncJob(client, jobId, status, stats, errorMessage = null) {
  await client.query(
    `
      UPDATE ldt_fiware.context_sync_jobs
      SET
        status = $2,
        finished_at = now(),
        stats = $3::jsonb,
        error_message = $4
      WHERE id = $1
    `,
    [jobId, status, JSON.stringify(stats), errorMessage],
  )
}

async function selectProjectionBatch(client, { cityId, ngsiType, limit }) {
  const params = [cityId, limit]
  const typeClause = ngsiType ? 'AND nem.ngsi_type = $3' : ''
  if (ngsiType) params.push(ngsiType)
  const result = await client.query(
    `
      SELECT
        nep.entity_id,
        nep.ngsi_id,
        nep.ngsi_payload,
        nem.ngsi_type
      FROM ldt_interop.ngsi_entity_projections nep
      JOIN ldt_interop.ngsi_entity_mappings nem ON nem.id = nep.mapping_id
      JOIN ldt_core.city_entities ce ON ce.id = nep.entity_id
      WHERE ce.city_id = $1
        ${typeClause}
      ORDER BY nem.ngsi_type, ce.stable_id
      LIMIT $2
    `,
    params,
  )
  return result.rows
}

async function markProjectionStates(client, { connectionId, jobId, rows, status, errorMessage = null }) {
  if (rows.length === 0) return
  await client.query(
    `
      INSERT INTO ldt_fiware.context_projection_state (
        connection_id,
        entity_id,
        ngsi_id,
        ngsi_type,
        payload_hash,
        sync_status,
        last_sync_job_id,
        last_synced_at,
        last_error,
        metadata
      )
      SELECT
        $1::uuid,
        payload.entity_id::uuid,
        payload.ngsi_id,
        payload.ngsi_type,
        payload.payload_hash,
        $3,
        $2::uuid,
        CASE WHEN $3 = 'synced' THEN now() ELSE NULL END,
        $4,
        jsonb_build_object('phase', 'phase-5-fiware')
      FROM jsonb_to_recordset($5::jsonb) AS payload(
        entity_id uuid,
        ngsi_id text,
        ngsi_type text,
        payload_hash text
      )
      ON CONFLICT (connection_id, entity_id) DO UPDATE SET
        ngsi_id = EXCLUDED.ngsi_id,
        ngsi_type = EXCLUDED.ngsi_type,
        payload_hash = EXCLUDED.payload_hash,
        sync_status = EXCLUDED.sync_status,
        last_sync_job_id = EXCLUDED.last_sync_job_id,
        last_synced_at = COALESCE(EXCLUDED.last_synced_at, ldt_fiware.context_projection_state.last_synced_at),
        last_error = EXCLUDED.last_error,
        metadata = ldt_fiware.context_projection_state.metadata || EXCLUDED.metadata,
        updated_at = now()
    `,
    [
      connectionId,
      jobId,
      status,
      errorMessage,
      JSON.stringify(rows.map((row) => ({
        entity_id: row.entity_id,
        ngsi_id: row.ngsi_id,
        ngsi_type: row.ngsi_type,
        payload_hash: payloadHash(row.ngsi_payload),
      }))),
    ],
  )
}

function chunkRows(rows, batchSize) {
  const chunks = []
  for (let index = 0; index < rows.length; index += batchSize) {
    chunks.push(rows.slice(index, index + batchSize))
  }
  return chunks
}

async function postEntityBatch(connection, rows) {
  const url = endpointUrl(connection, '/entityOperations/upsert')
  const response = await fetch(url, {
    method: 'POST',
    headers: connectionHeaders(connection),
    body: JSON.stringify(rows.map((row) => row.ngsi_payload)),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`FIWARE_BATCH_UPSERT_FAILED:${response.status}:${body.slice(0, 500)}`)
  }
  return response.status
}

export async function upsertFiwareConnection(payload = {}) {
  const normalized = normalizedConnectionPayload(payload)
  return await withClient(async (client) => {
    const result = await client.query(
      `
        INSERT INTO ldt_fiware.context_broker_connections (
          connection_key,
          broker_url,
          tenant,
          auth_mode,
          status,
          metadata,
          ngsi_ld_path,
          batch_size,
          headers
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb)
        ON CONFLICT (connection_key) DO UPDATE SET
          broker_url = EXCLUDED.broker_url,
          tenant = EXCLUDED.tenant,
          auth_mode = EXCLUDED.auth_mode,
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata,
          ngsi_ld_path = EXCLUDED.ngsi_ld_path,
          batch_size = EXCLUDED.batch_size,
          headers = EXCLUDED.headers,
          updated_at = now()
        RETURNING id, connection_key, broker_url, tenant, auth_mode, status, ngsi_ld_path, batch_size, metadata
      `,
      [
        normalized.connectionKey,
        normalized.brokerUrl,
        normalized.tenant,
        normalized.authMode,
        normalized.status,
        JSON.stringify(normalized.metadata),
        normalized.ngsiLdPath,
        normalized.batchSize,
        JSON.stringify(normalized.headers),
      ],
    )
    return { ok: true, connection: result.rows[0] }
  })
}

export async function listFiwareConnections() {
  return await withClient(async (client) => {
    const result = await client.query(
      `
        SELECT
          c.id,
          c.connection_key,
          c.broker_url,
          c.tenant,
          c.auth_mode,
          c.status,
          c.ngsi_ld_path,
          c.batch_size,
          c.metadata,
          c.created_at,
          c.updated_at,
          count(ps.id)::int AS projection_state_count,
          count(ps.id) FILTER (WHERE ps.sync_status = 'synced')::int AS synced_count,
          count(ps.id) FILTER (WHERE ps.sync_status = 'failed')::int AS failed_count
        FROM ldt_fiware.context_broker_connections c
        LEFT JOIN ldt_fiware.context_projection_state ps ON ps.connection_id = c.id
        GROUP BY c.id
        ORDER BY c.connection_key
      `,
    )
    return { ok: true, connections: result.rows }
  })
}

export async function getFiwareSyncJobs({ connectionKey = '', cityId = '', limit = 20 } = {}) {
  return await withClient(async (client) => {
    const rowLimit = parsePositiveInteger(limit, 20, 200)
    const params = [rowLimit]
    const clauses = []
    if (connectionKey) {
      params.push(connectionKey)
      clauses.push(`c.connection_key = $${params.length}`)
    }
    if (cityId) {
      params.push(cityId)
      clauses.push(`j.city_id = $${params.length}`)
    }
    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const result = await client.query(
      `
        SELECT
          j.id,
          j.job_key,
          c.connection_key,
          j.city_id,
          j.direction,
          j.status,
          j.ngsi_type,
          j.requested_limit,
          j.dry_run,
          j.started_at,
          j.finished_at,
          j.stats,
          j.error_message
        FROM ldt_fiware.context_sync_jobs j
        LEFT JOIN ldt_fiware.context_broker_connections c ON c.id = j.connection_id
        ${whereClause}
        ORDER BY j.started_at DESC NULLS LAST, j.id DESC
        LIMIT $1
      `,
      params,
    )
    return { ok: true, jobs: result.rows }
  })
}

export async function syncCityToFiware({
  cityId,
  connectionKey,
  ngsiType = '',
  limit = DEFAULT_LIMIT,
  dryRun = false,
} = {}) {
  if (!cityId) throw new Error('CITY_ID_REQUIRED')
  if (!connectionKey) throw new Error('FIWARE_CONNECTION_KEY_REQUIRED')
  const rowLimit = parsePositiveInteger(limit, DEFAULT_LIMIT, MAX_LIMIT)

  return await withClient(async (client) => {
    const connection = await readConnection(client, connectionKey)
    const jobId = await createSyncJob(client, {
      connectionId: connection.id,
      cityId,
      ngsiType,
      limit: rowLimit,
      dryRun,
    })
    const stats = {
      selected: 0,
      pushed: 0,
      failed: 0,
      batches: 0,
      dryRun,
      ngsiType: ngsiType || null,
    }

    try {
      const rows = await selectProjectionBatch(client, { cityId, ngsiType, limit: rowLimit })
      stats.selected = rows.length
      const batchSize = parsePositiveInteger(connection.batch_size, DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE)

      if (dryRun) {
        await markProjectionStates(client, {
          connectionId: connection.id,
          jobId,
          rows,
          status: 'pending',
        })
        stats.batches = Math.ceil(rows.length / batchSize)
        await finishSyncJob(client, jobId, 'completed', stats)
        return { ok: true, jobId, connectionKey, cityId, ...stats }
      }

      for (const batch of chunkRows(rows, batchSize)) {
        await postEntityBatch(connection, batch)
        await markProjectionStates(client, {
          connectionId: connection.id,
          jobId,
          rows: batch,
          status: 'synced',
        })
        stats.pushed += batch.length
        stats.batches += 1
      }

      await finishSyncJob(client, jobId, 'completed', stats)
      return { ok: true, jobId, connectionKey, cityId, ...stats }
    } catch (error) {
      const message = String(error?.message ?? 'UNKNOWN_FIWARE_SYNC_ERROR')
      stats.failed = Math.max(0, stats.selected - stats.pushed)
      await finishSyncJob(client, jobId, 'failed', stats, message)
      throw error
    }
  })
}

export async function createFiwareSubscription({
  connectionKey,
  subscriptionKey,
  ngsiType = '',
  watchedAttributes = [],
  callbackUrl = '',
  status = 'draft',
  metadata = {},
  pushToBroker = false,
} = {}) {
  if (!connectionKey) throw new Error('FIWARE_CONNECTION_KEY_REQUIRED')
  if (!subscriptionKey) throw new Error('FIWARE_SUBSCRIPTION_KEY_REQUIRED')
  return await withClient(async (client) => {
    const connection = await readConnection(client, connectionKey)
    const attrs = Array.isArray(watchedAttributes)
      ? watchedAttributes.map((attr) => String(attr).trim()).filter(Boolean)
      : []

    let brokerResponse = null
    if (pushToBroker) {
      const subscriptionPayload = {
        id: `urn:ngsi-ld:Subscription:${subscriptionKey}`,
        type: 'Subscription',
        entities: ngsiType ? [{ type: ngsiType }] : undefined,
        watchedAttributes: attrs.length ? attrs : undefined,
        notification: {
          endpoint: {
            uri: callbackUrl,
            accept: 'application/ld+json',
          },
        },
      }
      const response = await fetch(endpointUrl(connection, '/subscriptions'), {
        method: 'POST',
        headers: connectionHeaders(connection),
        body: JSON.stringify(subscriptionPayload),
      })
      brokerResponse = {
        status: response.status,
        ok: response.ok,
        location: response.headers.get('location'),
      }
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`FIWARE_SUBSCRIPTION_CREATE_FAILED:${response.status}:${body.slice(0, 500)}`)
      }
    }

    const result = await client.query(
      `
        INSERT INTO ldt_fiware.context_broker_subscriptions (
          connection_id,
          subscription_key,
          ngsi_type,
          watched_attributes,
          callback_url,
          status,
          metadata
        )
        VALUES ($1, $2, $3, $4::text[], $5, $6, $7::jsonb)
        ON CONFLICT (connection_id, subscription_key) DO UPDATE SET
          ngsi_type = EXCLUDED.ngsi_type,
          watched_attributes = EXCLUDED.watched_attributes,
          callback_url = EXCLUDED.callback_url,
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata
        RETURNING id, subscription_key, ngsi_type, watched_attributes, callback_url, status, metadata
      `,
      [
        connection.id,
        subscriptionKey,
        ngsiType || null,
        attrs,
        callbackUrl || null,
        status,
        JSON.stringify({
          phase: 'phase-5-fiware',
          brokerResponse,
          ...metadata,
        }),
      ],
    )

    return { ok: true, subscription: result.rows[0], brokerResponse }
  })
}

export async function recordFiwareObservation({
  ngsiId,
  observedProperty,
  observedAt = new Date().toISOString(),
  value,
  unitCode = '',
  sourcePayload = {},
} = {}) {
  if (!ngsiId) throw new Error('NGSI_ID_REQUIRED')
  if (!observedProperty) throw new Error('OBSERVED_PROPERTY_REQUIRED')
  return await withClient(async (client) => {
    const entity = await client.query(
      `
        SELECT entity_id
        FROM ldt_interop.ngsi_entity_projections
        WHERE ngsi_id = $1
        LIMIT 1
      `,
      [ngsiId],
    )
    const result = await client.query(
      `
        INSERT INTO ldt_fiware.context_observations (
          entity_id,
          ngsi_id,
          observed_property,
          observed_at,
          value,
          unit_code,
          source_payload
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)
        RETURNING id, entity_id, ngsi_id, observed_property, observed_at, value, unit_code
      `,
      [
        entity.rows[0]?.entity_id ?? null,
        ngsiId,
        observedProperty,
        observedAt,
        JSON.stringify(value ?? null),
        unitCode || null,
        JSON.stringify(sourcePayload ?? {}),
      ],
    )
    return { ok: true, observation: result.rows[0] }
  })
}
