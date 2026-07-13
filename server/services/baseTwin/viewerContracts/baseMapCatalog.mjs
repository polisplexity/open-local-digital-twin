const OSM_RASTER_TILES = [
  'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
  'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
  'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
]

const DEFAULT_SATELLITE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

function configuredRasterEntry({
  id,
  label,
  shortLabel,
  envUrl,
  fallbackUrl,
  envAttribution,
  fallbackAttribution,
  envMaximumLevel,
  fallbackMaximumLevel = 18,
  mapLibrePaint,
  cesiumStyle,
}) {
  const url = String(process.env[envUrl] || fallbackUrl || '').trim()
  if (!url) return null
  const configuredMaximumLevel = Number(process.env[envMaximumLevel])
  const maximumLevel = Number.isFinite(configuredMaximumLevel)
    ? Math.max(0, Math.min(22, configuredMaximumLevel))
    : fallbackMaximumLevel
  return {
    id,
    label,
    shortLabel,
    type: 'raster',
    tiles: [url],
    tileSize: 256,
    maximumLevel,
    attribution: String(process.env[envAttribution] || fallbackAttribution || label).trim(),
    mapLibrePaint,
    cesiumStyle,
  }
}

export function buildViewerBaseMapCatalog() {
  const entries = [
    {
      id: 'street',
      label: 'Street map',
      shortLabel: 'Street',
      type: 'raster',
      tiles: OSM_RASTER_TILES,
      tileSize: 256,
      maximumLevel: 19,
      attribution: '© OpenStreetMap contributors',
      mapLibrePaint: {
        light: {
          'raster-opacity': 0.96,
          'raster-saturation': 0,
          'raster-contrast': 0,
          'raster-brightness-min': 0,
          'raster-brightness-max': 1,
        },
        dark: {
          'raster-opacity': 0.76,
          'raster-saturation': -0.35,
          'raster-contrast': 0.08,
          'raster-brightness-min': 0.16,
          'raster-brightness-max': 0.86,
        },
      },
      cesiumStyle: {
        light: { alpha: 0.92, brightness: 1, contrast: 1, saturation: 0.82 },
        dark: { alpha: 0.72, brightness: 0.42, contrast: 1.12, saturation: 0.42 },
      },
    },
    configuredRasterEntry({
      id: 'satellite',
      label: 'Satellite imagery',
      shortLabel: 'Satellite',
      envUrl: 'TWIN_BASEMAP_SATELLITE_URL',
      fallbackUrl: DEFAULT_SATELLITE_TILE_URL,
      envAttribution: 'TWIN_BASEMAP_SATELLITE_ATTRIBUTION',
      fallbackAttribution: 'Satellite imagery © Esri',
      envMaximumLevel: 'TWIN_BASEMAP_SATELLITE_MAX_LEVEL',
      fallbackMaximumLevel: 17,
      mapLibrePaint: {
        light: {
          'raster-opacity': 0.94,
          'raster-saturation': 0,
          'raster-contrast': 0.08,
          'raster-brightness-min': 0,
          'raster-brightness-max': 1,
        },
        dark: {
          'raster-opacity': 0.82,
          'raster-saturation': -0.18,
          'raster-contrast': 0.16,
          'raster-brightness-min': 0.08,
          'raster-brightness-max': 0.82,
        },
      },
      cesiumStyle: {
        light: { alpha: 0.94, brightness: 1, contrast: 1.04, saturation: 0.96 },
        dark: { alpha: 0.82, brightness: 0.42, contrast: 1.18, saturation: 0.72 },
      },
    }),
  ].filter(Boolean)

  return {
    version: 1,
    defaultId: 'street',
    entries,
  }
}

export function renderBaseMapSwitcher(catalog, { id = 'basemap-switcher', label = 'Base map', className = '' } = {}) {
  const entries = catalog?.entries ?? []
  if (!entries.length) return ''
  const buttons = entries
    .map((entry) => (
      `<button type="button" data-basemap="${entry.id}" aria-pressed="${entry.id === catalog.defaultId ? 'true' : 'false'}">${entry.shortLabel || entry.label}</button>`
    ))
    .join('')
  return `<div class="basemap-switcher ${className}" id="${id}" aria-label="${label}"><span>Base</span>${buttons}</div>`
}
