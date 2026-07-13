import fs from 'node:fs'
import assert from 'node:assert/strict'

import { closeProductionPool, getProductionPool } from '../db/postgisPool.mjs'
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

function booleanArg(name) {
  return process.argv.includes(`--${name}`) || process.argv.includes(`--${name}=true`)
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
const stageKey = 'viewer-artifacts'
const forceRebuild = booleanArg('force-rebuild') || booleanArg('forceRebuild')

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
    requestedBy: 'offline-data-factory-viewer-artifacts-runner-smoke',
    submittedBy: 'offline-data-factory-viewer-artifacts-runner-smoke',
    runnerOptions: {
      forceRebuild,
    },
  })

  assert.equal(result.ok, true, 'OFFLINE_VIEWER_ARTIFACT_RUNNER_NOT_OK')
  assert.equal(result.cityId, cityId, 'OFFLINE_VIEWER_ARTIFACT_CITY_MISMATCH')
  assert.equal(result.stageKey, stageKey, 'OFFLINE_VIEWER_ARTIFACT_STAGE_MISMATCH')
  assert.equal(result.executorProfile, 'local-process', 'OFFLINE_VIEWER_ARTIFACT_PROFILE_INVALID')
  assert.ok(result.handoff?.handoff?.runId, 'OFFLINE_VIEWER_ARTIFACT_HANDOFF_MISSING')
  assert.equal(result.imported?.ok, true, result.imported?.error || 'OFFLINE_VIEWER_ARTIFACT_IMPORT_NOT_OK')
  assert.equal(result.imported?.run?.status, 'succeeded', 'OFFLINE_VIEWER_ARTIFACT_RUN_NOT_SUCCEEDED')
  assert.equal(result.imported?.result?.status, 'succeeded', 'OFFLINE_VIEWER_ARTIFACT_RESULT_NOT_SUCCEEDED')
  assert.equal(
    result.imported?.result?.promotion?.viewerArtifacts?.status,
    'promoted',
    'OFFLINE_VIEWER_ARTIFACTS_NOT_PROMOTED',
  )
  assert.equal(
    result.imported?.result?.promotion?.viewerArtifacts?.applicator?.status,
    'validated',
    'OFFLINE_VIEWER_ARTIFACT_APPLICATOR_NOT_VALIDATED',
  )
  assert.equal(
    result.imported?.run?.steps?.find((step) => step.stepKey === 'run-offline-data-factory')?.status,
    'succeeded',
    'OFFLINE_VIEWER_ARTIFACT_RUN_STEP_NOT_SUCCEEDED',
  )
  assert.equal(
    result.imported?.run?.steps?.find((step) => step.stepKey === 'promote-postgis-results')?.status,
    'succeeded',
    'OFFLINE_VIEWER_ARTIFACT_POSTGIS_NOT_APPLICABLE_STEP_NOT_CLOSED',
  )
  assert.equal(
    result.imported?.run?.steps?.find((step) => step.stepKey === 'register-viewer-artifacts')?.status,
    'succeeded',
    'OFFLINE_VIEWER_ARTIFACT_REGISTRY_STEP_NOT_SUCCEEDED',
  )
  assert.ok(result.imported?.result?.localPath && fs.existsSync(result.imported.result.localPath), 'OFFLINE_VIEWER_ARTIFACT_RESULT_FILE_MISSING')

  const payload = JSON.parse(fs.readFileSync(result.imported.result.localPath, 'utf8'))
  const viewerSummary = payload.resultSummary?.viewerArtifacts ?? {}
  const evidence = payload.promotion?.viewerArtifacts?.evidence ?? {}
  const applicator = payload.promotion?.viewerArtifacts?.applicator ?? {}
  assert.equal(payload.resultSummary?.runner?.executorProfile, 'local-process', 'OFFLINE_VIEWER_ARTIFACT_PAYLOAD_PROFILE_INVALID')
  assert.ok(viewerSummary.registeredArtifacts > 0, 'OFFLINE_VIEWER_ARTIFACT_SUMMARY_MISSING')
  assert.ok(viewerSummary.activeArtifacts > 0, 'OFFLINE_VIEWER_ARTIFACT_ACTIVE_SUMMARY_MISSING')
  assert.ok(evidence.registeredArtifacts >= viewerSummary.registeredArtifacts, 'OFFLINE_VIEWER_ARTIFACT_EVIDENCE_REGISTERED_MISMATCH')
  assert.ok(evidence.activeArtifacts > 0, 'OFFLINE_VIEWER_ARTIFACT_EVIDENCE_ACTIVE_MISSING')
  assert.ok(evidence.threeDTiles > 0, 'OFFLINE_VIEWER_ARTIFACT_3D_TILES_EVIDENCE_MISSING')
  assert.equal(
    applicator.stageResult?.expectedArtifacts,
    applicator.stageResult?.stagedArtifacts,
    'OFFLINE_VIEWER_ARTIFACT_STAGE_RESULT_NOT_COMPLETE',
  )

  const pool = getProductionPool()
  const tilesetResult = await pool.query(
    `
      SELECT count(*)::int AS tilesets
      FROM ldt_viewer.city_3d_tilesets
      WHERE city_id = $1
        AND version = $2
        AND status = 'ready'
    `,
    [cityId, payload.promotion?.viewerArtifacts?.artifacts?.find((artifact) => artifact.artifactType === '3d-tiles')?.version ?? ''],
  )
  assert.ok(Number(tilesetResult.rows[0]?.tilesets ?? 0) > 0, 'OFFLINE_VIEWER_ARTIFACT_CITY_3D_TILESET_NOT_REGISTERED')

  const report = await getCityOperationsReport(cityId)
  assert.equal(report.ok, true, report.error || 'OPERATIONS_REPORT_AFTER_VIEWER_ARTIFACT_RUNNER_NOT_OK')
  const reportHandoff = report.dataFactory?.offlineHandoffs?.find((entry) => entry.runId === result.runId)
  assert.ok(reportHandoff, 'OFFLINE_VIEWER_ARTIFACT_HANDOFF_NOT_LISTED')
  assert.equal(reportHandoff.resultStatus, 'succeeded', 'OFFLINE_VIEWER_ARTIFACT_RESULT_STATUS_NOT_LISTED')
  assert.equal(reportHandoff.viewerPromotionStatus, 'promoted', 'OFFLINE_VIEWER_ARTIFACT_PROMOTION_STATUS_NOT_LISTED')

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
      viewerArtifacts: {
        status: result.imported.result.promotion.viewerArtifacts.status,
        evidence,
      },
    },
  }, null, 2))
} finally {
  await closeProductionPool()
}
