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
    'phase14-open-data-workflow-runner',
    'Open Data Import Runner',
    'Run approved open-data, provider-exchange, and environmental extractor workflows as auditable city operations instead of manual scripts.',
    'open-data-workflows',
    'current',
    'human-approved-worker',
    '{
      "agentCanPrepareSourcePlan": true,
      "agentCanEnqueueApprovedJobs": true,
      "agentCanClassifyProviderPosture": true,
      "agentCanRegisterExtractorRuns": true,
      "agentCanPublishAuthorityClaims": false,
      "requiresHumanApprovalForRun": true,
      "requiresHumanApprovalForProviderAttachment": true,
      "requiresHumanApprovalForPublicationClaim": true
    }'::jsonb,
    '{
      "required": ["cityId", "sourcePlan"],
      "optional": ["providerPackages", "extractorKeys", "refreshViewerAggregates", "validationMode"],
      "sourcePlanKinds": ["osm-local-extract", "overture", "open-geodata", "environmental-extractor", "provider-exchange"],
      "providerPostures": ["receive-only", "open-data-native", "hybrid"]
    }'::jsonb,
    '{
      "writes": ["ldt_ops.workflow_runs", "ldt_ops.workflow_steps", "ldt_ops.workflow_artifacts", "public.layer_ingestion_jobs", "ldt_environment.extractor_runs", "ldt_environment.extractor_artifacts"],
      "reports": ["source-plan", "provider-exchange-classification", "extractor-validation", "workspace-run-summary"],
      "doesNotClaim": ["authority-grade data", "production freshness", "private-data publication"]
    }'::jsonb,
    '{
      "catalog": "DCAT",
      "provenance": "PROV-O",
      "policy": "ODRL",
      "geospatial": ["PostGIS", "OGC API Features", "STAC", "COG"],
      "context": ["NGSI-LD", "FIWARE"]
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
