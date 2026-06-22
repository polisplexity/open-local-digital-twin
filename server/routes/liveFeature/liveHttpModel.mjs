export function requestOrigin(request) {
  const host = String(request.headers['x-forwarded-host'] || request.headers.host || '').split(',')[0].trim()
  if (!host) return ''
  const protocol = String(request.headers['x-forwarded-proto'] || request.protocol || 'http').split(',')[0].trim()
  return `${protocol || 'http'}://${host}`
}

export function escapeAttribute(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function parseJsonish(value, fallback = null) {
  if (value == null || value === '') return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch {
    return fallback
  }
}

export function actorId(access, request) {
  return access.currentUser?.email ||
    access.user?.email ||
    access.currentUser?.id ||
    access.user?.id ||
    request.headers['x-user-id'] ||
    null
}
