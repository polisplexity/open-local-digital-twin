import fs from 'node:fs'
import assert from 'node:assert/strict'

import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import {
  getCityOperationsReport,
  importOfflineDataFactoryResult,
  runOfflineDataFactoryJob,
} from '../services/ldtOpsService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function externalResultPackage({ cityId, stageKey, dispatch, handoffChecksum, dispatchChecksum }) {
  const now = new Date().toISOString()
  return {
    schemaVersion: '2026-06-26.offline-data-factory-result.v1',
    runId: dispatch.runId,
    cityId,
    stageKey,
    executionMode: 'offline-data-factory',
    status: 'succeeded',
    handoffChecksum,
    dispatchArtifactUri: dispatch.artifactUri,
    dispatchChecksum,
    executorProfile: 'external-worker',
    externalRun: {
      runnerId: 'external-result-smoke-runner',
      status: 'succeeded',
      startedAt: now,
      finishedAt: now,
      artifacts: [
        {
          artifactKind: 'runner-summary',
          uri: `runtime://artifacts/${cityId}/offline-data-factory/${dispatch.runId}/external-runner-summary.json`,
          checksum: 'sha256:external-result-smoke',
        },
      ],
    },
    validation: {
      passed: true,
      checks: [
        { key: 'external-dispatch-checksum', status: 'passed' },
        { key: 'external-runner-summary', status: 'passed' },
      ],
      summary: 'External result package returned through the dispatch contract.',
    },
    resultSummary: {
      mode: 'external-worker-smoke',
      runner: {
        executorProfile: 'external-worker',
        status: 'succeeded',
      },
    },
    promotion: {
      mode: 'operations-ledger',
      postgis: {
        status: 'operations-ledger-recorded',
        writes: ['ldt_ops.workflow_runs', 'ldt_ops.workflow_artifacts'],
        note: 'Smoke validates external result return contract without domain-table writes.',
      },
      viewerArtifacts: {
        status: 'not-applicable',
        artifacts: [],
      },
    },
  }
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
const stageKey = argValue('stage') || 'semantic-materialization'

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

try {
  await runProductionMigrations()
  const prepared = await runOfflineDataFactoryJob({
    cityId,
    stageKey,
    executorProfile: 'external-worker',
    requestedBy: 'offline-data-factory-external-result-smoke',
    submittedBy: 'offline-data-factory-external-result-smoke',
    runnerOptions: {
      externalResultSmoke: true,
    },
  })

  assert.equal(prepared.ok, true, prepared.error || 'EXTERNAL_RESULT_DISPATCH_NOT_OK')
  const dispatch = prepared.dispatch?.dispatch
  const handoff = prepared.handoff?.handoff
  assert.ok(dispatch?.checksum, 'EXTERNAL_RESULT_DISPATCH_CHECKSUM_MISSING')
  assert.ok(handoff?.checksum, 'EXTERNAL_RESULT_HANDOFF_CHECKSUM_MISSING')

  const rejected = await importOfflineDataFactoryResult({
    cityId,
    runId: dispatch.runId,
    resultPackage: externalResultPackage({
      cityId,
      stageKey,
      dispatch,
      handoffChecksum: handoff.checksum,
      dispatchChecksum: 'sha256:not-the-dispatch-checksum',
    }),
    submittedBy: 'offline-data-factory-external-result-smoke',
  })
  assert.equal(rejected.ok, false, 'EXTERNAL_RESULT_BAD_DISPATCH_SHOULD_FAIL')
  assert.match(rejected.error, /OFFLINE_RESULT_DISPATCH_CHECKSUM_MISMATCH/, 'EXTERNAL_RESULT_BAD_DISPATCH_ERROR_INVALID')

  const imported = await importOfflineDataFactoryResult({
    cityId,
    runId: dispatch.runId,
    resultPackage: externalResultPackage({
      cityId,
      stageKey,
      dispatch,
      handoffChecksum: handoff.checksum,
      dispatchChecksum: dispatch.checksum,
    }),
    submittedBy: 'offline-data-factory-external-result-smoke',
  })

  assert.equal(imported.ok, true, imported.error || 'EXTERNAL_RESULT_IMPORT_NOT_OK')
  assert.equal(imported.result?.status, 'succeeded', 'EXTERNAL_RESULT_STATUS_INVALID')
  assert.equal(imported.result?.dispatch?.checksum, dispatch.checksum, 'EXTERNAL_RESULT_DISPATCH_NOT_RECORDED')
  assert.equal(imported.result?.dispatch?.returnStatus, 'validated-return', 'EXTERNAL_RESULT_RETURN_STATUS_INVALID')
  assert.equal(imported.result?.externalRun?.status, 'succeeded', 'EXTERNAL_RESULT_RUN_STATUS_INVALID')
  assert.equal(imported.result?.externalRun?.runnerId, 'external-result-smoke-runner', 'EXTERNAL_RESULT_RUNNER_ID_INVALID')
  assert.equal(imported.result?.stageContract?.schemaVersion, '2026-06-26.data-factory-stage-contract.v1', 'EXTERNAL_RESULT_STAGE_CONTRACT_MISSING')
  assert.ok(imported.result.stageContract.allowedRunnerProfiles.includes('external-worker'), 'EXTERNAL_RESULT_EXTERNAL_PROFILE_MISSING')
  assert.ok(imported.result?.localPath && fs.existsSync(imported.result.localPath), 'EXTERNAL_RESULT_FILE_MISSING')

  const payload = JSON.parse(fs.readFileSync(imported.result.localPath, 'utf8'))
  assert.equal(payload.dispatch?.checksum, dispatch.checksum, 'EXTERNAL_RESULT_PAYLOAD_DISPATCH_MISMATCH')
  assert.equal(payload.externalRun?.runnerId, 'external-result-smoke-runner', 'EXTERNAL_RESULT_PAYLOAD_RUNNER_MISSING')
  assert.equal(payload.stageContract?.schemaVersion, '2026-06-26.data-factory-stage-contract.v1', 'EXTERNAL_RESULT_PAYLOAD_STAGE_CONTRACT_MISSING')
  assert.ok(Array.isArray(payload.stageContract.validations) && payload.stageContract.validations.length > 0, 'EXTERNAL_RESULT_PAYLOAD_VALIDATIONS_MISSING')

  const report = await getCityOperationsReport(cityId)
  assert.equal(report.ok, true, report.error || 'OPERATIONS_REPORT_AFTER_EXTERNAL_RESULT_NOT_OK')
  const reportHandoff = report.dataFactory?.offlineHandoffs?.find((entry) => entry.runId === dispatch.runId)
  assert.ok(reportHandoff, 'EXTERNAL_RESULT_HANDOFF_NOT_LISTED')
  assert.equal(reportHandoff.dispatchReturnStatus, 'validated-return', 'EXTERNAL_RESULT_RETURN_STATUS_NOT_LISTED')
  assert.equal(reportHandoff.resultExecutorProfile, 'external-worker', 'EXTERNAL_RESULT_PROFILE_NOT_LISTED')
  assert.equal(reportHandoff.externalRunStatus, 'succeeded', 'EXTERNAL_RESULT_RUN_STATUS_NOT_LISTED')
  assert.equal(reportHandoff.externalRunRunnerId, 'external-result-smoke-runner', 'EXTERNAL_RESULT_RUNNER_ID_NOT_LISTED')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    stageKey,
    runId: dispatch.runId,
    rejectedBadChecksum: true,
    result: {
      status: imported.result.status,
      artifactUri: imported.result.artifactUri,
      checksum: imported.result.checksum,
      dispatchChecksum: imported.result.dispatch.checksum,
      externalRunStatus: imported.result.externalRun.status,
      localPath: imported.result.localPath,
    },
  }, null, 2))
} finally {
  await closeProductionPool()
}
