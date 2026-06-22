import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { getRuntimeDir, readJsonFile, writeJsonFile } from './stateStore.mjs'

function uploadRoot() {
  return path.join(getRuntimeDir(), 'provider-uploads')
}

function safeUploadId(uploadId) {
  const normalized = String(uploadId ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!normalized) throw new Error('UPLOAD_ID_REQUIRED')
  return normalized
}

function uploadDir(uploadId) {
  return path.join(uploadRoot(), safeUploadId(uploadId))
}

function contentPath(uploadId) {
  return path.join(uploadDir(uploadId), 'content.bin')
}

function metadataPath(uploadId) {
  return path.join(uploadDir(uploadId), 'metadata.json')
}

export function getProviderUploadMetadata(uploadId) {
  return readJsonFile(metadataPath(uploadId), null)
}

export async function saveProviderUpload({ uploadId, intent, request }) {
  const declaredLength = Number(request.headers['content-length'] ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > Number(intent.maxBytes)) {
    throw new Error(`UPLOAD_TOO_LARGE:${intent.maxBytes}`)
  }

  fs.mkdirSync(uploadDir(uploadId), { recursive: true })
  await pipeline(request, fs.createWriteStream(contentPath(uploadId)))
  const stat = fs.statSync(contentPath(uploadId))
  if (stat.size > Number(intent.maxBytes)) {
    fs.rmSync(uploadDir(uploadId), { recursive: true, force: true })
    throw new Error(`UPLOAD_TOO_LARGE:${intent.maxBytes}`)
  }

  const metadata = {
    ...intent,
    sizeBytes: stat.size,
    contentType: String(request.headers['content-type'] ?? 'application/octet-stream'),
    uploadedAt: new Date().toISOString(),
  }
  writeJsonFile(metadataPath(uploadId), metadata)
  return metadata
}

export function providerUploadContentPath(uploadId) {
  const filePath = contentPath(uploadId)
  if (!fs.existsSync(filePath)) {
    return null
  }
  return filePath
}
