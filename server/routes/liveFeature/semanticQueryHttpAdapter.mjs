import {
  actorId,
  parseJsonish,
} from './liveHttpModel.mjs'

export function semanticQueryPayload(request, access) {
  const body = request.body && typeof request.body === 'object' ? request.body : {}
  const queryPayload = body.query && typeof body.query === 'object' ? body.query : body
  const scopeFromQuery = parseJsonish(request.query.scope, null)
  const renderFromQuery = parseJsonish(request.query.render, null)
  const filtersFromQuery = parseJsonish(request.query.filters, null)
  const surface = body.surface || queryPayload.surface || request.query.surface || 'map'
  const intent = body.intent || queryPayload.intent || request.query.intent || 'analysis'

  return {
    ...queryPayload,
    classes: queryPayload.classes ?? request.query.classes ?? request.query.class,
    filters: queryPayload.filters ?? filtersFromQuery,
    scope: queryPayload.scope ?? {
      ...(scopeFromQuery && typeof scopeFromQuery === 'object' ? scopeFromQuery : {}),
      key: request.query.scopeKey ?? request.query.scopeType ?? scopeFromQuery?.key ?? request.query.scope,
      bbox: request.query.bbox,
      center: request.query.center,
      radiusMeters: request.query.radiusMeters ?? request.query.radius,
      geometry: parseJsonish(request.query.geometry, undefined),
    },
    render: queryPayload.render ?? {
      ...(renderFromQuery && typeof renderFromQuery === 'object' ? renderFromQuery : {}),
      mode: request.query.renderMode ?? request.query.mode,
      transport: request.query.transport,
      maxFeatures: request.query.maxFeatures ?? request.query.limit,
    },
    combine: queryPayload.combine ?? request.query.combine,
    surface,
    intent,
    actorUserId: actorId(access, request),
    actorRole: access.currentUser?.role || access.user?.role || request.headers['x-user-role'] || null,
    consumerKey: body.consumerKey || request.query.consumerKey || request.headers['x-consumer-key'] || null,
    shareKey: body.shareKey || request.query.shareKey || null,
    embedKey: body.embedKey || request.query.embedKey || null,
    requestPath: request.originalUrl || request.url,
    requestId: request.headers['x-request-id'] || null,
    metadata: {
      ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
      ...(queryPayload.metadata && typeof queryPayload.metadata === 'object' ? queryPayload.metadata : {}),
      method: request.method,
      userAgent: request.headers['user-agent'] || null,
    },
  }
}
