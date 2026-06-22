import { startsWithPath } from './security.mjs'

export function createAuthGuard({ publicPrefixes, protectedPrefixes, getRequestSession, requireAdmin }) {
  return function protectAuthenticatedRoutes(request, response, next) {
    const pathname = request.path
    if (startsWithPath(pathname, publicPrefixes)) {
      next()
      return
    }
    if (!startsWithPath(pathname, protectedPrefixes)) {
      next()
      return
    }

    const session = getRequestSession(request)
    if (!session) {
      if (pathname.startsWith('/api/')) {
        response.status(401).json({ error: 'AUTH_REQUIRED' })
        return
      }
      response.redirect(302, `/auth/login?next=${encodeURIComponent(request.originalUrl)}`)
      return
    }

    if (startsWithPath(pathname, ['/admin', '/api/admin']) && !requireAdmin(request)) {
      if (pathname.startsWith('/api/')) {
        response.status(403).json({ error: 'ADMIN_REQUIRED' })
      } else {
        response.redirect(302, '/cockpit')
      }
      return
    }

    next()
  }
}
