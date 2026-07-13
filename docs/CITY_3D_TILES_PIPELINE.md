# City 3D Tiles Pipeline

Status: professional Cesium artifact route, registry-backed first
implementation.

## Purpose

City 3D must not depend on browser-side GeoJSON or ad hoc Cesium primitives for
large city payloads. Those transports are useful for query previews and
scientific overlays, but they are not the production route for city-scale 3D
geometry.

The professional path is:

1. Keep the city inventory in PostGIS as the source of truth.
2. Generate versioned 3D Tiles packages from inventory scopes.
3. Register the packages in PostGIS with provenance, source query, semantic
   class, feature counts, and asset paths.
4. Serve `tileset.json`, glTF/GLB payloads, and sidecar manifests through the
   live city API.
5. Later move the same runtime asset tree to object storage such as MinIO/S3
   without changing the city API contract.

## Implemented Now

The initial builder creates a single 3D Tiles package for consolidated building
footprints:

- Source view: `ldt_query.city_objects`.
- Semantic class: `buildings`.
- Output root: `runtime-data/3d-tiles/<city>/<tileset-key>/<version>/`.
- Files:
  - `tileset.json`: 3D Tiles package descriptor.
  - `buildings.glb`: glTF 2.0 binary with simple extruded building footprints.
  - `features.json`: sidecar index from rendered geometry to `object_id`.
  - `manifest.json`: provenance, counts, limits, and next-step notes.
- 3D-specific registry table: `ldt_viewer.city_3d_tilesets`.
- Common viewer artifact lifecycle table: `ldt_viewer.viewer_artifacts`.
- Registry-first delivery service:
  `server/services/viewerArtifacts/viewerArtifactDelivery.mjs`.
- Registry paths are resolved against the current `runtime-data` root when a
  record was generated in another runtime, such as `/app/runtime-data` inside a
  Docker container and the WSL repo `runtime-data` on the host.
- Discovery route: `GET /api/live/:cityId/3d-tilesets`.
- Common artifact route: `GET /api/live/:cityId/viewer-artifacts`.
- Asset route:
  `GET /api/live/:cityId/3d-tiles/:tilesetKey/:version/:assetName`.
- City 3D viewer consumption: `/city-3d` requests the registered tileset
  catalog, loads the active `tileset.json` through Cesium
  `Cesium3DTileset.fromUrl`, and displays the loaded 3D Tiles package status
  before falling back to query-scoped primitives for analyst selections.

Command:

```bash
npm run db:ldt:build-city-3d-tiles -- --city=guanajuato --tileset-key=base-buildings --limit=1000
```

Smoke:

```bash
npm run test:city-3d-tiles-smoke -- --city=guanajuato
npm run test:city-3d-tiles-viewer-consumption-smoke -- --city=guanajuato
npm run test:viewer-artifact-registry-smoke -- --city=guanajuato
```

## Why 3D Tiles

3D Tiles is the natural Cesium transport for large 3D city assets because it is
spatially streamable, cacheable, LOD-ready, and compatible with metadata-driven
object picking. It lets the browser request only the visible subset instead of
loading a full city payload.

This is different from the current query preview path:

- Map 2D: MVT from PostGIS is the right route for flat map layers.
- City 3D quick query: Cesium primitives are acceptable for small selected
  scopes and scientific overlays.
- City 3D production geometry: 3D Tiles is the target.
- BIM/IFC: provider-specific or asset-specific, not the default city viewer.

## Current Limitations

The first builder and current generated packages are intentionally conservative:

- It generates a single tile, not a full spatial LOD tree.
- It extrudes buildings from footprints and available height/levels.
- If height is missing, it uses a default extrusion.
- It stores picking identity in `features.json`; batch metadata is planned.
- It does not yet provide native per-object styling/filtering from embedded tile
  metadata. Query-scoped primitives remain useful only for explicit small
  previews and overlays.

## Prepared Selection Reference Transport

TwinQuery uses a 3D reference transport for City 3D query work:

```json
{
  "render": {
    "mode": "highlight",
    "transport": "selection-reference"
  }
}
```

This is the City 3D default path. TwinQuery returns counts, bounds, query hash,
materialization links, and active 3D artifact references without returning
render geometry to the browser.

The intended use is:

1. City 3D loads the base city from registered 3D Tiles.
2. TwinQuery returns a `selectionReference` for the query result.
3. A later materialization step persists the reference as an analysis selection
   or query-scoped viewer artifact.
4. The viewer highlights or filters against the active 3D artifact instead of
   receiving a direct feature payload.

This is deliberately separate from `cesium-primitives`. Primitives remain a
bounded preview path for small selections; `selection-reference` is the
no-geometry control-plane path for larger 3D selections.

Product rule: do not expose `selection-reference` as a user-facing button or
mode label. It is an internal transport decision behind normal query actions.
If the UI needs a visible distinction later, it should be framed in product
terms such as city-scale filtering, saved analysis, or tile-backed highlight,
not as the transport name.

## Next Professional Steps

1. Add stronger LOD rules for large-city package generation.
2. Add feature metadata so Cesium picking can return stable inventory IDs
   directly from the tileset.
3. Generate query-scoped tilesets for saved views, not only full city packages.
4. Add object storage mode for production deployments.
5. Add terrain/raster/phenomena tiles where the source data requires streaming.

## Operating Principle

3D Tiles are a derived visual artifact. The city inventory remains in PostGIS.
The tileset registry and common viewer artifact registry must always preserve
the query, source view, version, semantic class, byte size, checksum, status, and
active version that generated or promoted the package.

Live routes must resolve registered artifacts before serving runtime files. This
keeps PMTiles, MVT, and 3D Tiles under the same publication rule and makes
future object-storage delivery a transport swap instead of a product-contract
change.
