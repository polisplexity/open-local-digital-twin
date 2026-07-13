# OLDT Indicator Compatibility Framework

## What OLDT owns

OLDT is not tied to City Innovation Planner (CIP) or to U4SSC. It owns a
provider-neutral indicator layer that can register standards, city rankings,
sector catalogs, locally defined indicators, and KPI sets.

Indicator observations can now be attached to a physical entity, a canonical
context subject, or the city aggregate. Context subjects and portable semantic
queries are defined in `docs/CONTEXT_SUBJECT_QUERY_ARCHITECTURE.md`; this avoids
assigning demographic, health, governance, or election values to arbitrary
buildings solely to obtain geometry.

The framework keeps five concepts separate:

1. **Catalog**: a versioned collection such as U4SSC, ISO, a national ranking,
   or a municipal policy set.
2. **Definition**: meaning, unit, scope, formula, target, and visualization
   hints for one indicator or KPI.
3. **Requirement**: machine-readable evidence needed to calculate or accept the
   indicator for a particular city.
4. **Observation**: a numeric or JSON value at city, zone, selection, or
   canonical-entity level.
5. **Validation result**: a per-city explanation of whether the indicator is
   ready, partial, blocked, or not applicable.

External model outputs remain source evidence in
`ldt_enrichment.entity_model_outputs`. Governed indicator values live only in
`ldt_science.indicator_observations`; model evidence never silently becomes an
official indicator.

## CIP boundary

CIP has a U4SSC reference catalog, operational KPI definitions, formulas and
data sources, and time-stamped `KpiMeasurement` records. A synchronized CIP
measurement gives OLDT a specific value for an indicator at a given date. It
does not automatically provide per-building or per-zone values, and receipt
does not equal municipal validation.

The `cip-u4ssc` adapter reads the CIP reference catalog and registers it in
OLDT. Other adapters can import an equivalent JSON payload without CIP.

## Persistence

| Table | Responsibility |
| --- | --- |
| `ldt_science.indicator_catalogs` | Catalog identity, publisher, version and adapter |
| `ldt_science.indicator_catalog_memberships` | External code and taxonomy inside a catalog |
| `ldt_science.indicator_definitions` | Canonical OLDT definition, formula, target and source mode |
| `ldt_science.indicator_requirements` | Evidence rules used by the validator |
| `ldt_science.indicator_observations` | Current and historical governed values |
| `ldt_science.indicator_validation_runs` | Immutable validation execution per city and catalog |
| `ldt_science.indicator_validation_results` | Per-indicator state, score, evidence, gaps and warnings |
| `ldt_science.indicator_threshold_profiles` | Reusable thresholds for analytical queries |

The source modes are `manual`, `autonomous`, `computed`, `external`, and `cip`.
`kind=indicator` describes city state. `kind=kpi` additionally carries a target
and decision intent.

## Validation semantics

- `ready`: a validated governed value exists, or an executable OLDT formula has
  all required governed inputs.
- `partial`: candidate data or useful spatial evidence exists, but at least one
  required gate is still unresolved.
- `blocked`: the required value or calculation evidence is absent.
- `not-applicable`: an operator explicitly excludes the indicator for the city.

Readiness is not inferred from table row counts alone. The strict path requires:

- a non-test municipal boundary;
- canonical objects inside that boundary;
- accepted entity and observation authority;
- `validation_status=validated` for publishable values;
- no lab, smoke, synthetic, or simulated evidence in validated counts.

The accepted authority vocabulary currently includes `authority-approved`,
`municipal-provided`, `municipal-authoritative`, `operator-accepted`, `official`,
and `verified`.

## U4SSC snapshot

During the verified local run, the CIP adapter returned all 91 U4SSC records.
OLDT created 138 explicit requirements and validated them against the active
Guanajuato inventory:

| Result | Count |
| --- | ---: |
| Ready | 0 |
| Partial | 12 |
| Blocked | 79 |
| Validated city values | 0 |
| Map-queryable entity values | 0 |

This is the intentional, strict answer. Existing smoke and simulated records
are visible as evidence but do not inflate readiness.

## API

Authenticated city users can read catalogs and execute strict value queries:

```text
GET /api/live/current/standards/indicator-catalogs
GET /api/live/current/standards/indicator-thresholds
GET /api/live/current/standards/indicators/:indicatorKey/entity-values
```

The entity query accepts `comparison=gt|gte|lt|lte|eq|between|outside`, `value`,
optional `high`, optional `thresholdProfileKey`, and `limit`. By default it only
returns validated observations attached to approved canonical entities inside
the active municipal boundary.

Administrators can govern the framework:

```text
GET  /api/admin/indicator-catalogs?cityId=guanajuato
POST /api/admin/indicator-catalogs
POST /api/admin/indicator-catalogs/import
POST /api/admin/indicator-catalogs/:catalogKey/validate
POST /api/admin/indicators/:indicatorKey/observations
GET  /api/admin/indicator-thresholds?cityId=guanajuato
POST /api/admin/indicator-thresholds
```

U4SSC synchronization uses:

```json
{
  "cityId": "guanajuato",
  "adapterKey": "cip-u4ssc",
  "catalogKey": "u4ssc",
  "validate": true
}
```

A provider-neutral import uses `adapterKey=json` plus `catalogKey`, metadata,
and a `definitions` array. Each definition can carry its own `requirements`.

## Threshold query

Threshold profiles are city-specific and reusable. A profile does not change
the underlying value; it names a decision boundary such as "annual CO2e at
least 40" or "accessibility score outside 60-80".

Equivalent strict SQL must include both observation and entity governance, plus
the active municipal boundary. Consumers should use the API unless they need a
database-side analytical job.

## User workflow

1. Open **Standards > Indicator compatibility**.
2. Select or synchronize a catalog.
3. Run validation for the active city.
4. Review each indicator's missing evidence and readiness score.
5. Ingest or compute observations without promoting candidate data.
6. Validate approved observations.
7. Create threshold profiles and query matching canonical entities.

The same OLDT installation continues to work standalone. CIP, Data Platform,
or another catalog provider is an optional adapter, not a runtime dependency.

## Verification

The provider-neutral smoke test creates a temporary JSON catalog, a governed
entity observation, a validation run, a threshold profile, and a spatial query.
It verifies rejection of a falsely validated unreviewed value and removes all
test records afterward:

```bash
npm run test:indicator-framework-smoke
```

The older end-to-end CIP/Data Platform lab remains available through
`server/tests/indicator-catalog-smoke.mjs`. Its `.lab` observations are now
explicitly excluded from validated analytical queries.

## Development Query Acceptance

Strict readiness and development acceptance answer different questions. The
strict snapshot above remains `0` official ready values. Separately, the
development acceptance suite proves that all 91 catalog entries can participate
in Builder, SQL, Data Platform, and CIP workflows without pretending that the
fixture values are municipal facts.

The verified 2026-07-12 matrix is:

- 91/91 equivalent Builder and SQL result sets;
- 91/91 Data Platform publication/readback checks;
- 91/91 CIP KPIs linked to exact U4SSC codes and calculated by the real KPI
  Consumer; and
- 91/91 measurements synchronized into governed `lab` observations.

See `docs/U4SSC_INDICATOR_QUERY_ACCEPTANCE.md` for fixtures, query patterns,
rate-limit recovery, evidence SQL, and reproduction commands.
