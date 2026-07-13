import { getProductionPool } from '../../db/postgisPool.mjs'

function acceptanceRow(row = {}) {
  return {
    id: row.case_key,
    key: row.case_key,
    cityId: row.city_id,
    title: row.title,
    label: row.title,
    description: row.use_case,
    mode: 'builder',
    language: 'twinql-json',
    classes: [row.base_semantic_class || 'buildings'],
    builder: row.builder ?? {},
    query: row.twin_query ?? {},
    sqlText: row.sql_text ?? '',
    tags: [
      'indicator-acceptance',
      row.catalog_key,
      row.dimension,
      row.subdimension,
      row.query_pattern,
    ].filter(Boolean),
    acceptance: {
      catalogKey: row.catalog_key,
      indicatorKey: row.indicator_key,
      externalCode: row.external_code,
      dimension: row.dimension,
      subdimension: row.subdimension,
      pattern: row.query_pattern,
      expectedResultCount: row.expected_result_count,
      builderResultCount: row.builder_result_count,
      sqlResultCount: row.sql_result_count,
      localStatus: row.local_status,
      dataPlatformStatus: row.data_platform_status,
      cipStatus: row.cip_status,
      roundtripStatus: row.roundtrip_status,
      evidence: row.evidence ?? {},
      externalEvidence: row.external_evidence ?? {},
      lastRunAt: row.last_run_at,
    },
  }
}

export async function listIndicatorAcceptancePresets(cityId, options = {}) {
  const pool = getProductionPool()
  if (!pool) return { ok: true, presets: [], summary: {}, error: null }
  const catalogKey = String(options.catalogKey || 'u4ssc').trim()
  const limit = Math.min(500, Math.max(1, Number(options.limit || 200)))
  try {
    const [rows, summary] = await Promise.all([
      pool.query(`
        SELECT *
        FROM ldt_query.indicator_acceptance_presets
        WHERE city_id=$1 AND catalog_key=$2
        ORDER BY dimension, subdimension, external_code, case_key
        LIMIT $3
      `, [cityId, catalogKey, limit]),
      pool.query(`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE local_status='passed')::int AS local_passed,
          count(*) FILTER (WHERE data_platform_status='passed')::int AS data_platform_passed,
          count(*) FILTER (WHERE cip_status='passed')::int AS cip_passed,
          count(*) FILTER (WHERE roundtrip_status='passed')::int AS roundtrip_passed,
          max(last_run_at) AS last_run_at
        FROM ldt_query.indicator_acceptance_presets
        WHERE city_id=$1 AND catalog_key=$2
      `, [cityId, catalogKey]),
    ])
    const row = summary.rows[0] ?? {}
    return {
      ok: true,
      presets: rows.rows.map(acceptanceRow),
      summary: {
        total: Number(row.total ?? 0),
        localPassed: Number(row.local_passed ?? 0),
        dataPlatformPassed: Number(row.data_platform_passed ?? 0),
        cipPassed: Number(row.cip_passed ?? 0),
        roundtripPassed: Number(row.roundtrip_passed ?? 0),
        lastRunAt: row.last_run_at ?? null,
      },
      error: null,
    }
  } catch (error) {
    if (error?.code === '42P01') return { ok: true, presets: [], summary: {}, error: null }
    return { ok: false, presets: [], summary: {}, error: String(error?.message ?? error) }
  }
}
