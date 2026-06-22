# Analysis Selection Lab Contract

Updated: 2026-06-02

This document defines the City Selection Lab layer for Twin Base Studio. The
purpose is to let an analyst create, persist, compare, replay, embed, and later
simulate over sets of city objects selected from the canonical LDT inventory.

## Product Meaning

The platform is not building a building-only selector. The selector must work
for any object that belongs to the city inventory:

- buildings,
- roads,
- green-blue systems,
- places,
- civic or mobility anchors,
- official or inferred districts, blocks, or areas,
- sensors,
- BIM or provider assets,
- potholes, traffic lights, parks, public-space objects, or future city-specific
  objects after they are ingested into the inventory.

The core rule is:

```text
query -> city object ids -> persisted selection set -> visual/API/simulation use
```

Geometry remains in the city inventory and query views. The selection layer
persists object identity, query contract, metrics, compact attributes, sample
points, styling hints, and comparison records.

## Semantic Model

A semantic class is the meaning of an object in the inventory, such as
`buildings`, `roads`, or `greenBlue`.

A semantic pack is domain logic that reads the inventory and produces derived
features, indicators, or decisions. A semantic pack can create new selectable
objects, but it is not the same thing as a base semantic class.

The City Selection Lab sits between both:

- it can select base objects from the base twin,
- it can select inferred objects or semantic-pack outputs,
- it records how the selection was made,
- it does not turn a query result into authority-approved truth.

## PostGIS Schema

The durable schema is:

```text
ldt_analysis
```

Tables:

- `analysis_sessions`: analyst work sessions and intent.
- `selection_sets`: one persisted TwinQL/CQL2/manual/provider/simulation
  selection.
- `selection_set_members`: object IDs selected by a set, with compact metadata
  and sample point.
- `selection_metrics`: count, class, and future analytic metrics for a
  selection.
- `selection_styles`: default or named visual styling for a selection.
- `selection_comparisons`: union, intersection, difference, and symmetric
  difference between two selections.

The schema is intentionally generic. A row in `selection_set_members` can point
to `ldt_core.city_entities` when the object already has a canonical entity id,
but it also preserves `object_id` so provider or derived objects can be tracked
while ingestion is still being normalized.

## Backend Boundary

Execution reads from:

```sql
ldt_query.city_objects
```

Then it persists into:

```sql
ldt_analysis.selection_sets
ldt_analysis.selection_set_members
```

Implementation modules:

- `server/db/productionTwinStore/twinQueryRepository.mjs`
  - `listCityTwinQueryObjectRows`
  - ID-first query execution over the canonical query view.
- `server/db/productionTwinStore/analysisSelectionRepository.mjs`
  - persistence, grouping, members, and comparisons.
- `server/services/analysisSelection/selectionLabService.mjs`
  - product use-case boundary for city analysis selections.
- `server/routes/liveFeature/analysisSelectionRoutes.mjs`
  - authenticated live API routes.

The visualizers should consume selection IDs or the same TwinQL/CQL2 contract,
not rebuild their own private filtering logic.

## Viewer UI Contract

The shared visual rail now separates three related but different things:

- a temporary TwinQL run, which only answers the current question;
- an analysis selection, which persists the selected city-object IDs in
  `ldt_analysis.selection_sets` and can be replayed as a working set;
- a saved view, which stores a share/embed-ready visual manifest in
  `ldt_viewer.visual_share_manifests`.

`/analytical-map`, `/city-3d`, and `/civic-xr` all use the same
`useTwinQueryController` and `TwinQueryPanel`. When a persisted selection is
replayed, the controller loads the stored `sourceQuery`, normalizes it for the
active viewer transport, executes `/api/live/:cityId/twin-query`, and sends the
result through the shared `twin:set-semantic-query` postMessage contract.

Supported startup forms:

```text
/analytical-map?selectionId=<selection uuid>
/city-3d?selectionId=<selection uuid>
/civic-xr?selectionId=<selection uuid>
```

The dashboard applies the selection after the city payload, TwinQL contract,
and viewer iframe are ready. The viewer window still receives only the visual
transport it understands: MVT for MapLibre, Cesium primitives for City 3D, and
scene manifest payloads for Civic XR.

## API

Sessions:

```text
POST /api/live/current/analysis-sessions
POST /api/live/:cityId/analysis-sessions
```

Run and persist a selection:

```text
POST /api/live/current/analysis-selections/query
POST /api/live/:cityId/analysis-selections/query
```

List selections and grouped repeated queries:

```text
GET /api/live/current/analysis-selections
GET /api/live/:cityId/analysis-selections
```

Inspect a selection:

```text
GET /api/live/current/analysis-selections/:selectionId
GET /api/live/:cityId/analysis-selections/:selectionId
GET /api/live/current/analysis-selections/:selectionId/members
GET /api/live/:cityId/analysis-selections/:selectionId/members
```

Compare two selections:

```text
POST /api/live/current/analysis-selections/compare
POST /api/live/:cityId/analysis-selections/compare
```

Comparison operations:

- `union`
- `intersection`
- `difference`
- `symmetric_difference`

## Example Query

```json
{
  "title": "Core roads and civic anchors",
  "maxSelectionMembers": 50000,
  "query": {
    "language": "twinql-json",
    "operation": "union",
    "clauses": [
      {
        "id": "central-roads",
        "label": "Central roads",
        "classes": ["roads"],
        "scope": {
          "key": "radius",
          "center": [36.2304, 49.9935],
          "radiusMeters": 2500
        }
      },
      {
        "id": "services",
        "label": "Civic anchors",
        "classes": ["accessSeeds"],
        "scope": {
          "key": "city"
        },
        "where": {
          "field": "category",
          "operator": "in",
          "value": ["hospital", "school", "pharmacy"]
        }
      }
    ]
  }
}
```

The response returns a `selection.id`. The map, City 3D, Civic XR, embeds,
exporters, and future simulation workflows should be able to reference that ID
instead of resending a large object payload.

## What This Enables

- Analysts can build a working set of city objects and return to it.
- Repeated similar queries are grouped instead of flooding the selector.
- Visual surfaces can share the same selection contract.
- Embeds can point to a stable selection or manifest.
- API analytics can record what kinds of city objects people ask for.
- Simulation and scenario workflows can declare exactly which objects they ran
  over.

## Limits

- This is not a raw SQL endpoint.
- This does not replace OGC API Features or MVT delivery.
- This does not duplicate source geometry.
- This does not make an inferred or provider object authority-approved.
- This is not yet public/signed embed access; that remains a Phase 16 policy
  hardening task.

## Smoke Test

```bash
TWIN_STUDIO_DATABASE_URL='postgresql://twin_base_studio:twin_base_studio_dev@127.0.0.1:45432/twin_base_studio' npm run test:analysis-selection-lab-smoke -- --city=kharkiv
```

The smoke creates road and building selections, reloads members, compares them,
and verifies grouped selection history.
