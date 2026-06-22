# LDT Native Standards Architecture

Updated: 2026-05-14

This is the new target architecture for Twin Base Studio. It supersedes the
current `city_features`-centric data model as the desired production direction,
but it does not require deleting the current runtime immediately.

The product goal is:

> open data in, source evidence preserved, consolidated city inventory,
> FIWARE/NGSI-LD/DCAT/OGC standards out, plus reproducible urban science,
> social, economic, and cultural analysis.

The current PostGIS implementation remains useful as a proving ground. The next
production schema must be standards-native rather than a generic map-feature
store with exports bolted on later.

## Why Change

The current database proves that a city can be instantiated and enriched, but it
mixes too many responsibilities inside `city_features`:

- raw source features,
- normalized provider layers,
- consolidated city inventory,
- building candidates,
- source evidence,
- visual map layers,
- semantic seeds,
- report indicators.

That makes the UI and API confusing for large cities such as Kharkiv. It also
does not yet satisfy the LDT4SSC direction around semantic interoperability,
DCAT, context brokers, JSON-LD/RDF, NGSI-LD, ODRL, and federation.

The production model must separate:

1. source data,
2. datasets and catalog metadata,
3. consolidated city entities,
4. evidence and review decisions,
5. semantic packs,
6. interoperability projections,
7. viewer aggregates,
8. scientific models,
9. social/economic/cultural observations.

## Target Schemas

Use one PostgreSQL/PostGIS database with explicit schemas:

```text
ldt_core      consolidated city entities and city inventory
ldt_catalog   datasets, distributions, licenses, catalog metadata
ldt_prov      agents, activities, lineage, evidence, review decisions
ldt_interop   DCAT, NGSI-LD, OGC, ODRL, context-broker projection state
ldt_fiware    FIWARE broker connections, subscriptions, sync state
ldt_science   indicators, scaling models, networks, simulations, scenarios
ldt_society   demographic, social, economic, cultural, wellbeing observations
ldt_viewer    vector tiles, density grids, cached summaries, map generalization
ldt_semantic  semantic-pack manifests, rules, city bindings, service workflows
legacy        compatibility views over the current tables during migration
```

## Core Data Model

### `ldt_catalog`

Purpose: make every source dataset explicit and exportable.

Tables:

- `datasets`
- `dataset_distributions`
- `dataset_licenses`
- `dataset_spatial_extents`
- `dataset_temporal_extents`
- `dataset_quality_reports`

Standards target:

- `DCAT`
- `DCAT-AP` where useful
- ISO-style geographic metadata where useful

### `ldt_prov`

Purpose: preserve why the twin believes something.

Tables:

- `agents`
- `activities`
- `source_features`
- `entity_source_evidence`
- `entity_match_groups`
- `entity_review_decisions`
- `lineage_events`

Standards target:

- `PROV-O` concepts: entity, activity, agent, derivation, attribution.

### `ldt_core`

Purpose: store the city as an inventory of consolidated entities, not as source
layers.

Tables:

- `cities`
- `city_boundaries`
- `city_entities`
- `building_entities`
- `road_entities`
- `facility_entities`
- `place_entities`
- `land_use_entities`
- `green_blue_entities`
- `mobility_entities`
- `asset_relationships`

Important rule:

`OSM`, `Overture`, `Microsoft`, `Google`, official cadastral files, BIM, and
sensor feeds are sources. The analyst-facing map reads consolidated entities.
Source overlap, duplication, and confidence live in evidence and review tables.

## Standards And Interoperability

### `ldt_interop`

Purpose: expose the consolidated twin through recognized standards.

Tables:

- `dcat_exports`
- `jsonld_contexts`
- `rdf_graph_exports`
- `ngsi_entity_mappings`
- `ngsi_entity_projections`
- `ogc_collections`
- `ogc_collection_schemas`
- `odrl_policies`
- `ldes_event_streams`
- `standard_conformance_reports`

Targets:

- `DCAT` for catalog publication.
- `NGSI-LD` / Smart Data Models for contextual entities.
- `JSON-LD` / `RDF` for semantic descriptions.
- `LDES` for publishable change streams where useful.
- `OGC API Features` and `GeoPackage` for geospatial access/export.
- `ODRL` for data policy metadata.
- `OAuth2` / `OpenID Connect` compatible access patterns.

Phase 4 implementation status:

- `dcat_exports` now stores generated city catalog JSON-LD.
- `jsonld_contexts` now contains DCAT and NGSI-LD context documents with
  stable API aliases.
- `ngsi_entity_mappings` now maps the first core entity types into NGSI-LD /
  Smart Data Models names.
- `ngsi_entity_projections` now stores generated NGSI-LD payloads from
  consolidated `ldt_core.city_entities`.
- `ogc_collections` now stores per-city OGC API Features collection metadata.
- `odrl_policies` now contains a first open-baseline attribution policy.
- The live API serves DCAT, NGSI-LD entities, OGC landing/conformance,
  collections, and GeoJSON collection items.

Important boundary:

The standard projections are not the source of truth. They are generated from
the consolidated inventory and can be regenerated after reingestion,
consolidation, official validation, or future FIWARE sync.

### `ldt_fiware`

Purpose: make FIWARE an operational context layer without turning it into the
only database.

Tables:

- `context_broker_connections`
- `context_broker_tenants`
- `context_broker_subscriptions`
- `context_sync_jobs`
- `context_observations`
- `context_events`
- `broker_projection_state`

Design:

```text
ldt_core city_entities
        ↓
ldt_interop NGSI-LD projection
        ↓
ldt_fiware broker sync
        ↓
FIWARE Context Broker
        ↓
city systems, agents, sensors, services, dashboards
```

PostGIS remains the durable inventory and analytical store. FIWARE is the
context-broker and live interoperability layer:

- publish entities into a FIWARE-compatible NGSI-LD broker,
- subscribe to broker updates from sensors or external systems,
- write time-varying observations back into `ldt_fiware` and, when appropriate,
  link them to `ldt_core` entities.

Phase 5 implementation status:

- `context_broker_connections` now stores broker URL, tenant, NGSI-LD path,
  batch size, headers, auth mode, and metadata.
- `context_sync_jobs` now records push jobs by city, NGSI-LD type, dry-run
  mode, requested limit, status, stats, and errors.
- `context_projection_state` records per-entity broker sync state, payload
  hash, last job, last synced time, and last error.
- `context_broker_subscriptions` stores watched attributes and callback URLs.
- `context_observations` stores incoming context values and links them to
  `ldt_core.city_entities` through the NGSI-LD projection where possible.
- The first adapter pushes to the NGSI-LD batch upsert endpoint:
  `/ngsi-ld/v1/entityOperations/upsert`.
- FIWARE remains an adapter over `ldt_interop.ngsi_entity_projections`; it is
  not the canonical city inventory.

## Urban Scientific Analysis Standard

### `ldt_science`

Purpose: create a reproducible scientific-analysis layer for cities. This is
where the Bettencourt-style work belongs, plus network models, simulations, and
mathematical urban models.

Tables:

- implemented now: `indicator_definitions`, `indicator_observations`,
  `indicator_quality`, `scaling_model_definitions`, `scaling_model_fits`,
  `scaling_residuals`, `network_layers`, `network_metrics`,
  `simulation_models`, `simulation_runs`, `scenario_definitions`,
  `scenario_inputs`, `scenario_outputs`, and `model_calibrations`.
- still planned: `analysis_geographies`, `analysis_time_windows`,
  `city_comparison_cohorts`, `network_nodes`, `network_edges`,
  `accessibility_results`, and dedicated `uncertainty_reports`.

Initial model families:

- urban scaling laws,
- density and morphology indicators,
- road and mobility network centrality,
- accessibility and service coverage,
- resilience and failure propagation,
- reconstruction and priority scoring,
- waste/service logistics,
- climate, heat, flood, and fire scenario hooks,
- agent-based or system-dynamics models when justified.

Principles:

- every indicator has a definition, unit, source, time window, geography, and
  quality/confidence statement;
- every simulation run records inputs, parameters, model version, code version,
  outputs, and uncertainty notes;
- scientific outputs can be compared across cities only when geography,
  population definition, source coverage, and time window are explicit.

## Social, Economic, And Cultural Layer

### `ldt_society`

Purpose: represent the city as people, livelihoods, culture, wellbeing, and
identity, not only as physical geometry.

Tables:

- implemented now: `observation_series`, `observations`,
  `privacy_policies`, `source_quality_rules`, `domain_profiles`,
  `social_vulnerability_scores`, `equity_gap_results`, `cultural_assets`, and
  `participation_events`.
- still planned: `population_groups`, `demographic_observations`,
  `household_observations`, `migration_observations`, `economic_entities`,
  `economic_observations`, `employment_observations`,
  `business_activity_observations`, `cost_of_living_observations`,
  `service_access_models`, `wellbeing_indicators`, `heritage_assets`,
  `cultural_events`, `cultural_activity_observations`, `place_identity_tags`,
  `survey_datasets`, `survey_responses_aggregated`,
  `sentiment_observations`, and `complaint_observations`.

Privacy rule:

Social, economic, and cultural data should normally be aggregated by city,
district, grid, corridor, service area, or other approved geography. The
open-source viewer should not expose personal microdata.

Suggested privacy levels:

- `public`
- `aggregated`
- `sensitive`
- `restricted`
- `prohibited_for_public_view`

## Semantic Packs And City Services

### `ldt_semantic`

Purpose: convert source evidence, inferred seeds, science observations, and
city/provider layers into explicit service meaning without contaminating the
base twin.

Tables:

- `pack_registry`
- `pack_rules`
- `city_pack_bindings`
- `service_indicators`
- `service_features`
- `service_workflows`
- `pack_exports`
- `review_decisions`

Status:

- implemented in Phase 9 for the first `reconstruction-service-core` reference
  pack.
- stores manifest, rules, binding, indicators, service features, workflows,
  and a JSON export per city.
- keeps semantic-pack outputs separate from `ldt_core` city inventory.
- marks missing authority-grade sources as blockers instead of inventing
  operational claims.

## Viewer And Analysis Products

### `ldt_viewer`

Purpose: make large cities visually complete without pushing every geometry to
the browser.

Tables:

- `visual_tiles`
- `building_density_grid`
- `layer_coverage_grid`
- `indicator_grid`
- `city_summary_cache`
- `viewer_snapshot_cache`
- `map_generalization_rules`

Kharkiv should not look empty at city scale. The city-scale map should show
density, coverage, and analytical grids. Feature-level buildings appear when the
viewer zooms into district/street scale.

## Eleven Delivery Phases

### Phase 0: Architecture Freeze And Migration Guardrail

- Adopt this document as the target architecture.
- Freeze current `city_features` as legacy runtime storage.
- Keep current cockpit working while new schemas are added in parallel.
- Define migration acceptance criteria for Adazi and Kharkiv.

### Phase 1: Native LDT Core Schema

- Add `ldt_catalog`, `ldt_prov`, and `ldt_core` schemas.
- Add migrations, indexes, and compatibility views.
- Define canonical entity types and IDs.
- Add dataset/provenance/review primitives.

### Phase 2: Source-Native Open Data Reingestion

- Reingest OSM, Overture, Nominatim/Wikidata/Wikipedia into source-native
  tables.
- Do not immediately treat source features as city truth.
- Preserve licenses, source IDs, raw properties, and ingestion runs.

### Phase 3: Consolidation And Evidence Engine

- Create city entities from source evidence.
- Conflate OSM/Overture/official/BIM/cadastral sources.
- Write evidence links, match scores, accepted/rejected states, and authority
  status.

### Phase 4: Standards-Native Interoperability

- Done: add DCAT JSON-LD export.
- Done: add JSON-LD contexts for DCAT and NGSI-LD.
- Done: add first NGSI-LD / Smart Data Models mappings.
- Done: add OGC API Features collections over consolidated entities.
- Done: add first ODRL attribution policy metadata.
- Pending: add RDF graph export if a federation partner needs RDF beyond
  JSON-LD.
- Pending: add offline GeoPackage export as a distribution target.

### Phase 5: FIWARE Context Broker Integration

- Done: add broker connection records.
- Done: push selected city entities from existing NGSI-LD projections.
- Done: add sync jobs and per-entity broker projection state.
- Done: add subscription registration and optional broker push.
- Done: add observation storage linked back to projected city entities.
- Pending: connect to a real Orion-LD or Scorpio deployment.
- Pending: add resumable full-city/tiled sync and production retry policy.

### Phase 6: Large-City Viewer And Aggregates

- Build density grids and vector tiles from consolidated entities.
- Make full-city scale views use aggregates by default.
- Keep feature-level geometry for viewport/zoomed inspection.
- Replace source-layer toggles with inventory/evidence-aware controls.

### Phase 7: Urban Scientific Analysis Standard

- Implement `ldt_science`. Done for the first `urban-science-core` release.
- Add first indicators, scaling models, network metrics, and simulation-run
  records. Done at baseline/proxy level.
- Produce reproducible city-analysis reports for Adazi and Kharkiv. Done.
- Remaining: district/subarea geographies, routable network topology, calibrated
  multi-city scaling fits, accessibility calculations, and quantified
  uncertainty reports.

### Phase 8: Social, Economic, And Cultural Standard

- Implement `ldt_society`. Done for the first `society-culture-core` release.
- Add demographic, economic, service-access, cultural, heritage, and
  participation observations. Done at aggregate/open-anchor baseline level.
- Add privacy and aggregation rules before public visualization. Done for
  aggregate/public-open records.
- Remaining: official population/demographic data, subarea geography, survey
  aggregation, authoritative heritage datasets, economic registries, and
  private/public UI separation for sensitive records.

### Phase 9: Semantic Packs And City Services

- Convert inferred seeds into explicit semantic-pack rules. Done for the first
  reconstruction/service-continuity family.
- Build the first service pack: Reconstruction Service Core. Done.
- Expose service APIs, indicators, exports, and review workflows. Done at API
  and database level.
- Remaining: cockpit UI panels, review/override UX, and additional packs for
  flood, fire, waste, mobility, planning/BIM, and public-service access.

### Phase 10: Open-Source Production Package

- Publish deployment profile.
- Add conformance checks for core standards.
- Add import/export packages for any city.
- Add backup/restore, migration, and city acceptance tests.
- Separate open-source runtime from internal AI/operator command tooling.

## Immediate Implementation Order

1. Create the new DB schemas and empty migrations. Done in
   `server/db/migrations/005_ldt_native_schema_skeleton.sql`.
2. Create the canonical entity and dataset tables. Done in
   `server/db/migrations/006_ldt_phase1_core_primitives.sql`, including the
   entity type registry, identifier namespaces, dataset license/spatial/temporal
   extensions, source/evidence/match/review primitives, and lineage events.
3. Reingest Adazi into the new model as the small validation city. Done with
   `npm run db:ldt:reingest-open -- --city=adazi`.
4. Reingest Kharkiv into the new model as the large-city validation case. Done
   with `npm run db:ldt:reingest-open -- --city=kharkiv`.
5. Create consolidated city inventory and evidence links. Done with
   `npm run db:ldt:consolidate -- --city=adazi,kharkiv`.
6. Build building density/coverage grids for Kharkiv before changing the UI
   again.
7. Add DCAT and NGSI-LD exports after the canonical entity model is populated.
8. Add FIWARE broker sync as an adapter, not as the primary data store.
