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
const stageKey = 'environmental-extractors'

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
    requestedBy: 'offline-data-factory-environmental-extractors-runner-smoke',
    submittedBy: 'offline-data-factory-environmental-extractors-runner-smoke',
  })

  assert.equal(result.ok, true, 'OFFLINE_ENVIRONMENTAL_RUNNER_NOT_OK')
  assert.equal(result.cityId, cityId, 'OFFLINE_ENVIRONMENTAL_CITY_MISMATCH')
  assert.equal(result.stageKey, stageKey, 'OFFLINE_ENVIRONMENTAL_STAGE_MISMATCH')
  assert.equal(result.executorProfile, 'local-process', 'OFFLINE_ENVIRONMENTAL_PROFILE_INVALID')
  assert.ok(result.handoff?.handoff?.runId, 'OFFLINE_ENVIRONMENTAL_HANDOFF_MISSING')
  assert.equal(result.imported?.ok, true, result.imported?.error || 'OFFLINE_ENVIRONMENTAL_IMPORT_NOT_OK')
  assert.equal(result.imported?.run?.status, 'succeeded', 'OFFLINE_ENVIRONMENTAL_RUN_NOT_SUCCEEDED')
  assert.equal(result.imported?.result?.status, 'succeeded', 'OFFLINE_ENVIRONMENTAL_RESULT_NOT_SUCCEEDED')
  assert.equal(result.imported?.result?.promotion?.postgis?.status, 'promoted', 'OFFLINE_ENVIRONMENTAL_POSTGIS_NOT_PROMOTED')
  assert.equal(
    result.imported?.result?.promotion?.postgis?.applicator?.status,
    'validated',
    'OFFLINE_ENVIRONMENTAL_APPLICATOR_NOT_VALIDATED',
  )
  assert.equal(
    result.imported?.run?.steps?.find((step) => step.stepKey === 'run-offline-data-factory')?.status,
    'succeeded',
    'OFFLINE_ENVIRONMENTAL_RUN_STEP_NOT_SUCCEEDED',
  )
  assert.equal(
    result.imported?.run?.steps?.find((step) => step.stepKey === 'promote-postgis-results')?.status,
    'succeeded',
    'OFFLINE_ENVIRONMENTAL_PROMOTION_STEP_NOT_SUCCEEDED',
  )
  assert.equal(
    result.imported?.run?.steps?.find((step) => step.stepKey === 'register-viewer-artifacts')?.status,
    'succeeded',
    'OFFLINE_ENVIRONMENTAL_VIEWER_NOT_APPLICABLE_STEP_NOT_CLOSED',
  )
  assert.ok(result.imported?.result?.localPath && fs.existsSync(result.imported.result.localPath), 'OFFLINE_ENVIRONMENTAL_RESULT_FILE_MISSING')

  const payload = JSON.parse(fs.readFileSync(result.imported.result.localPath, 'utf8'))
  const extractorSummary = payload.resultSummary?.environmentalExtractors ?? {}
  const evidence = payload.promotion?.postgis?.evidence ?? {}
  assert.equal(payload.resultSummary?.runner?.executorProfile, 'local-process', 'OFFLINE_ENVIRONMENTAL_PAYLOAD_PROFILE_INVALID')
  assert.equal(extractorSummary.actualSourceDataDownloaded, false, 'OFFLINE_ENVIRONMENTAL_SOURCE_DOWNLOAD_CLAIM_INVALID')
  assert.ok(extractorSummary.runCount >= 4, 'OFFLINE_ENVIRONMENTAL_RUN_SUMMARY_MISSING')
  assert.ok(extractorSummary.sourcePlanRuns >= 4, 'OFFLINE_ENVIRONMENTAL_SOURCE_PLAN_SUMMARY_MISSING')
  assert.ok(evidence.extractorRuns >= extractorSummary.runCount, 'OFFLINE_ENVIRONMENTAL_EVIDENCE_RUN_MISMATCH')
  assert.ok(evidence.sourcePlanArtifacts >= extractorSummary.sourcePlanRuns, 'OFFLINE_ENVIRONMENTAL_EVIDENCE_ARTIFACT_MISMATCH')

  const report = await getCityOperationsReport(cityId)
  assert.equal(report.ok, true, report.error || 'OPERATIONS_REPORT_AFTER_ENVIRONMENTAL_RUNNER_NOT_OK')
  const environmentalStage = report.dataFactory?.stages?.find((stage) => stage.key === stageKey)
  assert.ok(environmentalStage, 'ENVIRONMENTAL_STAGE_NOT_LISTED')
  assert.ok(environmentalStage.execution?.availableModes?.includes('offline-data-factory'), 'ENVIRONMENTAL_STAGE_NOT_OFFLINE_ELIGIBLE')
  const reportHandoff = report.dataFactory?.offlineHandoffs?.find((entry) => entry.runId === result.runId)
  assert.ok(reportHandoff, 'OFFLINE_ENVIRONMENTAL_HANDOFF_NOT_LISTED')
  assert.equal(reportHandoff.resultStatus, 'succeeded', 'OFFLINE_ENVIRONMENTAL_RESULT_STATUS_NOT_LISTED')
  assert.equal(reportHandoff.postgisPromotionStatus, 'promoted', 'OFFLINE_ENVIRONMENTAL_PROMOTION_STATUS_NOT_LISTED')

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
      environmentalExtractors: {
        status: result.imported.result.promotion.postgis.status,
        evidence,
      },
    },
  }, null, 2))
} finally {
  await closeProductionPool()
}
