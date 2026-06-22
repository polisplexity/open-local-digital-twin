ALTER TABLE layer_ingestion_jobs
  ADD COLUMN IF NOT EXISTS job_kind text NOT NULL DEFAULT 'provider-layer-ingestion',
  ADD COLUMN IF NOT EXISTS requested_action text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS layer_ingestion_jobs_idempotency_idx
  ON layer_ingestion_jobs (city_id, layer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS layer_ingestion_jobs_queue_idx
  ON layer_ingestion_jobs (status, created_at)
  WHERE status IN ('queued', 'running');

CREATE TABLE IF NOT EXISTS ingestion_validation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES layer_ingestion_jobs(id) ON DELETE CASCADE,
  city_id text NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  layer_id uuid REFERENCES layer_definitions(id) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'warning',
  code text NOT NULL,
  message text NOT NULL,
  source_ref text,
  source_index integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingestion_validation_reports_job_idx
  ON ingestion_validation_reports (job_id, severity, created_at);

CREATE INDEX IF NOT EXISTS ingestion_validation_reports_city_idx
  ON ingestion_validation_reports (city_id, created_at DESC);
