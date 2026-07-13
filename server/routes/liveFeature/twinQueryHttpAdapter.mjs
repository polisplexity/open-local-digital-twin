import {
  actorId,
  parseJsonish,
  requestOrigin,
} from './liveHttpModel.mjs'

const CACHEABLE_TWIN_QUERY_CLASS_LAYERS = new Map([
  ['buildings', 'buildings'],
  ['roads', 'roads'],
  ['greenBlue', 'greenBlue'],
  ['places', 'places'],
])
const CACHEABLE_TWIN_QUERY_TILE_LIMIT = 12000
const DYNAMIC_TWIN_QUERY_TILE_LIMIT = 5000

function hasQueryFilter(value) {
  if (!value) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function cacheableTwinQueryLayerKeys(classes = []) {
  return unique(classes.map((classKey) => CACHEABLE_TWIN_QUERY_CLASS_LAYERS.get(String(classKey == null ? '' : classKey).trim())))
}

function cacheableTwinQueryDescriptor(query) {
  if (!query || typeof query !== 'object') return null
  const transport = query.render && typeof query.render === 'object' ? query.render.transport : ''
  if (String(transport || '').trim() !== 'mvt') return null
  if (hasQueryFilter(query.where)) return null
  if (hasQueryFilter(query.sqlWhere)) return null
  if (hasQueryFilter(query.sqlText)) return null

  const clauses = Array.isArray(query.clauses) && query.clauses.length
    ? query.clauses
    : [{ classes: query.classes, scope: query.scope, where: query.where, sqlWhere: query.sqlWhere, sqlText: query.sqlText }]
  if (clauses.length !== 1) return null

  const clause = clauses[0] || {}
  if (hasQueryFilter(clause.where)) return null
  if (hasQueryFilter(clause.sqlWhere)) return null
  if (hasQueryFilter(clause.sqlText)) return null
  const scope = clause.scope && typeof clause.scope === 'object' ? clause.scope : query.scope
  if (!['city', 'radius'].includes(String((scope && scope.key) || 'city'))) return null

  const layerKeys = cacheableTwinQueryLayerKeys(Array.isArray(clause.classes) ? clause.classes : query.classes)
  if (!layerKeys.length) return null

  return { layerKeys, scope: scope || { key: 'city' } }
}

function cachedTwinQueryVectorTileTemplate(request, cityId, query) {
  const descriptor = cacheableTwinQueryDescriptor(query)
  if (!descriptor) return ''
  const cityPath = encodeURIComponent(cityId || 'current')
  const params = new URLSearchParams()
  params.set('layers', descriptor.layerKeys.join(','))
  params.set('limit', String(CACHEABLE_TWIN_QUERY_TILE_LIMIT))
  if (descriptor.scope.key === 'radius') {
    const center = Array.isArray(descriptor.scope.center) ? descriptor.scope.center : []
    const radiusMeters = Number(descriptor.scope.radiusMeters)
    if (
      center.length !== 2 ||
      !Number.isFinite(Number(center[0])) ||
      !Number.isFinite(Number(center[1])) ||
      !Number.isFinite(radiusMeters) ||
      radiusMeters <= 0
    ) {
      return ''
    }
    params.set('center', `${Number(center[0]).toFixed(7)},${Number(center[1]).toFixed(7)}`)
    params.set('radiusMeters', String(Math.round(radiusMeters)))
  }
  const path = `/api/live/${cityPath}/cached-tiles/latest/{z}/{x}/{y}.mvt?${params.toString()}`
  const origin = requestOrigin(request)
  return origin ? `${origin}${path}` : path
}

function twinQueryVectorTileTemplate(request, cityId, query) {
  if (!query || typeof query !== 'object') return ''
  const cachedTemplate = cachedTwinQueryVectorTileTemplate(request, cityId, query)
  if (cachedTemplate) return cachedTemplate
  const cityPath = encodeURIComponent(cityId || 'current')
  const encodedQuery = encodeURIComponent(JSON.stringify(query))
  const path = `/api/live/${cityPath}/twin-query-tiles/{z}/{x}/{y}.mvt?limit=${DYNAMIC_TWIN_QUERY_TILE_LIMIT}&query=${encodedQuery}`
  const origin = requestOrigin(request)
  return origin ? `${origin}${path}` : path
}

function layerKeyForQueryProperties(properties = {}) {
  const semanticClass = String(properties.semanticClass || properties.semantic_class || '').toLowerCase()
  return properties.layerKey || properties.layer_key || properties.displayLayerKey || properties.display_layer_key || (
    semanticClass.includes('building') ? 'buildings' :
    semanticClass.includes('road') ? 'roads' :
    semanticClass.includes('green') ? 'greenBlue' :
    semanticClass.includes('mobility') ? 'mobility' :
    semanticClass.includes('civic') ? 'civic' :
    semanticClass.includes('commerce') ? 'commerce' :
    semanticClass.includes('waste') ? 'wasteSeeds' :
    semanticClass.includes('place') ? 'places' :
    'features'
  )
}

function primitiveGeometryFromGeojson(geometry = {}) {
  const type = String(geometry.type || '')
  const kind = {
    Point: 'point',
    MultiPoint: 'multiPoint',
    LineString: 'lineString',
    MultiLineString: 'multiLineString',
    Polygon: 'polygon',
    MultiPolygon: 'multiPolygon',
  }[type]
  if (!kind || !Array.isArray(geometry.coordinates)) return null
  return {
    kind,
    coordinates: geometry.coordinates,
  }
}

function cesiumPrimitivePayloadFromGeojson(geojson) {
  const features = Array.isArray(geojson?.features) ? geojson.features : []
  return {
    kind: 'cesium-query-primitives',
    version: '2026-05-28',
    features: features
      .map((feature) => {
        const geometry = primitiveGeometryFromGeojson(feature?.geometry)
        if (!geometry) return null
        const properties = feature.properties && typeof feature.properties === 'object' ? feature.properties : {}
        const layerKey = layerKeyForQueryProperties(properties)
        return {
          id: properties.objectId || properties.object_id || properties.stableId || properties.stable_id || feature.id || null,
          layerKey,
          semanticClass: properties.semanticClass || properties.semantic_class || layerKey,
          label: properties.label || properties.name || properties.objectId || properties.object_id || layerKey,
          authorityStatus: properties.authorityStatus || properties.authority_status || null,
          sourceCoverageStatus: properties.sourceCoverageStatus || properties.source_coverage_status || null,
          properties: {
            ...properties,
            layerKey,
          },
          geometry,
        }
      })
      .filter(Boolean),
  }
}

const SCENE_MANIFEST_MATERIALS = {
  boundary: { color: '#d1641f', alpha: 0.95 },
  roads: { color: '#2e4d6e', alpha: 0.9 },
  buildings: { color: '#738caa', alpha: 0.74 },
  greenBlue: { color: '#21a885', alpha: 0.38 },
  civic: { color: '#089287', alpha: 0.8 },
  mobility: { color: '#336edb', alpha: 0.8 },
  commerce: { color: '#8c4fde', alpha: 0.8 },
  wasteSeeds: { color: '#e08521', alpha: 0.8 },
  places: { color: '#db61ad', alpha: 0.8 },
  features: { color: '#597899', alpha: 0.7 },
}

function sceneGeometryFromGeojson(geometry = {}) {
  const type = String(geometry.type || '')
  const kind = {
    Point: 'point',
    MultiPoint: 'multiPoint',
    LineString: 'lineString',
    MultiLineString: 'multiLineString',
    Polygon: 'polygon',
    MultiPolygon: 'multiPolygon',
  }[type]
  if (!kind || !Array.isArray(geometry.coordinates)) return null
  return {
    kind,
    coordinates: geometry.coordinates,
  }
}

function finiteSceneNumber(value) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.+-]+/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function firstPresent(...values) {
  return values.find((value) => value != null && value !== '') ?? null
}

function buildingRenderStyle(properties = {}, layerKey = 'features') {
  const heightMeters = finiteSceneNumber(firstPresent(
    properties.heightMeters,
    properties.height_meters,
    properties.height_m,
    properties.height,
    properties['building:height'],
  ))
  const floors = finiteSceneNumber(firstPresent(
    properties.floors,
    properties.levels,
    properties['building:levels'],
    properties.estimated_floors,
  ))
  const footprintAreaM2 = finiteSceneNumber(firstPresent(
    properties.footprintAreaM2,
    properties.footprint_area_m2,
    properties.area_m2,
    properties.areaM2,
  ))
  const buildingType = firstPresent(properties.buildingType, properties.building_type, properties.building)
  const provider = firstPresent(properties.provider, properties.source, properties.sourceName, properties.source_name)
  const sourceFamily = firstPresent(properties.sourceFamily, properties.source_family, properties.source_format, properties.sourceFormat, provider)
  const confidence = firstPresent(properties.confidence, properties.source_confidence, properties.match_confidence)
  const sourceCoverageStatus = firstPresent(properties.sourceCoverageStatus, properties.source_coverage_status)
  const semanticClass = firstPresent(properties.semanticClass, properties.semantic_class, layerKey)
  return {
    schemaVersion: 1,
    visualIntent: layerKey === 'buildings' ? 'building-facade' : 'semantic-object',
    heightMeters,
    floors,
    footprintAreaM2,
    buildingType,
    provider,
    sourceFamily,
    confidence,
    sourceCoverageStatus,
    semanticClass,
    facadeFamily: null,
    roofType: null,
    materialSeed: firstPresent(properties.objectId, properties.object_id, properties.stableId, properties.stable_id, properties.id),
    detailLevel: 'auto',
    semanticHighlights: [],
  }
}

function sceneObjectsFromGeojson(geojson) {
  const features = Array.isArray(geojson?.features) ? geojson.features : []
  return features
    .map((feature, index) => {
      const geometry = sceneGeometryFromGeojson(feature?.geometry)
      if (!geometry) return null
      const properties = feature.properties && typeof feature.properties === 'object' ? feature.properties : {}
      const layerKey = layerKeyForQueryProperties(properties)
      const objectId = properties.objectId || properties.object_id || properties.stableId || properties.stable_id || feature.id || `scene-object-${index + 1}`
      return {
        id: objectId,
        objectId,
        stableId: properties.stableId || properties.stable_id || objectId,
        layerKey,
        semanticClass: properties.semanticClass || properties.semantic_class || layerKey,
        label: properties.label || properties.name || objectId || layerKey,
        authorityStatus: properties.authorityStatus || properties.authority_status || null,
        sourceCoverageStatus: properties.sourceCoverageStatus || properties.source_coverage_status || null,
        provider: properties.provider || properties.source || properties.sourceName || properties.source_name || null,
        clauseId: properties.clauseId || properties.clause_id || null,
        clauseLabel: properties.clauseLabel || properties.clause_label || null,
        geometry,
        render: {
          heightMeters: properties.heightMeters ?? properties.height_meters ?? properties.height_m ?? properties.height ?? properties['building:height'] ?? null,
          floors: properties.floors ?? properties.levels ?? properties['building:levels'] ?? properties.estimated_floors ?? null,
          footprintAreaM2: properties.footprintAreaM2 ?? properties.footprint_area_m2 ?? properties.area_m2 ?? properties.areaM2 ?? null,
          category: properties.category || null,
          roadClass: properties.roadClass || properties.road_class || properties.highway || null,
          buildingType: properties.buildingType || properties.building_type || properties.building || null,
          provider: properties.provider || properties.source || properties.sourceName || properties.source_name || null,
          sourceFamily: properties.sourceFamily || properties.source_family || properties.source_format || properties.sourceFormat || null,
          confidence: properties.confidence || null,
          renderStyle: buildingRenderStyle(properties, layerKey),
        },
        properties: {
          layerKey,
          semanticClass: properties.semanticClass || properties.semantic_class || layerKey,
          authorityStatus: properties.authorityStatus || properties.authority_status || null,
          sourceCoverageStatus: properties.sourceCoverageStatus || properties.source_coverage_status || null,
          sourceFamily: properties.sourceFamily || properties.source_family || properties.source_format || properties.sourceFormat || null,
          provider: properties.provider || properties.source || properties.sourceName || properties.source_name || null,
          confidence: properties.confidence || null,
          footprintAreaM2: properties.footprintAreaM2 ?? properties.footprint_area_m2 ?? properties.area_m2 ?? properties.areaM2 ?? null,
        },
      }
    })
    .filter(Boolean)
}

function sceneLayersFromObjects(objects = [], summary = {}) {
  const countsByLayer = summary.countsByLayer && typeof summary.countsByLayer === 'object' ? summary.countsByLayer : {}
  return objects.reduce((layers, object) => {
    const key = object.layerKey || 'features'
    if (!layers[key]) {
      layers[key] = {
        key,
        material: SCENE_MANIFEST_MATERIALS[key] || SCENE_MANIFEST_MATERIALS.features,
        objectCount: Number(countsByLayer[key] ?? 0),
        renderedCount: 0,
      }
    }
    layers[key].renderedCount += 1
    if (!layers[key].objectCount) layers[key].objectCount = layers[key].renderedCount
    return layers
  }, {})
}

function sceneManifestFromGeojson({ cityId, result = {}, links = {} } = {}) {
  const objects = sceneObjectsFromGeojson(result.geojson)
  return {
    kind: 'twin-query-scene-manifest',
    version: '2026-06-04',
    schemaVersion: 1,
    cityId,
    query: result.query,
    summary: result.summary,
    bounds: result.summary?.bounds || null,
    links,
    sampling: {
      requestedMaxFeatures: Number(result.query?.render?.maxFeatures ?? 0),
      returnedObjects: objects.length,
      resultCount: Number(result.summary?.resultCount ?? objects.length),
      truncated: Boolean(result.summary?.truncated),
    },
    layers: sceneLayersFromObjects(objects, result.summary),
    materials: SCENE_MANIFEST_MATERIALS,
    renderContract: {
      schemaVersion: 1,
      objectRenderStyle: 'civic-xr-building-v1',
      modePolicies: ['walk', 'compare', 'overlay'],
      description: 'Scene objects may include render.renderStyle for procedural Civic XR visualization.',
    },
    objects,
  }
}

export function visualTwinQueryResult(request, cityId, result = {}) {
  const resultTransport = String(result.transport || result.query?.render?.transport || request.query.transport || '').trim()
  const vectorTileTemplate = resultTransport === 'table' ? '' : twinQueryVectorTileTemplate(request, cityId, result.query)
  const origin = requestOrigin(request)
  const cityPath = encodeURIComponent(cityId || 'current')
  const pathWithOrigin = (path) => origin ? `${origin}${path}` : path
  const transport = resultTransport
  const links = {
    ...(result.links && typeof result.links === 'object' ? result.links : {}),
    ...(vectorTileTemplate ? { vectorTileTemplate } : {}),
    ...(transport === 'selection-reference'
      ? {
          threeDTilesets: pathWithOrigin(`/api/live/${cityPath}/3d-tilesets?status=ready&limit=10`),
          analysisSelectionMaterialize: pathWithOrigin(`/api/live/${cityPath}/analysis-selections/query`),
        }
      : {}),
  }

  if (transport === 'mvt' || transport === 'metadata') {
    const { geojson, ...rest } = result
    return {
      ...rest,
      transport,
      links,
      geojson: undefined,
    }
  }

  if (transport === 'selection-reference') {
    const { geojson, selectionReference, ...rest } = result
    return {
      ...rest,
      transport,
      links,
      selectionReference,
      geojson: undefined,
    }
  }

  if (transport === 'cesium-primitives') {
    const { geojson, ...rest } = result
    const primitives = cesiumPrimitivePayloadFromGeojson(geojson)
    return {
      ...rest,
      transport,
      links,
      primitives,
      summary: {
        ...(result.summary || {}),
        rendered: primitives.features.length,
        returned: primitives.features.length,
      },
      geojson: undefined,
    }
  }

  if (transport === 'scene-manifest') {
    const { geojson, ...rest } = result
    return {
      ...rest,
      transport,
      links,
      sceneManifest: sceneManifestFromGeojson({ cityId, result, links }),
      geojson: undefined,
    }
  }

  return {
    ...result,
    transport: transport || (result.geojson ? 'geojson' : ''),
    links,
  }
}

export function twinQueryEventsQuery(request) {
  return {
    surface: request.query.surface || request.query.viewer || 'map',
    status: request.query.status,
    limit: request.query.limit,
  }
}

export function twinQueryPayload(request, access) {
  const body = request.body && typeof request.body === 'object' ? request.body : {}
  const queryPayload = body.query && typeof body.query === 'object' ? body.query : body
  const scopeFromQuery = parseJsonish(request.query.scope, null)
  const renderFromQuery = parseJsonish(request.query.render, null)
  const whereFromQuery = parseJsonish(request.query.where ?? request.query.filter, null)
  const surface = body.surface || queryPayload.surface || request.query.surface || 'api'
  const intent = body.intent || queryPayload.intent || request.query.intent || 'analysis'

  return {
    ...queryPayload,
    language: queryPayload.language ?? request.query.language,
    classes: queryPayload.classes ?? request.query.classes ?? request.query.class,
    where: queryPayload.where ?? queryPayload.filter ?? whereFromQuery,
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
      maxFeatures: request.query.maxFeatures ?? request.query.limit,
    },
    orderBy: queryPayload.orderBy ?? request.query.orderBy,
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

export function twinQueryExportPayload(request, access) {
  const body = request.body && typeof request.body === 'object' ? request.body : {}
  const queryPayload = body.query && typeof body.query === 'object'
    ? body.query
    : (body.query && typeof body.query === 'string' ? parseJsonish(body.query, {}) : body)
  const format = body.format || request.query.format || request.query.f || 'csv'
  const surface = body.surface || queryPayload.surface || request.query.surface || 'api'
  const intent = body.intent || queryPayload.intent || request.query.intent || 'export'

  return {
    query: queryPayload,
    format,
    limit: body.limit ?? body.maxRows ?? body.maxFeatures ?? request.query.limit ?? request.query.maxRows ?? request.query.maxFeatures,
    surface,
    intent,
    actorUserId: actorId(access, request),
    actorRole: access.currentUser?.role || access.user?.role || request.headers['x-user-role'] || null,
    consumerKey: body.consumerKey || request.query.consumerKey || request.headers['x-consumer-key'] || null,
    metadata: {
      ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
      ...(queryPayload.metadata && typeof queryPayload.metadata === 'object' ? queryPayload.metadata : {}),
      method: request.method,
      userAgent: request.headers['user-agent'] || null,
      requestPath: request.originalUrl || request.url,
      requestId: request.headers['x-request-id'] || null,
    },
  }
}

function queryManifestFromSharePayload(shareResult = {}) {
  const share = shareResult.share ?? shareResult
  const manifest = share?.manifest && typeof share.manifest === 'object' ? share.manifest : {}
  const queryManifest = manifest.queryManifest ?? manifest.share?.queryManifest ?? manifest
  const kind = String(queryManifest?.kind || queryManifest?.mode || '').trim()
  if (kind !== 'twin-query-manifest' && kind !== 'twin-query') return null
  return queryManifest?.query && typeof queryManifest.query === 'object' ? queryManifest.query : null
}

export async function twinQueryTilePayload(request, access, { loadShareManifest } = {}) {
  const encodedQuery = parseJsonish(request.query.query ?? request.query.twinQuery, null)
  const shareKey = request.query.shareKey || request.query.share
  const surface = request.query.surface || request.query.viewer || 'map'
  const intent = request.query.intent || 'analysis'
  let queryPayload = encodedQuery && typeof encodedQuery === 'object' ? encodedQuery : null

  if (!queryPayload && shareKey && typeof loadShareManifest === 'function') {
    const share = await loadShareManifest(access.cityId, shareKey)
    if (share.ok) queryPayload = queryManifestFromSharePayload(share)
  }

  if (!queryPayload) {
    queryPayload = twinQueryPayload(request, access)
  }

  return {
    ...queryPayload,
    surface: queryPayload.surface || surface,
    intent: queryPayload.intent || intent,
    actorUserId: actorId(access, request),
    actorRole: access.currentUser?.role || access.user?.role || request.headers['x-user-role'] || null,
    consumerKey: request.query.consumerKey || request.headers['x-consumer-key'] || null,
    shareKey: shareKey || queryPayload.shareKey || null,
    embedKey: request.query.embedKey || queryPayload.embedKey || null,
    requestPath: request.originalUrl || request.url,
    requestId: request.headers['x-request-id'] || null,
    metadata: {
      ...(queryPayload.metadata && typeof queryPayload.metadata === 'object' ? queryPayload.metadata : {}),
      method: request.method,
      userAgent: request.headers['user-agent'] || null,
      transport: 'mvt',
    },
  }
}
