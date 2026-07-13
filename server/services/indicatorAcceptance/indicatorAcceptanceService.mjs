import { getProductionPool } from '../../db/postgisPool.mjs'
import { executeCityTwinQuery } from '../twinQuery/twinQueryUseCaseService.mjs'

const CATALOG_KEY = 'u4ssc'
const SUITE_KEY = 'u4ssc-indicator-query-acceptance-v1'
const VALIDATION_STATUSES = ['simulated']
const AUTHORITY_STATUSES = ['development-synthetic']
const ZONES = ['west', 'central', 'east']
const COMPOUND_CODES = ['EN:EN:AQ:1C', 'EN:EN:AQ:2C', 'EN:EN:EQ:2A']

function requirePool() {
  const pool = getProductionPool()
  if (!pool) throw new Error('DATABASE_URL_REQUIRED')
  return pool
}

function text(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function slug(value) {
  return text(value, 'general')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function sqlLiteral(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function subjectTypeFor(definition) {
  const subdimension = text(definition.subdimension).toLowerCase()
  if (subdimension === 'buildings') return ''
  if (['transport', 'urban planning'].includes(subdimension)) return 'mobility-analysis-area'
  if (['air quality', 'environmental quality', 'public space and nature', 'energy'].includes(subdimension)) {
    return 'environmental-analysis-area'
  }
  if (['water and sanitation', 'waste', 'drainage', 'electricity supply'].includes(subdimension)) {
    return 'utility-service-area'
  }
  if (['education', 'health', 'culture'].includes(subdimension)) return 'public-service-area'
  if (['employment', 'social inclusion', 'housing', 'food security'].includes(subdimension)) {
    return 'population-statistical-area'
  }
  if (subdimension === 'safety') return 'safety-analysis-area'
  return 'municipal-programme-area'
}

function patternFor(definition) {
  const unit = text(definition.unit).toLowerCase()
  if (text(definition.subdimension).toLowerCase() === 'buildings') return 'self-indicator'
  if (unit.includes('yes/no') || unit.includes('qualitative')) return 'city-context'
  if (definition.external_code === COMPOUND_CODES[0]) return 'compound'
  return 'related-subject'
}

function valueKindFor(unit) {
  const normalized = text(unit).toLowerCase()
  if (normalized.includes('yes/no')) return 'boolean'
  if (normalized.includes('qualitative')) return 'categorical'
  return 'numeric'
}

function numericBaseFor(definition, index) {
  const unit = text(definition.unit).toLowerCase()
  if (unit.includes('percentage')) return 42 + (index * 7) % 43
  if (unit.includes('ratio')) return Number((0.72 + (index % 8) * 0.08).toFixed(2))
  if (unit.includes('years')) return 70 + index % 9
  if (unit.includes('minutes')) return 8 + index % 24
  if (unit.includes('kwh')) return 900 + (index % 18) * 120
  if (unit.includes('gj')) return 9 + (index % 14) * 1.3
  if (unit.includes('µg') || unit.includes('ug')) return 12 + (index % 16) * 1.5
  if (unit.includes('tonnes')) return Number((1.8 + (index % 15) * 0.35).toFixed(2))
  if (unit.includes('l/day')) return 95 + (index % 15) * 8
  if (unit.includes('kilometres')) return 18 + (index % 20) * 2.5
  if (unit.includes('m²') || unit.includes('m2')) return 750 + (index % 20) * 125
  if (unit.includes('/100 000')) return 12 + (index % 24) * 3
  return 10 + (index % 25) * 4
}

function indicatorValues(definition, index) {
  const valueKind = valueKindFor(definition.unit)
  if (valueKind === 'boolean') {
    return {
      valueKind,
      city: { numeric: 1, boolean: true, text: null },
      zones: [
        { numeric: 0, boolean: false, text: null },
        { numeric: 1, boolean: true, text: null },
        { numeric: 1, boolean: true, text: null },
      ],
      comparison: { operator: 'eq', value: true },
    }
  }
  if (valueKind === 'categorical') {
    return {
      valueKind,
      city: { numeric: 3, boolean: null, text: 'advanced' },
      zones: [
        { numeric: 1, boolean: null, text: 'basic' },
        { numeric: 2, boolean: null, text: 'developing' },
        { numeric: 3, boolean: null, text: 'advanced' },
      ],
      comparison: { operator: 'eq', value: 'advanced' },
    }
  }
  const base = numericBaseFor(definition, index)
  const delta = Math.max(Math.abs(base) * 0.18, 1)
  return {
    valueKind,
    city: { numeric: base, boolean: null, text: null },
    zones: [-1, 0, 1].map((offset) => ({
      numeric: Number((base + delta * offset).toFixed(4)),
      boolean: null,
      text: null,
    })),
    comparison: { operator: 'gte', value: base },
  }
}

function indicatorNode(definition, values, subjectMode = 'self') {
  return {
    kind: 'indicator',
    indicatorKey: definition.indicator_key,
    subjectMode,
    valueKind: values.valueKind,
    operator: values.comparison.operator,
    value: values.comparison.value,
    validationStatuses: VALIDATION_STATUSES,
    authorityStatuses: AUTHORITY_STATUSES,
  }
}

function relatedIndicatorNode(definition, values) {
  const { subjectMode, ...node } = indicatorNode(definition, values)
  return node
}

function comparisonSql(alias, values) {
  if (values.valueKind === 'boolean') return `${alias}.boolean_value = ${values.comparison.value ? 'true' : 'false'}`
  if (values.valueKind === 'categorical') return `${alias}.value_text = ${sqlLiteral(values.comparison.value)}`
  return `${alias}.value >= ${Number(values.comparison.value)}`
}

function evidenceSql(alias) {
  return `${alias}.validation_status = ANY(ARRAY['simulated']::text[])
      AND ${alias}.authority_status = ANY(ARRAY['development-synthetic']::text[])
      AND ${alias}.scenario_key IS NULL`
}

function selfIndicatorSql(definition, values) {
  return `EXISTS (
    SELECT 1
    FROM ldt_query.indicator_subject_values indicator_value
    WHERE indicator_value.city_id = co.city_id
      AND indicator_value.physical_entity_id = co.id
      AND indicator_value.indicator_key = ${sqlLiteral(definition.indicator_key)}
      AND ${evidenceSql('indicator_value')}
      AND ${comparisonSql('indicator_value', values)}
  )`
}

function cityIndicatorSql(definition, values) {
  return `EXISTS (
    SELECT 1
    FROM ldt_query.indicator_subject_values indicator_value
    WHERE indicator_value.city_id = co.city_id
      AND indicator_value.subject_kind = 'city'
      AND indicator_value.indicator_key = ${sqlLiteral(definition.indicator_key)}
      AND ${evidenceSql('indicator_value')}
      AND ${comparisonSql('indicator_value', values)}
  )`
}

function relatedIndicatorSql(subjectType, entries) {
  const indicators = entries.map(({ definition, values }, index) => `EXISTS (
        SELECT 1
        FROM ldt_query.indicator_subject_values related_value_${index + 1}
        WHERE related_value_${index + 1}.city_id = co.city_id
          AND related_value_${index + 1}.context_subject_id = related_subject.context_subject_id
          AND related_value_${index + 1}.indicator_key = ${sqlLiteral(definition.indicator_key)}
          AND ${evidenceSql(`related_value_${index + 1}`)}
          AND ${comparisonSql(`related_value_${index + 1}`, values)}
      )`).join('\n      AND ')
  return `EXISTS (
    SELECT 1
    FROM ldt_query.subjects related_subject
    WHERE related_subject.city_id = co.city_id
      AND related_subject.subject_kind = 'context'
      AND related_subject.subject_type = ${sqlLiteral(subjectType)}
      AND related_subject.privacy_class IN ('public', 'aggregate')
      AND related_subject.geom IS NOT NULL
      AND co.geom && related_subject.geom
      AND ST_Intersects(ST_PointOnSurface(co.geom), related_subject.geom)
      AND ${indicators}
  )`
}

function basePropertyNodes() {
  return [
    { field: 'floors', operator: 'gte', value: 3 },
    { field: 'footprint_area_m2', operator: 'between', value: [150, 1000] },
  ]
}

function baseBuilderPredicates() {
  return [
    { id: 'floors', kind: 'property', field: 'floors', operator: 'gte', value: 3, valueMax: '' },
    { id: 'area', kind: 'property', field: 'footprint_area_m2', operator: 'between', value: 150, valueMax: 1000 },
  ]
}

function caseFor(definition, valuesByKey, definitionByCode) {
  const values = valuesByKey.get(definition.indicator_key)
  const pattern = patternFor(definition)
  const subjectType = subjectTypeFor(definition)
  let semanticNode
  let builderCondition
  let semanticSql
  let queryPattern = pattern
  if (pattern === 'self-indicator') {
    semanticNode = indicatorNode(definition, values, 'self')
    builderCondition = { id: 'indicator', ...semanticNode }
    semanticSql = selfIndicatorSql(definition, values)
  } else if (pattern === 'city-context') {
    semanticNode = indicatorNode(definition, values, 'city')
    builderCondition = { id: 'city-indicator', ...semanticNode }
    semanticSql = cityIndicatorSql(definition, values)
  } else {
    const relatedDefinitions = pattern === 'compound'
      ? COMPOUND_CODES.map((code) => definitionByCode.get(code)).filter(Boolean)
      : [definition]
    const entries = relatedDefinitions.map((entry) => ({
      definition: entry,
      values: valuesByKey.get(entry.indicator_key),
    }))
    const indicators = entries.map(({ definition: entry, values: entryValues }, index) => ({
      id: `area-indicator-${index + 1}`,
      ...relatedIndicatorNode(entry, entryValues),
    }))
    semanticNode = {
      kind: 'related-subject',
      subjectTypes: [subjectType],
      relationMode: 'spatial',
      privacyClasses: ['public', 'aggregate'],
      indicatorMode: 'and',
      indicators: indicators.map(({ id, ...entry }) => entry),
    }
    builderCondition = { id: 'related-area', ...semanticNode, indicators }
    semanticSql = relatedIndicatorSql(subjectType, entries)
    if (entries.length > 1) queryPattern = 'compound'
  }

  const twinQuery = {
    language: 'twinql-json',
    classes: ['buildings'],
    scope: { key: 'city' },
    where: { op: 'and', args: [...basePropertyNodes(), semanticNode] },
    render: { mode: 'isolate', maxFeatures: 100 },
    surface: 'api',
    intent: 'analysis',
    metadata: {
      source: SUITE_KEY,
      indicatorKey: definition.indicator_key,
      externalCode: definition.external_code,
      syntheticDevelopmentData: true,
    },
  }
  const sqlText = `SELECT co.*
FROM ldt_query.city_objects_enriched co
WHERE co.city_id = ${sqlLiteral(definition.city_id)}
  AND co.semantic_class = 'buildings'
  AND ST_Intersects(
    co.geom,
    (
      SELECT boundary.geom
      FROM ldt_core.city_boundaries boundary
      WHERE boundary.city_id = co.city_id
        AND lower(COALESCE(boundary.boundary_role, '')) NOT LIKE '%test%'
        AND lower(COALESCE(boundary.properties->>'source', '')) NOT LIKE '%smoke%'
      ORDER BY CASE boundary.boundary_role WHEN 'municipality' THEN 0 WHEN 'administrative' THEN 1 ELSE 2 END,
        boundary.created_at DESC
      LIMIT 1
    )
  )
  AND co.floors >= 3
  AND co.footprint_area_m2 BETWEEN 150 AND 1000
  AND ${semanticSql}
ORDER BY co.object_id`
  const builder = {
    mode: 'builder',
    operation: 'union',
    sqlText,
    clauses: [{
      id: 'clause-1',
      label: definition.name,
      classKey: 'buildings',
      scopeKey: 'radius',
      radiusPercent: 100,
      radiusMeters: '',
      predicateMode: 'and',
      predicates: [...baseBuilderPredicates(), builderCondition],
    }],
    renderMode: 'isolate',
  }
  return {
    caseKey: `u4ssc-acceptance-${slug(definition.external_code)}`,
    title: `[U4SSC] ${definition.external_code} - ${definition.name}`,
    useCase: queryPattern === 'self-indicator'
      ? `Find 3+ floor buildings between 150 and 1,000 m2 whose own ${definition.name} value passes the development threshold.`
      : queryPattern === 'city-context'
        ? `Find 3+ floor buildings between 150 and 1,000 m2 while the city-wide ${definition.name} condition is active.`
        : queryPattern === 'compound'
          ? 'Find 3+ floor buildings between 150 and 1,000 m2 inside environmental areas where air pollution, GHG emissions, and noise exposure all pass their thresholds.'
          : `Find 3+ floor buildings between 150 and 1,000 m2 inside a ${subjectType} where ${definition.name} passes the development threshold.`,
    queryPattern,
    subjectType,
    builder,
    twinQuery,
    sqlText,
  }
}

async function catalogDefinitions(client, cityId) {
  const result = await client.query(`
    SELECT
      $1::text AS city_id,
      catalog.id AS catalog_id,
      definition.id AS indicator_id,
      definition.indicator_key,
      definition.name,
      definition.unit,
      definition.dimension,
      definition.metadata,
      membership.external_code,
      membership.subdimension,
      membership.indicator_type,
      membership.sort_order
    FROM ldt_science.indicator_catalogs catalog
    JOIN ldt_science.indicator_catalog_memberships membership ON membership.catalog_id=catalog.id
    JOIN ldt_science.indicator_definitions definition ON definition.id=membership.indicator_id
    WHERE catalog.catalog_key=$2 AND definition.active IS DISTINCT FROM false
    ORDER BY membership.sort_order, membership.external_code
  `, [cityId, CATALOG_KEY])
  if (result.rowCount !== 91) throw new Error(`U4SSC_CATALOG_COUNT_INVALID:${result.rowCount}`)
  return result.rows
}

async function cleanDevelopmentFixtures(client, cityId, catalogId) {
  await client.query(`DELETE FROM ldt_analysis.indicator_acceptance_cases WHERE city_id=$1 AND catalog_id=$2`, [cityId, catalogId])
  await client.query(`DELETE FROM ldt_science.indicator_observations WHERE city_id=$1 AND observation_key LIKE 'dev-u4ssc-acceptance:%'`, [cityId])
  await client.query(`DELETE FROM ldt_context.context_subjects WHERE city_id=$1 AND subject_key LIKE 'dev:u4ssc:%'`, [cityId])
  await client.query(`DELETE FROM ldt_core.city_entities WHERE city_id=$1 AND stable_id LIKE 'dev:u4ssc:building:%'`, [cityId])
}

async function insertSubjectAreas(client, cityId, subjectTypes) {
  for (const subjectType of subjectTypes) {
    await client.query(`
      WITH boundary AS (
        SELECT ST_MakeValid(geom) AS geom
        FROM ldt_core.city_boundaries
        WHERE city_id=$1
          AND lower(COALESCE(boundary_role, '')) NOT LIKE '%test%'
          AND lower(COALESCE(properties->>'source', '')) NOT LIKE '%smoke%'
        ORDER BY CASE boundary_role WHEN 'municipality' THEN 0 WHEN 'administrative' THEN 1 ELSE 2 END,
          created_at DESC
        LIMIT 1
      ), extent AS (
        SELECT geom, ST_XMin(ST_Envelope(geom)) AS min_x, ST_XMax(ST_Envelope(geom)) AS max_x,
          ST_YMin(ST_Envelope(geom)) AS min_y, ST_YMax(ST_Envelope(geom)) AS max_y
        FROM boundary
      ), zones(zone_index, zone_key) AS (
        VALUES (0, 'west'), (1, 'central'), (2, 'east')
      ), geometries AS (
        SELECT zone_index, zone_key,
          ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Intersection(
            extent.geom,
            ST_MakeEnvelope(
              extent.min_x + (extent.max_x - extent.min_x) * zone_index / 3.0,
              extent.min_y,
              extent.min_x + (extent.max_x - extent.min_x) * (zone_index + 1) / 3.0,
              extent.max_y,
              4326
            )
          )), 3)) AS geom
        FROM extent CROSS JOIN zones
      )
      INSERT INTO ldt_context.context_subjects (
        city_id, subject_key, subject_type, domain_type, label,
        authority_status, privacy_class, lifecycle_status, geom,
        attributes, provenance, updated_at
      )
      SELECT $1,
        'dev:u4ssc:' || $2 || ':' || zone_key,
        $3,
        'development-acceptance',
        'U4SSC development ' || $3 || ' - ' || zone_key,
        'development-synthetic',
        'aggregate',
        'active',
        geom,
        jsonb_build_object(
          'testSuite', $4::text,
          'developmentSynthetic', true,
          'zoneIndex', zone_index,
          'zoneKey', zone_key
        ),
        jsonb_build_object(
          'source', 'derived-from-guanajuato-municipal-boundary',
          'purpose', 'query-acceptance-only'
        ),
        now()
      FROM geometries
      WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
      ON CONFLICT (city_id, subject_key) DO UPDATE SET
        subject_type=EXCLUDED.subject_type,
        label=EXCLUDED.label,
        authority_status=EXCLUDED.authority_status,
        geom=EXCLUDED.geom,
        attributes=EXCLUDED.attributes,
        provenance=EXCLUDED.provenance,
        updated_at=now()
    `, [cityId, slug(subjectType), subjectType, SUITE_KEY])
  }
}

async function insertDevelopmentBuildings(client, cityId, anchorSubjectType) {
  const inserted = await client.query(`
    WITH zones AS (
      SELECT id, subject_key, attributes->>'zoneKey' AS zone_key, geom
      FROM ldt_context.context_subjects
      WHERE city_id=$1 AND subject_type=$2 AND attributes->>'testSuite'=$3
    ), candidates AS (
      SELECT zones.zone_key, source.geom,
        ST_Area(source.geom::geography) AS area_m2,
        row_number() OVER (PARTITION BY zones.zone_key ORDER BY md5(source.stable_id)) AS zone_rank
      FROM zones
      JOIN ldt_core.city_entities source
        ON source.city_id=$1
       AND source.entity_type='building'
       AND source.stable_id NOT LIKE 'dev:u4ssc:%'
       AND source.geom IS NOT NULL
       AND ST_CoveredBy(ST_PointOnSurface(source.geom), zones.geom)
      WHERE ST_Area(source.geom::geography) BETWEEN 180 AND 850
    ), chosen AS (
      SELECT * FROM candidates WHERE zone_rank <= 4
    )
    INSERT INTO ldt_core.city_entities (
      city_id, stable_id, entity_type, label, authority_status,
      confidence, lifecycle_status, geom, properties, updated_at
    )
    SELECT $1,
      'dev:u4ssc:building:' || zone_key || ':' || lpad(zone_rank::text, 2, '0'),
      'building',
      'U4SSC development building ' || zone_key || ' ' || zone_rank,
      'development-synthetic',
      'synthetic-development',
      'active',
      geom,
      jsonb_build_object(
        'testSuite', $3,
        'developmentSynthetic', true,
        'zoneKey', zone_key,
        'sourceGeometry', 'copied-open-building-footprint'
      ),
      now()
    FROM chosen
    ON CONFLICT (city_id, stable_id) DO UPDATE SET
      label=EXCLUDED.label,
      authority_status=EXCLUDED.authority_status,
      confidence=EXCLUDED.confidence,
      lifecycle_status='active',
      geom=EXCLUDED.geom,
      properties=EXCLUDED.properties,
      updated_at=now()
    RETURNING id, stable_id
  `, [cityId, anchorSubjectType, SUITE_KEY])
  if (inserted.rowCount !== 12) throw new Error(`U4SSC_DEVELOPMENT_BUILDING_COUNT_INVALID:${inserted.rowCount}`)

  await client.query(`
    INSERT INTO ldt_core.building_entities (
      entity_id, building_type, use_class, levels, height_m,
      footprint_area_m2, source_coverage_status, bim_status
    )
    SELECT entity.id,
      'development-acceptance',
      'mixed-development-fixture',
      2 + (row_number() OVER (ORDER BY entity.stable_id) % 6),
      7.5 + (row_number() OVER (ORDER BY entity.stable_id) % 6) * 3.1,
      ST_Area(entity.geom::geography),
      'development-synthetic',
      'none'
    FROM ldt_core.city_entities entity
    WHERE entity.city_id=$1 AND entity.stable_id LIKE 'dev:u4ssc:building:%'
    ON CONFLICT (entity_id) DO UPDATE SET
      building_type=EXCLUDED.building_type,
      use_class=EXCLUDED.use_class,
      levels=EXCLUDED.levels,
      height_m=EXCLUDED.height_m,
      footprint_area_m2=EXCLUDED.footprint_area_m2,
      source_coverage_status=EXCLUDED.source_coverage_status
  `, [cityId])

  await client.query(`
    INSERT INTO ldt_context.subject_relations (
      city_id, relation_key, relation_type, source_entity_id,
      target_subject_id, authority_status, properties, updated_at
    )
    SELECT $1,
      'dev:u4ssc:located-in:' || entity.stable_id || ':' || subject.subject_key,
      'located-in',
      entity.id,
      subject.id,
      'development-synthetic',
      jsonb_build_object('testSuite', $2, 'developmentSynthetic', true),
      now()
    FROM ldt_core.city_entities entity
    JOIN ldt_context.context_subjects subject
      ON subject.city_id=entity.city_id
     AND subject.attributes->>'testSuite'=$2
     AND ST_CoveredBy(ST_PointOnSurface(entity.geom), subject.geom)
    WHERE entity.city_id=$1 AND entity.stable_id LIKE 'dev:u4ssc:building:%'
    ON CONFLICT (city_id, relation_key) DO UPDATE SET
      relation_type=EXCLUDED.relation_type,
      source_entity_id=EXCLUDED.source_entity_id,
      target_subject_id=EXCLUDED.target_subject_id,
      authority_status=EXCLUDED.authority_status,
      properties=EXCLUDED.properties,
      updated_at=now()
  `, [cityId, SUITE_KEY])
}

async function upsertObservation(client, payload) {
  await client.query(`
    INSERT INTO ldt_science.indicator_observations (
      city_id, indicator_id, geography_entity_id, context_subject_id,
      observation_key, geography_level, observed_at, period_start, period_end,
      value_kind, value, value_text, boolean_value, numerator, denominator,
      value_json, unit, quality, validation_status, authority_status,
      source_ref, source_quality, method, metadata, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,now(),date_trunc('year', now()),date_trunc('year', now()) + interval '1 year' - interval '1 second',
      $7,$8,$9,$10,$11,$12,$13::jsonb,$14,'synthetic-development','simulated','development-synthetic',
      $15,'synthetic-development',$16::jsonb,$17::jsonb,now()
    )
    ON CONFLICT (observation_key) DO UPDATE SET
      geography_entity_id=EXCLUDED.geography_entity_id,
      context_subject_id=EXCLUDED.context_subject_id,
      geography_level=EXCLUDED.geography_level,
      observed_at=EXCLUDED.observed_at,
      period_start=EXCLUDED.period_start,
      period_end=EXCLUDED.period_end,
      value_kind=EXCLUDED.value_kind,
      value=EXCLUDED.value,
      value_text=EXCLUDED.value_text,
      boolean_value=EXCLUDED.boolean_value,
      numerator=EXCLUDED.numerator,
      denominator=EXCLUDED.denominator,
      value_json=EXCLUDED.value_json,
      unit=EXCLUDED.unit,
      quality=EXCLUDED.quality,
      validation_status=EXCLUDED.validation_status,
      authority_status=EXCLUDED.authority_status,
      source_ref=EXCLUDED.source_ref,
      source_quality=EXCLUDED.source_quality,
      method=EXCLUDED.method,
      metadata=EXCLUDED.metadata,
      updated_at=now()
  `, [
    payload.cityId,
    payload.indicatorId,
    payload.entityId || null,
    payload.contextSubjectId || null,
    payload.observationKey,
    payload.geographyLevel,
    payload.valueKind,
    payload.numeric,
    payload.text,
    payload.boolean,
    payload.numerator,
    payload.denominator,
    JSON.stringify(payload.valueJson ?? {}),
    payload.unit || null,
    payload.sourceRef,
    JSON.stringify({
      calculation: 'deterministic-development-fixture',
      standardValueIsNotOfficial: true,
    }),
    JSON.stringify({
      testSuite: SUITE_KEY,
      developmentSynthetic: true,
      standardValueIsNotOfficial: true,
      externalCode: payload.externalCode,
    }),
  ])
}

async function insertIndicatorObservations(client, cityId, definitions, valuesByKey) {
  const buildings = (await client.query(`
    SELECT id, stable_id, properties->>'zoneKey' AS zone_key,
      row_number() OVER (ORDER BY stable_id)::int AS fixture_index
    FROM ldt_core.city_entities
    WHERE city_id=$1 AND stable_id LIKE 'dev:u4ssc:building:%'
    ORDER BY stable_id
  `, [cityId])).rows
  const subjects = (await client.query(`
    SELECT id, subject_key, subject_type, (attributes->>'zoneIndex')::int AS zone_index
    FROM ldt_context.context_subjects
    WHERE city_id=$1 AND attributes->>'testSuite'=$2
    ORDER BY subject_type, zone_index
  `, [cityId, SUITE_KEY])).rows

  for (const definition of definitions) {
    const values = valuesByKey.get(definition.indicator_key)
    await upsertObservation(client, {
      cityId,
      indicatorId: definition.indicator_id,
      observationKey: `dev-u4ssc-acceptance:city:${definition.indicator_key}`,
      geographyLevel: 'city',
      valueKind: values.valueKind,
      ...values.city,
      numerator: values.valueKind === 'numeric' ? values.city.numeric * 100 : null,
      denominator: values.valueKind === 'numeric' ? 100 : null,
      valueJson: { value: values.city.numeric, text: values.city.text, boolean: values.city.boolean },
      unit: definition.unit,
      sourceRef: `development-acceptance:${definition.external_code}:city`,
      externalCode: definition.external_code,
    })

    if (patternFor(definition) === 'self-indicator') {
      for (const building of buildings) {
        const source = values.zones[(building.fixture_index - 1) % values.zones.length]
        await upsertObservation(client, {
          cityId,
          indicatorId: definition.indicator_id,
          entityId: building.id,
          observationKey: `dev-u4ssc-acceptance:physical:${definition.indicator_key}:${building.stable_id}`,
          geographyLevel: 'building',
          valueKind: values.valueKind,
          ...source,
          numerator: values.valueKind === 'numeric' ? source.numeric * 100 : null,
          denominator: values.valueKind === 'numeric' ? 100 : null,
          valueJson: { value: source.numeric, text: source.text, boolean: source.boolean },
          unit: definition.unit,
          sourceRef: `development-acceptance:${definition.external_code}:building`,
          externalCode: definition.external_code,
        })
      }
      continue
    }

    const subjectType = subjectTypeFor(definition)
    for (const subject of subjects.filter((entry) => entry.subject_type === subjectType)) {
      const source = values.zones[subject.zone_index]
      await upsertObservation(client, {
        cityId,
        indicatorId: definition.indicator_id,
        contextSubjectId: subject.id,
        observationKey: `dev-u4ssc-acceptance:context:${definition.indicator_key}:${subject.subject_key}`,
        geographyLevel: subjectType,
        valueKind: values.valueKind,
        ...source,
        numerator: values.valueKind === 'numeric' ? source.numeric * 100 : null,
        denominator: values.valueKind === 'numeric' ? 100 : null,
        valueJson: { value: source.numeric, text: source.text, boolean: source.boolean },
        unit: definition.unit,
        sourceRef: `development-acceptance:${definition.external_code}:${subjectType}`,
        externalCode: definition.external_code,
      })
    }
  }
}

function resultObjectIds(result) {
  return (result?.geojson?.features ?? [])
    .map((feature) => String(feature?.properties?.objectId ?? feature?.properties?.stableId ?? feature?.id ?? '').trim())
    .filter(Boolean)
    .sort()
}

export async function prepareU4sscAcceptanceData({ cityId = 'guanajuato' } = {}) {
  const pool = requirePool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const definitions = await catalogDefinitions(client, cityId)
    const catalogId = definitions[0].catalog_id
    await cleanDevelopmentFixtures(client, cityId, catalogId)
    const subjectTypes = unique(definitions.map(subjectTypeFor))
    await insertSubjectAreas(client, cityId, subjectTypes)
    await insertDevelopmentBuildings(client, cityId, subjectTypes[0])
    const valuesByKey = new Map(definitions.map((definition, index) => [
      definition.indicator_key,
      indicatorValues(definition, index),
    ]))
    await insertIndicatorObservations(client, cityId, definitions, valuesByKey)
    await client.query('COMMIT')
    return {
      ok: true,
      cityId,
      catalogKey: CATALOG_KEY,
      indicatorCount: definitions.length,
      subjectTypeCount: subjectTypes.length,
      subjectCount: subjectTypes.length * ZONES.length,
      buildingCount: 12,
      observationCount: Number((await pool.query(`
        SELECT count(*)::int AS count
        FROM ldt_science.indicator_observations
        WHERE city_id=$1 AND observation_key LIKE 'dev-u4ssc-acceptance:%'
      `, [cityId])).rows[0]?.count ?? 0),
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function runU4sscLocalAcceptance({ cityId = 'guanajuato' } = {}) {
  const pool = requirePool()
  const definitions = await catalogDefinitions(pool, cityId)
  const definitionByCode = new Map(definitions.map((entry) => [entry.external_code, entry]))
  const valuesByKey = new Map(definitions.map((definition, index) => [
    definition.indicator_key,
    indicatorValues(definition, index),
  ]))
  const cases = []
  for (const definition of definitions) {
    const acceptance = caseFor(definition, valuesByKey, definitionByCode)
    const startedAt = new Date()
    const builderResult = await executeCityTwinQuery(cityId, {
      ...acceptance.twinQuery,
      actorUserId: 'u4ssc-indicator-query-acceptance',
    })
    const sqlResult = await executeCityTwinQuery(cityId, {
      language: 'postgis-sql',
      sqlText: acceptance.sqlText,
      render: { mode: 'isolate', maxFeatures: 100 },
      surface: 'api',
      intent: 'analysis',
      actorUserId: 'u4ssc-indicator-query-acceptance',
      metadata: acceptance.twinQuery.metadata,
    })
    const builderIds = resultObjectIds(builderResult)
    const sqlIds = resultObjectIds(sqlResult)
    const builderCount = Number(builderResult?.summary?.resultCount ?? -1)
    const sqlCount = Number(sqlResult?.summary?.resultCount ?? -1)
    const passed = Boolean(
      builderResult?.ok &&
      sqlResult?.ok &&
      builderCount > 0 &&
      builderCount === sqlCount &&
      JSON.stringify(builderIds) === JSON.stringify(sqlIds),
    )
    const evidence = {
      suite: SUITE_KEY,
      syntheticDevelopmentData: true,
      standardValueIsNotOfficial: true,
      builder: {
        ok: Boolean(builderResult?.ok),
        resultCount: builderCount,
        returned: Number(builderResult?.summary?.returned ?? 0),
        queryHash: builderResult?.summary?.queryHash ?? null,
        error: builderResult?.error ?? null,
      },
      sql: {
        ok: Boolean(sqlResult?.ok),
        resultCount: sqlCount,
        returned: Number(sqlResult?.summary?.returned ?? 0),
        queryHash: sqlResult?.summary?.queryHash ?? null,
        error: sqlResult?.error ?? null,
      },
      equivalentObjectIds: JSON.stringify(builderIds) === JSON.stringify(sqlIds),
      durationMs: Date.now() - startedAt.getTime(),
    }
    await pool.query(`
      INSERT INTO ldt_analysis.indicator_acceptance_cases (
        city_id, catalog_id, indicator_id, case_key, title, use_case,
        query_pattern, base_semantic_class, builder, twin_query, sql_text,
        expected_result_count, builder_result_count, sql_result_count,
        matched_object_ids, local_status, evidence, last_run_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,'buildings',$8::jsonb,$9::jsonb,$10,
        $11,$12,$13,$14::text[],$15,$16::jsonb,now(),now()
      )
      ON CONFLICT (city_id, catalog_id, case_key) DO UPDATE SET
        indicator_id=EXCLUDED.indicator_id,
        title=EXCLUDED.title,
        use_case=EXCLUDED.use_case,
        query_pattern=EXCLUDED.query_pattern,
        builder=EXCLUDED.builder,
        twin_query=EXCLUDED.twin_query,
        sql_text=EXCLUDED.sql_text,
        expected_result_count=EXCLUDED.expected_result_count,
        builder_result_count=EXCLUDED.builder_result_count,
        sql_result_count=EXCLUDED.sql_result_count,
        matched_object_ids=EXCLUDED.matched_object_ids,
        local_status=EXCLUDED.local_status,
        evidence=EXCLUDED.evidence,
        last_run_at=now(),
        updated_at=now()
    `, [
      cityId,
      definition.catalog_id,
      definition.indicator_id,
      acceptance.caseKey,
      acceptance.title,
      acceptance.useCase,
      acceptance.queryPattern,
      JSON.stringify(acceptance.builder),
      JSON.stringify(acceptance.twinQuery),
      acceptance.sqlText,
      builderCount,
      builderCount,
      sqlCount,
      builderIds,
      passed ? 'passed' : 'failed',
      JSON.stringify(evidence),
    ])
    cases.push({
      caseKey: acceptance.caseKey,
      indicatorKey: definition.indicator_key,
      externalCode: definition.external_code,
      pattern: acceptance.queryPattern,
      builderCount,
      sqlCount,
      passed,
    })
  }
  const failed = cases.filter((entry) => !entry.passed)
  return {
    ok: failed.length === 0 && cases.length === 91,
    cityId,
    catalogKey: CATALOG_KEY,
    total: cases.length,
    passed: cases.length - failed.length,
    failed: failed.length,
    failures: failed,
    patterns: cases.reduce((counts, entry) => {
      counts[entry.pattern] = Number(counts[entry.pattern] ?? 0) + 1
      return counts
    }, {}),
  }
}

export async function indicatorAcceptanceSummary({ cityId = 'guanajuato' } = {}) {
  const result = await requirePool().query(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE local_status='passed')::int AS local_passed,
      count(*) FILTER (WHERE data_platform_status='passed')::int AS data_platform_passed,
      count(*) FILTER (WHERE cip_status='passed')::int AS cip_passed,
      count(*) FILTER (WHERE roundtrip_status='passed')::int AS roundtrip_passed,
      count(DISTINCT indicator_id)::int AS indicators,
      max(last_run_at) AS last_run_at
    FROM ldt_analysis.indicator_acceptance_cases acceptance
    JOIN ldt_science.indicator_catalogs catalog ON catalog.id=acceptance.catalog_id
    WHERE acceptance.city_id=$1 AND catalog.catalog_key=$2
  `, [cityId, CATALOG_KEY])
  const row = result.rows[0]
  return {
    total: Number(row.total ?? 0),
    indicators: Number(row.indicators ?? 0),
    localPassed: Number(row.local_passed ?? 0),
    dataPlatformPassed: Number(row.data_platform_passed ?? 0),
    cipPassed: Number(row.cip_passed ?? 0),
    roundtripPassed: Number(row.roundtrip_passed ?? 0),
    lastRunAt: row.last_run_at ?? null,
  }
}

export const indicatorAcceptanceConstants = {
  catalogKey: CATALOG_KEY,
  suiteKey: SUITE_KEY,
}
