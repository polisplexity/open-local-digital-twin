# Data Factory Execution Provider Plan

Updated: 2026-06-27

This plan defines how Twin Studio should use Data Factory runtimes without
hardcoding any specific server, lab, HPC facility, cloud vendor, or workstation.

The product concept is:

- Twin Studio owns the control plane, city registry, stage contracts, validation,
  and promotion into PostGIS/artifact registries.
- Data Factory runtimes own heavy execution: source ingestion, semantic
  materialization, MVT/PMTiles generation, 3D Tiles generation, dumps, and later
  raster/scientific stages.
- Execution providers describe where and how a Data Factory runtime executes.

## Product Goal

Twin Studio must run in a small single-server installation, but it must also be
able to use stronger processing machines when the workload grows.

The same stage contract should work across:

- same-server installs;
- another server reachable from the platform;
- disconnected/offline processing hosts;
- HPC/batch environments;
- cloud batch providers.

No UI, API, or doc should expose a specific machine name as a product dependency.

## Core Terms

- Processing node: a machine or execution environment that can run Data Factory
  work.
- Execution provider: the adapter that knows how to run a stage on that node.
- Control plane: small JSON contracts, status, heartbeats, logs, checksums, and
  promotion decisions.
- Data plane: heavy files such as PMTiles, MVT directories, 3D Tiles, source
  extracts, runtime artifact tarballs, and PostGIS dumps.
- Promotion: the validated write-back into Twin Studio PostGIS tables and
  artifact registries.

## Execution Providers

### `same-server-sidecar`

Runs Data Factory on the same server as Twin Studio, usually as a sidecar
container.

Use when:

- the install is small;
- the city is small/medium;
- the operator wants one machine;
- demos/dev/staging should stay simple.

Connection mode:

- shared Docker network;
- same PostGIS service or same host-bound PostGIS;
- shared local artifact storage.

This is the default product baseline.

### `server-to-server-pull`

Runs Data Factory on another server. The Data Factory node polls Twin Studio for
dispatches, claims work, runs locally, then posts result metadata back.

Use when:

- the processing server is stronger than the app server;
- inbound access to the processing server is undesirable;
- firewall/network rules favor outbound connections from the worker.

Connection mode:

- node registration token;
- worker poll API;
- result API;
- artifact transfer through configured artifact store.

This should be the first remote mode implemented after same-server sidecar.

### `server-to-server-push`

Twin Studio actively pushes a dispatch to a known remote server or triggers it
through SSH/HTTP.

Use when:

- the operator controls both servers;
- direct network access is available;
- a simple operational install is more practical than a polling daemon.

Connection mode:

- SSH, HTTPS webhook, or orchestrator API;
- returned `result.json`;
- artifact transfer through rsync/SFTP/object storage.

This mode is useful but should not be the only remote design, because many
institutional networks will not allow inbound access to processing machines.

### `offline-bundle`

Twin Studio creates a dispatch package. An operator moves it to a processing
host, runs the Data Factory runtime, then imports the returned result package.

Use when:

- the processing host is disconnected;
- the institution does not allow live app connectivity;
- data movement must be explicit and auditable;
- emergency/manual operation is required.

Connection mode:

- file bundle in;
- file bundle out;
- result import;
- artifact checksum verification.

This mode already has the first contract pieces and must remain supported.

### `hpc-batch`

Generates a batch job for a managed compute environment. Docker may not be
available; the runtime may need Apptainer/Singularity, module loading, scratch
storage, and scheduler scripts.

Use when:

- the job is city/state scale;
- the host exposes Slurm/PBS/another batch scheduler;
- the platform should not be a live backend for that environment.

Connection mode:

- generated job package;
- scheduler script;
- Apptainer/Singularity image or compatible runtime package;
- scratch output directory;
- explicit result/artifact return.

This must stay generic. No specific HPC facility should be named in product
contracts.

### `cloud-batch`

Runs Data Factory stages on a cloud provider through an adapter.

Use when:

- burst compute is needed;
- workloads are temporary;
- object storage is available;
- a client prefers managed infrastructure.

Connection mode:

- provider adapter;
- object storage artifact store;
- provider logs;
- returned result metadata and checksums.

Cloud provider specifics belong in adapters, not in stage contracts.

### `manual-import`

Allows an operator to import an externally produced result/artifact package.

Use when:

- a legacy script produced useful output;
- a pilot has not been fully automated;
- a vendor/provider delivers files directly.

Connection mode:

- operator-uploaded result package;
- artifact references and checksums;
- strict validation before promotion.

## Required Backend Model

Add or formalize these backend records under `ldt_ops`:

- `processing_nodes`
  - `node_id`
  - `display_name`
  - `provider_type`
  - `connection_mode`
  - `runtime_version`
  - `image_ref`
  - `status`
  - `last_seen_at`
  - `capabilities_json`
  - `public_config_json`
- `processing_node_heartbeats`
  - node health over time;
  - free disk;
  - CPU/RAM summary;
  - current job count;
  - doctor status.
- `processing_node_tokens`
  - hashed registration/runtime tokens;
  - revocation state;
  - expiry.
- `artifact_stores`
  - local filesystem;
  - SFTP/rsync target;
  - object storage;
  - offline bundle path.
- `data_factory_dispatches`
  - normalized dispatch state if current workflow artifacts are not enough.

Secrets must not be stored in repo, dispatch JSON, or user-visible config.

## Stage Contract Requirements

Every Data Factory stage should declare:

- allowed execution providers;
- required inputs;
- expected outputs;
- expected artifacts;
- estimated resource class;
- whether it requires network;
- whether it requires local PostGIS;
- whether it can run offline;
- validation rules;
- promotion applicator;
- artifact store requirements.

The stage registry is the right place for this; React should only display and
trigger backend-defined contracts.

## Control Plane Flow

1. Twin Studio creates a Data Factory run.
2. Backend resolves the stage contract and eligible providers.
3. Scheduler chooses an execution provider or operator selects one.
4. Backend creates a dispatch package.
5. Provider claims/runs the dispatch.
6. Provider writes logs, artifacts, and result metadata.
7. Twin Studio receives/imports `result.json`.
8. Backend validates dispatch checksum, stage contract, artifact checksums, and
   expected outputs.
9. Promotion applicator writes validated state into PostGIS and artifact
   registries.
10. Operations UI shows the final state.

## Data Plane Rule

Heavy artifacts do not travel inside JSON.

Result packages should carry:

- artifact type;
- URI/path;
- checksum;
- byte size;
- version;
- city id;
- stage key;
- generated by node id;
- generated at;
- promotion eligibility.

Artifact bytes move through local volumes, rsync/SFTP, object storage, or offline
tarballs depending on the provider.

## Operations UI

Add a dedicated Data Factory operations view or extend `/operations/ingestion`
with these sections:

- Processing nodes;
- Connection mode;
- Doctor status;
- Capabilities;
- Active jobs;
- Dispatches;
- Result imports;
- Artifact stores;
- Recent promotions;
- Generate install/bootstrap command;
- Prepare offline bundle;
- Import result.

## Implementation Order

0. Keep current portable runtime as the execution baseline. Done:
   `Dockerfile.datafactory`, `compose.datafactory.yml`, and the runtime doctor
   define the first portable execution runtime.
1. Add provider vocabulary and node registry schema. Done:
   `039_ldt_ops_processing_nodes.sql` defines artifact stores, processing
   nodes, node heartbeats, hashed tokens, stage bindings, and dispatch bindings.
2. Add backend APIs for node registration, heartbeat, doctor report, and
   capability report. Done first cut:
   - `GET /api/admin/data-factory/processing-nodes`;
   - `POST /api/admin/data-factory/processing-nodes`;
   - `GET /api/admin/data-factory/processing-nodes/:nodeKey`;
   - `POST /api/admin/data-factory/processing-nodes/:nodeKey/heartbeats`;
   - `POST /api/data-factory/processing-nodes/:nodeKey/heartbeat`.

   Admin registration can create/update a node, artifact store, stage bindings,
   and one-time runtime token. Runtime heartbeat is token-protected and updates
   status, doctor posture, capabilities, and resource metrics.
3. Add bootstrap/install command. Done first cut:
   `npm run ops:bootstrap-data-factory-node -- --node-key=<key>` registers a
   node, creates stage bindings, issues a one-time runtime token, and writes a
   local bootstrap package with `bootstrap.json`, `.env.datafactory.node`,
   `install-datafactory-node.sh`, and `commands.txt`. The token is not printed
   to stdout; it is written only to the generated env file under ignored
   runtime state.
4. Add `same-server-sidecar` as the first managed provider. Done first cut:
   `npm run ops:ensure-same-server-sidecar` and
   `POST /api/admin/data-factory/providers/same-server-sidecar/ensure`
   register or refresh the local Data Factory sidecar node, write a Docker
   Compose command plan under ignored runtime state, run or record doctor
   posture, and store a processing-node heartbeat. This gives the product a
   managed same-server provider before remote workers are introduced.
5. Add `server-to-server-pull` worker daemon/poller. Done first cut:
   - `POST /api/data-factory/processing-nodes/:nodeKey/dispatches/claim`;
   - `POST /api/data-factory/processing-nodes/:nodeKey/dispatches/:dispatchId/result`;
   - `npm run ops:server-to-server-pull-worker`.

   A registered pull node can claim a pending `external-worker` dispatch for an
   enabled stage binding, run the portable external-worker result builder, and
   submit the result back through token-authenticated runtime APIs. This closes
   the control-plane loop. Heavy artifact movement is still the next step.
6. Add artifact store abstraction for local filesystem, SFTP/rsync, and artifact
   tarballs. Done first cut:
   - `npm run ops:stage-data-factory-artifacts`;
   - `POST /api/admin/data-factory/dispatches/:dispatchId/artifacts/stage`;
   - automatic artifact-manifest staging during
     `server-to-server-pull` result submission.

   The manifest supports PMTiles, MVT directories, 3D Tiles, PostGIS dumps,
   source extracts, runtime tarballs, and smaller runner artifacts. Local
   filesystem stores copy accessible files/directories into the configured
   store root. `sftp-rsync` stores produce checksum-preserving `rsync` command
   plans without embedding bytes or requiring credentials in Twin Studio.
   `offline-bundle` stores package accessible artifacts into a single
   `artifact-transfer-bundle.tgz`, with bundle checksum/byte size plus per-item
   checksum/byte size.
7. Connect large artifact transfer/result manifests to registered processing
   nodes. Done first cut: `server-to-server-pull` can upload a runtime artifact
   bundle for generated viewer outputs, Twin Studio validates checksum/byte size,
   safely extracts runtime-relative members, and records the transfer evidence
   before result import/promotion.
8. Update Operations UI to show nodes, connection mode, status, and jobs. Done
   first cut: `/operations/ingestion` now loads registered processing nodes,
   heartbeat/doctor state, active Data Factory jobs, viewer artifacts, returned
   promotion evidence, condensed logs, and a same-server sidecar ensure action.
   The UI still reads backend control-plane APIs; React does not fabricate
   dispatch/result contracts.
9. Add `server-to-server-push` only if the operator path needs it.
10. Add `offline-bundle` hardening for disconnected hosts. Done first cut:
    `npm run ops:package-offline-data-factory-bundle` validates an
    `external-worker` dispatch, writes a portable package manifest, copies the
    dispatch/result-template/artifact-manifest inputs when provided, creates
    `bin/run-offline-bundle.sh`, and emits a checksummed `.tgz` package for
    manual transfer to a disconnected host.
11. Add `hpc-batch` adapter as a generated batch-script provider. Done first
    cut: `npm run ops:generate-data-factory-hpc-batch` writes provider-neutral
    Slurm or PBS packages with `job.slurm`/`job.pbs`, dispatch copy, result/log
    folders, checksums, and an `hpc-batch-plan.json`. The script uses
    Apptainer/Singularity when available and keeps any specific facility out of
    the product contract.
12. Add `cloud-batch` only after the provider abstraction is stable. Done first
    cut: `npm run ops:generate-data-factory-cloud-batch` writes a
    provider-neutral `cloud-batch-plan.json` with provider key, image ref,
    storage/log URI slots, callback/import routing, and explicit boundaries:
    provider-specific submission and credentials belong in adapters/plugins.

## Immediate Remote-Host Test Target

The first real remote test should use the generic `server-to-server` posture,
not a machine-specific product mode.

Status: completed first real remote control-plane test on 2026-06-27. Evidence
is recorded in `docs/DATA_FACTORY_REMOTE_HOST_TEST_2026-06-27.md`.

Minimum acceptance:

- clean server receives the Data Factory bundle or image tarball;
- doctor passes;
- node registers or is represented in Operations;
- one city export runs from the Data Factory runtime;
- output artifacts are checksummed;
- Twin Studio imports or promotes the result;
- Operations shows the run state without manual database inspection.

If a step still requires manual shell work, document it as an operations gap
rather than pretending the platform owns it.

Observed gap from the 2026-06-27 remote-host test: the generic `external-worker`
runner validates and imports the dispatch/result loop with artifact checksums,
but its promotion mode is still `operations-ledger`. Heavy stage-specific
promotion for semantic rows, PMTiles, MVT, and 3D Tiles remains a separate
   runner implementation step.

Update: a first `viewer-artifacts` stage-specific external runner now exists:

- CLI: `npm run ops:run-viewer-artifacts-data-factory-dispatch -- --dispatch=...`.
- Pull worker activation: `npm run ops:server-to-server-pull-worker -- --stage-runner=viewer-artifacts`.
- Output: stage-applicator result package with checksummed MVT directory,
  PMTiles, 3D Tiles, and runner-summary references.
- Important boundary: this runner proves the heavy stage contract. The pushed
  runtime artifact bundle now covers the first byte-moving artifact plane.

Update after city-input hardening:

- Product-owned city input packages now cover the first clean input data plane:
  `ops:package-data-factory-city-input` creates a checksummed PostGIS dump
  package, and `ops:restore-data-factory-city-input` validates/restores it into a
  Data Factory PostGIS before a stage runs.
- Local proof restored Guanajuato into a clean temporary PostGIS and generated
  MVT, PMTiles, and 3D Tiles from that restored input without reading the
  original Twin Studio database.
- The next proof is therefore not a new numbered phase. It is the same
  `server-to-server-pull` provider running on a clean remote host with
  `restored-postgis-dump` input and pushed/runtime-bundle or configured artifact
  transfer output.
- Direct rsync/SFTP execution and object-storage adapters remain optional
  artifact-plane implementations for deployments where pushed runtime bundles are
  not enough.

See `docs/DATA_FACTORY_REMOTE_SERVER_CONFIGURATION.md` for the product-facing
server configuration model.
