import {
  closeFiwarePool,
  syncCityToFiware,
  upsertFiwareConnection,
} from '../services/fiwareContextBrokerService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

const cityId = argValue('city') || 'kharkiv'
const connectionKey = argValue('connection') || 'local-dry-run'
const brokerUrl = argValue('broker-url')
const tenant = argValue('tenant')
const ngsiType = argValue('type')
const limit = argValue('limit') || '100'
const dryRun = process.argv.includes('--dry-run')

try {
  if (brokerUrl) {
    await upsertFiwareConnection({
      connectionKey,
      brokerUrl,
      tenant,
      status: dryRun ? 'draft' : 'active',
      metadata: {
        phase: 'phase-5-fiware',
        source: 'db:ldt:fiware-sync',
      },
    })
  }

  const result = await syncCityToFiware({
    cityId,
    connectionKey,
    ngsiType,
    limit,
    dryRun,
  })
  console.log(JSON.stringify(result, null, 2))
} finally {
  await closeFiwarePool()
}
