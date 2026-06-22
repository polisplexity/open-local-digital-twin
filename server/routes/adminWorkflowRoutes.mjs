import { requireRateLimit } from '../http/rateLimit.mjs'
import { requireAdmin } from '../services/authService.mjs'
import {
  createWorkflowRun,
  decideWorkflowApproval,
  executePhase14WorkflowRunOnce,
  getWorkflowRun,
  listAgenticWorkflowDefinitions,
  listWorkflowRuns,
} from '../services/ldtOpsService.mjs'

export function registerAdminWorkflowRoutes(app) {
  app.get('/api/admin/workflows', async (request, response) => {
    try {
      requireAdmin(request)
      const workflows = await listAgenticWorkflowDefinitions()
      response.status(workflows.ok ? 200 : 502).json(workflows)
    } catch (error) {
      response.status(500).json({
        error: 'WORKFLOW_DEFINITIONS_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/workflow-runs', async (request, response) => {
    try {
      requireAdmin(request)
      const runs = await listWorkflowRuns({
        cityId: request.query.cityId,
        workflowKey: request.query.workflowKey,
        status: request.query.status,
        limit: request.query.limit,
      })
      response.status(runs.ok ? 200 : 502).json(runs)
    } catch (error) {
      response.status(500).json({
        error: 'WORKFLOW_RUNS_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/workflows/:workflowKey/runs', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:workflow-run-create', { limit: 20, windowMs: 5 * 60_000 })) return
      const admin = requireAdmin(request)
      const run = await createWorkflowRun({
        workflowKey: request.params.workflowKey,
        cityId: request.body?.cityId ?? request.body?.city_id,
        input: request.body?.input ?? {},
        requestedBy: admin?.user?.id ?? admin?.user?.email ?? null,
        requestedByKind: 'human',
        triggerKind: request.body?.triggerKind ?? request.body?.trigger_kind ?? 'manual',
      })
      response.status(run.ok ? 201 : 400).json(run)
    } catch (error) {
      response.status(400).json({
        error: 'WORKFLOW_RUN_CREATE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/workflow-runs/:runId', async (request, response) => {
    try {
      requireAdmin(request)
      const run = await getWorkflowRun(request.params.runId)
      response.status(run.ok ? 200 : 404).json(run)
    } catch (error) {
      response.status(500).json({
        error: 'WORKFLOW_RUN_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })


  app.post('/api/admin/workflow-runs/:runId/execute', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:workflow-run-execute', { limit: 20, windowMs: 5 * 60_000 })) return
      const admin = requireAdmin(request)
      const result = await executePhase14WorkflowRunOnce({
        runId: request.params.runId,
        workerId: request.body?.workerId ?? request.body?.worker_id ?? admin?.user?.id ?? admin?.user?.email ?? 'admin-workflow-runner',
      })
      response.status(result.ok ? 200 : 400).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'WORKFLOW_RUN_EXECUTE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:workflow-approval-decision', { limit: 40, windowMs: 5 * 60_000 })) return
      const admin = requireAdmin(request)
      const decision = await decideWorkflowApproval({
        runId: request.params.runId,
        approvalKey: request.params.approvalKey,
        decision: request.body?.decision,
        decidedBy: admin?.user?.id ?? admin?.user?.email ?? null,
        reason: request.body?.reason ?? '',
      })
      response.status(decision.ok ? 200 : 400).json(decision)
    } catch (error) {
      response.status(400).json({
        error: 'WORKFLOW_APPROVAL_DECISION_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })
}
