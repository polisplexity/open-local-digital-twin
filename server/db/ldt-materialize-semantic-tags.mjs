import { runProductionMigrations } from './migrate.mjs'
import { closeProductionPool } from './postgisPool.mjs'
import {
  getEntitySemanticTagSummary,
  materializeEntitySemanticTags,
} from '../services/semanticLayer/entitySemanticTagMaterializer.mjs'

const DEFAULT_CITY_IDS = ['guanajuato']

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

async function cityIdsFromArgs() {
  if (process.argv.includes('--all')) return []
  const cityArg = argValue('city')
  if (!cityArg) return DEFAULT_CITY_IDS
  return cityArg.split(',').map((entry) => entry.trim()).filter(Boolean)
}

async function listAllCityIds() {
  const { getProductionPool } = await import('./postgisPool.mjs')
  const pool = getProductionPool()
  if (!pool) throw new Error('DATABASE_URL_REQUIRED')
  const result = await pool.query('SELECT id FROM ldt_core.cities ORDER BY id')
  return result.rows.map((row) => row.id)
}

try {
  await runProductionMigrations()

  const requestedCityIds = await cityIdsFromArgs()
  const cityIds = requestedCityIds.length > 0 ? requestedCityIds : await listAllCityIds()
  const summarizeOnly = process.argv.includes('--summary-only')

  const cities = []
  for (const cityId of cityIds) {
    const result = summarizeOnly
      ? { ok: true, ...(await getEntitySemanticTagSummary({ cityId })) }
      : await materializeEntitySemanticTags({ cityId })
    cities.push(result)
  }

  const failed = cities.filter((city) => !city.ok)
  console.log(JSON.stringify({
    ok: failed.length === 0,
    cityCount: cities.length,
    cities,
  }, null, 2))
  process.exit(failed.length === 0 ? 0 : 1)
} finally {
  await closeProductionPool()
}
