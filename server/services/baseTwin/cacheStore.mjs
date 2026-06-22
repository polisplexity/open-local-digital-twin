import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getCityConfig } from '../cityRegistry.mjs'
import {
  CACHE_TTL_MS,
  MIN_HEALTHY_BUILDING_CANDIDATES,
  MIN_HEALTHY_CONTEXT_CANDIDATES,
  MIN_HEALTHY_ROAD_CANDIDATES,
  PAYLOAD_SCHEMA_VERSION,
} from './payloadConstants.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..', '..', '..')

function getRuntimeDir() {
  return process.env.TWIN_STUDIO_RUNTIME_DIR
    ? path.resolve(process.env.TWIN_STUDIO_RUNTIME_DIR)
    : path.join(rootDir, 'runtime-data')
}

function getCacheDir() {
  return path.join(getRuntimeDir(), 'live-cache')
}

function getCachePath(cityId = 'current') {
  return path.join(getCacheDir(), `${cityId}-base.json`)
}

function ensureCacheDir() {
  fs.mkdirSync(getCacheDir(), { recursive: true })
}

export function payloadHasExpectedShape(payload) {
  if (!payload || typeof payload !== 'object') return false
  if (payload.version && payload.version !== PAYLOAD_SCHEMA_VERSION) return false
  return Boolean(
    payload.layers?.roads?.features &&
      payload.layers?.buildings?.features &&
      payload.inventory?.totals &&
      payload.scene,
  )
}

export function payloadLooksSparse(payload) {
  const totals = payload?.inventory?.totals ?? {}
  const roads = Number(totals.roadsDiscovered ?? payload?.layers?.roads?.features?.length ?? 0)
  const buildings = Number(
    totals.buildingsDiscovered ?? payload?.layers?.buildings?.features?.length ?? 0,
  )
  const facilities = Number(
    totals.facilitiesDiscovered ?? payload?.layers?.facilities?.features?.length ?? 0,
  )
  const places = Number(totals.placesDiscovered ?? payload?.layers?.places?.features?.length ?? 0)
  const greenBlue = Number(
    totals.greenBlueDiscovered ?? payload?.layers?.greenBlue?.features?.length ?? 0,
  )

  return (
    roads < MIN_HEALTHY_ROAD_CANDIDATES ||
    buildings < MIN_HEALTHY_BUILDING_CANDIDATES ||
    facilities + places + greenBlue < MIN_HEALTHY_CONTEXT_CANDIDATES
  )
}

export function readCache(cityId = 'current', { allowStale = false } = {}) {
  try {
    const raw = fs.readFileSync(getCachePath(cityId), 'utf8')
    const payload = JSON.parse(raw)
    if (!payloadHasExpectedShape(payload)) {
      return null
    }
    const fetchedAtMs = Date.parse(payload?.fetchedAt ?? '')
    if (
      !allowStale &&
      (!Number.isFinite(fetchedAtMs) || fetchedAtMs < Date.now() - CACHE_TTL_MS)
    ) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export function writeCache(cityId, payload) {
  try {
    ensureCacheDir()
    fs.writeFileSync(getCachePath(cityId), `${JSON.stringify(payload, null, 2)}\n`)
    return true
  } catch (error) {
    console.error(
      'base twin cache write failed',
      String(error?.message ?? 'UNKNOWN_CACHE_WRITE_ERROR'),
    )
    return false
  }
}

export function readCachedCityBasePayload(cityId = 'current', options = {}) {
  const city = getCityConfig(cityId)
  return readCache(city.id, options)
}

export function getCityCacheStatus(cityId = 'current') {
  const city = getCityConfig(cityId)
  const cachePath = getCachePath(city.id)

  try {
    const stats = fs.statSync(cachePath)
    const payload = readCache(city.id, { allowStale: true })
    const fetchedAtMs = Date.parse(payload?.fetchedAt ?? '')
    const stale = !Number.isFinite(fetchedAtMs) || fetchedAtMs < Date.now() - CACHE_TTL_MS
    const totals = payload?.inventory?.totals ?? {}
    const rendered =
      Number(totals.roadsRendered ?? 0) +
      Number(totals.buildingsRendered ?? 0) +
      Number(totals.facilitiesRendered ?? 0) +
      Number(totals.greenBlueRendered ?? 0) +
      Number(totals.placesRendered ?? 0)
    const discovered =
      Number(totals.roadsDiscovered ?? 0) +
      Number(totals.buildingsDiscovered ?? 0) +
      Number(totals.facilitiesDiscovered ?? 0) +
      Number(totals.greenBlueDiscovered ?? 0) +
      Number(totals.placesDiscovered ?? 0)

    return {
      cityId: city.id,
      exists: Boolean(payload),
      cachePath,
      sizeBytes: stats.size,
      fetchedAt: payload?.fetchedAt ?? null,
      stale,
      sparse: payload ? payloadLooksSparse(payload) : false,
      version: payload?.version ?? null,
      rendered,
      discovered,
    }
  } catch {
    return {
      cityId: city.id,
      exists: false,
      cachePath,
      sizeBytes: 0,
      fetchedAt: null,
      stale: true,
      sparse: false,
      version: null,
      rendered: 0,
      discovered: 0,
    }
  }
}

export function listCityCacheStatuses(cityIds = []) {
  return cityIds.map((cityId) => getCityCacheStatus(cityId))
}
