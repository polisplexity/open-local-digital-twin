import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { getRuntimeDir } from './stateStore.mjs'

function safeSegment(value, fallback = 'asset') {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function rootDir() {
  return path.join(getRuntimeDir(), 'bim-assets')
}

function bundleDir(cityId, layerKey, bundleId) {
  return path.join(
    rootDir(),
    safeSegment(cityId, 'city'),
    safeSegment(layerKey, 'layer'),
    safeSegment(bundleId, 'bundle'),
  )
}

function assetHref(cityId, layerKey, bundleId, assetName) {
  return `/api/admin/cities/${encodeURIComponent(cityId)}/layers/${encodeURIComponent(layerKey)}/bim-assets/${encodeURIComponent(bundleId)}/${encodeURIComponent(assetName)}`
}

function typedBuffer(value) {
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
}

function digestBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function writeBinaryAsset(baseDir, fileName, typedArray) {
  const buffer = typedBuffer(typedArray)
  const filePath = path.join(baseDir, fileName)
  fs.writeFileSync(filePath, buffer)
  return {
    assetName: fileName,
    sizeBytes: buffer.byteLength,
    sha256: digestBuffer(buffer),
  }
}

export function writeBimMeshAssetBundle({
  cityId,
  layerKey,
  sourceHash,
  sourceFormat = 'ifc',
  tool = 'web-ifc',
  toolVersion = null,
  schema = null,
  elements = [],
}) {
  const bundleId = `ifc-${safeSegment(String(sourceHash ?? '').slice(0, 24), 'geometry')}`
  const baseDir = bundleDir(cityId, layerKey, bundleId)
  fs.mkdirSync(baseDir, { recursive: true })

  const manifestElements = []
  let totalBytes = 0
  let geometryReferenceCount = 0

  for (const element of elements) {
    const geometries = []
    for (const geometry of element.geometries ?? []) {
      geometryReferenceCount += 1
      const geometryId = safeSegment(String(geometry.geometryExpressId), 'geometry')
      const elementId = safeSegment(String(element.expressId), 'element')
      const prefix = `element-${elementId}-geometry-${geometryId}`
      const vertexAsset = writeBinaryAsset(baseDir, `${prefix}.vertices.f32.bin`, geometry.vertices)
      const indexAsset = writeBinaryAsset(baseDir, `${prefix}.indices.u32.bin`, geometry.indices)
      totalBytes += vertexAsset.sizeBytes + indexAsset.sizeBytes
      geometries.push({
        geometryExpressId: geometry.geometryExpressId,
        color: geometry.color,
        flatTransformation: geometry.flatTransformation,
        vertexBuffer: {
          ...vertexAsset,
          href: assetHref(cityId, layerKey, bundleId, vertexAsset.assetName),
          mediaType: 'application/octet-stream',
          componentType: 'float32',
          layout: 'web-ifc-raw-vertex-buffer',
          valueCount: geometry.vertices.length,
        },
        indexBuffer: {
          ...indexAsset,
          href: assetHref(cityId, layerKey, bundleId, indexAsset.assetName),
          mediaType: 'application/octet-stream',
          componentType: 'uint32',
          valueCount: geometry.indices.length,
        },
      })
    }
    manifestElements.push({
      expressId: element.expressId,
      geometryCount: geometries.length,
      geometries,
    })
  }

  const manifest = {
    assetType: 'ifc-web-ifc-mesh-bundle',
    version: 1,
    cityId,
    layerKey,
    bundleId,
    sourceFormat,
    sourceHash,
    tool,
    toolVersion,
    schema,
    createdAt: new Date().toISOString(),
    state: geometryReferenceCount > 0 ? 'mesh-assets-written' : 'no-native-element-geometry-assets',
    elementCount: manifestElements.length,
    geometryReferenceCount,
    totalBytes,
    vertexLayout: 'web-ifc raw Float32 vertex buffer; viewer adapter must interpret the web-ifc layout for the target renderer',
    indexLayout: 'Uint32 triangle index buffer',
    elements: manifestElements,
  }
  const manifestPayload = `${JSON.stringify(manifest, null, 2)}\n`
  fs.writeFileSync(path.join(baseDir, 'manifest.json'), manifestPayload)
  return {
    ...manifest,
    manifest: {
      assetName: 'manifest.json',
      href: assetHref(cityId, layerKey, bundleId, 'manifest.json'),
      mediaType: 'application/json',
      sizeBytes: Buffer.byteLength(manifestPayload, 'utf8'),
      sha256: digestBuffer(Buffer.from(manifestPayload, 'utf8')),
    },
  }
}

export function getBimAssetPath({ cityId, layerKey, bundleId, assetName }) {
  const safeAssetName = safeSegment(assetName, '')
  if (!safeAssetName || safeAssetName !== String(assetName ?? '').trim()) {
    return null
  }
  const filePath = path.join(bundleDir(cityId, layerKey, bundleId), safeAssetName)
  if (!filePath.startsWith(bundleDir(cityId, layerKey, bundleId)) || !fs.existsSync(filePath)) {
    return null
  }
  return filePath
}
