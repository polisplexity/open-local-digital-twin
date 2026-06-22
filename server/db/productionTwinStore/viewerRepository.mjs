import { getProductionPool } from '../postgisPool.mjs'
import { viewerFeatureProperties } from './featurePresentation.mjs'

const DEFAULT_VIEWPORT_FEATURE_LIMIT = 300000
const MAX_VIEWPORT_FEATURE_LIMIT = 300000
const DEFAULT_TILE_FEATURE_LIMIT = 300000
const MAX_TILE_FEATURE_LIMIT = 300000

function parseMaybeJson(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function clampInteger(value, fallback, min, max) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function normalizeLayerKeys(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? '').trim()).filter(Boolean)
  }
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeBbox(value) {
  const parts = Array.isArray(value)
    ? value
    : String(value ?? '').split(',')
  const numbers = parts.map(finiteNumber)
  if (numbers.length !== 4 || numbers.some((number) => number == null)) {
    throw new Error('BBOX_REQUIRED_AS_MINLON_MINLAT_MAXLON_MAXLAT')
  }
  const [minLon, minLat, maxLon, maxLat] = numbers
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90 || minLon >= maxLon || minLat >= maxLat) {
    throw new Error('BBOX_OUT_OF_RANGE')
  }
  return [minLon, minLat, maxLon, maxLat]
}

function normalizeLonLat(value) {
  if (value == null || value === '') return null
  const parts = Array.isArray(value)
    ? value
    : String(value).split(',')
  const numbers = parts.map(finiteNumber)
  if (numbers.length !== 2 || numbers.some((number) => number == null)) {
    throw new Error('CENTER_REQUIRED_AS_LON_LAT')
  }
  const [lon, lat] = numbers
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    throw new Error('CENTER_OUT_OF_RANGE')
  }
  return [lon, lat]
}

function normalizeTileCoordinate(value, name) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) {
    throw new Error(`${name.toUpperCase()}_TILE_COORDINATE_REQUIRED`)
  }
  return number
}

function layerSourceFormats(row = {}) {
  const metadata = parseMaybeJson(row.metadata, {}) ?? {}
  const catalogFormats = Array.isArray(row.catalog_source_formats) ? row.catalog_source_formats : []
  const jobFormats = Array.isArray(row.job_source_formats) ? row.job_source_formats : []
  return Array.from(new Set([
    metadata.sourceFormat,
    metadata.latestPackage?.sourceFormat,
    ...catalogFormats,
    ...jobFormats,
  ]
    .map((format) => String(format ?? '').trim().toLowerCase())
    .filter(Boolean)))
}

function hasAnyTerm(values, terms) {
  return values.some((value) => terms.some((term) => value.includes(term)))
}

function buildLayerCapability(row, cityId) {
  const metadata = parseMaybeJson(row.metadata, {}) ?? {}
  const sourceFormats = layerSourceFormats(row)
  const layerFamily = String(row.layer_family ?? '').toLowerCase()
  const geometryType = String(row.geometry_type ?? 'Geometry')
  const featureCount = Number(row.feature_count ?? 0)
  const hasFeatures = featureCount > 0
  const rasterLike = hasAnyTerm(sourceFormats, ['stac', 'cog', 'wms', 'raster', 'satellite'])
  const bimLike = layerFamily.includes('bim') || hasAnyTerm(sourceFormats, ['ifc', 'bim'])
  const threeDLike = layerFamily.includes('3d') || hasAnyTerm(sourceFormats, ['cityjson', '3d-tiles', 'tileset', 'bim', 'ifc'])
  const vectorLike = hasFeatures && !rasterLike && !bimLike
  const canVectorTile = hasFeatures && !rasterLike
  const catalogCount = Number(row.catalog_count ?? 0)
  const latestPackage = metadata.latestPackage ?? null
  const recommendedTransports = []

  if (vectorLike) recommendedTransports.push(featureCount > 1000 ? 'mvt' : 'geojson')
  if (canVectorTile && featureCount > 1000) recommendedTransports.push('geojson-window')
  if (bimLike) recommendedTransports.push('bim-payload')
  if (rasterLike) recommendedTransports.push('catalog-metadata')
  if (threeDLike && !bimLike) recommendedTransports.push('3d-package-metadata')
  if (!recommendedTransports.length && hasFeatures) recommendedTransports.push('geojson-window')

  return {
    key: row.key,
    name: row.name,
    layerFamily: row.layer_family,
    geometryType,
    authorityStatus: row.authority_status,
    accessLevel: row.access_level,
    semanticStatus: row.semantic_status,
    sourceLicense: row.source_license,
    updateFrequency: row.update_frequency,
    provider: row.provider_id ? { id: row.provider_id, name: row.provider_name } : null,
    featureCount,
    sourceFormats,
    catalogCount,
    latestPackage,
    latestFeatureAt: row.latest_feature_at,
    latestJobAt: row.latest_job_at,
    updatedAt: row.updated_at,
    capabilities: {
      geojsonWindow: {
        available: hasFeatures,
        endpoint: `/api/live/${encodeURIComponent(cityId)}/features`,
        parameters: {
          bbox: 'minLon,minLat,maxLon,maxLat',
          layers: row.key,
          limit: DEFAULT_VIEWPORT_FEATURE_LIMIT,
        },
      },
      vectorTile: {
        available: canVectorTile,
        endpointTemplate: `/api/live/${encodeURIComponent(cityId)}/tiles/{z}/{x}/{y}.mvt?layers=${encodeURIComponent(row.key)}`,
        maxZoom: 22,
        defaultLimit: DEFAULT_TILE_FEATURE_LIMIT,
      },
      bim: {
        available: bimLike,
        payloadEndpoint: bimLike ? `/api/admin/cities/${encodeURIComponent(cityId)}/layers/${encodeURIComponent(row.key)}/bim-payload` : null,
        liveLayersEndpoint: bimLike ? `/api/live/${encodeURIComponent(cityId)}/bim-layers` : null,
        assetTemplate: bimLike ? `/api/live/${encodeURIComponent(cityId)}/bim-assets/${encodeURIComponent(row.key)}/{bundleId}/{assetName}` : null,
      },
      rasterCatalog: {
        available: rasterLike || catalogCount > 0,
        sourceFormat: sourceFormats.find((format) => ['stac', 'cog', 'wms', 'raster-package', 'satellite'].some((term) => format.includes(term))) ?? null,
        catalogRecords: catalogCount,
      },
      threeDPackage: {
        available: threeDLike,
        sourceFormat: sourceFormats.find((format) => ['cityjson', '3d-tiles', 'tileset', 'bim', 'ifc'].some((term) => format.includes(term))) ?? null,
      },
    },
    recommendedTransports,
    limitations: [
      ...(hasFeatures ? [] : ['No normalized vector features are stored for this layer yet.']),
      ...(rasterLike ? ['Raster imagery is represented as package/catalog metadata; binary raster delivery should use object storage or a tile service.'] : []),
      ...(threeDLike && !bimLike ? ['3D package support is metadata/index level until a viewer adapter streams native 3D Tiles or CityJSON geometry.'] : []),
    ],
  }
}

export async function getCityLayerCapabilities(cityId) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      layers: [],
      summary: {
        layerCount: 0,
        geojsonLayerCount: 0,
        vectorTileLayerCount: 0,
        bimLayerCount: 0,
        rasterMetadataLayerCount: 0,
        threeDMetadataLayerCount: 0,
      },
      error: null,
    }
  }

  try {
    const result = await pool.query(
      `
        WITH feature_counts AS (
          SELECT
            layer_id,
            count(*)::int AS feature_count,
            max(updated_at) AS latest_feature_at
          FROM city_features
          WHERE city_id = $1
          GROUP BY layer_id
        ),
        job_formats AS (
          SELECT
            layer_id,
            array_remove(array_agg(DISTINCT lower(source_format)), NULL) AS source_formats,
            max(updated_at) AS latest_job_at
          FROM layer_ingestion_jobs
          WHERE city_id = $1
          GROUP BY layer_id
        ),
        catalog_formats AS (
          SELECT
            layer_id,
            count(*)::int AS catalog_count,
            array_remove(array_agg(DISTINCT lower(metadata->>'sourceFormat')), NULL) AS source_formats
          FROM dataset_catalog_records
          WHERE city_id = $1
          GROUP BY layer_id
        )
        SELECT
          ld.id,
          ld.key,
          ld.name,
          ld.layer_family,
          ld.geometry_type,
          ld.authority_status,
          ld.access_level,
          ld.source_license,
          ld.update_frequency,
          ld.semantic_status,
          ld.metadata,
          ld.updated_at,
          p.id AS provider_id,
          p.name AS provider_name,
          COALESCE(fc.feature_count, 0)::int AS feature_count,
          fc.latest_feature_at,
          jf.latest_job_at,
          COALESCE(jf.source_formats, ARRAY[]::text[]) AS job_source_formats,
          COALESCE(cf.source_formats, ARRAY[]::text[]) AS catalog_source_formats,
          COALESCE(cf.catalog_count, 0)::int AS catalog_count
        FROM layer_definitions ld
        LEFT JOIN providers p ON p.id = ld.provider_id
        LEFT JOIN feature_counts fc ON fc.layer_id = ld.id
        LEFT JOIN job_formats jf ON jf.layer_id = ld.id
        LEFT JOIN catalog_formats cf ON cf.layer_id = ld.id
        WHERE ld.city_id = $1
        ORDER BY ld.layer_family ASC, ld.key ASC
      `,
      [cityId],
    )
    const layers = result.rows.map((row) => buildLayerCapability(row, cityId))
    return {
      configured: true,
      ok: true,
      cityId,
      generatedAt: new Date().toISOString(),
      endpoints: {
        geojsonWindow: `/api/live/${encodeURIComponent(cityId)}/features?bbox=minLon,minLat,maxLon,maxLat&layers=layerKey&limit=${DEFAULT_VIEWPORT_FEATURE_LIMIT}`,
        vectorTileTemplate: `/api/live/${encodeURIComponent(cityId)}/tiles/{z}/{x}/{y}.mvt?layers=layerKey&limit=${DEFAULT_TILE_FEATURE_LIMIT}`,
        bimLayers: `/api/live/${encodeURIComponent(cityId)}/bim-layers`,
        bimAssetTemplate: `/api/live/${encodeURIComponent(cityId)}/bim-assets/{layerKey}/{bundleId}/{assetName}`,
      },
      layers,
      summary: {
        layerCount: layers.length,
        geojsonLayerCount: layers.filter((layer) => layer.capabilities.geojsonWindow.available).length,
        vectorTileLayerCount: layers.filter((layer) => layer.capabilities.vectorTile.available).length,
        bimLayerCount: layers.filter((layer) => layer.capabilities.bim.available).length,
        rasterMetadataLayerCount: layers.filter((layer) => layer.capabilities.rasterCatalog.available).length,
        threeDMetadataLayerCount: layers.filter((layer) => layer.capabilities.threeDPackage.available).length,
      },
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      layers: [],
      summary: {
        layerCount: 0,
        geojsonLayerCount: 0,
        vectorTileLayerCount: 0,
        bimLayerCount: 0,
        rasterMetadataLayerCount: 0,
        threeDMetadataLayerCount: 0,
      },
      error: String(error?.message ?? 'UNKNOWN_LAYER_CAPABILITIES_ERROR'),
    }
  }
}

export async function getCityBoundaryBbox(cityId) {
  const pool = getProductionPool()
  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      bbox: null,
      error: null,
    }
  }

  try {
    const result = await pool.query(
      `
        SELECT
          ST_XMin(box)::float AS west,
          ST_YMin(box)::float AS south,
          ST_XMax(box)::float AS east,
          ST_YMax(box)::float AS north
        FROM (
          SELECT ST_Extent(geom) AS box
          FROM city_boundaries
          WHERE city_id = $1
        ) bounds
      `,
      [cityId],
    )
    const row = result.rows[0] ?? null
    const bbox = row && [row.west, row.south, row.east, row.north].every((value) => Number.isFinite(Number(value)))
      ? [Number(row.west), Number(row.south), Number(row.east), Number(row.north)]
      : null
    return {
      configured: true,
      ok: true,
      cityId,
      bbox,
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      bbox: null,
      error: String(error?.message ?? 'UNKNOWN_CITY_BOUNDARY_BBOX_ERROR'),
    }
  }
}

export async function getCityFeatureViewport(cityId, options = {}) {
  const pool = getProductionPool()
  const bbox = normalizeBbox(options.bbox)
  const layerKeys = normalizeLayerKeys(options.layerKeys ?? options.layers)
  const center = normalizeLonLat(options.center)
  const radiusMeters = finiteNumber(options.radiusMeters ?? options.radius)
  if (radiusMeters != null && (!center || radiusMeters <= 0)) {
    throw new Error('RADIUS_REQUIRES_CENTER_AND_POSITIVE_METERS')
  }
  const limit = clampInteger(
    options.limit,
    DEFAULT_VIEWPORT_FEATURE_LIMIT,
    1,
    MAX_VIEWPORT_FEATURE_LIMIT,
  )

  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      bbox,
      geojson: { type: 'FeatureCollection', features: [] },
      error: null,
    }
  }

  try {
    const queryLimit = limit + 1
    const result = await pool.query(
      `
        WITH bbox_window AS (
          SELECT ST_MakeEnvelope($2, $3, $4, $5, 4326) AS geom
        ),
        radius_window AS (
          SELECT
            CASE
              WHEN $8::double precision IS NULL OR $10::double precision IS NULL THEN NULL
              ELSE ST_SetSRID(ST_MakePoint($8::double precision, $9::double precision), 4326)
            END AS center_geom,
            $10::double precision AS radius_m
        ),
        latest_boundary AS (
          SELECT geom
          FROM city_boundaries
          WHERE city_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        ),
        viewport_features AS (
          SELECT
            cf.stable_id,
            cf.feature_type,
            cf.label,
            cf.authority_status,
            cf.confidence,
            cf.properties,
            cf.updated_at,
            COALESCE(ld.key, cf.feature_type) AS layer_key,
            CASE
              WHEN cf.feature_type = 'buildingCandidateNew' THEN 'buildings'
              ELSE COALESCE(ld.key, cf.feature_type)
            END AS display_layer_key,
            ld.name AS layer_name,
            ld.layer_family,
            ld.geometry_type AS layer_geometry_type,
            NULL::text AS observed_stable_id,
            NULL::text AS observed_label,
            NULL::text AS observed_confidence,
            NULL::jsonb AS observed_properties,
            NULL::int AS source_evidence_count,
            cf.geom AS display_geom,
            CASE
              WHEN rw.center_geom IS NULL THEN NULL
              ELSE ST_DistanceSphere(ST_PointOnSurface(cf.geom), rw.center_geom)
            END AS distance_m
          FROM city_features cf
          LEFT JOIN layer_definitions ld ON ld.id = cf.layer_id
          LEFT JOIN latest_boundary lb ON true
          CROSS JOIN bbox_window
          CROSS JOIN radius_window rw
          WHERE cf.city_id = $1
            AND cf.geom && bbox_window.geom
            AND ST_Intersects(cf.geom, bbox_window.geom)
            AND (
              rw.center_geom IS NULL
              OR ST_DWithin(
                cf.geom::geography,
                rw.center_geom::geography,
                rw.radius_m
              )
            )
            AND (lb.geom IS NULL OR (cf.geom && lb.geom AND ST_Intersects(cf.geom, lb.geom)))
            AND cf.feature_type <> 'buildingCandidateMatched'
            AND (
              $6::text[] IS NULL
              OR COALESCE(ld.key, cf.feature_type) = ANY($6::text[])
              OR cf.feature_type = ANY($6::text[])
              OR ('buildings' = ANY($6::text[]) AND cf.feature_type = 'buildingCandidateNew')
            )
        ),
        ranked_features AS (
          SELECT
            *,
            CASE display_layer_key
              WHEN 'boundary' THEN 0
              WHEN 'roads' THEN 1
              WHEN 'greenBlue' THEN 2
              WHEN 'facilities' THEN 3
              WHEN 'places' THEN 4
              WHEN 'buildings' THEN 5
              ELSE 9
            END AS layer_priority,
            row_number() OVER (
              PARTITION BY display_layer_key
              ORDER BY md5(stable_id)
            ) AS layer_sample_rank
          FROM viewport_features
        )
        SELECT
          stable_id,
          feature_type,
          label,
          authority_status,
          confidence,
          properties,
          updated_at,
          layer_key,
          display_layer_key,
          layer_name,
          layer_family,
          layer_geometry_type,
          observed_stable_id,
          observed_label,
          observed_confidence,
          observed_properties,
          source_evidence_count,
          CASE
            WHEN GeometryType(display_geom) IN ('POLYGON', 'MULTIPOLYGON') THEN ST_Area(ST_Transform(display_geom, 3857))
            ELSE NULL
          END AS footprint_area_m2,
          ST_AsGeoJSON(display_geom)::json AS geometry
        FROM ranked_features
        WHERE display_geom IS NOT NULL
          AND NOT ST_IsEmpty(display_geom)
          AND ST_Intersects(display_geom, (SELECT geom FROM bbox_window))
        ORDER BY layer_priority ASC, layer_sample_rank ASC, stable_id ASC
        LIMIT $7
      `,
      [
        cityId,
        bbox[0],
        bbox[1],
        bbox[2],
        bbox[3],
        layerKeys.length ? layerKeys : null,
        queryLimit,
        center ? center[0] : null,
        center ? center[1] : null,
        radiusMeters,
      ],
    )
    const rows = result.rows.slice(0, limit)
    const features = rows.map((row) => {
      const properties = viewerFeatureProperties(row)
      return {
        type: 'Feature',
        id: row.stable_id,
        properties,
        geometry: parseMaybeJson(row.geometry, null),
      }
    })

    return {
      configured: true,
      ok: true,
      cityId,
      bbox,
      center,
      radiusMeters,
      layers: layerKeys,
      limit,
      returned: features.length,
      truncated: result.rows.length > limit,
      geojson: {
        type: 'FeatureCollection',
        bbox,
        features,
      },
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      bbox,
      layers: layerKeys,
      geojson: { type: 'FeatureCollection', bbox, features: [] },
      error: String(error?.message ?? 'UNKNOWN_VIEWPORT_FEATURE_ERROR'),
    }
  }
}

export async function getCityFeatureMvtTile(cityId, options = {}) {
  const pool = getProductionPool()
  const z = normalizeTileCoordinate(options.z, 'z')
  const x = normalizeTileCoordinate(options.x, 'x')
  const y = normalizeTileCoordinate(options.y, 'y')
  const maxCoordinate = 2 ** z
  if (z < 0 || z > 22 || x < 0 || y < 0 || x >= maxCoordinate || y >= maxCoordinate) {
    throw new Error('TILE_COORDINATE_OUT_OF_RANGE')
  }
  const layerKeys = normalizeLayerKeys(options.layerKeys ?? options.layers)
  const center = normalizeLonLat(options.center)
  const radiusMeters = finiteNumber(options.radiusMeters ?? options.radius)
  if (radiusMeters != null && (!center || radiusMeters <= 0)) {
    throw new Error('RADIUS_REQUIRES_CENTER_AND_POSITIVE_METERS')
  }
  const limit = clampInteger(options.limit, DEFAULT_TILE_FEATURE_LIMIT, 1, MAX_TILE_FEATURE_LIMIT)

  if (!pool) {
    return {
      configured: false,
      ok: true,
      cityId,
      z,
      x,
      y,
      tile: Buffer.alloc(0),
      byteLength: 0,
      error: null,
    }
  }

  try {
    const result = await pool.query(
      `
        WITH bounds AS (
          SELECT
            ST_TileEnvelope($2, $3, $4) AS geom_3857,
            ST_Transform(ST_TileEnvelope($2, $3, $4), 4326) AS geom_4326
        ),
        radius_window AS (
          SELECT
            CASE
              WHEN $7::double precision IS NULL OR $9::double precision IS NULL THEN NULL
              ELSE ST_SetSRID(ST_MakePoint($7::double precision, $8::double precision), 4326)
            END AS center_geom,
            $9::double precision AS radius_m
        ),
        latest_boundary AS (
          SELECT geom
          FROM city_boundaries
          WHERE city_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        ),
        raw_features AS (
          SELECT
            cf.stable_id AS "stableId",
            cf.feature_type AS "featureType",
            CASE
              WHEN cf.feature_type = 'buildingCandidateNew' THEN 'buildings'
              ELSE COALESCE(ld.key, cf.feature_type)
            END AS "layerKey",
            CASE
              WHEN cf.feature_type = 'buildingCandidateNew' THEN 'buildings'
              ELSE COALESCE(ld.key, cf.feature_type)
            END AS layer_sort_key,
            cf.label,
            cf.authority_status AS "authorityStatus",
            cf.confidence,
            cf.properties->>'highway' AS highway,
            cf.properties->>'category' AS category,
            cf.properties->>'building' AS building,
            cf.properties->>'source_coverage_status' AS "sourceCoverageStatus",
            cf.properties->>'source_match_status' AS "sourceMatchStatus",
            ST_AsMVTGeom(
              ST_Transform(cf.geom, 3857),
              bounds.geom_3857,
              4096,
              64,
              true
            ) AS geom
          FROM city_features cf
          LEFT JOIN layer_definitions ld ON ld.id = cf.layer_id
          CROSS JOIN bounds
          CROSS JOIN radius_window rw
          LEFT JOIN latest_boundary lb ON true
          WHERE cf.city_id = $1
            AND cf.geom && bounds.geom_4326
            AND ST_Intersects(cf.geom, bounds.geom_4326)
            AND (
              rw.center_geom IS NULL
              OR ST_DWithin(
                cf.geom::geography,
                rw.center_geom::geography,
                rw.radius_m
              )
            )
            AND (lb.geom IS NULL OR (cf.geom && lb.geom AND ST_Intersects(cf.geom, lb.geom)))
            AND cf.feature_type <> 'buildingCandidateMatched'
            AND (
              $5::text[] IS NULL
              OR COALESCE(ld.key, cf.feature_type) = ANY($5::text[])
              OR cf.feature_type = ANY($5::text[])
              OR ('buildings' = ANY($5::text[]) AND cf.feature_type = 'buildingCandidateNew')
            )
        ),
        ranked_features AS (
          SELECT
            raw_features.*,
            ROW_NUMBER() OVER (
              PARTITION BY raw_features.layer_sort_key
              ORDER BY raw_features."stableId" ASC
            ) AS layer_rank
          FROM raw_features
          WHERE raw_features.geom IS NOT NULL
        ),
        mvt_features AS (
          SELECT
            "stableId",
            "featureType",
            "layerKey",
            label,
            "authorityStatus",
            confidence,
            highway,
            category,
            building,
            "sourceCoverageStatus",
            "sourceMatchStatus",
            geom
          FROM ranked_features
          ORDER BY layer_rank ASC, layer_sort_key ASC, "stableId" ASC
          LIMIT $6
        )
        SELECT ST_AsMVT(mvt_features, 'features', 4096, 'geom') AS tile
        FROM mvt_features
      `,
      [
        cityId,
        z,
        x,
        y,
        layerKeys.length ? layerKeys : null,
        limit,
        center ? center[0] : null,
        center ? center[1] : null,
        radiusMeters,
      ],
    )
    const tile = Buffer.from(result.rows[0]?.tile ?? [])
    return {
      configured: true,
      ok: true,
      cityId,
      z,
      x,
      y,
      layers: layerKeys,
      center,
      radiusMeters,
      limit,
      tile,
      byteLength: tile.byteLength,
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      cityId,
      z,
      x,
      y,
      layers: layerKeys,
      center,
      radiusMeters,
      tile: Buffer.alloc(0),
      byteLength: 0,
      error: String(error?.message ?? 'UNKNOWN_MVT_TILE_ERROR'),
    }
  }
}
