import { ingestBaseTwinPayload } from './productionTwinStore.mjs'
import {
  getCityCacheStatus,
  readCachedCityBasePayload,
} from '../services/baseTwinService.mjs'
import { getCityRegistry } from '../services/cityRegistry.mjs'

async function ingestCachedCity(cityId) {
  const payload = readCachedCityBasePayload(cityId, { allowStale: true })
  if (!payload) {
    return {
      cityId,
      ok: false,
      skipped: true,
      error: 'CACHE_NOT_FOUND_OR_INVALID',
      cache: getCityCacheStatus(cityId),
    }
  }

  const result = await ingestBaseTwinPayload(payload, { strict: true })
  return {
    cityId,
    ok: result.ok,
    skipped: result.skipped === true,
    runId: result.runId ?? null,
    stats: result.stats ?? null,
    cache: getCityCacheStatus(cityId),
  }
}

async function main() {
  const registry = getCityRegistry()
  const requestedCityIds = process.argv.slice(2)
  const cityIds = requestedCityIds.length
    ? requestedCityIds
    : registry.cities
      .filter((city) => city.enabled !== false || city.preloaded)
      .map((city) => city.id)

  const results = []
  for (const cityId of cityIds) {
    results.push(await ingestCachedCity(cityId))
  }

  const failed = results.filter((result) => !result.ok && !result.skipped)
  console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2))
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
