import { withClient } from './dbUtils.mjs'

function text(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function key(value) {
  const normalized = text(value).toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{1,128}$/.test(normalized)) throw new Error('INDICATOR_KEY_INVALID')
  return normalized
}

function json(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback
}

function definitionRow(row) {
  return {
    id: row.id,
    indicatorKey: row.indicator_key,
    kind: row.kind,
    displayName: row.name,
    description: row.definition,
    scope: row.calculation_scope,
    sourceMode: row.source_mode,
    modelKey: row.model_key,
    outputKey: row.output_key,
    unit: row.unit,
    formula: row.formula,
    target: row.target,
    cipBindingId: row.cip_binding_id,
    visualization: row.visualization,
    metadata: row.metadata,
    active: row.active,
    entityValueCount: Number(row.entity_value_count ?? 0),
    currentObservation: row.current_observation_id ? {
      id: row.current_observation_id,
      valueNumeric: row.current_value == null ? null : Number(row.current_value),
      unit: row.current_unit,
      sourceMode: row.current_source_quality,
      validationStatus: row.current_validation_status,
      authorityStatus: row.current_authority_status,
      observedAt: row.current_observed_at,
    } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const definitionSelect = `
  SELECT definition.*,
    city_observation.id AS current_observation_id,
    city_observation.value AS current_value,
    city_observation.unit AS current_unit,
    city_observation.source_quality AS current_source_quality,
    city_observation.validation_status AS current_validation_status,
    city_observation.authority_status AS current_authority_status,
    city_observation.observed_at AS current_observed_at,
    COALESCE(entity_values.entity_value_count, 0) AS entity_value_count
  FROM ldt_science.indicator_definitions definition
  LEFT JOIN LATERAL (
    SELECT observation.*
    FROM ldt_science.indicator_observations observation
    WHERE observation.indicator_id=definition.id
      AND observation.city_id=$1
      AND observation.geography_level='city'
    ORDER BY CASE observation.validation_status WHEN 'validated' THEN 0 WHEN 'candidate' THEN 1 ELSE 2 END,
      observation.observed_at DESC, observation.updated_at DESC
    LIMIT 1
  ) city_observation ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS entity_value_count
    FROM ldt_science.indicator_observations observation
    WHERE observation.indicator_id=definition.id
      AND observation.city_id=$1
      AND observation.geography_entity_id IS NOT NULL
      AND observation.validation_status='validated'
  ) entity_values ON true
`

async function definitionByKey(client, cityId, indicatorKey) {
  const result = await client.query(`${definitionSelect} WHERE definition.indicator_key=$2`, [cityId, indicatorKey])
  return result.rows[0] ?? null
}

async function materializeExternalIndicator(client, cityId, definition) {
  if (definition.source_mode !== 'external' || !definition.model_key || !definition.output_key) return 0
  const result = await client.query(`
    INSERT INTO ldt_science.indicator_observations (
      city_id, indicator_id, geography_entity_id, observation_key,
      geography_level, observed_at, value, value_json, quality, unit,
      method, source_quality, metadata, updated_at
      , authority_status, validation_status, source_ref
    )
    SELECT output.city_id, $1, output.entity_id,
      'oldt-indicator:' || output.city_id || ':' || $2 || ':entity:' || output.entity_id,
      'entity', output.generated_at, output.value_numeric,
      jsonb_build_object('value', output.value_numeric, 'modelOutputId', output.id),
      output.confidence, COALESCE(output.unit, $3),
      output.method || jsonb_build_object('modelKey', output.model_key, 'outputKey', output.output_key),
      output.authority_status,
      jsonb_build_object(
        'modelOutputId', output.id,
        'workflowRunId', output.workflow_run_id,
        'sourceArtifactId', output.source_artifact_id,
        'materializedBy', 'indicator-catalog'
      ), now(), output.authority_status,
      CASE
        WHEN lower(COALESCE(output.confidence, '')) LIKE '%lab%'
          OR lower(COALESCE(output.confidence, '')) LIKE '%smoke%'
          OR lower(COALESCE(output.model_version, '')) LIKE '%lab%'
          OR lower(COALESCE(output.model_version, '')) LIKE '%smoke%' THEN 'lab'
        WHEN lower(COALESCE(output.confidence, '')) LIKE '%synthetic%'
          OR lower(COALESCE(output.confidence, '')) LIKE '%simulated%' THEN 'simulated'
        WHEN output.authority_status IN ('authority-approved','municipal-provided','municipal-authoritative','operator-accepted','official','verified') THEN 'validated'
        ELSE 'candidate'
      END,
      'ldt_enrichment.entity_model_outputs:' || output.id
    FROM ldt_enrichment.entity_model_output_current output
    WHERE output.city_id=$4 AND output.model_key=$5 AND output.output_key=$6
      AND output.status='computed' AND output.value_numeric IS NOT NULL
    ON CONFLICT (observation_key) DO UPDATE SET
      observed_at=EXCLUDED.observed_at,
      value=EXCLUDED.value,
      value_json=EXCLUDED.value_json,
      quality=EXCLUDED.quality,
      unit=EXCLUDED.unit,
      method=EXCLUDED.method,
      source_quality=EXCLUDED.source_quality,
      authority_status=EXCLUDED.authority_status,
      validation_status=EXCLUDED.validation_status,
      source_ref=EXCLUDED.source_ref,
      metadata=EXCLUDED.metadata,
      updated_at=now()
    RETURNING id
  `, [definition.id, definition.indicator_key, definition.unit, cityId, definition.model_key, definition.output_key])
  return result.rowCount
}

export async function listIndicatorDefinitions({ cityId, active } = {}) {
  const city = text(cityId)
  if (!city) throw new Error('CITY_ID_REQUIRED')
  return withClient(async (client) => {
    const params = [city]
    const filters = []
    if (active != null) {
      params.push(active === true || active === 'true')
      filters.push(`definition.active=$${params.length}`)
    }
    const result = await client.query(`${definitionSelect}${filters.length ? ` WHERE ${filters.join(' AND ')}` : ''} ORDER BY definition.kind, definition.name`, params)
    return { ok: true, definitions: result.rows.map(definitionRow) }
  })
}

export async function upsertIndicatorDefinition(payload = {}) {
  const cityId = text(payload.cityId ?? payload.city_id)
  if (!cityId) throw new Error('CITY_ID_REQUIRED')
  const indicatorKey = key(payload.indicatorKey ?? payload.indicator_key)
  const kind = text(payload.kind, 'indicator')
  const scope = text(payload.scope, 'entity')
  const sourceMode = text(payload.sourceMode ?? payload.source_mode, 'manual')
  if (!['indicator', 'kpi'].includes(kind)) throw new Error('INDICATOR_KIND_INVALID')
  if (!['entity', 'selection', 'city'].includes(scope)) throw new Error('INDICATOR_SCOPE_INVALID')
  if (!['manual', 'autonomous', 'computed', 'external', 'cip'].includes(sourceMode)) throw new Error('INDICATOR_SOURCE_MODE_INVALID')
  const modelKey = text(payload.modelKey ?? payload.model_key)
  const outputKey = text(payload.outputKey ?? payload.output_key)
  if (sourceMode === 'external' && (!modelKey || !outputKey)) throw new Error('EXTERNAL_INDICATOR_MODEL_OUTPUT_REQUIRED')

  return withClient(async (client) => {
    const result = await client.query(`
      INSERT INTO ldt_science.indicator_definitions (
        indicator_key, name, model_family, unit, definition, method,
        standard_key, standard_version, dimension, calculation_scope,
        metadata, kind, source_mode, model_key, output_key, formula,
        target, cip_binding_id, visualization, active, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,'oldt-indicator-catalog','1.0.0',$7,$8,$9::jsonb,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::uuid,$17::jsonb,$18,now())
      ON CONFLICT (indicator_key) DO UPDATE SET
        name=EXCLUDED.name, model_family=EXCLUDED.model_family,
        unit=EXCLUDED.unit, definition=EXCLUDED.definition,
        method=EXCLUDED.method, dimension=EXCLUDED.dimension,
        calculation_scope=EXCLUDED.calculation_scope,
        metadata=EXCLUDED.metadata, kind=EXCLUDED.kind,
        source_mode=EXCLUDED.source_mode, model_key=EXCLUDED.model_key,
        output_key=EXCLUDED.output_key, formula=EXCLUDED.formula,
        target=EXCLUDED.target, cip_binding_id=EXCLUDED.cip_binding_id,
        visualization=EXCLUDED.visualization, active=EXCLUDED.active,
        updated_at=now()
      RETURNING *
    `, [
      indicatorKey,
      text(payload.displayName ?? payload.display_name, indicatorKey),
      kind,
      text(payload.unit) || null,
      text(payload.description),
      JSON.stringify({ formula: json(payload.formula), sourceMode }),
      text(payload.dimension, 'general'),
      scope,
      JSON.stringify(json(payload.metadata)),
      kind,
      sourceMode,
      modelKey,
      outputKey,
      JSON.stringify(json(payload.formula)),
      JSON.stringify(json(payload.target)),
      text(payload.cipBindingId ?? payload.cip_binding_id) || null,
      JSON.stringify(json(payload.visualization)),
      payload.active !== false,
    ])
    const materializedCount = await materializeExternalIndicator(client, cityId, result.rows[0])
    return { ok: true, definition: definitionRow(result.rows[0]), materializedCount }
  })
}

export async function listIndicatorEntityValues({ cityId, indicatorKey, comparison, value, includeCandidate = false, limit = 100 } = {}) {
  const city = text(cityId)
  const indicator = key(indicatorKey)
  return withClient(async (client) => {
    const definition = await definitionByKey(client, city, indicator)
    if (!definition) throw new Error('INDICATOR_NOT_FOUND')
    const params = [city, definition.id]
    const filters = [
      'observation.city_id=$1',
      'observation.indicator_id=$2',
      'observation.geography_entity_id IS NOT NULL',
      'observation.value IS NOT NULL',
      includeCandidate === true || includeCandidate === 'true'
        ? "observation.validation_status IN ('validated','candidate')"
        : "observation.validation_status='validated'",
    ]
    const numeric = Number(value)
    if (comparison && Number.isFinite(numeric)) {
      const operators = { gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=' }
      if (!operators[comparison]) throw new Error('INDICATOR_COMPARISON_INVALID')
      params.push(numeric)
      filters.push(`observation.value ${operators[comparison]} $${params.length}`)
    }
    params.push(Math.max(1, Math.min(Number(limit) || 100, 1000)))
    const result = await client.query(`
      SELECT observation.id AS observation_id, observation.value,
        observation.unit, observation.observed_at, observation.quality,
        observation.source_quality, observation.validation_status,
        observation.authority_status, entity.id AS entity_id,
        entity.stable_id, entity.entity_type, entity.label, entity.properties,
        ST_AsGeoJSON(entity.geom)::jsonb AS geometry
      FROM ldt_science.indicator_observations observation
      JOIN ldt_core.city_entities entity ON entity.id=observation.geography_entity_id
      WHERE ${filters.join(' AND ')}
      ORDER BY observation.value DESC NULLS LAST
      LIMIT $${params.length}
    `, params)
    return {
      ok: true,
      indicator: definitionRow(definition),
      values: result.rows.map((row) => ({
        observationId: row.observation_id,
        entityId: row.entity_id,
        stableId: row.stable_id,
        entityType: row.entity_type,
        label: row.label,
        value: Number(row.value),
        unit: row.unit,
        quality: row.quality,
        sourceQuality: row.source_quality,
        validationStatus: row.validation_status,
        authorityStatus: row.authority_status,
        observedAt: row.observed_at,
        properties: row.properties,
        geometry: row.geometry,
      })),
    }
  })
}

export async function computeIndicatorObservation({ cityId, indicatorKey, observedAt } = {}) {
  const city = text(cityId)
  const indicator = key(indicatorKey)
  return withClient(async (client) => {
    const definition = await definitionByKey(client, city, indicator)
    if (!definition) throw new Error('INDICATOR_NOT_FOUND')
    if (!['autonomous', 'computed'].includes(definition.source_mode)) throw new Error('AUTONOMOUS_INDICATOR_REQUIRED')
    const sourceKey = key(definition.formula?.sourceIndicatorKey ?? definition.formula?.source_indicator_key)
    const operation = text(definition.formula?.operation, 'avg').toLowerCase()
    if (!['avg', 'sum', 'min', 'max', 'count'].includes(operation)) throw new Error('INDICATOR_FORMULA_OPERATION_INVALID')
    const source = await definitionByKey(client, city, sourceKey)
    if (!source) throw new Error('INDICATOR_FORMULA_SOURCE_NOT_FOUND')
    const aggregate = operation === 'count' ? 'count(*)::numeric' : `${operation}(observation.value)`
    const valueResult = await client.query(`
      SELECT ${aggregate} AS value, count(*)::int AS entity_count
      FROM ldt_science.indicator_observations observation
      WHERE observation.city_id=$1 AND observation.indicator_id=$2
        AND observation.geography_entity_id IS NOT NULL
        AND observation.value IS NOT NULL
        AND observation.validation_status='validated'
    `, [city, source.id])
    const row = valueResult.rows[0]
    if (row.value == null) throw new Error('INDICATOR_FORMULA_SOURCE_EMPTY')
    const observationKey = `oldt-indicator:${city}:${definition.indicator_key}:city`
    const inserted = await client.query(`
      INSERT INTO ldt_science.indicator_observations (
        city_id, indicator_id, observation_key, geography_level,
        observed_at, value, value_json, quality, unit, method,
        source_quality, metadata, updated_at, authority_status,
        validation_status, source_ref
      ) VALUES ($1,$2,$3,'city',COALESCE($4::timestamptz,now()),$5,$6::jsonb,'computed',$7,$8::jsonb,'oldt-autonomous',$9::jsonb,now(),'oldt-computed','candidate',$10)
      ON CONFLICT (observation_key) DO UPDATE SET
        observed_at=EXCLUDED.observed_at, value=EXCLUDED.value,
        value_json=EXCLUDED.value_json, quality=EXCLUDED.quality,
        unit=EXCLUDED.unit, method=EXCLUDED.method,
        source_quality=EXCLUDED.source_quality,
        authority_status=EXCLUDED.authority_status,
        validation_status=EXCLUDED.validation_status,
        source_ref=EXCLUDED.source_ref,
        metadata=EXCLUDED.metadata, updated_at=now()
      RETURNING *
    `, [city, definition.id, observationKey, observedAt || null, row.value,
      JSON.stringify({ value: Number(row.value), entityCount: row.entity_count }),
      definition.unit || source.unit,
      JSON.stringify({ operation, sourceIndicatorKey: source.indicator_key }),
      JSON.stringify({ entityCount: row.entity_count, formulaOwner: 'oldt' }),
      `ldt_science.indicator_observations:${source.indicator_key}`])
    return { ok: true, definition: definitionRow(definition), observation: inserted.rows[0] }
  })
}

export async function syncCipIndicatorObservations({ cityId, indicatorKey } = {}) {
  const city = text(cityId)
  const indicator = key(indicatorKey)
  return withClient(async (client) => {
    const definition = await definitionByKey(client, city, indicator)
    if (!definition) throw new Error('INDICATOR_NOT_FOUND')
    if (definition.source_mode !== 'cip' || !definition.cip_binding_id) throw new Error('CIP_INDICATOR_BINDING_REQUIRED')
    const receipts = await client.query(`SELECT * FROM ldt_interop.cip_measurement_receipts WHERE city_id=$1 AND binding_id=$2 AND measure IS NOT NULL ORDER BY measure_date, last_received_at`, [city, definition.cip_binding_id])
    const inserted = []
    for (const receipt of receipts.rows) {
      const result = await client.query(`
        INSERT INTO ldt_science.indicator_observations (
          city_id, indicator_id, observation_key, geography_level,
          observed_at, value, value_json, quality, unit, method,
          source_quality, metadata, updated_at, authority_status,
          validation_status, source_ref
        ) VALUES ($1,$2,$3,'city',COALESCE($4,now()),$5,$6::jsonb,$7,$8,$9::jsonb,'cip',$10::jsonb,now(),$12,$13,$11)
        ON CONFLICT (observation_key) DO UPDATE SET
          observed_at=EXCLUDED.observed_at, value=EXCLUDED.value,
          value_json=EXCLUDED.value_json, quality=EXCLUDED.quality,
          unit=EXCLUDED.unit, method=EXCLUDED.method,
          source_quality=EXCLUDED.source_quality,
          authority_status=EXCLUDED.authority_status,
          validation_status=EXCLUDED.validation_status,
          source_ref=EXCLUDED.source_ref,
          metadata=EXCLUDED.metadata, updated_at=now()
        RETURNING *
      `, [city, definition.id,
        `oldt-indicator:${city}:${definition.indicator_key}:cip:${receipt.cip_measurement_id}`,
        receipt.measure_date, receipt.measure,
        JSON.stringify(receipt.remote_payload ?? {}),
        receipt.status || 'received', definition.unit,
        JSON.stringify({ cipBindingId: definition.cip_binding_id }),
        JSON.stringify({ cipMeasurementReceiptId: receipt.id, cipMeasurementId: receipt.cip_measurement_id }),
        `ldt_interop.cip_measurement_receipts:${receipt.id}`,
        definition.indicator_key.endsWith('.lab') ? 'integration-lab' : 'cip-received',
        definition.indicator_key.endsWith('.lab') ? 'lab' : 'candidate'])
      inserted.push(result.rows[0])
    }
    return { ok: true, definition: definitionRow(definition), importedCount: inserted.length, observations: inserted }
  })
}
