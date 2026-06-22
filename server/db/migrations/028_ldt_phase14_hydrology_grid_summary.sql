ALTER TABLE ldt_environment.object_observation_summary
  ADD COLUMN IF NOT EXISTS hydrology_surface_water_signal numeric;

CREATE INDEX IF NOT EXISTS ldt_environment_object_observation_summary_hydrology_signal_idx
  ON ldt_environment.object_observation_summary (city_id, hydrology_surface_water_signal DESC)
  WHERE hydrology_surface_water_signal IS NOT NULL;

UPDATE ldt_environment.phenomenon_layers
SET
  spatial_model = 'sampled_grid_and_object',
  value_kind = 'source_derived_indicator',
  metadata = metadata || jsonb_build_object(
    'sourceAdapter', 'dem-osm-hydrology-grid',
    'phase', 'phase-14',
    'simulationPosture', 'screening-signal-not-hydraulic-simulation'
  ),
  updated_at = now()
WHERE layer_key = 'hydrology_surface_water_signal';

COMMENT ON COLUMN ldt_environment.object_observation_summary.hydrology_surface_water_signal IS
  'Source-backed DEM/open-water screening signal attached to this city object. It is not a hydraulic flood-depth simulation.';
