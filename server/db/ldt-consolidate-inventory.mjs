import pg from 'pg'
import { getProductionDatabaseUrl } from './migrate.mjs'

const { Pool } = pg

const DEFAULT_CITY_IDS = ['adazi', 'kharkiv']
const CONSOLIDATED_SOURCE_LAYERS = [
  'roads',
  'buildings',
  'facilities',
  'greenBlue',
  'places',
  'center',
  'overture-buildings',
]

function parseArgs() {
  const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
  const all = process.argv.includes('--all')
  if (all) return { cityIds: [] }
  if (!cityArg) return { cityIds: DEFAULT_CITY_IDS }
  return {
    cityIds: cityArg
      .slice('--city='.length)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  }
}

function createPool() {
  const connectionString = getProductionDatabaseUrl()
  if (!connectionString) throw new Error('DATABASE_URL_REQUIRED')
  return new Pool({
    connectionString,
    max: Number(process.env.TWIN_STUDIO_DATABASE_POOL_SIZE ?? 5),
    connectionTimeoutMillis: Number(process.env.TWIN_STUDIO_DATABASE_CONNECT_TIMEOUT_MS ?? 5000),
  })
}

async function listCityIds(client, requestedCityIds) {
  if (requestedCityIds.length > 0) return requestedCityIds
  const result = await client.query('SELECT id FROM ldt_core.cities ORDER BY id')
  return result.rows.map((row) => row.id)
}

async function createPhase3Activity(client, cityId) {
  const result = await client.query(
    `
      INSERT INTO ldt_prov.activities (
        city_id,
        activity_type,
        status,
        software_version,
        metadata,
        finished_at
      )
      VALUES (
        $1,
        'phase-3-consolidation',
        'completed',
        'twin-base-studio-local',
        '{"phase":"phase-3-consolidation","purpose":"create consolidated city inventory from source evidence"}'::jsonb,
        now()
      )
      RETURNING id
    `,
    [cityId],
  )
  return result.rows[0].id
}

async function clearPhase3Inventory(client, cityId) {
  await client.query(
    `
      CREATE TEMP TABLE tmp_phase3_existing_entities ON COMMIT DROP AS
      SELECT id
      FROM ldt_core.city_entities
      WHERE city_id = $1
        AND properties->>'phase' = 'phase-3-consolidation'
    `,
    [cityId],
  )
  await client.query('CREATE INDEX tmp_phase3_existing_entities_id_idx ON tmp_phase3_existing_entities (id)')

  // Clear dependent phase-3 rows explicitly. Relying only on FK cascades is very slow
  // for large city snapshots because the delete touches many analytical schemas.
  await client.query(
    `
      UPDATE ldt_analysis.selection_set_members ssm
      SET city_entity_id = NULL
      FROM tmp_phase3_existing_entities e
      WHERE ssm.city_entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_environment.object_observations oo
      USING tmp_phase3_existing_entities e
      WHERE oo.entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_environment.object_observation_summary oos
      USING tmp_phase3_existing_entities e
      WHERE oos.entity_id = e.id
    `,
  )
  await client.query(
    `
      UPDATE ldt_fiware.context_observations co
      SET entity_id = NULL
      FROM tmp_phase3_existing_entities e
      WHERE co.entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_fiware.context_projection_state cps
      USING tmp_phase3_existing_entities e
      WHERE cps.entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_interop.ngsi_entity_projections nep
      USING tmp_phase3_existing_entities e
      WHERE nep.entity_id = e.id
    `,
  )
  await client.query(
    `
      UPDATE ldt_science.indicator_observations io
      SET geography_entity_id = NULL
      FROM tmp_phase3_existing_entities e
      WHERE io.geography_entity_id = e.id
    `,
  )
  await client.query(
    `
      UPDATE ldt_science.network_metrics nm
      SET geography_entity_id = NULL
      FROM tmp_phase3_existing_entities e
      WHERE nm.geography_entity_id = e.id
    `,
  )
  await client.query(
    `
      UPDATE ldt_semantic.service_features sf
      SET entity_id = NULL
      FROM tmp_phase3_existing_entities e
      WHERE sf.entity_id = e.id
    `,
  )
  await client.query(
    `
      UPDATE ldt_society.observations so
      SET geography_entity_id = NULL
      FROM tmp_phase3_existing_entities e
      WHERE so.geography_entity_id = e.id
    `,
  )
  await client.query(
    `
      UPDATE ldt_society.social_vulnerability_scores svs
      SET geography_entity_id = NULL
      FROM tmp_phase3_existing_entities e
      WHERE svs.geography_entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_society.cultural_assets ca
      USING tmp_phase3_existing_entities e
      WHERE ca.entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_core.building_entities be
      USING tmp_phase3_existing_entities e
      WHERE be.entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_core.road_entities re
      USING tmp_phase3_existing_entities e
      WHERE re.entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_core.facility_entities fe
      USING tmp_phase3_existing_entities e
      WHERE fe.entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_core.place_entities pe
      USING tmp_phase3_existing_entities e
      WHERE pe.entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_core.green_blue_entities gbe
      USING tmp_phase3_existing_entities e
      WHERE gbe.entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_core.land_use_entities lue
      USING tmp_phase3_existing_entities e
      WHERE lue.entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_core.mobility_entities me
      USING tmp_phase3_existing_entities e
      WHERE me.entity_id = e.id
    `,
  )

  await client.query(
    `
      DELETE FROM ldt_prov.lineage_events
      WHERE city_id = $1
        AND event_payload->>'phase' = 'phase-3-consolidation'
    `,
    [cityId],
  )
  await client.query(
    `
      DELETE FROM ldt_prov.lineage_events le
      USING tmp_phase3_existing_entities e
      WHERE le.subject_entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_prov.entity_match_groups
      WHERE city_id = $1
        AND properties->>'phase' = 'phase-3-consolidation'
    `,
    [cityId],
  )
  await client.query(
    `
      DELETE FROM ldt_prov.entity_review_decisions erd
      USING tmp_phase3_existing_entities e
      WHERE erd.entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_prov.entity_source_evidence ese
      USING tmp_phase3_existing_entities e
      WHERE ese.entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_core.entity_identifiers ei
      USING tmp_phase3_existing_entities e
      WHERE ei.entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_core.asset_relationships ar
      USING tmp_phase3_existing_entities e
      WHERE ar.subject_entity_id = e.id
         OR ar.object_entity_id = e.id
    `,
  )
  await client.query(
    `
      DELETE FROM ldt_core.city_entities
      WHERE city_id = $1
        AND properties->>'phase' = 'phase-3-consolidation'
    `,
    [cityId],
  )
}

async function createSourceTempTable(client, cityId) {
  await client.query(
    `
      CREATE TEMP TABLE tmp_phase3_sources ON COMMIT DROP AS
      WITH ranked AS (
        SELECT
          sf.*,
          COALESCE(
            NULLIF(sf.payload->>'legacySourceFeatureId', ''),
            NULLIF(sf.payload->'payload'->'properties'->>'id', ''),
            sf.source_feature_id
          ) AS canonical_source_id,
          row_number() OVER (
            PARTITION BY sf.city_id, sf.source_layer, COALESCE(
              NULLIF(sf.payload->>'legacySourceFeatureId', ''),
              NULLIF(sf.payload->'payload'->'properties'->>'id', ''),
              sf.source_feature_id
            )
            ORDER BY sf.created_at DESC, sf.id DESC
          ) AS rank
        FROM ldt_prov.source_features sf
        JOIN ldt_catalog.datasets d ON d.id = sf.dataset_id
        WHERE sf.city_id = $1
          AND sf.source_layer = ANY($2::text[])
          AND d.identifier LIKE $3
          AND sf.geom IS NOT NULL
      )
      SELECT
        id AS source_feature_id,
        city_id,
        source_layer,
        source_type,
        canonical_source_id,
        CASE
          WHEN source_layer = 'roads' THEN 'road'
          WHEN source_layer IN ('buildings', 'overture-buildings') THEN 'building'
          WHEN source_layer = 'facilities' THEN 'facility'
          WHEN source_layer = 'greenBlue' THEN 'green_blue_system'
          WHEN source_layer IN ('places', 'center') THEN 'place'
          ELSE 'place'
        END AS entity_type,
        CASE
          WHEN source_layer = 'roads' THEN 'road:' || canonical_source_id
          WHEN source_layer IN ('buildings', 'overture-buildings') THEN 'building:' || canonical_source_id
          WHEN source_layer = 'facilities' THEN 'facility:' || canonical_source_id
          WHEN source_layer = 'greenBlue' THEN 'green-blue:' || canonical_source_id
          WHEN source_layer IN ('places', 'center') THEN 'place:' || canonical_source_id
          ELSE source_layer || ':' || canonical_source_id
        END AS stable_id,
        COALESCE(
          NULLIF(payload->'payload'->'properties'->>'label', ''),
          NULLIF(payload->'payload'->'properties'->>'name', ''),
          canonical_source_id
        ) AS label,
        payload->'payload'->'properties' AS source_properties,
        CASE
          WHEN GeometryType(geom) IN ('POLYGON', 'MULTIPOLYGON') THEN ST_MakeValid(geom)
          ELSE geom
        END AS geom
      FROM ranked
      WHERE rank = 1
    `,
    [cityId, CONSOLIDATED_SOURCE_LAYERS, `tbs:open-data:${cityId}:%`],
  )
  await client.query('CREATE INDEX tmp_phase3_sources_layer_idx ON tmp_phase3_sources (source_layer, entity_type)')
  await client.query('CREATE INDEX tmp_phase3_sources_stable_idx ON tmp_phase3_sources (stable_id)')
  await client.query('CREATE INDEX tmp_phase3_sources_geom_gix ON tmp_phase3_sources USING gist (geom)')
  await client.query('ANALYZE tmp_phase3_sources')
}

async function insertBaseEntities(client, cityId) {
  const result = await client.query(
    `
      INSERT INTO ldt_core.city_entities (
        city_id,
        stable_id,
        entity_type,
        label,
        canonical_uri,
        authority_status,
        confidence,
        lifecycle_status,
        geom,
        properties
      )
      SELECT
        city_id,
        stable_id,
        entity_type,
        label,
        'urn:polisplexity:ldt:' || city_id || ':entity:' || stable_id,
        CASE
          WHEN source_layer = 'overture-buildings' OR source_type = 'open-provider' THEN 'open-provider-evidence'
          ELSE 'open-data'
        END,
        CASE
          WHEN source_layer = 'overture-buildings' OR source_type = 'open-provider' THEN 'candidate'
          ELSE 'source-evidence'
        END,
        'active',
        geom,
        jsonb_build_object(
          'phase', 'phase-3-consolidation',
          'sourceLayer', source_layer,
          'canonicalSourceId', canonical_source_id,
          'sourceType', source_type,
          'sourceProperties', COALESCE(source_properties, '{}'::jsonb)
        )
      FROM tmp_phase3_sources
      WHERE source_layer <> 'overture-buildings'
      ON CONFLICT (city_id, stable_id) DO UPDATE SET
        entity_type = EXCLUDED.entity_type,
        label = EXCLUDED.label,
        canonical_uri = EXCLUDED.canonical_uri,
        authority_status = EXCLUDED.authority_status,
        confidence = EXCLUDED.confidence,
        lifecycle_status = EXCLUDED.lifecycle_status,
        geom = EXCLUDED.geom,
        properties = EXCLUDED.properties,
        updated_at = now()
      RETURNING id, entity_type
    `,
  )
  return result.rows
}

async function createBuildingMatchTempTable(client) {
  await client.query(
    `
      CREATE TEMP TABLE tmp_phase3_base_buildings ON COMMIT DROP AS
      SELECT
        s.source_feature_id,
        ce.id AS entity_id,
        ce.stable_id,
        s.geom,
        ST_Transform(ST_PointOnSurface(s.geom), 3857) AS centroid_3857
      FROM tmp_phase3_sources s
      JOIN ldt_core.city_entities ce
        ON ce.city_id = s.city_id
       AND ce.stable_id = s.stable_id
      WHERE s.source_layer = 'buildings'
        AND GeometryType(s.geom) IN ('POLYGON', 'MULTIPOLYGON')
    `,
  )
  await client.query('CREATE INDEX tmp_phase3_base_buildings_geom_gix ON tmp_phase3_base_buildings USING gist (geom)')
  await client.query('CREATE INDEX tmp_phase3_base_buildings_centroid_gix ON tmp_phase3_base_buildings USING gist (centroid_3857)')

  await client.query(
    `
      CREATE TEMP TABLE tmp_phase3_overture_buildings ON COMMIT DROP AS
      SELECT
        source_feature_id,
        city_id,
        source_layer,
        source_type,
        canonical_source_id,
        entity_type,
        stable_id,
        label,
        source_properties,
        geom,
        ST_Transform(ST_PointOnSurface(geom), 3857) AS centroid_3857
      FROM tmp_phase3_sources
      WHERE source_layer = 'overture-buildings'
        AND GeometryType(geom) IN ('POLYGON', 'MULTIPOLYGON')
    `,
  )
  await client.query('CREATE INDEX tmp_phase3_overture_buildings_geom_gix ON tmp_phase3_overture_buildings USING gist (geom)')
  await client.query('CREATE INDEX tmp_phase3_overture_buildings_centroid_gix ON tmp_phase3_overture_buildings USING gist (centroid_3857)')
  await client.query('ANALYZE tmp_phase3_base_buildings')
  await client.query('ANALYZE tmp_phase3_overture_buildings')

  await client.query(
    `
      CREATE TEMP TABLE tmp_phase3_building_matches ON COMMIT DROP AS
      SELECT
        o.source_feature_id AS overture_source_feature_id,
        b.source_feature_id AS base_source_feature_id,
        b.entity_id AS matched_entity_id,
        CASE
          WHEN b.entity_id IS NULL THEN NULL
          WHEN b.intersects_observed THEN 'geometry-intersection'
          WHEN b.centroid_distance_m <= 10 THEN 'centroid-within-10m'
          ELSE NULL
        END AS match_method,
        CASE
          WHEN b.entity_id IS NULL THEN NULL
          WHEN b.intersects_observed THEN 0.95
          WHEN b.centroid_distance_m <= 10 THEN 0.70
          ELSE NULL
        END AS match_score,
        b.centroid_distance_m
      FROM tmp_phase3_overture_buildings o
      LEFT JOIN LATERAL (
        SELECT
          base.entity_id,
          base.source_feature_id,
          ST_Intersects(o.geom, base.geom) AS intersects_observed,
          ST_Distance(o.centroid_3857, base.centroid_3857) AS centroid_distance_m
        FROM tmp_phase3_base_buildings base
        WHERE base.geom && ST_Expand(o.geom, 0.00025)
          AND (
            ST_Intersects(o.geom, base.geom)
            OR ST_DWithin(o.centroid_3857, base.centroid_3857, 18)
          )
        ORDER BY
          CASE WHEN o.geom && base.geom AND ST_Intersects(o.geom, base.geom) THEN 0 ELSE 1 END,
          ST_Distance(o.centroid_3857, base.centroid_3857) ASC
        LIMIT 1
      ) b ON true
      WHERE b.entity_id IS NOT NULL
        AND (
          b.intersects_observed
          OR b.centroid_distance_m <= 10
        )
    `,
  )
  await client.query('CREATE INDEX tmp_phase3_building_matches_overture_idx ON tmp_phase3_building_matches (overture_source_feature_id)')
  await client.query('CREATE INDEX tmp_phase3_building_matches_entity_idx ON tmp_phase3_building_matches (matched_entity_id)')
  await client.query('ANALYZE tmp_phase3_building_matches')
}

async function insertUnmatchedOvertureBuildings(client) {
  const result = await client.query(
    `
      INSERT INTO ldt_core.city_entities (
        city_id,
        stable_id,
        entity_type,
        label,
        canonical_uri,
        authority_status,
        confidence,
        lifecycle_status,
        geom,
        properties
      )
      SELECT
        o.city_id,
        o.stable_id,
        'building',
        COALESCE(o.label, 'Open building footprint'),
        'urn:polisplexity:ldt:' || o.city_id || ':entity:' || o.stable_id,
        'open-provider-evidence',
        'candidate',
        'active',
        o.geom,
        jsonb_build_object(
          'phase', 'phase-3-consolidation',
          'sourceLayer', o.source_layer,
          'canonicalSourceId', o.canonical_source_id,
          'sourceType', o.source_type,
          'sourceCoverageStatus', 'open-provider-only',
          'sourceProperties', COALESCE(o.source_properties, '{}'::jsonb)
        )
      FROM tmp_phase3_overture_buildings o
      LEFT JOIN tmp_phase3_building_matches m
        ON m.overture_source_feature_id = o.source_feature_id
      WHERE m.matched_entity_id IS NULL
      ON CONFLICT (city_id, stable_id) DO UPDATE SET
        entity_type = EXCLUDED.entity_type,
        label = EXCLUDED.label,
        canonical_uri = EXCLUDED.canonical_uri,
        authority_status = EXCLUDED.authority_status,
        confidence = EXCLUDED.confidence,
        lifecycle_status = EXCLUDED.lifecycle_status,
        geom = EXCLUDED.geom,
        properties = EXCLUDED.properties,
        updated_at = now()
      RETURNING id, entity_type
    `,
  )
  return result.rows
}

async function insertTypedEntityRows(client) {
  await client.query(
    `
      INSERT INTO ldt_core.building_entities (
        entity_id,
        building_type,
        use_class,
        levels,
        height_m,
        footprint_area_m2,
        source_coverage_status,
        bim_status
      )
      SELECT
        ce.id,
        COALESCE(ce.properties->'sourceProperties'->>'building', ce.properties->'sourceProperties'->>'kind', 'building'),
        ce.properties->'sourceProperties'->>'use',
        CASE
          WHEN ce.properties->'sourceProperties'->>'levels' ~ '^[0-9]+([.][0-9]+)?$'
            THEN (ce.properties->'sourceProperties'->>'levels')::numeric
          ELSE NULL
        END,
        CASE
          WHEN ce.properties->'sourceProperties'->>'height' ~ '^[0-9]+([.][0-9]+)?$'
            THEN (ce.properties->'sourceProperties'->>'height')::numeric
          ELSE NULL
        END,
        CASE
          WHEN ce.properties->'sourceProperties'->>'footprint_area_m2' ~ '^[0-9]+([.][0-9]+)?$'
            THEN (ce.properties->'sourceProperties'->>'footprint_area_m2')::numeric
          ELSE NULL
        END,
        COALESCE(ce.properties->>'sourceCoverageStatus', 'base-source-only'),
        COALESCE(ce.properties->'sourceProperties'->>'bim_status', 'none')
      FROM ldt_core.city_entities ce
      WHERE ce.properties->>'phase' = 'phase-3-consolidation'
        AND ce.entity_type = 'building'
      ON CONFLICT (entity_id) DO UPDATE SET
        building_type = EXCLUDED.building_type,
        use_class = EXCLUDED.use_class,
        levels = EXCLUDED.levels,
        height_m = EXCLUDED.height_m,
        footprint_area_m2 = EXCLUDED.footprint_area_m2,
        source_coverage_status = EXCLUDED.source_coverage_status,
        bim_status = EXCLUDED.bim_status
    `,
  )

  await client.query(
    `
      INSERT INTO ldt_core.road_entities (
        entity_id,
        road_class,
        name,
        maxspeed,
        lanes,
        oneway,
        network_role
      )
      SELECT
        ce.id,
        ce.properties->'sourceProperties'->>'highway',
        ce.properties->'sourceProperties'->>'name',
        ce.properties->'sourceProperties'->>'maxspeed',
        ce.properties->'sourceProperties'->>'lanes',
        ce.properties->'sourceProperties'->>'oneway',
        'open-street-network'
      FROM ldt_core.city_entities ce
      WHERE ce.properties->>'phase' = 'phase-3-consolidation'
        AND ce.entity_type = 'road'
      ON CONFLICT (entity_id) DO UPDATE SET
        road_class = EXCLUDED.road_class,
        name = EXCLUDED.name,
        maxspeed = EXCLUDED.maxspeed,
        lanes = EXCLUDED.lanes,
        oneway = EXCLUDED.oneway,
        network_role = EXCLUDED.network_role
    `,
  )

  await client.query(
    `
      INSERT INTO ldt_core.facility_entities (
        entity_id,
        category,
        amenity,
        operator,
        public_access
      )
      SELECT
        ce.id,
        COALESCE(ce.properties->'sourceProperties'->>'category', ce.properties->'sourceProperties'->>'kind'),
        ce.properties->'sourceProperties'->>'amenity',
        ce.properties->'sourceProperties'->>'operator',
        ce.properties->'sourceProperties'->>'access'
      FROM ldt_core.city_entities ce
      WHERE ce.properties->>'phase' = 'phase-3-consolidation'
        AND ce.entity_type = 'facility'
      ON CONFLICT (entity_id) DO UPDATE SET
        category = EXCLUDED.category,
        amenity = EXCLUDED.amenity,
        operator = EXCLUDED.operator,
        public_access = EXCLUDED.public_access
    `,
  )

  await client.query(
    `
      INSERT INTO ldt_core.place_entities (
        entity_id,
        place_type,
        population,
        admin_level
      )
      SELECT
        ce.id,
        ce.properties->'sourceProperties'->>'place',
        CASE
          WHEN ce.properties->'sourceProperties'->>'population' ~ '^[0-9]+([.][0-9]+)?$'
            THEN (ce.properties->'sourceProperties'->>'population')::numeric
          ELSE NULL
        END,
        ce.properties->'sourceProperties'->>'admin_level'
      FROM ldt_core.city_entities ce
      WHERE ce.properties->>'phase' = 'phase-3-consolidation'
        AND ce.entity_type = 'place'
      ON CONFLICT (entity_id) DO UPDATE SET
        place_type = EXCLUDED.place_type,
        population = EXCLUDED.population,
        admin_level = EXCLUDED.admin_level
    `,
  )

  await client.query(
    `
      INSERT INTO ldt_core.green_blue_entities (
        entity_id,
        system_type,
        green_blue_role,
        area_m2
      )
      SELECT
        ce.id,
        COALESCE(ce.properties->'sourceProperties'->>'category', ce.properties->'sourceProperties'->>'kind'),
        COALESCE(ce.properties->'sourceProperties'->>'natural', ce.properties->'sourceProperties'->>'leisure', ce.properties->'sourceProperties'->>'landuse'),
        CASE
          WHEN ce.properties->'sourceProperties'->>'area_m2' ~ '^[0-9]+([.][0-9]+)?$'
            THEN (ce.properties->'sourceProperties'->>'area_m2')::numeric
          ELSE NULL
        END
      FROM ldt_core.city_entities ce
      WHERE ce.properties->>'phase' = 'phase-3-consolidation'
        AND ce.entity_type = 'green_blue_system'
      ON CONFLICT (entity_id) DO UPDATE SET
        system_type = EXCLUDED.system_type,
        green_blue_role = EXCLUDED.green_blue_role,
        area_m2 = EXCLUDED.area_m2
    `,
  )
}

async function insertEvidence(client) {
  await client.query(
    `
      INSERT INTO ldt_prov.entity_source_evidence (
        entity_id,
        source_feature_id,
        evidence_role,
        match_score,
        confidence,
        properties
      )
      SELECT
        ce.id,
        s.source_feature_id,
        'primary-open-source',
        1.0,
        'direct-source',
        jsonb_build_object(
          'phase', 'phase-3-consolidation',
          'sourceLayer', s.source_layer
        )
      FROM tmp_phase3_sources s
      JOIN ldt_core.city_entities ce
        ON ce.city_id = s.city_id
       AND ce.stable_id = s.stable_id
      WHERE s.source_layer <> 'overture-buildings'
      ON CONFLICT (entity_id, source_feature_id, evidence_role) DO UPDATE SET
        match_score = EXCLUDED.match_score,
        confidence = EXCLUDED.confidence,
        properties = EXCLUDED.properties
    `,
  )

  await client.query(
    `
      INSERT INTO ldt_prov.entity_source_evidence (
        entity_id,
        source_feature_id,
        evidence_role,
        match_score,
        confidence,
        properties
      )
      SELECT
        COALESCE(m.matched_entity_id, ce.id),
        o.source_feature_id,
        CASE WHEN m.matched_entity_id IS NULL THEN 'primary-open-provider' ELSE 'confirms-open-source' END,
        COALESCE(m.match_score, 1.0),
        CASE WHEN m.matched_entity_id IS NULL THEN 'candidate' ELSE 'matched-open-provider' END,
        jsonb_build_object(
          'phase', 'phase-3-consolidation',
          'sourceLayer', o.source_layer,
          'matchMethod', m.match_method,
          'matchDistanceM', CASE WHEN m.centroid_distance_m IS NULL THEN NULL ELSE round(m.centroid_distance_m::numeric, 1) END
        )
      FROM tmp_phase3_overture_buildings o
      LEFT JOIN tmp_phase3_building_matches m
        ON m.overture_source_feature_id = o.source_feature_id
      LEFT JOIN ldt_core.city_entities ce
        ON ce.city_id = o.city_id
       AND ce.stable_id = o.stable_id
      ON CONFLICT (entity_id, source_feature_id, evidence_role) DO UPDATE SET
        match_score = EXCLUDED.match_score,
        confidence = EXCLUDED.confidence,
        properties = EXCLUDED.properties
    `,
  )
}

async function insertBuildingMatchGroups(client, cityId) {
  const groupResult = await client.query(
    `
      INSERT INTO ldt_prov.entity_match_groups (
        city_id,
        group_key,
        entity_type,
        match_method,
        status,
        confidence,
        properties
      )
      SELECT DISTINCT
        $1,
        'building-match:' || ce.stable_id,
        'building',
        'geometry-or-centroid',
        'accepted-open-evidence',
        'matched-open-provider',
        jsonb_build_object(
          'phase', 'phase-3-consolidation',
          'matchedProvider', 'overture-buildings'
        )
      FROM tmp_phase3_building_matches m
      JOIN ldt_core.city_entities ce ON ce.id = m.matched_entity_id
      ON CONFLICT (city_id, group_key) DO UPDATE SET
        match_method = EXCLUDED.match_method,
        status = EXCLUDED.status,
        confidence = EXCLUDED.confidence,
        properties = EXCLUDED.properties,
        updated_at = now()
      RETURNING id, group_key
    `,
    [cityId],
  )

  await client.query(
    `
      INSERT INTO ldt_prov.entity_match_group_members (
        match_group_id,
        source_feature_id,
        entity_id,
        member_role,
        match_score,
        properties
      )
      SELECT DISTINCT
        mg.id,
        m.base_source_feature_id,
        m.matched_entity_id,
        'base-observed-entity',
        1.0,
        '{"phase":"phase-3-consolidation"}'::jsonb
      FROM tmp_phase3_building_matches m
      JOIN ldt_core.city_entities ce ON ce.id = m.matched_entity_id
      JOIN ldt_prov.entity_match_groups mg
        ON mg.city_id = $1
       AND mg.group_key = 'building-match:' || ce.stable_id
      ON CONFLICT DO NOTHING
    `,
    [cityId],
  )

  await client.query(
    `
      INSERT INTO ldt_prov.entity_match_group_members (
        match_group_id,
        source_feature_id,
        entity_id,
        member_role,
        match_score,
        properties
      )
      SELECT
        mg.id,
        m.overture_source_feature_id,
        m.matched_entity_id,
        'provider-confirmation',
        m.match_score,
        jsonb_build_object(
          'phase', 'phase-3-consolidation',
          'matchMethod', m.match_method,
          'matchDistanceM', CASE WHEN m.centroid_distance_m IS NULL THEN NULL ELSE round(m.centroid_distance_m::numeric, 1) END
        )
      FROM tmp_phase3_building_matches m
      JOIN ldt_core.city_entities ce ON ce.id = m.matched_entity_id
      JOIN ldt_prov.entity_match_groups mg
        ON mg.city_id = $1
       AND mg.group_key = 'building-match:' || ce.stable_id
      ON CONFLICT DO NOTHING
    `,
    [cityId],
  )

  return groupResult.rowCount
}

async function insertReviewDecisions(client, cityId) {
  await client.query(
    `
      INSERT INTO ldt_prov.entity_review_decisions (
        entity_id,
        decision,
        authority_status,
        decided_by,
        rationale,
        metadata
      )
      SELECT
        ce.id,
        CASE
          WHEN ce.authority_status = 'open-provider-evidence' THEN 'candidate-open-inventory'
          ELSE 'accepted-open-inventory'
        END,
        ce.authority_status,
        'phase-3-consolidation',
        CASE
          WHEN ce.authority_status = 'open-provider-evidence'
            THEN 'Provider-only open footprint retained as candidate inventory pending authority/manual validation.'
          ELSE 'Open source feature accepted into the consolidated city inventory as baseline evidence.'
        END,
        jsonb_build_object('phase', 'phase-3-consolidation')
      FROM ldt_core.city_entities ce
      WHERE ce.city_id = $1
        AND ce.properties->>'phase' = 'phase-3-consolidation'
      ON CONFLICT DO NOTHING
    `,
    [cityId],
  )
}

async function insertRunLineage(client, cityId, activityId, summary) {
  await client.query(
    `
      INSERT INTO ldt_prov.lineage_events (
        city_id,
        activity_id,
        event_type,
        event_payload
      )
      VALUES (
        $1,
        $2,
        'phase-3-consolidation-run',
        $3::jsonb
      )
    `,
    [cityId, activityId, JSON.stringify({ phase: 'phase-3-consolidation', ...summary })],
  )
}

async function summarizeCity(client, cityId) {
  const entityCounts = await client.query(
    `
      SELECT entity_type, count(*)::int AS count
      FROM ldt_core.city_entities
      WHERE city_id = $1
        AND properties->>'phase' = 'phase-3-consolidation'
      GROUP BY entity_type
      ORDER BY entity_type
    `,
    [cityId],
  )
  const evidence = await client.query(
    `
      SELECT count(*)::int AS count
      FROM ldt_prov.entity_source_evidence ese
      JOIN ldt_core.city_entities ce ON ce.id = ese.entity_id
      WHERE ce.city_id = $1
        AND ce.properties->>'phase' = 'phase-3-consolidation'
    `,
    [cityId],
  )
  const matches = await client.query(
    `
      SELECT
        count(*)::int AS matched_overture,
        count(distinct matched_entity_id)::int AS matched_entities
      FROM tmp_phase3_building_matches
    `,
  )
  const unmatched = await client.query(
    `
      SELECT count(*)::int AS count
      FROM tmp_phase3_overture_buildings o
      LEFT JOIN tmp_phase3_building_matches m
        ON m.overture_source_feature_id = o.source_feature_id
      WHERE m.matched_entity_id IS NULL
    `,
  )
  return {
    entityCounts: Object.fromEntries(entityCounts.rows.map((row) => [row.entity_type, row.count])),
    evidenceCount: evidence.rows[0].count,
    buildingMatches: matches.rows[0],
    unmatchedOvertureBuildings: unmatched.rows[0].count,
  }
}

async function consolidateCity(client, cityId) {
  await client.query('BEGIN')
  try {
    const city = await client.query('SELECT id, name FROM ldt_core.cities WHERE id = $1', [cityId])
    if (city.rowCount === 0) throw new Error(`LDT_CITY_NOT_FOUND:${cityId}`)

    await clearPhase3Inventory(client, cityId)
    const activityId = await createPhase3Activity(client, cityId)
    await createSourceTempTable(client, cityId)
    const baseEntities = await insertBaseEntities(client, cityId)
    await createBuildingMatchTempTable(client)
    const unmatchedOverture = await insertUnmatchedOvertureBuildings(client)
    await insertTypedEntityRows(client)
    await insertEvidence(client)
    const matchGroupCount = await insertBuildingMatchGroups(client, cityId)
    await insertReviewDecisions(client, cityId)
    const summary = await summarizeCity(client, cityId)
    await insertRunLineage(client, cityId, activityId, {
      baseEntityInsertCount: baseEntities.length,
      unmatchedOvertureInsertCount: unmatchedOverture.length,
      matchGroupCount,
      ...summary,
    })
    await client.query('COMMIT')

    return {
      cityId,
      name: city.rows[0].name,
      baseEntityInsertCount: baseEntities.length,
      unmatchedOvertureInsertCount: unmatchedOverture.length,
      matchGroupCount,
      ...summary,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

export async function consolidateLdtInventory({ cityIds = DEFAULT_CITY_IDS } = {}) {
  const pool = createPool()
  const client = await pool.connect()
  try {
    const targetCityIds = await listCityIds(client, cityIds)
    const cities = []
    for (const cityId of targetCityIds) {
      cities.push(await consolidateCity(client, cityId))
    }
    return {
      ok: true,
      cityCount: cities.length,
      cities,
    }
  } finally {
    client.release()
    await pool.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs()
  consolidateLdtInventory(args)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2))
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
