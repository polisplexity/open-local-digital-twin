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
  'eu-ldt-data-platform-publish',
  'EU LDT Data Platform Publish',
  'Publish policy-selected OLDT NGSI-LD city entities to an EU LDT Data Platform endpoint and record push/readback/replication evidence.',
  'external-publication',
  'current',
  'human-approved-worker',
  '{
    "agentCanSelectPublishedNgsiEntities": true,
    "agentCanPushAfterApproval": true,
    "agentCanPublishAuthorityClaims": false,
    "requiresHumanApprovalForRun": true,
    "requiresHumanApprovalForExternalPublication": true,
    "requiresHumanApprovalForPublicationClaim": true
  }'::jsonb,
  '{
    "required": ["cityId", "integrationProfileKey"],
    "optional": ["endpoint", "type", "limit", "offset", "dryRun", "tenant", "scope", "headers", "publicationPolicy", "readback", "replicationCheck"],
    "sourceContract": "ldt_interop.ngsi_entity_projections",
    "recommendedPredecessor": "standards-publication-refresh"
  }'::jsonb,
  '{
    "writes": ["ldt_ops.workflow_runs", "ldt_ops.workflow_steps", "ldt_ops.workflow_artifacts", "external EU LDT Data Platform /api/v1/entities"],
    "reports": ["selected_entities", "ngsi_payloads", "validation_report", "push_results", "readback_results", "replication_check", "external-publication-summary"],
    "doesNotClaim": ["local PostGIS promotion", "authority-approved external dataset", "EU Data Platform internal replication success unless readback proves it"]
  }'::jsonb,
  '{
    "context": ["NGSI-LD", "Smart Data Models"],
    "source": "OLDT standards publication projections",
    "externalTarget": "EU LDT Data Platform Data Management API"
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
