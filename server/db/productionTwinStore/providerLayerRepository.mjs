import { getProductionPool } from '../postgisPool.mjs'
import { upsertCityFromConfig } from './cityRepository.mjs'
import {
  providerFeatureStableId,
  replaceCityLayerFeatures,
  upsertProviderCityFeature,
  upsertSourceFeature,
} from './featureWriteRepository.mjs'
import { compactText, json, slug } from './repositoryUtils.mjs'

export async function ingestGeoJsonProviderLayer(cityConfig, options = {}) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  const layerKey = slug(options.layerKey ?? options.layer_key ?? options.key, '')
  if (!layerKey) {
    throw new Error('LAYER_KEY_REQUIRED')
  }

  const geojson = options.geojson
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error('GEOJSON_FEATURE_COLLECTION_REQUIRED')
  }

  const client = await pool.connect()
  const sourceFormat = compactText(options.sourceFormat ?? options.source_format, 'geojson')
  const sourceKind = compactText(options.sourceKind ?? options.source_kind, `provider-${sourceFormat}`)
  const sourceName = compactText(options.sourceName ?? options.source_name, `${layerKey}-${sourceFormat}`)
  const sourceUri = compactText(options.sourceUri ?? options.source_uri) || null
  const stats = {
    cityId: null,
    layerKey,
    sourceFormat,
    featuresRead: geojson.features.length,
    featuresInserted: 0,
    featuresSkipped: 0,
    replaceExisting: options.replaceExisting !== false,
  }
  let runId = null
  let jobId = null

  try {
    await client.query('BEGIN')
    const cityId = await upsertCityFromConfig(client, cityConfig)
    stats.cityId = cityId

    const layer = await client.query(
      `
        SELECT
          ld.id,
          ld.provider_id,
          ld.authority_status,
          ld.metadata,
          pc.id AS connector_id
        FROM layer_definitions ld
        LEFT JOIN provider_connectors pc
          ON pc.provider_id = ld.provider_id
          AND pc.connector_key = $3
        WHERE ld.city_id = $1 AND ld.key = $2
      `,
      [cityId, layerKey, compactText(options.connectorKey ?? options.connector_key)],
    )
    if (layer.rowCount === 0) {
      throw new Error('LAYER_NOT_REGISTERED')
    }

    const layerRow = layer.rows[0]
    const providerId = compactText(options.providerId ?? options.provider_id, layerRow.provider_id) || null
    const connectorId = compactText(options.connectorId ?? options.connector_id, layerRow.connector_id) || null

    const run = await client.query(
      `
        INSERT INTO ingestion_runs (
          city_id, provider_id, layer_id, source_name, source_url, run_type,
          status, started_at, stats, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'running', now(), $7::jsonb, $8::jsonb)
        RETURNING id
      `,
      [
        cityId,
        providerId,
        layerRow.id,
        sourceName,
        sourceUri,
        `provider-layer-${sourceFormat}`,
        json(stats),
        json({
          connectorKey: options.connectorKey ?? options.connector_key ?? null,
          submittedBy: options.submittedBy ?? options.submitted_by ?? null,
          validationSummary: options.validationSummary ?? options.validation_summary ?? {},
        }),
      ],
    )
    runId = run.rows[0].id

    const existingJobId = compactText(options.existingJobId ?? options.existing_job_id) || null
    if (existingJobId) {
      const job = await client.query(
        `
          UPDATE layer_ingestion_jobs
          SET provider_id = $2,
            connector_id = $3,
            ingestion_run_id = $4,
            ingestion_mode = $5,
            source_format = $6,
            source_uri = $7,
            status = 'running',
            submitted_by = COALESCE($8, submitted_by),
            validation_summary = $9::jsonb,
            stats = $10::jsonb,
            metadata = metadata || $11::jsonb,
            attempt_count = attempt_count + 1,
            locked_at = now(),
            locked_by = $12,
            started_at = COALESCE(started_at, now()),
            finished_at = NULL,
            updated_at = now()
          WHERE id = $1 AND city_id = $13 AND layer_id = $14
            AND status IN ('queued', 'registered', 'running')
          RETURNING id
        `,
        [
          existingJobId,
          providerId,
          connectorId,
          runId,
          stats.replaceExisting ? 'replace' : 'append',
          sourceFormat,
          sourceUri,
          compactText(options.submittedBy ?? options.submitted_by) || null,
          json(options.validationSummary ?? options.validation_summary ?? {}),
          json(stats),
          json(options.metadata ?? {}),
          compactText(options.workerId ?? options.worker_id, 'api-worker'),
          cityId,
          layerRow.id,
        ],
      )
      if (job.rowCount === 0) {
        throw new Error('INGESTION_JOB_NOT_RUNNABLE')
      }
      jobId = job.rows[0].id
    } else {
      const job = await client.query(
        `
          INSERT INTO layer_ingestion_jobs (
            city_id, provider_id, layer_id, connector_id, ingestion_run_id,
            ingestion_mode, source_format, source_uri, status, submitted_by,
            validation_summary, stats, metadata, started_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'running', $9, $10::jsonb, $11::jsonb, $12::jsonb, now(), now())
          RETURNING id
        `,
        [
          cityId,
          providerId,
          layerRow.id,
          connectorId,
          runId,
          stats.replaceExisting ? 'replace' : 'append',
          sourceFormat,
          sourceUri,
          compactText(options.submittedBy ?? options.submitted_by) || null,
          json(options.validationSummary ?? options.validation_summary ?? {}),
          json(stats),
          json(options.metadata ?? {}),
        ],
      )
      jobId = job.rows[0].id
    }

    await client.query(
      `
        INSERT INTO source_artifacts (
          ingestion_run_id, city_id, provider_id, source_name, source_url,
          source_kind, fetched_at, payload, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, now(), $7::jsonb, $8::jsonb)
      `,
      [
        runId,
        cityId,
        providerId,
        sourceName,
        sourceUri,
        sourceKind,
        json(options.sourceArtifactPayload ?? options.source_artifact_payload ?? geojson),
        json({
          layerKey,
          sourceFormat,
          featureCount: geojson.features.length,
          ...(options.sourceArtifactMetadata ?? options.source_artifact_metadata ?? {}),
        }),
      ],
    )

    if (stats.replaceExisting) {
      await replaceCityLayerFeatures(client, cityId, layerRow.id)
    }

    for (const [index, feature] of geojson.features.entries()) {
      if (feature?.type !== 'Feature' || !feature.geometry) {
        stats.featuresSkipped += 1
        continue
      }
      const stableId = providerFeatureStableId(layerKey, feature, index)
      const rawId = await upsertSourceFeature(client, {
        runId,
        cityId,
        layerKey,
        stableId,
        feature,
      })
      await upsertProviderCityFeature(client, {
        cityId,
        layerId: layerRow.id,
        rawId,
        layerKey,
        stableId,
        feature,
        authorityStatus: compactText(options.authorityStatus ?? options.authority_status, layerRow.authority_status),
        confidence: compactText(options.confidence, 'provider-supplied'),
      })
      stats.featuresInserted += 1
    }

    await client.query(
      `
        UPDATE ingestion_runs
        SET status = 'completed', finished_at = now(), stats = $2::jsonb
        WHERE id = $1
      `,
      [runId, json(stats)],
    )
    await client.query(
      `
        UPDATE layer_ingestion_jobs
        SET status = 'completed',
          finished_at = now(),
          updated_at = now(),
          locked_at = NULL,
          locked_by = NULL,
          stats = $2::jsonb
        WHERE id = $1
      `,
      [jobId, json(stats)],
    )
    await client.query('COMMIT')

    return {
      configured: true,
      ok: true,
      cityId,
      layerKey,
      runId,
      jobId,
      stats,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    const errorMessage = String(error?.message ?? 'UNKNOWN_GEOJSON_INGESTION_ERROR')
    if (runId || jobId) {
      try {
        await client.query('BEGIN')
        if (runId) {
          await client.query(
            `
              UPDATE ingestion_runs
              SET status = 'failed', finished_at = now(), stats = $2::jsonb, error_message = $3
              WHERE id = $1
            `,
            [runId, json(stats), errorMessage],
          )
        }
        if (jobId) {
          await client.query(
            `
              UPDATE layer_ingestion_jobs
              SET status = 'failed',
                finished_at = now(),
                updated_at = now(),
                locked_at = NULL,
                locked_by = NULL,
                stats = $2::jsonb,
                error_message = $3
              WHERE id = $1
            `,
            [jobId, json(stats), errorMessage],
          )
        }
        await client.query('COMMIT')
      } catch {
        try {
          await client.query('ROLLBACK')
        } catch {
          // Keep the original ingestion error.
        }
      }
    }
    throw error
  } finally {
    client.release()
  }
}

export async function registerProviderLayerPackage(cityConfig, options = {}) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: false,
      error: 'PRODUCTION_DATABASE_NOT_CONFIGURED',
    }
  }

  const layerKey = slug(options.layerKey ?? options.layer_key ?? options.key, '')
  if (!layerKey) {
    throw new Error('LAYER_KEY_REQUIRED')
  }

  const sourceFormat = compactText(options.sourceFormat ?? options.source_format, 'package-metadata')
  const sourceKind = compactText(options.sourceKind ?? options.source_kind, `provider-${sourceFormat}`)
  const sourceName = compactText(options.sourceName ?? options.source_name, `${layerKey}-${sourceFormat}`)
  const sourceUri = compactText(options.sourceUri ?? options.source_uri) || null
  const metadata = options.metadata ?? {}
  const payload = options.payload ?? {
    sourceFormat,
    sourceUri,
    metadata,
  }

  const client = await pool.connect()
  let runId = null
  let jobId = null
  const stats = {
    cityId: null,
    layerKey,
    sourceFormat,
    featuresInserted: 0,
    packageRegistered: true,
  }

  try {
    await client.query('BEGIN')
    const cityId = await upsertCityFromConfig(client, cityConfig)
    stats.cityId = cityId

    const layer = await client.query(
      `
        SELECT id, provider_id, metadata
        FROM layer_definitions
        WHERE city_id = $1 AND key = $2
      `,
      [cityId, layerKey],
    )
    if (layer.rowCount === 0) {
      throw new Error('LAYER_NOT_REGISTERED')
    }

    const layerRow = layer.rows[0]
    const providerId = compactText(options.providerId ?? options.provider_id, layerRow.provider_id) || null
    const run = await client.query(
      `
        INSERT INTO ingestion_runs (
          city_id, provider_id, layer_id, source_name, source_url, run_type,
          status, started_at, finished_at, stats, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'completed', now(), now(), $7::jsonb, $8::jsonb)
        RETURNING id
      `,
      [
        cityId,
        providerId,
        layerRow.id,
        sourceName,
        sourceUri,
        `provider-layer-${sourceFormat}`,
        json(stats),
        json({
          submittedBy: options.submittedBy ?? options.submitted_by ?? null,
          validationSummary: options.validationSummary ?? options.validation_summary ?? {},
          packageMetadata: metadata,
        }),
      ],
    )
    runId = run.rows[0].id

    const existingJobId = compactText(options.existingJobId ?? options.existing_job_id) || null
    if (existingJobId) {
      const job = await client.query(
        `
          UPDATE layer_ingestion_jobs
          SET provider_id = $2,
            ingestion_run_id = $3,
            ingestion_mode = 'register-metadata',
            source_format = $4,
            source_uri = $5,
            status = 'running',
            submitted_by = COALESCE($6, submitted_by),
            validation_summary = $7::jsonb,
            stats = $8::jsonb,
            metadata = metadata || $9::jsonb,
            attempt_count = attempt_count + 1,
            locked_at = now(),
            locked_by = $10,
            started_at = COALESCE(started_at, now()),
            finished_at = NULL,
            updated_at = now()
          WHERE id = $1 AND city_id = $11 AND layer_id = $12
            AND status IN ('queued', 'registered', 'running')
          RETURNING id
        `,
        [
          existingJobId,
          providerId,
          runId,
          sourceFormat,
          sourceUri,
          compactText(options.submittedBy ?? options.submitted_by) || null,
          json(options.validationSummary ?? options.validation_summary ?? { state: 'metadata-registered' }),
          json(stats),
          json(metadata),
          compactText(options.workerId ?? options.worker_id, 'api-worker'),
          cityId,
          layerRow.id,
        ],
      )
      if (job.rowCount === 0) {
        throw new Error('INGESTION_JOB_NOT_RUNNABLE')
      }
      jobId = job.rows[0].id
    } else {
      const job = await client.query(
        `
          INSERT INTO layer_ingestion_jobs (
            city_id, provider_id, layer_id, ingestion_run_id, ingestion_mode,
            source_format, source_uri, status, submitted_by, validation_summary,
            stats, metadata, started_at, finished_at, updated_at
          )
          VALUES ($1, $2, $3, $4, 'register-metadata', $5, $6, 'completed', $7, $8::jsonb, $9::jsonb, $10::jsonb, now(), now(), now())
          RETURNING id
        `,
        [
          cityId,
          providerId,
          layerRow.id,
          runId,
          sourceFormat,
          sourceUri,
          compactText(options.submittedBy ?? options.submitted_by) || null,
          json(options.validationSummary ?? options.validation_summary ?? { state: 'metadata-registered' }),
          json(stats),
          json(metadata),
        ],
      )
      jobId = job.rows[0].id
    }

    await client.query(
      `
        INSERT INTO source_artifacts (
          ingestion_run_id, city_id, provider_id, source_name, source_url,
          source_kind, fetched_at, payload, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, now(), $7::jsonb, $8::jsonb)
      `,
      [
        runId,
        cityId,
        providerId,
        sourceName,
        sourceUri,
        sourceKind,
        json(payload),
        json({
          layerKey,
          sourceFormat,
          packageRegistered: true,
        }),
      ],
    )

    await client.query(
      `
        UPDATE layer_definitions
        SET metadata = metadata || $3::jsonb, updated_at = now()
        WHERE city_id = $1 AND key = $2
      `,
      [
        cityId,
        layerKey,
        json({
          latestPackage: {
            sourceFormat,
            sourceUri,
            registeredAt: new Date().toISOString(),
            metadata,
          },
        }),
      ],
    )

    if (options.catalog !== false) {
      await client.query(
        `
          INSERT INTO dataset_catalog_records (
            city_id, layer_id, dcat_identifier, title, description,
            access_level, license, landing_page_url, metadata, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now())
          ON CONFLICT (dcat_identifier) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            access_level = excluded.access_level,
            license = excluded.license,
            landing_page_url = excluded.landing_page_url,
            metadata = excluded.metadata,
            updated_at = now()
        `,
        [
          cityId,
          layerRow.id,
          compactText(options.dcatIdentifier ?? options.dcat_identifier, `${cityId}:${layerKey}:${sourceFormat}`),
          compactText(options.title, sourceName),
          compactText(options.description, `Provider ${sourceFormat} package registered for ${layerKey}.`),
          compactText(options.accessLevel ?? options.access_level, 'city-private'),
          compactText(options.license) || null,
          sourceUri,
          json({
            sourceFormat,
            packageMetadata: metadata,
          }),
        ],
      )
    }

    await client.query(
      `
        UPDATE layer_ingestion_jobs
        SET status = 'completed',
          finished_at = now(),
          updated_at = now(),
          locked_at = NULL,
          locked_by = NULL,
          stats = $2::jsonb
        WHERE id = $1
      `,
      [jobId, json(stats)],
    )

    await client.query('COMMIT')
    return {
      configured: true,
      ok: true,
      cityId,
      layerKey,
      runId,
      jobId,
      stats,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
