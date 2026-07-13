import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

import {
  createCloudBatchProviderPackage,
  createHpcBatchProviderPackage,
  createOfflineDataFactoryBundlePackage,
  DATA_FACTORY_PROVIDER_PACKAGE_SCHEMA_VERSION,
} from '../services/ldtOps/dataFactoryProviderPackageService.mjs'

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function createDispatchFixture(root, suffix) {
  const dispatch = {
    schemaVersion: '2026-06-26.offline-data-factory-dispatch.v1',
    runId: `provider-package-run-${suffix}`,
    cityId: 'guanajuato',
    stageKey: 'viewer-artifacts',
    executionMode: 'offline-data-factory',
    status: 'ready-for-external-runner',
    executorProfile: 'external-worker',
    handoff: {
      artifactUri: `runtime://artifacts/guanajuato/offline-data-factory/provider-package-run-${suffix}/handoff.json`,
      checksum: `sha256:${crypto.createHash('sha256').update(`handoff-${suffix}`).digest('hex')}`,
    },
    artifactUri: `runtime://artifacts/guanajuato/offline-data-factory/provider-package-run-${suffix}/dispatch-external-worker.json`,
    resultImport: {
      method: 'POST',
      path: `/api/admin/cities/guanajuato/data-factory/offline-handoffs/provider-package-run-${suffix}/result`,
    },
    commandHints: [
      'npm run ops:register-viewer-artifacts -- --city=guanajuato --activate-latest',
    ],
  }
  const dispatchFile = path.join(root, 'dispatch-external-worker.json')
  writeJson(dispatchFile, dispatch)
  return { dispatch, dispatchFile }
}

const packageJson = readJson('package.json')
for (const scriptName of [
  'ops:package-offline-data-factory-bundle',
  'ops:generate-data-factory-hpc-batch',
  'ops:generate-data-factory-cloud-batch',
  'test:data-factory-provider-packages-smoke',
]) {
  assert.ok(packageJson.scripts[scriptName], `DATA_FACTORY_PROVIDER_PACKAGE_SCRIPT_MISSING:${scriptName}`)
}

const suffix = crypto.randomUUID().slice(0, 8)
const root = path.join(os.tmpdir(), `tbs-provider-package-smoke-${suffix}`)
fs.rmSync(root, { recursive: true, force: true })
fs.mkdirSync(root, { recursive: true })
const { dispatchFile } = createDispatchFixture(root, suffix)

const resultTemplateFile = path.join(root, 'result-template.json')
writeJson(resultTemplateFile, {
  schemaVersion: '2026-06-26.offline-data-factory-result.v1',
  status: 'succeeded',
})

const artifactManifestFile = path.join(root, 'artifact-transfer-manifest.json')
writeJson(artifactManifestFile, {
  schemaVersion: '2026-06-27.data-factory-artifact-transfer.v1',
  summary: { artifactCount: 0 },
})

const offline = createOfflineDataFactoryBundlePackage({
  dispatchFile,
  resultTemplateFile,
  artifactManifestFile,
  outputDir: path.join(root, 'offline'),
  submittedBy: 'data-factory-provider-packages-smoke',
})
assert.equal(offline.ok, true, 'OFFLINE_BUNDLE_PACKAGE_NOT_OK')
assert.equal(offline.schemaVersion, DATA_FACTORY_PROVIDER_PACKAGE_SCHEMA_VERSION, 'OFFLINE_BUNDLE_SCHEMA_INVALID')
assert.equal(offline.packageKind, 'offline-bundle', 'OFFLINE_BUNDLE_KIND_INVALID')
assert.ok(fs.existsSync(offline.tarball.localPath), 'OFFLINE_BUNDLE_TARBALL_MISSING')
assert.ok(offline.tarball.checksum.startsWith('sha256:'), 'OFFLINE_BUNDLE_TARBALL_CHECKSUM_MISSING')
assert.ok(offline.tarball.byteSize > 0, 'OFFLINE_BUNDLE_TARBALL_EMPTY')
assert.equal(offline.manifest.transfer.disconnectedHostCompatible, true, 'OFFLINE_BUNDLE_DISCONNECTED_FLAG_MISSING')
assert.ok(offline.manifest.files.some((file) => file.key === 'dispatch'), 'OFFLINE_BUNDLE_DISPATCH_FILE_MISSING')
assert.ok(offline.manifest.files.some((file) => file.key === 'runner-script'), 'OFFLINE_BUNDLE_RUNNER_SCRIPT_MISSING')

const slurm = createHpcBatchProviderPackage({
  dispatchFile,
  outputDir: path.join(root, 'slurm'),
  scheduler: 'slurm',
  imageRef: 'datafactory.sif',
  schedulerOptions: {
    cpus: 8,
    memory: '32G',
    time: '04:00:00',
  },
  submittedBy: 'data-factory-provider-packages-smoke',
})
assert.equal(slurm.ok, true, 'SLURM_PACKAGE_NOT_OK')
assert.equal(slurm.packageKind, 'hpc-batch', 'SLURM_PACKAGE_KIND_INVALID')
assert.equal(slurm.scheduler, 'slurm', 'SLURM_SCHEDULER_INVALID')
assert.equal(slurm.submitCommand, 'sbatch job.slurm', 'SLURM_SUBMIT_COMMAND_INVALID')
const slurmScript = fs.readFileSync(slurm.jobScript, 'utf8')
assert.ok(slurmScript.includes('#SBATCH --cpus-per-task=8'), 'SLURM_CPUS_MISSING')
assert.ok(slurmScript.includes('apptainer exec datafactory.sif') || slurmScript.includes('singularity exec datafactory.sif'), 'SLURM_IMAGE_EXEC_MISSING')
assert.equal(slurm.manifest.boundaries.productDependency, false, 'SLURM_PRODUCT_DEPENDENCY_INVALID')
assert.ok(!slurmScript.toLowerCase().includes('cimat'), 'SLURM_SCRIPT_SHOULD_NOT_NAME_SPECIFIC_FACILITY')

const pbs = createHpcBatchProviderPackage({
  dispatchFile,
  outputDir: path.join(root, 'pbs'),
  scheduler: 'pbs',
  imageRef: 'datafactory.sif',
  schedulerOptions: {
    cpus: 6,
    memory: '24gb',
    queue: 'batch',
  },
  submittedBy: 'data-factory-provider-packages-smoke',
})
assert.equal(pbs.ok, true, 'PBS_PACKAGE_NOT_OK')
assert.equal(pbs.scheduler, 'pbs', 'PBS_SCHEDULER_INVALID')
assert.equal(pbs.submitCommand, 'qsub job.pbs', 'PBS_SUBMIT_COMMAND_INVALID')
const pbsScript = fs.readFileSync(pbs.jobScript, 'utf8')
assert.ok(pbsScript.includes('#PBS -l select=1:ncpus=6:mem=24gb'), 'PBS_RESOURCE_LINE_MISSING')
assert.ok(pbsScript.includes('#PBS -q batch'), 'PBS_QUEUE_MISSING')
assert.ok(!pbsScript.toLowerCase().includes('cimat'), 'PBS_SCRIPT_SHOULD_NOT_NAME_SPECIFIC_FACILITY')

const cloud = createCloudBatchProviderPackage({
  dispatchFile,
  outputDir: path.join(root, 'cloud'),
  provider: 'generic-cloud',
  imageRef: 'registry.example.test/twin-datafactory:smoke',
  storageUri: 's3://example-bucket/twin-datafactory',
  logsUri: 's3://example-bucket/twin-datafactory/logs',
  resultCallbackUrl: 'https://example.invalid/data-factory/result',
  submittedBy: 'data-factory-provider-packages-smoke',
})
assert.equal(cloud.ok, true, 'CLOUD_PACKAGE_NOT_OK')
assert.equal(cloud.packageKind, 'cloud-batch', 'CLOUD_PACKAGE_KIND_INVALID')
assert.equal(cloud.provider, 'generic-cloud', 'CLOUD_PROVIDER_INVALID')
assert.ok(cloud.manifest.storage.dispatchUri.startsWith('s3://example-bucket/twin-datafactory/'), 'CLOUD_DISPATCH_URI_INVALID')
assert.equal(cloud.manifest.callback.auth, 'provider-adapter-managed', 'CLOUD_CALLBACK_AUTH_BOUNDARY_INVALID')
assert.equal(cloud.manifest.boundaries.secretsInManifest, false, 'CLOUD_SECRETS_BOUNDARY_INVALID')
assert.equal(cloud.manifest.boundaries.heavyArtifactsInline, false, 'CLOUD_INLINE_ARTIFACT_BOUNDARY_INVALID')

console.log(JSON.stringify({
  ok: true,
  contract: DATA_FACTORY_PROVIDER_PACKAGE_SCHEMA_VERSION,
  offlineBundle: {
    tarball: offline.tarball.localPath,
    checksum: offline.tarball.checksum,
  },
  hpc: {
    slurm: slurm.jobScript,
    pbs: pbs.jobScript,
  },
  cloud: {
    plan: path.join(cloud.packageRoot, 'cloud-batch-plan.json'),
    provider: cloud.provider,
  },
}, null, 2))
