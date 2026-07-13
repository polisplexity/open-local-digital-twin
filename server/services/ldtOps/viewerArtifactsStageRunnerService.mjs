import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  readJsonFile,
  requireText,
  sha256Json,
  validateDispatchPackage,
  writeJsonFile,
} from './offlineDataFactoryExternalResultContract.mjs'
import { getRuntimeDir } from '../stateStore.mjs'
import { registerExistingViewerArtifacts } from '../viewerArtifacts/viewerArtifactScanner.mjs'

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(MODULE_DIR, '../../..')
const RESULT_SCHEMA_VERSION = '2026-06-26.offline-data-factory-result.v1'

function timestampVersion() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function asBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}

function activeArtifactsRequired(value) {
  return asBoolean(value, true)
}

function intValue(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(number)))
}

function optionalText(value) {
  return String(value ?? '').trim()
}

function extractJson(stdout, fallback = {}) {
  const text = String(stdout ?? '').trim()
  if (!text) return fallback
  try {
    return JSON.parse(text)
  } catch {
    const start = text.lastIndexOf('\n{')
    if (start >= 0) {
      try {
        return JSON.parse(text.slice(start + 1))
      } catch {
        return fallback
      }
    }
  }
  return fallback
}

function runToolStep({ key, command, args, env = {} }) {
  const startedAt = new Date().toISOString()
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      TWIN_STUDIO_RUNTIME_DIR: getRuntimeDir(),
      ...env,
    },
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 80,
  })
  const finishedAt = new Date().toISOString()
  const step = {
    key,
    command,
    args,
    status: result.status === 0 ? 'succeeded' : 'failed',
    exitCode: result.status,
    startedAt,
    finishedAt,
    stdout: String(result.stdout ?? '').slice(-4000),
    stderr: String(result.stderr ?? '').slice(-4000),
    output: extractJson(result.stdout, {}),
  }
  if (result.status !== 0) {
    const detail = step.stderr || step.stdout || `exit ${result.status}`
    const error = new Error(`VIEWER_ARTIFACT_STAGE_STEP_FAILED:${key}:${detail}`)
    error.step = step
    throw error
  }
  return step
}

function artifactKindForType(artifactType) {
  if (artifactType === '3d-tiles') return '3d-tiles'
  if (artifactType === 'mvt-directory') return 'mvt-directory'
  if (artifactType === 'pmtiles') return 'pmtiles'
  return artifactType || 'viewer-artifact'
}

function directoryFiles(directoryPath) {
  return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directoryPath, entry.name)
    if (entry.isDirectory()) return directoryFiles(entryPath)
    if (entry.isFile()) return [entryPath]
    return []
  })
}

function directoryByteSize(directoryPath) {
  return directoryFiles(directoryPath).reduce((total, filePath) => total + fs.statSync(filePath).size, 0)
}

function transferByteSize(localPath, fallbackByteSize) {
  if (!localPath || !fs.existsSync(localPath)) return Number(fallbackByteSize ?? 0)
  const stat = fs.statSync(localPath)
  if (stat.isDirectory()) return directoryByteSize(localPath)
  if (stat.isFile()) return stat.size
  return Number(fallbackByteSize ?? 0)
}

function viewerArtifactReference(artifact) {
  const localPath = optionalText(artifact.localPath)
  const registryByteSize = Number(artifact.byteSize ?? 0)
  const artifactTransferByteSize = transferByteSize(localPath, registryByteSize)
  return {
    artifactKind: artifactKindForType(artifact.artifactType),
    artifactKey: artifact.artifactKey,
    artifactType: artifact.artifactType,
    transport: artifact.transport,
    version: artifact.version,
    status: artifact.status,
    active: artifact.active,
    checksum: artifact.checksum,
    byteSize: artifactTransferByteSize,
    featureCount: Number(artifact.featureCount ?? 0),
    objectCount: Number(artifact.objectCount ?? 0),
    tileCount: Number(artifact.tileCount ?? 0),
    mediaType: artifact.mediaType,
    uri: artifact.uri,
    sourceUri: localPath ? pathToFileURL(localPath).toString() : artifact.uri,
    sourcePath: localPath || null,
    localPath: localPath || null,
    metadata: {
      ...(artifact.metadata ?? {}),
      bounds: artifact.bounds ?? {},
      generator: artifact.generator ?? null,
      registryByteSize,
      transferByteSize: artifactTransferByteSize,
    },
  }
}

function summarizeArtifacts(artifacts = []) {
  return artifacts.reduce((summary, artifact) => {
    summary.registeredArtifacts += 1
    summary.activeArtifacts += artifact.active ? 1 : 0
    summary.byteSize += Number(artifact.byteSize ?? 0)
    summary.featureCount += Number(artifact.featureCount ?? 0)
    summary.objectCount += Number(artifact.objectCount ?? 0)
    summary.tileCount += Number(artifact.tileCount ?? 0)
    if (artifact.artifactType === 'mvt-directory') summary.mvtDirectories += 1
    if (artifact.artifactType === 'pmtiles') summary.pmtiles += 1
    if (artifact.artifactType === '3d-tiles') summary.threeDTiles += 1
    return summary
  }, {
    registeredArtifacts: 0,
    activeArtifacts: 0,
    mvtDirectories: 0,
    pmtiles: 0,
    threeDTiles: 0,
    byteSize: 0,
    featureCount: 0,
    objectCount: 0,
    tileCount: 0,
  })
}

function expectedMinimums(summary) {
  return {
    registeredArtifacts: Math.max(1, Number(summary.registeredArtifacts ?? 0)),
    activeArtifacts: Number(summary.requireActiveArtifacts) === 0 ? 0 : Math.max(1, Number(summary.activeArtifacts ?? 0)),
    mvtDirectories: Math.max(1, Number(summary.mvtDirectories ?? 0)),
    pmtiles: Math.max(1, Number(summary.pmtiles ?? 0)),
    threeDTiles: Math.max(1, Number(summary.threeDTiles ?? 0)),
  }
}

function runnerSummaryArtifact({ resultPackage, outputDir }) {
  const summary = {
    schemaVersion: '2026-06-27.viewer-artifacts-stage-runner-summary.v1',
    runId: resultPackage.runId,
    cityId: resultPackage.cityId,
    stageKey: resultPackage.stageKey,
    runner: resultPackage.resultSummary.runner,
    viewerArtifacts: resultPackage.resultSummary.viewerArtifacts,
    validation: resultPackage.validation,
    promotion: resultPackage.promotion,
  }
  const summaryFile = path.join(outputDir, 'viewer-artifacts-runner-summary.json')
  writeJsonFile(summaryFile, summary)
  return {
    artifactKind: 'runner-summary',
    uri: pathToFileURL(summaryFile).toString(),
    sourcePath: summaryFile,
    checksum: sha256Json(summary),
    byteSize: fs.statSync(summaryFile).size,
    mediaType: 'application/json',
  }
}

export function buildViewerArtifactsStageResultPackage({
  dispatchPackage,
  dispatchChecksum = null,
  runnerId = 'viewer-artifacts-stage-runner',
  submittedBy = null,
  startedAt = null,
  finishedAt = null,
  version = null,
  steps = [],
  artifacts = [],
  requireActiveArtifacts = true,
} = {}) {
  validateDispatchPackage(dispatchPackage)
  if (dispatchPackage.stageKey !== 'viewer-artifacts') throw new Error('VIEWER_ARTIFACT_STAGE_REQUIRED')
  const normalizedRunnerId = requireText(runnerId, 'VIEWER_ARTIFACT_RUNNER_ID_REQUIRED')
  const resolvedDispatchChecksum = dispatchChecksum || sha256Json(dispatchPackage)
  const runStartedAt = startedAt ?? new Date().toISOString()
  const runFinishedAt = finishedAt ?? new Date().toISOString()
  const references = artifacts.map(viewerArtifactReference)
  const summary = summarizeArtifacts(artifacts)
  summary.requireActiveArtifacts = activeArtifactsRequired(requireActiveArtifacts) ? 1 : 0
  if (summary.registeredArtifacts < 1) throw new Error('VIEWER_ARTIFACT_STAGE_EMPTY')
  if (activeArtifactsRequired(requireActiveArtifacts) && summary.activeArtifacts < 1) throw new Error('VIEWER_ARTIFACT_STAGE_NO_ACTIVE_ARTIFACTS')

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    runId: dispatchPackage.runId,
    cityId: dispatchPackage.cityId,
    stageKey: 'viewer-artifacts',
    executionMode: 'offline-data-factory',
    status: 'succeeded',
    submittedBy,
    handoffChecksum: dispatchPackage.handoff.checksum,
    dispatchArtifactUri: dispatchPackage.artifactUri,
    dispatchChecksum: resolvedDispatchChecksum,
    executorProfile: 'external-worker',
    externalRun: {
      runnerId: normalizedRunnerId,
      executorProfile: 'external-worker',
      status: 'succeeded',
      startedAt: runStartedAt,
      finishedAt: runFinishedAt,
      artifacts: [],
      steps,
    },
    validation: {
      passed: true,
      checks: [
        { key: 'dispatch-package-schema', status: 'passed' },
        { key: 'dispatch-checksum', status: 'passed', checksum: resolvedDispatchChecksum },
        { key: 'viewer-artifact-builder-steps', status: 'passed', stepCount: steps.length },
        { key: 'viewer-artifact-registry', status: 'passed', activeArtifacts: summary.activeArtifacts },
        { key: 'heavy-artifact-checksums', status: 'passed', artifactCount: references.filter((artifact) => artifact.checksum).length },
      ],
      summary: 'External Data Factory runner generated viewer artifacts, registered them, and returned checksummed artifact references.',
    },
    resultSummary: {
      mode: 'external-worker-stage-runner',
      runner: {
        key: 'viewer-artifacts-stage-runner',
        executorProfile: 'external-worker',
        runnerId: normalizedRunnerId,
        status: 'succeeded',
        startedAt: runStartedAt,
        finishedAt: runFinishedAt,
      },
      dispatch: {
        artifactUri: dispatchPackage.artifactUri,
        checksum: resolvedDispatchChecksum,
        resultImportPath: dispatchPackage.resultImport?.path ?? null,
      },
      stage: {
        key: 'viewer-artifacts',
        promotionMode: 'stage-applicator',
        version,
      },
      viewerArtifacts: {
        ...summary,
        artifacts: references,
      },
    },
    promotion: {
      mode: 'stage-applicator',
      postgis: {
        status: 'not-applicable',
        writes: [],
        note: 'Viewer artifact promotion validates and registers publishable artifacts; canonical city rows remain in PostGIS.',
      },
      viewerArtifacts: {
        status: 'promoted',
        stageApplicator: 'viewer-artifacts',
        expectedMinimums: expectedMinimums(summary),
        artifacts: references,
      },
    },
  }
}

export async function writeViewerArtifactsExternalStageResult({
  dispatchFile,
  outputFile = null,
  runnerId = 'viewer-artifacts-stage-runner',
  submittedBy = null,
  version = null,
  mvtMinZoom = 10,
  mvtMaxZoom = 14,
  mvtMaxFeaturesPerTile = null,
  tilePartitions = 16,
  tilePartitionLimit = 12000,
  tilesetKey = 'base-buildings-partitioned',
  pmtilesBin = process.env.PMTILES_BIN || 'pmtiles',
  skipMvt = false,
  skipPmtiles = false,
  skipThreeDTiles = false,
  activateArtifacts = true,
} = {}) {
  const resolvedDispatchFile = path.resolve(requireText(dispatchFile, 'VIEWER_ARTIFACT_DISPATCH_FILE_REQUIRED'))
  const dispatchPackage = readJsonFile(resolvedDispatchFile)
  validateDispatchPackage(dispatchPackage)
  if (dispatchPackage.stageKey !== 'viewer-artifacts') throw new Error('VIEWER_ARTIFACT_STAGE_REQUIRED')
  const cityId = dispatchPackage.cityId
  const resolvedVersion = optionalText(version) || timestampVersion()
  const resolvedOutputFile = outputFile
    ? path.resolve(outputFile)
    : path.join(path.dirname(resolvedDispatchFile), 'result-viewer-artifacts-stage-runner.json')
  const outputDir = path.dirname(resolvedOutputFile)
  fs.mkdirSync(outputDir, { recursive: true })

  const startedAt = new Date().toISOString()
  const steps = []
  if (!asBoolean(skipThreeDTiles)) {
    steps.push(runToolStep({
      key: 'build-3d-tiles',
      command: process.execPath,
      args: [
        'server/tools/build-city-3d-tiles-partitioned.mjs',
        `--city=${cityId}`,
        `--version=${resolvedVersion}`,
        `--tileset-key=${tilesetKey}`,
        `--partitions=${intValue(tilePartitions, 16)}`,
        `--partition-limit=${intValue(tilePartitionLimit, 12000)}`,
      ],
    }))
  }
  if (!asBoolean(skipMvt)) {
    const args = [
      'server/tools/export-city-mvt-package.mjs',
      `--city=${cityId}`,
      `--version=${resolvedVersion}`,
      `--min-zoom=${intValue(mvtMinZoom, 10, { min: 0, max: 22 })}`,
      `--max-zoom=${intValue(mvtMaxZoom, 14, { min: 0, max: 22 })}`,
    ]
    if (asBoolean(activateArtifacts, true)) args.push('--activate')
    if (mvtMaxFeaturesPerTile) args.push(`--max-features-per-tile=${intValue(mvtMaxFeaturesPerTile, 0, { min: 1 })}`)
    steps.push(runToolStep({
      key: 'build-mvt-directory',
      command: process.execPath,
      args,
    }))
  }
  if (!asBoolean(skipPmtiles)) {
    steps.push(runToolStep({
      key: 'pack-pmtiles',
      command: process.env.PYTHON_BIN || 'python3',
      args: [
        'server/tools/pack-mvt-directory-pmtiles.py',
        `--city=${cityId}`,
        `--version=${resolvedVersion}`,
        `--runtime-dir=${getRuntimeDir()}`,
        `--pmtiles-bin=${pmtilesBin}`,
      ],
    }))
  }

  const registered = await registerExistingViewerArtifacts(cityId, { activateLatest: asBoolean(activateArtifacts, true) })
  const generatedArtifacts = registered.filter((artifact) => (
    artifact.status === 'ready' && artifact.version === resolvedVersion
  ))
  const currentArtifacts = generatedArtifacts.length > 0
    ? generatedArtifacts
    : registered.filter((artifact) => artifact.status === 'ready' && artifact.active === true)
  const finishedAt = new Date().toISOString()
  const resultPackage = buildViewerArtifactsStageResultPackage({
    dispatchPackage,
    dispatchChecksum: sha256Json(dispatchPackage),
    runnerId,
    submittedBy,
    startedAt,
    finishedAt,
    version: resolvedVersion,
    steps,
    artifacts: currentArtifacts,
    requireActiveArtifacts: asBoolean(activateArtifacts, true),
  })
  const summaryArtifact = runnerSummaryArtifact({ resultPackage, outputDir })
  resultPackage.externalRun.artifacts = [summaryArtifact]
  writeJsonFile(resolvedOutputFile, resultPackage)
  return {
    ok: true,
    dispatchFile: resolvedDispatchFile,
    resultFile: resolvedOutputFile,
    dispatchChecksum: resultPackage.dispatchChecksum,
    resultPackage,
  }
}
