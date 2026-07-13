import assert from 'node:assert/strict'
import express from 'express'
import { runProductionMigrations } from '../db/migrate.mjs'
import { closeProductionPool, getProductionPool } from '../db/postgisPool.mjs'
import { registerSubjectQueryRoutes } from '../routes/liveFeature/subjectQueryRoutes.mjs'
import {
  saveContextSubject,
  saveSubjectIndicatorObservation,
  saveSubjectRelation,
} from '../services/subjectQuery/subjectQueryService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

async function cleanup(pool, cityId) {
  await pool.query("DELETE FROM ldt_analysis.subject_query_blueprints WHERE blueprint_key LIKE 'subject-query-smoke.%'")
  await pool.query("DELETE FROM ldt_science.indicator_observations WHERE observation_key LIKE 'subject-query-smoke.%'")
  await pool.query("DELETE FROM ldt_context.subject_relations WHERE city_id = $1 AND relation_key LIKE 'subject-query-smoke.%'", [cityId])
  await pool.query("DELETE FROM ldt_context.context_subjects WHERE city_id = $1 AND subject_key LIKE 'subject-query-smoke.%'", [cityId])
  await pool.query("DELETE FROM ldt_science.indicator_definitions WHERE indicator_key LIKE 'subject-query-smoke.%'")
}

async function ensureIndicator(pool, payload) {
  await pool.query(`
    INSERT INTO ldt_science.indicator_definitions (
      indicator_key, name, model_family, unit, definition, standard_key,
      standard_version, dimension, calculation_scope, kind, source_mode,
      visualization, active, updated_at
    ) VALUES ($1,$2,'descriptive',$3,$4,'oldt-subject-query-smoke','1.0.0',$5,$6,'indicator','computed',$7::jsonb,true,now())
    ON CONFLICT (indicator_key) DO UPDATE SET
      name=EXCLUDED.name,
      unit=EXCLUDED.unit,
      definition=EXCLUDED.definition,
      dimension=EXCLUDED.dimension,
      calculation_scope=EXCLUDED.calculation_scope,
      visualization=EXCLUDED.visualization,
      active=true,
      updated_at=now()
  `, [
    payload.key,
    payload.name,
    payload.unit,
    payload.definition,
    payload.dimension,
    payload.scope,
    JSON.stringify(payload.visualization),
  ])
}

async function startServer(cityId) {
  const app = express()
  app.use(express.json({ limit: '2mb' }))
  registerSubjectQueryRoutes(app, {
    requireLiveCityAccess: (_request, _response, requestedCityId) => ({
      cityId: requestedCityId === 'current' ? cityId : requestedCityId,
      userId: 'subject-query-smoke',
    }),
  })
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options)
  const payload = await response.json()
  return { response, payload }
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
const unemploymentKey = 'subject-query-smoke.unemployment-rate'
const youthShareKey = 'subject-query-smoke.youth-share'
let routeServer = null

try {
  await runProductionMigrations()
  const pool = getProductionPool()
  assert.ok(pool, 'DATABASE_URL_REQUIRED')
  await cleanup(pool, cityId)

  const seed = await pool.query(`
    SELECT
      ST_AsGeoJSON(ST_Buffer(city.centroid::geography, 700)::geometry)::jsonb AS geometry,
      (
        SELECT entity.stable_id
        FROM ldt_core.city_entities entity
        WHERE entity.city_id = city.id
          AND entity.entity_type = 'building'
          AND entity.lifecycle_status = 'active'
        ORDER BY entity.stable_id
        LIMIT 1
      ) AS building_key
    FROM ldt_core.cities city
    WHERE city.id = $1
  `, [cityId])
  assert.ok(seed.rows[0]?.geometry, 'CITY_CENTROID_GEOMETRY_REQUIRED')
  assert.ok(seed.rows[0]?.building_key, 'PHYSICAL_BUILDING_REQUIRED')

  await ensureIndicator(pool, {
    key: unemploymentKey,
    name: 'Unemployment rate smoke',
    unit: '%',
    definition: 'Unemployed economically active population divided by the economically active population.',
    dimension: 'economy',
    scope: 'statistical-area',
    visualization: { preferred: 'choropleth' },
  })
  await ensureIndicator(pool, {
    key: youthShareKey,
    name: 'Youth cohort share smoke',
    unit: '%',
    definition: 'Population in the youth cohort divided by the reference population.',
    dimension: 'society',
    scope: 'population-cohort',
    visualization: { preferred: 'chart' },
  })

  await saveContextSubject(cityId, {
    subjectKey: 'subject-query-smoke.area-centre',
    subjectType: 'statistical-area',
    domainType: 'demography',
    label: 'Central statistical area',
    authorityStatus: 'municipal-authoritative',
    privacyClass: 'aggregate',
    geometry: seed.rows[0].geometry,
    attributes: { statisticalLevel: 'smoke-area', population: 10000 },
    provenance: { source: 'subject-query-framework-smoke' },
  })
  await saveContextSubject(cityId, {
    subjectKey: 'subject-query-smoke.area-restricted',
    subjectType: 'statistical-area',
    domainType: 'demography',
    label: 'Restricted statistical area',
    authorityStatus: 'municipal-authoritative',
    privacyClass: 'restricted',
    geometry: seed.rows[0].geometry,
    provenance: { source: 'subject-query-framework-smoke' },
  })
  await saveContextSubject(cityId, {
    subjectKey: 'subject-query-smoke.cohort-youth',
    subjectType: 'population-cohort',
    domainType: 'demography',
    label: 'Youth cohort',
    authorityStatus: 'official',
    privacyClass: 'aggregate',
    attributes: { ageMin: 15, ageMax: 24 },
    provenance: { source: 'subject-query-framework-smoke' },
  })

  await saveSubjectRelation(cityId, {
    relationKey: 'subject-query-smoke.area-contains-building',
    relationType: 'contains-asset',
    source: { kind: 'context', key: 'subject-query-smoke.area-centre' },
    target: { kind: 'physical', key: seed.rows[0].building_key },
    authorityStatus: 'operator-accepted',
  })

  await saveSubjectIndicatorObservation(cityId, {
    observationKey: 'subject-query-smoke.area-unemployment',
    indicatorKey: unemploymentKey,
    subjectKind: 'context',
    subjectKey: 'subject-query-smoke.area-centre',
    geographyLevel: 'statistical-area',
    valueKind: 'numeric',
    value: 7.4,
    numerator: 740,
    denominator: 10000,
    unit: '%',
    validationStatus: 'validated',
    authorityStatus: 'official',
    sourceQuality: 'municipal-authoritative',
    sourceRef: 'subject-query-framework-smoke',
  })
  await saveSubjectIndicatorObservation(cityId, {
    observationKey: 'subject-query-smoke.restricted-unemployment',
    indicatorKey: unemploymentKey,
    subjectKind: 'context',
    subjectKey: 'subject-query-smoke.area-restricted',
    geographyLevel: 'statistical-area',
    valueKind: 'numeric',
    value: 9.1,
    numerator: 91,
    denominator: 1000,
    unit: '%',
    validationStatus: 'validated',
    authorityStatus: 'official',
    sourceQuality: 'municipal-authoritative',
    sourceRef: 'subject-query-framework-smoke',
  })
  await saveSubjectIndicatorObservation(cityId, {
    observationKey: 'subject-query-smoke.cohort-youth-share',
    indicatorKey: youthShareKey,
    subjectKind: 'context',
    subjectKey: 'subject-query-smoke.cohort-youth',
    geographyLevel: 'population-cohort',
    valueKind: 'numeric',
    value: 24.5,
    numerator: 2450,
    denominator: 10000,
    unit: '%',
    validationStatus: 'validated',
    authorityStatus: 'official',
    sourceQuality: 'municipal-authoritative',
    sourceRef: 'subject-query-framework-smoke',
  })

  routeServer = await startServer(cityId)
  const contractResult = await jsonRequest(`${routeServer.baseUrl}/api/live/current/subject-query-contract`)
  assert.equal(contractResult.response.status, 200, 'SUBJECT_QUERY_CONTRACT_STATUS')
  assert.equal(contractResult.payload.contract.guarantees.noPhysicalAssetDuplication, true, 'SUBJECT_QUERY_CONTRACT_DUPLICATION_GUARANTEE')
  assert.ok(contractResult.payload.contract.inventory.subjects.some((entry) => entry.subjectType === 'statistical-area'), 'SUBJECT_QUERY_CONTRACT_AREA_MISSING')

  const spatialQuery = {
    subject: { kinds: ['context'], types: ['statistical-area'] },
    indicator: {
      key: unemploymentKey,
      operator: 'gte',
      valueKind: 'numeric',
      value: 7,
      validationStatuses: ['validated'],
      authorityStatuses: ['official'],
    },
    render: { mode: 'auto', maxFeatures: 100 },
  }
  const spatialResult = await jsonRequest(`${routeServer.baseUrl}/api/live/${cityId}/subject-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(spatialQuery),
  })
  assert.equal(spatialResult.response.status, 200, `SUBJECT_QUERY_SPATIAL_STATUS:${spatialResult.payload.detail ?? ''}`)
  assert.equal(spatialResult.payload.summary.resultCount, 1, 'SUBJECT_QUERY_RESTRICTED_LEAK_OR_COUNT')
  assert.equal(spatialResult.payload.transport, 'geojson', 'SUBJECT_QUERY_SPATIAL_TRANSPORT')
  assert.equal(spatialResult.payload.manifest.selectedRenderer, 'choropleth', 'SUBJECT_QUERY_SPATIAL_RENDERER')
  assert.equal(spatialResult.payload.geojson.features.length, 1, 'SUBJECT_QUERY_SPATIAL_FEATURES')
  assert.equal(spatialResult.payload.table.rows[0].numerator, 740, 'SUBJECT_QUERY_NUMERATOR')
  assert.equal(spatialResult.payload.table.rows[0].denominator, 10000, 'SUBJECT_QUERY_DENOMINATOR')

  const relationResult = await jsonRequest(`${routeServer.baseUrl}/api/live/current/subject-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: { kinds: ['context'], types: ['statistical-area'] },
      relation: { type: 'contains-asset', direction: 'outgoing', targetKinds: ['physical'], targetTypes: ['building'], minimumCount: 1 },
      render: { mode: 'map', maxFeatures: 100 },
    }),
  })
  assert.equal(relationResult.response.status, 200, `SUBJECT_QUERY_RELATION_STATUS:${relationResult.payload.detail ?? ''}`)
  assert.equal(relationResult.payload.summary.resultCount, 1, 'SUBJECT_QUERY_RELATION_COUNT')
  assert.equal(relationResult.payload.table.rows[0].relationCount, 1, 'SUBJECT_QUERY_RELATION_LINK_COUNT')

  const cohortResult = await jsonRequest(`${routeServer.baseUrl}/api/live/current/subject-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: { kinds: ['context'], types: ['population-cohort'] },
      indicator: { key: youthShareKey, operator: 'exists', validationStatuses: ['validated'], authorityStatuses: ['official'] },
      render: { mode: 'auto' },
    }),
  })
  assert.equal(cohortResult.response.status, 200, `SUBJECT_QUERY_COHORT_STATUS:${cohortResult.payload.detail ?? ''}`)
  assert.equal(cohortResult.payload.transport, 'table', 'SUBJECT_QUERY_COHORT_TRANSPORT')
  assert.equal(cohortResult.payload.manifest.selectedRenderer, 'chart', 'SUBJECT_QUERY_COHORT_RENDERER')
  assert.equal(cohortResult.payload.summary.resultCount, 1, 'SUBJECT_QUERY_COHORT_COUNT')

  const saveBlueprintResult = await jsonRequest(`${routeServer.baseUrl}/api/live/current/subject-query-blueprints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blueprintKey: 'subject-query-smoke.unemployment-watch',
      title: 'Unemployment watch by statistical area',
      portabilityScope: 'portable',
      global: true,
      visibility: 'municipal',
      standardRefs: ['U4SSC'],
      query: spatialQuery,
      renderer: spatialResult.payload.manifest,
    }),
  })
  assert.equal(saveBlueprintResult.response.status, 201, `SUBJECT_QUERY_BLUEPRINT_SAVE_STATUS:${saveBlueprintResult.payload.detail ?? ''}`)
  assert.equal(saveBlueprintResult.payload.blueprint.mode, 'subject', 'SUBJECT_QUERY_BLUEPRINT_MODE')
  assert.equal(saveBlueprintResult.payload.blueprint.cityId, cityId, 'SUBJECT_QUERY_BLUEPRINT_CITY_SCOPE')

  const listBlueprintResult = await jsonRequest(`${routeServer.baseUrl}/api/live/current/subject-query-blueprints`)
  assert.equal(listBlueprintResult.response.status, 200, 'SUBJECT_QUERY_BLUEPRINT_LIST_STATUS')
  assert.ok(listBlueprintResult.payload.blueprints.some((entry) => entry.blueprintKey === 'subject-query-smoke.unemployment-watch'), 'SUBJECT_QUERY_BLUEPRINT_LIST_MISSING')

  const executeBlueprintResult = await jsonRequest(
    `${routeServer.baseUrl}/api/live/current/subject-query-blueprints/subject-query-smoke.unemployment-watch/execute`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  )
  assert.equal(executeBlueprintResult.response.status, 200, `SUBJECT_QUERY_BLUEPRINT_EXECUTE_STATUS:${executeBlueprintResult.payload.detail ?? ''}`)
  assert.equal(executeBlueprintResult.payload.summary.resultCount, 1, 'SUBJECT_QUERY_BLUEPRINT_EXECUTE_COUNT')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    contract: {
      subjectTypes: contractResult.payload.contract.inventory.subjects.length,
      indicators: contractResult.payload.contract.inventory.indicators.length,
      relationTypes: contractResult.payload.contract.inventory.relations.length,
    },
    spatial: {
      resultCount: spatialResult.payload.summary.resultCount,
      transport: spatialResult.payload.transport,
      renderer: spatialResult.payload.manifest.selectedRenderer,
    },
    nonSpatial: {
      resultCount: cohortResult.payload.summary.resultCount,
      transport: cohortResult.payload.transport,
      renderer: cohortResult.payload.manifest.selectedRenderer,
    },
    relationCount: relationResult.payload.table.rows[0].relationCount,
    blueprintKey: saveBlueprintResult.payload.blueprint.blueprintKey,
    privacyLeakCount: spatialResult.payload.summary.resultCount - 1,
  }, null, 2))
} finally {
  if (routeServer) await routeServer.close()
  const pool = getProductionPool()
  if (pool) await cleanup(pool, cityId)
  await closeProductionPool()
}
