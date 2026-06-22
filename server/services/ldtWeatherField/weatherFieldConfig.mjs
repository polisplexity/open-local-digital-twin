import crypto from 'node:crypto'

export const DEFAULT_CITY_IDS = ['kharkiv']
export const DEFAULT_SCENARIO_KEY = 'baseline'
export const DEFAULT_WEATHER_GRID_RESOLUTION_M = 2500
export const DEFAULT_BATCH_SIZE = 40
export const DEFAULT_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
export const OPEN_METEO_DOCS_URL = 'https://open-meteo.com/en/docs'
export const OPEN_METEO_TERMS_URL = 'https://open-meteo.com/en/terms'
export const WEATHER_LAYER_KEYS = [
  'weather_air_temperature_c',
  'weather_wind_speed_ms',
  'weather_wind_direction_deg',
]

export function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

export function integerValue(value, fallback, min, max) {
  const number = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

export function numberValue(value, fallback = null) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

export function weatherGridKeyFromResolution(resolutionM = DEFAULT_WEATHER_GRID_RESOLUTION_M) {
  const meters = integerValue(resolutionM, DEFAULT_WEATHER_GRID_RESOLUTION_M, 500, 25_000)
  return `weather-open-meteo-${meters}m`
}
