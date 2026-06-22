export const VIEWER_COPY = {
  map: {
    title: 'Viewer controls',
    commandsTitle: 'View controls',
    bundlesTitle: 'Layer bundles',
    fidelityTitle: 'Drawing density',
    movement: 'Drag to pan. Wheel or pinch to zoom. Click a feature to inspect base, seed, and layer meaning.',
  },
  '3d': {
    title: 'Viewer controls',
    commandsTitle: 'View controls',
    bundlesTitle: 'Layer bundles',
    fidelityTitle: '3D density',
    movement: 'Orbit, pan, and zoom the scene. Camera presets change the municipal read without changing the data.',
  },
  immersive: {
    title: 'Viewer controls',
    commandsTitle: 'XR controls',
    bundlesTitle: 'Layer bundles',
    fidelityTitle: 'XR scene density',
    movement: 'Orbit the browser scene, keep layers focused, and enter WebXR when the device supports it.',
  },
}

export const DEFAULT_LAYER_DETAIL = 100

export function formatCount(value) {
  const next = Number(value ?? 0)
  if (!Number.isFinite(next)) return '0'
  return new Intl.NumberFormat('en-US').format(next)
}

export function groupLayers(layerDefinitions = []) {
  const groupOrder = [
    {
      key: 'base',
      title: 'Base twin',
      note: 'Open public geometry and observable baseline facts.',
    },
    {
      key: 'semanticSeed',
      title: 'Inferred seeds',
      note: 'Useful meaning inferred from public data, not authority-grade packs.',
    },
    {
      key: 'reference',
      title: 'Viewer helpers',
      note: 'Reference objects used to orient the surface.',
    },
  ]

  return groupOrder
    .map((group) => ({
      ...group,
      layers: layerDefinitions.filter((layer) => layer.twinCategoryKey === group.key),
    }))
    .filter((group) => group.layers.length)
}

export function hasLayerLabels(layer) {
  return ['buildings', 'roads', 'civic', 'mobility', 'commerce', 'wasteSeeds', 'places'].includes(layer?.key)
}

export function smartControlLabel(layer) {
  const labels = {
    roads: 'Visible roads',
    buildings: 'Visible buildings',
    greenBlue: 'Visible land',
    civic: 'Civic seeds',
    mobility: 'Mobility seeds',
    commerce: 'Daily economy',
    wasteSeeds: 'Waste seeds',
    places: 'Places',
  }
  return labels[layer?.key] ?? 'Detail'
}

export function supportsSmartDetail(layer) {
  return !['boundary', 'unclassifiedLand'].includes(layer?.key)
}
