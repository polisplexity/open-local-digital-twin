# Product Capability Matrix

Updated: 2026-05-23

This matrix is the current control document for turning Twin Base Studio into a
standards-native, open-source Local Digital Twin product. It separates:

- what we promised or discussed,
- what exists in the database and code,
- what is visible in the UI,
- which standards or interoperability surfaces are covered,
- what must be finished before the platform should be presented as production
  ready.

Machine-readable artifact:

- `docs/generated/capability_matrix.json`

Regenerate it with:

```bash
npm run product:capability-matrix -- --city=kharkiv,adazi
```

The immediate rule is: do not add more agent automation before the product
capabilities below are exposed, tested, and documented as city-operable
workflows.

## Current Database Reality

Local check against the PostGIS runtime on 2026-05-16:

| Area | Current count |
| --- | ---: |
| LDT schemas | 10 |
| LDT tables | 79 |
| LDT cities | 2 |
| Catalog datasets | 28 |
| Source features | 325,342 |
| Consolidated city entities | 243,471 |
| NGSI-LD projections | 243,471 |
| OGC collections | 10 |
| Science observations | 20 |
| Society observations | 20 |
| Semantic pack city bindings | 2 |
| Agentic workflow definitions | 3 |

Per-city consolidated inventory:

| City | Buildings | Roads | Facilities | Green-blue | Places | Total entities |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Adazi | 6,483 | 2,979 | 732 | 1,264 | 17 | 11,475 |
| Kharkiv | 230,641 | 900 | 240 | 180 | 35 | 231,996 |

Important caveat: Kharkiv buildings are strong because Overture contributes a
large candidate footprint inventory. Kharkiv roads, facilities, green-blue, and
places are still weak relative to the city size. That is a source-ingestion and
workflow gap, not only a map-rendering problem.

## Capability Status

Status vocabulary:

- `Implemented`: database, code, API, and smoke path exist.
- `Partial`: exists but is not complete, not wired to UI, or not production
  grade.
- `Documented`: product/architecture is written, but implementation is missing.
- `Missing`: not yet built.

| Capability | Product promise | Status | Standards / contracts | Database source | API surface | UI status | Next required work |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Open-data base twin | Any city can start from public/open data. | Partial | OSM/Overpass, Overture, DCAT, PROV, OGC | `ldt_catalog`, `ldt_prov`, `ldt_core` | `/api/live/:cityId/base`, `/features`, `/tiles` | Visible but unstable for large cities | Convert ingestion into reliable city workflow with progress, retries, quality report, and source completeness warnings. |
| Consolidated city inventory | The city is one inventory, not separate OSM vs Overture UI layers. | Implemented | PROV-O-style evidence, stable URI scheme | `ldt_core.city_entities`, typed entity tables, `ldt_prov.entity_source_evidence` | Indirect through live viewer, OGC, NGSI-LD | Partially visible; UI still exposes layer mechanics too much | Build inventory API and UI module that shows entity counts, evidence, authority status, and review state. |
| Building inventory | Buildings become one consolidated base layer enriched by OSM, Overture, official, BIM, and manual evidence. | Partial | OGC Features, NGSI-LD Building, provenance evidence | `ldt_core.city_entities`, `ldt_core.building_entities`, `ldt_prov` | `/features`, `/building-coverage`, OGC items, NGSI-LD | Visible in cockpit, but source/evidence logic not yet clear | Add building detail panel with evidence stack, candidate/validated status, source conflict, and report-only duplicate analysis. |
| Roads and mobility base | Roads should represent the city network enough for planning and later network analysis. | Partial | OGC Features, NGSI-LD Road, future network model | `ldt_core.road_entities`, `ldt_science.network_metrics` | `/features`, OGC items, science report | Visible but Kharkiv road count is weak | Reingest Kharkiv roads with heavy-city Overpass profile or alternate open road datasets; build routable graph later. |
| Land-use / open land | Show what is classified and what remains unknown inside the municipal boundary. | Partial | OGC Features, provenance, coverage-quality indicators | `ldt_core.land_use_entities`, `ldt_viewer`, `ldt_science` | `/features`, `/viewer-summary`, science report | Visible but still confusing as "unclassified" | Rename as coverage gap, use percentage, and explain source-quality instead of implying empty land. |
| Green-blue systems | Expose parks, water, environmental/open-space layers as base geography. | Partial | OGC Features, NGSI-LD LandUse/Feature | `ldt_core.green_blue_entities` | `/features`, OGC items | Visible as layer, weak for Kharkiv | Improve source extraction and classify by park, water, forest, reserve, public realm. |
| Facilities and service anchors | Civic, health, education, emergency, daily economy anchors seed service analysis. | Partial | OGC Features, NGSI-LD Facility/PointOfInterest, society source-quality rules | `ldt_core.facility_entities`, `ldt_society`, `ldt_semantic.service_features` | `/features`, society report, semantic pack report | Some markers visible; not cleanly explained | Build service-anchor UI grouped by public service category and source confidence. |
| Source catalog | Every source dataset has metadata, license, spatial extent, quality, and attribution. | Implemented in DB, partial UI | DCAT, ODRL, attribution policy | `ldt_catalog.*`, `ldt_interop.dcat_exports` | `/standards/dcat` | Not exposed as analyst workflow | Build "Sources" UI from catalog, not from hardcoded descriptions. |
| Provenance and evidence | Preserve source evidence and lineage for every consolidated entity. | Implemented in DB, partial API/UI | PROV-O concepts | `ldt_prov.*` | OGC/NGSI indirectly; no dedicated evidence API yet | Not analyst-friendly | Add `/api/live/:cityId/entities/:id/evidence` and source/evidence panels. |
| Standards publication | Serve standards-native outputs, not just internal JSON. | Implemented | DCAT JSON-LD, NGSI-LD, OGC API Features, ODRL | `ldt_interop.*` | `/standards/dcat`, `/standards/ngsi-ld/entities`, `/standards/ogc/*` | Not visible enough | Add Standards module with endpoint status, counts, examples, and download/test links. |
| FIWARE live context | FIWARE is the interconnection/context layer, not the durable inventory. | Partial | NGSI-LD, FIWARE Orion-LD/Scorpio-compatible broker boundary | `ldt_fiware.*`, `ldt_interop.ngsi_entity_projections` | Admin FIWARE routes, provider observations | Admin-only, not productized | Connect real broker profile, add sync health UI, retries, callback auth, and safe full-city batch strategy. |
| Provider/private data connectors | City, vendor, satellite, flood, fire, IoT, BIM, and other providers can attach layers through APIs. | Partial | OGC Features/WFS, GeoJSON, CSV, STAC, CityJSON, IFC, GeoPackage/Shapefile via GDAL | public provider/layer tables plus LDT catalog/prov bridges | Admin/provider ingestion routes | Admin exists, not clean production workflow | Separate product provider onboarding from internal admin; add validation, review, and publication gates. |
| BIM / 3D packages | IFC/CityJSON/3D package data can attach to the twin without replacing base geometry. | Partial | IFC, CityJSON, 3D package metadata | provider layer tables, BIM asset artifacts, `ldt_catalog` metadata | BIM payload/assets routes | Municipal 3D currently fragile | Stabilize 3D viewer or mark as experimental; build simple BIM asset inventory first. |
| Viewer aggregates | Large cities need cached summaries and grids instead of browser full-city loading. | Implemented, partial UI | Internal viewer performance contract | `ldt_viewer.city_summary_cache`, `ldt_viewer.density_grids` | `/viewer-summary`, `/density-grid` | Some indicators visible, still mixed with old UI logic | Make cockpit indicators come only from `ldt_viewer` or `ldt_science`; add cache freshness and invalidation. |
| Urban science | Indicators and models should be reproducible city-analysis records, not UI-only cards. | Partial | Urban science standard, scaling models, network metrics, simulations/scenarios | `ldt_science.*` | `/science/urban-report` | Not wired as full module | Build Urban Science tab with indicators, method, quality, uncertainty, and blocked requirements. |
| Social/economic/cultural layer | Social/cultural analysis must be aggregate, privacy-safe, and source-quality explicit. | Partial | Privacy policy, source-quality rules, aggregate observations | `ldt_society.*` | `/society/report` | Not wired as full module | Build Society/Culture tab and add population grid/district support before equity claims. |
| Semantic packs | Domain logic such as reconstruction, flood, fire, waste, mobility, and planning/BIM attaches as explicit service packs. | Partial | Pack manifest, rules, workflows, exports | `ldt_semantic.*` | `/semantic-packs/:packKey/report` | Not wired as product workflow | Build Semantic Pack UI with rules, blocked claims, service features, review workflows, and export. |
| City analyst cockpit | A city analyst can understand what exists, what is missing, and what action to take. | Partial | Product UX contract | Reads many sources | `/cockpit` plus live APIs | Current UI is under construction and inconsistent | Rebuild cockpit around capabilities: Overview, Inventory, Sources, Standards, Science, Society, Semantic Packs, Operations. |
| Municipal 3D view | Municipal teams can inspect spatial operations and BIM/3D layers. | Partial / unstable | Three.js, IFC/CityJSON metadata, future 3D Tiles | provider/BIM stores, live features | `/municipal`, `/live/:cityId/3d` | Broken recently by `loadBimLayers` issue | Decide whether to stabilize or demote to experimental for the next demo. |
| Public immersive view | Public/nontechnical audiences can understand a city twin without internal controls. | Partial / unstable | Public storytelling contract | live features and story content | `/public`, `/live/:cityId/immersive` | Not reliable enough | Rebuild after cockpit data contract is stable; keep as construction state. |
| API observability | Operators know API usage, latency, errors, city IDs, roles, and route family. | Minimal foundation | Prometheus/Grafana-ready metrics, request IDs | `ldt_ops.api_usage_events` | Request middleware records route family, status, latency, city, role, and request id | Not productized | Add metrics endpoint, Grafana dashboard, and API usage admin panel in Phase 12. |
| API explorer / versioning | Cities and providers can test APIs safely and know supported versions. | Missing | OpenAPI 3.1, `/v1` versioning | N/A | Missing | Missing | Add OpenAPI spec, Scalar/Swagger/ReDoc explorer, `/v1` aliases, and deprecation policy. |
| Open-source city install | Any city can install one-city backend and lightweight UI. | Documented, partial | Docker Compose, PostGIS, migration/runbook contract | all runtime schemas | health, admin, live APIs | Not a clean setup product yet | Create one-city installation path, `.env.example`, `create-city`, backup/restore, smoke-test command. |
| Workflow orchestration | Open-data ingestion and validation should be repeatable, inspectable, and agent-operable later. | Partial foundation | Workflow definitions, approvals, artifacts, provenance | `ldt_ops.*` | `/api/admin/workflows` only | Not productized | Build run creation, approval gates, worker, progress UI. Agents come after this. |

## Standards Coverage

| Standard / ecosystem | Current coverage | Gap |
| --- | --- | --- |
| LDT / Local Digital Twins direction | Core architecture separates inventory, catalog, provenance, interoperability, live context, analytics, and services. | Need visible UI and operational workflows that show this separation clearly. |
| DCAT | Dataset and distribution model plus JSON-LD export exist. | UI needs source catalog and access-right/license review. Some dataset access labels need cleanup. |
| PROV-O | Agents, activities, source evidence, lineage, review decisions, and match groups exist. | Dedicated evidence API and analyst evidence UI are missing. |
| OGC API Features | Collection metadata and collection item routes exist. | Need OpenAPI docs, versioning, pagination/limits review, and UI test surface. |
| NGSI-LD / Smart Data Models | Entity projections exist for consolidated inventory. | Need mapping quality review and real broker sync profile. |
| FIWARE | Broker connection, sync jobs, subscriptions, observations, and mock test exist. | Need real Orion-LD/Scorpio deployment choice, auth, resumable sync, and operator UI. |
| ODRL / data policy | First policy metadata exists. | Need stronger access-right, license, and publication governance. |
| CityJSON / IFC / BIM | Initial metadata/anchor ingestion exists. | 3D viewer is fragile; full geometry/tiles strategy is not mature. |
| Urban science / scaling | First internal standard and observations exist. | Need population, districts, network graph, calibration datasets, and UI. |
| Social/economic/cultural | First aggregate/privacy-safe standard exists. | Need official/open population, business, cultural heritage, participation datasets, and privacy-aware UI modes. |

## Fases Reordenadas Desde Hoy

Current operating decision:

- The immediate demo and acceptance path is **one city: Kharkiv**.
- Multi-city registry support remains useful for lab/demo comparisons, but the
  product should not be shaped as a heavy multi-city SaaS right now.
- The open-source production posture is **one installation, one primary city**,
  with clean city creation/reingestion workflows.

### Phase 10: Product Capability Contract

Goal: make this matrix executable and keep documentation, database, API, and UI
aligned.

Acceptance:

- every promised capability has a named database source,
- every city-facing capability has a route or is marked missing,
- every route is documented as live/admin/provider/standards,
- every UI module states whether it is production, preview, or construction,
- Kharkiv gaps are explicit and not hidden by map styling.

Current Phase 10 implementation now includes:

- `GET /api/admin/workflows`
- `GET /api/admin/workflow-runs`
- `POST /api/admin/workflows/:workflowKey/runs`
- `GET /api/admin/workflow-runs/:runId`
- `POST /api/admin/workflow-runs/:runId/approvals/:approvalKey/decision`
- recent workflow runs and pending approval counts in
  `/api/live/:cityId/capabilities`
- city readiness checks and readiness gaps for source coverage, inventory
  strength, standards publication, workflow readiness, API observability, and
  UI construction state

The important boundary remains: these APIs create traceable, approval-gated
workflow runs, but they do not yet execute city-ingestion or publication jobs.

Current Kharkiv gate result after the Phase 12/13 cuts:

- Phase status: Phase 10 accepted with known partials; Phase 12 closed for
  implementation; Phase 13 visual-surface rebuild in progress
- Ready checks: 8
- Partial checks: 2
- Blocked checks: 0
- Construction checks: 1
- Blocker: none currently recorded in the capability gate
- Partials: road-network coverage is weak relative to the built inventory, and
  green-blue classification is still shallow
- Construction: Workspace, analytical map, municipal 3D, and public immersive
  surfaces are split into the intended product architecture, but Phase 13
  visual hardening remains open

### Phase 11: LDT-Native UI Rebuild

Goal: stop patching the current cockpit and rebuild the product UI around the
real LDT modules.

Target modules:

1. City overview and readiness
2. Base inventory
3. Source evidence and provenance
4. Standards and API access
5. Urban science
6. Society/culture
7. Semantic packs
8. Provider layers
9. FIWARE/live context
10. Operations and freshness

### Phase 12: API Governance And Observability

Goal: make APIs testable, versioned, measurable, and city-operable.

Deliverables:

- OpenAPI 3.1,
- authenticated API explorer,
- `/v1` routes,
- request IDs,
- route metrics,
- city/user/role/error logs,
- Prometheus/Grafana-ready metrics.

### Phase 13: Visual Surfaces Rebuild

Goal: stabilize the three visual products before automating open-data
workflows.

Deliverables:

- `/map` as the analytical map module,
- `/municipal` as the municipal 3D validation surface,
- `/public` as the public immersive surface,
- shared visual manifest and selected-area contract,
- TwinQL/CQL2 secondary rail,
- saved/published visual-query manifests,
- visual-route and viewer-window smoke gates,
- explicit remaining gaps for query-aware MVT, 3D quality, public story
  quality, and signed/public embed access.

### Phase 14: Open-Data Workflow Runner

Goal: make city creation repeatable without hand-operated scripts.

Deliverables:

- open-data bootstrap workflow,
- source refresh workflow,
- consolidation workflow,
- standards generation workflow,
- viewer aggregate refresh workflow,
- quality report workflow,
- approval gates before authority/publication claims.

### Phase 15: One-City Open-Source Production Package

Goal: ship a realistic open-source install for one city at a time.

Deliverables:

- cleaned Docker Compose,
- `.env.example`,
- `create-city`,
- backup/restore,
- seed/demo city,
- production smoke tests,
- wiki/runbook.

### Phase 16: Agentic Operations Layer

Goal: let AI agents operate approved workflows, not invent truth or directly
mutate the city inventory.

Deliverables:

- workflow run APIs,
- approvals,
- artifacts,
- policy checks,
- audit trail,
- agent/operator separation.

## Immediate Next Build Step

Phase 10 is accepted with known partials. The next build step is Phase 11:
rebuild the UI around the one-city Kharkiv capability contract.

Phase 10 completed:

1. Route inventory generation from `server/index.mjs`.
2. Database capability checks per city.
3. Machine-readable `capability_matrix.json`.
4. `/api/live/:cityId/capabilities` detail for the next UI rebuild.
5. Cockpit, municipal, and public UI marked as construction until they consume
   the LDT-native capability contract.
6. Minimal API request observability in `ldt_ops.api_usage_events`.
