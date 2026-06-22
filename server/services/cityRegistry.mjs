import path from 'node:path'
import { appendAuditLog, getDatabase, getRuntimeDir, readJsonFile, readMeta, writeJsonFile, writeMeta } from './stateStore.mjs'

export const DEFAULT_CITY_REGISTRY = {
  version: 1,
  activeCityId: 'adazi',
  cities: [
    {
      id: 'adazi',
      name: 'Ādaži',
      country: 'Latvia',
      countryCode: 'lv',
      region: 'Riga planning region',
      lat: 57.0756,
      lon: 24.3374,
      enabled: true,
      preloaded: true,
      spotlight: true,
      twinLabel: 'Ādaži Digital Twin',
      nominatimQuery: 'Ādaži, Latvia',
      wikipediaTownPage: '%C4%80da%C5%BEi',
      wikipediaMunicipalityPage: 'Adazi_Municipality',
      municipalityTitle: 'Ādaži Municipality',
      municipalityDescription: 'Municipality of Latvia',
    },
    {
      id: 'tallinn',
      name: 'Tallinn',
      country: 'Estonia',
      countryCode: 'ee',
      region: 'Harju County',
      lat: 59.437,
      lon: 24.7536,
      enabled: false,
      preloaded: true,
      spotlight: false,
      twinLabel: 'Tallinn Digital Twin',
      nominatimQuery: 'Tallinn, Estonia',
      wikipediaTownPage: 'Tallinn',
      wikipediaMunicipalityPage: 'Tallinn',
      municipalityTitle: 'Tallinn',
      municipalityDescription: 'Capital city of Estonia',
    },
    {
      id: 'pilsen',
      name: 'Pilsen',
      country: 'Czech Republic',
      countryCode: 'cz',
      region: 'Plzeň Region',
      lat: 49.7475,
      lon: 13.3776,
      enabled: false,
      preloaded: true,
      spotlight: false,
      twinLabel: 'Pilsen Digital Twin',
      nominatimQuery: 'Pilsen, Czech Republic',
      wikipediaTownPage: 'Plze%C5%88',
      wikipediaMunicipalityPage: 'Plze%C5%88',
      municipalityTitle: 'Pilsen',
      municipalityDescription: 'Regional city in the Czech Republic',
    },
    {
      id: 'gaziantep',
      name: 'Gaziantep',
      country: 'Türkiye',
      countryCode: 'tr',
      region: 'Southeastern Anatolia',
      lat: 37.0662,
      lon: 37.3833,
      enabled: false,
      preloaded: true,
      spotlight: false,
      twinLabel: 'Gaziantep Digital Twin',
      nominatimQuery: 'Gaziantep, Türkiye',
      wikipediaTownPage: 'Gaziantep',
      wikipediaMunicipalityPage: 'Gaziantep',
      municipalityTitle: 'Gaziantep',
      municipalityDescription: 'Metropolitan municipality of Türkiye',
    },
  ],
}

function getRegistryPath() {
  return path.join(getRuntimeDir(), 'city-registry.json')
}

function normalizeCity(raw = {}) {
  const idSeed = String(raw.id ?? raw.name ?? '')
  const id = idSeed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const rawTwinLabel = String(raw.twinLabel ?? '').trim()
  const legacyTwinLabel = id === 'adazi' && rawTwinLabel === 'Adazi Digital Twin'

  return {
    id,
    name: String(raw.name ?? '').trim() || id,
    country: String(raw.country ?? '').trim() || 'Unknown country',
    countryCode: String(raw.countryCode ?? '').trim().toLowerCase() || '',
    region: String(raw.region ?? '').trim() || '',
    lat: Number(raw.lat ?? 0),
    lon: Number(raw.lon ?? 0),
    enabled: raw.enabled !== false,
    preloaded: Boolean(raw.preloaded),
    spotlight: Boolean(raw.spotlight),
    twinLabel:
      legacyTwinLabel
        ? 'Ādaži Digital Twin'
        : rawTwinLabel || `${String(raw.name ?? id).trim()} Digital Twin`,
    nominatimQuery: String(raw.nominatimQuery ?? '').trim() || `${String(raw.name ?? id).trim()}, ${String(raw.country ?? '').trim()}`.trim(),
    wikipediaTownPage: String(raw.wikipediaTownPage ?? '').trim() || encodeURIComponent(String(raw.name ?? id).trim()),
    wikipediaMunicipalityPage:
      String(raw.wikipediaMunicipalityPage ?? '').trim() || encodeURIComponent(String(raw.name ?? id).trim()),
    municipalityTitle: String(raw.municipalityTitle ?? '').trim() || String(raw.name ?? id).trim(),
    municipalityDescription: String(raw.municipalityDescription ?? '').trim() || 'Municipal authority territory',
  }
}

function normalizeRegistry(raw = {}) {
  const incomingCities = Array.isArray(raw.cities) ? raw.cities : DEFAULT_CITY_REGISTRY.cities
  const merged = new Map()

  DEFAULT_CITY_REGISTRY.cities.forEach((city) => {
    merged.set(city.id, normalizeCity(city))
  })

  incomingCities.forEach((city) => {
    const normalized = normalizeCity(city)
    if (!normalized.id) return
    const previous = merged.get(normalized.id)
    merged.set(normalized.id, {
      ...(previous ?? {}),
      ...normalized,
    })
  })

  const cities = Array.from(merged.values())
  const enabledCities = cities.filter((city) => city.enabled)
  const fallbackCity = enabledCities[0] ?? cities[0] ?? normalizeCity(DEFAULT_CITY_REGISTRY.cities[0])
  const requestedActive = String(raw.activeCityId ?? DEFAULT_CITY_REGISTRY.activeCityId)
  const currentActive = cities.find((city) => city.id === requestedActive && city.enabled) ?? fallbackCity

  return {
    version: Number(raw.version ?? DEFAULT_CITY_REGISTRY.version) || DEFAULT_CITY_REGISTRY.version,
    activeCityId: currentActive.id,
    cities,
  }
}

function writeRegistryFile(registry) {
  try {
    writeJsonFile(getRegistryPath(), registry)
    return true
  } catch {
    return false
  }
}

function readRegistryFromDatabase() {
  const db = getDatabase()
  const registryRow = db
    .prepare('SELECT version, active_city_id FROM city_registry WHERE id = 1')
    .get()
  if (!registryRow) return null

  const cities = db
    .prepare('SELECT payload_json FROM cities ORDER BY sort_order ASC, id ASC')
    .all()
    .map((row) => normalizeCity(JSON.parse(row.payload_json)))

  return normalizeRegistry({
    version: registryRow.version,
    activeCityId: registryRow.active_city_id,
    cities,
  })
}

function writeRegistryToDatabase(registry) {
  const db = getDatabase()
  const normalized = normalizeRegistry(registry)
  const timestamp = new Date().toISOString()
  db.exec('BEGIN IMMEDIATE')
  try {
    db
      .prepare(`
        INSERT INTO city_registry (id, version, active_city_id, updated_at)
        VALUES (1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          version = excluded.version,
          active_city_id = excluded.active_city_id,
          updated_at = excluded.updated_at
      `)
      .run(normalized.version, normalized.activeCityId, timestamp)
    db.prepare('DELETE FROM cities').run()
    const insertCity = db.prepare(`
      INSERT INTO cities (id, payload_json, sort_order, updated_at)
      VALUES (?, ?, ?, ?)
    `)
    normalized.cities.forEach((city, index) => {
      insertCity.run(city.id, JSON.stringify(city), index, timestamp)
    })
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  writeRegistryFile(normalized)
  return normalized
}

function migrateCityRegistryToDatabase() {
  if (readMeta('city_registry_migrated') === '1' && readRegistryFromDatabase()) {
    return
  }

  const seededRegistry = readJsonFile(getRegistryPath(), DEFAULT_CITY_REGISTRY)
  const normalized = writeRegistryToDatabase(normalizeRegistry(seededRegistry))
  writeMeta('city_registry_migrated', '1')
  appendAuditLog({
    action: 'city_registry.migrated',
    targetType: 'city_registry',
    targetId: 'default',
    payload: { cityCount: normalized.cities.length, activeCityId: normalized.activeCityId },
  })
}

export function getCityRegistry() {
  migrateCityRegistryToDatabase()
  const registry = readRegistryFromDatabase()
  if (registry) {
    return registry
  }
  return writeRegistryToDatabase(DEFAULT_CITY_REGISTRY)
}

export function listCities() {
  return getCityRegistry().cities
}

export function getActiveCityConfig() {
  const registry = getCityRegistry()
  return registry.cities.find((city) => city.id === registry.activeCityId) ?? registry.cities[0]
}

export function getCityConfig(cityId = 'current') {
  if (!cityId || cityId === 'current') {
    return getActiveCityConfig()
  }
  const registry = getCityRegistry()
  return (
    registry.cities.find((city) => city.id === cityId) ??
    registry.cities.find((city) => city.id === registry.activeCityId) ??
    registry.cities[0]
  )
}

export function findCityConfig(cityId = '') {
  const normalizedCityId = String(cityId ?? '').trim()
  if (!normalizedCityId || normalizedCityId === 'current') {
    return getActiveCityConfig()
  }
  return getCityRegistry().cities.find((city) => city.id === normalizedCityId) ?? null
}

export function updateCityRegistry(nextRegistry = {}, { actorUserId = null, reason = 'city_registry.updated' } = {}) {
  const current = getCityRegistry()
  const normalized = writeRegistryToDatabase({
    ...current,
    ...nextRegistry,
    cities: Array.isArray(nextRegistry.cities) ? nextRegistry.cities : current.cities,
  })
  appendAuditLog({
    actorUserId,
    action: reason,
    targetType: 'city_registry',
    targetId: 'default',
    payload: { activeCityId: normalized.activeCityId, cityCount: normalized.cities.length },
  })
  return normalized
}
