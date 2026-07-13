const DEFAULT_OVERTURE_RELEASE = process.env.OVERTURE_RELEASE || '2026-04-15.0'

const CITY_SOURCE_PRESETS = {
  guanajuato: {
    sourceUrl: null,
    sourcePath: '/app/runtime-data/extracts/guanajuato/latest.osm.pbf',
  },
}

function slugify(value, separator = '-') {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^${separator}+|${separator}+$`, 'g'), '') || 'city'
}

export function citySourcePresetFor(cityId, input = {}) {
  const normalizedCityId = String(cityId ?? '').trim()
  if (!normalizedCityId) throw new Error('CITY_ID_REQUIRED')

  const citySlug = slugify(normalizedCityId, '-')
  const schemaCityId = slugify(normalizedCityId, '_')
  const configured = CITY_SOURCE_PRESETS[normalizedCityId] ?? {}
  return {
    cityId: normalizedCityId,
    citySlug,
    rawSchema: input.rawSchema ?? configured.rawSchema ?? `raw_osm_${schemaCityId}`,
    sourceSlug: input.sourceSlug ?? configured.sourceSlug ?? `${citySlug}-osm-pbf`,
    sourceUrl: input.sourceUrl ?? configured.sourceUrl ?? null,
    sourcePath: input.sourcePath ?? configured.sourcePath ?? `/app/runtime-data/extracts/${citySlug}/latest.osm.pbf`,
    overtureRelease: input.overtureRelease ?? configured.overtureRelease ?? DEFAULT_OVERTURE_RELEASE,
  }
}
