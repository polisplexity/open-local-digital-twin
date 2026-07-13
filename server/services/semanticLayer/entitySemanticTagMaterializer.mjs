import { getProductionPool } from '../../db/postgisPool.mjs'

function requireCityId(cityId) {
  const normalized = String(cityId ?? '').trim()
  if (!normalized) throw new Error('CITY_ID_REQUIRED')
  return normalized
}

function optionalPositiveInteger(value, errorCode) {
  if (value === undefined || value === null || value === '') return null
  const normalized = Number(value)
  if (!Number.isInteger(normalized) || normalized < 1) throw new Error(errorCode)
  return normalized
}

async function createTargetTable(client, cityId, entityLimitPerType) {
  await client.query(
    `
      CREATE TEMP TABLE tmp_entity_semantic_tag_targets ON COMMIT DROP AS
      SELECT entity_id
      FROM (
        SELECT
          ce.id AS entity_id,
          row_number() OVER (
            PARTITION BY ce.entity_type
            ORDER BY ce.stable_id, ce.id
          ) AS entity_rank
        FROM ldt_core.city_entities ce
        WHERE ce.city_id = $1
          AND ce.lifecycle_status <> 'retired'
      ) ranked
      WHERE $2::integer IS NULL OR ranked.entity_rank <= $2
    `,
    [cityId, entityLimitPerType],
  )
  await client.query('CREATE UNIQUE INDEX tmp_entity_semantic_tag_targets_id_idx ON tmp_entity_semantic_tag_targets (entity_id)')
  await client.query('ANALYZE tmp_entity_semantic_tag_targets')
}

async function createCandidateTable(client, cityId) {
  await client.query(
    `
      CREATE TEMP TABLE tmp_entity_semantic_tag_candidates ON COMMIT DROP AS
      WITH raw_candidates AS (
        SELECT
          ce.id AS entity_id,
          ce.city_id,
          ce.entity_type,
          sf.id AS source_feature_id,
          sf.source_feature_id AS native_source_feature_id,
          sf.source_layer,
          COALESCE(sf.payload->'payload'->'properties', sf.payload->'properties', '{}'::jsonb) AS source_properties,
          COALESCE(ce.properties->'sourceProperties', '{}'::jsonb) AS entity_source_properties,
          m.id AS mapping_id,
          m.provider_key,
          m.source_family,
          m.semantic_class_key,
          m.mapping_method,
          m.confidence,
          m.authority_status,
          m.city_id IS NOT NULL AS city_specific_mapping,
          rule.rule_json,
          m.updated_at AS mapping_updated_at,
          sf.created_at AS source_created_at
        FROM ldt_core.city_entities ce
        JOIN tmp_entity_semantic_tag_targets target ON target.entity_id = ce.id
        JOIN ldt_prov.entity_source_evidence ese ON ese.entity_id = ce.id
        JOIN ldt_prov.source_features sf ON sf.id = ese.source_feature_id
        JOIN ldt_semantic.source_semantic_mappings m
          ON (m.city_id IS NULL OR m.city_id = ce.city_id)
         AND m.source_layer = sf.source_layer
         AND m.entity_type = ce.entity_type
         AND m.lifecycle_status <> 'retired'
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.tag_rules, '[]'::jsonb)) AS rule(rule_json)
        WHERE ce.city_id = $1
          AND ce.lifecycle_status <> 'retired'
          AND (
            m.source_filter = '{}'::jsonb
            OR COALESCE(sf.payload->'payload'->'properties', sf.payload->'properties', '{}'::jsonb) @> m.source_filter
            OR COALESCE(ce.properties->'sourceProperties', '{}'::jsonb) @> m.source_filter
          )
      ),
      resolved AS (
        SELECT
          raw_candidates.*,
          raw_candidates.rule_json->>'tagKey' AS tag_key,
          COALESCE(
            NULLIF(raw_candidates.rule_json->>'constant', ''),
            NULLIF(raw_candidates.source_properties->>(raw_candidates.rule_json->>'sourceProperty'), ''),
            NULLIF(raw_candidates.entity_source_properties->>(raw_candidates.rule_json->>'sourceProperty'), ''),
            (
              SELECT NULLIF(COALESCE(raw_candidates.source_properties->>source_key, raw_candidates.entity_source_properties->>source_key), '')
              FROM jsonb_array_elements_text(
                CASE
                  WHEN jsonb_typeof(raw_candidates.rule_json->'sourceProperties') = 'array'
                    THEN raw_candidates.rule_json->'sourceProperties'
                  ELSE '[]'::jsonb
                END
              ) AS source_key
              WHERE NULLIF(COALESCE(raw_candidates.source_properties->>source_key, raw_candidates.entity_source_properties->>source_key), '') IS NOT NULL
              LIMIT 1
            )
          ) AS tag_value
        FROM raw_candidates
      )
      SELECT DISTINCT ON (
        r.entity_id,
        r.semantic_class_key,
        r.tag_key,
        COALESCE(r.tag_value, ''),
        r.mapping_method
      )
        r.entity_id,
        r.semantic_class_key,
        r.tag_key,
        r.tag_value,
        std.value_type,
        jsonb_build_object(
          'mappingId', r.mapping_id,
          'providerKey', r.provider_key,
          'sourceFamily', r.source_family,
          'sourceLayer', r.source_layer,
          'sourceFeatureId', r.source_feature_id,
          'nativeSourceFeatureId', r.native_source_feature_id,
          'entityType', r.entity_type,
          'tagRule', r.rule_json,
          'materializedBy', 'entity-semantic-tag-materializer'
        ) AS value_json,
        r.source_feature_id,
        r.mapping_method AS method,
        r.confidence,
        r.authority_status,
        'generated'::text AS review_state
      FROM resolved r
      JOIN ldt_semantic.semantic_tag_definitions std
        ON std.semantic_class_key = r.semantic_class_key
       AND std.tag_key = r.tag_key
      WHERE r.tag_key IS NOT NULL
        AND r.tag_value IS NOT NULL
      ORDER BY
        r.entity_id,
        r.semantic_class_key,
        r.tag_key,
        COALESCE(r.tag_value, ''),
        r.mapping_method,
        r.city_specific_mapping DESC,
        r.mapping_updated_at DESC,
        r.source_created_at DESC
    `,
    [cityId],
  )

  await client.query('CREATE INDEX tmp_entity_semantic_tag_candidates_key_idx ON tmp_entity_semantic_tag_candidates (entity_id, semantic_class_key, tag_key, COALESCE(tag_value, \'\'), method)')
  await client.query('CREATE INDEX tmp_entity_semantic_tag_candidates_class_idx ON tmp_entity_semantic_tag_candidates (semantic_class_key)')
  await client.query('ANALYZE tmp_entity_semantic_tag_candidates')
}

async function updateExistingTags(client) {
  const result = await client.query(
    `
      UPDATE ldt_semantic.entity_semantic_tags est
      SET
        value_type = c.value_type,
        value_json = c.value_json,
        source_feature_id = c.source_feature_id,
        confidence = c.confidence,
        authority_status = c.authority_status,
        review_state = c.review_state,
        valid_to = NULL,
        updated_at = now()
      FROM tmp_entity_semantic_tag_candidates c
      WHERE est.valid_to IS NULL
        AND est.entity_id = c.entity_id
        AND est.semantic_class_key = c.semantic_class_key
        AND est.tag_key = c.tag_key
        AND COALESCE(est.tag_value, '') = COALESCE(c.tag_value, '')
        AND est.method = c.method
    `,
  )
  return result.rowCount
}

async function insertNewTags(client) {
  const result = await client.query(
    `
      INSERT INTO ldt_semantic.entity_semantic_tags (
        entity_id,
        semantic_class_key,
        tag_key,
        tag_value,
        value_type,
        value_json,
        source_feature_id,
        method,
        confidence,
        authority_status,
        review_state,
        valid_from,
        updated_at
      )
      SELECT
        c.entity_id,
        c.semantic_class_key,
        c.tag_key,
        c.tag_value,
        c.value_type,
        c.value_json,
        c.source_feature_id,
        c.method,
        c.confidence,
        c.authority_status,
        c.review_state,
        now(),
        now()
      FROM tmp_entity_semantic_tag_candidates c
      WHERE NOT EXISTS (
        SELECT 1
        FROM ldt_semantic.entity_semantic_tags est
        WHERE est.valid_to IS NULL
          AND est.entity_id = c.entity_id
          AND est.semantic_class_key = c.semantic_class_key
          AND est.tag_key = c.tag_key
          AND COALESCE(est.tag_value, '') = COALESCE(c.tag_value, '')
          AND est.method = c.method
      )
      ON CONFLICT DO NOTHING
    `,
  )
  return result.rowCount
}

async function retireStaleTags(client, cityId) {
  const result = await client.query(
    `
      UPDATE ldt_semantic.entity_semantic_tags est
      SET valid_to = now(), updated_at = now()
      FROM ldt_core.city_entities ce
      JOIN tmp_entity_semantic_tag_targets target ON target.entity_id = ce.id
      WHERE ce.id = est.entity_id
        AND ce.city_id = $1
        AND est.method = 'configured-source-mapping'
        AND est.valid_to IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM tmp_entity_semantic_tag_candidates c
          WHERE c.entity_id = est.entity_id
            AND c.semantic_class_key = est.semantic_class_key
            AND c.tag_key = est.tag_key
            AND COALESCE(c.tag_value, '') = COALESCE(est.tag_value, '')
            AND c.method = est.method
        )
    `,
    [cityId],
  )
  return result.rowCount
}

export async function getEntitySemanticTagSummary({ cityId, client = null, pool = getProductionPool() } = {}) {
  const normalizedCityId = requireCityId(cityId)
  if (!client && !pool) throw new Error('DATABASE_URL_REQUIRED')
  const activeClient = client || await pool.connect()
  try {
    const activeTags = await activeClient.query(
      `
        SELECT count(*)::int AS count
        FROM ldt_semantic.entity_semantic_tags est
        JOIN ldt_core.city_entities ce ON ce.id = est.entity_id
        WHERE ce.city_id = $1
          AND est.valid_to IS NULL
      `,
      [normalizedCityId],
    )
    const byClass = await activeClient.query(
      `
        SELECT est.semantic_class_key, est.tag_key, count(*)::int AS count
        FROM ldt_semantic.entity_semantic_tags est
        JOIN ldt_core.city_entities ce ON ce.id = est.entity_id
        WHERE ce.city_id = $1
          AND est.valid_to IS NULL
        GROUP BY est.semantic_class_key, est.tag_key
        ORDER BY count DESC, est.semantic_class_key, est.tag_key
      `,
      [normalizedCityId],
    )
    const byEntityType = await activeClient.query(
      `
        SELECT ce.entity_type, est.semantic_class_key, count(DISTINCT est.entity_id)::int AS entity_count
        FROM ldt_semantic.entity_semantic_tags est
        JOIN ldt_core.city_entities ce ON ce.id = est.entity_id
        WHERE ce.city_id = $1
          AND est.valid_to IS NULL
        GROUP BY ce.entity_type, est.semantic_class_key
        ORDER BY entity_count DESC, ce.entity_type, est.semantic_class_key
      `,
      [normalizedCityId],
    )
    const samples = await activeClient.query(
      `
        SELECT ce.stable_id, ce.entity_type, est.semantic_class_key, est.tag_key, est.tag_value
        FROM ldt_semantic.entity_semantic_tags est
        JOIN ldt_core.city_entities ce ON ce.id = est.entity_id
        WHERE ce.city_id = $1
          AND est.valid_to IS NULL
        ORDER BY est.updated_at DESC, est.id
        LIMIT 5
      `,
      [normalizedCityId],
    )

    return {
      cityId: normalizedCityId,
      activeTagCount: Number(activeTags.rows[0]?.count ?? 0),
      tagsByClass: byClass.rows.map((row) => ({
        semanticClassKey: row.semantic_class_key,
        tagKey: row.tag_key,
        count: Number(row.count ?? 0),
      })),
      taggedEntitiesByType: byEntityType.rows.map((row) => ({
        entityType: row.entity_type,
        semanticClassKey: row.semantic_class_key,
        entityCount: Number(row.entity_count ?? 0),
      })),
      sampleTags: samples.rows.map((row) => ({
        stableId: row.stable_id,
        entityType: row.entity_type,
        semanticClassKey: row.semantic_class_key,
        tagKey: row.tag_key,
        tagValue: row.tag_value,
      })),
    }
  } finally {
    if (!client) activeClient.release()
  }
}

export async function materializeEntitySemanticTags({
  cityId,
  entityLimitPerType = null,
  pool = getProductionPool(),
} = {}) {
  const normalizedCityId = requireCityId(cityId)
  const normalizedEntityLimitPerType = optionalPositiveInteger(
    entityLimitPerType,
    'ENTITY_SEMANTIC_TAG_LIMIT_PER_TYPE_INVALID',
  )
  if (!pool) throw new Error('DATABASE_URL_REQUIRED')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await createTargetTable(client, normalizedCityId, normalizedEntityLimitPerType)
    await createCandidateTable(client, normalizedCityId)

    const targetResult = await client.query('SELECT count(*)::int AS count FROM tmp_entity_semantic_tag_targets')
    const candidateResult = await client.query('SELECT count(*)::int AS count FROM tmp_entity_semantic_tag_candidates')
    const updated = await updateExistingTags(client)
    const inserted = await insertNewTags(client)
    const retired = await retireStaleTags(client, normalizedCityId)
    const summary = await getEntitySemanticTagSummary({ cityId: normalizedCityId, client })

    await client.query('COMMIT')

    return {
      ok: true,
      cityId: normalizedCityId,
      targetEntityCount: Number(targetResult.rows[0]?.count ?? 0),
      entityLimitPerType: normalizedEntityLimitPerType,
      bounded: normalizedEntityLimitPerType !== null,
      candidateCount: Number(candidateResult.rows[0]?.count ?? 0),
      inserted,
      updated,
      retired,
      ...summary,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    return {
      ok: false,
      cityId: normalizedCityId,
      error: String(error?.message ?? 'ENTITY_SEMANTIC_TAG_MATERIALIZATION_FAILED'),
    }
  } finally {
    client.release()
  }
}
