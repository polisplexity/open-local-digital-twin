import {
  closeLdtSciencePool,
  generateLdtUrbanScience,
} from '../services/ldtScienceService.mjs'

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
  const result = await generateLdtUrbanScience({
    cityIds: cityIdsFromArgs(),
  })
  console.log(JSON.stringify(result, null, 2))
} finally {
  await closeLdtSciencePool()
}
