# Provider Connector Contract

Updated: 2026-05-10

## Product Promise

Twin Base Studio should let any city start from an open-data base twin and then
attach specialized layers from public agencies, universities, companies, civic
groups, and city departments.

The base twin is the city-owned reference layer. Provider layers are not baked
into the base twin. They are registered beside it with provenance, access
rules, format expectations, and ingestion status.

## Current Phase 3 Scope

Implemented now:

- database-backed provider registry
- database-backed provider connector registry
- city-scoped layer registry
- layer ingestion job registration
- GeoJSON FeatureCollection ingestion for registered provider layers
- CSV ingestion for registered provider layers with latitude/longitude columns
  or GeoJSON geometry columns
- OGC API Features and WFS endpoints that return GeoJSON FeatureCollections
- metadata registration for raster COG/STAC/WMS, IoT feeds, BIM/IFC/CityJSON/
  3D Tiles, Shapefile, and GeoPackage packages
- GDAL-backed Shapefile and GeoPackage vector extraction through queued package
  jobs
- IFC STEP metadata, spatial-record, and model-anchor extraction through direct
  and queued package jobs
- IFC native-geometry inspection and local mesh asset bundle generation when
  the IFC model contains real shape geometry
- token-protected provider API for upload intents and queued ingestion jobs
- admin APIs for provider, layer, and job registration
- admin UI controls for provider, layer, and ingestion operations

Not implemented yet:

- automatic feature extraction from raster, IoT stream, mixed BIM archives, or
  raw satellite packages into PostGIS
- S3-compatible external object-storage upload backend for large multi-node
  deployments
- per-feature validation reports
- provider-specific permissions beyond coarse bearer-token scopes
- production object-storage lifecycle management for large BIM mesh asset
  portfolios

This phase creates the production extension point. It does not claim provider
data has been fully imported until an ingestion adapter writes features,
artifacts, or semantic outputs.

IFC has two supported states today:

- Metadata-only IFC: the platform stores the model anchor, hierarchy, property
  sets, and native-geometry inspection result, then the viewer renders a BIM
  anchor marker.
- Geometry IFC: the platform stores the same BIM metadata and writes a local
  mesh bundle containing a manifest plus raw `Float32` vertex and `Uint32`
  index buffers. The municipal 3D viewer can load those protected BIM assets
  and render them as a provider BIM layer.

The repeatable geometry check is:

```bash
TWIN_STUDIO_DATABASE_URL=postgresql://... \
  npm run test:ifc-geometry-smoke -- --city=adazi --ifc=/path/to/model.ifc
```

## Viewer Scaling Contract

Provider and base layers now have a first read path for full-city scaling:

- Bbox GeoJSON:
  `GET /api/live/:cityId/features?bbox=minLon,minLat,maxLon,maxLat&layers=layerA,layerB&limit=1000`
- Vector tile:
  `GET /api/live/:cityId/tiles/:z/:x/:y.mvt?layers=layerA,layerB&limit=2000`
- Layer capabilities:
  `GET /api/live/:cityId/layer-capabilities`

The `layers` parameter accepts registered base layer keys such as `roads` and
`buildings`, plus provider layer keys created through the provider/layer
registry. These endpoints are authenticated live-viewer routes; they are the
first production path for loading only the visible city window.

The capability endpoint tells the viewer which delivery mode is currently
available per layer: bounded GeoJSON, vector tile, BIM payload/assets,
raster/catalog metadata, or 3D package metadata.

## Concepts

### Provider

A provider is an organization or system that supplies city-layer data.

Examples:

- municipal fire department
- flood model vendor
- satellite imagery provider
- IoT platform
- BIM/CAD repository
- university research lab
- national open-data portal

### Connector

A connector describes how the provider exposes data. It is a contract record,
not a secret store.

Supported connector types planned:

- `upload`
- `api`
- `ogc-wms`
- `ogc-wfs`
- `ogc-api-features`
- `raster-cog`
- `sensor-feed`
- `bim-package`
- `cityjson`
- `3d-tiles`

Supported formats planned:

- `geojson`
- `csv`
- `shapefile`
- `geopackage`
- `wms`
- `wfs`
- `ogc-api-features`
- `cog`
- `stac`
- `mqtt`
- `http-json`
- `ifc`
- `cityjson`
- `3d-tiles`

### City Layer

A city layer is a city-scoped dataset definition. It says what the layer means,
who provides it, what geometry/fidelity it has, how public it is, and how it
should be refreshed.

Examples:

- `flood-risk`
- `fire-stations`
- `evacuation-routes`
- `satellite-basemap-2026`
- `iot-air-quality`
- `municipal-bim-assets`

### Ingestion Job

An ingestion job records an attempt or intention to load one provider layer. In
the current Phase 3 foundation, jobs can be registered and tracked. Later
phases will let workers validate, transform, and load the data.

## Admin API

All endpoints are under the existing admin auth gate.

### List Providers

`GET /api/admin/providers`

Returns providers and their registered connectors.

### Upsert Provider

`POST /api/admin/providers`

Example body:

```json
{
  "id": "flood-model-lab",
  "name": "Flood Model Lab",
  "providerType": "research-provider",
  "websiteUrl": "https://example.org",
  "contactLabel": "data office",
  "metadata": {
    "country": "EU",
    "dataSteward": "hydrology team"
  },
  "connectors": [
    {
      "connectorKey": "flood-geojson-api",
      "displayName": "Flood GeoJSON API",
      "connectorType": "api",
      "status": "draft",
      "supportedFormats": ["geojson", "http-json"],
      "endpointUrl": "https://example.org/flood.geojson",
      "authMode": "api-key",
      "contract": {
        "geometryTypes": ["Polygon"],
        "requiredProperties": ["scenario", "depth_m", "return_period_years"]
      }
    }
  ]
}
```

### List City Layers

`GET /api/admin/cities/:cityId/layers`

Returns the base layers and provider layers registered for one city.

### Upsert City Layer

`POST /api/admin/cities/:cityId/layers`

Example body:

```json
{
  "key": "flood-risk",
  "name": "Flood Risk",
  "providerId": "flood-model-lab",
  "layerFamily": "risk",
  "geometryType": "Polygon",
  "authorityStatus": "provider-supplied",
  "accessLevel": "city-private",
  "sourceLicense": "provider-contract",
  "updateFrequency": "monthly",
  "semanticStatus": "source-layer",
  "metadata": {
    "domain": "flood",
    "expectedUse": "planning and emergency preparedness"
  }
}
```

### Register Layer Ingestion Job

`POST /api/admin/cities/:cityId/layers/:layerKey/ingestion-jobs`

Example body:

```json
{
  "providerId": "flood-model-lab",
  "ingestionMode": "registered",
  "sourceFormat": "geojson",
  "sourceUri": "https://example.org/flood.geojson",
  "status": "registered",
  "submittedBy": "platform-admin",
  "validationSummary": {
    "state": "not-run"
  },
  "metadata": {
    "scenario": "100-year rainfall"
  }
}
```

### List Layer Ingestion Jobs

`GET /api/admin/cities/:cityId/layer-ingestion-jobs`

Returns recent layer ingestion jobs for one city.

### Ingest GeoJSON Layer

`POST /api/admin/cities/:cityId/layers/:layerKey/ingest-geojson`

The layer must already exist in the city layer registry. The endpoint accepts a
GeoJSON `FeatureCollection` inline or fetches one from an HTTP(S) URI.

Inline body:

```json
{
  "providerId": "flood-model-lab",
  "sourceFormat": "geojson",
  "replaceExisting": true,
  "submittedBy": "platform-admin",
  "geojson": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "id": "flood-zone-001",
          "name": "Flood Zone 001",
          "scenario": "100-year rainfall",
          "depth_m": 1.2
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [[
            [24.3301, 57.0741],
            [24.3311, 57.0741],
            [24.3311, 57.0751],
            [24.3301, 57.0751],
            [24.3301, 57.0741]
          ]]
        }
      }
    ]
  }
}
```

URI body:

```json
{
  "providerId": "flood-model-lab",
  "sourceUri": "https://example.org/flood.geojson",
  "replaceExisting": true,
  "submittedBy": "platform-admin"
}
```

Current GeoJSON ingestion behavior:

- validates that the payload is a `FeatureCollection`
- enforces `TWIN_STUDIO_GEOJSON_MAX_FEATURES`, default `10000`
- enforces `TWIN_STUDIO_GEOJSON_MAX_BYTES`, default `20MB`, for URI fetches
- supports only HTTP(S) fetches for `sourceUri`
- writes the raw GeoJSON response to `source_artifacts`
- writes raw feature rows to `source_features_raw`
- writes normalized provider features to `city_features`
- creates an `ingestion_runs` record
- creates a `layer_ingestion_jobs` record
- defaults to replacing existing features for that layer unless
  `replaceExisting` is `false`

### Ingest CSV Layer

`POST /api/admin/cities/:cityId/layers/:layerKey/ingest-csv`

The layer must already exist in the city layer registry. The endpoint accepts
inline CSV text or fetches CSV from an HTTP(S) URI.

Point CSV body:

```json
{
  "providerId": "fire-department",
  "sourceFormat": "csv",
  "replaceExisting": true,
  "submittedBy": "platform-admin",
  "latitudeField": "lat",
  "longitudeField": "lon",
  "csvText": "id,name,lat,lon,status\nstation-001,Central Station,57.0746,24.3297,active"
}
```

URI body:

```json
{
  "providerId": "fire-department",
  "sourceUri": "https://example.org/fire-stations.csv",
  "latitudeField": "latitude",
  "longitudeField": "longitude",
  "replaceExisting": true,
  "submittedBy": "platform-admin"
}
```

CSV with a GeoJSON geometry column:

```json
{
  "providerId": "risk-office",
  "geometryField": "geometry",
  "csvText": "id,name,geometry\nzone-001,Flood Zone,\"{\"\"type\"\":\"\"Polygon\"\",\"\"coordinates\"\":[[[24.3301,57.0741],[24.3311,57.0741],[24.3311,57.0751],[24.3301,57.0751],[24.3301,57.0741]]]}\""
}
```

Current CSV ingestion behavior:

- parses quoted CSV fields
- enforces `TWIN_STUDIO_CSV_MAX_ROWS`, default `25000`
- enforces `TWIN_STUDIO_CSV_MAX_BYTES`, default `20MB`
- supports only HTTP(S) fetches for `sourceUri`
- auto-detects common coordinate fields: `lat`, `latitude`, `y`, `lon`, `lng`,
  `long`, `longitude`, `x`
- accepts explicit `latitudeField`, `longitudeField`, `geometryField`, and
  `idField`
- converts rows to GeoJSON features internally before storage
- writes the original CSV text to `source_artifacts`
- writes raw converted features to `source_features_raw`
- writes normalized provider features to `city_features`
- creates an `ingestion_runs` record
- creates a `layer_ingestion_jobs` record

### Ingest OGC Features Layer

`POST /api/admin/cities/:cityId/layers/:layerKey/ingest-ogc-features`

The endpoint expects an OGC API Features `items` URL or a WFS request URL that
returns a GeoJSON `FeatureCollection`.

Example body:

```json
{
  "providerId": "national-geoportal",
  "sourceUri": "https://example.org/collections/fire-stations/items?f=json",
  "replaceExisting": true,
  "submittedBy": "platform-admin"
}
```

Current OGC behavior:

- fetches HTTP(S) GeoJSON FeatureCollections
- follows `rel=next` links up to `TWIN_STUDIO_OGC_MAX_PAGES`, default `5`
- merges fetched pages into one FeatureCollection
- writes raw source artifacts, raw features, normalized provider features,
  ingestion runs, and layer ingestion jobs through the same provider path

### Ingest CityJSON

`POST /api/admin/cities/:cityId/layers/:layerKey/ingest-cityjson`

This endpoint is the first real package extractor. It converts CityJSON
`CityObjects` into normalized twin features by extracting a WGS84 centroid for
each object and preserving object attributes and geometry metadata.

Example body:

```json
{
  "providerId": "municipal-3d-provider",
  "sourceUri": "https://example.org/city/buildings.city.json",
  "replaceExisting": true,
  "submittedBy": "platform-admin"
}
```

Current CityJSON behavior:

- accepts inline `cityjson` or an HTTP(S) `sourceUri`
- requires a CityJSON document with vertices and `CityObjects`
- requires WGS84/longitude-latitude coordinates through metadata reference
  system, unless an operator explicitly sends `assumeWgs84: true`
- converts each georeferenced object into a point feature at object centroid
- stores the original CityJSON document as a source artifact
- writes normalized provider features, raw features, ingestion runs, and layer
  ingestion jobs through the same provider path
- caps objects with `TWIN_STUDIO_CITYJSON_MAX_OBJECTS`, default `10000`
- caps fetched bytes with `TWIN_STUDIO_CITYJSON_MAX_BYTES`, default `50 MB`

### Ingest IFC

`POST /api/admin/cities/:cityId/layers/:layerKey/ingest-ifc`

This endpoint is the first IFC/BIM extractor. It parses IFC STEP text, counts
core BIM entities, extracts project/site/building names, reads basic spatial
containment, reads IFC property sets, and writes a model anchor plus indexed
building, storey, and space records when the IFC file contains `IfcSite.RefLatitude` and
`IfcSite.RefLongitude` or when the provider supplies explicit `lat`/`lon`
anchor coordinates. It also runs a `web-ifc` native-geometry inspection and
stores mesh/geometry-reference counts in the IFC summary. When geometry exists,
it writes a BIM mesh asset bundle under runtime/object storage and exposes
protected admin asset URLs from the BIM payload.

Example body:

```json
{
  "providerId": "municipal-bim-provider",
  "sourceUri": "https://example.org/assets/town-hall.ifc",
  "replaceExisting": true,
  "submittedBy": "platform-admin"
}
```

Fallback anchor example:

```json
{
  "providerId": "municipal-bim-provider",
  "sourceUri": "https://example.org/assets/town-hall.ifc",
  "lat": 57.0756,
  "lon": 24.3374,
  "submittedBy": "platform-admin"
}
```

Current IFC behavior:

- accepts inline `ifcText` or an HTTP(S) `sourceUri`
- parses STEP entities for metadata, hierarchy, anchors, and property sets
- inspects native IFC geometry with `web-ifc` and records whether element
  geometry references exist
- writes a local mesh asset bundle for native geometry buffers when the IFC file
  contains shape representations
- stores a source artifact summary, not the full IFC payload
- extracts `IFCPROJECT`, `IFCSITE`, `IFCBUILDING`,
  `IFCBUILDINGSTOREY`, and `IFCSPACE` counts/names for operator review
- extracts parent/child links from `IFCRELAGGREGATES` and
  `IFCRELCONTAINEDINSPATIALSTRUCTURE`
- extracts `IFCPROPERTYSET`, `IFCPROPERTYSINGLEVALUE`, and
  `IFCRELDEFINESBYPROPERTIES` values into the related BIM record properties
- creates one point feature for the georeferenced model anchor and additional
  indexed point records for buildings, storeys, and spaces when an IFC or
  provider anchor is available
- marks those BIM record geometries as model-anchor index records, not element
  footprints or room polygons
- stores native geometry inspection metadata such as `state`,
  `elementMeshCount`, `geometryReferenceCount`, vertex-buffer value count, and
  index-buffer value count
- stores mesh asset manifests with binary vertex/index buffer URLs; default
  extraction cap is `TWIN_STUDIO_IFC_MESH_ASSET_MAX_BYTES`, default `100 MB`
- registers metadata-only package results when no anchor is available
- caps fetched bytes with `TWIN_STUDIO_IFC_MAX_BYTES`, default `100 MB`
- caps parsed entities with `TWIN_STUDIO_IFC_MAX_ENTITIES`, default `250000`
- does not yet adapt those raw buffers into a complete in-browser 3D BIM scene,
  room polygons, MEP systems, or storey geometry

### BIM Payload

`GET /api/admin/cities/:cityId/layers/:layerKey/bim-payload`

This endpoint turns stored IFC features into a viewer/operations payload. It is
for BIM index records produced by the IFC extractor, with native-geometry
inspection metadata and mesh asset manifests, not a complete 3D BIM scene.

Current BIM payload behavior:

- returns the layer contract and payload type `ifc-bim-index`
- returns the model anchor
- returns building, storey, and space nodes
- returns parent/child hierarchy links
- returns IFC property sets attached to each node
- returns the `web-ifc` native-geometry inspection summary from the model anchor
- returns protected asset URLs for mesh manifests and binary buffers when
  native geometry was extracted
- returns explicit limitations stating that records are positioned at the model
  anchor and that raw mesh buffers still need a viewer adapter

### BIM Mesh Assets

`GET /api/admin/cities/:cityId/layers/:layerKey/bim-assets/:bundleId/:assetName`

This protected admin route serves files produced by the IFC mesh asset bundle.
`manifest.json` is served as JSON. Vertex and index buffers are served as
`application/octet-stream`.

Current asset behavior:

- stores assets below `runtime-data/bim-assets` for local deployments
- uses manifest entries as the stable handoff contract for a future
  S3-compatible object-storage backend
- stores raw `web-ifc` Float32 vertex buffers and Uint32 index buffers
- exposes admin asset URLs for operator APIs and live city-scoped asset URLs
  for the authenticated municipal 3D viewer
- does not expose provider-upload signatures; BIM assets remain protected until
  a public/city-private asset policy is defined

### Live BIM Viewer Adapter

`GET /api/live/:cityId/bim-layers`

This authenticated city-scoped route returns BIM payloads for registered BIM
or IFC-backed layers that the signed-in user can access. The municipal Three.js
viewer uses it to add a `bimAssets` layer.

`GET /api/live/:cityId/bim-assets/:layerKey/:bundleId/:assetName`

This authenticated city-scoped route serves BIM asset files to the 3D viewer.

Current viewer behavior:

- renders IFC mesh buffers from the asset bundle when native geometry exists
- interprets `web-ifc` vertex buffers into Three.js `BufferGeometry`
- recenters and scales extracted IFC meshes into the municipal planning scene
- shows an explicit BIM anchor marker when the IFC has metadata/hierarchy but
  no native shape geometry
- keeps BIM visibility controlled as a normal 3D layer named `bimAssets`
- does not yet provide storey slicing, room polygons, MEP filtering, element
  search, or BIM-to-building footprint alignment

### Ingest STAC

`POST /api/admin/cities/:cityId/layers/:layerKey/ingest-stac`

This endpoint is the first raster/satellite package extractor. It converts
STAC Items, ItemCollections, GeoJSON FeatureCollections of STAC Items, and STAC
Collections into normalized provider features. The geometry represents item or
collection footprint; raster assets remain linked as external assets in feature
properties and source artifacts.

Example body:

```json
{
  "providerId": "satellite-provider",
  "sourceUri": "https://example.org/stac/collections/flood/items/latest.json",
  "replaceExisting": true,
  "submittedBy": "platform-admin"
}
```

Current STAC behavior:

- accepts inline `stac` JSON or an HTTP(S) `sourceUri`
- supports STAC Item, ItemCollection/FeatureCollection, and Collection
- rejects Catalog link traversal until a discovery worker is added
- converts item geometries or bboxes into provider features
- preserves asset hrefs, media types, roles, collection id, datetime, and links
  in feature properties
- stores the original STAC document as a source artifact
- writes normalized provider features, raw features, ingestion runs, and layer
  ingestion jobs through the same provider path
- caps items with `TWIN_STUDIO_STAC_MAX_ITEMS`, default `10000`
- caps fetched bytes with `TWIN_STUDIO_STAC_MAX_BYTES`, default `20 MB`

## Async Ingestion Jobs

Provider ingestion can now run through a queue contract instead of only direct
request/response execution.

### Queue Job

`POST /api/admin/cities/:cityId/layers/:layerKey/ingestion-jobs/queue`

Example body:

```json
{
  "action": "stac",
  "providerId": "satellite-provider",
  "connectorKey": "flood-stac-items",
  "sourceUri": "https://example.org/stac/collections/flood/items/latest.json",
  "replaceExisting": true,
  "submittedBy": "platform-admin"
}
```

Supported `action` values:

- `geojson`
- `csv`
- `ogc-features`
- `stac`
- `cityjson`
- `package`

Queue behavior:

- writes a `layer_ingestion_jobs` row with status `queued`
- stores the requested action, source format, source URI, idempotency key, and
  original request payload
- returns an existing job when the same city/layer/idempotency key is submitted
  again
- writes validation report warnings when a job is structurally suspicious but
  still queueable

### Run Job

`POST /api/admin/ingestion-jobs/:jobId/run`

Runs one queued job with the existing provider adapter. Current local execution
can be API-triggered or executed by the provider ingestion worker.

Worker command:

```bash
npm run worker:provider-ingestion
```

One-shot worker command:

```bash
npm run worker:provider-ingestion:once
```

Worker environment:

- `TWIN_STUDIO_DATABASE_URL`: PostGIS connection string
- `TWIN_STUDIO_WORKER_BATCH_SIZE`: queued jobs per tick, default `5`
- `TWIN_STUDIO_WORKER_INTERVAL_MS`: loop interval, default `10000`
- `TWIN_STUDIO_WORKER_ID`: worker identity stored in job lock metadata

Native vector extraction:

- The Docker image installs GDAL command-line tools.
- Queued `package` jobs with `sourceFormat: "shapefile"` run `ogr2ogr` against
  HTTP(S) zip sources through GDAL `/vsizip/vsicurl/`.
- Queued `package` jobs with `sourceFormat: "geopackage"` run `ogr2ogr` against
  HTTP(S) GeoPackage sources through GDAL `/vsicurl/`.
- Extracted vectors are reprojected to EPSG:4326, capped by
  `TWIN_STUDIO_NATIVE_VECTOR_MAX_FEATURES`, and written through the same
  provider-feature path as GeoJSON.
- Optional `layerName` selects a specific GDAL layer.

IFC package extraction:

- Queued `package` jobs with `sourceFormat: "ifc"` run the IFC STEP
  metadata, property-set, spatial-record, anchor, and `web-ifc`
  native-geometry inspection extractor. If native geometry exists, the worker
  writes a mesh asset bundle and links it from the BIM payload.
- Inline `ifcText` is accepted for smoke tests and small provider jobs.
- HTTP(S) `sourceUri` is accepted for production package handoff.
- If the IFC has no georeference and no provider anchor, the worker completes
  with metadata-only registration and a validation warning instead of inventing
  coordinates.

## Provider API

Provider API routes are for external systems. They are separate from `/api/admin`
so providers do not need an admin browser session.

Authentication:

- `Authorization: Bearer <token>`
- or `X-Twin-Provider-Token: <token>`

Production should configure hashed tokens through
`TWIN_STUDIO_PROVIDER_API_TOKENS_JSON`.

### Provider Status

`GET /api/provider/v1/status`

Returns provider API readiness and endpoint names.

### Upload Intent

`POST /api/provider/v1/cities/:cityId/layers/:layerKey/upload-intents`

Required scope: `provider:upload`

Example body:

```json
{
  "sourceFormat": "geopackage",
  "fileName": "flood-risk.gpkg",
  "maxBytes": 524288000
}
```

The response contains an upload intent. In the default self-hosted path it
includes:

- `uploadUrl`: signed `PUT` URL for the provider package
- `sourceUri`: signed download URL for the ingestion worker
- `requiredJobBody`: package job body to submit after the upload

Uploaded bytes are stored under `runtime-data/provider-uploads`. Large
multi-node deployments should use an external object-storage adapter.

### Provider Queue Job

`POST /api/provider/v1/cities/:cityId/layers/:layerKey/jobs`

Required scope: `provider:ingest`

Example body:

```json
{
  "layer": {
    "name": "Flood risk polygons",
    "layerFamily": "risk",
    "geometryType": "Polygon",
    "accessLevel": "city-private"
  },
  "job": {
    "action": "package",
    "sourceFormat": "geopackage",
    "sourceUri": "https://provider.example/flood-risk.gpkg",
    "replaceExisting": true
  }
}
```

The provider route can upsert the layer contract and queue the ingestion job in
one request. Workers then process the same queue used by admin jobs.

### City Authority Acceptance

`POST /api/admin/cities/:cityId/layers/:layerKey/accept-authority`

This is an admin operation, not a provider operation. It marks a registered
layer as `city-authoritative` and stores the acceptance evidence in layer
metadata.

Example body:

```json
{
  "acceptedBy": "city-gis-office",
  "evidenceUri": "https://city.example/datasets/official-layer",
  "evidenceLabel": "Official GIS publication",
  "note": "Accepted by the city deployment owner."
}
```

### Inspect Job

`GET /api/admin/ingestion-jobs/:jobId`

Returns status, attempt count, lock metadata, source details, stats, validation
summary, layer, provider, connector, and timing fields.

### Validation Report

`GET /api/admin/ingestion-jobs/:jobId/report`

Returns validation warnings/errors stored in `ingestion_validation_reports`.
This is where rejected rows, unsupported source types, invalid CRS, missing
geometry, oversized payloads, and worker failures are recorded.

### Retry Or Cancel

`POST /api/admin/ingestion-jobs/:jobId/retry`

Moves a `failed` or `cancelled` job back to `queued`.

`POST /api/admin/ingestion-jobs/:jobId/cancel`

Cancels a queued or registered job.

### Register Package Metadata

`POST /api/admin/cities/:cityId/layers/:layerKey/register-package`

This endpoint registers provider packages that are not parsed into normalized
features yet. It is the production-safe path for large or specialized assets
that need a catalog/provenance record before a dedicated worker exists.

Supported `sourceFormat` values:

- `raster-cog`
- `stac`
- `wms`
- `sensor-feed`
- `mqtt`
- `http-json`
- `bim-package`
- `ifc`
- `cityjson`
- `3d-tiles`
- `shapefile`
- `geopackage`

Example body:

```json
{
  "providerId": "satellite-provider",
  "sourceFormat": "raster-cog",
  "sourceUri": "https://example.org/city/flood-depth.tif",
  "metadata": {
    "resolutionM": 10,
    "datetime": "2026-05-01",
    "bandMeaning": "flood depth meters"
  },
  "submittedBy": "platform-admin"
}
```

Current package behavior:

- validates the declared package format
- writes a completed ingestion run
- writes a completed layer ingestion job
- writes source metadata to `source_artifacts`
- writes or updates a catalog record in `dataset_catalog_records`
- updates the layer definition with latest package metadata
- extracts STAC through the dedicated STAC endpoint above
- extracts CityJSON through the dedicated CityJSON endpoint above
- queued package jobs extract or inspect package formats:
  - `shapefile`: native GDAL vector extraction into `city_features`
  - `geopackage`: native GDAL vector extraction into `city_features`
  - `ifc`: STEP metadata/property-set extraction, model-anchor feature, and
    indexed building/storey/space records when georeferenced
  - `raster-cog`: HTTP headers, content metadata, range-support warning
  - `wms`: GetCapabilities metadata and layer count
  - `http-json`: JSON shape and sample
  - `sensor-feed`: JSON shape and sample
  - `mqtt`: broker/topic registration for a future subscriber
  - `3d-tiles`: tileset metadata, root bounding volume, geometric error
  - `bim-package`: registration for mixed BIM archives; submit standalone IFC
    as `sourceFormat: "ifc"` for extraction
- Rich IFC operations are still pending; the current stack extracts metadata,
  property sets, spatial hierarchy, anchors, indexed BIM records,
  native-geometry inspection counts, raw mesh asset bundles, and a first
  Three.js viewer adapter.

## Admin UI

The `/admin` page now includes a provider-layer operations section:

- register provider and connector metadata
- register a provider layer for the active city
- ingest CSV, GeoJSON, or OGC Feature data into a selected layer
- inspect feature counts and latest ingestion-job status

## Production Boundary

The command center may use AI agents, emails, transcripts, planning docs, and
internal materials to build the product. Those materials are not production
provider layers.

Production provider layers must enter through the provider/layer/ingestion
contract above, with explicit provenance and access metadata.
