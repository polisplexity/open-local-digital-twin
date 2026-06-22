export function renderMapLibreGeometryRuntime() {
  return `
        function walkCoordinates(geometry, callback) {
          if (!geometry) return
          const type = geometry.type
          const coordinates = geometry.coordinates
          if (!coordinates) return
          if (type === 'Point') {
            callback(coordinates)
            return
          }
          const visit = (value) => {
            if (!Array.isArray(value)) return
            if (typeof value[0] === 'number' && typeof value[1] === 'number') {
              callback(value)
              return
            }
            value.forEach(visit)
          }
          visit(coordinates)
        }

        function distanceMeters(a, b) {
          const radius = 6371008.8
          const lat1 = a[1] * Math.PI / 180
          const lat2 = b[1] * Math.PI / 180
          const dLat = (b[1] - a[1]) * Math.PI / 180
          const dLon = (b[0] - a[0]) * Math.PI / 180
          const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
          return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
        }

        function calculateMaxRadius(center, boundary) {
          let maxDistance = 1000
          const bounds = Array.isArray(payload?.bounds) ? payload.bounds.map(Number) : null
          if (bounds && bounds.length === 4 && bounds.every(Number.isFinite) && bounds[0] < bounds[2] && bounds[1] < bounds[3]) {
            ;[[bounds[0], bounds[1]], [bounds[0], bounds[3]], [bounds[2], bounds[1]], [bounds[2], bounds[3]]].forEach((coordinate) => {
              maxDistance = Math.max(maxDistance, distanceMeters(center, coordinate))
            })
            return Math.max(1000, maxDistance * 1.04)
          }
          ;(boundary?.features || []).forEach((feature) => {
            walkCoordinates(feature.geometry, (coordinate) => {
              maxDistance = Math.max(maxDistance, distanceMeters(center, coordinate))
            })
          })
          return Math.max(1000, maxDistance * 1.04)
        }

        function radiusMetersForCoverage() {
          const coverage = clamp(scaleState.coveragePercent, 0, 100)
          if (coverage <= 0) return 0
          if (coverage >= 100) return maxCityRadiusMeters
          return maxCityRadiusMeters * (coverage / 100)
        }

        function circlePolygon(center, radiusMeters, steps = 96) {
          if (!radiusMeters || radiusMeters <= 0) {
            return { type: 'FeatureCollection', features: [] }
          }
          const earthRadius = 6371008.8
          const lon = center[0] * Math.PI / 180
          const lat = center[1] * Math.PI / 180
          const angular = radiusMeters / earthRadius
          const ring = []
          for (let i = 0; i <= steps; i += 1) {
            const bearing = (i / steps) * Math.PI * 2
            const pointLat = Math.asin(
              Math.sin(lat) * Math.cos(angular) +
                Math.cos(lat) * Math.sin(angular) * Math.cos(bearing),
            )
            const pointLon = lon + Math.atan2(
              Math.sin(bearing) * Math.sin(angular) * Math.cos(lat),
              Math.cos(angular) - Math.sin(lat) * Math.sin(pointLat),
            )
            ring.push([pointLon * 180 / Math.PI, pointLat * 180 / Math.PI])
          }
          return {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { label: 'Visible city radius' },
                geometry: { type: 'Polygon', coordinates: [ring] },
              },
            ],
          }
        }

        function featureReachPercent(collection) {
          let maxDistance = 0
          ;(collection?.features || []).forEach((feature) => {
            walkCoordinates(feature.geometry, (coordinate) => {
              maxDistance = Math.max(maxDistance, distanceMeters(cityCenter, coordinate))
            })
          })
          if (!maxCityRadiusMeters || maxCityRadiusMeters <= 0) return 0
          return Math.round(clamp((maxDistance / maxCityRadiusMeters) * 100, 0, 100))
        }

        function payloadBounds() {
          const bounds = Array.isArray(payload?.bounds) ? payload.bounds.map(Number) : null
          if (!bounds || bounds.length !== 4 || bounds.some((value) => !Number.isFinite(value))) return null
          if (bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) return null
          return bounds
        }

        function fitBoundary() {
          if (!map) return
          const dataBounds = payloadBounds()
          if (dataBounds) {
            map.fitBounds([[dataBounds[0], dataBounds[1]], [dataBounds[2], dataBounds[3]]], { padding: 58, maxZoom: 13, duration: 0 })
            return
          }
          if (!payload?.layers?.boundary?.features?.length) {
            map.setCenter(cityCenter)
            map.setZoom(11)
            return
          }
          let minLon = Infinity
          let minLat = Infinity
          let maxLon = -Infinity
          let maxLat = -Infinity
          payload.layers.boundary.features.forEach((feature) => {
            walkCoordinates(feature.geometry, (coordinate) => {
              minLon = Math.min(minLon, coordinate[0])
              minLat = Math.min(minLat, coordinate[1])
              maxLon = Math.max(maxLon, coordinate[0])
              maxLat = Math.max(maxLat, coordinate[1])
            })
          })
          if (!Number.isFinite(minLon)) {
            map.setCenter(cityCenter)
            map.setZoom(11)
            return
          }
          map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 34, duration: 0 })
        }


  `
}
