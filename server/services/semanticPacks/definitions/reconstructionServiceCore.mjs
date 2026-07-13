const PACK_KEY = 'reconstruction-service-core'
const PACK_VERSION = '0.1.0'

const CRITICAL_FACILITY_CATEGORIES = [
  'hospital',
  'clinic',
  'doctors',
  'pharmacy',
  'police',
  'fire_station',
  'shelter',
  'school',
  'university',
  'kindergarten',
  'college',
  'townhall',
  'community_centre',
  'public_building',
]

const HEALTH_CATEGORIES = ['hospital', 'clinic', 'doctors', 'pharmacy']
const EMERGENCY_CATEGORIES = ['police', 'fire_station', 'shelter', 'hospital']
const EDUCATION_CATEGORIES = ['school', 'university', 'kindergarten', 'college']
const MAJOR_ROAD_CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']

const PACK_MANIFEST = {
  packKey: PACK_KEY,
  version: PACK_VERSION,
  name: 'Reconstruction Service Core',
  domain: 'reconstruction-and-service-continuity',
  purpose: 'Prepare a city-owned reconstruction/service-continuity layer from open base-twin inventory before authority damage, population, or project data arrives.',
  inputs: [
    'city boundary',
    'consolidated building inventory',
    'road network geometry',
    'public service anchors',
    'future authority damage assessment layer',
    'future population or shelter-demand layer',
  ],
  outputs: [
    'readiness indicators',
    'critical service anchors',
    'major access spine candidates',
    'city review workflow',
    'machine-readable service pack export',
  ],
  claimsBlockedWithoutAuthorityEvidence: [
    'damaged buildings',
    'affected population',
    'formal reconstruction priority',
    'budget priority',
    'official critical infrastructure status',
  ],
  publicDataBoundary: 'Open-data seed pack. It must not claim damage, casualty, vulnerability, or project priority without official/city-owned datasets.',
}

const REQUIRED_SOURCES = [
  {
    key: 'city-boundary',
    label: 'City boundary',
    sourceStatus: 'connected',
    requiredFor: ['city scope', 'territorial reporting', 'pack binding'],
    blockedClaims: [],
  },
  {
    key: 'building-inventory',
    label: 'Consolidated building inventory',
    sourceStatus: 'connected',
    requiredFor: ['built-fabric baseline', 'reconstruction review denominator'],
    blockedClaims: [],
  },
  {
    key: 'road-network',
    label: 'Road network geometry',
    sourceStatus: 'connected',
    requiredFor: ['access-spine candidates', 'mobility continuity review'],
    blockedClaims: [],
  },
  {
    key: 'public-service-anchors',
    label: 'Public service anchors',
    sourceStatus: 'available',
    requiredFor: ['critical-service candidates', 'continuity review'],
    blockedClaims: ['official critical infrastructure status'],
  },
  {
    key: 'official-damage-assessment',
    label: 'Official or validated damage assessment',
    sourceStatus: 'missing',
    requiredFor: ['damage severity', 'reconstruction priority', 'investment sequence'],
    blockedClaims: ['damaged buildings', 'formal reconstruction priority', 'budget priority'],
  },
  {
    key: 'population-demand',
    label: 'Population, shelter-demand, or service-demand denominator',
    sourceStatus: 'missing',
    requiredFor: ['people affected', 'equity/access prioritization', 'underserved population'],
    blockedClaims: ['affected population', 'equity-weighted priority', 'service-demand priority'],
  },
]

const PACK_RULES = [
  {
    key: 'base_inventory_required',
    type: 'input-validation',
    inputTypes: ['building', 'road', 'facility'],
    outputRole: 'base-readiness',
    confidenceRule: 'open inventory exists but authority validation is pending',
    sourceQuality: 'open-data-derived',
    body: {
      requiredInputs: ['buildings', 'roads', 'critical facilities'],
      missingInputsBlockPriorityClaims: true,
    },
  },
  {
    key: 'critical_service_anchor',
    type: 'classification',
    inputTypes: ['facility'],
    outputRole: 'critical-service-anchor',
    confidenceRule: 'category match from open service/facility tags',
    sourceQuality: 'open-data-seed',
    body: {
      categories: CRITICAL_FACILITY_CATEGORIES,
      interpretation: 'Candidate continuity anchors, not official critical infrastructure records.',
    },
  },
  {
    key: 'major_access_spine',
    type: 'classification',
    inputTypes: ['road'],
    outputRole: 'access-spine-candidate',
    confidenceRule: 'major road class from open road tags',
    sourceQuality: 'open-data-seed',
    body: {
      roadClasses: MAJOR_ROAD_CLASSES,
      interpretation: 'Access spine candidates for review; not a routing or logistics model yet.',
    },
  },
  {
    key: 'damage_layer_required',
    type: 'gap-rule',
    inputTypes: ['building'],
    outputRole: 'reconstruction-priority-blocker',
    confidenceRule: 'priority cannot be computed without damage evidence',
    sourceQuality: 'missing-required-source',
    body: {
      requiredSource: 'official or validated damage assessment',
      blockedOutputs: ['damage severity', 'reconstruction priority', 'investment sequence'],
    },
  },
  {
    key: 'population_demand_required',
    type: 'gap-rule',
    inputTypes: ['place', 'administrative_geography'],
    outputRole: 'service-demand-blocker',
    confidenceRule: 'equity/access prioritization cannot be computed without demand denominators',
    sourceQuality: 'missing-required-source',
    body: {
      requiredSource: 'population grid, district demographics, shelter demand, or city service demand dataset',
      blockedOutputs: ['people affected', 'underserved population', 'equity-weighted priority'],
    },
  },
]

function parseNumeric(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(parseNumeric(value) * factor) / factor
}

async function computeCityMetrics(client, cityId) {
  const result = await client.query(
    `
      WITH city AS (
        SELECT id, name, country, region
        FROM ldt_core.cities
        WHERE id = $1
      ),
      boundary AS (
        SELECT ST_Area(ST_UnaryUnion(ST_Collect(geom))::geography) / 1000000.0 AS area_km2
        FROM ldt_core.city_boundaries
        WHERE city_id = $1
      ),
      entity_counts AS (
        SELECT entity_type, count(*)::int AS count
        FROM ldt_core.city_entities
        WHERE city_id = $1
        GROUP BY entity_type
      ),
      facility_counts AS (
        SELECT
          COALESCE(fe.category, fe.amenity, ce.properties->'sourceProperties'->>'shop', 'unknown') AS category,
          count(*)::int AS count
        FROM ldt_core.city_entities ce
        JOIN ldt_core.facility_entities fe ON fe.entity_id = ce.id
        WHERE ce.city_id = $1
        GROUP BY COALESCE(fe.category, fe.amenity, ce.properties->'sourceProperties'->>'shop', 'unknown')
      ),
      road_lengths AS (
        SELECT
          COALESCE(re.road_class, ce.properties->'sourceProperties'->>'highway', 'unknown') AS road_class,
          sum(ST_Length(ce.geom::geography)) / 1000.0 AS km
        FROM ldt_core.city_entities ce
        JOIN ldt_core.road_entities re ON re.entity_id = ce.id
        WHERE ce.city_id = $1
          AND ce.geom IS NOT NULL
        GROUP BY COALESCE(re.road_class, ce.properties->'sourceProperties'->>'highway', 'unknown')
      )
      SELECT
        city.id,
        city.name,
        city.country,
        city.region,
        COALESCE(boundary.area_km2, 0) AS area_km2,
        COALESCE((SELECT count FROM entity_counts WHERE entity_type = 'building'), 0) AS building_count,
        COALESCE((SELECT count FROM entity_counts WHERE entity_type = 'road'), 0) AS road_count,
        COALESCE((SELECT count FROM entity_counts WHERE entity_type = 'facility'), 0) AS facility_count,
        COALESCE((SELECT count FROM entity_counts WHERE entity_type = 'place'), 0) AS place_count,
        COALESCE((SELECT sum(count)::int FROM facility_counts WHERE category = ANY($2::text[])), 0) AS critical_anchor_count,
        COALESCE((SELECT sum(count)::int FROM facility_counts WHERE category = ANY($3::text[])), 0) AS health_anchor_count,
        COALESCE((SELECT sum(count)::int FROM facility_counts WHERE category = ANY($4::text[])), 0) AS emergency_anchor_count,
        COALESCE((SELECT sum(count)::int FROM facility_counts WHERE category = ANY($5::text[])), 0) AS education_anchor_count,
        COALESCE((SELECT sum(km) FROM road_lengths), 0) AS road_km,
        COALESCE((SELECT sum(km) FROM road_lengths WHERE road_class = ANY($6::text[])), 0) AS major_road_km
      FROM city, boundary
    `,
    [
      cityId,
      CRITICAL_FACILITY_CATEGORIES,
      HEALTH_CATEGORIES,
      EMERGENCY_CATEGORIES,
      EDUCATION_CATEGORIES,
      MAJOR_ROAD_CLASSES,
    ],
  )
  if (result.rowCount === 0) throw new Error(`LDT_CITY_NOT_FOUND:${cityId}`)
  return result.rows[0]
}

function buildIndicators(metrics) {
  const areaKm2 = parseNumeric(metrics.area_km2)
  const buildings = parseNumeric(metrics.building_count)
  const roads = parseNumeric(metrics.road_count)
  const facilities = parseNumeric(metrics.facility_count)
  const criticalAnchors = parseNumeric(metrics.critical_anchor_count)
  const healthAnchors = parseNumeric(metrics.health_anchor_count)
  const emergencyAnchors = parseNumeric(metrics.emergency_anchor_count)
  const educationAnchors = parseNumeric(metrics.education_anchor_count)
  const roadKm = parseNumeric(metrics.road_km)
  const majorRoadKm = parseNumeric(metrics.major_road_km)

  const baseInputs = [
    areaKm2 > 0,
    buildings > 0,
    roads > 0,
    facilities > 0,
    criticalAnchors > 0,
    majorRoadKm > 0,
  ].filter(Boolean).length
  const readiness = round((baseInputs / 8) * 100, 1)

  return [
    {
      key: 'pack_readiness',
      label: 'Pack readiness',
      value: readiness,
      unit: '%',
      quality: readiness >= 60 ? 'open-data-actionable-seed' : 'open-data-gap',
      method: {
        formula: 'present_open_inputs / required_pack_inputs',
        inputsPresent: baseInputs,
        requiredInputs: 8,
        missingRequiredInputs: ['validated damage layer', 'population or service-demand denominator'],
      },
    },
    {
      key: 'building_inventory_assets',
      label: 'Building inventory assets',
      value: buildings,
      unit: 'buildings',
      quality: 'open-data-derived',
      method: { formula: 'count(consolidated building entities)' },
    },
    {
      key: 'critical_service_anchors',
      label: 'Critical service anchors',
      value: criticalAnchors,
      unit: 'anchors',
      quality: 'open-data-seed',
      method: { formula: 'count(facilities matching critical service categories)' },
    },
    {
      key: 'emergency_anchor_count',
      label: 'Emergency anchors',
      value: emergencyAnchors,
      unit: 'anchors',
      quality: 'open-data-seed',
      method: { formula: 'count(police, fire_station, shelter, hospital)' },
    },
    {
      key: 'health_anchor_count',
      label: 'Health anchors',
      value: healthAnchors,
      unit: 'anchors',
      quality: 'open-data-seed',
      method: { formula: 'count(hospital, clinic, doctors, pharmacy)' },
    },
    {
      key: 'education_anchor_count',
      label: 'Education anchors',
      value: educationAnchors,
      unit: 'anchors',
      quality: 'open-data-seed',
      method: { formula: 'count(school, university, kindergarten, college)' },
    },
    {
      key: 'major_access_spine_km',
      label: 'Major access spine',
      value: round(majorRoadKm, 2),
      unit: 'km',
      quality: 'open-data-seed',
      method: { formula: 'sum(length of motorway/trunk/primary/secondary/tertiary roads)' },
    },
    {
      key: 'road_network_km',
      label: 'Open road network',
      value: round(roadKm, 2),
      unit: 'km',
      quality: 'open-data-derived',
      method: { formula: 'sum(length of road geometries)' },
    },
    {
      key: 'damage_data_connected',
      label: 'Damage data connected',
      value: 0,
      unit: '%',
      quality: 'missing-required-source',
      method: { formula: 'validated_damage_layer_connected ? 100 : 0' },
    },
    {
      key: 'population_demand_connected',
      label: 'Population demand connected',
      value: 0,
      unit: '%',
      quality: 'missing-required-source',
      method: { formula: 'population_or_service_demand_layer_connected ? 100 : 0' },
    },
  ].map((indicator) => ({
    ...indicator,
    valueJson: {
      cityAreaKm2: round(areaKm2, 2),
      sourceBoundary: 'ldt_core.city_boundaries',
      baseInputs: { buildings, roads, facilities, criticalAnchors, majorRoadKm: round(majorRoadKm, 2) },
    },
  }))
}

function buildQualitySummary(metrics, indicators) {
  const readiness = indicators.find((indicator) => indicator.key === 'pack_readiness')?.value ?? 0
  return {
    readiness,
    posture: 'open-data-seed-not-authority-priority',
    canShow: [
      'base building inventory',
      'critical service anchors',
      'major access spine candidates',
      'missing-source blockers',
    ],
    cannotClaimYet: PACK_MANIFEST.claimsBlockedWithoutAuthorityEvidence,
    sourceGaps: [
      'official damage assessment',
      'population or shelter demand',
      'authority critical infrastructure registry',
      'validated road accessibility/routing graph',
    ],
    openInventory: {
      buildings: parseNumeric(metrics.building_count),
      roads: parseNumeric(metrics.road_count),
      facilities: parseNumeric(metrics.facility_count),
      criticalAnchors: parseNumeric(metrics.critical_anchor_count),
    },
  }
}

function buildBindingConfiguration() {
  return {
    defaultMode: 'reconstruction-readiness',
    featurePolicy: 'store-service-anchors-and-major-roads-only',
    fullBuildingInventory: 'referenced-from-ldt_core-building-entities',
  }
}

async function refreshServiceFeatures(client, cityId, packId) {
  await client.query('DELETE FROM ldt_semantic.service_features WHERE city_id = $1 AND pack_id = $2', [cityId, packId])

  const anchors = await client.query(
    `
      INSERT INTO ldt_semantic.service_features (
        city_id,
        pack_id,
        entity_id,
        feature_key,
        service_role,
        label,
        geom,
        properties,
        quality,
        updated_at
      )
      SELECT
        ce.city_id,
        $2,
        ce.id,
        'critical-anchor:' || ce.stable_id,
        'critical-service-anchor',
        COALESCE(ce.label, fe.category, fe.amenity, 'Critical service anchor'),
        ce.geom,
        jsonb_build_object(
          'entityType', ce.entity_type,
          'category', COALESCE(fe.category, fe.amenity, ce.properties->'sourceProperties'->>'shop'),
          'packRule', 'critical_service_anchor',
          'sourceQuality', 'open-data-seed',
          'authorityWarning', 'Candidate continuity anchor; verify with city registry.'
        ),
        'open-data-seed',
        now()
      FROM ldt_core.city_entities ce
      JOIN ldt_core.facility_entities fe ON fe.entity_id = ce.id
      WHERE ce.city_id = $1
        AND COALESCE(fe.category, fe.amenity, ce.properties->'sourceProperties'->>'shop') = ANY($3::text[])
      ON CONFLICT (city_id, pack_id, feature_key) DO NOTHING
    `,
    [cityId, packId, CRITICAL_FACILITY_CATEGORIES],
  )

  const roads = await client.query(
    `
      INSERT INTO ldt_semantic.service_features (
        city_id,
        pack_id,
        entity_id,
        feature_key,
        service_role,
        label,
        geom,
        properties,
        quality,
        updated_at
      )
      SELECT
        ce.city_id,
        $2,
        ce.id,
        'access-spine:' || ce.stable_id,
        'access-spine-candidate',
        COALESCE(ce.label, re.name, re.road_class, 'Access spine candidate'),
        ce.geom,
        jsonb_build_object(
          'entityType', ce.entity_type,
          'roadClass', COALESCE(re.road_class, ce.properties->'sourceProperties'->>'highway'),
          'roadName', re.name,
          'packRule', 'major_access_spine',
          'sourceQuality', 'open-data-seed',
          'authorityWarning', 'Candidate access spine; not a routing model.'
        ),
        'open-data-seed',
        now()
      FROM ldt_core.city_entities ce
      JOIN ldt_core.road_entities re ON re.entity_id = ce.id
      WHERE ce.city_id = $1
        AND COALESCE(re.road_class, ce.properties->'sourceProperties'->>'highway') = ANY($3::text[])
      ON CONFLICT (city_id, pack_id, feature_key) DO NOTHING
    `,
    [cityId, packId, MAJOR_ROAD_CLASSES],
  )

  return {
    criticalAnchors: anchors.rowCount,
    accessSpines: roads.rowCount,
  }
}

function buildWorkflows(metrics) {
  return [
    {
      key: 'confirm-base-inventory',
      title: 'Confirm open base inventory with the city team',
      status: 'ready-for-city-review',
      priority: 'high',
      actions: [
        'Review boundary and administrative scope.',
        'Review consolidated building inventory and provider uplift.',
        'Review critical service anchor categories before presenting them as city services.',
      ],
      inputs: {
        buildings: parseNumeric(metrics.building_count),
        roads: parseNumeric(metrics.road_count),
        criticalAnchors: parseNumeric(metrics.critical_anchor_count),
      },
      outputs: {
        decision: 'base inventory accepted, corrected, or replaced by official datasets',
      },
    },
    {
      key: 'connect-damage-layer',
      title: 'Connect validated damage assessment',
      status: 'blocked-by-source',
      priority: 'critical',
      actions: [
        'Register official or validated damage layer as a provider layer.',
        'Map damage severity fields to the reconstruction pack schema.',
        'Keep damage evidence separate from open inferred assumptions.',
      ],
      inputs: {
        requiredSource: 'damage assessment polygons, points, or building-linked records',
      },
      outputs: {
        decision: 'damage data connected before reconstruction priority is computed',
      },
    },
    {
      key: 'connect-population-demand',
      title: 'Connect population or shelter-demand denominator',
      status: 'blocked-by-source',
      priority: 'high',
      actions: [
        'Add official district population, population grid, shelter demand, or service-demand records.',
        'Apply privacy and aggregation policy before public views.',
        'Use demand denominator for equity-weighted service gaps.',
      ],
      inputs: {
        requiredSource: 'population or service demand dataset',
      },
      outputs: {
        decision: 'equity and people-affected indicators become computable',
      },
    },
    {
      key: 'publish-pack-export',
      title: 'Publish machine-readable reconstruction seed export',
      status: 'ready',
      priority: 'medium',
      actions: [
        'Use the pack export for meeting review.',
        'Share manifest, indicators, source gaps, and workflow states without claiming official priority.',
      ],
      inputs: {
        export: `${PACK_KEY}:summary`,
      },
      outputs: {
        decision: 'city can review the pack as a transparent open-source starting point',
      },
    },
  ]
}

function buildExportPayload({ metrics, indicators, workflows, featureCounts, ruleCheckCount }) {
  return {
    pack: {
      packKey: PACK_KEY,
      version: PACK_VERSION,
      name: 'Reconstruction Service Core',
      domain: PACK_MANIFEST.domain,
      runtime: 'manifest-runtime',
    },
    city: {
      id: metrics.id,
      name: metrics.name,
      country: metrics.country,
      region: metrics.region,
      areaKm2: round(metrics.area_km2, 2),
    },
    indicators: indicators.map((indicator) => ({
      key: indicator.key,
      label: indicator.label,
      value: indicator.value,
      unit: indicator.unit,
      quality: indicator.quality,
    })),
    workflowStatus: workflows.map((workflow) => ({
      key: workflow.key,
      title: workflow.title,
      status: workflow.status,
      priority: workflow.priority,
    })),
    serviceFeatures: featureCounts,
    ruleChecks: ruleCheckCount,
    publicDataBoundary: PACK_MANIFEST.publicDataBoundary,
    blockedClaims: PACK_MANIFEST.claimsBlockedWithoutAuthorityEvidence,
    generatedAt: new Date().toISOString(),
  }
}

function buildRunSummary({ cityId, metrics, indicators, featureCounts, ruleCheckCount }) {
  return {
    cityId,
    name: metrics.name,
    packKey: PACK_KEY,
    readiness: indicators.find((indicator) => indicator.key === 'pack_readiness')?.value ?? 0,
    buildings: parseNumeric(metrics.building_count),
    criticalAnchors: parseNumeric(metrics.critical_anchor_count),
    majorRoadKm: round(metrics.major_road_km, 2),
    serviceFeatures: parseNumeric(featureCounts.criticalAnchors) + parseNumeric(featureCounts.accessSpines),
    ruleChecks: ruleCheckCount,
  }
}

function ruleInputSnapshot(metrics) {
  return {
    cityId: metrics.id,
    buildings: parseNumeric(metrics.building_count),
    roads: parseNumeric(metrics.road_count),
    facilities: parseNumeric(metrics.facility_count),
    criticalAnchors: parseNumeric(metrics.critical_anchor_count),
    majorRoadKm: round(metrics.major_road_km, 2),
  }
}

export const reconstructionServiceCorePack = {
  packKey: PACK_KEY,
  version: PACK_VERSION,
  name: 'Reconstruction Service Core',
  domain: PACK_MANIFEST.domain,
  description: 'Reference semantic pack for reconstruction readiness and critical service continuity using open base-twin inventory.',
  lifecycleStatus: 'reference-implementation',
  authorityStatus: 'open-reference',
  bindingStatus: 'generated',
  bindingAuthorityStatus: 'open-data-seed',
  manifest: PACK_MANIFEST,
  requiredSources: REQUIRED_SOURCES,
  standardsMapping: {
    ldt: 'semantic-pack',
    ngsiLd: ['Building', 'Road', 'PointOfInterest'],
    dcat: 'DatasetSeries',
    fiware: 'adapter-ready',
  },
  defaultRuleValidationSchema: {
    required: ['city_id', 'entity_type', 'source_quality'],
    packVersion: PACK_VERSION,
  },
  rules: PACK_RULES,
  workflowContract: {
    owningAuthority: 'Municipal reconstruction and service-continuity owner',
    handoffMethod: 'authenticated-pack-report-and-machine-readable-export',
    qualityGate: {
      mustReview: ['city boundary', 'critical service anchors', 'major access spine candidates'],
      blockedClaims: PACK_MANIFEST.claimsBlockedWithoutAuthorityEvidence,
    },
    metrics: ['pack_readiness', 'critical_service_anchors', 'major_access_spine_km', 'damage_data_connected', 'population_demand_connected'],
    authorityStatus: 'not-authority-approved',
    reviewState: 'generated',
    lifecycleStatus: 'generated',
    notes: PACK_MANIFEST.publicDataBoundary,
  },
  computeCityMetrics,
  buildIndicators,
  buildQualitySummary,
  buildBindingConfiguration,
  refreshServiceFeatures,
  buildWorkflows,
  buildExportPayload,
  buildRunSummary,
  ruleInputSnapshot,
}

export default reconstructionServiceCorePack
