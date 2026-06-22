import pg from 'pg'
import { getProductionDatabaseUrl } from './migrate.mjs'

const { Pool } = pg

const DEFAULT_CITY_IDS = ['adazi', 'kharkiv']
const OPEN_LAYER_KEYS = new Set([
  'boundary',
  'roads',
  'buildings',
  'facilities',
  'greenBlue',
  'places',
  'center',
  'overture-buildings',
])
const DERIVED_LAYER_KEYS = new Set([
  'buildingCandidateNew',
  'buildingCandidateMatched',
])
const OPEN_ARTIFACT_KIND_PREFIXES = [
  'city-boundary-search',
  'overpass-',
  'provider-overture-buildings',
  'provider-overture-roads',
  'wikipedia-',
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

function licenseMetadata(license = '') {
  const value = String(license ?? '').toLowerCase()
  if (value.includes('odbl') || value.includes('openstreetmap') || value.includes('overture')) {
    return {
      licenseName: value.includes('overture') ? 'Overture Maps open data license' : 'Open Database License 1.0 / OSM-derived attribution',
      spdxId: value.includes('odbl') || value.includes('openstreetmap') ? 'ODbL-1.0' : null,
      attributionRequired: true,
      shareAlikeRequired: value.includes('openstreetmap') || value.includes('odbl'),
      commercialUseAllowed: true,
    }
  }
  return {
    licenseName: license || 'Open data license not normalized yet',
    spdxId: null,
    attributionRequired: true,
    shareAlikeRequired: false,
    commercialUseAllowed: null,
  }
}

function datasetIdentifier(cityId, layerKey) {
  return `tbs:open-data:${cityId}:${layerKey}`
}

function artifactDatasetIdentifier(cityId, sourceKind) {
  return `tbs:open-artifact:${cityId}:${sourceKind}`
}

function isOpenArtifactKind(sourceKind) {
  return OPEN_ARTIFACT_KIND_PREFIXES.some((prefix) => String(sourceKind ?? '').startsWith(prefix))
}

async function listCityIds(client, requestedCityIds) {
  if (requestedCityIds.length > 0) return requestedCityIds
  const result = await client.query('SELECT id FROM public.cities WHERE enabled = true ORDER BY id')
  return result.rows.map((row) => row.id)
}

async function ensureCity(client, cityId) {
  const result = await client.query(
    `
      INSERT INTO ldt_core.cities (
        id,
        name,
        country,
        country_code,
        region,
        centroid,
        canonical_uri,
        source_city_id,
        metadata
      )
      SELECT
        id,
        name,
        country,
        country_code,
        region,
        centroid,
        $2,
        id,
        jsonb_build_object(
          'phase', 'phase-2-source-native-reingest',
          'legacyRuntimeSource', 'public.cities'
        ) || COALESCE(metadata, '{}'::jsonb)
      FROM public.cities
      WHERE id = $1
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        country = EXCLUDED.country,
        country_code = EXCLUDED.country_code,
        region = EXCLUDED.region,
        centroid = EXCLUDED.centroid,
        canonical_uri = EXCLUDED.canonical_uri,
        source_city_id = EXCLUDED.source_city_id,
        metadata = ldt_core.cities.metadata || EXCLUDED.metadata,
        updated_at = now()
      RETURNING id, name
    `,
    [cityId, `urn:polisplexity:ldt:city:${cityId}`],
  )
  if (result.rowCount === 0) throw new Error(`CITY_NOT_FOUND:${cityId}`)

  await client.query(
    `
      DELETE FROM ldt_core.city_boundaries
      WHERE city_id = $1
        AND properties->>'migrationSource' = 'public.city_boundaries'
    `,
    [cityId],
  )

  await client.query(
    `
      INSERT INTO ldt_core.city_boundaries (
        city_id,
        boundary_role,
        authority_status,
        valid_from,
        geom,
        properties
      )
      SELECT
        city_id,
        'administrative',
        authority_status,
        valid_from,
        geom,
        COALESCE(properties, '{}'::jsonb) || jsonb_build_object(
          'source', source,
          'migrationSource', 'public.city_boundaries'
        )
      FROM public.city_boundaries
      WHERE city_id = $1
    `,
    [cityId],
  )

  return result.rows[0]
}

async function openLayerDefinitions(client, cityId) {
  const result = await client.query(
    `
      SELECT
        id,
        key,
        name,
        layer_family,
        geometry_type,
        authority_status,
        access_level,
        source_license,
        update_frequency,
        semantic_status,
        metadata
      FROM public.layer_definitions
      WHERE city_id = $1
      ORDER BY key
    `,
    [cityId],
  )
  return result.rows.filter((layer) => OPEN_LAYER_KEYS.has(layer.key) && !DERIVED_LAYER_KEYS.has(layer.key))
}

async function ensureDataset(client, cityId, layer) {
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
        $5,
        $6,
        $7,
        $8,
        $9::jsonb
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
      `${layer.name} source dataset`,
      `Open/base source layer reingested from the current Twin Base Studio runtime layer "${layer.key}".`,
      layer.key === 'overture-buildings' ? 'Overture Maps Foundation / runtime connector' : 'OpenStreetMap contributors / Twin Base Studio runtime',
      layer.source_license || (layer.key === 'overture-buildings' ? 'ODbL' : 'Open data'),
      layer.access_level === 'public' ? 'public' : 'city-private',
      layer.update_frequency,
      JSON.stringify({
        phase: 'phase-2-source-native-reingest',
        legacyLayerId: layer.id,
        legacyLayerKey: layer.key,
        layerFamily: layer.layer_family,
        geometryType: layer.geometry_type,
        semanticStatus: layer.semantic_status,
        authorityStatus: layer.authority_status,
        legacyMetadata: layer.metadata ?? {},
      }),
    ],
  )

  await client.query(
    `
      DELETE FROM ldt_catalog.dataset_distributions
      WHERE dataset_id = $1
        AND metadata->>'phase' = 'phase-2-source-native-reingest'
    `,
    [result.rows[0].id],
  )
  await client.query(
    `
      DELETE FROM ldt_catalog.dataset_quality_reports
      WHERE dataset_id = $1
        AND quality_dimension = 'phase-2-source-native-coverage'
    `,
    [result.rows[0].id],
  )
  await client.query(
    `
      DELETE FROM ldt_catalog.dataset_spatial_extents
      WHERE dataset_id = $1
        AND extent_role = 'source-feature-envelope'
    `,
    [result.rows[0].id],
  )

  const license = licenseMetadata(layer.source_license)
  await client.query(
    `
      INSERT INTO ldt_catalog.dataset_licenses (
        dataset_id,
        license_name,
        spdx_id,
        attribution_required,
        share_alike_required,
        commercial_use_allowed,
        obligations
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (dataset_id, license_name) DO UPDATE SET
        spdx_id = EXCLUDED.spdx_id,
        attribution_required = EXCLUDED.attribution_required,
        share_alike_required = EXCLUDED.share_alike_required,
        commercial_use_allowed = EXCLUDED.commercial_use_allowed,
        obligations = EXCLUDED.obligations
    `,
    [
      result.rows[0].id,
      license.licenseName,
      license.spdxId,
      license.attributionRequired,
      license.shareAlikeRequired,
      license.commercialUseAllowed,
      JSON.stringify({
        sourceLicenseText: layer.source_license ?? null,
        attribution: 'Preserve source attribution in exports and reports.',
      }),
    ],
  )

  await client.query(
    `
      INSERT INTO ldt_catalog.dataset_distributions (
        dataset_id,
        title,
        format,
        media_type,
        access_url,
        metadata
      )
      VALUES (
        $1,
        $2,
        'postgis-legacy-runtime',
        'application/vnd.postgresql',
        $3,
        $4::jsonb
      )
    `,
    [
      result.rows[0].id,
      `${layer.name} legacy runtime source`,
      `legacy://public/source_features_raw/${cityId}/${layer.key}`,
      JSON.stringify({
        phase: 'phase-2-source-native-reingest',
        note: 'Distribution points to the current local runtime source used for this migration step.',
      }),
    ],
  )

  return result.rows[0].id
}

async function ensureActivity(client, cityId, layerKey) {
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
        'phase-2-source-native-reingest',
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
        layerKey,
        source: 'legacy runtime tables',
      }),
    ],
  )
  return result.rows[0].id
}

async function copySourceFeaturesRaw(client, cityId, layer, datasetId, activityId) {
  const result = await client.query(
    `
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
        sfr.city_id,
        $3::uuid,
        $4::uuid,
        'legacy-raw:' || sfr.id::text,
        sfr.source_layer,
        CASE
          WHEN sfr.source_layer = 'overture-buildings'
            OR sfr.payload->'properties'->>'source' = 'Overture Maps Transportation'
          THEN 'open-provider'
          ELSE 'open-data'
        END,
        sfr.geom,
        jsonb_build_object(
          'legacySourceFeatureId', sfr.source_feature_id,
          'legacyRawId', sfr.id,
          'legacyIngestionRunId', sfr.ingestion_run_id,
          'geometryType', sfr.geometry_type,
          'payload', sfr.payload
        )
      FROM public.source_features_raw sfr
      WHERE sfr.city_id = $1
        AND sfr.source_layer = $2
      ON CONFLICT (city_id, dataset_id, source_feature_id) DO UPDATE SET
        activity_id = EXCLUDED.activity_id,
        geom = EXCLUDED.geom,
        payload = EXCLUDED.payload
    `,
    [cityId, layer.key, datasetId, activityId],
  )
  return result.rowCount
}

async function copyFeatureFallbacks(client, cityId, layer, datasetId, activityId) {
  const result = await client.query(
    `
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
        cf.city_id,
        $3::uuid,
        $4::uuid,
        'legacy-feature:' || cf.id::text,
        $2,
        CASE
          WHEN $2 = 'overture-buildings' THEN 'open-provider'
          ELSE 'open-data-fallback'
        END,
        cf.geom,
        jsonb_build_object(
          'legacyFeatureId', cf.id,
          'stableId', cf.stable_id,
          'featureType', cf.feature_type,
          'label', cf.label,
          'authorityStatus', cf.authority_status,
          'confidence', cf.confidence,
          'properties', cf.properties
        )
      FROM public.city_features cf
      LEFT JOIN public.layer_definitions ld ON ld.id = cf.layer_id
      WHERE cf.city_id = $1
        AND COALESCE(ld.key, cf.feature_type) = $2
        AND cf.source_raw_id IS NULL
      ON CONFLICT (city_id, dataset_id, source_feature_id) DO UPDATE SET
        activity_id = EXCLUDED.activity_id,
        geom = EXCLUDED.geom,
        payload = EXCLUDED.payload
    `,
    [cityId, layer.key, datasetId, activityId],
  )
  return result.rowCount
}

async function addDatasetQuality(client, datasetId, counts) {
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
        'phase-2-source-native-coverage',
        CASE WHEN $2::int > 0 THEN 1 ELSE 0 END,
        $3,
        $4::jsonb
      )
    `,
    [
      datasetId,
      counts.sourceFeatureCount,
      `${counts.sourceFeatureCount} source features copied from the current runtime for this open/base layer.`,
      JSON.stringify(counts),
    ],
  )
}

async function addDatasetExtent(client, datasetId, cityId, layerKey) {
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
        'source-feature-envelope',
        ST_Envelope(ST_Collect(geom))::geometry(Geometry, 4326),
        jsonb_build_object(
          'source', 'computed-from-ldt-provenance',
          'cityId', $2::text,
          'layerKey', $3::text
        )
      FROM ldt_prov.source_features
      WHERE city_id = $2::text
        AND dataset_id = $1
        AND geom IS NOT NULL
      HAVING count(*) > 0
    `,
    [datasetId, cityId, layerKey],
  )
}

async function ensureArtifactDatasets(client, cityId) {
  const artifacts = await client.query(
    `
      SELECT source_kind, count(*)::int AS count, max(fetched_at) AS latest
      FROM public.source_artifacts
      WHERE city_id = $1
        AND (
          source_kind = 'city-boundary-search'
          OR source_kind LIKE 'overpass-%'
          OR source_kind = 'provider-overture-buildings'
          OR source_kind = 'provider-overture-roads'
          OR source_kind LIKE 'wikipedia-%'
        )
      GROUP BY source_kind
      ORDER BY source_kind
    `,
    [cityId],
  )

  const summaries = []
  for (const artifact of artifacts.rows) {
    if (!isOpenArtifactKind(artifact.source_kind)) continue
    const identifier = artifactDatasetIdentifier(cityId, artifact.source_kind)
    await client.query(
      `
        INSERT INTO ldt_catalog.datasets (
          city_id,
          identifier,
          title,
          description,
          publisher,
          license,
          access_rights,
          modified_at,
          metadata
        )
        VALUES (
          $1,
          $2,
          $3,
          'Raw source artifact collection preserved from the runtime source_artifacts table.',
          'Twin Base Studio runtime source fetcher',
          'Source-specific open data terms',
          'city-private',
          $4,
          $5::jsonb
        )
        ON CONFLICT (identifier) DO UPDATE SET
          modified_at = EXCLUDED.modified_at,
          metadata = ldt_catalog.datasets.metadata || EXCLUDED.metadata,
          updated_at = now()
      `,
      [
        cityId,
        identifier,
        `${artifact.source_kind} source artifacts`,
        artifact.latest,
        JSON.stringify({
          phase: 'phase-2-source-native-reingest',
          artifactCount: artifact.count,
          sourceKind: artifact.source_kind,
        }),
      ],
    )
    summaries.push({
      sourceKind: artifact.source_kind,
      count: artifact.count,
    })
  }
  return summaries
}

async function reingestCity(client, cityId) {
  await client.query('BEGIN')
  try {
    const city = await ensureCity(client, cityId)
    const layers = await openLayerDefinitions(client, cityId)
    const layerSummaries = []

    for (const layer of layers) {
      const datasetId = await ensureDataset(client, cityId, layer)
      const activityId = await ensureActivity(client, cityId, layer.key)
      const rawCount = await copySourceFeaturesRaw(client, cityId, layer, datasetId, activityId)
      const fallbackCount = await copyFeatureFallbacks(client, cityId, layer, datasetId, activityId)
      const sourceFeatureCount = rawCount + fallbackCount
      await addDatasetQuality(client, datasetId, { layerKey: layer.key, rawCount, fallbackCount, sourceFeatureCount })
      await addDatasetExtent(client, datasetId, cityId, layer.key)
      layerSummaries.push({
        layerKey: layer.key,
        datasetId,
        rawCount,
        fallbackCount,
        sourceFeatureCount,
      })
    }

    const artifactDatasets = await ensureArtifactDatasets(client, cityId)
    await client.query('COMMIT')
    return {
      cityId,
      name: city.name,
      layerCount: layers.length,
      sourceFeatureCount: layerSummaries.reduce((sum, layer) => sum + layer.sourceFeatureCount, 0),
      layers: layerSummaries,
      artifactDatasets,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

export async function reingestOpenDataSources({ cityIds = DEFAULT_CITY_IDS } = {}) {
  const pool = createPool()
  const client = await pool.connect()
  try {
    const targetCityIds = await listCityIds(client, cityIds)
    const cities = []
    for (const cityId of targetCityIds) {
      cities.push(await reingestCity(client, cityId))
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
  reingestOpenDataSources(args)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2))
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
