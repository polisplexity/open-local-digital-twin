import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const DEFAULT_PROVIDER_SCOPES = ['provider:ingest', 'provider:upload', 'provider:read']

function stableHash(value) {
  return createHash('sha256').update(String(value ?? '')).digest('hex')
}

function splitCsv(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left ?? ''))
  const b = Buffer.from(String(right ?? ''))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function parseProviderTokenConfig() {
  const rawJson = String(process.env.TWIN_STUDIO_PROVIDER_API_TOKENS_JSON ?? '').trim()
  if (rawJson) {
    const parsed = JSON.parse(rawJson)
    if (!Array.isArray(parsed)) {
      throw new Error('PROVIDER_API_TOKENS_JSON_MUST_BE_ARRAY')
    }
    return parsed
      .map((item) => ({
        providerId: String(item.providerId ?? item.provider_id ?? item.id ?? '').trim(),
        tokenHash: String(item.tokenHash ?? item.token_hash ?? '').trim(),
        token: String(item.token ?? '').trim(),
        scopes: Array.isArray(item.scopes) ? item.scopes.map((scope) => String(scope).trim()).filter(Boolean) : DEFAULT_PROVIDER_SCOPES,
      }))
      .filter((item) => item.providerId && (item.tokenHash || item.token))
  }

  return splitCsv(process.env.TWIN_STUDIO_PROVIDER_API_TOKENS)
    .map((entry) => {
      const parts = entry.split(':')
      const providerId = parts.shift()
      const token = parts.shift()
      const scopeCsv = parts.join(':')
      return {
        providerId: String(providerId ?? '').trim(),
        token: String(token ?? '').trim(),
        scopes: scopeCsv ? splitCsv(scopeCsv.replaceAll('|', ',')) : DEFAULT_PROVIDER_SCOPES,
      }
    })
    .filter((item) => item.providerId && item.token)
}

function bearerToken(request) {
  const authorization = String(request.headers.authorization ?? '').trim()
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim()
  }
  return String(request.headers['x-twin-provider-token'] ?? '').trim()
}

export function providerApiStatus() {
  try {
    return {
      configured: parseProviderTokenConfig().length > 0,
      tokenCount: parseProviderTokenConfig().length,
      authModes: ['Authorization: Bearer <token>', 'X-Twin-Provider-Token'],
    }
  } catch (error) {
    return {
      configured: false,
      tokenCount: 0,
      error: String(error?.message ?? 'PROVIDER_API_AUTH_CONFIG_INVALID'),
    }
  }
}

export function authenticateProviderApiRequest(request, requiredScopes = []) {
  const token = bearerToken(request)
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: 'PROVIDER_API_TOKEN_REQUIRED',
    }
  }

  let configs
  try {
    configs = parseProviderTokenConfig()
  } catch (error) {
    return {
      ok: false,
      status: 503,
      error: 'PROVIDER_API_AUTH_CONFIG_INVALID',
      detail: String(error?.message ?? 'UNKNOWN_AUTH_CONFIG_ERROR'),
    }
  }

  if (configs.length === 0) {
    return {
      ok: false,
      status: 503,
      error: 'PROVIDER_API_AUTH_NOT_CONFIGURED',
    }
  }

  const incomingHash = stableHash(token)
  const match = configs.find((config) => {
    if (config.tokenHash) return safeEqual(config.tokenHash, incomingHash)
    return safeEqual(stableHash(config.token), incomingHash)
  })

  if (!match) {
    return {
      ok: false,
      status: 401,
      error: 'PROVIDER_API_TOKEN_INVALID',
    }
  }

  const scopes = new Set(match.scopes ?? [])
  const missingScopes = requiredScopes.filter((scope) => !scopes.has(scope) && !scopes.has('provider:*'))
  if (missingScopes.length > 0) {
    return {
      ok: false,
      status: 403,
      error: 'PROVIDER_API_SCOPE_DENIED',
      missingScopes,
    }
  }

  return {
    ok: true,
    provider: {
      id: match.providerId,
      scopes: Array.from(scopes),
    },
  }
}

export function buildProviderUploadIntent({
  providerId,
  cityId,
  layerKey,
  sourceFormat,
  fileName,
  maxBytes,
  baseUrl,
  internalBaseUrl,
}) {
  const uploadId = randomUUID()
  const expiresAt = new Date(Date.now() + Number(process.env.TWIN_STUDIO_UPLOAD_INTENT_TTL_MS ?? 15 * 60_000)).toISOString()
  const resolvedMaxBytes = Math.min(
    Number(maxBytes || process.env.TWIN_STUDIO_PROVIDER_UPLOAD_MAX_BYTES || 250 * 1024 * 1024),
    Number(process.env.TWIN_STUDIO_PROVIDER_UPLOAD_ABSOLUTE_MAX_BYTES || 2 * 1024 * 1024 * 1024),
  )
  const envelope = {
    uploadId,
    providerId,
    cityId,
    layerKey,
    sourceFormat,
    fileName: String(fileName ?? '').trim() || null,
    maxBytes: resolvedMaxBytes,
    expiresAt,
  }
  const secret = String(process.env.TWIN_STUDIO_UPLOAD_SIGNING_SECRET ?? process.env.TWIN_STUDIO_PROVIDER_UPLOAD_SIGNING_SECRET ?? '').trim()
  const signature = secret
    ? createHmac('sha256', secret).update(JSON.stringify(envelope)).digest('hex')
    : null
  const query = new URLSearchParams({
    providerId,
    cityId,
    layerKey,
    sourceFormat,
    expiresAt,
    maxBytes: String(resolvedMaxBytes),
    signature: signature ?? '',
  })
  if (envelope.fileName) query.set('fileName', envelope.fileName)
  const publicBaseUrl = String(baseUrl ?? process.env.TWIN_STUDIO_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '')
  const workerBaseUrl = String(internalBaseUrl ?? process.env.TWIN_STUDIO_INTERNAL_BASE_URL ?? publicBaseUrl).replace(/\/+$/, '')
  const externalUploadBaseUrl = String(process.env.TWIN_STUDIO_UPLOAD_BASE_URL ?? '').replace(/\/+$/, '')
  const externalSourceBaseUrl = String(process.env.TWIN_STUDIO_UPLOAD_SOURCE_BASE_URL ?? externalUploadBaseUrl).replace(/\/+$/, '')
  const localUploadPath = `/api/provider/v1/uploads/${uploadId}`
  const localDownloadPath = `/api/provider/v1/uploads/${uploadId}/source`
  const externalUploadUrl = externalUploadBaseUrl ? `${externalUploadBaseUrl}/${uploadId}` : null
  const externalSourceUri = externalSourceBaseUrl ? `${externalSourceBaseUrl}/${uploadId}` : null

  return {
    ...envelope,
    signature,
    uploadMode: externalUploadUrl ? 'external-signed-url' : 'local-signed-upload',
    uploadUrl: externalUploadUrl ?? `${publicBaseUrl}${localUploadPath}?${query.toString()}`,
    sourceUri: externalSourceUri ?? `${workerBaseUrl}${localDownloadPath}?${query.toString()}`,
    queueEndpoint: `/api/provider/v1/cities/${cityId}/layers/${layerKey}/jobs`,
    requiredJobBody: {
      action: 'package',
      sourceFormat,
      sourceUri: externalSourceUri ?? `${workerBaseUrl}${localDownloadPath}?${query.toString()}`,
      metadata: {
        uploadId,
        signature,
      },
    },
  }
}

export function verifyProviderUploadSignature(params = {}) {
  const uploadId = String(params.uploadId ?? '').trim()
  const providerId = String(params.providerId ?? '').trim()
  const cityId = String(params.cityId ?? '').trim()
  const layerKey = String(params.layerKey ?? '').trim()
  const sourceFormat = String(params.sourceFormat ?? '').trim()
  const fileName = String(params.fileName ?? '').trim() || null
  const maxBytes = Number(params.maxBytes)
  const expiresAt = String(params.expiresAt ?? '').trim()
  const signature = String(params.signature ?? '').trim()
  const secret = String(process.env.TWIN_STUDIO_UPLOAD_SIGNING_SECRET ?? process.env.TWIN_STUDIO_PROVIDER_UPLOAD_SIGNING_SECRET ?? '').trim()

  if (!uploadId || !providerId || !cityId || !layerKey || !sourceFormat || !Number.isFinite(maxBytes) || !expiresAt) {
    return { ok: false, status: 400, error: 'UPLOAD_INTENT_FIELDS_REQUIRED' }
  }
  if (Date.parse(expiresAt) <= Date.now()) {
    return { ok: false, status: 410, error: 'UPLOAD_INTENT_EXPIRED' }
  }
  if (!secret) {
    return { ok: false, status: 503, error: 'UPLOAD_SIGNING_SECRET_NOT_CONFIGURED' }
  }
  const envelope = {
    uploadId,
    providerId,
    cityId,
    layerKey,
    sourceFormat,
    fileName,
    maxBytes,
    expiresAt,
  }
  const expected = createHmac('sha256', secret).update(JSON.stringify(envelope)).digest('hex')
  if (!signature || !safeEqual(signature, expected)) {
    return { ok: false, status: 403, error: 'UPLOAD_SIGNATURE_INVALID' }
  }
  return {
    ok: true,
    intent: envelope,
  }
}
