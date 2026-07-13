import { useCallback, useEffect, useMemo, useState } from 'react'

const INITIAL_WORKFLOW_CONTROL = {
  loading: false,
  error: '',
  message: '',
  definitions: [],
  runs: [],
  capabilities: null,
  contracts: null,
  sourcePlan: null,
  sourceContracts: null,
  viewerArtifacts: null,
  processingNodes: [],
  euLdtProfiles: [],
  selectedRun: null,
  selectedRunManifest: null,
  selectedRunTrace: null,
  inspectingRunId: '',
}

const INITIAL_SOURCE_PLAN_FORM = {
  rawSchema: '',
  sourceSlug: '',
  sourceUrl: '',
  sourcePath: '',
  overtureRelease: '',
  providerOverride: '{}',
  notes: '',
}

const INITIAL_SOURCE_PACKAGE = {
  layerKey: '',
  action: 'geojson',
  sourceFormat: 'geojson',
  sourceUri: '',
  sourceVersion: '',
  posture: 'open-data-native',
  queueForExecution: false,
  extractorKeys: {
    terrainDem: true,
    weatherField: true,
    hydrologyGrid: true,
  },
  refreshViewerAggregates: true,
  refreshConsolidation: true,
  refreshTwinQuerySurfaces: true,
}

const INITIAL_OFFLINE_RESULT_DRAFT = {
  runId: '',
  stageKey: '',
  promotionMode: 'operations-ledger',
  payload: '',
  error: '',
}

const INITIAL_EU_LDT_WORKFLOW_DRAFT = {
  integrationProfileKey: '',
  publishType: '',
  publishLimit: 10,
  publishDryRun: true,
  importType: 'BuildingEnergyPerformance',
  importLimit: 25,
  modelKey: 'eu-ldt-building-sap-xgboost',
  modelVersion: 'eu-ldt-data-platform',
  outputKey: 'sap-score',
  sourceAttribute: 'sapScore',
  allowUnmapped: false,
}

const INITIAL_EU_LDT_VISUALISE_DRAFT = {
  integrationProfileKey: '',
  mode: 'full-power',
  collectionKey: 'buildings',
  limit: 1000,
  dataSourceName: 'OLDT Full Power Buildings',
  layerName: 'OLDT Buildings Energy Fill',
  mapName: 'OLDT Guanajuato Full Power',
  layerType: 'REAL_TIME',
  propField: 'energyLabel',
  color: '#0072CE',
}

const INITIAL_EU_LDT_DATA_MODELLER_DRAFT = {
  integrationProfileKey: '',
  entityType: 'building',
  sampleLimit: 25,
  schemaName: 'OLDT building synthetic fixture',
  referenceName: 'oldt_building_fixture',
  version: '1.0.0',
  ownership: 'OLDT operator',
  outputField: 'synthetic_score',
  outputMinimum: 0,
  outputMaximum: 100,
  schemaId: '',
  recordCount: 25,
  minimumEvaluationScore: 80,
  modelKey: 'eu-ldt-data-modeller-fixture',
  modelVersion: 'data-modeller-synthetic',
  outputKey: 'synthetic-score',
  unit: 'score',
}

function sourcePlanFormFromBody(sourcePlanBody = {}) {
  const preset = sourcePlanBody?.sourcePlan?.preset ?? {}
  const override = sourcePlanBody?.override ?? {}
  return {
    rawSchema: preset.rawSchema ?? '',
    sourceSlug: preset.sourceSlug ?? '',
    sourceUrl: preset.sourceUrl ?? '',
    sourcePath: preset.sourcePath ?? '',
    overtureRelease: preset.overtureRelease ?? '',
    providerOverride: JSON.stringify(preset.providerOverride ?? override.providerOverride ?? {}, null, 2),
    notes: override.notes ?? '',
  }
}

function parseProviderOverride(value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return {}
  const parsed = JSON.parse(trimmed)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('PROVIDER_OVERRIDE_MUST_BE_JSON_OBJECT')
  return parsed
}

async function readJson(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || body?.detail || `HTTP_${response.status}`)
  }
  return body
}

function workflowLabelFor(runOrWorkflow = {}) {
  const key = runOrWorkflow.canonicalWorkflowKey ?? runOrWorkflow.workflowKey ?? runOrWorkflow.workflow_key
  if (['open-source-city-builder', 'phase14-open-data-workflow-runner'].includes(key)) return 'Open Source City Builder'
  if (['data-factory-compute-handoff', 'offline-data-factory-handoff'].includes(key)) return 'Data Factory Compute Handoff'
  if (['external-model-enrichment', 'external-model-enrichment-exchange'].includes(key)) return 'External Model Enrichment'
  if (key === 'standards-publication-refresh') return 'Standards Publication Refresh'
  return runOrWorkflow.workflowName || runOrWorkflow.name || key || 'Workflow'
}

export default function useOperationsControl({
  activeCityId = '',
  layerCapabilities,
  operationsReport,
  operationsView,
  refreshWorkspace,
  workflowRuns,
}) {
  const [workflowControl, setWorkflowControl] = useState(INITIAL_WORKFLOW_CONTROL)
  const [sourcePlanForm, setSourcePlanForm] = useState(INITIAL_SOURCE_PLAN_FORM)
  const [sourcePackage, setSourcePackage] = useState(INITIAL_SOURCE_PACKAGE)
  const [offlineResultDraft, setOfflineResultDraft] = useState(INITIAL_OFFLINE_RESULT_DRAFT)
  const [euLdtWorkflowDraft, setEuLdtWorkflowDraft] = useState(INITIAL_EU_LDT_WORKFLOW_DRAFT)
  const [euLdtVisualiseDraft, setEuLdtVisualiseDraft] = useState(INITIAL_EU_LDT_VISUALISE_DRAFT)
  const [euLdtDataModellerDraft, setEuLdtDataModellerDraft] = useState(INITIAL_EU_LDT_DATA_MODELLER_DRAFT)
  const [manualLayerKey, setManualLayerKey] = useState('')
  const [usesManualLayerKey, setUsesManualLayerKey] = useState(false)

  const phase14Workflow = useMemo(
    () => workflowControl.definitions.find((workflow) => workflow.workflowKey === 'open-source-city-builder' || workflow.storageWorkflowKey === 'phase14-open-data-workflow-runner'),
    [workflowControl.definitions],
  )

  const controlledWorkflowRuns = workflowControl.runs.length ? workflowControl.runs : (operationsReport?.workflowRuns ?? workflowRuns)

  const workflowLabel = useCallback(workflowLabelFor, [])

  const layerOptions = useMemo(() => (layerCapabilities?.layers ?? [])
    .map((layer) => ({
      key: layer.key || layer.layerKey || layer.id || '',
      label: layer.label || layer.name || layer.key || layer.layerKey || layer.id || 'Layer',
      capability: layer.capability || layer.sourceKind || layer.kind || layer.type || '',
    }))
    .filter((layer) => layer.key)
    .filter((layer) => !/(^|[-_\s])(e2e|smoke|test)([-_\s]|$)/i.test(`${layer.key} ${layer.label}`))
    .sort((a, b) => a.label.localeCompare(b.label)), [layerCapabilities])

  const selectedLayer = useMemo(
    () => layerOptions.find((layer) => layer.key === sourcePackage.layerKey),
    [layerOptions, sourcePackage.layerKey],
  )

  const selectedExtractorKeys = useMemo(() => [
    sourcePackage.extractorKeys.terrainDem ? 'terrain-dem' : null,
    sourcePackage.extractorKeys.weatherField ? 'weather-field' : null,
    sourcePackage.extractorKeys.hydrologyGrid ? 'hydrology-grid' : null,
  ].filter(Boolean), [sourcePackage.extractorKeys])

  const adapterRows = useMemo(() => (
    workflowControl.capabilities?.capabilities ?? []
  ).filter((capability) => [
    sourcePackage.action,
    sourcePackage.sourceFormat,
    'osm-local-extract',
    'mvt-cache-refresh',
  ].includes(capability.key)).slice(0, 6), [workflowControl.capabilities, sourcePackage.action, sourcePackage.sourceFormat])

  const requireActiveCityId = useCallback(() => {
    const cityId = String(activeCityId ?? '').trim()
    if (!cityId) throw new Error('ACTIVE_CITY_REQUIRED')
    return cityId
  }, [activeCityId])

  const loadWorkflowControl = useCallback(async (message = '') => {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message }))
    try {
      const cityId = requireActiveCityId()
      const [definitionsBody, runsBody, capabilitiesBody, contractsBody, sourcePlanBody, sourceContractsBody, viewerArtifactsBody, processingNodesBody, euLdtProfilesBody] = await Promise.all([
        fetch('/api/admin/workflows', { credentials: 'same-origin' }).then(readJson),
        fetch(`/api/admin/workflow-runs?cityId=${encodeURIComponent(cityId)}&limit=12`, { credentials: 'same-origin' }).then(readJson),
        fetch('/api/admin/provider-ingestion/capabilities', { credentials: 'same-origin' }).then(readJson),
        fetch(`/api/admin/workflow-contracts?cityId=${encodeURIComponent(cityId)}`, { credentials: 'same-origin' }).then(readJson),
        fetch(`/api/admin/cities/${encodeURIComponent(cityId)}/source-plan`, { credentials: 'same-origin' }).then(readJson),
        fetch(`/api/admin/cities/${encodeURIComponent(cityId)}/workflow-source-contracts`, { credentials: 'same-origin' }).then(readJson),
        fetch(`/api/live/${encodeURIComponent(cityId)}/viewer-artifacts?limit=12`, { credentials: 'same-origin' }).then(readJson),
        fetch('/api/admin/data-factory/processing-nodes?limit=25', { credentials: 'same-origin' }).then(readJson),
        fetch('/api/admin/eu-ldt/integrations', { credentials: 'same-origin' }).then(readJson),
      ])
      const euLdtProfiles = euLdtProfilesBody.profiles ?? []
      const dataPlatformProfiles = euLdtProfiles.filter((profile) => profile.platformKind === 'data-platform')
      const playVisualiseProfiles = euLdtProfiles.filter((profile) => profile.platformKind === 'play-visualise')
      const dataModellerProfiles = euLdtProfiles.filter((profile) => profile.platformKind === 'data-modeller')
      setEuLdtWorkflowDraft((current) => ({
        ...current,
        integrationProfileKey: current.integrationProfileKey || dataPlatformProfiles.find((profile) => profile.status === 'validated')?.profileKey || dataPlatformProfiles[0]?.profileKey || '',
      }))
      setEuLdtVisualiseDraft((current) => ({
        ...current,
        integrationProfileKey: current.integrationProfileKey || playVisualiseProfiles.find((profile) => profile.status === 'validated')?.profileKey || playVisualiseProfiles[0]?.profileKey || '',
      }))
      setEuLdtDataModellerDraft((current) => ({
        ...current,
        integrationProfileKey: current.integrationProfileKey || dataModellerProfiles.find((profile) => profile.status === 'validated')?.profileKey || dataModellerProfiles[0]?.profileKey || '',
      }))
      setSourcePlanForm(sourcePlanFormFromBody(sourcePlanBody))
      setWorkflowControl((current) => ({
        loading: false,
        error: '',
        message,
        definitions: definitionsBody.workflows ?? [],
        runs: runsBody.runs ?? [],
        capabilities: capabilitiesBody,
        contracts: contractsBody,
        sourcePlan: sourcePlanBody,
        sourceContracts: sourceContractsBody,
        viewerArtifacts: viewerArtifactsBody,
        processingNodes: processingNodesBody.nodes ?? [],
        euLdtProfiles,
        selectedRun: current.selectedRun,
        selectedRunManifest: current.selectedRunManifest,
        selectedRunTrace: current.selectedRunTrace,
        inspectingRunId: current.inspectingRunId,
      }))
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'WORKFLOW_CONTROL_UNAVAILABLE'),
      }))
    }
  }, [requireActiveCityId])

  async function repairBoundaryGate() {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const body = await fetch(`/api/admin/cities/${encodeURIComponent(requireActiveCityId())}/boundary-quality-gate/repair`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: 'Accepted from Operations boundary repair UI.' }),
      }).then(readJson)
      const resolvedPlan = body.sourcePlan ?? null
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: '',
        message: body.repaired ? 'Boundary gate repaired' : 'Boundary gate already ready',
        sourcePlan: resolvedPlan,
      }))
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'CITY_BOUNDARY_REPAIR_FAILED'),
      }))
    }
  }

  async function registerViewerArtifacts() {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      await fetch(`/api/live/${encodeURIComponent(requireActiveCityId())}/viewer-artifacts/register`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ activateLatest: true }),
      }).then(readJson)
      await loadWorkflowControl('Viewer artifacts registered')
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'VIEWER_ARTIFACT_REGISTRATION_FAILED'),
      }))
    }
  }

  async function saveCitySourcePlan() {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const providerOverride = parseProviderOverride(sourcePlanForm.providerOverride)
      const body = await fetch(`/api/admin/cities/${encodeURIComponent(requireActiveCityId())}/source-plan`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rawSchema: sourcePlanForm.rawSchema,
          sourceSlug: sourcePlanForm.sourceSlug,
          sourceUrl: sourcePlanForm.sourceUrl,
          sourcePath: sourcePlanForm.sourcePath,
          overtureRelease: sourcePlanForm.overtureRelease,
          providerOverride,
          notes: sourcePlanForm.notes,
        }),
      }).then(readJson)
      const resolvedPlan = body.sourcePlan ?? null
      setSourcePlanForm(sourcePlanFormFromBody(resolvedPlan))
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: '',
        message: 'City source plan saved',
        sourcePlan: resolvedPlan,
      }))
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'CITY_SOURCE_PLAN_SAVE_FAILED'),
      }))
    }
  }

  async function createCityBootstrapRun() {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const citySourcePlan = workflowControl.sourcePlan
      if (!citySourcePlan?.ready) throw new Error('CITY_SOURCE_PLAN_NOT_READY')

      const body = await fetch('/api/admin/workflows/open-source-city-builder/runs', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cityId: citySourcePlan.cityId,
          triggerKind: 'operator-ui',
          input: {
            sourcePlan: citySourcePlan.sourcePlan,
            providerPackages: citySourcePlan.providerPackages,
            extractorKeys: citySourcePlan.extractorKeys,
            refreshViewerAggregates: citySourcePlan.refreshViewerAggregates,
            refreshConsolidation: citySourcePlan.refreshConsolidation,
            refreshTwinQuerySurfaces: citySourcePlan.refreshTwinQuerySurfaces,
            validationMode: citySourcePlan.validationMode,
          },
        }),
      }).then(readJson)
      await loadWorkflowControl(`Created ${workflowLabel(body.run)} city bootstrap run`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'CITY_BOOTSTRAP_RUN_CREATE_FAILED'),
      }))
    }
  }

  async function createPhase14Run() {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const cityId = requireActiveCityId()
      const providerPackage = {
        layerKey: sourcePackage.layerKey.trim(),
        action: sourcePackage.action,
        sourceFormat: sourcePackage.sourceFormat,
        sourceUri: sourcePackage.sourceUri.trim() || null,
        sourceVersion: sourcePackage.sourceVersion.trim() || null,
        posture: sourcePackage.posture,
        queueForExecution: sourcePackage.queueForExecution,
      }
      const body = await fetch('/api/admin/workflows/open-source-city-builder/runs', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cityId,
          triggerKind: 'operator-ui',
          input: {
            sourcePlan: {
              kind: sourcePackage.sourceUri.trim() ? 'operator-source-package' : 'operator-registered-source-intent',
              posture: sourcePackage.posture,
              target: `${cityId}-open-data-import`,
            },
            providerPackages: [providerPackage],
            extractorKeys: selectedExtractorKeys,
            refreshViewerAggregates: sourcePackage.refreshViewerAggregates,
            refreshConsolidation: sourcePackage.refreshConsolidation,
            refreshTwinQuerySurfaces: sourcePackage.refreshTwinQuerySurfaces,
            validationMode: sourcePackage.sourceUri.trim() ? 'operator-source-validation' : 'operator-source-required',
          },
        }),
      }).then(readJson)
      await loadWorkflowControl(`Created ${workflowLabel(body.run)} run`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'WORKFLOW_RUN_CREATE_FAILED'),
      }))
    }
  }

  async function createEuLdtDataPlatformPublishRun() {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const cityId = requireActiveCityId()
      if (!euLdtWorkflowDraft.integrationProfileKey) throw new Error('EU_LDT_INTEGRATION_PROFILE_REQUIRED')
      const body = await fetch('/api/admin/workflows/eu-ldt-data-platform-publish/runs', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cityId,
          triggerKind: 'operator-ui',
          input: {
            integrationProfileKey: euLdtWorkflowDraft.integrationProfileKey,
            type: euLdtWorkflowDraft.publishType.trim() || undefined,
            limit: Number(euLdtWorkflowDraft.publishLimit) || 10,
            dryRun: euLdtWorkflowDraft.publishDryRun,
            readback: true,
            replicationCheck: true,
          },
        }),
      }).then(readJson)
      await loadWorkflowControl(`Created ${workflowLabel(body.run)} run`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'EU_LDT_PUBLISH_RUN_CREATE_FAILED'),
      }))
    }
  }

  async function createEuLdtDataPlatformImportRun() {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const cityId = requireActiveCityId()
      if (!euLdtWorkflowDraft.integrationProfileKey) throw new Error('EU_LDT_INTEGRATION_PROFILE_REQUIRED')
      const body = await fetch('/api/admin/workflows/eu-ldt-data-platform-import-results/runs', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cityId,
          triggerKind: 'operator-ui',
          input: {
            integrationProfileKey: euLdtWorkflowDraft.integrationProfileKey,
            type: euLdtWorkflowDraft.importType,
            limit: Number(euLdtWorkflowDraft.importLimit) || 25,
            modelKey: euLdtWorkflowDraft.modelKey,
            modelVersion: euLdtWorkflowDraft.modelVersion,
            outputKey: euLdtWorkflowDraft.outputKey,
            sourceAttribute: euLdtWorkflowDraft.sourceAttribute,
            allowUnmapped: euLdtWorkflowDraft.allowUnmapped,
          },
        }),
      }).then(readJson)
      await loadWorkflowControl(`Created ${workflowLabel(body.run)} run`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'EU_LDT_IMPORT_RUN_CREATE_FAILED'),
      }))
    }
  }

  async function createEuLdtPlayVisualiseRegisterLayerRun() {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const cityId = requireActiveCityId()
      if (!euLdtVisualiseDraft.integrationProfileKey) throw new Error('EU_LDT_PLAY_VISUALISE_PROFILE_REQUIRED')
      const collectionKey = euLdtVisualiseDraft.collectionKey.trim() || 'buildings'
      const mode = euLdtVisualiseDraft.mode || 'basic'
      const body = await fetch('/api/admin/workflows/eu-ldt-play-visualise-register-layer/runs', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cityId,
          triggerKind: 'operator-ui',
          input: {
            integrationProfileKey: euLdtVisualiseDraft.integrationProfileKey,
            mode,
            collectionKey,
            limit: Number(euLdtVisualiseDraft.limit) || (mode === 'full-power' ? 1000 : 250),
            dataSourceName: euLdtVisualiseDraft.dataSourceName.trim() || (mode === 'full-power' ? 'OLDT Full Power Buildings' : `OLDT Guanajuato ${collectionKey}`),
            layerName: euLdtVisualiseDraft.layerName.trim() || (mode === 'full-power' ? 'OLDT Buildings Energy Fill' : `OLDT ${collectionKey}`),
            mapName: euLdtVisualiseDraft.mapName.trim() || (mode === 'full-power' ? 'OLDT Guanajuato Full Power' : 'OLDT Guanajuato'),
            layerType: euLdtVisualiseDraft.layerType,
            propField: euLdtVisualiseDraft.propField,
            color: euLdtVisualiseDraft.color,
          },
        }),
      }).then(readJson)
      await loadWorkflowControl(`Created ${workflowLabel(body.run)} run`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'EU_LDT_PLAY_VISUALISE_RUN_CREATE_FAILED'),
      }))
    }
  }

  async function createEuLdtDataModellerPrepareSchemaRun() {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const cityId = requireActiveCityId()
      if (!euLdtDataModellerDraft.integrationProfileKey) throw new Error('EU_LDT_DATA_MODELLER_PROFILE_REQUIRED')
      const body = await fetch('/api/admin/workflows/eu-ldt-data-modeller-prepare-schema/runs', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cityId,
          triggerKind: 'operator-ui',
          input: {
            integrationProfileKey: euLdtDataModellerDraft.integrationProfileKey,
            entityType: euLdtDataModellerDraft.entityType,
            limit: Number(euLdtDataModellerDraft.sampleLimit) || 25,
            schemaName: euLdtDataModellerDraft.schemaName,
            referenceName: euLdtDataModellerDraft.referenceName,
            version: euLdtDataModellerDraft.version,
            ownership: euLdtDataModellerDraft.ownership,
            outputField: euLdtDataModellerDraft.outputField,
            outputMinimum: Number(euLdtDataModellerDraft.outputMinimum),
            outputMaximum: Number(euLdtDataModellerDraft.outputMaximum),
            tags: ['OLDT', 'EU LDT', cityId],
          },
        }),
      }).then(readJson)
      await loadWorkflowControl(`Created ${workflowLabel(body.run)} run`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'EU_LDT_DATA_MODELLER_SCHEMA_RUN_CREATE_FAILED'),
      }))
    }
  }

  async function createEuLdtDataModellerFixtureImportRun() {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const cityId = requireActiveCityId()
      if (!euLdtDataModellerDraft.integrationProfileKey) throw new Error('EU_LDT_DATA_MODELLER_PROFILE_REQUIRED')
      if (!euLdtDataModellerDraft.schemaId.trim()) throw new Error('EU_LDT_DATA_MODELLER_SCHEMA_ID_REQUIRED')
      const body = await fetch('/api/admin/workflows/eu-ldt-data-modeller-fixture-import/runs', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cityId,
          triggerKind: 'operator-ui',
          input: {
            integrationProfileKey: euLdtDataModellerDraft.integrationProfileKey,
            schemaId: euLdtDataModellerDraft.schemaId.trim(),
            entityType: euLdtDataModellerDraft.entityType,
            recordCount: Number(euLdtDataModellerDraft.recordCount) || 25,
            minimumEvaluationScore: Number(euLdtDataModellerDraft.minimumEvaluationScore) || 80,
            modelKey: euLdtDataModellerDraft.modelKey,
            modelVersion: euLdtDataModellerDraft.modelVersion,
            outputField: euLdtDataModellerDraft.outputField,
            outputKey: euLdtDataModellerDraft.outputKey,
            unit: euLdtDataModellerDraft.unit,
          },
        }),
      }).then(readJson)
      await loadWorkflowControl(`Created ${workflowLabel(body.run)} run`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'EU_LDT_DATA_MODELLER_FIXTURE_RUN_CREATE_FAILED'),
      }))
    }
  }

  async function approveRun(run) {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const detail = await fetch(`/api/admin/workflow-runs/${run.id}`, { credentials: 'same-origin' }).then(readJson)
      const approvals = detail.run?.approvals ?? []
      for (const approval of approvals.filter((entry) => entry.status === 'requested')) {
        await fetch(`/api/admin/workflow-runs/${run.id}/approvals/${approval.approvalKey}/decision`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            decision: 'approved',
            reason: `Operator approval for ${approval.approvalKey}`,
          }),
        }).then(readJson)
      }
      await loadWorkflowControl(`Approved ${approvals.filter((entry) => entry.status === 'requested').length} decisions`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'WORKFLOW_APPROVAL_FAILED'),
      }))
    }
  }

  async function promoteIngestionJob(row) {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      await fetch(`/api/admin/ingestion-jobs/${row.key}/promote`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ submittedBy: 'open-data-operator-ui' }),
      }).then(readJson)
      await loadWorkflowControl(`Queued ${row.layer}`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'INGESTION_JOB_PROMOTE_FAILED'),
      }))
    }
  }

  async function createOfflineDataFactoryHandoff(stageKey) {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const body = await fetch(`/api/admin/cities/${encodeURIComponent(requireActiveCityId())}/data-factory/offline-handoffs`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          stageKey,
          submittedBy: 'operations-ingestion-ui',
        }),
      }).then(readJson)
      await loadWorkflowControl(`Created offline handoff for ${body.handoff?.stageKey ?? stageKey}`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'OFFLINE_DATA_FACTORY_HANDOFF_FAILED'),
      }))
    }
  }

  async function runOfflineDataFactoryStage(stageKey, runnerOptions = {}, executorProfile = 'local-process') {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const body = await fetch(`/api/admin/cities/${encodeURIComponent(requireActiveCityId())}/data-factory/offline-runs`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          stageKey,
          executorProfile,
          submittedBy: 'operations-ingestion-ui',
          runnerOptions,
        }),
      }).then(readJson)
      await loadWorkflowControl(executorProfile === 'external-worker'
        ? `Prepared external Data Factory dispatch for ${body.stageKey ?? stageKey}`
        : `Ran Data Factory for ${body.stageKey ?? stageKey}`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'OFFLINE_DATA_FACTORY_RUN_FAILED'),
      }))
    }
  }

  async function runOfflineDataFactoryHandoff(handoff, runnerOptions = {}, executorProfile = 'local-process') {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const runId = String(handoff?.runId ?? '').trim()
      if (!runId) throw new Error('OFFLINE_HANDOFF_RUN_REQUIRED')
      const body = await fetch(`/api/admin/cities/${encodeURIComponent(requireActiveCityId())}/data-factory/offline-handoffs/${encodeURIComponent(runId)}/run`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          executorProfile,
          submittedBy: 'operations-ingestion-ui',
          runnerOptions,
        }),
      }).then(readJson)
      await loadWorkflowControl(executorProfile === 'external-worker'
        ? `Prepared external Data Factory dispatch for ${body.stageKey ?? handoff.stageKey}`
        : `Ran Data Factory for ${body.stageKey ?? handoff.stageKey}`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'OFFLINE_DATA_FACTORY_HANDOFF_RUN_FAILED'),
      }))
    }
  }

  async function ensureSameServerSidecarProvider() {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const cityId = requireActiveCityId()
      const body = await fetch('/api/admin/data-factory/providers/same-server-sidecar/ensure', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cityId,
          nodeKey: `same-server-sidecar-${cityId}`,
          runDoctor: true,
          requireDb: false,
          registeredBy: 'operations-ingestion-ui',
        }),
      }).then(readJson)
      await loadWorkflowControl(body.ready
        ? `Data Factory node ready: ${body.node?.nodeKey ?? 'same-server-sidecar'}`
        : `Data Factory node registered: ${body.node?.nodeKey ?? 'same-server-sidecar'}`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'DATA_FACTORY_SIDECAR_ENSURE_FAILED'),
      }))
    }
  }

  async function prepareCityInputPackage() {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const body = await fetch(`/api/admin/cities/${encodeURIComponent(requireActiveCityId())}/data-factory/city-input-packages`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          submittedBy: 'operations-ingestion-ui',
        }),
      }).then(readJson)
      await loadWorkflowControl(`Prepared city input package: ${body.packageKey ?? body.artifact?.artifactUri ?? 'ready'}`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'DATA_FACTORY_CITY_INPUT_PACKAGE_FAILED'),
      }))
    }
  }

  async function prepareDataFactoryProviderRun(options = {}) {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const body = await fetch(`/api/admin/cities/${encodeURIComponent(requireActiveCityId())}/data-factory/runs`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          stageKey: options.stageKey ?? 'viewer-artifacts',
          providerType: options.providerType ?? 'server-to-server-pull',
          nodeKey: options.nodeKey ?? '',
          cityInputPolicy: options.cityInputPolicy ?? 'reuse-latest-or-create',
          artifactTransferPolicy: options.artifactTransferPolicy ?? {
            transferMode: 'runtime-bundle',
            activationMode: 'staged',
          },
          promotionPolicy: options.promotionPolicy ?? 'stage-applicator',
          runPolicy: options.runPolicy ?? 'dispatch-only',
          submittedBy: 'operations-ingestion-ui',
        }),
      }).then(readJson)
      await loadWorkflowControl(`Prepared Data Factory ${body.providerType ?? 'provider'} run: ${body.status ?? 'ready'}`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'DATA_FACTORY_PROVIDER_RUN_FAILED'),
      }))
    }
  }

  async function saveDataFactoryStageMode(stageKey, executionMode) {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const body = await fetch(`/api/admin/cities/${encodeURIComponent(requireActiveCityId())}/data-factory/stages/${encodeURIComponent(stageKey)}/execution-mode`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          executionMode,
          updatedBy: 'operations-ingestion-ui',
        }),
      }).then(readJson)
      await loadWorkflowControl(`Saved Data Factory mode for ${body.stageKey ?? stageKey}`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'DATA_FACTORY_EXECUTION_MODE_SAVE_FAILED'),
      }))
    }
  }

  async function fetchOfflineResultTemplate(handoff, promotionMode = 'operations-ledger') {
    const runId = String(handoff?.runId ?? '').trim()
    if (!runId) throw new Error('OFFLINE_RESULT_RUN_REQUIRED')
    const params = new URLSearchParams({ promotionMode })
    const body = await fetch(`/api/admin/cities/${encodeURIComponent(requireActiveCityId())}/data-factory/offline-handoffs/${encodeURIComponent(runId)}/result-template?${params.toString()}`, {
      credentials: 'same-origin',
    }).then(readJson)
    return body.resultPackage ?? body.result_package ?? body
  }

  async function prepareOfflineResultImport(handoff, promotionMode = offlineResultDraft.promotionMode || 'operations-ledger') {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const resultPackage = await fetchOfflineResultTemplate(handoff, promotionMode)
      setOfflineResultDraft({
        runId: handoff.runId,
        stageKey: handoff.stageKey,
        promotionMode,
        payload: JSON.stringify(resultPackage, null, 2),
        error: '',
      })
      setWorkflowControl((current) => ({ ...current, loading: false }))
    } catch (error) {
      setOfflineResultDraft({
        runId: handoff?.runId ?? '',
        stageKey: handoff?.stageKey ?? '',
        promotionMode,
        payload: '',
        error: String(error?.message ?? 'OFFLINE_RESULT_TEMPLATE_FAILED'),
      })
      setWorkflowControl((current) => ({ ...current, loading: false }))
    }
  }

  async function setOfflineResultPromotionMode(promotionMode) {
    const handoff = (operationsReport?.dataFactory?.offlineHandoffs ?? []).find((entry) => entry.runId === offlineResultDraft.runId)
    if (!handoff) {
      setOfflineResultDraft((current) => ({ ...current, promotionMode }))
      return
    }
    await prepareOfflineResultImport(handoff, promotionMode)
  }

  async function importOfflineDataFactoryResult() {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const runId = String(offlineResultDraft.runId ?? '').trim()
      if (!runId) throw new Error('OFFLINE_RESULT_RUN_REQUIRED')
      const parsed = JSON.parse(offlineResultDraft.payload || '{}')
      const resultPackage = {
        ...parsed,
        runId: parsed.runId ?? runId,
        cityId: parsed.cityId ?? requireActiveCityId(),
        stageKey: parsed.stageKey ?? offlineResultDraft.stageKey,
      }
      const body = await fetch(`/api/admin/cities/${encodeURIComponent(requireActiveCityId())}/data-factory/offline-handoffs/${encodeURIComponent(runId)}/result`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          resultPackage,
          submittedBy: 'operations-ingestion-ui',
        }),
      }).then(readJson)
      setOfflineResultDraft((current) => ({ ...current, error: '' }))
      await loadWorkflowControl(`Imported offline result for ${body.result?.stageKey ?? offlineResultDraft.stageKey}`)
      refreshWorkspace?.()
    } catch (error) {
      setOfflineResultDraft((current) => ({
        ...current,
        error: String(error?.message ?? 'OFFLINE_RESULT_IMPORT_FAILED'),
      }))
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'OFFLINE_RESULT_IMPORT_FAILED'),
      }))
    }
  }

  async function inspectRun(run) {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: `Inspecting ${workflowLabel(run)}`, inspectingRunId: run.id }))
    try {
      const detail = await fetch(`/api/admin/workflow-runs/${run.id}/trace`, { credentials: 'same-origin' }).then(readJson)
      if (!detail?.ok || !detail?.run) throw new Error(detail?.error ?? 'WORKFLOW_RUN_TRACE_EMPTY')
      if (detail.run?.output?.summary?.schemaId) {
        setEuLdtDataModellerDraft((current) => ({ ...current, schemaId: detail.run.output.summary.schemaId }))
      }
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: '',
        message: `Selected ${workflowLabel(detail.run)}`,
        selectedRun: detail.run,
        selectedRunManifest: detail.manifest ?? null,
        selectedRunTrace: detail.trace ?? null,
        inspectingRunId: '',
      }))
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        inspectingRunId: '',
        error: String(error?.message ?? 'WORKFLOW_INSPECTION_FAILED'),
      }))
    }
  }

  async function executeRun(run) {
    setWorkflowControl((current) => ({ ...current, loading: true, error: '', message: '' }))
    try {
      const executed = await fetch(`/api/admin/workflow-runs/${run.id}/execute`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workerId: 'open-data-operator-ui' }),
      }).then(readJson)
      if (executed?.summary?.schemaId || executed?.run?.output?.summary?.schemaId) {
        setEuLdtDataModellerDraft((current) => ({
          ...current,
          schemaId: executed.summary?.schemaId ?? executed.run.output.summary.schemaId,
        }))
      }
      await loadWorkflowControl(`Executed ${workflowLabel(run)}`)
      refreshWorkspace?.()
    } catch (error) {
      setWorkflowControl((current) => ({
        ...current,
        loading: false,
        error: String(error?.message ?? 'WORKFLOW_EXECUTION_FAILED'),
      }))
    }
  }

  useEffect(() => {
    if (['workflows', 'ingestion'].includes(operationsView)) loadWorkflowControl()
  }, [operationsView, loadWorkflowControl])

  const citySourcePlan = workflowControl.sourcePlan
  const citySourcePreset = citySourcePlan?.sourcePlan?.preset ?? {}
  const boundaryGate = citySourcePlan?.boundaryGate ?? null
  const viewerArtifacts = workflowControl.viewerArtifacts?.artifacts ?? []
  const viewerArtifactSummary = workflowControl.viewerArtifacts?.summary ?? { total: 0, bytes: 0, byType: {} }

  return {
    adapterRows,
    approveRun,
    boundaryGate,
    citySourcePlan,
    citySourcePreset,
    controlledWorkflowRuns,
    createCityBootstrapRun,
    createEuLdtDataPlatformImportRun,
    createEuLdtDataPlatformPublishRun,
    createEuLdtDataModellerFixtureImportRun,
    createEuLdtDataModellerPrepareSchemaRun,
    createEuLdtPlayVisualiseRegisterLayerRun,
    createOfflineDataFactoryHandoff,
    createPhase14Run,
    euLdtWorkflowDraft,
    euLdtDataModellerDraft,
    euLdtVisualiseDraft,
    executeRun,
    ensureSameServerSidecarProvider,
    importOfflineDataFactoryResult,
    inspectRun,
    layerOptions,
    loadWorkflowControl,
    manualLayerKey,
    offlineResultDraft,
    phase14Workflow,
    prepareCityInputPackage,
    prepareDataFactoryProviderRun,
    prepareOfflineResultImport,
    promoteIngestionJob,
    processingNodes: workflowControl.processingNodes ?? [],
    registerViewerArtifacts,
    repairBoundaryGate,
    runOfflineDataFactoryHandoff,
    runOfflineDataFactoryStage,
    saveCitySourcePlan,
    saveDataFactoryStageMode,
    selectedLayer,
    setManualLayerKey,
    setOfflineResultDraft,
    setOfflineResultPromotionMode,
    setEuLdtWorkflowDraft,
    setEuLdtDataModellerDraft,
    setEuLdtVisualiseDraft,
    setSourcePackage,
    setSourcePlanForm,
    setUsesManualLayerKey,
    sourcePackage,
    sourcePlanForm,
    usesManualLayerKey,
    viewerArtifacts,
    viewerArtifactSummary,
    workflowControl,
    workflowLabel,
  }
}
