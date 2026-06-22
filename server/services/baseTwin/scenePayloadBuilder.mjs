import { boundaryRings, projectPoint, scenePointsFromCoords } from './geoUtils.mjs'
import { polygonBoxFromScenePoints } from './payloadHelpers.mjs'

const SCENE_BUILDING_LIMIT = 640
const SCENE_ROAD_LIMIT = 420
const SCENE_GREEN_BLUE_LIMIT = 60
const SCENE_POINT_LIMIT = 48

export function buildScenePayload(
  center,
  buildings,
  roads,
  greenBlue,
  places,
  mobility,
  civic,
  commerce,
  wasteSeeds,
  boundary,
) {
  const buildingObjects = (buildings.features ?? [])
    .slice(0, SCENE_BUILDING_LIMIT)
    .map((feature) => {
      const ring = feature.geometry?.coordinates?.[0] ?? []
      const scenePoints = scenePointsFromCoords(ring, center.lon, center.lat)
      const box = polygonBoxFromScenePoints(scenePoints, Number(feature.properties?.height ?? 8))
      if (!box) return null
      return {
        id: feature.properties?.id,
        label: feature.properties?.label,
        building: feature.properties?.building,
        properties: feature.properties,
        height: box.height,
        ...box,
      }
    })
    .filter(Boolean)

  const roadLines = (roads.features ?? [])
    .slice(0, SCENE_ROAD_LIMIT)
    .map((feature) => ({
      id: feature.properties?.id,
      label: feature.properties?.label,
      highway: feature.properties?.highway,
      points: (feature.geometry?.coordinates ?? []).map(([lon, lat]) =>
        projectPoint(lon, lat, center.lon, center.lat),
      ),
    }))
    .filter((feature) => feature.points.length >= 2)

  const pointFeaturesToScene = (features, limit = SCENE_POINT_LIMIT) =>
    (features ?? []).slice(0, limit).map((feature) => {
      const [lon, lat] = feature.geometry?.coordinates ?? [center.lon, center.lat]
      return {
        id: feature.properties?.id,
        label: feature.properties?.label,
        category: feature.properties?.category || feature.properties?.place,
        ...projectPoint(lon, lat, center.lon, center.lat),
      }
    })

  const scenePolygons = (features, limit = SCENE_GREEN_BLUE_LIMIT) =>
    (features ?? [])
      .slice(0, limit)
      .map((feature) => {
        if (feature.geometry?.type === 'LineString') {
          return {
            id: feature.properties?.id,
            label: feature.properties?.label,
            category: feature.properties?.category,
            shape: 'line',
            points: (feature.geometry?.coordinates ?? []).map(([lon, lat]) =>
              projectPoint(lon, lat, center.lon, center.lat),
            ),
          }
        }

        const ring = feature.geometry?.coordinates?.[0] ?? []
        const scenePoints = scenePointsFromCoords(ring, center.lon, center.lat)
        if (scenePoints.length < 3) return null
        return {
          id: feature.properties?.id,
          label: feature.properties?.label,
          category: feature.properties?.category,
          shape: 'polygon',
          points: scenePoints,
        }
      })
      .filter(Boolean)

  const facilityPoints = pointFeaturesToScene(civic.features ?? [])
  const mobilityPoints = pointFeaturesToScene(mobility.features ?? [])
  const commercePoints = pointFeaturesToScene(commerce.features ?? [])
  const wastePoints = pointFeaturesToScene(wasteSeeds.features ?? [])
  const placePoints = pointFeaturesToScene(places.features ?? [], 18)
  const greenBlueShapes = scenePolygons(greenBlue.features ?? [])
  const sceneBoundary = boundaryRings(boundary)
    .map((ring) => scenePointsFromCoords(ring, center.lon, center.lat))
    .filter((ring) => ring.length >= 3)

  return {
    buildings: buildingObjects,
    roads: roadLines,
    greenBlue: greenBlueShapes,
    places: placePoints,
    mobility: mobilityPoints,
    civic: facilityPoints,
    commerce: commercePoints,
    wasteSeeds: wastePoints,
    boundary: sceneBoundary,
  }
}
