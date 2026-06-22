import crypto from 'node:crypto'
import { getProductionPool } from '../postgisPool.mjs'
import { compactText, json, parseMaybeJson, textArray } from './repositoryUtils.mjs'

const DEFAULT_SHARE_LIMIT = 50
const MAX_SHARE_LIMIT = 200
const SURFACES = new Set(['map', 'municipal3d', 'immersive'])
const ACCESS_POLICIES = new Set(['session', 'signed-token', 'public'])
const PUBLICATION_STATUSES = new Set(['draft', 'published', 'retired'])

function clampInteger(value, fallback, min, max) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function normalizeSurface(value, fallback = 'map') {
  const surface = String(value ?? '').trim()
  if (SURFACES.has(surface)) return surface
  if (surface === '3d' || surface === 'municipal') return 'municipal3d'
  if (surface === 'public' || surface === 'story') return 'immersive'
  return fallback
}

function normalizeStatus(value, fallback = 'draft') {
  const status = String(value ?? '').trim()
  return PUBLICATION_STATUSES.has(status) ? status : fallback
}

function normalizeAccessPolicy(value, fallback = 'session') {
  const policy = String(value ?? '').trim()
  return ACCESS_POLICIES.has(policy) ? policy : fallback
}

function shareKey() {
  return crypto.randomBytes(9).toString('base64url')
}

function rowToShare(row) {
  if (!row) return null
  return {
    id: row.id,
    cityId: row.city_id,
    shareKey: row.share_key,
    surface: row.surface,
    mode: row.mode,
    title: row.title,
    description: row.description,
    accessPolicy: row.access_policy,
    publicationStatus: row.publication_status,
    layerKeys: Array.isArray(row.layer_keys) ? row.layer_keys : [],
    selectionScope: row.selection_scope,
    selection: parseMaybeJson(row.selection_payload, {}),
    manifest: parseMaybeJson(row.manifest, {}),
    createdBy: row.created_by,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

export async function listVisualShareManifests(cityId, options = {}) {
  const pool = getProductionPool()
  const surface = options.surface ? normalizeSurface(options.surface, '') : ''
  const status = options.status ? normalizeStatus(options.status, '') : ''
  const mode = compactText(options.mode)
  const limit = clampInteger(options.limit, DEFAULT_SHARE_LIMIT, 1, MAX_SHARE_LIMIT)

  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      shares: [],
      summary: { total: 0 },
      error: null,
    }
  }

  try {
    const result = await pool.query(
      `
        SELECT *
        FROM ldt_viewer.visual_share_manifests
        WHERE city_id = $1
          AND ($2::text = '' OR surface = $2)
          AND ($3::text = '' OR publication_status = $3)
          AND ($4::text = '' OR mode = $4)
        ORDER BY updated_at DESC, created_at DESC
        LIMIT $5
      `,
      [cityId, surface, status, mode, limit],
    )
    return {
      configured: true,
      ok: true,
      cityId,
      generatedAt: new Date().toISOString(),
      shares: result.rows.map(rowToShare),
      summary: {
        total: result.rowCount,
        limit,
        surface: surface || null,
        status: status || null,
        mode: mode || null,
      },
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      shares: [],
      summary: { total: 0 },
      error: String(error?.message ?? 'UNKNOWN_SHARE_MANIFEST_LIST_ERROR'),
    }
  }
}

export async function getVisualShareManifest(cityId, shareKeyValue) {
  const pool = getProductionPool()
  const normalizedShareKey = compactText(shareKeyValue)

  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      share: null,
      error: null,
    }
  }

  try {
    const result = await pool.query(
      `
        SELECT *
        FROM ldt_viewer.visual_share_manifests
        WHERE city_id = $1
          AND share_key = $2
        LIMIT 1
      `,
      [cityId, normalizedShareKey],
    )
    return {
      configured: true,
      ok: Boolean(result.rows[0]),
      cityId,
      share: rowToShare(result.rows[0]),
      error: result.rows[0] ? null : 'SHARE_MANIFEST_NOT_FOUND',
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      share: null,
      error: String(error?.message ?? 'UNKNOWN_SHARE_MANIFEST_GET_ERROR'),
    }
  }
}

export async function createVisualShareManifest(cityId, payload = {}) {
  const pool = getProductionPool()
  const surface = normalizeSurface(payload.surface)
  const mode = compactText(payload.mode, surface === 'immersive' ? 'public-share' : 'embedded-analyst')
  const title = compactText(payload.title, `${cityId} ${surface} share`)
  const description = compactText(payload.description)
  const accessPolicy = normalizeAccessPolicy(payload.accessPolicy ?? payload.access_policy)
  const publicationStatus = normalizeStatus(payload.publicationStatus ?? payload.publication_status)
  const layerKeys = textArray(payload.layerKeys ?? payload.layer_keys)
  const selection = payload.selection && typeof payload.selection === 'object' ? payload.selection : {}
  const selectionScope = compactText(payload.selectionScope ?? payload.selection_scope ?? selection.scope)
  const manifest = payload.manifest && typeof payload.manifest === 'object' ? payload.manifest : {}
  const createdBy = compactText(payload.createdBy ?? payload.created_by)
  const expiresAt = compactText(payload.expiresAt ?? payload.expires_at)

  if (!pool) {
    return {
      configured: false,
      ok: false,
      cityId,
      share: null,
      error: 'DATABASE_NOT_CONFIGURED',
    }
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO ldt_viewer.visual_share_manifests (
          city_id,
          share_key,
          surface,
          mode,
          title,
          description,
          access_policy,
          publication_status,
          layer_keys,
          selection_scope,
          selection_payload,
          manifest,
          created_by,
          expires_at,
          published_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, $11::jsonb,
          $12::jsonb, $13, NULLIF($14, '')::timestamptz,
          CASE WHEN $8 = 'published' THEN now() ELSE NULL END,
          now()
        )
        RETURNING *
      `,
      [
        cityId,
        shareKey(),
        surface,
        mode,
        title,
        description,
        accessPolicy,
        publicationStatus,
        layerKeys,
        selectionScope || null,
        json(selection),
        json(manifest),
        createdBy || null,
        expiresAt || '',
      ],
    )
    return {
      configured: true,
      ok: true,
      cityId,
      share: rowToShare(result.rows[0]),
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      share: null,
      error: String(error?.message ?? 'UNKNOWN_SHARE_MANIFEST_CREATE_ERROR'),
    }
  }
}

export async function updateVisualShareManifestPublication(cityId, shareKeyValue, payload = {}) {
  const pool = getProductionPool()
  const normalizedShareKey = compactText(shareKeyValue)
  const accessPolicy = normalizeAccessPolicy(payload.accessPolicy ?? payload.access_policy, 'signed-token')
  const publicationStatus = normalizeStatus(payload.publicationStatus ?? payload.publication_status, 'published')
  const title = compactText(payload.title)
  const description = compactText(payload.description)
  const expiresAt = compactText(payload.expiresAt ?? payload.expires_at)
  const manifestPatch =
    payload.manifestPatch && typeof payload.manifestPatch === 'object'
      ? payload.manifestPatch
      : {}

  if (!pool) {
    return {
      configured: false,
      ok: false,
      cityId,
      share: null,
      error: 'DATABASE_NOT_CONFIGURED',
    }
  }

  if (!normalizedShareKey) {
    return {
      configured: true,
      ok: false,
      cityId,
      share: null,
      error: 'SHARE_KEY_REQUIRED',
    }
  }

  try {
    const result = await pool.query(
      `
        UPDATE ldt_viewer.visual_share_manifests
        SET access_policy = $3,
            publication_status = $4,
            title = COALESCE(NULLIF($5, ''), title),
            description = COALESCE(NULLIF($6, ''), description),
            expires_at = NULLIF($7, '')::timestamptz,
            manifest = manifest || $8::jsonb,
            published_at = CASE
              WHEN $4 = 'published' THEN COALESCE(published_at, now())
              ELSE published_at
            END,
            updated_at = now()
        WHERE city_id = $1
          AND share_key = $2
        RETURNING *
      `,
      [
        cityId,
        normalizedShareKey,
        accessPolicy,
        publicationStatus,
        title,
        description,
        expiresAt,
        json(manifestPatch),
      ],
    )
    return {
      configured: true,
      ok: Boolean(result.rows[0]),
      cityId,
      share: rowToShare(result.rows[0]),
      error: result.rows[0] ? null : 'SHARE_MANIFEST_NOT_FOUND',
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      share: null,
      error: String(error?.message ?? 'UNKNOWN_SHARE_MANIFEST_UPDATE_ERROR'),
    }
  }
}
