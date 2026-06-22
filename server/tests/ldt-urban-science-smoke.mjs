import pg from 'pg'
import { getProductionDatabaseUrl } from '../db/migrate.mjs'
import {
  closeLdtSciencePool,
  generateLdtUrbanScience,
  getLdtUrbanScienceReport,
} from '../services/ldtScienceService.mjs'

const { Client } = pg

const DEFAULT_CITY_IDS = ['adazi', 'kharkiv']

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
  const generated = await generateLdtUrbanScience({ cityIds })
  assert(generated.ok, 'URBAN_SCIENCE_GENERATION_FAILED')
  assert(generated.indicatorDefinitions >= 10, 'URBAN_SCIENCE_INDICATOR_DEFINITIONS_LOW')
  assert(generated.scalingModels >= 2, 'URBAN_SCIENCE_SCALING_MODELS_LOW')
  assert(generated.scenarios >= 3, 'URBAN_SCIENCE_SCENARIOS_LOW')
  assert(generated.cityCount === cityIds.length, 'URBAN_SCIENCE_CITY_COUNT_MISMATCH')

  const summaries = []
  for (const cityId of cityIds) {
    const report = await getLdtUrbanScienceReport(cityId)
    assert(report.ok, `URBAN_SCIENCE_REPORT_FAILED:${cityId}`)
    assert(report.indicators.length >= 10, `URBAN_SCIENCE_INDICATORS_LOW:${cityId}`)
    assert(report.indicators.some((indicator) => indicator.key === 'built_fabric_density'), `URBAN_SCIENCE_BUILT_FABRIC_MISSING:${cityId}`)
    assert(report.indicators.some((indicator) => indicator.key === 'boundary_compactness'), `URBAN_SCIENCE_COMPACTNESS_MISSING:${cityId}`)

    const state = await client.query(
      `
        SELECT
          (SELECT count(*)::int FROM ldt_science.indicator_observations WHERE city_id = $1) AS observations,
          (SELECT count(*)::int FROM ldt_science.network_layers WHERE city_id = $1) AS network_layers,
          (SELECT count(*)::int FROM ldt_science.network_metrics WHERE city_id = $1) AS network_metrics,
          (SELECT count(*)::int FROM ldt_science.simulation_runs WHERE city_id = $1 AND scenario_key = 'baseline-open-data-diagnostic') AS diagnostic_runs
      `,
      [cityId],
    )
    assert(state.rows[0].observations >= 10, `URBAN_SCIENCE_OBSERVATION_ROWS_LOW:${cityId}`)
    assert(state.rows[0].network_layers >= 1, `URBAN_SCIENCE_NETWORK_LAYER_MISSING:${cityId}`)
    assert(state.rows[0].network_metrics >= 2, `URBAN_SCIENCE_NETWORK_METRICS_LOW:${cityId}`)
    assert(state.rows[0].diagnostic_runs >= 1, `URBAN_SCIENCE_DIAGNOSTIC_RUN_MISSING:${cityId}`)

    summaries.push({
      cityId,
      indicators: report.indicators.length,
      observations: state.rows[0].observations,
      networkMetrics: state.rows[0].network_metrics,
      diagnosticRuns: state.rows[0].diagnostic_runs,
    })
  }

  console.log(JSON.stringify({
    ok: true,
    standardKey: generated.standardKey,
    standardVersion: generated.standardVersion,
    cityCount: summaries.length,
    cities: summaries,
  }, null, 2))
} finally {
  await client.end()
  await closeLdtSciencePool()
}
