# Twin Base Studio Code Overview

Updated: 2026-05-18

This document describes what the code in this repository actually does today,
where the product promise is visible in the implementation, and what is still
short of a productive digital twin studio.

For the city promise, evidence, and delivery-status ledger, see
[PROMISE_DELIVERY_AUDIT_2026-05-10.md](./PROMISE_DELIVERY_AUDIT_2026-05-10.md).

## What The Code Does

Twin Base Studio is a custom Next.js 15 application served through an Express
entrypoint. It provides an authenticated workspace for inspecting city-scale
"base twin" data across three primary surfaces:

- Analysis cockpit: a Leaflet map-oriented operations view.
- Municipal 3D viewer: a Three.js viewer for buildings, roads, places, and
  semantic seed layers.
- Public immersive viewer: an A-Frame browser scene for public-facing spatial
  exploration.

The system can register multiple cities, select an active city per session,
fetch public geospatial data for that city, cache normalized base payloads, and
render viewer shells from those payloads.

The product is not yet a full operational digital twin. The current code builds
and presents a base record from public sources, plus inferred semantic signals.
It does not yet operate IoT streams, live municipal work orders, sensor
integrations, permitting workflows, BIM authoring, or simulation engines.

## Runtime Architecture

The runtime has three main parts:

- `server/index.mjs` starts Express, prepares Next, applies security/session
  middleware, registers route modules, and protects workspace routes.
- `server/services/*.mjs` owns runtime state, city registry, authentication, and
  live city payload generation.
- `src/app`, `src/components/twin-module`, `src/context`, and
  `src/data/digital-twin` own the Next.js pages, client workspace shell, viewer
  controls, and static product documentation data.

The Docker development container serves the app on port `3000` internally. The
current local host mapping exposes it on `http://127.0.0.1:4192`.

## Server Responsibilities

### Entry Point

`server/index.mjs` is the authoritative runtime entrypoint. It:

- Boots Next through a custom Express server.
- Adds security headers.
- Rejects unsafe cross-origin mutation requests.
- Applies a small in-memory rate limiter to auth mutation endpoints.
- Reads and writes the `twin_session` cookie.
- Redirects unauthenticated workspace requests to `/auth/login`.
- Returns JSON `401` or `403` responses for protected API calls.
- Gates `/admin` and `/api/admin` behind platform-admin role checks.
- Redirects `/` and `/dashboard` to `/cockpit`.

It no longer owns product routes directly. HTTP middleware lives in
`server/http/*`, while route registration lives in `server/routes/*`. The live
API is split into base, operations, feature delivery, analytics, and BIM route
modules. Admin layer management is split into registry, authority/conflation,
ingestion-job, and direct ingest-adapter modules. The remaining large backend
data-access file is `server/db/productionTwinStore.mjs`; the base-twin service
has been reduced to a small orchestration facade.

PostGIS connection ownership now lives in `server/db/postgisPool.mjs`, which
returns a shared production pool for repository functions. `productionTwinStore`
still owns too many SQL responsibilities, but it no longer creates and closes a
new pool per function call. The first repository cut moved layer-capabilities,
city boundary bbox, bounded viewport GeoJSON, and MVT tile reads into
`server/db/productionTwinStore/viewerRepository.mjs`; `productionTwinStore.mjs`
re-exports those functions as a temporary compatibility facade. Shared
viewer feature-property shaping lives in
`server/db/productionTwinStore/featurePresentation.mjs`.

The base-twin service has also started moving toward smaller modules:
`server/services/baseTwin/cacheStore.mjs` owns live payload cache reads/writes
and cache status reporting, `server/services/baseTwin/geoUtils.mjs` owns pure
geospatial helpers, `server/services/baseTwin/viewerShellRenderer.mjs` owns the
shared server-rendered viewer shell, and
`server/services/baseTwin/payloadConstants.mjs` owns the shared payload schema
and cache-health thresholds. `server/services/baseTwin/payloadHelpers.mjs` owns
pure payload helpers such as height parsing, feature filtering, compact labels,
nearest-feature summaries, and count aggregation.
`server/services/baseTwin/openDataFetchers.mjs` owns Nominatim boundary lookup,
boundary-tiled Overpass fetches, and Wikipedia reference summaries.
`server/services/baseTwin/featureCategories.mjs` owns shared civic, mobility,
and waste category sets. `server/services/baseTwin/featureCollectionBuilder.mjs`
owns base GeoJSON layer assembly and inferred-seed grouping from OSM/open-source
features. `server/services/baseTwin/inventoryBuilder.mjs` owns layer
definitions, inventory totals, and metric cards.
`server/services/baseTwin/productionPayloadBuilder.mjs` owns conversion from a
stored PostGIS base-twin record to the current live viewer payload.
`server/services/baseTwin/scenePayloadBuilder.mjs` owns the derived 3D scene
payload. `server/services/baseTwin/viewerPageRenderers.mjs` is now a small
compatibility aggregator, while `server/services/baseTwin/viewerRenderers/*`
owns the server-rendered map, MapLibre, 3D, and public immersive page
functions. `baseTwinService.mjs` is now a small orchestration facade; the next
service cut is open-data base assembly and the next visual cut is extracting
large embedded browser scripts during the Phase 13 rebuild.

### Public Routes

These paths are intentionally public:

- `/_next/*`
- `/auth/*`
- `/vendor/three/*`
- `/api/health`
- `/api/platform/context`
- `/api/auth/*`

`/api/platform/context` returns branding, city registry context, active city
selection, and the current auth summary when a valid session cookie exists.

### Protected Workspace Routes

These prefixes require authentication:

- `/apps`
- `/cockpit`
- `/municipal`
- `/public`
- `/theory`
- `/docs`
- `/profile`
- `/admin`
- `/live`
- `/api/live`
- `/api/admin`

The `/apps` prefix still exposes inherited Jampack template tools to signed-in
users. They are not the core Twin Base Studio product.

### API Route Map

Core API routes implemented by Express:

- `GET /api/health`: health check.
- `GET /api/platform/context`: platform, city, and auth context.
- `GET /api/auth/session`: current session summary.
- `POST /api/auth/signup-request`: create a pending user and activation token.
- `POST /api/auth/login`: create session and set `twin_session`.
- `POST /api/auth/logout`: destroy session and clear cookie.
- `POST /api/auth/request-reset`: create password reset token.
- `POST /api/auth/reset-password`: set new password by token.
- `GET /auth/activate`: activate a user by token, then redirect to login.
- `GET /api/admin/cities`: list city registry entries.
- `POST /api/admin/cities`: replace city registry.
- `POST /api/admin/cities/upsert`: add or update one city.
- `GET /api/admin/city-caches`: inspect cached city payloads.
- `GET /api/admin/providers`: list registered data providers and connectors.
- `POST /api/admin/providers`: upsert a provider and its connector contracts.
- `GET /api/admin/cities/:cityId/storage`: inspect one city's PostGIS storage.
- `GET /api/admin/cities/:cityId/production-plan`: inspect base-layer
  completeness, provider-extension readiness, storage estimate, and remaining
  production gaps for one city.
- `GET /api/admin/cities/:cityId/layers`: list base and provider layers for one city.
- `POST /api/admin/cities/:cityId/layers`: register or update one city layer.
- `GET /api/admin/cities/:cityId/layer-ingestion-jobs`: list recent layer ingestion jobs.
- `POST /api/admin/cities/:cityId/layers/:layerKey/ingestion-jobs`: register a layer ingestion job.
- `POST /api/admin/cities/:cityId/layers/:layerKey/ingestion-jobs/queue`: queue an async provider ingestion job with idempotency.
- `GET /api/admin/ingestion-jobs/:jobId`: inspect one ingestion job.
- `GET /api/admin/ingestion-jobs/:jobId/report`: inspect validation warnings/errors for one ingestion job.
- `POST /api/admin/ingestion-jobs/:jobId/run`: execute one queued ingestion job.
- `POST /api/admin/ingestion-jobs/:jobId/retry`: move a failed/cancelled job back to queued.
- `POST /api/admin/ingestion-jobs/:jobId/cancel`: cancel a queued ingestion job.
- `POST /api/admin/cities/:cityId/layers/:layerKey/ingest-geojson`: ingest an inline or HTTP(S) GeoJSON FeatureCollection into a registered provider layer.
- `POST /api/admin/cities/:cityId/layers/:layerKey/ingest-csv`: ingest inline or HTTP(S) CSV rows with coordinate fields or a GeoJSON geometry field into a registered provider layer.
- `POST /api/admin/cities/:cityId/layers/:layerKey/ingest-ogc-features`: ingest OGC API Features or WFS GeoJSON FeatureCollections into a registered provider layer.
- `POST /api/admin/cities/:cityId/layers/:layerKey/ingest-stac`: ingest STAC item and collection footprints into a registered provider layer.
- `POST /api/admin/cities/:cityId/layers/:layerKey/ingest-cityjson`: ingest WGS84 CityJSON object centroids into a registered provider layer.
- `POST /api/admin/cities/:cityId/layers/:layerKey/ingest-ifc`: ingest IFC STEP metadata, property sets, model anchors, indexed building/storey/space records, `web-ifc` native-geometry inspection counts, and mesh asset bundles into a registered BIM/provider layer.
- `GET /api/admin/cities/:cityId/layers/:layerKey/bim-payload`: read stored IFC/BIM anchor, hierarchy, property sets, native-geometry inspection counts, mesh asset manifests, and geometry limitations for viewer/operations use.
- `GET /api/admin/cities/:cityId/layers/:layerKey/bim-assets/:bundleId/:assetName`: serve protected BIM mesh manifests and raw vertex/index buffer assets.
- `GET /api/live/:cityId/bim-layers`: return city-scoped BIM layer payloads for the authenticated live viewer.
- `GET /api/live/:cityId/bim-assets/:layerKey/:bundleId/:assetName`: serve city-scoped BIM asset files to the authenticated live viewer.
- `GET /api/live/current/features`: return bounded viewport GeoJSON from
  PostGIS for the authenticated active city using `bbox`, `layers`, and
  `limit` query parameters.
- `GET /api/live/:cityId/features`: return bounded viewport GeoJSON from
  PostGIS for a selected city using `bbox`, `layers`, and `limit` query
  parameters.
- `GET /api/live/:cityId/tiles/:z/:x/:y.mvt`: return a Mapbox Vector Tile from
  PostGIS for a selected city with optional `layers`, `center`, and
  `radiusMeters` filters.
- `GET /api/live/current/layer-capabilities`: return active-city viewer
  delivery metadata for each layer: GeoJSON window, MVT, BIM, raster/catalog,
  and 3D package capabilities.
- `GET /api/live/:cityId/layer-capabilities`: return the same viewer delivery
  metadata for a selected city.
- `POST /api/admin/cities/:cityId/layers/:layerKey/register-package`: register raster, IoT, BIM/3D, Shapefile, and GeoPackage package metadata with catalog/provenance records.
- `GET /api/provider/v1/status`: inspect provider API readiness.
- `POST /api/provider/v1/cities/:cityId/layers/:layerKey/upload-intents`: create a provider upload handoff envelope.
- `POST /api/provider/v1/cities/:cityId/layers/:layerKey/jobs`: let a token-authenticated provider upsert a layer contract and queue an ingestion job.
- `POST /api/admin/cities/:cityId/layers/:layerKey/accept-authority`: mark a
  registered layer as city-authoritative with evidence metadata.
- `npm run worker:provider-ingestion`: continuously drains queued provider ingestion jobs.
- `npm run worker:provider-ingestion:once`: drains one queued-job batch for operations and smoke tests.
- `npm run test:city-smoke`: registers a test provider, creates layers, ingests
  direct GeoJSON, runs a queued CSV job, and verifies the city production plan.
- `npm run test:ifc-smoke`: registers a BIM provider, ingests IFC directly,
  runs a queued IFC package job, and verifies the anchor, native-geometry
  inspection, mesh asset bundle manifest, and BIM payload records.
- `npm run test:ifc-geometry-smoke`: ingests a real provider IFC from
  `--ifc=/path/to/model.ifc` or `TWIN_STUDIO_IFC_GEOMETRY_SAMPLE_PATH`, asserts
  `web-ifc` native mesh extraction, and verifies the generated BIM mesh asset
  manifest plus raw vertex/index buffers.
- `npm run test:viewer-window-smoke`: verifies the Phase 4 viewer read path by
  querying bbox GeoJSON and a non-empty MVT tile for a stored city, and by
  asserting that the generated MapLibre cockpit map and Three.js viewer are
  wired to vector-tile/viewport delivery plus layer-capability metadata.
- `POST /api/admin/cities/:cityId/ingest-base-cache`: load one cached base payload into PostGIS.
- `POST /api/admin/cities/:cityId/preload`: refresh one city's base payload.
- `GET /api/live/current/base`: fetch active session city payload.
- `GET /api/live/:cityId/base`: fetch selected city payload.
- `GET /api/live/adazi/base`: compatibility route for Adazi.
- `GET /live/current/map`: render active city map viewer.
- `GET /live/current/3d`: render active city 3D viewer.
- `GET /live/current/immersive`: render active city immersive viewer.
- `GET /live/:cityId/map`: render selected city map viewer.
- `GET /live/:cityId/3d`: render selected city 3D viewer.
- `GET /live/:cityId/immersive`: render selected city immersive viewer.
- `GET /live/adazi/map`: compatibility route for Adazi map.
- `GET /live/adazi/3d`: compatibility route for Adazi 3D.
- `GET /live/adazi/immersive`: compatibility route for Adazi immersive.

## Runtime State

`server/services/stateStore.mjs` creates and manages application runtime state
in Postgres/PostGIS. The runtime directory is selected from
`TWIN_STUDIO_RUNTIME_DIR` or defaults to `runtime-data`, but it is now used for
email outbox files, provider uploads, live-cache artifacts, BIM assets, and
legacy seed/mirror JSON, not as the primary database.

Runtime Postgres tables currently include:

- `app_meta`
- `app_city_registry`
- `app_city_registry_cities`
- `app_auth_users`
- `app_auth_sessions`
- `app_auth_tokens`
- `app_audit_log`

The service also contains JSON helpers for compatibility with older runtime
files and file-backed artifacts. Legacy JSON is imported as a seed if the
Postgres runtime tables are empty; after that, Postgres is the operational
source of truth.

## Authentication

`server/services/authService.mjs` provides local auth backed by the Postgres
runtime tables.

It supports:

- Signup requests with activation tokens.
- Email activation.
- Login sessions.
- Logout.
- Password reset tokens.
- Platform admin role assignment.
- City access filtering.
- Session-level active city selection.
- Migration from older JSON auth files.

Passwords are hashed with Node crypto `scryptSync`. Session and token values are
stored as hashes. Activation and reset emails are sent through SMTP when
configured; otherwise the messages are written to a local runtime outbox.

Security issues to fix before treating this as production-grade:

- `AUTH_SECRET` has a development fallback.
- Default admin emails are hardcoded.
- There is no documented secret rotation path.
- There is no multi-factor auth.
- Rate limiting is in-memory, so it resets on process restart and does not
  coordinate across replicas.

## City Registry

`server/services/cityRegistry.mjs` owns city registration and active city
selection.

It normalizes each city into fields such as:

- `id`
- `name`
- `country`
- `displayName`
- `adminLevel`
- `center`
- `bbox`
- `boundaryQuery`
- `enabled`
- `isActive`

The default registry contains Adazi, Tallinn, Pilsen, and Gaziantep. The local
runtime registry may contain additional cities added through the admin console.

The registry is now Postgres-backed. JSON files are seed/mirror compatibility
artifacts, not the operational store.

## Production Data Backbone

Phase 1 adds a PostgreSQL/PostGIS service as the production backbone. The
current JSON cache path remains an artifact/seed compatibility path, but
PostGIS now powers city data and application runtime state.

New production scaffolding:

- `compose.yaml`: `twin-base-studio-db` PostGIS service.
- `server/db/migrate.mjs`: migration runner and database health helper.
- `server/db/productionTwinStore.mjs`: PostGIS writer/reader for base-twin
  cities, providers, layer definitions, boundaries, ingestion runs, raw
  features, normalized features, typed feature tables, source artifacts, and
  generated base-payload records.
- `server/db/ingest-base-cache.mjs`: CLI loader for existing
  `runtime-data/live-cache/*-base.json` payloads.
- `server/db/migrations/001_city_twin_backbone.sql`: initial schema for cities,
  boundaries, providers, layers, ingestion runs, raw features, normalized
  features, semantic packs, catalog records, and viewer cache entries.
- `server/db/migrations/002_source_artifacts.sql`: raw source response artifact
  storage for fresh base-twin refreshes.
- `server/db/migrations/003_provider_layer_registry.sql`: provider connector
  contracts and city layer ingestion-job tracking.
- `/api/health`: reports database and migration status.
- `GET /api/admin/cities/:cityId/storage`: reports PostGIS feature counts and
  recent ingestion runs for one city.
- `POST /api/admin/cities/:cityId/ingest-base-cache`: ingests one cached base
  payload into PostGIS.

Phase 2 has now started. Existing cache payloads can be loaded into PostGIS,
fresh successful base-payload refreshes are mirrored into PostGIS, and normal
base-payload reads now prefer PostGIS. Fresh refreshes store full normalized
feature sets; viewer caps are applied when reading from PostGIS for the browser.
The viewer still receives a JSON payload shape, but that payload is generated
from normalized PostGIS records when available.

Phase 3 has started. Providers, provider connectors, city layer definitions,
and layer ingestion jobs are now database-backed and exposed through admin APIs.
This is the extension point for flood, fire, satellite, IoT, BIM, OGC, and
other provider layers. GeoJSON FeatureCollection ingestion is now implemented
for registered provider layers. CSV ingestion is now implemented for point rows
and rows with GeoJSON geometry. OGC API Features/WFS GeoJSON ingestion is now
implemented for direct FeatureCollection URLs. CityJSON object-centroid
extraction is now implemented for WGS84 CityJSON sources. STAC item and
collection footprint extraction is now implemented for satellite/raster
provider catalogs. Queued Shapefile and GeoPackage package jobs use GDAL
`ogr2ogr` to extract native vectors into PostGIS. Raster COG headers, WMS
capabilities, HTTP JSON/sensor-feed summaries, MQTT registrations, and 3D Tiles
tileset metadata can now be inspected by queued package jobs. IFC package jobs
now parse STEP metadata, count core BIM entities, read basic spatial
containment and property sets, and write a georeferenced model anchor plus
indexed building, storey, and space records when `IfcSite` or provider anchor
coordinates are present. They also inspect native geometry with `web-ifc` and
store mesh/geometry-reference counts. When geometry exists they write raw
vertex/index buffers under `runtime-data/bim-assets` and link the bundle from
the BIM payload. The municipal Three.js viewer now loads those live BIM payloads
and renders mesh buffers when available, or BIM anchor markers when the IFC has
no shape geometry. Storey slicing, room polygons, element search, BIM-to-footprint
alignment, and MEP systems still need deeper BIM work.

## Live City Payloads

`server/services/baseTwinService.mjs` is still the compatibility entry point for
the city data pipeline. It handles arbitrary registered cities, with cache,
shared viewer-shell rendering, payload constants, pure geospatial helpers, pure
payload helpers, open-data fetchers, inventory builders, stored-payload
builders, scene assembly, and per-surface viewer renderers delegated to
`server/services/baseTwin/*`.

It fetches and normalizes public data from:

- Nominatim for city lookup, center, and boundary context.
- Overpass for buildings, roads, amenities, places, green areas, blue areas,
  and civic features. Fresh extraction plans tiles from the city boundary bbox
  and filters fetched features back to the boundary instead of using only a
  center-radius sample.
- Wikipedia REST summaries for descriptive context.
- No current access-line or routing layer; route optimization belongs to a future service pack.

It produces a base payload with:

- Boundary and center geometry.
- Roads.
- Buildings.
- Green and blue features.
- Places and facilities.
- Civic, mobility, commerce, and waste semantic seeds.
- Inventory totals.
- Layer definitions.
- Briefing text.
- Viewer metadata.
- Cache metadata.

Building records are enriched with inferred fields such as estimated footprint
area, floors, nearest road, nearest place, planning readiness, and BIM status.
These are useful planning signals, not authoritative municipal records.

The service caches payloads under the runtime directory. It tries to serve fresh
cache first, can serve stale cache when live fetches fail, and throws
`LIVE_PAYLOAD_INCOMPLETE` when it cannot produce a usable payload.

When a normal base payload is requested, the service first asks PostGIS for a
usable stored record and builds the viewer payload from database features. If no
stored record exists, it falls back to JSON cache and then live fetching.

When a new healthy base payload is built, the service writes the JSON cache when
possible and mirrors the payload into PostGIS through `productionTwinStore.mjs`.
Cache-write failures are non-fatal because PostGIS is now the production store.
Fresh live fetches also include raw source artifacts for Nominatim, Overpass,
and Wikipedia; these are stored in `source_artifacts` during ingestion.

The storage path no longer slices roads, buildings, facilities, places, or
green-blue features to viewer limits before writing to PostGIS. The PostGIS read
path applies per-layer limits for the browser payload.

The Overpass tile count defaults to 48 and can be adjusted with
`TWIN_STUDIO_OVERPASS_MAX_TILES`. Public Overpass is still a bootstrap source,
not the final answer for very large or frequently refreshed production cities.
Those deployments need a local OSM extract, replication diffs, or a controlled
Overpass-compatible service.

Main code smell: the service facade still owns open-data orchestration and
cache/fresh-build policy in one compatibility entry point. Fetching, pure
helpers, normalized layer construction, stored-payload conversion, scene
assembly, and viewer renderers are now split, but open-data build orchestration
should become its own use-case module before the product grows further.

## Frontend Route Map

The Next.js app is organized around route groups:

- `src/app/(auth layout)`: login, signup, password reset, and auth shell.
- `src/app/(apps layout)`: authenticated workspace shell and app pages.
- `src/app/layout.js`: root layout and initial platform context.
- `src/app/page.jsx`: redirects to `/cockpit`.

Primary Twin routes:

- `/cockpit`: analysis cockpit using the map viewer.
- `/municipal`: municipal operator page using the 3D viewer.
- `/public`: public viewer page using the immersive viewer.
- `/theory`: explanation of the digital twin model and maturity posture.
- `/docs`: live/static documentation page for source, layer, and semantic
  registers.
- `/admin`: city registry and cache management console.
- `/profile`: account/profile surface.
- `/logout`: logout redirect helper.

Inherited template routes still exist under `/apps/*`, including calendar,
chat, email, file manager, invoices, scrumboard, todo, and related Jampack
examples. They are protected but should be treated as template remnants unless
the product intentionally integrates them.

## Client State And Viewer Messaging

`src/context/PlatformContext.jsx` holds client-side platform context. It:

- Starts from server-provided context.
- Fetches `/api/platform/context`.
- Tracks available cities.
- Tracks selected city in `localStorage` as `twinSelectedCityId`.
- Filters city selection based on auth context and admin role.
- Exposes `refreshPlatformContext` and `setSelectedCityId`.

`src/components/twin-module/TwinViewerPage.jsx` is the primary viewer host. It:

- Fetches `/api/live/${activeCityId}/base`.
- Stores payload, layer definitions, selected feature, viewer state, and
  fidelity level.
- Embeds `/live/${cityId}/${viewerId}` in an iframe.
- Posts viewer commands for visible layers, fidelity, and camera/view actions.
- Receives `twin:ready`, `twin:state`, and `twin:selection` messages from the
  iframe viewer.

The iframe viewers are generated server-side by the base-twin viewer renderer
modules, not by React components. This works today, but it creates a split
rendering model: React owns the shell and controls, while server-generated HTML
owns the actual map, 3D, and immersive canvases.

## Static Product Content

`src/data/digital-twin/cityTwinContent.js` contains the static product model:

- Capability maturity scores.
- Architecture steps.
- Theory lenses.
- Viewer surface register.
- WS2 requirements.
- Twin model register.
- Data lifecycle.
- Public source register.
- Semantic seed register.
- Future semantic packs.
- Interoperability register.
- Documentation pack.

`src/data/digital-twin/moduleConfig.js` defines workspace routes, viewer
bundles, module labels, admin tool links, and page-level copy.

`src/data/digital-twin/workspaceContent.js` contains product narrative and
static dashboard-style metrics. Those metrics are examples, not telemetry.

## Reality Versus Promise

The promise visible in the code is:

Twin Base Studio should become a city operating workspace where a municipality
or operator can select a city, generate a public-source base twin, inspect it
through map/3D/immersive surfaces, understand source confidence, and
progressively attach semantic, municipal, BIM, IoT, and workflow layers.

The current reality is:

- Public-source base twin generation exists.
- Multi-city registry exists.
- Authenticated workspace exists.
- Admin city preload/cache controls exist.
- Map, 3D, and immersive viewers exist.
- Documentation and theory pages exist.
- Semantic layers are mostly inferred seeds.
- Operational integrations are not implemented.
- Template application surfaces still exist beside the core product.

## Productive Solution Gaps

The app is short of a productive municipal solution in these areas:

- Operational data contracts: no clear adapter interface for municipal systems,
  IoT streams, work orders, permits, assets, or document systems.
- Trust model: source confidence exists as UI language, but there is no audit
  trail per feature showing provenance, freshness, conflicts, or validation.
- Editing workflow: users can view and preload city payloads, but cannot curate,
  approve, correct, or publish feature records.
- Collaboration: no assignments, review states, comments, or approval queues.
- Analytics: static dashboard metrics remain from template content; real usage
  and dataset telemetry are not implemented.
- Deployment hardening: auth secrets, admin bootstrap, rate limiting, email
  delivery, backups, and disaster recovery need production documentation.
- Test coverage: no meaningful automated tests were found for the server
  services, route gates, live payload pipeline, or viewer messaging.
- Code boundaries: the live service is too monolithic for safe extension.
- Template cleanup: inherited Jampack apps should be removed, hidden, or turned
  into intentional Twin workflows.

## Recommended Build Plan

1. Stabilize the repo state.
   Track `server/services/stateStore.mjs`, confirm all runtime files that should
   stay out of git are ignored, and add a short production environment
   checklist.

2. Complete Phase 2 PostGIS ingestion.
   Store raw source responses separately, remove storage-side feature caps, and
   generate the viewer payload from PostGIS instead of from JSON cache files.

3. Continue splitting the live data service.
   Fetchers, cache access, pure helpers, semantic layer construction, stored
   payload conversion, scene assembly, and viewer renderers are separated. Move
   open-data build orchestration into its own use-case module with focused
   tests.

4. Define the base twin record contract.
   Create a versioned schema for city payloads, layer definitions, feature
   provenance, source timestamps, confidence, and validation status.

5. Add curation workflows.
   Let authorized users flag, edit, approve, reject, and publish feature records
   without losing raw source provenance.

6. Replace static productivity metrics.
   Add real telemetry for city payload freshness, source coverage, preload
   status, user activity, viewer usage, and registry health.

7. Turn semantic seeds into installable packs.
   Start with waste, energy, mobility, and public facilities. Each pack should
   define data inputs, layer outputs, confidence rules, and required operator
   actions.

7. Harden production operations.
   Remove development secret fallbacks, document admin bootstrap, add backup and
   restore procedures, use durable rate limiting, and define SMTP requirements.

8. Rationalize inherited template apps.
   Remove them from production, or intentionally repurpose them as Twin
   workflows such as tasks, evidence inbox, field calendar, reports, and issue
   boards.

## Files To Read First

For future agents or operators, start with these files:

- `README.md`
- `REALITY_CHECK_2026-05-10.md`
- `DIGITAL_TWIN_MODEL.md`
- `server/index.mjs`
- `server/services/stateStore.mjs`
- `server/services/authService.mjs`
- `server/services/cityRegistry.mjs`
- `server/services/baseTwinService.mjs`
- `src/components/twin-module/TwinViewerPage.jsx`
- `src/components/twin-module/TwinControlSidebar.jsx`
- `src/components/twin-module/AdminRegistryPageClient.jsx`
- `src/context/PlatformContext.jsx`
- `src/data/digital-twin/cityTwinContent.js`
- `src/data/digital-twin/moduleConfig.js`
