CREATE INDEX IF NOT EXISTS ldt_core_city_entities_city_phase_idx
  ON ldt_core.city_entities (city_id, ((properties->>'phase')));

CREATE INDEX IF NOT EXISTS ldt_core_building_entities_entity_idx
  ON ldt_core.building_entities (entity_id);

CREATE INDEX IF NOT EXISTS ldt_core_road_entities_entity_idx
  ON ldt_core.road_entities (entity_id);

CREATE INDEX IF NOT EXISTS ldt_core_facility_entities_entity_idx
  ON ldt_core.facility_entities (entity_id);

CREATE INDEX IF NOT EXISTS ldt_core_place_entities_entity_idx
  ON ldt_core.place_entities (entity_id);

CREATE INDEX IF NOT EXISTS ldt_core_green_blue_entities_entity_idx
  ON ldt_core.green_blue_entities (entity_id);

CREATE INDEX IF NOT EXISTS ldt_core_mobility_entities_entity_idx
  ON ldt_core.mobility_entities (entity_id);

CREATE INDEX IF NOT EXISTS ldt_core_entity_identifiers_entity_idx
  ON ldt_core.entity_identifiers (entity_id);

CREATE INDEX IF NOT EXISTS ldt_core_asset_relationships_subject_idx
  ON ldt_core.asset_relationships (subject_entity_id);

CREATE INDEX IF NOT EXISTS ldt_core_asset_relationships_object_idx
  ON ldt_core.asset_relationships (object_entity_id);

CREATE INDEX IF NOT EXISTS ldt_prov_entity_review_decisions_entity_idx
  ON ldt_prov.entity_review_decisions (entity_id);

CREATE INDEX IF NOT EXISTS ldt_prov_entity_source_evidence_source_idx
  ON ldt_prov.entity_source_evidence (source_feature_id);

CREATE INDEX IF NOT EXISTS ldt_prov_match_group_members_entity_idx
  ON ldt_prov.entity_match_group_members (entity_id);

CREATE INDEX IF NOT EXISTS ldt_prov_match_group_members_source_idx
  ON ldt_prov.entity_match_group_members (source_feature_id);

CREATE INDEX IF NOT EXISTS ldt_prov_lineage_events_subject_entity_idx
  ON ldt_prov.lineage_events (subject_entity_id);

CREATE INDEX IF NOT EXISTS ldt_prov_lineage_events_source_feature_idx
  ON ldt_prov.lineage_events (source_feature_id);

CREATE INDEX IF NOT EXISTS ldt_interop_ngsi_entity_projections_entity_idx
  ON ldt_interop.ngsi_entity_projections (entity_id);

CREATE INDEX IF NOT EXISTS ldt_fiware_context_observations_entity_idx
  ON ldt_fiware.context_observations (entity_id);

CREATE INDEX IF NOT EXISTS ldt_science_indicator_observations_geography_idx
  ON ldt_science.indicator_observations (geography_entity_id);

CREATE INDEX IF NOT EXISTS ldt_society_observations_geography_idx
  ON ldt_society.observations (geography_entity_id);
