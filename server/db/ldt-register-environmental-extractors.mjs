import {
  closeLdtEnvironmentalExtractorPool,
  registerLdtEnvironmentalExtractorContracts,
} from '../services/ldtEnvironmentalExtractorService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function cityIdsFromArgs() {
  if (process.argv.includes('--all')) return []
  const cityArg = argValue('city')
  if (!cityArg) throw new Error('ENVIRONMENTAL_EXTRACTORS_CITY_REQUIRED: pass --city=<city-id> or --all')
  return cityArg.split(',').map((entry) => entry.trim()).filter(Boolean)
}

try {
  const result = await registerLdtEnvironmentalExtractorContracts({
    cityIds: cityIdsFromArgs(),
    scenarioKey: argValue('scenario') || process.env.TWIN_STUDIO_ENVIRONMENT_SCENARIO_KEY || undefined,
    requestedBy: argValue('requested-by') || 'system',
    requestedByKind: argValue('requested-by-kind') || 'system',
    triggerKind: argValue('trigger') || 'manual',
  })
  console.log(JSON.stringify(result, null, 2))
} finally {
  await closeLdtEnvironmentalExtractorPool()
}
