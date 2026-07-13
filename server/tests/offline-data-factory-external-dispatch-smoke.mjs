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
const stageKey = argValue('stage') || 'semantic-materialization'

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

try {
  await runProductionMigrations()
  const result = await runOfflineDataFactoryJob({
    cityId,
    stageKey,
    executorProfile: 'external-worker',
    requestedBy: 'offline-data-factory-external-dispatch-smoke',
    submittedBy: 'offline-data-factory-external-dispatch-smoke',
    runnerOptions: {
      dispatchSmoke: true,
    },
  })

  assert.equal(result.ok, true, result.error || 'OFFLINE_DISPATCH_RUN_NOT_OK')
  assert.equal(result.cityId, cityId, 'OFFLINE_DISPATCH_CITY_MISMATCH')
  assert.equal(result.stageKey, stageKey, 'OFFLINE_DISPATCH_STAGE_MISMATCH')
  assert.equal(result.executorProfile, 'external-worker', 'OFFLINE_DISPATCH_PROFILE_INVALID')
  assert.ok(result.handoff?.handoff?.runId, 'OFFLINE_DISPATCH_HANDOFF_MISSING')

  const dispatch = result.dispatch?.dispatch
  assert.ok(dispatch, result.dispatch?.error || 'OFFLINE_DISPATCH_MISSING')
  assert.equal(dispatch.status, 'ready-for-external-runner', 'OFFLINE_DISPATCH_STATUS_INVALID')
  assert.equal(dispatch.executorProfile, 'external-worker', 'OFFLINE_DISPATCH_PAYLOAD_PROFILE_INVALID')
  assert.ok(dispatch.artifactUri?.startsWith('runtime://'), 'OFFLINE_DISPATCH_ARTIFACT_URI_INVALID')
  assert.ok(dispatch.checksum?.startsWith('sha256:'), 'OFFLINE_DISPATCH_CHECKSUM_MISSING')
  assert.ok(dispatch.byteSize > 0, 'OFFLINE_DISPATCH_EMPTY')
  assert.ok(dispatch.localPath && fs.existsSync(dispatch.localPath), 'OFFLINE_DISPATCH_FILE_MISSING')

  const payload = JSON.parse(fs.readFileSync(dispatch.localPath, 'utf8'))
  assert.equal(payload.schemaVersion, '2026-06-26.offline-data-factory-dispatch.v1', 'OFFLINE_DISPATCH_SCHEMA_INVALID')
  assert.equal(payload.status, 'ready-for-external-runner', 'OFFLINE_DISPATCH_FILE_STATUS_INVALID')
  assert.equal(payload.cityId, cityId, 'OFFLINE_DISPATCH_FILE_CITY_MISMATCH')
  assert.equal(payload.stageKey, stageKey, 'OFFLINE_DISPATCH_FILE_STAGE_MISMATCH')
  assert.equal(payload.executorProfile, 'external-worker', 'OFFLINE_DISPATCH_FILE_PROFILE_INVALID')
  assert.equal(payload.stageContract?.schemaVersion, '2026-06-26.data-factory-stage-contract.v1', 'OFFLINE_DISPATCH_STAGE_CONTRACT_MISSING')
  assert.ok(payload.stageContract.allowedRunnerProfiles.includes('external-worker'), 'OFFLINE_DISPATCH_EXTERNAL_PROFILE_MISSING')
  assert.ok(Array.isArray(payload.stageContract.artifacts), 'OFFLINE_DISPATCH_ARTIFACT_CONTRACT_MISSING')
  assert.ok(Array.isArray(payload.stageContract.validations) && payload.stageContract.validations.length > 0, 'OFFLINE_DISPATCH_VALIDATION_CONTRACT_MISSING')
  assert.equal(payload.runnerOptions?.dispatchSmoke, true, 'OFFLINE_DISPATCH_RUNNER_OPTIONS_MISSING')
  assert.ok(payload.handoff?.artifactUri?.startsWith('runtime://'), 'OFFLINE_DISPATCH_HANDOFF_URI_MISSING')
  assert.ok(payload.handoff?.checksum?.startsWith('sha256:'), 'OFFLINE_DISPATCH_HANDOFF_CHECKSUM_MISSING')
  assert.ok(payload.resultImport?.path?.includes(`/api/admin/cities/${cityId}/data-factory/offline-handoffs/${dispatch.runId}/result`), 'OFFLINE_DISPATCH_RESULT_IMPORT_PATH_INVALID')
  assert.ok(Array.isArray(payload.executionContract?.runnerMust) && payload.executionContract.runnerMust.length > 0, 'OFFLINE_DISPATCH_EXECUTION_CONTRACT_MISSING')
  assert.ok(Array.isArray(payload.logContract?.expectedArtifacts) && payload.logContract.expectedArtifacts.length > 0, 'OFFLINE_DISPATCH_LOG_CONTRACT_MISSING')
  assert.ok(payload.storageContract?.checksums, 'OFFLINE_DISPATCH_STORAGE_CONTRACT_MISSING')

  const report = await getCityOperationsReport(cityId)
  assert.equal(report.ok, true, report.error || 'OPERATIONS_REPORT_AFTER_DISPATCH_NOT_OK')
  const reportHandoff = report.dataFactory?.offlineHandoffs?.find((entry) => entry.runId === dispatch.runId)
  assert.ok(reportHandoff, 'OFFLINE_DISPATCH_HANDOFF_NOT_LISTED')
  assert.equal(reportHandoff.dispatchStatus, 'ready-for-external-runner', 'OFFLINE_DISPATCH_STATUS_NOT_LISTED')
  assert.equal(reportHandoff.dispatchExecutorProfile, 'external-worker', 'OFFLINE_DISPATCH_PROFILE_NOT_LISTED')
  assert.equal(reportHandoff.dispatchArtifactUri, dispatch.artifactUri, 'OFFLINE_DISPATCH_URI_NOT_LISTED')
  assert.equal(reportHandoff.resultStatus, null, 'OFFLINE_DISPATCH_SHOULD_NOT_IMPORT_RESULT')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    stageKey,
    runId: dispatch.runId,
    executorProfile: result.executorProfile,
    dispatch: {
      status: dispatch.status,
      artifactUri: dispatch.artifactUri,
      checksum: dispatch.checksum,
      byteSize: dispatch.byteSize,
      localPath: dispatch.localPath,
      resultImport: dispatch.resultImport?.path,
    },
  }, null, 2))
} finally {
  await closeProductionPool()
}
