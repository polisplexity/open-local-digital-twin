ALTER TABLE ldt_environment.object_observation_summary
  ADD COLUMN IF NOT EXISTS surface_runoff_screening numeric;

CREATE INDEX IF NOT EXISTS ldt_environment_object_observation_summary_runoff_idx
  ON ldt_environment.object_observation_summary (city_id, surface_runoff_screening DESC)
  WHERE surface_runoff_screening IS NOT NULL;

INSERT INTO ldt_environment.phenomenon_layers (
  layer_key,
  display_name,
  phenomenon_family,
  value_unit,
  value_kind,
  spatial_model,
  source_status,
  authority_status,
  description,
  standards_mapping,
  metadata,
  enabled,
  updated_at
) VALUES (
  'surface_runoff_screening',
  'Surface runoff screening',
  'hydrology',
  'score_0_100',
  'scenario_derived_indicator',
  'sampled_grid_and_object',
  'source-backed-open-data',
  'open-hydrology-scenario-screening',
  'Scenario-derived surface-runoff screening score from DEM, slope, mapped water evidence, and rainfall assumptions. This is not a calibrated hydraulic or drainage model.',
  '{"ogc":"Coverage","dcat":"Dataset","ngsi_ld":"ObservedProperty","prov":"PROV-O"}'::jsonb,
  jsonb_build_object(
    'phase', 'phase-14-scenario-runner-first-cut',
    'scenarioRunner', 'surface-runoff-screening',
    'sourceInputs', jsonb_build_array('hydrology_surface_water_signal', 'terrain_elevation_m', 'terrain_slope_deg', 'rainfall scenario parameters'),
    'simulationPosture', 'screening-scenario-not-certified-hydraulic-simulation',
    'reproducibleForNewCities', true,
    'cityPortable', true
  ),
  true,
  now()
)
ON CONFLICT (layer_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  phenomenon_family = EXCLUDED.phenomenon_family,
  value_unit = EXCLUDED.value_unit,
  value_kind = EXCLUDED.value_kind,
  spatial_model = EXCLUDED.spatial_model,
  source_status = EXCLUDED.source_status,
  authority_status = EXCLUDED.authority_status,
  description = EXCLUDED.description,
  standards_mapping = ldt_environment.phenomenon_layers.standards_mapping || EXCLUDED.standards_mapping,
  metadata = ldt_environment.phenomenon_layers.metadata || EXCLUDED.metadata,
  enabled = true,
  updated_at = now();

INSERT INTO ldt_science.simulation_models (
  model_key,
  name,
  model_family,
  version,
  definition
) VALUES (
  'surface-runoff-screening-v0',
  'Surface Runoff Screening',
  'hydrology_screening_model',
  '0.1.0',
  jsonb_build_object(
    'purpose', 'Generate a reproducible first-pass surface-runoff screening layer from open DEM/hydrology evidence and rainfall assumptions.',
    'inputs', jsonb_build_array('hydrology_surface_water_signal', 'terrain_elevation_m', 'terrain_slope_deg', 'rainfall_mm', 'duration_hours'),
    'outputs', jsonb_build_array('surface_runoff_screening', 'object exposure observations', 'scenario summary'),
    'limitations', jsonb_build_array(
      'Not a hydraulic model.',
      'Does not model drainage network capacity.',
      'Does not calculate certified flood depth or velocity.',
      'Requires official drainage, rainfall return periods, soil/infiltration, and calibration data before operational flood decisions.'
    )
  )
)
ON CONFLICT (model_key) DO UPDATE SET
  name = EXCLUDED.name,
  model_family = EXCLUDED.model_family,
  version = EXCLUDED.version,
  definition = EXCLUDED.definition;

INSERT INTO ldt_science.scenario_definitions (
  scenario_key,
  name,
  scenario_family,
  description,
  required_inputs,
  expected_outputs,
  metadata
) VALUES (
  'surface-runoff-screening',
  'Surface Runoff Screening',
  'hydrology',
  'First reproducible open-data scenario for likely surface-water accumulation and runoff stress under a rainfall assumption.',
  jsonb_build_array('source-backed DEM terrain cells', 'source-backed hydrology signal cells', 'rainfall amount and duration'),
  jsonb_build_array('surface runoff screening grid', 'object exposure observations', 'scenario run summary'),
  jsonb_build_object(
    'status', 'first-operational-open-data-scenario',
    'simulationPosture', 'screening-scenario-not-certified-hydraulic-simulation',
    'phase', 'phase-14-scenario-runner-first-cut'
  )
)
ON CONFLICT (scenario_key) DO UPDATE SET
  name = EXCLUDED.name,
  scenario_family = EXCLUDED.scenario_family,
  description = EXCLUDED.description,
  required_inputs = EXCLUDED.required_inputs,
  expected_outputs = EXCLUDED.expected_outputs,
  metadata = ldt_science.scenario_definitions.metadata || EXCLUDED.metadata;

COMMENT ON COLUMN ldt_environment.object_observation_summary.surface_runoff_screening IS
  'Scenario-derived open-data surface-runoff screening score attached to this city object. Not calibrated hydraulic flood depth.';
