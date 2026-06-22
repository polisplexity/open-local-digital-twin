CREATE SCHEMA IF NOT EXISTS ldt_semantic;

CREATE TABLE IF NOT EXISTS ldt_semantic.pack_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_key text NOT NULL,
  name text NOT NULL,
  version text NOT NULL DEFAULT '0.1.0',
  domain text NOT NULL,
  description text NOT NULL DEFAULT '',
  lifecycle_status text NOT NULL DEFAULT 'draft',
  authority_status text NOT NULL DEFAULT 'open-reference',
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  standards_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pack_key, version)
);

CREATE TABLE IF NOT EXISTS ldt_semantic.pack_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES ldt_semantic.pack_registry(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  rule_type text NOT NULL,
  input_entity_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  output_role text NOT NULL DEFAULT '',
  confidence_rule text NOT NULL DEFAULT 'open-data-seed',
  validation_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_body jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_quality text NOT NULL DEFAULT 'open-data-derived',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pack_id, rule_key)
);

CREATE TABLE IF NOT EXISTS ldt_semantic.city_pack_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES ldt_semantic.pack_registry(id) ON DELETE CASCADE,
  binding_key text NOT NULL,
  status text NOT NULL DEFAULT 'generated',
  authority_status text NOT NULL DEFAULT 'open-data-seed',
  active boolean NOT NULL DEFAULT true,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, binding_key)
);

CREATE TABLE IF NOT EXISTS ldt_semantic.service_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES ldt_semantic.pack_registry(id) ON DELETE CASCADE,
  indicator_key text NOT NULL,
  label text NOT NULL,
  value numeric,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  unit text,
  quality text NOT NULL DEFAULT 'open-data-derived',
  method jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, pack_id, indicator_key)
);

CREATE TABLE IF NOT EXISTS ldt_semantic.service_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES ldt_semantic.pack_registry(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES ldt_core.city_entities(id) ON DELETE SET NULL,
  feature_key text NOT NULL,
  service_role text NOT NULL,
  label text,
  geom geometry(Geometry, 4326),
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality text NOT NULL DEFAULT 'open-data-seed',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, pack_id, feature_key)
);

CREATE INDEX IF NOT EXISTS ldt_semantic_service_features_geom_gix
  ON ldt_semantic.service_features USING gist (geom);

CREATE INDEX IF NOT EXISTS ldt_semantic_service_features_city_role_idx
  ON ldt_semantic.service_features (city_id, service_role);

CREATE TABLE IF NOT EXISTS ldt_semantic.service_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES ldt_semantic.pack_registry(id) ON DELETE CASCADE,
  workflow_key text NOT NULL,
  title text NOT NULL,
  workflow_status text NOT NULL DEFAULT 'proposed',
  priority text NOT NULL DEFAULT 'medium',
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, pack_id, workflow_key)
);

CREATE TABLE IF NOT EXISTS ldt_semantic.pack_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES ldt_semantic.pack_registry(id) ON DELETE CASCADE,
  export_key text NOT NULL,
  export_format text NOT NULL DEFAULT 'application/json',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, pack_id, export_key)
);

CREATE TABLE IF NOT EXISTS ldt_semantic.review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES ldt_semantic.pack_registry(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_key text NOT NULL,
  decision text NOT NULL,
  decided_by text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  rationale text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE VIEW ldt_semantic.city_pack_status AS
  SELECT
    b.city_id,
    p.pack_key,
    p.name,
    p.version,
    p.domain,
    b.binding_key,
    b.status,
    b.authority_status,
    b.active,
    b.quality_summary,
    b.generated_at,
    count(DISTINCT i.id)::int AS indicator_count,
    count(DISTINCT f.id)::int AS service_feature_count,
    count(DISTINCT w.id)::int AS workflow_count
  FROM ldt_semantic.city_pack_bindings b
  JOIN ldt_semantic.pack_registry p ON p.id = b.pack_id
  LEFT JOIN ldt_semantic.service_indicators i
    ON i.city_id = b.city_id AND i.pack_id = b.pack_id
  LEFT JOIN ldt_semantic.service_features f
    ON f.city_id = b.city_id AND f.pack_id = b.pack_id
  LEFT JOIN ldt_semantic.service_workflows w
    ON w.city_id = b.city_id AND w.pack_id = b.pack_id
  GROUP BY
    b.city_id,
    p.pack_key,
    p.name,
    p.version,
    p.domain,
    b.binding_key,
    b.status,
    b.authority_status,
    b.active,
    b.quality_summary,
    b.generated_at;
