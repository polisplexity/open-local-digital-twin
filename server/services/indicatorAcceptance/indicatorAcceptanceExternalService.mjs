import { getProductionPool } from '../../db/postgisPool.mjs'
import {
  createWorkflowRun,
  decideWorkflowApproval,
  executeWorkflowRunOnce,
} from '../ldtOps/workflowService.mjs'
import { requestCipJson } from '../ldtOps/euLdtCityInnovationPlannerService.mjs'

const CATALOG_KEY = 'u4ssc'
const SUITE_KEY = 'u4ssc-indicator-query-acceptance-v1'
const DEFAULT_CIP_PROFILE = 'local-eu-ldt-city-innovation-planner'
const DEFAULT_DATA_PLATFORM_PROFILE = 'local-eu-ldt-data-platform'

function requirePool() {
  const pool = getProductionPool()
  if (!pool) throw new Error('DATABASE_URL_REQUIRED')
  return pool
}

function text(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function slug(value) {
  return text(value, 'indicator')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function mapWithConcurrency(items, concurrency, handler) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await handler(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

async function approveAndExecute(workflowKey, cityId, input, actor) {
  const created = await createWorkflowRun({
    workflowKey,
    cityId,
    requestedBy: actor,
    requestedByKind: 'integration-acceptance',
    triggerKind: SUITE_KEY,
    input,
  })
  if (!created.ok) throw new Error(created.error || `${workflowKey}:CREATE_FAILED`)
  let run = created.run
  for (const approval of run.approvals.filter((entry) => entry.status === 'requested')) {
    const decision = await decideWorkflowApproval({
      runId: run.id,
      approvalKey: approval.approvalKey,
      decision: 'approved',
      decidedBy: actor,
      reason: `Approved by ${SUITE_KEY}.`,
    })
    if (!decision.ok) throw new Error(decision.error || `${workflowKey}:APPROVAL_FAILED`)
    run = decision.run
  }
  const executed = await executeWorkflowRunOnce({ runId: run.id, workerId: actor })
  if (!executed.ok || executed.run?.status !== 'succeeded') {
    throw new Error(executed.error || `${workflowKey}:EXECUTION_FAILED`)
  }
  return executed
}

async function acceptanceRows(cityId, limit = 0) {
  const params = [cityId, CATALOG_KEY]
  const limitSql = Number(limit) > 0 ? `LIMIT $${params.push(Math.trunc(Number(limit)))}` : ''
  const result = await requirePool().query(`
    SELECT
      acceptance.id,
      acceptance.case_key,
      definition.id AS indicator_id,
      definition.indicator_key,
      definition.name,
      definition.unit,
      membership.external_code,
      observation.value,
      observation.value_kind,
      observation.value_text,
      observation.boolean_value
    FROM ldt_analysis.indicator_acceptance_cases acceptance
    JOIN ldt_science.indicator_catalogs catalog ON catalog.id=acceptance.catalog_id
    JOIN ldt_science.indicator_definitions definition ON definition.id=acceptance.indicator_id
    JOIN ldt_science.indicator_catalog_memberships membership
      ON membership.catalog_id=catalog.id AND membership.indicator_id=definition.id
    JOIN LATERAL (
      SELECT value, value_kind, value_text, boolean_value
      FROM ldt_science.indicator_observations observation
      WHERE observation.city_id=acceptance.city_id
        AND observation.indicator_id=definition.id
        AND observation.observation_key='dev-u4ssc-acceptance:city:' || definition.indicator_key
      ORDER BY observation.updated_at DESC
      LIMIT 1
    ) observation ON true
    WHERE acceptance.city_id=$1
      AND catalog.catalog_key=$2
      AND acceptance.local_status='passed'
    ORDER BY membership.sort_order, membership.external_code
    ${limitSql}
  `, params)
  return result.rows
}

async function updateCase(caseId, statuses = {}, evidence = {}) {
  await requirePool().query(`
    UPDATE ldt_analysis.indicator_acceptance_cases
    SET data_platform_status=COALESCE($2::text, data_platform_status),
        cip_status=COALESCE($3::text, cip_status),
        roundtrip_status=COALESCE($4::text, roundtrip_status),
        external_evidence=COALESCE(external_evidence, '{}'::jsonb) || $5::jsonb,
        last_run_at=now(),
        updated_at=now()
    WHERE id=$1
  `, [
    caseId,
    statuses.dataPlatform ?? null,
    statuses.cip ?? null,
    statuses.roundtrip ?? null,
    JSON.stringify(evidence ?? {}),
  ])
}

async function publishIndicator(row, options) {
  const codeSlug = slug(row.external_code)
  const bindingKey = `u4ssc-${codeSlug}`
  const expectedValue = finiteNumber(row.value)
  if (expectedValue == null) throw new Error(`U4SSC_NUMERIC_TRANSPORT_VALUE_MISSING:${row.external_code}`)
  const ngsiEntityId = `urn:ngsi-ld:KeyPerformanceIndicatorSource:${slug(options.cityId)}:${bindingKey}`
  const actor = `${SUITE_KEY}:${codeSlug}`
  const executed = await approveAndExecute('eu-ldt-cip-publish-metric-source', options.cityId, {
    cipProfileKey: options.cipProfileKey,
    dataPlatformProfileKey: options.dataPlatformProfileKey,
    value: expectedValue,
    bindingKey,
    unit: row.unit,
    observedAt: new Date().toISOString(),
    ngsiEntityId,
    ngsiEntityType: 'KeyPerformanceIndicatorSource',
    ngsiProperty: 'observedValue',
    formulaParameter: 'U4sscValue',
    createKpi: true,
    cipKpiId: options.existingKpisByCode.get(row.external_code)?.id ?? undefined,
    reuseKpiLookup: false,
    kpiName: `${options.cityId} U4SSC ${row.external_code}`.slice(0, 50),
    kpiDescription: `${row.name}. Development acceptance value from OLDT through EU LDT Data Platform.`.slice(0, 255),
    kpiStatus: 'SAVED',
    kpiType: 'STANDARD',
    frequency: 'DAILY',
    calculationFormula: 'mean(U4sscValue)',
    datasourceName: `OLDT ${row.external_code}`.slice(0, 50),
    requestCalculation: true,
    u4sscStandard: true,
    kpiU4SSCCode: row.external_code,
    indicatorKey: row.indicator_key,
    indicatorExternalCode: row.external_code,
    indicatorCatalogKey: CATALOG_KEY,
    indicatorValueKind: row.value_kind,
  }, actor)
  const summary = executed.summary ?? {}
  if (!summary.ngsiEntityId || !summary.cipKpiId || !summary.cipDatasourceId) {
    throw new Error(`U4SSC_EXTERNAL_IDENTIFIERS_MISSING:${row.external_code}`)
  }
  if (summary.u4sscStandard !== true || text(summary.kpiU4SSCCode) !== row.external_code) {
    throw new Error(`U4SSC_CIP_STANDARD_BINDING_MISMATCH:${row.external_code}`)
  }
  if (finiteNumber(summary.value) !== expectedValue) {
    throw new Error(`U4SSC_EXTERNAL_VALUE_MISMATCH:${row.external_code}`)
  }
  return {
    row,
    ok: true,
    expectedValue,
    workflowRunId: executed.run.id,
    bindingKey,
    ngsiEntityId: summary.ngsiEntityId,
    cipKpiId: summary.cipKpiId,
    cipDatasourceId: summary.cipDatasourceId,
    createdKpi: Boolean(summary.createdKpi),
    reusedKpi: Boolean(summary.reusedKpi),
    createdDatasource: Boolean(summary.createdDatasource),
  }
}

async function waitForMeasurements(publications, cipApiBase, timeoutMs) {
  const expected = new Map(publications.map((entry) => [entry.cipKpiId, entry]))
  const found = new Map()
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline && found.size < expected.size) {
    const result = await requestCipJson(`${cipApiBase}/kpi-measurements?page=0&size=500`)
    const rows = Array.isArray(result.body?.content) ? result.body.content : []
    for (const measurement of rows) {
      const publication = expected.get(text(measurement?.kpiId))
      if (!publication || text(measurement?.status).toLowerCase() !== 'success') continue
      if (finiteNumber(measurement?.measure) !== publication.expectedValue) continue
      const previous = found.get(publication.cipKpiId)
      if (!previous || text(measurement?.measureDate) > text(previous?.measureDate)) {
        found.set(publication.cipKpiId, measurement)
      }
    }
    if (found.size < expected.size) await delay(1000)
  }
  return found
}

async function verifyReadback(publication, measurement, options) {
  const observationKey = `cip:${options.cipProfileKey}:${measurement.id}`
  const result = await requirePool().query(`
    SELECT
      receipt.id AS receipt_id,
      receipt.measure,
      receipt.status AS receipt_status,
      observation.id AS observation_id,
      observation.value AS observation_value,
      observation.validation_status,
      observation.authority_status
    FROM ldt_interop.cip_metric_bindings binding
    JOIN ldt_interop.cip_measurement_receipts receipt
      ON receipt.binding_id=binding.id
     AND receipt.cip_measurement_id=$4
    LEFT JOIN ldt_science.indicator_observations observation
      ON observation.observation_key=$5
    WHERE binding.city_id=$1
      AND binding.cip_profile_key=$2
      AND binding.cip_kpi_id=$3
      AND binding.metadata->>'indicatorKey'=$6
    ORDER BY receipt.updated_at DESC
    LIMIT 1
  `, [
    options.cityId,
    options.cipProfileKey,
    publication.cipKpiId,
    measurement.id,
    observationKey,
    publication.row.indicator_key,
  ])
  const row = result.rows[0]
  const passed = Boolean(
    row?.receipt_id
    && row?.observation_id
    && text(row.receipt_status).toLowerCase() === 'success'
    && finiteNumber(row.measure) === publication.expectedValue
    && finiteNumber(row.observation_value) === publication.expectedValue
    && row.validation_status === 'lab'
    && row.authority_status === 'integration-lab'
  )
  return { passed, row: row ?? null, observationKey }
}

export async function runU4sscExternalAcceptance({
  cityId = 'guanajuato',
  cipProfileKey = process.env.EU_LDT_CIP_PROFILE_KEY ?? DEFAULT_CIP_PROFILE,
  dataPlatformProfileKey = process.env.EU_LDT_DATA_PLATFORM_PROFILE_KEY ?? DEFAULT_DATA_PLATFORM_PROFILE,
  cipApiBase = process.env.EU_LDT_CIP_API_URL ?? 'http://host.docker.internal:4351/api/v1',
  concurrency = 2,
  timeoutMs = 180000,
  limit = 0,
} = {}) {
  if (!process.env.EU_LDT_CIP_MIN_REQUEST_INTERVAL_MS) {
    process.env.EU_LDT_CIP_MIN_REQUEST_INTERVAL_MS = '750'
  }
  const rows = await acceptanceRows(cityId, limit)
  if (!rows.length) throw new Error('U4SSC_LOCAL_ACCEPTANCE_REQUIRED')
  if (!limit && rows.length !== 91) throw new Error(`U4SSC_LOCAL_ACCEPTANCE_COUNT_INVALID:${rows.length}`)
  const normalizedCipApiBase = text(cipApiBase).replace(/\/+$/, '')
  const existingKpis = await requestCipJson(`${normalizedCipApiBase}/kpis?page=0&size=500`)
  const existingKpisByCode = new Map(
    (Array.isArray(existingKpis.body?.content) ? existingKpis.body.content : [])
      .filter((entry) => entry?.u4sscStandard === true && text(entry?.kpiU4SSCCode))
      .map((entry) => [text(entry.kpiU4SSCCode), entry]),
  )
  const options = {
    cityId,
    cipProfileKey,
    dataPlatformProfileKey,
    existingKpisByCode,
  }
  await Promise.all(rows.map((row) => updateCase(row.id, {
    dataPlatform: 'running',
    cip: 'running',
    roundtrip: 'running',
  }, {
    suite: SUITE_KEY,
    externalRunStartedAt: new Date().toISOString(),
  })))

  const publications = await mapWithConcurrency(rows, Math.max(1, Math.min(8, Number(concurrency) || 4)), async (row) => {
    try {
      const publication = await publishIndicator(row, options)
      await updateCase(row.id, { dataPlatform: 'passed', cip: 'running', roundtrip: 'running' }, {
        publication: {
          workflowRunId: publication.workflowRunId,
          bindingKey: publication.bindingKey,
          ngsiEntityId: publication.ngsiEntityId,
          cipKpiId: publication.cipKpiId,
          cipDatasourceId: publication.cipDatasourceId,
          expectedValue: publication.expectedValue,
          createdKpi: publication.createdKpi,
          reusedKpi: publication.reusedKpi,
          createdDatasource: publication.createdDatasource,
        },
      })
      return publication
    } catch (error) {
      const message = String(error?.message ?? error)
      await updateCase(row.id, { dataPlatform: 'failed', cip: 'failed', roundtrip: 'failed' }, {
        externalError: message,
      })
      return { row, ok: false, error: message }
    }
  })

  const published = publications.filter((entry) => entry.ok)
  const measurements = await waitForMeasurements(published, normalizedCipApiBase, Number(timeoutMs) || 180000)
  for (const publication of published) {
    const measurement = measurements.get(publication.cipKpiId)
    await updateCase(publication.row.id, {
      cip: measurement ? 'passed' : 'failed',
      roundtrip: measurement ? 'running' : 'failed',
    }, measurement ? {
      measurement: {
        id: measurement.id,
        kpiId: measurement.kpiId,
        value: finiteNumber(measurement.measure),
        status: measurement.status,
        measureDate: measurement.measureDate,
      },
    } : {
      measurementError: `CIP_MEASUREMENT_TIMEOUT:${publication.cipKpiId}`,
    })
  }

  const measured = published.filter((entry) => measurements.has(entry.cipKpiId))
  let sync = null
  if (measured.length) {
    sync = await approveAndExecute('eu-ldt-cip-sync-measurements', cityId, {
      cipProfileKey,
      kpiIds: measured.map((entry) => entry.cipKpiId),
      pageSize: 500,
      maxPages: 10,
    }, `${SUITE_KEY}:measurement-sync`)
  }

  let roundtripPassed = 0
  for (const publication of measured) {
    const measurement = measurements.get(publication.cipKpiId)
    const verification = await verifyReadback(publication, measurement, options)
    if (verification.passed) roundtripPassed += 1
    await updateCase(publication.row.id, {
      roundtrip: verification.passed ? 'passed' : 'failed',
    }, {
      roundtrip: {
        syncWorkflowRunId: sync?.run?.id ?? null,
        receiptId: verification.row?.receipt_id ?? null,
        observationId: verification.row?.observation_id ?? null,
        observationKey: verification.observationKey,
        validationStatus: verification.row?.validation_status ?? null,
        authorityStatus: verification.row?.authority_status ?? null,
        passed: verification.passed,
      },
    })
  }

  const failed = publications.filter((entry) => !entry.ok)
  const requested = rows.length
  const result = {
    ok: published.length === requested && measurements.size === requested && roundtripPassed === requested,
    cityId,
    catalogKey: CATALOG_KEY,
    requested,
    dataPlatformPassed: published.length,
    cipPassed: measurements.size,
    roundtripPassed,
    failed: failed.length,
    failures: failed.map((entry) => ({
      externalCode: entry.row.external_code,
      indicatorKey: entry.row.indicator_key,
      error: entry.error,
    })),
    syncWorkflowRunId: sync?.run?.id ?? null,
  }
  return result
}
