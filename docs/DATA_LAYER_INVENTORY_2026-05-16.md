# Data Layer Inventory

Updated: 2026-05-20

This inventory records the current Twin Base Studio data layer before the next
analytics and UI rebuild. It separates what is already in the database from
what is still only available as code, documents, or planned product behavior.

## Current Runtime

- Database engine: PostgreSQL 16 with PostGIS 3.4, running through the local
  Docker Compose service `twin-base-studio-db`.
- Local database URL:
  `postgresql://twin_base_studio:twin_base_studio_dev@127.0.0.1:45432/twin_base_studio`
- Application service: `twin-base-studio`, exposed locally at
  `http://127.0.0.1:4192`.
- Worker service: `twin-base-studio-worker`, running provider ingestion jobs.
- SQLite is not part of the runtime path. Legacy JSON files remain seed/mirror
  or generated artifacts only.
- PostGIS connection ownership is centralized in `server/db/postgisPool.mjs`.
  The first repository split moved viewer/capability reads to
  `server/db/productionTwinStore/viewerRepository.mjs`, with shared viewer
  property shaping in `server/db/productionTwinStore/featurePresentation.mjs`;
  selected-area units and summaries now live in
  `server/db/productionTwinStore/selectionUnitRepository.mjs`. The remaining
  `productionTwinStore.mjs` file is a compatibility facade over explicit
  repositories.
- Base-twin runtime support is now partially modularized under
  `server/services/baseTwin/*`: live-cache ownership, shared payload constants,
  pure geospatial helpers, pure payload helpers, shared feature-category sets,
  feature collection assembly, inventory/metric assembly, production-record
  payload assembly, 3D scene payload assembly, shared viewer shell rendering,
  and per-surface viewer page renderers are no longer embedded directly in
  `baseTwinService.mjs`. Open-data source fetchers for Nominatim,
  boundary-tiled Overpass, and Wikipedia are also separated there.

## Schema Inventory

Live database schemas currently present:

| Schema | Tables | Responsibility |
| --- | ---: | --- |
| `public` | 30 | Legacy/runtime compatibility, auth, registry, provider ingestion, source artifacts, and current viewer compatibility tables. |
| `ldt_core` | 14 | Consolidated city inventory and canonical city entities. |
| `ldt_catalog` | 6 | Dataset catalog, distributions, licenses, spatial/temporal extents, and quality reports. |
| `ldt_prov` | 8 | Source features, activities, agents, evidence, matching groups, review decisions, and lineage. |
| `ldt_interop` | 7 | DCAT, JSON-LD, NGSI-LD, OGC collections, ODRL, and event-stream projection state. |
| `ldt_fiware` | 5 | FIWARE broker connections, subscriptions, sync jobs, observations, and projection state. |
| `ldt_science` | 14 | Scientific indicators, observations, quality, scaling models, networks, simulations, scenarios, and calibration. |
| `ldt_society` | 9 | Social, economic, cultural, participation, privacy, quality, and vulnerability/equity placeholder structures. |
| `ldt_viewer` | 2 | Cached city summaries and density grids for large-city viewer performance. |
| `ldt_semantic` | 8 | Semantic pack registry, rules, city bindings, indicators, features, workflows, exports, and review decisions. |
| `legacy` | 3 views | Compatibility views over current runtime tables. |

## Loaded Cities

The standards-native `ldt_core.cities` inventory currently contains:

| City | Country | Region | Notes |
| --- | --- | --- | --- |
| `adazi` | Latvia | Riga planning region | Small-city validation case. |
| `kharkiv` | Ukraine | Kharkiv Oblast | Large-city / Ukrainian meeting case. |

The legacy `public.cities` table still contains five runtime city records. Only
`adazi` and `kharkiv` are fully represented in the LDT-native schemas.

## Current Data Volumes

High-level live counts:

| Area | Count |
| --- | ---: |
| `public.city_features` legacy/runtime features | 582,621 |
| `ldt_prov.source_features` source-native records | 325,342 |
| `ldt_core.city_entities` consolidated city entities | 243,471 |
| `ldt_interop.ngsi_entity_projections` NGSI-LD projections | 243,471 |
| `ldt_catalog.datasets` catalog datasets | 28 |
| `ldt_viewer.city_summary_cache` city summaries | 2 |
| `ldt_viewer.density_grids` density-grid cells | 285 |
| `ldt_science.indicator_observations` science observations | 20 |
| `ldt_society.observations` society/culture observations | 20 |
| `ldt_semantic.service_indicators` semantic-pack indicators | 20 |
| `public.providers` provider records | 15 |
| `public.layer_ingestion_jobs` ingestion jobs | 128 |
| `public.source_artifacts` raw/source artifacts | 237 |

## Consolidated Entity Inventory

`ldt_core.city_entities` by city:

| City | Entity type | Count |
| --- | --- | ---: |
| `adazi` | building | 6,483 |
| `adazi` | facility | 732 |
| `adazi` | green_blue_system | 1,264 |
| `adazi` | place | 17 |
| `adazi` | road | 2,979 |
| `kharkiv` | building | 230,641 |
| `kharkiv` | facility | 240 |
| `kharkiv` | green_blue_system | 180 |
| `kharkiv` | place | 35 |
| `kharkiv` | road | 900 |

Important reading:

- Kharkiv has a large consolidated building inventory because Overture building
  candidates are present.
- Kharkiv roads, facilities, green-blue systems, and places are still weak:
  they reflect capped/partial extraction, not a complete city-grade base.
- The current data layer already records this limitation in science quality
  values such as `partial-open-data`.

## Source-Native Feature Inventory

`ldt_prov.source_features` by city and source layer:

| City | Source layer | Count |
| --- | --- | ---: |
| `adazi` | buildings | 10,895 |
| `adazi` | center | 7 |
| `adazi` | facilities | 2,535 |
| `adazi` | greenBlue | 2,985 |
| `adazi` | overture-buildings | 6,019 |
| `adazi` | places | 102 |
| `adazi` | roads | 9,723 |
| `kharkiv` | buildings | 900 |
| `kharkiv` | center | 1 |
| `kharkiv` | facilities | 240 |
| `kharkiv` | greenBlue | 180 |
| `kharkiv` | overture-buildings | 290,821 |
| `kharkiv` | places | 34 |
| `kharkiv` | roads | 900 |

This is the strongest proof that the current Kharkiv map problem is not only
UI. The city has a strong building candidate source, but the OSM-derived base
layers are still capped or incomplete for roads, facilities, places, and
green-blue systems.

## Dataset Catalog

`ldt_catalog.datasets` currently has 28 dataset records. The represented source
families are:

- OpenStreetMap / Nominatim derived boundary, roads, buildings, facilities,
  green-blue systems, places, and center anchors.
- Overture Maps Buildings.
- Runtime source artifacts for Overpass, city-boundary search, Wikipedia, and
  provider Overture fetches.

Current issue:

- Most datasets use `access_rights = city-private` even when the source is open.
  That is conservative but not yet product-grade for an open-source city twin.
  We need a policy pass that distinguishes public catalog publication from
  protected runtime artifacts.

## Viewer Aggregates

`ldt_viewer` currently stores:

- `city_summary_cache`: one default summary for `adazi` and one for `kharkiv`.
- `density_grids`: `city-density-2km` grids with 21 cells for `adazi` and 264
  cells for `kharkiv`.
- `selection_units`: source-aware district/neighborhood/block/custom-polygon
  selection units. Kharkiv now has open-source inferred block/manzana units
  generated from public roads and the city boundary with
  `source_method = road-polygonize-open-data`, `status = available-inferred`,
  and `review_status = unreviewed`.
- `visual_share_manifests`: persisted visual-surface manifests for map,
  municipal 3D, and public immersive share/embed configurations.
- The selection-unit API reuses the city boundary, density-grid cells, and
  generated `selection_units`. District/neighborhood selections remain
  missing-source until an authority dataset or explicit open source exists.
- The frontend now consumes selected-area summaries for the analytical map and
  exposes the same selected-area language in the municipal 3D and public
  immersive visual strips. The data source is still `ldt_core`/`ldt_viewer`,
  not a separate viewer-local cache.

Current issue:

- The cockpit now reads selected-area summaries from the live API, but some
  aggregate UI metrics still derive from older payload compatibility paths
  instead of `ldt_viewer` and `ldt_science`.
- The live viewer/capability delivery code now has its own repository module,
  selected-area summary code now has its own repository module,
  but the storage model still has compatibility tables and legacy payload
  shapes that should be retired only after the visual surfaces are rebuilt.
- The base-twin service now has smaller support modules for source fetching,
  GeoJSON layer assembly, open-data payload assembly, inventory/metric
  assembly, scene assembly, stored PostGIS payload assembly, and per-surface
  viewer rendering. The visual renderers now delegate browser-side runtime code
  to per-surface `viewerRuntimes` modules. The provider-ingestion facade now
  delegates direct actions to source-family modules and queued execution to job
  orchestration. The remaining compatibility risk is no longer one giant
  backend service; it is that the extracted viewer runtimes still preserve
  legacy JSON payload assumptions while Phase 13 rebuilds the viewer surfaces.

## Science Indicators

`ldt_science.indicator_observations` currently contains 10 indicators per city:

- boundary compactness
- building footprint intensity
- built fabric density
- green-blue coverage
- land-use coverage gap
- open provider building uplift
- road granularity
- road length density
- service seed density
- standards projection coverage

Important Kharkiv quality flags:

- `road_granularity`: `partial-open-data`
- `road_length_density`: `partial-open-data`
- `green_blue_coverage`: `partial-open-data`
- `open_provider_building_uplift`: `candidate-evidence`

This is the correct posture. The data layer should make uncertainty visible
instead of pretending that every indicator is authoritative.

## Society, Culture, And Semantic Packs

`ldt_society` currently stores baseline aggregate observations and source
quality rules. It does not contain personal microdata.

`ldt_semantic` currently contains the `reconstruction-service-core` semantic
pack with 10 indicators per city. For both `adazi` and `kharkiv`, the pack
correctly marks:

- damage data connected: 0%, `missing-required-source`
- population demand connected: 0%, `missing-required-source`

That means the reconstruction pack is a service-readiness scaffold, not a real
damage or priority model yet.

## Environmental Phenomena And Extractors

`ldt_environment` now has two distinct responsibilities:

- proxy phenomenon layers generated from the current open city inventory and
  viewer density grids;
- source-backed extractor contracts and concrete adapters for DEM, weather,
  hydrology screening, and future STAC-derived indicator inputs.

The implemented source-backed contract tables are:

- `ldt_environment.extractor_definitions`
- `ldt_environment.extractor_runs`
- `ldt_environment.extractor_artifacts`

The first extractor keys are `terrain-dem`, `weather-field`,
`hydrology-grid`, and `stac-derived-indicator`. `terrain-dem` samples Mapzen
Terrain Tiles on AWS Open Data onto a city DEM grid, writes
`terrain_elevation_m` and `terrain_slope_deg` cells, registers a DCAT-style
dataset record, and attaches terrain observations to the city inventory.
`weather-field` now samples Open-Meteo current weather values into a city grid,
writes `weather_air_temperature_c`, `weather_wind_speed_ms`, and
`weather_wind_direction_deg`, catalogs the source/terms, and attaches those
observations to city objects. `hydrology-grid` now writes
`hydrology_surface_water_signal` from DEM elevation/slope cells plus mapped
open-water evidence and attaches that screening signal to city objects. It is
not a drainage or flood-depth simulation. `surface-runoff-screening-v0` is the
first scenario runner on top of that signal: it applies rainfall amount and
duration assumptions, writes `surface_runoff_screening` cells and
object-attached observations, refreshes the TwinQL summary, and records
inputs/outputs in `ldt_science`. It is still a screening scenario, not a
calibrated hydraulic model. The STAC extractor
remains `source-plan-only`: the database stores source candidates, output layer
contracts, standards mappings, coverage footprints, and validation posture, but
does not yet claim that those real raster/EO datasets have been downloaded.

## API/Data Engineering Commands

Available repeatable commands:

- `npm run db:migrate`
- `npm run db:ingest:base-cache`
- `npm run db:ldt:reingest-open`
- `npm run db:ldt:consolidate`
- `npm run db:ldt:generate-interop`
- `npm run db:ldt:fiware-sync`
- `npm run db:ldt:refresh-viewer-aggregates`
- `npm run db:ldt:generate-urban-science`
- `npm run db:ldt:generate-society`
- `npm run db:ldt:generate-semantic-packs`
- `npm run db:ldt:generate-environmental-phenomena`
- `npm run db:ldt:register-environmental-extractors`
- `npm run db:ldt:run-terrain-dem`
- `npm run db:ldt:run-hydrology-grid`
- `npm run db:ldt:run-surface-runoff`
- `npm run worker:provider-ingestion`
- `npm run worker:provider-ingestion:once`

Available validation commands:

- `npm run test:ldt-schema-smoke`
- `npm run test:ldt-reingest-smoke`
- `npm run test:ldt-consolidation-smoke`
- `npm run test:ldt-interop-smoke`
- `npm run test:ldt-fiware-smoke`
- `npm run test:ldt-viewer-aggregates-smoke`
- `npm run test:ldt-urban-science-smoke`
- `npm run test:ldt-society-smoke`
- `npm run test:ldt-semantic-packs-smoke`
- `npm run test:ldt-environmental-phenomena-smoke`
- `npm run test:ldt-environmental-extractors-smoke`
- `npm run test:ldt-terrain-dem-smoke`
- `npm run test:ldt-hydrology-grid-smoke`
- `npm run test:ldt-surface-runoff-smoke`
- `npm run test:viewer-window-smoke`

## Current Data Engineering Risks

1. The LDT-native schemas exist, but the live UI still depends on compatibility
   payloads and legacy `public` tables in several places.
2. Kharkiv open-base OSM extraction is incomplete outside buildings. This is a
   data ingestion weakness, not just a rendering weakness.
3. API contracts are no longer concentrated in `server/index.mjs`: admin,
   provider, live, standards, auth, health, platform, and viewer-shell routes
   now live under `server/routes/*`, while shared HTTP middleware lives under
   `server/http/*`. Live API routes are split by base payload, operations,
   feature delivery, analytical reports, and BIM. Admin layer routes are split
   by registry, authority/conflation, ingestion jobs, and ingest adapters. The
   remaining backend risk is now the data/service layer. PostGIS connection
   ownership has been extracted to `server/db/postgisPool.mjs`, the first
   viewer repository has been split out, and base-twin cache/geo/payload/
   open-data/shell helpers now live in `server/services/baseTwin/*`;
   `productionTwinStore.mjs` and the remaining `baseTwinService.mjs`
   payload/runtime assembly still need stronger repository and use-case
   boundaries.
4. Provider ingestion exists, but job monitoring and operational observability
   are still weak.
5. Source licensing and `access_rights` need a catalog-governance pass before
   calling the catalog public-ready.
6. Review/authority decisions exist structurally, but the city-analyst review
   workflows are not yet exposed as product UI.
7. `public.city_features` is still very large and active as a compatibility
   layer. The product needs a clear retirement path once LDT-native APIs fully
   serve the UI.

## Recommended Next Data Layer Work

1. Make the LDT schemas the only source for the next UI rebuild.
2. Keep `public` tables as compatibility and runtime-admin tables, not the
   analytical source of truth.
3. Create a city API capability registry so the UI can ask what each city can
   currently serve: base entities, source evidence, standards, FIWARE,
   indicators, semantic packs, BIM, raster, and provider layers.
4. Add API observability before adding more analytics: usage, latency, errors,
   endpoint versions, city IDs, user roles, and ingestion/job events.
5. Backfill Kharkiv roads, places, facilities, and green-blue systems through a
   heavy-city OSM/import profile before using Kharkiv as evidence of complete
   open-base coverage.
6. Wire science, society, semantic-pack, and viewer aggregate APIs into the UI
   before designing more analytical dashboards.
