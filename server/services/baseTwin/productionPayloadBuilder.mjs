import {
  boundsFromFeatureCollection,
  expandBounds,
  fallbackBoundary,
} from './geoUtils.mjs'
import { PAYLOAD_SCHEMA_VERSION } from './payloadConstants.mjs'
import {
  categoryInSet,
  compactLabel,
  countBy,
  filterFeatureCollection,
} from './payloadHelpers.mjs'
import {
  CIVIC_CATEGORIES,
  MOBILITY_CATEGORIES,
  WASTE_CATEGORIES,
} from './featureCategories.mjs'
import { buildScenePayload } from './scenePayloadBuilder.mjs'
import {
  buildInventory,
  buildMetrics,
  emptyFeatureCollection,
} from './inventoryBuilder.mjs'

function productionLayerMetadata(record, key) {
  return (record?.layerDefinitions ?? []).find((definition) => definition.key === key)?.metadata ?? {}
}

function productionDiscoveredCount(record, key, fallback) {
  const storedCount = Number(record?.featureCounts?.[key])
  if (Number.isFinite(storedCount) && storedCount > 0) return storedCount
  const value = Number(productionLayerMetadata(record, key)?.discoveredCount)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function buildLayerBundleFromProductionRecord(record) {
  const facilities = record.layers?.facilities ?? { type: 'FeatureCollection', features: [] }
  const roads = record.layers?.roads ?? { type: 'FeatureCollection', features: [] }
  const buildings = record.layers?.buildings ?? { type: 'FeatureCollection', features: [] }
  const places = record.layers?.places ?? { type: 'FeatureCollection', features: [] }
  const greenBlue = record.layers?.greenBlue ?? { type: 'FeatureCollection', features: [] }
  const unclassifiedLand = record.layers?.unclassifiedLand ?? { type: 'FeatureCollection', features: [] }
  const center = record.layers?.center?.features?.length
    ? record.layers.center
    : {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              id: 'city:center',
              label: `${record.city.name} anchor`,
              kind: 'anchor',
            },
            geometry: {
              type: 'Point',
              coordinates: [record.center.lon, record.center.lat],
            },
          },
        ],
      }

  const mobility = filterFeatureCollection(facilities, (feature) =>
    categoryInSet(feature, MOBILITY_CATEGORIES),
  )
  const civic = filterFeatureCollection(facilities, (feature) =>
    categoryInSet(feature, CIVIC_CATEGORIES),
  )
  const wasteSeeds = filterFeatureCollection(facilities, (feature) =>
    categoryInSet(feature, WASTE_CATEGORIES),
  )
  const commerce = filterFeatureCollection(
    facilities,
    (feature) =>
      !categoryInSet(feature, MOBILITY_CATEGORIES) &&
      !categoryInSet(feature, CIVIC_CATEGORIES) &&
      !categoryInSet(feature, WASTE_CATEGORIES),
  )

  return {
    bounds: [
      roads,
      buildings,
      facilities,
      places,
      greenBlue,
      unclassifiedLand,
      center,
    ].reduce((bounds, collection) => expandBounds(bounds, boundsFromFeatureCollection(collection)), null),
    rawCounts: {
      roadCandidates: productionDiscoveredCount(record, 'roads', roads.features.length),
      buildingCandidates: productionDiscoveredCount(record, 'buildingInventory', productionDiscoveredCount(record, 'buildings', buildings.features.length)),
      buildingCandidateNew: productionDiscoveredCount(record, 'buildingCandidateNew', 0),
      buildingCandidateMatched: productionDiscoveredCount(record, 'buildingCandidateMatched', 0),
      facilityCandidates: productionDiscoveredCount(record, 'facilities', facilities.features.length),
      placeCandidates: productionDiscoveredCount(record, 'places', places.features.length),
      greenBlueCandidates: productionDiscoveredCount(record, 'greenBlue', greenBlue.features.length),
    },
    candidateStats: {
      roadClasses: countBy(roads.features, (feature) =>
        compactLabel(feature.properties?.highway, 'Other'),
      ),
      buildingTypes: countBy(buildings.features, (feature) =>
        compactLabel(feature.properties?.building, 'Other'),
      ),
      facilityCategories: countBy(facilities.features, (feature) =>
        compactLabel(
          feature.properties?.amenity || feature.properties?.shop || feature.properties?.publicTransport,
          'Other',
        ),
      ),
      placeTypes: countBy(places.features, (feature) =>
        compactLabel(feature.properties?.place, 'Other'),
      ),
      greenBlueCategories: countBy(greenBlue.features, (feature) =>
        compactLabel(feature.properties?.category, 'Other'),
      ),
      uniqueRoadNames: new Set(
        roads.features
          .map((feature) => String(feature.properties?.label ?? '').trim())
          .filter(Boolean),
      ).size,
    },
    roads,
    buildings,
    facilities,
    places,
    greenBlue,
    unclassifiedLand,
    mobility,
    civic,
    wasteSeeds,
    commerce,
    center,
  }
}

export function buildPayloadFromProductionRecord(record) {
  const city = record.city
  const center = record.center
  const boundary = record.boundary?.features?.length
    ? record.boundary
    : fallbackBoundary(center)
  const layerBundle = buildLayerBundleFromProductionRecord(record)
  const inventory = buildInventory(layerBundle, boundary, center, city)
  const bounds = [
    layerBundle.bounds,
    boundsFromFeatureCollection(boundary),
  ].reduce((currentBounds, candidate) => expandBounds(currentBounds, candidate), null)

  return {
    version: PAYLOAD_SCHEMA_VERSION,
    city,
    fetchedAt: new Date(record.fetchedAt ?? Date.now()).toISOString(),
    center,
    bounds,
    layers: {
      boundary,
      roads: layerBundle.roads,
      buildings: layerBundle.buildings,
      facilities: layerBundle.facilities,
      unclassifiedLand: layerBundle.unclassifiedLand,
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
      source: 'postgis',
      ingestionRunId: record.ingestionRun?.id ?? null,
      health: {
        healthy: true,
        sparse: false,
        roads: layerBundle.rawCounts.roadCandidates,
        buildings: layerBundle.rawCounts.buildingCandidates,
        facilities: layerBundle.rawCounts.facilityCandidates,
        places: layerBundle.rawCounts.placeCandidates,
        greenBlue: layerBundle.rawCounts.greenBlueCandidates,
      },
      previousExtraction: record.extraction ?? null,
    },
    reference: record.reference,
    notes: [
      `This is a public-data base twin for ${city.name} served from the PostGIS production backbone.`,
      'The current public base twin does not include an access-line layer.',
      'Waste and street cleanliness remain the first semantic layer planned after this base.',
      'The current viewer payload is generated from normalized city features stored in PostGIS.',
    ],
  }
}
