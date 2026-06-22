import { closeSharedProductionPool, withProductionClient as withClient } from './serviceDatabase.mjs'

const DEFAULT_CITY_IDS = ['adazi', 'kharkiv']
const STANDARD_KEY = 'society-culture-core'
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

export async function closeLdtSocietyPool() {
  await closeSharedProductionPool()
}

const SERIES_DEFINITIONS = [
  {
    key: 'demographic_data_readiness',
    theme: 'demography',
    domain: 'demographic',
    title: 'Demographic data readiness',
    unit: '%',
    privacy: 'aggregate',
    sourceQuality: 'gap-assessment',
  },
  {
    key: 'health_anchor_density',
    theme: 'health',
    domain: 'social_service',
    title: 'Health anchor density',
    unit: 'anchors/km2',
    privacy: 'public',
    sourceQuality: 'open-data-derived',
  },
  {
    key: 'education_anchor_density',
    theme: 'education',
    domain: 'social_service',
    title: 'Education anchor density',
    unit: 'anchors/km2',
    privacy: 'public',
    sourceQuality: 'open-data-derived',
  },
  {
    key: 'emergency_anchor_density',
    theme: 'emergency',
    domain: 'public_safety',
    title: 'Emergency anchor density',
    unit: 'anchors/km2',
    privacy: 'public',
    sourceQuality: 'open-data-derived',
  },
  {
    key: 'daily_economy_anchor_density',
    theme: 'daily_economy',
    domain: 'economic',
    title: 'Daily economy anchor density',
    unit: 'anchors/km2',
    privacy: 'public',
    sourceQuality: 'open-data-derived',
  },
  {
    key: 'cultural_anchor_density',
    theme: 'culture',
    domain: 'cultural',
    title: 'Cultural anchor density',
    unit: 'anchors/km2',
    privacy: 'public',
    sourceQuality: 'open-data-derived',
  },
  {
    key: 'civic_anchor_density',
    theme: 'civic',
    domain: 'civic',
    title: 'Civic anchor density',
    unit: 'anchors/km2',
    privacy: 'public',
    sourceQuality: 'open-data-derived',
  },
  {
    key: 'place_identity_anchor_count',
    theme: 'place_identity',
    domain: 'cultural',
    title: 'Place identity anchor count',
    unit: 'anchors',
    privacy: 'public',
    sourceQuality: 'open-data-derived',
  },
  {
    key: 'open_society_data_readiness',
    theme: 'data_readiness',
    domain: 'quality',
    title: 'Open society data readiness',
    unit: '%',
    privacy: 'aggregate',
    sourceQuality: 'open-data-derived',
  },
  {
    key: 'public_participation_readiness',
    theme: 'participation',
    domain: 'participation',
    title: 'Public participation readiness',
    unit: '%',
    privacy: 'aggregate',
    sourceQuality: 'product-readiness',
  },
]

const CATEGORY_GROUPS = {
  health: ['clinic', 'hospital', 'doctors', 'dentist', 'pharmacy'],
  education: ['school', 'university', 'kindergarten', 'college', 'music_school', 'research_institute', 'library'],
  emergency: ['police', 'fire_station', 'shelter', 'hospital'],
  dailyEconomy: [
    'supermarket',
    'mall',
    'restaurant',
    'cafe',
    'fast_food',
    'marketplace',
    'convenience',
    'bakery',
    'bank',
    'post_office',
    'department_store',
    'kiosk',
    'clothes',
    'car',
    'car_repair',
    'fuel',
  ],
  cultural: [
    'theatre',
    'museum',
    'arts_centre',
    'library',
    'place_of_worship',
    'music_school',
    'planetarium',
    'community_centre',
    'public_building',
    'fountain',
  ],
  civic: ['townhall', 'courthouse', 'police', 'fire_station', 'post_office', 'community_centre', 'public_building', 'library'],
}

const PRIVACY_POLICIES = [
  {
    key: 'aggregate-public-city',
    name: 'Aggregate Public City Observation',
    privacyClass: 'aggregate',
    publicViewAllowed: true,
    personalDataAllowed: false,
    rule: 'City-level aggregate observations may be shown publicly when no personal microdata is exposed.',
  },
  {
    key: 'public-open-anchor',
    name: 'Public Open Anchor',
    privacyClass: 'public',
    publicViewAllowed: true,
    personalDataAllowed: false,
    rule: 'Open-data public places, services, and cultural anchors may be shown as public features with provenance.',
  },
  {
    key: 'restricted-sensitive-social',
    name: 'Restricted Sensitive Social Data',
    privacyClass: 'restricted',
    publicViewAllowed: false,
    personalDataAllowed: false,
    rule: 'Sensitive social, household, vulnerability, health, or survey microdata must not be exposed in the open-source viewer.',
  },
]

const SOURCE_QUALITY_RULES = [
  {
    key: 'osm-facility-open-seed',
    domain: 'social_service',
    sourceType: 'open-data',
    qualityClass: 'open-data-seed',
    rule: 'OSM facility tags are useful service anchors but not an official service registry.',
  },
  {
    key: 'osm-shop-economic-seed',
    domain: 'economic',
    sourceType: 'open-data',
    qualityClass: 'open-data-seed',
    rule: 'OSM shops and amenities are daily-economy signals, not a complete business census.',
  },
  {
    key: 'population-required-for-vulnerability',
    domain: 'demographic',
    sourceType: 'missing-required-source',
    qualityClass: 'not-computable',
    rule: 'Vulnerability and equity results require population or demographic denominators before city claims are made.',
  },
  {
    key: 'participation-requires-city-process',
    domain: 'participation',
    sourceType: 'city-process',
    qualityClass: 'product-readiness',
    rule: 'Participation readiness means the product can host records; it is not evidence of actual participation until events are connected.',
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

async function seedPolicies(client) {
  for (const policy of PRIVACY_POLICIES) {
    await client.query(
      `
        INSERT INTO ldt_society.privacy_policies (
          policy_key,
          name,
          privacy_class,
          allowed_geography_levels,
          public_view_allowed,
          personal_data_allowed,
          rule,
          metadata
        )
        VALUES ($1, $2, $3, $4::text[], $5, $6, $7, $8::jsonb)
        ON CONFLICT (policy_key) DO UPDATE SET
          name = EXCLUDED.name,
          privacy_class = EXCLUDED.privacy_class,
          allowed_geography_levels = EXCLUDED.allowed_geography_levels,
          public_view_allowed = EXCLUDED.public_view_allowed,
          personal_data_allowed = EXCLUDED.personal_data_allowed,
          rule = EXCLUDED.rule,
          metadata = EXCLUDED.metadata
      `,
      [
        policy.key,
        policy.name,
        policy.privacyClass,
        sqlArray(['city', 'district', 'grid', 'service_area']),
        policy.publicViewAllowed,
        policy.personalDataAllowed,
        policy.rule,
        JSON.stringify({ standardKey: STANDARD_KEY, standardVersion: STANDARD_VERSION }),
      ],
    )
  }

  for (const rule of SOURCE_QUALITY_RULES) {
    await client.query(
      `
        INSERT INTO ldt_society.source_quality_rules (
          rule_key,
          data_domain,
          source_type,
          quality_class,
          rule,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        ON CONFLICT (rule_key) DO UPDATE SET
          data_domain = EXCLUDED.data_domain,
          source_type = EXCLUDED.source_type,
          quality_class = EXCLUDED.quality_class,
          rule = EXCLUDED.rule,
          metadata = EXCLUDED.metadata
      `,
      [
        rule.key,
        rule.domain,
        rule.sourceType,
        rule.qualityClass,
        rule.rule,
        JSON.stringify({ standardKey: STANDARD_KEY, standardVersion: STANDARD_VERSION }),
      ],
    )
  }
}

async function upsertSeries(client, cityId) {
  const seriesIds = new Map()
  for (const definition of SERIES_DEFINITIONS) {
    const result = await client.query(
      `
        INSERT INTO ldt_society.observation_series (
          city_id,
          series_key,
          theme,
          title,
          geography_level,
          privacy_class,
          metadata,
          standard_key,
          standard_version,
          data_domain,
          allowed_geography_levels,
          aggregation_rule,
          source_quality,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'city', $5, $6::jsonb, $7, $8, $9, $10::text[], 'aggregate-only', $11, now())
        ON CONFLICT (city_id, series_key) DO UPDATE SET
          theme = EXCLUDED.theme,
          title = EXCLUDED.title,
          geography_level = EXCLUDED.geography_level,
          privacy_class = EXCLUDED.privacy_class,
          metadata = EXCLUDED.metadata,
          standard_key = EXCLUDED.standard_key,
          standard_version = EXCLUDED.standard_version,
          data_domain = EXCLUDED.data_domain,
          allowed_geography_levels = EXCLUDED.allowed_geography_levels,
          aggregation_rule = EXCLUDED.aggregation_rule,
          source_quality = EXCLUDED.source_quality,
          updated_at = now()
        RETURNING id
      `,
      [
        cityId,
        definition.key,
        definition.theme,
        definition.title,
        definition.privacy,
        JSON.stringify({
          unit: definition.unit,
          generatedBy: 'phase-8-society-culture-standard',
          personalData: false,
        }),
        STANDARD_KEY,
        STANDARD_VERSION,
        definition.domain,
        sqlArray(['city']),
        definition.sourceQuality,
      ],
    )
    seriesIds.set(definition.key, result.rows[0].id)
  }
  return seriesIds
}

async function computeCitySocietyMetrics(client, cityId) {
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
      facility_counts AS (
        SELECT
          COALESCE(fe.category, fe.amenity, ce.properties->'sourceProperties'->>'shop', 'unknown') AS category,
          count(*)::int AS count
        FROM ldt_core.city_entities ce
        JOIN ldt_core.facility_entities fe ON fe.entity_id = ce.id
        WHERE ce.city_id = $1
        GROUP BY COALESCE(fe.category, fe.amenity, ce.properties->'sourceProperties'->>'shop', 'unknown')
      ),
      place_counts AS (
        SELECT
          count(*)::int AS place_count,
          count(*) FILTER (WHERE pe.place_type IN ('suburb', 'quarter', 'neighbourhood', 'district'))::int AS local_place_count
        FROM ldt_core.city_entities ce
        JOIN ldt_core.place_entities pe ON pe.entity_id = ce.id
        WHERE ce.city_id = $1
      ),
      cultural_assets AS (
        SELECT
          ce.id AS entity_id,
          ce.stable_id,
          ce.label,
          COALESCE(fe.category, fe.amenity, 'cultural_anchor') AS asset_type,
          ce.properties
        FROM ldt_core.city_entities ce
        JOIN ldt_core.facility_entities fe ON fe.entity_id = ce.id
        WHERE ce.city_id = $1
          AND COALESCE(fe.category, fe.amenity) = ANY($2::text[])
      )
      SELECT
        city.id,
        city.name,
        city.country,
        city.region,
        COALESCE(boundary.area_km2, 0) AS area_km2,
        COALESCE((SELECT sum(count)::int FROM facility_counts WHERE category = ANY($3::text[])), 0) AS health_count,
        COALESCE((SELECT sum(count)::int FROM facility_counts WHERE category = ANY($4::text[])), 0) AS education_count,
        COALESCE((SELECT sum(count)::int FROM facility_counts WHERE category = ANY($5::text[])), 0) AS emergency_count,
        COALESCE((SELECT sum(count)::int FROM facility_counts WHERE category = ANY($6::text[])), 0) AS daily_economy_count,
        COALESCE((SELECT sum(count)::int FROM facility_counts WHERE category = ANY($2::text[])), 0) AS cultural_count,
        COALESCE((SELECT sum(count)::int FROM facility_counts WHERE category = ANY($7::text[])), 0) AS civic_count,
        COALESCE((SELECT sum(count)::int FROM facility_counts), 0) AS facility_count,
        place_counts.place_count,
        place_counts.local_place_count,
        COALESCE((SELECT jsonb_agg(cultural_assets ORDER BY label) FROM cultural_assets), '[]'::jsonb) AS cultural_assets
      FROM city, boundary, place_counts
    `,
    [
      cityId,
      CATEGORY_GROUPS.cultural,
      CATEGORY_GROUPS.health,
      CATEGORY_GROUPS.education,
      CATEGORY_GROUPS.emergency,
      CATEGORY_GROUPS.dailyEconomy,
      CATEGORY_GROUPS.civic,
    ],
  )
  if (result.rowCount === 0) throw new Error(`LDT_CITY_NOT_FOUND:${cityId}`)
  return result.rows[0]
}

function density(count, areaKm2) {
  return areaKm2 > 0 ? round(count / areaKm2, 3) : 0
}

function buildObservations(metrics) {
  const areaKm2 = parseNumeric(metrics.area_km2)
  const health = parseNumeric(metrics.health_count)
  const education = parseNumeric(metrics.education_count)
  const emergency = parseNumeric(metrics.emergency_count)
  const dailyEconomy = parseNumeric(metrics.daily_economy_count)
  const cultural = parseNumeric(metrics.cultural_count)
  const civic = parseNumeric(metrics.civic_count)
  const places = parseNumeric(metrics.place_count)
  const localPlaces = parseNumeric(metrics.local_place_count)

  const presentDomains = [
    health > 0,
    education > 0,
    emergency > 0,
    dailyEconomy > 0,
    cultural > 0,
    civic > 0,
  ].filter(Boolean).length

  const observations = [
    {
      key: 'demographic_data_readiness',
      value: 0,
      unit: '%',
      quality: 'not-computable',
      sourceQuality: 'missing-required-source',
      privacy: 'aggregate',
      method: { formula: 'official_or_open_population_dataset_connected ? 100 : 0' },
      uncertainty: { status: 'not-computable', reason: 'No population/demographic dataset connected in Phase 8.' },
    },
    {
      key: 'health_anchor_density',
      value: density(health, areaKm2),
      unit: 'anchors/km2',
      quality: 'open-data-seed',
      sourceQuality: 'open-data-derived',
      privacy: 'public',
      method: { formula: 'health_anchor_count / city_area_km2', inputs: { health, areaKm2 } },
    },
    {
      key: 'education_anchor_density',
      value: density(education, areaKm2),
      unit: 'anchors/km2',
      quality: 'open-data-seed',
      sourceQuality: 'open-data-derived',
      privacy: 'public',
      method: { formula: 'education_anchor_count / city_area_km2', inputs: { education, areaKm2 } },
    },
    {
      key: 'emergency_anchor_density',
      value: density(emergency, areaKm2),
      unit: 'anchors/km2',
      quality: 'open-data-seed',
      sourceQuality: 'open-data-derived',
      privacy: 'public',
      method: { formula: 'emergency_anchor_count / city_area_km2', inputs: { emergency, areaKm2 } },
    },
    {
      key: 'daily_economy_anchor_density',
      value: density(dailyEconomy, areaKm2),
      unit: 'anchors/km2',
      quality: 'open-data-seed',
      sourceQuality: 'open-data-derived',
      privacy: 'public',
      method: { formula: 'daily_economy_anchor_count / city_area_km2', inputs: { dailyEconomy, areaKm2 } },
    },
    {
      key: 'cultural_anchor_density',
      value: density(cultural, areaKm2),
      unit: 'anchors/km2',
      quality: 'open-data-seed',
      sourceQuality: 'open-data-derived',
      privacy: 'public',
      method: { formula: 'cultural_anchor_count / city_area_km2', inputs: { cultural, areaKm2 } },
    },
    {
      key: 'civic_anchor_density',
      value: density(civic, areaKm2),
      unit: 'anchors/km2',
      quality: 'open-data-seed',
      sourceQuality: 'open-data-derived',
      privacy: 'public',
      method: { formula: 'civic_anchor_count / city_area_km2', inputs: { civic, areaKm2 } },
    },
    {
      key: 'place_identity_anchor_count',
      value: places + cultural,
      unit: 'anchors',
      quality: 'open-data-seed',
      sourceQuality: 'open-data-derived',
      privacy: 'public',
      method: { formula: 'place_count + cultural_anchor_count', inputs: { places, cultural, localPlaces } },
    },
    {
      key: 'open_society_data_readiness',
      value: round((100 * presentDomains) / 6, 1),
      unit: '%',
      quality: 'open-data-derived',
      sourceQuality: 'open-data-derived',
      privacy: 'aggregate',
      method: { formula: 'present_open_society_domains / 6 * 100', inputs: { presentDomains, requiredDomains: 6 } },
    },
    {
      key: 'public_participation_readiness',
      value: 25,
      unit: '%',
      quality: 'product-readiness',
      sourceQuality: 'product-readiness',
      privacy: 'aggregate',
      method: { formula: 'platform_has_participation_surface_but_no_city_events_connected' },
      uncertainty: { status: 'qualitative', reason: 'Participation routes exist, but no Kharkiv participation process is connected.' },
    },
  ]

  return observations.map((observation) => ({
    uncertainty: { status: 'qualitative', reason: 'Open-data seed; not authority validated.' },
    ...observation,
    metadata: {
      generatedBy: 'phase-8-society-culture-standard',
      standardKey: STANDARD_KEY,
      standardVersion: STANDARD_VERSION,
      personalData: false,
      aggregation: 'city',
    },
  }))
}

async function upsertObservation(client, cityId, seriesIds, observation) {
  const seriesId = seriesIds.get(observation.key)
  if (!seriesId) throw new Error(`SOCIETY_SERIES_MISSING:${observation.key}`)
  const observationKey = `${STANDARD_KEY}:${STANDARD_VERSION}:${cityId}:city:${observation.key}`
  await client.query(
    `
      INSERT INTO ldt_society.observations (
        series_id,
        observation_key,
        geography_level,
        observed_at,
        value,
        value_json,
        unit,
        quality,
        privacy_class,
        method,
        uncertainty,
        source_quality,
        metadata,
        updated_at
      )
      VALUES ($1, $2, 'city', now(), $3, $4::jsonb, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11::jsonb, now())
      ON CONFLICT (observation_key) DO UPDATE SET
        value = EXCLUDED.value,
        value_json = EXCLUDED.value_json,
        unit = EXCLUDED.unit,
        quality = EXCLUDED.quality,
        privacy_class = EXCLUDED.privacy_class,
        method = EXCLUDED.method,
        uncertainty = EXCLUDED.uncertainty,
        source_quality = EXCLUDED.source_quality,
        metadata = EXCLUDED.metadata,
        updated_at = now()
    `,
    [
      seriesId,
      observationKey,
      observation.value,
      JSON.stringify({ value: observation.value, unit: observation.unit }),
      observation.unit,
      observation.quality,
      observation.privacy,
      JSON.stringify(observation.method),
      JSON.stringify(observation.uncertainty),
      observation.sourceQuality,
      JSON.stringify(observation.metadata),
    ],
  )
}

async function upsertDomainProfiles(client, cityId, metrics, observations) {
  const profiles = observations.map((observation) => ({
    key: observation.key.replace(/_density|_count|_readiness/g, ''),
    domain: SERIES_DEFINITIONS.find((definition) => definition.key === observation.key)?.domain ?? 'general',
    label: SERIES_DEFINITIONS.find((definition) => definition.key === observation.key)?.title ?? observation.key,
    metrics: {
      value: observation.value,
      unit: observation.unit,
      quality: observation.quality,
      method: observation.method,
    },
    quality: observation.quality,
    privacy: observation.privacy,
  }))

  for (const profile of profiles) {
    await client.query(
      `
        INSERT INTO ldt_society.domain_profiles (
          city_id,
          profile_key,
          data_domain,
          label,
          geography_level,
          metrics,
          quality,
          privacy_class,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'city', $5::jsonb, $6, $7, now())
        ON CONFLICT (city_id, profile_key) DO UPDATE SET
          data_domain = EXCLUDED.data_domain,
          label = EXCLUDED.label,
          geography_level = EXCLUDED.geography_level,
          metrics = EXCLUDED.metrics,
          quality = EXCLUDED.quality,
          privacy_class = EXCLUDED.privacy_class,
          updated_at = now()
      `,
      [cityId, profile.key, profile.domain, profile.label, JSON.stringify(profile.metrics), profile.quality, profile.privacy],
    )
  }

  await client.query(
    `
      DELETE FROM ldt_society.social_vulnerability_scores
      WHERE city_id = $1
        AND score_key = 'baseline_social_vulnerability'
        AND geography_entity_id IS NULL
    `,
    [cityId],
  )

  await client.query(
    `
      INSERT INTO ldt_society.social_vulnerability_scores (
        city_id,
        score_key,
        score,
        components,
        quality,
        privacy_class,
        method,
        updated_at
      )
      VALUES ($1, 'baseline_social_vulnerability', NULL, $2::jsonb, 'not-computable', 'aggregate', $3::jsonb, now())
      ON CONFLICT (city_id, geography_entity_id, score_key) DO UPDATE SET
        score = EXCLUDED.score,
        components = EXCLUDED.components,
        quality = EXCLUDED.quality,
        privacy_class = EXCLUDED.privacy_class,
        method = EXCLUDED.method,
        updated_at = now()
    `,
    [
      cityId,
      JSON.stringify({
        demographicDataReadiness: 0,
        healthAnchors: parseNumeric(metrics.health_count),
        emergencyAnchors: parseNumeric(metrics.emergency_count),
      }),
      JSON.stringify({ status: 'blocked', missingInputs: ['population grid', 'age/disability/income data', 'official service catchments'] }),
    ],
  )

  await client.query(
    `
      INSERT INTO ldt_society.equity_gap_results (
        city_id,
        gap_key,
        geography_level,
        value,
        value_json,
        quality,
        privacy_class,
        method,
        updated_at
      )
      VALUES ($1, 'service_equity_gap_baseline', 'city', NULL, $2::jsonb, 'not-computable', 'aggregate', $3::jsonb, now())
      ON CONFLICT (city_id, gap_key, geography_level) DO UPDATE SET
        value = EXCLUDED.value,
        value_json = EXCLUDED.value_json,
        quality = EXCLUDED.quality,
        privacy_class = EXCLUDED.privacy_class,
        method = EXCLUDED.method,
        updated_at = now()
    `,
    [
      cityId,
      JSON.stringify({ status: 'requires subarea population and service catchments' }),
      JSON.stringify({ blockedBy: ['population denominators', 'district/grid geography', 'service access model'] }),
    ],
  )
}

async function upsertCulturalAssets(client, cityId, metrics) {
  const assets = Array.isArray(metrics.cultural_assets) ? metrics.cultural_assets : []
  await client.query('DELETE FROM ldt_society.cultural_assets WHERE city_id = $1', [cityId])
  for (const asset of assets.slice(0, 5000)) {
    await client.query(
      `
        INSERT INTO ldt_society.cultural_assets (
          city_id,
          entity_id,
          asset_key,
          asset_type,
          label,
          source_quality,
          privacy_class,
          metadata,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'open-data-derived', 'public', $6::jsonb, now())
        ON CONFLICT (city_id, asset_key) DO UPDATE SET
          entity_id = EXCLUDED.entity_id,
          asset_type = EXCLUDED.asset_type,
          label = EXCLUDED.label,
          source_quality = EXCLUDED.source_quality,
          privacy_class = EXCLUDED.privacy_class,
          metadata = EXCLUDED.metadata,
          updated_at = now()
      `,
      [
        cityId,
        asset.entity_id,
        asset.stable_id || `cultural:${asset.entity_id}`,
        asset.asset_type || 'cultural_anchor',
        asset.label || asset.asset_type || 'Cultural anchor',
        JSON.stringify({ sourceProperties: asset.properties?.sourceProperties ?? {}, generatedBy: 'phase-8-society-culture-standard' }),
      ],
    )
  }
  return assets.length
}

async function upsertParticipationSeed(client, cityId) {
  await client.query(
    `
      INSERT INTO ldt_society.participation_events (
        city_id,
        event_key,
        title,
        event_type,
        event_status,
        privacy_class,
        metadata
      )
      VALUES (
        $1,
        'open-twin-stakeholder-review',
        'Open twin review with city stakeholders',
        'stakeholder_review',
        'planned',
        'aggregate',
        $2::jsonb
      )
      ON CONFLICT (city_id, event_key) DO UPDATE SET
        title = EXCLUDED.title,
        event_type = EXCLUDED.event_type,
        event_status = EXCLUDED.event_status,
        privacy_class = EXCLUDED.privacy_class,
        metadata = EXCLUDED.metadata
    `,
    [cityId, JSON.stringify({ generatedBy: 'phase-8-society-culture-standard', personalData: false })],
  )
}

async function generateCitySociety(client, cityId) {
  const seriesIds = await upsertSeries(client, cityId)
  const metrics = await computeCitySocietyMetrics(client, cityId)
  const observations = buildObservations(metrics)
  for (const observation of observations) {
    await upsertObservation(client, cityId, seriesIds, observation)
  }
  await upsertDomainProfiles(client, cityId, metrics, observations)
  const culturalAssetCount = await upsertCulturalAssets(client, cityId, metrics)
  await upsertParticipationSeed(client, cityId)

  return {
    cityId,
    name: metrics.name,
    areaKm2: round(metrics.area_km2, 2),
    observationCount: observations.length,
    culturalAssetCount,
    healthAnchors: parseNumeric(metrics.health_count),
    educationAnchors: parseNumeric(metrics.education_count),
    emergencyAnchors: parseNumeric(metrics.emergency_count),
    dailyEconomyAnchors: parseNumeric(metrics.daily_economy_count),
    privacyPosture: 'aggregate-public-no-personal-data',
  }
}

export async function generateLdtSocietyStandard({ cityIds = DEFAULT_CITY_IDS } = {}) {
  return await withClient(async (client) => {
    return await withLowMemoryTransaction(client, async () => {
      await seedPolicies(client)
      const targetCityIds = await listCityIds(client, cityIds)
      const cities = []
      for (const cityId of targetCityIds) {
        cities.push(await generateCitySociety(client, cityId))
      }
      return {
        ok: true,
        standardKey: STANDARD_KEY,
        standardVersion: STANDARD_VERSION,
        seriesDefinitions: SERIES_DEFINITIONS.length,
        privacyPolicies: PRIVACY_POLICIES.length,
        sourceQualityRules: SOURCE_QUALITY_RULES.length,
        cityCount: cities.length,
        cities,
      }
    })
  })
}

export async function getLdtSocietyReport(cityId) {
  return await withClient(async (client) => {
    const result = await client.query(
      `
        SELECT
          c.id AS city_id,
          c.name,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'key', os.series_key,
                'theme', os.theme,
                'domain', os.data_domain,
                'title', os.title,
                'value', o.value,
                'unit', o.unit,
                'quality', o.quality,
                'privacyClass', o.privacy_class,
                'sourceQuality', o.source_quality,
                'method', o.method,
                'uncertainty', o.uncertainty,
                'metadata', o.metadata,
                'updatedAt', o.updated_at
              )
              ORDER BY os.data_domain, os.series_key
            ) FILTER (WHERE o.id IS NOT NULL),
            '[]'::jsonb
          ) AS observations,
          (
            SELECT count(*)::int
            FROM ldt_society.cultural_assets ca
            WHERE ca.city_id = c.id
          ) AS cultural_assets,
          (
            SELECT count(*)::int
            FROM ldt_society.participation_events pe
            WHERE pe.city_id = c.id
          ) AS participation_events
        FROM ldt_core.cities c
        LEFT JOIN ldt_society.observation_series os ON os.city_id = c.id
          AND os.standard_key = $2
          AND os.standard_version = $3
        LEFT JOIN ldt_society.observations o ON o.series_id = os.id
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
      observations: result.rows[0].observations,
      culturalAssets: result.rows[0].cultural_assets,
      participationEvents: result.rows[0].participation_events,
      privacyPosture: 'aggregate and public-open anchors only; no personal microdata',
    }
  })
}
