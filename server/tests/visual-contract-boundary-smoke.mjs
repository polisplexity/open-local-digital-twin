import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

const checks = []

function record(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail })
  if (!ok) {
    throw new Error(`${name}${detail ? `: ${detail}` : ''}`)
  }
}

async function source(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8')
}

async function combinedSource(relativePaths) {
  const parts = await Promise.all(relativePaths.map((relativePath) => source(relativePath)))
  return parts.join('\n')
}

function includesAll(text, patterns) {
  return patterns.every((pattern) => {
    if (pattern instanceof RegExp) return pattern.test(text)
    return text.includes(pattern)
  })
}

async function assertSharedBackendManifest() {
  const manifest = await source('server/services/baseTwin/viewerContracts/viewerSurfaceManifest.mjs')
  record(
    'viewer surface manifest owns all visual surfaces',
    includesAll(manifest, [
      'VIEWER_SURFACE_KEYS',
      "map: 'map'",
      "municipal3d: 'municipal3d'",
      "immersive: 'immersive'",
      'buildViewerSurfaceManifest',
      'buildViewerSurfaceManifestIndex',
    ]),
  )
  record(
    'viewer surface manifest allows shared query host commands',
    includesAll(manifest, [
      'twin:set-semantic-query',
      'twin:clear-semantic-query',
      'twin:command',
    ]),
  )
}

async function assertSharedLiveFeatureRoutes() {
  const routes = await source('server/routes/liveFeatureRoutes.mjs')
  record(
    'live feature routes expose shared manifest and TwinQL endpoints',
    includesAll(routes, [
      "app.get('/api/live/:cityId/viewer-manifest'",
      "app.get('/api/live/:cityId/twin-query-contract'",
      "app.post('/api/live/:cityId/twin-query'",
      "app.post('/api/live/:cityId/twin-query/export'",
      "app.get('/api/live/:cityId/twin-query-tiles/:z/:x/:y.mvt'",
      'buildViewerSurfaceManifest',
      'twinQueryHttpAdapter.mjs',
      'twinQueryUseCaseService.mjs',
    ]),
  )
  record(
    'live feature aggregator delegates non-query route families',
    includesAll(routes, [
      'registerViewportFeatureRoutes',
      'registerSemanticQueryRoutes',
      'registerAnalysisSelectionRoutes',
      'registerSelectionRoutes',
      'registerShareManifestRoutes',
    ]),
  )
  record(
    'live feature aggregator does not import PostGIS query repositories directly',
    !/productionTwinStore\/twinQueryRepository\.mjs/.test(routes),
    'TwinQL SQL ownership must remain behind twinQueryUseCaseService',
  )
}

async function assertSharedFrontendShell() {
  const viewerPage = await source('src/components/twin-module/TwinViewerPage.jsx')
  record(
    'TwinViewerPage is the shared visual module shell',
    includesAll(viewerPage, [
      'useLdtVisualSurfaceContract',
      'useTwinQueryController',
      'surfaceKeyForViewer',
      'TwinControlSidebar',
      "type: 'twin:set-visible-layers'",
      '`/live/${cityId}/${config.viewerId}?r=${refreshIndex}`',
    ]),
  )

  const pages = [
    'src/app/(workspace layout)/analytical-map/page.jsx',
    'src/app/(workspace layout)/city-3d/page.jsx',
    'src/app/(workspace layout)/civic-xr/page.jsx',
  ]
  for (const relativePath of pages) {
    const page = await source(relativePath)
    record(
      `${relativePath} uses TwinViewerPage instead of bespoke controls`,
      includesAll(page, ['TwinViewerPage', 'twinViewerModules', 'viewerBundles']),
    )
  }
}

async function assertSharedControlRail() {
  const sidebar = await source('src/components/twin-module/TwinControlSidebar.jsx')
  record(
    'visual secondary rail is query-contract first',
    includesAll(sidebar, [
      'TwinQueryPanel',
      'SelectionPanel',
      'QueryPassportPanel',
      'QueryLibraryPanel',
      'FragmentLayerPanel',
      'queryContract',
      'onOpenQuerySurface',
      'onQueryRun',
      'onQueryReplay',
      'onQueryShareSave',
      'onQuerySharePublish',
    ]),
  )
  record(
    'visual secondary rail does not render retired manual controls',
    !/(City coverage|Layer bundles|Layer visibility|Map presets|3D fidelity)/i.test(sidebar),
    'retired controls must not re-enter the default rail',
  )
}

async function assertSharedQueryController() {
  const controller = await source('src/components/twin-module/query/useTwinQueryController.js')
  record(
    'one frontend TwinQL controller owns run, replay, query-library hydration, and share calls',
    includesAll(controller, [
      '/query-library?',
      '/twin-query',
      '/twin-query/export',
      'buildTwinQueryRequest',
      'buildSqlTwinQueryRequest',
      'buildCurrentQueryRequest',
      'normalizeTwinQueryForViewer',
      'buildTwinQuerySharePayload',
      '/analysis-selections/query',
      'replayAnalysisSelection',
      "selectionKind: 'twinql-selection'",
      'selectionId',
      "type: 'twin:set-semantic-query'",
      "type: 'twin:clear-semantic-query'",
    ]),
  )

  const queryPanel = await source('src/components/twin-module/query/TwinQueryPanel.jsx')
  const sidebar = await source('src/components/twin-module/TwinControlSidebar.jsx')
  const shareModel = await source('src/components/twin-module/query/queryShareModel.js')
  const viewerPage = await source('src/components/twin-module/TwinViewerPage.jsx')
  record(
    'visual query rail supports both structured builder and expert PostGIS SQL modes',
    includesAll(queryPanel, [
      'Builder',
      'SQL',
      'DEFAULT_SQL_TWIN_QUERY',
      'sqlQueryValidation',
      'PostGIS SQL',
    ]) && includesAll(shareModel, [
      'buildSqlTwinQueryRequest',
      'Expert SQL query',
      'sqlQuery: sqlMode',
    ]) && includesAll(await source('src/components/twin-module/semanticQueryClient.js'), [
      "transport: render.transport || transportForViewer(viewerId)",
      'sqlText: sql',
    ]),
  )

  record(
    'visual rail exposes analysis, saved views, and a discrete recorded-activity menu separately from the query builder',
    includesAll(queryPanel, [
      'Save',
      'Download',
      'onExport',
      'onSelectionSave',
    ]) && includesAll(sidebar, [
      'QueryLibraryPanel',
      'Analysis',
      'Recorded activity',
      'Saved views',
      'recordedOpen',
      'groupAnalysisSelections',
    ]),
  )

  record(
    'saved views persist query plus visual state instead of query-only manifests',
    includesAll(shareModel, [
      'QUERY_SHARE_VISUAL_STATE_VERSION',
      'compactVisualState',
      'visualState: compactedVisualState',
      'cameraPolicy',
      'xrSession',
      'layerKeys: compactedVisualState.layerKeys',
      'queryShareVisualSummary',
    ]) && includesAll(viewerPage, [
      'viewerRuntimeState',
      'visualStateSnapshot',
      'visualState: visualStateSnapshot',
      'visualStateFromShare',
      'handleTwinQueryShareReplayWithVisualState',
      "type: 'twin:apply-visual-state'",
      'message.camera',
      'message.cameraPolicy',
      'message.xrSession',
      "type: 'twin:set-xr-mode'",
    ]),
  )

  const historyModel = await source('src/components/twin-module/query/queryHistoryModel.js')
  record(
    'recorded query history is grouped by normalized query signature',
    includesAll(historyModel, ['groupQueryHistoryEvents', 'queryHistorySignature', 'stableHistoryValue']),
  )

  const selectionModel = await source('src/components/twin-module/query/querySelectionModel.js')
  record(
    'analysis selection UI groups repeated persisted selection sets by query hash',
    includesAll(selectionModel, [
      'groupAnalysisSelections',
      'analysisSelectionSourceQuery',
      'queryHash',
      'duplicateCount',
    ]),
  )
}

async function assertTransportBoundary() {
  const client = await source('src/components/twin-module/semanticQueryClient.js')
  record(
    'viewer transport choice is centralized on the client and keeps City 3D tile-backed by default',
    includesAll(client, [
      'transportForViewer',
      "return 'selection-reference'",
      "return 'scene-manifest'",
      "return 'mvt'",
      'normalizeTwinQueryFor3dSelectionReference',
      'VIEWER_QUERY_FEATURE_BUDGETS',
      'maxFeaturesForViewer',
    ]),
  )
  record(
    'GeoJSON compatibility responses use a visible limit-and-inform notice',
    includesAll(client, [
      'geojsonTransportNotice',
      'summary?.transportPolicy',
      'GeoJSON preview',
      'MVT, PMTiles, 3D Tiles, or scene manifests',
    ]),
  )

  const queryPanel = await source('src/components/twin-module/query/TwinQueryPanel.jsx')
  record(
    'query panel informs users when GeoJSON preview limits are active',
    includesAll(queryPanel, [
      'geojsonTransportNotice',
      'geojsonNotice',
      'GeoJSON preview limit active',
      'is-warning',
    ]),
  )

  const repository = await source('server/db/productionTwinStore/twinQueryRepository.mjs')
  record(
    'backend applies a hard GeoJSON preview fuse before returning FeatureCollections',
    includesAll(repository, [
      'DEFAULT_TWIN_QUERY_GEOJSON_LIMIT',
      'MAX_TWIN_QUERY_GEOJSON_LIMIT',
      'geojsonTransportPolicy',
      'transportPolicy',
      'recommendedTransports',
    ]),
  )

  const controller = await source('src/components/twin-module/query/useTwinQueryController.js')
  record(
    'frontend controller only forwards GeoJSON to viewers for explicit geojson transport',
    includesAll(controller, [
      'normalizeResultForViewer',
      "resultTransport(result) === 'geojson'",
      "transport === 'geojson' && result.geojson",
      'primitives',
      'sceneManifest',
      'selectionReference',
      'vectorTileTemplate',
    ]),
  )

  const adapter = await source('server/routes/liveFeature/twinQueryHttpAdapter.mjs')
  record(
    'HTTP adapter strips GeoJSON from product viewer transports',
    includesAll(adapter, [
      "transport === 'mvt'",
      "transport === 'selection-reference'",
      "transport === 'cesium-primitives'",
      "transport === 'scene-manifest'",
      "transport || (result.geojson ? 'geojson' : '')",
      'geojson: undefined',
      'vectorTileTemplate',
      'query.sqlWhere',
      'query.sqlText',
      'primitives',
      'sceneManifest',
      'selectionReference',
    ]),
  )

  const shareRuntime = await source('server/services/baseTwin/viewerRuntimes/viewerShareManifestRuntime.mjs')
  record(
    'shared/saved viewer query loader preserves native transport and drops accidental GeoJSON payloads',
    includesAll(shareRuntime, [
      "viewerId === '3d'",
      "'selection-reference'",
      "'scene-manifest'",
      "'mvt'",
      'responseTransport',
      "responseTransport === 'geojson' && geojson",
    ]),
  )

  const fragmentModel = await source('src/components/twin-module/fragmentWorkspaceModel.js')
  record(
    'fragment workspace query requests use native viewer transports instead of forcing GeoJSON',
    includesAll(fragmentModel, [
      'transportForViewer',
      'visual-fragment-workspace-native',
      'FEATURE_LIMIT_BY_VIEWER',
    ]) && !fragmentModel.includes("transport: 'geojson'"),
  )

  const viewerPage = await source('src/components/twin-module/TwinViewerPage.jsx')
  record(
    'fragment workspace host forwards native handles and only includes combined GeoJSON when fallback features exist',
    includesAll(viewerPage, [
      'primitives',
      'sceneManifest',
      'vectorTileTemplate',
      'combinedGeojson ? { combinedGeojson } : {}',
    ]),
  )

  const mapRuntime = await source('server/services/baseTwin/viewerRuntimes/mapLibre/mapLibreSourceRuntime.mjs')
  record(
    'MapLibre fragment workspace renders answer overlays through vector tile sources when available',
    includesAll(mapRuntime, [
      'fragmentWorkspaceTileTemplate',
      'fragmentWorkspaceVectorSourceIds',
      'installFragmentWorkspaceVectorSources',
      'fragment-workspace-tiles',
    ]),
  )

  const cesiumRuntime = await source('server/services/baseTwin/viewerRuntimes/cityCesiumRuntime.mjs')
  record(
    'City 3D fragment workspace consumes Cesium primitive payloads before GeoJSON fallback',
    includesAll(cesiumRuntime, [
      'getPrimitiveFeatures(fragment.primitives)',
      'featureFromPrimitive',
      'boundsFromPrimitives(fragment.primitives)',
    ]),
  )
}

async function assertRuntimeMessageBoundary() {
  const runtimes = [
    {
      relativePath: 'server/services/baseTwin/viewerRuntimes/mapLibre/mapLibreControlRuntime.mjs',
    },
    {
      relativePath: 'server/services/baseTwin/viewerRuntimes/cityCesiumRuntime.mjs',
    },
    {
      relativePath: 'server/services/baseTwin/viewerRuntimes/civicXrRuntime.mjs',
      sourcePaths: [
        'server/services/baseTwin/viewerRuntimes/civicXrRuntime.mjs',
        'server/services/baseTwin/viewerRuntimes/civicXr/civicXrCameraRuntime.mjs',
        'server/services/baseTwin/viewerRuntimes/civicXr/civicXrHostRuntime.mjs',
        'server/services/baseTwin/viewerRuntimes/civicXr/civicXrSessionRuntime.mjs',
        'server/services/baseTwin/viewerRuntimes/civicXr/civicXrWebXrRuntime.mjs',
      ],
    },
    {
      relativePath: 'server/services/baseTwin/viewerRuntimes/city3dRuntime.mjs',
    },
  ]
  for (const { relativePath, sourcePaths = [relativePath] } of runtimes) {
    const runtime = await combinedSource(sourcePaths)
    record(
      `${relativePath} consumes the shared semantic-query postMessage contract`,
      includesAll(runtime, ['twin:set-semantic-query', 'twin:clear-semantic-query', 'twin:apply-visual-state']),
    )
  }
}


async function assertCivicXrPosePersistence() {
  const runtime = await combinedSource([
    'server/services/baseTwin/viewerRuntimes/civicXrRuntime.mjs',
    'server/services/baseTwin/viewerRuntimes/civicXr/civicXrCameraRuntime.mjs',
    'server/services/baseTwin/viewerRuntimes/civicXr/civicXrHostRuntime.mjs',
    'server/services/baseTwin/viewerRuntimes/civicXr/civicXrSessionRuntime.mjs',
    'server/services/baseTwin/viewerRuntimes/civicXr/civicXrWebXrRuntime.mjs',
  ])
  record(
    'Civic XR saved views capture and restore walk pose plus XR session intent',
    includesAll(runtime, [
      'currentCivicCameraState',
      'applyCivicCameraState',
      'applyXrSessionState',
      'xrSessionState',
      'street-presence',
      'requiresUserGesture',
      'message.visualState',
    ]),
  )
}

async function main() {
  await assertSharedBackendManifest()
  await assertSharedLiveFeatureRoutes()
  await assertSharedFrontendShell()
  await assertSharedControlRail()
  await assertSharedQueryController()
  await assertTransportBoundary()
  await assertRuntimeMessageBoundary()
  await assertCivicXrPosePersistence()

  console.log(JSON.stringify({
    ok: true,
    checks: checks.length,
    message: 'Visual query/manifest boundary is implemented and guarded.',
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message ?? error),
    checks,
  }, null, 2))
  process.exit(1)
})
