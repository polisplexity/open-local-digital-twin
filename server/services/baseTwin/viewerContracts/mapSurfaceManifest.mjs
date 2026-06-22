export const MAP_SURFACE_MODES = {
  cockpit: {
    key: 'cockpit',
    label: 'Analytical Map',
    access: 'session',
  },
  embeddedAnalyst: {
    key: 'embedded-analyst',
    label: 'Embedded Analytical Map',
    access: 'session-or-share-token',
  },
  publicShare: {
    key: 'public-share',
    label: 'Shared Analytical Map',
    access: 'published-share-token',
  },
}

export const MAP_LAYER_FAMILIES = [
  {
    key: 'boundary',
    label: 'Boundary',
    family: 'base',
    keys: ['boundary'],
    defaultVisible: true,
  },
  {
    key: 'landUseCoverageGap',
    label: 'Land-use coverage gap',
    family: 'base',
    keys: ['unclassifiedLand'],
    defaultVisible: false,
  },
  {
    key: 'roads',
    label: 'Roads',
    family: 'base',
    keys: ['roads'],
    defaultVisible: true,
  },
  {
    key: 'buildings',
    label: 'Buildings',
    family: 'base',
    keys: ['buildings'],
    defaultVisible: true,
  },
  {
    key: 'greenBlue',
    label: 'Green-blue systems',
    family: 'base',
    keys: ['greenBlue'],
    defaultVisible: false,
  },
  {
    key: 'places',
    label: 'Settlements and places',
    family: 'base',
    keys: ['places'],
    defaultVisible: false,
  },
  {
    key: 'accessSeeds',
    label: 'Access seeds',
    family: 'inferred',
    keys: ['civic', 'mobility', 'commerce', 'wasteSeeds', 'facilities'],
    defaultVisible: false,
  },
  {
    key: 'semanticPacks',
    label: 'Semantic packs',
    family: 'semantic',
    keys: ['semanticPacks'],
    defaultVisible: false,
  },
  {
    key: 'providerOverlays',
    label: 'Provider overlays',
    family: 'provider',
    keys: ['providerOverlays'],
    defaultVisible: false,
    advanced: true,
  },
]

export const MAP_SELECTION_SCOPES = [
  {
    key: 'city',
    label: 'City',
    authority: 'base-boundary',
    status: 'available',
  },
  {
    key: 'viewport',
    label: 'Viewport',
    authority: 'runtime-view',
    status: 'available',
  },
  {
    key: 'radius',
    label: 'Radius',
    authority: 'runtime-view',
    status: 'available',
  },
  {
    key: 'district',
    label: 'District or neighborhood',
    authority: 'source-dependent',
    status: 'needed',
  },
  {
    key: 'block',
    label: 'Block or manzana',
    authority: 'source-dependent-or-inferred',
    status: 'needed',
  },
  {
    key: 'customPolygon',
    label: 'Custom polygon',
    authority: 'analyst-defined',
    status: 'later',
  },
]

export function resolveMapSurfaceMode(mode = 'cockpit') {
  return MAP_SURFACE_MODES[mode] ||
    Object.values(MAP_SURFACE_MODES).find((surfaceMode) => surfaceMode.key === mode) ||
    MAP_SURFACE_MODES.cockpit
}

export function buildMapSurfaceManifest({ cityId = 'current', mode = 'cockpit' } = {}) {
  const surfaceMode = resolveMapSurfaceMode(mode)
  const publicMode = surfaceMode.key === MAP_SURFACE_MODES.publicShare.key
  return {
    version: '2026-05-19',
    cityId,
    mode: surfaceMode.key,
    label: surfaceMode.label,
    access: surfaceMode.access,
    layerFamilies: MAP_LAYER_FAMILIES.filter((family) => !publicMode || !family.advanced),
    selectionScopes: MAP_SELECTION_SCOPES,
    controls: {
      cityCoverage: true,
      layerVisibility: true,
      layerDetail: surfaceMode.key !== MAP_SURFACE_MODES.publicShare.key,
      featureInspection: true,
      semanticQuery: surfaceMode.key !== MAP_SURFACE_MODES.publicShare.key,
      share: surfaceMode.key !== MAP_SURFACE_MODES.publicShare.key,
    },
    hostCommands: {
      allowed: [
        'twin:set-visible-layers',
        'twin:set-layer-controls',
        'twin:set-city-scale',
        'twin:set-fidelity',
        'twin:set-semantic-query',
        'twin:clear-semantic-query',
        'twin:command',
      ],
      blockedOutsideManifest: true,
    },
  }
}
