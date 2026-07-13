import { spawnSync } from 'node:child_process'

import {
  createOfflineDataFactoryDispatch,
  createOfflineDataFactoryHandoff,
  importOfflineDataFactoryResult,
} from './offlineDataFactoryService.mjs'
import { getOfflineDataFactoryStageDefinition } from './offlineDataFactoryStageRegistry.mjs'
import { getCitySourcePlan } from './citySourcePlanService.mjs'
import { getWorkflowRun } from './workflowService.mjs'
import { getProductionPool } from '../../db/postgisPool.mjs'
import { materializeEntitySemanticTags } from '../semanticLayer/entitySemanticTagMaterializer.mjs'
import { generateLdtSemanticPacks } from '../ldtSemanticPackService.mjs'
import { registerLdtEnvironmentalExtractorContracts } from '../ldtEnvironmentalExtractorService.mjs'
import { runHydrologyGridExtractor } from '../ldtHydrologyGridExtractorService.mjs'
import { runSurfaceRunoffScenario } from '../ldtSurfaceRunoffScenarioService.mjs'
import { runTerrainDemExtractor } from '../ldtTerrainDemExtractorService.mjs'
import { runWeatherFieldExtractor } from '../ldtWeatherFieldExtractorService.mjs'
import { registerExistingViewerArtifacts } from '../viewerArtifacts/viewerArtifactScanner.mjs'
import { findCityConfig } from '../cityRegistry.mjs'
import { enqueueProviderLayerIngestionJob } from '../providerLayerIngestionService.mjs'
import { getRuntimeDir } from '../stateStore.mjs'

const WORKFLOW_KEY = 'offline-data-factory-handoff'
const SUPPORTED_EXECUTOR_PROFILES = new Set(['local-process', 'external-worker'])
const ENVIRONMENTAL_RUNNER_MODES = new Set(['source-plan-only', 'execute-existing-adapters'])

function nowIso() {
  return new Date().toISOString()
}

function timestampVersion() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function requireRunId(runId) {
  const normalized = String(runId ?? '').trim()
  if (!normalized) throw new Error('WORKFLOW_RUN_ID_REQUIRED')
  return normalized
}

function requireCityId(cityId) {
  const normalized = String(cityId ?? '').trim()
  if (!normalized) throw new Error('CITY_ID_REQUIRED')
  return normalized
}

function requireStageKey(stageKey) {
  const normalized = String(stageKey ?? '').trim()
  if (!normalized) throw new Error('DATA_FACTORY_STAGE_REQUIRED')
  return normalized
}

function compactRunnerText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function numberRunnerOption(value, fallback = undefined) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function positiveIntegerRunnerOption(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) throw new Error('OFFLINE_RUNNER_POSITIVE_INTEGER_REQUIRED')
  return number
}

function booleanRunnerOption(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  const text = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(text)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(text)) return false
  return fallback
}

function normalizeRunnerOptions(runnerOptions = {}) {
  return runnerOptions && typeof runnerOptions === 'object' ? runnerOptions : {}
}

function normalizeEnvironmentalRunnerMode(runnerOptions = {}) {
  const normalizedOptions = normalizeRunnerOptions(runnerOptions)
  const mode = compactRunnerText(
    normalizedOptions.environmentalMode ?? normalizedOptions.mode ?? normalizedOptions.executionScope,
    'source-plan-only',
  )
  if (!ENVIRONMENTAL_RUNNER_MODES.has(mode)) throw new Error(`ENVIRONMENTAL_RUNNER_MODE_UNSUPPORTED:${mode}`)
  return mode
}

function runViewerArtifactToolStep({ key, command, args }) {
  const startedAt = nowIso()
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TWIN_STUDIO_RUNTIME_DIR: getRuntimeDir(),
    },
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 80,
  })
  const finishedAt = nowIso()
  const step = {
    key,
    command,
    args,
    status: result.status === 0 ? 'succeeded' : 'failed',
    exitCode: result.status,
    startedAt,
    finishedAt,
    stdout: String(result.stdout ?? '').slice(-4000),
    stderr: String(result.stderr ?? '').slice(-4000),
  }
  if (result.status !== 0) {
    throw new Error(`VIEWER_ARTIFACT_LOCAL_STAGE_FAILED:${key}:${step.stderr || step.stdout || `exit ${result.status}`}`)
  }
  return step
}

async function getViewerArtifactInventoryCounts(cityId) {
  const pool = getProductionPool()
  const result = await pool.query(
    `
      SELECT entity_type, count(*)::int AS count
      FROM ldt_core.city_entities
      WHERE city_id = $1
      GROUP BY entity_type
    `,
    [cityId],
  )
  return result.rows.reduce((counts, row) => {
    counts[row.entity_type] = Number(row.count ?? 0)
    return counts
  }, {})
}

function viewerArtifactStaleReasons(artifacts = [], inventoryCounts = {}) {
  const reasons = []
  const buildingCount = Number(inventoryCounts.building ?? 0)
  const activeThreeDTiles = artifacts
    .filter((artifact) => artifact.active === true && artifact.artifactType === '3d-tiles')
    .sort((left, right) => String(right.version ?? '').localeCompare(String(left.version ?? '')))[0] ?? null
  if (buildingCount > 0 && Number(activeThreeDTiles?.featureCount ?? 0) < buildingCount) {
    reasons.push(`3D_TILES_FEATURE_COUNT_STALE:${Number(activeThreeDTiles?.featureCount ?? 0)}<${buildingCount}`)
  }
  return reasons
}

function defaultTilePartitions(inventoryCounts = {}, partitionLimit = 12000) {
  const buildingCount = Number(inventoryCounts.building ?? 0)
  if (buildingCount <= 0) return 16
  return Math.min(512, Math.max(16, Math.ceil(buildingCount / Math.max(1, partitionLimit))))
}

async function buildLocalViewerArtifacts(cityId, runnerOptions = {}, inventoryCounts = {}) {
  const normalizedOptions = normalizeRunnerOptions(runnerOptions)
  const version = compactRunnerText(normalizedOptions.version, `offline-viewer-${timestampVersion()}`)
  const steps = []
  if (!booleanRunnerOption(normalizedOptions.skipThreeDTiles, false)) {
    const tilePartitionLimit = numberRunnerOption(normalizedOptions.tilePartitionLimit, 12000)
    const tilePartitions = numberRunnerOption(
      normalizedOptions.tilePartitions,
      defaultTilePartitions(inventoryCounts, tilePartitionLimit),
    )
    steps.push(runViewerArtifactToolStep({
      key: 'build-3d-tiles',
      command: process.execPath,
      args: [
        'server/tools/build-city-3d-tiles-partitioned.mjs',
        `--city=${cityId}`,
        `--version=${version}`,
        `--tileset-key=${compactRunnerText(normalizedOptions.tilesetKey, 'base-buildings-partitioned')}`,
        `--partitions=${tilePartitions}`,
        `--partition-limit=${tilePartitionLimit}`,
      ],
    }))
  }
  if (!booleanRunnerOption(normalizedOptions.skipMvt, false)) {
    const args = [
      'server/tools/export-city-mvt-package.mjs',
      `--city=${cityId}`,
      `--version=${version}`,
      `--min-zoom=${numberRunnerOption(normalizedOptions.mvtMinZoom, 10)}`,
      `--max-zoom=${numberRunnerOption(normalizedOptions.mvtMaxZoom, 14)}`,
      '--activate',
    ]
    const maxFeaturesPerTile = numberRunnerOption(normalizedOptions.mvtMaxFeaturesPerTile, null)
    if (maxFeaturesPerTile) args.push(`--max-features-per-tile=${maxFeaturesPerTile}`)
    steps.push(runViewerArtifactToolStep({
      key: 'build-mvt-directory',
      command: process.execPath,
      args,
    }))
  }
  if (!booleanRunnerOption(normalizedOptions.skipPmtiles, false)) {
    steps.push(runViewerArtifactToolStep({
      key: 'pack-pmtiles',
      command: process.env.PYTHON_BIN || 'python3',
      args: [
        'server/tools/pack-mvt-directory-pmtiles.py',
        `--city=${cityId}`,
        `--version=${version}`,
        `--runtime-dir=${getRuntimeDir()}`,
        `--pmtiles-bin=${compactRunnerText(normalizedOptions.pmtilesBin, process.env.PMTILES_BIN || 'pmtiles')}`,
      ],
    }))
  }
  return { version, steps }
}

function normalizeExecutorProfile(executorProfile = 'local-process') {
  const normalized = String(executorProfile ?? '').trim() || 'local-process'
  if (!SUPPORTED_EXECUTOR_PROFILES.has(normalized)) throw new Error('OFFLINE_DATA_FACTORY_EXECUTOR_UNSUPPORTED')
  return normalized
}

function latestHandoffArtifact(run) {
  const artifact = (run.artifacts ?? []).find((entry) => entry.artifactKind === 'offline-data-factory-handoff')
  if (!artifact) throw new Error('OFFLINE_HANDOFF_ARTIFACT_NOT_FOUND')
  return artifact
}

function assertRunnableOfflineRun(run, cityId = null) {
  if (!run) throw new Error('OFFLINE_HANDOFF_RUN_NOT_FOUND')
  if (run.workflowKey !== WORKFLOW_KEY) throw new Error('OFFLINE_HANDOFF_WORKFLOW_INVALID')
  if (cityId && run.cityId !== cityId) throw new Error('OFFLINE_HANDOFF_CITY_MISMATCH')
  const stageKey = String(run.input?.stageKey ?? '').trim()
  if (!stageKey) throw new Error('OFFLINE_HANDOFF_STAGE_MISSING')
  latestHandoffArtifact(run)
  return stageKey
}

function semanticExpectedMinimums(materialization = {}, packs = {}) {
  return {
    activeSemanticTags: Math.max(1, Number(materialization.activeTagCount ?? 0)),
    semanticClasses: 1,
    sourceMappings: 1,
    cityPackBindings: Math.max(1, Number(packs.packCount ?? 0)),
    serviceIndicators: 1,
    serviceFeatures: 1,
    serviceWorkflows: 1,
    workflowContracts: 1,
    ruleChecks: 1,
  }
}

function summarizeViewerArtifacts(artifacts = []) {
  return artifacts.reduce((summary, artifact) => {
    const type = artifact.artifactType ?? 'unknown'
    const current = summary.byType[type] ?? { count: 0, active: 0, bytes: 0 }
    current.count += 1
    current.active += artifact.active ? 1 : 0
    current.bytes += Number(artifact.byteSize ?? 0)
    summary.byType[type] = current
    summary.registeredArtifacts += 1
    summary.activeArtifacts += artifact.active ? 1 : 0
    summary.byteSize += Number(artifact.byteSize ?? 0)
    return summary
  }, {
    registeredArtifacts: 0,
    activeArtifacts: 0,
    byteSize: 0,
    byType: {},
  })
}

function viewerArtifactExpectedMinimums(summary) {
  return {
    registeredArtifacts: Math.max(1, Number(summary.registeredArtifacts ?? 0)),
    activeArtifacts: Math.max(1, Number(summary.activeArtifacts ?? 0)),
    mvtDirectories: Number(summary.byType?.['mvt-directory']?.count ?? 0),
    pmtiles: Number(summary.byType?.pmtiles?.count ?? 0),
    threeDTiles: Number(summary.byType?.['3d-tiles']?.count ?? 0),
  }
}

function viewerArtifactSetComplete(summary) {
  return Number(summary.registeredArtifacts ?? 0) > 0 &&
    Number(summary.activeArtifacts ?? 0) > 0 &&
    Number(summary.byType?.['mvt-directory']?.count ?? 0) > 0 &&
    Number(summary.byType?.pmtiles?.count ?? 0) > 0 &&
    Number(summary.byType?.['3d-tiles']?.count ?? 0) > 0
}

function summarizeIngestionJobs(jobs = []) {
  return jobs.reduce((summary, job) => {
    const action = job.action ?? 'unknown'
    const status = job.status ?? 'unknown'
    summary.byAction[action] = (summary.byAction[action] ?? 0) + 1
    summary.byStatus[status] = (summary.byStatus[status] ?? 0) + 1
    summary.jobCount += 1
    if (['queued', 'registered', 'running', 'completed'].includes(status)) summary.queueableJobs += 1
    if (job.existing) summary.existingJobs += 1
    return summary
  }, {
    jobCount: 0,
    queueableJobs: 0,
    existingJobs: 0,
    byAction: {},
    byStatus: {},
  })
}

function ingestionQueueExpectedMinimums(summary) {
  return {
    ingestionJobs: Math.max(1, Number(summary.jobCount ?? 0)),
    queueableJobs: Math.max(1, Number(summary.queueableJobs ?? 0)),
  }
}

function summarizeEnvironmentalExtractorRegistration(registration, cityId) {
  const city = (registration.cities ?? []).find((entry) => entry.cityId === cityId)
  const runs = city?.runs ?? []
  return {
    extractorDefinitions: Number(registration.extractorCount ?? 0),
    cityCount: Number(registration.cityCount ?? 0),
    runCount: Number(city?.runCount ?? runs.length),
    sourcePlanRuns: runs.filter((run) => run.status === 'registered' && run.sourceStatus === 'source-plan-only').length,
    extractorKeys: runs.map((run) => run.extractorKey).filter(Boolean),
    runs,
  }
}

function environmentalExtractorExpectedMinimums(summary) {
  const actualSourceDataDownloaded = Boolean(summary.actualSourceDataDownloaded)
  return {
    extractorDefinitions: Math.max(1, Number(summary.extractorDefinitions ?? 0)),
    extractorRuns: Math.max(1, Number(summary.runCount ?? 0)),
    sourcePlanRuns: Math.max(1, Number(summary.sourcePlanRuns ?? 0)),
    sourcePlanArtifacts: Math.max(1, Number(summary.runCount ?? 0)),
    completedExtractorRuns: actualSourceDataDownloaded ? Math.max(3, Number(summary.completedExtractorRuns ?? 0)) : 0,
    sourceBackedLayers: actualSourceDataDownloaded ? Math.max(4, Number(summary.sourceBackedLayers ?? 0)) : 0,
    phenomenonCells: actualSourceDataDownloaded ? Math.max(1, Number(summary.phenomenonCells ?? 0)) : 0,
    objectObservations: actualSourceDataDownloaded ? Math.max(1, Number(summary.objectObservations ?? 0)) : 0,
    objectSummaries: actualSourceDataDownloaded ? Math.max(1, Number(summary.objectSummaries ?? 0)) : 0,
    simulationRuns: actualSourceDataDownloaded && summary.surfaceRunoffExecuted ? 1 : 0,
    scenarioOutputs: actualSourceDataDownloaded && summary.surfaceRunoffExecuted ? 1 : 0,
  }
}

function summarizeEnvironmentalAdapterResult(result, cityId) {
  const city = (result?.cities ?? []).find((entry) => entry.cityId === cityId) ?? result?.cities?.[0] ?? {}
  return {
    ok: Boolean(result?.ok),
    key: result?.extractorKey ?? result?.scenarioRunner ?? result?.modelKey ?? 'unknown',
    cityId: city.cityId ?? cityId,
    scenarioKey: city.scenarioKey ?? result?.scenarioKey ?? null,
    gridKey: city.gridKey ?? result?.gridKey ?? null,
    sourceGridKey: city.sourceGridKey ?? result?.sourceGridKey ?? null,
    runKey: city.runKey ?? null,
    sampledCells: Number(city.sampledCells ?? 0),
    cellsWritten: Number(city.cellsWritten ?? 0),
    objectObservations: Number(city.objectObservations ?? 0),
    objectSummaries: Number(city.objectSummaries ?? 0),
    failedCells: Number(city.failedCells ?? 0),
    failedBatches: Number(city.failedBatches ?? 0),
    tileCount: Number(city.tileCount ?? 0),
    dryRun: Boolean(result?.dryRun),
    skippedWrite: Boolean(city.skippedWrite),
  }
}

async function runEnvironmentalExistingAdapters({ cityId, runnerOptions }) {
  const options = normalizeRunnerOptions(runnerOptions)
  const scenarioKey = compactRunnerText(options.scenarioKey, 'baseline')
  const terrain = await runTerrainDemExtractor({
    cityIds: [cityId],
    scenarioKey,
    gridKey: compactRunnerText(options.terrainGridKey ?? options.gridKey, 'city-density-2km'),
    gridResolutionM: options.terrainGridResolutionM,
    tileZoom: numberRunnerOption(options.terrainTileZoom ?? options.tileZoom, 12),
    sampleOffsetM: options.terrainSampleOffsetM,
    concurrency: numberRunnerOption(options.terrainConcurrency, undefined),
    tileTemplate: options.terrainTileTemplate,
  })
  if (!terrain.ok) throw new Error('ENVIRONMENTAL_TERRAIN_ADAPTER_FAILED')

  const weather = await runWeatherFieldExtractor({
    cityIds: [cityId],
    scenarioKey,
    gridKey: options.weatherGridKey,
    gridResolutionM: numberRunnerOption(options.weatherGridResolutionM, 6000),
    endpoint: options.weatherEndpoint,
    batchSize: numberRunnerOption(options.weatherBatchSize, 40),
  })
  if (!weather.ok) throw new Error('ENVIRONMENTAL_WEATHER_ADAPTER_FAILED')

  const hydrology = await runHydrologyGridExtractor({
    cityIds: [cityId],
    scenarioKey,
    sourceGridKey: options.hydrologySourceGridKey,
    maxCells: options.hydrologyMaxCells,
    maxObjectObservations: options.hydrologyMaxObjectObservations,
    force: booleanRunnerOption(options.hydrologyForce, false),
  })
  if (!hydrology.ok) throw new Error('ENVIRONMENTAL_HYDROLOGY_ADAPTER_FAILED')

  const surfaceRunoffEnabled = booleanRunnerOption(options.surfaceRunoff, true)
  const runoff = surfaceRunoffEnabled
    ? await runSurfaceRunoffScenario({
      cityIds: [cityId],
      scenarioKey,
      sourceGridKey: options.runoffSourceGridKey ?? options.hydrologySourceGridKey,
      rainfallMm: numberRunnerOption(options.runoffRainfallMm ?? options.rainfallMm, undefined),
      durationHours: numberRunnerOption(options.runoffDurationHours ?? options.durationHours, undefined),
    })
    : null
  if (surfaceRunoffEnabled && !runoff?.ok) throw new Error('ENVIRONMENTAL_RUNOFF_ADAPTER_FAILED')

  const adapters = {
    terrainDem: summarizeEnvironmentalAdapterResult(terrain, cityId),
    weatherField: summarizeEnvironmentalAdapterResult(weather, cityId),
    hydrologyGrid: summarizeEnvironmentalAdapterResult(hydrology, cityId),
    surfaceRunoff: runoff ? summarizeEnvironmentalAdapterResult(runoff, cityId) : null,
  }
  const adapterList = Object.values(adapters).filter(Boolean)
  return {
    mode: 'execute-existing-adapters',
    scenarioKey,
    actualSourceDataDownloaded: true,
    surfaceRunoffExecuted: Boolean(runoff),
    adapters,
    completedExtractorRuns: 3,
    sourceBackedLayers: runoff ? 7 : 6,
    phenomenonCells: adapterList.reduce((sum, adapter) => sum + Number(adapter.cellsWritten ?? 0), 0),
    objectObservations: adapterList.reduce((sum, adapter) => sum + Number(adapter.objectObservations ?? 0), 0),
    objectSummaries: Math.max(0, ...adapterList.map((adapter) => Number(adapter.objectSummaries ?? 0))),
    simulationRuns: runoff ? 1 : 0,
    scenarioOutputs: runoff ? 1 : 0,
  }
}

async function runSemanticMaterialization({ run, handoffArtifact, executorProfile, submittedBy, runnerOptions }) {
  const startedAt = nowIso()
  const entityLimitPerType = positiveIntegerRunnerOption(
    normalizeRunnerOptions(runnerOptions).semanticEntityLimitPerType,
    null,
  )
  const materialization = await materializeEntitySemanticTags({
    cityId: run.cityId,
    entityLimitPerType,
  })
  if (!materialization.ok) throw new Error(materialization.error || 'ENTITY_SEMANTIC_TAG_MATERIALIZATION_FAILED')
  const semanticPacks = await generateLdtSemanticPacks({
    cityIds: [run.cityId],
    allPacks: true,
  })
  if (!semanticPacks.ok) throw new Error('SEMANTIC_PACK_GENERATION_FAILED')
  const finishedAt = nowIso()

  const resultPackage = {
    schemaVersion: '2026-06-26.offline-data-factory-result.v1',
    runId: run.id,
    cityId: run.cityId,
    stageKey: 'semantic-materialization',
    executionMode: 'offline-data-factory',
    status: 'succeeded',
    handoffChecksum: handoffArtifact.checksum,
    validation: {
      passed: true,
      checks: [
        { key: 'entity-semantic-tag-materialization', status: 'passed' },
        { key: 'semantic-pack-generation', status: 'passed' },
        { key: 'offline-runner-profile', status: 'passed', executorProfile },
      ],
      summary: 'Offline Data Factory runner completed semantic materialization and generated installed semantic packs.',
    },
    resultSummary: {
      runner: {
        key: 'offline-data-factory-runner',
        executorProfile,
        productMode: 'offline-data-factory',
        startedAt,
        finishedAt,
        submittedBy: submittedBy ?? null,
      },
      materialization: {
        targetEntityCount: materialization.targetEntityCount,
        entityLimitPerType: materialization.entityLimitPerType,
        bounded: materialization.bounded,
        candidateCount: materialization.candidateCount,
        inserted: materialization.inserted,
        updated: materialization.updated,
        retired: materialization.retired,
        activeTagCount: materialization.activeTagCount,
        tagsByClass: materialization.tagsByClass,
        taggedEntitiesByType: materialization.taggedEntitiesByType,
      },
      semanticPacks: {
        packCount: semanticPacks.packCount,
        packKeys: semanticPacks.packKeys ?? semanticPacks.packs?.map((pack) => pack.packKey) ?? [],
        cityCount: semanticPacks.cityCount,
      },
    },
    promotion: {
      mode: 'stage-applicator',
      postgis: {
        status: 'promoted',
        stageApplicator: 'semantic-materialization',
        scope: materialization.bounded ? 'bounded-by-entity-type' : 'full-city',
        targetEntityCount: materialization.targetEntityCount,
        entityLimitPerType: materialization.entityLimitPerType,
        expectedMinimums: semanticExpectedMinimums(materialization, semanticPacks),
      },
      viewerArtifacts: {
        status: 'not-applicable',
        artifacts: [],
      },
    },
  }

  return importOfflineDataFactoryResult({
    cityId: run.cityId,
    runId: run.id,
    resultPackage,
    submittedBy,
  })
}

async function runIngestionQueue({ run, handoffArtifact, executorProfile, submittedBy }) {
  const startedAt = nowIso()
  const cityConfig = findCityConfig(run.cityId)
  if (!cityConfig) throw new Error('OFFLINE_INGESTION_CITY_CONFIG_NOT_FOUND')
  const sourcePlan = await getCitySourcePlan(run.cityId)
  if (!sourcePlan.ok || !sourcePlan.ready) {
    throw new Error(sourcePlan.boundaryGate?.code || 'OFFLINE_INGESTION_SOURCE_PLAN_NOT_READY')
  }
  const providerPackages = sourcePlan.providerPackages ?? []
  if (providerPackages.length === 0) throw new Error('OFFLINE_INGESTION_PROVIDER_PACKAGES_MISSING')
  const jobs = []
  for (const providerPackage of providerPackages) {
    const queued = await enqueueProviderLayerIngestionJob(cityConfig, providerPackage.layerKey, {
      ...providerPackage,
      submittedBy: submittedBy ?? 'offline-data-factory-runner',
      metadata: {
        ...(providerPackage.metadata ?? {}),
        offlineDataFactory: {
          runId: run.id,
          stageKey: 'ingestion-queue',
          productMode: 'offline-data-factory',
        },
      },
    })
    if (!queued.ok) throw new Error(queued.error || 'OFFLINE_INGESTION_JOB_QUEUE_FAILED')
    jobs.push({
      jobId: queued.jobId,
      layerKey: queued.layerKey,
      action: queued.action ?? providerPackage.action,
      sourceFormat: queued.sourceFormat ?? providerPackage.sourceFormat,
      status: queued.status,
      existing: Boolean(queued.existing),
      idempotencyKey: queued.idempotencyKey,
      validationReportCount: queued.validationReportCount ?? 0,
    })
  }
  const summary = summarizeIngestionJobs(jobs)
  if (summary.queueableJobs < jobs.length) throw new Error('OFFLINE_INGESTION_QUEUE_NOT_QUEUEABLE')
  const finishedAt = nowIso()
  const resultPackage = {
    schemaVersion: '2026-06-26.offline-data-factory-result.v1',
    runId: run.id,
    cityId: run.cityId,
    stageKey: 'ingestion-queue',
    executionMode: 'offline-data-factory',
    status: 'succeeded',
    handoffChecksum: handoffArtifact.checksum,
    validation: {
      passed: true,
      checks: [
        { key: 'city-source-plan-ready', status: 'passed' },
        { key: 'provider-ingestion-jobs-queued', status: 'passed', jobCount: summary.jobCount },
        { key: 'offline-runner-profile', status: 'passed', executorProfile },
      ],
      summary: 'Offline Data Factory runner created or reused provider ingestion queue jobs from the active city source plan.',
    },
    resultSummary: {
      runner: {
        key: 'offline-data-factory-runner',
        executorProfile,
        productMode: 'offline-data-factory',
        startedAt,
        finishedAt,
        submittedBy: submittedBy ?? null,
      },
      sourcePlan: {
        kind: sourcePlan.sourcePlan?.kind ?? sourcePlan.planKind,
        target: sourcePlan.sourcePlan?.target ?? null,
        boundaryGate: sourcePlan.boundaryGate?.code ?? null,
        providerPackageCount: providerPackages.length,
      },
      ingestionQueue: {
        ...summary,
        jobs,
      },
    },
    promotion: {
      mode: 'stage-applicator',
      postgis: {
        status: 'promoted',
        stageApplicator: 'ingestion-queue',
        writes: ['public.layer_ingestion_jobs', 'public.ingestion_validation_reports'],
        expectedMinimums: ingestionQueueExpectedMinimums(summary),
        jobs,
      },
      viewerArtifacts: {
        status: 'not-applicable',
        artifacts: [],
      },
    },
  }

  return importOfflineDataFactoryResult({
    cityId: run.cityId,
    runId: run.id,
    resultPackage,
    submittedBy,
  })
}

async function runEnvironmentalExtractors({ run, handoffArtifact, executorProfile, submittedBy, runnerOptions = {} }) {
  const startedAt = nowIso()
  const environmentalMode = normalizeEnvironmentalRunnerMode(runnerOptions)
  const registration = await registerLdtEnvironmentalExtractorContracts({
    cityIds: [run.cityId],
    requestedBy: submittedBy ?? 'offline-data-factory-runner',
    requestedByKind: 'offline-data-factory',
    triggerKind: 'offline-data-factory',
  })
  if (!registration.ok) throw new Error('ENVIRONMENTAL_EXTRACTOR_REGISTRATION_FAILED')
  const summary = summarizeEnvironmentalExtractorRegistration(registration, run.cityId)
  if (summary.runCount < 1 || summary.sourcePlanRuns < 1) {
    throw new Error('ENVIRONMENTAL_EXTRACTOR_SOURCE_PLAN_EMPTY')
  }
  const adapterExecution = environmentalMode === 'execute-existing-adapters'
    ? await runEnvironmentalExistingAdapters({ cityId: run.cityId, runnerOptions })
    : {
      mode: 'source-plan-only',
      scenarioKey: compactRunnerText(runnerOptions?.scenarioKey, 'baseline'),
      actualSourceDataDownloaded: false,
      surfaceRunoffExecuted: false,
      adapters: {},
      completedExtractorRuns: 0,
      sourceBackedLayers: 0,
      phenomenonCells: 0,
      objectObservations: 0,
      objectSummaries: 0,
      simulationRuns: 0,
      scenarioOutputs: 0,
    }
  const environmentalSummary = {
    ...summary,
    ...adapterExecution,
    nextAdapterStep: adapterExecution.actualSourceDataDownloaded
      ? 'Promote richer STAC/raster, hazard, and calibrated provider models when those adapters are available.'
      : 'Run source-backed DEM, weather, hydrology, or STAC adapters offline, then promote measured or modelled phenomenon cells and viewer artifacts.',
  }
  const finishedAt = nowIso()
  const resultPackage = {
    schemaVersion: '2026-06-26.offline-data-factory-result.v1',
    runId: run.id,
    cityId: run.cityId,
    stageKey: 'environmental-extractors',
    executionMode: 'offline-data-factory',
    status: 'succeeded',
    handoffChecksum: handoffArtifact.checksum,
    validation: {
      passed: true,
      checks: [
        { key: 'environmental-extractor-contracts-registered', status: 'passed', runCount: summary.runCount },
        { key: 'environmental-source-plan-artifacts-registered', status: 'passed', sourcePlanRuns: summary.sourcePlanRuns },
        { key: 'environmental-runner-mode', status: 'passed', mode: environmentalMode },
        ...(adapterExecution.actualSourceDataDownloaded
          ? [
            { key: 'terrain-dem-adapter', status: 'passed', cellsWritten: adapterExecution.adapters.terrainDem?.cellsWritten ?? 0 },
            { key: 'weather-field-adapter', status: 'passed', cellsWritten: adapterExecution.adapters.weatherField?.cellsWritten ?? 0 },
            { key: 'hydrology-grid-adapter', status: 'passed', cellsWritten: adapterExecution.adapters.hydrologyGrid?.cellsWritten ?? 0 },
            { key: 'surface-runoff-scenario', status: adapterExecution.surfaceRunoffExecuted ? 'passed' : 'skipped' },
          ]
          : []),
        { key: 'offline-runner-profile', status: 'passed', executorProfile },
      ],
      summary: adapterExecution.actualSourceDataDownloaded
        ? 'Offline Data Factory runner registered environmental source-plan contracts and executed existing source-backed terrain, weather, hydrology, and runoff adapters.'
        : 'Offline Data Factory runner registered environmental extractor source-plan contracts for terrain, weather, hydrology, and STAC-derived layers.',
    },
    resultSummary: {
      runner: {
        key: 'offline-data-factory-runner',
        executorProfile,
        productMode: 'offline-data-factory',
        startedAt,
        finishedAt,
        submittedBy: submittedBy ?? null,
      },
      environmentalExtractors: environmentalSummary,
    },
    promotion: {
      mode: 'stage-applicator',
      postgis: {
        status: 'promoted',
        stageApplicator: 'environmental-extractors',
        writes: adapterExecution.actualSourceDataDownloaded
          ? [
            'ldt_environment.extractor_runs',
            'ldt_environment.extractor_artifacts',
            'ldt_environment.phenomenon_cells',
            'ldt_environment.object_observations',
            'ldt_environment.object_observation_summary',
            'ldt_science.simulation_runs',
            'ldt_science.scenario_outputs',
          ]
          : ['ldt_environment.extractor_runs', 'ldt_environment.extractor_artifacts'],
        expectedMinimums: environmentalExtractorExpectedMinimums(environmentalSummary),
      },
      viewerArtifacts: {
        status: 'not-applicable',
        artifacts: [],
      },
    },
  }

  return importOfflineDataFactoryResult({
    cityId: run.cityId,
    runId: run.id,
    resultPackage,
    submittedBy,
  })
}

async function runViewerArtifacts({ run, handoffArtifact, executorProfile, submittedBy, runnerOptions = {} }) {
  const startedAt = nowIso()
  let generated = null
  const normalizedOptions = normalizeRunnerOptions(runnerOptions)
  const inventoryCounts = await getViewerArtifactInventoryCounts(run.cityId)
  let artifacts = await registerExistingViewerArtifacts(run.cityId, { activateLatest: true })
  let promotableArtifacts = artifacts.filter((artifact) => artifact.status === 'ready')
  let summary = summarizeViewerArtifacts(promotableArtifacts)
  const staleReasons = viewerArtifactStaleReasons(promotableArtifacts, inventoryCounts)
  const forceRebuild = booleanRunnerOption(normalizedOptions.forceRebuild, false) ||
    booleanRunnerOption(normalizedOptions.viewerArtifactForceRebuild, false)
  if (forceRebuild || staleReasons.length > 0 || !viewerArtifactSetComplete(summary)) {
    generated = await buildLocalViewerArtifacts(run.cityId, normalizedOptions, inventoryCounts)
    artifacts = await registerExistingViewerArtifacts(run.cityId, { activateLatest: true })
    const generatedArtifacts = artifacts.filter((artifact) => artifact.status === 'ready' && artifact.version === generated.version)
    promotableArtifacts = generatedArtifacts.length > 0
      ? generatedArtifacts
      : artifacts.filter((artifact) => artifact.status === 'ready' && artifact.active === true)
    summary = summarizeViewerArtifacts(promotableArtifacts)
  }
  if (!viewerArtifactSetComplete(summary)) {
    throw new Error('VIEWER_ARTIFACT_REGISTRATION_EMPTY')
  }
  const finishedAt = nowIso()
  const resultPackage = {
    schemaVersion: '2026-06-26.offline-data-factory-result.v1',
    runId: run.id,
    cityId: run.cityId,
    stageKey: 'viewer-artifacts',
    executionMode: 'offline-data-factory',
    status: 'succeeded',
    handoffChecksum: handoffArtifact.checksum,
    validation: {
      passed: true,
      checks: [
        { key: 'viewer-artifact-registry-registration', status: 'passed' },
        { key: 'viewer-artifact-active-version', status: 'passed', activeArtifacts: summary.activeArtifacts },
        ...(generated ? [{ key: 'viewer-artifact-local-build', status: 'passed', stepCount: generated.steps.length, version: generated.version }] : []),
        ...(staleReasons.length > 0 ? [{ key: 'viewer-artifact-stale-detection', status: 'passed', staleReasons }] : []),
        { key: 'offline-runner-profile', status: 'passed', executorProfile },
      ],
      summary: generated
        ? 'Offline Data Factory runner generated ready viewer artifacts, registered them, and activated the generated version.'
        : 'Offline Data Factory runner registered ready viewer artifacts and activated latest eligible versions.',
    },
    resultSummary: {
      runner: {
        key: 'offline-data-factory-runner',
        executorProfile,
        productMode: 'offline-data-factory',
        startedAt,
        finishedAt,
        submittedBy: submittedBy ?? null,
      },
      viewerArtifacts: {
        ...summary,
        generatedVersion: generated?.version ?? null,
        generatedSteps: generated?.steps ?? [],
        inventoryCounts,
        staleReasons,
        forceRebuild,
        scannedArtifacts: artifacts.length,
        artifacts: promotableArtifacts.map((artifact) => ({
          artifactKey: artifact.artifactKey,
          artifactType: artifact.artifactType,
          transport: artifact.transport,
          version: artifact.version,
          status: artifact.status,
          active: artifact.active,
          checksum: artifact.checksum,
          byteSize: artifact.byteSize,
          featureCount: artifact.featureCount,
          tileCount: artifact.tileCount,
          uri: artifact.uri,
        })),
      },
    },
    promotion: {
      mode: 'stage-applicator',
      postgis: {
        status: 'not-applicable',
        writes: [],
      },
      viewerArtifacts: {
        status: 'promoted',
        stageApplicator: 'viewer-artifacts',
        expectedMinimums: viewerArtifactExpectedMinimums(summary),
        artifacts: promotableArtifacts.map((artifact) => ({
          artifactKey: artifact.artifactKey,
          artifactType: artifact.artifactType,
          version: artifact.version,
          active: artifact.active,
          checksum: artifact.checksum,
        })),
      },
    },
  }

  return importOfflineDataFactoryResult({
    cityId: run.cityId,
    runId: run.id,
    resultPackage,
    submittedBy,
  })
}

const RUNNER_STAGE_HANDLERS = new Map([
  ['semanticMaterialization', runSemanticMaterialization],
  ['ingestionQueue', runIngestionQueue],
  ['environmentalExtractors', runEnvironmentalExtractors],
  ['viewerArtifacts', runViewerArtifacts],
])

function stageRunnerHandler(stageKey) {
  const definition = getOfflineDataFactoryStageDefinition(stageKey)
  if (!definition) throw new Error(`OFFLINE_DATA_FACTORY_RUNNER_STAGE_UNSUPPORTED:${stageKey}`)
  const handler = RUNNER_STAGE_HANDLERS.get(definition.runnerHandler)
  if (!handler) throw new Error(`OFFLINE_DATA_FACTORY_RUNNER_HANDLER_UNSUPPORTED:${definition.runnerHandler}`)
  return handler
}

function assertStageAllowsRunnerProfile(stageKey, executorProfile) {
  const definition = getOfflineDataFactoryStageDefinition(stageKey)
  if (!definition) throw new Error(`OFFLINE_DATA_FACTORY_RUNNER_STAGE_UNSUPPORTED:${stageKey}`)
  const allowedProfiles = definition.contract?.allowedRunnerProfiles ?? ['local-process']
  if (!allowedProfiles.includes(executorProfile)) {
    throw new Error(`OFFLINE_DATA_FACTORY_RUNNER_PROFILE_NOT_ALLOWED:${stageKey}:${executorProfile}`)
  }
}

async function assertCityReadyForDataFactory(cityId) {
  const sourcePlan = await getCitySourcePlan(cityId)
  if (sourcePlan.boundaryGate?.passed !== true) {
    throw new Error(`DATA_FACTORY_CITY_BOUNDARY_GATE_BLOCKED:${sourcePlan.boundaryGate?.code ?? 'CITY_BOUNDARY_REQUIRED'}`)
  }
  return sourcePlan
}

export async function runOfflineDataFactoryHandoff({
  runId,
  cityId = null,
  executorProfile = 'local-process',
  submittedBy = null,
  runnerOptions = {},
} = {}) {
  const normalizedRunId = requireRunId(runId)
  const normalizedCityId = cityId ? requireCityId(cityId) : null
  const normalizedExecutorProfile = normalizeExecutorProfile(executorProfile)
  const detail = await getWorkflowRun(normalizedRunId)
  if (!detail.ok) throw new Error(detail.error || 'OFFLINE_HANDOFF_RUN_NOT_FOUND')
  const stageKey = assertRunnableOfflineRun(detail.run, normalizedCityId)
  assertStageAllowsRunnerProfile(stageKey, normalizedExecutorProfile)
  await assertCityReadyForDataFactory(detail.run.cityId)

  if (normalizedExecutorProfile === 'external-worker') {
    const dispatch = await createOfflineDataFactoryDispatch({
      runId: normalizedRunId,
      cityId: normalizedCityId,
      executorProfile: normalizedExecutorProfile,
      runnerOptions,
      submittedBy,
    })
    return {
      ok: dispatch.ok,
      cityId: detail.run.cityId,
      workflowKey: WORKFLOW_KEY,
      stageKey,
      executorProfile: normalizedExecutorProfile,
      runId: normalizedRunId,
      dispatch,
      error: dispatch.error ?? null,
    }
  }

  const handoffArtifact = latestHandoffArtifact(detail.run)
  const runStage = stageRunnerHandler(stageKey)
  const imported = await runStage({
    run: detail.run,
    handoffArtifact,
    executorProfile: normalizedExecutorProfile,
    submittedBy,
    runnerOptions,
  })
  return {
    ok: true,
    cityId: detail.run.cityId,
    workflowKey: WORKFLOW_KEY,
    stageKey,
    executorProfile: normalizedExecutorProfile,
    runId: normalizedRunId,
    imported,
  }
}

export async function runOfflineDataFactoryJob({
  runId = null,
  cityId = null,
  stageKey = null,
  executorProfile = 'local-process',
  requestedBy = null,
  submittedBy = null,
  runnerOptions = {},
} = {}) {
  if (runId) {
    return runOfflineDataFactoryHandoff({
      runId,
      cityId,
      executorProfile,
      submittedBy,
      runnerOptions,
    })
  }
  const normalizedCityId = requireCityId(cityId)
  const normalizedStageKey = requireStageKey(stageKey)
  const handoff = await createOfflineDataFactoryHandoff({
    cityId: normalizedCityId,
    stageKey: normalizedStageKey,
    requestedBy,
    submittedBy,
  })
  if (!handoff.ok) throw new Error(handoff.error || 'OFFLINE_HANDOFF_CREATE_FAILED')
  const executed = await runOfflineDataFactoryHandoff({
    runId: handoff.handoff.runId,
    cityId: normalizedCityId,
    executorProfile,
    submittedBy,
    runnerOptions,
  })
  return {
    ...executed,
    handoff,
  }
}
