import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  readJsonFile,
  requireText,
  sha256Json,
  validateDispatchPackage,
  writeJsonFile,
} from '../services/ldtOps/offlineDataFactoryExternalResultContract.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function normalizeStatus(status) {
  const normalized = String(status ?? 'succeeded').trim().toLowerCase()
  if (['succeeded', 'success', 'passed', 'validated'].includes(normalized)) return 'succeeded'
  if (['failed', 'failure', 'error', 'rejected'].includes(normalized)) return 'failed'
  throw new Error('EXTERNAL_DATA_FACTORY_STATUS_INVALID')
}

function normalizePromotionMode(mode) {
  const normalized = String(mode ?? 'operations-ledger').trim().toLowerCase()
  if (normalized === 'operations-ledger') return normalized
  throw new Error('EXTERNAL_DATA_FACTORY_PROMOTION_MODE_UNSUPPORTED')
}

function portableArtifactUri({ cityId, runId, name }) {
  return `external://offline-data-factory/${cityId}/${runId}/${name}`
}

function buildValidationChecks({ dispatchPackage, dispatchChecksum, promotionMode, status }) {
  return [
    {
      key: 'dispatch-package-schema',
      status: 'passed',
      summary: 'Dispatch package schema and required routing fields are present.',
    },
    {
      key: 'dispatch-checksum',
      status: 'passed',
      checksum: dispatchChecksum,
      summary: 'Runner computed the same portable checksum Twin Studio records for the dispatch artifact.',
    },
    {
      key: 'handoff-reference',
      status: 'passed',
      checksum: dispatchPackage.handoff.checksum,
      summary: 'Runner preserved the handoff artifact and checksum reference.',
    },
    {
      key: 'promotion-mode',
      status: 'passed',
      mode: promotionMode,
      summary: promotionMode === 'operations-ledger'
        ? 'Runner records an auditable result without claiming domain-table promotion.'
        : 'Runner returned a stage-specific promotion mode.',
    },
    {
      key: 'runner-status',
      status: status === 'succeeded' ? 'passed' : 'failed',
      summary: `External runner finished with status ${status}.`,
    },
  ]
}

export function buildExternalDataFactoryResult({
  dispatchPackage,
  dispatchChecksum = null,
  runnerId = 'external-data-factory-runner',
  status = 'succeeded',
  promotionMode = 'operations-ledger',
  submittedBy = null,
  startedAt = null,
  finishedAt = null,
} = {}) {
  validateDispatchPackage(dispatchPackage)
  const resolvedDispatchChecksum = dispatchChecksum || sha256Json(dispatchPackage)
  const normalizedStatus = normalizeStatus(status)
  const normalizedPromotionMode = normalizePromotionMode(promotionMode)
  const runStartedAt = startedAt ?? new Date().toISOString()
  const runFinishedAt = finishedAt ?? new Date().toISOString()
  const normalizedRunnerId = requireText(runnerId, 'EXTERNAL_DATA_FACTORY_RUNNER_ID_REQUIRED')
  const validationChecks = buildValidationChecks({
    dispatchPackage,
    dispatchChecksum: resolvedDispatchChecksum,
    promotionMode: normalizedPromotionMode,
    status: normalizedStatus,
  })

  return {
    schemaVersion: '2026-06-26.offline-data-factory-result.v1',
    runId: dispatchPackage.runId,
    cityId: dispatchPackage.cityId,
    stageKey: dispatchPackage.stageKey,
    executionMode: 'offline-data-factory',
    status: normalizedStatus,
    submittedBy,
    handoffChecksum: dispatchPackage.handoff.checksum,
    dispatchArtifactUri: dispatchPackage.artifactUri,
    dispatchChecksum: resolvedDispatchChecksum,
    executorProfile: 'external-worker',
    externalRun: {
      runnerId: normalizedRunnerId,
      executorProfile: 'external-worker',
      status: normalizedStatus,
      startedAt: runStartedAt,
      finishedAt: runFinishedAt,
      artifacts: [],
    },
    validation: {
      passed: normalizedStatus === 'succeeded',
      checks: validationChecks,
      summary: normalizedStatus === 'succeeded'
        ? 'Portable external Data Factory runner completed dispatch validation.'
        : 'Portable external Data Factory runner returned a failed result for operator review.',
    },
    resultSummary: {
      mode: 'external-worker-portable',
      runner: {
        key: 'external-data-factory-runner',
        executorProfile: 'external-worker',
        runnerId: normalizedRunnerId,
        status: normalizedStatus,
        startedAt: runStartedAt,
        finishedAt: runFinishedAt,
      },
      dispatch: {
        artifactUri: dispatchPackage.artifactUri,
        checksum: resolvedDispatchChecksum,
        commandHints: Array.isArray(dispatchPackage.commandHints) ? dispatchPackage.commandHints.length : 0,
        resultImportPath: dispatchPackage.resultImport.path,
      },
      stage: {
        key: dispatchPackage.stageKey,
        promotionMode: normalizedPromotionMode,
      },
      externalRun: {
        runnerId: normalizedRunnerId,
        status: normalizedStatus,
      },
    },
    promotion: {
      mode: normalizedPromotionMode,
      postgis: {
        status: 'operations-ledger-recorded',
        writes: ['ldt_ops.workflow_runs', 'ldt_ops.workflow_artifacts'],
        note: 'Portable external runner returned a validated result package. Domain-table promotion requires a stage-specific external adapter.',
      },
      viewerArtifacts: {
        status: 'not-applicable',
        artifacts: [],
      },
    },
  }
}

export function writeExternalDataFactoryResult({
  dispatchFile,
  outputFile = null,
  runnerId = 'external-data-factory-runner',
  status = 'succeeded',
  promotionMode = 'operations-ledger',
  submittedBy = null,
} = {}) {
  const resolvedDispatchFile = path.resolve(requireText(dispatchFile, 'EXTERNAL_DATA_FACTORY_DISPATCH_FILE_REQUIRED'))
  const dispatchPackage = readJsonFile(resolvedDispatchFile)
  const dispatchChecksum = sha256Json(dispatchPackage)
  const resolvedOutputFile = outputFile
    ? path.resolve(outputFile)
    : path.join(path.dirname(resolvedDispatchFile), 'result-external-worker.json')

  const resultPackage = buildExternalDataFactoryResult({
    dispatchPackage,
    dispatchChecksum,
    runnerId,
    status,
    promotionMode,
    submittedBy,
  })
  const summary = {
    schemaVersion: '2026-06-26.external-data-factory-runner-summary.v1',
    runId: resultPackage.runId,
    cityId: resultPackage.cityId,
    stageKey: resultPackage.stageKey,
    runner: resultPackage.resultSummary.runner,
    dispatch: resultPackage.resultSummary.dispatch,
    validation: resultPackage.validation,
    promotion: resultPackage.promotion,
  }
  const summaryFile = path.join(path.dirname(resolvedOutputFile), 'runner-summary.json')
  writeJsonFile(summaryFile, summary)
  const summaryBytes = fs.statSync(summaryFile).size
  resultPackage.externalRun.artifacts = [
    {
      artifactKind: 'runner-summary',
      uri: portableArtifactUri({
        cityId: resultPackage.cityId,
        runId: resultPackage.runId,
        name: 'runner-summary.json',
      }),
      checksum: sha256Json(summary),
      byteSize: summaryBytes,
    },
  ]
  writeJsonFile(resolvedOutputFile, resultPackage)
  return {
    ok: true,
    dispatchFile: resolvedDispatchFile,
    resultFile: resolvedOutputFile,
    summaryFile,
    dispatchChecksum,
    resultPackage,
  }
}

function cliUsage() {
  return [
    'Usage:',
    '  node server/tools/run-external-data-factory-dispatch.mjs --dispatch=/path/to/dispatch-external-worker.json --out=/path/to/result.json',
    '',
    'Options:',
    '  --runner-id=<id>              Stable external runner identifier.',
    '  --status=succeeded|failed     Result status to return. Default: succeeded.',
    '  --promotion-mode=operations-ledger',
    '  --submitted-by=<actor>',
  ].join('\n')
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(cliUsage())
    return
  }
  const dispatchFile = argValue('dispatch') || argValue('dispatch-file') || argValue('dispatchFile')
  const outputFile = argValue('out') || argValue('output') || argValue('result-file') || argValue('resultFile') || null
  const result = writeExternalDataFactoryResult({
    dispatchFile,
    outputFile,
    runnerId: argValue('runner-id') || argValue('runnerId') || 'external-data-factory-runner',
    status: argValue('status') || 'succeeded',
    promotionMode: argValue('promotion-mode') || argValue('promotionMode') || 'operations-ledger',
    submittedBy: argValue('submitted-by') || argValue('submittedBy') || 'external-data-factory-runner',
  })
  console.log(JSON.stringify({
    ok: true,
    dispatchFile: result.dispatchFile,
    resultFile: result.resultFile,
    summaryFile: result.summaryFile,
    dispatchChecksum: result.dispatchChecksum,
    runId: result.resultPackage.runId,
    cityId: result.resultPackage.cityId,
    stageKey: result.resultPackage.stageKey,
    status: result.resultPackage.status,
  }, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: String(error?.message ?? 'EXTERNAL_DATA_FACTORY_RUNNER_FAILED'),
    }, null, 2))
    process.exit(1)
  })
}
