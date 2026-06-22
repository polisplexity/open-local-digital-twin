import { buildViewerSurfaceManifest } from '../../services/baseTwin/viewerContracts/viewerSurfaceManifest.mjs'
import {
  createCityVisualShareManifest,
  getCityVisualShareManifest,
  listCityVisualShareManifests,
  publishCityVisualShareManifest,
} from '../../services/liveFeature/shareManifestUseCaseService.mjs'
import { requireLiveAccess } from '../liveRouteHelpers.mjs'
import {
  actorId,
  escapeAttribute,
  requestOrigin,
} from './liveHttpModel.mjs'

function shareQuery(request) {
  return {
    surface: request.query.surface,
    mode: request.query.mode,
    status: request.query.status,
    limit: request.query.limit,
  }
}

function surfaceViewerPath(surface) {
  if (surface === 'municipal3d' || surface === '3d' || surface === 'municipal') return '3d'
  if (surface === 'immersive' || surface === 'public' || surface === 'story') return 'immersive'
  return 'map'
}

function shareEmbedContract(request, cityId, share) {
  if (!share?.shareKey) return null
  const cityPath = encodeURIComponent(cityId)
  const sharePath = encodeURIComponent(share.shareKey)
  const viewerPath = `/live/${cityPath}/${surfaceViewerPath(share.surface)}?embed=1&shareKey=${sharePath}`
  const manifestPath = `/api/live/${cityPath}/viewer-share-manifests/${sharePath}`
  const origin = requestOrigin(request)
  const viewerUrl = origin ? `${origin}${viewerPath}` : viewerPath
  const manifestUrl = origin ? `${origin}${manifestPath}` : manifestPath
  const title = escapeAttribute(share.title || `${cityId} ${share.surface || 'map'} share`)

  return {
    viewerPath,
    viewerUrl,
    manifestPath,
    manifestUrl,
    iframe: `<iframe src="${escapeAttribute(viewerUrl)}" title="${title}" loading="lazy" allowfullscreen></iframe>`,
  }
}

function shareWithEmbed(request, cityId, share) {
  if (!share) return share
  return {
    ...share,
    embed: shareEmbedContract(request, cityId, share),
  }
}

function shareListWithEmbeds(request, result) {
  return {
    ...result,
    shares: Array.isArray(result.shares)
      ? result.shares.map((share) => shareWithEmbed(request, result.cityId, share))
      : [],
  }
}

function shareResultWithEmbed(request, result) {
  return {
    ...result,
    share: shareWithEmbed(request, result.cityId, result.share),
  }
}

function allowedLayerKeys(manifest) {
  const keys = new Set()
  for (const family of manifest.layerFamilies ?? []) {
    if (family.key) keys.add(family.key)
    for (const layerKey of family.keys ?? []) {
      keys.add(layerKey)
    }
  }
  return keys
}

function manifestSelectionScopes(manifest) {
  return new Set((manifest.selectionScopes ?? []).map((scope) => scope.key).filter(Boolean))
}

function normalizeSharePayload(request, access) {
  const body = request.body && typeof request.body === 'object' ? request.body : {}
  const surface = String(body.surface || request.query.surface || 'map')
  const mode = String(body.mode || request.query.mode || 'embedded-analyst')
  const suppliedManifest = body.manifest && typeof body.manifest === 'object' ? body.manifest : {}
  const suppliedKind = String(suppliedManifest.kind || suppliedManifest.type || '').trim()
  const isTwinQueryManifest = suppliedKind === 'twin-query-manifest' || suppliedKind === 'twin-query'
  const manifest = buildViewerSurfaceManifest({
    cityId: access.cityId,
    surface,
    mode,
  })
  const allowedLayers = allowedLayerKeys(manifest)
  const layerKeys = Array.isArray(body.layerKeys)
    ? body.layerKeys.map((key) => String(key ?? '').trim()).filter(Boolean)
    : []
  const invalidLayerKeys = layerKeys.filter((key) => !allowedLayers.has(key))
  if (invalidLayerKeys.length) {
    return {
      ok: false,
      status: 422,
      error: 'SHARE_LAYER_KEYS_OUTSIDE_MANIFEST',
      detail: invalidLayerKeys.join(', '),
    }
  }

  const selection = body.selection && typeof body.selection === 'object' ? { ...body.selection } : {}
  const selectionScope = String(body.selectionScope || selection.scope || '').trim()
  if (selectionScope && !manifestSelectionScopes(manifest).has(selectionScope)) {
    return {
      ok: false,
      status: 422,
      error: 'SHARE_SELECTION_SCOPE_OUTSIDE_MANIFEST',
      detail: selectionScope,
    }
  }
  if (selectionScope) selection.scope = selectionScope

  const accessPolicy = body.accessPolicy || (body.public ? 'public' : 'session')
  const publicationStatus = body.publicationStatus || (body.publish ? 'published' : 'draft')
  const persistedMode = isTwinQueryManifest ? 'twin-query-manifest' : manifest.mode
  const queryManifest = isTwinQueryManifest ? suppliedManifest : null
  return {
    ok: true,
    payload: {
      surface: manifest.surface,
      mode: persistedMode,
      title: body.title,
      description: body.description,
      accessPolicy,
      publicationStatus,
      layerKeys,
      selectionScope,
      selection,
      manifest: {
        ...manifest,
        share: {
          layerKeys,
          selection,
          accessPolicy,
          publicationStatus,
        },
        ...(queryManifest ? { queryManifest } : {}),
      },
      createdBy: actorId(access, request),
      expiresAt: body.expiresAt,
    },
  }
}

async function sendShareManifestList(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const shares = await listCityVisualShareManifests(access.cityId, shareQuery(request))
    response.status(shares.ok ? 200 : 502).json(shareListWithEmbeds(request, shares))
  } catch (error) {
    response.status(502).json({
      error: 'LIVE_SHARE_MANIFESTS_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendShareManifestCreate(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const normalized = normalizeSharePayload(request, access)
    if (!normalized.ok) {
      response.status(normalized.status).json({
        ok: false,
        cityId: access.cityId,
        error: normalized.error,
        detail: normalized.detail,
      })
      return
    }

    const share = await createCityVisualShareManifest(access.cityId, normalized.payload)
    response.status(share.ok ? 201 : 502).json(shareResultWithEmbed(request, share))
  } catch (error) {
    response.status(502).json({
      error: 'LIVE_SHARE_MANIFEST_CREATE_FAILED',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendShareManifestGet(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const share = await getCityVisualShareManifest(access.cityId, request.params.shareKey)
    const status = share.ok ? 200 : share.error === 'SHARE_MANIFEST_NOT_FOUND' ? 404 : 502
    response.status(status).json(shareResultWithEmbed(request, share))
  } catch (error) {
    response.status(502).json({
      error: 'LIVE_SHARE_MANIFEST_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendShareManifestPublish(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const body = request.body && typeof request.body === 'object' ? request.body : {}
    const current = await getCityVisualShareManifest(access.cityId, request.params.shareKey)
    if (!current.ok) {
      const status = current.error === 'SHARE_MANIFEST_NOT_FOUND' ? 404 : 502
      response.status(status).json(current)
      return
    }

    const accessPolicy = body.accessPolicy || body.access_policy || (body.public ? 'public' : 'signed-token')
    const publicationStatus = body.publicationStatus || body.publication_status || (body.retire ? 'retired' : 'published')
    const publicationPreview = shareEmbedContract(request, access.cityId, current.share)
    const updated = await publishCityVisualShareManifest(access.cityId, request.params.shareKey, {
      accessPolicy,
      publicationStatus,
      title: body.title,
      description: body.description,
      expiresAt: body.expiresAt ?? body.expires_at,
      manifestPatch: {
        publication: {
          accessPolicy,
          publicationStatus,
          embed: publicationPreview,
          updatedBy: actorId(access, request),
          updatedAt: new Date().toISOString(),
        },
      },
    })
    const status = updated.ok ? 200 : updated.error === 'SHARE_MANIFEST_NOT_FOUND' ? 404 : 502
    response.status(status).json(shareResultWithEmbed(request, updated))
  } catch (error) {
    response.status(502).json({
      error: 'LIVE_SHARE_MANIFEST_PUBLISH_FAILED',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

export function registerShareManifestRoutes(app, { requireLiveCityAccess }) {
  app.get('/api/live/current/viewer-share-manifests', (request, response) => sendShareManifestList(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/viewer-share-manifests', (request, response) => sendShareManifestList(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.post('/api/live/current/viewer-share-manifests', (request, response) => sendShareManifestCreate(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.post('/api/live/:cityId/viewer-share-manifests', (request, response) => sendShareManifestCreate(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.post('/api/live/current/viewer-share-manifests/:shareKey/publish', (request, response) => sendShareManifestPublish(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.post('/api/live/:cityId/viewer-share-manifests/:shareKey/publish', (request, response) => sendShareManifestPublish(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))

  app.get('/api/live/current/viewer-share-manifests/:shareKey', (request, response) => sendShareManifestGet(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))

  app.get('/api/live/:cityId/viewer-share-manifests/:shareKey', (request, response) => sendShareManifestGet(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))
}
