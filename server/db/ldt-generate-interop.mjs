import { closeLdtInteropPool, generateLdtInteroperability } from '../services/ldtInteropService.mjs'

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

const baseUrl = argValue('base-url') || process.env.TWIN_STUDIO_PUBLIC_BASE_URL || 'http://localhost:3000'

try {
  const result = await generateLdtInteroperability({
    cityIds: cityIdsFromArgs(),
    baseUrl,
  })
  console.log(JSON.stringify(result, null, 2))
} finally {
  await closeLdtInteropPool()
}
