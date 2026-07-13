import { closeProductionPool } from '../db/postgisPool.mjs'
import { runProductionMigrations } from '../db/migrate.mjs'
import {
  indicatorAcceptanceSummary,
  prepareU4sscAcceptanceData,
  runU4sscLocalAcceptance,
} from '../services/indicatorAcceptance/indicatorAcceptanceService.mjs'
import { runU4sscExternalAcceptance } from '../services/indicatorAcceptance/indicatorAcceptanceExternalService.mjs'

function argument(name, fallback = '') {
  const prefix = `--${name}=`
  const value = process.argv.find((entry) => entry.startsWith(prefix))
  return value ? value.slice(prefix.length) : fallback
}

const cityId = argument('city', process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato')
const skipSeed = process.argv.includes('--skip-seed')
const external = process.argv.includes('--external') || process.argv.includes('--external-only')
const externalOnly = process.argv.includes('--external-only')
const externalLimit = Number(argument('external-limit', '0')) || 0
const externalConcurrency = Number(argument('external-concurrency', '2')) || 2

try {
  await runProductionMigrations()
  const seed = skipSeed || externalOnly ? null : await prepareU4sscAcceptanceData({ cityId })
  const local = externalOnly ? null : await runU4sscLocalAcceptance({ cityId })
  const externalResult = external ? await runU4sscExternalAcceptance({
    cityId,
    limit: externalLimit,
    concurrency: externalConcurrency,
  }) : null
  const summary = await indicatorAcceptanceSummary({ cityId })
  const ok = Boolean((local?.ok ?? true) && (externalResult?.ok ?? true))
  console.log(JSON.stringify({ ok, cityId, seed, local, external: externalResult, summary }, null, 2))
  if (!ok) process.exitCode = 1
} finally {
  await closeProductionPool()
}
