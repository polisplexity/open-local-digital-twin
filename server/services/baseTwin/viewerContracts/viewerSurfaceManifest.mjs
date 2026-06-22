import {
  MAP_LAYER_FAMILIES,
  MAP_SELECTION_SCOPES,
  MAP_SURFACE_MODES,
  buildMapSurfaceManifest,
  resolveMapSurfaceMode,
} from './mapSurfaceManifest.mjs'

export const VIEWER_SURFACE_KEYS = {
  map: 'map',
  municipal3d: 'municipal3d',
  immersive: 'immersive',
}

const SURFACE_ALIASES = {
  analytical: VIEWER_SURFACE_KEYS.map,
  'analytical-map': VIEWER_SURFACE_KEYS.map,
  cockpit: VIEWER_SURFACE_KEYS.map,
  map: VIEWER_SURFACE_KEYS.map,
  '3d': VIEWER_SURFACE_KEYS.municipal3d,
  municipal: VIEWER_SURFACE_KEYS.municipal3d,
  municipal3d: VIEWER_SURFACE_KEYS.municipal3d,
  'municipal-3d': VIEWER_SURFACE_KEYS.municipal3d,
  public: VIEWER_SURFACE_KEYS.immersive,
  'civic-xr': VIEWER_SURFACE_KEYS.immersive,
  'civic-view': VIEWER_SURFACE_KEYS.immersive,
  immersive: VIEWER_SURFACE_KEYS.immersive,
  story: VIEWER_SURFACE_KEYS.immersive,
  xr: VIEWER_SURFACE_KEYS.immersive,
}

const SURFACE_CONTRACTS = {
  [VIEWER_SURFACE_KEYS.map]: {
    surface: VIEWER_SURFACE_KEYS.map,
    label: 'Analytical Map',
    route: '/live/current/map',
    role: 'city-analyst',
    purpose: 'Spatial analysis, source review, indicators, and selected-area inspection.',
    defaultMode: MAP_SURFACE_MODES.cockpit.key,
    layerFamilies: MAP_LAYER_FAMILIES,
    selectionScopes: MAP_SELECTION_SCOPES,
    controls: {
      cityCoverage: true,
      layerVisibility: true,
      layerDetail: true,
      featureInspection: true,
      areaSelection: true,
      semanticQuery: true,
      share: true,
    },
  },
  [VIEWER_SURFACE_KEYS.municipal3d]: {
    surface: VIEWER_SURFACE_KEYS.municipal3d,
    label: 'City 3D',
    route: '/live/current/3d',
    role: 'municipal-validator',
    purpose: 'Cesium spatial inspection of base geometry, attached BIM/provider evidence, and semantic attachment points.',
    defaultMode: MAP_SURFACE_MODES.cockpit.key,
    layerFamilies: MAP_LAYER_FAMILIES.filter((family) => (
      ['boundary', 'roads', 'buildings', 'greenBlue', 'places', 'accessSeeds', 'providerOverlays'].includes(family.key)
    )),
    selectionScopes: [
      ...MAP_SELECTION_SCOPES.filter((scope) => ['city', 'viewport', 'radius', 'district', 'block'].includes(scope.key)),
      {
        key: 'object',
        label: '3D object',
        authority: 'viewer-object',
        status: 'available',
      },
    ],
    controls: {
      cameraPresets: true,
      layerVisibility: true,
      layerDetail: false,
      featureInspection: true,
      areaSelection: true,
      bimLayers: true,
      spatialPhenomena: true,
      semanticQuery: true,
      share: true,
    },
  },
  [VIEWER_SURFACE_KEYS.immersive]: {
    surface: VIEWER_SURFACE_KEYS.immersive,
    label: 'Civic XR',
    route: '/live/current/immersive',
    role: 'civic-xr',
    purpose: 'Browser WebXR civic surface over known, inferred, and pending city-twin elements.',
    defaultMode: MAP_SURFACE_MODES.publicShare.key,
    layerFamilies: MAP_LAYER_FAMILIES.filter((family) => (
      ['boundary', 'roads', 'buildings', 'greenBlue', 'places', 'accessSeeds', 'semanticPacks'].includes(family.key)
    )),
    selectionScopes: MAP_SELECTION_SCOPES.filter((scope) => ['city', 'viewport', 'district'].includes(scope.key)),
    controls: {
      xrModes: true,
      xrExperienceModes: ['walk', 'compare', 'overlay'],
      xrEntryModes: ['desktop', 'vr', 'ar'],
      storyStops: false,
      layerVisibility: true,
      layerDetail: false,
      featureInspection: false,
      areaSelection: false,
      semanticQuery: true,
      share: true,
    },
  },
}

const HOST_COMMANDS = {
  [VIEWER_SURFACE_KEYS.map]: [
    'twin:set-visible-layers',
    'twin:set-layer-controls',
    'twin:set-city-scale',
    'twin:set-fidelity',
    'twin:set-selection',
    'twin:set-semantic-query',
    'twin:clear-semantic-query',
    'twin:command',
  ],
  [VIEWER_SURFACE_KEYS.municipal3d]: [
    'twin:set-visible-layers',
    'twin:set-fidelity',
    'twin:set-phenomena-mode',
    'twin:set-camera',
    'twin:set-selection',
    'twin:set-semantic-query',
    'twin:clear-semantic-query',
    'twin:command',
  ],
  [VIEWER_SURFACE_KEYS.immersive]: [
    'twin:set-visible-layers',
    'twin:set-xr-mode',
    'twin:set-fidelity',
    'twin:set-semantic-query',
    'twin:clear-semantic-query',
    'twin:command',
  ],
}

export function normalizeViewerSurface(surface = VIEWER_SURFACE_KEYS.map) {
  const key = String(surface ?? '').trim()
  return SURFACE_ALIASES[key] || SURFACE_ALIASES[key.toLowerCase()] || VIEWER_SURFACE_KEYS.map
}

export function buildViewerSurfaceManifest({
  cityId = 'current',
  surface = VIEWER_SURFACE_KEYS.map,
  mode = 'cockpit',
} = {}) {
  const surfaceKey = normalizeViewerSurface(surface)
  if (surfaceKey === VIEWER_SURFACE_KEYS.map) {
    return {
      surface: VIEWER_SURFACE_KEYS.map,
      ...buildMapSurfaceManifest({ cityId, mode }),
      route: cityId === 'current' ? '/live/current/map' : `/live/${encodeURIComponent(cityId)}/map`,
      embedRoute: cityId === 'current' ? '/live/current/map?embed=1' : `/live/${encodeURIComponent(cityId)}/map?embed=1`,
      productRole: SURFACE_CONTRACTS[VIEWER_SURFACE_KEYS.map].role,
      purpose: SURFACE_CONTRACTS[VIEWER_SURFACE_KEYS.map].purpose,
    }
  }

  const contract = SURFACE_CONTRACTS[surfaceKey]
  const surfaceMode = resolveMapSurfaceMode(mode || contract.defaultMode)
  const publicMode = surfaceMode.key === MAP_SURFACE_MODES.publicShare.key
  const layerFamilies = contract.layerFamilies.filter((family) => !publicMode || !family.advanced)
  return {
    version: '2026-05-19',
    cityId,
    surface: surfaceKey,
    mode: surfaceMode.key,
    label: contract.label,
    access: surfaceMode.access,
    productRole: contract.role,
    purpose: contract.purpose,
    route: cityId === 'current' ? contract.route : contract.route.replace('/current/', `/${encodeURIComponent(cityId)}/`),
    embedRoute: cityId === 'current'
      ? `${contract.route}?embed=1`
      : `${contract.route.replace('/current/', `/${encodeURIComponent(cityId)}/`)}?embed=1`,
    layerFamilies,
    selectionScopes: contract.selectionScopes,
    controls: {
      ...contract.controls,
      share: contract.controls.share && surfaceMode.key !== MAP_SURFACE_MODES.publicShare.key,
    },
    hostCommands: {
      allowed: HOST_COMMANDS[surfaceKey],
      blockedOutsideManifest: true,
    },
  }
}

export function buildViewerSurfaceManifestIndex({ cityId = 'current', mode = 'cockpit' } = {}) {
  return Object.values(VIEWER_SURFACE_KEYS).map((surface) => buildViewerSurfaceManifest({
    cityId,
    surface,
    mode: surface === VIEWER_SURFACE_KEYS.immersive ? 'publicShare' : mode,
  }))
}
