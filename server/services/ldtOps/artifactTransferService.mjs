import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { getRuntimeDir } from '../stateStore.mjs'
import { withClient } from './dbUtils.mjs'

const ARTIFACT_TRANSFER_SCHEMA_VERSION = '2026-06-27.data-factory-artifact-transfer.v1'
const HEAVY_ARTIFACT_KINDS = new Set([
  'pmtiles',
  'mvt-directory',
  '3d-tiles',
  'postgis-dump',
  'runtime-artifacts',
  'artifact-tarball',
  'source-extract',
  'raster-cog',
  'stac-collection',
])

function requireText(value, errorCode) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(errorCode)
  return text
}

function optionalText(value) {
  return String(value ?? '').trim()
}

function normalizeKey(value, fallback = 'artifact') {
  const normalized = (String(value ?? '').trim() || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{0,128}$/.test(normalized)) throw new Error('DATA_FACTORY_ARTIFACT_KEY_INVALID')
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

function directoryFiles(directoryPath) {
  const files = []
  function walk(currentPath) {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const fullPath = path.join(currentPath, entry.name)
      if (entry.isDirectory()) walk(fullPath)
      if (entry.isFile()) files.push(fullPath)
    }
  }
  walk(directoryPath)
  return files.sort()
}

function directoryByteSize(directoryPath) {
  return directoryFiles(directoryPath).reduce((total, filePath) => total + fs.statSync(filePath).size, 0)
}

function directoryChecksum(directoryPath) {
  const hash = crypto.createHash('sha256')
  for (const filePath of directoryFiles(directoryPath)) {
    hash.update(path.relative(directoryPath, filePath).replaceAll(path.sep, '/'))
    hash.update(fs.readFileSync(filePath))
  }
  return `sha256:${hash.digest('hex')}`
}

function pathByteSize(localPath) {
  const stat = fs.statSync(localPath)
  return stat.isDirectory() ? directoryByteSize(localPath) : stat.size
}

function pathChecksum(localPath) {
  const stat = fs.statSync(localPath)
  return stat.isDirectory() ? directoryChecksum(localPath) : sha256File(localPath)
}

function writeJsonFile(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`)
}

function runtimeLocalPath(uri) {
  const value = String(uri ?? '').trim()
  if (!value.startsWith('runtime://')) return ''
  return path.join(getRuntimeDir(), value.slice('runtime://'.length))
}

function localPathFromUri(uri) {
  const value = String(uri ?? '').trim()
  if (!value) return ''
  if (value.startsWith('runtime://')) return runtimeLocalPath(value)
  if (value.startsWith('file://')) return fileURLToPath(value)
  if (path.isAbsolute(value)) return value
  return ''
}

function sourcePathForArtifact(artifact = {}) {
  const direct = optionalText(artifact.sourcePath ?? artifact.source_path ?? artifact.localPath ?? artifact.local_path ?? artifact.path)
  if (direct) return path.resolve(direct)
  return localPathFromUri(artifact.sourceUri ?? artifact.source_uri ?? artifact.uri ?? artifact.artifactUri ?? artifact.artifact_uri)
}

function storeRootFromRow(store = {}) {
  const publicConfig = store.public_config ?? store.publicConfig ?? {}
  const configuredRoot = optionalText(publicConfig.root ?? publicConfig.localRoot ?? publicConfig.local_root)
  if (configuredRoot) return path.resolve(configuredRoot)
  const uri = optionalText(store.uri)
  if (uri.startsWith('file://')) return fileURLToPath(uri)
  if (path.isAbsolute(uri)) return uri
  return path.join(getRuntimeDir(), 'artifact-stores', store.store_key ?? store.storeKey ?? 'default')
}

function destinationName(artifact = {}, sourcePath = '') {
  const declared = optionalText(artifact.name ?? artifact.fileName ?? artifact.file_name)
  if (declared) return normalizeKey(declared, 'artifact')
  const sourceBase = sourcePath ? path.basename(sourcePath) : ''
  if (sourceBase) return sourceBase.replace(/[^a-zA-Z0-9._-]+/g, '-')
  return `${normalizeKey(artifact.artifactKind ?? artifact.artifact_kind ?? artifact.kind, 'artifact')}.artifact`
}

function normalizeArtifactKind(artifact = {}) {
  return normalizeKey(artifact.artifactKind ?? artifact.artifact_kind ?? artifact.kind ?? artifact.artifactType ?? artifact.artifact_type, 'artifact')
}

function mediaTypeForKind(kind, fallback = '') {
  if (fallback) return fallback
  if (kind === 'pmtiles') return 'application/vnd.pmtiles'
  if (kind === 'mvt-directory') return 'application/vnd.mapbox-vector-tile'
  if (kind === '3d-tiles') return 'application/vnd.ogc.3dtiles+json'
  if (kind === 'postgis-dump') return 'application/gzip'
  if (kind === 'runtime-artifacts') return 'application/gzip'
  if (kind === 'artifact-tarball') return 'application/gzip'
  return 'application/octet-stream'
}

function assertNoInlinePayload(artifact = {}) {
  for (const key of ['data', 'payload', 'content', 'bytes', 'base64']) {
    if (Object.hasOwn(artifact, key)) throw new Error(`DATA_FACTORY_ARTIFACT_INLINE_PAYLOAD_FORBIDDEN:${key}`)
  }
}

function relativeArtifactPath({ cityId, runId, artifactKind, name }) {
  return [
    normalizeKey(cityId, 'city'),
    normalizeKey(runId, 'run'),
    normalizeKey(artifactKind, 'artifact'),
    name.replace(/[^a-zA-Z0-9._-]+/g, '-'),
  ].join('/')
}

function copyArtifact({ sourcePath, destinationPath }) {
  const sourceStat = fs.statSync(sourcePath)
  fs.rmSync(destinationPath, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true })
  if (sourceStat.isDirectory()) {
    fs.cpSync(sourcePath, destinationPath, { recursive: true })
  } else {
    fs.copyFileSync(sourcePath, destinationPath)
  }
}

function copyBundleMember({ sourcePath, destinationPath }) {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true })
  const sourceStat = fs.statSync(sourcePath)
  if (sourceStat.isDirectory()) {
    fs.cpSync(sourcePath, destinationPath, { recursive: true })
  } else {
    fs.copyFileSync(sourcePath, destinationPath)
  }
}

function rsyncCommand({ sourcePath, storeUri, relativePath }) {
  const source = sourcePath ? `${sourcePath}${fs.existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory() ? '/' : ''}` : '<local-artifact-path>'
  const destination = `${String(storeUri ?? '').replace(/\/+$/g, '')}/${relativePath}`
  return `rsync -a --checksum ${JSON.stringify(source)} ${JSON.stringify(destination)}`
}

function normalizeArtifactReference(artifact, { cityId, runId, store, copyLocal }) {
  assertNoInlinePayload(artifact)
  const artifactKind = normalizeArtifactKind(artifact)
  const sourcePath = sourcePathForArtifact(artifact)
  const sourceExists = Boolean(sourcePath && fs.existsSync(sourcePath))
  const name = destinationName(artifact, sourcePath)
  const relativePath = relativeArtifactPath({ cityId, runId, artifactKind, name })
  const declaredChecksum = optionalText(artifact.checksum)
  const declaredByteSize = Number(artifact.byteSize ?? artifact.byte_size ?? 0)
  const storeType = store.store_type ?? store.storeType ?? 'local-filesystem'
  const mediaType = mediaTypeForKind(artifactKind, optionalText(artifact.mediaType ?? artifact.media_type))

  let actualChecksum = declaredChecksum
  let actualByteSize = Number.isFinite(declaredByteSize) ? declaredByteSize : 0
  let destinationLocalPath = null
  let destinationUri = optionalText(artifact.destinationUri ?? artifact.destination_uri)
  let transferStatus = 'referenced'
  let transferMode = 'reference'
  let command = null

  if (sourceExists) {
    actualChecksum = pathChecksum(sourcePath)
    actualByteSize = pathByteSize(sourcePath)
    if (declaredChecksum && declaredChecksum !== actualChecksum) throw new Error('DATA_FACTORY_ARTIFACT_CHECKSUM_MISMATCH')
    if (declaredByteSize > 0 && declaredByteSize !== actualByteSize) throw new Error('DATA_FACTORY_ARTIFACT_BYTE_SIZE_MISMATCH')
  } else if (HEAVY_ARTIFACT_KINDS.has(artifactKind) && (!declaredChecksum || declaredByteSize <= 0)) {
    throw new Error('DATA_FACTORY_HEAVY_ARTIFACT_REFERENCE_INCOMPLETE')
  }

  if (storeType === 'local-filesystem') {
    const root = storeRootFromRow(store)
    destinationLocalPath = path.join(root, relativePath)
    destinationUri = pathToFileURL(destinationLocalPath).toString()
    if (sourceExists && copyLocal !== false) {
      copyArtifact({ sourcePath, destinationPath: destinationLocalPath })
      transferStatus = 'staged'
      transferMode = 'copy'
    } else if (sourceExists) {
      destinationLocalPath = sourcePath
      destinationUri = pathToFileURL(sourcePath).toString()
      transferStatus = 'adopted'
      transferMode = 'reference-local'
    }
  } else if (storeType === 'sftp-rsync') {
    destinationUri = `${String(store.uri ?? '').replace(/\/+$/g, '')}/${relativePath}`
    command = rsyncCommand({ sourcePath, storeUri: store.uri, relativePath })
    transferStatus = sourceExists ? 'planned' : 'referenced'
    transferMode = 'rsync-plan'
  } else if (storeType === 'offline-bundle') {
    const root = storeRootFromRow(store)
    destinationLocalPath = path.join(root, relativePath)
    destinationUri = pathToFileURL(destinationLocalPath).toString()
    transferStatus = sourceExists ? 'pending-package' : 'referenced'
    transferMode = sourceExists ? 'artifact-tarball-member' : 'artifact-tarball-reference'
  } else {
    destinationUri = destinationUri || optionalText(artifact.uri ?? artifact.artifactUri ?? artifact.artifact_uri)
    transferStatus = sourceExists ? 'planned' : 'referenced'
    transferMode = `${storeType}-reference`
  }

  return {
    artifactKind,
    artifactKey: artifact.artifactKey ?? artifact.artifact_key ?? null,
    version: artifact.version ?? null,
    mediaType,
    name,
    required: artifact.required === true,
    heavy: HEAVY_ARTIFACT_KINDS.has(artifactKind),
    source: {
      uri: artifact.uri ?? artifact.artifactUri ?? artifact.artifact_uri ?? null,
      localPath: sourceExists ? sourcePath : null,
      accessible: sourceExists,
    },
    destination: {
      storeKey: store.store_key ?? store.storeKey ?? null,
      storeType,
      relativePath,
      uri: destinationUri,
      localPath: destinationLocalPath,
    },
    checksum: actualChecksum,
    byteSize: Number(actualByteSize ?? 0),
    transfer: {
      status: transferStatus,
      mode: transferMode,
      command,
    },
    metadata: {
      ...(artifact.metadata && typeof artifact.metadata === 'object' ? artifact.metadata : {}),
      declaredUri: artifact.uri ?? artifact.artifactUri ?? artifact.artifact_uri ?? null,
    },
  }
}

function createArtifactTarball({ cityId, runId, stageKey, store, items, submittedBy }) {
  const root = storeRootFromRow(store)
  const bundleRoot = path.join(root, normalizeKey(cityId, 'city'), normalizeKey(runId, 'run'))
  const packageRoot = path.join(bundleRoot, '_artifact-transfer-package')
  const artifactRoot = path.join(packageRoot, 'artifacts')
  const tarballPath = path.join(bundleRoot, 'artifact-transfer-bundle.tgz')
  fs.rmSync(packageRoot, { recursive: true, force: true })
  fs.rmSync(tarballPath, { recursive: true, force: true })
  fs.mkdirSync(artifactRoot, { recursive: true })

  const packagedItems = items.map((item) => {
    if (!item.source.accessible || !item.source.localPath) return item
    const memberPath = path.join('artifacts', item.destination.relativePath)
    copyBundleMember({
      sourcePath: item.source.localPath,
      destinationPath: path.join(packageRoot, memberPath),
    })
    return {
      ...item,
      destination: {
        ...item.destination,
        uri: `${pathToFileURL(tarballPath).toString()}#/${memberPath.split(path.sep).join('/')}`,
        localPath: tarballPath,
      },
      transfer: {
        status: 'packaged',
        mode: 'artifact-tarball',
        command: null,
      },
      metadata: {
        ...item.metadata,
        bundleMemberPath: memberPath.split(path.sep).join('/'),
      },
    }
  })

  const bundleManifest = {
    schemaVersion: ARTIFACT_TRANSFER_SCHEMA_VERSION,
    cityId,
    workflowRunId: runId,
    stageKey,
    submittedBy,
    generatedAt: new Date().toISOString(),
    store: {
      storeKey: store.store_key,
      storeType: store.store_type,
      uri: store.uri,
    },
    items: packagedItems,
  }
  writeJsonFile(path.join(packageRoot, 'artifact-transfer-manifest.json'), bundleManifest)
  const tar = spawnSync('tar', ['-czf', tarballPath, '-C', packageRoot, '.'], {
    encoding: 'utf8',
  })
  if (tar.status !== 0) {
    throw new Error(`DATA_FACTORY_ARTIFACT_TARBALL_FAILED:${tar.stderr || tar.stdout || tar.status}`)
  }
  fs.rmSync(packageRoot, { recursive: true, force: true })
  const byteSize = fs.statSync(tarballPath).size
  const checksum = sha256File(tarballPath)
  return {
    items: packagedItems,
    bundlePackage: {
      artifactKind: 'artifact-tarball',
      mediaType: 'application/gzip',
      uri: pathToFileURL(tarballPath).toString(),
      localPath: tarballPath,
      checksum,
      byteSize,
      transfer: {
        status: 'packaged',
        mode: 'artifact-tarball',
      },
    },
  }
}

function artifactsFromResultPackage(resultPackage = {}) {
  const artifacts = []
  if (Array.isArray(resultPackage.externalRun?.artifacts)) artifacts.push(...resultPackage.externalRun.artifacts)
  if (Array.isArray(resultPackage.artifacts)) artifacts.push(...resultPackage.artifacts)
  if (Array.isArray(resultPackage.promotion?.viewerArtifacts?.artifacts)) artifacts.push(...resultPackage.promotion.viewerArtifacts.artifacts)
  return artifacts
}

function manifestSummary(items, bundlePackage = null) {
  return items.reduce((summary, item) => {
    const status = item.transfer?.status ?? 'unknown'
    const mode = item.transfer?.mode ?? 'unknown'
    const byteSize = Number(item.byteSize ?? 0)
    summary.artifactCount += 1
    summary.heavyArtifactCount += item.heavy ? 1 : 0
    summary.byteSize += byteSize
    summary.byKind[item.artifactKind] = (summary.byKind[item.artifactKind] ?? 0) + 1
    summary.byStatus[status] = (summary.byStatus[status] ?? 0) + 1
    summary.byMode[mode] = (summary.byMode[mode] ?? 0) + 1
    summary.byteSizeByKind[item.artifactKind] = (summary.byteSizeByKind[item.artifactKind] ?? 0) + byteSize
    summary.byteSizeByStatus[status] = (summary.byteSizeByStatus[status] ?? 0) + byteSize
    summary.byteSizeByMode[mode] = (summary.byteSizeByMode[mode] ?? 0) + byteSize
    if (status === 'staged') summary.byteMovement.copiedToStore += byteSize
    else if (status === 'packaged') summary.byteMovement.packagedForTransfer += byteSize
    else if (status === 'adopted') summary.byteMovement.adoptedLocalReference += byteSize
    else if (status === 'planned') summary.byteMovement.plannedExternalTransfer += byteSize
    else if (status === 'referenced') summary.byteMovement.referencedOnly += byteSize
    else summary.byteMovement.unknown += byteSize
    return summary
  }, {
    artifactCount: 0,
    heavyArtifactCount: 0,
    byteSize: 0,
    byKind: {},
    byStatus: {},
    byMode: {},
    byteSizeByKind: {},
    byteSizeByStatus: {},
    byteSizeByMode: {},
    byteMovement: {
      copiedToStore: 0,
      packagedForTransfer: 0,
      adoptedLocalReference: 0,
      plannedExternalTransfer: 0,
      referencedOnly: 0,
      unknown: 0,
      tarballByteSize: Number(bundlePackage?.byteSize ?? 0),
    },
  })
}

async function loadDispatchWithStore(client, dispatchId) {
  const result = await client.query(`
    SELECT
      dispatch.*,
      node.node_key,
      store.store_key,
      store.display_name AS store_display_name,
      store.store_type,
      store.uri AS store_uri,
      store.visibility AS store_visibility,
      store.public_config AS store_public_config
    FROM ldt_ops.data_factory_dispatches dispatch
    LEFT JOIN ldt_ops.processing_nodes node ON node.id = dispatch.node_id
    LEFT JOIN ldt_ops.artifact_stores store ON store.id = COALESCE(dispatch.artifact_store_id, node.default_artifact_store_id)
    WHERE dispatch.id = $1
    LIMIT 1
  `, [dispatchId])
  return result.rows[0] ?? null
}

function publicStore(row = {}) {
  if (!row.store_key) {
    return {
      store_key: 'runtime-local',
      display_name: 'Runtime local artifact store',
      store_type: 'local-filesystem',
      uri: pathToFileURL(path.join(getRuntimeDir(), 'artifact-stores', 'runtime-local')).toString(),
      visibility: 'private',
      public_config: { root: path.join(getRuntimeDir(), 'artifact-stores', 'runtime-local') },
    }
  }
  return {
    store_key: row.store_key,
    display_name: row.store_display_name,
    store_type: row.store_type,
    uri: row.store_uri,
    visibility: row.store_visibility,
    public_config: row.store_public_config ?? {},
  }
}

function manifestRuntimePath(cityId, runId) {
  return path.join('artifacts', cityId, 'offline-data-factory', runId, 'artifact-transfer-manifest.json')
}

export async function stageDataFactoryArtifactManifest({
  dispatchId,
  resultPackage = {},
  artifacts = null,
  copyLocal = true,
  submittedBy = 'artifact-transfer-service',
} = {}) {
  const normalizedDispatchId = requireText(dispatchId, 'DATA_FACTORY_DISPATCH_ID_REQUIRED')
  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const dispatch = await loadDispatchWithStore(client, normalizedDispatchId)
      if (!dispatch) throw new Error('DATA_FACTORY_DISPATCH_NOT_FOUND')
      const cityId = requireText(dispatch.city_id ?? resultPackage.cityId, 'DATA_FACTORY_ARTIFACT_CITY_REQUIRED')
      const runId = requireText(dispatch.workflow_run_id ?? resultPackage.runId, 'DATA_FACTORY_ARTIFACT_RUN_REQUIRED')
      const stageKey = requireText(dispatch.stage_key ?? resultPackage.stageKey, 'DATA_FACTORY_ARTIFACT_STAGE_REQUIRED')
      const store = publicStore(dispatch)
      const sourceArtifacts = Array.isArray(artifacts) ? artifacts : artifactsFromResultPackage(resultPackage)
      let items = sourceArtifacts.map((artifact) => normalizeArtifactReference(artifact, {
        cityId,
        runId,
        store,
        copyLocal,
      }))
      let bundlePackage = null
      if (store.store_type === 'offline-bundle') {
        const packaged = createArtifactTarball({
          cityId,
          runId,
          stageKey,
          store,
          items,
          submittedBy,
        })
        items = packaged.items
        bundlePackage = packaged.bundlePackage
      }
      const summary = manifestSummary(items, bundlePackage)
      const manifest = {
        schemaVersion: ARTIFACT_TRANSFER_SCHEMA_VERSION,
        dispatchId: normalizedDispatchId,
        workflowRunId: runId,
        cityId,
        stageKey,
        submittedBy,
        generatedAt: new Date().toISOString(),
        store: {
          storeKey: store.store_key,
          storeType: store.store_type,
          uri: store.uri,
          visibility: store.visibility,
        },
        policy: {
          inlinePayloadAllowed: false,
          checksumRequiredForHeavyArtifacts: true,
          byteSizeRequiredForHeavyArtifacts: true,
          supportedTransferModes: ['local-filesystem', 'sftp-rsync', 'artifact-tarball'],
          copyLocal,
        },
        summary,
        bundlePackage,
        items,
      }
      const relativePath = manifestRuntimePath(cityId, runId)
      const localPath = path.join(getRuntimeDir(), relativePath)
      writeJsonFile(localPath, manifest)
      const byteSize = fs.statSync(localPath).size
      const checksum = sha256Json(manifest)
      const artifactUri = `runtime://${relativePath.split(path.sep).join('/')}`
      const artifactResult = await client.query(`
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
        VALUES ($1, $2, 'data-factory-artifact-transfer-manifest', $3, 'application/json', $4, $5, $6::jsonb)
        RETURNING *
      `, [
        runId,
        cityId,
        artifactUri,
        byteSize,
        checksum,
        JSON.stringify({
          localPath,
          relativePath: relativePath.split(path.sep).join('/'),
          dispatchId: normalizedDispatchId,
          stageKey,
          storeKey: store.store_key,
          storeType: store.store_type,
          artifactCount: summary.artifactCount,
          heavyArtifactCount: summary.heavyArtifactCount,
          bundlePackage,
        }),
      ])
      const manifestWithArtifact = {
        ...manifest,
        manifestArtifact: {
          artifactId: artifactResult.rows[0].id,
          artifactUri,
          checksum,
          byteSize,
          localPath,
        },
      }
      await client.query(`
        UPDATE ldt_ops.data_factory_dispatches
        SET
          artifact_manifest = $2::jsonb,
          updated_at = now()
        WHERE id = $1
      `, [normalizedDispatchId, JSON.stringify(manifestWithArtifact)])
      await client.query('COMMIT')
      return {
        ok: true,
        dispatchId: normalizedDispatchId,
        manifest: manifestWithArtifact,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      return {
        ok: false,
        dispatchId: normalizedDispatchId,
        error: String(error?.message ?? 'DATA_FACTORY_ARTIFACT_TRANSFER_FAILED'),
      }
    }
  })
}

export {
  ARTIFACT_TRANSFER_SCHEMA_VERSION,
  HEAVY_ARTIFACT_KINDS,
}
