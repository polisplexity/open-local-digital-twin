CREATE TABLE IF NOT EXISTS ldt_viewer.semantic_query_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text,
  surface text NOT NULL DEFAULT 'map',
  query_kind text NOT NULL DEFAULT 'semantic-selector',
  intent text NOT NULL DEFAULT 'analysis',
  query jsonb NOT NULL DEFAULT '{}'::jsonb,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  classes text[] NOT NULL DEFAULT ARRAY[]::text[],
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  render jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_count integer NOT NULL DEFAULT 0,
  truncated boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'completed',
  actor_user_id text,
  actor_role text,
  consumer_key text,
  share_key text,
  embed_key text,
  request_path text,
  request_id text,
  latency_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (surface IN ('map', 'municipal3d', 'immersive', 'api')),
  CHECK (intent IN ('inspection', 'analysis', 'simulation', 'operations', 'embed', 'export', 'unknown')),
  CHECK (status IN ('completed', 'failed', 'partial'))
);

CREATE INDEX IF NOT EXISTS ldt_viewer_semantic_query_events_city_created_idx
  ON ldt_viewer.semantic_query_events (city_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ldt_viewer_semantic_query_events_surface_intent_idx
  ON ldt_viewer.semantic_query_events (surface, intent, created_at DESC);

CREATE INDEX IF NOT EXISTS ldt_viewer_semantic_query_events_classes_gin
  ON ldt_viewer.semantic_query_events USING gin (classes);

CREATE INDEX IF NOT EXISTS ldt_viewer_semantic_query_events_query_gin
  ON ldt_viewer.semantic_query_events USING gin (query);

COMMENT ON TABLE ldt_viewer.semantic_query_events IS
  'Analyst, embed, and API semantic-query usage over the city inventory. This records what users ask of the city without becoming source data itself.';

COMMENT ON COLUMN ldt_viewer.semantic_query_events.intent IS
  'Declared use of the query: inspection, analysis, simulation, operations, embed, export, or unknown.';

COMMENT ON COLUMN ldt_viewer.semantic_query_events.query IS
  'Normalized semantic query object: classes, scope, filters, combine, render, and client metadata.';
