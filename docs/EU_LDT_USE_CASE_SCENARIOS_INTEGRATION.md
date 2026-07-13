# EU LDT Use Case & Scenarios Integration

## Purpose

This document describes the installed EU LDT Use Case & Scenarios (UCS) tool,
the defects found while deploying it locally, and the configurable OLDT
integration that was validated end to end on 2026-07-12.

The original scalar-metric acceptance remains useful as a compatibility test.
The current authoritative entity-level acceptance, real AI Notebook model, and
2D/3D world comparison are documented in
`docs/EU_LDT_AI_NOTEBOOK_UCS_INTEGRATION.md`.

Official source:

```text
https://code.europa.eu/ldt-toolbox/eu_ldt_use_cases_and_scenarios
```

Local source and inspected revision:

```text
<eu-ldt-lab>/eu_ldt_use_cases_and_scenarios
834b2883f4cbe9d96b930594bb33a0e4e8c7e5af
```

## What The Tool Does

UCS is the experimentation and scenario-orchestration surface of the toolbox.
Its main domain chain is:

```text
Case
  -> Scope / Problem / Objective / Key Metric
  -> Baseline and intervention Scenarios
  -> Data Sources and Data Models
  -> Experiments
  -> immutable Experiment Executions
```

UCS does not replace a city data store, an AI notebook, or a workflow engine.
It coordinates those systems:

- EU LDT Data Platform supplies broker or Trino data sources.
- AI Notebook/KServe supplies model metadata, readiness, and inference.
- Airflow stages inputs and runs the experiment DAG.
- Keycloak supplies user and service identities.
- Kafka is used by the surrounding toolbox execution/event topology.
- PostgreSQL stores cases, scenarios, experiments, versions, and executions.

## Roles And User Operations

### City analyst

1. Creates a Case.
2. Describes its spatial scope, problem, objective, and key metric.
3. Creates baseline and intervention Scenarios.
4. Selects Data Platform sources and an AI model.
5. Creates and executes one Experiment per scenario.
6. Compares execution results and retains the evidence.

### Data and model operator

1. Makes the required entities available in Data Platform.
2. Verifies the selected scope, entity type, ID, and data mode.
3. Ensures the AI Notebook namespace/model is available and ready.
4. Diagnoses staging, Airflow, and inference failures.

### Platform administrator

1. Configures Keycloak clients, redirect URIs, audiences, and service roles.
2. Configures backend, Airflow, Data Platform, and AI Notebook URLs.
3. Maintains the shared staging volume and non-conflicting Docker networks.
4. Monitors dependency health, logs, storage, and database migrations.

## Installed Local Topology

| Component | Local address | Container |
| --- | --- | --- |
| UCS frontend | `http://localhost:5002` | `euldt-ucs-frontend-lab` |
| UCS backend | `http://localhost:3001` | `euldt-ucs-backend-lab` |
| UCS OpenAPI | `http://localhost:3001/documentation` | backend |
| UCS mocks / AI adapter | `http://localhost:3333` | `euldt-ucs-mocks-lab` |
| UCS PostgreSQL | `localhost:15432` | `postgres_tool_2` |
| Airflow API/UI | `http://localhost:8085` | `workflow-airflow-apiserver-1` |
| Identity Management | `http://localhost:9080/realms/LDT` | `euldt-im-keycloak-lab` |
| Data Platform API | `http://localhost:8080` | `compose-files-data-platform-backend-1` |

Local compose override:

```text
<eu-ldt-lab>/eu_ldt_use_cases_and_scenarios/docker-compose.local-lab.yml
```

Shared staging:

```text
host:    workflow/data-stage
UCS:     /mnt/shared/data-stage
Airflow: /opt/airflow/data-stage
```

## Correct Network Topology

Airflow must remain only on `workflow_default`. Attaching Airflow to the UCS
default network creates two DNS records named `postgres`; Airflow can then
resolve the UCS database instead of its own metadata database.

The working direction is the reverse:

```text
UCS backend
  -> UCS default network
  -> ldt-shared
  -> workflow_default

Airflow components
  -> workflow_default only
```

Airflow reaches the backend at:

```text
http://euldt-ucs-backend-lab:3001
```

## Authentication Contract

The working service account is the existing Keycloak client:

```text
tool2-workflow
```

Its token must contain:

- audience and `User` role for `tool2` so UCS accepts the token;
- audience for `tool0` so Data Platform accepts the forwarded token;
- the existing `tool6` and `tool6-backend` roles for Data Platform;
- the existing `kubeflow-oidc-authservice` roles for AI Notebook.

The secret is never committed. It is stored only in local runtime
configuration or in the private `auth_config` of an OLDT integration profile.
OLDT API responses redact it and expose only that a secret is configured.

## Defects Found And Repairs

### Partial database bootstrap

The first database had application tables but no migration metadata and every
domain table contained zero rows. It was backed up before repair:

```text
<eu-ldt-lab>/eu_ldt_use_cases_and_scenarios/artifacts/ucs-install/pre-repair-partial-db-20260712.dump
```

The empty partial database was recreated and all migrations/seeds completed.

### Backend image build

The upstream Dockerfile downloaded Puppeteer assets and recursively changed
ownership after copying the complete tree. The local repair:

- sets `PUPPETEER_SKIP_DOWNLOAD=true`;
- creates the application user before copy;
- uses `COPY --chown`.

The rebuild dropped from roughly 266 seconds to about 63 seconds.

### Data Platform scope handling

Raw tenant IDs such as `default` were incorrectly converted to `undefined`,
and the client used `reqScope` where Data Platform expects the `scope` header.
The Data Source service also split an already valid scope a second time.

The repaired services preserve raw tenant IDs and pass the full scope once.

### AI Notebook adapter

Namespace and model placeholders were not consistently interpolated. Mock
responses also did not match the backend schemas. The repair covers namespace
listing, namespace-filtered models, readiness, metadata, and inference.

### Airflow callback URL

The official workflow compose did not pass `BACKEND_BASE_URL` to Airflow, so
the DAG fell back to `host.docker.internal:3000`. The local compose now passes:

```text
BACKEND_BASE_URL=http://euldt-ucs-backend-lab:3001
```

### CSRF and service identity

The DAG obtained `/api/v1/csrf-token` with a client-credentials token. An
initial ad-hoc client lacked the `tool2` audience and role, causing HTTP 401.
The deployment now uses the official `tool2-workflow` client and its expected
cross-tool roles. CSRF remains enforced according to backend configuration;
the repair did not make authenticated routes public.

### Data Platform issuer and audience

The local Data Platform still expected tokens from
`https://im-int.ldttoolbox.app` while UCS used the local Keycloak issuer. Its
local `tools.env` now points to:

```text
OIDC_ENDPOINT=http://host.docker.internal:9080/realms/LDT
OIDC_ISSUER=http://host.docker.internal:9080
```

The `tool2-workflow` service account also has a `tool0` role, which makes the
token include the audience required by Data Platform.

### Globally unique UCS domain names

UCS enforces global uniqueness for names such as `case_scope.name`, even when
the records belong to different Cases. A second valid OLDT execution initially
failed with `case_scope_name_key` because the workflow reused the municipal
scope label. OLDT now appends the workflow-run suffix to Case, Scope, Problem,
Objective, and Key Metric names. Repeated comparisons no longer require
deleting prior UCS evidence.

## OLDT Integration

### Configurable profile

Platform kind:

```text
use-case-scenarios
```

Default local profile:

```text
local-eu-ldt-use-case-scenarios
```

Profiles can point to another local, national, municipal, or cloud UCS
deployment. URLs and authentication are not hardcoded in the workflow.

Operator surface:

```text
http://localhost:4292/operations/eu-ldt
```

The operator can:

1. save or test an OAuth2, bearer, or unauthenticated UCS profile;
2. choose a Data Platform profile;
3. enter a saved OLDT selection ID or an explicit baseline;
4. provide an intervention value or percentage change;
5. choose metric, unit, scope, AI namespace, and model;
6. run the comparison;
7. inspect persisted case, execution, and source IDs.

### Workflow

```text
eu-ldt-use-case-scenarios-roundtrip
```

The governed cycle is:

1. Resolve an OLDT saved selection or explicit scalar baseline.
2. In entity mode, materialize a bounded batch of canonical entities and their
   available attributes; record assumptions for missing inputs.
3. Publish two `OldtScenarioDataset` NGSI-LD entities to the selected Data
   Platform. Scalar compatibility mode still uses `OldtScenarioMetric`.
4. Create one UCS Case with Scope, Problem, Objective, and Key Metric.
5. Create and associate baseline and intervention Scenarios.
6. Create one Data Source, Data Model snapshot, and Experiment per scenario.
7. Create visible UCS parameters and a Transform DAG for entity mode.
8. Ask UCS to read both entities from Data Platform.
9. Execute baseline through Airflow and AI Notebook and wait for terminal
   output.
10. Execute intervention through the same path.
11. Persist external IDs, two simulation runs, and entity-level outputs in
    OLDT without mutating canonical city entities.

The workflow requires operator approval before execution and before its
evidence can support an interoperability claim.

### OLDT persistence

```text
ldt_interop.ucs_case_bindings
```

The table stores the OLDT selection, profiles, Case, both Scenarios, both
Data Sources, both Data Models, both Experiments, both Executions, values,
outputs, workflow run, and metadata.

State endpoint:

```text
GET /api/admin/eu-ldt/ucs/state?cityId=guanajuato
```

Migration:

```text
server/db/migrations/063_eu_ldt_use_case_scenarios_exchange.sql
server/db/migrations/065_eu_ldt_ucs_entity_simulation_contract.sql
```

## Acceptance Evidence

Scalar compatibility command:

```text
npm run test:eu-ldt-use-case-scenarios-acceptance
```

Full entity-level command:

```text
npm run test:eu-ldt-ai-notebook-ucs-full-acceptance
```

Passing full acceptance:

```text
acceptance_run_id: 05612221-4d58-40aa-9aed-f94d0f644fd6
workflow_run_id:   3408b477-4eb8-415e-81fb-f7b5e8d2f40c
case_id:           1ed69b47-4fcc-4fd9-9240-1c39c77c4a9f
result:            7/7 passed
```

Actual entity comparison:

```text
entities per branch:     300
outputs per branch:      2100
baseline energy:         7068962.742550 kWh
intervention energy:     5301722.056915 kWh
baseline CO2:            2990171.240093 kg
intervention CO2:        2242628.430072 kg
change:                  -25 percent
```

Acceptance cases:

1. The named KServe model is available and Ready.
2. Data Platform stores both distinct NGSI-LD entity datasets.
3. UCS stores the Case, two branches, visible Parameters, and Transform DAG.
4. Airflow and KServe complete both real executions.
5. OLDT persists two simulation runs and 4,200 entity outputs.
6. Energy, CO2, timestamps, entity identity, and expected reduction agree.
7. Canonical city entity count is unchanged.

Operational regressions exercised by the final acceptance included Kind DNS
reachability from Airflow, service-account token renewal after JWT expiry, and
shared DAG/staging ownership after `airflow-init`. All three are now part of
the reproducible local configuration rather than one-off container changes.

## OLDT World Consumption Contract

UCS results return to OLDT as explicit simulation worlds. They do not enter the
current-reality enrichment view and do not overwrite canonical city entities.

The user-facing responsibility split is:

| Surface | Responsibility |
| --- | --- |
| Analytical Map | Author and inspect one current query answer; save it or send it to Canvas. |
| City 3D | Inspect one current query answer in Cesium; save it or send it to Canvas. |
| Civic XR | Explain one current query answer in an immersive view. |
| Canvas | Compose saved snapshots and simulation worlds using Compare, Overlay, Delta, selection masks, and numeric output filters. |

Canvas can query an arbitrary number of available worlds. Delta requires two
simulation worlds and compares matching canonical entity IDs. A saved query
can be activated as a selection mask, so a complex TwinQL answer defines which
simulation entities remain eligible. This keeps query authoring separate from
multi-world interpretation without losing composability.

New saved selections capture their exact geometry. Legacy selections are
still readable, but their geometry is labelled `current-fallback` because the
older rows stored identity and attributes rather than a historical geometry
snapshot.

## Security And Dependency Status

OLDT final Docker build gate:

```text
npm ci:    703 packages audited
npm audit: 0 vulnerabilities
build:     passed
```

The inspected UCS backend install reported 5 low and 4 moderate npm findings.
The inspected mocks dependency tree also reported high findings in its older
Fastify tree. Those are upstream-tool risks and must not be hidden by applying
`npm audit fix --force`. They require dependency-by-dependency remediation and
full UCS regressions.

## Honest Validation Boundary

The local `oldt-urban-energy-scenario` is a real KServe execution, not an echo
response. It proves transport, orchestration, parameterization, entity identity,
persistence, and viewer consumption. It does not prove scientific model
quality, causal policy impact, or municipal authority. Outputs are explicitly
marked `simulated` and remain separate from observed canonical state.

OLDT remains standalone when the UCS profile is missing, disabled, or broken.
Only the selected UCS workflow fails; local auth, PostGIS, queries, maps, City
3D, Civic XR, standards, and other integration profiles continue to operate.
