import pg from 'pg'
import { getProductionDatabaseUrl } from '../db/migrate.mjs'
import {
  closeLdtEnvironmentalExtractorPool,
  getLdtEnvironmentalExtractorRuns,
  getLdtEnvironmentalExtractors,
  registerLdtEnvironmentalExtractorContracts,
} from '../services/ldtEnvironmentalExtractorService.mjs'

const { Client } = pg

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
  if (!cityArg) return ['kharkiv']
  return cityArg.split(',').map((entry) => entry.trim()).filter(Boolean)
}

const connectionString = getProductionDatabaseUrl()
assert(connectionString, 'DATABASE_URL_REQUIRED')

const cityIds = cityIdsFromArgs()
const client = new Client({ connectionString })
await client.connect()

try {
  const registration = await registerLdtEnvironmentalExtractorContracts({ cityIds })
  assert(registration.ok, 'ENVIRONMENTAL_EXTRACTOR_REGISTRATION_FAILED')
  assert(registration.extractorCount >= 4, 'ENVIRONMENTAL_EXTRACTOR_COUNT_LOW')

  const cityResults = []
  for (const cityId of cityIds) {
    const extractors = await getLdtEnvironmentalExtractors(cityId)
    assert(extractors.ok, `ENVIRONMENTAL_EXTRACTORS_FAILED:${cityId}`)
    for (const key of ['terrain-dem', 'weather-field', 'hydrology-grid', 'stac-derived-indicator']) {
      const extractor = extractors.extractors.find((entry) => entry.key === key)
      assert(extractor, `ENVIRONMENTAL_EXTRACTOR_MISSING:${cityId}:${key}`)
      assert(extractor.latestRun, `ENVIRONMENTAL_EXTRACTOR_RUN_MISSING:${cityId}:${key}`)
      assert(extractor.latestRun.sourceStatus === 'source-plan-only', `ENVIRONMENTAL_EXTRACTOR_SOURCE_STATUS_INVALID:${cityId}:${key}`)
      assert(Array.isArray(extractor.outputLayerKeys) && extractor.outputLayerKeys.length > 0, `ENVIRONMENTAL_EXTRACTOR_OUTPUTS_MISSING:${cityId}:${key}`)
    }

    const runs = await getLdtEnvironmentalExtractorRuns(cityId, { limit: 20 })
    assert(runs.ok, `ENVIRONMENTAL_EXTRACTOR_RUNS_FAILED:${cityId}`)
    assert(runs.runs.length >= 4, `ENVIRONMENTAL_EXTRACTOR_RUNS_LOW:${cityId}`)
    assert(runs.runs.some((run) => run.artifacts.some((artifact) => artifact.kind === 'source-plan')), `ENVIRONMENTAL_EXTRACTOR_ARTIFACT_MISSING:${cityId}`)

    const dbState = await client.query(
      `
        SELECT
          (SELECT count(*)::int FROM ldt_environment.extractor_definitions WHERE enabled) AS definitions,
          (SELECT count(*)::int FROM ldt_environment.extractor_runs WHERE city_id = $1) AS runs,
          (SELECT count(*)::int FROM ldt_environment.extractor_artifacts WHERE city_id = $1) AS artifacts,
          (SELECT count(*)::int FROM ldt_environment.phenomenon_layers WHERE metadata->>'phase' = 'phase-14') AS phase14_layers,
          (SELECT count(*)::int FROM ldt_ops.workflow_definitions WHERE workflow_key = 'environmental-source-extractor-refresh') AS workflow_definitions
      `,
      [cityId],
    )
    const row = dbState.rows[0]
    assert(row.definitions >= 4, `ENVIRONMENTAL_EXTRACTOR_DEFINITIONS_DB_LOW:${cityId}`)
    assert(row.runs >= 4, `ENVIRONMENTAL_EXTRACTOR_RUNS_DB_LOW:${cityId}`)
    assert(row.artifacts >= 4, `ENVIRONMENTAL_EXTRACTOR_ARTIFACTS_DB_LOW:${cityId}`)
    assert(row.phase14_layers >= 8, `ENVIRONMENTAL_SOURCE_LAYER_CATALOG_LOW:${cityId}`)
    assert(row.workflow_definitions === 1, `ENVIRONMENTAL_EXTRACTOR_WORKFLOW_MISSING:${cityId}`)

    cityResults.push({
      cityId,
      extractors: extractors.extractors.length,
      runs: row.runs,
      artifacts: row.artifacts,
      sourceLayerCatalog: row.phase14_layers,
    })
  }

  console.log(JSON.stringify({
    ok: true,
    cityCount: cityResults.length,
    cities: cityResults,
  }, null, 2))
} finally {
  await client.end()
  await closeLdtEnvironmentalExtractorPool()
}
