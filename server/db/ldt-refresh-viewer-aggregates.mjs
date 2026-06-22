import {
  closeLdtViewerAggregatePool,
  refreshLdtViewerAggregates,
} from '../services/ldtViewerAggregateService.mjs'

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
  const result = await refreshLdtViewerAggregates({
    cityIds: cityIdsFromArgs(),
    cellSizeM: argValue('cell-size-m') || process.env.TWIN_STUDIO_LDT_DENSITY_CELL_SIZE_M,
    gridKey: argValue('grid-key') || undefined,
  })
  console.log(JSON.stringify(result, null, 2))
} finally {
  await closeLdtViewerAggregatePool()
}
