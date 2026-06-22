import { requireRateLimit } from '../http/rateLimit.mjs'
import {
  enqueueProviderLayerIngestionJob,
  listProviderLayerIngestionJobReport,
  inspectProviderIngestionCapabilities,
  runProviderLayerIngestionJob,
} from '../services/providerLayerIngestionService.mjs'
import {
  cancelLayerIngestionJob,
  getLayerIngestionJob,
  listCityLayerIngestionJobs,
  promoteRegisteredLayerIngestionJob,
  registerLayerIngestionJob,
  requeueLayerIngestionJob,
} from '../db/productionTwinStore.mjs'
import { requireAdminCity } from './adminLayerRouteHelpers.mjs'

export function registerAdminLayerJobRoutes(app) {
  app.get('/api/admin/cities/:cityId/layer-ingestion-jobs', async (request, response) => {
    try {
      const city = requireAdminCity(response, request.params.cityId)
      if (!city) return
      response.json(await listCityLayerIngestionJobs(city.id, request.query.limit))
    } catch (error) {
      response.status(500).json({
        error: 'CITY_LAYER_INGESTION_JOBS_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/cities/:cityId/layers/:layerKey/ingestion-jobs', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:layer-ingestion-job', { limit: 60, windowMs: 5 * 60_000 })) return
      const city = requireAdminCity(response, request.params.cityId)
      if (!city) return
      const result = await registerLayerIngestionJob(city, {
        ...(request.body?.job ?? request.body ?? {}),
        layerKey: request.params.layerKey,
      })
      response.status(201).json({
        ...result,
        jobs: await listCityLayerIngestionJobs(city.id),
      })
    } catch (error) {
      response.status(400).json({
        error: 'CITY_LAYER_INGESTION_JOB_WRITE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/cities/:cityId/layers/:layerKey/ingestion-jobs/queue', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:layer-ingestion-job-queue', { limit: 40, windowMs: 10 * 60_000 })) return
      const city = requireAdminCity(response, request.params.cityId)
      if (!city) return
      const result = await enqueueProviderLayerIngestionJob(city, request.params.layerKey, request.body ?? {})
      response.status(result.existing ? 200 : 202).json({
        ...result,
        job: await getLayerIngestionJob(result.jobId),
        jobs: await listCityLayerIngestionJobs(city.id),
      })
    } catch (error) {
      response.status(400).json({
        error: 'CITY_LAYER_INGESTION_JOB_QUEUE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/provider-ingestion/capabilities', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:provider-ingestion-capabilities', { limit: 60, windowMs: 5 * 60_000 })) return
      response.json(await inspectProviderIngestionCapabilities())
    } catch (error) {
      response.status(500).json({
        error: 'PROVIDER_INGESTION_CAPABILITIES_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/ingestion-jobs/:jobId', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:layer-ingestion-job-read', { limit: 120, windowMs: 5 * 60_000 })) return
      const result = await getLayerIngestionJob(request.params.jobId)
      response.status(result.ok ? 200 : 404).json(result)
    } catch (error) {
      response.status(500).json({
        error: 'INGESTION_JOB_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/ingestion-jobs/:jobId/report', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:layer-ingestion-job-report', { limit: 120, windowMs: 5 * 60_000 })) return
      response.json(await listProviderLayerIngestionJobReport(request.params.jobId, request.query.limit))
    } catch (error) {
      response.status(500).json({
        error: 'INGESTION_JOB_REPORT_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })


  app.post('/api/admin/ingestion-jobs/:jobId/promote', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:layer-ingestion-job-promote', { limit: 30, windowMs: 10 * 60_000 })) return
      const result = await promoteRegisteredLayerIngestionJob(request.params.jobId, request.body?.submittedBy ?? request.body?.submitted_by ?? 'admin-api')
      response.status(result.ok ? 200 : 400).json({
        ...result,
        job: await getLayerIngestionJob(request.params.jobId),
      })
    } catch (error) {
      response.status(400).json({
        error: 'INGESTION_JOB_PROMOTE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/ingestion-jobs/:jobId/run', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:layer-ingestion-job-run', { limit: 20, windowMs: 10 * 60_000 })) return
      const result = await runProviderLayerIngestionJob(request.params.jobId, request.body ?? {})
      response.status(result.ok ? 200 : 400).json({
        ...result,
        job: await getLayerIngestionJob(request.params.jobId),
        report: await listProviderLayerIngestionJobReport(request.params.jobId, 50),
      })
    } catch (error) {
      response.status(400).json({
        error: 'INGESTION_JOB_RUN_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
        report: await listProviderLayerIngestionJobReport(request.params.jobId, 50),
      })
    }
  })

  app.post('/api/admin/ingestion-jobs/:jobId/cancel', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:layer-ingestion-job-cancel', { limit: 30, windowMs: 10 * 60_000 })) return
      const result = await cancelLayerIngestionJob(request.params.jobId, request.body?.cancelledBy ?? request.body?.cancelled_by ?? 'admin-api')
      response.status(result.ok ? 200 : 400).json({
        ...result,
        job: await getLayerIngestionJob(request.params.jobId),
      })
    } catch (error) {
      response.status(400).json({
        error: 'INGESTION_JOB_CANCEL_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/ingestion-jobs/:jobId/retry', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:layer-ingestion-job-retry', { limit: 30, windowMs: 10 * 60_000 })) return
      const result = await requeueLayerIngestionJob(request.params.jobId, request.body?.submittedBy ?? request.body?.submitted_by ?? 'admin-api')
      response.status(result.ok ? 200 : 400).json({
        ...result,
        job: await getLayerIngestionJob(request.params.jobId),
      })
    } catch (error) {
      response.status(400).json({
        error: 'INGESTION_JOB_RETRY_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })
}
