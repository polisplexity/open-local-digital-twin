import assert from 'node:assert/strict'

import {
  createWorkflowRun,
  decideWorkflowApproval,
  executeWorkflowRunOnce,
  getCityCapabilityState,
  getWorkflowRun,
  listEuLdtIntegrationProfiles,
  testEuLdtIntegrationProfile,
} from '../services/ldtOpsService.mjs'
import {
  finishEuLdtAcceptanceRun,
  getEuLdtAcceptanceRun,
  recordEuLdtAcceptanceCase,
  startEuLdtAcceptanceRun,
} from '../services/ldtOps/euLdtAcceptanceService.mjs'

const SUITE_KEY = 'eu-ldt-play-visualise-acceptance-v1'
const PROFILE_KEY = process.env.EU_LDT_PLAY_VISUALISE_PROFILE ?? 'local-eu-ldt-play-visualise'
const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
const cityId = cityArg ? cityArg.split('=').slice(1).join('=').trim() : 'guanajuato'
const oldtBaseUrl = String(process.env.OLDT_ACCEPTANCE_BASE_URL ?? 'http://host.docker.internal:4292').replace(/\/+$/, '')
const smokeEmail = process.env.TWIN_STUDIO_SMOKE_EMAIL ?? 'smoke@polisplexity.test'
const smokePassword = process.env.TWIN_STUDIO_SMOKE_PASSWORD ?? 'local-smoke-password-change-me'

let oldtCookie = ''

async function readJson(response, label) {
  const raw = await response.text()
  let body = null
  try {
    body = raw ? JSON.parse(raw) : null
  } catch {
    body = { raw: raw.slice(0, 1000) }
  }
  assert.equal(response.ok, true, `${label}:${response.status}:${raw.slice(0, 500)}`)
  return body
}

async function getOldtCookie() {
  if (oldtCookie) return oldtCookie
  const response = await fetch(`${oldtBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email: smokeEmail,
      password: smokePassword,
      cityId,
      rememberMe: true,
    }),
    signal: AbortSignal.timeout(15000),
  })
  await readJson(response, 'OLDT_ACCEPTANCE_LOGIN_FAILED')
  oldtCookie = String(response.headers.get('set-cookie') ?? '').split(';')[0]
  assert.match(oldtCookie, /^twin_session=/, 'OLDT_ACCEPTANCE_SESSION_COOKIE_MISSING')
  return oldtCookie
}

async function fetchOldtJson(path) {
  const response = await fetch(`${oldtBaseUrl}${path}`, {
    headers: {
      Accept: 'application/geo+json, application/json',
      Cookie: await getOldtCookie(),
    },
    signal: AbortSignal.timeout(30000),
  })
  return readJson(response, `OLDT_ACCEPTANCE_FETCH_FAILED:${path}`)
}

async function fetchPlayLayer(apiBaseUrl, datalayerId) {
  const response = await fetch(
    `${String(apiBaseUrl).replace(/\/+$/, '')}/dataLayers/${encodeURIComponent(datalayerId)}/updateLayer?type=geo`,
    {
      headers: { Accept: 'application/geo+json, application/json' },
      signal: AbortSignal.timeout(30000),
    },
  )
  const body = await readJson(response, `PLAY_VISUALISE_LAYER_FETCH_FAILED:${datalayerId}`)
  return body?.data?.type === 'FeatureCollection' ? body.data : body
}

function featureCollection(body) {
  assert.equal(body?.type, 'FeatureCollection', 'GEOJSON_FEATURE_COLLECTION_REQUIRED')
  assert.ok(Array.isArray(body.features), 'GEOJSON_FEATURES_REQUIRED')
  return body
}

function geometryTypes(collection) {
  return [...new Set(collection.features.map((feature) => feature?.geometry?.type).filter(Boolean))].sort()
}

function propertyCoverage(collection, keys) {
  return Object.fromEntries(keys.map((key) => [
    key,
    collection.features.filter((feature) => Object.prototype.hasOwnProperty.call(feature?.properties ?? {}, key)).length,
  ]))
}

async function approveAndRun(input, workerId) {
  const created = await createWorkflowRun({
    workflowKey: 'eu-ldt-play-visualise-register-layer',
    cityId,
    input: {
      integrationProfileKey: PROFILE_KEY,
      cityPath: cityId,
      oldtBaseUrl,
      ...input,
    },
    requestedBy: workerId,
    requestedByKind: 'system-acceptance',
    triggerKind: 'integration-acceptance',
  })
  assert.equal(created.ok, true, created.error || 'PLAY_VISUALISE_WORKFLOW_CREATE_FAILED')
  let run = created.run
  for (const approval of run.approvals.filter((entry) => entry.status === 'requested')) {
    const decision = await decideWorkflowApproval({
      runId: run.id,
      approvalKey: approval.approvalKey,
      decision: 'approved',
      decidedBy: workerId,
      reason: 'Approve real Play & Visualise acceptance registration and OLDT source consumption.',
    })
    assert.equal(decision.ok, true, decision.error || `PLAY_VISUALISE_APPROVAL_FAILED:${approval.approvalKey}`)
    run = decision.run
  }
  assert.equal(run.status, 'queued', 'PLAY_VISUALISE_WORKFLOW_NOT_QUEUED')
  const executed = await executeWorkflowRunOnce({ runId: run.id, workerId })
  assert.equal(executed.ok, true, executed.error || 'PLAY_VISUALISE_WORKFLOW_EXECUTE_FAILED')
  assert.equal(executed.run?.status, 'succeeded', 'PLAY_VISUALISE_WORKFLOW_NOT_SUCCEEDED')
  return executed
}

async function createIsolationRun() {
  const created = await createWorkflowRun({
    workflowKey: 'eu-ldt-play-visualise-register-layer',
    cityId,
    input: {
      integrationProfileKey: `missing-play-profile-${Date.now()}`,
      collectionKey: 'buildings',
      limit: 1,
      cityPath: cityId,
      oldtBaseUrl,
      mapName: 'OLDT Acceptance Missing Profile',
      layerName: 'OLDT Acceptance Missing Profile',
      dataSourceName: 'OLDT Acceptance Missing Profile',
    },
    requestedBy: 'play-visualise-acceptance-isolation',
    requestedByKind: 'system-acceptance',
    triggerKind: 'standalone-isolation-acceptance',
  })
  assert.equal(created.ok, true, created.error || 'PLAY_VISUALISE_ISOLATION_CREATE_FAILED')
  let run = created.run
  for (const approval of run.approvals.filter((entry) => entry.status === 'requested')) {
    const decision = await decideWorkflowApproval({
      runId: run.id,
      approvalKey: approval.approvalKey,
      decision: 'approved',
      decidedBy: 'play-visualise-acceptance-isolation',
      reason: 'Verify optional Play integration failure does not break standalone OLDT.',
    })
    assert.equal(decision.ok, true, decision.error || `PLAY_VISUALISE_ISOLATION_APPROVAL_FAILED:${approval.approvalKey}`)
    run = decision.run
  }
  return run
}

const acceptanceRun = await startEuLdtAcceptanceRun({
  cityId,
  suiteKey: SUITE_KEY,
  toolKind: 'play-visualise',
  environment: {
    profileKey: PROFILE_KEY,
    oldtBaseUrl,
    executionMode: 'real-external-tool',
  },
})

const failures = []
async function acceptanceCase({ caseKey, category, title, expected = {} }, execute) {
  const startedAt = new Date().toISOString()
  const started = Date.now()
  try {
    const result = await execute()
    await recordEuLdtAcceptanceCase({
      acceptanceRunId: acceptanceRun.id,
      caseKey,
      category,
      title,
      status: 'passed',
      workflowRunId: result?.workflowRunId ?? null,
      durationMs: Date.now() - started,
      expected,
      actual: result?.actual ?? {},
      evidence: result?.evidence ?? {},
      startedAt,
    })
    return result?.value ?? result
  } catch (error) {
    failures.push({ caseKey, error: String(error?.message ?? error) })
    await recordEuLdtAcceptanceCase({
      acceptanceRunId: acceptanceRun.id,
      caseKey,
      category,
      title,
      status: 'failed',
      durationMs: Date.now() - started,
      expected,
      actual: {},
      evidence: {},
      error: String(error?.stack ?? error?.message ?? error),
      startedAt,
    })
    return null
  }
}

let profile
let buildingsRun
let roadsRun
let fullPowerRun

profile = await acceptanceCase({
  caseKey: 'profile-and-ogc-contract',
  category: 'connectivity',
  title: 'Validated Play profile and honest OLDT OGC collection contract',
  expected: {
    profileStatus: 'validated',
    canonicalCollections: ['buildings', 'roads'],
  },
}, async () => {
  const profiles = await listEuLdtIntegrationProfiles({ platformKind: 'play-visualise', cityId })
  assert.equal(profiles.ok, true, profiles.error || 'PLAY_VISUALISE_PROFILES_NOT_OK')
  const selected = profiles.profiles.find((entry) => entry.profileKey === PROFILE_KEY)
  assert.ok(selected, 'PLAY_VISUALISE_PROFILE_MISSING')
  const checked = await testEuLdtIntegrationProfile(PROFILE_KEY)
  assert.equal(checked.profile?.status, 'validated', `PLAY_VISUALISE_PROFILE_NOT_VALIDATED:${checked.profile?.status}`)
  const catalog = await fetchOldtJson(`/api/live/${encodeURIComponent(cityId)}/standards/ogc/collections`)
  const collectionIds = (catalog.collections ?? []).map((entry) => entry.id).sort()
  assert.deepEqual(collectionIds, ['buildings', 'roads'], 'OLDT_OGC_COLLECTION_BOUNDARY_CHANGED')
  return {
    actual: {
      profileStatus: checked.profile.status,
      profileCheckCount: checked.result?.checks?.length ?? 0,
      collectionIds,
      featureCounts: Object.fromEntries((catalog.collections ?? []).map((entry) => [entry.id, entry.metadata?.featureCount ?? 0])),
    },
    evidence: {
      profileKey: PROFILE_KEY,
      checks: checked.result?.checks ?? [],
      schemas: Object.fromEntries((catalog.collections ?? []).map((entry) => [entry.id, entry.schema])),
    },
    value: checked.profile,
  }
})

buildingsRun = await acceptanceCase({
  caseKey: 'buildings-polygon-consumption',
  category: 'data-consumption',
  title: 'Play consumes 125 OLDT building polygons with semantic identity intact',
  expected: {
    featureCount: 125,
    geometryTypes: ['Polygon', 'MultiPolygon'],
    requiredProperties: ['stableId', 'entityType', 'canonicalUri', 'authorityStatus', 'modelEnrichments'],
  },
}, async () => {
  const executed = await approveAndRun({
    mode: 'basic',
    collectionKey: 'buildings',
    limit: 125,
    dataSourceName: 'OLDT Acceptance Buildings',
    layerName: 'OLDT Acceptance Buildings Fill',
    mapName: 'OLDT Acceptance Geometry Matrix',
    mapDescription: 'Acceptance map for real OLDT building and road OGC sources.',
    mapStyleType: 'fill',
    propField: 'energyLabel',
  }, 'play-visualise-acceptance-buildings')
  const source = featureCollection(await fetchOldtJson(`/api/live/${encodeURIComponent(cityId)}/standards/ogc/collections/buildings/items?limit=125`))
  const play = featureCollection(await fetchPlayLayer(profile.baseUrl, executed.summary.datalayerId))
  const types = geometryTypes(source)
  assert.equal(source.features.length, 125, 'PLAY_BUILDINGS_SOURCE_COUNT_MISMATCH')
  assert.equal(play.features.length, 125, 'PLAY_BUILDINGS_CONSUMED_COUNT_MISMATCH')
  assert.ok(types.every((type) => ['Polygon', 'MultiPolygon'].includes(type)), `PLAY_BUILDINGS_GEOMETRY_INVALID:${types.join(',')}`)
  const required = ['stableId', 'entityType', 'canonicalUri', 'authorityStatus', 'modelEnrichments']
  const coverage = propertyCoverage(play, required)
  for (const key of required) assert.equal(coverage[key], 125, `PLAY_BUILDINGS_PROPERTY_COVERAGE_MISMATCH:${key}`)
  assert.equal(new Set(play.features.map((feature) => feature.id)).size, 125, 'PLAY_BUILDINGS_IDS_NOT_UNIQUE')
  return {
    workflowRunId: executed.run.id,
    actual: {
      sourceFeatureCount: source.features.length,
      consumedFeatureCount: play.features.length,
      geometryTypes: types,
      uniqueFeatureIds: new Set(play.features.map((feature) => feature.id)).size,
      propertyCoverage: coverage,
    },
    evidence: {
      mapId: executed.summary.mapId,
      datalayerId: executed.summary.datalayerId,
      datasourceId: executed.summary.datasourceId,
      bounds: executed.summary.bounds,
      updateLayerChecks: executed.summary.updateLayerChecks,
    },
    value: executed,
  }
})

roadsRun = await acceptanceCase({
  caseKey: 'roads-line-consumption',
  category: 'data-consumption',
  title: 'Play consumes 125 OLDT road lines with semantic identity intact',
  expected: {
    featureCount: 125,
    geometryTypes: ['LineString', 'MultiLineString'],
    requiredProperties: ['stableId', 'entityType', 'canonicalUri', 'authorityStatus'],
  },
}, async () => {
  const executed = await approveAndRun({
    mode: 'basic',
    collectionKey: 'roads',
    limit: 125,
    dataSourceName: 'OLDT Acceptance Roads',
    layerName: 'OLDT Acceptance Roads Lines',
    mapName: 'OLDT Acceptance Geometry Matrix',
    mapDescription: 'Acceptance map for real OLDT building and road OGC sources.',
    mapStyleType: 'line',
    propField: 'label',
  }, 'play-visualise-acceptance-roads')
  const source = featureCollection(await fetchOldtJson(`/api/live/${encodeURIComponent(cityId)}/standards/ogc/collections/roads/items?limit=125`))
  const play = featureCollection(await fetchPlayLayer(profile.baseUrl, executed.summary.datalayerId))
  const types = geometryTypes(source)
  assert.equal(source.features.length, 125, 'PLAY_ROADS_SOURCE_COUNT_MISMATCH')
  assert.equal(play.features.length, 125, 'PLAY_ROADS_CONSUMED_COUNT_MISMATCH')
  assert.ok(types.every((type) => ['LineString', 'MultiLineString'].includes(type)), `PLAY_ROADS_GEOMETRY_INVALID:${types.join(',')}`)
  const required = ['stableId', 'entityType', 'canonicalUri', 'authorityStatus']
  const coverage = propertyCoverage(play, required)
  for (const key of required) assert.equal(coverage[key], 125, `PLAY_ROADS_PROPERTY_COVERAGE_MISMATCH:${key}`)
  assert.equal(new Set(play.features.map((feature) => feature.id)).size, 125, 'PLAY_ROADS_IDS_NOT_UNIQUE')
  return {
    workflowRunId: executed.run.id,
    actual: {
      sourceFeatureCount: source.features.length,
      consumedFeatureCount: play.features.length,
      geometryTypes: types,
      uniqueFeatureIds: new Set(play.features.map((feature) => feature.id)).size,
      propertyCoverage: coverage,
    },
    evidence: {
      mapId: executed.summary.mapId,
      datalayerId: executed.summary.datalayerId,
      datasourceId: executed.summary.datasourceId,
      bounds: executed.summary.bounds,
      updateLayerChecks: executed.summary.updateLayerChecks,
    },
    value: executed,
  }
})

fullPowerRun = await acceptanceCase({
  caseKey: 'full-power-map-composition',
  category: 'visual-composition',
  title: 'Play composes 500 real OLDT features into 2D, 3D, label, chart, and report assets',
  expected: {
    sourceFeatureCount: 500,
    datasourceCount: 2,
    datalayerCount: 4,
    styleTypes: ['fill', 'fill-extrusion', 'line', 'symbol'],
    plotCount: 1,
    reportCount: 1,
  },
}, async () => {
  const executed = await approveAndRun({
    mode: 'full-power',
    limit: 250,
    dataSourceNamePrefix: 'OLDT Acceptance Full Power',
    mapName: 'OLDT Acceptance Full Power',
    mapDescription: 'Repeatable Play acceptance map with real OLDT buildings, roads, 3D extrusion, labels, chart, and report.',
    buildingsFillLayerName: 'OLDT Acceptance Buildings Energy Fill',
    buildingsExtrusionLayerName: 'OLDT Acceptance Buildings SAP Extrusion',
    buildingsLabelLayerName: 'OLDT Acceptance Building Labels',
    roadsLayerName: 'OLDT Acceptance Roads Lines Full',
    plotName: 'OLDT Acceptance SAP Score Histogram',
    reportName: 'OLDT Acceptance Full Power Snapshot',
  }, 'play-visualise-acceptance-full-power')
  assert.equal(executed.summary.featureCount, 500, 'PLAY_FULL_POWER_SOURCE_COUNT_MISMATCH')
  assert.equal(executed.summary.datasources.length, 2, 'PLAY_FULL_POWER_DATASOURCE_COUNT_MISMATCH')
  assert.equal(executed.summary.datalayers.length, 4, 'PLAY_FULL_POWER_DATALAYER_COUNT_MISMATCH')
  assert.equal(executed.summary.plots.length, 1, 'PLAY_FULL_POWER_PLOT_COUNT_MISMATCH')
  assert.equal(executed.summary.reports.length, 1, 'PLAY_FULL_POWER_REPORT_COUNT_MISMATCH')
  const styles = executed.summary.datalayers.map((layer) => layer.configuration?.type).sort()
  assert.deepEqual(styles, ['fill', 'fill-extrusion', 'line', 'symbol'], 'PLAY_FULL_POWER_STYLES_MISMATCH')
  assert.ok(executed.summary.updateLayerChecks.every((entry) => entry.ok && entry.featureCount === 250), 'PLAY_FULL_POWER_LAYER_CONSUMPTION_MISMATCH')
  const detail = await getWorkflowRun(executed.run.id)
  const artifactKinds = detail.run.artifacts.map((artifact) => artifact.artifactKind)
  for (const required of ['visualise-source', 'visualise-registration', 'visualise-consumption-check', 'visualise-registration-summary']) {
    assert.ok(artifactKinds.includes(required), `PLAY_FULL_POWER_ARTIFACT_MISSING:${required}`)
  }
  return {
    workflowRunId: executed.run.id,
    actual: {
      sourceFeatureCount: executed.summary.featureCount,
      datasourceCount: executed.summary.datasources.length,
      datalayerCount: executed.summary.datalayers.length,
      styleTypes: styles,
      plotCount: executed.summary.plots.length,
      reportCount: executed.summary.reports.length,
      consumedCounts: executed.summary.updateLayerChecks.map((entry) => entry.featureCount),
    },
    evidence: {
      mapId: executed.summary.mapId,
      datasourceIds: executed.summary.datasources.map((entry) => entry.id),
      datalayerIds: executed.summary.datalayers.map((entry) => entry.id),
      plotIds: executed.summary.plots.map((entry) => entry.id),
      reportIds: executed.summary.reports.map((entry) => entry.id),
      artifactKinds,
    },
    value: executed,
  }
})

await acceptanceCase({
  caseKey: 'idempotent-reregistration',
  category: 'repeatability',
  title: 'Re-registering the same Play composition updates rather than duplicates it',
  expected: {
    stableMapId: true,
    stableDatasourceIds: true,
    stableDatalayerIds: true,
    consumedFeatureCount: 500,
  },
}, async () => {
  assert.ok(fullPowerRun, 'PLAY_FULL_POWER_PREREQUISITE_FAILED')
  const repeated = await approveAndRun({
    mode: 'full-power',
    limit: 250,
    dataSourceNamePrefix: 'OLDT Acceptance Full Power',
    mapName: 'OLDT Acceptance Full Power',
    mapDescription: 'Repeatable Play acceptance map with real OLDT buildings, roads, 3D extrusion, labels, chart, and report.',
    buildingsFillLayerName: 'OLDT Acceptance Buildings Energy Fill',
    buildingsExtrusionLayerName: 'OLDT Acceptance Buildings SAP Extrusion',
    buildingsLabelLayerName: 'OLDT Acceptance Building Labels',
    roadsLayerName: 'OLDT Acceptance Roads Lines Full',
    plotName: 'OLDT Acceptance SAP Score Histogram',
    reportName: 'OLDT Acceptance Full Power Snapshot',
  }, 'play-visualise-acceptance-idempotency')
  const firstDatasourceIds = fullPowerRun.summary.datasources.map((entry) => entry.id).sort()
  const repeatedDatasourceIds = repeated.summary.datasources.map((entry) => entry.id).sort()
  const firstLayerIds = fullPowerRun.summary.datalayers.map((entry) => entry.id).sort()
  const repeatedLayerIds = repeated.summary.datalayers.map((entry) => entry.id).sort()
  assert.equal(repeated.summary.mapId, fullPowerRun.summary.mapId, 'PLAY_IDEMPOTENCY_MAP_ID_CHANGED')
  assert.deepEqual(repeatedDatasourceIds, firstDatasourceIds, 'PLAY_IDEMPOTENCY_DATASOURCE_IDS_CHANGED')
  assert.deepEqual(repeatedLayerIds, firstLayerIds, 'PLAY_IDEMPOTENCY_DATALAYER_IDS_CHANGED')
  assert.equal(repeated.summary.featureCount, 500, 'PLAY_IDEMPOTENCY_FEATURE_COUNT_MISMATCH')
  return {
    workflowRunId: repeated.run.id,
    actual: {
      stableMapId: true,
      stableDatasourceIds: true,
      stableDatalayerIds: true,
      consumedFeatureCount: repeated.summary.featureCount,
    },
    evidence: {
      firstWorkflowRunId: fullPowerRun.run.id,
      repeatedWorkflowRunId: repeated.run.id,
      mapId: repeated.summary.mapId,
      datasourceIds: repeatedDatasourceIds,
      datalayerIds: repeatedLayerIds,
    },
  }
})

await acceptanceCase({
  caseKey: 'optional-integration-failure-isolation',
  category: 'resilience',
  title: 'A missing Play profile fails only its workflow and leaves standalone OLDT available',
  expected: {
    workflowStatus: 'failed',
    error: 'EU_LDT_PROFILE_NOT_FOUND',
    oldtStillAvailable: true,
  },
}, async () => {
  const isolationRun = await createIsolationRun()
  const failed = await executeWorkflowRunOnce({
    runId: isolationRun.id,
    workerId: 'play-visualise-acceptance-isolation',
  })
  assert.equal(failed.ok, false, 'PLAY_MISSING_PROFILE_SHOULD_FAIL')
  assert.match(failed.error, /EU_LDT_PROFILE_NOT_FOUND/, 'PLAY_MISSING_PROFILE_ERROR_MISMATCH')
  const failedDetail = await getWorkflowRun(isolationRun.id)
  assert.equal(failedDetail.run?.status, 'failed', 'PLAY_MISSING_PROFILE_RUN_NOT_FAILED')
  const capability = await getCityCapabilityState(cityId)
  assert.equal(capability.ok, true, capability.error || 'OLDT_UNAVAILABLE_AFTER_PLAY_FAILURE')
  assert.ok(Number(capability.counts?.entities ?? 0) > 0, 'OLDT_ENTITIES_UNAVAILABLE_AFTER_PLAY_FAILURE')
  return {
    workflowRunId: isolationRun.id,
    actual: {
      workflowStatus: failedDetail.run?.status,
      error: failed.error,
      oldtStillAvailable: capability.ok,
      canonicalEntityCount: Number(capability.counts?.entities ?? 0),
    },
    evidence: {
      failedWorkflowRunId: isolationRun.id,
      capabilityCounts: capability.counts,
    },
  }
})

const finished = await finishEuLdtAcceptanceRun({
  acceptanceRunId: acceptanceRun.id,
  status: failures.length ? 'failed' : 'passed',
  summary: {
    profileKey: PROFILE_KEY,
    oldtBaseUrl,
    workflowRunIds: [buildingsRun?.run?.id, roadsRun?.run?.id, fullPowerRun?.run?.id].filter(Boolean),
    featureCoverage: {
      buildings: buildingsRun?.summary?.directReads?.[0]?.featureCount ?? 0,
      roads: roadsRun?.summary?.directReads?.[0]?.featureCount ?? 0,
      fullPowerTotal: fullPowerRun?.summary?.featureCount ?? 0,
    },
    failures,
  },
})
const detail = await getEuLdtAcceptanceRun(acceptanceRun.id)

console.log(JSON.stringify({
  ok: failures.length === 0,
  acceptanceRunId: acceptanceRun.id,
  suiteKey: SUITE_KEY,
  cityId,
  status: finished.status,
  counts: finished.summary.counts,
  cases: detail.cases.map((entry) => ({
    caseKey: entry.caseKey,
    status: entry.status,
    workflowRunId: entry.workflowRunId,
    durationMs: entry.durationMs,
  })),
  failures,
}, null, 2))

assert.equal(failures.length, 0, `PLAY_VISUALISE_ACCEPTANCE_FAILED:${failures.map((entry) => entry.caseKey).join(',')}`)
