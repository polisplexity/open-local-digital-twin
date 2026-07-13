import { exportCityTwinQuery } from '../twinQuery/twinQueryExportService.mjs'
import {
  createDataSpaceAssetPackage,
  createDataSpaceTransferReceipt,
  getDataSpaceTransferReceipt,
  updateDataSpacePackageStatus,
} from './dataSpacePackageService.mjs'
import { withClient } from './dbUtils.mjs'
import {
  ensureEdcContractDefinition,
  ensureEdcHttpAsset,
  ensureEdcOpenPolicy,
  findEdcCatalogOffer,
  negotiateEdcContract,
  requestEdcCatalog,
  startEdcHttpPushTransfer,
  waitForEdcTransfer,
} from './euLdtDataSpaceReadyService.mjs'
import { resolveEuLdtIntegrationTarget } from './euLdtIntegrationService.mjs'

function textValue(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function boundedInteger(value, fallback, minimum = 1, maximum = 5000) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(minimum, Math.min(Math.floor(numeric), maximum))
}

function safeKey(value, fallback) {
  return textValue(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback
}

function normalizeRun(row = {}) {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    workflowKey: row.workflow_key,
    canonicalWorkflowKey: row.workflow_key,
    workflowName: row.workflow_name ?? null,
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

function normalizeStep(row = {}) {
  return {
    id: row.id,
    runId: row.run_id,
    stepKey: row.step_key,
    stepOrder: row.step_order,
    title: row.title,
    status: row.status,
    toolKind: row.tool_kind,
    input: row.input ?? {},
    output: row.output ?? {},
    error: row.error ?? {},
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeApproval(row = {}) {
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

function normalizeArtifact(row = {}) {
  return {
    id: row.id,
    runId: row.run_id,
    stepId: row.step_id,
    cityId: row.city_id,
    artifactKind: row.artifact_kind,
    artifactUri: row.artifact_uri,
    mediaType: row.media_type,
    byteSize: row.byte_size == null ? null : Number(row.byte_size),
    checksum: row.checksum,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
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
  if (!runResult.rowCount) return null
  const steps = await client.query('SELECT * FROM ldt_ops.workflow_steps WHERE run_id = $1 ORDER BY step_order, step_key', [runId])
  const approvals = await client.query('SELECT * FROM ldt_ops.workflow_approvals WHERE run_id = $1 ORDER BY created_at, approval_key', [runId])
  const artifacts = await client.query('SELECT * FROM ldt_ops.workflow_artifacts WHERE run_id = $1 ORDER BY created_at DESC', [runId])
  return {
    ...normalizeRun(runResult.rows[0]),
    steps: steps.rows.map(normalizeStep),
    approvals: approvals.rows.map(normalizeApproval),
    artifacts: artifacts.rows.map(normalizeArtifact),
  }
}

async function updateRun(client, runId, status, output = {}, error = {}) {
  const result = await client.query(
    `
      UPDATE ldt_ops.workflow_runs
      SET status = $2,
          output = COALESCE(output, '{}'::jsonb) || $3::jsonb,
          error = $4::jsonb,
          started_at = CASE WHEN $2 IN ('running', 'succeeded', 'failed') THEN COALESCE(started_at, now()) ELSE started_at END,
          finished_at = CASE WHEN $2 IN ('succeeded', 'failed') THEN now() ELSE finished_at END,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [runId, status, JSON.stringify(output ?? {}), JSON.stringify(error ?? {})],
  )
  if (!result.rowCount) throw new Error('WORKFLOW_RUN_NOT_FOUND')
  return result.rows[0]
}

async function updateStep(client, runId, stepKey, status, output = {}, error = {}) {
  const result = await client.query(
    `
      UPDATE ldt_ops.workflow_steps
      SET status = $3,
          output = COALESCE(output, '{}'::jsonb) || $4::jsonb,
          error = $5::jsonb,
          started_at = CASE WHEN $3 IN ('running', 'succeeded', 'failed') THEN COALESCE(started_at, now()) ELSE started_at END,
          finished_at = CASE WHEN $3 IN ('succeeded', 'failed') THEN now() ELSE finished_at END,
          updated_at = now()
      WHERE run_id = $1 AND step_key = $2
      RETURNING *
    `,
    [runId, stepKey, status, JSON.stringify(output ?? {}), JSON.stringify(error ?? {})],
  )
  if (!result.rowCount) throw new Error(`WORKFLOW_STEP_NOT_FOUND:${stepKey}`)
  return result.rows[0]
}

function workflowArtifactUri(runId, artifactKind) {
  return `ldt://workflow-runs/${runId}/${artifactKind}.json`
}

async function recordArtifact(client, { runId, stepId, cityId, artifactKind, metadata = {}, checksum = null, byteSize = null }) {
  const artifactUri = workflowArtifactUri(runId, artifactKind)
  const existing = await client.query(
    'SELECT * FROM ldt_ops.workflow_artifacts WHERE run_id = $1 AND artifact_uri = $2 LIMIT 1',
    [runId, artifactUri],
  )
  if (existing.rowCount) return existing.rows[0]
  const result = await client.query(
    `
      INSERT INTO ldt_ops.workflow_artifacts (
        run_id, step_id, city_id, artifact_kind, artifact_uri, media_type, byte_size, checksum, metadata
      )
      VALUES ($1, $2, $3, $4, $5, 'application/json', $6, $7, $8::jsonb)
      RETURNING *
    `,
    [runId, stepId, cityId, artifactKind, artifactUri, byteSize, checksum, JSON.stringify(metadata ?? {})],
  )
  return result.rows[0]
}

function stepMap(run) {
  return new Map((run?.steps ?? []).map((step) => [step.stepKey, step]))
}

function profileValue(profile = {}, key, fallback = '') {
  return textValue(profile.endpoints?.[key] ?? profile.metadata?.[key], fallback)
}

function participantId(target, fallback) {
  return textValue(target.profile?.metadata?.participantId ?? target.profile?.remoteCityId, fallback)
}

function packageAccessUrl(baseUrl, packageId, token) {
  const url = new URL(`/api/data-space/packages/${encodeURIComponent(packageId)}/content`, `${textValue(baseUrl).replace(/\/+$/, '')}/`)
  url.searchParams.set('token', token)
  return url.toString()
}

function transferReceiptUrl(baseUrl, receiptId, token) {
  const url = new URL(`/api/data-space/transfers/${encodeURIComponent(receiptId)}`, `${textValue(baseUrl).replace(/\/+$/, '')}/`)
  url.searchParams.set('token', token)
  return url.toString()
}

async function discoverOfferWithRetry({ target, dspUrl, providerId, assetId, timeoutMs }) {
  const deadline = Date.now() + boundedInteger(timeoutMs, 60000, 3000, 300000)
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const catalog = await requestEdcCatalog({
        endpoint: target.endpoint,
        headers: target.headers,
        counterPartyAddress: dspUrl,
        counterPartyId: providerId,
        timeoutMs: Math.min(timeoutMs, 15000),
      })
      return { catalog, offer: findEdcCatalogOffer(catalog, assetId) }
    } catch (error) {
      lastError = error
      if (!String(error?.message ?? '').startsWith('EDC_CATALOG_')) throw error
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
  throw lastError ?? new Error(`EDC_CATALOG_ASSET_NOT_FOUND:${assetId}`)
}

async function waitForReceipt(client, receiptId, timeoutMs) {
  const deadline = Date.now() + boundedInteger(timeoutMs, 60000, 3000, 300000)
  let receipt = null
  while (Date.now() < deadline) {
    receipt = await getDataSpaceTransferReceipt(client, receiptId)
    if (['verified', 'mismatch', 'failed'].includes(receipt?.status)) return receipt
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`DATA_SPACE_RECEIPT_TIMEOUT:${receipt?.status ?? 'missing'}`)
}

function exchangeResult(error, run = null, summary = null) {
  return {
    configured: true,
    ok: false,
    run,
    artifacts: [],
    summary,
    error: String(error?.message ?? error ?? 'EU_LDT_DATA_SPACE_EXCHANGE_FAILED'),
  }
}

function publicationResult(error, run = null, summary = null) {
  return {
    configured: true,
    ok: false,
    run,
    artifacts: [],
    summary,
    error: String(error?.message ?? error ?? 'EU_LDT_DATA_SPACE_PUBLICATION_FAILED'),
  }
}

function catalogExplorerUrl(frontendUrl, dspUrl, providerId) {
  if (!/^https?:\/\//i.test(frontendUrl)) return null
  const url = new URL('/catalog/explorer/list', `${frontendUrl.replace(/\/+$/, '')}/`)
  url.searchParams.set('participant-url', dspUrl)
  url.searchParams.set('participant-id', providerId)
  return url.toString()
}

export async function executeEuLdtDataSpaceQueryPublishOnce({
  runId,
  workerId = 'eu-ldt-data-space-publish-worker',
} = {}) {
  if (!runId) return publicationResult('WORKFLOW_RUN_ID_REQUIRED')

  return withClient(async (client) => {
    let activeStep = null
    let packageId = null
    let summary = null
    try {
      const initialRun = await workflowRunDetail(client, runId)
      if (!initialRun) throw new Error('WORKFLOW_RUN_NOT_FOUND')
      if (initialRun.workflowKey !== 'eu-ldt-data-space-publish') throw new Error('EU_LDT_DATA_SPACE_PUBLISH_WORKFLOW_RUN_REQUIRED')
      if (!['queued', 'running'].includes(initialRun.status)) throw new Error(`WORKFLOW_RUN_NOT_EXECUTABLE:${initialRun.status}`)

      const input = initialRun.input ?? {}
      const providerProfileKey = textValue(input.providerIntegrationProfileKey ?? input.provider_integration_profile_key)
      if (!providerProfileKey) throw new Error('DATA_SPACE_PROVIDER_PROFILE_REQUIRED')
      if (!input.query || typeof input.query !== 'object') throw new Error('DATA_SPACE_QUERY_REQUIRED')

      const provider = await resolveEuLdtIntegrationTarget(client, providerProfileKey, {
        platformKind: 'data-space-ready',
        endpointKey: 'managementUrl',
      })
      if (textValue(provider.profile?.capabilities?.role).toLowerCase() !== 'provider') throw new Error('DATA_SPACE_PROVIDER_PROFILE_ROLE_INVALID')

      const providerId = participantId(provider, 'provider-connector')
      const dspUrl = profileValue(provider.profile, 'dspUrl')
      const publicBaseUrl = profileValue(provider.profile, 'oldtPackageBaseUrl')
      const frontendUrl = profileValue(provider.profile, 'publicFrontendUrl', provider.profile.baseUrl)
      if (!/^https?:\/\//i.test(dspUrl)) throw new Error('DATA_SPACE_PROVIDER_DSP_URL_REQUIRED')
      if (!/^https?:\/\//i.test(publicBaseUrl)) throw new Error('DATA_SPACE_OLDT_PACKAGE_BASE_URL_REQUIRED')

      const format = textValue(input.format, 'geojson').toLowerCase()
      const limit = boundedInteger(input.limit, 500, 1, 5000)
      const timeoutMs = boundedInteger(input.timeoutMs ?? input.timeout_ms, 90000, 5000, 300000)
      const title = textValue(input.title, `${initialRun.cityId} OLDT query package`)
      const description = textValue(input.description, 'Bounded OLDT TwinQuery export published as a governed EDC offer.')
      const licence = textValue(input.licence ?? input.license, 'CC-BY-4.0')

      await updateRun(client, runId, 'running', {
        executor: workerId,
        providerIntegrationProfileKey: provider.profileKey,
        externalSystem: 'eu-ldt-data-space-ready-edc',
        exchangeMode: 'provider-publication-only',
      })
      const run = await workflowRunDetail(client, runId)
      const steps = stepMap(run)

      activeStep = 'prepare-run-context'
      await updateStep(client, runId, activeStep, 'succeeded', {
        cityId: run.cityId,
        workerId,
        providerIntegrationProfileKey: provider.profileKey,
        providerParticipantId: providerId,
        exchangeMode: 'provider-publication-only',
      })

      activeStep = 'validate-input-contract'
      await updateStep(client, runId, activeStep, 'succeeded', {
        format,
        limit,
        licence,
        providerManagementUrl: provider.endpoint,
        providerDspUrl: dspUrl,
        consumerRequired: false,
      })

      activeStep = 'export-twin-query-package'
      const exported = await exportCityTwinQuery(run.cityId, {
        query: input.query,
        format,
        limit,
        surface: 'data-space-publication',
        intent: 'governed-edc-publication',
      })
      if (!exported.ok) throw new Error(`DATA_SPACE_TWIN_QUERY_EXPORT_FAILED:${exported.error ?? 'unknown'}`)
      await updateStep(client, runId, activeStep, 'succeeded', {
        format: exported.format,
        fileName: exported.filename,
        mediaType: exported.contentType,
        rowCount: exported.rowCount,
        summary: exported.summary,
      })

      activeStep = 'persist-data-space-package'
      const initialManifest = {
        '@context': {
          dct: 'http://purl.org/dc/terms/',
          dcat: 'http://www.w3.org/ns/dcat#',
          prov: 'http://www.w3.org/ns/prov#',
          oldt: 'https://polisplexity.example/ns/oldt#',
        },
        '@type': 'dcat:Dataset',
        'dct:title': title,
        'dct:description': description,
        'dct:license': licence,
        'dct:format': exported.format,
        'prov:wasGeneratedBy': {
          '@type': 'prov:Activity',
          'oldt:workflowRunId': runId,
          'oldt:workflowKey': run.workflowKey,
        },
        'oldt:cityId': run.cityId,
        'oldt:rowCount': exported.rowCount,
        'oldt:query': exported.query,
        'oldt:summary': exported.summary,
        generatedAt: new Date().toISOString(),
      }
      const packageRecord = await createDataSpaceAssetPackage(client, {
        workflowRunId: runId,
        cityId: run.cityId,
        integrationProfileKey: provider.profileKey,
        packageKey: input.packageKey ?? `${safeKey(run.cityId, 'city')}-publish-${runId.slice(0, 12)}`,
        title,
        description,
        licence,
        format: exported.format,
        fileName: exported.filename,
        mediaType: exported.contentType,
        content: exported.body,
        sourceQuery: exported.query,
        manifest: initialManifest,
        createdBy: run.requestedBy,
      })
      packageId = packageRecord.package.id
      const packageManifest = {
        ...initialManifest,
        'oldt:packageId': packageId,
        'oldt:sha256': packageRecord.package.sha256,
        'oldt:byteSize': packageRecord.package.byteSize,
      }
      const packaged = await updateDataSpacePackageStatus(client, packageId, 'packaged', packageManifest)
      await updateStep(client, runId, activeStep, 'succeeded', {
        package: packaged,
        immutableChecksum: packaged.sha256,
      })

      const sourceUrl = packageAccessUrl(publicBaseUrl, packageId, packageRecord.accessToken)
      const assetStem = safeKey(
        `oldt-${run.cityId}-${packaged.sha256.slice(0, 16)}-${runId.slice(0, 8)}`,
        `oldt-${packaged.sha256.slice(0, 16)}-${runId.slice(0, 8)}`,
      )
      const assetId = assetStem
      const policyId = `${assetStem}-policy`
      const contractDefinitionId = `${assetStem}-contract`

      activeStep = 'register-edc-policy'
      const policy = await ensureEdcOpenPolicy({
        endpoint: provider.endpoint,
        headers: provider.headers,
        policyId,
        timeoutMs,
      })
      await updateStep(client, runId, activeStep, 'succeeded', policy)

      activeStep = 'register-edc-asset'
      const asset = await ensureEdcHttpAsset({
        endpoint: provider.endpoint,
        headers: provider.headers,
        assetId,
        name: title,
        description,
        sourceUrl,
        timeoutMs,
        properties: {
          contenttype: exported.contentType,
          licence,
          sha256: packaged.sha256,
          byteSize: String(packaged.byteSize),
          cityId: run.cityId,
          workflowRunId: runId,
          publicationMode: 'provider-only',
        },
      })
      await updateStep(client, runId, activeStep, 'succeeded', {
        assetId,
        created: asset.created,
        sourceEndpoint: 'OLDT capability URL',
      })

      activeStep = 'register-edc-contract-definition'
      const contractDefinition = await ensureEdcContractDefinition({
        endpoint: provider.endpoint,
        headers: provider.headers,
        contractDefinitionId,
        assetId,
        policyId,
        timeoutMs,
      })
      const publishedPackage = await updateDataSpacePackageStatus(client, packageId, 'published', {
        edc: { providerId, assetId, policyId, contractDefinitionId },
      })
      await updateStep(client, runId, activeStep, 'succeeded', contractDefinition)

      const explorerUrl = catalogExplorerUrl(frontendUrl, dspUrl, providerId)
      summary = {
        cityId: run.cityId,
        providerIntegrationProfileKey: provider.profileKey,
        providerParticipantId: providerId,
        providerDspUrl: dspUrl,
        dataSpaceReadyUrl: frontendUrl,
        catalogExplorerUrl: explorerUrl,
        packageId,
        packageKey: publishedPackage.packageKey,
        title,
        format: publishedPackage.format,
        rowCount: exported.rowCount,
        byteSize: publishedPackage.byteSize,
        sha256: publishedPackage.sha256,
        assetId,
        policyId,
        contractDefinitionId,
        consumerActionRequired: true,
        transferStarted: false,
        authorityStatus: 'operator-approved-external-publication',
        publicationStatus: 'edc-published',
      }

      activeStep = 'write-data-space-publication-artifacts'
      const artifactSpecs = [
        { kind: 'data-space-package', step: 'persist-data-space-package', metadata: { package: publishedPackage, manifest: packageManifest }, checksum: publishedPackage.sha256, byteSize: publishedPackage.byteSize },
        { kind: 'edc-policy', step: 'register-edc-policy', metadata: { policyId, created: policy.created } },
        { kind: 'edc-asset', step: 'register-edc-asset', metadata: { assetId, created: asset.created } },
        { kind: 'edc-contract-definition', step: 'register-edc-contract-definition', metadata: { contractDefinitionId, created: contractDefinition.created } },
        { kind: 'data-space-publication-summary', step: 'write-data-space-publication-artifacts', metadata: summary },
      ]
      const artifacts = []
      for (const spec of artifactSpecs) {
        artifacts.push(await recordArtifact(client, {
          runId,
          stepId: steps.get(spec.step)?.id ?? null,
          cityId: run.cityId,
          artifactKind: spec.kind,
          metadata: {
            workflowRunId: runId,
            workflowKey: run.workflowKey,
            providerIntegrationProfileKey: provider.profileKey,
            ...spec.metadata,
          },
          checksum: spec.checksum,
          byteSize: spec.byteSize,
        }))
      }
      await updateStep(client, runId, activeStep, 'succeeded', {
        artifactCount: artifacts.length,
        artifactKinds: artifacts.map((artifact) => artifact.artifact_kind),
        summary,
      })
      await updateRun(client, runId, 'succeeded', {
        executor: workerId,
        summary,
        artifacts: artifacts.map(normalizeArtifact),
      })
      return {
        configured: true,
        ok: true,
        run: await workflowRunDetail(client, runId),
        artifacts: artifacts.map(normalizeArtifact),
        summary,
        error: null,
      }
    } catch (error) {
      const message = String(error?.message ?? 'EU_LDT_DATA_SPACE_PUBLICATION_FAILED')
      if (activeStep) {
        try {
          await updateStep(client, runId, activeStep, 'failed', {}, { message })
        } catch {}
      }
      if (packageId) {
        try {
          await updateDataSpacePackageStatus(client, packageId, 'failed', {
            failure: { message, failedAt: new Date().toISOString(), stepKey: activeStep },
          })
        } catch {}
      }
      try {
        await updateRun(client, runId, 'failed', summary ? { summary } : {}, { message })
      } catch {}
      return publicationResult(error, await workflowRunDetail(client, runId), summary)
    }
  }).catch((error) => publicationResult(error))
}

export async function executeEuLdtDataSpaceQueryExchangeOnce({
  runId,
  workerId = 'eu-ldt-data-space-query-exchange-worker',
} = {}) {
  if (!runId) return exchangeResult('WORKFLOW_RUN_ID_REQUIRED')

  return withClient(async (client) => {
    let activeStep = null
    let packageId = null
    let transferVerified = false
    let summary = null
    try {
      const initialRun = await workflowRunDetail(client, runId)
      if (!initialRun) throw new Error('WORKFLOW_RUN_NOT_FOUND')
      if (initialRun.workflowKey !== 'eu-ldt-data-space-query-exchange') throw new Error('EU_LDT_DATA_SPACE_WORKFLOW_RUN_REQUIRED')
      if (!['queued', 'running'].includes(initialRun.status)) throw new Error(`WORKFLOW_RUN_NOT_EXECUTABLE:${initialRun.status}`)

      const input = initialRun.input ?? {}
      const providerProfileKey = textValue(input.providerIntegrationProfileKey ?? input.provider_integration_profile_key)
      const consumerProfileKey = textValue(input.consumerIntegrationProfileKey ?? input.consumer_integration_profile_key)
      if (!providerProfileKey || !consumerProfileKey) throw new Error('DATA_SPACE_PROVIDER_AND_CONSUMER_PROFILES_REQUIRED')
      if (!input.query || typeof input.query !== 'object') throw new Error('DATA_SPACE_QUERY_REQUIRED')

      const provider = await resolveEuLdtIntegrationTarget(client, providerProfileKey, {
        platformKind: 'data-space-ready',
        endpointKey: 'managementUrl',
      })
      const consumer = await resolveEuLdtIntegrationTarget(client, consumerProfileKey, {
        platformKind: 'data-space-ready',
        endpointKey: 'managementUrl',
      })
      if (textValue(provider.profile?.capabilities?.role).toLowerCase() !== 'provider') throw new Error('DATA_SPACE_PROVIDER_PROFILE_ROLE_INVALID')
      if (textValue(consumer.profile?.capabilities?.role).toLowerCase() !== 'consumer') throw new Error('DATA_SPACE_CONSUMER_PROFILE_ROLE_INVALID')

      const providerId = participantId(provider, 'provider-connector')
      const dspUrl = profileValue(provider.profile, 'dspUrl')
      const publicBaseUrl = profileValue(provider.profile, 'oldtPackageBaseUrl')
      if (!/^https?:\/\//i.test(dspUrl)) throw new Error('DATA_SPACE_PROVIDER_DSP_URL_REQUIRED')
      if (!/^https?:\/\//i.test(publicBaseUrl)) throw new Error('DATA_SPACE_OLDT_PACKAGE_BASE_URL_REQUIRED')
      const format = textValue(input.format, 'geojson').toLowerCase()
      const limit = boundedInteger(input.limit, 500, 1, 5000)
      const timeoutMs = boundedInteger(input.timeoutMs ?? input.timeout_ms, 90000, 5000, 300000)
      const title = textValue(input.title, `${initialRun.cityId} OLDT query package`)
      const description = textValue(input.description, 'Bounded OLDT TwinQuery export for governed EDC exchange.')
      const licence = textValue(input.licence ?? input.license, 'CC-BY-4.0')

      await updateRun(client, runId, 'running', {
        executor: workerId,
        providerIntegrationProfileKey: provider.profileKey,
        consumerIntegrationProfileKey: consumer.profileKey,
        externalSystem: 'eu-ldt-data-space-ready-edc',
      })
      const run = await workflowRunDetail(client, runId)
      const steps = stepMap(run)

      activeStep = 'prepare-run-context'
      await updateStep(client, runId, activeStep, 'succeeded', {
        cityId: run.cityId,
        workerId,
        providerIntegrationProfileKey: provider.profileKey,
        consumerIntegrationProfileKey: consumer.profileKey,
        providerParticipantId: providerId,
      })

      activeStep = 'validate-input-contract'
      await updateStep(client, runId, activeStep, 'succeeded', {
        format,
        limit,
        licence,
        providerManagementUrl: provider.endpoint,
        consumerManagementUrl: consumer.endpoint,
        providerDspUrl: dspUrl,
      })

      activeStep = 'export-twin-query-package'
      const exported = await exportCityTwinQuery(run.cityId, {
        query: input.query,
        format,
        limit,
        surface: 'data-space-exchange',
        intent: 'governed-edc-export',
      })
      if (!exported.ok) throw new Error(`DATA_SPACE_TWIN_QUERY_EXPORT_FAILED:${exported.error ?? 'unknown'}`)
      await updateStep(client, runId, activeStep, 'succeeded', {
        format: exported.format,
        fileName: exported.filename,
        mediaType: exported.contentType,
        rowCount: exported.rowCount,
        summary: exported.summary,
      })

      activeStep = 'persist-data-space-package'
      const initialManifest = {
        '@context': {
          dct: 'http://purl.org/dc/terms/',
          dcat: 'http://www.w3.org/ns/dcat#',
          prov: 'http://www.w3.org/ns/prov#',
          oldt: 'https://polisplexity.example/ns/oldt#',
        },
        '@type': 'dcat:Dataset',
        'dct:title': title,
        'dct:description': description,
        'dct:license': licence,
        'dct:format': exported.format,
        'prov:wasGeneratedBy': {
          '@type': 'prov:Activity',
          'oldt:workflowRunId': runId,
          'oldt:workflowKey': run.workflowKey,
        },
        'oldt:cityId': run.cityId,
        'oldt:rowCount': exported.rowCount,
        'oldt:query': exported.query,
        'oldt:summary': exported.summary,
        generatedAt: new Date().toISOString(),
      }
      const packageRecord = await createDataSpaceAssetPackage(client, {
        workflowRunId: runId,
        cityId: run.cityId,
        integrationProfileKey: provider.profileKey,
        packageKey: input.packageKey ?? `${safeKey(run.cityId, 'city')}-query-${runId.slice(0, 12)}`,
        title,
        description,
        licence,
        format: exported.format,
        fileName: exported.filename,
        mediaType: exported.contentType,
        content: exported.body,
        sourceQuery: exported.query,
        manifest: initialManifest,
        createdBy: run.requestedBy,
      })
      packageId = packageRecord.package.id
      const packageManifest = {
        ...initialManifest,
        'oldt:packageId': packageId,
        'oldt:sha256': packageRecord.package.sha256,
        'oldt:byteSize': packageRecord.package.byteSize,
      }
      const packagePublic = await updateDataSpacePackageStatus(client, packageId, 'packaged', packageManifest)
      await updateStep(client, runId, activeStep, 'succeeded', {
        package: packagePublic,
        immutableChecksum: packagePublic.sha256,
      })

      const sourceUrl = packageAccessUrl(publicBaseUrl, packageId, packageRecord.accessToken)
      const receiptRecord = await createDataSpaceTransferReceipt(client, { packageId, workflowRunId: runId })
      const receiptUrl = transferReceiptUrl(publicBaseUrl, receiptRecord.receipt.id, receiptRecord.receiptToken)
      const assetStem = safeKey(`oldt-${run.cityId}-${packagePublic.sha256.slice(0, 16)}`, `oldt-${packagePublic.sha256.slice(0, 16)}`)
      const assetId = assetStem
      const policyId = `${assetStem}-policy`
      const contractDefinitionId = `${assetStem}-contract`

      activeStep = 'register-edc-policy'
      const policy = await ensureEdcOpenPolicy({
        endpoint: provider.endpoint,
        headers: provider.headers,
        policyId,
        timeoutMs,
      })
      await updateStep(client, runId, activeStep, 'succeeded', policy)

      activeStep = 'register-edc-asset'
      const asset = await ensureEdcHttpAsset({
        endpoint: provider.endpoint,
        headers: provider.headers,
        assetId,
        name: title,
        description,
        sourceUrl,
        timeoutMs,
        properties: {
          contenttype: exported.contentType,
          licence,
          sha256: packagePublic.sha256,
          byteSize: String(packagePublic.byteSize),
          cityId: run.cityId,
          workflowRunId: runId,
        },
      })
      await updateStep(client, runId, activeStep, 'succeeded', {
        assetId,
        created: asset.created,
        sourceEndpoint: 'OLDT capability URL',
      })

      activeStep = 'register-edc-contract-definition'
      const contractDefinition = await ensureEdcContractDefinition({
        endpoint: provider.endpoint,
        headers: provider.headers,
        contractDefinitionId,
        assetId,
        policyId,
        timeoutMs,
      })
      await updateDataSpacePackageStatus(client, packageId, 'published', {
        edc: { providerId, assetId, policyId, contractDefinitionId },
      })
      await updateStep(client, runId, activeStep, 'succeeded', contractDefinition)

      activeStep = 'discover-edc-offer'
      const discovered = await discoverOfferWithRetry({
        target: consumer,
        dspUrl,
        providerId,
        assetId,
        timeoutMs,
      })
      await updateStep(client, runId, activeStep, 'succeeded', {
        assetId,
        offerId: discovered.offer.offerId,
        datasetCount: Array.isArray(discovered.catalog?.['dcat:dataset'])
          ? discovered.catalog['dcat:dataset'].length
          : discovered.catalog?.['dcat:dataset'] ? 1 : 0,
      })

      activeStep = 'negotiate-edc-contract'
      const negotiation = await negotiateEdcContract({
        endpoint: consumer.endpoint,
        headers: consumer.headers,
        counterPartyAddress: dspUrl,
        counterPartyId: providerId,
        offerId: discovered.offer.offerId,
        assetId,
        timeoutMs,
      })
      await updateDataSpacePackageStatus(client, packageId, 'contracted', {
        edc: {
          providerId,
          assetId,
          policyId,
          contractDefinitionId,
          offerId: discovered.offer.offerId,
          negotiationId: negotiation.negotiationId,
          agreementId: negotiation.agreementId,
        },
      })
      await updateStep(client, runId, activeStep, 'succeeded', {
        negotiationId: negotiation.negotiationId,
        agreementId: negotiation.agreementId,
        state: negotiation.state,
      })

      activeStep = 'transfer-edc-package'
      const transfer = await startEdcHttpPushTransfer({
        endpoint: consumer.endpoint,
        headers: consumer.headers,
        counterPartyAddress: dspUrl,
        agreementId: negotiation.agreementId,
        destinationUrl: receiptUrl,
        timeoutMs,
      })
      const completedTransfer = await waitForEdcTransfer({
        endpoint: consumer.endpoint,
        headers: consumer.headers,
        transferId: transfer.transferId,
        timeoutMs,
      })
      await updateStep(client, runId, activeStep, 'succeeded', {
        transferId: transfer.transferId,
        state: completedTransfer.state,
        destination: 'OLDT controlled receipt endpoint',
      })

      activeStep = 'verify-transfer-receipt'
      const receipt = await waitForReceipt(client, receiptRecord.receipt.id, timeoutMs)
      if (receipt.status !== 'verified') throw new Error(`DATA_SPACE_TRANSFER_INTEGRITY_FAILED:${receipt.status}`)
      if (receipt.sha256 !== packagePublic.sha256 || receipt.byteSize !== packagePublic.byteSize) {
        throw new Error('DATA_SPACE_TRANSFER_RECEIPT_MISMATCH')
      }
      await updateDataSpacePackageStatus(client, packageId, 'transferred', {
        edc: {
          providerId,
          assetId,
          policyId,
          contractDefinitionId,
          offerId: discovered.offer.offerId,
          negotiationId: negotiation.negotiationId,
          agreementId: negotiation.agreementId,
          transferId: transfer.transferId,
          transferState: completedTransfer.state,
        },
        receipt: {
          id: receipt.id,
          status: receipt.status,
          sha256: receipt.sha256,
          byteSize: receipt.byteSize,
          receivedAt: receipt.receivedAt,
        },
      })
      transferVerified = true
      await updateStep(client, runId, activeStep, 'succeeded', {
        receipt,
        checksumMatch: true,
        byteSizeMatch: true,
      })

      summary = {
        cityId: run.cityId,
        providerIntegrationProfileKey: provider.profileKey,
        consumerIntegrationProfileKey: consumer.profileKey,
        dataSpaceReadyUrl: profileValue(provider.profile, 'publicFrontendUrl', provider.profile.baseUrl),
        packageId,
        packageKey: packagePublic.packageKey,
        title,
        format: packagePublic.format,
        rowCount: exported.rowCount,
        byteSize: packagePublic.byteSize,
        sha256: packagePublic.sha256,
        assetId,
        policyId,
        contractDefinitionId,
        offerId: discovered.offer.offerId,
        negotiationId: negotiation.negotiationId,
        agreementId: negotiation.agreementId,
        transferId: transfer.transferId,
        transferState: completedTransfer.state,
        receiptId: receipt.id,
        receiptStatus: receipt.status,
        checksumVerified: true,
        authorityStatus: 'operator-approved-external-exchange',
        publicationStatus: 'edc-contracted-and-transferred',
      }

      activeStep = 'write-data-space-artifacts'
      const artifactSpecs = [
        { kind: 'data-space-package', step: 'persist-data-space-package', metadata: { package: packagePublic, manifest: packageManifest }, checksum: packagePublic.sha256, byteSize: packagePublic.byteSize },
        { kind: 'edc-policy', step: 'register-edc-policy', metadata: { policyId, created: policy.created } },
        { kind: 'edc-asset', step: 'register-edc-asset', metadata: { assetId, created: asset.created } },
        { kind: 'edc-contract-definition', step: 'register-edc-contract-definition', metadata: { contractDefinitionId, created: contractDefinition.created } },
        { kind: 'edc-catalog-offer', step: 'discover-edc-offer', metadata: { assetId, offerId: discovered.offer.offerId } },
        { kind: 'edc-contract-agreement', step: 'negotiate-edc-contract', metadata: { negotiationId: negotiation.negotiationId, agreementId: negotiation.agreementId } },
        { kind: 'edc-transfer', step: 'transfer-edc-package', metadata: { transferId: transfer.transferId, state: completedTransfer.state } },
        { kind: 'data-space-transfer-receipt', step: 'verify-transfer-receipt', metadata: { receipt, checksumVerified: true }, checksum: receipt.sha256, byteSize: receipt.byteSize },
        { kind: 'data-space-exchange-summary', step: 'write-data-space-artifacts', metadata: summary },
      ]
      const artifacts = []
      for (const spec of artifactSpecs) {
        artifacts.push(await recordArtifact(client, {
          runId,
          stepId: steps.get(spec.step)?.id ?? null,
          cityId: run.cityId,
          artifactKind: spec.kind,
          metadata: {
            workflowRunId: runId,
            workflowKey: run.workflowKey,
            providerIntegrationProfileKey: provider.profileKey,
            consumerIntegrationProfileKey: consumer.profileKey,
            ...spec.metadata,
          },
          checksum: spec.checksum,
          byteSize: spec.byteSize,
        }))
      }
      await updateStep(client, runId, activeStep, 'succeeded', {
        artifactCount: artifacts.length,
        artifactKinds: artifacts.map((artifact) => artifact.artifact_kind),
        summary,
      })
      await updateRun(client, runId, 'succeeded', {
        executor: workerId,
        summary,
        artifacts: artifacts.map(normalizeArtifact),
      })
      return {
        configured: true,
        ok: true,
        run: await workflowRunDetail(client, runId),
        artifacts: artifacts.map(normalizeArtifact),
        summary,
        error: null,
      }
    } catch (error) {
      const message = String(error?.message ?? 'EU_LDT_DATA_SPACE_EXCHANGE_FAILED')
      if (activeStep) {
        try {
          await updateStep(client, runId, activeStep, 'failed', {}, { message })
        } catch {}
      }
      if (packageId && !transferVerified) {
        try {
          await updateDataSpacePackageStatus(client, packageId, 'failed', {
            failure: { message, failedAt: new Date().toISOString(), stepKey: activeStep },
          })
        } catch {}
      }
      try {
        await updateRun(client, runId, 'failed', summary ? { summary } : {}, { message })
      } catch {}
      return exchangeResult(error, await workflowRunDetail(client, runId), summary)
    }
  }).catch((error) => exchangeResult(error))
}
