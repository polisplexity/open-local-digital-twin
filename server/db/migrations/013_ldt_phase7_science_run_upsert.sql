ALTER TABLE ldt_science.simulation_runs
  ADD COLUMN IF NOT EXISTS run_key text;

CREATE UNIQUE INDEX IF NOT EXISTS ldt_science_simulation_runs_run_key_uidx
  ON ldt_science.simulation_runs (run_key);
