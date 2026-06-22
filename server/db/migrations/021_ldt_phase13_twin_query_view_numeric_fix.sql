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
WHERE cf.feature_type <> 'buildingCandidateMatched';

COMMENT ON VIEW ldt_query.city_objects IS
  'Canonical read-only city-object surface for SQL-grade TwinQL/CQL2 queries. It hides current storage tables behind stable semantic columns for UI, APIs, embeds, and agents.';
