import { API_CATALOG, catalogRow } from './apiCatalog.mjs'
import { normalizeWorkflowRun } from './workflowService.mjs'
import { withClient } from './dbUtils.mjs'

export async function getCityOperationsReport(cityId) {
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

    const apiSummary = await client.query(
      `
        SELECT
          route_family,
          method,
          path_template,
          count(*)::int AS events,
          count(*) FILTER (WHERE status_code >= 400)::int AS errors,
          max(status_code)::int AS last_status_code,
          round(avg(latency_ms)::numeric, 1)::float AS avg_latency_ms,
          max(created_at) AS last_seen_at
        FROM ldt_ops.api_usage_events
        WHERE city_id = $1 OR city_id IS NULL
        GROUP BY route_family, method, path_template
        ORDER BY events DESC, last_seen_at DESC NULLS LAST
        LIMIT 50
      `,
      [cityId],
    )

    const recentApiEvents = await client.query(
      `
        SELECT
          id,
          route_family,
          method,
          path_template,
          status_code,
          latency_ms,
          api_version,
          actor_role,
          error_code,
          created_at
        FROM ldt_ops.api_usage_events
        WHERE city_id = $1 OR city_id IS NULL
        ORDER BY created_at DESC
        LIMIT 20
      `,
      [cityId],
    )

    const ingestionJobs = await client.query(
      `
        SELECT
          job.id,
          job.job_kind,
          job.requested_action,
          job.source_format,
          job.source_uri,
          job.status,
          job.attempt_count,
          job.validation_summary,
          job.stats,
          job.error_message,
          job.created_at,
          job.updated_at,
          job.started_at,
          job.finished_at,
          provider.name AS provider_name,
          layer.key AS layer_key,
          layer.name AS layer_name,
          (
            SELECT count(*)::int
            FROM public.ingestion_validation_reports report
            WHERE report.job_id = job.id
          ) AS validation_reports
        FROM public.layer_ingestion_jobs job
        LEFT JOIN public.providers provider ON provider.id = job.provider_id
        LEFT JOIN public.layer_definitions layer ON layer.id = job.layer_id
        WHERE job.city_id = $1
        ORDER BY job.updated_at DESC, job.created_at DESC
        LIMIT 30
      `,
      [cityId],
    )

    const workflowRunsResult = await client.query(
      `
        SELECT run.*, definition.name AS workflow_name, definition.domain AS workflow_domain
        FROM ldt_ops.workflow_runs run
        LEFT JOIN ldt_ops.workflow_definitions definition ON definition.id = run.workflow_id
        WHERE run.city_id = $1
        ORDER BY run.created_at DESC
        LIMIT 20
      `,
      [cityId],
    )

    const pendingApprovals = await client.query(
      `
        SELECT
          approval.id,
          approval.approval_key,
          approval.status,
          approval.policy,
          approval.created_at,
          run.id AS run_id,
          run.workflow_key,
          definition.name AS workflow_name
        FROM ldt_ops.workflow_approvals approval
        JOIN ldt_ops.workflow_runs run ON run.id = approval.run_id
        LEFT JOIN ldt_ops.workflow_definitions definition ON definition.id = run.workflow_id
        WHERE run.city_id = $1
          AND approval.status = 'requested'
        ORDER BY approval.created_at DESC
        LIMIT 20
      `,
      [cityId],
    )

    const countsResult = await client.query(
      `
        SELECT
          (SELECT count(*) FROM ldt_ops.api_usage_events WHERE city_id = $1 OR city_id IS NULL)::int AS api_events,
          (SELECT count(DISTINCT route_family) FROM ldt_ops.api_usage_events WHERE city_id = $1 OR city_id IS NULL)::int AS api_families,
          (SELECT count(*) FROM public.layer_ingestion_jobs WHERE city_id = $1)::int AS ingestion_jobs,
          (SELECT count(*) FROM public.layer_ingestion_jobs WHERE city_id = $1 AND status IN ('queued', 'running'))::int AS active_ingestion_jobs,
          (SELECT count(*) FROM ldt_ops.workflow_runs WHERE city_id = $1)::int AS workflow_runs,
          (SELECT count(*) FROM ldt_ops.workflow_runs WHERE city_id = $1 AND status IN ('queued', 'running', 'approval_required'))::int AS active_workflow_runs,
          (
            SELECT count(*)
            FROM ldt_ops.workflow_approvals approval
            JOIN ldt_ops.workflow_runs run ON run.id = approval.run_id
            WHERE run.city_id = $1
              AND approval.status = 'requested'
          )::int AS pending_approvals
      `,
      [cityId],
    )

    const counts = countsResult.rows[0] ?? {}
    const catalog = API_CATALOG.map(catalogRow)
    const catalogFamilies = new Set(catalog.map((item) => item.family))
    const usedFamilies = new Set(apiSummary.rows.map((row) => row.route_family).filter(Boolean))
    const uncoveredFamilies = [...catalogFamilies].filter((family) => !usedFamilies.has(family))
    const readiness = [
      {
        key: 'api-catalog',
        label: 'API catalog',
        status: catalog.length >= 8 ? 'ready' : 'partial',
        evidence: `${catalog.length} canonical API entries are listed for this city product.`,
      },
      {
        key: 'api-usage',
        label: 'API usage telemetry',
        status: Number(counts.api_events ?? 0) > 0 ? 'ready' : 'partial',
        evidence: `${Number(counts.api_events ?? 0)} request events and ${Number(counts.api_families ?? 0)} used route families are recorded.`,
      },
      {
        key: 'ingestion-jobs',
        label: 'Ingestion control',
        status: Number(counts.ingestion_jobs ?? 0) > 0 ? 'ready' : 'partial',
        evidence: `${Number(counts.ingestion_jobs ?? 0)} ingestion jobs are recorded; ${Number(counts.active_ingestion_jobs ?? 0)} active.`,
      },
      {
        key: 'workflow-governance',
        label: 'Workflow governance',
        status: Number(counts.workflow_runs ?? 0) > 0 ? 'ready' : 'partial',
        evidence: `${Number(counts.workflow_runs ?? 0)} workflow runs and ${Number(counts.pending_approvals ?? 0)} pending approvals.`,
      },
    ]

    return {
      configured: true,
      ok: true,
      city: cityResult.rows[0],
      cityId,
      generatedAt: new Date().toISOString(),
      counts: {
        apiEvents: Number(counts.api_events ?? 0),
        apiFamilies: Number(counts.api_families ?? 0),
        ingestionJobs: Number(counts.ingestion_jobs ?? 0),
        activeIngestionJobs: Number(counts.active_ingestion_jobs ?? 0),
        workflowRuns: Number(counts.workflow_runs ?? 0),
        activeWorkflowRuns: Number(counts.active_workflow_runs ?? 0),
        pendingApprovals: Number(counts.pending_approvals ?? 0),
        catalogEntries: catalog.length,
      },
      apiCatalog: catalog,
      apiUsageSummary: apiSummary.rows.map((row) => ({
        routeFamily: row.route_family,
        method: row.method,
        pathTemplate: row.path_template,
        events: Number(row.events ?? 0),
        errors: Number(row.errors ?? 0),
        lastStatusCode: Number(row.last_status_code ?? 0),
        avgLatencyMs: row.avg_latency_ms === null ? null : Number(row.avg_latency_ms),
        lastSeenAt: row.last_seen_at,
      })),
      recentApiEvents: recentApiEvents.rows.map((row) => ({
        id: row.id,
        routeFamily: row.route_family,
        method: row.method,
        pathTemplate: row.path_template,
        statusCode: Number(row.status_code ?? 0),
        latencyMs: row.latency_ms === null ? null : Number(row.latency_ms),
        apiVersion: row.api_version,
        actorRole: row.actor_role,
        errorCode: row.error_code,
        createdAt: row.created_at,
      })),
      ingestionJobs: ingestionJobs.rows.map((row) => ({
        id: row.id,
        jobKind: row.job_kind,
        requestedAction: row.requested_action,
        sourceFormat: row.source_format,
        sourceUri: row.source_uri,
        status: row.status,
        attemptCount: Number(row.attempt_count ?? 0),
        validationSummary: row.validation_summary ?? {},
        stats: row.stats ?? {},
        errorMessage: row.error_message,
        providerName: row.provider_name,
        layerKey: row.layer_key,
        layerName: row.layer_name,
        validationReports: Number(row.validation_reports ?? 0),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
      })),
      workflowRuns: workflowRunsResult.rows.map((row) => ({
        ...normalizeWorkflowRun(row),
        workflowDomain: row.workflow_domain,
      })),
      pendingApprovals: pendingApprovals.rows.map((row) => ({
        id: row.id,
        approvalKey: row.approval_key,
        status: row.status,
        policy: row.policy ?? {},
        createdAt: row.created_at,
        runId: row.run_id,
        workflowKey: row.workflow_key,
        workflowName: row.workflow_name,
      })),
      readiness,
      gaps: uncoveredFamilies.map((family) => ({
        key: `api-usage-${family}`,
        label: `${family} usage not observed yet`,
        action: 'Exercise this API family from the cockpit or external consumer before claiming operational usage.',
      })),
      error: null,
    }
  }).catch((error) => ({
    configured: true,
    ok: false,
    cityId,
    error: String(error?.message ?? 'CITY_OPERATIONS_REPORT_UNAVAILABLE'),
  }))
}
