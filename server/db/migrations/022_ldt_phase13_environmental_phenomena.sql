CREATE SCHEMA IF NOT EXISTS ldt_environment;

CREATE TABLE IF NOT EXISTS ldt_environment.phenomenon_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  phenomenon_family text NOT NULL,
  value_unit text NOT NULL DEFAULT 'score_0_100',
  value_kind text NOT NULL DEFAULT 'proxy_score',
  spatial_model text NOT NULL DEFAULT 'grid',
  source_status text NOT NULL DEFAULT 'open-data-derived',
  authority_status text NOT NULL DEFAULT 'derived-open-data-proxy',
  description text NOT NULL DEFAULT '',
  standards_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldt_environment.phenomenon_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  layer_id uuid NOT NULL REFERENCES ldt_environment.phenomenon_layers(id) ON DELETE CASCADE,
  cell_key text NOT NULL,
  source_grid_key text NOT NULL DEFAULT '',
  source_cell_id text NOT NULL DEFAULT '',
  scenario_key text NOT NULL DEFAULT 'baseline',
  observed_at timestamptz,
  value numeric NOT NULL,
  confidence text NOT NULL DEFAULT 'proxy',
  geom geometry(Polygon, 4326) NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, layer_id, cell_key, scenario_key)
);

CREATE INDEX IF NOT EXISTS ldt_environment_cells_city_layer_idx
  ON ldt_environment.phenomenon_cells (city_id, layer_id, scenario_key);

CREATE INDEX IF NOT EXISTS ldt_environment_cells_value_idx
  ON ldt_environment.phenomenon_cells (city_id, layer_id, value DESC);

CREATE INDEX IF NOT EXISTS ldt_environment_cells_geom_gix
  ON ldt_environment.phenomenon_cells USING gist (geom);

CREATE TABLE IF NOT EXISTS ldt_environment.object_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  layer_id uuid NOT NULL REFERENCES ldt_environment.phenomenon_layers(id) ON DELETE CASCADE,
  source_cell_id uuid REFERENCES ldt_environment.phenomenon_cells(id) ON DELETE SET NULL,
  scenario_key text NOT NULL DEFAULT 'baseline',
  observed_at timestamptz,
  value numeric NOT NULL,
  confidence text NOT NULL DEFAULT 'proxy',
  method text NOT NULL DEFAULT '',
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, entity_id, layer_id, scenario_key)
);

CREATE INDEX IF NOT EXISTS ldt_environment_object_observations_city_entity_idx
  ON ldt_environment.object_observations (city_id, entity_id);

CREATE INDEX IF NOT EXISTS ldt_environment_object_observations_city_layer_value_idx
  ON ldt_environment.object_observations (city_id, layer_id, value DESC);

CREATE OR REPLACE VIEW ldt_environment.object_environment_observations AS
SELECT
  oo.city_id,
  ce.stable_id AS object_id,
  ce.entity_type,
  ce.label,
  oo.entity_id,
  pl.layer_key,
  pl.display_name,
  pl.phenomenon_family,
  pl.value_unit,
  pl.value_kind,
  oo.value,
  oo.confidence,
  oo.method,
  oo.scenario_key,
  oo.observed_at,
  oo.generated_at,
  oo.properties,
  oo.source_cell_id
FROM ldt_environment.object_observations oo
JOIN ldt_core.city_entities ce ON ce.id = oo.entity_id
JOIN ldt_environment.phenomenon_layers pl ON pl.id = oo.layer_id;

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
  metadata
) VALUES
  (
    'built_form_proxy',
    'Built form proxy',
    'urban_form',
    'score_0_100',
    'open_data_proxy',
    'grid_and_object',
    'open-data-derived',
    'derived-open-data-proxy',
    'Urban form intensity derived from consolidated buildings, roads, and facilities.',
    '{"ogc":"Feature","ngsi_ld":"ObservedProperty"}'::jsonb,
    '{"viewerMode":"builtIntensity","phase":"phase-13"}'::jsonb
  ),
  (
    'heat_proxy',
    'Heat proxy',
    'thermal',
    'score_0_100',
    'open_data_proxy',
    'grid_and_object',
    'open-data-derived',
    'derived-open-data-proxy',
    'Exploratory thermal exposure proxy derived from built fabric, roads, facilities, and green-blue inventory.',
    '{"ogc":"Feature","ngsi_ld":"ObservedProperty"}'::jsonb,
    '{"viewerMode":"heatProxy","phase":"phase-13"}'::jsonb
  ),
  (
    'air_roughness_proxy',
    'Air roughness proxy',
    'airflow',
    'score_0_100',
    'open_data_proxy',
    'grid_and_object',
    'open-data-derived',
    'derived-open-data-proxy',
    'Urban airflow roughness proxy derived from built density, road density, and green-blue openness.',
    '{"ogc":"Feature","ngsi_ld":"ObservedProperty"}'::jsonb,
    '{"viewerMode":"airflowFriction","phase":"phase-13"}'::jsonb
  ),
  (
    'green_blue_cooling_proxy',
    'Green-blue cooling proxy',
    'cooling',
    'score_0_100',
    'open_data_proxy',
    'grid_and_object',
    'open-data-derived',
    'derived-open-data-proxy',
    'Cooling opportunity proxy derived from parks, water, forests, wetlands, and other green-blue open-data features.',
    '{"ogc":"Feature","ngsi_ld":"ObservedProperty"}'::jsonb,
    '{"viewerMode":"greenBlueCooling","phase":"phase-13"}'::jsonb
  ),
  (
    'solar_exposure_proxy',
    'Solar exposure proxy',
    'solar',
    'score_0_100',
    'open_data_proxy',
    'grid_and_object',
    'open-data-derived',
    'derived-open-data-proxy',
    'Exploratory solar exposure proxy derived from urban form and low green-blue cooling signal. It is not a timestamped shadow model.',
    '{"ogc":"Feature","ngsi_ld":"ObservedProperty"}'::jsonb,
    '{"viewerMode":"solarExposureProxy","phase":"phase-13"}'::jsonb
  ),
  (
    'water_flow_proxy',
    'Water/open-space flow proxy',
    'hydrology',
    'score_0_100',
    'open_data_proxy',
    'grid_and_object',
    'open-data-derived',
    'derived-open-data-proxy',
    'Exploratory blue-green flow proxy derived from green-blue features. It is not a hydraulic simulation.',
    '{"ogc":"Feature","ngsi_ld":"ObservedProperty"}'::jsonb,
    '{"viewerMode":"waterFlowProxy","phase":"phase-13"}'::jsonb
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
  updated_at = now();

DROP VIEW IF EXISTS ldt_query.city_objects;

CREATE OR REPLACE VIEW ldt_query.city_objects AS
SELECT
  cf.id,
  cf.city_id,
  cf.stable_id AS object_id,
  cf.stable_id,
  cf.feature_type AS entity_type,
  COALESCE(ld.key, cf.feature_type) AS layer_key,
  CASE
    WHEN cf.feature_type = 'buildingCandidateNew' THEN 'buildings'
    ELSE COALESCE(ld.key, cf.feature_type)
  END AS display_layer_key,
  CASE
    WHEN cf.feature_type = 'buildingCandidateNew' THEN 'buildings'
    WHEN COALESCE(ld.key, cf.feature_type) = 'buildings' THEN 'buildings'
    WHEN COALESCE(ld.key, cf.feature_type) = 'roads' THEN 'roads'
    WHEN COALESCE(ld.key, cf.feature_type) = 'boundary' THEN 'boundary'
    WHEN COALESCE(ld.key, cf.feature_type) = 'unclassifiedLand' THEN 'landUseCoverageGap'
    WHEN COALESCE(ld.key, cf.feature_type) = 'greenBlue' THEN 'greenBlue'
    WHEN COALESCE(ld.key, cf.feature_type) = 'places' THEN 'places'
    WHEN COALESCE(ld.key, cf.feature_type) IN ('civic', 'mobility', 'commerce', 'wasteSeeds', 'facilities') THEN 'accessSeeds'
    WHEN COALESCE(ld.key, cf.feature_type) = 'semanticPacks' THEN 'semanticPacks'
    WHEN COALESCE(ld.key, cf.feature_type) = 'providerOverlays' THEN 'providerOverlays'
    ELSE COALESCE(ld.key, cf.feature_type)
  END AS semantic_class,
  cf.label,
  cf.authority_status,
  cf.confidence,
  COALESCE(cf.properties->>'source_coverage_status', 'base-source-only') AS source_coverage_status,
  COALESCE(ld.provider_id, cf.properties->>'provider', cf.properties->>'source') AS provider,
  COALESCE(ld.metadata->>'sourceFormat', ld.metadata->>'source_format', cf.properties->>'source_format') AS source_format,
  COALESCE(ld.layer_family, cf.properties->>'source_family', cf.feature_type) AS source_family,
  COALESCE(r.road_class, cf.properties->>'highway') AS road_class,
  COALESCE(b.building_type, cf.properties->>'building') AS building_type,
  COALESCE(
    b.height_m,
    NULLIF((regexp_match(COALESCE(cf.properties->>'height_m', cf.properties->>'height', cf.properties->>'building:height', ''), '[-+]?[0-9]+[.]?[0-9]*'))[1], '')::numeric
  ) AS height_m,
  COALESCE(
    b.levels,
    NULLIF((regexp_match(COALESCE(cf.properties->>'levels', cf.properties->>'building:levels', cf.properties->>'estimated_floors', ''), '[-+]?[0-9]+[.]?[0-9]*'))[1], '')::numeric
  ) AS floors,
  COALESCE(g.category, cf.properties->>'landuse', cf.properties->>'natural', cf.properties->>'leisure') AS land_use_class,
  COALESCE(
    f.category,
    f.amenity,
    f.shop,
    f.public_transport,
    g.category,
    p.place_type,
    cf.properties->>'category',
    cf.properties->>'amenity',
    cf.properties->>'shop',
    cf.properties->>'public_transport',
    cf.properties->>'landuse',
    cf.properties->>'natural',
    cf.properties->>'leisure',
    cf.properties->>'place'
  ) AS category,
  p.place_type,
  b.footprint_area_m2,
  env.values AS environmental_observations,
  env.built_form_proxy,
  env.heat_proxy,
  env.air_roughness_proxy,
  env.green_blue_cooling_proxy,
  env.solar_exposure_proxy,
  env.water_flow_proxy,
  cf.geom,
  ST_GeometryType(cf.geom) AS geometry_type,
  cf.properties,
  cf.updated_at
FROM city_features cf
LEFT JOIN layer_definitions ld ON ld.id = cf.layer_id
LEFT JOIN roads r ON r.feature_id = cf.id
LEFT JOIN buildings b ON b.feature_id = cf.id
LEFT JOIN facilities f ON f.feature_id = cf.id
LEFT JOIN places p ON p.feature_id = cf.id
LEFT JOIN green_blue_features g ON g.feature_id = cf.id
LEFT JOIN LATERAL (
  SELECT
    COALESCE(jsonb_object_agg(layer_key, value), '{}'::jsonb) AS values,
    max(value) FILTER (WHERE layer_key = 'built_form_proxy') AS built_form_proxy,
    max(value) FILTER (WHERE layer_key = 'heat_proxy') AS heat_proxy,
    max(value) FILTER (WHERE layer_key = 'air_roughness_proxy') AS air_roughness_proxy,
    max(value) FILTER (WHERE layer_key = 'green_blue_cooling_proxy') AS green_blue_cooling_proxy,
    max(value) FILTER (WHERE layer_key = 'solar_exposure_proxy') AS solar_exposure_proxy,
    max(value) FILTER (WHERE layer_key = 'water_flow_proxy') AS water_flow_proxy
  FROM ldt_environment.object_environment_observations eo
  WHERE eo.entity_id = cf.id
) env ON true
WHERE cf.feature_type <> 'buildingCandidateMatched';

COMMENT ON SCHEMA ldt_environment IS
  'Environmental, climate, flow, terrain, and spatial phenomenon records attached to the city inventory.';

COMMENT ON TABLE ldt_environment.phenomenon_layers IS
  'Registry of environmental/spatial phenomenon layers such as heat, wind, cooling, sun, terrain, and water-flow proxies or measured/modelled layers.';

COMMENT ON TABLE ldt_environment.phenomenon_cells IS
  'Spatial cells or polygons carrying phenomenon values, source status, scenario, and provenance.';

COMMENT ON TABLE ldt_environment.object_observations IS
  'Per-city-object phenomenon values derived by spatial attachment or loaded from measured/modelled provider data.';

COMMENT ON VIEW ldt_environment.object_environment_observations IS
  'Readable object-level environmental observations joined to inventory identity and phenomenon layer metadata.';

COMMENT ON VIEW ldt_query.city_objects IS
  'Canonical read-only city-object surface for SQL-grade TwinQL/CQL2 queries, including environmental observation columns when generated.';
