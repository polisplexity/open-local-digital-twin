ALTER TABLE ldt_science.indicator_definitions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'indicator',
  ADD COLUMN IF NOT EXISTS source_mode text NOT NULL DEFAULT 'autonomous',
  ADD COLUMN IF NOT EXISTS model_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS output_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS formula jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS target jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cip_binding_id uuid REFERENCES ldt_interop.cip_metric_bindings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visualization jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF to_regclass('ldt_enrichment.indicator_definitions') IS NOT NULL THEN
    INSERT INTO ldt_science.indicator_definitions (
      indicator_key, name, model_family, unit, definition, method,
      standard_key, standard_version, dimension, calculation_scope,
      metadata, kind, source_mode, model_key, output_key, formula,
      target, cip_binding_id, visualization, active, updated_at
    )
    SELECT indicator_key, display_name, kind, NULLIF(unit, ''), description,
      jsonb_build_object('formula', formula, 'sourceMode', source_mode),
      'oldt-indicator-catalog', '1.0.0', 'general', scope, metadata,
      kind, source_mode, model_key, output_key, formula, target,
      cip_binding_id, visualization, active, updated_at
    FROM ldt_enrichment.indicator_definitions
    ON CONFLICT (indicator_key) DO UPDATE SET
      name=EXCLUDED.name, unit=EXCLUDED.unit, definition=EXCLUDED.definition,
      method=EXCLUDED.method, calculation_scope=EXCLUDED.calculation_scope,
      metadata=EXCLUDED.metadata, kind=EXCLUDED.kind,
      source_mode=EXCLUDED.source_mode, model_key=EXCLUDED.model_key,
      output_key=EXCLUDED.output_key, formula=EXCLUDED.formula,
      target=EXCLUDED.target, cip_binding_id=EXCLUDED.cip_binding_id,
      visualization=EXCLUDED.visualization, active=EXCLUDED.active,
      updated_at=EXCLUDED.updated_at;

    INSERT INTO ldt_science.indicator_observations (
      city_id, indicator_id, observation_key, geography_level, observed_at,
      value, value_json, quality, unit, method, source_quality, metadata, updated_at
    )
    SELECT old.city_id, science.id,
      'oldt-indicator:' || old.city_id || ':' || science.indicator_key || ':city:' || old.id,
      'city', old.observed_at, old.value_numeric, old.value_json,
      old.source_mode, NULLIF(old.unit, ''), old.calculation,
      old.source_mode, jsonb_build_object(
        'migratedFrom', 'ldt_enrichment.indicator_observations',
        'cipMeasurementReceiptId', old.cip_measurement_receipt_id,
        'selectionSetId', old.selection_set_id
      ), old.created_at
    FROM ldt_enrichment.indicator_observations old
    JOIN ldt_enrichment.indicator_definitions legacy ON legacy.id=old.indicator_id
    JOIN ldt_science.indicator_definitions science ON science.indicator_key=legacy.indicator_key
    ON CONFLICT (observation_key) DO NOTHING;

    DROP VIEW IF EXISTS ldt_enrichment.indicator_observation_current;
    DROP TABLE IF EXISTS ldt_enrichment.indicator_observations;
    DROP TABLE IF EXISTS ldt_enrichment.indicator_definitions;
  END IF;
END $$;

ALTER TABLE ldt_science.indicator_definitions DROP CONSTRAINT IF EXISTS indicator_definitions_kind_check;
ALTER TABLE ldt_science.indicator_definitions ADD CONSTRAINT indicator_definitions_kind_check CHECK (kind IN ('indicator', 'kpi'));
ALTER TABLE ldt_science.indicator_definitions DROP CONSTRAINT IF EXISTS indicator_definitions_source_mode_check;
ALTER TABLE ldt_science.indicator_definitions ADD CONSTRAINT indicator_definitions_source_mode_check CHECK (source_mode IN ('autonomous', 'external', 'cip'));
CREATE INDEX IF NOT EXISTS ldt_science_indicator_definitions_catalog_idx ON ldt_science.indicator_definitions (active, kind, source_mode, updated_at DESC);
CREATE INDEX IF NOT EXISTS ldt_science_indicator_observations_entity_value_idx ON ldt_science.indicator_observations (city_id, indicator_id, geography_entity_id, observed_at DESC) WHERE geography_entity_id IS NOT NULL;
