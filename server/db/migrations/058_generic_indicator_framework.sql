CREATE TABLE IF NOT EXISTS ldt_science.indicator_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_key text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  publisher text NOT NULL DEFAULT '',
  version text NOT NULL DEFAULT 'unversioned',
  standard_uri text,
  adapter_key text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT indicator_catalogs_status_check CHECK (status IN ('active', 'disabled', 'archived'))
);

CREATE TABLE IF NOT EXISTS ldt_science.indicator_catalog_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES ldt_science.indicator_catalogs(id) ON DELETE CASCADE,
  indicator_id uuid NOT NULL REFERENCES ldt_science.indicator_definitions(id) ON DELETE CASCADE,
  external_code text NOT NULL,
  dimension text NOT NULL DEFAULT 'general',
  subdimension text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT '',
  indicator_type text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catalog_id, external_code),
  UNIQUE (catalog_id, indicator_id)
);

CREATE TABLE IF NOT EXISTS ldt_science.indicator_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES ldt_science.indicator_catalog_memberships(id) ON DELETE CASCADE,
  requirement_key text NOT NULL,
  label text NOT NULL,
  requirement_type text NOT NULL,
  source_ref text NOT NULL DEFAULT '',
  required boolean NOT NULL DEFAULT true,
  weight numeric NOT NULL DEFAULT 1,
  rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, requirement_key),
  CONSTRAINT indicator_requirements_type_check CHECK (requirement_type IN (
    'validated-observation',
    'canonical-entity',
    'domain-table',
    'observation-series',
    'phenomenon-layer',
    'context-observation',
    'model-output',
    'external-authority-value',
    'manual'
  )),
  CONSTRAINT indicator_requirements_weight_check CHECK (weight > 0)
);

CREATE TABLE IF NOT EXISTS ldt_science.indicator_validation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  catalog_id uuid REFERENCES ldt_science.indicator_catalogs(id) ON DELETE SET NULL,
  requested_by text,
  status text NOT NULL DEFAULT 'running',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT indicator_validation_runs_status_check CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE TABLE IF NOT EXISTS ldt_science.indicator_validation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES ldt_science.indicator_validation_runs(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES ldt_science.indicator_catalog_memberships(id) ON DELETE CASCADE,
  indicator_id uuid NOT NULL REFERENCES ldt_science.indicator_definitions(id) ON DELETE CASCADE,
  state text NOT NULL,
  readiness_score numeric NOT NULL DEFAULT 0,
  value_ready boolean NOT NULL DEFAULT false,
  calculation_ready boolean NOT NULL DEFAULT false,
  map_ready boolean NOT NULL DEFAULT false,
  current_value_count integer NOT NULL DEFAULT 0,
  validated_value_count integer NOT NULL DEFAULT 0,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, membership_id),
  CONSTRAINT indicator_validation_results_state_check CHECK (state IN ('ready', 'partial', 'blocked', 'not-applicable')),
  CONSTRAINT indicator_validation_results_score_check CHECK (readiness_score >= 0 AND readiness_score <= 1)
);

CREATE TABLE IF NOT EXISTS ldt_science.indicator_threshold_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  indicator_id uuid NOT NULL REFERENCES ldt_science.indicator_definitions(id) ON DELETE CASCADE,
  profile_key text NOT NULL,
  name text NOT NULL,
  operator text NOT NULL,
  threshold_value numeric,
  threshold_high numeric,
  unit text,
  severity text NOT NULL DEFAULT 'info',
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, indicator_id, profile_key),
  CONSTRAINT indicator_threshold_profiles_operator_check CHECK (operator IN ('gt', 'gte', 'lt', 'lte', 'eq', 'between', 'outside')),
  CONSTRAINT indicator_threshold_profiles_severity_check CHECK (severity IN ('info', 'watch', 'warning', 'critical')),
  CONSTRAINT indicator_threshold_profiles_bounds_check CHECK (
    (operator IN ('between', 'outside') AND threshold_value IS NOT NULL AND threshold_high IS NOT NULL)
    OR (operator NOT IN ('between', 'outside') AND threshold_value IS NOT NULL)
  )
);

ALTER TABLE ldt_science.indicator_observations
  ADD COLUMN IF NOT EXISTS authority_status text NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'candidate',
  ADD COLUMN IF NOT EXISTS period_start timestamptz,
  ADD COLUMN IF NOT EXISTS period_end timestamptz,
  ADD COLUMN IF NOT EXISTS source_ref text;

ALTER TABLE ldt_science.indicator_observations
  DROP CONSTRAINT IF EXISTS indicator_observations_validation_status_check;
ALTER TABLE ldt_science.indicator_observations
  ADD CONSTRAINT indicator_observations_validation_status_check
  CHECK (validation_status IN ('candidate', 'validated', 'rejected', 'lab', 'simulated'));

ALTER TABLE ldt_science.indicator_observations
  DROP CONSTRAINT IF EXISTS indicator_observations_period_check;
ALTER TABLE ldt_science.indicator_observations
  ADD CONSTRAINT indicator_observations_period_check
  CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start);

ALTER TABLE ldt_science.indicator_definitions DROP CONSTRAINT IF EXISTS indicator_definitions_source_mode_check;
ALTER TABLE ldt_science.indicator_definitions ADD CONSTRAINT indicator_definitions_source_mode_check
  CHECK (source_mode IN ('manual', 'autonomous', 'computed', 'external', 'cip'));

CREATE INDEX IF NOT EXISTS ldt_science_indicator_catalog_memberships_dimension_idx
  ON ldt_science.indicator_catalog_memberships (catalog_id, dimension, subdimension, sort_order);
CREATE INDEX IF NOT EXISTS ldt_science_indicator_requirements_membership_idx
  ON ldt_science.indicator_requirements (membership_id, required, requirement_type);
CREATE INDEX IF NOT EXISTS ldt_science_indicator_validation_runs_city_idx
  ON ldt_science.indicator_validation_runs (city_id, catalog_id, finished_at DESC);
CREATE INDEX IF NOT EXISTS ldt_science_indicator_validation_results_run_state_idx
  ON ldt_science.indicator_validation_results (run_id, state, readiness_score DESC);
CREATE INDEX IF NOT EXISTS ldt_science_indicator_threshold_profiles_lookup_idx
  ON ldt_science.indicator_threshold_profiles (city_id, indicator_id, active, profile_key);
CREATE INDEX IF NOT EXISTS ldt_science_indicator_observations_valid_current_idx
  ON ldt_science.indicator_observations (city_id, indicator_id, validation_status, geography_level, observed_at DESC);

INSERT INTO ldt_science.indicator_catalogs (
  catalog_key, title, description, publisher, version, adapter_key, metadata
) VALUES (
  'oldt-local',
  'OLDT local indicators',
  'Local and integration indicators created directly in OLDT.',
  'OLDT',
  '1.0.0',
  'manual',
  '{"systemCatalog":true}'::jsonb
)
ON CONFLICT (catalog_key) DO NOTHING;

INSERT INTO ldt_science.indicator_catalog_memberships (
  catalog_id, indicator_id, external_code, dimension, metadata
)
SELECT catalog.id, definition.id, definition.indicator_key,
  COALESCE(NULLIF(definition.dimension, ''), 'general'),
  jsonb_build_object('migratedFrom', 'pre-catalog indicator definition')
FROM ldt_science.indicator_definitions definition
JOIN ldt_science.indicator_catalogs catalog ON catalog.catalog_key = 'oldt-local'
ON CONFLICT (catalog_id, indicator_id) DO NOTHING;

UPDATE ldt_science.indicator_observations observation
SET validation_status = CASE
      WHEN definition.indicator_key LIKE '%.lab' OR lower(COALESCE(observation.quality, '')) LIKE '%lab%'
        THEN 'lab'
      WHEN lower(COALESCE(observation.quality, '')) LIKE '%synthetic%'
        OR lower(COALESCE(observation.quality, '')) LIKE '%simulated%'
        THEN 'simulated'
      ELSE observation.validation_status
    END,
    authority_status = CASE
      WHEN definition.indicator_key LIKE '%.lab' THEN 'integration-lab'
      ELSE observation.authority_status
    END
FROM ldt_science.indicator_definitions definition
WHERE definition.id = observation.indicator_id;

COMMENT ON TABLE ldt_science.indicator_catalogs IS 'Versioned standards, rankings, local policy sets, and external indicator catalogs supported by OLDT.';
COMMENT ON TABLE ldt_science.indicator_requirements IS 'Machine-readable evidence requirements used to explain whether a city can calculate or consume an indicator.';
COMMENT ON TABLE ldt_science.indicator_validation_results IS 'Per-city readiness results. Ready means a validated value exists or an executable formula has all required evidence.';
COMMENT ON TABLE ldt_science.indicator_threshold_profiles IS 'Reusable city-specific thresholds that analytical queries can apply to current entity indicator observations.';
