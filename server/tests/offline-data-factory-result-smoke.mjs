import fs from 'node:fs'
import assert from 'node:assert/strict'

import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import {
  createOfflineDataFactoryHandoff,
  getCityOperationsReport,
  importOfflineDataFactoryResult,
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

  const handoff = await createOfflineDataFactoryHandoff({
    cityId,
    stageKey,
    requestedBy: 'offline-data-factory-result-smoke',
    submittedBy: 'offline-data-factory-result-smoke',
  })

  assert.equal(handoff.ok, true, handoff.error || 'OFFLINE_HANDOFF_NOT_OK')
  assert.ok(handoff.handoff?.checksum?.startsWith('sha256:'), 'OFFLINE_HANDOFF_CHECKSUM_MISSING')

  const resultPackage = {
    schemaVersion: '2026-06-26.offline-data-factory-result.v1',
    runId: handoff.handoff.runId,
    cityId,
    stageKey,
    executionMode: 'offline-data-factory',
    status: 'succeeded',
    handoffChecksum: handoff.handoff.checksum,
    validation: {
      passed: true,
      checks: [{ key: 'smoke-result-package', status: 'passed' }],
      summary: 'Smoke result package accepted.',
    },
    resultSummary: {
      semanticTags: 0,
      semanticPacks: 0,
      mode: 'operations-ledger-smoke',
    },
    promotion: {
      mode: 'operations-ledger',
      postgis: {
        status: 'operations-ledger-recorded',
        writes: ['ldt_ops.workflow_runs', 'ldt_ops.workflow_artifacts'],
        note: 'Smoke validates result import without domain-table writes.',
      },
      viewerArtifacts: {
        status: 'not-applicable',
        artifacts: [],
      },
    },
  }

  const imported = await importOfflineDataFactoryResult({
    cityId,
    runId: handoff.handoff.runId,
    resultPackage,
    submittedBy: 'offline-data-factory-result-smoke',
  })

  assert.equal(imported.ok, true, imported.error || 'OFFLINE_RESULT_IMPORT_NOT_OK')
  assert.equal(imported.result?.status, 'succeeded', 'OFFLINE_RESULT_STATUS_INVALID')
  assert.equal(imported.run?.status, 'succeeded', 'OFFLINE_RESULT_RUN_NOT_SUCCEEDED')
  assert.ok(imported.result?.artifactUri?.startsWith('runtime://'), 'OFFLINE_RESULT_ARTIFACT_URI_INVALID')
  assert.ok(imported.result?.checksum?.startsWith('sha256:'), 'OFFLINE_RESULT_CHECKSUM_MISSING')
  assert.ok(imported.result?.byteSize > 0, 'OFFLINE_RESULT_EMPTY')
  assert.ok(imported.result?.localPath && fs.existsSync(imported.result.localPath), 'OFFLINE_RESULT_FILE_MISSING')
  assert.ok(
    imported.run?.artifacts?.some((artifact) => artifact.artifactKind === 'offline-data-factory-result'),
    'OFFLINE_RESULT_ARTIFACT_NOT_ATTACHED_TO_RUN',
  )
  assert.equal(
    imported.run?.steps?.find((step) => step.stepKey === 'promote-postgis-results')?.status,
    'pending',
    'OFFLINE_LEDGER_ONLY_RESULT_SHOULD_NOT_PROMOTE_POSTGIS',
  )

  const payload = JSON.parse(fs.readFileSync(imported.result.localPath, 'utf8'))
  assert.equal(payload.cityId, cityId, 'OFFLINE_RESULT_PAYLOAD_CITY_MISMATCH')
  assert.equal(payload.stageKey, stageKey, 'OFFLINE_RESULT_PAYLOAD_STAGE_MISMATCH')
  assert.equal(payload.status, 'succeeded', 'OFFLINE_RESULT_PAYLOAD_STATUS_INVALID')
  assert.equal(payload.promotion?.mode, 'operations-ledger', 'OFFLINE_RESULT_PROMOTION_MODE_INVALID')

  const report = await getCityOperationsReport(cityId)
  assert.equal(report.ok, true, report.error || 'OPERATIONS_REPORT_AFTER_RESULT_NOT_OK')
  const reportHandoff = report.dataFactory?.offlineHandoffs?.find((entry) => entry.runId === handoff.handoff.runId)
  assert.ok(reportHandoff, 'OFFLINE_RESULT_HANDOFF_NOT_LISTED_IN_OPERATIONS_REPORT')
  assert.equal(reportHandoff.resultStatus, 'succeeded', 'OFFLINE_RESULT_STATUS_NOT_LISTED_IN_OPERATIONS_REPORT')
  assert.ok(reportHandoff.resultArtifactUri?.startsWith('runtime://'), 'OFFLINE_RESULT_ARTIFACT_NOT_LISTED_IN_OPERATIONS_REPORT')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    stageKey,
    runId: handoff.handoff.runId,
    result: {
      status: imported.result.status,
      artifactUri: imported.result.artifactUri,
      checksum: imported.result.checksum,
      byteSize: imported.result.byteSize,
      localPath: imported.result.localPath,
    },
  }, null, 2))
} finally {
  await closeProductionPool()
}
