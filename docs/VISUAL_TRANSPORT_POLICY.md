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
| City 3D | `selection-reference` over registered 3D Tiles packages | City-scale 3D queries without sending geometry payloads to the browser. |
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
- `selection-reference`: returns counts, bounds, query hash, materialization
  links, and references to registered 3D Tiles packages without returning render
  geometry. This is the City 3D default.
- `cesium-primitives`: returns query-scoped primitives for explicit small 3D
  previews and compatibility tests only.
- `scene-manifest`: returns a compact scene/story manifest for the immersive
  surface.
- `metadata`: returns counts and bounds only.
- `geojson`: explicit export/inspection compatibility mode.

If no transport is requested, the API can still return GeoJSON for legacy
tests, diagnostics, or external clients. Product visualizers must request their
transport explicitly.

## GeoJSON Limit-And-Inform Pattern

GeoJSON remains useful for inspection, export, interoperability, tests, and
small external clients. It is not allowed to pretend to be a full-city viewer
transport.

Any GeoJSON response is treated as a preview/export compatibility payload:

- default preview cap: `TWIN_STUDIO_TWIN_QUERY_GEOJSON_DEFAULT_LIMIT` (5,000
  features by default);
- hard preview cap: `TWIN_STUDIO_TWIN_QUERY_GEOJSON_MAX_LIMIT` (20,000
  features by default);
- every capped response includes `summary.transportPolicy` with requested
  limit, effective limit, returned count, total count, warning text, and
  recommended native transports;
- UI controls that expose a GeoJSON response must show a visible warning instead
  of letting the user assume the full dataset rendered.

This follows the platform rule for slow compatibility formats: limit and inform.
Full city visual surfaces must use MVT/PMTiles, registered 3D Tiles through
selection references, or scene manifests, depending on the viewer.

## Enforcement Pattern

This is a product boundary, not a style preference. Product viewers must pass
through a transport adapter before any payload reaches the iframe runtime:

- map viewers request and receive `mvt` plus a vector-tile template;
- City 3D viewers request and receive `selection-reference` plus registered
  3D Tiles artifact links;
- Civic XR viewers request and receive `scene-manifest`;
- shared/saved view replay must preserve the viewer-native transport and drop
  accidental GeoJSON payloads unless the query explicitly requested
  `render.transport = "geojson"`.

The browser smoke and visual-contract smoke are expected to fail if map, City
3D, or Civic XR query replay starts depending on a GeoJSON FeatureCollection
again.

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

- use MVT for `/analytical-map`;
- use `selection-reference` over registered 3D Tiles for `/city-3d` query
  responses;
- keep query-scoped Cesium primitives only for explicit small previews and
  scientific overlays;
- generate and register first 3D Tiles packages through
  `npm run db:ldt:build-city-3d-tiles`;
- load registered 3D Tiles in `/city-3d` as the main city-scale building
  package when a ready viewer artifact exists;
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
