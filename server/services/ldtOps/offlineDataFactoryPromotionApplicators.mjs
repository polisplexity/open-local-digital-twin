import fs from 'node:fs'
import path from 'node:path'

import { upsertCity3dTilesetRecord } from '../../db/productionTwinStore/city3dTilesetRepository.mjs'
import { upsertViewerArtifactRecord } from '../../db/productionTwinStore/viewerArtifactRepository.mjs'

function numberValue(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function textValue(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function lowerText(value) {
  return String(value ?? '').trim().toLowerCase()
}

function firstExistingPath(paths = []) {
  return paths
    .map((entry) => String(entry ?? '').trim())
    .find((entry) => entry && fs.existsSync(entry)) ?? null
}

function artifactTypeOf(artifact = {}) {
  return textValue(artifact.artifactType ?? artifact.artifact_type ?? artifact.artifactKind ?? artifact.artifact_kind)
}

function artifactMetadata(artifact = {}) {
  const metadata = artifact.metadata ?? {}
  return metadata && typeof metadata === 'object' ? metadata : {}
}

function artifactBounds(artifact = {}) {
  const metadata = artifactMetadata(artifact)
  return artifact.bounds ?? metadata.bounds ?? metadata.boundingVolume ?? {}
}

function artifactGeneratedAt(artifact = {}) {
  const metadata = artifactMetadata(artifact)
  return artifact.generatedAt ?? artifact.generated_at ?? metadata.generatedAt ?? null
}

async function findExistingViewerArtifact(client, { cityId, artifactKey, artifactType, version }) {
  const result = await client.query(
    `
      SELECT artifact_key, artifact_type, version, status, checksum, local_path
      FROM ldt_viewer.viewer_artifacts
      WHERE city_id = $1
        AND artifact_key = $2
        AND artifact_type = $3
        AND version = $4
        AND status = 'ready'
      LIMIT 1
    `,
    [cityId, artifactKey, artifactType, version],
  )
  return result.rows[0] ?? null
}

async function hasExistingCity3dTileset(client, { cityId, tilesetKey, version }) {
  const result = await client.query(
    `
      SELECT count(*)::int AS tilesets
      FROM ldt_viewer.city_3d_tilesets
      WHERE city_id = $1
        AND tileset_key = $2
        AND version = $3
        AND status = 'ready'
    `,
    [cityId, tilesetKey, version],
  )
  return numberValue(result.rows[0]?.tilesets) > 0
}

async function stageViewerArtifactRows(client, resultPackage) {
  const cityId = textValue(resultPackage.cityId)
  const artifacts = resultPackage.promotion?.viewerArtifacts?.artifacts ?? []
  const staged = []
  const missing = []
  for (const artifact of artifacts) {
    const artifactKey = textValue(artifact.artifactKey ?? artifact.artifact_key)
    const artifactType = artifactTypeOf(artifact)
    const version = textValue(artifact.version)
    if (!cityId || !artifactKey || !artifactType || !version) continue

    const metadata = artifactMetadata(artifact)
    const localPath = firstExistingPath([artifact.localPath, artifact.local_path, artifact.sourcePath, artifact.source_path])
    if (!localPath) {
      const existingArtifact = await findExistingViewerArtifact(client, { cityId, artifactKey, artifactType, version })
      const checksum = artifact.checksum ?? null
      const checksumMatches = !checksum || existingArtifact?.checksum === checksum
      const existing3dTilesetOk = artifactType !== '3d-tiles' || await hasExistingCity3dTileset(client, {
        cityId,
        tilesetKey: artifactKey,
        version,
      })
      if (existingArtifact && checksumMatches && existing3dTilesetOk) {
        staged.push({
          artifactKey,
          artifactType,
          version,
          localPath: existingArtifact.local_path ?? null,
          registered: true,
          alreadyRegistered: true,
        })
        continue
      }
      missing.push({
        artifactKey,
        artifactType,
        version,
        candidatePaths: [
          artifact.localPath,
          artifact.local_path,
          artifact.sourcePath,
          artifact.source_path,
        ].map((entry) => String(entry ?? '').trim()).filter(Boolean),
      })
      continue
    }

    if (artifactType === '3d-tiles') {
      const tilesetPath = firstExistingPath([
        metadata.tilesetPath,
        artifact.tilesetPath,
        path.join(localPath, 'tileset.json'),
      ])
      if (!tilesetPath) {
        missing.push({
          artifactKey,
          artifactType,
          version,
          candidatePaths: [
            metadata.tilesetPath,
            artifact.tilesetPath,
            path.join(localPath, 'tileset.json'),
          ].map((entry) => String(entry ?? '').trim()).filter(Boolean),
        })
        continue
      }
      await upsertCity3dTilesetRecord({
        cityId,
        tilesetKey: artifactKey,
        version,
        status: artifact.status ?? 'ready',
        contentState: artifact.contentState ?? artifact.content_state ?? 'generated',
        sourceQuery: artifact.sourceQuery ?? artifact.source_query ?? {},
        semanticClasses: artifact.semanticClasses ?? artifact.semantic_classes ?? ['buildings'],
        assetRoot: localPath,
        tilesetUrl: artifact.uri,
        tilesetPath,
        featureCount: numberValue(artifact.featureCount ?? artifact.feature_count),
        objectCount: numberValue(artifact.objectCount ?? artifact.object_count),
        byteSize: numberValue(artifact.byteSize ?? artifact.byte_size),
        geometricError: numberValue(artifact.geometricError ?? artifact.geometric_error ?? metadata.geometricError, 0),
        boundingVolume: artifactBounds(artifact),
        metadata,
      }, { client })
    }

    const stagedArtifact = await upsertViewerArtifactRecord({
      cityId,
      artifactKey,
      artifactType,
      transport: artifact.transport ?? artifactType,
      version,
      status: artifact.status ?? 'ready',
      contentState: artifact.contentState ?? artifact.content_state ?? 'generated',
      active: artifact.active === true,
      sourceScope: artifact.sourceScope ?? artifact.source_scope ?? {},
      generator: metadata.generator ?? artifact.generator ?? 'Data Factory viewer-artifacts runner',
      checksum: artifact.checksum ?? null,
      byteSize: numberValue(artifact.byteSize ?? artifact.byte_size),
      featureCount: numberValue(artifact.featureCount ?? artifact.feature_count),
      objectCount: numberValue(artifact.objectCount ?? artifact.object_count),
      tileCount: numberValue(artifact.tileCount ?? artifact.tile_count),
      bounds: artifactBounds(artifact),
      uri: artifact.uri,
      localPath,
      mediaType: artifact.mediaType ?? artifact.media_type ?? null,
      metadata,
      invalidationSource: 'data-factory-result-import',
      generatedAt: artifactGeneratedAt(artifact),
    }, { client, activate: artifact.active === true })
    staged.push({
      artifactKey,
      artifactType,
      version,
      localPath,
      registered: Boolean(stagedArtifact),
    })
  }
  if (missing.length > 0) {
    throw new Error(`OFFLINE_VIEWER_ARTIFACT_LOCAL_PATH_MISSING:${JSON.stringify(missing)}`)
  }
  return {
    expectedArtifacts: artifacts.length,
    stagedArtifacts: staged.length,
    staged,
  }
}

function camelCounts(row = {}) {
  return {
    activeSemanticTags: numberValue(row.active_semantic_tags),
    semanticClasses: numberValue(row.semantic_classes),
    sourceMappings: numberValue(row.source_mappings),
    cityPackBindings: numberValue(row.city_pack_bindings),
    serviceIndicators: numberValue(row.service_indicators),
    serviceFeatures: numberValue(row.service_features),
    serviceWorkflows: numberValue(row.service_workflows),
    workflowContracts: numberValue(row.workflow_contracts),
    ruleChecks: numberValue(row.rule_checks),
  }
}

function expectedSemanticMinimums(resultPackage) {
  const postgis = resultPackage.promotion?.postgis ?? {}
  const raw = postgis.expectedMinimums ?? postgis.expected_minimums ?? resultPackage.resultSummary?.expectedMinimums ?? {}
  return {
    activeSemanticTags: numberValue(raw.activeSemanticTags ?? raw.active_semantic_tags ?? raw.semanticTags, 1),
    semanticClasses: numberValue(raw.semanticClasses ?? raw.semantic_classes, 1),
    sourceMappings: numberValue(raw.sourceMappings ?? raw.source_mappings, 1),
    cityPackBindings: numberValue(raw.cityPackBindings ?? raw.city_pack_bindings ?? raw.semanticPacks, 1),
    serviceIndicators: numberValue(raw.serviceIndicators ?? raw.service_indicators, 1),
    serviceFeatures: numberValue(raw.serviceFeatures ?? raw.service_features, 1),
    serviceWorkflows: numberValue(raw.serviceWorkflows ?? raw.service_workflows, 1),
    workflowContracts: numberValue(raw.workflowContracts ?? raw.workflow_contracts, 1),
    ruleChecks: numberValue(raw.ruleChecks ?? raw.rule_checks, 1),
  }
}

function expectedViewerArtifactMinimums(resultPackage) {
  const viewerArtifacts = resultPackage.promotion?.viewerArtifacts ?? {}
  const raw = viewerArtifacts.expectedMinimums ?? viewerArtifacts.expected_minimums ?? resultPackage.resultSummary?.viewerArtifacts ?? {}
  return {
    registeredArtifacts: numberValue(raw.registeredArtifacts ?? raw.registered_artifacts ?? raw.artifactCount, 1),
    activeArtifacts: numberValue(raw.activeArtifacts ?? raw.active_artifacts, 1),
    mvtDirectories: numberValue(raw.mvtDirectories ?? raw.mvt_directories, 0),
    pmtiles: numberValue(raw.pmtiles, 0),
    threeDTiles: numberValue(raw.threeDTiles ?? raw.three_d_tiles, 0),
  }
}

function expectedIngestionQueueMinimums(resultPackage) {
  const postgis = resultPackage.promotion?.postgis ?? {}
  const raw = postgis.expectedMinimums ?? postgis.expected_minimums ?? resultPackage.resultSummary?.ingestionQueue ?? {}
  return {
    ingestionJobs: numberValue(raw.ingestionJobs ?? raw.ingestion_jobs ?? raw.jobCount, 1),
    queueableJobs: numberValue(raw.queueableJobs ?? raw.queueable_jobs, 1),
  }
}

function expectedEnvironmentalExtractorMinimums(resultPackage) {
  const postgis = resultPackage.promotion?.postgis ?? {}
  const raw = postgis.expectedMinimums ?? postgis.expected_minimums ?? resultPackage.resultSummary?.environmentalExtractors ?? {}
  return {
    extractorDefinitions: numberValue(raw.extractorDefinitions ?? raw.extractor_definitions, 1),
    extractorRuns: numberValue(raw.extractorRuns ?? raw.extractor_runs ?? raw.runCount, 1),
    sourcePlanRuns: numberValue(raw.sourcePlanRuns ?? raw.source_plan_runs, 1),
    sourcePlanArtifacts: numberValue(raw.sourcePlanArtifacts ?? raw.source_plan_artifacts, 1),
    completedExtractorRuns: numberValue(raw.completedExtractorRuns ?? raw.completed_extractor_runs, 0),
    sourceBackedLayers: numberValue(raw.sourceBackedLayers ?? raw.source_backed_layers, 0),
    phenomenonCells: numberValue(raw.phenomenonCells ?? raw.phenomenon_cells, 0),
    objectObservations: numberValue(raw.objectObservations ?? raw.object_observations, 0),
    objectSummaries: numberValue(raw.objectSummaries ?? raw.object_summaries, 0),
    simulationRuns: numberValue(raw.simulationRuns ?? raw.simulation_runs, 0),
    scenarioOutputs: numberValue(raw.scenarioOutputs ?? raw.scenario_outputs, 0),
  }
}

function failedMinimumChecks(evidence, expectedMinimums) {
  return Object.entries(expectedMinimums)
    .filter(([, expected]) => expected > 0)
    .filter(([key, expected]) => numberValue(evidence[key]) < expected)
    .map(([key, expected]) => ({
      key,
      expectedMinimum: expected,
      actual: numberValue(evidence[key]),
    }))
}

function failedListedArtifactChecks(evidence, expectedArtifacts = []) {
  const rows = new Map((evidence.artifacts ?? []).map((artifact) => [
    `${artifact.artifactKey}:${artifact.artifactType}:${artifact.version}`,
    artifact,
  ]))
  return expectedArtifacts
    .filter((artifact) => artifact?.artifactKey && artifact?.artifactType && artifact?.version)
    .map((artifact) => ({
      expected: artifact,
      actual: rows.get(`${artifact.artifactKey}:${artifact.artifactType}:${artifact.version}`),
    }))
    .filter(({ expected, actual }) => {
      if (!actual) return true
      if (expected.checksum && actual.checksum !== expected.checksum) return true
      if (expected.active === true && actual.active !== true) return true
      return false
    })
    .map(({ expected, actual }) => ({
      key: `${expected.artifactKey}:${expected.artifactType}:${expected.version}`,
      expected: {
        checksum: expected.checksum ?? null,
        active: expected.active === true,
      },
      actual: actual ? {
        checksum: actual.checksum ?? null,
        active: actual.active === true,
        status: actual.status ?? null,
      } : null,
    }))
}

function failedListedIngestionJobChecks(evidence, expectedJobs = []) {
  const rows = new Map((evidence.jobs ?? []).map((job) => [String(job.jobId), job]))
  return expectedJobs
    .filter((job) => job?.jobId)
    .map((job) => ({
      expected: job,
      actual: rows.get(String(job.jobId)),
    }))
    .filter(({ actual }) => !actual)
    .map(({ expected }) => ({
      key: `ingestion-job:${expected.jobId}`,
      expected: {
        layerKey: expected.layerKey ?? null,
        action: expected.action ?? null,
      },
      actual: null,
    }))
}

async function semanticMaterializationEvidence(client, cityId) {
  const result = await client.query(
    `
      SELECT
        (
          SELECT count(*)::int
          FROM ldt_semantic.entity_semantic_tags tag
          JOIN ldt_core.city_entities entity ON entity.id = tag.entity_id
          WHERE entity.city_id = $1
            AND tag.valid_to IS NULL
        ) AS active_semantic_tags,
        (SELECT count(*)::int FROM ldt_semantic.semantic_class_registry) AS semantic_classes,
        (
          SELECT count(*)::int
          FROM ldt_semantic.source_semantic_mappings mapping
          WHERE mapping.city_id = $1 OR mapping.city_id IS NULL
        ) AS source_mappings,
        (
          SELECT count(*)::int
          FROM ldt_semantic.city_pack_bindings binding
          WHERE binding.city_id = $1
            AND binding.active = true
        ) AS city_pack_bindings,
        (SELECT count(*)::int FROM ldt_semantic.service_indicators WHERE city_id = $1) AS service_indicators,
        (SELECT count(*)::int FROM ldt_semantic.service_features WHERE city_id = $1) AS service_features,
        (SELECT count(*)::int FROM ldt_semantic.service_workflows WHERE city_id = $1) AS service_workflows,
        (SELECT count(*)::int FROM ldt_semantic.workflow_contracts WHERE city_id = $1) AS workflow_contracts,
        (SELECT count(*)::int FROM ldt_semantic.rule_check_results WHERE city_id = $1) AS rule_checks
    `,
    [cityId],
  )
  return camelCounts(result.rows[0] ?? {})
}

async function ingestionQueueEvidence(client, cityId, expectedJobIds = []) {
  const jobIdList = expectedJobIds.map((jobId) => String(jobId)).filter(Boolean)
  const result = await client.query(
    `
      SELECT
        count(*)::int AS ingestion_jobs,
        count(*) FILTER (WHERE status IN ('queued', 'registered', 'running', 'completed'))::int AS queueable_jobs,
        count(*) FILTER (WHERE status = 'queued')::int AS queued_jobs,
        count(*) FILTER (WHERE status = 'registered')::int AS registered_jobs,
        count(*) FILTER (WHERE status = 'completed')::int AS completed_jobs,
        count(*) FILTER (WHERE status = 'failed')::int AS failed_jobs
      FROM layer_ingestion_jobs
      WHERE city_id = $1
        AND (
          cardinality($2::uuid[]) = 0
          OR id = ANY($2::uuid[])
        )
    `,
    [cityId, jobIdList],
  )
  const row = result.rows[0] ?? {}
  const jobResult = await client.query(
    `
      SELECT
        lij.id,
        lij.status,
        lij.requested_action,
        lij.source_format,
        lij.source_uri,
        lij.validation_summary,
        lij.idempotency_key,
        ld.key AS layer_key
      FROM layer_ingestion_jobs lij
      LEFT JOIN layer_definitions ld ON ld.id = lij.layer_id
      WHERE lij.city_id = $1
        AND (
          cardinality($2::uuid[]) = 0
          OR lij.id = ANY($2::uuid[])
        )
      ORDER BY lij.created_at DESC
      LIMIT 100
    `,
    [cityId, jobIdList],
  )
  return {
    ingestionJobs: numberValue(row.ingestion_jobs),
    queueableJobs: numberValue(row.queueable_jobs),
    queuedJobs: numberValue(row.queued_jobs),
    registeredJobs: numberValue(row.registered_jobs),
    completedJobs: numberValue(row.completed_jobs),
    failedJobs: numberValue(row.failed_jobs),
    jobs: jobResult.rows.map((job) => ({
      jobId: job.id,
      layerKey: job.layer_key,
      action: job.requested_action,
      sourceFormat: job.source_format,
      sourceUri: job.source_uri,
      status: job.status,
      idempotencyKey: job.idempotency_key,
      validationSummary: job.validation_summary ?? {},
    })),
  }
}

async function environmentalExtractorEvidence(client, cityId, resultPackage = {}) {
  const summary = resultPackage.resultSummary?.environmentalExtractors ?? {}
  const scenarioKey = String(summary.scenarioKey ?? 'baseline').trim() || 'baseline'
  const layerKeys = [
    'terrain_elevation_m',
    'terrain_slope_deg',
    'weather_air_temperature_c',
    'weather_wind_speed_ms',
    'weather_wind_direction_deg',
    'hydrology_surface_water_signal',
    'surface_runoff_screening',
  ]
  const result = await client.query(
    `
      SELECT
        (SELECT count(*)::int FROM ldt_environment.extractor_definitions WHERE enabled) AS extractor_definitions,
        (SELECT count(*)::int FROM ldt_environment.extractor_runs WHERE city_id = $1) AS extractor_runs,
        (
          SELECT count(*)::int
          FROM ldt_environment.extractor_runs
          WHERE city_id = $1
            AND status = 'registered'
            AND source_status = 'source-plan-only'
        ) AS source_plan_runs,
        (
          SELECT count(*)::int
          FROM ldt_environment.extractor_artifacts
          WHERE city_id = $1
            AND artifact_kind = 'source-plan'
        ) AS source_plan_artifacts,
        (
          SELECT count(*)::int
          FROM ldt_environment.extractor_runs
          WHERE city_id = $1
            AND scenario_key = $2
            AND extractor_key = ANY($3::text[])
            AND status = 'completed'
            AND source_status = 'source-backed-open-data'
        ) AS completed_extractor_runs,
        (
          SELECT count(*)::int
          FROM ldt_environment.phenomenon_layers
          WHERE layer_key = ANY($4::text[])
            AND enabled = true
            AND source_status = 'source-backed-open-data'
        ) AS source_backed_layers,
        (
          SELECT count(*)::int
          FROM ldt_environment.phenomenon_cells cells
          JOIN ldt_environment.phenomenon_layers layers ON layers.id = cells.layer_id
          WHERE cells.city_id = $1
            AND cells.scenario_key = $2
            AND layers.layer_key = ANY($4::text[])
        ) AS phenomenon_cells,
        (
          SELECT count(*)::int
          FROM ldt_environment.object_observations observations
          JOIN ldt_environment.phenomenon_layers layers ON layers.id = observations.layer_id
          WHERE observations.city_id = $1
            AND observations.scenario_key = $2
            AND layers.layer_key = ANY($4::text[])
        ) AS object_observations,
        (
          SELECT count(*)::int
          FROM ldt_environment.object_observation_summary
          WHERE city_id = $1
            AND scenario_key = $2
            AND values ?| $4::text[]
        ) AS object_summaries,
        (
          SELECT count(*)::int
          FROM ldt_science.simulation_runs runs
          JOIN ldt_science.simulation_models models ON models.id = runs.model_id
          WHERE runs.city_id = $1
            AND runs.scenario_key = $2
            AND models.model_key = 'surface-runoff-screening-v0'
            AND runs.status = 'completed'
        ) AS simulation_runs,
        (
          SELECT count(*)::int
          FROM ldt_science.scenario_outputs outputs
          JOIN ldt_science.scenario_definitions definitions ON definitions.id = outputs.scenario_definition_id
          WHERE outputs.city_id = $1
            AND definitions.scenario_key = 'surface-runoff-screening'
        ) AS scenario_outputs
    `,
    [cityId, scenarioKey, ['terrain-dem', 'weather-field', 'hydrology-grid'], layerKeys],
  )
  const row = result.rows[0] ?? {}
  const runResult = await client.query(
    `
      SELECT
        run.id,
        run.extractor_key,
        run.run_key,
        run.status,
        run.source_status,
        count(artifact.id)::int AS artifact_count
      FROM ldt_environment.extractor_runs run
      LEFT JOIN ldt_environment.extractor_artifacts artifact ON artifact.extractor_run_id = run.id
      WHERE run.city_id = $1
      GROUP BY run.id
      ORDER BY run.updated_at DESC, run.extractor_key
      LIMIT 100
    `,
    [cityId],
  )
  return {
    extractorDefinitions: numberValue(row.extractor_definitions),
    extractorRuns: numberValue(row.extractor_runs),
    sourcePlanRuns: numberValue(row.source_plan_runs),
    sourcePlanArtifacts: numberValue(row.source_plan_artifacts),
    completedExtractorRuns: numberValue(row.completed_extractor_runs),
    sourceBackedLayers: numberValue(row.source_backed_layers),
    phenomenonCells: numberValue(row.phenomenon_cells),
    objectObservations: numberValue(row.object_observations),
    objectSummaries: numberValue(row.object_summaries),
    simulationRuns: numberValue(row.simulation_runs),
    scenarioOutputs: numberValue(row.scenario_outputs),
    scenarioKey,
    runs: runResult.rows.map((run) => ({
      runId: run.id,
      extractorKey: run.extractor_key,
      runKey: run.run_key,
      status: run.status,
      sourceStatus: run.source_status,
      artifactCount: numberValue(run.artifact_count),
    })),
  }
}

async function viewerArtifactEvidence(client, cityId) {
  const result = await client.query(
    `
      SELECT
        count(*)::int AS registered_artifacts,
        count(*) FILTER (WHERE active = true)::int AS active_artifacts,
        count(*) FILTER (WHERE artifact_type = 'mvt-directory')::int AS mvt_directories,
        count(*) FILTER (WHERE artifact_type = 'pmtiles')::int AS pmtiles,
        count(*) FILTER (WHERE artifact_type = '3d-tiles')::int AS three_d_tiles
      FROM ldt_viewer.viewer_artifacts
      WHERE city_id = $1
        AND status = 'ready'
        AND artifact_key !~ '^smoke-'
        AND version !~ '^smoke-'
    `,
    [cityId],
  )
  const row = result.rows[0] ?? {}
  const artifactResult = await client.query(
    `
      SELECT
        artifact_key,
        artifact_type,
        transport,
        version,
        status,
        active,
        checksum,
        byte_size,
        feature_count,
        tile_count,
        uri,
        local_path
      FROM ldt_viewer.viewer_artifacts
      WHERE city_id = $1
        AND status = 'ready'
        AND artifact_key !~ '^smoke-'
        AND version !~ '^smoke-'
      ORDER BY active DESC, generated_at DESC, updated_at DESC
      LIMIT 100
    `,
    [cityId],
  )
  return {
    registeredArtifacts: numberValue(row.registered_artifacts),
    activeArtifacts: numberValue(row.active_artifacts),
    mvtDirectories: numberValue(row.mvt_directories),
    pmtiles: numberValue(row.pmtiles),
    threeDTiles: numberValue(row.three_d_tiles),
    artifacts: artifactResult.rows.map((artifact) => ({
      artifactKey: artifact.artifact_key,
      artifactType: artifact.artifact_type,
      transport: artifact.transport,
      version: artifact.version,
      status: artifact.status,
      active: Boolean(artifact.active),
      checksum: artifact.checksum,
      byteSize: numberValue(artifact.byte_size),
      featureCount: numberValue(artifact.feature_count),
      tileCount: numberValue(artifact.tile_count),
      uri: artifact.uri,
      localPath: artifact.local_path,
    })),
  }
}

function requestsStagePromotion(resultPackage) {
  const mode = lowerText(resultPackage.promotion?.mode)
  const postgis = resultPackage.promotion?.postgis ?? {}
  const status = lowerText(postgis.status)
  return Boolean(
    mode === 'stage-applicator' ||
    mode === 'stage-promotion' ||
    postgis.stageApplicator ||
    ['promoted', 'validated-promoted', 'succeeded'].includes(status),
  )
}

export async function applyOfflineDataFactoryPromotion(client, resultPackage) {
  if (resultPackage.status !== 'succeeded' || !requestsStagePromotion(resultPackage)) {
    return resultPackage
  }
  if (resultPackage.stageKey === 'viewer-artifacts') {
    const stageResult = await stageViewerArtifactRows(client, resultPackage)
    const evidence = await viewerArtifactEvidence(client, resultPackage.cityId)
    const expectedMinimums = expectedViewerArtifactMinimums(resultPackage)
    const minimumFailures = failedMinimumChecks(evidence, expectedMinimums)
    const listedFailures = failedListedArtifactChecks(evidence, resultPackage.promotion?.viewerArtifacts?.artifacts)
    const failures = [...minimumFailures, ...listedFailures]
    if (failures.length > 0) {
      const detail = failures.map((failure) => `${failure.key}:${JSON.stringify(failure)}`).join(',')
      throw new Error(`OFFLINE_VIEWER_ARTIFACT_PROMOTION_EVIDENCE_MISMATCH:${detail}`)
    }
    const viewerArtifacts = resultPackage.promotion?.viewerArtifacts ?? {}
    return {
      ...resultPackage,
      promotion: {
        ...resultPackage.promotion,
        mode: resultPackage.promotion?.mode ?? 'stage-applicator',
        postgis: {
          ...(resultPackage.promotion?.postgis ?? {}),
          status: 'not-applicable',
          writes: [],
          note: 'Viewer artifact promotion validates the artifact registry and does not write domain PostGIS tables.',
        },
        viewerArtifacts: {
          ...viewerArtifacts,
          status: 'promoted',
          stageApplicator: 'viewer-artifacts',
          expectedMinimums,
          evidence,
          applicator: {
            key: 'viewer-artifacts-registry',
            status: 'validated',
            validatedAt: new Date().toISOString(),
            stageResult,
            rule: 'Ready viewer artifacts must be registered through ldt_viewer.viewer_artifacts before viewers resolve active/latest assets.',
          },
        },
      },
    }
  }

  if (resultPackage.stageKey === 'ingestion-queue') {
    const expectedJobs = resultPackage.promotion?.postgis?.jobs ?? resultPackage.resultSummary?.ingestionQueue?.jobs ?? []
    const expectedJobIds = expectedJobs.map((job) => job?.jobId).filter(Boolean)
    const evidence = await ingestionQueueEvidence(client, resultPackage.cityId, expectedJobIds)
    const expectedMinimums = expectedIngestionQueueMinimums(resultPackage)
    const minimumFailures = failedMinimumChecks(evidence, expectedMinimums)
    const listedFailures = failedListedIngestionJobChecks(evidence, expectedJobs)
    const failures = [...minimumFailures, ...listedFailures]
    if (failures.length > 0) {
      const detail = failures.map((failure) => `${failure.key}:${JSON.stringify(failure)}`).join(',')
      throw new Error(`OFFLINE_INGESTION_QUEUE_PROMOTION_EVIDENCE_MISMATCH:${detail}`)
    }
    const postgis = resultPackage.promotion?.postgis ?? {}
    return {
      ...resultPackage,
      promotion: {
        ...resultPackage.promotion,
        mode: resultPackage.promotion?.mode ?? 'stage-applicator',
        postgis: {
          ...postgis,
          status: 'promoted',
          stageApplicator: 'ingestion-queue',
          writes: postgis.writes ?? ['public.layer_ingestion_jobs', 'public.ingestion_validation_reports'],
          expectedMinimums,
          evidence,
          applicator: {
            key: 'ingestion-queue-postgis',
            status: 'validated',
            validatedAt: new Date().toISOString(),
            rule: 'Provider ingestion jobs must exist in the queue ledger before source workers execute or promote data into the city twin.',
          },
        },
        viewerArtifacts: {
          ...(resultPackage.promotion?.viewerArtifacts ?? {}),
          status: 'not-applicable',
          artifacts: [],
        },
      },
    }
  }

  if (resultPackage.stageKey === 'environmental-extractors') {
    const evidence = await environmentalExtractorEvidence(client, resultPackage.cityId, resultPackage)
    const expectedMinimums = expectedEnvironmentalExtractorMinimums(resultPackage)
    const failures = failedMinimumChecks(evidence, expectedMinimums)
    if (failures.length > 0) {
      const detail = failures.map((failure) => `${failure.key}:${failure.actual}<${failure.expectedMinimum}`).join(',')
      throw new Error(`OFFLINE_ENVIRONMENTAL_EXTRACTOR_PROMOTION_EVIDENCE_MISMATCH:${detail}`)
    }
    const postgis = resultPackage.promotion?.postgis ?? {}
    return {
      ...resultPackage,
      promotion: {
        ...resultPackage.promotion,
        mode: resultPackage.promotion?.mode ?? 'stage-applicator',
        postgis: {
          ...postgis,
          status: 'promoted',
          stageApplicator: 'environmental-extractors',
          writes: postgis.writes ?? ['ldt_environment.extractor_runs', 'ldt_environment.extractor_artifacts'],
          expectedMinimums,
          evidence,
          applicator: {
            key: 'environmental-extractors-postgis',
            status: 'validated',
            validatedAt: new Date().toISOString(),
            rule: 'Environmental extractors must register city-scoped source-plan runs and artifacts before heavy DEM, weather, hydrology, or STAC adapters promote source-backed layers.',
          },
        },
        viewerArtifacts: {
          ...(resultPackage.promotion?.viewerArtifacts ?? {}),
          status: 'not-applicable',
          artifacts: [],
        },
      },
    }
  }

  if (resultPackage.stageKey !== 'semantic-materialization') {
    throw new Error('OFFLINE_STAGE_PROMOTION_APPLICATOR_UNSUPPORTED')
  }

  const evidence = await semanticMaterializationEvidence(client, resultPackage.cityId)
  const expectedMinimums = expectedSemanticMinimums(resultPackage)
  const failures = failedMinimumChecks(evidence, expectedMinimums)
  if (failures.length > 0) {
    const detail = failures.map((failure) => `${failure.key}:${failure.actual}<${failure.expectedMinimum}`).join(',')
    throw new Error(`OFFLINE_STAGE_PROMOTION_EVIDENCE_MISMATCH:${detail}`)
  }

  const postgis = resultPackage.promotion?.postgis ?? {}
  return {
    ...resultPackage,
    promotion: {
      ...resultPackage.promotion,
      mode: resultPackage.promotion?.mode ?? 'stage-applicator',
      postgis: {
        ...postgis,
        status: 'promoted',
        stageApplicator: 'semantic-materialization',
        writes: postgis.writes ?? [
          'ldt_semantic.entity_semantic_tags',
          'ldt_semantic.city_pack_bindings',
          'ldt_semantic.service_indicators',
          'ldt_semantic.service_features',
          'ldt_semantic.service_workflows',
          'ldt_semantic.workflow_contracts',
          'ldt_semantic.rule_check_results',
        ],
        expectedMinimums,
        evidence,
        applicator: {
          key: 'semantic-materialization-postgis',
          status: 'validated',
          validatedAt: new Date().toISOString(),
          rule: 'PostGIS semantic evidence must meet or exceed the offline result minimums before the workflow promotion step can close.',
        },
      },
    },
  }
}
