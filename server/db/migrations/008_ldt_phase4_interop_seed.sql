INSERT INTO ldt_interop.jsonld_contexts (
  context_key,
  context_body,
  version
) VALUES
  (
    'twin-base-studio-ngsi-ld',
    '{
      "@context": [
        "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
        {
          "tbs": "https://polisplexity.org/ns/twin-base-studio#",
          "sourceCoverageStatus": "tbs:sourceCoverageStatus",
          "authorityStatus": "tbs:authorityStatus",
          "confidence": "tbs:confidence",
          "lifecycleStatus": "tbs:lifecycleStatus",
          "refTwinEntity": "tbs:refTwinEntity",
          "refSourceEvidence": "tbs:refSourceEvidence"
        }
      ]
    }'::jsonb,
    '0.1.0'
  ),
  (
    'twin-base-studio-dcat',
    '{
      "@context": {
        "dcat": "http://www.w3.org/ns/dcat#",
        "dct": "http://purl.org/dc/terms/",
        "foaf": "http://xmlns.com/foaf/0.1/",
        "locn": "http://www.w3.org/ns/locn#",
        "odrl": "http://www.w3.org/ns/odrl/2/",
        "prov": "http://www.w3.org/ns/prov#",
        "tbs": "https://polisplexity.org/ns/twin-base-studio#"
      }
    }'::jsonb,
    '0.1.0'
  )
ON CONFLICT (context_key) DO UPDATE SET
  context_body = EXCLUDED.context_body,
  version = EXCLUDED.version;

INSERT INTO ldt_interop.ngsi_entity_mappings (
  entity_type,
  ngsi_type,
  smart_data_model,
  mapping,
  version
) VALUES
  (
    'building',
    'Building',
    'Smart Data Models / Building',
    '{
      "geometryProperty": "location",
      "properties": {
        "name": "label",
        "category": "entity_type",
        "sourceCoverageStatus": "ldt_core.building_entities.source_coverage_status",
        "authorityStatus": "ldt_core.city_entities.authority_status",
        "confidence": "ldt_core.city_entities.confidence"
      }
    }'::jsonb,
    '0.1.0'
  ),
  (
    'road',
    'Road',
    'Smart Data Models / Road',
    '{
      "geometryProperty": "location",
      "properties": {
        "name": "ldt_core.road_entities.name",
        "category": "ldt_core.road_entities.road_class",
        "authorityStatus": "ldt_core.city_entities.authority_status"
      }
    }'::jsonb,
    '0.1.0'
  ),
  (
    'facility',
    'PointOfInterest',
    'Smart Data Models / PointOfInterest',
    '{
      "geometryProperty": "location",
      "properties": {
        "name": "label",
        "category": "ldt_core.facility_entities.category",
        "authorityStatus": "ldt_core.city_entities.authority_status"
      }
    }'::jsonb,
    '0.1.0'
  ),
  (
    'place',
    'PointOfInterest',
    'Smart Data Models / PointOfInterest',
    '{
      "geometryProperty": "location",
      "properties": {
        "name": "label",
        "category": "ldt_core.place_entities.place_type",
        "authorityStatus": "ldt_core.city_entities.authority_status"
      }
    }'::jsonb,
    '0.1.0'
  ),
  (
    'land_use',
    'LandUse',
    'Twin Base Studio / LandUse',
    '{
      "geometryProperty": "location",
      "properties": {
        "name": "label",
        "category": "ldt_core.land_use_entities.land_use_class",
        "authorityStatus": "ldt_core.city_entities.authority_status"
      }
    }'::jsonb,
    '0.1.0'
  ),
  (
    'green_blue_system',
    'GreenspaceRecord',
    'Twin Base Studio / GreenspaceRecord',
    '{
      "geometryProperty": "location",
      "properties": {
        "name": "label",
        "category": "ldt_core.green_blue_entities.green_blue_role",
        "authorityStatus": "ldt_core.city_entities.authority_status"
      }
    }'::jsonb,
    '0.1.0'
  ),
  (
    'mobility_asset',
    'TransportStation',
    'Smart Data Models / Transportation',
    '{
      "geometryProperty": "location",
      "properties": {
        "name": "label",
        "category": "ldt_core.mobility_entities.mobility_type",
        "authorityStatus": "ldt_core.city_entities.authority_status"
      }
    }'::jsonb,
    '0.1.0'
  ),
  (
    'sensor',
    'Device',
    'Smart Data Models / Device',
    '{
      "geometryProperty": "location",
      "properties": {
        "name": "label",
        "category": "entity_type",
        "authorityStatus": "ldt_core.city_entities.authority_status"
      }
    }'::jsonb,
    '0.1.0'
  )
ON CONFLICT (entity_type, ngsi_type, version) DO UPDATE SET
  smart_data_model = EXCLUDED.smart_data_model,
  mapping = EXCLUDED.mapping;

CREATE INDEX IF NOT EXISTS ldt_interop_ngsi_mappings_entity_idx
  ON ldt_interop.ngsi_entity_mappings (entity_type, version);

CREATE INDEX IF NOT EXISTS ldt_interop_ngsi_projections_ngsi_id_idx
  ON ldt_interop.ngsi_entity_projections (ngsi_id);

CREATE INDEX IF NOT EXISTS ldt_interop_ngsi_projections_mapping_idx
  ON ldt_interop.ngsi_entity_projections (mapping_id);

CREATE INDEX IF NOT EXISTS ldt_interop_ogc_collections_city_entity_idx
  ON ldt_interop.ogc_collections (city_id, entity_type);

INSERT INTO ldt_interop.odrl_policies (
  policy_key,
  policy_body
) VALUES
  (
    'open-baseline-attribution-required',
    '{
      "@context": "http://www.w3.org/ns/odrl.jsonld",
      "@type": "Offer",
      "profile": "http://www.w3.org/ns/odrl/2/",
      "permission": [
        {
          "action": "use",
          "constraint": [
            {
              "leftOperand": "attribution",
              "operator": "eq",
              "rightOperand": "required"
            }
          ]
        }
      ],
      "prohibition": [],
      "obligation": [
        {
          "action": "attribute"
        }
      ]
    }'::jsonb
  )
ON CONFLICT (policy_key) DO UPDATE SET
  policy_body = EXCLUDED.policy_body;
