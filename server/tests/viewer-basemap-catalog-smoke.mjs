import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildViewerBaseMapCatalog, renderBaseMapSwitcher } from '../services/baseTwin/viewerContracts/baseMapCatalog.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function source(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8')
}

const catalog = buildViewerBaseMapCatalog()
const ids = catalog.entries.map((entry) => entry.id)

assert(catalog.version === 1, 'BASEMAP_CATALOG_VERSION_INVALID')
assert(catalog.defaultId === 'street', 'BASEMAP_DEFAULT_SHOULD_BE_STREET')
for (const requiredId of ['street', 'satellite']) {
  assert(ids.includes(requiredId), `BASEMAP_REQUIRED_ENTRY_MISSING:${requiredId}`)
}
assert(catalog.entries.every((entry) => entry.shortLabel && entry.label), 'BASEMAP_LABELS_REQUIRED')
assert(catalog.entries.filter((entry) => entry.type === 'raster').every((entry) => entry.tiles?.length), 'RASTER_BASEMAP_TILES_REQUIRED')
assert(catalog.entries.find((entry) => entry.id === 'satellite')?.type === 'raster', 'SATELLITE_BASEMAP_MUST_BE_RASTER')
for (const entry of catalog.entries) {
  for (const [theme, paint] of Object.entries(entry.mapLibrePaint || {})) {
    for (const key of ['raster-opacity', 'raster-brightness-min', 'raster-brightness-max']) {
      if (paint[key] === undefined) continue
      assert(Number(paint[key]) >= 0 && Number(paint[key]) <= 1, `BASEMAP_PAINT_RANGE_INVALID:${entry.id}:${theme}:${key}`)
    }
  }
}

const switcher = renderBaseMapSwitcher(catalog, { id: 'test-basemap' })
assert(switcher.includes('id="test-basemap"'), 'BASEMAP_SWITCHER_ID_MISSING')
for (const id of ids) {
  assert(switcher.includes(`data-basemap="${id}"`), `BASEMAP_SWITCHER_ENTRY_MISSING:${id}`)
}

const mapRuntime = await source('server/services/baseTwin/viewerRuntimes/mapLibreRuntime.mjs')
assert(mapRuntime.includes('const baseMapCatalog ='), 'MAP_RUNTIME_CATALOG_NOT_INJECTED')
assert(mapRuntime.includes("const baseMapLayerId = 'base-map-layer'"), 'MAP_RUNTIME_BASE_LAYER_ID_MISSING')
assert(mapRuntime.includes('function setBaseMap('), 'MAP_RUNTIME_SWITCHER_HANDLER_MISSING')
assert(mapRuntime.includes('style: initialMapStyle()'), 'MAP_RUNTIME_INITIAL_STYLE_NOT_CATALOG_DRIVEN')

const cityRuntime = await source('server/services/baseTwin/viewerRuntimes/cityCesiumRuntime.mjs')
assert(cityRuntime.includes('const baseMapCatalog ='), 'CESIUM_RUNTIME_CATALOG_NOT_INJECTED')
assert(cityRuntime.includes('function installBaseImagery('), 'CESIUM_BASE_IMAGERY_INSTALLER_MISSING')
assert(cityRuntime.includes('function setBaseMap('), 'CESIUM_RUNTIME_SWITCHER_HANDLER_MISSING')
assert(cityRuntime.includes('baseMap: currentBaseMapState()'), 'CESIUM_BASEMAP_STATE_NOT_BROADCAST')

const mapRenderer = await source('server/services/baseTwin/viewerRenderers/mapLibrePageRenderer.mjs')
const cityRenderer = await source('server/services/baseTwin/viewerRenderers/city3dPageRenderer.mjs')
assert(mapRenderer.includes('renderBaseMapSwitcher'), 'MAP_RENDERER_SWITCHER_MISSING')
assert(cityRenderer.includes('renderBaseMapSwitcher'), 'CITY3D_RENDERER_SWITCHER_MISSING')

const shareModel = await source('src/components/twin-module/query/queryShareModel.js')
assert(shareModel.includes('const baseMap = compactObject(visualState.baseMap)'), 'SAVED_VIEW_BASEMAP_CAPTURE_MISSING')
assert(shareModel.includes('baseMap,'), 'SAVED_VIEW_BASEMAP_PAYLOAD_MISSING')

console.log(JSON.stringify({
  ok: true,
  defaultId: catalog.defaultId,
  entries: ids,
}, null, 2))
