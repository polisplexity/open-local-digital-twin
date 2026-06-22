# Architecture Index

Updated: 2026-06-02

This is the canonical map for Twin Base Studio architecture documentation.
When older status notes disagree with this file, treat this file plus
`README.md` and `PRODUCT_TODO.md` as the current product truth.

## Current Product Posture

Twin Base Studio is a one-city, open-source Local Digital Twin runtime. The
current demo city is Kharkiv. The registry can still keep multiple cities for
lab comparison, but the installable product should run one primary city by
default.

The platform currently delivers:

- PostGIS-backed public/open-data base twin,
- consolidated city inventory with source evidence,
- first standards projections for DCAT, OGC API Features, NGSI-LD, OpenAPI, and
  FIWARE-boundary work,
- urban-science, society/culture, and semantic-pack records,
- TwinQL/CQL2 city-object query API over `ldt_query.city_objects`,
- persisted city-object analysis selections over `ldt_analysis`,
- saved and published visual-query manifests for map, 3D, and immersive
  viewers,
- first generated 3D Tiles package pipeline for City 3D building assets,
- authenticated app-native API usage and workflow readiness telemetry.

It does not yet deliver:

- real deployed FIWARE context-broker federation,
- RDF graph export or LDES streams,
- authority-approved operational semantic packs,
- predictive/prospective/prescriptive scenario services,
- no-session public/signed embed access for published viewer manifests.

## Canonical Architecture Docs

- Product entry point: `README.md`
- Digital-twin model and language: `DIGITAL_TWIN_MODEL.md`
- Product backlog and phase gate: `docs/PRODUCT_TODO.md`
- Production phases and historical phase log: `docs/PRODUCTION_PHASES.md`
- Product architecture target: `docs/PRODUCT_ARCHITECTURE.md`
- Future data-backbone phases:
  `docs/FUTURE_DATA_BACKBONE_PHASES.md`
- Open Call 3 needs/provider capability intelligence:
  `docs/OPEN_CALL_3_NEEDS_AND_PROVIDER_CAPABILITIES.md`
- LDT standards-native architecture: `docs/LDT_NATIVE_STANDARDS_ARCHITECTURE.md`
- Analysis selection contract: `docs/ANALYSIS_SELECTION_LAB_CONTRACT.md`
- Data inventory: `docs/DATA_LAYER_INVENTORY_2026-05-16.md`
- Open-source production flow: `docs/OPEN_SOURCE_PRODUCTION_FLOW.md`
- Installation path: `docs/OPEN_SOURCE_INSTALLATION_GUIDE.md`

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
  selection members, selection metrics/styles, and selection comparisons.
- `ldt_viewer`: viewer aggregates, density grids, selection units, query events,
  visual share manifests, and generated 3D Tiles package registry.
- `ldt_ops`: API usage, workflow readiness, jobs, and operations telemetry.
- `ldt_query`: read-only query views such as `city_objects`.

## Query And Visualization Architecture

TwinQL/CQL2 is the advanced query path. It accepts allowlisted JSON predicates,
spatial scopes, multi-clause unions, and render intent, then compiles to safe
parameterized PostGIS SQL over `ldt_query.city_objects`.

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

- `/map`: analytical map for city analysts.
- `/municipal`: City 3D, a CesiumJS spatial inspection surface.
- `/public`: Civic XR, a lightweight public-safe story surface.

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

The `/cockpit` route is the Workspace/control-room surface for product truth:
inventory, sources, standards, science/society, semantic packs, operations, and
readiness. It should not own visual-map controls.

The default secondary rail for all three visual modules is query-contract
first. It owns structured TwinQL/CQL2 queries, saved/replayed visual-query
manifests, area context, selection inspection, counts, and movement/status. Old
manual city-radius, bundle, layer-card, command, and fidelity controls are not
part of the product rail unless a future advanced-mode contract explicitly
reintroduces them.

Civic XR architecture decision:

- `/civic-xr` is the canonical public/stakeholder XR route.
- `/civic-view`, `/public`, and `/live/current/immersive` remain compatibility
  aliases during migration.
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

2026-06-01 code audit: the shared visual query/manifest boundary for `/map`,
`/municipal`, and `/public` is implemented. The audit is recorded in
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
npm run product:capability-matrix -- --city=kharkiv
```

If route families, readiness wording, or phase numbering changes, update the
generator source first and regenerate the file. Do not hand-edit generated
capability output except as a temporary debugging step.

## Documentation Caveats

Some files remain historical evidence rather than current architecture source:

- `PROMISE_DELIVERY_AUDIT_2026-05-10.md`
- `PROMISE_VS_CODE_EVALUATION_2026-05-10.md`
- `REALITY_CHECK_2026-05-10.md`
- older sections inside `docs/PRODUCTION_PHASES.md`
- older generated capability output if not regenerated after code changes

Those documents are useful for traceability, but they should not override this
index, the README, the product TODO, or the latest Phase 13 plan.
