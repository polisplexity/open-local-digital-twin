import {
  compactText,
  DEFAULT_BATCH_SIZE,
  DEFAULT_ENDPOINT,
  integerValue,
  numberValue,
} from './weatherFieldConfig.mjs'

function responseEntries(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') return [payload]
  return []
}

function normalizeOpenMeteoSample(entry, fallback) {
  const current = entry?.current || {}
  return {
    cellId: fallback.cellId,
    lon: numberValue(entry?.longitude, fallback.lon),
    lat: numberValue(entry?.latitude, fallback.lat),
    temperatureC: numberValue(current.temperature_2m),
    windSpeedMs: numberValue(current.wind_speed_10m),
    windDirectionDeg: numberValue(current.wind_direction_10m),
    observedAt: compactText(current.time),
    timezone: compactText(entry?.timezone, 'UTC'),
    elevationM: numberValue(entry?.elevation),
  }
}

async function fetchOpenMeteoBatch(cells, {
  endpoint = DEFAULT_ENDPOINT,
  fetchTimeoutMs = 15_000,
} = {}) {
  const params = new URLSearchParams({
    latitude: cells.map((cell) => String(cell.lat)).join(','),
    longitude: cells.map((cell) => String(cell.lon)).join(','),
    current: 'temperature_2m,wind_speed_10m,wind_direction_10m',
    temperature_unit: 'celsius',
    wind_speed_unit: 'ms',
    timezone: 'UTC',
  })
  const url = `${endpoint}?${params.toString()}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs)
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`OPEN_METEO_REQUEST_FAILED:${response.status}`)
    }
    const payload = await response.json()
    const entries = responseEntries(payload)
    return cells.map((cell, index) => normalizeOpenMeteoSample(entries[index] || entries[0], cell))
      .filter((sample) => sample.temperatureC != null || sample.windSpeedMs != null || sample.windDirectionDeg != null)
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchOpenMeteoCurrent(cells, {
  endpoint = DEFAULT_ENDPOINT,
  batchSize = DEFAULT_BATCH_SIZE,
  onProgress,
} = {}) {
  const resolvedBatchSize = integerValue(batchSize, DEFAULT_BATCH_SIZE, 1, 100)
  const samples = []
  const failures = []
  for (let index = 0; index < cells.length; index += resolvedBatchSize) {
    const batch = cells.slice(index, index + resolvedBatchSize)
    try {
      const batchSamples = await fetchOpenMeteoBatch(batch, { endpoint })
      samples.push(...batchSamples)
    } catch (error) {
      failures.push({
        cellIds: batch.map((cell) => cell.cellId),
        error: String(error?.message ?? 'OPEN_METEO_BATCH_FAILED'),
      })
    }
    if (typeof onProgress === 'function') {
      onProgress({
        completed: Math.min(cells.length, index + resolvedBatchSize),
        total: cells.length,
        samples: samples.length,
        failures: failures.length,
      })
    }
  }
  return { samples, failures, endpoint, batchSize: resolvedBatchSize }
}
