import {
  closeLdtTerrainDemExtractorPool,
  runTerrainDemExtractor,
} from '../services/ldtTerrainDemExtractorService.mjs'

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
  const result = await runTerrainDemExtractor({
    cityIds: cityIdsFromArgs(),
    scenarioKey: argValue('scenario') || process.env.TWIN_STUDIO_ENVIRONMENT_SCENARIO_KEY || undefined,
    gridKey: argValue('grid-key') || undefined,
    gridResolutionM: argValue('grid-resolution-m') || process.env.TWIN_STUDIO_TERRAIN_DEM_GRID_RESOLUTION_M || undefined,
    tileZoom: argValue('tile-zoom') || process.env.TWIN_STUDIO_TERRAIN_DEM_ZOOM || undefined,
    sampleOffsetM: argValue('sample-offset-m') || process.env.TWIN_STUDIO_TERRAIN_DEM_SAMPLE_OFFSET_M || undefined,
    concurrency: argValue('concurrency') || process.env.TWIN_STUDIO_TERRAIN_DEM_CONCURRENCY || undefined,
    tileTemplate: argValue('tile-template') || process.env.TWIN_STUDIO_TERRAIN_DEM_TILE_TEMPLATE || undefined,
    onProgress: (progress) => {
      const total = Number(progress.total || 0)
      const completed = Number(progress.completed || 0)
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0
      const summary = progress.stage === 'sampling'
        ? `${completed}/${total} ${percent}% samples=${progress.samples} failures=${progress.failures} tiles=${progress.tileCount}`
        : `grid=${progress.gridKey} cells=${progress.total} z=${progress.tileZoom} concurrency=${progress.concurrency}`
      process.stderr.write(`[terrain-dem] ${progress.cityId} ${progress.stage}: ${summary}\n`)
    },
  })
  console.log(JSON.stringify(result, null, 2))
} finally {
  await closeLdtTerrainDemExtractorPool()
}
