import {
  OPEN_METEO_DOCS_URL,
  OPEN_METEO_TERMS_URL,
  sha256,
  WEATHER_LAYER_KEYS,
} from './weatherFieldConfig.mjs'

export async function ensureWeatherDataset(client, cityId, {
  scenarioKey,
  endpoint,
  gridKey,
  gridResolutionM,
  sampleCount,
  observedAt,
}) {
  const identifier = `${cityId}:open-meteo-current-weather:${gridKey}`
  const metadata = {
    extractorKey: 'weather-field',
    scenarioKey,
    source: 'Open-Meteo Forecast API',
    sourceUrl: endpoint,
    docsUrl: OPEN_METEO_DOCS_URL,
    termsUrl: OPEN_METEO_TERMS_URL,
    gridKey,
    gridResolutionM,
    sampleCount,
    observedAt,
    variables: ['temperature_2m', 'wind_speed_10m', 'wind_direction_10m'],
    posture: 'open-data-native',
    rawResponseStoredInPostgis: false,
    sampledGridStoredInPostgis: true,
  }
  const dataset = await client.query(
    `
      INSERT INTO ldt_catalog.datasets (
        city_id,
        identifier,
        title,
        description,
        publisher,
        license,
        access_rights,
        update_frequency,
        issued_at,
        modified_at,
        metadata,
        updated_at
      ) VALUES (
        $1,
        $2,
        'Open-Meteo current weather sample',
        'Open weather API samples attached to the city environmental grid for air temperature and wind fields.',
        'Open-Meteo',
        'Open-Meteo source terms',
        'public-open-data',
        'near-real-time/source-dependent',
        now(),
        now(),
        $3::jsonb,
        now()
      )
      ON CONFLICT (identifier) DO UPDATE SET
        city_id = EXCLUDED.city_id,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        publisher = EXCLUDED.publisher,
        license = EXCLUDED.license,
        access_rights = EXCLUDED.access_rights,
        update_frequency = EXCLUDED.update_frequency,
        modified_at = EXCLUDED.modified_at,
        metadata = EXCLUDED.metadata,
        updated_at = now()
      RETURNING id, identifier
    `,
    [cityId, identifier, JSON.stringify(metadata)],
  )
  const datasetId = dataset.rows[0].id
  await client.query('DELETE FROM ldt_catalog.dataset_distributions WHERE dataset_id = $1 AND title = $2', [datasetId, 'Open-Meteo Forecast API'])
  await client.query(
    `
      INSERT INTO ldt_catalog.dataset_distributions (
        dataset_id,
        title,
        format,
        media_type,
        access_url,
        download_url,
        metadata
      ) VALUES (
        $1,
        'Open-Meteo Forecast API',
        'API',
        'application/json',
        $2,
        $2,
        $3::jsonb
      )
    `,
    [datasetId, endpoint, JSON.stringify(metadata)],
  )
  await client.query(
    `
      INSERT INTO ldt_catalog.dataset_licenses (
        dataset_id,
        license_name,
        license_url,
        attribution_required,
        obligations
      ) VALUES (
        $1,
        'Open-Meteo terms',
        $2,
        true,
        $3::jsonb
      )
      ON CONFLICT (dataset_id, license_name) DO UPDATE SET
        license_url = EXCLUDED.license_url,
        attribution_required = EXCLUDED.attribution_required,
        obligations = EXCLUDED.obligations
    `,
    [datasetId, OPEN_METEO_TERMS_URL, JSON.stringify({
      note: 'Respect Open-Meteo attribution and API terms when exposing derived weather fields.',
    })],
  )
  await client.query('DELETE FROM ldt_catalog.dataset_spatial_extents WHERE dataset_id = $1 AND extent_role = $2', [datasetId, 'city-sampled-coverage'])
  await client.query(
    `
      INSERT INTO ldt_catalog.dataset_spatial_extents (
        dataset_id,
        extent_role,
        geom,
        bbox
      )
      SELECT
        $1,
        'city-sampled-coverage',
        ST_UnaryUnion(ST_Collect(geom)),
        jsonb_build_object(
          'minLon', ST_XMin(ST_Envelope(ST_UnaryUnion(ST_Collect(geom)))),
          'minLat', ST_YMin(ST_Envelope(ST_UnaryUnion(ST_Collect(geom)))),
          'maxLon', ST_XMax(ST_Envelope(ST_UnaryUnion(ST_Collect(geom)))),
          'maxLat', ST_YMax(ST_Envelope(ST_UnaryUnion(ST_Collect(geom))))
        )
      FROM ldt_core.city_boundaries
      WHERE city_id = $2
    `,
    [datasetId, cityId],
  )
  await client.query('DELETE FROM ldt_catalog.dataset_temporal_extents WHERE dataset_id = $1 AND extent_role = $2', [datasetId, 'current-weather-sample'])
  await client.query(
    `
      INSERT INTO ldt_catalog.dataset_temporal_extents (
        dataset_id,
        extent_role,
        starts_at,
        ends_at,
        statement
      ) VALUES (
        $1,
        'current-weather-sample',
        NULLIF($2::text, '')::timestamptz,
        NULLIF($2::text, '')::timestamptz,
        'Current weather sample timestamp from Open-Meteo.'
      )
    `,
    [datasetId, observedAt || null],
  )
  return dataset.rows[0]
}

async function upsertWeatherArtifact(client, {
  runId,
  cityId,
  datasetId,
  artifactKind,
  artifactUri,
  mediaType,
  checksum = null,
  metadata = {},
}) {
  await client.query(
    `
      INSERT INTO ldt_environment.extractor_artifacts (
        extractor_run_id,
        city_id,
        dataset_id,
        artifact_kind,
        artifact_uri,
        media_type,
        checksum,
        coverage_geom,
        metadata
      )
      SELECT
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        ST_UnaryUnion(ST_Collect(geom)),
        $8::jsonb
      FROM ldt_core.city_boundaries
      WHERE city_id = $2
      ON CONFLICT (extractor_run_id, artifact_kind, artifact_uri) DO UPDATE SET
        dataset_id = EXCLUDED.dataset_id,
        media_type = EXCLUDED.media_type,
        checksum = EXCLUDED.checksum,
        coverage_geom = EXCLUDED.coverage_geom,
        metadata = EXCLUDED.metadata
    `,
    [runId, cityId, datasetId, artifactKind, artifactUri, mediaType, checksum, JSON.stringify(metadata)],
  )
}

export async function ensureWeatherRun(client, cityId, {
  datasetId,
  scenarioKey,
  gridKey,
  gridResolutionM,
  endpoint,
  samples,
  failures,
  cellsWritten,
  objectObservations,
  objectSummaries,
}) {
  const definition = await client.query(
    `
      SELECT id
      FROM ldt_environment.extractor_definitions
      WHERE extractor_key = 'weather-field'
      LIMIT 1
    `,
  )
  if (definition.rowCount === 0) throw new Error('WEATHER_FIELD_EXTRACTOR_DEFINITION_MISSING')
  const observedAt = samples.map((sample) => sample.observedAt).find(Boolean) || ''
  const runVersion = `open-meteo-${gridKey}-${observedAt || 'current'}`
  const runKey = `weather-field:${scenarioKey}:${runVersion}`
  const inputSummary = {
    source: 'Open-Meteo Forecast API',
    sourceUrl: endpoint,
    gridKey,
    gridResolutionM,
    requestedLayers: WEATHER_LAYER_KEYS,
    requestedVariables: ['temperature_2m', 'wind_speed_10m', 'wind_direction_10m'],
  }
  const outputSummary = {
    outputLayerKeys: WEATHER_LAYER_KEYS,
    sampledCells: samples.length,
    failedBatches: failures.length,
    cellsWritten,
    objectObservations,
    objectSummaries,
    datasetId,
    observedAt,
    writesActualPhenomenonCells: true,
    currentPosture: 'source-backed-open-weather',
  }
  const validationReport = {
    status: samples.length > 0 && failures.length === 0 ? 'passed' : 'passed-with-gaps',
    checks: [
      {
        key: 'source-data',
        status: samples.length > 0 ? 'passed' : 'failed',
        statement: `${samples.length} weather grid cells received Open-Meteo current-weather samples.`,
      },
      {
        key: 'object-attachment',
        status: objectObservations > 0 ? 'passed' : 'warning',
        statement: `${objectObservations} city objects received weather observations.`,
      },
      {
        key: 'raw-storage',
        status: 'documented',
        statement: 'API response values are sampled into PostGIS; raw API payloads are referenced but not retained.',
      },
    ],
  }
  const run = await client.query(
    `
      INSERT INTO ldt_environment.extractor_runs (
        extractor_id,
        extractor_key,
        city_id,
        run_key,
        scenario_key,
        status,
        source_status,
        requested_by,
        requested_by_kind,
        trigger_kind,
        started_at,
        finished_at,
        input_summary,
        output_summary,
        validation_report,
        error,
        updated_at
      ) VALUES (
        $1,
        'weather-field',
        $2,
        $3,
        $4,
        'completed',
        'source-backed-open-data',
        'weather-field-extractor',
        'system',
        'manual',
        now(),
        now(),
        $5::jsonb,
        $6::jsonb,
        $7::jsonb,
        '{}'::jsonb,
        now()
      )
      ON CONFLICT (city_id, extractor_key, scenario_key, run_key) DO UPDATE SET
        extractor_id = EXCLUDED.extractor_id,
        status = EXCLUDED.status,
        source_status = EXCLUDED.source_status,
        requested_by = EXCLUDED.requested_by,
        requested_by_kind = EXCLUDED.requested_by_kind,
        trigger_kind = EXCLUDED.trigger_kind,
        finished_at = EXCLUDED.finished_at,
        input_summary = EXCLUDED.input_summary,
        output_summary = EXCLUDED.output_summary,
        validation_report = EXCLUDED.validation_report,
        error = '{}'::jsonb,
        updated_at = now()
      RETURNING id
    `,
    [
      definition.rows[0].id,
      cityId,
      runKey,
      scenarioKey,
      JSON.stringify(inputSummary),
      JSON.stringify(outputSummary),
      JSON.stringify(validationReport),
    ],
  )
  const runId = run.rows[0].id
  await upsertWeatherArtifact(client, {
    runId,
    cityId,
    datasetId,
    artifactKind: 'source-api',
    artifactUri: endpoint,
    mediaType: 'application/json',
    metadata: inputSummary,
  })
  await upsertWeatherArtifact(client, {
    runId,
    cityId,
    datasetId,
    artifactKind: 'derived-cell-report',
    artifactUri: `urn:polisplexity:ldt:${cityId}:environment-extractor:weather-field:derived-cells:${scenarioKey}:${gridKey}`,
    mediaType: 'application/json',
    checksum: sha256(JSON.stringify(outputSummary)),
    metadata: outputSummary,
  })
  if (failures.length > 0) {
    await upsertWeatherArtifact(client, {
      runId,
      cityId,
      datasetId,
      artifactKind: 'failure-report',
      artifactUri: `urn:polisplexity:ldt:${cityId}:environment-extractor:weather-field:failures:${scenarioKey}:${gridKey}`,
      mediaType: 'application/json',
      checksum: sha256(JSON.stringify(failures)),
      metadata: { failures },
    })
  }
  return { runId, runKey }
}
