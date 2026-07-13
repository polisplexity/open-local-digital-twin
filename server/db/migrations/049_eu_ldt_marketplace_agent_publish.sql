ALTER TABLE ldt_interop.eu_ldt_integration_profiles
  DROP CONSTRAINT IF EXISTS eu_ldt_integration_profiles_kind_check;

ALTER TABLE ldt_interop.eu_ldt_integration_profiles
  ADD CONSTRAINT eu_ldt_integration_profiles_kind_check CHECK (platform_kind IN (
    'data-platform',
    'play-visualise',
    'marketplace-agent',
    'marketplace-hub',
    'oldt-provider',
    'other'
  ));

-- Instance-specific EU LDT profiles are configured after city onboarding.

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
  'eu-ldt-marketplace-agent-publish',
  'EU LDT Marketplace Agent Publish',
  'Package an OLDT query, layer, model output, or semantic asset, validate its interoperability metadata, upload it to one or more configured EU LDT Marketplace Agents, and optionally publish it as Marketplace offerings.',
  'external-marketplace-publication',
  'current',
  'human-approved-worker',
  '{
    "agentCanUploadMarketplaceAssets": true,
    "agentCanPublishMarketplaceOfferings": true,
    "agentCanUseMultipleMarketplaceAgentProfiles": true,
    "requiresHumanApprovalForRun": true,
    "requiresHumanApprovalForPublicationEvidence": true
  }'::jsonb,
  '{
    "required": ["cityId"],
    "optional": ["integrationProfileKey", "integrationProfileKeys", "assetType", "title", "description", "licence", "categories", "price", "publishToHub", "payload", "sourceUrl", "collectionKey", "limit", "compatibilityTargets"],
    "sourceContract": "OLDT Marketplace Package",
    "targetContract": "EU LDT Marketplace Agent asset and optional Marketplace offering"
  }'::jsonb,
  '{
    "writes": ["ldt_ops.workflow_runs", "ldt_ops.workflow_steps", "ldt_ops.workflow_artifacts", "external EU LDT Marketplace Agent /api/v1/agent/assets"],
    "reports": ["marketplace-package", "marketplace-validation", "marketplace-agent-upload", "marketplace-agent-publish", "marketplace-publication-summary"],
    "doesNotClaim": ["municipal ownership of Agent", "authority-approved commercial publication without operator approval"]
  }'::jsonb,
  '{
    "context": ["EU LDT Marketplace", "GeoJSON", "NGSI-LD", "OGC API Features", "DCAT-style metadata"],
    "source": "OLDT package builder",
    "externalTarget": "EU LDT Marketplace Agent"
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
