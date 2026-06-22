CREATE TABLE IF NOT EXISTS ldt_environment.extractor_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extractor_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  extractor_family text NOT NULL DEFAULT 'environmental',
  source_posture text NOT NULL DEFAULT 'open-data-native',
  lifecycle_status text NOT NULL DEFAULT 'contract-ready',
  default_scenario_key text NOT NULL DEFAULT 'baseline',
  output_layer_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  standards_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  runtime_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ldt_environment_extractor_definitions_family_idx
  ON ldt_environment.extractor_definitions (extractor_family, lifecycle_status);

CREATE TABLE IF NOT EXISTS ldt_environment.extractor_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extractor_id uuid REFERENCES ldt_environment.extractor_definitions(id) ON DELETE SET NULL,
  extractor_key text NOT NULL,
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  workflow_run_id uuid REFERENCES ldt_ops.workflow_runs(id) ON DELETE SET NULL,
  run_key text NOT NULL,
  scenario_key text NOT NULL DEFAULT 'baseline',
  status text NOT NULL DEFAULT 'registered',
  source_status text NOT NULL DEFAULT 'source-required',
  requested_by text NOT NULL DEFAULT 'system',
  requested_by_kind text NOT NULL DEFAULT 'system',
  trigger_kind text NOT NULL DEFAULT 'manual',
  started_at timestamptz,
  finished_at timestamptz,
  input_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, extractor_key, scenario_key, run_key)
);

CREATE INDEX IF NOT EXISTS ldt_environment_extractor_runs_city_status_idx
  ON ldt_environment.extractor_runs (city_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS ldt_environment_extractor_runs_key_idx
  ON ldt_environment.extractor_runs (extractor_key, created_at DESC);

CREATE TABLE IF NOT EXISTS ldt_environment.extractor_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extractor_run_id uuid NOT NULL REFERENCES ldt_environment.extractor_runs(id) ON DELETE CASCADE,
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  dataset_id uuid REFERENCES ldt_catalog.datasets(id) ON DELETE SET NULL,
  layer_id uuid REFERENCES ldt_environment.phenomenon_layers(id) ON DELETE SET NULL,
  artifact_kind text NOT NULL,
  artifact_uri text NOT NULL,
  media_type text,
  byte_size bigint,
  checksum text,
  coverage_geom geometry(Geometry, 4326),
  temporal_start timestamptz,
  temporal_end timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (extractor_run_id, artifact_kind, artifact_uri)
);

CREATE INDEX IF NOT EXISTS ldt_environment_extractor_artifacts_run_idx
  ON ldt_environment.extractor_artifacts (extractor_run_id, artifact_kind);

CREATE INDEX IF NOT EXISTS ldt_environment_extractor_artifacts_city_idx
  ON ldt_environment.extractor_artifacts (city_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ldt_environment_extractor_artifacts_geom_gix
  ON ldt_environment.extractor_artifacts USING gist (coverage_geom);

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
  enabled
) VALUES
  (
    'terrain_elevation_m',
    'Terrain elevation',
    'terrain',
    'm',
    'source_derived_measure',
    'raster_or_grid',
    'source-required',
    'not-yet-ingested',
    'Terrain elevation from a DEM source. This is not populated by the proxy generator.',
    '{"ogc":"Coverage","dcat":"Dataset","ngsi_ld":"ObservedProperty"}'::jsonb,
    '{"phase":"phase-14","extractor":"terrain-dem"}'::jsonb,
    false
  ),
  (
    'terrain_slope_deg',
    'Terrain slope',
    'terrain',
    'degree',
    'source_derived_measure',
    'raster_or_grid',
    'source-required',
    'not-yet-ingested',
    'Slope derived from a DEM source. This is not populated by the proxy generator.',
    '{"ogc":"Coverage","dcat":"Dataset","ngsi_ld":"ObservedProperty"}'::jsonb,
    '{"phase":"phase-14","extractor":"terrain-dem"}'::jsonb,
    false
  ),
  (
    'weather_air_temperature_c',
    'Air temperature',
    'weather',
    'celsius',
    'observed_or_modelled_measure',
    'time_grid',
    'source-required',
    'not-yet-ingested',
    'Timestamped open weather or modelled air temperature field.',
    '{"ogc":"Coverage","dcat":"Dataset","ngsi_ld":"Property"}'::jsonb,
    '{"phase":"phase-14","extractor":"weather-field"}'::jsonb,
    false
  ),
  (
    'weather_wind_speed_ms',
    'Wind speed',
    'weather',
    'm_s',
    'observed_or_modelled_measure',
    'time_grid',
    'source-required',
    'not-yet-ingested',
    'Timestamped open weather or modelled wind speed field.',
    '{"ogc":"Coverage","dcat":"Dataset","ngsi_ld":"Property"}'::jsonb,
    '{"phase":"phase-14","extractor":"weather-field"}'::jsonb,
    false
  ),
  (
    'weather_wind_direction_deg',
    'Wind direction',
    'weather',
    'degree',
    'observed_or_modelled_measure',
    'time_grid',
    'source-required',
    'not-yet-ingested',
    'Timestamped open weather or modelled wind direction field.',
    '{"ogc":"Coverage","dcat":"Dataset","ngsi_ld":"Property"}'::jsonb,
    '{"phase":"phase-14","extractor":"weather-field"}'::jsonb,
    false
  ),
  (
    'hydrology_surface_water_signal',
    'Surface water signal',
    'hydrology',
    'score_0_100',
    'source_derived_indicator',
    'raster_or_grid',
    'source-required',
    'not-yet-ingested',
    'Surface-water or drainage context from open hydrography, DEM, or water occurrence sources.',
    '{"ogc":"Coverage","dcat":"Dataset","ngsi_ld":"ObservedProperty"}'::jsonb,
    '{"phase":"phase-14","extractor":"hydrology-grid"}'::jsonb,
    false
  ),
  (
    'stac_land_surface_temperature_c',
    'Land surface temperature',
    'thermal',
    'celsius',
    'source_derived_indicator',
    'raster_or_grid',
    'source-required',
    'not-yet-ingested',
    'Land-surface temperature derived from satellite or other STAC-indexed raster products.',
    '{"ogc":"Coverage","dcat":"Dataset","stac":"Item","ngsi_ld":"ObservedProperty"}'::jsonb,
    '{"phase":"phase-14","extractor":"stac-derived-indicator"}'::jsonb,
    false
  ),
  (
    'stac_ndvi',
    'NDVI',
    'vegetation',
    'index',
    'source_derived_indicator',
    'raster_or_grid',
    'source-required',
    'not-yet-ingested',
    'Vegetation signal derived from satellite or other STAC-indexed raster products.',
    '{"ogc":"Coverage","dcat":"Dataset","stac":"Item","ngsi_ld":"ObservedProperty"}'::jsonb,
    '{"phase":"phase-14","extractor":"stac-derived-indicator"}'::jsonb,
    false
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
  standards_mapping = EXCLUDED.standards_mapping,
  metadata = ldt_environment.phenomenon_layers.metadata || EXCLUDED.metadata,
  enabled = EXCLUDED.enabled,
  updated_at = now();

INSERT INTO ldt_environment.extractor_definitions (
  extractor_key,
  display_name,
  extractor_family,
  source_posture,
  lifecycle_status,
  output_layer_keys,
  source_candidates,
  input_contract,
  output_contract,
  standards_mapping,
  runtime_contract,
  metadata
) VALUES
  (
    'terrain-dem',
    'Terrain DEM extractor',
    'terrain',
    'open-data-native',
    'contract-ready',
    '["terrain_elevation_m","terrain_slope_deg","hydrology_surface_water_signal"]'::jsonb,
    '[
      {"source":"Copernicus DEM","format":"COG/GeoTIFF","posture":"preferred-open-source-or-open-access"},
      {"source":"NASADEM/SRTM","format":"GeoTIFF","posture":"global-fallback"},
      {"source":"national-or-city-DEM","format":"COG/GeoTIFF/GeoPackage","posture":"authority-preferred-when-available"}
    ]'::jsonb,
    '{"required":["cityId","cityBoundary"],"optional":["sourceUrl","targetResolutionM","licenseReview"]}'::jsonb,
    '{"writes":["ldt_catalog.datasets","ldt_environment.extractor_runs","ldt_environment.extractor_artifacts","ldt_environment.phenomenon_cells"],"derivedLayers":["terrain_elevation_m","terrain_slope_deg","hydrology_surface_water_signal"]}'::jsonb,
    '{"catalog":"DCAT","geospatial":["OGC Coverages","COG","PostGIS"],"provenance":"PROV-O"}'::jsonb,
    '{"worker":"optional","rawAssetStorage":"object-storage-or-runtime-artifact","viewerSurfaces":["city3d","map"]}'::jsonb,
    '{"phase":"phase-14","reproducibleForNewCities":true}'::jsonb
  ),
  (
    'weather-field',
    'Weather field extractor',
    'weather',
    'open-data-native',
    'contract-ready',
    '["weather_air_temperature_c","weather_wind_speed_ms","weather_wind_direction_deg"]'::jsonb,
    '[
      {"source":"ERA5-Land","format":"NetCDF/GRIB/COG-derived-grid","posture":"global-open-data"},
      {"source":"national-weather-portal","format":"CSV/OGC/API","posture":"authority-preferred-when-available"},
      {"source":"OpenAQ or local station portal","format":"API/CSV","posture":"station-context-where-covered"}
    ]'::jsonb,
    '{"required":["cityId","timeWindow","cityBoundary"],"optional":["sourceUrl","scenarioKey","heightM"]}'::jsonb,
    '{"writes":["ldt_catalog.datasets","ldt_environment.extractor_runs","ldt_environment.extractor_artifacts","ldt_environment.phenomenon_cells"],"derivedLayers":["weather_air_temperature_c","weather_wind_speed_ms","weather_wind_direction_deg"]}'::jsonb,
    '{"catalog":"DCAT","context":["NGSI-LD","FIWARE"],"geospatial":["OGC Coverages","PostGIS"],"provenance":"PROV-O"}'::jsonb,
    '{"worker":"required-for-large-time-windows","rawAssetStorage":"object-storage-or-runtime-artifact","viewerSurfaces":["city3d","map"]}'::jsonb,
    '{"phase":"phase-14","reproducibleForNewCities":true,"temporal":true}'::jsonb
  ),
  (
    'hydrology-grid',
    'Hydrology grid extractor',
    'hydrology',
    'open-data-native',
    'contract-ready',
    '["hydrology_surface_water_signal","water_flow_proxy"]'::jsonb,
    '[
      {"source":"JRC Global Surface Water","format":"COG/GeoTIFF","posture":"global-open-data"},
      {"source":"HydroSHEDS or national hydrography","format":"GeoPackage/Shapefile/OGC","posture":"open-hydrography"},
      {"source":"OSM waterways and water bodies","format":"PBF/Overpass","posture":"base-open-evidence"}
    ]'::jsonb,
    '{"required":["cityId","cityBoundary"],"optional":["rainfallScenario","demSource","drainageNetwork"]}'::jsonb,
    '{"writes":["ldt_catalog.datasets","ldt_environment.extractor_runs","ldt_environment.extractor_artifacts","ldt_environment.phenomenon_cells"],"derivedLayers":["hydrology_surface_water_signal","water_flow_proxy"]}'::jsonb,
    '{"catalog":"DCAT","geospatial":["OGC API Features","OGC Coverages","PostGIS"],"provenance":"PROV-O"}'::jsonb,
    '{"worker":"optional","rawAssetStorage":"object-storage-or-runtime-artifact","viewerSurfaces":["city3d","map"]}'::jsonb,
    '{"phase":"phase-14","reproducibleForNewCities":true}'::jsonb
  ),
  (
    'stac-derived-indicator',
    'STAC-derived environmental indicator extractor',
    'earth-observation',
    'open-data-native',
    'contract-ready',
    '["stac_land_surface_temperature_c","stac_ndvi","green_blue_cooling_proxy"]'::jsonb,
    '[
      {"source":"Sentinel/Landsat STAC catalogs","format":"STAC Item + COG","posture":"open-earth-observation"},
      {"source":"ESA WorldCover","format":"COG/GeoTIFF","posture":"global-open-data"},
      {"source":"Copernicus land monitoring products","format":"STAC/COG","posture":"regional-open-data"}
    ]'::jsonb,
    '{"required":["cityId","cityBoundary","indicatorKey"],"optional":["dateRange","cloudCoverMax","resolutionM"]}'::jsonb,
    '{"writes":["ldt_catalog.datasets","ldt_environment.extractor_runs","ldt_environment.extractor_artifacts","ldt_environment.phenomenon_cells","ldt_science.observations"],"derivedLayers":["stac_land_surface_temperature_c","stac_ndvi","green_blue_cooling_proxy"]}'::jsonb,
    '{"catalog":"DCAT","stac":"Item/Collection","geospatial":["OGC Coverages","COG","PostGIS"],"provenance":"PROV-O"}'::jsonb,
    '{"worker":"required-for-raster-processing","rawAssetStorage":"object-storage-or-runtime-artifact","viewerSurfaces":["city3d","map","civic"]}'::jsonb,
    '{"phase":"phase-14","reproducibleForNewCities":true,"raster":true}'::jsonb
  )
ON CONFLICT (extractor_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  extractor_family = EXCLUDED.extractor_family,
  source_posture = EXCLUDED.source_posture,
  lifecycle_status = EXCLUDED.lifecycle_status,
  output_layer_keys = EXCLUDED.output_layer_keys,
  source_candidates = EXCLUDED.source_candidates,
  input_contract = EXCLUDED.input_contract,
  output_contract = EXCLUDED.output_contract,
  standards_mapping = EXCLUDED.standards_mapping,
  runtime_contract = EXCLUDED.runtime_contract,
  metadata = ldt_environment.extractor_definitions.metadata || EXCLUDED.metadata,
  enabled = true,
  updated_at = now();

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
) VALUES (
  'environmental-source-extractor-refresh',
  'Environmental Source Extractor Refresh',
  'Register, run, validate, and publish terrain, weather, hydrology, and earth-observation source-backed environmental layers for a city.',
  'open-data-ingestion',
  'reference',
  'agent-assisted',
  '{"agentCanSuggestSources":true,"agentCanRunWithApproval":true,"agentCanPublishAuthorityClaims":false,"requiresHumanApprovalForAuthorityStatus":true,"requiresHumanApprovalForPaidSources":true}'::jsonb,
  '{"required":["cityId","extractorKey"],"optional":["scenarioKey","timeWindow","sourceUrl","targetResolutionM"]}'::jsonb,
  '{"writes":["ldt_environment.extractor_runs","ldt_environment.extractor_artifacts","ldt_environment.phenomenon_cells","ldt_catalog.datasets","ldt_prov.activities"],"reports":["source-readiness","coverage","validation","freshness"]}'::jsonb,
  '{"catalog":"DCAT","provenance":"PROV-O","geospatial":["OGC API Features","OGC Coverages","PostGIS"],"context":["NGSI-LD","FIWARE"]}'::jsonb
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

CREATE OR REPLACE VIEW ldt_environment.extractor_run_status AS
SELECT
  runs.city_id,
  runs.id AS run_id,
  runs.run_key,
  runs.extractor_key,
  defs.display_name,
  defs.extractor_family,
  defs.source_posture,
  defs.lifecycle_status AS extractor_lifecycle_status,
  runs.scenario_key,
  runs.status,
  runs.source_status,
  runs.started_at,
  runs.finished_at,
  runs.input_summary,
  runs.output_summary,
  runs.validation_report,
  runs.error,
  runs.created_at,
  runs.updated_at,
  COALESCE(artifact_counts.artifact_count, 0)::int AS artifact_count
FROM ldt_environment.extractor_runs runs
LEFT JOIN ldt_environment.extractor_definitions defs ON defs.extractor_key = runs.extractor_key
LEFT JOIN (
  SELECT extractor_run_id, count(*) AS artifact_count
  FROM ldt_environment.extractor_artifacts
  GROUP BY extractor_run_id
) artifact_counts ON artifact_counts.extractor_run_id = runs.id;

COMMENT ON TABLE ldt_environment.extractor_definitions IS
  'Registry of source-backed environmental extractor contracts such as DEM terrain, weather fields, hydrology grids, and STAC-derived indicators.';

COMMENT ON TABLE ldt_environment.extractor_runs IS
  'City-scoped environmental extractor run records. Runs may be registered before actual source data has been downloaded.';

COMMENT ON TABLE ldt_environment.extractor_artifacts IS
  'Artifacts, source plans, raw assets, validation reports, and derived outputs produced or expected by environmental extractors.';
