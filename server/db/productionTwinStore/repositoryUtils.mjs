export const OPEN_DATA_PROVIDER_ID = 'open-data-base'

export function json(value) {
  return JSON.stringify(value ?? null)
}

export function nonNegativeIntegerEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback
}

export function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

export function numberOrNull(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function slug(value, fallback = 'item') {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

export function textArray(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
}

export function parseMaybeJson(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export async function upsertOpenDataProvider(client) {
  await client.query(
    `
      INSERT INTO providers (id, name, provider_type, website_url, metadata, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET
        name = excluded.name,
        provider_type = excluded.provider_type,
        website_url = excluded.website_url,
        metadata = excluded.metadata,
        updated_at = now()
    `,
    [
      OPEN_DATA_PROVIDER_ID,
      'Open data base twin',
      'open-data-aggregator',
      'https://www.openstreetmap.org',
      json({
        sources: ['OpenStreetMap/Overpass', 'Nominatim', 'Wikipedia REST'],
        role: 'Base twin ingestion provider for city starter layers.',
      }),
    ],
  )
}
