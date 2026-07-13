ALTER TABLE ldt_interop.eu_ldt_integration_profiles
  DROP CONSTRAINT IF EXISTS eu_ldt_integration_profiles_kind_check;

ALTER TABLE ldt_interop.eu_ldt_integration_profiles
  ADD CONSTRAINT eu_ldt_integration_profiles_kind_check CHECK (platform_kind IN (
    'data-platform',
    'data-modeller',
    'data-space-ready',
    'play-visualise',
    'marketplace-agent',
    'marketplace-hub',
    'oldt-provider',
    'other'
  ));

CREATE TABLE IF NOT EXISTS ldt_interop.data_space_asset_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_key text NOT NULL UNIQUE,
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  workflow_run_id uuid REFERENCES ldt_ops.workflow_runs(id) ON DELETE SET NULL,
  integration_profile_key text REFERENCES ldt_interop.eu_ldt_integration_profiles(profile_key) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  licence text NOT NULL DEFAULT 'CC-BY-4.0',
  format text NOT NULL,
  file_name text NOT NULL,
  media_type text NOT NULL,
  content text NOT NULL,
  byte_size bigint NOT NULL,
  sha256 text NOT NULL,
  access_token text NOT NULL,
  source_query jsonb NOT NULL DEFAULT '{}'::jsonb,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'packaged',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_space_asset_packages_key_check CHECK (package_key ~ '^[a-z0-9][a-z0-9._-]{1,160}$'),
  CONSTRAINT data_space_asset_packages_format_check CHECK (format IN ('csv', 'json', 'jsonl', 'geojson', 'cityjson')),
  CONSTRAINT data_space_asset_packages_status_check CHECK (status IN ('packaged', 'published', 'contracted', 'transferred', 'failed')),
  CONSTRAINT data_space_asset_packages_size_check CHECK (byte_size >= 0),
  CONSTRAINT data_space_asset_packages_sha_check CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT data_space_asset_packages_token_check CHECK (length(access_token) >= 32)
);

CREATE UNIQUE INDEX IF NOT EXISTS data_space_asset_packages_workflow_idx
  ON ldt_interop.data_space_asset_packages (workflow_run_id)
  WHERE workflow_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS data_space_asset_packages_city_created_idx
  ON ldt_interop.data_space_asset_packages (city_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ldt_interop.data_space_transfer_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES ldt_interop.data_space_asset_packages(id) ON DELETE CASCADE,
  workflow_run_id uuid REFERENCES ldt_ops.workflow_runs(id) ON DELETE SET NULL,
  receipt_token text NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  media_type text,
  byte_size bigint,
  sha256 text,
  content text,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_space_transfer_receipts_status_check CHECK (status IN ('waiting', 'received', 'verified', 'mismatch', 'failed')),
  CONSTRAINT data_space_transfer_receipts_token_check CHECK (length(receipt_token) >= 32),
  CONSTRAINT data_space_transfer_receipts_size_check CHECK (byte_size IS NULL OR byte_size >= 0),
  CONSTRAINT data_space_transfer_receipts_sha_check CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS data_space_transfer_receipts_package_run_idx
  ON ldt_interop.data_space_transfer_receipts (package_id, workflow_run_id)
  WHERE workflow_run_id IS NOT NULL;

-- Instance-specific EU LDT profiles are configured after city onboarding.

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
VALUES (
  'eu-ldt-data-space-query-exchange',
  'EU LDT Data Space Query Exchange',
  'Export a bounded OLDT TwinQuery as an immutable governed package, publish it through a configured Data Space Ready EDC provider, negotiate it from a configured consumer, transfer it back to a controlled receipt endpoint, and verify content integrity.',
  'external-data-space-exchange',
  'current',
  'human-approved-worker',
  '{
    "requiresHumanApprovalForRun": true,
    "requiresHumanApprovalForTransferEvidence": true,
    "agentCanReadTwinQueryResults": true,
    "agentCanPublishEdcAssets": true,
    "agentCanCreateOdrlPolicies": true,
    "agentCanNegotiateContracts": true,
    "agentCanStartTransfers": true,
    "agentCanMutateCanonicalEntities": false
  }'::jsonb,
  '{
    "required": ["cityId", "providerIntegrationProfileKey", "consumerIntegrationProfileKey", "query", "title"],
    "optional": ["description", "format", "limit", "licence", "policyMode", "timeoutMs"],
    "sourceContract": "OLDT TwinQuery export plus DCAT/PROV manifest",
    "targetContract": "Data Space Ready EDC asset, policy, contract definition, agreement, transfer, and verified receipt"
  }'::jsonb,
  '{
    "writes": ["ldt_interop.data_space_asset_packages", "ldt_interop.data_space_transfer_receipts", "ldt_ops.workflow_runs", "ldt_ops.workflow_steps", "ldt_ops.workflow_artifacts", "external Data Space Ready EDC provider and consumer"],
    "reports": ["data-space-package", "edc-policy", "edc-asset", "edc-contract-definition", "edc-catalog-offer", "edc-contract-agreement", "edc-transfer", "data-space-transfer-receipt", "data-space-exchange-summary"],
    "doesNotClaim": ["authority-approved publication", "commercial marketplace listing", "canonical OLDT mutation", "general interoperability with untested EDC implementations"]
  }'::jsonb,
  '{
    "context": ["EU LDT Data Space Ready", "Eclipse Dataspace Connector", "DSP", "ODRL", "DCAT", "PROV", "GeoJSON"],
    "source": "OLDT TwinQuery export",
    "externalTarget": "Configured Data Space Ready provider and consumer participants"
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
