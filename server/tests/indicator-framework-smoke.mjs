import assert from 'node:assert/strict'
import {
  listIndicatorCatalogs,
  queryIndicatorEntityValues,
  upsertIndicatorCatalog,
  upsertIndicatorObservation,
  upsertIndicatorThresholdProfile,
  validateIndicatorCatalog,
} from '../services/ldtOps/indicatorFrameworkService.mjs'
import { withClient } from '../services/ldtOps/dbUtils.mjs'

const cityId = process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
const suffix = `${Date.now()}-${process.pid}`
const catalogKey = `generic-smoke-${suffix}`
const indicatorKey = `smoke.generic.entity-score.${suffix}`
const stableId = `indicator-framework-smoke:${suffix}`
let entityId = ''

async function cleanup() {
  await withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const catalog = await client.query('SELECT id FROM ldt_science.indicator_catalogs WHERE catalog_key=$1', [catalogKey])
      if (catalog.rowCount) {
        await client.query('DELETE FROM ldt_science.indicator_validation_runs WHERE catalog_id=$1', [catalog.rows[0].id])
        await client.query('DELETE FROM ldt_science.indicator_catalogs WHERE id=$1', [catalog.rows[0].id])
      }
      const definition = await client.query('SELECT id FROM ldt_science.indicator_definitions WHERE indicator_key=$1', [indicatorKey])
      if (definition.rowCount) await client.query('DELETE FROM ldt_science.indicator_definitions WHERE id=$1', [definition.rows[0].id])
      await client.query('DELETE FROM ldt_core.city_entities WHERE city_id=$1 AND stable_id=$2', [cityId, stableId])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

await cleanup()

try {
  entityId = await withClient(async (client) => {
    const inserted = await client.query(`
      INSERT INTO ldt_core.city_entities (
        city_id, stable_id, entity_type, label, authority_status,
        confidence, lifecycle_status, geom, properties
      )
      SELECT $1, $2, 'building', 'Indicator framework smoke building',
        'authority-approved', 'verified', 'active', ST_PointOnSurface(boundary.geom),
        jsonb_build_object('testOnly', true, 'testSuite', 'indicator-framework-smoke')
      FROM ldt_core.city_boundaries boundary
      WHERE boundary.city_id=$1
        AND lower(COALESCE(boundary.boundary_role, '')) NOT LIKE '%test%'
        AND lower(COALESCE(boundary.properties->>'source', '')) NOT LIKE '%smoke%'
      ORDER BY CASE boundary.boundary_role WHEN 'municipality' THEN 0 WHEN 'administrative' THEN 1 ELSE 2 END,
        boundary.created_at DESC
      LIMIT 1
      RETURNING id
    `, [cityId, stableId])
    assert.equal(inserted.rowCount, 1, 'CITY_BOUNDARY_REQUIRED')
    return inserted.rows[0].id
  })

  const catalog = await upsertIndicatorCatalog({
    cityId,
    catalogKey,
    title: 'Generic indicator smoke catalog',
    description: 'Temporary non-CIP catalog used to verify the generic adapter.',
    publisher: 'Smoke test',
    version: '1.0.0',
    adapterKey: 'json',
    definitions: [{
      externalCode: 'CITY:ENTITY:SCORE',
      indicatorKey,
      name: 'Generic entity score',
      definition: 'A temporary governed score attached to one canonical entity.',
      dimension: 'test',
      subdimension: 'generic adapter',
      unit: 'score',
      sourceMode: 'manual',
      scope: 'entity',
      difficulty: 'low',
      requirements: [{
        requirementKey: 'validated-value',
        label: 'Validated governed value',
        requirementType: 'validated-observation',
        required: true,
      }],
    }],
  })
  assert.equal(catalog.definitionCount, 1)
  assert.equal(catalog.requirementCount, 1)

  await assert.rejects(
    () => upsertIndicatorObservation({
      cityId,
      indicatorKey,
      entityId,
      value: 72,
      validationStatus: 'validated',
      authorityStatus: 'unreviewed',
    }),
    /INDICATOR_VALIDATED_AUTHORITY_REQUIRED/,
  )

  const observation = await upsertIndicatorObservation({
    cityId,
    indicatorKey,
    entityId,
    observationKey: `indicator-framework-smoke:${suffix}`,
    value: 72,
    unit: 'score',
    validationStatus: 'validated',
    authorityStatus: 'operator-accepted',
    sourceRef: 'indicator-framework-smoke',
  })
  assert.equal(Number(observation.observation.value), 72)

  const validation = await validateIndicatorCatalog({ cityId, catalogKey, requestedBy: 'indicator-framework-smoke' })
  assert.deepEqual(validation.summary, {
    total: 1,
    ready: 1,
    partial: 0,
    blocked: 0,
    notApplicable: 0,
    withValidatedValue: 1,
    mapQueryable: 1,
    calculablePercent: 100,
  })

  const threshold = await upsertIndicatorThresholdProfile({
    cityId,
    indicatorKey,
    profileKey: 'high-score',
    name: 'High score',
    operator: 'gte',
    thresholdValue: 70,
    unit: 'score',
    severity: 'watch',
  })
  assert.equal(threshold.profile.profile_key, 'high-score')

  const values = await queryIndicatorEntityValues({
    cityId,
    indicatorKey,
    thresholdProfileKey: 'high-score',
  })
  assert.equal(values.values.length, 1)
  assert.equal(values.values[0].entityId, entityId)
  assert.equal(values.values[0].value, 72)
  assert.equal(values.threshold.high, null)

  const catalogs = await listIndicatorCatalogs({ cityId, catalogKey })
  assert.equal(catalogs.summary.catalogCount, 1)
  assert.equal(catalogs.summary.ready, 1)
  assert.equal(catalogs.summary.mapQueryable, 1)

  console.log(JSON.stringify({
    ok: true,
    cityId,
    catalogKey,
    indicatorKey,
    validation: validation.summary,
    threshold: values.threshold,
    matchedEntityCount: values.values.length,
  }, null, 2))
} finally {
  await cleanup()
}
