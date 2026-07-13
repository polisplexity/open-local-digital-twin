# EU LDT Toolbox Integration

OLDT supports configurable integration with EU LDT Toolbox deployments through standards-based profiles.

The integration is not hardcoded to one localhost install. Each target is registered as an integration profile with:

- platform kind: `data-platform`, `data-modeller`, `data-space-ready`, `city-innovation-planner`, `use-case-scenarios`, `play-visualise`, `marketplace-agent`, `marketplace-hub`, `oldt-provider`, or `other`
- base URL
- city mapping
- authentication mode
- headers
- endpoints
- declared capabilities
- last connectivity check

## Runtime Registry

Profiles are stored in:

```text
ldt_interop.eu_ldt_integration_profiles
```

Admin endpoints:

```text
GET  /api/admin/eu-ldt/integrations
POST /api/admin/eu-ldt/integrations
GET  /api/admin/eu-ldt/integrations/:profileKey
POST /api/admin/eu-ldt/integrations/:profileKey/test
```

The operator UI is available at:

```text
/operations/eu-ldt
```

## Local Profiles

The current local validation includes:

- `local-eu-ldt-data-platform`
- `local-eu-ldt-play-visualise`
- `local-eu-ldt-data-modeller`
- `local-eu-ldt-data-space-provider`
- `local-eu-ldt-data-space-consumer`
- `local-eu-ldt-city-innovation-planner`
- `local-eu-ldt-use-case-scenarios`
- configured Marketplace Agent and Hub profiles
- optional OIDC Identity Provider profiles, including the local EU LDT Keycloak

Profiles are checked from the OLDT server runtime. Local Docker deployments therefore use `host.docker.internal` for target URLs, while public/operator URLs can remain documented as `localhost`.

## Official Tool Inventory And Current Status

AI Notebook is one official tool with Kubeflow and GitLab entry points. The
status below describes the OLDT boundary, not whether every upstream screen is
convenient or production-ready.

| Tool | OLDT status | Accepted boundary |
| --- | --- | --- |
| Integrated Environment | Evaluated | Complete local launcher bundle inspected; no supported no-code arbitrary external-app registration was found. |
| Identity Management | End-to-end verified | Generic OIDC profile, real EU Keycloak login/callback/logout, and standalone regression passed 7/7. |
| Data Platform | End-to-end verified | Configurable NGSI-LD publish and readback, reused by model, CIP, and UCS workflows. |
| Use Case & Scenarios | End-to-end verified | Cases, scenarios, experiments, executions, external IDs, and returned worlds persisted in OLDT. |
| Play & Visualise | End-to-end verified | OLDT OGC/GeoJSON sources, layers, plot, report, readback, and failure isolation passed 6/6. |
| Marketplace | End-to-end verified | Two independent agents covered OAuth2, upload, publication, discovery, download, and isolation in 8/8 cases. |
| Data Modeller | End-to-end verified | Schema, fixture, generator execution, eight-row synthetic import, and provenance completed. |
| Data Space Ready | End-to-end verified | Provider/consumer EDC catalog, negotiation, transfer, receipt, byte count, and SHA-256 completed. |
| City Innovation Planner | End-to-end verified | Data Platform source, real KPI Consumer measurement, initiative link, OLDT synchronization, and indicator query path completed. |
| AI Notebook | End-to-end verified for the scenario path | UCS/Airflow invoked two real KServe inferences and OLDT persisted entity-level baseline/intervention worlds in 7/7 cases. |
| Participate | Future direct integration | Runtime and code evaluated; no privacy-governed OLDT participatory-asset round trip is accepted. |
| Federated Learning | Future direct integration | Flower server and two client APIs inspected; no OLDT model-training or inference cycle is accepted. |

The detailed user operations, local URLs, official repositories, data sent,
data received, evidence, and limitations are maintained in
`docs/USER_MANUAL.md` and the in-product `/docs` surface.

## Defensible Product Claim

OLDT integrates with EU LDT Toolbox deployments as a configurable
standards-compliant Local Digital Twin provider and consumer. The current
registry supports Data Platform, Data Modeller, Data Space Ready, Play &
Visualise, Marketplace, City Innovation Planner, and Use Case & Scenarios
targets using NGSI-LD, OGC Features, GeoJSON/CityJSON, EDC/DSP, ODRL,
DCAT-style manifests, governed KPI receipts, scenario-execution provenance,
and instance-specific authentication profiles. Generic OIDC profiles support
EU LDT Identity Management or another conforming provider, while the accepted
AI Notebook path is reached through the controlled UCS/Airflow/KServe scenario
workflow.

## Validation Boundary

Connectivity checks verify that configured services are reachable from the OLDT runtime and that declared endpoints respond as expected. They do not replace domain validation of model outputs, semantic mappings, or authority approval workflows.

Executable acceptance matrices for Play & Visualise, two-agent Marketplace,
Identity Management, and Use Case & Scenarios are documented in
`docs/EU_LDT_TOOL_ACCEPTANCE_MATRICES.md`. These suites persist case-level
evidence in `ldt_interop.eu_ldt_acceptance_runs` and
`ldt_interop.eu_ldt_acceptance_cases`; they are stronger than connectivity
checks because they create, consume, read back, validate, and isolate real
operations.

Identity Provider profiles are intentionally separate from the EU LDT endpoint
registry. They use standard OIDC discovery/JWKS and can point to EU LDT
Identity Management, a national identity service, a municipal Keycloak, or
another conforming provider without changing OLDT code. Standalone local auth
remains available.

Participate and Federated Learning are documented future boundaries. They are
not represented as integrated merely because their local services are running.
Integrated Environment is an evaluated launcher shell, not a data exchange.

## Data Space Ready Evaluation

The local EU LDT Data Space Ready deployment and its provider-to-consumer EDC cycle are documented in `docs/EU_LDT_DATA_SPACE_READY_LAB.md`.

That lab now proves both the external tool and the OLDT adapter. Workflow `eu-ldt-data-space-query-exchange` exports a bounded TwinQuery package, publishes it through a selected provider EDC, discovers and negotiates it from a selected consumer, transfers it to an OLDT-controlled receipt, and verifies byte count plus SHA-256.

The adapter remains optional. Missing or disabled data-space profiles fail only the selected exchange workflow and do not alter OLDT standalone startup, canonical data, queries, viewers, or standards endpoints.

## City Innovation Planner Evaluation

The bidirectional OLDT, Data Platform, and City Innovation Planner cycle is documented in `docs/EU_LDT_CITY_INNOVATION_PLANNER_INTEGRATION.md`.

It publishes a governed OLDT selection metric as NGSI-LD, lets the real CIP KPI Consumer calculate it, synchronizes the resulting measurement into OLDT, and stores CIP initiatives with explicit links to saved OLDT analytical selections.

## Use Case & Scenarios Evaluation

The baseline/intervention execution cycle is documented in
`docs/EU_LDT_USE_CASE_SCENARIOS_INTEGRATION.md`.

Workflow `eu-ldt-use-case-scenarios-roundtrip` publishes two comparable
NGSI-LD inputs through Data Platform, creates a complete UCS Case with two
Scenarios, executes both through Airflow and AI Notebook, and stores every
external resource ID plus effective output in OLDT.
