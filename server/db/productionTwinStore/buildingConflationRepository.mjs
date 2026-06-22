import { getProductionPool } from '../postgisPool.mjs'
import {
  OPEN_DATA_PROVIDER_ID,
  compactText,
  json,
  parseMaybeJson,
  upsertOpenDataProvider,
} from './repositoryUtils.mjs'

function buildingSourceStatus(source, count = 0, extra = {}) {
  return {
    ...source,
    count: Number(count ?? 0),
    active: Number(count ?? 0) > 0,
    ...extra,
  }
}

export async function getCityBuildingCoverageSummary(cityId) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      coverage: null,
      error: null,
    }
  }

  try {
    const [cityResult, buildingResult, providerLayerResult, conflationResult] = await Promise.all([
      pool.query(
        `
          SELECT c.id, c.name, c.country, c.country_code, c.region,
            ST_Area(ST_Transform(cb.geom, 3857)) / 1000000 AS scope_area_km2
          FROM cities c
          LEFT JOIN LATERAL (
            SELECT geom
            FROM city_boundaries
            WHERE city_id = c.id
            ORDER BY created_at DESC
            LIMIT 1
          ) cb ON true
          WHERE c.id = $1
        `,
        [cityId],
      ),
      pool.query(
        `
          WITH latest_boundary AS (
            SELECT geom
            FROM city_boundaries
            WHERE city_id = $1
            ORDER BY created_at DESC
            LIMIT 1
          ),
          base_buildings AS (
            SELECT
              cf.id,
              cf.stable_id,
              cf.confidence,
              cf.properties,
              ST_Area(ST_Transform(cf.geom, 3857)) AS footprint_area_m2
            FROM city_features cf
            LEFT JOIN latest_boundary lb ON true
            WHERE cf.city_id = $1
              AND cf.feature_type = 'buildings'
              AND (lb.geom IS NULL OR ST_Intersects(cf.geom, lb.geom))
          ),
          type_counts AS (
            SELECT NULLIF(properties->>'building', '') AS building_type, count(*)::int AS type_count
            FROM base_buildings
            GROUP BY NULLIF(properties->>'building', '')
          )
          SELECT
            count(*)::int AS observed_count,
            COALESCE(sum(footprint_area_m2), 0)::float AS observed_footprint_area_m2,
            COALESCE(avg(NULLIF((properties->>'height')::numeric, 0)), 0)::float AS average_height_m,
            count(*) FILTER (WHERE NULLIF(properties->>'levels', '') IS NOT NULL)::int AS explicit_level_count,
            count(*) FILTER (WHERE NULLIF(properties->>'height', '') IS NOT NULL)::int AS explicit_height_count,
            count(*) FILTER (WHERE confidence IN ('medium', 'high'))::int AS medium_or_high_confidence_count,
            count(*) FILTER (WHERE COALESCE(properties->>'bim_status', '') !~* 'no bim')::int AS bim_linked_count,
            (
              SELECT COALESCE(jsonb_object_agg(building_type, type_count), '{}'::jsonb)
              FROM type_counts
              WHERE building_type IS NOT NULL
            ) AS building_types
          FROM base_buildings
        `,
        [cityId],
      ),
      pool.query(
        `
          SELECT
            ld.key,
            ld.name,
            ld.provider_id,
            p.name AS provider_name,
            ld.source_license,
            ld.authority_status,
            COALESCE(count(cf.id), 0)::int AS feature_count
          FROM layer_definitions ld
          LEFT JOIN providers p ON p.id = ld.provider_id
          LEFT JOIN city_features cf ON cf.layer_id = ld.id
          WHERE ld.city_id = $1
            AND (
              ld.key ILIKE '%building%'
              OR ld.layer_family ILIKE '%building%'
              OR ld.layer_family ILIKE '%built%'
            )
          GROUP BY ld.key, ld.name, ld.provider_id, p.name, ld.source_license, ld.authority_status
          ORDER BY ld.key ASC
        `,
        [cityId],
      ),
      pool.query(
        `
          WITH latest_boundary AS (
            SELECT geom
            FROM city_boundaries
            WHERE city_id = $1
            ORDER BY created_at DESC
            LIMIT 1
          ),
          scoped_building_features AS (
            SELECT
              cf.feature_type,
              COALESCE(NULLIF(cf.properties->>'source_layer_key', ''), ld.key, cf.feature_type) AS layer_key,
              NULLIF(cf.properties->>'matched_observed_id', '') AS matched_observed_id,
              NULLIF(cf.properties->>'match_distance_m', '') AS match_distance_m
            FROM city_features cf
            LEFT JOIN layer_definitions ld ON ld.id = cf.layer_id
            LEFT JOIN latest_boundary lb ON true
            WHERE cf.city_id = $1
              AND cf.feature_type IN ('buildings', 'buildingCandidateNew', 'buildingCandidateMatched')
              AND GeometryType(cf.geom) IN ('POLYGON', 'MULTIPOLYGON')
              AND (lb.geom IS NULL OR (cf.geom && lb.geom AND ST_Intersects(cf.geom, lb.geom)))
          ),
          layer_counts AS (
            SELECT layer_key, count(*)::int AS layer_count
            FROM scoped_building_features
            WHERE feature_type IN ('buildingCandidateNew', 'buildingCandidateMatched')
            GROUP BY layer_key
          )
          SELECT
            count(*) FILTER (WHERE feature_type = 'buildings')::int AS observed_count,
            count(*) FILTER (WHERE feature_type IN ('buildingCandidateNew', 'buildingCandidateMatched'))::int AS candidate_count,
            count(*) FILTER (WHERE feature_type = 'buildingCandidateMatched')::int AS matched_candidate_count,
            count(DISTINCT matched_observed_id) FILTER (
              WHERE feature_type = 'buildingCandidateMatched'
                AND matched_observed_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            )::int AS matched_observed_count,
            count(*) FILTER (WHERE feature_type = 'buildingCandidateNew')::int AS new_candidate_count,
            0::float AS average_match_iou,
            COALESCE(avg(match_distance_m::numeric) FILTER (
              WHERE feature_type = 'buildingCandidateMatched'
                AND match_distance_m ~ '^-?[0-9]+(\\.[0-9]+)?$'
            ), 0)::float AS average_match_distance_m,
            (SELECT COALESCE(jsonb_object_agg(layer_key, layer_count), '{}'::jsonb) FROM layer_counts) AS candidate_layers
          FROM scoped_building_features
        `,
        [cityId],
      ),
    ])

    const city = cityResult.rows[0] ?? null
    const building = buildingResult.rows[0] ?? {}
    const observedCount = Number(building.observed_count ?? 0)
    const scopeAreaKm2 = Number(city?.scope_area_km2 ?? 0)
    const densityPerKm2 = scopeAreaKm2 > 0 ? observedCount / scopeAreaKm2 : 0
    const providerLayers = providerLayerResult.rows
      .filter((row) => row.key !== 'buildings')
      .map((row) => ({
        key: row.key,
        name: row.name,
        providerId: row.provider_id,
        providerName: row.provider_name,
        sourceLicense: row.source_license,
        authorityStatus: row.authority_status,
        count: Number(row.feature_count ?? 0),
      }))
    const providerLayerText = (row) => `${row.key} ${row.name} ${row.providerName ?? ''}`.toLowerCase()
    const countProviderLayers = (needles) =>
      providerLayers
        .filter((row) => needles.some((needle) => providerLayerText(row).includes(needle)))
        .reduce((sum, row) => sum + row.count, 0)
    const coverageProviderLayers = providerLayers.filter((row) =>
      ['official', 'authority', 'cadastre', 'cadastral', 'overture', 'microsoft', 'google', 'open-buildings']
        .some((needle) => providerLayerText(row).includes(needle)),
    )
    const providerLayerCount = coverageProviderLayers.reduce((sum, row) => sum + row.count, 0)
    const conflation = conflationResult.rows[0] ?? {}
    const newCandidateCount = Number(conflation.new_candidate_count ?? 0)
    const matchedCandidateCount = Number(conflation.matched_candidate_count ?? 0)
    const matchedObservedCount = Number(conflation.matched_observed_count ?? 0)
    const estimatedMissingLow = providerLayerCount > 0 ? newCandidateCount : null
    const estimatedMissingHigh = providerLayerCount > 0 ? newCandidateCount : null

    const sources = [
      buildingSourceStatus(
        {
          key: 'osm',
          name: 'OpenStreetMap / Overpass',
          role: 'Observed base footprints',
          license: 'ODbL',
          posture: 'authoritative-open-baseline',
          note: 'Current base twin source for building footprints and basic tags.',
        },
        observedCount,
      ),
      buildingSourceStatus(
        {
          key: 'official',
          name: 'Official city or national building data',
          role: 'Authority-grade replacement or confirmation',
          license: 'Depends on city/national portal',
          posture: 'preferred-production-source',
          note: 'Not connected for this city yet.',
        },
        countProviderLayers(['official', 'authority', 'cadastre', 'cadastral']),
      ),
      buildingSourceStatus(
        {
          key: 'overture',
          name: 'Overture Maps Buildings',
          role: 'Open conflated candidate and enrichment source',
          license: 'ODbL',
          posture: 'next-open-source-connector',
          note: 'Preferred next connector because it conflates OSM, Microsoft, Google Open Buildings where available, and other compatible sources.',
        },
        countProviderLayers(['overture']),
      ),
      buildingSourceStatus(
        {
          key: 'microsoft',
          name: 'Microsoft Global ML Building Footprints',
          role: 'ML-derived candidate footprints',
          license: 'CDLA Permissive 2.0',
          posture: 'candidate-source',
          note: 'Useful to detect missing footprints; must be de-duplicated and confidence-scored.',
        },
        countProviderLayers(['microsoft']),
      ),
      buildingSourceStatus(
        {
          key: 'google-open-buildings',
          name: 'Google Open Buildings',
          role: 'ML-derived candidate footprints where covered',
          license: 'CC BY 4.0 or ODbL',
          posture: 'coverage-dependent-source',
          note: 'Not a Latvia-wide source; only use where the published coverage includes the city.',
        },
        countProviderLayers(['google', 'open-buildings']),
      ),
    ]

    return {
      configured: true,
      ok: true,
      cityId,
      coverage: {
        city: city
          ? {
              id: city.id,
              name: city.name,
              country: city.country,
              countryCode: city.country_code,
              region: city.region,
              scopeAreaKm2,
            }
          : null,
        observed: {
          count: observedCount,
          footprintAreaM2: Number(building.observed_footprint_area_m2 ?? 0),
          densityPerKm2: Number(densityPerKm2.toFixed(2)),
          averageHeightM: Number(Number(building.average_height_m ?? 0).toFixed(1)),
          explicitHeightCount: Number(building.explicit_height_count ?? 0),
          explicitLevelCount: Number(building.explicit_level_count ?? 0),
          mediumOrHighConfidenceCount: Number(building.medium_or_high_confidence_count ?? 0),
          bimLinkedCount: Number(building.bim_linked_count ?? 0),
          buildingTypes: parseMaybeJson(building.building_types, {}),
        },
        candidates: {
          connectedLayerCount: coverageProviderLayers.length,
          connectedFeatureCount: providerLayerCount,
          layers: coverageProviderLayers,
          enrichmentLayers: providerLayers.filter((row) => !coverageProviderLayers.some((candidate) => candidate.key === row.key)),
        },
        conflation: {
          method: providerLayerCount > 0 ? 'footprint-intersection-or-centroid-distance' : 'not-run-no-candidate-source',
          observedCount: Number(conflation.observed_count ?? observedCount),
          candidateCount: Number(conflation.candidate_count ?? providerLayerCount),
          matchedCandidateCount,
          matchedObservedCount,
          newCandidateCount,
          unmatchedObservedCount: Math.max(0, observedCount - matchedObservedCount),
          averageMatchIou: Number(Number(conflation.average_match_iou ?? 0).toFixed(3)),
          averageMatchDistanceM: Number(Number(conflation.average_match_distance_m ?? 0).toFixed(1)),
          candidateLayers: parseMaybeJson(conflation.candidate_layers, {}),
          rules: {
            intersectsObservedFootprint: true,
            centroidMatchedAtOrBelowM: 10,
            centroidSearchDistanceM: 18,
          },
        },
        estimate: {
          method: providerLayerCount > 0
            ? 'conflated-candidate-building-count'
            : 'not-enough-independent-building-source',
          missingLow: estimatedMissingLow,
          missingHigh: estimatedMissingHigh,
          confidence: providerLayerCount > 0 ? 'candidate-not-authority' : 'unknown',
          note: providerLayerCount > 0
            ? 'This is a candidate missing-building count after geometric conflation. It is not authority-grade until official or manual validation confirms the footprints.'
            : 'No independent candidate or official building layer is connected yet, so the product should not invent a missing-building count.',
        },
        sources,
      },
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      coverage: null,
      error: String(error?.message ?? 'UNKNOWN_BUILDING_COVERAGE_ERROR'),
    }
  } finally {
  }
}

export async function persistCityBuildingConflationLayers(cityId) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      layers: {},
      error: null,
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await upsertOpenDataProvider(client)
    const layerResult = await client.query(
      `
        WITH layer_rows AS (
          SELECT *
          FROM (VALUES
            ('buildingCandidateNew', 'Additional building footprints', 'built-fabric-open-source', 'Polygon', 'open-source', 'source-evidence', 'Open building footprints that extend the observed building base.', '#8ea2b8'),
            ('buildingCandidateMatched', 'Confirmed building footprints', 'built-fabric-open-source', 'Polygon', 'open-source', 'source-evidence', 'Open building footprints that overlap or confirm the observed building base.', '#8ea2b8')
          ) AS row(key, name, layer_family, geometry_type, authority_status, semantic_status, description, color)
        )
        INSERT INTO layer_definitions (
          city_id, provider_id, key, name, layer_family, geometry_type,
          authority_status, access_level, source_license, update_frequency,
          semantic_status, metadata
        )
        SELECT
          $1,
          $2,
          key,
          name,
          layer_family,
          geometry_type,
          authority_status,
          'city-private',
          'Derived from open provider building layers; preserve source layer attribution per feature.',
          'on-ingestion-or-conflation-refresh',
          semantic_status,
          jsonb_build_object(
            'description', description,
            'color', color,
            'derivedLayer', true,
            'conflationRule', 'intersects observed OSM building footprint or centroid within 10m'
          )
        FROM layer_rows
        ON CONFLICT (city_id, key) DO UPDATE SET
          name = excluded.name,
          layer_family = excluded.layer_family,
          geometry_type = excluded.geometry_type,
          authority_status = excluded.authority_status,
          access_level = excluded.access_level,
          source_license = excluded.source_license,
          update_frequency = excluded.update_frequency,
          semantic_status = excluded.semantic_status,
          metadata = layer_definitions.metadata || excluded.metadata,
          updated_at = now()
        RETURNING id, key
      `,
      [cityId, OPEN_DATA_PROVIDER_ID],
    )
    const layerIds = new Map(layerResult.rows.map((row) => [row.key, row.id]))

    await client.query(
      `
        DELETE FROM city_features
        WHERE city_id = $1
          AND (
            feature_type = ANY($2::text[])
            OR layer_id = ANY($3::uuid[])
          )
      `,
      [cityId, ['buildingCandidateNew', 'buildingCandidateMatched'], Array.from(layerIds.values())],
    )

    await client.query(
      `
        CREATE TEMP TABLE tmp_building_conflation_observed ON COMMIT DROP AS
        WITH latest_boundary AS (
          SELECT geom
          FROM city_boundaries
          WHERE city_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        )
        SELECT
          cf.id,
          ST_MakeValid(cf.geom) AS geom,
          ST_Transform(ST_PointOnSurface(ST_MakeValid(cf.geom)), 3857) AS centroid_3857
        FROM city_features cf
        LEFT JOIN latest_boundary lb ON true
        WHERE cf.city_id = $1
          AND cf.feature_type = 'buildings'
          AND GeometryType(cf.geom) IN ('POLYGON', 'MULTIPOLYGON')
          AND (lb.geom IS NULL OR ST_Intersects(cf.geom, lb.geom))
      `,
      [cityId],
    )
    await client.query('CREATE INDEX tmp_building_conflation_observed_geom_gix ON tmp_building_conflation_observed USING gist (geom)')
    await client.query('CREATE INDEX tmp_building_conflation_observed_centroid_gix ON tmp_building_conflation_observed USING gist (centroid_3857)')

    await client.query(
      `
        CREATE TEMP TABLE tmp_building_conflation_candidates ON COMMIT DROP AS
        WITH latest_boundary AS (
          SELECT geom
          FROM city_boundaries
          WHERE city_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        )
        SELECT
          cf.id,
          cf.stable_id,
          cf.label,
          cf.authority_status,
          cf.confidence,
          cf.properties,
          ST_MakeValid(cf.geom) AS geom,
          COALESCE(ld.key, cf.feature_type) AS source_layer_key,
          ld.name AS source_layer_name,
          ST_Transform(ST_PointOnSurface(ST_MakeValid(cf.geom)), 3857) AS centroid_3857
        FROM city_features cf
        JOIN layer_definitions ld ON ld.id = cf.layer_id
        LEFT JOIN providers p ON p.id = ld.provider_id
        LEFT JOIN latest_boundary lb ON true
        WHERE cf.city_id = $1
          AND cf.feature_type <> ALL($2::text[])
          AND GeometryType(cf.geom) IN ('POLYGON', 'MULTIPOLYGON')
          AND (lb.geom IS NULL OR ST_Intersects(cf.geom, lb.geom))
          AND (
            ld.key ILIKE '%overture%'
            OR ld.key ILIKE '%microsoft%'
            OR ld.key ILIKE '%google%'
            OR ld.key ILIKE '%open-buildings%'
            OR ld.key ILIKE '%cadastre%'
            OR ld.key ILIKE '%cadastral%'
            OR ld.key ILIKE '%official%'
            OR p.name ILIKE '%overture%'
            OR p.name ILIKE '%microsoft%'
            OR p.name ILIKE '%google%'
          )
      `,
      [cityId, ['buildings', 'buildingCandidateNew', 'buildingCandidateMatched']],
    )
    await client.query('CREATE INDEX tmp_building_conflation_candidates_geom_gix ON tmp_building_conflation_candidates USING gist (geom)')
    await client.query('CREATE INDEX tmp_building_conflation_candidates_centroid_gix ON tmp_building_conflation_candidates USING gist (centroid_3857)')
    await client.query('ANALYZE tmp_building_conflation_observed')
    await client.query('ANALYZE tmp_building_conflation_candidates')

    const insertResult = await client.query(
      `
        WITH classified AS (
          SELECT
            c.*,
            b.observed_id,
            COALESCE(b.intersects_observed, false) AS intersects_observed,
            b.centroid_distance_m,
            CASE
              WHEN b.observed_id IS NULL THEN 'buildingCandidateNew'
              WHEN b.intersects_observed THEN 'buildingCandidateMatched'
              WHEN b.centroid_distance_m <= 10 THEN 'buildingCandidateMatched'
              ELSE 'buildingCandidateNew'
            END AS layer_key
          FROM tmp_building_conflation_candidates c
          LEFT JOIN LATERAL (
            SELECT
              o.id AS observed_id,
              ST_Intersects(c.geom, o.geom) AS intersects_observed,
              ST_Distance(c.centroid_3857, o.centroid_3857) AS centroid_distance_m
            FROM tmp_building_conflation_observed o
            WHERE c.geom && ST_Expand(o.geom, 0.00025)
               OR ST_DWithin(c.centroid_3857, o.centroid_3857, 18)
            ORDER BY
              CASE WHEN c.geom && o.geom AND ST_Intersects(c.geom, o.geom) THEN 0 ELSE 1 END,
              ST_Distance(c.centroid_3857, o.centroid_3857) ASC
            LIMIT 1
          ) b ON true
        )
        INSERT INTO city_features (
          city_id, layer_id, stable_id, feature_type, label,
          authority_status, confidence, geom, properties
        )
        SELECT
          $1,
          CASE
            WHEN layer_key = 'buildingCandidateNew' THEN $2::uuid
            ELSE $3::uuid
          END,
          layer_key || ':' || stable_id,
          layer_key,
          CASE
            WHEN layer_key = 'buildingCandidateNew' THEN 'New building candidate'
            ELSE 'Matched building candidate'
          END,
          'candidate-review',
          COALESCE(confidence, 'medium'),
          geom,
          COALESCE(properties, '{}'::jsonb) || jsonb_build_object(
            'id', layer_key || ':' || stable_id,
            'label', CASE WHEN layer_key = 'buildingCandidateNew' THEN 'New building candidate' ELSE 'Matched building candidate' END,
            'kind', 'building-coverage-candidate',
            'conflation_status', CASE WHEN layer_key = 'buildingCandidateNew' THEN 'new-candidate' ELSE 'matched' END,
            'source_layer_key', source_layer_key,
            'source_layer_name', source_layer_name,
            'source_stable_id', stable_id,
            'matched_observed_id', observed_id,
            'match_distance_m', CASE WHEN centroid_distance_m IS NULL THEN NULL ELSE round(centroid_distance_m::numeric, 1) END,
            'candidate_not_authority', true
          )
        FROM classified
        ON CONFLICT (city_id, stable_id) DO UPDATE SET
          layer_id = excluded.layer_id,
          feature_type = excluded.feature_type,
          label = excluded.label,
          authority_status = excluded.authority_status,
          confidence = excluded.confidence,
          geom = excluded.geom,
          properties = excluded.properties,
          updated_at = now()
        RETURNING feature_type
      `,
      [
        cityId,
        layerIds.get('buildingCandidateNew'),
        layerIds.get('buildingCandidateMatched'),
      ],
    )
    await client.query('COMMIT')
    const layers = insertResult.rows.reduce((counts, row) => {
      counts[row.feature_type] = (counts[row.feature_type] ?? 0) + 1
      return counts
    }, {})
    return {
      configured: true,
      ok: true,
      cityId,
      layers,
      total: insertResult.rows.length,
      error: null,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    return {
      configured: true,
      ok: false,
      cityId,
      layers: {},
      error: String(error?.message ?? 'UNKNOWN_BUILDING_CONFLATION_PERSIST_ERROR'),
    }
  } finally {
    client.release()
  }
}
