CREATE TABLE IF NOT EXISTS ldt_environment.object_observation_summary (
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  scenario_key text NOT NULL DEFAULT 'baseline',
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  built_form_proxy numeric,
  heat_proxy numeric,
  air_roughness_proxy numeric,
  green_blue_cooling_proxy numeric,
  solar_exposure_proxy numeric,
  water_flow_proxy numeric,
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (city_id, entity_id, scenario_key)
);

CREATE INDEX IF NOT EXISTS ldt_environment_object_observation_summary_city_idx
  ON ldt_environment.object_observation_summary (city_id, scenario_key);

CREATE INDEX IF NOT EXISTS ldt_environment_object_observation_summary_heat_idx
  ON ldt_environment.object_observation_summary (city_id, heat_proxy DESC);

CREATE INDEX IF NOT EXISTS ldt_environment_object_observation_summary_air_idx
  ON ldt_environment.object_observation_summary (city_id, air_roughness_proxy DESC);

CREATE INDEX IF NOT EXISTS ldt_environment_object_observation_summary_solar_idx
  ON ldt_environment.object_observation_summary (city_id, solar_exposure_proxy DESC);

CREATE INDEX IF NOT EXISTS ldt_environment_object_observation_summary_water_idx
  ON ldt_environment.object_observation_summary (city_id, water_flow_proxy DESC);

DROP VIEW IF EXISTS ldt_query.city_objects;

CREATE OR REPLACE VIEW ldt_query.city_objects AS
SELECT
  ce.id,
  ce.city_id,
  ce.stable_id AS object_id,
  ce.stable_id,
  ce.entity_type,
  CASE
    WHEN ce.entity_type = 'building' THEN 'buildings'
    WHEN ce.entity_type = 'road' THEN 'roads'
    WHEN ce.entity_type = 'green_blue_system' THEN 'greenBlue'
    WHEN ce.entity_type = 'land_use' THEN 'landUse'
    WHEN ce.entity_type = 'place' THEN 'places'
    WHEN ce.entity_type IN ('facility', 'mobility_asset', 'service_point') THEN 'accessSeeds'
    ELSE ce.entity_type
  END AS layer_key,
  CASE
    WHEN ce.entity_type = 'building' THEN 'buildings'
    WHEN ce.entity_type = 'road' THEN 'roads'
    WHEN ce.entity_type = 'green_blue_system' THEN 'greenBlue'
    WHEN ce.entity_type = 'land_use' THEN 'landUse'
    WHEN ce.entity_type = 'place' THEN 'places'
    WHEN ce.entity_type IN ('facility', 'mobility_asset', 'service_point') THEN 'accessSeeds'
    ELSE ce.entity_type
  END AS display_layer_key,
  CASE
    WHEN ce.entity_type = 'building' THEN 'buildings'
    WHEN ce.entity_type = 'road' THEN 'roads'
    WHEN ce.entity_type = 'green_blue_system' THEN 'greenBlue'
    WHEN ce.entity_type = 'land_use' THEN 'landUse'
    WHEN ce.entity_type = 'place' THEN 'places'
    WHEN ce.entity_type IN ('facility', 'mobility_asset', 'service_point') THEN 'accessSeeds'
    ELSE ce.entity_type
  END AS semantic_class,
  ce.label,
  ce.authority_status,
  ce.confidence,
  COALESCE(
    b.source_coverage_status,
    ce.properties->>'source_coverage_status',
    ce.properties->>'sourceCoverageStatus',
    'base-source-only'
  ) AS source_coverage_status,
  COALESCE(
    ce.properties->>'provider',
    ce.properties->>'sourceLayer',
    ce.properties->>'sourceType',
    ce.properties#>>'{sourceProperties,source}'
  ) AS provider,
  COALESCE(
    ce.properties->>'sourceFormat',
    ce.properties->>'source_format',
    ce.properties->>'sourceType',
    ce.properties#>>'{sourceProperties,source_format}'
  ) AS source_format,
  COALESCE(
    ce.properties->>'sourceFamily',
    ce.properties->>'source_family',
    ce.properties->>'sourceLayer',
    ce.entity_type
  ) AS source_family,
  COALESCE(r.road_class, ce.properties#>>'{sourceProperties,highway}', ce.properties->>'highway') AS road_class,
  COALESCE(b.building_type, ce.properties#>>'{sourceProperties,building}', ce.properties->>'building') AS building_type,
  COALESCE(
    b.height_m,
    NULLIF((regexp_match(COALESCE(
      ce.properties->>'height_m',
      ce.properties->>'height',
      ce.properties->>'building:height',
      ce.properties#>>'{sourceProperties,height_m}',
      ce.properties#>>'{sourceProperties,height}',
      ce.properties#>>'{sourceProperties,building:height}',
      ''
    ), '[-+]?[0-9]+[.]?[0-9]*'))[1], '')::numeric
  ) AS height_m,
  COALESCE(
    b.levels,
    NULLIF((regexp_match(COALESCE(
      ce.properties->>'levels',
      ce.properties->>'building:levels',
      ce.properties->>'estimated_floors',
      ce.properties#>>'{sourceProperties,levels}',
      ce.properties#>>'{sourceProperties,building:levels}',
      ce.properties#>>'{sourceProperties,estimated_floors}',
      ''
    ), '[-+]?[0-9]+[.]?[0-9]*'))[1], '')::numeric
  ) AS floors,
  COALESCE(
    l.land_use_class,
    g.system_type,
    ce.properties#>>'{sourceProperties,landuse}',
    ce.properties#>>'{sourceProperties,natural}',
    ce.properties#>>'{sourceProperties,leisure}',
    ce.properties->>'landuse',
    ce.properties->>'natural',
    ce.properties->>'leisure'
  ) AS land_use_class,
  COALESCE(
    f.category,
    f.amenity,
    g.system_type,
    g.green_blue_role,
    l.coverage_class,
    p.place_type,
    ce.properties#>>'{sourceProperties,category}',
    ce.properties#>>'{sourceProperties,amenity}',
    ce.properties#>>'{sourceProperties,shop}',
    ce.properties#>>'{sourceProperties,public_transport}',
    ce.properties#>>'{sourceProperties,landuse}',
    ce.properties#>>'{sourceProperties,natural}',
    ce.properties#>>'{sourceProperties,leisure}',
    ce.properties#>>'{sourceProperties,place}',
    ce.properties->>'category',
    ce.properties->>'amenity',
    ce.properties->>'shop',
    ce.properties->>'public_transport',
    ce.properties->>'landuse',
    ce.properties->>'natural',
    ce.properties->>'leisure',
    ce.properties->>'place'
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
  ce.geom,
  ST_GeometryType(ce.geom) AS geometry_type,
  ce.properties,
  ce.updated_at
FROM ldt_core.city_entities ce
LEFT JOIN ldt_core.road_entities r ON r.entity_id = ce.id
LEFT JOIN ldt_core.building_entities b ON b.entity_id = ce.id
LEFT JOIN ldt_core.facility_entities f ON f.entity_id = ce.id
LEFT JOIN ldt_core.place_entities p ON p.entity_id = ce.id
LEFT JOIN ldt_core.land_use_entities l ON l.entity_id = ce.id
LEFT JOIN ldt_core.green_blue_entities g ON g.entity_id = ce.id
LEFT JOIN ldt_environment.object_observation_summary env
  ON env.city_id = ce.city_id
  AND env.entity_id = ce.id
  AND env.scenario_key = 'baseline'
WHERE ce.lifecycle_status = 'active';

COMMENT ON TABLE ldt_environment.object_observation_summary IS
  'One-row-per-object environmental observation summary for fast TwinQL/CQL2 filters and viewer payloads.';

COMMENT ON VIEW ldt_query.city_objects IS
  'Canonical read-only city-object surface for SQL-grade TwinQL/CQL2 queries. It is backed by ldt_core.city_entities and fast environmental observation summaries.';
