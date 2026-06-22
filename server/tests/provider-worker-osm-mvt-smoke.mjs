import assert from 'node:assert/strict'
import { findCityConfig } from '../services/cityRegistry.mjs'
import {
  enqueueProviderLayerIngestionJob,
  runProviderLayerIngestionJob,
} from '../services/providerLayerIngestionService.mjs'

const city = findCityConfig('kharkiv')
assert.ok(city, 'KHARKIV_CITY_CONFIG_MISSING')
const runToken = `provider-worker-osm-mvt-smoke-${Date.now()}`

const osmQueued = await enqueueProviderLayerIngestionJob(city, 'roads', {
  action: 'osm-local-extract',
  sourceFormat: 'raw-osm-pbf',
  sourceUri: 'file:///app/runtime-data/extracts/kharkiv/ukraine-latest.osm.pbf',
  submittedBy: 'provider-worker-osm-mvt-smoke',
  idempotencyKey: `${runToken}-osm`,
  metadata: {
    rawSchema: 'raw_osm_kharkiv',
    sourceSlug: 'kharkiv-geofabrik-osm-pbf-smoke',
    sourceUrl: 'https://download.geofabrik.de/europe/ukraine-latest.osm.pbf',
    sourcePath: '/app/runtime-data/extracts/kharkiv/ukraine-latest.osm.pbf',
  },
})
assert.equal(osmQueued.ok, true, osmQueued.error || 'OSM_LOCAL_EXTRACT_QUEUE_FAILED')
const osmRun = await runProviderLayerIngestionJob(osmQueued.jobId, { workerId: 'provider-worker-osm-mvt-smoke' })
assert.equal(osmRun.ok, true, osmRun.error || 'OSM_LOCAL_EXTRACT_RUN_FAILED')
assert.equal(osmRun.stats.source, 'kharkiv-geofabrik-osm-pbf-smoke', 'OSM_SOURCE_SLUG_NOT_PARAMETRIC')
assert.ok(osmRun.stats.promotedFeatureCount > 0, 'OSM_LOCAL_EXTRACT_PROMOTED_NO_FEATURES')
assert.ok(osmRun.stats.promotedLayers?.roads > 0, 'OSM_LOCAL_EXTRACT_ROADS_MISSING')

const mvtQueued = await enqueueProviderLayerIngestionJob(city, 'buildings', {
  action: 'mvt-cache-refresh',
  sourceFormat: 'viewer-cache-refresh',
  submittedBy: 'provider-worker-osm-mvt-smoke',
  idempotencyKey: `${runToken}-mvt`,
  metadata: { gridKey: 'city-density-2km', cellSizeM: 2000 },
})
assert.equal(mvtQueued.ok, true, mvtQueued.error || 'MVT_CACHE_REFRESH_QUEUE_FAILED')
const mvtRun = await runProviderLayerIngestionJob(mvtQueued.jobId, { workerId: 'provider-worker-osm-mvt-smoke' })
assert.equal(mvtRun.ok, true, mvtRun.error || 'MVT_CACHE_REFRESH_RUN_FAILED')
assert.ok(mvtRun.stats.densityGrid?.cellCount > 0, 'MVT_CACHE_REFRESH_DENSITY_GRID_EMPTY')
assert.ok(mvtRun.stats.version?.startsWith('mvt-kharkiv-'), 'MVT_CACHE_REFRESH_VERSION_MISSING')

console.log(JSON.stringify({
  ok: true,
  osm: {
    jobId: osmRun.jobId,
    promotedFeatureCount: osmRun.stats.promotedFeatureCount,
    promotedLayers: osmRun.stats.promotedLayers,
  },
  mvt: {
    jobId: mvtRun.jobId,
    version: mvtRun.stats.version,
    densityGrid: mvtRun.stats.densityGrid,
  },
}, null, 2))
