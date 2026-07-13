import pg from 'pg'
import { getProductionDatabaseUrl } from '../db/migrate.mjs'
import {
  closeLdtSemanticPackPool,
  generateLdtSemanticPacks,
  getLdtSemanticPackReport,
  listLdtSemanticPackDefinitions,
} from '../services/ldtSemanticPackService.mjs'

const { Client } = pg

const DEFAULT_CITY_IDS = ['guanajuato']
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

function packKeyFromArgs() {
  return argValue('pack') || PACK_KEY
}

const connectionString = getProductionDatabaseUrl()
assert(connectionString, 'DATABASE_URL_REQUIRED')

const cityIds = cityIdsFromArgs()
const packKey = packKeyFromArgs()
const catalog = listLdtSemanticPackDefinitions()
const catalogDefinition = catalog.find((definition) => definition.packKey === packKey)
assert(catalogDefinition, `SEMANTIC_PACK_CATALOG_MISSING:${packKey}`)

const client = new Client({ connectionString })
await client.connect()

try {
  const generated = await generateLdtSemanticPacks({ cityIds, packKeys: [packKey] })
  assert(generated.ok, 'SEMANTIC_PACK_GENERATION_FAILED')
  assert(generated.packKey === packKey, 'SEMANTIC_PACK_KEY_MISMATCH')
  assert(generated.packCount === 1, 'SEMANTIC_PACK_GENERATION_NOT_SINGLE_PACK')
  assert(generated.ruleCount >= 5, 'SEMANTIC_PACK_RULES_LOW')
  assert(generated.cityCount === cityIds.length, 'SEMANTIC_PACK_CITY_COUNT_MISMATCH')

  const summaries = []
  for (const cityId of cityIds) {
    const report = await getLdtSemanticPackReport(cityId, packKey)
    assert(report.ok, `SEMANTIC_PACK_REPORT_FAILED:${cityId}`)
    assert(report.pack.key === packKey, `SEMANTIC_PACK_REPORT_KEY_MISMATCH:${cityId}`)
    assert(report.runtime?.key === 'manifest-runtime', `SEMANTIC_PACK_RUNTIME_MISSING:${cityId}`)
    assert(report.rules.length >= catalogDefinition.ruleCount, `SEMANTIC_PACK_REPORT_RULES_LOW:${cityId}`)
    assert(report.indicators.length >= 1, `SEMANTIC_PACK_INDICATORS_LOW:${cityId}`)
    assert(report.workflows.length >= 1, `SEMANTIC_PACK_WORKFLOWS_LOW:${cityId}`)
    assert(report.workflowContracts.length >= report.workflows.length, `SEMANTIC_PACK_WORKFLOW_CONTRACTS_LOW:${cityId}`)
    assert(report.ruleChecks.length >= catalogDefinition.ruleCount, `SEMANTIC_PACK_RULE_CHECKS_LOW:${cityId}`)
    if (packKey === 'reconstruction-service-core') {
      assert(report.indicators.some((indicator) => indicator.key === 'damage_data_connected' && indicator.value === 0), `SEMANTIC_PACK_DAMAGE_GAP_MISSING:${cityId}`)
    }
    assert(report.indicators.some((indicator) => indicator.key === 'pack_readiness'), `SEMANTIC_PACK_READINESS_MISSING:${cityId}`)
    assert(report.latestExport?.payload?.publicDataBoundary, `SEMANTIC_PACK_EXPORT_BOUNDARY_MISSING:${cityId}`)
    assert(report.latestExport?.payload?.blockedClaims?.length >= 1, `SEMANTIC_PACK_BLOCKED_CLAIMS_MISSING:${cityId}`)

    const state = await client.query(
      `
        SELECT
          (SELECT count(*)::int FROM ldt_semantic.pack_registry WHERE pack_key = $2) AS packs,
          (SELECT count(*)::int FROM ldt_semantic.pack_rules pr JOIN ldt_semantic.pack_registry p ON p.id = pr.pack_id WHERE p.pack_key = $2) AS rules,
          (SELECT count(*)::int FROM ldt_semantic.city_pack_bindings b JOIN ldt_semantic.pack_registry p ON p.id = b.pack_id WHERE b.city_id = $1 AND p.pack_key = $2) AS bindings,
          (SELECT count(*)::int FROM ldt_semantic.service_indicators i JOIN ldt_semantic.pack_registry p ON p.id = i.pack_id WHERE i.city_id = $1 AND p.pack_key = $2) AS indicators,
          (SELECT count(*)::int FROM ldt_semantic.service_features f JOIN ldt_semantic.pack_registry p ON p.id = f.pack_id WHERE f.city_id = $1 AND p.pack_key = $2) AS features,
          (SELECT count(*)::int FROM ldt_semantic.service_workflows w JOIN ldt_semantic.pack_registry p ON p.id = w.pack_id WHERE w.city_id = $1 AND p.pack_key = $2) AS workflows,
          (SELECT count(*)::int FROM ldt_semantic.pack_exports e JOIN ldt_semantic.pack_registry p ON p.id = e.pack_id WHERE e.city_id = $1 AND p.pack_key = $2) AS exports,
          (SELECT count(*)::int FROM ldt_semantic.workflow_contracts wc JOIN ldt_semantic.pack_registry p ON p.id = wc.pack_id WHERE wc.city_id = $1 AND p.pack_key = $2) AS workflow_contracts,
          (SELECT count(*)::int FROM ldt_semantic.rule_check_results rc JOIN ldt_semantic.pack_registry p ON p.id = rc.pack_id WHERE rc.city_id = $1 AND p.pack_key = $2 AND rc.pack_run_key = $2 || ':latest') AS rule_checks
      `,
      [cityId, packKey],
    )
    assert(state.rows[0].packs >= 1, `SEMANTIC_PACK_REGISTRY_MISSING:${cityId}`)
    assert(state.rows[0].rules >= catalogDefinition.ruleCount, `SEMANTIC_PACK_RULE_ROWS_LOW:${cityId}`)
    assert(state.rows[0].bindings >= 1, `SEMANTIC_PACK_BINDING_MISSING:${cityId}`)
    assert(state.rows[0].indicators >= 1, `SEMANTIC_PACK_INDICATOR_ROWS_LOW:${cityId}`)
    assert(state.rows[0].features >= 1, `SEMANTIC_PACK_FEATURE_ROWS_LOW:${cityId}`)
    assert(state.rows[0].workflows >= 1, `SEMANTIC_PACK_WORKFLOW_ROWS_LOW:${cityId}`)
    assert(state.rows[0].exports >= 1, `SEMANTIC_PACK_EXPORT_MISSING:${cityId}`)
    assert(state.rows[0].workflow_contracts >= state.rows[0].workflows, `SEMANTIC_PACK_WORKFLOW_CONTRACT_ROWS_LOW:${cityId}`)
    assert(state.rows[0].rule_checks >= catalogDefinition.ruleCount, `SEMANTIC_PACK_RULE_CHECK_ROWS_LOW:${cityId}`)

    summaries.push({
      cityId,
      readiness: report.indicators.find((indicator) => indicator.key === 'pack_readiness')?.value,
      indicators: report.indicators.length,
      serviceFeatures: state.rows[0].features,
      workflows: report.workflows.length,
      workflowContracts: report.workflowContracts.length,
      ruleChecks: report.ruleChecks.length,
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
