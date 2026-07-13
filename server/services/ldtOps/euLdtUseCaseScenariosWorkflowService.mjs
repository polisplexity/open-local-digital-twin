import { withClient } from './dbUtils.mjs'
import {
  buildUcsScenarioDatasetEntity,
  buildUcsScenarioMetricEntity,
  createUcsResource,
  executeUcsExperiment,
  getUcsResource,
  getUcsAiModel,
  associateUcsScenarios,
  assertUcsAiModelReady,
  resolveUcsTarget,
  retrieveUcsDataSource,
  upsertUcsCaseBinding,
  waitForUcsExecution,
} from './euLdtUseCaseScenariosService.mjs'
import {
  publishCipMetricSourceToDataPlatform,
  resolveSelectionMetric,
} from './euLdtCityInnovationPlannerService.mjs'
import { resolveEuLdtIntegrationTarget } from './euLdtIntegrationService.mjs'

const ENTITY_SIMULATION_OUTPUTS = [
  ['baseline_energy_kwh', 'kWh'],
  ['simulated_energy_kwh', 'kWh'],
  ['baseline_co2_kg', 'kgCO2e'],
  ['simulated_co2_kg', 'kgCO2e'],
  ['energy_delta_kwh', 'kWh'],
  ['co2_delta_kg', 'kgCO2e'],
  ['assumption_flags', null],
]

const UCS_NGSI_TO_KSERVE_TRANSFORM = `data = get_extracted_data() or {}
records = ((data.get("records") or {}).get("value") or [])

def number(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default

entity_ids = [str(row.get("entityId") or "") for row in records]
floor_areas = [number(row.get("floorAreaM2"), 0.0) for row in records]
storeys = [max(1, int(round(number(row.get("storeys"), 1.0)))) for row in records]
observed_energy = [number(row.get("observedEnergyKwh"), 0.0) for row in records]

if not entity_ids or any(not value for value in entity_ids):
    raise ValueError("OLDT scenario dataset contains no valid entity IDs")

transformed_data = [
    {"name": "entity_ids", "shape": [len(entity_ids)], "datatype": "BYTES", "data": entity_ids},
    {"name": "floor_area_m2", "shape": [len(floor_areas)], "datatype": "FP64", "data": floor_areas},
    {"name": "storeys", "shape": [len(storeys)], "datatype": "INT64", "data": storeys},
    {"name": "observed_energy_kwh", "shape": [len(observed_energy)], "datatype": "FP64", "data": observed_energy},
]
write_transform_output({"transformed_data": transformed_data})`

function textValue(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function finiteNumber(value, fallback = null) {
  const normalized = typeof value === 'string' ? value.replace(',', '.') : value
  const number = Number(normalized)
  return Number.isFinite(number) ? number : fallback
}

function normalizedKey(value, fallback = 'ucs-roundtrip') {
  const normalized = textValue(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{1,128}$/.test(normalized)) throw new Error('UCS_BINDING_KEY_INVALID')
  return normalized
}

function safeUrnPart(value, fallback = 'value') {
  return textValue(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback
}

function workflowArtifactUri(runId, artifactKind) {
  return `ldt://workflow-runs/${runId}/${artifactKind}.json`
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
    byteSize: row.byte_size ? Number(row.byte_size) : null,
    checksum: row.checksum,
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

async function recordArtifact(client, { runId, stepId, cityId, artifactKind, metadata = {} }) {
  const artifactUri = workflowArtifactUri(runId, artifactKind)
  const existing = await client.query(
    'SELECT * FROM ldt_ops.workflow_artifacts WHERE run_id = $1 AND artifact_uri = $2 LIMIT 1',
    [runId, artifactUri],
  )
  if (existing.rowCount) return existing.rows[0]
  const result = await client.query(`
    INSERT INTO ldt_ops.workflow_artifacts (
      run_id, step_id, city_id, artifact_kind, artifact_uri, media_type, metadata
    ) VALUES ($1, $2, $3, $4, $5, 'application/json', $6::jsonb)
    RETURNING *
  `, [runId, stepId, cityId, artifactKind, artifactUri, JSON.stringify(metadata ?? {})])
  return result.rows[0]
}

function stepMap(run) {
  return new Map((run?.steps ?? []).map((step) => [step.stepKey, step]))
}

function profileFrontendUrl(profile = {}) {
  return textValue(profile.endpoints?.publicFrontendUrl ?? profile.endpoints?.frontendUrl ?? profile.baseUrl)
}

function executionEvidence(execution = {}) {
  return {
    id: execution.id,
    status: execution.status,
    workflowDagId: execution.workflowDagId,
    workflowRunId: execution.workflowRunId,
    inferenceResponse: execution.inferenceResponse,
    effectiveOutput: execution.effectiveOutput,
    updatedAt: execution.updatedAt,
  }
}

function assertReadback(readback = {}, expected = {}) {
  if (textValue(readback.id) !== textValue(expected.entityId)) throw new Error(`UCS_DATA_SOURCE_READBACK_ID_MISMATCH:${expected.scenarioKind}`)
  const value = finiteNumber(readback?.observedValue?.value)
  if (value == null || Math.abs(value - Number(expected.value)) > 1e-9) {
    throw new Error(`UCS_DATA_SOURCE_READBACK_VALUE_MISMATCH:${expected.scenarioKind}:${value}:${expected.value}`)
  }
  return value
}

function assertDatasetReadback(readback = {}, expected = {}) {
  if (textValue(readback.id) !== textValue(expected.entityId)) {
    throw new Error(`UCS_DATASET_READBACK_ID_MISMATCH:${expected.scenarioKind}`)
  }
  const records = readback?.records?.value
  if (!Array.isArray(records)) throw new Error(`UCS_DATASET_READBACK_RECORDS_MISSING:${expected.scenarioKind}`)
  if (records.length !== Number(expected.recordCount)) {
    throw new Error(`UCS_DATASET_READBACK_COUNT_MISMATCH:${expected.scenarioKind}:${records.length}:${expected.recordCount}`)
  }
  return records.length
}

function boundedInteger(value, fallback, minimum = 1, maximum = 1000) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, number))
}

async function resolveSelectionEntityBatch(client, { cityId, selectionSetId, limit = 300 } = {}) {
  const result = await client.query(`
    SELECT
      member.city_entity_id,
      member.object_id,
      member.attributes,
      entity.stable_id,
      entity.canonical_uri,
      entity.entity_type,
      entity.label,
      entity.updated_at,
      CASE
        WHEN entity.geom IS NOT NULL AND GeometryType(entity.geom) IN ('POLYGON', 'MULTIPOLYGON')
          THEN ST_Area(entity.geom::geography)
        ELSE 0
      END AS floor_area_m2,
      COALESCE(
        NULLIF(member.attributes ->> 'storeys', ''),
        NULLIF(member.attributes ->> 'buildingLevels', ''),
        NULLIF(entity.properties #>> '{sourceProperties,levels}', ''),
        NULLIF(entity.properties #>> '{sourceProperties,num_floors}', '')
      ) AS raw_storeys,
      COALESCE(
        NULLIF(member.attributes ->> 'observedEnergyKwh', ''),
        NULLIF(member.attributes ->> 'annualEnergyKwh', ''),
        NULLIF(entity.properties ->> 'observedEnergyKwh', '')
      ) AS raw_observed_energy_kwh
    FROM ldt_analysis.selection_set_members member
    JOIN ldt_analysis.selection_sets selection
      ON selection.id = member.selection_set_id
    JOIN ldt_core.city_entities entity
      ON entity.id = member.city_entity_id
    WHERE selection.id = $1::uuid
      AND selection.city_id = $2
    ORDER BY member.rank, member.object_id
    LIMIT $3
  `, [selectionSetId, cityId, boundedInteger(limit, 300, 1, 500)])
  if (!result.rowCount) throw new Error('UCS_SELECTION_ENTITY_BATCH_EMPTY')

  const records = result.rows.map((row) => {
    const floorAreaM2 = Math.max(0, finiteNumber(row.floor_area_m2, 0))
    const parsedStoreys = finiteNumber(row.raw_storeys)
    const storeys = parsedStoreys == null ? 1 : Math.max(1, Math.round(parsedStoreys))
    const observedEnergyKwh = Math.max(0, finiteNumber(row.raw_observed_energy_kwh, 0))
    const assumptionFlags = []
    if (parsedStoreys == null) assumptionFlags.push('assumed-storeys-1')
    if (observedEnergyKwh <= 0) assumptionFlags.push('energy-estimated-by-model')
    if (floorAreaM2 <= 0) assumptionFlags.push('floor-area-model-default')
    return {
      entityId: textValue(row.stable_id, row.object_id),
      cityEntityId: row.city_entity_id,
      canonicalUri: textValue(row.canonical_uri),
      entityType: textValue(row.entity_type),
      label: textValue(row.label, row.object_id),
      floorAreaM2: Number(floorAreaM2.toFixed(6)),
      storeys,
      observedEnergyKwh: Number(observedEnergyKwh.toFixed(6)),
      assumptionFlags,
      sourceUpdatedAt: row.updated_at,
    }
  })
  return {
    records,
    assumptions: [
      'Footprint area is calculated from the canonical PostGIS geometry.',
      'Missing storeys default to one and are explicitly flagged.',
      'Missing observed energy is estimated by the model from area and the UCS energy-intensity parameter.',
      'Outputs are laboratory simulations, not municipal observations or certified energy assessments.',
    ],
  }
}

function ucsNumericParameterPayload({ name, key, description, unit, minimum, maximum, step, value }) {
  return {
    name,
    key,
    description,
    isPreset: false,
    type: 'numeric',
    unitOfMeasurement: unit,
    minimumValue: String(minimum),
    maximumValue: String(maximum),
    stepValue: String(step),
    status: 'SAVED',
    value: String(value),
    format: 'decimal',
    date: new Date().toISOString(),
    rule: 'laboratory-scenario-input',
    enumerationValue: ['not-applicable'],
  }
}

async function waitForUcsDagAvailable(target, dagId, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  await new Promise((resolve) => setTimeout(resolve, 5_000))
  let lastError = null
  while (Date.now() < deadline) {
    try {
      await getUcsResource(target, `dags/${encodeURIComponent(dagId)}/runs?page=0&size=1`, { timeoutMs: 10_000 })
      return true
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 2_000))
    }
  }
  throw new Error(`UCS_TRANSFORM_DAG_NOT_AVAILABLE:${dagId}:${String(lastError?.message ?? 'timeout')}`)
}

async function configureUcsEntitySimulation(target, {
  suffix,
  baselineScenarioId,
  interventionScenarioId,
  energyIntensity,
  retrofitSavingsFraction,
  emissionFactor,
  scenarioYear,
} = {}) {
  const definitions = [
    {
      key: 'energy_intensity_kwh_m2', // gitleaks:allow -- public semantic parameter identifier
      label: 'Energy intensity',
      description: 'Annual energy intensity used only when a selected entity has no observed energy value.',
      unit: 'kWh/m2/year', minimum: 0, maximum: 1000, step: 1, value: energyIntensity,
    },
    {
      key: 'retrofit_savings_fraction',
      label: 'Retrofit savings fraction',
      description: 'Fraction of baseline energy removed by the intervention scenario.',
      unit: 'fraction', minimum: 0, maximum: 0.95, step: 0.01, value: retrofitSavingsFraction,
    },
    {
      key: 'grid_emission_factor_kg_co2_kwh',
      label: 'Grid emission factor',
      description: 'Carbon factor applied to energy consumption in both scenario branches.',
      unit: 'kgCO2e/kWh', minimum: 0, maximum: 2, step: 0.001, value: emissionFactor,
    },
    {
      key: 'scenario_year',
      label: 'Scenario year',
      description: 'Reference year carried with the simulated result.',
      unit: 'year', minimum: 2000, maximum: 2200, step: 1, value: scenarioYear,
    },
  ]

  const parameterIds = {}
  for (const definition of definitions) {
    const parameter = await createUcsResource(target, 'parameters', ucsNumericParameterPayload({
      ...definition,
      name: `${definition.label} [OLDT ${suffix}]`,
    }))
    parameterIds[definition.key] = parameter.id
  }
  const ids = Object.values(parameterIds)
  await createUcsResource(target, 'associations/scenario-parameter', {
    scenarioId: baselineScenarioId,
    parameterIds: ids,
  }, { requireId: false })
  await createUcsResource(target, 'associations/scenario-parameter', {
    scenarioId: interventionScenarioId,
    parameterIds: ids,
  }, { requireId: false })

  const dag = await createUcsResource(target, 'dags', {
    name: `oldt_ngsi_to_kserve_${suffix}`,
    description: 'Transform an OLDT NGSI-LD scenario dataset into KServe V2 tensors.',
    type: 'transform',
    dependencies: [],
    schedule: 'None',
    tags: ['OLDT', 'NGSI-LD', 'KServe', 'simulation'],
    isActive: true,
    status: 'SAVED',
  })
  const step = await createUcsResource(target, 'dag-steps', {
    name: `oldt_dataset_to_tensors_${suffix}`,
    description: 'Read Data Platform entity records and emit typed model tensors.',
    operatorType: 'PythonOperator',
    dagId: dag.id,
    dependencies: [],
    codeSnippet: UCS_NGSI_TO_KSERVE_TRANSFORM,
    parameters: {},
    retries: 1,
    retryDelay: 5,
    timeout: 120,
    xPosition: 80,
    yPosition: 80,
  })
  const generated = await createUcsResource(target, `dags/${encodeURIComponent(dag.id)}/generate`, {}, {
    requireId: false,
    expectedStatuses: [200],
    timeoutMs: 30_000,
  })
  await waitForUcsDagAvailable(target, dag.id)

  const parameterValues = (savings) => ({
    [parameterIds.energy_intensity_kwh_m2]: String(energyIntensity),
    [parameterIds.retrofit_savings_fraction]: String(savings),
    [parameterIds.grid_emission_factor_kg_co2_kwh]: String(emissionFactor),
    [parameterIds.scenario_year]: String(scenarioYear),
  })
  return {
    parameterIds,
    parameterCount: ids.length,
    baselineValues: parameterValues(0),
    interventionValues: parameterValues(retrofitSavingsFraction),
    transformDagId: dag.id,
    transformStepId: step.id,
    generatedPath: generated.body?.generatedPath ?? null,
  }
}

function parseKserveEntityResult(execution = {}) {
  const output = execution.effectiveOutput ?? execution.inferenceResponse ?? {}
  const tensors = new Map((Array.isArray(output.outputs) ? output.outputs : []).map((item) => [item.name, item.data ?? []]))
  const entityIds = (tensors.get('entity_ids') ?? []).map(String)
  if (!entityIds.length) throw new Error(`UCS_KSERVE_ENTITY_OUTPUTS_MISSING:${execution.id ?? 'execution'}`)
  const records = entityIds.map((entityId, index) => {
    const record = { entityId }
    for (const [outputKey] of ENTITY_SIMULATION_OUTPUTS) {
      const value = (tensors.get(outputKey) ?? [])[index]
      record[outputKey] = outputKey === 'assumption_flags' ? textValue(value) : finiteNumber(value)
    }
    return record
  })
  const sum = (key) => Number(records.reduce((total, record) => total + (finiteNumber(record[key], 0) ?? 0), 0).toFixed(6))
  return {
    records,
    parameters: output.parameters ?? {},
    modelName: textValue(output.model_name),
    modelVersion: textValue(output.model_version),
    summary: {
      recordCount: records.length,
      baselineEnergyKwh: sum('baseline_energy_kwh'),
      simulatedEnergyKwh: sum('simulated_energy_kwh'),
      baselineCo2Kg: sum('baseline_co2_kg'),
      simulatedCo2Kg: sum('simulated_co2_kg'),
      energyDeltaKwh: sum('energy_delta_kwh'),
      co2DeltaKg: sum('co2_delta_kg'),
    },
  }
}

function assertKserveEntityResult(parsed, expectedRecords, scenarioKind) {
  const expectedIds = (expectedRecords ?? []).map((record) => String(record.entityId)).sort()
  const actualIds = (parsed?.records ?? []).map((record) => String(record.entityId)).sort()
  if (actualIds.length !== expectedIds.length) {
    throw new Error(`UCS_KSERVE_RECORD_COUNT_MISMATCH:${scenarioKind}:${actualIds.length}:${expectedIds.length}`)
  }
  const mismatchIndex = expectedIds.findIndex((entityId, index) => entityId !== actualIds[index])
  if (mismatchIndex >= 0) {
    throw new Error(`UCS_KSERVE_ENTITY_ID_MISMATCH:${scenarioKind}:${expectedIds[mismatchIndex]}:${actualIds[mismatchIndex]}`)
  }
  if (textValue(parsed.parameters?.authority_status) !== 'simulated') {
    throw new Error(`UCS_KSERVE_AUTHORITY_STATUS_INVALID:${scenarioKind}`)
  }
  return true
}

async function persistSimulationBranch(client, {
  cityId,
  workflowRunId,
  bindingKey,
  scenarioKind,
  sourceEntityId,
  selectionSetId,
  execution,
  parsed,
  parameters,
} = {}) {
  const modelKey = 'oldt-urban-energy-scenario'
  const modelVersion = textValue(parsed.modelVersion, '0.1.0')
  const modelResult = await client.query(`
    INSERT INTO ldt_science.simulation_models (model_key, name, model_family, version, definition)
    VALUES ($1, 'OLDT urban energy and CO2 scenario', 'building-energy-scenario', $2, $3::jsonb)
    ON CONFLICT (model_key) DO UPDATE SET
      name = EXCLUDED.name,
      model_family = EXCLUDED.model_family,
      version = EXCLUDED.version,
      definition = ldt_science.simulation_models.definition || EXCLUDED.definition
    RETURNING id
  `, [modelKey, modelVersion, JSON.stringify({
    platform: 'EU LDT AI Notebook',
    serving: 'KServe V2',
    authorityStatus: 'simulated',
  })])
  const simulationTime = textValue(parsed.parameters?.simulation_time, new Date().toISOString())
  const runResult = await client.query(`
    INSERT INTO ldt_science.simulation_runs (
      city_id, model_id, scenario_key, status, inputs, outputs, uncertainty, started_at, finished_at
    ) VALUES ($1, $2, $3, 'completed', $4::jsonb, $5::jsonb, $6::jsonb, $7::timestamptz, $7::timestamptz)
    RETURNING id
  `, [
    cityId,
    modelResult.rows[0].id,
    `${bindingKey}-${scenarioKind}`,
    JSON.stringify({ workflowRunId, selectionSetId, sourceEntityId, parameters, ucsExecutionId: execution.id }),
    JSON.stringify(parsed.summary),
    JSON.stringify({ posture: 'laboratory-assumption-driven', authorityStatus: 'simulated' }),
    simulationTime,
  ])
  const simulationRunId = runResult.rows[0].id
  const stableIds = parsed.records.map((record) => record.entityId)
  const entityResult = await client.query(`
    SELECT id, stable_id
    FROM ldt_core.city_entities
    WHERE city_id = $1 AND stable_id = ANY($2::text[])
  `, [cityId, stableIds])
  const entityIds = new Map(entityResult.rows.map((row) => [row.stable_id, row.id]))
  const missing = stableIds.filter((stableId) => !entityIds.has(stableId))
  if (missing.length) throw new Error(`UCS_SIMULATION_ENTITY_MAPPING_MISSING:${missing.slice(0, 5).join(',')}`)

  const outputRows = []
  for (const record of parsed.records) {
    for (const [outputKey, unit] of ENTITY_SIMULATION_OUTPUTS) {
      const rawValue = record[outputKey]
      outputRows.push({
        entity_id: entityIds.get(record.entityId),
        output_key: outputKey,
        value_numeric: outputKey === 'assumption_flags' ? null : finiteNumber(rawValue),
        value_text: outputKey === 'assumption_flags' ? textValue(rawValue) : null,
        value_json: { value: rawValue },
        unit,
      })
    }
  }
  await client.query(`
    INSERT INTO ldt_enrichment.entity_model_outputs (
      city_id, entity_id, workflow_run_id, simulation_run_id,
      model_key, model_version, output_key, status,
      value_numeric, value_text, value_json, unit,
      confidence, authority_status, method, input_sources, uncertainty, warnings,
      generated_at, valid_from
    )
    SELECT
      $1, item.entity_id, $2::uuid, $3::uuid,
      $4, $5, item.output_key, 'computed',
      item.value_numeric, item.value_text, item.value_json, item.unit,
      'laboratory-scenario', 'simulated', $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb,
      $10::timestamptz, $10::timestamptz
    FROM jsonb_to_recordset($11::jsonb) AS item(
      entity_id uuid,
      output_key text,
      value_numeric numeric,
      value_text text,
      value_json jsonb,
      unit text
    )
  `, [
    cityId,
    workflowRunId,
    simulationRunId,
    modelKey,
    modelVersion,
    JSON.stringify({ platform: 'EU LDT AI Notebook', protocol: 'KServe V2', scenarioKind }),
    JSON.stringify([{ kind: 'data-platform-ngsi-ld', entityId: sourceEntityId }]),
    JSON.stringify({ posture: 'assumption-driven-laboratory-simulation' }),
    JSON.stringify(['not-municipal-observation', 'not-certified-energy-assessment']),
    simulationTime,
    JSON.stringify(outputRows),
  ])
  return {
    simulationRunId,
    scenarioKind,
    generatedAt: simulationTime,
    modelKey,
    modelVersion,
    ...parsed.summary,
  }
}

async function markFailed(runId, error) {
  return withClient(async (client) => {
    try {
      await updateRun(client, runId, 'failed', {}, { message: String(error?.message ?? error) })
      return workflowRunDetail(client, runId)
    } catch {
      return null
    }
  }).catch(() => null)
}

function failureResult(error, run = null) {
  return {
    configured: true,
    ok: false,
    run,
    artifacts: [],
    summary: null,
    error: String(error?.message ?? error ?? 'EU_LDT_UCS_ROUNDTRIP_FAILED'),
  }
}

export async function executeEuLdtUseCaseScenariosRoundtripOnce({
  runId,
  workerId = 'eu-ldt-ucs-roundtrip-worker',
} = {}) {
  if (!runId) return failureResult('WORKFLOW_RUN_ID_REQUIRED')

  try {
    return await withClient(async (client) => {
      const initialRun = await workflowRunDetail(client, runId)
      if (!initialRun) throw new Error('WORKFLOW_RUN_NOT_FOUND')
      if (initialRun.workflowKey !== 'eu-ldt-use-case-scenarios-roundtrip') throw new Error('EU_LDT_UCS_WORKFLOW_RUN_REQUIRED')
      if (!['queued', 'running'].includes(initialRun.status)) throw new Error(`WORKFLOW_RUN_NOT_EXECUTABLE:${initialRun.status}`)

      const input = initialRun.input ?? {}
      const ucsProfileKey = textValue(input.ucsProfileKey ?? input.ucs_profile_key)
      const dataPlatformProfileKey = textValue(input.dataPlatformProfileKey ?? input.data_platform_profile_key)
      if (!ucsProfileKey) throw new Error('UCS_INTEGRATION_PROFILE_REQUIRED')
      if (!dataPlatformProfileKey) throw new Error('UCS_DATA_PLATFORM_PROFILE_REQUIRED')

      const ucsTarget = await resolveUcsTarget(client, ucsProfileKey)
      const dataPlatformTarget = await resolveEuLdtIntegrationTarget(client, dataPlatformProfileKey, {
        platformKind: 'data-platform',
        endpointKey: 'backendApiUrl',
      })
      const bindingKey = normalizedKey(input.bindingKey ?? input.binding_key, `ucs-${runId.slice(0, 8)}`)
      const ngsiScope = textValue(input.ngsiScope ?? input.ngsi_scope, 'default')
      const unit = textValue(input.unit, 'objects')
      const modelNamespace = textValue(input.modelNamespace ?? input.model_namespace, 'dev')
      const modelName = textValue(input.modelName ?? input.model_name, 'echo-model')
      const entityBatchMode = input.entityBatchMode === true
        || input.entity_batch_mode === true
        || modelName === 'oldt-urban-energy-scenario'

      await updateRun(client, runId, 'running', {
        executor: workerId,
        ucsProfileKey: ucsTarget.profileKey,
        dataPlatformProfileKey: dataPlatformTarget.profileKey,
        externalSystem: `eu-ldt-use-case-scenarios:${ucsTarget.profileKey}`,
      })
      const run = await workflowRunDetail(client, runId)
      const steps = stepMap(run)
      await updateStep(client, runId, 'prepare-run-context', 'succeeded', {
        cityId: run.cityId,
        workerId,
        ucsProfileKey: ucsTarget.profileKey,
        dataPlatformProfileKey: dataPlatformTarget.profileKey,
      })
      await updateStep(client, runId, 'validate-input-contract', 'succeeded', {
        bindingKey,
        ngsiScope,
        modelNamespace,
        modelName,
      })

      const baseline = await resolveSelectionMetric(client, {
        cityId: run.cityId,
        selectionSetId: input.selectionSetId ?? input.selection_set_id,
        value: input.baselineValue ?? input.baseline_value,
        metricKey: input.metricKey ?? input.metric_key,
        attributeKey: input.attributeKey ?? input.attribute_key,
        aggregation: input.aggregation,
      })
      const entityBatch = entityBatchMode
        ? await resolveSelectionEntityBatch(client, {
          cityId: run.cityId,
          selectionSetId: baseline.selection?.id,
          limit: input.maxEntities ?? input.max_entities,
        })
        : null
      await updateStep(client, runId, 'resolve-oldt-baseline', 'succeeded', {
        value: baseline.value,
        aggregation: baseline.aggregation,
        source: baseline.source,
        sampleSize: baseline.sampleSize,
        selectionSetId: baseline.selection?.id ?? null,
        entityBatchMode,
        modelRecordCount: entityBatch?.records.length ?? null,
      })

      const interventionDeltaPercent = entityBatchMode
        ? 0
        : finiteNumber(input.interventionDeltaPercent ?? input.intervention_delta_percent, -15)
      const interventionValue = entityBatchMode
        ? baseline.value
        : finiteNumber(
          input.interventionValue ?? input.intervention_value,
          Number((baseline.value * (1 + interventionDeltaPercent / 100)).toFixed(6)),
        )
      if (interventionValue == null) throw new Error('UCS_INTERVENTION_VALUE_REQUIRED')
      await updateStep(client, runId, 'derive-intervention', 'succeeded', {
        baselineValue: baseline.value,
        interventionValue,
        interventionDeltaPercent: baseline.value === 0
          ? null
          : Number((((interventionValue / baseline.value) - 1) * 100).toFixed(6)),
        scenarioDifference: entityBatchMode
          ? 'The selected entities remain fixed; UCS parameter values define the intervention.'
          : 'The scalar intervention value differs from the baseline value.',
      })

      const entityType = entityBatchMode ? 'OldtScenarioDataset' : 'OldtScenarioMetric'
      const urnBase = `urn:ngsi-ld:${entityType}:${safeUrnPart(run.cityId)}:${safeUrnPart(bindingKey)}`
      const buildScenarioEntity = (scenarioKind, value) => entityBatchMode
        ? buildUcsScenarioDatasetEntity({
          entityId: `${urnBase}:${scenarioKind}`,
          cityId: run.cityId,
          bindingKey,
          scenarioKind,
          records: entityBatch.records,
          assumptions: entityBatch.assumptions,
          selection: baseline.selection,
        })
        : buildUcsScenarioMetricEntity({
          entityId: `${urnBase}:${scenarioKind}`,
          cityId: run.cityId,
          bindingKey,
          scenarioKind,
          value,
          unit,
          metricKey: input.metricKey ?? input.metric_key ?? baseline.metric?.metric_key,
          aggregation: baseline.aggregation,
          selection: baseline.selection,
        })
      const baselineEntity = buildScenarioEntity('baseline', baseline.value)
      const interventionEntity = buildScenarioEntity('intervention', interventionValue)
      const baselinePublication = await publishCipMetricSourceToDataPlatform(dataPlatformTarget, baselineEntity, { scope: ngsiScope })
      const interventionPublication = await publishCipMetricSourceToDataPlatform(dataPlatformTarget, interventionEntity, { scope: ngsiScope })
      await updateStep(client, runId, 'publish-scenario-inputs', 'succeeded', {
        baseline: {
          entityId: baselineEntity.id,
          created: baselinePublication.created,
          value: baseline.value,
          recordCount: entityBatch?.records.length ?? null,
        },
        intervention: {
          entityId: interventionEntity.id,
          created: interventionPublication.created,
          value: interventionValue,
          recordCount: entityBatch?.records.length ?? null,
        },
      })

      const suffix = runId.slice(0, 8)
      const uniqueName = (value, fallback) => `${textValue(value, fallback)} [${suffix}]`
      const caseName = uniqueName(
        input.caseName ?? input.case_name,
        'OLDT Guanajuato baseline and intervention',
      )
      const now = new Date()
      const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
      const useCase = await createUcsResource(ucsTarget, 'cases', {
        name: caseName,
        description: textValue(input.caseDescription, 'OLDT-governed baseline and intervention comparison backed by Data Platform NGSI-LD inputs.'),
        type: textValue(input.caseType, 'URBAN_ANALYTICS'),
        priority: textValue(input.priority, 'MEDIUM'),
        status: 'SAVED',
      })
      const scope = await createUcsResource(ucsTarget, `cases/${useCase.id}/scopes`, {
        name: uniqueName(null, `${run.cityId} governed spatial scope`),
        description: baseline.selection
          ? `Saved OLDT selection ${baseline.selection.id}: ${textValue(baseline.selection.title, bindingKey)}.`
          : `Explicit OLDT operator metric for ${run.cityId}.`,
        constraints: [`OLDT binding ${bindingKey}`, `Data Platform scope ${ngsiScope}`],
        geographicalAreas: [run.cityId],
        status: 'SAVED',
      })
      const problem = await createUcsResource(ucsTarget, `cases/${useCase.id}/problems`, {
        name: uniqueName(input.problemName, 'Compare current state with a measurable intervention'),
        description: textValue(input.problemDescription, 'The city needs reproducible evidence for a baseline and an intervention over the same governed metric.'),
        impact: textValue(input.problemImpact, 'Urban planning and operational prioritization'),
        impactLevel: textValue(input.problemImpactLevel, 'MEDIUM'),
        cause: textValue(input.problemCause, 'Alternative actions require comparable model inputs and preserved provenance.'),
        status: 'SAVED',
      })
      const objective = await createUcsResource(ucsTarget, `cases/${useCase.id}/objectives`, {
        name: uniqueName(input.objectiveName, 'Evaluate the intervention against the OLDT baseline'),
        description: textValue(input.objectiveDescription, 'Execute both scenario inputs through the same UCS workflow and retain comparable outputs.'),
        measurement: `${textValue(input.metricKey ?? input.metric_key, 'result_count')} (${unit})`,
        timeline: [now.toISOString(), horizon.toISOString()],
        status: 'SAVED',
      })
      const keyMetric = await createUcsResource(ucsTarget, `cases/${useCase.id}/key-metrics`, {
        name: uniqueName(input.keyMetricName, 'OLDT governed scenario metric'),
        description: textValue(input.keyMetricDescription, 'Comparable value published as one NGSI-LD entity per scenario.'),
        targetValue: String(interventionValue),
        threshold: String(baseline.value),
        unitOfMeasure: unit,
        valueOgReference: baselineEntity.id,
        measurementFrequency: 1,
        status: 'SAVED',
      })
      await updateStep(client, runId, 'create-ucs-case', 'succeeded', {
        caseId: useCase.id,
        scopeId: scope.id,
        problemId: problem.id,
        objectiveId: objective.id,
        keyMetricId: keyMetric.id,
      })

      const baselineScenario = await createUcsResource(ucsTarget, 'scenarios', {
        name: `${caseName} - Baseline`,
        description: `Current-state metric ${baseline.value} ${unit} from OLDT.`,
        type: 'BASELINE',
        priority: 'MEDIUM',
        status: 'SAVED',
      })
      const interventionScenario = await createUcsResource(ucsTarget, 'scenarios', {
        name: `${caseName} - Intervention`,
        description: `Intervention metric ${interventionValue} ${unit} derived from the governed baseline.`,
        type: 'INTERVENTION',
        priority: 'MEDIUM',
        status: 'SAVED',
      })
      await associateUcsScenarios(ucsTarget, useCase.id, [baselineScenario.id, interventionScenario.id])
      await updateStep(client, runId, 'create-ucs-scenarios', 'succeeded', {
        caseId: useCase.id,
        baselineScenarioId: baselineScenario.id,
        interventionScenarioId: interventionScenario.id,
      })

      const dataSourcePayload = (scenarioId, scenarioKind, entityId) => ({
        name: `OLDT ${scenarioKind} ${entityBatchMode ? 'entity dataset' : 'metric'} ${suffix}`,
        connectorType: 'broker',
        scenarioId,
        externalId: entityId,
        scope: ngsiScope,
        type: entityType,
        dataType: 'context',
        status: 'SAVED',
      })
      const baselineDataSource = await createUcsResource(ucsTarget, 'data-sources', dataSourcePayload(
        baselineScenario.id,
        'baseline',
        baselineEntity.id,
      ))
      const interventionDataSource = await createUcsResource(ucsTarget, 'data-sources', dataSourcePayload(
        interventionScenario.id,
        'intervention',
        interventionEntity.id,
      ))
      await updateStep(client, runId, 'bind-ucs-data-sources', 'succeeded', {
        baselineDataSourceId: baselineDataSource.id,
        interventionDataSourceId: interventionDataSource.id,
      })

      const baselineReadback = await retrieveUcsDataSource(ucsTarget, baselineDataSource.id)
      const interventionReadback = await retrieveUcsDataSource(ucsTarget, interventionDataSource.id)
      if (entityBatchMode) {
        assertDatasetReadback(baselineReadback, {
          entityId: baselineEntity.id,
          recordCount: entityBatch.records.length,
          scenarioKind: 'baseline',
        })
        assertDatasetReadback(interventionReadback, {
          entityId: interventionEntity.id,
          recordCount: entityBatch.records.length,
          scenarioKind: 'intervention',
        })
      } else {
        assertReadback(baselineReadback, { entityId: baselineEntity.id, value: baseline.value, scenarioKind: 'baseline' })
        assertReadback(interventionReadback, { entityId: interventionEntity.id, value: interventionValue, scenarioKind: 'intervention' })
      }
      await updateStep(client, runId, 'verify-ucs-data-platform-readback', 'succeeded', {
        baselineEntityId: baselineReadback.id,
        baselineValue: baselineReadback.observedValue?.value,
        interventionEntityId: interventionReadback.id,
        interventionValue: interventionReadback.observedValue?.value,
        recordCount: entityBatch?.records.length ?? null,
      })

      const modelMetadata = await getUcsAiModel(ucsTarget, {
        namespace: modelNamespace,
        modelName,
        timeoutMs: 90_000,
      })
      await assertUcsAiModelReady(ucsTarget, {
        namespace: modelNamespace,
        modelName,
        timeoutMs: 90_000,
      })
      const simulationConfig = entityBatchMode
        ? await configureUcsEntitySimulation(ucsTarget, {
          suffix,
          baselineScenarioId: baselineScenario.id,
          interventionScenarioId: interventionScenario.id,
          energyIntensity: finiteNumber(
            input.energyIntensityKwhM2 ?? input.energy_intensity_kwh_m2,
            145,
          ),
          retrofitSavingsFraction: finiteNumber(
            input.retrofitSavingsFraction ?? input.retrofit_savings_fraction,
            0.25,
          ),
          emissionFactor: finiteNumber(
            input.gridEmissionFactorKgCo2Kwh ?? input.grid_emission_factor_kg_co2_kwh,
            0.423,
          ),
          scenarioYear: boundedInteger(input.scenarioYear ?? input.scenario_year, 2030, 2000, 2200),
        })
        : null
      const inferenceUrl = textValue(
        input.inferenceUrl ?? input.inference_url,
        ucsTarget.profile?.endpoints?.aiNotebookInferenceUrl ?? 'http://host.docker.internal:3333/ain/inference',
      )
      const modelPayload = (scenarioId) => ({
        name: modelName,
        namespace: modelNamespace,
        inferenceUrl,
        inferenceMode: textValue(modelMetadata.inferenceMode, 'SYNC'),
        input: Array.isArray(modelMetadata.inputs) ? modelMetadata.inputs : [],
        output: Array.isArray(modelMetadata.outputs) ? modelMetadata.outputs : [],
        scenarioId,
        status: 'SAVED',
      })
      const baselineDataModel = await createUcsResource(ucsTarget, 'data-models', modelPayload(baselineScenario.id))
      const interventionDataModel = await createUcsResource(ucsTarget, 'data-models', modelPayload(interventionScenario.id))
      await updateStep(client, runId, 'configure-ucs-ai-models', 'succeeded', {
        modelName,
        namespace: modelNamespace,
        inferenceMode: textValue(modelMetadata.inferenceMode, 'SYNC'),
        baselineDataModelId: baselineDataModel.id,
        interventionDataModelId: interventionDataModel.id,
        parameterIds: simulationConfig?.parameterIds ?? {},
        parameterCount: simulationConfig?.parameterCount ?? 0,
        transformDagId: simulationConfig?.transformDagId ?? null,
        transformStepId: simulationConfig?.transformStepId ?? null,
      })

      const experimentPayload = (scenarioId, scenarioKind, dataSourceId, modelId, parameterValues) => ({
        name: `OLDT ${scenarioKind} experiment ${suffix}`,
        description: `UCS ${scenarioKind} experiment created by governed OLDT workflow ${runId}.`,
        scenarioId,
        configuration: {
          input: [{
            dataSourceId,
            ...(simulationConfig?.transformDagId ? { transformDagId: simulationConfig.transformDagId } : {}),
          }],
          modelSettings: { modelId },
          parameters: parameterValues ?? {},
          relationships: [],
          countParameterRelationship: 0,
          countParameter: Object.keys(parameterValues ?? {}).length,
          countDataSource: 1,
        },
        status: 'SAVED',
      })
      const baselineExperiment = await createUcsResource(ucsTarget, 'experiments', experimentPayload(
        baselineScenario.id,
        'baseline',
        baselineDataSource.id,
        baselineDataModel.id,
        simulationConfig?.baselineValues,
      ))
      const interventionExperiment = await createUcsResource(ucsTarget, 'experiments', experimentPayload(
        interventionScenario.id,
        'intervention',
        interventionDataSource.id,
        interventionDataModel.id,
        simulationConfig?.interventionValues,
      ))

      const executionOptions = {
        timeoutMs: input.executionTimeoutMs ?? input.execution_timeout_ms,
        pollIntervalMs: input.pollIntervalMs ?? input.poll_interval_ms,
      }
      const baselineExecutionRequest = await executeUcsExperiment(ucsTarget, baselineExperiment.id)
      const baselineExecution = await waitForUcsExecution(ucsTarget, baselineExecutionRequest.executionId, executionOptions)
      const baselineParsed = entityBatchMode ? parseKserveEntityResult(baselineExecution) : null
      if (entityBatchMode) {
        assertKserveEntityResult(baselineParsed, entityBatch.records, 'baseline')
      } else if (!JSON.stringify(baselineExecution.effectiveOutput ?? {}).includes(baselineEntity.id)) {
        throw new Error('UCS_BASELINE_OUTPUT_SOURCE_ID_MISSING')
      }
      await updateStep(client, runId, 'execute-ucs-baseline', 'succeeded', {
        ...executionEvidence(baselineExecution),
        simulationSummary: baselineParsed?.summary ?? null,
      })

      const interventionExecutionRequest = await executeUcsExperiment(ucsTarget, interventionExperiment.id)
      const interventionExecution = await waitForUcsExecution(ucsTarget, interventionExecutionRequest.executionId, executionOptions)
      const interventionParsed = entityBatchMode ? parseKserveEntityResult(interventionExecution) : null
      if (entityBatchMode) {
        assertKserveEntityResult(interventionParsed, entityBatch.records, 'intervention')
        if (interventionParsed.summary.simulatedEnergyKwh >= baselineParsed.summary.simulatedEnergyKwh) {
          throw new Error('UCS_INTERVENTION_DID_NOT_REDUCE_SIMULATED_ENERGY')
        }
      } else if (!JSON.stringify(interventionExecution.effectiveOutput ?? {}).includes(interventionEntity.id)) {
        throw new Error('UCS_INTERVENTION_OUTPUT_SOURCE_ID_MISSING')
      }
      await updateStep(client, runId, 'execute-ucs-intervention', 'succeeded', {
        ...executionEvidence(interventionExecution),
        simulationSummary: interventionParsed?.summary ?? null,
      })

      const simulationEvidence = entityBatchMode
        ? {
          baseline: await persistSimulationBranch(client, {
            cityId: run.cityId,
            workflowRunId: runId,
            bindingKey,
            scenarioKind: 'baseline',
            sourceEntityId: baselineEntity.id,
            selectionSetId: baseline.selection?.id,
            execution: baselineExecution,
            parsed: baselineParsed,
            parameters: baselineParsed.parameters,
          }),
          intervention: await persistSimulationBranch(client, {
            cityId: run.cityId,
            workflowRunId: runId,
            bindingKey,
            scenarioKind: 'intervention',
            sourceEntityId: interventionEntity.id,
            selectionSetId: baseline.selection?.id,
            execution: interventionExecution,
            parsed: interventionParsed,
            parameters: interventionParsed.parameters,
          }),
          parameterIds: simulationConfig.parameterIds,
          transformDagId: simulationConfig.transformDagId,
          transformStepId: simulationConfig.transformStepId,
        }
        : null

      await updateStep(client, runId, 'persist-oldt-simulation-worlds', 'succeeded', entityBatchMode
        ? {
          baselineSimulationRunId: simulationEvidence.baseline.simulationRunId,
          interventionSimulationRunId: simulationEvidence.intervention.simulationRunId,
          entityCount: entityBatch.records.length,
          authorityStatus: 'simulated',
          canonicalMutation: false,
        }
        : {
          skipped: true,
          reason: 'Scalar metric mode retains UCS provenance without creating entity-level simulation worlds.',
          canonicalMutation: false,
        })

      const storedBinding = await upsertUcsCaseBinding(client, {
        cityId: run.cityId,
        ucsProfileKey: ucsTarget.profileKey,
        dataPlatformProfileKey: dataPlatformTarget.profileKey,
        selectionSetId: baseline.selection?.id,
        bindingKey,
        caseId: useCase.id,
        scopeId: scope.id,
        problemId: problem.id,
        objectiveId: objective.id,
        keyMetricId: keyMetric.id,
        baselineScenarioId: baselineScenario.id,
        interventionScenarioId: interventionScenario.id,
        baselineEntityId: baselineEntity.id,
        interventionEntityId: interventionEntity.id,
        baselineDataSourceId: baselineDataSource.id,
        interventionDataSourceId: interventionDataSource.id,
        baselineDataModelId: baselineDataModel.id,
        interventionDataModelId: interventionDataModel.id,
        baselineExperimentId: baselineExperiment.id,
        interventionExperimentId: interventionExperiment.id,
        baselineExecutionId: baselineExecution.id,
        interventionExecutionId: interventionExecution.id,
        baselineValue: baseline.value,
        interventionValue,
        unit,
        status: 'completed',
        baselineResult: {
          execution: executionEvidence(baselineExecution),
          simulation: simulationEvidence?.baseline ?? null,
        },
        interventionResult: {
          execution: executionEvidence(interventionExecution),
          simulation: simulationEvidence?.intervention ?? null,
        },
        sourceWorkflowRunId: runId,
        metadata: {
          caseName,
          modelNamespace,
          modelName,
          ngsiScope,
          metricSource: baseline.source,
          aggregation: baseline.aggregation,
          entityBatchMode,
          modelRecordCount: entityBatch?.records.length ?? null,
          simulation: simulationEvidence,
        },
      })
      await updateStep(client, runId, 'store-ucs-roundtrip-binding', 'succeeded', {
        bindingId: storedBinding.id,
        bindingKey,
        caseId: useCase.id,
        baselineExecutionId: baselineExecution.id,
        interventionExecutionId: interventionExecution.id,
        baselineSimulationRunId: simulationEvidence?.baseline?.simulationRunId ?? null,
        interventionSimulationRunId: simulationEvidence?.intervention?.simulationRunId ?? null,
      })

      const summary = {
        cityId: run.cityId,
        bindingId: storedBinding.id,
        bindingKey,
        ucsProfileKey: ucsTarget.profileKey,
        dataPlatformProfileKey: dataPlatformTarget.profileKey,
        ucsUrl: profileFrontendUrl(ucsTarget.profile),
        caseId: useCase.id,
        caseName,
        selectionSetId: baseline.selection?.id ?? null,
        entityBatchMode,
        modelRecordCount: entityBatch?.records.length ?? null,
        parameterIds: simulationConfig?.parameterIds ?? {},
        transformDagId: simulationConfig?.transformDagId ?? null,
        baseline: {
          value: baseline.value,
          entityId: baselineEntity.id,
          scenarioId: baselineScenario.id,
          dataSourceId: baselineDataSource.id,
          dataModelId: baselineDataModel.id,
          experimentId: baselineExperiment.id,
          executionId: baselineExecution.id,
          status: baselineExecution.status,
          simulation: simulationEvidence?.baseline ?? null,
        },
        intervention: {
          value: interventionValue,
          entityId: interventionEntity.id,
          scenarioId: interventionScenario.id,
          dataSourceId: interventionDataSource.id,
          dataModelId: interventionDataModel.id,
          experimentId: interventionExperiment.id,
          executionId: interventionExecution.id,
          status: interventionExecution.status,
          simulation: simulationEvidence?.intervention ?? null,
        },
        unit,
        modelNamespace,
        modelName,
        authorityStatus: entityBatchMode ? 'simulated' : 'integration-lab-scenario-evidence',
        modelPosture: entityBatchMode
          ? 'deterministic-laboratory-scenario-model-not-scientifically-validated'
          : 'contract-integration-model',
        publicationStatus: 'ucs-roundtrip-completed',
      }
      const specs = [
        {
          kind: 'ucs-metric-resolution',
          step: 'resolve-oldt-baseline',
          metadata: { baseline, interventionValue, interventionDeltaPercent },
        },
        {
          kind: 'ucs-data-platform-publication',
          step: 'publish-scenario-inputs',
          metadata: { baseline: baselinePublication, intervention: interventionPublication },
        },
        {
          kind: 'ucs-case-structure',
          step: 'create-ucs-scenarios',
          metadata: {
            caseId: useCase.id,
            scopeId: scope.id,
            problemId: problem.id,
            objectiveId: objective.id,
            keyMetricId: keyMetric.id,
            baselineScenarioId: baselineScenario.id,
            interventionScenarioId: interventionScenario.id,
          },
        },
        {
          kind: 'ucs-experiment-executions',
          step: 'execute-ucs-intervention',
          metadata: {
            baseline: executionEvidence(baselineExecution),
            intervention: executionEvidence(interventionExecution),
          },
        },
        ...(simulationEvidence ? [{
          kind: 'eu-ldt-ai-notebook-simulation-results',
          step: 'execute-ucs-intervention',
          metadata: simulationEvidence,
        }] : []),
        { kind: 'ucs-roundtrip-summary', step: 'write-ucs-roundtrip-artifacts', metadata: summary },
      ]
      const artifacts = []
      for (const spec of specs) {
        artifacts.push(await recordArtifact(client, {
          runId,
          stepId: steps.get(spec.step)?.id ?? null,
          cityId: run.cityId,
          artifactKind: spec.kind,
          metadata: {
            workflowRunId: runId,
            workflowKey: run.workflowKey,
            ucsProfileKey: ucsTarget.profileKey,
            dataPlatformProfileKey: dataPlatformTarget.profileKey,
            ...spec.metadata,
          },
        }))
      }
      await updateStep(client, runId, 'write-ucs-roundtrip-artifacts', 'succeeded', {
        artifactCount: artifacts.length,
        artifactKinds: artifacts.map((artifact) => artifact.artifact_kind),
        summary,
      })
      await updateRun(client, runId, 'succeeded', {
        executor: workerId,
        externalSystem: `eu-ldt-use-case-scenarios:${ucsTarget.profileKey}`,
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
    })
  } catch (error) {
    return failureResult(error, await markFailed(runId, error))
  }
}
