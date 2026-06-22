import { PRODUCT_CAPABILITIES } from '../../tools/product-capability-contract.mjs'
import { normalizeWorkflowRun } from './workflowService.mjs'
import { buildReadinessAssessment } from './readinessAssessment.mjs'
import { countRows, moduleAvailable, withClient } from './dbUtils.mjs'

export async function getCityCapabilityState(cityId) {
  return withClient(async (client) => {
    const cityResult = await client.query(
      `
        SELECT id, name, country, country_code, region, metadata
        FROM ldt_core.cities
        WHERE id = $1
      `,
      [cityId],
    )
    if (cityResult.rowCount === 0) {
      return {
        configured: true,
        ok: false,
        cityId,
        error: 'CITY_NOT_FOUND',
      }
    }

    const datasets = await countRows(client, 'SELECT count(*) FROM ldt_catalog.datasets WHERE city_id = $1', [cityId])
    const sourceFeatures = await countRows(client, 'SELECT count(*) FROM ldt_prov.source_features WHERE city_id = $1', [cityId])
    const entities = await countRows(client, 'SELECT count(*) FROM ldt_core.city_entities WHERE city_id = $1', [cityId])
    const ngsiProjections = await countRows(
      client,
      `
        SELECT count(*)
        FROM ldt_interop.ngsi_entity_projections projection
        JOIN ldt_core.city_entities entity ON entity.id = projection.entity_id
        WHERE entity.city_id = $1
      `,
      [cityId],
    )
    const ogcCollections = await countRows(client, 'SELECT count(*) FROM ldt_interop.ogc_collections WHERE city_id = $1', [cityId])
    const viewerSummaries = await countRows(client, 'SELECT count(*) FROM ldt_viewer.city_summary_cache WHERE city_id = $1', [cityId])
    const densityCells = await countRows(client, 'SELECT count(*) FROM ldt_viewer.density_grids WHERE city_id = $1', [cityId])
    const scienceObservations = await countRows(client, 'SELECT count(*) FROM ldt_science.indicator_observations WHERE city_id = $1', [cityId])
    const societyObservations = await countRows(
      client,
      `
        SELECT count(*)
        FROM ldt_society.observations observation
        JOIN ldt_society.observation_series series ON series.id = observation.series_id
        WHERE series.city_id = $1
      `,
      [cityId],
    )
    const semanticPacks = await countRows(client, 'SELECT count(DISTINCT pack_id) FROM ldt_semantic.city_pack_bindings WHERE city_id = $1', [cityId])
    const semanticIndicators = await countRows(client, 'SELECT count(*) FROM ldt_semantic.service_indicators WHERE city_id = $1', [cityId])
    const fiwareConnections = await countRows(client, 'SELECT count(*) FROM ldt_fiware.context_broker_connections')
    const fiwareSyncJobs = await countRows(client, 'SELECT count(*) FROM ldt_fiware.context_sync_jobs WHERE city_id = $1', [cityId])
    const providerLayers = await countRows(client, 'SELECT count(*) FROM public.layer_definitions WHERE city_id = $1', [cityId])
    const ingestionJobs = await countRows(client, 'SELECT count(*) FROM public.layer_ingestion_jobs WHERE city_id = $1', [cityId])
    const apiEvents = await countRows(client, 'SELECT count(*) FROM ldt_ops.api_usage_events WHERE city_id = $1', [cityId])
    const workflowDefinitions = await countRows(client, 'SELECT count(*) FROM ldt_ops.workflow_definitions')
    const workflowRuns = await countRows(client, 'SELECT count(*) FROM ldt_ops.workflow_runs WHERE city_id = $1', [cityId])
    const pendingWorkflowApprovals = await countRows(
      client,
      `
        SELECT count(*)
        FROM ldt_ops.workflow_approvals approval
        JOIN ldt_ops.workflow_runs run ON run.id = approval.run_id
        WHERE run.city_id = $1
          AND approval.status = 'requested'
      `,
      [cityId],
    )

    const entityResult = await client.query(
      `
        SELECT entity_type, count(*)::int AS count
        FROM ldt_core.city_entities
        WHERE city_id = $1
        GROUP BY entity_type
        ORDER BY entity_type
      `,
      [cityId],
    )
    const sourceResult = await client.query(
      `
        SELECT source_layer, count(*)::int AS count
        FROM ldt_prov.source_features
        WHERE city_id = $1
        GROUP BY source_layer
        ORDER BY source_layer
      `,
      [cityId],
    )
    const workflowResult = await client.query(`
      SELECT workflow_key, name, domain, lifecycle_status, default_mode, standards_mapping
      FROM ldt_ops.workflow_definitions
      ORDER BY domain, workflow_key
    `)
    const recentWorkflowRuns = await client.query(
      `
        SELECT run.*, definition.name AS workflow_name
        FROM ldt_ops.workflow_runs run
        LEFT JOIN ldt_ops.workflow_definitions definition ON definition.id = run.workflow_id
        WHERE run.city_id = $1
        ORDER BY run.created_at DESC
        LIMIT 10
      `,
      [cityId],
    )

    const counts = {
      datasets,
      sourceFeatures,
      entities,
      ngsiProjections,
      ogcCollections,
      viewerSummaries,
      densityCells,
      scienceObservations,
      societyObservations,
      semanticPacks,
      semanticIndicators,
      fiwareConnections,
      fiwareSyncJobs,
      providerLayers,
      ingestionJobs,
      apiEvents,
      workflowDefinitions,
      workflowRuns,
      pendingWorkflowApprovals,
    }
    const entityCounts = Object.fromEntries(entityResult.rows.map((row) => [row.entity_type, row.count]))
    const sourceLayerCounts = Object.fromEntries(sourceResult.rows.map((row) => [row.source_layer, row.count]))
    const workflowRunsList = recentWorkflowRuns.rows.map(normalizeWorkflowRun)
    const readinessAssessment = buildReadinessAssessment({
      cityId,
      counts,
      entityCounts,
      sourceLayerCounts,
      recentWorkflowRuns: workflowRunsList,
    })

    return {
      configured: true,
      ok: true,
      city: cityResult.rows[0],
      cityId,
      generatedAt: new Date().toISOString(),
      readiness: readinessAssessment.readiness,
      readinessChecks: readinessAssessment.checks,
      readinessGaps: readinessAssessment.gaps,
      readinessSummary: readinessAssessment.summary,
      modules: {
        baseInventory: moduleAvailable(entities),
        catalog: moduleAvailable(datasets),
        provenance: moduleAvailable(sourceFeatures),
        interop: moduleAvailable(ngsiProjections) || moduleAvailable(ogcCollections),
        fiware: moduleAvailable(fiwareConnections) || moduleAvailable(fiwareSyncJobs),
        viewerAggregates: moduleAvailable(viewerSummaries) || moduleAvailable(densityCells),
        urbanScience: moduleAvailable(scienceObservations),
        societyCulture: moduleAvailable(societyObservations),
        semanticPacks: moduleAvailable(semanticIndicators) || moduleAvailable(semanticPacks),
        providerLayers: moduleAvailable(providerLayers) || moduleAvailable(ingestionJobs),
        agenticWorkflows: moduleAvailable(workflowDefinitions),
        apiObservability: moduleAvailable(apiEvents),
      },
      counts,
      productCapabilities: PRODUCT_CAPABILITIES,
      entityCounts,
      sourceLayerCounts,
      workflows: workflowResult.rows.map((row) => ({
        workflowKey: row.workflow_key,
        name: row.name,
        domain: row.domain,
        lifecycleStatus: row.lifecycle_status,
        defaultMode: row.default_mode,
        standardsMapping: row.standards_mapping,
      })),
      workflowRuns: workflowRunsList,
      error: null,
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    cityId,
    error: String(error?.message ?? 'CITY_CAPABILITIES_UNAVAILABLE'),
  }))
}
