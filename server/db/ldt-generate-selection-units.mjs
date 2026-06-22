import { generateInferredBlockSelectionUnits, getCitySelectionUnits } from './productionTwinStore.mjs'

function argValue(name, fallback = '') {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : fallback
}

function numericArg(name, fallback) {
  const value = argValue(name)
  if (value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

async function main() {
  const cityId = argValue('city', process.env.TWIN_STUDIO_E2E_CITY_ID || 'kharkiv')
  const scope = argValue('scope', 'block')
  if (scope !== 'block') {
    throw new Error(`Unsupported generated selection-unit scope: ${scope}`)
  }

  const result = await generateInferredBlockSelectionUnits(cityId, {
    limit: numericArg('limit', 1500),
    minAreaM2: numericArg('min-area-m2', 500),
    maxAreaM2: numericArg('max-area-m2', 500000),
    replace: argValue('replace', 'true') !== 'false',
  })

  const units = result.ok
    ? await getCitySelectionUnits(cityId, { scope: 'block', limit: 5 })
    : null

  console.log(JSON.stringify({
    ...result,
    sampleUnits: units?.units?.map((unit) => ({
      unitId: unit.unitId,
      label: unit.label,
      areaKm2: unit.areaKm2,
      authority: unit.authority,
      status: unit.status,
    })) ?? [],
  }, null, 2))

  process.exit(result.ok ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
