import {
  bboxFromCoords,
  boundaryRings,
  centroidFromCoords,
  closeRing,
  elementIntersectsBoundary,
  expandBounds,
  projectedPolygonAreaSquareMeters,
  scenePointsFromCoords,
} from './geoUtils.mjs'
import {
  categoryInSet,
  classifyPlanningReadiness,
  compactLabel,
  countBy,
  estimatedFloorsFromHeight,
  filterFeatureCollection,
  nearestFeatureSummary,
  parseBuildingHeight,
} from './payloadHelpers.mjs'
import {
  CIVIC_CATEGORIES,
  MOBILITY_CATEGORIES,
  WASTE_CATEGORIES,
} from './featureCategories.mjs'

const ROAD_NEAREST_LIMIT = 900
const PLACE_NEAREST_LIMIT = 60

function wayGeometryToCoords(element) {
  return closeRing((element.geometry ?? []).map((point) => [point.lon, point.lat]))
}

function lineGeometryToCoords(element) {
  return (element.geometry ?? [])
    .map((point) => [Number(point.lon), Number(point.lat)])
    .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]))
}

function facilityLabel(tags = {}) {
  return tags.name || tags.amenity || tags.shop || tags.public_transport || 'Facility'
}

function placeLabel(tags = {}) {
  return tags.name || compactLabel(tags.place, 'Place')
}

function landscapeCategory(tags = {}) {
  return tags.leisure || tags.natural || tags.landuse || tags.waterway || 'landscape'
}

function landscapeLabel(tags = {}) {
  return tags.name || compactLabel(landscapeCategory(tags), 'Landscape')
}

export function buildFeatureCollections(elements, center, city, boundary = null) {
  let bounds = null
  const rings = boundaryRings(boundary)
  const inBoundary = (element) => elementIntersectsBoundary(element, rings)

  const roadCandidates = elements.filter(
    (element) =>
      element.type === 'way' &&
      element.tags?.highway &&
      Array.isArray(element.geometry) &&
      inBoundary(element),
  )
  const buildingCandidates = elements.filter(
    (element) =>
      element.type === 'way' &&
      element.tags?.building &&
      Array.isArray(element.geometry) &&
      inBoundary(element),
  )
  const facilityCandidates = elements.filter(
    (element) =>
      (element.type === 'node' || element.type === 'way') &&
      (element.tags?.amenity || element.tags?.shop || element.tags?.public_transport) &&
      inBoundary(element),
  )
  const placeCandidates = elements.filter(
    (element) =>
      element.type === 'node' &&
      element.tags?.place &&
      Number.isFinite(Number(element.lon)) &&
      Number.isFinite(Number(element.lat)) &&
      inBoundary(element),
  )
  const greenBlueCandidates = elements.filter(
    (element) =>
      element.type === 'way' &&
      Array.isArray(element.geometry) &&
      (element.tags?.leisure || element.tags?.natural || element.tags?.landuse || element.tags?.waterway) &&
      inBoundary(element),
  )

  const roads = roadCandidates
    .map((element) => {
      const coords = lineGeometryToCoords(element)
      bounds = expandBounds(bounds, bboxFromCoords(coords))
      return {
        type: 'Feature',
        properties: {
          id: `road:${element.id}`,
          label: element.tags.name || compactLabel(element.tags.highway, 'Road'),
          kind: 'road',
          highway: element.tags.highway || null,
          lanes: element.tags.lanes || null,
          oneway: element.tags.oneway || null,
          maxspeed: element.tags.maxspeed || null,
        },
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      }
    })
    .filter((feature) => feature.geometry.coordinates.length >= 2)

  const buildings = buildingCandidates
    .map((element, index) => {
      const coords = wayGeometryToCoords(element)
      bounds = expandBounds(bounds, bboxFromCoords(coords))
      return {
        type: 'Feature',
        properties: {
          id: `building:${element.id}`,
          label: element.tags.name || `Building ${index + 1}`,
          kind: 'building',
          building: element.tags.building || 'yes',
          levels: element.tags['building:levels'] || null,
          height: parseBuildingHeight(element.tags),
        },
        geometry: {
          type: 'Polygon',
          coordinates: [coords],
        },
      }
    })
    .filter((feature) => feature.geometry.coordinates[0].length >= 4)

  const facilities = facilityCandidates.map((element) => {
    if (element.type === 'node') {
      const coords = [Number(element.lon), Number(element.lat)]
      bounds = expandBounds(bounds, bboxFromCoords([coords]))
      return {
        type: 'Feature',
        properties: {
          id: `facility:${element.id}`,
          label: facilityLabel(element.tags),
          kind: 'facility',
          amenity: element.tags?.amenity || null,
          shop: element.tags?.shop || null,
          publicTransport: element.tags?.public_transport || null,
          category:
            element.tags?.amenity ||
            element.tags?.shop ||
            element.tags?.public_transport ||
            'facility',
        },
        geometry: {
          type: 'Point',
          coordinates: coords,
        },
      }
    }

    const coords = wayGeometryToCoords(element)
    const centroid = centroidFromCoords(coords)
    bounds = expandBounds(bounds, bboxFromCoords(coords))
    return {
      type: 'Feature',
      properties: {
        id: `facility:${element.id}`,
        label: facilityLabel(element.tags),
        kind: 'facility',
        amenity: element.tags?.amenity || null,
        shop: element.tags?.shop || null,
        publicTransport: element.tags?.public_transport || null,
        category:
          element.tags?.amenity ||
          element.tags?.shop ||
          element.tags?.public_transport ||
          'facility',
      },
      geometry: {
        type: 'Point',
        coordinates: [centroid.lon, centroid.lat],
      },
    }
  })

  const places = placeCandidates.map((element) => {
    const coords = [Number(element.lon), Number(element.lat)]
    bounds = expandBounds(bounds, bboxFromCoords([coords]))
    return {
      type: 'Feature',
      properties: {
        id: `place:${element.id}`,
        label: placeLabel(element.tags),
        kind: 'place',
        place: element.tags.place || 'locality',
        population: element.tags.population || null,
      },
      geometry: {
        type: 'Point',
        coordinates: coords,
      },
    }
  })

  const greenBlue = greenBlueCandidates
    .map((element) => {
      const lineCoords = lineGeometryToCoords(element)
      const areaCoords = wayGeometryToCoords(element)
      const category = landscapeCategory(element.tags)
      const isLinear = Boolean(element.tags?.waterway)
      const coords = isLinear ? lineCoords : areaCoords
      bounds = expandBounds(bounds, bboxFromCoords(coords))

      if (isLinear) {
        return {
          type: 'Feature',
          properties: {
            id: `green-blue:${element.id}`,
            label: landscapeLabel(element.tags),
            kind: 'green_blue',
            category,
            shape: 'line',
          },
          geometry: {
            type: 'LineString',
            coordinates: lineCoords,
          },
        }
      }

      return {
        type: 'Feature',
        properties: {
          id: `green-blue:${element.id}`,
          label: landscapeLabel(element.tags),
          kind: 'green_blue',
          category,
          shape: 'polygon',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [areaCoords],
        },
      }
    })
    .filter((feature) =>
      feature.geometry.type === 'LineString'
        ? feature.geometry.coordinates.length >= 2
        : feature.geometry.coordinates[0].length >= 4,
    )

  const facilityCollection = { type: 'FeatureCollection', features: facilities }
  const mobility = filterFeatureCollection(facilityCollection, (feature) =>
    categoryInSet(feature, MOBILITY_CATEGORIES),
  )
  const civic = filterFeatureCollection(facilityCollection, (feature) =>
    categoryInSet(feature, CIVIC_CATEGORIES),
  )
  const wasteSeeds = filterFeatureCollection(facilityCollection, (feature) =>
    categoryInSet(feature, WASTE_CATEGORIES),
  )
  const commerce = filterFeatureCollection(
    facilityCollection,
    (feature) =>
      !categoryInSet(feature, MOBILITY_CATEGORIES) &&
      !categoryInSet(feature, CIVIC_CATEGORIES) &&
      !categoryInSet(feature, WASTE_CATEGORIES),
  )

  const nearestRoadCandidates = roads.slice(0, ROAD_NEAREST_LIMIT)
  const nearestPlaceCandidates = places.slice(0, PLACE_NEAREST_LIMIT)
  const enrichedBuildings = buildings.map((feature) => {
    const ring = feature.geometry?.coordinates?.[0] ?? []
    const centroid = centroidFromCoords(ring, city)
    const scenePoints = scenePointsFromCoords(ring, center.lon, center.lat)
    const footprintArea = Math.round(projectedPolygonAreaSquareMeters(scenePoints))
    const nearestRoad = nearestFeatureSummary(
      centroid,
      nearestRoadCandidates,
      (candidate) => {
        const coordinates = candidate.geometry?.coordinates ?? []
        return coordinates[Math.floor(coordinates.length / 2)] ?? coordinates[0]
      },
    )
    const nearestPlace = nearestFeatureSummary(
      centroid,
      nearestPlaceCandidates,
      (candidate) => candidate.geometry?.coordinates,
    )
    const height = Number(feature.properties?.height ?? 0)
    const hasExplicitHeight = Boolean(feature.properties?.levels || (Number.isFinite(height) && height > 8))

    return {
      ...feature,
      properties: {
        ...feature.properties,
        footprint_area_m2: footprintArea,
        estimated_floors: estimatedFloorsFromHeight(height),
        nearest_road: nearestRoad?.label ?? 'Unknown',
        nearest_road_distance_m: nearestRoad?.distanceM ?? null,
        nearest_place: nearestPlace?.label ?? 'Unknown',
        nearest_place_distance_m: nearestPlace?.distanceM ?? null,
        digital_record_stage: 'base-record',
        bim_status: 'No BIM linked yet',
        record_source: 'Open geodata + inferred building geometry',
        record_confidence: hasExplicitHeight ? 'medium' : 'low',
        planning_readiness: classifyPlanningReadiness({
          footprintArea,
          nearestRoadDistanceM: nearestRoad?.distanceM ?? 9999,
          hasExplicitHeight,
        }),
      },
    }
  })

  return {
    bounds,
    rawCounts: {
      roadCandidates: roadCandidates.length,
      buildingCandidates: buildingCandidates.length,
      facilityCandidates: facilityCandidates.length,
      placeCandidates: placeCandidates.length,
      greenBlueCandidates: greenBlueCandidates.length,
    },
    candidateStats: {
      roadClasses: countBy(roadCandidates, (element) => compactLabel(element.tags?.highway, 'Other')),
      buildingTypes: countBy(
        buildingCandidates,
        (element) => compactLabel(element.tags?.building, 'Other'),
      ),
      facilityCategories: countBy(
        facilityCandidates,
        (element) =>
          compactLabel(
            element.tags?.amenity || element.tags?.shop || element.tags?.public_transport,
            'Other',
          ),
      ),
      placeTypes: countBy(placeCandidates, (element) => compactLabel(element.tags?.place, 'Other')),
      greenBlueCategories: countBy(greenBlueCandidates, (element) =>
        compactLabel(
          element.tags?.leisure || element.tags?.natural || element.tags?.landuse || element.tags?.waterway,
          'Other',
        ),
      ),
      uniqueRoadNames: new Set(
        roadCandidates
          .map((element) => String(element.tags?.name ?? '').trim())
          .filter(Boolean),
      ).size,
    },
    roads: { type: 'FeatureCollection', features: roads },
    buildings: {
      type: 'FeatureCollection',
      features: enrichedBuildings,
    },
    facilities: facilityCollection,
    places: { type: 'FeatureCollection', features: places },
    greenBlue: { type: 'FeatureCollection', features: greenBlue },
    mobility,
    civic,
    wasteSeeds,
    commerce,
    center: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            id: 'city:center',
            label: `${city.name} anchor`,
            kind: 'anchor',
          },
          geometry: {
            type: 'Point',
            coordinates: [center.lon, center.lat],
          },
        },
      ],
    },
  }
}
