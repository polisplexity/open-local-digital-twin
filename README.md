# Open Local Digital Twin

Open Local Digital Twin is the public/open runtime extracted from the
Polisplexity Twin Base Studio work. It helps cities, universities, civic labs,
and public-interest technology teams build a local digital twin from public
data, preserve source evidence, attach provider or authority layers, and expose
standards-native city intelligence services.

The project is designed for practical Local Digital Twin adoption: start with a
public-data baseline, keep provenance explicit, connect additional layers
through stable APIs, and publish interoperable outputs through open standards.

## What This Runtime Provides

- A self-hosted Node.js / Next.js / Express application server.
- A PostgreSQL/PostGIS city twin store.
- Public-data ingestion workflows for city baselines.
- Separation between source evidence, consolidated inventory, inferred layers,
  provider layers, and city-authoritative layers.
- APIs for viewport features, vector tiles, twin queries, semantic packs, and
  city summaries.
- Standards-oriented exports and projections including DCAT, OGC API Features,
  NGSI-LD, and FIWARE-compatible workflows.
- Provider ingestion contracts for GeoJSON, CSV, OGC API Features/WFS, STAC,
  CityJSON, IFC/BIM metadata, Shapefile, and GeoPackage workflows.
- Privacy-aware aggregate social, cultural, environmental, and urban-science
  reporting patterns.

## Why It Exists

Most city digital twins fail before they become useful because they mix raw
source data, vendor layers, official city truth, dashboards, and operational
claims into one opaque system. Open Local Digital Twin takes a stricter public
infrastructure posture:

- open data is source evidence, not automatic truth;
- authority decisions are explicit and auditable;
- private or provider data stays separate from public baselines;
- city-scale rendering uses PostGIS, vector tiles, and bounded payloads;
- interoperability is generated from the city inventory instead of being bolted
  on later;
- no personal microdata is required for the public baseline.

## Intended Public-Good Boundary

This repository is the open local digital twin runtime and methodology. It does
not include private Polisplexity deployments, customer credentials, internal
operations, private city data, server secrets, or commercial support materials.

Polisplexity may maintain private deployments, paid services, hosted operations,
or proprietary extensions separately. Those private components are not required
to use the open runtime.

## Ownership

Open Local Digital Twin is owned and maintained by Polisplexity Ltd. Hadox
Research Labs and Nodo Guanajuato A.C. contribute research, civic technology,
and public-interest methodology around the open local digital twin direction.

See [OWNERSHIP.md](./OWNERSHIP.md).

## License

The code in this repository is licensed under the Apache License 2.0.

See [LICENSE](./LICENSE).

Documentation is also made available under the Apache License 2.0 unless a
file states otherwise.

## Digital Public Good Readiness

This repository is being prepared for Digital Public Goods Alliance review as a
digital public good candidate. The current public-good claim is not that every
private Polisplexity deployment is open. The claim is that this runtime,
documentation, standards model, and public-data methodology can be reused by
cities and public-interest teams.

See [DPG_READINESS.md](./DPG_READINESS.md).

## Privacy And Do No Harm

The default public-data baseline does not require personal microdata. The data
model keeps open sources, provider layers, and authority layers separate, and
the society/culture layer is designed around aggregate observations and
privacy posture metadata.

See [PRIVACY.md](./PRIVACY.md) and [DO_NO_HARM.md](./DO_NO_HARM.md).

## Install

```bash
git clone https://github.com/polisplexity/open-local-digital-twin.git
cd open-local-digital-twin
npm ci
cp .env.example .env
```

Required environment variables for a normal PostGIS deployment:

```bash
TWIN_STUDIO_DATABASE_URL=postgresql://user:password@host:5432/open_local_digital_twin
TWIN_STUDIO_SESSION_SECRET=<long-random-secret>
```

Run migrations:

```bash
npm run db:migrate
npm run test:ldt-schema-smoke
```

Run locally:

```bash
npm run dev
```

Run with Docker Compose:

```bash
docker compose up -d --build
curl -fsS http://127.0.0.1:4192/api/health
```

## Build A Public-Data City Baseline

For a supported city profile:

```bash
npm run db:ldt:reingest-open -- --city=<city-id>
npm run db:ldt:consolidate -- --city=<city-id>
npm run db:ldt:generate-interop -- --city=<city-id>
npm run db:ldt:refresh-viewer-aggregates -- --city=<city-id> --cell-size-m=2000
npm run db:ldt:generate-urban-science -- --city=<city-id>
npm run db:ldt:generate-society -- --city=<city-id>
npm run db:ldt:generate-semantic-packs -- --city=<city-id>
```

Validate:

```bash
npm run test:ldt-reingest-smoke -- --city=<city-id>
npm run test:ldt-consolidation-smoke -- --city=<city-id>
npm run test:ldt-interop-smoke -- --city=<city-id>
npm run test:ldt-viewer-aggregates-smoke -- --city=<city-id>
npm run test:ldt-urban-science-smoke -- --city=<city-id>
npm run test:ldt-society-smoke -- --city=<city-id>
npm run test:ldt-semantic-packs-smoke -- --city=<city-id>
```

## Main API Surface

Viewer/runtime:

```text
GET  /api/live/:cityId/base
GET  /api/live/:cityId/features?bbox=minLon,minLat,maxLon,maxLat&layers=buildings,roads
GET  /api/live/:cityId/tiles/:z/:x/:y.mvt
GET  /api/live/:cityId/layer-capabilities
GET  /api/live/:cityId/viewer-summary
GET  /api/live/:cityId/density-grid
GET  /api/live/:cityId/science/urban-report
GET  /api/live/:cityId/society/report
GET  /api/live/:cityId/twin-query-contract
POST /api/live/:cityId/twin-query
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
GET  /api/provider/v1/status
POST /api/provider/v1/cities/:cityId/layers/:layerKey/upload-intents
POST /api/provider/v1/cities/:cityId/layers/:layerKey/jobs
POST /api/provider/v1/fiware/observations
```

## Documentation

- [Open Source Installation Guide](./docs/OPEN_SOURCE_INSTALLATION_GUIDE.md)
- [Open Source Production Flow](./docs/OPEN_SOURCE_PRODUCTION_FLOW.md)
- [Product Architecture](./docs/PRODUCT_ARCHITECTURE.md)
- [LDT Native Standards Architecture](./docs/LDT_NATIVE_STANDARDS_ARCHITECTURE.md)
- [Provider Connector Contract](./docs/PROVIDER_CONNECTOR_CONTRACT.md)
- [Semantic Pack Standard](./docs/SEMANTIC_PACK_STANDARD.md)
- [Society and Culture Standard](./docs/SOCIETY_CULTURE_STANDARD.md)
- [Urban Science Standard](./docs/URBAN_SCIENCE_STANDARD.md)

## Security And Secrets

Do not commit:

- `.env` files;
- server credentials;
- database dumps;
- runtime auth tokens;
- private city or provider data;
- operator notes containing private commitments or partner context.

Use `.env.example` only as a template.

## Current Status

This is an early public release candidate. It is suitable for technical review,
DPG readiness review, local experimentation, and partner conversations. It is
not yet a certified operational platform for any public authority without local
security review, deployment review, and data-governance configuration.
