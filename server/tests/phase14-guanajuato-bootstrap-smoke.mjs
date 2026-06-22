import assert from 'node:assert/strict'
import { getCityRegistry, updateCityRegistry, findCityConfig } from '../services/cityRegistry.mjs'
import { withClient } from '../services/ldtOps/dbUtils.mjs'
import {
  createWorkflowRun,
  decideWorkflowApproval,
  executePhase14WorkflowRunOnce,
  getWorkflowRun,
  listWorkflowRuns,
} from '../services/ldtOpsService.mjs'
import { buildOvertureQueryContract } from '../services/providerLayerIngestion/sourceAdapters.mjs'
import { getCityBoundaryBbox } from '../db/productionTwinStore.mjs'

const city = {
  id: 'guanajuato',
  name: 'Guanajuato',
  country: 'Mexico',
  countryCode: 'mx',
  region: 'Guanajuato',
  lat: 21.019,
  lon: -101.2574,
  enabled: true,
  preloaded: false,
  spotlight: false,
  twinLabel: 'Guanajuato Digital Twin',
  nominatimQuery: 'Municipio de Guanajuato, Guanajuato, Mexico',
  wikipediaTownPage: 'Guanajuato_City',
  wikipediaMunicipalityPage: 'Guanajuato_Municipality',
  municipalityTitle: 'Guanajuato',
  municipalityDescription: 'Capital city of Guanajuato, Mexico',
}
const bbox = [-101.35, 20.94, -101.15, 21.12]
const release = '2026-04-15.0'

function bboxMultiPolygonSql() {
  return `ST_Multi(ST_MakeEnvelope(${bbox.join(',')}, 4326))`
}

await withClient(async (client) => {
  await client.query('BEGIN')
  try {
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
      [city.id, city.name, city.country, city.countryCode, city.region, city.lon, city.lat, JSON.stringify({ smoke: true, capital: true })],
    )
    await client.query(
      `
        INSERT INTO ldt_core.cities (id, name, country, country_code, region, centroid, canonical_uri, metadata, updated_at)
        VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          country = EXCLUDED.country,
          country_code = EXCLUDED.country_code,
          region = EXCLUDED.region,
          centroid = EXCLUDED.centroid,
          metadata = EXCLUDED.metadata,
          updated_at = now()
      `,
      [city.id, city.name, city.country, city.countryCode, city.region, city.lon, city.lat, `urn:polisplexity:city:${city.id}`, JSON.stringify({ smoke: true, capital: true })],
    )
    const providers = [
      ['open-data-base', 'Open data base twin', 'open-data'],
      ['overture-maps', 'Overture Maps', 'open-data-provider'],
    ]
    for (const [id, name, providerType] of providers) {
      await client.query(
        `
          INSERT INTO public.providers (id, name, provider_type, metadata, updated_at)
          VALUES ($1, $2, $3, $4::jsonb, now())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            provider_type = EXCLUDED.provider_type,
            metadata = public.providers.metadata || EXCLUDED.metadata,
            updated_at = now()
        `,
        [id, name, providerType, JSON.stringify({ smoke: true, cityBootstrap: city.id })],
      )
    }

    await client.query(`DELETE FROM public.city_boundaries WHERE city_id = $1 AND source = 'phase14-guanajuato-smoke'`, [city.id])
    await client.query(`DELETE FROM ldt_core.city_boundaries WHERE city_id = $1 AND properties->>'source' = 'phase14-guanajuato-smoke'`, [city.id])
    await client.query(
      `INSERT INTO public.city_boundaries (city_id, source, authority_status, geom, properties)
       VALUES ($1, 'phase14-guanajuato-smoke', 'open-data', ${bboxMultiPolygonSql()}, $2::jsonb)`,
      [city.id, JSON.stringify({ source: 'phase14-guanajuato-smoke', bbox })],
    )
    await client.query(
      `INSERT INTO ldt_core.city_boundaries (city_id, boundary_role, authority_status, geom, properties)
       VALUES ($1, 'test-bootstrap-bbox', 'open-data', ${bboxMultiPolygonSql()}, $2::jsonb)`,
      [city.id, JSON.stringify({ source: 'phase14-guanajuato-smoke', bbox })],
    )

    const layers = [
      ['roads', 'open-data-base', 'Roads', 'mobility', 'LineString', 'OpenStreetMap contributors', 'on-refresh', 'base', { label: 'Roads', source: 'OpenStreetMap', smoke: true }],
      ['buildings', 'open-data-base', 'Buildings', 'built-fabric', 'Polygon', 'OpenStreetMap contributors', 'on-refresh', 'base', { label: 'Buildings', source: 'OpenStreetMap/Overture', smoke: true }],
      ['overture-buildings', 'overture-maps', 'Overture Buildings', 'built-fabric-candidate', 'Polygon', 'ODbL', 'release-managed', 'candidate-base-enrichment', { label: 'Overture Buildings', source: 'Overture Maps Buildings', smoke: true }],
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
            metadata = EXCLUDED.metadata,
            updated_at = now()
        `,
        [city.id, providerId, key, name, family, geometryType, license, frequency, semanticStatus, JSON.stringify(metadata)],
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
})

const currentRegistry = updateCityRegistry({
  cities: [
    ...new Map([
      ...getCityRegistry().cities.map((entry) => [entry.id, entry]),
      [city.id, city],
    ]).values(),
  ],
}, { reason: 'phase14.guanajuato-smoke.city-registered' })
assert.ok(currentRegistry.cities.some((entry) => entry.id === city.id), 'GUANAJUATO_REGISTRY_NOT_REGISTERED')

const cityConfig = findCityConfig(city.id)
assert.ok(cityConfig, 'GUANAJUATO_CITY_CONFIG_MISSING')
assert.equal(cityConfig.id, city.id, 'GUANAJUATO_CITY_CONFIG_ID_MISMATCH')

const buildingsContract = await buildOvertureQueryContract(cityConfig, { sourceVersion: release }, 'buildings')
const roadsContract = await buildOvertureQueryContract(cityConfig, { release }, 'roads')
assert.equal(buildingsContract.cityId, city.id, 'GUANAJUATO_OVERTURE_BUILDINGS_CITY_MISMATCH')
assert.equal(roadsContract.cityId, city.id, 'GUANAJUATO_OVERTURE_ROADS_CITY_MISMATCH')
assert.equal(buildingsContract.release, release, 'GUANAJUATO_OVERTURE_SOURCE_VERSION_MISMATCH')
const activeBoundary = await getCityBoundaryBbox(city.id)
assert.ok(activeBoundary.ok, 'GUANAJUATO_BOUNDARY_BBOX_LOOKUP_FAILED')
assert.ok(activeBoundary.bbox, 'GUANAJUATO_BOUNDARY_BBOX_MISSING')
assert.deepEqual(buildingsContract.bbox, activeBoundary.bbox, 'GUANAJUATO_OVERTURE_BBOX_NOT_FROM_CITY_BOUNDARY')
assert.deepEqual(roadsContract.bbox, activeBoundary.bbox, 'GUANAJUATO_OVERTURE_ROADS_BBOX_NOT_FROM_CITY_BOUNDARY')

const created = await createWorkflowRun({
  workflowKey: 'phase14-open-data-workflow-runner',
  cityId: city.id,
  input: {
    sourcePlan: {
      kind: 'city-open-data-bootstrap',
      posture: 'open-data-native',
      target: `${city.id}-city-open-data-bootstrap`,
      cityId: city.id,
      preset: {
        cityId: city.id,
        rawSchema: 'raw_osm_guanajuato',
        sourceSlug: 'guanajuato-osm-pbf',
        sourcePath: '/app/runtime-data/extracts/guanajuato/latest.osm.pbf',
        overtureRelease: release,
      },
    },
    providerPackages: [
      {
        layerKey: 'roads',
        action: 'osm-local-extract',
        sourceFormat: 'raw-osm-pbf',
        sourceUri: 'file:///app/runtime-data/extracts/guanajuato/latest.osm.pbf',
        sourceVersion: 'guanajuato-osm-pbf',
        posture: 'open-data-native',
        queueForExecution: true,
        metadata: {
          rawSchema: 'raw_osm_guanajuato',
          sourceSlug: 'guanajuato-osm-pbf',
          sourcePath: '/app/runtime-data/extracts/guanajuato/latest.osm.pbf',
        },
      },
      {
        layerKey: 'buildings',
        action: 'overture-buildings',
        sourceFormat: 'overture-buildings',
        sourceVersion: release,
        release,
        posture: 'open-data-native',
        queueForExecution: true,
        metadata: { release, bboxSource: 'active-city-boundary' },
      },
      {
        layerKey: 'roads',
        action: 'overture-roads',
        sourceFormat: 'overture-roads',
        sourceVersion: release,
        release,
        posture: 'open-data-native',
        queueForExecution: true,
        metadata: { release, bboxSource: 'active-city-boundary' },
      },
    ],
    extractorKeys: ['terrain-dem', 'weather-field', 'hydrology-grid'],
    refreshViewerAggregates: true,
    refreshConsolidation: true,
    refreshTwinQuerySurfaces: true,
    validationMode: 'city-open-data-bootstrap-guanajuato-smoke',
  },
  requestedBy: 'phase14-guanajuato-bootstrap-smoke',
  requestedByKind: 'system-smoke',
  triggerKind: 'smoke-test',
})
assert.equal(created.ok, true, created.error || 'GUANAJUATO_WORKFLOW_CREATE_FAILED')

let run = created.run
for (const approval of run.approvals) {
  const decision = await decideWorkflowApproval({
    runId: run.id,
    approvalKey: approval.approvalKey,
    decision: 'approved',
    decidedBy: 'phase14-guanajuato-bootstrap-smoke',
    reason: `Guanajuato smoke approval for ${approval.approvalKey}`,
  })
  assert.equal(decision.ok, true, decision.error || `GUANAJUATO_APPROVAL_FAILED:${approval.approvalKey}`)
  run = decision.run
}

const queued = await getWorkflowRun(created.run.id)
assert.equal(queued.run.status, 'queued', 'GUANAJUATO_RUN_SHOULD_QUEUE_AFTER_APPROVALS')

const executed = await executePhase14WorkflowRunOnce({
  runId: created.run.id,
  workerId: 'phase14-guanajuato-bootstrap-smoke',
})
assert.equal(executed.ok, true, executed.error || 'GUANAJUATO_WORKFLOW_EXECUTION_FAILED')
assert.equal(executed.run.status, 'succeeded', 'GUANAJUATO_RUN_SHOULD_SUCCEED')

const providerJobs = executed.run.output?.providerJobs ?? []
assert.ok(providerJobs.length >= 4, 'GUANAJUATO_PROVIDER_JOBS_MISSING')
assert.ok(providerJobs.some((entry) => entry.action === 'osm-local-extract' && entry.layerKey === 'roads'), 'GUANAJUATO_OSM_JOB_MISSING')
assert.ok(providerJobs.some((entry) => entry.action === 'overture-buildings' && entry.layerKey === 'buildings'), 'GUANAJUATO_OVERTURE_BUILDINGS_JOB_MISSING')
assert.ok(providerJobs.some((entry) => entry.action === 'overture-roads' && entry.layerKey === 'roads'), 'GUANAJUATO_OVERTURE_ROADS_JOB_MISSING')
assert.ok(providerJobs.some((entry) => entry.action === 'mvt-cache-refresh'), 'GUANAJUATO_REFRESH_JOB_MISSING')
assert.ok(providerJobs.every((entry) => entry.ok === true), 'GUANAJUATO_PROVIDER_JOB_REGISTRATION_FAILED')
const dataJobs = providerJobs.filter((entry) => entry.action !== 'mvt-cache-refresh')
const refreshJobs = providerJobs.filter((entry) => entry.action === 'mvt-cache-refresh')
assert.ok(dataJobs.every((entry) => entry.status === 'queued'), 'GUANAJUATO_DATA_PROVIDER_JOBS_SHOULD_QUEUE')
assert.ok(refreshJobs.every((entry) => entry.status === 'registered'), 'GUANAJUATO_SMOKE_REFRESH_JOB_SHOULD_REGISTER_ONLY')
assert.ok(providerJobs.every((entry) => entry.sourceValidation?.canQueue === true), 'GUANAJUATO_PROVIDER_JOBS_SHOULD_BE_QUEUEABLE')

const runs = await listWorkflowRuns({ cityId: city.id, workflowKey: 'phase14-open-data-workflow-runner', limit: 5 })
assert.equal(runs.ok, true, runs.error || 'GUANAJUATO_RUN_LIST_FAILED')
assert.ok(runs.runs.some((entry) => entry.id === created.run.id), 'GUANAJUATO_RUN_NOT_LISTED')

console.log(JSON.stringify({
  ok: true,
  cityId: city.id,
  bootstrapBbox: bbox,
  activeBoundaryBbox: activeBoundary.bbox,
  overture: {
    buildings: buildingsContract,
    roads: roadsContract,
  },
  run: {
    id: executed.run.id,
    status: executed.run.status,
    providerJobs: providerJobs.map((entry) => ({
      layerKey: entry.layerKey,
      action: entry.action,
      status: entry.status,
      canQueue: entry.sourceValidation?.canQueue,
    })),
    extractorRuns: executed.extractorRuns.map((entry) => ({ extractorKey: entry.extractorKey, status: entry.status })),
  },
}, null, 2))
