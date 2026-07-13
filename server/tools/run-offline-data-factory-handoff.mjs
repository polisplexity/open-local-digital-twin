import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import { runOfflineDataFactoryJob } from '../services/ldtOpsService.mjs'
import { closeLdtSemanticPackPool } from '../services/ldtSemanticPackService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function booleanArg(name) {
  return process.argv.includes(`--${name}`) || process.argv.includes(`--${name}=true`)
}

function runnerOptionsFromArgs() {
  const options = {}
  const optionMap = {
    environmentalMode: ['environmental-mode', 'environmentalMode', 'mode'],
    scenarioKey: ['scenario', 'scenario-key', 'scenarioKey'],
    terrainGridKey: ['terrain-grid-key', 'terrainGridKey'],
    terrainGridResolutionM: ['terrain-grid-resolution-m', 'terrainGridResolutionM'],
    terrainTileZoom: ['terrain-tile-zoom', 'terrainTileZoom', 'tile-zoom'],
    terrainConcurrency: ['terrain-concurrency', 'terrainConcurrency'],
    weatherGridKey: ['weather-grid-key', 'weatherGridKey'],
    weatherGridResolutionM: ['weather-grid-resolution-m', 'weatherGridResolutionM'],
    weatherBatchSize: ['weather-batch-size', 'weatherBatchSize'],
    weatherEndpoint: ['weather-endpoint', 'weatherEndpoint'],
    hydrologySourceGridKey: ['hydrology-source-grid-key', 'hydrologySourceGridKey'],
    hydrologyMaxCells: ['hydrology-max-cells', 'hydrologyMaxCells'],
    hydrologyMaxObjectObservations: ['hydrology-max-object-observations', 'hydrologyMaxObjectObservations'],
    runoffSourceGridKey: ['runoff-source-grid-key', 'runoffSourceGridKey'],
    runoffRainfallMm: ['runoff-rainfall-mm', 'runoffRainfallMm', 'rainfall-mm'],
    runoffDurationHours: ['runoff-duration-hours', 'runoffDurationHours', 'duration-hours'],
  }
  for (const [key, names] of Object.entries(optionMap)) {
    const value = names.map((name) => argValue(name)).find(Boolean)
    if (value) options[key] = value
  }
  if (booleanArg('skip-runoff')) options.surfaceRunoff = false
  if (booleanArg('surface-runoff')) options.surfaceRunoff = true
  return options
}

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

try {
  await runProductionMigrations()
  const runId = argValue('run-id') || argValue('runId') || null
  const cityId = argValue('city') || argValue('city-id') || argValue('cityId') || null
  const stageKey = argValue('stage') || argValue('stage-key') || argValue('stageKey') || null
  const executorProfile = argValue('executor-profile') || argValue('executorProfile') || 'local-process'
  const runnerOptions = runnerOptionsFromArgs()
  if (!runId && (!cityId || !stageKey)) {
    throw new Error('OFFLINE_DATA_FACTORY_RUNNER_INPUT_REQUIRED: pass --run-id=<id> or --city=<city-id> --stage=<stage-key>')
  }
  const result = await runOfflineDataFactoryJob({
    runId,
    cityId,
    stageKey,
    executorProfile,
    requestedBy: 'offline-data-factory-runner-cli',
    submittedBy: 'offline-data-factory-runner-cli',
    runnerOptions,
  })
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 1)
} finally {
  await closeLdtSemanticPackPool()
  await closeProductionPool()
}
