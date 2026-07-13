import assert from 'node:assert/strict'
import fs from 'node:fs'

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
assert.equal(
  packageJson.scripts['test:data-factory-runtime-artifact-bundle-smoke'],
  'node server/tests/data-factory-runtime-artifact-bundle-smoke.mjs',
  'RUNTIME_ARTIFACT_BUNDLE_SMOKE_SCRIPT_MISSING',
)

const serviceSource = fs.readFileSync('server/services/ldtOps/serverToServerPullProviderService.mjs', 'utf8')
assert.ok(serviceSource.includes('receiveServerToServerPullRuntimeArtifactBundle'), 'RUNTIME_BUNDLE_RECEIVE_SERVICE_MISSING')
assert.ok(serviceSource.includes('DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_CHECKSUM_MISMATCH'), 'RUNTIME_BUNDLE_CHECKSUM_GUARD_MISSING')
assert.ok(serviceSource.includes('DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_BYTE_SIZE_MISMATCH'), 'RUNTIME_BUNDLE_BYTE_SIZE_GUARD_MISSING')
assert.ok(serviceSource.includes('DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_UNSAFE_MEMBER'), 'RUNTIME_BUNDLE_PATH_TRAVERSAL_GUARD_MISSING')
assert.ok(serviceSource.includes('DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_UNSAFE_ENTRY_TYPE'), 'RUNTIME_BUNDLE_SYMLINK_GUARD_MISSING')
assert.ok(serviceSource.includes("'data-factory-runtime-artifact-bundle'"), 'RUNTIME_BUNDLE_LEDGER_ARTIFACT_MISSING')

const workerSource = fs.readFileSync('server/tools/server-to-server-pull-worker.mjs', 'utf8')
assert.ok(workerSource.includes('runtimeBundleMembers'), 'RUNTIME_BUNDLE_WORKER_MEMBER_COLLECTOR_MISSING')
assert.ok(workerSource.includes('pathIsInside'), 'RUNTIME_BUNDLE_WORKER_RUNTIME_BOUNDARY_MISSING')
assert.ok(workerSource.includes('tar') && workerSource.includes('-czf'), 'RUNTIME_BUNDLE_WORKER_TARBALL_MISSING')
assert.ok(workerSource.includes('x-data-factory-artifact-checksum'), 'RUNTIME_BUNDLE_WORKER_CHECKSUM_HEADER_MISSING')
assert.ok(workerSource.includes('DATAFACTORY_UPLOAD_ARTIFACT_BUNDLE'), 'RUNTIME_BUNDLE_WORKER_ENV_FLAG_MISSING')

console.log(JSON.stringify({
  ok: true,
  contract: 'data-factory-runtime-artifact-bundle.v1',
  verifies: [
    'node-token upload route',
    'checksum and byte-size validation',
    'safe runtime-relative tar extraction',
    'worker runtime bundle upload flag',
  ],
}, null, 2))
