import { requireRateLimit } from '../http/rateLimit.mjs'
import { findCityConfig } from '../services/cityRegistry.mjs'
import {
  authenticateProviderApiRequest,
  buildProviderUploadIntent,
  providerApiStatus,
  verifyProviderUploadSignature,
} from '../services/providerApiAuthService.mjs'
import {
  getProviderUploadMetadata,
  providerUploadContentPath,
  saveProviderUpload,
} from '../services/providerUploadStore.mjs'
import { enqueueProviderLayerIngestionJob } from '../services/providerLayerIngestionService.mjs'
import { recordFiwareObservation } from '../services/fiwareContextBrokerService.mjs'
import {
  getLayerIngestionJob,
  upsertCityProviderLayer,
} from '../db/productionTwinStore.mjs'

function requestBaseUrl(request) {
  const proto = String(request.headers['x-forwarded-proto'] || request.protocol || 'http').split(',')[0].trim()
  const host = String(request.headers['x-forwarded-host'] || request.get('host') || '').split(',')[0].trim()
  return `${proto}://${host}`
}

function requireProviderApi(request, response, scopes = []) {
  const access = authenticateProviderApiRequest(request, scopes)
  if (!access.ok) {
    response.status(access.status ?? 401).json({
      error: access.error,
      detail: access.detail,
      missingScopes: access.missingScopes,
    })
    return null
  }
  return access.provider
}

export function registerProviderRoutes(app) {
  app.post('/api/provider/v1/fiware/observations', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'provider:fiware-observation', { limit: 300, windowMs: 60_000 })) return
      const provider = requireProviderApi(request, response, ['provider:ingest'])
      if (!provider) return
      response.status(201).json(await recordFiwareObservation({
        ngsiId: request.body?.ngsiId ?? request.body?.ngsi_id ?? request.body?.id,
        observedProperty: request.body?.observedProperty ?? request.body?.observed_property ?? request.body?.attribute,
        observedAt: request.body?.observedAt ?? request.body?.observed_at,
        value: request.body?.value,
        unitCode: request.body?.unitCode ?? request.body?.unit_code,
        sourcePayload: {
          providerId: provider.id,
          payload: request.body ?? {},
        },
      }))
    } catch (error) {
      response.status(400).json({
        error: 'FIWARE_OBSERVATION_RECORD_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/provider/v1/status', (_request, response) => {
    response.json({
      ok: true,
      service: 'twin-base-studio-provider-api',
      auth: providerApiStatus(),
      endpoints: {
        queueJob: '/api/provider/v1/cities/:cityId/layers/:layerKey/jobs',
        uploadIntent: '/api/provider/v1/cities/:cityId/layers/:layerKey/upload-intents',
      },
    })
  })

  app.post('/api/provider/v1/cities/:cityId/layers/:layerKey/upload-intents', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'provider:upload-intent', { limit: 60, windowMs: 10 * 60_000 })) return
      const provider = requireProviderApi(request, response, ['provider:upload'])
      if (!provider) return
      const city = findCityConfig(request.params.cityId)
      if (!city) {
        response.status(404).json({ error: 'CITY_NOT_FOUND' })
        return
      }
      const sourceFormat = String(request.body?.sourceFormat ?? request.body?.source_format ?? '').trim()
      if (!sourceFormat) {
        response.status(400).json({ error: 'SOURCE_FORMAT_REQUIRED' })
        return
      }
      response.status(201).json({
        ok: true,
        intent: buildProviderUploadIntent({
          providerId: provider.id,
          cityId: city.id,
          layerKey: request.params.layerKey,
          sourceFormat,
          fileName: request.body?.fileName ?? request.body?.file_name,
          maxBytes: request.body?.maxBytes ?? request.body?.max_bytes,
          baseUrl: requestBaseUrl(request),
        }),
      })
    } catch (error) {
      response.status(400).json({
        error: 'PROVIDER_UPLOAD_INTENT_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.put('/api/provider/v1/uploads/:uploadId', async (request, response) => {
    try {
      const verified = verifyProviderUploadSignature({
        ...request.query,
        uploadId: request.params.uploadId,
      })
      if (!verified.ok) {
        response.status(verified.status ?? 400).json({ error: verified.error })
        return
      }
      const metadata = await saveProviderUpload({
        uploadId: request.params.uploadId,
        intent: verified.intent,
        request,
      })
      response.status(201).json({
        ok: true,
        upload: metadata,
      })
    } catch (error) {
      response.status(400).json({
        error: 'PROVIDER_UPLOAD_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/provider/v1/uploads/:uploadId/source', (request, response) => {
    const verified = verifyProviderUploadSignature({
      ...request.query,
      uploadId: request.params.uploadId,
    })
    if (!verified.ok) {
      response.status(verified.status ?? 400).json({ error: verified.error })
      return
    }
    const filePath = providerUploadContentPath(request.params.uploadId)
    if (!filePath) {
      response.status(404).json({ error: 'PROVIDER_UPLOAD_NOT_FOUND' })
      return
    }
    const metadata = getProviderUploadMetadata(request.params.uploadId)
    response.setHeader('Content-Type', metadata?.contentType ?? 'application/octet-stream')
    response.setHeader('Content-Disposition', `attachment; filename="${metadata?.fileName || request.params.uploadId}"`)
    response.sendFile(filePath)
  })

  app.post('/api/provider/v1/cities/:cityId/layers/:layerKey/jobs', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'provider:queue-job', { limit: 120, windowMs: 10 * 60_000 })) return
      const provider = requireProviderApi(request, response, ['provider:ingest'])
      if (!provider) return
      const city = findCityConfig(request.params.cityId)
      if (!city) {
        response.status(404).json({ error: 'CITY_NOT_FOUND' })
        return
      }

      const layerPayload = request.body?.layer
      if (layerPayload) {
        await upsertCityProviderLayer(city, {
          ...layerPayload,
          key: request.params.layerKey,
          providerId: layerPayload.providerId ?? layerPayload.provider_id ?? provider.id,
          metadata: {
            ...(layerPayload.metadata ?? {}),
            providerApi: {
              providerId: provider.id,
              registeredAt: new Date().toISOString(),
            },
          },
        })
      }

      const result = await enqueueProviderLayerIngestionJob(city, request.params.layerKey, {
        ...(request.body?.job ?? request.body ?? {}),
        providerId: request.body?.providerId ?? request.body?.provider_id ?? provider.id,
        submittedBy: request.body?.submittedBy ?? request.body?.submitted_by ?? `provider-api:${provider.id}`,
        metadata: {
          ...(request.body?.metadata ?? {}),
          providerApi: {
            providerId: provider.id,
            receivedAt: new Date().toISOString(),
          },
        },
      })
      response.status(result.existing ? 200 : 202).json({
        ...result,
        provider: { id: provider.id },
        job: await getLayerIngestionJob(result.jobId),
      })
    } catch (error) {
      response.status(400).json({
        error: 'PROVIDER_JOB_QUEUE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })
}
