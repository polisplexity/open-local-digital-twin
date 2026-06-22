export function startsWithPath(pathname, prefixes) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function sameOriginRequest(request) {
  const origin = String(request.headers.origin || '').trim()
  if (!origin) return true
  const host = String(request.get('host') || '').trim()
  if (!host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export function rejectCrossOriginUnsafeRequests(request, response, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    next()
    return
  }
  if (!sameOriginRequest(request)) {
    response.status(403).json({ error: 'CROSS_ORIGIN_REQUEST_REJECTED' })
    return
  }
  next()
}

export function applySecurityHeaders(_request, response, next) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.setHeader('X-Frame-Options', 'SAMEORIGIN')
  next()
}
