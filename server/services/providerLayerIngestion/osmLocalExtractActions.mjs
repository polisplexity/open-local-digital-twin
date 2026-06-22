import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import pg from 'pg'
import { getProductionDatabaseUrl } from '../../db/migrate.mjs'

import {
  addLayerIngestionValidationReport,
  completeLayerIngestionJob,
  markLayerIngestionJobRunning,
} from '../../db/productionTwinStore.mjs'
import { promoteRawOsmPbfExtract } from '../../db/ldt-promote-raw-osm-pbf.mjs'

const execFileAsync = promisify(execFile)
const { Pool } = pg

function defaultRawSchema(cityId) {
  return `raw_osm_${String(cityId || '').replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`
}

function defaultSourceSlug(cityId) {
  return `${String(cityId || 'city').replace(/[^a-z0-9-]/gi, '-').toLowerCase()}-osm-pbf`
}

function compact(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}


function assertIdentifier(value, label) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error(`INVALID_${label.toUpperCase()}:${value}`)
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

async function execOgr(args) {
  return execFileAsync('ogr2ogr', args, {
    timeout: Number(process.env.TWIN_STUDIO_OSM_PBF_IMPORT_TIMEOUT_MS ?? 20 * 60 * 1000),
    maxBuffer: Number(process.env.TWIN_STUDIO_NATIVE_EXTRACT_MAX_BUFFER ?? 100 * 1024 * 1024),
    windowsHide: true,
  })
}

async function rawSchemaReady(client, rawSchema) {
  const result = await client.query(
    `
      SELECT to_regclass($1) AS city_roads,
             to_regclass($2) AS city_buildings,
             to_regclass($3) AS city_objects
    `,
    [`${rawSchema}.city_roads`, `${rawSchema}.city_buildings`, `${rawSchema}.city_objects`],
  )
  return Boolean(result.rows[0]?.city_roads && result.rows[0]?.city_buildings && result.rows[0]?.city_objects)
}

async function cityBbox(client, cityId) {
  const result = await client.query(
    `
      SELECT ST_XMin(box)::float AS west,
             ST_YMin(box)::float AS south,
             ST_XMax(box)::float AS east,
             ST_YMax(box)::float AS north
      FROM (
        SELECT ST_Extent(geom) AS box
        FROM public.city_boundaries
        WHERE city_id = $1
      ) bounds
    `,
    [cityId],
  )
  const row = result.rows[0] ?? {}
  const bbox = [row.west, row.south, row.east, row.north].map(Number)
  if (bbox.every(Number.isFinite)) return bbox
  throw new Error(`OSM_LOCAL_EXTRACT_CITY_BOUNDARY_REQUIRED:${cityId}`)
}

function ogrPgConnectionString() {
  return `PG:${getProductionDatabaseUrl()}`
}

async function importOsmPbfBronze({ rawSchema, sourcePath, bbox }) {
  const layerSpecs = [
    ['points', 'osm_points'],
    ['lines', 'osm_lines'],
    ['multilinestrings', 'osm_multilinestrings'],
    ['multipolygons', 'osm_multipolygons'],
    ['other_relations', 'osm_other_relations'],
  ]
  const [west, south, east, north] = bbox
  for (const [sourceLayer, targetTable] of layerSpecs) {
    await execOgr([
      '-f', 'PostgreSQL',
      ogrPgConnectionString(),
      sourcePath,
      sourceLayer,
      '-overwrite',
      '-lco', `SCHEMA=${rawSchema}`,
      '-nln', targetTable,
      '-spat', String(west), String(south), String(east), String(north),
      '-gt', '65536',
      '--config', 'PG_USE_COPY', 'YES',
    ])
  }
}

async function normalizeOsmPbfSilver(client, { cityId, rawSchema, sourceSlug, sourcePath, sourceUrl }) {
  await client.query(`CREATE EXTENSION IF NOT EXISTS hstore`)
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${rawSchema}`)
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${rawSchema}.extract_runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id text NOT NULL,
      source_slug text NOT NULL,
      source_path text,
      source_url text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await client.query(
    `INSERT INTO ${rawSchema}.extract_runs (city_id, source_slug, source_path, source_url) VALUES ($1, $2, $3, $4)`,
    [cityId, sourceSlug, sourcePath || null, sourceUrl || null],
  )

  await client.query(`DROP TABLE IF EXISTS ${rawSchema}.city_roads`)
  await client.query(`
    CREATE TABLE ${rawSchema}.city_roads AS
    SELECT
      $1::text AS city_id,
      'osm-line:' || ogc_fid::text AS source_id,
      osm_id,
      COALESCE(NULLIF(name, ''), highway, railway, waterway, 'road')::text AS label,
      COALESCE(NULLIF(highway, ''), NULLIF(railway, ''), NULLIF(waterway, ''), 'unclassified') AS road_class,
      NULL::text AS surface,
      NULL::text AS maxspeed,
      NULL::text AS lanes,
      NULL::text AS oneway,
      CASE WHEN other_tags IS NULL OR other_tags = '' THEN ''::hstore ELSE other_tags::hstore END AS properties,
      ST_Multi(ST_CollectionExtract(ST_MakeValid(wkb_geometry), 2))::geometry(MultiLineString,4326) AS geom
    FROM ${rawSchema}.osm_lines
    WHERE wkb_geometry IS NOT NULL
      AND (highway IS NOT NULL OR railway IS NOT NULL OR waterway IS NOT NULL)
  `, [cityId])
  await client.query(`DELETE FROM ${rawSchema}.city_roads WHERE geom IS NULL OR ST_IsEmpty(geom)`)

  await client.query(`DROP TABLE IF EXISTS ${rawSchema}.city_buildings`)
  await client.query(`
    CREATE TABLE ${rawSchema}.city_buildings AS
    SELECT
      $1::text AS city_id,
      'osm-polygon:' || ogc_fid::text AS source_id,
      COALESCE(osm_way_id, osm_id)::text AS osm_id,
      COALESCE(NULLIF(name, ''), 'Building')::text AS label,
      COALESCE(NULLIF(building, ''), 'yes') AS building_type,
      NULLIF((CASE WHEN other_tags IS NULL OR other_tags = '' THEN NULL ELSE (other_tags::hstore)->'building:levels' END), '')::numeric AS levels,
      NULLIF((CASE WHEN other_tags IS NULL OR other_tags = '' THEN NULL ELSE regexp_replace((other_tags::hstore)->'height', '[^0-9.]', '', 'g') END), '')::numeric AS height_m,
      CASE WHEN other_tags IS NULL OR other_tags = '' THEN ''::hstore ELSE other_tags::hstore END AS properties,
      ST_Area(wkb_geometry::geography) AS footprint_area_m2,
      ST_Multi(ST_CollectionExtract(ST_MakeValid(wkb_geometry), 3))::geometry(MultiPolygon,4326) AS geom
    FROM ${rawSchema}.osm_multipolygons
    WHERE wkb_geometry IS NOT NULL
      AND building IS NOT NULL
  `, [cityId])
  await client.query(`DELETE FROM ${rawSchema}.city_buildings WHERE geom IS NULL OR ST_IsEmpty(geom)`)

  await client.query(`DROP TABLE IF EXISTS ${rawSchema}.city_facilities`)
  await client.query(`
    CREATE TABLE ${rawSchema}.city_facilities AS
    SELECT * FROM (
      SELECT
        $1::text AS city_id,
        'osm-point:' || ogc_fid::text AS source_id,
        osm_id,
        COALESCE(NULLIF(name, ''), 'Facility')::text AS label,
        COALESCE((CASE WHEN other_tags IS NULL OR other_tags = '' THEN NULL ELSE (other_tags::hstore)->'amenity' END),
                 (CASE WHEN other_tags IS NULL OR other_tags = '' THEN NULL ELSE (other_tags::hstore)->'shop' END),
                 (CASE WHEN other_tags IS NULL OR other_tags = '' THEN NULL ELSE (other_tags::hstore)->'tourism' END),
                 man_made,
                 highway,
                 'facility')::text AS category,
        CASE WHEN other_tags IS NULL OR other_tags = '' THEN NULL ELSE (other_tags::hstore)->'amenity' END AS amenity,
        CASE WHEN other_tags IS NULL OR other_tags = '' THEN NULL ELSE (other_tags::hstore)->'shop' END AS shop,
        CASE WHEN other_tags IS NULL OR other_tags = '' THEN NULL ELSE (other_tags::hstore)->'tourism' END AS tourism,
        CASE WHEN other_tags IS NULL OR other_tags = '' THEN NULL ELSE (other_tags::hstore)->'public_transport' END AS public_transport,
        man_made,
        CASE WHEN other_tags IS NULL OR other_tags = '' THEN ''::hstore ELSE other_tags::hstore END AS properties,
        wkb_geometry::geometry(Point,4326) AS geom
      FROM ${rawSchema}.osm_points
      WHERE wkb_geometry IS NOT NULL
        AND (man_made IS NOT NULL OR highway IN ('bus_stop', 'traffic_signals') OR (other_tags IS NOT NULL AND other_tags ~ 'amenity|shop|tourism|public_transport'))
      UNION ALL
      SELECT
        $1::text AS city_id,
        'osm-polygon-facility:' || ogc_fid::text AS source_id,
        COALESCE(osm_way_id, osm_id)::text AS osm_id,
        COALESCE(NULLIF(name, ''), amenity, shop, tourism, man_made, 'Facility')::text AS label,
        COALESCE(amenity, shop, tourism, man_made, 'facility')::text AS category,
        amenity::text,
        shop::text,
        tourism::text,
        NULL::text AS public_transport,
        man_made,
        CASE WHEN other_tags IS NULL OR other_tags = '' THEN ''::hstore ELSE other_tags::hstore END AS properties,
        ST_PointOnSurface(ST_Multi(ST_CollectionExtract(ST_MakeValid(wkb_geometry), 3)))::geometry(Point,4326) AS geom
      FROM ${rawSchema}.osm_multipolygons
      WHERE wkb_geometry IS NOT NULL
        AND (amenity IS NOT NULL OR shop IS NOT NULL OR tourism IS NOT NULL OR man_made IS NOT NULL)
    ) facilities
    WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
  `, [cityId])

  await client.query(`DROP TABLE IF EXISTS ${rawSchema}.city_green_blue`)
  await client.query(`
    CREATE TABLE ${rawSchema}.city_green_blue AS
    SELECT
      $1::text AS city_id,
      'osm-green-blue:' || ogc_fid::text AS source_id,
      COALESCE(osm_way_id, osm_id)::text AS osm_id,
      COALESCE(NULLIF(name, ''), landuse, "natural", leisure, 'Green-blue system')::text AS label,
      COALESCE(landuse, "natural", leisure, 'green_blue') AS category,
      landuse,
      "natural",
      leisure,
      NULL::text AS waterway,
      CASE WHEN other_tags IS NULL OR other_tags = '' THEN ''::hstore ELSE other_tags::hstore END AS properties,
      ST_Area(wkb_geometry::geography) AS area_m2,
      ST_Multi(ST_CollectionExtract(ST_MakeValid(wkb_geometry), 3))::geometry(MultiPolygon,4326) AS geom
    FROM ${rawSchema}.osm_multipolygons
    WHERE wkb_geometry IS NOT NULL
      AND (landuse IS NOT NULL OR "natural" IS NOT NULL OR leisure IS NOT NULL)
  `, [cityId])
  await client.query(`DELETE FROM ${rawSchema}.city_green_blue WHERE geom IS NULL OR ST_IsEmpty(geom)`)

  await client.query(`DROP TABLE IF EXISTS ${rawSchema}.city_places`)
  await client.query(`
    CREATE TABLE ${rawSchema}.city_places AS
    SELECT
      $1::text AS city_id,
      'osm-place:' || ogc_fid::text AS source_id,
      osm_id,
      COALESCE(NULLIF(name, ''), place, 'Place')::text AS label,
      COALESCE(place, 'place') AS place_type,
      NULLIF((CASE WHEN other_tags IS NULL OR other_tags = '' THEN NULL ELSE (other_tags::hstore)->'population' END), '')::numeric AS population,
      CASE WHEN other_tags IS NULL OR other_tags = '' THEN ''::hstore ELSE other_tags::hstore END AS properties,
      wkb_geometry::geometry(Point,4326) AS geom
    FROM ${rawSchema}.osm_points
    WHERE wkb_geometry IS NOT NULL
      AND place IS NOT NULL
  `, [cityId])

  await client.query(`DROP TABLE IF EXISTS ${rawSchema}.city_objects`)
  await client.query(`
    CREATE TABLE ${rawSchema}.city_objects AS
    SELECT city_id, source_id, osm_id, 'roads'::text AS layer_key, 'road'::text AS semantic_class, label, road_class AS category, hstore_to_jsonb(properties) AS properties, geom::geometry(Geometry,4326) AS geom FROM ${rawSchema}.city_roads
    UNION ALL
    SELECT city_id, source_id, osm_id, 'buildings'::text AS layer_key, 'building'::text AS semantic_class, label, building_type AS category, hstore_to_jsonb(properties) AS properties, geom::geometry(Geometry,4326) AS geom FROM ${rawSchema}.city_buildings
    UNION ALL
    SELECT city_id, source_id, osm_id, 'facilities'::text AS layer_key, 'facility'::text AS semantic_class, label, category::varchar AS category, hstore_to_jsonb(properties) AS properties, geom::geometry(Geometry,4326) AS geom FROM ${rawSchema}.city_facilities
    UNION ALL
    SELECT city_id, source_id, osm_id, 'greenBlue'::text AS layer_key, 'green_blue_system'::text AS semantic_class, label, category, hstore_to_jsonb(properties) AS properties, geom::geometry(Geometry,4326) AS geom FROM ${rawSchema}.city_green_blue
    UNION ALL
    SELECT city_id, source_id, osm_id, 'places'::text AS layer_key, 'place'::text AS semantic_class, label, place_type AS category, hstore_to_jsonb(properties) AS properties, geom::geometry(Geometry,4326) AS geom FROM ${rawSchema}.city_places
  `)

  const indexSpecs = [
    ['city_roads', 'geom'], ['city_buildings', 'geom'], ['city_facilities', 'geom'], ['city_green_blue', 'geom'], ['city_places', 'geom'], ['city_objects', 'geom'],
  ]
  for (const [tableName, columnName] of indexSpecs) {
    await client.query(`CREATE INDEX IF NOT EXISTS ${rawSchema}_${tableName}_${columnName}_gix ON ${rawSchema}.${tableName} USING gist (${columnName})`)
  }
  await client.query(`CREATE INDEX IF NOT EXISTS ${rawSchema}_city_objects_layer_idx ON ${rawSchema}.city_objects (layer_key)`)
  await client.query(`CREATE INDEX IF NOT EXISTS ${rawSchema}_city_objects_category_idx ON ${rawSchema}.city_objects (category)`)
}

async function ensureRawOsmPbfExtract({ cityId, rawSchema, sourceSlug, sourceUrl, sourcePath }) {
  assertIdentifier(rawSchema, 'raw_schema')
  const pool = createPool()
  const client = await pool.connect()
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${rawSchema}`)
    if (await rawSchemaReady(client, rawSchema)) return { created: false, rawSchema }
    if (!sourcePath || !existsSync(sourcePath)) {
      throw new Error(`OSM_LOCAL_EXTRACT_SOURCE_FILE_MISSING:${sourcePath || 'none'}`)
    }
    const bbox = await cityBbox(client, cityId)
    await importOsmPbfBronze({ rawSchema, sourcePath, bbox })
    await normalizeOsmPbfSilver(client, { cityId, rawSchema, sourceSlug, sourcePath, sourceUrl })
    return { created: true, rawSchema, bbox }
  } finally {
    client.release()
    await pool.end()
  }
}

export async function ingestOsmLocalExtractLayer(cityConfig, layerKey, body = {}) {
  const existingJobId = compact(body.existingJobId ?? body.existing_job_id)
  if (!existingJobId) throw new Error('INGESTION_JOB_ID_REQUIRED_FOR_OSM_LOCAL_EXTRACT')

  const cityId = compact(cityConfig?.id, compact(body.cityId ?? body.city_id, 'kharkiv'))
  const rawSchema = compact(
    body.rawSchema ?? body.raw_schema ?? body.metadata?.rawSchema ?? body.metadata?.raw_schema,
    defaultRawSchema(cityId),
  )
  const sourceUri = compact(body.sourceUri ?? body.source_uri)
  const sourceSlug = compact(body.sourceSlug ?? body.source_slug ?? body.metadata?.sourceSlug ?? body.metadata?.source_slug, defaultSourceSlug(cityId))
  const sourceUrl = compact(body.sourceUrl ?? body.source_url ?? body.metadata?.sourceUrl ?? body.metadata?.source_url, sourceUri || undefined)
  const sourcePath = compact(body.sourcePath ?? body.source_path ?? body.metadata?.sourcePath ?? body.metadata?.source_path, sourceUri.startsWith('file://') ? sourceUri.slice('file://'.length) : undefined)
  const workerId = compact(body.workerId ?? body.worker_id, 'provider-worker')

  const running = await markLayerIngestionJobRunning(existingJobId, {
    workerId,
    stats: { action: 'osm-local-extract', layerKey, rawSchema },
    metadata: { osmLocalExtract: { rawSchema, sourceSlug, sourceUri: sourceUri || null } },
  })
  if (!running.ok) return running

  const rawExtract = await ensureRawOsmPbfExtract({
    cityId,
    rawSchema,
    sourceSlug,
    sourceUrl,
    sourcePath,
  })
  const promotion = await promoteRawOsmPbfExtract({
    cityId,
    rawSchema,
    sourceSlug,
    sourceUrl,
    sourcePath,
  })
  const featureCount = Object.values(promotion.counts ?? {}).reduce((sum, value) => sum + Number(value || 0), 0)
  const stats = {
    action: 'osm-local-extract',
    layerKey,
    rawSchema,
    source: promotion.source,
    promotedFeatureCount: featureCount,
    promotedLayers: promotion.counts ?? {},
    rawExtractCreated: rawExtract.created === true,
    rawExtractBbox: rawExtract.bbox ?? null,
  }

  await completeLayerIngestionJob(existingJobId, {
    stats,
    validationSummary: {
      state: 'completed',
      action: 'osm-local-extract',
      sourceFormat: 'raw-osm-pbf',
      sourceState: 'executed',
      canQueue: true,
      promotedFeatureCount: featureCount,
      promotedLayers: promotion.counts ?? {},
    },
    metadata: {
      osmLocalExtract: {
        rawSchema,
        sourceSlug,
        sourceUri: sourceUri || null,
        sourceUrl: sourceUrl || null,
        sourcePath: sourcePath || null,
        promotedAt: new Date().toISOString(),
      },
    },
  })
  await addLayerIngestionValidationReport(existingJobId, [{
    severity: 'info',
    code: 'OSM_LOCAL_EXTRACT_PROMOTED',
    message: `${featureCount} OSM local extract features promoted into LDT provenance/catalog records.`,
    payload: stats,
  }])

  return {
    configured: true,
    ok: true,
    cityId,
    layerKey,
    jobId: existingJobId,
    action: 'osm-local-extract',
    stats,
  }
}
