import assert from 'node:assert/strict'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { runProductionMigrations } from '../db/migrate.mjs'
import {
  indicatorAcceptanceSummary,
  runU4sscLocalAcceptance,
} from '../services/indicatorAcceptance/indicatorAcceptanceService.mjs'

const cityId = process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'

try {
  await runProductionMigrations()
  const result = await runU4sscLocalAcceptance({ cityId })
  assert.equal(result.total, 91, 'U4SSC_ACCEPTANCE_CASE_COUNT_MISMATCH')
  assert.equal(result.failed, 0, `U4SSC_ACCEPTANCE_FAILURES:${JSON.stringify(result.failures)}`)
  assert.equal(result.passed, 91, 'U4SSC_ACCEPTANCE_NOT_ALL_PASSED')
  assert.ok(Number(result.patterns['self-indicator'] ?? 0) > 0, 'U4SSC_SELF_INDICATOR_PATTERN_MISSING')
  assert.ok(Number(result.patterns['related-subject'] ?? 0) > 0, 'U4SSC_RELATED_SUBJECT_PATTERN_MISSING')
  assert.ok(Number(result.patterns['city-context'] ?? 0) > 0, 'U4SSC_CITY_CONTEXT_PATTERN_MISSING')
  assert.equal(Number(result.patterns.compound ?? 0), 1, 'U4SSC_COMPOUND_PATTERN_MISMATCH')
  const summary = await indicatorAcceptanceSummary({ cityId })
  assert.equal(summary.indicators, 91, 'U4SSC_ACCEPTANCE_INDICATOR_COVERAGE_MISMATCH')
  assert.equal(summary.localPassed, 91, 'U4SSC_ACCEPTANCE_PERSISTED_PASS_COUNT_MISMATCH')
  console.log(JSON.stringify({ ok: true, cityId, result, summary }, null, 2))
} finally {
  await closeProductionPool()
}
