# Production Build Phases

Updated: 2026-05-14

Status note, 2026-06-04: this document is retained as production rebase history
and backlog context. The active current-phase tracker is `PRODUCT_TODO.md`;
visual-surface decisions for Phase 13 are governed by
`PHASE_13_VISUAL_SURFACES_REBUILD_PLAN.md`, `VISUAL_TRANSPORT_POLICY.md`, and
`TWIN_QUERY_ENGINE.md`.

## 2026-05-13 Architecture Rebaseline

Twin Base Studio is moving from the current `city_features`-centric proving
ground toward a standards-native Local Digital Twin architecture. The target is
documented in
[LDT_NATIVE_STANDARDS_ARCHITECTURE.md](./LDT_NATIVE_STANDARDS_ARCHITECTURE.md).

The existing phases below remain useful as implementation history and runtime
backlog. New production work should follow this rebaselined sequence:

1. Phase 0: architecture freeze and migration guardrail.
2. Phase 1: native LDT core schema.
3. Phase 2: source-native open data reingestion.
4. Phase 3: consolidation and evidence engine.
5. Phase 4: standards-native interoperability.
6. Phase 5: FIWARE context-broker integration.
7. Phase 6: large-city viewer and aggregate delivery.
8. Phase 7: urban scientific analysis standard.
9. Phase 8: social, economic, and cultural standard.
10. Phase 9: semantic packs and city services.
11. Phase 10: open-source production package.

In short: 11 phases if Phase 0 is counted, or 10 construction phases after the
guardrail. The important product rule is that open data enters as source
evidence, the city is stored as consolidated inventory, and standards/FIWARE are
native projections rather than afterthought exports.

Started on 2026-05-13:

- Added `server/db/migrations/005_ldt_native_schema_skeleton.sql`.
- The migration creates the target schemas:
  `ldt_core`, `ldt_catalog`, `ldt_prov`, `ldt_interop`, `ldt_fiware`,
  `ldt_science`, `ldt_society`, `ldt_viewer`, and `legacy`.
- The migration adds first-pass core tables for consolidated city inventory,
  datasets, source evidence, NGSI-LD/DCAT/OGC/ODRL projections, FIWARE broker
  sync, scientific indicators/simulations, social observations, viewer
  summaries/density grids, and compatibility views over the current public
  runtime tables.
- This does not remove the current runtime schema. It starts the parallel path
  needed for reingesting Adazi and Kharkiv into the native model.
- Verified locally with `npm run db:migrate`: migration
  `005_ldt_native_schema_skeleton` applied successfully against the local
  PostGIS database. The new database now has first-pass objects in all target
  schemas: `ldt_core`, `ldt_catalog`, `ldt_prov`, `ldt_interop`,
  `ldt_fiware`, `ldt_science`, `ldt_society`, `ldt_viewer`, and `legacy`.
- Phase 9 adds the dedicated `ldt_semantic` schema for semantic-pack manifests,
  rules, city bindings, service indicators, service features, workflows,
  exports, and review decisions.
- Added `server/db/migrations/006_ldt_phase1_core_primitives.sql`.
- Phase 1 now has a canonical city entity registry, identifier namespace
  registry, source/evidence/match/review/lineage primitives, DCAT-style dataset
  license/spatial/temporal extension tables, and first seed values for the core
  entity types and URI templates.
- Added `npm run test:ldt-schema-smoke` to verify the native LDT schemas,
  critical tables, canonical entity types, identifier namespaces, and a full
  smoke insert flow for city, dataset, source feature, consolidated building,
  evidence, match group, review decision, and lineage event.
- Verified locally with `npm run test:ldt-schema-smoke`: 9 schemas, 14 critical
  tables/primitives, 10 canonical entity types, 7 identifier namespaces, and
  rollback-protected DML all passed.

Phase 1 completion criteria:

- Native schema skeleton exists and migrates cleanly.
- Canonical entity types are seeded.
- Canonical URI/identifier namespaces are seeded.
- Dataset/catalog primitives support DCAT-oriented metadata.
- Provenance primitives support source features, evidence, match groups,
  review decisions, and lineage events.
- Legacy compatibility views exist so current viewers can continue while the
  new model is populated.
- A repeatable smoke test exists for user validation before Phase 2.

## Phase 2: Source-Native Open Data Reingestion

Goal: move open/base source evidence into the standards-native LDT model without
yet treating source rows as consolidated city truth.

Deliverables:

- Reingest Adazi and Kharkiv as validation cities.
- Create `ldt_catalog.datasets` for open/base source layers and Overture
  Buildings.
- Preserve source rows in `ldt_prov.source_features`.
- Preserve boundaries in `ldt_core.city_boundaries`.
- Preserve licenses, distributions, quality summaries, spatial extents, and
  artifact datasets where open-source artifacts exist.
- Exclude derived review layers from source-native storage.
- Add a repeatable smoke test.

Completed on 2026-05-13:

- Added `server/db/ldt-open-data-reingest.mjs`.
- Added `npm run db:ldt:reingest-open`.
- Reingested Adazi:
  - 8 open/base datasets
  - 32,266 source features
  - 1 boundary
  - OSM/base layers plus Overture Buildings source evidence
- Reingested Kharkiv:
  - 8 open/base datasets
  - 293,076 source features
  - 1 boundary
  - 290,821 Overture Buildings source features preserved as open-provider
    evidence
- Added `server/tests/ldt-reingest-smoke.mjs`.
- Added `npm run test:ldt-reingest-smoke`.
- Verified locally with `npm run test:ldt-reingest-smoke`.

Phase 2 completion criteria:

- Adazi and Kharkiv exist in `ldt_core.cities`.
- Each has a boundary in `ldt_core.city_boundaries`.
- Each has open/base datasets in `ldt_catalog.datasets`.
- Each has source features in `ldt_prov.source_features`.
- Derived building review layers are not imported as source facts.
- No consolidated `ldt_core.city_entities` are created yet; that belongs to
  Phase 3.

## Phase 3: Consolidation And Evidence Engine

Goal: create a consolidated city inventory from source evidence without losing
source lineage or pretending provider/candidate evidence is authority-grade.

Deliverables:

- Create `ldt_core.city_entities` from open/base source features.
- Keep OSM, Overture, and other sources as evidence, not as UI layer truth.
- Conflate OSM/base and Overture building footprints.
- Attach matched Overture records to existing building entities as evidence.
- Create unmatched Overture records as candidate building inventory entities.
- Create source evidence, match groups, review decisions, and lineage events.
- Add repeatable smoke tests.

Completed on 2026-05-13:

- Added `server/db/ldt-consolidate-inventory.mjs`.
- Added `npm run db:ldt:consolidate`.
- Added `server/db/migrations/007_ldt_phase3_consolidation_indexes.sql` for
  large-city cleanup and idempotent reruns.
- Added `server/tests/ldt-consolidation-smoke.mjs`.
- Added `npm run test:ldt-consolidation-smoke`.
- Consolidated Adazi:
  - 11,475 city entities
  - 6,483 building entities
  - 14,864 evidence links
  - 3,389 matched Overture evidence links
  - 2,630 unmatched Overture candidate building entities
  - 3,377 building match groups
- Consolidated Kharkiv:
  - 231,996 city entities
  - 230,641 building entities
  - 233,076 evidence links
  - 1,080 matched Overture evidence links
  - 229,741 unmatched Overture candidate building entities
  - 900 building match groups
- Verified locally:
  - `npm run test:ldt-schema-smoke`
  - `npm run test:ldt-reingest-smoke`
  - `npm run test:ldt-consolidation-smoke`

Phase 3 completion criteria:

- Adazi and Kharkiv have consolidated city entities.
- Each required entity type exists: building, road, facility, green-blue system,
  and place.
- Matched Overture buildings are evidence on existing building entities.
- Unmatched Overture buildings are candidate building entities.
- Evidence links, building match groups, review decisions, and lineage events
  exist.
- Consolidation can be rerun idempotently for Adazi and Kharkiv.

## Phase 4: Standards-Native Interoperability

Goal: expose the consolidated city inventory through standards-native surfaces
instead of treating standards as a later export script.

Deliverables:

- Seed JSON-LD contexts for DCAT and NGSI-LD.
- Seed first NGSI-LD / Smart Data Models mappings for core entity types.
- Generate DCAT JSON-LD catalogs from `ldt_catalog`.
- Generate NGSI-LD projections from `ldt_core.city_entities`.
- Generate OGC API Features collection metadata from the entity registry and
  consolidated inventory.
- Serve protected live routes for DCAT, NGSI-LD entities, OGC landing,
  conformance, collections, and collection items.
- Add a repeatable smoke test.

Completed on 2026-05-14:

- Added `server/db/migrations/008_ldt_phase4_interop_seed.sql`.
- Added `server/services/ldtInteropService.mjs`.
- Added `server/db/ldt-generate-interop.mjs`.
- Added `npm run db:ldt:generate-interop`.
- Added `server/tests/ldt-interop-smoke.mjs`.
- Added `npm run test:ldt-interop-smoke`.
- Added live standards endpoints:
  - `/api/live/:cityId/standards/context/:contextKey`
  - `/api/live/:cityId/standards/dcat`
  - `/api/live/:cityId/standards/ngsi-ld/entities`
  - `/api/live/:cityId/standards/ogc`
  - `/api/live/:cityId/standards/ogc/conformance`
  - `/api/live/:cityId/standards/ogc/collections`
  - `/api/live/:cityId/standards/ogc/collections/:collectionKey/items`
- Generated Adazi:
  - 19 DCAT datasets
  - 5 OGC collections
  - 11,475 NGSI-LD entity projections
- Generated Kharkiv:
  - 9 DCAT datasets
  - 5 OGC collections
  - 231,996 NGSI-LD entity projections
- Verified locally:
  - `npm run test:ldt-schema-smoke`
  - `npm run test:ldt-reingest-smoke`
  - `npm run test:ldt-consolidation-smoke`
  - `npm run test:ldt-interop-smoke`

Phase 4 completion criteria:

- DCAT catalogs are generated and stored in `ldt_interop.dcat_exports`.
- NGSI-LD mappings exist for first core entities.
- NGSI-LD projections are generated from consolidated entities, not raw source
  layers.
- OGC collections are generated from consolidated entity types and expose
  GeoJSON FeatureCollections.
- JSON-LD context aliases work for `dcat` and `ngsi-ld`.
- Adazi and Kharkiv both pass the repeatable interop smoke test.

## Phase 5: FIWARE Context Broker Integration

Goal: connect the already-generated NGSI-LD projections to a FIWARE-compatible
context broker without making the broker the durable system of record.

Deliverables:

- Register context broker connections with URL, tenant, NGSI-LD path, batch
  size, auth mode, headers, and metadata.
- Push selected NGSI-LD projections from `ldt_interop.ngsi_entity_projections`
  to a broker using NGSI-LD batch upsert.
- Record sync jobs and per-entity projection state in `ldt_fiware`.
- Register subscriptions for watched NGSI-LD attributes.
- Store incoming context observations and link them back to projected city
  entities when possible.
- Add CLI and API surfaces for controlled operation.
- Add a repeatable smoke test that uses a local mock broker.

Completed on 2026-05-14:

- Added `server/db/migrations/009_ldt_phase5_fiware_sync.sql`.
- Added `server/services/fiwareContextBrokerService.mjs`.
- Added `server/db/ldt-fiware-sync.mjs`.
- Added `npm run db:ldt:fiware-sync`.
- Added `server/tests/ldt-fiware-smoke.mjs`.
- Added `npm run test:ldt-fiware-smoke`.
- Added admin routes:
  - `GET /api/admin/fiware/connections`
  - `POST /api/admin/fiware/connections`
  - `GET /api/admin/fiware/sync-jobs`
  - `POST /api/admin/fiware/connections/:connectionKey/sync`
  - `POST /api/admin/fiware/connections/:connectionKey/subscriptions`
- Added provider observation route:
  - `POST /api/provider/v1/fiware/observations`
- Verified locally against a mock NGSI-LD broker:
  - 3 Adazi Building entities pushed in 2 batches.
  - Subscription creation returned broker status 201.
  - A returned observation linked to the projected entity.
- Verified a safe Kharkiv dry-run:
  - `npm run db:ldt:fiware-sync -- --city=kharkiv --connection=local-dry-run --type=Building --limit=5 --dry-run`

Phase 5 completion criteria:

- FIWARE connections are first-class database records.
- Sync jobs are recorded in `ldt_fiware.context_sync_jobs`.
- Per-entity broker projection state is recorded in
  `ldt_fiware.context_projection_state`.
- NGSI-LD payloads are pushed from `ldt_interop`, not reconstructed from UI
  layers.
- Subscription definitions can be stored and optionally pushed to a broker.
- Observations coming back from the context layer can be stored in
  `ldt_fiware.context_observations`.
- A repeatable mock-broker smoke test exists.

Still pending after Phase 5:

- Connect to a real Orion-LD or Scorpio broker.
- Decide the production broker deployment profile for VPS and city-hosted
  installs.
- Add resumable full-city/tiled sync for Kharkiv-scale payloads.
- Add secure callback authentication/allowlisting for external broker
  notifications.
- Add operational UI for connection health, failed entities, retries, and
  subscription status.

## Phase 6: Large-City Viewer And Aggregate Delivery

Goal: make large cities such as Kharkiv operable on a VPS-style runtime without
making the browser or page load recompute full-city analytics.

Deliverables:

- Store city-level analyst summaries in `ldt_viewer.city_summary_cache`.
- Store coarse density/navigation grids in `ldt_viewer.density_grids`.
- Generate summaries and grids from the consolidated `ldt_core` inventory.
- Expose live viewer routes for cached summaries and density grids.
- Keep full city geometry in PostGIS while the browser uses summaries,
  density grids, viewport APIs, and vector tiles.
- Add a repeatable smoke test for the aggregate path.

Completed on 2026-05-14:

- Added `server/db/migrations/010_ldt_phase6_viewer_aggregates.sql`.
- Added `server/services/ldtViewerAggregateService.mjs`.
- Added `server/db/ldt-refresh-viewer-aggregates.mjs`.
- Added `npm run db:ldt:refresh-viewer-aggregates`.
- Added `server/tests/ldt-viewer-aggregates-smoke.mjs`.
- Added `npm run test:ldt-viewer-aggregates-smoke`.
- Added live viewer aggregate routes:
  - `/api/live/current/viewer-summary`
  - `/api/live/:cityId/viewer-summary`
  - `/api/live/current/density-grid`
  - `/api/live/:cityId/density-grid`
- Generated Phase 6 viewer aggregates:
  - Adazi: 10.42 km2, 6,483 buildings, 2,979 roads, 21 density-grid cells.
  - Kharkiv: 350 km2, 230,641 buildings, 900 roads, 264 density-grid cells.
- The aggregate refresh now uses conservative PostgreSQL planner settings and a
  grid-binning strategy that avoids expensive per-cell geometry intersections
  for large cities.
- Documented the Kharkiv operator path in
  [KHARKIV_OPERATOR_RUNBOOK.md](./KHARKIV_OPERATOR_RUNBOOK.md).
- Documented the open-source install path in
  [OPEN_SOURCE_INSTALLATION_GUIDE.md](./OPEN_SOURCE_INSTALLATION_GUIDE.md).
- Verified locally with `npm run test:ldt-viewer-aggregates-smoke`.

Phase 6 completion criteria:

- Adazi and Kharkiv have cached viewer summaries.
- Adazi and Kharkiv have density grids in `ldt_viewer`.
- Viewer aggregate endpoints return cached data instead of recomputing city
  indicators during normal page loads.
- The Kharkiv demo has a repeatable operator runbook.
- The open-source installation story is documented separately from internal
  command-center operations.

Still pending after Phase 6:

- Wire the cockpit indicator panels directly to `/viewer-summary` and
  `/density-grid` instead of keeping any remaining local UI-derived metrics.
- Add cache headers and tile invalidation keyed to ingestion job/version.
- Add production-grade cluster/generalization policies by zoom for dense point,
  road, and polygon layers.
- Refresh Kharkiv OSM through a heavy-city extraction profile; the current 900
  road count is a source-ingestion caveat, not a database/schema limitation.
- Add backup/restore and deployment hardening before claiming production
  operation for city-hosted installs.

## Phase 7: Urban Scientific Analysis Standard

Goal: turn the consolidated LDT inventory into reproducible urban analysis for
city analysts, instead of keeping indicators as UI-only numbers.

Deliverables:

- Extend `ldt_science` with indicator quality, scaling model definitions,
  scaling fits/residuals, scenario contracts, model calibrations, and network
  metrics.
- Seed the first `urban-science-core` standard.
- Generate city-level scientific observations from `ldt_core`.
- Register first descriptive, network, access, scaling, and scenario model
  contracts.
- Expose a live urban science report route.
- Add repeatable smoke tests.

Completed on 2026-05-14:

- Added `server/db/migrations/011_ldt_phase7_urban_science.sql`.
- Added `server/db/migrations/012_ldt_phase7_science_observation_upsert.sql`.
- Added `server/db/migrations/013_ldt_phase7_science_run_upsert.sql`.
- Added `server/services/ldtScienceService.mjs`.
- Added `server/db/ldt-generate-urban-science.mjs`.
- Added `npm run db:ldt:generate-urban-science`.
- Added `server/tests/ldt-urban-science-smoke.mjs`.
- Added `npm run test:ldt-urban-science-smoke`.
- Added live science report endpoints:
  - `/api/live/current/science/urban-report`
  - `/api/live/:cityId/science/urban-report`
- Documented the standard in
  [URBAN_SCIENCE_STANDARD.md](./URBAN_SCIENCE_STANDARD.md).
- Generated Adazi and Kharkiv reports:
  - 10 indicator definitions.
  - 10 city-level observations per city.
  - 2 network proxy metrics per city.
  - 3 simulation model definitions.
  - 2 scaling model definitions.
  - 3 scenario contracts.
  - 1 idempotent baseline diagnostic run per city.
- Kharkiv quality notes now explicitly flag:
  - the road extraction may be capped/partial;
  - the building inventory is dominated by open-provider evidence pending
    authority validation.
- Verified locally with
  `npm run test:ldt-urban-science-smoke -- --city=adazi,kharkiv`.

Phase 7 completion criteria:

- The first urban science standard is documented.
- Indicators are stored in `ldt_science`, not only in the viewer.
- Every generated observation has a method, unit, quality, source-quality
  class, and uncertainty field.
- Kharkiv has a reproducible science report for the meeting.
- Scaling and scenario models are registered as contracts without pretending to
  be calibrated simulations.

Still pending after Phase 7:

- Wire cockpit indicators to `ldt_science` reports where scientific meaning is
  required, and keep `ldt_viewer` as the performance/cache layer.
- Add official/open population grid ingestion.
- Add district/subarea geography so indicators can be compared within the city.
- Build a routable road/network graph beyond geometry-count proxies.
- Calibrate scaling models with comparable multi-city observations.
- Move into Phase 8: social, economic, and cultural observations in
  `ldt_society`.

## Phase 8: Social, Economic, And Cultural Standard

Goal: add a privacy-safe social/economic/cultural layer without pretending open
facility tags are official demographics, vulnerability, or business census
records.

Deliverables:

- Extend `ldt_society` with privacy policies, source-quality rules, domain
  profiles, cultural assets, participation events, vulnerability placeholders,
  and equity-gap placeholders.
- Seed the first `society-culture-core` standard.
- Generate aggregate social/economic/cultural observations from open-data
  anchors already stored in `ldt_core`.
- Expose a live society report route.
- Add repeatable smoke tests.

Completed on 2026-05-14:

- Added `server/db/migrations/014_ldt_phase8_society_standard.sql`.
- Added `server/services/ldtSocietyService.mjs`.
- Added `server/db/ldt-generate-society-standard.mjs`.
- Added `npm run db:ldt:generate-society`.
- Added `server/tests/ldt-society-smoke.mjs`.
- Added `npm run test:ldt-society-smoke`.
- Added live society report endpoints:
  - `/api/live/current/society/report`
  - `/api/live/:cityId/society/report`
- Documented the standard in
  [SOCIETY_CULTURE_STANDARD.md](./SOCIETY_CULTURE_STANDARD.md).
- Generated Adazi and Kharkiv reports:
  - 10 observation series.
  - 10 city-level observations per city.
  - 3 privacy policies.
  - 4 source-quality rules.
  - domain profiles for demographic readiness, health, education, emergency,
    economy, culture, civic anchors, place identity, open-data readiness, and
    participation readiness.
  - vulnerability and equity rows marked `not-computable` until population,
    demographics, official service catchments, and subarea geographies are
    connected.
- Kharkiv Phase 8 output:
  - 41 cultural public-open assets.
  - 21 health anchors.
  - 15 education anchors.
  - 20 emergency anchors.
  - 117 daily-economy anchors.
  - 1 planned participation-review record.
  - privacy posture: aggregate and public-open anchors only; no personal
    microdata.
- Verified locally with
  `npm run test:ldt-society-smoke -- --city=adazi,kharkiv`.

Phase 8 completion criteria:

- The first society/culture standard is documented.
- Reports are aggregate/public-open only.
- No demographic, vulnerability, household, or equity claim is made without
  required data.
- Kharkiv has a reproducible society/culture report for the meeting.
- Source-quality rules explain why OSM amenities and shops are signals, not
  authority-grade registries.

Still pending after Phase 8:

- Wire society/culture report summaries into the cockpit.
- Add official/open population grid ingestion.
- Add official facility, business, cultural heritage, and participation
  datasets when available.
- Add subarea/district aggregation and privacy-aware public/private UI modes.
- Move into Phase 9: semantic packs and city services.

## Phase 9: Semantic Packs And City Services

Goal: convert inferred and analytical meaning into explicit service packs that
can be inspected, versioned, exported, reviewed by cities, and connected to
authority/provider data later.

Deliverables:

- Add a native `ldt_semantic` schema.
- Define a semantic pack manifest and rule registry.
- Bind semantic packs to cities without replacing the base twin.
- Generate pack-specific service indicators, features, workflows, and JSON
  exports.
- Build the first reference pack for Kharkiv: reconstruction readiness and
  service continuity.
- Expose authenticated live report APIs and smoke tests.

Completed on 2026-05-14:

- Added `server/db/migrations/015_ldt_phase9_semantic_packs.sql`.
- Added `server/services/ldtSemanticPackService.mjs`.
- Added `server/db/ldt-generate-semantic-packs.mjs`.
- Added `npm run db:ldt:generate-semantic-packs`.
- Added `server/tests/ldt-semantic-packs-smoke.mjs`.
- Added `npm run test:ldt-semantic-packs-smoke`.
- Added live semantic-pack report endpoints:
  - `/api/live/current/semantic-packs/:packKey/report`
  - `/api/live/:cityId/semantic-packs/:packKey/report`
- Documented the standard in
  [SEMANTIC_PACK_STANDARD.md](./SEMANTIC_PACK_STANDARD.md).
- Seeded the first reference pack:
  `reconstruction-service-core` version `0.1.0`.
- The pack currently produces open-data readiness indicators, critical service
  anchor features, major access-spine candidate features, city review
  workflows, and a machine-readable summary export.
- Kharkiv Phase 9 output:
  - readiness: 75%.
  - 10 service indicators.
  - 179 service features.
  - 48 critical service anchors.
  - 30.86 km of major access-spine candidates.
  - 4 review workflows.
- The pack explicitly marks damage assessment and population/service-demand
  denominators as required missing sources before any reconstruction priority
  or human-impact claim can be made.

Phase 9 completion criteria:

- Semantic-pack rules are inspectable and separate from base geometry.
- Kharkiv has a reproducible reconstruction/service-continuity pack for the
  meeting.
- The pack can show what the open base twin supports today and what the city or
  provider must connect before operational claims are valid.
- The report/export path works without loading full-city geometry into the
  browser.

Still pending after Phase 9:

- Wire the semantic-pack report into cockpit tabs/panels.
- Add feature review and override UI for pack outputs.
- Add real damage, reconstruction-project, shelter/population, flood, fire, or
  emergency provider data when available.
- Add additional reference packs after the Kharkiv meeting: flood, fire, waste,
  mobility, planning/BIM, and public-service access.
- Move into Phase 10: open-source production package.

## Phase 1: Production Data Backbone

Goal: add the professional data foundation without breaking current viewers.

Deliverables:

- PostGIS service in Docker Compose.
- Application database connection and migration runner.
- Initial schema for cities, providers, layers, ingestion runs, raw source
  features, normalized base features, semantic layers, catalog records, and
  viewer cache entries.
- Health endpoint reports database and migration status.
- Current JSON viewer payloads continue to work.

Status on 2026-05-10: started and locally verified. PostGIS runs in Docker,
the initial migration is applied, and `/api/health` reports database and
migration status.

## Phase 2: Base Twin Ingestion To PostGIS

Goal: stop treating JSON payloads as city data storage.

Deliverables:

- Existing base-twin payload caches can be ingested into PostGIS.
- Fresh base-twin refreshes mirror successful payloads into PostGIS.
- Raw source features are stored with provider, source layer, source feature id,
  run id, geometry, and original payload.
- Roads, buildings, facilities, places, green-blue features, city anchor, and
  boundaries are normalized into PostGIS.
- Admin API can trigger cache ingestion and inspect city storage status.
- Layer definitions are registered per city with provenance metadata.

Started on 2026-05-10:

- `server/db/productionTwinStore.mjs` writes cities, providers, layer
  definitions, boundaries, ingestion runs, raw features, normalized features,
  and typed feature rows.
- `server/db/ingest-base-cache.mjs` loads current cache files into PostGIS.
- `npm run db:ingest:base-cache` ingested cached data for Adazi, Tallinn,
  Gaziantep, Istanbul, and Kharkiv. Pilsen was skipped because no valid cache
  file exists locally.
- `POST /api/admin/cities/:cityId/ingest-base-cache` ingests one cached city.
- `GET /api/admin/cities/:cityId/storage` reports layer counts and recent
  ingestion runs.
- Viewer base payloads now prefer PostGIS and fall back to JSON cache/live
  fetching only when PostGIS has no usable record.
- Fresh live refreshes capture raw source artifacts for Nominatim, Overpass,
  and Wikipedia in `source_artifacts`.
- Fresh live refreshes now store full normalized feature sets in PostGIS while
  applying feature caps only when generating viewer payloads.
- Fresh live refreshes now use boundary/bbox tiled Overpass extraction instead
  of center-radius extraction. The tile count is controlled by
  `TWIN_STUDIO_OVERPASS_MAX_TILES`.

Still pending in Phase 2:

- Backfill source artifacts for old cache-ingested cities. Existing cache files
  do not contain full raw Nominatim/Overpass/Wikipedia responses.
- Split the monolithic base-twin service into fetchers, normalizers, storage,
  and viewer payload builders.
- Replace public Overpass dependency with production import options for heavy
  cities: local/regional OSM extracts, replication diffs, or a city-operated
  Overpass-compatible service.

## Phase 3: Layer Registry And Provider Connectors

Goal: let cities and providers attach new layers safely.

Deliverables:

- Provider registry.
- Layer registry.
- Upload/API connector contracts.
- Support for GeoJSON, CSV, Shapefile/GeoPackage path, OGC services, raster
  metadata, sensor feeds, and BIM package metadata.
- Validation and ingestion job status per layer.

Started on 2026-05-10:

- Added `provider_connectors` for provider-side upload/API/OGC/raster/sensor/
  BIM connector contracts.
- Added `layer_ingestion_jobs` for per-city, per-layer ingestion status.
- Added admin APIs to list/upsert providers, city layers, and layer ingestion
  jobs.
- Added the first real provider ingestion adapter:
  `POST /api/admin/cities/:cityId/layers/:layerKey/ingest-geojson` accepts
  inline or HTTP(S) GeoJSON FeatureCollections, stores raw artifacts, writes raw
  feature rows, writes normalized provider features, and records ingestion/job
  status.
- Added the second provider ingestion adapter:
  `POST /api/admin/cities/:cityId/layers/:layerKey/ingest-csv` accepts inline
  or HTTP(S) CSV, converts point rows or GeoJSON geometry rows into provider
  features, stores the original CSV artifact, and records ingestion/job status.
- Added the third provider ingestion adapter:
  `POST /api/admin/cities/:cityId/layers/:layerKey/ingest-ogc-features` fetches
  OGC API Features or WFS GeoJSON FeatureCollections and stores them through the
  same provider-feature ingestion path.
- Added the first raster/satellite package extraction adapter:
  `POST /api/admin/cities/:cityId/layers/:layerKey/ingest-stac` converts STAC
  Items, ItemCollections, and Collections into provider features using item or
  collection footprints, stores the original STAC source artifact, and records
  ingestion/job status.
- Added the first 3D package extraction adapter:
  `POST /api/admin/cities/:cityId/layers/:layerKey/ingest-cityjson` converts
  WGS84 CityJSON `CityObjects` into provider features using object centroids,
  stores the original CityJSON source artifact, and records ingestion/job
  status.
- Added the first IFC/BIM extraction adapter:
  `POST /api/admin/cities/:cityId/layers/:layerKey/ingest-ifc` parses IFC STEP
  metadata, counts core BIM entities, extracts `IfcSite` latitude/longitude
  when present, accepts explicit provider anchors when needed, extracts basic
  spatial containment and property sets, runs a `web-ifc` native-geometry
  inspection, writes mesh asset bundles when native geometry exists, and writes
  a model anchor plus indexed building, storey, and space records into PostGIS.
- Added package metadata registration:
  `POST /api/admin/cities/:cityId/layers/:layerKey/register-package` registers
  raster COG/STAC/WMS, IoT feed, BIM/IFC/CityJSON/3D Tiles, Shapefile, and
  GeoPackage package metadata with source artifacts, catalog records, and job
  status.
- Added admin UI controls for registering providers, registering active-city
  layers, triggering CSV/GeoJSON/OGC/STAC/CityJSON/package ingestion, and
  reviewing layer/job status.
- Added the first async ingestion backbone:
  `POST /api/admin/cities/:cityId/layers/:layerKey/ingestion-jobs/queue`
  creates queued jobs with idempotency keys, `POST /api/admin/ingestion-jobs/:id/run`
  executes one queued job, and job inspection/report/retry/cancel endpoints
  expose status and operator feedback.
- Added a provider ingestion worker entrypoint:
  `npm run worker:provider-ingestion` continuously drains queued jobs and
  `npm run worker:provider-ingestion:once` drains one batch for operations and
  smoke tests.
- Added `ingestion_validation_reports` for per-job validation warnings and
  failures.
- Added HTTP-safe package inspection for queued package jobs: raster COG
  headers, WMS GetCapabilities, HTTP JSON/sensor-feed summaries, MQTT
  registration, 3D Tiles tileset metadata, and BIM package registration.
- The Docker image now installs GDAL tools, and queued Shapefile/GeoPackage
  package jobs use `ogr2ogr` to extract HTTP(S) vector packages into
  `city_features`.
- Queued IFC package jobs now run the IFC metadata/property-set/spatial-record/
  anchor extractor plus `web-ifc` native-geometry inspection and local mesh
  asset bundle creation. Viewer-ready BIM scenes, room polygons, and
  room/system extraction still require the next BIM worker step.
- Added `GET /api/admin/cities/:cityId/layers/:layerKey/bim-payload` to expose
  stored IFC records as a BIM viewer/operations payload with anchor, hierarchy,
  property sets, record counts, native-geometry inspection counts, and geometry
  limitations.
- Added `GET /api/admin/cities/:cityId/layers/:layerKey/bim-assets/:bundleId/:assetName`
  to serve protected BIM mesh manifests and raw vertex/index buffers generated
  from IFC geometry extraction.
- Added live city-scoped BIM routes:
  `GET /api/live/:cityId/bim-layers` and
  `GET /api/live/:cityId/bim-assets/:layerKey/:bundleId/:assetName`.
- Added the first municipal Three.js BIM viewer adapter: it loads live BIM
  layer payloads, renders extracted mesh buffers when native geometry exists,
  and shows BIM anchor markers for IFC layers that only contain metadata,
  hierarchy, and property sets.
- Added the provider-facing API surface under `/api/provider/v1` so external
  systems can request upload intents and queue ingestion jobs without admin
  sessions.
- Added local signed provider upload storage under
  `runtime-data/provider-uploads`; workers can ingest uploaded packages through
  signed internal `sourceUri` values.
- Added `GET /api/admin/cities/:cityId/production-plan` to report base-layer
  completeness, current feature counts, storage estimates, provider extension
  readiness, and remaining production gaps for a city.
- Added `POST /api/admin/cities/:cityId/layers/:layerKey/accept-authority` so
  city admins can explicitly mark layers as city-authoritative with evidence
  metadata.
- Added `npm run test:city-smoke` as an end-to-end city smoke test for provider
  registration, layer creation, direct GeoJSON ingestion, queued CSV ingestion,
  and production-plan generation.
- Added `npm run test:ifc-smoke` as an IFC ingestion smoke test for direct and
  queued IFC package extraction, including property-set and BIM-payload
  assertions.
- Added `npm run test:ifc-geometry-smoke` for provider IFC files that contain
  real native shape geometry. It requires `--ifc=/path/to/model.ifc` or
  `TWIN_STUDIO_IFC_GEOMETRY_SAMPLE_PATH`, ingests the file with a provider
  anchor, asserts `web-ifc` mesh extraction, and verifies the local manifest plus
  raw vertex/index buffer asset bundle.
- Documented the provider connector contract in
  [PROVIDER_CONNECTOR_CONTRACT.md](./PROVIDER_CONNECTOR_CONTRACT.md).

Still pending in Phase 3:

- Deploy the provider ingestion worker in production process supervision.
- Add an S3-compatible or city-operated external object storage backend for
  large multi-node binary uploads.
- Harden GeoJSON ingestion with deeper schema/property validation, geometry
  validation details, and richer operator UI.
- Harden CSV ingestion with typed schemas, per-row validation details, larger
  streaming imports, and background workers.
- Harden OGC ingestion with capabilities/collection discovery and paging
  controls in the UI.
- Implement rich BIM operations beyond the first viewer adapter: storey slicing,
  room polygon/system extraction, element search, BIM-to-footprint alignment,
  and external object-storage delivery for large model assets.
- Add a managed BIM asset storage policy for production: local runtime storage
  is acceptable for one-node development and validation, but large city BIM
  portfolios need S3-compatible or city-operated object storage, retention
  rules, and asset garbage collection.
- Expand validation reports with per-row rejected feature payloads and schema
  violation summaries.
- Add a provider/layer onboarding UI.
- Add role-specific permissions for provider operators, city editors, and
  public viewers.
- Decide which first provider domain becomes the reference connector: Flood,
  Fire, Satellite, IoT, or BIM.

## Phase 4: Viewer Scaling And Tile APIs

Goal: make full-city data usable in the browser.

Deliverables:

- Bbox layer APIs.
- Vector tile path for high-volume layers.
- Raster/COG registration path.
- 3D/CityJSON/3D Tiles metadata path.
- Viewer loads by city, bbox, zoom, layer, and fidelity instead of one large
  payload.

Started on 2026-05-11:

- Added authenticated viewport GeoJSON APIs backed by PostGIS:
  `GET /api/live/current/features?bbox=minLon,minLat,maxLon,maxLat&layers=roads,buildings&limit=1000`
  and
  `GET /api/live/:cityId/features?bbox=minLon,minLat,maxLon,maxLat&layers=roads,buildings&limit=1000`.
  These APIs read from `city_features` with the existing GiST geometry index,
  validate bbox/range/limits, support base or provider layer keys, and return a
  bounded GeoJSON FeatureCollection for the current map window.
- Added the first authenticated Mapbox Vector Tile path:
  `GET /api/live/:cityId/tiles/:z/:x/:y.mvt?layers=roads,buildings&limit=2000`.
  It uses `ST_TileEnvelope`, `ST_AsMVTGeom`, and `ST_AsMVT` so high-volume
  layers can move toward vector-tile delivery instead of full JSON payloads.
  It now also accepts `center` and `radiusMeters` so the map City coverage
  control can request only the radius currently being inspected.
- Added `npm run test:viewer-window-smoke` to verify bbox GeoJSON and MVT tile
  reads against a stored city.
- Replaced the generated Leaflet analytical map with a MapLibre GL JS vector-tile
  viewer for the `/live/:cityId/map` route. The initial base payload still
  provides city context, inventory, boundary, controls, and fallback metadata,
  while roads, buildings, green-blue features, places, and facility-derived
  logical layers render from PostGIS MVT tiles scoped by the City coverage
  radius.
- Rewired the generated Three.js municipal viewer to use the bbox GeoJSON
  endpoint after bootstrap and after camera orbit/pan interaction. The boot
  payload still provides city context, inventory, boundary, metrics, controls,
  and fallback objects, while roads, buildings, green-blue features, places,
  and facility-derived logical layers are rebuilt from a camera-centered
  PostGIS window.
- Added authenticated layer capability APIs:
  `GET /api/live/current/layer-capabilities` and
  `GET /api/live/:cityId/layer-capabilities`. They summarize each layer's
  current delivery options from PostGIS metadata: bounded GeoJSON, vector tile,
  BIM payload/assets, raster/catalog metadata, and 3D package metadata.
- Started analytical map smart layer controls. Layer sliders now
  control layer detail rather than fake opacity: roads, buildings, green-blue
  systems, places, and semantic seed layers can be reduced or expanded by
  meaningful feature count, while boundary remains a fixed municipal mask.
- Reworked the analytical map surface around a secondary control rail, map
  focus presets, a consolidated building inventory, source/provenance evidence,
  and a tabbed indicator inspector. The current analytical map is usable enough to
  pause and align the other visualizations, but it still needs a final UI
  hierarchy pass.
- Optimized the large-city viewer bootstrap for Kharkiv. Provider-only building
  candidates are no longer sent in the initial base payload, and the building
  coverage summary now reads materialized conflation counts instead of
  recomputing OSM/provider geometric matches on every viewer load. The browser
  keeps the full-city inventory story through indicators and loads dense
  geometry through viewport APIs.

Still pending in Phase 4:

- Add cache headers and tile invalidation keyed to ingestion job/version.
- Wire the new `ldt_viewer` city-summary cache and density grids into every
  viewer surface.
- Add cluster/generalization policies by zoom for very dense point and polygon
  layers.
- Finish the shared viewer-control pattern across analytical map, municipal 3D,
  and public immersive views.
- Apply the base/provider/inferred/semantic/source distinction to the municipal
  3D and public immersive visualizations.
- Return to cockpit visual polish after the other viewer surfaces are aligned:
  focus bar density, header/status hierarchy, tabbed inspector design, and
  responsive visual checks.
- Promote raster/COG and 3D Tiles package metadata into first-class viewer
  capabilities.
- Extend smart per-layer controls to the 3D and public immersive viewers.
- Add subarea/neighborhood mode using official district polygons when
  available, with OSM/locality fallback only when the geometry is good enough.
- Add feature inspection panels that explain source, provenance, inference
  rule, confidence, and authority status for selected map objects.

The full active backlog is tracked in [PRODUCT_TODO.md](./PRODUCT_TODO.md).

## Phase 5: Semantic Packs

Goal: convert provider data into domain meaning.

Deliverables:

- Semantic pack manifest format.
- Pack schema and validation rules.
- First reference pack, preferably Waste, Flood, Fire, or Reconstruction.
- Pack-specific indicators, panels, exports, and service workflows.

## Phase 6: Interoperability And Federation

Goal: satisfy the LDT4SSC interconnection requirement in product form.

Deliverables:

- NGSI-LD / Smart Data Models mappings for core entities.
- DCAT catalog export.
- JSON-LD/RDF descriptions for datasets and layers.
- Optional context broker adapter.
- Federation/export contract for city-to-city or city-to-provider exchange.
- Access policy metadata and IAM integration path.

## Phase 7: Production Operations

Goal: make the platform safe for city-operated deployments.

Deliverables:

- backup and restore,
- migration status,
- seed/admin bootstrap,
- secret rotation path,
- role model hardening,
- job monitoring,
- audit views,
- deployment guide,
- public/private data-boundary documentation.
