export function renderCityCesiumSpatialRuntime() {
  return String.raw`        function featureCollection(features = []) {
          return { type: 'FeatureCollection', features: features.filter(Boolean) }
        }

        function getFeatures(collection) {
          return Array.isArray(collection?.features) ? collection.features : []
        }

        function getPrimitiveFeatures(payload) {
          return Array.isArray(payload?.features) ? payload.features : []
        }

        function firstCoordinate(geometry) {
          if (!geometry) return null
          if (geometry.type === 'Point') return geometry.coordinates
          if (geometry.type === 'LineString') return geometry.coordinates?.[0]
          if (geometry.type === 'Polygon') return geometry.coordinates?.[0]?.[0]
          if (geometry.type === 'MultiPolygon') return geometry.coordinates?.[0]?.[0]?.[0]
          if (geometry.type === 'MultiLineString') return geometry.coordinates?.[0]?.[0]
          return null
        }

        function flattenPositionsFromFeature(feature) {
          const positions = []
          const visit = (coords) => {
            if (!Array.isArray(coords)) return
            if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
              positions.push(Number(coords[0]), Number(coords[1]))
              return
            }
            coords.forEach(visit)
          }
          visit(feature?.geometry?.coordinates)
          return positions
        }

        function boundsFromGeojson(geojson) {
          let minLon = Infinity
          let minLat = Infinity
          let maxLon = -Infinity
          let maxLat = -Infinity
          getFeatures(geojson).forEach((feature) => {
            const values = flattenPositionsFromFeature(feature)
            for (let index = 0; index < values.length; index += 2) {
              const lon = values[index]
              const lat = values[index + 1]
              if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
              minLon = Math.min(minLon, lon)
              minLat = Math.min(minLat, lat)
              maxLon = Math.max(maxLon, lon)
              maxLat = Math.max(maxLat, lat)
            }
          })
          if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) return null
          return { minLon, minLat, maxLon, maxLat }
        }

        function geometryFromPrimitive(primitive = {}) {
          const geometry = primitive.geometry || {}
          const type = {
            point: 'Point',
            multiPoint: 'MultiPoint',
            lineString: 'LineString',
            multiLineString: 'MultiLineString',
            polygon: 'Polygon',
            multiPolygon: 'MultiPolygon',
          }[geometry.kind]
          if (!type || !Array.isArray(geometry.coordinates)) return null
          return { type, coordinates: geometry.coordinates }
        }

        function featureFromPrimitive(primitive = {}) {
          const geometry = geometryFromPrimitive(primitive)
          if (!geometry) return null
          return {
            type: 'Feature',
            properties: {
              ...(primitive.properties || {}),
              objectId: primitive.id || primitive.properties?.objectId || primitive.properties?.object_id || null,
              layerKey: primitive.layerKey || primitive.properties?.layerKey || 'features',
              semanticClass: primitive.semanticClass || primitive.properties?.semanticClass || primitive.layerKey || 'features',
              label: primitive.label || primitive.properties?.label || primitive.properties?.name || primitive.layerKey || 'City object',
            },
            geometry,
          }
        }

        function boundsFromPrimitives(primitives) {
          return boundsFromGeojson(featureCollection(getPrimitiveFeatures(primitives).map(featureFromPrimitive).filter(Boolean)))
        }

        function normalizedBounds(bounds) {
          const minLon = Number(bounds?.minLon ?? bounds?.west ?? bounds?.[0])
          const minLat = Number(bounds?.minLat ?? bounds?.south ?? bounds?.[1])
          const maxLon = Number(bounds?.maxLon ?? bounds?.east ?? bounds?.[2])
          const maxLat = Number(bounds?.maxLat ?? bounds?.north ?? bounds?.[3])
          if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) return null
          return {
            minLon: Math.min(minLon, maxLon),
            minLat: Math.min(minLat, maxLat),
            maxLon: Math.max(minLon, maxLon),
            maxLat: Math.max(minLat, maxLat),
          }
        }

        function expandBounds(current, next) {
          const bounds = normalizedBounds(next)
          if (!bounds) return current
          if (!current) return bounds
          return {
            minLon: Math.min(current.minLon, bounds.minLon),
            minLat: Math.min(current.minLat, bounds.minLat),
            maxLon: Math.max(current.maxLon, bounds.maxLon),
            maxLat: Math.max(current.maxLat, bounds.maxLat),
          }
        }

        function boundsFromRadiusScope(scope = {}) {
          if (!Array.isArray(scope.center) || Number(scope.radiusMeters) <= 0) return null
          const lon = Number(scope.center[0])
          const lat = Number(scope.center[1])
          const radiusMeters = Number(scope.radiusMeters)
          if (![lon, lat, radiusMeters].every(Number.isFinite)) return null
          const latDelta = radiusMeters / 111320
          const lonDelta = radiusMeters / Math.max(1, Math.cos(lat * Math.PI / 180) * 111320)
          return {
            minLon: lon - lonDelta,
            minLat: lat - latDelta,
            maxLon: lon + lonDelta,
            maxLat: lat + latDelta,
          }
        }

        function boundsFromScope(scope = {}) {
          if (scope.key === 'radius') return boundsFromRadiusScope(scope)
          if (scope.key === 'viewport' && Array.isArray(scope.bbox)) return normalizedBounds(scope.bbox)
          if (scope.key === 'customPolygon' && scope.geometry) {
            return boundsFromGeojson(featureCollection([{ type: 'Feature', properties: {}, geometry: scope.geometry }]))
          }
          if (scope.key === 'city') return boundsFromGeojson(payload?.layers?.boundary)
          return null
        }

        function boundsFromQueryScope(query = {}) {
          let bounds = null
          if (Array.isArray(query.clauses)) {
            query.clauses.forEach((clause) => {
              bounds = expandBounds(bounds, boundsFromScope(clause.scope))
            })
          }
          if (Array.isArray(query.scope?.clauses)) {
            query.scope.clauses.forEach((clause) => {
              bounds = expandBounds(bounds, boundsFromScope(clause.scope))
            })
          }
          return expandBounds(bounds, boundsFromScope(query.scope))
        }

        function padBounds(bounds, ratio = 0.12) {
          const normalized = normalizedBounds(bounds)
          if (!normalized) return null
          const lonSpan = Math.max(Math.abs(normalized.maxLon - normalized.minLon), 0.002)
          const latSpan = Math.max(Math.abs(normalized.maxLat - normalized.minLat), 0.002)
          return {
            minLon: normalized.minLon - lonSpan * ratio,
            minLat: normalized.minLat - latSpan * ratio,
            maxLon: normalized.maxLon + lonSpan * ratio,
            maxLat: normalized.maxLat + latSpan * ratio,
          }
        }

        function hasCityScope(query = {}) {
          if (query.scope?.key === 'city') return true
          if (Array.isArray(query.clauses) && query.clauses.some((clause) => clause.scope?.key === 'city')) return true
          if (Array.isArray(query.scope?.clauses) && query.scope.clauses.some((clause) => clause.scope?.key === 'city')) return true
          return false
        }

        function fitQuerySelection(message = {}, geojson = featureCollection([])) {
          const scopeBounds = boundsFromQueryScope(message.query || {})
          const summaryBounds = normalizedBounds(message.summary?.bounds)
          const renderedBounds = boundsFromPrimitives(message.primitives) || boundsFromGeojson(geojson)
          const shouldPreferCityScope = hasCityScope(message.query || {})
          const selectionBounds = shouldPreferCityScope
            ? (scopeBounds || summaryBounds || renderedBounds)
            : (summaryBounds || scopeBounds || renderedBounds)
          const bounds = padBounds(selectionBounds, shouldPreferCityScope ? 0.04 : 0.08)
          const terrainReading = isTerrainSurfaceMode(phenomenaMode)
          if (bounds) {
            moveCameraToBounds(bounds, {
              pitchDegrees: terrainReading ? -50 : -54,
              rangeMultiplier: terrainReading
                ? (shouldPreferCityScope ? 1.55 : 1.45)
                : (shouldPreferCityScope ? 1.12 : 1.28),
              minRange: terrainReading
                ? (shouldPreferCityScope ? 7000 : 1150)
                : 950,
            })
          }
        }`
}
