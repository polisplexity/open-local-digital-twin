ALTER TABLE ldt_science.indicator_definitions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'indicator',
  ADD COLUMN IF NOT EXISTS source_mode text NOT NULL DEFAULT 'autonomous',
  ADD COLUMN IF NOT EXISTS model_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS output_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS formula jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS target jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cip_binding_id uuid REFERENCES ldt_interop.cip_metric_bindings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visualization jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE ldt_science.indicator_definitions DROP CONSTRAINT IF EXISTS indicator_definitions_kind_check;
ALTER TABLE ldt_science.indicator_definitions ADD CONSTRAINT indicator_definitions_kind_check CHECK (kind IN ('indicator', 'kpi'));
ALTER TABLE ldt_science.indicator_definitions DROP CONSTRAINT IF EXISTS indicator_definitions_source_mode_check;
ALTER TABLE ldt_science.indicator_definitions ADD CONSTRAINT indicator_definitions_source_mode_check CHECK (source_mode IN ('autonomous', 'external', 'cip'));

CREATE INDEX IF NOT EXISTS ldt_science_indicator_definitions_catalog_idx
  ON ldt_science.indicator_definitions (active, kind, source_mode, updated_at DESC);

CREATE INDEX IF NOT EXISTS ldt_science_indicator_observations_entity_value_idx
  ON ldt_science.indicator_observations (city_id, indicator_id, geography_entity_id, observed_at DESC)
  WHERE geography_entity_id IS NOT NULL;

COMMENT ON COLUMN ldt_science.indicator_definitions.kind IS 'indicator describes state; kpi adds a governed target and decision responsibility.';
COMMENT ON COLUMN ldt_science.indicator_definitions.source_mode IS 'autonomous for OLDT formulas, external for imported model outputs, or cip for reconciled planner measurements.';
COMMENT ON TABLE ldt_science.indicator_observations IS 'Persistent indicator and KPI values at city, selection, or canonical entity geography. Queryable directly by SQL.';
