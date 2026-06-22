# Semantic Query UI Contract

Updated: 2026-05-22

The city twin UI must not treat every visual surface as a different product.
The map, municipal 3D, and public immersive viewers should all read from the
same city inventory and the same semantic query contract.

## Meaning

In this platform, a semantic class is a typed city-object meaning:

- buildings
- roads
- green-blue systems
- settlements and places
- access seeds such as civic, mobility, commerce, and waste/public-realm points
- semantic-pack outputs
- provider overlays and evidence, when the user is in an advanced review mode

This is different from a formal semantic pack. A building is already a semantic
class because the inventory knows it is a building and can attach building
attributes. A semantic pack is later domain logic attached to that inventory,
for example reconstruction service readiness or waste/street-cleanliness
workflows.

## Query Shape

Every visualizer should receive the same query object:

```json
{
  "classes": ["buildings"],
  "scope": {
    "key": "radius",
    "center": ["lon", "lat"],
    "radiusMeters": 1000
  },
  "filters": [
    {
      "field": "heightMeters",
      "operator": "gte",
      "value": 10
    }
  ],
  "combine": "and",
  "render": {
    "mode": "isolate",
    "maxFeatures": 5000
  }
}
```

`scope.key` is the canonical persisted form. Viewer payloads may send
`scope.mode` or `scope.type` as aliases; the API normalizes them back to
`scope.key` before executing or logging the query.

The same query should be valid for:

- analytical map rendering,
- municipal 3D filtering,
- public immersive story filtering when the class is public-safe,
- selected-area summaries,
- share/embed manifests.

## API Contract

The simple semantic selector is exposed through:

- `GET /api/live/current/semantic-query-contract?surface=map`
- `GET /api/live/current/semantic-query-contract?surface=municipal3d`
- `GET /api/live/current/semantic-query-contract?surface=immersive`
- city-specific equivalents under `/api/live/:cityId/...`
- `GET|POST /api/live/current/semantic-query`
- `GET|POST /api/live/:cityId/semantic-query`

The SQL-grade structured query engine is exposed through:

- `GET /api/live/current/twin-query-contract`
- `GET /api/live/:cityId/twin-query-contract`
- `GET|POST /api/live/current/twin-query`
- `GET|POST /api/live/:cityId/twin-query`
- `GET /api/live/current/twin-query-events?surface=map&limit=10`
- `GET /api/live/:cityId/twin-query-events?surface=map&limit=10`

The response publishes:

- semantic classes available for the requested surface,
- layer keys that back each class,
- queryable fields,
- supported operators,
- spatial scopes,
- render modes,
- transport endpoints,
- host commands allowed by the viewer manifest.

The executable query endpoints return normalized query metadata, result counts,
counts by semantic class/layer, bounds, and the transport payload requested by
the active viewer. Product visualizers must request a non-GeoJSON transport:

- `/map` requests `render.transport = "mvt"` and receives a query-aware vector
  tile template.
- `/municipal` requests `render.transport = "cesium-primitives"` and receives a
  bounded primitive payload for Cesium.
- `/public` requests `render.transport = "scene-manifest"` and receives compact
  scene/story metadata.
- API/export/debug tools may explicitly request `render.transport = "geojson"`.

The map viewer no longer has the old hidden 12,000-feature client stop. It
does not try to carry large city-wide results as a FeatureCollection. The
backend still has configurable budgets for compatibility and inspection
responses, but large visual results stream through predicate-aware MVT or
viewer-specific payloads. See
[VISUAL_TRANSPORT_POLICY.md](./VISUAL_TRANSPORT_POLICY.md).

City 3D is different from the 2D map: it consumes bounded Cesium primitive
payloads, not vector tiles. Replayed history entries and saved views must be
normalized to the current viewer contract so old query events do not keep stale
prototype limits such as 250 features. The current City 3D budget is 12,000
rendered primitives per query; the UI must still show the full selected count
from PostGIS and mark the result as truncated when selected objects exceed the
render budget.

`semantic-query` is the simple SDTQuery-style helper. `twin-query` is the
powerful path: TwinQL/CQL2 JSON compiled to safe, parameterized PostGIS SQL over
`ldt_query.city_objects`. Raw SQL is intentionally not accepted by the UI/API.
`twin-query` now also accepts `clauses[]` with `operation: "union"` so a single
viewer request can combine different classes, radii, and filters.

## Product UI Rule

The UI should become a semantic selector, not a pile of one-off layer toggles.

Required control model:

1. Class: choose one or more semantic classes, such as buildings or roads.
2. Scope: choose city, viewport, radius, district/neighborhood, block/manzana,
   or custom polygon.
3. Filters: add attributes supported by the class, such as building height,
   road class, category, confidence, authority status, or source coverage.
4. Render: show, isolate, count, inspect, export, or publish/embed.

Radius is not a separate city-coverage widget. It is a scope inside the query:
the UI may present a percent-of-city helper or an exact meter input, but the
viewer and API must treat the normalized `scope.radiusMeters` as part of the
query that produced the result.

The secondary rail is for explicit controls of the active visualizer. The
semantic/TwinQL selector belongs there for all three visual surfaces:
analytical map, municipal 3D, and public immersive. Legacy layer-bundle,
city-radius, per-layer visibility, command, and fidelity controls should not be
visible by default; they can exist only behind an explicit advanced/manual mode
until a cleaner product interaction is designed. Source/provider duplication
belongs in reports and inspection, not as the main building-layer UI.

## Current Status

Available now:

- semantic class to layer-family mapping,
- executable attribute predicates for the first shared semantic-query API,
- SQL-grade TwinQL/CQL2 JSON query API over `ldt_query.city_objects`,
- city, viewport, and radius scopes,
- explicit query-radius controls in the visual rail,
- structured `and/or` predicate composition in the visual rail,
- executable multi-clause union manifests in the TwinQL visual rail,
- semantic-query event logging in `ldt_viewer.semantic_query_events`,
- recent query run history and replay in the visual rail, backed by
  `ldt_viewer.semantic_query_events`,
- selected-feature inspection,
- selected-area summaries,
- manifest commands for map, 3D, and immersive semantic queries,
- first structured TwinQL selector in the visual secondary rail,
- saved TwinQL manifests can now be promoted to published share/embed
  contracts through `viewer-share-manifests/:shareKey/publish`,
- viewer windows consume `?shareKey=...` directly for map, 3D, and immersive
  surfaces, so a published saved query can open as the initial visual state,
- analytical map isolate mode: query results hide normal inventory tiles and
  render through query-aware MVT over base-map/boundary context,
- manual layer-bundle/focus controls retained only as hidden advanced runtime
  capability, not as default product UI,
- MapLibre semantic-query result rendering through predicate-aware MVT,
- MapLibre query-radius overlay rendering from single-scope and multi-clause
  radius scopes,
- municipal 3D semantic-query result rendering from Cesium primitive payloads,
- public immersive semantic-query result status from scene manifests through
  the same host command.

Latest Kharkiv smoke:

- authenticated visual-route smoke passes for cockpit, map, 3D, immersive, and
  their live viewer windows,
- viewer-window smoke confirms live viewport features, MVT delivery, layer
  capabilities, and selected-area summaries,
- a central Kharkiv radius semantic query over buildings and roads returned
  matching entities plus viewer-specific visual transport payloads,
- `npm run test:semantic-query-smoke` verifies the semantic-query contract,
  city-scope query, radius-scope query, and a road-class attribute predicate.
- `npm run test:twin-query-smoke` verifies the TwinQL/CQL2 contract, city
  building query, radius road query, count-only query, compound predicate query,
  and a multi-clause union query over Kharkiv.

Current UI rule:

- the structured selector belongs in the visual secondary rail because it
  directly controls the active map/3D/immersive surface;
- visual surfaces must not auto-run a default city-object query on load. The
  analytical map starts with boundary/base context only and renders query
  results only after an explicit user query;
- the stage header should keep focus/context only, not another query or
  layer-bundle surface;
- legacy manual controls should remain hidden by default behind
  `showManualControls`;
- cockpit remains the product workspace and should not own viewer-specific
  selection controls.

Implemented in the current cut:

- saved/shared multi-clause query manifests are persisted through
  `viewer-share-manifests` with `mode = twin-query-manifest`. The secondary
  rail can save the current TwinQL builder, list saved manifests, and replay
  them against the active visual surface.
- recent run history is still read from `semantic_query_events`, but the rail
  groups visually similar runs by normalized TwinQL/CQL2 signature. The
  database keeps every run; the selector shows grouped recent queries so the
  operator can replay the latest equivalent run without scrolling through
  repeated executions.
- a saved TwinQL manifest can be published from the rail. The backend records
  `publication_status`, `access_policy`, publication metadata, viewer URL,
  manifest URL, and iframe markup. The live viewer runtimes also fetch the
  `shareKey`, execute the saved query, and apply it to the surface. Recent run
  history remains the audit trail, not the curated share/embed artifact.
- TwinQL/CQL2 predicates now have a vector-tile transport:
  `/api/live/:cityId/twin-query-tiles/{z}/{x}/{y}.mvt?query=...`. The route
  uses the same safe query compiler over `ldt_query.city_objects`, keeps
  multi-clause provenance in tile properties, and is used by the map overlay
  when a GeoJSON response is truncated.

Still required:

- harden the first rail selector into a polished class, scope, filters, and
  render-mode query builder backed by `twin-query`,
- add the explicit no-session signed/public embed access policy before treating
  published manifests as external public links,
- add official district/block source ingestion and review before those scopes
  are shown as authority-grade units.

The detailed data-model interpretation is documented in
[SEMANTIC_MODEL_AND_POSTGIS_QUERY_PLAN.md](./SEMANTIC_MODEL_AND_POSTGIS_QUERY_PLAN.md).
The SQL-grade query engine is documented in
[TWIN_QUERY_ENGINE.md](./TWIN_QUERY_ENGINE.md).
