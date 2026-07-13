export const SEMANTIC_PACK_CONTRACT_VERSION = '2026-06-26.1'

export const SEMANTIC_PACK_SOURCE_STATUSES = [
  'missing',
  'available',
  'connected',
  'validated',
]

export const SEMANTIC_PACK_LIFECYCLE_STATUSES = [
  'draft',
  'generated',
  'reference-implementation',
  'validated',
  'federated',
  'authority-approved',
]

export const SEMANTIC_PACK_AUTHORITY_STATUSES = [
  'open-reference',
  'open-data-seed',
  'not-authority-approved',
  'authority-review-required',
  'authority-approved',
]

export const SEMANTIC_PACK_REVIEW_STATES = [
  'generated',
  'needs-review',
  'validated',
  'rejected',
  'authority-approved',
]

export const SEMANTIC_PACK_REQUIRED_HOOKS = [
  'computeCityMetrics',
  'buildIndicators',
  'buildQualitySummary',
  'refreshServiceFeatures',
  'buildWorkflows',
  'buildExportPayload',
]

export const SEMANTIC_PACK_OPTIONAL_HOOKS = [
  'buildBindingConfiguration',
  'buildRunSummary',
  'normalizeRuleResult',
  'ruleInputSnapshot',
]

const REQUIRED_DEFINITION_STRINGS = ['packKey', 'version', 'name', 'domain', 'description']
const REQUIRED_MANIFEST_STRINGS = ['packKey', 'version', 'name', 'domain', 'purpose', 'publicDataBoundary']
const REQUIRED_MANIFEST_ARRAYS = ['inputs', 'outputs', 'claimsBlockedWithoutAuthorityEvidence']
const REQUIRED_RULE_STRINGS = ['key', 'type', 'outputRole', 'confidenceRule', 'sourceQuality']

function compactText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function assertText(value, errorCode) {
  if (!compactText(value)) throw new Error(errorCode)
}

function assertArray(value, errorCode) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(errorCode)
}

function assertObject(value, errorCode) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(errorCode)
}

function assertOneOf(value, allowedValues, errorCode) {
  if (!allowedValues.includes(value)) throw new Error(errorCode)
}

function countBy(entries, key) {
  const counts = {}
  for (const entry of entries) {
    const value = entry?.[key] || 'unknown'
    counts[value] = (counts[value] || 0) + 1
  }
  return counts
}

function validateRequiredSources(definition) {
  assertArray(definition.requiredSources, `SEMANTIC_PACK_REQUIRED_SOURCES_MISSING:${definition.packKey}`)
  for (const source of definition.requiredSources) {
    assertText(source?.key, `SEMANTIC_PACK_REQUIRED_SOURCE_KEY_MISSING:${definition.packKey}`)
    assertText(source?.label, `SEMANTIC_PACK_REQUIRED_SOURCE_LABEL_MISSING:${definition.packKey}:${source?.key || 'unknown'}`)
    assertOneOf(
      source?.sourceStatus,
      SEMANTIC_PACK_SOURCE_STATUSES,
      `SEMANTIC_PACK_REQUIRED_SOURCE_STATUS_INVALID:${definition.packKey}:${source?.key || 'unknown'}:${source?.sourceStatus || 'missing'}`,
    )
    assertArray(source?.requiredFor, `SEMANTIC_PACK_REQUIRED_SOURCE_USE_MISSING:${definition.packKey}:${source.key}`)
    if (source.sourceStatus === 'missing') {
      assertArray(source.blockedClaims, `SEMANTIC_PACK_REQUIRED_SOURCE_BLOCKED_CLAIMS_MISSING:${definition.packKey}:${source.key}`)
    }
  }
}

function validateRules(definition) {
  assertArray(definition.rules, `SEMANTIC_PACK_RULES_MISSING:${definition.packKey}`)
  const seen = new Set()
  for (const rule of definition.rules) {
    for (const key of REQUIRED_RULE_STRINGS) {
      assertText(rule?.[key], `SEMANTIC_PACK_RULE_FIELD_MISSING:${definition.packKey}:${rule?.key || 'unknown'}:${key}`)
    }
    assertArray(rule.inputTypes, `SEMANTIC_PACK_RULE_INPUTS_MISSING:${definition.packKey}:${rule.key}`)
    assertObject(rule.body, `SEMANTIC_PACK_RULE_BODY_MISSING:${definition.packKey}:${rule.key}`)
    if (seen.has(rule.key)) throw new Error(`SEMANTIC_PACK_RULE_DUPLICATE:${definition.packKey}:${rule.key}`)
    seen.add(rule.key)
  }
}

function validateWorkflowContract(definition) {
  const contract = definition.workflowContract
  assertObject(contract, `SEMANTIC_PACK_WORKFLOW_CONTRACT_MISSING:${definition.packKey}`)
  assertText(contract.owningAuthority, `SEMANTIC_PACK_WORKFLOW_OWNER_MISSING:${definition.packKey}`)
  assertText(contract.handoffMethod, `SEMANTIC_PACK_WORKFLOW_HANDOFF_MISSING:${definition.packKey}`)
  assertObject(contract.qualityGate, `SEMANTIC_PACK_WORKFLOW_QUALITY_GATE_MISSING:${definition.packKey}`)
  assertArray(contract.metrics, `SEMANTIC_PACK_WORKFLOW_METRICS_MISSING:${definition.packKey}`)
  assertOneOf(
    contract.authorityStatus,
    SEMANTIC_PACK_AUTHORITY_STATUSES,
    `SEMANTIC_PACK_WORKFLOW_AUTHORITY_STATUS_INVALID:${definition.packKey}:${contract.authorityStatus || 'missing'}`,
  )
  assertOneOf(
    contract.reviewState,
    SEMANTIC_PACK_REVIEW_STATES,
    `SEMANTIC_PACK_WORKFLOW_REVIEW_STATE_INVALID:${definition.packKey}:${contract.reviewState || 'missing'}`,
  )
  assertOneOf(
    contract.lifecycleStatus,
    SEMANTIC_PACK_LIFECYCLE_STATUSES,
    `SEMANTIC_PACK_WORKFLOW_LIFECYCLE_STATUS_INVALID:${definition.packKey}:${contract.lifecycleStatus || 'missing'}`,
  )
}

export function validateSemanticPackDefinition(definition) {
  assertObject(definition, 'SEMANTIC_PACK_DEFINITION_INVALID')
  for (const key of REQUIRED_DEFINITION_STRINGS) {
    assertText(definition[key], `SEMANTIC_PACK_DEFINITION_MISSING:${key}`)
  }
  assertOneOf(
    definition.lifecycleStatus,
    SEMANTIC_PACK_LIFECYCLE_STATUSES,
    `SEMANTIC_PACK_LIFECYCLE_STATUS_INVALID:${definition.packKey}:${definition.lifecycleStatus || 'missing'}`,
  )
  assertOneOf(
    definition.authorityStatus,
    SEMANTIC_PACK_AUTHORITY_STATUSES,
    `SEMANTIC_PACK_AUTHORITY_STATUS_INVALID:${definition.packKey}:${definition.authorityStatus || 'missing'}`,
  )
  assertText(definition.bindingStatus, `SEMANTIC_PACK_BINDING_STATUS_MISSING:${definition.packKey}`)
  assertOneOf(
    definition.bindingAuthorityStatus,
    SEMANTIC_PACK_AUTHORITY_STATUSES,
    `SEMANTIC_PACK_BINDING_AUTHORITY_STATUS_INVALID:${definition.packKey}:${definition.bindingAuthorityStatus || 'missing'}`,
  )
  assertObject(definition.standardsMapping, `SEMANTIC_PACK_STANDARDS_MAPPING_MISSING:${definition.packKey}`)
  assertObject(definition.manifest, `SEMANTIC_PACK_MANIFEST_MISSING:${definition.packKey}`)
  for (const key of REQUIRED_MANIFEST_STRINGS) {
    assertText(definition.manifest[key], `SEMANTIC_PACK_MANIFEST_FIELD_MISSING:${definition.packKey}:${key}`)
  }
  if (definition.manifest.packKey !== definition.packKey) {
    throw new Error(`SEMANTIC_PACK_MANIFEST_KEY_MISMATCH:${definition.packKey}:${definition.manifest.packKey}`)
  }
  if (definition.manifest.version !== definition.version) {
    throw new Error(`SEMANTIC_PACK_MANIFEST_VERSION_MISMATCH:${definition.packKey}:${definition.manifest.version}`)
  }
  for (const key of REQUIRED_MANIFEST_ARRAYS) {
    assertArray(definition.manifest[key], `SEMANTIC_PACK_MANIFEST_ARRAY_MISSING:${definition.packKey}:${key}`)
  }

  validateRequiredSources(definition)
  validateRules(definition)
  validateWorkflowContract(definition)

  for (const hook of SEMANTIC_PACK_REQUIRED_HOOKS) {
    if (typeof definition[hook] !== 'function') {
      throw new Error(`SEMANTIC_PACK_HOOK_MISSING:${definition.packKey}:${hook}`)
    }
  }

  return {
    ok: true,
    contractVersion: SEMANTIC_PACK_CONTRACT_VERSION,
    packKey: definition.packKey,
    version: definition.version,
    ruleCount: definition.rules.length,
    requiredSourceCount: definition.requiredSources.length,
    sourceStatusCounts: countBy(definition.requiredSources, 'sourceStatus'),
    requiredHooks: SEMANTIC_PACK_REQUIRED_HOOKS,
    optionalHooks: SEMANTIC_PACK_OPTIONAL_HOOKS,
  }
}

export function summarizeSemanticPackDefinition(definition) {
  const validation = validateSemanticPackDefinition(definition)
  return {
    packKey: definition.packKey,
    version: definition.version,
    name: definition.name,
    domain: definition.domain,
    description: definition.description,
    lifecycleStatus: definition.lifecycleStatus,
    authorityStatus: definition.authorityStatus,
    bindingStatus: definition.bindingStatus,
    bindingAuthorityStatus: definition.bindingAuthorityStatus,
    contractVersion: validation.contractVersion,
    ruleCount: validation.ruleCount,
    requiredSources: definition.requiredSources.map((source) => ({
      key: source.key,
      label: source.label,
      sourceStatus: source.sourceStatus,
      requiredFor: source.requiredFor,
      blockedClaims: source.blockedClaims || [],
    })),
    sourceStatusCounts: validation.sourceStatusCounts,
    manifest: {
      inputs: definition.manifest.inputs || [],
      outputs: definition.manifest.outputs || [],
      publicDataBoundary: definition.manifest.publicDataBoundary,
      claimsBlockedWithoutAuthorityEvidence: definition.manifest.claimsBlockedWithoutAuthorityEvidence || [],
    },
    standardsMapping: definition.standardsMapping || {},
  }
}
