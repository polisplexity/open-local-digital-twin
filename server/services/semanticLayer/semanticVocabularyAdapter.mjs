export const SEMANTIC_VOCABULARY_ADAPTER_VERSION = '2026-06-26'

const SEMANTIC_CLASS_COMPATIBILITY = [
  {
    canonicalKey: 'territorialGovernance',
    runtimeClassKey: 'boundary',
    familyKey: 'boundary',
    layerKeys: ['boundary'],
    entityTypes: ['boundary'],
    aliases: ['boundary'],
    priority: 0,
  },
  {
    canonicalKey: 'mobilityNetwork',
    runtimeClassKey: 'roads',
    familyKey: 'roads',
    layerKeys: ['roads'],
    entityTypes: ['roads', 'road'],
    aliases: ['roads', 'road', 'transportationSegment', 'transportation_segment'],
    priority: 1,
  },
  {
    canonicalKey: 'greenBlue',
    runtimeClassKey: 'greenBlue',
    familyKey: 'greenBlue',
    layerKeys: ['greenBlue'],
    entityTypes: ['greenBlue', 'green_blue'],
    aliases: ['green_blue', 'green-blue', 'environmentalSystems'],
    priority: 2,
  },
  {
    canonicalKey: 'civicServices',
    runtimeClassKey: 'accessSeeds',
    familyKey: 'accessSeeds',
    layerKeys: ['civic', 'mobility', 'commerce', 'wasteSeeds', 'facilities'],
    entityTypes: ['civic', 'mobility', 'commerce', 'wasteSeeds', 'facilities'],
    aliases: ['accessSeeds', 'access-seeds', 'serviceSeeds', 'facilities'],
    priority: 3,
  },
  {
    canonicalKey: 'places',
    runtimeClassKey: 'places',
    familyKey: 'places',
    layerKeys: ['places'],
    entityTypes: ['places', 'place'],
    aliases: ['place', 'settlements'],
    priority: 4,
  },
  {
    canonicalKey: 'builtFabric',
    runtimeClassKey: 'buildings',
    familyKey: 'buildings',
    layerKeys: ['buildings'],
    entityTypes: ['buildings', 'building', 'buildingCandidateNew'],
    aliases: ['buildings', 'building', 'built-fabric', 'built_fabric'],
    priority: 5,
  },
  {
    canonicalKey: 'semanticPackOutputs',
    runtimeClassKey: 'semanticPacks',
    familyKey: 'semanticPacks',
    layerKeys: ['semanticPacks'],
    entityTypes: ['semanticPackOutput', 'semanticServiceFeature'],
    aliases: ['semanticPacks', 'semantic-pack-outputs', 'semantic_pack_outputs'],
    priority: 6,
  },
  {
    canonicalKey: 'providerEvidence',
    runtimeClassKey: 'providerOverlays',
    familyKey: 'providerOverlays',
    layerKeys: ['providerOverlays'],
    entityTypes: ['providerOverlay', 'providerEvidence'],
    aliases: ['providerOverlays', 'provider-overlays'],
    priority: 7,
  },
  {
    canonicalKey: 'landUse',
    runtimeClassKey: 'landUseCoverageGap',
    familyKey: 'landUseCoverageGap',
    layerKeys: ['unclassifiedLand'],
    entityTypes: ['unclassifiedLand'],
    aliases: ['landUseCoverageGap', 'unclassifiedLand', 'landuse', 'land-use'],
    priority: 8,
  },
]

export const DEFAULT_CANONICAL_SEMANTIC_QUERY_CLASS_KEYS = [
  'builtFabric',
  'mobilityNetwork',
  'greenBlue',
  'places',
  'civicServices',
]

export const DEFAULT_TWIN_QUERY_RUNTIME_CLASS_KEYS = [
  'buildings',
  'roads',
  'greenBlue',
  'places',
  'accessSeeds',
]

const ROWS_BY_CANONICAL = new Map()
const ROWS_BY_RUNTIME = new Map()
const ROWS_BY_NORMALIZED_ALIAS = new Map()

function normalizeLookupKey(value) {
  return String(value ?? '').trim().toLowerCase()
}

function registerAlias(alias, row) {
  const key = normalizeLookupKey(alias)
  if (!key || ROWS_BY_NORMALIZED_ALIAS.has(key)) return
  ROWS_BY_NORMALIZED_ALIAS.set(key, row)
}

for (const row of SEMANTIC_CLASS_COMPATIBILITY) {
  ROWS_BY_CANONICAL.set(row.canonicalKey, row)
  ROWS_BY_RUNTIME.set(row.runtimeClassKey, row)
  registerAlias(row.canonicalKey, row)
  registerAlias(row.runtimeClassKey, row)
  registerAlias(row.familyKey, row)
  for (const alias of row.aliases) registerAlias(alias, row)
  for (const layerKey of row.layerKeys) registerAlias(layerKey, row)
  for (const entityType of row.entityTypes) registerAlias(entityType, row)
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function maybeArray(value) {
  return Array.isArray(value) ? value : [value]
}

export function semanticClassCompatibilityRows() {
  return SEMANTIC_CLASS_COMPATIBILITY
    .map((row) => ({
      ...row,
      aliases: [...row.aliases],
      layerKeys: [...row.layerKeys],
      entityTypes: [...row.entityTypes],
    }))
    .sort((a, b) => a.priority - b.priority || a.canonicalKey.localeCompare(b.canonicalKey))
}

export function semanticClassCompatibilityForKey(value) {
  const row = ROWS_BY_NORMALIZED_ALIAS.get(normalizeLookupKey(value))
  if (!row) return null
  return {
    ...row,
    aliases: [...row.aliases],
    layerKeys: [...row.layerKeys],
    entityTypes: [...row.entityTypes],
  }
}

export function canonicalSemanticClassKey(value, fallback = '') {
  return semanticClassCompatibilityForKey(value)?.canonicalKey ?? fallback
}

export function twinQueryRuntimeClassKey(value, fallback = '') {
  return semanticClassCompatibilityForKey(value)?.runtimeClassKey ?? fallback
}

export function normalizeCanonicalSemanticClassKeys(values, {
  fallback = DEFAULT_CANONICAL_SEMANTIC_QUERY_CLASS_KEYS,
  preserveUnknown = false,
} = {}) {
  const normalized = unique(
    maybeArray(values).map((value) => {
      const canonicalKey = canonicalSemanticClassKey(value)
      if (canonicalKey) return canonicalKey
      return preserveUnknown ? String(value ?? '').trim() : ''
    }),
  )
  return normalized.length ? normalized : [...fallback]
}

export function normalizeTwinQueryRuntimeClassKeys(values, {
  fallback = DEFAULT_TWIN_QUERY_RUNTIME_CLASS_KEYS,
  preserveUnknown = false,
} = {}) {
  const normalized = unique(
    maybeArray(values).map((value) => {
      const runtimeKey = twinQueryRuntimeClassKey(value)
      if (runtimeKey) return runtimeKey
      return preserveUnknown ? String(value ?? '').trim() : ''
    }),
  )
  return normalized.length ? normalized : [...fallback]
}

export function normalizeTwinQuerySemanticClassFilterValue(value) {
  if (Array.isArray(value)) {
    return normalizeTwinQueryRuntimeClassKeys(value, {
      fallback: [],
      preserveUnknown: true,
    })
  }
  return twinQueryRuntimeClassKey(value, String(value ?? '').trim())
}

export function semanticClassLayerKeysFor(classKeys) {
  return unique(
    normalizeCanonicalSemanticClassKeys(classKeys, { fallback: [] })
      .flatMap((classKey) => ROWS_BY_CANONICAL.get(classKey)?.layerKeys ?? []),
  )
}

export function semanticClassEntityTypesFor(classKeys) {
  return unique(
    normalizeCanonicalSemanticClassKeys(classKeys, { fallback: [] })
      .flatMap((classKey) => ROWS_BY_CANONICAL.get(classKey)?.entityTypes ?? []),
  )
}

export function twinQueryRuntimeClassContractKeys() {
  return semanticClassCompatibilityRows().map((row) => row.runtimeClassKey)
}

export function semanticVocabularyContract() {
  return {
    version: SEMANTIC_VOCABULARY_ADAPTER_VERSION,
    classes: semanticClassCompatibilityRows().map((row) => ({
      canonicalKey: row.canonicalKey,
      runtimeClassKey: row.runtimeClassKey,
      familyKey: row.familyKey,
      aliases: row.aliases,
      layerKeys: row.layerKeys,
      entityTypes: row.entityTypes,
      priority: row.priority,
    })),
  }
}

export function semanticClassCaseSql(sourceExpression = 'display_layer_key') {
  const cases = []
  for (const row of semanticClassCompatibilityRows()) {
    if (!row.layerKeys.length) continue
    const values = row.layerKeys.map((layerKey) => `'${layerKey.replace(/'/g, "''")}'`).join(', ')
    cases.push(`WHEN ${sourceExpression} IN (${values}) THEN '${row.canonicalKey}'`)
  }
  return `
    CASE
      ${cases.join('\n      ')}
      ELSE ${sourceExpression}
    END
  `
}

export function canonicalSemanticClassPriorityCaseSql(columnExpression = 'semantic_class_key') {
  const cases = semanticClassCompatibilityRows()
    .map((row) => `WHEN '${row.canonicalKey}' THEN ${row.priority}`)
    .join('\n      ')
  return `
    CASE ${columnExpression}
      ${cases}
      ELSE 99
    END
  `
}

export function twinQueryRuntimeClassPriorityCaseSql(columnExpression = 'semantic_class') {
  const cases = semanticClassCompatibilityRows()
    .map((row) => `WHEN '${row.runtimeClassKey}' THEN ${row.priority}`)
    .join('\n      ')
  return `
    CASE ${columnExpression}
      ${cases}
      ELSE 99
    END
  `
}
