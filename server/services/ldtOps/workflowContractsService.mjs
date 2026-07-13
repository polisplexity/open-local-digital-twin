import { inspectProviderIngestionCapabilities } from '../providerLayerIngestionService.mjs'
import { getCitySourcePlan } from './citySourcePlanService.mjs'
import { listDataFactoryStageDefinitions } from './offlineDataFactoryStageRegistry.mjs'

const WORKFLOW_CONTRACT_SCHEMA_VERSION = '2026-07-10.workflow-contract.v3'

const WORKFLOW_KEY_ALIASES = {
  'phase14-open-data-workflow-runner': 'open-source-city-builder',
  'open-source-city-builder': 'open-source-city-builder',
  'offline-data-factory-handoff': 'data-factory-compute-handoff',
  'data-factory-compute-handoff': 'data-factory-compute-handoff',
  'standards-publication-refresh': 'standards-publication-refresh',
  'external-model-enrichment-exchange': 'external-model-enrichment',
  'external-model-enrichment': 'external-model-enrichment',
  'renovation-strategy-readiness-demo': 'renovation-strategy-readiness-demo',
  'vulnerability-clustering-readiness-demo': 'vulnerability-clustering-readiness-demo',
  'eu-ldt-data-platform-publish': 'eu-ldt-data-platform-publish',
  'eu-ldt-data-platform-import-results': 'eu-ldt-data-platform-import-results',
  'eu-ldt-play-visualise-register-layer': 'eu-ldt-play-visualise-register-layer',
  'eu-ldt-marketplace-agent-publish': 'eu-ldt-marketplace-agent-publish',
  'eu-ldt-data-modeller-prepare-schema': 'eu-ldt-data-modeller-prepare-schema',
  'eu-ldt-data-modeller-fixture-import': 'eu-ldt-data-modeller-fixture-import',
  'eu-ldt-data-space-publish': 'eu-ldt-data-space-publish',
  'eu-ldt-data-space-query-exchange': 'eu-ldt-data-space-query-exchange',
  'eu-ldt-cip-publish-metric-source': 'eu-ldt-cip-publish-metric-source',
  'eu-ldt-cip-sync-measurements': 'eu-ldt-cip-sync-measurements',
  'eu-ldt-cip-sync-initiatives': 'eu-ldt-cip-sync-initiatives',
  'eu-ldt-use-case-scenarios-roundtrip': 'eu-ldt-use-case-scenarios-roundtrip',
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function cityPath(cityId, fallback = ':cityId') {
  const normalized = String(cityId == null ? '' : cityId).trim()
  return normalized ? encodeURIComponent(normalized) : fallback
}

const STATUS_SEMANTICS = {
  orchestrationStatus: {
    label: 'Orchestration',
    question: 'Did the workflow controller finish its own steps?',
    examples: ['created', 'approval_required', 'queued', 'running', 'succeeded', 'failed'],
  },
  executionStatus: {
    label: 'Execution',
    question: 'Did the worker, script, model, or external runner actually run?',
    examples: ['not_applicable', 'registered_only', 'queued', 'running', 'executed', 'partial', 'failed'],
  },
  promotionStatus: {
    label: 'Promotion',
    question: 'Did outputs become part of the OLDT PostGIS/runtime state?',
    examples: ['not_applicable', 'not_promoted', 'promoted', 'partial', 'unknown'],
  },
  publicationStatus: {
    label: 'Publication',
    question: 'Do standards/viewers/API contracts reflect the new state?',
    examples: ['not_applicable', 'refresh_required', 'published', 'partial', 'unknown'],
  },
  authorityStatus: {
    label: 'Authority',
    question: 'Can the result be treated as official, candidate, derived, or simulated?',
    examples: ['open-data-candidate', 'derived-model-output', 'operator-accepted', 'authority-approved', 'simulated'],
  },
}

const WORKFLOW_INTAKE_CHECKLIST = [
  { key: 'requester', label: 'Who requests it?', required: true },
  { key: 'inputs', label: 'What inputs are required and who owns them?', required: true },
  { key: 'decision-boundary', label: 'Does it decide/register, execute, promote, publish, or all of those?', required: true },
  { key: 'sync-model', label: 'Is execution synchronous, queued, dispatched, or callback-based?', required: true },
  { key: 'compute-location', label: 'Where does compute happen: backend, worker, sidecar, VPS, HPC, provider, manual import?', required: true },
  { key: 'writes', label: 'Which schemas/tables can it write?', required: true },
  { key: 'artifacts', label: 'Which artifacts prove the result and require checksums?', required: true },
  { key: 'standards-impact', label: 'Which standards contracts change?', required: true },
  { key: 'viewer-impact', label: 'Which viewer/map/query surfaces change?', required: true },
  { key: 'rollback', label: 'How do we roll back or supersede the result?', required: true },
  { key: 'authority', label: 'What authority/provenance status is attached?', required: true },
]

const CIP_WORKFLOW_MANIFESTS = [
  {
    workflowKey: 'eu-ldt-cip-publish-metric-source',
    storageWorkflowKey: 'eu-ldt-cip-publish-metric-source',
    legacyWorkflowKeys: [],
    operatorName: 'EU LDT City Innovation Planner Publish Metric Source',
    purpose: 'Resolve a governed OLDT metric, publish it as an NGSI-LD KPI source through the configured Data Platform, and bind that source to a City Innovation Planner KPI.',
    decisionBoundary: 'external-kpi-source-publication',
    inputContract: {
      required: ['cipProfileKey', 'dataPlatformProfileKey'],
      optional: ['selectionSetId', 'value', 'metricKey', 'attributeKey', 'aggregation', 'unit', 'observedAt', 'bindingKey', 'cipKpiId', 'createKpi', 'kpiName', 'kpiDescription', 'kpiStatus', 'kpiType', 'frequency', 'calculationFormula', 'datasourceName', 'ngsiEntityId', 'ngsiEntityType', 'ngsiProperty', 'ngsiScope', 'resultJsonPath', 'formulaParameter', 'requestCalculation', 'u4sscStandard', 'kpiU4SSCCode', 'indicatorKey', 'indicatorExternalCode', 'indicatorCatalogKey', 'indicatorValueKind'],
    },
    decisions: [
      'Which saved OLDT selection or explicit governed metric is suitable as a KPI source.',
      'Which Data Platform profile receives the NGSI-LD source entity.',
      'Which City Innovation Planner KPI and datasource are created or updated.',
      'Whether City Innovation Planner should calculate the KPI immediately.',
    ],
    steps: [
      'prepare-run-context',
      'validate-input-contract',
      'resolve-oldt-metric-source',
      'build-cip-ngsi-ld-source',
      'publish-cip-source-to-data-platform',
      'bind-cip-kpi-datasource',
      'request-cip-calculation',
      'store-cip-metric-binding',
      'write-cip-metric-artifacts',
    ],
    jobsCreated: [],
    stagesUsed: ['cip-kpi-source-publication'],
    runners: ['backend-eu-ldt-data-platform-client', 'backend-eu-ldt-city-innovation-planner-client'],
    writes: ['external EU LDT Data Platform /api/v1/entities', 'external City Innovation Planner /api/v1/kpis', 'ldt_interop.cip_metric_bindings', 'ldt_ops.workflow_artifacts'],
    artifacts: ['cip-metric-source', 'cip-ngsi-ld-entity', 'cip-data-platform-publication', 'cip-kpi-binding', 'cip-metric-publication-summary'],
    standardsAffected: ['NGSI-LD KPI source entity in EU LDT Data Platform', 'City Innovation Planner broker datasource contract'],
    terminalStates: [
      { status: 'succeeded', means: 'The OLDT metric was published, read back, bound to a CIP KPI, and recorded with provenance.' },
      { status: 'failed', means: 'The metric could not be resolved, published, verified, or bound to City Innovation Planner.' },
    ],
    statusDefaults: {
      authorityStatus: 'derived-governed-metric',
      promotionStatus: 'bound-to-external-kpi',
      publicationStatus: 'external-publication-requested',
    },
    nextWorkflowSuggestions: [
      { key: 'eu-ldt-cip-sync-measurements', label: 'Synchronize KPI measurements', reason: 'Calculated CIP measurements should be retained as external evidence in OLDT.' },
      { key: 'inspect-eu-ldt-city-innovation-planner', label: 'Inspect City Innovation Planner', reason: 'Operators should verify the KPI, datasource, formula, and current measurement in CIP.' },
    ],
    apiFirstCommands: () => [
      { label: 'Create KPI source run', method: 'POST', path: '/api/admin/workflows/eu-ldt-cip-publish-metric-source/runs' },
      { label: 'Approve run', method: 'POST', path: '/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision' },
      { label: 'Execute KPI source publication', method: 'POST', path: '/api/admin/workflow-runs/:runId/execute' },
      { label: 'Inspect CIP exchange state', method: 'GET', path: '/api/admin/eu-ldt/cip/state' },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
    ],
  },
  {
    workflowKey: 'eu-ldt-cip-sync-measurements',
    storageWorkflowKey: 'eu-ldt-cip-sync-measurements',
    legacyWorkflowKeys: [],
    operatorName: 'EU LDT City Innovation Planner Sync Measurements',
    purpose: 'Read KPI measurements from City Innovation Planner, retain receipt evidence, and materialize standard-linked measurements as semantic OLDT indicator observations.',
    decisionBoundary: 'external-kpi-measurement-import',
    inputContract: {
      required: ['cipProfileKey'],
      optional: ['kpiIds', 'includeUnbound', 'page', 'size', 'sort'],
    },
    decisions: [
      'Which configured City Innovation Planner profile is authoritative for this synchronization.',
      'Whether only bound KPIs or explicitly requested unbound KPIs are eligible.',
      'Which remote measurements are new evidence rather than duplicate receipts.',
    ],
    steps: [
      'prepare-run-context',
      'validate-input-contract',
      'read-cip-measurements',
      'reconcile-cip-measurements',
      'store-cip-measurement-receipts',
      'write-cip-measurement-artifacts',
    ],
    jobsCreated: [],
    stagesUsed: ['cip-kpi-measurement-import'],
    runners: ['backend-eu-ldt-city-innovation-planner-client'],
    writes: ['ldt_interop.cip_measurement_receipts', 'ldt_ops.workflow_artifacts'],
    artifacts: ['cip-measurement-readback', 'cip-measurement-reconciliation', 'cip-measurement-sync-summary'],
    standardsAffected: ['OLDT provenance and external KPI evidence; no automatic standards publication'],
    terminalStates: [
      { status: 'succeeded', means: 'Eligible CIP measurements were reconciled and persisted as idempotent external receipts.' },
      { status: 'failed', means: 'CIP measurements could not be read, reconciled, or stored.' },
    ],
    statusDefaults: {
      authorityStatus: 'external-kpi-measurement',
      promotionStatus: 'stored-as-receipt-evidence',
      publicationStatus: 'not_automatically_published',
    },
    nextWorkflowSuggestions: [
      { key: 'eu-ldt-cip-sync-initiatives', label: 'Synchronize initiatives', reason: 'Initiatives provide the policy context for measured KPIs.' },
    ],
    apiFirstCommands: () => [
      { label: 'Create measurement sync run', method: 'POST', path: '/api/admin/workflows/eu-ldt-cip-sync-measurements/runs' },
      { label: 'Execute measurement sync', method: 'POST', path: '/api/admin/workflow-runs/:runId/execute' },
      { label: 'Inspect CIP exchange state', method: 'GET', path: '/api/admin/eu-ldt/cip/state' },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
    ],
  },
  {
    workflowKey: 'eu-ldt-cip-sync-initiatives',
    storageWorkflowKey: 'eu-ldt-cip-sync-initiatives',
    legacyWorkflowKeys: [],
    operatorName: 'EU LDT City Innovation Planner Sync Initiatives',
    purpose: 'Synchronize City Innovation Planner initiatives into OLDT and preserve explicit links from those initiatives to saved analytical selections.',
    decisionBoundary: 'external-initiative-synchronization',
    inputContract: {
      required: ['cipProfileKey'],
      optional: ['initiativeIds', 'links', 'page', 'size', 'sort'],
    },
    decisions: [
      'Which CIP initiatives should be synchronized into the active OLDT workspace.',
      'Which saved OLDT selections are evidence or analytical scope for each initiative.',
      'Which remote changes update an existing snapshot without losing link provenance.',
    ],
    steps: [
      'prepare-run-context',
      'validate-input-contract',
      'read-cip-initiatives',
      'store-cip-initiative-snapshots',
      'link-cip-initiative-selections',
      'write-cip-initiative-artifacts',
    ],
    jobsCreated: [],
    stagesUsed: ['cip-initiative-synchronization'],
    runners: ['backend-eu-ldt-city-innovation-planner-client'],
    writes: ['ldt_interop.cip_initiative_links', 'ldt_ops.workflow_artifacts'],
    artifacts: ['cip-initiative-readback', 'cip-initiative-link-evidence', 'cip-initiative-sync-summary'],
    standardsAffected: ['OLDT analytical provenance; no automatic city-data mutation'],
    terminalStates: [
      { status: 'succeeded', means: 'CIP initiatives were stored and requested OLDT analytical links were preserved.' },
      { status: 'failed', means: 'CIP initiatives could not be read, stored, or linked.' },
    ],
    statusDefaults: {
      authorityStatus: 'external-planning-initiative',
      promotionStatus: 'linked-to-oldt-analysis',
      publicationStatus: 'not_automatically_published',
    },
    nextWorkflowSuggestions: [
      { key: 'eu-ldt-cip-publish-metric-source', label: 'Publish initiative KPI sources', reason: 'Saved OLDT analyses can supply governed metrics for the linked initiative.' },
    ],
    apiFirstCommands: () => [
      { label: 'Create initiative sync run', method: 'POST', path: '/api/admin/workflows/eu-ldt-cip-sync-initiatives/runs' },
      { label: 'Execute initiative sync', method: 'POST', path: '/api/admin/workflow-runs/:runId/execute' },
      { label: 'Link initiative and selection', method: 'POST', path: '/api/admin/eu-ldt/cip/initiative-links' },
      { label: 'Inspect CIP exchange state', method: 'GET', path: '/api/admin/eu-ldt/cip/state' },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
    ],
  },
]

const WORKFLOW_MANIFESTS = [
  ...CIP_WORKFLOW_MANIFESTS,
  {
    workflowKey: 'eu-ldt-use-case-scenarios-roundtrip',
    storageWorkflowKey: 'eu-ldt-use-case-scenarios-roundtrip',
    legacyWorkflowKeys: [],
    operatorName: 'EU LDT Use Case & Scenarios Roundtrip',
    purpose: 'Turn a governed OLDT selection into comparable baseline and intervention entity datasets, execute both through UCS, Data Platform, Airflow, and AI Notebook, and retain timestamped entity-level simulation worlds.',
    decisionBoundary: 'external-scenario-creation-and-execution',
    inputContract: {
      required: ['ucsProfileKey', 'dataPlatformProfileKey'],
      optional: ['selectionSetId', 'baselineValue', 'interventionValue', 'interventionDeltaPercent', 'metricKey', 'attributeKey', 'aggregation', 'unit', 'bindingKey', 'caseName', 'modelNamespace', 'modelName', 'ngsiScope', 'entityBatchMode', 'maxEntities', 'energyIntensityKwhM2', 'retrofitSavingsFraction', 'gridEmissionFactorKgCo2Kwh', 'scenarioYear', 'executionTimeoutMs', 'pollIntervalMs'],
    },
    decisions: [
      'Which saved OLDT selection or explicit value is the governed baseline.',
      'Whether UCS receives one scalar metric or a bounded entity dataset.',
      'Which intervention parameters are applied to the same canonical entities.',
      'Which UCS and Data Platform profiles receive the scenario resources.',
      'Which AI Notebook model is executed identically for both scenarios.',
    ],
    steps: [
      'prepare-run-context',
      'validate-input-contract',
      'resolve-oldt-baseline',
      'derive-intervention',
      'publish-scenario-inputs',
      'create-ucs-case',
      'create-ucs-scenarios',
      'bind-ucs-data-sources',
      'verify-ucs-data-platform-readback',
      'configure-ucs-ai-models',
      'execute-ucs-baseline',
      'execute-ucs-intervention',
      'persist-oldt-simulation-worlds',
      'store-ucs-roundtrip-binding',
      'write-ucs-roundtrip-artifacts',
    ],
    jobsCreated: ['two UCS experiment executions and their Airflow DAG runs'],
    stagesUsed: ['UCS shared data stage', 'Data Platform NGSI-LD broker'],
    runners: ['backend-eu-ldt-ucs-client', 'UCS Airflow worker', 'AI Notebook inference proxy'],
    writes: ['external Data Platform scenario entities', 'external UCS case/scenario/parameter/transform-DAG/experiment resources', 'ldt_science.simulation_runs', 'ldt_enrichment.entity_model_outputs', 'ldt_interop.ucs_case_bindings', 'ldt_ops.workflow_artifacts'],
    artifacts: ['ucs-metric-resolution', 'ucs-data-platform-publication', 'ucs-case-structure', 'ucs-experiment-executions', 'ucs-simulation-worlds', 'ucs-roundtrip-summary'],
    standardsAffected: ['Two NGSI-LD OldtScenarioDataset or OldtScenarioMetric entities in the selected EU LDT Data Platform'],
    terminalStates: [
      { status: 'succeeded', means: 'Both UCS executions completed, OLDT validated their comparable outputs, and entity mode persisted two timestamped simulation worlds without mutating canonical entities.' },
      { status: 'failed', means: 'At least one publication, UCS resource, Data Platform readback, Airflow execution, AI inference, or provenance write failed.' },
    ],
    statusDefaults: {
      authorityStatus: 'integration-lab-scenario-evidence',
      promotionStatus: 'stored-as-ucs-provenance-and-simulation-worlds',
      publicationStatus: 'external-ucs-roundtrip-completed',
    },
    nextWorkflowSuggestions: [
      { key: 'inspect-eu-ldt-use-case-scenarios', label: 'Inspect UCS case', reason: 'Operators can review the case, scenarios, data sources, parameters, transform DAG, model snapshots, and experiment executions in UCS.' },
      { key: 'compare-ucs-simulation-worlds', label: 'Compare simulation worlds', reason: 'Canvas can compare, overlay, or calculate deltas across the timestamped baseline, intervention, and saved reality snapshot.' },
    ],
    apiFirstCommands: () => [
      { label: 'List UCS profiles', method: 'GET', path: '/api/admin/eu-ldt/integrations?platformKind=use-case-scenarios' },
      { label: 'Create UCS roundtrip run', method: 'POST', path: '/api/admin/workflows/eu-ldt-use-case-scenarios-roundtrip/runs' },
      { label: 'Approve run', method: 'POST', path: '/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision' },
      { label: 'Execute UCS roundtrip', method: 'POST', path: '/api/admin/workflow-runs/:runId/execute' },
      { label: 'Inspect UCS exchange state', method: 'GET', path: '/api/admin/eu-ldt/ucs/state' },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
    ],
  },
  {
    workflowKey: 'open-source-city-builder',
    storageWorkflowKey: 'phase14-open-data-workflow-runner',
    legacyWorkflowKeys: ['phase14-open-data-workflow-runner', 'open-data-city-bootstrap'],
    operatorName: 'Open Source City Builder',
    purpose: 'Resolve the active city source plan, register open-data/provider ingestion jobs, register environmental source plans, and produce auditable build artifacts.',
    decisionBoundary: 'decide-and-register',
    inputContract: {
      required: ['cityId', 'sourcePlan'],
      optional: ['providerPackages', 'extractorKeys', 'refreshViewerAggregates', 'refreshConsolidation', 'refreshTwinQuerySurfaces', 'validationMode'],
    },
    decisions: [
      'Which source plan is active for the city.',
      'Which OSM/Overture/provider packages should become ingestion jobs.',
      'Which environmental extractor source-plan runs should be registered.',
      'Whether viewer/query refresh jobs should be queued.',
    ],
    steps: [
      'prepare-run-context',
      'validate-input-contract',
      'resolve-source-plan',
      'enqueue-open-data-bootstrap',
      'validate-provider-exchange-package',
      'register-environmental-extractor-runs',
      'write-artifact-and-validation-records',
      'publish-workspace-run-summary',
    ],
    jobsCreated: ['osm-local-extract', 'overture-buildings', 'overture-roads', 'mvt-cache-refresh', 'provider-layer-ingestion'],
    stagesUsed: ['provider-assist', 'ingestion-queue', 'environmental-extractors'],
    runners: ['backend-workflow-controller', 'provider-ingestion-worker'],
    writes: ['ldt_ops.workflow_runs', 'ldt_ops.workflow_steps', 'ldt_ops.workflow_artifacts', 'public.layer_ingestion_jobs', 'ldt_environment.extractor_runs', 'ldt_environment.extractor_artifacts'],
    artifacts: ['source-plan', 'provider-exchange-classification', 'extractor-validation-summary', 'post-job-refresh-plan', 'operator-inspection-summary', 'workspace-run-summary'],
    standardsAffected: ['DCAT after promotion', 'OGC after promotion', 'NGSI-LD after promotion', 'OpenAPI/readiness after publication refresh'],
    terminalStates: [
      { status: 'succeeded', means: 'The workflow registered jobs/artifacts. Provider jobs may still need execution and promotion.' },
      { status: 'failed', means: 'The controller failed before completing the registration/audit flow.' },
    ],
    statusDefaults: {
      authorityStatus: 'open-data-candidate',
      publicationStatus: 'refresh_required',
    },
    nextWorkflowSuggestions: [
      { key: 'run-provider-worker', label: 'Run provider ingestion jobs', reason: 'Registered jobs must execute before their data is promoted.' },
      { key: 'data-factory-compute-handoff:viewer-artifacts', label: 'Build viewer artifacts', reason: 'MVT/PMTiles/3D Tiles need the viewer-artifacts stage after PostGIS has enough data.' },
      { key: 'standards-publication-refresh', label: 'Refresh standards', reason: 'DCAT, OGC, NGSI-LD, and readiness should reflect promoted data.' },
    ],
    apiFirstCommands: ({ cityId }) => [
      { label: 'Read source plan', method: 'GET', path: `/api/admin/cities/${cityPath(cityId)}/source-plan` },
      { label: 'Create city build run', method: 'POST', path: '/api/admin/workflows/open-source-city-builder/runs' },
      { label: 'Approve run', method: 'POST', path: '/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision' },
      { label: 'Execute registered build controller', method: 'POST', path: '/api/admin/workflow-runs/:runId/execute' },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
    ],
  },
  {
    workflowKey: 'data-factory-compute-handoff',
    storageWorkflowKey: 'offline-data-factory-handoff',
    legacyWorkflowKeys: ['offline-data-factory-handoff'],
    operatorName: 'Data Factory Compute Handoff',
    purpose: 'Prepare, dispatch, run, or import stage-scoped compute outside the normal UI/backend path, then promote validated outputs back into OLDT.',
    decisionBoundary: 'dispatch-execute-promote-by-stage',
    inputContract: {
      required: ['cityId', 'stageKey', 'executionMode'],
      optional: ['executorProfile', 'providerType', 'nodeKey', 'cityInputPolicy', 'runnerOptions', 'promotionPolicy'],
    },
    decisions: [
      'Which Data Factory stage is being executed.',
      'Which compute provider/profile should run it.',
      'Whether to create, reuse, or skip city input packages.',
      'Whether the result should be imported with a stage applicator or only recorded.',
    ],
    steps: ['package-offline-handoff', 'dispatch-offline-worker', 'run-offline-data-factory', 'import-validated-result', 'register-viewer-artifacts'],
    jobsCreated: ['stage-specific, for example ingestion queue jobs when stageKey=ingestion-queue'],
    stagesUsed: ['ingestion-queue', 'environmental-extractors', 'viewer-artifacts', 'semantic-materialization'],
    runners: ['local-process', 'same-server-sidecar', 'server-to-server-pull', 'server-to-server-push', 'offline-bundle', 'hpc-batch', 'cloud-batch', 'manual-import'],
    writes: ['ldt_ops.workflow_runs', 'ldt_ops.workflow_artifacts', 'ldt_ops.data_factory_dispatches', 'stage-specific PostGIS targets', 'ldt_viewer.viewer_artifacts'],
    artifacts: ['offline-data-factory-handoff', 'offline-data-factory-dispatch', 'data-factory-runtime-artifact-bundle', 'offline-data-factory-result', 'data-factory-artifact-transfer-manifest'],
    standardsAffected: ['OpenAPI/readiness', 'DCAT/OGC/NGSI-LD after promoted result and standards refresh'],
    terminalStates: [
      { status: 'queued', means: 'The handoff package exists and is waiting for a runner or result import.' },
      { status: 'succeeded', means: 'The handoff/result loop completed according to the selected stage contract.' },
    ],
    statusDefaults: {
      authorityStatus: 'derived-or-generated-output',
      publicationStatus: 'refresh_required',
    },
    nextWorkflowSuggestions: [
      { key: 'standards-publication-refresh', label: 'Refresh standards after promotion', reason: 'Published contracts should reflect Data Factory outputs.' },
      { key: 'external-model-enrichment', label: 'Export enriched objects when model-ready', reason: 'Some Data Factory outputs become model inputs.' },
    ],
    apiFirstCommands: ({ cityId }) => [
      { label: 'Create city input package', method: 'POST', path: `/api/admin/cities/${cityPath(cityId)}/data-factory/city-input-packages` },
      { label: 'Create run intent', method: 'POST', path: `/api/admin/cities/${cityPath(cityId)}/data-factory/runs` },
      { label: 'Create offline handoff', method: 'POST', path: `/api/admin/cities/${cityPath(cityId)}/data-factory/offline-handoffs` },
      { label: 'Run local/sidecar handoff', method: 'POST', path: `/api/admin/cities/${cityPath(cityId)}/data-factory/offline-handoffs/:runId/run` },
      { label: 'Import result', method: 'POST', path: `/api/admin/cities/${cityPath(cityId)}/data-factory/offline-handoffs/:runId/result` },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
    ],
  },
  {
    workflowKey: 'standards-publication-refresh',
    storageWorkflowKey: 'standards-publication-refresh',
    legacyWorkflowKeys: [],
    operatorName: 'Standards Publication Refresh',
    purpose: 'Project the current OLDT/PostGIS state into published interoperability contracts and readiness reports.',
    decisionBoundary: 'publish-current-state',
    inputContract: {
      required: ['cityId'],
      optional: ['packKey', 'refreshViewerAggregates', 'refreshScience', 'refreshSociety', 'refreshInterop'],
    },
    decisions: [
      'Which standards surfaces should be refreshed.',
      'Which city data should be considered publishable under current policy.',
      'Which readiness gaps remain after refresh.',
    ],
    steps: ['prepare-run-context', 'validate-input-contract', 'refresh-dcat', 'refresh-ngsi-ld', 'refresh-ogc-api-features', 'refresh-readiness-report'],
    jobsCreated: [],
    stagesUsed: ['operations-evidence'],
    runners: ['standards-publication-worker'],
    writes: ['ldt_interop', 'ldt_viewer', 'ldt_science', 'ldt_society', 'ldt_semantic', 'ldt_ops.workflow_artifacts'],
    artifacts: ['standards-publication-report', 'capability-readiness-report'],
    standardsAffected: ['DCAT', 'OGC API Features', 'NGSI-LD/FIWARE', 'OpenAPI/readiness'],
    terminalStates: [
      { status: 'queued', means: 'The publication refresh has been requested but needs the standards executor.' },
      { status: 'succeeded', means: 'The current city state was projected into standards contracts.' },
    ],
    statusDefaults: {
      authorityStatus: 'publication-policy-controlled',
      publicationStatus: 'published-when-executor-succeeds',
    },
    nextWorkflowSuggestions: [
      { key: 'inspect-standards-endpoints', label: 'Inspect standards endpoints', reason: 'Operators should verify DCAT, OGC, NGSI-LD, and OpenAPI outputs after publication.' },
    ],
    apiFirstCommands: ({ cityId }) => [
      { label: 'Create standards refresh run', method: 'POST', path: '/api/admin/workflows/standards-publication-refresh/runs' },
      { label: 'Read DCAT', method: 'GET', path: `/api/live/${cityPath(cityId)}/standards/dcat` },
      { label: 'Read OGC collections', method: 'GET', path: `/api/live/${cityPath(cityId)}/standards/ogc/collections` },
      { label: 'Read NGSI-LD sample', method: 'GET', path: `/api/live/${cityPath(cityId)}/standards/ngsi-ld/entities?limit=25` },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
    ],
  },
  {
    workflowKey: 'eu-ldt-data-platform-publish',
    storageWorkflowKey: 'eu-ldt-data-platform-publish',
    legacyWorkflowKeys: [],
    operatorName: 'EU LDT Data Platform Publish',
    purpose: 'Publish policy-selected OLDT NGSI-LD city entities to an EU LDT Data Platform endpoint and verify external readback/replication state.',
    decisionBoundary: 'external-publication',
    inputContract: {
      required: ['cityId', 'integrationProfileKey'],
      optional: ['endpoint', 'type', 'limit', 'offset', 'dryRun', 'tenant', 'scope', 'headers', 'publicationPolicy', 'readback', 'replicationCheck'],
    },
    decisions: [
      'Which local NGSI-LD projections are eligible for external publication.',
      'Which EU LDT Data Platform integration profile receives the payloads.',
      'Whether the run is dry-run validation or external publication.',
      'Whether readback and replication state prove enough for operator acceptance.',
    ],
    steps: [
      'prepare-run-context',
      'validate-input-contract',
      'select-publishable-entities',
      'map-ngsi-ld-payloads',
      'push-eu-ldt-data-platform',
      'verify-readback',
      'check-replication-status',
      'write-publication-artifacts',
    ],
    jobsCreated: [],
    stagesUsed: ['standards-publication-scope'],
    runners: ['backend-eu-ldt-data-platform-client'],
    writes: ['ldt_ops.workflow_runs', 'ldt_ops.workflow_steps', 'ldt_ops.workflow_artifacts', 'external EU LDT Data Platform /api/v1/entities'],
    artifacts: ['selected_entities', 'ngsi_payloads', 'validation_report', 'push_results', 'readback_results', 'replication_check', 'external-publication-summary'],
    standardsAffected: ['External EU LDT Data Platform NGSI-LD/context API', 'Local NGSI-LD source depends on Standards Publication Refresh'],
    terminalStates: [
      { status: 'succeeded', means: 'Selected NGSI-LD entities were validated, pushed or dry-run validated, and readback/replication evidence was recorded.' },
      { status: 'failed', means: 'The external publication flow could not select, validate, push, or verify the requested entities.' },
    ],
    statusDefaults: {
      authorityStatus: 'candidate-or-derived-external-publication',
      promotionStatus: 'not_applicable',
      publicationStatus: 'external-publication-requested',
    },
    nextWorkflowSuggestions: [
      { key: 'standards-publication-refresh', label: 'Refresh local standards first', reason: 'The EU publication workflow consumes ldt_interop.ngsi_entity_projections as its source contract.' },
      { key: 'inspect-eu-ldt-data-platform', label: 'Inspect EU Data Platform', reason: 'Operators should verify entities, types, and replication state on the external stack.' },
    ],
    apiFirstCommands: ({ cityId }) => [
      { label: 'Create EU publication run', method: 'POST', path: '/api/admin/workflows/eu-ldt-data-platform-publish/runs' },
      { label: 'Approve run', method: 'POST', path: '/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision' },
      { label: 'Execute EU publication', method: 'POST', path: '/api/admin/workflow-runs/:runId/execute' },
      { label: 'Read local NGSI-LD source sample', method: 'GET', path: `/api/live/${cityPath(cityId)}/standards/ngsi-ld/entities?limit=25` },
      { label: 'Read EU Data Platform OpenAPI', method: 'GET', path: '/api/v1/openapi.json' },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
    ],
  },
  {
    workflowKey: 'eu-ldt-data-platform-import-results',
    storageWorkflowKey: 'eu-ldt-data-platform-import-results',
    legacyWorkflowKeys: [],
    operatorName: 'EU LDT Data Platform Import Results',
    purpose: 'Import model-derived NGSI-LD result entities from EU LDT Data Platform back into OLDT as anchored model outputs, using external ID mapping and quarantine rules.',
    decisionBoundary: 'external-derived-result-import',
    inputContract: {
      required: ['cityId', 'integrationProfileKey'],
      optional: ['endpoint', 'type', 'limit', 'headers', 'modelKey', 'modelVersion', 'outputKey', 'sourceBatchId', 'allowUnmapped'],
    },
    decisions: [
      'Which external result entity type should be read from Data Platform.',
      'Which result entities can be mapped to canonical OLDT entities.',
      'Which mapped attributes become append-only model outputs.',
      'Which unmapped or malformed results must stay quarantined.',
    ],
    steps: [
      'prepare-run-context',
      'validate-input-contract',
      'read-external-results',
      'reconcile-external-ids',
      'import-model-outputs',
      'write-import-artifacts',
    ],
    jobsCreated: [],
    stagesUsed: ['external-model-results-import'],
    runners: ['backend-eu-ldt-data-platform-client'],
    writes: ['ldt_interop.external_entity_links', 'ldt_enrichment.entity_model_outputs', 'ldt_ops.workflow_artifacts'],
    artifacts: ['external-result-readback', 'reconciliation-report', 'imported-model-outputs', 'quarantine-report', 'external-import-summary'],
    standardsAffected: ['Local OLDT query/read models after model output import', 'NGSI-LD/OGC/DCAT after Standards Publication Refresh'],
    terminalStates: [
      { status: 'succeeded', means: 'Mapped external model results were imported as derived OLDT model outputs; unmapped results were reported but not promoted.' },
      { status: 'failed', means: 'The import could not read, reconcile, or write any mapped model outputs.' },
    ],
    statusDefaults: {
      authorityStatus: 'derived-model-output',
      promotionStatus: 'promoted-to-enrichment-output',
      publicationStatus: 'refresh_required',
    },
    nextWorkflowSuggestions: [
      { key: 'standards-publication-refresh', label: 'Refresh standards after import', reason: 'Imported model outputs should be republished through OLDT-controlled contracts.' },
      { key: 'inspect-enriched-city-objects', label: 'Inspect enriched objects', reason: 'Operators should verify that model outputs attached to the expected canonical buildings.' },
    ],
    apiFirstCommands: ({ cityId }) => [
      { label: 'Create import run', method: 'POST', path: '/api/admin/workflows/eu-ldt-data-platform-import-results/runs' },
      { label: 'Approve run', method: 'POST', path: '/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision' },
      { label: 'Execute import', method: 'POST', path: '/api/admin/workflow-runs/:runId/execute' },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
      { label: 'Inspect enriched city objects', method: 'GET', path: `/api/live/${cityPath(cityId)}/objects/enriched?limit=25` },
    ],
  },
  {
    workflowKey: 'eu-ldt-play-visualise-register-layer',
    storageWorkflowKey: 'eu-ldt-play-visualise-register-layer',
    legacyWorkflowKeys: [],
    operatorName: 'EU Play & Visualise Register Layer',
    purpose: 'Register an OLDT OGC API Features collection as a Play & Visualise DataSource/DataLayer and verify that the visualisation stack can consume the OLDT source.',
    decisionBoundary: 'external-visualisation-registration',
    inputContract: {
      required: ['cityId', 'integrationProfileKey', 'collectionKey'],
      optional: ['limit', 'sourceUrl', 'dataSourceName', 'layerName', 'layerType', 'mapName', 'mapDescription', 'configuration', 'oldtCookie', 'oldtAuthMode', 'playVisualiseDatabaseUrl'],
    },
    decisions: [
      'Which EU Play & Visualise profile receives the registered source/layer.',
      'Which OLDT OGC collection becomes visible to the visualisation client.',
      'Which auth headers are required for the visualiser to consume OLDT.',
      'Whether feature-count and bounds evidence prove consumption.',
    ],
    steps: [
      'prepare-run-context',
      'validate-input-contract',
      'resolve-visualise-profile',
      'prepare-oldt-source',
      'register-visualise-datasource',
      'register-visualise-datalayer',
      'verify-visualise-consumption',
      'write-visualise-artifacts',
    ],
    jobsCreated: [],
    stagesUsed: ['external-visualisation-registration'],
    runners: ['backend-eu-ldt-play-visualise-client'],
    writes: ['ldt_ops.workflow_runs', 'ldt_ops.workflow_steps', 'ldt_ops.workflow_artifacts', 'external EU Play & Visualise datasource/datalayer/map registry'],
    artifacts: ['visualise-profile', 'visualise-source', 'visualise-registration', 'visualise-consumption-check', 'visualise-registration-summary'],
    standardsAffected: ['OLDT OGC API Features source contract', 'External EU Play & Visualise data source registry'],
    terminalStates: [
      { status: 'succeeded', means: 'Play & Visualise has a registered Map/DataSource/DataLayer for an OLDT collection and the configured source returned features.' },
      { status: 'failed', means: 'The workflow could not register the layer or prove that the configured OLDT source returns usable features.' },
    ],
    statusDefaults: {
      authorityStatus: 'external-visualisation-consumer',
      promotionStatus: 'not_applicable',
      publicationStatus: 'visualise-layer-registered',
    },
    nextWorkflowSuggestions: [
      { key: 'inspect-play-visualise-layer', label: 'Inspect Play & Visualise layer', reason: 'Operators should open Play & Visualise and confirm the layer appears in the map/layer UI.' },
      { key: 'standards-publication-refresh', label: 'Refresh local standards first', reason: 'The visualisation layer consumes OLDT OGC API Features endpoints.' },
    ],
    apiFirstCommands: ({ cityId }) => [
      { label: 'Create visualise layer run', method: 'POST', path: '/api/admin/workflows/eu-ldt-play-visualise-register-layer/runs' },
      { label: 'Approve run', method: 'POST', path: '/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision' },
      { label: 'Execute registration', method: 'POST', path: '/api/admin/workflow-runs/:runId/execute' },
      { label: 'Read local OGC source sample', method: 'GET', path: `/api/live/${cityPath(cityId)}/standards/ogc/collections/buildings/items?limit=25` },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
    ],
  },
  {
    workflowKey: 'eu-ldt-marketplace-agent-publish',
    storageWorkflowKey: 'eu-ldt-marketplace-agent-publish',
    legacyWorkflowKeys: [],
    operatorName: 'EU Marketplace Agent Publish',
    purpose: 'Package an OLDT query, semantic layer, model output, or viewer asset and publish it through one or more configured EU LDT Marketplace Agents.',
    decisionBoundary: 'external-marketplace-publication',
    inputContract: {
      required: ['cityId'],
      optional: ['integrationProfileKey', 'integrationProfileKeys', 'assetType', 'title', 'description', 'licence', 'categories', 'price', 'publishToHub', 'payload', 'sourceUrl', 'collectionKey', 'limit', 'compatibilityTargets'],
    },
    decisions: [
      'Which Marketplace Agent profile or profiles receive the package.',
      'Which OLDT artifact becomes a Marketplace Package.',
      'Whether the package is only uploaded to Agent storage or published as a Marketplace offering.',
      'Whether declared compatibility with Data Platform, Play & Visualise, and OLDT is backed by validation evidence.',
    ],
    steps: [
      'prepare-run-context',
      'validate-input-contract',
      'build-marketplace-package',
      'validate-marketplace-package',
      'upload-marketplace-agent-assets',
      'publish-marketplace-offerings',
      'verify-marketplace-agent-metadata',
      'write-marketplace-artifacts',
    ],
    jobsCreated: [],
    stagesUsed: ['external-marketplace-publication'],
    runners: ['backend-eu-ldt-marketplace-agent-client'],
    writes: ['ldt_ops.workflow_runs', 'ldt_ops.workflow_steps', 'ldt_ops.workflow_artifacts', 'external EU LDT Marketplace Agent /api/v1/agent/assets'],
    artifacts: ['marketplace-package', 'marketplace-validation', 'marketplace-agent-upload', 'marketplace-agent-publish', 'marketplace-agent-metadata', 'marketplace-publication-summary'],
    standardsAffected: ['GeoJSON/NGSI-LD/OGC/DCAT-style asset metadata', 'External EU LDT Marketplace Agent asset catalogue'],
    terminalStates: [
      { status: 'succeeded', means: 'OLDT created a validated package and uploaded it to every selected Marketplace Agent; if requested, publish calls also succeeded.' },
      { status: 'failed', means: 'The package could not be validated, uploaded, published, or verified against the selected Agent profiles.' },
    ],
    statusDefaults: {
      authorityStatus: 'operator-approved-marketplace-candidate',
      promotionStatus: 'not_applicable',
      publicationStatus: 'marketplace-agent-publication-requested',
    },
    nextWorkflowSuggestions: [
      { key: 'inspect-marketplace-agent-assets', label: 'Inspect Marketplace Agent assets', reason: 'Operators should verify the uploaded package appears in the configured Agent.' },
      { key: 'inspect-marketplace-offering', label: 'Inspect Marketplace offering', reason: 'If publishToHub is enabled, the offering should be reviewed in the Marketplace Hub.' },
      { key: 'eu-ldt-play-visualise-register-layer', label: 'Register visual layer', reason: 'GeoJSON/OGC packages can also be tested in Play & Visualise.' },
    ],
    apiFirstCommands: ({ cityId }) => [
      { label: 'List Marketplace profiles', method: 'GET', path: '/api/admin/eu-ldt/integrations?platformKind=marketplace-agent' },
      { label: 'Create Marketplace publish run', method: 'POST', path: '/api/admin/workflows/eu-ldt-marketplace-agent-publish/runs' },
      { label: 'Approve run', method: 'POST', path: '/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision' },
      { label: 'Execute Marketplace publish', method: 'POST', path: '/api/admin/workflow-runs/:runId/execute' },
      { label: 'Read local OGC source sample', method: 'GET', path: `/api/live/${cityPath(cityId)}/standards/ogc/collections/buildings/items?limit=25` },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
    ],
  },
  {
    workflowKey: 'eu-ldt-data-modeller-prepare-schema',
    storageWorkflowKey: 'eu-ldt-data-modeller-prepare-schema',
    legacyWorkflowKeys: [],
    operatorName: 'EU Data Modeller Prepare Schema',
    purpose: 'Infer a Synth-compatible schema from a bounded OLDT canonical object sample and register it in a selected EU LDT Data Modeller instance.',
    decisionBoundary: 'external-schema-registration',
    inputContract: {
      required: ['cityId', 'integrationProfileKey', 'entityType'],
      optional: ['limit', 'schemaName', 'referenceName', 'version', 'ownership', 'description', 'tags', 'outputField', 'outputMinimum', 'outputMaximum'],
    },
    decisions: [
      'Which configured Data Modeller receives the schema.',
      'Which OLDT entity type and bounded sample define the inferred fields.',
      'Which generated numeric field will be available for the synthetic fixture experiment.',
      'Whether the external schema evidence is acceptable; OLDT never approves it automatically.',
    ],
    steps: [
      'prepare-run-context',
      'validate-input-contract',
      'select-canonical-sample',
      'infer-synth-schema',
      'register-data-modeller-schema',
      'verify-data-modeller-schema',
      'write-data-modeller-schema-artifacts',
    ],
    jobsCreated: [],
    stagesUsed: ['external-data-modelling'],
    runners: ['backend-eu-ldt-data-modeller-client'],
    writes: ['ldt_ops.workflow_runs', 'ldt_ops.workflow_steps', 'ldt_ops.workflow_artifacts', 'external EU LDT Data Modeller /api/v1/schemas'],
    artifacts: ['data-modeller-profile', 'canonical-sample', 'synth-schema', 'data-modeller-schema-registration', 'data-modeller-schema-summary'],
    standardsAffected: ['No public OLDT standard changes; this workflow only registers an external schema.'],
    terminalStates: [
      { status: 'succeeded', means: 'The schema was registered and read back from the selected Data Modeller. It still requires Data Modeller evaluation/approval.' },
      { status: 'failed', means: 'OLDT could not select source rows, infer a valid Synth schema, or verify the external registration.' },
    ],
    statusDefaults: {
      authorityStatus: 'operator-prepared-schema',
      promotionStatus: 'not_applicable',
      publicationStatus: 'external-schema-registered',
    },
    nextWorkflowSuggestions: [
      { key: 'evaluate-data-modeller-schema', label: 'Evaluate schema in Data Modeller', reason: 'A Data Modeller user must review and approve the generated schema.' },
      { key: 'eu-ldt-data-modeller-fixture-import', label: 'Generate and import fixture', reason: 'After approval, use the schema to generate simulated values and attach them through the OLDT enrichment boundary.' },
    ],
    apiFirstCommands: () => [
      { label: 'List Data Modeller profiles', method: 'GET', path: '/api/admin/eu-ldt/integrations?platformKind=data-modeller' },
      { label: 'Create schema run', method: 'POST', path: '/api/admin/workflows/eu-ldt-data-modeller-prepare-schema/runs' },
      { label: 'Approve run', method: 'POST', path: '/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision' },
      { label: 'Execute schema registration', method: 'POST', path: '/api/admin/workflow-runs/:runId/execute' },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
    ],
  },
  {
    workflowKey: 'eu-ldt-data-modeller-fixture-import',
    storageWorkflowKey: 'eu-ldt-data-modeller-fixture-import',
    legacyWorkflowKeys: [],
    operatorName: 'EU Data Modeller Fixture Import',
    purpose: 'Generate synthetic records from an approved Data Modeller schema and import one selected field as append-only simulated outputs attached to canonical OLDT entities.',
    decisionBoundary: 'external-synthetic-generation-and-controlled-import',
    inputContract: {
      required: ['cityId', 'integrationProfileKey', 'schemaId', 'entityType', 'modelKey', 'outputField', 'outputKey'],
      optional: ['recordCount', 'modelVersion', 'minimumEvaluationScore', 'unit'],
    },
    decisions: [
      'Whether the external schema is approved and meets the configured evaluation threshold.',
      'Which generated field becomes an OLDT simulated model output.',
      'Which deterministic canonical entity sample receives the generated values.',
      'Which provenance and warnings prevent synthetic fixtures from being confused with observed data.',
    ],
    steps: [
      'prepare-run-context',
      'validate-input-contract',
      'verify-approved-data-modeller-schema',
      'select-fixture-target-entities',
      'generate-data-modeller-fixture',
      'import-simulated-model-outputs',
      'write-data-modeller-fixture-artifacts',
    ],
    jobsCreated: [],
    stagesUsed: ['external-data-modelling', 'model-output-publication-profile'],
    runners: ['backend-eu-ldt-data-modeller-client'],
    writes: ['ldt_enrichment.entity_model_outputs', 'ldt_ops.workflow_runs', 'ldt_ops.workflow_steps', 'ldt_ops.workflow_artifacts'],
    artifacts: ['data-modeller-schema-gate', 'synthetic-fixture', 'fixture-entity-mapping', 'imported-simulated-outputs', 'data-modeller-fixture-summary'],
    standardsAffected: ['Local query surfaces can read imported outputs; public standards still require Standards Publication Refresh.'],
    terminalStates: [
      { status: 'succeeded', means: 'Generated values were imported as simulated append-only model outputs without changing canonical entities.' },
      { status: 'failed', means: 'The schema gate, synthetic generation, entity mapping, or append-only import failed.' },
    ],
    statusDefaults: {
      authorityStatus: 'simulated',
      promotionStatus: 'promoted-to-enrichment-output',
      publicationStatus: 'refresh_required',
    },
    nextWorkflowSuggestions: [
      { key: 'inspect-enriched-city-objects', label: 'Inspect simulated outputs', reason: 'Verify the selected entity IDs, output values, and simulated authority status in OLDT.' },
      { key: 'standards-publication-refresh', label: 'Refresh standards only when intended', reason: 'Synthetic values remain internal until an operator deliberately republishes the read contracts.' },
    ],
    apiFirstCommands: ({ cityId }) => [
      { label: 'Create fixture import run', method: 'POST', path: '/api/admin/workflows/eu-ldt-data-modeller-fixture-import/runs' },
      { label: 'Approve run', method: 'POST', path: '/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision' },
      { label: 'Execute fixture import', method: 'POST', path: '/api/admin/workflow-runs/:runId/execute' },
      { label: 'Inspect enriched objects', method: 'GET', path: `/api/live/${cityPath(cityId)}/objects/enriched?limit=25` },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
    ],
  },
  {
    workflowKey: 'eu-ldt-data-space-publish',
    storageWorkflowKey: 'eu-ldt-data-space-publish',
    legacyWorkflowKeys: [],
    operatorName: 'EU Data Space Query Publication',
    purpose: 'Export a bounded OLDT TwinQuery and publish it as a governed EDC catalog offer without selecting a consumer or starting a transfer.',
    decisionBoundary: 'provider-publication-only',
    inputContract: {
      required: ['cityId', 'providerIntegrationProfileKey', 'query', 'title'],
      optional: ['description', 'format', 'limit', 'licence', 'timeoutMs'],
    },
    decisions: [
      'Which bounded TwinQuery answer is exported.',
      'Which configured EDC participant acts as provider.',
      'Which licence and open ODRL policy govern the catalog offer.',
      'Whether publication evidence is sufficient for a consumer to discover and negotiate the offer independently.',
    ],
    steps: [
      'prepare-run-context',
      'validate-input-contract',
      'export-twin-query-package',
      'persist-data-space-package',
      'register-edc-policy',
      'register-edc-asset',
      'register-edc-contract-definition',
      'write-data-space-publication-artifacts',
    ],
    jobsCreated: [],
    stagesUsed: ['external-data-space-publication'],
    runners: ['backend-edc-management-client', 'external-edc-provider'],
    writes: ['ldt_interop.data_space_asset_packages', 'ldt_ops.workflow_runs', 'ldt_ops.workflow_steps', 'ldt_ops.workflow_artifacts', 'external EDC provider'],
    artifacts: ['data-space-package', 'edc-policy', 'edc-asset', 'edc-contract-definition', 'data-space-publication-summary'],
    standardsAffected: ['EDC/DSP catalog publication', 'ODRL policy', 'DCAT catalog representation', 'OLDT TwinQuery export contract'],
    terminalStates: [
      { status: 'succeeded', means: 'The provider published a discoverable EDC offer. No consumer agreement or transfer is claimed.' },
      { status: 'failed', means: 'Packaging, provider policy, asset, or contract-definition publication failed.' },
    ],
    statusDefaults: {
      authorityStatus: 'operator-approved-external-publication',
      promotionStatus: 'not_applicable',
      publicationStatus: 'edc-published',
    },
    nextWorkflowSuggestions: [
      { key: 'inspect-data-space-offer', label: 'Discover the offer', reason: 'Use the reported provider DSP URL and participant ID from a Data Space Ready consumer.' },
      { key: 'negotiate-data-space-contract', label: 'Negotiate as consumer', reason: 'Review the offer policy before creating an agreement and choosing a destination.' },
    ],
    apiFirstCommands: () => [
      { label: 'List Data Space Ready profiles', method: 'GET', path: '/api/admin/eu-ldt/integrations?platformKind=data-space-ready' },
      { label: 'Create publication run', method: 'POST', path: '/api/admin/workflows/eu-ldt-data-space-publish/runs' },
      { label: 'Approve run', method: 'POST', path: '/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision' },
      { label: 'Execute publication', method: 'POST', path: '/api/admin/workflow-runs/:runId/execute' },
      { label: 'Inspect packages', method: 'GET', path: '/api/admin/eu-ldt/data-space/packages' },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
    ],
  },
  {
    workflowKey: 'eu-ldt-data-space-query-exchange',
    storageWorkflowKey: 'eu-ldt-data-space-query-exchange',
    legacyWorkflowKeys: [],
    operatorName: 'EU Data Space Query Exchange',
    purpose: 'Export a bounded OLDT TwinQuery, publish it as a governed EDC asset, negotiate it from a selected consumer, transfer it, and verify the received bytes in OLDT.',
    decisionBoundary: 'external-contract-negotiation-and-verified-transfer',
    inputContract: {
      required: ['cityId', 'providerIntegrationProfileKey', 'consumerIntegrationProfileKey', 'query', 'title'],
      optional: ['description', 'format', 'limit', 'licence', 'timeoutMs'],
    },
    decisions: [
      'Which bounded TwinQuery answer is exported.',
      'Which configured EDC participant acts as provider and which acts as consumer.',
      'Which licence and open ODRL policy govern the lab exchange.',
      'Whether the agreement, transfer state, SHA-256, and byte count prove an actual round trip.',
    ],
    steps: [
      'prepare-run-context',
      'validate-input-contract',
      'export-twin-query-package',
      'persist-data-space-package',
      'register-edc-policy',
      'register-edc-asset',
      'register-edc-contract-definition',
      'discover-edc-offer',
      'negotiate-edc-contract',
      'transfer-edc-package',
      'verify-transfer-receipt',
      'write-data-space-artifacts',
    ],
    jobsCreated: [],
    stagesUsed: ['external-data-space-exchange'],
    runners: ['backend-edc-management-client', 'external-edc-provider', 'external-edc-consumer', 'oldt-transfer-receipt'],
    writes: ['ldt_interop.data_space_asset_packages', 'ldt_interop.data_space_transfer_receipts', 'ldt_ops.workflow_runs', 'ldt_ops.workflow_steps', 'ldt_ops.workflow_artifacts', 'external EDC provider and consumer'],
    artifacts: ['data-space-package', 'edc-policy', 'edc-asset', 'edc-contract-definition', 'edc-catalog-offer', 'edc-contract-agreement', 'edc-transfer', 'data-space-transfer-receipt', 'data-space-exchange-summary'],
    standardsAffected: ['EDC/DSP catalog and contract exchange', 'ODRL policy', 'DCAT catalog representation', 'OLDT TwinQuery export contract'],
    terminalStates: [
      { status: 'succeeded', means: 'The consumer negotiated and transferred the provider asset, and OLDT verified matching bytes and SHA-256.' },
      { status: 'failed', means: 'Packaging, EDC publication, catalog discovery, negotiation, transfer, or receipt integrity failed.' },
    ],
    statusDefaults: {
      authorityStatus: 'operator-approved-external-exchange',
      promotionStatus: 'not_applicable',
      publicationStatus: 'edc-contracted-and-transferred',
    },
    nextWorkflowSuggestions: [
      { key: 'inspect-data-space-package', label: 'Inspect exchange evidence', reason: 'Verify asset, agreement, transfer, receipt, and checksum IDs in the workflow trace.' },
      { key: 'reuse-data-space-profile', label: 'Exchange with another participant', reason: 'Provider and consumer profiles are selected per run and are not fixed to the local lab.' },
    ],
    apiFirstCommands: () => [
      { label: 'List Data Space Ready profiles', method: 'GET', path: '/api/admin/eu-ldt/integrations?platformKind=data-space-ready' },
      { label: 'Create query exchange run', method: 'POST', path: '/api/admin/workflows/eu-ldt-data-space-query-exchange/runs' },
      { label: 'Approve run', method: 'POST', path: '/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision' },
      { label: 'Execute exchange', method: 'POST', path: '/api/admin/workflow-runs/:runId/execute' },
      { label: 'Inspect packages', method: 'GET', path: '/api/admin/eu-ldt/data-space/packages' },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
    ],
  },
  {
    active: false,
    workflowKey: 'renovation-strategy-readiness-demo',
    storageWorkflowKey: 'renovation-strategy-readiness-demo',
    legacyWorkflowKeys: [],
    operatorName: 'Renovation Strategy Readiness Demo',
    purpose: 'Assess whether OLDT building data can feed the EU LDT Renova optimization model, optionally produce a demo package, and record why the run is real, partial, synthetic, or blocked.',
    decisionBoundary: 'readiness-demo-not-production',
    inputContract: {
      required: ['cityId'],
      optional: ['limit', 'countryCode', 'costCatalogPolicy', 'archetypePolicy', 'demoMode', 'modelEndpoint'],
    },
    decisions: [
      'Whether OLDT has geometry for candidate buildings.',
      'Whether building areas can be derived from geometry.',
      'Whether the city has usable building type, height/levels, Tabula/archetype, and cost catalog inputs.',
      'Whether a Renova call would be real-input, partial, synthetic-smoke, or blocked.',
    ],
    steps: [
      'prepare-run-context',
      'validate-input-contract',
      'assess-building-readiness',
      'resolve-archetype-and-cost-gaps',
      'prepare-demo-package-plan',
      'write-readiness-artifacts',
    ],
    jobsCreated: [],
    stagesUsed: ['external-model-readiness', 'operations-evidence'],
    runners: ['backend-readiness-assessor'],
    writes: ['ldt_ops.workflow_runs', 'ldt_ops.workflow_steps', 'ldt_ops.workflow_artifacts'],
    artifacts: ['renovation-readiness-report', 'renovation-input-gap-report', 'renovation-demo-package-plan', 'renovation-strategy-readiness-summary'],
    standardsAffected: ['No public standards affected until a later standards-publication-refresh claims derived outputs.'],
    terminalStates: [
      { status: 'succeeded', means: 'Readiness was assessed and artifacts were written. This does not mean the model is production-ready.' },
      { status: 'failed', means: 'Readiness assessment could not inspect OLDT building data.' },
    ],
    statusDefaults: {
      authorityStatus: 'readiness-demo',
      promotionStatus: 'not_promoted',
      publicationStatus: 'not_applicable',
    },
    nextWorkflowSuggestions: [
      { key: 'external-model-enrichment', label: 'Run model only after real inputs exist', reason: 'Renova should not be promoted beyond smoke until archetypes and cost catalog are defensible.' },
      { key: 'standards-publication-refresh', label: 'Refresh standards after accepted derived outputs', reason: 'Recommendations should only become public via standards refresh after operator acceptance.' },
    ],
    apiFirstCommands: ({ cityId }) => [
      { label: 'Create readiness run', method: 'POST', path: '/api/admin/workflows/renovation-strategy-readiness-demo/runs' },
      { label: 'Approve run', method: 'POST', path: '/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision' },
      { label: 'Execute readiness run', method: 'POST', path: '/api/admin/workflow-runs/:runId/execute' },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
      { label: 'Inspect buildings', method: 'GET', path: `/api/live/${cityPath(cityId)}/standards/ogc/collections/buildings/items?limit=25` },
    ],
  },
  {
    active: false,
    workflowKey: 'vulnerability-clustering-readiness-demo',
    storageWorkflowKey: 'vulnerability-clustering-readiness-demo',
    legacyWorkflowKeys: [],
    operatorName: 'Vulnerability Clustering Readiness Demo',
    purpose: 'Assess whether OLDT has territorial geometries, ISV, and iXX vulnerability indicators needed by the EU LDT NEVULA/Vulens clustering model without claiming real vulnerability outputs.',
    decisionBoundary: 'readiness-demo-not-production',
    inputContract: {
      required: ['cityId'],
      optional: ['limit', 'zoneEntityTypes', 'indicatorPolicy', 'demoMode', 'modelEndpoint'],
    },
    decisions: [
      'Whether OLDT has territorial/statistical zone geometries suitable for NEVULA.',
      'Whether entries have ISV values already calculated.',
      'Whether entries include the required iXX vulnerability indicator schema.',
      'Whether a NEVULA call would be real-ISV, partial, synthetic-smoke, or blocked.',
    ],
    steps: [
      'prepare-run-context',
      'validate-input-contract',
      'assess-zone-readiness',
      'resolve-isv-and-indicator-gaps',
      'prepare-demo-package-plan',
      'write-readiness-artifacts',
    ],
    jobsCreated: [],
    stagesUsed: ['external-model-readiness', 'operations-evidence'],
    runners: ['backend-readiness-assessor'],
    writes: ['ldt_ops.workflow_runs', 'ldt_ops.workflow_steps', 'ldt_ops.workflow_artifacts'],
    artifacts: ['vulnerability-readiness-report', 'vulnerability-input-gap-report', 'vulnerability-demo-package-plan', 'vulnerability-clustering-readiness-summary'],
    standardsAffected: ['No public standards affected until a later standards-publication-refresh claims accepted derived outputs.'],
    terminalStates: [
      { status: 'succeeded', means: 'Readiness was assessed and artifacts were written. This does not mean vulnerability clustering is production-ready.' },
      { status: 'failed', means: 'Readiness assessment could not inspect OLDT territorial data.' },
    ],
    statusDefaults: {
      authorityStatus: 'readiness-demo',
      promotionStatus: 'not_promoted',
      publicationStatus: 'not_applicable',
    },
    nextWorkflowSuggestions: [
      { key: 'external-model-enrichment', label: 'Run NEVULA only after real ISV exists', reason: 'NEVULA should not be promoted beyond smoke until ISV and iXX indicators are defensible.' },
      { key: 'standards-publication-refresh', label: 'Refresh standards after accepted derived outputs', reason: 'Vulnerability clusters should only become public via standards refresh after operator acceptance.' },
    ],
    apiFirstCommands: ({ cityId }) => [
      { label: 'Create readiness run', method: 'POST', path: '/api/admin/workflows/vulnerability-clustering-readiness-demo/runs' },
      { label: 'Approve run', method: 'POST', path: '/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision' },
      { label: 'Execute readiness run', method: 'POST', path: '/api/admin/workflow-runs/:runId/execute' },
      { label: 'Inspect run trace', method: 'GET', path: '/api/admin/workflow-runs/:runId/trace' },
      { label: 'Inspect city objects', method: 'GET', path: `/api/live/${cityPath(cityId)}/standards/ogc/collections/city-objects/items?limit=25` },
    ],
  },
  {
    workflowKey: 'external-model-enrichment',
    storageWorkflowKey: 'external-model-enrichment-exchange',
    legacyWorkflowKeys: ['external-model-enrichment-exchange'],
    operatorName: 'External Model Enrichment',
    purpose: 'Export city object IDs and model inputs, receive external model outputs, attach derived values to city objects, and expose them through query and standards contracts.',
    decisionBoundary: 'export-import-derived-results',
    inputContract: {
      required: ['cityId', 'modelKey', 'entitySelection'],
      optional: ['modelVersion', 'outputPolicy', 'publicationPolicy'],
    },
    decisions: [
      'Which city objects are exported to the external model.',
      'Which returned fields are accepted as derived model outputs.',
      'Which outputs are visible by standards/query policy.',
    ],
    steps: ['export-canonical-objects', 'external-model-execution', 'import-enrichment-results', 'publish-enrichment-read-model'],
    jobsCreated: [],
    stagesUsed: ['model-output-publication-profile'],
    runners: ['backend-export-tool', 'external-model-provider', 'backend-import-tool'],
    writes: ['ldt_enrichment.entity_model_outputs', 'ldt_ops.workflow_artifacts'],
    artifacts: ['enrichment-input-manifest', 'enrichment-input-objects', 'enrichment-result-objects'],
    standardsAffected: ['NGSI-LD model enrichment properties', 'OGC feature properties', 'DCAT model output dataset', 'CSV/GeoJSON downloads'],
    terminalStates: [
      { status: 'succeeded', means: 'Model outputs were imported and attached as derived values.' },
    ],
    statusDefaults: {
      authorityStatus: 'derived-model-output',
      publicationStatus: 'refresh_required',
    },
    nextWorkflowSuggestions: [
      { key: 'standards-publication-refresh', label: 'Refresh standards after model import', reason: 'Model outputs must appear in DCAT, OGC, and NGSI-LD only through policy-controlled publication.' },
    ],
    apiFirstCommands: ({ cityId }) => [
      { label: 'Export enrichment package', method: 'CLI', path: `node server/tools/export-enrichment-package.mjs --city=${cityPath(cityId, '<city>')}` },
      { label: 'Import enrichment results', method: 'CLI', path: `node server/tools/import-enrichment-results.mjs --city=${cityPath(cityId, '<city>')} --input=<file>` },
      { label: 'Read OGC buildings with model outputs', method: 'GET', path: `/api/live/${cityPath(cityId)}/standards/ogc/collections/buildings/items?limit=25` },
    ],
  },
]

const MANIFEST_BY_KEY = new Map()
for (const manifest of WORKFLOW_MANIFESTS) {
  MANIFEST_BY_KEY.set(manifest.workflowKey, manifest)
  MANIFEST_BY_KEY.set(manifest.storageWorkflowKey, manifest)
  for (const legacyKey of manifest.legacyWorkflowKeys ?? []) MANIFEST_BY_KEY.set(legacyKey, manifest)
}

function isActiveWorkflowManifest(manifest) {
  return manifest && manifest.active !== false
}

function publicManifest(manifest, { cityId = '' } = {}) {
  if (!manifest) return null
  const cloned = clone(manifest)
  const commandBuilder = manifest.apiFirstCommands
  cloned.schemaVersion = WORKFLOW_CONTRACT_SCHEMA_VERSION
  cloned.apiFirstCommands = typeof commandBuilder === 'function' ? commandBuilder({ cityId }) : []
  return cloned
}

export function canonicalWorkflowKey(workflowKey) {
  const normalized = String(workflowKey == null ? '' : workflowKey).trim()
  return WORKFLOW_KEY_ALIASES[normalized] || normalized
}

export function workflowManifestStorageKey(workflowKey) {
  const manifest = MANIFEST_BY_KEY.get(String(workflowKey == null ? '' : workflowKey).trim())
  return manifest ? manifest.storageWorkflowKey : ''
}

export function workflowCreateStorageKey(workflowKey) {
  const normalized = String(workflowKey == null ? '' : workflowKey).trim()
  const manifest = MANIFEST_BY_KEY.get(normalized)
  if (!manifest || !isActiveWorkflowManifest(manifest) || manifest.workflowKey !== normalized) return ''
  return manifest.storageWorkflowKey
}

export function activeWorkflowStorageKeys() {
  return WORKFLOW_MANIFESTS.filter(isActiveWorkflowManifest).map((manifest) => manifest.storageWorkflowKey)
}

export function workflowStatusSemantics() {
  return clone(STATUS_SEMANTICS)
}

export function workflowIntakeChecklist() {
  return clone(WORKFLOW_INTAKE_CHECKLIST)
}

export function workflowManifestFor(workflowKey, options = {}) {
  const manifest = MANIFEST_BY_KEY.get(String(workflowKey == null ? '' : workflowKey).trim())
  if (!isActiveWorkflowManifest(manifest) && !options.includeInactive) return null
  return publicManifest(manifest, options)
}

export function listWorkflowManifests(options = {}) {
  return WORKFLOW_MANIFESTS
    .filter((manifest) => options.includeInactive || isActiveWorkflowManifest(manifest))
    .map((manifest) => publicManifest(manifest, options))
}

export async function getWorkflowSourceContracts({ cityId = '' } = {}) {
  const normalizedCityId = String(cityId == null ? '' : cityId).trim()
  const [providerCapabilities, stageRegistry, sourcePlan] = await Promise.all([
    inspectProviderIngestionCapabilities().catch((error) => ({ ok: false, error: String(error && error.message ? error.message : 'PROVIDER_CAPABILITIES_UNAVAILABLE') })),
    Promise.resolve(listDataFactoryStageDefinitions()),
    normalizedCityId ? getCitySourcePlan(normalizedCityId).catch((error) => ({ ok: false, cityId: normalizedCityId, error: String(error && error.message ? error.message : 'SOURCE_PLAN_UNAVAILABLE') })) : Promise.resolve(null),
  ])
  return {
    ok: true,
    schemaVersion: '2026-07-06.workflow-source-contracts.v1',
    cityId: normalizedCityId || null,
    sourcePlan,
    providerCapabilities,
    dataFactoryStages: stageRegistry,
    standardsPublicationScope: {
      refreshesFromPostgis: true,
      endpoints: [
        `/api/live/${cityPath(normalizedCityId)}/standards/dcat`,
        `/api/live/${cityPath(normalizedCityId)}/standards/ogc/collections`,
        `/api/live/${cityPath(normalizedCityId)}/standards/ngsi-ld/entities?limit=25`,
        '/api/live/current/openapi.json',
      ],
    },
  }
}

export async function getWorkflowContracts({ cityId = '' } = {}) {
  const normalizedCityId = String(cityId == null ? '' : cityId).trim()
  const sourceContracts = normalizedCityId ? await getWorkflowSourceContracts({ cityId: normalizedCityId }) : null
  return {
    ok: true,
    schemaVersion: WORKFLOW_CONTRACT_SCHEMA_VERSION,
    cityId: normalizedCityId || null,
    statusSemantics: workflowStatusSemantics(),
    intakeChecklist: workflowIntakeChecklist(),
    manifests: listWorkflowManifests({ cityId: normalizedCityId }),
    chainPolicy: {
      defaultCityBuild: ['open-source-city-builder', 'provider-ingestion-worker', 'data-factory-compute-handoff:viewer-artifacts', 'standards-publication-refresh'],
      dataFactoryPromotion: ['data-factory-compute-handoff', 'standards-publication-refresh'],
      externalModel: ['external-model-enrichment', 'standards-publication-refresh'],
      dataModeller: ['eu-ldt-data-modeller-prepare-schema', 'eu-ldt-data-modeller-fixture-import', 'standards-publication-refresh'],
      dataSpaceExchange: ['eu-ldt-data-space-query-exchange'],
      useCaseScenarios: ['eu-ldt-use-case-scenarios-roundtrip'],
      plannedAdapters: [
        {
          key: 'eu-ldt-data-platform-publish',
          status: 'draft-needs-certification',
          reason: 'Keep the EU publication adapter out of active operations until its endpoint contract, approvals, and readback test are certified.',
        },
      ],
    },
    sourceContracts,
  }
}
