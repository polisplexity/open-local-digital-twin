import assert from 'node:assert/strict'

import { refreshLdtAfterProviderIngestion } from '../services/providerLayerIngestion/ldtPostIngestionBridge.mjs'
import { withClient } from '../services/ldtOps/dbUtils.mjs'

const cityId = process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'

const before = await withClient(async (client) => {
  const features = await client.query(
    `SELECT COALESCE(ld.key, cf.feature_type) AS layer_key, count(*)::int AS count
     FROM public.city_features cf
     LEFT JOIN public.layer_definitions ld ON ld.id = cf.layer_id
     WHERE cf.city_id = $1
     GROUP BY COALESCE(ld.key, cf.feature_type)
     ORDER BY 1`,
    [cityId],
  )
  return Object.fromEntries(features.rows.map((row) => [row.layer_key, row.count]))
})

assert.ok(Number(before.buildings ?? 0) > 0 || Number(before['overture-buildings'] ?? 0) > 0, 'BRIDGE_SMOKE_REQUIRES_CITY_FEATURE_BUILDINGS')
assert.ok(Number(before.roads ?? 0) > 0, 'BRIDGE_SMOKE_REQUIRES_CITY_FEATURE_ROADS')

const bridge = await refreshLdtAfterProviderIngestion({
  cityId,
  action: 'overture-buildings',
  body: { source: 'phase14-post-ingestion-bridge-smoke' },
})

assert.equal(bridge.skipped, false, 'BRIDGE_SHOULD_NOT_SKIP_FEATURE_ACTION')
assert.equal(bridge.reingest?.ok, true, bridge.reingest?.error || 'BRIDGE_REINGEST_FAILED')
assert.equal(bridge.consolidate?.ok, true, bridge.consolidate?.error || 'BRIDGE_CONSOLIDATE_FAILED')
assert.equal(bridge.viewerAggregates?.ok, true, bridge.viewerAggregates?.error || 'BRIDGE_VIEWER_AGGREGATES_FAILED')

const after = await withClient(async (client) => {
  const entities = await client.query(
    `SELECT entity_type, count(*)::int AS count
     FROM ldt_core.city_entities
     WHERE city_id = $1
       AND properties->>'phase' = 'phase-3-consolidation'
     GROUP BY entity_type
     ORDER BY 1`,
    [cityId],
  )
  const queryObjects = await client.query(
    `SELECT layer_key, count(*)::int AS count
     FROM ldt_query.city_objects
     WHERE city_id = $1
     GROUP BY layer_key
     ORDER BY 1`,
    [cityId],
  )
  const summary = await client.query(
    `SELECT payload
     FROM ldt_viewer.city_summary_cache
     WHERE city_id = $1
       AND summary_key = 'default'
     ORDER BY refreshed_at DESC
     LIMIT 1`,
    [cityId],
  )
  return {
    entities: Object.fromEntries(entities.rows.map((row) => [row.entity_type, row.count])),
    queryObjects: Object.fromEntries(queryObjects.rows.map((row) => [row.layer_key, row.count])),
    summary: summary.rows[0]?.payload ?? null,
  }
})

assert.ok(Number(after.entities.building ?? 0) > 0, 'BRIDGE_LDT_BUILDINGS_MISSING')
assert.ok(Number(after.entities.road ?? 0) > 0, 'BRIDGE_LDT_ROADS_MISSING')
assert.ok(Number(after.queryObjects.buildings ?? 0) > 0, 'BRIDGE_QUERY_BUILDINGS_MISSING')
assert.ok(Number(after.queryObjects.roads ?? 0) > 0, 'BRIDGE_QUERY_ROADS_MISSING')
assert.equal(Number(after.queryObjects.buildings ?? 0), Number(before.buildings ?? 0) + Number(before['overture-buildings'] ?? 0), 'BRIDGE_QUERY_BUILDINGS_SHOULD_MATCH_PROVIDER_FEATURES')
assert.equal(Number(after.queryObjects.roads ?? 0), Number(before.roads ?? 0), 'BRIDGE_QUERY_ROADS_SHOULD_MATCH_PROVIDER_FEATURES')
assert.equal(Number(after.summary?.inventory?.buildings ?? 0), Number(before.buildings ?? 0) + Number(before['overture-buildings'] ?? 0), 'BRIDGE_VIEWER_SUMMARY_BUILDINGS_SHOULD_MATCH_PROVIDER_FEATURES')
assert.equal(Number(after.summary?.inventory?.roads ?? 0), Number(before.roads ?? 0), 'BRIDGE_VIEWER_SUMMARY_ROADS_SHOULD_MATCH_PROVIDER_FEATURES')

console.log(JSON.stringify({
  ok: true,
  cityId,
  before,
  bridge: {
    reingestFeatureCount: bridge.reingest.cities?.[0]?.sourceFeatureCount ?? null,
    entityCounts: bridge.consolidate.cities?.[0]?.entityCounts ?? null,
    viewerBuildingCount: bridge.viewerAggregates.cities?.[0]?.buildingCount ?? null,
    viewerRoadCount: bridge.viewerAggregates.cities?.[0]?.roadCount ?? null,
  },
  after,
}, null, 2))
