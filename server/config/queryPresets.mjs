const TALLINN_QUERY_PRESETS = [
  {
    id: 'tallinn-walk-bike-network',
    title: 'Tallinn walk/bike network',
    description: 'Footways, paths, cycleways, pedestrian segments, steps, and living streets inside the city scope.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'roads'\nAND road_class IN ('footway', 'path', 'cycleway', 'pedestrian', 'steps', 'living_street')",
    classes: ['roads'],
    tags: ['mobility', 'walkability', 'bike'],
  },
  {
    id: 'tallinn-major-vehicle-network',
    title: 'Tallinn major vehicle network',
    description: 'Primary, secondary, tertiary, and trunk road segments for arterial network inspection.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'roads'\nAND road_class IN ('primary', 'secondary', 'tertiary', 'trunk')",
    classes: ['roads'],
    tags: ['mobility', 'roads'],
  },
  {
    id: 'tallinn-local-service-streets',
    title: 'Tallinn local service streets',
    description: 'Residential and service streets for local accessibility review.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'roads'\nAND road_class IN ('service', 'residential')",
    classes: ['roads'],
    tags: ['mobility', 'local-streets'],
  },
  {
    id: 'tallinn-water-route-artifacts',
    title: 'Tallinn water route artifacts',
    description: 'Road-class water features, mostly ferry or maritime routes, useful for data-quality review.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'roads'\nAND road_class = 'water'",
    classes: ['roads'],
    tags: ['quality', 'water', 'roads'],
  },
  {
    id: 'tallinn-large-buildings',
    title: 'Tallinn large buildings',
    description: 'Building footprints of 800 square meters or larger.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND ST_Area(co.geom::geography) >= 800",
    classes: ['buildings'],
    tags: ['built-fabric', 'large-footprints'],
  },
  {
    id: 'tallinn-very-large-buildings',
    title: 'Tallinn very large buildings',
    description: 'Building footprints of 5,000 square meters or larger.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND ST_Area(co.geom::geography) >= 5000",
    classes: ['buildings'],
    tags: ['built-fabric', 'large-footprints'],
  },
  {
    id: 'tallinn-missing-building-height',
    title: 'Tallinn buildings missing height',
    description: 'Buildings with no height value, useful for 3D readiness and source-quality review.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND height_m IS NULL",
    classes: ['buildings'],
    tags: ['quality', '3d-readiness'],
  },
  {
    id: 'tallinn-tall-buildings',
    title: 'Tallinn tall buildings',
    description: 'Buildings with height of at least 30 meters.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND height_m >= 30",
    classes: ['buildings'],
    tags: ['built-fabric', '3d'],
  },
  {
    id: 'tallinn-suspicious-low-height',
    title: 'Tallinn suspicious low height',
    description: 'Buildings with positive height lower than 2 meters, likely data-quality issues.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND height_m > 0\nAND height_m < 2",
    classes: ['buildings'],
    tags: ['quality', 'height'],
  },
  {
    id: 'tallinn-large-and-tall-buildings',
    title: 'Tallinn large and tall buildings',
    description: 'Buildings at least 20 meters high with footprints of 800 square meters or larger.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND height_m >= 20\nAND ST_Area(co.geom::geography) >= 800",
    classes: ['buildings'],
    tags: ['built-fabric', '3d', 'large-footprints'],
  },
]

const GAZIANTEP_QUERY_PRESETS = [
  {
    id: 'gaziantep-response-arterial-network',
    title: 'Gaziantep response arterial network',
    description: 'Motorway, trunk, primary, secondary, and tertiary corridors for emergency-access and response-route review.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'roads'\nAND road_class IN ('motorway', 'trunk', 'primary', 'secondary', 'tertiary')",
    classes: ['roads'],
    tags: ['urban-risk', 'mobility', 'emergency-access'],
  },
  {
    id: 'gaziantep-last-mile-access-streets',
    title: 'Gaziantep last-mile access streets',
    description: 'Residential, service, and living streets for neighborhood-level access review.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'roads'\nAND road_class IN ('residential', 'service', 'living_street')",
    classes: ['roads'],
    tags: ['urban-risk', 'mobility', 'last-mile'],
  },
  {
    id: 'gaziantep-pedestrian-evacuation-fabric',
    title: 'Gaziantep pedestrian evacuation fabric',
    description: 'Footways, paths, pedestrian segments, and steps that can support evacuation and public-space access review.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'roads'\nAND road_class IN ('footway', 'path', 'pedestrian', 'steps')",
    classes: ['roads'],
    tags: ['urban-risk', 'walkability', 'evacuation'],
  },
  {
    id: 'gaziantep-unclassified-road-review',
    title: 'Gaziantep unclassified road review',
    description: 'Road segments missing actionable hierarchy, useful for routing-readiness and data-quality review.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'roads'\nAND COALESCE(road_class, 'unknown') IN ('unclassified', 'unknown')",
    classes: ['roads'],
    tags: ['quality', 'mobility', 'routing-readiness'],
  },
  {
    id: 'gaziantep-large-footprint-buildings',
    title: 'Gaziantep large footprint buildings',
    description: 'Buildings with footprints of at least 1,000 square meters, useful for exposure, civic, industrial, or shelter-candidate review.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND ST_Area(co.geom::geography) >= 1000",
    classes: ['buildings'],
    tags: ['urban-risk', 'built-fabric', 'large-footprints'],
  },
  {
    id: 'gaziantep-very-large-roofs',
    title: 'Gaziantep very large roofs',
    description: 'Buildings with footprints of at least 5,000 square meters for assembly, logistics, or exposure screening.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND ST_Area(co.geom::geography) >= 5000",
    classes: ['buildings'],
    tags: ['urban-risk', 'built-fabric', 'large-footprints'],
  },
  {
    id: 'gaziantep-critical-civic-buildings',
    title: 'Gaziantep critical civic buildings',
    description: 'Schools, education, hospitals, universities, civic buildings, and train stations from the open baseline.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND building_type IN ('school', 'education', 'hospital', 'university', 'civic', 'train_station')",
    classes: ['buildings'],
    tags: ['urban-risk', 'civic-services', 'critical-facilities'],
  },
  {
    id: 'gaziantep-mosque-assembly-candidates',
    title: 'Gaziantep mosque assembly candidates',
    description: 'Mosque and religious building footprints that may matter for public assembly or preparedness conversations.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND building_type IN ('mosque', 'religious')",
    classes: ['buildings'],
    tags: ['urban-risk', 'assembly', 'public-facilities'],
  },
  {
    id: 'gaziantep-industrial-risk-candidates',
    title: 'Gaziantep industrial risk candidates',
    description: 'Industrial, warehouse, and commercial building candidates for exposure and continuity review.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND building_type IN ('industrial', 'warehouse', 'commercial')",
    classes: ['buildings'],
    tags: ['urban-risk', 'industry', 'continuity'],
  },
  {
    id: 'gaziantep-buildings-missing-height',
    title: 'Gaziantep buildings missing height',
    description: 'Buildings without height evidence, useful for 3D-readiness and data-enrichment planning.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND height_m IS NULL",
    classes: ['buildings'],
    tags: ['quality', '3d-readiness', 'height'],
  },
  {
    id: 'gaziantep-known-height-buildings',
    title: 'Gaziantep known height buildings',
    description: 'The small subset of buildings with current height evidence in the open baseline.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND height_m IS NOT NULL",
    classes: ['buildings'],
    tags: ['quality', '3d-readiness', 'height'],
  },
]

const GUANAJUATO_QUERY_PRESETS = [
  {
    id: 'guanajuato-ecobuild-high-sap-score',
    title: 'Guanajuato EcoBuild SAP score >= 80',
    description: 'Buildings enriched by the EU LDT EcoBuild contract with high simulated SAP score.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND sap_score >= 80",
    classes: ['buildings'],
    tags: ['eu-ldt', 'ecobuild', 'energy', 'model-enrichment'],
  },
  {
    id: 'guanajuato-ecobuild-mid-sap-score',
    title: 'Guanajuato EcoBuild SAP score 50-65',
    description: 'Buildings enriched by the EU LDT EcoBuild contract with mid-range simulated SAP score.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND sap_score BETWEEN 50 AND 65",
    classes: ['buildings'],
    tags: ['eu-ldt', 'ecobuild', 'energy', 'model-enrichment'],
  },
  {
    id: 'guanajuato-ecobuild-low-energy-label',
    title: 'Guanajuato EcoBuild energy label E-F',
    description: 'Buildings enriched by the EU LDT EcoBuild contract with lower simulated energy label.',
    mode: 'sql',
    sqlWhere: "semantic_class = 'buildings'\nAND energy_label IN ('E', 'F')",
    classes: ['buildings'],
    tags: ['eu-ldt', 'ecobuild', 'energy', 'model-enrichment'],
  },
]

const CITY_QUERY_PRESETS = {
  guanajuato: GUANAJUATO_QUERY_PRESETS,
  tallinn: TALLINN_QUERY_PRESETS,
  gaziantep: GAZIANTEP_QUERY_PRESETS,
}

function normalizePreset(cityId, preset, index) {
  const id = String(preset.id || `${cityId}-preset-${index + 1}`).trim()
  const title = String(preset.title || id).trim()
  const mode = preset.mode === 'sql' ? 'sql' : 'builder'
  const sqlWhere = typeof preset.sqlWhere === 'string' ? preset.sqlWhere.trim() : ''
  const classes = Array.isArray(preset.classes) && preset.classes.length ? preset.classes.filter(Boolean) : ['buildings']

  return {
    id,
    key: id,
    cityId,
    title,
    label: title,
    description: String(preset.description || '').trim(),
    mode,
    language: mode === 'sql' ? 'postgis-sql' : 'twinql-json',
    sqlWhere,
    classes,
    tags: Array.isArray(preset.tags) ? preset.tags.filter(Boolean) : [],
    query: {
      language: mode === 'sql' ? 'postgis-sql' : 'twinql-json',
      classes,
      scope: { key: 'city' },
      ...(sqlWhere ? { sqlWhere } : {}),
      render: { mode: 'isolate' },
      metadata: {
        source: 'query-preset',
        presetId: id,
        presetTitle: title,
      },
    },
  }
}

export function listCityQueryPresets(cityId) {
  const normalizedCityId = String(cityId ?? '').trim().toLowerCase()
  const presets = CITY_QUERY_PRESETS[normalizedCityId] ?? []
  return presets.map((preset, index) => normalizePreset(normalizedCityId, preset, index))
}
