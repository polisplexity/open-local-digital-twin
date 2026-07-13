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
  'eu-ldt-data-space-publish',
  'EU Data Space Query Publication',
  'Export a bounded OLDT TwinQuery as an immutable governed package and publish it through a configured EDC provider. Consumer discovery, negotiation, and transfer remain independent Data Space Ready actions.',
  'external-data-space-publication',
  'current',
  'human-approved-worker',
  '{
    "requiresHumanApprovalForRun": true,
    "agentCanReadTwinQueryResults": true,
    "agentCanPublishEdcAssets": true,
    "agentCanCreateOdrlPolicies": true,
    "agentCanNegotiateContracts": false,
    "agentCanStartTransfers": false,
    "agentCanMutateCanonicalEntities": false
  }'::jsonb,
  '{
    "required": ["cityId", "providerIntegrationProfileKey", "query", "title"],
    "optional": ["description", "format", "limit", "licence", "timeoutMs"],
    "sourceContract": "OLDT TwinQuery export plus DCAT/PROV manifest",
    "targetContract": "Data Space Ready EDC asset, ODRL policy, and contract definition"
  }'::jsonb,
  '{
    "writes": ["ldt_interop.data_space_asset_packages", "ldt_ops.workflow_runs", "ldt_ops.workflow_steps", "ldt_ops.workflow_artifacts", "external Data Space Ready EDC provider"],
    "reports": ["data-space-package", "edc-policy", "edc-asset", "edc-contract-definition", "data-space-publication-summary"],
    "doesNotClaim": ["consumer agreement", "completed transfer", "payload receipt", "commercial marketplace listing", "canonical OLDT mutation"]
  }'::jsonb,
  '{
    "context": ["EU LDT Data Space Ready", "Eclipse Dataspace Connector", "DSP", "ODRL", "DCAT", "PROV", "GeoJSON"],
    "source": "OLDT TwinQuery export",
    "externalTarget": "Configured Data Space Ready provider participant"
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
