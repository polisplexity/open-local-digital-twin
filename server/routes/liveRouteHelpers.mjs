export function requireLiveAccess(request, response, requireLiveCityAccess, cityId) {
  return requireLiveCityAccess(request, response, cityId) || null
}

export function viewportQuery(request) {
  return {
    bbox: request.query.bbox,
    center: request.query.center,
    radiusMeters: request.query.radiusMeters ?? request.query.radius,
    layers: request.query.layers ?? request.query.layer,
    limit: request.query.limit,
  }
}

export function sendViewportPayload(response, viewport) {
  if (!viewport.ok) {
    response.status(502).json(viewport)
    return
  }
  response.json({
    configured: viewport.configured,
    ok: true,
    cityId: viewport.cityId,
    bbox: viewport.bbox,
    center: viewport.center,
    radiusMeters: viewport.radiusMeters,
    layers: viewport.layers,
    limit: viewport.limit,
    returned: viewport.returned,
    truncated: viewport.truncated,
    geojson: viewport.geojson,
    error: null,
  })
}
