CREATE SCHEMA IF NOT EXISTS ldt_interop;

CREATE TABLE IF NOT EXISTS ldt_interop.external_entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  external_system text NOT NULL,
  external_entity_id text NOT NULL,
  external_type text NOT NULL DEFAULT '',
  external_scope text NOT NULL DEFAULT '',
  relation_kind text NOT NULL DEFAULT 'same_as',
  status text NOT NULL DEFAULT 'active',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_published_at timestamptz,
  last_imported_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_entity_links_relation_check CHECK (relation_kind IN ('same_as', 'source_of', 'derived_from')),
  CONSTRAINT external_entity_links_status_check CHECK (status IN ('active', 'quarantined', 'retired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ldt_interop_external_entity_links_external_uidx
  ON ldt_interop.external_entity_links (external_system, external_entity_id);

CREATE INDEX IF NOT EXISTS ldt_interop_external_entity_links_entity_idx
  ON ldt_interop.external_entity_links (city_id, entity_id, external_system, status);

CREATE INDEX IF NOT EXISTS ldt_interop_external_entity_links_scope_idx
  ON ldt_interop.external_entity_links (external_system, external_scope, external_type, status);

COMMENT ON TABLE ldt_interop.external_entity_links IS
  'Stable reconciliation map between canonical OLDT city entities and external platform identifiers. External IDs must not replace OLDT UUID identity.';

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
  'eu-ldt-data-platform-import-results',
  'EU LDT Data Platform Import Results',
  'Import model-derived NGSI-LD result entities from EU LDT Data Platform back into OLDT as anchored model outputs, using external ID mapping and quarantine rules.',
  'external-model-results-import',
  'current',
  'human-approved-worker',
  '{
    "agentCanReadExternalDataPlatform": true,
    "agentCanImportMappedDerivedOutputs": true,
    "agentCanCreateCanonicalCityObjects": false,
    "requiresHumanApprovalForRun": true,
    "requiresHumanApprovalForUnmappedImports": true
  }'::jsonb,
  '{
    "required": ["cityId", "integrationProfileKey"],
    "optional": ["endpoint", "type", "limit", "headers", "modelKey", "modelVersion", "outputKey", "sourceBatchId", "allowUnmapped"],
    "sourceContract": "EU LDT Data Platform /api/v1/entities",
    "requiredReconciliation": "ldt_interop.external_entity_links"
  }'::jsonb,
  '{
    "writes": ["ldt_interop.external_entity_links", "ldt_enrichment.entity_model_outputs", "ldt_ops.workflow_runs", "ldt_ops.workflow_steps", "ldt_ops.workflow_artifacts"],
    "reports": ["external-result-readback", "reconciliation-report", "imported-model-outputs", "quarantine-report"],
    "doesNotClaim": ["canonical city object creation", "authority-approved model result", "unmapped result promotion"]
  }'::jsonb,
  '{
    "context": ["NGSI-LD", "Smart Data Models"],
    "source": "EU LDT Data Platform Data Management API",
    "localTarget": "OLDT enrichment model outputs"
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
