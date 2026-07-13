CREATE TABLE IF NOT EXISTS ldt_interop.eu_ldt_acceptance_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  suite_key text NOT NULL,
  tool_kind text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  environment jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eu_ldt_acceptance_runs_suite_key_check CHECK (
    suite_key ~ '^[a-z0-9][a-z0-9._-]{1,160}$'
  ),
  CONSTRAINT eu_ldt_acceptance_runs_tool_kind_check CHECK (
    tool_kind IN ('play-visualise', 'marketplace', 'identity-management')
  ),
  CONSTRAINT eu_ldt_acceptance_runs_status_check CHECK (
    status IN ('running', 'passed', 'failed', 'partial')
  )
);

CREATE TABLE IF NOT EXISTS ldt_interop.eu_ldt_acceptance_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acceptance_run_id uuid NOT NULL
    REFERENCES ldt_interop.eu_ldt_acceptance_runs(id) ON DELETE CASCADE,
  case_key text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  workflow_run_id uuid REFERENCES ldt_ops.workflow_runs(id) ON DELETE SET NULL,
  duration_ms integer,
  expected jsonb NOT NULL DEFAULT '{}'::jsonb,
  actual jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (acceptance_run_id, case_key),
  CONSTRAINT eu_ldt_acceptance_cases_case_key_check CHECK (
    case_key ~ '^[a-z0-9][a-z0-9._-]{1,160}$'
  ),
  CONSTRAINT eu_ldt_acceptance_cases_status_check CHECK (
    status IN ('running', 'passed', 'failed', 'skipped', 'blocked')
  ),
  CONSTRAINT eu_ldt_acceptance_cases_duration_check CHECK (
    duration_ms IS NULL OR duration_ms >= 0
  )
);

CREATE INDEX IF NOT EXISTS eu_ldt_acceptance_runs_lookup_idx
  ON ldt_interop.eu_ldt_acceptance_runs (
    city_id, tool_kind, suite_key, started_at DESC
  );

CREATE INDEX IF NOT EXISTS eu_ldt_acceptance_cases_status_idx
  ON ldt_interop.eu_ldt_acceptance_cases (
    acceptance_run_id, status, category, case_key
  );

CREATE OR REPLACE VIEW ldt_interop.eu_ldt_acceptance_latest AS
WITH ranked AS (
  SELECT
    acceptance_run.*,
    row_number() OVER (
      PARTITION BY acceptance_run.city_id, acceptance_run.tool_kind, acceptance_run.suite_key
      ORDER BY acceptance_run.started_at DESC, acceptance_run.id DESC
    ) AS row_rank
  FROM ldt_interop.eu_ldt_acceptance_runs acceptance_run
)
SELECT
  ranked.id,
  ranked.city_id,
  ranked.suite_key,
  ranked.tool_kind,
  ranked.status,
  ranked.environment,
  ranked.summary,
  ranked.started_at,
  ranked.completed_at,
  ranked.updated_at,
  count(acceptance_case.id)::integer AS case_count,
  count(*) FILTER (WHERE acceptance_case.status = 'passed')::integer AS passed_count,
  count(*) FILTER (WHERE acceptance_case.status = 'failed')::integer AS failed_count,
  count(*) FILTER (WHERE acceptance_case.status IN ('skipped', 'blocked'))::integer AS non_executed_count
FROM ranked
LEFT JOIN ldt_interop.eu_ldt_acceptance_cases acceptance_case
  ON acceptance_case.acceptance_run_id = ranked.id
WHERE ranked.row_rank = 1
GROUP BY
  ranked.id,
  ranked.city_id,
  ranked.suite_key,
  ranked.tool_kind,
  ranked.status,
  ranked.environment,
  ranked.summary,
  ranked.started_at,
  ranked.completed_at,
  ranked.updated_at;

COMMENT ON TABLE ldt_interop.eu_ldt_acceptance_runs IS
  'Durable acceptance-suite executions for OLDT integrations with EU LDT Toolbox tools.';
COMMENT ON TABLE ldt_interop.eu_ldt_acceptance_cases IS
  'Case-level evidence, workflow trace, expectations, actual results, and failures for EU LDT integration acceptance.';
COMMENT ON VIEW ldt_interop.eu_ldt_acceptance_latest IS
  'Latest acceptance result and case counts per city, tool, and suite.';
