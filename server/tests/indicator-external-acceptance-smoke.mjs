import assert from 'node:assert/strict'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { runProductionMigrations } from '../db/migrate.mjs'
import { indicatorAcceptanceSummary } from '../services/indicatorAcceptance/indicatorAcceptanceService.mjs'
import { runU4sscExternalAcceptance } from '../services/indicatorAcceptance/indicatorAcceptanceExternalService.mjs'

const cityId = process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
const limit = Number(process.env.U4SSC_EXTERNAL_ACCEPTANCE_LIMIT || 0)

try {
  await runProductionMigrations()
  const result = await runU4sscExternalAcceptance({ cityId, limit })
  const expected = limit > 0 ? limit : 91
  assert.equal(result.requested, expected, 'U4SSC_EXTERNAL_REQUEST_COUNT_MISMATCH')
  assert.equal(result.dataPlatformPassed, expected, 'U4SSC_DATA_PLATFORM_PASS_COUNT_MISMATCH')
  assert.equal(result.cipPassed, expected, 'U4SSC_CIP_PASS_COUNT_MISMATCH')
  assert.equal(result.roundtripPassed, expected, 'U4SSC_ROUNDTRIP_PASS_COUNT_MISMATCH')
  assert.equal(result.ok, true, `U4SSC_EXTERNAL_ACCEPTANCE_FAILED:${JSON.stringify(result.failures)}`)
  const summary = await indicatorAcceptanceSummary({ cityId })
  console.log(JSON.stringify({ ok: true, cityId, result, summary }, null, 2))
} finally {
  await closeProductionPool()
}
