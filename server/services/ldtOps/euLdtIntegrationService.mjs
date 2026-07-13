import { withClient } from './dbUtils.mjs'
import { queryEdcAssets } from './euLdtDataSpaceReadyService.mjs'

const PLATFORM_KINDS = new Set(['data-platform', 'data-modeller', 'data-space-ready', 'city-innovation-planner', 'use-case-scenarios', 'play-visualise', 'marketplace-agent', 'marketplace-hub', 'oldt-provider', 'other'])
const STATUSES = new Set(['registered', 'validated', 'warning', 'error', 'disabled', 'archived'])
const AUTH_TYPES = new Set(['none', 'headers', 'cookie', 'bearer', 'oauth2-client-credentials'])

function normalizeKey(value, fallback = '') {
  const normalized = String(value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{1,128}$/.test(normalized)) {
    throw new Error('EU_LDT_PROFILE_KEY_INVALID')
  }
  return normalized
}

function stringValue(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function jsonObject(value, fallback = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
  return value
}

function jsonArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback
}

function normalizeUrl(value) {
  const normalized = stringValue(value)
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error('EU_LDT_BASE_URL_INVALID')
  }
  return normalized.replace(/\/+$/, '')
}

function enumValue(value, allowed, fallback, errorCode) {
  const normalized = stringValue(value, fallback)
  if (!allowed.has(normalized)) throw new Error(errorCode)
  return normalized
}

function normalizeAuthConfig(value = {}) {
  const authConfig = jsonObject(value, { type: 'none' })
  const type = enumValue(authConfig.type, AUTH_TYPES, 'none', 'EU_LDT_AUTH_TYPE_INVALID')
  return {
    ...authConfig,
    type,
  }
}

function redactHeaders(headers = []) {
  return jsonArray(headers).map((entry) => ({
    ...entry,
    value: entry?.value ? '***' : '',
  }))
}

function redactAuthConfig(authConfig = {}) {
  const normalized = normalizeAuthConfig(authConfig)
  const publicConfig = { ...normalized }
  for (const key of ['token', 'cookie', 'clientSecret', 'client_secret']) {
    if (publicConfig[key]) publicConfig[`${key}Configured`] = true
    delete publicConfig[key]
  }
  if (Array.isArray(publicConfig.headers)) publicConfig.headers = redactHeaders(publicConfig.headers)
  if (publicConfig.purposes && typeof publicConfig.purposes === 'object' && !Array.isArray(publicConfig.purposes)) {
    publicConfig.purposes = Object.fromEntries(
      Object.entries(publicConfig.purposes).map(([purpose, purposeAuth]) => [purpose, redactAuthConfig(purposeAuth)]),
    )
  }
  return publicConfig
}

function profileFromRow(row = {}, { redactSecrets = false } = {}) {
  return {
    id: row.id,
    profileKey: row.profile_key,
    displayName: row.display_name,
    platformKind: row.platform_kind,
    baseUrl: row.base_url,
    cityId: row.city_id ?? null,
    remoteCityId: row.remote_city_id ?? null,
    status: row.status,
    authConfig: redactSecrets ? redactAuthConfig(row.auth_config) : row.auth_config ?? { type: 'none' },
    headers: redactSecrets ? redactHeaders(row.headers) : row.headers ?? [],
    endpoints: row.endpoints ?? {},
    capabilities: row.capabilities ?? {},
    lastCheck: row.last_check ?? {},
    metadata: row.metadata ?? {},
    registeredBy: row.registered_by ?? null,
    lastCheckedAt: row.last_checked_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function publicProfile(row = {}) {
  return profileFromRow(row, { redactSecrets: true })
}

function normalizeProfilePayload(payload = {}) {
  const displayName = stringValue(payload.displayName ?? payload.display_name ?? payload.name, 'EU LDT integration')
  const profileKey = normalizeKey(payload.profileKey ?? payload.profile_key, displayName)
  const platformKind = enumValue(
    payload.platformKind ?? payload.platform_kind ?? payload.kind,
    PLATFORM_KINDS,
    'other',
    'EU_LDT_PLATFORM_KIND_INVALID',
  )
  const status = enumValue(payload.status, STATUSES, 'registered', 'EU_LDT_STATUS_INVALID')

  return {
    profileKey,
    displayName,
    platformKind,
    baseUrl: normalizeUrl(payload.baseUrl ?? payload.base_url),
    cityId: stringValue(payload.cityId ?? payload.city_id, '') || null,
    remoteCityId: stringValue(payload.remoteCityId ?? payload.remote_city_id, '') || null,
    status,
    authConfig: normalizeAuthConfig(payload.authConfig ?? payload.auth_config),
    headers: jsonArray(payload.headers),
    endpoints: jsonObject(payload.endpoints),
    capabilities: jsonObject(payload.capabilities),
    metadata: jsonObject(payload.metadata),
    registeredBy: stringValue(payload.registeredBy ?? payload.registered_by, '') || null,
  }
}

function headersFromArray(headers = []) {
  return jsonArray(headers).reduce((result, entry) => {
    if (!entry || typeof entry !== 'object') return result
    const key = stringValue(entry.key ?? entry.name)
    const value = stringValue(entry.value)
    if (key && value) result[key] = value
    return result
  }, {})
}

async function authHeaders(profile) {
  const headers = headersFromArray(profile.headers)
  const auth = normalizeAuthConfig(profile.authConfig)

  if (auth.type === 'headers') return { headers: { ...headers, ...headersFromArray(auth.headers) }, errors: [] }
  if (auth.type === 'cookie') {
    const cookie = stringValue(auth.cookie)
    return {
      headers: cookie ? { ...headers, Cookie: cookie } : headers,
      errors: cookie ? [] : ['EU_LDT_AUTH_COOKIE_MISSING'],
    }
  }
  if (auth.type === 'bearer') {
    const token = stringValue(auth.token)
    return {
      headers: token ? { ...headers, Authorization: `Bearer ${token}` } : headers,
      errors: token ? [] : ['EU_LDT_AUTH_BEARER_TOKEN_MISSING'],
    }
  }
  if (auth.type === 'oauth2-client-credentials') {
    const tokenUrl = stringValue(auth.tokenUrl ?? auth.token_url)
    const clientId = stringValue(auth.clientId ?? auth.client_id)
    const clientSecret = stringValue(auth.clientSecret ?? auth.client_secret)
    if (!tokenUrl || !clientId || !clientSecret) {
      return { headers, errors: ['EU_LDT_OAUTH2_CLIENT_CREDENTIALS_INCOMPLETE'] }
    }
    try {
      const body = new URLSearchParams()
      body.set('grant_type', 'client_credentials')
      body.set('client_id', clientId)
      body.set('client_secret', clientSecret)
      if (auth.scope) body.set('scope', String(auth.scope))
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(Number(auth.timeoutMs ?? 10000)),
      })
      if (!response.ok) {
        return { headers, errors: [`EU_LDT_OAUTH2_TOKEN_HTTP_${response.status}`] }
      }
      const tokenPayload = await response.json()
      const token = stringValue(tokenPayload.access_token)
      return {
        headers: token ? { ...headers, Authorization: `Bearer ${token}` } : headers,
        errors: token ? [] : ['EU_LDT_OAUTH2_ACCESS_TOKEN_MISSING'],
      }
    } catch (error) {
      return { headers, errors: [`EU_LDT_OAUTH2_TOKEN_ERROR:${String(error?.message ?? error)}`] }
    }
  }

  return { headers, errors: [] }
}

function endpointUrl(profile, key, fallbackPath = '') {
  const endpoint = stringValue(profile.endpoints?.[key])
  if (/^https?:\/\//i.test(endpoint)) return endpoint
  const base = normalizeUrl(profile.baseUrl)
  const path = endpoint || fallbackPath
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

export async function resolveEuLdtIntegrationTarget(client, profileKey, options = {}) {
  const normalizedProfileKey = normalizeKey(profileKey)
  const expectedPlatformKind = stringValue(options.platformKind ?? options.platform_kind)
  const result = await client.query(`
    SELECT *
    FROM ldt_interop.eu_ldt_integration_profiles
    WHERE profile_key = $1
  `, [normalizedProfileKey])
  if (result.rowCount === 0) throw new Error('EU_LDT_PROFILE_NOT_FOUND')

  const privateProfile = profileFromRow(result.rows[0])
  if (expectedPlatformKind && privateProfile.platformKind !== expectedPlatformKind) {
    throw new Error(`EU_LDT_PROFILE_KIND_MISMATCH:${privateProfile.platformKind}`)
  }
  if (['disabled', 'archived'].includes(privateProfile.status)) {
    throw new Error(`EU_LDT_PROFILE_NOT_ACTIVE:${privateProfile.status}`)
  }

  const auth = await authHeaders(privateProfile)
  if (auth.errors.length > 0) throw new Error(`EU_LDT_PROFILE_AUTH_FAILED:${auth.errors.join(',')}`)

  const requestedPurposes = Array.isArray(options.authPurposes ?? options.auth_purposes)
    ? (options.authPurposes ?? options.auth_purposes)
    : []
  const purposeHeaders = {}
  for (const purposeValue of requestedPurposes) {
    const purpose = stringValue(purposeValue)
    if (!purpose) continue
    const purposeAuth = privateProfile.authConfig?.purposes?.[purpose]
    if (!purposeAuth) throw new Error(`EU_LDT_PROFILE_AUTH_PURPOSE_MISSING:${purpose}`)
    const purposeResult = await authHeaders({
      ...privateProfile,
      authConfig: purposeAuth,
    })
    if (purposeResult.errors.length > 0) {
      throw new Error(`EU_LDT_PROFILE_AUTH_PURPOSE_FAILED:${purpose}:${purposeResult.errors.join(',')}`)
    }
    purposeHeaders[purpose] = purposeResult.headers
  }

  return {
    profile: publicProfile(result.rows[0]),
    profileKey: privateProfile.profileKey,
    displayName: privateProfile.displayName,
    platformKind: privateProfile.platformKind,
    endpoint: endpointUrl(privateProfile, options.endpointKey ?? 'backendApiUrl', ''),
    headers: auth.headers,
    purposeHeaders,
  }
}

async function fetchCheck(url, headers = {}, expectedStatuses = [200], timeoutMs = 10000) {
  const startedAt = new Date()
  try {
    const response = await fetch(url, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })
    const contentType = response.headers.get('content-type') ?? ''
    const text = await response.text()
    return {
      ok: expectedStatuses.includes(response.status),
      url,
      status: response.status,
      contentType,
      byteLength: Buffer.byteLength(text),
      sample: text.slice(0, 300),
      checkedAt: startedAt.toISOString(),
    }
  } catch (error) {
    return {
      ok: false,
      url,
      status: null,
      contentType: '',
      byteLength: 0,
      error: String(error?.message ?? error),
      checkedAt: startedAt.toISOString(),
    }
  }
}

async function testDataPlatform(profile, headers) {
  const checks = []
  checks.push(await fetchCheck(endpointUrl(profile, 'backendDocsUrl', '/docs'), headers, [200, 301, 302]))
  if (profile.endpoints?.contextBrokerUrl) {
    checks.push(await fetchCheck(profile.endpoints.contextBrokerUrl, headers, [200, 404, 405]))
  }
  if (profile.endpoints?.dataQueryUrl) {
    checks.push(await fetchCheck(profile.endpoints.dataQueryUrl, headers, [200]))
  }
  return checks
}

async function testDataModeller(profile, headers) {
  const checks = []
  const health = await fetchCheck(endpointUrl(profile, 'healthUrl', '/api/v1/health'), headers, [200])
  if (health.ok && health.sample) {
    try {
      const body = JSON.parse(health.sample)
      const serviceStatus = stringValue(body?.status).toLowerCase()
      health.serviceStatus = serviceStatus || null
      health.ok = ['healthy', 'ok', 'up', 'ready'].includes(serviceStatus)
      if (!health.ok) health.error = `DATA_MODELLER_HEALTH_STATUS:${serviceStatus || 'missing'}`
    } catch {
      health.ok = false
      health.error = 'DATA_MODELLER_HEALTH_BODY_INVALID'
    }
  }
  checks.push(health)
  checks.push(await fetchCheck(endpointUrl(profile, 'openApiUrl', '/documentation/json'), headers, [200]))
  if (profile.endpoints?.frontendUrl) {
    checks.push(await fetchCheck(profile.endpoints.frontendUrl, headers, [200, 301, 302]))
  }
  return checks
}

async function testDataSpaceReady(profile, headers) {
  const checks = []
  checks.push(await fetchCheck(endpointUrl(profile, 'healthUrl', '/health'), headers, [200]))
  checks.push(await fetchCheck(endpointUrl(profile, 'readinessUrl', '/health/readiness'), headers, [200]))
  const managementEndpoint = endpointUrl(profile, 'managementUrl')
  const startedAt = new Date().toISOString()
  try {
    const result = await queryEdcAssets({ endpoint: managementEndpoint, headers, limit: 1 })
    checks.push({
      ok: true,
      url: `${managementEndpoint}/assets/request`,
      status: result.status,
      contentType: result.headers?.['content-type'] ?? 'application/json',
      byteLength: Buffer.byteLength(JSON.stringify(result.body ?? null)),
      assetCount: Array.isArray(result.body) ? result.body.length : null,
      checkedAt: startedAt,
    })
  } catch (error) {
    checks.push({
      ok: false,
      url: `${managementEndpoint}/assets/request`,
      status: error?.status ?? null,
      contentType: '',
      byteLength: 0,
      error: String(error?.message ?? error),
      checkedAt: startedAt,
    })
  }
  return checks
}

async function testCityInnovationPlanner(profile, headers) {
  const checks = []
  const health = await fetchCheck(endpointUrl(profile, 'healthUrl', '/api/v1/health'), headers, [200])
  if (health.ok && health.sample) {
    try {
      const body = JSON.parse(health.sample)
      const serviceStatus = stringValue(body?.status).toLowerCase()
      health.serviceStatus = serviceStatus || null
      health.ok = ['healthy', 'ok', 'up', 'ready'].includes(serviceStatus)
      if (!health.ok) health.error = `CIP_HEALTH_STATUS:${serviceStatus || 'missing'}`
    } catch {
      health.ok = false
      health.error = 'CIP_HEALTH_BODY_INVALID'
    }
  }
  checks.push(health)
  checks.push(await fetchCheck(endpointUrl(profile, 'openApiUrl', '/documentation/json'), headers, [200]))
  checks.push(await fetchCheck(endpointUrl(profile, 'kpisUrl', '/api/v1/kpis?page=0&size=1'), headers, [200]))
  checks.push(await fetchCheck(endpointUrl(profile, 'initiativesUrl', '/api/v1/initiatives?page=0&size=1'), headers, [200]))
  return checks
}

async function testUseCaseScenarios(profile, headers) {
  const checks = []
  const health = await fetchCheck(endpointUrl(profile, 'healthUrl', '/api/v1/health'), headers, [200])
  if (health.ok && health.sample) {
    const statusMatch = health.sample.match(/"status"\s*:\s*"([^"]+)"/i)
    const serviceStatus = stringValue(statusMatch?.[1]).toLowerCase()
    health.serviceStatus = serviceStatus || null
    health.ok = ['healthy', 'ok', 'up', 'ready'].includes(serviceStatus)
    if (!health.ok) health.error = `UCS_HEALTH_STATUS:${serviceStatus || 'missing'}`
  }
  checks.push(health)
  checks.push(await fetchCheck(endpointUrl(profile, 'openApiUrl', '/documentation/json'), headers, [200]))
  const casesUrl = endpointUrl(profile, 'casesUrl', '/api/v1/cases')
  checks.push(await fetchCheck(`${casesUrl}${casesUrl.includes('?') ? '&' : '?'}page=0&size=1`, headers, [200]))
  checks.push(await fetchCheck(endpointUrl(profile, 'dataPlatformScopesUrl', '/api/v1/data-platform/scopes'), headers, [200]))
  checks.push(await fetchCheck(
    endpointUrl(profile, 'aiNamespacesUrl', '/api/v1/ai-notebook/namespaces'),
    headers,
    [200],
    30000,
  ))
  return checks
}

async function testPlayVisualise(profile, headers) {
  const checks = []
  checks.push(await fetchCheck(endpointUrl(profile, 'apiDocsUrl', '/docs'), headers, [200, 301, 302]))
  if (profile.endpoints?.frontendUrl) {
    checks.push(await fetchCheck(profile.endpoints.frontendUrl, headers, [200]))
  }
  return checks
}

async function testMarketplaceAgent(profile, headers) {
  const checks = []
  checks.push(await fetchCheck(endpointUrl(profile, 'livezUrl', '/api/v1/agent/livez'), headers, [200]))
  checks.push(await fetchCheck(endpointUrl(profile, 'metadataAssetsUrl', '/api/v1/agent/metadata/assets'), headers, [200, 401, 403]))
  return checks
}

async function testMarketplaceHub(profile, headers) {
  const checks = []
  checks.push(await fetchCheck(endpointUrl(profile, 'hubUrl', '/'), headers, [200, 301, 302]))
  if (profile.endpoints?.apiUrl) {
    checks.push(await fetchCheck(profile.endpoints.apiUrl, headers, [200, 301, 302, 401, 403]))
  }
  return checks
}

async function testOldtProvider(profile, headers) {
  const checks = []
  checks.push(await fetchCheck(endpointUrl(profile, 'ogcCollectionsUrl', '/api/live/current/standards/ogc/collections'), headers, [200]))
  checks.push(await fetchCheck(endpointUrl(profile, 'ngsiLdEntitiesUrl', '/api/live/current/standards/ngsi-ld/entities?limit=1'), headers, [200]))
  return checks
}

async function runProfileChecks(profile) {
  const auth = await authHeaders(profile)
  let checks = []
  if (profile.platformKind === 'data-platform') checks = await testDataPlatform(profile, auth.headers)
  else if (profile.platformKind === 'data-modeller') checks = await testDataModeller(profile, auth.headers)
  else if (profile.platformKind === 'data-space-ready') checks = await testDataSpaceReady(profile, auth.headers)
  else if (profile.platformKind === 'city-innovation-planner') checks = await testCityInnovationPlanner(profile, auth.headers)
  else if (profile.platformKind === 'use-case-scenarios') checks = await testUseCaseScenarios(profile, auth.headers)
  else if (profile.platformKind === 'play-visualise') checks = await testPlayVisualise(profile, auth.headers)
  else if (profile.platformKind === 'marketplace-agent') checks = await testMarketplaceAgent(profile, auth.headers)
  else if (profile.platformKind === 'marketplace-hub') checks = await testMarketplaceHub(profile, auth.headers)
  else if (profile.platformKind === 'oldt-provider') checks = await testOldtProvider(profile, auth.headers)
  else checks = [await fetchCheck(profile.baseUrl, auth.headers, [200, 301, 302])]

  const failed = checks.filter((check) => !check.ok)
  const status = auth.errors.length > 0 || failed.length === checks.length
    ? 'error'
    : failed.length > 0
      ? 'warning'
      : 'validated'
  return {
    ok: status === 'validated',
    status,
    authErrors: auth.errors,
    checks,
    checkedAt: new Date().toISOString(),
  }
}

export async function listEuLdtIntegrationProfiles(filters = {}) {
  return withClient(async (client) => {
    const conditions = []
    const params = []
    if (filters.platformKind ?? filters.platform_kind) {
      params.push(String(filters.platformKind ?? filters.platform_kind))
      conditions.push(`platform_kind = $${params.length}`)
    }
    if (filters.status) {
      params.push(String(filters.status))
      conditions.push(`status = $${params.length}`)
    }
    if (filters.cityId ?? filters.city_id) {
      params.push(String(filters.cityId ?? filters.city_id))
      conditions.push(`city_id = $${params.length}`)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await client.query(`
      SELECT *
      FROM ldt_interop.eu_ldt_integration_profiles
      ${where}
      ORDER BY platform_kind, profile_key
    `, params)
    return {
      ok: true,
      profiles: result.rows.map(publicProfile),
    }
  })
}

export async function getEuLdtIntegrationProfile(profileKey) {
  return withClient(async (client) => {
    const result = await client.query(`
      SELECT *
      FROM ldt_interop.eu_ldt_integration_profiles
      WHERE profile_key = $1
    `, [normalizeKey(profileKey)])
    if (result.rowCount === 0) return { ok: false, error: 'EU_LDT_PROFILE_NOT_FOUND' }
    return { ok: true, profile: publicProfile(result.rows[0]) }
  })
}

export async function upsertEuLdtIntegrationProfile(payload = {}) {
  const profile = normalizeProfilePayload(payload)
  return withClient(async (client) => {
    const result = await client.query(`
      INSERT INTO ldt_interop.eu_ldt_integration_profiles (
        profile_key,
        display_name,
        platform_kind,
        base_url,
        city_id,
        remote_city_id,
        status,
        auth_config,
        headers,
        endpoints,
        capabilities,
        metadata,
        registered_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13)
      ON CONFLICT (profile_key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        platform_kind = EXCLUDED.platform_kind,
        base_url = EXCLUDED.base_url,
        city_id = EXCLUDED.city_id,
        remote_city_id = EXCLUDED.remote_city_id,
        status = EXCLUDED.status,
        auth_config = EXCLUDED.auth_config,
        headers = EXCLUDED.headers,
        endpoints = EXCLUDED.endpoints,
        capabilities = EXCLUDED.capabilities,
        metadata = EXCLUDED.metadata,
        registered_by = COALESCE(EXCLUDED.registered_by, ldt_interop.eu_ldt_integration_profiles.registered_by),
        updated_at = now()
      RETURNING *
    `, [
      profile.profileKey,
      profile.displayName,
      profile.platformKind,
      profile.baseUrl,
      profile.cityId,
      profile.remoteCityId,
      profile.status,
      JSON.stringify(profile.authConfig),
      JSON.stringify(profile.headers),
      JSON.stringify(profile.endpoints),
      JSON.stringify(profile.capabilities),
      JSON.stringify(profile.metadata),
      profile.registeredBy,
    ])
    return {
      ok: true,
      profile: publicProfile(result.rows[0]),
    }
  })
}

export async function testEuLdtIntegrationProfile(profileKey) {
  return withClient(async (client) => {
    const profileResult = await client.query(`
      SELECT *
      FROM ldt_interop.eu_ldt_integration_profiles
      WHERE profile_key = $1
    `, [normalizeKey(profileKey)])
    if (profileResult.rowCount === 0) return { ok: false, error: 'EU_LDT_PROFILE_NOT_FOUND' }

    const profile = profileFromRow(profileResult.rows[0])
    const lastCheck = await runProfileChecks(profile)
    const updated = await client.query(`
      UPDATE ldt_interop.eu_ldt_integration_profiles
      SET status = $2,
          last_check = $3::jsonb,
          last_checked_at = now(),
          updated_at = now()
      WHERE profile_key = $1
      RETURNING *
    `, [
      profile.profileKey,
      lastCheck.status,
      JSON.stringify(lastCheck),
    ])
    return {
      ok: lastCheck.ok,
      profile: publicProfile(updated.rows[0]),
      result: lastCheck,
    }
  })
}
