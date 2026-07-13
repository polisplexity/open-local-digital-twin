import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'

import { writeExternalDataFactoryResult } from './run-external-data-factory-dispatch.mjs'
import { writeViewerArtifactsExternalStageResult } from '../services/ldtOps/viewerArtifactsStageRunnerService.mjs'
import { restoreCityInputPackage } from '../services/ldtOps/cityInputPackageService.mjs'

const DEFAULT_INTERVAL_MS = 30_000

function argValue(name, argv = process.argv.slice(2)) {
  const prefix = `--${name}=`
  const arg = argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function booleanArg(name, argv = process.argv.slice(2)) {
  return argv.includes(`--${name}`) || argv.includes(`--${name}=true`)
}

function numberArg(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = Number(argValue(name))
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(value)))
}

function booleanArgValue(name, fallback = false, argv = process.argv.slice(2)) {
  const raw = argValue(name, argv)
  if (!raw) return booleanArg(name, argv) || fallback
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase())
}

function requireText(value, errorCode) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(errorCode)
  return text
}

function normalizeBaseUrl(value) {
  const url = requireText(value, 'TWIN_STUDIO_URL_REQUIRED').replace(/\/+$/g, '')
  if (!/^https?:\/\//i.test(url)) throw new Error('TWIN_STUDIO_URL_INVALID')
  return url
}

function writeJsonFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

async function postJson(url, { token, body }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  })
  const text = await response.text()
  let payload = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { raw: text }
  }
  if (!response.ok) {
    const error = new Error(payload.error || payload.detail || `HTTP_${response.status}`)
    error.status = response.status
    error.payload = payload
    throw error
  }
  return payload
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', resolve)
  })
  return `sha256:${hash.digest('hex')}`
}

async function postFile(url, { token, filePath, headers = {} }) {
  const parsed = new URL(url)
  const transport = parsed.protocol === 'https:' ? https : http
  const byteSize = fs.statSync(filePath).size
  return new Promise((resolve, reject) => {
    const request = transport.request(parsed, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/gzip',
        'content-length': byteSize,
        ...headers,
      },
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('error', reject)
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let payload = {}
        try {
          payload = text ? JSON.parse(text) : {}
        } catch {
          payload = { raw: text }
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error(payload.error || payload.detail || `HTTP_${response.statusCode}`)
          error.status = response.statusCode
          error.payload = payload
          reject(error)
          return
        }
        resolve(payload)
      })
    })
    request.on('error', reject)
    fs.createReadStream(filePath).on('error', reject).pipe(request)
  })
}

function posixPath(value) {
  return String(value ?? '').split(path.sep).join('/')
}

function pathIsInside(parent, child) {
  const relative = path.relative(parent, child)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function artifactReferences(resultPackage = {}) {
  const artifacts = []
  if (Array.isArray(resultPackage.externalRun?.artifacts)) artifacts.push(...resultPackage.externalRun.artifacts)
  if (Array.isArray(resultPackage.artifacts)) artifacts.push(...resultPackage.artifacts)
  if (Array.isArray(resultPackage.promotion?.viewerArtifacts?.artifacts)) artifacts.push(...resultPackage.promotion.viewerArtifacts.artifacts)
  return artifacts
}

function runtimeBundleMembers({ resultPackage, runtimeDir }) {
  const resolvedRuntimeDir = path.resolve(runtimeDir)
  const members = new Set()
  for (const artifact of artifactReferences(resultPackage)) {
    const localPath = String(artifact.localPath ?? artifact.local_path ?? artifact.sourcePath ?? artifact.source_path ?? '').trim()
    if (!localPath) continue
    const resolvedPath = path.resolve(localPath)
    if (!fs.existsSync(resolvedPath) || !pathIsInside(resolvedRuntimeDir, resolvedPath)) continue
    const relative = posixPath(path.relative(resolvedRuntimeDir, resolvedPath))
    if (relative.startsWith('artifacts/') || relative.startsWith('3d-tiles/')) members.add(relative)
    if (artifact.artifactType === 'pmtiles' || artifact.artifactKind === 'pmtiles') {
      const manifestPath = resolvedPath.replace(/\.pmtiles$/i, '.manifest.json')
      if (fs.existsSync(manifestPath) && pathIsInside(resolvedRuntimeDir, manifestPath)) {
        members.add(posixPath(path.relative(resolvedRuntimeDir, manifestPath)))
      }
    }
  }
  return Array.from(members).sort()
}

async function createRuntimeArtifactBundle({ resultPackage, runtimeDir, outputDir }) {
  const members = runtimeBundleMembers({ resultPackage, runtimeDir })
  if (members.length === 0) throw new Error('RUNTIME_ARTIFACT_BUNDLE_NO_RUNTIME_MEMBERS')
  const bundleFile = path.join(outputDir, 'runtime-artifacts-bundle.tgz')
  fs.rmSync(bundleFile, { force: true })
  fs.mkdirSync(outputDir, { recursive: true })
  const tar = spawnSync('tar', ['-czf', bundleFile, '-C', path.resolve(runtimeDir), ...members], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 80,
  })
  if (tar.status !== 0) {
    throw new Error(`RUNTIME_ARTIFACT_BUNDLE_CREATE_FAILED:${tar.stderr || tar.stdout || tar.status}`)
  }
  return {
    filePath: bundleFile,
    name: path.basename(bundleFile),
    checksum: await sha256File(bundleFile),
    byteSize: fs.statSync(bundleFile).size,
    memberCount: members.length,
    members,
  }
}

async function uploadRuntimeArtifactBundle({ config, claim, resultPackage, runDir }) {
  const bundle = await createRuntimeArtifactBundle({
    resultPackage,
    runtimeDir: config.runtimeDir,
    outputDir: runDir,
  })
  const uploadUrl = `${config.twinStudioUrl}/api/data-factory/processing-nodes/${encodeURIComponent(config.nodeKey)}/dispatches/${encodeURIComponent(claim.dispatchId)}/artifacts/runtime-bundle`
  const uploaded = await postFile(uploadUrl, {
    token: config.token,
    filePath: bundle.filePath,
    headers: {
      'x-data-factory-artifact-checksum': bundle.checksum,
      'x-data-factory-artifact-name': bundle.name,
      'x-data-factory-submitted-by': config.submittedBy,
    },
  })
  return {
    schemaVersion: '2026-06-27.runtime-artifact-bundle-upload.v1',
    status: 'uploaded',
    uploadUrl,
    filePath: bundle.filePath,
    name: bundle.name,
    checksum: bundle.checksum,
    byteSize: bundle.byteSize,
    memberCount: bundle.memberCount,
    members: bundle.members,
    received: uploaded.artifact ?? null,
  }
}

function buildConfig(argv = process.argv.slice(2), env = process.env) {
  const nodeKey = requireText(
    argValue('node-key', argv) || env.DATAFACTORY_NODE_KEY,
    'DATAFACTORY_NODE_KEY_REQUIRED',
  )
  const token = requireText(
    argValue('runtime-token', argv) || env.TWIN_STUDIO_DATA_FACTORY_TOKEN || env.DATAFACTORY_RUNTIME_TOKEN,
    'TWIN_STUDIO_DATA_FACTORY_TOKEN_REQUIRED',
  )
  const twinStudioUrl = normalizeBaseUrl(
    argValue('twin-studio-url', argv) || env.TWIN_STUDIO_BASE_URL || env.TWIN_STUDIO_URL || 'http://127.0.0.1:4292',
  )
  const runnerId = argValue('runner-id', argv) || env.DATAFACTORY_RUNNER_ID || nodeKey
  const outputDir = path.resolve(
    argValue('out', argv) || env.DATAFACTORY_WORKER_OUT || path.join(os.tmpdir(), 'twin-studio-server-to-server-pull-worker'),
  )
  return {
    nodeKey,
    token,
    twinStudioUrl,
    runnerId,
    outputDir,
    runtimeDir: path.resolve(argValue('runtime-dir', argv) || env.TWIN_STUDIO_RUNTIME_DIR || 'runtime-data'),
    uploadArtifactBundle: booleanArgValue(
      'upload-artifact-bundle',
      ['1', 'true', 'yes', 'on'].includes(String(env.DATAFACTORY_UPLOAD_ARTIFACT_BUNDLE ?? '').trim().toLowerCase()),
      argv,
    ),
    cityInput: {
      restoreBeforeRun: booleanArgValue(
        'restore-city-input',
        ['1', 'true', 'yes', 'on'].includes(String(env.DATAFACTORY_RESTORE_CITY_INPUT ?? '').trim().toLowerCase()),
        argv,
      ),
      packageFile: argValue('city-input-package', argv) || env.DATAFACTORY_CITY_INPUT_PACKAGE || '',
      manifestFile: argValue('city-input-manifest', argv) || env.DATAFACTORY_CITY_INPUT_MANIFEST || '',
      clean: booleanArgValue(
        'city-input-clean',
        ['1', 'true', 'yes', 'on'].includes(String(env.DATAFACTORY_CITY_INPUT_CLEAN ?? '').trim().toLowerCase()),
        argv,
      ),
      allowNonEmpty: booleanArgValue(
        'city-input-allow-non-empty',
        ['1', 'true', 'yes', 'on'].includes(String(env.DATAFACTORY_CITY_INPUT_ALLOW_NON_EMPTY ?? '').trim().toLowerCase()),
        argv,
      ),
    },
    cityId: argValue('city', argv) || env.TWIN_STUDIO_SMOKE_CITY_ID || '',
    stageKey: argValue('stage', argv) || env.DATAFACTORY_STAGE_KEY || '',
    runId: argValue('run-id', argv) || env.DATAFACTORY_RUN_ID || '',
    status: argValue('status', argv) || 'succeeded',
    promotionMode: argValue('promotion-mode', argv) || 'operations-ledger',
    stageRunner: argValue('stage-runner', argv) || env.DATAFACTORY_STAGE_RUNNER || 'operations-ledger',
    viewerArtifacts: {
      version: argValue('version', argv) || env.DATAFACTORY_ARTIFACT_VERSION || '',
      mvtMinZoom: argValue('mvt-min-zoom', argv) || env.MVT_MIN_ZOOM || 10,
      mvtMaxZoom: argValue('mvt-max-zoom', argv) || env.MVT_MAX_ZOOM || 14,
      mvtMaxFeaturesPerTile: argValue('mvt-max-features-per-tile', argv) || env.MVT_MAX_FEATURES_PER_TILE || '',
      tilePartitions: argValue('tile-partitions', argv) || env.TILE_PARTITIONS || 16,
      tilePartitionLimit: argValue('tile-partition-limit', argv) || env.TILE_PARTITION_LIMIT || 12000,
      tilesetKey: argValue('tileset-key', argv) || env.TILESET_KEY || 'base-buildings-partitioned',
      pmtilesBin: argValue('pmtiles-bin', argv) || env.PMTILES_BIN || 'pmtiles',
      skipMvt: booleanArgValue('skip-mvt', false, argv),
      skipPmtiles: booleanArgValue('skip-pmtiles', false, argv),
      skipThreeDTiles: booleanArgValue('skip-3d-tiles', false, argv) || booleanArgValue('skip-three-d-tiles', false, argv),
      activateArtifacts: !booleanArgValue('no-activate', false, argv),
    },
    submittedBy: argValue('submitted-by', argv) || `server-to-server-pull-worker:${nodeKey}`,
    once: booleanArg('once', argv),
    intervalMs: numberArg('interval-ms', DEFAULT_INTERVAL_MS, { min: 1_000, max: 3_600_000 }),
    maxCycles: numberArg('max-cycles', booleanArg('once', argv) ? 1 : 0, { min: 0, max: 1_000_000 }),
  }
}

export async function runServerToServerPullWorkerCycle(config) {
  const claimUrl = `${config.twinStudioUrl}/api/data-factory/processing-nodes/${encodeURIComponent(config.nodeKey)}/dispatches/claim`
  const claim = await postJson(claimUrl, {
    token: config.token,
    body: {
      cityId: config.cityId,
      stageKey: config.stageKey,
      runId: config.runId,
      runnerId: config.runnerId,
    },
  })

  if (!claim.claimed) {
    return {
      ok: true,
      claimed: false,
      nodeKey: config.nodeKey,
      message: claim.message ?? 'NO_PULL_DISPATCH_AVAILABLE',
    }
  }

  const runDir = path.join(config.outputDir, String(claim.cityId), String(claim.workflowRunId))
  const dispatchFile = path.join(runDir, 'dispatch-external-worker.json')
  const resultFile = path.join(runDir, 'result-external-worker.json')
  writeJsonFile(dispatchFile, claim.dispatchPackage)

  let cityInputRestore = null
  if (config.cityInput.restoreBeforeRun) {
    cityInputRestore = await restoreCityInputPackage({
      packageFile: config.cityInput.packageFile,
      manifestFile: config.cityInput.manifestFile,
      targetDatabaseUrl: process.env.TWIN_STUDIO_DATABASE_URL || process.env.DATABASE_URL || '',
      cityId: claim.cityId,
      clean: config.cityInput.clean,
      allowNonEmpty: config.cityInput.allowNonEmpty,
      submittedBy: config.submittedBy,
    })
  }

  const built = config.stageRunner === 'viewer-artifacts'
    ? await writeViewerArtifactsExternalStageResult({
      dispatchFile,
      outputFile: resultFile,
      runnerId: config.runnerId,
      submittedBy: config.submittedBy,
      version: config.viewerArtifacts.version || null,
      mvtMinZoom: config.viewerArtifacts.mvtMinZoom,
      mvtMaxZoom: config.viewerArtifacts.mvtMaxZoom,
      mvtMaxFeaturesPerTile: config.viewerArtifacts.mvtMaxFeaturesPerTile || null,
      tilePartitions: config.viewerArtifacts.tilePartitions,
      tilePartitionLimit: config.viewerArtifacts.tilePartitionLimit,
      tilesetKey: config.viewerArtifacts.tilesetKey,
      pmtilesBin: config.viewerArtifacts.pmtilesBin,
      skipMvt: config.viewerArtifacts.skipMvt,
      skipPmtiles: config.viewerArtifacts.skipPmtiles,
      skipThreeDTiles: config.viewerArtifacts.skipThreeDTiles,
      activateArtifacts: config.viewerArtifacts.activateArtifacts,
    })
    : writeExternalDataFactoryResult({
      dispatchFile,
      outputFile: resultFile,
      runnerId: config.runnerId,
      status: config.status,
      promotionMode: config.promotionMode,
      submittedBy: config.submittedBy,
    })

  if (cityInputRestore) {
    built.resultPackage.externalRun.cityInputRestore = cityInputRestore
    writeJsonFile(resultFile, built.resultPackage)
  }

  if (claim.dispatchChecksum && built.dispatchChecksum !== claim.dispatchChecksum) {
    throw new Error('PULL_WORKER_DISPATCH_CHECKSUM_MISMATCH')
  }

  let artifactUpload = null
  if (config.uploadArtifactBundle && config.stageRunner === 'viewer-artifacts') {
    artifactUpload = await uploadRuntimeArtifactBundle({
      config,
      claim,
      resultPackage: built.resultPackage,
      runDir,
    })
    built.resultPackage.externalRun.artifactUpload = artifactUpload
    writeJsonFile(resultFile, built.resultPackage)
  }

  const resultUrl = claim.resultEndpoint?.startsWith('http')
    ? claim.resultEndpoint
    : `${config.twinStudioUrl}${claim.resultEndpoint}`
  const submitted = await postJson(resultUrl, {
    token: config.token,
    body: {
      resultPackage: built.resultPackage,
      submittedBy: config.submittedBy,
    },
  })

  return {
    ok: submitted.ok === true,
    claimed: true,
    nodeKey: config.nodeKey,
    dispatchId: claim.dispatchId,
    workflowRunId: claim.workflowRunId,
    cityId: claim.cityId,
    stageKey: claim.stageKey,
    dispatchFile,
    resultFile,
    cityInputRestore,
    artifactUpload,
    importStatus: submitted.status,
    result: submitted,
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function usage() {
  return [
    'Usage:',
    '  npm run ops:server-to-server-pull-worker -- --node-key=<key> --twin-studio-url=http://127.0.0.1:4292',
    '',
    'Environment:',
    '  TWIN_STUDIO_DATA_FACTORY_TOKEN   Runtime token issued by Twin Studio.',
    '  TWIN_STUDIO_BASE_URL             Twin Studio control-plane URL.',
    '',
    'Options:',
    '  --once                          Run one poll cycle and exit.',
    '  --interval-ms=<ms>              Poll interval for daemon mode. Default: 30000.',
    '  --max-cycles=<n>                Stop after n cycles. Default: 0 means unlimited unless --once.',
    '  --city=<id>                     Optional city filter.',
    '  --stage=<key>                   Optional stage filter.',
    '  --run-id=<id>                   Optional exact workflow run filter.',
    '  --runner-id=<id>                Stable worker id reported in result packages.',
    '  --out=<dir>                     Local worker scratch/output directory.',
    '  --runtime-dir=<dir>             Runtime artifact root. Default: TWIN_STUDIO_RUNTIME_DIR or runtime-data.',
    '  --restore-city-input            Restore a city input package into the worker PostGIS before running the stage.',
    '  --city-input-package=<file>      City input package .tgz created by ops:package-data-factory-city-input.',
    '  --city-input-manifest=<file>     Extracted city input manifest.json alternative.',
    '  --city-input-clean              Restore with pg_restore --clean --if-exists.',
    '  --city-input-allow-non-empty    Allow restore into a non-empty target without --clean.',
    '  --stage-runner=viewer-artifacts Run the heavy viewer-artifacts stage runner instead of the ledger-only runner.',
    '  --upload-artifact-bundle        Upload a checksummed runtime artifact bundle before submitting the result.',
    '  --mvt-min-zoom=<z>              Viewer-artifacts runner MVT minimum zoom.',
    '  --mvt-max-zoom=<z>              Viewer-artifacts runner MVT maximum zoom.',
    '  --tile-partitions=<n>           Viewer-artifacts runner 3D Tiles partition count.',
    '  --tile-partition-limit=<n>      Viewer-artifacts runner per-partition feature limit.',
    '  --no-activate                   Generate/register viewer artifacts without making them active.',
  ].join('\n')
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(usage())
    return
  }
  const config = buildConfig()
  let cycles = 0
  while (true) {
    cycles += 1
    const result = await runServerToServerPullWorkerCycle(config)
    console.log(JSON.stringify({
      schemaVersion: '2026-06-27.server-to-server-pull-worker-cycle.v1',
      cycle: cycles,
      ...result,
    }, null, 2))
    if (config.once || (config.maxCycles > 0 && cycles >= config.maxCycles)) break
    await sleep(config.intervalMs)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: String(error?.message ?? 'SERVER_TO_SERVER_PULL_WORKER_FAILED'),
      status: error?.status ?? null,
      detail: error?.payload ?? null,
    }, null, 2))
    process.exitCode = 1
  })
}
