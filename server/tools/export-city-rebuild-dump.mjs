import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import { getProductionDatabaseUrl } from '../db/migrate.mjs'

const { Pool } = pg

const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => {
      const [key, ...valueParts] = arg.slice(2).split('=')
      return [key, valueParts.join('=') || '1']
    }),
)

const cityId = String(args.get('city') ?? args.get('cityId') ?? '').trim()
if (!cityId) {
  console.error('Usage: npm run city:export-dump -- --city=adazi')
  process.exit(1)
}

const outputRoot = path.resolve(
  args.get('output') ??
    path.join('/home/hadox/outputs/twin-base-studio/city-dumps', `${cityId}-${new Date().toISOString().replace(/[:.]/g, '-')}`),
)

const cityScopedTables = [
  'ldt_catalog.datasets',
  'ldt_core.asset_relationships',
  'ldt_core.city_boundaries',
  'ldt_core.city_entities',
  'ldt_fiware.context_sync_jobs',
  'ldt_interop.dcat_exports',
  'ldt_interop.ldes_event_streams',
  'ldt_interop.ogc_collections',
  'ldt_ops.api_usage_events',
  'ldt_ops.workflow_artifacts',
  'ldt_ops.workflow_runs',
  'ldt_prov.activities',
  'ldt_prov.entity_match_groups',
  'ldt_prov.lineage_events',
  'ldt_prov.source_features',
  'ldt_science.indicator_observations',
  'ldt_science.model_calibrations',
  'ldt_science.network_layers',
  'ldt_science.network_metrics',
  'ldt_science.scaling_residuals',
  'ldt_science.scenario_inputs',
  'ldt_science.scenario_outputs',
  'ldt_science.simulation_runs',
  'ldt_semantic.city_pack_bindings',
  'ldt_semantic.pack_exports',
  'ldt_semantic.review_decisions',
  'ldt_semantic.service_features',
  'ldt_semantic.service_indicators',
  'ldt_semantic.service_workflows',
  'ldt_society.cultural_assets',
  'ldt_society.domain_profiles',
  'ldt_society.equity_gap_results',
  'ldt_society.observation_series',
  'ldt_society.participation_events',
  'ldt_society.social_vulnerability_scores',
  'ldt_viewer.city_summary_cache',
  'ldt_viewer.density_grids',
  'public.city_boundaries',
  'public.city_features',
  'public.dataset_catalog_records',
  'public.ingestion_runs',
  'public.ingestion_validation_reports',
  'public.layer_definitions',
  'public.layer_ingestion_jobs',
  'public.semantic_features',
  'public.semantic_layers',
  'public.source_artifacts',
  'public.source_features_raw',
  'public.viewer_cache_entries',
]

const referenceTables = [
  'ldt_core.entity_type_registry',
  'ldt_core.identifier_namespaces',
  'ldt_fiware.context_broker_connections',
  'ldt_fiware.context_broker_subscriptions',
  'ldt_interop.jsonld_contexts',
  'ldt_interop.ngsi_entity_mappings',
  'ldt_interop.odrl_policies',
  'ldt_ops.workflow_definitions',
  'ldt_prov.agents',
  'ldt_science.indicator_definitions',
  'ldt_science.scaling_model_definitions',
  'ldt_science.scaling_model_fits',
  'ldt_science.scenario_definitions',
  'ldt_science.simulation_models',
  'ldt_semantic.pack_registry',
  'ldt_society.privacy_policies',
  'ldt_society.source_quality_rules',
]

const linkedQueries = [
  {
    table: 'ldt_catalog.dataset_distributions',
    sql: `
      SELECT child.*
      FROM ldt_catalog.dataset_distributions child
      JOIN ldt_catalog.datasets dataset ON dataset.id = child.dataset_id
      WHERE dataset.city_id = $1
    `,
  },
  {
    table: 'ldt_catalog.dataset_licenses',
    sql: `
      SELECT child.*
      FROM ldt_catalog.dataset_licenses child
      JOIN ldt_catalog.datasets dataset ON dataset.id = child.dataset_id
      WHERE dataset.city_id = $1
    `,
  },
  {
    table: 'ldt_catalog.dataset_quality_reports',
    sql: `
      SELECT child.*
      FROM ldt_catalog.dataset_quality_reports child
      JOIN ldt_catalog.datasets dataset ON dataset.id = child.dataset_id
      WHERE dataset.city_id = $1
    `,
  },
  {
    table: 'ldt_catalog.dataset_spatial_extents',
    sql: `
      SELECT child.*
      FROM ldt_catalog.dataset_spatial_extents child
      JOIN ldt_catalog.datasets dataset ON dataset.id = child.dataset_id
      WHERE dataset.city_id = $1
    `,
  },
  {
    table: 'ldt_catalog.dataset_temporal_extents',
    sql: `
      SELECT child.*
      FROM ldt_catalog.dataset_temporal_extents child
      JOIN ldt_catalog.datasets dataset ON dataset.id = child.dataset_id
      WHERE dataset.city_id = $1
    `,
  },
  {
    table: 'ldt_core.building_entities',
    sql: `
      SELECT child.*
      FROM ldt_core.building_entities child
      JOIN ldt_core.city_entities entity ON entity.id = child.entity_id
      WHERE entity.city_id = $1
    `,
  },
  {
    table: 'ldt_core.entity_identifiers',
    sql: `
      SELECT child.*
      FROM ldt_core.entity_identifiers child
      JOIN ldt_core.city_entities entity ON entity.id = child.entity_id
      WHERE entity.city_id = $1
    `,
  },
  {
    table: 'ldt_core.facility_entities',
    sql: `
      SELECT child.*
      FROM ldt_core.facility_entities child
      JOIN ldt_core.city_entities entity ON entity.id = child.entity_id
      WHERE entity.city_id = $1
    `,
  },
  {
    table: 'ldt_core.green_blue_entities',
    sql: `
      SELECT child.*
      FROM ldt_core.green_blue_entities child
      JOIN ldt_core.city_entities entity ON entity.id = child.entity_id
      WHERE entity.city_id = $1
    `,
  },
  {
    table: 'ldt_core.land_use_entities',
    sql: `
      SELECT child.*
      FROM ldt_core.land_use_entities child
      JOIN ldt_core.city_entities entity ON entity.id = child.entity_id
      WHERE entity.city_id = $1
    `,
  },
  {
    table: 'ldt_core.mobility_entities',
    sql: `
      SELECT child.*
      FROM ldt_core.mobility_entities child
      JOIN ldt_core.city_entities entity ON entity.id = child.entity_id
      WHERE entity.city_id = $1
    `,
  },
  {
    table: 'ldt_core.place_entities',
    sql: `
      SELECT child.*
      FROM ldt_core.place_entities child
      JOIN ldt_core.city_entities entity ON entity.id = child.entity_id
      WHERE entity.city_id = $1
    `,
  },
  {
    table: 'ldt_core.road_entities',
    sql: `
      SELECT child.*
      FROM ldt_core.road_entities child
      JOIN ldt_core.city_entities entity ON entity.id = child.entity_id
      WHERE entity.city_id = $1
    `,
  },
  {
    table: 'ldt_interop.ngsi_entity_projections',
    sql: `
      SELECT projection.*
      FROM ldt_interop.ngsi_entity_projections projection
      JOIN ldt_core.city_entities entity ON entity.id = projection.entity_id
      WHERE entity.city_id = $1
    `,
  },
  {
    table: 'ldt_fiware.context_projection_state',
    sql: `
      SELECT state.*
      FROM ldt_fiware.context_projection_state state
      JOIN ldt_core.city_entities entity ON entity.id = state.entity_id
      WHERE entity.city_id = $1
    `,
  },
  {
    table: 'ldt_fiware.context_observations',
    sql: `
      SELECT observation.*
      FROM ldt_fiware.context_observations observation
      JOIN ldt_core.city_entities entity ON entity.id = observation.entity_id
      WHERE entity.city_id = $1
    `,
  },
  {
    table: 'ldt_ops.workflow_steps',
    sql: `
      SELECT step.*
      FROM ldt_ops.workflow_steps step
      JOIN ldt_ops.workflow_runs run ON run.id = step.run_id
      WHERE run.city_id = $1
    `,
  },
  {
    table: 'ldt_ops.workflow_approvals',
    sql: `
      SELECT approval.*
      FROM ldt_ops.workflow_approvals approval
      JOIN ldt_ops.workflow_runs run ON run.id = approval.run_id
      WHERE run.city_id = $1
    `,
  },
  {
    table: 'ldt_prov.entity_match_group_members',
    sql: `
      SELECT member.*
      FROM ldt_prov.entity_match_group_members member
      JOIN ldt_prov.entity_match_groups match_group ON match_group.id = member.match_group_id
      WHERE match_group.city_id = $1
    `,
  },
  {
    table: 'ldt_prov.entity_review_decisions',
    sql: `
      SELECT review.*
      FROM ldt_prov.entity_review_decisions review
      JOIN ldt_core.city_entities entity ON entity.id = review.entity_id
      WHERE entity.city_id = $1
    `,
  },
  {
    table: 'ldt_prov.entity_source_evidence',
    sql: `
      SELECT evidence.*
      FROM ldt_prov.entity_source_evidence evidence
      JOIN ldt_core.city_entities entity ON entity.id = evidence.entity_id
      WHERE entity.city_id = $1
    `,
  },
  {
    table: 'ldt_science.indicator_quality',
    sql: `
      SELECT quality.*
      FROM ldt_science.indicator_quality quality
      JOIN ldt_science.indicator_observations observation ON observation.id = quality.observation_id
      WHERE observation.city_id = $1
    `,
  },
  {
    table: 'ldt_semantic.pack_rules',
    sql: `
      SELECT DISTINCT rule.*
      FROM ldt_semantic.pack_rules rule
      JOIN ldt_semantic.city_pack_bindings binding ON binding.pack_id = rule.pack_id
      WHERE binding.city_id = $1
    `,
  },
  {
    table: 'ldt_society.observations',
    sql: `
      SELECT observation.*
      FROM ldt_society.observations observation
      JOIN ldt_society.observation_series series ON series.id = observation.series_id
      WHERE series.city_id = $1
    `,
  },
]

function tableFileName(table) {
  return `${table.replace('.', '__')}.jsonl`
}

async function writeRows(filePath, rows) {
  const body = rows.map((row) => JSON.stringify(row)).join('\n')
  await fs.writeFile(filePath, body ? `${body}\n` : '')
}

async function exportQuery(client, table, sql, params, tablesDir) {
  const result = await client.query(sql, params)
  await writeRows(path.join(tablesDir, tableFileName(table)), result.rows)
  return {
    table,
    file: `tables/${tableFileName(table)}`,
    rows: result.rowCount,
  }
}

async function main() {
  const connectionString = getProductionDatabaseUrl()
  if (!connectionString) throw new Error('DATABASE_URL_REQUIRED')

  const pool = new Pool({ connectionString, max: 2 })
  const client = await pool.connect()
  try {
    const city = await client.query('SELECT * FROM ldt_core.cities WHERE id = $1', [cityId])
    if (city.rowCount === 0) throw new Error(`CITY_NOT_FOUND:${cityId}`)

    const tablesDir = path.join(outputRoot, 'tables')
    await fs.mkdir(tablesDir, { recursive: true })

    const exports = []
    exports.push(await exportQuery(client, 'ldt_core.cities', 'SELECT * FROM ldt_core.cities WHERE id = $1', [cityId], tablesDir))

    for (const table of cityScopedTables) {
      exports.push(await exportQuery(client, table, `SELECT * FROM ${table} WHERE city_id = $1`, [cityId], tablesDir))
    }

    for (const query of linkedQueries) {
      exports.push(await exportQuery(client, query.table, query.sql, [cityId], tablesDir))
    }

    for (const table of referenceTables) {
      exports.push(await exportQuery(client, table, `SELECT * FROM ${table}`, [], tablesDir))
    }

    const entityCounts = await client.query(
      `
        SELECT entity_type, count(*)::int AS count
        FROM ldt_core.city_entities
        WHERE city_id = $1
        GROUP BY entity_type
        ORDER BY entity_type
      `,
      [cityId],
    )
    const sourceCounts = await client.query(
      `
        SELECT source_layer, count(*)::int AS count
        FROM ldt_prov.source_features
        WHERE city_id = $1
        GROUP BY source_layer
        ORDER BY source_layer
      `,
      [cityId],
    )

    const manifest = {
      kind: 'twin-base-studio-city-rebuild-dump',
      version: 1,
      cityId,
      city: city.rows[0],
      exportedAt: new Date().toISOString(),
      outputRoot,
      format: 'jsonl-per-table',
      note: 'City-scoped reconstruction bundle. Restore into a compatible LDT schema with an importer that respects table dependencies and existing reference rows.',
      counts: {
        tables: exports.length,
        rows: exports.reduce((total, entry) => total + entry.rows, 0),
        entityCounts: Object.fromEntries(entityCounts.rows.map((row) => [row.entity_type, row.count])),
        sourceLayerCounts: Object.fromEntries(sourceCounts.rows.map((row) => [row.source_layer, row.count])),
      },
      exports,
    }

    await fs.writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    await fs.writeFile(
      path.join(outputRoot, 'README.md'),
      `# ${cityId} LDT Rebuild Dump

This package preserves the city-specific LDT state for ${city.rows[0].name}.

- City: ${city.rows[0].name}
- Country: ${city.rows[0].country}
- Exported at: ${manifest.exportedAt}
- Format: JSONL per table
- Tables: ${manifest.counts.tables}
- Rows: ${manifest.counts.rows}

Use this as a reconstruction source for the Latvia/Ādaži validation case while the active demo is narrowed to Kharkiv.

It is intentionally stored outside the application repo under \`/home/hadox/outputs\`.
`,
    )

    console.log(JSON.stringify({
      ok: true,
      cityId,
      outputRoot,
      tables: manifest.counts.tables,
      rows: manifest.counts.rows,
      entityCounts: manifest.counts.entityCounts,
    }, null, 2))
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
