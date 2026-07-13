import assert from 'node:assert/strict'
import fs from 'node:fs'
import { findCityConfig } from '../services/cityRegistry.mjs'
import { withClient } from '../services/ldtOps/dbUtils.mjs'
import {
  enqueueProviderLayerIngestionJob,
  runProviderLayerIngestionJob,
} from '../services/providerLayerIngestionService.mjs'

const cityId = process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
const city = findCityConfig(cityId) ?? {
  id: cityId,
  name: cityId,
  country: 'Unknown',
  countryCode: '',
  region: '',
  lon: -101.2574,
  lat: 21.019,
}
const citySlug = String(city.id).replace(/[^a-z0-9-]/gi, '-').toLowerCase()
const rawSchema = `raw_osm_${String(city.id).replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`
const sourcePath = `/app/runtime-data/extracts/${citySlug}/latest.osm.pbf`
const runToken = `provider-worker-osm-mvt-smoke-${Date.now()}`

async function setupCityAndLayers() {
  await withClient(async (client) => {
    await client.query('BEGIN')
    try {
      await client.query(
        `INSERT INTO public.cities (id, name, country, country_code, region, centroid, enabled, metadata, updated_at)
         VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), true, $8::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, centroid = EXCLUDED.centroid, metadata = public.cities.metadata || EXCLUDED.metadata, updated_at = now()`,
        [city.id, city.name, city.country, city.countryCode ?? '', city.region ?? '', Number(city.lon ?? -101.2574), Number(city.lat ?? 21.019), JSON.stringify({ providerWorkerSmoke: true })],
      )
      await client.query(
        `INSERT INTO ldt_core.cities (id, name, country, country_code, region, centroid, canonical_uri, metadata, updated_at)
         VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, centroid = EXCLUDED.centroid, metadata = ldt_core.cities.metadata || EXCLUDED.metadata, updated_at = now()`,
        [city.id, city.name, city.country, city.countryCode ?? '', city.region ?? '', Number(city.lon ?? -101.2574), Number(city.lat ?? 21.019), `urn:polisplexity:city:${city.id}`, JSON.stringify({ providerWorkerSmoke: true })],
      )
      await client.query(
        `INSERT INTO public.providers (id, name, provider_type, metadata, updated_at)
         VALUES ('open-data-base', 'Open data base twin', 'open-data', $1::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET metadata = public.providers.metadata || EXCLUDED.metadata, updated_at = now()`,
        [JSON.stringify({ providerWorkerSmoke: true })],
      )
      for (const [key, name, family, geometryType] of [
        ['roads', 'Roads', 'mobility', 'LineString'],
        ['buildings', 'Buildings', 'built-fabric', 'Polygon'],
      ]) {
        await client.query(
          `INSERT INTO public.layer_definitions (
             city_id, provider_id, key, name, layer_family, geometry_type,
             authority_status, access_level, source_license, update_frequency,
             semantic_status, metadata, updated_at
           ) VALUES ($1, 'open-data-base', $2, $3, $4, $5, 'open-data', 'public-open-data', 'ODbL', 'on-refresh', 'base', $6::jsonb, now())
           ON CONFLICT (city_id, key) DO UPDATE SET name = EXCLUDED.name, layer_family = EXCLUDED.layer_family, geometry_type = EXCLUDED.geometry_type, metadata = public.layer_definitions.metadata || EXCLUDED.metadata, updated_at = now()`,
          [city.id, key, name, family, geometryType, JSON.stringify({ providerWorkerSmoke: true })],
        )
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

async function rawSchemaReady() {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT to_regclass($1) AS city_roads,
              to_regclass($2) AS city_buildings,
              to_regclass($3) AS city_objects`,
      [`${rawSchema}.city_roads`, `${rawSchema}.city_buildings`, `${rawSchema}.city_objects`],
    )
    return Boolean(result.rows[0]?.city_roads && result.rows[0]?.city_buildings && result.rows[0]?.city_objects)
  })
}

await setupCityAndLayers()
let osm = { skipped: true, reason: 'source-pbf-or-raw-schema-not-present' }
if (fs.existsSync(sourcePath) || await rawSchemaReady()) {
  const osmQueued = await enqueueProviderLayerIngestionJob(city, 'roads', {
    action: 'osm-local-extract',
    sourceFormat: 'raw-osm-pbf',
    sourceUri: `file://${sourcePath}`,
    submittedBy: 'provider-worker-osm-mvt-smoke',
    idempotencyKey: `${runToken}-osm`,
    metadata: {
      rawSchema,
      sourceSlug: `${citySlug}-osm-pbf-smoke`,
      sourcePath,
    },
  })
  assert.equal(osmQueued.ok, true, osmQueued.error || 'OSM_LOCAL_EXTRACT_QUEUE_FAILED')
  const osmRun = await runProviderLayerIngestionJob(osmQueued.jobId, { workerId: 'provider-worker-osm-mvt-smoke' })
  assert.equal(osmRun.ok, true, osmRun.error || 'OSM_LOCAL_EXTRACT_RUN_FAILED')
  assert.equal(osmRun.stats.source, `${citySlug}-osm-pbf-smoke`, 'OSM_SOURCE_SLUG_NOT_PARAMETRIC')
  assert.ok(osmRun.stats.promotedFeatureCount > 0, 'OSM_LOCAL_EXTRACT_PROMOTED_NO_FEATURES')
  osm = {
    skipped: false,
    jobId: osmRun.jobId,
    promotedFeatureCount: osmRun.stats.promotedFeatureCount,
    promotedLayers: osmRun.stats.promotedLayers,
  }
}

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
assert.ok(mvtRun.stats.densityGrid?.cellCount >= 0, 'MVT_CACHE_REFRESH_DENSITY_GRID_MISSING')
assert.ok(mvtRun.stats.version?.startsWith(`mvt-${city.id}-`), 'MVT_CACHE_REFRESH_VERSION_MISSING')

console.log(JSON.stringify({
  ok: true,
  cityId: city.id,
  osm,
  mvt: {
    jobId: mvtRun.jobId,
    version: mvtRun.stats.version,
    densityGrid: mvtRun.stats.densityGrid,
  },
}, null, 2))
