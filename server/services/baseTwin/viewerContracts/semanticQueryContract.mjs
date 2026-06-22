import { buildViewerSurfaceManifest, normalizeViewerSurface, VIEWER_SURFACE_KEYS } from './viewerSurfaceManifest.mjs'

export const SEMANTIC_QUERY_CONTRACT_VERSION = '2026-05-21'

const QUERY_OPERATORS = [
  { key: 'eq', label: 'equals', valueTypes: ['string', 'number', 'boolean'] },
  { key: 'neq', label: 'does not equal', valueTypes: ['string', 'number', 'boolean'] },
  { key: 'in', label: 'is one of', valueTypes: ['string[]', 'number[]'] },
  { key: 'contains', label: 'contains text', valueTypes: ['string'] },
  { key: 'gte', label: 'greater than or equal', valueTypes: ['number'] },
  { key: 'lte', label: 'less than or equal', valueTypes: ['number'] },
  { key: 'between', label: 'between', valueTypes: ['number[]'] },
  { key: 'exists', label: 'exists', valueTypes: ['boolean'] },
]

const COMMON_FIELDS = [
  {
    key: 'authorityStatus',
    label: 'Authority status',
    type: 'enum',
    operators: ['eq', 'neq', 'in'],
    source: 'city_features.authority_status',
  },
  {
    key: 'confidence',
    label: 'Confidence',
    type: 'enum',
    operators: ['eq', 'neq', 'in'],
    source: 'city_features.confidence',
  },
  {
    key: 'sourceCoverageStatus',
    label: 'Source coverage status',
    type: 'enum',
    operators: ['eq', 'neq', 'in', 'exists'],
    source: "city_features.properties.source_coverage_status and LDT source evidence",
  },
  {
    key: 'label',
    label: 'Label',
    type: 'text',
    operators: ['eq', 'contains', 'exists'],
    source: 'city_features.label',
  },
]

const SEMANTIC_CLASSES = [
  {
    key: 'boundary',
    label: 'Municipal boundary',
    inventoryTier: 'base',
    familyKey: 'boundary',
    layerKeys: ['boundary'],
    entityTypes: ['boundary'],
    geometryTypes: ['Polygon', 'MultiPolygon'],
    supportedSurfaces: ['map', 'municipal3d', 'immersive'],
    meaning: 'The territorial mask that bounds the base twin and clips public inventory.',
    fields: COMMON_FIELDS,
  },
  {
    key: 'landUseCoverageGap',
    label: 'Land-use coverage gap',
    inventoryTier: 'base-gap',
    familyKey: 'landUseCoverageGap',
    layerKeys: ['unclassifiedLand'],
    entityTypes: ['unclassifiedLand'],
    geometryTypes: ['Polygon', 'MultiPolygon'],
    supportedSurfaces: ['map', 'municipal3d'],
    meaning: 'Municipal land still missing useful thematic land-use classification.',
    fields: [
      ...COMMON_FIELDS,
      {
        key: 'gapRatio',
        label: 'Gap ratio',
        type: 'number',
        unit: 'percent',
        operators: ['gte', 'lte', 'between'],
        source: 'viewer-derived selected-area coverage',
      },
      {
        key: 'landUseCategory',
        label: 'Land-use category',
        type: 'category',
        operators: ['eq', 'in', 'exists'],
        source: 'city_features.properties.category',
      },
    ],
  },
  {
    key: 'roads',
    label: 'Roads',
    inventoryTier: 'base',
    familyKey: 'roads',
    layerKeys: ['roads'],
    entityTypes: ['roads', 'road'],
    geometryTypes: ['LineString', 'MultiLineString'],
    supportedSurfaces: ['map', 'municipal3d', 'immersive'],
    meaning: 'Open road network geometry and road-class semantics used for movement and block inference.',
    fields: [
      ...COMMON_FIELDS,
      {
        key: 'roadClass',
        label: 'Road class',
        type: 'category',
        operators: ['eq', 'neq', 'in', 'exists'],
        source: "city_features.properties.highway",
      },
      {
        key: 'name',
        label: 'Street name',
        type: 'text',
        operators: ['eq', 'contains', 'exists'],
        source: "city_features.properties.name",
      },
    ],
  },
  {
    key: 'buildings',
    label: 'Buildings',
    inventoryTier: 'base',
    familyKey: 'buildings',
    layerKeys: ['buildings'],
    entityTypes: ['buildings', 'building', 'buildingCandidateNew'],
    geometryTypes: ['Polygon', 'MultiPolygon'],
    supportedSurfaces: ['map', 'municipal3d', 'immersive'],
    meaning: 'Consolidated open building inventory. Source matching stays in reports; the visual layer is one city building base.',
    fields: [
      ...COMMON_FIELDS,
      {
        key: 'heightMeters',
        label: 'Height',
        type: 'number',
        unit: 'm',
        operators: ['gte', 'lte', 'between', 'exists'],
        source: "city_features.properties.height and ldt_core.building_entities.height_m",
      },
      {
        key: 'floors',
        label: 'Floors',
        type: 'number',
        operators: ['gte', 'lte', 'between', 'exists'],
        source: "city_features.properties.levels or city_features.properties.estimated_floors",
      },
      {
        key: 'buildingType',
        label: 'Building type',
        type: 'category',
        operators: ['eq', 'neq', 'in', 'exists'],
        source: "city_features.properties.building",
      },
      {
        key: 'bimStatus',
        label: 'BIM status',
        type: 'enum',
        operators: ['eq', 'neq', 'in', 'exists'],
        source: "city_features.properties.bim_status",
      },
    ],
  },
  {
    key: 'greenBlue',
    label: 'Green-blue systems',
    inventoryTier: 'base',
    familyKey: 'greenBlue',
    layerKeys: ['greenBlue'],
    entityTypes: ['greenBlue', 'green_blue'],
    geometryTypes: ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString'],
    supportedSurfaces: ['map', 'municipal3d', 'immersive'],
    meaning: 'Parks, water, forests, meadows, and other open/environmental systems from public data.',
    fields: [
      ...COMMON_FIELDS,
      {
        key: 'category',
        label: 'Category',
        type: 'category',
        operators: ['eq', 'neq', 'in', 'exists'],
        source: "city_features.properties.category",
      },
    ],
  },
  {
    key: 'places',
    label: 'Settlements and places',
    inventoryTier: 'base',
    familyKey: 'places',
    layerKeys: ['places'],
    entityTypes: ['places', 'place'],
    geometryTypes: ['Point'],
    supportedSurfaces: ['map', 'municipal3d', 'immersive'],
    meaning: 'Named places and settlement anchors used for city orientation.',
    fields: [
      ...COMMON_FIELDS,
      {
        key: 'placeType',
        label: 'Place type',
        type: 'category',
        operators: ['eq', 'neq', 'in', 'exists'],
        source: "city_features.properties.place",
      },
    ],
  },
  {
    key: 'accessSeeds',
    label: 'Access seeds',
    inventoryTier: 'inferred-seed',
    familyKey: 'accessSeeds',
    layerKeys: ['civic', 'mobility', 'commerce', 'wasteSeeds', 'facilities'],
    entityTypes: ['civic', 'mobility', 'commerce', 'wasteSeeds', 'facilities'],
    geometryTypes: ['Point'],
    supportedSurfaces: ['map', 'municipal3d', 'immersive'],
    meaning: 'Inferred civic, mobility, daily-economy, and waste/public-realm anchors from public tags.',
    fields: [
      ...COMMON_FIELDS,
      {
        key: 'seedFamily',
        label: 'Seed family',
        type: 'category',
        operators: ['eq', 'neq', 'in'],
        source: 'layer key and feature_type',
      },
      {
        key: 'category',
        label: 'Category',
        type: 'category',
        operators: ['eq', 'neq', 'in', 'exists'],
        source: "city_features.properties.category, amenity, shop, public_transport",
      },
    ],
  },
  {
    key: 'semanticPacks',
    label: 'Semantic packs',
    inventoryTier: 'semantic-pack',
    familyKey: 'semanticPacks',
    layerKeys: ['semanticPacks'],
    entityTypes: ['semanticPackOutput', 'semanticServiceFeature'],
    geometryTypes: ['Point', 'Polygon', 'MultiPolygon'],
    supportedSurfaces: ['map', 'immersive'],
    meaning: 'Formal domain outputs attached to the base twin by accepted semantic-pack workflows.',
    fields: [
      ...COMMON_FIELDS,
      {
        key: 'packKey',
        label: 'Pack key',
        type: 'category',
        operators: ['eq', 'neq', 'in'],
        source: 'ldt_semantic semantic-pack bindings',
      },
      {
        key: 'serviceDomain',
        label: 'Service domain',
        type: 'category',
        operators: ['eq', 'neq', 'in', 'exists'],
        source: 'ldt_semantic service feature metadata',
      },
    ],
  },
  {
    key: 'providerOverlays',
    label: 'Provider overlays',
    inventoryTier: 'provider-evidence',
    familyKey: 'providerOverlays',
    layerKeys: ['providerOverlays'],
    entityTypes: ['providerOverlay', 'providerEvidence'],
    geometryTypes: ['Geometry'],
    supportedSurfaces: ['map', 'municipal3d'],
    advanced: true,
    meaning: 'Third-party or city-provider evidence attached to the base inventory, kept advanced by default.',
    fields: [
      ...COMMON_FIELDS,
      {
        key: 'provider',
        label: 'Provider',
        type: 'category',
        operators: ['eq', 'neq', 'in'],
        source: 'providers and layer_definitions.provider_id',
      },
      {
        key: 'sourceFormat',
        label: 'Source format',
        type: 'category',
        operators: ['eq', 'neq', 'in'],
        source: 'layer_definitions metadata and ingestion jobs',
      },
    ],
  },
]

const QUERY_EXAMPLES = [
  {
    key: 'tall-buildings',
    label: 'Buildings taller than 10 m',
    query: {
      classes: ['buildings'],
      scope: { key: 'radius' },
      filters: [{ field: 'heightMeters', operator: 'gte', value: 10 }],
      render: { mode: 'isolate' },
    },
  },
  {
    key: 'primary-roads',
    label: 'Primary road network',
    query: {
      classes: ['roads'],
      scope: { key: 'city' },
      filters: [{ field: 'roadClass', operator: 'in', value: ['primary', 'secondary', 'trunk'] }],
      render: { mode: 'show' },
    },
  },
  {
    key: 'all-semantics-in-area',
    label: 'All semantic objects in an area',
    query: {
      classes: ['buildings', 'roads', 'greenBlue', 'places', 'accessSeeds', 'semanticPacks'],
      scope: { key: 'customPolygon' },
      filters: [],
      render: { mode: 'show' },
    },
  },
]

function layerCapabilityMap(layerCapabilities = []) {
  return new Map(
    layerCapabilities
      .filter((layer) => layer?.key)
      .map((layer) => [layer.key, layer]),
  )
}

function classSurfaceIsAllowed(semanticClass, surface) {
  return semanticClass.supportedSurfaces.includes(surface)
}

function classManifestIsAllowed(semanticClass, manifest) {
  const allowedFamilyKeys = new Set((manifest.layerFamilies ?? []).map((family) => family.key).filter(Boolean))
  const allowedLayerKeys = new Set()
  for (const family of manifest.layerFamilies ?? []) {
    for (const layerKey of family.keys ?? []) {
      allowedLayerKeys.add(layerKey)
    }
  }
  return allowedFamilyKeys.has(semanticClass.familyKey) ||
    semanticClass.layerKeys.some((layerKey) => allowedLayerKeys.has(layerKey))
}

function enrichClass(semanticClass, capabilitiesByLayer) {
  const capabilityLayers = semanticClass.layerKeys
    .map((layerKey) => capabilitiesByLayer.get(layerKey))
    .filter(Boolean)
  const featureCount = capabilityLayers.reduce(
    (sum, layer) => sum + Number(layer.featureCount ?? 0),
    0,
  )
  const transports = Array.from(new Set(
    capabilityLayers.flatMap((layer) => layer.recommendedTransports ?? []),
  ))
  const sourceLicenses = Array.from(new Set(
    capabilityLayers
      .map((layer) => layer.sourceLicense)
      .filter(Boolean),
  ))

  return {
    ...semanticClass,
    featureCount,
    availableLayerKeys: capabilityLayers.map((layer) => layer.key),
    sourceLicenses,
    recommendedTransports: transports,
    availability: featureCount > 0 ? 'available' : 'declared',
  }
}

function supportedScopes(manifest) {
  return (manifest.selectionScopes ?? []).map((scope) => ({
    key: scope.key,
    label: scope.label,
    authority: scope.authority,
    status: scope.status,
  }))
}

export function buildSemanticQueryContract({
  cityId = 'current',
  surface = VIEWER_SURFACE_KEYS.map,
  mode = 'cockpit',
  layerCapabilities = [],
} = {}) {
  const surfaceKey = normalizeViewerSurface(surface)
  const manifest = buildViewerSurfaceManifest({ cityId, surface: surfaceKey, mode })
  const capabilitiesByLayer = layerCapabilityMap(layerCapabilities)
  const classes = SEMANTIC_CLASSES
    .filter((semanticClass) => classSurfaceIsAllowed(semanticClass, surfaceKey))
    .filter((semanticClass) => classManifestIsAllowed(semanticClass, manifest))
    .map((semanticClass) => enrichClass(semanticClass, capabilitiesByLayer))

  return {
    ok: true,
    version: SEMANTIC_QUERY_CONTRACT_VERSION,
    cityId,
    surface: surfaceKey,
    mode: manifest.mode,
    meaningModel: {
      semanticClass: 'Typed city-object meaning such as building, road, green-blue system, place, access seed, or semantic-pack output.',
      field: 'Queryable attribute on a semantic class, such as heightMeters, roadClass, sourceCoverageStatus, or confidence.',
      scope: 'Spatial selection such as city, viewport, radius, district/neighborhood, block/manzana, or custom polygon.',
      semanticPack: 'Domain logic attached to the base inventory after source, authority, and workflow rules are accepted.',
    },
    classes,
    operators: QUERY_OPERATORS,
    scopes: supportedScopes(manifest),
    renderModes: [
      { key: 'show', label: 'Show with current layers' },
      { key: 'isolate', label: 'Show only query result' },
      { key: 'count', label: 'Count and summarize' },
      { key: 'inspect', label: 'Inspect selected feature' },
    ],
    transports: {
      semanticQuery: `/api/live/${encodeURIComponent(cityId)}/semantic-query`,
      boundedGeojson: `/api/live/${encodeURIComponent(cityId)}/features`,
      vectorTileTemplate: `/api/live/${encodeURIComponent(cityId)}/tiles/{z}/{x}/{y}.mvt`,
      selectionSummary: `/api/live/${encodeURIComponent(cityId)}/selection-summary`,
      manifest: `/api/live/${encodeURIComponent(cityId)}/viewer-manifest?surface=${encodeURIComponent(surfaceKey)}`,
    },
    queryShape: {
      classes: ['buildings'],
      scope: { key: 'radius', center: ['lon', 'lat'], radiusMeters: 1000 },
      filters: [{ field: 'heightMeters', operator: 'gte', value: 10 }],
      combine: 'and',
      render: { mode: 'isolate', maxFeatures: 5000 },
    },
    examples: QUERY_EXAMPLES.filter((example) =>
      example.query.classes.some((classKey) => classes.some((semanticClass) => semanticClass.key === classKey)),
    ),
    executionStatus: {
      availableNow: [
        'semantic class to layer-family mapping',
        'attribute predicate execution through the semantic-query API',
        'city, viewport, and radius spatial scopes',
        'semantic query usage events for analyst, embed, API, simulation, and operations intent',
        'layer visibility across map, 3D, and immersive surfaces',
        'selected-feature inspection and selected-area summaries',
      ],
      nextRequired: [
        'query-builder UI that writes the same query object to all three visualizers',
        'optional MVT predicate pushdown when semantic filters need to stream as vector tiles',
        'district/block/custom-polygon authority review before those scopes are treated as official',
      ],
    },
    hostCommands: {
      allowed: ['twin:set-semantic-query', 'twin:clear-semantic-query'],
      blockedOutsideManifest: true,
    },
  }
}

export function semanticClassDefinitions() {
  return SEMANTIC_CLASSES.map((semanticClass) => ({ ...semanticClass }))
}
