import {
  closeLdtWeatherFieldExtractorPool,
  runWeatherFieldExtractor,
} from '../services/ldtWeatherFieldExtractorService.mjs'

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
  const result = await runWeatherFieldExtractor({
    cityIds: cityIdsFromArgs(),
    scenarioKey: argValue('scenario') || process.env.TWIN_STUDIO_ENVIRONMENT_SCENARIO_KEY || undefined,
    gridKey: argValue('grid-key') || undefined,
    gridResolutionM: argValue('grid-resolution-m') || process.env.TWIN_STUDIO_WEATHER_GRID_RESOLUTION_M || undefined,
    endpoint: argValue('endpoint') || process.env.TWIN_STUDIO_WEATHER_OPEN_METEO_ENDPOINT || undefined,
    batchSize: argValue('batch-size') || process.env.TWIN_STUDIO_WEATHER_BATCH_SIZE || undefined,
    onProgress: (progress) => {
      const total = Number(progress.total || 0)
      const completed = Number(progress.completed || 0)
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0
      const summary = progress.stage === 'sampling'
        ? `${completed}/${total} ${percent}% samples=${progress.samples} failures=${progress.failures}`
        : `grid=${progress.gridKey} cells=${progress.total}`
      process.stderr.write(`[weather-field] ${progress.cityId} ${progress.stage}: ${summary}\n`)
    },
  })
  console.log(JSON.stringify(result, null, 2))
} finally {
  await closeLdtWeatherFieldExtractorPool()
}
