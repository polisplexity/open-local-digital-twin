# Open Source Production Flow

Twin Base Studio should be built as an open-source city digital twin runtime,
not as the internal Polisplexity command center.

## Product Promise

Any city should be able to start with a base twin from public data, then let
city teams and external providers attach new layers through stable APIs.

The base twin is the shared open-data foundation:

- city identity, boundary, and centroid
- roads
- buildings
- public facilities
- green-blue systems
- places and settlement anchors
- source artifacts and provenance

Provider layers extend that base without changing the core product:

- flood, fire, emergency, or climate-risk maps
- satellite imagery and STAC catalogs
- IoT streams and sensor feeds
- BIM, IFC, CityJSON, and 3D Tiles packages
- city-owned GeoJSON, CSV, OGC API Features, WFS, Shapefile, and GeoPackage data

## Production Runtime

The production runtime is:

- Next/Express application API
- PostGIS city twin store
- standards-native LDT schemas for core inventory, catalog, provenance,
  interop, FIWARE, science, society, and viewer aggregates
- provider/layer registry
- source-artifact provenance store
- queued ingestion jobs
- worker containers
- browser viewers that read cached summaries, density grids, viewport windows,
  vector tiles, and capped payloads from the stored full city

The internal command center is not part of the open-source runtime. It is only
for operator planning, AI-assisted building, inventories, and project memory.

## City Flow

1. Register the city.
2. Resolve and store the city boundary.
3. Build the open-data base twin from controlled public sources.
4. Persist all normalized features in PostGIS.
5. Store raw source artifacts for audit.
6. Register providers and connector contracts.
7. Queue provider ingestion jobs.
8. Workers validate, transform, and write layers into PostGIS.
9. A city admin accepts selected layers as city-authoritative when evidence is
   available.
10. Standards projections are generated for DCAT, OGC API Features, NGSI-LD,
    and optional FIWARE sync.
11. Viewer summaries and density grids are refreshed for large-city navigation.
12. Viewers and APIs read from the city twin store.

The browser should receive limited payloads for usability. The database should
hold the full usable city twin for the configured scope.

## Provider API

Provider integration is now separated from admin UI operations.

- `GET /api/provider/v1/status`
- `POST /api/provider/v1/cities/:cityId/layers/:layerKey/upload-intents`
- `POST /api/provider/v1/cities/:cityId/layers/:layerKey/jobs`

Provider API authentication uses bearer tokens configured through:

- `TWIN_STUDIO_PROVIDER_API_TOKENS`
- `TWIN_STUDIO_PROVIDER_API_TOKENS_JSON`

The JSON format is preferred for production:

```json
[
  {
    "providerId": "flood-map-provider",
    "tokenHash": "sha256_hex_hash",
    "scopes": ["provider:ingest", "provider:upload", "provider:read"]
  }
]
```

Raw tokens are accepted for local development, but production should use token
hashes. Scopes currently supported:

- `provider:ingest`
- `provider:upload`
- `provider:read`
- `provider:*`

## Upload Policy

The upload-intent endpoint creates a signed provider handoff envelope. In the
default self-hosted path, the response includes:

- `uploadUrl`: a signed `PUT` URL under `/api/provider/v1/uploads/:uploadId`
- `sourceUri`: a signed download URL that workers can read
- `requiredJobBody`: the package job body providers can submit after upload

The local adapter stores uploaded package bytes under
`runtime-data/provider-uploads`. This is suitable for development, small pilots,
and city-operated single-node deployments.

For large production deployments, configure external object storage with
`TWIN_STUDIO_UPLOAD_BASE_URL` and `TWIN_STUDIO_UPLOAD_SOURCE_BASE_URL`, and keep
PostGIS as the catalog/provenance/index store.

## City Authority

Open data is a strong starting point, but it should not silently become city
authority. A city admin can explicitly accept a layer as authoritative:

`POST /api/admin/cities/:cityId/layers/:layerKey/accept-authority`

Example body:

```json
{
  "acceptedBy": "city-gis-office",
  "evidenceUri": "https://city.example/datasets/official-boundary",
  "evidenceLabel": "Official GIS boundary publication",
  "note": "Accepted as the operational boundary for this deployment."
}
```

The production plan treats this as a documented authority decision and records
the acceptance metadata on the layer.

Binary object storage is intentionally separate from PostGIS:

- PostGIS stores features, layer metadata, provenance, validation reports, and
  source references.
- Object storage should store large rasters, imagery, LiDAR, BIM binaries, IFC,
  and other heavy packages.

## Full-City Size Strategy

Full city storage depends on feature count and heavy media layers.

Use `GET /api/admin/cities/:cityId/production-plan` to inspect:

- current stored feature count
- stored boundary count
- base-layer completeness
- city-authoritative layer acceptance
- provider-job activity
- estimated vector/index/source-artifact storage
- missing capabilities before a city is production-ready

The estimate intentionally excludes raw imagery, BIM binaries, and large raster
files because those should be stored as external objects with metadata and
footprints in PostGIS.

## Smoke Test

Run an end-to-end city smoke test against the configured PostGIS database:

```bash
npm run test:city-smoke -- --city=adazi
```

Run the LDT-native open-data and standards smoke path:

```bash
npm run test:ldt-schema-smoke
npm run test:ldt-reingest-smoke -- --city=adazi
npm run test:ldt-consolidation-smoke -- --city=adazi
npm run test:ldt-interop-smoke -- --city=adazi
npm run test:ldt-viewer-aggregates-smoke -- --city=adazi
npm run test:ldt-urban-science-smoke -- --city=adazi
npm run test:ldt-society-smoke -- --city=adazi
npm run test:ldt-semantic-packs-smoke -- --city=adazi
```

The test registers a provider, creates two layers, directly ingests GeoJSON,
queues and runs a CSV job, verifies both layers reached PostGIS, and builds the
city production plan.

Run the IFC/BIM smoke test:

```bash
npm run test:ifc-smoke -- --city=adazi
```

The IFC test registers a BIM provider, creates a BIM layer, ingests inline IFC
directly, queues the same IFC as a provider package job, extracts the model
anchor from `IfcSite`, indexes building/storey/space records at that model
anchor, verifies a space property set, verifies the `web-ifc` native-geometry
inspection, verifies the local mesh asset bundle manifest, verifies the BIM
payload, and verifies those BIM records reached PostGIS.

## Still Needed

- S3-compatible external object-storage adapter for large binary uploads
- rich IFC/BIM operations beyond the first municipal 3D viewer adapter: storey
  slicing, room polygon extraction, system extraction, element search, and
  model-to-city alignment
- LDES and RDF graph export if a federation partner requires them
- real Orion-LD or Scorpio deployment profile for FIWARE-compatible operations
- provider conformance test suite
- one complete city acceptance test with base twin, provider layers, worker,
  reports, and UI review
