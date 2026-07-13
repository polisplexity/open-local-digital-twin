import { closeSharedProductionPool, withProductionClient as withClient } from './serviceDatabase.mjs'
import {
  DEFAULT_SEMANTIC_PACK_KEYS,
  getSemanticPackCatalogSnapshot,
  listSemanticPackDefinitions,
  resolveSemanticPackDefinitions,
} from './semanticPacks/catalog/semanticPackCatalog.mjs'
import { reconstructionServiceCorePack } from './semanticPacks/definitions/reconstructionServiceCore.mjs'
import {
  getSemanticPackReport,
  runSemanticPackDefinition,
} from './semanticPacks/runtime/semanticPackRuntime.mjs'

const DEFAULT_CITY_IDS = ['guanajuato']
const DEFAULT_PACK_KEY = DEFAULT_SEMANTIC_PACK_KEYS[0]

async function withLowMemoryTransaction(client, callback) {
  await client.query('BEGIN')
  try {
    await client.query('SET LOCAL max_parallel_workers_per_gather = 0')
    await client.query("SET LOCAL work_mem = '16MB'")
    const result = await callback()
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

export async function closeLdtSemanticPackPool() {
  await closeSharedProductionPool()
}

function summarizeGeneratedPackResults(results) {
  if (results.length === 1) {
    return {
      ...results[0],
      packCount: 1,
      packs: results,
    }
  }

  const citiesById = new Map()
  for (const result of results) {
    for (const city of result.cities || []) {
      const current = citiesById.get(city.cityId) || {
        cityId: city.cityId,
        packCount: 0,
        packs: [],
      }
      current.packCount += 1
      current.packs.push({
        packKey: result.packKey,
        readiness: city.readiness,
        indicators: city.indicators,
        workflows: city.workflows,
        serviceFeatures: city.serviceFeatures,
        ruleChecks: city.ruleChecks,
      })
      citiesById.set(city.cityId, current)
    }
  }

  return {
    ok: results.every((result) => result.ok),
    runtime: {
      key: 'pack-catalog-loader',
      packRuntime: results[0]?.runtime || null,
    },
    packCount: results.length,
    packKeys: results.map((result) => result.packKey),
    cityCount: citiesById.size,
    cities: Array.from(citiesById.values()),
    packs: results,
  }
}

export function listLdtSemanticPackDefinitions() {
  return listSemanticPackDefinitions()
}

export function getLdtSemanticPackCatalog() {
  return getSemanticPackCatalogSnapshot()
}

export async function generateLdtSemanticPacks({
  cityIds = DEFAULT_CITY_IDS,
  packKeys = DEFAULT_SEMANTIC_PACK_KEYS,
  allPacks = false,
} = {}) {
  return withClient(async (client) => withLowMemoryTransaction(client, async () => {
    const results = []
    for (const definition of resolveSemanticPackDefinitions({ packKeys, allPacks })) {
      results.push(await runSemanticPackDefinition(client, definition, { cityIds }))
    }
    return summarizeGeneratedPackResults(results)
  }))
}

export async function getLdtSemanticPackReport(cityId, packKey = DEFAULT_PACK_KEY) {
  return withClient(async (client) => getSemanticPackReport(client, cityId, packKey))
}

export { reconstructionServiceCorePack }
