import { withClient } from './dbUtils.mjs'
import { requestCipJson, resolveCipTarget } from './euLdtCityInnovationPlannerService.mjs'

const VALIDATION_STATES = new Set(['candidate', 'validated', 'rejected', 'lab', 'simulated'])
const SOURCE_MODES = new Set(['manual', 'autonomous', 'computed', 'external', 'cip'])
const THRESHOLD_OPERATORS = new Set(['gt', 'gte', 'lt', 'lte', 'eq', 'between', 'outside'])
const APPROVED_AUTHORITIES = new Set([
  'authority-approved',
  'municipal-provided',
  'municipal-authoritative',
  'operator-accepted',
  'official',
  'verified',
])

const U4SSC_DIFFICULTY = {
  low: new Set([
    'EC:ICT:ICT:5A', 'EC:ICT:PS:1A', 'EC:ICT:PS:2A', 'EC:ICT:PS:3A', 'EC:I:UP:2A',
    'EC:P:EM:1C', 'EC:P:EM:2C', 'EC:P:IN:1C', 'EC:P:IN:2C', 'EC:P:IN:3A',
    'SA:EH:C:1C', 'SA:EH:H:5A', 'SC:EH:C:2A', 'SC:EH:ED:2C', 'SC:EH:ED:3C',
    'SC:EH:ED:4C', 'SC:EH:H:1C', 'SC:EH:H:3C', 'SC:EH:H:4A', 'SC:SH:SA:3A',
    'SC:SH:SA:6C', 'SC:SH:SA:7C', 'SC:SH:SI:4C',
  ]),
  medium: new Set([
    'EC:I:B:1A', 'EC:I:B:2A', 'EC:ICT:ICT:1C', 'EC:ICT:ICT:2C', 'EC:ICT:ICT:3C',
    'EC:ICT:T:1C', 'EC:I:ES:3C', 'EC:I:T:1C', 'EC:I:T:2A', 'EC:I:T:3C',
    'EC:I:T:6A', 'EC:I:T:7A', 'EC:I:T:8A', 'EC:I:UP:1A', 'EC:I:WA:1C',
    'EC:I:WS:1C', 'EC:I:WS:4C', 'EC:I:WS:5C', 'EC:P:EM:3A', 'EC:P:EM:4A',
    'EN:E:E:4A', 'EN:EN:PSN:1C', 'EN:EN:PSN:2A', 'EN:EN:PSN:3A', 'EN:EN:PSN:4A',
    'EN:EN:WA:1C', 'SC:EH:ED:1C', 'SC:EH:H:2C', 'SC:SH:SA:1C', 'SC:SH:SA:8C',
    'SC:SH:SA:9C', 'SC:SH:SI:5A',
  ]),
  high: new Set([
    'EC:ICT:D:1A', 'EC:ICT:ES:1C', 'EC:ICT:ES:2A', 'EC:ICT:ES:3A', 'EC:ICT:ICT:4C',
    'EC:ICT:T:2C', 'EC:ICT:T:3A', 'EC:ICT:WS:1C', 'EC:ICT:WS:2A', 'EC:I:ES:1C',
    'EC:I:ES:2C', 'EC:I:T:5A', 'EC:I:WS:2C', 'EC:I:WS:3C', 'EN:E:E:1C',
    'EN:E:E:2C', 'EN:E:E:3C', 'EN:EN:AQ:1C', 'EN:EN:WS:1C', 'EN:EN:WS:2C',
    'EN:EN:WS:3C', 'EN:EN:WS:4C', 'SC:EH:H:6A', 'SC:SH:SA:2C', 'SC:SH:SA:5A',
  ]),
  veryHigh: new Set([
    'EC:I:T:4A', 'EN:EN:AQ:2C', 'EN:EN:EQ:1C', 'EN:EN:EQ:2A', 'SC:SH:FS:1A',
    'SC:SH:HO:1C', 'SC:SH:HO:2A', 'SC:SH:SA:4A', 'SC:SH:SI:1C', 'SC:SH:SI:2C',
    'SC:SH:SI:3C',
  ]),
}

function text(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function object(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback
}

function array(value, fallback = []) {
  return Array.isArray(value) ? value : fallback
}

function finite(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function boundedInteger(value, fallback = 100, minimum = 1, maximum = 1000) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, number))
}

function normalizedKey(value, fallback = '') {
  const normalized = text(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{1,128}$/.test(normalized)) throw new Error('INDICATOR_FRAMEWORK_KEY_INVALID')
  return normalized
}

function indicatorKeyFor(catalogKey, externalCode) {
  const code = text(externalCode)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
  return normalizedKey(`${catalogKey}.${code}`)
}

function difficultyForU4ssc(code) {
  if (U4SSC_DIFFICULTY.low.has(code)) return 'low'
  if (U4SSC_DIFFICULTY.medium.has(code)) return 'medium'
  if (U4SSC_DIFFICULTY.high.has(code)) return 'high'
  if (U4SSC_DIFFICULTY.veryHigh.has(code)) return 'very-high'
  return 'unclassified'
}

function tierForDifficulty(difficulty) {
  if (difficulty === 'low') return 'reference-first'
  if (difficulty === 'medium') return 'spatial-template'
  if (difficulty === 'high') return 'integration-template'
  return 'research-contract'
}

function spatialRequirementForU4ssc(item = {}) {
  const name = text(item.name).toLowerCase()
  const subdimension = text(item.subdimension).toLowerCase()
  const canonical = (key, label, entityTypes) => ({
    requirementKey: key,
    label,
    requirementType: 'canonical-entity',
    sourceRef: entityTypes.join(','),
    required: false,
    weight: 0.35,
    rule: { entityTypes, minimumCount: 1, requireBoundary: true, requireAuthority: true, role: 'spatial-anchor' },
  })
  const domain = (key, label, sourceRef) => ({
    requirementKey: key,
    label,
    requirementType: 'domain-table',
    sourceRef,
    required: false,
    weight: 0.35,
    rule: { minimumCount: 1, requireBoundary: true, requireAuthority: true, role: 'spatial-anchor' },
  })
  const phenomenon = (key, label, family) => ({
    requirementKey: key,
    label,
    requirementType: 'phenomenon-layer',
    sourceRef: family,
    required: false,
    weight: 0.35,
    rule: { family, minimumCount: 1, requireAuthority: true, role: 'spatial-context' },
  })

  if (subdimension === 'buildings' || name.includes('building')) {
    return canonical('building-anchor', 'Municipally accepted building inventory', ['building'])
  }
  if (subdimension === 'transport') {
    if (name.includes('public transport') || name.includes('shared') || name.includes('mode share')) {
      return domain('mobility-anchor', 'Authoritative mobility routes, stops, trips, or fleets', 'mobility')
    }
    return canonical('road-anchor', 'Municipally accepted road and street inventory', ['road'])
  }
  if (subdimension === 'urban planning') {
    if (name.includes('pedestrian')) return canonical('street-anchor', 'Municipally accepted street inventory', ['road'])
    return domain('land-use-anchor', 'Current statutory land-use and planning geometry', 'land-use')
  }
  if (subdimension === 'public space and nature') {
    return domain('green-blue-anchor', 'Authoritative green, protected, and recreation geometry', 'green-blue')
  }
  if (['culture', 'education', 'health'].includes(subdimension) || name.includes('childcare')) {
    return domain('facility-anchor', 'Authoritative facility registry', 'facilities')
  }
  if (subdimension === 'housing') return canonical('building-anchor', 'Municipally accepted building and settlement inventory', ['building'])
  if (subdimension === 'energy' && name.includes('public building')) {
    return canonical('building-anchor', 'Municipally accepted public-building inventory', ['building'])
  }
  if (subdimension === 'air quality') return phenomenon('air-quality-context', 'Validated pollutant observations or exposure surface', 'air_quality')
  if (subdimension === 'environmental quality') return phenomenon('environment-context', 'Validated environmental exposure surface', 'environmental_quality')
  if (subdimension === 'safety') {
    if (name.includes('traffic')) return canonical('road-anchor', 'Municipally accepted road inventory', ['road'])
    if (name.includes('disaster') || name.includes('resilience')) return phenomenon('hazard-context', 'Authority-backed hazard and exposure surface', 'hazard')
    if (name.includes('police') || name.includes('fire') || name.includes('emergency')) {
      return domain('emergency-facility-anchor', 'Authoritative emergency-service facilities and service areas', 'facilities')
    }
  }
  return null
}

function requirementsForU4ssc(item) {
  const requirements = [{
    requirementKey: 'validated-value',
    label: 'Validated city measurement or executable official formula',
    requirementType: 'validated-observation',
    sourceRef: text(item.code),
    required: true,
    weight: 1,
    rule: {
      minimumCount: 1,
      acceptedValidationStatuses: ['validated'],
      acceptedAuthorityStatuses: Array.from(APPROVED_AUTHORITIES),
    },
    metadata: {
      methodology: text(item.methodology),
      datasources: text(item.datasources),
    },
  }]
  const spatial = spatialRequirementForU4ssc(item)
  if (spatial) requirements.push(spatial)
  return requirements
}

function catalogRow(row) {
  return {
    id: row.id,
    catalogKey: row.catalog_key,
    title: row.title,
    description: row.description,
    publisher: row.publisher,
    version: row.version,
    standardUri: row.standard_uri,
    adapterKey: row.adapter_key,
    status: row.status,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function requirementPayload(value = {}, index = 0) {
  const requirementType = text(value.requirementType ?? value.requirement_type, 'manual')
  const allowed = new Set([
    'validated-observation', 'canonical-entity', 'domain-table', 'observation-series',
    'phenomenon-layer', 'context-observation', 'model-output', 'external-authority-value', 'manual',
  ])
  if (!allowed.has(requirementType)) throw new Error(`INDICATOR_REQUIREMENT_TYPE_INVALID:${requirementType}`)
  return {
    requirementKey: normalizedKey(value.requirementKey ?? value.requirement_key, `requirement-${index + 1}`),
    label: text(value.label, `Requirement ${index + 1}`),
    requirementType,
    sourceRef: text(value.sourceRef ?? value.source_ref),
    required: value.required !== false,
    weight: Math.max(0.01, finite(value.weight, 1)),
    rule: object(value.rule),
    metadata: object(value.metadata),
  }
}

async function upsertCatalogWithDefinitions(client, payload = {}) {
  const catalogKey = normalizedKey(payload.catalogKey ?? payload.catalog_key, payload.title)
  const version = text(payload.version, 'unversioned')
  const result = await client.query(`
    INSERT INTO ldt_science.indicator_catalogs (
      catalog_key, title, description, publisher, version, standard_uri,
      adapter_key, status, metadata, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,now())
    ON CONFLICT (catalog_key) DO UPDATE SET
      title=EXCLUDED.title,
      description=EXCLUDED.description,
      publisher=EXCLUDED.publisher,
      version=EXCLUDED.version,
      standard_uri=EXCLUDED.standard_uri,
      adapter_key=EXCLUDED.adapter_key,
      status=EXCLUDED.status,
      metadata=ldt_science.indicator_catalogs.metadata || EXCLUDED.metadata,
      updated_at=now()
    RETURNING *
  `, [
    catalogKey,
    text(payload.title, catalogKey),
    text(payload.description),
    text(payload.publisher),
    version,
    text(payload.standardUri ?? payload.standard_uri) || null,
    text(payload.adapterKey ?? payload.adapter_key, 'manual'),
    text(payload.status, 'active'),
    JSON.stringify(object(payload.metadata)),
  ])
  const catalog = result.rows[0]
  const definitions = array(payload.definitions)
  let requirementCount = 0
  const indicatorIds = []

  for (const [index, item] of definitions.entries()) {
    const externalCode = text(item.externalCode ?? item.external_code ?? item.code ?? item.indicatorKey ?? item.indicator_key)
    if (!externalCode) throw new Error(`INDICATOR_EXTERNAL_CODE_REQUIRED:${index}`)
    const indicatorKey = normalizedKey(item.indicatorKey ?? item.indicator_key, indicatorKeyFor(catalogKey, externalCode))
    const sourceMode = text(item.sourceMode ?? item.source_mode, 'manual')
    if (!SOURCE_MODES.has(sourceMode)) throw new Error(`INDICATOR_SOURCE_MODE_INVALID:${sourceMode}`)
    const kind = text(item.kind, 'indicator')
    if (!['indicator', 'kpi'].includes(kind)) throw new Error(`INDICATOR_KIND_INVALID:${kind}`)
    const definition = await client.query(`
      INSERT INTO ldt_science.indicator_definitions (
        indicator_key, name, model_family, unit, definition, method,
        standard_key, standard_version, dimension, calculation_scope,
        expected_direction, metadata, kind, source_mode, model_key, output_key,
        formula, target, visualization, active, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19::jsonb,$20,now())
      ON CONFLICT (indicator_key) DO UPDATE SET
        name=EXCLUDED.name,
        model_family=EXCLUDED.model_family,
        unit=EXCLUDED.unit,
        definition=EXCLUDED.definition,
        method=EXCLUDED.method,
        standard_key=EXCLUDED.standard_key,
        standard_version=EXCLUDED.standard_version,
        dimension=EXCLUDED.dimension,
        calculation_scope=EXCLUDED.calculation_scope,
        expected_direction=EXCLUDED.expected_direction,
        metadata=ldt_science.indicator_definitions.metadata || EXCLUDED.metadata,
        kind=EXCLUDED.kind,
        source_mode=EXCLUDED.source_mode,
        model_key=EXCLUDED.model_key,
        output_key=EXCLUDED.output_key,
        formula=EXCLUDED.formula,
        target=EXCLUDED.target,
        visualization=EXCLUDED.visualization,
        active=EXCLUDED.active,
        updated_at=now()
      RETURNING *
    `, [
      indicatorKey,
      text(item.name ?? item.displayName ?? item.display_name, externalCode),
      text(item.modelFamily ?? item.model_family, 'descriptive'),
      text(item.unit) || null,
      text(item.definition ?? item.description),
      JSON.stringify({
        methodology: text(item.methodology),
        datasources: text(item.datasources ?? item.dataSources),
        ...object(item.method),
      }),
      catalogKey,
      version,
      text(item.dimension, 'general'),
      text(item.scope ?? item.calculationScope ?? item.calculation_scope, 'city'),
      text(item.expectedDirection ?? item.expected_direction) || null,
      JSON.stringify({
        difficulty: text(item.difficulty, 'unclassified'),
        implementationTier: text(item.implementationTier ?? item.implementation_tier, 'unclassified'),
        rationale: text(item.rationale),
        sdgReference: text(item.sdgReference ?? item.sdg_reference),
        ...object(item.metadata),
      }),
      kind,
      sourceMode,
      text(item.modelKey ?? item.model_key),
      text(item.outputKey ?? item.output_key),
      JSON.stringify(object(item.formula)),
      JSON.stringify(object(item.target)),
      JSON.stringify(object(item.visualization)),
      item.active !== false,
    ])
    const definitionRow = definition.rows[0]
    indicatorIds.push(definitionRow.id)
    const membership = await client.query(`
      INSERT INTO ldt_science.indicator_catalog_memberships (
        catalog_id, indicator_id, external_code, dimension, subdimension,
        level, indicator_type, sort_order, metadata, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,now())
      ON CONFLICT (catalog_id, external_code) DO UPDATE SET
        indicator_id=EXCLUDED.indicator_id,
        dimension=EXCLUDED.dimension,
        subdimension=EXCLUDED.subdimension,
        level=EXCLUDED.level,
        indicator_type=EXCLUDED.indicator_type,
        sort_order=EXCLUDED.sort_order,
        metadata=ldt_science.indicator_catalog_memberships.metadata || EXCLUDED.metadata,
        updated_at=now()
      RETURNING *
    `, [
      catalog.id,
      definitionRow.id,
      externalCode,
      text(item.dimension, 'general'),
      text(item.subdimension),
      text(item.level ?? item.type),
      text(item.indicatorType ?? item.indicator_type),
      Number.isFinite(Number(item.sortOrder ?? item.sort_order)) ? Number(item.sortOrder ?? item.sort_order) : index,
      JSON.stringify(object(item.membershipMetadata ?? item.membership_metadata)),
    ])
    const requirements = array(item.requirements).map(requirementPayload)
    await client.query('DELETE FROM ldt_science.indicator_requirements WHERE membership_id=$1', [membership.rows[0].id])
    for (const requirement of requirements) {
      await client.query(`
        INSERT INTO ldt_science.indicator_requirements (
          membership_id, requirement_key, label, requirement_type, source_ref,
          required, weight, rule, metadata, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,now())
      `, [
        membership.rows[0].id,
        requirement.requirementKey,
        requirement.label,
        requirement.requirementType,
        requirement.sourceRef,
        requirement.required,
        requirement.weight,
        JSON.stringify(requirement.rule),
        JSON.stringify(requirement.metadata),
      ])
      requirementCount += 1
    }
  }

  return {
    catalog: catalogRow(catalog),
    definitionCount: definitions.length,
    requirementCount,
    indicatorIds,
  }
}

async function selectCipProfileKey(client, cityId, explicitProfileKey) {
  if (text(explicitProfileKey)) return normalizedKey(explicitProfileKey)
  const result = await client.query(`
    SELECT profile_key
    FROM ldt_interop.eu_ldt_integration_profiles
    WHERE platform_kind='city-innovation-planner'
      AND status NOT IN ('disabled', 'archived')
      AND (city_id=$1 OR city_id IS NULL)
    ORDER BY CASE WHEN city_id=$1 THEN 0 ELSE 1 END, updated_at DESC
    LIMIT 1
  `, [cityId])
  if (!result.rowCount) throw new Error('CIP_INTEGRATION_PROFILE_REQUIRED')
  return result.rows[0].profile_key
}

async function fetchCipU4sscCatalog(cityId, profileKey) {
  const target = await withClient(async (client) => {
    const selected = await selectCipProfileKey(client, cityId, profileKey)
    return resolveCipTarget(client, selected)
  })
  const explicit = text(target.profile?.endpoints?.kpiU4sscUrl)
  const baseUrl = explicit || `${target.endpoint.replace(/\/+$/, '')}/kpi-u4ssc`
  const content = []
  let page = 0
  let total = null
  while (page < 20) {
    const url = new URL(baseUrl)
    url.searchParams.set('page', String(page))
    url.searchParams.set('size', '100')
    const result = await requestCipJson(url.toString(), { headers: target.headers })
    const rows = array(result.body?.content)
    content.push(...rows)
    total = finite(result.body?.metadata?.total, total)
    if (!rows.length || rows.length < 100 || (total != null && content.length >= total)) break
    page += 1
  }
  return { target, content, total: total ?? content.length }
}

export async function importIndicatorCatalog(payload = {}) {
  const cityId = text(payload.cityId ?? payload.city_id)
  if (!cityId) throw new Error('CITY_ID_REQUIRED')
  const adapterKey = text(payload.adapterKey ?? payload.adapter_key ?? payload.adapter, 'json')
  let catalogPayload
  let sourceSummary = { adapterKey }

  if (adapterKey === 'cip-u4ssc') {
    const fetched = await fetchCipU4sscCatalog(cityId, payload.cipProfileKey ?? payload.cip_profile_key)
    const catalogKey = normalizedKey(payload.catalogKey ?? payload.catalog_key, 'u4ssc')
    catalogPayload = {
      catalogKey,
      title: text(payload.title, 'U4SSC indicators'),
      description: 'U4SSC compatibility catalog synchronized from EU LDT City Innovation Planner.',
      publisher: 'ITU / U4SSC via EU LDT City Innovation Planner',
      version: text(payload.version, 'cip-live'),
      standardUri: text(payload.standardUri ?? payload.standard_uri, 'https://www.itu.int/en/ITU-T/ssc/Pages/KPIs-on-SSC.aspx'),
      adapterKey,
      metadata: {
        cipProfileKey: fetched.target.profileKey,
        sourceEndpoint: fetched.target.endpoint,
        synchronizedAt: new Date().toISOString(),
        ...object(payload.metadata),
      },
      definitions: fetched.content.map((item, index) => {
        const difficulty = difficultyForU4ssc(item.code)
        return {
          externalCode: item.code,
          name: item.name,
          dimension: item.dimension,
          subdimension: item.subdimension,
          level: item.type,
          indicatorType: item.indicatorType,
          unit: item.unit,
          definition: item.definition,
          rationale: item.rationale,
          methodology: item.methodology,
          datasources: item.datasources,
          sdgReference: item.sdgReference,
          sourceMode: 'manual',
          scope: 'city',
          difficulty,
          implementationTier: tierForDifficulty(difficulty),
          sortOrder: index,
          requirements: requirementsForU4ssc(item),
          metadata: { cipCatalogRecord: true },
        }
      }),
    }
    sourceSummary = {
      adapterKey,
      cipProfileKey: fetched.target.profileKey,
      fetchedCount: fetched.content.length,
      remoteTotal: fetched.total,
    }
  } else if (adapterKey === 'json' || adapterKey === 'manual') {
    catalogPayload = {
      ...object(payload.catalog, payload),
      catalogKey: payload.catalogKey ?? payload.catalog_key ?? payload.catalog?.catalogKey,
      adapterKey,
      definitions: array(payload.definitions ?? payload.catalog?.definitions),
    }
  } else {
    throw new Error(`INDICATOR_CATALOG_ADAPTER_UNSUPPORTED:${adapterKey}`)
  }

  const imported = await withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const result = await upsertCatalogWithDefinitions(client, catalogPayload)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
  const validation = payload.validate === false
    ? null
    : await validateIndicatorCatalog({ cityId, catalogKey: imported.catalog.catalogKey, requestedBy: payload.requestedBy ?? payload.requested_by ?? 'catalog-import' })
  return { ok: true, cityId, ...sourceSummary, ...imported, validation: validation?.summary ?? null }
}

export async function upsertIndicatorCatalog(payload = {}) {
  const cityId = text(payload.cityId ?? payload.city_id)
  if (!cityId) throw new Error('CITY_ID_REQUIRED')
  const imported = await withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const result = await upsertCatalogWithDefinitions(client, payload)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
  return { ok: true, cityId, ...imported }
}

async function validationSnapshot(client, cityId) {
  const entities = await client.query(`
    WITH boundary AS (
      SELECT geom
      FROM ldt_core.city_boundaries
      WHERE city_id=$1
        AND lower(COALESCE(boundary_role, '')) NOT LIKE '%test%'
        AND lower(COALESCE(properties->>'source', '')) NOT LIKE '%smoke%'
      ORDER BY CASE boundary_role WHEN 'municipality' THEN 0 WHEN 'administrative' THEN 1 ELSE 2 END,
        created_at DESC
      LIMIT 1
    )
    SELECT entity.entity_type,
      count(*)::int AS total_count,
      count(*) FILTER (
        WHERE boundary.geom IS NOT NULL
          AND ST_CoveredBy(ST_PointOnSurface(entity.geom), boundary.geom)
      )::int AS inside_count,
      count(*) FILTER (
        WHERE entity.authority_status = ANY($2::text[])
          AND boundary.geom IS NOT NULL
          AND ST_CoveredBy(ST_PointOnSurface(entity.geom), boundary.geom)
      )::int AS approved_inside_count,
      jsonb_agg(DISTINCT entity.authority_status) AS authority_statuses
    FROM ldt_core.city_entities entity
    LEFT JOIN boundary ON true
    WHERE entity.city_id=$1
    GROUP BY entity.entity_type
  `, [cityId, Array.from(APPROVED_AUTHORITIES)])

  const domains = await client.query(`
    SELECT 'facilities' AS domain_key,
      count(*)::int AS total_count,
      count(*) FILTER (WHERE entity.authority_status = ANY($2::text[]))::int AS approved_count
    FROM ldt_core.facility_entities domain JOIN ldt_core.city_entities entity ON entity.id=domain.entity_id WHERE entity.city_id=$1
    UNION ALL
    SELECT 'green-blue', count(*)::int,
      count(*) FILTER (WHERE entity.authority_status = ANY($2::text[]))::int
    FROM ldt_core.green_blue_entities domain JOIN ldt_core.city_entities entity ON entity.id=domain.entity_id WHERE entity.city_id=$1
    UNION ALL
    SELECT 'land-use', count(*)::int,
      count(*) FILTER (WHERE entity.authority_status = ANY($2::text[]))::int
    FROM ldt_core.land_use_entities domain JOIN ldt_core.city_entities entity ON entity.id=domain.entity_id WHERE entity.city_id=$1
    UNION ALL
    SELECT 'mobility', count(*)::int,
      count(*) FILTER (WHERE entity.authority_status = ANY($2::text[]))::int
    FROM ldt_core.mobility_entities domain JOIN ldt_core.city_entities entity ON entity.id=domain.entity_id WHERE entity.city_id=$1
    UNION ALL
    SELECT 'places', count(*)::int,
      count(*) FILTER (WHERE entity.authority_status = ANY($2::text[]))::int
    FROM ldt_core.place_entities domain JOIN ldt_core.city_entities entity ON entity.id=domain.entity_id WHERE entity.city_id=$1
  `, [cityId, Array.from(APPROVED_AUTHORITIES)])

  const series = await client.query(`
    SELECT lower(COALESCE(NULLIF(series.data_domain, ''), NULLIF(series.theme, ''), 'general')) AS series_key,
      count(observation.id)::int AS observation_count,
      count(observation.id) FILTER (
        WHERE lower(COALESCE(observation.source_quality, observation.quality, '')) NOT LIKE '%synthetic%'
          AND lower(COALESCE(observation.source_quality, observation.quality, '')) NOT LIKE '%lab%'
      )::int AS usable_count
    FROM ldt_society.observation_series series
    LEFT JOIN ldt_society.observations observation ON observation.series_id=series.id
    WHERE series.city_id=$1
    GROUP BY 1
  `, [cityId])

  const phenomena = await client.query(`
    SELECT layer.layer_key, lower(layer.phenomenon_family) AS family,
      layer.authority_status, layer.source_status,
      count(cell.id) FILTER (WHERE cell.city_id=$1)::int AS cell_count
    FROM ldt_environment.phenomenon_layers layer
    LEFT JOIN ldt_environment.phenomenon_cells cell ON cell.layer_id=layer.id
    GROUP BY layer.id
  `, [cityId])

  const context = await client.query(`
    SELECT observation.observed_property, count(*)::int AS observation_count
    FROM ldt_fiware.context_observations observation
    JOIN ldt_core.city_entities entity ON entity.id=observation.entity_id
    WHERE entity.city_id=$1
    GROUP BY observation.observed_property
  `, [cityId])

  const modelOutputs = await client.query(`
    SELECT output.model_key, output.output_key,
      count(*)::int AS total_count,
      count(*) FILTER (
        WHERE output.authority_status = ANY($2::text[])
          AND lower(COALESCE(output.confidence, '')) NOT LIKE '%smoke%'
          AND lower(COALESCE(output.confidence, '')) NOT LIKE '%synthetic%'
          AND lower(COALESCE(output.confidence, '')) NOT LIKE '%simulated%'
          AND lower(COALESCE(output.model_version, '')) NOT LIKE '%lab%'
          AND lower(COALESCE(output.model_version, '')) NOT LIKE '%smoke%'
      )::int AS validated_count
    FROM ldt_enrichment.entity_model_outputs output
    WHERE output.city_id=$1
    GROUP BY output.model_key, output.output_key
  `, [cityId, Array.from(APPROVED_AUTHORITIES)])

  const observations = await client.query(`
    WITH boundary AS (
      SELECT geom
      FROM ldt_core.city_boundaries
      WHERE city_id=$1
        AND lower(COALESCE(boundary_role, '')) NOT LIKE '%test%'
        AND lower(COALESCE(properties->>'source', '')) NOT LIKE '%smoke%'
      ORDER BY CASE boundary_role WHEN 'municipality' THEN 0 WHEN 'administrative' THEN 1 ELSE 2 END,
        created_at DESC
      LIMIT 1
    )
    SELECT observation.indicator_id, definition.indicator_key,
      count(*)::int AS total_count,
      count(*) FILTER (
        WHERE observation.validation_status='validated'
          AND observation.authority_status = ANY($2::text[])
      )::int AS validated_count,
      count(*) FILTER (WHERE observation.validation_status='candidate')::int AS candidate_count,
      count(*) FILTER (WHERE observation.validation_status IN ('lab','simulated'))::int AS lab_count,
      count(*) FILTER (
        WHERE observation.validation_status='validated'
          AND observation.authority_status = ANY($2::text[])
          AND observation.geography_entity_id IS NOT NULL
          AND entity.authority_status = ANY($2::text[])
          AND boundary.geom IS NOT NULL
          AND ST_CoveredBy(ST_PointOnSurface(entity.geom), boundary.geom)
      )::int AS validated_entity_count
    FROM ldt_science.indicator_observations observation
    JOIN ldt_science.indicator_definitions definition ON definition.id=observation.indicator_id
    LEFT JOIN ldt_core.city_entities entity ON entity.id=observation.geography_entity_id
    LEFT JOIN boundary ON true
    WHERE observation.city_id=$1
    GROUP BY observation.indicator_id, definition.indicator_key
  `, [cityId, Array.from(APPROVED_AUTHORITIES)])

  return {
    entities: Object.fromEntries(entities.rows.map((row) => [row.entity_type, row])),
    domains: Object.fromEntries(domains.rows.map((row) => [row.domain_key, row])),
    series: Object.fromEntries(series.rows.map((row) => [row.series_key, row])),
    phenomena: phenomena.rows,
    context: Object.fromEntries(context.rows.map((row) => [row.observed_property, row])),
    modelOutputs: Object.fromEntries(modelOutputs.rows.map((row) => [`${row.model_key}:${row.output_key}`, row])),
    observationsById: Object.fromEntries(observations.rows.map((row) => [row.indicator_id, row])),
    observationsByKey: Object.fromEntries(observations.rows.map((row) => [row.indicator_key, row])),
  }
}

function evidenceResult(requirement, state, count, detail, warning = '') {
  return {
    requirementKey: requirement.requirement_key,
    label: requirement.label,
    requirementType: requirement.requirement_type,
    sourceRef: requirement.source_ref,
    required: requirement.required,
    state,
    count: Number(count ?? 0),
    detail,
    ...(warning ? { warning } : {}),
  }
}

function evaluateRequirement(requirement, membership, snapshot) {
  const rule = object(requirement.rule)
  const minimum = Math.max(1, finite(rule.minimumCount, 1))
  if (['validated-observation', 'external-authority-value'].includes(requirement.requirement_type)) {
    const observation = snapshot.observationsById[membership.indicator_id] ?? {}
    const validated = Number(observation.validated_count ?? 0)
    const candidate = Number(observation.candidate_count ?? 0)
    if (validated >= minimum) return evidenceResult(requirement, 'passed', validated, `${validated} validated observations available.`)
    if (candidate > 0) return evidenceResult(requirement, 'candidate', candidate, `${candidate} candidate observations exist but are not validated.`)
    return evidenceResult(requirement, 'missing', 0, 'No validated observation or executable governed value exists.')
  }

  if (requirement.requirement_type === 'canonical-entity') {
    const entityTypes = array(rule.entityTypes, text(requirement.source_ref).split(',').filter(Boolean))
    const totals = entityTypes.reduce((sum, type) => {
      const row = snapshot.entities[type] ?? {}
      return {
        total: sum.total + Number(row.total_count ?? 0),
        inside: sum.inside + Number(row.inside_count ?? 0),
        approved: sum.approved + Number(row.approved_inside_count ?? 0),
      }
    }, { total: 0, inside: 0, approved: 0 })
    const requireAuthority = rule.requireAuthority !== false
    const usable = requireAuthority ? totals.approved : totals.inside
    if (usable >= minimum) return evidenceResult(requirement, 'passed', usable, `${usable} canonical entities pass territory and authority gates.`)
    if (totals.inside >= minimum || totals.total >= minimum) {
      return evidenceResult(requirement, 'candidate', totals.inside || totals.total, `${totals.total} canonical candidates exist; ${totals.inside} are inside the selected boundary and ${totals.approved} are authority-approved.`, totals.total > totals.inside ? `${totals.total - totals.inside} fall outside the selected boundary.` : '')
    }
    return evidenceResult(requirement, 'missing', 0, `No canonical ${entityTypes.join('/')} inventory exists.`)
  }

  if (requirement.requirement_type === 'domain-table') {
    const row = snapshot.domains[requirement.source_ref] ?? {}
    const total = Number(row.total_count ?? 0)
    const approved = Number(row.approved_count ?? 0)
    const usable = rule.requireAuthority === false ? total : approved
    if (usable >= minimum) return evidenceResult(requirement, 'passed', usable, `${usable} domain rows pass the configured gate.`)
    if (total >= minimum) return evidenceResult(requirement, 'candidate', total, `${total} domain rows exist but lack accepted authority.`)
    return evidenceResult(requirement, 'missing', 0, `The ${requirement.source_ref} domain is empty for this city.`)
  }

  if (requirement.requirement_type === 'observation-series') {
    const row = snapshot.series[text(requirement.source_ref).toLowerCase()] ?? {}
    const total = Number(row.observation_count ?? 0)
    const usable = Number(row.usable_count ?? 0)
    if (usable >= minimum) return evidenceResult(requirement, 'passed', usable, `${usable} usable series observations exist.`)
    if (total >= minimum) return evidenceResult(requirement, 'candidate', total, `${total} observations exist but fail quality gates.`)
    return evidenceResult(requirement, 'missing', 0, 'No matching society/statistical observation series exists.')
  }

  if (requirement.requirement_type === 'phenomenon-layer') {
    const family = text(rule.family ?? requirement.source_ref).toLowerCase()
    const matching = snapshot.phenomena.filter((row) => row.layer_key === requirement.source_ref || row.family === family)
    const count = matching.reduce((sum, row) => sum + Number(row.cell_count ?? 0), 0)
    const approved = matching.reduce((sum, row) => sum + (APPROVED_AUTHORITIES.has(row.authority_status) ? Number(row.cell_count ?? 0) : 0), 0)
    if ((rule.requireAuthority === false ? count : approved) >= minimum) return evidenceResult(requirement, 'passed', rule.requireAuthority === false ? count : approved, 'A matching phenomenon layer passes the configured gate.')
    if (count >= minimum) return evidenceResult(requirement, 'candidate', count, `${count} derived/open cells exist but no authority-backed layer passes.`)
    return evidenceResult(requirement, 'missing', 0, `No populated ${family || requirement.source_ref} phenomenon layer exists.`)
  }

  if (requirement.requirement_type === 'context-observation') {
    const row = snapshot.context[requirement.source_ref] ?? {}
    const count = Number(row.observation_count ?? 0)
    return count >= minimum
      ? evidenceResult(requirement, 'candidate', count, `${count} context observations exist; authority must still be reviewed.`)
      : evidenceResult(requirement, 'missing', 0, 'No matching context observations exist.')
  }

  if (requirement.requirement_type === 'model-output') {
    const modelKey = text(rule.modelKey)
    const outputKey = text(rule.outputKey)
    const row = snapshot.modelOutputs[`${modelKey}:${outputKey}`] ?? {}
    const total = Number(row.total_count ?? 0)
    const validated = Number(row.validated_count ?? 0)
    if (validated >= minimum) return evidenceResult(requirement, 'passed', validated, `${validated} authority-approved model outputs exist.`)
    if (total >= minimum) return evidenceResult(requirement, 'candidate', total, `${total} model outputs exist but are derived, synthetic, simulated, or unapproved.`)
    return evidenceResult(requirement, 'missing', 0, 'No matching model output exists.')
  }

  const confirmed = rule.confirmed === true
  return confirmed
    ? evidenceResult(requirement, 'passed', 1, 'Requirement was explicitly confirmed by an operator.')
    : evidenceResult(requirement, 'missing', 0, 'Manual evidence has not been confirmed.')
}

function validationSummary(results) {
  const counts = results.reduce((summary, result) => {
    summary[result.state] = (summary[result.state] ?? 0) + 1
    if (result.valueReady) summary.withValidatedValue += 1
    if (result.mapReady) summary.mapQueryable += 1
    return summary
  }, { ready: 0, partial: 0, blocked: 0, 'not-applicable': 0, withValidatedValue: 0, mapQueryable: 0 })
  const total = results.length
  return {
    total,
    ready: counts.ready,
    partial: counts.partial,
    blocked: counts.blocked,
    notApplicable: counts['not-applicable'],
    withValidatedValue: counts.withValidatedValue,
    mapQueryable: counts.mapQueryable,
    calculablePercent: total ? Number(((counts.ready / total) * 100).toFixed(1)) : 0,
  }
}

export async function validateIndicatorCatalog({ cityId, catalogKey, requestedBy } = {}) {
  const city = text(cityId)
  if (!city) throw new Error('CITY_ID_REQUIRED')
  const catalog = normalizedKey(catalogKey)
  return withClient(async (client) => {
    const catalogResult = await client.query('SELECT * FROM ldt_science.indicator_catalogs WHERE catalog_key=$1', [catalog])
    if (!catalogResult.rowCount) throw new Error('INDICATOR_CATALOG_NOT_FOUND')
    const catalogRowValue = catalogResult.rows[0]
    const run = await client.query(`
      INSERT INTO ldt_science.indicator_validation_runs (city_id, catalog_id, requested_by, status)
      VALUES ($1,$2,$3,'running') RETURNING *
    `, [city, catalogRowValue.id, text(requestedBy) || null])
    const runId = run.rows[0].id
    try {
      const [memberships, snapshot] = await Promise.all([
        client.query(`
          SELECT membership.*, definition.indicator_key, definition.name,
            definition.source_mode, definition.formula, definition.active,
            definition.metadata AS definition_metadata,
            COALESCE(jsonb_agg(requirement ORDER BY requirement.requirement_key)
              FILTER (WHERE requirement.id IS NOT NULL), '[]'::jsonb) AS requirements
          FROM ldt_science.indicator_catalog_memberships membership
          JOIN ldt_science.indicator_definitions definition ON definition.id=membership.indicator_id
          LEFT JOIN ldt_science.indicator_requirements requirement ON requirement.membership_id=membership.id
          WHERE membership.catalog_id=$1
          GROUP BY membership.id, definition.id
          ORDER BY membership.sort_order, membership.external_code
        `, [catalogRowValue.id]),
        validationSnapshot(client, city),
      ])
      const results = []
      for (const membership of memberships.rows) {
        const requirements = array(membership.requirements)
        const evidence = requirements.map((requirement) => evaluateRequirement(requirement, membership, snapshot))
        const observation = snapshot.observationsById[membership.indicator_id] ?? {}
        const validatedValueCount = Number(observation.validated_count ?? 0)
        const currentValueCount = Number(observation.total_count ?? 0)
        const valueReady = validatedValueCount > 0
        const sourceIndicatorKey = text(membership.formula?.sourceIndicatorKey ?? membership.formula?.source_indicator_key)
        const sourceObservation = sourceIndicatorKey ? snapshot.observationsByKey[sourceIndicatorKey] ?? {} : {}
        const calculationReady = ['autonomous', 'computed'].includes(membership.source_mode)
          && text(membership.formula?.operation)
          && Number(sourceObservation.validated_entity_count ?? 0) > 0
        const mapReady = Number(observation.validated_entity_count ?? 0) > 0
        const totalWeight = evidence.reduce((sum, item, index) => sum + Number(requirements[index]?.weight ?? 1), 0) || 1
        const achievedWeight = evidence.reduce((sum, item, index) => {
          const weight = Number(requirements[index]?.weight ?? 1)
          return sum + (item.state === 'passed' ? weight : item.state === 'candidate' ? weight * 0.5 : 0)
        }, 0)
        const readinessScore = Math.max(0, Math.min(1, achievedWeight / totalWeight))
        const missing = evidence.filter((item) => item.required && item.state !== 'passed')
        const warnings = [
          ...evidence.filter((item) => item.warning).map((item) => item.warning),
          ...(Number(observation.lab_count ?? 0) > 0 ? [`${observation.lab_count} lab/simulated observations excluded.`] : []),
        ]
        const applicable = membership.active !== false && membership.metadata?.applicable !== false
        const state = !applicable
          ? 'not-applicable'
          : valueReady || calculationReady
            ? 'ready'
            : evidence.some((item) => item.state === 'candidate' || item.state === 'passed') || Number(observation.candidate_count ?? 0) > 0
              ? 'partial'
              : 'blocked'
        const result = {
          membershipId: membership.id,
          indicatorId: membership.indicator_id,
          indicatorKey: membership.indicator_key,
          externalCode: membership.external_code,
          state,
          readinessScore: Number(readinessScore.toFixed(4)),
          valueReady,
          calculationReady: Boolean(calculationReady),
          mapReady,
          currentValueCount,
          validatedValueCount,
          evidence,
          missingRequirements: missing,
          warnings,
        }
        results.push(result)
        await client.query(`
          INSERT INTO ldt_science.indicator_validation_results (
            run_id, membership_id, indicator_id, state, readiness_score,
            value_ready, calculation_ready, map_ready, current_value_count,
            validated_value_count, evidence, missing_requirements, warnings
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb)
        `, [
          runId, result.membershipId, result.indicatorId, result.state, result.readinessScore,
          result.valueReady, result.calculationReady, result.mapReady, result.currentValueCount,
          result.validatedValueCount, JSON.stringify(result.evidence),
          JSON.stringify(result.missingRequirements), JSON.stringify(result.warnings),
        ])
      }
      const summary = validationSummary(results)
      await client.query(`
        UPDATE ldt_science.indicator_validation_runs
        SET status='completed', summary=$2::jsonb, finished_at=now()
        WHERE id=$1
      `, [runId, JSON.stringify(summary)])
      return { ok: true, cityId: city, catalog: catalogRow(catalogRowValue), runId, summary, results }
    } catch (error) {
      await client.query(`
        UPDATE ldt_science.indicator_validation_runs
        SET status='failed', summary=$2::jsonb, finished_at=now()
        WHERE id=$1
      `, [runId, JSON.stringify({ error: String(error?.message ?? error) })])
      throw error
    }
  })
}

function definitionPayload(row) {
  const validation = row.validation_result_id ? {
    runId: row.validation_run_id,
    state: row.validation_state,
    readinessScore: Number(row.readiness_score ?? 0),
    valueReady: row.value_ready,
    calculationReady: row.calculation_ready,
    mapReady: row.map_ready,
    currentValueCount: Number(row.validation_current_value_count ?? 0),
    validatedValueCount: Number(row.validation_validated_value_count ?? 0),
    evidence: row.validation_evidence ?? [],
    missingRequirements: row.missing_requirements ?? [],
    warnings: row.validation_warnings ?? [],
    validatedAt: row.validation_finished_at,
  } : null
  return {
    membershipId: row.membership_id,
    externalCode: row.external_code,
    indicatorId: row.indicator_id,
    indicatorKey: row.indicator_key,
    name: row.name,
    definition: row.definition,
    unit: row.unit,
    dimension: row.membership_dimension,
    subdimension: row.subdimension,
    level: row.level,
    indicatorType: row.indicator_type,
    kind: row.kind,
    scope: row.calculation_scope,
    sourceMode: row.source_mode,
    formula: row.formula ?? {},
    target: row.target ?? {},
    visualization: row.visualization ?? {},
    difficulty: row.definition_metadata?.difficulty ?? 'unclassified',
    implementationTier: row.definition_metadata?.implementationTier ?? 'unclassified',
    active: row.active,
    requirements: row.requirements ?? [],
    observation: row.current_observation_id ? {
      id: row.current_observation_id,
      value: row.current_value == null ? null : Number(row.current_value),
      unit: row.current_unit,
      observedAt: row.current_observed_at,
      validationStatus: row.current_validation_status,
      authorityStatus: row.current_authority_status,
      geographyLevel: row.current_geography_level,
    } : null,
    entityValueCount: Number(row.entity_value_count ?? 0),
    validation,
  }
}

export async function listIndicatorCatalogs({ cityId, catalogKey, includeDefinitions = true } = {}) {
  const city = text(cityId)
  if (!city) throw new Error('CITY_ID_REQUIRED')
  return withClient(async (client) => {
    const params = [city, Array.from(APPROVED_AUTHORITIES)]
    const filters = []
    if (text(catalogKey)) {
      params.push(normalizedKey(catalogKey))
      filters.push(`catalog.catalog_key=$${params.length}`)
    }
    const rows = await client.query(`
      WITH boundary AS (
        SELECT geom
        FROM ldt_core.city_boundaries
        WHERE city_id=$1
          AND lower(COALESCE(boundary_role, '')) NOT LIKE '%test%'
          AND lower(COALESCE(properties->>'source', '')) NOT LIKE '%smoke%'
        ORDER BY CASE boundary_role WHEN 'municipality' THEN 0 WHEN 'administrative' THEN 1 ELSE 2 END,
          created_at DESC
        LIMIT 1
      ), latest_runs AS (
        SELECT DISTINCT ON (run.catalog_id) run.*
        FROM ldt_science.indicator_validation_runs run
        WHERE run.city_id=$1 AND run.status='completed'
        ORDER BY run.catalog_id, run.finished_at DESC NULLS LAST, run.started_at DESC
      )
      SELECT catalog.*,
        membership.id AS membership_id,
        membership.external_code,
        membership.dimension AS membership_dimension,
        membership.subdimension,
        membership.level,
        membership.indicator_type,
        membership.sort_order,
        membership.metadata AS membership_metadata,
        definition.id AS indicator_id,
        definition.indicator_key,
        definition.name,
        definition.definition,
        definition.unit,
        definition.kind,
        definition.calculation_scope,
        definition.source_mode,
        definition.formula,
        definition.target,
        definition.visualization,
        definition.metadata AS definition_metadata,
        definition.active,
        COALESCE(requirements.requirements, '[]'::jsonb) AS requirements,
        current_observation.id AS current_observation_id,
        current_observation.value AS current_value,
        current_observation.unit AS current_unit,
        current_observation.observed_at AS current_observed_at,
        current_observation.validation_status AS current_validation_status,
        current_observation.authority_status AS current_authority_status,
        current_observation.geography_level AS current_geography_level,
        COALESCE(entity_values.entity_value_count, 0) AS entity_value_count,
        validation.id AS validation_result_id,
        validation.run_id AS validation_run_id,
        validation.state AS validation_state,
        validation.readiness_score,
        validation.value_ready,
        validation.calculation_ready,
        validation.map_ready,
        validation.current_value_count AS validation_current_value_count,
        validation.validated_value_count AS validation_validated_value_count,
        validation.evidence AS validation_evidence,
        validation.missing_requirements,
        validation.warnings AS validation_warnings,
        latest_run.finished_at AS validation_finished_at
      FROM ldt_science.indicator_catalogs catalog
      LEFT JOIN ldt_science.indicator_catalog_memberships membership ON membership.catalog_id=catalog.id
      LEFT JOIN ldt_science.indicator_definitions definition ON definition.id=membership.indicator_id
      LEFT JOIN latest_runs latest_run ON latest_run.catalog_id=catalog.id
      LEFT JOIN ldt_science.indicator_validation_results validation
        ON validation.run_id=latest_run.id AND validation.membership_id=membership.id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'requirementKey', requirement.requirement_key,
          'label', requirement.label,
          'requirementType', requirement.requirement_type,
          'sourceRef', requirement.source_ref,
          'required', requirement.required,
          'weight', requirement.weight,
          'rule', requirement.rule,
          'metadata', requirement.metadata
        ) ORDER BY requirement.requirement_key) AS requirements
        FROM ldt_science.indicator_requirements requirement
        WHERE requirement.membership_id=membership.id
      ) requirements ON true
      LEFT JOIN LATERAL (
        SELECT observation.*
        FROM ldt_science.indicator_observations observation
        WHERE observation.city_id=$1 AND observation.indicator_id=definition.id
        ORDER BY CASE
          WHEN observation.validation_status='validated' AND observation.authority_status = ANY($2::text[]) THEN 0
          WHEN observation.validation_status='candidate' THEN 1
          ELSE 2
        END,
          observation.observed_at DESC, observation.updated_at DESC
        LIMIT 1
      ) current_observation ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS entity_value_count
        FROM ldt_science.indicator_observations observation
        JOIN ldt_core.city_entities entity ON entity.id=observation.geography_entity_id
        JOIN boundary ON true
        WHERE observation.city_id=$1 AND observation.indicator_id=definition.id
          AND observation.geography_entity_id IS NOT NULL
          AND observation.validation_status='validated'
          AND observation.authority_status = ANY($2::text[])
          AND entity.city_id=$1
          AND entity.authority_status = ANY($2::text[])
          AND ST_CoveredBy(ST_PointOnSurface(entity.geom), boundary.geom)
      ) entity_values ON true
      ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
      ORDER BY catalog.title, membership.sort_order, membership.external_code
    `, params)
    const catalogs = new Map()
    for (const row of rows.rows) {
      const current = catalogs.get(row.catalog_key) ?? {
        ...catalogRow(row),
        definitions: [],
        validation: row.validation_run_id ? {
          runId: row.validation_run_id,
          validatedAt: row.validation_finished_at,
        } : null,
      }
      if (row.membership_id && includeDefinitions !== false) current.definitions.push(definitionPayload(row))
      catalogs.set(row.catalog_key, current)
    }
    const output = Array.from(catalogs.values()).map((catalog) => {
      const results = catalog.definitions.filter((definition) => definition.validation).map((definition) => ({
        state: definition.validation.state,
        valueReady: definition.validation.valueReady,
        mapReady: definition.validation.mapReady,
      }))
      return {
        ...catalog,
        indicatorCount: catalog.definitions.length,
        validation: catalog.validation ? { ...catalog.validation, ...validationSummary(results) } : null,
      }
    })
    const allDefinitions = output.flatMap((catalog) => catalog.definitions)
    const ready = allDefinitions.filter((definition) => definition.validation?.state === 'ready').length
    return {
      ok: true,
      cityId: city,
      summary: {
        catalogCount: output.length,
        indicatorCount: allDefinitions.length,
        ready,
        partial: allDefinitions.filter((definition) => definition.validation?.state === 'partial').length,
        blocked: allDefinitions.filter((definition) => definition.validation?.state === 'blocked').length,
        withValidatedValue: allDefinitions.filter((definition) => definition.validation?.valueReady).length,
        mapQueryable: allDefinitions.filter((definition) => definition.validation?.mapReady).length,
        calculablePercent: allDefinitions.length ? Number(((ready / allDefinitions.length) * 100).toFixed(1)) : 0,
      },
      catalogs: output,
    }
  })
}

export async function upsertIndicatorObservation(payload = {}) {
  const cityId = text(payload.cityId ?? payload.city_id)
  if (!cityId) throw new Error('CITY_ID_REQUIRED')
  const indicatorKey = normalizedKey(payload.indicatorKey ?? payload.indicator_key)
  const geographyLevel = text(payload.geographyLevel ?? payload.geography_level, payload.entityId ?? payload.entity_id ? 'entity' : 'city')
  if (!['city', 'entity', 'zone', 'selection'].includes(geographyLevel)) throw new Error('INDICATOR_GEOGRAPHY_LEVEL_INVALID')
  const validationStatus = text(payload.validationStatus ?? payload.validation_status, 'candidate')
  if (!VALIDATION_STATES.has(validationStatus)) throw new Error('INDICATOR_VALIDATION_STATUS_INVALID')
  const authorityStatus = text(payload.authorityStatus ?? payload.authority_status, 'unreviewed')
  if (validationStatus === 'validated' && !APPROVED_AUTHORITIES.has(authorityStatus)) {
    throw new Error('INDICATOR_VALIDATED_AUTHORITY_REQUIRED')
  }
  const value = finite(payload.value ?? payload.valueNumeric ?? payload.value_numeric)
  const valueJson = object(payload.valueJson ?? payload.value_json, value == null ? {} : { value })
  if (value == null && !Object.keys(valueJson).length) throw new Error('INDICATOR_OBSERVATION_VALUE_REQUIRED')
  return withClient(async (client) => {
    const definition = await client.query('SELECT * FROM ldt_science.indicator_definitions WHERE indicator_key=$1', [indicatorKey])
    if (!definition.rowCount) throw new Error('INDICATOR_NOT_FOUND')
    const entityId = text(payload.entityId ?? payload.entity_id) || null
    if (entityId) {
      const entity = await client.query('SELECT id FROM ldt_core.city_entities WHERE id=$1::uuid AND city_id=$2', [entityId, cityId])
      if (!entity.rowCount) throw new Error('INDICATOR_GEOGRAPHY_ENTITY_NOT_FOUND')
    }
    const observedAt = text(payload.observedAt ?? payload.observed_at) || new Date().toISOString()
    const geographyKey = entityId || text(payload.geographyKey ?? payload.geography_key, geographyLevel)
    const observationKey = text(payload.observationKey ?? payload.observation_key,
      `oldt-indicator:${cityId}:${indicatorKey}:${geographyLevel}:${geographyKey}:${observedAt}`)
    const result = await client.query(`
      INSERT INTO ldt_science.indicator_observations (
        city_id, indicator_id, geography_entity_id, observation_key, geography_level,
        observed_at, value, value_json, quality, unit, method, source_quality,
        authority_status, validation_status, period_start, period_end, source_ref,
        metadata, updated_at
      ) VALUES ($1,$2,$3::uuid,$4,$5,$6::timestamptz,$7,$8::jsonb,$9,$10,$11::jsonb,$12,$13,$14,$15::timestamptz,$16::timestamptz,$17,$18::jsonb,now())
      ON CONFLICT (observation_key) DO UPDATE SET
        geography_entity_id=EXCLUDED.geography_entity_id,
        geography_level=EXCLUDED.geography_level,
        observed_at=EXCLUDED.observed_at,
        value=EXCLUDED.value,
        value_json=EXCLUDED.value_json,
        quality=EXCLUDED.quality,
        unit=EXCLUDED.unit,
        method=EXCLUDED.method,
        source_quality=EXCLUDED.source_quality,
        authority_status=EXCLUDED.authority_status,
        validation_status=EXCLUDED.validation_status,
        period_start=EXCLUDED.period_start,
        period_end=EXCLUDED.period_end,
        source_ref=EXCLUDED.source_ref,
        metadata=EXCLUDED.metadata,
        updated_at=now()
      RETURNING *
    `, [
      cityId, definition.rows[0].id, entityId, observationKey, geographyLevel,
      observedAt, value, JSON.stringify(valueJson), text(payload.quality, validationStatus),
      text(payload.unit, definition.rows[0].unit) || null, JSON.stringify(object(payload.method)),
      text(payload.sourceQuality ?? payload.source_quality, validationStatus),
      authorityStatus, validationStatus,
      text(payload.periodStart ?? payload.period_start) || null,
      text(payload.periodEnd ?? payload.period_end) || null,
      text(payload.sourceRef ?? payload.source_ref) || null,
      JSON.stringify(object(payload.metadata)),
    ])
    return { ok: true, indicatorKey, observation: result.rows[0] }
  })
}

export async function upsertIndicatorThresholdProfile(payload = {}) {
  const cityId = text(payload.cityId ?? payload.city_id)
  if (!cityId) throw new Error('CITY_ID_REQUIRED')
  const indicatorKey = normalizedKey(payload.indicatorKey ?? payload.indicator_key)
  const profileKey = normalizedKey(payload.profileKey ?? payload.profile_key, payload.name)
  const operator = text(payload.operator, 'gte')
  if (!THRESHOLD_OPERATORS.has(operator)) throw new Error('INDICATOR_THRESHOLD_OPERATOR_INVALID')
  const thresholdValue = finite(payload.thresholdValue ?? payload.threshold_value)
  const thresholdHigh = finite(payload.thresholdHigh ?? payload.threshold_high)
  if (thresholdValue == null || (['between', 'outside'].includes(operator) && thresholdHigh == null)) {
    throw new Error('INDICATOR_THRESHOLD_VALUE_REQUIRED')
  }
  return withClient(async (client) => {
    const definition = await client.query('SELECT id, unit FROM ldt_science.indicator_definitions WHERE indicator_key=$1', [indicatorKey])
    if (!definition.rowCount) throw new Error('INDICATOR_NOT_FOUND')
    const result = await client.query(`
      INSERT INTO ldt_science.indicator_threshold_profiles (
        city_id, indicator_id, profile_key, name, operator, threshold_value,
        threshold_high, unit, severity, active, metadata, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,now())
      ON CONFLICT (city_id, indicator_id, profile_key) DO UPDATE SET
        name=EXCLUDED.name,
        operator=EXCLUDED.operator,
        threshold_value=EXCLUDED.threshold_value,
        threshold_high=EXCLUDED.threshold_high,
        unit=EXCLUDED.unit,
        severity=EXCLUDED.severity,
        active=EXCLUDED.active,
        metadata=EXCLUDED.metadata,
        updated_at=now()
      RETURNING *
    `, [
      cityId, definition.rows[0].id, profileKey, text(payload.name, profileKey), operator,
      thresholdValue, thresholdHigh, text(payload.unit, definition.rows[0].unit) || null,
      text(payload.severity, 'info'), payload.active !== false, JSON.stringify(object(payload.metadata)),
    ])
    return { ok: true, indicatorKey, profile: result.rows[0] }
  })
}

export async function listIndicatorThresholdProfiles({ cityId, indicatorKey } = {}) {
  const city = text(cityId)
  if (!city) throw new Error('CITY_ID_REQUIRED')
  const params = [city]
  const filters = ['profile.city_id=$1']
  if (text(indicatorKey)) {
    params.push(normalizedKey(indicatorKey))
    filters.push(`definition.indicator_key=$${params.length}`)
  }
  return withClient(async (client) => {
    const result = await client.query(`
      SELECT profile.*, definition.indicator_key, definition.name AS indicator_name
      FROM ldt_science.indicator_threshold_profiles profile
      JOIN ldt_science.indicator_definitions definition ON definition.id=profile.indicator_id
      WHERE ${filters.join(' AND ')}
      ORDER BY definition.name, profile.name
    `, params)
    return { ok: true, cityId: city, profiles: result.rows }
  })
}

function thresholdSql(operator, valueParameter, highParameter) {
  if (operator === 'gt') return `current.value > ${valueParameter}`
  if (operator === 'gte') return `current.value >= ${valueParameter}`
  if (operator === 'lt') return `current.value < ${valueParameter}`
  if (operator === 'lte') return `current.value <= ${valueParameter}`
  if (operator === 'eq') return `current.value = ${valueParameter}`
  if (operator === 'between') return `current.value BETWEEN ${valueParameter} AND ${highParameter}`
  if (operator === 'outside') return `(current.value < ${valueParameter} OR current.value > ${highParameter})`
  return 'true'
}

export async function queryIndicatorEntityValues({
  cityId,
  indicatorKey,
  comparison,
  value,
  high,
  thresholdProfileKey,
  includeCandidate = false,
  limit = 100,
} = {}) {
  const city = text(cityId)
  if (!city) throw new Error('CITY_ID_REQUIRED')
  const indicator = normalizedKey(indicatorKey)
  return withClient(async (client) => {
    const definition = await client.query('SELECT * FROM ldt_science.indicator_definitions WHERE indicator_key=$1', [indicator])
    if (!definition.rowCount) throw new Error('INDICATOR_NOT_FOUND')
    let operator = text(comparison)
    let thresholdValue = finite(value)
    let thresholdHigh = finite(high)
    let thresholdProfile = null
    if (text(thresholdProfileKey)) {
      const profile = await client.query(`
        SELECT * FROM ldt_science.indicator_threshold_profiles
        WHERE city_id=$1 AND indicator_id=$2 AND profile_key=$3 AND active=true
      `, [city, definition.rows[0].id, normalizedKey(thresholdProfileKey)])
      if (!profile.rowCount) throw new Error('INDICATOR_THRESHOLD_PROFILE_NOT_FOUND')
      thresholdProfile = profile.rows[0]
      operator = thresholdProfile.operator
      thresholdValue = finite(thresholdProfile.threshold_value)
      thresholdHigh = finite(thresholdProfile.threshold_high)
    }
    if (operator && !THRESHOLD_OPERATORS.has(operator)) throw new Error('INDICATOR_COMPARISON_INVALID')
    if (operator && thresholdValue == null) throw new Error('INDICATOR_THRESHOLD_VALUE_REQUIRED')
    if (['between', 'outside'].includes(operator) && thresholdHigh == null) throw new Error('INDICATOR_THRESHOLD_HIGH_REQUIRED')
    const params = [
      city,
      definition.rows[0].id,
      includeCandidate === true || includeCandidate === 'true',
      Array.from(APPROVED_AUTHORITIES),
    ]
    let predicate = 'true'
    if (operator) {
      params.push(thresholdValue)
      const valueParameter = `$${params.length}`
      let highParameter = 'NULL'
      if (['between', 'outside'].includes(operator)) {
        params.push(thresholdHigh)
        highParameter = `$${params.length}`
      }
      predicate = thresholdSql(operator, valueParameter, highParameter)
    }
    params.push(boundedInteger(limit, 100, 1, 1000))
    const result = await client.query(`
      WITH boundary AS (
        SELECT geom
        FROM ldt_core.city_boundaries
        WHERE city_id=$1
          AND lower(COALESCE(boundary_role, '')) NOT LIKE '%test%'
          AND lower(COALESCE(properties->>'source', '')) NOT LIKE '%smoke%'
        ORDER BY CASE boundary_role WHEN 'municipality' THEN 0 WHEN 'administrative' THEN 1 ELSE 2 END,
          created_at DESC
        LIMIT 1
      ), current AS (
        SELECT DISTINCT ON (observation.geography_entity_id)
          observation.*
        FROM ldt_science.indicator_observations observation
        WHERE observation.city_id=$1
          AND observation.indicator_id=$2
          AND observation.geography_entity_id IS NOT NULL
          AND observation.value IS NOT NULL
          AND (
            (observation.validation_status='validated' AND observation.authority_status = ANY($4::text[]))
            OR ($3::boolean AND observation.validation_status='candidate')
          )
        ORDER BY observation.geography_entity_id,
          observation.observed_at DESC, observation.updated_at DESC
      )
      SELECT current.id AS observation_id, current.value, current.unit,
        current.observed_at, current.quality, current.source_quality,
        current.validation_status, current.authority_status,
        entity.id AS entity_id, entity.stable_id, entity.entity_type,
        entity.label, entity.properties, ST_AsGeoJSON(entity.geom)::jsonb AS geometry
      FROM current
      JOIN ldt_core.city_entities entity ON entity.id=current.geography_entity_id
      JOIN boundary ON true
      WHERE ${predicate}
        AND entity.city_id=$1
        AND entity.authority_status = ANY($4::text[])
        AND ST_CoveredBy(ST_PointOnSurface(entity.geom), boundary.geom)
      ORDER BY current.value DESC NULLS LAST
      LIMIT $${params.length}
    `, params)
    return {
      ok: true,
      cityId: city,
      indicator: {
        indicatorKey: definition.rows[0].indicator_key,
        name: definition.rows[0].name,
        unit: definition.rows[0].unit,
      },
      threshold: operator ? {
        operator,
        value: thresholdValue,
        high: thresholdHigh,
        profileKey: thresholdProfile?.profile_key ?? null,
        name: thresholdProfile?.name ?? null,
      } : null,
      values: result.rows.map((row) => ({
        observationId: row.observation_id,
        entityId: row.entity_id,
        stableId: row.stable_id,
        entityType: row.entity_type,
        label: row.label,
        value: Number(row.value),
        unit: row.unit,
        validationStatus: row.validation_status,
        authorityStatus: row.authority_status,
        observedAt: row.observed_at,
        properties: row.properties,
        geometry: row.geometry,
      })),
    }
  })
}
