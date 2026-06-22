import pg from 'pg'
import { getProductionDatabaseUrl } from './migrate.mjs'

const { Pool } = pg

const DEFAULT_CITY_ID = 'kharkiv'
const DEFAULT_RAW_SCHEMA = 'raw_osm_kharkiv'
const DEFAULT_SOURCE_SLUG = 'geofabrik-ukraine-osm-pbf'
const DEFAULT_SOURCE_URL = 'https://download.geofabrik.de/europe/ukraine-latest.osm.pbf'
const DEFAULT_LOCAL_SOURCE_PATH = '/app/runtime-data/extracts/kharkiv/ukraine-latest.osm.pbf'

const LAYERS = [
  {
    key: 'roads',
    table: 'city_roads',
    label: 'roads',
    description: 'Road, path, and pedestrian network promoted from the local OSM PBF snapshot.',
    propertySql: `
      jsonb_strip_nulls(jsonb_build_object(
        'id', source_id,
        'osm_id', osm_id,
        'label', label,
        'name', label,
        'source', 'OpenStreetMap',
        'source_slug', $3::text,
        'source_license', 'ODbL-1.0',
        'source_layer', $2::text,
        'category', road_class,
        'highway', road_class,
        'surface', surface,
        'maxspeed', maxspeed,
        'lanes', lanes,
        'oneway', oneway
      ) || COALESCE(hstore_to_jsonb(properties), '{}'::jsonb))
    `,
  },
  {
    key: 'buildings',
    table: 'city_buildings',
    label: 'buildings',
    description: 'Building footprints promoted from the local OSM PBF snapshot.',
    propertySql: `
      jsonb_strip_nulls(jsonb_build_object(
        'id', source_id,
        'osm_id', osm_id,
        'label', label,
        'name', label,
        'source', 'OpenStreetMap',
        'source_slug', $3::text,
        'source_license', 'ODbL-1.0',
        'source_layer', $2::text,
        'category', building_type,
        'building', building_type,
        'levels', levels,
        'height', height_m,
        'footprint_area_m2', footprint_area_m2
      ) || COALESCE(hstore_to_jsonb(properties), '{}'::jsonb))
    `,
  },
  {
    key: 'facilities',
    table: 'city_facilities',
    label: 'facilities',
    description: 'Amenities, shops, tourism objects, stops, and civic facilities promoted from the local OSM PBF snapshot.',
    propertySql: `
      jsonb_strip_nulls(jsonb_build_object(
        'id', source_id,
        'osm_id', osm_id,
        'label', label,
        'name', label,
        'source', 'OpenStreetMap',
        'source_slug', $3::text,
        'source_license', 'ODbL-1.0',
        'source_layer', $2::text,
        'category', category,
        'kind', category,
        'amenity', amenity,
        'shop', shop,
        'tourism', tourism,
        'public_transport', public_transport,
        'man_made', man_made
      ) || COALESCE(hstore_to_jsonb(properties), '{}'::jsonb))
    `,
  },
  {
    key: 'greenBlue',
    table: 'city_green_blue',
    label: 'green-blue systems',
    description: 'Parks, vegetation, water, leisure areas, and related green-blue systems promoted from the local OSM PBF snapshot.',
    propertySql: `
      jsonb_strip_nulls(jsonb_build_object(
        'id', source_id,
        'osm_id', osm_id,
        'label', label,
        'name', label,
        'source', 'OpenStreetMap',
        'source_slug', $3::text,
        'source_license', 'ODbL-1.0',
        'source_layer', $2::text,
        'category', category,
        'kind', category,
        'landuse', landuse,
        'natural', "natural",
        'leisure', leisure,
        'waterway', waterway,
        'area_m2', area_m2
      ) || COALESCE(hstore_to_jsonb(properties), '{}'::jsonb))
    `,
  },
  {
    key: 'places',
    table: 'city_places',
    label: 'places',
    description: 'Named places and neighborhood labels promoted from the local OSM PBF snapshot.',
    propertySql: `
      jsonb_strip_nulls(jsonb_build_object(
        'id', source_id,
        'osm_id', osm_id,
        'label', label,
        'name', label,
        'source', 'OpenStreetMap',
        'source_slug', $3::text,
        'source_license', 'ODbL-1.0',
        'source_layer', $2::text,
        'category', place_type,
        'place', place_type,
        'population', population
      ) || COALESCE(hstore_to_jsonb(properties), '{}'::jsonb))
    `,
  },
]

function parseArgs() {
  const value = (name, fallback) => {
    const arg = process.argv.find((entry) => entry.startsWith(`--${name}=`))
    return arg ? arg.slice(name.length + 3).trim() : fallback
  }
  return {
    cityId: value('city', DEFAULT_CITY_ID),
    rawSchema: value('schema', DEFAULT_RAW_SCHEMA),
    sourceSlug: value('source-slug', DEFAULT_SOURCE_SLUG),
    sourceUrl: value('source-url', DEFAULT_SOURCE_URL),
    sourcePath: value('source-path', DEFAULT_LOCAL_SOURCE_PATH),
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

function assertIdentifier(value, label) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`INVALID_${label.toUpperCase()}:${value}`)
  }
}

function datasetIdentifier(cityId, layerKey) {
  return `tbs:open-data:${cityId}:${layerKey}`
}

function cityDisplayName(cityRow, cityId) {
  return cityRow?.name || cityId
}

function layerTitle(cityName, layer) {
  return `${cityName} OSM PBF ${layer.label ?? layer.key}`
}

function layerDescription(cityName, layer) {
  return `${layer.description} City: ${cityName}.`
}

async function ensureActivity(client, cityId, options) {
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
        'raw-osm-pbf-promotion',
        'completed',
        'twin-base-studio-local',
        $2::jsonb,
        now()
      )
      RETURNING id
    `,
    [
      cityId,
      JSON.stringify({
        source: options.sourceSlug,
        sourceUrl: options.sourceUrl,
        sourcePath: options.sourcePath,
        rawSchema: options.rawSchema,
        stage: 'silver-to-provenance',
      }),
    ],
  )
  return result.rows[0].id
}

async function ensureDataset(client, cityId, cityName, layer, options) {
  const identifier = datasetIdentifier(cityId, layer.key)
  const result = await client.query(
    `
      INSERT INTO ldt_catalog.datasets (
        city_id,
        identifier,
        title,
        description,
        publisher,
        license,
        access_rights,
        update_frequency,
        metadata
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'OpenStreetMap contributors / Geofabrik',
        'Open Database License 1.0',
        'public',
        'snapshot',
        $5::jsonb
      )
      ON CONFLICT (identifier) DO UPDATE SET
        city_id = EXCLUDED.city_id,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        publisher = EXCLUDED.publisher,
        license = EXCLUDED.license,
        access_rights = EXCLUDED.access_rights,
        update_frequency = EXCLUDED.update_frequency,
        metadata = ldt_catalog.datasets.metadata || EXCLUDED.metadata,
        updated_at = now()
      RETURNING id
    `,
    [
      cityId,
      identifier,
      layerTitle(cityName, layer),
      layerDescription(cityName, layer),
      JSON.stringify({
        phase: 'raw-osm-pbf-promotion',
        source: options.sourceSlug,
        sourceUrl: options.sourceUrl,
        sourcePath: options.sourcePath,
        rawSchema: options.rawSchema,
        layerKey: layer.key,
      }),
    ],
  )
  const datasetId = result.rows[0].id

  await client.query(
    `
      INSERT INTO ldt_catalog.dataset_licenses (
        dataset_id,
        license_name,
        spdx_id,
        license_url,
        attribution_required,
        share_alike_required,
        commercial_use_allowed,
        obligations
      )
      VALUES (
        $1,
        'Open Database License 1.0',
        'ODbL-1.0',
        'https://opendatacommons.org/licenses/odbl/1-0/',
        true,
        true,
        true,
        $2::jsonb
      )
      ON CONFLICT (dataset_id, license_name) DO UPDATE SET
        spdx_id = EXCLUDED.spdx_id,
        license_url = EXCLUDED.license_url,
        attribution_required = EXCLUDED.attribution_required,
        share_alike_required = EXCLUDED.share_alike_required,
        commercial_use_allowed = EXCLUDED.commercial_use_allowed,
        obligations = EXCLUDED.obligations
    `,
    [
      datasetId,
      JSON.stringify({
        attribution: 'Use OpenStreetMap contributor attribution in exports and public surfaces.',
        source: `OpenStreetMap contributors via ${options.sourceSlug}.`,
        shareAlike: 'ODbL share-alike obligations may apply to derivative databases.',
      }),
    ],
  )

  await client.query(
    `
      DELETE FROM ldt_catalog.dataset_distributions
      WHERE dataset_id = $1
        AND metadata->>'phase' = 'raw-osm-pbf-promotion'
    `,
    [datasetId],
  )
  await client.query(
    `
      INSERT INTO ldt_catalog.dataset_distributions (
        dataset_id,
        title,
        format,
        media_type,
        access_url,
        download_url,
        metadata
      )
      VALUES (
        $1,
        $2,
        'postgis-normalized-osm-pbf',
        'application/vnd.postgresql',
        $3,
        $4,
        $5::jsonb
      )
    `,
    [
      datasetId,
      `${layerTitle(options.cityName, layer)} normalized tables`,
      `postgis://${options.rawSchema}/${layer.table}`,
      options.sourceUrl,
      JSON.stringify({
        phase: 'raw-osm-pbf-promotion',
        sourcePath: options.sourcePath,
        normalizedTable: `${options.rawSchema}.${layer.table}`,
      }),
    ],
  )

  return datasetId
}

async function resetLayerQuality(client, datasetId) {
  await client.query(
    `
      DELETE FROM ldt_catalog.dataset_quality_reports
      WHERE dataset_id = $1
        AND quality_dimension = 'raw-osm-pbf-coverage'
    `,
    [datasetId],
  )
  await client.query(
    `
      DELETE FROM ldt_catalog.dataset_spatial_extents
      WHERE dataset_id = $1
        AND extent_role = 'raw-osm-pbf-source-feature-envelope'
    `,
    [datasetId],
  )
}

async function promoteLayer(client, cityId, layer, datasetId, activityId, options) {
  const tableRef = `${options.rawSchema}.${layer.table}`
  await client.query(
    `
      DELETE FROM ldt_prov.source_features
      WHERE city_id = $1
        AND dataset_id = $2::uuid
        AND source_layer = $3
        AND source_feature_id LIKE $4
    `,
    [cityId, datasetId, layer.key, `raw-osm-pbf:${layer.key}:%`],
  )

  const insertSql = `
      INSERT INTO ldt_prov.source_features (
        city_id,
        dataset_id,
        activity_id,
        source_feature_id,
        source_layer,
        source_type,
        geom,
        payload
      )
      SELECT
        city_id,
        $1::uuid,
        $4::uuid,
        'raw-osm-pbf:' || $2::text || ':' || source_id,
        $2::text,
        'open-data',
        CASE
          WHEN GeometryType(geom) IN ('POLYGON', 'MULTIPOLYGON') THEN ST_MakeValid(geom)
          ELSE geom
        END,
        jsonb_build_object(
          'source', $3::text,
          'sourceUrl', $5::text,
          'sourcePath', $6::text,
          'rawSchema', $7::text,
          'rawTable', $8::text,
          'promotedAt', now(),
          'payload', jsonb_build_object(
            'type', 'Feature',
            'properties', ${layer.propertySql}
          )
        )
      FROM ${tableRef}
      WHERE city_id = $9
        AND geom IS NOT NULL
        AND NOT ST_IsEmpty(geom)
      ON CONFLICT (city_id, dataset_id, source_feature_id) DO UPDATE SET
        activity_id = EXCLUDED.activity_id,
        source_type = EXCLUDED.source_type,
        geom = EXCLUDED.geom,
        payload = EXCLUDED.payload
    `
  const result = await client.query(
    insertSql,
    [
      datasetId,
      layer.key,
      options.sourceSlug,
      activityId,
      options.sourceUrl,
      options.sourcePath,
      options.rawSchema,
      layer.table,
      cityId,
    ],
  )

  await client.query(
    `
      INSERT INTO ldt_catalog.dataset_quality_reports (
        dataset_id,
        quality_dimension,
        score,
        statement,
        metadata
      )
      VALUES (
        $1,
        'raw-osm-pbf-coverage',
        CASE WHEN $2::int > 0 THEN 1 ELSE 0 END,
        $3,
        $4::jsonb
      )
    `,
    [
      datasetId,
      result.rowCount,
      `${result.rowCount} ${layer.key} features promoted from the normalized ${options.cityName} OSM PBF snapshot.`,
      JSON.stringify({
        phase: 'raw-osm-pbf-promotion',
        source: options.sourceSlug,
        sourceUrl: options.sourceUrl,
        rawTable: tableRef,
        sourceFeatureCount: result.rowCount,
      }),
    ],
  )

  await client.query(
    `
      INSERT INTO ldt_catalog.dataset_spatial_extents (
        dataset_id,
        extent_role,
        geom,
        bbox
      )
      SELECT
        $1::uuid,
        'raw-osm-pbf-source-feature-envelope',
        ST_Envelope(ST_Collect(geom))::geometry(Geometry, 4326),
        jsonb_build_object(
          'source', 'computed-from-ldt-provenance',
          'cityId', $2::text,
          'layerKey', $3::text,
          'sourceSlug', $4::text
        )
      FROM ldt_prov.source_features
      WHERE city_id = $2
        AND dataset_id = $1::uuid
        AND source_layer = $3
        AND source_feature_id LIKE $5
      HAVING COUNT(*) > 0
    `,
    [datasetId, cityId, layer.key, options.sourceSlug, `raw-osm-pbf:${layer.key}:%`],
  )

  return result.rowCount
}

export async function promoteRawOsmPbfExtract(optionsInput = {}) {
  const parsed = parseArgs()
  const options = { ...parsed, ...(optionsInput ?? {}) }
  assertIdentifier(options.rawSchema, 'raw_schema')
  for (const layer of LAYERS) assertIdentifier(layer.table, 'raw_table')

  const pool = createPool()
  const client = await pool.connect()
  const counts = {}

  try {
    await client.query('BEGIN')
    const city = await client.query('SELECT id, name FROM ldt_core.cities WHERE id = $1', [options.cityId])
    if (city.rowCount === 0) throw new Error(`CITY_NOT_FOUND_IN_LDT_CORE:${options.cityId}`)
    options.cityName = cityDisplayName(city.rows[0], options.cityId)

    const activityId = await ensureActivity(client, options.cityId, options)
    for (const layer of LAYERS) {
      const datasetId = await ensureDataset(client, options.cityId, options.cityName, layer, options)
      await resetLayerQuality(client, datasetId)
      counts[layer.key] = await promoteLayer(client, options.cityId, layer, datasetId, activityId, options)
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }

  return {
    ok: true,
    cityId: options.cityId,
    rawSchema: options.rawSchema,
    source: options.sourceSlug,
    counts,
  }
}

async function runCli() {
  const result = await promoteRawOsmPbfExtract()
  console.log(JSON.stringify(result, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('[ldt-promote-raw-osm-pbf] failed:', error)
    process.exitCode = 1
  })
}
