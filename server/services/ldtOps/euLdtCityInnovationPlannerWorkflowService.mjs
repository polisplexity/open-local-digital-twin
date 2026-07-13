import { withClient } from './dbUtils.mjs'
import {
  buildCipMetricSourceEntity,
  ensureCipBrokerDatasource,
  fetchCipCollection,
  publishCipMetricSourceToDataPlatform,
  requestCipKpiCalculation,
  resolveCipTarget,
  resolveSelectionMetric,
  storeCipInitiativeLinks,
  storeCipMeasurementReceipts,
  upsertCipMetricBinding,
} from './euLdtCityInnovationPlannerService.mjs'
import { resolveEuLdtIntegrationTarget } from './euLdtIntegrationService.mjs'

function textValue(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function normalizedKey(value, fallback = 'cip-metric') {
  const normalized = textValue(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{1,128}$/.test(normalized)) throw new Error('CIP_BINDING_KEY_INVALID')
  return normalized
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
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

async function workflowRunDetail(client, runId) {
  const runResult = await client.query(`
    SELECT run.*, definition.name AS workflow_name
    FROM ldt_ops.workflow_runs run
    LEFT JOIN ldt_ops.workflow_definitions definition ON definition.id = run.workflow_id
    WHERE run.id = $1
  `, [runId])
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
  const result = await client.query(`
    UPDATE ldt_ops.workflow_runs
    SET status = $2,
        output = COALESCE(output, '{}'::jsonb) || $3::jsonb,
        error = $4::jsonb,
        started_at = CASE WHEN $2 IN ('running', 'succeeded', 'failed') THEN COALESCE(started_at, now()) ELSE started_at END,
        finished_at = CASE WHEN $2 IN ('succeeded', 'failed') THEN now() ELSE finished_at END,
        updated_at = now()
    WHERE id = $1
    RETURNING *
  `, [runId, status, JSON.stringify(output ?? {}), JSON.stringify(error ?? {})])
  if (!result.rowCount) throw new Error('WORKFLOW_RUN_NOT_FOUND')
  return result.rows[0]
}

async function updateStep(client, runId, stepKey, status, output = {}, error = {}) {
  const result = await client.query(`
    UPDATE ldt_ops.workflow_steps
    SET status = $3,
        output = COALESCE(output, '{}'::jsonb) || $4::jsonb,
        error = $5::jsonb,
        started_at = CASE WHEN $3 IN ('running', 'succeeded', 'failed') THEN COALESCE(started_at, now()) ELSE started_at END,
        finished_at = CASE WHEN $3 IN ('succeeded', 'failed') THEN now() ELSE finished_at END,
        updated_at = now()
    WHERE run_id = $1 AND step_key = $2
    RETURNING *
  `, [runId, stepKey, status, JSON.stringify(output ?? {}), JSON.stringify(error ?? {})])
  if (!result.rowCount) throw new Error(`WORKFLOW_STEP_NOT_FOUND:${stepKey}`)
  return result.rows[0]
}

function artifactUri(runId, kind) {
  return `ldt://workflow-runs/${runId}/${kind}.json`
}

async function recordArtifact(client, { runId, stepId, cityId, kind, metadata = {} }) {
  const uri = artifactUri(runId, kind)
  const existing = await client.query(
    'SELECT * FROM ldt_ops.workflow_artifacts WHERE run_id = $1 AND artifact_uri = $2 LIMIT 1',
    [runId, uri],
  )
  if (existing.rowCount) return existing.rows[0]
  const result = await client.query(`
    INSERT INTO ldt_ops.workflow_artifacts (
      run_id, step_id, city_id, artifact_kind, artifact_uri, media_type, metadata
    )
    VALUES ($1, $2, $3, $4, $5, 'application/json', $6::jsonb)
    RETURNING *
  `, [runId, stepId, cityId, kind, uri, JSON.stringify(metadata ?? {})])
  return result.rows[0]
}

function stepMap(run) {
  return new Map((run?.steps ?? []).map((step) => [step.stepKey, step]))
}

async function failRun(client, runId, error, fallback) {
  const message = String(error?.message ?? fallback)
  try {
    await updateRun(client, runId, 'failed', {}, { message })
    return await workflowRunDetail(client, runId)
  } catch {
    return null
  }
}

function failureResult(error, run = null, fallback = 'EU_LDT_CIP_WORKFLOW_FAILED') {
  return {
    configured: true,
    ok: false,
    run,
    artifacts: [],
    summary: null,
    error: String(error?.message ?? error ?? fallback),
  }
}

function assertRunnable(run, workflowKey) {
  if (!run) throw new Error('WORKFLOW_RUN_NOT_FOUND')
  if (run.workflowKey !== workflowKey) throw new Error(`CIP_WORKFLOW_RUN_REQUIRED:${workflowKey}`)
  if (!['queued', 'running'].includes(run.status)) throw new Error(`WORKFLOW_RUN_NOT_EXECUTABLE:${run.status}`)
}

export async function executeEuLdtCipPublishMetricSourceOnce({ runId, workerId = 'eu-ldt-cip-metric-publisher' } = {}) {
  if (!runId) return failureResult('WORKFLOW_RUN_ID_REQUIRED')
  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const initialRun = await workflowRunDetail(client, runId)
      assertRunnable(initialRun, 'eu-ldt-cip-publish-metric-source')
      const input = initialRun.input ?? {}
      const cipProfileKey = textValue(input.cipProfileKey ?? input.cip_profile_key)
      const dataPlatformProfileKey = textValue(input.dataPlatformProfileKey ?? input.data_platform_profile_key)
      if (!cipProfileKey || !dataPlatformProfileKey) throw new Error('CIP_AND_DATA_PLATFORM_PROFILES_REQUIRED')
      const cipTarget = await resolveCipTarget(client, cipProfileKey)
      const dataPlatformTarget = await resolveEuLdtIntegrationTarget(client, dataPlatformProfileKey, {
        platformKind: 'data-platform',
        endpointKey: 'backendApiUrl',
      })
      const selectionSetId = textValue(input.selectionSetId ?? input.selection_set_id)
      const bindingKey = normalizedKey(
        input.bindingKey ?? input.binding_key,
        selectionSetId ? `cip-${selectionSetId}` : `cip-${Date.now()}`,
      )
      const cityKey = normalizedKey(initialRun.cityId, 'city')
      const ngsiEntityId = textValue(
        input.ngsiEntityId ?? input.ngsi_entity_id,
        `urn:ngsi-ld:KeyPerformanceIndicatorSource:${cityKey}:${bindingKey}`,
      )
      const ngsiEntityType = textValue(input.ngsiEntityType ?? input.ngsi_entity_type, 'KeyPerformanceIndicatorSource')
      const ngsiProperty = textValue(input.ngsiProperty ?? input.ngsi_property, 'observedValue')
      const formulaParameter = textValue(input.formulaParameter ?? input.formula_parameter, 'OldtValue')
      const ngsiScope = textValue(input.ngsiScope ?? input.ngsi_scope ?? input.scope)
      const indicatorKey = textValue(input.indicatorKey ?? input.indicator_key)
      const indicatorExternalCode = textValue(
        input.indicatorExternalCode ?? input.indicator_external_code ?? input.kpiU4SSCCode ?? input.kpi_u4ssc_code,
      )
      const indicatorCatalogKey = textValue(input.indicatorCatalogKey ?? input.indicator_catalog_key)
      const indicatorValueKind = textValue(input.indicatorValueKind ?? input.indicator_value_kind, 'numeric')

      await updateRun(client, runId, 'running', {
        executor: workerId,
        cipProfileKey: cipTarget.profileKey,
        dataPlatformProfileKey: dataPlatformTarget.profileKey,
        bindingKey,
      })
      const run = await workflowRunDetail(client, runId)
      const steps = stepMap(run)
      await updateStep(client, runId, 'prepare-run-context', 'succeeded', {
        cityId: run.cityId,
        workerId,
        cipProfileKey: cipTarget.profileKey,
        dataPlatformProfileKey: dataPlatformTarget.profileKey,
      })
      await updateStep(client, runId, 'validate-input-contract', 'succeeded', {
        selectionSetId: selectionSetId || null,
        bindingKey,
        ngsiEntityId,
        ngsiEntityType,
        ngsiProperty,
        cipKpiId: textValue(input.cipKpiId ?? input.cip_kpi_id) || null,
        indicatorKey: indicatorKey || null,
        indicatorExternalCode: indicatorExternalCode || null,
        indicatorCatalogKey: indicatorCatalogKey || null,
      })

      const metric = await resolveSelectionMetric(client, {
        cityId: run.cityId,
        selectionSetId,
        value: input.value,
        metricKey: input.metricKey ?? input.metric_key,
        attributeKey: input.attributeKey ?? input.attribute_key,
        aggregation: input.aggregation,
      })
      await updateStep(client, runId, 'resolve-oldt-metric-source', 'succeeded', {
        value: metric.value,
        aggregation: metric.aggregation,
        sampleSize: metric.sampleSize,
        source: metric.source,
        selectionSetId: metric.selection?.id ?? null,
        queryHash: metric.selection?.query_hash ?? null,
      })

      const entity = buildCipMetricSourceEntity({
        ...metric,
        cityId: run.cityId,
        bindingKey,
        ngsiEntityId,
        ngsiEntityType,
        ngsiProperty,
        unit: input.unit ?? metric.metric?.unit,
        observedAt: input.observedAt ?? input.observed_at,
        indicatorKey,
        indicatorExternalCode,
        indicatorCatalogKey,
        indicatorValueKind,
      })
      await updateStep(client, runId, 'build-cip-ngsi-ld-source', 'succeeded', {
        id: entity.id,
        type: entity.type,
        property: ngsiProperty,
        value: metric.value,
      })

      const publication = await publishCipMetricSourceToDataPlatform(dataPlatformTarget, entity, { scope: ngsiScope })
      const readbackValue = Number(publication.entity?.[ngsiProperty]?.value)
      if (!Number.isFinite(readbackValue) || readbackValue !== Number(metric.value)) {
        throw new Error('CIP_DATA_PLATFORM_READBACK_VALUE_MISMATCH')
      }
      await updateStep(client, runId, 'publish-cip-source-to-data-platform', 'succeeded', {
        entityId: publication.entityId,
        created: publication.created,
        updated: publication.updated,
        readbackStatus: publication.status,
        readbackValue,
      })

      const cipBinding = await ensureCipBrokerDatasource(cipTarget, {
        cipKpiId: input.cipKpiId ?? input.cip_kpi_id,
        createKpi: input.createKpi !== false && input.create_kpi !== false,
        kpiName: input.kpiName ?? input.kpi_name ?? `OLDT ${bindingKey}`,
        kpiDescription: input.kpiDescription ?? input.kpi_description,
        kpiStatus: input.kpiStatus ?? input.kpi_status,
        kpiType: input.kpiType ?? input.kpi_type,
        frequency: input.frequency,
        calculationFormula: input.calculationFormula ?? input.calculation_formula,
        datasourceName: input.datasourceName ?? input.datasource_name,
        ngsiEntityId,
        ngsiEntityType,
        ngsiScope,
        ngsiProperty,
        formulaParameter,
        resultJsonPath: input.resultJsonPath ?? input.result_json_path,
        unit: input.unit ?? metric.metric?.unit,
        u4sscStandard: input.u4sscStandard === true || input.u4ssc_standard === true,
        kpiU4SSCCode: input.kpiU4SSCCode ?? input.kpi_u4ssc_code ?? indicatorExternalCode,
        reuseKpiLookup: input.reuseKpiLookup !== false && input.reuse_kpi_lookup !== false,
      })
      await updateStep(client, runId, 'bind-cip-kpi-datasource', 'succeeded', cipBinding)

      let calculation = { requested: false }
      if (input.requestCalculation === true || input.request_calculation === true) {
        calculation = {
          requested: true,
          response: await requestCipKpiCalculation(cipTarget, cipBinding.kpiId),
        }
      }
      await updateStep(client, runId, 'request-cip-calculation', 'succeeded', calculation)

      const bindingRow = await upsertCipMetricBinding(client, {
        cityId: run.cityId,
        cipProfileKey: cipTarget.profileKey,
        dataPlatformProfileKey: dataPlatformTarget.profileKey,
        selectionSetId: metric.selection?.id ?? '',
        cipKpiId: cipBinding.kpiId,
        cipDatasourceId: cipBinding.datasourceId,
        bindingKey,
        kpiName: cipBinding.kpiName,
        formulaParameter,
        resultJsonPath: input.resultJsonPath ?? input.result_json_path ?? `$.${ngsiProperty}.value`,
        ngsiEntityId,
        ngsiEntityType,
        ngsiScope,
        ngsiProperty,
        aggregation: metric.aggregation,
        metricKey: input.metricKey ?? input.metric_key,
        attributeKey: input.attributeKey ?? input.attribute_key,
        unit: input.unit ?? metric.metric?.unit,
        lastPublishedValue: metric.value,
        lastPublishedAt: new Date().toISOString(),
        lastVerifiedAt: new Date().toISOString(),
        sourceWorkflowRunId: runId,
        metadata: {
          source: metric.source,
          sampleSize: metric.sampleSize,
          queryHash: metric.selection?.query_hash ?? null,
          calculationRequested: calculation.requested,
          bindingKey,
          indicatorKey,
          indicatorExternalCode,
          indicatorCatalogKey,
          indicatorValueKind,
          u4sscStandard: cipBinding.u4sscStandard,
          kpiU4SSCCode: cipBinding.kpiU4SSCCode,
        },
      })
      await updateStep(client, runId, 'store-cip-metric-binding', 'succeeded', {
        bindingId: bindingRow.id,
        bindingKey: bindingRow.binding_key,
        cipKpiId: bindingRow.cip_kpi_id,
        cipDatasourceId: bindingRow.cip_datasource_id,
      })

      const summary = {
        cityId: run.cityId,
        bindingId: bindingRow.id,
        bindingKey,
        value: metric.value,
        unit: textValue(input.unit ?? metric.metric?.unit),
        aggregation: metric.aggregation,
        sampleSize: metric.sampleSize,
        selectionSetId: metric.selection?.id ?? null,
        dataPlatformProfileKey: dataPlatformTarget.profileKey,
        ngsiEntityId,
        ngsiProperty,
        cipProfileKey: cipTarget.profileKey,
        cipKpiId: cipBinding.kpiId,
        cipDatasourceId: cipBinding.datasourceId,
        createdKpi: cipBinding.createdKpi,
        reusedKpi: cipBinding.reusedKpi,
        createdDatasource: cipBinding.createdDatasource,
        u4sscStandard: cipBinding.u4sscStandard,
        kpiU4SSCCode: cipBinding.kpiU4SSCCode,
        indicatorKey: indicatorKey || null,
        indicatorExternalCode: indicatorExternalCode || null,
        calculationRequested: calculation.requested,
      }
      const artifacts = []
      const specs = [
        ['cip-metric-source', 'resolve-oldt-metric-source', { metric, selection: metric.selection }],
        ['cip-ngsi-ld-publication', 'publish-cip-source-to-data-platform', { entity, readback: publication.entity }],
        ['cip-kpi-binding', 'bind-cip-kpi-datasource', { cipBinding, binding: bindingRow }],
        ['cip-metric-publication-summary', 'write-cip-metric-artifacts', summary],
      ]
      for (const [kind, stepKey, metadata] of specs) {
        artifacts.push(await recordArtifact(client, {
          runId,
          stepId: steps.get(stepKey)?.id ?? steps.get('write-cip-metric-artifacts')?.id ?? null,
          cityId: run.cityId,
          kind,
          metadata,
        }))
      }
      await updateStep(client, runId, 'write-cip-metric-artifacts', 'succeeded', {
        artifactCount: artifacts.length,
        summary,
      })
      await updateRun(client, runId, 'succeeded', { executor: workerId, summary })
      await client.query('COMMIT')
      return {
        configured: true,
        ok: true,
        run: await workflowRunDetail(client, runId),
        artifacts: artifacts.map(normalizeArtifact),
        summary,
        error: null,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      const run = await failRun(client, runId, error, 'EU_LDT_CIP_METRIC_PUBLICATION_FAILED')
      return failureResult(error, run, 'EU_LDT_CIP_METRIC_PUBLICATION_FAILED')
    }
  })
}

export async function executeEuLdtCipSyncMeasurementsOnce({ runId, workerId = 'eu-ldt-cip-measurement-sync' } = {}) {
  if (!runId) return failureResult('WORKFLOW_RUN_ID_REQUIRED')
  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const initialRun = await workflowRunDetail(client, runId)
      assertRunnable(initialRun, 'eu-ldt-cip-sync-measurements')
      const input = initialRun.input ?? {}
      const target = await resolveCipTarget(client, input.cipProfileKey ?? input.cip_profile_key)
      await updateRun(client, runId, 'running', { executor: workerId, cipProfileKey: target.profileKey })
      const run = await workflowRunDetail(client, runId)
      const steps = stepMap(run)
      await updateStep(client, runId, 'prepare-run-context', 'succeeded', {
        cityId: run.cityId,
        workerId,
        cipProfileKey: target.profileKey,
      })
      await updateStep(client, runId, 'validate-input-contract', 'succeeded', {
        includeUnbound: input.includeUnbound === true || input.include_unbound === true,
        requestedKpiIds: input.kpiIds ?? input.kpi_ids ?? [],
      })

      const [remoteMeasurements, remoteKpis] = await Promise.all([
        fetchCipCollection(target, 'kpi-measurements', input),
        fetchCipCollection(target, 'kpis', input),
      ])
      await updateStep(client, runId, 'read-cip-measurements', 'succeeded', {
        measurementCount: remoteMeasurements.content.length,
        kpiCount: remoteKpis.content.length,
        measurementMetadata: remoteMeasurements.metadata,
      })

      const bindingResult = await client.query(`
        SELECT cip_kpi_id FROM ldt_interop.cip_metric_bindings
        WHERE city_id = $1 AND cip_profile_key = $2 AND status = 'active'
      `, [run.cityId, target.profileKey])
      const boundKpiIds = new Set(bindingResult.rows.map((row) => textValue(row.cip_kpi_id)))
      const requestedKpiIds = new Set((Array.isArray(input.kpiIds ?? input.kpi_ids) ? input.kpiIds ?? input.kpi_ids : [])
        .map(textValue).filter(Boolean))
      const includeUnbound = input.includeUnbound === true || input.include_unbound === true
      const selectedMeasurements = remoteMeasurements.content.filter((measurement) => {
        const kpiId = textValue(measurement?.kpiId)
        if (requestedKpiIds.size) return requestedKpiIds.has(kpiId)
        return includeUnbound || boundKpiIds.has(kpiId)
      })
      const kpiMap = new Map(remoteKpis.content.map((kpi) => [textValue(kpi?.id), kpi]))
      await updateStep(client, runId, 'reconcile-cip-measurements', 'succeeded', {
        boundKpiCount: boundKpiIds.size,
        requestedKpiCount: requestedKpiIds.size,
        selectedMeasurementCount: selectedMeasurements.length,
        ignoredMeasurementCount: remoteMeasurements.content.length - selectedMeasurements.length,
      })

      const stored = await storeCipMeasurementReceipts(client, {
        cityId: run.cityId,
        cipProfileKey: target.profileKey,
        sourceWorkflowRunId: runId,
        measurements: selectedMeasurements,
        kpiMap,
        includeUnbound,
      })
      await updateStep(client, runId, 'store-cip-measurement-receipts', 'succeeded', {
        inserted: stored.inserted,
        updated: stored.updated,
        bound: stored.bound,
      })

      const summary = {
        cityId: run.cityId,
        cipProfileKey: target.profileKey,
        remoteMeasurementCount: remoteMeasurements.content.length,
        selectedMeasurementCount: selectedMeasurements.length,
        inserted: stored.inserted,
        updated: stored.updated,
        bound: stored.bound,
      }
      const artifacts = []
      for (const [kind, stepKey, metadata] of [
        ['cip-measurement-readback', 'read-cip-measurements', { measurements: selectedMeasurements, kpis: remoteKpis.content }],
        ['cip-measurement-reconciliation', 'reconcile-cip-measurements', { boundKpiIds: [...boundKpiIds], requestedKpiIds: [...requestedKpiIds] }],
        ['cip-measurement-sync-summary', 'write-cip-measurement-artifacts', summary],
      ]) {
        artifacts.push(await recordArtifact(client, {
          runId,
          stepId: steps.get(stepKey)?.id ?? steps.get('write-cip-measurement-artifacts')?.id ?? null,
          cityId: run.cityId,
          kind,
          metadata,
        }))
      }
      await updateStep(client, runId, 'write-cip-measurement-artifacts', 'succeeded', { artifactCount: artifacts.length, summary })
      await updateRun(client, runId, 'succeeded', { executor: workerId, summary })
      await client.query('COMMIT')
      return { configured: true, ok: true, run: await workflowRunDetail(client, runId), artifacts: artifacts.map(normalizeArtifact), summary, error: null }
    } catch (error) {
      await client.query('ROLLBACK')
      const run = await failRun(client, runId, error, 'EU_LDT_CIP_MEASUREMENT_SYNC_FAILED')
      return failureResult(error, run, 'EU_LDT_CIP_MEASUREMENT_SYNC_FAILED')
    }
  })
}

export async function executeEuLdtCipSyncInitiativesOnce({ runId, workerId = 'eu-ldt-cip-initiative-sync' } = {}) {
  if (!runId) return failureResult('WORKFLOW_RUN_ID_REQUIRED')
  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const initialRun = await workflowRunDetail(client, runId)
      assertRunnable(initialRun, 'eu-ldt-cip-sync-initiatives')
      const input = initialRun.input ?? {}
      const target = await resolveCipTarget(client, input.cipProfileKey ?? input.cip_profile_key)
      await updateRun(client, runId, 'running', { executor: workerId, cipProfileKey: target.profileKey })
      const run = await workflowRunDetail(client, runId)
      const steps = stepMap(run)
      await updateStep(client, runId, 'prepare-run-context', 'succeeded', {
        cityId: run.cityId,
        workerId,
        cipProfileKey: target.profileKey,
      })
      const links = Array.isArray(input.links) ? input.links : []
      await updateStep(client, runId, 'validate-input-contract', 'succeeded', {
        requestedInitiativeIds: input.initiativeIds ?? input.initiative_ids ?? [],
        explicitLinkCount: links.length,
      })

      const remote = await fetchCipCollection(target, 'initiatives', input)
      const requestedIds = new Set((Array.isArray(input.initiativeIds ?? input.initiative_ids) ? input.initiativeIds ?? input.initiative_ids : [])
        .map(textValue).filter(Boolean))
      const initiatives = requestedIds.size
        ? remote.content.filter((initiative) => requestedIds.has(textValue(initiative?.id)))
        : remote.content
      await updateStep(client, runId, 'read-cip-initiatives', 'succeeded', {
        remoteCount: remote.content.length,
        selectedCount: initiatives.length,
        metadata: remote.metadata,
      })

      const stored = await storeCipInitiativeLinks(client, {
        cityId: run.cityId,
        cipProfileKey: target.profileKey,
        sourceWorkflowRunId: runId,
        initiatives,
        links,
      })
      await updateStep(client, runId, 'store-cip-initiative-snapshots', 'succeeded', {
        inserted: stored.inserted,
        updated: stored.updated,
      })
      await updateStep(client, runId, 'link-cip-initiative-selections', 'succeeded', {
        explicitLinkCount: links.length,
        linked: stored.linked,
        unlinked: initiatives.length - stored.linked,
        spatialInference: false,
      })

      const summary = {
        cityId: run.cityId,
        cipProfileKey: target.profileKey,
        remoteInitiativeCount: remote.content.length,
        selectedInitiativeCount: initiatives.length,
        inserted: stored.inserted,
        updated: stored.updated,
        linked: stored.linked,
        unlinked: initiatives.length - stored.linked,
      }
      const artifacts = []
      for (const [kind, stepKey, metadata] of [
        ['cip-initiative-readback', 'read-cip-initiatives', { initiatives }],
        ['cip-initiative-link-evidence', 'link-cip-initiative-selections', { links, rows: stored.rows }],
        ['cip-initiative-sync-summary', 'write-cip-initiative-artifacts', summary],
      ]) {
        artifacts.push(await recordArtifact(client, {
          runId,
          stepId: steps.get(stepKey)?.id ?? steps.get('write-cip-initiative-artifacts')?.id ?? null,
          cityId: run.cityId,
          kind,
          metadata,
        }))
      }
      await updateStep(client, runId, 'write-cip-initiative-artifacts', 'succeeded', { artifactCount: artifacts.length, summary })
      await updateRun(client, runId, 'succeeded', { executor: workerId, summary })
      await client.query('COMMIT')
      return { configured: true, ok: true, run: await workflowRunDetail(client, runId), artifacts: artifacts.map(normalizeArtifact), summary, error: null }
    } catch (error) {
      await client.query('ROLLBACK')
      const run = await failRun(client, runId, error, 'EU_LDT_CIP_INITIATIVE_SYNC_FAILED')
      return failureResult(error, run, 'EU_LDT_CIP_INITIATIVE_SYNC_FAILED')
    }
  })
}
