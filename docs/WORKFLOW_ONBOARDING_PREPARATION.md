# Workflow Onboarding Preparation

This note defines the light operational layer we need before deep-diving into
Open Source City Builder, Data Factory Compute Handoff, Standards Publication
Refresh, or any new workflow added later.

## Why this exists

The current system has real pieces, but the product language is confusing:
workflow, step, job, stage, runner, artifact, promotion, tiles, and standards
refresh are not the same thing.

Before adding more workflows, we need a stable operator contract so that each
workflow can answer:

- What does it decide?
- What does it execute?
- What does it only register?
- Which table rows prove it happened?
- Which files or artifacts are produced?
- Which downstream workflow should run next?
- What does `succeeded` actually mean?

## Shared vocabulary

### Workflow

An auditable operation in `ldt_ops.workflow_runs`.

Examples:

- `phase14-open-data-workflow-runner` / Open Source City Builder
- `offline-data-factory-handoff` / Data Factory Compute Handoff
- `standards-publication-refresh` / Standards Publication Refresh
- `external-model-enrichment-exchange` / External Model Enrichment

### Step

A workflow-local audit step in `ldt_ops.workflow_steps`.

Steps explain what the workflow did, but they are usually not standalone
scripts. They are labels and checkpoints executed by backend service code.

### Job

A queued unit of provider/data ingestion in `public.layer_ingestion_jobs`.

Examples:

- `osm-local-extract`
- `overture-buildings`
- `overture-roads`
- `mvt-cache-refresh`

Jobs are created from a source plan or API request. Workers execute them.

### Stage

A Data Factory compute unit with an input/output/promotion contract.

Examples:

- `ingestion-queue`
- `environmental-extractors`
- `viewer-artifacts`
- `semantic-materialization`

Stages may be local, sidecar, external-worker, HPC, VPS, or manual-import.

### Runner

The process that actually executes work:

- backend API service
- provider ingestion worker
- Data Factory local runner
- same-server sidecar
- server-to-server pull node
- HPC/VPS script runner
- external model provider

### Artifact

A file or record proving a workflow output.

Examples:

- source-plan artifact
- handoff JSON
- result JSON
- MVT directory
- PMTiles file
- 3D Tiles package
- model result CSV/GeoJSON
- standards publication report

### Promotion

The moment output becomes part of the city twin.

Promotion can write to:

- `ldt_core`
- `ldt_prov`
- `ldt_catalog`
- `ldt_environment`
- `ldt_semantic`
- `ldt_enrichment`
- `ldt_viewer`
- `ldt_interop`

## Current three-workflow framing

### Open Source City Builder

Purpose:

Build or refresh the base city twin from open data.

Current behavior:

1. Resolve city source plan.
2. Validate city boundary.
3. Create provider packages.
4. Register provider ingestion jobs.
5. Register environmental extractor runs.
6. Write audit artifacts.

Important limitation:

It can finish as `succeeded` after registering jobs and extractor runs. That
does not always mean every provider job ran, data was promoted, viewer artifacts
were regenerated, and standards were refreshed.

Near-term fix:

Expose a clearer status chain:

- `source_plan_resolved`
- `jobs_registered`
- `jobs_executed`
- `postgis_promoted`
- `viewer_refreshed`
- `standards_published`

### Data Factory Compute Handoff

Purpose:

Run heavy or external compute outside the normal UI/backend path, then return
validated outputs to OLDT.

Current executable stages:

- `ingestion-queue`
- `environmental-extractors`
- `viewer-artifacts`
- `semantic-materialization`

Important limitation:

The `ingestion-queue` stage currently creates/reuses provider jobs. It is not
the same as running the full Open Source City Builder and all provider workers.

Near-term fix:

Define a higher-level "city build pipeline" that can chain:

1. Source plan.
2. Ingestion job creation.
3. Provider worker execution.
4. PostGIS promotion.
5. Viewer artifact generation.
6. Standards refresh.

### Standards Publication Refresh

Purpose:

Republish the current PostGIS/OLDT state through standards contracts.

Expected outputs:

- DCAT catalog
- OGC API Features collections/items
- NGSI-LD/FIWARE projections
- OpenAPI/readiness
- model-output publication metadata

Current limitation:

The workflow definition exists and runs can be queued, but the general workflow
execute route currently executes only Open Source City Builder. Standards needs
a real executor and trigger policy.

Near-term fix:

Implement `executeStandardsPublicationRefreshOnce` and call it after:

- source ingestion promotion
- external model import
- Data Factory result promotion
- semantic materialization
- manual admin publish request

## Initial modifications before deep dives

These changes should happen before a detailed redesign of each individual
workflow.

### 1. Add workflow definition manifests

Create a manifest shape for every workflow:

```json
{
  "workflowKey": "example-workflow",
  "operatorName": "Example Workflow",
  "purpose": "What business operation this performs.",
  "inputContract": {
    "required": [],
    "optional": []
  },
  "decisions": [],
  "steps": [],
  "jobsCreated": [],
  "stagesUsed": [],
  "runners": [],
  "writes": [],
  "artifacts": [],
  "standardsAffected": [],
  "terminalStates": [],
  "nextWorkflowSuggestions": []
}
```

Goal:

New workflows should not start as UI text or ad hoc code. They start as a
manifest, then code and UI derive from it.

### 2. Normalize status semantics

Do not use one `succeeded` to mean everything.

Minimum status fields:

- orchestration status: did the workflow controller finish?
- execution status: did the worker/script/model run?
- promotion status: did outputs enter PostGIS/OLDT?
- publication status: did standards/viewers reflect the new data?
- authority status: is it official, candidate, derived, or simulated?

### 3. Add an operator trace view per workflow run

For each run, show:

- source plan used
- jobs created
- jobs executed
- tables written
- artifacts generated
- standards refreshed
- next action

This should be API-first and UI-readable. The UI must not be the source of
truth.

### 4. Add a workflow-to-workflow chain policy

Define which workflow should suggest or trigger the next one.

Default chain:

```text
Open Source City Builder
  -> provider job execution
  -> Data Factory viewer-artifacts if heavy artifacts are needed
  -> Standards Publication Refresh
```

External model chain:

```text
External Model Enrichment
  -> model result import
  -> Standards Publication Refresh
  -> optional viewer/query preset refresh
```

Data Factory chain:

```text
Data Factory Compute Handoff
  -> result import/promotion
  -> Standards Publication Refresh
```

### 5. Add a workflow intake checklist

Every new workflow must answer:

- Who requests it?
- What inputs are required?
- Does it only decide/register, or does it execute?
- Is it synchronous or asynchronous?
- Where does compute happen?
- What tables does it write?
- What artifacts prove the result?
- What standards endpoints change?
- What viewer/map/query surfaces change?
- What is the rollback story?
- What is the authority/provenance status?

### 6. Add API-first run commands

For each workflow, document one canonical API path:

- create run
- approve if needed
- execute or dispatch
- inspect run trace
- download artifacts
- refresh standards

The UI can call these, but operators and external systems should not depend on
manual clicking.

### 7. Make source plans and stages visible as contracts

Expose read endpoints and UI panels for:

- active city source plan
- source plan override history
- provider package list
- allowed ingestion actions
- Data Factory stage registry
- stage runner profiles
- standards publication scope

This removes the current ambiguity around "who decided this job exists?"

## First-pass implementation

Implemented API contracts:

- `GET /api/admin/workflow-contracts?cityId=:cityId`
- `GET /api/admin/workflow-intake-checklist`
- `GET /api/admin/workflows/:workflowKey/contract?cityId=:cityId`
- `GET /api/admin/cities/:cityId/workflow-source-contracts`
- `GET /api/admin/workflow-runs/:runId/trace`

Implemented service modules:

- `server/services/ldtOps/workflowContractsService.mjs`
- `server/services/ldtOps/workflowRunTraceService.mjs`

Implemented UI behavior:

- Operations now loads workflow manifests, status semantics, chain policy,
  intake checklist, provider capabilities, city source contracts, and Data
  Factory stage contracts.
- `Inspect` now reads the run trace endpoint and separates orchestration,
  execution, promotion, publication, and authority status.
- The selected run view now shows jobs, extractor runs, table writes,
  artifacts, checksums, and next suggested actions.

Remaining gap:

- `Standards Publication Refresh` is represented in the contract and chain
  policy, but still needs a real executor before it can be an automatic publish
  step after every promoted ingestion/model result.

## Workflow template for future additions

Use this template before adding a new workflow.

### Name

Human-readable name:

Internal key:

### Product purpose

What does this workflow do for a city/operator/client?

### Trigger

- manual API
- scheduled
- after another workflow
- external callback
- tenant/client request

### Inputs

Required:

Optional:

Source of inputs:

### Decisions

What policy decisions does the workflow make?

### Execution model

- controller-only
- local backend
- provider worker
- Data Factory local
- Data Factory external
- model provider
- manual import

### Data writes

Tables/schemas written:

Rows expected:

Idempotency key:

### Artifacts

Artifacts generated:

Checksums required:

Download/export path:

### Standards impact

Does it update:

- DCAT
- OGC
- NGSI-LD/FIWARE
- OpenAPI
- MVT/PMTiles/3D Tiles
- model-output catalog

### States

What means:

- created
- queued
- running
- succeeded
- failed
- blocked
- promoted
- published

### Next workflow

What should happen after this succeeds?

### Operator UI

What should the user see?

What should the user never need to infer from raw JSON?

## Recommended immediate backlog

1. Create a manifest/contract object for the current three workflows.
2. Add status fields that distinguish orchestration, execution, promotion, and
   publication.
3. Implement a real Standards Publication Refresh executor.
4. Add API-first "run trace" endpoint for workflow runs.
5. Add source plan/stage registry preview panels so operators can see the
   recipe before running.
6. Add chain suggestions after each run: "run provider worker", "build viewer
   artifacts", "refresh standards".
7. Document canonical API calls for the current three workflows.

## Decision

Do not add more workflows until the workflow intake checklist and run trace
contract exist. Otherwise each new workflow will increase confusion and make
operations harder to teach.
