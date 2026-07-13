# Offline Data Factory Runner

Updated: 2026-06-27

This is the product-neutral execution contract for heavy Data Factory work.
It is not tied to a specific machine, lab, university cluster, VPS, or cloud.
For the higher-level provider model covering same-server, server-to-server,
offline, HPC, and cloud execution modes, see
`DATA_FACTORY_EXECUTION_PROVIDER_PLAN.md`.

## Current Contract

Twin Studio creates an `offline-data-factory-handoff` run. A compatible runner
executes the package outside the live viewer path, produces a result package,
and imports that result back into Twin Studio. Twin Studio then validates and
applies the result through stage-specific applicators.

In ERP terms:

- Handoff: the work order.
- Dispatch: the outbound work order package for an outside executor.
- Result package: the returned voucher/document from that executor.
- Promotion applicator: the posting routine that checks evidence before writing
  back to ledgers, PostGIS domain tables, or viewer artifact registries.
- Contract: the required fields, checksums, states, and evidence that make those
  documents safe to exchange between modules/processes.

Supported runner profiles now:

- `local-process`: runs inside the current Node/runtime environment.
- `external-worker`: creates an auditable dispatch package for a compatible
  outside runner. It does not execute the stage or claim completion. The result
  must still be imported through the offline result endpoint.

## Portable Docker Runtime

The processing-host install is now a separate Data Factory runtime, not a copy
of the web application. Use these files:

- `Dockerfile.datafactory`
- `Dockerfile.datafactory.dockerignore`
- `compose.datafactory.yml`
- `.env.datafactory` created from `.env.datafactory.example`
- `ops/datafactory/run-city-export.sh`
- writable `runtime-data/` and `exports/`

Create a processing-host payload with:

```bash
ops/datafactory/create-bundle.sh
```

Register a processing node and generate an install/bootstrap package:

```bash
npm run ops:bootstrap-data-factory-node -- \
  --node-key=remote-datafactory-01 \
  --provider-type=server-to-server-pull \
  --twin-studio-url=http://127.0.0.1:4292
```

This writes an ignored runtime package under:

```text
runtime-data/data-factory-bootstrap/<node-key>/
```

The package contains:

- `bootstrap.json`: non-secret control-plane contract;
- `.env.datafactory.node`: node env file with the one-time runtime token;
- `install-datafactory-node.sh`: operator bootstrap script;
- `commands.txt`: minimal create-bundle/install command hints.

Protect `.env.datafactory.node` as a secret. The CLI does not print the token.

For the single-server product baseline, register or refresh the managed
same-server sidecar:

```bash
npm run ops:ensure-same-server-sidecar -- --node-key=local-sidecar --city=guanajuato
```

That command creates:

```text
runtime-data/data-factory-sidecar/<node-key>/same-server-sidecar-plan.json
runtime-data/data-factory-sidecar/<node-key>/same-server-sidecar.commands.sh
```

It also records a processing-node heartbeat. Use `--skip-doctor` when only
preparing the provider contract, or `--no-require-db` when checking the runtime
without requiring database connectivity.

For a server-to-server pull node, the processing host can poll Twin Studio for
work instead of receiving SSH commands:

```bash
TWIN_STUDIO_DATA_FACTORY_TOKEN=<runtime-token> \
npm run ops:server-to-server-pull-worker -- \
  --node-key=remote-datafactory-01 \
  --twin-studio-url=http://127.0.0.1:4292 \
  --once
```

In daemon mode omit `--once`; the worker polls
`/api/data-factory/processing-nodes/:nodeKey/dispatches/claim`, writes the
dispatch package to local scratch, runs the portable external-worker result
builder, and posts the result back to
`/api/data-factory/processing-nodes/:nodeKey/dispatches/:dispatchId/result`.
Use `--run-id=<workflow-run-id>` only for a directed/manual claim; normal nodes
should filter by city/stage or poll without filters.

Optionally save the built image as a portable tarball with checksum:

```bash
DATAFACTORY_IMAGE=twin-base-studio-datafactory:local ops/datafactory/create-image-tarball.sh
```

The image does not run `next build`, does not expose a web port, and does not
copy `src/`. It exists to run CLI stages against PostGIS and produce portable
artifacts.

Build and doctor-check it:

```bash
cp .env.datafactory.example .env.datafactory
# edit TWIN_STUDIO_POSTGRES_PASSWORD and TWIN_STUDIO_DATABASE_URL
docker compose --env-file .env.datafactory -f compose.datafactory.yml up -d postgis
docker compose --env-file .env.datafactory -f compose.datafactory.yml --profile runner build runner
docker compose --env-file .env.datafactory -f compose.datafactory.yml --profile runner run --rm runner npm run ops:datafactory:doctor -- --require-db
```

The doctor fails if the image is missing required runtime tools:

- `ogr2ogr`
- `pmtiles`
- `psql`
- `python3`
- Python module `overturemaps`

Optional tools such as `mpirun` and `osmium` are reported so processing hosts
can be compared, but the doctor only blocks on tools required by current stages.

Run a city export from the Data Factory container:

```bash
docker compose --env-file .env.datafactory -f compose.datafactory.yml --profile runner run --rm runner ops/datafactory/run-city-export.sh romita
```

This produces:

- active PostGIS rows for the city twin;
- MVT directory artifacts;
- PMTiles artifacts;
- partitioned 3D Tiles artifacts;
- a city-scoped rebuild dump under `exports/<city>-<timestamp>/city-rebuild-dump`;
- runtime artifacts tarball at `exports/<city>-<timestamp>.runtime-artifacts.tgz`.

Supported stages now:

- `ingestion-queue`: resolves the active city source plan, creates or reuses
  provider ingestion queue jobs idempotently, imports the result package, and
  validates the queue ledger in Postgres. It does not download or execute heavy
  provider work; workers/processors do that after queue validation.
- `environmental-extractors`: registers city-scoped environmental extractor
  source-plan contracts for terrain, weather, hydrology, and STAC-derived
  layers, imports the result package, and validates `ldt_environment`
  run/artifact evidence. It does not claim that DEM, weather, hydrology, or STAC
  source data has already been downloaded or modelled unless the runner is
  explicitly launched with `--environmental-mode=execute-existing-adapters`.
  That heavier mode runs the existing terrain DEM, weather field, hydrology
  grid, and surface-runoff adapters, then validates source-backed phenomenon
  cells, object observations, object summaries, and simulation outputs in
  PostGIS.
- `semantic-materialization`: materializes object-level semantic tags, generates
  installed semantic packs, imports the result package, and validates PostGIS
  promotion through the existing semantic materialization applicator.
- `viewer-artifacts`: registers ready MVT, PMTiles, and 3D Tiles packages that
  already exist in runtime storage, activates latest eligible versions, imports
  the result package, and validates registry promotion through the viewer
  artifact applicator.

Unsupported stages remain explicit failures:

- raster/STAC processing, calibrated hazard models, state-scale jobs, and
  provider-specific scientific models that do not yet have a stage applicator

Those adapters need their own execution/applicator cuts before they can claim
measured/modelled environmental promotion.

## Operations UI

`/operations/ingestion` exposes the same contract through the admin API:

- `Create handoff`: packages an auditable offline handoff without executing it.
- `Run locally`: creates or runs a handoff with the `local-process` executor and
  imports the validated result package back into Twin Studio.
- `Prepare dispatch`: creates or runs a handoff with the `external-worker`
  profile and writes a dispatch JSON contract for an outside runner.
- `Import result`: lets an operator paste a result package produced outside the
  live backend path.

For `environmental-extractors`, the UI exposes the same runner options as the
CLI:

- `source-plan-only`: safe default, registers source-plan contracts.
- `execute-existing-adapters`: explicit heavier run for the current terrain DEM,
  weather field, hydrology grid, and optional surface-runoff adapters.

## Commands

Create a new handoff and run it:

```bash
npm run ops:run-offline-data-factory -- --city=guanajuato --stage=semantic-materialization
```

Run environmental source plans only:

```bash
npm run ops:run-offline-data-factory -- --city=guanajuato --stage=environmental-extractors
```

Run existing environmental adapters explicitly:

```bash
npm run ops:run-offline-data-factory -- --city=guanajuato --stage=environmental-extractors --environmental-mode=execute-existing-adapters
```

Run an existing handoff:

```bash
npm run ops:run-offline-data-factory -- --run-id=<workflow-run-id>
```

Prepare an external runner dispatch instead of executing locally:

```bash
npm run ops:run-offline-data-factory -- --city=guanajuato --stage=semantic-materialization --executor-profile=external-worker
```

Dispatch packages are written beside handoffs:

```text
runtime-data/artifacts/<city>/offline-data-factory/<run>/dispatch-external-worker.json
```

Run a portable external dispatch locally or on another processing host:

```bash
npm run ops:run-external-data-factory-dispatch -- --dispatch=/path/to/dispatch-external-worker.json --out=/path/to/result.json --runner-id=portable-runner-id
```

When the processing host is registered as `server-to-server-pull`, the pull
worker above can do the same runner/result cycle through the control-plane API
without manually copying the result JSON back into Twin Studio.

Heavy artifacts must travel as manifest entries, never as JSON payload bytes.
The supported first-cut artifact references are:

- `pmtiles`;
- `mvt-directory`;
- `3d-tiles`;
- `postgis-dump`;
- `source-extract`;
- `runtime-artifacts`.

For a local filesystem store, Twin Studio stages accessible file/directory
references into the store root and records checksum, byte size, URI, relative
path, type, and version.

For an `sftp-rsync` store, Twin Studio records the same manifest plus the rsync
command plan to run from the host that can see the source bytes.

For an `offline-bundle` store, Twin Studio writes a portable
`artifact-transfer-bundle.tgz` containing the accessible artifacts and a bundle
manifest. The bundle itself and every item retain checksum and byte-size
evidence.

## Provider Packages

The Data Factory provider package contract closes three execution cases that
should not depend on a live processing node:

- `offline-bundle`: a tarball an operator can move to a disconnected host and
  return with `result/result.json`;
- `hpc-batch`: generated Slurm/PBS scripts for batch environments using
  Apptainer/Singularity or an already prepared runtime;
- `cloud-batch`: a provider-neutral JSON contract for cloud adapters.

The commands are:

```bash
npm run ops:package-offline-data-factory-bundle -- --dispatch=<dispatch-external-worker.json> --out=<dir>
npm run ops:generate-data-factory-hpc-batch -- --dispatch=<dispatch-external-worker.json> --scheduler=slurm --image-ref=datafactory.sif --out=<dir>
npm run ops:generate-data-factory-hpc-batch -- --dispatch=<dispatch-external-worker.json> --scheduler=pbs --image-ref=datafactory.sif --out=<dir>
npm run ops:generate-data-factory-cloud-batch -- --dispatch=<dispatch-external-worker.json> --provider=generic-cloud --storage-uri=<object-store-prefix> --out=<dir>
```

All generated packages validate the external-worker dispatch schema before
writing files. They preserve result import routing, record checksums, avoid
inline heavy artifacts, and do not store cloud or cluster credentials in repo or
manifest files.

Manual staging for an existing dispatch:

```bash
npm run ops:stage-data-factory-artifacts -- \
  --dispatch-id=<dispatch-id> \
  --file=/path/to/result-or-artifacts.json
```

The current portable runner is intentionally conservative. It validates the
dispatch package, preserves handoff/dispatch checksums, writes a
`runner-summary.json`, and returns an `operations-ledger` result that Twin Studio
can import. It does not execute provider downloads, scientific models, PMTiles
builds, or semantic table promotion by itself. Those remain stage-specific
adapters/applicators over the same dispatch/result contract.

Viewer artifacts are a special case for transfer: a result package should carry
registered artifact references and checksums, not PMTiles, MVT tile bytes, 3D
Tiles payloads, database dumps, or large extracts embedded as JSON. Twin Studio
promotes those references into `ldt_viewer.viewer_artifacts`, then live delivery
resolves the active registered artifact through `viewerArtifactDelivery.mjs`.

Import a returned result package from disk:

```bash
npm run ops:import-offline-data-factory-result -- --city=guanajuato --run-id=<workflow-run-id> --file=/path/to/result.json
```

If a run has an `external-worker` dispatch, the returned result package must
carry the dispatch return contract:

```json
{
  "dispatchArtifactUri": "runtime://artifacts/<city>/offline-data-factory/<run>/dispatch-external-worker.json",
  "dispatchChecksum": "sha256:<dispatch-package-checksum>",
  "executorProfile": "external-worker",
  "externalRun": {
    "runnerId": "portable-runner-id",
    "status": "succeeded",
    "startedAt": "2026-06-26T00:00:00.000Z",
    "finishedAt": "2026-06-26T00:10:00.000Z",
    "artifacts": []
  }
}
```

Twin Studio rejects the result if the dispatch checksum or executor profile does
not match the registered dispatch artifact. This prevents a result from being
posted against the wrong work order.

Smoke:

```bash
npm run test:offline-data-factory-ingestion-queue-runner-smoke -- --city=guanajuato
npm run test:offline-data-factory-environmental-extractors-runner-smoke -- --city=guanajuato
npm run test:offline-data-factory-environmental-extractors-execute-smoke -- --city=guanajuato
npm run test:offline-data-factory-runner-smoke -- --city=guanajuato
npm run test:offline-data-factory-external-dispatch-smoke -- --city=guanajuato
npm run test:offline-data-factory-external-result-smoke -- --city=guanajuato
npm run test:offline-data-factory-external-runner-smoke -- --city=guanajuato
npm run test:offline-data-factory-viewer-artifacts-runner-smoke -- --city=guanajuato
npm run test:offline-data-factory-ui-run-contract-smoke
npm run test:data-factory-provider-packages-smoke
npm run test:environmental-extractor-city-required-smoke
```

## Product Rule

The product mode is always `offline-data-factory`. Where the work physically
runs is an implementation detail. A deployment may use local Docker, a VPS, lab
hardware, HPC, or a cloud worker, but UI/API/docs should not expose any specific
machine as a product dependency.
