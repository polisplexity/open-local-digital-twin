export function renderMapLibreSourceRuntime() {
  return `
        function addBaseSources() {
          map.addSource('boundary', {
            type: 'geojson',
            data: payload.layers?.boundary || { type: 'FeatureCollection', features: [] },
          })
          map.addSource('unclassified', {
            type: 'geojson',
            data: payload.layers?.unclassifiedLand || { type: 'FeatureCollection', features: [] },
          })
          map.addSource('coverage-radius', {
            type: 'geojson',
            data: circlePolygon(cityCenter, radiusMetersForCoverage()),
          })
          map.addLayer({
            id: 'boundary-fill',
            type: 'fill',
            source: 'boundary',
            paint: {
              'fill-color': '#f59e0b',
              'fill-opacity': 0.055,
            },
            layout: { visibility: visibilityForKey('boundary') },
          })
          map.addLayer({
            id: 'unclassified-fill',
            type: 'fill',
            source: 'unclassified',
            paint: {
              'fill-color': '#fde68a',
              'fill-opacity': 0.13,
            },
            layout: { visibility: visibilityForKey('unclassifiedLand') },
          })
          map.addLayer({
            id: 'unclassified-line',
            type: 'line',
            source: 'unclassified',
            paint: {
              'line-color': '#b7791f',
              'line-width': 1.1,
              'line-dasharray': [4, 3],
              'line-opacity': 0.7,
            },
            layout: { visibility: visibilityForKey('unclassifiedLand') },
          })
          map.addLayer({
            id: 'coverage-radius-fill',
            type: 'fill',
            source: 'coverage-radius',
            paint: {
              'fill-color': '#0f766e',
              'fill-opacity': 0.045,
            },
          })
          map.addLayer({
            id: 'coverage-radius-line',
            type: 'line',
            source: 'coverage-radius',
            paint: {
              'line-color': '#0f766e',
              'line-width': 1,
              'line-dasharray': [2, 4],
              'line-opacity': 0.45,
            },
          })
          map.addLayer({
            id: 'boundary-line',
            type: 'line',
            source: 'boundary',
            paint: {
              'line-color': '#c46b2d',
              'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 13, 3, 17, 5],
              'line-opacity': 0.95,
            },
            layout: { visibility: visibilityForKey('boundary') },
          })
        }

        function emptyFeatureCollection() {
          return { type: 'FeatureCollection', features: [] }
        }

        function appendRadiusScopeFeature(features, scope, properties = {}) {
          if (!scope || scope.key !== 'radius' || !Array.isArray(scope.center) || Number(scope.radiusMeters) <= 0) return
          const circle = circlePolygon(scope.center, Number(scope.radiusMeters))
          const feature = circle?.features?.[0]
          if (!feature) return
          feature.properties = {
            ...(feature.properties || {}),
            ...properties,
            scopeKey: 'radius',
            radiusMeters: Number(scope.radiusMeters),
          }
          features.push(feature)
        }

        function semanticQueryRadiusCollection(query = {}) {
          const features = []
          appendRadiusScopeFeature(features, query.scope, {
            label: 'Query radius',
            clauseId: null,
            clauseLabel: 'Query radius',
          })
          ;(query.clauses || []).forEach((clause, index) => {
            appendRadiusScopeFeature(features, clause.scope, {
              label: clause.label || 'Clause ' + String(index + 1),
              clauseId: clause.id || null,
              clauseLabel: clause.label || 'Clause ' + String(index + 1),
            })
          })
          ;(query.scope?.clauses || []).forEach((clause, index) => {
            appendRadiusScopeFeature(features, clause.scope, {
              label: clause.label || 'Clause ' + String(index + 1),
              clauseId: clause.id || null,
              clauseLabel: clause.label || 'Clause ' + String(index + 1),
            })
          })
          const seen = new Set()
          return {
            type: 'FeatureCollection',
            features: features.filter((feature) => {
              const coordinates = feature.geometry?.coordinates?.[0]?.[0] || []
              const key = [
                feature.properties?.radiusMeters,
                Number(coordinates[0] || 0).toFixed(6),
                Number(coordinates[1] || 0).toFixed(6),
              ].join(':')
              if (seen.has(key)) return false
              seen.add(key)
              return true
            }),
          }
        }

        function semanticQuerySourceLayerConfig() {
          return semanticQueryVectorMode ? { 'source-layer': sourceLayerName } : {}
        }

        function removeSemanticQueryLayersAndSource() {
          semanticQueryLayerIds.forEach((id) => {
            if (map.getLayer(id)) map.removeLayer(id)
          })
          if (map.getSource(semanticQuerySourceId)) map.removeSource(semanticQuerySourceId)
        }

        function ensureSemanticQueryLayers() {
          if (!map || !mapReady) return
          if (!map.getSource(semanticQuerySourceId)) {
            if (semanticQueryVectorMode) {
              return
            } else {
              map.addSource(semanticQuerySourceId, {
                type: 'geojson',
                data: emptyFeatureCollection(),
              })
            }
          }
          if (!map.getLayer('twin-query-fill')) {
            map.addLayer({
              id: 'twin-query-fill',
              type: 'fill',
              source: semanticQuerySourceId,
              ...semanticQuerySourceLayerConfig(),
              filter: ['==', '$type', 'Polygon'],
              paint: {
                'fill-color': [
                  'match',
                  ['get', 'layerKey'],
                  'buildings', '#0891b2',
                  'greenBlue', '#0f766e',
                  'unclassifiedLand', '#f59e0b',
                  '#7c3aed',
                ],
                'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.18, 13, 0.28, 17, 0.42],
              },
              layout: { visibility: 'none' },
            })
          }
          if (!map.getLayer('twin-query-line')) {
            map.addLayer({
              id: 'twin-query-line',
              type: 'line',
              source: semanticQuerySourceId,
              ...semanticQuerySourceLayerConfig(),
              paint: {
                'line-color': [
                  'match',
                  ['get', 'layerKey'],
                  'roads', '#0e7490',
                  'buildings', '#164e63',
                  'greenBlue', '#047857',
                  'unclassifiedLand', '#b45309',
                  '#6d28d9',
                ],
                'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 13, 1.4, 17, 3.6],
                'line-opacity': 0.88,
              },
              layout: {
                visibility: 'none',
                'line-cap': 'round',
                'line-join': 'round',
              },
            })
          }
          if (!map.getLayer('twin-query-points')) {
            map.addLayer({
              id: 'twin-query-points',
              type: 'circle',
              source: semanticQuerySourceId,
              ...semanticQuerySourceLayerConfig(),
              filter: ['==', '$type', 'Point'],
              paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 1.3, 13, 2.5, 17, 5.5],
                'circle-color': [
                  'match',
                  ['get', 'layerKey'],
                  'places', '#475569',
                  'facilities', '#f59e0b',
                  'civic', '#0f766e',
                  'mobility', '#2563eb',
                  'commerce', '#7c3aed',
                  '#0891b2',
                ],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 15, 0.9],
                'circle-opacity': 0.78,
                'circle-stroke-opacity': 0.82,
              },
              layout: { visibility: 'none' },
            })
          }
          if (map.getLayer('boundary-line')) map.moveLayer('boundary-line')
          semanticQueryLayerIds.forEach((id) => {
            if (map.getLayer(id)) map.moveLayer(id)
          })
          applyMapVisualTheme()
        }

        function setSemanticQueryLayerVisibility(visible) {
          semanticQueryLayerIds.forEach((id) => {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
          })
        }

        function fitGeoJson(geojson) {
          let minLon = Infinity
          let minLat = Infinity
          let maxLon = -Infinity
          let maxLat = -Infinity
          ;(geojson?.features || []).forEach((feature) => {
            walkCoordinates(feature.geometry, (coordinate) => {
              minLon = Math.min(minLon, coordinate[0])
              minLat = Math.min(minLat, coordinate[1])
              maxLon = Math.max(maxLon, coordinate[0])
              maxLat = Math.max(maxLat, coordinate[1])
            })
          })
          if (!Number.isFinite(minLon)) return
          if (Math.abs(maxLon - minLon) < 0.00001 && Math.abs(maxLat - minLat) < 0.00001) {
            map.easeTo({ center: [minLon, minLat], zoom: Math.max(map.getZoom(), 15), duration: 320 })
            return
          }
          map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 54, maxZoom: 16, duration: 360 })
        }

        function boundsFeatureCollection(bounds, label = 'Query extent') {
          const minLon = Number(bounds?.minLon ?? bounds?.west ?? bounds?.[0])
          const minLat = Number(bounds?.minLat ?? bounds?.south ?? bounds?.[1])
          const maxLon = Number(bounds?.maxLon ?? bounds?.east ?? bounds?.[2])
          const maxLat = Number(bounds?.maxLat ?? bounds?.north ?? bounds?.[3])
          if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) {
            return emptyFeatureCollection()
          }
          if (Math.abs(maxLon - minLon) < 0.000001 && Math.abs(maxLat - minLat) < 0.000001) {
            return {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { label },
                  geometry: { type: 'Point', coordinates: [minLon, minLat] },
                },
              ],
            }
          }
          return {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { label },
                geometry: {
                  type: 'Polygon',
                  coordinates: [[
                    [minLon, minLat],
                    [maxLon, minLat],
                    [maxLon, maxLat],
                    [minLon, maxLat],
                    [minLon, minLat],
                  ]],
                },
              },
            ],
          }
        }

        function hasFeatures(collection) {
          return Array.isArray(collection?.features) && collection.features.length > 0
        }

        function fitSemanticQueryMessage(message, fallbackGeojson) {
          const boundsCollection = boundsFeatureCollection(message?.summary?.bounds, 'Query bounds')
          if (hasFeatures(boundsCollection)) {
            fitGeoJson(boundsCollection)
            return
          }
          const radiusCollection = semanticQueryRadiusCollection(message?.query || {})
          if (hasFeatures(radiusCollection)) {
            fitGeoJson(radiusCollection)
            return
          }
          if (String(message?.query?.scope?.key || '') === 'city') {
            fitBoundary()
            return
          }
          if (hasFeatures(fallbackGeojson)) {
            fitGeoJson(fallbackGeojson)
          }
        }

        function setSemanticQueryResult(message) {
          if (!map || !mapReady) return
          const geojson = message?.geojson || emptyFeatureCollection()
          const returned = Number(message?.summary?.returned ?? geojson.features?.length ?? 0)
          const resultCount = Number(message?.summary?.resultCount ?? returned)
          const tileTemplate = String(message?.links?.vectorTileTemplate || message?.vectorTileTemplate || '')
          if (tileTemplate) {
            removeSemanticQueryLayersAndSource()
            semanticQueryVectorMode = true
            map.addSource(semanticQuerySourceId, {
              type: 'vector',
              tiles: [tileTemplate],
              minzoom: 0,
              maxzoom: 20,
            })
            ensureSemanticQueryLayers()
            const mode = String(message?.query?.render?.mode || 'isolate')
            semanticQueryActive = mode === 'isolate'
            const radiusSource = map.getSource('coverage-radius')
            if (radiusSource) {
              radiusSource.setData(semanticQueryRadiusCollection(message?.query || {}))
            }
            updateFixedLayerVisibility()
            updateFeatureLayerVisibility()
            setSemanticQueryLayerVisibility(resultCount > 0)
            if (resultCount > 0) fitSemanticQueryMessage(message, geojson)
            const statusLabel = String(resultCount.toLocaleString('en-US')) + ' query results as tiles'
            setTileStatus(statusLabel, false)
            broadcast('twin:viewport', {
              mode: 'semantic-query-tiles',
              label: statusLabel,
              returned: resultCount,
              truncated: false,
            })
            return
          }
          if (semanticQueryVectorMode) {
            removeSemanticQueryLayersAndSource()
            semanticQueryVectorMode = false
          }
          const mode = String(message?.query?.render?.mode || 'isolate')
          semanticQueryActive = mode === 'isolate'
          const radiusSource = map.getSource('coverage-radius')
          if (radiusSource) {
            radiusSource.setData(semanticQueryRadiusCollection(message?.query || {}))
          }
          updateFixedLayerVisibility()
          updateFeatureLayerVisibility()
          setSemanticQueryLayerVisibility(false)
          if (resultCount > 0) fitSemanticQueryMessage(message, geojson)
          const statusLabel = resultCount > 0 ? 'Query tile transport unavailable' : 'No query results'
          setTileStatus(statusLabel, false)
          broadcast('twin:viewport', {
            mode: 'semantic-query-metadata',
            label: statusLabel,
            returned: 0,
            resultCount,
            truncated: false,
          })
        }

        function clearSemanticQueryResult() {
          if (!map || !mapReady) return
          if (semanticQueryVectorMode) {
            removeSemanticQueryLayersAndSource()
            semanticQueryVectorMode = false
          }
          ensureSemanticQueryLayers()
          const source = map.getSource(semanticQuerySourceId)
          if (source?.setData) source.setData(emptyFeatureCollection())
          const radiusSource = map.getSource('coverage-radius')
          if (radiusSource) radiusSource.setData(circlePolygon(cityCenter, radiusMetersForCoverage()))
          semanticQueryActive = false
          setSemanticQueryLayerVisibility(false)
          updateFixedLayerVisibility()
          updateFeatureLayerVisibility()
          broadcast('twin:viewport', {
            mode: 'tiles',
            label: scaleState.coveragePercent > 0
              ? String(Math.round(scaleState.coveragePercent)) + '% city radius active'
              : 'No city radius loaded',
            returned: null,
            truncated: false,
          })
        }

        function removeFeatureSource() {
          featureLayerIds.forEach((id) => {
            if (map.getLayer(id)) map.removeLayer(id)
          })
          if (map.getSource(viewportSourceId)) map.removeSource(viewportSourceId)
        }

        function addFeatureLayers() {
          map.addLayer({
            id: 'twin-green-fill',
            type: 'fill',
            source: viewportSourceId,
            'source-layer': sourceLayerName,
            filter: ['==', ['get', 'layerKey'], 'greenBlue'],
            paint: {
              'fill-color': [
                'match',
                ['get', 'category'],
                'water', '#7dd3fc',
                'river', '#7dd3fc',
                'stream', '#bae6fd',
                'forest', '#86efac',
                'wood', '#86efac',
                'park', '#bbf7d0',
                'garden', '#dcfce7',
                'wetland', '#99f6e4',
                '#d9f99d',
              ],
              'fill-opacity': 0.22,
            },
            layout: { visibility: visibilityForKey('greenBlue') },
          })
          map.addLayer({
            id: 'twin-green-line',
            type: 'line',
            source: viewportSourceId,
            'source-layer': sourceLayerName,
            filter: ['==', ['get', 'layerKey'], 'greenBlue'],
            paint: {
              'line-color': '#0f766e',
              'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 13, 1.1, 17, 2],
              'line-opacity': 0.58,
            },
            layout: { visibility: visibilityForKey('greenBlue') },
          })
          map.addLayer({
            id: 'twin-buildings-fill',
            type: 'fill',
            source: viewportSourceId,
            'source-layer': sourceLayerName,
            filter: ['==', ['get', 'layerKey'], 'buildings'],
            paint: {
              'fill-color': '#6f8296',
              'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.2, 12, 0.3, 17, 0.48],
            },
            layout: { visibility: visibilityForKey('buildings') },
          })
          map.addLayer({
            id: 'twin-buildings-line',
            type: 'line',
            source: viewportSourceId,
            'source-layer': sourceLayerName,
            filter: ['==', ['get', 'layerKey'], 'buildings'],
            paint: {
              'line-color': '#41576d',
              'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.35, 12, 0.75, 17, 1.35],
              'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.55, 12, 0.75, 17, 0.9],
            },
            layout: { visibility: visibilityForKey('buildings') },
          })
          map.addLayer({
            id: 'twin-roads',
            type: 'line',
            source: viewportSourceId,
            'source-layer': sourceLayerName,
            filter: ['==', ['get', 'layerKey'], 'roads'],
            paint: {
              'line-color': [
                'match',
                ['get', 'highway'],
                'primary', '#0f766e',
                'secondary', '#0f766e',
                'tertiary', '#0369a1',
                'service', '#7c3aed',
                '#516274',
              ],
              'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.45, 12, 0.9, 15, 2.1, 18, 4.4],
              'line-opacity': 0.82,
            },
            layout: {
              visibility: visibilityForKey('roads'),
              'line-cap': 'round',
              'line-join': 'round',
            },
          })
          map.addLayer({
            id: 'twin-places',
            type: 'circle',
            source: viewportSourceId,
            'source-layer': sourceLayerName,
            filter: ['==', ['get', 'layerKey'], 'places'],
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 13, 2.4, 17, 5.2],
              'circle-color': '#475569',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 0.2, 15, 0.8],
              'circle-opacity': 0.62,
              'circle-stroke-opacity': 0.72,
            },
            layout: { visibility: visibilityForKey('places') },
          })
          map.addLayer({
            id: 'twin-facilities',
            type: 'circle',
            source: viewportSourceId,
            'source-layer': sourceLayerName,
            filter: ['in', ['get', 'layerKey'], ['literal', ['facilities', 'civic', 'mobility', 'commerce', 'wasteSeeds']]],
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 1.1, 13, 2.2, 17, 5],
              'circle-color': [
                'match',
                ['get', 'category'],
                'waste_basket', '#f59e0b',
                'waste_disposal', '#f59e0b',
                'recycling', '#f59e0b',
                'parking', '#2563eb',
                'bicycle_parking', '#2563eb',
                'charging_station', '#2563eb',
                'school', '#0f766e',
                'kindergarten', '#0f766e',
                'hospital', '#0f766e',
                'clinic', '#0f766e',
                '#7c3aed',
              ],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 0.2, 15, 0.9],
              'circle-opacity': 0.68,
              'circle-stroke-opacity': 0.78,
            },
            layout: { visibility: visibilityForKey('facilities') },
          })
          if (map.getLayer('boundary-line')) {
            map.moveLayer('boundary-line')
          }
          semanticQueryLayerIds.forEach((id) => {
            if (map.getLayer(id)) map.moveLayer(id)
          })
          applyMapVisualTheme()
        }

        function updateFixedLayerVisibility() {
          if (!map || !mapReady) return
          const visibility = {
            'boundary-fill': visibilityForKey('boundary'),
            'boundary-line': visibilityForKey('boundary'),
            'unclassified-fill': semanticQueryActive ? 'none' : visibilityForKey('unclassifiedLand'),
            'unclassified-line': semanticQueryActive ? 'none' : visibilityForKey('unclassifiedLand'),
          }
          Object.entries(visibility).forEach(([id, value]) => {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', value)
          })
          const radiusSource = map.getSource('coverage-radius')
          if (radiusSource && !semanticQueryActive) radiusSource.setData(circlePolygon(cityCenter, radiusMetersForCoverage()))
        }

        function updateFeatureLayerVisibility() {
          if (!map || !mapReady) return
          if (semanticQueryActive) {
            featureLayerIds.forEach((id) => {
              if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none')
            })
            return
          }
          const visibility = {
            'twin-green-fill': visibilityForKey('greenBlue'),
            'twin-green-line': visibilityForKey('greenBlue'),
            'twin-buildings-fill': visibilityForKey('buildings'),
            'twin-buildings-line': visibilityForKey('buildings'),
            'twin-roads': visibilityForKey('roads'),
            'twin-places': visibilityForKey('places'),
            'twin-facilities': visibilityForKey('facilities'),
          }
          Object.entries(visibility).forEach(([id, value]) => {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', value)
          })
        }

        function rebuildFeatureSource(reason = 'view change') {
          if (!map || !mapReady) return
          window.clearTimeout(pendingSourceTimer)
          const nextUrl = tileUrl()
          removeFeatureSource()
          if (!nextUrl) {
            setSourceLoading(false, 'No radius loaded')
            broadcast('twin:state', { layers: layerState })
            return
          }
          sourceRevision += 1
          const revision = sourceRevision
          setSourceLoading(true, 'Loading radius tiles')
          map.addSource(viewportSourceId, {
            type: 'vector',
            tiles: [nextUrl],
            minzoom: 0,
            maxzoom: 20,
          })
          addFeatureLayers()
          updateFeatureLayerVisibility()
          const requestedPercent = Math.round(scaleState.coveragePercent)
          map.once('idle', () => {
            if (revision !== sourceRevision) return
            window.clearTimeout(pendingSourceTimer)
            setSourceLoading(false, 'Radius tiles ready')
            broadcast('twin:viewport', {
              mode: 'tiles',
              label: requestedPercent + '% city radius active',
              returned: null,
              truncated: false,
            })
          })
          pendingSourceTimer = window.setTimeout(() => {
            if (revision !== sourceRevision) return
            setSourceLoading(false, 'Radius tiles active')
            broadcast('twin:viewport', {
              mode: 'tiles',
              label: requestedPercent + '% city radius active',
              returned: null,
              truncated: false,
            })
          }, 1800)
          broadcast('twin:state', { layers: layerState })
        }

        function scheduleFeatureRebuild(reason, delay = 80) {
          window.clearTimeout(pendingSourceTimer)
          pendingSourceTimer = window.setTimeout(() => rebuildFeatureSource(reason), delay)
        }


  `
}
