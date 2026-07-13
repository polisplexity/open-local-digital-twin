import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const DATA_FACTORY_PROVIDER_PACKAGE_SCHEMA_VERSION = '2026-06-27.data-factory-provider-package.v1'

const DISPATCH_SCHEMA_VERSION = '2026-06-26.offline-data-factory-dispatch.v1'

function requireText(value, errorCode) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(errorCode)
  return text
}

function optionalText(value) {
  return String(value ?? '').trim()
}

function normalizeKey(value, fallback = 'data-factory') {
  const normalized = (String(value ?? '').trim() || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{0,128}$/.test(normalized)) throw new Error('DATA_FACTORY_PROVIDER_PACKAGE_KEY_INVALID')
  return normalized
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256Json(value) {
  return `sha256:${crypto.createHash('sha256').update(stableJson(value)).digest('hex')}`
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return `sha256:${hash.digest('hex')}`
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function writeTextFile(filePath, content, mode = null) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
  if (mode !== null) fs.chmodSync(filePath, mode)
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(requireText(filePath, 'DATA_FACTORY_JSON_FILE_REQUIRED')), 'utf8'))
}

function validateDispatchPackage(dispatchPackage) {
  if (!dispatchPackage || typeof dispatchPackage !== 'object' || Array.isArray(dispatchPackage)) {
    throw new Error('DATA_FACTORY_DISPATCH_PACKAGE_REQUIRED')
  }
  if (dispatchPackage.schemaVersion !== DISPATCH_SCHEMA_VERSION) throw new Error('DATA_FACTORY_DISPATCH_SCHEMA_INVALID')
  if (dispatchPackage.executorProfile !== 'external-worker') throw new Error('DATA_FACTORY_DISPATCH_PROFILE_INVALID')
  if (dispatchPackage.status !== 'ready-for-external-runner') throw new Error('DATA_FACTORY_DISPATCH_STATUS_INVALID')
  if (dispatchPackage.executionMode !== 'offline-data-factory') throw new Error('DATA_FACTORY_DISPATCH_EXECUTION_MODE_INVALID')
  requireText(dispatchPackage.runId, 'DATA_FACTORY_DISPATCH_RUN_ID_REQUIRED')
  requireText(dispatchPackage.cityId, 'DATA_FACTORY_DISPATCH_CITY_ID_REQUIRED')
  requireText(dispatchPackage.stageKey, 'DATA_FACTORY_DISPATCH_STAGE_REQUIRED')
  requireText(dispatchPackage.handoff?.artifactUri, 'DATA_FACTORY_DISPATCH_HANDOFF_URI_REQUIRED')
  requireText(dispatchPackage.handoff?.checksum, 'DATA_FACTORY_DISPATCH_HANDOFF_CHECKSUM_REQUIRED')
  requireText(dispatchPackage.artifactUri, 'DATA_FACTORY_DISPATCH_ARTIFACT_URI_REQUIRED')
  requireText(dispatchPackage.resultImport?.path, 'DATA_FACTORY_DISPATCH_RESULT_IMPORT_REQUIRED')
}

function readDispatch({ dispatchFile, dispatchPackage }) {
  const dispatch = dispatchPackage ?? readJsonFile(dispatchFile)
  validateDispatchPackage(dispatch)
  return dispatch
}

function copyIfExists(sourceFile, destinationFile) {
  if (!sourceFile) return null
  const resolved = path.resolve(sourceFile)
  if (!fs.existsSync(resolved)) throw new Error(`DATA_FACTORY_PACKAGE_SOURCE_MISSING:${resolved}`)
  fs.mkdirSync(path.dirname(destinationFile), { recursive: true })
  fs.copyFileSync(resolved, destinationFile)
  return {
    sourcePath: resolved,
    relativePath: destinationFile,
    byteSize: fs.statSync(destinationFile).size,
    checksum: sha256File(destinationFile),
  }
}

function fileEntry({ key, filePath, relativePath }) {
  return {
    key,
    relativePath,
    byteSize: fs.statSync(filePath).size,
    checksum: sha256File(filePath),
  }
}

function tarPackage({ packageRoot, tarballPath }) {
  fs.rmSync(tarballPath, { force: true })
  fs.mkdirSync(path.dirname(tarballPath), { recursive: true })
  const tar = spawnSync('tar', ['-czf', tarballPath, '-C', packageRoot, '.'], {
    encoding: 'utf8',
  })
  if (tar.status !== 0) throw new Error(`DATA_FACTORY_PROVIDER_PACKAGE_TAR_FAILED:${tar.stderr || tar.stdout || tar.status}`)
  return {
    uri: `file://${tarballPath}`,
    localPath: tarballPath,
    byteSize: fs.statSync(tarballPath).size,
    checksum: sha256File(tarballPath),
  }
}

function externalRunnerCommand({ dispatchPath = 'dispatch/dispatch-external-worker.json', resultPath = 'result/result.json', runnerId = '$DATAFACTORY_RUNNER_ID' } = {}) {
  return `npm run ops:run-external-data-factory-dispatch -- --dispatch=${dispatchPath} --out=${resultPath} --runner-id=${runnerId}`
}

function offlineRunScript() {
  return `#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"
cd "\${ROOT}"
mkdir -p result

: "\${DATAFACTORY_RUNNER_ID:=offline-bundle-runner}"

${externalRunnerCommand({})}
sha256sum dispatch/dispatch-external-worker.json result/result.json > result/checksums.sha256

cat <<'NOTE'
Offline Data Factory result is ready.
Move the result directory or result/result.json back to Twin Studio and import it
through the result import endpoint recorded in manifest.json.
NOTE
`
}

function slurmScript({
  jobName,
  imageRef,
  schedulerOptions,
  dispatchPath = '$PWD/dispatch/dispatch-external-worker.json',
  resultPath = '$PWD/result/result.json',
}) {
  const time = optionalText(schedulerOptions.time) || '02:00:00'
  const cpus = Number.isFinite(Number(schedulerOptions.cpus)) ? Math.trunc(Number(schedulerOptions.cpus)) : 4
  const memory = optionalText(schedulerOptions.memory) || '16G'
  const partition = optionalText(schedulerOptions.partition)
  const account = optionalText(schedulerOptions.account)
  return `#!/usr/bin/env bash
#SBATCH --job-name=${jobName}
#SBATCH --cpus-per-task=${cpus}
#SBATCH --mem=${memory}
#SBATCH --time=${time}
${partition ? `#SBATCH --partition=${partition}\n` : ''}${account ? `#SBATCH --account=${account}\n` : ''}#SBATCH --output=logs/%x-%j.out
#SBATCH --error=logs/%x-%j.err

set -euo pipefail
mkdir -p result logs
: "\${DATAFACTORY_RUNNER_ID:=${jobName}-slurm-\${SLURM_JOB_ID:-manual}}"

if command -v apptainer >/dev/null 2>&1; then
  apptainer exec ${imageRef} ${externalRunnerCommand({ dispatchPath, resultPath })}
elif command -v singularity >/dev/null 2>&1; then
  singularity exec ${imageRef} ${externalRunnerCommand({ dispatchPath, resultPath })}
else
  ${externalRunnerCommand({ dispatchPath, resultPath })}
fi

sha256sum "${dispatchPath}" "${resultPath}" > result/checksums.sha256
`
}

function pbsScript({
  jobName,
  imageRef,
  schedulerOptions,
  dispatchPath = '$PBS_O_WORKDIR/dispatch/dispatch-external-worker.json',
  resultPath = '$PBS_O_WORKDIR/result/result.json',
}) {
  const walltime = optionalText(schedulerOptions.walltime ?? schedulerOptions.time) || '02:00:00'
  const cpus = Number.isFinite(Number(schedulerOptions.cpus)) ? Math.trunc(Number(schedulerOptions.cpus)) : 4
  const memory = optionalText(schedulerOptions.memory) || '16gb'
  const queue = optionalText(schedulerOptions.queue)
  return `#!/usr/bin/env bash
#PBS -N ${jobName}
#PBS -l select=1:ncpus=${cpus}:mem=${memory}
#PBS -l walltime=${walltime}
${queue ? `#PBS -q ${queue}\n` : ''}
set -euo pipefail
cd "\${PBS_O_WORKDIR:-$PWD}"
mkdir -p result logs
: "\${DATAFACTORY_RUNNER_ID:=${jobName}-pbs-\${PBS_JOBID:-manual}}"

if command -v apptainer >/dev/null 2>&1; then
  apptainer exec ${imageRef} ${externalRunnerCommand({ dispatchPath, resultPath })}
elif command -v singularity >/dev/null 2>&1; then
  singularity exec ${imageRef} ${externalRunnerCommand({ dispatchPath, resultPath })}
else
  ${externalRunnerCommand({ dispatchPath, resultPath })}
fi

sha256sum "${dispatchPath}" "${resultPath}" > result/checksums.sha256
`
}

function defaultOutputDir(prefix, dispatch) {
  return path.join(os.tmpdir(), `${prefix}-${normalizeKey(dispatch.cityId)}-${normalizeKey(dispatch.runId)}`)
}

export function createOfflineDataFactoryBundlePackage({
  dispatchFile = '',
  dispatchPackage = null,
  resultTemplateFile = '',
  artifactManifestFile = '',
  outputDir = '',
  packageName = '',
  submittedBy = 'offline-bundle-packager',
} = {}) {
  const dispatch = readDispatch({ dispatchFile, dispatchPackage })
  const resolvedOutputDir = path.resolve(outputDir || defaultOutputDir('offline-data-factory-bundle', dispatch))
  const packageKey = normalizeKey(packageName, `${dispatch.cityId}-${dispatch.stageKey}-${dispatch.runId}`)
  const packageRoot = path.join(resolvedOutputDir, packageKey)
  const tarballPath = path.join(resolvedOutputDir, `${packageKey}.tgz`)
  fs.rmSync(packageRoot, { recursive: true, force: true })
  fs.mkdirSync(path.join(packageRoot, 'dispatch'), { recursive: true })
  fs.mkdirSync(path.join(packageRoot, 'result'), { recursive: true })
  fs.mkdirSync(path.join(packageRoot, 'artifacts'), { recursive: true })

  const dispatchRelative = 'dispatch/dispatch-external-worker.json'
  const dispatchPath = path.join(packageRoot, dispatchRelative)
  writeJsonFile(dispatchPath, dispatch)
  const files = [fileEntry({ key: 'dispatch', filePath: dispatchPath, relativePath: dispatchRelative })]

  const resultTemplate = copyIfExists(resultTemplateFile, path.join(packageRoot, 'result', 'result-template.json'))
  if (resultTemplate) files.push(fileEntry({ key: 'result-template', filePath: path.join(packageRoot, 'result', 'result-template.json'), relativePath: 'result/result-template.json' }))

  const artifactManifest = copyIfExists(artifactManifestFile, path.join(packageRoot, 'artifacts', 'artifact-transfer-manifest.json'))
  if (artifactManifest) files.push(fileEntry({ key: 'artifact-transfer-manifest', filePath: path.join(packageRoot, 'artifacts', 'artifact-transfer-manifest.json'), relativePath: 'artifacts/artifact-transfer-manifest.json' }))

  writeTextFile(path.join(packageRoot, 'bin', 'run-offline-bundle.sh'), offlineRunScript(), 0o755)
  files.push(fileEntry({ key: 'runner-script', filePath: path.join(packageRoot, 'bin', 'run-offline-bundle.sh'), relativePath: 'bin/run-offline-bundle.sh' }))

  const manifest = {
    schemaVersion: DATA_FACTORY_PROVIDER_PACKAGE_SCHEMA_VERSION,
    packageKind: 'offline-bundle',
    packageKey,
    cityId: dispatch.cityId,
    runId: dispatch.runId,
    stageKey: dispatch.stageKey,
    submittedBy,
    generatedAt: new Date().toISOString(),
    dispatchChecksum: sha256Json(dispatch),
    resultImport: dispatch.resultImport,
    transfer: {
      mode: 'manual-file-transfer',
      disconnectedHostCompatible: true,
      instructions: [
        'Move this tarball to the processing host.',
        'Extract it beside a Data Factory runtime or inside the Data Factory image workspace.',
        'Run bin/run-offline-bundle.sh.',
        'Move result/result.json and result/checksums.sha256 back to Twin Studio.',
        'Import the result through resultImport.path.',
      ],
    },
    files,
  }
  writeJsonFile(path.join(packageRoot, 'manifest.json'), manifest)
  const manifestFile = fileEntry({ key: 'manifest', filePath: path.join(packageRoot, 'manifest.json'), relativePath: 'manifest.json' })
  const packaged = tarPackage({ packageRoot, tarballPath })
  return {
    ok: true,
    schemaVersion: DATA_FACTORY_PROVIDER_PACKAGE_SCHEMA_VERSION,
    packageKind: 'offline-bundle',
    packageRoot,
    tarball: packaged,
    manifest: {
      ...manifest,
      files: [...files, manifestFile],
      package: packaged,
    },
  }
}

export function createHpcBatchProviderPackage({
  dispatchFile = '',
  dispatchPackage = null,
  outputDir = '',
  scheduler = 'slurm',
  imageRef = '${DATAFACTORY_IMAGE:-datafactory.sif}',
  jobName = '',
  schedulerOptions = {},
  submittedBy = 'hpc-batch-packager',
} = {}) {
  const dispatch = readDispatch({ dispatchFile, dispatchPackage })
  const normalizedScheduler = normalizeKey(scheduler, 'slurm')
  if (!['slurm', 'pbs'].includes(normalizedScheduler)) throw new Error('DATA_FACTORY_HPC_SCHEDULER_UNSUPPORTED')
  const resolvedOutputDir = path.resolve(outputDir || defaultOutputDir('hpc-data-factory-batch', dispatch))
  const packageKey = normalizeKey(jobName, `${dispatch.cityId}-${dispatch.stageKey}-${normalizedScheduler}`)
  fs.rmSync(resolvedOutputDir, { recursive: true, force: true })
  fs.mkdirSync(path.join(resolvedOutputDir, 'dispatch'), { recursive: true })
  fs.mkdirSync(path.join(resolvedOutputDir, 'result'), { recursive: true })
  fs.mkdirSync(path.join(resolvedOutputDir, 'logs'), { recursive: true })
  writeJsonFile(path.join(resolvedOutputDir, 'dispatch', 'dispatch-external-worker.json'), dispatch)
  const scriptName = normalizedScheduler === 'slurm' ? 'job.slurm' : 'job.pbs'
  const script = normalizedScheduler === 'slurm'
    ? slurmScript({ jobName: packageKey, imageRef, schedulerOptions })
    : pbsScript({ jobName: packageKey, imageRef, schedulerOptions })
  writeTextFile(path.join(resolvedOutputDir, scriptName), script, 0o755)
  const submitCommand = normalizedScheduler === 'slurm' ? `sbatch ${scriptName}` : `qsub ${scriptName}`
  const manifest = {
    schemaVersion: DATA_FACTORY_PROVIDER_PACKAGE_SCHEMA_VERSION,
    packageKind: 'hpc-batch',
    packageKey,
    cityId: dispatch.cityId,
    runId: dispatch.runId,
    stageKey: dispatch.stageKey,
    submittedBy,
    generatedAt: new Date().toISOString(),
    scheduler: normalizedScheduler,
    runtime: {
      kind: 'apptainer-or-singularity',
      imageRef,
    },
    submitCommand,
    resultImport: dispatch.resultImport,
    files: [
      fileEntry({ key: 'dispatch', filePath: path.join(resolvedOutputDir, 'dispatch', 'dispatch-external-worker.json'), relativePath: 'dispatch/dispatch-external-worker.json' }),
      fileEntry({ key: 'job-script', filePath: path.join(resolvedOutputDir, scriptName), relativePath: scriptName }),
    ],
    boundaries: {
      productDependency: false,
      requiresLiveTwinStudioBackend: false,
      note: 'This package generates a batch job script only. Scheduler installation, module loading, and image distribution are environment responsibilities.',
    },
  }
  writeJsonFile(path.join(resolvedOutputDir, 'hpc-batch-plan.json'), manifest)
  return {
    ok: true,
    schemaVersion: DATA_FACTORY_PROVIDER_PACKAGE_SCHEMA_VERSION,
    packageKind: 'hpc-batch',
    packageRoot: resolvedOutputDir,
    scheduler: normalizedScheduler,
    submitCommand,
    jobScript: path.join(resolvedOutputDir, scriptName),
    manifest: {
      ...manifest,
      files: [...manifest.files, fileEntry({ key: 'manifest', filePath: path.join(resolvedOutputDir, 'hpc-batch-plan.json'), relativePath: 'hpc-batch-plan.json' })],
    },
  }
}

export function createCloudBatchProviderPackage({
  dispatchFile = '',
  dispatchPackage = null,
  outputDir = '',
  provider = 'generic-cloud',
  imageRef = '',
  storageUri = '',
  logsUri = '',
  resultCallbackUrl = '',
  submittedBy = 'cloud-batch-packager',
} = {}) {
  const dispatch = readDispatch({ dispatchFile, dispatchPackage })
  const resolvedOutputDir = path.resolve(outputDir || defaultOutputDir('cloud-data-factory-batch', dispatch))
  const normalizedProvider = normalizeKey(provider, 'generic-cloud')
  const packageKey = normalizeKey(`${dispatch.cityId}-${dispatch.stageKey}-${normalizedProvider}-${dispatch.runId}`)
  fs.rmSync(resolvedOutputDir, { recursive: true, force: true })
  fs.mkdirSync(path.join(resolvedOutputDir, 'dispatch'), { recursive: true })
  writeJsonFile(path.join(resolvedOutputDir, 'dispatch', 'dispatch-external-worker.json'), dispatch)
  const manifest = {
    schemaVersion: DATA_FACTORY_PROVIDER_PACKAGE_SCHEMA_VERSION,
    packageKind: 'cloud-batch',
    packageKey,
    cityId: dispatch.cityId,
    runId: dispatch.runId,
    stageKey: dispatch.stageKey,
    submittedBy,
    generatedAt: new Date().toISOString(),
    provider: normalizedProvider,
    runtime: {
      kind: 'cloud-provider',
      imageRef: optionalText(imageRef) || '${DATAFACTORY_IMAGE}',
    },
    storage: {
      dispatchUri: optionalText(storageUri) ? `${storageUri.replace(/\/+$/g, '')}/${packageKey}/dispatch/dispatch-external-worker.json` : '',
      resultUri: optionalText(storageUri) ? `${storageUri.replace(/\/+$/g, '')}/${packageKey}/result/result.json` : '',
      artifactUriPrefix: optionalText(storageUri) ? `${storageUri.replace(/\/+$/g, '')}/${packageKey}/artifacts/` : '',
    },
    logs: {
      uri: optionalText(logsUri) || (optionalText(storageUri) ? `${storageUri.replace(/\/+$/g, '')}/${packageKey}/logs/` : ''),
    },
    callback: {
      resultCallbackUrl: optionalText(resultCallbackUrl),
      resultImportPath: dispatch.resultImport.path,
      auth: 'provider-adapter-managed',
    },
    command: externalRunnerCommand({
      dispatchPath: '${DATAFACTORY_DISPATCH_FILE}',
      resultPath: '${DATAFACTORY_RESULT_FILE}',
      runnerId: '${DATAFACTORY_RUNNER_ID}',
    }),
    files: [
      fileEntry({ key: 'dispatch', filePath: path.join(resolvedOutputDir, 'dispatch', 'dispatch-external-worker.json'), relativePath: 'dispatch/dispatch-external-worker.json' }),
    ],
    boundaries: {
      providerSpecificImplementation: 'plugin-or-adapter',
      secretsInManifest: false,
      heavyArtifactsInline: false,
      note: 'This is the portable cloud-batch contract. Provider-specific submitters must implement storage upload, logs, and result import/callback.',
    },
  }
  writeJsonFile(path.join(resolvedOutputDir, 'cloud-batch-plan.json'), manifest)
  return {
    ok: true,
    schemaVersion: DATA_FACTORY_PROVIDER_PACKAGE_SCHEMA_VERSION,
    packageKind: 'cloud-batch',
    packageRoot: resolvedOutputDir,
    provider: normalizedProvider,
    manifest: {
      ...manifest,
      files: [...manifest.files, fileEntry({ key: 'manifest', filePath: path.join(resolvedOutputDir, 'cloud-batch-plan.json'), relativePath: 'cloud-batch-plan.json' })],
    },
  }
}
