CREATE TABLE IF NOT EXISTS ldt_analysis.indicator_acceptance_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  catalog_id uuid NOT NULL REFERENCES ldt_science.indicator_catalogs(id) ON DELETE CASCADE,
  indicator_id uuid REFERENCES ldt_science.indicator_definitions(id) ON DELETE CASCADE,
  case_key text NOT NULL,
  title text NOT NULL,
  use_case text NOT NULL,
  query_pattern text NOT NULL,
  base_semantic_class text NOT NULL DEFAULT 'buildings',
  builder jsonb NOT NULL,
  twin_query jsonb NOT NULL,
  sql_text text NOT NULL,
  expected_result_count integer,
  builder_result_count integer,
  sql_result_count integer,
  matched_object_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  local_status text NOT NULL DEFAULT 'draft',
  data_platform_status text NOT NULL DEFAULT 'not-run',
  cip_status text NOT NULL DEFAULT 'not-run',
  roundtrip_status text NOT NULL DEFAULT 'not-run',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  external_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, catalog_id, case_key),
  CONSTRAINT indicator_acceptance_pattern_check CHECK (
    query_pattern IN ('self-indicator', 'related-subject', 'city-context', 'compound')
  ),
  CONSTRAINT indicator_acceptance_local_status_check CHECK (
    local_status IN ('draft', 'running', 'passed', 'failed')
  ),
  CONSTRAINT indicator_acceptance_external_status_check CHECK (
    data_platform_status IN ('not-run', 'running', 'passed', 'failed')
    AND cip_status IN ('not-run', 'running', 'passed', 'failed')
    AND roundtrip_status IN ('not-run', 'running', 'passed', 'failed')
  ),
  CONSTRAINT indicator_acceptance_counts_check CHECK (
    (expected_result_count IS NULL OR expected_result_count >= 0)
    AND (builder_result_count IS NULL OR builder_result_count >= 0)
    AND (sql_result_count IS NULL OR sql_result_count >= 0)
  )
);

CREATE INDEX IF NOT EXISTS ldt_analysis_indicator_acceptance_city_status_idx
  ON ldt_analysis.indicator_acceptance_cases (
    city_id, catalog_id, local_status, roundtrip_status, updated_at DESC
  );
CREATE INDEX IF NOT EXISTS ldt_analysis_indicator_acceptance_indicator_idx
  ON ldt_analysis.indicator_acceptance_cases (city_id, indicator_id, query_pattern);

CREATE OR REPLACE VIEW ldt_query.subject_relations AS
SELECT
  relation.id,
  relation.city_id,
  relation.relation_key,
  relation.relation_type,
  CASE WHEN relation.source_subject_id IS NOT NULL THEN 'context' ELSE 'physical' END AS source_kind,
  COALESCE(source_subject.subject_key, source_entity.stable_id) AS source_key,
  COALESCE(source_subject.subject_type, source_entity.entity_type) AS source_type,
  relation.source_subject_id,
  relation.source_entity_id,
  CASE WHEN relation.target_subject_id IS NOT NULL THEN 'context' ELSE 'physical' END AS target_kind,
  COALESCE(target_subject.subject_key, target_entity.stable_id) AS target_key,
  COALESCE(target_subject.subject_type, target_entity.entity_type) AS target_type,
  relation.target_subject_id,
  relation.target_entity_id,
  relation.authority_status,
  relation.valid_from,
  relation.valid_to,
  relation.properties,
  COALESCE(source_subject.geom, source_entity.geom) AS source_geom,
  COALESCE(target_subject.geom, target_entity.geom) AS target_geom,
  relation.updated_at
FROM ldt_context.subject_relations relation
LEFT JOIN ldt_context.context_subjects source_subject ON source_subject.id = relation.source_subject_id
LEFT JOIN ldt_core.city_entities source_entity ON source_entity.id = relation.source_entity_id
LEFT JOIN ldt_context.context_subjects target_subject ON target_subject.id = relation.target_subject_id
LEFT JOIN ldt_core.city_entities target_entity ON target_entity.id = relation.target_entity_id;

CREATE OR REPLACE VIEW ldt_query.indicator_catalog AS
SELECT
  catalog.catalog_key,
  catalog.title AS catalog_title,
  catalog.version AS catalog_version,
  catalog.publisher,
  membership.external_code,
  membership.dimension,
  membership.subdimension,
  membership.level,
  membership.indicator_type,
  membership.sort_order,
  definition.id AS indicator_id,
  definition.indicator_key,
  definition.name,
  definition.unit,
  definition.definition,
  definition.calculation_scope,
  definition.expected_direction,
  definition.kind,
  definition.source_mode,
  definition.method,
  definition.formula,
  definition.target,
  definition.visualization,
  definition.metadata,
  definition.active
FROM ldt_science.indicator_catalog_memberships membership
JOIN ldt_science.indicator_catalogs catalog ON catalog.id = membership.catalog_id
JOIN ldt_science.indicator_definitions definition ON definition.id = membership.indicator_id;

CREATE OR REPLACE VIEW ldt_query.indicator_acceptance_presets AS
SELECT
  acceptance.id,
  acceptance.city_id,
  catalog.catalog_key,
  definition.indicator_key,
  membership.external_code,
  membership.dimension,
  membership.subdimension,
  acceptance.case_key,
  acceptance.title,
  acceptance.use_case,
  acceptance.query_pattern,
  acceptance.base_semantic_class,
  acceptance.builder,
  acceptance.twin_query,
  acceptance.sql_text,
  acceptance.expected_result_count,
  acceptance.builder_result_count,
  acceptance.sql_result_count,
  acceptance.matched_object_ids,
  acceptance.local_status,
  acceptance.data_platform_status,
  acceptance.cip_status,
  acceptance.roundtrip_status,
  acceptance.evidence,
  acceptance.external_evidence,
  acceptance.last_run_at,
  acceptance.updated_at
FROM ldt_analysis.indicator_acceptance_cases acceptance
JOIN ldt_science.indicator_catalogs catalog ON catalog.id = acceptance.catalog_id
LEFT JOIN ldt_science.indicator_definitions definition ON definition.id = acceptance.indicator_id
LEFT JOIN ldt_science.indicator_catalog_memberships membership
  ON membership.catalog_id = acceptance.catalog_id
 AND membership.indicator_id = acceptance.indicator_id;

COMMENT ON TABLE ldt_analysis.indicator_acceptance_cases IS
  'Durable development and integration evidence proving that each catalog indicator can drive equivalent Builder and SQL queries and, when requested, complete Data Platform and CIP exchange.';
COMMENT ON VIEW ldt_query.subject_relations IS
  'Read-only, city-scoped semantic relations exposed to expert SQL without opening the ldt_context write schema.';
COMMENT ON VIEW ldt_query.indicator_catalog IS
  'Read-only indicator catalog, standard metadata, formulas, and visualization contracts exposed to expert SQL.';
COMMENT ON VIEW ldt_query.indicator_acceptance_presets IS
  'Tested indicator use cases presented as query presets with expected counts and external-cycle evidence.';
