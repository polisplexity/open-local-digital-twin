import { withClient } from './dbUtils.mjs'

const RUN_STATUSES = new Set(['running', 'passed', 'failed', 'partial'])
const CASE_STATUSES = new Set(['running', 'passed', 'failed', 'skipped', 'blocked'])
const TOOL_KINDS = new Set([
  'play-visualise',
  'marketplace',
  'identity-management',
  'use-case-scenarios',
  'ai-notebook',
])

function text(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function requireValue(value, errorCode) {
  const normalized = text(value)
  if (!normalized) throw new Error(errorCode)
  return normalized
}

function json(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value
}

function status(value, allowed, fallback) {
  const normalized = text(value, fallback).toLowerCase()
  if (!allowed.has(normalized)) throw new Error(`EU_LDT_ACCEPTANCE_STATUS_INVALID:${normalized}`)
  return normalized
}

function normalizeRun(row = {}) {
  return {
    id: row.id,
    cityId: row.city_id,
    suiteKey: row.suite_key,
    toolKind: row.tool_kind,
    status: row.status,
    environment: row.environment ?? {},
    summary: row.summary ?? {},
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeCase(row = {}) {
  return {
    id: row.id,
    acceptanceRunId: row.acceptance_run_id,
    caseKey: row.case_key,
    category: row.category,
    title: row.title,
    status: row.status,
    workflowRunId: row.workflow_run_id ?? null,
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    expected: row.expected ?? {},
    actual: row.actual ?? {},
    evidence: row.evidence ?? {},
    error: row.error ?? null,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function startEuLdtAcceptanceRun({
  cityId,
  suiteKey,
  toolKind,
  environment = {},
} = {}) {
  const normalizedToolKind = requireValue(toolKind, 'EU_LDT_ACCEPTANCE_TOOL_KIND_REQUIRED')
  if (!TOOL_KINDS.has(normalizedToolKind)) {
    throw new Error(`EU_LDT_ACCEPTANCE_TOOL_KIND_INVALID:${normalizedToolKind}`)
  }
  return withClient(async (client) => {
    const result = await client.query(
      `
        INSERT INTO ldt_interop.eu_ldt_acceptance_runs (
          city_id, suite_key, tool_kind, status, environment
        )
        VALUES ($1, $2, $3, 'running', $4::jsonb)
        RETURNING *
      `,
      [
        requireValue(cityId, 'EU_LDT_ACCEPTANCE_CITY_REQUIRED'),
        requireValue(suiteKey, 'EU_LDT_ACCEPTANCE_SUITE_KEY_REQUIRED'),
        normalizedToolKind,
        JSON.stringify(json(environment)),
      ],
    )
    return normalizeRun(result.rows[0])
  })
}

export async function recordEuLdtAcceptanceCase({
  acceptanceRunId,
  caseKey,
  category,
  title,
  status: caseStatus = 'passed',
  workflowRunId = null,
  durationMs = null,
  expected = {},
  actual = {},
  evidence = {},
  error = null,
  startedAt = null,
  completedAt = null,
} = {}) {
  const normalizedStatus = status(caseStatus, CASE_STATUSES, 'passed')
  const normalizedDuration = durationMs == null ? null : Math.max(0, Math.round(Number(durationMs)))
  const caseStartedAt = startedAt || new Date().toISOString()
  const caseCompletedAt = completedAt || (normalizedStatus === 'running' ? null : new Date().toISOString())
  return withClient(async (client) => {
    const result = await client.query(
      `
        INSERT INTO ldt_interop.eu_ldt_acceptance_cases (
          acceptance_run_id,
          case_key,
          category,
          title,
          status,
          workflow_run_id,
          duration_ms,
          expected,
          actual,
          evidence,
          error,
          started_at,
          completed_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13
        )
        ON CONFLICT (acceptance_run_id, case_key) DO UPDATE SET
          category = EXCLUDED.category,
          title = EXCLUDED.title,
          status = EXCLUDED.status,
          workflow_run_id = EXCLUDED.workflow_run_id,
          duration_ms = EXCLUDED.duration_ms,
          expected = EXCLUDED.expected,
          actual = EXCLUDED.actual,
          evidence = EXCLUDED.evidence,
          error = EXCLUDED.error,
          started_at = EXCLUDED.started_at,
          completed_at = EXCLUDED.completed_at,
          updated_at = now()
        RETURNING *
      `,
      [
        requireValue(acceptanceRunId, 'EU_LDT_ACCEPTANCE_RUN_ID_REQUIRED'),
        requireValue(caseKey, 'EU_LDT_ACCEPTANCE_CASE_KEY_REQUIRED'),
        requireValue(category, 'EU_LDT_ACCEPTANCE_CASE_CATEGORY_REQUIRED'),
        requireValue(title, 'EU_LDT_ACCEPTANCE_CASE_TITLE_REQUIRED'),
        normalizedStatus,
        workflowRunId || null,
        Number.isFinite(normalizedDuration) ? normalizedDuration : null,
        JSON.stringify(json(expected)),
        JSON.stringify(json(actual)),
        JSON.stringify(json(evidence)),
        error ? String(error) : null,
        caseStartedAt,
        caseCompletedAt,
      ],
    )
    return normalizeCase(result.rows[0])
  })
}

export async function finishEuLdtAcceptanceRun({
  acceptanceRunId,
  status: requestedStatus,
  summary = {},
} = {}) {
  return withClient(async (client) => {
    const countsResult = await client.query(
      `
        SELECT
          count(*)::integer AS case_count,
          count(*) FILTER (WHERE status = 'passed')::integer AS passed_count,
          count(*) FILTER (WHERE status = 'failed')::integer AS failed_count,
          count(*) FILTER (WHERE status = 'blocked')::integer AS blocked_count,
          count(*) FILTER (WHERE status = 'skipped')::integer AS skipped_count,
          count(*) FILTER (WHERE status = 'running')::integer AS running_count
        FROM ldt_interop.eu_ldt_acceptance_cases
        WHERE acceptance_run_id = $1
      `,
      [requireValue(acceptanceRunId, 'EU_LDT_ACCEPTANCE_RUN_ID_REQUIRED')],
    )
    const counts = countsResult.rows[0] ?? {}
    const derivedStatus = Number(counts.failed_count ?? 0) > 0
      ? 'failed'
      : Number(counts.blocked_count ?? 0) > 0 || Number(counts.running_count ?? 0) > 0
        ? 'partial'
        : 'passed'
    const finalStatus = status(requestedStatus, RUN_STATUSES, derivedStatus)
    const finalSummary = {
      ...json(summary),
      counts: {
        cases: Number(counts.case_count ?? 0),
        passed: Number(counts.passed_count ?? 0),
        failed: Number(counts.failed_count ?? 0),
        blocked: Number(counts.blocked_count ?? 0),
        skipped: Number(counts.skipped_count ?? 0),
        running: Number(counts.running_count ?? 0),
      },
    }
    const result = await client.query(
      `
        UPDATE ldt_interop.eu_ldt_acceptance_runs
        SET status = $2,
            summary = $3::jsonb,
            completed_at = now(),
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [acceptanceRunId, finalStatus, JSON.stringify(finalSummary)],
    )
    if (result.rowCount === 0) throw new Error('EU_LDT_ACCEPTANCE_RUN_NOT_FOUND')
    return normalizeRun(result.rows[0])
  })
}

export async function getEuLdtAcceptanceRun(acceptanceRunId) {
  return withClient(async (client) => {
    const runResult = await client.query(
      'SELECT * FROM ldt_interop.eu_ldt_acceptance_runs WHERE id = $1',
      [requireValue(acceptanceRunId, 'EU_LDT_ACCEPTANCE_RUN_ID_REQUIRED')],
    )
    if (runResult.rowCount === 0) return null
    const caseResult = await client.query(
      `
        SELECT *
        FROM ldt_interop.eu_ldt_acceptance_cases
        WHERE acceptance_run_id = $1
        ORDER BY started_at, case_key
      `,
      [acceptanceRunId],
    )
    return {
      ...normalizeRun(runResult.rows[0]),
      cases: caseResult.rows.map(normalizeCase),
    }
  })
}

export async function listLatestEuLdtAcceptanceRuns({ cityId, toolKind = null } = {}) {
  return withClient(async (client) => {
    const params = [requireValue(cityId, 'EU_LDT_ACCEPTANCE_CITY_REQUIRED')]
    let filter = ''
    if (toolKind) {
      params.push(toolKind)
      filter = 'AND tool_kind = $2'
    }
    const result = await client.query(
      `
        SELECT *
        FROM ldt_interop.eu_ldt_acceptance_latest
        WHERE city_id = $1
          ${filter}
        ORDER BY tool_kind, suite_key
      `,
      params,
    )
    return result.rows.map((row) => ({
      ...normalizeRun(row),
      caseCount: Number(row.case_count ?? 0),
      passedCount: Number(row.passed_count ?? 0),
      failedCount: Number(row.failed_count ?? 0),
      nonExecutedCount: Number(row.non_executed_count ?? 0),
    }))
  })
}
