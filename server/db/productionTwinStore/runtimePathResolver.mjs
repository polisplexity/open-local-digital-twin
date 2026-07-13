import fs from 'node:fs'
import path from 'node:path'
import { getRuntimeDir } from '../../services/stateStore.mjs'

const RUNTIME_MARKER = '/runtime-data/'

function normalizedPath(value) {
  return String(value ?? '').replaceAll('\\', '/')
}

export function resolveRuntimeDataPath(value) {
  const rawPath = String(value ?? '').trim()
  if (!rawPath) return rawPath
  if (fs.existsSync(rawPath)) return rawPath

  const normalized = normalizedPath(rawPath)
  const markerIndex = normalized.indexOf(RUNTIME_MARKER)
  if (markerIndex === -1) return rawPath

  const relativeRuntimePath = normalized.slice(markerIndex + RUNTIME_MARKER.length)
  return path.join(getRuntimeDir(), ...relativeRuntimePath.split('/').filter(Boolean))
}
