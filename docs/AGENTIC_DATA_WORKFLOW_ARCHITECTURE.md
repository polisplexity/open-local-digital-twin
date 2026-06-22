# Agentic Data Workflow Architecture

Updated: 2026-05-17

This note defines how agentic AI should control Twin Base Studio without making
the city twin fragile or non-auditable.

## Core Rule

Agents can suggest, operate, explain, and prepare work. They must not become the
source of truth.

The durable system of record remains:

- `ldt_catalog` for datasets and data publication metadata.
- `ldt_prov` for source evidence, activities, matching evidence, review
  decisions, and lineage.
- `ldt_core` for consolidated city inventory.
- `ldt_interop`, `ldt_fiware`, `ldt_viewer`, `ldt_science`, `ldt_society`, and
  `ldt_semantic` for standards projections, live context, viewer aggregates,
  science, society/culture, and semantic packs.
- `ldt_ops` for workflow control, agent policy, approvals, artifacts, and API
  usage events.

## Why `ldt_ops`

The LDT-standard schemas should not be polluted with operational control state.
`ldt_ops` is the lightweight operations layer that lets AI agents and humans
operate the product safely.

It stores:

- workflow definitions,
- workflow runs,
- workflow steps,
- workflow artifacts,
- workflow approvals,
- API usage events.

This keeps workflow control separate from city facts while still linking to
city IDs, datasets, source features, and provenance records.

## Initial Reference Workflows

### `open-data-city-bootstrap`

Purpose: create or refresh the public-data base twin from open sources.

Expected sources:

- OSM / Overpass / extracts
- Overture Maps
- Wikipedia / Wikidata-style context
- OGC API Features
- CKAN
- STAC
- CSV
- GeoJSON

Expected writes:

- `ldt_catalog.datasets`
- `ldt_prov.source_features`
- `ldt_core.city_entities`
- `ldt_viewer.city_summary_cache`

### `private-provider-validation`

Purpose: validate city-private or third-party provider data before it can
enrich the consolidated twin.

Expected sources:

- GeoJSON
- CSV
- OGC API Features / WFS
- STAC
- CityJSON
- IFC
- GeoPackage
- Shapefile

Important rule:

Agents may suggest mappings and run validation, but they cannot accept
authority-grade status or publish private data without human/city approval.

### `standards-publication-refresh`

Purpose: regenerate outputs after ingestion or validation.

Expected writes:

- `ldt_interop`
- `ldt_fiware`
- `ldt_viewer`
- `ldt_science`
- `ldt_society`
- `ldt_semantic`

Expected outputs:

- DCAT
- NGSI-LD
- OGC API Features
- FIWARE sync state
- viewer summaries
- semantic-pack reports
- quality caveats

## Agent Control Model

Agents can:

- find potential open-data sources,
- propose a source plan,
- map source columns to target fields,
- run approved open-data workflows,
- explain validation failures,
- compare source coverage,
- prepare city review reports,
- trigger standards refreshes,
- generate operator summaries.

Agents cannot:

- mark data as city-authoritative,
- publish private/provider data without approval,
- skip validation,
- delete canonical city inventory,
- change API versions or contracts without review,
- change LDT schema migrations without normal code review,
- make unsupported claims about damage, population impact, reconstruction
  priority, or public-service demand.

## Lightweight Execution Strategy

The first implementation should stay light:

```text
Node/Express API
  exposes workflow/capability APIs

Python workflow worker
  runs ingestion, validation, normalization, and export commands

PostGIS
  stores LDT data, workflow state, provenance, and audit state

Agent command center
  calls explicit tools/API actions, never raw database writes
```

Prefect can be added as the first external orchestrator when we need richer
scheduling, retries, and workflow UI. Dagster remains a later option if the
product becomes a formal data-asset platform.

## Current Implemented Foundation

Implemented now:

- `ldt_ops.workflow_definitions`
- `ldt_ops.workflow_runs`
- `ldt_ops.workflow_steps`
- `ldt_ops.workflow_artifacts`
- `ldt_ops.workflow_approvals`
- `ldt_ops.api_usage_events`
- reference workflow definitions for open data, provider/private validation,
  and standards publication
- live city capability API:
  - `GET /api/live/current/capabilities`
  - `GET /api/live/:cityId/capabilities`
- live city operations API:
  - `GET /api/live/current/operations/report`
  - `GET /api/live/:cityId/operations/report`
  - exposes the API catalog, API usage telemetry, ingestion jobs, workflow
    runs, pending approvals, readiness checks, and API-usage gaps
- live metrics summary API:
  - `GET /api/live/current/operations/metrics-summary`
  - `GET /api/live/:cityId/operations/metrics-summary`
  - exposes app-native JSON metrics for API traffic, latency, errors,
    ingestion, workflows, approvals, and inventory without requiring
    Prometheus or Grafana in the core open-source install
- live OpenAPI contract:
  - `GET /api/live/current/openapi.json`
  - `GET /api/live/:cityId/openapi.json`
  - publishes the authenticated OpenAPI 3.1 API contract generated from the
    operations catalog
- admin workflow definition API:
  - `GET /api/admin/workflows`
- admin workflow run and approval APIs:
  - `GET /api/admin/workflow-runs`
  - `POST /api/admin/workflows/:workflowKey/runs`
  - `GET /api/admin/workflow-runs/:runId`
  - `POST /api/admin/workflow-runs/:runId/approvals/:approvalKey/decision`
- smoke test:
  - `npm run test:ldt-ops-smoke -- --city=kharkiv`

## Next Implementation Steps

Visual surfaces now come first as Phase 13. The workflow runner starts after
the map, municipal 3D, and public immersive surfaces are stable enough to show
Kharkiv without confusing the product truth.

1. Rebuild the three visual surfaces on the shared LDT capability/viewer
   contracts:
   - analytical map,
   - municipal 3D,
   - public immersive.
2. Add a Python `workflows/` package with pure ingestion/validation functions.
3. Add a small worker that claims approved `ldt_ops.workflow_runs`.
4. Connect `open-data-city-bootstrap` to existing commands:
   - `db:ldt:reingest-open`
   - `db:ldt:consolidate`
   - `db:ldt:refresh-viewer-aggregates`
   - `db:ldt:generate-interop`
   - `db:ldt:generate-urban-science`
   - `db:ldt:generate-society`
5. Keep workflow execution blocked behind approvals, artifacts, and audit
   state before letting agentic control operate the runner.
   - `db:ldt:generate-semantic-packs`
6. Add approval gates before authority/private/provider publication steps.
7. Expand the OpenAPI catalog with provider/admin mutation request bodies and
   versioned `/v1` aliases.
8. Add an optional Prometheus/Grafana ops pack over `ldt_ops.api_usage_events`,
   ingestion jobs, workflow state, and database health only after the lightweight
   JSON metrics contract is stable.
