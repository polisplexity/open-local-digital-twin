import { getProductionPool } from '../postgisPool.mjs'
import { upsertCityFromConfig } from './cityRepository.mjs'
import { compactText, json, parseMaybeJson, slug } from './repositoryUtils.mjs'

export async function listCityLayerRegistry(cityId) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      layers: [],
      error: null,
    }
  }

  try {
    const result = await pool.query(
      `
        SELECT
          ld.id,
          ld.key,
          ld.name,
          ld.layer_family,
          ld.geometry_type,
          ld.authority_status,
          ld.access_level,
          ld.source_license,
          ld.update_frequency,
          ld.semantic_status,
          ld.metadata,
          ld.updated_at,
          p.id AS provider_id,
          p.name AS provider_name,
          count(DISTINCT cf.id)::int AS feature_count,
          max(lij.created_at) AS latest_job_at
        FROM layer_definitions ld
        LEFT JOIN providers p ON p.id = ld.provider_id
        LEFT JOIN city_features cf ON cf.layer_id = ld.id
        LEFT JOIN layer_ingestion_jobs lij ON lij.layer_id = ld.id
        WHERE ld.city_id = $1
        GROUP BY ld.id, p.id
        ORDER BY ld.layer_family ASC, ld.key ASC
      `,
      [cityId],
    )
    return {
      configured: true,
      ok: true,
      cityId,
      layers: result.rows.map((row) => ({
        id: row.id,
        key: row.key,
        name: row.name,
        layerFamily: row.layer_family,
        geometryType: row.geometry_type,
        authorityStatus: row.authority_status,
        accessLevel: row.access_level,
        sourceLicense: row.source_license,
        updateFrequency: row.update_frequency,
        semanticStatus: row.semantic_status,
        metadata: parseMaybeJson(row.metadata, {}),
        provider: row.provider_id ? { id: row.provider_id, name: row.provider_name } : null,
        featureCount: Number(row.feature_count ?? 0),
        latestJobAt: row.latest_job_at,
        updatedAt: row.updated_at,
      })),
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      layers: [],
      error: String(error?.message ?? 'UNKNOWN_LAYER_REGISTRY_ERROR'),
    }
  } finally {
  }
}

export async function upsertCityProviderLayer(cityConfig, layer = {}) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  const layerKey = slug(layer.key ?? layer.name, '')
  if (!layerKey) {
    throw new Error('LAYER_KEY_REQUIRED')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const cityId = await upsertCityFromConfig(client, cityConfig)
    const providerId = compactText(layer.providerId ?? layer.provider_id) || null
    if (providerId) {
      await client.query(
        `
          INSERT INTO providers (id, name, provider_type, metadata, updated_at)
          VALUES ($1, $2, 'data-provider', '{}'::jsonb, now())
          ON CONFLICT (id) DO NOTHING
        `,
        [providerId, providerId],
      )
    }

    const result = await client.query(
      `
        INSERT INTO layer_definitions (
          city_id, provider_id, key, name, layer_family, geometry_type,
          authority_status, access_level, source_license, update_frequency,
          semantic_status, metadata, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, now())
        ON CONFLICT (city_id, key) DO UPDATE SET
          provider_id = excluded.provider_id,
          name = excluded.name,
          layer_family = excluded.layer_family,
          geometry_type = excluded.geometry_type,
          authority_status = excluded.authority_status,
          access_level = excluded.access_level,
          source_license = excluded.source_license,
          update_frequency = excluded.update_frequency,
          semantic_status = excluded.semantic_status,
          metadata = excluded.metadata,
          updated_at = now()
        RETURNING id
      `,
      [
        cityId,
        providerId,
        layerKey,
        compactText(layer.name, layerKey),
        compactText(layer.layerFamily ?? layer.layer_family, 'provider-layer'),
        compactText(layer.geometryType ?? layer.geometry_type, 'Geometry'),
        compactText(layer.authorityStatus ?? layer.authority_status, 'provider-supplied'),
        compactText(layer.accessLevel ?? layer.access_level, 'city-private'),
        compactText(layer.sourceLicense ?? layer.source_license) || null,
        compactText(layer.updateFrequency ?? layer.update_frequency, 'provider-managed'),
        compactText(layer.semanticStatus ?? layer.semantic_status, 'provider-layer'),
        json(layer.metadata ?? {}),
      ],
    )
    await client.query('COMMIT')
    return {
      configured: true,
      ok: true,
      cityId,
      layerId: result.rows[0].id,
      layerKey,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function acceptCityLayerAuthority(cityConfig, layerKey, options = {}) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  const normalizedLayerKey = slug(layerKey ?? options.layerKey ?? options.layer_key, '')
  if (!normalizedLayerKey) {
    throw new Error('LAYER_KEY_REQUIRED')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const cityId = await upsertCityFromConfig(client, cityConfig)
    const metadata = {
      cityAuthority: {
        status: 'accepted',
        authorityStatus: 'city-authoritative',
        acceptedAt: new Date().toISOString(),
        acceptedBy: compactText(options.acceptedBy ?? options.accepted_by, 'admin-api'),
        evidenceUri: compactText(options.evidenceUri ?? options.evidence_uri) || null,
        evidenceLabel: compactText(options.evidenceLabel ?? options.evidence_label) || null,
        note: compactText(options.note) || null,
      },
    }

    const existing = await client.query(
      'SELECT id FROM layer_definitions WHERE city_id = $1 AND key = $2',
      [cityId, normalizedLayerKey],
    )

    let layerId
    if (existing.rowCount === 0) {
      if (options.createIfMissing === false || options.create_if_missing === false) {
        throw new Error('LAYER_NOT_REGISTERED')
      }
      const created = await client.query(
        `
          INSERT INTO layer_definitions (
            city_id, provider_id, key, name, layer_family, geometry_type,
            authority_status, access_level, source_license, update_frequency,
            semantic_status, metadata, updated_at
          )
          VALUES ($1, NULL, $2, $3, $4, $5, 'city-authoritative', $6, $7, $8, $9, $10::jsonb, now())
          RETURNING id
        `,
        [
          cityId,
          normalizedLayerKey,
          compactText(options.name, normalizedLayerKey),
          compactText(options.layerFamily ?? options.layer_family, 'city-authority'),
          compactText(options.geometryType ?? options.geometry_type, 'Geometry'),
          compactText(options.accessLevel ?? options.access_level, 'city-private'),
          compactText(options.sourceLicense ?? options.source_license) || null,
          compactText(options.updateFrequency ?? options.update_frequency, 'city-managed'),
          compactText(options.semanticStatus ?? options.semantic_status, 'city-authoritative'),
          json({
            ...(options.metadata ?? {}),
            ...metadata,
          }),
        ],
      )
      layerId = created.rows[0].id
    } else {
      const updated = await client.query(
        `
          UPDATE layer_definitions
          SET authority_status = 'city-authoritative',
            access_level = COALESCE($3, access_level),
            semantic_status = COALESCE($4, semantic_status),
            metadata = metadata || $5::jsonb,
            updated_at = now()
          WHERE city_id = $1 AND key = $2
          RETURNING id
        `,
        [
          cityId,
          normalizedLayerKey,
          compactText(options.accessLevel ?? options.access_level) || null,
          compactText(options.semanticStatus ?? options.semantic_status) || null,
          json({
            ...(options.metadata ?? {}),
            ...metadata,
          }),
        ],
      )
      layerId = updated.rows[0].id
    }

    await client.query('COMMIT')
    return {
      configured: true,
      ok: true,
      cityId,
      layerKey: normalizedLayerKey,
      layerId,
      authorityStatus: 'city-authoritative',
      acceptedBy: metadata.cityAuthority.acceptedBy,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
