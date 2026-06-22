import { closeSharedProductionPool, withProductionClient as withClient } from './serviceDatabase.mjs'

const DEFAULT_CITY_IDS = ['adazi', 'kharkiv']
const STANDARD_KEY = 'urban-science-core'
const STANDARD_VERSION = '0.1.0'

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

export async function closeLdtSciencePool() {
  await closeSharedProductionPool()
}

const INDICATOR_DEFINITIONS = [
  {
    key: 'built_fabric_density',
    name: 'Built fabric density',
    family: 'density_morphology',
    dimension: 'urban_form',
    unit: 'buildings/km2',
    definition: 'Consolidated building inventory density over the municipal area.',
    expectedDirection: 'contextual',
  },
  {
    key: 'building_footprint_intensity',
    name: 'Building footprint intensity',
    family: 'density_morphology',
    dimension: 'urban_form',
    unit: '% of municipal area',
    definition: 'Share of municipal area covered by consolidated building footprints.',
    expectedDirection: 'contextual',
  },
  {
    key: 'road_granularity',
    name: 'Road granularity',
    family: 'network_proxy',
    dimension: 'mobility_network',
    unit: 'road geometries/km2',
    definition: 'Road geometry count normalized by municipal area.',
    expectedDirection: 'contextual',
  },
  {
    key: 'road_length_density',
    name: 'Road length density',
    family: 'network_proxy',
    dimension: 'mobility_network',
    unit: 'km/km2',
    definition: 'Total open road length normalized by municipal area.',
    expectedDirection: 'higher-can-mean-finer-network-or-source-bias',
  },
  {
    key: 'green_blue_coverage',
    name: 'Green-blue coverage',
    family: 'environmental_structure',
    dimension: 'environment',
    unit: '% of municipal area',
    definition: 'Open-data green-blue polygon area normalized by municipal area.',
    expectedDirection: 'higher-usually-better',
  },
  {
    key: 'land_use_coverage_gap',
    name: 'Land-use coverage gap',
    family: 'source_completeness',
    dimension: 'data_quality',
    unit: '% of municipal area',
    definition: 'Approximate share of municipal area not covered by thematic land-use or green-blue polygons.',
    expectedDirection: 'lower-better',
  },
  {
    key: 'service_seed_density',
    name: 'Service seed density',
    family: 'service_access_seed',
    dimension: 'public_services',
    unit: 'service/place seeds/km2',
    definition: 'Facility and place anchors normalized by municipal area.',
    expectedDirection: 'contextual',
  },
  {
    key: 'open_provider_building_uplift',
    name: 'Open building uplift',
    family: 'source_completeness',
    dimension: 'building_inventory',
    unit: '% over base buildings',
    definition: 'Provider-only open building candidates compared with base-source buildings.',
    expectedDirection: 'higher-means-base-source-gap',
  },
  {
    key: 'standards_projection_coverage',
    name: 'Standards projection coverage',
    family: 'interoperability',
    dimension: 'interoperability',
    unit: '% projected to NGSI-LD',
    definition: 'Share of consolidated entities with NGSI-LD projections.',
    expectedDirection: 'higher-better',
  },
  {
    key: 'boundary_compactness',
    name: 'Boundary compactness',
    family: 'morphology',
    dimension: 'urban_form',
    unit: 'ratio',
    definition: 'Isoperimetric compactness of the municipal boundary, where 1 is a circle.',
    expectedDirection: 'contextual',
  },
]

const SIMULATION_MODELS = [
  {
    key: 'urban-indicator-report-v0',
    name: 'Urban Indicator Report',
    family: 'descriptive_indicator_model',
    definition: {
      purpose: 'Generate city-level analytical observations from the consolidated LDT inventory.',
      outputs: INDICATOR_DEFINITIONS.map((definition) => definition.key),
    },
  },
  {
    key: 'service-access-seed-v0',
    name: 'Service Access Seed Model',
    family: 'accessibility_seed_model',
    definition: {
      purpose: 'Prepare service-access analysis using facility/place seeds before authority-grade service areas exist.',
      pendingInputs: ['official facilities', 'population grid', 'walk/drive network'],
    },
  },
  {
    key: 'network-proxy-v0',
    name: 'Road Network Proxy Model',
    family: 'network_proxy_model',
    definition: {
      purpose: 'Create first road-network density and granularity diagnostics from open road geometry.',
      caveat: 'Not a routable graph until topology, direction, speed, and mode permissions are normalized.',
    },
  },
]

const SCALING_MODELS = [
  {
    key: 'urban-scaling-power-law-v0',
    name: 'Urban Scaling Power Law',
    response: 'built_fabric_density',
    baseline: 'city_population',
    equation: 'Y = Y0 * N^beta',
    assumptions: [
      'Requires comparable multi-city population and indicator observations.',
      'Do not interpret single-city residuals as scientific evidence.',
    ],
  },
  {
    key: 'network-density-scaling-v0',
    name: 'Network Density Scaling',
    response: 'road_length_density',
    baseline: 'city_population',
    equation: 'Y = Y0 * N^beta',
    assumptions: [
      'Requires comparable road extraction methods across cities.',
      'Road geometry granularity can be source-biased.',
    ],
  },
]

const SCENARIOS = [
  {
    key: 'service-access-baseline',
    name: 'Service Access Baseline',
    family: 'accessibility',
    description: 'Estimate public-service reach once population, official service points, and routable network inputs are available.',
    inputs: ['consolidated road network', 'service points', 'population or demand grid'],
    outputs: ['coverage by travel threshold', 'underserved cells', 'priority service gaps'],
  },
  {
    key: 'reconstruction-priority-seed',
    name: 'Reconstruction Priority Seed',
    family: 'reconstruction',
    description: 'Prepare a reconstruction prioritization scenario that can combine damage, buildings, services, and access once authority data arrives.',
    inputs: ['building inventory', 'damage layer', 'critical facilities', 'road access'],
    outputs: ['priority areas', 'critical service continuity gaps', 'candidate intervention clusters'],
  },
  {
    key: 'provider-risk-overlay',
    name: 'Provider Risk Overlay',
    family: 'provider_layer_interop',
    description: 'Attach flood, fire, satellite, or emergency provider outputs as semantic layers without replacing the base twin.',
    inputs: ['provider footprint/raster/vector layer', 'city boundary', 'affected city entities'],
    outputs: ['affected inventory summary', 'risk cells', 'provider-source report'],
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

async function listCityIds(client, requestedCityIds) {
  if (requestedCityIds.length > 0) return requestedCityIds
  const result = await client.query('SELECT id FROM ldt_core.cities ORDER BY id')
  return result.rows.map((row) => row.id)
}

async function seedDefinitions(client) {
  const indicatorIds = new Map()
  for (const definition of INDICATOR_DEFINITIONS) {
    const result = await client.query(
      `
        INSERT INTO ldt_science.indicator_definitions (
          indicator_key,
          name,
          model_family,
          unit,
          definition,
          method,
          standard_key,
          standard_version,
          dimension,
          calculation_scope,
          expected_direction,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, 'city', $10, $11::jsonb)
        ON CONFLICT (indicator_key) DO UPDATE SET
          name = EXCLUDED.name,
          model_family = EXCLUDED.model_family,
          unit = EXCLUDED.unit,
          definition = EXCLUDED.definition,
          method = EXCLUDED.method,
          standard_key = EXCLUDED.standard_key,
          standard_version = EXCLUDED.standard_version,
          dimension = EXCLUDED.dimension,
          calculation_scope = EXCLUDED.calculation_scope,
          expected_direction = EXCLUDED.expected_direction,
          metadata = EXCLUDED.metadata
        RETURNING id
      `,
      [
        definition.key,
        definition.name,
        definition.family,
        definition.unit,
        definition.definition,
        JSON.stringify({ generatedBy: 'phase-7-urban-science', formulaOwner: 'twin-base-studio' }),
        STANDARD_KEY,
        STANDARD_VERSION,
        definition.dimension,
        definition.expectedDirection,
        JSON.stringify({ release: 'phase-7', caveat: 'Open-data baseline indicator.' }),
      ],
    )
    indicatorIds.set(definition.key, result.rows[0].id)
  }

  for (const model of SIMULATION_MODELS) {
    await client.query(
      `
        INSERT INTO ldt_science.simulation_models (model_key, name, model_family, version, definition)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        ON CONFLICT (model_key) DO UPDATE SET
          name = EXCLUDED.name,
          model_family = EXCLUDED.model_family,
          version = EXCLUDED.version,
          definition = EXCLUDED.definition
      `,
      [model.key, model.name, model.family, STANDARD_VERSION, JSON.stringify(model.definition)],
    )
  }

  for (const model of SCALING_MODELS) {
    await client.query(
      `
        INSERT INTO ldt_science.scaling_model_definitions (
          model_key,
          name,
          response_indicator_key,
          baseline_indicator_key,
          equation,
          assumptions,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
        ON CONFLICT (model_key) DO UPDATE SET
          name = EXCLUDED.name,
          response_indicator_key = EXCLUDED.response_indicator_key,
          baseline_indicator_key = EXCLUDED.baseline_indicator_key,
          equation = EXCLUDED.equation,
          assumptions = EXCLUDED.assumptions,
          metadata = EXCLUDED.metadata
      `,
      [
        model.key,
        model.name,
        model.response,
        model.baseline,
        model.equation,
        JSON.stringify(model.assumptions),
        JSON.stringify({ status: 'definition-ready-needs-multi-city-calibration' }),
      ],
    )
  }

  for (const scenario of SCENARIOS) {
    await client.query(
      `
        INSERT INTO ldt_science.scenario_definitions (
          scenario_key,
          name,
          scenario_family,
          description,
          required_inputs,
          expected_outputs,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)
        ON CONFLICT (scenario_key) DO UPDATE SET
          name = EXCLUDED.name,
          scenario_family = EXCLUDED.scenario_family,
          description = EXCLUDED.description,
          required_inputs = EXCLUDED.required_inputs,
          expected_outputs = EXCLUDED.expected_outputs,
          metadata = EXCLUDED.metadata
      `,
      [
        scenario.key,
        scenario.name,
        scenario.family,
        scenario.description,
        JSON.stringify(scenario.inputs),
        JSON.stringify(scenario.outputs),
        JSON.stringify({ status: 'scenario-contract-only', release: 'phase-7' }),
      ],
    )
  }

  return indicatorIds
}

async function computeCityScienceMetrics(client, cityId) {
  const result = await client.query(
    `
      WITH city AS (
        SELECT id, name, country, region
        FROM ldt_core.cities
        WHERE id = $1
      ),
      boundary AS (
        SELECT
          ST_UnaryUnion(ST_Collect(geom)) AS geom,
          ST_Area(ST_UnaryUnion(ST_Collect(geom))::geography) AS area_m2,
          ST_Perimeter(ST_UnaryUnion(ST_Collect(geom))::geography) AS perimeter_m
        FROM ldt_core.city_boundaries
        WHERE city_id = $1
      ),
      counts AS (
        SELECT
          count(*)::int AS entity_count,
          count(*) FILTER (WHERE entity_type = 'building')::int AS building_count,
          count(*) FILTER (WHERE entity_type = 'road')::int AS road_count,
          count(*) FILTER (WHERE entity_type = 'facility')::int AS facility_count,
          count(*) FILTER (WHERE entity_type = 'place')::int AS place_count,
          count(*) FILTER (WHERE entity_type = 'green_blue_system')::int AS green_blue_count,
          count(*) FILTER (WHERE entity_type = 'land_use')::int AS land_use_count
        FROM ldt_core.city_entities
        WHERE city_id = $1
      ),
      roads AS (
        SELECT COALESCE(sum(ST_Length(geom::geography)) / 1000.0, 0) AS road_km
        FROM ldt_core.city_entities
        WHERE city_id = $1
          AND entity_type = 'road'
          AND geom IS NOT NULL
      ),
      buildings AS (
        SELECT
          count(*) FILTER (WHERE be.source_coverage_status = 'open-provider-only')::int AS provider_only_buildings,
          count(*) FILTER (WHERE be.source_coverage_status <> 'open-provider-only')::int AS base_or_matched_buildings,
          COALESCE(
            sum(
              COALESCE(
                NULLIF(be.footprint_area_m2, 0),
                CASE
                  WHEN GeometryType(ce.geom) IN ('POLYGON', 'MULTIPOLYGON') THEN ST_Area(ST_MakeValid(ce.geom)::geography)
                  ELSE NULL
                END
              )
            ),
            0
          ) AS footprint_area_m2
        FROM ldt_core.city_entities ce
        LEFT JOIN ldt_core.building_entities be ON be.entity_id = ce.id
        WHERE ce.city_id = $1
          AND ce.entity_type = 'building'
      ),
      thematic_area AS (
        SELECT
          COALESCE(
            sum(
              CASE
                WHEN entity_type IN ('green_blue_system', 'land_use')
                  AND GeometryType(geom) IN ('POLYGON', 'MULTIPOLYGON')
                THEN ST_Area(ST_MakeValid(geom)::geography)
                ELSE 0
              END
            ),
            0
          ) AS area_m2
        FROM ldt_core.city_entities
        WHERE city_id = $1
          AND entity_type IN ('green_blue_system', 'land_use')
          AND geom IS NOT NULL
      ),
      green_blue AS (
        SELECT
          COALESCE(
            sum(
              CASE
                WHEN GeometryType(geom) IN ('POLYGON', 'MULTIPOLYGON')
                THEN ST_Area(ST_MakeValid(geom)::geography)
                ELSE 0
              END
            ),
            0
          ) AS area_m2
        FROM ldt_core.city_entities
        WHERE city_id = $1
          AND entity_type = 'green_blue_system'
          AND geom IS NOT NULL
      ),
      interop AS (
        SELECT
          (
            SELECT count(*)::int
            FROM ldt_interop.ngsi_entity_projections nep
            JOIN ldt_core.city_entities ce ON ce.id = nep.entity_id
            WHERE ce.city_id = $1
          ) AS ngsi_projections
      )
      SELECT
        city.id,
        city.name,
        city.country,
        city.region,
        COALESCE(boundary.area_m2, 0) AS area_m2,
        COALESCE(boundary.area_m2, 0) / 1000000.0 AS area_km2,
        COALESCE(boundary.perimeter_m, 0) AS perimeter_m,
        counts.*,
        roads.road_km,
        buildings.provider_only_buildings,
        buildings.base_or_matched_buildings,
        buildings.footprint_area_m2,
        green_blue.area_m2 AS green_blue_area_m2,
        thematic_area.area_m2 AS thematic_area_m2,
        interop.ngsi_projections
      FROM city, boundary, counts, roads, buildings, green_blue, thematic_area, interop
    `,
    [cityId],
  )
  if (result.rowCount === 0) throw new Error(`LDT_CITY_NOT_FOUND:${cityId}`)
  return result.rows[0]
}

function buildObservations(metrics) {
  const areaKm2 = parseNumeric(metrics.area_km2)
  const areaM2 = parseNumeric(metrics.area_m2)
  const perimeterM = parseNumeric(metrics.perimeter_m)
  const buildingCount = parseNumeric(metrics.building_count)
  const baseBuildings = parseNumeric(metrics.base_or_matched_buildings)
  const providerBuildings = parseNumeric(metrics.provider_only_buildings)
  const roadCount = parseNumeric(metrics.road_count)
  const roadKm = parseNumeric(metrics.road_km)
  const entityCount = parseNumeric(metrics.entity_count)
  const ngsiProjections = parseNumeric(metrics.ngsi_projections)
  const thematicAreaM2 = parseNumeric(metrics.thematic_area_m2)

  const sourceQualityNotes = []
  if (roadCount <= 1000) {
    sourceQualityNotes.push('Road count may reflect a capped or partial open-data extraction.')
  }
  if (providerBuildings > baseBuildings * 5) {
    sourceQualityNotes.push('Building inventory is dominated by open-provider evidence pending authority validation.')
  }

  const common = {
    generatedBy: 'phase-7-urban-science',
    standardKey: STANDARD_KEY,
    standardVersion: STANDARD_VERSION,
    sourceQualityNotes,
  }

  return [
    {
      key: 'built_fabric_density',
      value: areaKm2 > 0 ? round(buildingCount / areaKm2, 1) : 0,
      quality: 'open-data-derived',
      method: { formula: 'building_count / city_area_km2', inputs: { buildingCount, areaKm2 } },
    },
    {
      key: 'building_footprint_intensity',
      value: areaM2 > 0 ? round((100 * parseNumeric(metrics.footprint_area_m2)) / areaM2, 2) : 0,
      quality: 'candidate-evidence',
      method: { formula: 'sum_building_footprint_area_m2 / city_area_m2 * 100' },
    },
    {
      key: 'road_granularity',
      value: areaKm2 > 0 ? round(roadCount / areaKm2, 1) : 0,
      quality: roadCount <= 1000 ? 'partial-open-data' : 'open-data-derived',
      method: { formula: 'road_geometry_count / city_area_km2', inputs: { roadCount, areaKm2 } },
    },
    {
      key: 'road_length_density',
      value: areaKm2 > 0 ? round(roadKm / areaKm2, 2) : 0,
      quality: roadCount <= 1000 ? 'partial-open-data' : 'open-data-derived',
      method: { formula: 'road_length_km / city_area_km2', inputs: { roadKm, areaKm2 } },
    },
    {
      key: 'green_blue_coverage',
      value: areaM2 > 0 ? round((100 * parseNumeric(metrics.green_blue_area_m2)) / areaM2, 1) : 0,
      quality: 'partial-open-data',
      method: { formula: 'green_blue_area_m2 / city_area_m2 * 100' },
    },
    {
      key: 'land_use_coverage_gap',
      value: areaM2 > 0 ? round(Math.max(0, 100 - (100 * thematicAreaM2) / areaM2), 1) : 0,
      quality: 'coverage-gap',
      method: { formula: '100 - thematic_open_polygon_area_m2 / city_area_m2 * 100' },
    },
    {
      key: 'service_seed_density',
      value: areaKm2 > 0 ? round((parseNumeric(metrics.facility_count) + parseNumeric(metrics.place_count)) / areaKm2, 2) : 0,
      quality: 'seed-level',
      method: { formula: '(facility_count + place_count) / city_area_km2' },
    },
    {
      key: 'open_provider_building_uplift',
      value: baseBuildings > 0 ? round((100 * providerBuildings) / baseBuildings, 1) : 0,
      quality: 'candidate-evidence',
      method: { formula: 'provider_only_buildings / base_or_matched_buildings * 100' },
    },
    {
      key: 'standards_projection_coverage',
      value: entityCount > 0 ? round((100 * ngsiProjections) / entityCount, 1) : 0,
      quality: 'runtime-generated',
      method: { formula: 'ngsi_projection_count / consolidated_entity_count * 100' },
    },
    {
      key: 'boundary_compactness',
      value: perimeterM > 0 ? round((4 * Math.PI * areaM2) / (perimeterM * perimeterM), 3) : 0,
      quality: 'open-data-derived',
      method: { formula: '4*pi*area_m2/perimeter_m^2' },
    },
  ].map((observation) => ({
    ...observation,
    unit: INDICATOR_DEFINITIONS.find((definition) => definition.key === observation.key)?.unit ?? null,
    metadata: common,
  }))
}

async function upsertObservation(client, cityId, indicatorIds, observation) {
  const indicatorId = indicatorIds.get(observation.key)
  if (!indicatorId) throw new Error(`INDICATOR_DEFINITION_MISSING:${observation.key}`)
  const observationKey = `${STANDARD_KEY}:${STANDARD_VERSION}:${cityId}:city:${observation.key}`
  const result = await client.query(
    `
      INSERT INTO ldt_science.indicator_observations (
        city_id,
        indicator_id,
        observation_key,
        geography_level,
        value,
        value_json,
        quality,
        unit,
        method,
        uncertainty,
        source_quality,
        metadata,
        updated_at
      )
      VALUES ($1, $2, $3, 'city', $4, $5::jsonb, $6, $7, $8::jsonb, $9::jsonb, $10, $11::jsonb, now())
      ON CONFLICT (observation_key) DO UPDATE SET
        value = EXCLUDED.value,
        value_json = EXCLUDED.value_json,
        quality = EXCLUDED.quality,
        unit = EXCLUDED.unit,
        method = EXCLUDED.method,
        uncertainty = EXCLUDED.uncertainty,
        source_quality = EXCLUDED.source_quality,
        metadata = EXCLUDED.metadata,
        updated_at = now()
      RETURNING id
    `,
    [
      cityId,
      indicatorId,
      observationKey,
      observation.value,
      JSON.stringify({ value: observation.value, unit: observation.unit }),
      observation.quality,
      observation.unit,
      JSON.stringify(observation.method),
      JSON.stringify({ status: 'not-yet-quantified', reason: 'Phase 7 baseline without calibration distribution.' }),
      observation.quality,
      JSON.stringify(observation.metadata),
    ],
  )

  await client.query(
    `
      INSERT INTO ldt_science.indicator_quality (
        observation_id,
        quality_dimension,
        score,
        assessment,
        metadata
      )
      VALUES
        ($1, 'source', NULL, $2, $3::jsonb),
        ($1, 'method', NULL, $4, $3::jsonb),
        ($1, 'authority', NULL, $5, $3::jsonb)
      ON CONFLICT (observation_id, quality_dimension) DO UPDATE SET
        assessment = EXCLUDED.assessment,
        metadata = EXCLUDED.metadata
    `,
    [
      result.rows[0].id,
      `Quality class: ${observation.quality}.`,
      JSON.stringify({ generatedBy: 'phase-7-urban-science' }),
      `Method: ${observation.method.formula ?? 'documented in method json'}.`,
      'Open-data analytical observation; not authority-certified unless later linked to official validation.',
    ],
  )
  return result.rows[0].id
}

async function upsertNetworkMetrics(client, cityId, metrics) {
  const layer = await client.query(
    `
      INSERT INTO ldt_science.network_layers (
        city_id,
        layer_key,
        network_type,
        source_entity_type,
        metadata
      )
      VALUES ($1, 'road-open-network-proxy', 'road_proxy', 'road', $2::jsonb)
      ON CONFLICT (city_id, layer_key) DO UPDATE SET
        network_type = EXCLUDED.network_type,
        source_entity_type = EXCLUDED.source_entity_type,
        metadata = EXCLUDED.metadata
      RETURNING id
    `,
    [cityId, JSON.stringify({ generatedBy: 'phase-7-urban-science', caveat: 'Geometry proxy, not routable topology yet.' })],
  )

  await client.query(
    `
      DELETE FROM ldt_science.network_metrics
      WHERE network_layer_id = $1
        AND city_id = $2
    `,
    [layer.rows[0].id, cityId],
  )

  const networkMetrics = [
    {
      key: 'road_geometry_count',
      value: parseNumeric(metrics.road_count),
      unit: 'geometries',
      method: 'Count of consolidated road entities.',
    },
    {
      key: 'road_length_km',
      value: round(metrics.road_km, 3),
      unit: 'km',
      method: 'Geodesic length sum of consolidated road geometries.',
    },
  ]

  for (const metric of networkMetrics) {
    await client.query(
      `
        INSERT INTO ldt_science.network_metrics (
          network_layer_id,
          metric_key,
          city_id,
          value,
          value_json,
          method,
          quality
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
        ON CONFLICT (network_layer_id, metric_key, city_id, geography_entity_id) DO UPDATE SET
          value = EXCLUDED.value,
          value_json = EXCLUDED.value_json,
          method = EXCLUDED.method,
          quality = EXCLUDED.quality,
          observed_at = now()
      `,
      [
        layer.rows[0].id,
        metric.key,
        cityId,
        metric.value,
        JSON.stringify({ value: metric.value, unit: metric.unit }),
        JSON.stringify({ method: metric.method }),
        parseNumeric(metrics.road_count) <= 1000 ? 'partial-open-data' : 'open-data-derived',
      ],
    )
  }

  return networkMetrics.length
}

async function createDiagnosticRun(client, cityId, observations, metrics) {
  const model = await client.query(
    `SELECT id FROM ldt_science.simulation_models WHERE model_key = 'urban-indicator-report-v0'`,
  )
  if (model.rowCount === 0) throw new Error('SCIENCE_MODEL_MISSING:urban-indicator-report-v0')

  await client.query(
    `
      DELETE FROM ldt_science.simulation_runs
      WHERE city_id = $1
        AND model_id = $2
        AND scenario_key = 'baseline-open-data-diagnostic'
        AND run_key IS NULL
    `,
    [cityId, model.rows[0].id],
  )

  const run = await client.query(
    `
      INSERT INTO ldt_science.simulation_runs (
        city_id,
        model_id,
        run_key,
        scenario_key,
        status,
        inputs,
        outputs,
        uncertainty,
        started_at,
        finished_at
      )
      VALUES ($1, $2, $3, 'baseline-open-data-diagnostic', 'completed', $4::jsonb, $5::jsonb, $6::jsonb, now(), now())
      ON CONFLICT (run_key) DO UPDATE SET
        status = EXCLUDED.status,
        inputs = EXCLUDED.inputs,
        outputs = EXCLUDED.outputs,
        uncertainty = EXCLUDED.uncertainty,
        finished_at = now()
      RETURNING id
    `,
    [
      cityId,
      model.rows[0].id,
      `${STANDARD_KEY}:${STANDARD_VERSION}:${cityId}:baseline-open-data-diagnostic`,
      JSON.stringify({
        cityId,
        areaKm2: round(metrics.area_km2, 2),
        entityCount: parseNumeric(metrics.entity_count),
      }),
      JSON.stringify({
        indicators: observations.map((observation) => ({
          key: observation.key,
          value: observation.value,
          unit: observation.unit,
          quality: observation.quality,
        })),
      }),
      JSON.stringify({ status: 'qualitative-only', reason: 'Baseline diagnostic, not calibrated simulation.' }),
    ],
  )
  return run.rows[0].id
}

async function generateCityScience(client, cityId, indicatorIds) {
  const metrics = await computeCityScienceMetrics(client, cityId)
  const observations = buildObservations(metrics)
  const observationIds = []
  for (const observation of observations) {
    observationIds.push(await upsertObservation(client, cityId, indicatorIds, observation))
  }
  const networkMetricCount = await upsertNetworkMetrics(client, cityId, metrics)
  const runId = await createDiagnosticRun(client, cityId, observations, metrics)

  return {
    cityId,
    name: metrics.name,
    areaKm2: round(metrics.area_km2, 2),
    entityCount: parseNumeric(metrics.entity_count),
    buildingCount: parseNumeric(metrics.building_count),
    roadCount: parseNumeric(metrics.road_count),
    observationCount: observationIds.length,
    networkMetricCount,
    diagnosticRunId: runId,
    qualityNotes: observations[0]?.metadata?.sourceQualityNotes ?? [],
  }
}

export async function generateLdtUrbanScience({ cityIds = DEFAULT_CITY_IDS } = {}) {
  return await withClient(async (client) => {
    return await withLowMemoryTransaction(client, async () => {
      const targetCityIds = await listCityIds(client, cityIds)
      const indicatorIds = await seedDefinitions(client)
      const cities = []
      for (const cityId of targetCityIds) {
        cities.push(await generateCityScience(client, cityId, indicatorIds))
      }
      return {
        ok: true,
        standardKey: STANDARD_KEY,
        standardVersion: STANDARD_VERSION,
        indicatorDefinitions: INDICATOR_DEFINITIONS.length,
        simulationModels: SIMULATION_MODELS.length,
        scalingModels: SCALING_MODELS.length,
        scenarios: SCENARIOS.length,
        cityCount: cities.length,
        cities,
      }
    })
  })
}

export async function getLdtUrbanScienceReport(cityId) {
  return await withClient(async (client) => {
    const result = await client.query(
      `
        SELECT
          c.id AS city_id,
          c.name,
          jsonb_agg(
            jsonb_build_object(
              'key', idf.indicator_key,
              'name', idf.name,
              'dimension', idf.dimension,
              'modelFamily', idf.model_family,
              'value', io.value,
              'unit', COALESCE(io.unit, idf.unit),
              'quality', io.quality,
              'sourceQuality', io.source_quality,
              'method', io.method,
              'metadata', io.metadata,
              'updatedAt', io.updated_at
            )
            ORDER BY idf.dimension, idf.indicator_key
          ) FILTER (WHERE io.id IS NOT NULL) AS indicators
        FROM ldt_core.cities c
        LEFT JOIN ldt_science.indicator_observations io ON io.city_id = c.id
        LEFT JOIN ldt_science.indicator_definitions idf ON idf.id = io.indicator_id
          AND idf.standard_key = $2
          AND idf.standard_version = $3
        WHERE c.id = $1
        GROUP BY c.id, c.name
      `,
      [cityId, STANDARD_KEY, STANDARD_VERSION],
    )
    if (result.rowCount === 0) throw new Error(`LDT_CITY_NOT_FOUND:${cityId}`)
    return {
      ok: true,
      standardKey: STANDARD_KEY,
      standardVersion: STANDARD_VERSION,
      cityId: result.rows[0].city_id,
      name: result.rows[0].name,
      indicators: result.rows[0].indicators ?? [],
    }
  })
}
