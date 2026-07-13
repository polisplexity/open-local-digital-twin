import { getProductionPool } from '../postgisPool.mjs'

function requirePool() {
  const pool = getProductionPool()
  if (!pool) throw new Error('DATABASE_URL_REQUIRED')
  return pool
}

function jsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function text(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function rowToBlueprint(row = {}) {
  return {
    id: row.id,
    cityId: row.city_id,
    key: row.blueprint_key,
    blueprintKey: row.blueprint_key,
    title: row.title,
    description: row.description,
    version: row.version,
    portabilityScope: row.portability_scope,
    visibility: row.visibility,
    mode: 'subject',
    language: 'oldt-subject-query',
    query: row.query ?? {},
    renderer: row.renderer ?? {},
    standardRefs: Array.isArray(row.standard_refs) ? row.standard_refs : [],
    createdBy: row.created_by,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at ?? null,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at ?? null,
    binding: row.binding ?? null,
    readinessStatus: row.readiness_status ?? null,
    validation: row.validation ?? null,
  }
}

function rowToSubject(row = {}) {
  return {
    cityId: row.city_id,
    subjectKind: row.subject_kind,
    subjectId: row.subject_id,
    physicalEntityId: row.physical_entity_id,
    contextSubjectId: row.context_subject_id,
    subjectKey: row.subject_key,
    subjectType: row.subject_type,
    domainType: row.domain_type,
    label: row.label,
    canonicalUri: row.canonical_uri,
    authorityStatus: row.authority_status,
    privacyClass: row.privacy_class,
    geometryType: row.geometry_type,
    geometry: row.geometry ?? null,
    attributes: row.attributes ?? {},
    indicator: row.observation_id ? {
      observationId: row.observation_id,
      key: row.indicator_key,
      name: row.indicator_name,
      valueKind: row.value_kind,
      value: row.value == null ? null : Number(row.value),
      valueText: row.value_text,
      booleanValue: row.boolean_value,
      numerator: row.numerator == null ? null : Number(row.numerator),
      denominator: row.denominator == null ? null : Number(row.denominator),
      unit: row.indicator_unit,
      observedAt: row.observed_at?.toISOString?.() ?? row.observed_at ?? null,
      periodStart: row.period_start?.toISOString?.() ?? row.period_start ?? null,
      periodEnd: row.period_end?.toISOString?.() ?? row.period_end ?? null,
      scenarioKey: row.scenario_key,
      validationStatus: row.validation_status,
      authorityStatus: row.indicator_authority_status,
      sourceRef: row.source_ref,
    } : null,
    relationCount: Number(row.relation_count ?? 0),
  }
}

export async function getSubjectQueryInventory(cityId) {
  const pool = requirePool()
  const [subjects, indicators, relations] = await Promise.all([
    pool.query(`
      SELECT subject_kind, subject_type, domain_type, privacy_class,
             count(*)::int AS count,
             count(*) FILTER (WHERE geom IS NOT NULL)::int AS spatial_count
      FROM ldt_query.subjects
      WHERE city_id = $1
        AND privacy_class IN ('public', 'aggregate')
      GROUP BY subject_kind, subject_type, domain_type, privacy_class
      ORDER BY subject_kind, subject_type, domain_type
    `, [cityId]),
    pool.query(`
      SELECT definition.indicator_key, definition.name, definition.unit,
             definition.kind, definition.dimension, definition.calculation_scope,
             count(observation.id)::int AS observation_count,
             count(observation.id) FILTER (WHERE observation.validation_status = 'validated')::int AS validated_count
      FROM ldt_science.indicator_definitions definition
      LEFT JOIN ldt_science.indicator_observations observation
        ON observation.indicator_id = definition.id
       AND observation.city_id = $1
      WHERE definition.active IS DISTINCT FROM false
      GROUP BY definition.id
      ORDER BY definition.dimension, definition.name
    `, [cityId]),
    pool.query(`
      SELECT relation_type, count(*)::int AS count
      FROM ldt_context.subject_relations
      WHERE city_id = $1
        AND (valid_to IS NULL OR valid_to >= now())
      GROUP BY relation_type
      ORDER BY relation_type
    `, [cityId]),
  ])
  return {
    subjects: subjects.rows.map((row) => ({
      subjectKind: row.subject_kind,
      subjectType: row.subject_type,
      domainType: row.domain_type,
      privacyClass: row.privacy_class,
      count: Number(row.count ?? 0),
      spatialCount: Number(row.spatial_count ?? 0),
    })),
    indicators: indicators.rows.map((row) => ({
      indicatorKey: row.indicator_key,
      name: row.name,
      unit: row.unit,
      kind: row.kind,
      dimension: row.dimension,
      calculationScope: row.calculation_scope,
      observationCount: Number(row.observation_count ?? 0),
      validatedCount: Number(row.validated_count ?? 0),
    })),
    relations: relations.rows.map((row) => ({
      relationType: row.relation_type,
      count: Number(row.count ?? 0),
    })),
  }
}

export async function querySubjects(cityId, query = {}) {
  const pool = requirePool()
  const params = [cityId]
  const bind = (value) => {
    params.push(value)
    return `$${params.length}`
  }
  const where = [
    's.city_id = $1',
    `s.privacy_class = ANY(${bind(query.subject.privacyClasses)}::text[])`,
  ]

  if (query.subject.kinds.length) where.push(`s.subject_kind = ANY(${bind(query.subject.kinds)}::text[])`)
  if (query.subject.types.length) where.push(`s.subject_type = ANY(${bind(query.subject.types)}::text[])`)
  if (query.subject.domainTypes.length) where.push(`s.domain_type = ANY(${bind(query.subject.domainTypes)}::text[])`)
  if (query.subject.authorityStatuses.length) {
    where.push(`s.authority_status = ANY(${bind(query.subject.authorityStatuses)}::text[])`)
  }

  let observationJoin = 'LEFT JOIN ldt_query.indicator_subject_values observation ON false'
  if (query.indicator) {
    const indicatorConditions = [
      'candidate.city_id = s.city_id',
      `candidate.indicator_key = ${bind(query.indicator.key)}`,
      `candidate.validation_status = ANY(${bind(query.indicator.validationStatuses)}::text[])`,
      `candidate.authority_status = ANY(${bind(query.indicator.authorityStatuses)}::text[])`,
      `(
        (s.subject_kind = 'context' AND candidate.context_subject_id = s.context_subject_id)
        OR (s.subject_kind = 'physical' AND candidate.physical_entity_id = s.physical_entity_id)
        OR (s.subject_kind = 'city' AND candidate.subject_kind = 'city')
      )`,
    ]
    if (query.indicator.scenarioKey) {
      indicatorConditions.push(`candidate.scenario_key = ${bind(query.indicator.scenarioKey)}`)
    } else {
      indicatorConditions.push('candidate.scenario_key IS NULL')
    }
    if (query.period.from) indicatorConditions.push(`candidate.observed_at >= ${bind(query.period.from)}::timestamptz`)
    if (query.period.to) indicatorConditions.push(`candidate.observed_at <= ${bind(query.period.to)}::timestamptz`)
    observationJoin = `
      JOIN LATERAL (
        SELECT candidate.*
        FROM ldt_query.indicator_subject_values candidate
        WHERE ${indicatorConditions.join('\n          AND ')}
        ORDER BY candidate.observed_at DESC, candidate.observation_id DESC
        LIMIT 1
      ) observation ON true
    `

    const operator = query.indicator.operator
    if (operator === 'exists') {
      where.push('observation.observation_id IS NOT NULL')
    } else if (operator === 'between') {
      where.push(`observation.value BETWEEN ${bind(query.indicator.value)}::numeric AND ${bind(query.indicator.valueMax)}::numeric`)
    } else if (query.indicator.valueKind === 'boolean') {
      where.push(`observation.boolean_value ${operator === 'neq' ? '<>' : '='} ${bind(query.indicator.value)}::boolean`)
    } else if (query.indicator.valueKind === 'categorical') {
      if (operator === 'in') {
        where.push(`observation.value_text = ANY(${bind(query.indicator.values)}::text[])`)
      } else {
        where.push(`observation.value_text ${operator === 'neq' ? '<>' : '='} ${bind(query.indicator.value)}::text`)
      }
    } else {
      const sqlOperator = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[operator]
      where.push(`observation.value ${sqlOperator} ${bind(query.indicator.value)}::numeric`)
    }
  }

  let relationJoin = 'CROSS JOIN LATERAL (SELECT 0::bigint AS relation_count) relation_match'
  if (query.relation) {
    const outgoing = query.relation.direction === 'outgoing'
    const endpointCondition = outgoing
      ? `((s.subject_kind = 'context' AND relation.source_subject_id = s.context_subject_id)
          OR (s.subject_kind = 'physical' AND relation.source_entity_id = s.physical_entity_id))`
      : `((s.subject_kind = 'context' AND relation.target_subject_id = s.context_subject_id)
          OR (s.subject_kind = 'physical' AND relation.target_entity_id = s.physical_entity_id))`
    const otherSubjectColumn = outgoing ? 'relation.target_subject_id' : 'relation.source_subject_id'
    const otherEntityColumn = outgoing ? 'relation.target_entity_id' : 'relation.source_entity_id'
    const relationConditions = [
      'relation.city_id = s.city_id',
      endpointCondition,
      `relation.relation_type = ${bind(query.relation.type)}`,
      '(relation.valid_to IS NULL OR relation.valid_to >= now())',
    ]
    if (query.relation.targetKinds.length) {
      const kindParts = []
      if (query.relation.targetKinds.includes('context')) kindParts.push(`${otherSubjectColumn} IS NOT NULL`)
      if (query.relation.targetKinds.includes('physical')) kindParts.push(`${otherEntityColumn} IS NOT NULL`)
      relationConditions.push(`(${kindParts.join(' OR ')})`)
    }
    if (query.relation.targetTypes.length) {
      relationConditions.push(`COALESCE(other_subject.subject_type, other_entity.entity_type) = ANY(${bind(query.relation.targetTypes)}::text[])`)
    }
    relationJoin = `
      JOIN LATERAL (
        SELECT count(*)::bigint AS relation_count
        FROM ldt_context.subject_relations relation
        LEFT JOIN ldt_context.context_subjects other_subject ON other_subject.id = ${otherSubjectColumn}
        LEFT JOIN ldt_core.city_entities other_entity ON other_entity.id = ${otherEntityColumn}
        WHERE ${relationConditions.join('\n          AND ')}
      ) relation_match ON relation_match.relation_count >= ${bind(query.relation.minimumCount)}::int
    `
  }

  const limitParameter = bind(query.limit)
  const result = await pool.query(`
    SELECT
      s.*,
      ST_AsGeoJSON(s.geom)::jsonb AS geometry,
      observation.observation_id,
      observation.indicator_key,
      observation.indicator_name,
      observation.unit AS indicator_unit,
      observation.value_kind,
      observation.value,
      observation.value_text,
      observation.boolean_value,
      observation.numerator,
      observation.denominator,
      observation.observed_at,
      observation.period_start,
      observation.period_end,
      observation.scenario_key,
      observation.validation_status,
      observation.authority_status AS indicator_authority_status,
      observation.source_ref,
      relation_match.relation_count,
      count(*) OVER()::int AS total_count
    FROM ldt_query.subjects s
    ${observationJoin}
    ${relationJoin}
    WHERE ${where.join('\n      AND ')}
    ORDER BY
      CASE WHEN s.geom IS NULL THEN 1 ELSE 0 END,
      s.subject_type,
      s.label,
      s.subject_key
    LIMIT ${limitParameter}::int
  `, params)

  return {
    total: Number(result.rows[0]?.total_count ?? 0),
    rows: result.rows.map(rowToSubject),
  }
}

export async function recordSubjectQueryRun(cityId, { blueprintId = null, query, manifest, resultCount, actorUserId = null }) {
  const pool = requirePool()
  const result = await pool.query(`
    INSERT INTO ldt_analysis.subject_query_runs (
      city_id, blueprint_id, query, result_manifest, result_count,
      status, actor_user_id, finished_at
    ) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,'completed',$6,now())
    RETURNING id, started_at, finished_at
  `, [cityId, blueprintId, JSON.stringify(query), JSON.stringify(manifest), resultCount, actorUserId])
  return {
    id: result.rows[0].id,
    startedAt: result.rows[0].started_at,
    finishedAt: result.rows[0].finished_at,
  }
}

export async function listSubjectQueryBlueprints(cityId, options = {}) {
  const pool = requirePool()
  const limit = Math.min(200, Math.max(1, Number(options.limit ?? 50)))
  const result = await pool.query(`
    SELECT blueprint.*, binding.binding, binding.readiness_status, binding.validation
    FROM ldt_analysis.subject_query_blueprints blueprint
    LEFT JOIN ldt_analysis.subject_query_bindings binding
      ON binding.blueprint_id = blueprint.id
     AND binding.city_id = $1
    WHERE blueprint.city_id = $1
       OR (blueprint.portability_scope = 'portable' AND blueprint.visibility IN ('municipal', 'public'))
    ORDER BY blueprint.updated_at DESC
    LIMIT $2
  `, [cityId, limit])
  return result.rows.map(rowToBlueprint)
}

export async function getSubjectQueryBlueprint(cityId, keyOrId) {
  const pool = requirePool()
  const identifier = text(keyOrId)
  const result = await pool.query(`
    SELECT blueprint.*, binding.binding, binding.readiness_status, binding.validation
    FROM ldt_analysis.subject_query_blueprints blueprint
    LEFT JOIN ldt_analysis.subject_query_bindings binding
      ON binding.blueprint_id = blueprint.id
     AND binding.city_id = $1
    WHERE (blueprint.id::text = $2 OR blueprint.blueprint_key = $2)
      AND (blueprint.city_id = $1 OR blueprint.portability_scope = 'portable')
    ORDER BY CASE WHEN blueprint.city_id = $1 THEN 0 ELSE 1 END
    LIMIT 1
  `, [cityId, identifier])
  return result.rowCount ? rowToBlueprint(result.rows[0]) : null
}

export async function upsertSubjectQueryBlueprint(cityId, payload = {}) {
  const pool = requirePool()
  const portabilityScope = payload.portabilityScope === 'portable' ? 'portable' : 'city'
  const blueprintCityId = portabilityScope === 'portable' && payload.global === true ? null : cityId
  const blueprintKey = text(payload.blueprintKey ?? payload.key)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const existing = await client.query(`
      SELECT id
      FROM ldt_analysis.subject_query_blueprints
      WHERE blueprint_key = $1
        AND city_id IS NOT DISTINCT FROM $2::text
      LIMIT 1
    `, [blueprintKey, blueprintCityId])
    const values = [
      blueprintCityId,
      blueprintKey,
      text(payload.title, blueprintKey),
      text(payload.description),
      text(payload.version, '1.0.0'),
      portabilityScope,
      ['private', 'municipal', 'public'].includes(payload.visibility) ? payload.visibility : 'municipal',
      JSON.stringify(jsonObject(payload.query)),
      JSON.stringify(jsonObject(payload.renderer)),
      Array.isArray(payload.standardRefs) ? payload.standardRefs.map(String) : [],
      text(payload.createdBy) || null,
    ]
    let result
    if (existing.rowCount) {
      result = await client.query(`
        UPDATE ldt_analysis.subject_query_blueprints SET
          title=$3, description=$4, version=$5, portability_scope=$6,
          visibility=$7, query=$8::jsonb, renderer=$9::jsonb,
          standard_refs=$10::text[], created_by=COALESCE($11, created_by), updated_at=now()
        WHERE id=$12
        RETURNING *
      `, [...values, existing.rows[0].id])
    } else {
      result = await client.query(`
        INSERT INTO ldt_analysis.subject_query_blueprints (
          city_id, blueprint_key, title, description, version,
          portability_scope, visibility, query, renderer, standard_refs, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::text[],$11)
        RETURNING *
      `, values)
    }
    if (payload.binding && typeof payload.binding === 'object') {
      await client.query(`
        INSERT INTO ldt_analysis.subject_query_bindings (
          blueprint_id, city_id, binding, readiness_status, validation, validated_at, updated_at
        ) VALUES ($1,$2,$3::jsonb,$4,$5::jsonb,CASE WHEN $4='ready' THEN now() ELSE NULL END,now())
        ON CONFLICT (blueprint_id, city_id) DO UPDATE SET
          binding=EXCLUDED.binding,
          readiness_status=EXCLUDED.readiness_status,
          validation=EXCLUDED.validation,
          validated_at=EXCLUDED.validated_at,
          updated_at=now()
      `, [
        result.rows[0].id,
        cityId,
        JSON.stringify(payload.binding),
        ['draft', 'ready', 'blocked', 'not-applicable'].includes(payload.readinessStatus) ? payload.readinessStatus : 'draft',
        JSON.stringify(jsonObject(payload.validation)),
      ])
    }
    await client.query('COMMIT')
    return rowToBlueprint(result.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function upsertContextSubject(cityId, payload = {}) {
  const pool = requirePool()
  const geometry = payload.geometry && typeof payload.geometry === 'object' ? JSON.stringify(payload.geometry) : null
  const result = await pool.query(`
    INSERT INTO ldt_context.context_subjects (
      city_id, subject_key, subject_type, domain_type, label, canonical_uri,
      authority_status, privacy_class, lifecycle_status, valid_from, valid_to,
      geom, attributes, provenance, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
      CASE WHEN $12::text IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($12),4326) END,
      $13::jsonb,$14::jsonb,now()
    )
    ON CONFLICT (city_id, subject_key) DO UPDATE SET
      subject_type=EXCLUDED.subject_type,
      domain_type=EXCLUDED.domain_type,
      label=EXCLUDED.label,
      canonical_uri=EXCLUDED.canonical_uri,
      authority_status=EXCLUDED.authority_status,
      privacy_class=EXCLUDED.privacy_class,
      lifecycle_status=EXCLUDED.lifecycle_status,
      valid_from=EXCLUDED.valid_from,
      valid_to=EXCLUDED.valid_to,
      geom=COALESCE(EXCLUDED.geom, ldt_context.context_subjects.geom),
      attributes=ldt_context.context_subjects.attributes || EXCLUDED.attributes,
      provenance=ldt_context.context_subjects.provenance || EXCLUDED.provenance,
      updated_at=now()
    RETURNING *, ST_AsGeoJSON(geom)::jsonb AS geometry
  `, [
    cityId,
    text(payload.subjectKey ?? payload.key),
    text(payload.subjectType ?? payload.type),
    text(payload.domainType, 'general'),
    text(payload.label, payload.subjectKey ?? payload.key),
    text(payload.canonicalUri) || null,
    text(payload.authorityStatus, 'unreviewed'),
    text(payload.privacyClass, 'aggregate'),
    text(payload.lifecycleStatus, 'active'),
    payload.validFrom || null,
    payload.validTo || null,
    geometry,
    JSON.stringify(jsonObject(payload.attributes)),
    JSON.stringify(jsonObject(payload.provenance)),
  ])
  const row = result.rows[0]
  return {
    id: row.id,
    cityId: row.city_id,
    subjectKey: row.subject_key,
    subjectType: row.subject_type,
    domainType: row.domain_type,
    label: row.label,
    authorityStatus: row.authority_status,
    privacyClass: row.privacy_class,
    geometry: row.geometry,
    attributes: row.attributes,
    provenance: row.provenance,
  }
}

async function resolveEndpoint(client, cityId, endpoint = {}) {
  const kind = endpoint.kind === 'physical' ? 'physical' : 'context'
  const key = text(endpoint.key ?? endpoint.subjectKey ?? endpoint.stableId)
  const table = kind === 'physical' ? 'ldt_core.city_entities' : 'ldt_context.context_subjects'
  const keyColumn = kind === 'physical' ? 'stable_id' : 'subject_key'
  const result = await client.query(`SELECT id FROM ${table} WHERE city_id=$1 AND ${keyColumn}=$2 LIMIT 1`, [cityId, key])
  if (!result.rowCount) throw new Error(`SUBJECT_RELATION_ENDPOINT_NOT_FOUND:${kind}:${key}`)
  return { kind, id: result.rows[0].id, key }
}

export async function upsertSubjectRelation(cityId, payload = {}) {
  const pool = requirePool()
  const client = await pool.connect()
  try {
    const source = await resolveEndpoint(client, cityId, payload.source)
    const target = await resolveEndpoint(client, cityId, payload.target)
    const result = await client.query(`
      INSERT INTO ldt_context.subject_relations (
        city_id, relation_key, relation_type,
        source_subject_id, source_entity_id, target_subject_id, target_entity_id,
        authority_status, valid_from, valid_to, properties, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,now())
      ON CONFLICT (city_id, relation_key) DO UPDATE SET
        relation_type=EXCLUDED.relation_type,
        source_subject_id=EXCLUDED.source_subject_id,
        source_entity_id=EXCLUDED.source_entity_id,
        target_subject_id=EXCLUDED.target_subject_id,
        target_entity_id=EXCLUDED.target_entity_id,
        authority_status=EXCLUDED.authority_status,
        valid_from=EXCLUDED.valid_from,
        valid_to=EXCLUDED.valid_to,
        properties=ldt_context.subject_relations.properties || EXCLUDED.properties,
        updated_at=now()
      RETURNING *
    `, [
      cityId,
      text(payload.relationKey ?? payload.key),
      text(payload.relationType ?? payload.type),
      source.kind === 'context' ? source.id : null,
      source.kind === 'physical' ? source.id : null,
      target.kind === 'context' ? target.id : null,
      target.kind === 'physical' ? target.id : null,
      text(payload.authorityStatus, 'unreviewed'),
      payload.validFrom || null,
      payload.validTo || null,
      JSON.stringify(jsonObject(payload.properties)),
    ])
    return {
      id: result.rows[0].id,
      cityId,
      relationKey: result.rows[0].relation_key,
      relationType: result.rows[0].relation_type,
      source,
      target,
      authorityStatus: result.rows[0].authority_status,
      properties: result.rows[0].properties,
    }
  } finally {
    client.release()
  }
}

export async function upsertSubjectIndicatorObservation(cityId, payload = {}) {
  const pool = requirePool()
  const subjectKey = text(payload.subjectKey)
  const subjectKind = payload.subjectKind === 'physical' ? 'physical' : payload.subjectKind === 'city' ? 'city' : 'context'
  const result = await pool.query(`
    INSERT INTO ldt_science.indicator_observations (
      city_id, indicator_id, geography_entity_id, context_subject_id,
      observation_key, geography_level, observed_at, period_start, period_end,
      value_kind, value, value_text, boolean_value, numerator, denominator,
      value_json, unit, quality, validation_status, authority_status,
      scenario_key, source_ref, source_quality, method, uncertainty, metadata, updated_at
    )
    SELECT
      $1, definition.id,
      CASE WHEN $3='physical' THEN physical.id ELSE NULL END,
      CASE WHEN $3='context' THEN context.id ELSE NULL END,
      $4,$5,COALESCE($6::timestamptz,now()),$7,$8,$9,$10,$11,$12,$13,$14,
      $15::jsonb,$16,$17,$18,$19,$20,$21,$22,$23::jsonb,$24::jsonb,$25::jsonb,now()
    FROM ldt_science.indicator_definitions definition
    LEFT JOIN ldt_core.city_entities physical
      ON $3='physical' AND physical.city_id=$1 AND physical.stable_id=$2
    LEFT JOIN ldt_context.context_subjects context
      ON $3='context' AND context.city_id=$1 AND context.subject_key=$2
    WHERE definition.indicator_key=$26
      AND ($3='city' OR physical.id IS NOT NULL OR context.id IS NOT NULL)
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
      scenario_key=EXCLUDED.scenario_key,
      source_ref=EXCLUDED.source_ref,
      source_quality=EXCLUDED.source_quality,
      method=EXCLUDED.method,
      uncertainty=EXCLUDED.uncertainty,
      metadata=EXCLUDED.metadata,
      updated_at=now()
    RETURNING *
  `, [
    cityId,
    subjectKey,
    subjectKind,
    text(payload.observationKey ?? payload.key),
    text(payload.geographyLevel, subjectKind === 'city' ? 'city' : 'subject'),
    payload.observedAt || null,
    payload.periodStart || null,
    payload.periodEnd || null,
    text(payload.valueKind, 'numeric'),
    payload.value ?? null,
    payload.valueText ?? null,
    payload.booleanValue ?? null,
    payload.numerator ?? null,
    payload.denominator ?? null,
    JSON.stringify(jsonObject(payload.valueJson)),
    text(payload.unit) || null,
    text(payload.quality, 'unknown'),
    text(payload.validationStatus, 'candidate'),
    text(payload.authorityStatus, 'unreviewed'),
    text(payload.scenarioKey) || null,
    text(payload.sourceRef) || null,
    text(payload.sourceQuality, 'unknown'),
    JSON.stringify(jsonObject(payload.method)),
    JSON.stringify(jsonObject(payload.uncertainty)),
    JSON.stringify(jsonObject(payload.metadata)),
    text(payload.indicatorKey),
  ])
  if (!result.rowCount) throw new Error(`SUBJECT_INDICATOR_TARGET_NOT_FOUND:${payload.indicatorKey}:${subjectKind}:${subjectKey}`)
  return {
    id: result.rows[0].id,
    cityId,
    observationKey: result.rows[0].observation_key,
    indicatorKey: text(payload.indicatorKey),
    subjectKind,
    subjectKey: subjectKind === 'city' ? cityId : subjectKey,
    valueKind: result.rows[0].value_kind,
    value: result.rows[0].value == null ? null : Number(result.rows[0].value),
    numerator: result.rows[0].numerator == null ? null : Number(result.rows[0].numerator),
    denominator: result.rows[0].denominator == null ? null : Number(result.rows[0].denominator),
    validationStatus: result.rows[0].validation_status,
    authorityStatus: result.rows[0].authority_status,
  }
}
