import { closeSharedProductionPool, withProductionClient as withClient } from './serviceDatabase.mjs'

const DEFAULT_CITY_IDS = ['kharkiv']
const DEFAULT_SCENARIO_KEY = 'baseline'
const DEFAULT_RUN_VERSION = 'contract-v0'
const DEFAULT_RUN_LIMIT = 50
const MAX_RUN_LIMIT = 250

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function integerValue(value, fallback, min, max) {
  const number = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

async function listCityIds(client, requestedCityIds) {
  const normalized = requestedCityIds.map((cityId) => compactText(cityId)).filter(Boolean)
  if (normalized.length > 0) return normalized
  const result = await client.query('SELECT id FROM ldt_core.cities ORDER BY id')
  return result.rows.map((row) => row.id)
}

function normalizeExtractorDefinition(row) {
  return {
    id: row.id,
    key: row.extractor_key,
    label: row.display_name,
    family: row.extractor_family,
    sourcePosture: row.source_posture,
    lifecycleStatus: row.lifecycle_status,
    defaultScenarioKey: row.default_scenario_key,
    outputLayerKeys: row.output_layer_keys || [],
    sourceCandidates: row.source_candidates || [],
    inputContract: row.input_contract || {},
    outputContract: row.output_contract || {},
    standardsMapping: row.standards_mapping || {},
    runtimeContract: row.runtime_contract || {},
    metadata: row.metadata || {},
    enabled: Boolean(row.enabled),
  }
}

function normalizeExtractorRun(row) {
  if (!row) return null
  return {
    id: row.run_id || row.id,
    runKey: row.run_key,
    extractorKey: row.extractor_key,
    label: row.display_name || row.extractor_key,
    family: row.extractor_family || '',
    sourcePosture: row.source_posture || '',
    extractorLifecycleStatus: row.extractor_lifecycle_status || '',
    cityId: row.city_id,
    scenarioKey: row.scenario_key,
    status: row.status,
    sourceStatus: row.source_status,
    artifactCount: Number(row.artifact_count ?? 0),
    inputSummary: row.input_summary || {},
    outputSummary: row.output_summary || {},
    validationReport: row.validation_report || {},
    error: row.error || {},
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function extractorRunKey(extractorKey, scenarioKey, version = DEFAULT_RUN_VERSION) {
  return `${extractorKey}:${scenarioKey}:${version}`
}

function expectedArtifactUri(cityId, extractorKey, artifactKind, version = DEFAULT_RUN_VERSION) {
  return `urn:polisplexity:ldt:${cityId}:environment-extractor:${extractorKey}:${artifactKind}:${version}`
}

async function ensureExtractorRun(client, cityId, definition, {
  scenarioKey = DEFAULT_SCENARIO_KEY,
  requestedBy = 'system',
  requestedByKind = 'system',
  triggerKind = 'manual',
  runVersion = DEFAULT_RUN_VERSION,
} = {}) {
  const runKey = extractorRunKey(definition.extractor_key, scenarioKey, runVersion)
  const inputSummary = {
    contractVersion: runVersion,
    sourceCandidates: definition.source_candidates || [],
    inputContract: definition.input_contract || {},
    cityBoundaryRequired: true,
    actualSourceDataDownloaded: false,
  }
  const outputSummary = {
    outputLayerKeys: definition.output_layer_keys || [],
    outputContract: definition.output_contract || {},
    writesActualPhenomenonCells: false,
    currentPosture: 'registered-source-plan',
  }
  const validationReport = {
    status: 'source-required',
    checks: [
      {
        key: 'extractor-contract',
        status: 'ready',
        statement: 'Extractor contract is registered and can receive a source adapter.',
      },
      {
        key: 'source-data',
        status: 'pending',
        statement: 'No real source file or API response has been ingested by this contract run.',
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
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        'registered',
        'source-plan-only',
        $6, $7, $8,
        now(),
        now(),
        $9::jsonb,
        $10::jsonb,
        $11::jsonb,
        now()
      )
      ON CONFLICT (city_id, extractor_key, scenario_key, run_key) DO UPDATE SET
        extractor_id = EXCLUDED.extractor_id,
        status = EXCLUDED.status,
        source_status = EXCLUDED.source_status,
        requested_by = EXCLUDED.requested_by,
        requested_by_kind = EXCLUDED.requested_by_kind,
        trigger_kind = EXCLUDED.trigger_kind,
        started_at = COALESCE(ldt_environment.extractor_runs.started_at, EXCLUDED.started_at),
        finished_at = EXCLUDED.finished_at,
        input_summary = EXCLUDED.input_summary,
        output_summary = EXCLUDED.output_summary,
        validation_report = EXCLUDED.validation_report,
        error = '{}'::jsonb,
        updated_at = now()
      RETURNING *
    `,
    [
      definition.id,
      definition.extractor_key,
      cityId,
      runKey,
      scenarioKey,
      requestedBy,
      requestedByKind,
      triggerKind,
      JSON.stringify(inputSummary),
      JSON.stringify(outputSummary),
      JSON.stringify(validationReport),
    ],
  )

  const insertedRun = run.rows[0]
  const sourcePlanUri = expectedArtifactUri(cityId, definition.extractor_key, 'source-plan', runVersion)
  await client.query(
    `
      INSERT INTO ldt_environment.extractor_artifacts (
        extractor_run_id,
        city_id,
        artifact_kind,
        artifact_uri,
        media_type,
        coverage_geom,
        metadata
      )
      SELECT
        $1,
        $2,
        'source-plan',
        $3,
        'application/json',
        boundary.geom,
        $4::jsonb
      FROM (
        SELECT geom
        FROM ldt_core.city_boundaries
        WHERE city_id = $2
        ORDER BY
          CASE authority_status
            WHEN 'city-authority' THEN 1
            WHEN 'authority' THEN 2
            WHEN 'open-data' THEN 3
            ELSE 9
          END,
          created_at DESC
        LIMIT 1
      ) boundary
      ON CONFLICT (extractor_run_id, artifact_kind, artifact_uri) DO UPDATE SET
        media_type = EXCLUDED.media_type,
        coverage_geom = EXCLUDED.coverage_geom,
        metadata = EXCLUDED.metadata
    `,
    [
      insertedRun.id,
      cityId,
      sourcePlanUri,
      JSON.stringify({
        extractorKey: definition.extractor_key,
        sourceCandidates: definition.source_candidates || [],
        outputLayerKeys: definition.output_layer_keys || [],
        actualSourceDataDownloaded: false,
        nextAdapterStep: 'Connect a concrete DEM, weather, hydrology, or STAC source adapter and write measured or modelled phenomenon cells.',
      }),
    ],
  )

  return insertedRun
}

export async function registerLdtEnvironmentalExtractorContracts({
  cityIds = DEFAULT_CITY_IDS,
  scenarioKey = DEFAULT_SCENARIO_KEY,
  requestedBy = 'system',
  requestedByKind = 'system',
  triggerKind = 'manual',
  runVersion = DEFAULT_RUN_VERSION,
} = {}) {
  return await withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const targetCityIds = await listCityIds(client, cityIds)
      const definitions = await client.query(
        `
          SELECT *
          FROM ldt_environment.extractor_definitions
          WHERE enabled
          ORDER BY extractor_family, extractor_key
        `,
      )

      const cities = []
      for (const cityId of targetCityIds) {
        const runs = []
        for (const definition of definitions.rows) {
          const run = await ensureExtractorRun(client, cityId, definition, {
            scenarioKey,
            requestedBy,
            requestedByKind,
            triggerKind,
            runVersion,
          })
          runs.push({
            extractorKey: run.extractor_key,
            runKey: run.run_key,
            status: run.status,
            sourceStatus: run.source_status,
          })
        }
        cities.push({ cityId, runCount: runs.length, runs })
      }

      await client.query('COMMIT')
      return {
        ok: true,
        schema: 'ldt_environment',
        contract: 'environmental-source-extractors',
        scenarioKey,
        runVersion,
        extractorCount: definitions.rowCount,
        cityCount: cities.length,
        cities,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

export async function getLdtEnvironmentalExtractors(cityId) {
  return await withClient(async (client) => {
    const definitions = await client.query(
      `
        SELECT *
        FROM ldt_environment.extractor_definitions
        WHERE enabled
        ORDER BY
          CASE extractor_key
            WHEN 'terrain-dem' THEN 1
            WHEN 'weather-field' THEN 2
            WHEN 'hydrology-grid' THEN 3
            WHEN 'stac-derived-indicator' THEN 4
            ELSE 20
          END,
          extractor_key
      `,
    )
    const runs = await client.query(
      `
        SELECT DISTINCT ON (extractor_key)
          *
        FROM ldt_environment.extractor_run_status
        WHERE city_id = $1
        ORDER BY extractor_key, updated_at DESC, created_at DESC
      `,
      [cityId],
    )
    const runByExtractor = new Map(runs.rows.map((row) => [row.extractor_key, normalizeExtractorRun(row)]))
    return {
      ok: true,
      cityId,
      contract: 'environmental-source-extractors',
      extractors: definitions.rows.map((row) => {
        const definition = normalizeExtractorDefinition(row)
        return {
          ...definition,
          latestRun: runByExtractor.get(definition.key) || null,
        }
      }),
    }
  })
}

export async function getLdtEnvironmentalExtractorRuns(cityId, {
  extractorKey = '',
  scenarioKey = '',
  limit = DEFAULT_RUN_LIMIT,
} = {}) {
  const rowLimit = integerValue(limit, DEFAULT_RUN_LIMIT, 1, MAX_RUN_LIMIT)
  const stableExtractorKey = compactText(extractorKey)
  const stableScenarioKey = compactText(scenarioKey)
  return await withClient(async (client) => {
    const runs = await client.query(
      `
        SELECT *
        FROM ldt_environment.extractor_run_status
        WHERE city_id = $1
          AND ($2::text = '' OR extractor_key = $2)
          AND ($3::text = '' OR scenario_key = $3)
        ORDER BY updated_at DESC, created_at DESC
        LIMIT $4
      `,
      [cityId, stableExtractorKey, stableScenarioKey, rowLimit],
    )
    const runIds = runs.rows.map((row) => row.run_id)
    let artifacts = []
    if (runIds.length > 0) {
      const artifactRows = await client.query(
        `
          SELECT
            artifacts.id,
            artifacts.extractor_run_id,
            artifacts.artifact_kind,
            artifacts.artifact_uri,
            artifacts.media_type,
            artifacts.byte_size,
            artifacts.checksum,
            artifacts.temporal_start,
            artifacts.temporal_end,
            artifacts.metadata,
            artifacts.created_at,
            ST_AsGeoJSON(artifacts.coverage_geom)::jsonb AS coverage_geometry
          FROM ldt_environment.extractor_artifacts artifacts
          WHERE artifacts.extractor_run_id = ANY($1::uuid[])
          ORDER BY artifacts.created_at DESC
        `,
        [runIds],
      )
      artifacts = artifactRows.rows
    }
    const artifactsByRunId = new Map()
    for (const artifact of artifacts) {
      const entries = artifactsByRunId.get(artifact.extractor_run_id) || []
      entries.push({
        id: artifact.id,
        kind: artifact.artifact_kind,
        uri: artifact.artifact_uri,
        mediaType: artifact.media_type,
        byteSize: artifact.byte_size === null ? null : Number(artifact.byte_size),
        checksum: artifact.checksum,
        temporalStart: artifact.temporal_start,
        temporalEnd: artifact.temporal_end,
        coverageGeometry: artifact.coverage_geometry,
        metadata: artifact.metadata || {},
        createdAt: artifact.created_at,
      })
      artifactsByRunId.set(artifact.extractor_run_id, entries)
    }

    return {
      ok: true,
      cityId,
      contract: 'environmental-source-extractors',
      numberReturned: runs.rowCount,
      runs: runs.rows.map((row) => ({
        ...normalizeExtractorRun(row),
        artifacts: artifactsByRunId.get(row.run_id) || [],
      })),
    }
  })
}

export async function closeLdtEnvironmentalExtractorPool() {
  await closeSharedProductionPool()
}
