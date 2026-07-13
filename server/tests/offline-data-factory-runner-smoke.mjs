import fs from 'node:fs'
import assert from 'node:assert/strict'

import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import { closeLdtSemanticPackPool } from '../services/ldtSemanticPackService.mjs'
import {
  getCityOperationsReport,
  runOfflineDataFactoryJob,
} from '../services/ldtOpsService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
const stageKey = argValue('stage') || 'semantic-materialization'
const limitPerTypeArg = argValue('limit-per-type')
const entityLimitPerType = limitPerTypeArg ? Number(limitPerTypeArg) : null
if (entityLimitPerType !== null) {
  assert.ok(Number.isInteger(entityLimitPerType) && entityLimitPerType > 0, 'OFFLINE_RUNNER_LIMIT_PER_TYPE_INVALID')
}

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

try {
  await runProductionMigrations()
  const result = await runOfflineDataFactoryJob({
    cityId,
    stageKey,
    executorProfile: 'local-process',
    requestedBy: 'offline-data-factory-runner-smoke',
    submittedBy: 'offline-data-factory-runner-smoke',
    runnerOptions: entityLimitPerType === null ? {} : { semanticEntityLimitPerType: entityLimitPerType },
  })

  assert.equal(result.ok, true, 'OFFLINE_RUNNER_NOT_OK')
  assert.equal(result.cityId, cityId, 'OFFLINE_RUNNER_CITY_MISMATCH')
  assert.equal(result.stageKey, stageKey, 'OFFLINE_RUNNER_STAGE_MISMATCH')
  assert.equal(result.executorProfile, 'local-process', 'OFFLINE_RUNNER_PROFILE_INVALID')
  assert.ok(result.handoff?.handoff?.runId, 'OFFLINE_RUNNER_HANDOFF_MISSING')
  assert.equal(result.imported?.ok, true, result.imported?.error || 'OFFLINE_RUNNER_IMPORT_NOT_OK')
  assert.equal(result.imported?.run?.status, 'succeeded', 'OFFLINE_RUNNER_RUN_NOT_SUCCEEDED')
  assert.equal(result.imported?.result?.status, 'succeeded', 'OFFLINE_RUNNER_RESULT_NOT_SUCCEEDED')
  assert.equal(result.imported?.result?.promotion?.postgis?.status, 'promoted', 'OFFLINE_RUNNER_POSTGIS_NOT_PROMOTED')
  assert.equal(
    result.imported?.run?.steps?.find((step) => step.stepKey === 'run-offline-data-factory')?.status,
    'succeeded',
    'OFFLINE_RUNNER_STEP_NOT_SUCCEEDED',
  )
  assert.equal(
    result.imported?.run?.steps?.find((step) => step.stepKey === 'promote-postgis-results')?.status,
    'succeeded',
    'OFFLINE_RUNNER_PROMOTION_STEP_NOT_SUCCEEDED',
  )
  assert.ok(result.imported?.result?.localPath && fs.existsSync(result.imported.result.localPath), 'OFFLINE_RUNNER_RESULT_FILE_MISSING')

  const payload = JSON.parse(fs.readFileSync(result.imported.result.localPath, 'utf8'))
  assert.equal(payload.resultSummary?.runner?.executorProfile, 'local-process', 'OFFLINE_RUNNER_PAYLOAD_PROFILE_INVALID')
  assert.ok(payload.resultSummary?.materialization?.activeTagCount > 0, 'OFFLINE_RUNNER_MATERIALIZATION_SUMMARY_MISSING')
  assert.equal(
    payload.resultSummary?.materialization?.entityLimitPerType ?? null,
    entityLimitPerType,
    'OFFLINE_RUNNER_MATERIALIZATION_LIMIT_MISMATCH',
  )
  assert.ok(payload.resultSummary?.semanticPacks?.packCount > 0, 'OFFLINE_RUNNER_PACK_SUMMARY_MISSING')

  const report = await getCityOperationsReport(cityId)
  assert.equal(report.ok, true, report.error || 'OPERATIONS_REPORT_AFTER_RUNNER_NOT_OK')
  const reportHandoff = report.dataFactory?.offlineHandoffs?.find((entry) => entry.runId === result.runId)
  assert.ok(reportHandoff, 'OFFLINE_RUNNER_HANDOFF_NOT_LISTED')
  assert.equal(reportHandoff.resultStatus, 'succeeded', 'OFFLINE_RUNNER_RESULT_STATUS_NOT_LISTED')
  assert.equal(reportHandoff.postgisPromotionStatus, 'promoted', 'OFFLINE_RUNNER_PROMOTION_STATUS_NOT_LISTED')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    stageKey,
    runId: result.runId,
    executorProfile: result.executorProfile,
    entityLimitPerType,
    result: {
      status: result.imported.result.status,
      artifactUri: result.imported.result.artifactUri,
      checksum: result.imported.result.checksum,
      byteSize: result.imported.result.byteSize,
      localPath: result.imported.result.localPath,
      postgisPromotion: result.imported.result.promotion.postgis.status,
    },
  }, null, 2))
} finally {
  await closeLdtSemanticPackPool()
  await closeProductionPool()
}
