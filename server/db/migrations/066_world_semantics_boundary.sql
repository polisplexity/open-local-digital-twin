ALTER TABLE ldt_analysis.selection_set_members
  ADD COLUMN IF NOT EXISTS geometry_snapshot geometry(Geometry, 4326);

CREATE INDEX IF NOT EXISTS ldt_analysis_selection_members_geometry_snapshot_gix
  ON ldt_analysis.selection_set_members USING gist (geometry_snapshot);

CREATE OR REPLACE VIEW ldt_enrichment.entity_model_output_current AS
SELECT DISTINCT ON (output.city_id, output.entity_id, output.model_key, output.output_key)
  output.*
FROM ldt_enrichment.entity_model_outputs output
WHERE output.status <> 'superseded'
  AND output.simulation_run_id IS NULL
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

COMMENT ON VIEW ldt_enrichment.entity_model_output_current IS
  'Latest non-simulation model output for the observed/current city read model. Scenario outputs remain queryable only through ldt_science simulation views.';

COMMENT ON COLUMN ldt_analysis.selection_set_members.geometry_snapshot IS
  'Immutable geometry captured when the selection is materialized. NULL marks a legacy selection that must fall back to current canonical geometry.';
