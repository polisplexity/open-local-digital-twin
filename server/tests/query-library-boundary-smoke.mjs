import assert from 'node:assert/strict'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import { getCityQueryLibrary } from '../services/queryLibrary/queryLibraryService.mjs'

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
const surface = argValue('surface') || 'map'

try {
  await runProductionMigrations()
  const library = await getCityQueryLibrary(cityId, { surface, limit: 12 })
  assert.equal(library.cityId, cityId)
  assert.equal(library.surface, surface)
  assert.ok(library.taxonomy.analysisSelections.includes('Persisted city-object selections'), 'ANALYSIS_TAXONOMY_MISSING')
  assert.ok(library.taxonomy.queryPresets.includes('Named reusable query definitions'), 'QUERY_PRESET_TAXONOMY_MISSING')
  assert.ok(library.taxonomy.recordedActivity.includes('Audit/replay history'), 'RECORDED_TAXONOMY_MISSING')
  assert.ok(library.taxonomy.savedViews.includes('Visual manifests'), 'SAVED_VIEW_TAXONOMY_MISSING')
  assert.equal(library.buckets.queryPresets.persistence, 'server.config.queryPresets')
  assert.equal(library.buckets.queryPresets.primaryAction, 'apply-query-preset')
  assert.equal(library.buckets.analysisSelections.persistence, 'ldt_analysis.selection_sets')
  assert.equal(library.buckets.recordedActivity.persistence, 'ldt_viewer.semantic_query_events')
  assert.equal(library.buckets.savedViews.persistence, 'ldt_viewer.visual_share_manifests')
  assert.notEqual(library.buckets.analysisSelections.primaryAction, library.buckets.savedViews.primaryAction)
  assert.notEqual(library.buckets.recordedActivity.primaryAction, library.buckets.analysisSelections.primaryAction)

  if (cityId === 'tallinn') {
    const tallinnPreset = library.buckets.queryPresets.items.find((preset) => preset.id === 'tallinn-walk-bike-network')
    assert.ok(tallinnPreset, 'TALLINN_WALK_BIKE_PRESET_MISSING')
    assert.equal(tallinnPreset.title, 'Tallinn walk/bike network')
    assert.equal(tallinnPreset.language, 'postgis-sql')
    assert.ok(tallinnPreset.sqlWhere.includes("semantic_class = 'roads'"), 'TALLINN_PRESET_SQL_MISSING')
  }

  console.log(JSON.stringify({
    ok: true,
    cityId,
    surface,
    summary: library.summary,
    buckets: Object.fromEntries(Object.entries(library.buckets).map(([key, bucket]) => [
      key,
      {
        label: bucket.label,
        persistence: bucket.persistence,
        count: bucket.count,
        primaryAction: bucket.primaryAction,
      },
    ])),
  }, null, 2))
} finally {
  await closeProductionPool()
}
