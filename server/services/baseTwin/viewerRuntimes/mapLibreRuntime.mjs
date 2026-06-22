import { renderMapLibreGeometryRuntime } from './mapLibre/mapLibreGeometryRuntime.mjs'
import { renderMapLibreLayerModelRuntime } from './mapLibre/mapLibreLayerModelRuntime.mjs'
import { renderMapLibreSelectionRuntime } from './mapLibre/mapLibreSelectionRuntime.mjs'
import { renderMapLibreSourceRuntime } from './mapLibre/mapLibreSourceRuntime.mjs'
import { renderMapLibreControlRuntime } from './mapLibre/mapLibreControlRuntime.mjs'
import { renderViewerShareManifestRuntime } from './viewerShareManifestRuntime.mjs'

export function renderMapLibreRuntime({ cityId, baseEndpoint, cityName, surfaceManifest = {} }) {
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
        const viewportSourceId = 'twin-viewport-features'
        const semanticQuerySourceId = 'twin-semantic-query'
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
          coveragePercent: 0,
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
        let visualTheme = 'light'
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
          setPaintIfLayer('osm-base', 'raster-opacity', palette.baseOpacity)
          setPaintIfLayer('osm-base', 'raster-saturation', -1)
          setPaintIfLayer('osm-base', 'raster-contrast', palette.baseContrast)
          setPaintIfLayer('osm-base', 'raster-brightness-min', palette.baseBrightnessMin)
          setPaintIfLayer('osm-base', 'raster-brightness-max', palette.baseBrightnessMax)
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

          map = new maplibregl.Map({
            container: 'map',
            center: cityCenter,
            zoom: cityName.toLowerCase().includes('kharkiv') ? 9.5 : 11.5,
            minZoom: 2,
            maxZoom: 20,
            attributionControl: true,
            transformRequest: (url) => {
              if (String(url).includes('/api/live/')) {
                return { url, credentials: 'same-origin' }
              }
              return { url }
            },
            style: {
              version: 8,
              sources: {
                osm: {
                  type: 'raster',
                  tiles: [
                    'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                    'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                    'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
                  ],
                  tileSize: 256,
                  attribution: '© OpenStreetMap contributors',
                },
              },
              layers: [
                {
                  id: 'osm-base',
                  type: 'raster',
                  source: 'osm',
                  paint: {
                    'raster-opacity': 0.46,
                    'raster-saturation': -0.95,
                    'raster-contrast': -0.08,
                    'raster-brightness-min': 0.92,
                    'raster-brightness-max': 1,
                  },
                },
              ],
            },
          })
          map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
          map.on('load', () => {
            mapReady = true
            watchVisualTheme()
            addBaseSources()
            applyMapVisualTheme()
            fitBoundary()
            setupSelection()
            readyBroadcasted = true
            broadcast('twin:ready', { layers: layerState })
            broadcast('twin:state', { layers: layerState })
            applyInitialSharedQueryOrTiles()
          })
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
