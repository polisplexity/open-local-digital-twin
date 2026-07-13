import { getProductionPool } from '../postgisPool.mjs'
import { parseMaybeJson } from './repositoryUtils.mjs'

function groupByClass(rows, classField = 'semantic_class_key') {
  const grouped = {}
  for (const row of rows) {
    const classKey = row[classField]
    if (!classKey) continue
    if (!grouped[classKey]) grouped[classKey] = []
    grouped[classKey].push(row)
  }
  return grouped
}

function normalizeClass(row) {
  return {
    key: row.class_key,
    label: row.label,
    description: row.description || '',
    inventoryTier: row.inventory_tier || 'semantic',
    geometryTypes: Array.isArray(row.geometry_types) ? row.geometry_types : [],
    allowedEntityTypes: Array.isArray(row.allowed_entity_types) ? row.allowed_entity_types : [],
    authorityRequirement: row.authority_requirement || 'open-data-or-better',
    viewerDefaults: parseMaybeJson(row.viewer_defaults, {}),
    standardsMapping: parseMaybeJson(row.standards_mapping, {}),
    metadata: parseMaybeJson(row.metadata, {}),
    lifecycleStatus: row.lifecycle_status || 'generated',
  }
}

function normalizeTag(row) {
  return {
    semanticClassKey: row.semantic_class_key,
    key: row.tag_key,
    label: row.label,
    description: row.description || '',
    valueType: row.value_type || 'text',
    allowedValues: Array.isArray(row.allowed_values) ? row.allowed_values : [],
    authorityRequirement: row.authority_requirement || 'source-evidence',
    standardsMapping: parseMaybeJson(row.standards_mapping, {}),
    metadata: parseMaybeJson(row.metadata, {}),
  }
}

function normalizeMapping(row) {
  return {
    id: row.id,
    cityId: row.city_id || null,
    providerKey: row.provider_key || '',
    sourceFamily: row.source_family || '',
    sourceLayer: row.source_layer || '',
    entityType: row.entity_type || '',
    semanticClassKey: row.semantic_class_key,
    tagRules: parseMaybeJson(row.tag_rules, []),
    mappingMethod: row.mapping_method || 'configured-source-mapping',
    confidence: row.confidence || 'source-evidence',
    authorityStatus: row.authority_status || 'open-data-seed',
    lifecycleStatus: row.lifecycle_status || 'generated',
    notes: row.notes || '',
  }
}

export async function getSemanticRegistrySnapshot({ cityId = null, pool = getProductionPool() } = {}) {
  if (!pool) {
    return {
      ok: true,
      available: false,
      source: 'fallback-hardcoded-contract',
      classes: [],
      tagsByClass: {},
      sourceMappingsByClass: {},
      summary: {
        semanticClassCount: 0,
        tagDefinitionCount: 0,
        sourceMappingCount: 0,
      },
      error: 'DATABASE_URL_REQUIRED',
    }
  }

  try {
    const exists = await pool.query("SELECT to_regclass('ldt_semantic.semantic_class_registry') AS registry_table")
    if (!exists.rows[0]?.registry_table) {
      return {
        ok: true,
        available: false,
        source: 'fallback-hardcoded-contract',
        classes: [],
        tagsByClass: {},
        sourceMappingsByClass: {},
        summary: {
          semanticClassCount: 0,
          tagDefinitionCount: 0,
          sourceMappingCount: 0,
        },
        error: 'SEMANTIC_CLASS_REGISTRY_MISSING',
      }
    }

    const [classesResult, tagsResult, mappingsResult, statusResult] = await Promise.all([
      pool.query(`
        SELECT class_key, label, description, inventory_tier, geometry_types,
               allowed_entity_types, authority_requirement, viewer_defaults,
               standards_mapping, metadata, lifecycle_status
        FROM ldt_semantic.semantic_class_registry
        ORDER BY class_key
      `),
      pool.query(`
        SELECT semantic_class_key, tag_key, label, description, value_type,
               allowed_values, authority_requirement, standards_mapping, metadata
        FROM ldt_semantic.semantic_tag_definitions
        ORDER BY semantic_class_key, tag_key
      `),
      pool.query(`
        SELECT id, city_id, provider_key, source_family, source_layer, entity_type,
               semantic_class_key, tag_rules, mapping_method, confidence,
               authority_status, lifecycle_status, notes
        FROM ldt_semantic.source_semantic_mappings
        WHERE city_id IS NULL OR city_id = $1
        ORDER BY provider_key, source_family, source_layer
      `, [cityId]),
      pool.query('SELECT * FROM ldt_semantic.semantic_contract_status'),
    ])

    const classes = classesResult.rows.map(normalizeClass)
    const tags = tagsResult.rows.map(normalizeTag)
    const mappings = mappingsResult.rows.map(normalizeMapping)
    const status = statusResult.rows[0] || {}

    return {
      ok: true,
      available: true,
      source: 'ldt_semantic',
      classes,
      tagsByClass: groupByClass(tags, 'semanticClassKey'),
      sourceMappingsByClass: groupByClass(mappings, 'semanticClassKey'),
      summary: {
        semanticClassCount: Number(status.semantic_class_count ?? classes.length),
        tagDefinitionCount: Number(status.tag_definition_count ?? tags.length),
        sourceMappingCount: Number(status.source_mapping_count ?? mappings.length),
      },
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      available: false,
      source: 'fallback-hardcoded-contract',
      classes: [],
      tagsByClass: {},
      sourceMappingsByClass: {},
      summary: {
        semanticClassCount: 0,
        tagDefinitionCount: 0,
        sourceMappingCount: 0,
      },
      error: String(error?.message ?? 'SEMANTIC_REGISTRY_UNAVAILABLE'),
    }
  }
}
