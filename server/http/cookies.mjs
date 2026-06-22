export function shouldUseSecureCookies(request) {
  const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase()
  const host = String(request.get('host') || '').toLowerCase()
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return false
  }
  return forwardedProto === 'https' || request.secure
}
