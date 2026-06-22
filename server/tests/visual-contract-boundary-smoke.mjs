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
    'src/app/(apps layout)/analytical-map/page.jsx',
    'src/app/(apps layout)/city-3d/page.jsx',
    'src/app/(apps layout)/civic-xr/page.jsx',
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
      'AreaContextPanel',
      'SelectionPanel',
      'queryContract',
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
    'one frontend TwinQL controller owns run, replay, history, and share calls',
    includesAll(controller, [
      '/twin-query-events?',
      '/viewer-share-manifests?',
      '/twin-query',
      'buildTwinQueryRequest',
      'normalizeTwinQueryForViewer',
      'buildTwinQuerySharePayload',
      '/analysis-selections?',
      '/analysis-selections/query',
      'replayAnalysisSelection',
      'selectionId',
      "type: 'twin:set-semantic-query'",
      "type: 'twin:clear-semantic-query'",
    ]),
  )

  const queryPanel = await source('src/components/twin-module/query/TwinQueryPanel.jsx')
  const sidebar = await source('src/components/twin-module/TwinControlSidebar.jsx')
  record(
    'visual rail exposes fragment, recorded, and saved-view query library separately from the query builder',
    includesAll(queryPanel, [
      'Save fragment',
      'onSelectionSave',
    ]) && includesAll(sidebar, [
      'QueryLibraryPanel',
      'Fragments',
      'Recorded',
      'Views',
      'groupAnalysisSelections',
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
    'viewer transport choice is centralized on the client',
    includesAll(client, [
      'transportForViewer',
      "return 'cesium-primitives'",
      "return 'scene-manifest'",
      "return 'mvt'",
      'maxFeaturesForViewer',
    ]),
  )

  const adapter = await source('server/routes/liveFeature/twinQueryHttpAdapter.mjs')
  record(
    'HTTP adapter shapes all viewer-specific TwinQL transports',
    includesAll(adapter, [
      "transport === 'mvt'",
      "transport === 'cesium-primitives'",
      "transport === 'scene-manifest'",
      'vectorTileTemplate',
      'primitives',
      'sceneManifest',
    ]),
  )
}

async function assertRuntimeMessageBoundary() {
  const runtimes = [
    'server/services/baseTwin/viewerRuntimes/mapLibre/mapLibreControlRuntime.mjs',
    'server/services/baseTwin/viewerRuntimes/cityCesiumRuntime.mjs',
    'server/services/baseTwin/viewerRuntimes/civicXrRuntime.mjs',
  ]
  for (const relativePath of runtimes) {
    const runtime = await source(relativePath)
    record(
      `${relativePath} consumes the shared semantic-query postMessage contract`,
      includesAll(runtime, ['twin:set-semantic-query', 'twin:clear-semantic-query']),
    )
  }
}

async function main() {
  await assertSharedBackendManifest()
  await assertSharedLiveFeatureRoutes()
  await assertSharedFrontendShell()
  await assertSharedControlRail()
  await assertSharedQueryController()
  await assertTransportBoundary()
  await assertRuntimeMessageBoundary()

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
