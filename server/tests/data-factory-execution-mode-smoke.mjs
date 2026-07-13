import assert from 'node:assert/strict'

import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import {
  getCityDataFactoryExecutionModeOverrides,
  getCityOperationsReport,
  saveCityDataFactoryExecutionMode,
} from '../services/ldtOpsService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
const stageKey = argValue('stage') || 'viewer-artifacts'

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

try {
  await runProductionMigrations()
  const initialOverrides = await getCityDataFactoryExecutionModeOverrides(cityId)
  const initialMode = initialOverrides[stageKey] ?? null

  try {
    const savedOffline = await saveCityDataFactoryExecutionMode({
      cityId,
      stageKey,
      executionMode: 'offline-data-factory',
      updatedBy: 'data-factory-execution-mode-smoke',
    })
    assert.equal(savedOffline.ok, true, 'DATA_FACTORY_EXECUTION_MODE_SAVE_NOT_OK')
    assert.equal(savedOffline.executionMode, 'offline-data-factory', 'DATA_FACTORY_EXECUTION_MODE_NOT_SAVED')

    const offlineReport = await getCityOperationsReport(cityId)
    assert.equal(offlineReport.ok, true, offlineReport.error || 'OPERATIONS_REPORT_NOT_OK')
    const offlineStage = offlineReport.dataFactory.stages.find((stage) => stage.key === stageKey)
    assert.ok(offlineStage, 'DATA_FACTORY_STAGE_NOT_FOUND')
    assert.equal(offlineStage.execution.recommendedMode, 'interactive-backend', 'DATA_FACTORY_RECOMMENDATION_UNEXPECTED')
    assert.equal(offlineStage.execution.selectedMode, 'offline-data-factory', 'DATA_FACTORY_SELECTED_MODE_NOT_APPLIED')
    assert.equal(offlineStage.execution.preferredMode, 'offline-data-factory', 'DATA_FACTORY_EFFECTIVE_MODE_NOT_APPLIED')
    assert.equal(offlineStage.execution.operatorOverride, true, 'DATA_FACTORY_OPERATOR_OVERRIDE_MISSING')
    assert.equal(offlineStage.execution.modeSource, 'operator-override', 'DATA_FACTORY_MODE_SOURCE_INVALID')
    assert.ok(offlineReport.dataFactory.offlineCandidateStages.includes(stageKey), 'DATA_FACTORY_OFFLINE_CANDIDATE_NOT_UPDATED')

    const cleared = await saveCityDataFactoryExecutionMode({
      cityId,
      stageKey,
      executionMode: 'recommended',
      updatedBy: 'data-factory-execution-mode-smoke',
    })
    assert.equal(cleared.ok, true, 'DATA_FACTORY_EXECUTION_MODE_CLEAR_NOT_OK')
    assert.equal(cleared.executionMode, null, 'DATA_FACTORY_EXECUTION_MODE_NOT_CLEARED')

    const recommendedReport = await getCityOperationsReport(cityId)
    assert.equal(recommendedReport.ok, true, recommendedReport.error || 'OPERATIONS_REPORT_AFTER_CLEAR_NOT_OK')
    const recommendedStage = recommendedReport.dataFactory.stages.find((stage) => stage.key === stageKey)
    assert.equal(recommendedStage.execution.operatorOverride, false, 'DATA_FACTORY_OPERATOR_OVERRIDE_NOT_CLEARED')
    assert.equal(recommendedStage.execution.selectedMode, recommendedStage.execution.recommendedMode, 'DATA_FACTORY_RECOMMENDATION_NOT_RESTORED')

    console.log(JSON.stringify({
      ok: true,
      cityId,
      stageKey,
      savedMode: savedOffline.executionMode,
      clearedMode: cleared.executionMode,
      restoredInitialMode: initialMode,
      offlineCandidateStages: offlineReport.dataFactory.offlineCandidateStages,
      stage: {
        recommendedMode: recommendedStage.execution.recommendedMode,
        selectedMode: recommendedStage.execution.selectedMode,
        operatorOverride: recommendedStage.execution.operatorOverride,
      },
    }, null, 2))
  } finally {
    if (initialMode) {
      await saveCityDataFactoryExecutionMode({
        cityId,
        stageKey,
        executionMode: initialMode,
        updatedBy: 'data-factory-execution-mode-smoke-restore',
      })
    } else {
      await saveCityDataFactoryExecutionMode({
        cityId,
        stageKey,
        executionMode: 'recommended',
        updatedBy: 'data-factory-execution-mode-smoke-restore',
      })
    }
  }
} finally {
  await closeProductionPool()
}
