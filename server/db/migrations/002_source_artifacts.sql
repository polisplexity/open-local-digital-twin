CREATE TABLE IF NOT EXISTS source_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingestion_run_id uuid REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  city_id text NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  provider_id text REFERENCES providers(id) ON DELETE SET NULL,
  source_name text NOT NULL,
  source_url text,
  source_kind text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS source_artifacts_city_kind_idx
  ON source_artifacts (city_id, source_kind, fetched_at DESC);

CREATE INDEX IF NOT EXISTS source_artifacts_ingestion_run_idx
  ON source_artifacts (ingestion_run_id);
