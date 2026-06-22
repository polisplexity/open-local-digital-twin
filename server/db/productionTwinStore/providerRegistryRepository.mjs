import { getProductionPool } from '../postgisPool.mjs'
import { compactText, json, parseMaybeJson, slug, textArray } from './repositoryUtils.mjs'

export async function listRegisteredProviders() {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: true,
      providers: [],
      error: null,
    }
  }

  try {
    const result = await pool.query(
      `
        SELECT
          p.id,
          p.name,
          p.provider_type,
          p.website_url,
          p.contact_label,
          p.metadata,
          p.updated_at,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', pc.id,
                'connectorKey', pc.connector_key,
                'displayName', pc.display_name,
                'connectorType', pc.connector_type,
                'status', pc.status,
                'supportedFormats', pc.supported_formats,
                'endpointUrl', pc.endpoint_url,
                'authMode', pc.auth_mode,
                'contract', pc.contract,
                'metadata', pc.metadata,
                'updatedAt', pc.updated_at
              )
              ORDER BY pc.connector_key ASC
            ) FILTER (WHERE pc.id IS NOT NULL),
            '[]'::jsonb
          ) AS connectors
        FROM providers p
        LEFT JOIN provider_connectors pc ON pc.provider_id = p.id
        GROUP BY p.id
        ORDER BY p.name ASC
      `,
    )
    return {
      configured: true,
      ok: true,
      providers: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        providerType: row.provider_type,
        websiteUrl: row.website_url,
        contactLabel: row.contact_label,
        metadata: parseMaybeJson(row.metadata, {}),
        updatedAt: row.updated_at,
        connectors: parseMaybeJson(row.connectors, []),
      })),
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      providers: [],
      error: String(error?.message ?? 'UNKNOWN_PROVIDER_REGISTRY_ERROR'),
    }
  } finally {
  }
}

export async function upsertRegisteredProvider(provider = {}) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  const providerId = slug(provider.id ?? provider.name, '')
  if (!providerId) {
    throw new Error('PROVIDER_ID_REQUIRED')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `
        INSERT INTO providers (
          id, name, provider_type, website_url, contact_label, metadata, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET
          name = excluded.name,
          provider_type = excluded.provider_type,
          website_url = excluded.website_url,
          contact_label = excluded.contact_label,
          metadata = excluded.metadata,
          updated_at = now()
      `,
      [
        providerId,
        compactText(provider.name, providerId),
        compactText(provider.providerType ?? provider.provider_type, 'data-provider'),
        compactText(provider.websiteUrl ?? provider.website_url) || null,
        compactText(provider.contactLabel ?? provider.contact_label) || null,
        json(provider.metadata ?? {}),
      ],
    )

    for (const connector of Array.isArray(provider.connectors) ? provider.connectors : []) {
      const connectorKey = slug(connector.connectorKey ?? connector.connector_key ?? connector.key ?? connector.displayName, '')
      if (!connectorKey) continue
      await client.query(
        `
          INSERT INTO provider_connectors (
            provider_id, connector_key, display_name, connector_type, status,
            supported_formats, endpoint_url, auth_mode, contract, metadata, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, $9::jsonb, $10::jsonb, now())
          ON CONFLICT (provider_id, connector_key) DO UPDATE SET
            display_name = excluded.display_name,
            connector_type = excluded.connector_type,
            status = excluded.status,
            supported_formats = excluded.supported_formats,
            endpoint_url = excluded.endpoint_url,
            auth_mode = excluded.auth_mode,
            contract = excluded.contract,
            metadata = excluded.metadata,
            updated_at = now()
        `,
        [
          providerId,
          connectorKey,
          compactText(connector.displayName ?? connector.display_name, connectorKey),
          compactText(connector.connectorType ?? connector.connector_type, 'api'),
          compactText(connector.status, 'draft'),
          textArray(connector.supportedFormats ?? connector.supported_formats),
          compactText(connector.endpointUrl ?? connector.endpoint_url) || null,
          compactText(connector.authMode ?? connector.auth_mode, 'none'),
          json(connector.contract ?? {}),
          json(connector.metadata ?? {}),
        ],
      )
    }

    await client.query('COMMIT')
    return {
      configured: true,
      ok: true,
      providerId,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
