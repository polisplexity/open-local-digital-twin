# Visual Embed And Selection Contract

Updated: 2026-05-23

This note records the product direction for embeddable analytical map,
municipal 3D, and public immersive surfaces before more UI work is added.

## Product Rule

The visual surfaces are not only internal cockpit widgets. They should become
reusable city surfaces that can be embedded in other city, partner, or public
platforms with a controlled view contract.

The cockpit remains the full analyst workspace. Embedded maps should be
read-only or narrowly interactive by default, with explicit configuration for
which city elements, indicators, semantic packs, and selection tools are
available.

The same rule applies to the municipal 3D and public immersive surfaces:
embedding must be manifest-controlled, not a free-form iframe that can enable
private/provider layers or unsupported controls by accident.

## Map Surface Modes

| Mode | Purpose | Default access |
| --- | --- | --- |
| Cockpit analyst map | Full city analyst review with controls, provenance, indicators, and selection. | Authenticated session |
| Embedded analyst map | Reusable iframe/map panel for another internal platform. | Authenticated session or signed share token |
| Public shared map | Public-safe city story or open-data layer view. | Public token or published static config |

The same renderer can serve these modes, but the allowed controls and layer
families must come from a manifest instead of being hard-coded in the page.

## Visual Surface Contract

The current code-level manifest covers three surfaces:

| Surface | Role | Embed posture |
| --- | --- | --- |
| `map` | Analytical map for city analysts. | Full layer-family, radius/viewport, inspection, and selected-area workflows. |
| `municipal3d` | Municipal validation view. | Camera, BIM/provider anchors, base inventory, and object/area inspection. |
| `immersive` | Public-safe story view. | Story stops and simplified public layer controls only. |

The manifest is now available through:

- `/api/live/current/viewer-manifest?surface=map`
- `/api/live/current/viewer-manifest?surface=municipal3d`
- `/api/live/current/viewer-manifest?surface=immersive`
- the city-specific `/api/live/:cityId/viewer-manifest?...` equivalents

The previous map-specific endpoints remain for compatibility:

- `/api/live/current/map-manifest`
- `/api/live/:cityId/map-manifest`

## Layer Contract

The main map should expose city-meaning layers, not raw provider toggles:

- `boundary`: municipal or study-area mask.
- `roads`: consolidated public road inventory.
- `buildings`: consolidated building inventory from all accepted open/provider
  sources.
- `greenBlue`: land use, public realm, water, parks, forests, and open-space
  systems.
- `places`: named settlements, anchors, and relevant geographic references.
- `accessSeeds`: inferred civic, mobility, commerce, waste, or service-access
  seeds.
- `semanticPacks`: formal pack outputs once a pack is validated.
- `providerOverlays`: advanced overlays from city/private/provider sources,
  visible only when the share manifest allows them.

Source identity such as OSM, Overture, Microsoft, Google, city GIS, or vendor
data belongs in inspection, provenance, and reporting. It should not be the
primary map toggle unless the user is in an advanced evidence view.

## Selection Contract

The map needs selection scopes that are useful to a city analyst:

| Scope | Meaning | Status |
| --- | --- | --- |
| City | Whole city or study boundary. | Current baseline |
| Viewport | What is currently visible on screen. | Current API pattern |
| Radius | Center-out progressive loading for large cities. | Current Kharkiv demo pattern |
| District/neighborhood | Named administrative or local areas when an open/city source exists. | Needed |
| Block/manzana | Street-block or parcel-block selection for detailed local review. | Needed |
| Custom polygon | Analyst-drawn area or imported planning polygon. | Later |

Block/manzana selection must be source-aware:

- If the city provides cadastral/planning blocks, those are authority-grade
  selection units.
- If only open data exists, generated blocks can be built from road network and
  boundary geometry, but they must be marked as inferred planning units.
- A generated block must not pretend to be a legal cadastral parcel.

## API Direction

The current APIs already support the first product path:

- `/api/live/current/map-manifest`
- `/api/live/current/viewer-manifest?surface=map|municipal3d|immersive`
- `/api/live/current/layer-capabilities`
- `/api/live/current/features`
- `/api/live/:cityId/tiles/{z}/{x}/{y}.mvt`
- `/api/live/current/viewer-summary`
- `/api/live/current/capabilities`
- `/api/live/current/selection-units`
- `/api/live/current/selection-summary`
- `/api/live/current/viewer-share-manifests`
- `/api/live/current/viewer-share-manifests/:shareKey`
- `/api/live/current/viewer-share-manifests/:shareKey/publish`

The new map manifest endpoint returns the allowed layer families, controls,
selection scopes, host-command policy, and map mode for the requested city.
The shared viewer-manifest endpoint generalizes that same contract to the 3D
and immersive surfaces.

The first selection endpoints are now contract-first and standards-native:

- `selection-units` returns the available city boundary, `ldt_viewer`
  density-grid cells, inferred open-data block/manzana units when generated,
  plus explicit missing-source descriptors for district/neighborhood and
  future custom polygon selection.
- `selection-summary` returns the selected area's geometry, area, LDT core
  entity counts, authority counts, source-evidence counts, and derived
  indicators for `city`, `viewport`, `radius`, `density-grid`, and generated
  `block` scopes.
- `viewer-share-manifests` persists approved or draft visual-surface manifests
  for analytical map, municipal 3D, and public immersive embeds. The same
  endpoint now also accepts `mode = twin-query-manifest` so a multi-clause
  TwinQL/CQL2 query can be saved, listed, and replayed as a future embed
  artifact.
- published manifests now return an embed contract with a viewer path, absolute
  viewer URL when request headers allow it, manifest path, manifest URL, and
  iframe markup. Publication is stored in the same PostGIS table through
  `publication_status`, `access_policy`, `published_at`, `expires_at`, and a
  `manifest.publication` object.
- viewer runtimes now consume `?shareKey=...` directly: map, municipal 3D, and
  immersive load the saved TwinQL manifest, execute it, and start from that
  shared selection instead of waiting for dashboard `postMessage` state.

Block/manzana polygons are no longer invented inside the UI. They live in
`ldt_viewer.selection_units` and must identify their authority. The current
Kharkiv bootstrap uses the `road-polygonize-open-data` generator, so its units
are `available-inferred`, `unreviewed`, and `inferred-open-data`. Official city
or cadastral blocks can later supersede these units after review.

The frontend now consumes the shared contract instead of treating it as
backend-only metadata:

- the analytical map fetches the active surface manifest and selected-area
  summaries as city coverage changes;
- the cockpit indicator strip can show selected-area metrics instead of only
  whole-city metrics;
- the secondary control rail shows area context, available selection scopes,
  and missing-source posture;
- municipal 3D and public immersive reuse the same manifest and selected-area
  summary language in their surface strips.

Next API additions should remain contract-first:

- official district/neighborhood/block source ingestion and review;
- semantic-pack outputs inside selected-area summary;
- explicit unauthenticated signed/public embed route policy for published
  manifests. The saved publication contract exists now; opening a public
  runtime without a session must be deliberate.

## Security And Publication Rules

- Private city/provider layers are never exposed by default in embedded maps.
- Public shared maps must use an explicit publication manifest.
- Share tokens should be scoped to one city, one map mode, one layer manifest,
  and optional expiry.
- Embedded maps should use the existing postMessage viewer contract, but the
  host page must not be able to enable layers outside the manifest.

## Implementation Consequence

Further Phase 13 work should avoid hard-coding map controls into one cockpit
layout. The map runtime should keep moving toward:

- composable runtime modules,
- a layer-family manifest,
- an embed/share manifest,
- selection units that can be city-provided or generated,
- source/provenance inspection kept separate from primary visual toggles.
