import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

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
    requestedBy: 'offline-data-factory-external-runner-smoke',
    submittedBy: 'offline-data-factory-external-runner-smoke',
    runnerOptions: {
      externalRunnerSmoke: true,
    },
  })

  assert.equal(prepared.ok, true, prepared.error || 'EXTERNAL_RUNNER_DISPATCH_NOT_OK')
  const dispatch = prepared.dispatch?.dispatch
  assert.ok(dispatch?.localPath && fs.existsSync(dispatch.localPath), 'EXTERNAL_RUNNER_DISPATCH_FILE_MISSING')
  assert.ok(dispatch?.checksum, 'EXTERNAL_RUNNER_DISPATCH_CHECKSUM_MISSING')

  const resultPath = path.join(path.dirname(dispatch.localPath), 'external-runner-smoke-result.json')
  const cli = spawnSync(
    process.execPath,
    [
      'server/tools/run-external-data-factory-dispatch.mjs',
      `--dispatch=${dispatch.localPath}`,
      `--out=${resultPath}`,
      '--runner-id=external-runner-smoke',
      '--submitted-by=offline-data-factory-external-runner-smoke',
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  if (cli.stdout) process.stdout.write(cli.stdout.endsWith('\n') ? cli.stdout : `${cli.stdout}\n`)
  if (cli.stderr) process.stderr.write(cli.stderr.endsWith('\n') ? cli.stderr : `${cli.stderr}\n`)
  assert.equal(cli.status, 0, 'EXTERNAL_RUNNER_CLI_FAILED')
  assert.ok(fs.existsSync(resultPath), 'EXTERNAL_RUNNER_RESULT_FILE_MISSING')

  const runnerOutput = JSON.parse(cli.stdout)
  assert.equal(runnerOutput.ok, true, 'EXTERNAL_RUNNER_OUTPUT_NOT_OK')
  assert.equal(runnerOutput.dispatchChecksum, dispatch.checksum, 'EXTERNAL_RUNNER_DISPATCH_CHECKSUM_MISMATCH')

  const resultPackage = JSON.parse(fs.readFileSync(resultPath, 'utf8'))
  assert.equal(resultPackage.runId, dispatch.runId, 'EXTERNAL_RUNNER_RESULT_RUN_MISMATCH')
  assert.equal(resultPackage.cityId, cityId, 'EXTERNAL_RUNNER_RESULT_CITY_MISMATCH')
  assert.equal(resultPackage.stageKey, stageKey, 'EXTERNAL_RUNNER_RESULT_STAGE_MISMATCH')
  assert.equal(resultPackage.executorProfile, 'external-worker', 'EXTERNAL_RUNNER_RESULT_PROFILE_INVALID')
  assert.equal(resultPackage.dispatchChecksum, dispatch.checksum, 'EXTERNAL_RUNNER_RESULT_DISPATCH_CHECKSUM_INVALID')
  assert.equal(resultPackage.externalRun?.runnerId, 'external-runner-smoke', 'EXTERNAL_RUNNER_RESULT_RUNNER_ID_INVALID')
  assert.ok(Array.isArray(resultPackage.validation?.checks) && resultPackage.validation.checks.length >= 1, 'EXTERNAL_RUNNER_VALIDATION_CHECKS_MISSING')

  const imported = await importOfflineDataFactoryResult({
    cityId,
    runId: dispatch.runId,
    resultPackage,
    submittedBy: 'offline-data-factory-external-runner-smoke',
  })

  assert.equal(imported.ok, true, imported.error || 'EXTERNAL_RUNNER_IMPORT_NOT_OK')
  assert.equal(imported.result?.status, 'succeeded', 'EXTERNAL_RUNNER_IMPORT_STATUS_INVALID')
  assert.equal(imported.result?.dispatch?.returnStatus, 'validated-return', 'EXTERNAL_RUNNER_IMPORT_RETURN_STATUS_INVALID')
  assert.equal(imported.result?.externalRun?.runnerId, 'external-runner-smoke', 'EXTERNAL_RUNNER_IMPORT_RUNNER_ID_INVALID')

  const report = await getCityOperationsReport(cityId)
  assert.equal(report.ok, true, report.error || 'OPERATIONS_REPORT_AFTER_EXTERNAL_RUNNER_NOT_OK')
  const reportHandoff = report.dataFactory?.offlineHandoffs?.find((entry) => entry.runId === dispatch.runId)
  assert.ok(reportHandoff, 'EXTERNAL_RUNNER_HANDOFF_NOT_LISTED')
  assert.equal(reportHandoff.dispatchReturnStatus, 'validated-return', 'EXTERNAL_RUNNER_RETURN_STATUS_NOT_LISTED')
  assert.equal(reportHandoff.resultExecutorProfile, 'external-worker', 'EXTERNAL_RUNNER_PROFILE_NOT_LISTED')
  assert.equal(reportHandoff.externalRunRunnerId, 'external-runner-smoke', 'EXTERNAL_RUNNER_ID_NOT_LISTED')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    stageKey,
    runId: dispatch.runId,
    dispatch: {
      artifactUri: dispatch.artifactUri,
      checksum: dispatch.checksum,
      localPath: dispatch.localPath,
    },
    externalRunner: {
      resultPath,
      runnerId: imported.result.externalRun.runnerId,
      returnStatus: imported.result.dispatch.returnStatus,
    },
  }, null, 2))
} finally {
  await closeProductionPool()
}
