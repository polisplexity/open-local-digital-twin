import { createHash, randomBytes } from 'node:crypto'

import { withClient } from './dbUtils.mjs'

function textValue(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function safeKey(value, fallback = 'data-space-package') {
  return textValue(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback
}

function publicPackage(row = {}) {
  return {
    id: row.id,
    packageKey: row.package_key,
    cityId: row.city_id,
    workflowRunId: row.workflow_run_id,
    integrationProfileKey: row.integration_profile_key,
    title: row.title,
    description: row.description,
    licence: row.licence,
    format: row.format,
    fileName: row.file_name,
    mediaType: row.media_type,
    byteSize: Number(row.byte_size ?? 0),
    sha256: row.sha256,
    sourceQuery: row.source_query ?? {},
    manifest: row.manifest ?? {},
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function publicReceipt(row = {}) {
  return {
    id: row.id,
    packageId: row.package_id,
    workflowRunId: row.workflow_run_id,
    status: row.status,
    mediaType: row.media_type,
    byteSize: row.byte_size == null ? null : Number(row.byte_size),
    sha256: row.sha256,
    headers: row.headers ?? {},
    receivedAt: row.received_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function selectedHeaders(headers = {}) {
  const allowed = ['content-type', 'content-length', 'user-agent', 'x-request-id']
  return Object.fromEntries(allowed
    .map((key) => [key, textValue(headers[key])])
    .filter(([, value]) => value))
}

export async function createDataSpaceAssetPackage(client, input = {}) {
  const workflowRunId = textValue(input.workflowRunId ?? input.workflow_run_id)
  if (!workflowRunId) throw new Error('DATA_SPACE_WORKFLOW_RUN_ID_REQUIRED')
  const existing = await client.query(
    'SELECT * FROM ldt_interop.data_space_asset_packages WHERE workflow_run_id = $1 LIMIT 1',
    [workflowRunId],
  )
  if (existing.rowCount) {
    return {
      package: publicPackage(existing.rows[0]),
      accessToken: existing.rows[0].access_token,
      content: existing.rows[0].content,
      existing: true,
    }
  }

  const content = typeof input.content === 'string' ? input.content : JSON.stringify(input.content ?? {})
  const sha256 = createHash('sha256').update(content).digest('hex')
  const packageKey = safeKey(input.packageKey ?? input.package_key, `${input.cityId}-data-space-${sha256.slice(0, 16)}`)
  const accessToken = randomBytes(24).toString('hex')
  const result = await client.query(
    `
      INSERT INTO ldt_interop.data_space_asset_packages (
        package_key,
        city_id,
        workflow_run_id,
        integration_profile_key,
        title,
        description,
        licence,
        format,
        file_name,
        media_type,
        content,
        byte_size,
        sha256,
        access_token,
        source_query,
        manifest,
        status,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb, 'packaged', $17)
      RETURNING *
    `,
    [
      packageKey,
      input.cityId,
      workflowRunId,
      input.integrationProfileKey ?? null,
      textValue(input.title, packageKey),
      textValue(input.description),
      textValue(input.licence, 'CC-BY-4.0'),
      textValue(input.format, 'geojson'),
      textValue(input.fileName, `${packageKey}.geojson`),
      textValue(input.mediaType, 'application/geo+json; charset=utf-8'),
      content,
      Buffer.byteLength(content),
      sha256,
      accessToken,
      JSON.stringify(input.sourceQuery ?? {}),
      JSON.stringify(input.manifest ?? {}),
      input.createdBy ?? null,
    ],
  )
  return {
    package: publicPackage(result.rows[0]),
    accessToken,
    content,
    existing: false,
  }
}

export async function updateDataSpacePackageStatus(client, packageId, status, manifestPatch = {}) {
  const result = await client.query(
    `
      UPDATE ldt_interop.data_space_asset_packages
      SET status = $2,
          manifest = COALESCE(manifest, '{}'::jsonb) || $3::jsonb,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [packageId, status, JSON.stringify(manifestPatch ?? {})],
  )
  if (!result.rowCount) throw new Error('DATA_SPACE_PACKAGE_NOT_FOUND')
  return publicPackage(result.rows[0])
}

export async function createDataSpaceTransferReceipt(client, input = {}) {
  const workflowRunId = textValue(input.workflowRunId ?? input.workflow_run_id)
  const packageId = textValue(input.packageId ?? input.package_id)
  if (!workflowRunId || !packageId) throw new Error('DATA_SPACE_RECEIPT_CONTEXT_REQUIRED')
  const existing = await client.query(
    `
      SELECT *
      FROM ldt_interop.data_space_transfer_receipts
      WHERE package_id = $1 AND workflow_run_id = $2
      LIMIT 1
    `,
    [packageId, workflowRunId],
  )
  if (existing.rowCount) {
    return {
      receipt: publicReceipt(existing.rows[0]),
      receiptToken: existing.rows[0].receipt_token,
      existing: true,
    }
  }
  const receiptToken = randomBytes(24).toString('hex')
  const result = await client.query(
    `
      INSERT INTO ldt_interop.data_space_transfer_receipts (
        package_id, workflow_run_id, receipt_token, status
      )
      VALUES ($1, $2, $3, 'waiting')
      RETURNING *
    `,
    [packageId, workflowRunId, receiptToken],
  )
  return {
    receipt: publicReceipt(result.rows[0]),
    receiptToken,
    existing: false,
  }
}

export async function getDataSpaceTransferReceipt(client, receiptId) {
  const result = await client.query(
    'SELECT * FROM ldt_interop.data_space_transfer_receipts WHERE id = $1 LIMIT 1',
    [receiptId],
  )
  return result.rowCount ? publicReceipt(result.rows[0]) : null
}

export async function getDataSpacePackageContent({ packageId, token }) {
  return withClient(async (client) => {
    const result = await client.query(
      `
        SELECT id, file_name, media_type, content, byte_size, sha256
        FROM ldt_interop.data_space_asset_packages
        WHERE id = $1 AND access_token = $2
        LIMIT 1
      `,
      [packageId, textValue(token)],
    )
    if (!result.rowCount) return { ok: false, error: 'DATA_SPACE_PACKAGE_ACCESS_DENIED' }
    const row = result.rows[0]
    return {
      ok: true,
      packageId: row.id,
      fileName: row.file_name,
      mediaType: row.media_type,
      content: row.content,
      byteSize: Number(row.byte_size ?? 0),
      sha256: row.sha256,
    }
  })
}

export async function receiveDataSpaceTransfer({ receiptId, token, content, mediaType, headers = {} }) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content ?? '')
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  return withClient(async (client) => {
    const result = await client.query(
      `
        UPDATE ldt_interop.data_space_transfer_receipts receipt
        SET status = CASE WHEN package.sha256 = $3 THEN 'verified' ELSE 'mismatch' END,
            media_type = $4,
            byte_size = $5,
            sha256 = $3,
            content = $6,
            headers = $7::jsonb,
            received_at = now(),
            updated_at = now()
        FROM ldt_interop.data_space_asset_packages package
        WHERE receipt.id = $1
          AND receipt.receipt_token = $2
          AND package.id = receipt.package_id
        RETURNING receipt.*, package.sha256 AS expected_sha256
      `,
      [
        receiptId,
        textValue(token),
        sha256,
        textValue(mediaType, 'application/octet-stream'),
        buffer.byteLength,
        buffer.toString('utf8'),
        JSON.stringify(selectedHeaders(headers)),
      ],
    )
    if (!result.rowCount) return { ok: false, error: 'DATA_SPACE_RECEIPT_ACCESS_DENIED' }
    const row = result.rows[0]
    if (row.status === 'verified') {
      await client.query(
        `
          UPDATE ldt_interop.data_space_asset_packages
          SET status = 'transferred', updated_at = now()
          WHERE id = $1
        `,
        [row.package_id],
      )
    }
    return {
      ok: row.status === 'verified',
      receipt: publicReceipt(row),
      expectedSha256: row.expected_sha256,
      error: row.status === 'verified' ? null : 'DATA_SPACE_RECEIPT_CHECKSUM_MISMATCH',
    }
  })
}

export async function listDataSpaceAssetPackages({ cityId, limit = 25 } = {}) {
  return withClient(async (client) => {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 25, 100))
    const params = []
    const conditions = []
    if (cityId) {
      params.push(cityId)
      conditions.push(`city_id = $${params.length}`)
    }
    params.push(boundedLimit)
    const result = await client.query(
      `
        SELECT *
        FROM ldt_interop.data_space_asset_packages
        ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
        ORDER BY created_at DESC
        LIMIT $${params.length}
      `,
      params,
    )
    return { ok: true, packages: result.rows.map(publicPackage) }
  })
}
