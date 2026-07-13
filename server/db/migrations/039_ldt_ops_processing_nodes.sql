CREATE SCHEMA IF NOT EXISTS ldt_ops;

CREATE TABLE IF NOT EXISTS ldt_ops.artifact_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  store_type text NOT NULL,
  uri text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'private',
  status text NOT NULL DEFAULT 'active',
  checksum_policy text NOT NULL DEFAULT 'required',
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_ref text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artifact_stores_key_check CHECK (store_key ~ '^[a-z0-9][a-z0-9._-]{1,128}$'),
  CONSTRAINT artifact_stores_type_check CHECK (store_type IN (
    'local-filesystem',
    'sftp-rsync',
    'object-storage',
    'offline-bundle',
    'ephemeral-scratch',
    'manual'
  )),
  CONSTRAINT artifact_stores_visibility_check CHECK (visibility IN ('private', 'internal', 'public-read')),
  CONSTRAINT artifact_stores_status_check CHECK (status IN ('active', 'disabled', 'error', 'archived')),
  CONSTRAINT artifact_stores_checksum_policy_check CHECK (checksum_policy IN ('required', 'optional', 'external'))
);

CREATE INDEX IF NOT EXISTS artifact_stores_type_status_idx
  ON ldt_ops.artifact_stores (store_type, status);

CREATE TABLE IF NOT EXISTS ldt_ops.processing_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  provider_type text NOT NULL,
  connection_mode text NOT NULL,
  runtime_kind text NOT NULL DEFAULT 'unknown',
  runtime_version text,
  image_ref text,
  status text NOT NULL DEFAULT 'registered',
  lifecycle_status text NOT NULL DEFAULT 'generated',
  default_artifact_store_id uuid REFERENCES ldt_ops.artifact_stores(id) ON DELETE SET NULL,
  capabilities_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  registered_by text,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT processing_nodes_key_check CHECK (node_key ~ '^[a-z0-9][a-z0-9._-]{1,128}$'),
  CONSTRAINT processing_nodes_provider_type_check CHECK (provider_type IN (
    'same-server-sidecar',
    'server-to-server-pull',
    'server-to-server-push',
    'offline-bundle',
    'hpc-batch',
    'cloud-batch',
    'manual-import'
  )),
  CONSTRAINT processing_nodes_connection_mode_check CHECK (connection_mode IN (
    'local',
    'pull',
    'push',
    'offline',
    'batch',
    'cloud',
    'manual'
  )),
  CONSTRAINT processing_nodes_runtime_kind_check CHECK (runtime_kind IN (
    'docker',
    'docker-compose',
    'podman',
    'apptainer',
    'singularity',
    'slurm',
    'pbs',
    'cloud-provider',
    'manual',
    'unknown'
  )),
  CONSTRAINT processing_nodes_status_check CHECK (status IN (
    'registered',
    'online',
    'offline',
    'busy',
    'draining',
    'error',
    'disabled'
  )),
  CONSTRAINT processing_nodes_lifecycle_status_check CHECK (lifecycle_status IN (
    'generated',
    'validated',
    'federated',
    'authority-approved',
    'blocked',
    'archived'
  ))
);

CREATE INDEX IF NOT EXISTS processing_nodes_provider_status_idx
  ON ldt_ops.processing_nodes (provider_type, status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS processing_nodes_artifact_store_idx
  ON ldt_ops.processing_nodes (default_artifact_store_id);

CREATE INDEX IF NOT EXISTS processing_nodes_capabilities_gin
  ON ldt_ops.processing_nodes USING gin (capabilities_json);

CREATE TABLE IF NOT EXISTS ldt_ops.processing_node_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES ldt_ops.processing_nodes(id) ON DELETE CASCADE,
  status text NOT NULL,
  doctor_status text NOT NULL DEFAULT 'unknown',
  runtime_version text,
  image_ref text,
  cpu_core_count integer,
  memory_bytes bigint,
  free_disk_bytes bigint,
  running_job_count integer NOT NULL DEFAULT 0,
  capabilities_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  doctor_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT processing_node_heartbeats_status_check CHECK (status IN (
    'registered',
    'online',
    'offline',
    'busy',
    'draining',
    'error',
    'disabled'
  )),
  CONSTRAINT processing_node_heartbeats_doctor_status_check CHECK (doctor_status IN (
    'unknown',
    'passed',
    'warning',
    'failed'
  )),
  CONSTRAINT processing_node_heartbeats_cpu_check CHECK (cpu_core_count IS NULL OR cpu_core_count >= 0),
  CONSTRAINT processing_node_heartbeats_memory_check CHECK (memory_bytes IS NULL OR memory_bytes >= 0),
  CONSTRAINT processing_node_heartbeats_disk_check CHECK (free_disk_bytes IS NULL OR free_disk_bytes >= 0),
  CONSTRAINT processing_node_heartbeats_jobs_check CHECK (running_job_count >= 0)
);

CREATE INDEX IF NOT EXISTS processing_node_heartbeats_node_observed_idx
  ON ldt_ops.processing_node_heartbeats (node_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS processing_node_heartbeats_status_idx
  ON ldt_ops.processing_node_heartbeats (status, doctor_status, received_at DESC);

CREATE TABLE IF NOT EXISTS ldt_ops.processing_node_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid REFERENCES ldt_ops.processing_nodes(id) ON DELETE CASCADE,
  token_name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_scope text NOT NULL DEFAULT 'runtime',
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT processing_node_tokens_scope_check CHECK (token_scope IN (
    'registration',
    'runtime',
    'artifact-transfer',
    'admin'
  )),
  CONSTRAINT processing_node_tokens_status_check CHECK (status IN (
    'active',
    'revoked',
    'expired',
    'disabled'
  )),
  CONSTRAINT processing_node_tokens_plaintext_check CHECK (token_hash !~ '^twin_[A-Za-z0-9_-]+$')
);

CREATE INDEX IF NOT EXISTS processing_node_tokens_node_status_idx
  ON ldt_ops.processing_node_tokens (node_id, status, expires_at);

CREATE TABLE IF NOT EXISTS ldt_ops.processing_node_stage_bindings (
  node_id uuid NOT NULL REFERENCES ldt_ops.processing_nodes(id) ON DELETE CASCADE,
  stage_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  resource_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (node_id, stage_key),
  CONSTRAINT processing_node_stage_bindings_stage_key_check CHECK (stage_key ~ '^[a-z0-9][a-z0-9._-]{1,128}$')
);

CREATE INDEX IF NOT EXISTS processing_node_stage_bindings_stage_idx
  ON ldt_ops.processing_node_stage_bindings (stage_key, enabled, priority);

CREATE TABLE IF NOT EXISTS ldt_ops.data_factory_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id uuid REFERENCES ldt_ops.workflow_runs(id) ON DELETE SET NULL,
  node_id uuid REFERENCES ldt_ops.processing_nodes(id) ON DELETE SET NULL,
  city_id text REFERENCES ldt_core.cities(id) ON DELETE SET NULL,
  stage_key text NOT NULL,
  provider_type text NOT NULL,
  connection_mode text NOT NULL,
  status text NOT NULL DEFAULT 'prepared',
  dispatch_artifact_id uuid REFERENCES ldt_ops.workflow_artifacts(id) ON DELETE SET NULL,
  result_artifact_id uuid REFERENCES ldt_ops.workflow_artifacts(id) ON DELETE SET NULL,
  artifact_store_id uuid REFERENCES ldt_ops.artifact_stores(id) ON DELETE SET NULL,
  dispatch_checksum text,
  result_checksum text,
  input_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifact_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb NOT NULL DEFAULT '{}'::jsonb,
  claimed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_factory_dispatches_stage_key_check CHECK (stage_key ~ '^[a-z0-9][a-z0-9._-]{1,128}$'),
  CONSTRAINT data_factory_dispatches_provider_type_check CHECK (provider_type IN (
    'same-server-sidecar',
    'server-to-server-pull',
    'server-to-server-push',
    'offline-bundle',
    'hpc-batch',
    'cloud-batch',
    'manual-import'
  )),
  CONSTRAINT data_factory_dispatches_connection_mode_check CHECK (connection_mode IN (
    'local',
    'pull',
    'push',
    'offline',
    'batch',
    'cloud',
    'manual'
  )),
  CONSTRAINT data_factory_dispatches_status_check CHECK (status IN (
    'prepared',
    'queued',
    'claimed',
    'running',
    'artifacts-uploading',
    'result-received',
    'validated',
    'promoted',
    'failed',
    'cancelled'
  ))
);

CREATE INDEX IF NOT EXISTS data_factory_dispatches_node_status_idx
  ON ldt_ops.data_factory_dispatches (node_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS data_factory_dispatches_city_stage_idx
  ON ldt_ops.data_factory_dispatches (city_id, stage_key, created_at DESC);

CREATE INDEX IF NOT EXISTS data_factory_dispatches_workflow_idx
  ON ldt_ops.data_factory_dispatches (workflow_run_id);

COMMENT ON TABLE ldt_ops.processing_nodes IS
  'Registered Data Factory execution environments. A node can be same-server, server-to-server, offline, HPC, cloud, or manual-import without becoming a product-specific machine dependency.';

COMMENT ON TABLE ldt_ops.processing_node_heartbeats IS
  'Time-series health, doctor, and capability reports emitted by Data Factory runtimes.';

COMMENT ON TABLE ldt_ops.processing_node_tokens IS
  'Hashed registration/runtime tokens for Data Factory processing nodes. Plaintext tokens must never be stored here.';

COMMENT ON TABLE ldt_ops.artifact_stores IS
  'Configured data-plane locations for heavy Data Factory artifacts such as PMTiles, MVT directories, 3D Tiles, source extracts, and dumps.';

COMMENT ON TABLE ldt_ops.data_factory_dispatches IS
  'Dispatch ledger connecting workflow runs, processing nodes, execution providers, result packages, and artifact manifests.';
