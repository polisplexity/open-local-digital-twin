import {
  summarizeSemanticPackDefinition,
  validateSemanticPackDefinition,
} from '../contracts/semanticPackDefinitionContract.mjs'
import { municipalPlanningCompliancePack } from '../definitions/municipalPlanningCompliancePack.mjs'
import { reconstructionServiceCorePack } from '../definitions/reconstructionServiceCore.mjs'
import { urbanRiskPreparednessPack } from '../definitions/urbanRiskPreparednessPack.mjs'

export const DEFAULT_SEMANTIC_PACK_KEYS = ['reconstruction-service-core']

const PACK_DEFINITIONS = [
  reconstructionServiceCorePack,
  municipalPlanningCompliancePack,
  urbanRiskPreparednessPack,
]

function normalizePackKey(packKey) {
  return String(packKey || '').trim()
}

function normalizePackKeys(packKeys) {
  if (!packKeys) return []
  const entries = Array.isArray(packKeys) ? packKeys : [packKeys]
  return entries
    .flatMap((entry) => String(entry || '').split(','))
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function assertValidCatalogDefinition(definition) {
  validateSemanticPackDefinition(definition)
}

function buildCatalog(definitions) {
  const byKey = new Map()
  for (const definition of definitions) {
    assertValidCatalogDefinition(definition)
    const key = normalizePackKey(definition.packKey)
    if (byKey.has(key)) throw new Error(`SEMANTIC_PACK_DEFINITION_DUPLICATE:${key}`)
    byKey.set(key, definition)
  }
  return byKey
}

const PACK_DEFINITIONS_BY_KEY = buildCatalog(PACK_DEFINITIONS)

export function listSemanticPackDefinitions() {
  return PACK_DEFINITIONS.map((definition) => summarizeSemanticPackDefinition(definition))
}

export function listSemanticPackDefinitionKeys() {
  return Array.from(PACK_DEFINITIONS_BY_KEY.keys())
}

export function getSemanticPackDefinition(packKey) {
  const key = normalizePackKey(packKey)
  if (!key) throw new Error('SEMANTIC_PACK_KEY_REQUIRED')
  const definition = PACK_DEFINITIONS_BY_KEY.get(key)
  if (!definition) throw new Error(`SEMANTIC_PACK_DEFINITION_NOT_FOUND:${key}`)
  return definition
}

export function resolveSemanticPackDefinitions({
  packKeys = DEFAULT_SEMANTIC_PACK_KEYS,
  allPacks = false,
} = {}) {
  const keys = allPacks ? listSemanticPackDefinitionKeys() : normalizePackKeys(packKeys)
  const resolvedKeys = keys.length > 0 ? keys : DEFAULT_SEMANTIC_PACK_KEYS
  const uniqueKeys = Array.from(new Set(resolvedKeys))
  return uniqueKeys.map((packKey) => getSemanticPackDefinition(packKey))
}

export function getSemanticPackCatalogSnapshot() {
  return {
    ok: true,
    defaultPackKeys: DEFAULT_SEMANTIC_PACK_KEYS,
    packCount: PACK_DEFINITIONS.length,
    packs: listSemanticPackDefinitions(),
  }
}
