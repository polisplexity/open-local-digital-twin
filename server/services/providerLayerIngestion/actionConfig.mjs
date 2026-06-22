const DEFAULT_MAX_CSV_BYTES = 20 * 1024 * 1024
const DEFAULT_MAX_CITYJSON_BYTES = 50 * 1024 * 1024
const DEFAULT_MAX_IFC_BYTES = 100 * 1024 * 1024
const DEFAULT_MAX_STAC_BYTES = 20 * 1024 * 1024

const PACKAGE_FORMATS = new Set([
  'raster-cog',
  'stac',
  'wms',
  'sensor-feed',
  'mqtt',
  'http-json',
  'bim-package',
  'ifc',
  'cityjson',
  '3d-tiles',
  'shapefile',
  'geopackage',
])

function numberEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export {
  DEFAULT_MAX_CITYJSON_BYTES,
  DEFAULT_MAX_CSV_BYTES,
  DEFAULT_MAX_IFC_BYTES,
  DEFAULT_MAX_STAC_BYTES,
  PACKAGE_FORMATS,
  numberEnv,
}
