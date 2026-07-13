import { API_CATALOG, catalogRow } from './apiCatalog.mjs'
import { getCityDataFactoryExecutionModeOverrides } from './dataFactoryExecutionModeService.mjs'
import { dataFactoryStageContract } from './offlineDataFactoryStageRegistry.mjs'
import { normalizeWorkflowRun } from './workflowService.mjs'
import { withClient } from './dbUtils.mjs'
import { inspectProviderIngestionCapabilities } from '../providerLayerIngestionService.mjs'

let providerAssistCache = null

function lifecycleState(condition, fallback = 'generated') {
  return condition ? 'validated' : fallback
}

async function cachedProviderCapabilities() {
  const now = Date.now()
  if (providerAssistCache && now - providerAssistCache.readAt < 60_000) {
    return providerAssistCache.payload
  }
  const payload = await inspectProviderIngestionCapabilities()
  providerAssistCache = {
    readAt: now,
    payload,
  }
  return payload
}

function artifactEvidence(activeArtifacts = []) {
  const activeTypes = activeArtifacts.map((artifact) => artifact.artifact_type).filter(Boolean)
  return {
    activeTypes,
    activeCount: activeArtifacts.length,
    hasMvt: activeTypes.includes('mvt-directory'),
    hasPmtiles: activeTypes.includes('pmtiles'),
    has3dTiles: activeTypes.includes('3d-tiles'),
    bytes: activeArtifacts.reduce((sum, artifact) => sum + Number(artifact.byte_size ?? 0), 0),
  }
}

const DATA_FACTORY_EXECUTION_MODES = [
  {
    key: 'interactive-backend',
    label: 'Interactive backend',
    state: 'validated',
    description: 'Run lightweight source registration, validation, queueing, and artifact promotion inside the live Twin Studio backend.',
    operatorUse: 'Use when the job can finish without blocking the operator or requiring external compute/storage.',
  },
  {
    key: 'offline-data-factory',
    label: 'Offline Data Factory',
    state: 'generated',
    description: 'Export or queue heavy processing outside the live viewer path, then promote only validated PostGIS rows and versioned artifacts back into Twin Studio.',
    operatorUse: 'Use for large semantic materialization, terrain, hydrology, STAC/raster, hazard-model, or state-scale processing.',
  },
]

function stageExecutionPolicy({
  offlineEligible = false,
  preferredMode = 'interactive-backend',
  reason = 'Keep this stage in the live backend path.',
} = {}) {
  return {
    preferredMode,
    recommendedMode: preferredMode,
    selectedMode: preferredMode,
    availableModes: offlineEligible
      ? ['interactive-backend', 'offline-data-factory']
      : ['interactive-backend'],
    offlineEligible,
    operatorOverride: false,
    modeSource: 'recommendation',
    reason,
  }
}

function normalizeOfflineHandoff(row) {
  return {
    runId: row.run_id,
    workflowKey: row.workflow_key,
    workflowStatus: row.status,
    status: row.handoff_status || row.status,
    stageKey: row.stage_key,
    artifactUri: row.artifact_uri,
    checksum: row.checksum,
    byteSize: Number(row.byte_size ?? 0),
    localPath: row.local_path,
    resultStatus: row.result_status || null,
    resultArtifactUri: row.result_artifact_uri || null,
    resultChecksum: row.result_checksum || null,
    resultByteSize: Number(row.result_byte_size ?? 0),
    resultLocalPath: row.result_local_path || null,
    resultExecutorProfile: row.result_executor_profile || null,
    externalRunStatus: row.external_run_status || null,
    externalRunRunnerId: row.external_run_runner_id || null,
    dispatchReturnStatus: row.dispatch_return_status || null,
    dispatchStatus: row.dispatch_status || null,
    dispatchExecutorProfile: row.dispatch_executor_profile || null,
    dispatchArtifactUri: row.dispatch_artifact_uri || null,
    dispatchChecksum: row.dispatch_checksum || null,
    dispatchByteSize: Number(row.dispatch_byte_size ?? 0),
    dispatchLocalPath: row.dispatch_local_path || null,
    postgisPromotionStatus: row.postgis_promotion_status || null,
    viewerPromotionStatus: row.viewer_promotion_status || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeCityInputPackage(row) {
  const metadata = row.metadata ?? {}
  return {
    id: row.id,
    artifactKind: row.artifact_kind,
    artifactUri: row.artifact_uri,
    mediaType: row.media_type,
    byteSize: Number(row.byte_size ?? 0),
    checksum: row.checksum,
    packageKey: metadata.packageKey ?? row.metadata?.package_key ?? null,
    packageKind: metadata.packageKind ?? null,
    inputMode: metadata.dataPlane?.inputMode ?? 'restored-postgis-dump',
    restoreCommand: metadata.dataPlane?.restoreCommand ?? metadata.restore?.command ?? null,
    dumpByteSize: Number(metadata.databaseDump?.byteSize ?? 0),
    dumpChecksum: metadata.databaseDump?.checksum ?? null,
    sourceSummary: metadata.sourceSummary ?? null,
    localPath: metadata.localPath ?? null,
    relativePath: metadata.relativePath ?? null,
    generatedAt: metadata.generatedAt ?? row.created_at,
    createdAt: row.created_at,
  }
}

function applyExecutionModeOverrides(stages, executionModeOverrides = {}) {
  return stages.map((stage) => {
    const execution = stage.execution ?? stageExecutionPolicy()
    const recommendedMode = execution.recommendedMode ?? execution.preferredMode ?? 'interactive-backend'
    const availableModes = Array.isArray(execution.availableModes) && execution.availableModes.length
      ? execution.availableModes
      : ['interactive-backend']
    const overrideMode = executionModeOverrides[stage.key]
    const selectedMode = availableModes.includes(overrideMode) ? overrideMode : recommendedMode
    return {
      ...stage,
      execution: {
        ...execution,
        recommendedMode,
        selectedMode,
        preferredMode: selectedMode,
        operatorOverride: selectedMode !== recommendedMode,
        modeSource: selectedMode !== recommendedMode ? 'operator-override' : 'recommendation',
      },
    }
  })
}

function buildDataFactory({
  counts,
  factory,
  activeArtifacts,
  cityInputPackages = [],
  providerCapabilities,
  offlineHandoffs = [],
  executionModeOverrides = {},
}) {
  const artifacts = artifactEvidence(activeArtifacts)
  const semanticTags = Number(factory.semantic_tags ?? 0)
  const semanticWorkload = Math.max(semanticTags, Number(factory.city_entities ?? 0))
  const semanticMaterializationOffline = semanticWorkload > 100_000 && Number(factory.source_mappings ?? 0) > 0
  const semanticWorkloadEvidence = semanticTags > 0
    ? `${semanticTags} active semantic tags`
    : `${Number(factory.city_entities ?? 0)} entities ready for semantic materialization`
  const stages = [
    {
      key: 'city-boundary',
      label: 'City boundary gate',
      state: lifecycleState(Number(factory.city_boundaries ?? 0) > 0, 'blocked'),
      evidence: `${Number(factory.city_boundaries ?? 0)} city/municipal boundary records available.`,
      operatorNext: 'Keep this scoped to the city/municipality boundary unless official sub-city units exist.',
      execution: stageExecutionPolicy({
        reason: 'Boundary quality is a control gate in the live backend before sources can be promoted.',
      }),
    },
    {
      key: 'provider-assist',
      label: 'Provider assist',
      state: lifecycleState((providerCapabilities?.supportedActions ?? []).length >= 3, 'blocked'),
      evidence: `${providerCapabilities?.supportedActions?.length ?? 0} executable source actions; ${(providerCapabilities?.missingToolActions ?? []).length} need external tools.`,
      operatorNext: 'Use provider actions to validate source identity, format, and execution mode before queueing imports.',
      execution: stageExecutionPolicy({
        reason: 'Provider assist decides whether a source can be queued locally, registered as metadata, or handed to offline processing.',
      }),
    },
    {
      key: 'ingestion-queue',
      label: 'Ingestion queue',
      state: lifecycleState(Number(counts.ingestion_jobs ?? 0) > 0, 'generated'),
      evidence: `${Number(counts.ingestion_jobs ?? 0)} ingestion jobs, ${Number(counts.active_ingestion_jobs ?? 0)} active, ${Number(factory.validation_reports ?? 0)} validation reports.`,
      operatorNext: 'Queue heavy source packages as jobs; do not make the user wait inside a viewer route.',
      execution: stageExecutionPolicy({
        offlineEligible: true,
        reason: 'Small jobs can queue in the backend; very large source packages should be prepared offline and promoted back as validated artifacts.',
      }),
    },
    {
      key: 'environmental-extractors',
      label: 'Environmental extractors',
      state: lifecycleState(Number(factory.environmental_extractor_runs ?? 0) > 0 && Number(factory.environmental_extractor_artifacts ?? 0) > 0, 'generated'),
      evidence: `${Number(factory.environmental_extractor_runs ?? 0)} extractor runs and ${Number(factory.environmental_extractor_artifacts ?? 0)} source-plan artifacts for terrain, weather, hydrology, or STAC layers.`,
      operatorNext: 'Register source-plan contracts in the backend; run large DEM, weather, hydrology, or STAC adapters offline and promote validated outputs back into PostGIS.',
      execution: stageExecutionPolicy({
        offlineEligible: true,
        preferredMode: 'offline-data-factory',
        reason: 'Environmental source extraction can become compute/storage-heavy, so the product exposes it as an offline Data Factory stage while PostGIS keeps the canonical evidence.',
      }),
    },
    {
      key: 'postgis-twin',
      label: 'PostGIS city twin',
      state: lifecycleState(Number(factory.city_entities ?? 0) > 0 && Number(factory.source_evidence ?? 0) > 0, 'blocked'),
      evidence: `${Number(factory.city_entities ?? 0)} entities with ${Number(factory.source_evidence ?? 0)} source-evidence links.`,
      operatorNext: 'PostGIS remains the canonical twin; generated files are publishable artifacts, not the source of truth.',
      execution: stageExecutionPolicy({
        reason: 'PostGIS promotion happens in the backend after source/artifact validation, even when processing was done offline.',
      }),
    },
    {
      key: 'viewer-artifacts',
      label: 'Viewer artifacts',
      state: lifecycleState(artifacts.hasMvt && artifacts.hasPmtiles && artifacts.has3dTiles, artifacts.activeCount ? 'generated' : 'blocked'),
      evidence: `${artifacts.activeCount} active artifact types: ${artifacts.activeTypes.join(', ') || 'none'}.`,
      operatorNext: 'Promote MVT, PMTiles, and 3D Tiles through the artifact registry before viewers use latest.',
      execution: stageExecutionPolicy({
        offlineEligible: true,
        reason: 'Artifact generation can be done offline, but publication must happen through the viewer artifact registry.',
      }),
    },
    {
      key: 'semantic-materialization',
      label: 'Semantic materialization',
      state: lifecycleState(semanticTags > 0, 'generated'),
      evidence: `${semanticTags} object-level semantic tags from ${Number(factory.source_mappings ?? 0)} source mappings.`,
      operatorNext: semanticMaterializationOffline
        ? 'Run this as an offline Data Factory job and promote the result back into PostGIS.'
        : 'Keep this as a repeatable backend job, not as React/query-side inference.',
      execution: stageExecutionPolicy({
        offlineEligible: true,
        preferredMode: semanticMaterializationOffline ? 'offline-data-factory' : 'interactive-backend',
        reason: semanticMaterializationOffline
          ? `The active city has ${semanticWorkloadEvidence}, so full rematerialization should run offline and promote the result back into PostGIS.`
          : 'The active city can still run semantic materialization in the backend without an offline handoff.',
      }),
    },
    {
      key: 'operations-evidence',
      label: 'Operations evidence',
      state: lifecycleState(Number(counts.api_events ?? 0) > 0 || Number(counts.workflow_runs ?? 0) > 0, 'generated'),
      evidence: `${Number(counts.api_events ?? 0)} API events and ${Number(counts.workflow_runs ?? 0)} workflow runs recorded.`,
      operatorNext: 'Use this evidence to know when the factory ran, failed, retried, or published a new version.',
      execution: stageExecutionPolicy({
        reason: 'Operations evidence is written by the live backend after interactive or offline jobs report status.',
      }),
    },
  ]
  const stagesWithContracts = stages.map((stage) => ({
    ...stage,
    stageContract: dataFactoryStageContract(stage.key),
  }))
  const resolvedStages = applyExecutionModeOverrides(stagesWithContracts, executionModeOverrides)
  const offlineCandidateStages = resolvedStages
    .filter((stage) => stage.execution?.preferredMode === 'offline-data-factory')
    .map((stage) => stage.key)
  return {
    key: 'data-factory',
    label: 'Data Factory',
    explanation: 'The backend pipeline that turns external/open sources into PostGIS records and versioned viewer artifacts.',
    lifecycleStates: ['generated', 'validated', 'blocked', 'deferred'],
    executionModes: DATA_FACTORY_EXECUTION_MODES,
    executionModeOverrides,
    offlineCandidateStages,
    offlineEligibleStages: resolvedStages.filter((stage) => stage.execution?.offlineEligible).map((stage) => stage.key),
    externalComputeCandidateStages: offlineCandidateStages,
    offlineHandoffs,
    cityInputPackages,
    cityInputPackageSummary: {
      count: cityInputPackages.length,
      latest: cityInputPackages[0] ?? null,
      inputMode: cityInputPackages.length ? 'restored-postgis-dump' : 'not-packaged',
    },
    stages: resolvedStages,
    summary: {
      validated: resolvedStages.filter((stage) => stage.state === 'validated').length,
      generated: resolvedStages.filter((stage) => stage.state === 'generated').length,
      blocked: resolvedStages.filter((stage) => stage.state === 'blocked').length,
      deferred: resolvedStages.filter((stage) => stage.state === 'deferred').length,
    },
  }
}

function providerMachineHelp(capability) {
  if (capability.runtimeStatus === 'tool-missing') return `Install or provide ${capability.requiredTools.join(', ')} before execution.`
  if (capability.runtimeStatus === 'metadata-only') return 'Register metadata now; full processing requires a later artifact pipeline.'
  return `Machine can execute and write: ${(capability.writes ?? []).join(', ')}.`
}

function buildProviderAssist({ providerCapabilities, factory }) {
  const capabilities = (providerCapabilities?.capabilities ?? []).map((capability) => ({
    key: capability.key,
    label: capability.label,
    category: capability.category,
    state: capability.runtimeStatus === 'ready'
      ? 'validated'
      : capability.runtimeStatus === 'metadata-only'
        ? 'generated'
        : 'blocked',
    canExecute: capability.canExecute,
    canRegister: capability.canRegister,
    runtimeStatus: capability.runtimeStatus,
    requiredTools: capability.requiredTools ?? [],
    machineHelp: providerMachineHelp(capability),
  }))
  const machineGates = [
    {
      key: 'source-identity',
      label: 'Source identity',
      state: 'generated',
      evidence: 'Jobs carry provider, action, source format, source URI/version, and posture before execution.',
    },
    {
      key: 'city-boundary-only',
      label: 'City boundary only',
      state: lifecycleState(Number(factory.city_boundaries ?? 0) > 0, 'blocked'),
      evidence: 'Imports are scoped to the city/municipal boundary; sub-city units are not assumed.',
    },
    {
      key: 'validation-reporting',
      label: 'Validation reporting',
      state: lifecycleState(Number(factory.validation_reports ?? 0) > 0, 'generated'),
      evidence: `${Number(factory.validation_reports ?? 0)} validation reports recorded for ingestion jobs.`,
    },
    {
      key: 'semantic-mapping',
      label: 'Semantic mapping',
      state: lifecycleState(Number(factory.source_mappings ?? 0) > 0, 'blocked'),
      evidence: `${Number(factory.source_mappings ?? 0)} source-to-semantic mappings are registered.`,
    },
    {
      key: 'artifact-promotion',
      label: 'Artifact promotion',
      state: lifecycleState(Number(factory.active_artifacts ?? 0) > 0, 'blocked'),
      evidence: `${Number(factory.active_artifacts ?? 0)} active viewer artifacts are promoted through the registry.`,
    },
  ]
  return {
    key: 'provider-assist',
    label: 'Provider Assist',
    explanation: 'Guardrails that help the machine understand, validate, and queue external sources before they touch the city twin.',
    summary: {
      executableActions: providerCapabilities?.supportedActions?.length ?? 0,
      metadataOnlyActions: providerCapabilities?.metadataOnlyActions?.length ?? 0,
      missingToolActions: providerCapabilities?.missingToolActions?.length ?? 0,
      pendingAdapters: providerCapabilities?.pendingAdapters?.length ?? 0,
    },
    machineGates,
    capabilities,
  }
}

export async function getCityOperationsReport(cityId) {
  return withClient(async (client) => {
    const cityResult = await client.query(
      `
        SELECT id, name, country, country_code, region
        FROM ldt_core.cities
        WHERE id = $1
      `,
      [cityId],
    )
    if (cityResult.rowCount === 0) {
      return {
        configured: true,
        ok: false,
        cityId,
        error: 'CITY_NOT_FOUND',
      }
    }

    const apiSummary = await client.query(
      `
        SELECT
          route_family,
          method,
          path_template,
          count(*)::int AS events,
          count(*) FILTER (WHERE status_code >= 400)::int AS errors,
          max(status_code)::int AS last_status_code,
          round(avg(latency_ms)::numeric, 1)::float AS avg_latency_ms,
          max(created_at) AS last_seen_at
        FROM ldt_ops.api_usage_events
        WHERE city_id = $1 OR city_id IS NULL
        GROUP BY route_family, method, path_template
        ORDER BY events DESC, last_seen_at DESC NULLS LAST
        LIMIT 50
      `,
      [cityId],
    )

    const recentApiEvents = await client.query(
      `
        SELECT
          id,
          route_family,
          method,
          path_template,
          status_code,
          latency_ms,
          api_version,
          actor_role,
          error_code,
          created_at
        FROM ldt_ops.api_usage_events
        WHERE city_id = $1 OR city_id IS NULL
        ORDER BY created_at DESC
        LIMIT 20
      `,
      [cityId],
    )

    const ingestionJobs = await client.query(
      `
        SELECT
          job.id,
          job.job_kind,
          job.requested_action,
          job.source_format,
          job.source_uri,
          job.status,
          job.attempt_count,
          job.validation_summary,
          job.stats,
          job.error_message,
          job.created_at,
          job.updated_at,
          job.started_at,
          job.finished_at,
          provider.name AS provider_name,
          layer.key AS layer_key,
          layer.name AS layer_name,
          (
            SELECT count(*)::int
            FROM public.ingestion_validation_reports report
            WHERE report.job_id = job.id
          ) AS validation_reports
        FROM public.layer_ingestion_jobs job
        LEFT JOIN public.providers provider ON provider.id = job.provider_id
        LEFT JOIN public.layer_definitions layer ON layer.id = job.layer_id
        WHERE job.city_id = $1
        ORDER BY job.updated_at DESC, job.created_at DESC
        LIMIT 30
      `,
      [cityId],
    )

    const workflowRunsResult = await client.query(
      `
        SELECT run.*, definition.name AS workflow_name, definition.domain AS workflow_domain
        FROM ldt_ops.workflow_runs run
        LEFT JOIN ldt_ops.workflow_definitions definition ON definition.id = run.workflow_id
        WHERE run.city_id = $1
        ORDER BY run.created_at DESC
        LIMIT 20
      `,
      [cityId],
    )

    const pendingApprovals = await client.query(
      `
        SELECT
          approval.id,
          approval.approval_key,
          approval.status,
          approval.policy,
          approval.created_at,
          run.id AS run_id,
          run.workflow_key,
          definition.name AS workflow_name
        FROM ldt_ops.workflow_approvals approval
        JOIN ldt_ops.workflow_runs run ON run.id = approval.run_id
        LEFT JOIN ldt_ops.workflow_definitions definition ON definition.id = run.workflow_id
        WHERE run.city_id = $1
          AND approval.status = 'requested'
        ORDER BY approval.created_at DESC
        LIMIT 20
      `,
      [cityId],
    )

    const countsResult = await client.query(
      `
        SELECT
          (SELECT count(*) FROM ldt_ops.api_usage_events WHERE city_id = $1 OR city_id IS NULL)::int AS api_events,
          (SELECT count(DISTINCT route_family) FROM ldt_ops.api_usage_events WHERE city_id = $1 OR city_id IS NULL)::int AS api_families,
          (SELECT count(*) FROM public.layer_ingestion_jobs WHERE city_id = $1)::int AS ingestion_jobs,
          (SELECT count(*) FROM public.layer_ingestion_jobs WHERE city_id = $1 AND status IN ('queued', 'running'))::int AS active_ingestion_jobs,
          (SELECT count(*) FROM ldt_ops.workflow_runs WHERE city_id = $1)::int AS workflow_runs,
          (SELECT count(*) FROM ldt_ops.workflow_runs WHERE city_id = $1 AND status IN ('queued', 'running', 'approval_required'))::int AS active_workflow_runs,
          (
            SELECT count(*)
            FROM ldt_ops.workflow_approvals approval
            JOIN ldt_ops.workflow_runs run ON run.id = approval.run_id
            WHERE run.city_id = $1
              AND approval.status = 'requested'
          )::int AS pending_approvals
      `,
      [cityId],
    )

    const counts = countsResult.rows[0] ?? {}
    const factoryResult = await client.query(
      `
        SELECT
          (SELECT count(*) FROM ldt_core.city_entities WHERE city_id = $1)::int AS city_entities,
          (SELECT count(*) FROM ldt_prov.source_features WHERE city_id = $1)::int AS source_features,
          (
            SELECT count(*)
            FROM ldt_prov.entity_source_evidence evidence
            JOIN ldt_core.city_entities entity ON entity.id = evidence.entity_id
            WHERE entity.city_id = $1
          )::int AS source_evidence,
          (
            SELECT count(*)
            FROM ldt_semantic.entity_semantic_tags tag
            JOIN ldt_core.city_entities entity ON entity.id = tag.entity_id
            WHERE entity.city_id = $1
              AND tag.valid_to IS NULL
          )::int AS semantic_tags,
          (
            SELECT count(*)
            FROM ldt_semantic.source_semantic_mappings mapping
            WHERE mapping.city_id = $1 OR mapping.city_id IS NULL
          )::int AS source_mappings,
          (
            SELECT count(*)
            FROM public.ingestion_validation_reports report
            JOIN public.layer_ingestion_jobs job ON job.id = report.job_id
            WHERE job.city_id = $1
          )::int AS validation_reports,
          (
            SELECT count(*)
            FROM ldt_viewer.viewer_artifacts
            WHERE city_id = $1
              AND active = true
              AND status = 'ready'
          )::int AS active_artifacts,
          (
            SELECT count(*)
            FROM ldt_core.city_boundaries
            WHERE city_id = $1
          )::int AS city_boundaries,
          (
            SELECT count(*)
            FROM ldt_environment.extractor_runs
            WHERE city_id = $1
          )::int AS environmental_extractor_runs,
          (
            SELECT count(*)
            FROM ldt_environment.extractor_runs
            WHERE city_id = $1
              AND source_status = 'source-plan-only'
          )::int AS environmental_source_plan_runs,
          (
            SELECT count(*)
            FROM ldt_environment.extractor_artifacts
            WHERE city_id = $1
              AND artifact_kind = 'source-plan'
          )::int AS environmental_extractor_artifacts
      `,
      [cityId],
    )
    const activeArtifactResult = await client.query(
      `
        SELECT artifact_type, artifact_key, version, byte_size, feature_count, object_count, tile_count, activated_at
        FROM ldt_viewer.viewer_artifacts
        WHERE city_id = $1
          AND active = true
          AND status = 'ready'
        ORDER BY artifact_type, artifact_key
      `,
      [cityId],
    )
    const offlineHandoffResult = await client.query(
      `
        SELECT
          run.id AS run_id,
          run.workflow_key,
          run.status,
          COALESCE(run.output->'offlineDataFactory'->>'status', run.status) AS handoff_status,
          COALESCE(run.output->'offlineDataFactoryDispatch'->>'status', dispatch_artifact.metadata->>'status') AS dispatch_status,
          COALESCE(run.output->'offlineDataFactoryDispatch'->>'executorProfile', dispatch_artifact.metadata->>'executorProfile') AS dispatch_executor_profile,
          COALESCE(run.output->'offlineDataFactoryResult'->>'status', result_artifact.metadata->>'resultStatus') AS result_status,
          COALESCE(run.output->'offlineDataFactoryResult'->'dispatch'->>'executorProfile', result_artifact.metadata->'dispatch'->>'executorProfile') AS result_executor_profile,
          COALESCE(run.output->'offlineDataFactoryResult'->'dispatch'->>'returnStatus', result_artifact.metadata->'dispatch'->>'returnStatus') AS dispatch_return_status,
          COALESCE(run.output->'offlineDataFactoryResult'->'externalRun'->>'status', result_artifact.metadata->'externalRun'->>'status') AS external_run_status,
          COALESCE(run.output->'offlineDataFactoryResult'->'externalRun'->>'runnerId', result_artifact.metadata->'externalRun'->>'runnerId') AS external_run_runner_id,
          COALESCE(
            run.output->'offlineDataFactoryResult'->'promotion'->'postgis'->>'status',
            result_artifact.metadata->'promotion'->'postgis'->>'status'
          ) AS postgis_promotion_status,
          COALESCE(
            run.output->'offlineDataFactoryResult'->'promotion'->'viewerArtifacts'->>'status',
            result_artifact.metadata->'promotion'->'viewerArtifacts'->>'status'
          ) AS viewer_promotion_status,
          COALESCE(run.input->>'stageKey', handoff_artifact.metadata->>'stageKey', result_artifact.metadata->>'stageKey') AS stage_key,
          handoff_artifact.artifact_uri,
          handoff_artifact.checksum,
          handoff_artifact.byte_size,
          handoff_artifact.metadata->>'localPath' AS local_path,
          dispatch_artifact.artifact_uri AS dispatch_artifact_uri,
          dispatch_artifact.checksum AS dispatch_checksum,
          dispatch_artifact.byte_size AS dispatch_byte_size,
          dispatch_artifact.metadata->>'localPath' AS dispatch_local_path,
          result_artifact.artifact_uri AS result_artifact_uri,
          result_artifact.checksum AS result_checksum,
          result_artifact.byte_size AS result_byte_size,
          result_artifact.metadata->>'localPath' AS result_local_path,
          run.created_at,
          run.updated_at
        FROM ldt_ops.workflow_runs run
        LEFT JOIN LATERAL (
          SELECT *
          FROM ldt_ops.workflow_artifacts handoff_artifact
          WHERE handoff_artifact.run_id = run.id
            AND handoff_artifact.artifact_kind = 'offline-data-factory-handoff'
          ORDER BY handoff_artifact.created_at DESC
          LIMIT 1
        ) handoff_artifact ON true
        LEFT JOIN LATERAL (
          SELECT *
          FROM ldt_ops.workflow_artifacts dispatch_artifact
          WHERE dispatch_artifact.run_id = run.id
            AND dispatch_artifact.artifact_kind = 'offline-data-factory-dispatch'
          ORDER BY dispatch_artifact.created_at DESC
          LIMIT 1
        ) dispatch_artifact ON true
        LEFT JOIN LATERAL (
          SELECT *
          FROM ldt_ops.workflow_artifacts result_artifact
          WHERE result_artifact.run_id = run.id
            AND result_artifact.artifact_kind = 'offline-data-factory-result'
          ORDER BY result_artifact.created_at DESC
          LIMIT 1
        ) result_artifact ON true
        WHERE run.city_id = $1
          AND run.workflow_key = 'offline-data-factory-handoff'
        ORDER BY run.created_at DESC
        LIMIT 5
      `,
      [cityId],
    )
    const cityInputPackageResult = await client.query(
      `
        SELECT
          id,
          artifact_kind,
          artifact_uri,
          media_type,
          byte_size,
          checksum,
          metadata,
          created_at
        FROM ldt_ops.workflow_artifacts
        WHERE city_id = $1
          AND artifact_kind = 'data-factory-city-input-package'
        ORDER BY created_at DESC
        LIMIT 5
      `,
      [cityId],
    )
    const providerCapabilities = await cachedProviderCapabilities()
    const executionModeOverrides = await getCityDataFactoryExecutionModeOverrides(cityId)
    const factory = factoryResult.rows[0] ?? {}
    const activeArtifacts = activeArtifactResult.rows
    const offlineHandoffs = offlineHandoffResult.rows.map(normalizeOfflineHandoff)
    const cityInputPackages = cityInputPackageResult.rows.map(normalizeCityInputPackage)
    const dataFactory = buildDataFactory({
      counts,
      factory,
      activeArtifacts,
      cityInputPackages,
      providerCapabilities,
      offlineHandoffs,
      executionModeOverrides,
    })
    const providerAssist = buildProviderAssist({
      providerCapabilities,
      factory,
    })
    const catalog = API_CATALOG.map(catalogRow)
    const catalogFamilies = new Set(catalog.map((item) => item.family))
    const usedFamilies = new Set(apiSummary.rows.map((row) => row.route_family).filter(Boolean))
    const uncoveredFamilies = [...catalogFamilies].filter((family) => !usedFamilies.has(family))
    const readiness = [
      {
        key: 'api-catalog',
        label: 'API catalog',
        status: catalog.length >= 8 ? 'ready' : 'partial',
        evidence: `${catalog.length} canonical API entries are listed for this city product.`,
      },
      {
        key: 'api-usage',
        label: 'API usage telemetry',
        status: Number(counts.api_events ?? 0) > 0 ? 'ready' : 'partial',
        evidence: `${Number(counts.api_events ?? 0)} request events and ${Number(counts.api_families ?? 0)} used route families are recorded.`,
      },
      {
        key: 'ingestion-jobs',
        label: 'Ingestion control',
        status: Number(counts.ingestion_jobs ?? 0) > 0 ? 'ready' : 'partial',
        evidence: `${Number(counts.ingestion_jobs ?? 0)} ingestion jobs are recorded; ${Number(counts.active_ingestion_jobs ?? 0)} active.`,
      },
      {
        key: 'workflow-governance',
        label: 'Workflow governance',
        status: Number(counts.workflow_runs ?? 0) > 0 ? 'ready' : 'partial',
        evidence: `${Number(counts.workflow_runs ?? 0)} workflow runs and ${Number(counts.pending_approvals ?? 0)} pending approvals.`,
      },
    ]

    return {
      configured: true,
      ok: true,
      city: cityResult.rows[0],
      cityId,
      generatedAt: new Date().toISOString(),
      counts: {
        apiEvents: Number(counts.api_events ?? 0),
        apiFamilies: Number(counts.api_families ?? 0),
        ingestionJobs: Number(counts.ingestion_jobs ?? 0),
        activeIngestionJobs: Number(counts.active_ingestion_jobs ?? 0),
        workflowRuns: Number(counts.workflow_runs ?? 0),
        activeWorkflowRuns: Number(counts.active_workflow_runs ?? 0),
        pendingApprovals: Number(counts.pending_approvals ?? 0),
        catalogEntries: catalog.length,
      },
      apiCatalog: catalog,
      apiUsageSummary: apiSummary.rows.map((row) => ({
        routeFamily: row.route_family,
        method: row.method,
        pathTemplate: row.path_template,
        events: Number(row.events ?? 0),
        errors: Number(row.errors ?? 0),
        lastStatusCode: Number(row.last_status_code ?? 0),
        avgLatencyMs: row.avg_latency_ms === null ? null : Number(row.avg_latency_ms),
        lastSeenAt: row.last_seen_at,
      })),
      recentApiEvents: recentApiEvents.rows.map((row) => ({
        id: row.id,
        routeFamily: row.route_family,
        method: row.method,
        pathTemplate: row.path_template,
        statusCode: Number(row.status_code ?? 0),
        latencyMs: row.latency_ms === null ? null : Number(row.latency_ms),
        apiVersion: row.api_version,
        actorRole: row.actor_role,
        errorCode: row.error_code,
        createdAt: row.created_at,
      })),
      ingestionJobs: ingestionJobs.rows.map((row) => ({
        id: row.id,
        jobKind: row.job_kind,
        requestedAction: row.requested_action,
        sourceFormat: row.source_format,
        sourceUri: row.source_uri,
        status: row.status,
        attemptCount: Number(row.attempt_count ?? 0),
        validationSummary: row.validation_summary ?? {},
        stats: row.stats ?? {},
        errorMessage: row.error_message,
        providerName: row.provider_name,
        layerKey: row.layer_key,
        layerName: row.layer_name,
        validationReports: Number(row.validation_reports ?? 0),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
      })),
      workflowRuns: workflowRunsResult.rows.map((row) => ({
        ...normalizeWorkflowRun(row),
        workflowDomain: row.workflow_domain,
      })),
      pendingApprovals: pendingApprovals.rows.map((row) => ({
        id: row.id,
        approvalKey: row.approval_key,
        status: row.status,
        policy: row.policy ?? {},
        createdAt: row.created_at,
        runId: row.run_id,
        workflowKey: row.workflow_key,
        workflowName: row.workflow_name,
      })),
      dataFactory,
      providerAssist,
      readiness,
      gaps: uncoveredFamilies.map((family) => ({
        key: `api-usage-${family}`,
        label: `${family} usage not observed yet`,
        action: 'Exercise this API family from the cockpit or external consumer before claiming operational usage.',
      })),
      error: null,
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    cityId,
    error: String(error?.message ?? 'CITY_OPERATIONS_REPORT_UNAVAILABLE'),
  }))
}
