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
  WHERE eo.entity_id = ce.id
) env ON true
WHERE ce.lifecycle_status = 'active';

COMMENT ON VIEW ldt_query.city_objects IS
  'Canonical read-only city-object surface for SQL-grade TwinQL/CQL2 queries. It is backed by ldt_core.city_entities and includes environmental observation columns when generated.';
