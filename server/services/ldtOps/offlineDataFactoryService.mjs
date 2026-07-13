import { createHash } from 'node:crypto'
import path from 'node:path'

import { getCityOperationsReport } from './operationsReportService.mjs'
import { withClient } from './dbUtils.mjs'
import { getWorkflowRun } from './workflowService.mjs'
import { applyOfflineDataFactoryPromotion } from './offlineDataFactoryPromotionApplicators.mjs'
import {
  dataFactoryStageContract,
  listOfflineDataFactoryStageDefinitions,
  offlineDataFactoryAllowedStageKeys,
  offlineDataFactoryPromotionContract,
  offlineDataFactoryStageApplicatorPromotion,
  offlineDataFactoryStageCommandHints,
} from './offlineDataFactoryStageRegistry.mjs'
import { getRuntimeDir, writeJsonFile } from '../stateStore.mjs'

const WORKFLOW_KEY = 'offline-data-factory-handoff'

function nowIso() {
  return new Date().toISOString()
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(stableJson(value)).digest('hex')}`
}

function requireCityId(cityId) {
  const normalized = String(cityId ?? '').trim()
  if (!normalized) throw new Error('CITY_ID_REQUIRED')
  return normalized
}

function requireStageKey(stageKey) {
  const normalized = String(stageKey ?? '').trim()
  if (!normalized) throw new Error('DATA_FACTORY_STAGE_REQUIRED')
  if (!/^[a-z0-9][a-z0-9._-]{1,128}$/i.test(normalized)) throw new Error('DATA_FACTORY_STAGE_INVALID')
  return normalized
}

function assertStageContractAllowsRunnerProfile(stageKey, executorProfile) {
  const contract = dataFactoryStageContract(stageKey)
  const allowedProfiles = contract?.allowedRunnerProfiles ?? []
  if (!allowedProfiles.includes(executorProfile)) {
    throw new Error(`OFFLINE_DATA_FACTORY_EXECUTOR_NOT_ALLOWED:${stageKey}:${executorProfile}`)
  }
}

function handoffRuntimeRelativePath(cityId, runId) {
  return path.join('artifacts', cityId, 'offline-data-factory', runId, 'handoff.json')
}

function resultRuntimeRelativePath(cityId, runId) {
  return path.join('artifacts', cityId, 'offline-data-factory', runId, 'result.json')
}

function dispatchRuntimeRelativePath(cityId, runId, executorProfile) {
  return path.join('artifacts', cityId, 'offline-data-factory', runId, `dispatch-${executorProfile}.json`)
}

function workflowDefinitionPayload() {
  return {
    workflowKey: WORKFLOW_KEY,
    name: 'Data Factory Compute Handoff',
    purpose: 'Send heavy processing to VPS, HPC, sidecar, or external Data Factory environments, then promote validated PostGIS rows and viewer artifacts back into Twin Studio.',
    domain: 'data-factory',
    lifecycleStatus: 'current',
    defaultMode: 'offline-data-factory',
    agentPolicy: {
      agentCanPreparePackage: true,
      agentCanRunExternalCompute: false,
      agentCanPromoteResultsWithoutValidation: false,
      requiresOperatorForExternalExecution: true,
      requiresValidationBeforePromotion: true,
    },
    inputContract: {
      required: ['cityId', 'stageKey', 'executionMode'],
      executionModes: ['offline-data-factory'],
      allowedStages: offlineDataFactoryAllowedStageKeys(),
      stageContracts: listOfflineDataFactoryStageDefinitions().map((stage) => ({
        key: stage.key,
        label: stage.label,
        runnerHandler: stage.runnerHandler,
        contract: stage.contract,
      })),
    },
    outputContract: {
      writes: ['ldt_ops.workflow_runs', 'ldt_ops.workflow_artifacts'],
      exports: ['offline-data-factory-handoff-json'],
      promotesBackTo: ['PostGIS canonical twin', 'ldt_viewer.viewer_artifacts'],
      doesNotClaim: ['external job completed', 'authority-approved results', 'automatic production promotion'],
    },
    standardsMapping: {
      catalog: 'DCAT',
      provenance: 'PROV-O',
      geospatial: ['PostGIS', 'MVT', 'PMTiles', '3D Tiles'],
      semantic: ['semantic-pack-manifest'],
    },
  }
}

function buildHandoffPackage({ cityId, stage, report, requestedBy, submittedBy }) {
  const stageKey = stage.key
  const stageContract = stage.stageContract ?? dataFactoryStageContract(stageKey)
  return {
    schemaVersion: '2026-06-26.offline-data-factory-handoff.v1',
    createdAt: nowIso(),
    cityId,
    stageKey,
    executionMode: 'offline-data-factory',
    requestedBy: requestedBy ?? null,
    submittedBy: submittedBy ?? null,
    status: 'queued-for-offline-execution',
    stage: {
      key: stage.key,
      label: stage.label,
      state: stage.state,
      evidence: stage.evidence,
      operatorNext: stage.operatorNext,
      execution: stage.execution,
      contract: stageContract,
    },
    stageContract,
    sourceContext: {
      dataFactorySummary: report.dataFactory?.summary ?? {},
      offlineCandidateStages: report.dataFactory?.offlineCandidateStages ?? [],
      counts: report.counts ?? {},
      readinessGaps: report.readinessGaps ?? [],
    },
    commandHints: offlineDataFactoryStageCommandHints(cityId, stageKey),
    promotionContract: offlineDataFactoryPromotionContract(cityId, stageKey),
  }
}

function buildExternalDispatchPackage({
  run,
  handoffArtifact,
  executorProfile,
  runnerOptions = {},
  submittedBy = null,
}) {
  const stageKey = String(run.input?.stageKey ?? '').trim()
  const handoffPackage = run.input?.handoffPackage ?? {}
  const stageContract = handoffPackage.stageContract ?? handoffPackage.stage?.contract ?? dataFactoryStageContract(stageKey)
  return {
    schemaVersion: '2026-06-26.offline-data-factory-dispatch.v1',
    createdAt: nowIso(),
    runId: run.id,
    cityId: run.city_id,
    stageKey,
    executionMode: 'offline-data-factory',
    executorProfile,
    status: 'ready-for-external-runner',
    submittedBy,
    handoff: {
      artifactUri: handoffArtifact.artifact_uri,
      checksum: handoffArtifact.checksum,
      byteSize: Number(handoffArtifact.byte_size ?? 0),
      localPath: handoffArtifact.metadata?.localPath ?? null,
    },
    runnerOptions,
    stageContract,
    commandHints: handoffPackage.commandHints ?? offlineDataFactoryStageCommandHints(run.city_id, stageKey),
    promotionContract: handoffPackage.promotionContract ?? offlineDataFactoryPromotionContract(run.city_id, stageKey),
    resultImport: {
      method: 'POST',
      path: `/api/admin/cities/${run.city_id}/data-factory/offline-handoffs/${run.id}/result`,
      bodyShape: {
        resultPackage: {
          schemaVersion: '2026-06-26.offline-data-factory-result.v1',
          runId: run.id,
          cityId: run.city_id,
          stageKey,
          executionMode: 'offline-data-factory',
          status: 'succeeded',
          handoffChecksum: handoffArtifact.checksum,
          validation: {
            passed: true,
            checks: (stageContract?.validations ?? []).map((check) => ({
              key: check.key,
              status: 'passed',
            })),
            summary: 'External runner validation summary.',
          },
          resultSummary: {},
          promotion: {},
        },
        submittedBy: 'external-data-factory-runner',
      },
    },
    executionContract: {
      runnerMust: [
        'verify handoff checksum before processing',
        'preserve cityId, stageKey, runId, and executionMode in the result package',
        'write only validated PostGIS rows or registered viewer artifacts through the result import contract',
        'return checksums, byte sizes, source identity, and validation checks for every promoted artifact',
      ],
      runnerMustNot: [
        'claim authority approval',
        'write directly into viewer runtime paths without registry promotion',
        'change city boundary scope',
        'return machine-local paths as the only artifact reference',
      ],
    },
    logContract: {
      expectedArtifacts: ['stdout.log', 'stderr.log', 'runner-summary.json'],
      minimumFields: ['startedAt', 'finishedAt', 'executorProfile', 'hostFingerprint', 'status'],
    },
    storageContract: {
      artifactUris: 'runtime, object-storage, or signed-transfer URIs must be portable back to Twin Studio.',
      checksums: 'sha256 checksums are required for result packages and large artifacts.',
      localPaths: 'local paths may be included as debug metadata but are not portable artifact identifiers.',
    },
  }
}

async function ensureOfflineWorkflowDefinition(client) {
  const definition = workflowDefinitionPayload()
  const result = await client.query(
    `
      INSERT INTO ldt_ops.workflow_definitions (
        workflow_key,
        name,
        purpose,
        domain,
        lifecycle_status,
        default_mode,
        agent_policy,
        input_contract,
        output_contract,
        standards_mapping
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)
      ON CONFLICT (workflow_key) DO UPDATE SET
        name = EXCLUDED.name,
        purpose = EXCLUDED.purpose,
        domain = EXCLUDED.domain,
        lifecycle_status = EXCLUDED.lifecycle_status,
        default_mode = EXCLUDED.default_mode,
        agent_policy = EXCLUDED.agent_policy,
        input_contract = EXCLUDED.input_contract,
        output_contract = EXCLUDED.output_contract,
        standards_mapping = EXCLUDED.standards_mapping,
        updated_at = now()
      RETURNING *
    `,
    [
      definition.workflowKey,
      definition.name,
      definition.purpose,
      definition.domain,
      definition.lifecycleStatus,
      definition.defaultMode,
      JSON.stringify(definition.agentPolicy),
      JSON.stringify(definition.inputContract),
      JSON.stringify(definition.outputContract),
      JSON.stringify(definition.standardsMapping),
    ],
  )
  return result.rows[0]
}

async function insertHandoffSteps(client, runId) {
  const steps = [
    ['package-offline-handoff', 'Package offline Data Factory handoff', 'succeeded'],
    ['run-offline-data-factory', 'Run offline Data Factory job outside the viewer path', 'pending'],
    ['promote-postgis-results', 'Promote validated PostGIS results back into Twin Studio', 'pending'],
    ['register-viewer-artifacts', 'Register promoted viewer artifacts', 'pending'],
  ]
  for (const [index, [stepKey, title, status]] of steps.entries()) {
    await client.query(
      `
        INSERT INTO ldt_ops.workflow_steps (
          run_id,
          step_key,
          step_order,
          title,
          tool_kind,
          status,
          output
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT (run_id, step_key) DO UPDATE SET
          status = EXCLUDED.status,
          output = EXCLUDED.output,
          updated_at = now()
      `,
      [
        runId,
        stepKey,
        index + 1,
        title,
        stepKey === 'package-offline-handoff' ? 'system' : 'offline-data-factory',
        status,
        JSON.stringify(status === 'succeeded' ? { packaged: true } : {}),
      ],
    )
  }
}

export async function createOfflineDataFactoryHandoff({
  cityId,
  stageKey,
  requestedBy = null,
  submittedBy = null,
} = {}) {
  const normalizedCityId = requireCityId(cityId)
  const normalizedStageKey = requireStageKey(stageKey)
  const report = await getCityOperationsReport(normalizedCityId)
  if (!report.ok) throw new Error(report.error || 'OPERATIONS_REPORT_NOT_OK')
  const stage = (report.dataFactory?.stages ?? []).find((entry) => entry.key === normalizedStageKey)
  if (!stage) throw new Error('DATA_FACTORY_STAGE_NOT_FOUND')
  if (!stage.execution?.availableModes?.includes('offline-data-factory')) {
    throw new Error('DATA_FACTORY_STAGE_NOT_OFFLINE_ELIGIBLE')
  }

  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const city = await client.query('SELECT id FROM ldt_core.cities WHERE id = $1', [normalizedCityId])
      if (city.rowCount === 0) throw new Error('CITY_NOT_FOUND')
      const workflow = await ensureOfflineWorkflowDefinition(client)
      const handoffPackage = buildHandoffPackage({
        cityId: normalizedCityId,
        stage,
        report,
        requestedBy,
        submittedBy,
      })
      const input = {
        cityId: normalizedCityId,
        workflowKey: WORKFLOW_KEY,
        stageKey: normalizedStageKey,
        executionMode: 'offline-data-factory',
        source: 'operations-ingestion',
        handoffPackage,
      }
      const runResult = await client.query(
        `
          INSERT INTO ldt_ops.workflow_runs (
            workflow_id,
            workflow_key,
            city_id,
            requested_by,
            requested_by_kind,
            trigger_kind,
            status,
            input,
            output,
            started_at
          )
          VALUES ($1, $2, $3, $4, 'human', 'offline-data-factory-handoff', 'queued', $5::jsonb, '{}'::jsonb, now())
          RETURNING *
        `,
        [
          workflow.id,
          WORKFLOW_KEY,
          normalizedCityId,
          requestedBy,
          JSON.stringify(input),
        ],
      )
      const run = runResult.rows[0]
      const relativePath = handoffRuntimeRelativePath(normalizedCityId, run.id)
      const localPath = path.join(getRuntimeDir(), relativePath)
      const artifactUri = `runtime://${relativePath.split(path.sep).join('/')}`
      const finalPackage = {
        ...handoffPackage,
        runId: run.id,
        artifactUri,
      }
      writeJsonFile(localPath, finalPackage)
      const byteSize = Buffer.byteLength(`${JSON.stringify(finalPackage, null, 2)}\n`)
      const checksum = sha256Json(finalPackage)

      await insertHandoffSteps(client, run.id)
      const artifactResult = await client.query(
        `
          INSERT INTO ldt_ops.workflow_artifacts (
            run_id,
            city_id,
            artifact_kind,
            artifact_uri,
            media_type,
            byte_size,
            checksum,
            metadata
          )
          VALUES ($1, $2, 'offline-data-factory-handoff', $3, 'application/json', $4, $5, $6::jsonb)
          RETURNING *
        `,
        [
          run.id,
          normalizedCityId,
          artifactUri,
          byteSize,
          checksum,
          JSON.stringify({
            localPath,
            relativePath: relativePath.split(path.sep).join('/'),
            stageKey: normalizedStageKey,
            executionMode: 'offline-data-factory',
            stageContract: finalPackage.stageContract,
            promotionContract: finalPackage.promotionContract,
            commandHints: finalPackage.commandHints,
          }),
        ],
      )
      const artifact = artifactResult.rows[0]
      await client.query(
        `
          UPDATE ldt_ops.workflow_runs
          SET
            output = $2::jsonb,
            updated_at = now()
          WHERE id = $1
        `,
        [
          run.id,
          JSON.stringify({
            offlineDataFactory: {
              status: 'queued-for-offline-execution',
              stageKey: normalizedStageKey,
              artifactUri,
              checksum,
              byteSize,
              localPath,
              stageContract: finalPackage.stageContract,
              promotionContract: finalPackage.promotionContract,
            },
          }),
        ],
      )
      await client.query('COMMIT')

      const detail = await getWorkflowRun(run.id)
      return {
        ok: true,
        cityId: normalizedCityId,
        workflowKey: WORKFLOW_KEY,
        run: detail.run,
        handoff: {
          runId: run.id,
          stageKey: normalizedStageKey,
          status: 'queued-for-offline-execution',
          artifactUri,
          checksum,
          byteSize,
          localPath,
          stageContract: finalPackage.stageContract,
          promotionContract: finalPackage.promotionContract,
          artifactId: artifact.id,
        },
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }).catch((error) => ({
    ok: false,
    cityId: normalizedCityId,
    workflowKey: WORKFLOW_KEY,
    run: null,
    handoff: null,
    error: String(error?.message ?? 'OFFLINE_DATA_FACTORY_HANDOFF_FAILED'),
  }))
}

function requireRunId(runId) {
  const normalized = String(runId ?? '').trim()
  if (!normalized) throw new Error('WORKFLOW_RUN_ID_REQUIRED')
  return normalized
}

function normalizeResultStatus(status) {
  const normalized = String(status ?? '').trim().toLowerCase()
  if (['succeeded', 'success', 'passed', 'validated'].includes(normalized)) return 'succeeded'
  if (['failed', 'failure', 'error', 'rejected'].includes(normalized)) return 'failed'
  throw new Error('OFFLINE_RESULT_STATUS_INVALID')
}

function isPromotedStatus(status) {
  return ['promoted', 'succeeded', 'validated-promoted'].includes(String(status ?? '').trim().toLowerCase())
}

function isNotApplicableStatus(status) {
  return ['not-applicable', 'not_applicable', 'n/a'].includes(String(status ?? '').trim().toLowerCase())
}

function externalRunStatus(value, fallback) {
  const normalized = String(value ?? fallback ?? '').trim().toLowerCase()
  if (['succeeded', 'success', 'passed', 'validated'].includes(normalized)) return 'succeeded'
  if (['failed', 'failure', 'error', 'rejected'].includes(normalized)) return 'failed'
  if (['running', 'queued', 'pending'].includes(normalized)) return normalized
  return fallback
}

function dispatchReturnFields(resultPackage = {}) {
  const dispatch = resultPackage.dispatch && typeof resultPackage.dispatch === 'object'
    ? resultPackage.dispatch
    : {}
  const runner = resultPackage.resultSummary?.runner && typeof resultPackage.resultSummary.runner === 'object'
    ? resultPackage.resultSummary.runner
    : {}
  const externalRun = resultPackage.externalRun && typeof resultPackage.externalRun === 'object'
    ? resultPackage.externalRun
    : (resultPackage.resultSummary?.externalRun && typeof resultPackage.resultSummary.externalRun === 'object'
      ? resultPackage.resultSummary.externalRun
      : {})
  return {
    artifactUri: resultPackage.dispatchArtifactUri ?? dispatch.artifactUri ?? null,
    checksum: resultPackage.dispatchChecksum ?? dispatch.checksum ?? dispatch.artifactChecksum ?? null,
    executorProfile: resultPackage.executorProfile ?? dispatch.executorProfile ?? runner.executorProfile ?? null,
    externalRun,
  }
}

function validateDispatchReturnContract({ resultPackage, dispatchArtifact, status }) {
  if (!dispatchArtifact) return { dispatch: null, externalRun: null }
  const fields = dispatchReturnFields(resultPackage)
  if (!fields.checksum) throw new Error('OFFLINE_RESULT_DISPATCH_CHECKSUM_REQUIRED')
  if (fields.checksum !== dispatchArtifact.checksum) throw new Error('OFFLINE_RESULT_DISPATCH_CHECKSUM_MISMATCH')
  if (fields.artifactUri && fields.artifactUri !== dispatchArtifact.artifact_uri) {
    throw new Error('OFFLINE_RESULT_DISPATCH_ARTIFACT_URI_MISMATCH')
  }
  if (fields.executorProfile !== 'external-worker') {
    throw new Error('OFFLINE_RESULT_EXTERNAL_EXECUTOR_PROFILE_REQUIRED')
  }
  if (!fields.externalRun || Object.keys(fields.externalRun).length === 0) {
    throw new Error('OFFLINE_RESULT_EXTERNAL_RUN_REQUIRED')
  }
  if (!fields.externalRun.runnerId && !fields.externalRun.runner_id) {
    throw new Error('OFFLINE_RESULT_EXTERNAL_RUNNER_ID_REQUIRED')
  }
  if (!fields.externalRun.status) {
    throw new Error('OFFLINE_RESULT_EXTERNAL_RUN_STATUS_REQUIRED')
  }
  const validationChecks = Array.isArray(resultPackage.validation?.checks) ? resultPackage.validation.checks : []
  if (status === 'succeeded' && validationChecks.length === 0) {
    throw new Error('OFFLINE_RESULT_EXTERNAL_VALIDATION_CHECKS_REQUIRED')
  }
  const normalizedExternalRunStatus = externalRunStatus(fields.externalRun.status, status)
  if (!['succeeded', 'failed'].includes(normalizedExternalRunStatus)) {
    throw new Error('OFFLINE_RESULT_EXTERNAL_RUN_STATUS_INVALID')
  }
  if (normalizedExternalRunStatus !== status) {
    throw new Error('OFFLINE_RESULT_EXTERNAL_RUN_STATUS_MISMATCH')
  }
  return {
    dispatch: {
      artifactUri: dispatchArtifact.artifact_uri,
      checksum: dispatchArtifact.checksum,
      byteSize: Number(dispatchArtifact.byte_size ?? 0),
      localPath: dispatchArtifact.metadata?.localPath ?? null,
      executorProfile: 'external-worker',
      returnStatus: 'validated-return',
    },
    externalRun: {
      ...fields.externalRun,
      status: normalizedExternalRunStatus,
      runnerId: fields.externalRun.runnerId ?? fields.externalRun.runner_id ?? null,
      executorProfile: 'external-worker',
    },
  }
}

function validateResultPackage({ resultPackage, run, handoffArtifact, dispatchArtifact = null }) {
  if (!resultPackage || typeof resultPackage !== 'object' || Array.isArray(resultPackage)) {
    throw new Error('OFFLINE_RESULT_PACKAGE_REQUIRED')
  }
  const status = normalizeResultStatus(resultPackage.status)
  const stageKey = String(resultPackage.stageKey ?? resultPackage.stage_key ?? run.input?.stageKey ?? '').trim()
  const cityId = String(resultPackage.cityId ?? resultPackage.city_id ?? run.city_id ?? '').trim()
  const executionMode = String(resultPackage.executionMode ?? resultPackage.execution_mode ?? 'offline-data-factory').trim()
  if (cityId !== run.city_id) throw new Error('OFFLINE_RESULT_CITY_MISMATCH')
  if (stageKey !== run.input?.stageKey) throw new Error('OFFLINE_RESULT_STAGE_MISMATCH')
  if (executionMode !== 'offline-data-factory') throw new Error('OFFLINE_RESULT_EXECUTION_MODE_INVALID')
  if (resultPackage.runId && String(resultPackage.runId) !== String(run.id)) throw new Error('OFFLINE_RESULT_RUN_MISMATCH')
  if (resultPackage.handoffChecksum && resultPackage.handoffChecksum !== handoffArtifact.checksum) {
    throw new Error('OFFLINE_RESULT_HANDOFF_CHECKSUM_MISMATCH')
  }
  const validation = resultPackage.validation && typeof resultPackage.validation === 'object'
    ? resultPackage.validation
    : {}
  if (status === 'succeeded' && validation.passed === false) {
    throw new Error('OFFLINE_RESULT_VALIDATION_NOT_PASSED')
  }
  const externalReturn = validateDispatchReturnContract({ resultPackage, dispatchArtifact, status })
  return {
    status,
    cityId,
    stageKey,
    executionMode,
    validation,
    externalReturn,
  }
}

function normalizedResultPackage({ resultPackage, run, handoffArtifact, dispatchArtifact = null, submittedBy }) {
  const normalized = validateResultPackage({ resultPackage, run, handoffArtifact, dispatchArtifact })
  const stageContract = resultPackage.stageContract
    ?? resultPackage.stage_contract
    ?? run.input?.handoffPackage?.stageContract
    ?? run.input?.handoffPackage?.stage?.contract
    ?? dataFactoryStageContract(normalized.stageKey)
  return {
    schemaVersion: '2026-06-26.offline-data-factory-result.v1',
    importedAt: nowIso(),
    runId: run.id,
    cityId: normalized.cityId,
    stageKey: normalized.stageKey,
    executionMode: normalized.executionMode,
    status: normalized.status,
    submittedBy: submittedBy ?? null,
    stageContract,
    handoff: {
      artifactUri: handoffArtifact.artifact_uri,
      checksum: handoffArtifact.checksum,
    },
    dispatch: normalized.externalReturn.dispatch,
    externalRun: normalized.externalReturn.externalRun,
    validation: {
      passed: normalized.status === 'succeeded' ? normalized.validation.passed !== false : false,
      checks: Array.isArray(normalized.validation.checks) ? normalized.validation.checks : [],
      summary: normalized.validation.summary ?? '',
    },
    resultSummary: resultPackage.resultSummary ?? resultPackage.summary ?? {},
    promotion: {
      mode: resultPackage.promotion?.mode ?? 'operations-ledger',
      postgis: resultPackage.promotion?.postgis ?? {
        status: 'operations-ledger-recorded',
        writes: ['ldt_ops.workflow_runs', 'ldt_ops.workflow_artifacts'],
        note: 'This import records the offline result in the operations ledger. Domain-table promotion requires a stage-specific applicator.',
      },
      viewerArtifacts: resultPackage.promotion?.viewerArtifacts ?? {
        status: 'not-applicable',
        artifacts: [],
      },
    },
    rawResult: resultPackage,
  }
}

async function loadOfflineRun(client, runId, cityId = null, { forUpdate = false } = {}) {
  const params = [runId]
  const cityFilter = cityId ? 'AND run.city_id = $2' : ''
  if (cityId) params.push(cityId)
  const result = await client.query(
    `
      SELECT run.*
      FROM ldt_ops.workflow_runs run
      WHERE run.id = $1
        ${cityFilter}
        AND run.workflow_key = $${params.length + 1}
      ${forUpdate ? 'FOR UPDATE' : ''}
    `,
    [...params, WORKFLOW_KEY],
  )
  if (result.rowCount === 0) throw new Error('OFFLINE_HANDOFF_RUN_NOT_FOUND')
  return result.rows[0]
}

async function loadOfflineRunForUpdate(client, runId, cityId = null) {
  return loadOfflineRun(client, runId, cityId, { forUpdate: true })
}

async function latestHandoffArtifact(client, runId) {
  const result = await client.query(
    `
      SELECT *
      FROM ldt_ops.workflow_artifacts
      WHERE run_id = $1
        AND artifact_kind = 'offline-data-factory-handoff'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [runId],
  )
  if (result.rowCount === 0) throw new Error('OFFLINE_HANDOFF_ARTIFACT_NOT_FOUND')
  return result.rows[0]
}

async function latestDispatchArtifact(client, runId) {
  const result = await client.query(
    `
      SELECT *
      FROM ldt_ops.workflow_artifacts
      WHERE run_id = $1
        AND artifact_kind = 'offline-data-factory-dispatch'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [runId],
  )
  return result.rows[0] ?? null
}

function operationsLedgerPromotion() {
  return {
    mode: 'operations-ledger',
    postgis: {
      status: 'operations-ledger-recorded',
      writes: ['ldt_ops.workflow_runs', 'ldt_ops.workflow_artifacts'],
    },
    viewerArtifacts: {
      status: 'not-applicable',
      artifacts: [],
    },
  }
}

function buildResultTemplate({ run, handoffArtifact, dispatchArtifact = null, promotionMode = 'operations-ledger', submittedBy = null }) {
  const stageKey = String(run.input?.stageKey ?? '').trim()
  if (!stageKey) throw new Error('OFFLINE_HANDOFF_STAGE_MISSING')
  const stageContract = run.input?.handoffPackage?.stageContract ?? run.input?.handoffPackage?.stage?.contract ?? dataFactoryStageContract(stageKey)
  const now = nowIso()
  const dispatchMetadata = dispatchArtifact?.metadata && typeof dispatchArtifact.metadata === 'object'
    ? dispatchArtifact.metadata
    : {}
  const dispatchReturn = dispatchArtifact ? {
    dispatchArtifactUri: dispatchArtifact.artifact_uri,
    dispatchChecksum: dispatchArtifact.checksum,
    executorProfile: dispatchMetadata.executorProfile ?? 'external-worker',
    externalRun: {
      runnerId: 'external-data-factory-runner',
      status: 'succeeded',
      startedAt: now,
      finishedAt: now,
      artifacts: [],
    },
  } : {}
  const normalizedPromotionMode = promotionMode === 'stage-applicator' ? 'stage-applicator' : 'operations-ledger'
  return {
    schemaVersion: '2026-06-26.offline-data-factory-result.v1',
    runId: run.id,
    cityId: run.city_id,
    stageKey,
    executionMode: 'offline-data-factory',
    status: 'succeeded',
    submittedBy,
    handoffChecksum: handoffArtifact.checksum,
    stageContract,
    ...dispatchReturn,
    validation: {
      passed: true,
      checks: dispatchArtifact
        ? [
          { key: 'operator-result-import', status: 'passed' },
          { key: 'external-dispatch-checksum', status: 'passed' },
          ...(stageContract?.validations ?? []).map((check) => ({
            key: check.key,
            status: 'passed',
          })),
        ]
        : [
          { key: 'operator-result-import', status: 'passed' },
          ...(stageContract?.validations ?? []).map((check) => ({
            key: check.key,
            status: 'passed',
          })),
        ],
      summary: dispatchArtifact
        ? 'External Data Factory result package returned through the dispatch contract and imported by operations.'
        : 'Offline result package imported by operations.',
    },
    resultSummary: {
      mode: normalizedPromotionMode,
      ...(dispatchArtifact ? {
        runner: {
          executorProfile: dispatchMetadata.executorProfile ?? 'external-worker',
          status: 'succeeded',
        },
      } : {}),
    },
    promotion: normalizedPromotionMode === 'stage-applicator'
      ? offlineDataFactoryStageApplicatorPromotion(stageKey)
      : operationsLedgerPromotion(),
  }
}

export async function buildOfflineDataFactoryResultTemplate({
  cityId,
  runId,
  promotionMode = 'operations-ledger',
  submittedBy = null,
} = {}) {
  const normalizedRunId = requireRunId(runId)
  const normalizedCityId = cityId ? requireCityId(cityId) : null
  return withClient(async (client) => {
    const run = await loadOfflineRun(client, normalizedRunId, normalizedCityId)
    const handoffArtifact = await latestHandoffArtifact(client, normalizedRunId)
    const dispatchArtifact = await latestDispatchArtifact(client, normalizedRunId)
    return {
      ok: true,
      cityId: run.city_id,
      runId: run.id,
      stageKey: String(run.input?.stageKey ?? '').trim(),
      promotionMode: promotionMode === 'stage-applicator' ? 'stage-applicator' : 'operations-ledger',
      resultPackage: buildResultTemplate({
        run,
        handoffArtifact,
        dispatchArtifact,
        promotionMode,
        submittedBy,
      }),
    }
  })
}

export async function createOfflineDataFactoryDispatch({
  runId,
  cityId = null,
  executorProfile = 'external-worker',
  runnerOptions = {},
  submittedBy = null,
} = {}) {
  const normalizedRunId = requireRunId(runId)
  const normalizedCityId = cityId ? requireCityId(cityId) : null
  const normalizedExecutorProfile = String(executorProfile ?? '').trim() || 'external-worker'
  if (normalizedExecutorProfile !== 'external-worker') throw new Error('OFFLINE_DATA_FACTORY_DISPATCH_EXECUTOR_UNSUPPORTED')
  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const run = await loadOfflineRunForUpdate(client, normalizedRunId, normalizedCityId)
      const stageKey = String(run.input?.stageKey ?? '').trim()
      if (!stageKey) throw new Error('OFFLINE_DISPATCH_STAGE_MISSING')
      assertStageContractAllowsRunnerProfile(stageKey, normalizedExecutorProfile)
      const handoffArtifact = await latestHandoffArtifact(client, normalizedRunId)
      const dispatchPackage = buildExternalDispatchPackage({
        run,
        handoffArtifact,
        executorProfile: normalizedExecutorProfile,
        runnerOptions,
        submittedBy,
      })
      const relativePath = dispatchRuntimeRelativePath(run.city_id, run.id, normalizedExecutorProfile)
      const localPath = path.join(getRuntimeDir(), relativePath)
      const artifactUri = `runtime://${relativePath.split(path.sep).join('/')}`
      const packageWithArtifact = {
        ...dispatchPackage,
        artifactUri,
      }
      writeJsonFile(localPath, packageWithArtifact)
      const byteSize = Buffer.byteLength(`${JSON.stringify(packageWithArtifact, null, 2)}\n`)
      const checksum = sha256Json(packageWithArtifact)
      const artifactResult = await client.query(
        `
          INSERT INTO ldt_ops.workflow_artifacts (
            run_id,
            city_id,
            artifact_kind,
            artifact_uri,
            media_type,
            byte_size,
            checksum,
            metadata
          )
          VALUES ($1, $2, 'offline-data-factory-dispatch', $3, 'application/json', $4, $5, $6::jsonb)
          RETURNING *
        `,
        [
          run.id,
          run.city_id,
          artifactUri,
          byteSize,
          checksum,
          JSON.stringify({
            localPath,
            relativePath: relativePath.split(path.sep).join('/'),
            status: packageWithArtifact.status,
            stageKey,
            stageContract: packageWithArtifact.stageContract,
            executorProfile: normalizedExecutorProfile,
            runnerOptions,
            handoffChecksum: handoffArtifact.checksum,
            resultImport: packageWithArtifact.resultImport,
          }),
        ],
      )
      await client.query(
        `
          UPDATE ldt_ops.workflow_steps
          SET
            status = 'queued',
            output = COALESCE(output, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
          WHERE run_id = $1
            AND step_key = $2
        `,
        [
          run.id,
          'run-offline-data-factory',
          JSON.stringify({
            dispatchStatus: packageWithArtifact.status,
            executorProfile: normalizedExecutorProfile,
            dispatchArtifactUri: artifactUri,
          }),
        ],
      )
      await client.query(
        `
          UPDATE ldt_ops.workflow_runs
          SET
            output = COALESCE(output, '{}'::jsonb) || $2::jsonb,
            updated_at = now()
          WHERE id = $1
        `,
        [
          run.id,
          JSON.stringify({
            offlineDataFactoryDispatch: {
              status: packageWithArtifact.status,
              stageKey,
              executorProfile: normalizedExecutorProfile,
              artifactUri,
              checksum,
              byteSize,
              localPath,
              runnerOptions,
              stageContract: packageWithArtifact.stageContract,
            },
          }),
        ],
      )
      await client.query('COMMIT')
      const detail = await getWorkflowRun(run.id)
      return {
        ok: true,
        cityId: run.city_id,
        workflowKey: WORKFLOW_KEY,
        run: detail.run,
        dispatch: {
          runId: run.id,
          stageKey,
          status: packageWithArtifact.status,
          executorProfile: normalizedExecutorProfile,
          artifactUri,
          checksum,
          byteSize,
          localPath,
          artifactId: artifactResult.rows[0].id,
          stageContract: packageWithArtifact.stageContract,
          resultImport: packageWithArtifact.resultImport,
        },
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }).catch((error) => ({
    ok: false,
    cityId: normalizedCityId,
    workflowKey: WORKFLOW_KEY,
    run: null,
    dispatch: null,
    error: String(error?.message ?? 'OFFLINE_DATA_FACTORY_DISPATCH_FAILED'),
  }))
}

async function updateResultSteps(client, runId, status, resultPackage) {
  const succeeded = status === 'succeeded'
  const postgisPromotionStatus = resultPackage.promotion?.postgis?.status ?? 'operations-ledger-recorded'
  const viewerPromotionStatus = resultPackage.promotion?.viewerArtifacts?.status ?? 'not-applicable'
  const postgisPromoted = isPromotedStatus(postgisPromotionStatus)
  const viewerPromoted = isPromotedStatus(viewerPromotionStatus)
  const postgisSatisfied = postgisPromoted || (resultPackage.stageKey === 'viewer-artifacts' && isNotApplicableStatus(postgisPromotionStatus))
  const viewerSatisfied = viewerPromoted || (['ingestion-queue', 'environmental-extractors'].includes(resultPackage.stageKey) && isNotApplicableStatus(viewerPromotionStatus))
  const runOutput = {
    resultStatus: status,
    ...(resultPackage.dispatch ? {
      dispatchReturnStatus: resultPackage.dispatch.returnStatus,
      executorProfile: resultPackage.dispatch.executorProfile,
      externalRunStatus: resultPackage.externalRun?.status ?? null,
    } : {}),
  }
  const steps = [
    ['run-offline-data-factory', succeeded ? 'succeeded' : 'failed', runOutput],
    ['promote-postgis-results', succeeded ? (postgisSatisfied ? 'succeeded' : 'pending') : 'failed', { promotionStatus: postgisPromotionStatus }],
    ['register-viewer-artifacts', succeeded ? (viewerSatisfied ? 'succeeded' : 'pending') : 'failed', { promotionStatus: viewerPromotionStatus }],
  ]
  for (const [stepKey, stepStatus, output] of steps) {
    await client.query(
      `
        UPDATE ldt_ops.workflow_steps
        SET
          status = $3,
          output = COALESCE(output, '{}'::jsonb) || $4::jsonb,
          finished_at = CASE WHEN $3 IN ('succeeded', 'failed') THEN now() ELSE finished_at END,
          updated_at = now()
        WHERE run_id = $1
          AND step_key = $2
      `,
      [runId, stepKey, stepStatus, JSON.stringify(output)],
    )
  }
}

export async function importOfflineDataFactoryResult({
  runId,
  cityId = null,
  resultPackage,
  submittedBy = null,
} = {}) {
  const normalizedRunId = requireRunId(runId)
  const normalizedCityId = cityId ? requireCityId(cityId) : null
  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const run = await loadOfflineRunForUpdate(client, normalizedRunId, normalizedCityId)
      const handoffArtifact = await latestHandoffArtifact(client, normalizedRunId)
      const dispatchArtifact = await latestDispatchArtifact(client, normalizedRunId)
      const finalPackage = normalizedResultPackage({
        resultPackage,
        run,
        handoffArtifact,
        dispatchArtifact,
        submittedBy,
      })
      const relativePath = resultRuntimeRelativePath(run.city_id, run.id)
      const localPath = path.join(getRuntimeDir(), relativePath)
      const artifactUri = `runtime://${relativePath.split(path.sep).join('/')}`
      const packageWithArtifact = await applyOfflineDataFactoryPromotion(client, {
        ...finalPackage,
        artifactUri,
      })
      writeJsonFile(localPath, packageWithArtifact)
      const byteSize = Buffer.byteLength(`${JSON.stringify(packageWithArtifact, null, 2)}\n`)
      const checksum = sha256Json(packageWithArtifact)

      const artifactResult = await client.query(
        `
          INSERT INTO ldt_ops.workflow_artifacts (
            run_id,
            city_id,
            artifact_kind,
            artifact_uri,
            media_type,
            byte_size,
            checksum,
            metadata
          )
          VALUES ($1, $2, 'offline-data-factory-result', $3, 'application/json', $4, $5, $6::jsonb)
          RETURNING *
        `,
        [
          run.id,
          run.city_id,
          artifactUri,
          byteSize,
          checksum,
          JSON.stringify({
            localPath,
            relativePath: relativePath.split(path.sep).join('/'),
            stageKey: packageWithArtifact.stageKey,
            stageContract: packageWithArtifact.stageContract,
            resultStatus: packageWithArtifact.status,
            dispatch: packageWithArtifact.dispatch,
            externalRun: packageWithArtifact.externalRun,
            promotion: packageWithArtifact.promotion,
          }),
        ],
      )
      const workflowStatus = packageWithArtifact.status === 'succeeded' ? 'succeeded' : 'failed'
      await updateResultSteps(client, run.id, packageWithArtifact.status, packageWithArtifact)
      await client.query(
        `
          UPDATE ldt_ops.workflow_runs
          SET
            status = $2,
            output = COALESCE(output, '{}'::jsonb) || $3::jsonb,
            error = CASE WHEN $2 = 'failed' THEN $4::jsonb ELSE '{}'::jsonb END,
            finished_at = now(),
            updated_at = now()
          WHERE id = $1
        `,
        [
          run.id,
          workflowStatus,
          JSON.stringify({
            offlineDataFactoryResult: {
              status: packageWithArtifact.status,
              artifactUri,
              checksum,
              byteSize,
              localPath,
              stageContract: packageWithArtifact.stageContract,
              dispatch: packageWithArtifact.dispatch,
              externalRun: packageWithArtifact.externalRun,
              promotion: packageWithArtifact.promotion,
            },
          }),
          JSON.stringify(packageWithArtifact.status === 'failed' ? packageWithArtifact.validation : {}),
        ],
      )
      await client.query('COMMIT')

      const detail = await getWorkflowRun(run.id)
      return {
        ok: true,
        cityId: run.city_id,
        workflowKey: WORKFLOW_KEY,
        run: detail.run,
        result: {
          runId: run.id,
          stageKey: packageWithArtifact.stageKey,
          status: packageWithArtifact.status,
          artifactUri,
          checksum,
          byteSize,
          localPath,
          artifactId: artifactResult.rows[0].id,
          stageContract: packageWithArtifact.stageContract,
          dispatch: packageWithArtifact.dispatch,
          externalRun: packageWithArtifact.externalRun,
          promotion: packageWithArtifact.promotion,
        },
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }).catch((error) => ({
    ok: false,
    cityId: normalizedCityId,
    workflowKey: WORKFLOW_KEY,
    run: null,
    result: null,
    error: String(error?.message ?? 'OFFLINE_DATA_FACTORY_RESULT_IMPORT_FAILED'),
  }))
}
