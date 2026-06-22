import { getProductionPool } from '../postgisPool.mjs'
import { viewerFeatureProperties } from './featurePresentation.mjs'
import { nonNegativeIntegerEnv, parseMaybeJson } from './repositoryUtils.mjs'

const DEFAULT_VIEWER_FEATURE_LIMITS = {
  roads: nonNegativeIntegerEnv('TWIN_STUDIO_BASE_ROAD_LIMIT', 300000),
  buildings: nonNegativeIntegerEnv('TWIN_STUDIO_BASE_BUILDING_LIMIT', 300000),
  buildingCandidateNew: nonNegativeIntegerEnv('TWIN_STUDIO_BASE_OVERTURE_NEW_LIMIT', 0),
  buildingCandidateMatched: nonNegativeIntegerEnv('TWIN_STUDIO_BASE_OVERTURE_MATCHED_LIMIT', 0),
  facilities: nonNegativeIntegerEnv('TWIN_STUDIO_BASE_FACILITY_LIMIT', 300000),
  greenBlue: nonNegativeIntegerEnv('TWIN_STUDIO_BASE_GREEN_BLUE_LIMIT', 300000),
  places: nonNegativeIntegerEnv('TWIN_STUDIO_BASE_PLACE_LIMIT', 300000),
  center: 1,
}

const ENABLE_LIVE_UNCLASSIFIED_LAND = process.env.TWIN_STUDIO_ENABLE_LIVE_UNCLASSIFIED_LAND === '1'

export async function getBaseTwinRecordFromProductionStore(cityId, options = {}) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      record: null,
      error: null,
    }
  }

  try {
    const featureLimits = {
      ...DEFAULT_VIEWER_FEATURE_LIMITS,
      ...(options.featureLimits ?? {}),
    }
    const [cityResult, boundaryResult, unclassifiedLandResult, layerResult, featureResult, featureCountResult, runResult] = await Promise.all([
      pool.query(
        `
          SELECT id, name, country, country_code, region, enabled, metadata,
            ST_X(centroid) AS lon,
            ST_Y(centroid) AS lat,
            updated_at
          FROM cities
          WHERE id = $1
        `,
        [cityId],
      ),
      pool.query(
        `
          SELECT source, authority_status, properties, ST_AsGeoJSON(geom)::json AS geometry
          FROM city_boundaries
          WHERE city_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [cityId],
      ),
      ENABLE_LIVE_UNCLASSIFIED_LAND ? pool.query(
        `
          WITH latest_boundary AS (
            SELECT ST_MakeValid(geom) AS geom
            FROM city_boundaries
            WHERE city_id = $1
            ORDER BY created_at DESC
            LIMIT 1
          ),
          landuse AS (
            SELECT ST_UnaryUnion(ST_Collect(ST_Intersection(ST_MakeValid(cf.geom), lb.geom))) AS geom
            FROM city_features cf
            JOIN latest_boundary lb ON true
            WHERE cf.city_id = $1
              AND cf.feature_type = 'greenBlue'
              AND GeometryType(cf.geom) IN ('POLYGON', 'MULTIPOLYGON')
              AND ST_Intersects(ST_MakeValid(cf.geom), lb.geom)
          ),
          unclassified AS (
            SELECT ST_CollectionExtract(
              ST_Difference(
                lb.geom,
                COALESCE(
                  (SELECT geom FROM landuse),
                  ST_SetSRID(ST_GeomFromText('GEOMETRYCOLLECTION EMPTY'), ST_SRID(lb.geom))
                )
              ),
              3
            ) AS geom
            FROM latest_boundary lb
          ),
          dumped AS (
            SELECT (ST_Dump(geom)).geom AS geom
            FROM unclassified
            WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
          )
          SELECT
            row_number() OVER (ORDER BY ST_Area(geom) DESC)::int AS part_number,
            ST_AsGeoJSON(geom)::json AS geometry,
            ST_Area(ST_Transform(geom, 3857)) AS area_m2
          FROM dumped
          WHERE ST_Area(ST_Transform(geom, 3857)) > 1000
          ORDER BY area_m2 DESC
        `,
        [cityId],
      ) : Promise.resolve({ rows: [] }),
      pool.query(
        `
          SELECT key, name, layer_family, geometry_type, semantic_status, metadata, updated_at
          FROM layer_definitions
          WHERE city_id = $1
          ORDER BY key ASC
        `,
        [cityId],
      ),
	      pool.query(
	        `
	          WITH wanted_feature_types(feature_type, feature_limit) AS (
	            VALUES
	              ('roads', $2::int),
              ('buildings', $3::int),
              ('buildingCandidateNew', $4::int),
              ('buildingCandidateMatched', $5::int),
              ('facilities', $6::int),
              ('greenBlue', $7::int),
	              ('places', $8::int),
	              ('center', $9::int)
	          ),
	          limited_features AS (
	            SELECT
	              cf.stable_id,
	              cf.id,
	              cf.feature_type,
	              cf.label,
	              cf.authority_status,
	              cf.confidence,
	              cf.properties,
	              cf.geom,
	              cf.updated_at,
	              COALESCE(ld.key, cf.feature_type) AS layer_key,
	              ld.name AS layer_name,
	              ld.layer_family,
	              ld.geometry_type AS layer_geometry_type,
	              wft.feature_limit
	            FROM wanted_feature_types wft
	            CROSS JOIN LATERAL (
	              SELECT *
	              FROM city_features
	              WHERE city_id = $1
	                AND feature_type = wft.feature_type
	                AND geom IS NOT NULL
	              ORDER BY stable_id ASC
	              LIMIT wft.feature_limit
	            ) cf
	            LEFT JOIN layer_definitions ld ON ld.id = cf.layer_id
	            WHERE wft.feature_limit > 0
	          ),
	          features_with_context AS (
	            SELECT
	              lf.stable_id,
	              lf.feature_type,
	              lf.label,
	              lf.authority_status,
	              lf.confidence,
	              lf.properties,
	              lf.layer_key,
	              lf.layer_name,
	              lf.layer_family,
	              lf.layer_geometry_type,
	              observed.stable_id AS observed_stable_id,
	              observed.label AS observed_label,
	              observed.confidence AS observed_confidence,
	              observed.properties AS observed_properties,
	              source_evidence.source_evidence_count,
	              ST_AsGeoJSON(lf.geom)::json AS geometry,
	              NULL::double precision AS footprint_area_m2,
	              lf.updated_at
	            FROM limited_features lf
	            LEFT JOIN city_features observed
	              ON observed.id = CASE
	                WHEN lf.properties->>'matched_observed_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
	                  THEN (lf.properties->>'matched_observed_id')::uuid
	                ELSE NULL
	              END
	            LEFT JOIN LATERAL (
	              SELECT count(*)::int AS source_evidence_count
	              FROM city_features evidence
	              WHERE evidence.city_id = $1
	                AND evidence.feature_type = 'buildingCandidateMatched'
	                AND evidence.properties->>'matched_observed_id' = lf.id::text
	            ) source_evidence ON lf.feature_type = 'buildings'
	          )
	          SELECT
		            stable_id,
		            feature_type,
	            label,
	            authority_status,
	            confidence,
	            properties,
	            layer_key,
	            layer_name,
	            layer_family,
	            layer_geometry_type,
	            observed_stable_id,
	            observed_label,
	            observed_confidence,
	            observed_properties,
	            source_evidence_count,
		            geometry,
		            footprint_area_m2,
		            updated_at
	          FROM features_with_context
	          ORDER BY feature_type ASC, stable_id ASC
	        `,
        [
          cityId,
          featureLimits.roads,
          featureLimits.buildings,
          featureLimits.buildingCandidateNew,
          featureLimits.buildingCandidateMatched,
          featureLimits.facilities,
          featureLimits.greenBlue,
          featureLimits.places,
          featureLimits.center,
        ],
      ),
      pool.query(
        `
          SELECT feature_type, count(*)::int AS count
          FROM city_features
          WHERE city_id = $1
          GROUP BY feature_type
        `,
        [cityId],
      ),
      pool.query(
        `
          SELECT id, source_name, status, started_at, finished_at, stats, metadata
          FROM ingestion_runs
          WHERE city_id = $1 AND status = 'completed'
          ORDER BY finished_at DESC NULLS LAST, started_at DESC
          LIMIT 1
        `,
        [cityId],
      ),
    ])

    const cityRow = cityResult.rows[0]
    if (!cityRow || featureResult.rows.length === 0) {
      return {
        configured: true,
        ok: true,
        cityId,
        record: null,
        error: null,
      }
    }

    const metadata = parseMaybeJson(cityRow.metadata, {})
    const run = runResult.rows[0] ?? null
    const runMetadata = parseMaybeJson(run?.metadata, {})
	    const featureCounts = Object.fromEntries(
	      featureCountResult.rows.map((row) => [row.feature_type, Number(row.count ?? 0)]),
	    )
	    featureCounts.buildingInventory = Number(featureCounts.buildings ?? 0) + Number(featureCounts.buildingCandidateNew ?? 0)
	    featureCounts.buildingSourceMatches = Number(featureCounts.buildingCandidateMatched ?? 0)
	    featureCounts.unclassifiedLand = unclassifiedLandResult.rows.length
    const featureCollections = new Map()

    for (const key of ['roads', 'buildings', 'buildingCandidateNew', 'buildingCandidateMatched', 'facilities', 'greenBlue', 'places', 'center']) {
      featureCollections.set(key, {
        type: 'FeatureCollection',
        features: [],
      })
    }
    featureCollections.set('unclassifiedLand', {
      type: 'FeatureCollection',
      features: unclassifiedLandResult.rows.map((row) => ({
        type: 'Feature',
        properties: {
          id: `unclassified-land:${row.part_number}`,
          label: 'Land-use coverage gap',
          kind: 'land-use-coverage-gap',
          category: 'land-use-gap',
          source: 'derived-boundary-minus-osm-landuse',
          area_m2: Number(row.area_m2 ?? 0),
        },
        geometry: parseMaybeJson(row.geometry, null),
      })),
    })

    for (const row of featureResult.rows) {
      const properties = viewerFeatureProperties(row)
      const collection = featureCollections.get(properties.layerKey ?? row.feature_type)
      if (!collection) continue
      collection.features.push({
        type: 'Feature',
        properties,
        geometry: parseMaybeJson(row.geometry, null),
      })
    }

    const boundaryRow = boundaryResult.rows[0] ?? null
    const boundaryGeometry = parseMaybeJson(boundaryRow?.geometry, null)
    const boundary =
      boundaryGeometry
        ? {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: parseMaybeJson(boundaryRow.properties, {}),
                geometry:
                  boundaryGeometry.type === 'MultiPolygon'
                    ? {
                        type: 'Polygon',
                        coordinates: boundaryGeometry.coordinates?.[0] ?? [],
                      }
                    : boundaryGeometry,
              },
            ],
          }
        : { type: 'FeatureCollection', features: [] }

    return {
      configured: true,
      ok: true,
      cityId,
      record: {
        city: {
          id: cityRow.id,
          name: cityRow.name,
          country: cityRow.country ?? '',
          countryCode: cityRow.country_code ?? '',
          region: cityRow.region ?? '',
          lat: Number(cityRow.lat),
          lon: Number(cityRow.lon),
          enabled: cityRow.enabled !== false,
          twinLabel: metadata.twinLabel || `${cityRow.name} Digital Twin`,
          nominatimQuery: metadata.nominatimQuery || `${cityRow.name}, ${cityRow.country}`,
          wikipediaTownPage: metadata.wikipediaTownPage || encodeURIComponent(cityRow.name),
          wikipediaMunicipalityPage:
            metadata.wikipediaMunicipalityPage || encodeURIComponent(cityRow.name),
          municipalityTitle: metadata.municipalityTitle || cityRow.name,
          municipalityDescription: metadata.municipalityDescription || 'Municipal authority territory',
        },
        center: {
          lat: Number(cityRow.lat),
          lon: Number(cityRow.lon),
        },
        boundary,
        layers: Object.fromEntries(featureCollections.entries()),
        featureCounts,
        layerDefinitions: layerResult.rows.map((row) => ({
          key: row.key,
          name: row.name,
          layerFamily: row.layer_family,
          geometryType: row.geometry_type,
          semanticStatus: row.semantic_status,
          metadata: parseMaybeJson(row.metadata, {}),
          updatedAt: row.updated_at,
        })),
        reference: metadata.reference ?? null,
        sourcePayloadVersion: metadata.sourcePayloadVersion ?? null,
        fetchedAt: runMetadata.fetchedAt ?? run?.finished_at ?? cityRow.updated_at,
        extraction: runMetadata.extraction ?? null,
        ingestionRun: run
          ? {
              id: run.id,
              sourceName: run.source_name,
              status: run.status,
              startedAt: run.started_at,
              finishedAt: run.finished_at,
              stats: parseMaybeJson(run.stats, {}),
              metadata: runMetadata,
            }
          : null,
      },
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      record: null,
      error: String(error?.message ?? 'UNKNOWN_BASE_TWIN_RECORD_ERROR'),
    }
  } finally {
  }
}
