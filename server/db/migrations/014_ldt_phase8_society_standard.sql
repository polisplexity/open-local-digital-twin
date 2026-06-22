ALTER TABLE ldt_society.observation_series
  ADD COLUMN IF NOT EXISTS standard_key text NOT NULL DEFAULT 'society-culture-core',
  ADD COLUMN IF NOT EXISTS standard_version text NOT NULL DEFAULT '0.1.0',
  ADD COLUMN IF NOT EXISTS data_domain text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS allowed_geography_levels text[] NOT NULL DEFAULT ARRAY['city']::text[],
  ADD COLUMN IF NOT EXISTS aggregation_rule text NOT NULL DEFAULT 'aggregate-only',
  ADD COLUMN IF NOT EXISTS source_quality text NOT NULL DEFAULT 'open-data-derived',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE ldt_society.observations
  ADD COLUMN IF NOT EXISTS observation_key text,
  ADD COLUMN IF NOT EXISTS geography_level text NOT NULL DEFAULT 'city',
  ADD COLUMN IF NOT EXISTS privacy_class text NOT NULL DEFAULT 'aggregate',
  ADD COLUMN IF NOT EXISTS method jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS uncertainty jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_quality text NOT NULL DEFAULT 'open-data-derived',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS ldt_society_observations_key_uidx
  ON ldt_society.observations (observation_key);

CREATE INDEX IF NOT EXISTS ldt_society_observation_series_standard_idx
  ON ldt_society.observation_series (standard_key, standard_version, data_domain);

CREATE INDEX IF NOT EXISTS ldt_society_observations_series_idx
  ON ldt_society.observations (series_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS ldt_society.privacy_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL UNIQUE,
  name text NOT NULL,
  privacy_class text NOT NULL,
  allowed_geography_levels text[] NOT NULL DEFAULT ARRAY['city']::text[],
  public_view_allowed boolean NOT NULL DEFAULT false,
  personal_data_allowed boolean NOT NULL DEFAULT false,
  rule text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_society.source_quality_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL UNIQUE,
  data_domain text NOT NULL,
  source_type text NOT NULL,
  quality_class text NOT NULL,
  rule text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_society.domain_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  profile_key text NOT NULL,
  data_domain text NOT NULL,
  label text NOT NULL,
  geography_level text NOT NULL DEFAULT 'city',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality text NOT NULL DEFAULT 'open-data-derived',
  privacy_class text NOT NULL DEFAULT 'aggregate',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, profile_key)
);

CREATE TABLE IF NOT EXISTS ldt_society.social_vulnerability_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  geography_entity_id uuid REFERENCES ldt_core.city_entities(id) ON DELETE SET NULL,
  score_key text NOT NULL,
  score numeric,
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality text NOT NULL DEFAULT 'not-computable',
  privacy_class text NOT NULL DEFAULT 'aggregate',
  method jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, geography_entity_id, score_key)
);

CREATE TABLE IF NOT EXISTS ldt_society.equity_gap_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  gap_key text NOT NULL,
  geography_level text NOT NULL DEFAULT 'city',
  value numeric,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality text NOT NULL DEFAULT 'draft',
  privacy_class text NOT NULL DEFAULT 'aggregate',
  method jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, gap_key, geography_level)
);

CREATE TABLE IF NOT EXISTS ldt_society.cultural_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  asset_key text NOT NULL,
  asset_type text NOT NULL,
  label text,
  source_quality text NOT NULL DEFAULT 'open-data-derived',
  privacy_class text NOT NULL DEFAULT 'public',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, asset_key)
);

CREATE TABLE IF NOT EXISTS ldt_society.participation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  title text NOT NULL,
  event_type text NOT NULL,
  event_status text NOT NULL DEFAULT 'planned',
  privacy_class text NOT NULL DEFAULT 'aggregate',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, event_key)
);
