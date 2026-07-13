import {
  closeLdtSemanticPackPool,
  generateLdtSemanticPacks,
  getLdtSemanticPackCatalog,
} from '../services/ldtSemanticPackService.mjs'

const DEFAULT_CITY_IDS = ['guanajuato']

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

function packSelectionFromArgs() {
  if (process.argv.includes('--all-packs')) return { allPacks: true }
  const packArg = argValue('pack') || argValue('packs')
  if (!packArg) return {}
  return {
    packKeys: packArg.split(',').map((entry) => entry.trim()).filter(Boolean),
  }
}

try {
  if (process.argv.includes('--list-packs')) {
    console.log(JSON.stringify(getLdtSemanticPackCatalog(), null, 2))
  } else {
    const result = await generateLdtSemanticPacks({
      cityIds: cityIdsFromArgs(),
      ...packSelectionFromArgs(),
    })
    console.log(JSON.stringify(result, null, 2))
  }
} finally {
  await closeLdtSemanticPackPool()
}
