import { renderMapLibreGeometryRuntime } from './mapLibre/mapLibreGeometryRuntime.mjs'
import { renderMapLibreLayerModelRuntime } from './mapLibre/mapLibreLayerModelRuntime.mjs'
import { renderMapLibreSelectionRuntime } from './mapLibre/mapLibreSelectionRuntime.mjs'
import { renderMapLibreSourceRuntime } from './mapLibre/mapLibreSourceRuntime.mjs'
import { renderMapLibreControlRuntime } from './mapLibre/mapLibreControlRuntime.mjs'
import { renderViewerShareManifestRuntime } from './viewerShareManifestRuntime.mjs'

export function renderMapLibreRuntime({ cityId, baseEndpoint, cityName, surfaceManifest = {}, baseMapCatalog = null }) {
  return `
      <script src="/vendor/maplibre-gl/maplibre-gl.js"></script>
      <script>
        function esc(value) {
          return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;')
        }

        const viewerId = 'map'
        const cityId = ${JSON.stringify(cityId)}
        const baseEndpoint = ${JSON.stringify(baseEndpoint)}
        const cityName = ${JSON.stringify(cityName)}
        const surfaceManifest = ${JSON.stringify(surfaceManifest)}
        const baseMapCatalog = ${JSON.stringify(baseMapCatalog)}
        const viewportSourceId = 'twin-viewport-features'
        const semanticQuerySourceId = 'twin-semantic-query'
        const baseMapSourceId = 'base-map-raster'
        const baseMapLayerId = 'base-map-layer'
        const baseMapStorageKey = 'twin:base-map'
        const sourceLayerName = 'features'
        const featureLayerIds = [
          'twin-green-fill',
          'twin-green-line',
          'twin-buildings-fill',
          'twin-buildings-line',
          'twin-roads',
          'twin-places',
          'twin-facilities',
        ]
        const semanticQueryLayerIds = [
          'twin-query-fill',
          'twin-query-line',
          'twin-query-points',
        ]
        const fragmentWorkspaceSourceId = 'twin-fragment-workspace'
        const fragmentWorkspaceLayerIds = [
          'twin-fragment-fill',
          'twin-fragment-line',
          'twin-fragment-points',
        ]
        const fixedLayerIds = [
          'boundary-fill',
          'boundary-line',
          'unclassified-fill',
          'unclassified-line',
          'coverage-radius-fill',
          'coverage-radius-line',
        ]
        const facilityKeys = new Set(['civic', 'mobility', 'commerce', 'wasteSeeds', 'facilities'])
        const layerState = {}
        const layerControlState = {}
        const scaleState = {
          coveragePercent: 100,
          featureLimit: 0,
          revision: 0,
        }
        let layerStateRevision = 0
        let payload = null
        let map = null
        let cityCenter = [0, 0]
        let maxCityRadiusMeters = 1000
        let sourceRevision = 0
        let sourceLoading = false
        let pendingSourceTimer = null
        let readyBroadcasted = false
        let mapReady = false
        let semanticQueryActive = false
        let semanticQueryVectorMode = false
        let fragmentWorkspaceVectorLayerIds = []
        let fragmentWorkspaceVectorSourceIds = []
        let visualTheme = 'light'
        let activeBaseMapId = initialBaseMapId()
        let pendingBaseMapInstall = false
        let baseMapSwitcherInstalled = false
        const manifestLayerKeys = new Set(
          (surfaceManifest?.layerFamilies || [])
            .flatMap((family) => [family.key, ...(family.keys || [])])
            .filter(Boolean),
        )

        function broadcast(type, payload = {}) {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ source: 'twin-viewer', viewer: viewerId, type, ...payload }, '*')
          }
        }

        function clamp(value, min, max) {
          return Math.min(max, Math.max(min, Number(value) || 0))
        }

        function layerAllowed(key) {
          return !manifestLayerKeys.size || manifestLayerKeys.has(key)
        }

        function baseMapEntries() {
          return Array.isArray(baseMapCatalog?.entries) ? baseMapCatalog.entries : []
        }

        function baseMapById(id) {
          return baseMapEntries().find((entry) => entry?.id === id) || null
        }

        function defaultBaseMap() {
          return baseMapById(baseMapCatalog?.defaultId) || baseMapEntries()[0] || { id: 'clean', type: 'blank', attribution: 'Twin overlay only' }
        }

        function currentBaseMap() {
          return baseMapById(activeBaseMapId) || defaultBaseMap()
        }

        function initialBaseMapId() {
          try {
            const stored = String(window.localStorage?.getItem(baseMapStorageKey) || '')
            if (stored && baseMapById(stored)) return stored
          } catch {}
          return defaultBaseMap().id
        }

        function baseMapAttribution(entry = currentBaseMap()) {
          return String(entry?.attribution || '')
        }

        function baseMapTiles(entry = currentBaseMap()) {
          return Array.isArray(entry?.tiles) ? entry.tiles.filter(Boolean) : []
        }

        function baseMapPaint(entry = currentBaseMap()) {
          const paint = entry?.mapLibrePaint || {}
          return paint[visualTheme] || paint.light || {}
        }

        function baseMapLayerDefinition(entry = currentBaseMap()) {
          return {
            id: baseMapLayerId,
            type: 'raster',
            source: baseMapSourceId,
            paint: baseMapPaint(entry),
          }
        }

        function baseMapSourceDefinition(entry = currentBaseMap()) {
          return {
            type: 'raster',
            tiles: baseMapTiles(entry),
            tileSize: Number(entry?.tileSize) || 256,
            maxzoom: Number(entry?.maximumLevel) || 19,
            attribution: baseMapAttribution(entry),
          }
        }

        function initialMapStyle() {
          const entry = currentBaseMap()
          const sources = {}
          const layers = []
          if (entry?.type === 'raster' && baseMapTiles(entry).length) {
            sources[baseMapSourceId] = baseMapSourceDefinition(entry)
            layers.push(baseMapLayerDefinition(entry))
          }
          return {
            version: 8,
            sources,
            layers,
          }
        }

        function firstOverlayLayerId() {
          return [...fixedLayerIds, ...featureLayerIds, ...semanticQueryLayerIds].find((layerId) => map?.getLayer(layerId))
        }

        function removeBaseMapLayer() {
          if (!map) return
          if (map.getLayer(baseMapLayerId)) map.removeLayer(baseMapLayerId)
          if (map.getSource(baseMapSourceId)) map.removeSource(baseMapSourceId)
        }

        function installBaseMapLayer(entry = currentBaseMap()) {
          if (!map || !mapReady || (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded())) {
            pendingBaseMapInstall = true
            return
          }
          pendingBaseMapInstall = false
          removeBaseMapLayer()
          if (entry?.type !== 'raster' || !baseMapTiles(entry).length) return
          map.addSource(baseMapSourceId, baseMapSourceDefinition(entry))
          const beforeLayer = firstOverlayLayerId()
          map.addLayer(baseMapLayerDefinition(entry), beforeLayer)
        }

        function updateBaseMapButtons() {
          document.documentElement.setAttribute('data-basemap', currentBaseMap().id)
          document.body?.setAttribute('data-basemap', currentBaseMap().id)
          document.querySelectorAll('[data-basemap]').forEach((button) => {
            const active = button.getAttribute('data-basemap') === currentBaseMap().id
            button.setAttribute('aria-pressed', active ? 'true' : 'false')
          })
        }

        function currentBaseMapState() {
          const entry = currentBaseMap()
          return {
            id: entry.id,
            label: entry.label || entry.shortLabel || entry.id,
            type: entry.type || 'unknown',
          }
        }

        function setBaseMap(nextId, { persist = true, broadcastState = true } = {}) {
          const entry = baseMapById(nextId) || defaultBaseMap()
          activeBaseMapId = entry.id
          if (persist) {
            try { window.localStorage?.setItem(baseMapStorageKey, activeBaseMapId) } catch {}
          }
          updateBaseMapButtons()
          installBaseMapLayer(entry)
          applyMapVisualTheme(visualTheme)
          if (broadcastState) broadcastMapState({ baseMap: currentBaseMapState() })
        }

        function installBaseMapSwitcher() {
          updateBaseMapButtons()
          if (baseMapSwitcherInstalled) return
          baseMapSwitcherInstalled = true
          document.querySelectorAll('[data-basemap]').forEach((button) => {
            button.addEventListener('click', () => {
              setBaseMap(button.getAttribute('data-basemap') || baseMapCatalog?.defaultId)
            })
          })
        }

        function setTileStatus(label, visible = false) {
          const node = document.getElementById('tile-status')
          if (!node) return
          node.textContent = label
          node.classList.toggle('is-visible', visible)
        }

        function setSourceLoading(nextLoading, label = 'Loading vector tiles') {
          sourceLoading = Boolean(nextLoading)
          setTileStatus(label, sourceLoading)
          broadcast('twin:viewport-loading', { loading: sourceLoading })
          if (!sourceLoading) {
            broadcast('twin:viewport', {
              mode: 'tiles',
              label: scaleState.coveragePercent > 0
                ? String(Math.round(scaleState.coveragePercent)) + '% city radius active'
                : 'No city radius loaded',
              returned: null,
              truncated: false,
            })
          }
        }

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

        function themePalette() {
          if (visualTheme === 'dark') {
            return {
              baseOpacity: 0.58,
              baseBrightnessMin: 0.03,
              baseBrightnessMax: 0.34,
              baseContrast: 0.12,
              boundaryFill: '#f8fafc',
              boundaryLine: '#f8fafc',
              coverageFill: '#ffffff',
              coverageLine: '#ffffff',
              unclassifiedFill: '#ffffff',
              unclassifiedLine: '#e5e7eb',
              polygonFill: '#f8fafc',
              polygonLine: '#ffffff',
              roadLine: '#ffffff',
              pointFill: '#ffffff',
              pointStroke: '#020617',
              queryFill: '#ffffff',
              queryLine: '#ffffff',
              queryPoint: '#ffffff',
            }
          }
          return {
            baseOpacity: 0.68,
            baseBrightnessMin: 0.78,
            baseBrightnessMax: 1,
            baseContrast: 0.02,
            boundaryFill: '#0f766e',
            boundaryLine: '#0f766e',
            coverageFill: '#0f766e',
            coverageLine: '#0f766e',
            unclassifiedFill: '#64748b',
            unclassifiedLine: '#475569',
            polygonFill: '#334155',
            polygonLine: '#0f172a',
            roadLine: '#0f766e',
            pointFill: '#0f172a',
            pointStroke: '#ffffff',
            queryFill: '#0891b2',
            queryLine: '#0e7490',
            queryPoint: '#0f766e',
          }
        }

        function setPaintIfLayer(layerId, property, value) {
          if (map?.getLayer(layerId)) map.setPaintProperty(layerId, property, value)
        }

        function applyMapVisualTheme(nextTheme = detectVisualTheme()) {
          visualTheme = nextTheme === 'dark' ? 'dark' : 'light'
          document.documentElement.setAttribute('data-viewer-theme', visualTheme)
          document.body?.setAttribute('data-viewer-theme', visualTheme)
          if (!map) return
          const palette = themePalette()
          Object.entries(baseMapPaint()).forEach(([property, value]) => {
            setPaintIfLayer(baseMapLayerId, property, value)
          })
          setPaintIfLayer('boundary-fill', 'fill-color', palette.boundaryFill)
          setPaintIfLayer('boundary-line', 'line-color', palette.boundaryLine)
          setPaintIfLayer('coverage-radius-fill', 'fill-color', palette.coverageFill)
          setPaintIfLayer('coverage-radius-line', 'line-color', palette.coverageLine)
          setPaintIfLayer('unclassified-fill', 'fill-color', palette.unclassifiedFill)
          setPaintIfLayer('unclassified-line', 'line-color', palette.unclassifiedLine)
          setPaintIfLayer('twin-green-fill', 'fill-color', palette.polygonFill)
          setPaintIfLayer('twin-green-line', 'line-color', palette.polygonLine)
          setPaintIfLayer('twin-buildings-fill', 'fill-color', palette.polygonFill)
          setPaintIfLayer('twin-buildings-line', 'line-color', palette.polygonLine)
          setPaintIfLayer('twin-roads', 'line-color', palette.roadLine)
          setPaintIfLayer('twin-places', 'circle-color', palette.pointFill)
          setPaintIfLayer('twin-places', 'circle-stroke-color', palette.pointStroke)
          setPaintIfLayer('twin-facilities', 'circle-color', palette.pointFill)
          setPaintIfLayer('twin-facilities', 'circle-stroke-color', palette.pointStroke)
          setPaintIfLayer('twin-query-fill', 'fill-color', palette.queryFill)
          setPaintIfLayer('twin-query-line', 'line-color', palette.queryLine)
          setPaintIfLayer('twin-query-points', 'circle-color', palette.queryPoint)
          setPaintIfLayer('twin-query-points', 'circle-stroke-color', palette.pointStroke)
        }

        function watchVisualTheme() {
          applyMapVisualTheme()
          window.setInterval(() => {
            const nextTheme = detectVisualTheme()
            if (nextTheme !== visualTheme) applyMapVisualTheme(nextTheme)
          }, 600)
          window.addEventListener('storage', (event) => {
            if (event.key === 'theme') applyMapVisualTheme()
          })
          window.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', () => {
            applyMapVisualTheme()
          })
        }

        async function loadPayload() {
          const response = await fetch(baseEndpoint, { credentials: 'same-origin' })
          if (!response.ok) throw new Error('DATA_LOAD_FAILED')
          return response.json()
        }

        function currentMapCameraState() {
          if (!map) return null
          const center = map.getCenter()
          return {
            mode: 'maplibre-camera',
            center: { lon: center.lng, lat: center.lat },
            zoom: map.getZoom(),
            bearing: map.getBearing(),
            pitch: map.getPitch(),
          }
        }

        function broadcastMapState(extra = {}) {
          broadcast('twin:state', {
            layers: layerState,
            camera: currentMapCameraState(),
            baseMap: currentBaseMapState(),
            runtime: 'maplibre',
            ...extra,
          })
        }

        function applyMapCameraState(camera = {}) {
          if (!map || !camera || typeof camera !== 'object') return
          const center = camera.center || {}
          const lon = Number(center.lon ?? camera.lon ?? camera.lng)
          const lat = Number(center.lat ?? camera.lat)
          if (!Number.isFinite(lon) || !Number.isFinite(lat)) return
          map.jumpTo({
            center: [lon, lat],
            zoom: Number.isFinite(Number(camera.zoom)) ? Number(camera.zoom) : map.getZoom(),
            bearing: Number.isFinite(Number(camera.bearing)) ? Number(camera.bearing) : map.getBearing(),
            pitch: Number.isFinite(Number(camera.pitch)) ? Number(camera.pitch) : map.getPitch(),
          })
          broadcastMapState()
        }

        ${renderMapLibreGeometryRuntime()}
        ${renderMapLibreLayerModelRuntime()}
        ${renderMapLibreSelectionRuntime()}
        ${renderMapLibreSourceRuntime()}
        ${renderMapLibreControlRuntime()}
        ${renderViewerShareManifestRuntime()}

        async function applyInitialSharedQueryOrTiles() {
          const shareKey = currentViewerShareKey()
          if (!shareKey) {
            setSourceLoading(false, 'Vector tiles ready')
            rebuildFeatureSource('initial load')
            return
          }

          try {
            setSourceLoading(true, 'Loading shared query')
            const result = await loadViewerShareQueryResult({
              cityId,
              surface: 'map',
              viewerId,
              metadata: { runtime: 'maplibre' },
            })
            if (result?.query) {
              setSemanticQueryResult(result)
              return
            }
            setSourceLoading(false, 'Vector tiles ready')
            rebuildFeatureSource('initial load')
          } catch (error) {
            setTileStatus('Shared query unavailable', true)
            broadcast('twin:error', { error: String(error?.message || 'VIEWER_SHARE_QUERY_FAILED') })
            setSourceLoading(false, 'Vector tiles ready')
            rebuildFeatureSource('initial load')
          }
        }

        installBaseMapSwitcher()

        loadPayload().then((nextPayload) => {
          payload = nextPayload
          cityCenter = [
            Number(payload.center?.lon ?? payload.reference?.center?.lon ?? 0),
            Number(payload.center?.lat ?? payload.reference?.center?.lat ?? 0),
          ]
          if (!Number.isFinite(cityCenter[0]) || !Number.isFinite(cityCenter[1])) {
            cityCenter = [0, 0]
          }
          maxCityRadiusMeters = calculateMaxRadius(cityCenter, payload.layers?.boundary)
          seedLayerState(payload)
          const initialZoom = maxCityRadiusMeters > 20000 ? 9.5 : maxCityRadiusMeters > 8000 ? 10.5 : 11.5

          map = new maplibregl.Map({
            container: 'map',
            center: cityCenter,
            zoom: initialZoom,
            minZoom: 2,
            maxZoom: 20,
            attributionControl: true,
            transformRequest: (url) => {
              if (String(url).includes('/api/live/')) {
                return { url, credentials: 'same-origin' }
              }
              return { url }
            },
            style: initialMapStyle(),
          })
          map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
          installBaseMapSwitcher()
          map.on('load', () => {
            mapReady = true
            watchVisualTheme()
            if (pendingBaseMapInstall || currentBaseMap().id !== defaultBaseMap().id) {
              installBaseMapLayer(currentBaseMap())
            }
            addBaseSources()
            applyMapVisualTheme()
            fitBoundary()
            setupSelection()
            readyBroadcasted = true
            broadcast('twin:ready', { layers: layerState, camera: currentMapCameraState(), baseMap: currentBaseMapState(), runtime: 'maplibre' })
            broadcastMapState()
            applyInitialSharedQueryOrTiles()
          })
          map.on('moveend', () => broadcastMapState())
          map.on('error', (event) => {
            const message = String(event?.error?.message || '')
            if (message.includes('404') || message.includes('No data found')) return
            setTileStatus('Tile warning', true)
          })
        }).catch((error) => {
          document.getElementById('map').innerHTML =
            '<div class="floating-note"><strong>Could not load live vector map.</strong><p class="hint">' + esc(error.message) + '</p></div>'
          broadcast('twin:error', { error: String(error?.message || 'MAP_LOAD_FAILED') })
        })

        window.setTimeout(() => {
          if (!readyBroadcasted) {
            broadcast('twin:viewport-loading', { loading: true })
          }
        }, 2000)
      </script>
  `
}
