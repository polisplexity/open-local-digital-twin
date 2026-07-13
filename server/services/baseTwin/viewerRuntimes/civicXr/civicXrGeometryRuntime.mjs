export function renderCivicXrGeometryRuntime() {
  return `
        function featureCollection(features = []) {
          return { type: 'FeatureCollection', features: Array.isArray(features) ? features : [] }
        }

        function getFeatures(collection) {
          return Array.isArray(collection?.features) ? collection.features.filter((feature) => feature?.geometry) : []
        }

        function isCoordinate(value) {
          return Array.isArray(value) &&
            value.length >= 2 &&
            Number.isFinite(Number(value[0])) &&
            Number.isFinite(Number(value[1]))
        }

        function walkCoordinates(value, callback) {
          if (!Array.isArray(value)) return
          if (isCoordinate(value)) {
            callback([Number(value[0]), Number(value[1])])
            return
          }
          value.forEach((entry) => walkCoordinates(entry, callback))
        }

        function geometryCoordinates(geometry = {}) {
          const coords = []
          walkCoordinates(geometry.coordinates, (coordinate) => coords.push(coordinate))
          return coords
        }

        function coordinateBounds(coords = []) {
          let minLon = Infinity
          let maxLon = -Infinity
          let minLat = Infinity
          let maxLat = -Infinity
          coords.forEach((coordinate) => {
            const lon = Number(coordinate?.[0])
            const lat = Number(coordinate?.[1])
            if (!Number.isFinite(lon) || !Number.isFinite(lat)) return
            if (lon < minLon) minLon = lon
            if (lon > maxLon) maxLon = lon
            if (lat < minLat) minLat = lat
            if (lat > maxLat) maxLat = lat
          })
          if (![minLon, maxLon, minLat, maxLat].every(Number.isFinite)) return null
          return {
            minLon,
            maxLon,
            minLat,
            maxLat,
            centerLon: (minLon + maxLon) / 2,
            centerLat: (minLat + maxLat) / 2,
          }
        }

        function geometryBounds(geometry = {}) {
          const coords = geometryCoordinates(geometry)
          if (!coords.length) return null
          return coordinateBounds(coords)
        }

        function boundsFromFeatures(features = []) {
          const coords = []
          features.forEach((feature) => geometryCoordinates(feature.geometry).forEach((coordinate) => coords.push(coordinate)))
          if (!coords.length) return null
          return coordinateBounds(coords)
        }

        function createProjector(features = [], fallbackCenter = null) {
          const bounds = boundsFromFeatures(features) || fallbackCenter || { centerLon: 0, centerLat: 0, minLon: 0, maxLon: 0.01, minLat: 0, maxLat: 0.01 }
          const centerLon = finiteNumber(bounds.centerLon)
          const centerLat = finiteNumber(bounds.centerLat)
          const lonScale = Math.max(0.1, Math.cos(centerLat * Math.PI / 180) * 111320)
          const latScale = 110540
          const widthMeters = Math.max(1, Math.abs(finiteNumber(bounds.maxLon) - finiteNumber(bounds.minLon)) * lonScale)
          const depthMeters = Math.max(1, Math.abs(finiteNumber(bounds.maxLat) - finiteNumber(bounds.minLat)) * latScale)
          const sceneSpan = clamp(Math.max(widthMeters, depthMeters), 60, 18000)
          const scale = clamp(118 / sceneSpan, 0.006, 4.2)
          return {
            bounds,
            scale,
            toScene(coordinate) {
              const lon = Number(coordinate?.[0])
              const lat = Number(coordinate?.[1])
              return {
                x: (Number.isFinite(lon) ? (lon - centerLon) * lonScale * scale : 0),
                z: (Number.isFinite(lat) ? -(lat - centerLat) * latScale * scale : 0),
              }
            },
          }
        }

        function featureLayerKey(feature = {}) {
          const properties = feature.properties || feature
          const direct = properties.layerKey || properties.layer_key || properties.queryLayerKey || properties.query_layer_key || properties.displayLayerKey
          if (direct) {
            if (direct === 'facilities') return 'civic'
            if (direct === 'unclassifiedLand') return 'greenBlue'
            return String(direct)
          }
          const semanticClass = String(properties.semanticClass || properties.semantic_class || properties.featureType || properties.type || '').toLowerCase()
          if (semanticClass.includes('building')) return 'buildings'
          if (semanticClass.includes('road') || semanticClass.includes('street')) return 'roads'
          if (semanticClass.includes('green') || semanticClass.includes('blue') || semanticClass.includes('water') || semanticClass.includes('park') || semanticClass.includes('land')) return 'greenBlue'
          if (semanticClass.includes('mobility')) return 'mobility'
          if (semanticClass.includes('commerce')) return 'commerce'
          if (semanticClass.includes('waste')) return 'wasteSeeds'
          if (semanticClass.includes('place')) return 'places'
          if (semanticClass.includes('civic') || semanticClass.includes('facility')) return 'civic'
          return 'features'
        }

        function featureLabel(feature = {}) {
          const properties = feature.properties || {}
          return properties.label || properties.name || properties.objectId || properties.object_id || properties.stableId || properties.stable_id || feature.id || featureLayerKey(feature)
        }

        function featureSource(feature = {}) {
          const properties = feature.properties || {}
          return properties.provider || properties.source || properties.sourceName || properties.source_name || properties.confidence || 'open-data'
        }

        function heightForFeature(feature = {}, index = 0) {
          const properties = feature.properties || {}
          const rawHeight = properties.heightMeters ?? properties.height_meters ?? properties.height_m ?? properties.height ?? properties.renderHeight
          const parsedHeight = Number(String(rawHeight ?? '').replace(/[^0-9.]+/g, ''))
          if (Number.isFinite(parsedHeight) && parsedHeight > 0) return clamp(parsedHeight * 0.32, 1.4, 42)
          const floors = Number(properties.floors ?? properties.levels ?? properties['building:levels'])
          if (Number.isFinite(floors) && floors > 0) return clamp(floors * 1.1, 1.4, 42)
          return clamp(3.2 + (index % 7) * 0.9, 2.6, 12)
        }

        function polygonRings(geometry = {}) {
          if (geometry.type === 'Polygon') return geometry.coordinates || []
          if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flat()
          return []
        }

        function lineStrings(geometry = {}) {
          if (geometry.type === 'LineString') return [geometry.coordinates || []]
          if (geometry.type === 'MultiLineString') return geometry.coordinates || []
          return []
        }

        function pointCoordinates(geometry = {}) {
          if (geometry.type === 'Point') return [geometry.coordinates]
          if (geometry.type === 'MultiPoint') return geometry.coordinates || []
          return []
        }

        function sampleFeatures(features = [], limit = Number.MAX_SAFE_INTEGER) {
          const normalizedLimit = Number(limit)
          if (!Number.isFinite(normalizedLimit) || normalizedLimit <= 0 || features.length <= normalizedLimit) return features
          const stride = Math.max(1, Math.ceil(features.length / normalizedLimit))
          return features.filter((_, index) => index % stride === 0).slice(0, normalizedLimit)
        }

        function sceneModelFromGeojson(geojson, summary = {}, options = {}) {
          const allFeatures = getFeatures(geojson)
          const featuresByLayer = allFeatures.reduce((groups, feature) => {
            const key = featureLayerKey(feature)
            if (!groups[key]) groups[key] = []
            groups[key].push(feature)
            return groups
          }, {})
          const projector = createProjector(allFeatures)
          const limits = options.limits || QUERY_SCENE_LIMITS
          const model = {
            source: options.source || 'query',
            title: options.title || 'TwinQL civic scene',
            detail: options.detail || 'Query selection rendered as an XR tabletop.',
            renderedFeatureCount: 0,
            totalFeatureCount: Number(summary.resultCount ?? summary.total ?? allFeatures.length),
            boundary: [],
            roads: [],
            areas: [],
            buildings: [],
            anchors: {
              civic: [],
              mobility: [],
              commerce: [],
              wasteSeeds: [],
              places: [],
              features: [],
            },
          }

          sampleFeatures(featuresByLayer.boundary || [], limits.boundary).forEach((feature) => {
            polygonRings(feature.geometry).slice(0, 2).forEach((ring) => {
              const projected = ring.map((coordinate) => projector.toScene(coordinate)).filter(Boolean)
              if (projected.length > 1) model.boundary.push([...projected, projected[0]].filter(Boolean))
            })
            model.renderedFeatureCount += 1
          })

          sampleFeatures(featuresByLayer.roads || [], limits.roads).forEach((feature) => {
            lineStrings(feature.geometry).forEach((line) => {
              const projected = line.map((coordinate) => projector.toScene(coordinate)).filter(Boolean)
              if (projected.length > 1) model.roads.push(projected)
            })
            model.renderedFeatureCount += 1
          })

          sampleFeatures(featuresByLayer.buildings || [], limits.buildings).forEach((feature, index) => {
            const bounds = geometryBounds(feature.geometry)
            if (!bounds) return
            const a = projector.toScene([bounds.minLon, bounds.minLat])
            const b = projector.toScene([bounds.maxLon, bounds.maxLat])
            const center = projector.toScene([bounds.centerLon, bounds.centerLat])
            const properties = feature.properties || {}
            model.buildings.push({
              x: center.x,
              z: center.z,
              width: Math.max(0.75, Math.abs(a.x - b.x)),
              depth: Math.max(0.75, Math.abs(a.z - b.z)),
              height: heightForFeature(feature, index),
              label: featureLabel(feature),
              source: featureSource(feature),
              renderStyle: properties.renderStyle && typeof properties.renderStyle === 'object' ? properties.renderStyle : null,
              heightMeters: properties.heightMeters ?? properties.height_meters ?? properties.height_m ?? properties.height ?? null,
              floors: properties.floors ?? properties.levels ?? properties['building:levels'] ?? null,
              footprintAreaM2: properties.footprintAreaM2 ?? properties.footprint_area_m2 ?? null,
              buildingType: properties.buildingType ?? properties.building_type ?? properties.building ?? null,
              provider: properties.provider ?? properties.source ?? properties.sourceName ?? properties.source_name ?? null,
              sourceFamily: properties.sourceFamily ?? properties.source_family ?? properties.source_format ?? properties.sourceFormat ?? null,
              confidence: properties.confidence ?? null,
              sourceCoverageStatus: properties.sourceCoverageStatus ?? properties.source_coverage_status ?? null,
            })
            model.renderedFeatureCount += 1
          })

          sampleFeatures(featuresByLayer.greenBlue || [], limits.greenBlue).forEach((feature) => {
            const bounds = geometryBounds(feature.geometry)
            if (!bounds) return
            const a = projector.toScene([bounds.minLon, bounds.minLat])
            const b = projector.toScene([bounds.maxLon, bounds.maxLat])
            const center = projector.toScene([bounds.centerLon, bounds.centerLat])
            model.areas.push({
              layerKey: 'greenBlue',
              x: center.x,
              z: center.z,
              width: Math.max(1.2, Math.abs(a.x - b.x)),
              depth: Math.max(1.2, Math.abs(a.z - b.z)),
              label: featureLabel(feature),
              source: featureSource(feature),
            })
            polygonRings(feature.geometry).slice(0, 1).forEach((ring) => {
              const projected = ring.map((coordinate) => projector.toScene(coordinate)).filter(Boolean)
              if (projected.length > 1) model.areas.push({ layerKey: 'greenBlueOutline', points: [...projected, projected[0]].filter(Boolean) })
            })
            model.renderedFeatureCount += 1
          })

          ;['civic', 'mobility', 'commerce', 'wasteSeeds', 'places', 'features'].forEach((layerKey) => {
            sampleFeatures(featuresByLayer[layerKey] || [], limits[layerKey]).forEach((feature) => {
              let coordinate = pointCoordinates(feature.geometry)[0]
              if (!coordinate) {
                const bounds = geometryBounds(feature.geometry)
                if (bounds) coordinate = [bounds.centerLon, bounds.centerLat]
              }
              if (!coordinate) return
              const point = projector.toScene(coordinate)
              model.anchors[layerKey].push({
                x: point.x,
                z: point.z,
                label: featureLabel(feature),
                source: featureSource(feature),
              })
              model.renderedFeatureCount += 1
            })
          })

          return model
        }

        function geojsonFromPrimitives(primitives = {}) {
          const features = (primitives.features || []).map((feature) => {
            const geometry = feature.geometry || {}
            const type = {
              point: 'Point',
              multiPoint: 'MultiPoint',
              lineString: 'LineString',
              multiLineString: 'MultiLineString',
              polygon: 'Polygon',
              multiPolygon: 'MultiPolygon',
            }[geometry.kind]
            if (!type || !Array.isArray(geometry.coordinates)) return null
            return {
              type: 'Feature',
              id: feature.id,
              properties: {
                ...(feature.properties || {}),
                layerKey: feature.layerKey,
                semanticClass: feature.semanticClass,
                label: feature.label,
              },
              geometry: {
                type,
                coordinates: geometry.coordinates,
              },
            }
          }).filter(Boolean)
          return featureCollection(features)
        }

        function geojsonFromSceneManifest(sceneManifest = {}) {
          const geometryTypes = {
            point: 'Point',
            multiPoint: 'MultiPoint',
            lineString: 'LineString',
            multiLineString: 'MultiLineString',
            polygon: 'Polygon',
            multiPolygon: 'MultiPolygon',
          }
          const objects = Array.isArray(sceneManifest.objects) ? sceneManifest.objects : []
          const features = objects.map((object) => {
            const geometry = object.geometry || {}
            const type = geometryTypes[geometry.kind]
            if (!type || !Array.isArray(geometry.coordinates)) return null
            return {
              type: 'Feature',
              id: object.objectId || object.id || object.stableId,
              properties: {
                ...(object.properties || {}),
                ...(object.render || {}),
                objectId: object.objectId || object.id,
                stableId: object.stableId || object.objectId || object.id,
                layerKey: object.layerKey,
                semanticClass: object.semanticClass,
                label: object.label,
                authorityStatus: object.authorityStatus,
                sourceCoverageStatus: object.sourceCoverageStatus,
                provider: object.provider,
                clauseId: object.clauseId,
                clauseLabel: object.clauseLabel,
              },
              geometry: {
                type,
                coordinates: geometry.coordinates,
              },
            }
          }).filter(Boolean)
          return featureCollection(features)
        }

        function sceneModelFromSceneManifest(sceneManifest = {}, summary = {}) {
          return sceneModelFromGeojson(geojsonFromSceneManifest(sceneManifest), summary || sceneManifest.summary || {}, {
            source: 'scene-manifest',
            title: 'Civic XR selection scene',
            detail: 'TwinQL scene manifest rendered as an inspectable civic tabletop.',
          })
        }

        function sceneModelFromPayload(payload) {
          const sceneData = payload.scene || {}
          const model = {
            source: 'base-preview',
            title: 'Civic base scene',
            detail: 'Open city inventory arranged as a public tabletop scene.',
            renderedFeatureCount: 0,
            totalFeatureCount: Number(payload?.summary?.inventory ?? 0),
            boundary: (sceneData.boundary || [])
              .slice(0, BASE_SCENE_LIMITS.boundary)
              .map((ring) => [...ring, ring[0]].filter(Boolean)),
            roads: (sceneData.roads || [])
              .slice(0, BASE_SCENE_LIMITS.roads)
              .map((road) => road.points || [])
              .filter((points) => points.length > 1),
            areas: [],
            buildings: (sceneData.buildings || [])
              .slice(0, BASE_SCENE_LIMITS.buildings)
              .map((building) => ({
                ...building,
                height: finiteNumber(building.height, 6),
                width: finiteNumber(building.width, 1.4),
                depth: finiteNumber(building.depth, 1.4),
              })),
            anchors: {
              civic: (sceneData.civic || []).slice(0, BASE_SCENE_LIMITS.civic),
              mobility: (sceneData.mobility || []).slice(0, BASE_SCENE_LIMITS.mobility),
              commerce: (sceneData.commerce || []).slice(0, BASE_SCENE_LIMITS.commerce),
              wasteSeeds: (sceneData.wasteSeeds || []).slice(0, BASE_SCENE_LIMITS.wasteSeeds),
              places: (sceneData.places || []).slice(0, BASE_SCENE_LIMITS.places),
              features: [],
            },
          }
          ;(sceneData.greenBlue || []).slice(0, BASE_SCENE_LIMITS.greenBlue).forEach((feature) => {
            if (Array.isArray(feature.points) && feature.points.length > 1) {
              model.areas.push({ layerKey: 'greenBlueOutline', points: feature.shape === 'line' ? feature.points : [...feature.points, feature.points[0]].filter(Boolean) })
              return
            }
            model.areas.push({ ...feature, layerKey: 'greenBlue' })
          })
          model.renderedFeatureCount =
            model.boundary.length +
            model.roads.length +
            model.areas.length +
            model.buildings.length +
            Object.values(model.anchors).reduce((sum, list) => sum + list.length, 0)
          return model
        }

        function scaleWalkPoint(point, center, factor) {
          return {
            ...point,
            x: center.x + (finiteNumber(point?.x) - center.x) * factor,
            z: center.z + (finiteNumber(point?.z) - center.z) * factor,
          }
        }

        function walkPresenceHeight(building = {}, index = 0) {
          const rawHeight = finiteNumber(building.height, 0)
          const heightMeters = Number(String(building.heightMeters ?? building.renderStyle?.heightMeters ?? '').replace(/[^0-9.]+/g, ''))
          if (Number.isFinite(heightMeters) && heightMeters > 0) return clamp(heightMeters * 0.92, 4.4, 58)
          const floors = Number(building.floors ?? building.renderStyle?.floors)
          if (Number.isFinite(floors) && floors > 0) return clamp(floors * 3.05, 4.4, 58)
          return clamp(Math.max(rawHeight * 1.35, 4.4 + (index % 8) * 1.45), 4.4, 32)
        }

        function walkPresenceModel(model = {}) {
          const extents = sceneExtents(model)
          const factor = clamp(WALK_TARGET_FRAGMENT_SPAN / Math.max(extents.span, 1), 1, 4.2)
          if (factor <= 1.01) return model
          const center = extents.center
          const transformPointList = (points = []) => points.map((point) => scaleWalkPoint(point, center, factor))
          const transformFeature = (feature = {}, index = 0, kind = 'generic') => {
            const scaled = scaleWalkPoint(feature, center, factor)
            if (kind === 'building') {
              return {
                ...feature,
                ...scaled,
                width: clamp(finiteNumber(feature.width, 1.4) * factor, 1.8, 28),
                depth: clamp(finiteNumber(feature.depth, 1.4) * factor, 1.8, 28),
                height: walkPresenceHeight(feature, index),
                walkPresenceScale: factor,
              }
            }
            if (feature.points) return { ...feature, points: transformPointList(feature.points), walkPresenceScale: factor }
            return {
              ...feature,
              ...scaled,
              width: feature.width == null ? feature.width : finiteNumber(feature.width) * factor,
              depth: feature.depth == null ? feature.depth : finiteNumber(feature.depth) * factor,
              walkPresenceScale: factor,
            }
          }
          const anchors = {}
          Object.entries(model.anchors || {}).forEach(([layerKey, features]) => {
            anchors[layerKey] = (features || []).map((feature) => transformFeature(feature))
          })
          return {
            ...model,
            title: model.title || 'Walkable Civic XR fragment',
            detail: model.detail || 'Street-level fragment rendered at pedestrian scale.',
            boundary: (model.boundary || []).map(transformPointList),
            roads: (model.roads || []).map(transformPointList),
            areas: (model.areas || []).map((area, index) => transformFeature(area, index, 'area')),
            buildings: (model.buildings || []).map((building, index) => transformFeature(building, index, 'building')),
            anchors,
            walkPresenceScale: factor,
          }
        }
  `
}
