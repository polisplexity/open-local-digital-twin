import { closeSharedProductionPool, withProductionClient as withClient } from './serviceDatabase.mjs'

const DEFAULT_CITY_IDS = ['adazi', 'kharkiv']
const PACK_KEY = 'reconstruction-service-core'
const PACK_VERSION = '0.1.0'

async function withLowMemoryTransaction(client, callback) {
  await client.query('BEGIN')
  try {
    await client.query('SET LOCAL max_parallel_workers_per_gather = 0')
    await client.query("SET LOCAL work_mem = '16MB'")
    const result = await callback()
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

export async function closeLdtSemanticPackPool() {
  await closeSharedProductionPool()
}

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
  publicDataBoundary: 'Open-data seed pack. It must not claim damage, casualty, vulnerability, or project priority without official/city-owned datasets.',
}

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

function sqlArray(values) {
  return `{${values.map((value) => `"${String(value).replaceAll('"', '\\"')}"`).join(',')}}`
}

async function listCityIds(client, requestedCityIds) {
  if (requestedCityIds.length > 0) return requestedCityIds
  const result = await client.query('SELECT id FROM ldt_core.cities ORDER BY id')
  return result.rows.map((row) => row.id)
}

async function upsertPack(client) {
  const result = await client.query(
    `
      INSERT INTO ldt_semantic.pack_registry (
        pack_key,
        name,
        version,
        domain,
        description,
        lifecycle_status,
        authority_status,
        manifest,
        standards_mapping,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'reference-implementation', 'open-reference', $6::jsonb, $7::jsonb, now())
      ON CONFLICT (pack_key, version) DO UPDATE SET
        name = EXCLUDED.name,
        domain = EXCLUDED.domain,
        description = EXCLUDED.description,
        lifecycle_status = EXCLUDED.lifecycle_status,
        authority_status = EXCLUDED.authority_status,
        manifest = EXCLUDED.manifest,
        standards_mapping = EXCLUDED.standards_mapping,
        updated_at = now()
      RETURNING id
    `,
    [
      PACK_KEY,
      'Reconstruction Service Core',
      PACK_VERSION,
      PACK_MANIFEST.domain,
      'Reference semantic pack for reconstruction readiness and critical service continuity using open base-twin inventory.',
      JSON.stringify(PACK_MANIFEST),
      JSON.stringify({
        ldt: 'semantic-pack',
        ngsiLd: ['Building', 'Road', 'PointOfInterest'],
        dcat: 'DatasetSeries',
        fiware: 'adapter-ready',
      }),
    ],
  )

  await client.query(
    `
      INSERT INTO public.semantic_packs (
        id,
        name,
        version,
        description,
        manifest,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        version = EXCLUDED.version,
        description = EXCLUDED.description,
        manifest = EXCLUDED.manifest,
        updated_at = now()
    `,
    [
      PACK_KEY,
      'Reconstruction Service Core',
      PACK_VERSION,
      'Reference semantic pack for reconstruction readiness and critical service continuity using open base-twin inventory.',
      JSON.stringify(PACK_MANIFEST),
    ],
  )

  const packId = result.rows[0].id
  for (const rule of PACK_RULES) {
    await client.query(
      `
        INSERT INTO ldt_semantic.pack_rules (
          pack_id,
          rule_key,
          rule_type,
          input_entity_types,
          output_role,
          confidence_rule,
          validation_schema,
          rule_body,
          source_quality,
          updated_at
        )
        VALUES ($1, $2, $3, $4::text[], $5, $6, $7::jsonb, $8::jsonb, $9, now())
        ON CONFLICT (pack_id, rule_key) DO UPDATE SET
          rule_type = EXCLUDED.rule_type,
          input_entity_types = EXCLUDED.input_entity_types,
          output_role = EXCLUDED.output_role,
          confidence_rule = EXCLUDED.confidence_rule,
          validation_schema = EXCLUDED.validation_schema,
          rule_body = EXCLUDED.rule_body,
          source_quality = EXCLUDED.source_quality,
          updated_at = now()
      `,
      [
        packId,
        rule.key,
        rule.type,
        sqlArray(rule.inputTypes),
        rule.outputRole,
        rule.confidenceRule,
        JSON.stringify({
          required: ['city_id', 'entity_type', 'source_quality'],
          packVersion: PACK_VERSION,
        }),
        JSON.stringify(rule.body),
        rule.sourceQuality,
      ],
    )
  }
  return packId
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
    cannotClaimYet: [
      'damaged buildings',
      'human impact',
      'reconstruction priority',
      'budget or intervention sequence',
    ],
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

async function upsertCityBinding(client, cityId, packId, metrics, indicators) {
  const qualitySummary = buildQualitySummary(metrics, indicators)
  const result = await client.query(
    `
      INSERT INTO ldt_semantic.city_pack_bindings (
        city_id,
        pack_id,
        binding_key,
        status,
        authority_status,
        active,
        configuration,
        quality_summary,
        generated_at,
        updated_at
      )
      VALUES ($1, $2, $3, 'generated', 'open-data-seed', true, $4::jsonb, $5::jsonb, now(), now())
      ON CONFLICT (city_id, binding_key) DO UPDATE SET
        pack_id = EXCLUDED.pack_id,
        status = EXCLUDED.status,
        authority_status = EXCLUDED.authority_status,
        active = EXCLUDED.active,
        configuration = EXCLUDED.configuration,
        quality_summary = EXCLUDED.quality_summary,
        generated_at = now(),
        updated_at = now()
      RETURNING id
    `,
    [
      cityId,
      packId,
      `${cityId}:${PACK_KEY}`,
      JSON.stringify({
        defaultMode: 'reconstruction-readiness',
        featurePolicy: 'store-service-anchors-and-major-roads-only',
        fullBuildingInventory: 'referenced-from-ldt_core-building-entities',
      }),
      JSON.stringify(qualitySummary),
    ],
  )
  return result.rows[0].id
}

async function upsertIndicators(client, cityId, packId, indicators) {
  for (const indicator of indicators) {
    await client.query(
      `
        INSERT INTO ldt_semantic.service_indicators (
          city_id,
          pack_id,
          indicator_key,
          label,
          value,
          value_json,
          unit,
          quality,
          method,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, now())
        ON CONFLICT (city_id, pack_id, indicator_key) DO UPDATE SET
          label = EXCLUDED.label,
          value = EXCLUDED.value,
          value_json = EXCLUDED.value_json,
          unit = EXCLUDED.unit,
          quality = EXCLUDED.quality,
          method = EXCLUDED.method,
          updated_at = now()
      `,
      [
        cityId,
        packId,
        indicator.key,
        indicator.label,
        indicator.value,
        JSON.stringify(indicator.valueJson),
        indicator.unit,
        indicator.quality,
        JSON.stringify(indicator.method),
      ],
    )
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

async function upsertWorkflows(client, cityId, packId, workflows) {
  for (const workflow of workflows) {
    await client.query(
      `
        INSERT INTO ldt_semantic.service_workflows (
          city_id,
          pack_id,
          workflow_key,
          title,
          workflow_status,
          priority,
          action_items,
          inputs,
          outputs,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, now())
        ON CONFLICT (city_id, pack_id, workflow_key) DO UPDATE SET
          title = EXCLUDED.title,
          workflow_status = EXCLUDED.workflow_status,
          priority = EXCLUDED.priority,
          action_items = EXCLUDED.action_items,
          inputs = EXCLUDED.inputs,
          outputs = EXCLUDED.outputs,
          updated_at = now()
      `,
      [
        cityId,
        packId,
        workflow.key,
        workflow.title,
        workflow.status,
        workflow.priority,
        JSON.stringify(workflow.actions),
        JSON.stringify(workflow.inputs),
        JSON.stringify(workflow.outputs),
      ],
    )
  }
}

async function upsertExport(client, cityId, packId, metrics, indicators, workflows, featureCounts) {
  const payload = {
    pack: {
      packKey: PACK_KEY,
      version: PACK_VERSION,
      name: 'Reconstruction Service Core',
      domain: PACK_MANIFEST.domain,
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
    publicDataBoundary: PACK_MANIFEST.publicDataBoundary,
    generatedAt: new Date().toISOString(),
  }

  await client.query(
    `
      INSERT INTO ldt_semantic.pack_exports (
        city_id,
        pack_id,
        export_key,
        export_format,
        payload,
        generated_at
      )
      VALUES ($1, $2, $3, 'application/json', $4::jsonb, now())
      ON CONFLICT (city_id, pack_id, export_key) DO UPDATE SET
        export_format = EXCLUDED.export_format,
        payload = EXCLUDED.payload,
        generated_at = now()
    `,
    [cityId, packId, `${PACK_KEY}:summary`, JSON.stringify(payload)],
  )
}

export async function generateLdtSemanticPacks({ cityIds = DEFAULT_CITY_IDS } = {}) {
  return withClient(async (client) => withLowMemoryTransaction(client, async () => {
    const packId = await upsertPack(client)
    const ids = await listCityIds(client, cityIds)
    const cities = []

    for (const cityId of ids) {
      const metrics = await computeCityMetrics(client, cityId)
      const indicators = buildIndicators(metrics)
      const workflows = buildWorkflows(metrics)
      await upsertCityBinding(client, cityId, packId, metrics, indicators)
      await upsertIndicators(client, cityId, packId, indicators)
      const featureCounts = await refreshServiceFeatures(client, cityId, packId)
      await upsertWorkflows(client, cityId, packId, workflows)
      await upsertExport(client, cityId, packId, metrics, indicators, workflows, featureCounts)

      cities.push({
        cityId,
        name: metrics.name,
        packKey: PACK_KEY,
        readiness: indicators.find((indicator) => indicator.key === 'pack_readiness')?.value ?? 0,
        buildings: parseNumeric(metrics.building_count),
        criticalAnchors: parseNumeric(metrics.critical_anchor_count),
        majorRoadKm: round(metrics.major_road_km, 2),
        serviceFeatures: featureCounts.criticalAnchors + featureCounts.accessSpines,
      })
    }

    return {
      ok: true,
      packKey: PACK_KEY,
      packVersion: PACK_VERSION,
      ruleCount: PACK_RULES.length,
      cityCount: cities.length,
      cities,
    }
  }))
}

export async function getLdtSemanticPackReport(cityId, packKey = PACK_KEY) {
  return withClient(async (client) => {
    const packResult = await client.query(
      `
        SELECT
          p.id,
          p.pack_key,
          p.name,
          p.version,
          p.domain,
          p.description,
          p.lifecycle_status,
          p.authority_status,
          p.manifest,
          p.standards_mapping,
          b.binding_key,
          b.status AS binding_status,
          b.quality_summary,
          b.generated_at
        FROM ldt_semantic.pack_registry p
        JOIN ldt_semantic.city_pack_bindings b ON b.pack_id = p.id
        WHERE b.city_id = $1
          AND p.pack_key = $2
          AND b.active = true
        ORDER BY p.version DESC
        LIMIT 1
      `,
      [cityId, packKey],
    )
    if (packResult.rowCount === 0) throw new Error(`LDT_SEMANTIC_PACK_NOT_FOUND:${cityId}:${packKey}`)

    const pack = packResult.rows[0]
    const rules = await client.query(
      `
        SELECT rule_key, rule_type, input_entity_types, output_role, confidence_rule, source_quality, rule_body
        FROM ldt_semantic.pack_rules
        WHERE pack_id = $1
        ORDER BY rule_key
      `,
      [pack.id],
    )
    const indicators = await client.query(
      `
        SELECT indicator_key, label, value, value_json, unit, quality, method, updated_at
        FROM ldt_semantic.service_indicators
        WHERE city_id = $1 AND pack_id = $2
        ORDER BY indicator_key
      `,
      [cityId, pack.id],
    )
    const workflows = await client.query(
      `
        SELECT workflow_key, title, workflow_status, priority, action_items, inputs, outputs, updated_at
        FROM ldt_semantic.service_workflows
        WHERE city_id = $1 AND pack_id = $2
        ORDER BY
          CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
          workflow_key
      `,
      [cityId, pack.id],
    )
    const features = await client.query(
      `
        SELECT service_role, quality, count(*)::int AS count
        FROM ldt_semantic.service_features
        WHERE city_id = $1 AND pack_id = $2
        GROUP BY service_role, quality
        ORDER BY service_role, quality
      `,
      [cityId, pack.id],
    )
    const exportResult = await client.query(
      `
        SELECT export_key, export_format, payload, generated_at
        FROM ldt_semantic.pack_exports
        WHERE city_id = $1 AND pack_id = $2
        ORDER BY generated_at DESC
        LIMIT 1
      `,
      [cityId, pack.id],
    )

    return {
      ok: true,
      cityId,
      pack: {
        key: pack.pack_key,
        name: pack.name,
        version: pack.version,
        domain: pack.domain,
        description: pack.description,
        lifecycleStatus: pack.lifecycle_status,
        authorityStatus: pack.authority_status,
        manifest: pack.manifest,
        standardsMapping: pack.standards_mapping,
      },
      binding: {
        key: pack.binding_key,
        status: pack.binding_status,
        qualitySummary: pack.quality_summary,
        generatedAt: pack.generated_at,
      },
      rules: rules.rows.map((row) => ({
        key: row.rule_key,
        type: row.rule_type,
        inputEntityTypes: row.input_entity_types,
        outputRole: row.output_role,
        confidenceRule: row.confidence_rule,
        sourceQuality: row.source_quality,
        body: row.rule_body,
      })),
      indicators: indicators.rows.map((row) => ({
        key: row.indicator_key,
        label: row.label,
        value: row.value === null ? null : parseNumeric(row.value),
        valueJson: row.value_json,
        unit: row.unit,
        quality: row.quality,
        method: row.method,
        updatedAt: row.updated_at,
      })),
      workflows: workflows.rows.map((row) => ({
        key: row.workflow_key,
        title: row.title,
        status: row.workflow_status,
        priority: row.priority,
        actionItems: row.action_items,
        inputs: row.inputs,
        outputs: row.outputs,
        updatedAt: row.updated_at,
      })),
      serviceFeatureSummary: features.rows.map((row) => ({
        role: row.service_role,
        quality: row.quality,
        count: row.count,
      })),
      latestExport: exportResult.rows[0]
        ? {
            key: exportResult.rows[0].export_key,
            format: exportResult.rows[0].export_format,
            payload: exportResult.rows[0].payload,
            generatedAt: exportResult.rows[0].generated_at,
          }
        : null,
    }
  })
}
