import {
  createVisualShareManifest,
  generateInferredBlockSelectionUnits,
  getCitySelectionAreaSummary,
  getCitySelectionUnits,
  getVisualShareManifest,
  listVisualShareManifests,
  updateVisualShareManifestPublication,
} from '../db/productionTwinStore.mjs'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { buildViewerSurfaceManifest } from '../services/baseTwin/viewerContracts/viewerSurfaceManifest.mjs'
import { findCityConfig, getActiveCityConfig } from '../services/cityRegistry.mjs'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function numericArg(name, fallback) {
  const value = argValue(name)
  if (value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function cityFromArgs() {
  const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID
  return cityId ? findCityConfig(cityId) : getActiveCityConfig()
}

const city = cityFromArgs()
assert(city?.id, 'CITY_NOT_FOUND')

let generatedBlocks = null
let blockUnits = await getCitySelectionUnits(city.id, { scope: 'block', limit: 1 })
assert(blockUnits.configured, 'DATABASE_NOT_CONFIGURED')
assert(blockUnits.ok, `BLOCK_SELECTION_READ_FAILED:${blockUnits.error ?? 'unknown'}`)

if (!blockUnits.units.some((unit) => unit.status === 'available-inferred')) {
  generatedBlocks = await generateInferredBlockSelectionUnits(city.id, {
    limit: numericArg('generate-limit', 120),
    minAreaM2: numericArg('min-area-m2', 500),
    maxAreaM2: numericArg('max-area-m2', 500000),
    replace: false,
  })
  assert(generatedBlocks.ok, `BLOCK_GENERATION_FAILED:${generatedBlocks.error ?? 'unknown'}`)
  blockUnits = await getCitySelectionUnits(city.id, { scope: 'block', limit: 1 })
  assert(blockUnits.ok, `BLOCK_SELECTION_RELOAD_FAILED:${blockUnits.error ?? 'unknown'}`)
}

const block = blockUnits.units.find((unit) => unit.status === 'available-inferred')
assert(block, 'INFERRED_BLOCK_SELECTION_UNIT_MISSING')
assert(block.geometry?.type, 'INFERRED_BLOCK_GEOMETRY_MISSING')

const blockSummary = await getCitySelectionAreaSummary(city.id, {
  scope: 'block',
  unitId: block.unitId,
})
assert(blockSummary.ok, `BLOCK_SELECTION_SUMMARY_FAILED:${blockSummary.error ?? 'unknown'}`)
assert(blockSummary.area?.areaKm2 > 0, 'BLOCK_SELECTION_AREA_MISSING')

const surfacePayloads = [
  {
    surface: 'map',
    mode: 'embedded-analyst',
    layerKeys: ['boundary', 'roads', 'buildings'],
  },
  {
    surface: 'municipal3d',
    mode: 'embedded-analyst',
    layerKeys: ['boundary', 'buildings', 'providerOverlays'],
  },
  {
    surface: 'immersive',
    mode: 'public-share',
    layerKeys: ['boundary', 'greenBlue', 'places'],
  },
]

const createdShares = []
for (const surfacePayload of surfacePayloads) {
  const manifest = buildViewerSurfaceManifest({
    cityId: city.id,
    surface: surfacePayload.surface,
    mode: surfacePayload.mode,
  })
  const created = await createVisualShareManifest(city.id, {
    ...surfacePayload,
    title: `Smoke ${surfacePayload.surface} share ${Date.now()}`,
    description: 'Smoke-test persisted viewer manifest.',
    accessPolicy: surfacePayload.surface === 'immersive' ? 'public' : 'session',
    publicationStatus: 'draft',
    selectionScope: 'block',
    selection: {
      scope: 'block',
      unitId: block.unitId,
      label: block.label,
      authority: block.authority,
    },
    manifest,
    createdBy: 'selection-share-smoke',
  })
  assert(created.ok, `SHARE_CREATE_FAILED:${surfacePayload.surface}:${created.error ?? 'unknown'}`)
  assert(created.share?.shareKey, `SHARE_KEY_MISSING:${surfacePayload.surface}`)

  const loaded = await getVisualShareManifest(city.id, created.share.shareKey)
  assert(loaded.ok, `SHARE_GET_FAILED:${surfacePayload.surface}:${loaded.error ?? 'unknown'}`)
  assert(loaded.share?.selectionScope === 'block', `SHARE_SELECTION_SCOPE_MISMATCH:${surfacePayload.surface}`)
  createdShares.push(created.share)
}

const listed = await listVisualShareManifests(city.id, { limit: 10 })
assert(listed.ok, `SHARE_LIST_FAILED:${listed.error ?? 'unknown'}`)
assert(listed.shares.length >= createdShares.length, 'SHARE_LIST_TOO_SMALL')

const queryShare = await createVisualShareManifest(city.id, {
  surface: 'map',
  mode: 'twin-query-manifest',
  title: `Smoke TwinQL share ${Date.now()}`,
  description: 'Smoke-test persisted TwinQL query manifest.',
  accessPolicy: 'session',
  publicationStatus: 'draft',
  selectionScope: 'city',
  selection: { scope: 'city', key: 'city' },
  manifest: {
    kind: 'twin-query-manifest',
    version: '2026-05-22',
    surface: 'map',
    viewerId: 'map',
    query: {
      language: 'twinql-json',
      classes: ['buildings'],
      scope: { key: 'city' },
      render: { mode: 'isolate', maxFeatures: 1000 },
      surface: 'map',
      intent: 'analysis',
    },
    builder: {
      operation: 'union',
      clauses: [
        {
          id: 'clause-1',
          label: 'Clause 1',
          classKey: 'buildings',
          scopeKey: 'city',
          predicates: [{ id: 'predicate-1', field: '', operator: 'exists', value: '', valueMax: '' }],
        },
      ],
    },
  },
  createdBy: 'selection-share-smoke',
})
assert(queryShare.ok, `QUERY_SHARE_CREATE_FAILED:${queryShare.error ?? 'unknown'}`)

const publishedQueryShare = await updateVisualShareManifestPublication(city.id, queryShare.share.shareKey, {
  accessPolicy: 'signed-token',
  publicationStatus: 'published',
  manifestPatch: {
    publication: {
      accessPolicy: 'signed-token',
      publicationStatus: 'published',
      embed: {
        viewerPath: `/live/${city.id}/map?embed=1&shareKey=${queryShare.share.shareKey}`,
        manifestPath: `/api/live/${city.id}/viewer-share-manifests/${queryShare.share.shareKey}`,
      },
      updatedBy: 'selection-share-smoke',
    },
  },
})
assert(publishedQueryShare.ok, `QUERY_SHARE_PUBLISH_FAILED:${publishedQueryShare.error ?? 'unknown'}`)
assert(publishedQueryShare.share?.publicationStatus === 'published', 'QUERY_SHARE_STATUS_NOT_PUBLISHED')
assert(publishedQueryShare.share?.accessPolicy === 'signed-token', 'QUERY_SHARE_ACCESS_POLICY_NOT_SIGNED')

const queryShares = await listVisualShareManifests(city.id, {
  surface: 'map',
  mode: 'twin-query-manifest',
  limit: 10,
})
assert(queryShares.ok, `QUERY_SHARE_LIST_FAILED:${queryShares.error ?? 'unknown'}`)
assert(
  queryShares.shares.some((share) => share.shareKey === queryShare.share.shareKey),
  'QUERY_SHARE_MODE_FILTER_MISSING',
)

console.log(JSON.stringify({
  ok: true,
  cityId: city.id,
  generatedBlocks,
  block: {
    unitId: block.unitId,
    areaKm2: block.areaKm2,
    authority: block.authority,
    status: block.status,
    reviewStatus: block.reviewStatus,
  },
  blockSummary: {
    areaKm2: blockSummary.area.areaKm2,
    featureCount: blockSummary.featureCount,
    layerCounts: blockSummary.layerCounts,
  },
  shares: createdShares.map((share) => ({
    shareKey: share.shareKey,
    surface: share.surface,
    mode: share.mode,
    accessPolicy: share.accessPolicy,
    publicationStatus: share.publicationStatus,
    selectionScope: share.selectionScope,
  })),
  queryShare: {
    shareKey: publishedQueryShare.share.shareKey,
    mode: publishedQueryShare.share.mode,
    accessPolicy: publishedQueryShare.share.accessPolicy,
    publicationStatus: publishedQueryShare.share.publicationStatus,
    selectionScope: publishedQueryShare.share.selectionScope,
  },
}, null, 2))

await closeProductionPool()
