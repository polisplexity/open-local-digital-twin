const COMMON_VALIDATION = [
  'source identity preserved',
  'city boundary scope preserved',
  'checksums recorded',
  'operator reviews promotion summary before authority claims',
]

const RUNNER_PROFILES = {
  'interactive-backend': {
    key: 'interactive-backend',
    label: 'Interactive backend',
    portability: 'live-backend',
    requiresHandoff: false,
    writesDirectly: true,
  },
  'local-process': {
    key: 'local-process',
    label: 'Local process',
    portability: 'same-runtime',
    requiresHandoff: true,
    writesDirectly: false,
  },
  'external-worker': {
    key: 'external-worker',
    label: 'External worker',
    portability: 'portable-runner',
    requiresHandoff: true,
    writesDirectly: false,
  },
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function runnerProfiles(keys) {
  return keys.map((key) => RUNNER_PROFILES[key]).filter(Boolean).map(clone)
}

function commonPromotionContract(cityId) {
  return {
    cityId,
    requiredValidation: COMMON_VALIDATION,
  }
}

function semanticPromotionContract(cityId) {
  return {
    ...commonPromotionContract(cityId),
    postgis: {
      writes: [
        'ldt_semantic.entity_semantic_tags',
        'ldt_semantic.semantic_indicators',
        'ldt_semantic.service_features',
        'ldt_semantic.semantic_pack_runs',
      ],
      promotionRule: 'Promote only validated semantic tags, pack indicators, service features, rule checks, and workflow contracts back into PostGIS.',
    },
    artifactRegistry: {
      optional: true,
      writes: ['ldt_viewer.viewer_artifacts'],
      promotionRule: 'Register any generated MVT, PMTiles, or 3D Tiles packages through the viewer artifact registry before viewers resolve latest.',
    },
  }
}

function environmentalPromotionContract(cityId) {
  return {
    ...commonPromotionContract(cityId),
    postgis: {
      writes: [
        'ldt_environment.extractor_runs',
        'ldt_environment.extractor_artifacts',
        'ldt_environment.phenomenon_layers',
        'ldt_environment.object_observations',
      ],
      promotionRule: 'Promote source-plan evidence first; promote measured or modelled phenomenon cells only after source-backed extractor validation passes.',
    },
    artifactRegistry: {
      optional: true,
      writes: ['ldt_viewer.viewer_artifacts'],
      promotionRule: 'Register any generated MVT, PMTiles, raster, or 3D Tiles outputs through the viewer artifact registry before viewers resolve latest.',
    },
  }
}

function canonicalPromotionContract(cityId) {
  return {
    ...commonPromotionContract(cityId),
    postgis: {
      writes: ['ldt_core.city_entities', 'ldt_prov.source_features', 'ldt_catalog.datasets'],
      promotionRule: 'Promote validated canonical records into PostGIS; generated files alone are not the twin.',
    },
    artifactRegistry: {
      optional: false,
      writes: ['ldt_viewer.viewer_artifacts'],
      promotionRule: 'Published viewer outputs must be registered, versioned, checksummed, and activated through the registry.',
    },
  }
}

function semanticStageApplicatorPromotion(stageKey) {
  return {
    mode: 'stage-applicator',
    postgis: {
      status: 'promoted',
      stageApplicator: stageKey,
      expectedMinimums: {
        activeSemanticTags: 1,
        semanticClasses: 1,
        sourceMappings: 1,
        cityPackBindings: 1,
        serviceIndicators: 1,
        serviceFeatures: 1,
        serviceWorkflows: 1,
        workflowContracts: 1,
        ruleChecks: 1,
      },
    },
    viewerArtifacts: {
      status: 'not-applicable',
      artifacts: [],
    },
  }
}

function ingestionQueueStageApplicatorPromotion(stageKey) {
  return {
    mode: 'stage-applicator',
    postgis: {
      status: 'promoted',
      stageApplicator: stageKey,
      expectedMinimums: {
        ingestionJobs: 1,
        queueableJobs: 1,
      },
    },
    viewerArtifacts: {
      status: 'not-applicable',
      artifacts: [],
    },
  }
}

function environmentalStageApplicatorPromotion(stageKey) {
  return {
    mode: 'stage-applicator',
    postgis: {
      status: 'promoted',
      stageApplicator: stageKey,
      expectedMinimums: {
        extractorDefinitions: 1,
        sourcePlanRuns: 1,
        sourcePlanArtifacts: 1,
      },
    },
    viewerArtifacts: {
      status: 'not-applicable',
      artifacts: [],
    },
  }
}

function viewerArtifactsStageApplicatorPromotion(stageKey) {
  return {
    mode: 'stage-applicator',
    postgis: {
      status: 'not-applicable',
      stageApplicator: stageKey,
    },
    viewerArtifacts: {
      status: 'promoted',
      artifacts: [],
      expectedMinimums: {
        registeredArtifacts: 1,
        activeArtifacts: 1,
      },
    },
  }
}

function stageContract({
  inputs = [],
  outputs = [],
  artifacts = [],
  validations = [],
  runnerProfileKeys = ['interactive-backend'],
  promotionTargets = [],
  notes = [],
} = {}) {
  return {
    schemaVersion: '2026-06-26.data-factory-stage-contract.v1',
    inputs,
    outputs,
    artifacts,
    validations: [
      { key: 'city-boundary-scope', severity: 'required', rule: 'The stage must preserve the active city boundary and may not expand scope silently.' },
      { key: 'source-provenance', severity: 'required', rule: 'Every promoted record or artifact must retain source identity and provenance.' },
      { key: 'portable-artifacts', severity: 'required', rule: 'Large artifacts must be referenced by URI with checksum, byte size, type, and version.' },
      ...validations,
    ],
    runnerProfiles: runnerProfiles(runnerProfileKeys),
    allowedRunnerProfiles: runnerProfileKeys,
    promotionTargets,
    notes,
  }
}

const DATA_FACTORY_STAGE_DEFINITIONS = [
  {
    key: 'city-boundary',
    label: 'City boundary gate',
    contract: stageContract({
      inputs: [
        { key: 'city-registry-record', type: 'PostGIS row', source: 'ldt_core.cities', required: true },
        { key: 'municipal-boundary', type: 'geometry', source: 'ldt_core.city_boundaries', required: true },
      ],
      outputs: [
        { key: 'boundary-quality-gate', type: 'operations evidence', destination: 'ldt_ops report', required: true },
      ],
      validations: [
        { key: 'boundary-exists', severity: 'required', rule: 'At least one boundary geometry exists for the active city.' },
        { key: 'boundary-area-plausible', severity: 'required', rule: 'Boundary area and feature count must pass the active city quality gate.' },
      ],
      promotionTargets: ['ldt_core.city_boundaries'],
      notes: ['This stage is a gate, not an external worker stage.'],
    }),
  },
  {
    key: 'provider-assist',
    label: 'Provider assist',
    contract: stageContract({
      inputs: [
        { key: 'provider-capability-registry', type: 'capability list', source: 'provider ingestion service', required: true },
        { key: 'city-source-plan', type: 'source plan', source: 'city config/backend override', required: true },
      ],
      outputs: [
        { key: 'provider-action-plan', type: 'machine gate report', destination: 'operations report', required: true },
      ],
      validations: [
        { key: 'source-identity', severity: 'required', rule: 'Every source action must declare source URI/path, format, version, and provider posture.' },
        { key: 'tool-readiness', severity: 'required', rule: 'A provider action must disclose missing tools instead of pretending it can execute.' },
      ],
      promotionTargets: ['public.layer_ingestion_jobs', 'ldt_catalog.datasets'],
      notes: ['This stage decides where work should run; it does not process large data itself.'],
    }),
  },
  {
    key: 'ingestion-queue',
    label: 'Ingestion queue',
    runnerHandler: 'ingestionQueue',
    commandHints: (cityId) => [
      `npm run db:ldt:reingest-open -- --city=${cityId}`,
      `npm run ops:register-viewer-artifacts -- --city=${cityId} --activate-latest`,
    ],
    promotionContract: canonicalPromotionContract,
    stageApplicatorPromotion: ingestionQueueStageApplicatorPromotion,
    contract: stageContract({
      inputs: [
        { key: 'city-source-plan', type: 'source plan', source: 'backend', required: true },
        { key: 'provider-package', type: 'source package', source: 'operator/provider action', required: false },
        { key: 'layer-target', type: 'layer key', source: 'registry', required: true },
      ],
      outputs: [
        { key: 'ingestion-job', type: 'PostGIS row', destination: 'public.layer_ingestion_jobs', required: true },
        { key: 'validation-report', type: 'PostGIS row', destination: 'public.ingestion_validation_reports', required: true },
      ],
      artifacts: [
        { key: 'offline-handoff', artifactKind: 'offline-data-factory-handoff', mediaType: 'application/json', required: true, checksumRequired: true },
        { key: 'offline-result', artifactKind: 'offline-data-factory-result', mediaType: 'application/json', required: true, checksumRequired: true },
      ],
      validations: [
        { key: 'queueable-job-created', severity: 'required', rule: 'At least one queueable ingestion job is created or validated.' },
        { key: 'validation-report-linked', severity: 'required', rule: 'Validation evidence must link to the ingestion job before promotion.' },
      ],
      runnerProfileKeys: ['interactive-backend', 'local-process', 'external-worker'],
      promotionTargets: ['public.layer_ingestion_jobs', 'public.ingestion_validation_reports'],
    }),
  },
  {
    key: 'environmental-extractors',
    label: 'Environmental extractors',
    runnerHandler: 'environmentalExtractors',
    commandHints: (cityId) => [
      `npm run db:ldt:register-environmental-extractors -- --city=${cityId}`,
      `npm run db:ldt:run-terrain-dem -- --city=${cityId}`,
      `npm run db:ldt:run-weather-field -- --city=${cityId}`,
      `npm run db:ldt:run-hydrology-grid -- --city=${cityId}`,
    ],
    promotionContract: environmentalPromotionContract,
    stageApplicatorPromotion: environmentalStageApplicatorPromotion,
    contract: stageContract({
      inputs: [
        { key: 'source-plan', type: 'environmental source plan', source: 'backend/source registry', required: true },
        { key: 'city-boundary', type: 'geometry', source: 'ldt_core.city_boundaries', required: true },
        { key: 'runner-options', type: 'JSON object', source: 'operator/dispatch', required: false },
      ],
      outputs: [
        { key: 'extractor-run', type: 'PostGIS row', destination: 'ldt_environment.extractor_runs', required: true },
        { key: 'extractor-artifact', type: 'PostGIS row', destination: 'ldt_environment.extractor_artifacts', required: true },
        { key: 'phenomenon-layer', type: 'PostGIS rows', destination: 'ldt_environment.phenomenon_layers', required: false },
        { key: 'object-observation', type: 'PostGIS rows', destination: 'ldt_environment.object_observations', required: false },
      ],
      artifacts: [
        { key: 'source-plan-artifact', artifactKind: 'environmental-source-plan', mediaType: 'application/json', required: true, checksumRequired: true },
        { key: 'derived-raster-or-tiles', artifactKind: 'environmental-derived-artifact', mediaType: 'application/octet-stream', required: false, checksumRequired: true },
      ],
      validations: [
        { key: 'extractor-definition-registered', severity: 'required', rule: 'Extractor definition and source plan must be registered before derived values are promoted.' },
        { key: 'derived-values-source-backed', severity: 'required', rule: 'DEM, weather, hydrology, or STAC-derived outputs must cite source artifacts.' },
      ],
      runnerProfileKeys: ['interactive-backend', 'local-process', 'external-worker'],
      promotionTargets: ['ldt_environment.extractor_runs', 'ldt_environment.extractor_artifacts', 'ldt_environment.phenomenon_layers', 'ldt_viewer.viewer_artifacts'],
    }),
  },
  {
    key: 'postgis-twin',
    label: 'PostGIS city twin',
    contract: stageContract({
      inputs: [
        { key: 'validated-source-features', type: 'PostGIS rows', source: 'ldt_prov.source_features', required: true },
        { key: 'source-evidence', type: 'PostGIS rows', source: 'ldt_prov.entity_source_evidence', required: true },
      ],
      outputs: [
        { key: 'city-entities', type: 'PostGIS rows', destination: 'ldt_core.city_entities', required: true },
        { key: 'canonical-provenance', type: 'PostGIS rows', destination: 'ldt_prov.entity_source_evidence', required: true },
      ],
      validations: [
        { key: 'canonical-entity-linkage', severity: 'required', rule: 'Canonical entities must have source evidence before viewer artifacts claim readiness.' },
      ],
      promotionTargets: ['ldt_core.city_entities', 'ldt_prov.source_features', 'ldt_prov.entity_source_evidence'],
      notes: ['PostGIS is the twin source of truth; files are publishable artifacts.'],
    }),
  },
  {
    key: 'viewer-artifacts',
    label: 'Viewer artifacts',
    runnerHandler: 'viewerArtifacts',
    commandHints: (cityId) => [
      `npm run ops:pack-pmtiles -- --city=${cityId}`,
      `npm run ops:register-viewer-artifacts -- --city=${cityId} --activate-latest`,
    ],
    promotionContract: canonicalPromotionContract,
    stageApplicatorPromotion: viewerArtifactsStageApplicatorPromotion,
    contract: stageContract({
      inputs: [
        { key: 'postgis-twin', type: 'PostGIS canonical rows', source: 'ldt_core/ldt_prov', required: true },
        { key: 'tile-build-inputs', type: 'runtime artifact paths', source: 'data factory runner', required: true },
      ],
      outputs: [
        { key: 'viewer-artifact-registry', type: 'PostGIS rows', destination: 'ldt_viewer.viewer_artifacts', required: true },
      ],
      artifacts: [
        { key: 'mvt-directory', artifactKind: 'mvt-directory', mediaType: 'application/vnd.mapbox-vector-tile', required: true, checksumRequired: true },
        { key: 'pmtiles', artifactKind: 'pmtiles', mediaType: 'application/vnd.pmtiles', required: true, checksumRequired: true },
        { key: '3d-tiles', artifactKind: '3d-tiles', mediaType: 'application/json+3dtiles', required: true, checksumRequired: true },
      ],
      validations: [
        { key: 'artifact-registry-row', severity: 'required', rule: 'Every publishable viewer artifact must be registered with URI, version, checksum, byte size, transport, and active flag.' },
        { key: 'artifact-reachability', severity: 'required', rule: 'Registered artifacts must be reachable by the viewer route before activation.' },
      ],
      runnerProfileKeys: ['interactive-backend', 'local-process', 'external-worker'],
      promotionTargets: ['ldt_viewer.viewer_artifacts'],
    }),
  },
  {
    key: 'semantic-materialization',
    label: 'Semantic materialization',
    runnerHandler: 'semanticMaterialization',
    commandHints: (cityId) => [
      `npm run db:ldt:materialize-semantic-tags -- --city=${cityId}`,
      `npm run db:ldt:generate-semantic-packs -- --city=${cityId} --all-packs`,
    ],
    promotionContract: semanticPromotionContract,
    stageApplicatorPromotion: semanticStageApplicatorPromotion,
    contract: stageContract({
      inputs: [
        { key: 'city-entities', type: 'PostGIS rows', source: 'ldt_core.city_entities', required: true },
        { key: 'semantic-source-mappings', type: 'PostGIS rows', source: 'ldt_semantic.source_semantic_mappings', required: true },
        { key: 'semantic-pack-manifests', type: 'JSON manifest rows', source: 'semantic pack catalog', required: false },
      ],
      outputs: [
        { key: 'entity-semantic-tags', type: 'PostGIS rows', destination: 'ldt_semantic.entity_semantic_tags', required: true },
        { key: 'semantic-indicators', type: 'PostGIS rows', destination: 'ldt_semantic.semantic_indicators', required: false },
        { key: 'semantic-pack-runs', type: 'PostGIS rows', destination: 'ldt_semantic.semantic_pack_runs', required: false },
      ],
      artifacts: [
        { key: 'semantic-result-package', artifactKind: 'offline-data-factory-result', mediaType: 'application/json', required: true, checksumRequired: true },
        { key: 'semantic-viewer-artifacts', artifactKind: 'semantic-viewer-artifact', mediaType: 'application/octet-stream', required: false, checksumRequired: true },
      ],
      validations: [
        { key: 'mapping-coverage', severity: 'required', rule: 'A semantic tag must be traceable to a source mapping or pack rule.' },
        { key: 'pack-manifest-compatible', severity: 'required', rule: 'Semantic pack outputs must declare manifest version and produced classes/indicators.' },
      ],
      runnerProfileKeys: ['interactive-backend', 'local-process', 'external-worker'],
      promotionTargets: ['ldt_semantic.entity_semantic_tags', 'ldt_semantic.semantic_pack_runs', 'ldt_viewer.viewer_artifacts'],
    }),
  },
  {
    key: 'operations-evidence',
    label: 'Operations evidence',
    contract: stageContract({
      inputs: [
        { key: 'api-usage-events', type: 'PostGIS rows', source: 'ldt_ops.api_usage_events', required: false },
        { key: 'workflow-runs', type: 'PostGIS rows', source: 'ldt_ops.workflow_runs', required: false },
        { key: 'workflow-artifacts', type: 'PostGIS rows', source: 'ldt_ops.workflow_artifacts', required: false },
      ],
      outputs: [
        { key: 'operations-report', type: 'API payload', destination: '/api/live/current/operations-report', required: true },
      ],
      validations: [
        { key: 'workflow-artifact-ledger', severity: 'required', rule: 'External handoffs, dispatches, and result packages must be recorded in the operations artifact ledger.' },
      ],
      promotionTargets: ['ldt_ops.workflow_runs', 'ldt_ops.workflow_artifacts', 'ldt_ops.api_usage_events'],
    }),
  },
]

const STAGES_BY_KEY = new Map(DATA_FACTORY_STAGE_DEFINITIONS.map((stage) => [stage.key, stage]))
const OFFLINE_STAGE_DEFINITIONS = DATA_FACTORY_STAGE_DEFINITIONS.filter((stage) => stage.runnerHandler)

export function listDataFactoryStageDefinitions() {
  return DATA_FACTORY_STAGE_DEFINITIONS.map((stage) => ({
    key: stage.key,
    label: stage.label,
    runnerHandler: stage.runnerHandler ?? null,
    offlineRunnable: Boolean(stage.runnerHandler),
    contract: clone(stage.contract),
  }))
}

export function listOfflineDataFactoryStageDefinitions() {
  return OFFLINE_STAGE_DEFINITIONS.map((stage) => ({
    key: stage.key,
    label: stage.label,
    runnerHandler: stage.runnerHandler,
    contract: clone(stage.contract),
  }))
}

export function dataFactoryStageContract(stageKey) {
  const definition = STAGES_BY_KEY.get(String(stageKey ?? '').trim())
  return definition?.contract ? clone(definition.contract) : null
}

export function offlineDataFactoryAllowedStageKeys() {
  return OFFLINE_STAGE_DEFINITIONS.map((stage) => stage.key)
}

export function getOfflineDataFactoryStageDefinition(stageKey) {
  const definition = STAGES_BY_KEY.get(String(stageKey ?? '').trim()) ?? null
  if (!definition?.runnerHandler) return null
  return definition
}

export function offlineDataFactoryStageCommandHints(cityId, stageKey) {
  const definition = getOfflineDataFactoryStageDefinition(stageKey)
  if (!definition) throw new Error(`OFFLINE_DATA_FACTORY_STAGE_UNSUPPORTED:${stageKey}`)
  return definition.commandHints(cityId)
}

export function offlineDataFactoryPromotionContract(cityId, stageKey) {
  const definition = getOfflineDataFactoryStageDefinition(stageKey)
  if (!definition) throw new Error(`OFFLINE_DATA_FACTORY_STAGE_UNSUPPORTED:${stageKey}`)
  return definition.promotionContract(cityId)
}

export function offlineDataFactoryStageApplicatorPromotion(stageKey) {
  const definition = getOfflineDataFactoryStageDefinition(stageKey)
  if (!definition) throw new Error(`OFFLINE_DATA_FACTORY_STAGE_UNSUPPORTED:${stageKey}`)
  return definition.stageApplicatorPromotion(definition.key)
}
