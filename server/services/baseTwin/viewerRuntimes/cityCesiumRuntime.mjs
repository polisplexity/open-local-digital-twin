import { renderViewerShareManifestRuntime } from './viewerShareManifestRuntime.mjs'
import { renderCityCesiumCameraRuntime } from './cesium/cityCesiumCameraRuntime.mjs'
import { renderCityCesiumQuerySelectionRuntime } from './cesium/cityCesiumQuerySelectionRuntime.mjs'
import { renderCityCesiumSpatialRuntime } from './cesium/cityCesiumSpatialRuntime.mjs'
import {
  city3dPhenomenaCommandMap,
  city3dPhenomenaRuntimeConfig,
} from '../viewerContracts/city3dPhenomenaContract.mjs'

export function renderCityCesiumRuntime({ cityId, baseEndpoint }) {
  const phenomenaModes = city3dPhenomenaRuntimeConfig()
  const phenomenaCommands = city3dPhenomenaCommandMap()
  return `
      <script>
        window.CESIUM_BASE_URL = '/vendor/cesium/'
      </script>
      <script src="/vendor/cesium/Cesium.js"></script>
      <script>
        const esc = (value) => String(value ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;')

        const viewerId = '3d'
        const cityId = ${JSON.stringify(cityId)}
        const baseEndpoint = ${JSON.stringify(baseEndpoint)}
        const CesiumLib = window.Cesium
        const layerState = {
          boundary: true,
          roads: true,
          buildings: true,
          greenBlue: true,
          places: true,
          civic: true,
          mobility: true,
          commerce: true,
          wasteSeeds: true,
          bimAssets: false,
          spatialPhenomena: true,
        }
        const PHENOMENA_MODES = ${JSON.stringify(phenomenaModes, null, 10)}
        const PHENOMENA_COMMANDS = ${JSON.stringify(phenomenaCommands, null, 10)}
        let viewer = null
        let payload = null
        let baseDataSource = null
        let queryDataSource = null
        let phenomenaDataSource = null
        let phenomenaGrids = {}
        let phenomenaGridKeys = {}
        let phenomenaMode = 'off'
        let activeQuerySelection = null
        let readyBroadcasted = false
        let baseImageryInstalled = false
        let baseImageryLayer = null
        let visualTheme = 'light'
        let sourceTerrainInstalled = false
        let sourceTerrainSamples = []
        let sourceTerrainStats = null
        let sourceTerrainBounds = null
        let sourceTerrainTileCache = new Map()
        let runoffAnimationActive = false
        let runoffAnimationStartTime = null
        let activeCameraFocusBounds = null
        let stableCameraInteractionsInstalled = false
        let boundedCameraState = null
        const TERRAIN_PROVIDER_HEIGHTMAP_SIZE = 48
        const TERRAIN_PROVIDER_EXAGGERATION = 5.5
        const TERRAIN_PROVIDER_MAX_SOURCE_DISTANCE_M = 1200
        const CAMERA_MIN_HEIGHT_M = 120
        const CAMERA_MIN_ABOVE_TERRAIN_M = 220
        const CAMERA_MIN_RANGE_M = 420
        const CAMERA_MAX_RANGE_M = 85000
        const CAMERA_FOCUS_PADDING_RATIO = 1.35
        const LARGE_ESTIMATED_BUILDING_AREA_M2 = 15000
        const MAX_EXTRUDED_BUILDING_AREA_M2 = 90000

        function broadcast(type, payload = {}) {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ source: 'twin-viewer', viewer: viewerId, type, ...payload }, '*')
          }
        }

        async function loadPayload() {
          const response = await fetch(baseEndpoint, { credentials: 'same-origin' })
          if (!response.ok) throw new Error('DATA_LOAD_FAILED')
          return response.json()
        }

        async function loadBimLayers(cityId) {
          const response = await fetch('/api/live/' + encodeURIComponent(cityId || 'current') + '/bim-layers', {
            credentials: 'same-origin',
          })
          if (!response.ok) return { layers: [] }
          return response.json()
        }

        function phenomenaConfig(mode = phenomenaMode) {
          return PHENOMENA_MODES[mode] || null
        }

        async function loadPhenomenaGrid(cityId, mode = phenomenaMode, options = {}) {
          const config = phenomenaConfig(mode)
          if (!config) return featureCollection([])
          const params = new URLSearchParams({
            layerKey: config.layerKey,
            limit: isTerrainSurfaceMode(mode) ? '50000' : '5000',
          })
          const scopeParams = options.query || options.selection
            ? environmentalCellScopeParams(options.query || {}, options.selection || null)
            : null
          if (scopeParams?.bbox) params.set('bbox', scopeParams.bbox)
          if (scopeParams?.center) params.set('center', scopeParams.center)
          if (scopeParams?.radiusMeters) params.set('radiusMeters', scopeParams.radiusMeters)
          const response = await fetch('/api/live/' + encodeURIComponent(cityId || 'current') + '/environmental-cells?' + params.toString(), {
            credentials: 'same-origin',
            headers: { Accept: 'application/geo+json' },
          })
          if (!response.ok) return featureCollection([])
          return response.json()
        }

        ${renderViewerShareManifestRuntime()}

        function detectVisualTheme() {
          const storedTheme = String(window.localStorage?.getItem('theme') || '').toLowerCase()
          const parentTheme = (() => {
            try {
              return String(window.parent?.document?.documentElement?.getAttribute('data-bs-theme') || '').toLowerCase()
            } catch {
              return ''
            }
          })()
          if (storedTheme === 'dark' || parentTheme === 'dark') return 'dark'
          if (storedTheme === 'light' || parentTheme === 'light') return 'light'
          return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light'
        }

        function scenePalette() {
          if (visualTheme === 'dark') {
            return {
              background: '#020617',
              globe: '#020617',
              imageryAlpha: 0.34,
              imageryBrightness: 0.25,
              imageryContrast: 1.2,
              imagerySaturation: 0,
              boundary: { fill: '#f8fafc', stroke: '#f8fafc', alpha: 0.08, width: 3 },
              roads: { fill: '#f8fafc', stroke: '#f8fafc', alpha: 0.9, width: 2 },
              buildings: { fill: '#f8fafc', stroke: '#ffffff', alpha: 0.5, width: 1 },
              greenBlue: { fill: '#e2e8f0', stroke: '#ffffff', alpha: 0.18, width: 2 },
              places: { fill: '#ffffff', stroke: '#020617', alpha: 0.95, width: 1 },
              civic: { fill: '#ffffff', stroke: '#020617', alpha: 0.95, width: 1 },
              mobility: { fill: '#ffffff', stroke: '#020617', alpha: 0.95, width: 1 },
              commerce: { fill: '#ffffff', stroke: '#020617', alpha: 0.95, width: 1 },
              wasteSeeds: { fill: '#ffffff', stroke: '#020617', alpha: 0.95, width: 1 },
              bimAssets: { fill: '#f8fafc', stroke: '#ffffff', alpha: 0.82, width: 1 },
              fallback: { fill: '#f8fafc', stroke: '#ffffff', alpha: 0.72, width: 1 },
              pointOutline: '#020617',
            }
          }
          return {
            background: '#f8fbfd',
            globe: '#dce7f4',
            imageryAlpha: 0.52,
            imageryBrightness: 1,
            imageryContrast: 0.9,
            imagerySaturation: 0,
            boundary: { fill: '#111827', stroke: '#111827', alpha: 0.1, width: 3 },
            roads: { fill: '#020617', stroke: '#020617', alpha: 0.82, width: 2 },
            buildings: { fill: '#111827', stroke: '#020617', alpha: 0.46, width: 1 },
            greenBlue: { fill: '#1f2937', stroke: '#020617', alpha: 0.2, width: 2 },
            places: { fill: '#020617', stroke: '#ffffff', alpha: 0.9, width: 1 },
            civic: { fill: '#020617', stroke: '#ffffff', alpha: 0.9, width: 1 },
            mobility: { fill: '#020617', stroke: '#ffffff', alpha: 0.9, width: 1 },
            commerce: { fill: '#020617', stroke: '#ffffff', alpha: 0.9, width: 1 },
            wasteSeeds: { fill: '#020617', stroke: '#ffffff', alpha: 0.9, width: 1 },
            bimAssets: { fill: '#020617', stroke: '#111827', alpha: 0.82, width: 1 },
            fallback: { fill: '#334155', stroke: '#020617', alpha: 0.72, width: 1 },
            pointOutline: '#ffffff',
          }
        }

        ${renderCityCesiumSpatialRuntime()}
        function polygonHierarchy(rings = []) {
          const outer = rings?.[0] || []
          if (outer.length < 3) return null
          const holes = rings.slice(1)
            .filter((ring) => Array.isArray(ring) && ring.length >= 3)
            .map((ring) => new CesiumLib.PolygonHierarchy(CesiumLib.Cartesian3.fromDegreesArray(ring.flat())))
          return new CesiumLib.PolygonHierarchy(CesiumLib.Cartesian3.fromDegreesArray(outer.flat()), holes)
        }

        function ringAreaMeters(ring = []) {
          if (!Array.isArray(ring) || ring.length < 3) return 0
          const valid = ring
            .map((coord) => Array.isArray(coord) ? [Number(coord[0]), Number(coord[1])] : null)
            .filter((coord) => coord && Number.isFinite(coord[0]) && Number.isFinite(coord[1]))
          if (valid.length < 3) return 0
          const centerLat = valid.reduce((sum, coord) => sum + coord[1], 0) / valid.length
          const lonScale = Math.max(1, Math.cos(centerLat * Math.PI / 180) * 111320)
          const latScale = 111320
          let area = 0
          for (let index = 0; index < valid.length; index += 1) {
            const current = valid[index]
            const next = valid[(index + 1) % valid.length]
            const x1 = current[0] * lonScale
            const y1 = current[1] * latScale
            const x2 = next[0] * lonScale
            const y2 = next[1] * latScale
            area += x1 * y2 - x2 * y1
          }
          return Math.abs(area) / 2
        }

        function polygonAreaMeters(rings = []) {
          if (!Array.isArray(rings) || !rings.length) return 0
          const outer = ringAreaMeters(rings[0])
          const holes = rings.slice(1).reduce((sum, ring) => sum + ringAreaMeters(ring), 0)
          return Math.max(0, outer - holes)
        }

        function featureAreaMeters(feature = {}) {
          const geometry = feature.geometry || {}
          if (geometry.type === 'Polygon') return polygonAreaMeters(geometry.coordinates)
          if (geometry.type === 'MultiPolygon') {
            return geometry.coordinates.reduce((sum, polygon) => sum + polygonAreaMeters(polygon), 0)
          }
          return 0
        }

        function linePositions(coordinates = []) {
          if (!Array.isArray(coordinates) || coordinates.length < 2) return null
          return CesiumLib.Cartesian3.fromDegreesArray(coordinates.flat())
        }

        function buildingHeightModel(properties = {}) {
          const raw = properties.heightMeters ?? properties.height_meters ?? properties.height ?? properties.renderHeight
          const parsed = Number(String(raw ?? '').replace(/[^0-9.]+/g, ''))
          if (Number.isFinite(parsed) && parsed > 0) {
            return { height: Math.min(parsed, 120), source: 'observed-height' }
          }
          const levels = Number(properties.levels ?? properties['building:levels'])
          if (Number.isFinite(levels) && levels > 0) {
            return { height: Math.min(levels * 3.2, 120), source: 'observed-levels' }
          }
          return { height: 5.5, source: 'estimated-footprint-height' }
        }

        function layerKeyForFeature(feature) {
          const props = feature?.properties || {}
          const semanticClass = String(props.semanticClass || props.semantic_class || '').toLowerCase()
          return props.layerKey || props.layer_key || props.layer || (
            semanticClass.includes('building') ? 'buildings' :
            semanticClass.includes('road') ? 'roads' :
            semanticClass.includes('green') ? 'greenBlue' :
            semanticClass.includes('mobility') ? 'mobility' :
            semanticClass.includes('civic') ? 'civic' :
            semanticClass.includes('commerce') ? 'commerce' :
            semanticClass.includes('waste') ? 'wasteSeeds' :
            semanticClass.includes('place') ? 'places' :
            'features'
          )
        }

        function styleForLayer(layerKey) {
          const styles = scenePalette()
          return styles[layerKey] || styles.fallback
        }

        function color(css, alpha = 1) {
          return CesiumLib.Color.fromCssColorString(css).withAlpha(alpha)
        }

        function layerKeyFromEntity(entity) {
          return entity?.layerKey || entity?.properties?.layerKey?.getValue?.(CesiumLib.JulianDate.now()) || 'features'
        }

        function restyleEntity(entity) {
          const key = layerKeyFromEntity(entity)
          const style = styleForLayer(key)
          if (entity.polyline) {
            entity.polyline.material = color(style.stroke, style.alpha)
            entity.polyline.width = style.width
          }
          if (entity.polygon) {
            const heightSource = entity.properties?.heightSource?.getValue?.(CesiumLib.JulianDate.now())
            const estimated = key === 'buildings' && heightSource === 'estimated-footprint-height'
            entity.polygon.material = color(style.fill, estimated ? Math.min(style.alpha, 0.34) : style.alpha)
            entity.polygon.outlineColor = color(style.stroke, estimated ? 0.62 : 0.95)
          }
          if (entity.point) {
            entity.point.color = color(style.fill, style.alpha)
            entity.point.outlineColor = color(scenePalette().pointOutline, 0.88)
          }
          if (entity.cylinder) {
            entity.cylinder.material = color(style.fill, style.alpha)
            entity.cylinder.outlineColor = color(style.stroke, 0.9)
          }
        }

        function applySceneVisualTheme(nextTheme = detectVisualTheme()) {
          visualTheme = nextTheme === 'dark' ? 'dark' : 'light'
          document.documentElement.setAttribute('data-viewer-theme', visualTheme)
          document.body?.setAttribute('data-viewer-theme', visualTheme)
          if (!viewer) return
          const palette = scenePalette()
          viewer.scene.backgroundColor = CesiumLib.Color.fromCssColorString(palette.background)
          viewer.scene.globe.baseColor = CesiumLib.Color.fromCssColorString(palette.globe)
          if (baseImageryLayer) {
            baseImageryLayer.alpha = palette.imageryAlpha
            baseImageryLayer.brightness = palette.imageryBrightness
            baseImageryLayer.contrast = palette.imageryContrast
            baseImageryLayer.saturation = palette.imagerySaturation
          }
          ;[baseDataSource, queryDataSource].filter(Boolean).forEach((dataSource) => {
            dataSource.entities.values.forEach(restyleEntity)
          })
          if (phenomenaDataSource) renderPhenomenaLayer({ fit: false, preserveStatus: true })
          viewer.scene.requestRender()
        }

        function watchSceneVisualTheme() {
          applySceneVisualTheme()
          window.setInterval(() => {
            const nextTheme = detectVisualTheme()
            if (nextTheme !== visualTheme) applySceneVisualTheme(nextTheme)
          }, 600)
          window.addEventListener('storage', (event) => {
            if (event.key === 'theme') applySceneVisualTheme()
          })
          window.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', () => {
            applySceneVisualTheme()
          })
        }

        ${renderCityCesiumCameraRuntime()}
        function setStatus(text) {
          const node = document.getElementById('scene-status')
          if (node) node.textContent = text
        }

        function updateSelection(properties = {}, meta = {}) {
          const panel = document.getElementById('scene-selection')
          if (!panel) return
          const tags = Object.entries(properties)
            .filter(([key, value]) => value !== null && value !== undefined && value !== '' && key !== 'geometry')
            .slice(0, 12)
            .map(([key, value]) => '<span class="selection-tag">' + esc(key) + ': ' + esc(value) + '</span>')
            .join('')
          panel.innerHTML =
            '<div class="card">' +
              '<p class="selection-title">' + esc(properties.label || properties.name || meta.label || 'Selected city object') + '</p>' +
              '<p class="selection-meta">' + esc(meta.description || 'Object selected from the City 3D surface.') + '</p>' +
              '<div class="selection-tags">' +
                '<span class="selection-tag">semantic class: ' + esc(properties.semanticClass || properties.semantic_class || properties.layerKey || 'city object') + '</span>' +
                '<span class="selection-tag">source: ' + esc(properties.authorityStatus || properties.sourceCoverageStatus || properties.source || 'open-data') + '</span>' +
              '</div>' +
              '<div class="selection-tags">' + tags + '</div>' +
            '</div>'
        }

        function fillMetrics(metrics = []) {
          const node = document.getElementById('metric-grid')
          if (!node) return
          node.innerHTML = metrics
            .map((item) => '<div class="metric"><span>' + esc(item.label) + '</span><strong>' + esc(item.value) + '</strong><p>' + esc(item.note || '') + '</p></div>')
            .join('')
        }

        function fillInventory(inventory = { sections: [] }) {
          const node = document.getElementById('scene-inventory')
          if (!node) return
          node.innerHTML = (inventory.sections || []).map((section) => {
            const items = (section.items || [])
              .map((item) => '<li class="inventory-item"><span>' + esc(item.label) + '</span><strong>' + esc(item.count) + '</strong></li>')
              .join('')
            return '<section class="inventory-section"><h3>' + esc(section.title) + '</h3><p class="inventory-summary">' + esc(section.summary) + '</p><ul>' + items + '</ul></section>'
          }).join('')
        }

        function addGeometry(dataSource, feature, layerKey, options = {}) {
          const geometry = feature?.geometry
          if (!geometry) return 0
          const props = { ...(feature.properties || {}), layerKey }
          const style = styleForLayer(layerKey)
          const entityBase = {
            properties: props,
            layerKey,
            name: props.label || props.name || props.objectId || props.id || layerKey,
          }
          let added = 0

          if (geometry.type === 'LineString') {
            const positions = linePositions(geometry.coordinates)
            if (!positions) return 0
            dataSource.entities.add({
              ...entityBase,
              polyline: {
                positions,
                width: options.width || style.width,
                material: color(style.stroke, options.alpha ?? style.alpha),
                clampToGround: true,
              },
            })
            return 1
          }

          if (geometry.type === 'MultiLineString') {
            geometry.coordinates.forEach((line) => {
              added += addGeometry(dataSource, { ...feature, geometry: { type: 'LineString', coordinates: line } }, layerKey, options)
            })
            return added
          }

          if (geometry.type === 'Point') {
            const [lon, lat] = geometry.coordinates || []
            if (!Number.isFinite(Number(lon)) || !Number.isFinite(Number(lat))) return 0
            dataSource.entities.add({
              ...entityBase,
              position: CesiumLib.Cartesian3.fromDegrees(Number(lon), Number(lat), options.height || 24),
              point: {
                pixelSize: options.pixelSize || 7,
                heightReference: CesiumLib.HeightReference.RELATIVE_TO_GROUND,
                color: color(style.fill, options.alpha ?? style.alpha),
                outlineColor: CesiumLib.Color.WHITE.withAlpha(0.85),
                outlineWidth: 1,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
            })
            return 1
          }

          if (geometry.type === 'Polygon') {
            const hierarchy = polygonHierarchy(geometry.coordinates)
            if (!hierarchy) return 0
            const heightModel = layerKey === 'buildings' ? buildingHeightModel(props) : { height: 0, source: null }
            const isEstimatedBuilding = heightModel.source === 'estimated-footprint-height'
            const isBuilding = layerKey === 'buildings'
            const footprintAreaM2 = isBuilding ? featureAreaMeters(feature) : 0
            const forceFlatBuilding = isBuilding && (
              footprintAreaM2 > MAX_EXTRUDED_BUILDING_AREA_M2 ||
              (isEstimatedBuilding && footprintAreaM2 > LARGE_ESTIMATED_BUILDING_AREA_M2)
            )
            dataSource.entities.add({
              ...entityBase,
              properties: {
                ...entityBase.properties,
                heightSource: heightModel.source,
                footprintAreaM2,
                renderMode: forceFlatBuilding ? 'flat-large-footprint' : 'extruded-footprint',
              },
              polygon: {
                hierarchy,
                height: 0,
                heightReference: CesiumLib.HeightReference.CLAMP_TO_GROUND,
                extrudedHeight: isBuilding && !forceFlatBuilding ? heightModel.height : undefined,
                extrudedHeightReference: isBuilding && !forceFlatBuilding ? CesiumLib.HeightReference.RELATIVE_TO_GROUND : undefined,
                material: color(style.fill, options.alpha ?? (forceFlatBuilding ? 0.12 : isEstimatedBuilding ? 0.34 : style.alpha)),
                outline: true,
                outlineColor: color(style.stroke, forceFlatBuilding ? 0.86 : isEstimatedBuilding ? 0.62 : 0.95),
                closeTop: !forceFlatBuilding,
                closeBottom: !forceFlatBuilding,
              },
            })
            return 1
          }

          if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach((polygon) => {
              added += addGeometry(dataSource, { ...feature, geometry: { type: 'Polygon', coordinates: polygon } }, layerKey, options)
            })
            return added
          }

          return 0
        }

        function addLayer(dataSource, layerKey, collection, options = {}) {
          if (!layerState[layerKey]) return 0
          let count = 0
          getFeatures(collection).forEach((feature) => {
            count += addGeometry(dataSource, feature, layerKey, options)
          })
          return count
        }

        function addBoundary(dataSource) {
          const boundary = payload?.layers?.boundary || featureCollection([])
          let count = 0
          getFeatures(boundary).forEach((feature) => {
            count += addGeometry(dataSource, feature, 'boundary', { alpha: 0.14 })
            const geometry = feature?.geometry
            const polygons = geometry?.type === 'Polygon'
              ? [geometry.coordinates]
              : geometry?.type === 'MultiPolygon'
                ? geometry.coordinates
                : []
            polygons.forEach((polygon) => {
              const outer = polygon?.[0]
              const positions = linePositions(outer)
              if (positions) {
                dataSource.entities.add({
                  name: 'Municipal boundary',
                  properties: { layerKey: 'boundary', semanticClass: 'boundary' },
                  layerKey: 'boundary',
                  polyline: {
                    positions,
                    width: 4,
                    material: color('#c46b2d', 0.95),
                    clampToGround: true,
                  },
                })
              }
            })
          })
          return count
        }

        async function addBimLayers(dataSource) {
          if (!layerState.bimAssets) return 0
          const layers = await loadBimLayers(cityId).catch(() => ({ layers: [] }))
          let count = 0
          ;(layers.layers || []).forEach((layer) => {
            const anchor = layer.anchor || layer.metadata?.anchor
            const lon = Number(anchor?.lon ?? anchor?.longitude)
            const lat = Number(anchor?.lat ?? anchor?.latitude)
            if (!Number.isFinite(lon) || !Number.isFinite(lat)) return
            dataSource.entities.add({
              name: layer.name || layer.layerKey || 'BIM / 3D asset',
              properties: {
                layerKey: 'bimAssets',
                semanticClass: 'bimAssets',
                source: layer.providerKey || 'provider-layer',
                status: layer.status || 'registered',
              },
              layerKey: 'bimAssets',
              position: CesiumLib.Cartesian3.fromDegrees(lon, lat, 55),
              cylinder: {
                length: 44,
                topRadius: 10,
                bottomRadius: 18,
                material: color('#0f766e', 0.84),
                outline: true,
                outlineColor: color('#115e59', 0.9),
              },
            })
            count += 1
          })
          return count
        }

        function metricNumber(value, fallback = 0) {
          const numeric = Number(value)
          return Number.isFinite(numeric) ? numeric : fallback
        }

        function phenomenonValue(properties = {}, mode = phenomenaMode) {
          if (mode === 'terrainElevation') {
            const elevation = metricNumber(properties.value ?? properties.elevationM, Number.NaN)
            if (Number.isFinite(elevation)) return Math.max(0, Math.min(100, (elevation - 70) * 1.35))
          }
          if (mode === 'terrainSlope') {
            const slope = metricNumber(properties.value ?? properties.slopeDeg, Number.NaN)
            if (Number.isFinite(slope)) return Math.max(0, Math.min(100, slope * 8))
          }
          if (mode === 'airTemperature') {
            const temperature = metricNumber(
              properties.value ??
                properties.temperatureC ??
                properties.weatherAirTemperatureC ??
                properties.weather_air_temperature_c,
              Number.NaN,
            )
            if (Number.isFinite(temperature)) {
              return Math.max(0, Math.min(100, ((temperature + 15) / 55) * 100))
            }
          }
          if (Number.isFinite(metricNumber(properties.value, Number.NaN))) {
            return Math.max(0, Math.min(100, metricNumber(properties.value, 0)))
          }
          const direct = metricNumber(properties[mode], Number.NaN)
          if (Number.isFinite(direct)) return Math.max(0, Math.min(100, direct))
          if (mode === 'builtIntensity') return Math.max(0, Math.min(100, metricNumber(properties.builtIntensity, 0)))
          return Math.max(0, Math.min(100, metricNumber(properties.buildingDensityRank, 0) * 16 + metricNumber(properties.roadDensityRank, 0) * 5))
        }

        function phenomenonLabel(mode = phenomenaMode) {
          return phenomenaConfig(mode)?.label || {
            off: 'Base city model',
          }[mode] || 'Spatial phenomena'
        }

        function isTerrainSurfaceMode(mode = phenomenaMode) {
          return mode === 'terrainElevation' || mode === 'terrainSlope'
        }

        function isHydrologySurfaceMode(mode = phenomenaMode) {
          return mode === 'surfaceWater'
        }

        function isRunoffSurfaceMode(mode = phenomenaMode) {
          return mode === 'surfaceRunoff'
        }

        function setRunoffAnimationState(active) {
          if (!viewer?.scene) return
          runoffAnimationActive = Boolean(active)
          viewer.clock.shouldAnimate = runoffAnimationActive
          viewer.scene.requestRenderMode = !runoffAnimationActive
          viewer.scene.maximumRenderTimeChange = runoffAnimationActive ? 1 / 30 : Infinity
          if (!runoffAnimationActive) viewer.scene.requestRender()
        }

        function rawPhenomenonValue(properties = {}, mode = phenomenaMode) {
          const value = metricNumber(properties.value ?? properties.phenomenonValue, Number.NaN)
          if (Number.isFinite(value)) return value
          if (mode === 'terrainElevation') return metricNumber(properties.elevationM ?? properties.terrainElevationM, Number.NaN)
          if (mode === 'terrainSlope') return metricNumber(properties.slopeDeg ?? properties.terrainSlopeDeg, Number.NaN)
          if (mode === 'airTemperature') {
            return metricNumber(
              properties.temperatureC ??
                properties.weatherAirTemperatureC ??
                properties.weather_air_temperature_c,
              Number.NaN,
            )
          }
          if (mode === 'surfaceWater') {
            return metricNumber(
              properties.hydrologySurfaceWaterSignal ??
                properties.hydrology_surface_water_signal ??
                properties.value,
              Number.NaN,
            )
          }
          if (mode === 'surfaceRunoff') {
            return metricNumber(
              properties.surfaceRunoffScreening ??
                properties.surface_runoff_screening ??
                properties.value,
              Number.NaN,
            )
          }
          return Number.NaN
        }

        function terrainSamples(features = [], mode = phenomenaMode) {
          return features
            .map((feature) => {
              const props = feature.properties || {}
              const bounds = featureBounds(feature)
              const value = rawPhenomenonValue(props, mode)
              if (!bounds || !Number.isFinite(value)) return null
              const gridAddress = terrainGridAddress(props)
              return {
                lon: (bounds.minLon + bounds.maxLon) / 2,
                lat: (bounds.minLat + bounds.maxLat) / 2,
                value,
                key: terrainSampleKey((bounds.minLon + bounds.maxLon) / 2, (bounds.minLat + bounds.maxLat) / 2),
                gridCol: gridAddress?.col ?? null,
                gridRow: gridAddress?.row ?? null,
              }
            })
            .filter(Boolean)
            .sort((a, b) => a.lat === b.lat ? a.lon - b.lon : a.lat - b.lat)
        }

        function terrainGridAddress(properties = {}) {
          const rawKey = String(properties.cellId || properties.sourceCellId || '')
          const match = rawKey.match(/terrain-\\d+m-(-?\\d+)-(-?\\d+)/)
          if (!match) return null
          const col = Number(match[1])
          const row = Number(match[2])
          if (!Number.isFinite(col) || !Number.isFinite(row)) return null
          return { col, row }
        }

        function terrainSampleKey(lon, lat) {
          return String(Number(lon).toFixed(5)) + '|' + String(Number(lat).toFixed(5))
        }

        function terrainDistanceMeters(a, b) {
          const lat = ((Number(a.lat) + Number(b.lat)) / 2) * Math.PI / 180
          const dx = (Number(a.lon) - Number(b.lon)) * Math.cos(lat) * 111320
          const dy = (Number(a.lat) - Number(b.lat)) * 111320
          return Math.sqrt(dx * dx + dy * dy)
        }

        function terrainMeshBounds(samples = []) {
          const valid = samples.filter((sample) => Number.isFinite(sample.lon) && Number.isFinite(sample.lat))
          if (!valid.length) return null
          return valid.reduce((bounds, sample) => ({
            minLon: Math.min(bounds.minLon, sample.lon),
            minLat: Math.min(bounds.minLat, sample.lat),
            maxLon: Math.max(bounds.maxLon, sample.lon),
            maxLat: Math.max(bounds.maxLat, sample.lat),
          }), {
            minLon: valid[0].lon,
            minLat: valid[0].lat,
            maxLon: valid[0].lon,
            maxLat: valid[0].lat,
          })
        }

        function terrainInterpolatedValue(lon, lat, samples = []) {
          const point = { lon, lat }
          const nearest = samples
            .filter((sample) => Number.isFinite(sample.lon) && Number.isFinite(sample.lat) && Number.isFinite(sample.value))
            .map((sample) => ({
              sample,
              distance: Math.max(1, terrainDistanceMeters(point, sample)),
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 6)
          if (!nearest.length) return Number.NaN
          if (nearest[0].distance <= 12) return nearest[0].sample.value
          let weighted = 0
          let totalWeight = 0
          nearest.forEach(({ sample, distance }) => {
            const weight = 1 / Math.pow(distance, 1.8)
            weighted += sample.value * weight
            totalWeight += weight
          })
          return totalWeight > 0 ? weighted / totalWeight : nearest[0].sample.value
        }

        function terrainNearestSourceDistanceMeters(lon, lat, samples = []) {
          const point = { lon, lat }
          let nearest = Infinity
          samples.forEach((sample) => {
            if (!Number.isFinite(sample.lon) || !Number.isFinite(sample.lat)) return
            nearest = Math.min(nearest, terrainDistanceMeters(point, sample))
          })
          return nearest
        }

        function terrainStats(samples = []) {
          const values = samples.map((sample) => sample.value).filter(Number.isFinite)
          if (!values.length) return { min: 0, max: 0, avg: 0 }
          const min = Math.min(...values)
          const max = Math.max(...values)
          const avg = values.reduce((sum, value) => sum + value, 0) / values.length
          return { min, max, avg }
        }

        function environmentalMetric(properties = {}, key, fallback = Number.NaN) {
          const direct = metricNumber(properties[key], Number.NaN)
          if (Number.isFinite(direct)) return direct
          const metrics = properties.metrics || {}
          const nested = metricNumber(metrics[key], Number.NaN)
          return Number.isFinite(nested) ? nested : fallback
        }

        function runoffFlowSamples(features = []) {
          return features
            .map((feature) => {
              const center = featureCenter(feature)
              if (!center) return null
              const props = feature.properties || {}
              const value = rawPhenomenonValue(props, 'surfaceRunoff')
              if (!Number.isFinite(value)) return null
              return {
                lon: center.lon,
                lat: center.lat,
                value,
                elevation: environmentalMetric(props, 'elevationM'),
                slope: environmentalMetric(props, 'slopeDeg', 0),
                hydrology: environmentalMetric(props, 'hydrologySurfaceWaterSignal', 0),
              }
            })
            .filter(Boolean)
        }

        function deterministicPhase(sample, index) {
          const seed = Math.abs(Math.sin((sample.lon * 12031) + (sample.lat * 9217) + index * 13.37))
          return seed - Math.floor(seed)
        }

        function offsetRunoffPoint(sample, target, maxLengthMeters = 180) {
          const distance = Math.max(1, terrainDistanceMeters(sample, target))
          const ratio = Math.min(1, maxLengthMeters / distance)
          return {
            lon: sample.lon + (target.lon - sample.lon) * ratio,
            lat: sample.lat + (target.lat - sample.lat) * ratio,
          }
        }

        function runoffFlowSegments(features = [], maxSegments = 56) {
          const samples = runoffFlowSamples(features)
          if (!samples.length) return []
          const values = samples.map((sample) => sample.value).filter(Number.isFinite)
          const avg = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
          const threshold = Math.max(45, Math.min(78, avg))
          const candidates = samples
            .filter((sample) => sample.value >= threshold)
            .sort((a, b) => b.value - a.value)
          const selected = []
          candidates.forEach((sample) => {
            if (selected.length >= maxSegments) return
            const tooClose = selected.some((other) => terrainDistanceMeters(sample, other.startSample) < 130)
            if (!tooClose) selected.push({ startSample: sample })
          })
          return selected.map(({ startSample: sample }, index) => {
            const phase = deterministicPhase(sample, index)
            const downhill = samples
              .filter((target) => target !== sample)
              .map((target) => ({
                target,
                distance: terrainDistanceMeters(sample, target),
                drop: Number.isFinite(sample.elevation) && Number.isFinite(target.elevation)
                  ? sample.elevation - target.elevation
                  : Number.NaN,
              }))
              .filter((entry) => entry.distance >= 35 && entry.distance <= 420)
              .map((entry) => ({
                ...entry,
                localFlowSignal: (Number.isFinite(entry.drop) && entry.drop > 0.12) ||
                  (entry.target.hydrology || 0) > (sample.hydrology || 0) + 4 ||
                  (entry.target.value || 0) < sample.value - 6,
                score: (Number.isFinite(entry.drop) && entry.drop > 0 ? entry.drop * 120 : 0) +
                  Math.max(0, (entry.target.hydrology || 0) - (sample.hydrology || 0)) * 1.6 +
                  Math.max(0, sample.value - (entry.target.value || 0)) * 0.35 -
                  entry.distance * 0.05,
              }))
              .filter((entry) => entry.localFlowSignal)
              .sort((a, b) => b.score - a.score)[0]
            if (!downhill) return null
            const target = offsetRunoffPoint(sample, downhill.target, 170)
            return {
              start: { lon: sample.lon, lat: sample.lat },
              end: { lon: target.lon, lat: target.lat },
              value: sample.value,
              phase,
              speed: 0.42 + (sample.value / 100) * 0.9 + phase * 0.16,
            }
          }).filter(Boolean)
        }

        function phenomenonStats(features = [], mode = phenomenaMode) {
          const values = features
            .map((feature) => rawPhenomenonValue(feature.properties || {}, mode))
            .filter(Number.isFinite)
          if (!values.length) return null
          const min = Math.min(...values)
          const max = Math.max(...values)
          const avg = values.reduce((sum, value) => sum + value, 0) / values.length
          return { min, max, avg }
        }

        function terrainProviderHeight(value) {
          const stats = sourceTerrainStats || { min: 0, avg: 0 }
          if (!Number.isFinite(value)) return stats.avg || stats.min || 0
          return stats.min + (value - stats.min) * TERRAIN_PROVIDER_EXAGGERATION
        }

        function terrainFallbackHeight() {
          const stats = sourceTerrainStats || { min: 0, avg: 0 }
          return Number.isFinite(stats.min) ? stats.min : Number.isFinite(stats.avg) ? stats.avg : 0
        }

        function cameraMinimumHeight() {
          if (!sourceTerrainInstalled || !sourceTerrainStats) return CAMERA_MIN_HEIGHT_M
          const visualTerrainMax = terrainProviderHeight(sourceTerrainStats.max)
          return Math.max(CAMERA_MIN_HEIGHT_M, visualTerrainMax + CAMERA_MIN_ABOVE_TERRAIN_M)
        }

        function rectangleDegreesFromTile(tilingScheme, x, y, level) {
          const rectangle = tilingScheme.tileXYToRectangle(x, y, level)
          return {
            minLon: CesiumLib.Math.toDegrees(rectangle.west),
            minLat: CesiumLib.Math.toDegrees(rectangle.south),
            maxLon: CesiumLib.Math.toDegrees(rectangle.east),
            maxLat: CesiumLib.Math.toDegrees(rectangle.north),
          }
        }

        function boundsIntersects(left, right) {
          const a = normalizedBounds(left)
          const b = normalizedBounds(right)
          if (!a || !b) return false
          return a.minLon <= b.maxLon &&
            a.maxLon >= b.minLon &&
            a.minLat <= b.maxLat &&
            a.maxLat >= b.minLat
        }

        function featureCenter(feature) {
          const bounds = featureBounds(feature)
          if (!bounds) return null
          return {
            lon: (bounds.minLon + bounds.maxLon) / 2,
            lat: (bounds.minLat + bounds.maxLat) / 2,
          }
        }

        function queryScopes(query = {}) {
          const scopes = []
          if (query.scope?.key) scopes.push(query.scope)
          if (Array.isArray(query.clauses)) {
            query.clauses.forEach((clause) => {
              if (clause?.scope?.key) scopes.push(clause.scope)
            })
          }
          if (Array.isArray(query.scope?.clauses)) {
            query.scope.clauses.forEach((clause) => {
              if (clause?.scope?.key) scopes.push(clause.scope)
            })
          }
          return scopes
        }

        function selectionBounds(selection = null) {
          if (!selection) return null
          const query = selection.query || {}
          const queryBounds = boundsFromQueryScope(query)
          const renderedBounds = boundsFromPrimitives(selection.primitives) ||
            boundsFromGeojson(selection.geojson || featureCollection([]))
          const summaryBounds = normalizedBounds(selection.summary?.bounds)
          return hasCityScope(query)
            ? (queryBounds || summaryBounds || renderedBounds)
            : (summaryBounds || queryBounds || renderedBounds)
        }

        function environmentalCellScopeParams(query = {}, selection = null) {
          if (!query || hasCityScope(query)) return null
          const scopes = queryScopes(query).filter((scope) => scope?.key && scope.key !== 'city')
          const bounds = boundsFromQueryScope(query) || selectionBounds(selection)
          const params = {}
          if (bounds) {
            params.bbox = [
              bounds.minLon,
              bounds.minLat,
              bounds.maxLon,
              bounds.maxLat,
            ].map((value) => Number(value).toFixed(7)).join(',')
          }
          if (scopes.length === 1 && scopes[0].key === 'radius' && Array.isArray(scopes[0].center) && Number(scopes[0].radiusMeters) > 0) {
            params.center = [Number(scopes[0].center[0]), Number(scopes[0].center[1])]
              .map((value) => value.toFixed(7))
              .join(',')
            params.radiusMeters = String(Math.round(Number(scopes[0].radiusMeters)))
          }
          return Object.keys(params).length ? params : null
        }

        function phenomenaGridCacheKey(mode, query = {}, selection = null) {
          const params = environmentalCellScopeParams(query, selection)
          return mode + '|' + (params ? JSON.stringify(params) : 'city')
        }

        function featureIntersectsScope(feature, scope = {}) {
          if (!feature || !scope?.key) return false
          if (scope.key === 'radius' && Array.isArray(scope.center) && Number(scope.radiusMeters) > 0) {
            const center = featureCenter(feature)
            const bounds = featureBounds(feature)
            if (!center) return false
            const queryCenter = {
              lon: Number(scope.center[0]),
              lat: Number(scope.center[1]),
            }
            const radiusMeters = Number(scope.radiusMeters)
            if (![queryCenter.lon, queryCenter.lat, radiusMeters].every(Number.isFinite)) return false
            const centerInRadius = terrainDistanceMeters(center, queryCenter) <= radiusMeters
            const radiusBounds = boundsFromRadiusScope(scope)
            return centerInRadius || boundsIntersects(bounds, radiusBounds)
          }
          if (scope.key === 'city') return true
          const scopeBounds = boundsFromScope(scope)
          return boundsIntersects(featureBounds(feature), scopeBounds)
        }

        function activeQueryPhenomenaFeatures(features = []) {
          if (!activeQuerySelection) return []
          const scopes = queryScopes(activeQuerySelection.query || {})
          if (!scopes.length) {
            const bounds = boundsFromPrimitives(activeQuerySelection.primitives) ||
              boundsFromGeojson(activeQuerySelection.geojson || featureCollection([])) ||
              normalizedBounds(activeQuerySelection.summary?.bounds)
            return features.filter((feature) => boundsIntersects(featureBounds(feature), bounds))
          }
          return features.filter((feature) => scopes.some((scope) => featureIntersectsScope(feature, scope)))
        }

        function installSourceBackedTerrainProvider(samples = []) {
          if (!viewer || !CesiumLib.CustomHeightmapTerrainProvider) return false
          const validSamples = samples
            .filter((sample) => Number.isFinite(sample.lon) && Number.isFinite(sample.lat) && Number.isFinite(sample.value))
          if (validSamples.length < 4) return false
          sourceTerrainSamples = validSamples
          sourceTerrainStats = terrainStats(validSamples)
          sourceTerrainBounds = padBounds(terrainMeshBounds(validSamples), 0.18)
          sourceTerrainTileCache = new Map()
          const tilingScheme = new CesiumLib.GeographicTilingScheme()
          const width = TERRAIN_PROVIDER_HEIGHTMAP_SIZE
          const height = TERRAIN_PROVIDER_HEIGHTMAP_SIZE
          const provider = new CesiumLib.CustomHeightmapTerrainProvider({
            width,
            height,
            tilingScheme,
            credit: 'Mapzen Terrain Tiles via AWS Open Data, rendered as local source-backed heightmap',
            callback: (x, y, level) => {
              const key = String(level) + '/' + String(x) + '/' + String(y)
              if (sourceTerrainTileCache.has(key)) return sourceTerrainTileCache.get(key)
              const tileBounds = rectangleDegreesFromTile(tilingScheme, x, y, level)
              const values = new Float32Array(width * height)
              const fallbackHeight = terrainFallbackHeight()
              if (!boundsIntersects(tileBounds, sourceTerrainBounds)) {
                values.fill(fallbackHeight)
                return values
              }
              for (let row = 0; row < height; row += 1) {
                const latRatio = height <= 1 ? 0 : row / (height - 1)
                const lat = tileBounds.maxLat - (tileBounds.maxLat - tileBounds.minLat) * latRatio
                for (let col = 0; col < width; col += 1) {
                  const lonRatio = width <= 1 ? 0 : col / (width - 1)
                  const lon = tileBounds.minLon + (tileBounds.maxLon - tileBounds.minLon) * lonRatio
                  const nearestDistance = terrainNearestSourceDistanceMeters(lon, lat, sourceTerrainSamples)
                  const rawValue = nearestDistance <= TERRAIN_PROVIDER_MAX_SOURCE_DISTANCE_M
                    ? terrainInterpolatedValue(lon, lat, sourceTerrainSamples)
                    : fallbackHeight
                  values[row * width + col] = nearestDistance <= TERRAIN_PROVIDER_MAX_SOURCE_DISTANCE_M
                    ? terrainProviderHeight(rawValue)
                    : fallbackHeight
                }
              }
              if (sourceTerrainTileCache.size > 2500) sourceTerrainTileCache.clear()
              sourceTerrainTileCache.set(key, values)
              return values
            },
          })
          viewer.terrainProvider = provider
          viewer.scene.globe.depthTestAgainstTerrain = false
          sourceTerrainInstalled = true
          configureUrbanCameraControls()
          const sceneNode = document.getElementById('scene3d')
          if (sceneNode) {
            sceneNode.dataset.terrainProvider = 'source-backed-heightmap'
            sceneNode.dataset.terrainSamples = String(validSamples.length)
            sceneNode.dataset.terrainMin = String(sourceTerrainStats.min)
            sceneNode.dataset.terrainMax = String(sourceTerrainStats.max)
            sceneNode.dataset.terrainExaggeration = String(TERRAIN_PROVIDER_EXAGGERATION)
          }
          viewer.scene.requestRender()
          return true
        }

        function resetTerrainProvider() {
          if (!viewer || !sourceTerrainInstalled) return
          viewer.terrainProvider = new CesiumLib.EllipsoidTerrainProvider()
          sourceTerrainInstalled = false
          sourceTerrainSamples = []
          sourceTerrainStats = null
          sourceTerrainBounds = null
          sourceTerrainTileCache = new Map()
          configureUrbanCameraControls()
          const sceneNode = document.getElementById('scene3d')
          if (sceneNode) {
            sceneNode.dataset.terrainProvider = 'ellipsoid'
            sceneNode.dataset.terrainSamples = '0'
            delete sceneNode.dataset.terrainMin
            delete sceneNode.dataset.terrainMax
            delete sceneNode.dataset.terrainExaggeration
          }
          viewer.scene.requestRender()
        }

        function terrainLegendHtml(mode, stats, rendered, meshTriangles = 0) {
          const unit = mode === 'terrainSlope' ? '°' : 'm'
          const title = mode === 'terrainSlope' ? 'DEM slope in query' : 'DEM relief in query'
          const note = mode === 'terrainSlope'
            ? 'Source-backed slope samples inside the active TwinQL scope'
            : 'Source-backed terrain samples inside the active TwinQL scope; relief is visually exaggerated ' + TERRAIN_PROVIDER_EXAGGERATION + 'x'
          const min = Number(stats.min).toFixed(mode === 'terrainSlope' ? 1 : 0)
          const max = Number(stats.max).toFixed(mode === 'terrainSlope' ? 1 : 0)
          return (
            '<div class="phenomena-legend__title"><span>' + esc(title) + '</span><span>' + esc(String(rendered)) + ' samples</span></div>' +
            '<div class="phenomena-legend__ramp"></div>' +
            '<div class="phenomena-legend__range"><span>' + esc(min + unit) + '</span><span>' + esc(max + unit) + '</span></div>' +
            '<div class="phenomena-legend__note"><span>' + esc(note) + '</span></div>'
          )
        }

        function weatherLegendHtml(mode, stats, rendered) {
          const title = mode === 'airTemperature' ? 'Air temperature in query' : phenomenonLabel(mode)
          const unit = phenomenaConfig(mode)?.valueUnit || ''
          const min = Number(stats.min).toFixed(1)
          const max = Number(stats.max).toFixed(1)
          const avg = Number(stats.avg).toFixed(1)
          return (
            '<div class="phenomena-legend__title"><span>' + esc(title) + '</span><span>' + esc(String(rendered)) + ' cells</span></div>' +
            '<div class="phenomena-legend__ramp phenomena-legend__ramp--temperature"></div>' +
            '<div class="phenomena-legend__range"><span>' + esc(min + unit) + '</span><span>' + esc('avg ' + avg + unit) + '</span><span>' + esc(max + unit) + '</span></div>' +
            '<div class="phenomena-legend__note"><span>Open-Meteo current 2m air temperature, sampled to the active TwinQL scope.</span></div>'
          )
        }

        function hydrologyLegendHtml(stats, rendered) {
          const min = Number(stats.min).toFixed(1)
          const max = Number(stats.max).toFixed(1)
          const avg = Number(stats.avg).toFixed(1)
          return (
            '<div class="phenomena-legend__title"><span>Surface water signal</span><span>' + esc(String(rendered)) + ' cells</span></div>' +
            '<div class="phenomena-legend__ramp phenomena-legend__ramp--water"></div>' +
            '<div class="phenomena-legend__range"><span>' + esc(min) + '</span><span>' + esc('avg ' + avg) + '</span><span>' + esc(max) + '</span></div>' +
            '<div class="phenomena-legend__note"><span>DEM slope, low-point, and mapped water evidence inside the active TwinQL scope. Not a flood-depth simulation.</span></div>'
          )
        }

        function runoffLegendHtml(stats, rendered) {
          const min = Number(stats.min).toFixed(1)
          const max = Number(stats.max).toFixed(1)
          const avg = Number(stats.avg).toFixed(1)
          return (
            '<div class="phenomena-legend__title"><span>Surface runoff screening</span><span>' + esc(String(rendered)) + ' cells</span></div>' +
            '<div class="phenomena-legend__ramp phenomena-legend__ramp--runoff"></div>' +
            '<div class="phenomena-legend__range"><span>' + esc(min) + '</span><span>' + esc('avg ' + avg) + '</span><span>' + esc(max) + '</span></div>' +
            '<div class="phenomena-legend__note"><span>Scenario-derived runoff stress from DEM, mapped water evidence, and rainfall assumptions. Not certified flood depth.</span></div>'
          )
        }

        function updatePhenomenaLegend(mode, stats = null, rendered = 0, meshTriangles = 0) {
          const node = document.getElementById('phenomena-legend')
          if (!node) return
          if (!stats || rendered <= 0) {
            node.hidden = true
            node.innerHTML = ''
            return
          }
          if (mode === 'airTemperature') {
            node.hidden = false
            node.innerHTML = weatherLegendHtml(mode, stats, rendered)
            return
          }
          if (isHydrologySurfaceMode(mode)) {
            node.hidden = false
            node.innerHTML = hydrologyLegendHtml(stats, rendered)
            return
          }
          if (isRunoffSurfaceMode(mode)) {
            node.hidden = false
            node.innerHTML = runoffLegendHtml(stats, rendered)
            return
          }
          if (!isTerrainSurfaceMode(mode)) {
            node.hidden = true
            node.innerHTML = ''
            return
          }
          node.hidden = false
          node.innerHTML = terrainLegendHtml(mode, stats, rendered, meshTriangles)
        }

        function phenomenonCssColor(mode, value) {
          if (mode === 'airTemperature') {
            if (value >= 35) return '#7f1d1d'
            if (value >= 30) return '#dc2626'
            if (value >= 24) return '#f97316'
            if (value >= 18) return '#facc15'
            if (value >= 10) return '#22c55e'
            if (value >= 0) return '#38bdf8'
            return '#2563eb'
          }
          if (mode === 'builtIntensity') {
            if (value >= 80) return '#334155'
            if (value >= 60) return '#475569'
            if (value >= 40) return '#64748b'
            if (value >= 20) return '#94a3b8'
            return '#cbd5e1'
          }
          if (mode === 'terrainElevation') {
            if (value >= 80) return '#78350f'
            if (value >= 60) return '#a16207'
            if (value >= 40) return '#ca8a04'
            if (value >= 20) return '#84cc16'
            return '#06b6d4'
          }
          if (mode === 'terrainSlope') {
            if (value >= 80) return '#7f1d1d'
            if (value >= 60) return '#b91c1c'
            if (value >= 40) return '#f97316'
            if (value >= 20) return '#facc15'
            return '#22c55e'
          }
          if (mode === 'surfaceWater') {
            if (value >= 80) return '#075985'
            if (value >= 60) return '#0284c7'
            if (value >= 40) return '#06b6d4'
            if (value >= 20) return '#67e8f9'
            return '#cffafe'
          }
          if (mode === 'surfaceRunoff') {
            if (value >= 80) return '#4c0519'
            if (value >= 60) return '#be123c'
            if (value >= 40) return '#f97316'
            if (value >= 20) return '#facc15'
            return '#a7f3d0'
          }
          if (value >= 80) return '#dc2626'
          if (value >= 60) return '#ea580c'
          if (value >= 40) return '#f59e0b'
          if (value >= 20) return '#a3e635'
          return '#38bdf8'
        }

        function featureBounds(feature) {
          return boundsFromGeojson(featureCollection([feature]))
        }

        function addPhenomenaPolygon(dataSource, feature, mode) {
          const geometry = feature?.geometry
          if (!geometry) return 0
          if (geometry.type === 'MultiPolygon') {
            return geometry.coordinates.reduce((count, polygon) => (
              count + addPhenomenaPolygon(dataSource, { ...feature, geometry: { type: 'Polygon', coordinates: polygon } }, mode)
            ), 0)
          }
          if (geometry.type !== 'Polygon') return 0
          const hierarchy = polygonHierarchy(geometry.coordinates)
          if (!hierarchy) return 0
          const props = feature.properties || {}
          const value = phenomenonValue(props, mode)
          const rawValue = rawPhenomenonValue(props, mode)
          const colorValue = mode === 'airTemperature' && Number.isFinite(rawValue) ? rawValue : value
          const fillColor = phenomenonCssColor(mode, colorValue)
          const alpha = mode === 'surfaceRunoff'
            ? (visualTheme === 'dark' ? 0.08 : 0.055)
            : (visualTheme === 'dark' ? 0.18 : 0.14)
          const extrusion = mode === 'terrainElevation'
            ? 4 + value * 1.35
            : mode === 'terrainSlope'
              ? 4 + value * 0.65
              : mode === 'surfaceRunoff'
                ? 0.25 + value * 0.012
                : 3 + value * 0.45
          dataSource.entities.add({
            name: phenomenonLabel(mode) + ' cell',
            layerKey: 'spatialPhenomena',
            properties: {
              ...props,
              layerKey: 'spatialPhenomena',
              semanticClass: 'spatialPhenomena',
              label: phenomenonLabel(mode),
              value,
              rawValue: Number.isFinite(rawValue) ? rawValue : value,
              valueUnit: phenomenaConfig(mode)?.valueUnit || null,
              method: props.phenomena?.method || 'Derived from the open-data city inventory grid.',
              authorityStatus: props.phenomena?.authorityStatus || 'derived-open-data-proxy',
            },
            polygon: {
              hierarchy,
              height: 0,
              extrudedHeight: extrusion,
              material: color(fillColor, alpha),
              outline: mode !== 'surfaceRunoff',
              outlineColor: color(fillColor, visualTheme === 'dark' ? 0.26 : 0.2),
              closeTop: true,
              closeBottom: true,
            },
          })
          return 1
        }

        function addRunoffFlowAnimation(dataSource, features = []) {
          if (!dataSource || !viewer) return 0
          const segments = runoffFlowSegments(features)
          if (!segments.length) return 0
          runoffAnimationStartTime = CesiumLib.JulianDate.now()
          segments.forEach((segment, index) => {
            const width = 1.7 + Math.min(2.2, segment.value / 44)
            const trailAlpha = visualTheme === 'dark' ? 0.78 : 0.62
            const trailColor = segment.value >= 70 ? '#0ea5e9' : '#38bdf8'
            const positions = CesiumLib.Cartesian3.fromDegreesArrayHeights([
              segment.start.lon,
              segment.start.lat,
              1.4,
              segment.end.lon,
              segment.end.lat,
              1.4,
            ])
            dataSource.entities.add({
              name: 'Local runoff direction',
              layerKey: 'spatialPhenomena',
              polyline: {
                positions,
                width,
                material: CesiumLib.PolylineArrowMaterialProperty
                  ? new CesiumLib.PolylineArrowMaterialProperty(color(trailColor, trailAlpha))
                  : new CesiumLib.PolylineGlowMaterialProperty({
                    glowPower: 0.1,
                    taperPower: 0.55,
                    color: color(trailColor, trailAlpha),
                  }),
              },
            })
            dataSource.entities.add({
              name: 'Runoff particle',
              layerKey: 'spatialPhenomena',
              position: new CesiumLib.CallbackProperty((time) => {
                const elapsed = Math.max(0, CesiumLib.JulianDate.secondsDifference(time, runoffAnimationStartTime))
                const t = (segment.phase + elapsed * segment.speed) % 1
                const pulse = Math.sin(t * Math.PI)
                const lon = segment.start.lon + (segment.end.lon - segment.start.lon) * t
                const lat = segment.start.lat + (segment.end.lat - segment.start.lat) * t
                const height = 2.4 + pulse * 3.5 + Math.min(7, segment.value * 0.04)
                return CesiumLib.Cartesian3.fromDegrees(lon, lat, height)
              }, false),
              point: {
                pixelSize: 3.5 + Math.min(4.5, segment.value / 30),
                color: color('#7dd3fc', visualTheme === 'dark' ? 0.95 : 0.82),
                outlineColor: color('#0f172a', visualTheme === 'dark' ? 0.5 : 0.28),
                outlineWidth: 1,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              properties: {
                layerKey: 'spatialPhenomena',
                semanticClass: 'surfaceRunoffFlow',
                label: 'Animated runoff flow',
                value: segment.value,
                animationIndex: index,
              },
            })
          })
          setRunoffAnimationState(true)
          return segments.length
        }

        function updatePhenomenaButtons() {
          document.querySelectorAll('[data-phenomena-mode]').forEach((button) => {
            const active = button.getAttribute('data-phenomena-mode') === phenomenaMode
            button.setAttribute('aria-pressed', active ? 'true' : 'false')
          })
        }

        function renderPhenomenaLayer(options = {}) {
          if (!viewer?.dataSources) return 0
          setRunoffAnimationState(false)
          if (phenomenaDataSource) {
            viewer.dataSources.remove(phenomenaDataSource, true)
            phenomenaDataSource = null
          }
          updatePhenomenaButtons()
          if (phenomenaMode === 'off' || !layerState.spatialPhenomena) {
            resetTerrainProvider()
            if (!options.preserveStatus) setStatus('Spatial phenomena hidden')
            const sceneNode = document.getElementById('scene3d')
            if (sceneNode) {
              sceneNode.dataset.phenomenaMode = 'off'
              sceneNode.dataset.phenomenaScope = 'none'
              sceneNode.dataset.phenomenaSamples = '0'
              sceneNode.dataset.phenomenaMeshTriangles = '0'
              sceneNode.dataset.runoffFlowParticles = '0'
              sceneNode.dataset.runoffAnimation = 'inactive'
            }
            viewer.scene.requestRender()
            return 0
          }
          if (!activeQuerySelection) {
            resetTerrainProvider()
            if (!options.preserveStatus) setStatus(phenomenonLabel(phenomenaMode) + ' waits for a query scope')
            updatePhenomenaLegend(phenomenaMode)
            const sceneNode = document.getElementById('scene3d')
            if (sceneNode) {
              sceneNode.dataset.phenomenaMode = phenomenaMode
              sceneNode.dataset.phenomenaScope = 'none'
              sceneNode.dataset.phenomenaSamples = '0'
              sceneNode.dataset.phenomenaMeshTriangles = '0'
              sceneNode.dataset.runoffFlowParticles = '0'
              sceneNode.dataset.runoffAnimation = 'inactive'
            }
            viewer.scene.requestRender()
            return 0
          }
          const grid = phenomenaGrids[phenomenaMode] || featureCollection([])
          const features = activeQueryPhenomenaFeatures(getFeatures(grid))
          if (!features.length) {
            if (isTerrainSurfaceMode(phenomenaMode)) resetTerrainProvider()
            if (!options.preserveStatus) setStatus(phenomenonLabel(phenomenaMode) + ' has no cells inside the query scope')
            updatePhenomenaLegend(phenomenaMode)
            const sceneNode = document.getElementById('scene3d')
            if (sceneNode) {
              sceneNode.dataset.runoffFlowParticles = '0'
              sceneNode.dataset.runoffAnimation = 'inactive'
            }
            return 0
          }
          phenomenaDataSource = new CesiumLib.CustomDataSource('spatial-phenomena')
          viewer.dataSources.add(phenomenaDataSource)
          let rendered = 0
          if (isTerrainSurfaceMode(phenomenaMode)) {
            const samples = terrainSamples(features, phenomenaMode)
            const stats = terrainStats(samples)
            rendered = samples.length
            if (!installSourceBackedTerrainProvider(samples)) resetTerrainProvider()
            updatePhenomenaLegend(phenomenaMode, stats, rendered, 0)
            phenomenaDataSource.meshEdges = 0
            phenomenaDataSource.meshTriangles = 0
            phenomenaDataSource.meshNodes = 0
          } else {
            resetTerrainProvider()
            const stats = phenomenonStats(features, phenomenaMode)
            updatePhenomenaLegend(phenomenaMode, stats, features.length, 0)
            features.forEach((feature) => {
              rendered += addPhenomenaPolygon(phenomenaDataSource, feature, phenomenaMode)
            })
          }
          const runoffFlowParticles = isRunoffSurfaceMode(phenomenaMode)
            ? addRunoffFlowAnimation(phenomenaDataSource, features)
            : 0
          if (!options.preserveStatus) setStatus(phenomenonLabel(phenomenaMode) + ' surface')
          const renderingMode = isTerrainSurfaceMode(phenomenaMode)
            ? 'terrain-provider-query-scope'
            : isRunoffSurfaceMode(phenomenaMode)
              ? 'query-scope-local-runoff'
              : 'query-scope-cell-overlay'
          broadcast('twin:state', {
            layers: layerState,
            phenomena: {
              mode: phenomenaMode,
              gridCells: rendered,
              layerKey: grid?.layerKey || phenomenaConfig(phenomenaMode)?.layerKey || 'unknown',
              scenarioKey: grid?.scenarioKey || 'baseline',
              rendering: renderingMode,
              meshEdges: phenomenaDataSource?.meshEdges || 0,
              meshTriangles: phenomenaDataSource?.meshTriangles || 0,
              meshNodes: phenomenaDataSource?.meshNodes || 0,
              runoffFlowParticles,
              scope: 'active-query',
            },
          })
          const sceneNode = document.getElementById('scene3d')
          if (sceneNode) {
            sceneNode.dataset.phenomenaMode = phenomenaMode
            sceneNode.dataset.phenomenaSamples = String(rendered)
            sceneNode.dataset.phenomenaRendering = renderingMode
            sceneNode.dataset.phenomenaScope = 'active-query'
            sceneNode.dataset.phenomenaMeshTriangles = String(phenomenaDataSource?.meshTriangles || 0)
            sceneNode.dataset.phenomenaMeshEdges = String(phenomenaDataSource?.meshEdges || 0)
            sceneNode.dataset.phenomenaMeshNodes = String(phenomenaDataSource?.meshNodes || 0)
            sceneNode.dataset.runoffFlowParticles = String(runoffFlowParticles)
            sceneNode.dataset.runoffAnimation = runoffFlowParticles > 0 ? 'active' : 'inactive'
          }
          viewer.scene.requestRender()
          window.requestAnimationFrame(() => viewer.scene.requestRender())
          window.setTimeout(() => viewer.scene.requestRender(), 120)
          return rendered
        }

        async function setPhenomenaMode(mode) {
          phenomenaMode = (mode && (mode === 'off' || PHENOMENA_MODES[mode])) ? mode : 'off'
          updatePhenomenaButtons()
          if (phenomenaMode === 'off') {
            renderPhenomenaLayer({ fit: false })
            return
          }
          if (!activeQuerySelection) {
            renderPhenomenaLayer({ fit: false })
            return
          }
          const scopedCacheKey = phenomenaGridCacheKey(phenomenaMode, activeQuerySelection.query || {}, activeQuerySelection)
          if (!phenomenaGrids[phenomenaMode] || phenomenaGridKeys[phenomenaMode] !== scopedCacheKey) {
            setStatus('Loading ' + phenomenonLabel(phenomenaMode))
            try {
              phenomenaGrids[phenomenaMode] = await loadPhenomenaGrid(cityId, phenomenaMode, {
                query: activeQuerySelection.query || {},
                selection: activeQuerySelection,
              })
              phenomenaGridKeys[phenomenaMode] = scopedCacheKey
            } catch {
              phenomenaGrids[phenomenaMode] = featureCollection([])
              phenomenaGridKeys[phenomenaMode] = scopedCacheKey
            }
          }
          renderPhenomenaLayer({ fit: false })
          if (isTerrainSurfaceMode(phenomenaMode) && activeQuerySelection) {
            fitQuerySelection(activeQuerySelection, activeQuerySelection.geojson || featureCollection([]))
          }
        }

        function queuePhenomenaMode(mode) {
          setPhenomenaMode(mode).catch(() => {
            phenomenaGrids[mode] = featureCollection([])
            renderPhenomenaLayer({ fit: false })
          })
        }

        function bindPhenomenaControls() {
          document.querySelectorAll('[data-phenomena-mode]').forEach((button) => {
            button.addEventListener('click', () => {
              queuePhenomenaMode(button.getAttribute('data-phenomena-mode'))
            })
          })
          updatePhenomenaButtons()
        }

        async function renderBaseContext(options = {}) {
          if (baseDataSource) {
            viewer.dataSources.remove(baseDataSource, true)
          }
          baseDataSource = new CesiumLib.CustomDataSource('base-context')
          viewer.dataSources.add(baseDataSource)
          addBoundary(baseDataSource)
          await addBimLayers(baseDataSource)
          applySceneVisualTheme()
          if (options.fit !== false) {
            fitToPayload(payload, { animate: false, startup: true })
          }
        }

        ${renderCityCesiumQuerySelectionRuntime()}
        function city3dImageryTemplate() {
          return window.TWIN_CITY3D_IMAGERY_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        }

        function installBaseImagery() {
          if (baseImageryInstalled) return
          const template = city3dImageryTemplate()
          if (!template || !CesiumLib.UrlTemplateImageryProvider) return
          const provider = new CesiumLib.UrlTemplateImageryProvider({
            url: template,
            credit: '© OpenStreetMap contributors',
            maximumLevel: 19,
            tilingScheme: new CesiumLib.WebMercatorTilingScheme(),
          })
          baseImageryLayer = viewer.imageryLayers.addImageryProvider(provider)
          baseImageryInstalled = true
          applySceneVisualTheme()
          const attribution = document.getElementById('scene-attribution')
          if (attribution) attribution.textContent = '© OpenStreetMap contributors | CesiumJS'
        }

        function initializeViewer() {
          viewer = new CesiumLib.Viewer('scene3d', {
            animation: false,
            baseLayer: false,
            baseLayerPicker: false,
            fullscreenButton: false,
            geocoder: false,
            homeButton: false,
            infoBox: false,
            navigationHelpButton: false,
            sceneModePicker: false,
            selectionIndicator: false,
            timeline: false,
            terrainProvider: new CesiumLib.EllipsoidTerrainProvider(),
            requestRenderMode: true,
            maximumRenderTimeChange: Infinity,
          })
          viewer.scene.globe.enableLighting = false
          viewer.scene.globe.depthTestAgainstTerrain = false
          viewer.scene.fog.enabled = false
          viewer.scene.skyAtmosphere.show = false
          viewer.scene.sun.show = false
          viewer.scene.moon.show = false
          if (viewer.scene.skyBox) viewer.scene.skyBox.show = false
          viewer.cesiumWidget.creditContainer.style.display = 'none'
          installBaseImagery()
          watchSceneVisualTheme()
          configureUrbanCameraControls()
          installStableCameraInteractions()
          bindCameraStabilizer()

          const clickHandler = new CesiumLib.ScreenSpaceEventHandler(viewer.scene.canvas)
          clickHandler.setInputAction((movement) => {
            const picked = viewer.scene.pick(movement.position)
            if (!picked?.id) return
            const entity = picked.id
            const properties = entity.properties?.getValue(CesiumLib.JulianDate.now()) || {}
            updateSelection(properties, { label: entity.name })
            broadcast('twin:selection', {
              feature: {
                id: properties.objectId || properties.id || entity.id,
                properties,
              },
            })
          }, CesiumLib.ScreenSpaceEventType.LEFT_CLICK)
        }

        window.addEventListener('message', (event) => {
          const message = event.data || {}
          if (message.source !== 'twin-dashboard' || message.viewer !== viewerId) return
          if (message.type === 'twin:set-visible-layers') {
            Object.assign(layerState, message.layers || {})
            const shouldRefreshBimContext = Boolean(message.layers && Object.prototype.hasOwnProperty.call(message.layers, 'bimAssets'))
            if (baseDataSource) {
              baseDataSource.entities.values.forEach((entity) => {
                const key = entity.layerKey || entity.properties?.layerKey?.getValue?.(CesiumLib.JulianDate.now())
                if (key && Object.prototype.hasOwnProperty.call(layerState, key)) {
                  entity.show = Boolean(layerState[key])
                }
              })
            }
            if (queryDataSource) {
              queryDataSource.entities.values.forEach((entity) => {
                const key = entity.layerKey || entity.properties?.layerKey?.getValue?.(CesiumLib.JulianDate.now())
                if (key && Object.prototype.hasOwnProperty.call(layerState, key)) {
                  entity.show = Boolean(layerState[key])
                }
              })
            }
            if (Object.prototype.hasOwnProperty.call(message.layers || {}, 'spatialPhenomena')) {
              renderPhenomenaLayer({ fit: false })
            }
            broadcast('twin:state', { layers: layerState })
            if (shouldRefreshBimContext) {
              renderBaseContext({ fit: false }).catch(() => viewer?.scene?.requestRender())
            } else {
              viewer?.scene?.requestRender()
            }
          }
          if (message.type === 'twin:set-semantic-query') {
            applyQuerySelection(message)
          }
          if (message.type === 'twin:clear-semantic-query') {
            clearQuerySelection()
          }
          if (message.type === 'twin:set-phenomena-mode') {
            queuePhenomenaMode(message.mode || message.value)
          }
          if (message.type === 'twin:command') {
            const command = typeof message.command === 'string'
              ? message.command
              : (message.command?.id || message.command?.value || '')
            const commandMode = PHENOMENA_COMMANDS[command]
            if (commandMode) queuePhenomenaMode(commandMode)
            if (['home', 'city-view', 'municipal-view', 'district-focus', 'full-scope', 'fit-scope', 'scope', 'planning', 'district'].includes(command)) {
              if (activeQuerySelection) fitQuerySelection(activeQuerySelection, activeQuerySelection.geojson || featureCollection([]))
              else fitToPayload(payload, { animate: true })
            }
            if (['oblique', 'top-view'].includes(command)) {
              const bounds = boundsFromPrimitives(activeQuerySelection?.primitives) ||
                boundsFromGeojson(activeQuerySelection?.geojson || payload?.layers?.boundary)
              if (bounds) {
                moveCameraToBounds(bounds, {
                  headingDegrees: 36,
                  pitchDegrees: -42,
                  rangeMultiplier: 0.72,
                  minRange: 1600,
                })
              }
            }
          }
        })

        async function boot() {
          if (!CesiumLib) throw new Error('CESIUM_RUNTIME_UNAVAILABLE')
          initializeViewer()
          payload = await loadPayload()
          fillMetrics(payload.metrics || [])
          fillInventory(payload.inventory || { sections: [] })
          fitToPayload(payload, { animate: false, startup: true })
          await renderBaseContext({ fit: false })
          bindPhenomenaControls()
          await setPhenomenaMode(phenomenaMode)
          readyBroadcasted = true
          setStatus('Ready for query')
          broadcast('twin:ready', { layers: layerState, runtime: 'cesium' })
          broadcast('twin:state', { layers: layerState, runtime: 'cesium' })
          await applyInitialSharedQuery()
        }

        boot().catch((error) => {
          const message = String(error?.message || 'CESIUM_3D_LOAD_FAILED')
          setStatus(message)
          broadcast('twin:error', { error: message })
          if (!readyBroadcasted) {
            document.getElementById('scene3d').innerHTML =
              '<div class="canvas-overlay"><strong>Could not load 3D city data</strong><p>' + esc(message) + '</p></div>'
          }
        })
      </script>
  `
}
