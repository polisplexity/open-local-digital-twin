CREATE SCHEMA IF NOT EXISTS ldt_enrichment;

CREATE TABLE IF NOT EXISTS ldt_enrichment.entity_model_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  workflow_run_id uuid REFERENCES ldt_ops.workflow_runs(id) ON DELETE SET NULL,
  simulation_run_id uuid REFERENCES ldt_science.simulation_runs(id) ON DELETE SET NULL,
  source_artifact_id uuid REFERENCES ldt_ops.workflow_artifacts(id) ON DELETE SET NULL,
  model_key text NOT NULL,
  model_version text NOT NULL DEFAULT '',
  output_key text NOT NULL,
  status text NOT NULL DEFAULT 'computed',
  value_numeric numeric,
  value_text text,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  unit text,
  confidence text NOT NULL DEFAULT 'unknown',
  authority_status text NOT NULL DEFAULT 'derived-model-output',
  method jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  uncertainty jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entity_model_outputs_status_check CHECK (status IN (
    'computed',
    'not_computable',
    'invalid',
    'warning',
    'superseded'
  )),
  CONSTRAINT entity_model_outputs_key_check CHECK (output_key ~ '^[a-z0-9][a-z0-9._-]{1,128}$'),
  CONSTRAINT entity_model_outputs_model_key_check CHECK (model_key ~ '^[a-z0-9][a-z0-9._-]{1,128}$')
);

CREATE INDEX IF NOT EXISTS ldt_enrichment_entity_model_outputs_entity_idx
  ON ldt_enrichment.entity_model_outputs (city_id, entity_id, model_key, output_key, generated_at DESC);

CREATE INDEX IF NOT EXISTS ldt_enrichment_entity_model_outputs_model_idx
  ON ldt_enrichment.entity_model_outputs (city_id, model_key, model_version, output_key, status);

CREATE INDEX IF NOT EXISTS ldt_enrichment_entity_model_outputs_workflow_idx
  ON ldt_enrichment.entity_model_outputs (workflow_run_id, source_artifact_id);

CREATE INDEX IF NOT EXISTS ldt_enrichment_entity_model_outputs_value_numeric_idx
  ON ldt_enrichment.entity_model_outputs (city_id, model_key, output_key, value_numeric DESC)
  WHERE value_numeric IS NOT NULL AND status = 'computed';

CREATE INDEX IF NOT EXISTS ldt_enrichment_entity_model_outputs_value_text_idx
  ON ldt_enrichment.entity_model_outputs (city_id, model_key, output_key, value_text)
  WHERE value_text IS NOT NULL AND status = 'computed';

CREATE OR REPLACE VIEW ldt_enrichment.entity_model_output_current AS
SELECT DISTINCT ON (output.city_id, output.entity_id, output.model_key, output.output_key)
  output.*
FROM ldt_enrichment.entity_model_outputs output
WHERE output.status <> 'superseded'
ORDER BY
  output.city_id,
  output.entity_id,
  output.model_key,
  output.output_key,
  (
    (output.valid_from IS NULL OR output.valid_from <= now())
    AND (output.valid_to IS NULL OR output.valid_to >= now())
  ) DESC,
  output.generated_at DESC,
  output.created_at DESC;

CREATE OR REPLACE VIEW ldt_enrichment.entity_model_output_summary AS
SELECT
  current_output.city_id,
  current_output.entity_id,
  current_output.model_key,
  max(current_output.model_version) AS model_version,
  jsonb_object_agg(
    current_output.output_key,
    jsonb_build_object(
      'status', current_output.status,
      'valueNumeric', current_output.value_numeric,
      'valueText', current_output.value_text,
      'value', current_output.value_json,
      'unit', current_output.unit,
      'confidence', current_output.confidence,
      'authorityStatus', current_output.authority_status,
      'generatedAt', current_output.generated_at,
      'workflowRunId', current_output.workflow_run_id,
      'simulationRunId', current_output.simulation_run_id,
      'sourceArtifactId', current_output.source_artifact_id,
      'warnings', current_output.warnings
    )
    ORDER BY current_output.output_key
  ) AS outputs,
  max(current_output.generated_at) AS latest_generated_at,
  max(current_output.created_at) AS latest_ingested_at
FROM ldt_enrichment.entity_model_output_current current_output
GROUP BY current_output.city_id, current_output.entity_id, current_output.model_key;

CREATE OR REPLACE VIEW ldt_query.city_objects_enriched AS
SELECT
  city_objects.*,
  COALESCE(enrichment.model_enrichments, '{}'::jsonb) AS model_enrichments
FROM ldt_query.city_objects city_objects
LEFT JOIN LATERAL (
  SELECT jsonb_object_agg(summary.model_key, summary.outputs ORDER BY summary.model_key) AS model_enrichments
  FROM ldt_enrichment.entity_model_output_summary summary
  WHERE summary.city_id = city_objects.city_id
    AND summary.entity_id = city_objects.id
) enrichment ON true;

COMMENT ON TABLE ldt_enrichment.entity_model_outputs IS
  'Append-only entity-level outputs returned by external or internal model runs. Identity is anchored on ldt_core.city_entities; model wrappers must not create canonical city objects.';

COMMENT ON VIEW ldt_enrichment.entity_model_output_summary IS
  'Current model-enrichment outputs grouped by entity and model for query/API/UI consumption.';

COMMENT ON VIEW ldt_query.city_objects_enriched IS
  'Canonical city objects plus current model enrichments. This is a read model, not the source of canonical entity identity.';
