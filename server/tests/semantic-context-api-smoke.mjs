import assert from 'node:assert/strict'
import express from 'express'
import { runProductionMigrations } from '../db/migrate.mjs'
import { closeProductionPool, getProductionPool } from '../db/postgisPool.mjs'
import { registerSemanticContextRoutes } from '../routes/liveFeature/semanticContextRoutes.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message)
}

async function startRouteServer(cityId) {
  const app = express()
  app.use(express.json())
  registerSemanticContextRoutes(app, {
    requireLiveCityAccess: (_request, _response, requestedCityId) => ({
      cityId: requestedCityId === 'current' ? cityId : requestedCityId,
    }),
  })

  const server = await new Promise((resolve) => {
    const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer))
  })
  const address = server.address()
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

async function findTaggedEntity(cityId) {
  const pool = getProductionPool()
  assertCondition(pool, 'DATABASE_URL_REQUIRED')
  const result = await pool.query(
    `
      SELECT
        ce.id::text AS id,
        ce.stable_id,
        ce.entity_type,
        est.semantic_class_key
      FROM ldt_semantic.entity_semantic_tags est
      JOIN ldt_core.city_entities ce ON ce.id = est.entity_id
      WHERE ce.city_id = $1
        AND est.valid_to IS NULL
      ORDER BY
        CASE est.semantic_class_key
          WHEN 'builtFabric' THEN 0
          WHEN 'mobilityNetwork' THEN 1
          ELSE 2
        END,
        ce.stable_id
      LIMIT 1
    `,
    [cityId],
  )
  return result.rows[0] || null
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'
let routeServer = null

try {
  await runProductionMigrations()

  const sample = await findTaggedEntity(cityId)
  assertCondition(
    sample?.id && sample?.stable_id,
    'TAGGED_ENTITY_SAMPLE_MISSING:run entity-semantic-tags-smoke or db:ldt:materialize-semantic-tags first',
  )

  routeServer = await startRouteServer(cityId)

  const stableResponse = await fetch(`${routeServer.baseUrl}/api/live/${encodeURIComponent(cityId)}/entities/${encodeURIComponent(sample.stable_id)}/semantic-context`)
  const stablePayload = await stableResponse.json()
  assert.equal(stableResponse.status, 200, `STABLE_ID_CONTEXT_STATUS:${stableResponse.status}:${stablePayload.error ?? 'unknown'}`)
  assert.equal(stablePayload.ok, true, `STABLE_ID_CONTEXT_FAILED:${stablePayload.error ?? 'unknown'}`)
  assert.equal(stablePayload.entity.stableId, sample.stable_id, 'STABLE_ID_CONTEXT_ENTITY_MISMATCH')
  assert.ok(stablePayload.semanticTags.length > 0, 'STABLE_ID_CONTEXT_TAGS_EMPTY')
  assert.ok(stablePayload.sourceEvidence.length > 0, 'STABLE_ID_CONTEXT_SOURCE_EVIDENCE_EMPTY')
  assert.ok(stablePayload.summary.semanticTagCount > 0, 'STABLE_ID_CONTEXT_SUMMARY_EMPTY')

  const uuidResponse = await fetch(`${routeServer.baseUrl}/api/live/current/semantic-context?entityId=${encodeURIComponent(sample.id)}&ruleCheckLimit=5`)
  const uuidPayload = await uuidResponse.json()
  assert.equal(uuidResponse.status, 200, `UUID_CONTEXT_STATUS:${uuidResponse.status}:${uuidPayload.error ?? 'unknown'}`)
  assert.equal(uuidPayload.ok, true, `UUID_CONTEXT_FAILED:${uuidPayload.error ?? 'unknown'}`)
  assert.equal(uuidPayload.entity.id, sample.id, 'UUID_CONTEXT_ENTITY_MISMATCH')
  assert.ok(uuidPayload.summary.semanticClasses.includes(sample.semantic_class_key), 'UUID_CONTEXT_CLASS_MISSING')

  const missingResponse = await fetch(`${routeServer.baseUrl}/api/live/current/entities/not-a-real-entity/semantic-context`)
  const missingPayload = await missingResponse.json()
  assert.equal(missingResponse.status, 404, `MISSING_CONTEXT_STATUS:${missingResponse.status}`)
  assert.equal(missingPayload.error, 'ENTITY_NOT_FOUND', 'MISSING_CONTEXT_ERROR_INVALID')

  console.log(JSON.stringify({
    ok: true,
    cityId,
    sample: {
      id: sample.id,
      stableId: sample.stable_id,
      entityType: sample.entity_type,
      semanticClassKey: sample.semantic_class_key,
    },
    context: {
      semanticTagCount: stablePayload.summary.semanticTagCount,
      sourceEvidenceCount: stablePayload.summary.sourceEvidenceCount,
      ruleCheckCount: stablePayload.summary.ruleCheckCount,
      semanticClasses: stablePayload.summary.semanticClasses,
    },
    routes: [
      '/api/live/:cityId/entities/:entityId/semantic-context',
      '/api/live/current/semantic-context?entityId=...',
    ],
  }, null, 2))
} finally {
  if (routeServer) await routeServer.close()
  await closeProductionPool()
}
