import assert from 'node:assert/strict'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import { clearCitySourcePlanOverride, getCitySourcePlan, saveCitySourcePlanOverride } from '../services/ldtOps/citySourcePlanService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'

try {
  await runProductionMigrations()
  const baseline = await getCitySourcePlan(cityId)
  const previousOverride = baseline.override
  const override = {
    rawSchema: `raw_osm_${cityId.replace(/[^a-z0-9]+/gi, '_')}_override_smoke`,
    sourceSlug: `${baseline.sourcePlan.preset.citySlug}-osm-pbf-smoke`,
    sourceUrl: 'https://example.test/open-data/source.osm.pbf',
    sourcePath: `/app/runtime-data/extracts/${baseline.sourcePlan.preset.citySlug}/smoke-latest.osm.pbf`,
    overtureRelease: '2099-01-01.0',
    providerOverride: {
      sourcePackageSelectionSmoke: true,
      operatorSelected: true,
    },
    notes: 'city-source-plan-smoke',
  }

  try {
    await saveCitySourcePlanOverride(cityId, override)
    const plan = await getCitySourcePlan(cityId)
    assert.equal(plan.ok, true)
    assert.equal(plan.cityId, cityId)
    assert.equal(plan.sourcePlan.kind, 'city-open-data-bootstrap')
    assert.equal(plan.sourcePlan.cityId, cityId)
    assert.equal(plan.sourcePlan.preset.rawSchema, override.rawSchema)
    assert.equal(plan.sourcePlan.preset.sourceSlug, override.sourceSlug)
    assert.equal(plan.sourcePlan.preset.sourceUrl, override.sourceUrl)
    assert.equal(plan.sourcePlan.preset.sourcePath, override.sourcePath)
    assert.equal(plan.sourcePlan.preset.overtureRelease, override.overtureRelease)
    assert.equal(plan.sourcePlan.preset.providerOverride.sourcePackageSelectionSmoke, true)
    assert.ok(Array.isArray(plan.providerPackages), 'PROVIDER_PACKAGES_REQUIRED')
    const osmPackage = plan.providerPackages.find((item) => item.action === 'osm-local-extract')
    const overtureBuildings = plan.providerPackages.find((item) => item.action === 'overture-buildings')
    const overtureRoads = plan.providerPackages.find((item) => item.action === 'overture-roads')
    assert.ok(osmPackage, 'OSM_PACKAGE_REQUIRED')
    assert.ok(overtureBuildings, 'OVERTURE_BUILDINGS_PACKAGE_REQUIRED')
    assert.ok(overtureRoads, 'OVERTURE_ROADS_PACKAGE_REQUIRED')
    assert.equal(osmPackage.sourceUri, `file://${override.sourcePath}`)
    assert.equal(osmPackage.sourceVersion, override.sourceSlug)
    assert.equal(osmPackage.metadata.rawSchema, override.rawSchema)
    assert.equal(osmPackage.metadata.providerOverride.operatorSelected, true)
    assert.equal(overtureBuildings.release, override.overtureRelease)
    assert.equal(overtureRoads.release, override.overtureRelease)
    assert.deepEqual(plan.extractorKeys, ['terrain-dem', 'weather-field', 'hydrology-grid'])

    console.log(JSON.stringify({
      ok: true,
      cityId,
      ready: plan.ready,
      overrideApplied: plan.override?.applied ?? false,
      providerActions: plan.providerPackages.map((item) => item.action),
      checks: plan.checks,
    }, null, 2))
  } finally {
    if (previousOverride) {
      await saveCitySourcePlanOverride(cityId, previousOverride)
    } else {
      await clearCitySourcePlanOverride(cityId)
    }
  }
} finally {
  await closeProductionPool()
}
