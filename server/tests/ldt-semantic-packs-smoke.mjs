import pg from 'pg'
import { getProductionDatabaseUrl } from '../db/migrate.mjs'
import {
  closeLdtSemanticPackPool,
  generateLdtSemanticPacks,
  getLdtSemanticPackReport,
} from '../services/ldtSemanticPackService.mjs'

const { Client } = pg

const DEFAULT_CITY_IDS = ['adazi', 'kharkiv']
const PACK_KEY = 'reconstruction-service-core'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function cityIdsFromArgs() {
  const cityArg = argValue('city')
  if (!cityArg) return DEFAULT_CITY_IDS
  return cityArg.split(',').map((entry) => entry.trim()).filter(Boolean)
}

const connectionString = getProductionDatabaseUrl()
assert(connectionString, 'DATABASE_URL_REQUIRED')

const cityIds = cityIdsFromArgs()
const client = new Client({ connectionString })
await client.connect()

try {
  const generated = await generateLdtSemanticPacks({ cityIds })
  assert(generated.ok, 'SEMANTIC_PACK_GENERATION_FAILED')
  assert(generated.packKey === PACK_KEY, 'SEMANTIC_PACK_KEY_MISMATCH')
  assert(generated.ruleCount >= 5, 'SEMANTIC_PACK_RULES_LOW')
  assert(generated.cityCount === cityIds.length, 'SEMANTIC_PACK_CITY_COUNT_MISMATCH')

  const summaries = []
  for (const cityId of cityIds) {
    const report = await getLdtSemanticPackReport(cityId, PACK_KEY)
    assert(report.ok, `SEMANTIC_PACK_REPORT_FAILED:${cityId}`)
    assert(report.pack.key === PACK_KEY, `SEMANTIC_PACK_REPORT_KEY_MISMATCH:${cityId}`)
    assert(report.rules.length >= 5, `SEMANTIC_PACK_REPORT_RULES_LOW:${cityId}`)
    assert(report.indicators.length >= 10, `SEMANTIC_PACK_INDICATORS_LOW:${cityId}`)
    assert(report.workflows.length >= 4, `SEMANTIC_PACK_WORKFLOWS_LOW:${cityId}`)
    assert(report.indicators.some((indicator) => indicator.key === 'damage_data_connected' && indicator.value === 0), `SEMANTIC_PACK_DAMAGE_GAP_MISSING:${cityId}`)
    assert(report.indicators.some((indicator) => indicator.key === 'pack_readiness'), `SEMANTIC_PACK_READINESS_MISSING:${cityId}`)
    assert(report.latestExport?.payload?.publicDataBoundary, `SEMANTIC_PACK_EXPORT_BOUNDARY_MISSING:${cityId}`)

    const state = await client.query(
      `
        SELECT
          (SELECT count(*)::int FROM ldt_semantic.pack_registry WHERE pack_key = $2) AS packs,
          (SELECT count(*)::int FROM ldt_semantic.pack_rules pr JOIN ldt_semantic.pack_registry p ON p.id = pr.pack_id WHERE p.pack_key = $2) AS rules,
          (SELECT count(*)::int FROM ldt_semantic.city_pack_bindings b JOIN ldt_semantic.pack_registry p ON p.id = b.pack_id WHERE b.city_id = $1 AND p.pack_key = $2) AS bindings,
          (SELECT count(*)::int FROM ldt_semantic.service_indicators i JOIN ldt_semantic.pack_registry p ON p.id = i.pack_id WHERE i.city_id = $1 AND p.pack_key = $2) AS indicators,
          (SELECT count(*)::int FROM ldt_semantic.service_features f JOIN ldt_semantic.pack_registry p ON p.id = f.pack_id WHERE f.city_id = $1 AND p.pack_key = $2) AS features,
          (SELECT count(*)::int FROM ldt_semantic.service_workflows w JOIN ldt_semantic.pack_registry p ON p.id = w.pack_id WHERE w.city_id = $1 AND p.pack_key = $2) AS workflows,
          (SELECT count(*)::int FROM ldt_semantic.pack_exports e JOIN ldt_semantic.pack_registry p ON p.id = e.pack_id WHERE e.city_id = $1 AND p.pack_key = $2) AS exports
      `,
      [cityId, PACK_KEY],
    )
    assert(state.rows[0].packs >= 1, `SEMANTIC_PACK_REGISTRY_MISSING:${cityId}`)
    assert(state.rows[0].rules >= 5, `SEMANTIC_PACK_RULE_ROWS_LOW:${cityId}`)
    assert(state.rows[0].bindings >= 1, `SEMANTIC_PACK_BINDING_MISSING:${cityId}`)
    assert(state.rows[0].indicators >= 10, `SEMANTIC_PACK_INDICATOR_ROWS_LOW:${cityId}`)
    assert(state.rows[0].features >= 1, `SEMANTIC_PACK_FEATURE_ROWS_LOW:${cityId}`)
    assert(state.rows[0].workflows >= 4, `SEMANTIC_PACK_WORKFLOW_ROWS_LOW:${cityId}`)
    assert(state.rows[0].exports >= 1, `SEMANTIC_PACK_EXPORT_MISSING:${cityId}`)

    summaries.push({
      cityId,
      readiness: report.indicators.find((indicator) => indicator.key === 'pack_readiness')?.value,
      indicators: report.indicators.length,
      serviceFeatures: state.rows[0].features,
      workflows: report.workflows.length,
    })
  }

  console.log(JSON.stringify({
    ok: true,
    packKey: generated.packKey,
    packVersion: generated.packVersion,
    cityCount: summaries.length,
    cities: summaries,
  }, null, 2))
} finally {
  await client.end()
  await closeLdtSemanticPackPool()
}
