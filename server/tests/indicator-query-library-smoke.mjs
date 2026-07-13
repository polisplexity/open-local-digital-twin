import assert from 'node:assert/strict'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { runProductionMigrations } from '../db/migrate.mjs'
import { getCityQueryLibrary } from '../services/queryLibrary/queryLibraryService.mjs'

const cityId = process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'

try {
  await runProductionMigrations()
  const library = await getCityQueryLibrary(cityId, { surface: 'map', limit: 100 })
  const presets = library.buckets?.queryPresets?.items ?? []
  const acceptance = presets.filter((entry) => entry.acceptance?.catalogKey === 'u4ssc')
  assert.equal(acceptance.length, 91, 'U4SSC_QUERY_LIBRARY_PRESET_COUNT_MISMATCH')
  assert.equal(
    acceptance.filter((entry) => entry.acceptance.localStatus === 'passed').length,
    91,
    'U4SSC_QUERY_LIBRARY_LOCAL_STATUS_MISMATCH',
  )
  assert.equal(
    acceptance.filter((entry) => (
      entry.acceptance.dataPlatformStatus === 'passed'
      && entry.acceptance.cipStatus === 'passed'
      && entry.acceptance.roundtripStatus === 'passed'
    )).length,
    91,
    'U4SSC_QUERY_LIBRARY_EXTERNAL_STATUS_MISMATCH',
  )
  assert.equal(
    acceptance.filter((entry) => entry.builder && entry.sqlText?.startsWith('SELECT')).length,
    91,
    'U4SSC_QUERY_LIBRARY_EQUIVALENT_QUERY_MISSING',
  )
  const compound = acceptance.find((entry) => entry.acceptance.pattern === 'compound')
  const related = compound?.builder?.clauses?.[0]?.predicates?.find((entry) => entry.kind === 'related-subject')
  assert.equal(related?.indicators?.length, 3, 'U4SSC_COMPOUND_PRESET_INDICATOR_COUNT_MISMATCH')
  console.log(JSON.stringify({
    ok: true,
    cityId,
    totalPresets: presets.length,
    u4sscPresets: acceptance.length,
    compoundPreset: compound?.id ?? null,
    acceptanceSummary: library.buckets.queryPresets.groups
      .find((entry) => entry.key === 'indicator-acceptance')?.summary ?? {},
  }, null, 2))
} finally {
  await closeProductionPool()
}
