import { createHash } from 'node:crypto'
import pg from 'pg'

import { inspectProviderIngestionCapabilities } from '../providerLayerIngestionService.mjs'
import { evaluateCityBoundaryQualityGate } from './citySourcePlanService.mjs'
import { withClient } from './dbUtils.mjs'
import {
  executeEuLdtDataModellerFixtureImportOnce,
  executeEuLdtDataModellerPrepareSchemaOnce,
} from './euLdtDataModellerWorkflowService.mjs'
import {
  executeEuLdtCipPublishMetricSourceOnce,
  executeEuLdtCipSyncInitiativesOnce,
  executeEuLdtCipSyncMeasurementsOnce,
} from './euLdtCityInnovationPlannerWorkflowService.mjs'
import { executeEuLdtUseCaseScenariosRoundtripOnce } from './euLdtUseCaseScenariosWorkflowService.mjs'
export {
  executeEuLdtCipPublishMetricSourceOnce,
  executeEuLdtCipSyncInitiativesOnce,
  executeEuLdtCipSyncMeasurementsOnce,
} from './euLdtCityInnovationPlannerWorkflowService.mjs'
export { executeEuLdtUseCaseScenariosRoundtripOnce } from './euLdtUseCaseScenariosWorkflowService.mjs'
import {
  executeEuLdtDataSpaceQueryExchangeOnce,
  executeEuLdtDataSpaceQueryPublishOnce,
} from './euLdtDataSpaceReadyWorkflowService.mjs'
import { resolveEuLdtIntegrationTarget } from './euLdtIntegrationService.mjs'
import { activeWorkflowStorageKeys, canonicalWorkflowKey, workflowCreateStorageKey, workflowManifestStorageKey } from './workflowContractsService.mjs'

const { Pool } = pg

function normalizeWorkflowRun(row) {
  if (!row) return null
  return {
    id: row.id,
    workflowId: row.workflow_id,
    workflowKey: row.workflow_key,
    canonicalWorkflowKey: canonicalWorkflowKey(row.workflow_key),
    workflowName: row.workflow_name ?? row.name ?? null,
    cityId: row.city_id,
    requestedBy: row.requested_by,
    requestedByKind: row.requested_by_kind,
    triggerKind: row.trigger_kind,
    status: row.status,
    input: row.input ?? {},
    output: row.output ?? {},
    error: row.error ?? {},
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeWorkflowApproval(row) {
  return {
    id: row.id,
    runId: row.run_id,
    approvalKey: row.approval_key,
    status: row.status,
    requestedBy: row.requested_by,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionReason: row.decision_reason,
    policy: row.policy ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeWorkflowStep(row) {
  return {
    id: row.id,
    runId: row.run_id,
    stepKey: row.step_key,
    stepOrder: row.step_order,
    title: row.title,
    status: row.status,
    toolKind: row.tool_kind,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    input: row.input ?? {},
    output: row.output ?? {},
    error: row.error ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeWorkflowArtifact(row) {
  return {
    id: row.id,
    runId: row.run_id,
    stepId: row.step_id,
    cityId: row.city_id,
    artifactKind: row.artifact_kind,
    artifactUri: row.artifact_uri,
    mediaType: row.media_type,
    byteSize: row.byte_size ? Number(row.byte_size) : null,
    checksum: row.checksum,
    datasetId: row.dataset_id,
    sourceFeatureId: row.source_feature_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

function normalizeExtractorRun(row) {
  return {
    id: row.id,
    extractorId: row.extractor_id,
    extractorKey: row.extractor_key,
    cityId: row.city_id,
    workflowRunId: row.workflow_run_id,
    runKey: row.run_key,
    scenarioKey: row.scenario_key,
    status: row.status,
    sourceStatus: row.source_status,
    requestedBy: row.requested_by,
    requestedByKind: row.requested_by_kind,
    triggerKind: row.trigger_kind,
    inputSummary: row.input_summary ?? {},
    outputSummary: row.output_summary ?? {},
    validationReport: row.validation_report ?? {},
    error: row.error ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function isCityBootstrapSourcePlan(input = {}) {
  return input?.sourcePlan?.kind === 'city-open-data-bootstrap' || String(input?.validationMode ?? '').startsWith('city-open-data-bootstrap')
}

function canBypassBoundaryGate(input = {}) {
  return input?.boundaryGateBypass === true || input?.smoke === true || String(input?.validationMode ?? '').includes('smoke')
}

async function assertPhase14BoundaryGate(cityId, input = {}) {
  if (!isCityBootstrapSourcePlan(input) || canBypassBoundaryGate(input)) {
    return {
      ok: true,
      skipped: true,
      code: canBypassBoundaryGate(input) ? 'CITY_BOUNDARY_GATE_BYPASSED' : 'NOT_CITY_BOOTSTRAP',
    }
  }
  const gate = await evaluateCityBoundaryQualityGate(cityId)
  if (gate.passed !== true) {
    const error = new Error(`CITY_BOUNDARY_QUALITY_GATE_FAILED:${gate.code}`)
    error.boundaryGate = gate
    throw error
  }
  return gate
}

export function workflowStepTemplates(workflowKey) {
  const shared = [
    { stepKey: 'prepare-run-context', title: 'Prepare run context', toolKind: 'system' },
    { stepKey: 'validate-input-contract', title: 'Validate input contract', toolKind: 'system' },
  ]
  const templates = {
    'open-data-city-bootstrap': [
      ...shared,
      { stepKey: 'collect-open-sources', title: 'Collect open source datasets', toolKind: 'workflow-worker' },
      { stepKey: 'build-provenance-catalog', title: 'Build catalog and provenance records', toolKind: 'workflow-worker' },
      { stepKey: 'refresh-consolidated-inventory', title: 'Refresh consolidated inventory', toolKind: 'workflow-worker' },
      { stepKey: 'produce-quality-report', title: 'Produce source quality report', toolKind: 'workflow-worker' },
    ],
    'phase14-open-data-workflow-runner': [
      ...shared,
      { stepKey: 'resolve-source-plan', title: 'Resolve city source plan', toolKind: 'workflow-worker' },
      { stepKey: 'enqueue-open-data-bootstrap', title: 'Enqueue OSM and open-data bootstrap jobs', toolKind: 'provider-ingestion-worker' },
      { stepKey: 'validate-provider-exchange-package', title: 'Validate provider exchange package posture', toolKind: 'workflow-worker' },
      { stepKey: 'register-environmental-extractor-runs', title: 'Register environmental extractor runs', toolKind: 'workflow-worker' },
      { stepKey: 'write-artifact-and-validation-records', title: 'Write artifacts and validation records', toolKind: 'workflow-worker' },
      { stepKey: 'publish-workspace-run-summary', title: 'Publish Workspace run summary', toolKind: 'workflow-worker' },
    ],
    'private-provider-validation': [
      ...shared,
      { stepKey: 'inspect-provider-package', title: 'Inspect provider package', toolKind: 'workflow-worker' },
      { stepKey: 'validate-license-and-access', title: 'Validate license and access policy', toolKind: 'human-review' },
      { stepKey: 'stage-provider-evidence', title: 'Stage provider evidence', toolKind: 'workflow-worker' },
      { stepKey: 'request-publication-approval', title: 'Request publication approval', toolKind: 'human-review' },
    ],
    'standards-publication-refresh': [
      ...shared,
      { stepKey: 'refresh-dcat', title: 'Refresh DCAT catalog export', toolKind: 'workflow-worker' },
      { stepKey: 'refresh-ngsi-ld', title: 'Refresh NGSI-LD projections', toolKind: 'workflow-worker' },
      { stepKey: 'refresh-ogc-api-features', title: 'Refresh OGC API Features outputs', toolKind: 'workflow-worker' },
      { stepKey: 'refresh-readiness-report', title: 'Refresh capability readiness report', toolKind: 'workflow-worker' },
    ],
    'eu-ldt-data-platform-publish': [
      ...shared,
      { stepKey: 'select-publishable-entities', title: 'Select publishable NGSI-LD entities', toolKind: 'workflow-worker' },
      { stepKey: 'map-ngsi-ld-payloads', title: 'Validate EU Data Platform payloads', toolKind: 'workflow-worker' },
      { stepKey: 'push-eu-ldt-data-platform', title: 'Push entities to EU LDT Data Platform', toolKind: 'external-api' },
      { stepKey: 'verify-readback', title: 'Verify external readback', toolKind: 'external-api' },
      { stepKey: 'check-replication-status', title: 'Check external replication status', toolKind: 'external-api' },
      { stepKey: 'write-publication-artifacts', title: 'Write publication artifacts', toolKind: 'workflow-worker' },
    ],
    'eu-ldt-data-platform-import-results': [
      ...shared,
      { stepKey: 'read-external-results', title: 'Read external result entities', toolKind: 'external-api' },
      { stepKey: 'reconcile-external-ids', title: 'Reconcile external IDs with OLDT entities', toolKind: 'workflow-worker' },
      { stepKey: 'import-model-outputs', title: 'Import mapped model outputs', toolKind: 'workflow-worker' },
      { stepKey: 'write-import-artifacts', title: 'Write import artifacts', toolKind: 'workflow-worker' },
    ],
    'eu-ldt-data-modeller-prepare-schema': [
      ...shared,
      { stepKey: 'select-canonical-sample', title: 'Select canonical OLDT sample', toolKind: 'workflow-worker' },
      { stepKey: 'infer-synth-schema', title: 'Infer Synth-compatible schema', toolKind: 'workflow-worker' },
      { stepKey: 'register-data-modeller-schema', title: 'Register schema in EU Data Modeller', toolKind: 'external-api' },
      { stepKey: 'verify-data-modeller-schema', title: 'Verify Data Modeller schema readback', toolKind: 'external-api' },
      { stepKey: 'write-data-modeller-schema-artifacts', title: 'Write Data Modeller schema artifacts', toolKind: 'workflow-worker' },
    ],
    'eu-ldt-data-modeller-fixture-import': [
      ...shared,
      { stepKey: 'verify-approved-data-modeller-schema', title: 'Verify approved Data Modeller schema', toolKind: 'external-api' },
      { stepKey: 'select-fixture-target-entities', title: 'Select deterministic fixture target entities', toolKind: 'workflow-worker' },
      { stepKey: 'generate-data-modeller-fixture', title: 'Generate synthetic fixture', toolKind: 'external-api' },
      { stepKey: 'import-simulated-model-outputs', title: 'Import simulated model outputs', toolKind: 'workflow-worker' },
      { stepKey: 'write-data-modeller-fixture-artifacts', title: 'Write Data Modeller fixture artifacts', toolKind: 'workflow-worker' },
    ],
    'eu-ldt-cip-publish-metric-source': [
      ...shared,
      { stepKey: 'resolve-oldt-metric-source', title: 'Resolve OLDT metric source', toolKind: 'workflow-worker' },
      { stepKey: 'build-cip-ngsi-ld-source', title: 'Build CIP NGSI-LD metric source', toolKind: 'workflow-worker' },
      { stepKey: 'publish-cip-source-to-data-platform', title: 'Publish metric source to EU LDT Data Platform', toolKind: 'external-api' },
      { stepKey: 'bind-cip-kpi-datasource', title: 'Bind City Innovation Planner KPI datasource', toolKind: 'external-api' },
      { stepKey: 'request-cip-calculation', title: 'Request optional CIP KPI calculation', toolKind: 'external-api' },
      { stepKey: 'store-cip-metric-binding', title: 'Store OLDT metric binding', toolKind: 'workflow-worker' },
      { stepKey: 'write-cip-metric-artifacts', title: 'Write CIP metric publication evidence', toolKind: 'workflow-worker' },
    ],
    'eu-ldt-cip-sync-measurements': [
      ...shared,
      { stepKey: 'read-cip-measurements', title: 'Read City Innovation Planner measurements', toolKind: 'external-api' },
      { stepKey: 'reconcile-cip-measurements', title: 'Reconcile measurements with OLDT bindings', toolKind: 'workflow-worker' },
      { stepKey: 'store-cip-measurement-receipts', title: 'Store KPI measurement receipts', toolKind: 'workflow-worker' },
      { stepKey: 'write-cip-measurement-artifacts', title: 'Write CIP measurement sync evidence', toolKind: 'workflow-worker' },
    ],
    'eu-ldt-cip-sync-initiatives': [
      ...shared,
      { stepKey: 'read-cip-initiatives', title: 'Read City Innovation Planner initiatives', toolKind: 'external-api' },
      { stepKey: 'store-cip-initiative-snapshots', title: 'Store initiative snapshots in OLDT', toolKind: 'workflow-worker' },
      { stepKey: 'link-cip-initiative-selections', title: 'Link initiatives to OLDT selections', toolKind: 'workflow-worker' },
      { stepKey: 'write-cip-initiative-artifacts', title: 'Write CIP initiative sync evidence', toolKind: 'workflow-worker' },
    ],
    'eu-ldt-use-case-scenarios-roundtrip': [
      ...shared,
      { stepKey: 'resolve-oldt-baseline', title: 'Resolve governed OLDT baseline', toolKind: 'workflow-worker' },
      { stepKey: 'derive-intervention', title: 'Derive intervention metric', toolKind: 'workflow-worker' },
      { stepKey: 'publish-scenario-inputs', title: 'Publish baseline and intervention to Data Platform', toolKind: 'external-api' },
      { stepKey: 'create-ucs-case', title: 'Create UCS case structure', toolKind: 'external-api' },
      { stepKey: 'create-ucs-scenarios', title: 'Create and associate UCS scenarios', toolKind: 'external-api' },
      { stepKey: 'bind-ucs-data-sources', title: 'Bind Data Platform sources to UCS scenarios', toolKind: 'external-api' },
      { stepKey: 'verify-ucs-data-platform-readback', title: 'Verify UCS reads Data Platform inputs', toolKind: 'external-api' },
      { stepKey: 'configure-ucs-ai-models', title: 'Configure UCS AI model snapshots', toolKind: 'external-api' },
      { stepKey: 'execute-ucs-baseline', title: 'Execute baseline through Airflow and AI Notebook', toolKind: 'external-api' },
      { stepKey: 'execute-ucs-intervention', title: 'Execute intervention through Airflow and AI Notebook', toolKind: 'external-api' },
      { stepKey: 'persist-oldt-simulation-worlds', title: 'Persist timestamped OLDT simulation worlds', toolKind: 'workflow-worker' },
      { stepKey: 'store-ucs-roundtrip-binding', title: 'Store OLDT UCS provenance binding', toolKind: 'workflow-worker' },
      { stepKey: 'write-ucs-roundtrip-artifacts', title: 'Write UCS roundtrip evidence', toolKind: 'workflow-worker' },
    ],
    'eu-ldt-data-space-publish': [
      ...shared,
      { stepKey: 'export-twin-query-package', title: 'Export bounded OLDT TwinQuery package', toolKind: 'workflow-worker' },
      { stepKey: 'persist-data-space-package', title: 'Persist immutable data-space package', toolKind: 'workflow-worker' },
      { stepKey: 'register-edc-policy', title: 'Register EDC ODRL policy', toolKind: 'external-api' },
      { stepKey: 'register-edc-asset', title: 'Register OLDT package as EDC asset', toolKind: 'external-api' },
      { stepKey: 'register-edc-contract-definition', title: 'Register EDC contract definition', toolKind: 'external-api' },
      { stepKey: 'write-data-space-publication-artifacts', title: 'Write data-space publication evidence', toolKind: 'workflow-worker' },
    ],
    'eu-ldt-data-space-query-exchange': [
      ...shared,
      { stepKey: 'export-twin-query-package', title: 'Export bounded OLDT TwinQuery package', toolKind: 'workflow-worker' },
      { stepKey: 'persist-data-space-package', title: 'Persist immutable data-space package', toolKind: 'workflow-worker' },
      { stepKey: 'register-edc-policy', title: 'Register EDC ODRL policy', toolKind: 'external-api' },
      { stepKey: 'register-edc-asset', title: 'Register OLDT package as EDC asset', toolKind: 'external-api' },
      { stepKey: 'register-edc-contract-definition', title: 'Register EDC contract definition', toolKind: 'external-api' },
      { stepKey: 'discover-edc-offer', title: 'Discover provider offer from consumer', toolKind: 'external-api' },
      { stepKey: 'negotiate-edc-contract', title: 'Negotiate EDC contract', toolKind: 'external-api' },
      { stepKey: 'transfer-edc-package', title: 'Transfer package through EDC', toolKind: 'external-api' },
      { stepKey: 'verify-transfer-receipt', title: 'Verify OLDT transfer receipt integrity', toolKind: 'workflow-worker' },
      { stepKey: 'write-data-space-artifacts', title: 'Write data-space exchange evidence', toolKind: 'workflow-worker' },
    ],
    'eu-ldt-play-visualise-register-layer': [
      ...shared,
      { stepKey: 'resolve-visualise-profile', title: 'Resolve EU Play & Visualise profile', toolKind: 'workflow-worker' },
      { stepKey: 'prepare-oldt-source', title: 'Prepare OLDT OGC source', toolKind: 'workflow-worker' },
      { stepKey: 'register-visualise-datasource', title: 'Register Play & Visualise DataSource', toolKind: 'external-api' },
      { stepKey: 'register-visualise-datalayer', title: 'Register Play & Visualise DataLayer', toolKind: 'external-api' },
      { stepKey: 'verify-visualise-consumption', title: 'Verify Play & Visualise can consume OLDT data', toolKind: 'external-api' },
      { stepKey: 'write-visualise-artifacts', title: 'Write visualisation registration artifacts', toolKind: 'workflow-worker' },
    ],
    'eu-ldt-marketplace-agent-publish': [
      ...shared,
      { stepKey: 'build-marketplace-package', title: 'Build OLDT Marketplace package', toolKind: 'workflow-worker' },
      { stepKey: 'validate-marketplace-package', title: 'Validate package compatibility', toolKind: 'workflow-worker' },
      { stepKey: 'upload-marketplace-agent-assets', title: 'Upload package to Marketplace Agent profiles', toolKind: 'external-api' },
      { stepKey: 'publish-marketplace-offerings', title: 'Publish uploaded assets as Marketplace offerings', toolKind: 'external-api' },
      { stepKey: 'launch-marketplace-offerings', title: 'Launch Marketplace offerings for public Explore visibility', toolKind: 'external-api' },
      { stepKey: 'verify-marketplace-agent-metadata', title: 'Verify Marketplace Agent metadata', toolKind: 'external-api' },
      { stepKey: 'write-marketplace-artifacts', title: 'Write Marketplace publication artifacts', toolKind: 'workflow-worker' },
    ],
    'renovation-strategy-readiness-demo': [
      ...shared,
      { stepKey: 'assess-building-readiness', title: 'Assess OLDT building readiness', toolKind: 'workflow-worker' },
      { stepKey: 'resolve-archetype-and-cost-gaps', title: 'Resolve archetype and cost gaps', toolKind: 'workflow-worker' },
      { stepKey: 'prepare-demo-package-plan', title: 'Prepare Renova demo package plan', toolKind: 'workflow-worker' },
      { stepKey: 'write-readiness-artifacts', title: 'Write readiness artifacts', toolKind: 'workflow-worker' },
    ],
    'vulnerability-clustering-readiness-demo': [
      ...shared,
      { stepKey: 'assess-zone-readiness', title: 'Assess OLDT zone readiness', toolKind: 'workflow-worker' },
      { stepKey: 'resolve-isv-and-indicator-gaps', title: 'Resolve ISV and indicator gaps', toolKind: 'workflow-worker' },
      { stepKey: 'prepare-demo-package-plan', title: 'Prepare NEVULA demo package plan', toolKind: 'workflow-worker' },
      { stepKey: 'write-readiness-artifacts', title: 'Write readiness artifacts', toolKind: 'workflow-worker' },
    ],
    'external-model-enrichment-exchange': [
      ...shared,
      { stepKey: 'export-canonical-objects', title: 'Export canonical objects and model features', toolKind: 'workflow-worker' },
      { stepKey: 'external-model-execution', title: 'Execute external model endpoint', toolKind: 'external-api' },
      { stepKey: 'import-enrichment-results', title: 'Import model results as enrichment outputs', toolKind: 'workflow-worker' },
      { stepKey: 'publish-enrichment-read-model', title: 'Publish enrichment read-model evidence', toolKind: 'workflow-worker' },
    ],
  }
  return templates[workflowKey] ?? shared
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function phase14ProviderAction(entry) {
  const explicit = String(entry?.action ?? entry?.requestedAction ?? entry?.requested_action ?? entry?.mode ?? '').trim().toLowerCase()
  if (explicit) return explicit === 'ogc' ? 'ogc-features' : explicit
  const sourceFormat = String(entry?.sourceFormat ?? entry?.source_format ?? '').trim().toLowerCase()
  if (sourceFormat === 'geojson') return 'geojson'
  if (sourceFormat === 'csv') return 'csv'
  if (sourceFormat === 'ogc-api-features' || sourceFormat === 'ogc') return 'ogc-features'
  if (sourceFormat === 'stac') return 'stac'
  if (sourceFormat === 'cityjson') return 'cityjson'
  if (sourceFormat === 'overture-buildings') return 'overture-buildings'
  if (sourceFormat === 'overture-roads') return 'overture-roads'
  return 'package'
}

function phase14SourceValidation(providerPackage) {
  const issues = []
  const sourceUri = providerPackage.sourceUri || ''
  const sourceScheme = sourceUri.includes('://') ? sourceUri.split('://')[0].toLowerCase() : ''
  const hasSourceUri = Boolean(sourceUri)
  const isOpenConnectorAction = providerPackage.action.startsWith('overture-') || providerPackage.action === 'osm-local-extract' || providerPackage.action === 'mvt-cache-refresh'
  const hasRawOsmSchema = providerPackage.action === 'osm-local-extract' && Boolean(providerPackage.metadata?.rawSchema || providerPackage.metadata?.raw_schema)
  const isViewerRefresh = providerPackage.action === 'mvt-cache-refresh'
  const isPackageMetadataOnly = providerPackage.action === 'package' && !hasSourceUri && Object.keys(providerPackage.metadata ?? {}).length > 0
  const isSmokeOnly = sourceScheme === 'memory' || sourceScheme === 'test' || sourceUri.includes('smoke')
  const isSupportedRealScheme = ['http', 'https', 's3', 'gs', 'az', 'file'].includes(sourceScheme)
  if (!providerPackage.layerKey) {
    issues.push({ severity: 'error', code: 'LAYER_KEY_REQUIRED', message: 'Provider package must target a registered layer key.' })
  }
  if (!hasSourceUri && !isOpenConnectorAction && !isPackageMetadataOnly) {
    issues.push({ severity: 'warning', code: 'SOURCE_URI_RECOMMENDED', message: 'Provider package should include a source URI before worker execution.' })
  }
  if (hasSourceUri && !isSupportedRealScheme) {
    issues.push({ severity: isSmokeOnly ? 'warning' : 'error', code: 'SOURCE_URI_SCHEME_NOT_EXECUTABLE', message: `Source URI scheme "${sourceScheme || 'none'}" is not executable by production workers.` })
  }
  if (isSmokeOnly) {
    issues.push({ severity: 'warning', code: 'SMOKE_SOURCE_NOT_QUEUEABLE', message: 'Smoke or memory sources can be registered but must not be queued for worker execution.' })
  }
  const hasBlockingIssue = issues.some((issue) => issue.severity === 'error')
  const canQueue = !hasBlockingIssue && !isSmokeOnly && (isSupportedRealScheme || hasRawOsmSchema || isViewerRefresh || isOpenConnectorAction || isPackageMetadataOnly)
  const sourceState = canQueue ? 'queueable' : hasSourceUri || isOpenConnectorAction || isPackageMetadataOnly ? 'register-only' : 'source-required'
  return {
    sourceState,
    sourceScheme: sourceScheme || null,
    canQueue,
    issues,
  }
}

function normalizePhase14ProviderPackage(entry, index) {
  const layerKey = String(entry?.layerKey ?? entry?.layer_key ?? entry?.key ?? `provider-package-${index + 1}`).trim()
  const action = phase14ProviderAction(entry)
  const sourceFormat = String(entry?.sourceFormat ?? entry?.source_format ?? action).trim() || action
  const sourceUri = String(entry?.sourceUri ?? entry?.source_uri ?? '').trim() || null
  const providerPackage = {
    layerKey,
    action,
    sourceFormat,
    posture: String(entry?.posture ?? entry?.sourcePosture ?? entry?.source_posture ?? 'receive-only').trim() || 'receive-only',
    sourceUri,
    sourceVersion: String(entry?.sourceVersion ?? entry?.source_version ?? entry?.version ?? '').trim() || null,
    release: String(entry?.release ?? entry?.overtureRelease ?? entry?.overture_release ?? entry?.sourceVersion ?? entry?.source_version ?? '').trim() || null,
    providerKey: String(entry?.providerKey ?? entry?.provider_key ?? '').trim() || null,
    connectorKey: String(entry?.connectorKey ?? entry?.connector_key ?? '').trim() || null,
    metadata: entry?.metadata ?? {},
    queueForExecution: entry?.queueForExecution === true || entry?.queue_for_execution === true,
  }
  const validation = phase14SourceValidation(providerPackage)
  return {
    ...providerPackage,
    sourceValidation: validation,
    jobStatus: validation.canQueue ? 'ready-for-provider-ingestion-job' : validation.sourceState,
  }
}

function phase14ProviderJobIdempotencyKey(run, providerPackage) {
  return createHash('sha256')
    .update(stableJson({
      workflowRunId: run.id,
      cityId: run.cityId,
      layerKey: providerPackage.layerKey,
      action: providerPackage.action,
      sourceFormat: providerPackage.sourceFormat,
      sourceUri: providerPackage.sourceUri,
      sourceVersion: providerPackage.sourceVersion,
    }))
    .digest('hex')
}

function phase14ArtifactUri(runId, artifactKind) {
  return `ldt://workflow-runs/${runId}/${artifactKind}.json`
}

function workflowArtifactUri(runId, artifactKind) {
  return `ldt://workflow-runs/${runId}/${artifactKind}.json`
}

function normalizeEuLdtEndpoint(value) {
  const explicit = String(value ?? '').trim()
  const fallback = String(process.env.EU_LDT_DATA_PLATFORM_URL ?? '').trim() || 'http://host.docker.internal:8080'
  return (explicit || fallback).replace(/\/+$/, '')
}

function normalizePositiveLimit(value, fallback = 25, max = 100) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return Math.max(1, Math.min(Math.floor(numeric), max))
}

function normalizeEuLdtHeaders(input = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  const custom = input && typeof input === 'object' ? input : {}
  for (const [key, value] of Object.entries(custom)) {
    if (!key || value == null) continue
    headers[key] = String(value)
  }
  return headers
}

async function resolveEuLdtDataPlatformRunTarget(client, input = {}) {
  const profileKey = String(
    input.integrationProfileKey
      ?? input.integration_profile_key
      ?? input.dataPlatformProfileKey
      ?? input.data_platform_profile_key
      ?? '',
  ).trim()

  if (profileKey) {
    const target = await resolveEuLdtIntegrationTarget(client, profileKey, {
      platformKind: 'data-platform',
      endpointKey: 'backendApiUrl',
    })
    return {
      ...target,
      endpoint: normalizeEuLdtEndpoint(input.endpoint ?? input.dataPlatformUrl ?? input.data_platform_url ?? target.endpoint),
      headers: normalizeEuLdtHeaders({ ...target.headers, ...(input.headers ?? {}) }),
      externalSystem: `eu-ldt-data-platform:${target.profileKey}`,
    }
  }

  const endpoint = normalizeEuLdtEndpoint(input.endpoint ?? input.dataPlatformUrl ?? input.data_platform_url)
  return {
    profile: null,
    profileKey: null,
    displayName: 'EU LDT Data Platform',
    platformKind: 'data-platform',
    endpoint,
    headers: normalizeEuLdtHeaders(input.headers),
    externalSystem: 'eu-ldt-data-platform',
  }
}

function normalizeText(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function normalizePlayVisualiseDbUrl(profile, input = {}) {
  return normalizeText(
    input.playVisualiseDatabaseUrl
      ?? input.play_visualise_database_url
      ?? profile?.metadata?.databaseUrl
      ?? profile?.metadata?.database_url
      ?? profile?.endpoints?.databaseUrl
      ?? profile?.endpoints?.database_url
      ?? process.env.EU_LDT_PLAY_VISUALISE_DATABASE_URL,
    'postgresql://myuser:mypassword@host.docker.internal:5437/playandvisualise',
  )
}

function normalizePlayVisualiseApiBase(profile, input = {}) {
  return normalizeText(input.apiBaseUrl ?? input.api_base_url ?? profile?.baseUrl, 'http://host.docker.internal:4301/api').replace(/\/+$/, '')
}

function normalizeOldtCollectionKey(value = 'buildings') {
  const normalized = String(value ?? 'buildings')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!normalized) throw new Error('OLDT_COLLECTION_KEY_REQUIRED')
  return normalized
}

function titleForCollection(collectionKey) {
  return collectionKey
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function technicalPlayKey(value, fallback = 'oldt-layer') {
  const normalized = String(value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function normalizePlayColor(value, fallback) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  return normalizeText(value, fallback)
}

function normalizePlayLayerConfig(input = {}, collectionKey = 'buildings') {
  const layerName = normalizeText(input.layerName ?? input.layer_name, `OLDT ${titleForCollection(collectionKey)}`)
  const datasourceName = normalizeText(input.dataSourceName ?? input.data_source_name, `OLDT Guanajuato ${titleForCollection(collectionKey)}`)
  const mapName = normalizeText(input.mapName ?? input.map_name, 'OLDT Guanajuato')
  const mapDescription = normalizeText(
    input.mapDescription ?? input.map_description,
    `OLDT ${titleForCollection(collectionKey)} layer registered for EU Play & Visualise.`,
  )
  const layerType = normalizeText(input.layerType ?? input.layer_type, 'REAL_TIME').toUpperCase()
  return {
    datasourceName,
    layerName,
    mapName,
    mapDescription,
    layerType: ['STATIC', 'REAL_TIME', 'SCHEDULED'].includes(layerType) ? layerType : 'REAL_TIME',
    configuration: {
      name: layerName,
      key: technicalPlayKey(input.layerKey ?? input.layer_key ?? layerName),
      type: normalizeText(input.mapStyleType ?? input.map_style_type, collectionKey === 'roads' ? 'line' : 'fill'),
      color: normalizePlayColor(input.color, collectionKey === 'roads' ? '#505A5F' : '#0072CE'),
      opacity: normalizeText(input.opacity, '0.55'),
      visibility: String(input.visibility ?? 'true'),
      interactive: String(input.interactive ?? 'true'),
      propField: normalizeText(input.propField ?? input.prop_field, collectionKey === 'buildings' ? 'energyLabel' : 'label'),
      ...(input.configuration && typeof input.configuration === 'object' && !Array.isArray(input.configuration) ? input.configuration : {}),
    },
  }
}

function playVisualiseMode(input = {}) {
  const raw = normalizeText(input.mode ?? input.visualiseMode ?? input.visualise_mode ?? input.registrationMode ?? input.registration_mode, 'basic')
    .toLowerCase()
    .replace(/_/g, '-')
  if (['full-power', 'advanced', 'full'].includes(raw)) return 'full-power'
  return 'basic'
}

function normalizePlayVisualiseFullPowerConfig(input = {}, sourceUrlForCollection) {
  const mapName = normalizeText(input.mapName ?? input.map_name, 'OLDT Guanajuato Full Power')
  const limit = normalizePositiveLimit(input.limit, 1000, 1000)
  const mapDescription = normalizeText(
    input.mapDescription ?? input.map_description,
    'Full Play & Visualise map registered by OLDT: buildings, roads, labels, 3D extrusion, plots, and report.',
  )
  const layerType = normalizeText(input.layerType ?? input.layer_type, 'REAL_TIME').toUpperCase()
  const normalizedLayerType = ['STATIC', 'REAL_TIME', 'SCHEDULED'].includes(layerType) ? layerType : 'REAL_TIME'
  const sourcePrefix = normalizeText(input.dataSourceNamePrefix ?? input.data_source_name_prefix, 'OLDT Full Power')

  const sources = [
    {
      key: 'buildings',
      collectionKey: 'buildings',
      datasourceName: normalizeText(input.buildingsDataSourceName ?? input.buildings_data_source_name, `${sourcePrefix} Buildings`),
      sourceUrl: sourceUrlForCollection('buildings', limit),
    },
    {
      key: 'roads',
      collectionKey: 'roads',
      datasourceName: normalizeText(input.roadsDataSourceName ?? input.roads_data_source_name, `${sourcePrefix} Roads`),
      sourceUrl: sourceUrlForCollection('roads', limit),
    },
  ]

  const energyColor = {
    type: 'CAT',
    default: '#7A869A',
    propField: 'energyLabel',
    catColors: {
      A: '#007A3D',
      B: '#5BAA46',
      C: '#D7C600',
      D: '#F5A623',
      E: '#E76F51',
      F: '#C43D3D',
      G: '#7A1F1F',
      default: '#7A869A',
    },
  }
  const sapColor = {
    type: 'NUM',
    default: '#2E86AB',
    propField: 'sapScore',
    minValue: 0,
    maxValue: 100,
    maxColor: '#F18F01',
  }

  const layers = [
    {
      sourceKey: 'buildings',
      layerName: normalizeText(input.buildingsFillLayerName ?? input.buildings_fill_layer_name, 'OLDT Buildings Energy Fill'),
      layerType: normalizedLayerType,
      configuration: {
        name: normalizeText(input.buildingsFillLayerName ?? input.buildings_fill_layer_name, 'OLDT Buildings Energy Fill'),
        key: 'oldt-buildings-energy-fill',
        type: 'fill',
        color: energyColor,
        opacity: '65',
        visibility: 'true',
        interactive: 'true',
      },
    },
    {
      sourceKey: 'buildings',
      layerName: normalizeText(input.buildingsExtrusionLayerName ?? input.buildings_extrusion_layer_name, 'OLDT Buildings SAP Extrusion'),
      layerType: normalizedLayerType,
      configuration: {
        name: normalizeText(input.buildingsExtrusionLayerName ?? input.buildings_extrusion_layer_name, 'OLDT Buildings SAP Extrusion'),
        key: 'oldt-buildings-sap-extrusion',
        type: 'fill-extrusion',
        color: sapColor,
        height: normalizeText(input.extrusionHeight ?? input.extrusion_height, 'sapScore'),
        unit: normalizeText(input.extrusionUnit ?? input.extrusion_unit, 'M'),
        opacity: '72',
        visibility: 'true',
        interactive: 'true',
        propField: 'label',
      },
    },
    {
      sourceKey: 'buildings',
      layerName: normalizeText(input.buildingsLabelLayerName ?? input.buildings_label_layer_name, 'OLDT Building Labels'),
      layerType: normalizedLayerType,
      configuration: {
        name: normalizeText(input.buildingsLabelLayerName ?? input.buildings_label_layer_name, 'OLDT Building Labels'),
        key: 'oldt-building-labels',
        type: 'symbol',
        color: { type: 'FIX', default: '#111827' },
        opacity: '90',
        visibility: 'true',
        interactive: 'false',
        propField: 'label',
        mapFonts: normalizeText(input.labelFont ?? input.label_font, 'Noto Sans Regular'),
      },
    },
    {
      sourceKey: 'roads',
      layerName: normalizeText(input.roadsLayerName ?? input.roads_layer_name, 'OLDT Roads Lines'),
      layerType: normalizedLayerType,
      configuration: {
        name: normalizeText(input.roadsLayerName ?? input.roads_layer_name, 'OLDT Roads Lines'),
        key: 'oldt-roads-lines',
        type: 'line',
        color: { type: 'FIX', default: '#36454F' },
        opacity: '68',
        visibility: 'true',
        interactive: 'true',
        width: '2.5',
        lineCap: 'round',
        lineJoin: 'round',
      },
    },
  ]

  const plots = [
    {
      sourceKey: 'buildings',
      plotName: normalizeText(input.plotName ?? input.plot_name, 'SAP Score Histogram'),
      plotType: 'HISTOGRAM',
      configuration: {
        values: normalizeText(input.plotValues ?? input.plot_values, 'sapScore'),
        interval: normalizeText(input.plotInterval ?? input.plot_interval, '8'),
        minValue: normalizeText(input.plotMinValue ?? input.plot_min_value, '0'),
        maxValue: normalizeText(input.plotMaxValue ?? input.plot_max_value, '100'),
        histogramStyle: 'VERTICAL',
        frequencyType: 'ABSOLUTE',
        xAxisTitle: 'SAP score',
        yAxisTitle: 'Buildings',
        hasBatch: 'false',
      },
      mapConfiguration: {
        name: normalizeText(input.plotName ?? input.plot_name, 'SAP Score Histogram'),
        visibility: 'true',
      },
    },
  ]

  const reports = [
    {
      reportName: normalizeText(input.reportName ?? input.report_name, 'OLDT Full Power Snapshot'),
      frecuency: normalizeText(input.reportFrequency ?? input.report_frequency, 'MANUAL'),
      description: normalizeText(input.reportDescription ?? input.report_description, 'Snapshot report linked to OLDT Full Power map.'),
      scope: normalizeText(input.reportScope ?? input.report_scope, 'PUBLIC').toUpperCase(),
    },
  ]

  return {
    mode: 'full-power',
    mapName,
    mapDescription,
    limit,
    sources,
    layers,
    plots,
    reports,
  }
}

async function createLocalOldtCookie(input = {}) {
  const explicitCookie = normalizeText(input.oldtCookie ?? input.oldt_cookie)
  if (explicitCookie) return explicitCookie
  if (input.oldtAuthMode === 'none' || input.oldt_auth_mode === 'none') return ''

  const loginUrl = normalizeText(input.oldtLoginUrl ?? input.oldt_login_url, 'http://host.docker.internal:4292/api/auth/login')
  const email = normalizeText(input.oldtEmail ?? input.oldt_email ?? process.env.TWIN_STUDIO_SMOKE_EMAIL, 'smoke@polisplexity.test')
  const password = normalizeText(input.oldtPassword ?? input.oldt_password ?? process.env.TWIN_STUDIO_SMOKE_PASSWORD, 'local-smoke-password-change-me')
  const cityId = normalizeText(input.cityId ?? input.city_id, 'guanajuato')

  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password, cityId, rememberMe: true }),
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`OLDT_COOKIE_LOGIN_FAILED:${response.status}`)
  const setCookie = response.headers.get('set-cookie') ?? ''
  const cookie = setCookie.split(';')[0]
  if (!cookie.startsWith('twin_session=')) throw new Error('OLDT_COOKIE_LOGIN_SESSION_MISSING')
  return cookie
}

function normalizeGeoJsonFeatureCollection(body) {
  if (body?.type === 'FeatureCollection' && Array.isArray(body.features)) return body
  if (Array.isArray(body?.features)) return { type: 'FeatureCollection', features: body.features }
  return { type: 'FeatureCollection', features: [] }
}

function featureBounds(features = []) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity]
  function visit(value) {
    if (!Array.isArray(value)) return
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      bounds[0] = Math.min(bounds[0], value[0])
      bounds[1] = Math.min(bounds[1], value[1])
      bounds[2] = Math.max(bounds[2], value[0])
      bounds[3] = Math.max(bounds[3], value[1])
      return
    }
    for (const entry of value) visit(entry)
  }
  for (const feature of features) visit(feature?.geometry?.coordinates)
  return bounds.every(Number.isFinite) ? bounds : null
}

async function fetchJsonForVisualiseVerification(url, headers = {}) {
  const response = await fetch(url, {
    headers: { Accept: 'application/geo+json, application/json', ...headers },
    signal: AbortSignal.timeout(15000),
  })
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text.slice(0, 1000) }
  }
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    body,
  }
}

async function upsertPlayVisualiseLayer({
  databaseUrl,
  datasourceName,
  layerName,
  sourceUrl,
  sourceHeaders,
  layerType,
  layerConfiguration,
  mapName,
  mapDescription,
}) {
  const pool = new Pool({ connectionString: databaseUrl, max: 1, allowExitOnIdle: true })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const existingDatasource = await client.query('SELECT id, name FROM datasource WHERE lower(name) = lower($1) ORDER BY updated_at DESC LIMIT 1', [datasourceName])
    let datasource = existingDatasource.rows[0]
    if (datasource) {
      await client.query('UPDATE datasource SET attribution = $2, updated_at = now() WHERE id = $1', [datasource.id, 'OLDT OGC API Features'])
    } else {
      const insertedDatasource = await client.query(
        `
          INSERT INTO datasource (name, attribution, created_at, updated_at)
          VALUES ($1, $2, now(), now())
          RETURNING id, name
        `,
        [datasourceName, 'OLDT OGC API Features'],
      )
      datasource = insertedDatasource.rows[0]
    }

    await client.query('DELETE FROM source_configuration WHERE datasource_id = $1', [datasource.id])
    await client.query(
      `
        INSERT INTO source_configuration (datasource_id, source_type_id, url, headers)
        VALUES ($1, 'EXTERNAL', $2, $3::jsonb)
      `,
      [datasource.id, sourceUrl, JSON.stringify([])],
    )
    await client.query('DELETE FROM security_configuration WHERE datasource_id = $1', [datasource.id])
    await client.query(
      `
        INSERT INTO security_configuration (datasource_id, security_type_id, headers, created_at, updated_at)
        VALUES ($1, 'OTHER', $2::jsonb, now(), now())
      `,
      [datasource.id, JSON.stringify(sourceHeaders)],
    )

    const ownerResult = await client.query('SELECT user_id FROM user_municipality ORDER BY user_id LIMIT 1')
    if (ownerResult.rowCount === 0) throw new Error('PLAY_VISUALISE_OWNER_NOT_FOUND')
    const ownerId = ownerResult.rows[0].user_id
    const municipalityResult = await client.query('SELECT municipality_id FROM user_municipality WHERE user_id = $1 ORDER BY municipality_id LIMIT 1', [ownerId])
    const municipalityId = municipalityResult.rows[0]?.municipality_id ?? null

    const existingLayer = await client.query('SELECT id FROM datalayer WHERE lower(name) = lower($1) ORDER BY updated_at DESC LIMIT 1', [layerName])
    let datalayer
    if (existingLayer.rowCount > 0) {
      const updated = await client.query(
        `
          UPDATE datalayer
          SET datasource_id = $2,
              owner_id = $3,
              type = $4,
              configuration = $5::jsonb,
              updated_at = now()
          WHERE id = $1
          RETURNING id, name, datasource_id, type, configuration
        `,
        [existingLayer.rows[0].id, datasource.id, ownerId, layerType, JSON.stringify(layerConfiguration)],
      )
      datalayer = updated.rows[0]
    } else {
      const inserted = await client.query(
        `
          INSERT INTO datalayer (name, datasource_id, owner_id, type, configuration, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())
          RETURNING id, name, datasource_id, type, configuration
        `,
        [layerName, datasource.id, ownerId, layerType, JSON.stringify(layerConfiguration)],
      )
      datalayer = inserted.rows[0]
    }

    const existingMap = await client.query('SELECT id FROM map WHERE lower(name) = lower($1) ORDER BY updated_at DESC LIMIT 1', [mapName])
    let map
    if (existingMap.rowCount > 0) {
      const updated = await client.query(
        `
          UPDATE map
          SET owner_id = $2,
              scope_type = 'PUBLIC',
              description = $3,
              map_image = '',
              style_url = NULL,
              restricted_read = NULL,
              restricted_write = NULL,
              updated_at = now()
          WHERE id = $1
          RETURNING id, name, owner_id, scope_type, description
        `,
        [existingMap.rows[0].id, ownerId, mapDescription],
      )
      map = updated.rows[0]
    } else {
      const inserted = await client.query(
        `
          INSERT INTO map (
            name,
            owner_id,
            scope_type,
            description,
            map_image,
            style_url,
            restricted_read,
            restricted_write,
            created_at,
            updated_at
          )
          VALUES ($1, $2, 'PUBLIC', $3, '', NULL, NULL, NULL, now(), now())
          RETURNING id, name, owner_id, scope_type, description
        `,
        [mapName, ownerId, mapDescription],
      )
      map = inserted.rows[0]
    }

    await client.query(
      `
        INSERT INTO map_datalayer (map_id, datalayer_id, configuration, key, created_at, updated_at, id)
        VALUES ($1, $2, $3::jsonb, $4, now(), now(), uuid_generate_v4())
        ON CONFLICT (map_id, datalayer_id, key)
        DO UPDATE SET
          configuration = EXCLUDED.configuration,
          updated_at = now()
      `,
      [map.id, datalayer.id, JSON.stringify(layerConfiguration), layerName],
    )
    if (municipalityId) {
      await client.query(
        `
          INSERT INTO municipality_map (municipality_id, map_id)
          VALUES ($1, $2)
          ON CONFLICT (municipality_id, map_id) DO NOTHING
        `,
        [municipalityId, map.id],
      )
    }

    await client.query('COMMIT')
    return { datasource, datalayer, map: { ...map, municipality_id: municipalityId } }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

async function upsertPlayVisualiseLayerSet({
  databaseUrl,
  mapName,
  mapDescription,
  sources,
  sourceHeaders,
  layers,
  plots = [],
  reports = [],
}) {
  const pool = new Pool({ connectionString: databaseUrl, max: 1, allowExitOnIdle: true })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const ownerResult = await client.query('SELECT user_id FROM user_municipality ORDER BY user_id LIMIT 1')
    if (ownerResult.rowCount === 0) throw new Error('PLAY_VISUALISE_OWNER_NOT_FOUND')
    const ownerId = ownerResult.rows[0].user_id
    const municipalityResult = await client.query('SELECT municipality_id FROM user_municipality WHERE user_id = $1 ORDER BY municipality_id LIMIT 1', [ownerId])
    const municipalityId = municipalityResult.rows[0]?.municipality_id ?? null

    const datasourceByKey = new Map()
    for (const source of sources) {
      const existingDatasource = await client.query('SELECT id, name FROM datasource WHERE lower(name) = lower($1) ORDER BY updated_at DESC LIMIT 1', [source.datasourceName])
      let datasource = existingDatasource.rows[0]
      if (datasource) {
        const updated = await client.query('UPDATE datasource SET attribution = $2, updated_at = now() WHERE id = $1 RETURNING id, name', [datasource.id, 'OLDT OGC API Features'])
        datasource = updated.rows[0]
      } else {
        const inserted = await client.query(
          `
            INSERT INTO datasource (name, attribution, created_at, updated_at)
            VALUES ($1, $2, now(), now())
            RETURNING id, name
          `,
          [source.datasourceName, 'OLDT OGC API Features'],
        )
        datasource = inserted.rows[0]
      }

      await client.query('DELETE FROM source_configuration WHERE datasource_id = $1', [datasource.id])
      await client.query(
        `
          INSERT INTO source_configuration (datasource_id, source_type_id, url, headers)
          VALUES ($1, 'EXTERNAL', $2, $3::jsonb)
        `,
        [datasource.id, source.sourceUrl, JSON.stringify([])],
      )
      await client.query('DELETE FROM security_configuration WHERE datasource_id = $1', [datasource.id])
      await client.query(
        `
          INSERT INTO security_configuration (datasource_id, security_type_id, headers, created_at, updated_at)
          VALUES ($1, 'OTHER', $2::jsonb, now(), now())
        `,
        [datasource.id, JSON.stringify(sourceHeaders)],
      )
      datasourceByKey.set(source.key, { ...datasource, sourceUrl: source.sourceUrl, collectionKey: source.collectionKey })
    }

    const existingMap = await client.query('SELECT id FROM map WHERE lower(name) = lower($1) ORDER BY updated_at DESC LIMIT 1', [mapName])
    let map
    if (existingMap.rowCount > 0) {
      const updated = await client.query(
        `
          UPDATE map
          SET owner_id = $2,
              scope_type = 'PUBLIC',
              description = $3,
              map_image = '',
              style_url = NULL,
              restricted_read = NULL,
              restricted_write = NULL,
              updated_at = now()
          WHERE id = $1
          RETURNING id, name, owner_id, scope_type, description
        `,
        [existingMap.rows[0].id, ownerId, mapDescription],
      )
      map = updated.rows[0]
    } else {
      const inserted = await client.query(
        `
          INSERT INTO map (
            name,
            owner_id,
            scope_type,
            description,
            map_image,
            style_url,
            restricted_read,
            restricted_write,
            created_at,
            updated_at
          )
          VALUES ($1, $2, 'PUBLIC', $3, '', NULL, NULL, NULL, now(), now())
          RETURNING id, name, owner_id, scope_type, description
        `,
        [mapName, ownerId, mapDescription],
      )
      map = inserted.rows[0]
    }

    if (municipalityId) {
      await client.query(
        `
          INSERT INTO municipality_map (municipality_id, map_id)
          VALUES ($1, $2)
          ON CONFLICT (municipality_id, map_id) DO NOTHING
        `,
        [municipalityId, map.id],
      )
    }

    const datalayers = []
    const datalayerByLayerName = new Map()
    const firstDatalayerBySourceKey = new Map()
    for (const layer of layers) {
      const datasource = datasourceByKey.get(layer.sourceKey)
      if (!datasource) throw new Error(`PLAY_VISUALISE_SOURCE_NOT_FOUND:${layer.sourceKey}`)
      const existingLayer = await client.query('SELECT id FROM datalayer WHERE lower(name) = lower($1) ORDER BY updated_at DESC LIMIT 1', [layer.layerName])
      let datalayer
      if (existingLayer.rowCount > 0) {
        const updated = await client.query(
          `
            UPDATE datalayer
            SET datasource_id = $2,
                owner_id = $3,
                type = $4,
                configuration = $5::jsonb,
                updated_at = now()
            WHERE id = $1
            RETURNING id, name, datasource_id, type, configuration
          `,
          [existingLayer.rows[0].id, datasource.id, ownerId, layer.layerType, JSON.stringify(layer.configuration)],
        )
        datalayer = updated.rows[0]
      } else {
        const inserted = await client.query(
          `
            INSERT INTO datalayer (name, datasource_id, owner_id, type, configuration, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())
            RETURNING id, name, datasource_id, type, configuration
          `,
          [layer.layerName, datasource.id, ownerId, layer.layerType, JSON.stringify(layer.configuration)],
        )
        datalayer = inserted.rows[0]
      }

      await client.query(
        `
          INSERT INTO map_datalayer (map_id, datalayer_id, configuration, key, created_at, updated_at, id)
          VALUES ($1, $2, $3::jsonb, $4, now(), now(), uuid_generate_v4())
          ON CONFLICT (map_id, datalayer_id, key)
          DO UPDATE SET
            configuration = EXCLUDED.configuration,
            updated_at = now()
        `,
        [map.id, datalayer.id, JSON.stringify(layer.configuration), layer.configuration.key ?? layer.layerName],
      )

      const normalizedLayer = { ...datalayer, sourceKey: layer.sourceKey }
      datalayers.push(normalizedLayer)
      datalayerByLayerName.set(layer.layerName, normalizedLayer)
      if (!firstDatalayerBySourceKey.has(layer.sourceKey)) firstDatalayerBySourceKey.set(layer.sourceKey, normalizedLayer)
    }

    const registeredPlots = []
    for (const plot of plots) {
      const dataLayer = firstDatalayerBySourceKey.get(plot.sourceKey) ?? datalayers[0]
      if (!dataLayer) throw new Error(`PLAY_VISUALISE_PLOT_DATALAYER_NOT_FOUND:${plot.sourceKey}`)
      const existingPlot = await client.query('SELECT id FROM plot WHERE data_layer_id = $1 AND lower(name) = lower($2) ORDER BY updated_at DESC LIMIT 1', [dataLayer.id, plot.plotName])
      let registeredPlot
      if (existingPlot.rowCount > 0) {
        const updated = await client.query(
          `
            UPDATE plot
            SET plot_type = $2,
                owner_id = $3,
                configuration = $4::jsonb,
                updated_at = now()
            WHERE id = $1
            RETURNING id, name, data_layer_id, plot_type, configuration
          `,
          [existingPlot.rows[0].id, plot.plotType, ownerId, JSON.stringify(plot.configuration)],
        )
        registeredPlot = updated.rows[0]
      } else {
        const inserted = await client.query(
          `
            INSERT INTO plot (name, data_layer_id, plot_type, owner_id, configuration, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())
            RETURNING id, name, data_layer_id, plot_type, configuration
          `,
          [plot.plotName, dataLayer.id, plot.plotType, ownerId, JSON.stringify(plot.configuration)],
        )
        registeredPlot = inserted.rows[0]
      }
      const mapPlotConfiguration = {
        ...(plot.mapConfiguration ?? {}),
        dataLayerId: dataLayer.id,
      }
      await client.query(
        `
          INSERT INTO map_plot (map_id, plot_id, configuration, created_at, updated_at)
          VALUES ($1, $2, $3::jsonb, now(), now())
          ON CONFLICT (map_id, plot_id)
          DO UPDATE SET
            configuration = EXCLUDED.configuration,
            updated_at = now()
        `,
        [map.id, registeredPlot.id, JSON.stringify(mapPlotConfiguration)],
      )
      registeredPlots.push({ ...registeredPlot, mapConfiguration: mapPlotConfiguration })
    }

    const registeredReports = []
    for (const report of reports) {
      const layerIds = datalayers.map((layer) => layer.id)
      const plotIds = registeredPlots.map((plot) => plot.id)
      const existingReport = await client.query('SELECT id FROM report WHERE map_id = $1 AND lower(name) = lower($2) ORDER BY updated_at DESC LIMIT 1', [map.id, report.reportName])
      let registeredReport
      if (existingReport.rowCount > 0) {
        const updated = await client.query(
          `
            UPDATE report
            SET owner_id = $2,
                frecuency = $3,
                description = $4,
                scope = $5,
                layers = $6::jsonb,
                plots = $7::jsonb,
                updated_at = now(),
                restricted_read = NULL,
                restricted_write = NULL
            WHERE id = $1
            RETURNING id, name, map_id, frecuency, description, scope, layers, plots
          `,
          [existingReport.rows[0].id, ownerId, report.frecuency, report.description, report.scope, JSON.stringify(layerIds), JSON.stringify(plotIds)],
        )
        registeredReport = updated.rows[0]
      } else {
        const inserted = await client.query(
          `
            INSERT INTO report (name, map_id, owner_id, created_at, updated_at, frecuency, description, scope, layers, plots, next_run, restricted_read, restricted_write)
            VALUES ($1, $2, $3, now(), now(), $4, $5, $6, $7::jsonb, $8::jsonb, NULL, NULL, NULL)
            RETURNING id, name, map_id, frecuency, description, scope, layers, plots
          `,
          [report.reportName, map.id, ownerId, report.frecuency, report.description, report.scope, JSON.stringify(layerIds), JSON.stringify(plotIds)],
        )
        registeredReport = inserted.rows[0]
      }
      registeredReports.push(registeredReport)
    }

    await client.query('COMMIT')
    const datasources = Array.from(datasourceByKey.values())
    return {
      datasources,
      datasource: datasources[0] ?? null,
      datalayers,
      datalayer: datalayers[0] ?? null,
      plots: registeredPlots,
      reports: registeredReports,
      map: { ...map, municipality_id: municipalityId },
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

function sanitizeEuLdtNgsiPayload(payload) {
  const removed = []
  const requiredAttributeValue = {
    Property: 'value',
    GeoProperty: 'value',
    LanguageProperty: 'value',
    ListProperty: 'value',
    Relationship: 'object',
  }

  function sanitize(value, path = []) {
    if (Array.isArray(value)) {
      return value
        .map((entry, index) => sanitize(entry, [...path, String(index)]))
        .filter((entry) => entry !== undefined)
    }
    if (!value || typeof value !== 'object') return value

    const attributeType = typeof value.type === 'string' ? value.type : ''
    const requiredKey = requiredAttributeValue[attributeType]
    if (requiredKey && !Object.prototype.hasOwnProperty.call(value, requiredKey)) {
      removed.push({ path: path.join('.'), type: attributeType, reason: `${requiredKey}_required` })
      return undefined
    }
    if (requiredKey && value[requiredKey] == null) {
      removed.push({ path: path.join('.'), type: attributeType, reason: `${requiredKey}_null` })
      return undefined
    }

    const output = {}
    for (const [key, entry] of Object.entries(value)) {
      const sanitized = sanitize(entry, [...path, key])
      if (sanitized !== undefined) output[key] = sanitized
    }
    return output
  }

  return {
    payload: sanitize(payload) ?? {},
    removed,
  }
}

async function fetchEuLdtJson(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: text.slice(0, 2000) }
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body,
  }
}

function normalizeMarketplaceProfileKeys(input = {}) {
  const rawKeys = input.integrationProfileKeys ?? input.integration_profile_keys ?? input.marketplaceAgentProfileKeys ?? input.marketplace_agent_profile_keys
  const keys = Array.isArray(rawKeys)
    ? rawKeys
    : String(rawKeys ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  const single = normalizeText(
    input.integrationProfileKey
      ?? input.integration_profile_key
      ?? input.marketplaceAgentProfileKey
      ?? input.marketplace_agent_profile_key,
    '',
  )
  if (single) keys.unshift(single)
  const unique = [...new Set(keys.map((key) => normalizeText(key)).filter(Boolean))]
  return unique.length ? unique : ['local-eu-ldt-marketplace-agent']
}

function normalizeMarketplaceAssetType(value) {
  const normalized = normalizeText(value, 'oldt.semantic-layer').toLowerCase()
  const allowed = new Set([
    'geojson',
    'ngsi-ld',
    'ogc-features',
    '3d-tiles',
    'model-output',
    'semantic-layer',
    'oldt.semantic-layer',
    'oldt.query-fragment',
    'oldt.city-twin-package',
  ])
  if (!allowed.has(normalized)) throw new Error(`MARKETPLACE_ASSET_TYPE_UNSUPPORTED:${normalized}`)
  return normalized
}

function normalizeMarketplaceCompatibilityTargets(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',')
  const targets = raw.map((entry) => normalizeText(entry).toLowerCase()).filter(Boolean)
  const unique = [...new Set(targets)]
  return unique.length ? unique : ['oldt', 'data-platform', 'play-visualise']
}

function normalizeMarketplaceCategories(input = {}, profile = null) {
  const raw = input.categories ?? input.categoryIds ?? input.category_ids ?? profile?.metadata?.defaultCategories ?? profile?.metadata?.default_categories ?? ['EU LDT Toolbox']
  const categories = (Array.isArray(raw) ? raw : String(raw ?? '').split(','))
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
  return categories.length ? [...new Set(categories)] : ['EU LDT Toolbox']
}

function marketplacePackageFilename(input = {}, assetType = 'oldt.semantic-layer') {
  const explicit = normalizeText(input.fileName ?? input.file_name)
  if (explicit) return explicit
  const title = normalizeText(input.title, `OLDT ${assetType}`)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'oldt-marketplace-package'
  return `${title}.json`
}

function normalizeOptionalHttpUrl(value) {
  const normalized = normalizeText(value)
  if (!normalized) return ''
  if (!/^https?:\/\//i.test(normalized)) throw new Error('HTTP_URL_REQUIRED')
  return normalized.replace(/\/+$/, '')
}

function marketplaceAgentEndpointOverride(target, input = {}) {
  const perProfile = input.agentAssetsUrls ?? input.agent_assets_urls ?? {}
  const profileOverride = perProfile && typeof perProfile === 'object' ? perProfile[target.profileKey] : ''
  const explicit = normalizeOptionalHttpUrl(profileOverride || input.agentAssetsUrl || input.agent_assets_url)
  if (!explicit) return target
  return {
    ...target,
    endpoint: explicit,
  }
}

function buildMarketplacePackagePayload({ run, input, sourcePayload = null }) {
  const assetType = normalizeMarketplaceAssetType(input.assetType ?? input.asset_type ?? input.type)
  const title = normalizeText(input.title ?? input.name, `OLDT ${titleForCollection(input.collectionKey ?? input.collection_key ?? assetType)}`)
  const description = normalizeText(
    input.description,
    `OLDT package generated from ${run.cityId} for EU LDT Marketplace Agent publication.`,
  )
  const compatibilityTargets = normalizeMarketplaceCompatibilityTargets(input.compatibilityTargets ?? input.compatibility_targets)
  const generatedAt = new Date().toISOString()
  const data = sourcePayload ?? input.payload ?? input.data ?? {
    type: 'FeatureCollection',
    features: [],
    metadata: {
      note: 'No source payload was provided. This is an empty package shell.',
    },
  }
  return {
    schemaVersion: '2026-07-08.oldt-marketplace-package.v1',
    packageType: assetType,
    title,
    description,
    cityId: run.cityId,
    source: {
      system: 'OLDT',
      workflowRunId: run.id,
      workflowKey: run.workflowKey,
      sourceUrl: normalizeText(input.sourceUrl ?? input.source_url, ''),
      collectionKey: normalizeText(input.collectionKey ?? input.collection_key, ''),
      queryId: normalizeText(input.queryId ?? input.query_id, ''),
      fragmentId: normalizeText(input.fragmentId ?? input.fragment_id, ''),
      modelId: normalizeText(input.modelId ?? input.model_id, ''),
    },
    compatibility: {
      targets: compatibilityTargets,
      formats: Array.isArray(input.formats) ? input.formats : [assetType],
    },
    licence: normalizeText(input.licence ?? input.license, 'CC-BY-4.0'),
    provenance: {
      generatedAt,
      generatedBy: normalizeText(input.requestedBy ?? input.requested_by, run.requestedBy ?? 'oldt-workflow'),
      authorityStatus: normalizeText(input.authorityStatus ?? input.authority_status, 'operator-approved-marketplace-candidate'),
      publicationStatus: 'marketplace-agent-publication-requested',
    },
    data,
  }
}

function validateMarketplacePackage(packagePayload) {
  const issues = []
  if (!packagePayload?.schemaVersion) issues.push({ severity: 'error', code: 'SCHEMA_VERSION_REQUIRED' })
  if (!packagePayload?.packageType) issues.push({ severity: 'error', code: 'PACKAGE_TYPE_REQUIRED' })
  if (!packagePayload?.title) issues.push({ severity: 'error', code: 'TITLE_REQUIRED' })
  if (!packagePayload?.cityId) issues.push({ severity: 'error', code: 'CITY_ID_REQUIRED' })
  if (!packagePayload?.licence) issues.push({ severity: 'error', code: 'LICENCE_REQUIRED' })
  if (!Array.isArray(packagePayload?.compatibility?.targets) || packagePayload.compatibility.targets.length === 0) {
    issues.push({ severity: 'error', code: 'COMPATIBILITY_TARGET_REQUIRED' })
  }
  const data = packagePayload?.data
  if (packagePayload.packageType === 'geojson' || packagePayload.packageType === 'semantic-layer' || packagePayload.packageType === 'oldt.semantic-layer') {
    if (data?.type !== 'FeatureCollection') {
      issues.push({ severity: 'warning', code: 'GEOJSON_FEATURE_COLLECTION_RECOMMENDED' })
    }
    if (data?.type === 'FeatureCollection' && !Array.isArray(data.features)) {
      issues.push({ severity: 'error', code: 'GEOJSON_FEATURES_ARRAY_REQUIRED' })
    }
  }
  if (packagePayload.packageType === 'ngsi-ld') {
    const entities = Array.isArray(data) ? data : [data]
    for (const [index, entity] of entities.entries()) {
      if (!entity?.id) issues.push({ severity: 'error', code: 'NGSI_ID_REQUIRED', index })
      if (!entity?.type) issues.push({ severity: 'error', code: 'NGSI_TYPE_REQUIRED', index })
      if (!entity?.['@context']) issues.push({ severity: 'warning', code: 'NGSI_CONTEXT_RECOMMENDED', index })
    }
  }
  const blocking = issues.filter((issue) => issue.severity === 'error')
  return {
    ok: blocking.length === 0,
    issues,
    blocking,
  }
}

async function fetchMarketplaceSourcePayload(input = {}) {
  const sourceUrl = normalizeText(input.sourceUrl ?? input.source_url)
  if (!sourceUrl) return null
  const headers = normalizeEuLdtHeaders(input.sourceHeaders ?? input.source_headers ?? {})
  const result = await fetchEuLdtJson(sourceUrl, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(Number(input.sourceTimeoutMs ?? input.source_timeout_ms ?? 15000)),
  })
  if (!result.ok) throw new Error(`MARKETPLACE_SOURCE_FETCH_FAILED:${result.status}`)
  return result.body
}

function buildMarketplaceMultipart({ filename, content, contentType = 'application/json' }) {
  const form = new FormData()
  form.append('file', new Blob([content], { type: contentType }), filename)
  return form
}

async function uploadMarketplacePackage({ profileTarget, input, filename, packageContent }) {
  const headers = {
    ...(profileTarget.headers ?? {}),
    ...(input.agentHeaders ?? input.agent_headers ?? {}),
  }
  delete headers['Content-Type']
  delete headers['content-type']
  const form = buildMarketplaceMultipart({
    filename,
    content: packageContent,
    contentType: 'application/json',
  })
  const response = await fetch(profileTarget.endpoint, {
    method: 'POST',
    headers,
    body: form,
    signal: AbortSignal.timeout(Number(input.uploadTimeoutMs ?? input.upload_timeout_ms ?? 30000)),
  })
  const text = await response.text()
  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: text.slice(0, 2000) }
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body,
  }
}

async function publishMarketplaceOffering({ profileTarget, input, profile, assetId, packagePayload }) {
  const headers = normalizeEuLdtHeaders({
    ...(profileTarget.headers ?? {}),
    ...(input.agentHeaders ?? input.agent_headers ?? {}),
  })
  const categories = await resolveMarketplaceCategoryIds({
    profileTarget,
    input,
    headers,
    categories: normalizeMarketplaceCategories(input, profile),
  })
  const licence = normalizeText(input.licence ?? input.license ?? profile?.metadata?.defaultLicence ?? profile?.metadata?.default_licence, packagePayload.licence)
  const publishBody = {
    name: normalizeText(input.offeringName ?? input.offering_name ?? input.title, packagePayload.title),
    description: normalizeText(input.offeringDescription ?? input.offering_description ?? input.description, packagePayload.description),
    categories,
    licence,
    productSpecCharacteristic: [
      {
        name: 'oldtPackageType',
        description: 'OLDT Marketplace package type',
        valueType: 'string',
        productSpecCharacteristicValue: [{ value: packagePayload.packageType, isDefault: true }],
      },
      {
        name: 'oldtCompatibilityTargets',
        description: 'Declared compatibility targets',
        valueType: 'string',
        productSpecCharacteristicValue: [{ value: packagePayload.compatibility.targets.join(','), isDefault: true }],
      },
    ],
  }
  const price = input.price ?? input.offeringPrice ?? input.offering_price
  if (price !== undefined && price !== null && String(price).trim() !== '') publishBody.price = Number(price)
  return fetchEuLdtJson(`${profileTarget.endpoint.replace(/\/+$/, '')}/${encodeURIComponent(assetId)}/publish`, {
    method: 'POST',
    headers,
    body: JSON.stringify(publishBody),
    signal: AbortSignal.timeout(Number(input.publishTimeoutMs ?? input.publish_timeout_ms ?? 30000)),
  })
}

function marketplaceHubApiUrl(profileTarget, input = {}) {
  return normalizeOptionalHttpUrl(
    input.marketplaceApiUrl
      ?? input.marketplace_api_url
      ?? profileTarget.profile?.endpoints?.marketplaceApiUrl
      ?? profileTarget.profile?.endpoints?.marketplace_api_url
      ?? profileTarget.profile?.metadata?.marketplaceApiUrl
      ?? profileTarget.profile?.metadata?.marketplace_api_url,
  )
}

async function marketplaceHubHeaders(profileTarget, input = {}) {
  const headers = normalizeEuLdtHeaders({
    ...(profileTarget.purposeHeaders?.marketplaceHub ?? {}),
    ...(profileTarget.profile?.metadata?.marketplaceHeaders ?? profileTarget.profile?.metadata?.marketplace_headers ?? {}),
    ...(input.marketplaceHeaders ?? input.marketplace_headers ?? {}),
  })
  if (headers.Authorization || headers.authorization) return headers
  const auth = input.marketplaceAuth
    ?? input.marketplace_auth
    ?? profileTarget.profile?.metadata?.marketplaceAuth
    ?? profileTarget.profile?.metadata?.marketplace_auth
    ?? { type: 'none' }
  const authType = normalizeText(auth?.type, 'none').toLowerCase()
  if (authType === 'none') return headers
  if (authType === 'bearer') {
    const token = normalizeText(auth?.token)
    if (!token) throw new Error('MARKETPLACE_HUB_BEARER_TOKEN_MISSING')
    return { ...headers, Authorization: `Bearer ${token}` }
  }
  if (authType !== 'oauth2-client-credentials') {
    throw new Error(`MARKETPLACE_HUB_AUTH_TYPE_UNSUPPORTED:${authType}`)
  }
  const tokenUrl = normalizeOptionalHttpUrl(auth?.tokenUrl ?? auth?.token_url)
  const clientId = normalizeText(auth?.clientId ?? auth?.client_id)
  const clientSecret = normalizeText(auth?.clientSecret ?? auth?.client_secret)
  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error('MARKETPLACE_HUB_OAUTH2_CLIENT_CREDENTIALS_INCOMPLETE')
  }
  const body = new URLSearchParams()
  body.set('grant_type', 'client_credentials')
  body.set('client_id', clientId)
  body.set('client_secret', clientSecret)
  if (auth?.scope) body.set('scope', String(auth.scope))
  const tokenResult = await fetchEuLdtJson(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(Number(auth?.timeoutMs ?? auth?.timeout_ms ?? 15000)),
  })
  if (!tokenResult.ok) throw new Error(`MARKETPLACE_HUB_OAUTH2_TOKEN_HTTP_${tokenResult.status}`)
  const accessToken = normalizeText(tokenResult.body?.access_token)
  if (!accessToken) throw new Error('MARKETPLACE_HUB_OAUTH2_ACCESS_TOKEN_MISSING')
  return { ...headers, Authorization: `Bearer ${accessToken}` }
}

function marketplaceHubOrganization(profileTarget, input = {}) {
  return normalizeText(
    input.marketplaceOrganization
      ?? input.marketplace_organization
      ?? profileTarget.profile?.metadata?.marketplaceOrganization
      ?? profileTarget.profile?.metadata?.marketplace_organization,
    '',
  )
}

function publishStateFromMarketplacePublish(body = {}) {
  return body?.publishState ?? body?.publish_state ?? body?.marketplace ?? {}
}

async function patchMarketplaceLifecycle({ marketplaceApiUrl, headers, path, id, lifecycleStatus = 'Launched', timeoutMs = 30000 }) {
  return fetchEuLdtJson(`${marketplaceApiUrl.replace(/\/+$/, '')}/${path}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ lifecycleStatus }),
    signal: AbortSignal.timeout(timeoutMs),
  })
}

async function launchMarketplaceOffering({ profileTarget, input, publishResult }) {
  const state = publishStateFromMarketplacePublish(publishResult.body)
  const offeringId = normalizeText(state.offering_id ?? state.offeringId)
  const productSpecId = normalizeText(state.prod_spec_id ?? state.product_spec_id ?? state.productSpecId)
  const resourceSpecId = normalizeText(state.res_spec_id ?? state.resource_spec_id ?? state.resourceSpecId)
  const marketplaceApiUrl = marketplaceHubApiUrl(profileTarget, input)
  const organization = marketplaceHubOrganization(profileTarget, input)
  const headers = await marketplaceHubHeaders(profileTarget, input)
  if (organization && !headers['X-Organization']) headers['X-Organization'] = organization
  if (!marketplaceApiUrl) {
    return { ok: false, skipped: true, error: 'MARKETPLACE_API_URL_MISSING', offeringId, productSpecId, resourceSpecId }
  }
  if (!headers.Authorization && !headers.authorization) {
    return { ok: false, skipped: true, error: 'MARKETPLACE_AUTHORIZATION_HEADER_MISSING', offeringId, productSpecId, resourceSpecId }
  }
  const timeoutMs = Number(input.marketplaceLaunchTimeoutMs ?? input.marketplace_launch_timeout_ms ?? 30000)
  const patches = []
  if (resourceSpecId) {
    patches.push({
      kind: 'resourceSpecification',
      id: resourceSpecId,
      ...(await patchMarketplaceLifecycle({
        marketplaceApiUrl,
        headers,
        path: 'resource/resourceSpecification',
        id: resourceSpecId,
        timeoutMs,
      })),
    })
  }
  if (productSpecId) {
    patches.push({
      kind: 'productSpecification',
      id: productSpecId,
      ...(await patchMarketplaceLifecycle({
        marketplaceApiUrl,
        headers,
        path: 'catalog/productSpecification',
        id: productSpecId,
        timeoutMs,
      })),
    })
  }
  if (offeringId) {
    patches.push({
      kind: 'productOffering',
      id: offeringId,
      ...(await patchMarketplaceLifecycle({
        marketplaceApiUrl,
        headers,
        path: 'catalog/productOffering',
        id: offeringId,
        timeoutMs,
      })),
    })
  }
  return {
    ok: patches.length > 0 && patches.every((entry) => entry.ok),
    skipped: false,
    offeringId,
    productSpecId,
    resourceSpecId,
    patches,
  }
}

async function resolveMarketplaceCategoryIds({ profileTarget, input, headers, categories }) {
  const unresolved = categories.map((entry) => normalizeText(entry)).filter(Boolean)
  if (unresolved.every((entry) => entry.startsWith('urn:ngsi-ld:category:'))) return unresolved
  const categoriesUrl = normalizeText(
    input.categoriesUrl
      ?? input.categories_url
      ?? profileTarget.profile?.endpoints?.categoriesUrl
      ?? profileTarget.profile?.endpoints?.categories_url,
    `${profileTarget.profile.baseUrl.replace(/\/+$/, '')}/api/v1/agent/categories`,
  )
  const result = await fetchEuLdtJson(categoriesUrl, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(Number(input.categoriesTimeoutMs ?? input.categories_timeout_ms ?? 15000)),
  })
  const available = Array.isArray(result.body) ? result.body : Array.isArray(result.body?.items) ? result.body.items : []
  if (!result.ok || available.length === 0) return unresolved
  const byId = new Map(available.map((category) => [normalizeText(category.id).toLowerCase(), category.id]))
  const byName = new Map(available.map((category) => [normalizeText(category.name).toLowerCase(), category.id]))
  return unresolved.map((category) => {
    const key = category.toLowerCase()
    return byId.get(key) ?? byName.get(key) ?? category
  })
}

async function verifyMarketplaceAgentMetadata({ profileTarget, input, assetId }) {
  const metadataUrl = normalizeText(
    input.metadataAssetsUrl
      ?? input.metadata_assets_url
      ?? profileTarget.profile?.endpoints?.metadataAssetsUrl
      ?? profileTarget.profile?.endpoints?.metadata_assets_url,
    `${profileTarget.profile.baseUrl.replace(/\/+$/, '')}/api/v1/agent/metadata/assets`,
  )
  const headers = {
    ...(profileTarget.headers ?? {}),
    ...(input.agentHeaders ?? input.agent_headers ?? {}),
  }
  try {
    const result = await fetchEuLdtJson(metadataUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(Number(input.metadataTimeoutMs ?? input.metadata_timeout_ms ?? 15000)),
    })
    const assets = Array.isArray(result.body)
      ? result.body
      : Array.isArray(result.body?.assets)
        ? result.body.assets
        : Array.isArray(result.body?.items)
          ? result.body.items
          : []
    return {
      ok: result.ok && assets.some((asset) => String(asset.id ?? asset.assetId ?? asset.asset_id) === String(assetId)),
      status: result.status,
      assetId,
      assetCount: assets.length,
      matched: assets.some((asset) => String(asset.id ?? asset.assetId ?? asset.asset_id) === String(assetId)),
      body: result.body,
    }
  } catch (error) {
    return {
      ok: false,
      status: 'fetch-failed',
      assetId,
      error: String(error?.message ?? 'MARKETPLACE_AGENT_METADATA_VERIFY_FAILED'),
    }
  }
}

function ngsiAttributeValue(entity, key) {
  const attribute = entity?.[key]
  if (attribute == null) return undefined
  if (Array.isArray(attribute)) return attribute.map((entry) => ngsiAttributeValue({ value: entry }, 'value'))
  if (typeof attribute !== 'object') return attribute
  if (Object.prototype.hasOwnProperty.call(attribute, 'value')) return attribute.value
  if (Object.prototype.hasOwnProperty.call(attribute, 'object')) return attribute.object
  return undefined
}

function normalizeEuLdtEntityList(body) {
  if (Array.isArray(body)) return body
  if (Array.isArray(body?.entities)) return body.entities
  if (Array.isArray(body?.data)) return body.data
  if (Array.isArray(body?.results)) return body.results
  return []
}

function normalizeModelOutputNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function defaultOutputKeyForModel(modelKey) {
  if (modelKey === 'eu-ldt-building-sap-xgboost') return 'sap-score'
  return 'model-output'
}

function modelOutputConfig(input = {}) {
  const modelKey = String(input.modelKey ?? input.model_key ?? 'eu-ldt-building-sap-xgboost').trim() || 'eu-ldt-building-sap-xgboost'
  const modelVersion = String(input.modelVersion ?? input.model_version ?? 'local-smoke').trim()
  const outputKey = String(input.outputKey ?? input.output_key ?? defaultOutputKeyForModel(modelKey)).trim()
  const sourceAttribute = String(input.sourceAttribute ?? input.source_attribute ?? 'sapScore').trim()
  const unit = String(input.unit ?? '').trim()
  return {
    modelKey,
    modelVersion,
    outputKey,
    sourceAttribute,
    unit,
  }
}

function numericFromObject(source, keys = []) {
  for (const key of keys) {
    const value = source?.[key]
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric
  }
  return null
}

function kservePredictions(body) {
  const output = Array.isArray(body?.outputs)
    ? body.outputs.find((entry) => entry?.name === 'predictions') ?? body.outputs[0]
    : null
  if (Array.isArray(output?.data)) return output.data.map((value) => Number(value))
  if (Array.isArray(body?.predictions)) return body.predictions.map((value) => Number(value))
  return []
}

function buildSapFeatureRow(row, { featurePolicy = 'strict', index = 0 } = {}) {
  const properties = row.properties && typeof row.properties === 'object' ? row.properties : {}
  const annualEnergyConsumption = numericFromObject(properties, [
    'annualEnergyConsumptionKwhM2',
    'annual_energy_consumption_kwh_m2',
    'Annual_Energy_Consumption(kWh/m2)',
    'energyConsumptionKwhM2',
    'energy_consumption_current',
  ])
  const annualCo2Emissions = numericFromObject(properties, [
    'annualCo2EmissionsKgM2',
    'annual_co2_emissions_kg_m2',
    'Annual_CO2_Emissions(kg/m2)',
    'co2EmissionsKgM2',
    'co2_emiss_curr_per_floor_area',
  ])
  const surfaceM2 = numericFromObject({
    ...properties,
    surface_m2_candidate: row.surface_m2_candidate,
  }, [
    'surfaceM2',
    'surface_m2',
    'Surface(m2)',
    'totalFloorAreaM2',
    'total_floor_area',
    'surface_m2_candidate',
  ])

  if (annualEnergyConsumption != null && annualCo2Emissions != null && surfaceM2 != null) {
    return {
      ok: true,
      values: [annualEnergyConsumption, annualCo2Emissions, surfaceM2],
      source: 'oldt-properties',
      warnings: [],
    }
  }

  if (featurePolicy === 'smoke-synthetic') {
    const syntheticSurface = surfaceM2 ?? Math.max(40, 55 + (index % 9) * 10)
    return {
      ok: true,
      values: [
        annualEnergyConsumption ?? 180 + (index % 8) * 31,
        annualCo2Emissions ?? 25 + (index % 7) * 6,
        syntheticSurface,
      ],
      source: 'smoke-synthetic',
      warnings: [
        {
          code: 'SMOKE_SYNTHETIC_FEATURES',
          missing: {
            annualEnergyConsumption: annualEnergyConsumption == null,
            annualCo2Emissions: annualCo2Emissions == null,
            surfaceM2: surfaceM2 == null,
          },
        },
      ],
    }
  }

  return {
    ok: false,
    values: [],
    source: 'missing',
    warnings: [
      {
        code: 'MODEL_FEATURES_MISSING',
        missing: {
          annualEnergyConsumption: annualEnergyConsumption == null,
          annualCo2Emissions: annualCo2Emissions == null,
          surfaceM2: surfaceM2 == null,
        },
      },
    ],
  }
}

async function upsertExternalEntityLink(client, {
  cityId,
  entityId,
  externalSystem = 'eu-ldt-data-platform',
  externalEntityId,
  externalType = '',
  externalScope = '',
  relationKind = 'same_as',
  lastPublishedAt = null,
  lastImportedAt = null,
  metadata = {},
}) {
  if (!cityId || !entityId || !externalEntityId) return null
  const result = await client.query(
    `
      INSERT INTO ldt_interop.external_entity_links (
        city_id,
        entity_id,
        external_system,
        external_entity_id,
        external_type,
        external_scope,
        relation_kind,
        last_published_at,
        last_imported_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      ON CONFLICT (external_system, external_entity_id)
      DO UPDATE SET
        city_id = EXCLUDED.city_id,
        entity_id = EXCLUDED.entity_id,
        external_type = EXCLUDED.external_type,
        external_scope = EXCLUDED.external_scope,
        relation_kind = EXCLUDED.relation_kind,
        status = 'active',
        last_published_at = COALESCE(EXCLUDED.last_published_at, ldt_interop.external_entity_links.last_published_at),
        last_imported_at = COALESCE(EXCLUDED.last_imported_at, ldt_interop.external_entity_links.last_imported_at),
        metadata = ldt_interop.external_entity_links.metadata || EXCLUDED.metadata,
        updated_at = now()
      RETURNING *
    `,
    [
      cityId,
      entityId,
      externalSystem,
      externalEntityId,
      externalType,
      externalScope,
      relationKind,
      lastPublishedAt,
      lastImportedAt,
      JSON.stringify(metadata ?? {}),
    ],
  )
  return result.rows[0] ?? null
}

function workflowApprovalTemplates(workflowKey) {
  const templates = {
    'open-data-city-bootstrap': [
      {
        approvalKey: 'run-open-data-refresh',
        policy: {
          requiredBeforeExecution: true,
          reason: 'Open data refresh can update catalog, provenance, inventory, and viewer aggregates.',
        },
      },
      {
        approvalKey: 'accept-source-quality-report',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'A city analyst must review coverage gaps before authority or production claims.',
        },
      },
    ],
    'phase14-open-data-workflow-runner': [
      {
        approvalKey: 'approve-open-data-workflow-run',
        policy: {
          requiredBeforeExecution: true,
          reason: 'Phase 14 workflow runs can enqueue data jobs, create artifacts, and refresh source-backed evidence.',
        },
      },
      {
        approvalKey: 'accept-provider-exchange-classification',
        policy: {
          requiredBeforeProviderAttachment: true,
          reason: 'Provider packages must be classified as receive-only, open-data-native, or hybrid before attachment.',
        },
      },
      {
        approvalKey: 'accept-extractor-validation-summary',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Extractor outputs must keep source and validation state visible before product claims.',
        },
      },
    ],
    'private-provider-validation': [
      {
        approvalKey: 'accept-private-data-for-validation',
        policy: {
          requiredBeforeExecution: true,
          reason: 'Private/provider data must be explicitly accepted before validation.',
        },
      },
      {
        approvalKey: 'publish-provider-evidence',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Provider evidence cannot enrich the public twin without approval.',
        },
      },
    ],
    'standards-publication-refresh': [
      {
        approvalKey: 'run-standards-refresh',
        policy: {
          requiredBeforeExecution: true,
          reason: 'Standards exports are public-facing API contracts.',
        },
      },
      {
        approvalKey: 'accept-versioned-publication',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Versioned publication must be approved before external use.',
        },
      },
    ],
    'eu-ldt-data-platform-publish': [
      {
        approvalKey: 'approve-external-eu-ldt-publication',
        policy: {
          requiredBeforeExecution: true,
          reason: 'Publishing to EU LDT Data Platform sends selected OLDT NGSI-LD records outside the local twin.',
        },
      },
      {
        approvalKey: 'accept-external-readback-evidence',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Operator must accept readback and replication evidence before claiming external publication quality.',
        },
      },
    ],
    'eu-ldt-data-platform-import-results': [
      {
        approvalKey: 'approve-external-eu-ldt-result-import',
        policy: {
          requiredBeforeExecution: true,
          reason: 'Importing Data Platform model results writes derived enrichment outputs into OLDT.',
        },
      },
      {
        approvalKey: 'accept-result-reconciliation-report',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Operator must accept mapped/unmapped result evidence before any publication refresh claims the imported outputs.',
        },
      },
    ],
    'eu-ldt-data-modeller-prepare-schema': [
      {
        approvalKey: 'approve-data-modeller-schema-registration',
        policy: {
          requiredBeforeExecution: true,
          reason: 'Schema registration sends a bounded structural sample to the selected external Data Modeller.',
        },
      },
      {
        approvalKey: 'accept-data-modeller-schema-evidence',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Operator must review the inferred fields and external schema readback; Data Modeller approval remains separate.',
        },
      },
    ],
    'eu-ldt-data-modeller-fixture-import': [
      {
        approvalKey: 'approve-data-modeller-fixture-import',
        policy: {
          requiredBeforeExecution: true,
          reason: 'Fixture generation calls an external Data Modeller and writes simulated values to OLDT enrichment outputs.',
        },
      },
      {
        approvalKey: 'accept-data-modeller-simulated-output-evidence',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Operator must confirm that imported values remain labelled simulated and are attached to the intended canonical entities.',
        },
      },
    ],
    'eu-ldt-cip-publish-metric-source': [
      {
        approvalKey: 'approve-cip-metric-publication',
        policy: {
          requiredBeforeExecution: true,
          reason: 'The workflow publishes an OLDT-derived metric through Data Platform and may configure a City Innovation Planner KPI datasource.',
        },
      },
      {
        approvalKey: 'accept-cip-binding-evidence',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'The operator must review the NGSI-LD readback, KPI datasource, and OLDT provenance binding.',
        },
      },
    ],
    'eu-ldt-cip-sync-measurements': [
      {
        approvalKey: 'approve-cip-measurement-sync',
        policy: {
          requiredBeforeExecution: true,
          reason: 'The workflow reads decision-level KPI measurements from City Innovation Planner and stores reconciled OLDT receipts.',
        },
      },
    ],
    'eu-ldt-cip-sync-initiatives': [
      {
        approvalKey: 'approve-cip-initiative-sync',
        policy: {
          requiredBeforeExecution: true,
          reason: 'The workflow reads planning initiatives and can attach explicit OLDT selection links without inferring spatial scope.',
        },
      },
    ],
    'eu-ldt-use-case-scenarios-roundtrip': [
      {
        approvalKey: 'approve-ucs-roundtrip-execution',
        policy: {
          requiredBeforeExecution: true,
          reason: 'The workflow publishes two scenario inputs and creates and executes external UCS resources through Data Platform, Airflow, and AI Notebook.',
        },
      },
      {
        approvalKey: 'accept-ucs-roundtrip-evidence',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'The operator must review both completed execution outputs and the OLDT provenance binding before claiming UCS interoperability.',
        },
      },
    ],
    'eu-ldt-data-space-publish': [
      {
        approvalKey: 'approve-data-space-query-publication',
        policy: {
          requiredBeforeExecution: true,
          reason: 'The publication exposes a bounded OLDT query package as an offer through the selected EDC provider.',
        },
      },
    ],
    'eu-ldt-data-space-query-exchange': [
      {
        approvalKey: 'approve-data-space-query-exchange',
        policy: {
          requiredBeforeExecution: true,
          reason: 'The exchange publishes a bounded OLDT query package to a configured EDC provider and negotiates it from a configured consumer.',
        },
      },
      {
        approvalKey: 'accept-data-space-transfer-evidence',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Operator must review the EDC agreement, transfer state, and OLDT checksum receipt before claiming data-space interoperability.',
        },
      },
    ],
    'eu-ldt-play-visualise-register-layer': [
      {
        approvalKey: 'approve-eu-ldt-visualise-layer-registration',
        policy: {
          requiredBeforeExecution: true,
          reason: 'Registering a Play & Visualise layer exposes an OLDT API source to an external visualisation client.',
        },
      },
      {
        approvalKey: 'accept-visualise-consumption-evidence',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Operator must accept feature-count, bounds, and auth-gate evidence before claiming visualisation integration quality.',
        },
      },
    ],
    'eu-ldt-marketplace-agent-publish': [
      {
        approvalKey: 'approve-eu-ldt-marketplace-publication',
        policy: {
          requiredBeforeExecution: true,
          reason: 'Publishing to a Marketplace Agent can expose OLDT data, model outputs, or semantic layers outside the local twin.',
        },
      },
      {
        approvalKey: 'accept-marketplace-publication-evidence',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Operator must accept package validation, Agent upload, and optional offering evidence before claiming Marketplace integration quality.',
        },
      },
    ],
    'vulnerability-clustering-readiness-demo': [
      {
        approvalKey: 'approve-vulnerability-readiness-demo',
        policy: {
          requiredBeforeExecution: true,
          reason: 'NEVULA readiness demo inspects territorial vulnerability inputs but must not be treated as real vulnerability analysis.',
        },
      },
      {
        approvalKey: 'accept-vulnerability-readiness-evidence',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Operator must accept missing ISV/indicator evidence before any follow-up clustering workflow is claimed.',
        },
      },
    ],
    'renovation-strategy-readiness-demo': [
      {
        approvalKey: 'approve-renovation-readiness-demo',
        policy: {
          requiredBeforeExecution: true,
          reason: 'Renova readiness demo inspects building data and may prepare synthetic package plans, but must not be treated as production renovation advice.',
        },
      },
      {
        approvalKey: 'accept-renovation-readiness-evidence',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Operator must accept readiness and missing-data evidence before any follow-up model workflow is claimed.',
        },
      },
    ],
    'external-model-enrichment-exchange': [
      {
        approvalKey: 'approve-external-model-enrichment',
        policy: {
          requiredBeforeExecution: true,
          reason: 'External model enrichment sends selected OLDT feature rows to a model endpoint and imports derived outputs.',
        },
      },
      {
        approvalKey: 'accept-enrichment-output-evidence',
        policy: {
          requiredBeforePublicationClaim: true,
          reason: 'Operator must accept model-output evidence before refreshing public standards or UI claims.',
        },
      },
    ],
  }
  return templates[workflowKey] ?? [
    {
      approvalKey: 'operator-approval',
      policy: {
        requiredBeforeExecution: true,
        reason: 'Unknown workflow requires explicit operator approval.',
      },
    },
  ]
}

async function workflowRunDetail(client, runId) {
  const runResult = await client.query(
    `
      SELECT run.*, definition.name AS workflow_name
      FROM ldt_ops.workflow_runs run
      LEFT JOIN ldt_ops.workflow_definitions definition ON definition.id = run.workflow_id
      WHERE run.id = $1
    `,
    [runId],
  )
  if (runResult.rowCount === 0) return null

  const steps = await client.query(
    `
      SELECT *
      FROM ldt_ops.workflow_steps
      WHERE run_id = $1
      ORDER BY step_order, step_key
    `,
    [runId],
  )
  const approvals = await client.query(
    `
      SELECT *
      FROM ldt_ops.workflow_approvals
      WHERE run_id = $1
      ORDER BY created_at, approval_key
    `,
    [runId],
  )
  const artifacts = await client.query(
    `
      SELECT *
      FROM ldt_ops.workflow_artifacts
      WHERE run_id = $1
      ORDER BY created_at DESC
    `,
    [runId],
  )

  return {
    ...normalizeWorkflowRun(runResult.rows[0]),
    steps: steps.rows.map(normalizeWorkflowStep),
    approvals: approvals.rows.map(normalizeWorkflowApproval),
    artifacts: artifacts.rows.map(normalizeWorkflowArtifact),
  }
}

async function updateWorkflowRunStatus(client, runId, status, output = {}, error = {}) {
  const result = await client.query(
    `
      UPDATE ldt_ops.workflow_runs
      SET
        status = $2,
        output = COALESCE(output, '{}'::jsonb) || $3::jsonb,
        error = $4::jsonb,
        started_at = CASE
          WHEN $2 IN ('running', 'succeeded', 'failed') THEN COALESCE(started_at, now())
          ELSE started_at
        END,
        finished_at = CASE
          WHEN $2 IN ('succeeded', 'failed') THEN now()
          ELSE finished_at
        END,
        updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [runId, status, JSON.stringify(output ?? {}), JSON.stringify(error ?? {})],
  )
  if (result.rowCount === 0) throw new Error('WORKFLOW_RUN_NOT_FOUND')
  return result.rows[0]
}

async function updateWorkflowStepStatus(client, runId, stepKey, status, output = {}, error = {}) {
  const result = await client.query(
    `
      UPDATE ldt_ops.workflow_steps
      SET
        status = $3,
        output = COALESCE(output, '{}'::jsonb) || $4::jsonb,
        error = $5::jsonb,
        started_at = CASE
          WHEN $3 IN ('running', 'succeeded', 'failed') THEN COALESCE(started_at, now())
          ELSE started_at
        END,
        finished_at = CASE
          WHEN $3 IN ('succeeded', 'failed') THEN now()
          ELSE finished_at
        END,
        updated_at = now()
      WHERE run_id = $1
        AND step_key = $2
      RETURNING *
    `,
    [runId, stepKey, status, JSON.stringify(output ?? {}), JSON.stringify(error ?? {})],
  )
  if (result.rowCount === 0) throw new Error(`WORKFLOW_STEP_NOT_FOUND:${stepKey}`)
  return result.rows[0]
}

async function recordWorkflowArtifact(client, {
  runId,
  stepId,
  cityId,
  artifactKind,
  artifactUri,
  mediaType = 'application/json',
  metadata = {},
}) {
  const existing = await client.query(
    `
      SELECT *
      FROM ldt_ops.workflow_artifacts
      WHERE run_id = $1
        AND artifact_uri = $2
      LIMIT 1
    `,
    [runId, artifactUri],
  )
  if (existing.rowCount > 0) return existing.rows[0]

  const result = await client.query(
    `
      INSERT INTO ldt_ops.workflow_artifacts (
        run_id,
        step_id,
        city_id,
        artifact_kind,
        artifact_uri,
        media_type,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *
    `,
    [runId, stepId, cityId, artifactKind, artifactUri, mediaType, JSON.stringify(metadata ?? {})],
  )
  return result.rows[0]
}

async function enqueuePhase14ProviderIngestionJob(client, { run, providerPackage, workerId }) {
  if (!providerPackage.layerKey) {
    return {
      ok: false,
      layerKey: providerPackage.layerKey,
      status: 'layer-key-required',
      error: 'LAYER_KEY_REQUIRED',
    }
  }

  const layerResult = await client.query(
    `
      SELECT
        ld.id,
        ld.key,
        ld.name,
        ld.provider_id,
        pc.id AS connector_id
      FROM public.layer_definitions ld
      LEFT JOIN public.provider_connectors pc
        ON pc.provider_id = ld.provider_id
        AND pc.connector_key = $3
      WHERE ld.city_id = $1
        AND ld.key = $2
      LIMIT 1
    `,
    [run.cityId, providerPackage.layerKey, providerPackage.connectorKey],
  )
  if (layerResult.rowCount === 0) {
    return {
      ok: false,
      layerKey: providerPackage.layerKey,
      status: 'layer-not-registered',
      error: 'LAYER_NOT_REGISTERED',
    }
  }

  const layer = layerResult.rows[0]
  const idempotencyKey = phase14ProviderJobIdempotencyKey(run, providerPackage)
  const validationReport = providerPackage.sourceValidation?.issues ?? []
  const shouldQueue = providerPackage.queueForExecution && providerPackage.sourceValidation?.canQueue === true
  const jobStatus = shouldQueue ? 'queued' : 'registered'
  const jobMode = shouldQueue ? 'queued' : 'registered'
  const jobResult = await client.query(
    `
      INSERT INTO public.layer_ingestion_jobs (
        city_id,
        provider_id,
        layer_id,
        connector_id,
        job_kind,
        requested_action,
        ingestion_mode,
        source_format,
        source_uri,
        status,
        submitted_by,
        validation_summary,
        stats,
        metadata,
        idempotency_key,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4,
        'provider-layer-ingestion',
        $5,
        $12,
        $6,
        $7,
        $13,
        $8,
        $9::jsonb,
        '{}'::jsonb,
        $10::jsonb,
        $11,
        now()
      )
      ON CONFLICT (city_id, layer_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
      DO UPDATE SET
        requested_action = EXCLUDED.requested_action,
        ingestion_mode = EXCLUDED.ingestion_mode,
        source_format = EXCLUDED.source_format,
        source_uri = EXCLUDED.source_uri,
        status = EXCLUDED.status,
        submitted_by = EXCLUDED.submitted_by,
        validation_summary = EXCLUDED.validation_summary,
        metadata = EXCLUDED.metadata,
        updated_at = now()
      RETURNING id, status, requested_action, source_format, source_uri, idempotency_key
    `,
    [
      run.cityId,
      providerPackage.providerKey || layer.provider_id,
      layer.id,
      layer.connector_id,
      providerPackage.action,
      providerPackage.sourceFormat,
      providerPackage.sourceUri,
      workerId,
      JSON.stringify({
        state: jobStatus,
        phase: '14',
        sourceState: providerPackage.sourceValidation?.sourceState ?? 'unknown',
        canQueue: providerPackage.sourceValidation?.canQueue === true,
        queueRequested: providerPackage.queueForExecution === true,
        action: providerPackage.action,
        sourceFormat: providerPackage.sourceFormat,
        reportCount: validationReport.length,
      }),
      JSON.stringify({
        ...(providerPackage.metadata ?? {}),
        workflowRunId: run.id,
        workflowKey: run.workflowKey,
        layerKey: providerPackage.layerKey,
        request: providerPackage,
        sourceValidation: providerPackage.sourceValidation ?? {},
      }),
      idempotencyKey,
      jobMode,
      jobStatus,
    ],
  )

  const job = jobResult.rows[0]
  return {
    ok: true,
    layerKey: providerPackage.layerKey,
    layerName: layer.name,
    providerId: providerPackage.providerKey || layer.provider_id,
    jobId: job.id,
    status: job.status,
    action: job.requested_action,
    sourceFormat: job.source_format,
    sourceUri: job.source_uri,
    idempotencyKey: job.idempotency_key,
    sourceValidation: providerPackage.sourceValidation ?? {},
    validationReport,
  }
}

async function registerPhase14ExtractorRun(client, {
  run,
  extractorKey,
  workerId,
  scenarioKey = 'baseline',
}) {
  const definition = await client.query(
    `
      SELECT *
      FROM ldt_environment.extractor_definitions
      WHERE extractor_key = $1
        AND enabled = true
      LIMIT 1
    `,
    [extractorKey],
  )
  if (definition.rowCount === 0) {
    return {
      extractorKey,
      ok: false,
      status: 'definition-missing',
      error: 'EXTRACTOR_DEFINITION_NOT_FOUND',
    }
  }

  const definitionRow = definition.rows[0]
  const runKey = `phase14-${run.id.slice(0, 8)}-${extractorKey}`
  const result = await client.query(
    `
      INSERT INTO ldt_environment.extractor_runs (
        extractor_id,
        extractor_key,
        city_id,
        workflow_run_id,
        run_key,
        scenario_key,
        status,
        source_status,
        requested_by,
        requested_by_kind,
        trigger_kind,
        input_summary,
        output_summary,
        validation_report
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        'registered',
        'source-required',
        $7,
        'workflow-worker',
        'workflow-run',
        $8::jsonb,
        $9::jsonb,
        $10::jsonb
      )
      ON CONFLICT (city_id, extractor_key, scenario_key, run_key)
      DO UPDATE SET
        workflow_run_id = EXCLUDED.workflow_run_id,
        status = EXCLUDED.status,
        source_status = EXCLUDED.source_status,
        requested_by = EXCLUDED.requested_by,
        requested_by_kind = EXCLUDED.requested_by_kind,
        trigger_kind = EXCLUDED.trigger_kind,
        input_summary = EXCLUDED.input_summary,
        output_summary = EXCLUDED.output_summary,
        validation_report = EXCLUDED.validation_report,
        error = '{}'::jsonb,
        updated_at = now()
      RETURNING *
    `,
    [
      definitionRow.id,
      extractorKey,
      run.cityId,
      run.id,
      runKey,
      scenarioKey,
      workerId,
      JSON.stringify({
        workflowRunId: run.id,
        sourcePlan: run.input?.sourcePlan ?? null,
        validationMode: run.input?.validationMode ?? 'phase14-runner',
      }),
      JSON.stringify({
        state: 'registered',
        nextAction: 'execute-extractor-worker',
        outputLayerKeys: definitionRow.output_layer_keys ?? [],
      }),
      JSON.stringify({
        ok: true,
        validationState: 'registered-no-heavy-data',
        sourceStatus: 'source-required',
      }),
    ],
  )
  return {
    ok: true,
    ...normalizeExtractorRun(result.rows[0]),
  }
}

export async function listAgenticWorkflowDefinitions() {
  return withClient(async (client) => {
    const activeKeys = activeWorkflowStorageKeys()
    const result = await client.query(`
      SELECT
        workflow_key,
        name,
        purpose,
        domain,
        lifecycle_status,
        default_mode,
        agent_policy,
        input_contract,
        output_contract,
        standards_mapping,
        updated_at
      FROM ldt_ops.workflow_definitions
      WHERE workflow_key = ANY($1::text[])
      ORDER BY domain, workflow_key
    `, [activeKeys])

    return {
      configured: true,
      ok: true,
      workflows: result.rows.map((row) => ({
        workflowKey: canonicalWorkflowKey(row.workflow_key),
        storageWorkflowKey: row.workflow_key,
        name: row.name,
        purpose: row.purpose,
        domain: row.domain,
        lifecycleStatus: row.lifecycle_status,
        defaultMode: row.default_mode,
        agentPolicy: row.agent_policy,
        inputContract: row.input_contract,
        outputContract: row.output_contract,
        standardsMapping: row.standards_mapping,
        updatedAt: row.updated_at,
      })),
      error: null,
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    workflows: [],
    error: String(error?.message ?? 'WORKFLOW_DEFINITIONS_UNAVAILABLE'),
  }))
}

export async function executePhase14WorkflowRunOnce({ runId, workerId = 'phase14-workflow-runner' } = {}) {
  if (!runId) {
    return {
      configured: true,
      ok: false,
      run: null,
      extractorRuns: [],
      artifacts: [],
      error: 'WORKFLOW_RUN_ID_REQUIRED',
    }
  }

  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const initialRun = await workflowRunDetail(client, runId)
      if (!initialRun) throw new Error('WORKFLOW_RUN_NOT_FOUND')
      if (initialRun.workflowKey !== 'phase14-open-data-workflow-runner') {
        throw new Error('PHASE14_WORKFLOW_RUN_REQUIRED')
      }
      if (!['queued', 'running'].includes(initialRun.status)) {
        throw new Error(`WORKFLOW_RUN_NOT_EXECUTABLE:${initialRun.status}`)
      }

      await updateWorkflowRunStatus(client, runId, 'running', {
        executor: workerId,
        phase: '14',
      })

      const run = await workflowRunDetail(client, runId)
      const stepByKey = new Map(run.steps.map((step) => [step.stepKey, step]))
      const providerPackages = Array.isArray(run.input?.providerPackages)
        ? run.input.providerPackages.map(normalizePhase14ProviderPackage)
        : []
      const refreshPlan = {
        consolidation: run.input?.refreshConsolidation === true,
        viewerAggregates: run.input?.refreshViewerAggregates === true,
        twinQuerySurfaces: run.input?.refreshTwinQuerySurfaces === true,
        executionState: 'scheduled-after-worker-success',
      }
      const workerCapability = await inspectProviderIngestionCapabilities()
      const extractorKeys = Array.isArray(run.input?.extractorKeys) && run.input.extractorKeys.length > 0
        ? run.input.extractorKeys.map((key) => String(key).trim()).filter(Boolean)
        : ['terrain-dem', 'weather-field', 'hydrology-grid']
      const isSmokeRun = run.input?.smoke === true || String(run.input?.validationMode ?? '').includes('smoke')
      const refreshLayerKey = providerPackages.find((entry) => entry.layerKey)?.layerKey || 'buildings'
      if (refreshPlan.viewerAggregates || refreshPlan.twinQuerySurfaces) {
        providerPackages.push(normalizePhase14ProviderPackage({
          layerKey: refreshLayerKey,
          action: 'mvt-cache-refresh',
          sourceFormat: 'viewer-cache-refresh',
          posture: 'open-data-native',
          queueForExecution: !isSmokeRun,
          metadata: {
            generatedBy: 'phase14-open-data-workflow-runner',
            refreshPlan,
            gridKey: 'city-density-2km',
            cellSizeM: 2000,
          },
        }, providerPackages.length))
      }

      await updateWorkflowStepStatus(client, runId, 'prepare-run-context', 'succeeded', {
        cityId: run.cityId,
        workflowKey: run.workflowKey,
        workerId,
      })
      await updateWorkflowStepStatus(client, runId, 'validate-input-contract', 'succeeded', {
        sourcePlanPresent: Boolean(run.input?.sourcePlan),
        providerPackageCount: providerPackages.length,
        extractorKeyCount: extractorKeys.length,
        refreshPlan,
        workerCapability,
      })
      const boundaryGate = run.input?.boundaryGate ?? await assertPhase14BoundaryGate(run.cityId, run.input ?? {})
      await updateWorkflowStepStatus(client, runId, 'resolve-source-plan', 'succeeded', {
        sourcePlan: run.input?.sourcePlan ?? null,
        boundaryGate,
      })

      const providerJobs = []
      for (const providerPackage of providerPackages) {
        providerJobs.push(await enqueuePhase14ProviderIngestionJob(client, {
          run,
          providerPackage,
          workerId,
        }))
      }
      const bootstrapStep = await updateWorkflowStepStatus(client, runId, 'enqueue-open-data-bootstrap', 'succeeded', {
        providerPackageCount: providerPackages.length,
        providerJobCount: providerJobs.filter((entry) => entry.ok).length,
        queuedProviderJobCount: providerJobs.filter((entry) => entry.status === 'queued').length,
        packages: providerPackages,
        providerJobs,
      })
      await updateWorkflowStepStatus(client, runId, 'validate-provider-exchange-package', 'succeeded', {
        packages: providerPackages,
        providerJobs,
        acceptedPostures: ['receive-only', 'open-data-native', 'hybrid'],
      })

      const extractorRuns = []
      for (const extractorKey of extractorKeys) {
        extractorRuns.push(await registerPhase14ExtractorRun(client, {
          run,
          extractorKey,
          workerId,
        }))
      }
      await updateWorkflowStepStatus(client, runId, 'register-environmental-extractor-runs', 'succeeded', {
        extractorRuns,
      })

      const artifactSpecs = [
        {
          artifactKind: 'source-plan',
          stepKey: 'resolve-source-plan',
          metadata: { sourcePlan: run.input?.sourcePlan ?? null },
        },
        {
          artifactKind: 'provider-exchange-classification',
          stepKey: 'validate-provider-exchange-package',
          metadata: { packages: providerPackages, providerJobs },
        },
        {
          artifactKind: 'extractor-validation-summary',
          stepKey: 'register-environmental-extractor-runs',
          metadata: { extractorRuns },
        },
        {
          artifactKind: 'post-job-refresh-plan',
          stepKey: 'write-artifact-and-validation-records',
          metadata: { refreshPlan, workerCapability },
        },
        {
          artifactKind: 'operator-inspection-summary',
          stepKey: 'publish-workspace-run-summary',
          metadata: {
            sourceStates: providerPackages.map((entry) => ({ layerKey: entry.layerKey, sourceValidation: entry.sourceValidation })),
            providerJobs: providerJobs.map((entry) => ({ layerKey: entry.layerKey, status: entry.status, jobId: entry.jobId ?? null, sourceValidation: entry.sourceValidation ?? {} })),
            extractorRuns: extractorRuns.map((entry) => ({ extractorKey: entry.extractorKey, status: entry.status, sourceStatus: entry.sourceStatus })),
          },
        },
        {
          artifactKind: 'workspace-run-summary',
          stepKey: 'publish-workspace-run-summary',
          metadata: {
            cityId: run.cityId,
            workflowKey: run.workflowKey,
            providerPackageCount: providerPackages.length,
            extractorRunCount: extractorRuns.filter((entry) => entry.ok).length,
            refreshPlan,
            workerCapability,
          },
        },
      ]
      const artifacts = []
      for (const spec of artifactSpecs) {
        const step = stepByKey.get(spec.stepKey) ?? bootstrapStep
        artifacts.push(await recordWorkflowArtifact(client, {
          runId,
          stepId: step?.id ?? null,
          cityId: run.cityId,
          artifactKind: spec.artifactKind,
          artifactUri: phase14ArtifactUri(runId, spec.artifactKind),
          metadata: {
            phase: '14',
            workflowRunId: runId,
            ...spec.metadata,
          },
        }))
      }

      await updateWorkflowStepStatus(client, runId, 'write-artifact-and-validation-records', 'succeeded', {
        artifactCount: artifacts.length,
        artifactKinds: artifacts.map((artifact) => artifact.artifact_kind),
      })
      await updateWorkflowStepStatus(client, runId, 'publish-workspace-run-summary', 'succeeded', {
        status: 'succeeded',
        message: 'Open data import workflow registered source plan, provider classification, extractor runs, refresh plan, and inspection artifacts.',
        refreshPlan,
      })

      await updateWorkflowRunStatus(client, runId, 'succeeded', {
        phase: '14',
        executor: workerId,
        providerPackages,
        providerJobs,
        extractorRuns,
        refreshPlan,
        workerCapability,
        artifacts: artifacts.map(normalizeWorkflowArtifact),
      })

      await client.query('COMMIT')
      return {
        configured: true,
        ok: true,
        run: await workflowRunDetail(client, runId),
        extractorRuns,
        artifacts: artifacts.map(normalizeWorkflowArtifact),
        error: null,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      try {
        await updateWorkflowRunStatus(client, runId, 'failed', {}, {
          message: String(error?.message ?? 'PHASE14_WORKFLOW_EXECUTION_FAILED'),
        })
      } catch {}
      throw error
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    run: null,
    extractorRuns: [],
    artifacts: [],
    error: String(error?.message ?? 'PHASE14_WORKFLOW_EXECUTION_FAILED'),
  }))
}

export async function executeEuLdtDataPlatformPublishOnce({ runId, workerId = 'eu-ldt-data-platform-publisher' } = {}) {
  if (!runId) {
    return {
      configured: true,
      ok: false,
      run: null,
      artifacts: [],
      error: 'WORKFLOW_RUN_ID_REQUIRED',
    }
  }

  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const initialRun = await workflowRunDetail(client, runId)
      if (!initialRun) throw new Error('WORKFLOW_RUN_NOT_FOUND')
      if (initialRun.workflowKey !== 'eu-ldt-data-platform-publish') {
        throw new Error('EU_LDT_DATA_PLATFORM_WORKFLOW_RUN_REQUIRED')
      }
      if (!['queued', 'running'].includes(initialRun.status)) {
        throw new Error(`WORKFLOW_RUN_NOT_EXECUTABLE:${initialRun.status}`)
      }

      const input = initialRun.input ?? {}
      const target = await resolveEuLdtDataPlatformRunTarget(client, input)
      const endpoint = target.endpoint
      const externalSystem = target.externalSystem
      const type = String(input.type ?? input.entityType ?? input.entity_type ?? '').trim()
      const limit = normalizePositiveLimit(input.limit, 25, 100)
      const offset = Math.max(0, Number(input.offset) || 0)
      const dryRun = input.dryRun === true || input.dry_run === true
      const readbackEnabled = input.readback !== false
      const replicationCheckEnabled = input.replicationCheck !== false && input.replication_check !== false
      const headers = target.headers

      await updateWorkflowRunStatus(client, runId, 'running', {
        executor: workerId,
        externalSystem,
        integrationProfileKey: target.profileKey,
        integrationProfileName: target.displayName,
        endpoint,
        dryRun,
      })

      const run = await workflowRunDetail(client, runId)
      const stepByKey = new Map(run.steps.map((step) => [step.stepKey, step]))
      await updateWorkflowStepStatus(client, runId, 'prepare-run-context', 'succeeded', {
        cityId: run.cityId,
        workflowKey: run.workflowKey,
        workerId,
        externalSystem,
        integrationProfileKey: target.profileKey,
        integrationProfileName: target.displayName,
        endpoint,
        dryRun,
      })
      await updateWorkflowStepStatus(client, runId, 'validate-input-contract', 'succeeded', {
        endpoint,
        type: type || null,
        limit,
        offset,
        dryRun,
        readbackEnabled,
        replicationCheckEnabled,
        publicationPolicy: input.publicationPolicy ?? input.publication_policy ?? 'operator-approved-ngsi-projections',
      })

      const params = [run.cityId, limit, offset]
      const typeClause = type ? 'AND nem.ngsi_type = $4' : ''
      if (type) params.push(type)
      const selectedResult = await client.query(
        `
          SELECT
            ce.id AS entity_id,
            ce.stable_id,
            ce.entity_type,
            ce.authority_status,
            nem.ngsi_type,
            nep.ngsi_id,
            nep.ngsi_payload,
            nep.projected_at
          FROM ldt_interop.ngsi_entity_projections nep
          JOIN ldt_interop.ngsi_entity_mappings nem ON nem.id = nep.mapping_id
          JOIN ldt_core.city_entities ce ON ce.id = nep.entity_id
          WHERE ce.city_id = $1
            ${typeClause}
          ORDER BY nem.ngsi_type, ce.stable_id
          LIMIT $2
          OFFSET $3
        `,
        params,
      )
      const selectedEntities = selectedResult.rows.map((row) => ({
        entityId: row.entity_id,
        stableId: row.stable_id,
        entityType: row.entity_type,
        authorityStatus: row.authority_status,
        ngsiType: row.ngsi_type,
        ngsiId: row.ngsi_id,
        projectedAt: row.projected_at,
      }))
      if (selectedEntities.length === 0) {
        throw new Error('NO_NGSI_ENTITIES_SELECTED')
      }
      await updateWorkflowStepStatus(client, runId, 'select-publishable-entities', 'succeeded', {
        returned: selectedEntities.length,
        type: type || null,
        limit,
        offset,
        entities: selectedEntities,
      })

      const sanitizedPayloads = selectedResult.rows.map((row) => sanitizeEuLdtNgsiPayload(row.ngsi_payload))
      const payloads = sanitizedPayloads.map((entry) => entry.payload)
      const sanitizationReport = sanitizedPayloads.flatMap((entry, index) => entry.removed.map((removed) => ({ index, ...removed })))
      const validationIssues = payloads.flatMap((payload, index) => {
        const issues = []
        if (!payload || typeof payload !== 'object') issues.push({ index, code: 'PAYLOAD_NOT_OBJECT' })
        if (!payload?.id) issues.push({ index, code: 'NGSI_ID_REQUIRED' })
        if (!payload?.type) issues.push({ index, code: 'NGSI_TYPE_REQUIRED' })
        if (!payload?.['@context']) issues.push({ index, code: 'NGSI_CONTEXT_RECOMMENDED', severity: 'warning' })
        return issues
      })
      const blockingIssues = validationIssues.filter((issue) => issue.severity !== 'warning')
      if (blockingIssues.length > 0) {
        throw new Error(`NGSI_PAYLOAD_VALIDATION_FAILED:${blockingIssues.map((issue) => issue.code).join(',')}`)
      }
      await updateWorkflowStepStatus(client, runId, 'map-ngsi-ld-payloads', 'succeeded', {
        payloadCount: payloads.length,
        sanitizedAttributeCount: sanitizationReport.length,
        sanitizationReport,
        validationIssues,
      })

      const pushResults = []
      if (dryRun) {
        for (const payload of payloads) {
          pushResults.push({
            id: payload.id,
            type: payload.type,
            dryRun: true,
            ok: true,
            status: 'validated-not-sent',
          })
        }
      } else {
        for (const payload of payloads) {
          try {
            const result = await fetchEuLdtJson(`${endpoint}/api/v1/entities`, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload),
            })
            pushResults.push({
              id: payload.id,
              type: payload.type,
              ok: result.ok || result.status === 409,
              status: result.status,
              statusText: result.statusText,
              alreadyExisted: result.status === 409,
              body: result.body,
            })
          } catch (error) {
            pushResults.push({
              id: payload.id,
              type: payload.type,
              ok: false,
              status: 'fetch-failed',
              error: String(error?.message ?? 'EU_LDT_ENTITY_PUSH_REQUEST_FAILED'),
            })
          }
        }
      }
      const pushedCount = pushResults.filter((entry) => entry.ok).length
      const pushResultById = new Map(pushResults.map((entry) => [entry.id, entry]))
      const externalLinks = []
      if (!dryRun) {
        for (const entity of selectedEntities) {
          const pushResult = pushResultById.get(entity.ngsiId)
          if (!pushResult?.ok) continue
          const link = await upsertExternalEntityLink(client, {
            cityId: run.cityId,
            entityId: entity.entityId,
            externalSystem,
            externalEntityId: entity.ngsiId,
            externalType: entity.ngsiType,
            externalScope: String(input.scope ?? input.tenant ?? '').trim(),
            relationKind: 'same_as',
            lastPublishedAt: new Date().toISOString(),
            metadata: {
              workflowRunId: runId,
              workflowKey: run.workflowKey,
              externalSystem,
              integrationProfileKey: target.profileKey,
              integrationProfileName: target.displayName,
              stableId: entity.stableId,
              entityType: entity.entityType,
              projectedAt: entity.projectedAt,
              pushStatus: pushResult.status,
            },
          })
          if (link) externalLinks.push({
            externalEntityId: link.external_entity_id,
            entityId: link.entity_id,
            externalType: link.external_type,
            status: link.status,
          })
        }
      }
      await updateWorkflowStepStatus(client, runId, 'push-eu-ldt-data-platform', pushedCount > 0 ? 'succeeded' : 'failed', {
        dryRun,
        attempted: pushResults.length,
        succeeded: pushedCount,
        failed: pushResults.length - pushedCount,
        externalLinkCount: externalLinks.length,
        externalLinks,
        results: pushResults,
      }, pushedCount > 0 ? {} : { message: 'EU_LDT_ENTITY_PUSH_FAILED' })

      const readbackResults = []
      if (readbackEnabled && !dryRun) {
        for (const result of pushResults.filter((entry) => entry.ok)) {
          try {
            const readback = await fetchEuLdtJson(`${endpoint}/api/v1/entities/${encodeURIComponent(result.id)}`, {
              method: 'GET',
              headers,
            })
            readbackResults.push({
              id: result.id,
              ok: readback.ok,
              status: readback.status,
              statusText: readback.statusText,
              body: readback.body,
            })
          } catch (error) {
            readbackResults.push({
              id: result.id,
              ok: false,
              status: 'fetch-failed',
              error: String(error?.message ?? 'EU_LDT_ENTITY_READBACK_REQUEST_FAILED'),
            })
          }
        }
      }
      await updateWorkflowStepStatus(client, runId, 'verify-readback', 'succeeded', {
        enabled: readbackEnabled,
        dryRun,
        attempted: readbackResults.length,
        succeeded: readbackResults.filter((entry) => entry.ok).length,
        results: readbackResults,
      })

      let replicationCheck = { enabled: replicationCheckEnabled, dryRun, ok: dryRun, skipped: dryRun }
      if (replicationCheckEnabled && !dryRun) {
        try {
          replicationCheck = {
            enabled: true,
            dryRun: false,
            ...(await fetchEuLdtJson(`${endpoint}/api/v1/dstg/data-replication`, { method: 'GET', headers })),
          }
        } catch (error) {
          replicationCheck = {
            enabled: true,
            dryRun: false,
            ok: false,
            status: 'fetch-failed',
            error: String(error?.message ?? 'EU_LDT_REPLICATION_CHECK_REQUEST_FAILED'),
          }
        }
      }
      await updateWorkflowStepStatus(client, runId, 'check-replication-status', 'succeeded', {
        replicationCheck,
      })

      const summary = {
        cityId: run.cityId,
        externalSystem,
        integrationProfileKey: target.profileKey,
        integrationProfileName: target.displayName,
        endpoint,
        dryRun,
        selectedCount: selectedEntities.length,
        pushedCount,
        failedPushCount: pushResults.length - pushedCount,
        readbackSucceededCount: readbackResults.filter((entry) => entry.ok).length,
        replicationOk: replicationCheck.ok === true,
        publicationStatus: dryRun
          ? 'dry-run-validated'
          : pushedCount === 0
            ? 'external_publish_failed'
            : pushResults.length === pushedCount
              ? 'external_published'
              : 'external_published_partial',
        authorityStatus: 'candidate-or-derived-external-publication',
      }
      const artifactSpecs = [
        { artifactKind: 'selected_entities', stepKey: 'select-publishable-entities', metadata: { entities: selectedEntities } },
        { artifactKind: 'ngsi_payloads', stepKey: 'map-ngsi-ld-payloads', metadata: { payloads } },
        { artifactKind: 'validation_report', stepKey: 'map-ngsi-ld-payloads', metadata: { sanitizationReport, validationIssues } },
        { artifactKind: 'push_results', stepKey: 'push-eu-ldt-data-platform', metadata: { results: pushResults } },
        { artifactKind: 'readback_results', stepKey: 'verify-readback', metadata: { results: readbackResults } },
        { artifactKind: 'replication_check', stepKey: 'check-replication-status', metadata: { replicationCheck } },
        { artifactKind: 'external-publication-summary', stepKey: 'write-publication-artifacts', metadata: summary },
      ]
      const artifacts = []
      for (const spec of artifactSpecs) {
        const step = stepByKey.get(spec.stepKey) ?? stepByKey.get('write-publication-artifacts') ?? null
        artifacts.push(await recordWorkflowArtifact(client, {
          runId,
          stepId: step?.id ?? null,
          cityId: run.cityId,
          artifactKind: spec.artifactKind,
          artifactUri: workflowArtifactUri(runId, spec.artifactKind),
          metadata: {
            workflowRunId: runId,
            workflowKey: run.workflowKey,
            externalSystem,
            integrationProfileKey: target.profileKey,
            integrationProfileName: target.displayName,
            ...spec.metadata,
          },
        }))
      }
      await updateWorkflowStepStatus(client, runId, 'write-publication-artifacts', 'succeeded', {
        artifactCount: artifacts.length,
        artifactKinds: artifacts.map((artifact) => artifact.artifact_kind),
        summary,
      })
      const finalStatus = pushedCount > 0 ? 'succeeded' : 'failed'
      const finalError = finalStatus === 'failed' ? { message: 'EU_LDT_ENTITY_PUSH_FAILED' } : {}
      await updateWorkflowRunStatus(client, runId, finalStatus, {
        executor: workerId,
        externalSystem,
        integrationProfileKey: target.profileKey,
        integrationProfileName: target.displayName,
        summary,
        artifacts: artifacts.map(normalizeWorkflowArtifact),
      }, finalError)

      await client.query('COMMIT')
      const finalRun = await workflowRunDetail(client, runId)
      return {
        configured: true,
        ok: finalStatus === 'succeeded',
        run: finalRun,
        artifacts: artifacts.map(normalizeWorkflowArtifact),
        error: finalStatus === 'succeeded' ? null : 'EU_LDT_ENTITY_PUSH_FAILED',
      }
    } catch (error) {
      await client.query('ROLLBACK')
      try {
        await updateWorkflowRunStatus(client, runId, 'failed', {}, {
          message: String(error?.message ?? 'EU_LDT_DATA_PLATFORM_PUBLICATION_FAILED'),
        })
      } catch {}
      throw error
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    run: null,
    artifacts: [],
    error: String(error?.message ?? 'EU_LDT_DATA_PLATFORM_PUBLICATION_FAILED'),
  }))
}

export async function executeEuLdtDataPlatformImportResultsOnce({ runId, workerId = 'eu-ldt-data-platform-importer' } = {}) {
  if (!runId) {
    return {
      configured: true,
      ok: false,
      run: null,
      artifacts: [],
      error: 'WORKFLOW_RUN_ID_REQUIRED',
    }
  }

  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const initialRun = await workflowRunDetail(client, runId)
      if (!initialRun) throw new Error('WORKFLOW_RUN_NOT_FOUND')
      if (initialRun.workflowKey !== 'eu-ldt-data-platform-import-results') {
        throw new Error('EU_LDT_DATA_PLATFORM_IMPORT_WORKFLOW_RUN_REQUIRED')
      }
      if (!['queued', 'running'].includes(initialRun.status)) {
        throw new Error(`WORKFLOW_RUN_NOT_EXECUTABLE:${initialRun.status}`)
      }

      const input = initialRun.input ?? {}
      const target = await resolveEuLdtDataPlatformRunTarget(client, input)
      const endpoint = target.endpoint
      const externalSystem = target.externalSystem
      const type = String(input.type ?? input.entityType ?? input.entity_type ?? 'BuildingEnergyPerformance').trim() || 'BuildingEnergyPerformance'
      const limit = normalizePositiveLimit(input.limit, 25, 250)
      const headers = target.headers
      const sourceBatchId = String(input.sourceBatchId ?? input.source_batch_id ?? '').trim()
      const allowUnmapped = input.allowUnmapped === true || input.allow_unmapped === true
      const outputConfig = modelOutputConfig(input)

      await updateWorkflowRunStatus(client, runId, 'running', {
        executor: workerId,
        externalSystem,
        integrationProfileKey: target.profileKey,
        integrationProfileName: target.displayName,
        endpoint,
        importType: type,
      })

      const run = await workflowRunDetail(client, runId)
      const stepByKey = new Map(run.steps.map((step) => [step.stepKey, step]))
      await updateWorkflowStepStatus(client, runId, 'prepare-run-context', 'succeeded', {
        cityId: run.cityId,
        workflowKey: run.workflowKey,
        workerId,
        externalSystem,
        integrationProfileKey: target.profileKey,
        integrationProfileName: target.displayName,
        endpoint,
      })
      await updateWorkflowStepStatus(client, runId, 'validate-input-contract', 'succeeded', {
        endpoint,
        type,
        limit,
        sourceBatchId: sourceBatchId || null,
        allowUnmapped,
        outputConfig,
      })

      const query = new URLSearchParams()
      query.set('type', type)
      query.set('limit', String(limit))
      const readback = await fetchEuLdtJson(`${endpoint}/api/v1/entities?${query.toString()}`, {
        method: 'GET',
        headers,
      })
      if (!readback.ok) throw new Error(`EU_LDT_RESULT_READ_FAILED:${readback.status}`)
      const rawResults = normalizeEuLdtEntityList(readback.body)
      const externalResults = rawResults
        .filter((entity) => !sourceBatchId || String(entity?.id ?? '').includes(sourceBatchId) || String(ngsiAttributeValue(entity, 'sourceBatchId') ?? ngsiAttributeValue(entity, 'batchId') ?? '').includes(sourceBatchId))
        .slice(0, limit)
      await updateWorkflowStepStatus(client, runId, 'read-external-results', 'succeeded', {
        endpoint,
        type,
        limit,
        returned: rawResults.length,
        selected: externalResults.length,
        sourceBatchId: sourceBatchId || null,
        resultIds: externalResults.map((entity) => entity.id),
      })
      if (externalResults.length === 0) throw new Error('NO_EXTERNAL_RESULTS_SELECTED')

      const externalBuildingIds = [...new Set(externalResults.map((entity) => String(ngsiAttributeValue(entity, 'refBuilding') ?? '').trim()).filter(Boolean))]
      const linkResult = externalBuildingIds.length > 0
        ? await client.query(
          `
            SELECT *
            FROM ldt_interop.external_entity_links
            WHERE external_system = $3
              AND external_entity_id = ANY($1::text[])
              AND city_id = $2
              AND status = 'active'
          `,
          [externalBuildingIds, run.cityId, externalSystem],
        )
        : { rows: [] }
      const linkByExternalId = new Map(linkResult.rows.map((row) => [row.external_entity_id, row]))
      const reconciled = []
      const quarantine = []
      for (const entity of externalResults) {
        const refBuilding = String(ngsiAttributeValue(entity, 'refBuilding') ?? '').trim()
        const outputValue = ngsiAttributeValue(entity, outputConfig.sourceAttribute)
        const numericValue = normalizeModelOutputNumber(outputValue)
        const link = linkByExternalId.get(refBuilding)
        if (!refBuilding) {
          quarantine.push({ id: entity.id, reason: 'refBuilding_missing' })
          continue
        }
        if (!link) {
          quarantine.push({ id: entity.id, refBuilding, reason: 'refBuilding_unmapped' })
          continue
        }
        if (numericValue == null) {
          quarantine.push({ id: entity.id, refBuilding, reason: `${outputConfig.sourceAttribute}_not_numeric`, value: outputValue ?? null })
          continue
        }
        reconciled.push({
          externalResultId: entity.id,
          externalResultType: entity.type,
          refBuilding,
          entityId: link.entity_id,
          externalBuildingId: link.external_entity_id,
          outputValue: numericValue,
          rawEntity: entity,
        })
      }
      await updateWorkflowStepStatus(client, runId, 'reconcile-external-ids', reconciled.length > 0 ? 'succeeded' : 'failed', {
        externalResultCount: externalResults.length,
        mappedCount: reconciled.length,
        quarantinedCount: quarantine.length,
        quarantine,
        mapped: reconciled.map((entry) => ({
          externalResultId: entry.externalResultId,
          refBuilding: entry.refBuilding,
          entityId: entry.entityId,
          outputValue: entry.outputValue,
        })),
      }, reconciled.length > 0 ? {} : { message: 'NO_MAPPED_EXTERNAL_RESULTS' })
      if (reconciled.length === 0 && !allowUnmapped) throw new Error('NO_MAPPED_EXTERNAL_RESULTS')

      const imported = []
      for (const entry of reconciled) {
        const insertResult = await client.query(
          `
            INSERT INTO ldt_enrichment.entity_model_outputs (
              city_id,
              entity_id,
              workflow_run_id,
              model_key,
              model_version,
              output_key,
              status,
              value_numeric,
              value_json,
              unit,
              confidence,
              authority_status,
              method,
              input_sources,
              warnings,
              generated_at
            )
            VALUES (
              $1, $2, $3, $4, $5, $6,
              'computed',
              $7,
              $8::jsonb,
              $9,
              'external-platform-derived',
              'derived-model-output',
              $10::jsonb,
              $11::jsonb,
              $12::jsonb,
              now()
            )
            RETURNING id, city_id, entity_id, model_key, model_version, output_key, value_numeric, generated_at
          `,
          [
            run.cityId,
            entry.entityId,
            runId,
            outputConfig.modelKey,
            outputConfig.modelVersion,
            outputConfig.outputKey,
            entry.outputValue,
            JSON.stringify({
              value: entry.outputValue,
              sourceAttribute: outputConfig.sourceAttribute,
              externalResultId: entry.externalResultId,
              externalResultType: entry.externalResultType,
            }),
            outputConfig.unit || null,
            JSON.stringify({
              externalSystem,
              integrationProfileKey: target.profileKey,
              integrationProfileName: target.displayName,
              importWorkflowRunId: runId,
              sourceAttribute: outputConfig.sourceAttribute,
              endpoint,
            }),
            JSON.stringify([
              {
                kind: 'external-ngsi-ld-result',
                externalSystem,
                integrationProfileKey: target.profileKey,
                externalResultId: entry.externalResultId,
                refBuilding: entry.refBuilding,
              },
            ]),
            JSON.stringify([]),
          ],
        )
        const output = insertResult.rows[0]
        await upsertExternalEntityLink(client, {
          cityId: run.cityId,
          entityId: entry.entityId,
          externalSystem,
          externalEntityId: entry.externalResultId,
          externalType: entry.externalResultType,
          externalScope: String(input.scope ?? input.tenant ?? '').trim(),
          relationKind: 'derived_from',
          lastImportedAt: new Date().toISOString(),
          metadata: {
            workflowRunId: runId,
            externalSystem,
            integrationProfileKey: target.profileKey,
            integrationProfileName: target.displayName,
            modelOutputId: output.id,
            refBuilding: entry.refBuilding,
            modelKey: outputConfig.modelKey,
            outputKey: outputConfig.outputKey,
          },
        })
        imported.push(output)
      }
      const indicatorMaterialization = await client.query(
        `
          INSERT INTO ldt_science.indicator_observations (
            city_id, indicator_id, geography_entity_id, observation_key,
            geography_level, observed_at, value, value_json, quality, unit,
            method, source_quality, metadata, updated_at
          )
          SELECT output.city_id, definition.id, output.entity_id,
            'oldt-indicator:' || output.city_id || ':' || definition.indicator_key || ':entity:' || output.entity_id,
            'entity', output.generated_at, output.value_numeric,
            jsonb_build_object('value', output.value_numeric, 'modelOutputId', output.id),
            output.confidence, COALESCE(output.unit, definition.unit),
            output.method || jsonb_build_object('modelKey', output.model_key, 'outputKey', output.output_key),
            output.authority_status,
            jsonb_build_object(
              'modelOutputId', output.id,
              'workflowRunId', output.workflow_run_id,
              'sourceArtifactId', output.source_artifact_id,
              'materializedBy', 'eu-ldt-data-platform-import-results'
            ), now()
          FROM ldt_enrichment.entity_model_outputs output
          JOIN ldt_science.indicator_definitions definition
            ON definition.active=true
            AND definition.source_mode='external'
            AND definition.model_key=output.model_key
            AND definition.output_key=output.output_key
          WHERE output.workflow_run_id=$1
            AND output.status='computed'
            AND output.value_numeric IS NOT NULL
          ON CONFLICT (observation_key) DO UPDATE SET
            observed_at=EXCLUDED.observed_at,
            value=EXCLUDED.value,
            value_json=EXCLUDED.value_json,
            quality=EXCLUDED.quality,
            unit=EXCLUDED.unit,
            method=EXCLUDED.method,
            source_quality=EXCLUDED.source_quality,
            metadata=EXCLUDED.metadata,
            updated_at=now()
          RETURNING id, indicator_id, geography_entity_id, value
        `,
        [runId],
      )
      await updateWorkflowStepStatus(client, runId, imported.length > 0 ? 'import-model-outputs' : 'import-model-outputs', imported.length > 0 ? 'succeeded' : 'failed', {
        importedCount: imported.length,
        imported,
        indicatorObservationCount: indicatorMaterialization.rowCount,
        indicatorObservations: indicatorMaterialization.rows,
      }, imported.length > 0 ? {} : { message: 'NO_MODEL_OUTPUTS_IMPORTED' })

      const summary = {
        cityId: run.cityId,
        externalSystem,
        integrationProfileKey: target.profileKey,
        integrationProfileName: target.displayName,
        endpoint,
        type,
        selectedCount: externalResults.length,
        mappedCount: reconciled.length,
        quarantinedCount: quarantine.length,
        importedCount: imported.length,
        indicatorObservationCount: indicatorMaterialization.rowCount,
        modelKey: outputConfig.modelKey,
        modelVersion: outputConfig.modelVersion,
        outputKey: outputConfig.outputKey,
        authorityStatus: 'derived-model-output',
        publicationStatus: 'refresh_required',
      }
      const artifactSpecs = [
        { artifactKind: 'external-result-readback', stepKey: 'read-external-results', metadata: { resultIds: externalResults.map((entity) => entity.id), results: externalResults } },
        { artifactKind: 'reconciliation-report', stepKey: 'reconcile-external-ids', metadata: { mapped: reconciled.map((entry) => ({ externalResultId: entry.externalResultId, entityId: entry.entityId, refBuilding: entry.refBuilding })), quarantine } },
        { artifactKind: 'imported-model-outputs', stepKey: 'import-model-outputs', metadata: { imported } },
        { artifactKind: 'quarantine-report', stepKey: 'reconcile-external-ids', metadata: { quarantine } },
        { artifactKind: 'external-import-summary', stepKey: 'write-import-artifacts', metadata: summary },
      ]
      const artifacts = []
      for (const spec of artifactSpecs) {
        const step = stepByKey.get(spec.stepKey) ?? stepByKey.get('write-import-artifacts') ?? null
        artifacts.push(await recordWorkflowArtifact(client, {
          runId,
          stepId: step?.id ?? null,
          cityId: run.cityId,
          artifactKind: spec.artifactKind,
          artifactUri: workflowArtifactUri(runId, spec.artifactKind),
          metadata: {
            workflowRunId: runId,
            workflowKey: run.workflowKey,
            externalSystem,
            integrationProfileKey: target.profileKey,
            integrationProfileName: target.displayName,
            ...spec.metadata,
          },
        }))
      }
      await updateWorkflowStepStatus(client, runId, 'write-import-artifacts', 'succeeded', {
        artifactCount: artifacts.length,
        artifactKinds: artifacts.map((artifact) => artifact.artifact_kind),
        summary,
      })

      const finalStatus = imported.length > 0 ? 'succeeded' : 'failed'
      await updateWorkflowRunStatus(client, runId, finalStatus, {
        executor: workerId,
        externalSystem,
        integrationProfileKey: target.profileKey,
        integrationProfileName: target.displayName,
        summary,
        artifacts: artifacts.map(normalizeWorkflowArtifact),
      }, finalStatus === 'succeeded' ? {} : { message: 'EU_LDT_DATA_PLATFORM_IMPORT_NO_OUTPUTS' })

      await client.query('COMMIT')
      return {
        configured: true,
        ok: finalStatus === 'succeeded',
        run: await workflowRunDetail(client, runId),
        artifacts: artifacts.map(normalizeWorkflowArtifact),
        imported,
        quarantine,
        error: finalStatus === 'succeeded' ? null : 'EU_LDT_DATA_PLATFORM_IMPORT_NO_OUTPUTS',
      }
    } catch (error) {
      await client.query('ROLLBACK')
      try {
        await updateWorkflowRunStatus(client, runId, 'failed', {}, {
          message: String(error?.message ?? 'EU_LDT_DATA_PLATFORM_IMPORT_FAILED'),
        })
      } catch {}
      throw error
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    run: null,
    artifacts: [],
    imported: [],
    quarantine: [],
    error: String(error?.message ?? 'EU_LDT_DATA_PLATFORM_IMPORT_FAILED'),
  }))
}

export async function executeEuLdtPlayVisualiseRegisterLayerOnce({ runId, workerId = 'eu-ldt-play-visualise-registrar' } = {}) {
  if (!runId) {
    return {
      configured: true,
      ok: false,
      run: null,
      artifacts: [],
      error: 'WORKFLOW_RUN_ID_REQUIRED',
    }
  }

  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const initialRun = await workflowRunDetail(client, runId)
      if (!initialRun) throw new Error('WORKFLOW_RUN_NOT_FOUND')
      if (initialRun.workflowKey !== 'eu-ldt-play-visualise-register-layer') {
        throw new Error('EU_LDT_PLAY_VISUALISE_WORKFLOW_RUN_REQUIRED')
      }
      if (!['queued', 'running'].includes(initialRun.status)) {
        throw new Error(`WORKFLOW_RUN_NOT_EXECUTABLE:${initialRun.status}`)
      }

      const input = initialRun.input ?? {}
      const integrationProfileKey = normalizeText(
        input.integrationProfileKey ?? input.integration_profile_key,
        'local-eu-ldt-play-visualise',
      )
      const profileResult = await resolveEuLdtIntegrationTarget(client, integrationProfileKey, {
        platformKind: 'play-visualise',
        endpointKey: 'apiDocsUrl',
      })
      const profile = profileResult.profile
      const apiBaseUrl = normalizePlayVisualiseApiBase(profile, input)
      const databaseUrl = normalizePlayVisualiseDbUrl(profile, input)
      const registrationMode = playVisualiseMode(input)
      const collectionKey = normalizeOldtCollectionKey(input.collectionKey ?? input.collection_key ?? 'buildings')
      const limit = normalizePositiveLimit(input.limit, registrationMode === 'full-power' ? 1000 : 250, 1000)
      const cityPath = normalizeText(input.cityPath ?? input.city_path ?? input.cityId ?? input.city_id, 'current')
      const oldtBaseUrl = normalizeText(input.oldtBaseUrl ?? input.oldt_base_url, 'http://host.docker.internal:4292').replace(/\/+$/, '')
      const sourceUrlForCollection = (targetCollectionKey, targetLimit = limit) => `${oldtBaseUrl}/api/live/${encodeURIComponent(cityPath)}/standards/ogc/collections/${encodeURIComponent(targetCollectionKey)}/items?limit=${targetLimit}`
      const sourceUrl = normalizeText(
        input.sourceUrl ?? input.source_url,
        sourceUrlForCollection(collectionKey, limit),
      )
      const oldtCookie = await createLocalOldtCookie({ ...input, cityId: initialRun.cityId })
      const sourceHeaders = oldtCookie
        ? [{ key: 'Cookie', value: oldtCookie }]
        : Array.isArray(input.sourceHeaders ?? input.source_headers)
          ? (input.sourceHeaders ?? input.source_headers)
          : []
      const layerConfig = normalizePlayLayerConfig(input, collectionKey)
      const fullPowerConfig = registrationMode === 'full-power'
        ? normalizePlayVisualiseFullPowerConfig(input, sourceUrlForCollection)
        : null

      await updateWorkflowRunStatus(client, runId, 'running', {
        executor: workerId,
        integrationProfileKey: profile.profileKey,
        integrationProfileName: profile.displayName,
        externalSystem: `eu-ldt-play-visualise:${profile.profileKey}`,
        apiBaseUrl,
        sourceUrl,
        registrationMode,
      })

      const run = await workflowRunDetail(client, runId)
      const stepByKey = new Map(run.steps.map((step) => [step.stepKey, step]))
      await updateWorkflowStepStatus(client, runId, 'prepare-run-context', 'succeeded', {
        cityId: run.cityId,
        workflowKey: run.workflowKey,
        workerId,
      })
      await updateWorkflowStepStatus(client, runId, 'validate-input-contract', 'succeeded', {
        integrationProfileKey: profile.profileKey,
        collectionKey,
        limit,
        cityPath,
        registrationMode,
        datasourceName: fullPowerConfig ? fullPowerConfig.sources.map((source) => source.datasourceName).join(', ') : layerConfig.datasourceName,
        layerName: fullPowerConfig ? fullPowerConfig.layers.map((layer) => layer.layerName).join(', ') : layerConfig.layerName,
        mapName: fullPowerConfig?.mapName ?? layerConfig.mapName,
      })
      await updateWorkflowStepStatus(client, runId, 'resolve-visualise-profile', 'succeeded', {
        integrationProfileKey: profile.profileKey,
        displayName: profile.displayName,
        apiBaseUrl,
        databaseUrl: databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@'),
      })
      await updateWorkflowStepStatus(client, runId, 'prepare-oldt-source', 'succeeded', {
        sourceUrl,
        sources: fullPowerConfig?.sources?.map((source) => ({
          collectionKey: source.collectionKey,
          datasourceName: source.datasourceName,
          sourceUrl: source.sourceUrl,
        })) ?? [{ collectionKey, datasourceName: layerConfig.datasourceName, sourceUrl }],
        sourceHeaderKeys: sourceHeaders.map((header) => header.key).filter(Boolean),
        collectionKey,
        limit,
      })

      const registration = fullPowerConfig
        ? await upsertPlayVisualiseLayerSet({
          databaseUrl,
          mapName: fullPowerConfig.mapName,
          mapDescription: fullPowerConfig.mapDescription,
          sources: fullPowerConfig.sources,
          sourceHeaders,
          layers: fullPowerConfig.layers,
          plots: fullPowerConfig.plots,
          reports: fullPowerConfig.reports,
        })
        : await upsertPlayVisualiseLayer({
          databaseUrl,
          datasourceName: layerConfig.datasourceName,
          layerName: layerConfig.layerName,
          sourceUrl,
          sourceHeaders,
          layerType: layerConfig.layerType,
          layerConfiguration: layerConfig.configuration,
          mapName: layerConfig.mapName,
          mapDescription: layerConfig.mapDescription,
        })
      await updateWorkflowStepStatus(client, runId, 'register-visualise-datasource', 'succeeded', {
        datasource: registration.datasource,
        datasources: registration.datasources ?? [registration.datasource].filter(Boolean),
        sourceUrl,
      })
      await updateWorkflowStepStatus(client, runId, 'register-visualise-datalayer', 'succeeded', {
        datalayer: registration.datalayer,
        datalayers: registration.datalayers ?? [registration.datalayer].filter(Boolean),
        plots: registration.plots ?? [],
        reports: registration.reports ?? [],
        map: registration.map,
      })

      const headerObject = sourceHeaders.reduce((headers, entry) => {
        if (entry?.key && entry?.value) headers[entry.key] = entry.value
        return headers
      }, {})
      const sourceSpecs = fullPowerConfig?.sources ?? [{ key: collectionKey, collectionKey, datasourceName: layerConfig.datasourceName, sourceUrl }]
      const directReads = []
      for (const source of sourceSpecs) {
        const directRead = await fetchJsonForVisualiseVerification(source.sourceUrl, headerObject)
        const featureCollection = normalizeGeoJsonFeatureCollection(directRead.body)
        directReads.push({
          sourceKey: source.key,
          collectionKey: source.collectionKey,
          datasourceName: source.datasourceName,
          ok: directRead.ok,
          status: directRead.status,
          contentType: directRead.contentType,
          featureCount: featureCollection.features.length,
          bounds: featureBounds(featureCollection.features),
        })
      }

      const datalayersToVerify = registration.datalayers ?? [registration.datalayer].filter(Boolean)
      const updateLayerChecks = []
      for (const datalayer of datalayersToVerify) {
        try {
          const updateLayer = await fetchJsonForVisualiseVerification(`${apiBaseUrl}/dataLayers/${datalayer.id}/updateLayer?type=geo`, {})
          updateLayerChecks.push({
            datalayerId: datalayer.id,
            datalayerName: datalayer.name,
            ok: updateLayer.ok,
            status: updateLayer.status,
            contentType: updateLayer.contentType,
            featureCount: normalizeGeoJsonFeatureCollection(updateLayer.body?.data ?? updateLayer.body).features.length,
            errors: updateLayer.body?.errors ?? [],
          })
        } catch (error) {
          updateLayerChecks.push({
            datalayerId: datalayer.id,
            datalayerName: datalayer.name,
            ok: false,
            status: 'fetch-failed',
            error: String(error?.message ?? 'PLAY_VISUALISE_UPDATE_LAYER_CHECK_FAILED'),
          })
        }
      }

      const featureCount = directReads.reduce((total, entry) => total + entry.featureCount, 0)
      const bounds = directReads.find((entry) => entry.bounds)?.bounds ?? null
      const hasSourceFeatures = directReads.length > 0 && directReads.every((entry) => entry.featureCount > 0)
      const hasVisualiseFeatures = updateLayerChecks.length > 0 && updateLayerChecks.every((entry) => entry.featureCount > 0 && entry.ok !== false)
      await updateWorkflowStepStatus(client, runId, 'verify-visualise-consumption', hasSourceFeatures && hasVisualiseFeatures ? 'succeeded' : 'failed', {
        directReads,
        updateLayerChecks,
      }, hasSourceFeatures && hasVisualiseFeatures ? {} : { message: 'PLAY_VISUALISE_CONSUMPTION_CHECK_FAILED' })
      if (!hasSourceFeatures) throw new Error('PLAY_VISUALISE_SOURCE_READ_EMPTY')
      if (!hasVisualiseFeatures) throw new Error('PLAY_VISUALISE_UPDATE_LAYER_EMPTY')

      const summary = {
        cityId: run.cityId,
        integrationProfileKey: profile.profileKey,
        integrationProfileName: profile.displayName,
        externalSystem: `eu-ldt-play-visualise:${profile.profileKey}`,
        registrationMode,
        datasourceId: registration.datasource.id,
        datasourceName: registration.datasource.name,
        datalayerId: registration.datalayer.id,
        datalayerName: registration.datalayer.name,
        datasources: registration.datasources ?? [registration.datasource].filter(Boolean),
        datalayers: registration.datalayers ?? [registration.datalayer].filter(Boolean),
        plots: registration.plots ?? [],
        reports: registration.reports ?? [],
        mapId: registration.map?.id ?? null,
        mapName: registration.map?.name ?? fullPowerConfig?.mapName ?? layerConfig.mapName,
        sourceUrl,
        collectionKey,
        featureCount,
        bounds,
        directReads,
        updateLayerChecks,
        updateLayerStatus: updateLayerChecks[0]?.status ?? null,
        updateLayerOk: updateLayerChecks.every((entry) => entry.ok === true),
        publicationStatus: 'visualise-layer-registered',
        authorityStatus: 'external-visualisation-consumer',
      }
      const artifactSpecs = [
        { artifactKind: 'visualise-profile', stepKey: 'resolve-visualise-profile', metadata: { profile } },
        { artifactKind: 'visualise-source', stepKey: 'prepare-oldt-source', metadata: { sourceUrl, sources: sourceSpecs, sourceHeaderKeys: sourceHeaders.map((header) => header.key).filter(Boolean) } },
        { artifactKind: 'visualise-registration', stepKey: 'register-visualise-datalayer', metadata: registration },
        { artifactKind: 'visualise-consumption-check', stepKey: 'verify-visualise-consumption', metadata: { directReads, updateLayerChecks } },
        { artifactKind: 'visualise-registration-summary', stepKey: 'write-visualise-artifacts', metadata: summary },
      ]
      const artifacts = []
      for (const spec of artifactSpecs) {
        const step = stepByKey.get(spec.stepKey) ?? stepByKey.get('write-visualise-artifacts') ?? null
        artifacts.push(await recordWorkflowArtifact(client, {
          runId,
          stepId: step?.id ?? null,
          cityId: run.cityId,
          artifactKind: spec.artifactKind,
          artifactUri: workflowArtifactUri(runId, spec.artifactKind),
          metadata: {
            workflowRunId: runId,
            workflowKey: run.workflowKey,
            integrationProfileKey: profile.profileKey,
            externalSystem: `eu-ldt-play-visualise:${profile.profileKey}`,
            ...spec.metadata,
          },
        }))
      }
      await updateWorkflowStepStatus(client, runId, 'write-visualise-artifacts', 'succeeded', {
        artifactCount: artifacts.length,
        artifactKinds: artifacts.map((artifact) => artifact.artifact_kind),
        summary,
      })
      await updateWorkflowRunStatus(client, runId, 'succeeded', {
        executor: workerId,
        integrationProfileKey: profile.profileKey,
        integrationProfileName: profile.displayName,
        externalSystem: `eu-ldt-play-visualise:${profile.profileKey}`,
        summary,
        artifacts: artifacts.map(normalizeWorkflowArtifact),
      })

      await client.query('COMMIT')
      return {
        configured: true,
        ok: true,
        run: await workflowRunDetail(client, runId),
        artifacts: artifacts.map(normalizeWorkflowArtifact),
        summary,
        error: null,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      try {
        await updateWorkflowRunStatus(client, runId, 'failed', {}, {
          message: String(error?.message ?? 'EU_LDT_PLAY_VISUALISE_REGISTER_LAYER_FAILED'),
        })
      } catch {}
      throw error
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    run: null,
    artifacts: [],
    summary: null,
    error: String(error?.message ?? 'EU_LDT_PLAY_VISUALISE_REGISTER_LAYER_FAILED'),
  }))
}

export async function executeEuLdtMarketplaceAgentPublishOnce({ runId, workerId = 'eu-ldt-marketplace-agent-publisher' } = {}) {
  if (!runId) {
    return {
      configured: true,
      ok: false,
      run: null,
      artifacts: [],
      error: 'WORKFLOW_RUN_ID_REQUIRED',
    }
  }

  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const initialRun = await workflowRunDetail(client, runId)
      if (!initialRun) throw new Error('WORKFLOW_RUN_NOT_FOUND')
      if (initialRun.workflowKey !== 'eu-ldt-marketplace-agent-publish') {
        throw new Error('EU_LDT_MARKETPLACE_AGENT_WORKFLOW_RUN_REQUIRED')
      }
      if (!['queued', 'running'].includes(initialRun.status)) {
        throw new Error(`WORKFLOW_RUN_NOT_EXECUTABLE:${initialRun.status}`)
      }

      const input = initialRun.input ?? {}
      const profileKeys = normalizeMarketplaceProfileKeys(input)
      const publishToHub = input.publishToHub === true || input.publish_to_hub === true
      const launchInMarketplace = input.launchInMarketplace === true || input.launch_in_marketplace === true
      const dryRun = input.dryRun === true || input.dry_run === true

      await updateWorkflowRunStatus(client, runId, 'running', {
        executor: workerId,
        profileKeys,
        publishToHub,
        launchInMarketplace,
        dryRun,
      })

      const run = await workflowRunDetail(client, runId)
      const stepByKey = new Map(run.steps.map((step) => [step.stepKey, step]))
      await updateWorkflowStepStatus(client, runId, 'prepare-run-context', 'succeeded', {
        cityId: run.cityId,
        workflowKey: run.workflowKey,
        workerId,
        profileKeys,
        publishToHub,
        launchInMarketplace,
        dryRun,
      })
      await updateWorkflowStepStatus(client, runId, 'validate-input-contract', 'succeeded', {
        profileKeys,
        assetType: input.assetType ?? input.asset_type ?? input.type ?? 'oldt.semantic-layer',
        hasInlinePayload: Boolean(input.payload ?? input.data),
        sourceUrl: normalizeText(input.sourceUrl ?? input.source_url, '') || null,
        publishToHub,
        launchInMarketplace,
        dryRun,
      })

      const sourcePayload = input.payload || input.data ? null : await fetchMarketplaceSourcePayload(input)
      const packagePayload = buildMarketplacePackagePayload({ run, input, sourcePayload })
      const packageContent = JSON.stringify(packagePayload, null, 2)
      const filename = marketplacePackageFilename(input, packagePayload.packageType)
      const sha256 = createHash('sha256').update(packageContent).digest('hex')
      const byteSize = Buffer.byteLength(packageContent)

      await updateWorkflowStepStatus(client, runId, 'build-marketplace-package', 'succeeded', {
        filename,
        packageType: packagePayload.packageType,
        title: packagePayload.title,
        byteSize,
        sha256,
        compatibilityTargets: packagePayload.compatibility.targets,
      })

      const validation = validateMarketplacePackage(packagePayload)
      await updateWorkflowStepStatus(client, runId, 'validate-marketplace-package', validation.ok ? 'succeeded' : 'failed', {
        ok: validation.ok,
        issues: validation.issues,
        blocking: validation.blocking,
      }, validation.ok ? {} : { message: 'MARKETPLACE_PACKAGE_VALIDATION_FAILED' })
      if (!validation.ok) throw new Error(`MARKETPLACE_PACKAGE_VALIDATION_FAILED:${validation.blocking.map((issue) => issue.code).join(',')}`)

      const targets = []
      for (const profileKey of profileKeys) {
        const target = await resolveEuLdtIntegrationTarget(client, profileKey, {
          platformKind: 'marketplace-agent',
          endpointKey: 'assetsUrl',
          authPurposes: ['marketplaceHub'],
        })
        targets.push(marketplaceAgentEndpointOverride(target, input))
      }

      const uploadResults = []
      if (dryRun) {
        for (const target of targets) {
          uploadResults.push({
            profileKey: target.profileKey,
            displayName: target.displayName,
            endpoint: target.endpoint,
            ok: true,
            dryRun: true,
            status: 'validated-not-sent',
            body: {
              id: `dry-run-${target.profileKey}-${sha256.slice(0, 12)}`,
              fileName: filename,
              fileSize: byteSize,
              sha256Checksum: sha256,
            },
          })
        }
      } else {
        for (const target of targets) {
          const upload = await uploadMarketplacePackage({
            profileTarget: target,
            input,
            filename,
            packageContent,
          })
          uploadResults.push({
            profileKey: target.profileKey,
            displayName: target.displayName,
            endpoint: target.endpoint,
            ok: upload.ok,
            status: upload.status,
            statusText: upload.statusText,
            body: upload.body,
          })
        }
      }
      const uploadedCount = uploadResults.filter((entry) => entry.ok).length
      await updateWorkflowStepStatus(client, runId, 'upload-marketplace-agent-assets', uploadedCount === uploadResults.length ? 'succeeded' : 'failed', {
        attempted: uploadResults.length,
        succeeded: uploadedCount,
        failed: uploadResults.length - uploadedCount,
        results: uploadResults,
      }, uploadedCount === uploadResults.length ? {} : { message: 'MARKETPLACE_AGENT_UPLOAD_FAILED' })
      if (uploadedCount !== uploadResults.length) throw new Error('MARKETPLACE_AGENT_UPLOAD_FAILED')

      const publishResults = []
      if (publishToHub) {
        for (const upload of uploadResults) {
          const target = targets.find((entry) => entry.profileKey === upload.profileKey)
          const assetId = upload.body?.id
          if (!assetId) {
            publishResults.push({
              profileKey: upload.profileKey,
              ok: false,
              status: 'asset-id-missing',
              error: 'MARKETPLACE_AGENT_ASSET_ID_MISSING',
            })
            continue
          }
          if (dryRun) {
            publishResults.push({
              profileKey: upload.profileKey,
              assetId,
              ok: true,
              dryRun: true,
              status: 'validated-not-sent',
            })
            continue
          }
          const publish = await publishMarketplaceOffering({
            profileTarget: target,
            input,
            profile: target.profile,
            assetId,
            packagePayload,
          })
          publishResults.push({
            profileKey: upload.profileKey,
            assetId,
            ok: publish.ok,
            status: publish.status,
            statusText: publish.statusText,
            body: publish.body,
          })
        }
      }
      const publishedCount = publishResults.filter((entry) => entry.ok).length
      const publishStepStatus = !publishToHub || publishedCount === publishResults.length ? 'succeeded' : 'failed'
      await updateWorkflowStepStatus(client, runId, 'publish-marketplace-offerings', publishStepStatus, {
        enabled: publishToHub,
        attempted: publishResults.length,
        succeeded: publishedCount,
        failed: publishResults.length - publishedCount,
        results: publishResults,
      }, publishStepStatus === 'succeeded' ? {} : { message: 'MARKETPLACE_AGENT_PUBLISH_FAILED' })
      if (publishStepStatus !== 'succeeded') throw new Error('MARKETPLACE_AGENT_PUBLISH_FAILED')

      const launchResults = []
      if (launchInMarketplace && publishToHub) {
        for (const publish of publishResults) {
          const target = targets.find((entry) => entry.profileKey === publish.profileKey)
          if (dryRun) {
            launchResults.push({
              profileKey: publish.profileKey,
              assetId: publish.assetId,
              ok: true,
              dryRun: true,
              status: 'validated-not-sent',
            })
            continue
          }
          launchResults.push({
            profileKey: publish.profileKey,
            assetId: publish.assetId,
            ...(await launchMarketplaceOffering({
              profileTarget: target,
              input,
              publishResult: publish,
            })),
          })
        }
      }
      const launchedCount = launchResults.filter((entry) => entry.ok).length
      const launchStepStatus = !launchInMarketplace || launchedCount === launchResults.length ? 'succeeded' : 'failed'
      await updateWorkflowStepStatus(client, runId, 'launch-marketplace-offerings', launchStepStatus, {
        enabled: launchInMarketplace,
        attempted: launchResults.length,
        succeeded: launchedCount,
        failed: launchResults.length - launchedCount,
        results: launchResults,
      }, launchStepStatus === 'succeeded' ? {} : { message: 'MARKETPLACE_OFFERING_LAUNCH_FAILED' })
      if (launchStepStatus !== 'succeeded') throw new Error('MARKETPLACE_OFFERING_LAUNCH_FAILED')

      const metadataResults = []
      if (dryRun) {
        for (const upload of uploadResults) {
          metadataResults.push({
            profileKey: upload.profileKey,
            assetId: upload.body?.id,
            ok: true,
            dryRun: true,
            matched: true,
          })
        }
      } else {
        for (const upload of uploadResults) {
          const target = targets.find((entry) => entry.profileKey === upload.profileKey)
          metadataResults.push({
            profileKey: upload.profileKey,
            ...(await verifyMarketplaceAgentMetadata({
              profileTarget: target,
              input,
              assetId: upload.body?.id,
            })),
          })
        }
      }
      const metadataOk = metadataResults.every((entry) => entry.ok)
      await updateWorkflowStepStatus(client, runId, 'verify-marketplace-agent-metadata', metadataOk ? 'succeeded' : 'warning', {
        results: metadataResults,
      })

      const summary = {
        cityId: run.cityId,
        workflowRunId: runId,
        profileKeys,
        publishToHub,
        launchInMarketplace,
        dryRun,
        package: {
          filename,
          packageType: packagePayload.packageType,
          title: packagePayload.title,
          byteSize,
          sha256,
          compatibilityTargets: packagePayload.compatibility.targets,
          licence: packagePayload.licence,
        },
        uploadedCount,
        publishedCount,
        launchedCount,
        metadataVerifiedCount: metadataResults.filter((entry) => entry.ok).length,
        publicationStatus: dryRun
          ? 'dry-run-validated'
          : publishToHub
            ? launchInMarketplace
              ? 'marketplace-agent-uploaded-published-and-launched'
              : 'marketplace-agent-uploaded-and-published'
            : 'marketplace-agent-uploaded',
        authorityStatus: 'operator-approved-marketplace-candidate',
      }
      const artifactSpecs = [
        { artifactKind: 'marketplace-package', stepKey: 'build-marketplace-package', metadata: { package: packagePayload, filename, byteSize, sha256 } },
        { artifactKind: 'marketplace-validation', stepKey: 'validate-marketplace-package', metadata: validation },
        { artifactKind: 'marketplace-agent-upload', stepKey: 'upload-marketplace-agent-assets', metadata: { results: uploadResults } },
        { artifactKind: 'marketplace-agent-publish', stepKey: 'publish-marketplace-offerings', metadata: { enabled: publishToHub, results: publishResults } },
        { artifactKind: 'marketplace-hub-launch', stepKey: 'launch-marketplace-offerings', metadata: { enabled: launchInMarketplace, results: launchResults } },
        { artifactKind: 'marketplace-agent-metadata', stepKey: 'verify-marketplace-agent-metadata', metadata: { results: metadataResults } },
        { artifactKind: 'marketplace-publication-summary', stepKey: 'write-marketplace-artifacts', metadata: summary },
      ]
      const artifacts = []
      for (const spec of artifactSpecs) {
        const step = stepByKey.get(spec.stepKey) ?? stepByKey.get('write-marketplace-artifacts') ?? null
        artifacts.push(await recordWorkflowArtifact(client, {
          runId,
          stepId: step?.id ?? null,
          cityId: run.cityId,
          artifactKind: spec.artifactKind,
          artifactUri: workflowArtifactUri(runId, spec.artifactKind),
          metadata: {
            workflowRunId: runId,
            workflowKey: run.workflowKey,
            ...spec.metadata,
          },
        }))
      }
      await updateWorkflowStepStatus(client, runId, 'write-marketplace-artifacts', 'succeeded', {
        artifactCount: artifacts.length,
        artifactKinds: artifacts.map((artifact) => artifact.artifact_kind),
        summary,
      })
      await updateWorkflowRunStatus(client, runId, 'succeeded', {
        executor: workerId,
        summary,
        artifacts: artifacts.map(normalizeWorkflowArtifact),
      })

      await client.query('COMMIT')
      return {
        configured: true,
        ok: true,
        run: await workflowRunDetail(client, runId),
        artifacts: artifacts.map(normalizeWorkflowArtifact),
        summary,
        error: null,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      try {
        await updateWorkflowRunStatus(client, runId, 'failed', {}, {
          message: String(error?.message ?? 'EU_LDT_MARKETPLACE_AGENT_PUBLISH_FAILED'),
        })
      } catch {}
      throw error
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    run: null,
    artifacts: [],
    summary: null,
    error: String(error?.message ?? 'EU_LDT_MARKETPLACE_AGENT_PUBLISH_FAILED'),
  }))
}

export async function executeExternalModelEnrichmentOnce({ runId, workerId = 'external-model-enrichment-runner' } = {}) {
  if (!runId) {
    return {
      configured: true,
      ok: false,
      run: null,
      artifacts: [],
      imported: [],
      error: 'WORKFLOW_RUN_ID_REQUIRED',
    }
  }

  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const initialRun = await workflowRunDetail(client, runId)
      if (!initialRun) throw new Error('WORKFLOW_RUN_NOT_FOUND')
      if (initialRun.workflowKey !== 'external-model-enrichment-exchange') {
        throw new Error('EXTERNAL_MODEL_ENRICHMENT_WORKFLOW_RUN_REQUIRED')
      }
      if (!['queued', 'running'].includes(initialRun.status)) {
        throw new Error(`WORKFLOW_RUN_NOT_EXECUTABLE:${initialRun.status}`)
      }

      const input = initialRun.input ?? {}
      const modelKey = String(input.modelKey ?? input.model_key ?? 'eu-ldt-building-sap-xgboost').trim()
      if (modelKey !== 'eu-ldt-building-sap-xgboost') throw new Error(`MODEL_EXECUTOR_NOT_IMPLEMENTED:${modelKey}`)
      const modelVersion = String(input.modelVersion ?? input.model_version ?? 'local-direct-smoke').trim()
      const modelEndpoint = String(input.modelEndpoint ?? input.model_endpoint ?? 'http://host.docker.internal:18080/v2/models/eco-building-matrix-sap/infer').trim()
      const entityType = String(input.entityType ?? input.entity_type ?? 'building').trim()
      const limit = normalizePositiveLimit(input.limit, 25, 250)
      const featurePolicy = String(input.featurePolicy ?? input.feature_policy ?? 'strict').trim()
      const outputKey = String(input.outputKey ?? input.output_key ?? 'sap-score').trim()
      const dryRun = input.dryRun === true || input.dry_run === true

      await updateWorkflowRunStatus(client, runId, 'running', {
        executor: workerId,
        modelKey,
        modelEndpoint,
        dryRun,
      })

      const run = await workflowRunDetail(client, runId)
      const stepByKey = new Map(run.steps.map((step) => [step.stepKey, step]))
      await updateWorkflowStepStatus(client, runId, 'prepare-run-context', 'succeeded', {
        cityId: run.cityId,
        workflowKey: run.workflowKey,
        workerId,
        modelKey,
        modelEndpoint,
      })
      await updateWorkflowStepStatus(client, runId, 'validate-input-contract', 'succeeded', {
        modelKey,
        modelVersion,
        modelEndpoint,
        entityType,
        limit,
        featurePolicy,
        outputKey,
        dryRun,
        featureContract: [
          'Annual_Energy_Consumption(kWh/m2)',
          'Annual_CO2_Emissions(kg/m2)',
          'Surface(m2)',
        ],
      })

      const selectedResult = await client.query(
        `
          SELECT
            ce.id::text AS entity_id,
            ce.stable_id,
            ce.city_id,
            ce.entity_type,
            ce.label,
            ce.authority_status,
            ce.confidence,
            ce.properties,
            b.footprint_area_m2,
            b.levels,
            CASE
              WHEN b.footprint_area_m2 IS NOT NULL AND b.levels IS NOT NULL AND b.levels > 0
                THEN b.footprint_area_m2 * b.levels
              WHEN b.footprint_area_m2 IS NOT NULL
                THEN b.footprint_area_m2
              WHEN ce.geom IS NOT NULL AND GeometryType(ce.geom) IN ('POLYGON', 'MULTIPOLYGON')
                THEN ST_Area(ce.geom::geography)
              ELSE NULL
            END AS surface_m2_candidate
          FROM ldt_core.city_entities ce
          LEFT JOIN ldt_core.building_entities b ON b.entity_id = ce.id
          WHERE ce.city_id = $1
            AND ce.entity_type = $2
            AND ce.lifecycle_status = 'active'
          ORDER BY ce.stable_id
          LIMIT $3
        `,
        [run.cityId, entityType, limit],
      )
      if (selectedResult.rowCount === 0) throw new Error('NO_MODEL_INPUT_ENTITIES_SELECTED')

      const featureRows = []
      const skipped = []
      selectedResult.rows.forEach((row, index) => {
        const featureRow = buildSapFeatureRow(row, { featurePolicy, index })
        if (!featureRow.ok) {
          skipped.push({
            entityId: row.entity_id,
            stableId: row.stable_id,
            warnings: featureRow.warnings,
          })
          return
        }
        featureRows.push({
          entityId: row.entity_id,
          stableId: row.stable_id,
          entityType: row.entity_type,
          label: row.label,
          values: featureRow.values,
          featureSource: featureRow.source,
          warnings: featureRow.warnings,
        })
      })
      if (featureRows.length === 0) throw new Error('NO_MODEL_FEATURE_ROWS_READY')
      await updateWorkflowStepStatus(client, runId, 'export-canonical-objects', 'succeeded', {
        selectedCount: selectedResult.rowCount,
        featureRowCount: featureRows.length,
        skippedCount: skipped.length,
        featurePolicy,
        featureRows: featureRows.map((entry) => ({
          entityId: entry.entityId,
          stableId: entry.stableId,
          values: entry.values,
          featureSource: entry.featureSource,
          warnings: entry.warnings,
        })),
        skipped,
      })

      const flattened = featureRows.flatMap((entry) => entry.values)
      const requestBody = {
        id: `oldt-direct-${runId}`,
        inputs: [
          {
            name: 'features',
            shape: [featureRows.length, 3],
            datatype: 'FP32',
            data: flattened,
          },
        ],
      }
      const startedAt = Date.now()
      const inference = dryRun
        ? { ok: true, status: 'dry-run', body: { outputs: [{ name: 'predictions', data: featureRows.map(() => null) }] } }
        : await fetchEuLdtJson(modelEndpoint, {
          method: 'POST',
          headers: normalizeEuLdtHeaders(),
          body: JSON.stringify(requestBody),
        })
      const inferenceMs = Date.now() - startedAt
      if (!inference.ok) throw new Error(`MODEL_INFERENCE_FAILED:${inference.status}`)
      const predictions = kservePredictions(inference.body)
      if (!dryRun && predictions.length !== featureRows.length) throw new Error(`MODEL_PREDICTION_COUNT_MISMATCH:${predictions.length}:${featureRows.length}`)
      await updateWorkflowStepStatus(client, runId, 'external-model-execution', 'succeeded', {
        modelEndpoint,
        dryRun,
        inferenceMs,
        requestShape: [featureRows.length, 3],
        predictionCount: predictions.length,
        firstPrediction: predictions[0] ?? null,
        lastPrediction: predictions[predictions.length - 1] ?? null,
      })

      const imported = []
      if (!dryRun) {
        for (const [index, entry] of featureRows.entries()) {
          const prediction = Number(predictions[index])
          const rowWarnings = Array.isArray(entry.warnings) ? entry.warnings : []
          const insertResult = await client.query(
            `
              INSERT INTO ldt_enrichment.entity_model_outputs (
                city_id,
                entity_id,
                workflow_run_id,
                model_key,
                model_version,
                output_key,
                status,
                value_numeric,
                value_json,
                unit,
                confidence,
                authority_status,
                method,
                input_sources,
                warnings,
                generated_at
              )
              VALUES (
                $1, $2, $3, $4, $5, $6,
                'computed',
                $7,
                $8::jsonb,
                'SAP',
                $9,
                'derived-model-output',
                $10::jsonb,
                $11::jsonb,
                $12::jsonb,
                now()
              )
              RETURNING id, city_id, entity_id, model_key, model_version, output_key, value_numeric, generated_at
            `,
            [
              run.cityId,
              entry.entityId,
              runId,
              modelKey,
              modelVersion,
              outputKey,
              prediction,
              JSON.stringify({
                value: prediction,
                featureContract: [
                  'Annual_Energy_Consumption(kWh/m2)',
                  'Annual_CO2_Emissions(kg/m2)',
                  'Surface(m2)',
                ],
                features: entry.values,
                featureSource: entry.featureSource,
              }),
              entry.featureSource === 'smoke-synthetic' ? 'smoke-synthetic' : 'model-derived',
              JSON.stringify({
                route: 'oldt-direct-kserve',
                modelEndpoint,
                modelKey,
                modelVersion,
                featurePolicy,
              }),
              JSON.stringify([
                {
                  kind: 'oldt-canonical-entity',
                  entityId: entry.entityId,
                  stableId: entry.stableId,
                  featureSource: entry.featureSource,
                },
              ]),
              JSON.stringify(rowWarnings),
            ],
          )
          imported.push(insertResult.rows[0])
        }
      }
      await updateWorkflowStepStatus(client, runId, 'import-enrichment-results', dryRun || imported.length > 0 ? 'succeeded' : 'failed', {
        dryRun,
        importedCount: imported.length,
        imported,
      }, dryRun || imported.length > 0 ? {} : { message: 'NO_MODEL_OUTPUTS_IMPORTED' })

      const summary = {
        cityId: run.cityId,
        modelKey,
        modelVersion,
        modelEndpoint,
        entityType,
        selectedCount: selectedResult.rowCount,
        featureRowCount: featureRows.length,
        skippedCount: skipped.length,
        importedCount: imported.length,
        dryRun,
        featurePolicy,
        outputKey,
        inferenceMs,
        authorityStatus: 'derived-model-output',
        publicationStatus: 'refresh_required',
      }
      const artifactSpecs = [
        { artifactKind: 'enrichment-input-manifest', stepKey: 'export-canonical-objects', metadata: { summary, featureContract: requestBody.inputs[0], skipped } },
        { artifactKind: 'enrichment-input-objects', stepKey: 'export-canonical-objects', metadata: { featureRows } },
        { artifactKind: 'external-model-response', stepKey: 'external-model-execution', metadata: { inference: { status: inference.status, body: inference.body }, inferenceMs } },
        { artifactKind: 'enrichment-result-objects', stepKey: 'import-enrichment-results', metadata: { imported } },
        { artifactKind: 'external-model-enrichment-summary', stepKey: 'publish-enrichment-read-model', metadata: summary },
      ]
      const artifacts = []
      for (const spec of artifactSpecs) {
        const step = stepByKey.get(spec.stepKey) ?? stepByKey.get('publish-enrichment-read-model') ?? null
        artifacts.push(await recordWorkflowArtifact(client, {
          runId,
          stepId: step?.id ?? null,
          cityId: run.cityId,
          artifactKind: spec.artifactKind,
          artifactUri: workflowArtifactUri(runId, spec.artifactKind),
          metadata: {
            workflowRunId: runId,
            workflowKey: run.workflowKey,
            modelKey,
            route: 'oldt-direct-kserve',
            ...spec.metadata,
          },
        }))
      }
      await updateWorkflowStepStatus(client, runId, 'publish-enrichment-read-model', 'succeeded', {
        artifactCount: artifacts.length,
        artifactKinds: artifacts.map((artifact) => artifact.artifact_kind),
        summary,
      })

      await updateWorkflowRunStatus(client, runId, 'succeeded', {
        executor: workerId,
        summary,
        artifacts: artifacts.map(normalizeWorkflowArtifact),
      })

      await client.query('COMMIT')
      return {
        configured: true,
        ok: true,
        run: await workflowRunDetail(client, runId),
        artifacts: artifacts.map(normalizeWorkflowArtifact),
        imported,
        error: null,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      try {
        await updateWorkflowRunStatus(client, runId, 'failed', {}, {
          message: String(error?.message ?? 'EXTERNAL_MODEL_ENRICHMENT_FAILED'),
        })
      } catch {}
      throw error
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    run: null,
    artifacts: [],
    imported: [],
    error: String(error?.message ?? 'EXTERNAL_MODEL_ENRICHMENT_FAILED'),
  }))
}

export async function executeRenovationStrategyReadinessDemoOnce({ runId, workerId = 'renovation-readiness-assessor' } = {}) {
  if (!runId) {
    return {
      configured: true,
      ok: false,
      run: null,
      artifacts: [],
      error: 'WORKFLOW_RUN_ID_REQUIRED',
    }
  }

  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const run = await workflowRunDetail(client, runId)
      if (!run) throw new Error('WORKFLOW_RUN_NOT_FOUND')
      const stepByKey = new Map((run.steps ?? []).map((step) => [step.stepKey, step]))
      await updateWorkflowRunStatus(client, runId, 'running', { executor: workerId })
      await updateWorkflowStepStatus(client, runId, 'prepare-run-context', 'succeeded', {
        cityId: run.cityId,
        workflowKey: run.workflowKey,
        demoOnly: true,
      })

      const limit = normalizePositiveLimit(run.input?.limit, 500, 5000)
      const countryCode = String(run.input?.countryCode ?? run.input?.country_code ?? '').trim().toUpperCase() || null
      const modelEndpoint = String(run.input?.modelEndpoint ?? run.input?.model_endpoint ?? 'http://host.docker.internal:18082/v2/models/renova/infer').trim()
      await updateWorkflowStepStatus(client, runId, 'validate-input-contract', 'succeeded', {
        limit,
        countryCode,
        modelEndpoint,
        requiredInputs: ['geometry', 'building id', 'tabula_string/archetype', 'refurbishment costs'],
      })

      const readinessResult = await client.query(
        `
          WITH buildings AS (
            SELECT
              ce.id,
              ce.stable_id,
              ce.geom,
              ce.properties,
              be.building_type,
              be.levels,
              be.height_m,
              be.footprint_area_m2,
              coe.energy_label
            FROM ldt_core.city_entities ce
            JOIN ldt_core.building_entities be ON be.entity_id = ce.id
            LEFT JOIN ldt_query.city_objects_enriched coe ON coe.id = ce.id
            WHERE ce.city_id = $1
              AND ce.entity_type = 'building'
          )
          SELECT
            count(*)::int AS building_count,
            count(*) FILTER (WHERE geom IS NOT NULL)::int AS with_geom,
            count(*) FILTER (WHERE geom IS NOT NULL AND ST_Area(geom::geography) > 0)::int AS with_derived_footprint,
            count(*) FILTER (WHERE footprint_area_m2 IS NOT NULL)::int AS with_stored_footprint,
            count(*) FILTER (WHERE building_type IS NOT NULL)::int AS with_building_type,
            count(*) FILTER (WHERE height_m IS NOT NULL)::int AS with_height,
            count(*) FILTER (WHERE levels IS NOT NULL)::int AS with_levels,
            count(*) FILTER (WHERE energy_label IS NOT NULL)::int AS with_energy_label,
            count(*) FILTER (WHERE properties ? 'tabula_string' OR properties ? 'tabulaString')::int AS with_tabula_string,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY ST_Area(geom::geography)) FILTER (WHERE geom IS NOT NULL AND ST_Area(geom::geography) > 0) AS median_derived_footprint_m2
          FROM buildings
        `,
        [run.cityId],
      )
      const readiness = readinessResult.rows[0] ?? {}
      const coverage = {
        buildingCount: Number(readiness.building_count ?? 0),
        withGeom: Number(readiness.with_geom ?? 0),
        withDerivedFootprint: Number(readiness.with_derived_footprint ?? 0),
        withStoredFootprint: Number(readiness.with_stored_footprint ?? 0),
        withBuildingType: Number(readiness.with_building_type ?? 0),
        withHeight: Number(readiness.with_height ?? 0),
        withLevels: Number(readiness.with_levels ?? 0),
        withEnergyLabel: Number(readiness.with_energy_label ?? 0),
        withTabulaString: Number(readiness.with_tabula_string ?? 0),
        medianDerivedFootprintM2: readiness.median_derived_footprint_m2 == null ? null : Number(readiness.median_derived_footprint_m2),
      }
      await updateWorkflowStepStatus(client, runId, 'assess-building-readiness', 'succeeded', coverage)

      const gaps = []
      if (coverage.withGeom === 0) gaps.push({ code: 'blocked-missing-geometries', severity: 'blocking', message: 'No building geometries are available for Renova GeoJSON output.' })
      if (coverage.withTabulaString === 0) gaps.push({ code: 'blocked-missing-archetypes', severity: 'blocking-for-real-run', message: 'OLDT has no tabula_string/archetype assignments.' })
      gaps.push({ code: 'blocked-missing-costs', severity: 'blocking-for-real-run', message: 'No regional refurbishment cost catalog is registered for Renova.' })
      if (coverage.withStoredFootprint === 0 && coverage.withDerivedFootprint > 0) gaps.push({ code: 'partial-derived-footprint-only', severity: 'warning', message: 'Footprint can be derived from geometry, but stored/official floor area is missing.' })
      if (coverage.withLevels === 0) gaps.push({ code: 'partial-missing-levels', severity: 'warning', message: 'Building levels are missing; total floor area would need assumptions.' })
      const readinessState = coverage.withGeom === 0
        ? 'blocked-missing-geometries'
        : coverage.withTabulaString === 0
          ? 'synthetic-smoke'
          : 'partial-inputs'
      await updateWorkflowStepStatus(client, runId, 'resolve-archetype-and-cost-gaps', 'succeeded', {
        readinessState,
        gaps,
        portableSolver: true,
        domainKnowledgePortable: false,
        note: 'Renova solver is generic, but archetype matrices and costs are not data-ready for this city.',
      })

      const packagePlan = {
        status: readinessState,
        modelKey: 'eu-ldt-sustainable-urban-development-renova',
        modelEndpoint,
        demoOnly: true,
        limit,
        inputsAvailable: {
          entityId: coverage.buildingCount > 0,
          buildingId: coverage.buildingCount > 0,
          geometryWkt: coverage.withGeom > 0,
          derivedFootprint: coverage.withDerivedFootprint > 0,
          buildingType: coverage.withBuildingType > 0,
        },
        inputsMissingForRealRun: ['tabula_string', 'asset_id/archetype_id', 'archetype_probability', 'regional_refurbishment_costs', 'official_total_floor_area'],
        allowedNextStep: readinessState === 'synthetic-smoke' ? 'demo-package-only-no-production-claim' : 'review-input-gaps',
      }
      await updateWorkflowStepStatus(client, runId, 'prepare-demo-package-plan', 'succeeded', packagePlan)

      const summary = {
        cityId: run.cityId,
        readinessState,
        coverage,
        gaps,
        packagePlan,
        authorityStatus: 'readiness-demo',
        promotionStatus: 'not_promoted',
        publicationStatus: 'not_applicable',
      }
      const artifactSpecs = [
        { artifactKind: 'renovation-readiness-report', stepKey: 'assess-building-readiness', metadata: { coverage } },
        { artifactKind: 'renovation-input-gap-report', stepKey: 'resolve-archetype-and-cost-gaps', metadata: { gaps, readinessState } },
        { artifactKind: 'renovation-demo-package-plan', stepKey: 'prepare-demo-package-plan', metadata: packagePlan },
        { artifactKind: 'renovation-strategy-readiness-summary', stepKey: 'write-readiness-artifacts', metadata: summary },
      ]
      const artifacts = []
      for (const spec of artifactSpecs) {
        const step = stepByKey.get(spec.stepKey) ?? stepByKey.get('write-readiness-artifacts') ?? null
        artifacts.push(await recordWorkflowArtifact(client, {
          runId,
          stepId: step?.id ?? null,
          cityId: run.cityId,
          artifactKind: spec.artifactKind,
          artifactUri: workflowArtifactUri(runId, spec.artifactKind),
          metadata: {
            workflowRunId: runId,
            workflowKey: run.workflowKey,
            modelKey: 'eu-ldt-sustainable-urban-development-renova',
            ...spec.metadata,
          },
        }))
      }
      await updateWorkflowStepStatus(client, runId, 'write-readiness-artifacts', 'succeeded', {
        artifactCount: artifacts.length,
        artifactKinds: artifacts.map((artifact) => artifact.artifact_kind),
        summary,
      })
      await updateWorkflowRunStatus(client, runId, 'succeeded', {
        executor: workerId,
        summary,
        artifacts: artifacts.map(normalizeWorkflowArtifact),
      })
      await client.query('COMMIT')
      return {
        configured: true,
        ok: true,
        run: await workflowRunDetail(client, runId),
        artifacts: artifacts.map(normalizeWorkflowArtifact),
        summary,
        error: null,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      try {
        await updateWorkflowRunStatus(client, runId, 'failed', {}, { message: String(error?.message ?? 'RENOVATION_READINESS_DEMO_FAILED') })
      } catch {}
      throw error
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    run: null,
    artifacts: [],
    summary: null,
    error: String(error?.message ?? 'RENOVATION_READINESS_DEMO_FAILED'),
  }))
}

const NEVULA_REQUIRED_INDICATORS = [
  'i01', 'i02', 'i03', 'i04', 'i05', 'i06', 'i07', 'i08', 'i09', 'i10',
  'i11a', 'i11b', 'i11c', 'i12', 'i13', 'i14', 'i15', 'i16', 'i17',
  'i18a', 'i18b', 'i18c', 'i19a', 'i19b', 'i20', 'i21a', 'i21b', 'i21c', 'i21d',
  'i22a', 'i22b', 'i22c', 'i22d', 'i22e', 'i22f', 'i22g', 'i22h',
  'i23a', 'i23b', 'i24a', 'i24b', 'i24c', 'i24d', 'i24e',
  'i25', 'i26a', 'i26b', 'i26c', 'i27a', 'i27b', 'i28',
]

export async function executeVulnerabilityClusteringReadinessDemoOnce({ runId, workerId = 'vulnerability-readiness-assessor' } = {}) {
  if (!runId) {
    return {
      configured: true,
      ok: false,
      run: null,
      artifacts: [],
      error: 'WORKFLOW_RUN_ID_REQUIRED',
    }
  }

  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const run = await workflowRunDetail(client, runId)
      if (!run) throw new Error('WORKFLOW_RUN_NOT_FOUND')
      const stepByKey = new Map((run.steps ?? []).map((step) => [step.stepKey, step]))
      await updateWorkflowRunStatus(client, runId, 'running', { executor: workerId })
      await updateWorkflowStepStatus(client, runId, 'prepare-run-context', 'succeeded', {
        cityId: run.cityId,
        workflowKey: run.workflowKey,
        demoOnly: true,
      })

      const limit = normalizePositiveLimit(run.input?.limit, 500, 5000)
      const modelEndpoint = String(run.input?.modelEndpoint ?? run.input?.model_endpoint ?? 'http://host.docker.internal:18083/v2/models/vulens/infer').trim()
      const zoneEntityTypes = Array.isArray(run.input?.zoneEntityTypes)
        ? run.input.zoneEntityTypes.map((entry) => String(entry).trim()).filter(Boolean)
        : ['census_section', 'census-area', 'neighborhood', 'district', 'zone', 'statistical_area', 'administrative_area']
      await updateWorkflowStepStatus(client, runId, 'validate-input-contract', 'succeeded', {
        limit,
        modelEndpoint,
        zoneEntityTypes,
        requiredInputs: ['territorial geometry', 'isv', 'iXX indicators'],
        requiredIndicatorCount: NEVULA_REQUIRED_INDICATORS.length,
      })

      const readinessResult = await client.query(
        `
          WITH candidate_zones AS (
            SELECT id, stable_id, entity_type, geom, properties
            FROM ldt_core.city_entities
            WHERE city_id = $1
              AND entity_type = ANY($2::text[])
          ), city_boundary AS (
            SELECT id, geom, properties
            FROM ldt_core.city_boundaries
            WHERE city_id = $1
          )
          SELECT
            (SELECT count(*)::int FROM candidate_zones) AS zone_count,
            (SELECT count(*)::int FROM candidate_zones WHERE geom IS NOT NULL) AS zones_with_geom,
            (SELECT count(*)::int FROM candidate_zones WHERE properties ? 'isv' OR properties ? 'ISV') AS zones_with_isv,
            (SELECT count(*)::int FROM candidate_zones WHERE properties ?& $3::text[]) AS zones_with_full_indicator_set,
            (SELECT count(*)::int FROM candidate_zones WHERE EXISTS (SELECT 1 FROM jsonb_object_keys(properties) AS key WHERE key ~ '^i[0-9]{2}[a-z]?$')) AS zones_with_any_indicator,
            (SELECT count(*)::int FROM city_boundary) AS city_boundary_count,
            (SELECT count(*)::int FROM city_boundary WHERE geom IS NOT NULL) AS city_boundaries_with_geom,
            (SELECT count(*)::int FROM ldt_core.city_entities WHERE city_id = $1 AND entity_type = 'building') AS building_count,
            (SELECT count(*)::int FROM ldt_core.city_entities WHERE city_id = $1 AND entity_type = 'road') AS road_count
        `,
        [run.cityId, zoneEntityTypes, NEVULA_REQUIRED_INDICATORS],
      )
      const row = readinessResult.rows[0] ?? {}
      const coverage = {
        zoneCount: Number(row.zone_count ?? 0),
        zonesWithGeom: Number(row.zones_with_geom ?? 0),
        zonesWithIsv: Number(row.zones_with_isv ?? 0),
        zonesWithFullIndicatorSet: Number(row.zones_with_full_indicator_set ?? 0),
        zonesWithAnyIndicator: Number(row.zones_with_any_indicator ?? 0),
        cityBoundaryCount: Number(row.city_boundary_count ?? 0),
        cityBoundariesWithGeom: Number(row.city_boundaries_with_geom ?? 0),
        buildingCount: Number(row.building_count ?? 0),
        roadCount: Number(row.road_count ?? 0),
      }
      await updateWorkflowStepStatus(client, runId, 'assess-zone-readiness', 'succeeded', coverage)

      const gaps = []
      if (coverage.zoneCount === 0) gaps.push({ code: 'blocked-missing-zone-geometries', severity: 'blocking-for-real-run', message: 'No census/statistical/neighborhood zone entities are available for NEVULA entries.' })
      if (coverage.zonesWithGeom === 0) gaps.push({ code: 'blocked-missing-zone-geometries', severity: 'blocking-for-real-run', message: 'No candidate zone geometries are available.' })
      if (coverage.zonesWithIsv === 0) gaps.push({ code: 'blocked-missing-isv', severity: 'blocking-for-real-run', message: 'No candidate zones contain a calculated ISV value.' })
      if (coverage.zonesWithFullIndicatorSet === 0) gaps.push({ code: 'blocked-missing-indicators', severity: 'blocking-for-real-run', message: 'No candidate zones contain the full NEVULA iXX indicator set.' })
      if (coverage.cityBoundariesWithGeom > 0 && coverage.zoneCount === 0) gaps.push({ code: 'partial-city-boundary-only', severity: 'warning', message: 'City boundary exists, but NEVULA needs multiple territorial/statistical units.' })
      const readinessState = coverage.zoneCount === 0 || coverage.zonesWithGeom === 0
        ? 'blocked-missing-zone-geometries'
        : coverage.zonesWithIsv === 0
          ? 'blocked-missing-isv'
          : coverage.zonesWithFullIndicatorSet === 0
            ? 'blocked-missing-indicators'
            : 'ready-real-isv'
      const demoState = readinessState.startsWith('blocked') && coverage.cityBoundariesWithGeom > 0 ? 'synthetic-smoke-possible' : readinessState
      await updateWorkflowStepStatus(client, runId, 'resolve-isv-and-indicator-gaps', 'succeeded', {
        readinessState,
        demoState,
        gaps,
        note: 'NEVULA reclusters an already-calculated ISV. Missing ISV/iXX indicators block a real run.',
      })

      const packagePlan = {
        status: demoState,
        modelKey: 'eu-ldt-vulnerability-mitigation-nevula',
        modelEndpoint,
        demoOnly: true,
        limit,
        inputsAvailable: {
          cityBoundaryGeometry: coverage.cityBoundariesWithGeom > 0,
          candidateZoneGeometry: coverage.zonesWithGeom > 0,
          isv: coverage.zonesWithIsv > 0,
          anyIndicators: coverage.zonesWithAnyIndicator > 0,
          fullIndicatorSet: coverage.zonesWithFullIndicatorSet > 0,
        },
        inputsMissingForRealRun: ['census/statistical zone geometries', 'isv', 'complete iXX indicator set'].filter((_, index) => {
          if (index === 0) return coverage.zonesWithGeom === 0
          if (index === 1) return coverage.zonesWithIsv === 0
          return coverage.zonesWithFullIndicatorSet === 0
        }),
        allowedNextStep: demoState === 'ready-real-isv' ? 'prepare-real-nevula-package' : 'demo-package-only-no-production-claim',
      }
      await updateWorkflowStepStatus(client, runId, 'prepare-demo-package-plan', 'succeeded', packagePlan)

      const summary = {
        cityId: run.cityId,
        readinessState,
        demoState,
        coverage,
        gaps,
        packagePlan,
        authorityStatus: 'readiness-demo',
        promotionStatus: 'not_promoted',
        publicationStatus: 'not_applicable',
      }
      const artifactSpecs = [
        { artifactKind: 'vulnerability-readiness-report', stepKey: 'assess-zone-readiness', metadata: { coverage } },
        { artifactKind: 'vulnerability-input-gap-report', stepKey: 'resolve-isv-and-indicator-gaps', metadata: { gaps, readinessState, demoState } },
        { artifactKind: 'vulnerability-demo-package-plan', stepKey: 'prepare-demo-package-plan', metadata: packagePlan },
        { artifactKind: 'vulnerability-clustering-readiness-summary', stepKey: 'write-readiness-artifacts', metadata: summary },
      ]
      const artifacts = []
      for (const spec of artifactSpecs) {
        const step = stepByKey.get(spec.stepKey) ?? stepByKey.get('write-readiness-artifacts') ?? null
        artifacts.push(await recordWorkflowArtifact(client, {
          runId,
          stepId: step?.id ?? null,
          cityId: run.cityId,
          artifactKind: spec.artifactKind,
          artifactUri: workflowArtifactUri(runId, spec.artifactKind),
          metadata: {
            workflowRunId: runId,
            workflowKey: run.workflowKey,
            modelKey: 'eu-ldt-vulnerability-mitigation-nevula',
            ...spec.metadata,
          },
        }))
      }
      await updateWorkflowStepStatus(client, runId, 'write-readiness-artifacts', 'succeeded', {
        artifactCount: artifacts.length,
        artifactKinds: artifacts.map((artifact) => artifact.artifact_kind),
        summary,
      })
      await updateWorkflowRunStatus(client, runId, 'succeeded', {
        executor: workerId,
        summary,
        artifacts: artifacts.map(normalizeWorkflowArtifact),
      })
      await client.query('COMMIT')
      return {
        configured: true,
        ok: true,
        run: await workflowRunDetail(client, runId),
        artifacts: artifacts.map(normalizeWorkflowArtifact),
        summary,
        error: null,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      try {
        await updateWorkflowRunStatus(client, runId, 'failed', {}, { message: String(error?.message ?? 'VULNERABILITY_READINESS_DEMO_FAILED') })
      } catch {}
      throw error
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    run: null,
    artifacts: [],
    summary: null,
    error: String(error?.message ?? 'VULNERABILITY_READINESS_DEMO_FAILED'),
  }))
}

export async function executeWorkflowRunOnce({ runId, workerId = 'admin-workflow-runner' } = {}) {
  if (!runId) {
    return {
      configured: true,
      ok: false,
      run: null,
      artifacts: [],
      error: 'WORKFLOW_RUN_ID_REQUIRED',
    }
  }

  const detail = await getWorkflowRun(runId)
  if (!detail.ok) return detail
  const workflowKey = detail.run?.canonicalWorkflowKey ?? canonicalWorkflowKey(detail.run?.workflowKey)
  if (workflowKey === 'open-source-city-builder') {
    return executePhase14WorkflowRunOnce({ runId, workerId })
  }
  if (workflowKey === 'eu-ldt-data-platform-publish') {
    return executeEuLdtDataPlatformPublishOnce({ runId, workerId })
  }
  if (workflowKey === 'eu-ldt-data-platform-import-results') {
    return executeEuLdtDataPlatformImportResultsOnce({ runId, workerId })
  }
  if (workflowKey === 'eu-ldt-data-modeller-prepare-schema') {
    return executeEuLdtDataModellerPrepareSchemaOnce({ runId, workerId })
  }
  if (workflowKey === 'eu-ldt-data-modeller-fixture-import') {
    return executeEuLdtDataModellerFixtureImportOnce({ runId, workerId })
  }
  if (workflowKey === 'eu-ldt-cip-publish-metric-source') {
    return executeEuLdtCipPublishMetricSourceOnce({ runId, workerId })
  }
  if (workflowKey === 'eu-ldt-cip-sync-measurements') {
    return executeEuLdtCipSyncMeasurementsOnce({ runId, workerId })
  }
  if (workflowKey === 'eu-ldt-cip-sync-initiatives') {
    return executeEuLdtCipSyncInitiativesOnce({ runId, workerId })
  }
  if (workflowKey === 'eu-ldt-use-case-scenarios-roundtrip') {
    return executeEuLdtUseCaseScenariosRoundtripOnce({ runId, workerId })
  }
  if (workflowKey === 'eu-ldt-data-space-publish') {
    return executeEuLdtDataSpaceQueryPublishOnce({ runId, workerId })
  }
  if (workflowKey === 'eu-ldt-data-space-query-exchange') {
    return executeEuLdtDataSpaceQueryExchangeOnce({ runId, workerId })
  }
  if (workflowKey === 'eu-ldt-play-visualise-register-layer') {
    return executeEuLdtPlayVisualiseRegisterLayerOnce({ runId, workerId })
  }
  if (workflowKey === 'eu-ldt-marketplace-agent-publish') {
    return executeEuLdtMarketplaceAgentPublishOnce({ runId, workerId })
  }
  if (workflowKey === 'external-model-enrichment') {
    return executeExternalModelEnrichmentOnce({ runId, workerId })
  }
  if (workflowKey === 'renovation-strategy-readiness-demo') {
    return executeRenovationStrategyReadinessDemoOnce({ runId, workerId })
  }
  if (workflowKey === 'vulnerability-clustering-readiness-demo') {
    return executeVulnerabilityClusteringReadinessDemoOnce({ runId, workerId })
  }
  return {
    configured: true,
    ok: false,
    run: detail.run,
    artifacts: [],
    error: `WORKFLOW_EXECUTOR_NOT_IMPLEMENTED:${workflowKey || 'unknown'}`,
  }
}

export async function listWorkflowRuns({ cityId, workflowKey, status, limit = 25, includeInactive = false } = {}) {
  return withClient(async (client) => {
    const filters = []
    const params = []
    const activeKeys = activeWorkflowStorageKeys()
    if (cityId) {
      params.push(cityId)
      filters.push(`run.city_id = $${params.length}`)
    }
    if (workflowKey) {
      const storageKey = workflowManifestStorageKey(workflowKey)
      if (!storageKey) throw new Error('WORKFLOW_CONTRACT_NOT_ACTIVE')
      if (!includeInactive && !activeKeys.includes(storageKey)) throw new Error('WORKFLOW_CONTRACT_NOT_ACTIVE')
      params.push(storageKey)
      filters.push(`run.workflow_key = $${params.length}`)
    } else if (!includeInactive) {
      params.push(activeKeys)
      filters.push(`run.workflow_key = ANY($${params.length}::text[])`)
    }
    if (status) {
      params.push(status)
      filters.push(`run.status = $${params.length}`)
    }
    const normalizedLimit = Math.max(1, Math.min(Number(limit) || 25, 100))
    params.push(normalizedLimit)
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
    const result = await client.query(
      `
        SELECT run.*, definition.name AS workflow_name
        FROM ldt_ops.workflow_runs run
        LEFT JOIN ldt_ops.workflow_definitions definition ON definition.id = run.workflow_id
        ${whereClause}
        ORDER BY run.created_at DESC
        LIMIT $${params.length}
      `,
      params,
    )
    return {
      configured: true,
      ok: true,
      runs: result.rows.map(normalizeWorkflowRun),
      error: null,
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    runs: [],
    error: String(error?.message ?? 'WORKFLOW_RUNS_UNAVAILABLE'),
  }))
}

export async function recordApiUsageEvent({
  requestId = null,
  routeFamily,
  method,
  pathTemplate,
  statusCode,
  latencyMs = null,
  cityId = null,
  actorUserId = null,
  actorRole = null,
  apiVersion = 'compat',
  consumerKey = null,
  errorCode = null,
  metadata = {},
} = {}) {
  return withClient(async (client) => {
    const normalizedRouteFamily = String(routeFamily ?? '').trim() || 'api'
    const normalizedMethod = String(method ?? '').trim().toUpperCase() || 'GET'
    const normalizedPathTemplate = String(pathTemplate ?? '').trim() || '/api'
    const normalizedStatusCode = Number(statusCode ?? 0)
    if (!Number.isFinite(normalizedStatusCode) || normalizedStatusCode <= 0) {
      throw new Error('STATUS_CODE_REQUIRED')
    }

    const result = await client.query(
      `
        INSERT INTO ldt_ops.api_usage_events (
          request_id,
          route_family,
          method,
          path_template,
          status_code,
          latency_ms,
          city_id,
          actor_user_id,
          actor_role,
          api_version,
          consumer_key,
          error_code,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
        RETURNING id, created_at
      `,
      [
        requestId,
        normalizedRouteFamily,
        normalizedMethod,
        normalizedPathTemplate,
        normalizedStatusCode,
        Number.isFinite(Number(latencyMs)) ? Math.max(0, Math.round(Number(latencyMs))) : null,
        cityId ? String(cityId) : null,
        actorUserId ? String(actorUserId) : null,
        actorRole ? String(actorRole) : null,
        String(apiVersion ?? 'compat') || 'compat',
        consumerKey ? String(consumerKey) : null,
        errorCode ? String(errorCode) : null,
        JSON.stringify(metadata ?? {}),
      ],
    )

    return {
      configured: true,
      ok: true,
      event: result.rows[0],
      error: null,
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    event: null,
    error: String(error?.message ?? 'API_USAGE_EVENT_RECORD_FAILED'),
  }))
}

export async function createWorkflowRun({
  workflowKey,
  cityId,
  input = {},
  requestedBy = null,
  requestedByKind = 'human',
  triggerKind = 'manual',
} = {}) {
  return withClient(async (client) => {
    const normalizedWorkflowKey = String(workflowKey ?? '').trim()
    const storageWorkflowKey = workflowCreateStorageKey(normalizedWorkflowKey)
    const normalizedCityId = String(cityId ?? '').trim()
    if (!normalizedWorkflowKey) throw new Error('WORKFLOW_KEY_REQUIRED')
    if (!storageWorkflowKey) throw new Error('WORKFLOW_CONTRACT_NOT_ACTIVE')
    if (!normalizedCityId) throw new Error('CITY_ID_REQUIRED')

    await client.query('BEGIN')
    try {
      const workflowResult = await client.query(
        `
          SELECT *
          FROM ldt_ops.workflow_definitions
          WHERE workflow_key = $1
        `,
        [storageWorkflowKey],
      )
      if (workflowResult.rowCount === 0) throw new Error('WORKFLOW_DEFINITION_NOT_FOUND')

      const cityResult = await client.query('SELECT id FROM ldt_core.cities WHERE id = $1', [normalizedCityId])
      if (cityResult.rowCount === 0) throw new Error('CITY_NOT_FOUND')

      const workflow = workflowResult.rows[0]
      const boundaryGate = storageWorkflowKey === 'phase14-open-data-workflow-runner'
        ? await assertPhase14BoundaryGate(normalizedCityId, input)
        : { ok: true, skipped: true, code: 'NOT_PHASE14' }
      const runInput = {
        ...(input ?? {}),
        cityId: normalizedCityId,
        workflowKey: workflow.workflow_key,
        boundaryGate,
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
            input
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'approval_required', $7::jsonb)
          RETURNING *
        `,
        [
          workflow.id,
          workflow.workflow_key,
          normalizedCityId,
          requestedBy,
          requestedByKind,
          triggerKind,
          JSON.stringify(runInput),
        ],
      )
      const run = runResult.rows[0]

      for (const [index, step] of workflowStepTemplates(workflow.workflow_key).entries()) {
        await client.query(
          `
            INSERT INTO ldt_ops.workflow_steps (
              run_id,
              step_key,
              step_order,
              title,
              tool_kind,
              status
            )
            VALUES ($1, $2, $3, $4, $5, 'pending')
            ON CONFLICT (run_id, step_key) DO NOTHING
          `,
          [run.id, step.stepKey, index + 1, step.title, step.toolKind],
        )
      }

      for (const approval of workflowApprovalTemplates(workflow.workflow_key)) {
        await client.query(
          `
            INSERT INTO ldt_ops.workflow_approvals (
              run_id,
              approval_key,
              status,
              requested_by,
              policy
            )
            VALUES ($1, $2, 'requested', $3, $4::jsonb)
            ON CONFLICT (run_id, approval_key) DO NOTHING
          `,
          [run.id, approval.approvalKey, requestedBy, JSON.stringify(approval.policy ?? {})],
        )
      }

      await client.query('COMMIT')
      return {
        configured: true,
        ok: true,
        run: await workflowRunDetail(client, run.id),
        error: null,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    run: null,
    error: String(error?.message ?? 'WORKFLOW_RUN_CREATE_FAILED'),
  }))
}

export async function getWorkflowRun(runId) {
  return withClient(async (client) => {
    const run = await workflowRunDetail(client, runId)
    return {
      configured: true,
      ok: Boolean(run),
      run,
      error: run ? null : 'WORKFLOW_RUN_NOT_FOUND',
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    run: null,
    error: String(error?.message ?? 'WORKFLOW_RUN_UNAVAILABLE'),
  }))
}

export async function decideWorkflowApproval({
  runId,
  approvalKey,
  decision,
  decidedBy = null,
  reason = '',
} = {}) {
  return withClient(async (client) => {
    const normalizedDecision = String(decision ?? '').trim().toLowerCase()
    if (!['approved', 'rejected'].includes(normalizedDecision)) throw new Error('APPROVAL_DECISION_INVALID')
    if (!runId) throw new Error('WORKFLOW_RUN_ID_REQUIRED')
    if (!approvalKey) throw new Error('APPROVAL_KEY_REQUIRED')

    await client.query('BEGIN')
    try {
      const approvalResult = await client.query(
        `
          UPDATE ldt_ops.workflow_approvals
          SET
            status = $1,
            decided_by = $2,
            decided_at = now(),
            decision_reason = $3,
            updated_at = now()
          WHERE run_id = $4
            AND approval_key = $5
          RETURNING *
        `,
        [normalizedDecision, decidedBy, reason, runId, approvalKey],
      )
      if (approvalResult.rowCount === 0) throw new Error('WORKFLOW_APPROVAL_NOT_FOUND')

      const approvalCounts = await client.query(
        `
          SELECT
            count(*) FILTER (WHERE status = 'requested')::int AS requested,
            count(*) FILTER (WHERE status = 'approved')::int AS approved,
            count(*) FILTER (WHERE status = 'rejected')::int AS rejected
          FROM ldt_ops.workflow_approvals
          WHERE run_id = $1
        `,
        [runId],
      )
      const counts = approvalCounts.rows[0]
      const nextStatus =
        Number(counts.rejected) > 0
          ? 'rejected'
          : Number(counts.requested) === 0
            ? 'queued'
            : 'approval_required'

      await client.query(
        `
          UPDATE ldt_ops.workflow_runs
          SET status = $1, updated_at = now()
          WHERE id = $2
        `,
        [nextStatus, runId],
      )

      await client.query('COMMIT')
      return {
        configured: true,
        ok: true,
        approval: normalizeWorkflowApproval(approvalResult.rows[0]),
        run: await workflowRunDetail(client, runId),
        error: null,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    approval: null,
    run: null,
    error: String(error?.message ?? 'WORKFLOW_APPROVAL_DECISION_FAILED'),
  }))
}

export {
  executeEuLdtDataModellerFixtureImportOnce,
  executeEuLdtDataModellerPrepareSchemaOnce,
  executeEuLdtDataSpaceQueryPublishOnce,
  executeEuLdtDataSpaceQueryExchangeOnce,
  normalizeWorkflowRun,
}
