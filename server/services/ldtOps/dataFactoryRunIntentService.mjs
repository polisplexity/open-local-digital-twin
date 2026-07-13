import {
  createRegisteredCityInputPackage,
} from './cityInputPackageService.mjs'
import { withClient } from './dbUtils.mjs'
import { runOfflineDataFactoryJob } from './offlineDataFactoryRunnerService.mjs'
import { offlineDataFactoryAllowedStageKeys } from './offlineDataFactoryStageRegistry.mjs'
import { getProcessingNode, listProcessingNodes } from './processingNodeService.mjs'
import { ensureSameServerSidecarProvider } from './sameServerSidecarProviderService.mjs'
import { evaluateCityBoundaryQualityGate } from './citySourcePlanService.mjs'

const RUN_INTENT_SCHEMA_VERSION = '2026-06-28.data-factory-run-intent.v1'

const PROVIDERS = new Set([
  'same-server-sidecar',
  'server-to-server-pull',
  'server-to-server-push',
  'offline-bundle',
  'hpc-batch',
  'cloud-batch',
  'manual-import',
])

const EXECUTABLE_PROVIDERS = new Set([
  'same-server-sidecar',
  'server-to-server-pull',
])

function text(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function normalizeKey(value, fallback = '') {
  const normalized = text(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{0,128}$/.test(normalized)) throw new Error('DATA_FACTORY_RUN_INTENT_KEY_INVALID')
  return normalized
}

function normalizeCityId(cityId) {
  const normalized = normalizeKey(cityId, '')
  if (!normalized) throw new Error('CITY_ID_REQUIRED')
  return normalized
}

function normalizeStageKey(stageKey) {
  const normalized = normalizeKey(stageKey, 'viewer-artifacts')
  if (!offlineDataFactoryAllowedStageKeys().includes(normalized)) throw new Error(`DATA_FACTORY_STAGE_INVALID:${normalized}`)
  return normalized
}

function normalizeProviderType(providerType) {
  const normalized = normalizeKey(providerType, 'server-to-server-pull')
  if (!PROVIDERS.has(normalized)) throw new Error(`DATA_FACTORY_PROVIDER_INVALID:${normalized}`)
  return normalized
}

function inputPolicy(value) {
  const normalized = normalizeKey(value, 'reuse-latest-or-create')
  if (['skip', 'reuse-latest', 'reuse-latest-or-create', 'create-new'].includes(normalized)) return normalized
  throw new Error(`DATA_FACTORY_CITY_INPUT_POLICY_INVALID:${normalized}`)
}

function artifactPolicy(input = {}) {
  const source = input && typeof input === 'object' ? input : {}
  const transferMode = normalizeKey(source.transferMode ?? source.transfer_mode, 'runtime-bundle')
  const activationMode = normalizeKey(source.activationMode ?? source.activation_mode, 'staged')
  return {
    transferMode,
    activationMode,
    activateArtifacts: activationMode === 'activate-latest' || source.activateArtifacts === true || source.activate_artifacts === true,
  }
}

function stageInputScope(stageKey) {
  if (stageKey === 'semantic-materialization') return 'semantic'
  if (stageKey === 'environmental-extractors') return 'environmental'
  if (stageKey === 'postgis-twin' || stageKey === 'ingestion-queue') return 'provenance'
  return 'viewer-runtime'
}

function requireBoundaryGatePassed(boundaryGate) {
  if (boundaryGate?.passed === true) return
  throw new Error(`DATA_FACTORY_CITY_BOUNDARY_GATE_BLOCKED:${boundaryGate?.code ?? 'CITY_BOUNDARY_REQUIRED'}`)
}

function requireProcessingNodePreflight({ providerType, node, providerResult }) {
  if (!EXECUTABLE_PROVIDERS.has(providerType)) return
  if (providerType === 'same-server-sidecar') {
    if (providerResult?.ready === true && providerResult?.doctor?.ok === true) return
    throw new Error(`DATA_FACTORY_PROVIDER_PREFLIGHT_FAILED:${providerType}:${providerResult?.doctor?.missingRequiredCommands?.join(',') || providerResult?.error || 'doctor-not-passed'}`)
  }
  if (!node) throw new Error(`DATA_FACTORY_NODE_REQUIRED:${providerType}`)
  if (node.status !== 'online') throw new Error(`DATA_FACTORY_NODE_NOT_ONLINE:${node.nodeKey}:${node.status}`)
  if (node.latestHeartbeat?.doctorStatus !== 'passed') {
    throw new Error(`DATA_FACTORY_NODE_DOCTOR_NOT_PASSED:${node.nodeKey}:${node.latestHeartbeat?.doctorStatus ?? 'missing'}`)
  }
}

function publicCityInputPackage(row = null) {
  if (!row) return null
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  return {
    id: row.id,
    packageKey: metadata.packageKey ?? null,
    artifactUri: row.artifact_uri,
    mediaType: row.media_type,
    byteSize: Number(row.byte_size ?? 0),
    checksum: row.checksum,
    localPath: metadata.localPath ?? null,
    relativePath: metadata.relativePath ?? null,
    inputScope: metadata.databaseDump?.inputScope ?? metadata.dataPlane?.inputScope ?? 'viewer-runtime',
    restoreCommand: metadata.restore?.command ?? metadata.dataPlane?.restoreCommand ?? null,
    sourceSummary: metadata.sourceSummary ?? {},
    databaseDump: metadata.databaseDump ?? {},
    createdAt: row.created_at,
  }
}

async function latestCityInputPackage(cityId, { inputScope = '' } = {}) {
  return withClient(async (client) => {
    const result = await client.query(
      `
        SELECT *
        FROM ldt_ops.workflow_artifacts
        WHERE city_id = $1
          AND artifact_kind = 'data-factory-city-input-package'
        ORDER BY created_at DESC
        LIMIT 25
      `,
      [cityId],
    )
    const packages = result.rows.map((row) => publicCityInputPackage(row)).filter(Boolean)
    if (!inputScope) return packages[0] ?? null
    return packages.find((entry) => entry.inputScope === inputScope) ?? null
  })
}

async function resolveCityInputPackage({
  cityId,
  policy,
  inputScope,
  submittedBy,
} = {}) {
  if (policy === 'skip') {
    return {
      status: 'skipped',
      policy,
      package: null,
    }
  }

  if (policy !== 'create-new') {
    const latest = await latestCityInputPackage(cityId, { inputScope })
    if (latest) {
      return {
        status: 'reused-latest',
        policy,
        package: latest,
      }
    }
    if (policy === 'reuse-latest') {
      return {
        status: 'missing',
        policy,
        package: null,
        warning: 'DATA_FACTORY_CITY_INPUT_PACKAGE_NOT_FOUND',
      }
    }
  }

  const created = await createRegisteredCityInputPackage({
    cityId,
    inputScope,
    submittedBy,
  })
  return {
    status: 'created',
    policy,
    package: {
      ...created.artifact,
      packageKey: created.packageKey,
      restoreCommand: created.manifest?.restore?.command ?? null,
      sourceSummary: created.manifest?.sourceSummary ?? {},
      databaseDump: created.manifest?.databaseDump ?? {},
    },
  }
}

async function resolveProcessingNode({ providerType, nodeKey, cityId, stageKey }) {
  if (providerType === 'same-server-sidecar') {
    const ensured = await ensureSameServerSidecarProvider({
      cityId,
      nodeKey: nodeKey || `same-server-sidecar-${cityId}`,
      runDoctor: true,
      requireDb: false,
      registeredBy: 'data-factory-run-intent',
    })
    return {
      status: ensured.ready ? 'ready' : 'registered',
      selectedBy: 'managed-same-server',
      node: ensured.node ?? null,
      providerResult: ensured,
    }
  }

  if (nodeKey) {
    const node = await getProcessingNode(nodeKey)
    return {
      status: node.ok ? 'ready' : 'waiting-for-node',
      selectedBy: 'operator-node-key',
      node: node.node ?? null,
      warning: node.ok ? null : node.error,
    }
  }

  const listed = await listProcessingNodes({
    providerType,
    limit: 25,
  })
  const nodes = listed.nodes ?? []
  const eligible = nodes.filter((node) => {
    const supports = node.capabilities?.supports
    if (Array.isArray(supports) && supports.length && !supports.includes(stageKey)) return false
    return true
  })
  const selected = eligible.find((node) => node.status === 'online') ?? eligible[0] ?? null
  return {
    status: selected ? 'ready' : 'waiting-for-node',
    selectedBy: selected ? 'registered-provider-scan' : 'no-registered-node',
    node: selected,
    warning: selected ? null : `DATA_FACTORY_NODE_NOT_REGISTERED:${providerType}`,
  }
}

function workerCommandHints({
  cityId,
  stageKey,
  providerType,
  node,
  runId,
  cityInputPackage,
  artifact,
  twinStudioUrl,
} = {}) {
  if (providerType !== 'server-to-server-pull') return null
  const nodeKey = node?.nodeKey ?? '<registered-node-key>'
  const cityInputPath = cityInputPackage?.localPath
    ? '<copied-city-input-package.tgz>'
    : '<city-input-package.tgz>'
  const args = [
    'npm', 'run', 'ops:server-to-server-pull-worker', '--',
    `--node-key=${nodeKey}`,
    `--twin-studio-url=${twinStudioUrl || '<TWIN_STUDIO_BASE_URL>'}`,
    `--city=${cityId}`,
    `--stage=${stageKey}`,
    `--run-id=${runId}`,
    '--once',
  ]
  if (stageKey === 'viewer-artifacts') {
    args.push('--stage-runner=viewer-artifacts')
    args.push('--upload-artifact-bundle')
    if (!artifact.activateArtifacts) args.push('--no-activate')
  }
  if (cityInputPackage) {
    args.push('--restore-city-input')
    args.push(`--city-input-package=${cityInputPath}`)
    args.push('--city-input-clean')
  }
  return {
    command: args.join(' '),
    tokenEnv: 'TWIN_STUDIO_DATA_FACTORY_TOKEN',
    cityInputTransfer: cityInputPackage ? {
      sourceArtifactUri: cityInputPackage.artifactUri,
      sourceLocalPath: cityInputPackage.localPath ?? null,
      checksum: cityInputPackage.checksum,
      byteSize: cityInputPackage.byteSize,
      workerPlaceholder: cityInputPath,
    } : null,
  }
}

export async function createDataFactoryRunIntent({
  cityId,
  stageKey = 'viewer-artifacts',
  providerType = 'server-to-server-pull',
  nodeKey = '',
  cityInputPolicy = 'reuse-latest-or-create',
  artifactTransferPolicy = {},
  promotionPolicy = 'stage-applicator',
  runPolicy = 'dispatch-only',
  runnerOptions = {},
  twinStudioUrl = '',
  requestedBy = null,
  submittedBy = 'operations-ingestion-ui',
} = {}) {
  const normalizedCityId = normalizeCityId(cityId)
  const normalizedStageKey = normalizeStageKey(stageKey)
  const normalizedProviderType = normalizeProviderType(providerType)
  const normalizedInputPolicy = inputPolicy(cityInputPolicy)
  const normalizedInputScope = stageInputScope(normalizedStageKey)
  const artifact = artifactPolicy(artifactTransferPolicy)
  const steps = []
  const boundaryGate = await evaluateCityBoundaryQualityGate(normalizedCityId)
  steps.push({
    key: 'city-boundary-quality-gate',
    status: boundaryGate.passed ? 'passed' : 'blocked',
    code: boundaryGate.code,
    detail: boundaryGate.detail ?? {},
  })
  requireBoundaryGatePassed(boundaryGate)

  const node = await resolveProcessingNode({
    providerType: normalizedProviderType,
    nodeKey: text(nodeKey),
    cityId: normalizedCityId,
    stageKey: normalizedStageKey,
  })
  const requestedNodeKey = text(nodeKey)
  const resolvedNodeKey = node.node?.nodeKey ?? (requestedNodeKey || null)
  requireProcessingNodePreflight({
    providerType: normalizedProviderType,
    node: node.node,
    providerResult: node.providerResult,
  })
  steps.push({
    key: 'processing-node',
    status: node.status,
    providerType: normalizedProviderType,
    nodeKey: resolvedNodeKey,
    selectedBy: node.selectedBy,
    warning: node.warning ?? null,
  })

  const cityInput = await resolveCityInputPackage({
    cityId: normalizedCityId,
    policy: normalizedInputPolicy,
    inputScope: normalizedInputScope,
    submittedBy,
  })
  steps.push({
    key: 'city-input-package',
    status: cityInput.status,
    policy: normalizedInputPolicy,
    inputScope: normalizedInputScope,
    artifactUri: cityInput.package?.artifactUri ?? null,
    checksum: cityInput.package?.checksum ?? null,
    warning: cityInput.warning ?? null,
  })

  const executorProfile = runPolicy === 'execute-local' || normalizedProviderType === 'same-server-sidecar'
    ? 'local-process'
    : 'external-worker'
  const normalizedRunnerOptions = {
    ...(runnerOptions && typeof runnerOptions === 'object' ? runnerOptions : {}),
    dataFactoryRunIntent: {
      schemaVersion: RUN_INTENT_SCHEMA_VERSION,
      cityId: normalizedCityId,
      stageKey: normalizedStageKey,
      providerType: normalizedProviderType,
      nodeKey: resolvedNodeKey,
      cityInput: cityInput.package ? {
        artifactUri: cityInput.package.artifactUri,
        checksum: cityInput.package.checksum,
        byteSize: cityInput.package.byteSize,
        localPath: cityInput.package.localPath ?? null,
        restoreCommand: cityInput.package.restoreCommand ?? null,
        inputScope: cityInput.package.databaseDump?.inputScope ?? normalizedInputScope,
      } : null,
      artifactTransferPolicy: artifact,
      promotionPolicy,
      runPolicy,
    },
  }

  const run = await runOfflineDataFactoryJob({
    cityId: normalizedCityId,
    stageKey: normalizedStageKey,
    executorProfile,
    requestedBy,
    submittedBy,
    runnerOptions: normalizedRunnerOptions,
  })
  steps.push({
    key: executorProfile === 'external-worker' ? 'external-dispatch' : 'local-execution',
    status: run.ok ? (executorProfile === 'external-worker' ? 'prepared' : 'completed') : 'failed',
    runId: run.runId ?? null,
    dispatchArtifactUri: run.dispatch?.dispatch?.artifactUri ?? run.dispatch?.dispatch?.dispatch?.artifactUri ?? null,
    error: run.error ?? null,
  })

  const hints = workerCommandHints({
    cityId: normalizedCityId,
    stageKey: normalizedStageKey,
    providerType: normalizedProviderType,
    node: node.node,
    runId: run.runId,
    cityInputPackage: cityInput.package,
    artifact,
    twinStudioUrl,
  })

  const unsupportedProvider = !EXECUTABLE_PROVIDERS.has(normalizedProviderType)
  const finalStatus = run.ok
    ? unsupportedProvider
      ? 'adapter-plan-required'
      : executorProfile === 'external-worker'
        ? node.node ? 'waiting-for-worker' : 'waiting-for-node'
        : 'completed'
    : 'failed'

  return {
    ok: run.ok !== false,
    schemaVersion: RUN_INTENT_SCHEMA_VERSION,
    status: finalStatus,
    cityId: normalizedCityId,
    stageKey: normalizedStageKey,
    providerType: normalizedProviderType,
    runPolicy,
    executorProfile,
    cityInput,
    processingNode: node,
    workflowRun: run,
    workerCommandHints: hints,
    steps,
    boundaries: {
      productOwns: ['city input package', 'dispatch contract', 'result import contract', 'artifact/promotion policy'],
      providerOwns: ['heavy execution', 'worker-local PostGIS restore', 'artifact bytes generation'],
      unresolved: unsupportedProvider
        ? [`${normalizedProviderType} adapter execution is plan-only until a provider plugin is installed.`]
        : [],
    },
  }
}
