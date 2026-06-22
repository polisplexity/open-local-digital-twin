CREATE TABLE IF NOT EXISTS provider_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  connector_key text NOT NULL,
  display_name text NOT NULL,
  connector_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  supported_formats text[] NOT NULL DEFAULT ARRAY[]::text[],
  endpoint_url text,
  auth_mode text NOT NULL DEFAULT 'none',
  contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, connector_key)
);

CREATE INDEX IF NOT EXISTS provider_connectors_provider_idx
  ON provider_connectors (provider_id, connector_type, status);

CREATE TABLE IF NOT EXISTS layer_ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  provider_id text REFERENCES providers(id) ON DELETE SET NULL,
  layer_id uuid REFERENCES layer_definitions(id) ON DELETE SET NULL,
  connector_id uuid REFERENCES provider_connectors(id) ON DELETE SET NULL,
  ingestion_run_id uuid REFERENCES ingestion_runs(id) ON DELETE SET NULL,
  ingestion_mode text NOT NULL DEFAULT 'registered',
  source_format text NOT NULL DEFAULT 'unknown',
  source_uri text,
  status text NOT NULL DEFAULT 'registered',
  submitted_by text,
  validation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS layer_ingestion_jobs_city_status_idx
  ON layer_ingestion_jobs (city_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS layer_ingestion_jobs_layer_idx
  ON layer_ingestion_jobs (layer_id, created_at DESC);
