import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { listCity3dTilesetRecords } from '../../db/productionTwinStore/city3dTilesetRepository.mjs'
import {
  listViewerArtifactRecords,
  upsertViewerArtifactRecord,
} from '../../db/productionTwinStore/viewerArtifactRepository.mjs'
import { getRuntimeDir } from '../stateStore.mjs'

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

function sha256File(filePath) {
  try {
    const hash = crypto.createHash('sha256')
    hash.update(fs.readFileSync(filePath))
    return `sha256:${hash.digest('hex')}`
  } catch {
    return null
  }
}

function directoryByteSize(directoryPath) {
  let total = 0
  try {
    for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
      const fullPath = path.join(directoryPath, entry.name)
      if (entry.isDirectory()) total += directoryByteSize(fullPath)
      if (entry.isFile()) total += fs.statSync(fullPath).size
    }
  } catch {
    return total
  }
  return total
}

function directoryChecksum(directoryPath) {
  try {
    const files = []
    function walk(currentPath) {
      for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
        const fullPath = path.join(currentPath, entry.name)
        if (entry.isDirectory()) walk(fullPath)
        if (entry.isFile()) files.push(fullPath)
      }
    }
    walk(directoryPath)
    const hash = crypto.createHash('sha256')
    for (const filePath of files.sort()) {
      hash.update(path.relative(directoryPath, filePath).replaceAll(path.sep, '/'))
      hash.update(fs.readFileSync(filePath))
    }
    return `sha256:${hash.digest('hex')}`
  } catch {
    return null
  }
}

function latestVersion(versions) {
  const sorted = versions.slice().sort()
  return sorted[sorted.length - 1] ?? null
}

function isSmokeArtifact(value) {
  return String(value ?? '').startsWith('smoke-')
}

function firstExistingPath(paths) {
  return paths.find((candidate) => candidate && fs.existsSync(candidate)) ?? paths.find(Boolean) ?? null
}

export async function registerMvtDirectoryArtifact(cityId, version, { activate = false } = {}) {
  const artifactRoot = path.join(getRuntimeDir(), 'artifacts', cityId, 'mvt', version)
  const manifestPath = path.join(artifactRoot, 'manifest.json')
  const manifest = readJson(manifestPath)
  if (!manifest) throw new Error(`MVT_MANIFEST_NOT_FOUND:${manifestPath}`)
  return upsertViewerArtifactRecord({
    cityId,
    artifactKey: 'base-city-mvt',
    artifactType: 'mvt-directory',
    transport: 'mvt',
    version,
    status: 'ready',
    contentState: 'generated',
    sourceScope: {
      semanticClasses: ['buildings', 'roads'],
      minZoom: manifest.minZoom,
      maxZoom: manifest.maxZoom,
      limit: manifest.limit,
    },
    generator: 'Twin Base Studio export-city-mvt-package',
    checksum: directoryChecksum(artifactRoot),
    byteSize: Number(manifest.totals?.byteSize ?? directoryByteSize(artifactRoot)),
    featureCount: Number(manifest.totals?.featureCount ?? 0),
    tileCount: Number(manifest.totals?.tileCount ?? 0),
    bounds: { bbox: manifest.bbox },
    uri: `/api/live/${encodeURIComponent(cityId)}/cached-tiles/${encodeURIComponent(version)}/{z}/{x}/{y}.mvt`,
    localPath: artifactRoot,
    mediaType: 'application/vnd.mapbox-vector-tile',
    metadata: {
      manifestPath,
      nonEmptyTileCount: manifest.totals?.nonEmptyTileCount ?? 0,
      elapsedMs: manifest.elapsedMs,
    },
    invalidationSource: 'city-object-inventory',
    generatedAt: manifest.generatedAt,
  }, { activate })
}

export async function registerPmtilesArtifact(cityId, version, { activate = false } = {}) {
  const artifactRoot = path.join(getRuntimeDir(), 'artifacts', cityId, 'pmtiles')
  const manifestPath = path.join(artifactRoot, `${version}.manifest.json`)
  const manifest = readJson(manifestPath)
  if (!manifest) throw new Error(`PMTILES_MANIFEST_NOT_FOUND:${manifestPath}`)
  const fallbackPmtilesPath = path.join(artifactRoot, `${version}.pmtiles`)
  const pmtilesPath = firstExistingPath([manifest.pmtilesPath, fallbackPmtilesPath])
  return upsertViewerArtifactRecord({
    cityId,
    artifactKey: 'base-city-pmtiles',
    artifactType: 'pmtiles',
    transport: 'pmtiles',
    version,
    status: 'ready',
    contentState: 'generated',
    sourceScope: {
      sourceMvtDir: manifest.sourceMvtDir,
      minZoom: manifest.minZoom,
      maxZoom: manifest.maxZoom,
    },
    generator: 'Twin Base Studio pack-mvt-directory-pmtiles',
    checksum: sha256File(pmtilesPath),
    byteSize: Number(manifest.pmtilesBytes ?? (fs.existsSync(pmtilesPath) ? fs.statSync(pmtilesPath).size : 0)),
    tileCount: Number(manifest.tileCount ?? 0),
    bounds: { bbox: manifest.bbox },
    uri: `/api/live/${encodeURIComponent(cityId)}/pmtiles/${encodeURIComponent(version)}.pmtiles`,
    localPath: pmtilesPath,
    mediaType: 'application/vnd.pmtiles',
    metadata: {
      manifestPath,
      mbtilesPath: manifest.mbtilesPath,
      tileBytes: manifest.tileBytes,
    },
    invalidationSource: 'mvt-directory-artifact',
  }, { activate })
}

export async function registerThreeDTilesArtifact(cityId, record, { activate = false } = {}) {
  const status = record.status ?? 'ready'
  const packageRoot = firstExistingPath([record.assetRoot, record.tilesetPath ? path.dirname(record.tilesetPath) : null])
  const packageByteSize = packageRoot && fs.existsSync(packageRoot)
    ? directoryByteSize(packageRoot)
    : Number(record.byteSize ?? 0)
  return upsertViewerArtifactRecord({
    cityId,
    artifactKey: record.tilesetKey,
    artifactType: '3d-tiles',
    transport: '3d-tiles',
    version: record.version,
    status,
    contentState: record.contentState ?? 'generated',
    sourceScope: {
      sourceQuery: record.sourceQuery,
      semanticClasses: record.semanticClasses,
      geometricError: record.geometricError,
    },
    generator: record.metadata?.generator || 'Twin Base Studio city-3d-tiles-builder',
    checksum: packageRoot ? directoryChecksum(packageRoot) : sha256File(record.tilesetPath),
    byteSize: Number(packageByteSize || record.byteSize || 0),
    featureCount: Number(record.featureCount ?? 0),
    objectCount: Number(record.objectCount ?? 0),
    bounds: record.boundingVolume ?? {},
    uri: record.tilesetUrl,
    localPath: packageRoot ?? record.tilesetPath,
    mediaType: 'application/vnd.ogc.3dtiles+json',
    metadata: {
      city3dTilesetId: record.id,
      assetRoot: record.assetRoot,
      tilesetPath: record.tilesetPath,
      ...record.metadata,
    },
    invalidationSource: 'city-object-inventory',
    generatedAt: record.generatedAt,
  }, { activate: activate && status === 'ready' })
}

export async function registerExistingViewerArtifacts(cityId, { activateLatest = false, includeSmoke = false } = {}) {
  const registered = []
  const runtimeDir = getRuntimeDir()
  const mvtRoot = path.join(runtimeDir, 'artifacts', cityId, 'mvt')
  if (fs.existsSync(mvtRoot)) {
    const versions = fs.readdirSync(mvtRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((version) => includeSmoke || !isSmokeArtifact(version))
    const latest = latestVersion(versions)
    for (const version of versions) {
      registered.push(await registerMvtDirectoryArtifact(cityId, version, { activate: activateLatest && version === latest }))
    }
  }

  const pmtilesRoot = path.join(runtimeDir, 'artifacts', cityId, 'pmtiles')
  if (fs.existsSync(pmtilesRoot)) {
    const versions = fs.readdirSync(pmtilesRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.manifest.json'))
      .map((entry) => entry.name.replace(/\.manifest\.json$/, ''))
      .filter((version) => includeSmoke || !isSmokeArtifact(version))
    const latest = latestVersion(versions)
    for (const version of versions) {
      registered.push(await registerPmtilesArtifact(cityId, version, { activate: activateLatest && version === latest }))
    }
  }

  const tilesets = await listCity3dTilesetRecords(cityId, { limit: 100 })
  const latestByKey = new Map()
  for (const record of tilesets) {
    if (!includeSmoke && (isSmokeArtifact(record.tilesetKey) || isSmokeArtifact(record.version))) continue
    if ((record.status ?? 'ready') !== 'ready') continue
    const current = latestByKey.get(record.tilesetKey)
    if (!current || String(record.generatedAt) > String(current.generatedAt)) latestByKey.set(record.tilesetKey, record)
  }
  for (const record of tilesets) {
    if (!includeSmoke && (isSmokeArtifact(record.tilesetKey) || isSmokeArtifact(record.version))) continue
    registered.push(await registerThreeDTilesArtifact(cityId, record, {
      activate: activateLatest && latestByKey.get(record.tilesetKey)?.version === record.version,
    }))
  }

  return registered
}

export async function getViewerArtifactsReport(cityId, options = {}) {
  if (options.refresh) {
    await registerExistingViewerArtifacts(cityId, { activateLatest: Boolean(options.activateLatest) })
  }
  const artifacts = await listViewerArtifactRecords(cityId, options)
  return {
    cityId,
    artifacts,
    summary: artifacts.reduce((summary, artifact) => {
      const key = artifact.artifactType
      const current = summary.byType[key] ?? { count: 0, active: 0, bytes: 0 }
      current.count += 1
      current.active += artifact.active ? 1 : 0
      current.bytes += Number(artifact.byteSize ?? 0)
      summary.byType[key] = current
      summary.total += 1
      summary.bytes += Number(artifact.byteSize ?? 0)
      return summary
    }, { total: 0, bytes: 0, byType: {} }),
  }
}
