ALTER TABLE ldt_interop.eu_ldt_acceptance_runs
  DROP CONSTRAINT IF EXISTS eu_ldt_acceptance_runs_tool_kind_check;

ALTER TABLE ldt_interop.eu_ldt_acceptance_runs
  ADD CONSTRAINT eu_ldt_acceptance_runs_tool_kind_check CHECK (
    tool_kind IN (
      'play-visualise',
      'marketplace',
      'identity-management',
      'use-case-scenarios',
      'ai-notebook'
    )
  );

CREATE INDEX IF NOT EXISTS ldt_enrichment_entity_model_outputs_simulation_idx
  ON ldt_enrichment.entity_model_outputs (
    city_id,
    simulation_run_id,
    output_key,
    entity_id
  )
  WHERE simulation_run_id IS NOT NULL;

CREATE OR REPLACE VIEW ldt_science.entity_simulation_outputs AS
SELECT
  simulation_run.id AS simulation_run_id,
  simulation_run.city_id,
  simulation_run.scenario_key,
  simulation_run.status AS simulation_status,
  simulation_run.inputs AS simulation_inputs,
  simulation_run.outputs AS simulation_summary,
  simulation_run.uncertainty AS simulation_uncertainty,
  simulation_run.started_at,
  simulation_run.finished_at,
  simulation_model.model_key,
  simulation_model.name AS model_name,
  simulation_model.model_family,
  simulation_model.version AS model_version,
  city_entity.id AS entity_id,
  city_entity.stable_id,
  city_entity.canonical_uri,
  city_entity.entity_type,
  city_entity.label,
  city_entity.geom,
  model_output.workflow_run_id,
  model_output.output_key,
  model_output.status AS output_status,
  model_output.value_numeric,
  model_output.value_text,
  model_output.value_json,
  model_output.unit,
  model_output.confidence,
  model_output.authority_status,
  model_output.method,
  model_output.input_sources,
  model_output.uncertainty AS output_uncertainty,
  model_output.warnings,
  model_output.generated_at,
  model_output.valid_from,
  model_output.valid_to
FROM ldt_science.simulation_runs simulation_run
JOIN ldt_science.simulation_models simulation_model
  ON simulation_model.id = simulation_run.model_id
JOIN ldt_enrichment.entity_model_outputs model_output
  ON model_output.simulation_run_id = simulation_run.id
JOIN ldt_core.city_entities city_entity
  ON city_entity.id = model_output.entity_id
 AND city_entity.city_id = simulation_run.city_id;

CREATE OR REPLACE VIEW ldt_science.simulation_run_inventory AS
SELECT
  simulation_run.id,
  simulation_run.city_id,
  simulation_run.scenario_key,
  simulation_run.status,
  simulation_run.inputs,
  simulation_run.outputs,
  simulation_run.uncertainty,
  simulation_run.started_at,
  simulation_run.finished_at,
  simulation_model.model_key,
  simulation_model.name AS model_name,
  simulation_model.model_family,
  simulation_model.version AS model_version,
  count(model_output.id)::integer AS output_count,
  count(DISTINCT model_output.entity_id)::integer AS entity_count,
  count(DISTINCT model_output.output_key)::integer AS output_key_count,
  min(model_output.generated_at) AS first_generated_at,
  max(model_output.generated_at) AS last_generated_at,
  array_agg(DISTINCT model_output.authority_status ORDER BY model_output.authority_status)
    FILTER (WHERE model_output.authority_status IS NOT NULL) AS authority_statuses
FROM ldt_science.simulation_runs simulation_run
JOIN ldt_science.simulation_models simulation_model
  ON simulation_model.id = simulation_run.model_id
LEFT JOIN ldt_enrichment.entity_model_outputs model_output
  ON model_output.simulation_run_id = simulation_run.id
GROUP BY
  simulation_run.id,
  simulation_model.id;

COMMENT ON VIEW ldt_science.entity_simulation_outputs IS
  'Timestamped entity-level simulation worlds joined to canonical OLDT geometry. Simulation outputs never create canonical city entities.';

COMMENT ON VIEW ldt_science.simulation_run_inventory IS
  'Queryable inventory of simulation worlds, model identity, temporal extent, entity coverage, and authority posture.';
