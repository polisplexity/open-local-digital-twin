CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS cities (
  id text PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  centroid geometry(Point, 4326),
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS city_boundaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  source text NOT NULL,
  authority_status text NOT NULL DEFAULT 'open-data',
  geom geometry(MultiPolygon, 4326) NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  valid_from timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS city_boundaries_geom_gix
  ON city_boundaries USING gist (geom);

CREATE TABLE IF NOT EXISTS providers (
  id text PRIMARY KEY,
  name text NOT NULL,
  provider_type text NOT NULL DEFAULT 'data-provider',
  website_url text,
  contact_label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS layer_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text REFERENCES cities(id) ON DELETE CASCADE,
  provider_id text REFERENCES providers(id) ON DELETE SET NULL,
  key text NOT NULL,
  name text NOT NULL,
  layer_family text NOT NULL,
  geometry_type text NOT NULL,
  authority_status text NOT NULL DEFAULT 'open-data',
  access_level text NOT NULL DEFAULT 'city-private',
  source_license text,
  update_frequency text,
  semantic_status text NOT NULL DEFAULT 'base',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, key)
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text REFERENCES cities(id) ON DELETE CASCADE,
  provider_id text REFERENCES providers(id) ON DELETE SET NULL,
  layer_id uuid REFERENCES layer_definitions(id) ON DELETE SET NULL,
  source_name text NOT NULL,
  source_url text,
  run_type text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_message text,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS source_features_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_run_id uuid NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  city_id text NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  source_feature_id text NOT NULL,
  source_layer text NOT NULL,
  geometry_type text,
  geom geometry(Geometry, 4326),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ingestion_run_id, source_feature_id)
);

CREATE INDEX IF NOT EXISTS source_features_raw_city_idx
  ON source_features_raw (city_id, source_layer);

CREATE INDEX IF NOT EXISTS source_features_raw_geom_gix
  ON source_features_raw USING gist (geom);

CREATE TABLE IF NOT EXISTS city_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  layer_id uuid REFERENCES layer_definitions(id) ON DELETE SET NULL,
  source_raw_id uuid REFERENCES source_features_raw(id) ON DELETE SET NULL,
  stable_id text NOT NULL,
  feature_type text NOT NULL,
  label text,
  authority_status text NOT NULL DEFAULT 'open-data',
  confidence text NOT NULL DEFAULT 'unknown',
  geom geometry(Geometry, 4326) NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, stable_id)
);

CREATE INDEX IF NOT EXISTS city_features_city_type_idx
  ON city_features (city_id, feature_type);

CREATE INDEX IF NOT EXISTS city_features_geom_gix
  ON city_features USING gist (geom);

CREATE TABLE IF NOT EXISTS roads (
  feature_id uuid PRIMARY KEY REFERENCES city_features(id) ON DELETE CASCADE,
  road_class text,
  name text,
  maxspeed text,
  lanes text,
  oneway text
);

CREATE TABLE IF NOT EXISTS buildings (
  feature_id uuid PRIMARY KEY REFERENCES city_features(id) ON DELETE CASCADE,
  building_type text,
  levels numeric,
  height_m numeric,
  footprint_area_m2 numeric,
  bim_status text NOT NULL DEFAULT 'none'
);

CREATE TABLE IF NOT EXISTS facilities (
  feature_id uuid PRIMARY KEY REFERENCES city_features(id) ON DELETE CASCADE,
  category text,
  amenity text,
  shop text,
  public_transport text
);

CREATE TABLE IF NOT EXISTS places (
  feature_id uuid PRIMARY KEY REFERENCES city_features(id) ON DELETE CASCADE,
  place_type text,
  population numeric
);

CREATE TABLE IF NOT EXISTS green_blue_features (
  feature_id uuid PRIMARY KEY REFERENCES city_features(id) ON DELETE CASCADE,
  category text,
  shape text
);

CREATE TABLE IF NOT EXISTS semantic_packs (
  id text PRIMARY KEY,
  name text NOT NULL,
  version text NOT NULL DEFAULT '0.1.0',
  description text NOT NULL DEFAULT '',
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS semantic_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  semantic_pack_id text REFERENCES semantic_packs(id) ON DELETE SET NULL,
  provider_id text REFERENCES providers(id) ON DELETE SET NULL,
  key text NOT NULL,
  name text NOT NULL,
  authority_status text NOT NULL DEFAULT 'inferred',
  access_level text NOT NULL DEFAULT 'city-private',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, key)
);

CREATE TABLE IF NOT EXISTS semantic_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  semantic_layer_id uuid NOT NULL REFERENCES semantic_layers(id) ON DELETE CASCADE,
  base_feature_id uuid REFERENCES city_features(id) ON DELETE SET NULL,
  stable_id text NOT NULL,
  label text,
  geom geometry(Geometry, 4326),
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (semantic_layer_id, stable_id)
);

CREATE INDEX IF NOT EXISTS semantic_features_geom_gix
  ON semantic_features USING gist (geom);

CREATE TABLE IF NOT EXISTS dataset_catalog_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text REFERENCES cities(id) ON DELETE CASCADE,
  layer_id uuid REFERENCES layer_definitions(id) ON DELETE SET NULL,
  semantic_layer_id uuid REFERENCES semantic_layers(id) ON DELETE SET NULL,
  dcat_identifier text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  access_level text NOT NULL DEFAULT 'city-private',
  license text,
  landing_page_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dcat_identifier)
);

CREATE TABLE IF NOT EXISTS viewer_cache_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  cache_type text NOT NULL,
  payload jsonb NOT NULL,
  generated_from_run_id uuid REFERENCES ingestion_runs(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (city_id, cache_key)
);

