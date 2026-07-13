import assert from 'node:assert/strict'
import {
  canonicalSemanticClassKey,
  normalizeCanonicalSemanticClassKeys,
  normalizeTwinQueryRuntimeClassKeys,
  normalizeTwinQuerySemanticClassFilterValue,
  semanticClassCaseSql,
  semanticVocabularyContract,
  twinQueryRuntimeClassKey,
} from '../services/semanticLayer/semanticVocabularyAdapter.mjs'
import {
  compileTwinQueryWhere,
  normalizeTwinQuery,
  twinQueryContract,
} from '../services/twinQuery/twinQueryCompiler.mjs'
import { buildSemanticQueryContract } from '../services/baseTwin/viewerContracts/semanticQueryContract.mjs'

const params = []
const addParam = (value) => {
  params.push(value)
  return `$${params.length}`
}

assert.equal(canonicalSemanticClassKey('buildings'), 'builtFabric', 'BUILDINGS_CANONICAL_ALIAS_MISSING')
assert.equal(canonicalSemanticClassKey('builtFabric'), 'builtFabric', 'BUILT_FABRIC_CANONICAL_MISSING')
assert.equal(twinQueryRuntimeClassKey('builtFabric'), 'buildings', 'BUILT_FABRIC_RUNTIME_ALIAS_MISSING')
assert.equal(twinQueryRuntimeClassKey('mobilityNetwork'), 'roads', 'MOBILITY_RUNTIME_ALIAS_MISSING')
assert.deepEqual(
  normalizeCanonicalSemanticClassKeys(['buildings', 'roads', 'accessSeeds'], { fallback: [] }),
  ['builtFabric', 'mobilityNetwork', 'civicServices'],
  'CANONICAL_CLASS_NORMALIZATION_FAILED',
)
assert.deepEqual(
  normalizeTwinQueryRuntimeClassKeys(['builtFabric', 'mobilityNetwork', 'civicServices'], { fallback: [] }),
  ['buildings', 'roads', 'accessSeeds'],
  'RUNTIME_CLASS_NORMALIZATION_FAILED',
)
assert.deepEqual(
  normalizeTwinQuerySemanticClassFilterValue(['builtFabric', 'roads']),
  ['buildings', 'roads'],
  'SEMANTIC_FILTER_ARRAY_NORMALIZATION_FAILED',
)

const normalizedTwinQuery = normalizeTwinQuery({
  language: 'twinql-json',
  classes: ['builtFabric', 'mobilityNetwork'],
  scope: { key: 'city' },
  render: { mode: 'count' },
})
assert.deepEqual(normalizedTwinQuery.classes, ['buildings', 'roads'], 'TWIN_QUERY_CLASSES_NOT_RUNTIME_NORMALIZED')

const whereSql = compileTwinQueryWhere({
  op: 'in',
  args: [{ property: 'semantic_class' }, ['builtFabric', 'mobilityNetwork']],
}, addParam)
assert.match(whereSql, /co\.semantic_class = ANY\(\$1::text\[\]\)/, 'SEMANTIC_CLASS_FILTER_SQL_MISSING')
assert.deepEqual(params[0], ['buildings', 'roads'], 'SEMANTIC_CLASS_FILTER_PARAM_NOT_RUNTIME_NORMALIZED')

const contract = twinQueryContract()
assert.ok(contract.classes.includes('buildings'), 'TWIN_QUERY_RUNTIME_BUILDINGS_MISSING')
assert.ok(contract.semanticVocabulary.classes.some((entry) =>
  entry.canonicalKey === 'builtFabric' && entry.runtimeClassKey === 'buildings'
), 'TWIN_QUERY_VOCABULARY_COMPAT_MISSING')

const semanticContract = buildSemanticQueryContract({ cityId: 'guanajuato', surface: 'map' })
assert.equal(
  semanticContract.classes.some((entry) => entry.key === 'buildings'),
  false,
  'SEMANTIC_CONTRACT_EXPOSED_LEGACY_BUILDINGS',
)
assert.ok(semanticContract.classes.some((entry) =>
  entry.key === 'builtFabric' && entry.compatibility?.runtimeClassKey === 'buildings'
), 'SEMANTIC_CONTRACT_COMPAT_MISSING')

const caseSql = semanticClassCaseSql('display_layer_key')
assert.match(caseSql, /THEN 'builtFabric'/, 'CANONICAL_CASE_BUILT_FABRIC_MISSING')
assert.match(caseSql, /THEN 'mobilityNetwork'/, 'CANONICAL_CASE_MOBILITY_MISSING')

console.log(JSON.stringify({
  ok: true,
  semanticVocabularyVersion: semanticVocabularyContract().version,
  twinQueryClasses: contract.classes,
  semanticContractClasses: semanticContract.classes.map((entry) => entry.key),
}, null, 2))
