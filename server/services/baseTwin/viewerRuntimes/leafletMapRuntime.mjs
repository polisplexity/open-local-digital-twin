export function renderLeafletMapRuntime({ baseEndpoint, cityName, municipalityTitle }) {
  return `
      <script src="/vendor/leaflet/leaflet.js"></script>
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
        const detailState = { fidelity: 0.58 }
          const cityScaleState = {
            key: 'overview',
            featureLimit: 0,
            coveragePercent: 0,
          }
          const layerControlState = {}
          const DEFAULT_LAYER_DETAIL = 50
          const MAX_CITY_WINDOW_FEATURES = 24000

        function clamp(value, min, max) {
          return Math.min(max, Math.max(min, value))
        }

        function broadcast(type, payload = {}) {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ source: 'twin-viewer', viewer: viewerId, type, ...payload }, '*')
          }
        }

        async function loadPayload() {
          const response = await fetch('${baseEndpoint}', { credentials: 'same-origin' })
          if (!response.ok) throw new Error('DATA_LOAD_FAILED')
          return response.json()
        }

        function liveFeaturesEndpoint(cityId) {
          return '/api/live/' + encodeURIComponent(cityId || 'current') + '/features'
        }

        async function loadBimLayers(cityId) {
          const response = await fetch('/api/live/' + encodeURIComponent(cityId || 'current') + '/bim-layers', {
            credentials: 'same-origin',
          })
          if (!response.ok) return { layers: [] }
          return response.json()
        }

        function fillMetrics(metrics) {
          const grid = document.getElementById('metric-grid')
          grid.innerHTML = metrics
            .map((item) => '<div class="metric"><span>' + esc(item.label) + '</span><strong>' + esc(item.value) + '</strong><p>' + esc(item.note || '') + '</p></div>')
            .join('')
        }

        function fillInventory(inventory) {
          const root = document.getElementById('inventory-list')
          root.innerHTML = inventory.sections.map((section) => {
            const items = section.items
              .map((item) => '<li class="inventory-item"><span>' + esc(item.label) + '</span><strong>' + esc(item.count) + '</strong></li>')
              .join('')
            return '<section class="inventory-section"><h3>' + esc(section.title) + '</h3><p class="inventory-summary">' + esc(section.summary) + '</p><ul>' + items + '</ul></section>'
          }).join('')
        }

        function fillCityBriefing(payload) {
          const root = document.getElementById('city-briefing')
          const town = payload.reference?.town
          const municipality = payload.reference?.municipality
          const totals = payload.inventory?.totals || {}
          const cards = []

          if (town) {
            cards.push(
              '<div class="card">' +
                '<strong>' + esc(town.title || ${JSON.stringify(cityName)}) + '</strong>' +
                '<p>' + esc(town.description || '') + '</p>' +
                '<p class="legend-note">' + esc(town.extract || '') + '</p>' +
              '</div>'
            )
          }

          if (municipality) {
            cards.push(
              '<div class="card">' +
                '<strong>' + esc(municipality.title || ${JSON.stringify(municipalityTitle || `${cityName} Municipality`)}) + '</strong>' +
                '<p>' + esc(municipality.extract || '') + '</p>' +
              '</div>'
            )
          }

          cards.push(
            '<div class="card">' +
              '<strong>Fastest usable base twin</strong>' +
              '<p>' +
                esc(
                  totals.scopeAreaKm2.toFixed(1) +
                    ' km², ' +
                    totals.roadNamesDiscovered +
                    ' named streets, ' +
                    totals.buildingsDiscovered +
                    ' buildings, ' +
                    totals.facilitiesDiscovered +
                    ' facilities, and ' +
                    totals.greenBlueDiscovered +
                    ' green-blue features are already part of the public starting point.',
                ) +
              '</p>' +
            '</div>'
          )

          root.innerHTML = cards.join('')
        }

        function renderSelection(properties, meta) {
          const panel = document.getElementById('selection-panel')
          const tags = Object.entries(properties || {})
            .filter(([key, value]) => value !== null && value !== '' && key !== 'id' && key !== 'kind')
            .map(([key, value]) => '<span class="selection-tag">' + esc(key) + ': ' + esc(value) + '</span>')
            .join('')
          panel.innerHTML =
            '<div class="card">' +
            '<p class="selection-title">' + esc(properties?.label || meta?.label || 'Selected feature') + '</p>' +
            '<p class="selection-meta">' + esc(meta?.description || '') + '</p>' +
            '<div class="selection-tags">' +
              '<span class="selection-tag">twin type: ' + esc(meta?.twinCategory || 'Current layer') + '</span>' +
              '<span class="selection-tag">city system: ' + esc(meta?.system || 'Current system') + '</span>' +
              '<span class="selection-tag">ldt layer: ' + esc(meta?.ldtLayer || 'Visualisation') + '</span>' +
              '<span class="selection-tag">capability: ' + esc(meta?.capability || 'Descriptive') + '</span>' +
              '<span class="selection-tag">method phase: ' + esc(meta?.phase || 'Explore') + '</span>' +
            '</div>' +
            '<p class="selection-meta"><strong>Why it matters:</strong> ' + esc(meta?.cityMeaning || '') + '</p>' +
            '<p class="selection-meta"><strong>Current semantic state:</strong> ' + esc(meta?.semanticState || 'Not classified') + '</p>' +
            '<p class="selection-meta"><strong>Transport status:</strong> ' + esc(meta?.transportStatus || 'Not described') + '</p>' +
            '<p class="selection-meta"><strong>Next step:</strong> ' + esc(meta?.nextSemanticStep || '') + '</p>' +
            '<div class="selection-tags">' + tags + '</div>' +
            '</div>'
        }

        function colorForRoad(feature) {
          const highway = feature?.properties?.highway || ''
          if (highway === 'primary' || highway === 'secondary') return '#0f766e'
          if (highway === 'tertiary') return '#0369a1'
          if (highway === 'service') return '#7c3aed'
          return '#516274'
        }

        function landUseStyle(feature, fidelity = 0.58) {
          const category = feature?.properties?.category || ''
          const isLine = feature?.geometry?.type === 'LineString'
          const palette = {
            water: { color: '#0284c7', fill: '#7dd3fc' },
            waterway: { color: '#0284c7', fill: '#7dd3fc' },
            river: { color: '#0284c7', fill: '#7dd3fc' },
            stream: { color: '#0284c7', fill: '#7dd3fc' },
            canal: { color: '#0284c7', fill: '#7dd3fc' },
            ditch: { color: '#38bdf8', fill: '#bae6fd' },
            drain: { color: '#38bdf8', fill: '#bae6fd' },
            forest: { color: '#166534', fill: '#86efac' },
            wood: { color: '#166534', fill: '#86efac' },
            grassland: { color: '#4d7c0f', fill: '#bef264' },
            grass: { color: '#65a30d', fill: '#d9f99d' },
            meadow: { color: '#65a30d', fill: '#d9f99d' },
            wetland: { color: '#0f766e', fill: '#99f6e4' },
            scrub: { color: '#15803d', fill: '#bbf7d0' },
            park: { color: '#16a34a', fill: '#bbf7d0' },
            garden: { color: '#16a34a', fill: '#dcfce7' },
            playground: { color: '#22c55e', fill: '#dcfce7' },
            residential: { color: '#64748b', fill: '#e2e8f0' },
            industrial: { color: '#92400e', fill: '#fed7aa' },
            commercial: { color: '#7e22ce', fill: '#e9d5ff' },
            retail: { color: '#7e22ce', fill: '#e9d5ff' },
            farmyard: { color: '#a16207', fill: '#fde68a' },
          }
          const colors = palette[category] || { color: '#4d7c0f', fill: '#d9f99d' }
          return {
            color: colors.color,
            weight: isLine ? 1.2 + fidelity * 1.3 : 1,
            fillColor: colors.fill,
            fillOpacity: isLine ? 0 : 0.18 + fidelity * 0.16,
            opacity: 0.7 + fidelity * 0.2,
          }
        }

        function popupHtml(feature, definition) {
          const props = feature.properties || {}
          const rows = Object.entries(props)
            .filter(([key, value]) => value !== null && value !== '' && key !== 'id')
            .map(([key, value]) => '<div>' + esc(key) + ': ' + esc(value) + '</div>')
            .join('')
          return (
            '<div class="map-popup">' +
            '<strong>' + esc(props.label || definition.label) + '</strong>' +
            '<div><em>' + esc(definition?.twinCategory || 'Current layer') + '</em></div>' +
            '<div>' + rows + '</div>' +
            '</div>'
          )
        }

        function logicalFacilityLayer(feature) {
          const category = String(feature?.properties?.category || '').trim()
          const mobility = new Set([
            'platform',
            'stop_position',
            'parking',
            'parking_space',
            'bicycle_parking',
            'charging_station',
            'fuel',
            'shelter',
            'compressed_air',
          ])
          const civic = new Set([
            'townhall',
            'library',
            'school',
            'kindergarten',
            'hospital',
            'clinic',
            'doctors',
            'police',
            'fire_station',
            'post_office',
            'community_centre',
            'social_facility',
            'childcare',
            'theatre',
            'marketplace',
            'events_venue',
          ])
          const waste = new Set(['recycling', 'waste_basket', 'waste_disposal'])
          if (mobility.has(category)) return 'mobility'
          if (civic.has(category)) return 'civic'
          if (waste.has(category)) return 'wasteSeeds'
          return 'commerce'
        }

        function splitViewportFeatures(geojson) {
          const collections = {
            roads: { type: 'FeatureCollection', features: [] },
            buildings: { type: 'FeatureCollection', features: [] },
            buildingCandidateNew: { type: 'FeatureCollection', features: [] },
            buildingCandidateMatched: { type: 'FeatureCollection', features: [] },
            greenBlue: { type: 'FeatureCollection', features: [] },
            civic: { type: 'FeatureCollection', features: [] },
            mobility: { type: 'FeatureCollection', features: [] },
            commerce: { type: 'FeatureCollection', features: [] },
            wasteSeeds: { type: 'FeatureCollection', features: [] },
            places: { type: 'FeatureCollection', features: [] },
          }
          ;(geojson?.features || []).forEach((feature) => {
            const layerKey = feature?.properties?.layerKey || feature?.properties?.featureType
            if (layerKey === 'roads') collections.roads.features.push(feature)
            else if (layerKey === 'buildings') collections.buildings.features.push(feature)
            else if (layerKey === 'buildingCandidateNew') collections.buildingCandidateNew.features.push(feature)
            else if (layerKey === 'buildingCandidateMatched') collections.buildingCandidateMatched.features.push(feature)
            else if (layerKey === 'greenBlue') collections.greenBlue.features.push(feature)
            else if (layerKey === 'places') collections.places.features.push(feature)
            else if (layerKey === 'facilities') collections[logicalFacilityLayer(feature)].features.push(feature)
          })
          return collections
        }

        loadPayload().then((payload) => {
          fillMetrics(payload.metrics)
          fillInventory(payload.inventory)
          fillCityBriefing(payload)

          const map = L.map('map', { zoomControl: true, preferCanvas: true })
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            className: 'base-context-tile',
            opacity: 0.72,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(map)

          const layerDefinitions = payload.inventory.layerDefinitions
          const registry = {}
          const fidelityEntries = {
            roads: [],
            buildings: [],
            buildingCandidateNew: [],
            buildingCandidateMatched: [],
            greenBlue: [],
            civic: [],
            mobility: [],
            commerce: [],
            wasteSeeds: [],
            places: [],
          }
          const visibleState = Object.fromEntries(
            layerDefinitions
              .filter((definition) => definition.key !== 'center')
              .map((definition) => [definition.key, Boolean(definition.visibleByDefault)]),
          )
          const windowedLayerKeys = ['roads', 'buildings', 'greenBlue', 'civic', 'mobility', 'commerce', 'wasteSeeds', 'places']
          const emptyWindowCollection = { type: 'FeatureCollection', features: [] }

          function renderAndBroadcastSelection(properties, meta) {
            renderSelection(properties, meta)
            broadcast('twin:selection', { selection: { properties, meta } })
          }

          function buildingDisplayProperties(properties) {
            return {
              ...(properties || {}),
              label: properties?.label && properties.label !== 'New building candidate' && properties.label !== 'Matched building candidate'
                ? properties.label
                : 'Building footprint',
              kind: 'building',
            }
          }

          registry.boundary = L.geoJSON(payload.layers.boundary, {
            style: { color: '#c46b2d', weight: 3, fillColor: '#f59e0b', fillOpacity: 0.02 },
            onEachFeature: (feature, layer) => {
              layer.bindPopup(popupHtml(feature, layerDefinitions.find((item) => item.key === 'boundary')))
              layer.on('click', () => renderAndBroadcastSelection(feature.properties, layerDefinitions.find((item) => item.key === 'boundary')))
            },
          })

          registry.unclassifiedLand = L.geoJSON(payload.layers.unclassifiedLand, {
            style: {
              color: '#b7791f',
              dashArray: '7 5',
              fillColor: '#fde68a',
              fillOpacity: 0.12,
              opacity: 0.72,
              weight: 1.2,
            },
            onEachFeature: (feature, layer) => {
              const definition = layerDefinitions.find((item) => item.key === 'unclassifiedLand')
              layer.bindPopup(popupHtml(feature, definition))
              layer.on('click', () => renderAndBroadcastSelection(
                {
                  ...(feature.properties || {}),
                  label: 'Land-use coverage gap',
                },
                definition,
              ))
            },
          })

          registry.roads = L.geoJSON(emptyWindowCollection, {
            style: (feature) => ({ color: colorForRoad(feature), weight: 2.2, opacity: 0.88 }),
            onEachFeature: (feature, layer) => {
              layer.bindPopup(popupHtml(feature, layerDefinitions.find((item) => item.key === 'roads')))
              layer.on('click', () => renderAndBroadcastSelection(feature.properties, layerDefinitions.find((item) => item.key === 'roads')))
            },
          })

          registry.buildings = L.geoJSON(emptyWindowCollection, {
            style: { color: '#64748b', weight: 1, fillColor: '#94a3b8', fillOpacity: 0.18 },
            onEachFeature: (feature, layer) => {
              layer.bindPopup(popupHtml(feature, layerDefinitions.find((item) => item.key === 'buildings')))
              layer.on('click', () => renderAndBroadcastSelection(buildingDisplayProperties(feature.properties), layerDefinitions.find((item) => item.key === 'buildings')))
            },
          })

          registry.buildingCandidateNew = L.geoJSON(emptyWindowCollection, {
            style: { color: '#64748b', weight: 1, fillColor: '#94a3b8', fillOpacity: 0.18, opacity: 0.9 },
            onEachFeature: (feature, layer) => {
              const definition = layerDefinitions.find((item) => item.key === 'buildings')
              const displayFeature = { ...feature, properties: buildingDisplayProperties(feature.properties) }
              layer.bindPopup(popupHtml(displayFeature, definition))
              layer.on('click', () => renderAndBroadcastSelection(displayFeature.properties, definition))
            },
          })

          registry.buildingCandidateMatched = L.geoJSON(emptyWindowCollection, {
            style: { color: '#64748b', weight: 1, fillColor: '#94a3b8', fillOpacity: 0.18, opacity: 0.9 },
            onEachFeature: (feature, layer) => {
              const definition = layerDefinitions.find((item) => item.key === 'buildings')
              const displayFeature = { ...feature, properties: buildingDisplayProperties(feature.properties) }
              layer.bindPopup(popupHtml(displayFeature, definition))
              layer.on('click', () => renderAndBroadcastSelection(displayFeature.properties, definition))
            },
          })

          registry.greenBlue = L.geoJSON(emptyWindowCollection, {
            style: (feature) => landUseStyle(feature),
            onEachFeature: (feature, layer) => {
              layer.bindPopup(popupHtml(feature, layerDefinitions.find((item) => item.key === 'greenBlue')))
              layer.on('click', () => renderAndBroadcastSelection(feature.properties, layerDefinitions.find((item) => item.key === 'greenBlue')))
            },
          })

          const pointPalette = {
            civic: { color: '#0f766e', fillColor: '#5eead4', radius: 2.1 },
            mobility: { color: '#2563eb', fillColor: '#93c5fd', radius: 2.1 },
            commerce: { color: '#7c3aed', fillColor: '#d8b4fe', radius: 2 },
            wasteSeeds: { color: '#b45309', fillColor: '#fbbf24', radius: 2.1 },
            places: { color: '#475569', fillColor: '#cbd5e1', radius: 2.2 },
            center: { color: '#7c3aed', fillColor: '#c4b5fd', radius: 2.4 },
          }

          function pointMarkerStyle(key, options = {}) {
            const palette = pointPalette[key] || pointPalette.places
            return {
              radius: options.radius ?? palette.radius,
              color: palette.color,
              weight: options.weight ?? 0.8,
              fillColor: palette.fillColor,
              fillOpacity: options.fillOpacity ?? 0.42,
              opacity: options.opacity ?? 0.58,
            }
          }

          registry.civic = L.geoJSON(emptyWindowCollection, {
            pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointMarkerStyle('civic')),
            onEachFeature: (feature, layer) => {
              layer.bindPopup(popupHtml(feature, layerDefinitions.find((item) => item.key === 'civic')))
              layer.on('click', () => renderAndBroadcastSelection(feature.properties, layerDefinitions.find((item) => item.key === 'civic')))
            },
          })

          registry.mobility = L.geoJSON(emptyWindowCollection, {
            pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointMarkerStyle('mobility')),
            onEachFeature: (feature, layer) => {
              layer.bindPopup(popupHtml(feature, layerDefinitions.find((item) => item.key === 'mobility')))
              layer.on('click', () => renderAndBroadcastSelection(feature.properties, layerDefinitions.find((item) => item.key === 'mobility')))
            },
          })

          registry.commerce = L.geoJSON(emptyWindowCollection, {
            pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointMarkerStyle('commerce')),
            onEachFeature: (feature, layer) => {
              layer.bindPopup(popupHtml(feature, layerDefinitions.find((item) => item.key === 'commerce')))
              layer.on('click', () => renderAndBroadcastSelection(feature.properties, layerDefinitions.find((item) => item.key === 'commerce')))
            },
          })

          registry.wasteSeeds = L.geoJSON(emptyWindowCollection, {
            pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointMarkerStyle('wasteSeeds')),
            onEachFeature: (feature, layer) => {
              layer.bindPopup(popupHtml(feature, layerDefinitions.find((item) => item.key === 'wasteSeeds')))
              layer.on('click', () => renderAndBroadcastSelection(feature.properties, layerDefinitions.find((item) => item.key === 'wasteSeeds')))
            },
          })

          registry.places = L.geoJSON(emptyWindowCollection, {
            pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointMarkerStyle('places')),
            onEachFeature: (feature, layer) => {
              layer.bindPopup(popupHtml(feature, layerDefinitions.find((item) => item.key === 'places')))
              layer.on('click', () => renderAndBroadcastSelection(feature.properties, layerDefinitions.find((item) => item.key === 'places')))
            },
          })

          registry.center = L.geoJSON(payload.layers.center, {
            pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointMarkerStyle('center')),
            onEachFeature: (feature, layer) => {
              layer.bindPopup(popupHtml(feature, layerDefinitions.find((item) => item.key === 'center')))
              layer.on('click', () => renderAndBroadcastSelection(feature.properties, layerDefinitions.find((item) => item.key === 'center')))
            },
          })

          const radiusFilteredLayerKeys = new Set([
            'roads',
            'buildings',
            'buildingCandidateNew',
            'buildingCandidateMatched',
            'greenBlue',
            'civic',
            'mobility',
            'commerce',
            'wasteSeeds',
            'places',
          ])
          const cityCenter = L.latLng(Number(payload.center.lat), Number(payload.center.lon))
          let coverageCircle = null

          function shouldRenderLayer(key) {
            return Boolean(visibleState[key])
          }

          function cityCoveragePercent() {
            const value = Number(cityScaleState.coveragePercent)
            return clamp(Number.isFinite(value) ? value : 0, 0, 100)
          }

          function fullCityRadiusMeters() {
            const bounds = registry.boundary?.getBounds?.()
            if (!bounds?.isValid?.()) return 0
            const corners = [
              bounds.getNorthWest(),
              bounds.getNorthEast(),
              bounds.getSouthWest(),
              bounds.getSouthEast(),
            ]
            return Math.max(...corners.map((corner) => map.distance(cityCenter, corner)), 1)
          }

          function coverageRadiusMeters() {
            const percent = cityCoveragePercent()
            if (percent <= 0) return 0
            if (percent >= 100) return Infinity
            return fullCityRadiusMeters() * Math.sqrt(percent / 100)
          }

          function updateCoverageCircle() {
            const percent = cityCoveragePercent()
            if (percent <= 0 || percent >= 100) {
              if (coverageCircle) coverageCircle.remove()
              return
            }
            const radius = coverageRadiusMeters()
            if (!coverageCircle) {
              coverageCircle = L.circle(cityCenter, {
                radius,
                color: '#0f766e',
                weight: 1,
                dashArray: '5 5',
                fillColor: '#14b8a6',
                fillOpacity: 0.025,
                opacity: 0.42,
                interactive: false,
              })
            }
            coverageCircle.setRadius(radius)
            coverageCircle.addTo(map)
          }

          function featureLayerCenter(layer) {
            if (typeof layer.getLatLng === 'function') return layer.getLatLng()
            const bounds = layer.getBounds?.()
            if (bounds?.isValid?.()) return bounds.getCenter()
            return null
          }

          function layerInsideCoverage(key, layer) {
            if (!radiusFilteredLayerKeys.has(key)) return true
            if (cityCoveragePercent() <= 0) return false
            if (cityCoveragePercent() >= 100) return true
            const center = featureLayerCenter(layer)
            if (!center) return true
            return map.distance(cityCenter, center) <= coverageRadiusMeters()
          }

          function coverageFetchBounds() {
            if (cityCoveragePercent() <= 0) return null
            if (cityCoveragePercent() >= 100) {
              const boundaryBounds = registry.boundary?.getBounds?.()
              if (boundaryBounds?.isValid?.()) return boundaryBounds
              const mapBounds = map.getBounds()
              return mapBounds?.isValid?.() ? mapBounds : null
            }
            const radius = coverageRadiusMeters()
            const coverageBounds = cityCenter.toBounds(radius * 2)
            return coverageBounds?.isValid?.() ? coverageBounds : null
          }

          function applyScaleLayerVisibility() {
            updateCoverageCircle()
            Object.keys(visibleState).forEach((key) => {
              if (!registry[key]) return
              if (shouldRenderLayer(key)) {
                registry[key].addTo(map)
              } else {
                registry[key].remove()
              }
            })
          }

          function mapLayerOptions(key) {
            if (key === 'roads') {
              return {
                style: (feature) => ({ color: colorForRoad(feature), weight: 2.2, opacity: 0.88 }),
                onEachFeature: (feature, layer) => {
                  const definition = layerDefinitions.find((item) => item.key === 'roads')
                  layer.bindPopup(popupHtml(feature, definition))
                  layer.on('click', () => renderAndBroadcastSelection(feature.properties, definition))
                },
              }
            }
            if (key === 'buildings') {
              return {
                style: { color: '#64748b', weight: 1, fillColor: '#94a3b8', fillOpacity: 0.18 },
                onEachFeature: (feature, layer) => {
                  const definition = layerDefinitions.find((item) => item.key === 'buildings')
                  layer.bindPopup(popupHtml(feature, definition))
                  layer.on('click', () => renderAndBroadcastSelection(buildingDisplayProperties(feature.properties), definition))
                },
              }
            }
            if (key === 'buildingCandidateNew') {
              return {
                style: { color: '#64748b', weight: 1, fillColor: '#94a3b8', fillOpacity: 0.18, opacity: 0.9 },
                onEachFeature: (feature, layer) => {
                  const definition = layerDefinitions.find((item) => item.key === 'buildings')
                  const displayFeature = { ...feature, properties: buildingDisplayProperties(feature.properties) }
                  layer.bindPopup(popupHtml(displayFeature, definition))
                  layer.on('click', () => renderAndBroadcastSelection(displayFeature.properties, definition))
                },
              }
            }
            if (key === 'buildingCandidateMatched') {
              return {
                style: { color: '#64748b', weight: 1, fillColor: '#94a3b8', fillOpacity: 0.18, opacity: 0.9 },
                onEachFeature: (feature, layer) => {
                  const definition = layerDefinitions.find((item) => item.key === 'buildings')
                  const displayFeature = { ...feature, properties: buildingDisplayProperties(feature.properties) }
                  layer.bindPopup(popupHtml(displayFeature, definition))
                  layer.on('click', () => renderAndBroadcastSelection(displayFeature.properties, definition))
                },
              }
            }
            if (key === 'greenBlue') {
              return {
                style: (feature) => landUseStyle(feature),
                onEachFeature: (feature, layer) => {
                  const definition = layerDefinitions.find((item) => item.key === 'greenBlue')
                  layer.bindPopup(popupHtml(feature, definition))
                  layer.on('click', () => renderAndBroadcastSelection(feature.properties, definition))
                },
              }
            }
            if (key === 'civic') {
              return {
                pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointMarkerStyle('civic')),
                onEachFeature: (feature, layer) => {
                  const definition = layerDefinitions.find((item) => item.key === 'civic')
                  layer.bindPopup(popupHtml(feature, definition))
                  layer.on('click', () => renderAndBroadcastSelection(feature.properties, definition))
                },
              }
            }
            if (key === 'mobility') {
              return {
                pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointMarkerStyle('mobility')),
                onEachFeature: (feature, layer) => {
                  const definition = layerDefinitions.find((item) => item.key === 'mobility')
                  layer.bindPopup(popupHtml(feature, definition))
                  layer.on('click', () => renderAndBroadcastSelection(feature.properties, definition))
                },
              }
            }
            if (key === 'commerce') {
              return {
                pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointMarkerStyle('commerce')),
                onEachFeature: (feature, layer) => {
                  const definition = layerDefinitions.find((item) => item.key === 'commerce')
                  layer.bindPopup(popupHtml(feature, definition))
                  layer.on('click', () => renderAndBroadcastSelection(feature.properties, definition))
                },
              }
            }
            if (key === 'wasteSeeds') {
              return {
                pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointMarkerStyle('wasteSeeds')),
                onEachFeature: (feature, layer) => {
                  const definition = layerDefinitions.find((item) => item.key === 'wasteSeeds')
                  layer.bindPopup(popupHtml(feature, definition))
                  layer.on('click', () => renderAndBroadcastSelection(feature.properties, definition))
                },
              }
            }
            if (key === 'places') {
              return {
                pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointMarkerStyle('places')),
                onEachFeature: (feature, layer) => {
                  const definition = layerDefinitions.find((item) => item.key === 'places')
                  layer.bindPopup(popupHtml(feature, definition))
                  layer.on('click', () => renderAndBroadcastSelection(feature.properties, definition))
                },
              }
            }
            return {}
          }

          layerDefinitions.forEach((definition) => {
            if (definition.visibleByDefault && shouldRenderLayer(definition.key)) {
              registry[definition.key].addTo(map)
            }
          })
          applyScaleLayerVisibility()

          const controlsRoot = document.getElementById('layer-controls')

          function setLayerVisibility(key, visible) {
            if (!registry[key]) return
            visibleState[key] = Boolean(visible)
            if (shouldRenderLayer(key)) {
              registry[key].addTo(map)
            } else {
              registry[key].remove()
            }
            const input = controlsRoot.querySelector('input[data-layer="' + key + '"]')
            if (input) {
              input.checked = visibleState[key]
            }
          }

          function layerDetailRatio(key) {
            return clamp(Number(layerControlState[key]?.detail ?? DEFAULT_LAYER_DETAIL) / 100, 0.1, 1)
          }

          function viewportDetailRatio(keys = []) {
            const visibleKeys = keys.filter((key) => radiusFilteredLayerKeys.has(key))
            if (!visibleKeys.length) return 1
            const total = visibleKeys.reduce((sum, key) => sum + layerDetailRatio(key), 0)
            return clamp(total / visibleKeys.length, 0.1, 1)
          }

          function visibleCountForLayer(key) {
            const entries = fidelityEntries[key] || []
            return Math.max(0, Math.min(entries.length, Math.round(entries.length * layerDetailRatio(key))))
          }

          function isEvenlySelected(index, total, selectedCount) {
            if (selectedCount >= total) return true
            if (selectedCount <= 0 || total <= 0) return false
            return Math.floor(((index + 1) * selectedCount) / total) > Math.floor((index * selectedCount) / total)
          }

          function featureLabel(feature) {
            return feature?.properties?.label || feature?.properties?.name || feature?.properties?.id || 'Feature'
          }

          function applyLayerControls(keys = Object.keys(registry)) {
            keys.forEach((key) => {
              const labelsEnabled = Boolean(layerControlState[key]?.labels)
              registry[key]?.eachLayer?.((layer) => {
                if (labelsEnabled && layer._twinVisible !== false) {
                  if (!layer.getTooltip?.()) {
                    layer.bindTooltip(esc(featureLabel(layer.feature)), {
                      className: 'dt-map-label',
                      direction: 'top',
                      opacity: 0.9,
                      permanent: true,
                      sticky: false,
                    })
                  }
                } else if (layer.getTooltip?.()) {
                  layer.unbindTooltip()
                }
              })
            })
          }

          function fidelityRatio(start, floor, curve = 1) {
            const span = clamp((detailState.fidelity - start) / Math.max(1 - start, 0.001), 0, 1)
            return floor + (1 - floor) * Math.pow(span, curve)
          }

          function setLeafletLayerPresence(layer, visible, painter) {
            painter(layer, visible)
            const element =
              layer._path ||
              (typeof layer.getElement === 'function' ? layer.getElement() : null) ||
              layer._icon ||
              null
            if (element) {
              element.style.pointerEvents = visible ? 'auto' : 'none'
              element.style.display = visible ? '' : 'none'
            }
            layer._twinVisible = Boolean(visible)
            if (!visible && typeof layer.closePopup === 'function') {
              layer.closePopup()
            }
            if (!visible && layer.getTooltip?.()) {
              layer.unbindTooltip()
            }
          }

          function applyDistanceStyling() {
            const fidelity = clamp(detailState.fidelity, 0.1, 1)
            updateCoverageCircle()
            const zoomFocus = clamp((map.getZoom() - 11) / 5, 0, 1)
            const roadWeight = 0.5 + fidelity * (0.62 + zoomFocus * 1.35)
            const roadOpacity = 0.26 + fidelity * (0.2 + zoomFocus * 0.34)
            const buildingWeight = 0.5 + fidelity * 1.1
            const buildingFillOpacity = 0.08 + fidelity * 0.18
            const boundaryWeight = 1.8 + fidelity * 2.1
            registry.boundary?.setStyle?.({
              weight: boundaryWeight,
              fillColor: '#f59e0b',
              fillOpacity: 0.02,
              opacity: 0.76 + fidelity * 0.22,
            })

            registry.unclassifiedLand?.setStyle?.({
              color: '#b7791f',
              dashArray: '7 5',
              fillColor: '#fde68a',
              fillOpacity: 0.12,
              opacity: 0.72,
              weight: 1.2,
            })

            registry.roads?.eachLayer?.((layer) => {
              const feature = layer.feature
              layer.setStyle?.({
                color: colorForRoad(feature),
                weight: roadWeight,
                opacity: roadOpacity,
              })
            })

            registry.buildings?.setStyle?.({
              weight: buildingWeight,
              fillColor: '#94a3b8',
              fillOpacity: buildingFillOpacity,
              opacity: 0.76 + fidelity * 0.18,
            })

            registry.buildingCandidateNew?.setStyle?.({
              color: '#64748b',
              weight: buildingWeight,
              fillColor: '#94a3b8',
              fillOpacity: buildingFillOpacity,
              opacity: 0.76 + fidelity * 0.18,
            })

            registry.buildingCandidateMatched?.setStyle?.({
              color: '#64748b',
              weight: buildingWeight,
              fillColor: '#94a3b8',
              fillOpacity: buildingFillOpacity,
              opacity: 0.76 + fidelity * 0.18,
            })

            registry.greenBlue?.eachLayer?.((layer) => {
              layer.setStyle?.(landUseStyle(layer.feature, fidelity))
            })

            const pointRadius = {
              civic: 1.15 + fidelity * 0.42 + zoomFocus * (1.8 + fidelity * 1.25),
              mobility: 1.15 + fidelity * 0.42 + zoomFocus * (1.8 + fidelity * 1.25),
              commerce: 1.08 + fidelity * 0.38 + zoomFocus * (1.65 + fidelity * 1.12),
              wasteSeeds: 1.18 + fidelity * 0.42 + zoomFocus * (1.9 + fidelity * 1.28),
              places: 1.22 + fidelity * 0.44 + zoomFocus * (2.1 + fidelity * 1.34),
              center: 1.35 + fidelity * 0.5 + zoomFocus * (2.3 + fidelity * 1.45),
            }

            Object.entries(pointRadius).forEach(([key, radius]) => {
              registry[key]?.eachLayer?.((layer) => {
                if (typeof layer.setRadius === 'function') {
                  layer.setRadius(radius)
                }
              })
            })

            const roadVisibleCount = visibleCountForLayer('roads')
            fidelityEntries.roads.forEach((layer, index) => {
              const visible = isEvenlySelected(index, fidelityEntries.roads.length, roadVisibleCount) && layerInsideCoverage('roads', layer)
              setLeafletLayerPresence(layer, visible, (target, visible) => {
                const feature = target.feature
                target.setStyle?.({
                  color: colorForRoad(feature),
                  weight: visible ? roadWeight : 0.01,
                  opacity: visible ? roadOpacity : 0,
                })
              })
            })

            const buildingVisibleCount = visibleCountForLayer('buildings')
            fidelityEntries.buildings.forEach((layer, index) => {
              const visible = isEvenlySelected(index, fidelityEntries.buildings.length, buildingVisibleCount) && layerInsideCoverage('buildings', layer)
              setLeafletLayerPresence(layer, visible, (target, visible) => {
                target.setStyle?.({
                  color: '#64748b',
                  weight: visible ? buildingWeight : 0.01,
                  fillColor: '#94a3b8',
                  fillOpacity: visible ? buildingFillOpacity : 0,
                  opacity: visible ? (0.76 + fidelity * 0.18) : 0,
                })
              })
            })

            ;['buildingCandidateNew', 'buildingCandidateMatched'].forEach((key) => {
              const visibleCount = visibleCountForLayer(key)
              const style = {
                color: '#64748b',
                fillColor: '#94a3b8',
                fillOpacity: buildingFillOpacity,
                opacity: 0.76 + fidelity * 0.18,
                weight: buildingWeight,
              }
              fidelityEntries[key].forEach((layer, index) => {
                const visible = isEvenlySelected(index, fidelityEntries[key].length, visibleCount) && layerInsideCoverage(key, layer)
                setLeafletLayerPresence(layer, visible, (target, visible) => {
                  target.setStyle?.({
                    ...style,
                    weight: visible ? style.weight : 0.01,
                    fillOpacity: visible ? style.fillOpacity : 0,
                    opacity: visible ? style.opacity : 0,
                  })
                })
              })
            })

            const greenBlueVisibleCount = visibleCountForLayer('greenBlue')
            fidelityEntries.greenBlue.forEach((layer, index) => {
              const visible = isEvenlySelected(index, fidelityEntries.greenBlue.length, greenBlueVisibleCount) && layerInsideCoverage('greenBlue', layer)
              setLeafletLayerPresence(layer, visible, (target, visible) => {
                const feature = target.feature
                target.setStyle?.({
                  ...landUseStyle(feature, fidelity),
                  weight: visible ? landUseStyle(feature, fidelity).weight : 0.01,
                  fillOpacity: visible ? landUseStyle(feature, fidelity).fillOpacity : 0,
                  opacity: visible ? landUseStyle(feature, fidelity).opacity : 0,
                })
              })
            })

            const pointWeight = 0.45 + zoomFocus * 0.85
            const pointOpacity = 0.42 + zoomFocus * 0.42
            const pointFillOpacity = 0.28 + zoomFocus * 0.46
            const pointVisibilityRules = {
              civic: { start: 0.24, floor: 0.12, curve: 1.18, radius: pointRadius.civic },
              mobility: { start: 0.28, floor: 0.1, curve: 1.2, radius: pointRadius.mobility },
              commerce: { start: 0.32, floor: 0.08, curve: 1.26, radius: pointRadius.commerce },
              wasteSeeds: { start: 0.3, floor: 0.1, curve: 1.22, radius: pointRadius.wasteSeeds },
              places: { start: 0.56, floor: 0.02, curve: 1.52, radius: pointRadius.places },
            }

            Object.entries(pointVisibilityRules).forEach(([key, rule]) => {
              const entries = fidelityEntries[key] || []
              const visibleCount = visibleCountForLayer(key)
              entries.forEach((layer, index) => {
                const visible = isEvenlySelected(index, entries.length, visibleCount) && layerInsideCoverage(key, layer)
                setLeafletLayerPresence(layer, visible, (target, visible) => {
                  if (typeof target.setRadius === 'function') {
                    target.setRadius(visible ? rule.radius : 0.01)
                  }
                  if (typeof target.setStyle === 'function') {
                    const style = pointMarkerStyle(key, {
                      weight: visible ? pointWeight : 0.01,
                      fillOpacity: visible ? pointFillOpacity : 0,
                      opacity: visible ? pointOpacity : 0,
                    })
                    target.setStyle({
                      ...style,
                    })
                  }
                })
              })
            })
            applyLayerControls()
          }

          function fitToLayerKeys(keys, pad = 0.12) {
            let bounds = null
            keys.forEach((key) => {
              const layer = registry[key]
              if (!layer?.getBounds) return
              const next = layer.getBounds()
              if (!next?.isValid?.()) return
              bounds = bounds ? bounds.extend(next) : next
            })
            if (bounds?.isValid?.()) {
              map.fitBounds(bounds.pad(pad))
            }
          }

          function applyViewPreset(value) {
            if (value === 'service-access' || value === 'access-seeds') {
              fitToLayerKeys(['roads', 'mobility', 'civic'], 0.14)
              return
            }
            if (value === 'waste-launchpad' || value === 'service-preview') {
              fitToLayerKeys(['roads', 'commerce', 'wasteSeeds'], 0.14)
              return
            }
            fitToLayerKeys(['boundary'], 0.08)
          }

          function syncState() {
            broadcast('twin:state', { layers: visibleState })
          }

          controlsRoot.innerHTML = layerDefinitions.map((definition) => {
            const checked = definition.visibleByDefault ? 'checked' : ''
            const discovered = definition.discoveredCount ?? definition.count
            const rendered = definition.renderedCount ?? definition.count
            return (
              '<label class="layer-row">' +
                '<input type="checkbox" data-layer="' + esc(definition.key) + '" ' + checked + ' />' +
                '<div>' +
                  '<strong>' + esc(definition.label) + '</strong>' +
                  '<small>' + esc(definition.description) + '</small>' +
                  '<span class="layer-badge"><span class="swatch" style="background:' + esc(definition.color) + '"></span>' + esc(rendered) + ' rendered / ' + esc(discovered) + ' discovered</span>' +
                '</div>' +
              '</label>'
            )
          }).join('')

          controlsRoot.querySelectorAll('input[type="checkbox"]').forEach((input) => {
            input.addEventListener('change', (event) => {
              const key = event.target.getAttribute('data-layer')
              setLayerVisibility(key, Boolean(event.target.checked))
              syncState()
            })
          })

          Object.keys(fidelityEntries).forEach((key) => {
            registry[key]?.eachLayer?.((layer) => {
              fidelityEntries[key].push(layer)
            })
          })

          const windowedLayerSignatures = {}
          let viewportRefreshTimer = null
          let viewportRefreshSeq = 0
          let activeViewportSignature = ''
          let lastCompletedViewportSignature = ''

          function rebuildFidelityEntries(keys) {
            keys.forEach((key) => {
              fidelityEntries[key] = []
              registry[key]?.eachLayer?.((layer) => {
                fidelityEntries[key].push(layer)
              })
            })
          }

          function featureSignature(feature, index) {
            const properties = feature?.properties || {}
            return String(
              feature?.id ||
              properties.stableId ||
              properties.id ||
              properties.sourceFeatureId ||
              properties.osmId ||
              properties.name ||
              index
            ) + ':' + String(properties.layerKey || properties.featureType || '')
          }

          function collectionSignature(collection) {
            const features = Array.isArray(collection?.features) ? collection.features : []
            if (!features.length) return '0'
            const step = Math.max(1, Math.floor(features.length / 18))
            const parts = []
            for (let index = 0; index < features.length; index += step) {
              parts.push(featureSignature(features[index], index))
            }
            const lastIndex = features.length - 1
            parts.push(featureSignature(features[lastIndex], lastIndex))
            return String(features.length) + '|' + parts.join('|')
          }

          function replaceWindowedLayer(key, collection) {
            if (!registry[key]) return false
            const nextSignature = collectionSignature(collection)
            if (windowedLayerSignatures[key] === nextSignature) return false
            const wasVisible = map.hasLayer(registry[key])
            registry[key].remove()
            registry[key] = L.geoJSON(collection, mapLayerOptions(key))
            windowedLayerSignatures[key] = nextSignature
            if (wasVisible || visibleState[key]) {
              if (shouldRenderLayer(key)) {
                registry[key].addTo(map)
              }
            }
            applyLayerControls([key])
            return true
          }

          function replaceWindowedLayerProgressively(key, collection, options = {}) {
            if (!registry[key]) return Promise.resolve(false)
            const features = Array.isArray(collection?.features) ? collection.features : []
            const nextSignature = collectionSignature(collection)
            if (windowedLayerSignatures[key] === nextSignature) return Promise.resolve(false)

            const wasVisible = map.hasLayer(registry[key])
            registry[key].remove()
            registry[key] = L.geoJSON(emptyWindowCollection, mapLayerOptions(key))
            windowedLayerSignatures[key] = nextSignature

            if (wasVisible || visibleState[key]) {
              if (shouldRenderLayer(key)) {
                registry[key].addTo(map)
              }
            }

            if (!features.length) {
              applyLayerControls([key])
              return Promise.resolve(true)
            }

            const batchSize = Math.max(80, Math.min(700, Number(options.batchSize) || 360))
            const requestSequence = Number(options.sequence ?? viewportRefreshSeq)
            let cursor = 0

            return new Promise((resolve) => {
              const addBatch = () => {
                if (requestSequence !== viewportRefreshSeq) {
                  resolve(false)
                  return
                }
                const nextBatch = features.slice(cursor, cursor + batchSize)
                cursor += nextBatch.length
                registry[key]?.addData?.({
                  type: 'FeatureCollection',
                  features: nextBatch,
                })
                if (cursor < features.length) {
                  window.requestAnimationFrame(addBatch)
                  return
                }
                applyLayerControls([key])
                resolve(true)
              }
              window.requestAnimationFrame(addBatch)
            })
          }

          async function refreshViewportFeatures() {
            const bounds = coverageFetchBounds()
            if (!bounds?.isValid?.()) {
              broadcast('twin:viewport-loading', { loading: false })
              broadcast('twin:viewport', {
                cityId,
                bbox: null,
                returned: 0,
                truncated: false,
              })
              return
            }
            const params = new URLSearchParams()
            params.set('bbox', [
              bounds.getWest().toFixed(6),
              bounds.getSouth().toFixed(6),
              bounds.getEast().toFixed(6),
              bounds.getNorth().toFixed(6),
            ].join(','))
            if (cityCoveragePercent() > 0 && cityCoveragePercent() < 100) {
              params.set('center', [cityCenter.lng.toFixed(6), cityCenter.lat.toFixed(6)].join(','))
              params.set('radiusMeters', String(Math.round(coverageRadiusMeters())))
            }
            const requestedWindowLayers = windowedLayerKeys.filter((key) => visibleState[key])
            const apiLayers = requestedWindowLayers.map((key) =>
              ['civic', 'mobility', 'commerce', 'wasteSeeds'].includes(key) ? 'facilities' : key
            )
            params.set('layers', Array.from(new Set(apiLayers)).join(',') || 'roads,buildings,greenBlue,facilities,places')
            const scaleLimit = Number(cityScaleState.featureLimit)
            if (!Number.isFinite(scaleLimit) || scaleLimit <= 0) {
              broadcast('twin:viewport-loading', { loading: false })
              return
            }
            const detailLimit = Math.round(scaleLimit * viewportDetailRatio(requestedWindowLayers))
            params.set('limit', String(clamp(detailLimit, 1, MAX_CITY_WINDOW_FEATURES)))
            const requestSignature = params.toString()
            if (requestSignature === activeViewportSignature) return
            if (requestSignature === lastCompletedViewportSignature) {
              applyDistanceStyling()
              broadcast('twin:viewport-loading', { loading: false })
              return
            }
            const sequence = ++viewportRefreshSeq
            activeViewportSignature = requestSignature
            broadcast('twin:viewport-loading', { loading: true })
            try {
              const response = await fetch(liveFeaturesEndpoint(cityId) + '?' + params.toString(), {
                credentials: 'same-origin',
              })
              if (!response.ok) {
                broadcast('twin:viewport', {
                  cityId,
                  bbox: params.get('bbox'),
                  returned: 0,
                  truncated: false,
                  error: 'VIEWPORT_REQUEST_FAILED',
                })
                return
              }
              const payload = await response.json()
              if (sequence !== viewportRefreshSeq || !payload?.geojson) return
              const collections = splitViewportFeatures(payload.geojson)
              broadcast('twin:viewport', {
                cityId: payload.cityId,
                bbox: payload.bbox,
                returned: payload.returned,
                truncated: payload.truncated,
              })
              let replacedAnyLayer = false
              const renderOrder = ['roads', 'greenBlue', 'civic', 'mobility', 'commerce', 'wasteSeeds', 'places', 'buildings']
              for (const key of renderOrder) {
                if (!windowedLayerKeys.includes(key)) continue
                const replacedLayer = await replaceWindowedLayerProgressively(key, collections[key], {
                  batchSize: key === 'buildings' ? 520 : 280,
                  sequence,
                })
                replacedAnyLayer = replacedLayer || replacedAnyLayer
                if (sequence !== viewportRefreshSeq) return
              }
              if (replacedAnyLayer) {
                rebuildFidelityEntries(windowedLayerKeys)
              }
              applyDistanceStyling()
            } catch (error) {
              if (sequence === viewportRefreshSeq) {
                broadcast('twin:viewport', {
                  cityId,
                  bbox: params.get('bbox'),
                  returned: 0,
                  truncated: false,
                  error: String(error?.message || 'VIEWPORT_REQUEST_FAILED'),
                })
              }
            } finally {
              if (sequence === viewportRefreshSeq) {
                activeViewportSignature = ''
                lastCompletedViewportSignature = requestSignature
                broadcast('twin:viewport-loading', { loading: false })
              }
            }
          }

          function scheduleViewportRefresh(delay = 280) {
            window.clearTimeout(viewportRefreshTimer)
            viewportRefreshTimer = window.setTimeout(() => {
              refreshViewportFeatures().catch(() => {})
            }, delay)
          }

          window.addEventListener('message', (event) => {
            const message = event.data ?? {}
            if (message.source !== 'twin-dashboard' || message.viewer !== viewerId) return

            if (message.type === 'twin:set-visible-layers') {
              Object.entries(message.layers ?? {}).forEach(([key, visible]) => {
                setLayerVisibility(key, Boolean(visible))
              })
              scheduleViewportRefresh(90)
              syncState()
            }

            if (message.type === 'twin:set-fidelity') {
              detailState.fidelity = clamp(Number(message.value) || 0.62, 0.12, 1)
              applyDistanceStyling()
            }

            if (message.type === 'twin:set-city-scale') {
              const scale = message.scale || {}
              cityScaleState.key = String(scale.key || cityScaleState.key || 'district')
              cityScaleState.featureLimit = clamp(Number(scale.featureLimit) || 0, 0, MAX_CITY_WINDOW_FEATURES)
              cityScaleState.coveragePercent = clamp(Number(scale.coveragePercent) || 0, 0, 100)
              if (scale.fidelity !== undefined) {
                detailState.fidelity = clamp(Number(scale.fidelity) || detailState.fidelity, 0.12, 1)
              }
              applyScaleLayerVisibility()
              applyDistanceStyling()
              scheduleViewportRefresh(80)
            }

            if (message.type === 'twin:set-layer-controls') {
              Object.entries(message.controls ?? {}).forEach(([key, controls]) => {
                layerControlState[key] = {
                  ...(layerControlState[key] ?? {}),
                  ...(controls ?? {}),
                }
              })
              applyDistanceStyling()
              applyLayerControls(Object.keys(message.controls ?? {}))
              if (cityCoveragePercent() > 0) {
                scheduleViewportRefresh(120)
              }
            }

            if (message.type === 'twin:command') {
              const command = message.command ?? {}
              if (command.kind === 'viewPreset') {
                applyViewPreset(command.value)
              }
              if (command.kind === 'layerFocus' && registry[command.value]) {
                setLayerVisibility(command.value, true)
                fitToLayerKeys([command.value], 0.16)
                syncState()
              }
            }
          })

          const boundaryBounds = registry.boundary.getBounds()
          try {
            if (boundaryBounds.isValid()) {
              map.fitBounds(boundaryBounds.pad(0.08))
            } else {
              map.setView([payload.center.lat, payload.center.lon], 13)
            }
          } catch (error) {
            map.setView([payload.center.lat, payload.center.lon], 13)
          }

          applyDistanceStyling()
          scheduleViewportRefresh(80)
          map.on('moveend zoomend', () => scheduleViewportRefresh())
          broadcast('twin:ready', { layers: visibleState })
          syncState()
        }).catch((error) => {
          document.getElementById('map').innerHTML = '<div class="floating-note"><strong>Could not load live public data.</strong><p class="hint">' + esc(error.message) + '</p></div>'
          broadcast('twin:error', { error: String(error?.message || 'MAP_LOAD_FAILED') })
        })
      </script>
  `
}
