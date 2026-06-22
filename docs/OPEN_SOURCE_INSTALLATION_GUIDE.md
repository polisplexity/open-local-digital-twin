# Open Source Installation Guide

Updated: 2026-05-23

This document is the installable open-source posture for Twin Base Studio. It
is intentionally separate from Hadox/Polisplexity internal command-center
operations.

## Target User

A city, university, civic lab, or provider should be able to install the
runtime, register a city, build an open-data base twin, and then attach
provider or authority layers through documented APIs.

## Runtime Components

Minimum self-hosted stack:

- Node.js application server
- PostGIS database
- runtime data volume for auth/session mirrors, source artifacts, and local
  package uploads
- optional provider ingestion worker

Recommended production stack:

- Node.js application server
- PostGIS database with backups
- worker process for provider ingestion jobs
- S3-compatible object storage for large BIM, raster, imagery, LiDAR, and
  package uploads
- optional FIWARE-compatible NGSI-LD broker such as Orion-LD or Scorpio
- reverse proxy with TLS

## Install

```bash
git clone <open-source-repository-url> twin-base-studio
cd twin-base-studio
npm ci
cp .env.example .env
```

Required environment variables for a normal PostGIS deployment:

```bash
TWIN_STUDIO_DATABASE_URL=postgresql://user:password@host:5432/twin_base_studio
TWIN_STUDIO_SESSION_SECRET=<long-random-secret>
```

For provider APIs:

```bash
TWIN_STUDIO_PROVIDER_API_TOKENS_JSON='[
  {
    "providerId": "example-provider",
    "tokenHash": "sha256_hex_hash",
    "scopes": ["provider:ingest", "provider:upload", "provider:read"]
  }
]'
```

## Database Bootstrap

```bash
npm run db:migrate
npm run test:ldt-schema-smoke
```

The LDT-native schema creates these durable boundaries:

- `ldt_core`: consolidated city inventory
- `ldt_catalog`: DCAT-style datasets and distributions
- `ldt_prov`: source features, evidence, matching, review, and lineage
- `ldt_interop`: DCAT, OGC, NGSI-LD, and policy projections
- `ldt_fiware`: broker connections, sync jobs, subscriptions, observations
- `ldt_science`: indicators, models, simulations, scenarios
- `ldt_society`: social, economic, and cultural observations
- `ldt_viewer`: summaries, density grids, vector/tile metadata
- `legacy`: compatibility views during migration

## Build A City From Open Data

For a supported city profile:

```bash
npm run db:ldt:reingest-open -- --city=<city-id>
npm run db:ldt:consolidate -- --city=<city-id>
npm run db:ldt:generate-interop -- --city=<city-id>
npm run db:ldt:refresh-viewer-aggregates -- --city=<city-id> --cell-size-m=2000
npm run db:ldt:generate-urban-science -- --city=<city-id>
npm run db:ldt:generate-society -- --city=<city-id>
npm run db:ldt:generate-semantic-packs -- --city=<city-id>
npm run db:ldt:generate-environmental-phenomena -- --city=<city-id>
npm run db:ldt:register-environmental-extractors -- --city=<city-id>
npm run db:ldt:run-terrain-dem -- --city=<city-id> --grid-resolution-m=250 --tile-zoom=13 --sample-offset-m=125 --concurrency=24
# Optional high-detail local/demo DEM:
npm run db:ldt:run-terrain-dem -- --city=<city-id> --grid-resolution-m=100 --tile-zoom=14 --sample-offset-m=50 --concurrency=32
```

The city base twin should treat open data as source evidence first, then create
a consolidated inventory. Source rows are not the final city truth by
themselves.

## Validate A City

```bash
npm run test:ldt-reingest-smoke -- --city=<city-id>
npm run test:ldt-consolidation-smoke -- --city=<city-id>
npm run test:ldt-interop-smoke -- --city=<city-id>
npm run test:ldt-viewer-aggregates-smoke -- --city=<city-id>
npm run test:ldt-urban-science-smoke -- --city=<city-id>
npm run test:ldt-society-smoke -- --city=<city-id>
npm run test:ldt-semantic-packs-smoke -- --city=<city-id>
```

## Run The App

Development:

```bash
npm run dev
```

Docker Compose:

```bash
docker compose up -d --build
curl -fsS http://127.0.0.1:4192/api/health
```

Local smoke user for development and route tests:

```bash
npm run dev:ensure-smoke-user -- --city=kharkiv
```

The default local/test smoke credentials are:

```text
TWIN_STUDIO_SMOKE_EMAIL=smoke@polisplexity.test
TWIN_STUDIO_SMOKE_PASSWORD=<set-local-smoke-password>
```

Override those environment variables for any shared test deployment. They are
not a production bootstrap account.

Provider worker:

```bash
npm run worker:provider-ingestion
```

## Core Open APIs

Viewer/runtime:

```text
GET /api/live/:cityId/base
GET /api/live/:cityId/features?bbox=minLon,minLat,maxLon,maxLat&layers=buildings,roads
GET /api/live/:cityId/tiles/:z/:x/:y.mvt
GET /api/live/:cityId/layer-capabilities
GET /api/live/:cityId/viewer-summary
GET /api/live/:cityId/density-grid
GET /api/live/:cityId/science/urban-report
GET /api/live/:cityId/society/report
GET /api/live/:cityId/twin-query-contract
POST /api/live/:cityId/twin-query
GET /api/live/:cityId/twin-query-tiles/:z/:x/:y.mvt?query=<encoded TwinQL/CQL2>
```

Standards:

```text
GET /api/live/:cityId/standards/dcat
GET /api/live/:cityId/standards/ngsi-ld/entities
GET /api/live/:cityId/standards/ogc
GET /api/live/:cityId/standards/ogc/collections
GET /api/live/:cityId/standards/ogc/collections/:collectionKey/items
```

Provider handoff:

```text
GET /api/provider/v1/status
POST /api/provider/v1/cities/:cityId/layers/:layerKey/upload-intents
POST /api/provider/v1/cities/:cityId/layers/:layerKey/jobs
POST /api/provider/v1/fiware/observations
```

## Data Ownership Rule

The open-source runtime should always distinguish:

- open source evidence;
- consolidated inventory;
- inferred semantic seeds;
- provider layers;
- city-authoritative layers;
- live context observations.

The UI can simplify this for analysts, but the database and APIs must keep the
distinction.

## Large City Rule

For large cities, do not send the full city as one JSON payload. Use:

- PostGIS as the full inventory store;
- viewport GeoJSON for inspection;
- vector tiles for dense map rendering;
- `ldt_viewer.city_summary_cache` for city-level indicators;
- `ldt_viewer.density_grids` for city-scale navigation;
- queued/tiled ingestion for heavy sources.

## Wiki Structure To Publish

Recommended GitHub wiki or docs structure:

1. What Twin Base Studio Is
2. Architecture And Data Model
3. Install With Docker
4. Create Your First City
5. Open Data Sources And Licenses
6. Consolidated City Inventory
7. Provider Layer API
8. Standards: DCAT, OGC API Features, NGSI-LD
9. FIWARE Integration
10. Viewer Performance For Large Cities
11. Backups, Upgrades, And Operations
12. Public/Private Data Boundary

## Not Open Source Runtime

The following are internal Hadox/Polisplexity operations and should not be
required to run the open-source product:

- `/home/hadox/ops-center`
- command-center migration ledgers
- AI/operator planning notes
- private email/transcript intelligence used to shape product direction
- production host credentials or secrets
