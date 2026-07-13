import assert from 'node:assert/strict'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import { withClient } from '../services/ldtOps/dbUtils.mjs'
import { createWorkflowRun } from '../services/ldtOpsService.mjs'
import { evaluateCityBoundaryQualityGate, getCitySourcePlan, repairCityBoundaryFromCurrentGate } from '../services/ldtOps/citySourcePlanService.mjs'

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

const city = {
  id: 'boundary-gate-smoke',
  name: 'Boundary Gate Smoke',
  country: 'Testland',
  countryCode: 'ts',
  region: 'Test Region',
  lon: -101.25,
  lat: 21.02,
}
const bbox = [-101.35, 20.94, -101.15, 21.12]

function bboxMultiPolygonSql() {
  return `ST_Multi(ST_MakeEnvelope(${bbox.join(',')}, 4326))`
}

const bootstrapInput = {
  sourcePlan: {
    kind: 'city-open-data-bootstrap',
    posture: 'open-data-native',
    target: `${city.id}-city-open-data-bootstrap`,
    cityId: city.id,
    preset: {
      cityId: city.id,
      rawSchema: 'raw_osm_boundary_gate_smoke',
      sourceSlug: 'boundary-gate-smoke-osm-pbf',
      sourcePath: '/app/runtime-data/extracts/boundary-gate-smoke/latest.osm.pbf',
      overtureRelease: '2026-06-17.0',
    },
  },
  providerPackages: [],
  extractorKeys: [],
  refreshViewerAggregates: true,
  refreshConsolidation: true,
  refreshTwinQuerySurfaces: true,
  validationMode: 'city-open-data-bootstrap',
}

try {
  await runProductionMigrations()
  await withClient(async (client) => {
    await client.query('BEGIN')
    try {
      await client.query(
        `INSERT INTO public.cities (id, name, country, country_code, region, centroid, enabled, metadata, updated_at)
         VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), true, $8::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, centroid = EXCLUDED.centroid, metadata = EXCLUDED.metadata, updated_at = now()`,
        [city.id, city.name, city.country, city.countryCode, city.region, city.lon, city.lat, JSON.stringify({ smoke: true })],
      )
      await client.query(
        `INSERT INTO ldt_core.cities (id, name, country, country_code, region, centroid, canonical_uri, metadata, updated_at)
         VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, centroid = EXCLUDED.centroid, metadata = EXCLUDED.metadata, updated_at = now()`,
        [city.id, city.name, city.country, city.countryCode, city.region, city.lon, city.lat, `urn:polisplexity:city:${city.id}`, JSON.stringify({ smoke: true })],
      )
      await client.query(
        `INSERT INTO public.providers (id, name, provider_type, metadata, updated_at)
         VALUES ('open-data-base', 'Open data base twin', 'open-data', $1::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET metadata = public.providers.metadata || EXCLUDED.metadata, updated_at = now()`,
        [JSON.stringify({ boundaryGateSmoke: true })],
      )
      await client.query(`DELETE FROM public.city_boundaries WHERE city_id = $1`, [city.id])
      await client.query(`DELETE FROM ldt_core.city_boundaries WHERE city_id = $1`, [city.id])
      await client.query(
        `INSERT INTO ldt_core.city_boundaries (city_id, boundary_role, authority_status, geom, properties)
         VALUES ($1, 'test-bootstrap-bbox', 'open-data', ${bboxMultiPolygonSql()}, $2::jsonb)`,
        [city.id, JSON.stringify({ source: 'phase14-boundary-gate-smoke', bbox })],
      )
      const layers = [
        ['roads', 'Roads', 'mobility', 'LineString'],
        ['buildings', 'Buildings', 'built-fabric', 'Polygon'],
        ['overture-buildings', 'Overture Buildings', 'built-fabric-candidate', 'Polygon'],
      ]
      for (const [key, name, family, geometryType] of layers) {
        await client.query(
          `INSERT INTO public.layer_definitions (
             city_id, provider_id, key, name, layer_family, geometry_type,
             authority_status, access_level, source_license, update_frequency,
             semantic_status, metadata, updated_at
           ) VALUES ($1, 'open-data-base', $2, $3, $4, $5, 'open-data', 'public-open-data', 'ODbL', 'on-refresh', 'base', $6::jsonb, now())
           ON CONFLICT (city_id, key) DO UPDATE SET name = EXCLUDED.name, layer_family = EXCLUDED.layer_family, geometry_type = EXCLUDED.geometry_type, metadata = EXCLUDED.metadata, updated_at = now()`,
          [city.id, key, name, family, geometryType, JSON.stringify({ label: name, smoke: true })],
        )
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })

  const gate = await evaluateCityBoundaryQualityGate(city.id)
  assert.equal(gate.passed, false, 'TECHNICAL_BBOX_GATE_SHOULD_FAIL')
  assert.equal(gate.code, 'CITY_BOUNDARY_LOOKS_LIKE_TECHNICAL_BBOX')

  const plan = await getCitySourcePlan(city.id)
  assert.equal(plan.ready, false, 'SOURCE_PLAN_SHOULD_BLOCK_BOOTSTRAP_WHEN_BOUNDARY_GATE_FAILS')
  assert.equal(plan.boundaryGate.code, 'CITY_BOUNDARY_LOOKS_LIKE_TECHNICAL_BBOX')

  const blocked = await createWorkflowRun({
    workflowKey: 'phase14-open-data-workflow-runner',
    cityId: city.id,
    input: bootstrapInput,
    requestedBy: 'phase14-boundary-quality-gate-smoke',
    requestedByKind: 'system-smoke',
    triggerKind: 'smoke-test',
  })
  assert.equal(blocked.ok, false, 'CITY_BOOTSTRAP_SHOULD_BE_BLOCKED_BY_BOUNDARY_GATE')
  assert.match(blocked.error, /CITY_BOUNDARY_QUALITY_GATE_FAILED:CITY_BOUNDARY_LOOKS_LIKE_TECHNICAL_BBOX/)

  const bypassed = await createWorkflowRun({
    workflowKey: 'phase14-open-data-workflow-runner',
    cityId: city.id,
    input: { ...bootstrapInput, boundaryGateBypass: true },
    requestedBy: 'phase14-boundary-quality-gate-smoke',
    requestedByKind: 'system-smoke',
    triggerKind: 'smoke-test',
  })
  assert.equal(bypassed.ok, true, bypassed.error || 'BOUNDARY_GATE_BYPASS_SHOULD_CREATE_RUN')
  assert.equal(bypassed.run.input.boundaryGate.code, 'CITY_BOUNDARY_GATE_BYPASSED')

  const repaired = await repairCityBoundaryFromCurrentGate(city.id, { note: 'Smoke accepts current bbox after gate failure.' })
  assert.equal(repaired.ok, true, 'BOUNDARY_REPAIR_SHOULD_RETURN_OK')
  assert.equal(repaired.repaired, true, 'BOUNDARY_REPAIR_SHOULD_WRITE_ACCEPTED_BOUNDARY')
  assert.equal(repaired.boundaryGate.passed, true, repaired.boundaryGate.code || 'BOUNDARY_REPAIR_SHOULD_PASS_GATE')
  const repairedPlan = await getCitySourcePlan(city.id)
  assert.equal(repairedPlan.ready, true, 'SOURCE_PLAN_SHOULD_BE_READY_AFTER_BOUNDARY_REPAIR')

  console.log(JSON.stringify({
    ok: true,
    cityId: city.id,
    failedGate: gate.code,
    repairedGate: repaired.boundaryGate.code,
    blockedError: blocked.error,
    bypassRunId: bypassed.run.id,
  }, null, 2))
} finally {
  await closeProductionPool()
}
