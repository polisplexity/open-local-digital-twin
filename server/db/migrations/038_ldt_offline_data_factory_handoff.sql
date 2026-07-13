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
  'offline-data-factory-handoff',
  'Data Factory Compute Handoff',
  'Send heavy processing to VPS, HPC, sidecar, or external Data Factory environments, then promote validated PostGIS rows and viewer artifacts back into Twin Studio.',
  'data-factory',
  'current',
  'offline-data-factory',
  '{
    "agentCanPreparePackage": true,
    "agentCanRunExternalCompute": false,
    "agentCanPromoteResultsWithoutValidation": false,
    "requiresOperatorForExternalExecution": true,
    "requiresValidationBeforePromotion": true
  }'::jsonb,
  '{
    "required": ["cityId", "stageKey", "executionMode"],
    "executionModes": ["offline-data-factory"],
    "allowedStages": ["ingestion-queue", "environmental-extractors", "viewer-artifacts", "semantic-materialization"]
  }'::jsonb,
  '{
    "writes": ["ldt_ops.workflow_runs", "ldt_ops.workflow_artifacts"],
    "exports": ["offline-data-factory-handoff-json"],
    "promotesBackTo": ["PostGIS canonical twin", "ldt_viewer.viewer_artifacts"],
    "doesNotClaim": ["external job completed", "authority-approved results", "automatic production promotion"]
  }'::jsonb,
  '{
    "catalog": "DCAT",
    "provenance": "PROV-O",
    "geospatial": ["PostGIS", "MVT", "PMTiles", "3D Tiles"],
    "semantic": ["semantic-pack-manifest"]
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
