import http from 'node:http'
import pg from 'pg'
import { getProductionDatabaseUrl } from '../db/migrate.mjs'
import {
  closeFiwarePool,
  createFiwareSubscription,
  listFiwareConnections,
  recordFiwareObservation,
  syncCityToFiware,
  upsertFiwareConnection,
} from '../services/fiwareContextBrokerService.mjs'

const { Client } = pg

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : null)
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

async function startMockBroker() {
  const received = {
    upserts: [],
    subscriptions: [],
  }
  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === 'POST' && request.url === '/ngsi-ld/v1/entityOperations/upsert') {
        const body = await readJsonBody(request)
        received.upserts.push({
          headers: request.headers,
          body,
        })
        response.writeHead(204)
        response.end()
        return
      }
      if (request.method === 'POST' && request.url === '/ngsi-ld/v1/subscriptions') {
        const body = await readJsonBody(request)
        received.subscriptions.push({
          headers: request.headers,
          body,
        })
        response.writeHead(201, { Location: '/ngsi-ld/v1/subscriptions/mock-subscription' })
        response.end()
        return
      }
      response.writeHead(404, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'NOT_FOUND' }))
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: String(error?.message ?? 'UNKNOWN') }))
    }
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  return {
    url: `http://127.0.0.1:${address.port}`,
    received,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

const connectionString = getProductionDatabaseUrl()
assert(connectionString, 'DATABASE_URL_REQUIRED')

const client = new Client({ connectionString })
const broker = await startMockBroker()
let connectionKey = ''
let observationId = ''
await client.connect()

try {
  connectionKey = `phase5-smoke-${Date.now()}`
  const connection = await upsertFiwareConnection({
    connectionKey,
    brokerUrl: broker.url,
    tenant: 'twin-base-studio',
    status: 'active',
    batchSize: 2,
    metadata: {
      phase: 'phase-5-fiware-smoke',
      servicePath: '/',
    },
  })
  assert(connection.ok, 'FIWARE_CONNECTION_UPSERT_FAILED')

  const connections = await listFiwareConnections()
  assert(connections.connections.some((entry) => entry.connection_key === connectionKey), 'FIWARE_CONNECTION_LIST_MISSING')

  const sync = await syncCityToFiware({
    cityId: 'adazi',
    connectionKey,
    ngsiType: 'Building',
    limit: 3,
  })
  assert(sync.ok, 'FIWARE_SYNC_FAILED')
  assert(sync.selected === 3, 'FIWARE_SYNC_SELECTED_MISMATCH')
  assert(sync.pushed === 3, 'FIWARE_SYNC_PUSHED_MISMATCH')
  assert(broker.received.upserts.length === 2, 'FIWARE_BATCH_COUNT_MISMATCH')
  assert(broker.received.upserts[0].body[0].type === 'Building', 'FIWARE_BATCH_ENTITY_TYPE_INVALID')
  assert(broker.received.upserts[0].headers['fiware-service'] === 'twin-base-studio', 'FIWARE_TENANT_HEADER_MISSING')

  const state = await client.query(
    `
      SELECT count(*)::int AS synced
      FROM ldt_fiware.context_projection_state ps
      JOIN ldt_fiware.context_broker_connections c ON c.id = ps.connection_id
      WHERE c.connection_key = $1
        AND ps.sync_status = 'synced'
    `,
    [connectionKey],
  )
  assert(state.rows[0].synced === 3, 'FIWARE_PROJECTION_STATE_SYNCED_MISMATCH')

  const subscription = await createFiwareSubscription({
    connectionKey,
    subscriptionKey: `${connectionKey}-building-height`,
    ngsiType: 'Building',
    watchedAttributes: ['height', 'sourceCoverageStatus'],
    callbackUrl: 'http://127.0.0.1:4192/api/provider/v1/fiware/callbacks/building-height',
    status: 'active',
    pushToBroker: true,
  })
  assert(subscription.ok, 'FIWARE_SUBSCRIPTION_CREATE_FAILED')
  assert(subscription.brokerResponse.status === 201, 'FIWARE_SUBSCRIPTION_BROKER_STATUS_INVALID')
  assert(broker.received.subscriptions.length === 1, 'FIWARE_SUBSCRIPTION_NOT_RECEIVED')

  const ngsiId = broker.received.upserts[0].body[0].id
  const observation = await recordFiwareObservation({
    ngsiId,
    observedProperty: 'height',
    value: { type: 'Property', value: 8 },
    sourcePayload: { source: 'phase-5-smoke' },
  })
  observationId = observation.observation.id
  assert(observation.ok, 'FIWARE_OBSERVATION_RECORD_FAILED')
  assert(observation.observation.entity_id, 'FIWARE_OBSERVATION_ENTITY_LINK_MISSING')

  const job = await client.query(
    `
      SELECT status, stats
      FROM ldt_fiware.context_sync_jobs
      WHERE id = $1
    `,
    [sync.jobId],
  )
  assert(job.rows[0].status === 'completed', 'FIWARE_SYNC_JOB_NOT_COMPLETED')
  assert(job.rows[0].stats.pushed === 3, 'FIWARE_SYNC_JOB_STATS_INVALID')

  console.log(JSON.stringify({
    ok: true,
    connectionKey,
    pushed: sync.pushed,
    batches: sync.batches,
    subscriptionStatus: subscription.brokerResponse.status,
    observationId,
  }, null, 2))
} finally {
  if (observationId) {
    await client.query('DELETE FROM ldt_fiware.context_observations WHERE id = $1', [observationId]).catch(() => {})
  }
  if (connectionKey) {
    await client.query('DELETE FROM ldt_fiware.context_broker_connections WHERE connection_key = $1', [connectionKey]).catch(() => {})
  }
  await client.end()
  await closeFiwarePool()
  await broker.close()
}
