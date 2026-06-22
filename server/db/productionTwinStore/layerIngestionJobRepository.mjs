import { getProductionPool } from '../postgisPool.mjs'
import { upsertCityFromConfig } from './cityRepository.mjs'
import { compactText, json, numberOrNull, parseMaybeJson, slug } from './repositoryUtils.mjs'

export async function registerLayerIngestionJob(cityConfig, job = {}) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  const layerKey = slug(job.layerKey ?? job.layer_key ?? job.key, '')
  if (!layerKey) {
    throw new Error('LAYER_KEY_REQUIRED')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const cityId = await upsertCityFromConfig(client, cityConfig)
    const layer = await client.query(
      'SELECT id, provider_id FROM layer_definitions WHERE city_id = $1 AND key = $2',
      [cityId, layerKey],
    )
    if (layer.rowCount === 0) {
      throw new Error('LAYER_NOT_REGISTERED')
    }
    const providerId = compactText(job.providerId ?? job.provider_id, layer.rows[0].provider_id) || null
    const connectorId = compactText(job.connectorId ?? job.connector_id) || null
    const result = await client.query(
      `
        INSERT INTO layer_ingestion_jobs (
          city_id, provider_id, layer_id, connector_id, ingestion_mode,
          source_format, source_uri, status, submitted_by, validation_summary,
          stats, error_message, metadata, started_at, finished_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13::jsonb, $14, $15, now())
        RETURNING id
      `,
      [
        cityId,
        providerId,
        layer.rows[0].id,
        connectorId,
        compactText(job.ingestionMode ?? job.ingestion_mode, 'registered'),
        compactText(job.sourceFormat ?? job.source_format, 'unknown'),
        compactText(job.sourceUri ?? job.source_uri) || null,
        compactText(job.status, 'registered'),
        compactText(job.submittedBy ?? job.submitted_by) || null,
        json(job.validationSummary ?? job.validation_summary ?? {}),
        json(job.stats ?? {}),
        compactText(job.errorMessage ?? job.error_message) || null,
        json(job.metadata ?? {}),
        job.startedAt ?? job.started_at ?? null,
        job.finishedAt ?? job.finished_at ?? null,
      ],
    )
    await client.query('COMMIT')
    return {
      configured: true,
      ok: true,
      cityId,
      layerKey,
      jobId: result.rows[0].id,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function createQueuedLayerIngestionJob(cityConfig, job = {}) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  const layerKey = slug(job.layerKey ?? job.layer_key ?? job.key, '')
  if (!layerKey) {
    throw new Error('LAYER_KEY_REQUIRED')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const cityId = await upsertCityFromConfig(client, cityConfig)
    const layer = await client.query(
      `
        SELECT
          ld.id,
          ld.provider_id,
          pc.id AS connector_id
        FROM layer_definitions ld
        LEFT JOIN provider_connectors pc
          ON pc.provider_id = ld.provider_id
          AND pc.connector_key = $3
        WHERE ld.city_id = $1 AND ld.key = $2
      `,
      [cityId, layerKey, compactText(job.connectorKey ?? job.connector_key)],
    )
    if (layer.rowCount === 0) {
      throw new Error('LAYER_NOT_REGISTERED')
    }

    const layerRow = layer.rows[0]
    const providerId = compactText(job.providerId ?? job.provider_id, layerRow.provider_id) || null
    const connectorId = compactText(job.connectorId ?? job.connector_id, layerRow.connector_id) || null
    const idempotencyKey = compactText(job.idempotencyKey ?? job.idempotency_key) || null
    if (idempotencyKey) {
      const existing = await client.query(
        `
          SELECT id, status
          FROM layer_ingestion_jobs
          WHERE city_id = $1 AND layer_id = $2 AND idempotency_key = $3
          LIMIT 1
        `,
        [cityId, layerRow.id, idempotencyKey],
      )
      if (existing.rowCount > 0) {
        await client.query('COMMIT')
        return {
          configured: true,
          ok: true,
          existing: true,
          cityId,
          layerKey,
          jobId: existing.rows[0].id,
          status: existing.rows[0].status,
        }
      }
    }

    const result = await client.query(
      `
        INSERT INTO layer_ingestion_jobs (
          city_id, provider_id, layer_id, connector_id, job_kind,
          requested_action, ingestion_mode, source_format, source_uri, status,
          submitted_by, validation_summary, stats, metadata, idempotency_key,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'provider-layer-ingestion',
          $5, 'queued', $6, $7, 'queued',
          $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, now())
        RETURNING id, status
      `,
      [
        cityId,
        providerId,
        layerRow.id,
        connectorId,
        compactText(job.requestedAction ?? job.requested_action, 'ingest'),
        compactText(job.sourceFormat ?? job.source_format, 'unknown'),
        compactText(job.sourceUri ?? job.source_uri) || null,
        compactText(job.submittedBy ?? job.submitted_by) || null,
        json(job.validationSummary ?? job.validation_summary ?? { state: 'queued' }),
        json(job.stats ?? {}),
        json(job.metadata ?? {}),
        idempotencyKey,
      ],
    )
    await client.query('COMMIT')
    return {
      configured: true,
      ok: true,
      existing: false,
      cityId,
      layerKey,
      jobId: result.rows[0].id,
      status: result.rows[0].status,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listCityLayerIngestionJobs(cityId, limit = 25) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      jobs: [],
      error: null,
    }
  }

  try {
    const result = await pool.query(
      `
        SELECT
          lij.id,
          lij.status,
          lij.ingestion_mode,
          lij.source_format,
          lij.source_uri,
          lij.submitted_by,
          lij.validation_summary,
          lij.stats,
          lij.error_message,
          lij.metadata,
          lij.created_at,
          lij.updated_at,
          lij.started_at,
          lij.finished_at,
          ld.key AS layer_key,
          ld.name AS layer_name,
          p.id AS provider_id,
          p.name AS provider_name,
          pc.connector_key,
          pc.display_name AS connector_name
        FROM layer_ingestion_jobs lij
        LEFT JOIN layer_definitions ld ON ld.id = lij.layer_id
        LEFT JOIN providers p ON p.id = lij.provider_id
        LEFT JOIN provider_connectors pc ON pc.id = lij.connector_id
        WHERE lij.city_id = $1
        ORDER BY lij.created_at DESC
        LIMIT $2
      `,
      [cityId, Math.max(1, Math.min(Number(limit) || 25, 100))],
    )
    return {
      configured: true,
      ok: true,
      cityId,
      jobs: result.rows.map((row) => ({
        id: row.id,
        status: row.status,
        ingestionMode: row.ingestion_mode,
        sourceFormat: row.source_format,
        sourceUri: row.source_uri,
        submittedBy: row.submitted_by,
        validationSummary: parseMaybeJson(row.validation_summary, {}),
        stats: parseMaybeJson(row.stats, {}),
        errorMessage: row.error_message,
        metadata: parseMaybeJson(row.metadata, {}),
        layer: row.layer_key ? { key: row.layer_key, name: row.layer_name } : null,
        provider: row.provider_id ? { id: row.provider_id, name: row.provider_name } : null,
        connector: row.connector_key ? { key: row.connector_key, name: row.connector_name } : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
      })),
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      jobs: [],
      error: String(error?.message ?? 'UNKNOWN_LAYER_INGESTION_JOBS_ERROR'),
    }
  } finally {
  }
}

export async function getLayerIngestionJob(jobId) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  try {
    const result = await pool.query(
      `
        SELECT
          lij.*,
          ld.key AS layer_key,
          ld.name AS layer_name,
          p.name AS provider_name,
          pc.connector_key,
          pc.display_name AS connector_name
        FROM layer_ingestion_jobs lij
        LEFT JOIN layer_definitions ld ON ld.id = lij.layer_id
        LEFT JOIN providers p ON p.id = lij.provider_id
        LEFT JOIN provider_connectors pc ON pc.id = lij.connector_id
        WHERE lij.id = $1
      `,
      [jobId],
    )
    if (result.rowCount === 0) {
      return {
        configured: true,
        ok: false,
        error: 'INGESTION_JOB_NOT_FOUND',
      }
    }
    const row = result.rows[0]
    return {
      configured: true,
      ok: true,
      job: {
        id: row.id,
        cityId: row.city_id,
        status: row.status,
        jobKind: row.job_kind,
        requestedAction: row.requested_action,
        ingestionMode: row.ingestion_mode,
        sourceFormat: row.source_format,
        sourceUri: row.source_uri,
        submittedBy: row.submitted_by,
        validationSummary: parseMaybeJson(row.validation_summary, {}),
        stats: parseMaybeJson(row.stats, {}),
        errorMessage: row.error_message,
        metadata: parseMaybeJson(row.metadata, {}),
        idempotencyKey: row.idempotency_key,
        attemptCount: row.attempt_count,
        lockedAt: row.locked_at,
        lockedBy: row.locked_by,
        cancelledAt: row.cancelled_at,
        layer: row.layer_key ? { key: row.layer_key, name: row.layer_name } : null,
        provider: row.provider_id ? { id: row.provider_id, name: row.provider_name } : null,
        connector: row.connector_key ? { key: row.connector_key, name: row.connector_name } : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
      },
      error: null,
    }
  } finally {
  }
}

export async function listQueuedLayerIngestionJobs(limit = 10) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      jobs: [],
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  try {
    const result = await pool.query(
      `
        SELECT id
        FROM layer_ingestion_jobs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT $1
      `,
      [Math.max(1, Math.min(Number(limit) || 10, 100))],
    )
    return {
      configured: true,
      ok: true,
      jobs: result.rows.map((row) => ({ id: row.id })),
      error: null,
    }
  } finally {
  }
}

export async function cancelLayerIngestionJob(jobId, cancelledBy = '') {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  try {
    const result = await pool.query(
      `
        UPDATE layer_ingestion_jobs
        SET status = 'cancelled',
          cancelled_at = now(),
          finished_at = now(),
          updated_at = now(),
          error_message = NULL,
          validation_summary = validation_summary || $2::jsonb
        WHERE id = $1 AND status IN ('queued', 'registered')
        RETURNING id, status
      `,
      [jobId, json({ state: 'cancelled', cancelledBy: compactText(cancelledBy) || null })],
    )
    if (result.rowCount === 0) {
      return {
        configured: true,
        ok: false,
        error: 'INGESTION_JOB_NOT_CANCELLED',
      }
    }
    return {
      configured: true,
      ok: true,
      jobId: result.rows[0].id,
      status: result.rows[0].status,
    }
  } finally {
  }
}

export async function promoteRegisteredLayerIngestionJob(jobId, submittedBy = '') {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  try {
    const result = await pool.query(
      `
        UPDATE layer_ingestion_jobs
        SET status = 'queued',
          ingestion_mode = 'queued',
          error_message = NULL,
          locked_at = NULL,
          locked_by = NULL,
          started_at = NULL,
          finished_at = NULL,
          cancelled_at = NULL,
          updated_at = now(),
          validation_summary = validation_summary || $2::jsonb
        WHERE id = $1
          AND status = 'registered'
          AND COALESCE((validation_summary->>'canQueue')::boolean, false) = true
          AND COALESCE(source_uri, '') !~* '^(memory|test)://'
        RETURNING id, status
      `,
      [jobId, json({ state: 'queued', promotedBy: compactText(submittedBy) || null })],
    )
    if (result.rowCount === 0) {
      return {
        configured: true,
        ok: false,
        error: 'INGESTION_JOB_NOT_PROMOTED_SAFE_QUEUE_GATE_FAILED',
      }
    }
    return {
      configured: true,
      ok: true,
      jobId: result.rows[0].id,
      status: result.rows[0].status,
    }
  } finally {
  }
}

export async function requeueLayerIngestionJob(jobId, submittedBy = '') {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  try {
    const result = await pool.query(
      `
        UPDATE layer_ingestion_jobs
        SET status = 'queued',
          ingestion_mode = 'queued',
          error_message = NULL,
          locked_at = NULL,
          locked_by = NULL,
          started_at = NULL,
          finished_at = NULL,
          cancelled_at = NULL,
          updated_at = now(),
          validation_summary = validation_summary || $2::jsonb
        WHERE id = $1 AND status IN ('failed', 'cancelled')
        RETURNING id, status
      `,
      [jobId, json({ state: 'requeued', submittedBy: compactText(submittedBy) || null })],
    )
    if (result.rowCount === 0) {
      return {
        configured: true,
        ok: false,
        error: 'INGESTION_JOB_NOT_REQUEUED',
      }
    }
    return {
      configured: true,
      ok: true,
      jobId: result.rows[0].id,
      status: result.rows[0].status,
    }
  } finally {
  }
}


export async function markLayerIngestionJobRunning(jobId, { workerId = 'provider-worker', stats = {}, metadata = {} } = {}) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  try {
    const result = await pool.query(
      `
        UPDATE layer_ingestion_jobs
        SET status = 'running',
          started_at = COALESCE(started_at, now()),
          finished_at = NULL,
          locked_at = now(),
          locked_by = $2,
          attempt_count = attempt_count + 1,
          stats = stats || $3::jsonb,
          metadata = metadata || $4::jsonb,
          error_message = NULL,
          updated_at = now()
        WHERE id = $1
          AND status IN ('queued', 'registered', 'running')
        RETURNING id, status
      `,
      [jobId, compactText(workerId, 'provider-worker'), json(stats), json(metadata)],
    )
    if (result.rowCount === 0) {
      return {
        configured: true,
        ok: false,
        error: 'INGESTION_JOB_NOT_RUNNABLE',
      }
    }
    return {
      configured: true,
      ok: true,
      jobId: result.rows[0].id,
      status: result.rows[0].status,
    }
  } finally {
  }
}

export async function completeLayerIngestionJob(jobId, { stats = {}, validationSummary = {}, metadata = {} } = {}) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  try {
    const result = await pool.query(
      `
        UPDATE layer_ingestion_jobs
        SET status = 'completed',
          finished_at = now(),
          updated_at = now(),
          locked_at = NULL,
          locked_by = NULL,
          stats = stats || $2::jsonb,
          validation_summary = validation_summary || $3::jsonb,
          metadata = metadata || $4::jsonb,
          error_message = NULL
        WHERE id = $1
          AND status IN ('queued', 'registered', 'running')
        RETURNING id, status
      `,
      [jobId, json(stats), json(validationSummary), json(metadata)],
    )
    if (result.rowCount === 0) {
      return {
        configured: true,
        ok: false,
        error: 'INGESTION_JOB_NOT_COMPLETED',
      }
    }
    return {
      configured: true,
      ok: true,
      jobId: result.rows[0].id,
      status: result.rows[0].status,
    }
  } finally {
  }
}

export async function failLayerIngestionJob(jobId, errorMessage, stats = {}) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  try {
    const result = await pool.query(
      `
        UPDATE layer_ingestion_jobs
        SET status = 'failed',
          finished_at = now(),
          updated_at = now(),
          locked_at = NULL,
          locked_by = NULL,
          stats = stats || $2::jsonb,
          error_message = $3
        WHERE id = $1 AND status IN ('queued', 'registered', 'running')
        RETURNING id, status
      `,
      [jobId, json(stats), compactText(errorMessage, 'INGESTION_JOB_FAILED')],
    )
    if (result.rowCount === 0) {
      return {
        configured: true,
        ok: false,
        error: 'INGESTION_JOB_NOT_FAILED',
      }
    }
    return {
      configured: true,
      ok: true,
      jobId: result.rows[0].id,
      status: result.rows[0].status,
    }
  } finally {
  }
}

export async function addLayerIngestionValidationReport(jobId, reports = []) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  const entries = Array.isArray(reports) ? reports : [reports]
  if (entries.length === 0) {
    return {
      configured: true,
      ok: true,
      inserted: 0,
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const job = await client.query(
      'SELECT city_id, layer_id FROM layer_ingestion_jobs WHERE id = $1',
      [jobId],
    )
    if (job.rowCount === 0) {
      throw new Error('INGESTION_JOB_NOT_FOUND')
    }
    let inserted = 0
    for (const entry of entries) {
      await client.query(
        `
          INSERT INTO ingestion_validation_reports (
            job_id, city_id, layer_id, severity, code, message,
            source_ref, source_index, payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        `,
        [
          jobId,
          job.rows[0].city_id,
          job.rows[0].layer_id,
          compactText(entry.severity, 'warning'),
          compactText(entry.code, 'VALIDATION_NOTE'),
          compactText(entry.message, 'Validation note'),
          compactText(entry.sourceRef ?? entry.source_ref) || null,
          numberOrNull(entry.sourceIndex ?? entry.source_index),
          json(entry.payload ?? {}),
        ],
      )
      inserted += 1
    }
    await client.query('COMMIT')
    return {
      configured: true,
      ok: true,
      inserted,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listLayerIngestionValidationReport(jobId, limit = 250) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      reports: [],
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  try {
    const result = await pool.query(
      `
        SELECT id, severity, code, message, source_ref, source_index, payload, created_at
        FROM ingestion_validation_reports
        WHERE job_id = $1
        ORDER BY created_at ASC
        LIMIT $2
      `,
      [jobId, Math.max(1, Math.min(Number(limit) || 250, 1000))],
    )
    return {
      configured: true,
      ok: true,
      jobId,
      reports: result.rows.map((row) => ({
        id: row.id,
        severity: row.severity,
        code: row.code,
        message: row.message,
        sourceRef: row.source_ref,
        sourceIndex: row.source_index,
        payload: parseMaybeJson(row.payload, {}),
        createdAt: row.created_at,
      })),
      error: null,
    }
  } finally {
  }
}
