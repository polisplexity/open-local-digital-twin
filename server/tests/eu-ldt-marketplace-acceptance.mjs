import assert from 'node:assert/strict'
import crypto from 'node:crypto'

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
import { withClient } from '../services/ldtOps/dbUtils.mjs'
import { resolveEuLdtIntegrationTarget } from '../services/ldtOps/euLdtIntegrationService.mjs'

const SUITE_KEY = 'eu-ldt-marketplace-acceptance-v1' // gitleaks:allow -- public test suite identifier
const AGENT_PROFILE_KEYS = [
  process.env.EU_LDT_MARKETPLACE_AGENT_A ?? 'local-eu-ldt-marketplace-agent',
  process.env.EU_LDT_MARKETPLACE_AGENT_B ?? 'local-eu-ldt-marketplace-agent-2',
]
const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
const cityId = cityArg ? cityArg.split('=').slice(1).join('=').trim() : 'guanajuato'
const oldtBaseUrl = String(process.env.OLDT_ACCEPTANCE_BASE_URL ?? 'http://host.docker.internal:4292').replace(/\/+$/, '')
const marketplaceHubApiUrl = String(process.env.EU_LDT_MARKETPLACE_HUB_API_URL ?? 'http://marketplace.127.0.0.1.nip.io:4314').replace(/\/+$/, '')
const smokeEmail = process.env.TWIN_STUDIO_SMOKE_EMAIL ?? 'smoke@polisplexity.test'
const smokePassword = process.env.TWIN_STUDIO_SMOKE_PASSWORD ?? 'local-smoke-password-change-me'
const executionTag = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`

let oldtCookie = ''

async function responseBody(response) {
  const raw = await response.text()
  let body = null
  try {
    body = raw ? JSON.parse(raw) : null
  } catch {
    body = { raw: raw.slice(0, 2000) }
  }
  return { raw, body }
}

async function fetchJson(url, options = {}, expectedStatuses = [200]) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers ?? {}) },
    signal: options.signal ?? AbortSignal.timeout(60000),
  })
  const parsed = await responseBody(response)
  assert.ok(
    expectedStatuses.includes(response.status),
    `HTTP_STATUS_UNEXPECTED:${response.status}:${url}:${parsed.raw.slice(0, 600)}`,
  )
  return { response, ...parsed }
}

async function getOldtCookie() {
  if (oldtCookie) return oldtCookie
  const result = await fetchJson(`${oldtBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: smokeEmail,
      password: smokePassword,
      cityId,
      rememberMe: true,
    }),
  })
  assert.equal(result.body?.ok, true, 'OLDT_MARKETPLACE_LOGIN_FAILED')
  oldtCookie = String(result.response.headers.get('set-cookie') ?? '').split(';')[0]
  assert.match(oldtCookie, /^twin_session=/, 'OLDT_MARKETPLACE_SESSION_COOKIE_MISSING')
  return oldtCookie
}

async function readOldtCollection(collectionKey, limit) {
  const result = await fetchJson(
    `${oldtBaseUrl}/api/live/${encodeURIComponent(cityId)}/standards/ogc/collections/${encodeURIComponent(collectionKey)}/items?limit=${limit}`,
    { headers: { Cookie: await getOldtCookie(), Accept: 'application/geo+json, application/json' } },
  )
  assert.equal(result.body?.type, 'FeatureCollection', `OLDT_MARKETPLACE_GEOJSON_REQUIRED:${collectionKey}`)
  assert.equal(result.body?.features?.length, limit, `OLDT_MARKETPLACE_FEATURE_COUNT_MISMATCH:${collectionKey}`)
  return result.body
}

async function approveAndRunMarketplace(input, workerId) {
  const created = await createWorkflowRun({
    workflowKey: 'eu-ldt-marketplace-agent-publish',
    cityId,
    input,
    requestedBy: workerId,
    requestedByKind: 'system-acceptance',
    triggerKind: 'integration-acceptance',
  })
  assert.equal(created.ok, true, created.error || 'MARKETPLACE_WORKFLOW_CREATE_FAILED')
  let run = created.run
  for (const approval of run.approvals.filter((entry) => entry.status === 'requested')) {
    const decision = await decideWorkflowApproval({
      runId: run.id,
      approvalKey: approval.approvalKey,
      decision: 'approved',
      decidedBy: workerId,
      reason: 'Approve real Marketplace Agent upload, hub publication, launch, and acceptance readback.',
    })
    assert.equal(decision.ok, true, decision.error || `MARKETPLACE_APPROVAL_FAILED:${approval.approvalKey}`)
    run = decision.run
  }
  assert.equal(run.status, 'queued', 'MARKETPLACE_WORKFLOW_NOT_QUEUED')
  const executed = await executeWorkflowRunOnce({ runId: run.id, workerId })
  assert.equal(executed.ok, true, executed.error || 'MARKETPLACE_WORKFLOW_EXECUTE_FAILED')
  assert.equal(executed.run?.status, 'succeeded', 'MARKETPLACE_WORKFLOW_NOT_SUCCEEDED')
  return executed
}

function artifactMetadata(executed, artifactKind) {
  const artifact = executed.artifacts.find((entry) => entry.artifactKind === artifactKind)
  assert.ok(artifact, `MARKETPLACE_ARTIFACT_MISSING:${artifactKind}`)
  return artifact.metadata ?? {}
}

function publicationEvidence(executed) {
  const upload = artifactMetadata(executed, 'marketplace-agent-upload').results?.[0]
  const publish = artifactMetadata(executed, 'marketplace-agent-publish').results?.[0]
  const launch = artifactMetadata(executed, 'marketplace-hub-launch').results?.[0]
  const assetId = publish?.assetId ?? upload?.body?.id
  const state = publish?.body?.publishState ?? publish?.body?.publish_state ?? {}
  return {
    upload,
    publish,
    launch,
    assetId,
    offeringId: state.offering_id ?? state.offeringId,
    productSpecId: state.prod_spec_id ?? state.productSpecId,
    resourceSpecId: state.res_spec_id ?? state.resourceSpecId,
    sha256: publish?.body?.sha256Checksum ?? upload?.body?.sha256Checksum,
  }
}

async function resolvedAgent(profileKey) {
  return withClient((client) => resolveEuLdtIntegrationTarget(client, profileKey, {
    platformKind: 'marketplace-agent',
    endpointKey: 'assetsUrl',
    authPurposes: ['download'],
  }))
}

async function downloadAsset(profileKey, assetId, expectedSha256) {
  const target = await resolvedAgent(profileKey)
  const downloadHeaders = target.purposeHeaders?.download ?? {}
  const endpoint = `${target.endpoint.replace(/\/+$/, '')}/${encodeURIComponent(assetId)}/download-url`
  const result = await fetchJson(endpoint, {
    method: 'POST',
    headers: downloadHeaders,
  })
  assert.ok(result.body?.downloadUrl, 'MARKETPLACE_DOWNLOAD_URL_MISSING')
  assert.equal(result.body?.sha256Checksum, expectedSha256, 'MARKETPLACE_DOWNLOAD_METADATA_SHA256_MISMATCH')
  const download = await fetch(result.body.downloadUrl, { signal: AbortSignal.timeout(60000) })
  const bytes = Buffer.from(await download.arrayBuffer())
  assert.equal(download.ok, true, `MARKETPLACE_ASSET_DOWNLOAD_FAILED:${download.status}`)
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
  assert.equal(sha256, expectedSha256, 'MARKETPLACE_DOWNLOADED_SHA256_MISMATCH')
  const packagePayload = JSON.parse(bytes.toString('utf8'))
  return {
    target,
    endpoint,
    downloadMetadata: result.body,
    byteSize: bytes.length,
    sha256,
    packagePayload,
  }
}

async function createIsolationRun() {
  const created = await createWorkflowRun({
    workflowKey: 'eu-ldt-marketplace-agent-publish',
    cityId,
    input: {
      dryRun: false,
      publishToHub: false,
      integrationProfileKeys: [`missing-marketplace-agent-${Date.now()}`],
      assetType: 'oldt.query-fragment',
      title: 'Marketplace missing profile isolation',
      payload: { query: { classes: ['buildings'] } },
    },
    requestedBy: 'marketplace-acceptance-isolation',
    requestedByKind: 'system-acceptance',
    triggerKind: 'standalone-isolation-acceptance',
  })
  assert.equal(created.ok, true, created.error || 'MARKETPLACE_ISOLATION_CREATE_FAILED')
  let run = created.run
  for (const approval of run.approvals.filter((entry) => entry.status === 'requested')) {
    const decision = await decideWorkflowApproval({
      runId: run.id,
      approvalKey: approval.approvalKey,
      decision: 'approved',
      decidedBy: 'marketplace-acceptance-isolation',
      reason: 'Verify missing optional Marketplace Agent does not break standalone OLDT.',
    })
    assert.equal(decision.ok, true, decision.error || `MARKETPLACE_ISOLATION_APPROVAL_FAILED:${approval.approvalKey}`)
    run = decision.run
  }
  return run
}

const acceptanceRun = await startEuLdtAcceptanceRun({
  cityId,
  suiteKey: SUITE_KEY,
  toolKind: 'marketplace',
  environment: {
    agentProfileKeys: AGENT_PROFILE_KEYS,
    marketplaceHubApiUrl,
    oldtBaseUrl,
    executionMode: 'real-multi-agent-publication-and-readback',
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

let agentProfiles
let agentAPublication
let agentBPublication
let agentAEvidence
let agentBEvidence

agentProfiles = await acceptanceCase({
  caseKey: 'two-agent-m2m-connectivity',
  category: 'connectivity',
  title: 'Two distinct Marketplace Agent profiles authenticate with renewable M2M tokens',
  expected: {
    profileCount: 2,
    profileStatus: 'validated',
    metadataStatus: 200,
    distinctBaseUrls: true,
  },
}, async () => {
  const listed = await listEuLdtIntegrationProfiles({ platformKind: 'marketplace-agent', cityId })
  assert.equal(listed.ok, true, listed.error || 'MARKETPLACE_PROFILES_NOT_OK')
  const selected = AGENT_PROFILE_KEYS.map((key) => listed.profiles.find((profile) => profile.profileKey === key))
  assert.ok(selected.every(Boolean), 'MARKETPLACE_AGENT_PROFILE_MISSING')
  assert.equal(new Set(selected.map((profile) => profile.baseUrl)).size, 2, 'MARKETPLACE_AGENT_BASE_URLS_NOT_DISTINCT')
  for (const profile of selected) {
    const serializedAuth = JSON.stringify(profile.authConfig ?? {})
    assert.equal(serializedAuth.includes('clientSecret"'), false, `MARKETPLACE_AGENT_SECRET_EXPOSED:${profile.profileKey}`)
    assert.equal(profile.authConfig?.clientSecretConfigured, true, `MARKETPLACE_AGENT_SECRET_FLAG_MISSING:${profile.profileKey}`)
    for (const purpose of ['marketplaceHub', 'download']) {
      assert.equal(
        profile.authConfig?.purposes?.[purpose]?.clientSecretConfigured,
        true,
        `MARKETPLACE_AGENT_PURPOSE_SECRET_FLAG_MISSING:${profile.profileKey}:${purpose}`,
      )
    }
  }
  const checks = []
  for (const profileKey of AGENT_PROFILE_KEYS) {
    const checked = await testEuLdtIntegrationProfile(profileKey)
    assert.equal(checked.profile?.status, 'validated', `MARKETPLACE_AGENT_NOT_VALIDATED:${profileKey}:${checked.profile?.status}`)
    assert.ok(checked.result?.checks?.every((entry) => entry.ok), `MARKETPLACE_AGENT_CHECK_FAILED:${profileKey}`)
    assert.ok(checked.result?.checks?.some((entry) => entry.status === 200 && entry.url.includes('/metadata/assets')), `MARKETPLACE_AGENT_M2M_METADATA_NOT_AUTHORIZED:${profileKey}`)
    checks.push({ profileKey, status: checked.profile.status, checks: checked.result.checks })
  }
  return {
    actual: {
      profileCount: selected.length,
      statuses: Object.fromEntries(checks.map((entry) => [entry.profileKey, entry.status])),
      baseUrls: selected.map((profile) => profile.baseUrl),
      metadataStatuses: checks.map((entry) => entry.checks.find((check) => check.url.includes('/metadata/assets'))?.status),
      nestedSecretsRedacted: true,
    },
    evidence: { checks },
    value: selected,
  }
})

agentAPublication = await acceptanceCase({
  caseKey: 'agent-a-semantic-layer-publication',
  category: 'provider-publication',
  title: 'Agent A publishes and launches a real 25-building OLDT semantic layer',
  expected: {
    dryRun: false,
    uploadedCount: 1,
    publishedCount: 1,
    launchedCount: 1,
    featureCount: 25,
  },
}, async () => {
  const buildings = await readOldtCollection('buildings', 25)
  const title = `OLDT acceptance buildings ${executionTag}`
  const executed = await approveAndRunMarketplace({
    dryRun: false,
    publishToHub: true,
    launchInMarketplace: true,
    integrationProfileKeys: [AGENT_PROFILE_KEYS[0]],
    assetType: 'oldt.semantic-layer',
    title,
    description: 'Real OLDT Guanajuato building polygons packaged for Marketplace multi-agent acceptance.',
    fileName: `oldt-acceptance-buildings-${executionTag}.json`,
    licence: 'CC-BY-4.0',
    categories: ['IoT and Sensor Networks'],
    compatibilityTargets: ['oldt', 'data-platform', 'play-visualise'],
    payload: buildings,
  }, 'marketplace-acceptance-agent-a')
  const evidence = publicationEvidence(executed)
  assert.equal(executed.summary.dryRun, false, 'MARKETPLACE_AGENT_A_DRY_RUN_UNEXPECTED')
  assert.equal(executed.summary.uploadedCount, 1, 'MARKETPLACE_AGENT_A_UPLOAD_COUNT_MISMATCH')
  assert.equal(executed.summary.publishedCount, 1, 'MARKETPLACE_AGENT_A_PUBLISH_COUNT_MISMATCH')
  assert.equal(executed.summary.launchedCount, 1, 'MARKETPLACE_AGENT_A_LAUNCH_COUNT_MISMATCH')
  assert.ok(evidence.assetId && evidence.offeringId && evidence.sha256, 'MARKETPLACE_AGENT_A_IDENTIFIERS_MISSING')
  return {
    workflowRunId: executed.run.id,
    actual: {
      title,
      featureCount: buildings.features.length,
      uploadedCount: executed.summary.uploadedCount,
      publishedCount: executed.summary.publishedCount,
      launchedCount: executed.summary.launchedCount,
      assetId: evidence.assetId,
      offeringId: evidence.offeringId,
      sha256: evidence.sha256,
    },
    evidence: {
      profileKey: AGENT_PROFILE_KEYS[0],
      productSpecId: evidence.productSpecId,
      resourceSpecId: evidence.resourceSpecId,
      launchPatches: evidence.launch?.patches ?? [],
    },
    value: { executed, title, ...evidence },
  }
})

agentBPublication = await acceptanceCase({
  caseKey: 'agent-b-query-fragment-publication',
  category: 'provider-publication',
  title: 'Agent B independently publishes and launches an OLDT road query package',
  expected: {
    dryRun: false,
    uploadedCount: 1,
    publishedCount: 1,
    launchedCount: 1,
    resultFeatureCount: 15,
  },
}, async () => {
  const roads = await readOldtCollection('roads', 15)
  const title = `OLDT acceptance road query ${executionTag}`
  const executed = await approveAndRunMarketplace({
    dryRun: false,
    publishToHub: true,
    launchInMarketplace: true,
    integrationProfileKeys: [AGENT_PROFILE_KEYS[1]],
    assetType: 'oldt.query-fragment',
    title,
    description: 'Reusable OLDT roads query and bounded result sample published through independent Marketplace Agent B.',
    fileName: `oldt-acceptance-road-query-${executionTag}.json`,
    licence: 'CC-BY-4.0',
    categories: ['IoT and Sensor Networks'],
    compatibilityTargets: ['oldt', 'data-platform', 'play-visualise'],
    payload: {
      query: {
        language: 'twinql-json',
        classes: ['roads'],
        scope: { key: 'city' },
        render: { mode: 'isolate', transport: 'geojson', maxFeatures: 15 },
      },
      resultSample: roads,
    },
  }, 'marketplace-acceptance-agent-b')
  const evidence = publicationEvidence(executed)
  assert.equal(executed.summary.uploadedCount, 1, 'MARKETPLACE_AGENT_B_UPLOAD_COUNT_MISMATCH')
  assert.equal(executed.summary.publishedCount, 1, 'MARKETPLACE_AGENT_B_PUBLISH_COUNT_MISMATCH')
  assert.equal(executed.summary.launchedCount, 1, 'MARKETPLACE_AGENT_B_LAUNCH_COUNT_MISMATCH')
  assert.ok(evidence.assetId && evidence.offeringId && evidence.sha256, 'MARKETPLACE_AGENT_B_IDENTIFIERS_MISSING')
  assert.notEqual(evidence.assetId, agentAPublication?.assetId, 'MARKETPLACE_MULTI_AGENT_ASSET_IDS_COLLIDED')
  return {
    workflowRunId: executed.run.id,
    actual: {
      title,
      resultFeatureCount: roads.features.length,
      uploadedCount: executed.summary.uploadedCount,
      publishedCount: executed.summary.publishedCount,
      launchedCount: executed.summary.launchedCount,
      assetId: evidence.assetId,
      offeringId: evidence.offeringId,
      sha256: evidence.sha256,
    },
    evidence: {
      profileKey: AGENT_PROFILE_KEYS[1],
      productSpecId: evidence.productSpecId,
      resourceSpecId: evidence.resourceSpecId,
      launchPatches: evidence.launch?.patches ?? [],
    },
    value: { executed, title, ...evidence },
  }
})

await acceptanceCase({
  caseKey: 'hub-discovery-of-both-offerings',
  category: 'hub-discovery',
  title: 'The central Marketplace exposes both independent OLDT offerings as Launched',
  expected: {
    offeringCount: 2,
    lifecycleStatus: 'Launched',
  },
}, async () => {
  assert.ok(agentAPublication && agentBPublication, 'MARKETPLACE_PUBLICATION_PREREQUISITE_FAILED')
  const offerings = []
  for (const publication of [agentAPublication, agentBPublication]) {
    const result = await fetchJson(`${marketplaceHubApiUrl}/catalog/productOffering/${encodeURIComponent(publication.offeringId)}`)
    assert.equal(result.body?.id, publication.offeringId, 'MARKETPLACE_HUB_OFFERING_ID_MISMATCH')
    assert.equal(result.body?.lifecycleStatus, 'Launched', `MARKETPLACE_OFFERING_NOT_LAUNCHED:${publication.offeringId}`)
    assert.equal(result.body?.name, publication.title, `MARKETPLACE_OFFERING_TITLE_MISMATCH:${publication.offeringId}`)
    offerings.push(result.body)
  }
  return {
    actual: {
      offeringCount: offerings.length,
      offeringIds: offerings.map((offering) => offering.id),
      lifecycleStatuses: offerings.map((offering) => offering.lifecycleStatus),
      names: offerings.map((offering) => offering.name),
    },
    evidence: {
      exploreUrls: offerings.map((offering) => `http://marketplace.127.0.0.1.nip.io:4314/explore/${offering.id}`),
    },
  }
})

agentAEvidence = await acceptanceCase({
  caseKey: 'agent-a-download-checksum-readback',
  category: 'consumer-readback',
  title: 'OLDT retrieves Agent A package and verifies byte-for-byte checksum and semantic payload',
  expected: {
    packageType: 'oldt.semantic-layer',
    cityId,
    featureCount: 25,
    checksumVerified: true,
  },
}, async () => {
  assert.ok(agentAPublication, 'MARKETPLACE_AGENT_A_PUBLICATION_PREREQUISITE_FAILED')
  const downloaded = await downloadAsset(AGENT_PROFILE_KEYS[0], agentAPublication.assetId, agentAPublication.sha256)
  assert.equal(downloaded.packagePayload.schemaVersion, '2026-07-08.oldt-marketplace-package.v1', 'MARKETPLACE_AGENT_A_SCHEMA_VERSION_MISMATCH')
  assert.equal(downloaded.packagePayload.packageType, 'oldt.semantic-layer', 'MARKETPLACE_AGENT_A_PACKAGE_TYPE_MISMATCH')
  assert.equal(downloaded.packagePayload.cityId, cityId, 'MARKETPLACE_AGENT_A_CITY_MISMATCH')
  assert.equal(downloaded.packagePayload.source.workflowRunId, agentAPublication.executed.run.id, 'MARKETPLACE_AGENT_A_WORKFLOW_PROVENANCE_MISMATCH')
  assert.equal(downloaded.packagePayload.data.features.length, 25, 'MARKETPLACE_AGENT_A_PAYLOAD_COUNT_MISMATCH')
  return {
    actual: {
      packageType: downloaded.packagePayload.packageType,
      cityId: downloaded.packagePayload.cityId,
      featureCount: downloaded.packagePayload.data.features.length,
      byteSize: downloaded.byteSize,
      sha256: downloaded.sha256,
      checksumVerified: downloaded.sha256 === agentAPublication.sha256,
    },
    evidence: {
      profileKey: AGENT_PROFILE_KEYS[0],
      assetId: agentAPublication.assetId,
      sourceWorkflowRunId: downloaded.packagePayload.source.workflowRunId,
      compatibility: downloaded.packagePayload.compatibility,
    },
    value: downloaded,
  }
})

agentBEvidence = await acceptanceCase({
  caseKey: 'agent-b-download-checksum-readback',
  category: 'consumer-readback',
  title: 'OLDT retrieves Agent B query package and verifies checksum, query, and bounded result',
  expected: {
    packageType: 'oldt.query-fragment',
    cityId,
    resultFeatureCount: 15,
    checksumVerified: true,
  },
}, async () => {
  assert.ok(agentBPublication, 'MARKETPLACE_AGENT_B_PUBLICATION_PREREQUISITE_FAILED')
  const downloaded = await downloadAsset(AGENT_PROFILE_KEYS[1], agentBPublication.assetId, agentBPublication.sha256)
  assert.equal(downloaded.packagePayload.packageType, 'oldt.query-fragment', 'MARKETPLACE_AGENT_B_PACKAGE_TYPE_MISMATCH')
  assert.equal(downloaded.packagePayload.cityId, cityId, 'MARKETPLACE_AGENT_B_CITY_MISMATCH')
  assert.deepEqual(downloaded.packagePayload.data.query.classes, ['roads'], 'MARKETPLACE_AGENT_B_QUERY_CLASS_MISMATCH')
  assert.equal(downloaded.packagePayload.data.resultSample.features.length, 15, 'MARKETPLACE_AGENT_B_RESULT_COUNT_MISMATCH')
  return {
    actual: {
      packageType: downloaded.packagePayload.packageType,
      cityId: downloaded.packagePayload.cityId,
      queryClasses: downloaded.packagePayload.data.query.classes,
      resultFeatureCount: downloaded.packagePayload.data.resultSample.features.length,
      byteSize: downloaded.byteSize,
      sha256: downloaded.sha256,
      checksumVerified: downloaded.sha256 === agentBPublication.sha256,
    },
    evidence: {
      profileKey: AGENT_PROFILE_KEYS[1],
      assetId: agentBPublication.assetId,
      sourceWorkflowRunId: downloaded.packagePayload.source.workflowRunId,
      compatibility: downloaded.packagePayload.compatibility,
    },
    value: downloaded,
  }
})

await acceptanceCase({
  caseKey: 'agent-auth-and-storage-isolation',
  category: 'security',
  title: 'Download requires authentication and assets remain isolated between agents',
  expected: {
    unauthenticatedStatus: 401,
    crossAgentStatus: 404,
    authenticatedReadback: true,
  },
}, async () => {
  assert.ok(agentAPublication && agentBPublication && agentAEvidence && agentBEvidence, 'MARKETPLACE_SECURITY_PREREQUISITE_FAILED')
  const agentA = await resolvedAgent(AGENT_PROFILE_KEYS[0])
  const agentB = await resolvedAgent(AGENT_PROFILE_KEYS[1])
  const unauthenticated = await fetchJson(
    `${agentA.endpoint.replace(/\/+$/, '')}/${encodeURIComponent(agentAPublication.assetId)}/download-url`,
    { method: 'POST' },
    [401],
  )
  const crossAgent = await fetchJson(
    `${agentB.endpoint.replace(/\/+$/, '')}/${encodeURIComponent(agentAPublication.assetId)}/download-url`,
    { method: 'POST', headers: agentB.purposeHeaders?.download ?? {} },
    [404],
  )
  return {
    actual: {
      unauthenticatedStatus: unauthenticated.response.status,
      crossAgentStatus: crossAgent.response.status,
      authenticatedReadback: true,
      agentAAssetId: agentAPublication.assetId,
      agentBAssetId: agentBPublication.assetId,
    },
    evidence: {
      unauthenticatedError: unauthenticated.body,
      crossAgentError: crossAgent.body,
      agentABaseUrl: agentA.profile.baseUrl,
      agentBBaseUrl: agentB.profile.baseUrl,
    },
  }
})

await acceptanceCase({
  caseKey: 'optional-integration-failure-isolation',
  category: 'resilience',
  title: 'A missing Marketplace profile fails only its workflow and leaves standalone OLDT available',
  expected: {
    workflowStatus: 'failed',
    error: 'EU_LDT_PROFILE_NOT_FOUND',
    oldtStillAvailable: true,
  },
}, async () => {
  const isolationRun = await createIsolationRun()
  const failed = await executeWorkflowRunOnce({
    runId: isolationRun.id,
    workerId: 'marketplace-acceptance-isolation',
  })
  assert.equal(failed.ok, false, 'MARKETPLACE_MISSING_PROFILE_SHOULD_FAIL')
  assert.match(failed.error, /EU_LDT_PROFILE_NOT_FOUND/, 'MARKETPLACE_MISSING_PROFILE_ERROR_MISMATCH')
  const detail = await getWorkflowRun(isolationRun.id)
  assert.equal(detail.run?.status, 'failed', 'MARKETPLACE_MISSING_PROFILE_RUN_NOT_FAILED')
  const capability = await getCityCapabilityState(cityId)
  assert.equal(capability.ok, true, capability.error || 'OLDT_UNAVAILABLE_AFTER_MARKETPLACE_FAILURE')
  assert.ok(Number(capability.counts?.entities ?? 0) > 0, 'OLDT_ENTITIES_UNAVAILABLE_AFTER_MARKETPLACE_FAILURE')
  return {
    workflowRunId: isolationRun.id,
    actual: {
      workflowStatus: detail.run.status,
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
    agentProfileKeys: AGENT_PROFILE_KEYS,
    marketplaceHubApiUrl,
    workflowRunIds: [agentAPublication?.executed?.run?.id, agentBPublication?.executed?.run?.id].filter(Boolean),
    assetIds: [agentAPublication?.assetId, agentBPublication?.assetId].filter(Boolean),
    offeringIds: [agentAPublication?.offeringId, agentBPublication?.offeringId].filter(Boolean),
    downloadedBytes: Number(agentAEvidence?.byteSize ?? 0) + Number(agentBEvidence?.byteSize ?? 0),
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
  assetIds: finished.summary.assetIds,
  offeringIds: finished.summary.offeringIds,
  cases: detail.cases.map((entry) => ({
    caseKey: entry.caseKey,
    status: entry.status,
    workflowRunId: entry.workflowRunId,
    durationMs: entry.durationMs,
  })),
  failures,
}, null, 2))

assert.equal(failures.length, 0, `MARKETPLACE_ACCEPTANCE_FAILED:${failures.map((entry) => entry.caseKey).join(',')}`)
