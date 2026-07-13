CREATE UNIQUE INDEX IF NOT EXISTS data_factory_dispatches_dispatch_artifact_unique_idx
  ON ldt_ops.data_factory_dispatches (dispatch_artifact_id);
