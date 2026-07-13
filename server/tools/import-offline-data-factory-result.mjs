import fs from 'node:fs'

import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import { importOfflineDataFactoryResult } from '../services/ldtOpsService.mjs'
import { closeLdtSemanticPackPool } from '../services/ldtSemanticPackService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

try {
  const cityId = argValue('city') || argValue('city-id') || argValue('cityId')
  const runId = argValue('run-id') || argValue('runId')
  const file = argValue('file') || argValue('result-file') || argValue('resultFile')
  const submittedBy = argValue('submitted-by') || argValue('submittedBy') || 'offline-data-factory-result-cli'
  if (!cityId || !runId || !file) {
    throw new Error('OFFLINE_RESULT_IMPORT_INPUT_REQUIRED: pass --city=<city-id> --run-id=<workflow-run-id> --file=<result.json>')
  }
  const resultPackage = JSON.parse(fs.readFileSync(file, 'utf8'))
  await runProductionMigrations()
  const imported = await importOfflineDataFactoryResult({
    cityId,
    runId,
    resultPackage,
    submittedBy,
  })
  console.log(JSON.stringify(imported, null, 2))
  process.exit(imported.ok ? 0 : 1)
} finally {
  await closeLdtSemanticPackPool()
  await closeProductionPool()
}
