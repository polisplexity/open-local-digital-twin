import { randomUUID } from 'node:crypto'

function apiRouteFamily(pathname) {
  if (pathname === '/api/health') return 'health'
  if (pathname.startsWith('/api/auth')) return 'auth'
  if (pathname.startsWith('/api/admin')) return 'admin'
  if (pathname.startsWith('/api/provider')) return 'provider'
  if (pathname.startsWith('/api/platform')) return 'platform'
  if (pathname.includes('/standards/')) return 'standards'
  if (pathname.startsWith('/api/live')) return 'live'
  return 'api'
}

function apiVersionFromPath(pathname) {
  const match = pathname.match(/\/api\/(?:provider\/)?(v[0-9]+)\b/)
  return match?.[1] ?? 'compat'
}

function cityIdFromApiRequest(request, { getRequestSession, getCityRegistry }) {
  const paramsCityId = String(request.params?.cityId ?? '').trim()
  if (paramsCityId && paramsCityId !== 'current') return paramsCityId

  const pathname = String(request.path ?? '')
  const pathMatch = pathname.match(/\/(?:cities|live)\/([^/]+)/)
  if (pathMatch?.[1] && pathMatch[1] !== 'current') return pathMatch[1]

  const sessionCityId = getRequestSession(request)?.session?.cityId
  if (sessionCityId) return sessionCityId

  if (pathname.includes('/current/')) {
    return getCityRegistry().activeCityId
  }
  return null
}

function pathTemplateFromApiRequest(request) {
  const routePath = request.route?.path
  if (typeof routePath === 'string') return routePath
  if (Array.isArray(routePath)) return routePath.join('|')
  return String(request.path ?? '/api')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/[0-9]+(?=\/|$)/g, '/:id')
}

function actorRoleFromSession(session) {
  const roles = session?.user?.roles
  if (Array.isArray(roles) && roles.length) return roles.join(',')
  return null
}

export function createApiObservabilityMiddleware({ getRequestSession, getCityRegistry, recordApiUsageEvent }) {
  return function attachApiObservability(request, response, next) {
    if (!request.path.startsWith('/api/')) {
      next()
      return
    }

    const startedAt = process.hrtime.bigint()
    const requestId = String(request.headers['x-request-id'] || '').trim() || randomUUID()
    request.requestId = requestId
    response.setHeader('X-Request-ID', requestId)

    response.on('finish', () => {
      const latencyMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n)
      const session = getRequestSession(request)
      const metadata = {
        queryKeys: Object.keys(request.query ?? {}).sort(),
        userAgent: request.headers['user-agent'] ? String(request.headers['user-agent']).slice(0, 160) : null,
      }
      recordApiUsageEvent({
        requestId,
        routeFamily: apiRouteFamily(request.path),
        method: request.method,
        pathTemplate: pathTemplateFromApiRequest(request),
        statusCode: response.statusCode,
        latencyMs,
        cityId: cityIdFromApiRequest(request, { getRequestSession, getCityRegistry }),
        actorUserId: session?.user?.id ?? null,
        actorRole: actorRoleFromSession(session),
        apiVersion: apiVersionFromPath(request.path),
        consumerKey: request.headers['x-provider-id'] ?? null,
        errorCode: response.statusCode >= 400 ? response.statusMessage : null,
        metadata,
      }).catch(() => {})
    })

    next()
  }
}
