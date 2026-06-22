function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export const CITY_3D_PHENOMENA_MODES = [
  {
    key: 'off',
    buttonLabel: 'Base',
    runtime: false,
    commandAliases: ['phenomena-off', 'phenomena-hide', 'base', 'off'],
  },
  {
    key: 'builtIntensity',
    buttonLabel: 'Built form density',
    label: 'Built form density',
    layerKey: 'built_form_proxy',
    glyph: 'surface',
    commandAliases: ['phenomena-built-form', 'built-form', 'urban-form'],
  },
  {
    key: 'terrainElevation',
    buttonLabel: 'Terrain relief',
    label: 'Terrain elevation',
    layerKey: 'terrain_elevation_m',
    glyph: 'terrain',
    commandAliases: ['phenomena-terrain', 'terrain', 'elevation', 'altitude', 'dem'],
  },
  {
    key: 'terrainSlope',
    buttonLabel: 'Slope surface',
    label: 'Terrain slope',
    layerKey: 'terrain_slope_deg',
    glyph: 'terrain',
    commandAliases: ['phenomena-slope', 'slope', 'terrain-slope'],
  },
  {
    key: 'airTemperature',
    buttonLabel: 'Air temperature',
    label: 'Air temperature',
    layerKey: 'weather_air_temperature_c',
    glyph: 'surface',
    valueUnit: '°C',
    commandAliases: ['phenomena-temperature', 'temperature', 'air-temperature', 'weather-temperature'],
  },
  {
    key: 'surfaceWater',
    buttonLabel: 'Water signal',
    label: 'Surface water signal',
    layerKey: 'hydrology_surface_water_signal',
    glyph: 'surface',
    valueUnit: 'score',
    commandAliases: ['phenomena-water', 'water', 'hydrology', 'surface-water', 'water-signal'],
  },
  {
    key: 'surfaceRunoff',
    buttonLabel: 'Runoff scenario',
    label: 'Surface runoff screening',
    layerKey: 'surface_runoff_screening',
    glyph: 'surface',
    valueUnit: 'score',
    commandAliases: ['phenomena-runoff', 'runoff', 'surface-runoff', 'rain-runoff', 'water-scenario'],
  },
]

export function city3dPhenomenaRuntimeConfig() {
  return Object.fromEntries(
    CITY_3D_PHENOMENA_MODES
      .filter((mode) => mode.runtime !== false)
      .map((mode) => [
        mode.key,
        {
          layerKey: mode.layerKey,
          label: mode.label,
          glyph: mode.glyph,
          ...(mode.valueUnit ? { valueUnit: mode.valueUnit } : {}),
        },
      ]),
  )
}

export function city3dPhenomenaCommandMap() {
  const entries = []
  CITY_3D_PHENOMENA_MODES.forEach((mode) => {
    const aliases = [mode.key, ...(mode.commandAliases || [])]
    aliases.forEach((alias) => {
      entries.push([alias, mode.key])
    })
  })
  return Object.fromEntries(entries)
}

export function renderCity3dPhenomenaButtons() {
  return CITY_3D_PHENOMENA_MODES
    .map((mode) => {
      const active = mode.key === 'off' ? 'true' : 'false'
      return `<button type="button" data-phenomena-mode="${escapeHtml(mode.key)}" aria-pressed="${active}">${escapeHtml(mode.buttonLabel || mode.label)}</button>`
    })
    .join('\n              ')
}
