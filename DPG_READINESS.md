# Digital Public Good Readiness

This document maps Open Local Digital Twin to the Digital Public Goods Alliance
review indicators.

## 1. SDG Relevance

The project supports public-interest digital infrastructure for cities and
communities. Relevant SDG areas include:

- SDG 9: industry, innovation, and infrastructure;
- SDG 11: sustainable cities and communities;
- SDG 13: climate action;
- SDG 16: effective, accountable, and transparent institutions;
- SDG 17: partnerships and interoperable implementation.

## 2. Open Licensing

The repository is licensed under Apache-2.0.

See [LICENSE](./LICENSE).

## 3. Clear Ownership

The open runtime is owned and maintained by Polisplexity Ltd, with research and
methodology contributions from Hadox Research Labs and Nodo Guanajuato A.C.

See [OWNERSHIP.md](./OWNERSHIP.md).

## 4. Platform Independence

The default runtime is self-hosted and based on open or widely adopted
components:

- Node.js / Express / Next.js;
- PostgreSQL / PostGIS;
- Docker Compose;
- MapLibre;
- open standards including DCAT, OGC API Features, NGSI-LD, and FIWARE-style
  context workflows.

Closed provider data, hosted services, commercial deployments, or proprietary
extensions are optional and are not required for the public-data baseline.

## 5. Documentation

Core documentation:

- [README.md](./README.md)
- [docs/OPEN_SOURCE_INSTALLATION_GUIDE.md](./docs/OPEN_SOURCE_INSTALLATION_GUIDE.md)
- [docs/OPEN_SOURCE_PRODUCTION_FLOW.md](./docs/OPEN_SOURCE_PRODUCTION_FLOW.md)
- [docs/PRODUCT_ARCHITECTURE.md](./docs/PRODUCT_ARCHITECTURE.md)
- [docs/LDT_NATIVE_STANDARDS_ARCHITECTURE.md](./docs/LDT_NATIVE_STANDARDS_ARCHITECTURE.md)
- [docs/PROVIDER_CONNECTOR_CONTRACT.md](./docs/PROVIDER_CONNECTOR_CONTRACT.md)
- [docs/SEMANTIC_PACK_STANDARD.md](./docs/SEMANTIC_PACK_STANDARD.md)
- [docs/SOCIETY_CULTURE_STANDARD.md](./docs/SOCIETY_CULTURE_STANDARD.md)
- [docs/PUBLIC_DEMO_CITY_BASELINE.md](./docs/PUBLIC_DEMO_CITY_BASELINE.md)
- [docs/DPG_SUBMISSION_EVIDENCE.md](./docs/DPG_SUBMISSION_EVIDENCE.md)

## 6. Data Extraction

The runtime exposes non-personal city baseline data and generated projections
through APIs and non-proprietary formats, including:

- GeoJSON;
- Mapbox Vector Tiles;
- JSON / JSON-LD;
- DCAT;
- OGC API Features;
- NGSI-LD entity projections;
- provider handoff APIs.

## 7. Privacy And Applicable Laws

The public baseline does not require personal microdata. Deployments that add
private or personal data must configure lawful access, retention, and
publication controls.

See [PRIVACY.md](./PRIVACY.md).

## 8. Standards And Best Practices

The runtime is designed around:

- DCAT and DCAT-style catalog metadata;
- OGC API Features;
- NGSI-LD / Smart Data Models direction;
- FIWARE-compatible context broker workflows;
- provenance and source-quality records;
- explicit license and attribution metadata;
- PostGIS-backed geospatial storage;
- bounded payloads and vector tiles for large city rendering.

## 9. Do No Harm By Design

The project distinguishes open evidence, inferred results, provider layers, and
city-authoritative decisions. It avoids treating open data or AI inference as
official truth without review.

See [DO_NO_HARM.md](./DO_NO_HARM.md).

## Community, Security, And Review

- Public repository URL:
  https://github.com/polisplexity/open-local-digital-twin
- Public release:
  https://github.com/polisplexity/open-local-digital-twin/releases/tag/v0.1.0
- Security policy:
  [SECURITY.md](./SECURITY.md)
- Contribution guide:
  [CONTRIBUTING.md](./CONTRIBUTING.md)
- Code of conduct:
  [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Public issue templates:
  [.github/ISSUE_TEMPLATE](./.github/ISSUE_TEMPLATE)
