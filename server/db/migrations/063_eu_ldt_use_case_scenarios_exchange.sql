ALTER TABLE ldt_interop.eu_ldt_integration_profiles
  DROP CONSTRAINT IF EXISTS eu_ldt_integration_profiles_kind_check;

ALTER TABLE ldt_interop.eu_ldt_integration_profiles
  ADD CONSTRAINT eu_ldt_integration_profiles_kind_check CHECK (platform_kind IN (
    'data-platform',
    'data-modeller',
    'data-space-ready',
    'city-innovation-planner',
    'use-case-scenarios',
    'play-visualise',
    'marketplace-agent',
    'marketplace-hub',
    'oldt-provider',
    'other'
  ));

ALTER TABLE ldt_interop.eu_ldt_acceptance_runs
  DROP CONSTRAINT IF EXISTS eu_ldt_acceptance_runs_tool_kind_check;

ALTER TABLE ldt_interop.eu_ldt_acceptance_runs
  ADD CONSTRAINT eu_ldt_acceptance_runs_tool_kind_check CHECK (
    tool_kind IN ('play-visualise', 'marketplace', 'identity-management', 'use-case-scenarios')
  );

CREATE TABLE IF NOT EXISTS ldt_interop.ucs_case_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  ucs_profile_key text NOT NULL REFERENCES ldt_interop.eu_ldt_integration_profiles(profile_key) ON DELETE CASCADE,
  data_platform_profile_key text NOT NULL REFERENCES ldt_interop.eu_ldt_integration_profiles(profile_key) ON DELETE RESTRICT,
  selection_set_id uuid REFERENCES ldt_analysis.selection_sets(id) ON DELETE SET NULL,
  binding_key text NOT NULL,
  case_id text NOT NULL,
  scope_id text NOT NULL DEFAULT '',
  problem_id text NOT NULL DEFAULT '',
  objective_id text NOT NULL DEFAULT '',
  key_metric_id text NOT NULL DEFAULT '',
  baseline_scenario_id text NOT NULL,
  intervention_scenario_id text NOT NULL,
  baseline_entity_id text NOT NULL,
  intervention_entity_id text NOT NULL,
  baseline_data_source_id text NOT NULL,
  intervention_data_source_id text NOT NULL,
  baseline_data_model_id text NOT NULL,
  intervention_data_model_id text NOT NULL,
  baseline_experiment_id text NOT NULL,
  intervention_experiment_id text NOT NULL,
  baseline_execution_id text NOT NULL,
  intervention_execution_id text NOT NULL,
  baseline_value numeric NOT NULL,
  intervention_value numeric NOT NULL,
  unit text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'registered',
  baseline_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  intervention_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_workflow_run_id uuid REFERENCES ldt_ops.workflow_runs(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ucs_case_bindings_key_check CHECK (binding_key ~ '^[a-z0-9][a-z0-9._-]{1,128}$'),
  CONSTRAINT ucs_case_bindings_status_check CHECK (status IN ('registered', 'executing', 'completed', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ucs_case_bindings_profile_key_uidx
  ON ldt_interop.ucs_case_bindings (ucs_profile_key, binding_key);

CREATE INDEX IF NOT EXISTS ucs_case_bindings_city_status_idx
  ON ldt_interop.ucs_case_bindings (city_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS ucs_case_bindings_selection_idx
  ON ldt_interop.ucs_case_bindings (selection_set_id)
  WHERE selection_set_id IS NOT NULL;

COMMENT ON TABLE ldt_interop.ucs_case_bindings IS
  'OLDT-owned provenance binding for a baseline/intervention cycle executed through EU LDT Use Case & Scenarios, Data Platform, Airflow, and AI Notebook.';

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
  'eu-ldt-use-case-scenarios-roundtrip',
  'EU LDT Use Case & Scenarios Roundtrip',
  'Create a governed baseline/intervention use case from an OLDT selection, publish both metric entities to Data Platform, execute both scenarios through UCS Airflow and AI Notebook, and retain result provenance in OLDT.',
  'city-scenario-experimentation',
  'current',
  'human-approved-worker',
  '{
    "requiresHumanApprovalForRun": true,
    "requiresHumanApprovalForResultEvidence": true,
    "agentCanReadSelectionMetrics": true,
    "agentCanPublishNgsiLdScenarioInputs": true,
    "agentCanCreateExternalUseCase": true,
    "agentCanExecuteExternalExperiments": true,
    "agentCanMutateCanonicalEntities": false
  }'::jsonb,
  '{
    "required": ["cityId", "ucsProfileKey", "dataPlatformProfileKey"],
    "optional": ["selectionSetId", "baselineValue", "interventionValue", "interventionDeltaPercent", "metricKey", "attributeKey", "aggregation", "unit", "bindingKey", "caseName", "modelNamespace", "modelName", "ngsiScope"],
    "sourceContract": "OLDT governed selection metric or explicit operator baseline",
    "transportContract": "EU LDT Data Platform NGSI-LD baseline/intervention entities",
    "targetContract": "EU LDT UCS Case, Scenarios, Data Sources, Data Models, Experiments, and Executions"
  }'::jsonb,
  '{
    "writes": ["external EU LDT Data Platform entities", "external EU LDT UCS resources", "ldt_interop.ucs_case_bindings", "ldt_ops workflow evidence"],
    "reports": ["ucs-metric-resolution", "ucs-data-platform-publication", "ucs-case-structure", "ucs-experiment-executions", "ucs-roundtrip-summary"],
    "doesNotClaim": ["causal policy impact", "authority-approved scenario", "canonical OLDT mutation", "production AI model validation"]
  }'::jsonb,
  '{
    "context": ["NGSI-LD", "EU LDT Data Platform", "EU LDT Use Case & Scenarios", "Airflow", "AI Notebook"],
    "spatialEvidence": "ldt_analysis.selection_sets",
    "localTarget": "OLDT scenario provenance binding"
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
