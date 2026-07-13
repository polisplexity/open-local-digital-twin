import {
  closeLdtHydrologyGridExtractorPool,
  runHydrologyGridExtractor,
} from '../services/ldtHydrologyGridExtractorService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function booleanArg(name) {
  return process.argv.includes(`--${name}`) || process.argv.includes(`--${name}=true`)
}

function cityIdsFromArgs() {
  if (process.argv.includes('--all')) return []
  const cityArg = argValue('city')
  if (!cityArg) throw new Error('HYDROLOGY_CITY_REQUIRED: pass --city=<city-id> or --all')
  return cityArg.split(',').map((entry) => entry.trim()).filter(Boolean)
}

try {
  const result = await runHydrologyGridExtractor({
    cityIds: cityIdsFromArgs(),
    scenarioKey: argValue('scenario') || process.env.TWIN_STUDIO_ENVIRONMENT_SCENARIO_KEY || undefined,
    sourceGridKey: argValue('source-grid-key') || process.env.TWIN_STUDIO_HYDROLOGY_SOURCE_GRID_KEY || undefined,
    maxCells: argValue('max-cells') || undefined,
    maxObjectObservations: argValue('max-object-observations') || undefined,
    dryRun: booleanArg('dry-run'),
    force: booleanArg('force'),
  })
  console.log(JSON.stringify(result, null, 2))
} finally {
  await closeLdtHydrologyGridExtractorPool()
}
