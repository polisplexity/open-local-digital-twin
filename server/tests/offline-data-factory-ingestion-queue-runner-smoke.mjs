import fs from 'node:fs'
import assert from 'node:assert/strict'

import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
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
const stageKey = 'ingestion-queue'

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
    requestedBy: 'offline-data-factory-ingestion-queue-runner-smoke',
    submittedBy: 'offline-data-factory-ingestion-queue-runner-smoke',
  })

  assert.equal(result.ok, true, 'OFFLINE_INGESTION_RUNNER_NOT_OK')
  assert.equal(result.cityId, cityId, 'OFFLINE_INGESTION_CITY_MISMATCH')
  assert.equal(result.stageKey, stageKey, 'OFFLINE_INGESTION_STAGE_MISMATCH')
  assert.equal(result.executorProfile, 'local-process', 'OFFLINE_INGESTION_PROFILE_INVALID')
  assert.ok(result.handoff?.handoff?.runId, 'OFFLINE_INGESTION_HANDOFF_MISSING')
  assert.equal(result.imported?.ok, true, result.imported?.error || 'OFFLINE_INGESTION_IMPORT_NOT_OK')
  assert.equal(result.imported?.run?.status, 'succeeded', 'OFFLINE_INGESTION_RUN_NOT_SUCCEEDED')
  assert.equal(result.imported?.result?.status, 'succeeded', 'OFFLINE_INGESTION_RESULT_NOT_SUCCEEDED')
  assert.equal(result.imported?.result?.promotion?.postgis?.status, 'promoted', 'OFFLINE_INGESTION_POSTGIS_NOT_PROMOTED')
  assert.equal(
    result.imported?.result?.promotion?.postgis?.applicator?.status,
    'validated',
    'OFFLINE_INGESTION_APPLICATOR_NOT_VALIDATED',
  )
  assert.equal(
    result.imported?.run?.steps?.find((step) => step.stepKey === 'run-offline-data-factory')?.status,
    'succeeded',
    'OFFLINE_INGESTION_RUN_STEP_NOT_SUCCEEDED',
  )
  assert.equal(
    result.imported?.run?.steps?.find((step) => step.stepKey === 'promote-postgis-results')?.status,
    'succeeded',
    'OFFLINE_INGESTION_PROMOTION_STEP_NOT_SUCCEEDED',
  )
  assert.equal(
    result.imported?.run?.steps?.find((step) => step.stepKey === 'register-viewer-artifacts')?.status,
    'succeeded',
    'OFFLINE_INGESTION_VIEWER_NOT_APPLICABLE_STEP_NOT_CLOSED',
  )
  assert.ok(result.imported?.result?.localPath && fs.existsSync(result.imported.result.localPath), 'OFFLINE_INGESTION_RESULT_FILE_MISSING')

  const payload = JSON.parse(fs.readFileSync(result.imported.result.localPath, 'utf8'))
  const queueSummary = payload.resultSummary?.ingestionQueue ?? {}
  const evidence = payload.promotion?.postgis?.evidence ?? {}
  assert.equal(payload.resultSummary?.runner?.executorProfile, 'local-process', 'OFFLINE_INGESTION_PAYLOAD_PROFILE_INVALID')
  assert.ok(queueSummary.jobCount >= 3, 'OFFLINE_INGESTION_JOB_SUMMARY_MISSING')
  assert.ok(queueSummary.queueableJobs >= 3, 'OFFLINE_INGESTION_QUEUEABLE_SUMMARY_MISSING')
  assert.ok(Array.isArray(queueSummary.jobs) && queueSummary.jobs.length >= 3, 'OFFLINE_INGESTION_JOB_LIST_MISSING')
  assert.ok(evidence.ingestionJobs >= queueSummary.jobCount, 'OFFLINE_INGESTION_EVIDENCE_JOB_MISMATCH')
  assert.ok(evidence.queueableJobs >= queueSummary.queueableJobs, 'OFFLINE_INGESTION_EVIDENCE_QUEUEABLE_MISMATCH')

  const report = await getCityOperationsReport(cityId)
  assert.equal(report.ok, true, report.error || 'OPERATIONS_REPORT_AFTER_INGESTION_RUNNER_NOT_OK')
  const reportHandoff = report.dataFactory?.offlineHandoffs?.find((entry) => entry.runId === result.runId)
  assert.ok(reportHandoff, 'OFFLINE_INGESTION_HANDOFF_NOT_LISTED')
  assert.equal(reportHandoff.resultStatus, 'succeeded', 'OFFLINE_INGESTION_RESULT_STATUS_NOT_LISTED')
  assert.equal(reportHandoff.postgisPromotionStatus, 'promoted', 'OFFLINE_INGESTION_PROMOTION_STATUS_NOT_LISTED')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    stageKey,
    runId: result.runId,
    executorProfile: result.executorProfile,
    result: {
      status: result.imported.result.status,
      artifactUri: result.imported.result.artifactUri,
      checksum: result.imported.result.checksum,
      byteSize: result.imported.result.byteSize,
      localPath: result.imported.result.localPath,
      ingestionQueue: {
        status: result.imported.result.promotion.postgis.status,
        evidence,
      },
    },
  }, null, 2))
} finally {
  await closeProductionPool()
}
