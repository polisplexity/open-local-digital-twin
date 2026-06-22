ALTER TABLE ldt_fiware.context_broker_connections
  ADD COLUMN IF NOT EXISTS ngsi_ld_path text NOT NULL DEFAULT '/ngsi-ld/v1',
  ADD COLUMN IF NOT EXISTS batch_size integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS headers jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE ldt_fiware.context_sync_jobs
  ADD COLUMN IF NOT EXISTS job_key text,
  ADD COLUMN IF NOT EXISTS ngsi_type text,
  ADD COLUMN IF NOT EXISTS requested_limit integer,
  ADD COLUMN IF NOT EXISTS dry_run boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS ldt_fiware_context_sync_jobs_job_key_idx
  ON ldt_fiware.context_sync_jobs (job_key)
  WHERE job_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ldt_fiware_context_sync_jobs_city_status_idx
  ON ldt_fiware.context_sync_jobs (city_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS ldt_fiware.context_projection_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES ldt_fiware.context_broker_connections(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  ngsi_id text NOT NULL,
  ngsi_type text NOT NULL,
  payload_hash text NOT NULL,
  sync_status text NOT NULL DEFAULT 'pending',
  last_sync_job_id uuid REFERENCES ldt_fiware.context_sync_jobs(id) ON DELETE SET NULL,
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, entity_id)
);

CREATE INDEX IF NOT EXISTS ldt_fiware_context_projection_state_connection_status_idx
  ON ldt_fiware.context_projection_state (connection_id, sync_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS ldt_fiware_context_projection_state_ngsi_idx
  ON ldt_fiware.context_projection_state (ngsi_id);

INSERT INTO ldt_fiware.context_broker_connections (
  connection_key,
  broker_url,
  tenant,
  auth_mode,
  status,
  ngsi_ld_path,
  batch_size,
  metadata
) VALUES (
  'local-dry-run',
  'http://127.0.0.1:0',
  'twin-base-studio',
  'none',
  'draft',
  '/ngsi-ld/v1',
  100,
  '{"phase":"phase-5-fiware","purpose":"template connection for local dry-run sync tests"}'::jsonb
)
ON CONFLICT (connection_key) DO UPDATE SET
  tenant = EXCLUDED.tenant,
  auth_mode = EXCLUDED.auth_mode,
  status = EXCLUDED.status,
  ngsi_ld_path = EXCLUDED.ngsi_ld_path,
  batch_size = EXCLUDED.batch_size,
  metadata = ldt_fiware.context_broker_connections.metadata || EXCLUDED.metadata,
  updated_at = now();
