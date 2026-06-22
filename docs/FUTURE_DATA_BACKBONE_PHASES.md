# Future Data Backbone Phases

Updated: 2026-05-29

This document records what must be added around the current PostGIS backbone,
why each component exists, and which phase should own it. It is intentionally
separate from implementation notes so the product does not confuse current
runtime capability with the target architecture.

## Architecture Rule

PostGIS remains the durable city-twin core. It stores the consolidated
inventory, geometry, provenance, catalog metadata, semantic attachments,
viewer aggregates, query history, workflow state, and standards projections.

PostGIS should not become the raw-file warehouse for every city asset. Heavy
binary, temporal, raster, and model assets should be stored in specialized
optional components and referenced from PostGIS with footprints, metadata,
lineage, license, authority status, and derived indicators.

The default open-source install must remain simple:

- application server,
- PostGIS,
- optional worker.

Everything beyond that should be introduced as an optional production pack
with a clear reason.

### 2026-06-07 Phase 14 Boundary Decision

Do not add a separate numbered phase just to correct data-engine boundaries.
Phase 14 owns the correction:

- Node/Next/Express is the product and control plane: UI, approvals, workflow
  state, API routing, manifests, and orchestration.
- PostGIS is the durable city twin: normalized geometry, consolidated entities,
  source evidence, provenance, catalog metadata, workflow/query state, and
  viewer-ready aggregates.
- Heavy geospatial work should not be reimplemented in the web process. Use
  workers and mature open-source tools for local OSM extracts, GDAL/OGR vector
  conversion, raster/COG handling, and optional MVT serving when scale requires
  it.
- Provider/addon modules must still land in PostGIS as normalized records,
  evidence, metadata, footprints, or derived indicators before the platform
  treats them as part of the twin.

## What Exists Now

| Capability | Current status | Purpose |
| --- | --- | --- |
| PostgreSQL/PostGIS | Implemented | Durable city inventory and spatial query core. |
| LDT schemas | Implemented | `ldt_core`, `ldt_catalog`, `ldt_prov`, `ldt_interop`, `ldt_fiware`, `ldt_science`, `ldt_society`, `ldt_semantic`, `ldt_environment`, `ldt_viewer`, `ldt_ops`, and `ldt_query`. |
| Provider ingestion worker | Implemented | Queue and execute provider/open-data layer jobs outside the web request path. |
| GeoJSON/CSV/OGC/Shapefile/GeoPackage adapters | Implemented first cuts | Bring vector provider and authority data into PostGIS with provenance. |
| Overture Buildings adapter | Implemented first cut | Enrich building inventory from open building footprints. |
| STAC footprint ingestion | Implemented first cut | Register satellite/raster catalog footprints and metadata. |
| CityJSON/IFC ingestion | Implemented first cut | Register 3D/BIM metadata, anchors, and some mesh assets. |
| MVT/vector tiles | Implemented first cut | Render dense city maps without pushing full GeoJSON to the browser. |
| TwinQL/CQL2 query API | Implemented first cut | Query city objects through safe parameterized PostGIS SQL. |
| CesiumJS municipal 3D runtime | Implemented first cut | Render 3D city objects and future 3D assets from the same PostGIS/TwinQL contracts without requiring Cesium ion. |
| Environmental phenomenon layer | Implemented first cut | Store built-form, source-backed terrain, source-backed weather, and legacy proxy evidence in `ldt_environment`, attach summaries to city objects, and expose only product-ready modes in City 3D. |
| Environmental extractor registry | Implemented contract | Register DEM, weather, hydrology, and STAC-derived indicator extractor definitions, city runs, source-plan artifacts, and live inspection APIs before real source downloads are wired. |
| Terrain DEM extractor | Implemented first cut | Sample Mapzen Terrain Tiles from AWS Open Data into source-backed elevation and slope cells, catalog the dataset, and attach terrain observations to city objects. |
| FIWARE/NGSI-LD boundary | Implemented first cut | Generate NGSI-LD projections and record broker sync state. |
| App-native metrics | Implemented first cut | Track API usage, workflow state, and readiness without requiring Grafana. |
| Local runtime file storage | Implemented for dev | Store local uploads, BIM assets, cache, and seed artifacts. Not production object storage. |

## What Must Be Added

| Component | Why it is needed | Product rule | Target phase |
| --- | --- | --- | --- |
| Production OSM extract / controlled Overpass-compatible service | Large cities cannot depend on public Overpass limits for full roads, amenities, green-blue systems, and update repeatability. | Optional city data-engineering pack. PostGIS still stores normalized results. | Phase 14 |
| Open-data workflow runner | Open-data bootstrap needs repeatable jobs, validation, artifacts, errors, and approvals instead of manual scripts. | Lightweight worker first. Prefect/Dagster only if orchestration complexity proves necessary. | Phase 14 |
| Provider exchange package | Technology partners need one stable way to deliver flood, fire, satellite, IoT, BIM, mobility, heritage, water, waste, energy, and AI outputs. | Receiver-first: ingest, validate, attach, catalog, expose. Rebuild only open-data-native equivalents. | Phase 14 |
| Environmental open-data extractors | City 3D needs real terrain, weather, solar, and water source evidence before proxy layers can become source-backed layers. | The extractor registry and run/artifact contract exist. `terrain-dem` writes source-backed elevation/slope, and `weather-field` now writes Open-Meteo air temperature and wind observations. Next adapters are `hydrology-grid`, `stac-derived-indicator`, and richer wind/heat model rendering. Keep proxy layers labelled until sources exist. | Phase 14 |
| S3-compatible object storage | BIM meshes, imagery, LiDAR, rasters, simulations, and large packages should not live as raw blobs inside PostGIS or local runtime folders. | Optional production pack, MinIO-compatible by default. PostGIS stores references and footprints. | Phase 15 |
| STAC catalog and COG/raster asset flow | Satellite, aerial imagery, flood extents, land-surface temperature, NDVI, damage evidence, and time-based raster products need a catalog-native path. | STAC metadata in catalog/provenance; derived vector indicators in `ldt_science`/`ldt_semantic`. | Phase 15 |
| Predicate-aware MVT | Large filtered queries should stream as vector tiles instead of returning massive GeoJSON overlays. | Same TwinQL/CQL2 predicates, pushed into tile SQL. | Phase 15 |
| Official selection-unit ingestion | City analysts need districts, neighborhoods, blocks, parcels, and planning zones with authority labels. | Inferred open-data blocks remain fallback; official units supersede after review. | Phase 15 |
| Time-series / IoT storage path | Sensors and live observations need retention, freshness, and time-window queries. | FIWARE/NGSI-LD first. Add TimescaleDB only when volume/frequency requires it. | Phase 16 |
| Public/signed embed access | Published map, 3D, and immersive views must be shareable outside authenticated cockpit sessions. | Signed manifests, access policies, audit events, no admin leakage. | Phase 16 |
| Agentic workflow execution | AI agents should operate approved city workflows, not freely mutate code or data. | Agents create/run/review `ldt_ops` workflow records under explicit gates. | Phase 16 |
| Raster-derived open indicators | Open satellite/terrain/climate sources should become comparable city indicators. | Store sources and methods; do not present derived indicators as authority data. | Phase 17 |
| Partner service packs | Flood, fire, waste, reconstruction, mobility, climate, BIM, and IoT need domain-specific outputs. | Each pack declares receive-only, open-data-native, or hybrid posture. | Phase 17+ |

## Open-Data Adapter Backlog

These adapters are candidates because they can benefit most cities without
private data. Each must still pass license, coverage, quality, and attribution
review before becoming a default workflow.

| Adapter family | What it contributes | Where outputs belong |
| --- | --- | --- |
| OSM local extract | Roads, paths, amenities, public transport, places, land use, water, green areas. | `ldt_prov`, `ldt_core`, `ldt_catalog`. |
| Overture Base/Places/Transportation | Open buildings, places, transportation, land/water/base map layers. | `ldt_prov`, `ldt_core`, `ldt_catalog`. |
| GHSL / WorldPop | Population exposure and settlement structure proxies. | `ldt_society`, `ldt_science`, `ldt_catalog`. |
| ESA WorldCover / land-cover sources | Land-cover baseline and urban/rural/green/open-space context. | `ldt_science`, `ldt_core`, `ldt_catalog`. |
| JRC surface water / hydro sources | Water presence, flood-prone context, hydrography enrichment. | `ldt_core`, `ldt_science`, `ldt_semantic`. |
| DEM / terrain sources | Elevation, slope, drainage, visibility, accessibility context. | `ldt_science`, `ldt_catalog`, optional raster assets. |
| OpenAQ / open weather sources | Air-quality and weather context where available. | `ldt_society`, `ldt_science`, `ldt_fiware` if live. |
| Wikidata / Wikipedia / GeoNames | Public context, names, cultural anchors, identity references. | `ldt_society`, `ldt_catalog`, `ldt_core` where spatially valid. |

## Additional Open-Data Sources To Evaluate

The base twin can get richer without becoming a provider-specific product, but
each source must stay explicit about license, attribution, update cadence,
coverage, uncertainty, and whether it is authority-grade or only open evidence.
The current priority list is:

| Source | Why it matters | Product posture |
| --- | --- | --- |
| [Overture Maps](https://docs.overturemaps.org/) themes beyond buildings | Adds open transportation, places, base/land/water, and division context from one globally repeatable distribution. | High priority for the open-data workflow runner; normalize into source evidence and consolidated inventory. |
| [Microsoft Global ML Building Footprints](https://github.com/microsoft/GlobalMLBuildingFootprints) | Can fill footprint gaps where OSM/Overture coverage is weak. | Evidence source only until matched, reviewed, and licensed per deployment. |
| [Google Open Buildings](https://sites.research.google/open-buildings/) | Adds ML-derived buildings in covered regions and can improve missing-building estimates. | Optional regional adapter; not a default global dependency because coverage and licensing need per-city review. |
| [GHSL](https://ghsl.jrc.ec.europa.eu/) and WorldPop | Population, built-up, settlement, and exposure proxies for social/science indicators. | Add as raster/indicator workflows, not as individual-person data. |
| [ESA WorldCover](https://esa-worldcover.org/) and Copernicus land-monitoring products | Land cover, green/open space, urban fabric, and environmental context. | Raster-derived indicator pack; store source rasters externally and derived vectors/indicators in PostGIS. |
| [JRC Global Surface Water](https://global-surface-water.appspot.com/) and HydroSHEDS | Water presence, seasonality, drainage, and flood-context baselines. | Hydro/environment pack; useful for flood and green-blue semantic packs. |
| Copernicus DEM / SRTM-style terrain sources | Elevation, slope, visibility, drainage, and accessibility context. | Terrain adapter plus derived indicators; raw DEM belongs in object storage, not PostGIS. |
| [OpenAQ](https://docs.openaq.org/) and national open weather/air portals | Air-quality observations and environmental context where stations exist. | Live/temporal context; can project through FIWARE/NGSI-LD when freshness matters. |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Database_download), Wikipedia, and [GeoNames](https://www.geonames.org/) | Names, cultural anchors, alternate labels, public identity, and contextual references. | Context/evidence layer with careful spatial validation; not a substitute for authority registries. |

These are not all the same kind of data. Roads/buildings/places are city
objects; rasters and DEMs are spatial evidence or derived indicators; live air
quality/weather are observations; cultural/name sources are contextual anchors.
The ingestion workflows must record this difference so the UI can show what is
base inventory, what is provider evidence, what is inferred, and what is a
formal semantic pack.

## Storage Contract

PostGIS stores:

- city entities and geometry,
- source evidence and lineage,
- dataset/catalog/distribution metadata,
- footprints and bounding boxes for heavy assets,
- derived indicators and observations,
- workflow and query events,
- standards projections.

Object storage stores:

- COG/GeoTIFF/raster assets,
- LiDAR and point-cloud packages,
- BIM/IFC/GLB/mesh bundles,
- 3D Tiles and CityJSON packages,
- simulation outputs,
- large source packages and validation artifacts.

The database must always be able to answer:

- what asset exists,
- who supplied it,
- what license and authority status it has,
- what city entities or areas it attaches to,
- what workflow generated or validated it,
- what API or viewer can expose it.

## Phase Acceptance Criteria

### Phase 14 - Open-Data Workflow Runner

Phase 14 is complete when:

- open-data workflows run from `ldt_ops` definitions and write artifacts,
- OSM/open-data bootstrap can be executed as a repeatable job,
- provider exchange package requirements are documented and exposed,
- adapter outputs are classified as receive-only, open-data-native, or hybrid,
- environmental extractor definitions, runs, source plans, artifacts, and
  validation state are persisted before real DEM/weather/hydro/STAC downloads
  are presented as source-backed layers,
- failures, validation reports, and freshness are visible in the Workspace.

### Phase 15 - One-City Production Data Package

Phase 15 is complete when:

- the open-source install can run one primary city with app + PostGIS + worker,
- optional object storage is documented and wired for large packages,
- backups and restore steps cover PostGIS plus object assets,
- predicate-aware MVT is available for high-volume visual queries,
- official selection-unit ingestion can replace inferred open-data units.

### Phase 16 - Live Context, Sharing, And Agentic Operations

Phase 16 is complete when:

- FIWARE/NGSI-LD can operate against a real broker deployment,
- IoT/time-series posture is decided from actual expected volume,
- published viewer manifests have signed/public access policy,
- agents can only execute approved workflows and all actions are audited.

### Phase 17+ - Advanced City Intelligence Packs

Later phases add value through domain packs:

- satellite/EO indicators,
- flood/fire/waste/reconstruction/mobility packs,
- simulation model outputs,
- social/economic/cultural enrichment,
- partner-provided operational services.

These packs must not weaken the core model. They attach to the same city
inventory, provenance, catalog, workflow, query, and standards backbone.
