# Open Local Digital Twin

Open Local Digital Twin (OLDT) is a self-hosted city digital twin runtime for
public-data baselines, governed city knowledge, spatial and contextual queries,
standards-based exchange, model outputs, and reusable municipal workflows.

It is the open runtime behind Polisplexity's Twin Base Studio work. Cities,
universities, civic labs, and public-interest technology teams can run it
standalone, connect their own identity and data services, and add optional EU
Local Digital Twin Toolbox integrations without surrendering the canonical city
record to an external platform.

## Try And Inspect

- Source: <https://github.com/polisplexity/open-local-digital-twin>
- Hosted demo endpoint: <https://twin.polisplexity.tech>
- User manual: [docs/USER_MANUAL.md](./docs/USER_MANUAL.md)
- Public installation guide:
  [docs/OPEN_SOURCE_INSTALLATION_GUIDE.md](./docs/OPEN_SOURCE_INSTALLATION_GUIDE.md)

The hosted demo and the source release have independent availability. A local
installation remains the reproducible acceptance path.

## Native Capabilities

- Node.js, Next.js, and Express application runtime.
- PostgreSQL/PostGIS canonical city store with versioned migrations.
- Public-data ingestion, provenance, consolidation, and semantic promotion.
- TwinQL Builder, CQL2-style filters, and guarded read-only SQL.
- Physical city entities plus contextual subjects, observations, relations,
  cohorts, administrative areas, and scenario worlds.
- Saved queries, query passports, reusable selections, and export manifests.
- MapLibre 2D, Cesium 3D, Civic XR, and Canvas comparison surfaces.
- Provider-neutral indicator and KPI catalogs, governed observations,
  thresholds, readiness checks, and U4SSC compatibility.
- Local, same-server, remote, offline, HPC, and cloud Data Factory handoffs.
- DCAT, NGSI-LD, OGC API Features, GeoJSON, CityJSON, and model-output
  interoperability paths.
- Standalone local authentication plus configurable OIDC identity providers.

## EU LDT Toolbox Compatibility

OLDT uses instance profiles instead of hardcoded laboratory URLs. A profile
selects a local, municipal, national, cloud, or partner deployment and keeps
credentials outside source control.

The 2026 local compatibility laboratory installed the complete 12-tool EU LDT
Toolbox bundle and exercised bounded end-to-end scenarios against OLDT. Nine
tools have an accepted OLDT scenario path; Integrated Environment was evaluated
as a launcher; Participate and Federated Learning remain explicit future direct
integrations.

| EU LDT tool | Current OLDT boundary |
| --- | --- |
| Identity Management | OIDC discovery, signed-token validation, role/city mapping, callback, logout, and standalone regression |
| Data Platform | Bidirectional NGSI-LD publish/readback through selectable profiles |
| Play & Visualise | OLDT selections registered and consumed as 2D/3D visual layers |
| Marketplace | Multiple configurable agents, offer publication, discovery, and download isolation |
| Data Modeller | Governed schema, generated fixture, and OLDT result import cycle |
| Data Space Ready | EDC-style package publication and consumer transfer evidence |
| City Innovation Planner | KPI measurement, initiative linkage, U4SSC catalog, and OLDT query reuse |
| Use Cases & Scenarios | Baseline/intervention orchestration and persisted scenario worlds |
| AI Notebook | Named KServe inference reached through the accepted UCS workflow |
| Integrated Environment | Evaluated launcher; no supported arbitrary-app registration API was found |
| Participate | Future privacy-governed participatory asset round trip |
| Federated Learning | Future model-training boundary through AI Notebook/Flower |

These are laboratory acceptance results, not certification of an external EU
service or authorization for production municipal decisions. See:

- [EU LDT integration boundary](./docs/EU_LDT_TOOLBOX_INTEGRATION.md)
- [Case-level acceptance matrices](./docs/EU_LDT_TOOL_ACCEPTANCE_MATRICES.md)
- [Identity provider profiles](./docs/IDENTITY_PROVIDER_PROFILES.md)
- [AI Notebook and UCS scenario](./docs/EU_LDT_AI_NOTEBOOK_UCS_INTEGRATION.md)

## Data And Governance Model

OLDT keeps distinct layers for source evidence, canonical entities, inferred
semantics, provider results, model/scenario outputs, and city-authoritative
decisions. External outputs do not silently become city truth. Promotion is an
explicit, auditable action.

The contextual subject architecture avoids forcing every indicator onto a
building or road. Population cohorts, service areas, administrative zones,
events, organizations, and scenarios remain queryable first-class subjects and
can still be joined spatially or relationally to physical entities.

- [Context subject query architecture](./docs/CONTEXT_SUBJECT_QUERY_ARCHITECTURE.md)
- [Indicator and KPI catalog](./docs/INDICATOR_KPI_CATALOG.md)
- [U4SSC query acceptance](./docs/U4SSC_INDICATOR_QUERY_ACCEPTANCE.md)
- [Twin query engine](./docs/TWIN_QUERY_ENGINE.md)

## Quick Start

Requirements:

- Docker Engine with Compose, or Node.js 22 plus PostgreSQL/PostGIS 16.
- At least 8 GB RAM for the basic local stack. City-scale ingestion and heavy
  model workflows need separate capacity planning.

```bash
git clone https://github.com/polisplexity/open-local-digital-twin.git
cd open-local-digital-twin
cp .env.example .env
docker compose up -d --build
curl -fsS http://127.0.0.1:4192/api/health
```

For a direct Node.js installation:

```bash
npm ci
npm run security:audit
npm run db:migrate
npm run build
npm run dev
```

Set at minimum:

```text
TWIN_STUDIO_DATABASE_URL=postgresql://user:password@host:5432/open_local_digital_twin
TWIN_STUDIO_AUTH_SECRET=<long-random-secret>
TWIN_STUDIO_ADMIN_EMAILS=<comma-separated-admin-emails>
```

The Compose file contains development-only defaults. Replace every password,
token, signing secret, and administrator list before any shared deployment.

## Main API Families

```text
/api/live/:cityId/*                    City, query, viewer, and standards APIs
/api/admin/*                           Governed workflows and operator controls
/api/provider/v1/*                     Provider ingestion and observations
/api/auth/*                            Local and OIDC authentication
/api/admin/eu-ldt/*                    Configurable EU LDT integration profiles
/api/live/:cityId/subjects/*           Context subject query APIs
/api/live/:cityId/world-comparisons/*  Reality and scenario comparison
```

The complete route and workflow guidance is maintained in the
[user manual](./docs/USER_MANUAL.md) and
[architecture index](./docs/ARCHITECTURE_INDEX.md).

## Public Export Boundary

This repository is generated through a repeatable allowlisted export. It does
not contain private deployments, runtime databases, city/provider private data,
credentials, internal operations, partner notes, or commercial support
materials. The export is independently scanned, installed, audited, built, and
tested before publication.

See [PUBLIC_EXPORT.md](./PUBLIC_EXPORT.md).

## Project Governance

- Apache License 2.0: [LICENSE](./LICENSE)
- Ownership and maintainers: [OWNERSHIP.md](./OWNERSHIP.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- Privacy posture: [PRIVACY.md](./PRIVACY.md)
- Do No Harm: [DO_NO_HARM.md](./DO_NO_HARM.md)
- Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Digital Public Good readiness: [DPG_READINESS.md](./DPG_READINESS.md)

## Release Status

Version 0.2.0 is a public technical release candidate. It is suitable for local
installation, source review, interoperability evaluation, and bounded partner
testing. Municipal production use still requires deployment hardening, local
data-governance approval, security review, capacity planning, and acceptance by
the responsible authority.
