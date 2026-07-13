import {
  closeLdtSurfaceRunoffScenarioPool,
  runSurfaceRunoffScenario,
} from '../services/ldtSurfaceRunoffScenarioService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function cityIdsFromArgs() {
  if (process.argv.includes('--all')) return []
  const cityArg = argValue('city')
  if (!cityArg) throw new Error('SURFACE_RUNOFF_CITY_REQUIRED: pass --city=<city-id> or --all')
  return cityArg.split(',').map((entry) => entry.trim()).filter(Boolean)
}

try {
  const result = await runSurfaceRunoffScenario({
    cityIds: cityIdsFromArgs(),
    scenarioKey: argValue('scenario') || process.env.TWIN_STUDIO_ENVIRONMENT_SCENARIO_KEY || undefined,
    sourceGridKey: argValue('source-grid-key') || process.env.TWIN_STUDIO_RUNOFF_SOURCE_GRID_KEY || undefined,
    rainfallMm: argValue('rainfall-mm') || process.env.TWIN_STUDIO_RUNOFF_RAINFALL_MM || undefined,
    durationHours: argValue('duration-hours') || process.env.TWIN_STUDIO_RUNOFF_DURATION_HOURS || undefined,
  })
  console.log(JSON.stringify(result, null, 2))
} finally {
  await closeLdtSurfaceRunoffScenarioPool()
}
