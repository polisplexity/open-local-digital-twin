UPDATE ldt_ops.workflow_definitions
SET
  lifecycle_status = 'retired',
  default_mode = 'retired',
  updated_at = now()
WHERE workflow_key IN (
  'environmental-source-extractor-refresh',
  'open-data-city-bootstrap',
  'private-provider-validation'
);

UPDATE ldt_ops.workflow_definitions
SET
  name = 'Open Source City Builder',
  lifecycle_status = 'current',
  default_mode = 'human-approved-worker',
  updated_at = now()
WHERE workflow_key = 'phase14-open-data-workflow-runner';

UPDATE ldt_ops.workflow_definitions
SET
  name = 'Data Factory Compute Handoff',
  lifecycle_status = 'current',
  default_mode = 'offline-data-factory',
  updated_at = now()
WHERE workflow_key = 'offline-data-factory-handoff';

UPDATE ldt_ops.workflow_definitions
SET
  name = 'External Model Enrichment',
  lifecycle_status = 'current',
  default_mode = 'assisted',
  updated_at = now()
WHERE workflow_key = 'external-model-enrichment-exchange';

UPDATE ldt_ops.workflow_definitions
SET
  name = 'Standards Publication Refresh',
  lifecycle_status = 'current-needs-executor',
  default_mode = 'operator-approved-publication',
  updated_at = now()
WHERE workflow_key = 'standards-publication-refresh';

UPDATE ldt_ops.workflow_definitions
SET
  lifecycle_status = 'draft-needs-certification',
  default_mode = 'blocked-pending-certification',
  updated_at = now()
WHERE workflow_key IN (
  'eu-ldt-data-platform-publish',
  'eu-ldt-data-platform-import-results',
  'renovation-strategy-readiness-demo',
  'vulnerability-clustering-readiness-demo'
);
