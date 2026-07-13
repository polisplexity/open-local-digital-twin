import fs from 'node:fs'
import assert from 'node:assert/strict'

import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import { runOfflineDataFactoryJob } from '../services/ldtOpsService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function booleanArg(name) {
  return process.argv.includes(`--${name}`) || process.argv.includes(`--${name}=true`)
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
    requestedBy: 'offline-data-factory-environmental-extractors-execute-smoke',
    submittedBy: 'offline-data-factory-environmental-extractors-execute-smoke',
    runnerOptions: {
      environmentalMode: 'execute-existing-adapters',
      scenarioKey: argValue('scenario') || 'baseline',
      terrainGridKey: argValue('terrain-grid-key') || 'city-density-2km',
      terrainTileZoom: argValue('terrain-tile-zoom') || 12,
      weatherGridResolutionM: argValue('weather-grid-resolution-m') || 6000,
      surfaceRunoff: !booleanArg('skip-runoff'),
    },
  })

  assert.equal(result.ok, true, 'OFFLINE_ENVIRONMENTAL_EXECUTE_RUNNER_NOT_OK')
  assert.equal(result.cityId, cityId, 'OFFLINE_ENVIRONMENTAL_EXECUTE_CITY_MISMATCH')
  assert.equal(result.stageKey, stageKey, 'OFFLINE_ENVIRONMENTAL_EXECUTE_STAGE_MISMATCH')
  assert.equal(result.imported?.ok, true, result.imported?.error || 'OFFLINE_ENVIRONMENTAL_EXECUTE_IMPORT_NOT_OK')
  assert.equal(result.imported?.result?.promotion?.postgis?.status, 'promoted', 'OFFLINE_ENVIRONMENTAL_EXECUTE_POSTGIS_NOT_PROMOTED')
  assert.equal(
    result.imported?.result?.promotion?.postgis?.applicator?.status,
    'validated',
    'OFFLINE_ENVIRONMENTAL_EXECUTE_APPLICATOR_NOT_VALIDATED',
  )
  assert.ok(result.imported?.result?.localPath && fs.existsSync(result.imported.result.localPath), 'OFFLINE_ENVIRONMENTAL_EXECUTE_RESULT_FILE_MISSING')

  const payload = JSON.parse(fs.readFileSync(result.imported.result.localPath, 'utf8'))
  const summary = payload.resultSummary?.environmentalExtractors ?? {}
  const evidence = payload.promotion?.postgis?.evidence ?? {}
  assert.equal(summary.mode, 'execute-existing-adapters', 'OFFLINE_ENVIRONMENTAL_EXECUTE_MODE_INVALID')
  assert.equal(summary.actualSourceDataDownloaded, true, 'OFFLINE_ENVIRONMENTAL_EXECUTE_SOURCE_FLAG_INVALID')
  assert.ok(summary.completedExtractorRuns >= 3, 'OFFLINE_ENVIRONMENTAL_EXECUTE_COMPLETED_RUNS_LOW')
  assert.ok(summary.phenomenonCells > 0, 'OFFLINE_ENVIRONMENTAL_EXECUTE_CELLS_LOW')
  assert.ok(summary.objectObservations > 0, 'OFFLINE_ENVIRONMENTAL_EXECUTE_OBSERVATIONS_LOW')
  assert.ok(evidence.completedExtractorRuns >= 3, 'OFFLINE_ENVIRONMENTAL_EXECUTE_EVIDENCE_COMPLETED_RUNS_LOW')
  assert.ok(evidence.phenomenonCells > 0, 'OFFLINE_ENVIRONMENTAL_EXECUTE_EVIDENCE_CELLS_LOW')
  assert.ok(evidence.objectObservations > 0, 'OFFLINE_ENVIRONMENTAL_EXECUTE_EVIDENCE_OBSERVATIONS_LOW')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    stageKey,
    runId: result.runId,
    result: {
      status: result.imported.result.status,
      artifactUri: result.imported.result.artifactUri,
      checksum: result.imported.result.checksum,
      byteSize: result.imported.result.byteSize,
      localPath: result.imported.result.localPath,
      summary: {
        mode: summary.mode,
        scenarioKey: summary.scenarioKey,
        completedExtractorRuns: summary.completedExtractorRuns,
        sourceBackedLayers: summary.sourceBackedLayers,
        phenomenonCells: summary.phenomenonCells,
        objectObservations: summary.objectObservations,
        objectSummaries: summary.objectSummaries,
        simulationRuns: summary.simulationRuns,
        scenarioOutputs: summary.scenarioOutputs,
      },
      evidence,
    },
  }, null, 2))
} finally {
  await closeProductionPool()
}
