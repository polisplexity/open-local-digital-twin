import {
  DEFAULT_SEMANTIC_PACK_KEYS,
  getSemanticPackCatalogSnapshot,
  getSemanticPackDefinition,
  listSemanticPackDefinitionKeys,
  listSemanticPackDefinitions,
  resolveSemanticPackDefinitions,
} from '../services/semanticPacks/catalog/semanticPackCatalog.mjs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const expectedPackKey = 'reconstruction-service-core'

const snapshot = getSemanticPackCatalogSnapshot()
assert(snapshot.ok, 'SEMANTIC_PACK_CATALOG_NOT_OK')
assert(snapshot.defaultPackKeys.includes(expectedPackKey), 'SEMANTIC_PACK_DEFAULT_KEY_MISSING')
assert(snapshot.packCount >= 1, 'SEMANTIC_PACK_CATALOG_EMPTY')

const keys = listSemanticPackDefinitionKeys()
assert(keys.includes(expectedPackKey), 'SEMANTIC_PACK_KEY_NOT_LISTED')
assert(new Set(keys).size === keys.length, 'SEMANTIC_PACK_KEYS_DUPLICATED')

const definitions = listSemanticPackDefinitions()
assert(definitions.some((definition) => definition.packKey === expectedPackKey), 'SEMANTIC_PACK_DEFINITION_NOT_LISTED')
assert(definitions.every((definition) => definition.ruleCount > 0), 'SEMANTIC_PACK_RULE_COUNT_MISSING')
assert(definitions.every((definition) => Array.isArray(definition.requiredSources) && definition.requiredSources.length > 0), 'SEMANTIC_PACK_REQUIRED_SOURCES_MISSING')
assert(definitions.every((definition) => definition.sourceStatusCounts?.connected >= 1), 'SEMANTIC_PACK_CONNECTED_SOURCE_MISSING')

const defaultDefinitions = resolveSemanticPackDefinitions()
assert(defaultDefinitions.length === DEFAULT_SEMANTIC_PACK_KEYS.length, 'SEMANTIC_PACK_DEFAULT_RESOLUTION_MISMATCH')
assert(defaultDefinitions[0].packKey === expectedPackKey, 'SEMANTIC_PACK_DEFAULT_RESOLUTION_WRONG')

const explicitDefinition = getSemanticPackDefinition(expectedPackKey)
assert(explicitDefinition.packKey === expectedPackKey, 'SEMANTIC_PACK_EXPLICIT_RESOLUTION_WRONG')
assert(explicitDefinition.manifest?.publicDataBoundary, 'SEMANTIC_PACK_PUBLIC_BOUNDARY_MISSING')
assert(Array.isArray(explicitDefinition.rules) && explicitDefinition.rules.length >= 5, 'SEMANTIC_PACK_RULES_LOW')

const allDefinitions = resolveSemanticPackDefinitions({ allPacks: true })
assert(allDefinitions.length === snapshot.packCount, 'SEMANTIC_PACK_ALL_RESOLUTION_MISMATCH')

let missingFailed = false
try {
  getSemanticPackDefinition('missing-pack')
} catch (error) {
  missingFailed = String(error?.message || '').includes('SEMANTIC_PACK_DEFINITION_NOT_FOUND:missing-pack')
}
assert(missingFailed, 'SEMANTIC_PACK_MISSING_KEY_DID_NOT_FAIL')

console.log(JSON.stringify({
  ok: true,
  defaultPackKeys: snapshot.defaultPackKeys,
  packCount: snapshot.packCount,
  packs: snapshot.packs.map((pack) => ({
    packKey: pack.packKey,
    version: pack.version,
    ruleCount: pack.ruleCount,
    requiredSourceCount: pack.requiredSources.length,
    sourceStatusCounts: pack.sourceStatusCounts,
  })),
}, null, 2))
