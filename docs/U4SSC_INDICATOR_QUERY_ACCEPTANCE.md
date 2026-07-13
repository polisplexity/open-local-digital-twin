# U4SSC Indicator Query Acceptance

Updated: 2026-07-12

## Purpose

This is the repeatable development acceptance suite for using every U4SSC
indicator in OLDT queries. It proves more than catalog import or API plumbing.
For each of the 91 indicators, the suite:

1. materializes an honestly grained development observation;
2. builds a non-trivial city-object query;
3. executes the structured Builder contract;
4. executes an equivalent full read-only PostGIS `SELECT`;
5. compares the complete matched object ID sets;
6. stores the tested query as a named preset;
7. publishes a coded NGSI-LD metric source to EU LDT Data Platform;
8. creates or reuses the matching U4SSC KPI and datasource in City Innovation
   Planner (CIP);
9. requests and verifies the real CIP KPI Consumer calculation; and
10. synchronizes the measurement into OLDT as both a receipt and a semantic
    indicator observation.

The suite is development evidence. It does not claim that Guanajuato has 91
official municipal measurements.

## Verified Result

The full run completed on 2026-07-12 against the local Guanajuato runtime.

| Gate | Result |
| --- | ---: |
| U4SSC catalog definitions | 91 |
| Persisted acceptance cases | 91 |
| Builder executions passed | 91 |
| Equivalent SQL executions passed | 91 |
| Builder/SQL object-ID equivalence | 91 |
| Data Platform publication and readback passed | 91 |
| CIP standard KPI calculation passed | 91 |
| CIP-to-OLDT semantic roundtrip passed | 91 |
| Failed indicators | 0 |

The full external synchronization workflow run was:
`cfd51109-f748-4fce-9317-067266f6a102`.

The deployed runtime image is:
`31-twin-base-studio-guanajuato-test:indicator-acceptance-20260712-r2`.
The Docker build ran `npm ci`, `npm audit --audit-level=low`, and `next build`;
the audit reported zero vulnerabilities.

## Development Dataset

The suite uses deterministic, visibly synthetic fixtures derived from the real
Guanajuato municipal boundary and existing open building footprints:

| Fixture | Count | Governance |
| --- | ---: | --- |
| Development buildings | 12 | `authority_status=development-synthetic` |
| Context subjects | 21 | 7 subject types x 3 zones |
| Seed observations | 382 | `validation_status=simulated` |
| Returned CIP indicators | 91 distinct indicator keys | `validation_status=lab` |

The seven context subject types are:

- `municipal-programme-area`
- `utility-service-area`
- `mobility-analysis-area`
- `environmental-analysis-area`
- `public-service-area`
- `population-statistical-area`
- `safety-analysis-area`

Fixture keys start with `dev:u4ssc:` or
`dev-u4ssc-acceptance:`. They carry `developmentSynthetic=true`, a test-suite
identifier, source provenance, and `standardValueIsNotOfficial=true`.
Cleanup only targets those prefixes. It does not delete municipal source data.

## Query Coverage

Every case combines physical-object attributes with an indicator condition.
The common physical filter is:

- semantic class `buildings`;
- at least three floors; and
- footprint area between 150 and 1,000 square metres.

The semantic pattern depends on the indicator's honest grain:

| Pattern | Cases | Expected objects per case |
| --- | ---: | ---: |
| Indicator attached to each building | 2 | 6 |
| Indicator attached to a related context area | 86 | 7 |
| City-wide binary or qualitative condition | 2 | 10 |
| Three-indicator related-area conjunction | 1 | 7 |

The compound case is `EN:EN:AQ:1C - Air pollution`. It returns buildings that
also lie in an environmental area where all of these thresholds hold:

- air pollution;
- GHG emissions; and
- noise exposure.

This proves the query requested by the product design: object properties plus
one or more indicators on a spatially or explicitly related subject.

## Builder Contract

Builder conditions support three kinds:

- `property`: allowlisted physical-object fields;
- `indicator`: an indicator on the object itself or on the city aggregate;
- `related-subject`: an area/cohort/service subject reached spatially,
  explicitly, or by either mode, with nested indicator predicates.

Nested related indicators support `AND` and `OR`. Indicator comparisons support
numeric, boolean, categorical, and ordinal values plus evidence filters for
validation and authority status.

The user-facing query surface intentionally exposes only **Builder** and
**SQL**. Context subjects remain a query capability, not a third top-level mode.

## Expert SQL Contract

Expert mode accepts a constrained, read-only full `SELECT`/`WITH` statement or
a legacy plain `WHERE` expression. The acceptance SQL reads only governed
`ldt_query` views and the canonical municipal boundary.

The important relational pattern is:

```sql
SELECT co.*
FROM ldt_query.city_objects_enriched co
WHERE co.city_id = 'guanajuato'
  AND co.semantic_class = 'buildings'
  AND co.floors >= 3
  AND co.footprint_area_m2 BETWEEN 150 AND 1000
  AND EXISTS (
    SELECT 1
    FROM ldt_query.subjects area
    WHERE area.city_id = co.city_id
      AND area.subject_type = 'environmental-analysis-area'
      AND ST_Intersects(ST_PointOnSurface(co.geom), area.geom)
      AND EXISTS (
        SELECT 1
        FROM ldt_query.indicator_subject_values value
        WHERE value.context_subject_id = area.context_subject_id
          AND value.indicator_key = 'u4ssc.en.en.aq.1c'
          AND value.value >= 31.5
          AND value.validation_status = 'simulated'
          AND value.authority_status = 'development-synthetic'
      )
  );
```

The production compiler parameterizes Builder values. Full SQL is protected by
the existing read-only allowlist and statement validator.

## Presets And UI

Acceptance rows are exposed through
`ldt_query.indicator_acceptance_presets` and merged into the normal query
library. The Analytical Map currently loads:

- 3 existing product presets;
- 91 U4SSC acceptance presets; and
- one empty selector option.

Each U4SSC preset stores:

- the Builder state;
- compiled TwinQuery JSON;
- equivalent SQL;
- expected, Builder, and SQL counts;
- matched object IDs;
- local, Data Platform, CIP, and roundtrip statuses; and
- workflow, entity, KPI, datasource, measurement, receipt, and observation IDs.

The verified UI flow is:

1. Open `http://localhost:4292/analytical-map`.
2. Select a `[U4SSC]` entry under **Saved preset**.
3. Inspect or modify it in **Builder**.
4. Run the query and inspect the features on the map.
5. Switch to **SQL** to inspect and execute the equivalent statement.

The compound air-pollution preset returned `7 buildings as tiles` and `7
features in view` in both modes.

## EU LDT Exchange Contract

Each case publishes a stable entity such as:

```json
{
  "id": "urn:ngsi-ld:KeyPerformanceIndicatorSource:guanajuato:u4ssc-ec-ict-ict-1c",
  "type": "KeyPerformanceIndicatorSource",
  "observedValue": { "type": "Property", "value": 42, "unitCode": "Percentage" },
  "indicatorCatalogKey": { "type": "Property", "value": "u4ssc" },
  "indicatorExternalCode": { "type": "Property", "value": "EC:ICT:ICT:1C" },
  "indicatorKey": { "type": "Property", "value": "u4ssc.ec.ict.ict.1c" },
  "sourceSystem": { "type": "Property", "value": "OLDT" }
}
```

CIP KPIs are created with:

- `u4sscStandard=true`;
- the exact `kpiU4SSCCode` from CIP's 91-row reference catalog;
- a broker datasource pointing to the stable Data Platform entity; and
- `calculationFormula=mean(U4sscValue)`.

Reruns first match by U4SSC code and reuse the KPI, datasource, binding, and
NGSI-LD entity. A second single-indicator run proved this idempotent path.

The evaluated CIP backend applies a global default rate limit of 100 requests
per minute. The OLDT client therefore spaces bulk acceptance requests by 750
ms and retries HTTP 429 and transient 5xx responses with bounded backoff. The
first unconstrained bulk attempt exposed this real product limit; the recovered
run completed all 91 without duplicate standard KPIs.

## Roundtrip Semantics

`eu-ldt-cip-sync-measurements` now performs two distinct writes:

1. an external receipt in `ldt_interop.cip_measurement_receipts`; and
2. when the binding contains an OLDT indicator key, a city-grain observation in
   `ldt_science.indicator_observations`.

Returned acceptance observations use:

- `value_kind=numeric` for the CIP transport value;
- `validation_status=lab`;
- `authority_status=integration-lab`;
- source references containing the CIP profile and measurement ID; and
- metadata containing U4SSC code, OLDT indicator key, KPI ID, binding, remote
  payload, and `standardValueIsNotOfficial=true`.

They are queryable but cannot satisfy strict municipal validation gates.

## Persistence

Migration `060_indicator_query_acceptance.sql` adds:

- `ldt_analysis.indicator_acceptance_cases`;
- `ldt_query.subject_relations`;
- `ldt_query.indicator_catalog`; and
- `ldt_query.indicator_acceptance_presets`.

Migration `061_u4ssc_indicator_acceptance_exchange.sql` records the U4SSC input
contract and semantic roundtrip output contract on the CIP workflows.

The acceptance implementation lives in:

- `server/services/indicatorAcceptance/indicatorAcceptanceService.mjs`
- `server/services/indicatorAcceptance/indicatorAcceptanceExternalService.mjs`
- `server/services/twinQuery/twinQueryCompiler.mjs`
- `server/services/ldtOps/euLdtCityInnovationPlannerService.mjs`
- `server/services/ldtOps/euLdtCityInnovationPlannerWorkflowService.mjs`
- `server/services/queryLibrary/indicatorAcceptancePresetService.mjs`

## Reproduction

This is an integration-lab acceptance suite, not a clean-install seed. Before running it, register the city and import the 91-row U4SSC catalog from a configured City Innovation Planner profile with `POST /api/admin/indicator-catalogs/import` and `adapterKey=cip-u4ssc`. A clean OLDT install intentionally includes the generic indicator framework but does not copy an external standards catalog or claim official city values.

Prepare fixtures and run all 182 local query executions:

```bash
npm run ops:prepare-u4ssc-acceptance
```

Repeat local acceptance without reseeding:

```bash
npm run ops:prepare-u4ssc-acceptance -- --skip-seed
npm run test:indicator-query-acceptance-smoke
```

Run the complete Data Platform/CIP/OLDT matrix:

```bash
npm run ops:prepare-u4ssc-acceptance -- --external-only --external-concurrency=2
```

Run one packaged external recovery/idempotency check:

```bash
U4SSC_EXTERNAL_ACCEPTANCE_LIMIT=1 \
  npm run test:indicator-external-acceptance-smoke
```

## Evidence Queries

Overall matrix:

```sql
SELECT
  count(*) AS cases,
  count(*) FILTER (WHERE local_status='passed') AS local,
  count(*) FILTER (WHERE data_platform_status='passed') AS data_platform,
  count(*) FILTER (WHERE cip_status='passed') AS cip,
  count(*) FILTER (WHERE roundtrip_status='passed') AS roundtrip
FROM ldt_analysis.indicator_acceptance_cases
WHERE city_id='guanajuato';
```

Inspect every preset and its external evidence:

```sql
SELECT
  external_code,
  indicator_key,
  query_pattern,
  builder_result_count,
  sql_result_count,
  data_platform_status,
  cip_status,
  roundtrip_status,
  external_evidence
FROM ldt_query.indicator_acceptance_presets
WHERE city_id='guanajuato'
ORDER BY dimension, subdimension, external_code;
```

The expected aggregate is `91 | 91 | 91 | 91 | 91`.
