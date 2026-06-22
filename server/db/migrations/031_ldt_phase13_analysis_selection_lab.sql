CREATE SCHEMA IF NOT EXISTS ldt_analysis;

CREATE TABLE IF NOT EXISTS ldt_analysis.analysis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled analysis session',
  status text NOT NULL DEFAULT 'active',
  surface text NOT NULL DEFAULT 'map',
  intent text NOT NULL DEFAULT 'analysis',
  actor_user_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('active', 'closed', 'archived')),
  CHECK (surface IN ('map', 'city3d', 'municipal3d', 'civic', 'immersive', 'api')),
  CHECK (intent IN ('inspection', 'analysis', 'simulation', 'operations', 'embed', 'export', 'unknown'))
);

CREATE INDEX IF NOT EXISTS ldt_analysis_sessions_city_status_idx
  ON ldt_analysis.analysis_sessions (city_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS ldt_analysis.selection_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  session_id uuid REFERENCES ldt_analysis.analysis_sessions(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled city-object selection',
  selection_kind text NOT NULL DEFAULT 'twinql-selection',
  query_hash text NOT NULL,
  source_query jsonb NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  semantic_classes text[] NOT NULL DEFAULT ARRAY[]::text[],
  result_count integer NOT NULL DEFAULT 0,
  returned_count integer NOT NULL DEFAULT 0,
  truncated boolean NOT NULL DEFAULT false,
  complete boolean NOT NULL DEFAULT true,
  bounds jsonb,
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ready',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (selection_kind IN ('twinql-selection', 'manual-selection', 'provider-selection', 'simulation-selection')),
  CHECK (status IN ('ready', 'failed', 'archived'))
);

CREATE INDEX IF NOT EXISTS ldt_analysis_selection_sets_city_status_idx
  ON ldt_analysis.selection_sets (city_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS ldt_analysis_selection_sets_query_hash_idx
  ON ldt_analysis.selection_sets (city_id, query_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS ldt_analysis_selection_sets_semantic_classes_gin
  ON ldt_analysis.selection_sets USING gin (semantic_classes);

CREATE TABLE IF NOT EXISTS ldt_analysis.selection_set_members (
  selection_set_id uuid NOT NULL REFERENCES ldt_analysis.selection_sets(id) ON DELETE CASCADE,
  city_entity_id uuid REFERENCES ldt_core.city_entities(id) ON DELETE SET NULL,
  object_id text NOT NULL,
  semantic_class text NOT NULL,
  layer_key text NOT NULL,
  entity_type text,
  label text NOT NULL DEFAULT '',
  geometry_type text,
  clause_id text,
  clause_label text,
  rank integer NOT NULL DEFAULT 0,
  score numeric,
  distance_m numeric,
  sample_point geometry(Point, 4326),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (selection_set_id, object_id)
);

CREATE INDEX IF NOT EXISTS ldt_analysis_selection_members_selection_idx
  ON ldt_analysis.selection_set_members (selection_set_id, rank);

CREATE INDEX IF NOT EXISTS ldt_analysis_selection_members_entity_idx
  ON ldt_analysis.selection_set_members (city_entity_id);

CREATE INDEX IF NOT EXISTS ldt_analysis_selection_members_class_idx
  ON ldt_analysis.selection_set_members (selection_set_id, semantic_class, layer_key);

CREATE INDEX IF NOT EXISTS ldt_analysis_selection_members_sample_point_gix
  ON ldt_analysis.selection_set_members USING gist (sample_point);

CREATE TABLE IF NOT EXISTS ldt_analysis.selection_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_set_id uuid NOT NULL REFERENCES ldt_analysis.selection_sets(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  label text NOT NULL DEFAULT '',
  value numeric,
  unit text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (selection_set_id, metric_key)
);

CREATE INDEX IF NOT EXISTS ldt_analysis_selection_metrics_selection_idx
  ON ldt_analysis.selection_metrics (selection_set_id, metric_key);

CREATE TABLE IF NOT EXISTS ldt_analysis.selection_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_set_id uuid NOT NULL REFERENCES ldt_analysis.selection_sets(id) ON DELETE CASCADE,
  style_key text NOT NULL DEFAULT 'default',
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (selection_set_id, style_key)
);

CREATE TABLE IF NOT EXISTS ldt_analysis.selection_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  left_selection_id uuid NOT NULL REFERENCES ldt_analysis.selection_sets(id) ON DELETE CASCADE,
  right_selection_id uuid NOT NULL REFERENCES ldt_analysis.selection_sets(id) ON DELETE CASCADE,
  operation text NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  sample_object_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (operation IN ('union', 'intersection', 'difference', 'symmetric_difference'))
);

CREATE INDEX IF NOT EXISTS ldt_analysis_selection_comparisons_city_idx
  ON ldt_analysis.selection_comparisons (city_id, created_at DESC);

COMMENT ON SCHEMA ldt_analysis IS
  'City Selection Lab: persistent analysis sessions, object selections, metrics, styling, and comparisons over the canonical LDT inventory.';

COMMENT ON TABLE ldt_analysis.selection_sets IS
  'A query-scoped set of city inventory objects. Stores IDs, query contract, metrics, and view style; geometry remains in ldt_core/ldt_query and visual transports.';

COMMENT ON TABLE ldt_analysis.selection_set_members IS
  'Members of a persisted city-object selection, keyed to ldt_core.city_entities when available and carrying compact attributes for analysis and viewer focus.';
