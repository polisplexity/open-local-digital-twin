import {
  bboxFromCoords,
  expandBounds,
} from './geoUtils.mjs'
import {
  MIN_HEALTHY_BUILDING_CANDIDATES,
  MIN_HEALTHY_CONTEXT_CANDIDATES,
  MIN_HEALTHY_ROAD_CANDIDATES,
  PAYLOAD_SCHEMA_VERSION,
} from './payloadConstants.mjs'
import {
  fetchBoundary,
  fetchOverpass,
  fetchReferenceProfile,
} from './openDataFetchers.mjs'
import { buildFeatureCollections } from './featureCollectionBuilder.mjs'
import {
  buildInventory,
  buildMetrics,
  emptyFeatureCollection,
} from './inventoryBuilder.mjs'
import { buildScenePayload } from './scenePayloadBuilder.mjs'

const OVERPASS_BUILD_ATTEMPTS = 3

function assessLayerBundleHealth(layerBundle, overpassResult = {}) {
  const roads = Number(layerBundle?.rawCounts?.roadCandidates ?? 0)
  const buildings = Number(layerBundle?.rawCounts?.buildingCandidates ?? 0)
  const facilities = Number(layerBundle?.rawCounts?.facilityCandidates ?? 0)
  const places = Number(layerBundle?.rawCounts?.placeCandidates ?? 0)
  const greenBlue = Number(layerBundle?.rawCounts?.greenBlueCandidates ?? 0)
  const diagnostics = Array.isArray(overpassResult?.diagnostics) ? overpassResult.diagnostics : []
  const failedCriticalQueries = diagnostics
    .filter((entry) => entry.critical && !entry.success)
    .map((entry) => entry.key)
  const facilitiesQuerySucceeded = diagnostics.some(
    (entry) => entry.key === 'facilities' && entry.success,
  )

  const context = facilities + places + greenBlue
  const sparse =
    roads < MIN_HEALTHY_ROAD_CANDIDATES ||
    buildings < MIN_HEALTHY_BUILDING_CANDIDATES ||
    context < MIN_HEALTHY_CONTEXT_CANDIDATES

  return {
    healthy: !sparse && failedCriticalQueries.length === 0 && facilitiesQuerySucceeded,
    sparse,
    roads,
    buildings,
    facilities,
    places,
    greenBlue,
    context,
    facilitiesQuerySucceeded,
    failedCriticalQueries,
    successfulQueries: diagnostics.filter((entry) => entry.success).length,
    totalQueries: diagnostics.length,
    diagnostics,
  }
}

function boundaryBounds(boundary) {
  return bboxFromCoords(
    ((boundary.features?.[0]?.geometry?.type === 'Polygon'
      ? boundary.features?.[0]?.geometry?.coordinates?.[0]
      : boundary.features?.[0]?.geometry?.coordinates?.[0]?.[0]) ?? []),
  )
}

function createOpenDataPayload({
  city,
  center,
  boundary,
  reference,
  sourceArtifacts,
  attempt,
  overpassResult,
  layerBundle,
  quality,
}) {
  const inventory = buildInventory(layerBundle, boundary, center, city)
  const bounds = [
    layerBundle.bounds,
  ].reduce(
    (accumulator, candidate) => expandBounds(accumulator, candidate),
    boundaryBounds(boundary),
  )

  return {
    version: PAYLOAD_SCHEMA_VERSION,
    city,
    fetchedAt: new Date().toISOString(),
    center,
    bounds,
    layers: {
      boundary,
      roads: layerBundle.roads,
      buildings: layerBundle.buildings,
      facilities: layerBundle.facilities,
      unclassifiedLand: { type: 'FeatureCollection', features: [] },
      greenBlue: layerBundle.greenBlue,
      places: layerBundle.places,
      civic: layerBundle.civic,
      mobility: layerBundle.mobility,
      commerce: layerBundle.commerce,
      wasteSeeds: layerBundle.wasteSeeds,
      center: layerBundle.center,
    },
    inventory,
    metrics: buildMetrics(layerBundle, inventory),
    target: null,
    scene: buildScenePayload(
      center,
      layerBundle.buildings,
      layerBundle.roads,
      layerBundle.greenBlue,
      layerBundle.places,
      layerBundle.mobility,
      layerBundle.civic,
      layerBundle.commerce,
      layerBundle.wasteSeeds,
      boundary,
    ),
    extraction: {
      attempt,
      health: quality,
      mode: 'boundary-tiled-overpass',
      tilePlan: overpassResult.tilePlan ?? null,
    },
    reference,
    sourceArtifacts,
    notes: [
      `This is a public-data base twin for ${city.name} built inside Twin Base Studio.`,
      'The current public base twin does not include an access-line layer.',
      'Waste and street cleanliness remain the first semantic layer planned after this base.',
      'The current rendered scope is intentionally capped for performance while still exposing the discovered totals.',
    ],
  }
}

function incompletePayloadError(cityId, failedAttempts) {
  return new Error(
    `LIVE_PAYLOAD_INCOMPLETE:${cityId}:${JSON.stringify(
      failedAttempts.map((attempt) => ({
        attempt: attempt.attempt,
        roads: attempt.roads,
        buildings: attempt.buildings,
        facilities: attempt.facilities,
        places: attempt.places,
        greenBlue: attempt.greenBlue,
        failedCriticalQueries: attempt.failedCriticalQueries,
      })),
    )}`,
  )
}

export async function buildOpenDataBasePayload(city, { payloadLooksSparse } = {}) {
  const {
    center,
    boundary,
    sourceArtifacts: boundarySourceArtifacts = [],
  } = await fetchBoundary(city)
  const {
    sourceArtifacts: referenceSourceArtifacts = [],
    ...reference
  } = await fetchReferenceProfile(city)
  const failedAttempts = []

  for (let attempt = 1; attempt <= OVERPASS_BUILD_ATTEMPTS; attempt += 1) {
    const overpassResult = await fetchOverpass(center, boundary)
    const layerBundle = buildFeatureCollections(overpassResult.elements, center, city, boundary)
    const quality = assessLayerBundleHealth(layerBundle, overpassResult)
    const payload = createOpenDataPayload({
      city,
      center,
      boundary,
      reference,
      sourceArtifacts: [
        ...boundarySourceArtifacts,
        ...(overpassResult.sourceArtifacts ?? []),
        ...referenceSourceArtifacts,
      ],
      attempt,
      overpassResult,
      layerBundle,
      quality,
    })

    if (quality.healthy && !payloadLooksSparse?.(payload)) {
      return payload
    }

    failedAttempts.push({
      attempt,
      roads: quality.roads,
      buildings: quality.buildings,
      facilities: quality.facilities,
      places: quality.places,
      greenBlue: quality.greenBlue,
      failedCriticalQueries: quality.failedCriticalQueries,
      diagnostics: quality.diagnostics,
    })
  }

  throw incompletePayloadError(city.id, failedAttempts)
}
