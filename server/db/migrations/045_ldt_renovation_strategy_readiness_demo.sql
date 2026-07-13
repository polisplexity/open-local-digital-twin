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
  'renovation-strategy-readiness-demo',
  'Renovation Strategy Readiness Demo',
  'Assess whether OLDT building data can feed the EU LDT Renova optimization model without claiming production readiness.',
  'external-model-readiness',
  'current-demo',
  'operator-approved-readiness-demo',
  '{"requiresApproval":true,"demoOnly":true,"productionClaimAllowed":false}'::jsonb,
  '{"required":["cityId"],"optional":["limit","countryCode","costCatalogPolicy","archetypePolicy","demoMode","modelEndpoint"]}'::jsonb,
  '{"artifacts":["renovation-readiness-report","renovation-input-gap-report","renovation-demo-package-plan","renovation-strategy-readiness-summary"],"terminalReadinessStates":["ready-real-inputs","partial-inputs","synthetic-smoke","blocked-missing-archetypes","blocked-missing-costs","blocked-missing-geometries"]}'::jsonb,
  '{"standardsAffected":"none-until-derived-output-accepted","publicationStatus":"not_applicable"}'::jsonb
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
