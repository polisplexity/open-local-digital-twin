CREATE SCHEMA IF NOT EXISTS ldt_ops;

CREATE TABLE IF NOT EXISTS ldt_ops.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key text NOT NULL UNIQUE,
  name text NOT NULL,
  purpose text NOT NULL DEFAULT '',
  domain text NOT NULL DEFAULT 'open-data',
  lifecycle_status text NOT NULL DEFAULT 'draft',
  default_mode text NOT NULL DEFAULT 'assisted',
  agent_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  standards_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_definitions_domain_idx
  ON ldt_ops.workflow_definitions (domain, lifecycle_status);

CREATE TABLE IF NOT EXISTS ldt_ops.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES ldt_ops.workflow_definitions(id) ON DELETE SET NULL,
  workflow_key text NOT NULL,
  city_id text REFERENCES ldt_core.cities(id) ON DELETE SET NULL,
  requested_by text,
  requested_by_kind text NOT NULL DEFAULT 'human',
  trigger_kind text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'queued',
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_runs_city_status_idx
  ON ldt_ops.workflow_runs (city_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS workflow_runs_workflow_idx
  ON ldt_ops.workflow_runs (workflow_key, created_at DESC);

CREATE TABLE IF NOT EXISTS ldt_ops.workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES ldt_ops.workflow_runs(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  step_order integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  tool_kind text NOT NULL DEFAULT 'system',
  started_at timestamptz,
  finished_at timestamptz,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, step_key)
);

CREATE INDEX IF NOT EXISTS workflow_steps_run_order_idx
  ON ldt_ops.workflow_steps (run_id, step_order);

CREATE TABLE IF NOT EXISTS ldt_ops.workflow_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES ldt_ops.workflow_runs(id) ON DELETE CASCADE,
  step_id uuid REFERENCES ldt_ops.workflow_steps(id) ON DELETE SET NULL,
  city_id text REFERENCES ldt_core.cities(id) ON DELETE SET NULL,
  artifact_kind text NOT NULL,
  artifact_uri text NOT NULL,
  media_type text,
  byte_size bigint,
  checksum text,
  dataset_id uuid REFERENCES ldt_catalog.datasets(id) ON DELETE SET NULL,
  source_feature_id uuid REFERENCES ldt_prov.source_features(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_artifacts_run_idx
  ON ldt_ops.workflow_artifacts (run_id, artifact_kind);

CREATE INDEX IF NOT EXISTS workflow_artifacts_city_idx
  ON ldt_ops.workflow_artifacts (city_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ldt_ops.workflow_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES ldt_ops.workflow_runs(id) ON DELETE CASCADE,
  approval_key text NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  requested_by text,
  decided_by text,
  decided_at timestamptz,
  decision_reason text NOT NULL DEFAULT '',
  policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, approval_key)
);

CREATE INDEX IF NOT EXISTS workflow_approvals_status_idx
  ON ldt_ops.workflow_approvals (status, created_at DESC);

CREATE TABLE IF NOT EXISTS ldt_ops.api_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text,
  route_family text NOT NULL,
  method text NOT NULL,
  path_template text NOT NULL,
  status_code integer NOT NULL,
  latency_ms integer,
  city_id text,
  actor_user_id text,
  actor_role text,
  api_version text NOT NULL DEFAULT 'compat',
  consumer_key text,
  error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_usage_events_route_created_idx
  ON ldt_ops.api_usage_events (route_family, created_at DESC);

CREATE INDEX IF NOT EXISTS api_usage_events_city_created_idx
  ON ldt_ops.api_usage_events (city_id, created_at DESC);

CREATE INDEX IF NOT EXISTS api_usage_events_status_created_idx
  ON ldt_ops.api_usage_events (status_code, created_at DESC);

INSERT INTO ldt_ops.workflow_definitions (
  workflow_key,
  name,
  purpose,
  domain,
  lifecycle_status,
  default_mode,
  agent_policy,
  input_contract,
  output_contract,
  standards_mapping
)
VALUES
  (
    'open-data-city-bootstrap',
    'Open Data City Bootstrap',
    'Create or refresh the public-data base twin from open sources while preserving source artifacts, catalog metadata, provenance, and consolidated inventory.',
    'open-data-ingestion',
    'reference',
    'agent-assisted',
    '{
      "agentCanSuggestSources": true,
      "agentCanRunWithApproval": true,
      "agentCanPublishAuthorityClaims": false,
      "requiresHumanApprovalForPrivateData": true,
      "requiresHumanApprovalForAuthorityStatus": true
    }'::jsonb,
    '{
      "required": ["cityId", "sourcePlan"],
      "sources": ["osm", "overture", "wikipedia", "ogc-api-features", "ckan", "stac", "csv", "geojson"]
    }'::jsonb,
    '{
      "writes": ["ldt_catalog.datasets", "ldt_prov.source_features", "ldt_core.city_entities", "ldt_viewer.city_summary_cache"],
      "reports": ["source-quality", "geometry-validation", "coverage-gaps"]
    }'::jsonb,
    '{
      "catalog": "DCAT",
      "provenance": "PROV-O",
      "geospatial": ["OGC API Features", "PostGIS"],
      "context": ["NGSI-LD", "FIWARE"]
    }'::jsonb
  ),
  (
    'private-provider-validation',
    'Private And Provider Data Validation',
    'Validate city-private or third-party provider datasets before they can enrich the consolidated twin or become authority-grade layers.',
    'provider-validation',
    'planned',
    'human-approved',
    '{
      "agentCanSuggestMappings": true,
      "agentCanRunValidation": true,
      "agentCanAcceptAuthorityData": false,
      "requiresHumanApprovalForPrivateData": true,
      "requiresHumanApprovalForPublication": true
    }'::jsonb,
    '{
      "required": ["cityId", "providerId", "layerKey", "dataPackage"],
      "formats": ["geojson", "csv", "ogc-api-features", "wfs", "stac", "cityjson", "ifc", "geopackage", "shapefile"]
    }'::jsonb,
    '{
      "writes": ["public.layer_ingestion_jobs", "ldt_catalog.datasets", "ldt_prov.source_features"],
      "requiresReviewBefore": ["ldt_core.city_entities", "authority-status"]
    }'::jsonb,
    '{
      "catalog": "DCAT",
      "provenance": "PROV-O",
      "policy": "ODRL",
      "geospatial": ["OGC API Features", "CityJSON", "IFC"]
    }'::jsonb
  ),
  (
    'standards-publication-refresh',
    'Standards Publication Refresh',
    'Regenerate DCAT, NGSI-LD, OGC API Features, viewer aggregates, science observations, society observations, and semantic-pack reports from the consolidated inventory.',
    'standards-publication',
    'reference',
    'agent-assisted',
    '{
      "agentCanRunAfterIngestion": true,
      "agentCanExplainResults": true,
      "agentCanChangeContracts": false,
      "requiresHumanApprovalForVersionChange": true
    }'::jsonb,
    '{
      "required": ["cityId"],
      "optional": ["packKey", "refreshViewerAggregates", "refreshScience", "refreshSociety", "refreshInterop"]
    }'::jsonb,
    '{
      "writes": ["ldt_interop", "ldt_viewer", "ldt_science", "ldt_society", "ldt_semantic"],
      "reports": ["capability-state", "api-publication-state", "quality-caveats"]
    }'::jsonb,
    '{
      "catalog": "DCAT",
      "context": ["NGSI-LD", "FIWARE"],
      "geospatial": ["OGC API Features"],
      "semantic": ["JSON-LD", "semantic-pack-manifest"]
    }'::jsonb
  )
ON CONFLICT (workflow_key) DO UPDATE SET
  name = EXCLUDED.name,
  purpose = EXCLUDED.purpose,
  domain = EXCLUDED.domain,
  lifecycle_status = EXCLUDED.lifecycle_status,
  default_mode = EXCLUDED.default_mode,
  agent_policy = EXCLUDED.agent_policy,
  input_contract = EXCLUDED.input_contract,
  output_contract = EXCLUDED.output_contract,
  standards_mapping = EXCLUDED.standards_mapping,
  updated_at = now();
