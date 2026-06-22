# City 3D Tiles Pipeline

Status: Phase 13 professional Cesium route, first implementation.

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
- Registry table: `ldt_viewer.city_3d_tilesets`.
- Discovery route: `GET /api/live/:cityId/3d-tilesets`.
- Asset route:
  `GET /api/live/:cityId/3d-tiles/:tilesetKey/:version/:assetName`.

Command:

```bash
npm run db:ldt:build-city-3d-tiles -- --city=kharkiv --tileset-key=base-buildings --limit=1000
```

Smoke:

```bash
npm run test:city-3d-tiles-smoke
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

The first builder is intentionally conservative:

- It generates a single tile, not a full spatial LOD tree.
- It extrudes buildings from footprints and available height/levels.
- If height is missing, it uses a default extrusion.
- It stores picking identity in `features.json`; batch metadata is planned.
- It does not yet replace the live City 3D runtime. The runtime still consumes
  query-scoped primitives for Phase 13 while this data engineering route is
  hardened.

## Next Professional Steps

1. Split buildings into spatial tiles with geometric error and LOD rules.
2. Add feature metadata so Cesium picking can return stable inventory IDs
   directly from the tileset.
3. Generate query-scoped tilesets for saved views, not only full city packages.
4. Add object storage mode for production deployments.
5. Add City 3D runtime toggle/load path for registered tilesets.
6. Add terrain/raster/phenomena tiles where the source data requires streaming.

## Operating Principle

3D Tiles are a derived visual artifact. The city inventory remains in PostGIS.
The tileset registry must always preserve the query, source view, version, and
semantic class that generated the package.

