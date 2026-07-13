'use client'

import {
  buildRawTwinQueryRequest,
  buildSqlTwinQueryRequest,
  buildTwinQueryRequest,
  TWIN_QUERY_CLASS_LABELS,
} from '../semanticQueryClient'
import { normalizeQueryClauses } from './queryPanelModel'

const QUERY_SHARE_MODE = 'twin-query-manifest'
const QUERY_SHARE_VERSION = '2026-05-22'
const QUERY_SHARE_VISUAL_STATE_VERSION = '2026-06-24'

export function initialQueryShareState() {
  return {
    status: 'idle',
    shares: [],
    saved: null,
    error: '',
  }
}

function clauseClassLabels(clauses) {
  return clauses
    .map((clause) => TWIN_QUERY_CLASS_LABELS[clause.classKey] ?? clause.classKey)
    .filter(Boolean)
}

export function twinQueryShareTitle(builder = {}, supportsCityScale = false) {
  if (builder?.mode === 'sql') return 'Expert SQL query'
  if (builder?.mode === 'raw') return 'Raw TwinQL query'
  const clauses = normalizeQueryClauses(builder, supportsCityScale)
  const labels = clauseClassLabels(clauses)
  if (!labels.length) return 'TwinQL city-object query'
  const uniqueLabels = Array.from(new Set(labels))
  return uniqueLabels.length === 1
    ? `${uniqueLabels[0]} query`
    : `${uniqueLabels.slice(0, 3).join(' + ')} query`
}

function isRawQueryBuilder(builder = {}) {
  return builder?.mode === 'raw'
}

function isSqlQueryBuilder(builder = {}) {
  return builder?.mode === 'sql'
}

function selectionFromQuery(query = {}) {
  if (query.scope?.key) {
    return {
      selectionScope: query.scope.key,
      selection: {
        scope: query.scope.key,
        ...query.scope,
      },
    }
  }
  const firstClauseScope = Array.isArray(query.clauses)
    ? query.clauses.find((clause) => clause.scope?.key)?.scope
    : null
  if (firstClauseScope?.key) {
    return {
      selectionScope: firstClauseScope.key,
      selection: {
        scope: firstClauseScope.key,
        ...firstClauseScope,
      },
    }
  }
  return {
    selectionScope: 'city',
    selection: { scope: 'city', key: 'city' },
  }
}

function visibleLayerKeys(layers = {}) {
  if (!layers || typeof layers !== 'object') return []
  return Object.entries(layers)
    .filter(([, visible]) => Boolean(visible))
    .map(([key]) => key)
    .filter(Boolean)
}

function compactObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function compactVisualState({
  surfaceKey = 'map',
  viewerId = 'map',
  visualState = {},
} = {}) {
  const layers = compactObject(visualState.layers) ?? {}
  const layerKeys = visibleLayerKeys(layers)
  const camera = compactObject(visualState.camera)
  const cameraPolicy = compactObject(visualState.cameraPolicy)
  const baseMap = compactObject(visualState.baseMap)
  const viewerConfig = compactObject(visualState.viewerConfig) ?? {}
  const xrSession = compactObject(visualState.xrSession) ?? compactObject(visualState.xrSessionState)
  const xrMode = visualState.xrMode || visualState.mode || ''
  return {
    version: QUERY_SHARE_VISUAL_STATE_VERSION,
    surface: visualState.surface || surfaceKey,
    viewerId: visualState.viewerId || viewerId,
    mode: visualState.mode || xrMode || '',
    xrMode,
    layerKeys,
    layers,
    camera,
    cameraPolicy,
    baseMap,
    xrSession,
    viewerConfig,
    capturedAt: new Date().toISOString(),
  }
}

export function buildTwinQuerySharePayload({
  builder = {},
  cityCoverage = 0,
  payload,
  surfaceKey = 'map',
  supportsCityScale = false,
  visualState = {},
  viewerId = 'map',
} = {}) {
  const rawMode = isRawQueryBuilder(builder)
  const sqlMode = isSqlQueryBuilder(builder)
  let query
  if (sqlMode) {
    query = buildSqlTwinQueryRequest({
      sqlText: builder.sqlText,
      surface: surfaceKey,
      viewerId,
    })
  } else if (rawMode) {
    query = buildRawTwinQueryRequest({
      rawText: builder.rawText,
      surface: surfaceKey,
      viewerId,
    })
  } else {
    query = buildTwinQueryRequest({
      builder,
      cityCoverage,
      payload,
      surface: surfaceKey,
      viewerId,
    })
  }
  const clauses = rawMode || sqlMode ? [] : normalizeQueryClauses(builder, supportsCityScale)
  const title = twinQueryShareTitle(builder, supportsCityScale)
  const { selection, selectionScope } = selectionFromQuery(query)
  const compactedVisualState = compactVisualState({
    surfaceKey,
    viewerId,
    visualState,
  })

  return {
    surface: surfaceKey,
    mode: QUERY_SHARE_MODE,
    title,
    description: sqlMode
      ? `Expert SQL query and visual state saved for ${viewerId}`
      : rawMode
      ? `Raw JSON query and visual state saved for ${viewerId}`
      : `${clauses.length} ${clauses.length === 1 ? 'clause' : 'clauses'} and visual state saved for ${viewerId}`,
    accessPolicy: 'session',
    publicationStatus: 'draft',
    layerKeys: compactedVisualState.layerKeys,
    selectionScope,
    selection,
    manifest: {
      kind: QUERY_SHARE_MODE,
      version: QUERY_SHARE_VERSION,
      title,
      surface: surfaceKey,
      viewerId,
      query,
      builder,
      visualState: compactedVisualState,
      summary: {
        clauseCount: clauses.length,
        rawQuery: rawMode,
        sqlQuery: sqlMode,
        classes: Array.from(new Set(clauses.map((clause) => clause.classKey).filter(Boolean))),
        selectionScope,
        visualState: {
          hasCamera: Boolean(compactedVisualState.camera),
          hasCameraPolicy: Boolean(compactedVisualState.cameraPolicy),
          hasXrSession: Boolean(compactedVisualState.xrSession),
          layerCount: compactedVisualState.layerKeys.length,
          xrMode: compactedVisualState.xrMode,
        },
      },
    },
  }
}

export function queryManifestFromShare(share = {}) {
  const manifest = share.manifest ?? {}
  const queryManifest = manifest.queryManifest ?? manifest.share?.queryManifest ?? manifest
  if (queryManifest?.kind !== QUERY_SHARE_MODE && queryManifest?.kind !== 'twin-query') return null
  return queryManifest
}

export function isTwinQueryShare(share = {}) {
  return share.mode === QUERY_SHARE_MODE || Boolean(queryManifestFromShare(share))
}

export function twinQueryFromShare(share = {}, { surfaceKey = 'map', viewerId = 'map' } = {}) {
  const queryManifest = queryManifestFromShare(share)
  if (!queryManifest?.query) return null
  return {
    ...queryManifest.query,
    surface: surfaceKey,
    intent: queryManifest.query.intent || (viewerId === '3d' ? 'operations' : viewerId === 'immersive' ? 'embed' : 'analysis'),
    shareKey: share.shareKey,
    metadata: {
      ...(queryManifest.query.metadata && typeof queryManifest.query.metadata === 'object'
        ? queryManifest.query.metadata
        : {}),
      source: 'visual-secondary-rail-query-manifest',
      shareKey: share.shareKey,
    },
  }
}

export function builderFromShare(share = {}) {
  return queryManifestFromShare(share)?.builder ?? null
}

export function visualStateFromShare(share = {}) {
  return queryManifestFromShare(share)?.visualState ?? null
}

export function queryShareLabel(share = {}) {
  const queryManifest = queryManifestFromShare(share)
  return share.title || queryManifest?.title || 'Saved query'
}

export function queryShareVisualSummary(share = {}) {
  const visualState = visualStateFromShare(share)
  if (!visualState) return 'query only'
  const parts = []
  if (visualState.xrMode || visualState.mode) parts.push(visualState.xrMode || visualState.mode)
  const layerCount = Array.isArray(visualState.layerKeys)
    ? visualState.layerKeys.length
    : visibleLayerKeys(visualState.layers).length
  if (layerCount) parts.push(`${layerCount} layers`)
  if (visualState.camera) parts.push('camera')
  if (visualState.cameraPolicy) parts.push('viewer config')
  if (visualState.xrSession?.requestedMode && visualState.xrSession.requestedMode !== 'desktop') parts.push(visualState.xrSession.requestedMode.toUpperCase())
  return parts.length ? parts.join(' / ') : 'visual state'
}

export function querySharePublicationLabel(share = {}) {
  if (share.publicationStatus === 'published') return 'Published'
  if (share.publicationStatus === 'retired') return 'Retired'
  return 'Draft'
}

export function queryShareEmbed(share = {}) {
  if (share.embed && typeof share.embed === 'object') return share.embed
  const publication = share.manifest?.publication
  if (publication?.embed && typeof publication.embed === 'object') return publication.embed
  return null
}

export function queryShareEmbedHref(share = {}) {
  const embed = queryShareEmbed(share)
  return embed?.viewerUrl || embed?.viewerPath || ''
}

const SURFACE_VIEWER_PATHS = {
  map: 'map',
  municipal3d: '3d',
  immersive: 'immersive',
}

export function queryShareSurfaceHref(share = {}, surface = 'map') {
  if (!share.shareKey) return ''
  const cityId = encodeURIComponent(share.cityId || 'current')
  const shareKey = encodeURIComponent(share.shareKey)
  const viewerPath = SURFACE_VIEWER_PATHS[surface] || SURFACE_VIEWER_PATHS.map
  return `/live/${cityId}/${viewerPath}?embed=1&shareKey=${shareKey}`
}

export function queryShareSurfaceLinks(share = {}) {
  if (share.publicationStatus !== 'published') return []
  return [
    { key: 'map', label: 'Map', href: queryShareSurfaceHref(share, 'map') },
    { key: 'municipal3d', label: '3D', href: queryShareSurfaceHref(share, 'municipal3d') },
    { key: 'immersive', label: 'Immersive', href: queryShareSurfaceHref(share, 'immersive') },
  ].filter((entry) => entry.href)
}
