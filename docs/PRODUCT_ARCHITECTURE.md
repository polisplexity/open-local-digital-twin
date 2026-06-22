# Twin Base Studio Product Architecture

Updated: 2026-05-23

For the current documentation map and canonical-vs-historical source rule, see
[ARCHITECTURE_INDEX.md](./ARCHITECTURE_INDEX.md). This file describes the
product architecture target; `PRODUCT_TODO.md` records current phase status and
remaining implementation gaps.

## Product Promise

Twin Base Studio is an open-source Local Digital Twin platform for cities.

The product should let any city:

1. create a base twin from open and municipal data,
2. register additional provider layers,
3. validate and govern those layers,
4. install semantic packs for domain use cases, and
5. expose interoperable APIs, catalog records, and exports.

The product runtime must stay separate from the internal command center used to
coordinate proposals, emails, transcripts, evidence, and AI-agent work.

## Provider Receiver Rule

Twin Base Studio is a receiver, governance layer, and interoperability layer for
technology-provider outputs first. It should not try to recreate every partner
technology inside the open-source core.

Provider capabilities are handled as:

- receive-only outputs when a partner owns the model, private data, or method,
- open-data-native capabilities when the same useful function can be computed
  from public/open sources,
- hybrid capabilities when open data gives a baseline and partner or authority
  data improves precision, freshness, or legal authority.

The open-source core should focus on intake contracts, provenance, source
evidence, semantic attachment, standards publication, workflows, visual query,
and APIs. It should generate similar functionality only when it can be derived
from open data without copying a provider's proprietary product.

## 2026-05-13 Architecture Rebaseline

The target production architecture is now the standards-native Local Digital
Twin model documented in
[LDT_NATIVE_STANDARDS_ARCHITECTURE.md](./LDT_NATIVE_STANDARDS_ARCHITECTURE.md).

The current `city_features` model remains a runtime bridge. It should not be
treated as the final product database. The production direction is:

- `ldt_catalog` for datasets, distributions, licenses, quality, and DCAT
  publication.
- `ldt_prov` for source features, lineage, matching evidence, and authority
  review decisions.
- `ldt_core` for consolidated city inventory: buildings, roads, facilities,
  places, land use, green-blue systems, mobility assets, and relationships.
- `ldt_interop` for DCAT, JSON-LD/RDF, NGSI-LD, OGC, ODRL, LDES, and
  standards conformance.
- `ldt_fiware` for FIWARE context-broker connections, subscriptions,
  projections, observations, and live sync.
- `ldt_science` for reproducible indicators, urban scaling models, network
  models, simulations, scenarios, calibration, and uncertainty.
- `ldt_society` for demographic, social, economic, cultural, wellbeing, and
  participation observations.
- `ldt_viewer` for vector tiles, density grids, cached summaries, and map
  generalization.
- `legacy` for compatibility views while the current UI and APIs migrate.

Core rule: OSM, Overture, Microsoft, Google, official data, BIM, sensors, and
manual review are sources. The analyst-facing twin should show consolidated
city entities, with source overlap, confidence, and duplicates available as
evidence and reports.

## Product Layers

### 1. Base Twin

The base twin is the minimum city canvas. It starts with open data and can later
be strengthened with municipal data.

Current open sources:

- OpenStreetMap through Overpass for roads, buildings, amenities, public
  transport, shops, places, green systems, and blue systems.
- Nominatim for city lookup, center, and boundary context.
- Wikipedia REST summaries for public descriptive context.

Future base sources:

- municipal open-data portals,
- national cadastral or mapping datasets,
- GeoJSON, Shapefile, GeoPackage, CSV, and Excel uploads,
- CityJSON or other city-model packages.

Building coverage is treated as a production-grade coverage problem, not as a
single OSM count. The product separates:

- observed buildings: footprints already in the trusted base or authority layer,
- candidate buildings: open or provider footprints that must be conflated,
  de-duplicated, and confidence-scored,
- estimated missing buildings: a numeric range only when an independent source
  supports the estimate.

The default open-source source order for buildings is:

1. official municipal / national building or cadastral data when license allows,
2. OpenStreetMap / Overpass as the base observable fabric,
3. Overture Maps Buildings as the preferred open conflated enrichment source,
4. Microsoft Global ML Building Footprints as candidate footprints,
5. Google Open Buildings only where published coverage includes the city.

The runtime must keep source, license, attribution, confidence, and derivation
metadata on the layer and, where possible, on each feature. It must not present
ML-derived or statistically inferred buildings as authority-grade city assets.

The first Overture connector is implemented as an admin/provider ingestion path:

- register a city layer such as `overture-buildings`,
- call `POST /api/admin/cities/:cityId/layers/:layerKey/ingest-overture-buildings`,
- optionally pass `bbox`, `release`, and `limit`,
- the server queries Overture Buildings GeoParquet with DuckDB, converts the
  result to GeoJSON through the official Overture CLI, and stores it through
  the normal provider-layer PostGIS ingestion path.

Overture records remain candidate footprints until a conflation job compares
them to OSM, official, BIM, or cadastral footprints. The first implemented
coverage conflation pass is intentionally conservative and fast enough for the
runtime summary:

- observed buildings are the current OSM/base twin footprints inside the latest
  municipal boundary,
- candidate buildings come from connected Overture, Microsoft, Google Open
  Buildings, official, or cadastral building layers,
- a candidate is treated as already explained by the base twin when it
  intersects an observed footprint or its centroid is within 10 meters of one,
- candidates that do not match are reported as candidate missing footprints,
  not as confirmed missing municipal buildings.

The first persistence step writes those review states back into normal PostGIS
viewer layers:

- `buildingCandidateNew` for provider footprints not matched to the observed
  base,
- `buildingCandidateMatched` for provider footprints that intersect or sit
  within 10 meters of an observed base footprint.

In the cockpit UI these are not exposed as unrelated top-level layers. They are
controlled through the Buildings coverage selector so the user reads them as
review states of the built-fabric layer: observed, new candidates, matched
candidates, or all.

The next production hardening step is to add accepted/rejected decisions, source
priority, stronger overlap ratios, and official validation where available.

### 2. Provider Layers

Provider layers are datasets attached to the base twin by a city department,
public agency, university, vendor, or AI-assisted ingestion process.

Examples:

- flood maps,
- fire risk, hydrants, stations, incidents, and response zones,
- satellite / EO products,
- IoT sensor feeds,
- BIM / IFC / CityJSON / 3D Tiles,
- mobility feeds,
- waste systems,
- public works data,
- emergency alerts.

Every provider layer must carry ownership, source, license, access level,
freshness, update method, authority status, and provenance.

Provider layers are not automatically product features. A provider output
becomes operational only after the product knows what it represents, how it was
generated, what license and authority posture it carries, how it attaches to
city entities, and which semantic pack or service consumes it.

### 3. Interconnection And Interoperability

This is a first-class product layer, not marketing copy.

It implements the LDT4SSC direction around:

- semantic interoperability of exchanged data,
- common data descriptions,
- federation and reuse,
- NGSI-LD / Smart Data Models mappings,
- JSON-LD / RDF descriptions,
- LDES publication paths where useful,
- DCAT catalog records,
- context-broker adapters,
- OAuth2 / OpenID Connect compatible access patterns,
- policy metadata such as ODRL where required.

The implementation rule is: first create a solid internal city entity model,
then map it outward to standards and brokers.

### 4. Semantic Packs

Semantic packs turn raw layers into operational meaning.

Example packs:

- Flood Pack,
- Fire Pack,
- Waste Pack,
- Reconstruction Pack,
- Mobility Pack,
- Climate / Heat Pack,
- Satellite / EO Pack,
- BIM / Asset Pack,
- IoT Sensor Pack.

Each pack defines required layers, optional layers, schemas, validations,
indicators, UI panels, APIs, and exports.

### 5. Services

Services answer city questions and produce operational outputs.

Examples:

- which buildings are exposed to flood risk,
- which districts lack fire coverage,
- which roads are critical in an emergency scenario,
- which buildings have BIM records,
- which sensors are offline,
- which public-space issues require intervention.

## Production Data Backbone

The production default is PostgreSQL with PostGIS.

PostGIS is the source of truth for:

- cities and boundaries,
- base features,
- provider layers,
- semantic layers,
- feature relationships,
- ingestion runs,
- provenance,
- catalog metadata.

PostGIS is not the raw warehouse for every city asset. The product must add
specialized optional components around PostGIS only when they solve a real
production problem:

- controlled OSM/open-data extraction for complete and repeatable base data,
- workflow execution for repeatable ingestion, validation, and approvals,
- S3-compatible object storage for large raster, BIM, LiDAR, imagery,
  simulation, and package assets,
- STAC/COG catalog flows for satellite, aerial, terrain, and other raster
  products,
- predicate-aware vector tiles for high-volume visual queries. First-cut
  TwinQL/CQL2 MVT is implemented through
  `/api/live/:cityId/twin-query-tiles/{z}/{x}/{y}.mvt`; future work should add
  cache invalidation/versioning and public/signed embed policy,
- FIWARE/NGSI-LD live-context sync and optional time-series storage when live
  observations require it,
- signed/public embed policy for shareable visual surfaces,
- agentic operations only through approved and audited workflow records.

The detailed future data-backbone roadmap is documented in
[FUTURE_DATA_BACKBONE_PHASES.md](./FUTURE_DATA_BACKBONE_PHASES.md). That file
is the canonical place to decide what gets added, why it is needed, and which
future phase owns it.

JSON remains useful for:

- API responses,
- viewer snapshots,
- export packages,
- seed configuration,
- derived cache.

SQLite is no longer part of the production runtime path. Lightweight local mode
uses the same Postgres/PostGIS runtime tables as production so the open-source
install path does not drift from deployment reality.

## Current Transition Rule

The existing JSON live-cache remains as a generated artifact and legacy seed
source where needed. Application runtime state and city/twin data now use
Postgres/PostGIS.

Current transition status on 2026-05-10:

- Phase 1 created the PostGIS backbone.
- Phase 2 started by ingesting existing base-twin cache payloads into PostGIS
  and mirroring future successful base-twin refreshes into PostGIS.
- The viewers still read the same JSON payload shape, but that payload is now
  generated from PostGIS when a usable city record exists.
- JSON is now an API/cache/export format during normal reads, not the preferred
  authoritative city store.
- Fresh live refreshes store raw Nominatim, Overpass, and Wikipedia responses as
  source artifacts for provenance. Cache-ingested historical rows cannot be
  backfilled with full raw source responses unless the city is refreshed.
- Fresh live refreshes store full normalized base layers in PostGIS. Rendering
  caps are applied when building the browser payload, not when writing the city
  store.
- Fresh live refreshes use the city boundary bbox as a tiled extraction plan,
  not a center-radius sample. Public Overpass is acceptable for bootstrap and
  demo use; production city deployments should support local OSM extracts or a
  controlled Overpass-compatible service for large cities.
- Phase 3 has started the provider-layer extension point: provider records,
  provider connector contracts, city layer definitions, and layer ingestion jobs
  are now stored in PostGIS and exposed through admin APIs. These records
  define where flood, fire, satellite, IoT, BIM, and other providers connect;
  GeoJSON FeatureCollection ingestion is now implemented as the first provider
  adapter. CSV ingestion for point rows and GeoJSON geometry rows is now the
  second provider adapter. OGC API Features/WFS GeoJSON ingestion is now the
  third provider adapter. STAC item and collection footprint extraction is now
  the first raster/satellite package extraction adapter. CityJSON object-centroid
  extraction is now the first 3D package extraction adapter. IFC STEP
  metadata, property-set, spatial-record, anchor extraction, and `web-ifc`
  native-geometry inspection are now the first BIM package extraction adapter.
  When native geometry exists, IFC ingestion writes raw mesh asset bundles and
  stored IFC records can be served as a BIM index payload for viewer and
  operations workflows. The municipal 3D product path now uses locally served
  CesiumJS. The runtime consumes live BIM/provider anchors, can render open
  city-object query results as 3D entities, and keeps richer mesh/3D asset
  delivery as an optional provider/object-storage path.
  Raster, IoT, BIM/3D, Shapefile, and GeoPackage packages can now be registered with
  provenance and catalog metadata. The admin surface exposes provider/layer
  registration, direct ingestion triggers, queued ingestion jobs, layer/job
  status, and validation reports. A provider ingestion worker can now drain
  queued jobs. GDAL-backed vector extraction is implemented for queued
  Shapefile and GeoPackage package jobs. HTTP-safe package inspection is
  implemented for raster COG headers, WMS capabilities, HTTP JSON/sensor feeds,
  MQTT registration, and 3D Tiles tilesets. Rich BIM operations such as storey
  slicing, room/system filtering, and BIM-to-footprint alignment still require
  the next IFC worker step. The provider-facing
  `/api/provider/v1` surface now separates external provider ingestion from
  admin sessions, and `/api/admin/cities/:cityId/production-plan` reports the
  current city readiness, storage estimate, base-layer completeness, and
  remaining production gaps.
