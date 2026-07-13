-- Align source semantic mappings with the consolidated source layers that are
-- actually linked to ldt_core.city_entities through ldt_prov.entity_source_evidence.

UPDATE ldt_semantic.source_semantic_mappings
SET
  tag_rules = '[{"tagKey":"building_use","sourceProperties":["subtype","building"]}]'::jsonb,
  notes = 'Generic Overture buildings mapping aligned to consolidated building source properties.',
  updated_at = now()
WHERE provider_key = 'overture'
  AND source_family = 'overture-maps'
  AND source_layer = 'buildings'
  AND entity_type = 'building'
  AND semantic_class_key = 'builtFabric';

INSERT INTO ldt_semantic.source_semantic_mappings (
  provider_key,
  source_family,
  source_layer,
  entity_type,
  semantic_class_key,
  tag_rules,
  mapping_method,
  confidence,
  authority_status,
  lifecycle_status,
  notes,
  updated_at
)
SELECT
  'overture',
  'overture-maps',
  'roads',
  'road',
  'mobilityNetwork',
  '[{"tagKey":"road_class","sourceProperties":["road_class","class","highway"]}]'::jsonb,
  'configured-source-mapping',
  'source-evidence',
  'open-data-seed',
  'generated',
  'Generic Overture roads mapping aligned to consolidated roads source layer.',
  now()
WHERE NOT EXISTS (
  SELECT 1
  FROM ldt_semantic.source_semantic_mappings
  WHERE city_id IS NULL
    AND provider_key = 'overture'
    AND source_family = 'overture-maps'
    AND source_layer = 'roads'
    AND entity_type = 'road'
    AND semantic_class_key = 'mobilityNetwork'
);

UPDATE ldt_semantic.source_semantic_mappings
SET
  tag_rules = '[{"tagKey":"road_class","sourceProperties":["road_class","class","highway"]}]'::jsonb,
  mapping_method = 'configured-source-mapping',
  confidence = 'source-evidence',
  authority_status = 'open-data-seed',
  lifecycle_status = 'generated',
  notes = 'Generic Overture roads mapping aligned to consolidated roads source layer.',
  updated_at = now()
WHERE city_id IS NULL
  AND provider_key = 'overture'
  AND source_family = 'overture-maps'
  AND source_layer = 'roads'
  AND entity_type = 'road'
  AND semantic_class_key = 'mobilityNetwork';

DELETE FROM ldt_semantic.source_semantic_mappings
WHERE provider_key = 'overture'
  AND source_family = 'overture-maps'
  AND source_layer = 'transportation_segment'
  AND entity_type = 'road'
  AND semantic_class_key = 'mobilityNetwork'
  AND notes ILIKE 'Generic Overture roads mapping.%';
