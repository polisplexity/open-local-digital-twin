ALTER TABLE ldt_viewer.city_summary_cache
  ADD COLUMN IF NOT EXISTS generated_by text NOT NULL DEFAULT 'twin-base-studio',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS ldt_viewer_city_summary_cache_refreshed_idx
  ON ldt_viewer.city_summary_cache (refreshed_at DESC);

CREATE INDEX IF NOT EXISTS ldt_viewer_density_grids_city_key_idx
  ON ldt_viewer.density_grids (city_id, grid_key);

CREATE INDEX IF NOT EXISTS ldt_viewer_density_grids_city_zoom_idx
  ON ldt_viewer.density_grids (city_id, zoom_hint);

CREATE INDEX IF NOT EXISTS ldt_viewer_density_grids_building_count_idx
  ON ldt_viewer.density_grids (((metrics->>'buildingCount')::int));
