CREATE SCHEMA IF NOT EXISTS ldt_context;

CREATE TABLE IF NOT EXISTS ldt_context.context_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  subject_key text NOT NULL,
  subject_type text NOT NULL,
  domain_type text NOT NULL DEFAULT 'general',
  label text NOT NULL,
  canonical_uri text,
  authority_status text NOT NULL DEFAULT 'unreviewed',
  privacy_class text NOT NULL DEFAULT 'aggregate',
  lifecycle_status text NOT NULL DEFAULT 'active',
  valid_from timestamptz,
  valid_to timestamptz,
  geom geometry(Geometry, 4326),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, subject_key),
  CONSTRAINT context_subjects_privacy_check CHECK (privacy_class IN ('public', 'aggregate', 'restricted', 'personal')),
  CONSTRAINT context_subjects_lifecycle_check CHECK (lifecycle_status IN ('active', 'inactive', 'archived')),
  CONSTRAINT context_subjects_validity_check CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS ldt_context_subjects_city_type_idx
  ON ldt_context.context_subjects (city_id, subject_type, domain_type, lifecycle_status);
CREATE INDEX IF NOT EXISTS ldt_context_subjects_geom_gix
  ON ldt_context.context_subjects USING gist (geom);
CREATE UNIQUE INDEX IF NOT EXISTS ldt_context_subjects_canonical_uri_uidx
  ON ldt_context.context_subjects (canonical_uri)
  WHERE canonical_uri IS NOT NULL;

CREATE TABLE IF NOT EXISTS ldt_context.subject_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  relation_key text NOT NULL,
  relation_type text NOT NULL,
  source_subject_id uuid REFERENCES ldt_context.context_subjects(id) ON DELETE CASCADE,
  source_entity_id uuid REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  target_subject_id uuid REFERENCES ldt_context.context_subjects(id) ON DELETE CASCADE,
  target_entity_id uuid REFERENCES ldt_core.city_entities(id) ON DELETE CASCADE,
  authority_status text NOT NULL DEFAULT 'unreviewed',
  valid_from timestamptz,
  valid_to timestamptz,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, relation_key),
  CONSTRAINT subject_relations_source_xor_check CHECK (
    (source_subject_id IS NOT NULL AND source_entity_id IS NULL)
    OR (source_subject_id IS NULL AND source_entity_id IS NOT NULL)
  ),
  CONSTRAINT subject_relations_target_xor_check CHECK (
    (target_subject_id IS NOT NULL AND target_entity_id IS NULL)
    OR (target_subject_id IS NULL AND target_entity_id IS NOT NULL)
  ),
  CONSTRAINT subject_relations_self_check CHECK (
    source_subject_id IS DISTINCT FROM target_subject_id
    OR source_entity_id IS DISTINCT FROM target_entity_id
  ),
  CONSTRAINT subject_relations_validity_check CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS ldt_context_relations_source_subject_idx
  ON ldt_context.subject_relations (city_id, source_subject_id, relation_type);
CREATE INDEX IF NOT EXISTS ldt_context_relations_source_entity_idx
  ON ldt_context.subject_relations (city_id, source_entity_id, relation_type);
CREATE INDEX IF NOT EXISTS ldt_context_relations_target_subject_idx
  ON ldt_context.subject_relations (city_id, target_subject_id, relation_type);
CREATE INDEX IF NOT EXISTS ldt_context_relations_target_entity_idx
  ON ldt_context.subject_relations (city_id, target_entity_id, relation_type);

ALTER TABLE ldt_science.indicator_observations
  ADD COLUMN IF NOT EXISTS context_subject_id uuid REFERENCES ldt_context.context_subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS value_kind text NOT NULL DEFAULT 'numeric',
  ADD COLUMN IF NOT EXISTS value_text text,
  ADD COLUMN IF NOT EXISTS boolean_value boolean,
  ADD COLUMN IF NOT EXISTS numerator numeric,
  ADD COLUMN IF NOT EXISTS denominator numeric,
  ADD COLUMN IF NOT EXISTS scenario_key text;

ALTER TABLE ldt_science.indicator_observations
  DROP CONSTRAINT IF EXISTS indicator_observations_subject_xor_check;
ALTER TABLE ldt_science.indicator_observations
  ADD CONSTRAINT indicator_observations_subject_xor_check CHECK (
    geography_entity_id IS NULL OR context_subject_id IS NULL
  );

ALTER TABLE ldt_science.indicator_observations
  DROP CONSTRAINT IF EXISTS indicator_observations_value_kind_check;
ALTER TABLE ldt_science.indicator_observations
  ADD CONSTRAINT indicator_observations_value_kind_check CHECK (
    value_kind IN ('numeric', 'boolean', 'ordinal', 'categorical', 'json')
  );

ALTER TABLE ldt_science.indicator_observations
  DROP CONSTRAINT IF EXISTS indicator_observations_denominator_check;
ALTER TABLE ldt_science.indicator_observations
  ADD CONSTRAINT indicator_observations_denominator_check CHECK (
    denominator IS NULL OR denominator <> 0
  );

CREATE INDEX IF NOT EXISTS ldt_science_indicator_observations_context_idx
  ON ldt_science.indicator_observations (city_id, context_subject_id, indicator_id, observed_at DESC)
  WHERE context_subject_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ldt_science_indicator_observations_scenario_idx
  ON ldt_science.indicator_observations (city_id, scenario_key, indicator_id, observed_at DESC)
  WHERE scenario_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS ldt_analysis.subject_query_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  blueprint_key text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  version text NOT NULL DEFAULT '1.0.0',
  portability_scope text NOT NULL DEFAULT 'city',
  visibility text NOT NULL DEFAULT 'municipal',
  query jsonb NOT NULL,
  renderer jsonb NOT NULL DEFAULT '{}'::jsonb,
  standard_refs text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subject_query_blueprints_scope_check CHECK (portability_scope IN ('city', 'portable')),
  CONSTRAINT subject_query_blueprints_visibility_check CHECK (visibility IN ('private', 'municipal', 'public')),
  CONSTRAINT subject_query_blueprints_city_scope_check CHECK (
    (portability_scope = 'city' AND city_id IS NOT NULL)
    OR portability_scope = 'portable'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ldt_analysis_subject_query_blueprints_city_key_uidx
  ON ldt_analysis.subject_query_blueprints (city_id, blueprint_key)
  WHERE city_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ldt_analysis_subject_query_blueprints_portable_key_uidx
  ON ldt_analysis.subject_query_blueprints (blueprint_key)
  WHERE city_id IS NULL;
CREATE INDEX IF NOT EXISTS ldt_analysis_subject_query_blueprints_lookup_idx
  ON ldt_analysis.subject_query_blueprints (visibility, portability_scope, updated_at DESC);

CREATE TABLE IF NOT EXISTS ldt_analysis.subject_query_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES ldt_analysis.subject_query_blueprints(id) ON DELETE CASCADE,
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  binding jsonb NOT NULL DEFAULT '{}'::jsonb,
  readiness_status text NOT NULL DEFAULT 'draft',
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blueprint_id, city_id),
  CONSTRAINT subject_query_bindings_readiness_check CHECK (readiness_status IN ('draft', 'ready', 'blocked', 'not-applicable'))
);

CREATE TABLE IF NOT EXISTS ldt_analysis.subject_query_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES ldt_core.cities(id) ON DELETE CASCADE,
  blueprint_id uuid REFERENCES ldt_analysis.subject_query_blueprints(id) ON DELETE SET NULL,
  query jsonb NOT NULL,
  result_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  actor_user_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_message text,
  CONSTRAINT subject_query_runs_status_check CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS ldt_analysis_subject_query_runs_city_idx
  ON ldt_analysis.subject_query_runs (city_id, started_at DESC);

CREATE OR REPLACE VIEW ldt_query.subjects AS
SELECT
  ce.city_id,
  'physical'::text AS subject_kind,
  ce.id AS subject_id,
  ce.id AS physical_entity_id,
  NULL::uuid AS context_subject_id,
  ce.stable_id AS subject_key,
  ce.entity_type AS subject_type,
  'physical-asset'::text AS domain_type,
  COALESCE(ce.label, ce.stable_id) AS label,
  ce.canonical_uri,
  ce.authority_status,
  'public'::text AS privacy_class,
  ce.lifecycle_status,
  ce.valid_from,
  ce.valid_to,
  ce.geom,
  ST_GeometryType(ce.geom) AS geometry_type,
  ce.properties AS attributes,
  ce.updated_at
FROM ldt_core.city_entities ce
WHERE ce.lifecycle_status = 'active'
UNION ALL
SELECT
  city.id AS city_id,
  'city'::text AS subject_kind,
  NULL::uuid AS subject_id,
  NULL::uuid AS physical_entity_id,
  NULL::uuid AS context_subject_id,
  city.id AS subject_key,
  'city'::text AS subject_type,
  'administrative'::text AS domain_type,
  city.name AS label,
  city.canonical_uri,
  'municipal-registry'::text AS authority_status,
  'aggregate'::text AS privacy_class,
  'active'::text AS lifecycle_status,
  NULL::timestamptz AS valid_from,
  NULL::timestamptz AS valid_to,
  NULL::geometry(Geometry, 4326) AS geom,
  NULL::text AS geometry_type,
  city.metadata AS attributes,
  city.updated_at
FROM ldt_core.cities city
UNION ALL
SELECT
  cs.city_id,
  'context'::text AS subject_kind,
  cs.id AS subject_id,
  NULL::uuid AS physical_entity_id,
  cs.id AS context_subject_id,
  cs.subject_key,
  cs.subject_type,
  cs.domain_type,
  cs.label,
  cs.canonical_uri,
  cs.authority_status,
  cs.privacy_class,
  cs.lifecycle_status,
  cs.valid_from,
  cs.valid_to,
  cs.geom,
  ST_GeometryType(cs.geom) AS geometry_type,
  cs.attributes || jsonb_build_object('provenance', cs.provenance) AS attributes,
  cs.updated_at
FROM ldt_context.context_subjects cs
WHERE cs.lifecycle_status = 'active';

CREATE OR REPLACE VIEW ldt_query.indicator_subject_values AS
SELECT
  observation.id AS observation_id,
  observation.city_id,
  definition.id AS indicator_id,
  definition.indicator_key,
  definition.name AS indicator_name,
  COALESCE(observation.unit, definition.unit) AS unit,
  CASE
    WHEN observation.context_subject_id IS NOT NULL THEN 'context'
    WHEN observation.geography_entity_id IS NOT NULL THEN 'physical'
    ELSE 'city'
  END AS subject_kind,
  COALESCE(context_subject.id, city_entity.id) AS subject_id,
  observation.geography_entity_id AS physical_entity_id,
  observation.context_subject_id,
  COALESCE(context_subject.subject_key, city_entity.stable_id, observation.city_id) AS subject_key,
  COALESCE(context_subject.subject_type, city_entity.entity_type, 'city') AS subject_type,
  COALESCE(context_subject.label, city_entity.label, city.name, observation.city_id) AS subject_label,
  COALESCE(context_subject.privacy_class, 'aggregate') AS privacy_class,
  observation.value_kind,
  observation.value,
  observation.value_text,
  observation.boolean_value,
  observation.numerator,
  observation.denominator,
  observation.value_json,
  observation.geography_level,
  observation.scenario_key,
  observation.observed_at,
  observation.period_start,
  observation.period_end,
  observation.validation_status,
  observation.authority_status,
  observation.quality,
  observation.source_quality,
  observation.source_ref,
  observation.method,
  observation.uncertainty,
  observation.metadata,
  COALESCE(context_subject.geom, city_entity.geom) AS geom
FROM ldt_science.indicator_observations observation
JOIN ldt_science.indicator_definitions definition ON definition.id = observation.indicator_id
JOIN ldt_core.cities city ON city.id = observation.city_id
LEFT JOIN ldt_core.city_entities city_entity ON city_entity.id = observation.geography_entity_id
LEFT JOIN ldt_context.context_subjects context_subject ON context_subject.id = observation.context_subject_id;

COMMENT ON SCHEMA ldt_context IS
  'Canonical contextual subjects and typed relations that complement, but do not duplicate, physical city assets in ldt_core.';
COMMENT ON TABLE ldt_context.context_subjects IS
  'Statistical areas, cohorts, service zones, organizations, elections, policies, and flow accounts used as honest grains for observations and queries.';
COMMENT ON TABLE ldt_context.subject_relations IS
  'Typed, governed links between contextual subjects and/or physical city entities.';
COMMENT ON VIEW ldt_query.subjects IS
  'Unified read-only subject registry for semantic queries. Physical assets remain in ldt_core; contextual subjects remain in ldt_context.';
COMMENT ON VIEW ldt_query.indicator_subject_values IS
  'Indicator observations resolved to their honest city, physical-asset, or contextual-subject grain.';
COMMENT ON TABLE ldt_analysis.subject_query_blueprints IS
  'Reusable semantic questions. Portable blueprints separate the question from each city data binding.';
