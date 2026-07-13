# EU LDT Data Modeller Scenario

Date: 2026-07-09

## Purpose

Validate a concrete OLDT <-> EU LDT Data Modeller loop:

1. OLDT identifies a data product needed for a city twin semantic layer.
2. Data Modeller stores and approves a schema for that data product.
3. Data Modeller generates synthetic sample data from the approved schema.
4. OLDT ingests the generated result as model outputs attached to real city entities.

This is an evaluation scenario, not an official municipal dataset.

## Running Services

```text
OLDT runtime: http://localhost:4292
Data Modeller frontend: http://localhost:4320
Data Modeller API: http://localhost:4321
Identity Manager: http://localhost:9080 / http://host.docker.internal:9080/realms/LDT
```

Login:

```text
user: <configured-local-admin>
password: <configured-local-password>
```

## What Data Modeller Does

Data Modeller is a schema and synthetic-data preparation tool. It is not the
city runtime and it is not the map viewer.

Observed capabilities from its OpenAPI surface:

```text
GET/POST /api/v1/schemas
PUT      /api/v1/schemas/{id}/approve
POST     /api/v1/schemas/{id}/export
GET      /api/v1/schemas/{id}/docker
POST     /api/v1/schemas/{id}/export-marketplace
POST     /api/v1/data-generator
POST     /api/v1/data-generator/insert
POST     /api/v1/data-generator/download
GET/POST /api/v1/datasources
POST     /api/v1/schema-imports/auto-model
```

Practical meaning:

- Define a schema for a data product.
- Approve it with a quality/evaluation score.
- Generate synthetic sample rows.
- Insert generated data into an external database.
- Export schema packages.
- Prepare Marketplace publication for approved schemas.

## Scenario

Scenario name:

```text
Guanajuato Road Risk Exchange 20260709165327
```

Data Modeller schema:

```text
id: 7a521555-15a6-489f-8583-e8bf6e53f6de
referenceName: guanajuato_road_risk_20260709165327
status: COMPLETED
evaluationScore: 92
isApproved: true
```

Schema meaning:

```text
scenario_id: fixed scenario identifier
risk_score: numeric score from 0 to 1
risk_label: synthetic-candidate
source_system: eu-ldt-data-modeller
```

Generated sample:

```text
risk_score values: 0.58, 0.74, 0.96, 0.22, 0.50
```

OLDT target:

```text
table: ldt_enrichment.entity_model_outputs
model_key: eu-ldt-data-modeller-road-risk
model_version: 1.0
output_key: road.risk_score
city_id: guanajuato
entity_type: road
rows inserted: 5
authority_status: simulated
confidence: synthetic
```

OLDT verification:

```text
model_key: eu-ldt-data-modeller-road-risk
output_key: road.risk_score
rows: 5
min_value: 0.22
max_value: 0.96
```

Example mapped roads:

```text
Overture road segment 13048 -> 0.96
Calle Ignacio Ramirez -> 0.74
Overture road segment 1195 -> 0.58
Overture road segment 10770 -> 0.50
Overture road segment 15961 -> 0.22
```

## Interpretation

This proves the basic value loop:

```text
OLDT city entities
  -> Data Modeller schema contract
  -> Data Modeller synthetic sample generation
  -> OLDT semantic/model-output layer
```

What passed:

- Data Modeller login through Identity Manager.
- Schema creation.
- Schema approval.
- Synthetic data generation.
- Attachment of generated values to real OLDT road entities.
- OLDT summary view/table recognizes the new model outputs.

What remained incomplete in this first manual scenario:

- The first run predated the dedicated OLDT workflow and therefore has no workflow artifact chain.
- No automatic standards refresh was run after ingest.
- Data Modeller `download`/`docker` endpoints returned an `Object reference` error in this local install and need separate diagnosis.

The missing OLDT workflow/UI was implemented and validated later in the same evaluation; see the section below.

## Integration Shape

Recommended product integration:

1. OLDT exports a candidate schema based on a query, model output contract, or semantic layer requirement.
2. Operator sends it to Data Modeller.
3. Data Modeller validates/approves the schema and generates sample data.
4. OLDT imports generated samples or approved schema metadata.
5. OLDT registers outputs under `ldt_enrichment.entity_model_outputs`.
6. Standards refresh exposes the result through OLDT model-output/standards surfaces.

## Implemented OLDT Integration

Implementation date: 2026-07-10.

Data Modeller is now an optional integration profile kind. No Data Modeller
profile is seeded by the migration, so OLDT still starts and runs standalone.
One or more instances can be registered from:

```text
OLDT -> Operations -> EU LDT -> Data Modeller profile
```

The workflow controls are available at:

```text
http://localhost:4292/operations/workflows
```

Implemented workflows:

```text
eu-ldt-data-modeller-prepare-schema
eu-ldt-data-modeller-fixture-import
```

Operational cycle:

1. Select a configured Data Modeller profile and OLDT entity type.
2. Create, approve, and execute the schema-preparation run in OLDT.
3. Open Data Modeller and evaluate/approve the generated schema.
4. Enter the approved schema UUID in OLDT.
5. Create, approve, and execute the fixture-import run.
6. Inspect the workflow trace and append-only model outputs in OLDT.

Safety boundary:

- OLDT never calls Data Modeller `/data-generator/insert` against its database.
- Canonical identities and geometries remain owned by OLDT.
- Generated values are written only to `ldt_enrichment.entity_model_outputs`.
- Every imported row uses `authority_status=simulated` and `confidence=synthetic`.
- The Data Modeller schema must have `isApproved=true` and meet the configured evaluation threshold.
- A missing, disabled, or unreachable profile fails only that workflow.

## Automated Round Trip Evidence

Deployed-runtime test:

```text
npm run test:eu-ldt-data-modeller-exchange-smoke -- --city=guanajuato
```

Verified result:

```text
profile: local-eu-ldt-data-modeller
profile checks: 1/2 passed; profile warning because /health body reports Unhealthy while OpenAPI and exercised schema/generator routes work
schema workflow run: ff71edaa-fff7-42cb-a2b6-0d1719bf4576
Data Modeller schema: ee18621d-155e-4f6d-914b-f99b6a64ddc9
evaluationScore: 92
isApproved: true
fixture workflow run: c0e0df88-4570-4dc2-a72f-b8f0a9edec46
generated/imported rows: 8
authority status: simulated
confidence: synthetic
source artifact links: 8/8
```

Failure-isolation result:

```text
workflow run: 8f1c3395-6b46-41f5-8917-b698766744b3
error: EU_LDT_PROFILE_NOT_FOUND
workflow status: failed
OLDT capability endpoint after failure: available
canonical OLDT entities after failure: 157535
```

This proves both modes:

- with Data Modeller: governed schema and fixture round trip;
- without a usable Data Modeller profile: OLDT remains operational and only the requested addon workflow fails.

## Implementation Files

```text
server/db/migrations/051_eu_ldt_data_modeller_exchange.sql
server/services/ldtOps/euLdtDataModellerService.mjs
server/services/ldtOps/euLdtDataModellerWorkflowService.mjs
server/services/ldtOps/euLdtIntegrationService.mjs
server/services/ldtOps/workflowContractsService.mjs
server/services/ldtOps/workflowService.mjs
server/tests/eu-ldt-data-modeller-exchange-smoke.mjs
src/components/twin-module/workspace/panels/OperationsEuLdtPanel.jsx
src/components/twin-module/workspace/panels/OperationsWorkflowsPanel.jsx
src/components/twin-module/workspace/panels/operations/useOperationsControl.js
```
