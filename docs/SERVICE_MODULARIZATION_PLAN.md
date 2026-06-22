# Service Modularization Plan

Updated: 2026-06-01

Twin Base Studio is moving away from large application files toward explicit
service and route boundaries. This is an architecture-hardening track, not a UI
feature phase.

## Problem

The current runtime accumulated too much responsibility in a few files:

- `server/index.mjs` mixed app bootstrap, security middleware, auth routes,
  admin APIs, provider APIs, live APIs, standards APIs, and viewer HTML routes.
- `server/services/baseTwinService.mjs` has been reduced to a small facade.
  Cache ownership,
  shared viewer shell rendering, shared payload constants, pure geospatial
  helpers, pure payload helper functions, feature categories, open-data
  fetchers, feature collection assembly, and 3D scene payload assembly have
  been moved out. The latest cut also moved inventory/metric assembly,
  production-record payload assembly, open-data base-payload orchestration, and
  page renderer functions out of the service. The remaining risk is now more
  explicit: each visual surface has its own renderer module under
  `server/services/baseTwin/viewerRenderers/`, but those renderers still embed
  large browser runtimes that should be extracted during the Phase 13 visual
  rebuild.
- `server/db/productionTwinStore.mjs` has now been reduced to a compatibility
  facade over domain repositories. `ldtOpsService.mjs` has also been reduced to
  a compatibility facade. The provider ingestion service is now also a small
  facade over source-family action modules and queued job orchestration. The
  remaining backend risk is no longer those facades themselves, but the visual
  renderer client runtimes and any UI code that still mixes product modules,
  controls, and surface rendering.
- Frontend cockpit components still mix navigation architecture, module data
  fetching, rendering, and visual-surface entry points.

That shape makes the product hard to reason about and too easy to break.

## Target Shape

The open-source one-city runtime should be modular before it becomes more
powerful:

| Layer | Boundary |
| --- | --- |
| HTTP shell | Express/Next bootstrap, security middleware, auth guard, observability middleware. |
| Route modules | One route module per product domain: auth, platform, admin, provider, live inventory, standards, operations, viewer shells. |
| Application services | Product use cases: open-data bootstrap, inventory consolidation, source evidence, standards publication, semantic packs, workflows, visual payloads. |
| Data stores | PostGIS repositories grouped by schema/domain, not one giant store. |
| UI modules | Workspace modules and visual surfaces as separate components with clear control ownership. |
| Optional workers | Workflow runners and ingestion workers kept outside the web request path. |

## Route Cuts Completed

The first modularization cuts keep behavior stable and shrink `server/index.mjs`
back into an HTTP composition shell:

- Added `server/http/rateLimit.mjs`.
- Added `server/http/security.mjs`.
- Added `server/http/cookies.mjs`.
- Added `server/http/apiObservability.mjs`.
- Added `server/http/authGuard.mjs`.
- Added `server/routes/adminRoutes.mjs`.
- Added `server/routes/adminWorkflowRoutes.mjs`.
- Added `server/routes/adminFiwareRoutes.mjs`.
- Added `server/routes/adminLayerRoutes.mjs`.
- Added `server/routes/adminLayerRegistryRoutes.mjs`.
- Added `server/routes/adminLayerAuthorityRoutes.mjs`.
- Added `server/routes/adminLayerJobRoutes.mjs`.
- Added `server/routes/adminLayerIngestRoutes.mjs`.
- Added `server/routes/healthRoutes.mjs`.
- Added `server/routes/platformRoutes.mjs`.
- Added `server/routes/authRoutes.mjs`.
- Added `server/routes/providerRoutes.mjs`.
- Added `server/routes/liveRoutes.mjs`.
- Added `server/routes/liveBaseRoutes.mjs`.
- Added `server/routes/liveOperationsRoutes.mjs`.
- Added `server/routes/liveFeatureRoutes.mjs`.
- Added `server/routes/liveAnalyticsRoutes.mjs`.
- Added `server/routes/liveBimRoutes.mjs`.
- Added `server/routes/standardsRoutes.mjs`.
- Added `server/routes/viewerShellRoutes.mjs`.
- Updated route inventory generation to scan both `server/index.mjs` and
  `server/routes/*.mjs`.

`server/index.mjs` is now only app bootstrap, middleware registration, route
registration, and Next fallback. It is 186 lines after this cut. The route
inventory now detects 121 routes after the viewer-manifest and selection API
additions.

The second route modularization cut split the largest remaining route modules
without changing public URLs:

- `server/routes/liveRoutes.mjs` is now an aggregator for base payloads,
  operations/capabilities, viewport/tiles/layer-capabilities, analytical
  reports, and BIM assets.
- `server/routes/adminLayerRoutes.mjs` is now an aggregator for layer registry,
  authority/conflation, ingestion jobs, and direct provider/package ingest
  adapters.

The latest live-feature route cuts split `liveFeatureRoutes.mjs` without
changing public URLs:

- `server/routes/liveFeature/liveHttpModel.mjs` owns shared HTTP helper
  functions for request origin, actor identity, JSON-ish query parsing, and
  escaped embed attributes.
- `server/routes/liveFeature/twinQueryHttpAdapter.mjs` owns TwinQL/CQL2 request
  payload shaping, transport-specific response shaping, Cesium primitive
  payload shaping, recorded-run query parameters, and tile/bootstrap query
  loading from saved visual-query manifests.
- `server/services/twinQuery/twinQueryUseCaseService.mjs` is the service
  boundary between route code and the TwinQL PostGIS repository.
- `server/routes/liveFeature/viewportFeatureRoutes.mjs` owns building
  coverage, viewport feature reads, layer capabilities, and legacy feature MVT
  tile endpoints.
- `server/services/liveFeature/viewportFeatureUseCaseService.mjs` is the
  service boundary over viewer/viewport PostGIS reads.
- `server/routes/liveFeature/selectionRoutes.mjs` owns selected-area unit and
  summary endpoints.
- `server/services/liveFeature/selectionUseCaseService.mjs` is the selected
  area service boundary.
- `server/routes/liveFeature/shareManifestRoutes.mjs` owns visual share
  manifest list/create/get/publish endpoints, embed contracts, and share
  payload validation.
- `server/services/liveFeature/shareManifestUseCaseService.mjs` is the visual
  share service boundary.
- `server/routes/liveFeature/semanticQueryRoutes.mjs` owns the legacy/simple
  semantic-query contract and execution endpoints.
- `server/routes/liveFeature/semanticQueryHttpAdapter.mjs` owns request payload
  shaping for the simple semantic-query bridge, separate from TwinQL/CQL2.
- `server/services/liveFeature/semanticQueryUseCaseService.mjs` is the
  semantic-query use-case boundary over the existing repository facade.
- `server/routes/liveFeatureRoutes.mjs` dropped from roughly 1,029 lines to
  214 lines and no longer imports TwinQL, semantic-query, viewport, selection,
  or share repository functions directly.

The only remaining live-feature route split candidate is viewer/map manifest
generation. It can stay as an aggregator-owned compatibility facade unless it
starts accumulating more behavior.

2026-06-01 boundary audit: the shared visual query/manifest contract itself is
complete. Analytical Map, City 3D, and Civic XR now share one frontend shell,
one query controller, one viewer manifest contract, one TwinQL use-case service,
and transport-specific adapters. This is guarded by
`npm run test:visual-contract-boundary-smoke`. Further work here should be
runtime cleanup or optional future process extraction, not another "shared
contract extraction" pass.

## Data Cuts Completed

The data-layer cut extracted PostGIS connection ownership and then split
`productionTwinStore.mjs` into domain repositories:

- Added `server/db/postgisPool.mjs`.
- `productionTwinStore.mjs` now uses a shared production pool instead of
  creating and closing a new `pg.Pool` inside each repository function.
- Added `server/db/productionTwinStore/viewerRepository.mjs`.
- `productionTwinStore.mjs` now re-exports the viewer/capability read path
  instead of owning layer capabilities, boundary bbox lookup, bounded GeoJSON
  viewport reads, and MVT tile reads directly.
- Added `server/db/productionTwinStore/featurePresentation.mjs` so shared
  viewer feature-property shaping is not duplicated between the compatibility
  base payload path and the new viewer repository.
- Added domain repositories for BIM payloads, building conflation, provider
  registry, layer registry, layer ingestion jobs, provider-layer ingestion,
  base-twin record reconstruction, storage summaries, base-twin ingestion,
  city upsert, feature writes, selected-area units/summaries, and shared
  repository utilities.
- `server/db/productionTwinStore.mjs` is now a 43-line facade that preserves
  public imports while the SQL lives in explicit repository modules.
- Added `server/services/serviceDatabase.mjs` so LDT/FIWARE services share the
  PostGIS pool via `server/db/postgisPool.mjs` instead of each service creating
  a local `pg.Pool`.
- Updated `ldtScienceService`, `ldtSocietyService`, `ldtSemanticPackService`,
  `ldtViewerAggregateService`, `ldtInteropService`, `ldtOpsService`, and
  `fiwareContextBrokerService` to use the shared service database helper.

## Base Twin Service Cuts Started

The first service-layer cuts reduced `baseTwinService.mjs` without changing
public imports or viewer URLs:

- Added `server/services/baseTwin/viewerShellRenderer.mjs` for the shared
  server-rendered HTML/CSS frame used by map, 3D, and immersive viewers.
- Added `server/services/baseTwin/geoUtils.mjs` for pure geometry helpers:
  ring closing, bbox expansion, distance, area, boundary containment, fallback
  boundary, boundary tile planning, and feature-collection bounds.
- Added `server/services/baseTwin/cacheStore.mjs` for runtime live-base cache
  reads, writes, health checks, and cache status reporting.
- Added `server/services/baseTwin/payloadConstants.mjs` for shared payload
  schema and cache-health thresholds.
- Added `server/services/baseTwin/payloadHelpers.mjs` for pure payload helper
  functions: height parsing, compact labels, feature filtering, nearest-feature
  summaries, planning-readiness labels, and count aggregation.
- Added `server/services/baseTwin/openDataFetchers.mjs` for Nominatim boundary
  lookup, boundary-tiled Overpass fetches, and Wikipedia reference summaries.
- Added `server/services/baseTwin/featureCategories.mjs` for shared civic,
  mobility, and waste category sets used by both base assembly and inferred
  seed grouping.
- Added `server/services/baseTwin/featureCollectionBuilder.mjs` for OSM element
  normalization, base GeoJSON layer assembly, semantic-seed grouping, building
  enrichment, open-provider building candidate stats, and raw source counts.
- Added `server/services/baseTwin/scenePayloadBuilder.mjs` for the derived 3D
  scene payload: projected buildings, road lines, places, green-blue polygons,
  seed markers, and boundary rings.
- Added `server/services/baseTwin/inventoryBuilder.mjs` for shared inventory
  totals, layer definitions, and metric cards used by both fresh open-data
  builds and stored PostGIS payloads.
- Added `server/services/baseTwin/productionPayloadBuilder.mjs` for converting
  a stored PostGIS base-twin record into the current live viewer payload.
- Added `server/services/baseTwin/openDataPayloadBuilder.mjs` for the live
  Nominatim/Overpass/Wikipedia base-twin build flow: boundary/reference fetch,
  health checks, retry behavior, feature collection assembly, inventory,
  metrics, source artifacts, extraction metadata, and scene payload assembly.
- Added `server/services/baseTwin/viewerPageRenderers.mjs` as a compatibility
  aggregator for server-rendered page functions.
- Added per-surface renderer modules under
  `server/services/baseTwin/viewerRenderers/`:
  `leafletMapPageRenderer.mjs`, `mapLibrePageRenderer.mjs`,
  `city3dPageRenderer.mjs`, and `immersivePageRenderer.mjs`.
- Added per-surface runtime modules under
  `server/services/baseTwin/viewerRuntimes/`:
  `leafletMapRuntime.mjs`, `mapLibreRuntime.mjs`, `city3dRuntime.mjs`, and
  `civicXrRuntime.mjs`. `immersiveRuntime.mjs` now remains only as a compatibility
  alias to the Civic XR runtime. These keep the large browser-side viewer code
  out of the server-rendered layout modules while preserving the current HTML
  shell and postMessage contracts.
- Split the MapLibre runtime further into
  `server/services/baseTwin/viewerRuntimes/mapLibre/*`:
  geometry helpers, layer model helpers, selection/popup helpers,
  source/layer rendering, and dashboard-control handling. This is the first
  surface-level runtime cut and gives the future share/embed and block-selection
  work a place to land without re-growing one large map file.
- Added `server/services/baseTwin/viewerContracts/mapSurfaceManifest.mjs` as
  the first explicit map-surface manifest. It defines map modes, allowed
  layer families, selection scopes, and host-command policy for cockpit,
  embedded, and future public shared map surfaces.
- Added `server/services/baseTwin/viewerContracts/viewerSurfaceManifest.mjs`
  as the shared manifest layer for analytical map, municipal 3D, and public
  immersive embeds. This keeps allowed controls, layer families, selection
  scopes, routes, embed routes, and host-command policy out of one-off iframe
  code.
- Added `server/db/productionTwinStore/selectionUnitRepository.mjs` and
  `server/db/productionTwinStore/visualShareManifestRepository.mjs` ownership
  for source-aware selection units and persisted visual share/embed manifests.
  Phase 13 share and block-selection work now lands in repository/route modules
  instead of expanding viewer runtimes.
- `baseTwinService.mjs` still re-exports cache status functions for route
  compatibility, but no longer owns filesystem cache paths, shared categories,
  feature-layer construction, inventory/metric construction, production-record
  payload construction, open-data payload construction, 3D scene payload
  construction, or viewer page rendering directly.

After this cut, `baseTwinService.mjs` is a 129-line orchestration facade for
city resolution, production-store reads, cache fallback, fresh open-data build
delegation, production-store mirroring, cache writeback, building-coverage
augmentation, and renderer re-exports. `viewerPageRenderers.mjs` is only an
export aggregator. The four visual renderers are now layout/composition modules
between 60 and 87 lines each. `mapLibreRuntime.mjs` is now a smaller
browser-runtime composition module over focused MapLibre runtime chunks. The
biggest remaining visual-surface risk is no longer renderer file size; it is
that the extracted 3D, immersive, and legacy Leaflet runtimes still preserve
the legacy browser logic and should be simplified or replaced as each Phase 13
surface is rebuilt.

## Provider Ingestion Cuts Started

`server/services/providerLayerIngestionService.mjs` has been reduced from a
2,265-line mixed parser/orchestrator into a smaller ingestion facade:

- Added `server/services/providerLayerIngestion/ifcIngestion.mjs` for IFC STEP
  parsing, spatial record extraction, native geometry inspection, and BIM mesh
  asset bundle writing.
- Added `server/services/providerLayerIngestion/formatConverters.mjs` for CSV,
  CityJSON, and STAC-to-GeoJSON conversion.
- Added `server/services/providerLayerIngestion/sourceAdapters.mjs` for HTTP
  fetches, OGC API Features pagination, GDAL vector package conversion,
  Overture Buildings extraction, and package inspection.
- Added `server/services/providerLayerIngestion/jobOrchestration.mjs` for
  queued provider-ingestion jobs, idempotency keys, validation-report writing,
  job execution, and batch draining.
- Added `server/services/providerLayerIngestion/actionConfig.mjs` for shared
  provider ingestion limits and supported package formats.
- Added `server/services/providerLayerIngestion/vectorLayerActions.mjs` for
  GeoJSON, CSV, OGC API Features, Shapefile, and GeoPackage direct ingestion.
- Added `server/services/providerLayerIngestion/buildingLayerActions.mjs` for
  Overture Buildings extraction and ingestion.
- Added `server/services/providerLayerIngestion/modelLayerActions.mjs` for
  CityJSON and IFC/BIM direct ingestion.
- Added `server/services/providerLayerIngestion/packageLayerActions.mjs` for
  STAC conversion, package metadata registration, and package inspection.
- The public provider ingestion exports remain on
  `providerLayerIngestionService.mjs`, so routes, tests, and workers keep the
  same import surface.
- `server/services/providerLayerIngestionService.mjs` is now a 63-line facade
  that preserves public exports, wires the queued-job handler map, and delegates
  source-specific ingestion behavior to the action modules.

## Operations Service Cuts Completed

`server/services/ldtOpsService.mjs` is now a compatibility facade for existing
route imports:

- Added `server/services/ldtOps/apiCatalog.mjs` for API catalog entries,
  OpenAPI generation, versioned live aliases, and API catalog row shaping.
- Added `server/services/ldtOps/workflowService.mjs` for API usage event
  recording, workflow definitions, workflow runs, approvals, step/artifact
  normalization, and workflow-run detail reads.
- Added `server/services/ldtOps/operationsReportService.mjs` for the city
  operations report, API usage summaries, ingestion-job summaries, workflow
  runs, pending approvals, and operational gaps.
- Added `server/services/ldtOps/metricsSummaryService.mjs` for the app-native
  operations metrics summary.
- Added `server/services/ldtOps/capabilityStateService.mjs` for the city
  capability contract response.
- Added `server/services/ldtOps/readinessAssessment.mjs` for product-readiness
  checks and warnings.
- Added `server/services/ldtOps/dbUtils.mjs` so all operations modules share
  the same PostGIS client helper.
- `server/services/ldtOpsService.mjs` is now a 12-line facade that preserves
  the public export surface used by routes and tests.

## Frontend Cuts Started

The frontend is now part of the same modularization track because the remaining
architecture risk is no longer only server file size. The largest product-risk
files are the workspace and visual-surface components that still mix module
navigation, viewer controls, query construction, selection state, and inspector
panels.

The first frontend cut adds `src/components/twin-module/viewerStateModel.js`
and moves pure visual-surface state helpers out of `TwinViewerPage.jsx`:

- default TwinQL query builder state,
- visible-layer and detail-count helpers,
- city-radius and coverage math,
- fallback layer-definition construction,
- hero metrics and analyst indicators,
- selected-area indicator and metric shaping.

This is intentionally behavior-preserving. It creates a boundary for the next
cut: a dedicated query-builder module shared by map, municipal 3D, and public
immersive views.

The second frontend cut adds `src/components/twin-module/query/` and moves the
TwinQL visual query implementation out of the main visual shell:

- `TwinQueryPanel.jsx` renders clauses, predicates, radius scope, actions, and
  recorded runs.
- `queryPanelModel.js` owns query-panel normalization and validation helpers.
- `queryShareModel.js` owns saved/shareable TwinQL manifest payloads.
- `useTwinQueryController.js` owns query-builder state, query execution,
  history loading, saved-manifest loading, save/replay, reset, clear, and
  viewer `postMessage` sync.
- `viewer-share-manifests/:shareKey/publish` now promotes saved TwinQL
  manifests into published share/embed contracts while keeping persistence in
  `visualShareManifestRepository.mjs` instead of the visual host.
- `viewerShareManifestRuntime.mjs` centralizes the viewer-side `shareKey`
  bootstrap for map, 3D, and immersive runtimes, so runtime publication is not
  reimplemented per visual surface.

This keeps `TwinViewerPage.jsx` focused on hosting the visual surface, and
keeps `TwinControlSidebar.jsx` focused on rail composition instead of query
implementation.

The third frontend cut adds `src/components/twin-module/panels/` and moves
visual presentation panels out of the host and rail files:

- `CockpitMapInspector.jsx` owns analytical-map inspector tabs and evidence
  panels.
- `VisualSurfaceContractStrip.jsx` owns the compact visual-surface contract
  strip.
- `SelectionPanel.jsx` owns selected-feature inspection details.
- `AreaContextPanel.jsx` owns selected-area summary and scope status.

This keeps `TwinViewerPage.jsx` focused on viewer orchestration and
`TwinControlSidebar.jsx` focused on composing controls that affect the active
visual surface.

The fourth frontend cut adds `src/components/twin-module/controls/` and moves
manual visual control families out of `TwinControlSidebar.jsx`:

- city coverage / radius control,
- layer bundle presets,
- per-layer visibility, focus, solo, label, and detail controls,
- viewer command buttons and optional download action,
- drawing-density / scene-density control,
- shared rail copy and layer-control display helpers.

`TwinControlSidebar.jsx` is now a 204-line rail composer instead of a mixed
implementation file for all viewer controls.

The fifth frontend cut starts the cockpit/workspace split:

- `src/components/twin-module/workspace/ldtWorkspaceModel.js` owns the
  workspace display model, formatting helpers, row builders, module/domain
  metadata, operations tabs, and visual-surface links.
- `src/components/twin-module/workspace/WorkspaceModuleNav.jsx` owns grouped
  module navigation.
- `/cockpit` remains the route, but visible product language now says
  `Workspace`.
- Workspace navigation is grouped into Workspace, Data engineering, and City
  analysis instead of a flat cockpit/analysis list.

`LdtCityWorkspacePage.jsx` is now smaller, but still owns the heavy module
panel markup. That is the next cockpit UI cut.

The sixth frontend cut extracts those workspace panels:

- `WorkspaceModulePanel.jsx` routes the active cockpit/workspace module.
- `WorkspacePanelPrimitives.jsx` owns shared metric/readiness UI primitives.
- `workspace/panels/WorkspaceOverviewPanel.jsx` owns the workspace overview.
- `workspace/panels/InventoryWorkspacePanel.jsx` owns the consolidated
  inventory table.
- `workspace/panels/SourcesWorkspacePanel.jsx` owns sources/evidence.
- `workspace/panels/StandardsWorkspacePanel.jsx` owns standards publication.
- `workspace/panels/AnalysisWorkspacePanel.jsx` owns science/society/culture.
- `workspace/panels/SemanticPacksWorkspacePanel.jsx` owns semantic packs.
- `workspace/panels/OperationsWorkspacePanel.jsx` owns operations subviews.

`LdtCityWorkspacePage.jsx` is now a workspace orchestrator, not a module-panel
implementation file. The remaining frontend risk is deeper panel internals and
the visual surface/query modules, not the workspace page itself.

## Next Cuts

1. Continue splitting visual UI modules where behavior already has a clear
   owner:
   - map/3D/immersive embed contracts,
   - per-surface query result controls.
2. Split `liveFeatureRoutes.mjs` into:
   - feature-window routes,
   - tile routes,
   - TwinQL/query routes,
   - selection-summary routes,
   - visual share/embed routes.
3. Keep `baseTwinService.mjs` as a compatibility facade unless a future cut
   removes the remaining imports.
4. Split the direct provider ingestion action handlers further by source
   family only when behavior changes: vector, raster/catalog, building
   enrichment, and BIM/3D should each become their own action module.
5. Continue splitting per-surface runtime modules only where it creates a clear
   product boundary: map embed/share manifests, block/manzana selection,
   municipal 3D validation, and public immersive story mode.
6. Split `server/routes/adminRoutes.mjs` and `server/routes/standardsRoutes.mjs`
   if their responsibilities keep growing.

## Rule Going Forward

No new product capability should be added directly to a god file. New work must
land in a route module, service module, repository module, or UI module with a
clear owner.

## Verification

2026-05-19 modularization cut verified with:

- `node --check` for the split production repositories, shared service database
  helper, LDT/FIWARE services, provider ingestion modules, and operations
  modules.
- `TWIN_STUDIO_DATABASE_URL=... npm run test:ldt-ops-smoke -- --city=kharkiv`.
- `TWIN_STUDIO_DATABASE_URL=... npm run test:ifc-smoke`.
- `npm run product:capability-matrix -- --city=kharkiv`.
