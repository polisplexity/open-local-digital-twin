import pg from 'pg'
import { getProductionDatabaseUrl } from '../db/migrate.mjs'

const { Client } = pg

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const connectionString = getProductionDatabaseUrl()
assert(connectionString, 'DATABASE_URL_REQUIRED')

const client = new Client({ connectionString })
await client.connect()

try {
  const requiredSchemas = [
    'ldt_core',
    'ldt_catalog',
    'ldt_prov',
    'ldt_interop',
    'ldt_fiware',
    'ldt_science',
    'ldt_society',
    'ldt_viewer',
    'ldt_environment',
    'ldt_semantic',
    'ldt_query',
    'legacy',
  ]

  const schemaResult = await client.query(
    `
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = ANY($1::text[])
      ORDER BY schema_name
    `,
    [requiredSchemas],
  )
  const foundSchemas = new Set(schemaResult.rows.map((row) => row.schema_name))
  for (const schema of requiredSchemas) {
    assert(foundSchemas.has(schema), `SCHEMA_MISSING:${schema}`)
  }

  const expectedTables = [
    ['ldt_core', 'entity_type_registry'],
    ['ldt_core', 'identifier_namespaces'],
    ['ldt_core', 'entity_identifiers'],
    ['ldt_catalog', 'datasets'],
    ['ldt_catalog', 'dataset_distributions'],
    ['ldt_catalog', 'dataset_licenses'],
    ['ldt_catalog', 'dataset_spatial_extents'],
    ['ldt_catalog', 'dataset_temporal_extents'],
    ['ldt_prov', 'source_features'],
    ['ldt_prov', 'entity_source_evidence'],
    ['ldt_prov', 'entity_match_groups'],
    ['ldt_prov', 'entity_match_group_members'],
    ['ldt_prov', 'entity_review_decisions'],
    ['ldt_prov', 'lineage_events'],
    ['ldt_semantic', 'pack_registry'],
    ['ldt_semantic', 'pack_rules'],
    ['ldt_semantic', 'city_pack_bindings'],
    ['ldt_semantic', 'service_indicators'],
    ['ldt_semantic', 'service_features'],
    ['ldt_semantic', 'service_workflows'],
    ['ldt_semantic', 'pack_exports'],
    ['ldt_environment', 'phenomenon_layers'],
    ['ldt_environment', 'phenomenon_cells'],
    ['ldt_environment', 'object_observations'],
    ['ldt_environment', 'object_observation_summary'],
    ['ldt_environment', 'extractor_definitions'],
    ['ldt_environment', 'extractor_runs'],
    ['ldt_environment', 'extractor_artifacts'],
    ['ldt_environment', 'extractor_run_status'],
    ['ldt_query', 'city_objects'],
  ]

  const tableResult = await client.query(
    `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema = ANY($1::text[])
    `,
    [requiredSchemas],
  )
  const foundTables = new Set(tableResult.rows.map((row) => `${row.table_schema}.${row.table_name}`))
  for (const [schema, table] of expectedTables) {
    assert(foundTables.has(`${schema}.${table}`), `TABLE_MISSING:${schema}.${table}`)
  }

  const entityTypes = await client.query(`
    SELECT entity_type
    FROM ldt_core.entity_type_registry
    WHERE entity_type IN (
      'building',
      'road',
      'facility',
      'place',
      'land_use',
      'green_blue_system',
      'mobility_asset',
      'sensor',
      'cultural_asset',
      'simulation_object'
    )
  `)
  assert(entityTypes.rowCount === 10, `ENTITY_TYPE_REGISTRY_INCOMPLETE:${entityTypes.rowCount}`)

  const namespaces = await client.query(`
    SELECT namespace_key
    FROM ldt_core.identifier_namespaces
    WHERE namespace_key IN (
      'city',
      'entity',
      'source_feature',
      'dataset',
      'indicator',
      'scenario',
      'fiware_ngsi'
    )
  `)
  assert(namespaces.rowCount === 7, `IDENTIFIER_NAMESPACE_REGISTRY_INCOMPLETE:${namespaces.rowCount}`)

  await client.query('BEGIN')
  const cityId = `ldt-smoke-${Date.now()}`
  try {
    await client.query(
      `
        INSERT INTO ldt_core.cities (id, name, country, country_code, region, canonical_uri)
        VALUES ($1, 'LDT Smoke City', 'Testland', 'TS', 'Test Region', $2)
      `,
      [cityId, `urn:polisplexity:ldt:city:${cityId}`],
    )

    const dataset = await client.query(
      `
        INSERT INTO ldt_catalog.datasets (
          city_id,
          identifier,
          title,
          description,
          publisher,
          license,
          access_rights
        )
        VALUES ($1, $2, 'Smoke dataset', 'Verifies Phase 1 primitives.', 'Twin Base Studio', 'ODbL-1.0', 'public')
        RETURNING id
      `,
      [cityId, `smoke:${cityId}:osm-buildings`],
    )

    await client.query(
      `
        INSERT INTO ldt_catalog.dataset_licenses (
          dataset_id,
          license_name,
          spdx_id,
          attribution_required,
          share_alike_required
        )
        VALUES ($1, 'Open Database License 1.0', 'ODbL-1.0', true, true)
      `,
      [dataset.rows[0].id],
    )

    const activity = await client.query(
      `
        INSERT INTO ldt_prov.activities (city_id, activity_type, status, metadata)
        VALUES ($1, 'smoke-test', 'completed', '{"phase":"1"}'::jsonb)
        RETURNING id
      `,
      [cityId],
    )

    const source = await client.query(
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
        VALUES (
          $1,
          $2,
          $3,
          'source-building-1',
          'osm-buildings',
          'open-data',
          ST_SetSRID(ST_MakePoint(0, 0), 4326),
          '{"building":"yes"}'::jsonb
        )
        RETURNING id
      `,
      [cityId, dataset.rows[0].id, activity.rows[0].id],
    )

    const entity = await client.query(
      `
        INSERT INTO ldt_core.city_entities (
          city_id,
          stable_id,
          entity_type,
          label,
          canonical_uri,
          authority_status,
          confidence,
          geom,
          properties
        )
        VALUES (
          $1,
          'building:smoke:1',
          'building',
          'Smoke building',
          $2,
          'open-data',
          'source-evidence',
          ST_SetSRID(ST_MakePoint(0, 0), 4326),
          '{"test":true}'::jsonb
        )
        RETURNING id
      `,
      [cityId, `urn:polisplexity:ldt:${cityId}:entity:building:smoke:1`],
    )

    await client.query(
      `
        INSERT INTO ldt_core.building_entities (entity_id, building_type, footprint_area_m2)
        VALUES ($1, 'yes', 42)
      `,
      [entity.rows[0].id],
    )

    await client.query(
      `
        INSERT INTO ldt_prov.entity_source_evidence (
          entity_id,
          source_feature_id,
          evidence_role,
          match_score,
          confidence
        )
        VALUES ($1, $2, 'supports', 1.0, 'direct-source')
      `,
      [entity.rows[0].id, source.rows[0].id],
    )

    const matchGroup = await client.query(
      `
        INSERT INTO ldt_prov.entity_match_groups (
          city_id,
          group_key,
          entity_type,
          match_method,
          status,
          confidence
        )
        VALUES ($1, 'smoke-building-group-1', 'building', 'smoke-exact', 'accepted', 'direct-source')
        RETURNING id
      `,
      [cityId],
    )

    await client.query(
      `
        INSERT INTO ldt_prov.entity_match_group_members (
          match_group_id,
          source_feature_id,
          entity_id,
          member_role,
          match_score
        )
        VALUES ($1, $2, $3, 'accepted-member', 1.0)
      `,
      [matchGroup.rows[0].id, source.rows[0].id, entity.rows[0].id],
    )

    await client.query(
      `
        INSERT INTO ldt_prov.entity_review_decisions (
          entity_id,
          decision,
          authority_status,
          decided_by,
          rationale
        )
        VALUES ($1, 'accepted', 'open-data', 'ldt-schema-smoke', 'Smoke test review primitive.')
      `,
      [entity.rows[0].id],
    )

    await client.query(
      `
        INSERT INTO ldt_prov.lineage_events (
          city_id,
          subject_entity_id,
          source_feature_id,
          activity_id,
          event_type,
          event_payload
        )
        VALUES ($1, $2, $3, $4, 'entity-created-from-source', '{"test":true}'::jsonb)
      `,
      [cityId, entity.rows[0].id, source.rows[0].id, activity.rows[0].id],
    )
  } finally {
    await client.query('ROLLBACK')
  }

  console.log(JSON.stringify({
    ok: true,
    schemas: requiredSchemas.length,
    expectedTables: expectedTables.length,
    canonicalEntityTypes: entityTypes.rowCount,
    identifierNamespaces: namespaces.rowCount,
    smokeDml: 'passed-with-rollback',
  }, null, 2))
} finally {
  await client.end()
}
