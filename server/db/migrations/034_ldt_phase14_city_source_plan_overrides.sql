CREATE TABLE IF NOT EXISTS ldt_ops.city_source_plan_overrides (
  city_id text PRIMARY KEY REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  raw_schema text,
  source_slug text,
  source_url text,
  source_path text,
  overture_release text,
  provider_override jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ldt_ops.city_source_plan_overrides IS
  'Operator-managed source package overrides for city open-data bootstrap plans.';
COMMENT ON COLUMN ldt_ops.city_source_plan_overrides.provider_override IS
  'Optional provider-specific source metadata, such as alternate endpoints, release metadata, or extraction hints.';
