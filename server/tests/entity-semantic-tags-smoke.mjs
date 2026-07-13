import assert from 'node:assert/strict'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { materializeEntitySemanticTags } from '../services/semanticLayer/entitySemanticTagMaterializer.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
const limitPerTypeArg = argValue('limit-per-type')
const entityLimitPerType = limitPerTypeArg ? Number(limitPerTypeArg) : null
if (entityLimitPerType !== null) {
  assert.ok(Number.isInteger(entityLimitPerType) && entityLimitPerType > 0, 'ENTITY_SEMANTIC_TAG_LIMIT_PER_TYPE_INVALID')
}

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

try {
  await runProductionMigrations()
  const result = await materializeEntitySemanticTags({ cityId, entityLimitPerType })

  assert.equal(result.ok, true, `ENTITY_SEMANTIC_TAG_MATERIALIZATION_FAILED:${result.error ?? 'unknown'}`)
  assert.ok(result.candidateCount > 0, 'ENTITY_SEMANTIC_TAG_CANDIDATES_EMPTY')
  assert.ok(result.activeTagCount > 0, 'ENTITY_SEMANTIC_TAGS_EMPTY')

  const builtFabric = result.tagsByClass.find((entry) => entry.semanticClassKey === 'builtFabric')
  const mobilityNetwork = result.tagsByClass.find((entry) => entry.semanticClassKey === 'mobilityNetwork')
  assert.ok(builtFabric?.count > 0, 'BUILT_FABRIC_TAGS_MISSING')
  assert.ok(mobilityNetwork?.count > 0, 'MOBILITY_NETWORK_TAGS_MISSING')

  const taggedBuildings = result.taggedEntitiesByType.find((entry) => entry.entityType === 'building' && entry.semanticClassKey === 'builtFabric')
  const taggedRoads = result.taggedEntitiesByType.find((entry) => entry.entityType === 'road' && entry.semanticClassKey === 'mobilityNetwork')
  assert.ok(taggedBuildings?.entityCount > 0, 'BUILDING_SEMANTIC_TAGS_MISSING')
  assert.ok(taggedRoads?.entityCount > 0, 'ROAD_SEMANTIC_TAGS_MISSING')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    bounded: result.bounded,
    targetEntityCount: result.targetEntityCount,
    entityLimitPerType: result.entityLimitPerType,
    candidateCount: result.candidateCount,
    inserted: result.inserted,
    updated: result.updated,
    retired: result.retired,
    activeTagCount: result.activeTagCount,
    tagsByClass: result.tagsByClass,
    taggedEntitiesByType: result.taggedEntitiesByType,
    sampleTags: result.sampleTags,
  }, null, 2))
} finally {
  await closeProductionPool()
}
