ALTER TABLE ldt_interop.eu_ldt_integration_profiles
  DROP CONSTRAINT IF EXISTS eu_ldt_integration_profiles_kind_check;

ALTER TABLE ldt_interop.eu_ldt_integration_profiles
  ADD CONSTRAINT eu_ldt_integration_profiles_kind_check CHECK (platform_kind IN (
    'data-platform',
    'data-modeller',
    'data-space-ready',
    'city-innovation-planner',
    'play-visualise',
    'marketplace-agent',
    'marketplace-hub',
    'oldt-provider',
    'other'
  ));

CREATE TABLE IF NOT EXISTS ldt_interop.cip_metric_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  cip_profile_key text NOT NULL REFERENCES ldt_interop.eu_ldt_integration_profiles(profile_key) ON DELETE CASCADE,
  data_platform_profile_key text NOT NULL REFERENCES ldt_interop.eu_ldt_integration_profiles(profile_key) ON DELETE RESTRICT,
  selection_set_id uuid REFERENCES ldt_analysis.selection_sets(id) ON DELETE SET NULL,
  cip_kpi_id text NOT NULL,
  cip_datasource_id text NOT NULL DEFAULT '',
  binding_key text NOT NULL,
  kpi_name text NOT NULL DEFAULT '',
  formula_parameter text NOT NULL DEFAULT 'OldtValue',
  result_json_path text NOT NULL DEFAULT '$.observedValue.value',
  ngsi_entity_id text NOT NULL,
  ngsi_entity_type text NOT NULL DEFAULT 'KeyPerformanceIndicatorSource',
  ngsi_scope text NOT NULL DEFAULT '',
  ngsi_property text NOT NULL DEFAULT 'observedValue',
  aggregation text NOT NULL DEFAULT 'value',
  metric_key text NOT NULL DEFAULT '',
  attribute_key text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  last_published_value numeric,
  last_published_at timestamptz,
  last_verified_at timestamptz,
  source_workflow_run_id uuid REFERENCES ldt_ops.workflow_runs(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cip_metric_bindings_key_check CHECK (binding_key ~ '^[a-z0-9][a-z0-9._-]{1,128}$'),
  CONSTRAINT cip_metric_bindings_status_check CHECK (status IN ('active', 'paused', 'retired')),
  CONSTRAINT cip_metric_bindings_aggregation_check CHECK (aggregation IN ('value', 'count', 'avg', 'sum', 'min', 'max'))
);

CREATE UNIQUE INDEX IF NOT EXISTS cip_metric_bindings_profile_key_uidx
  ON ldt_interop.cip_metric_bindings (cip_profile_key, binding_key);

CREATE UNIQUE INDEX IF NOT EXISTS cip_metric_bindings_remote_datasource_uidx
  ON ldt_interop.cip_metric_bindings (cip_profile_key, cip_kpi_id, cip_datasource_id)
  WHERE cip_datasource_id <> '';

CREATE INDEX IF NOT EXISTS cip_metric_bindings_city_status_idx
  ON ldt_interop.cip_metric_bindings (city_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS cip_metric_bindings_selection_idx
  ON ldt_interop.cip_metric_bindings (selection_set_id)
  WHERE selection_set_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ldt_interop.cip_measurement_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  cip_profile_key text NOT NULL REFERENCES ldt_interop.eu_ldt_integration_profiles(profile_key) ON DELETE CASCADE,
  binding_id uuid REFERENCES ldt_interop.cip_metric_bindings(id) ON DELETE SET NULL,
  cip_kpi_id text NOT NULL,
  cip_measurement_id text NOT NULL,
  measure_date timestamptz,
  measure numeric,
  status text NOT NULL DEFAULT '',
  failing_reason text NOT NULL DEFAULT '',
  errors text NOT NULL DEFAULT '',
  kpi_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  remote_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_workflow_run_id uuid REFERENCES ldt_ops.workflow_runs(id) ON DELETE SET NULL,
  first_received_at timestamptz NOT NULL DEFAULT now(),
  last_received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cip_measurement_receipts_remote_uidx
  ON ldt_interop.cip_measurement_receipts (cip_profile_key, cip_measurement_id);

CREATE INDEX IF NOT EXISTS cip_measurement_receipts_city_date_idx
  ON ldt_interop.cip_measurement_receipts (city_id, measure_date DESC, last_received_at DESC);

CREATE INDEX IF NOT EXISTS cip_measurement_receipts_binding_idx
  ON ldt_interop.cip_measurement_receipts (binding_id, measure_date DESC)
  WHERE binding_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ldt_interop.cip_initiative_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  cip_profile_key text NOT NULL REFERENCES ldt_interop.eu_ldt_integration_profiles(profile_key) ON DELETE CASCADE,
  cip_initiative_id text NOT NULL,
  selection_set_id uuid REFERENCES ldt_analysis.selection_sets(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  initiative_status text NOT NULL DEFAULT '',
  progress_status text NOT NULL DEFAULT '',
  percentage_progress numeric,
  global_risk_score text NOT NULL DEFAULT '',
  budget numeric,
  start_date timestamptz,
  end_date timestamptz,
  remote_updated_at timestamptz,
  initiative_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  link_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_workflow_run_id uuid REFERENCES ldt_ops.workflow_runs(id) ON DELETE SET NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cip_initiative_links_remote_uidx
  ON ldt_interop.cip_initiative_links (cip_profile_key, cip_initiative_id);

CREATE INDEX IF NOT EXISTS cip_initiative_links_city_status_idx
  ON ldt_interop.cip_initiative_links (city_id, initiative_status, last_synced_at DESC);

CREATE INDEX IF NOT EXISTS cip_initiative_links_selection_idx
  ON ldt_interop.cip_initiative_links (selection_set_id)
  WHERE selection_set_id IS NOT NULL;

COMMENT ON TABLE ldt_interop.cip_metric_bindings IS
  'Explainable bridge from an OLDT selection or metric to a Data Platform NGSI-LD property and a City Innovation Planner KPI datasource.';

COMMENT ON TABLE ldt_interop.cip_measurement_receipts IS
  'Append-only reconciliation receipts for KPI measurements read from City Innovation Planner. The spatial evidence remains in OLDT selections.';

COMMENT ON TABLE ldt_interop.cip_initiative_links IS
  'City Innovation Planner initiative snapshots linked to optional OLDT selection sets. CIP remains the planning authority and OLDT owns the spatial binding.';

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
VALUES
(
  'eu-ldt-cip-publish-metric-source',
  'EU LDT CIP Publish Metric Source',
  'Materialize an explainable OLDT selection metric as an NGSI-LD entity in the selected Data Platform and bind it to a City Innovation Planner KPI broker datasource.',
  'city-planning-kpi-exchange',
  'current',
  'human-approved-worker',
  '{
    "requiresHumanApprovalForRun": true,
    "agentCanReadSelectionMetrics": true,
    "agentCanPublishNgsiLdMetricSource": true,
    "agentCanConfigureCipDatasource": true,
    "agentCanCreateMunicipalInitiative": false
  }'::jsonb,
  '{
    "required": ["cityId", "cipProfileKey", "dataPlatformProfileKey"],
    "optional": ["selectionSetId", "value", "metricKey", "attributeKey", "aggregation", "unit", "ngsiEntityId", "ngsiProperty", "cipKpiId", "createKpi", "kpiName", "requestCalculation"],
    "sourceContract": "OLDT selection metric or explicit operator value",
    "transportContract": "EU LDT Data Platform NGSI-LD entity",
    "targetContract": "City Innovation Planner broker datasource"
  }'::jsonb,
  '{
    "writes": ["ldt_interop.cip_metric_bindings", "external EU LDT Data Platform entity", "optional CIP KPI datasource", "ldt_ops workflow evidence"],
    "reports": ["metric-source-resolution", "ngsi-ld-readback", "cip-kpi-binding", "publication-summary"],
    "doesNotClaim": ["authority-approved KPI", "per-feature KPI measurement", "automatic municipal initiative creation"]
  }'::jsonb,
  '{
    "context": ["NGSI-LD", "EU LDT Data Platform", "City Innovation Planner"],
    "spatialEvidence": "ldt_analysis.selection_sets",
    "planningTarget": "EU LDT City Innovation Planner"
  }'::jsonb
),
(
  'eu-ldt-cip-sync-measurements',
  'EU LDT CIP Sync Measurements',
  'Read KPI measurements from City Innovation Planner and store reconciled OLDT receipts linked to their source metric bindings.',
  'city-planning-kpi-exchange',
  'current',
  'human-approved-worker',
  '{
    "requiresHumanApprovalForRun": true,
    "agentCanReadCipMeasurements": true,
    "agentCanWriteMeasurementReceipts": true,
    "agentCanMutateCanonicalEntities": false
  }'::jsonb,
  '{
    "required": ["cityId", "cipProfileKey"],
    "optional": ["kpiIds", "includeUnbound", "pageSize", "maxPages"],
    "sourceContract": "City Innovation Planner /api/v1/kpi-measurements",
    "reconciliationContract": "ldt_interop.cip_metric_bindings"
  }'::jsonb,
  '{
    "writes": ["ldt_interop.cip_measurement_receipts", "ldt_ops workflow evidence"],
    "reports": ["measurement-readback", "binding-reconciliation", "measurement-sync-summary"],
    "doesNotClaim": ["spatial measurement per feature", "CIP calculation execution", "canonical OLDT mutation"]
  }'::jsonb,
  '{
    "context": ["City Innovation Planner KPI Measurement", "OLDT provenance receipt"],
    "source": "EU LDT City Innovation Planner",
    "localTarget": "OLDT planning receipts"
  }'::jsonb
),
(
  'eu-ldt-cip-sync-initiatives',
  'EU LDT CIP Sync Initiatives',
  'Read initiatives from City Innovation Planner and retain OLDT-owned links to saved spatial selections without duplicating geometry in CIP.',
  'city-planning-initiative-exchange',
  'current',
  'human-approved-worker',
  '{
    "requiresHumanApprovalForRun": true,
    "agentCanReadCipInitiatives": true,
    "agentCanWriteInitiativeSnapshots": true,
    "agentCanLinkExistingOldtSelections": true,
    "agentCanInferSpatialScope": false
  }'::jsonb,
  '{
    "required": ["cityId", "cipProfileKey"],
    "optional": ["initiativeIds", "links", "pageSize", "maxPages"],
    "sourceContract": "City Innovation Planner /api/v1/initiatives",
    "spatialLinkContract": "explicit CIP initiative ID to OLDT selection-set ID"
  }'::jsonb,
  '{
    "writes": ["ldt_interop.cip_initiative_links", "ldt_ops workflow evidence"],
    "reports": ["initiative-readback", "selection-link-validation", "initiative-sync-summary"],
    "doesNotClaim": ["automatic spatial inference", "CIP initiative ownership", "geometry storage in CIP"]
  }'::jsonb,
  '{
    "context": ["City Innovation Planner Initiative", "OLDT spatial selection"],
    "source": "EU LDT City Innovation Planner",
    "localTarget": "OLDT planning overlays"
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
