# Cesium 3D Migration Decision

Updated: 2026-06-02

## Decision

Municipal 3D moves from the custom Three.js runtime to CesiumJS as the primary
City 3D renderer. The product route is `/city-3d`; the old `/municipal` route
is only a compatibility redirect and must not be treated as the product
contract.

CesiumJS is used as a viewer/runtime dependency only. It is not a new source of
truth, not a replacement for PostGIS, and not a requirement to use Cesium ion.
The installed package reports `Apache-2.0` licensing. The app serves CesiumJS
locally from `node_modules/cesium/Build/Cesium` through `/vendor/cesium`.

Cesium ion is intentionally not part of the default architecture because it
would make an open-source city starter depend on a hosted proprietary account.
Cities should be able to run the baseline with PostGIS, local Cesium assets,
and open-data-derived geometry.

## Why

The previous Three.js runtime was useful for a fast proof, but it put too much
custom camera, feature-rendering, and query-state logic into our code. That made
the 3D surface fragile:

- camera movement could accidentally replace an active TwinQL query,
- large-city visual behavior depended on ad hoc feature windows,
- BIM/provider anchors and future 3D Tiles were not native concepts,
- the UI did not look or behave like a professional geospatial 3D surface.

Cesium is a better municipal 3D base because it already understands globe-scale
camera behavior, terrain, 3D Tiles, imagery layers, entities, GeoJSON-like
geometry, and scene interaction. That gives the open-source project a more
standard geospatial path without forcing cities to buy or upload proprietary
3D assets.

The current terrain correction follows Cesium's native model: terrain should be
installed through a terrain provider, not drawn as a visible triangle mesh. The
runtime now starts flat, waits for an active TwinQL query, reads only
query-scoped DEM cells from PostGIS, and installs a source-backed
`CustomHeightmapTerrainProvider` for that selection. Heat, wind, cooling, sun,
and water layers follow the same rule: they are query-scoped city phenomena,
not full-city browser decorations.

## Open-Source Product Rule

Every city should still be able to start from open data:

- boundary,
- roads,
- consolidated buildings,
- green-blue systems,
- places/facilities,
- inferred seeds,
- semantic-pack outputs.

Those records remain in PostGIS and are queried through TwinQL/CQL2 and viewer
manifests. The first Cesium municipal view can extrude open building footprints
from PostGIS and draw roads, boundaries, and provider/BIM anchors.

Provider assets are optional enrichments:

- IFC/BIM,
- CityJSON,
- 3D Tiles,
- LiDAR/point clouds,
- terrain and imagery,
- simulation outputs.

When provider assets exist, PostGIS stores catalog, provenance, authority,
footprint, attachment, and API metadata. Large binaries belong in object
storage or provider-hosted URLs, not directly in PostGIS.

BIM/IFC is therefore not the primary City 3D visualizer. It is a specialized
asset package attached to one or more city objects. The base viewer must remain
usable even when the city has no BIM coverage.

## Why 3D Tiles Is Deferred

3D Tiles is the right long-term transport for heavy city-scale 3D, but it is
not the first acceptance gate for City 3D. Before promoting it, the platform
needs:

- stable `ldt_core` object IDs that survive ingestion refreshes,
- click/selection identity from rendered 3D features back to city objects,
- query bounds and saved manifests that can open the same selection in map,
  City 3D, and Civic XR,
- an asset pipeline that extrudes, simplifies, tiles, versions, and invalidates
  derived 3D packages,
- object storage or provider-hosted URLs for large tilesets,
- access policy for city-private, provider-private, and public/signed embeds.

Until those pieces are stable, Cesium primitives are the pragmatic bridge:
query-scoped, inspectable, open-source, and cheap enough for a small city server.
This bridge remains the Phase 13 priority. The next engineering work should
finish City 3D quality, query-scoped phenomena, and visual smoke around Cesium
before starting a broad legacy cleanup pass.

This is why the 2D analytical map already uses MVT while City 3D does not yet
use 3D Tiles. MVT is mature in the current stack because PostGIS can generate
predicate-aware vector tiles directly from `ldt_query.city_objects` for
MapLibre. City 3D needs a different derived product: batched/extruded building
geometry, per-feature metadata for picking, styleable phenomenon overlays,
tileset manifests, object-storage publication, and cache invalidation tied to
inventory refreshes. Reusing 2D MVT inside Cesium would still leave us with
flat vector geometry; it would not produce proper City 3D assets.

The professional path is therefore:

1. keep query-scoped Cesium primitives for Phase 13 validation and scientific
   overlays;
2. add a 3D tile-build job that extrudes consolidated buildings and stores
   tileset metadata with provenance and version;
3. keep terrain/temperature/hydrology/runoff as query-scoped science layers
   until those are converted to terrain tiles, raster/imagery overlays, or
   simulation-volume tiles;
4. publish signed/public tilesets only after access policy and embed manifests
   are in place.

The 2026-06-02 cut implements the first version of step 2. It adds a local
3D Tiles builder for consolidated building footprints, a registry table
(`ldt_viewer.city_3d_tilesets`), runtime asset storage under
`runtime-data/3d-tiles`, discovery through `/api/live/:cityId/3d-tilesets`,
and asset serving through `/api/live/:cityId/3d-tiles/...`. This is not yet the
final spatial LOD tree, but it moves City 3D from a pure runtime experiment to
a reproducible generated visual-asset pipeline.

## Current Implementation

Implemented in this cut:

- `/vendor/cesium` static serving from the local package,
- `cityCesiumRuntime.mjs` as the new municipal 3D runtime,
- `/city-3d` shell loads CesiumJS and Cesium widget CSS locally,
- City 3D installs a configurable raster imagery layer under the vector/3D
  city objects so the 3D scene has real map context without using Cesium ion,
- base context renders boundary and BIM/provider anchors,
- query results render only after TwinQL/CQL2 selection messages or saved
  visual-query manifests,
- buildings are extruded from open/consolidated footprint properties when
  height or level data exists, otherwise with a conservative default height,
- camera fitting now uses query/city bounds to set a Cesium `lookAt` camera
  target and range instead of a flat longitude/latitude height heuristic,
- `twin:ready`, `twin:state`, `twin:viewport`, `twin:selection`, and
  `twin:error` messages remain compatible with the shared visual-surface rail,
- no Cesium ion token, hosted terrain, or proprietary asset service is required.
- a first generated 3D Tiles asset pipeline exists for open-data building
  footprints and is documented in
  [CITY_3D_TILES_PIPELINE.md](./CITY_3D_TILES_PIPELINE.md).
- source-backed terrain DEM can be installed after an active TwinQL query
  through Cesium `CustomHeightmapTerrainProvider`,
- the retired triangulated DEM mesh is no longer part of the product path,
- Kharkiv has a high-detail `terrain-dem-100m` open DEM dataset generated from
  Mapzen Terrain Tiles on AWS Open Data at zoom 14.
- City 3D now uses Cesium's standard `ScreenSpaceCameraController` for user
  drag, orbit, tilt, pinch, and wheel behavior. The previous custom gesture
  controller was removed. Query and city bounds are used to place the camera
  when a query loads or when the operator asks to fit the view; they are not
  enforced after every drag because that creates an unwanted snap-back.

The camera decision follows the Cesium-native path documented in the CesiumJS
reference for `ScreenSpaceCameraController`, `CameraEventType`, and
`Camera.constrainedAxis`. Community examples such as `cesiumCameraLimiter`
confirm that camera bounding is normally implemented as a small guard around
Cesium's native camera controller, not by replacing Cesium interaction
entirely. We tested that pattern, but removed the automatic post-move refocus
for Phase 13 because it resets the operator's angle after manual inspection.
The remaining product behavior is explicit: fit on query load or operator
request, then leave native Cesium navigation in control.

Reference links used for this decision:

- https://cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceCameraController.html
- https://cesium.com/learn/cesiumjs/ref-doc/CameraEventType.html
- https://cesium.com/learn/cesiumjs/ref-doc/Camera.html
- https://github.com/romain974/cesiumCameraLimiter

The default development imagery template is OpenStreetMap raster tiles. For
production one-city deployments, this must be made configurable per city and
preferably backed by a city-approved tile service, provider URL, or self-hosted
tile cache. The imagery layer is orientation context only; PostGIS remains the
inventory source of truth.

The old Three.js runtime remains in code during the transition as historical
fallback material, but `/city-3d` should use CesiumJS as the product path.
Leaflet and older viewer-runtime leftovers are treated the same way: transition
residue, not accepted product runtime. They should be removed only after Civic
View is rebuilt and the three current visual surfaces have stable smoke
coverage.

The 2026-06-02 active-runtime cut enforces that distinction in code. City 3D no
longer receives the old Leaflet renderer through the shared base-twin renderer
barrel, and the development server no longer exposes Leaflet or Three.js vendor
paths. The files can still exist as dormant transition material, but they are
not part of the active `/city-3d` import graph or public runtime surface.

## Terrain And Phenomena Policy

City 3D must not paint terrain, heat, wind, cooling, sun, water, or simulation
surfaces over the whole city by default. Those layers are expensive, easy to
misread, and tied to evidence quality. The accepted behavior is:

- boot flat with base imagery and city context,
- run or replay a TwinQL/CQL2 query,
- request phenomenon cells with the active scope (`bbox`, `center` plus
  `radiusMeters`, or a future selection-unit geometry),
- install terrain only for terrain/slope modes and only from the returned DEM
  cells,
- reset terrain back to the ellipsoid when switching to non-terrain phenomenon
  modes,
- keep all phenomenon values queryable through PostGIS object observations.

The 2026-05-30 Kharkiv high-detail DEM run produced:

- `terrain-dem-100m`,
- 85,628 sampled DEM cells,
- 171,256 terrain/slope phenomenon cells,
- 343,552 terrain observations attached to city objects,
- 184 Mapzen/Terrarium tiles sampled,
- zero sampling failures.

This is still a local open-data fallback, not the final production terrain
service. The next professional step is to build terrain tiles or 3D Tiles from
the same DEM/provenance records and stream them from object storage. That path
is needed for very large cities, heavy embeds, and smoother terrain at scale.
The current DEM is visually useful as evidence that terrain is source-backed,
but it is not yet the "cool" final City 3D terrain experience. Downtown Kharkiv
has a shallow local elevation range, so the runtime exaggerates terrain for
legibility. The production visual path still needs smoother terrain transport,
better imagery/material treatment, and query-scoped phenomenon rendering such
as particles, contours, vector fields, and scenario surfaces.

For `surfaceRunoff`, the accepted Phase 13 visual is a sober local-flow
screening layer: a low-height risk surface plus short local direction glyphs
inside the query. Starburst links, hub-and-spoke drainage, full-city particles,
or cinematic water are rejected until a real flow-routing or hydraulic model
writes flow vectors/volumes into the inventory. If the product needs a
"real-looking" water visualization, that belongs in a later simulation/immersive
track backed by provider or model outputs, not in the baseline open-data City
3D screen.

The 2026-05-31 camera correction keeps Cesium's free controller behavior active
while preventing it from escaping the active TwinQL/query terrain frame. The
runtime uses Cesium's standard event model for left-drag rotation, wheel/pinch
zoom, right-drag or Ctrl-drag tilt, native collision handling, zoom distance
limits, and Z-axis constraint. Product code only handles right-click suppression
and post-move focus validation.

## Phase Impact

### Phase 13 - Visual Surfaces Rebuild

This migration belongs to Phase 13. It changes the municipal 3D runtime while
preserving the shared visual contract:

- `/analytical-map` stays MapLibre,
- `/city-3d` becomes CesiumJS,
- `/civic-xr` keeps the lightweight immersive/story surface for now,
- all three surfaces continue to use the same TwinQL/CQL2 query, saved-view,
  manifest, selection, and viewport event contracts.

Phase 13 cannot close until `/analytical-map`, `/city-3d`, and `/civic-xr`
all pass visual smoke after the Cesium cut.

### Phase 14 - Open-Data Workflow Runner

The workflow runner should add a 3D-ready open-data output step:

- derive baseline building heights where available,
- flag missing height/level data,
- attach provider or city BIM/CityJSON/3D Tiles packages when supplied,
- keep open-data generated 3D as derived visualization, not authority BIM.

### Phase 15 - One-City Open-Source Production Package

The one-city package must include:

- local Cesium static assets,
- PostGIS-backed city-object queries,
- optional object storage for large 3D/raster/BIM packages,
- backup/restore guidance for PostGIS plus object assets,
- a clear no-ion default runtime.

### Phase 16 - Sharing, Live Context, And Agentic Operations

Saved and published viewer manifests should continue to boot map, 3D, and
immersive surfaces from the same share key. Public/signed embeds must apply the
same access policy to Cesium 3D as to MapLibre and immersive views.

FIWARE/live-context integration remains a data-contract concern. Cesium should
display live context only after the underlying NGSI-LD/FIWARE sync and authority
state are valid.

### Phase 17+ - Advanced City Intelligence Packs

Advanced packs can attach richer 3D layers:

- flood/fire/reconstruction simulation volumes,
- satellite/raster draped products,
- terrain-derived indicators,
- BIM or infrastructure assets,
- mobility and sensor contexts.

These packs must attach to the same city inventory and provenance model instead
of becoming separate hidden viewer-only datasets.

## Risks And Constraints

- Cesium improves the 3D runtime, but it does not create missing source data.
- Full city 3D is still only as good as the open/provider/city data available.
- Browser performance still requires query-first and tiled/streamed delivery for
  large cities.
- Rich 3D Tiles, terrain, LiDAR, or imagery require object storage or provider
  URLs in production.
- The public immersive surface is not automatically improved by this cut; it
  remains a separate Phase 13 visual-quality task.

## Acceptance Gate

This migration is acceptable only when:

- `/city-3d` loads without client exceptions,
- Cesium boots from local static assets,
- base context renders without a default hidden query,
- TwinQL/CQL2 selections render in 3D,
- camera movement does not reset an active query,
- drag/wheel movement does not lose the active query terrain surface or throw
  the camera into a blank scene,
- browser smoke still passes for `/analytical-map`, `/city-3d`, and
  `/civic-xr`,
- docs and phase trackers describe Cesium as renderer, not source of truth.
