# Visual Transport Policy

Updated: 2026-06-02

This policy keeps Twin Base Studio professional as city inventories grow.
PostGIS is the runtime source of truth. TwinQL/CQL2 is the query contract.
GeoJSON is not the main visual transport for full or partial city inventory.

## Runtime Rule

Visual surfaces must consume the city inventory through transport formats that
match the viewer:

| Surface | Runtime transport | Purpose |
| --- | --- | --- |
| Analytical map | Predicate-aware MVT from PostGIS | Large 2D city-object rendering, filtering, and embed maps. |
| City 3D | Cesium primitives for active queries, registered 3D Tiles packages for generated assets | Query-scoped 3D inspection now, streamable city-scale 3D packages next. |
| Civic XR | Babylon/WebXR scene manifest now, richer scene graph later | Browser XR views derived from the same query contract. |
| API/export/debug | GeoJSON by explicit request only | Interoperability, inspection, tests, and small bounded downloads. |

Small generated UI geometries, such as the municipal boundary, radius guide, or
selection outline, may remain lightweight JSON geometries while they are control
context. City-object inventory and query results must not depend on a GeoJSON
FeatureCollection as their primary visual payload.

## API Contract

`/api/live/:cityId/twin-query` accepts `render.transport`:

- `mvt`: returns metadata, result counts, bounds, and a query-aware vector-tile
  template. The map renders from `/twin-query-tiles/{z}/{x}/{y}.mvt`.
- `cesium-primitives`: returns query-scoped primitives for the municipal 3D
  viewer. This is the bridge until the 3D Tiles package is promoted.
- `3d-tiles`: returns or references registered 3D Tiles packages. This is the
  target transport for generated city-scale 3D geometry.
- `scene-manifest`: returns a compact scene/story manifest for the immersive
  surface.
- `metadata`: returns counts and bounds only.
- `geojson`: explicit export/inspection compatibility mode.

If no transport is requested, the API can still return GeoJSON for legacy
tests, diagnostics, or external clients. Product visualizers must request their
transport explicitly.

## Civic XR Scene Manifest

Civic XR product queries must request `render.transport = "scene-manifest"`.
The response is a renderable manifest, not a hidden GeoJSON dataset: it carries
query metadata, bounds, sampling state, layer/material definitions, and a
bounded `objects` array with identity, semantic class, authority/source status,
clause provenance, lightweight geometry, and render hints. The Babylon/WebXR
runtime renders those `sceneManifest.objects` directly. GeoJSON remains only a
debug/export path or a compatibility input for older host messages.

## Why This Matters

Large city queries can return hundreds of thousands of objects. A single
GeoJSON response makes loading slow, increases browser memory pressure, and
creates inconsistent behavior between map, 3D, and immersive surfaces. The
transport split keeps the open-source runtime installable on modest city
servers while preserving standards-friendly export paths.

## City 3D Tiles Path

MapLibre MVT and Cesium 3D Tiles solve different problems. The analytical map
can stream MVT directly from PostGIS because it draws 2D vector features. City
3D needs batched 3D geometry, feature metadata for picking, materials, height
semantics, terrain alignment, generated-asset versioning, and cache invalidation
after inventory refreshes. That derived product should become 3D Tiles, not
larger GeoJSON payloads and not direct reuse of 2D MVT.

Current Phase 13 rule:

- use MVT for `/map`;
- use query-scoped Cesium primitives for `/city-3d` base inspection and small
  scientific overlays;
- generate and register first 3D Tiles packages through
  `npm run db:ldt:build-city-3d-tiles`;
- keep bounded FeatureCollection environmental-cell responses as transitional
  API transport only;
- move heavy buildings, terrain, BIM/CityJSON, simulation volumes, and public
  embeds to versioned/spatially tiled 3D Tiles once LOD, picking metadata,
  object storage, and access policy are ready.

Legacy cleanup rule: do not remove historical Leaflet/older runtime files,
fallback GeoJSON export paths, or compatibility route aliases in the middle of
the City 3D and Civic XR rebuild. They are not accepted product transports,
but the broad deletion pass is scheduled after Civic XR is stable so Phase 13
stays focused on Cesium bridge quality and the last visual surface. The active
City 3D runtime is stricter: it must not import Leaflet/Three viewer modules or
serve `/vendor/leaflet` or `/vendor/three` from the product server.

The first implemented package is documented in
[CITY_3D_TILES_PIPELINE.md](./CITY_3D_TILES_PIPELINE.md). It is a generated
building-extrusion package from `ldt_query.city_objects`, registered in
`ldt_viewer.city_3d_tilesets`, and served through `/api/live/:cityId/3d-tiles`.
It is deliberately a first data-engineering foundation, not the final
large-city LOD tree.
