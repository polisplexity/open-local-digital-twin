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
  'eu-ldt-play-visualise-register-layer',
  'EU Play & Visualise Register Layer',
  'Register an OLDT OGC API Features collection as a Play & Visualise Map/DataSource/DataLayer and verify that the visualisation stack can consume the OLDT source.',
  'external-visualisation-registration',
  'current',
  'human-approved-worker',
  '{
    "agentCanRegisterExternalVisualisationLayer": true,
    "agentCanExposeOldtReadEndpoint": true,
    "agentCanPublishAuthorityClaims": false,
    "requiresHumanApprovalForRun": true,
    "requiresHumanApprovalForConsumptionEvidence": true
  }'::jsonb,
  '{
    "required": ["cityId", "integrationProfileKey", "collectionKey"],
    "optional": ["limit", "sourceUrl", "dataSourceName", "layerName", "layerType", "mapName", "mapDescription", "configuration", "oldtCookie", "oldtAuthMode", "playVisualiseDatabaseUrl"],
    "sourceContract": "OLDT OGC API Features collection",
    "targetContract": "EU Play & Visualise map/datasource/datalayer registry"
  }'::jsonb,
  '{
    "writes": ["ldt_ops.workflow_runs", "ldt_ops.workflow_steps", "ldt_ops.workflow_artifacts", "external Play & Visualise map/datasource/datalayer registry"],
    "reports": ["visualise-profile", "visualise-source", "visualise-registration", "visualise-consumption-check", "visualise-registration-summary"],
    "doesNotClaim": ["authority-approved publication", "model result validation"]
  }'::jsonb,
  '{
    "context": ["OGC API Features", "GeoJSON"],
    "source": "OLDT standards endpoint",
    "externalTarget": "EU Play & Visualise"
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
