import {
  closeLdtHydrologyGridExtractorPool,
  runHydrologyGridExtractor,
} from '../services/ldtHydrologyGridExtractorService.mjs'

const DEFAULT_CITY_IDS = ['kharkiv']

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function cityIdsFromArgs() {
  if (process.argv.includes('--all')) return []
  const cityArg = argValue('city')
  if (!cityArg) return DEFAULT_CITY_IDS
  return cityArg.split(',').map((entry) => entry.trim()).filter(Boolean)
}

try {
  const result = await runHydrologyGridExtractor({
    cityIds: cityIdsFromArgs(),
    scenarioKey: argValue('scenario') || process.env.TWIN_STUDIO_ENVIRONMENT_SCENARIO_KEY || undefined,
    sourceGridKey: argValue('source-grid-key') || process.env.TWIN_STUDIO_HYDROLOGY_SOURCE_GRID_KEY || undefined,
  })
  console.log(JSON.stringify(result, null, 2))
} finally {
  await closeLdtHydrologyGridExtractorPool()
}
