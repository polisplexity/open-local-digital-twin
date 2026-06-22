# Twin Query Engine

Updated: 2026-05-24

The platform now has two query paths:

- `semantic-query`: simple SDTQuery-style semantic selector for easy UI prompts.
- `twin-query`: SQL-grade, read-only query contract that compiles safe JSON
  predicates and multi-clause unions to parameterized PostGIS SQL.

The platform also has a persisted analysis-selection path. It executes the same
TwinQL/CQL2 contract, stores the selected object IDs in `ldt_analysis`, and lets
map, City 3D, Civic XR, embeds, APIs, and future simulations reuse the same
working set.

The product rule is simple: city users should be able to ask for any meaningful
city object, but the UI and public API must not execute raw SQL directly.

## Canonical Query Surface

The SQL-grade query engine reads from:

```sql
ldt_query.city_objects
```

This view normalizes the current city inventory into one read-only object
surface:

- `city_id`
- `object_id`
- `stable_id`
- `entity_type`
- `semantic_class`
- `layer_key`
- `display_layer_key`
- `label`
- `authority_status`
- `confidence`
- `source_coverage_status`
- `provider`
- `source_format`
- `source_family`
- `road_class`
- `building_type`
- `height_m`
- `floors`
- `land_use_class`
- `category`
- `place_type`
- `footprint_area_m2`
- `geom`
- `geometry_type`
- `properties`
- `updated_at`

The current implementation still bridges from the legacy runtime tables
(`city_features`, typed layer tables, and `layer_definitions`), but consumers
now target the stable `ldt_query.city_objects` contract instead of those source
tables.

## Semantics

A semantic class is the city-object meaning already present in the inventory:

- buildings
- roads
- green-blue systems
- places
- access seeds
- semantic-pack outputs
- provider overlays

A semantic pack is different. A pack is domain logic attached to the base
inventory later, such as reconstruction service readiness or waste/street
cleanliness. Buildings and roads are not semantic packs; they are base semantic
classes.

## API

Contract:

- `GET /api/live/current/twin-query-contract`
- `GET /api/live/:cityId/twin-query-contract`

Execution:

- `GET|POST /api/live/current/twin-query`
- `GET|POST /api/live/:cityId/twin-query`

Predicate-aware vector tiles:

- `GET /api/live/current/twin-query-tiles/:z/:x/:y.mvt?query={encodedTwinQuery}`
- `GET /api/live/:cityId/twin-query-tiles/:z/:x/:y.mvt?query={encodedTwinQuery}`

Recorded runs:

- `GET /api/live/current/twin-query-events?surface=map&limit=10`
- `GET /api/live/:cityId/twin-query-events?surface=map&limit=10`

Persisted analysis selections:

- `POST /api/live/current/analysis-sessions`
- `POST /api/live/:cityId/analysis-sessions`
- `POST /api/live/current/analysis-selections/query`
- `POST /api/live/:cityId/analysis-selections/query`
- `GET /api/live/current/analysis-selections`
- `GET /api/live/:cityId/analysis-selections`
- `GET /api/live/current/analysis-selections/:selectionId`
- `GET /api/live/:cityId/analysis-selections/:selectionId`
- `GET /api/live/current/analysis-selections/:selectionId/members`
- `GET /api/live/:cityId/analysis-selections/:selectionId/members`
- `POST /api/live/current/analysis-selections/compare`
- `POST /api/live/:cityId/analysis-selections/compare`

Saved and published query manifests:

- `GET /api/live/current/viewer-share-manifests?mode=twin-query-manifest`
- `GET /api/live/:cityId/viewer-share-manifests?mode=twin-query-manifest`
- `POST /api/live/current/viewer-share-manifests`
- `POST /api/live/:cityId/viewer-share-manifests`
- `POST /api/live/current/viewer-share-manifests/:shareKey/publish`
- `POST /api/live/:cityId/viewer-share-manifests/:shareKey/publish`

The endpoint returns:

- normalized query metadata,
- counts by semantic class and layer,
- truncation state,
- `summary.bounds` for the complete displayable result, even when only a sample
  or vector tiles are returned,
- GeoJSON features when render mode is not `count`,
- the query contract so clients can build forms without hard-coding fields.

For `render.transport = "scene-manifest"`, the HTTP response does not expose
the GeoJSON working payload. It returns `sceneManifest`, a renderable Civic XR
contract with:

- `kind = "twin-query-scene-manifest"`, `version`, and `schemaVersion`,
- `cityId`, `query`, `summary`, `bounds`, and transport links,
- `sampling` with requested feature budget, returned object count, total
  result count, and truncation state,
- `materials` keyed by visual layer,
- `layers` with object counts and rendered counts,
- `objects` with object identity, semantic class, layer key, authority/source
  status, clause provenance, lightweight geometry, and render hints.

Civic XR may keep GeoJSON and Cesium primitive message compatibility for older
host messages, but its product query path must request `scene-manifest` and
render from `sceneManifest.objects`.

Returned feature geometry is display geometry, not always the raw stored
geometry. When a query has a spatial scope such as radius, viewport, or custom
polygon, the backend selects objects by intersection and then clips line and
polygon geometry to the query scope before returning GeoJSON or MVT. This is
important for roads: a long road that intersects a radius should not draw far
outside that radius in the viewer. Source geometry remains unchanged in
PostGIS; only the query output is clipped.

The query engine normalizes invalid open-data geometries with `ST_MakeValid`
before clipping so public-source defects do not crash a city query. The count
still represents city objects that matched the query after a non-empty display
geometry exists.

Each execution is logged in `ldt_viewer.semantic_query_events` with
`query_kind = twinql-json` or `cql2-json`. The events endpoint reads the same
table back for the visual rail so analysts can see and replay recent runs
without confusing runtime query history with source data or curated embeds.
The table is append-only product telemetry: repeated executions are preserved
for audit, usage analysis, and future API/product analytics. The UI rail groups
similar recent runs by a normalized query signature so repeated executions of
the same class/scope/predicate contract do not overload the selector. That
grouping ignores volatile execution metadata such as request ids, timestamps,
actor metadata, result counts, and render feature budgets; replay uses the
latest event in the group.

Persisted analysis selections are different from recorded runs. A selection
stores the object membership produced by a query, plus metrics, style, compact
attributes, and comparison readiness. The source geometry remains in
`ldt_core`/`ldt_query`; the selection keeps IDs and sample points so large
results can be reused without copying full geometry payloads. Use selections
when the analyst has a working set to compare, save, replay, embed, or pass to
a model. Use query events when the product only needs audit and demand
telemetry. The shared viewer rail now lists those persisted selections next to,
but not mixed with, recorded runs. Replaying a selection reloads its stored
TwinQL source query and asks the active viewer for its native visual transport.
The same `selectionId` can therefore be opened from `/analytical-map`,
`/city-3d`, or `/civic-xr` without duplicating map, Cesium, or immersive
filtering logic.

Saved query manifests are different from run history. A saved manifest stores a
curated TwinQL builder/query under `ldt_viewer.visual_share_manifests` with
`mode = twin-query-manifest`. Publishing changes the row from draft/session
posture to a share contract such as `publication_status = published` and
`access_policy = signed-token`, attaches viewer and manifest URLs, and returns
an iframe snippet for map, 3D, or immersive embeds. The map, 3D, and immersive
runtimes now read `?shareKey=...`, fetch the saved TwinQL manifest, execute the
query, and apply that result as the initial visual state. The current runtime
still uses authenticated live routes; opening signed/public embeds without a
session must remain an explicit route-policy hardening step, not an accidental
side effect of saving a query.

## Query Languages

### TwinQL JSON

TwinQL JSON is the product-native, structured form:

```json
{
  "language": "twinql-json",
  "classes": ["buildings"],
  "scope": { "key": "city" },
  "where": {
    "field": "building_type",
    "operator": "exists",
    "value": true
  },
  "render": {
    "mode": "isolate",
    "maxFeatures": 100
  }
}
```

### CQL2 JSON

CQL2 JSON is the standards-aligned expression form used by OGC API Features
filtering patterns:

```json
{
  "language": "cql2-json",
  "classes": ["roads"],
  "scope": {
    "key": "radius",
    "center": [36.2304, 49.9935],
    "radiusMeters": 2500
  },
  "where": {
    "op": "isNotNull",
    "args": [{ "property": "road_class" }]
  },
  "render": {
    "mode": "isolate",
    "maxFeatures": 100
  }
}
```

## Supported Scopes

- `city`: everything inside the latest city boundary.
- `radius`: objects intersecting a radius around `[lon, lat]`.
- `viewport`: objects intersecting a bounding box.
- `customPolygon`: objects intersecting a GeoJSON polygon.

The radius is part of the query, not an external viewer filter. The UI may help
the analyst express it as a percentage of the city extent, but the API receives
the normalized `scope.radiusMeters` value and logs it with the query event.

Future scopes such as district, neighborhood, and block/manzana should compile
to one of these geometry scopes after the relevant authority or inferred
selection unit has been chosen.

## Predicate Composition

The current engine supports nested predicates through the CQL2-style expression
shape:

```json
{
  "op": "and",
  "args": [
    { "field": "height_m", "operator": "gte", "value": 10 },
    {
      "op": "or",
      "args": [
        { "field": "source_coverage_status", "operator": "contains", "value": "provider" },
        { "field": "authority_status", "operator": "contains", "value": "open" }
      ]
    }
  ]
}
```

The visual rail now exposes a product-safe version of this model: class, scope,
explicit radius, and up to four attribute predicates combined as `and` or `or`.

## Multi-Clause Queries

Multi-clause query manifests are now executable. They let one viewer request
combine different semantic classes, scopes, and filters without falling back to
global layer toggles:

```json
{
  "language": "twinql-json",
  "operation": "union",
  "clauses": [
    {
      "id": "core-buildings",
      "label": "Core buildings",
      "classes": ["buildings"],
      "scope": { "key": "radius", "center": [36.23, 49.99], "radiusMeters": 2500 }
    },
    {
      "id": "access-roads",
      "label": "Access roads",
      "classes": ["roads"],
      "scope": { "key": "radius", "center": [36.23, 49.99], "radiusMeters": 5000 },
      "where": {
        "field": "road_class",
        "operator": "in",
        "value": ["primary", "secondary", "tertiary"]
      }
    }
  ]
}
```

Current operation support is `union`. The backend executes each clause against
`ldt_query.city_objects`, merges the results, deduplicates by `object_id`, and
adds `clauseId` / `clauseLabel` to every returned feature. The response summary
also includes `countsByClause`, so a saved or embedded view can explain what
part of the query produced each object family.

## Query-Aware Tiles And Fit

Large result sets must not be rendered as one GeoJSON payload. Product viewers
request a transport that matches the surface:

- `/map`: `render.transport = "mvt"` returns a predicate-aware vector-tile
  template for the same TwinQL/CQL2 query.
- `/municipal`: `render.transport = "cesium-primitives"` returns bounded
  query primitives for Cesium. This is the current bridge until 3D Tiles is
  promoted.
- `/public`: `render.transport = "scene-manifest"` returns compact immersive
  scene/story metadata.
- API/export/debug: `render.transport = "geojson"` remains available by
  explicit request and as legacy default compatibility.

Viewers should center or fit from `summary.bounds` first, then fall back to the
query scope geometry, then to transport-specific bounds. This prevents a
truncated or sampled visual payload from controlling the camera when the true
query has thousands of matching city objects. It also keeps `/map`,
`/municipal`, and `/public` aligned because all surfaces consume the same
normalized query, counts, and bounds.

## Supported Render Modes

- `isolate`: return matching features.
- `highlight`: same query semantics, intended for visual emphasis.
- `table`: same query semantics, intended for tabular UI.
- `count`: return counts only and no geometry payload.

## Supported Render Transports

- `metadata`: counts, bounds, and query metadata only.
- `mvt`: query-aware vector tile template for MapLibre.
- `cesium-primitives`: Cesium primitive payload for the municipal 3D surface.
- `scene-manifest`: compact immersive scene/story manifest.
- `geojson`: explicit export, interoperability, inspection, and legacy
  compatibility mode.

## Safety Model

The UI can be powerful without accepting raw SQL:

- fields are allowlisted,
- operators are allowlisted by field type,
- all values are bound as SQL parameters,
- geometry scopes are normalized before execution,
- the query surface is read-only,
- the route records demand telemetry without exposing database internals.

This gives analysts a SQL-grade query model while keeping the open-source city
runtime installable and safer by default.

## Verified Kharkiv Smoke

Command:

```bash
TWIN_STUDIO_DATABASE_URL='postgresql://twin_base_studio:twin_base_studio_dev@127.0.0.1:45432/twin_base_studio' npm run test:twin-query-smoke -- --city=kharkiv
```

Latest result:

- city building query: 260,073 matching buildings.
- radius road CQL2 query: 8,506 matching roads in a 2.5 km radius.
- count query over buildings, roads, and green-blue systems: 309,837 matching
  objects.
- compound OR predicate query over central Kharkiv buildings: 61,791 matching
  objects.
- multi-clause union query: 21,926 matching objects, with 20,800 buildings from
  the core-building clause and 1,126 roads from the access-road clause.

## Current UI Step

The map, 3D, and immersive viewers now have the first structured selector in
the secondary vertical rail. That is the correct product location because the
selector changes the active visual surface. The selector supports:

1. one or more clauses,
2. semantic class per clause,
3. spatial scope per clause, including explicit query radius,
4. attribute predicates per clause combined as `and` or `or`,
5. union execution across clauses.

On the analytical map, `render.mode = isolate` hides normal inventory feature
tiles and renders only the query result overlay, with the city boundary/base map
kept as context. Multi-clause radius overlays are drawn from every clause scope,
so the visible radius corresponds to the query that actually produced the
result.

The current SDTQuery/free-text path remains useful as a lightweight helper, but
advanced analysts need the structured TwinQL/CQL2 builder.

## Saved Query Manifests

TwinQL/CQL2 queries can now be persisted as visual share manifests instead of
living only as recent-run history. The visual rail uses
`POST /api/live/:cityId/viewer-share-manifests` with
`mode = twin-query-manifest`, stores the normalized TwinQL request plus the UI
builder under `manifest.queryManifest`, and lists them with:

```text
GET /api/live/:cityId/viewer-share-manifests?surface=map&mode=twin-query-manifest
```

These saved manifests are session/draft by default. They are the product
boundary for replaying, sharing, and later embedding a selected map, 3D, or
immersive city-object query. Runtime query events remain the audit trail in
`ldt_viewer.semantic_query_events`.

Large visual query results stream as MVT tiles for the analytical map. The tile
route compiles the same normalized TwinQL/CQL2 query against
`ldt_query.city_objects`, keeps semantic class, source/provenance, and
multi-clause provenance as tile properties, and avoids sending one huge
FeatureCollection payload to the browser. Municipal 3D uses the same normalized
query with `cesium-primitives`; public immersive uses `scene-manifest`.

Next hardening:

- add cache invalidation/versioning for predicate-aware MVT tile URLs,
- add district/block/manzana scopes after official or reviewed inferred units
  are available,
- add publication/permission workflows so saved query manifests can graduate
  from draft session artifacts into signed or public embed artifacts.
