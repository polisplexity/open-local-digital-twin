const PACK_KEY = 'urban-risk-preparedness-pack'
const PACK_VERSION = '0.1.0'

const EMERGENCY_FACILITY_CATEGORIES = [
  'hospital',
  'clinic',
  'doctors',
  'pharmacy',
  'police',
  'fire_station',
  'shelter',
  'townhall',
  'community_centre',
]

const HEALTH_FACILITY_CATEGORIES = ['hospital', 'clinic', 'doctors', 'pharmacy']
const RESPONSE_FACILITY_CATEGORIES = ['police', 'fire_station', 'shelter', 'hospital']
const MAJOR_ACCESS_CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']

const PACK_MANIFEST = {
  packKey: PACK_KEY,
  version: PACK_VERSION,
  name: 'Urban Risk Preparedness Pack',
  domain: 'urban-risk-and-emergency-preparedness',
  purpose: 'Prepare a generic urban-risk preparedness layer that can combine open base-twin exposure context with future hazard, terrain, population, emergency-resource, and authority response-plan sources.',
  inputs: [
    'city boundary',
    'consolidated building inventory',
    'road network geometry',
    'public service and emergency anchors',
    'future official hazard or risk evidence',
    'future terrain, slope, flood, fire, seismic, or geotechnical evidence',
    'future population, vulnerability, or exposure denominator',
    'future emergency shelters, assembly areas, resources, and response-plan state',
  ],
  outputs: [
    'risk preparedness readiness indicators',
    'open exposure-context candidates',
    'emergency anchor and access-spine candidates',
    'blocked risk and preparedness claims',
    'municipal risk workflow contract',
    'machine-readable urban-risk pack export',
  ],
  claimsBlockedWithoutAuthorityEvidence: [
    'official risk score',
    'hazard severity',
    'exposed population',
    'evacuation capacity',
    'shelter capacity',
    'formal emergency route status',
    'official emergency preparedness approval',
  ],
  publicDataBoundary: 'Dry-run urban-risk preparedness pack. It can expose open exposure context, emergency anchor candidates, and missing-source blockers, but it must not claim official risk, hazard severity, evacuation capacity, shelter capacity, or emergency-plan approval until authority sources are connected and validated.',
}

const REQUIRED_SOURCES = [
  {
    key: 'city-boundary',
    label: 'City boundary',
    sourceStatus: 'connected',
    requiredFor: ['risk scope', 'territorial reporting', 'pack binding'],
    blockedClaims: [],
  },
  {
    key: 'building-inventory',
    label: 'Consolidated building inventory',
    sourceStatus: 'connected',
    requiredFor: ['built exposure context', 'open exposure denominator', 'candidate review features'],
    blockedClaims: [],
  },
  {
    key: 'road-network',
    label: 'Road network geometry',
    sourceStatus: 'connected',
    requiredFor: ['access context', 'evacuation route candidates', 'response mobility context'],
    blockedClaims: [],
  },
  {
    key: 'public-service-anchors',
    label: 'Public service and emergency anchors',
    sourceStatus: 'available',
    requiredFor: ['response anchor candidates', 'service continuity context'],
    blockedClaims: ['official emergency resource status'],
  },
  {
    key: 'official-hazard-evidence',
    label: 'Official hazard or risk evidence',
    sourceStatus: 'missing',
    requiredFor: ['hazard severity', 'risk scoring', 'risk-zone review'],
    blockedClaims: ['official risk score', 'hazard severity'],
  },
  {
    key: 'terrain-and-hydrology-evidence',
    label: 'Terrain, slope, flood, hydrology, fire, seismic, or geotechnical evidence',
    sourceStatus: 'missing',
    requiredFor: ['terrain-sensitive risk context', 'flood/fire/seismic screening', 'geotechnical review'],
    blockedClaims: ['hazard severity', 'risk-zone classification', 'evacuation capacity'],
  },
  {
    key: 'population-vulnerability-denominator',
    label: 'Population, vulnerability, or exposure denominator',
    sourceStatus: 'missing',
    requiredFor: ['people exposed', 'equity/vulnerability indicators', 'priority weighting'],
    blockedClaims: ['exposed population', 'vulnerability priority', 'equity-weighted risk'],
  },
  {
    key: 'emergency-resource-registry',
    label: 'Emergency shelters, assembly areas, resources, and capacities',
    sourceStatus: 'missing',
    requiredFor: ['shelter capacity', 'assembly capacity', 'response resource allocation'],
    blockedClaims: ['evacuation capacity', 'shelter capacity', 'official emergency resource status'],
  },
  {
    key: 'authority-response-plan',
    label: 'Authority response plan, route status, and approval state',
    sourceStatus: 'missing',
    requiredFor: ['emergency route approval', 'public preparedness posture', 'authority sign-off'],
    blockedClaims: ['formal emergency route status', 'official emergency preparedness approval'],
  },
]

const PACK_RULES = [
  {
    key: 'base_exposure_context_required',
    type: 'input-validation',
    inputTypes: ['building', 'road', 'facility', 'boundary'],
    outputRole: 'risk-context-readiness',
    confidenceRule: 'open base inventory can support exposure context, not risk claims',
    sourceQuality: 'open-data-derived',
    body: {
      requiredInputs: ['city boundary', 'buildings', 'roads', 'service anchors'],
      interpretation: 'Open physical context can prepare risk conversations but cannot replace official hazard or emergency records.',
    },
  },
  {
    key: 'emergency_anchor_candidate',
    type: 'classification',
    inputTypes: ['facility'],
    outputRole: 'preparedness-anchor-candidate',
    confidenceRule: 'open facility category can identify candidate emergency or continuity anchors',
    sourceQuality: 'open-data-seed',
    body: {
      categories: EMERGENCY_FACILITY_CATEGORIES,
      interpretation: 'Candidate emergency anchors only; verify capacity, ownership, and public status with the authority registry.',
    },
  },
  {
    key: 'evacuation_access_spine_candidate',
    type: 'classification',
    inputTypes: ['road'],
    outputRole: 'evacuation-access-candidate',
    confidenceRule: 'major road class can identify access-spine candidates before official route validation',
    sourceQuality: 'open-data-seed',
    body: {
      roadClasses: MAJOR_ACCESS_CLASSES,
      interpretation: 'Candidate access spine only; not a routing model, capacity model, or official evacuation route.',
    },
  },
  {
    key: 'official_hazard_evidence_required',
    type: 'gap-rule',
    inputTypes: ['hazard_area', 'fault_line', 'risk_object', 'building_risk_assessment'],
    outputRole: 'hazard-claim-blocker',
    confidenceRule: 'hazard and risk claims require official or validated hazard evidence',
    sourceQuality: 'missing-required-source',
    body: {
      requiredSource: 'official hazard layer, validated risk model, or authority-approved risk evidence',
      blockedOutputs: ['official risk score', 'hazard severity', 'risk-zone classification'],
    },
  },
  {
    key: 'terrain_hydrology_evidence_required',
    type: 'gap-rule',
    inputTypes: ['terrain_tile', 'height_surface', 'slope_area', 'hazard_area'],
    outputRole: 'terrain-risk-blocker',
    confidenceRule: 'terrain-sensitive risk screening requires terrain, hydrology, or geotechnical evidence',
    sourceQuality: 'missing-required-source',
    body: {
      requiredSource: 'DEM, slope, hydrology, flood/fire/seismic/geotechnical layer, or validated terrain evidence',
      blockedOutputs: ['terrain-sensitive risk screen', 'flood exposure', 'slope/geotechnical hazard interpretation'],
    },
  },
  {
    key: 'population_vulnerability_required',
    type: 'gap-rule',
    inputTypes: ['place', 'administrative_geography', 'population_grid'],
    outputRole: 'exposure-denominator-blocker',
    confidenceRule: 'people exposed and vulnerability priority require population or demand denominators',
    sourceQuality: 'missing-required-source',
    body: {
      requiredSource: 'population grid, census unit, vulnerability index, shelter-demand layer, or service-demand denominator',
      blockedOutputs: ['exposed population', 'vulnerability priority', 'equity-weighted risk'],
    },
  },
  {
    key: 'emergency_resource_registry_required',
    type: 'gap-rule',
    inputTypes: ['shelter', 'assembly_area', 'emergency_resource'],
    outputRole: 'resource-capacity-blocker',
    confidenceRule: 'resource capacity claims require an emergency resource registry',
    sourceQuality: 'missing-required-source',
    body: {
      requiredSource: 'authority emergency shelter, assembly area, resource, and capacity registry',
      blockedOutputs: ['shelter capacity', 'evacuation capacity', 'official emergency resource status'],
    },
  },
  {
    key: 'authority_response_plan_required',
    type: 'gap-rule',
    inputTypes: ['preparedness_area', 'emergency_resource', 'mobility_asset'],
    outputRole: 'authority-response-plan-blocker',
    confidenceRule: 'preparedness approval requires authority response-plan and route status',
    sourceQuality: 'missing-required-source',
    body: {
      requiredSource: 'authority response plan, emergency route status, and review/sign-off state',
      blockedOutputs: ['formal emergency route status', 'official emergency preparedness approval'],
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

function indicatorValue(indicators, key, fallback = 0) {
  const indicator = indicators.find((entry) => entry.key === key)
  return indicator ? indicator.value : fallback
}

function sourceStatusCounts() {
  return REQUIRED_SOURCES.reduce((counts, source) => ({
    ...counts,
    [source.sourceStatus]: (counts[source.sourceStatus] || 0) + 1,
  }), {})
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
      building_evidence AS (
        SELECT
          count(*)::int AS building_profile_count,
          count(*) FILTER (WHERE be.height_m IS NOT NULL OR be.levels IS NOT NULL)::int AS building_height_evidence_count,
          count(*) FILTER (WHERE be.footprint_area_m2 IS NOT NULL)::int AS building_footprint_evidence_count
        FROM ldt_core.city_entities ce
        JOIN ldt_core.building_entities be ON be.entity_id = ce.id
        WHERE ce.city_id = $1
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
      ),
      semantic_evidence AS (
        SELECT
          count(*) FILTER (WHERE semantic_class_key = 'builtFabricRisk')::int AS built_fabric_risk_tag_count,
          count(*) FILTER (WHERE semantic_class_key = 'emergencyPreparedness')::int AS emergency_preparedness_tag_count,
          count(*) FILTER (WHERE semantic_class_key = 'geotechnicalHazard')::int AS geotechnical_hazard_tag_count,
          count(*) FILTER (WHERE semantic_class_key = 'terrainEvidence')::int AS terrain_evidence_tag_count
        FROM ldt_semantic.entity_semantic_tags est
        JOIN ldt_core.city_entities ce ON ce.id = est.entity_id
        WHERE ce.city_id = $1
          AND est.valid_to IS NULL
      ),
      mapping_evidence AS (
        SELECT
          count(*) FILTER (WHERE semantic_class_key = 'builtFabricRisk')::int AS built_fabric_risk_mapping_count,
          count(*) FILTER (WHERE semantic_class_key = 'emergencyPreparedness')::int AS emergency_preparedness_mapping_count,
          count(*) FILTER (WHERE semantic_class_key = 'geotechnicalHazard')::int AS geotechnical_hazard_mapping_count,
          count(*) FILTER (WHERE semantic_class_key = 'terrainEvidence')::int AS terrain_evidence_mapping_count
        FROM ldt_semantic.source_semantic_mappings
        WHERE city_id = $1 OR city_id IS NULL
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
        COALESCE((SELECT sum(count)::int FROM facility_counts WHERE category = ANY($2::text[])), 0) AS emergency_anchor_count,
        COALESCE((SELECT sum(count)::int FROM facility_counts WHERE category = ANY($3::text[])), 0) AS health_anchor_count,
        COALESCE((SELECT sum(count)::int FROM facility_counts WHERE category = ANY($4::text[])), 0) AS response_anchor_count,
        COALESCE((SELECT building_profile_count FROM building_evidence), 0) AS building_profile_count,
        COALESCE((SELECT building_height_evidence_count FROM building_evidence), 0) AS building_height_evidence_count,
        COALESCE((SELECT building_footprint_evidence_count FROM building_evidence), 0) AS building_footprint_evidence_count,
        COALESCE((SELECT sum(km) FROM road_lengths), 0) AS road_km,
        COALESCE((SELECT sum(km) FROM road_lengths WHERE road_class = ANY($5::text[])), 0) AS major_road_km,
        COALESCE((SELECT built_fabric_risk_tag_count FROM semantic_evidence), 0) AS built_fabric_risk_tag_count,
        COALESCE((SELECT emergency_preparedness_tag_count FROM semantic_evidence), 0) AS emergency_preparedness_tag_count,
        COALESCE((SELECT geotechnical_hazard_tag_count FROM semantic_evidence), 0) AS geotechnical_hazard_tag_count,
        COALESCE((SELECT terrain_evidence_tag_count FROM semantic_evidence), 0) AS terrain_evidence_tag_count,
        COALESCE((SELECT built_fabric_risk_mapping_count FROM mapping_evidence), 0) AS built_fabric_risk_mapping_count,
        COALESCE((SELECT emergency_preparedness_mapping_count FROM mapping_evidence), 0) AS emergency_preparedness_mapping_count,
        COALESCE((SELECT geotechnical_hazard_mapping_count FROM mapping_evidence), 0) AS geotechnical_hazard_mapping_count,
        COALESCE((SELECT terrain_evidence_mapping_count FROM mapping_evidence), 0) AS terrain_evidence_mapping_count
      FROM city
      LEFT JOIN boundary ON true
    `,
    [
      cityId,
      EMERGENCY_FACILITY_CATEGORIES,
      HEALTH_FACILITY_CATEGORIES,
      RESPONSE_FACILITY_CATEGORIES,
      MAJOR_ACCESS_CLASSES,
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
  const emergencyAnchors = parseNumeric(metrics.emergency_anchor_count)
  const healthAnchors = parseNumeric(metrics.health_anchor_count)
  const responseAnchors = parseNumeric(metrics.response_anchor_count)
  const heightEvidence = parseNumeric(metrics.building_height_evidence_count)
  const footprintEvidence = parseNumeric(metrics.building_footprint_evidence_count)
  const roadKm = parseNumeric(metrics.road_km)
  const majorRoadKm = parseNumeric(metrics.major_road_km)
  const riskMappings = parseNumeric(metrics.built_fabric_risk_mapping_count)
  const preparednessMappings = parseNumeric(metrics.emergency_preparedness_mapping_count)
  const hazardMappings = parseNumeric(metrics.geotechnical_hazard_mapping_count)
  const terrainMappings = parseNumeric(metrics.terrain_evidence_mapping_count)

  const counts = sourceStatusCounts()
  const sourceScore = (
    parseNumeric(counts.connected) +
    parseNumeric(counts.available) * 0.5 +
    parseNumeric(counts.validated) * 1.25
  ) / REQUIRED_SOURCES.length
  const readiness = round(sourceScore * 100, 1)
  const heightCoverage = buildings > 0 ? round((heightEvidence / buildings) * 100, 1) : 0
  const footprintCoverage = buildings > 0 ? round((footprintEvidence / buildings) * 100, 1) : 0

  return [
    {
      key: 'pack_readiness',
      label: 'Urban risk pack readiness',
      value: readiness,
      unit: '%',
      quality: 'dry-run-contract',
      method: {
        formula: 'weighted source status coverage',
        sourceStatusCounts: counts,
        requiredSources: REQUIRED_SOURCES.length,
      },
    },
    {
      key: 'base_exposure_context_connected',
      label: 'Base exposure context connected',
      value: areaKm2 > 0 && buildings > 0 && roads > 0 ? 100 : 0,
      unit: '%',
      quality: 'open-data-derived',
      method: { formula: 'city boundary + buildings + roads present' },
    },
    {
      key: 'building_exposure_assets',
      label: 'Building exposure assets',
      value: buildings,
      unit: 'buildings',
      quality: 'open-data-derived',
      method: { formula: 'count(consolidated building entities)' },
    },
    {
      key: 'building_height_evidence_coverage',
      label: 'Building height evidence coverage',
      value: heightCoverage,
      unit: '%',
      quality: heightCoverage > 0 ? 'open-data-derived' : 'open-data-gap',
      method: { formula: 'buildings with height or levels / buildings' },
    },
    {
      key: 'building_footprint_evidence_coverage',
      label: 'Building footprint evidence coverage',
      value: footprintCoverage,
      unit: '%',
      quality: footprintCoverage > 0 ? 'open-data-derived' : 'open-data-gap',
      method: { formula: 'buildings with footprint area / buildings' },
    },
    {
      key: 'road_access_context_km',
      label: 'Road access context',
      value: round(roadKm, 2),
      unit: 'km',
      quality: 'open-data-derived',
      method: { formula: 'sum(length of road geometries)' },
    },
    {
      key: 'major_access_spine_km',
      label: 'Major access spine candidates',
      value: round(majorRoadKm, 2),
      unit: 'km',
      quality: 'open-data-seed',
      method: { formula: 'sum(length of motorway/trunk/primary/secondary/tertiary roads)' },
    },
    {
      key: 'emergency_anchor_candidates',
      label: 'Emergency anchor candidates',
      value: emergencyAnchors,
      unit: 'anchors',
      quality: emergencyAnchors > 0 ? 'open-data-seed' : 'open-data-gap',
      method: { formula: 'count(open facilities matching emergency preparedness categories)' },
    },
    {
      key: 'response_anchor_candidates',
      label: 'Response anchor candidates',
      value: responseAnchors,
      unit: 'anchors',
      quality: responseAnchors > 0 ? 'open-data-seed' : 'open-data-gap',
      method: { formula: 'count(police, fire, shelter, hospital candidates)' },
    },
    {
      key: 'official_hazard_evidence_connected',
      label: 'Official hazard evidence connected',
      value: 0,
      unit: '%',
      quality: 'missing-required-source',
      method: { formula: 'official hazard/risk evidence connected ? 100 : 0' },
    },
    {
      key: 'terrain_hydrology_evidence_connected',
      label: 'Terrain and hydrology evidence connected',
      value: 0,
      unit: '%',
      quality: 'missing-required-source',
      method: { formula: 'terrain/hydrology/geotechnical evidence connected ? 100 : 0' },
    },
    {
      key: 'population_vulnerability_connected',
      label: 'Population vulnerability connected',
      value: 0,
      unit: '%',
      quality: 'missing-required-source',
      method: { formula: 'population/vulnerability denominator connected ? 100 : 0' },
    },
    {
      key: 'emergency_resource_registry_connected',
      label: 'Emergency resource registry connected',
      value: 0,
      unit: '%',
      quality: 'missing-required-source',
      method: { formula: 'emergency resource/capacity registry connected ? 100 : 0' },
    },
    {
      key: 'authority_response_plan_connected',
      label: 'Authority response plan connected',
      value: 0,
      unit: '%',
      quality: 'missing-required-source',
      method: { formula: 'authority response plan connected ? 100 : 0' },
    },
    {
      key: 'urban_risk_mapping_seed_count',
      label: 'Urban risk mapping seeds',
      value: riskMappings + preparednessMappings + hazardMappings + terrainMappings,
      unit: 'mappings',
      quality: 'registry-seed',
      method: { formula: 'count(source semantic mappings for urban-risk classes)' },
    },
  ].map((indicator) => ({
    ...indicator,
    valueJson: {
      cityAreaKm2: round(areaKm2, 2),
      facilities,
      healthAnchors,
      sourceStatusCounts: counts,
      mappingSeeds: {
        riskMappings,
        preparednessMappings,
        hazardMappings,
        terrainMappings,
      },
    },
  }))
}

function buildQualitySummary(metrics, indicators) {
  const readiness = indicatorValue(indicators, 'pack_readiness')
  return {
    readiness,
    posture: 'dry-run-contract-only',
    canShow: [
      'base exposure context',
      'emergency anchor candidates',
      'major access-spine candidates',
      'missing hazard/resource/authority source blockers',
      'workflow handoff contract',
    ],
    cannotClaimYet: PACK_MANIFEST.claimsBlockedWithoutAuthorityEvidence,
    requiredSources: REQUIRED_SOURCES,
    openInventory: {
      buildings: parseNumeric(metrics.building_count),
      roads: parseNumeric(metrics.road_count),
      roadKm: round(metrics.road_km, 2),
      emergencyAnchors: parseNumeric(metrics.emergency_anchor_count),
      majorRoadKm: round(metrics.major_road_km, 2),
    },
  }
}

function buildBindingConfiguration() {
  return {
    defaultMode: 'urban-risk-preparedness-dry-run',
    featurePolicy: 'store-open-exposure-context-candidates-only',
    riskSources: 'declared-as-required-but-not-connected',
    executionPolicy: {
      interactive: 'allowed for open base-twin summary and feature candidates',
      offlineDataFactory: 'required for terrain, hydrology, STAC, large hazard rasters, and full-state computation',
    },
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
        'preparedness-anchor:' || ce.stable_id,
        'preparedness-anchor-candidate',
        COALESCE(ce.label, fe.category, fe.amenity, 'Preparedness anchor candidate'),
        ce.geom,
        jsonb_build_object(
          'entityType', ce.entity_type,
          'category', COALESCE(fe.category, fe.amenity, ce.properties->'sourceProperties'->>'shop'),
          'packRule', 'emergency_anchor_candidate',
          'sourceQuality', 'open-data-seed',
          'authorityWarning', 'Candidate emergency/preparedness anchor; verify capacity and official status with authority records.'
        ),
        'open-data-seed',
        now()
      FROM ldt_core.city_entities ce
      JOIN ldt_core.facility_entities fe ON fe.entity_id = ce.id
      WHERE ce.city_id = $1
        AND COALESCE(fe.category, fe.amenity, ce.properties->'sourceProperties'->>'shop') = ANY($3::text[])
      ON CONFLICT (city_id, pack_id, feature_key) DO NOTHING
    `,
    [cityId, packId, EMERGENCY_FACILITY_CATEGORIES],
  )

  const accessSpines = await client.query(
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
        'evacuation-access:' || ce.stable_id,
        'evacuation-access-candidate',
        COALESCE(ce.label, re.name, re.road_class, 'Evacuation access candidate'),
        ce.geom,
        jsonb_build_object(
          'entityType', ce.entity_type,
          'roadClass', COALESCE(re.road_class, ce.properties->'sourceProperties'->>'highway'),
          'roadName', re.name,
          'packRule', 'evacuation_access_spine_candidate',
          'sourceQuality', 'open-data-seed',
          'authorityWarning', 'Candidate access spine; not a routing model, capacity model, or official evacuation route.'
        ),
        'open-data-seed',
        now()
      FROM ldt_core.city_entities ce
      JOIN ldt_core.road_entities re ON re.entity_id = ce.id
      WHERE ce.city_id = $1
        AND COALESCE(re.road_class, ce.properties->'sourceProperties'->>'highway') = ANY($3::text[])
      ON CONFLICT (city_id, pack_id, feature_key) DO NOTHING
    `,
    [cityId, packId, MAJOR_ACCESS_CLASSES],
  )

  const exposureCandidates = await client.query(
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
        'built-exposure:' || ce.stable_id,
        'built-exposure-review-candidate',
        COALESCE(ce.label, ce.properties->>'name', be.building_type, 'Built exposure candidate'),
        ce.geom,
        jsonb_build_object(
          'entityType', ce.entity_type,
          'buildingType', be.building_type,
          'useClass', be.use_class,
          'heightM', be.height_m,
          'levels', be.levels,
          'footprintAreaM2', be.footprint_area_m2,
          'packRule', 'base_exposure_context_required',
          'sourceQuality', 'open-data-context',
          'authorityWarning', 'Exposure context candidate only; no official risk or hazard claim.'
        ),
        'open-data-context',
        now()
      FROM ldt_core.city_entities ce
      LEFT JOIN ldt_core.building_entities be ON be.entity_id = ce.id
      WHERE ce.city_id = $1
        AND ce.entity_type = 'building'
        AND ce.geom IS NOT NULL
      ORDER BY COALESCE(be.height_m, be.levels * 3, be.footprint_area_m2 / 25, 0) DESC NULLS LAST, ce.stable_id
      LIMIT 500
      ON CONFLICT (city_id, pack_id, feature_key) DO NOTHING
    `,
    [cityId, packId],
  )

  return {
    preparednessAnchors: anchors.rowCount,
    evacuationAccessSpines: accessSpines.rowCount,
    builtExposureCandidates: exposureCandidates.rowCount,
  }
}

function buildWorkflows(metrics) {
  return [
    {
      key: 'confirm-base-exposure-context',
      title: 'Confirm base exposure context',
      status: 'ready-for-city-review',
      priority: 'high',
      actions: [
        'Review city boundary used for risk scope.',
        'Review open building and road context as non-authority exposure evidence.',
        'Decide whether candidate emergency anchors can be shown in preparedness conversations.',
      ],
      inputs: {
        buildings: parseNumeric(metrics.building_count),
        roads: parseNumeric(metrics.road_count),
        roadKm: round(metrics.road_km, 2),
        emergencyAnchors: parseNumeric(metrics.emergency_anchor_count),
      },
      outputs: {
        decision: 'base exposure context accepted, corrected, or replaced by authority sources',
      },
    },
    {
      key: 'connect-official-hazard-evidence',
      title: 'Connect official hazard or risk evidence',
      status: 'blocked-by-source',
      priority: 'critical',
      actions: [
        'Register official or validated hazard/risk evidence as provider sources.',
        'Map hazard fields into geotechnicalHazard or builtFabricRisk semantic classes.',
        'Declare which hazards can be public and which require restricted authority review.',
      ],
      inputs: {
        requiredSource: 'official hazard layer, validated risk model, or authority risk assessment',
      },
      outputs: {
        decision: 'hazard evidence can support risk screening after validation',
      },
    },
    {
      key: 'connect-terrain-hydrology-evidence',
      title: 'Connect terrain, hydrology, and geotechnical evidence',
      status: 'blocked-by-offline-data-factory',
      priority: 'high',
      actions: [
        'Run terrain, hydrology, slope, flood/fire/seismic, or geotechnical processing as Data Factory offline when inputs are large.',
        'Promote generated evidence back into PostGIS and artifact registry.',
        'Keep raster/grid evidence separate from viewer-only files.',
      ],
      inputs: {
        requiredSource: 'DEM, hydrology, STAC/raster, geotechnical, or hazard evidence package',
        preferredExecution: 'offline-data-factory',
      },
      outputs: {
        decision: 'terrain-sensitive risk evidence is ready for pack checks',
      },
    },
    {
      key: 'connect-population-vulnerability',
      title: 'Connect population and vulnerability denominator',
      status: 'blocked-by-source',
      priority: 'high',
      actions: [
        'Register population, vulnerability, shelter-demand, or service-demand denominators.',
        'Apply privacy and aggregation policy before public exposure views.',
        'Define which vulnerability indicators are authority-approved vs analytical.',
      ],
      inputs: {
        requiredSource: 'population grid, census unit, vulnerability index, or demand denominator',
      },
      outputs: {
        decision: 'people-exposed and vulnerability indicators become computable',
      },
    },
    {
      key: 'validate-emergency-resources-and-plan',
      title: 'Validate emergency resources and authority response plan',
      status: 'needs-authority-design',
      priority: 'critical',
      actions: [
        'Connect shelter, assembly area, emergency resource, and capacity registry.',
        'Define official route status and response-plan review states.',
        'Define public/private visibility for preparedness outputs.',
      ],
      inputs: {
        requiredSource: 'authority emergency resource registry and response plan',
      },
      outputs: {
        decision: 'authority boundary and preparedness sign-off workflow documented',
      },
    },
  ]
}

function buildExportPayload({ cityId, metrics, indicators, workflows, featureCounts, ruleCheckCount }) {
  return {
    packKey: PACK_KEY,
    packVersion: PACK_VERSION,
    cityId,
    cityName: metrics.name,
    domain: PACK_MANIFEST.domain,
    purpose: PACK_MANIFEST.purpose,
    readiness: indicatorValue(indicators, 'pack_readiness'),
    requiredSources: REQUIRED_SOURCES,
    indicators: indicators.map((indicator) => ({
      key: indicator.key,
      value: indicator.value,
      unit: indicator.unit,
      quality: indicator.quality,
    })),
    workflows: workflows.map((workflow) => ({
      key: workflow.key,
      title: workflow.title,
      status: workflow.status,
      priority: workflow.priority,
    })),
    serviceFeatures: featureCounts,
    ruleChecks: ruleCheckCount,
    executionPolicy: {
      interactive: 'base exposure summary and open candidate features',
      offlineDataFactory: 'terrain, hydrology, STAC/raster, hazard model, and state-scale runs',
    },
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
    readiness: indicatorValue(indicators, 'pack_readiness'),
    buildings: parseNumeric(metrics.building_count),
    roadKm: round(metrics.road_km, 2),
    emergencyAnchors: parseNumeric(metrics.emergency_anchor_count),
    serviceFeatures:
      parseNumeric(featureCounts.preparednessAnchors) +
      parseNumeric(featureCounts.evacuationAccessSpines) +
      parseNumeric(featureCounts.builtExposureCandidates),
    ruleChecks: ruleCheckCount,
  }
}

function normalizeRuleResult(rule) {
  if (rule.type === 'gap-rule') {
    return {
      result: 'blocked',
      severity: 'warning',
      explanation: rule.body && rule.body.requiredSource
        ? `Required source missing: ${rule.body.requiredSource}.`
        : rule.confidenceRule,
      authorityStatus: 'not-authority-approved',
      reviewState: 'needs-review',
    }
  }
  if (rule.type === 'input-validation') {
    return {
      result: 'needs-review',
      severity: 'info',
      explanation: 'Open base exposure context exists but must be reviewed by the city before operational risk use.',
      authorityStatus: 'open-data-seed',
      reviewState: 'needs-review',
    }
  }
  return {
    result: 'generated',
    severity: 'info',
    explanation: (rule.body && rule.body.interpretation) || rule.confidenceRule,
    authorityStatus: 'open-data-seed',
    reviewState: 'generated',
  }
}

function ruleInputSnapshot(metrics) {
  return {
    cityId: metrics.id,
    buildings: parseNumeric(metrics.building_count),
    roads: parseNumeric(metrics.road_count),
    roadKm: round(metrics.road_km, 2),
    facilities: parseNumeric(metrics.facility_count),
    emergencyAnchors: parseNumeric(metrics.emergency_anchor_count),
    majorRoadKm: round(metrics.major_road_km, 2),
    builtFabricRiskTags: parseNumeric(metrics.built_fabric_risk_tag_count),
    emergencyPreparednessTags: parseNumeric(metrics.emergency_preparedness_tag_count),
    geotechnicalHazardTags: parseNumeric(metrics.geotechnical_hazard_tag_count),
    terrainEvidenceTags: parseNumeric(metrics.terrain_evidence_tag_count),
  }
}

export const urbanRiskPreparednessPack = {
  packKey: PACK_KEY,
  version: PACK_VERSION,
  name: 'Urban Risk Preparedness Pack',
  domain: PACK_MANIFEST.domain,
  description: 'Dry-run semantic pack for urban-risk preparedness. It prepares source contracts, exposure context, workflows, and blockers before official hazard, population, emergency resource, terrain, and authority response-plan sources are connected.',
  lifecycleStatus: 'draft',
  authorityStatus: 'not-authority-approved',
  bindingStatus: 'generated',
  bindingAuthorityStatus: 'open-data-seed',
  manifest: PACK_MANIFEST,
  requiredSources: REQUIRED_SOURCES,
  standardsMapping: {
    ldt: 'semantic-pack',
    ngsiLd: ['Building', 'Road', 'PointOfInterest', 'Alert', 'RiskManagement'],
    dcat: 'DatasetSeries',
    fiware: 'adapter-ready',
    ogc: ['Features API candidate', 'future coverage/raster evidence'],
  },
  defaultRuleValidationSchema: {
    required: ['city_id', 'entity_type', 'source_quality', 'authority_status'],
    packVersion: PACK_VERSION,
  },
  rules: PACK_RULES,
  workflowContract: {
    owningAuthority: 'Municipal risk, civil protection, or emergency preparedness owner',
    handoffMethod: 'authenticated-pack-report-offline-data-factory-export-and-authority-review-workflow',
    qualityGate: {
      mustReview: ['base exposure context', 'hazard/risk sources', 'terrain/hydrology evidence', 'population denominator', 'emergency resource registry', 'authority response-plan state'],
      blockedClaims: PACK_MANIFEST.claimsBlockedWithoutAuthorityEvidence,
      executionDecision: {
        interactive: ['open base exposure context', 'candidate features', 'source blockers'],
        offlineDataFactory: ['terrain/hydrology/STAC/raster processing', 'full-city or state-scale hazard evidence', 'large semantic materialization runs'],
      },
    },
    metrics: [
      'pack_readiness',
      'base_exposure_context_connected',
      'official_hazard_evidence_connected',
      'terrain_hydrology_evidence_connected',
      'population_vulnerability_connected',
      'emergency_resource_registry_connected',
      'authority_response_plan_connected',
    ],
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
  normalizeRuleResult,
  ruleInputSnapshot,
}

export default urbanRiskPreparednessPack
