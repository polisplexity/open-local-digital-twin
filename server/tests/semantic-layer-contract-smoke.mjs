import assert from 'node:assert/strict'
import pg from 'pg'
import { getProductionDatabaseUrl, productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { getSemanticRegistrySnapshot } from '../db/productionTwinStore/semanticRegistryRepository.mjs'
import { buildSemanticQueryContract } from '../services/baseTwin/viewerContracts/semanticQueryContract.mjs'

const { Client } = pg

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

const requiredTables = [
  'ldt_semantic.semantic_class_registry',
  'ldt_semantic.semantic_class_entity_type_map',
  'ldt_semantic.semantic_tag_definitions',
  'ldt_semantic.entity_semantic_tags',
  'ldt_semantic.source_semantic_mappings',
  'ldt_semantic.rule_check_results',
  'ldt_semantic.workflow_contracts',
]

const requiredClasses = [
  'builtFabric',
  'mobilityNetwork',
  'greenBlue',
  'landUse',
  'territorialGovernance',
  'utilityNetwork',
  'civicServices',
  'planningWorkflow',
  'planningRules',
  'modelEvidence',
  'geotechnicalHazard',
  'emergencyPreparedness',
  'builtFabricRisk',
  'semanticPackOutputs',
]

await runProductionMigrations()

const client = new Client({ connectionString: getProductionDatabaseUrl() })
await client.connect()

try {
  for (const tableName of requiredTables) {
    const result = await client.query('SELECT to_regclass($1) AS table_name', [tableName])
    assert.equal(result.rows[0].table_name, tableName, `SEMANTIC_CONTRACT_TABLE_MISSING:${tableName}`)
  }

  const classResult = await client.query(
    `
      SELECT class_key, inventory_tier, authority_requirement, allowed_entity_types
      FROM ldt_semantic.semantic_class_registry
      WHERE class_key = ANY($1::text[])
      ORDER BY class_key
    `,
    [requiredClasses],
  )
  assert.equal(classResult.rowCount, requiredClasses.length, `SEMANTIC_CLASS_REGISTRY_INCOMPLETE:${classResult.rowCount}`)
  assert.ok(classResult.rows.every((row) => Array.isArray(row.allowed_entity_types) && row.allowed_entity_types.length > 0), 'SEMANTIC_CLASSES_NEED_ENTITY_TYPES')

  const tagResult = await client.query(
    `
      SELECT semantic_class_key, count(*)::int AS count
      FROM ldt_semantic.semantic_tag_definitions
      WHERE semantic_class_key = ANY($1::text[])
      GROUP BY semantic_class_key
    `,
    [requiredClasses],
  )
  const tagCounts = new Map(tagResult.rows.map((row) => [row.semantic_class_key, row.count]))
  for (const classKey of ['builtFabric', 'mobilityNetwork', 'planningRules', 'geotechnicalHazard', 'emergencyPreparedness', 'builtFabricRisk', 'semanticPackOutputs']) {
    assert.ok((tagCounts.get(classKey) ?? 0) >= 1, `SEMANTIC_TAG_DEFINITION_MISSING:${classKey}`)
  }

  const sourceMappings = await client.query(
    `
      SELECT provider_key, source_family, source_layer, semantic_class_key
      FROM ldt_semantic.source_semantic_mappings
      WHERE provider_key = ANY($1::text[])
      ORDER BY provider_key, source_layer
    `,
    [['osm', 'overture', 'municipal-planning', 'urban-risk']],
  )
  assert.ok(sourceMappings.rows.some((row) => row.provider_key === 'osm' && row.semantic_class_key === 'builtFabric'), 'OSM_BUILT_FABRIC_MAPPING_MISSING')
  assert.ok(sourceMappings.rows.some((row) => row.provider_key === 'overture' && row.source_layer === 'roads' && row.semantic_class_key === 'mobilityNetwork'), 'OVERTURE_MOBILITY_ROADS_MAPPING_MISSING')
  assert.ok(sourceMappings.rows.some((row) => row.provider_key === 'municipal-planning' && row.semantic_class_key === 'planningWorkflow'), 'MUNICIPAL_PLANNING_WORKFLOW_MAPPING_MISSING')
  assert.ok(sourceMappings.rows.some((row) => row.provider_key === 'municipal-planning' && row.semantic_class_key === 'planningRules'), 'MUNICIPAL_PLANNING_RULES_MAPPING_MISSING')
  assert.ok(sourceMappings.rows.some((row) => row.provider_key === 'municipal-planning' && row.semantic_class_key === 'modelEvidence'), 'MUNICIPAL_MODEL_EVIDENCE_MAPPING_MISSING')
  assert.ok(sourceMappings.rows.some((row) => row.provider_key === 'urban-risk' && row.semantic_class_key === 'emergencyPreparedness'), 'URBAN_RISK_PREPAREDNESS_MAPPING_MISSING')
  assert.ok(sourceMappings.rows.some((row) => row.provider_key === 'urban-risk' && row.semantic_class_key === 'geotechnicalHazard'), 'URBAN_RISK_HAZARD_MAPPING_MISSING')

  const registry = await getSemanticRegistrySnapshot({ cityId: process.env.TWIN_STUDIO_E2E_CITY_ID || 'guanajuato' })
  assert.ok(registry.available, `SEMANTIC_REGISTRY_SNAPSHOT_UNAVAILABLE:${registry.error ?? 'unknown'}`)

  const contract = buildSemanticQueryContract({
    cityId: process.env.TWIN_STUDIO_E2E_CITY_ID || 'guanajuato',
    surface: 'map',
    mode: 'embedded-analyst',
    semanticRegistry: registry,
  })
  assert.ok(contract.classes.some((semanticClass) => semanticClass.key === 'builtFabric' && semanticClass.registryStatus === 'registry-linked'), 'CANONICAL_BUILT_FABRIC_CONTRACT_MISSING')
  assert.ok(contract.classes.some((semanticClass) => semanticClass.key === 'mobilityNetwork' && semanticClass.registryStatus === 'registry-linked'), 'CANONICAL_MOBILITY_CONTRACT_MISSING')
  assert.equal(contract.classes.some((semanticClass) => semanticClass.key === 'buildings'), false, 'LEGACY_BUILDINGS_CLASS_STILL_PUBLIC')

  const status = await client.query('SELECT * FROM ldt_semantic.semantic_contract_status')
  assert.ok(status.rows[0].semantic_class_count >= requiredClasses.length, 'SEMANTIC_CONTRACT_CLASS_COUNT_LOW')
  assert.ok(status.rows[0].tag_definition_count >= 20, 'SEMANTIC_CONTRACT_TAG_COUNT_LOW')
  assert.ok(status.rows[0].source_mapping_count >= 10, 'SEMANTIC_CONTRACT_SOURCE_MAPPING_COUNT_LOW')

  console.log(JSON.stringify({
    ok: true,
    contractClasses: contract.classes.map((semanticClass) => semanticClass.key),
    semanticClassCount: status.rows[0].semantic_class_count,
    tagDefinitionCount: status.rows[0].tag_definition_count,
    sourceMappingCount: status.rows[0].source_mapping_count,
    requiredClasses,
  }, null, 2))
} finally {
  await client.end()
  await closeProductionPool()
}
