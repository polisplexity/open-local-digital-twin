import { resolveSemanticPackDefinitions } from '../services/semanticPacks/catalog/semanticPackCatalog.mjs'
import {
  SEMANTIC_PACK_CONTRACT_VERSION,
  validateSemanticPackDefinition,
} from '../services/semanticPacks/contracts/semanticPackDefinitionContract.mjs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const definitions = resolveSemanticPackDefinitions({ allPacks: true })
assert(definitions.length >= 1, 'SEMANTIC_PACK_CONTRACT_NO_PACKS')

const summaries = definitions.map((definition) => {
  const validation = validateSemanticPackDefinition(definition)
  assert(validation.ok, `SEMANTIC_PACK_CONTRACT_INVALID:${definition.packKey}`)
  assert(validation.requiredSourceCount >= 1, `SEMANTIC_PACK_CONTRACT_SOURCES_EMPTY:${definition.packKey}`)
  assert(validation.sourceStatusCounts.connected >= 1, `SEMANTIC_PACK_CONTRACT_CONNECTED_SOURCE_MISSING:${definition.packKey}`)
  assert(Object.values(validation.sourceStatusCounts).reduce((sum, count) => sum + count, 0) === validation.requiredSourceCount, `SEMANTIC_PACK_CONTRACT_SOURCE_COUNT_MISMATCH:${definition.packKey}`)
  return {
    packKey: validation.packKey,
    version: validation.version,
    ruleCount: validation.ruleCount,
    requiredSourceCount: validation.requiredSourceCount,
    sourceStatusCounts: validation.sourceStatusCounts,
  }
})

const invalidDefinition = {
  ...definitions[0],
  packKey: 'invalid-pack-for-contract-smoke',
  manifest: {
    ...definitions[0].manifest,
    packKey: 'invalid-pack-for-contract-smoke',
  },
  requiredSources: [],
}

let invalidFailed = false
try {
  validateSemanticPackDefinition(invalidDefinition)
} catch (error) {
  invalidFailed = String(error?.message || '').includes('SEMANTIC_PACK_REQUIRED_SOURCES_MISSING:invalid-pack-for-contract-smoke')
}
assert(invalidFailed, 'SEMANTIC_PACK_CONTRACT_INVALID_SOURCE_SHAPE_DID_NOT_FAIL')

const missingHookDefinition = {
  ...definitions[0],
  packKey: 'missing-hook-pack-for-contract-smoke',
  manifest: {
    ...definitions[0].manifest,
    packKey: 'missing-hook-pack-for-contract-smoke',
  },
  buildExportPayload: null,
}

let hookFailed = false
try {
  validateSemanticPackDefinition(missingHookDefinition)
} catch (error) {
  hookFailed = String(error?.message || '').includes('SEMANTIC_PACK_HOOK_MISSING:missing-hook-pack-for-contract-smoke:buildExportPayload')
}
assert(hookFailed, 'SEMANTIC_PACK_CONTRACT_MISSING_HOOK_DID_NOT_FAIL')

console.log(JSON.stringify({
  ok: true,
  contractVersion: SEMANTIC_PACK_CONTRACT_VERSION,
  packCount: summaries.length,
  packs: summaries,
}, null, 2))
