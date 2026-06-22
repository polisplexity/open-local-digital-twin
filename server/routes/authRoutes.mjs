import { shouldUseSecureCookies } from '../http/cookies.mjs'
import { requireRateLimit } from '../http/rateLimit.mjs'
import {
  activateUserFromToken,
  clearAuthCookie,
  createLoginSession,
  createSignupRequest,
  destroyRequestSession,
  getPlatformAuthContext,
  requestPasswordReset,
  resetPasswordFromToken,
  setAuthCookie,
} from '../services/authService.mjs'

export function registerAuthRoutes(app) {
  app.get('/api/auth/session', (request, response) => {
    response.json(getPlatformAuthContext(request))
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
