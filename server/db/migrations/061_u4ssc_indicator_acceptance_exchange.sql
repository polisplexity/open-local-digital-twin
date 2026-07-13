UPDATE ldt_ops.workflow_definitions
SET input_contract = jsonb_set(
      COALESCE(input_contract, '{}'::jsonb),
      '{optional}',
      '[
        "selectionSetId", "value", "metricKey", "attributeKey", "aggregation",
        "unit", "ngsiEntityId", "ngsiProperty", "cipKpiId", "createKpi",
        "kpiName", "requestCalculation", "u4sscStandard", "kpiU4SSCCode",
        "indicatorKey", "indicatorExternalCode", "indicatorCatalogKey",
        "indicatorValueKind"
      ]'::jsonb,
      true
    ),
    output_contract = COALESCE(output_contract, '{}'::jsonb) || jsonb_build_object(
      'indicatorContract', 'U4SSC code and OLDT indicator key preserved through NGSI-LD publication, CIP binding, and measurement readback'
    ),
    updated_at = now()
WHERE workflow_key = 'eu-ldt-cip-publish-metric-source';

UPDATE ldt_ops.workflow_definitions
SET output_contract = COALESCE(output_contract, '{}'::jsonb) || jsonb_build_object(
      'semanticObservationContract', 'Bound successful measurements are persisted in ldt_science.indicator_observations with lab authority and complete CIP provenance'
    ),
    updated_at = now()
WHERE workflow_key = 'eu-ldt-cip-sync-measurements';

COMMENT ON TABLE ldt_analysis.indicator_acceptance_cases IS
  'Durable Builder, SQL, EU LDT Data Platform, City Innovation Planner, and OLDT readback evidence for every tested indicator use case.';
