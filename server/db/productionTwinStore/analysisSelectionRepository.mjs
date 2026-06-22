import crypto from 'node:crypto'
import { getProductionPool } from '../postgisPool.mjs'
import { parseMaybeJson } from './repositoryUtils.mjs'

const DEFAULT_LIST_LIMIT = 30
const DEFAULT_MEMBER_LIMIT = 500
const MEMBER_INSERT_BATCH_SIZE = 10000

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function clampLimit(value, fallback, max = 5000) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(1, number))
}

function normalizeOffset(value) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return 0
  return Math.max(0, number)
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (!value || typeof value !== 'object') return JSON.stringify(value)
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
}

function canonicalQueryForHash(query = {}) {
  return {
    language: query.language,
    operation: query.operation,
    classes: query.classes,
    scope: query.scope,
    where: query.where,
    clauses: query.clauses,
  }
}

export function hashTwinQuery(query = {}) {
  return crypto
    .createHash('sha256')
    .update(stableJson(canonicalQueryForHash(query)))
    .digest('hex')
}

function selectionTitle(input = {}, query = {}) {
  const explicit = compactText(input.title)
  if (explicit) return explicit.slice(0, 240)
  const classes = Array.isArray(query.classes) ? query.classes.join(', ') : 'city objects'
  const scope = query.scope?.key ? ` in ${query.scope.key}` : ''
  return `${classes || 'city objects'}${scope}`.slice(0, 240)
}

function defaultSelectionStyle(query = {}, summary = {}) {
  const classes = Object.keys(summary.countsBySemanticClass ?? {})
  const primaryClass = classes[0] || query.classes?.[0] || 'cityObject'
  const palette = {
    boundary: '#c56f2d',
    roads: '#235a73',
    buildings: '#394b5f',
    greenBlue: '#168d76',
    landUse: '#c4a457',
    places: '#8067d8',
    accessSeeds: '#d88b18',
    semanticPacks: '#008c99',
  }
  return {
    version: '2026-06-02',
    mode: 'selection-highlight',
    primaryClass,
    color: palette[primaryClass] || '#007c89',
    opacity: 0.82,
    outline: '#081925',
    pointSize: 5,
    lineWidth: 2,
  }
}

function metricsJson(summary = {}) {
  return {
    resultCount: Number(summary.resultCount ?? 0),
    returnedCount: Number(summary.returned ?? 0),
    truncated: Boolean(summary.truncated),
    countsBySemanticClass: summary.countsBySemanticClass ?? {},
    countsByLayer: summary.countsByLayer ?? {},
    countsByClause: summary.countsByClause ?? {},
    bounds: summary.bounds ?? null,
  }
}

function metricRows(selectionId, summary = {}) {
  const rows = [
    {
      key: 'result_count',
      label: 'Selected city objects',
      value: Number(summary.resultCount ?? 0),
      unit: 'objects',
      properties: {},
    },
    {
      key: 'returned_count',
      label: 'Persisted city objects',
      value: Number(summary.returned ?? 0),
      unit: 'objects',
      properties: {},
    },
  ]

  Object.entries(summary.countsBySemanticClass ?? {}).forEach(([semanticClass, value]) => {
    rows.push({
      key: `semantic_class.${semanticClass}`,
      label: `${semanticClass} objects`,
      value: Number(value ?? 0),
      unit: 'objects',
      properties: { semanticClass },
    })
  })

  return rows.map((row) => ({ ...row, selectionId }))
}

function rowToSelectionSet(row = {}) {
  return {
    id: row.id,
    cityId: row.city_id,
    sessionId: row.session_id,
    title: row.title,
    selectionKind: row.selection_kind,
    queryHash: row.query_hash,
    sourceQuery: parseMaybeJson(row.source_query, {}),
    scope: parseMaybeJson(row.scope, {}),
    semanticClasses: Array.isArray(row.semantic_classes) ? row.semantic_classes : [],
    resultCount: Number(row.result_count ?? 0),
    returnedCount: Number(row.returned_count ?? 0),
    truncated: Boolean(row.truncated),
    complete: Boolean(row.complete),
    bounds: parseMaybeJson(row.bounds, null),
    style: parseMaybeJson(row.style, {}),
    metrics: parseMaybeJson(row.metrics, {}),
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at ?? null,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at ?? null,
  }
}

function rowToAnalysisSession(row = {}) {
  return {
    id: row.id,
    cityId: row.city_id,
    title: row.title,
    status: row.status,
    surface: row.surface,
    intent: row.intent,
    actorUserId: row.actor_user_id,
    metadata: parseMaybeJson(row.metadata, {}),
    createdAt: row.created_at?.toISOString?.() ?? row.created_at ?? null,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at ?? null,
  }
}

function rowToSelectionMember(row = {}) {
  return {
    selectionSetId: row.selection_set_id,
    cityEntityId: row.city_entity_id,
    objectId: row.object_id,
    semanticClass: row.semantic_class,
    layerKey: row.layer_key,
    entityType: row.entity_type,
    label: row.label,
    geometryType: row.geometry_type,
    clauseId: row.clause_id,
    clauseLabel: row.clause_label,
    rank: Number(row.rank ?? 0),
    score: row.score == null ? null : Number(row.score),
    distanceMeters: row.distance_m == null ? null : Number(row.distance_m),
    samplePoint: row.sample_point_geojson ? parseMaybeJson(row.sample_point_geojson, null) : null,
    attributes: parseMaybeJson(row.attributes, {}),
  }
}

function chunkArray(values, size) {
  const chunks = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

function memberPayload(rows = []) {
  return rows.map((row, index) => ({
    city_entity_id: row.cityEntityId,
    object_id: row.objectId,
    semantic_class: row.semanticClass,
    layer_key: row.layerKey,
    entity_type: row.entityType,
    label: row.label,
    geometry_type: row.geometryType,
    clause_id: row.clauseId,
    clause_label: row.clauseLabel,
    rank: index + 1,
    score: null,
    distance_m: row.distanceMeters,
    centroid_lon: row.centroid?.[0] ?? null,
    centroid_lat: row.centroid?.[1] ?? null,
    attributes: row.attributes ?? {},
  }))
}

async function insertSelectionMembers(client, selectionSetId, rows = []) {
  const payloadRows = memberPayload(rows)
  for (const chunk of chunkArray(payloadRows, MEMBER_INSERT_BATCH_SIZE)) {
    await client.query(
      `
        INSERT INTO ldt_analysis.selection_set_members (
          selection_set_id,
          city_entity_id,
          object_id,
          semantic_class,
          layer_key,
          entity_type,
          label,
          geometry_type,
          clause_id,
          clause_label,
          rank,
          score,
          distance_m,
          sample_point,
          attributes
        )
        SELECT
          $1::uuid,
          NULLIF(member.city_entity_id, '')::uuid,
          member.object_id,
          member.semantic_class,
          member.layer_key,
          member.entity_type,
          COALESCE(member.label, member.object_id),
          member.geometry_type,
          member.clause_id,
          member.clause_label,
          member.rank,
          member.score,
          member.distance_m,
          CASE
            WHEN member.centroid_lon IS NULL OR member.centroid_lat IS NULL THEN NULL
            ELSE ST_SetSRID(ST_MakePoint(member.centroid_lon, member.centroid_lat), 4326)
          END,
          COALESCE(member.attributes, '{}'::jsonb)
        FROM jsonb_to_recordset($2::jsonb) AS member(
          city_entity_id text,
          object_id text,
          semantic_class text,
          layer_key text,
          entity_type text,
          label text,
          geometry_type text,
          clause_id text,
          clause_label text,
          rank integer,
          score numeric,
          distance_m numeric,
          centroid_lon double precision,
          centroid_lat double precision,
          attributes jsonb
        )
        ON CONFLICT (selection_set_id, object_id) DO UPDATE SET
          city_entity_id = EXCLUDED.city_entity_id,
          semantic_class = EXCLUDED.semantic_class,
          layer_key = EXCLUDED.layer_key,
          entity_type = EXCLUDED.entity_type,
          label = EXCLUDED.label,
          geometry_type = EXCLUDED.geometry_type,
          clause_id = EXCLUDED.clause_id,
          clause_label = EXCLUDED.clause_label,
          rank = EXCLUDED.rank,
          score = EXCLUDED.score,
          distance_m = EXCLUDED.distance_m,
          sample_point = EXCLUDED.sample_point,
          attributes = EXCLUDED.attributes
      `,
      [selectionSetId, JSON.stringify(chunk)],
    )
  }
}

async function insertSelectionMetrics(client, selectionSetId, summary = {}) {
  for (const row of metricRows(selectionSetId, summary)) {
    await client.query(
      `
        INSERT INTO ldt_analysis.selection_metrics (
          selection_set_id,
          metric_key,
          label,
          value,
          unit,
          properties
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        ON CONFLICT (selection_set_id, metric_key) DO UPDATE SET
          label = EXCLUDED.label,
          value = EXCLUDED.value,
          unit = EXCLUDED.unit,
          properties = EXCLUDED.properties
      `,
      [selectionSetId, row.key, row.label, row.value, row.unit, JSON.stringify(row.properties)],
    )
  }
}

export async function createAnalysisSession(cityId, input = {}) {
  const pool = getProductionPool()
  if (!pool) {
    return { configured: false, ok: true, cityId, session: null, error: null }
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO ldt_analysis.analysis_sessions (
          city_id,
          title,
          surface,
          intent,
          actor_user_id,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        RETURNING *
      `,
      [
        cityId,
        compactText(input.title, 'Untitled analysis session'),
        compactText(input.surface, 'map'),
        compactText(input.intent, 'analysis'),
        input.actorUserId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    )

    return {
      configured: true,
      ok: true,
      cityId,
      session: rowToAnalysisSession(result.rows[0]),
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      session: null,
      error: String(error?.message ?? 'ANALYSIS_SESSION_CREATE_FAILED'),
    }
  }
}

export async function persistAnalysisSelection(cityId, input = {}) {
  const pool = getProductionPool()
  const query = input.query && typeof input.query === 'object' ? input.query : {}
  const summary = input.summary && typeof input.summary === 'object' ? input.summary : {}
  const rows = Array.isArray(input.rows) ? input.rows : []
  const semanticClasses = Object.keys(summary.countsBySemanticClass ?? {})
  const queryHash = hashTwinQuery(query)
  const metrics = metricsJson(summary)
  const style = input.style && typeof input.style === 'object'
    ? input.style
    : defaultSelectionStyle(query, summary)

  if (!pool) {
    return { configured: false, ok: true, cityId, selection: null, error: null }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const selectionResult = await client.query(
      `
        INSERT INTO ldt_analysis.selection_sets (
          city_id,
          session_id,
          title,
          selection_kind,
          query_hash,
          source_query,
          scope,
          semantic_classes,
          result_count,
          returned_count,
          truncated,
          complete,
          bounds,
          style,
          metrics,
          created_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::text[],
          $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15::jsonb, $16
        )
        RETURNING *
      `,
      [
        cityId,
        input.sessionId ?? null,
        selectionTitle(input, query),
        compactText(input.selectionKind, 'twinql-selection'),
        queryHash,
        JSON.stringify(query),
        JSON.stringify(query.scope ?? {}),
        semanticClasses,
        Number(summary.resultCount ?? rows.length),
        rows.length,
        Boolean(summary.truncated),
        !summary.truncated,
        summary.bounds ? JSON.stringify(summary.bounds) : null,
        JSON.stringify(style),
        JSON.stringify(metrics),
        input.createdBy ?? input.actorUserId ?? null,
      ],
    )

    const selection = rowToSelectionSet(selectionResult.rows[0])
    await insertSelectionMembers(client, selection.id, rows)
    await insertSelectionMetrics(client, selection.id, summary)
    await client.query(
      `
        INSERT INTO ldt_analysis.selection_styles (selection_set_id, style_key, style, active)
        VALUES ($1, 'default', $2::jsonb, true)
        ON CONFLICT (selection_set_id, style_key) DO UPDATE SET
          style = EXCLUDED.style,
          active = true
      `,
      [selection.id, JSON.stringify(style)],
    )
    await client.query('COMMIT')

    return {
      configured: true,
      ok: true,
      cityId,
      selection: {
        ...selection,
        memberCount: rows.length,
      },
      error: null,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    return {
      configured: true,
      ok: false,
      cityId,
      selection: null,
      error: String(error?.message ?? 'ANALYSIS_SELECTION_PERSIST_FAILED'),
    }
  } finally {
    client.release()
  }
}

export async function listAnalysisSelections(cityId, options = {}) {
  const pool = getProductionPool()
  const limit = clampLimit(options.limit, DEFAULT_LIST_LIMIT, 100)
  const status = compactText(options.status, 'ready')
  const semanticClass = compactText(options.semanticClass)

  if (!pool) {
    return { configured: false, ok: true, cityId, selections: [], groups: [], error: null }
  }

  const values = [cityId, limit]
  let statusSql = ''
  let semanticClassSql = ''
  if (status) {
    values.push(status)
    statusSql = `AND status = $${values.length}`
  }
  if (semanticClass) {
    values.push(semanticClass)
    semanticClassSql = `AND $${values.length} = ANY(semantic_classes)`
  }

  try {
    const [selectionsResult, groupsResult] = await Promise.all([
      pool.query(
        `
          SELECT *
          FROM ldt_analysis.selection_sets
          WHERE city_id = $1
            ${statusSql}
            ${semanticClassSql}
          ORDER BY updated_at DESC
          LIMIT $2
        `,
        values,
      ),
      pool.query(
        `
          SELECT
            query_hash,
            count(*)::int AS run_count,
            max(created_at) AS last_created_at,
            max(updated_at) AS last_updated_at,
            max(result_count)::int AS max_result_count,
            max(returned_count)::int AS max_returned_count,
            (array_agg(title ORDER BY updated_at DESC))[1] AS title,
            (array_agg(semantic_classes ORDER BY updated_at DESC))[1] AS semantic_classes
          FROM ldt_analysis.selection_sets
          WHERE city_id = $1
            ${statusSql}
            ${semanticClassSql}
          GROUP BY query_hash
          ORDER BY max(updated_at) DESC
          LIMIT $2
        `,
        values,
      ),
    ])

    return {
      configured: true,
      ok: true,
      cityId,
      selections: selectionsResult.rows.map(rowToSelectionSet),
      groups: groupsResult.rows.map((row) => ({
        queryHash: row.query_hash,
        runCount: Number(row.run_count ?? 0),
        title: row.title,
        semanticClasses: Array.isArray(row.semantic_classes) ? row.semantic_classes : [],
        maxResultCount: Number(row.max_result_count ?? 0),
        maxReturnedCount: Number(row.max_returned_count ?? 0),
        lastCreatedAt: row.last_created_at?.toISOString?.() ?? row.last_created_at ?? null,
        lastUpdatedAt: row.last_updated_at?.toISOString?.() ?? row.last_updated_at ?? null,
      })),
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      selections: [],
      groups: [],
      error: String(error?.message ?? 'ANALYSIS_SELECTIONS_UNAVAILABLE'),
    }
  }
}

export async function getAnalysisSelection(cityId, selectionId, options = {}) {
  const pool = getProductionPool()
  if (!pool) {
    return { configured: false, ok: true, cityId, selection: null, members: [], error: null }
  }

  try {
    const result = await pool.query(
      `
        SELECT *
        FROM ldt_analysis.selection_sets
        WHERE city_id = $1
          AND id = $2
        LIMIT 1
      `,
      [cityId, selectionId],
    )

    if (!result.rowCount) {
      return {
        configured: true,
        ok: false,
        cityId,
        selection: null,
        members: [],
        error: 'ANALYSIS_SELECTION_NOT_FOUND',
      }
    }

    const members = options.includeMembers
      ? (await listAnalysisSelectionMembers(cityId, selectionId, options)).members
      : []

    return {
      configured: true,
      ok: true,
      cityId,
      selection: rowToSelectionSet(result.rows[0]),
      members,
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      selection: null,
      members: [],
      error: String(error?.message ?? 'ANALYSIS_SELECTION_UNAVAILABLE'),
    }
  }
}

export async function listAnalysisSelectionMembers(cityId, selectionId, options = {}) {
  const pool = getProductionPool()
  const limit = clampLimit(options.limit, DEFAULT_MEMBER_LIMIT, 10000)
  const offset = normalizeOffset(options.offset)

  if (!pool) {
    return { configured: false, ok: true, cityId, selectionId, members: [], summary: { limit, offset }, error: null }
  }

  try {
    const result = await pool.query(
      `
        SELECT
          member.*,
          ST_AsGeoJSON(member.sample_point)::jsonb AS sample_point_geojson
        FROM ldt_analysis.selection_set_members member
        JOIN ldt_analysis.selection_sets selection
          ON selection.id = member.selection_set_id
        WHERE selection.city_id = $1
          AND selection.id = $2
        ORDER BY member.rank ASC
        LIMIT $3
        OFFSET $4
      `,
      [cityId, selectionId, limit, offset],
    )

    const countResult = await pool.query(
      `
        SELECT count(*)::int AS count
        FROM ldt_analysis.selection_set_members member
        JOIN ldt_analysis.selection_sets selection
          ON selection.id = member.selection_set_id
        WHERE selection.city_id = $1
          AND selection.id = $2
      `,
      [cityId, selectionId],
    )

    return {
      configured: true,
      ok: true,
      cityId,
      selectionId,
      members: result.rows.map(rowToSelectionMember),
      summary: {
        total: Number(countResult.rows[0]?.count ?? 0),
        returned: result.rows.length,
        limit,
        offset,
      },
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      selectionId,
      members: [],
      summary: { total: 0, returned: 0, limit, offset },
      error: String(error?.message ?? 'ANALYSIS_SELECTION_MEMBERS_UNAVAILABLE'),
    }
  }
}

function comparisonSql(operation) {
  if (operation === 'intersection') {
    return 'SELECT object_id FROM left_members INTERSECT SELECT object_id FROM right_members'
  }
  if (operation === 'difference') {
    return 'SELECT object_id FROM left_members EXCEPT SELECT object_id FROM right_members'
  }
  if (operation === 'symmetric_difference') {
    return `
      (SELECT object_id FROM left_members EXCEPT SELECT object_id FROM right_members)
      UNION
      (SELECT object_id FROM right_members EXCEPT SELECT object_id FROM left_members)
    `
  }
  return 'SELECT object_id FROM left_members UNION SELECT object_id FROM right_members'
}

export async function compareAnalysisSelections(cityId, input = {}) {
  const pool = getProductionPool()
  const leftSelectionId = input.leftSelectionId ?? input.left_selection_id
  const rightSelectionId = input.rightSelectionId ?? input.right_selection_id
  const operation = compactText(input.operation, 'intersection')

  if (!['union', 'intersection', 'difference', 'symmetric_difference'].includes(operation)) {
    return {
      configured: Boolean(pool),
      ok: false,
      cityId,
      comparison: null,
      error: `UNSUPPORTED_SELECTION_COMPARISON:${operation}`,
    }
  }

  if (!pool) {
    return { configured: false, ok: true, cityId, comparison: null, error: null }
  }

  try {
    const result = await pool.query(
      `
        WITH left_members AS (
          SELECT member.object_id
          FROM ldt_analysis.selection_set_members member
          JOIN ldt_analysis.selection_sets selection
            ON selection.id = member.selection_set_id
          WHERE selection.city_id = $1
            AND selection.id = $2
        ),
        right_members AS (
          SELECT member.object_id
          FROM ldt_analysis.selection_set_members member
          JOIN ldt_analysis.selection_sets selection
            ON selection.id = member.selection_set_id
          WHERE selection.city_id = $1
            AND selection.id = $3
        ),
        result_members AS (
          ${comparisonSql(operation)}
        ),
        summary AS (
          SELECT
            count(*)::int AS result_count,
            COALESCE(array_agg(object_id ORDER BY object_id) FILTER (WHERE sample_rank <= 100), ARRAY[]::text[]) AS sample_object_ids
          FROM (
            SELECT
              object_id,
              row_number() OVER (ORDER BY object_id) AS sample_rank
            FROM result_members
          ) ranked
        )
        INSERT INTO ldt_analysis.selection_comparisons (
          city_id,
          left_selection_id,
          right_selection_id,
          operation,
          result_count,
          sample_object_ids,
          metrics,
          created_by
        )
        SELECT
          $1,
          $2,
          $3,
          $4::text,
          result_count,
          sample_object_ids,
          jsonb_build_object(
            'operation', $4::text,
            'sampleSize', cardinality(sample_object_ids)
          ),
          $5
        FROM summary
        RETURNING *
      `,
      [
        cityId,
        leftSelectionId,
        rightSelectionId,
        operation,
        input.createdBy ?? input.actorUserId ?? null,
      ],
    )

    const row = result.rows[0]
    return {
      configured: true,
      ok: true,
      cityId,
      comparison: {
        id: row.id,
        cityId: row.city_id,
        leftSelectionId: row.left_selection_id,
        rightSelectionId: row.right_selection_id,
        operation: row.operation,
        resultCount: Number(row.result_count ?? 0),
        sampleObjectIds: Array.isArray(row.sample_object_ids) ? row.sample_object_ids : [],
        metrics: parseMaybeJson(row.metrics, {}),
        createdBy: row.created_by,
        createdAt: row.created_at?.toISOString?.() ?? row.created_at ?? null,
      },
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      comparison: null,
      error: String(error?.message ?? 'ANALYSIS_SELECTION_COMPARISON_FAILED'),
    }
  }
}
