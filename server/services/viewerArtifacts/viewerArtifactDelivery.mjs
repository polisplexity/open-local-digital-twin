import fs from 'node:fs'
import path from 'node:path'
import { listViewerArtifactRecords } from '../../db/productionTwinStore/viewerArtifactRepository.mjs'

const ARTIFACT_KEYS = {
  mvt: 'base-city-mvt',
  pmtiles: 'base-city-pmtiles',
}

function safePathSegment(value) {
  return String(value ?? '').trim().replace(/[^a-zA-Z0-9._-]/g, '')
}

function safeAssetName(value) {
  const assetName = String(value ?? '').trim().replace(/\\/g, '/')
  if (!assetName || assetName.includes('..') || assetName.startsWith('/')) return ''
  return assetName.replace(/[^a-zA-Z0-9._/-]/g, '')
}

function isSmokeArtifact(artifact) {
  return String(artifact?.artifactKey ?? '').startsWith('smoke-') ||
    String(artifact?.version ?? '').startsWith('smoke-')
}

function fileExists(filePath) {
  return Boolean(filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile())
}

function directoryExists(directoryPath) {
  return Boolean(directoryPath && fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory())
}

function resolveInside(root, ...parts) {
  if (!root) return null
  const resolvedRoot = path.resolve(root)
  const resolvedPath = path.resolve(resolvedRoot, ...parts)
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) return null
  return resolvedPath
}

async function findViewerArtifact(cityId, {
  artifactType,
  artifactKey = null,
  version = 'latest',
  active = undefined,
} = {}) {
  const requestedVersion = safePathSegment(version)
  const records = await listViewerArtifactRecords(cityId, {
    artifactType,
    artifactKey,
    version: requestedVersion && requestedVersion !== 'latest' ? requestedVersion : undefined,
    status: 'ready',
    active: requestedVersion === 'latest' ? true : active,
    limit: 20,
  })
  const readyRecords = records.filter((artifact) => artifact.status === 'ready')
  if (requestedVersion && requestedVersion !== 'latest') {
    return readyRecords.find((artifact) => artifact.version === requestedVersion) ?? null
  }
  return readyRecords.find((artifact) => artifact.active) ?? null
}

function readMvtManifest(artifact) {
  const manifestPath = artifact?.metadata?.manifestPath || path.join(artifact?.localPath ?? '', 'manifest.json')
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch {
    return null
  }
}

function inZoomRange(manifest, z) {
  if (!manifest) return true
  const zoom = Number(z)
  return zoom >= Number(manifest.minZoom ?? -Infinity) && zoom <= Number(manifest.maxZoom ?? Infinity)
}

export function viewerArtifactResponseHeaders(artifact) {
  return {
    'X-Twin-Viewer-Artifact-Id': artifact.id,
    'X-Twin-Viewer-Artifact-Key': artifact.artifactKey,
    'X-Twin-Viewer-Artifact-Type': artifact.artifactType,
    'X-Twin-Viewer-Artifact-Version': artifact.version,
    ...(artifact.checksum ? { 'X-Twin-Viewer-Artifact-Checksum': artifact.checksum } : {}),
  }
}

export async function resolveMvtTileArtifact({ cityId, version = 'latest', z, x, y }) {
  const artifact = await findViewerArtifact(cityId, {
    artifactType: 'mvt-directory',
    artifactKey: ARTIFACT_KEYS.mvt,
    version,
  })
  if (!artifact || !directoryExists(artifact.localPath)) return null
  const manifest = readMvtManifest(artifact)
  if (!inZoomRange(manifest, z)) return null
  const tilePath = resolveInside(
    artifact.localPath,
    safePathSegment(z),
    safePathSegment(x),
    `${safePathSegment(String(y).replace(/\.mvt$/i, ''))}.mvt`,
  )
  if (!fileExists(tilePath)) return null
  return { artifact, filePath: tilePath, manifest }
}

export async function resolvePmtilesArtifact({ cityId, version = 'latest' }) {
  const artifact = await findViewerArtifact(cityId, {
    artifactType: 'pmtiles',
    artifactKey: ARTIFACT_KEYS.pmtiles,
    version: String(version ?? '').replace(/\.pmtiles$/i, ''),
  })
  if (!artifact || !fileExists(artifact.localPath)) return null
  return { artifact, filePath: artifact.localPath }
}

export async function resolveThreeDTilesArtifactAsset({ cityId, tilesetKey, version, assetName }) {
  const artifact = await findViewerArtifact(cityId, {
    artifactType: '3d-tiles',
    artifactKey: safePathSegment(tilesetKey),
    version,
  })
  if (!artifact || !directoryExists(artifact.localPath)) return null
  const filePath = resolveInside(artifact.localPath, safeAssetName(assetName))
  if (!fileExists(filePath)) return null
  return { artifact, filePath }
}

export async function listDeliverableThreeDTilesArtifacts(cityId, { tilesetKey = null, limit = 20, includeSmoke = false } = {}) {
  const artifacts = await listViewerArtifactRecords(cityId, {
    artifactType: '3d-tiles',
    artifactKey: tilesetKey ? safePathSegment(tilesetKey) : undefined,
    status: 'ready',
    limit: Math.min(100, Math.max(1, Math.trunc(Number(limit)) || 20)),
  })
  const deliverableArtifacts = artifacts
    .filter((artifact) => includeSmoke || !isSmokeArtifact(artifact))
    .filter((artifact) => directoryExists(artifact.localPath))
    .filter((artifact) => fileExists(path.join(artifact.localPath, 'tileset.json')))

  const preferredByKey = new Map()
  for (const artifact of deliverableArtifacts) {
    if (!preferredByKey.has(artifact.artifactKey)) {
      preferredByKey.set(artifact.artifactKey, artifact)
    }
  }

  return Array.from(preferredByKey.values())
    .map((artifact) => ({
      id: artifact.id,
      cityId: artifact.cityId,
      tilesetKey: artifact.artifactKey,
      version: artifact.version,
      status: artifact.status,
      contentState: artifact.contentState,
      active: artifact.active,
      sourceQuery: artifact.sourceScope?.sourceQuery ?? null,
      semanticClasses: artifact.sourceScope?.semanticClasses ?? [],
      assetRoot: artifact.localPath,
      tilesetUrl: artifact.uri,
      tilesetPath: path.join(artifact.localPath, 'tileset.json'),
      featureCount: artifact.featureCount,
      objectCount: artifact.objectCount,
      byteSize: artifact.byteSize,
      geometricError: artifact.sourceScope?.geometricError ?? null,
      boundingVolume: artifact.bounds,
      generatedAt: artifact.generatedAt,
      viewerArtifact: {
        id: artifact.id,
        artifactType: artifact.artifactType,
        checksum: artifact.checksum,
        mediaType: artifact.mediaType,
        active: artifact.active,
      },
    }))
}
