CREATE TABLE IF NOT EXISTS ldt_semantic.semantic_class_registry (
  class_key text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  inventory_tier text NOT NULL DEFAULT 'semantic',
  geometry_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  allowed_entity_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  authority_requirement text NOT NULL DEFAULT 'open-data-or-better',
  viewer_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  standards_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  lifecycle_status text NOT NULL DEFAULT 'generated',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_semantic.semantic_class_entity_type_map (
  class_key text NOT NULL REFERENCES ldt_semantic.semantic_class_registry(class_key) ON DELETE CASCADE,
  entity_type text NOT NULL,
  mapping_role text NOT NULL DEFAULT 'accepted-input',
  required boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_key, entity_type, mapping_role)
);

CREATE TABLE IF NOT EXISTS ldt_semantic.semantic_tag_definitions (
  semantic_class_key text NOT NULL REFERENCES ldt_semantic.semantic_class_registry(class_key) ON DELETE CASCADE,
  tag_key text NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  value_type text NOT NULL DEFAULT 'text',
  allowed_values text[] NOT NULL DEFAULT ARRAY[]::text[],
  authority_requirement text NOT NULL DEFAULT 'source-evidence',
  standards_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (semantic_class_key, tag_key)
);

CREATE TABLE IF NOT EXISTS ldt_semantic.entity_semantic_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  semantic_class_key text NOT NULL,
  tag_key text NOT NULL,
  tag_value text,
  value_type text NOT NULL DEFAULT 'text',
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_feature_id uuid REFERENCES ldt_prov.source_features(id) ON DELETE SET NULL,
  method text NOT NULL DEFAULT 'source-mapping',
  confidence text NOT NULL DEFAULT 'source-evidence',
  authority_status text NOT NULL DEFAULT 'open-data-seed',
  review_state text NOT NULL DEFAULT 'generated',
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (semantic_class_key, tag_key)
    REFERENCES ldt_semantic.semantic_tag_definitions(semantic_class_key, tag_key)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ldt_semantic_entity_tags_entity_idx ON ldt_semantic.entity_semantic_tags (entity_id);
CREATE INDEX IF NOT EXISTS ldt_semantic_entity_tags_class_tag_idx ON ldt_semantic.entity_semantic_tags (semantic_class_key, tag_key);
CREATE INDEX IF NOT EXISTS ldt_semantic_entity_tags_source_idx ON ldt_semantic.entity_semantic_tags (source_feature_id);
CREATE UNIQUE INDEX IF NOT EXISTS ldt_semantic_entity_tags_active_uniq
  ON ldt_semantic.entity_semantic_tags (entity_id, semantic_class_key, tag_key, COALESCE(tag_value, ''), method)
  WHERE valid_to IS NULL;

CREATE TABLE IF NOT EXISTS ldt_semantic.source_semantic_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  provider_key text NOT NULL DEFAULT '',
  source_family text NOT NULL,
  source_layer text NOT NULL,
  source_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  entity_type text NOT NULL,
  semantic_class_key text NOT NULL REFERENCES ldt_semantic.semantic_class_registry(class_key) ON DELETE RESTRICT,
  tag_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  mapping_method text NOT NULL DEFAULT 'configured-source-mapping',
  confidence text NOT NULL DEFAULT 'source-evidence',
  authority_status text NOT NULL DEFAULT 'open-data-seed',
  lifecycle_status text NOT NULL DEFAULT 'generated',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ldt_semantic_source_mappings_city_idx ON ldt_semantic.source_semantic_mappings (city_id);
CREATE INDEX IF NOT EXISTS ldt_semantic_source_mappings_class_idx ON ldt_semantic.source_semantic_mappings (semantic_class_key);
CREATE UNIQUE INDEX IF NOT EXISTS ldt_semantic_source_mappings_uniq
  ON ldt_semantic.source_semantic_mappings (COALESCE(city_id, ''), provider_key, source_family, source_layer, entity_type, semantic_class_key);

CREATE TABLE IF NOT EXISTS ldt_semantic.rule_check_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  pack_id uuid REFERENCES ldt_semantic.pack_registry(id) ON DELETE SET NULL,
  pack_run_key text NOT NULL DEFAULT '',
  rule_key text NOT NULL,
  subject_entity_id uuid REFERENCES ldt_core.city_entities(id) ON DELETE SET NULL,
  evidence_entity_id uuid REFERENCES ldt_core.city_entities(id) ON DELETE SET NULL,
  result text NOT NULL DEFAULT 'generated',
  severity text NOT NULL DEFAULT 'info',
  explanation text NOT NULL DEFAULT '',
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_geometry geometry(Geometry, 4326),
  authority_status text NOT NULL DEFAULT 'open-data-seed',
  review_state text NOT NULL DEFAULT 'generated',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ldt_semantic_rule_check_results_city_rule_idx ON ldt_semantic.rule_check_results (city_id, rule_key);
CREATE INDEX IF NOT EXISTS ldt_semantic_rule_check_results_subject_idx ON ldt_semantic.rule_check_results (subject_entity_id);
CREATE INDEX IF NOT EXISTS ldt_semantic_rule_check_results_geom_gix ON ldt_semantic.rule_check_results USING gist (output_geometry);

CREATE TABLE IF NOT EXISTS ldt_semantic.workflow_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_key text NOT NULL UNIQUE,
  city_id text REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  pack_id uuid REFERENCES ldt_semantic.pack_registry(id) ON DELETE SET NULL,
  workflow_name text NOT NULL,
  owning_authority text NOT NULL DEFAULT '',
  workflow_stage text NOT NULL DEFAULT 'proposed',
  supported_decision text NOT NULL DEFAULT '',
  input_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  output_artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  handoff_method text NOT NULL DEFAULT '',
  quality_gate jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  authority_status text NOT NULL DEFAULT 'not-authority-approved',
  review_state text NOT NULL DEFAULT 'draft',
  lifecycle_status text NOT NULL DEFAULT 'generated',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ldt_semantic_workflow_contracts_city_idx ON ldt_semantic.workflow_contracts (city_id);
CREATE INDEX IF NOT EXISTS ldt_semantic_workflow_contracts_pack_idx ON ldt_semantic.workflow_contracts (pack_id);

COMMENT ON TABLE ldt_semantic.semantic_class_registry IS 'Canonical semantic classes used by queries, viewers, packs, exports, and workflow contracts.';
COMMENT ON TABLE ldt_semantic.entity_semantic_tags IS 'Object-level semantic meanings with provenance, confidence, method, and authority state.';
COMMENT ON TABLE ldt_semantic.source_semantic_mappings IS 'Configured mappings from source layers and provider packages into entity types, semantic classes, and tags.';
COMMENT ON TABLE ldt_semantic.rule_check_results IS 'Auditable rule/check outputs produced by semantic packs or validators.';
COMMENT ON TABLE ldt_semantic.workflow_contracts IS 'Municipal workflow handoff contracts that define pack operational boundaries and authority state.';

INSERT INTO ldt_semantic.semantic_class_registry (class_key, label, description, inventory_tier, geometry_types, allowed_entity_types, authority_requirement, metadata, lifecycle_status, updated_at) VALUES
  ('builtFabric','Built fabric','Buildings, structures, construction objects, BIM assets, and built-form evidence.','base-physical',ARRAY['Polygon','MultiPolygon','Geometry'],ARRAY['building','construction_site','model_element','structure'],'source-evidence','{"generationOneKeys":["buildings","building"]}','generated',now()),
  ('mobilityNetwork','Mobility network','Roads, paths, transit corridors, access routes, and mobility assets.','base-physical',ARRAY['LineString','MultiLineString','Point','Geometry'],ARRAY['road','path','mobility_asset','transit_stop','rail'],'source-evidence','{"generationOneKeys":["roads","road"]}','generated',now()),
  ('greenBlue','Green-blue system','Parks, water, wetlands, protected/ecological areas, and environmental open systems.','base-physical',ARRAY['Polygon','MultiPolygon','LineString','Point','Geometry'],ARRAY['green_blue_system','park','waterbody','vegetation','protected_area'],'source-evidence','{"generationOneKeys":["greenBlue","green_blue_system"]}','generated',now()),
  ('landUse','Land use','Residential, industrial, commercial, vacant, mixed-use, zoning, and land-use gap areas.','semantic-context',ARRAY['Polygon','MultiPolygon','Geometry'],ARRAY['land_use','planning_zone','parcel','cadastral_parcel'],'source-evidence','{}','generated',now()),
  ('territorialGovernance','Territorial governance','Administrative, cadastral, planning, neighborhood, district, and governance boundaries.','base-context',ARRAY['Polygon','MultiPolygon','Geometry'],ARRAY['administrative_district','neighborhood','cadastral_parcel','planning_area','boundary'],'source-evidence','{}','generated',now()),
  ('utilityNetwork','Utility network','Water, sewer, drainage, power, lighting, telecom, and utility infrastructure networks.','base-physical',ARRAY['LineString','Point','Polygon','Geometry'],ARRAY['water_pipe','sewer_pipe','stormwater_pipe','street_light','electric_pole','pump_station','utility_service_area'],'source-evidence','{}','generated',now()),
  ('civicServices','Civic services','Public facilities, service anchors, schools, health, emergency, public safety, and service points.','base-context',ARRAY['Point','Polygon','MultiPolygon','Geometry'],ARRAY['facility','public_institution','school','hospital','shelter','service_anchor'],'source-evidence','{"generationOneKeys":["facilities","facility"]}','generated',now()),
  ('places','Places','Settlements, neighborhoods, landmarks, named places, and orientation anchors.','base-context',ARRAY['Point','Polygon','Geometry'],ARRAY['place','neighborhood','landmark','settlement'],'source-evidence','{"generationOneKeys":["places","place"]}','generated',now()),
  ('liveContext','Live context','Sensors, observations, feeds, and broker-projected live city entities.','live-context',ARRAY['Point','Polygon','LineString','Geometry'],ARRAY['sensor','observation','device','feed'],'source-evidence','{}','generated',now()),
  ('providerEvidence','Provider evidence','Raw provider, city, or third-party overlays used as provenance and review evidence.','provider-evidence',ARRAY['Geometry','Point','LineString','Polygon','MultiPolygon'],ARRAY['provider_overlay','source_feature','evidence_layer'],'source-evidence','{"generationOneKeys":["providerOverlays"]}','generated',now()),
  ('semanticPackOutputs','Semantic pack outputs','Derived features, artifacts, and entities produced by explicit semantic-pack runs.','semantic-output',ARRAY['Geometry','Point','LineString','Polygon','MultiPolygon'],ARRAY['semanticPackOutput','semanticServiceFeature','rule_check_result','evidence_artifact'],'pack-generated','{"generationOneKeys":["semanticPacks"]}','generated',now()),
  ('planningWorkflow','Planning workflow','Planning cases, submissions, review states, and workflow objects.','operational-context',ARRAY['Point','Polygon','Geometry'],ARRAY['planning_case','planning_application','planning_submission'],'authority-or-partner-evidence','{}','generated',now()),
  ('planningRules','Planning rules','Constraints, envelopes, restrictions, planning requirements, and checkable conditions.','operational-context',ARRAY['Polygon','MultiPolygon','LineString','Geometry'],ARRAY['planning_constraint','buildable_envelope','zoning_rule','restriction_area'],'authority-or-partner-evidence','{}','generated',now()),
  ('modelEvidence','Model evidence','IFC, BIM, OBJ, DWG, point-cloud, and model-derived metadata evidence.','provider-evidence',ARRAY['Geometry','Point','Polygon'],ARRAY['ifc_submission','model_element','model_package','geometry_asset'],'partner-evidence','{}','generated',now()),
  ('publicExplanation','Public explanation','Scenes, public views, briefing artifacts, and participation explanation outputs.','semantic-output',ARRAY['Geometry','Point','Polygon'],ARRAY['public_explanation_scene','viewer_artifact','briefing_artifact'],'pack-generated','{}','generated',now()),
  ('geotechnicalHazard','Geotechnical hazard','Faults, microzones, geological maps, boreholes, ground investigation, and hazard evidence.','provider-evidence',ARRAY['Point','LineString','Polygon','Geometry'],ARRAY['fault_line','fault_zone','microzone','geological_map','borehole','hazard_area'],'authority-or-partner-evidence','{}','generated',now()),
  ('emergencyPreparedness','Emergency preparedness','Shelters, assembly areas, emergency resources, preparedness areas, and response evidence.','operational-context',ARRAY['Point','Polygon','Geometry'],ARRAY['shelter','assembly_area','emergency_resource','preparedness_area'],'authority-or-partner-evidence','{}','generated',now()),
  ('builtFabricRisk','Built fabric risk','Risk and exposure evidence attached to buildings or built assets.','semantic-context',ARRAY['Point','Polygon','Geometry'],ARRAY['building_risk_assessment','exposure_feature','risk_object'],'authority-or-partner-evidence','{}','generated',now()),
  ('terrainEvidence','Terrain evidence','Elevation, terrain, slope, surface, and LiDAR-derived evidence.','provider-evidence',ARRAY['Point','Polygon','Raster','Geometry'],ARRAY['terrain_tile','height_surface','slope_area','lidar_asset'],'source-evidence','{}','generated',now())
ON CONFLICT (class_key) DO UPDATE SET label=EXCLUDED.label, description=EXCLUDED.description, inventory_tier=EXCLUDED.inventory_tier, geometry_types=EXCLUDED.geometry_types, allowed_entity_types=EXCLUDED.allowed_entity_types, authority_requirement=EXCLUDED.authority_requirement, metadata=EXCLUDED.metadata, lifecycle_status=EXCLUDED.lifecycle_status, updated_at=now();

INSERT INTO ldt_semantic.semantic_class_entity_type_map (class_key, entity_type, mapping_role, required, notes)
SELECT class_key, entity_type, 'accepted-input', false, 'Seeded from semantic class registry allowed_entity_types.'
FROM ldt_semantic.semantic_class_registry CROSS JOIN LATERAL unnest(allowed_entity_types) AS entity_type
ON CONFLICT (class_key, entity_type, mapping_role) DO NOTHING;

INSERT INTO ldt_semantic.semantic_tag_definitions (semantic_class_key, tag_key, label, value_type, allowed_values, authority_requirement, updated_at) VALUES
  ('builtFabric','building_use','Building use','text',ARRAY[]::text[],'source-evidence',now()),('builtFabric','public_institution','Public institution','boolean',ARRAY['true','false'],'source-evidence',now()),('builtFabric','shelter_candidate','Shelter candidate','boolean',ARRAY['true','false'],'authority-or-partner-evidence',now()),
  ('mobilityNetwork','road_class','Road class','text',ARRAY[]::text[],'source-evidence',now()),('mobilityNetwork','emergency_access_role','Emergency access role','text',ARRAY['candidate','validated','blocked','unknown'],'authority-or-partner-evidence',now()),
  ('greenBlue','green_blue_type','Green-blue type','text',ARRAY[]::text[],'source-evidence',now()),('landUse','land_use_class','Land-use class','text',ARRAY[]::text[],'source-evidence',now()),('territorialGovernance','governance_level','Governance level','text',ARRAY[]::text[],'source-evidence',now()),
  ('utilityNetwork','utility_type','Utility type','text',ARRAY[]::text[],'authority-or-partner-evidence',now()),('civicServices','service_category','Service category','text',ARRAY[]::text[],'source-evidence',now()),('planningWorkflow','case_status','Planning case status','text',ARRAY[]::text[],'authority-or-partner-evidence',now()),
  ('planningRules','rule_type','Rule type','text',ARRAY[]::text[],'authority-or-partner-evidence',now()),('planningRules','allowed_height_m','Allowed height meters','number',ARRAY[]::text[],'authority-or-partner-evidence',now()),('modelEvidence','model_format','Model format','text',ARRAY[]::text[],'partner-evidence',now()),('modelEvidence','model_status','Model status','text',ARRAY[]::text[],'partner-evidence',now()),
  ('geotechnicalHazard','hazard_type','Hazard type','text',ARRAY[]::text[],'authority-or-partner-evidence',now()),('emergencyPreparedness','resource_type','Preparedness resource type','text',ARRAY[]::text[],'authority-or-partner-evidence',now()),('emergencyPreparedness','capacity_role','Capacity role','text',ARRAY[]::text[],'authority-or-partner-evidence',now()),
  ('builtFabricRisk','risk_type','Risk type','text',ARRAY[]::text[],'authority-or-partner-evidence',now()),('builtFabricRisk','risk_level','Risk level','text',ARRAY[]::text[],'authority-or-partner-evidence',now()),('semanticPackOutputs','output_type','Output type','text',ARRAY[]::text[],'pack-generated',now()),('semanticPackOutputs','pack_key','Pack key','text',ARRAY[]::text[],'pack-generated',now()),('providerEvidence','source_format','Source format','text',ARRAY[]::text[],'source-evidence',now()),('terrainEvidence','terrain_role','Terrain role','text',ARRAY[]::text[],'source-evidence',now())
ON CONFLICT (semantic_class_key, tag_key) DO UPDATE SET label=EXCLUDED.label, value_type=EXCLUDED.value_type, allowed_values=EXCLUDED.allowed_values, authority_requirement=EXCLUDED.authority_requirement, updated_at=now();

INSERT INTO ldt_semantic.source_semantic_mappings (provider_key, source_family, source_layer, entity_type, semantic_class_key, tag_rules, mapping_method, confidence, authority_status, lifecycle_status, notes, updated_at) VALUES
  ('osm','osm-local-extract','city_buildings','building','builtFabric','[{"tagKey":"building_use","sourceProperty":"building"}]','configured-source-mapping','source-evidence','open-data-seed','generated','Generic OSM building mapping.',now()),
  ('osm','osm-local-extract','city_roads','road','mobilityNetwork','[{"tagKey":"road_class","sourceProperty":"highway"}]','configured-source-mapping','source-evidence','open-data-seed','generated','Generic OSM road mapping.',now()),
  ('osm','osm-local-extract','city_green_blue','green_blue_system','greenBlue','[{"tagKey":"green_blue_type","sourceProperty":"category"}]','configured-source-mapping','source-evidence','open-data-seed','generated','Generic OSM green-blue mapping.',now()),
  ('osm','osm-local-extract','city_facilities','facility','civicServices','[{"tagKey":"service_category","sourceProperty":"category"}]','configured-source-mapping','source-evidence','open-data-seed','generated','Generic OSM facility mapping.',now()),
  ('overture','overture-maps','buildings','building','builtFabric','[{"tagKey":"building_use","sourceProperty":"subtype"}]','configured-source-mapping','source-evidence','open-data-seed','generated','Generic Overture buildings mapping.',now()),
  ('overture','overture-maps','transportation_segment','road','mobilityNetwork','[{"tagKey":"road_class","sourceProperty":"class"}]','configured-source-mapping','source-evidence','open-data-seed','generated','Generic Overture roads mapping.',now()),
  ('municipal-planning','municipal-base-map','base-building-context','building','builtFabric','[{"tagKey":"building_use","sourceProperty":"use"}]','configured-source-mapping','source-evidence','open-data-seed','generated','Generic municipal base-map building mapping placeholder.',now()),
  ('municipal-planning','municipal-planning-workflow','planning-cases','planning_case','planningWorkflow','[{"tagKey":"case_status","sourceProperty":"status"}]','configured-source-mapping','partner-required','not-authority-approved','generated','Generic municipal planning workflow mapping placeholder.',now()),
  ('municipal-planning','municipal-planning-rules','planning-constraints','planning_constraint','planningRules','[{"tagKey":"rule_type","sourceProperty":"rule_type"}]','configured-source-mapping','partner-required','not-authority-approved','generated','Generic municipal planning rule mapping placeholder.',now()),
  ('municipal-planning','municipal-model-evidence','model-submissions','model_package','modelEvidence','[{"tagKey":"model_format","sourceProperty":"format"},{"tagKey":"model_status","sourceProperty":"status"}]','configured-source-mapping','partner-required','not-authority-approved','generated','Generic municipal model-evidence mapping placeholder.',now()),
  ('urban-risk','urban-risk-evidence','building-risk-assessments','building_risk_assessment','builtFabricRisk','[{"tagKey":"risk_type","sourceProperty":"risk_type"},{"tagKey":"risk_level","sourceProperty":"risk_level"}]','configured-source-mapping','partner-required','not-authority-approved','generated','Generic urban-risk building assessment mapping placeholder.',now()),
  ('urban-risk','emergency-preparedness','assembly-areas','assembly_area','emergencyPreparedness','[{"tagKey":"resource_type","constant":"assembly_area"}]','configured-source-mapping','partner-required','not-authority-approved','generated','Generic emergency assembly-area mapping placeholder.',now()),
  ('urban-risk','emergency-preparedness','shelter-areas','shelter','emergencyPreparedness','[{"tagKey":"resource_type","constant":"shelter"}]','configured-source-mapping','partner-required','not-authority-approved','generated','Generic emergency shelter-area mapping placeholder.',now()),
  ('urban-risk','hazard-evidence','hazard-lines','fault_line','geotechnicalHazard','[{"tagKey":"hazard_type","sourceProperty":"hazard_type"}]','configured-source-mapping','partner-required','not-authority-approved','generated','Generic hazard line mapping placeholder.',now())
ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW ldt_semantic.semantic_contract_status AS
  SELECT
    (SELECT count(*)::int FROM ldt_semantic.semantic_class_registry) AS semantic_class_count,
    (SELECT count(*)::int FROM ldt_semantic.semantic_class_entity_type_map) AS entity_type_mapping_count,
    (SELECT count(*)::int FROM ldt_semantic.semantic_tag_definitions) AS tag_definition_count,
    (SELECT count(*)::int FROM ldt_semantic.source_semantic_mappings) AS source_mapping_count,
    (SELECT count(*)::int FROM ldt_semantic.workflow_contracts) AS workflow_contract_count,
    (SELECT count(*)::int FROM ldt_semantic.rule_check_results) AS rule_check_result_count;
