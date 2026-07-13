import { getProductionPool } from '../postgisPool.mjs'
import { resolveRuntimeDataPath } from './runtimePathResolver.mjs'

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

function artifactFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    cityId: row.city_id,
    artifactKey: row.artifact_key,
    artifactType: row.artifact_type,
    transport: row.transport,
    version: row.version,
    status: row.status,
    contentState: row.content_state,
    active: Boolean(row.active),
    sourceScope: parseJson(row.source_scope, {}),
    generator: row.generator,
    checksum: row.checksum,
    byteSize: Number(row.byte_size ?? 0),
    featureCount: Number(row.feature_count ?? 0),
    objectCount: Number(row.object_count ?? 0),
    tileCount: Number(row.tile_count ?? 0),
    bounds: parseJson(row.bounds, {}),
    uri: row.uri,
    localPath: resolveRuntimeDataPath(row.local_path),
    mediaType: row.media_type,
    metadata: parseJson(row.metadata, {}),
    invalidationSource: row.invalidation_source,
    generatedAt: row.generated_at,
    activatedAt: row.activated_at,
    updatedAt: row.updated_at,
  }
}

export async function upsertViewerArtifactRecord(record, { client = null, activate = false } = {}) {
  const runner = client ?? requirePool()
  const status = record.status ?? 'ready'
  const shouldActivate = Boolean((activate || record.active) && status === 'ready')
  if (shouldActivate) {
    await runner.query(`
      UPDATE ldt_viewer.viewer_artifacts
      SET active = false, updated_at = now()
      WHERE city_id = $1
        AND artifact_key = $2
        AND artifact_type = $3
        AND active = true
    `, [record.cityId, record.artifactKey, record.artifactType])
  }

  const result = await runner.query(`
    INSERT INTO ldt_viewer.viewer_artifacts (
      city_id,
      artifact_key,
      artifact_type,
      transport,
      version,
      status,
      content_state,
      active,
      source_scope,
      generator,
      checksum,
      byte_size,
      feature_count,
      object_count,
      tile_count,
      bounds,
      uri,
      local_path,
      media_type,
      metadata,
      invalidation_source,
      generated_at,
      activated_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9::jsonb, $10, $11, $12, $13, $14, $15,
      $16::jsonb, $17, $18, $19, $20::jsonb, $21,
      COALESCE($22::timestamptz, now()),
      CASE WHEN $8 THEN now() ELSE NULL END,
      now()
    )
    ON CONFLICT (city_id, artifact_key, artifact_type, version)
    DO UPDATE SET
      transport = EXCLUDED.transport,
      status = EXCLUDED.status,
      content_state = EXCLUDED.content_state,
      active = CASE
        WHEN EXCLUDED.active THEN true
        ELSE ldt_viewer.viewer_artifacts.active
      END,
      source_scope = EXCLUDED.source_scope,
      generator = EXCLUDED.generator,
      checksum = EXCLUDED.checksum,
      byte_size = EXCLUDED.byte_size,
      feature_count = EXCLUDED.feature_count,
      object_count = EXCLUDED.object_count,
      tile_count = EXCLUDED.tile_count,
      bounds = EXCLUDED.bounds,
      uri = EXCLUDED.uri,
      local_path = EXCLUDED.local_path,
      media_type = EXCLUDED.media_type,
      metadata = EXCLUDED.metadata,
      invalidation_source = EXCLUDED.invalidation_source,
      activated_at = CASE WHEN EXCLUDED.active THEN COALESCE(ldt_viewer.viewer_artifacts.activated_at, now()) ELSE ldt_viewer.viewer_artifacts.activated_at END,
      updated_at = now()
    RETURNING *
  `, [
    record.cityId,
    record.artifactKey,
    record.artifactType,
    record.transport,
    record.version,
    status,
    record.contentState ?? 'generated',
    shouldActivate,
    JSON.stringify(record.sourceScope ?? {}),
    record.generator ?? 'unknown',
    record.checksum ?? null,
    Number(record.byteSize ?? 0),
    Number(record.featureCount ?? 0),
    Number(record.objectCount ?? 0),
    Number(record.tileCount ?? 0),
    JSON.stringify(record.bounds ?? {}),
    record.uri,
    record.localPath ?? null,
    record.mediaType ?? null,
    JSON.stringify(record.metadata ?? {}),
    record.invalidationSource ?? null,
    record.generatedAt ?? null,
  ])

  return artifactFromRow(result.rows[0])
}

export async function listViewerArtifactRecords(cityId, options = {}) {
  const pool = requirePool()
  const limit = Math.min(250, Math.max(1, Math.trunc(Number(options.limit ?? 50)) || 50))
  const params = [cityId]
  const where = ['city_id = $1']
  if (options.artifactType) {
    params.push(String(options.artifactType))
    where.push(`artifact_type = $${params.length}`)
  }
  if (options.artifactKey) {
    params.push(String(options.artifactKey))
    where.push(`artifact_key = $${params.length}`)
  }
  if (options.transport) {
    params.push(String(options.transport))
    where.push(`transport = $${params.length}`)
  }
  if (options.version) {
    params.push(String(options.version))
    where.push(`version = $${params.length}`)
  }
  if (options.status) {
    params.push(String(options.status))
    where.push(`status = $${params.length}`)
  }
  if (options.active !== undefined) {
    params.push(Boolean(options.active))
    where.push(`active = $${params.length}`)
  }
  params.push(limit)

  const result = await pool.query(`
    SELECT *
    FROM ldt_viewer.viewer_artifacts
    WHERE ${where.join(' AND ')}
    ORDER BY active DESC, generated_at DESC, updated_at DESC
    LIMIT $${params.length}
  `, params)

  return result.rows.map(artifactFromRow)
}

export async function activateViewerArtifactRecord(cityId, { artifactKey, artifactType, version }) {
  const pool = requirePool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`
      UPDATE ldt_viewer.viewer_artifacts
      SET active = false, updated_at = now()
      WHERE city_id = $1
        AND artifact_key = $2
        AND artifact_type = $3
    `, [cityId, artifactKey, artifactType])
    const result = await client.query(`
      UPDATE ldt_viewer.viewer_artifacts
      SET active = true, activated_at = COALESCE(activated_at, now()), updated_at = now()
      WHERE city_id = $1
        AND artifact_key = $2
        AND artifact_type = $3
        AND version = $4
        AND status = 'ready'
      RETURNING *
    `, [cityId, artifactKey, artifactType, version])
    if (result.rowCount === 0) throw new Error('VIEWER_ARTIFACT_READY_NOT_FOUND')
    await client.query('COMMIT')
    return artifactFromRow(result.rows[0])
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
