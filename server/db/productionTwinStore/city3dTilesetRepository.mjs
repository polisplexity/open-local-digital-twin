import { getProductionPool } from '../postgisPool.mjs'

function requirePool() {
  const pool = getProductionPool()
  if (!pool) throw new Error('DATABASE_URL_REQUIRED')
  return pool
}

function parseJson(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function rowToTileset(row) {
  if (!row) return null
  return {
    id: row.id,
    cityId: row.city_id,
    tilesetKey: row.tileset_key,
    version: row.version,
    status: row.status,
    contentState: row.content_state,
    sourceQuery: parseJson(row.source_query, {}),
    semanticClasses: row.semantic_classes ?? [],
    assetRoot: row.asset_root,
    tilesetUrl: row.tileset_url,
    tilesetPath: row.tileset_path,
    featureCount: Number(row.feature_count ?? 0),
    objectCount: Number(row.object_count ?? 0),
    byteSize: Number(row.byte_size ?? 0),
    geometricError: Number(row.geometric_error ?? 0),
    boundingVolume: parseJson(row.bounding_volume, {}),
    metadata: parseJson(row.metadata, {}),
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
  }
}

export async function upsertCity3dTilesetRecord(record, { client = null } = {}) {
  const runner = client ?? requirePool()
  const result = await runner.query(`
    INSERT INTO ldt_viewer.city_3d_tilesets (
      city_id,
      tileset_key,
      version,
      status,
      content_state,
      source_query,
      semantic_classes,
      asset_root,
      tileset_url,
      tileset_path,
      feature_count,
      object_count,
      byte_size,
      geometric_error,
      bounding_volume,
      metadata,
      generated_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6::jsonb, $7::text[], $8, $9, $10,
      $11, $12, $13, $14, $15::jsonb, $16::jsonb, now(), now()
    )
    ON CONFLICT (city_id, tileset_key, version)
    DO UPDATE SET
      status = EXCLUDED.status,
      content_state = EXCLUDED.content_state,
      source_query = EXCLUDED.source_query,
      semantic_classes = EXCLUDED.semantic_classes,
      asset_root = EXCLUDED.asset_root,
      tileset_url = EXCLUDED.tileset_url,
      tileset_path = EXCLUDED.tileset_path,
      feature_count = EXCLUDED.feature_count,
      object_count = EXCLUDED.object_count,
      byte_size = EXCLUDED.byte_size,
      geometric_error = EXCLUDED.geometric_error,
      bounding_volume = EXCLUDED.bounding_volume,
      metadata = EXCLUDED.metadata,
      updated_at = now()
    RETURNING *
  `, [
    record.cityId,
    record.tilesetKey,
    record.version,
    record.status ?? 'ready',
    record.contentState ?? 'generated',
    JSON.stringify(record.sourceQuery ?? {}),
    record.semanticClasses ?? [],
    record.assetRoot,
    record.tilesetUrl,
    record.tilesetPath,
    Number(record.featureCount ?? 0),
    Number(record.objectCount ?? 0),
    Number(record.byteSize ?? 0),
    Number(record.geometricError ?? 0),
    JSON.stringify(record.boundingVolume ?? {}),
    JSON.stringify(record.metadata ?? {}),
  ])

  return rowToTileset(result.rows[0])
}

export async function listCity3dTilesetRecords(cityId, options = {}) {
  const pool = requirePool()
  const limit = Math.min(100, Math.max(1, Math.trunc(Number(options.limit ?? 20)) || 20))
  const params = [cityId]
  let whereSql = 'WHERE city_id = $1'
  if (options.tilesetKey) {
    params.push(String(options.tilesetKey))
    whereSql += ` AND tileset_key = $${params.length}`
  }
  if (options.status) {
    params.push(String(options.status))
    whereSql += ` AND status = $${params.length}`
  }
  params.push(limit)

  const result = await pool.query(`
    SELECT *
    FROM ldt_viewer.city_3d_tilesets
    ${whereSql}
    ORDER BY generated_at DESC, updated_at DESC
    LIMIT $${params.length}
  `, params)

  return result.rows.map(rowToTileset)
}

