import {
  getCityBoundaryBbox,
  getCityFeatureMvtTile,
  getCityFeatureViewport,
  getCityLayerCapabilities,
  getCitySelectionAreaSummary,
  getCitySelectionUnits,
} from '../db/productionTwinStore.mjs'
import { renderCity3dPage, renderCityImmersivePage, renderCityMapLibrePage } from '../services/baseTwinService.mjs'
import { buildMapSurfaceManifest } from '../services/baseTwin/viewerContracts/mapSurfaceManifest.mjs'
import { buildViewerSurfaceManifest } from '../services/baseTwin/viewerContracts/viewerSurfaceManifest.mjs'
import { findCityConfig, getActiveCityConfig } from '../services/cityRegistry.mjs'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function cityFromArgs() {
  const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID
  return cityId ? findCityConfig(cityId) : getActiveCityConfig()
}

function tileCoordinate(lon, lat, zoom) {
  const latRad = lat * Math.PI / 180
  const scale = 2 ** zoom
  return {
    z: zoom,
    x: Math.floor((lon + 180) / 360 * scale),
    y: Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale),
  }
}

const city = cityFromArgs()
assert(city?.id, 'CITY_NOT_FOUND')

const mapShell = renderCityMapLibrePage({ cityId: city.id, embed: true })
assert(mapShell.includes('/vendor/maplibre-gl/maplibre-gl.js'), 'MAP_SHELL_MAPLIBRE_RUNTIME_MISSING')
assert(mapShell.includes('/tiles/{z}/{x}/{y}.mvt'), 'MAP_SHELL_VECTOR_TILE_ENDPOINT_MISSING')
assert(mapShell.includes("type: 'vector'"), 'MAP_SHELL_VECTOR_SOURCE_MISSING')
assert(mapShell.includes('const surfaceManifest ='), 'MAP_SHELL_SURFACE_MANIFEST_MISSING')
assert(mapShell.includes('id="twin-surface-manifest"'), 'MAP_SHELL_MANIFEST_JSON_MISSING')
assert(mapShell.includes('manifestLayerKeys'), 'MAP_SHELL_MANIFEST_LAYER_GUARD_MISSING')
assert(!mapShell.includes('/vendor/leaflet/leaflet.js'), 'MAP_SHELL_SHOULD_NOT_USE_LEAFLET')

const mapManifest = buildMapSurfaceManifest({ cityId: city.id, mode: 'embedded-analyst' })
assert(mapManifest.mode === 'embedded-analyst', 'MAP_MANIFEST_MODE_MISMATCH')
assert(mapManifest.layerFamilies.some((family) => family.key === 'buildings'), 'MAP_MANIFEST_BUILDINGS_MISSING')
assert(mapManifest.selectionScopes.some((scope) => scope.key === 'block'), 'MAP_MANIFEST_BLOCK_SCOPE_MISSING')

const viewerManifests = ['map', 'municipal3d', 'immersive'].map((surface) => buildViewerSurfaceManifest({
  cityId: city.id,
  surface,
  mode: surface === 'immersive' ? 'publicShare' : 'embeddedAnalyst',
}))
assert(viewerManifests.every((manifest) => manifest.cityId === city.id), 'VIEWER_MANIFEST_CITY_MISMATCH')
assert(viewerManifests.some((manifest) => manifest.surface === 'municipal3d' && manifest.controls.bimLayers), 'VIEWER_MANIFEST_3D_BIM_CONTROLS_MISSING')
assert(viewerManifests.some((manifest) => manifest.surface === 'municipal3d' && manifest.controls.spatialPhenomena), 'VIEWER_MANIFEST_3D_PHENOMENA_CONTROLS_MISSING')
assert(viewerManifests.some((manifest) => manifest.surface === 'immersive' && manifest.label === 'Civic XR'), 'VIEWER_MANIFEST_CIVIC_XR_LABEL_MISSING')
assert(viewerManifests.some((manifest) => manifest.surface === 'immersive' && manifest.controls.xrModes), 'VIEWER_MANIFEST_CIVIC_XR_CONTROLS_MISSING')
assert(viewerManifests.some((manifest) => (
  manifest.surface === 'immersive' &&
  manifest.controls.xrExperienceModes?.includes('walk') &&
  manifest.controls.xrExperienceModes?.includes('compare') &&
  manifest.controls.xrExperienceModes?.includes('overlay')
)), 'VIEWER_MANIFEST_CIVIC_XR_EXPERIENCE_MODES_MISSING')

const sceneShell = renderCity3dPage({ cityId: city.id, embed: true })
assert(sceneShell.includes('id="twin-surface-manifest"'), 'SCENE_SHELL_MANIFEST_JSON_MISSING')
assert(sceneShell.includes('/vendor/cesium/Cesium.js'), 'SCENE_SHELL_CESIUM_RUNTIME_MISSING')
assert(sceneShell.includes('window.CESIUM_BASE_URL'), 'SCENE_SHELL_CESIUM_BASE_URL_MISSING')
assert(sceneShell.includes('EllipsoidTerrainProvider'), 'SCENE_SHELL_LOCAL_TERRAIN_MISSING')
assert(sceneShell.includes("runtime: 'cesium'"), 'SCENE_SHELL_CESIUM_READY_STATE_MISSING')
assert(sceneShell.includes('async function loadBimLayers'), 'SCENE_SHELL_BIM_LAYER_LOADER_MISSING')
assert(sceneShell.includes('/bim-layers'), 'SCENE_SHELL_BIM_LAYER_ENDPOINT_MISSING')
assert(sceneShell.includes('async function loadPhenomenaGrid'), 'SCENE_SHELL_PHENOMENA_GRID_LOADER_MISSING')
assert(sceneShell.includes('/environmental-cells?'), 'SCENE_SHELL_PHENOMENA_GRID_ENDPOINT_MISSING')
assert(sceneShell.includes('data-phenomena-mode="off"'), 'SCENE_SHELL_PHENOMENA_BASE_MODE_MISSING')
assert(sceneShell.includes('data-phenomena-mode="builtIntensity"'), 'SCENE_SHELL_PHENOMENA_BUILT_FORM_MISSING')
assert(sceneShell.includes('data-phenomena-mode="terrainElevation"'), 'SCENE_SHELL_PHENOMENA_TERRAIN_MISSING')
assert(sceneShell.includes('data-phenomena-mode="terrainSlope"'), 'SCENE_SHELL_PHENOMENA_SLOPE_MISSING')
assert(sceneShell.includes('data-phenomena-mode="airTemperature"'), 'SCENE_SHELL_PHENOMENA_TEMPERATURE_MISSING')
assert(!sceneShell.includes('data-phenomena-mode="heatProxy"'), 'SCENE_SHELL_SHOULD_HIDE_HEAT_PROXY_CONTROL')
assert(!sceneShell.includes('data-phenomena-mode="airflowFriction"'), 'SCENE_SHELL_SHOULD_HIDE_WIND_PROXY_CONTROL')
assert(!sceneShell.includes('data-phenomena-mode="greenBlueCooling"'), 'SCENE_SHELL_SHOULD_HIDE_COOLING_PROXY_CONTROL')
assert(!sceneShell.includes('data-phenomena-mode="solarExposureProxy"'), 'SCENE_SHELL_SHOULD_HIDE_SUN_PROXY_CONTROL')
assert(!sceneShell.includes('data-phenomena-mode="waterFlowProxy"'), 'SCENE_SHELL_SHOULD_HIDE_WATER_PROXY_CONTROL')
assert(sceneShell.includes('activeQuerySelection'), 'SCENE_SHELL_QUERY_SELECTION_GUARD_MISSING')
assert(sceneShell.includes('applyQuerySelection'), 'SCENE_SHELL_QUERY_SELECTION_APPLY_MISSING')
assert(sceneShell.includes("broadcast('twin:error'"), 'SCENE_SHELL_ERROR_BROADCAST_MISSING')

const immersiveShell = renderCityImmersivePage({ cityId: city.id, embed: true })
assert(immersiveShell.includes('id="twin-surface-manifest"'), 'CIVIC_XR_SHELL_MANIFEST_JSON_MISSING')
assert(immersiveShell.includes('data-civic-xr-runtime="babylon-webxr"'), 'CIVIC_XR_RUNTIME_MISSING')
assert(immersiveShell.includes('id="civic-xr-canvas"'), 'CIVIC_XR_CANVAS_MISSING')
assert(immersiveShell.includes('/vendor/babylonjs/core/Engines/engine.js'), 'CIVIC_XR_BABYLON_ENGINE_MISSING')
assert(immersiveShell.includes('createDefaultXRExperienceAsync'), 'CIVIC_XR_WEBXR_BOOTSTRAP_MISSING')
assert(immersiveShell.includes('twin:set-xr-mode'), 'CIVIC_XR_XR_MODE_MESSAGE_HANDLER_MISSING')
assert(!immersiveShell.includes('data-civic-xr-mode='), 'CIVIC_XR_MODE_CONTROLS_SHOULD_LIVE_IN_QUERY_RAIL')
assert(immersiveShell.includes('data-civic-xr-session="desktop"'), 'CIVIC_XR_STREET_CONTROL_MISSING')
assert(immersiveShell.includes('data-civic-xr-session="vr"'), 'CIVIC_XR_VR_CONTROL_MISSING')
assert(immersiveShell.includes('data-civic-xr-session="ar"'), 'CIVIC_XR_AR_CONTROL_MISSING')
assert(immersiveShell.includes('data-civic-xr-fullscreen'), 'CIVIC_XR_FULLSCREEN_CONTROL_MISSING')
assert(immersiveShell.includes('twin:set-visible-layers'), 'CIVIC_XR_SHELL_LAYER_MESSAGE_MISSING')
assert(!immersiveShell.includes('aframe.io'), 'CIVIC_XR_SHELL_SHOULD_NOT_USE_REMOTE_AFRAME')
assert(!immersiveShell.includes('AFRAME_RUNTIME_UNAVAILABLE'), 'CIVIC_XR_SHELL_SHOULD_NOT_REQUIRE_AFRAME')
assert(!immersiveShell.includes('immersive-light-stage'), 'CIVIC_XR_SHOULD_NOT_RENDER_LEGACY_SVG_STAGE')
assert(immersiveShell.includes("broadcast('twin:error'"), 'CIVIC_XR_SHELL_ERROR_BROADCAST_MISSING')

const lon = Number(city.lon)
const lat = Number(city.lat)
assert(Number.isFinite(lon) && Number.isFinite(lat), 'CITY_CENTER_REQUIRED')

const bbox = [
  Math.max(-180, lon - 0.08),
  Math.max(-90, lat - 0.08),
  Math.min(180, lon + 0.08),
  Math.min(90, lat + 0.08),
]

const viewportLayers = argValue('layers') || ''
let viewport = await getCityFeatureViewport(city.id, {
  bbox,
  layers: viewportLayers,
  limit: 250,
})

if (viewport.configured === false) {
  console.log(JSON.stringify({
    ok: true,
    cityId: city.id,
    databaseConfigured: false,
    skipped: [
      'viewportFeatures',
      'mvtTile',
      'layerCapabilities',
      'selectionUnits',
      'selectionSummary',
    ],
    message: 'Viewer shells and manifests passed; database-backed viewport checks require TWIN_STUDIO_DATABASE_URL.',
  }, null, 2))
  process.exit(0)
}

let viewportBbox = bbox
let viewportScope = 'center'
if (viewport.ok && viewport.returned === 0) {
  const boundaryBbox = await getCityBoundaryBbox(city.id)
  if (boundaryBbox.ok && boundaryBbox.bbox) {
    viewport = await getCityFeatureViewport(city.id, {
      bbox: boundaryBbox.bbox,
      layers: viewportLayers,
      limit: 250,
    })
    viewportBbox = boundaryBbox.bbox
    viewportScope = 'boundary'
  }
}
assert(viewport.ok, `VIEWPORT_FEATURES_FAILED:${viewport.error ?? 'unknown'}`)
assert(viewport.returned > 0, 'VIEWPORT_FEATURES_EMPTY')
assert(viewport.geojson?.type === 'FeatureCollection', 'VIEWPORT_GEOJSON_MISSING')
assert(viewport.geojson.features.length === viewport.returned, 'VIEWPORT_FEATURE_COUNT_MISMATCH')

let selectedTile = null
for (const zoom of [12, 11, 10]) {
  const candidate = tileCoordinate(lon, lat, zoom)
  const tile = await getCityFeatureMvtTile(city.id, {
    ...candidate,
    layers: argValue('layers') || '',
    limit: 1000,
  })
  assert(tile.ok, `MVT_TILE_FAILED:${tile.error ?? 'unknown'}`)
  if (tile.byteLength > 0) {
    selectedTile = tile
    break
  }
}
assert(selectedTile, 'MVT_TILE_EMPTY')

const capabilities = await getCityLayerCapabilities(city.id)
assert(capabilities.ok, `LAYER_CAPABILITIES_FAILED:${capabilities.error ?? 'unknown'}`)
assert(capabilities.layers.length > 0, 'LAYER_CAPABILITIES_EMPTY')
assert(capabilities.summary.geojsonLayerCount > 0, 'LAYER_CAPABILITIES_GEOJSON_MISSING')
assert(capabilities.summary.vectorTileLayerCount > 0, 'LAYER_CAPABILITIES_MVT_MISSING')
assert(
  capabilities.layers.some((layer) => layer.key === 'buildings' && layer.capabilities.geojsonWindow.available),
  'LAYER_CAPABILITIES_BUILDINGS_GEOJSON_MISSING',
)

const selectionUnits = await getCitySelectionUnits(city.id, { limit: 6 })
assert(selectionUnits.ok, `SELECTION_UNITS_FAILED:${selectionUnits.error ?? 'unknown'}`)
assert(selectionUnits.units.some((unit) => unit.scope === 'city'), 'SELECTION_UNITS_CITY_MISSING')
assert(selectionUnits.scopes.some((scope) => scope.scope === 'block'), 'SELECTION_UNITS_BLOCK_SCOPE_MISSING')

const citySelectionSummary = await getCitySelectionAreaSummary(city.id, { scope: 'city' })
assert(citySelectionSummary.ok, `SELECTION_SUMMARY_FAILED:${citySelectionSummary.error ?? 'unknown'}`)
assert(citySelectionSummary.area?.areaKm2 > 0, 'SELECTION_SUMMARY_AREA_MISSING')
assert(citySelectionSummary.featureCount > 0, 'SELECTION_SUMMARY_FEATURES_EMPTY')
assert(citySelectionSummary.indicators.some((indicator) => indicator.key === 'built_fabric_density'), 'SELECTION_SUMMARY_INDICATORS_MISSING')

console.log(JSON.stringify({
  ok: true,
  cityId: city.id,
  bbox: viewportBbox,
  viewportScope,
  viewport: {
    returned: viewport.returned,
    truncated: viewport.truncated,
    layers: viewport.layers,
    firstFeature: {
      id: viewport.geojson.features[0]?.id ?? null,
      layerKey: viewport.geojson.features[0]?.properties?.layerKey ?? null,
      geometryType: viewport.geojson.features[0]?.geometry?.type ?? null,
    },
  },
  mvt: {
    z: selectedTile.z,
    x: selectedTile.x,
    y: selectedTile.y,
    byteLength: selectedTile.byteLength,
    layers: selectedTile.layers,
  },
  capabilities: {
    layerCount: capabilities.summary.layerCount,
    geojsonLayerCount: capabilities.summary.geojsonLayerCount,
    vectorTileLayerCount: capabilities.summary.vectorTileLayerCount,
    bimLayerCount: capabilities.summary.bimLayerCount,
    rasterMetadataLayerCount: capabilities.summary.rasterMetadataLayerCount,
    threeDMetadataLayerCount: capabilities.summary.threeDMetadataLayerCount,
  },
  selection: {
    units: selectionUnits.summary.totalUnits,
    areaKm2: citySelectionSummary.area.areaKm2,
    featureCount: citySelectionSummary.featureCount,
  },
}, null, 2))
