import crypto from 'node:crypto'
import { getCityRegistry } from './cityRegistry.mjs'

const DEFAULT_SCOPES = ['openid', 'profile', 'email']
const DEFAULT_ROLE_CLAIM_PATHS = ['realm_access.roles', 'roles']
const DEFAULT_CITY_CLAIM_PATHS = ['municipalities', 'municipality', 'cities', 'city', 'tenant', 'groups']
const DEFAULT_PROFILE_KEY = 'default'
const DISCOVERY_CACHE = new Map()
const JWKS_CACHE = new Map()

function stringValue(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function boolValue(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}

function jsonObject(value, fallback = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
  return value
}

function jsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    return value.split(/[,\s]+/).map((entry) => entry.trim()).filter(Boolean)
  }
  return fallback
}

function normalizeProviderKey(value, fallback = DEFAULT_PROFILE_KEY) {
  const normalized = stringValue(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(normalized)) throw new Error('OIDC_PROVIDER_KEY_INVALID')
  return normalized
}

function normalizeUrl(value) {
  const normalized = stringValue(value).replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(normalized)) throw new Error('OIDC_PROVIDER_URL_INVALID')
  return normalized
}

function parseJsonEnv(name, fallback) {
  const raw = process.env[name]
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`${name}_JSON_INVALID`)
  }
}

function normalizeProfile(raw = {}) {
  const issuerUrl = normalizeUrl(raw.issuerUrl ?? raw.issuer_url ?? raw.issuer)
  const clientId = stringValue(raw.clientId ?? raw.client_id)
  if (!clientId) throw new Error('OIDC_CLIENT_ID_REQUIRED')
  return {
    key: normalizeProviderKey(raw.key ?? raw.profileKey ?? raw.profile_key ?? raw.name),
    name: stringValue(raw.name ?? raw.displayName ?? raw.display_name, raw.key ?? clientId),
    type: 'oidc',
    enabled: raw.enabled !== false,
    issuerUrl,
    clientId,
    clientSecret: stringValue(raw.clientSecret ?? raw.client_secret),
    scopes: jsonArray(raw.scopes, DEFAULT_SCOPES),
    redirectUri: stringValue(raw.redirectUri ?? raw.redirect_uri),
    postLogoutRedirectUri: stringValue(raw.postLogoutRedirectUri ?? raw.post_logout_redirect_uri),
    tokenEndpointAuthMethod: stringValue(
      raw.tokenEndpointAuthMethod ?? raw.token_endpoint_auth_method,
      raw.clientSecret || raw.client_secret ? 'client_secret_post' : 'none',
    ),
    claimMapping: jsonObject(raw.claimMapping ?? raw.claim_mapping, {}),
    roleMapping: jsonObject(raw.roleMapping ?? raw.role_mapping, {}),
    cityMapping: jsonObject(raw.cityMapping ?? raw.city_mapping, {}),
    defaultRole: stringValue(raw.defaultRole ?? raw.default_role, 'municipal-reviewer'),
    defaultCityId: stringValue(raw.defaultCityId ?? raw.default_city_id),
    metadata: jsonObject(raw.metadata, {}),
  }
}

function envDefaultProfile() {
  if (!boolValue(process.env.OIDC_ENABLED, false)) return null
  return normalizeProfile({
    key: process.env.OIDC_PROVIDER_KEY || DEFAULT_PROFILE_KEY,
    name: process.env.OIDC_PROVIDER_NAME || 'External identity provider',
    issuerUrl: process.env.OIDC_ISSUER_URL,
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    scopes: process.env.OIDC_SCOPES || DEFAULT_SCOPES,
    redirectUri: process.env.OIDC_REDIRECT_URI,
    postLogoutRedirectUri: process.env.OIDC_POST_LOGOUT_REDIRECT_URI,
    tokenEndpointAuthMethod: process.env.OIDC_TOKEN_ENDPOINT_AUTH_METHOD,
    claimMapping: parseJsonEnv('OIDC_CLAIM_MAPPING', {}),
    roleMapping: parseJsonEnv('OIDC_ROLE_MAPPING', {}),
    cityMapping: parseJsonEnv('OIDC_CITY_MAPPING', {}),
    defaultRole: process.env.OIDC_DEFAULT_ROLE,
    defaultCityId: process.env.OIDC_DEFAULT_CITY_ID,
  })
}

export function listOidcIdentityProviderProfiles() {
  const configured = parseJsonEnv('OIDC_PROVIDER_PROFILES', null)
  const profiles = []
  if (Array.isArray(configured)) profiles.push(...configured.map(normalizeProfile))
  else if (configured && typeof configured === 'object') profiles.push(...Object.values(configured).map(normalizeProfile))
  const defaultProfile = envDefaultProfile()
  if (defaultProfile) profiles.push(defaultProfile)
  const seen = new Set()
  return profiles.filter((profile) => {
    if (!profile.enabled || seen.has(profile.key)) return false
    seen.add(profile.key)
    return true
  })
}

export function publicOidcIdentityProviderProfile(profile) {
  return {
    key: profile.key,
    name: profile.name,
    type: profile.type,
    enabled: profile.enabled,
    issuerUrl: profile.issuerUrl,
    clientId: profile.clientId,
    scopes: profile.scopes,
    redirectUri: profile.redirectUri,
    postLogoutRedirectUri: profile.postLogoutRedirectUri,
    tokenEndpointAuthMethod: profile.tokenEndpointAuthMethod,
    claimMapping: profile.claimMapping,
    roleMapping: profile.roleMapping,
    cityMapping: profile.cityMapping,
    defaultRole: profile.defaultRole,
    defaultCityId: profile.defaultCityId,
    metadata: profile.metadata,
  }
}

export function getOidcIdentityProviderProfile(providerKey = DEFAULT_PROFILE_KEY) {
  const normalizedKey = normalizeProviderKey(providerKey)
  const profile = listOidcIdentityProviderProfiles().find((entry) => entry.key === normalizedKey)
  if (!profile) throw new Error('OIDC_PROVIDER_NOT_CONFIGURED')
  return profile
}

export async function discoverOidcProvider(profile) {
  const cached = DISCOVERY_CACHE.get(profile.issuerUrl)
  if (cached) return cached
  const response = await fetch(`${profile.issuerUrl}/.well-known/openid-configuration`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`OIDC_DISCOVERY_HTTP_${response.status}`)
  const discovery = await response.json()
  if (discovery.issuer !== profile.issuerUrl) throw new Error('OIDC_ISSUER_MISMATCH')
  for (const key of ['authorization_endpoint', 'token_endpoint', 'jwks_uri']) {
    if (!discovery[key]) throw new Error(`OIDC_DISCOVERY_${key.toUpperCase()}_MISSING`)
  }
  DISCOVERY_CACHE.set(profile.issuerUrl, discovery)
  return discovery
}

function requestBaseUrl(request) {
  const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const protocol = forwardedProto || (request.secure ? 'https' : 'http')
  return `${protocol}://${request.get('host')}`
}

export function defaultRedirectUri(request, providerKey) {
  return `${requestBaseUrl(request)}/api/auth/oidc/${encodeURIComponent(providerKey)}/callback`
}

export async function buildOidcAuthorizationRedirect({ profile, request, state, nonce, next = '/' }) {
  const discovery = await discoverOidcProvider(profile)
  const redirectUri = profile.redirectUri || defaultRedirectUri(request, profile.key)
  const url = new URL(discovery.authorization_endpoint)
  url.searchParams.set('client_id', profile.clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', profile.scopes.join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('nonce', nonce)
  if (next) url.searchParams.set('next', next)
  return {
    url: url.toString(),
    redirectUri,
  }
}

export async function buildOidcLogoutRedirect({ profile, request }) {
  const discovery = await discoverOidcProvider(profile)
  const postLogoutRedirectUri = profile.postLogoutRedirectUri || `${requestBaseUrl(request)}/auth/login`
  if (!discovery.end_session_endpoint) {
    return {
      url: postLogoutRedirectUri,
      postLogoutRedirectUri,
      federated: false,
    }
  }
  const url = new URL(discovery.end_session_endpoint)
  url.searchParams.set('client_id', profile.clientId)
  url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri)
  return {
    url: url.toString(),
    postLogoutRedirectUri,
    federated: true,
  }
}

function base64UrlJson(value) {
  return JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'))
}

function getByPath(object, path) {
  if (!path) return undefined
  return String(path).split('.').reduce((current, key) => {
    if (current == null) return undefined
    return current[key]
  }, object)
}

function valuesFromClaimPaths(claims, paths = []) {
  const values = []
  for (const path of paths) {
    const value = getByPath(claims, path)
    if (Array.isArray(value)) values.push(...value)
    else if (value != null) values.push(value)
  }
  return values.map((entry) => String(entry ?? '').trim()).filter(Boolean)
}

function mapRoles(externalRoles, profile) {
  const hasExplicitMapping = Object.keys(profile.roleMapping ?? {}).length > 0
  const mapped = externalRoles
    .map((role) => {
      if (profile.roleMapping[role]) return profile.roleMapping[role]
      return hasExplicitMapping ? null : role
    })
    .flatMap((role) => jsonArray(role, [role]))
    .map((role) => String(role ?? '').trim())
    .filter(Boolean)
  return Array.from(new Set(mapped.length ? mapped : [profile.defaultRole]))
}

function normalizeCityClaim(value) {
  return String(value ?? '')
    .trim()
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .at(-1)
    ?.toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-') ?? ''
}

function mapCities(externalCities, profile) {
  const registry = getCityRegistry()
  const available = new Set(registry.cities.filter((entry) => entry.enabled !== false).map((entry) => entry.id))
  const candidates = externalCities
    .map((city) => profile.cityMapping[city] ?? profile.cityMapping[normalizeCityClaim(city)] ?? normalizeCityClaim(city))
    .flatMap((city) => jsonArray(city, [city]))
    .map((city) => String(city ?? '').trim())
    .filter(Boolean)
  if (profile.defaultCityId) candidates.push(profile.defaultCityId)
  if (registry.activeCityId) candidates.push(registry.activeCityId)
  return Array.from(new Set(candidates.filter((city) => available.has(city))))
}

export function extractOldtIdentityFromClaims(claims, profile) {
  const mapping = profile.claimMapping ?? {}
  const email = stringValue(getByPath(claims, mapping.email ?? 'email') ?? claims.preferred_username)
  const fullName = stringValue(
    getByPath(claims, mapping.name ?? 'name') ??
    [claims.given_name, claims.family_name].filter(Boolean).join(' ') ??
    email,
    email,
  )
  const rolePaths = [
    ...jsonArray(mapping.roles, []),
    ...DEFAULT_ROLE_CLAIM_PATHS,
    `resource_access.${profile.clientId}.roles`,
  ]
  const cityPaths = [...jsonArray(mapping.cities, []), ...DEFAULT_CITY_CLAIM_PATHS]
  const roles = mapRoles(valuesFromClaimPaths(claims, rolePaths), profile)
  const allowedCityIds = mapCities(valuesFromClaimPaths(claims, cityPaths), profile)
  return {
    providerKey: profile.key,
    subject: stringValue(claims.sub),
    email,
    fullName,
    roles,
    primaryCityId: allowedCityIds[0] ?? profile.defaultCityId,
    allowedCityIds,
    rawClaims: claims,
  }
}

async function jwksForUri(jwksUri) {
  const cached = JWKS_CACHE.get(jwksUri)
  if (cached) return cached
  const response = await fetch(jwksUri, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`OIDC_JWKS_HTTP_${response.status}`)
  const jwks = await response.json()
  JWKS_CACHE.set(jwksUri, jwks)
  return jwks
}

async function jwkForHeader(jwksUri, header) {
  let jwks = await jwksForUri(jwksUri)
  if (header.kid) {
    let jwk = jwks.keys?.find((entry) => entry.kid === header.kid)
    if (!jwk) {
      JWKS_CACHE.delete(jwksUri)
      jwks = await jwksForUri(jwksUri)
      jwk = jwks.keys?.find((entry) => entry.kid === header.kid)
    }
    if (!jwk) throw new Error('OIDC_JWK_NOT_FOUND')
    return jwk
  }
  if ((jwks.keys?.length ?? 0) !== 1) throw new Error('OIDC_JWT_KID_REQUIRED')
  return jwks.keys[0]
}

function verifyJwtSignature(token, header, jwk) {
  const [encodedHeader, encodedPayload, encodedSignature] = String(token).split('.')
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error('OIDC_JWT_INVALID')
  if (header.alg !== 'RS256') throw new Error(`OIDC_JWT_ALG_UNSUPPORTED:${header.alg}`)
  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(`${encodedHeader}.${encodedPayload}`)
  verifier.end()
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' })
  if (!verifier.verify(key, Buffer.from(encodedSignature, 'base64url'))) {
    throw new Error('OIDC_JWT_SIGNATURE_INVALID')
  }
}

export async function verifyOidcJwt(token, profile, {
  expectedNonce,
  allowAuthorizedPartyAudience = false,
  clockToleranceSeconds = 60,
} = {}) {
  const [encodedHeader, encodedPayload] = String(token).split('.')
  if (!encodedHeader || !encodedPayload) throw new Error('OIDC_JWT_INVALID')
  const header = base64UrlJson(encodedHeader)
  const claims = base64UrlJson(encodedPayload)
  const discovery = await discoverOidcProvider(profile)
  const jwk = await jwkForHeader(discovery.jwks_uri, header)
  verifyJwtSignature(token, header, jwk)
  if (claims.iss !== profile.issuerUrl) throw new Error('OIDC_TOKEN_ISSUER_INVALID')
  const now = Math.floor(Date.now() / 1000)
  const tolerance = Math.max(0, Number(clockToleranceSeconds) || 0)
  if (Number(claims.exp ?? 0) <= now - tolerance) throw new Error('OIDC_TOKEN_EXPIRED')
  if (claims.nbf != null && Number(claims.nbf) > now + tolerance) throw new Error('OIDC_TOKEN_NOT_ACTIVE')
  if (claims.iat != null && Number(claims.iat) > now + tolerance) throw new Error('OIDC_TOKEN_ISSUED_IN_FUTURE')
  if (!stringValue(claims.sub)) throw new Error('OIDC_TOKEN_SUBJECT_MISSING')
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud].filter(Boolean)
  const audienceMatches = audiences.includes(profile.clientId)
  const authorizedPartyMatches = claims.azp === profile.clientId
  if (!audienceMatches && !(allowAuthorizedPartyAudience && authorizedPartyMatches)) {
    throw new Error('OIDC_TOKEN_AUDIENCE_INVALID')
  }
  if (audienceMatches && claims.azp && !authorizedPartyMatches) throw new Error('OIDC_TOKEN_AUTHORIZED_PARTY_INVALID')
  if (audiences.length > 1 && !authorizedPartyMatches) throw new Error('OIDC_TOKEN_AUTHORIZED_PARTY_REQUIRED')
  if (expectedNonce && claims.nonce !== expectedNonce) throw new Error('OIDC_TOKEN_NONCE_INVALID')
  return claims
}

export async function exchangeOidcCodeForIdentity({ profile, request, code, expectedNonce }) {
  const discovery = await discoverOidcProvider(profile)
  const redirectUri = profile.redirectUri || defaultRedirectUri(request, profile.key)
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('client_id', profile.clientId)
  body.set('code', code)
  body.set('redirect_uri', redirectUri)
  if (profile.clientSecret && profile.tokenEndpointAuthMethod !== 'none') {
    body.set('client_secret', profile.clientSecret)
  }
  const response = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`OIDC_TOKEN_HTTP_${response.status}`)
  const tokens = await response.json()
  if (!tokens.id_token) throw new Error('OIDC_ID_TOKEN_MISSING')
  const idClaims = await verifyOidcJwt(tokens.id_token, profile, { expectedNonce })
  const accessClaims = tokens.access_token
    ? await verifyOidcJwt(tokens.access_token, profile, { allowAuthorizedPartyAudience: true })
    : {}
  const claims = {
    ...accessClaims,
    ...idClaims,
    realm_access: accessClaims.realm_access ?? idClaims.realm_access,
    resource_access: accessClaims.resource_access ?? idClaims.resource_access,
    groups: accessClaims.groups ?? idClaims.groups,
  }
  return {
    tokens,
    claims,
    identity: extractOldtIdentityFromClaims(claims, profile),
  }
}

export async function testOidcIdentityProviderProfile(providerKey = DEFAULT_PROFILE_KEY) {
  const profile = getOidcIdentityProviderProfile(providerKey)
  const discovery = await discoverOidcProvider(profile)
  const jwks = await jwksForUri(discovery.jwks_uri)
  return {
    ok: true,
    profile: publicOidcIdentityProviderProfile(profile),
    discovery: {
      issuer: discovery.issuer,
      authorizationEndpoint: discovery.authorization_endpoint,
      tokenEndpoint: discovery.token_endpoint,
      jwksUri: discovery.jwks_uri,
    },
    jwks: {
      keyCount: jwks.keys?.length ?? 0,
      algorithms: Array.from(new Set((jwks.keys ?? []).map((entry) => entry.alg).filter(Boolean))),
    },
    checkedAt: new Date().toISOString(),
  }
}
