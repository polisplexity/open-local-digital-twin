const PACK_KEY = 'municipal-planning-compliance-pack'
const PACK_VERSION = '0.1.0'

const PACK_MANIFEST = {
  packKey: PACK_KEY,
  version: PACK_VERSION,
  name: 'Municipal Planning Compliance Pack',
  domain: 'municipal-planning-and-permitting',
  purpose: 'Prepare a dry-run municipal planning compliance layer that can accept city planning cases, zoning/rules, model evidence, and authority review workflows when those sources become available.',
  inputs: [
    'city boundary',
    'consolidated building inventory',
    'road network geometry',
    'future zoning or planning constraint layer',
    'future planning case workflow feed',
    'future municipal rules and checklist source',
    'future BIM/model submission evidence',
    'future authority decision and appeal state',
  ],
  outputs: [
    'planning readiness indicators',
    'planning context candidate features',
    'blocked compliance claims',
    'municipal planning workflow contract',
    'machine-readable planning pack export',
  ],
  claimsBlockedWithoutAuthorityEvidence: [
    'permit compliance',
    'zoning compliance',
    'allowed height or density',
    'formal planning approval',
    'construction authorization',
    'appeal or enforcement status',
  ],
  publicDataBoundary: 'Dry-run planning compliance pack. It can expose open physical context and missing-source blockers, but it must not claim permit, zoning, model, or authority compliance until municipal workflow sources are connected and validated.',
}

const REQUIRED_SOURCES = [
  {
    key: 'city-boundary',
    label: 'City boundary',
    sourceStatus: 'connected',
    requiredFor: ['planning scope', 'jurisdiction reporting', 'pack binding'],
    blockedClaims: [],
  },
  {
    key: 'building-inventory',
    label: 'Consolidated building inventory',
    sourceStatus: 'connected',
    requiredFor: ['built context', 'case neighborhood context', 'review candidate features'],
    blockedClaims: [],
  },
  {
    key: 'road-network',
    label: 'Road network geometry',
    sourceStatus: 'connected',
    requiredFor: ['access context', 'mobility adjacency context'],
    blockedClaims: [],
  },
  {
    key: 'zoning-and-planning-constraints',
    label: 'Zoning, land-use, and planning constraints',
    sourceStatus: 'missing',
    requiredFor: ['allowed use', 'height/density rules', 'restricted area checks'],
    blockedClaims: ['zoning compliance', 'allowed height or density', 'land-use compliance'],
  },
  {
    key: 'planning-case-workflow',
    label: 'Planning cases and permit workflow state',
    sourceStatus: 'missing',
    requiredFor: ['case status', 'review stage', 'submission completeness'],
    blockedClaims: ['formal planning approval', 'permit compliance', 'appeal or enforcement status'],
  },
  {
    key: 'municipal-rule-checklist',
    label: 'Municipal rule checklist and evidence requirements',
    sourceStatus: 'missing',
    requiredFor: ['checkable planning rules', 'document requirements', 'quality gates'],
    blockedClaims: ['rule compliance', 'submission completeness', 'construction authorization'],
  },
  {
    key: 'model-submission-evidence',
    label: 'BIM, IFC, or model submission evidence',
    sourceStatus: 'missing',
    requiredFor: ['model geometry review', 'design evidence', 'technical submission checks'],
    blockedClaims: ['model compliance', 'design approval', 'construction authorization'],
  },
  {
    key: 'authority-decision-state',
    label: 'Authority decision, review, and appeal state',
    sourceStatus: 'missing',
    requiredFor: ['approval state', 'review sign-off', 'appeal or enforcement state'],
    blockedClaims: ['formal planning approval', 'appeal status', 'enforcement status'],
  },
]

const PACK_RULES = [
  {
    key: 'base_spatial_context_required',
    type: 'input-validation',
    inputTypes: ['building', 'road', 'boundary'],
    outputRole: 'planning-context-readiness',
    confidenceRule: 'open base inventory can support planning context, not compliance claims',
    sourceQuality: 'open-data-derived',
    body: {
      requiredInputs: ['city boundary', 'buildings', 'roads'],
      interpretation: 'Open physical context can frame planning cases but cannot replace municipal planning records.',
    },
  },
  {
    key: 'zoning_constraints_required',
    type: 'gap-rule',
    inputTypes: ['planning_constraint', 'planning_area', 'land_use'],
    outputRole: 'zoning-compliance-blocker',
    confidenceRule: 'zoning and land-use compliance cannot be computed without city planning constraints',
    sourceQuality: 'missing-required-source',
    body: {
      requiredSource: 'municipal zoning, land-use, planning constraints, or rule polygons',
      blockedOutputs: ['zoning compliance', 'allowed use', 'height or density compliance'],
    },
  },
  {
    key: 'planning_case_workflow_required',
    type: 'gap-rule',
    inputTypes: ['planning_case', 'planning_submission'],
    outputRole: 'permit-workflow-blocker',
    confidenceRule: 'permit compliance cannot be computed without case workflow state',
    sourceQuality: 'missing-required-source',
    body: {
      requiredSource: 'planning cases, submission status, review stage, and city workflow state',
      blockedOutputs: ['permit compliance', 'review stage', 'submission completeness'],
    },
  },
  {
    key: 'municipal_rule_checklist_required',
    type: 'gap-rule',
    inputTypes: ['zoning_rule', 'planning_constraint'],
    outputRole: 'planning-rule-blocker',
    confidenceRule: 'rule checks require authority-defined checklist and evidence requirements',
    sourceQuality: 'missing-required-source',
    body: {
      requiredSource: 'municipal planning rule checklist and required evidence schema',
      blockedOutputs: ['rule compliance', 'missing document claims', 'construction authorization'],
    },
  },
  {
    key: 'model_evidence_required_for_design_checks',
    type: 'gap-rule',
    inputTypes: ['ifc_submission', 'model_package', 'model_element'],
    outputRole: 'model-evidence-blocker',
    confidenceRule: 'design/model checks require submitted model evidence',
    sourceQuality: 'missing-required-source',
    body: {
      requiredSource: 'BIM, IFC, drawing, or model package attached to the municipal case',
      blockedOutputs: ['model compliance', 'design geometry approval', 'technical design checks'],
    },
  },
  {
    key: 'authority_decision_required',
    type: 'gap-rule',
    inputTypes: ['planning_case', 'authority_decision'],
    outputRole: 'authority-decision-blocker',
    confidenceRule: 'formal approval claims require authority decision state',
    sourceQuality: 'missing-required-source',
    body: {
      requiredSource: 'authority decision, review sign-off, appeal state, or enforcement state',
      blockedOutputs: ['formal planning approval', 'appeal status', 'enforcement status'],
    },
  },
  {
    key: 'planning_context_candidate',
    type: 'classification',
    inputTypes: ['building'],
    outputRole: 'planning-review-candidate',
    confidenceRule: 'large or high built-fabric objects can be review-context candidates only',
    sourceQuality: 'open-data-context',
    body: {
      interpretation: 'Candidate features are context objects for future planning cases, not active permits or compliance findings.',
    },
  },
]

function parseNumeric(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(parseNumeric(value) * factor) / factor
}

async function computeCityMetrics(client, cityId) {
  const result = await client.query(
    `
      WITH city AS (
        SELECT id, name, country, region
        FROM ldt_core.cities
        WHERE id = $1
      ),
      boundary AS (
        SELECT ST_Area(ST_UnaryUnion(ST_Collect(geom))::geography) / 1000000.0 AS area_km2
        FROM ldt_core.city_boundaries
        WHERE city_id = $1
      ),
      entity_counts AS (
        SELECT entity_type, count(*)::int AS count
        FROM ldt_core.city_entities
        WHERE city_id = $1
        GROUP BY entity_type
      ),
      building_evidence AS (
        SELECT
          count(*)::int AS building_profile_count,
          count(*) FILTER (WHERE be.height_m IS NOT NULL OR be.levels IS NOT NULL)::int AS building_height_evidence_count,
          count(*) FILTER (WHERE be.footprint_area_m2 IS NOT NULL)::int AS building_footprint_evidence_count
        FROM ldt_core.city_entities ce
        JOIN ldt_core.building_entities be ON be.entity_id = ce.id
        WHERE ce.city_id = $1
      ),
      road_lengths AS (
        SELECT sum(ST_Length(ce.geom::geography)) / 1000.0 AS road_km
        FROM ldt_core.city_entities ce
        WHERE ce.city_id = $1
          AND ce.entity_type = 'road'
          AND ce.geom IS NOT NULL
      ),
      semantic_evidence AS (
        SELECT
          count(*) FILTER (WHERE semantic_class_key = 'planningWorkflow')::int AS planning_workflow_tag_count,
          count(*) FILTER (WHERE semantic_class_key = 'planningRules')::int AS planning_rule_tag_count,
          count(*) FILTER (WHERE semantic_class_key = 'modelEvidence')::int AS model_evidence_tag_count
        FROM ldt_semantic.entity_semantic_tags est
        JOIN ldt_core.city_entities ce ON ce.id = est.entity_id
        WHERE ce.city_id = $1
      ),
      mapping_evidence AS (
        SELECT
          count(*) FILTER (WHERE semantic_class_key = 'planningWorkflow')::int AS planning_workflow_mapping_count,
          count(*) FILTER (WHERE semantic_class_key = 'planningRules')::int AS planning_rule_mapping_count,
          count(*) FILTER (WHERE semantic_class_key = 'modelEvidence')::int AS model_evidence_mapping_count
        FROM ldt_semantic.source_semantic_mappings
        WHERE city_id = $1 OR city_id IS NULL
      )
      SELECT
        city.id,
        city.name,
        city.country,
        city.region,
        COALESCE(boundary.area_km2, 0) AS area_km2,
        COALESCE((SELECT count FROM entity_counts WHERE entity_type = 'building'), 0) AS building_count,
        COALESCE((SELECT count FROM entity_counts WHERE entity_type = 'road'), 0) AS road_count,
        COALESCE((SELECT count FROM entity_counts WHERE entity_type = 'facility'), 0) AS facility_count,
        COALESCE((SELECT count FROM entity_counts WHERE entity_type = 'place'), 0) AS place_count,
        COALESCE((SELECT count FROM entity_counts WHERE entity_type = 'land_use'), 0) AS land_use_count,
        COALESCE((SELECT building_profile_count FROM building_evidence), 0) AS building_profile_count,
        COALESCE((SELECT building_height_evidence_count FROM building_evidence), 0) AS building_height_evidence_count,
        COALESCE((SELECT building_footprint_evidence_count FROM building_evidence), 0) AS building_footprint_evidence_count,
        COALESCE((SELECT road_km FROM road_lengths), 0) AS road_km,
        COALESCE((SELECT planning_workflow_tag_count FROM semantic_evidence), 0) AS planning_workflow_tag_count,
        COALESCE((SELECT planning_rule_tag_count FROM semantic_evidence), 0) AS planning_rule_tag_count,
        COALESCE((SELECT model_evidence_tag_count FROM semantic_evidence), 0) AS model_evidence_tag_count,
        COALESCE((SELECT planning_workflow_mapping_count FROM mapping_evidence), 0) AS planning_workflow_mapping_count,
        COALESCE((SELECT planning_rule_mapping_count FROM mapping_evidence), 0) AS planning_rule_mapping_count,
        COALESCE((SELECT model_evidence_mapping_count FROM mapping_evidence), 0) AS model_evidence_mapping_count
      FROM city
      LEFT JOIN boundary ON true
    `,
    [cityId],
  )
  if (result.rowCount === 0) throw new Error(`LDT_CITY_NOT_FOUND:${cityId}`)
  return result.rows[0]
}

function sourceStatusCounts() {
  return REQUIRED_SOURCES.reduce((counts, source) => ({
    ...counts,
    [source.sourceStatus]: (counts[source.sourceStatus] || 0) + 1,
  }), {})
}

function buildIndicators(metrics) {
  const areaKm2 = parseNumeric(metrics.area_km2)
  const buildings = parseNumeric(metrics.building_count)
  const roads = parseNumeric(metrics.road_count)
  const landUse = parseNumeric(metrics.land_use_count)
  const buildingProfiles = parseNumeric(metrics.building_profile_count)
  const heightEvidence = parseNumeric(metrics.building_height_evidence_count)
  const footprintEvidence = parseNumeric(metrics.building_footprint_evidence_count)
  const roadKm = parseNumeric(metrics.road_km)
  const planningWorkflowMappings = parseNumeric(metrics.planning_workflow_mapping_count)
  const planningRuleMappings = parseNumeric(metrics.planning_rule_mapping_count)
  const modelEvidenceMappings = parseNumeric(metrics.model_evidence_mapping_count)

  const counts = sourceStatusCounts()
  const sourceScore = (
    parseNumeric(counts.connected) +
    parseNumeric(counts.available) * 0.5 +
    parseNumeric(counts.validated) * 1.25
  ) / REQUIRED_SOURCES.length
  const readiness = round(sourceScore * 100, 1)
  const heightCoverage = buildings > 0 ? round((heightEvidence / buildings) * 100, 1) : 0
  const footprintCoverage = buildings > 0 ? round((footprintEvidence / buildings) * 100, 1) : 0

  return [
    {
      key: 'pack_readiness',
      label: 'Planning pack readiness',
      value: readiness,
      unit: '%',
      quality: 'dry-run-contract',
      method: {
        formula: 'weighted source status coverage',
        sourceStatusCounts: counts,
        requiredSources: REQUIRED_SOURCES.length,
      },
    },
    {
      key: 'base_context_connected',
      label: 'Base context connected',
      value: areaKm2 > 0 && buildings > 0 && roads > 0 ? 100 : 0,
      unit: '%',
      quality: 'open-data-derived',
      method: { formula: 'city boundary + buildings + roads present' },
    },
    {
      key: 'building_inventory_assets',
      label: 'Building inventory assets',
      value: buildings,
      unit: 'buildings',
      quality: 'open-data-derived',
      method: { formula: 'count(consolidated building entities)' },
    },
    {
      key: 'building_height_evidence_coverage',
      label: 'Building height evidence coverage',
      value: heightCoverage,
      unit: '%',
      quality: heightCoverage > 0 ? 'open-data-derived' : 'open-data-gap',
      method: { formula: 'buildings with height or levels / buildings' },
    },
    {
      key: 'building_footprint_evidence_coverage',
      label: 'Building footprint evidence coverage',
      value: footprintCoverage,
      unit: '%',
      quality: footprintCoverage > 0 ? 'open-data-derived' : 'open-data-gap',
      method: { formula: 'buildings with footprint area / buildings' },
    },
    {
      key: 'road_context_km',
      label: 'Road context',
      value: round(roadKm, 2),
      unit: 'km',
      quality: 'open-data-derived',
      method: { formula: 'sum(length of road geometries)' },
    },
    {
      key: 'land_use_context_assets',
      label: 'Land-use context assets',
      value: landUse,
      unit: 'features',
      quality: landUse > 0 ? 'open-data-derived' : 'missing-required-source',
      method: { formula: 'count(land_use entities)' },
    },
    {
      key: 'planning_workflow_connected',
      label: 'Planning workflow connected',
      value: 0,
      unit: '%',
      quality: 'missing-required-source',
      method: { formula: 'municipal planning case workflow connected ? 100 : 0' },
    },
    {
      key: 'planning_rules_connected',
      label: 'Planning rules connected',
      value: 0,
      unit: '%',
      quality: 'missing-required-source',
      method: { formula: 'municipal planning rules connected ? 100 : 0' },
    },
    {
      key: 'model_evidence_connected',
      label: 'Model evidence connected',
      value: 0,
      unit: '%',
      quality: 'missing-required-source',
      method: { formula: 'BIM/IFC/model evidence connected ? 100 : 0' },
    },
    {
      key: 'authority_decision_connected',
      label: 'Authority decision connected',
      value: 0,
      unit: '%',
      quality: 'missing-required-source',
      method: { formula: 'authority decision state connected ? 100 : 0' },
    },
    {
      key: 'planning_mapping_seed_count',
      label: 'Planning mapping seeds',
      value: planningWorkflowMappings + planningRuleMappings + modelEvidenceMappings,
      unit: 'mappings',
      quality: 'registry-seed',
      method: { formula: 'count(source semantic mappings for planning workflow/rules/model evidence)' },
    },
  ].map((indicator) => ({
    ...indicator,
    valueJson: {
      cityAreaKm2: round(areaKm2, 2),
      buildingProfiles,
      sourceStatusCounts: counts,
      mappingSeeds: {
        planningWorkflowMappings,
        planningRuleMappings,
        modelEvidenceMappings,
      },
    },
  }))
}

function buildQualitySummary(metrics, indicators) {
  const readiness = indicators.find((indicator) => indicator.key === 'pack_readiness')?.value ?? 0
  return {
    readiness,
    posture: 'dry-run-contract-only',
    canShow: [
      'base planning context',
      'candidate review features',
      'missing municipal source blockers',
      'workflow handoff contract',
    ],
    cannotClaimYet: PACK_MANIFEST.claimsBlockedWithoutAuthorityEvidence,
    requiredSources: REQUIRED_SOURCES,
    openInventory: {
      buildings: parseNumeric(metrics.building_count),
      roads: parseNumeric(metrics.road_count),
      roadKm: round(metrics.road_km, 2),
      landUse: parseNumeric(metrics.land_use_count),
    },
  }
}

function buildBindingConfiguration() {
  return {
    defaultMode: 'planning-compliance-dry-run',
    featurePolicy: 'store-open-planning-context-candidates-only',
    municipalSources: 'declared-as-required-but-not-connected',
  }
}

async function refreshServiceFeatures(client, cityId, packId) {
  await client.query('DELETE FROM ldt_semantic.service_features WHERE city_id = $1 AND pack_id = $2', [cityId, packId])

  const candidates = await client.query(
    `
      INSERT INTO ldt_semantic.service_features (
        city_id,
        pack_id,
        entity_id,
        feature_key,
        service_role,
        label,
        geom,
        properties,
        quality,
        updated_at
      )
      SELECT
        ce.city_id,
        $2,
        ce.id,
        'planning-context:' || ce.stable_id,
        'planning-review-candidate',
        COALESCE(ce.label, ce.properties->>'name', be.building_type, 'Planning context candidate'),
        ce.geom,
        jsonb_build_object(
          'entityType', ce.entity_type,
          'buildingType', be.building_type,
          'useClass', be.use_class,
          'heightM', be.height_m,
          'levels', be.levels,
          'footprintAreaM2', be.footprint_area_m2,
          'packRule', 'planning_context_candidate',
          'sourceQuality', 'open-data-context',
          'authorityWarning', 'Context feature only; not a permit, case, or compliance finding.'
        ),
        'open-data-context',
        now()
      FROM ldt_core.city_entities ce
      LEFT JOIN ldt_core.building_entities be ON be.entity_id = ce.id
      WHERE ce.city_id = $1
        AND ce.entity_type = 'building'
        AND ce.geom IS NOT NULL
      ORDER BY COALESCE(be.height_m, be.levels * 3, be.footprint_area_m2 / 25, 0) DESC NULLS LAST, ce.stable_id
      LIMIT 500
      ON CONFLICT (city_id, pack_id, feature_key) DO NOTHING
    `,
    [cityId, packId],
  )

  return {
    planningReviewCandidates: candidates.rowCount,
  }
}

function buildWorkflows(metrics) {
  return [
    {
      key: 'confirm-base-planning-context',
      title: 'Confirm base planning context',
      status: 'ready-for-city-review',
      priority: 'high',
      actions: [
        'Review city boundary used for planning scope.',
        'Review open building and road context as non-authority evidence.',
        'Decide whether open context can be shown in planning conversations.',
      ],
      inputs: {
        buildings: parseNumeric(metrics.building_count),
        roads: parseNumeric(metrics.road_count),
        roadKm: round(metrics.road_km, 2),
      },
      outputs: {
        decision: 'base planning context accepted, corrected, or replaced by municipal layers',
      },
    },
    {
      key: 'connect-zoning-and-planning-rules',
      title: 'Connect zoning and planning rules',
      status: 'blocked-by-source',
      priority: 'critical',
      actions: [
        'Register zoning, land-use, protected areas, and planning constraint layers.',
        'Map rule attributes into planningRules semantic class.',
        'Define which rules are explanatory and which are checkable.',
      ],
      inputs: {
        requiredSource: 'municipal zoning and planning constraints',
      },
      outputs: {
        decision: 'rule source can be used for dry-run checks after validation',
      },
    },
    {
      key: 'connect-planning-case-workflow',
      title: 'Connect planning case workflow',
      status: 'blocked-by-source',
      priority: 'critical',
      actions: [
        'Define case identifiers and submission lifecycle states.',
        'Map workflow states into planningWorkflow semantic class.',
        'Declare which case fields are public, restricted, or authority-only.',
      ],
      inputs: {
        requiredSource: 'planning case and permit workflow feed',
      },
      outputs: {
        decision: 'case workflow can drive operational planning review',
      },
    },
    {
      key: 'define-model-evidence-interface',
      title: 'Define model evidence interface',
      status: 'blocked-by-source',
      priority: 'medium',
      actions: [
        'Choose accepted model formats such as IFC, BIM package, drawing, or mesh.',
        'Define geometry and metadata fields required for checks.',
        'Keep model evidence separated from formal approval state.',
      ],
      inputs: {
        requiredSource: 'BIM, IFC, drawing, or model package evidence',
      },
      outputs: {
        decision: 'model evidence contract ready for provider/city implementation',
      },
    },
    {
      key: 'define-authority-handoff',
      title: 'Define authority handoff and review state',
      status: 'needs-authority-design',
      priority: 'high',
      actions: [
        'Name the authority owner for planning checks.',
        'Define human review and appeal states.',
        'Define what the system may show before and after approval.',
      ],
      inputs: {
        requiredSource: 'authority decision and review state',
      },
      outputs: {
        decision: 'authority boundary and sign-off workflow documented',
      },
    },
  ]
}

function buildExportPayload({ cityId, metrics, indicators, workflows, featureCounts, ruleCheckCount }) {
  return {
    packKey: PACK_KEY,
    packVersion: PACK_VERSION,
    cityId,
    cityName: metrics.name,
    domain: PACK_MANIFEST.domain,
    purpose: PACK_MANIFEST.purpose,
    readiness: indicators.find((indicator) => indicator.key === 'pack_readiness')?.value ?? 0,
    requiredSources: REQUIRED_SOURCES,
    indicators: indicators.map((indicator) => ({
      key: indicator.key,
      value: indicator.value,
      unit: indicator.unit,
      quality: indicator.quality,
    })),
    workflows: workflows.map((workflow) => ({
      key: workflow.key,
      title: workflow.title,
      status: workflow.status,
      priority: workflow.priority,
    })),
    serviceFeatures: featureCounts,
    ruleChecks: ruleCheckCount,
    publicDataBoundary: PACK_MANIFEST.publicDataBoundary,
    blockedClaims: PACK_MANIFEST.claimsBlockedWithoutAuthorityEvidence,
    generatedAt: new Date().toISOString(),
  }
}

function buildRunSummary({ cityId, metrics, indicators, featureCounts, ruleCheckCount }) {
  return {
    cityId,
    name: metrics.name,
    packKey: PACK_KEY,
    readiness: indicators.find((indicator) => indicator.key === 'pack_readiness')?.value ?? 0,
    buildings: parseNumeric(metrics.building_count),
    roadKm: round(metrics.road_km, 2),
    serviceFeatures: parseNumeric(featureCounts.planningReviewCandidates),
    ruleChecks: ruleCheckCount,
  }
}

function normalizeRuleResult(rule) {
  if (rule.type === 'gap-rule') {
    return {
      result: 'blocked',
      severity: 'warning',
      explanation: rule.body?.requiredSource
        ? `Required source missing: ${rule.body.requiredSource}.`
        : rule.confidenceRule,
      authorityStatus: 'not-authority-approved',
      reviewState: 'needs-review',
    }
  }
  if (rule.type === 'input-validation') {
    return {
      result: 'needs-review',
      severity: 'info',
      explanation: 'Open base context exists but must be reviewed by the city before operational planning use.',
      authorityStatus: 'open-data-seed',
      reviewState: 'needs-review',
    }
  }
  return {
    result: 'generated',
    severity: 'info',
    explanation: rule.body?.interpretation || rule.confidenceRule,
    authorityStatus: 'open-data-seed',
    reviewState: 'generated',
  }
}

function ruleInputSnapshot(metrics) {
  return {
    cityId: metrics.id,
    buildings: parseNumeric(metrics.building_count),
    roads: parseNumeric(metrics.road_count),
    roadKm: round(metrics.road_km, 2),
    planningWorkflowTags: parseNumeric(metrics.planning_workflow_tag_count),
    planningRuleTags: parseNumeric(metrics.planning_rule_tag_count),
    modelEvidenceTags: parseNumeric(metrics.model_evidence_tag_count),
  }
}

export const municipalPlanningCompliancePack = {
  packKey: PACK_KEY,
  version: PACK_VERSION,
  name: 'Municipal Planning Compliance Pack',
  domain: PACK_MANIFEST.domain,
  description: 'Dry-run semantic pack for municipal planning and permitting compliance readiness. It prepares contracts and blockers before official planning sources are connected.',
  lifecycleStatus: 'draft',
  authorityStatus: 'not-authority-approved',
  bindingStatus: 'generated',
  bindingAuthorityStatus: 'open-data-seed',
  manifest: PACK_MANIFEST,
  requiredSources: REQUIRED_SOURCES,
  standardsMapping: {
    ldt: 'semantic-pack',
    ngsiLd: ['Building', 'GeoProperty', 'CivicIssueTracking'],
    dcat: 'DatasetSeries',
    fiware: 'adapter-ready',
    ogc: ['Features API candidate'],
  },
  defaultRuleValidationSchema: {
    required: ['city_id', 'entity_type', 'source_quality', 'authority_status'],
    packVersion: PACK_VERSION,
  },
  rules: PACK_RULES,
  workflowContract: {
    owningAuthority: 'Municipal planning and permitting owner',
    handoffMethod: 'authenticated-pack-report-and-authority-review-workflow',
    qualityGate: {
      mustReview: ['base planning context', 'zoning/rule sources', 'case workflow', 'authority decision states'],
      blockedClaims: PACK_MANIFEST.claimsBlockedWithoutAuthorityEvidence,
    },
    metrics: ['pack_readiness', 'base_context_connected', 'planning_workflow_connected', 'planning_rules_connected', 'model_evidence_connected', 'authority_decision_connected'],
    authorityStatus: 'not-authority-approved',
    reviewState: 'generated',
    lifecycleStatus: 'generated',
    notes: PACK_MANIFEST.publicDataBoundary,
  },
  computeCityMetrics,
  buildIndicators,
  buildQualitySummary,
  buildBindingConfiguration,
  refreshServiceFeatures,
  buildWorkflows,
  buildExportPayload,
  buildRunSummary,
  normalizeRuleResult,
  ruleInputSnapshot,
}

export default municipalPlanningCompliancePack
