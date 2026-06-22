import {
  closeLdtEnvironmentalPool,
  refreshLdtEnvironmentalPhenomena,
} from '../services/ldtEnvironmentalService.mjs'

const DEFAULT_CITY_IDS = ['adazi', 'kharkiv']

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
  const result = await refreshLdtEnvironmentalPhenomena({
    cityIds: cityIdsFromArgs(),
    scenarioKey: argValue('scenario') || process.env.TWIN_STUDIO_ENVIRONMENT_SCENARIO_KEY || undefined,
    gridKey: argValue('grid-key') || undefined,
  })
  console.log(JSON.stringify(result, null, 2))
} finally {
  await closeLdtEnvironmentalPool()
}
