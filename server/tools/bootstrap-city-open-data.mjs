import { closeLdtViewerAggregatePool, refreshLdtViewerAggregates } from '../services/ldtViewerAggregateService.mjs'
import { fetchBoundary, selectNominatimBoundaryCandidate } from '../services/baseTwin/openDataFetchers.mjs'
import { findCityConfig } from '../services/cityRegistry.mjs'
import { withClient } from '../services/ldtOps/dbUtils.mjs'
import { evaluateCityBoundaryQualityGate } from '../services/ldtOps/citySourcePlanService.mjs'
import { ingestOvertureBuildingsLayer, ingestOvertureRoadsLayer } from '../services/providerLayerIngestionService.mjs'
import { consolidateLdtInventory } from '../db/ldt-consolidate-inventory.mjs'
import { reingestOpenDataSources } from '../db/ldt-open-data-reingest.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function booleanArg(name) {
  return process.argv.includes(`--${name}`) || process.argv.includes(`--${name}=true`)
}

function numberArg(name, fallback) {
  const value = Number(argValue(name))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function usage() {
  return [
    'Usage:',
    '  npm run ops:bootstrap-city-open-data -- --city=<city-id>',
    '',
    'Options:',
    '  --city=<city-id>                 Required city id from runtime city registry.',
    '  --release=<overture-release>     Overture release. Defaults to TWIN_STUDIO_OVERTURE_RELEASE or 2026-06-17.0.',
    '  --buildings-limit=<n>            Optional Overture buildings limit.',
    '  --roads-limit=<n>                Optional Overture roads limit.',
    '  --overture-attempts=<n>          Overture retry attempts. Defaults to 3.',
    '  --boundary-only                  Seed city/boundary/layers only.',
    '  --skip-ldt-refresh               Skip reingest/consolidate/viewer aggregate refresh.',
    '  --submitted-by=<label>           Audit label.',
  ].join('\n')
}

async function retryOperation(label, attempts, operation) {
  const normalizedAttempts = Math.max(1, Number(attempts) || 1)
  let lastError = null
  for (let attempt = 1; attempt <= normalizedAttempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt >= normalizedAttempts) break
      const delayMs = Math.min(30_000, 2_000 * attempt)
      console.warn(JSON.stringify({
        ok: false,
        warning: 'OPEN_DATA_BOOTSTRAP_RETRY',
        label,
        attempt,
        attempts: normalizedAttempts,
        delayMs,
        error: String(error?.message ?? 'UNKNOWN_ERROR').slice(0, 1000),
      }))
      await sleep(delayMs)
    }
  }
  throw lastError
}

function requireCityConfig(cityId) {
  const city = findCityConfig(cityId)
  if (!city) throw new Error(`CITY_REGISTRY_CONFIG_NOT_FOUND:${cityId}`)
  return city
}

function boundaryGeometry(boundary) {
  const geometry = boundary?.features?.[0]?.geometry ?? null
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) {
    throw new Error(`CITY_BOUNDARY_POLYGON_REQUIRED:${geometry?.type ?? 'missing'}`)
  }
  return geometry
}

function assertResolvedOpenDataBoundary(boundaryResult, city) {
  const boundarySearch = boundaryResult?.sourceArtifacts?.find((artifact) => artifact?.sourceKind === 'city-boundary-search')
  const topResult = selectNominatimBoundaryCandidate(boundarySearch?.payload)
  if (!topResult?.geojson) {
    throw new Error(`CITY_BOUNDARY_NOMINATIM_GEOJSON_REQUIRED:${city.id}`)
  }
  if (!['Polygon', 'MultiPolygon'].includes(topResult.geojson.type)) {
    throw new Error(`CITY_BOUNDARY_NOMINATIM_POLYGON_REQUIRED:${city.id}:${topResult.geojson.type ?? 'missing'}`)
  }
}

async function resetBootstrapRuntimeData(cityId) {
  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const deletions = {}
      for (const [key, sql] of [
        ['viewerCacheEntries', 'DELETE FROM public.viewer_cache_entries WHERE city_id = $1'],
        ['ingestionValidationReports', 'DELETE FROM public.ingestion_validation_reports WHERE city_id = $1'],
        ['layerIngestionJobs', 'DELETE FROM public.layer_ingestion_jobs WHERE city_id = $1'],
        ['cityFeatures', 'DELETE FROM public.city_features WHERE city_id = $1'],
      ]) {
        const result = await client.query(sql, [cityId])
        deletions[key] = result.rowCount
      }
      const artifacts = await client.query(
        `
          DELETE FROM public.source_artifacts
          WHERE city_id = $1
            AND (
              provider_id IN ('open-data-base', 'overture-maps')
              OR source_kind = 'city-boundary-search'
              OR source_kind LIKE 'overpass-%'
              OR source_kind LIKE 'wikipedia-%'
              OR source_kind = 'provider-overture-buildings'
              OR source_kind = 'provider-overture-roads'
            )
        `,
        [cityId],
      )
      deletions.sourceArtifacts = artifacts.rowCount
      await client.query('COMMIT')
      return deletions
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

async function seedRuntimeCity({ city, boundary, center, sourceArtifacts, submittedBy }) {
  const geometry = boundaryGeometry(boundary)
  const boundaryProperties = {
    source: 'nominatim-open-data',
    sourceKind: 'city-boundary-search',
    sourceName: 'Nominatim',
    label: boundary.features?.[0]?.properties?.label ?? `${city.name} boundary`,
    role: 'administrative',
    fetchedAt: new Date().toISOString(),
    submittedBy,
  }

  return withClient(async (client) => {
    await client.query('BEGIN')
    try {
      await client.query(
        `
          INSERT INTO public.providers (id, name, provider_type, metadata, updated_at)
          VALUES
            ('open-data-base', 'Open data base twin', 'open-data', $1::jsonb, now()),
            ('overture-maps', 'Overture Maps', 'open-data-provider', $2::jsonb, now())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            provider_type = EXCLUDED.provider_type,
            metadata = public.providers.metadata || EXCLUDED.metadata,
            updated_at = now()
        `,
        [
          JSON.stringify({ cityBootstrap: city.id, submittedBy }),
          JSON.stringify({ cityBootstrap: city.id, submittedBy, source: 'Overture Maps' }),
        ],
      )

      await client.query(
        `
          INSERT INTO public.cities (id, name, country, country_code, region, centroid, enabled, metadata, updated_at)
          VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), true, $8::jsonb, now())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            country = EXCLUDED.country,
            country_code = EXCLUDED.country_code,
            region = EXCLUDED.region,
            centroid = EXCLUDED.centroid,
            enabled = true,
            metadata = EXCLUDED.metadata,
            updated_at = now()
        `,
        [
          city.id,
          city.name,
          city.country,
          city.countryCode,
          city.region,
          center.lon,
          center.lat,
          JSON.stringify({
            phase: 'open-data-bootstrap',
            source: 'runtime-city-registry',
            nominatimQuery: city.nominatimQuery,
            twinLabel: city.twinLabel,
            submittedBy,
          }),
        ],
      )

      await client.query(
        `
          INSERT INTO ldt_core.cities (
            id, name, country, country_code, region, centroid, canonical_uri, source_city_id, metadata, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $1, $9::jsonb, now())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            country = EXCLUDED.country,
            country_code = EXCLUDED.country_code,
            region = EXCLUDED.region,
            centroid = EXCLUDED.centroid,
            canonical_uri = EXCLUDED.canonical_uri,
            source_city_id = EXCLUDED.source_city_id,
            metadata = EXCLUDED.metadata,
            updated_at = now()
        `,
        [
          city.id,
          city.name,
          city.country,
          city.countryCode,
          city.region,
          center.lon,
          center.lat,
          `urn:polisplexity:ldt:city:${city.id}`,
          JSON.stringify({
            phase: 'open-data-bootstrap',
            source: 'runtime-city-registry',
            nominatimQuery: city.nominatimQuery,
            submittedBy,
          }),
        ],
      )

      await client.query(`DELETE FROM public.city_boundaries WHERE city_id = $1 AND source = 'nominatim-open-data'`, [city.id])
      await client.query(
        `
          INSERT INTO public.city_boundaries (city_id, source, authority_status, geom, properties, valid_from)
          VALUES (
            $1,
            'nominatim-open-data',
            'open-data',
            ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)), 3)),
            $3::jsonb,
            now()
          )
        `,
        [city.id, JSON.stringify(geometry), JSON.stringify(boundaryProperties)],
      )

      await client.query(`DELETE FROM ldt_core.city_boundaries WHERE city_id = $1 AND properties->>'source' = 'nominatim-open-data'`, [city.id])
      await client.query(
        `
          INSERT INTO ldt_core.city_boundaries (city_id, boundary_role, authority_status, geom, properties, valid_from)
          VALUES (
            $1,
            'administrative',
            'open-data',
            ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)), 3)),
            $3::jsonb,
            now()
          )
        `,
        [city.id, JSON.stringify(geometry), JSON.stringify(boundaryProperties)],
      )

      const layers = [
        ['roads', 'overture-maps', 'Roads', 'mobility', 'LineString', 'ODbL', 'release-managed', 'base', { source: 'Overture Maps Transportation' }],
        ['buildings', 'overture-maps', 'Buildings', 'built-fabric', 'Polygon', 'ODbL', 'release-managed', 'base', { source: 'Overture Maps Buildings' }],
        ['overture-buildings', 'overture-maps', 'Overture Buildings', 'built-fabric-candidate', 'Polygon', 'ODbL', 'release-managed', 'candidate-base-enrichment', { source: 'Overture Maps Buildings' }],
      ]
      for (const [key, providerId, name, family, geometryType, license, frequency, semanticStatus, metadata] of layers) {
        await client.query(
          `
            INSERT INTO public.layer_definitions (
              city_id, provider_id, key, name, layer_family, geometry_type,
              authority_status, access_level, source_license, update_frequency,
              semantic_status, metadata, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'open-data', 'public-open-data', $7, $8, $9, $10::jsonb, now())
            ON CONFLICT (city_id, key) DO UPDATE SET
              provider_id = EXCLUDED.provider_id,
              name = EXCLUDED.name,
              layer_family = EXCLUDED.layer_family,
              geometry_type = EXCLUDED.geometry_type,
              source_license = EXCLUDED.source_license,
              update_frequency = EXCLUDED.update_frequency,
              semantic_status = EXCLUDED.semantic_status,
              metadata = public.layer_definitions.metadata || EXCLUDED.metadata,
              updated_at = now()
          `,
          [city.id, providerId, key, name, family, geometryType, license, frequency, semanticStatus, JSON.stringify({ ...metadata, cityBootstrap: city.id, submittedBy })],
        )
      }

      for (const artifact of sourceArtifacts ?? []) {
        await client.query(
          `
            INSERT INTO public.source_artifacts (
              city_id, provider_id, source_name, source_url, source_kind, fetched_at, payload, metadata
            )
            VALUES ($1, 'open-data-base', $2, $3, $4, $5, $6::jsonb, $7::jsonb)
          `,
          [
            city.id,
            artifact.sourceName ?? 'Nominatim',
            artifact.sourceUrl ?? null,
            artifact.sourceKind ?? 'city-boundary-search',
            artifact.fetchedAt ?? new Date().toISOString(),
            JSON.stringify(artifact.payload ?? {}),
            JSON.stringify({
              ...(artifact.metadata ?? {}),
              submittedBy,
              boundarySeed: true,
            }),
          ],
        )
      }

      await client.query('COMMIT')
      return {
        ok: true,
        cityId: city.id,
        boundarySourceArtifacts: sourceArtifacts?.length ?? 0,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

async function runOverture({ city, release, buildingsLimit, roadsLimit, submittedBy, attempts }) {
  const buildings = await retryOperation('overture-buildings', attempts, () => ingestOvertureBuildingsLayer(city, 'buildings', {
    release,
    maxFeatures: buildingsLimit,
    submittedBy,
    metadata: {
      cityBootstrap: city.id,
      bboxSource: 'active-city-boundary',
      release,
    },
  }))
  const roads = await retryOperation('overture-roads', attempts, () => ingestOvertureRoadsLayer(city, 'roads', {
    release,
    maxFeatures: roadsLimit,
    submittedBy,
    metadata: {
      cityBootstrap: city.id,
      bboxSource: 'active-city-boundary',
      release,
    },
  }))
  return { buildings, roads }
}

async function refreshLdt(cityId) {
  const reingest = await reingestOpenDataSources({ cityIds: [cityId] })
  const consolidate = await consolidateLdtInventory({ cityIds: [cityId] })
  const viewerAggregates = await refreshLdtViewerAggregates({ cityIds: [cityId] })
  await closeLdtViewerAggregatePool()
  return { reingest, consolidate, viewerAggregates }
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(usage())
    return
  }
  const cityId = argValue('city') || argValue('city-id') || argValue('cityId')
  const city = requireCityConfig(cityId)
  const submittedBy = argValue('submitted-by') || argValue('submittedBy') || 'open-data-city-bootstrap'
  const release = argValue('release') || argValue('overture-release') || process.env.TWIN_STUDIO_OVERTURE_RELEASE || '2026-06-17.0'
  const buildingsLimit = numberArg('buildings-limit', undefined)
  const roadsLimit = numberArg('roads-limit', undefined)
  const overtureAttempts = numberArg('overture-attempts', 3)
  const boundaryOnly = booleanArg('boundary-only')
  const skipLdtRefresh = booleanArg('skip-ldt-refresh')

  const boundaryResult = await fetchBoundary(city)
  assertResolvedOpenDataBoundary(boundaryResult, city)
  const reset = await resetBootstrapRuntimeData(city.id)
  const seed = await seedRuntimeCity({
    city,
    center: boundaryResult.center,
    boundary: boundaryResult.boundary,
    sourceArtifacts: boundaryResult.sourceArtifacts,
    submittedBy,
  })
  const boundaryGateAfterSeed = await evaluateCityBoundaryQualityGate(city.id)
  if (boundaryGateAfterSeed.passed !== true) {
    console.log(JSON.stringify({
      ok: false,
      cityId: city.id,
      seed,
      boundaryGate: boundaryGateAfterSeed,
      error: 'CITY_BOUNDARY_GATE_BLOCKED_AFTER_BOOTSTRAP',
    }, null, 2))
    process.exitCode = 2
    return
  }

  const overture = boundaryOnly ? null : await runOverture({
    city,
    release,
    buildingsLimit,
    roadsLimit,
    submittedBy,
    attempts: overtureAttempts,
  })
  const ldt = skipLdtRefresh ? null : await refreshLdt(city.id)
  const boundaryGate = await evaluateCityBoundaryQualityGate(city.id)

  console.log(JSON.stringify({
    ok: true,
    cityId: city.id,
    release,
    reset,
    seed,
    boundaryGate,
    overture,
    ldt,
  }, null, 2))
}

main().catch(async (error) => {
  try {
    await closeLdtViewerAggregatePool()
  } catch {
    // Keep the original error.
  }
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message ?? 'CITY_OPEN_DATA_BOOTSTRAP_FAILED'),
  }, null, 2))
  process.exit(1)
})
