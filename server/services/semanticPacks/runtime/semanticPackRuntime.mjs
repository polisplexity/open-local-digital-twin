import { validateSemanticPackDefinition } from '../contracts/semanticPackDefinitionContract.mjs'

export { validateSemanticPackDefinition }

export const SEMANTIC_PACK_RUNTIME_VERSION = '2026-06-26.1'

function parseNumeric(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function normalizeRuleResult(rule, { indicators = [], featureCounts = {} } = {}) {
  const readiness = indicators.find((indicator) => indicator.key === 'pack_readiness')?.value ?? null
  if (rule.type === 'gap-rule') {
    return {
      result: 'blocked',
      severity: 'warning',
      explanation: rule.body?.requiredSource
        ? `Required source missing: ${rule.body.requiredSource}.`
        : compactText(rule.confidenceRule, 'Required source missing.'),
    }
  }
  if (rule.type === 'input-validation') {
    return {
      result: readiness == null || Number(readiness) <= 0 ? 'needs-review' : 'passed',
      severity: readiness == null || Number(readiness) <= 0 ? 'warning' : 'info',
      explanation: `Pack open-data readiness is ${readiness ?? 'unknown'}%.`,
    }
  }
  return {
    result: 'generated',
    severity: 'info',
    explanation: compactText(rule.body?.interpretation, rule.confidenceRule),
    inputSnapshotExtra: { featureCounts },
  }
}

async function listCityIds(client, requestedCityIds) {
  if (Array.isArray(requestedCityIds) && requestedCityIds.length > 0) return requestedCityIds
  const result = await client.query('SELECT id FROM ldt_core.cities ORDER BY id')
  return result.rows.map((row) => row.id)
}

export async function upsertSemanticPackDefinition(client, definition) {
  validateSemanticPackDefinition(definition)
  const manifest = {
    ...definition.manifest,
    runtime: {
      key: 'manifest-runtime',
      version: SEMANTIC_PACK_RUNTIME_VERSION,
      definitionKey: definition.packKey,
    },
  }
  const result = await client.query(
    `
      INSERT INTO ldt_semantic.pack_registry (
        pack_key,
        name,
        version,
        domain,
        description,
        lifecycle_status,
        authority_status,
        manifest,
        standards_mapping,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, now())
      ON CONFLICT (pack_key, version) DO UPDATE SET
        name = EXCLUDED.name,
        domain = EXCLUDED.domain,
        description = EXCLUDED.description,
        lifecycle_status = EXCLUDED.lifecycle_status,
        authority_status = EXCLUDED.authority_status,
        manifest = EXCLUDED.manifest,
        standards_mapping = EXCLUDED.standards_mapping,
        updated_at = now()
      RETURNING id
    `,
    [
      definition.packKey,
      definition.name,
      definition.version,
      definition.domain,
      definition.description,
      definition.lifecycleStatus ?? 'reference-implementation',
      definition.authorityStatus ?? 'open-reference',
      JSON.stringify(manifest),
      JSON.stringify(definition.standardsMapping ?? {}),
    ],
  )

  await client.query(
    `
      INSERT INTO public.semantic_packs (
        id,
        name,
        version,
        description,
        manifest,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        version = EXCLUDED.version,
        description = EXCLUDED.description,
        manifest = EXCLUDED.manifest,
        updated_at = now()
    `,
    [definition.packKey, definition.name, definition.version, definition.description, JSON.stringify(manifest)],
  )

  const packId = result.rows[0].id
  for (const rule of definition.rules) {
    await client.query(
      `
        INSERT INTO ldt_semantic.pack_rules (
          pack_id,
          rule_key,
          rule_type,
          input_entity_types,
          output_role,
          confidence_rule,
          validation_schema,
          rule_body,
          source_quality,
          updated_at
        )
        VALUES ($1, $2, $3, $4::text[], $5, $6, $7::jsonb, $8::jsonb, $9, now())
        ON CONFLICT (pack_id, rule_key) DO UPDATE SET
          rule_type = EXCLUDED.rule_type,
          input_entity_types = EXCLUDED.input_entity_types,
          output_role = EXCLUDED.output_role,
          confidence_rule = EXCLUDED.confidence_rule,
          validation_schema = EXCLUDED.validation_schema,
          rule_body = EXCLUDED.rule_body,
          source_quality = EXCLUDED.source_quality,
          updated_at = now()
      `,
      [
        packId,
        rule.key,
        rule.type,
        rule.inputTypes ?? [],
        rule.outputRole ?? '',
        rule.confidenceRule ?? 'open-data-seed',
        JSON.stringify(rule.validationSchema ?? definition.defaultRuleValidationSchema ?? {}),
        JSON.stringify(rule.body ?? {}),
        rule.sourceQuality ?? 'open-data-derived',
      ],
    )
  }
  return packId
}

async function upsertCityBinding(client, definition, cityId, packId, metrics, indicators) {
  const qualitySummary = definition.buildQualitySummary(metrics, indicators)
  await client.query(
    `
      INSERT INTO ldt_semantic.city_pack_bindings (
        city_id,
        pack_id,
        binding_key,
        status,
        authority_status,
        active,
        configuration,
        quality_summary,
        generated_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, true, $6::jsonb, $7::jsonb, now(), now())
      ON CONFLICT (city_id, binding_key) DO UPDATE SET
        pack_id = EXCLUDED.pack_id,
        status = EXCLUDED.status,
        authority_status = EXCLUDED.authority_status,
        active = EXCLUDED.active,
        configuration = EXCLUDED.configuration,
        quality_summary = EXCLUDED.quality_summary,
        generated_at = now(),
        updated_at = now()
    `,
    [
      cityId,
      packId,
      `${cityId}:${definition.packKey}`,
      definition.bindingStatus ?? 'generated',
      definition.bindingAuthorityStatus ?? 'open-data-seed',
      JSON.stringify(definition.buildBindingConfiguration?.(metrics, indicators) ?? definition.defaultBindingConfiguration ?? {}),
      JSON.stringify(qualitySummary),
    ],
  )
  return qualitySummary
}

async function upsertIndicators(client, cityId, packId, indicators) {
  for (const indicator of indicators) {
    await client.query(
      `
        INSERT INTO ldt_semantic.service_indicators (
          city_id,
          pack_id,
          indicator_key,
          label,
          value,
          value_json,
          unit,
          quality,
          method,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, now())
        ON CONFLICT (city_id, pack_id, indicator_key) DO UPDATE SET
          label = EXCLUDED.label,
          value = EXCLUDED.value,
          value_json = EXCLUDED.value_json,
          unit = EXCLUDED.unit,
          quality = EXCLUDED.quality,
          method = EXCLUDED.method,
          updated_at = now()
      `,
      [
        cityId,
        packId,
        indicator.key,
        indicator.label,
        indicator.value,
        JSON.stringify(indicator.valueJson ?? {}),
        indicator.unit ?? null,
        indicator.quality ?? 'open-data-derived',
        JSON.stringify(indicator.method ?? {}),
      ],
    )
  }
}

async function upsertWorkflows(client, cityId, packId, workflows) {
  for (const workflow of workflows) {
    await client.query(
      `
        INSERT INTO ldt_semantic.service_workflows (
          city_id,
          pack_id,
          workflow_key,
          title,
          workflow_status,
          priority,
          action_items,
          inputs,
          outputs,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, now())
        ON CONFLICT (city_id, pack_id, workflow_key) DO UPDATE SET
          title = EXCLUDED.title,
          workflow_status = EXCLUDED.workflow_status,
          priority = EXCLUDED.priority,
          action_items = EXCLUDED.action_items,
          inputs = EXCLUDED.inputs,
          outputs = EXCLUDED.outputs,
          updated_at = now()
      `,
      [
        cityId,
        packId,
        workflow.key,
        workflow.title,
        workflow.status,
        workflow.priority,
        JSON.stringify(workflow.actions ?? workflow.actionItems ?? []),
        JSON.stringify(workflow.inputs ?? {}),
        JSON.stringify(workflow.outputs ?? {}),
      ],
    )
  }
}

async function upsertWorkflowContracts(client, definition, cityId, packId, workflows) {
  const contractDefaults = definition.workflowContract ?? {}
  for (const workflow of workflows) {
    await client.query(
      `
        INSERT INTO ldt_semantic.workflow_contracts (
          contract_key,
          city_id,
          pack_id,
          workflow_name,
          owning_authority,
          workflow_stage,
          supported_decision,
          input_requirements,
          output_artifacts,
          handoff_method,
          quality_gate,
          metrics,
          authority_status,
          review_state,
          lifecycle_status,
          notes,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11::jsonb, $12::jsonb, $13, $14, $15, $16, now())
        ON CONFLICT (contract_key) DO UPDATE SET
          city_id = EXCLUDED.city_id,
          pack_id = EXCLUDED.pack_id,
          workflow_name = EXCLUDED.workflow_name,
          owning_authority = EXCLUDED.owning_authority,
          workflow_stage = EXCLUDED.workflow_stage,
          supported_decision = EXCLUDED.supported_decision,
          input_requirements = EXCLUDED.input_requirements,
          output_artifacts = EXCLUDED.output_artifacts,
          handoff_method = EXCLUDED.handoff_method,
          quality_gate = EXCLUDED.quality_gate,
          metrics = EXCLUDED.metrics,
          authority_status = EXCLUDED.authority_status,
          review_state = EXCLUDED.review_state,
          lifecycle_status = EXCLUDED.lifecycle_status,
          notes = EXCLUDED.notes,
          updated_at = now()
      `,
      [
        `${cityId}:${definition.packKey}:${workflow.key}`,
        cityId,
        packId,
        workflow.title,
        workflow.owningAuthority ?? contractDefaults.owningAuthority ?? 'Municipal owner pending',
        workflow.status ?? 'proposed',
        workflow.outputs?.decision ?? workflow.supportedDecision ?? contractDefaults.supportedDecision ?? '',
        JSON.stringify(workflow.inputRequirements ?? contractDefaults.inputRequirements ?? workflow.inputs ?? []),
        JSON.stringify(workflow.outputArtifacts ?? contractDefaults.outputArtifacts ?? workflow.outputs ?? []),
        workflow.handoffMethod ?? contractDefaults.handoffMethod ?? 'pack-report-review',
        JSON.stringify(workflow.qualityGate ?? contractDefaults.qualityGate ?? {}),
        JSON.stringify(workflow.metrics ?? contractDefaults.metrics ?? []),
        workflow.authorityStatus ?? contractDefaults.authorityStatus ?? 'not-authority-approved',
        workflow.reviewState ?? contractDefaults.reviewState ?? 'generated',
        workflow.lifecycleStatus ?? contractDefaults.lifecycleStatus ?? 'generated',
        workflow.notes ?? contractDefaults.notes ?? '',
      ],
    )
  }
}

async function refreshRuleCheckResults(client, definition, cityId, packId, metrics, indicators, featureCounts) {
  const packRunKey = `${definition.packKey}:latest`
  await client.query(
    'DELETE FROM ldt_semantic.rule_check_results WHERE city_id = $1 AND pack_id = $2 AND pack_run_key = $3',
    [cityId, packId, packRunKey],
  )
  for (const rule of definition.rules) {
    const normalized = definition.normalizeRuleResult?.(rule, { metrics, indicators, featureCounts }) ??
      normalizeRuleResult(rule, { indicators, featureCounts })
    await client.query(
      `
        INSERT INTO ldt_semantic.rule_check_results (
          city_id,
          pack_id,
          pack_run_key,
          rule_key,
          result,
          severity,
          explanation,
          input_snapshot,
          authority_status,
          review_state,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, now())
      `,
      [
        cityId,
        packId,
        packRunKey,
        rule.key,
        normalized.result ?? 'generated',
        normalized.severity ?? 'info',
        normalized.explanation ?? rule.confidenceRule ?? '',
        JSON.stringify({
          packKey: definition.packKey,
          packVersion: definition.version,
          ruleType: rule.type,
          outputRole: rule.outputRole,
          sourceQuality: rule.sourceQuality,
          metrics: definition.ruleInputSnapshot?.(metrics) ?? metrics,
          indicators: indicators.map((indicator) => ({ key: indicator.key, value: indicator.value, quality: indicator.quality })),
          ...(normalized.inputSnapshotExtra ?? {}),
        }),
        normalized.authorityStatus ?? rule.authorityStatus ?? definition.bindingAuthorityStatus ?? 'open-data-seed',
        normalized.reviewState ?? 'generated',
      ],
    )
  }
  return definition.rules.length
}

async function upsertExport(client, definition, cityId, packId, payload) {
  await client.query(
    `
      INSERT INTO ldt_semantic.pack_exports (
        city_id,
        pack_id,
        export_key,
        export_format,
        payload,
        generated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, now())
      ON CONFLICT (city_id, pack_id, export_key) DO UPDATE SET
        export_format = EXCLUDED.export_format,
        payload = EXCLUDED.payload,
        generated_at = now()
    `,
    [
      cityId,
      packId,
      `${definition.packKey}:summary`,
      definition.exportFormat ?? 'application/json',
      JSON.stringify(payload),
    ],
  )
}

export async function runSemanticPackDefinition(client, definition, { cityIds = [] } = {}) {
  validateSemanticPackDefinition(definition)
  const packId = await upsertSemanticPackDefinition(client, definition)
  const ids = await listCityIds(client, cityIds)
  const cities = []

  for (const cityId of ids) {
    const metrics = await definition.computeCityMetrics(client, cityId)
    const indicators = definition.buildIndicators(metrics)
    const workflows = definition.buildWorkflows(metrics, indicators)
    await upsertCityBinding(client, definition, cityId, packId, metrics, indicators)
    await upsertIndicators(client, cityId, packId, indicators)
    const featureCounts = await definition.refreshServiceFeatures(client, cityId, packId)
    await upsertWorkflows(client, cityId, packId, workflows)
    await upsertWorkflowContracts(client, definition, cityId, packId, workflows)
    const ruleCheckCount = await refreshRuleCheckResults(client, definition, cityId, packId, metrics, indicators, featureCounts)
    const exportPayload = definition.buildExportPayload({ cityId, metrics, indicators, workflows, featureCounts, ruleCheckCount })
    await upsertExport(client, definition, cityId, packId, exportPayload)

    cities.push(definition.buildRunSummary?.({ cityId, metrics, indicators, workflows, featureCounts, ruleCheckCount }) ?? {
      cityId,
      packKey: definition.packKey,
      readiness: indicators.find((indicator) => indicator.key === 'pack_readiness')?.value ?? 0,
      indicators: indicators.length,
      workflows: workflows.length,
      serviceFeatures: parseNumeric(featureCounts?.criticalAnchors) + parseNumeric(featureCounts?.accessSpines),
      ruleChecks: ruleCheckCount,
    })
  }

  return {
    ok: true,
    runtime: {
      key: 'manifest-runtime',
      version: SEMANTIC_PACK_RUNTIME_VERSION,
    },
    packKey: definition.packKey,
    packVersion: definition.version,
    ruleCount: definition.rules.length,
    cityCount: cities.length,
    cities,
  }
}

export async function getSemanticPackReport(client, cityId, packKey) {
  const packResult = await client.query(
    `
      SELECT
        p.id,
        p.pack_key,
        p.name,
        p.version,
        p.domain,
        p.description,
        p.lifecycle_status,
        p.authority_status,
        p.manifest,
        p.standards_mapping,
        b.binding_key,
        b.status AS binding_status,
        b.quality_summary,
        b.generated_at
      FROM ldt_semantic.pack_registry p
      JOIN ldt_semantic.city_pack_bindings b ON b.pack_id = p.id
      WHERE b.city_id = $1
        AND p.pack_key = $2
        AND b.active = true
      ORDER BY p.version DESC
      LIMIT 1
    `,
    [cityId, packKey],
  )
  if (packResult.rowCount === 0) throw new Error(`LDT_SEMANTIC_PACK_NOT_FOUND:${cityId}:${packKey}`)

  const pack = packResult.rows[0]
  const rules = await client.query(
    `
      SELECT rule_key, rule_type, input_entity_types, output_role, confidence_rule, source_quality, rule_body
      FROM ldt_semantic.pack_rules
      WHERE pack_id = $1
      ORDER BY rule_key
    `,
    [pack.id],
  )
  const indicators = await client.query(
    `
      SELECT indicator_key, label, value, value_json, unit, quality, method, updated_at
      FROM ldt_semantic.service_indicators
      WHERE city_id = $1 AND pack_id = $2
      ORDER BY indicator_key
    `,
    [cityId, pack.id],
  )
  const workflows = await client.query(
    `
      SELECT workflow_key, title, workflow_status, priority, action_items, inputs, outputs, updated_at
      FROM ldt_semantic.service_workflows
      WHERE city_id = $1 AND pack_id = $2
      ORDER BY
        CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        workflow_key
    `,
    [cityId, pack.id],
  )
  const workflowContracts = await client.query(
    `
      SELECT contract_key, workflow_name, owning_authority, workflow_stage, supported_decision,
             handoff_method, quality_gate, metrics, authority_status, review_state, lifecycle_status, updated_at
      FROM ldt_semantic.workflow_contracts
      WHERE city_id = $1 AND pack_id = $2
      ORDER BY contract_key
    `,
    [cityId, pack.id],
  )
  const ruleChecks = await client.query(
    `
      SELECT rule_key, result, severity, explanation, input_snapshot, authority_status, review_state, updated_at
      FROM ldt_semantic.rule_check_results
      WHERE city_id = $1 AND pack_id = $2 AND pack_run_key = $3
      ORDER BY rule_key
    `,
    [cityId, pack.id, `${pack.pack_key}:latest`],
  )
  const features = await client.query(
    `
      SELECT service_role, quality, count(*)::int AS count
      FROM ldt_semantic.service_features
      WHERE city_id = $1 AND pack_id = $2
      GROUP BY service_role, quality
      ORDER BY service_role, quality
    `,
    [cityId, pack.id],
  )
  const exportResult = await client.query(
    `
      SELECT export_key, export_format, payload, generated_at
      FROM ldt_semantic.pack_exports
      WHERE city_id = $1 AND pack_id = $2
      ORDER BY generated_at DESC
      LIMIT 1
    `,
    [cityId, pack.id],
  )

  return {
    ok: true,
    cityId,
    runtime: pack.manifest?.runtime ?? null,
    pack: {
      key: pack.pack_key,
      name: pack.name,
      version: pack.version,
      domain: pack.domain,
      description: pack.description,
      lifecycleStatus: pack.lifecycle_status,
      authorityStatus: pack.authority_status,
      manifest: pack.manifest,
      standardsMapping: pack.standards_mapping,
    },
    binding: {
      key: pack.binding_key,
      status: pack.binding_status,
      qualitySummary: pack.quality_summary,
      generatedAt: pack.generated_at,
    },
    rules: rules.rows.map((row) => ({
      key: row.rule_key,
      type: row.rule_type,
      inputEntityTypes: row.input_entity_types,
      outputRole: row.output_role,
      confidenceRule: row.confidence_rule,
      sourceQuality: row.source_quality,
      body: row.rule_body,
    })),
    ruleChecks: ruleChecks.rows.map((row) => ({
      key: row.rule_key,
      result: row.result,
      severity: row.severity,
      explanation: row.explanation,
      inputSnapshot: row.input_snapshot,
      authorityStatus: row.authority_status,
      reviewState: row.review_state,
      updatedAt: row.updated_at,
    })),
    indicators: indicators.rows.map((row) => ({
      key: row.indicator_key,
      label: row.label,
      value: row.value === null ? null : parseNumeric(row.value),
      valueJson: row.value_json,
      unit: row.unit,
      quality: row.quality,
      method: row.method,
      updatedAt: row.updated_at,
    })),
    workflows: workflows.rows.map((row) => ({
      key: row.workflow_key,
      title: row.title,
      status: row.workflow_status,
      priority: row.priority,
      actionItems: row.action_items,
      inputs: row.inputs,
      outputs: row.outputs,
      updatedAt: row.updated_at,
    })),
    workflowContracts: workflowContracts.rows.map((row) => ({
      key: row.contract_key,
      name: row.workflow_name,
      owningAuthority: row.owning_authority,
      stage: row.workflow_stage,
      supportedDecision: row.supported_decision,
      handoffMethod: row.handoff_method,
      qualityGate: row.quality_gate,
      metrics: row.metrics,
      authorityStatus: row.authority_status,
      reviewState: row.review_state,
      lifecycleStatus: row.lifecycle_status,
      updatedAt: row.updated_at,
    })),
    serviceFeatureSummary: features.rows.map((row) => ({
      role: row.service_role,
      quality: row.quality,
      count: row.count,
    })),
    latestExport: exportResult.rows[0]
      ? {
          key: exportResult.rows[0].export_key,
          format: exportResult.rows[0].export_format,
          payload: exportResult.rows[0].payload,
          generatedAt: exportResult.rows[0].generated_at,
        }
      : null,
  }
}
