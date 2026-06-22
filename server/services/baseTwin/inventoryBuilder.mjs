import {
  bboxFromCoords,
  boundaryRings,
  featureCollectionAreaSquareMeters,
  haversineKm,
  lineLengthKm,
  projectedPolygonAreaSquareMeters,
  scenePointsFromCoords,
} from './geoUtils.mjs'

export function emptyFeatureCollection() {
  return { type: 'FeatureCollection', features: [] }
}

function buildLayerDefinitions(layers, inventory, city) {
  const totals = inventory.totals
  return [
    {
      key: 'boundary',
      label: 'Boundary',
      count: layers.boundary.features.length,
      renderedCount: layers.boundary.features.length,
      discoveredCount: totals.boundaryRings,
      description: `Municipal scope from public geocoding and polygon data. Areas without a more specific OSM land-use entity render as unclassified municipal land. Approx area ${inventory.totals.scopeAreaKm2.toFixed(1)} km².`,
      color: '#c46b2d',
      visibleByDefault: true,
      cluster: 'Territory',
      twinCategoryKey: 'base',
      twinCategory: 'Base layer',
      semanticState: 'Base geometry',
      transportStatus: 'Public geometry normalized in the local twin payload. Not yet packaged for shared exchange.',
      system: 'Territory and scope',
      ldtLayer: 'Data Sources + Visualisation',
      capability: 'Descriptive',
      phase: 'Explore',
      cityMeaning: 'Defines the municipal footprint and the spatial ownership of the twin.',
      nextSemanticStep: 'Connect official authority boundaries, parcels, and service zones.',
    },
    {
      key: 'unclassifiedLand',
      label: 'Land-use coverage gap',
      count: layers.unclassifiedLand?.features?.length ?? 0,
      renderedCount: layers.unclassifiedLand?.features?.length ?? 0,
      discoveredCount: layers.unclassifiedLand?.features?.length ?? 0,
      displayValue: `${Number(totals.unclassifiedLandPercent ?? 0).toFixed(1)}%`,
      displayLabel: 'without land-use polygon',
      description: 'Municipal area not yet covered by a specific OSM land-use, land-cover, park, water, or open-space polygon.',
      color: '#e0a11b',
      visibleByDefault: true,
      cluster: 'Territory',
      twinCategoryKey: 'base',
      twinCategory: 'Base layer',
      semanticState: 'Land-use gap',
      transportStatus: 'Derived from the municipal boundary only. It is not an OSM land-use entity and not official zoning.',
      system: 'Territory and land coverage',
      ldtLayer: 'Data Sources + Visualisation',
      capability: 'Descriptive',
      phase: 'Explore',
      cityMeaning: 'Shows where the boundary is present but the current open land-use coverage is incomplete. This does not mean the land is empty.',
      nextSemanticStep: 'Replace this fallback with official zoning, parcels, land-cover, or cadastral data when a city provides it.',
    },
    {
      key: 'roads',
      label: 'Roads',
      count: layers.roads.features.length,
      renderedCount: layers.roads.features.length,
      discoveredCount: totals.roadsDiscovered,
      description: `Street segments around the current ${city.name} base-twin scope.`,
      color: '#516274',
      visibleByDefault: true,
      cluster: 'Access',
      twinCategoryKey: 'base',
      twinCategory: 'Base layer',
      semanticState: 'Base geometry',
      transportStatus: 'Public street geometry normalized in the local twin payload. Not yet formalized in a shared transport model.',
      system: 'Mobility and access',
      ldtLayer: 'Data Sources -> Knowledge -> Visualisation',
      capability: 'Descriptive / Diagnostic seed',
      phase: 'Explore + Validate',
      cityMeaning: 'Shows how the municipality is traversed, connected, and eventually serviced.',
      nextSemanticStep: 'Add collection circuits, restrictions, and service burden logic.',
    },
    {
      key: 'buildings',
      label: 'Buildings',
      count: layers.buildings.features.length,
      renderedCount: layers.buildings.features.length,
      discoveredCount: Number(totals.buildingsDiscovered ?? layers.buildings.features.length),
      description: 'Consolidated open building footprints from the available public building sources.',
      color: '#8ea2b8',
      visibleByDefault: true,
      cluster: 'Built fabric',
      twinCategoryKey: 'base',
      twinCategory: 'Base layer',
      semanticState: 'Base geometry',
      transportStatus: 'Public building geometry normalized in the local twin payload. Source, match, and duplicate evidence is retained for reports.',
      system: 'Built fabric',
      ldtLayer: 'Data Sources + Knowledge + Visualisation',
      capability: 'Descriptive',
      phase: 'Explore',
      cityMeaning: 'Gives the twin mass, urban form, and a believable physical city canvas without exposing source plumbing in the main viewer.',
      nextSemanticStep: 'Attach building semantics, service demand, and public asset metadata.',
    },
    {
      key: 'greenBlue',
      label: 'Land use / open land',
      count: layers.greenBlue.features.length,
      renderedCount: layers.greenBlue.features.length,
      discoveredCount: totals.greenBlueDiscovered,
      description: 'OSM land-use, land-cover, water, forest, meadow, park, and open-space polygons. Boundary-only gaps are unclassified municipal land.',
      color: '#4d8f5a',
      visibleByDefault: true,
      cluster: 'Environment',
      twinCategoryKey: 'base',
      twinCategory: 'Base layer',
      semanticState: 'Base geometry',
      transportStatus: 'Public OSM land-use and land-cover geometry normalized in the local twin payload. Not cadastral or zoning authority data.',
      system: 'Land use, environment, and public realm',
      ldtLayer: 'Data Sources + Knowledge + Visualisation',
      capability: 'Descriptive / Prospective seed',
      phase: 'Explore + Define',
      cityMeaning: 'Makes low-density, forest, water, industrial, residential land-use, open-land, and unclassified municipal areas visible instead of looking like missing data.',
      nextSemanticStep: 'Connect official zoning, parcels, protected areas, resilience, maintenance, climate, and public-space scenarios.',
    },
    {
      key: 'civic',
      label: 'Civic anchors',
      count: layers.civic.features.length,
      renderedCount: layers.civic.features.length,
      discoveredCount: totals.civicAnchors,
      description: 'Town hall, schools, health, library, and other public-service anchors.',
      color: '#0f766e',
      visibleByDefault: true,
      cluster: 'Public services',
      twinCategoryKey: 'semanticSeed',
      twinCategory: 'Inferred semantic seed',
      semanticState: 'Public-data classification',
      transportStatus: 'Inferred service semantics from public data. Not yet encoded as authority-grade interoperable service entities.',
      system: 'Public services',
      ldtLayer: 'Knowledge + Services + Visualisation',
      capability: 'Descriptive / Diagnostic seed',
      phase: 'Validate + Define',
      cityMeaning: 'Makes the twin legible for the municipality because public services are visible and discussable.',
      nextSemanticStep: 'Link service quality, incidents, demand, and authority workflows.',
    },
    {
      key: 'mobility',
      label: 'Mobility anchors',
      count: layers.mobility.features.length,
      renderedCount: layers.mobility.features.length,
      discoveredCount: totals.mobilityAnchors,
      description: 'Stops, parking, bicycle parking, fuel, and other access-supporting points.',
      color: '#2563eb',
      visibleByDefault: true,
      cluster: 'Access',
      twinCategoryKey: 'semanticSeed',
      twinCategory: 'Inferred semantic seed',
      semanticState: 'Public-data classification',
      transportStatus: 'Inferred mobility semantics from public data. Not yet connected to a shared operational exchange model.',
      system: 'Mobility and access',
      ldtLayer: 'Knowledge + Services + Visualisation',
      capability: 'Descriptive / Diagnostic seed',
      phase: 'Validate + Define',
      cityMeaning: 'Shows the access points that influence daily operations, service reach, and routing logic.',
      nextSemanticStep: 'Add movement demand, restrictions, and multimodal operations.',
    },
    {
      key: 'commerce',
      label: 'Daily economy',
      count: layers.commerce.features.length,
      renderedCount: layers.commerce.features.length,
      discoveredCount: totals.commerceAnchors,
      description: 'Shops and non-civic activity points that reveal daily-use urban fabric.',
      color: '#9333ea',
      visibleByDefault: false,
      cluster: 'Daily life',
      twinCategoryKey: 'semanticSeed',
      twinCategory: 'Inferred semantic seed',
      semanticState: 'Public-data classification',
      transportStatus: 'Inferred daily-economy semantics from public data. Not yet modeled for federated exchange.',
      system: 'Daily economy and activity',
      ldtLayer: 'Data Sources + Knowledge + Visualisation',
      capability: 'Descriptive',
      phase: 'Explore',
      cityMeaning: 'Shows where everyday urban life concentrates and where waste and cleanliness demands may later emerge.',
      nextSemanticStep: 'Connect commercial intensity, service demand, and street-cleanliness signals.',
    },
    {
      key: 'wasteSeeds',
      label: 'Waste and street seeds',
      count: layers.wasteSeeds.features.length,
      renderedCount: layers.wasteSeeds.features.length,
      discoveredCount: totals.wasteSeedCount,
      description: 'Recycling, waste baskets, and waste-disposal points that seed the first semantic layer.',
      color: '#d97706',
      visibleByDefault: true,
      cluster: 'Waste bridge',
      twinCategoryKey: 'semanticSeed',
      twinCategory: 'Inferred semantic seed',
      semanticState: 'Public-data classification',
      transportStatus: 'Seed-level waste semantics inferred from public points. Not yet encoded as a formal waste data product.',
      system: 'Waste and street cleanliness',
      ldtLayer: 'Knowledge + Services + Orchestration',
      capability: 'Diagnostic / Prospective seed',
      phase: 'Define',
      cityMeaning: 'Marks the visible bridge from the base twin toward the first operational semantic layer.',
      nextSemanticStep: 'Add collection logic, hotspot scoring, service zones, and simple action guidance.',
    },
    {
      key: 'places',
      label: 'Settlements and places',
      count: layers.places.features.length,
      renderedCount: layers.places.features.length,
      discoveredCount: totals.placesDiscovered,
      description: 'Neighbourhood and locality markers that help municipalities read the territory.',
      color: '#7c3aed',
      visibleByDefault: false,
      cluster: 'Territory',
      twinCategoryKey: 'base',
      twinCategory: 'Base layer',
      semanticState: 'Base geography',
      transportStatus: 'Named-place references inside the local payload. Not yet mapped to sub-municipal governance identifiers.',
      system: 'Territory and settlements',
      ldtLayer: 'Knowledge + Visualisation',
      capability: 'Descriptive',
      phase: 'Explore',
      cityMeaning: 'Helps the municipality read named places, local identities, and territorial sub-areas.',
      nextSemanticStep: 'Connect sub-municipal governance, narratives, and service comparisons.',
    },
    {
      key: 'center',
      label: 'City anchor',
      count: layers.center.features.length,
      renderedCount: layers.center.features.length,
      discoveredCount: layers.center.features.length,
      description: `Map anchor used for the initial ${city.name} twin focus.`,
      color: '#111827',
      visibleByDefault: false,
      cluster: 'Territory',
      twinCategoryKey: 'reference',
      twinCategory: 'Reference utility',
      semanticState: 'Viewer reference',
      transportStatus: 'Local visual reference only.',
      system: 'Reference anchor',
      ldtLayer: 'Visualisation',
      capability: 'Descriptive',
      phase: 'Explore',
      cityMeaning: 'Provides a stable point of entry for the first build of the municipal twin.',
      nextSemanticStep: 'Replace the generic anchor with authority-approved operational anchors.',
    },
  ]
}

export function buildInventory(layerBundle, boundary, center, city) {
  const averageHeight =
    layerBundle.buildings.features.length > 0
      ? Number(
          (
            layerBundle.buildings.features.reduce(
              (sum, feature) => sum + Number(feature.properties?.height ?? 0),
              0,
            ) / layerBundle.buildings.features.length
          ).toFixed(1),
        )
      : 0

  const tallBuildings = layerBundle.buildings.features.filter(
    (feature) => Number(feature.properties?.height ?? 0) >= 16,
  ).length
  const rings = boundaryRings(boundary)
  const boundaryRingCount = rings.length
  const allBoundaryCoords = rings.flat()
  const scopeBounds = bboxFromCoords(allBoundaryCoords) ?? [
    center.lon - 0.01,
    center.lat - 0.01,
    center.lon + 0.01,
    center.lat + 0.01,
  ]
  const scopeWidthKm = Number(
    haversineKm([scopeBounds[0], center.lat], [scopeBounds[2], center.lat]).toFixed(2),
  )
  const scopeHeightKm = Number(
    haversineKm([center.lon, scopeBounds[1]], [center.lon, scopeBounds[3]]).toFixed(2),
  )
  const scopeAreaKm2 = Number(
    (
      rings.reduce(
        (sum, ring) =>
          sum + projectedPolygonAreaSquareMeters(scenePointsFromCoords(ring, center.lon, center.lat)),
        0,
      ) / 1000000
    ).toFixed(2),
  )
  const unclassifiedLandAreaKm2 = Number(
    (featureCollectionAreaSquareMeters(layerBundle.unclassifiedLand, center) / 1000000).toFixed(2),
  )
  const unclassifiedLandPercent = scopeAreaKm2 > 0
    ? Number(Math.max(0, Math.min(100, (unclassifiedLandAreaKm2 / scopeAreaKm2) * 100)).toFixed(1))
    : 0
  const renderedRoadKm = Number(
    (layerBundle.roads.features ?? [])
      .reduce((sum, feature) => sum + lineLengthKm(feature.geometry?.coordinates ?? []), 0)
      .toFixed(2),
  )
  const mobilityAnchors = layerBundle.mobility.features.length
  const civicAnchors = layerBundle.civic.features.length
  const commerceAnchors = layerBundle.commerce.features.length
  const wasteSeedCount = layerBundle.wasteSeeds.features.length
  const placeCount = layerBundle.places.features.length
  const greenBlueCount = layerBundle.greenBlue.features.length

  const inventory = {
    totals: {
      boundaryRings: boundaryRingCount,
      scopeAreaKm2,
      scopeWidthKm,
      scopeHeightKm,
      unclassifiedLandAreaKm2,
      unclassifiedLandPercent,
      roadsRendered: layerBundle.roads.features.length,
      roadsDiscovered: layerBundle.rawCounts.roadCandidates,
      roadNamesDiscovered: layerBundle.candidateStats.uniqueRoadNames,
      renderedRoadKm,
      buildingsRendered: layerBundle.buildings.features.length,
      buildingsDiscovered: layerBundle.rawCounts.buildingCandidates,
      buildingCandidateNew: layerBundle.rawCounts.buildingCandidateNew ?? 0,
      buildingCandidateMatched: layerBundle.rawCounts.buildingCandidateMatched ?? 0,
      averageBuildingHeight: averageHeight,
      tallBuildings,
      facilitiesRendered: layerBundle.facilities.features.length,
      facilitiesDiscovered: layerBundle.rawCounts.facilityCandidates,
      placesRendered: placeCount,
      placesDiscovered: layerBundle.rawCounts.placeCandidates,
      greenBlueRendered: greenBlueCount,
      greenBlueDiscovered: layerBundle.rawCounts.greenBlueCandidates,
      mobilityAnchors,
      civicAnchors,
      commerceAnchors,
      wasteSeedCount,
    },
    sections: [
      {
        title: 'Territory and settlements',
        summary: `${boundaryRingCount} boundary ring and ${placeCount} place markers currently define the public territorial reading of ${city.name}.`,
        items: [
          { label: 'Scope area (km²)', count: scopeAreaKm2 },
          { label: 'Scope width (km)', count: scopeWidthKm },
          { label: 'Scope height (km)', count: scopeHeightKm },
          { label: 'Place markers rendered', count: placeCount },
          ...layerBundle.candidateStats.placeTypes,
        ],
      },
      {
        title: 'Mobility and access',
        summary: `${layerBundle.roads.features.length} rendered road segments out of ${layerBundle.rawCounts.roadCandidates} discovered ways, plus ${mobilityAnchors} mobility anchors.`,
        items: [
          { label: 'Named streets discovered', count: layerBundle.candidateStats.uniqueRoadNames },
          { label: 'Rendered road km', count: renderedRoadKm },
          { label: 'Mobility anchors rendered', count: mobilityAnchors },
          ...layerBundle.candidateStats.roadClasses,
        ],
      },
      {
        title: 'Built fabric',
        summary: `${layerBundle.buildings.features.length} rendered building footprints out of ${layerBundle.rawCounts.buildingCandidates} discovered buildings.`,
        items: [
          { label: 'Average height (m)', count: averageHeight },
          { label: 'Tall buildings (>=16m)', count: tallBuildings },
          ...layerBundle.candidateStats.buildingTypes,
        ],
      },
      {
        title: 'Civic and daily-life anchors',
        summary: `${civicAnchors} civic anchors and ${layerBundle.facilities.features.length} rendered facilities support the current descriptive twin.`,
        items: [
          { label: 'Civic anchors rendered', count: civicAnchors },
          { label: 'Daily economy anchors rendered', count: commerceAnchors },
          { label: 'Facilities rendered', count: layerBundle.facilities.features.length },
          ...layerBundle.candidateStats.facilityCategories,
        ],
      },
      {
        title: 'Green-blue and public realm',
        summary: `${greenBlueCount} green-blue features and ${wasteSeedCount} waste-related public-realm seeds are already visible before semantics.`,
        items: [
          { label: 'Green-blue features rendered', count: greenBlueCount },
          { label: 'Waste seeds rendered', count: wasteSeedCount },
          ...layerBundle.candidateStats.greenBlueCategories,
        ],
      },
    ],
  }

    inventory.layerDefinitions = buildLayerDefinitions(
    {
      boundary,
      roads: layerBundle.roads,
      buildings: layerBundle.buildings,
      greenBlue: layerBundle.greenBlue,
      civic: layerBundle.civic,
      mobility: layerBundle.mobility,
      commerce: layerBundle.commerce,
      wasteSeeds: layerBundle.wasteSeeds,
      places: layerBundle.places,
      center: layerBundle.center,
    },
    inventory,
    city,
  )

  return inventory
}

export function buildMetrics(layerBundle, inventory) {
  return [
    {
      label: 'Public scope',
      value: `${inventory.totals.scopeAreaKm2.toFixed(1)} km²`,
      note: `${inventory.totals.placesRendered} territorial place markers inside the current base twin.`,
    },
    {
      label: 'Named streets',
      value: String(inventory.totals.roadNamesDiscovered),
      note: `${inventory.totals.roadsRendered} rendered road geometries and ${inventory.totals.renderedRoadKm} km currently visible.`,
    },
    {
      label: 'Buildings discovered',
      value: String(layerBundle.rawCounts.buildingCandidates),
      note: `${layerBundle.buildings.features.length} rendered now. Average height ${inventory.totals.averageBuildingHeight}m.`,
    },
    {
      label: 'Civic + mobility anchors',
      value: String(inventory.totals.civicAnchors + inventory.totals.mobilityAnchors),
      note: `${inventory.totals.wasteSeedCount} waste seeds and ${inventory.totals.commerceAnchors} daily-economy anchors already available.`,
    },
    {
      label: 'Land use / open land',
      value: String(inventory.totals.greenBlueDiscovered),
      note: `${inventory.totals.greenBlueRendered} rendered OSM land-use, land-cover, water, forest, meadow, park, and open-space features.`,
    },
  ]
}
