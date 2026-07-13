import fs from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function sha256Json(value) {
  return `sha256:${createHash('sha256').update(stableJson(value)).digest('hex')}`
}

export function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function writeJsonFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

export function requireText(value, errorCode) {
  const normalized = String(value ?? '').trim()
  if (!normalized) throw new Error(errorCode)
  return normalized
}

export function validateDispatchPackage(dispatchPackage) {
  if (!dispatchPackage || typeof dispatchPackage !== 'object' || Array.isArray(dispatchPackage)) {
    throw new Error('EXTERNAL_DATA_FACTORY_DISPATCH_PACKAGE_REQUIRED')
  }
  if (dispatchPackage.schemaVersion !== '2026-06-26.offline-data-factory-dispatch.v1') {
    throw new Error('EXTERNAL_DATA_FACTORY_DISPATCH_SCHEMA_INVALID')
  }
  if (dispatchPackage.executorProfile !== 'external-worker') {
    throw new Error('EXTERNAL_DATA_FACTORY_DISPATCH_PROFILE_INVALID')
  }
  if (dispatchPackage.status !== 'ready-for-external-runner') {
    throw new Error('EXTERNAL_DATA_FACTORY_DISPATCH_STATUS_INVALID')
  }
  requireText(dispatchPackage.runId, 'EXTERNAL_DATA_FACTORY_DISPATCH_RUN_ID_REQUIRED')
  requireText(dispatchPackage.cityId, 'EXTERNAL_DATA_FACTORY_DISPATCH_CITY_ID_REQUIRED')
  requireText(dispatchPackage.stageKey, 'EXTERNAL_DATA_FACTORY_DISPATCH_STAGE_REQUIRED')
  if (dispatchPackage.executionMode !== 'offline-data-factory') {
    throw new Error('EXTERNAL_DATA_FACTORY_DISPATCH_EXECUTION_MODE_INVALID')
  }
  requireText(dispatchPackage.handoff?.artifactUri, 'EXTERNAL_DATA_FACTORY_DISPATCH_HANDOFF_URI_REQUIRED')
  requireText(dispatchPackage.handoff?.checksum, 'EXTERNAL_DATA_FACTORY_DISPATCH_HANDOFF_CHECKSUM_REQUIRED')
  requireText(dispatchPackage.artifactUri, 'EXTERNAL_DATA_FACTORY_DISPATCH_ARTIFACT_URI_REQUIRED')
  requireText(dispatchPackage.resultImport?.path, 'EXTERNAL_DATA_FACTORY_DISPATCH_RESULT_IMPORT_REQUIRED')
}
