import { getProductionPool } from '../postgisPool.mjs'

export async function getCityProductionStorageSummary(cityId) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      layers: [],
      totals: {
        features: 0,
        ingestionRuns: 0,
      },
      error: null,
    }
  }

  try {
    const [city, layers, runs, artifacts, boundaries] = await Promise.all([
      pool.query(
        `
          SELECT id, name, country, country_code, region,
            ST_X(centroid) AS lon,
            ST_Y(centroid) AS lat,
            updated_at
          FROM cities
          WHERE id = $1
        `,
        [cityId],
      ),
      pool.query(
        `
          SELECT
            ld.key,
            ld.name,
            ld.layer_family,
            ld.semantic_status,
            count(cf.id)::int AS feature_count,
            min(cf.updated_at) AS oldest_feature_at,
            max(cf.updated_at) AS newest_feature_at
          FROM layer_definitions ld
          LEFT JOIN city_features cf ON cf.layer_id = ld.id
          WHERE ld.city_id = $1
          GROUP BY ld.id
          ORDER BY ld.key ASC
        `,
        [cityId],
      ),
      pool.query(
        `
          SELECT id, source_name, status, started_at, finished_at, stats
          FROM ingestion_runs
          WHERE city_id = $1
          ORDER BY started_at DESC
          LIMIT 5
        `,
        [cityId],
      ),
      pool.query(
        `
          SELECT source_kind, count(*)::int AS count, max(fetched_at) AS newest_artifact_at
          FROM source_artifacts
          WHERE city_id = $1
          GROUP BY source_kind
          ORDER BY source_kind ASC
        `,
        [cityId],
      ),
      pool.query(
        `
          SELECT count(*)::int AS count, max(created_at) AS newest_boundary_at
          FROM city_boundaries
          WHERE city_id = $1
        `,
        [cityId],
      ),
    ])

    const featureTotal = layers.rows.reduce((sum, row) => sum + Number(row.feature_count ?? 0), 0)
    return {
      configured: true,
      ok: true,
      cityId,
      city: city.rows[0] ?? null,
      layers: layers.rows,
      recentRuns: runs.rows,
      sourceArtifacts: artifacts.rows,
      boundaries: {
        count: Number(boundaries.rows[0]?.count ?? 0),
        newestBoundaryAt: boundaries.rows[0]?.newest_boundary_at ?? null,
      },
      totals: {
        features: featureTotal,
        ingestionRuns: runs.rows.length,
        sourceArtifacts: artifacts.rows.reduce((sum, row) => sum + Number(row.count ?? 0), 0),
        boundaries: Number(boundaries.rows[0]?.count ?? 0),
      },
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      layers: [],
      totals: {
        features: 0,
        ingestionRuns: 0,
      },
      error: String(error?.message ?? 'UNKNOWN_STORAGE_SUMMARY_ERROR'),
    }
  } finally {
  }
}
