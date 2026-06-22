import { requireRateLimit } from '../http/rateLimit.mjs'
import { requireAdmin } from '../services/authService.mjs'
import {
  createFiwareSubscription,
  getFiwareSyncJobs,
  listFiwareConnections,
  syncCityToFiware,
  upsertFiwareConnection,
} from '../services/fiwareContextBrokerService.mjs'

export function registerAdminFiwareRoutes(app) {
  app.get('/api/admin/fiware/connections', async (request, response) => {
    try {
      requireAdmin(request)
      response.json(await listFiwareConnections())
    } catch (error) {
      response.status(500).json({
        error: 'FIWARE_CONNECTIONS_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/fiware/connections', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:fiware-connection-upsert', { limit: 20, windowMs: 5 * 60_000 })) return
      requireAdmin(request)
      response.status(201).json(await upsertFiwareConnection(request.body?.connection ?? request.body ?? {}))
    } catch (error) {
      response.status(400).json({
        error: 'FIWARE_CONNECTION_WRITE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/fiware/sync-jobs', async (request, response) => {
    try {
      requireAdmin(request)
      response.json(await getFiwareSyncJobs({
        connectionKey: request.query.connectionKey,
        cityId: request.query.cityId,
        limit: request.query.limit,
      }))
    } catch (error) {
      response.status(500).json({
        error: 'FIWARE_SYNC_JOBS_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/fiware/connections/:connectionKey/sync', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:fiware-sync', { limit: 10, windowMs: 5 * 60_000 })) return
      requireAdmin(request)
      const result = await syncCityToFiware({
        cityId: request.body?.cityId ?? request.body?.city_id,
        connectionKey: request.params.connectionKey,
        ngsiType: request.body?.ngsiType ?? request.body?.ngsi_type,
        limit: request.body?.limit,
        dryRun: request.body?.dryRun === true || request.body?.dry_run === true,
      })
      response.status(202).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'FIWARE_SYNC_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/fiware/connections/:connectionKey/subscriptions', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:fiware-subscription', { limit: 20, windowMs: 5 * 60_000 })) return
      requireAdmin(request)
      response.status(201).json(await createFiwareSubscription({
        connectionKey: request.params.connectionKey,
        subscriptionKey: request.body?.subscriptionKey ?? request.body?.subscription_key,
        ngsiType: request.body?.ngsiType ?? request.body?.ngsi_type,
        watchedAttributes: request.body?.watchedAttributes ?? request.body?.watched_attributes,
        callbackUrl: request.body?.callbackUrl ?? request.body?.callback_url,
        status: request.body?.status,
        metadata: request.body?.metadata,
        pushToBroker: request.body?.pushToBroker === true || request.body?.push_to_broker === true,
      }))
    } catch (error) {
      response.status(400).json({
        error: 'FIWARE_SUBSCRIPTION_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })
}
