ALTER TABLE ldt_science.indicator_definitions
  ADD COLUMN IF NOT EXISTS standard_key text NOT NULL DEFAULT 'urban-science-core',
  ADD COLUMN IF NOT EXISTS standard_version text NOT NULL DEFAULT '0.1.0',
  ADD COLUMN IF NOT EXISTS dimension text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS calculation_scope text NOT NULL DEFAULT 'city',
  ADD COLUMN IF NOT EXISTS expected_direction text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE ldt_science.indicator_observations
  ADD COLUMN IF NOT EXISTS observation_key text,
  ADD COLUMN IF NOT EXISTS geography_level text NOT NULL DEFAULT 'city',
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS method jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS uncertainty jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_quality text NOT NULL DEFAULT 'open-data-derived',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS ldt_science_indicator_observations_key_uidx
  ON ldt_science.indicator_observations (observation_key)
  WHERE observation_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ldt_science_indicator_observations_city_indicator_idx
  ON ldt_science.indicator_observations (city_id, indicator_id);

CREATE INDEX IF NOT EXISTS ldt_science_indicator_definitions_standard_idx
  ON ldt_science.indicator_definitions (standard_key, standard_version, dimension);

CREATE TABLE IF NOT EXISTS ldt_science.indicator_quality (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL REFERENCES ldt_science.indicator_observations(id) ON DELETE CASCADE,
  quality_dimension text NOT NULL,
  score numeric,
  assessment text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (observation_id, quality_dimension)
);

CREATE TABLE IF NOT EXISTS ldt_science.scaling_model_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key text NOT NULL UNIQUE,
  name text NOT NULL,
  model_family text NOT NULL DEFAULT 'urban_scaling',
  response_indicator_key text,
  baseline_indicator_key text,
  equation text NOT NULL DEFAULT '',
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_science.scaling_model_fits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_definition_id uuid NOT NULL REFERENCES ldt_science.scaling_model_definitions(id) ON DELETE CASCADE,
  fit_key text NOT NULL UNIQUE,
  fitted_at timestamptz NOT NULL DEFAULT now(),
  training_scope text NOT NULL DEFAULT 'city-sample',
  city_count int NOT NULL DEFAULT 0,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  goodness_of_fit jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ldt_science.scaling_residuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fit_id uuid NOT NULL REFERENCES ldt_science.scaling_model_fits(id) ON DELETE CASCADE,
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  observed_value numeric,
  expected_value numeric,
  residual numeric,
  residual_unit text,
  interpretation text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fit_id, city_id)
);

CREATE TABLE IF NOT EXISTS ldt_science.scenario_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_key text NOT NULL UNIQUE,
  name text NOT NULL,
  scenario_family text NOT NULL,
  description text NOT NULL DEFAULT '',
  required_inputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_outputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_science.scenario_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_definition_id uuid NOT NULL REFERENCES ldt_science.scenario_definitions(id) ON DELETE CASCADE,
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  input_key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'open-data',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scenario_definition_id, city_id, input_key)
);

CREATE TABLE IF NOT EXISTS ldt_science.scenario_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_definition_id uuid NOT NULL REFERENCES ldt_science.scenario_definitions(id) ON DELETE CASCADE,
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  output_key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scenario_definition_id, city_id, output_key)
);

CREATE TABLE IF NOT EXISTS ldt_science.model_calibrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES ldt_science.simulation_models(id) ON DELETE CASCADE,
  scaling_model_definition_id uuid REFERENCES ldt_science.scaling_model_definitions(id) ON DELETE CASCADE,
  calibration_key text NOT NULL UNIQUE,
  city_id text REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  calibration_scope text NOT NULL DEFAULT 'city',
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_science.network_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_layer_id uuid NOT NULL REFERENCES ldt_science.network_layers(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  geography_entity_id uuid REFERENCES ldt_core.city_entities(id) ON DELETE SET NULL,
  value numeric,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  method jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality text NOT NULL DEFAULT 'draft',
  observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (network_layer_id, metric_key, city_id, geography_entity_id)
);
