import fs from 'node:fs'
import assert from 'node:assert/strict'

import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import { createOfflineDataFactoryHandoff, getCityOperationsReport } from '../services/ldtOpsService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
const stageKey = argValue('stage') || 'semantic-materialization'

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

try {
  await runProductionMigrations()

  const before = await getCityOperationsReport(cityId)
  assert.equal(before.ok, true, before.error || 'OPERATIONS_REPORT_NOT_OK')
  assert.ok(
    before.dataFactory?.stages?.some((stage) => stage.key === stageKey && stage.execution?.availableModes?.includes('offline-data-factory')),
    'OFFLINE_HANDOFF_STAGE_NOT_AVAILABLE',
  )

  const result = await createOfflineDataFactoryHandoff({
    cityId,
    stageKey,
    requestedBy: 'offline-data-factory-handoff-smoke',
    submittedBy: 'offline-data-factory-handoff-smoke',
  })

  assert.equal(result.ok, true, result.error || 'OFFLINE_HANDOFF_NOT_OK')
  assert.equal(result.handoff?.stageKey, stageKey, 'OFFLINE_HANDOFF_STAGE_MISMATCH')
  assert.equal(result.handoff?.status, 'queued-for-offline-execution', 'OFFLINE_HANDOFF_STATUS_INVALID')
  assert.ok(result.handoff?.artifactUri?.startsWith('runtime://'), 'OFFLINE_HANDOFF_ARTIFACT_URI_INVALID')
  assert.ok(result.handoff?.checksum?.startsWith('sha256:'), 'OFFLINE_HANDOFF_CHECKSUM_MISSING')
  assert.ok(result.handoff?.byteSize > 0, 'OFFLINE_HANDOFF_EMPTY')
  assert.ok(result.handoff?.localPath && fs.existsSync(result.handoff.localPath), 'OFFLINE_HANDOFF_FILE_MISSING')

  const payload = JSON.parse(fs.readFileSync(result.handoff.localPath, 'utf8'))
  assert.equal(payload.cityId, cityId, 'OFFLINE_HANDOFF_PAYLOAD_CITY_MISMATCH')
  assert.equal(payload.stageKey, stageKey, 'OFFLINE_HANDOFF_PAYLOAD_STAGE_MISMATCH')
  assert.equal(payload.executionMode, 'offline-data-factory', 'OFFLINE_HANDOFF_PAYLOAD_MODE_INVALID')
  assert.equal(payload.stageContract?.schemaVersion, '2026-06-26.data-factory-stage-contract.v1', 'OFFLINE_HANDOFF_STAGE_CONTRACT_MISSING')
  assert.ok(payload.stageContract.allowedRunnerProfiles.includes('local-process'), 'OFFLINE_HANDOFF_LOCAL_PROFILE_MISSING')
  assert.ok(payload.stageContract.allowedRunnerProfiles.includes('external-worker'), 'OFFLINE_HANDOFF_EXTERNAL_PROFILE_MISSING')
  assert.ok(Array.isArray(payload.stageContract.inputs) && payload.stageContract.inputs.length > 0, 'OFFLINE_HANDOFF_INPUT_CONTRACT_MISSING')
  assert.ok(Array.isArray(payload.stageContract.outputs) && payload.stageContract.outputs.length > 0, 'OFFLINE_HANDOFF_OUTPUT_CONTRACT_MISSING')
  assert.ok(payload.promotionContract?.postgis?.writes?.length > 0, 'OFFLINE_HANDOFF_POSTGIS_PROMOTION_MISSING')
  assert.ok(payload.promotionContract?.artifactRegistry, 'OFFLINE_HANDOFF_ARTIFACT_PROMOTION_MISSING')

  const after = await getCityOperationsReport(cityId)
  assert.equal(after.ok, true, after.error || 'OPERATIONS_REPORT_AFTER_HANDOFF_NOT_OK')
  assert.ok(
    after.dataFactory?.offlineHandoffs?.some((handoff) => handoff.runId === result.handoff.runId),
    'OFFLINE_HANDOFF_NOT_LISTED_IN_OPERATIONS_REPORT',
  )

  console.log(JSON.stringify({
    ok: true,
    cityId,
    stageKey,
    handoff: {
      runId: result.handoff.runId,
      status: result.handoff.status,
      artifactUri: result.handoff.artifactUri,
      checksum: result.handoff.checksum,
      byteSize: result.handoff.byteSize,
      localPath: result.handoff.localPath,
    },
    operationsReport: {
      offlineHandoffs: after.dataFactory.offlineHandoffs.length,
      latestRunId: after.dataFactory.offlineHandoffs[0]?.runId,
    },
  }, null, 2))
} finally {
  await closeProductionPool()
}
