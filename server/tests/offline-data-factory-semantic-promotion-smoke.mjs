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
const stageKey = 'semantic-materialization'

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

try {
  await runProductionMigrations()

  const handoff = await createOfflineDataFactoryHandoff({
    cityId,
    stageKey,
    requestedBy: 'offline-data-factory-semantic-promotion-smoke',
    submittedBy: 'offline-data-factory-semantic-promotion-smoke',
  })

  assert.equal(handoff.ok, true, handoff.error || 'OFFLINE_HANDOFF_NOT_OK')

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
      checks: [{ key: 'semantic-postgis-evidence', status: 'passed' }],
      summary: 'Offline semantic materialization has been loaded back into PostGIS and is ready for evidence verification.',
    },
    resultSummary: {
      mode: 'stage-applicator-smoke',
    },
    promotion: {
      mode: 'stage-applicator',
      postgis: {
        status: 'promoted',
        stageApplicator: 'semantic-materialization',
        expectedMinimums: {
          activeSemanticTags: 1,
          semanticClasses: 1,
          sourceMappings: 1,
          cityPackBindings: 1,
          serviceIndicators: 1,
          serviceFeatures: 1,
          serviceWorkflows: 1,
          workflowContracts: 1,
          ruleChecks: 1,
        },
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
    submittedBy: 'offline-data-factory-semantic-promotion-smoke',
  })

  assert.equal(imported.ok, true, imported.error || 'OFFLINE_SEMANTIC_PROMOTION_NOT_OK')
  assert.equal(imported.result?.promotion?.postgis?.status, 'promoted', 'POSTGIS_PROMOTION_STATUS_INVALID')
  assert.equal(
    imported.result?.promotion?.postgis?.applicator?.status,
    'validated',
    'POSTGIS_PROMOTION_APPLICATOR_NOT_VALIDATED',
  )
  assert.ok(imported.result?.promotion?.postgis?.evidence?.activeSemanticTags > 0, 'SEMANTIC_TAG_EVIDENCE_MISSING')
  assert.ok(imported.result?.localPath && fs.existsSync(imported.result.localPath), 'OFFLINE_PROMOTION_RESULT_FILE_MISSING')
  assert.equal(
    imported.run?.steps?.find((step) => step.stepKey === 'promote-postgis-results')?.status,
    'succeeded',
    'POSTGIS_PROMOTION_STEP_NOT_SUCCEEDED',
  )
  assert.equal(
    imported.run?.steps?.find((step) => step.stepKey === 'register-viewer-artifacts')?.status,
    'pending',
    'VIEWER_ARTIFACT_STEP_SHOULD_STAY_PENDING',
  )

  const payload = JSON.parse(fs.readFileSync(imported.result.localPath, 'utf8'))
  assert.equal(payload.promotion?.postgis?.status, 'promoted', 'PROMOTION_PAYLOAD_STATUS_INVALID')
  assert.ok(payload.promotion?.postgis?.evidence?.ruleChecks > 0, 'PROMOTION_PAYLOAD_RULE_CHECK_EVIDENCE_MISSING')

  const report = await getCityOperationsReport(cityId)
  assert.equal(report.ok, true, report.error || 'OPERATIONS_REPORT_AFTER_PROMOTION_NOT_OK')
  const reportHandoff = report.dataFactory?.offlineHandoffs?.find((entry) => entry.runId === handoff.handoff.runId)
  assert.ok(reportHandoff, 'PROMOTED_HANDOFF_NOT_LISTED_IN_OPERATIONS_REPORT')
  assert.equal(reportHandoff.postgisPromotionStatus, 'promoted', 'PROMOTION_STATUS_NOT_LISTED_IN_OPERATIONS_REPORT')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    runId: handoff.handoff.runId,
    promotion: {
      postgis: imported.result.promotion.postgis.status,
      evidence: imported.result.promotion.postgis.evidence,
    },
  }, null, 2))
} finally {
  await closeProductionPool()
}
