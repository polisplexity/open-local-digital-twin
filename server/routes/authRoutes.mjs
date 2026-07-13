import crypto from 'node:crypto'
import { shouldUseSecureCookies } from '../http/cookies.mjs'
import { requireRateLimit } from '../http/rateLimit.mjs'
import {
  activateUserFromToken,
  clearAuthCookie,
  createExternalIdentitySession,
  createLoginSession,
  createSignupRequest,
  destroyRequestSession,
  getPlatformAuthContext,
  requestPasswordReset,
  resetPasswordFromToken,
  setAuthCookie,
} from '../services/authService.mjs'
import {
  buildOidcAuthorizationRedirect,
  buildOidcLogoutRedirect,
  exchangeOidcCodeForIdentity,
  getOidcIdentityProviderProfile,
  listOidcIdentityProviderProfiles,
  publicOidcIdentityProviderProfile,
  testOidcIdentityProviderProfile,
} from '../services/oidcIdentityProviderService.mjs'

const DEFAULT_DEV_EMAIL = 'smoke@polisplexity.test'
const DEFAULT_DEV_PASSWORD = 'local-smoke-password-change-me'
const DEFAULT_DEV_CITY_ID = 'guanajuato'
const OIDC_STATE_COOKIE_PREFIX = 'oldt_oidc_state_'
const OIDC_STATE_TTL_MS = 1000 * 60 * 10

function normalizeHost(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(':')[0]
}

function isLoopbackHost(value = '') {
  const host = normalizeHost(value)
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

function isDevLoginDefaultsAllowed(request) {
  if (process.env.TWIN_STUDIO_DEV_LOGIN_DEFAULTS === '0') return false
  if (process.env.TWIN_STUDIO_DEV_LOGIN_DEFAULTS === '1') return true
  return (
    isLoopbackHost(request.hostname) ||
    isLoopbackHost(request.get('host')) ||
    isLoopbackHost(request.ip) ||
    process.env.NODE_ENV !== 'production'
  )
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  parts.push(`Path=${options.path ?? '/'}`)
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`)
  if (options.httpOnly !== false) parts.push('HttpOnly')
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
  if (options.secure) parts.push('Secure')
  return parts.join('; ')
}

function appendSetCookie(response, cookie) {
  const current = response.getHeader('Set-Cookie')
  if (!current) {
    response.setHeader('Set-Cookie', cookie)
    return
  }
  response.setHeader('Set-Cookie', Array.isArray(current) ? [...current, cookie] : [current, cookie])
}

function parseCookies(header = '') {
  return String(header)
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((result, chunk) => {
      const separatorIndex = chunk.indexOf('=')
      if (separatorIndex === -1) return result
      result[chunk.slice(0, separatorIndex).trim()] = decodeURIComponent(chunk.slice(separatorIndex + 1))
      return result
    }, {})
}

function oidcStateCookieName(providerKey) {
  return `${OIDC_STATE_COOKIE_PREFIX}${String(providerKey).replace(/[^a-z0-9._-]/gi, '_')}`
}

function setOidcStateCookie(response, providerKey, payload, secure) {
  appendSetCookie(response, serializeCookie(oidcStateCookieName(providerKey), JSON.stringify(payload), {
    maxAge: OIDC_STATE_TTL_MS,
    sameSite: 'Lax',
    secure,
    httpOnly: true,
    path: '/',
  }))
}

function clearOidcStateCookie(response, providerKey, secure) {
  appendSetCookie(response, serializeCookie(oidcStateCookieName(providerKey), '', {
    maxAge: 0,
    sameSite: 'Lax',
    secure,
    httpOnly: true,
    path: '/',
  }))
}

function readOidcStateCookie(request, providerKey) {
  const cookies = parseCookies(request.headers.cookie || '')
  const raw = cookies[oidcStateCookieName(providerKey)]
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function registerAuthRoutes(app) {
  app.get('/api/auth/session', (request, response) => {
    response.json(getPlatformAuthContext(request))
  })

  app.get('/api/auth/oidc/providers', (_request, response) => {
    try {
      response.json({
        ok: true,
        providers: listOidcIdentityProviderProfiles().map(publicOidcIdentityProviderProfile),
      })
    } catch (error) {
      response.status(503).json({
        ok: false,
        error: 'OIDC_PROVIDER_CONFIGURATION_UNAVAILABLE',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/auth/oidc/:providerKey/test', async (request, response) => {
    try {
      response.json(await testOidcIdentityProviderProfile(request.params.providerKey))
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: 'OIDC_PROVIDER_TEST_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/auth/oidc/:providerKey/login', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'auth:oidc-login', { limit: 30, windowMs: 5 * 60_000 })) return
      const profile = getOidcIdentityProviderProfile(request.params.providerKey)
      const state = crypto.randomUUID()
      const nonce = crypto.randomUUID()
      const next = String(request.query.next || '/cockpit')
      const redirect = await buildOidcAuthorizationRedirect({ profile, request, state, nonce, next })
      setOidcStateCookie(response, profile.key, { state, nonce, next, createdAt: new Date().toISOString() }, shouldUseSecureCookies(request))
      response.redirect(302, redirect.url)
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: 'OIDC_LOGIN_START_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/auth/oidc/:providerKey/callback', async (request, response) => {
    const secureCookies = shouldUseSecureCookies(request)
    try {
      if (!requireRateLimit(request, response, 'auth:oidc-callback', { limit: 30, windowMs: 5 * 60_000 })) return
      const profile = getOidcIdentityProviderProfile(request.params.providerKey)
      const statePayload = readOidcStateCookie(request, profile.key)
      clearOidcStateCookie(response, profile.key, secureCookies)
      if (!statePayload?.state || statePayload.state !== request.query.state) {
        throw new Error('OIDC_STATE_INVALID')
      }
      const stateCreatedAt = Date.parse(statePayload.createdAt)
      if (!Number.isFinite(stateCreatedAt) || Date.now() - stateCreatedAt > OIDC_STATE_TTL_MS) {
        throw new Error('OIDC_STATE_EXPIRED')
      }
      const code = String(request.query.code || '').trim()
      if (!code) throw new Error('OIDC_CODE_REQUIRED')
      const exchanged = await exchangeOidcCodeForIdentity({
        profile,
        request,
        code,
        expectedNonce: statePayload.nonce,
      })
      const result = createExternalIdentitySession({
        ...exchanged.identity,
        rememberMe: true,
      })
      setAuthCookie(response, result.rawToken, true, secureCookies)
      clearOidcStateCookie(response, profile.key, secureCookies)
      response.redirect(302, statePayload.next || '/cockpit')
    } catch (error) {
      clearOidcStateCookie(response, request.params.providerKey, secureCookies)
      response.redirect(302, `/auth/login?oidc_error=${encodeURIComponent(String(error?.message ?? 'OIDC_LOGIN_FAILED'))}`)
    }
  })

  app.get('/api/auth/oidc/:providerKey/logout', async (request, response) => {
    const secureCookies = shouldUseSecureCookies(request)
    try {
      const profile = getOidcIdentityProviderProfile(request.params.providerKey)
      const redirect = await buildOidcLogoutRedirect({ profile, request })
      destroyRequestSession(request)
      clearAuthCookie(response, secureCookies)
      response.redirect(302, redirect.url)
    } catch (error) {
      destroyRequestSession(request)
      clearAuthCookie(response, secureCookies)
      response.redirect(302, `/auth/login?oidc_error=${encodeURIComponent(String(error?.message ?? 'OIDC_LOGOUT_FAILED'))}`)
    }
  })

  app.get('/api/auth/dev-login-defaults', (request, response) => {
    if (!isDevLoginDefaultsAllowed(request)) {
      response.status(404).json({ ok: false, error: 'DEV_LOGIN_DEFAULTS_DISABLED' })
      return
    }
    response.json({
      ok: true,
      email: process.env.TWIN_STUDIO_SMOKE_EMAIL || DEFAULT_DEV_EMAIL,
      password: process.env.TWIN_STUDIO_SMOKE_PASSWORD || DEFAULT_DEV_PASSWORD,
      cityId: process.env.TWIN_STUDIO_SMOKE_CITY_ID || process.env.TWIN_STUDIO_CITY_ID || DEFAULT_DEV_CITY_ID,
      rememberMe: true,
    })
  })

  app.post('/api/auth/signup-request', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'auth:signup', { limit: 8, windowMs: 15 * 60_000 })) return
      const result = await createSignupRequest({
        fullName: request.body?.fullName,
        email: request.body?.email,
        password: request.body?.password,
        cityId: request.body?.cityId,
        role: request.body?.role,
        request,
      })
      response.status(201).json(result)
    } catch (error) {
      response.status(400).json({
        error: String(error?.message ?? 'SIGNUP_REQUEST_FAILED'),
      })
    }
  })

  app.post('/api/auth/login', (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'auth:login', { limit: 12, windowMs: 5 * 60_000 })) return
      const result = createLoginSession({
        email: request.body?.email,
        password: request.body?.password,
        cityId: request.body?.cityId,
        rememberMe: request.body?.rememberMe !== false,
      })
      setAuthCookie(response, result.rawToken, request.body?.rememberMe !== false, shouldUseSecureCookies(request))
      response.json({
        ok: true,
        user: result.user,
        session: result.session,
      })
    } catch (error) {
      response.status(401).json({
        error: String(error?.message ?? 'LOGIN_FAILED'),
      })
    }
  })

  app.post('/api/auth/logout', (request, response) => {
    destroyRequestSession(request)
    clearAuthCookie(response, shouldUseSecureCookies(request))
    response.json({ ok: true })
  })

  app.post('/api/auth/request-reset', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'auth:reset-request', { limit: 6, windowMs: 15 * 60_000 })) return
      const result = await requestPasswordReset({
        email: request.body?.email,
        request,
      })
      response.json(result)
    } catch (error) {
      response.status(400).json({
        error: String(error?.message ?? 'RESET_REQUEST_FAILED'),
      })
    }
  })

  app.post('/api/auth/reset-password', (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'auth:reset-password', { limit: 10, windowMs: 15 * 60_000 })) return
      const result = resetPasswordFromToken({
        token: request.body?.token,
        password: request.body?.password,
      })
      response.json(result)
    } catch (error) {
      response.status(400).json({
        error: String(error?.message ?? 'RESET_FAILED'),
      })
    }
  })

  app.get('/auth/activate', (request, response) => {
    try {
      activateUserFromToken(String(request.query.token || ''))
      response.redirect(302, '/auth/login?activated=1')
    } catch (error) {
      response.redirect(302, `/auth/login?activation_error=${encodeURIComponent(String(error?.message ?? 'TOKEN_INVALID'))}`)
    }
  })
}
