export function renderMapLibreLayerModelRuntime() {
  return `
        function hasVisibleFacilityLayer() {
          return Array.from(facilityKeys).some((key) => Boolean(layerState[key]))
        }

        function apiLayerKeys() {
          const keys = []
          if (layerState.roads) keys.push('roads')
          if (layerState.buildings) keys.push('buildings')
          if (layerState.greenBlue) keys.push('greenBlue')
          if (layerState.places) keys.push('places')
          Array.from(facilityKeys).forEach((key) => {
            if (key !== 'facilities' && layerState[key]) keys.push(key)
          })
          return Array.from(new Set(keys))
        }

        function detailForLayer(key) {
          const detail = Number(layerControlState[key]?.detail ?? 50)
          return clamp(detail, 0, 100) / 100
        }

        function strongestDetail() {
          const keys = ['roads', 'buildings', 'greenBlue', 'places', 'facilities', 'civic', 'mobility', 'commerce', 'wasteSeeds']
          return keys.reduce((max, key) => Math.max(max, detailForLayer(key)), 0.5)
        }

        function tileLimit() {
          const coverage = clamp(scaleState.coveragePercent, 0, 100)
          const detail = strongestDetail()
          const requestedLimit = Number(scaleState.featureLimit || 0)
          const adaptiveLimit = 8000 + coverage * 920
          const base = requestedLimit > 0
            ? Math.min(requestedLimit, adaptiveLimit)
            : adaptiveLimit
          return Math.round(clamp(base * (0.8 + detail * 0.6), 1000, 300000))
        }

        function tileUrl() {
          const layers = apiLayerKeys()
          if (!layers.length || scaleState.coveragePercent <= 0) return ''
          const params = new URLSearchParams()
          params.set('layers', layers.join(','))
          params.set('limit', String(tileLimit()))
          if (scaleState.coveragePercent < 100) {
            params.set('center', cityCenter[0].toFixed(7) + ',' + cityCenter[1].toFixed(7))
            params.set('radiusMeters', String(Math.round(radiusMetersForCoverage())))
          }
          return window.location.origin + '/api/live/' + encodeURIComponent(cityId) + '/tiles/{z}/{x}/{y}.mvt?' + params.toString()
        }

        function radiusBbox() {
          const radiusMeters = radiusMetersForCoverage()
          if (!radiusMeters || radiusMeters <= 0) return null
          const lat = cityCenter[1]
          const lon = cityCenter[0]
          const latDelta = radiusMeters / 111320
          const lonDelta = radiusMeters / (111320 * Math.max(0.08, Math.cos(lat * Math.PI / 180)))
          return [
            lon - lonDelta,
            lat - latDelta,
            lon + lonDelta,
            lat + latDelta,
          ]
        }

        function featureWindowUrl() {
          const layers = apiLayerKeys()
          const bbox = radiusBbox()
          if (!layers.length || !bbox || scaleState.coveragePercent <= 0) return ''
          const params = new URLSearchParams()
          params.set('layers', layers.join(','))
          params.set('limit', String(tileLimit()))
          params.set('bbox', bbox.map((value) => value.toFixed(7)).join(','))
          params.set('center', cityCenter[0].toFixed(7) + ',' + cityCenter[1].toFixed(7))
          params.set('radiusMeters', String(Math.round(radiusMetersForCoverage())))
          return '/api/live/' + encodeURIComponent(cityId) + '/features?' + params.toString()
        }

        function visibilityForKey(key) {
          if (key === 'facilities') return hasVisibleFacilityLayer() ? 'visible' : 'none'
          return layerState[key] ? 'visible' : 'none'
        }

        function mapLayerDefinitions(payload) {
          return (payload?.inventory?.layerDefinitions || [])
            .filter((definition) => definition.key !== 'center')
            .filter((definition) => layerAllowed(definition.key))
        }

        function seedLayerState(payload) {
          mapLayerDefinitions(payload).forEach((definition) => {
            layerState[definition.key] = Boolean(definition.visibleByDefault)
          })
        }

        function featureMeta(layerKey) {
          const definitions = mapLayerDefinitions(payload)
          return definitions.find((definition) => definition.key === layerKey) ||
            definitions.find((definition) => definition.key === 'buildings') ||
            { label: layerKey, description: 'City feature' }
        }


  `
}
