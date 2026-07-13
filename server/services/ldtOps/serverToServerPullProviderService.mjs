import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { pathToFileURL } from 'node:url'

import { getRuntimeDir } from '../stateStore.mjs'
import { stageDataFactoryArtifactManifest } from './artifactTransferService.mjs'
import { importOfflineDataFactoryResult } from './offlineDataFactoryService.mjs'
import {
  recordProcessingNodeHeartbeat,
  validateProcessingNodeRuntimeToken,
} from './processingNodeService.mjs'
import { withClient } from './dbUtils.mjs'

const PULL_PROVIDER_CONTRACT_VERSION = '2026-06-27.server-to-server-pull-provider.v1'
const RUNTIME_ARTIFACT_BUNDLE_SCHEMA_VERSION = '2026-06-27.runtime-artifact-bundle-upload.v1'
const CLAIMABLE_DISPATCH_STATUSES = new Set(['prepared', 'queued', 'failed', 'cancelled'])
const DEFAULT_RUNTIME_BUNDLE_MAX_BYTES = 1024 * 1024 * 1024 * 50

function requireText(value, errorCode) {
  const normalized = String(value ?? '').trim()
  if (!normalized) throw new Error(errorCode)
  return normalized
}

function optionalText(value) {
  return String(value ?? '').trim()
}

function normalizeKey(value, errorCode) {
  const normalized = requireText(value, errorCode)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{1,128}$/.test(normalized)) throw new Error(errorCode)
  return normalized
}

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function posixPath(value) {
  return String(value ?? '').split(path.sep).join('/')
}

function parsePositiveInteger(value, fallback = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.trunc(parsed)
}

function runtimeBundleMaxBytes() {
  return parsePositiveInteger(process.env.DATA_FACTORY_RUNTIME_BUNDLE_MAX_BYTES, DEFAULT_RUNTIME_BUNDLE_MAX_BYTES)
}

function uploadFileName(value) {
  const normalized = String(value ?? 'runtime-artifacts-bundle.tgz')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!normalized) return 'runtime-artifacts-bundle.tgz'
  if (/\.(tgz|tar\.gz)$/i.test(normalized)) return normalized
  return `${normalized}.tgz`
}

async function writeUploadStream({ inputStream, destinationPath, maxBytes }) {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true })
  const hash = crypto.createHash('sha256')
  let byteSize = 0
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      byteSize += chunk.length
      if (byteSize > maxBytes) {
        callback(new Error('DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_TOO_LARGE'))
        return
      }
      hash.update(chunk)
      callback(null, chunk)
    },
  })
  try {
    await pipeline(inputStream, meter, fs.createWriteStream(destinationPath))
  } catch (error) {
    fs.rmSync(destinationPath, { force: true })
    throw error
  }
  return {
    byteSize,
    checksum: `sha256:${hash.digest('hex')}`,
  }
}

function assertRuntimeBundleTarball({ tarballPath, cityId }) {
  const list = spawnSync('tar', ['-tzf', tarballPath], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 80,
  })
  if (list.status !== 0) {
    throw new Error(`DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_LIST_FAILED:${list.stderr || list.stdout || list.status}`)
  }
  const verbose = spawnSync('tar', ['-tvzf', tarballPath], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 80,
  })
  if (verbose.status !== 0) {
    throw new Error(`DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_INSPECT_FAILED:${verbose.stderr || verbose.stdout || verbose.status}`)
  }
  const unsafeType = verbose.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => !['-', 'd'].includes(line[0]))
  if (unsafeType) throw new Error('DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_UNSAFE_ENTRY_TYPE')

  const allowedPrefixes = [
    `artifacts/${cityId}/`,
    `3d-tiles/${cityId}/`,
  ]
  const members = list.stdout
    .split('\n')
    .map((entry) => entry.trim().replace(/^\.\//, ''))
    .filter(Boolean)
  if (members.length === 0) throw new Error('DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_EMPTY')
  for (const member of members) {
    const normalized = member.replace(/\\/g, '/')
    if (
      normalized.startsWith('/')
      || normalized.includes('\0')
      || normalized.split('/').includes('..')
      || !allowedPrefixes.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix))
    ) {
      throw new Error(`DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_UNSAFE_MEMBER:${normalized}`)
    }
  }
  return members
}

function extractRuntimeBundle({ tarballPath, runtimeDir }) {
  const extract = spawnSync('tar', ['-xzf', tarballPath, '-C', runtimeDir], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 80,
  })
  if (extract.status !== 0) {
    throw new Error(`DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_EXTRACT_FAILED:${extract.stderr || extract.stdout || extract.status}`)
  }
}

function dispatchLocalPath(artifact = {}) {
  const metadataPath = artifact.metadata?.localPath
  if (metadataPath) return metadataPath
  const uri = String(artifact.artifact_uri ?? '')
  if (uri.startsWith('runtime://')) {
    return path.join(getRuntimeDir(), uri.slice('runtime://'.length))
  }
  return ''
}

async function validatePullNode({ nodeKey, rawToken }) {
  const token = await validateProcessingNodeRuntimeToken({ nodeKey, rawToken })
  if (!token.ok) return token
  if (token.node.providerType !== 'server-to-server-pull' || token.node.connectionMode !== 'pull') {
    return {
      ok: false,
      error: 'PROCESSING_NODE_NOT_PULL_PROVIDER',
      nodeKey,
      providerType: token.node.providerType,
      connectionMode: token.node.connectionMode,
    }
  }
  return token
}

async function candidateDispatch(client, { nodeId, cityId = '', stageKey = '', runId = '' }) {
  const params = [nodeId, optionalText(cityId), optionalText(stageKey), optionalText(runId)]
  const result = await client.query(`
    SELECT
      artifact.*,
      run.workflow_key,
      run.status AS workflow_status,
      run.input,
      node.default_artifact_store_id AS artifact_store_id,
      existing.id AS existing_dispatch_id,
      existing.status AS existing_dispatch_status
    FROM ldt_ops.workflow_artifacts artifact
    JOIN ldt_ops.workflow_runs run ON run.id = artifact.run_id
    JOIN ldt_ops.processing_nodes node ON node.id = $1
    JOIN ldt_ops.processing_node_stage_bindings binding
      ON binding.node_id = node.id
      AND binding.stage_key = COALESCE(artifact.metadata->>'stageKey', run.input->>'stageKey')
      AND binding.enabled = true
    LEFT JOIN ldt_ops.data_factory_dispatches existing
      ON existing.dispatch_artifact_id = artifact.id
    WHERE artifact.artifact_kind = 'offline-data-factory-dispatch'
      AND artifact.metadata->>'executorProfile' = 'external-worker'
      AND run.workflow_key = 'offline-data-factory-handoff'
      AND ($2::text = '' OR artifact.city_id = $2)
      AND ($3::text = '' OR COALESCE(artifact.metadata->>'stageKey', run.input->>'stageKey') = $3)
      AND ($4::text = '' OR artifact.run_id::text = $4)
      AND NOT EXISTS (
        SELECT 1
        FROM ldt_ops.workflow_artifacts result_artifact
        WHERE result_artifact.run_id = artifact.run_id
          AND result_artifact.artifact_kind = 'offline-data-factory-result'
      )
      AND (
        existing.id IS NULL
        OR existing.status = ANY($5::text[])
      )
    ORDER BY artifact.created_at ASC
    FOR UPDATE OF artifact SKIP LOCKED
    LIMIT 1
  `, [...params, Array.from(CLAIMABLE_DISPATCH_STATUSES)])
  return result.rows[0] ?? null
}

async function upsertClaimedDispatch(client, { candidate, nodeId, runnerId }) {
  const stageKey = String(candidate.metadata?.stageKey ?? candidate.input?.stageKey ?? '').trim()
  if (!stageKey) throw new Error('PULL_DISPATCH_STAGE_MISSING')
  const dispatchPackageFile = dispatchLocalPath(candidate)
  if (!dispatchPackageFile || !fs.existsSync(dispatchPackageFile)) {
    throw new Error('PULL_DISPATCH_PACKAGE_FILE_MISSING')
  }
  const dispatchPackage = readJsonFile(dispatchPackageFile)
  const inputContract = {
    dispatchPackage,
    runnerId,
    source: {
      artifactId: candidate.id,
      artifactUri: candidate.artifact_uri,
      localPath: dispatchPackageFile,
    },
  }
  const dispatchResult = await client.query(`
    INSERT INTO ldt_ops.data_factory_dispatches (
      workflow_run_id,
      node_id,
      city_id,
      stage_key,
      provider_type,
      connection_mode,
      status,
      dispatch_artifact_id,
      artifact_store_id,
      dispatch_checksum,
      input_contract,
      claimed_at,
      started_at
    )
    VALUES ($1, $2, $3, $4, 'server-to-server-pull', 'pull', 'claimed', $5, $6, $7, $8::jsonb, now(), now())
    ON CONFLICT (dispatch_artifact_id) DO UPDATE SET
      node_id = EXCLUDED.node_id,
      status = 'claimed',
      input_contract = EXCLUDED.input_contract,
      claimed_at = now(),
      started_at = now(),
      updated_at = now()
    RETURNING *
  `, [
    candidate.run_id,
    nodeId,
    candidate.city_id,
    stageKey,
    candidate.id,
    candidate.artifact_store_id ?? null,
    candidate.checksum,
    JSON.stringify(inputContract),
  ])
  await client.query(`
    UPDATE ldt_ops.workflow_steps
    SET
      status = 'running',
      output = COALESCE(output, '{}'::jsonb) || $3::jsonb,
      started_at = COALESCE(started_at, now()),
      updated_at = now()
    WHERE run_id = $1
      AND step_key = $2
  `, [
    candidate.run_id,
    'run-offline-data-factory',
    JSON.stringify({
      dispatchStatus: 'claimed',
      executorProfile: 'external-worker',
      processingNodeId: nodeId,
      pullRunnerId: runnerId,
    }),
  ])
  return {
    dispatchRow: dispatchResult.rows[0],
    dispatchPackage,
    dispatchPackageFile,
  }
}

export async function claimServerToServerPullDispatch({
  nodeKey,
  rawToken,
  cityId = '',
  stageKey = '',
  runId = '',
  runnerId = 'server-to-server-pull-worker',
} = {}) {
  const normalizedNodeKey = normalizeKey(nodeKey, 'PROCESSING_NODE_KEY_INVALID')
  const token = await validatePullNode({ nodeKey: normalizedNodeKey, rawToken })
  if (!token.ok) return token
  const normalizedStageKey = optionalText(stageKey)
  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const candidate = await candidateDispatch(client, {
        nodeId: token.node.id,
        cityId,
        stageKey: normalizedStageKey,
        runId,
      })
      if (!candidate) {
        await client.query('COMMIT')
        await recordProcessingNodeHeartbeat({
          nodeKey: normalizedNodeKey,
          rawToken,
          heartbeat: {
            status: 'online',
            doctorStatus: 'unknown',
            runningJobCount: 0,
            capabilities: {
              providerContract: PULL_PROVIDER_CONTRACT_VERSION,
              pollState: 'idle',
            },
          },
        })
        return {
          ok: true,
          claimed: false,
          nodeKey: normalizedNodeKey,
          providerType: 'server-to-server-pull',
          message: 'NO_PULL_DISPATCH_AVAILABLE',
          runId: optionalText(runId),
        }
      }
      const claimed = await upsertClaimedDispatch(client, {
        candidate,
        nodeId: token.node.id,
        runnerId,
      })
      await client.query('COMMIT')
      await recordProcessingNodeHeartbeat({
        nodeKey: normalizedNodeKey,
        rawToken,
        heartbeat: {
          status: 'busy',
          doctorStatus: 'unknown',
          runningJobCount: 1,
          capabilities: {
            providerContract: PULL_PROVIDER_CONTRACT_VERSION,
            pollState: 'claimed',
            stageKey: claimed.dispatchRow.stage_key,
          },
        },
      })
      return {
        ok: true,
        claimed: true,
        schemaVersion: PULL_PROVIDER_CONTRACT_VERSION,
        nodeKey: normalizedNodeKey,
        dispatchId: claimed.dispatchRow.id,
        workflowRunId: claimed.dispatchRow.workflow_run_id,
        cityId: claimed.dispatchRow.city_id,
        stageKey: claimed.dispatchRow.stage_key,
        status: claimed.dispatchRow.status,
        dispatchChecksum: claimed.dispatchRow.dispatch_checksum,
        dispatchArtifactId: claimed.dispatchRow.dispatch_artifact_id,
        dispatchPackage: claimed.dispatchPackage,
        resultEndpoint: `/api/data-factory/processing-nodes/${normalizedNodeKey}/dispatches/${claimed.dispatchRow.id}/result`,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }).catch((error) => ({
    ok: false,
    claimed: false,
    nodeKey: normalizedNodeKey,
    error: String(error?.message ?? 'PULL_DISPATCH_CLAIM_FAILED'),
  }))
}

export async function receiveServerToServerPullRuntimeArtifactBundle({
  nodeKey,
  rawToken,
  dispatchId,
  uploadStream,
  contentLength = 0,
  checksum = '',
  fileName = 'runtime-artifacts-bundle.tgz',
  submittedBy = 'server-to-server-pull-worker',
} = {}) {
  const normalizedNodeKey = normalizeKey(nodeKey, 'PROCESSING_NODE_KEY_INVALID')
  const normalizedDispatchId = requireText(dispatchId, 'PULL_DISPATCH_ID_REQUIRED')
  const token = await validatePullNode({ nodeKey: normalizedNodeKey, rawToken })
  if (!token.ok) return token
  if (!uploadStream || typeof uploadStream.pipe !== 'function') {
    return {
      ok: false,
      error: 'DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_STREAM_REQUIRED',
      dispatchId: normalizedDispatchId,
      nodeKey: normalizedNodeKey,
    }
  }

  try {
    const dispatch = await withClient(async (client) => {
      const result = await client.query(`
        SELECT *
        FROM ldt_ops.data_factory_dispatches
        WHERE id = $1
          AND node_id = $2
          AND provider_type = 'server-to-server-pull'
          AND connection_mode = 'pull'
        LIMIT 1
      `, [normalizedDispatchId, token.node.id])
      return result.rows[0] ?? null
    })
    if (!dispatch) {
      return {
        ok: false,
        error: 'PULL_DISPATCH_NOT_FOUND',
        dispatchId: normalizedDispatchId,
        nodeKey: normalizedNodeKey,
      }
    }

    const cityId = requireText(dispatch.city_id, 'DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_CITY_REQUIRED')
    const runId = requireText(dispatch.workflow_run_id, 'DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_RUN_REQUIRED')
    const runtimeDir = getRuntimeDir()
    const safeName = uploadFileName(fileName)
    const relativeUploadPath = path.join(
      'artifacts',
      cityId,
      'offline-data-factory',
      runId,
      'runtime-artifact-uploads',
      normalizedDispatchId,
      safeName,
    )
    const localPath = path.join(runtimeDir, relativeUploadPath)
    const received = await writeUploadStream({
      inputStream: uploadStream,
      destinationPath: localPath,
      maxBytes: runtimeBundleMaxBytes(),
    })
    const declaredChecksum = optionalText(checksum)
    const declaredByteSize = parsePositiveInteger(contentLength, 0)
    if (declaredChecksum && declaredChecksum !== received.checksum) {
      fs.rmSync(localPath, { force: true })
      throw new Error('DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_CHECKSUM_MISMATCH')
    }
    if (declaredByteSize > 0 && declaredByteSize !== received.byteSize) {
      fs.rmSync(localPath, { force: true })
      throw new Error('DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_BYTE_SIZE_MISMATCH')
    }

    const members = assertRuntimeBundleTarball({ tarballPath: localPath, cityId })
    extractRuntimeBundle({ tarballPath: localPath, runtimeDir })
    const artifactUri = `runtime://${posixPath(relativeUploadPath)}`
    const artifact = await withClient(async (client) => {
      const result = await client.query(`
        INSERT INTO ldt_ops.workflow_artifacts (
          run_id,
          city_id,
          artifact_kind,
          artifact_uri,
          media_type,
          byte_size,
          checksum,
          metadata
        )
        VALUES ($1, $2, 'data-factory-runtime-artifact-bundle', $3, 'application/gzip', $4, $5, $6::jsonb)
        RETURNING *
      `, [
        runId,
        cityId,
        artifactUri,
        received.byteSize,
        received.checksum,
        JSON.stringify({
          schemaVersion: RUNTIME_ARTIFACT_BUNDLE_SCHEMA_VERSION,
          dispatchId: normalizedDispatchId,
          nodeKey: normalizedNodeKey,
          submittedBy,
          localPath,
          relativePath: posixPath(relativeUploadPath),
          extractedRuntimeDir: runtimeDir,
          extractedMemberCount: members.length,
          extractedMembers: members.slice(0, 500),
        }),
      ])
      await client.query(`
        UPDATE ldt_ops.data_factory_dispatches
        SET
          output_contract = COALESCE(output_contract, '{}'::jsonb) || $2::jsonb,
          updated_at = now()
        WHERE id = $1
      `, [
        normalizedDispatchId,
        JSON.stringify({
          runtimeArtifactBundle: {
            schemaVersion: RUNTIME_ARTIFACT_BUNDLE_SCHEMA_VERSION,
            artifactId: result.rows[0].id,
            artifactUri,
            checksum: received.checksum,
            byteSize: received.byteSize,
            extractedMemberCount: members.length,
          },
        }),
      ])
      return result.rows[0]
    })

    return {
      ok: true,
      schemaVersion: RUNTIME_ARTIFACT_BUNDLE_SCHEMA_VERSION,
      nodeKey: normalizedNodeKey,
      dispatchId: normalizedDispatchId,
      workflowRunId: runId,
      cityId,
      artifact: {
        artifactId: artifact.id,
        artifactUri,
        checksum: received.checksum,
        byteSize: received.byteSize,
        localPath,
        extractedMemberCount: members.length,
      },
    }
  } catch (error) {
    return {
      ok: false,
      schemaVersion: RUNTIME_ARTIFACT_BUNDLE_SCHEMA_VERSION,
      nodeKey: normalizedNodeKey,
      dispatchId: normalizedDispatchId,
      error: String(error?.message ?? 'DATA_FACTORY_RUNTIME_ARTIFACT_BUNDLE_UPLOAD_FAILED'),
    }
  }
}

export async function submitServerToServerPullDispatchResult({
  nodeKey,
  rawToken,
  dispatchId,
  resultPackage,
  submittedBy = 'server-to-server-pull-worker',
} = {}) {
  const normalizedNodeKey = normalizeKey(nodeKey, 'PROCESSING_NODE_KEY_INVALID')
  const normalizedDispatchId = requireText(dispatchId, 'PULL_DISPATCH_ID_REQUIRED')
  const token = await validatePullNode({ nodeKey: normalizedNodeKey, rawToken })
  if (!token.ok) return token
  const dispatch = await withClient(async (client) => {
    const result = await client.query(`
      SELECT *
      FROM ldt_ops.data_factory_dispatches
      WHERE id = $1
        AND node_id = $2
        AND provider_type = 'server-to-server-pull'
        AND connection_mode = 'pull'
      LIMIT 1
    `, [normalizedDispatchId, token.node.id])
    return result.rows[0] ?? null
  })
  if (!dispatch) {
    return {
      ok: false,
      error: 'PULL_DISPATCH_NOT_FOUND',
      dispatchId: normalizedDispatchId,
      nodeKey: normalizedNodeKey,
    }
  }

  await withClient(async (client) => {
    await client.query(`
      UPDATE ldt_ops.data_factory_dispatches
      SET status = 'running', updated_at = now()
      WHERE id = $1
    `, [normalizedDispatchId])
  })

  const artifactTransfer = await stageDataFactoryArtifactManifest({
    dispatchId: normalizedDispatchId,
    resultPackage,
    submittedBy,
  })
  if (!artifactTransfer.ok) {
    await withClient(async (client) => {
      await client.query(`
        UPDATE ldt_ops.data_factory_dispatches
        SET
          status = 'failed',
          error = $2::jsonb,
          finished_at = now(),
          updated_at = now()
        WHERE id = $1
      `, [
        normalizedDispatchId,
        JSON.stringify({ error: artifactTransfer.error ?? 'PULL_ARTIFACT_TRANSFER_FAILED' }),
      ])
    })
    await recordProcessingNodeHeartbeat({
      nodeKey: normalizedNodeKey,
      rawToken,
      heartbeat: {
        status: 'error',
        doctorStatus: 'unknown',
        runningJobCount: 0,
        capabilities: {
          providerContract: PULL_PROVIDER_CONTRACT_VERSION,
          pollState: 'artifact-transfer-failed',
        },
        error: { error: artifactTransfer.error ?? 'PULL_ARTIFACT_TRANSFER_FAILED' },
      },
    })
    return {
      ok: false,
      schemaVersion: PULL_PROVIDER_CONTRACT_VERSION,
      nodeKey: normalizedNodeKey,
      dispatchId: normalizedDispatchId,
      workflowRunId: dispatch.workflow_run_id,
      cityId: dispatch.city_id,
      stageKey: dispatch.stage_key,
      status: 'failed',
      artifactTransfer,
      error: artifactTransfer.error ?? 'PULL_ARTIFACT_TRANSFER_FAILED',
    }
  }

  const imported = await importOfflineDataFactoryResult({
    runId: dispatch.workflow_run_id,
    cityId: dispatch.city_id,
    resultPackage,
    submittedBy,
  })

  await withClient(async (client) => {
    await client.query(`
      UPDATE ldt_ops.data_factory_dispatches
      SET
        status = $2,
        result_artifact_id = $3,
        result_checksum = $4,
        output_contract = $5::jsonb,
        error = $6::jsonb,
        finished_at = now(),
        updated_at = now()
      WHERE id = $1
    `, [
      normalizedDispatchId,
      imported.ok ? 'validated' : 'failed',
      imported.result?.artifactId ?? null,
      imported.result?.checksum ?? null,
      JSON.stringify(imported.ok ? imported.result : {}),
      JSON.stringify(imported.ok ? {} : { error: imported.error ?? 'PULL_RESULT_IMPORT_FAILED' }),
    ])
  })

  await recordProcessingNodeHeartbeat({
    nodeKey: normalizedNodeKey,
    rawToken,
    heartbeat: {
      status: imported.ok ? 'online' : 'error',
      doctorStatus: 'unknown',
      runningJobCount: 0,
      capabilities: {
        providerContract: PULL_PROVIDER_CONTRACT_VERSION,
        pollState: imported.ok ? 'result-submitted' : 'result-failed',
      },
      error: imported.ok ? {} : { error: imported.error ?? 'PULL_RESULT_IMPORT_FAILED' },
    },
  })

  return {
    ok: imported.ok,
    schemaVersion: PULL_PROVIDER_CONTRACT_VERSION,
    nodeKey: normalizedNodeKey,
    dispatchId: normalizedDispatchId,
    workflowRunId: dispatch.workflow_run_id,
    cityId: dispatch.city_id,
    stageKey: dispatch.stage_key,
    status: imported.ok ? 'validated' : 'failed',
    artifactTransfer,
    imported,
    error: imported.ok ? null : imported.error,
  }
}
