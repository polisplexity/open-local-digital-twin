import pg from 'pg'
import { getProductionDatabaseUrl } from '../db/migrate.mjs'
import {
  closeLdtSocietyPool,
  generateLdtSocietyStandard,
  getLdtSocietyReport,
} from '../services/ldtSocietyService.mjs'

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
  const generated = await generateLdtSocietyStandard({ cityIds })
  assert(generated.ok, 'SOCIETY_GENERATION_FAILED')
  assert(generated.seriesDefinitions >= 10, 'SOCIETY_SERIES_DEFINITIONS_LOW')
  assert(generated.privacyPolicies >= 3, 'SOCIETY_PRIVACY_POLICIES_LOW')
  assert(generated.sourceQualityRules >= 4, 'SOCIETY_SOURCE_QUALITY_RULES_LOW')
  assert(generated.cityCount === cityIds.length, 'SOCIETY_CITY_COUNT_MISMATCH')

  const summaries = []
  for (const cityId of cityIds) {
    const report = await getLdtSocietyReport(cityId)
    assert(report.ok, `SOCIETY_REPORT_FAILED:${cityId}`)
    assert(report.observations.length >= 10, `SOCIETY_OBSERVATIONS_LOW:${cityId}`)
    assert(report.observations.every((observation) => observation.privacyClass !== 'prohibited_for_public_view'), `SOCIETY_PRIVACY_INVALID:${cityId}`)
    assert(report.observations.some((observation) => observation.key === 'demographic_data_readiness'), `SOCIETY_DEMOGRAPHIC_READINESS_MISSING:${cityId}`)
    assert(report.observations.some((observation) => observation.key === 'daily_economy_anchor_density'), `SOCIETY_ECONOMIC_DENSITY_MISSING:${cityId}`)

    const state = await client.query(
      `
        SELECT
          (SELECT count(*)::int FROM ldt_society.observation_series WHERE city_id = $1 AND standard_key = 'society-culture-core') AS series,
          (SELECT count(*)::int FROM ldt_society.observations o JOIN ldt_society.observation_series os ON os.id = o.series_id WHERE os.city_id = $1 AND os.standard_key = 'society-culture-core') AS observations,
          (SELECT count(*)::int FROM ldt_society.domain_profiles WHERE city_id = $1) AS domain_profiles,
          (SELECT count(*)::int FROM ldt_society.social_vulnerability_scores WHERE city_id = $1) AS vulnerability_scores,
          (SELECT count(*)::int FROM ldt_society.equity_gap_results WHERE city_id = $1) AS equity_gaps,
          (SELECT count(*)::int FROM ldt_society.participation_events WHERE city_id = $1) AS participation_events,
          (SELECT count(*)::int FROM ldt_society.cultural_assets WHERE city_id = $1) AS cultural_assets
      `,
      [cityId],
    )
    assert(state.rows[0].series >= 10, `SOCIETY_SERIES_ROWS_LOW:${cityId}`)
    assert(state.rows[0].observations >= 10, `SOCIETY_OBSERVATION_ROWS_LOW:${cityId}`)
    assert(state.rows[0].domain_profiles >= 10, `SOCIETY_DOMAIN_PROFILES_LOW:${cityId}`)
    assert(state.rows[0].vulnerability_scores >= 1, `SOCIETY_VULNERABILITY_ROW_MISSING:${cityId}`)
    assert(state.rows[0].equity_gaps >= 1, `SOCIETY_EQUITY_ROW_MISSING:${cityId}`)
    assert(state.rows[0].participation_events >= 1, `SOCIETY_PARTICIPATION_ROW_MISSING:${cityId}`)

    summaries.push({
      cityId,
      observations: report.observations.length,
      culturalAssets: state.rows[0].cultural_assets,
      participationEvents: state.rows[0].participation_events,
      privacyPosture: report.privacyPosture,
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
  await closeLdtSocietyPool()
}
