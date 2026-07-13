# Architecture Index

Updated: 2026-07-12

This is the canonical map for Twin Base Studio architecture documentation.
When older status notes disagree with this file, treat this file plus
`README.md` and `PRODUCT_TODO.md` as the current product truth.

## Current Product Posture

Twin Base Studio is a one-city, open-source Local Digital Twin runtime. The
current local portability gate is Guanajuato. Kharkiv remains production and
historical deployment evidence, but it is not the active local portability
blocker. The registry can still keep multiple cities for lab comparison, but
the installable product should run one primary city by default.

The platform currently delivers:

- PostGIS-backed public/open-data base twin,
- consolidated city inventory with source evidence,
- first standards projections for DCAT, OGC API Features, NGSI-LD, OpenAPI, and
  FIWARE-boundary work,
- urban-science, society/culture, and semantic-pack records,
- TwinQL/CQL2 city-object query API over `ldt_query.city_objects`,
- provider-neutral indicator catalogs, governed observations, city readiness
  validation, and entity threshold queries over `ldt_science`,
- canonical contextual subjects, typed physical/context relations, honest-grain
  indicator observations, portable semantic questions, and renderer manifests
  over `ldt_context`, `ldt_science`, `ldt_analysis`, and `ldt_query`,
- persisted city-object analysis selections over `ldt_analysis`,
- saved and published visual-query manifests for map, 3D, and immersive
  viewers,
- first generated 3D Tiles package pipeline for City 3D building assets,
- common registered viewer artifact lifecycle for PMTiles, MVT, and 3D Tiles,
- authenticated app-native API usage and workflow readiness telemetry,
- product-neutral offline Data Factory handoff, dispatch, result, and stage
  contract loop,
- configurable external instance profiles and accepted laboratory cycles for
  EU LDT Data Platform, Play & Visualise, Marketplace, Data Modeller, Data
  Space Ready, City Innovation Planner, Use Case & Scenarios, Identity
  Management, and the AI Notebook scenario path,
- explicit current, baseline, intervention, and other simulation worlds kept
  separate from canonical city reality and compared in Canvas.

The active implementation track is **Data Factory provider/productization**:
configured processing nodes, restorable city input packages, artifact transfer,
remote execution proof, operator-visible dispatch/result/promotion, and
registered PMTiles/MVT/3D Tiles delivery. Do not introduce a new numbered
"Phase 15" to describe this work; the old phase label is a historical bucket,
not the current plan.

It does not yet deliver:

- authority-operated production FIWARE/context-broker federation,
- RDF graph export or LDES streams,
- authority-approved operational semantic packs,
- authority-approved predictive/prospective/prescriptive scenario services,
- no-session public/signed embed access for published viewer manifests.

## Canonical Architecture Docs

- Product user manual, native capabilities, operating procedures, integration
  inventory, and evidence boundaries: `docs/USER_MANUAL.md` and the in-product
  `/docs` surface
- Product entry point: `README.md`
- Public GitHub release candidate:
  `https://github.com/polisplexity/open-local-digital-twin`
- Digital-twin model and language: `DIGITAL_TWIN_MODEL.md`
- Product backlog and phase gate: `docs/PRODUCT_TODO.md`
- Production phases and historical phase log: `docs/PRODUCTION_PHASES.md`
- Product architecture target: `docs/PRODUCT_ARCHITECTURE.md`
- LDT standards-native architecture and EU LDT Toolbox layer alignment:
  `docs/LDT_NATIVE_STANDARDS_ARCHITECTURE.md`
- Future data-backbone phases:
  `docs/FUTURE_DATA_BACKBONE_PHASES.md`
- Open Call 3 needs/provider capability intelligence:
  `docs/OPEN_CALL_3_NEEDS_AND_PROVIDER_CAPABILITIES.md`
- Semantic standardization and partner/city evidence:
  `docs/SEMANTIC_LAYER_STANDARDIZATION_PLAN_TALLINN_GAZIANTEP.md`,
  `docs/TALLINN_SEMANTIC_LAYER_WALKTHROUGH.md`,
  `docs/GAZIANTEP_SEMANTIC_LAYER_WALKTHROUGH.md`, and
  `docs/TALLINN_PUBLIC_DATA_SOURCE_PLAN.md`
- Analysis selection contract: `docs/ANALYSIS_SELECTION_LAB_CONTRACT.md`
- Data inventory: `docs/DATA_LAYER_INVENTORY_2026-05-16.md`
- Open-source production flow: `docs/OPEN_SOURCE_PRODUCTION_FLOW.md`
- Installation path: `docs/OPEN_SOURCE_INSTALLATION_GUIDE.md`
- Processing modes and OpenMPI: `docs/PROCESSING_MODES_OPENMPI.md`
- TwinQuery engine: `docs/TWIN_QUERY_ENGINE.md`
- Visual transport policy: `docs/VISUAL_TRANSPORT_POLICY.md`
- City 3D Tiles pipeline: `docs/CITY_3D_TILES_PIPELINE.md`
- Semantic layer architecture: `docs/SEMANTIC_LAYER_ARCHITECTURE.md`
- Semantic pack standard: `docs/SEMANTIC_PACK_STANDARD.md`
- Workflow onboarding and operator contract preparation:
  `docs/WORKFLOW_ONBOARDING_PREPARATION.md`
- Indicator compatibility, catalog governance, and threshold queries:
  `docs/INDICATOR_KPI_CATALOG.md`
- All-indicator Builder/SQL/Data Platform/CIP acceptance matrix:
  `docs/U4SSC_INDICATOR_QUERY_ACCEPTANCE.md`
- Contextual subjects, typed relations, portable semantic questions, and
  result-renderer manifests: `docs/CONTEXT_SUBJECT_QUERY_ARCHITECTURE.md`
- Dependency security remediation and required audit gate:
  `docs/DEPENDENCY_SECURITY_AUDIT_2026-07-12.md`
- EU LDT Data Space Ready local installation and EDC validation:
  `docs/EU_LDT_DATA_SPACE_READY_LAB.md`
- EU LDT configurable profile registry and full tool inventory:
  `docs/EU_LDT_TOOLBOX_INTEGRATION.md`
- EU LDT executable tool acceptance evidence:
  `docs/EU_LDT_TOOL_ACCEPTANCE_MATRICES.md`
- Generic OIDC identity profiles and EU LDT Keycloak acceptance:
  `docs/IDENTITY_PROVIDER_PROFILES.md`
- EU LDT Data Modeller schema, fixture, generator, and import cycle:
  `docs/EU_LDT_DATA_MODELLER_SCENARIO.md`
- EU LDT City Innovation Planner KPI, measurement, initiative, and indicator
  cycle: `docs/EU_LDT_CITY_INNOVATION_PLANNER_INTEGRATION.md`
- EU LDT Use Case & Scenarios orchestration and persisted-world cycle:
  `docs/EU_LDT_USE_CASE_SCENARIOS_INTEGRATION.md`
- EU LDT AI Notebook/KServe entity-level scenario acceptance:
  `docs/EU_LDT_AI_NOTEBOOK_UCS_INTEGRATION.md`
- Offline Data Factory runner: `docs/OFFLINE_DATA_FACTORY_RUNNER.md`
- Data Factory execution-provider plan:
  `docs/DATA_FACTORY_EXECUTION_PROVIDER_PLAN.md`
- Modularity/Data Factory closeout:
  `docs/MODULARITY_DATA_FACTORY_CLOSEOUT_2026-06-26.md`
- Data Factory remote server configuration:
  `docs/DATA_FACTORY_REMOTE_SERVER_CONFIGURATION.md`
- Data Factory real-node execution tracker:
  `docs/DATA_FACTORY_REAL_NODE_EXECUTION_TRACKER_2026-06-27.md`

## Current Runtime Architecture

The runtime is a modular monolith, not a distributed microservice platform yet.
That is intentional for the open-source product: a city should be able to run
the default installation as application + PostGIS + optional worker.

Runtime components:

- Next.js/Node app and authenticated UI/API shell,
- PostgreSQL/PostGIS as source of truth,
- provider-ingestion worker for queued open/provider layer jobs,
- runtime-data folders for seeds, generated cache/export artifacts, uploads,
  and local BIM assets,
- route families under `server/routes/*`,
- domain services under `server/services/*`,
- PostGIS repositories under `server/db/productionTwinStore/*`.

SQLite is not part of the runtime path. Legacy JSON is seed/mirror/cache/export
material only.

Future production packs such as controlled OSM extraction, S3-compatible object
storage, STAC/COG raster flows, optional time-series storage, signed public
embeds, and agentic workflow execution are tracked in
`docs/FUTURE_DATA_BACKBONE_PHASES.md`. They are not core dependencies until a
phase explicitly promotes them.

## PostGIS Domain Model

Current schema responsibilities:

- `app_*`: app runtime state, registry, auth, sessions, tokens, audit.
- `ldt_core`: consolidated city entities and geometry.
- `ldt_catalog`: datasets, distributions, source catalog records.
- `ldt_prov`: provenance, evidence, review and authority posture.
- `ldt_interop`: standards projections and publication outputs.
- `ldt_fiware`: FIWARE/NGSI-LD sync boundary.
- `ldt_science`: urban-science observations, scenario definitions, model
  records, simulation inputs/outputs, and simulation run records.
- `ldt_society`: social, economic, and cultural aggregate observations.
- `ldt_semantic`: semantic pack manifests, indicators, features, and workflows.
- `ldt_environment`: proxy phenomenon layers, source-backed terrain DEM,
  weather, hydrology, surface-runoff screening cells, object-attached
  environmental summaries, and environmental extractor
  definitions/runs/artifacts.
- `ldt_analysis`: analysis sessions, persisted city-object selections,
  selection members, selection metrics/styles, selection comparisons, portable
  subject-query blueprints, city bindings, and query-run manifests.
- `ldt_context`: statistical areas, cohorts, service zones, organizations,
  elections, policies, flow accounts, and typed links to physical assets.
- `ldt_viewer`: viewer aggregates, density grids, selection units, query events,
  visual share manifests, and generated 3D Tiles package registry.
- `ldt_ops`: API usage, workflow readiness, jobs, and operations telemetry.
- `ldt_query`: read-only query views such as `city_objects`.

## Query And Visualization Architecture

TwinQL/CQL2 is the advanced query path. It accepts allowlisted JSON predicates,
spatial scopes, multi-clause unions, and render intent, then compiles to safe
parameterized PostGIS SQL over `ldt_query.city_objects`.

The complementary `oldt-subject-query` path queries city, contextual, and
physical subjects at the observation's honest grain. It returns a result
manifest that selects map/choropleth, chart, relationship summary, or table and
stores reusable questions separately from city bindings and execution runs.

The TwinQL boundary is now service-shaped inside the monolith:

- `server/routes/liveFeature/twinQueryHttpAdapter.mjs` adapts HTTP requests,
  viewer transport responses, and tile/bootstrap payloads.
- `server/services/twinQuery/twinQueryUseCaseService.mjs` is the internal
  use-case boundary for contract, query, tile, and recorded-run operations.
- `server/db/productionTwinStore/twinQueryRepository.mjs` owns PostGIS SQL,
  query execution, MVT production, and query-event persistence.
- `src/components/twin-module/query/*` owns frontend query construction,
  controller state, saved visual-query manifests, and recorded-run grouping.

Non-query live viewer features now follow the same route/service/repository
shape:

- `server/routes/liveFeature/viewportFeatureRoutes.mjs` and
  `server/services/liveFeature/viewportFeatureUseCaseService.mjs` own viewport
  feature reads, building coverage, layer capabilities, and legacy feature
  vector tiles.
- `server/routes/liveFeature/selectionRoutes.mjs` and
  `server/services/liveFeature/selectionUseCaseService.mjs` own selected-area
  unit and summary reads.
- `server/routes/liveFeature/shareManifestRoutes.mjs` and
  `server/services/liveFeature/shareManifestUseCaseService.mjs` own visual
  share manifests, publish state, and embed contracts.
- `server/routes/liveFeature/semanticQueryRoutes.mjs`,
  `server/routes/liveFeature/semanticQueryHttpAdapter.mjs`, and
  `server/services/liveFeature/semanticQueryUseCaseService.mjs` own the
  legacy/simple semantic-query bridge. This keeps it separate from TwinQL/CQL2.
- `server/routes/liveFeature/analysisSelectionRoutes.mjs`,
  `server/services/analysisSelection/selectionLabService.mjs`, and
  `server/db/productionTwinStore/analysisSelectionRepository.mjs` own persisted
  city-object analysis selections, selection members, and comparison records
  over `ldt_analysis`. This is the generic selection lab for any city object,
  not a building-specific path.
- `server/routes/liveFeatureRoutes.mjs` is the live-feature aggregator for
  map/viewer manifests, TwinQL route handlers, and delegated route
  registration.

The three visual surfaces are separate product modules:

- `/analytical-map`: analytical map for city analysts.
- `/city-3d`: City 3D, a CesiumJS spatial inspection surface.
- `/civic-xr`: Civic XR, a lightweight stakeholder/XR surface.

Retired route aliases `/map`, `/municipal`, `/public`, `/civic-view`,
`/dashboard`, and `/apps/digital-twin/*` are no longer product routes. They
should return 404 instead of redirecting, so old links do not hide dead code.

City 3D is still one Cesium browser runtime, but it is no longer one
undifferentiated script block. The current server-rendered modules are:

- `server/services/baseTwin/viewerRuntimes/cityCesiumRuntime.mjs`: runtime
  composition, scene boot, base context, phenomena mode orchestration, and
  message routing.
- `server/services/baseTwin/viewerRuntimes/cesium/cityCesiumSpatialRuntime.mjs`:
  GeoJSON/primitive conversion, query-scope bounds, radius/viewport/custom
  polygon bounds, and query fit helpers.
- `server/services/baseTwin/viewerRuntimes/cesium/cityCesiumCameraRuntime.mjs`:
  Cesium-native `ScreenSpaceCameraController` setup, bounded fit actions,
  context-menu suppression, height stabilization, and payload/query camera
  framing.
- `server/services/baseTwin/viewerRuntimes/cesium/cityCesiumQuerySelectionRuntime.mjs`:
  one query-selection adapter for live TwinQL messages, saved/shared query
  manifests, replayed query history, stale source cleanup, and clear-query
  behavior.

City 3D now also has a generated-asset pipeline:

- `server/services/city3dTiles/buildCityTilesetService.mjs` builds the first
  building-extrusion 3D Tiles package from `ldt_query.city_objects`.
- `server/services/city3dTiles/glbBuilder.mjs` writes glTF 2.0 binary geometry
  without adding a heavy external tiler dependency.
- `server/services/city3dTiles/assetStore.mjs` stores versioned packages under
  `runtime-data/3d-tiles`.
- `server/db/productionTwinStore/city3dTilesetRepository.mjs` records tilesets
  in `ldt_viewer.city_3d_tilesets`.
- `server/routes/live3dTilesRoutes.mjs` exposes tileset discovery and asset
  serving through `/api/live/:cityId/3d-tilesets` and
  `/api/live/:cityId/3d-tiles/...`.

This is a data-engineering foundation for professional Cesium assets. It does
not yet replace the query-scoped primitive runtime, and it still needs spatial
LOD subdivision, feature metadata, and object-storage publication before it is
the default large-city City 3D path.

The `/cockpit` route is the executive control-room surface for product truth:
readiness, key counts, open gaps, recent controlled runs, and links to
specialized workspaces. It should stay small and must not own technical tables,
workflow forms, or visual-map controls.

The `/workspace` route keeps the detailed technical workspace while modules are
split into stronger product routes: inventory, sources, standards,
science/society, semantic packs, and operations.

The `/operations` route family owns operational control surfaces:
overview, API catalog/OpenAPI, telemetry, ingestion jobs, and controlled
workflow runs.

The `/standards` route owns the Local Digital Twin interoperability surface:
DCAT, OGC API Features, NGSI-LD/FIWARE, JSON-LD contexts, OpenAPI posture,
future RDF/LDES/ODRL work, MIMs Plus, and LORDIMAS readiness. It presents each
standard family by state: implemented, generated, validated, federated, and
authority-approved.

Viewer artifacts now have a common lifecycle registry in
`ldt_viewer.viewer_artifacts`. MVT directories, PMTiles archives, and 3D Tiles
packages can be tracked by city, version, generator, checksum, byte size, bounds,
status, active flag, and invalidation source. The 3D-specific
`ldt_viewer.city_3d_tilesets` table remains as package metadata, while the
common registry gives Operations and future deploy tooling one place to inspect
visual artifacts. Live delivery resolves registered artifacts first through
`server/services/viewerArtifacts/viewerArtifactDelivery.mjs`; filesystem
modified time is not the source of truth for `latest`.

The default secondary rail for all three visual modules is query-contract
first. It owns structured TwinQL/CQL2 queries, saved/replayed visual-query
manifests, area context, selection inspection, counts, and movement/status. Old
manual city-radius, bundle, layer-card, command, and fidelity controls are not
part of the product rail unless a future advanced-mode contract explicitly
reintroduces them.

Civic XR architecture decision:

- `/civic-xr` is the canonical public/stakeholder XR route.
- `/civic-view` and `/public` are retired user-facing aliases. The embedded
  transport route `/live/current/immersive` remains because it is the runtime
  iframe endpoint consumed by the product shell.
- The open-core runtime is Babylon.js/WebXR. Cesium remains the City 3D runtime;
  Unreal/Unity are future optional adapters, not a baseline dependency.
- See `docs/CIVIC_XR_ARCHITECTURE_DECISION_2026-06-02.md`.

Saved visual-query manifests:

- are stored in `ldt_viewer.visual_share_manifests`,
- use `mode = twin-query-manifest`,
- are separate from runtime query history in `ldt_viewer.semantic_query_events`,
- can be published with `viewer-share-manifests/:shareKey/publish`,
- can boot map, 3D, and immersive viewers with `?shareKey=...`.

Current embed limitation: published manifests still require the authenticated
runtime path. Public/signed no-session embed access remains a product/security
hardening task.

Persisted analysis selections:

- are stored in `ldt_analysis.selection_sets` and
  `ldt_analysis.selection_set_members`,
- are produced from the same TwinQL/CQL2 query contract over
  `ldt_query.city_objects`,
- store object identity and compact metadata while leaving source geometry in
  the inventory/query layer,
- can be compared with union, intersection, difference, and symmetric
  difference,
- should become the shared analysis object for map, City 3D, Civic XR, APIs,
  embeds, and future simulation workflows.

2026-06-01 code audit: the shared visual query/manifest boundary for `/analytical-map`,
`/city-3d`, and `/civic-xr` is implemented. The audit is recorded in
`docs/VISUAL_QUERY_CONTRACT_CODE_AUDIT_2026-06-01.md`, and the guard is
`npm run test:visual-contract-boundary-smoke`. Do not reopen "extract the shared
visual query/manifest contract" as a Phase 13 implementation item; remaining
work is runtime quality, signed embed policy, and future service extraction only
if a deployment boundary requires it.

## Modularization Docs

- Backend/service plan: `docs/SERVICE_MODULARIZATION_PLAN.md`
- Execution plan: `docs/MODULARIZATION_EXECUTION_PLAN_2026-05-22.md`
- Workspace UI review: `docs/WORKSPACE_UI_ARCHITECTURE_REVIEW_2026-05-22.md`
- Phase 13 visual rebuild: `docs/PHASE_13_VISUAL_SURFACES_REBUILD_PLAN.md`
- Viewer status: `docs/VIEWER_UI_STATUS.md`
- Semantic query UI contract: `docs/SEMANTIC_QUERY_UI_CONTRACT.md`
- TwinQL/CQL2 engine: `docs/TWIN_QUERY_ENGINE.md`
- Visual query/manifest code audit:
  `docs/VISUAL_QUERY_CONTRACT_CODE_AUDIT_2026-06-01.md`
- Map embed/selection contract: `docs/MAP_EMBED_AND_SELECTION_CONTRACT.md`
- Cesium municipal 3D migration:
  `docs/CESIUM_3D_MIGRATION_DECISION.md`
- City 3D Tiles pipeline:
  `docs/CITY_3D_TILES_PIPELINE.md`

## Generated Documentation

`docs/generated/capability_matrix.json` is generated by:

```bash
npm run product:capability-matrix -- --city=guanajuato
```

For the Kharkiv production/history reference, use:

```bash
npm run product:capability-matrix -- --city=kharkiv
```

If route families, readiness wording, or phase numbering changes, update the
generator source first and regenerate the file. Do not hand-edit generated
capability output except as a temporary debugging step.

## Documentation Caveats

Some files remain useful evidence, but they are not current architecture source
when they disagree with this index, `README.md`, `PRODUCT_TODO.md`, or
`LDT_NATIVE_STANDARDS_ARCHITECTURE.md`.

Historical or closeout records:

- `docs/GIT_TRACE_RECOVERY_PLAN_2026-05-28.md`: repository recovery note.
- `docs/PRODUCTION_PHASES.md`: production rebase history and old phase log.
- `docs/PHASE_13_VISUAL_SURFACES_REBUILD_PLAN.md`: Phase 13 visual closeout and
  retained visual debt.
- `docs/PHASE_14_OPEN_DATA_WORKFLOW_RUNNER_CLOSEOUT.md`: first open-data/Data
  Factory runner closeout.
- `docs/KHARKIV_OPERATOR_RUNBOOK.md`: production/history runbook, not local
  portability gate.
- `docs/KHARKIV_MEETING_READINESS.md`,
  `docs/KHARKIV_CITY_DATA_ETL_WORKFLOW_2026-06-03.md`,
  `docs/KHARKIV_OSM_PBF_EXTRACTION_2026-06-03.md`: Kharkiv-specific evidence.
- `docs/ADAZI_EXTERNAL_DUMP_PRESERVATION_2026-06-04.md`: preserved external
  small-city dump, not an active runtime gate.
- `docs/DATA_FACTORY_REMOTE_HOST_TEST_2026-06-27.md`: remote-host test notes;
  use `DATA_FACTORY_REAL_NODE_EXECUTION_TRACKER_2026-06-27.md` for current
  tracker status.

Internal/lab boundary notes:

- `docs/COMMAND_CENTER_BOUNDARY.md`: separates this product from broader
  command-center tooling.
- `docs/CIMAT_SUPERCOMPUTO_ACCESS.md`: lab/HPC access note. It is not a
  product dependency, not an open-source install requirement, and must not be
  used to name a hardcoded execution mode in product UX or public docs.

Generated artifacts:

- `docs/generated/capability_matrix.json` is generated output. Regenerate it
  from code before using it as evidence.

Loose planning notes should be folded into one of the canonical documents above
before they become implementation authority.
