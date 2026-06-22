CREATE SCHEMA IF NOT EXISTS ldt_core;
CREATE SCHEMA IF NOT EXISTS ldt_catalog;
CREATE SCHEMA IF NOT EXISTS ldt_prov;
CREATE SCHEMA IF NOT EXISTS ldt_interop;
CREATE SCHEMA IF NOT EXISTS ldt_fiware;
CREATE SCHEMA IF NOT EXISTS ldt_science;
CREATE SCHEMA IF NOT EXISTS ldt_society;
CREATE SCHEMA IF NOT EXISTS ldt_viewer;
CREATE SCHEMA IF NOT EXISTS legacy;

CREATE TABLE IF NOT EXISTS ldt_core.cities (
  id text PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  centroid geometry(Point, 4326),
  canonical_uri text UNIQUE,
  source_city_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_core.city_boundaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  boundary_role text NOT NULL DEFAULT 'administrative',
  authority_status text NOT NULL DEFAULT 'open-data',
  valid_from timestamptz,
  valid_to timestamptz,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ldt_core_city_boundaries_geom_gix
  ON ldt_core.city_boundaries USING gist (geom);

CREATE TABLE IF NOT EXISTS ldt_core.city_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  stable_id text NOT NULL,
  entity_type text NOT NULL,
  label text,
  canonical_uri text UNIQUE,
  authority_status text NOT NULL DEFAULT 'open-data',
  confidence text NOT NULL DEFAULT 'unknown',
  lifecycle_status text NOT NULL DEFAULT 'active',
  valid_from timestamptz,
  valid_to timestamptz,
  geom geometry(Geometry, 4326),
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, stable_id)
);

CREATE INDEX IF NOT EXISTS ldt_core_city_entities_city_type_idx
  ON ldt_core.city_entities (city_id, entity_type);

CREATE INDEX IF NOT EXISTS ldt_core_city_entities_geom_gix
  ON ldt_core.city_entities USING gist (geom);

CREATE TABLE IF NOT EXISTS ldt_core.building_entities (
  entity_id uuid PRIMARY KEY REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  building_type text,
  use_class text,
  levels numeric,
  height_m numeric,
  footprint_area_m2 numeric,
  source_coverage_status text NOT NULL DEFAULT 'source-evidence',
  bim_status text NOT NULL DEFAULT 'none'
);

CREATE TABLE IF NOT EXISTS ldt_core.road_entities (
  entity_id uuid PRIMARY KEY REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  road_class text,
  name text,
  maxspeed text,
  lanes text,
  oneway text,
  network_role text
);

CREATE TABLE IF NOT EXISTS ldt_core.facility_entities (
  entity_id uuid PRIMARY KEY REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  category text,
  amenity text,
  operator text,
  public_access text
);

CREATE TABLE IF NOT EXISTS ldt_core.place_entities (
  entity_id uuid PRIMARY KEY REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  place_type text,
  population numeric,
  admin_level text
);

CREATE TABLE IF NOT EXISTS ldt_core.land_use_entities (
  entity_id uuid PRIMARY KEY REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  land_use_class text,
  coverage_class text,
  area_m2 numeric
);

CREATE TABLE IF NOT EXISTS ldt_core.green_blue_entities (
  entity_id uuid PRIMARY KEY REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  system_type text,
  green_blue_role text,
  area_m2 numeric
);

CREATE TABLE IF NOT EXISTS ldt_core.mobility_entities (
  entity_id uuid PRIMARY KEY REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  mobility_type text,
  mode text,
  operator text
);

CREATE TABLE IF NOT EXISTS ldt_core.asset_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  subject_entity_id uuid NOT NULL REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  object_entity_id uuid REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_catalog.datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  identifier text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  publisher text,
  license text,
  access_rights text NOT NULL DEFAULT 'city-private',
  update_frequency text,
  issued_at timestamptz,
  modified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_catalog.dataset_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES ldt_catalog.datasets(id) ON DELETE CASCADE,
  title text NOT NULL,
  format text NOT NULL DEFAULT 'unknown',
  media_type text,
  access_url text,
  download_url text,
  byte_size bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_catalog.dataset_quality_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES ldt_catalog.datasets(id) ON DELETE CASCADE,
  quality_dimension text NOT NULL,
  score numeric,
  statement text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_prov.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  agent_type text NOT NULL DEFAULT 'organization',
  uri text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_prov.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  responsible_agent_id uuid REFERENCES ldt_prov.agents(id) ON DELETE SET NULL,
  software_version text,
  status text NOT NULL DEFAULT 'running',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ldt_prov.source_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  dataset_id uuid REFERENCES ldt_catalog.datasets(id) ON DELETE SET NULL,
  activity_id uuid REFERENCES ldt_prov.activities(id) ON DELETE SET NULL,
  source_feature_id text NOT NULL,
  source_layer text NOT NULL,
  source_type text NOT NULL DEFAULT 'open-data',
  geom geometry(Geometry, 4326),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, dataset_id, source_feature_id)
);

CREATE INDEX IF NOT EXISTS ldt_prov_source_features_geom_gix
  ON ldt_prov.source_features USING gist (geom);

CREATE TABLE IF NOT EXISTS ldt_prov.entity_source_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  source_feature_id uuid NOT NULL REFERENCES ldt_prov.source_features(id) ON DELETE CASCADE,
  evidence_role text NOT NULL DEFAULT 'supports',
  match_score numeric,
  confidence text NOT NULL DEFAULT 'unknown',
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, source_feature_id, evidence_role)
);

CREATE TABLE IF NOT EXISTS ldt_prov.entity_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  decision text NOT NULL,
  authority_status text,
  decided_by text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  rationale text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ldt_interop.dcat_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  export_key text NOT NULL,
  jsonld jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, export_key)
);

CREATE TABLE IF NOT EXISTS ldt_interop.jsonld_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_key text NOT NULL UNIQUE,
  context_body jsonb NOT NULL,
  version text NOT NULL DEFAULT '0.1.0',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_interop.ngsi_entity_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  ngsi_type text NOT NULL,
  smart_data_model text,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  version text NOT NULL DEFAULT '0.1.0',
  UNIQUE (entity_type, ngsi_type, version)
);

CREATE TABLE IF NOT EXISTS ldt_interop.ngsi_entity_projections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  mapping_id uuid REFERENCES ldt_interop.ngsi_entity_mappings(id) ON DELETE SET NULL,
  ngsi_id text NOT NULL,
  ngsi_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  projected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, ngsi_id)
);

CREATE TABLE IF NOT EXISTS ldt_interop.ogc_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  collection_key text NOT NULL,
  title text NOT NULL,
  entity_type text,
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (city_id, collection_key)
);

CREATE TABLE IF NOT EXISTS ldt_interop.odrl_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL UNIQUE,
  target_dataset_id uuid REFERENCES ldt_catalog.datasets(id) ON DELETE CASCADE,
  policy_body jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_interop.ldes_event_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  stream_key text NOT NULL,
  entity_type text,
  last_event_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (city_id, stream_key)
);

CREATE TABLE IF NOT EXISTS ldt_fiware.context_broker_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_key text NOT NULL UNIQUE,
  broker_url text NOT NULL,
  tenant text,
  auth_mode text NOT NULL DEFAULT 'none',
  status text NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_fiware.context_broker_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES ldt_fiware.context_broker_connections(id) ON DELETE CASCADE,
  subscription_key text NOT NULL,
  ngsi_type text,
  watched_attributes text[] NOT NULL DEFAULT ARRAY[]::text[],
  callback_url text,
  status text NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (connection_id, subscription_key)
);

CREATE TABLE IF NOT EXISTS ldt_fiware.context_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES ldt_fiware.context_broker_connections(id) ON DELETE SET NULL,
  city_id text REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'push',
  status text NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text
);

CREATE TABLE IF NOT EXISTS ldt_fiware.context_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES ldt_core.city_entities(id) ON DELETE SET NULL,
  ngsi_id text,
  observed_property text NOT NULL,
  observed_at timestamptz NOT NULL,
  value jsonb NOT NULL,
  unit_code text,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ldt_fiware_context_observations_entity_time_idx
  ON ldt_fiware.context_observations (entity_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS ldt_science.indicator_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_key text NOT NULL UNIQUE,
  name text NOT NULL,
  model_family text NOT NULL DEFAULT 'descriptive',
  unit text,
  definition text NOT NULL DEFAULT '',
  method jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_science.indicator_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  indicator_id uuid NOT NULL REFERENCES ldt_science.indicator_definitions(id) ON DELETE CASCADE,
  geography_entity_id uuid REFERENCES ldt_core.city_entities(id) ON DELETE SET NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  value numeric,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality text NOT NULL DEFAULT 'unknown',
  provenance_activity_id uuid REFERENCES ldt_prov.activities(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ldt_science.network_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  layer_key text NOT NULL,
  network_type text NOT NULL,
  source_entity_type text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (city_id, layer_key)
);

CREATE TABLE IF NOT EXISTS ldt_science.simulation_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key text NOT NULL UNIQUE,
  name text NOT NULL,
  model_family text NOT NULL,
  version text NOT NULL DEFAULT '0.1.0',
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_science.simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES ldt_science.simulation_models(id) ON DELETE CASCADE,
  scenario_key text,
  status text NOT NULL DEFAULT 'queued',
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  uncertainty jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS ldt_society.observation_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  series_key text NOT NULL,
  theme text NOT NULL,
  title text NOT NULL,
  geography_level text,
  source_dataset_id uuid REFERENCES ldt_catalog.datasets(id) ON DELETE SET NULL,
  privacy_class text NOT NULL DEFAULT 'aggregate',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (city_id, series_key)
);

CREATE TABLE IF NOT EXISTS ldt_society.observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES ldt_society.observation_series(id) ON DELETE CASCADE,
  geography_entity_id uuid REFERENCES ldt_core.city_entities(id) ON DELETE SET NULL,
  observed_at timestamptz NOT NULL,
  value numeric,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  unit text,
  quality text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_viewer.city_summary_cache (
  city_id text PRIMARY KEY REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  summary_key text NOT NULL DEFAULT 'default',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_viewer.density_grids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  grid_key text NOT NULL,
  zoom_hint integer NOT NULL DEFAULT 12,
  cell_id text NOT NULL,
  geom geometry(Polygon, 4326) NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, grid_key, cell_id)
);

CREATE INDEX IF NOT EXISTS ldt_viewer_density_grids_geom_gix
  ON ldt_viewer.density_grids USING gist (geom);

CREATE OR REPLACE VIEW legacy.cities AS
  SELECT * FROM public.cities;

CREATE OR REPLACE VIEW legacy.city_features AS
  SELECT * FROM public.city_features;

CREATE OR REPLACE VIEW legacy.layer_definitions AS
  SELECT * FROM public.layer_definitions;
