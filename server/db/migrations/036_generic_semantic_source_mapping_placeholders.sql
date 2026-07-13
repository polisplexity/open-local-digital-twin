-- Replace historical city-named placeholder mappings with generic semantic
-- module provider keys. City-specific sources should bind to these modules by
-- configuration, not by creating city-named pack contracts.
DELETE FROM ldt_semantic.source_semantic_mappings
WHERE provider_key IN ('tallinn', 'gaziantep')
  AND notes ILIKE '%placeholder%';

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
) VALUES
  ('municipal-planning','municipal-base-map','base-building-context','building','builtFabric','[{"tagKey":"building_use","sourceProperty":"use"}]','configured-source-mapping','source-evidence','open-data-seed','generated','Generic municipal base-map building mapping placeholder.',now()),
  ('municipal-planning','municipal-planning-workflow','planning-cases','planning_case','planningWorkflow','[{"tagKey":"case_status","sourceProperty":"status"}]','configured-source-mapping','partner-required','not-authority-approved','generated','Generic municipal planning workflow mapping placeholder.',now()),
  ('municipal-planning','municipal-planning-rules','planning-constraints','planning_constraint','planningRules','[{"tagKey":"rule_type","sourceProperty":"rule_type"}]','configured-source-mapping','partner-required','not-authority-approved','generated','Generic municipal planning rule mapping placeholder.',now()),
  ('municipal-planning','municipal-model-evidence','model-submissions','model_package','modelEvidence','[{"tagKey":"model_format","sourceProperty":"format"},{"tagKey":"model_status","sourceProperty":"status"}]','configured-source-mapping','partner-required','not-authority-approved','generated','Generic municipal model-evidence mapping placeholder.',now()),
  ('urban-risk','urban-risk-evidence','building-risk-assessments','building_risk_assessment','builtFabricRisk','[{"tagKey":"risk_type","sourceProperty":"risk_type"},{"tagKey":"risk_level","sourceProperty":"risk_level"}]','configured-source-mapping','partner-required','not-authority-approved','generated','Generic urban-risk building assessment mapping placeholder.',now()),
  ('urban-risk','emergency-preparedness','assembly-areas','assembly_area','emergencyPreparedness','[{"tagKey":"resource_type","constant":"assembly_area"}]','configured-source-mapping','partner-required','not-authority-approved','generated','Generic emergency assembly-area mapping placeholder.',now()),
  ('urban-risk','emergency-preparedness','shelter-areas','shelter','emergencyPreparedness','[{"tagKey":"resource_type","constant":"shelter"}]','configured-source-mapping','partner-required','not-authority-approved','generated','Generic emergency shelter-area mapping placeholder.',now()),
  ('urban-risk','hazard-evidence','hazard-lines','fault_line','geotechnicalHazard','[{"tagKey":"hazard_type","sourceProperty":"hazard_type"}]','configured-source-mapping','partner-required','not-authority-approved','generated','Generic hazard line mapping placeholder.',now())
ON CONFLICT DO NOTHING;
