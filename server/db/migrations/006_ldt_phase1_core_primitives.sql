CREATE TABLE IF NOT EXISTS ldt_core.entity_type_registry (
  entity_type text PRIMARY KEY,
  display_name text NOT NULL,
  entity_family text NOT NULL,
  geometry_model text NOT NULL,
  standards_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (geometry_model IN ('point', 'line', 'polygon', 'mixed', 'non-spatial'))
);

INSERT INTO ldt_core.entity_type_registry (
  entity_type,
  display_name,
  entity_family,
  geometry_model,
  standards_mapping,
  description
) VALUES
  (
    'administrative_geography',
    'Administrative geography',
    'territory',
    'polygon',
    '{"ngsi_ld":"AdministrativeArea","ogc":"Feature","dcat_role":"spatial_extent"}'::jsonb,
    'Official or operational geography such as city, district, neighborhood, or service area.'
  ),
  (
    'city_boundary',
    'City boundary',
    'territory',
    'polygon',
    '{"ngsi_ld":"AdministrativeArea","ogc":"Feature"}'::jsonb,
    'Municipal or analytical boundary used to scope the twin.'
  ),
  (
    'building',
    'Building',
    'built_fabric',
    'polygon',
    '{"ngsi_ld":"Building","smart_data_model":"Building","ogc":"Feature"}'::jsonb,
    'Consolidated building inventory entity enriched by OSM, Overture, official data, BIM, and review evidence.'
  ),
  (
    'road',
    'Road',
    'mobility',
    'line',
    '{"ngsi_ld":"Road","smart_data_model":"Road","ogc":"Feature"}'::jsonb,
    'Consolidated road or path segment used for city network and access analysis.'
  ),
  (
    'facility',
    'Facility',
    'public_services',
    'mixed',
    '{"ngsi_ld":"PointOfInterest","smart_data_model":"PointOfInterest","ogc":"Feature"}'::jsonb,
    'Public, civic, emergency, health, education, commerce, or service facility.'
  ),
  (
    'place',
    'Place',
    'territory',
    'point',
    '{"ngsi_ld":"PointOfInterest","ogc":"Feature"}'::jsonb,
    'Named settlement, locality, addressable place, landmark, or public reference point.'
  ),
  (
    'land_use',
    'Land use',
    'land_environment',
    'polygon',
    '{"ngsi_ld":"LandUse","ogc":"Feature"}'::jsonb,
    'Thematic land-use, land-cover, zoning, or open-land classification.'
  ),
  (
    'green_blue_system',
    'Green-blue system',
    'land_environment',
    'mixed',
    '{"ngsi_ld":"GreenspaceRecord","ogc":"Feature"}'::jsonb,
    'Parks, water bodies, forests, wetlands, and ecological/open-space systems.'
  ),
  (
    'mobility_asset',
    'Mobility asset',
    'mobility',
    'mixed',
    '{"ngsi_ld":"TransportStation","ogc":"Feature"}'::jsonb,
    'Transit stops, parking, charging, cycling, pedestrian, and local movement assets.'
  ),
  (
    'service_point',
    'Service point',
    'public_services',
    'point',
    '{"ngsi_ld":"PointOfInterest","ogc":"Feature"}'::jsonb,
    'Operational point used by a semantic pack or municipal service workflow.'
  ),
  (
    'sensor',
    'Sensor or device',
    'live_context',
    'point',
    '{"ngsi_ld":"Device","smart_data_model":"Device","fiware":"Device"}'::jsonb,
    'Live or periodic IoT/source device projected through FIWARE or another context layer.'
  ),
  (
    'cultural_asset',
    'Cultural asset',
    'society_culture',
    'mixed',
    '{"ngsi_ld":"PointOfInterest","ogc":"Feature"}'::jsonb,
    'Heritage, cultural venue, public memory, identity, creative economy, or community asset.'
  ),
  (
    'bim_asset',
    'BIM or 3D asset',
    'built_fabric',
    'mixed',
    '{"ogc":"3DTilesOrCityModel","ifc":"IfcProduct"}'::jsonb,
    'BIM, IFC, CityJSON, 3D Tiles, or asset-management object linked to city inventory.'
  ),
  (
    'simulation_object',
    'Simulation object',
    'science_model',
    'mixed',
    '{"science":"scenario_entity","ogc":"Feature"}'::jsonb,
    'Entity created or consumed by a scientific model, scenario, or simulation run.'
  )
ON CONFLICT (entity_type) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  entity_family = EXCLUDED.entity_family,
  geometry_model = EXCLUDED.geometry_model,
  standards_mapping = EXCLUDED.standards_mapping,
  description = EXCLUDED.description,
  enabled = true,
  updated_at = now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ldt_core_city_entities_entity_type_fkey'
      AND conrelid = 'ldt_core.city_entities'::regclass
  ) THEN
    ALTER TABLE ldt_core.city_entities
      ADD CONSTRAINT ldt_core_city_entities_entity_type_fkey
      FOREIGN KEY (entity_type)
      REFERENCES ldt_core.entity_type_registry(entity_type)
      NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ldt_core.identifier_namespaces (
  namespace_key text PRIMARY KEY,
  applies_to text NOT NULL,
  uri_template text NOT NULL,
  description text NOT NULL DEFAULT '',
  version text NOT NULL DEFAULT '0.1.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ldt_core.identifier_namespaces (
  namespace_key,
  applies_to,
  uri_template,
  description
) VALUES
  ('city', 'ldt_core.cities', 'urn:polisplexity:ldt:city:{city_id}', 'Canonical city identifier.'),
  ('entity', 'ldt_core.city_entities', 'urn:polisplexity:ldt:{city_id}:entity:{stable_id}', 'Canonical consolidated city entity identifier.'),
  ('source_feature', 'ldt_prov.source_features', 'urn:polisplexity:ldt:{city_id}:source:{dataset_identifier}:{source_feature_id}', 'Source feature evidence identifier.'),
  ('dataset', 'ldt_catalog.datasets', 'urn:polisplexity:ldt:dataset:{dataset_identifier}', 'Dataset/catalog identifier for DCAT exports.'),
  ('indicator', 'ldt_science.indicator_definitions', 'urn:polisplexity:ldt:indicator:{indicator_key}', 'Scientific indicator definition identifier.'),
  ('scenario', 'ldt_science.simulation_runs', 'urn:polisplexity:ldt:{city_id}:scenario:{scenario_key}', 'Scenario or simulation identifier.'),
  ('fiware_ngsi', 'ldt_interop.ngsi_entity_projections', 'urn:ngsi-ld:{ngsi_type}:{city_id}:{stable_id}', 'NGSI-LD entity identifier for FIWARE projection.')
ON CONFLICT (namespace_key) DO UPDATE SET
  applies_to = EXCLUDED.applies_to,
  uri_template = EXCLUDED.uri_template,
  description = EXCLUDED.description,
  updated_at = now();

CREATE TABLE IF NOT EXISTS ldt_core.entity_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  namespace_key text NOT NULL REFERENCES ldt_core.identifier_namespaces(namespace_key) ON DELETE RESTRICT,
  identifier_value text NOT NULL,
  identifier_uri text,
  is_primary boolean NOT NULL DEFAULT false,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (namespace_key, identifier_value)
);

CREATE INDEX IF NOT EXISTS ldt_core_entity_identifiers_entity_idx
  ON ldt_core.entity_identifiers (entity_id);

CREATE TABLE IF NOT EXISTS ldt_catalog.dataset_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES ldt_catalog.datasets(id) ON DELETE CASCADE,
  license_name text NOT NULL,
  spdx_id text,
  license_url text,
  attribution_required boolean NOT NULL DEFAULT true,
  share_alike_required boolean NOT NULL DEFAULT false,
  commercial_use_allowed boolean,
  obligations jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, license_name)
);

CREATE TABLE IF NOT EXISTS ldt_catalog.dataset_spatial_extents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES ldt_catalog.datasets(id) ON DELETE CASCADE,
  extent_role text NOT NULL DEFAULT 'coverage',
  geom geometry(Geometry, 4326),
  bbox jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ldt_catalog_dataset_spatial_extents_geom_gix
  ON ldt_catalog.dataset_spatial_extents USING gist (geom);

CREATE TABLE IF NOT EXISTS ldt_catalog.dataset_temporal_extents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES ldt_catalog.datasets(id) ON DELETE CASCADE,
  extent_role text NOT NULL DEFAULT 'coverage',
  starts_at timestamptz,
  ends_at timestamptz,
  statement text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ldt_catalog_datasets_city_idx
  ON ldt_catalog.datasets (city_id, identifier);

CREATE INDEX IF NOT EXISTS ldt_catalog_distributions_dataset_idx
  ON ldt_catalog.dataset_distributions (dataset_id, format);

CREATE TABLE IF NOT EXISTS ldt_prov.entity_match_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  group_key text NOT NULL,
  entity_type text NOT NULL REFERENCES ldt_core.entity_type_registry(entity_type) ON DELETE RESTRICT,
  match_method text NOT NULL,
  status text NOT NULL DEFAULT 'candidate',
  confidence text NOT NULL DEFAULT 'unknown',
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, group_key)
);

CREATE TABLE IF NOT EXISTS ldt_prov.entity_match_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_group_id uuid NOT NULL REFERENCES ldt_prov.entity_match_groups(id) ON DELETE CASCADE,
  source_feature_id uuid REFERENCES ldt_prov.source_features(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'candidate',
  match_score numeric,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_feature_id IS NOT NULL OR entity_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ldt_prov_match_members_group_idx
  ON ldt_prov.entity_match_group_members (match_group_id, member_role);

CREATE TABLE IF NOT EXISTS ldt_prov.lineage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  subject_entity_id uuid REFERENCES ldt_core.city_entities(id) ON DELETE SET NULL,
  source_feature_id uuid REFERENCES ldt_prov.source_features(id) ON DELETE SET NULL,
  activity_id uuid REFERENCES ldt_prov.activities(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  happened_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ldt_prov_lineage_events_city_type_idx
  ON ldt_prov.lineage_events (city_id, event_type, happened_at DESC);

CREATE INDEX IF NOT EXISTS ldt_prov_source_features_city_source_idx
  ON ldt_prov.source_features (city_id, source_layer, source_feature_id);

INSERT INTO ldt_prov.agents (name, agent_type, uri, metadata)
VALUES (
  'Twin Base Studio',
  'software',
  'urn:polisplexity:twin-base-studio',
  '{"role":"ldt_native_runtime"}'::jsonb
)
ON CONFLICT DO NOTHING;
