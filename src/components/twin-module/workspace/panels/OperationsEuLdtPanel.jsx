import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Spinner } from 'react-bootstrap'
import { compactList, formatDate, keyList, statusVariant, titleize } from '../ldtWorkspaceModel'

const DEFAULT_MARKETPLACE_PAYLOAD = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'oldt-marketplace-package',
      properties: {
        name: 'OLDT Marketplace package',
        semanticClass: 'MarketplaceEvidence',
      },
      geometry: {
        type: 'Point',
        coordinates: [-101.2574, 21.019],
      },
    },
  ],
}

async function readJson(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || body?.detail || `HTTP_${response.status}`)
  }
  return body
}

function endpointSummary(profile = {}) {
  const endpoints = profile.endpoints ?? {}
  return Object.entries(endpoints)
    .filter(([, value]) => typeof value === 'string' && value)
    .slice(0, 4)
}

function checkSummary(profile = {}) {
  const checks = profile.lastCheck?.checks ?? []
  if (!checks.length) return 'No checks run'
  const passed = checks.filter((check) => check.ok).length
  return `${passed}/${checks.length} checks passed`
}

function splitList(value = '') {
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function hubExploreUrl(offeringId = '') {
  return offeringId
    ? `http://marketplace.127.0.0.1.nip.io:4314/explore/${encodeURIComponent(offeringId)}`
    : ''
}

function publishState(result = {}) {
  return result.body?.publishState ?? result.body?.publish_state ?? {}
}

function marketplaceEvidenceFromResult(body = {}) {
  const artifacts = body.artifacts ?? []
  const publishArtifact = artifacts.find((artifact) => artifact.artifactKind === 'marketplace-agent-publish')
  const uploadArtifact = artifacts.find((artifact) => artifact.artifactKind === 'marketplace-agent-upload')
  const metadataArtifact = artifacts.find((artifact) => artifact.artifactKind === 'marketplace-agent-metadata')
  const publishResults = publishArtifact?.metadata?.results ?? []
  const uploadResults = uploadArtifact?.metadata?.results ?? []
  const metadataResults = metadataArtifact?.metadata?.results ?? []
  const rows = (publishResults.length ? publishResults : uploadResults).map((result) => {
    const state = publishState(result)
    const upload = uploadResults.find((entry) => entry.profileKey === result.profileKey) ?? {}
    const metadata = metadataResults.find((entry) => entry.profileKey === result.profileKey) ?? {}
    const offeringId = state.offering_id ?? state.offeringId ?? result.body?.offeringId ?? ''
    return {
      profileKey: result.profileKey,
      assetId: result.assetId ?? upload.body?.id ?? result.body?.id ?? '',
      status: result.body?.status ?? result.status ?? (result.ok ? 'published' : 'failed'),
      offeringId,
      productSpecId: state.prod_spec_id ?? state.product_spec_id ?? state.productSpecId ?? '',
      resourceSpecId: state.res_spec_id ?? state.resource_spec_id ?? state.resourceSpecId ?? '',
      metadataMatched: metadata.matched ?? metadata.ok ?? null,
      exploreUrl: hubExploreUrl(offeringId),
    }
  })
  return {
    runId: body.run?.id ?? body.summary?.workflowRunId ?? '',
    runStatus: body.run?.status ?? '',
    summary: body.summary ?? {},
    rows,
  }
}

export default function OperationsEuLdtPanel() {
  const [profiles, setProfiles] = useState([])
  const [recentRuns, setRecentRuns] = useState([])
  const [loading, setLoading] = useState(false)
  const [testingKey, setTestingKey] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selectedProfileKeys, setSelectedProfileKeys] = useState([])
  const [agentForm, setAgentForm] = useState({
    profileKey: 'local-eu-ldt-marketplace-agent-new',
    displayName: 'Local EU LDT Marketplace Agent',
    baseUrl: '',
    bearerToken: '',
    cityId: 'guanajuato',
    defaultCategories: 'EU LDT Toolbox',
  })
  const [publishForm, setPublishForm] = useState({
    title: `OLDT Marketplace package ${Date.now()}`,
    description: 'OLDT semantic package published to a configured EU LDT Marketplace Agent.',
    assetType: 'oldt.semantic-layer',
    licence: 'CC-BY-4.0',
    categories: 'EU LDT Toolbox',
    compatibilityTargets: 'oldt,data-platform,play-visualise,marketplace',
    publishToHub: true,
    payloadJson: JSON.stringify(DEFAULT_MARKETPLACE_PAYLOAD, null, 2),
  })
  const [publishEvidence, setPublishEvidence] = useState(null)
  const [savingDataModeller, setSavingDataModeller] = useState(false)
  const [dataModellerForm, setDataModellerForm] = useState({
    profileKey: 'local-eu-ldt-data-modeller',
    displayName: 'Local EU LDT Data Modeller',
    backendUrl: 'http://host.docker.internal:4321',
    publicFrontendUrl: 'http://localhost:4320',
    authType: 'none',
    bearerToken: '',
    cityId: 'guanajuato',
  })
  const [savingDataSpace, setSavingDataSpace] = useState(false)
  const [dataSpaceForm, setDataSpaceForm] = useState({
    profileKey: 'local-eu-ldt-data-space-provider',
    displayName: 'Local EU LDT Data Space Provider',
    role: 'provider',
    backendUrl: 'http://host.docker.internal:4331',
    managementUrl: 'http://host.docker.internal:8182/api/management/v3',
    dspUrl: 'http://provider-connector:9084/api/dsp',
    apiKey: 'api-key-provider-connector',
    participantId: 'provider-connector',
    oldtPackageBaseUrl: 'http://host.docker.internal:4292',
    publicFrontendUrl: 'http://data-space-ready.127.0.0.1.nip.io:4330',
    cityId: 'guanajuato',
  })
  const [savingCip, setSavingCip] = useState(false)
  const [cipAction, setCipAction] = useState('')
  const [cipState, setCipState] = useState({ bindings: [], measurements: [], initiatives: [], counts: {} })
  const [cipForm, setCipForm] = useState({
    profileKey: 'local-eu-ldt-city-innovation-planner',
    displayName: 'Local EU LDT City Innovation Planner',
    backendUrl: 'http://host.docker.internal:4351',
    publicFrontendUrl: 'http://localhost:4350',
    authType: 'none',
    bearerToken: '',
    tokenUrl: '',
    clientId: '',
    clientSecret: '',
    cityId: 'guanajuato',
    dataPlatformProfileKey: 'local-eu-ldt-data-platform',
    selectionSetId: '',
    cipKpiId: '',
    kpiName: 'OLDT selected objects',
    metricKey: 'result_count',
    attributeKey: '',
    aggregation: 'value',
    unit: 'objects',
    ngsiProperty: 'observedValue',
    createKpi: true,
    requestCalculation: false,
    initiativeId: '',
    initiativeSelectionSetId: '',
  })
  const [savingUcs, setSavingUcs] = useState(false)
  const [ucsAction, setUcsAction] = useState('')
  const [ucsState, setUcsState] = useState({ bindings: [], counts: {} })
  const [ucsForm, setUcsForm] = useState({
    profileKey: 'local-eu-ldt-use-case-scenarios',
    displayName: 'Local EU LDT Use Case & Scenarios',
    backendUrl: 'http://host.docker.internal:3001',
    publicFrontendUrl: 'http://localhost:5002',
    authType: 'oauth2-client-credentials',
    bearerToken: '',
    tokenUrl: 'http://host.docker.internal:9080/realms/LDT/protocol/openid-connect/token',
    clientId: 'tool2-workflow',
    clientSecret: '',
    cityId: 'guanajuato',
    dataPlatformProfileKey: 'local-eu-ldt-data-platform',
    selectionSetId: '',
    baselineValue: '',
    interventionValue: '',
    interventionDeltaPercent: '-20',
    metricKey: 'result_count',
    aggregation: 'value',
    unit: 'objects',
    modelNamespace: 'dev',
    modelName: 'echo-model',
    caseName: '',
    ngsiScope: 'default',
  })

  const marketplaceProfiles = useMemo(
    () => profiles.filter((profile) => profile.platformKind === 'marketplace-agent'),
    [profiles],
  )
  const cipProfiles = useMemo(
    () => profiles.filter((profile) => profile.platformKind === 'city-innovation-planner'),
    [profiles],
  )
  const dataPlatformProfiles = useMemo(
    () => profiles.filter((profile) => profile.platformKind === 'data-platform'),
    [profiles],
  )
  const ucsProfiles = useMemo(
    () => profiles.filter((profile) => profile.platformKind === 'use-case-scenarios'),
    [profiles],
  )

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const body = await fetch('/api/admin/eu-ldt/integrations', {
        credentials: 'same-origin',
      }).then(readJson)
      setProfiles(body.profiles ?? [])
    } catch (caughtError) {
      setError(String(caughtError?.message ?? 'EU_LDT_INTEGRATIONS_UNAVAILABLE'))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRecentRuns = useCallback(async () => {
    try {
      const body = await fetch('/api/admin/workflow-runs?workflowKey=eu-ldt-marketplace-agent-publish&limit=6&includeInactive=true', {
        credentials: 'same-origin',
      }).then(readJson)
      setRecentRuns(body.runs ?? [])
    } catch {
      setRecentRuns([])
    }
  }, [])

  const loadCipState = useCallback(async (profileKey = cipForm.profileKey) => {
    try {
      const params = new URLSearchParams({ cityId: cipForm.cityId, limit: '50' })
      if (profileKey) params.set('cipProfileKey', profileKey)
      const body = await fetch(`/api/admin/eu-ldt/cip/state?${params.toString()}`, {
        credentials: 'same-origin',
      }).then(readJson)
      setCipState(body)
    } catch (caughtError) {
      setError(String(caughtError?.message ?? 'CIP_EXCHANGE_STATE_UNAVAILABLE'))
    }
  }, [cipForm.cityId, cipForm.profileKey])

  const loadUcsState = useCallback(async (profileKey = ucsForm.profileKey) => {
    try {
      const params = new URLSearchParams({ cityId: ucsForm.cityId, limit: '50' })
      if (profileKey) params.set('ucsProfileKey', profileKey)
      const body = await fetch(`/api/admin/eu-ldt/ucs/state?${params.toString()}`, {
        credentials: 'same-origin',
      }).then(readJson)
      setUcsState(body)
    } catch (caughtError) {
      setError(String(caughtError?.message ?? 'UCS_EXCHANGE_STATE_UNAVAILABLE'))
    }
  }, [ucsForm.cityId, ucsForm.profileKey])

  useEffect(() => {
    loadProfiles()
    loadRecentRuns()
    loadCipState()
    loadUcsState()
  }, [loadCipState, loadProfiles, loadRecentRuns, loadUcsState])

  useEffect(() => {
    if (selectedProfileKeys.length || !marketplaceProfiles.length) return
    const validated = marketplaceProfiles.filter((profile) => profile.status === 'validated')
    setSelectedProfileKeys((validated.length ? validated : marketplaceProfiles).map((profile) => profile.profileKey))
  }, [marketplaceProfiles, selectedProfileKeys.length])

  const testProfile = useCallback(async (profileKey) => {
    setTestingKey(profileKey)
    setError('')
    setMessage('')
    try {
      const body = await fetch(`/api/admin/eu-ldt/integrations/${encodeURIComponent(profileKey)}/test`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }).then(readJson)
      setProfiles((current) => current.map((profile) => (
        profile.profileKey === profileKey ? body.profile : profile
      )))
      setMessage(`${body.profile?.displayName ?? profileKey}: ${checkSummary(body.profile)}`)
    } catch (caughtError) {
      setError(String(caughtError?.message ?? 'EU_LDT_INTEGRATION_TEST_FAILED'))
    } finally {
      setTestingKey('')
    }
  }, [])

  const updateAgentForm = useCallback((key, value) => {
    setAgentForm((current) => ({ ...current, [key]: value }))
  }, [])

  const updatePublishForm = useCallback((key, value) => {
    setPublishForm((current) => ({ ...current, [key]: value }))
  }, [])

  const updateDataModellerForm = useCallback((key, value) => {
    setDataModellerForm((current) => ({ ...current, [key]: value }))
  }, [])

  const updateDataSpaceForm = useCallback((key, value) => {
    setDataSpaceForm((current) => ({ ...current, [key]: value }))
  }, [])

  const updateCipForm = useCallback((key, value) => {
    setCipForm((current) => ({ ...current, [key]: value }))
  }, [])

  const updateUcsForm = useCallback((key, value) => {
    setUcsForm((current) => ({ ...current, [key]: value }))
  }, [])

  const executeApprovedWorkflow = useCallback(async ({ workflowKey, input, triggerKind, workerId, cityId = cipForm.cityId }) => {
    const created = await fetch(`/api/admin/workflows/${encodeURIComponent(workflowKey)}/runs`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cityId,
        triggerKind,
        input,
      }),
    }).then(readJson)
    for (const approval of created.run?.approvals ?? []) {
      await fetch(`/api/admin/workflow-runs/${encodeURIComponent(created.run.id)}/approvals/${encodeURIComponent(approval.approvalKey)}/decision`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision: 'approved',
          reason: `Operator approved ${workflowKey} from the EU LDT integration workspace.`,
        }),
      }).then(readJson)
    }
    return fetch(`/api/admin/workflow-runs/${encodeURIComponent(created.run.id)}/execute`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workerId }),
    }).then(readJson)
  }, [cipForm.cityId])

  const saveUcsProfile = useCallback(async () => {
    setSavingUcs(true)
    setError('')
    setMessage('')
    try {
      const baseUrl = ucsForm.backendUrl.trim().replace(/\/+$/, '').replace(/\/api\/v1$/i, '')
      if (!baseUrl) throw new Error('UCS_BACKEND_URL_REQUIRED')
      let authConfig = { type: 'none' }
      if (ucsForm.authType === 'bearer') {
        if (!ucsForm.bearerToken.trim()) throw new Error('UCS_BEARER_TOKEN_REQUIRED')
        authConfig = { type: 'bearer', token: ucsForm.bearerToken.trim() }
      }
      if (ucsForm.authType === 'oauth2-client-credentials') {
        if (!ucsForm.tokenUrl.trim() || !ucsForm.clientId.trim() || !ucsForm.clientSecret.trim()) {
          throw new Error('UCS_OAUTH2_FIELDS_REQUIRED')
        }
        authConfig = {
          type: 'oauth2-client-credentials',
          tokenUrl: ucsForm.tokenUrl.trim(),
          clientId: ucsForm.clientId.trim(),
          clientSecret: ucsForm.clientSecret.trim(),
          scope: 'openid profile email',
        }
      }
      const apiBaseUrl = `${baseUrl}/api/v1`
      const profile = {
        profileKey: ucsForm.profileKey,
        displayName: ucsForm.displayName,
        platformKind: 'use-case-scenarios',
        baseUrl,
        cityId: ucsForm.cityId || null,
        remoteCityId: ucsForm.cityId || null,
        status: 'registered',
        authConfig,
        endpoints: {
          apiBaseUrl,
          healthUrl: `${apiBaseUrl}/health`,
          openApiUrl: `${baseUrl}/documentation/json`,
          casesUrl: `${apiBaseUrl}/cases`,
          scenariosUrl: `${apiBaseUrl}/scenarios`,
          experimentExecutionsUrl: `${apiBaseUrl}/experiment-executions`,
          dataPlatformScopesUrl: `${apiBaseUrl}/data-platform/scopes`,
          aiNamespacesUrl: `${apiBaseUrl}/ai-notebook/namespaces`,
          publicFrontendUrl: ucsForm.publicFrontendUrl.trim() || undefined,
        },
        capabilities: {
          caseLifecycle: true,
          baselineInterventionScenarios: true,
          dataPlatformSources: true,
          airflowExecution: true,
          aiNotebookModels: true,
          executionReadback: true,
          oldtProvenanceBinding: true,
        },
        metadata: {
          origin: 'oldt-operator-ui',
          optionalAddon: true,
          note: 'Configurable EU LDT Use Case & Scenarios target. OLDT remains standalone when this profile is absent or disabled.',
        },
      }
      const body = await fetch('/api/admin/eu-ldt/integrations', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile }),
      }).then(readJson)
      setMessage(`Use Case & Scenarios saved: ${body.profile?.displayName ?? ucsForm.profileKey}`)
      await loadProfiles()
    } catch (caughtError) {
      setError(String(caughtError?.message ?? 'UCS_PROFILE_SAVE_FAILED'))
    } finally {
      setSavingUcs(false)
    }
  }, [loadProfiles, ucsForm])

  const runUcsRoundtrip = useCallback(async () => {
    setUcsAction('run')
    setError('')
    setMessage('')
    try {
      if (!ucsForm.selectionSetId.trim() && !ucsForm.baselineValue.trim()) {
        throw new Error('UCS_SELECTION_OR_BASELINE_REQUIRED')
      }
      const executed = await executeApprovedWorkflow({
        workflowKey: 'eu-ldt-use-case-scenarios-roundtrip',
        triggerKind: 'operator-ucs-roundtrip',
        workerId: 'oldt-ucs-ui',
        cityId: ucsForm.cityId,
        input: {
          ucsProfileKey: ucsForm.profileKey,
          dataPlatformProfileKey: ucsForm.dataPlatformProfileKey,
          selectionSetId: ucsForm.selectionSetId.trim() || undefined,
          baselineValue: ucsForm.baselineValue.trim() === '' ? undefined : Number(ucsForm.baselineValue),
          interventionValue: ucsForm.interventionValue.trim() === '' ? undefined : Number(ucsForm.interventionValue),
          interventionDeltaPercent: Number(ucsForm.interventionDeltaPercent),
          metricKey: ucsForm.metricKey.trim() || undefined,
          aggregation: ucsForm.aggregation,
          unit: ucsForm.unit.trim(),
          modelNamespace: ucsForm.modelNamespace.trim(),
          modelName: ucsForm.modelName.trim(),
          caseName: ucsForm.caseName.trim() || undefined,
          ngsiScope: ucsForm.ngsiScope.trim() || 'default',
        },
      })
      const summary = executed.summary ?? executed.run?.output?.summary ?? {}
      setMessage(`UCS roundtrip completed: ${summary.baseline?.value ?? ''} -> ${summary.intervention?.value ?? ''} ${summary.unit ?? ''}.`)
      await loadUcsState(ucsForm.profileKey)
    } catch (caughtError) {
      setError(String(caughtError?.message ?? 'UCS_ROUNDTRIP_FAILED'))
    } finally {
      setUcsAction('')
    }
  }, [executeApprovedWorkflow, loadUcsState, ucsForm])

  const saveCipProfile = useCallback(async () => {
    setSavingCip(true)
    setError('')
    setMessage('')
    try {
      const baseUrl = cipForm.backendUrl.trim().replace(/\/+$/, '').replace(/\/api\/v1$/i, '')
      if (!baseUrl) throw new Error('CIP_BACKEND_URL_REQUIRED')
      let authConfig = { type: 'none' }
      if (cipForm.authType === 'bearer') {
        if (!cipForm.bearerToken.trim()) throw new Error('CIP_BEARER_TOKEN_REQUIRED')
        authConfig = { type: 'bearer', token: cipForm.bearerToken.trim() }
      }
      if (cipForm.authType === 'oauth2-client-credentials') {
        if (!cipForm.tokenUrl.trim() || !cipForm.clientId.trim() || !cipForm.clientSecret.trim()) {
          throw new Error('CIP_OAUTH2_FIELDS_REQUIRED')
        }
        authConfig = {
          type: 'oauth2-client-credentials',
          tokenUrl: cipForm.tokenUrl.trim(),
          clientId: cipForm.clientId.trim(),
          clientSecret: cipForm.clientSecret.trim(),
        }
      }
      const apiBaseUrl = `${baseUrl}/api/v1`
      const profile = {
        profileKey: cipForm.profileKey,
        displayName: cipForm.displayName,
        platformKind: 'city-innovation-planner',
        baseUrl,
        cityId: cipForm.cityId || null,
        remoteCityId: cipForm.cityId || null,
        status: 'registered',
        authConfig,
        endpoints: {
          apiBaseUrl,
          healthUrl: `${apiBaseUrl}/health`,
          openApiUrl: `${baseUrl}/documentation/json`,
          kpisUrl: `${apiBaseUrl}/kpis`,
          kpiMeasurementsUrl: `${apiBaseUrl}/kpi-measurements`,
          initiativesUrl: `${apiBaseUrl}/initiatives`,
          publicFrontendUrl: cipForm.publicFrontendUrl.trim() || undefined,
        },
        capabilities: {
          readKpis: true,
          configureBrokerDatasource: true,
          readKpiMeasurements: true,
          readInitiatives: true,
          requestCalculation: true,
          dataPlatformBackedMetrics: true,
          spatialBindingsOwnedByOldt: true,
        },
        metadata: {
          origin: 'oldt-operator-ui',
          optionalAddon: true,
          note: 'Configurable City Innovation Planner target. OLDT remains standalone when this profile is absent or disabled.',
        },
      }
      const body = await fetch('/api/admin/eu-ldt/integrations', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile }),
      }).then(readJson)
      setMessage(`City Innovation Planner saved: ${body.profile?.displayName ?? cipForm.profileKey}`)
      await loadProfiles()
    } catch (caughtError) {
      setError(String(caughtError?.message ?? 'CIP_PROFILE_SAVE_FAILED'))
    } finally {
      setSavingCip(false)
    }
  }, [cipForm, loadProfiles])

  const publishCipMetricSource = useCallback(async () => {
    setCipAction('publish')
    setError('')
    setMessage('')
    try {
      if (!cipForm.selectionSetId.trim()) throw new Error('CIP_SELECTION_SET_REQUIRED')
      const executed = await executeApprovedWorkflow({
        workflowKey: 'eu-ldt-cip-publish-metric-source',
        triggerKind: 'operator-cip-metric-publication',
        workerId: 'oldt-cip-ui',
        input: {
          cipProfileKey: cipForm.profileKey,
          dataPlatformProfileKey: cipForm.dataPlatformProfileKey,
          selectionSetId: cipForm.selectionSetId.trim(),
          cipKpiId: cipForm.cipKpiId.trim() || undefined,
          createKpi: cipForm.createKpi,
          kpiName: cipForm.kpiName.trim(),
          metricKey: cipForm.metricKey.trim() || undefined,
          attributeKey: cipForm.attributeKey.trim() || undefined,
          aggregation: cipForm.aggregation,
          unit: cipForm.unit.trim(),
          ngsiProperty: cipForm.ngsiProperty.trim(),
          requestCalculation: cipForm.requestCalculation,
        },
      })
      const summary = executed.summary ?? executed.run?.output?.summary ?? {}
      setMessage(`CIP metric source published: ${summary.value ?? 'value'} -> KPI ${summary.cipKpiId ?? ''}`)
      if (summary.cipKpiId) updateCipForm('cipKpiId', summary.cipKpiId)
      await loadCipState(cipForm.profileKey)
    } catch (caughtError) {
      setError(String(caughtError?.message ?? 'CIP_METRIC_PUBLICATION_FAILED'))
    } finally {
      setCipAction('')
    }
  }, [cipForm, executeApprovedWorkflow, loadCipState, updateCipForm])

  const syncCipResource = useCallback(async (kind) => {
    setCipAction(kind)
    setError('')
    setMessage('')
    try {
      const workflowKey = kind === 'measurements' ? 'eu-ldt-cip-sync-measurements' : 'eu-ldt-cip-sync-initiatives'
      const executed = await executeApprovedWorkflow({
        workflowKey,
        triggerKind: `operator-cip-${kind}-sync`,
        workerId: 'oldt-cip-ui',
        input: { cipProfileKey: cipForm.profileKey },
      })
      const summary = executed.summary ?? executed.run?.output?.summary ?? {}
      setMessage(kind === 'measurements'
        ? `CIP measurements synced: ${summary.inserted ?? 0} new, ${summary.updated ?? 0} updated.`
        : `CIP initiatives synced: ${summary.inserted ?? 0} new, ${summary.updated ?? 0} updated.`)
      await loadCipState(cipForm.profileKey)
    } catch (caughtError) {
      setError(String(caughtError?.message ?? `CIP_${kind.toUpperCase()}_SYNC_FAILED`))
    } finally {
      setCipAction('')
    }
  }, [cipForm.profileKey, executeApprovedWorkflow, loadCipState])

  const linkCipInitiative = useCallback(async () => {
    setCipAction('link')
    setError('')
    setMessage('')
    try {
      if (!cipForm.initiativeId.trim() || !cipForm.initiativeSelectionSetId.trim()) {
        throw new Error('CIP_INITIATIVE_AND_SELECTION_REQUIRED')
      }
      const body = await fetch('/api/admin/eu-ldt/cip/initiative-links', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cityId: cipForm.cityId,
          cipProfileKey: cipForm.profileKey,
          cipInitiativeId: cipForm.initiativeId.trim(),
          selectionSetId: cipForm.initiativeSelectionSetId.trim(),
        }),
      }).then(readJson)
      setMessage(`Initiative linked to ${body.initiative?.selectionTitle ?? cipForm.initiativeSelectionSetId}.`)
      await loadCipState(cipForm.profileKey)
    } catch (caughtError) {
      setError(String(caughtError?.message ?? 'CIP_INITIATIVE_LINK_FAILED'))
    } finally {
      setCipAction('')
    }
  }, [cipForm, loadCipState])

  const saveDataSpaceProfile = useCallback(async () => {
    setSavingDataSpace(true)
    setError('')
    setMessage('')
    try {
      const baseUrl = dataSpaceForm.backendUrl.trim().replace(/\/+$/, '')
      const managementUrl = dataSpaceForm.managementUrl.trim().replace(/\/+$/, '')
      if (!baseUrl || !managementUrl || !dataSpaceForm.apiKey.trim()) throw new Error('DATA_SPACE_CONNECTION_FIELDS_REQUIRED')
      if (dataSpaceForm.role === 'provider' && !dataSpaceForm.dspUrl.trim()) throw new Error('DATA_SPACE_PROVIDER_DSP_URL_REQUIRED')
      const isProvider = dataSpaceForm.role === 'provider'
      const profile = {
        profileKey: dataSpaceForm.profileKey,
        displayName: dataSpaceForm.displayName,
        platformKind: 'data-space-ready',
        baseUrl,
        cityId: dataSpaceForm.cityId || null,
        remoteCityId: dataSpaceForm.participantId || null,
        status: 'registered',
        authConfig: { type: 'none' },
        headers: [{ key: 'X-Api-Key', value: dataSpaceForm.apiKey.trim() }],
        endpoints: {
          healthUrl: `${baseUrl}/health`,
          readinessUrl: `${baseUrl}/health/readiness`,
          managementUrl,
          ...(isProvider ? { dspUrl: dataSpaceForm.dspUrl.trim() } : {}),
          oldtPackageBaseUrl: dataSpaceForm.oldtPackageBaseUrl.trim(),
          publicFrontendUrl: dataSpaceForm.publicFrontendUrl.trim() || undefined,
        },
        capabilities: isProvider
          ? { role: 'provider', edc: true, dsp: true, assetPublication: true, odrlPolicies: true, contractDefinitions: true, httpData: true }
          : { role: 'consumer', edc: true, dsp: true, catalogDiscovery: true, contractNegotiation: true, httpPushTransfer: true },
        metadata: {
          origin: 'oldt-operator-ui',
          participantId: dataSpaceForm.participantId.trim(),
          optionalAddon: true,
          note: 'Configurable EDC participant. OLDT remains standalone when data-space profiles are absent or disabled.',
        },
      }
      const body = await fetch('/api/admin/eu-ldt/integrations', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile }),
      }).then(readJson)
      setMessage(`Data-space participant saved: ${body.profile?.displayName ?? dataSpaceForm.profileKey}`)
      await loadProfiles()
    } catch (caughtError) {
      setError(String(caughtError?.message ?? 'DATA_SPACE_PROFILE_SAVE_FAILED'))
    } finally {
      setSavingDataSpace(false)
    }
  }, [dataSpaceForm, loadProfiles])

  const saveDataModellerProfile = useCallback(async () => {
    setSavingDataModeller(true)
    setError('')
    setMessage('')
    try {
      const enteredUrl = dataModellerForm.backendUrl.trim().replace(/\/+$/, '')
      if (!enteredUrl) throw new Error('DATA_MODELLER_BACKEND_URL_REQUIRED')
      if (dataModellerForm.authType === 'bearer' && !dataModellerForm.bearerToken.trim()) throw new Error('DATA_MODELLER_BEARER_TOKEN_REQUIRED')
      const baseUrl = enteredUrl.replace(/\/api\/v1$/i, '')
      const backendApiUrl = /\/api\/v1$/i.test(enteredUrl) ? enteredUrl : `${baseUrl}/api/v1`
      const profile = {
        profileKey: dataModellerForm.profileKey,
        displayName: dataModellerForm.displayName,
        platformKind: 'data-modeller',
        baseUrl,
        cityId: dataModellerForm.cityId || null,
        remoteCityId: dataModellerForm.cityId || null,
        status: 'registered',
        authConfig: dataModellerForm.authType === 'bearer'
          ? { type: 'bearer', token: dataModellerForm.bearerToken.trim() }
          : { type: 'none' },
        endpoints: {
          backendApiUrl,
          healthUrl: `${backendApiUrl}/health`,
          openApiUrl: `${baseUrl}/documentation/json`,
          publicFrontendUrl: dataModellerForm.publicFrontendUrl.trim() || undefined,
        },
        capabilities: {
          schemaCrud: true,
          schemaApprovalGate: true,
          syntheticDataGeneration: true,
          appendOnlyOldtImport: true,
        },
        metadata: {
          origin: 'oldt-operator-ui',
          optionalAddon: true,
          note: 'Configurable EU LDT Data Modeller target. OLDT remains standalone when this profile is absent or disabled.',
        },
      }
      const body = await fetch('/api/admin/eu-ldt/integrations', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile }),
      }).then(readJson)
      setMessage(`Data Modeller saved: ${body.profile?.displayName ?? dataModellerForm.profileKey}`)
      await loadProfiles()
    } catch (caughtError) {
      setError(String(caughtError?.message ?? 'DATA_MODELLER_PROFILE_SAVE_FAILED'))
    } finally {
      setSavingDataModeller(false)
    }
  }, [dataModellerForm, loadProfiles])

  const saveMarketplaceAgent = useCallback(async () => {
    setSavingProfile(true)
    setError('')
    setMessage('')
    try {
      const baseUrl = agentForm.baseUrl.trim().replace(/\/+$/, '')
      if (!baseUrl) throw new Error('MARKETPLACE_AGENT_BASE_URL_REQUIRED')
      if (!agentForm.bearerToken.trim()) throw new Error('MARKETPLACE_AGENT_BEARER_TOKEN_REQUIRED')
      const profile = {
        profileKey: agentForm.profileKey,
        displayName: agentForm.displayName,
        platformKind: 'marketplace-agent',
        baseUrl,
        cityId: agentForm.cityId || 'guanajuato',
        remoteCityId: agentForm.cityId || 'guanajuato',
        status: 'registered',
        authConfig: {
          type: 'bearer',
          token: agentForm.bearerToken.trim(),
        },
        endpoints: {
          assetsUrl: `${baseUrl}/api/v1/agent/assets`,
          metadataAssetsUrl: `${baseUrl}/api/v1/agent/metadata/assets`,
          livezUrl: `${baseUrl}/api/v1/agent/livez`,
          publicAgentUrl: baseUrl,
        },
        capabilities: {
          agentAssets: true,
          publishOfferings: true,
          metadataAssets: true,
        },
        metadata: {
          origin: 'oldt-operator-ui',
          note: 'Marketplace Agent profile configured from OLDT Operations UI.',
          defaultLicence: 'CC-BY-4.0',
          defaultCategories: splitList(agentForm.defaultCategories),
        },
      }
      const body = await fetch('/api/admin/eu-ldt/integrations', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile }),
      }).then(readJson)
      setMessage(`Marketplace Agent saved: ${body.profile?.displayName ?? agentForm.profileKey}`)
      await loadProfiles()
    } catch (caughtError) {
      setError(String(caughtError?.message ?? 'MARKETPLACE_AGENT_SAVE_FAILED'))
    } finally {
      setSavingProfile(false)
    }
  }, [agentForm, loadProfiles])

  const toggleMarketplaceProfile = useCallback((profileKey) => {
    setSelectedProfileKeys((current) => (
      current.includes(profileKey)
        ? current.filter((key) => key !== profileKey)
        : [...current, profileKey]
    ))
  }, [])

  const publishMarketplacePackage = useCallback(async () => {
    setPublishing(true)
    setError('')
    setMessage('')
    setPublishEvidence(null)
    try {
      if (!selectedProfileKeys.length) throw new Error('MARKETPLACE_AGENT_SELECTION_REQUIRED')
      const payload = JSON.parse(publishForm.payloadJson)
      const created = await fetch('/api/admin/workflows/eu-ldt-marketplace-agent-publish/runs', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cityId: 'guanajuato',
          triggerKind: 'operator-marketplace-publish',
          input: {
            dryRun: false,
            publishToHub: Boolean(publishForm.publishToHub),
            launchInMarketplace: false,
            integrationProfileKeys: selectedProfileKeys,
            assetType: publishForm.assetType,
            title: publishForm.title,
            description: publishForm.description,
            licence: publishForm.licence,
            categories: splitList(publishForm.categories),
            compatibilityTargets: splitList(publishForm.compatibilityTargets),
            payload,
          },
        }),
      }).then(readJson)

      for (const approval of created.run?.approvals ?? []) {
        await fetch(`/api/admin/workflow-runs/${encodeURIComponent(created.run.id)}/approvals/${encodeURIComponent(approval.approvalKey)}/decision`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            decision: 'approved',
            reason: 'Operator requested Marketplace Agent publication from OLDT UI.',
          }),
        }).then(readJson)
      }

      const executed = await fetch(`/api/admin/workflow-runs/${encodeURIComponent(created.run.id)}/execute`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workerId: 'oldt-marketplace-agent-ui' }),
      }).then(readJson)
      const evidence = marketplaceEvidenceFromResult(executed)
      setPublishEvidence(evidence)
      setMessage(`Marketplace publication workflow succeeded: ${evidence.runId}`)
      await loadRecentRuns()
    } catch (caughtError) {
      setError(String(caughtError?.message ?? 'MARKETPLACE_PACKAGE_PUBLICATION_FAILED'))
    } finally {
      setPublishing(false)
    }
  }, [loadRecentRuns, publishForm, selectedProfileKeys])

  return (
    <>
      <div className="ldt-module-panel__header">
        <h3>EU LDT Toolbox integrations</h3>
        <p>Configurable Data Platform, Data Modeller, Data Space Ready, Use Case & Scenarios, Play & Visualise, and Marketplace Agent targets for standards-based OLDT exchange.</p>
      </div>

      {error ? <Alert variant="warning">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <div className="ldt-action-row">
        <Button className="btn-sm" variant="outline-secondary" onClick={loadProfiles} disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" /> : 'Refresh'}
        </Button>
      </div>

      <section className="ldt-marketplace-workspace">
        <div className="ldt-module-panel__header">
          <h3>Use Case & Scenarios</h3>
          <p>Create one governed baseline and intervention, execute both through Data Platform, Airflow, and AI Notebook, and retain their UCS provenance.</p>
        </div>
        <div className="ldt-marketplace-grid">
          <div className="ldt-marketplace-panel">
            <strong>Connection</strong>
            <div className="ldt-form-grid">
              <label>
                <span>Profile</span>
                <select value={ucsForm.profileKey} onChange={(event) => updateUcsForm('profileKey', event.target.value)}>
                  {ucsProfiles.length ? ucsProfiles.map((profile) => (
                    <option key={profile.profileKey} value={profile.profileKey}>{profile.displayName}</option>
                  )) : <option value={ucsForm.profileKey}>{ucsForm.profileKey}</option>}
                </select>
              </label>
              <label>
                <span>Display name</span>
                <input value={ucsForm.displayName} onChange={(event) => updateUcsForm('displayName', event.target.value)} />
              </label>
              <label className="ldt-form-field--wide">
                <span>Backend URL</span>
                <input value={ucsForm.backendUrl} onChange={(event) => updateUcsForm('backendUrl', event.target.value)} placeholder="https://ucs.example" />
              </label>
              <label className="ldt-form-field--wide">
                <span>Browser URL</span>
                <input value={ucsForm.publicFrontendUrl} onChange={(event) => updateUcsForm('publicFrontendUrl', event.target.value)} placeholder="https://ucs.example" />
              </label>
              <label>
                <span>Authentication</span>
                <select value={ucsForm.authType} onChange={(event) => updateUcsForm('authType', event.target.value)}>
                  <option value="oauth2-client-credentials">OAuth2 client credentials</option>
                  <option value="bearer">Bearer token</option>
                  <option value="none">None</option>
                </select>
              </label>
              <label>
                <span>City mapping</span>
                <input value={ucsForm.cityId} onChange={(event) => updateUcsForm('cityId', event.target.value)} />
              </label>
              {ucsForm.authType === 'oauth2-client-credentials' ? (
                <>
                  <label className="ldt-form-field--wide">
                    <span>Token URL</span>
                    <input value={ucsForm.tokenUrl} onChange={(event) => updateUcsForm('tokenUrl', event.target.value)} />
                  </label>
                  <label>
                    <span>Client ID</span>
                    <input value={ucsForm.clientId} onChange={(event) => updateUcsForm('clientId', event.target.value)} />
                  </label>
                  <label>
                    <span>Client secret</span>
                    <input type="password" value={ucsForm.clientSecret} onChange={(event) => updateUcsForm('clientSecret', event.target.value)} />
                  </label>
                </>
              ) : null}
              {ucsForm.authType === 'bearer' ? (
                <label className="ldt-form-field--wide">
                  <span>Bearer token</span>
                  <input type="password" value={ucsForm.bearerToken} onChange={(event) => updateUcsForm('bearerToken', event.target.value)} />
                </label>
              ) : null}
            </div>
            <div className="ldt-action-row">
              <Button className="btn-sm" variant="outline-primary" onClick={saveUcsProfile} disabled={savingUcs}>
                {savingUcs ? <Spinner animation="border" size="sm" /> : 'Save Connection'}
              </Button>
              <Button className="btn-sm" variant="outline-secondary" onClick={() => testProfile(ucsForm.profileKey)} disabled={testingKey === ucsForm.profileKey}>
                {testingKey === ucsForm.profileKey ? <Spinner animation="border" size="sm" /> : 'Test'}
              </Button>
            </div>
          </div>

          <div className="ldt-marketplace-panel">
            <strong>Baseline and intervention</strong>
            <div className="ldt-form-grid">
              <label className="ldt-form-field--wide">
                <span>Data Platform</span>
                <select value={ucsForm.dataPlatformProfileKey} onChange={(event) => updateUcsForm('dataPlatformProfileKey', event.target.value)}>
                  {dataPlatformProfiles.length ? dataPlatformProfiles.map((profile) => (
                    <option key={profile.profileKey} value={profile.profileKey}>{profile.displayName}</option>
                  )) : <option value={ucsForm.dataPlatformProfileKey}>{ucsForm.dataPlatformProfileKey}</option>}
                </select>
              </label>
              <label className="ldt-form-field--wide">
                <span>Saved selection ID</span>
                <input value={ucsForm.selectionSetId} onChange={(event) => updateUcsForm('selectionSetId', event.target.value)} placeholder="Use a saved analytical query selection" />
              </label>
              <label>
                <span>Baseline override</span>
                <input type="number" value={ucsForm.baselineValue} onChange={(event) => updateUcsForm('baselineValue', event.target.value)} />
              </label>
              <label>
                <span>Intervention override</span>
                <input type="number" value={ucsForm.interventionValue} onChange={(event) => updateUcsForm('interventionValue', event.target.value)} />
              </label>
              <label>
                <span>Intervention change (%)</span>
                <input type="number" value={ucsForm.interventionDeltaPercent} onChange={(event) => updateUcsForm('interventionDeltaPercent', event.target.value)} />
              </label>
              <label>
                <span>Metric</span>
                <input value={ucsForm.metricKey} onChange={(event) => updateUcsForm('metricKey', event.target.value)} />
              </label>
              <label>
                <span>Aggregation</span>
                <select value={ucsForm.aggregation} onChange={(event) => updateUcsForm('aggregation', event.target.value)}>
                  <option value="value">Value</option>
                  <option value="count">Count</option>
                  <option value="avg">Average</option>
                  <option value="sum">Sum</option>
                  <option value="min">Minimum</option>
                  <option value="max">Maximum</option>
                </select>
              </label>
              <label>
                <span>Unit</span>
                <input value={ucsForm.unit} onChange={(event) => updateUcsForm('unit', event.target.value)} />
              </label>
              <label>
                <span>Data scope</span>
                <input value={ucsForm.ngsiScope} onChange={(event) => updateUcsForm('ngsiScope', event.target.value)} />
              </label>
              <label>
                <span>Model namespace</span>
                <input value={ucsForm.modelNamespace} onChange={(event) => updateUcsForm('modelNamespace', event.target.value)} />
              </label>
              <label>
                <span>Model name</span>
                <input value={ucsForm.modelName} onChange={(event) => updateUcsForm('modelName', event.target.value)} />
              </label>
              <label className="ldt-form-field--wide">
                <span>Case name</span>
                <input value={ucsForm.caseName} onChange={(event) => updateUcsForm('caseName', event.target.value)} placeholder="Generated when empty" />
              </label>
            </div>
            <div className="ldt-action-row">
              <Button className="btn-sm" variant="primary" onClick={runUcsRoundtrip} disabled={Boolean(ucsAction)}>
                {ucsAction === 'run' ? <Spinner animation="border" size="sm" /> : 'Run Comparison'}
              </Button>
              <Button className="btn-sm" variant="outline-secondary" onClick={() => loadUcsState(ucsForm.profileKey)} disabled={Boolean(ucsAction)}>
                Refresh Results
              </Button>
            </div>
          </div>
        </div>

        <div className="ldt-kpi-grid">
          <div><span>Roundtrips</span><strong>{ucsState.counts?.bindings ?? 0}</strong></div>
          <div><span>Completed</span><strong>{ucsState.counts?.completed ?? 0}</strong></div>
          <div><span>Failed</span><strong>{ucsState.counts?.failed ?? 0}</strong></div>
        </div>

        <div className="ldt-inventory-table-wrap">
          <table className="ldt-inventory-table ldt-inventory-table--operations">
            <thead>
              <tr>
                <th>Case</th>
                <th>Baseline</th>
                <th>Intervention</th>
                <th>OLDT source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ucsState.bindings?.length ? ucsState.bindings.map((binding) => (
                <tr key={binding.id}>
                  <td><strong>{binding.metadata?.caseName || binding.bindingKey}</strong><span>{binding.caseId}</span></td>
                  <td><strong>{binding.baselineValue} {binding.unit}</strong><span>{binding.baselineExecutionId}</span></td>
                  <td><strong>{binding.interventionValue} {binding.unit}</strong><span>{binding.interventionExecutionId}</span></td>
                  <td><strong>{binding.selectionTitle || 'Explicit value'}</strong><span>{binding.selectionSetId || binding.baselineEntityId}</span></td>
                  <td><Badge bg={statusVariant(binding.status)}>{titleize(binding.status)}</Badge></td>
                </tr>
              )) : (
                <tr><td colSpan={5}>No Use Case & Scenarios roundtrips stored.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ldt-marketplace-workspace">
        <div className="ldt-module-panel__header">
          <h3>City Innovation Planner</h3>
          <p>Publish OLDT selection metrics through Data Platform, then reconcile KPI measurements and planning initiatives.</p>
        </div>
        <div className="ldt-marketplace-grid">
          <div className="ldt-marketplace-panel">
            <strong>Connection</strong>
            <div className="ldt-form-grid">
              <label>
                <span>Profile</span>
                <select value={cipForm.profileKey} onChange={(event) => updateCipForm('profileKey', event.target.value)}>
                  {cipProfiles.length ? cipProfiles.map((profile) => (
                    <option key={profile.profileKey} value={profile.profileKey}>{profile.displayName}</option>
                  )) : <option value={cipForm.profileKey}>{cipForm.profileKey}</option>}
                </select>
              </label>
              <label>
                <span>Display name</span>
                <input value={cipForm.displayName} onChange={(event) => updateCipForm('displayName', event.target.value)} />
              </label>
              <label className="ldt-form-field--wide">
                <span>Backend URL</span>
                <input value={cipForm.backendUrl} onChange={(event) => updateCipForm('backendUrl', event.target.value)} placeholder="https://planner.example" />
              </label>
              <label className="ldt-form-field--wide">
                <span>Browser URL</span>
                <input value={cipForm.publicFrontendUrl} onChange={(event) => updateCipForm('publicFrontendUrl', event.target.value)} placeholder="https://planner.example" />
              </label>
              <label>
                <span>Authentication</span>
                <select value={cipForm.authType} onChange={(event) => updateCipForm('authType', event.target.value)}>
                  <option value="none">None</option>
                  <option value="bearer">Bearer token</option>
                  <option value="oauth2-client-credentials">OAuth2 client credentials</option>
                </select>
              </label>
              <label>
                <span>City mapping</span>
                <input value={cipForm.cityId} onChange={(event) => updateCipForm('cityId', event.target.value)} />
              </label>
              {cipForm.authType === 'bearer' ? (
                <label className="ldt-form-field--wide">
                  <span>Bearer token</span>
                  <input type="password" value={cipForm.bearerToken} onChange={(event) => updateCipForm('bearerToken', event.target.value)} />
                </label>
              ) : null}
              {cipForm.authType === 'oauth2-client-credentials' ? (
                <>
                  <label className="ldt-form-field--wide">
                    <span>Token URL</span>
                    <input value={cipForm.tokenUrl} onChange={(event) => updateCipForm('tokenUrl', event.target.value)} />
                  </label>
                  <label>
                    <span>Client ID</span>
                    <input value={cipForm.clientId} onChange={(event) => updateCipForm('clientId', event.target.value)} />
                  </label>
                  <label>
                    <span>Client secret</span>
                    <input type="password" value={cipForm.clientSecret} onChange={(event) => updateCipForm('clientSecret', event.target.value)} />
                  </label>
                </>
              ) : null}
            </div>
            <div className="ldt-action-row">
              <Button className="btn-sm" variant="outline-primary" onClick={saveCipProfile} disabled={savingCip}>
                {savingCip ? <Spinner animation="border" size="sm" /> : 'Save Planner'}
              </Button>
              <Button className="btn-sm" variant="outline-secondary" onClick={() => loadCipState(cipForm.profileKey)} disabled={Boolean(cipAction)}>
                Refresh state
              </Button>
            </div>
          </div>

          <div className="ldt-marketplace-panel">
            <strong>Metric source</strong>
            <div className="ldt-form-grid">
              <label>
                <span>Data Platform</span>
                <select value={cipForm.dataPlatformProfileKey} onChange={(event) => updateCipForm('dataPlatformProfileKey', event.target.value)}>
                  {dataPlatformProfiles.length ? dataPlatformProfiles.map((profile) => (
                    <option key={profile.profileKey} value={profile.profileKey}>{profile.displayName}</option>
                  )) : <option value={cipForm.dataPlatformProfileKey}>{cipForm.dataPlatformProfileKey}</option>}
                </select>
              </label>
              <label>
                <span>Saved selection ID</span>
                <input value={cipForm.selectionSetId} onChange={(event) => updateCipForm('selectionSetId', event.target.value)} placeholder="UUID" />
              </label>
              <label>
                <span>CIP KPI ID</span>
                <input value={cipForm.cipKpiId} onChange={(event) => updateCipForm('cipKpiId', event.target.value)} placeholder="Create when empty" />
              </label>
              <label>
                <span>KPI name</span>
                <input value={cipForm.kpiName} onChange={(event) => updateCipForm('kpiName', event.target.value)} />
              </label>
              <label>
                <span>Selection metric</span>
                <input value={cipForm.metricKey} onChange={(event) => updateCipForm('metricKey', event.target.value)} placeholder="result_count" />
              </label>
              <label>
                <span>Member attribute</span>
                <input value={cipForm.attributeKey} onChange={(event) => updateCipForm('attributeKey', event.target.value)} placeholder="Optional numeric attribute" />
              </label>
              <label>
                <span>Aggregation</span>
                <select value={cipForm.aggregation} onChange={(event) => updateCipForm('aggregation', event.target.value)}>
                  <option value="value">Stored metric</option>
                  <option value="avg">Average</option>
                  <option value="sum">Sum</option>
                  <option value="min">Minimum</option>
                  <option value="max">Maximum</option>
                  <option value="count">Count</option>
                </select>
              </label>
              <label>
                <span>Unit</span>
                <input value={cipForm.unit} onChange={(event) => updateCipForm('unit', event.target.value)} />
              </label>
              <label>
                <span>NGSI-LD property</span>
                <input value={cipForm.ngsiProperty} onChange={(event) => updateCipForm('ngsiProperty', event.target.value)} />
              </label>
              <label className="ldt-inline-check">
                <input type="checkbox" checked={cipForm.createKpi} onChange={(event) => updateCipForm('createKpi', event.target.checked)} />
                <span>Create KPI when ID is empty</span>
              </label>
              <label className="ldt-inline-check">
                <input type="checkbox" checked={cipForm.requestCalculation} onChange={(event) => updateCipForm('requestCalculation', event.target.checked)} />
                <span>Request calculation</span>
              </label>
            </div>
            <div className="ldt-action-row">
              <Button className="btn-sm" variant="primary" onClick={publishCipMetricSource} disabled={Boolean(cipAction)}>
                {cipAction === 'publish' ? <Spinner animation="border" size="sm" /> : 'Publish Metric Source'}
              </Button>
              <Button className="btn-sm" variant="outline-primary" onClick={() => syncCipResource('measurements')} disabled={Boolean(cipAction)}>
                {cipAction === 'measurements' ? <Spinner animation="border" size="sm" /> : 'Sync Measurements'}
              </Button>
              <Button className="btn-sm" variant="outline-primary" onClick={() => syncCipResource('initiatives')} disabled={Boolean(cipAction)}>
                {cipAction === 'initiatives' ? <Spinner animation="border" size="sm" /> : 'Sync Initiatives'}
              </Button>
            </div>
          </div>
        </div>

        <div className="ldt-kpi-grid">
          <div><span>Bindings</span><strong>{cipState.counts?.bindings ?? 0}</strong></div>
          <div><span>Measurements</span><strong>{cipState.counts?.measurements ?? 0}</strong></div>
          <div><span>Initiatives</span><strong>{cipState.counts?.initiatives ?? 0}</strong></div>
          <div><span>Spatial links</span><strong>{cipState.counts?.linkedInitiatives ?? 0}</strong></div>
        </div>

        <div className="ldt-inventory-table-wrap">
          <table className="ldt-inventory-table ldt-inventory-table--operations">
            <thead>
              <tr>
                <th>KPI binding</th>
                <th>Data Platform source</th>
                <th>Latest value</th>
                <th>OLDT selection</th>
              </tr>
            </thead>
            <tbody>
              {cipState.bindings?.length ? cipState.bindings.map((binding) => (
                <tr key={binding.id}>
                  <td><strong>{binding.kpiName || binding.bindingKey}</strong><span>{binding.cipKpiId}</span></td>
                  <td><strong>{binding.ngsiProperty}</strong><span>{binding.ngsiEntityId}</span></td>
                  <td><strong>{binding.lastPublishedValue ?? 'No value'}</strong><span>{binding.unit || binding.aggregation}</span></td>
                  <td><span>{binding.selectionSetId || 'No spatial selection'}</span></td>
                </tr>
              )) : (
                <tr><td colSpan={4}>No City Innovation Planner bindings stored.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ldt-inventory-table-wrap">
          <table className="ldt-inventory-table ldt-inventory-table--operations">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Status</th>
                <th>Progress</th>
                <th>OLDT selection</th>
              </tr>
            </thead>
            <tbody>
              {cipState.initiatives?.length ? cipState.initiatives.map((initiative) => (
                <tr key={initiative.id}>
                  <td><strong>{initiative.name || initiative.cipInitiativeId}</strong><span>{initiative.cipInitiativeId}</span></td>
                  <td><Badge bg={statusVariant(initiative.initiativeStatus)}>{titleize(initiative.initiativeStatus || 'unknown')}</Badge></td>
                  <td><strong>{initiative.percentageProgress == null ? 'No progress' : `${initiative.percentageProgress}%`}</strong><span>{titleize(initiative.progressStatus)}</span></td>
                  <td>
                    <span>{initiative.selectionTitle || initiative.selectionSetId || 'Not linked'}</span>
                    <Button
                      className="btn-sm"
                      variant="link"
                      onClick={() => {
                        updateCipForm('initiativeId', initiative.cipInitiativeId)
                        if (initiative.selectionSetId) updateCipForm('initiativeSelectionSetId', initiative.selectionSetId)
                      }}
                    >Select</Button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={4}>No City Innovation Planner initiatives synced.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ldt-action-row">
          <label>
            <span>Initiative ID</span>
            <input value={cipForm.initiativeId} onChange={(event) => updateCipForm('initiativeId', event.target.value)} />
          </label>
          <label>
            <span>Saved selection ID</span>
            <input value={cipForm.initiativeSelectionSetId} onChange={(event) => updateCipForm('initiativeSelectionSetId', event.target.value)} />
          </label>
          <Button className="btn-sm" variant="outline-primary" onClick={linkCipInitiative} disabled={Boolean(cipAction)}>
            {cipAction === 'link' ? <Spinner animation="border" size="sm" /> : 'Link Initiative'}
          </Button>
        </div>
      </section>

      <section className="ldt-marketplace-workspace">
        <div className="ldt-module-panel__header">
          <h3>Data Modeller profile</h3>
          <p>Register any reachable EU LDT Data Modeller. Removing or disabling this profile only disables its workflows; OLDT keeps running standalone.</p>
        </div>
        <div className="ldt-marketplace-grid">
          <div className="ldt-marketplace-panel">
            <strong>Connection</strong>
            <div className="ldt-form-grid">
              <label>
                <span>Profile key</span>
                <input value={dataModellerForm.profileKey} onChange={(event) => updateDataModellerForm('profileKey', event.target.value)} />
              </label>
              <label>
                <span>Display name</span>
                <input value={dataModellerForm.displayName} onChange={(event) => updateDataModellerForm('displayName', event.target.value)} />
              </label>
              <label className="ldt-form-field--wide">
                <span>Backend URL</span>
                <input value={dataModellerForm.backendUrl} onChange={(event) => updateDataModellerForm('backendUrl', event.target.value)} placeholder="https://data-modeller.example/api/v1" />
              </label>
              <label className="ldt-form-field--wide">
                <span>Browser URL</span>
                <input value={dataModellerForm.publicFrontendUrl} onChange={(event) => updateDataModellerForm('publicFrontendUrl', event.target.value)} placeholder="https://data-modeller.example" />
              </label>
              <label>
                <span>Authentication</span>
                <select value={dataModellerForm.authType} onChange={(event) => updateDataModellerForm('authType', event.target.value)}>
                  <option value="none">None</option>
                  <option value="bearer">Bearer token</option>
                </select>
              </label>
              <label>
                <span>City mapping</span>
                <input value={dataModellerForm.cityId} onChange={(event) => updateDataModellerForm('cityId', event.target.value)} />
              </label>
              {dataModellerForm.authType === 'bearer' ? (
                <label className="ldt-form-field--wide">
                  <span>Bearer token</span>
                  <input type="password" value={dataModellerForm.bearerToken} onChange={(event) => updateDataModellerForm('bearerToken', event.target.value)} />
                </label>
              ) : null}
            </div>
            <Button className="btn-sm" variant="outline-primary" onClick={saveDataModellerProfile} disabled={savingDataModeller}>
              {savingDataModeller ? <Spinner animation="border" size="sm" /> : 'Save Data Modeller'}
            </Button>
          </div>
          <div className="ldt-marketplace-panel">
            <strong>Operational boundary</strong>
            <p>OLDT sends a bounded structural sample to create a Synth schema. A Data Modeller user evaluates and approves it there. Only then can OLDT request synthetic records and import a selected field as append-only outputs marked simulated.</p>
            <p>Direct Data Modeller database insertion is intentionally excluded from this integration.</p>
          </div>
        </div>
      </section>

      <section className="ldt-marketplace-workspace">
        <div className="ldt-module-panel__header">
          <h3>Data-space participants</h3>
          <p>Register provider and consumer EDC participants independently. TwinQuery exchanges choose one of each at execution time.</p>
        </div>
        <div className="ldt-marketplace-grid">
          <div className="ldt-marketplace-panel">
            <strong>Participant connection</strong>
            <div className="ldt-form-grid">
              <label>
                <span>Role</span>
                <select value={dataSpaceForm.role} onChange={(event) => updateDataSpaceForm('role', event.target.value)}>
                  <option value="provider">Provider</option>
                  <option value="consumer">Consumer</option>
                </select>
              </label>
              <label>
                <span>Profile key</span>
                <input value={dataSpaceForm.profileKey} onChange={(event) => updateDataSpaceForm('profileKey', event.target.value)} />
              </label>
              <label className="ldt-form-field--wide">
                <span>Display name</span>
                <input value={dataSpaceForm.displayName} onChange={(event) => updateDataSpaceForm('displayName', event.target.value)} />
              </label>
              <label className="ldt-form-field--wide">
                <span>Data Space Ready backend</span>
                <input value={dataSpaceForm.backendUrl} onChange={(event) => updateDataSpaceForm('backendUrl', event.target.value)} placeholder="https://data-space-ready.example" />
              </label>
              <label className="ldt-form-field--wide">
                <span>EDC Management API</span>
                <input value={dataSpaceForm.managementUrl} onChange={(event) => updateDataSpaceForm('managementUrl', event.target.value)} placeholder="https://connector.example/api/management/v3" />
              </label>
              {dataSpaceForm.role === 'provider' ? (
                <label className="ldt-form-field--wide">
                  <span>Provider DSP address</span>
                  <input value={dataSpaceForm.dspUrl} onChange={(event) => updateDataSpaceForm('dspUrl', event.target.value)} placeholder="https://connector.example/api/dsp" />
                </label>
              ) : null}
              <label>
                <span>Participant ID</span>
                <input value={dataSpaceForm.participantId} onChange={(event) => updateDataSpaceForm('participantId', event.target.value)} />
              </label>
              <label>
                <span>City mapping</span>
                <input value={dataSpaceForm.cityId} onChange={(event) => updateDataSpaceForm('cityId', event.target.value)} />
              </label>
              <label className="ldt-form-field--wide">
                <span>Management API key</span>
                <input type="password" value={dataSpaceForm.apiKey} onChange={(event) => updateDataSpaceForm('apiKey', event.target.value)} />
              </label>
              <label className="ldt-form-field--wide">
                <span>OLDT callback base URL</span>
                <input value={dataSpaceForm.oldtPackageBaseUrl} onChange={(event) => updateDataSpaceForm('oldtPackageBaseUrl', event.target.value)} placeholder="https://oldt.example" />
              </label>
              <label className="ldt-form-field--wide">
                <span>Browser URL</span>
                <input value={dataSpaceForm.publicFrontendUrl} onChange={(event) => updateDataSpaceForm('publicFrontendUrl', event.target.value)} />
              </label>
            </div>
            <Button className="btn-sm" variant="outline-primary" onClick={saveDataSpaceProfile} disabled={savingDataSpace}>
              {savingDataSpace ? <Spinner animation="border" size="sm" /> : 'Save Participant'}
            </Button>
          </div>
          <div className="ldt-marketplace-panel">
            <strong>Exchange boundary</strong>
            <p>OLDT publishes an immutable query package through the selected provider, discovers and negotiates it through the selected consumer, then receives the transferred bytes at a controlled callback.</p>
            <p>A successful workflow requires matching SHA-256 and byte counts; connector completion alone is not accepted as evidence.</p>
          </div>
        </div>
      </section>

      <section className="ldt-marketplace-workspace">
        <div className="ldt-module-panel__header">
          <h3>Marketplace Agent publish</h3>
          <p>Package an OLDT semantic asset, send it to selected Marketplace Agent profiles, and keep the Hub publication evidence in the workflow run.</p>
        </div>

        <div className="ldt-marketplace-grid">
          <div className="ldt-marketplace-panel">
            <strong>Agent targets</strong>
            <div className="ldt-marketplace-agent-list">
              {marketplaceProfiles.length ? marketplaceProfiles.map((profile) => (
                <label key={profile.profileKey} className="ldt-inline-check">
                  <input
                    type="checkbox"
                    checked={selectedProfileKeys.includes(profile.profileKey)}
                    onChange={() => toggleMarketplaceProfile(profile.profileKey)}
                  />
                  <span>
                    {profile.displayName}
                    <small>{profile.profileKey} · {titleize(profile.status)}</small>
                  </span>
                </label>
              )) : <span>No Marketplace Agent profiles registered.</span>}
            </div>
            <details className="ldt-marketplace-details">
              <summary>Register / update Marketplace Agent</summary>
              <div className="ldt-form-grid">
                <label>
                  <span>Profile key</span>
                  <input value={agentForm.profileKey} onChange={(event) => updateAgentForm('profileKey', event.target.value)} />
                </label>
                <label>
                  <span>Display name</span>
                  <input value={agentForm.displayName} onChange={(event) => updateAgentForm('displayName', event.target.value)} />
                </label>
                <label className="ldt-form-field--wide">
                  <span>Base URL</span>
                  <input placeholder="http://host.docker.internal:4317" value={agentForm.baseUrl} onChange={(event) => updateAgentForm('baseUrl', event.target.value)} />
                </label>
                <label className="ldt-form-field--wide">
                  <span>Bearer token</span>
                  <input type="password" value={agentForm.bearerToken} onChange={(event) => updateAgentForm('bearerToken', event.target.value)} />
                </label>
                <label>
                  <span>City</span>
                  <input value={agentForm.cityId} onChange={(event) => updateAgentForm('cityId', event.target.value)} />
                </label>
                <label>
                  <span>Categories</span>
                  <input value={agentForm.defaultCategories} onChange={(event) => updateAgentForm('defaultCategories', event.target.value)} />
                </label>
              </div>
              <Button className="btn-sm" variant="outline-primary" onClick={saveMarketplaceAgent} disabled={savingProfile}>
                {savingProfile ? <Spinner animation="border" size="sm" /> : 'Save Agent'}
              </Button>
            </details>
          </div>

          <div className="ldt-marketplace-panel">
            <strong>Package</strong>
            <div className="ldt-form-grid">
              <label className="ldt-form-field--wide">
                <span>Title</span>
                <input value={publishForm.title} onChange={(event) => updatePublishForm('title', event.target.value)} />
              </label>
              <label className="ldt-form-field--wide">
                <span>Description</span>
                <textarea rows={2} value={publishForm.description} onChange={(event) => updatePublishForm('description', event.target.value)} />
              </label>
              <label>
                <span>Asset type</span>
                <input value={publishForm.assetType} onChange={(event) => updatePublishForm('assetType', event.target.value)} />
              </label>
              <label>
                <span>Licence</span>
                <input value={publishForm.licence} onChange={(event) => updatePublishForm('licence', event.target.value)} />
              </label>
              <label>
                <span>Categories</span>
                <input value={publishForm.categories} onChange={(event) => updatePublishForm('categories', event.target.value)} />
              </label>
              <label>
                <span>Compatibility</span>
                <input value={publishForm.compatibilityTargets} onChange={(event) => updatePublishForm('compatibilityTargets', event.target.value)} />
              </label>
              <label className="ldt-inline-check ldt-form-field--wide">
                <input type="checkbox" checked={publishForm.publishToHub} onChange={(event) => updatePublishForm('publishToHub', event.target.checked)} />
                <span>Publish offering to Marketplace Hub through the Agent</span>
              </label>
              <label className="ldt-form-field--wide">
                <span>Package payload JSON</span>
                <textarea rows={8} value={publishForm.payloadJson} onChange={(event) => updatePublishForm('payloadJson', event.target.value)} />
              </label>
            </div>
            <div className="ldt-action-row">
              <Button className="btn-sm" variant="primary" onClick={publishMarketplacePackage} disabled={publishing || !selectedProfileKeys.length}>
                {publishing ? <Spinner animation="border" size="sm" /> : 'Publish Package'}
              </Button>
              <span className="ldt-muted-note">Marketplace launch remains an external seller/governance action.</span>
            </div>
          </div>
        </div>

        {publishEvidence ? (
          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table ldt-inventory-table--marketplace-evidence">
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>Asset</th>
                  <th>Hub Offering</th>
                  <th>Status</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {publishEvidence.rows.length ? publishEvidence.rows.map((row) => (
                  <tr key={`${row.profileKey}-${row.assetId || row.offeringId}`}>
                    <td><strong>{row.profileKey}</strong></td>
                    <td><span>{row.assetId || 'No asset ID'}</span></td>
                    <td>
                      <strong>{row.offeringId || 'Not published to Hub'}</strong>
                      {row.productSpecId ? <span>Product spec: {row.productSpecId}</span> : null}
                      {row.resourceSpecId ? <span>Resource spec: {row.resourceSpecId}</span> : null}
                    </td>
                    <td><Badge bg={row.status === 'published' ? 'success' : 'secondary'}>{titleize(row.status)}</Badge></td>
                    <td>
                      {row.exploreUrl ? <a className="ldt-inline-link" href={row.exploreUrl} target="_blank" rel="noreferrer">Marketplace detail</a> : <span>Agent evidence only</span>}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5}>Workflow succeeded but no Marketplace publish rows were returned.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="ldt-compact-list">
          {recentRuns.map((run) => (
            <div key={run.id}>
              <span>{formatDate(run.createdAt)}</span>
              <strong>{run.workflowName || run.workflowKey} · {titleize(run.status)}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className="ldt-inventory-table-wrap">
        <table className="ldt-inventory-table ldt-inventory-table--operations">
          <thead>
            <tr>
              <th>Profile</th>
              <th>Kind</th>
              <th>Status</th>
              <th>Capabilities</th>
              <th>Endpoints</th>
              <th>Check</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length ? profiles.map((profile) => (
              <tr key={profile.profileKey}>
                <td>
                  <strong>{profile.displayName}</strong>
                  <span>{profile.profileKey}</span>
                  <span>{profile.baseUrl}</span>
                </td>
                <td>
                  <Badge bg="secondary">{titleize(profile.platformKind)}</Badge>
                  <span>{compactList([profile.cityId, profile.remoteCityId].filter(Boolean), 'No city mapping')}</span>
                </td>
                <td>
                  <Badge bg={statusVariant(profile.status)}>{titleize(profile.status)}</Badge>
                  <span>{formatDate(profile.lastCheckedAt)}</span>
                </td>
                <td>{keyList(profile.capabilities)}</td>
                <td>
                  {endpointSummary(profile).map(([key, value]) => (
                    <span key={key}>{key}: {value}</span>
                  ))}
                </td>
                <td>
                  <Button
                    className="btn-sm"
                    variant="outline-primary"
                    onClick={() => testProfile(profile.profileKey)}
                    disabled={Boolean(testingKey)}
                  >
                    {testingKey === profile.profileKey ? <Spinner animation="border" size="sm" /> : 'Test'}
                  </Button>
                  <span>{checkSummary(profile)}</span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6}>{loading ? 'Loading EU LDT integration profiles.' : 'No EU LDT integration profiles registered.'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
