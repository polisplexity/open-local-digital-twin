# Spatial Phenomena Layer Contract

Updated: 2026-06-01

This contract defines the first inventory-native environmental phenomenon
layers for City 3D. The active viewer controls now expose only layers that are
source-backed or defensible from the current city inventory. Older heat, wind,
cooling, solar, and water proxy cells can still exist in the database for
analysis and future extractor comparison, but they are no longer presented as
City 3D product modes until a real source/model adapter exists.

## Product Role

City 3D should not be only a tilted map. Its baseline role is a spatial
inspection surface where analysts can see how the current city inventory implies
urban form, exposure, and environmental signals.

The active City 3D product modes are:

- `off`: the default base city model with no phenomenon overlay.
- `builtIntensity`: a neutral open-data urban-form density read based on the
  current consolidated inventory.
- `terrainElevation`: source-backed DEM relief sampled from Mapzen Terrain
  Tiles and installed as query-scoped Cesium terrain.
- `terrainSlope`: source-backed DEM slope evidence sampled from the same DEM
  extractor.
- `airTemperature`: source-backed current 2 m air temperature sampled from an
  open weather API into a city grid and attached to city objects.
- `surfaceWater`: source-backed open-data hydrology screening signal derived
  from DEM elevation, DEM slope, and mapped open water evidence. This is a
  first water-risk context layer, not a flood-depth or drainage simulation.
- `surfaceRunoff`: first scenario-derived surface-runoff screening layer. It
  transforms the source-backed hydrology grid with rainfall assumptions and
  terrain flatness into `surface_runoff_screening`. This is still a screening
  scenario, not a certified hydraulic model.

The product mode list is implemented as a shared viewer contract in
`server/services/baseTwin/viewerContracts/city3dPhenomenaContract.mjs`. The
City 3D HTML renderer uses it to print the visible switcher and the Cesium
runtime uses the same contract to resolve layer keys and command aliases.

These layers are useful for visual exploration, city conversation, and provider
handoff, not for regulatory, emergency, or engineering decisions.

Legacy analytical proxy layers are retained in `ldt_environment` and
`ldt_query.city_objects` as non-product evidence:

- `heatProxy`
- `airflowFriction`
- `greenBlueCooling`
- `solarExposureProxy`
- `waterFlowProxy`

They are hidden from the City 3D switcher until source-backed STAC/COG heat,
wind-field, cooling, solar, or provider simulation adapters populate equivalent
authoritative or modelled layers. Hydrology now has a first source-backed
screening layer through `hydrology_surface_water_signal`, but `waterFlowProxy`
remains hidden because it is still the old density-grid proxy.

Terrain altitude, current air temperature, and surface-water screening now have
first source-backed adapters. Real land-surface heat, real wind fields, real
solar exposure, and real hydraulic water flow still require additional source
data and model metadata:
timestamped solar/shadow parameters for solar exposure,
land-surface-temperature or higher-resolution meteorological sources for heat,
wind fields or simulation grids for airflow, and
rainfall, drainage, soil/infiltration, and calibrated hydraulic model outputs
for flood depth or water flow. The viewer must not imply those are present
until the data exists.

## Database Storage

The canonical layer is stored in `ldt_environment`, attached back to the
consolidated city inventory in `ldt_core`.

Core tables:

- `ldt_environment.phenomenon_layers`: semantic/environmental layer catalog.
- `ldt_environment.phenomenon_cells`: scenario cells with geometry, metric
  value, unit, method, authority status, and source metadata.
- `ldt_environment.object_observations`: object-to-cell attachments, allowing a
  city object to answer "what heat/wind/cooling/water proxy applies here?".
- `ldt_environment.object_observation_summary`: query-fast per-object summary
  used by `ldt_query.city_objects`.
- `ldt_environment.extractor_definitions`: Phase 14 source-backed extractor
  contracts for terrain DEM, weather fields, hydrology grids, and STAC-derived
  indicators.
- `ldt_environment.extractor_runs`: city-scoped extractor run records. A run
  can be registered as a source plan before the real file/API source is
  ingested.
- `ldt_environment.extractor_artifacts`: source plans, raw asset references,
  validation reports, coverage footprints, and derived-output references
  produced by extractor runs.
- `ldt_science.simulation_models`, `scenario_definitions`,
  `scenario_inputs`, `scenario_outputs`, and `simulation_runs`: model/scenario
  metadata for derived scenario layers such as surface-runoff screening.

Seed input:

- `ldt_viewer.density_grids` remains the open-data aggregate seed for the
  current proxy implementation.

Each phenomenon cell uses:

- `city_id`: city identifier.
- `layer_key`: one of the supported phenomenon layers.
- `scenario_key`: currently `baseline`.
- `geom`: grid cell polygon in EPSG:4326.
- `metric_value`: normalized numeric score.
- `metric_unit`: currently `score_0_100`.
- `source_method`: currently `open-data-proxy`.
- `authority_status`: currently `derived-open-data-proxy`.
- `source`: JSONB source and reproducibility metadata.

The current seed `ldt_viewer.density_grids.metrics` payload includes:

- `cellSizeM`
- `buildingCount`
- `facilityCount`
- `greenBlueCount`
- `roadKm`
- `buildingDensityRank`
- `roadDensityRank`
- `greenBlueRank`
- `builtIntensity`
- `heatProxy`
- `airflowFriction`
- `greenBlueCooling`
- `phenomena.version`
- `phenomena.method`
- `phenomena.authorityStatus`
- `phenomena.reproducible`
- `phenomena.cityPortable`

`solarExposureProxy` and `waterFlowProxy` are computed during normalization
into `ldt_environment` from the same open-data seed metrics. They are kept as
proxy layers, not as measured solar or hydrological observations.

`hydrology_surface_water_signal` is different from `waterFlowProxy`: it is
written by the concrete `hydrology-grid` extractor from existing DEM cells plus
mapped open water evidence in the consolidated inventory. The value is a
0-100 screening score based on low elevation, flatness, and proximity to
mapped water. It is suitable for query-scoped visual review and object-level
questions like "which selected buildings sit near a surface-water signal?", but
it is not rainfall-runoff, drainage capacity, flood extent, or flood-depth
simulation.

`surface_runoff_screening` is the first step after that hydrology signal. It is
written by the `surface-runoff-screening-v0` scenario runner, not by the
extractor. The runner reads the latest `hydrology_surface_water_signal` grid
for the city/scenario, combines it with terrain low-point/flatness metrics and
a rainfall assumption, writes scenario cells back to `ldt_environment`, attaches
the score to city objects, refreshes `ldt_query.city_objects`, and records a
completed run plus inputs/outputs in `ldt_science`. It is useful for screening
which selected objects deserve water review under a rainfall assumption. It
does not model pipe/drain capacity, infiltration, flood depth, velocity, or
official return periods.

City 3D renders `surfaceRunoff` as a low-height screening surface plus short
local flow-direction glyphs generated inside the active TwinQL scope. The
renderer must not draw long starburst or hub-and-spoke links because that
implies a drainage network the model has not computed. The glyphs only connect
nearby cells when the local evidence suggests a plausible downhill or
water-signal direction. They are viewer glyphs derived from scenario cells, DEM
elevation, and mapped water signal; they are not persisted as simulation state
and must not be described as certified water velocity.

This keeps the first phenomenon layer inside the database-backed twin instead
of inventing a separate runtime-only dataset. City 3D visual particles and
extruded cells are only a renderer for this layer; they are not the source of
truth.

## Reproducibility

Any city can regenerate the same layer after its consolidated inventory and
viewer aggregate exist:

```bash
npm run db:ldt:refresh-viewer-aggregates -- --city=<city_id>
npm run db:ldt:generate-environmental-phenomena -- --city=<city_id>
npm run db:ldt:run-terrain-dem -- --city=<city_id>
npm run db:ldt:run-hydrology-grid -- --city=<city_id>
npm run db:ldt:run-surface-runoff -- --city=<city_id> --rainfall-mm=30 --duration-hours=1
```

The aggregate service derives the seed values from `ldt_core.city_entities` and
`ldt_core.city_boundaries`; the environmental generator normalizes those values
into `ldt_environment` and attaches them back to city objects. A new city does
not need a bespoke UI or a manual phenomenon file to get the baseline 3D
surface.

## API

The viewer reads environmental layers through authenticated JSON endpoints and
uses the returned GeoJSON FeatureCollections only as an API transport envelope
for bounded query cells:

- `GET /api/live/:cityId/environmental-layers`
- `GET /api/live/:cityId/environmental-cells?layerKey=terrain_elevation_m&bbox=<west,south,east,north>&limit=50000`
- `GET /api/live/:cityId/environmental-cells?layerKey=weather_air_temperature_c&center=<lon,lat>&radiusMeters=<m>&limit=5000`
- `GET /api/live/:cityId/environmental-cells?layerKey=hydrology_surface_water_signal&center=<lon,lat>&radiusMeters=<m>&limit=5000`
- `GET /api/live/:cityId/environmental-cells?layerKey=surface_runoff_screening&center=<lon,lat>&radiusMeters=<m>&limit=5000`
- `GET /api/live/:cityId/environmental-observations?objectId=<object_id>`

`environmental-cells` returns a FeatureCollection because it is a bounded API
transport envelope for current query-scoped phenomenon overlays. It is not the
long-term high-volume visual transport. City 3D treats the cells as scientific
overlays, while Analytical Map can reuse them later as an analytical overlay or
report layer. `environmental-observations` returns the object-attached values
for inspection, API, and future semantic-pack logic. Visual runtimes should
request environmental cells through the active TwinQL scope. Full-city
phenomenon layers are allowed only when the query scope is explicitly `city`;
radius, viewport, and custom-polygon reads should send a spatial filter and
then keep a final browser-side exact filter for display.

For production-scale 3D city geometry, the target transport is 3D Tiles. The
current bounded FeatureCollection/entity path is acceptable only for
query-scoped scientific overlays and transitional Cesium primitive payloads.
Moving City 3D to 3D Tiles requires a derived tiling pipeline that preserves
`ldt_core.city_entities.object_id` identity, writes tileset/version metadata,
stores large generated assets outside PostGIS, and keeps TwinQL/CQL2 selection
able to map rendered features back to the inventory.

Terrain layers are the exception in the viewer runtime: `terrain_elevation_m`
is also read as a source-backed heightmap and installed into Cesium as a
`CustomHeightmapTerrainProvider`. That makes the terrain part of the scene
surface itself, not just a colored overlay. City objects can then use Cesium
height references to clamp to terrain and extrude relative to ground. The
endpoint keeps a higher cell limit for terrain so the heightmap is spatially
continuous; non-terrain phenomenon layers remain capped for lightweight
overlay rendering.

TwinQL/CQL2 can also query the summarized environmental attributes on
`ldt_query.city_objects`:

- `built_form_proxy`
- `heat_proxy`
- `air_roughness_proxy`
- `hydrology_surface_water_signal`
- `surface_runoff_screening`
- `green_blue_cooling_proxy`
- `solar_exposure_proxy`
- `water_flow_proxy`
- `terrain_elevation_m`
- `terrain_slope_deg`
- `weather_air_temperature_c`
- `weather_wind_speed_ms`
- `weather_wind_direction_deg`

## Future Provider And Open-Data Inputs

Provider or advanced open-data packages should attach through the same pattern:

- normalized source evidence in `ldt_prov`,
- catalog metadata in `ldt_catalog`,
- inventory or analytical records in the appropriate LDT schema,
- viewer-ready aggregates in `ldt_viewer`,
- manifest capabilities for each visual surface.

Future extractors should include:

- `terrain-dem`: DEM/terrain elevation for altitude, slope, drainage, and
  better 3D relief.
- `weather-field`: ERA5, national weather, or local meteorological wind fields
  as timestamped scenario grids.
- `hydrology-grid`: hydrography, rainfall, drainage, and surface-water datasets
  for water-flow context.
- `stac-derived-indicator`: STAC/COG-derived land-surface temperature, NDVI,
  impervious surface, flood extent, and damage evidence.
- Provider flood, fire, pollution, airflow, heat, solar, and hydrology
  simulations with scenario, timestamp, uncertainty, height/level, and model
  identity metadata.

Those four open-data extractors are now registered as Phase 14 contracts.
`terrain-dem` has the first real downloader/normalizer. It reads Mapzen
Terrain Tiles Terrarium PNG tiles from AWS Open Data, generates a
city-specific DEM sampling grid, stores `terrain_elevation_m` and
`terrain_slope_deg` in `ldt_environment.phenomenon_cells`, and attaches values
to city objects through `ldt_environment.object_observations`. The portable
default is `terrain-dem-250m`; Kharkiv's current demo dataset is
`terrain-dem-100m` for a higher-detail City 3D inspection.

`weather-field` now has the first real source adapter too. It samples
Open-Meteo current weather values at the center of generated city weather grid
cells, writes `weather_air_temperature_c`, `weather_wind_speed_ms`, and
`weather_wind_direction_deg`, catalogs the Open-Meteo dataset/terms, records a
completed extractor run, and attaches observations back to inventory objects.
The first City 3D product mode is `airTemperature`, which paints query-scoped
ground cells by Celsius value. This is air temperature, not land-surface
temperature. STAC/COG-derived land-surface temperature remains a separate
future adapter because it comes from raster/EO products and has different
resolution, time, and uncertainty semantics.

`surface-runoff-screening-v0` is now the first model/scenario runner attached
to these source-backed layers. It is portable across cities that have
consolidated inventory, DEM terrain, and hydrology-grid output. Kharkiv's
baseline run with 30 mm over 1 hour wrote 85,628 scenario cells, 171,776
object observations, and a completed `ldt_science.simulation_runs` record. The
City 3D product mode is `surfaceRunoff` / `Runoff scenario`, rendered as a
query-scoped screening surface plus animated runoff-flow glyphs.

The legacy `city-density-2km` viewer grid can still be passed explicitly for
cheap tests, but it is too coarse for City 3D terrain or weather.
STAC-derived indicators remain `source-plan-only`. Hydrology now has a concrete
extractor, and surface runoff has a first scenario runner, but certified
hydraulic rainfall-runoff simulation remains future work.

City 3D no longer uses the triangulated DEM mesh as the active product path.
The persisted unit is still the environmental grid cell in PostGIS because it is
queryable, reproducible, and attachable to inventory objects. The Cesium runtime
starts flat, then installs terrain elevation as a source-backed
`CustomHeightmapTerrainProvider` only for the active TwinQL selection. Terrain,
slope, heat, wind, cooling, sun, and water reads must use query scope
(`bbox`, `center`/`radiusMeters`, or a future selection-unit geometry) before
the runtime paints them. Full-city rendering is allowed only when the query
explicitly asks for city scope. This avoids pretending that a browser-only
overlay is a professional terrain service. The production terrain layer still
needs DEM raster/object storage, terrain-tile or 3D Tiles generation, streaming,
and clamping of roads, buildings, and semantic objects to the terrain.

The Phase 13 viewer now keeps City 3D camera interaction close to Cesium's
standard model. Native Cesium drag, orbit, tilt, pinch, and wheel controls stay
enabled through `ScreenSpaceCameraController`; the product runtime uses
query/city bounds for initial fit and explicit fit actions only. A post-move
refocus guard was removed because it made the camera snap back after the
operator released the mouse, which breaks spatial inspection.

The camera/query implementation is now modularized. `cityCesiumRuntime.mjs`
composes focused Cesium snippets for spatial bounds, camera behavior, and query
selection:

- `cityCesiumSpatialRuntime.mjs` owns query bounds and GeoJSON/primitive
  conversion.
- `cityCesiumCameraRuntime.mjs` owns Cesium camera setup and fit actions.
- `cityCesiumQuerySelectionRuntime.mjs` owns live/saved query application,
  stale query-source cleanup, and clear/replay behavior.

Visual quality remains a separate concern from data correctness. The current
terrain mode proves source-backed DEM attachment, but a 100 m DEM over a small
downtown query does not create dramatic relief by itself. Professional City 3D
phenomena should graduate from translucent grid/cell hints into query-scoped
surfaces, contours, vector fields, wind/water particles, and scenario glyphs
only after those values exist in `ldt_environment` or `ldt_science`.

Kharkiv was regenerated on 2026-05-30 with a 100 m grid and Mapzen zoom 14:
85,628 sampled DEM cells, 171,256 terrain phenomenon cells, 343,552
object-attached terrain observations, and zero tile sampling failures. The
extractor now samples tiles concurrently, batch-inserts samples, reports
progress, and relies on environmental observation indexes so repeated DEM runs
can replace cells without blocking on foreign-key scans.

The first reproducible operator command is:

```bash
npm run db:ldt:register-environmental-extractors -- --city=<city_id>
npm run db:ldt:run-terrain-dem -- --city=<city_id> --grid-resolution-m=250 --tile-zoom=13 --sample-offset-m=125 --concurrency=24
npm run db:ldt:run-weather-field -- --city=<city_id> --grid-resolution-m=2500 --batch-size=40
npm run db:ldt:run-hydrology-grid -- --city=<city_id>
npm run db:ldt:run-surface-runoff -- --city=<city_id> --rainfall-mm=30 --duration-hours=1
# High-detail demo or stronger workstation:
npm run db:ldt:run-terrain-dem -- --city=<city_id> --grid-resolution-m=100 --tile-zoom=14 --sample-offset-m=50 --concurrency=32
```

The live inspection endpoints are:

- `GET /api/live/:cityId/environmental-extractors`
- `GET /api/live/:cityId/environmental-extractor-runs`

## Phase Impact

This is a Phase 13 City 3D improvement and a Phase 14 data-engineering bridge.
The first bridge now exists as a persisted extractor registry and run/artifact
contract. It prepares later `simulation-grid`, `weather-field`, `terrain-dem`,
`hydrology-grid`, and `stac-derived-indicator` adapters without making those
heavy packages mandatory for the open-source city starter.
