import { withClient } from './dbUtils.mjs'

export async function getCityMetricsSummary(cityId) {
  return withClient(async (client) => {
    const cityResult = await client.query(
      `
        SELECT id, name, country, country_code, region
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

    const apiWindow = await client.query(
      `
        SELECT
          count(*)::int AS total_events,
          count(*) FILTER (WHERE status_code < 400)::int AS success_events,
          count(*) FILTER (WHERE status_code BETWEEN 400 AND 499)::int AS client_errors,
          count(*) FILTER (WHERE status_code >= 500)::int AS server_errors,
          count(*) FILTER (WHERE status_code >= 400)::int AS error_events,
          count(DISTINCT route_family)::int AS active_route_families,
          count(DISTINCT method)::int AS active_methods,
          round(avg(latency_ms)::numeric, 1)::float AS avg_latency_ms,
          round(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::numeric, 1)::float AS p95_latency_ms,
          max(created_at) AS latest_event_at
        FROM ldt_ops.api_usage_events
        WHERE (city_id = $1 OR city_id IS NULL)
          AND created_at >= now() - interval '24 hours'
      `,
      [cityId],
    )

    const byFamily = await client.query(
      `
        SELECT
          route_family,
          count(*)::int AS events,
          count(*) FILTER (WHERE status_code >= 400)::int AS errors,
          round(avg(latency_ms)::numeric, 1)::float AS avg_latency_ms,
          round(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::numeric, 1)::float AS p95_latency_ms,
          max(created_at) AS latest_event_at
        FROM ldt_ops.api_usage_events
        WHERE (city_id = $1 OR city_id IS NULL)
          AND created_at >= now() - interval '24 hours'
        GROUP BY route_family
        ORDER BY events DESC, route_family ASC
        LIMIT 20
      `,
      [cityId],
    )

    const slowRoutes = await client.query(
      `
        SELECT
          method,
          path_template,
          count(*)::int AS events,
          round(avg(latency_ms)::numeric, 1)::float AS avg_latency_ms,
          round(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::numeric, 1)::float AS p95_latency_ms,
          max(created_at) AS latest_event_at
        FROM ldt_ops.api_usage_events
        WHERE (city_id = $1 OR city_id IS NULL)
          AND created_at >= now() - interval '24 hours'
          AND latency_ms IS NOT NULL
        GROUP BY method, path_template
        HAVING count(*) > 0
        ORDER BY p95_latency_ms DESC NULLS LAST, avg_latency_ms DESC NULLS LAST
        LIMIT 8
      `,
      [cityId],
    )

    const failingRoutes = await client.query(
      `
        SELECT
          method,
          path_template,
          count(*) FILTER (WHERE status_code >= 400)::int AS errors,
          count(*)::int AS events,
          max(status_code)::int AS last_status_code,
          max(created_at) AS latest_event_at
        FROM ldt_ops.api_usage_events
        WHERE (city_id = $1 OR city_id IS NULL)
          AND created_at >= now() - interval '24 hours'
        GROUP BY method, path_template
        HAVING count(*) FILTER (WHERE status_code >= 400) > 0
        ORDER BY errors DESC, latest_event_at DESC
        LIMIT 8
      `,
      [cityId],
    )

    const ingestion = await client.query(
      `
        SELECT
          count(*)::int AS total_jobs,
          count(*) FILTER (WHERE status IN ('queued', 'running'))::int AS active_jobs,
          count(*) FILTER (WHERE status IN ('failed', 'error'))::int AS failed_jobs,
          count(*) FILTER (WHERE status IN ('succeeded', 'completed', 'registered'))::int AS succeeded_jobs,
          max(updated_at) AS latest_job_at
        FROM public.layer_ingestion_jobs
        WHERE city_id = $1
      `,
      [cityId],
    )

    const ingestionByStatus = await client.query(
      `
        SELECT status, count(*)::int AS jobs
        FROM public.layer_ingestion_jobs
        WHERE city_id = $1
        GROUP BY status
        ORDER BY jobs DESC, status ASC
      `,
      [cityId],
    )

    const workflows = await client.query(
      `
        SELECT
          count(*)::int AS total_runs,
          count(*) FILTER (WHERE status IN ('queued', 'running'))::int AS active_runs,
          count(*) FILTER (WHERE status IN ('failed', 'error'))::int AS failed_runs,
          count(*) FILTER (WHERE status = 'approval_required')::int AS approval_required_runs,
          max(updated_at) AS latest_run_at
        FROM ldt_ops.workflow_runs
        WHERE city_id = $1
      `,
      [cityId],
    )

    const workflowByStatus = await client.query(
      `
        SELECT status, count(*)::int AS runs
        FROM ldt_ops.workflow_runs
        WHERE city_id = $1
        GROUP BY status
        ORDER BY runs DESC, status ASC
      `,
      [cityId],
    )

    const pendingApprovals = await client.query(
      `
        SELECT count(*)::int AS pending_approvals
        FROM ldt_ops.workflow_approvals approval
        JOIN ldt_ops.workflow_runs run ON run.id = approval.run_id
        WHERE run.city_id = $1
          AND approval.status = 'requested'
      `,
      [cityId],
    )

    const inventory = await client.query(
      `
        SELECT
          (SELECT count(*) FROM ldt_core.city_entities WHERE city_id = $1)::int AS city_entities,
          (SELECT count(*) FROM ldt_catalog.datasets WHERE city_id = $1)::int AS catalog_datasets,
          (SELECT count(*) FROM ldt_prov.source_features WHERE city_id = $1)::int AS source_features,
          (SELECT count(*) FROM ldt_interop.ogc_collections WHERE city_id = $1)::int AS ogc_collections,
          (SELECT count(*) FROM ldt_science.indicator_observations WHERE city_id = $1)::int AS analysis_indicators
      `,
      [cityId],
    )

    const api = apiWindow.rows[0] ?? {}
    const ingestionRow = ingestion.rows[0] ?? {}
    const workflowRow = workflows.rows[0] ?? {}
    const pending = pendingApprovals.rows[0] ?? {}
    const inventoryRow = inventory.rows[0] ?? {}
    const totalEvents = Number(api.total_events ?? 0)
    const errorEvents = Number(api.error_events ?? 0)
    const activeIngestionJobs = Number(ingestionRow.active_jobs ?? 0)
    const failedIngestionJobs = Number(ingestionRow.failed_jobs ?? 0)
    const activeWorkflowRuns = Number(workflowRow.active_runs ?? 0)
    const failedWorkflowRuns = Number(workflowRow.failed_runs ?? 0)
    const approvals = Number(pending.pending_approvals ?? 0)

    return {
      configured: true,
      ok: true,
      city: cityResult.rows[0],
      cityId,
      generatedAt: new Date().toISOString(),
      posture: {
        mode: 'core-json-observability',
        requiredServices: ['application', 'postgis'],
        optionalPacks: ['prometheus', 'grafana'],
        note: 'The open-source core exposes JSON metrics from PostGIS. Prometheus and Grafana can be added as an optional operator pack, not as a mandatory city dependency.',
      },
      windows: {
        apiRecentHours: 24,
      },
      api: {
        totalEvents,
        successEvents: Number(api.success_events ?? 0),
        clientErrors: Number(api.client_errors ?? 0),
        serverErrors: Number(api.server_errors ?? 0),
        errorEvents,
        errorRate: totalEvents ? Number(((errorEvents / totalEvents) * 100).toFixed(1)) : 0,
        activeRouteFamilies: Number(api.active_route_families ?? 0),
        activeMethods: Number(api.active_methods ?? 0),
        avgLatencyMs: api.avg_latency_ms === null ? null : Number(api.avg_latency_ms ?? 0),
        p95LatencyMs: api.p95_latency_ms === null ? null : Number(api.p95_latency_ms ?? 0),
        latestEventAt: api.latest_event_at,
      },
      byFamily: byFamily.rows.map((row) => ({
        routeFamily: row.route_family,
        events: Number(row.events ?? 0),
        errors: Number(row.errors ?? 0),
        errorRate: Number(row.events ?? 0) ? Number(((Number(row.errors ?? 0) / Number(row.events ?? 0)) * 100).toFixed(1)) : 0,
        avgLatencyMs: row.avg_latency_ms === null ? null : Number(row.avg_latency_ms ?? 0),
        p95LatencyMs: row.p95_latency_ms === null ? null : Number(row.p95_latency_ms ?? 0),
        latestEventAt: row.latest_event_at,
      })),
      slowRoutes: slowRoutes.rows.map((row) => ({
        method: row.method,
        pathTemplate: row.path_template,
        events: Number(row.events ?? 0),
        avgLatencyMs: row.avg_latency_ms === null ? null : Number(row.avg_latency_ms ?? 0),
        p95LatencyMs: row.p95_latency_ms === null ? null : Number(row.p95_latency_ms ?? 0),
        latestEventAt: row.latest_event_at,
      })),
      failingRoutes: failingRoutes.rows.map((row) => ({
        method: row.method,
        pathTemplate: row.path_template,
        events: Number(row.events ?? 0),
        errors: Number(row.errors ?? 0),
        lastStatusCode: Number(row.last_status_code ?? 0),
        latestEventAt: row.latest_event_at,
      })),
      ingestion: {
        totalJobs: Number(ingestionRow.total_jobs ?? 0),
        activeJobs: activeIngestionJobs,
        failedJobs: failedIngestionJobs,
        succeededJobs: Number(ingestionRow.succeeded_jobs ?? 0),
        latestJobAt: ingestionRow.latest_job_at,
        byStatus: ingestionByStatus.rows.map((row) => ({
          status: row.status,
          jobs: Number(row.jobs ?? 0),
        })),
      },
      workflows: {
        totalRuns: Number(workflowRow.total_runs ?? 0),
        activeRuns: activeWorkflowRuns,
        failedRuns: failedWorkflowRuns,
        approvalRequiredRuns: Number(workflowRow.approval_required_runs ?? 0),
        pendingApprovals: approvals,
        latestRunAt: workflowRow.latest_run_at,
        byStatus: workflowByStatus.rows.map((row) => ({
          status: row.status,
          runs: Number(row.runs ?? 0),
        })),
      },
      inventory: {
        cityEntities: Number(inventoryRow.city_entities ?? 0),
        catalogDatasets: Number(inventoryRow.catalog_datasets ?? 0),
        sourceFeatures: Number(inventoryRow.source_features ?? 0),
        ogcCollections: Number(inventoryRow.ogc_collections ?? 0),
        analysisIndicators: Number(inventoryRow.analysis_indicators ?? 0),
      },
      readiness: [
        {
          key: 'api-events',
          label: 'API telemetry',
          status: totalEvents > 0 ? 'ready' : 'partial',
          evidence: `${totalEvents} API events in the last 24 hours.`,
        },
        {
          key: 'api-error-rate',
          label: 'API error rate',
          status: totalEvents === 0 || errorEvents / Math.max(totalEvents, 1) <= 0.05 ? 'ready' : 'partial',
          evidence: `${totalEvents ? Number(((errorEvents / totalEvents) * 100).toFixed(1)) : 0}% error rate in the last 24 hours.`,
        },
        {
          key: 'ingestion-queue',
          label: 'Ingestion queue',
          status: failedIngestionJobs === 0 ? 'ready' : 'partial',
          evidence: `${activeIngestionJobs} active jobs and ${failedIngestionJobs} failed jobs.`,
        },
        {
          key: 'workflow-control',
          label: 'Workflow control',
          status: failedWorkflowRuns === 0 ? 'ready' : 'partial',
          evidence: `${activeWorkflowRuns} active workflow runs, ${failedWorkflowRuns} failed, and ${approvals} pending approvals.`,
        },
      ],
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    cityId,
    error: String(error?.message ?? 'CITY_METRICS_SUMMARY_UNAVAILABLE'),
  }))
}
