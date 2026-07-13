ALTER TABLE ldt_interop.eu_ldt_integration_profiles
  DROP CONSTRAINT IF EXISTS eu_ldt_integration_profiles_kind_check;

ALTER TABLE ldt_interop.eu_ldt_integration_profiles
  ADD CONSTRAINT eu_ldt_integration_profiles_kind_check CHECK (platform_kind IN (
    'data-platform',
    'data-modeller',
    'play-visualise',
    'marketplace-agent',
    'marketplace-hub',
    'oldt-provider',
    'other'
  ));

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
  'eu-ldt-data-modeller-prepare-schema',
  'EU LDT Data Modeller Prepare Schema',
  'Select canonical OLDT city objects, infer a Synth-compatible schema, and register the draft schema in a configured EU LDT Data Modeller instance.',
  'external-data-modelling',
  'current',
  'human-approved-worker',
  '{
    "requiresHumanApprovalForRun": true,
    "requiresHumanApprovalForSchemaEvidence": true,
    "agentCanReadCanonicalObjects": true,
    "agentCanRegisterExternalSchema": true,
    "agentCanApproveExternalSchema": false
  }'::jsonb,
  '{
    "required": ["cityId", "integrationProfileKey", "entityType"],
    "optional": ["limit", "schemaName", "referenceName", "version", "ownership", "description", "tags", "outputField", "outputMinimum", "outputMaximum"],
    "sourceContract": "OLDT canonical city-object read model",
    "targetContract": "EU LDT Data Modeller Synth schema"
  }'::jsonb,
  '{
    "writes": ["ldt_ops.workflow_runs", "ldt_ops.workflow_steps", "ldt_ops.workflow_artifacts", "external EU LDT Data Modeller /api/v1/schemas"],
    "reports": ["data-modeller-profile", "canonical-sample", "synth-schema", "data-modeller-schema-registration", "data-modeller-schema-summary"],
    "doesNotClaim": ["schema approval", "authority-approved data", "canonical OLDT mutation"]
  }'::jsonb,
  '{
    "context": ["EU LDT Data Modeller", "Synth schema", "OLDT canonical entity identity"],
    "source": "ldt_query.city_objects_enriched",
    "externalTarget": "EU LDT Data Modeller"
  }'::jsonb
),
(
  'eu-ldt-data-modeller-fixture-import',
  'EU LDT Data Modeller Fixture Import',
  'Generate synthetic records from an approved Data Modeller schema and attach a selected generated field to canonical OLDT entities as append-only simulated model outputs.',
  'external-data-modelling',
  'current',
  'human-approved-worker',
  '{
    "requiresHumanApprovalForRun": true,
    "requiresApprovedExternalSchema": true,
    "requiresMinimumEvaluationScore": true,
    "requiresHumanApprovalForImportEvidence": true,
    "agentCanGenerateSyntheticFixtures": true,
    "agentCanMutateCanonicalEntities": false
  }'::jsonb,
  '{
    "required": ["cityId", "integrationProfileKey", "schemaId", "entityType", "modelKey", "outputField", "outputKey"],
    "optional": ["recordCount", "modelVersion", "minimumEvaluationScore", "unit"],
    "sourceContract": "Approved EU LDT Data Modeller schema and deterministic OLDT entity selection",
    "targetContract": "Append-only simulated OLDT entity model outputs"
  }'::jsonb,
  '{
    "writes": ["ldt_enrichment.entity_model_outputs", "ldt_ops.workflow_runs", "ldt_ops.workflow_steps", "ldt_ops.workflow_artifacts"],
    "reports": ["data-modeller-schema-gate", "synthetic-fixture", "fixture-entity-mapping", "imported-simulated-outputs", "data-modeller-fixture-summary"],
    "doesNotClaim": ["observed municipal data", "authority-approved model result", "canonical OLDT mutation", "Data Modeller direct database insertion"]
  }'::jsonb,
  '{
    "context": ["EU LDT Data Modeller", "Synth fixture", "OLDT model enrichment"],
    "source": "EU LDT Data Modeller /api/v1/data-generator",
    "externalTarget": "ldt_enrichment.entity_model_outputs"
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
