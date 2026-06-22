import { getProductionPool } from '../postgisPool.mjs'
import {
  ingestFeatureCollection,
  replaceCityFeatureLayers,
} from './featureWriteRepository.mjs'

const OPEN_DATA_PROVIDER_ID = 'open-data-base'
const BASE_LAYER_DEFINITIONS = [
  {
    key: 'boundary',
    name: 'Boundary',
    layerFamily: 'territory',
    geometryType: 'MultiPolygon',
    sourceLicense: 'OpenStreetMap/Nominatim derived open data',
  },
  {
    key: 'roads',
    name: 'Roads',
    layerFamily: 'mobility',
    geometryType: 'LineString',
    sourceLicense: 'OpenStreetMap contributors',
  },
  {
    key: 'buildings',
    name: 'Buildings',
    layerFamily: 'built-fabric',
    geometryType: 'Polygon',
    sourceLicense: 'OpenStreetMap contributors',
  },
  {
    key: 'facilities',
    name: 'Facilities',
    layerFamily: 'public-services',
    geometryType: 'Point',
    sourceLicense: 'OpenStreetMap contributors',
  },
  {
    key: 'greenBlue',
    name: 'Green-blue systems',
    layerFamily: 'environment',
    geometryType: 'Geometry',
    sourceLicense: 'OpenStreetMap contributors',
  },
  {
    key: 'places',
    name: 'Settlements and places',
    layerFamily: 'territory',
    geometryType: 'Point',
    sourceLicense: 'OpenStreetMap contributors',
  },
  {
    key: 'center',
    name: 'City anchor',
    layerFamily: 'reference',
    geometryType: 'Point',
    sourceLicense: 'Twin Base Studio generated reference',
  },
]

function json(value) {
  return JSON.stringify(value ?? null)
}








function boundaryGeometryAsMultiPolygon(boundary) {
  const geometry = boundary?.features?.[0]?.geometry
  if (!geometry) return null
  if (geometry.type === 'Polygon') {
    return {
      type: 'MultiPolygon',
      coordinates: [geometry.coordinates],
    }
  }
  if (geometry.type === 'MultiPolygon') return geometry
  return null
}

async function upsertProvider(client) {
  await client.query(
    `
      INSERT INTO providers (id, name, provider_type, website_url, metadata, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET
        name = excluded.name,
        provider_type = excluded.provider_type,
        website_url = excluded.website_url,
        metadata = excluded.metadata,
        updated_at = now()
    `,
    [
      OPEN_DATA_PROVIDER_ID,
      'Open data base twin',
      'open-data-aggregator',
      'https://www.openstreetmap.org',
      json({
        sources: ['OpenStreetMap/Overpass', 'Nominatim', 'Wikipedia REST'],
        role: 'Base twin ingestion provider for city starter layers.',
      }),
    ],
  )
}

async function upsertCity(client, payload) {
  const city = payload.city
  const center = payload.center ?? { lat: city.lat, lon: city.lon }
  await client.query(
    `
      INSERT INTO cities (
        id, name, country, country_code, region, centroid, enabled, metadata, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        ST_SetSRID(ST_MakePoint($6, $7), 4326),
        $8, $9::jsonb, now()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = excluded.name,
        country = excluded.country,
        country_code = excluded.country_code,
        region = excluded.region,
        centroid = excluded.centroid,
        enabled = excluded.enabled,
        metadata = excluded.metadata,
        updated_at = now()
    `,
    [
      city.id,
      city.name,
      city.country ?? '',
      city.countryCode ?? '',
      city.region ?? '',
      Number(center.lon ?? city.lon),
      Number(center.lat ?? city.lat),
      city.enabled !== false,
      json({
        twinLabel: city.twinLabel,
        nominatimQuery: city.nominatimQuery,
        wikipediaTownPage: city.wikipediaTownPage,
        wikipediaMunicipalityPage: city.wikipediaMunicipalityPage,
        reference: payload.reference ?? null,
        sourcePayloadVersion: payload.version ?? null,
      }),
    ],
  )
}


async function upsertLayerDefinitions(client, cityId, inventory) {
  const layerRows = new Map()
  const inventoryByKey = new Map(
    (inventory?.layerDefinitions ?? []).map((definition) => [definition.key, definition]),
  )

  for (const definition of BASE_LAYER_DEFINITIONS) {
    const inventoryDefinition = inventoryByKey.get(definition.key) ?? {}
    const result = await client.query(
      `
        INSERT INTO layer_definitions (
          city_id, provider_id, key, name, layer_family, geometry_type,
          authority_status, access_level, source_license, update_frequency,
          semantic_status, metadata, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'open-data', 'public-open-data', $7, $8, $9, $10::jsonb, now())
        ON CONFLICT (city_id, key) DO UPDATE SET
          provider_id = excluded.provider_id,
          name = excluded.name,
          layer_family = excluded.layer_family,
          geometry_type = excluded.geometry_type,
          authority_status = excluded.authority_status,
          access_level = excluded.access_level,
          source_license = excluded.source_license,
          update_frequency = excluded.update_frequency,
          semantic_status = excluded.semantic_status,
          metadata = excluded.metadata,
          updated_at = now()
        RETURNING id
      `,
      [
        cityId,
        OPEN_DATA_PROVIDER_ID,
        definition.key,
        definition.name,
        definition.layerFamily,
        definition.geometryType,
        definition.sourceLicense,
        'on-refresh',
        inventoryDefinition.twinCategoryKey === 'semanticSeed' ? 'inferred-seed' : 'base',
        json({
          ...inventoryDefinition,
          productiveRole: 'canonical-base-layer',
        }),
      ],
    )
    layerRows.set(definition.key, result.rows[0].id)
  }
  return layerRows
}

async function createIngestionRun(client, payload, stats) {
  const result = await client.query(
    `
      INSERT INTO ingestion_runs (
        city_id, provider_id, source_name, source_url, run_type, status,
        started_at, finished_at, stats, metadata
      )
      VALUES ($1, $2, $3, $4, $5, 'running', now(), null, $6::jsonb, $7::jsonb)
      RETURNING id
    `,
    [
      payload.city.id,
      OPEN_DATA_PROVIDER_ID,
      'base-twin-open-data',
      'https://overpass-api.de/api/interpreter',
      'base-twin-refresh',
      json(stats),
      json({
        fetchedAt: payload.fetchedAt ?? null,
        payloadVersion: payload.version ?? null,
        extraction: payload.extraction ?? null,
      }),
    ],
  )
  return result.rows[0].id
}

async function insertSourceArtifacts(client, payload, runId) {
  const artifacts = Array.isArray(payload.sourceArtifacts) ? payload.sourceArtifacts : []
  let count = 0

  for (const artifact of artifacts) {
    await client.query(
      `
        INSERT INTO source_artifacts (
          ingestion_run_id, city_id, provider_id, source_name, source_url,
          source_kind, fetched_at, payload, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
      `,
      [
        runId,
        payload.city.id,
        OPEN_DATA_PROVIDER_ID,
        artifact.sourceName ?? 'unknown-source',
        artifact.sourceUrl ?? null,
        artifact.sourceKind ?? 'raw-response',
        artifact.fetchedAt ?? payload.fetchedAt ?? new Date().toISOString(),
        json(artifact.payload ?? null),
        json(artifact.metadata ?? {}),
      ],
    )
    count += 1
  }

  return count
}

async function replaceBoundary(client, payload) {
  const boundaryGeometry = boundaryGeometryAsMultiPolygon(payload.layers?.boundary)
  if (!boundaryGeometry) return 0

  await client.query('DELETE FROM city_boundaries WHERE city_id = $1 AND source = $2', [
    payload.city.id,
    'nominatim-open-data',
  ])
  await client.query(
    `
      INSERT INTO city_boundaries (city_id, source, authority_status, geom, properties)
      VALUES ($1, $2, 'open-data', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)), $4::jsonb)
    `,
    [
      payload.city.id,
      'nominatim-open-data',
      json(boundaryGeometry),
      json(payload.layers?.boundary?.features?.[0]?.properties ?? {}),
    ],
  )
  return 1
}


async function finishIngestionRun(client, runId, status, stats, errorMessage = null) {
  await client.query(
    `
      UPDATE ingestion_runs
      SET status = $2, finished_at = now(), stats = $3::jsonb, error_message = $4
      WHERE id = $1
    `,
    [runId, status, json(stats), errorMessage],
  )
}

export async function ingestBaseTwinPayload(payload, { strict = true } = {}) {
  const pool = getProductionPool()
  if (!pool) {
    const result = {
      configured: false,
      ok: true,
      skipped: true,
      reason: 'production_database_not_configured',
    }
    if (strict) return result
    return result
  }

  const client = await pool.connect()
  let runId = null
  const stats = {
    cityId: payload?.city?.id ?? null,
    features: {},
    boundaries: 0,
  }

  try {
    await client.query('BEGIN')
    await upsertProvider(client)
    await upsertCity(client, payload)
    const layerIds = await upsertLayerDefinitions(client, payload.city.id, payload.inventory)
    runId = await createIngestionRun(client, payload, stats)
    stats.sourceArtifacts = await insertSourceArtifacts(client, payload, runId)
    stats.boundaries = await replaceBoundary(client, payload)

    const layerCollections = [
      ['roads', payload.layers?.roads],
      ['buildings', payload.layers?.buildings],
      ['facilities', payload.layers?.facilities],
      ['greenBlue', payload.layers?.greenBlue],
      ['places', payload.layers?.places],
      ['center', payload.layers?.center],
    ]
    await replaceCityFeatureLayers(
      client,
      payload.city.id,
      layerCollections.map(([layerKey]) => layerKey),
    )

    for (const [layerKey, collection] of layerCollections) {
      stats.features[layerKey] = await ingestFeatureCollection(client, {
        payload,
        runId,
        layerIds,
        layerKey,
        collection,
      })
    }

    await finishIngestionRun(client, runId, 'completed', stats)

    await client.query('COMMIT')
    return {
      configured: true,
      ok: true,
      runId,
      stats,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    if (runId) {
      try {
        await finishIngestionRun(client, runId, 'failed', stats, String(error?.message ?? 'UNKNOWN_ERROR'))
      } catch {
        // The transaction rollback may also remove the run row; the thrown error below is enough.
      }
    }
    if (!strict) {
      return {
        configured: true,
        ok: false,
        runId,
        stats,
        error: String(error?.message ?? 'UNKNOWN_INGESTION_ERROR'),
      }
    }
    throw error
  } finally {
    client.release()
  }
}

export async function mirrorBaseTwinPayloadToProductionStore(payload) {
  try {
    return await ingestBaseTwinPayload(payload, { strict: false })
  } catch (error) {
    return {
      configured: true,
      ok: false,
      error: String(error?.message ?? 'UNKNOWN_INGESTION_ERROR'),
    }
  }
}
