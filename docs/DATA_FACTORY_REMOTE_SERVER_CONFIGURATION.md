# Data Factory Remote Server Configuration

Updated: 2026-07-02

This note captures the configuration model needed for Twin Studio to use
external compute without baking a specific server, HPC facility, or cloud into
the product.

## Goal

Twin Studio should keep the local city twin as the control plane and source of
truth, while configurable Data Factory nodes run heavy processing elsewhere:

- same server sidecar;
- server-to-server worker on another KVM or VPS;
- disconnected offline bundle;
- HPC batch environment;
- cloud batch environment.

The product concept is not a named machine or a named facility mode. Those are
deployment targets for the same Data Factory node contract.

## What Exists Now

- Processing node registry: `ldt_ops.processing_nodes`.
- Runtime token and heartbeat: `ldt_ops.processing_node_tokens` and
  `ldt_ops.processing_node_heartbeats`.
- Stage bindings: `ldt_ops.processing_node_stage_bindings`.
- Artifact stores: `ldt_ops.artifact_stores`.
- Dispatch/result loop for `server-to-server-pull`.
- Artifact transfer manifest for heavy artifacts.
- Stage-specific first cut for `viewer-artifacts`:
  - MVT directory build;
  - PMTiles packing;
  - partitioned 3D Tiles build;
  - viewer artifact registry references;
  - checksummed result package.

## Configuration Layers

### 1. Control Plane

How the node talks to Twin Studio.

Required fields:

- provider type: `same-server-sidecar`, `server-to-server-pull`,
  `offline-bundle`, `hpc-batch`, or `cloud-batch`;
- node key;
- Twin Studio base URL;
- runtime token;
- allowed city IDs;
- allowed stages;
- heartbeat cadence;
- doctor policy.

This part is already mostly implemented for `server-to-server-pull`.

### 2. Data Plane Input

How the node gets the city data it must process.

Supported product modes should be:

- `local-postgis`: sidecar uses the same PostGIS network as Twin Studio;
- `remote-postgis`: worker connects to a configured PostGIS endpoint, usually
  over SSH/VPN/private network;
- `restored-postgis-dump`: Twin Studio sends a city-scoped dump and the worker
  restores it into its own PostGIS before processing;
- `source-bundle`: worker receives raw/provider source artifacts and builds
  PostGIS locally;
- `object-storage-input`: worker reads source/dump artifacts from configured
  storage.

Current state: `restored-postgis-dump` now has the first product-owned
implementation. Twin Studio can package a city-scoped PostGIS input, validate it
by checksum/byte size, and restore it into a Data Factory PostGIS before a stage
runs. The local proof restored Guanajuato into a clean temporary PostGIS and ran
`viewer-artifacts` from that restored input without reading the original Twin
Studio database.

Open Twin product cut: Operations exposes package preparation through
`POST /api/admin/cities/:cityId/data-factory/city-input-packages` and
`/operations/ingestion` shows recent registered `data-factory-city-input-package`
artifacts. This makes the input data plane visible to an operator before the
remote worker runs.

Remaining proof: repeat the same restored-input flow on a clean remote processing
host without a live data-plane tunnel.

### 3. Execution Plane

How the node runs a stage.

Current executable runner:

```bash
npm run ops:server-to-server-pull-worker -- \
  --node-key=<node> \
  --twin-studio-url=<control-plane-url> \
  --stage=viewer-artifacts \
  --stage-runner=viewer-artifacts
```

Relevant knobs:

- `--mvt-min-zoom`;
- `--mvt-max-zoom`;
- `--mvt-max-features-per-tile`;
- `--tile-partitions`;
- `--tile-partition-limit`;
- `--tileset-key`;
- `--pmtiles-bin`.
- `--upload-artifact-bundle` to push generated runtime artifacts back into Twin
  Studio before submitting the result package.
- `--no-activate` when the operator wants validation evidence without changing
  the active viewer artifact version.

The same stage runner can be called directly from an offline/HPC/cloud wrapper:

```bash
npm run ops:run-viewer-artifacts-data-factory-dispatch -- \
  --dispatch=/path/to/dispatch-external-worker.json \
  --out=/path/to/result.json
```

### 4. Artifact Plane Output

How large outputs return to Twin Studio.

Required artifact record fields:

- artifact kind: `pmtiles`, `mvt-directory`, `3d-tiles`, `postgis-dump`,
  `runtime-artifacts`, or `artifact-tarball`;
- artifact key;
- version;
- media type;
- URI;
- local/source path when accessible;
- byte size;
- checksum;
- transfer mode;
- visibility.

Current transfer support:

- local filesystem staging: **copies bytes** into the configured artifact store;
- rsync/SFTP transfer plan: **does not copy bytes yet**; it records destination
  URI, checksum, byte size, and the rsync command to run;
- offline artifact tarball packaging: **packages bytes** into a checksummed
  `artifact-transfer-bundle.tgz`;
- server-to-server runtime artifact bundle upload: **uploads bytes** from the
  processing node to Twin Studio over the processing-node API;
- safe extraction to Twin Studio runtime for `artifacts/<city>/...` and
  `3d-tiles/<city>/...`;
- checksum validation;
- no inline heavy payloads.

Artifact transfer status is intentionally explicit:

| Store or path | Bytes move now? | Manifest status | What is proven |
| --- | --- | --- | --- |
| `local-filesystem` | Yes | `staged` | Source PMTiles, MVT directories, 3D Tiles, and dumps are copied to the configured local store with checksum and byte-size validation. |
| `offline-bundle` | Yes | `packaged` | Source artifacts are copied into a tarball, the tarball is checksummed, and each item records its bundle member path. |
| `server-to-server-pull --upload-artifact-bundle` | Yes | `uploaded` on the runtime bundle ledger artifact | A remote worker can upload a checksummed runtime artifact tarball; Twin Studio validates size/checksum, rejects unsafe tar members, extracts safe runtime paths, and records `data-factory-runtime-artifact-bundle`. |
| `sftp-rsync` | No | `planned` | The system records source checksum/byte size, destination URI, and the exact rsync command. Execution of rsync/SFTP is still an adapter gap. |
| `object-storage` | No | `planned` or `referenced` | Object storage is represented by the artifact-store contract, but upload/download execution is still an adapter gap. |
| Metadata-only external reference | No | `referenced` | Heavy artifacts must provide checksum and byte size; Twin Studio can validate the reference contract but does not own the bytes. |

The artifact transfer manifest now records `byteMovement` totals so Operations
and tests can distinguish `copiedToStore`, `packagedForTransfer`,
`plannedExternalTransfer`, `referencedOnly`, and `tarballByteSize`. Do not treat
`planned` or `referenced` as transferred bytes.

Implemented path: a `server-to-server-pull` worker can create a runtime artifact
bundle, upload it to
`/api/data-factory/processing-nodes/:nodeKey/dispatches/:dispatchId/artifacts/runtime-bundle`,
and then submit the result package. Twin Studio validates checksum and byte
size, rejects unsafe tar members, extracts the bytes into the local runtime, and
records a `data-factory-runtime-artifact-bundle` artifact.

Remaining transfer gap: direct rsync/SFTP execution and object-storage
upload/fetch remain adapters. The product contract is ready for them, but the
proven remote byte path is the pushed runtime bundle.

### 5. Promotion Plane

How the validated result becomes visible to the product.

For `viewer-artifacts`, promotion means:

- evidence exists in the viewer artifact registry;
- expected artifact minimums pass;
- artifacts are active or explicitly versioned;
- viewer routes can resolve the registered artifact URIs.

For future heavy semantic or environmental stages, promotion must be separate
from artifact transfer because some outputs are PostGIS rows and others are
files.

## Provider-Specific Notes

### KVM/VPS

Use `server-to-server-pull`.

Best initial modes:

- data input: `restored-postgis-dump` for reproducible runs; use
  `remote-postgis` only as a temporary debugging shortcut;
- artifact output: pushed runtime artifact bundle first; rsync/SFTP,
  object-storage, or artifact tarball as configured adapters;
- execution: Docker image or unpacked bundle.

### HPC

Do not assume Slurm, PBS, Apptainer, Singularity, or any facility-specific
runtime until the target environment is inspected.

The generic contract should only require:

- a job wrapper can run the Data Factory image or bundle;
- dispatch package is available to the job;
- logs and result package can be collected;
- heavy artifacts can be returned through a configured artifact plane.

Facility adapters can later map that contract to Slurm, PBS, Apptainer,
Singularity, module environments, shared scratch, or another scheduler.

### Cloud

Cloud should remain an adapter, not product logic.

The generic fields are:

- provider key;
- image/bundle reference;
- input storage URI;
- output artifact store URI;
- logs URI;
- result callback or manual import path;
- credentials secret reference.

AWS, Azure, GCP, or any other provider should plug into this shape later.

## Acceptance Path

1. Remote host + Guanajuato: restore a city input package, run
   `viewer-artifacts` with reduced parameters, return checksummed artifacts, and
   import/promote the result without a live DB tunnel.
2. Remote host + Romita or another second city: repeat the same flow to prove
   city ID/config switching.
3. Replace remaining manual copy steps with configured artifact transfer where
   the pushed runtime bundle is not enough.
4. Inspect a batch target before selecting a scheduler/runtime adapter.
5. Add cloud adapter only after remote-host and offline-bundle data/artifact paths
   are stable.

## Current Evidence

Local Data Factory image proof on 2026-06-27:

- image: `twin-base-studio-datafactory:smoke`;
- city: `guanajuato`;
- dispatch run ID: `viewer-artifacts-heavy-smoke-20260627T154005Z`;
- runner: `local-heavy-smoke`;
- parameters:
  - MVT zoom: `10..10`;
  - 3D Tiles partitions: `2`;
  - 3D Tiles partition limit: `250`;
- output:
  - 1 MVT directory;
  - 1 PMTiles file;
  - 1 partitioned 3D Tiles package;
  - checksums and byte sizes present in the result package;
  - result file:
    `runtime-data-guanajuato-test/tmp/viewer-artifacts-heavy-smoke/result.json`.

This proves the stage-specific runner can execute real builders against the
Guanajuato PostGIS inventory. The follow-up city-input package proof now covers
the clean PostGIS restore path locally; the remaining proof is a clean remote
host run using that package.

Observed nuance: the reduced 3D Tiles smoke generated a versioned package but
did not replace the existing full Guanajuato 3D Tiles active version. That is
acceptable for reduced validation; full promotion should explicitly decide
whether the newly generated package should become active.

Generic remote-host proof on 2026-06-27:

- node: `remote-guanajuato-datafactory`;
- workflow run: `af1dc7a2-618d-4ddd-a1be-6219c655d5a5`;
- dispatch: `cba7e7b8-e05b-4962-8452-b25c50956125`;
- version: `remote-heavy-smoke-20260627T1547Z`;
- mode: `server-to-server-pull` with `--stage-runner=viewer-artifacts`;
- safety: `--no-activate`;
- result: imported as `validated`, workflow `succeeded`;
- artifact transfer, first pass: manifest created, all heavy artifacts
  checksummed, source bytes were still referenced because no copy/fetch adapter
  was executed yet.
- artifact transfer, hardened pass: runtime artifact bundle upload added for the
  same `server-to-server-pull` contract, with node-token auth, checksum and
  byte-size validation, safe tar member validation, runtime extraction, and
  `data-factory-runtime-artifact-bundle` ledger evidence.

Restored city input package proof on 2026-06-27:

- city: `guanajuato`;
- input mode: `restored-postgis-dump`;
- restored entities: 157,535;
- stage: `viewer-artifacts`;
- result: MVT, PMTiles, and 3D Tiles generated from the restored PostGIS input;
- boundary: no live data-plane tunnel to the original Twin Studio database was
  used for the restored-input stage proof.

## Open Gaps To Close

- Run the restored-input flow on a clean remote processing host, not only a local
  temporary PostGIS.
- Direct rsync/SFTP execution and object-storage fetch/push adapters; command
  planning and pushed runtime bundles are already covered.
- Promotion that can rewrite artifact registry paths to the final Twin Studio
  artifact store location after transfer when the transfer mode requires it.
- Operations UI should show data-plane mode, artifact-plane mode, transfer
  status, restore status, and promotion status separately.
- Stage-specific runners still needed for heavy semantic/environmental/provider
  outputs when those domains are ready for promotion.
