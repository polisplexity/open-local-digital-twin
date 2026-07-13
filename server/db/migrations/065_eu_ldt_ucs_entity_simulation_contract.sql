UPDATE ldt_ops.workflow_definitions
SET
  purpose = 'Create governed baseline and intervention entity datasets from an OLDT selection, publish them to Data Platform, execute both through UCS Airflow and AI Notebook, and persist timestamped simulation worlds without mutating canonical entities.',
  input_contract = '{
    "required": ["cityId", "ucsProfileKey", "dataPlatformProfileKey"],
    "optional": [
      "selectionSetId",
      "baselineValue",
      "interventionValue",
      "interventionDeltaPercent",
      "metricKey",
      "attributeKey",
      "aggregation",
      "unit",
      "bindingKey",
      "caseName",
      "modelNamespace",
      "modelName",
      "ngsiScope",
      "entityBatchMode",
      "maxEntities",
      "energyIntensityKwhM2",
      "retrofitSavingsFraction",
      "gridEmissionFactorKgCo2Kwh",
      "scenarioYear",
      "executionTimeoutMs",
      "pollIntervalMs"
    ],
    "sourceContract": "OLDT governed selection snapshot, canonical entity geometry, and bounded entity attributes",
    "transportContract": "EU LDT Data Platform NGSI-LD OldtScenarioDataset baseline and intervention entities",
    "targetContract": "EU LDT UCS Case, Scenarios, Data Sources, visible Parameters, Transform DAG, Data Models, Experiments, and Executions"
  }'::jsonb,
  output_contract = '{
    "writes": [
      "external EU LDT Data Platform entities",
      "external EU LDT UCS resources",
      "ldt_science.simulation_runs",
      "ldt_enrichment.entity_model_outputs",
      "ldt_interop.ucs_case_bindings",
      "ldt_ops workflow evidence"
    ],
    "reports": [
      "ucs-metric-resolution",
      "ucs-data-platform-publication",
      "ucs-case-structure",
      "ucs-experiment-executions",
      "ucs-simulation-worlds",
      "ucs-roundtrip-summary"
    ],
    "doesNotClaim": [
      "causal policy impact",
      "authority-approved scenario",
      "canonical OLDT mutation",
      "scientifically validated production AI model"
    ]
  }'::jsonb,
  standards_mapping = '{
    "context": ["NGSI-LD", "EU LDT Data Platform", "EU LDT Use Case & Scenarios", "Airflow", "AI Notebook", "KServe V2"],
    "spatialEvidence": "ldt_analysis.selection_sets and ldt_core.city_entities",
    "localTarget": "timestamped OLDT simulation worlds joined to canonical geometry",
    "authorityBoundary": "simulated outputs remain separate from observed canonical state"
  }'::jsonb,
  updated_at = now()
WHERE workflow_key = 'eu-ldt-use-case-scenarios-roundtrip';

COMMENT ON VIEW ldt_science.entity_simulation_outputs IS
  'Timestamped entity-level simulation worlds from UCS and AI Notebook, joined to canonical OLDT geometry. Simulation outputs never create or overwrite canonical city entities.';
