const rateLimitBuckets = new Map()

function requestFingerprint(request) {
  const forwardedFor = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return forwardedFor || request.ip || request.socket?.remoteAddress || 'unknown-client'
}

function consumeRateLimit(request, scope, { limit = 30, windowMs = 60_000 } = {}) {
  const now = Date.now()
  const key = `${scope}:${requestFingerprint(request)}`
  const current = rateLimitBuckets.get(key)

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  current.count += 1
  return current.count <= limit
}

export function requireRateLimit(request, response, scope, options) {
  if (consumeRateLimit(request, scope, options)) {
    return true
  }
  response.status(429).json({ error: 'RATE_LIMITED' })
  return false
}
