import fs from 'node:fs'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'

import { buildViewerArtifactsStageResultPackage } from '../services/ldtOps/viewerArtifactsStageRunnerService.mjs'

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))

assert.equal(
  packageJson.scripts['ops:run-viewer-artifacts-data-factory-dispatch'],
  'node server/tools/run-viewer-artifacts-data-factory-dispatch.mjs',
  'VIEWER_ARTIFACT_STAGE_RUNNER_SCRIPT_MISSING',
)
assert.equal(
  packageJson.scripts['test:data-factory-viewer-artifacts-stage-runner-smoke'],
  'node server/tests/data-factory-viewer-artifacts-stage-runner-smoke.mjs',
  'VIEWER_ARTIFACT_STAGE_RUNNER_SMOKE_SCRIPT_MISSING',
)

const workerSource = fs.readFileSync('server/tools/server-to-server-pull-worker.mjs', 'utf8')
assert.match(workerSource, /writeViewerArtifactsExternalStageResult/, 'PULL_WORKER_STAGE_RUNNER_NOT_CONNECTED')
assert.match(workerSource, /stage-runner=viewer-artifacts/, 'PULL_WORKER_STAGE_RUNNER_USAGE_MISSING')
assert.match(workerSource, /no-activate/, 'PULL_WORKER_NO_ACTIVATE_OPTION_MISSING')
assert.match(workerSource, /upload-artifact-bundle/, 'PULL_WORKER_RUNTIME_BUNDLE_UPLOAD_OPTION_MISSING')

const dispatchPackage = {
  schemaVersion: '2026-06-26.offline-data-factory-dispatch.v1',
  runId: 'viewer-artifacts-stage-runner-smoke-run',
  cityId: 'guanajuato',
  stageKey: 'viewer-artifacts',
  executionMode: 'offline-data-factory',
  executorProfile: 'external-worker',
  status: 'ready-for-external-runner',
  handoff: {
    artifactUri: 'runtime://artifacts/guanajuato/viewer-artifacts-stage-runner-smoke/handoff.json',
    checksum: 'sha256:handoff',
  },
  artifactUri: 'runtime://artifacts/guanajuato/viewer-artifacts-stage-runner-smoke/dispatch.json',
  resultImport: {
    path: '/api/offline-data-factory/results/import',
  },
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'twin-viewer-artifacts-stage-'))
const mvtDir = path.join(tempRoot, 'mvt')
fs.mkdirSync(path.join(mvtDir, '10', '243'), { recursive: true })
fs.writeFileSync(path.join(mvtDir, '10', '243', '391.mvt'), 'mvt')
fs.writeFileSync(path.join(mvtDir, 'manifest.json'), 'index')
const mvtTransferByteSize = 8

const resultPackage = buildViewerArtifactsStageResultPackage({
  dispatchPackage,
  dispatchChecksum: 'sha256:dispatch',
  runnerId: 'viewer-artifacts-stage-runner-smoke',
  submittedBy: 'viewer-artifacts-stage-runner-smoke',
  startedAt: '2026-06-27T00:00:00.000Z',
  finishedAt: '2026-06-27T00:01:00.000Z',
  version: 'smoke-viewer-artifacts',
  steps: [
    { key: 'build-3d-tiles', status: 'succeeded' },
    { key: 'build-mvt-directory', status: 'succeeded' },
    { key: 'pack-pmtiles', status: 'succeeded' },
  ],
  artifacts: [
    {
      artifactKey: 'base-city-mvt',
      artifactType: 'mvt-directory',
      transport: 'mvt',
      version: 'smoke-viewer-artifacts',
      status: 'ready',
      active: true,
      checksum: 'sha256:mvt',
      byteSize: 3,
      tileCount: 2,
      localPath: mvtDir,
      uri: '/api/live/guanajuato/cached-tiles/smoke-viewer-artifacts/{z}/{x}/{y}.mvt',
      mediaType: 'application/vnd.mapbox-vector-tile',
    },
    {
      artifactKey: 'base-city-pmtiles',
      artifactType: 'pmtiles',
      transport: 'pmtiles',
      version: 'smoke-viewer-artifacts',
      status: 'ready',
      active: true,
      checksum: 'sha256:pmtiles',
      byteSize: 200,
      tileCount: 2,
      localPath: '/tmp/twin-smoke/base.pmtiles',
      uri: '/api/live/guanajuato/pmtiles/smoke-viewer-artifacts.pmtiles',
      mediaType: 'application/vnd.pmtiles',
    },
    {
      artifactKey: 'base-buildings-partitioned',
      artifactType: '3d-tiles',
      transport: '3d-tiles',
      version: 'smoke-viewer-artifacts',
      status: 'ready',
      active: true,
      checksum: 'sha256:3dtiles',
      byteSize: 300,
      featureCount: 3,
      localPath: '/tmp/twin-smoke/3d-tiles',
      uri: '/api/live/guanajuato/3d-tiles/base-buildings-partitioned/smoke-viewer-artifacts/tileset.json',
      mediaType: 'application/vnd.ogc.3dtiles+json',
    },
  ],
})

assert.equal(resultPackage.status, 'succeeded', 'VIEWER_ARTIFACT_STAGE_RESULT_NOT_SUCCEEDED')
assert.equal(resultPackage.promotion.mode, 'stage-applicator', 'VIEWER_ARTIFACT_STAGE_PROMOTION_MODE_INVALID')
assert.equal(resultPackage.promotion.viewerArtifacts.status, 'promoted', 'VIEWER_ARTIFACT_STAGE_PROMOTION_STATUS_INVALID')
assert.equal(resultPackage.resultSummary.viewerArtifacts.mvtDirectories, 1, 'VIEWER_ARTIFACT_STAGE_MVT_SUMMARY_INVALID')
assert.equal(resultPackage.resultSummary.viewerArtifacts.pmtiles, 1, 'VIEWER_ARTIFACT_STAGE_PMTILES_SUMMARY_INVALID')
assert.equal(resultPackage.resultSummary.viewerArtifacts.threeDTiles, 1, 'VIEWER_ARTIFACT_STAGE_3D_TILES_SUMMARY_INVALID')
assert.equal(
  resultPackage.promotion.viewerArtifacts.artifacts.every((artifact) => artifact.checksum && artifact.byteSize > 0),
  true,
  'VIEWER_ARTIFACT_STAGE_HEAVY_REFERENCES_INCOMPLETE',
)
const mvtReference = resultPackage.promotion.viewerArtifacts.artifacts.find(
  (artifact) => artifact.artifactKey === 'base-city-mvt',
)
assert.equal(mvtReference.byteSize, mvtTransferByteSize, 'VIEWER_ARTIFACT_STAGE_MVT_TRANSFER_BYTE_SIZE_INVALID')
assert.equal(mvtReference.metadata.registryByteSize, 3, 'VIEWER_ARTIFACT_STAGE_MVT_REGISTRY_BYTE_SIZE_MISSING')
assert.equal(
  mvtReference.metadata.transferByteSize,
  mvtTransferByteSize,
  'VIEWER_ARTIFACT_STAGE_MVT_TRANSFER_BYTE_SIZE_METADATA_INVALID',
)

console.log(JSON.stringify({
  ok: true,
  script: 'ops:run-viewer-artifacts-data-factory-dispatch',
  runnerConnected: true,
  promotionMode: resultPackage.promotion.mode,
  artifacts: resultPackage.resultSummary.viewerArtifacts,
}, null, 2))
