CREATE INDEX IF NOT EXISTS ldt_environment_object_observations_source_cell_idx
  ON ldt_environment.object_observations (source_cell_id)
  WHERE source_cell_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ldt_environment_object_observations_city_layer_scenario_idx
  ON ldt_environment.object_observations (city_id, layer_id, scenario_key);

COMMENT ON INDEX ldt_environment.ldt_environment_object_observations_source_cell_idx IS
  'Supports terrain/phenomenon cell replacement where ON DELETE SET NULL checks object observations by source cell.';

COMMENT ON INDEX ldt_environment.ldt_environment_object_observations_city_layer_scenario_idx IS
  'Supports repeated source-backed environmental extractor runs that replace object observations by city, layer, and scenario.';
