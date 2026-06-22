import pg from 'pg'
import { getProductionDatabaseUrl } from '../db/migrate.mjs'

const { Client } = pg

const DEFAULT_CITY_IDS = ['adazi', 'kharkiv']
const REQUIRED_ENTITY_TYPES = ['building', 'road', 'facility', 'green_blue_system', 'place']

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function cityIdsFromArgs() {
  const cityArg = argValue('city')
  if (!cityArg) return DEFAULT_CITY_IDS
  return cityArg.split(',').map((entry) => entry.trim()).filter(Boolean)
}

const connectionString = getProductionDatabaseUrl()
assert(connectionString, 'DATABASE_URL_REQUIRED')

const cityIds = cityIdsFromArgs()
const client = new Client({ connectionString })
await client.connect()

try {
  const summaries = []

  for (const cityId of cityIds) {
    const city = await client.query('SELECT id, name FROM ldt_core.cities WHERE id = $1', [cityId])
    assert(city.rowCount === 1, `LDT_CITY_MISSING:${cityId}`)

    const entityCounts = await client.query(
      `
        SELECT entity_type, count(*)::int AS count
        FROM ldt_core.city_entities
        WHERE city_id = $1
          AND properties->>'phase' = 'phase-3-consolidation'
        GROUP BY entity_type
      `,
      [cityId],
    )
    const countByType = new Map(entityCounts.rows.map((row) => [row.entity_type, row.count]))
    for (const entityType of REQUIRED_ENTITY_TYPES) {
      assert((countByType.get(entityType) ?? 0) > 0, `CONSOLIDATED_ENTITY_TYPE_MISSING:${cityId}:${entityType}`)
    }

    const evidence = await client.query(
      `
        SELECT count(*)::int AS count
        FROM ldt_prov.entity_source_evidence ese
        JOIN ldt_core.city_entities ce ON ce.id = ese.entity_id
        WHERE ce.city_id = $1
          AND ce.properties->>'phase' = 'phase-3-consolidation'
      `,
      [cityId],
    )
    assert(evidence.rows[0].count > 0, `ENTITY_EVIDENCE_MISSING:${cityId}`)

    const overtureEvidence = await client.query(
      `
        SELECT
          count(*) FILTER (WHERE ese.evidence_role = 'confirms-open-source')::int AS matched,
          count(*) FILTER (WHERE ese.evidence_role = 'primary-open-provider')::int AS unmatched
        FROM ldt_prov.entity_source_evidence ese
        JOIN ldt_core.city_entities ce ON ce.id = ese.entity_id
        JOIN ldt_prov.source_features sf ON sf.id = ese.source_feature_id
        WHERE ce.city_id = $1
          AND ce.properties->>'phase' = 'phase-3-consolidation'
          AND sf.source_layer = 'overture-buildings'
      `,
      [cityId],
    )
    assert(overtureEvidence.rows[0].matched > 0, `OVERTURE_MATCH_EVIDENCE_MISSING:${cityId}`)
    assert(overtureEvidence.rows[0].unmatched > 0, `OVERTURE_UNMATCHED_INVENTORY_MISSING:${cityId}`)

    const matchGroups = await client.query(
      `
        SELECT count(*)::int AS count
        FROM ldt_prov.entity_match_groups
        WHERE city_id = $1
          AND entity_type = 'building'
          AND properties->>'phase' = 'phase-3-consolidation'
      `,
      [cityId],
    )
    assert(matchGroups.rows[0].count > 0, `BUILDING_MATCH_GROUPS_MISSING:${cityId}`)

    const reviewDecisions = await client.query(
      `
        SELECT count(*)::int AS count
        FROM ldt_prov.entity_review_decisions erd
        JOIN ldt_core.city_entities ce ON ce.id = erd.entity_id
        WHERE ce.city_id = $1
          AND ce.properties->>'phase' = 'phase-3-consolidation'
          AND erd.metadata->>'phase' = 'phase-3-consolidation'
      `,
      [cityId],
    )
    assert(reviewDecisions.rows[0].count > 0, `REVIEW_DECISIONS_MISSING:${cityId}`)

    const lineage = await client.query(
      `
        SELECT count(*)::int AS count
        FROM ldt_prov.lineage_events
        WHERE city_id = $1
          AND event_type = 'phase-3-consolidation-run'
          AND event_payload->>'phase' = 'phase-3-consolidation'
      `,
      [cityId],
    )
    assert(lineage.rows[0].count > 0, `CONSOLIDATION_LINEAGE_MISSING:${cityId}`)

    summaries.push({
      cityId,
      name: city.rows[0].name,
      entityCounts: Object.fromEntries([...countByType.entries()].sort(([a], [b]) => a.localeCompare(b))),
      evidenceCount: evidence.rows[0].count,
      overtureEvidence: overtureEvidence.rows[0],
      buildingMatchGroups: matchGroups.rows[0].count,
      reviewDecisions: reviewDecisions.rows[0].count,
      lineageEvents: lineage.rows[0].count,
    })
  }

  console.log(JSON.stringify({
    ok: true,
    cityCount: summaries.length,
    cities: summaries,
  }, null, 2))
} finally {
  await client.end()
}
