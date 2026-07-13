# EU LDT AI Notebook, UCS, and OLDT Integration

## Status

Validated end to end in the Guanajuato laboratory on 2026-07-12.

This is not a mock-only or contract-only result. One saved OLDT building
selection was published to the local EU LDT Data Platform, consumed by EU LDT
Use Case & Scenarios (UCS), transformed by an Airflow DAG, inferred by a real
KServe V2 service in AI Notebook, persisted back into OLDT, and rendered as two
timestamped worlds in both Analytical Map and City 3D.

The model is a deterministic laboratory scenario model. The integration is
validated; the model is not presented as a scientifically validated municipal
energy model.

## Source Repositories

| System | Source |
| --- | --- |
| EU LDT AI Notebook | `https://code.europa.eu/ldt-toolbox/eu_ldt_ai_notebook` |
| EU LDT Use Case & Scenarios | `https://code.europa.eu/ldt-toolbox/eu_ldt_use_cases_and_scenarios` |
| OLDT local source | `<oldt-source>` |
| AI Notebook local source | `<eu-ldt-lab>/eu_ldt_ai_notebook` |
| UCS local source | `<eu-ldt-lab>/eu_ldt_use_cases_and_scenarios` |

## Local Surfaces

| Surface | Address |
| --- | --- |
| OLDT | `http://localhost:4292` |
| OLDT EU LDT operations | `http://localhost:4292/operations/eu-ldt` |
| OLDT Analytical Map | `http://localhost:4292/analytical-map` |
| OLDT City 3D | `http://localhost:4292/city-3d` |
| EU LDT Data Platform | `http://localhost/` |
| UCS | `http://localhost:5002` |
| UCS API | `http://localhost:3001` |
| Airflow | `http://localhost:8085` |
| AI Notebook / Kubeflow | `https://kubeflow.127.0.0.1.nip.io:4381/` |
| Local Identity Management | `http://localhost:9080/realms/LDT` |

## Complete Operational Cycle

```text
OLDT saved query / selection snapshot
  -> 300 canonical building IDs plus bounded attributes
  -> two NGSI-LD OldtScenarioDataset entities in Data Platform
  -> one UCS Case
  -> baseline and intervention Scenarios
  -> two Data Sources
  -> four visible UCS Parameters
  -> one visible UCS Transform DAG
  -> two Experiments and immutable Executions
  -> Airflow stages each Data Platform dataset
  -> KServe V2 model executes baseline and intervention
  -> UCS stores both execution results
  -> OLDT validates entity identity and comparable output tensors
  -> two ldt_science.simulation_runs
  -> 4,200 ldt_enrichment.entity_model_outputs
  -> Canvas compares reality snapshots and simulations
```

The two simulations use the same 300 canonical buildings. Only scenario
parameters differ. This prevents a false comparison caused by changing the
population between branches.

## What The User Does

### OLDT analyst

1. Runs a building query in Analytical Map or City 3D.
2. Saves the answer so it becomes a governed selection snapshot.
3. Starts `eu-ldt-use-case-scenarios-roundtrip` from EU LDT Operations.
4. Selects UCS, Data Platform, the saved selection, model, and scenario
   assumptions.
5. Approves and executes the workflow.
6. Sends the governed answer to **Canvas** from the query viewer, or opens
   Canvas directly after the workflow completes.
7. Selects any number of saved snapshots and simulation worlds.
8. Uses **Compare** for side-by-side worlds, **Overlay** for complementary
   layers, or **Delta** for baseline-to-intervention change.
9. Optionally intersects simulations with a saved query selection and filters
   by a numeric simulation output and threshold.

### UCS analyst

1. Opens the generated Case.
2. Reviews Scope, Problem, Objective, and Key Metric.
3. Reviews baseline and intervention Scenarios.
4. Inspects the Data Sources that point to the two Data Platform entities.
5. Inspects the four Parameters and the generated Transform DAG.
6. Reviews the two Experiment Executions and their effective outputs.

### Model operator

1. Confirms namespace `kubeflow-ldt-user`.
2. Confirms InferenceService `oldt-urban-energy-scenario` is Ready.
3. Reviews model version, KServe metadata, and request/response tensors.
4. Replaces the laboratory image with a governed model version when scientific
   validation is available; the OLDT/UCS transport contract remains stable.

## Model Contract

Model files:

```text
ops/eu-ldt/ai-notebook/urban-energy-scenario/Dockerfile
ops/eu-ldt/ai-notebook/urban-energy-scenario/server.py
ops/eu-ldt/ai-notebook/urban-energy-scenario/inferenceservice.yaml
ops/eu-ldt/ai-notebook/urban-energy-scenario/sample-request.json
```

Identity:

```text
namespace: kubeflow-ldt-user
model:     oldt-urban-energy-scenario
version:   0.1.0
protocol:  KServe V2
```

Entity inputs include stable entity ID, footprint area, storeys, and observed
energy when available. The workflow records assumption flags when storeys or
energy must be supplied by a laboratory default.

Entity outputs:

| Output key | Meaning |
| --- | --- |
| `baseline_energy_kwh` | Modelled baseline energy |
| `simulated_energy_kwh` | Scenario energy |
| `energy_delta_kwh` | Scenario minus baseline energy |
| `baseline_co2_kg` | Modelled baseline emissions |
| `simulated_co2_kg` | Scenario emissions |
| `co2_delta_kg` | Scenario minus baseline emissions |
| `assumption_flags` | Missing-data assumptions applied to the entity |

Visible UCS parameters:

| Parameter | Acceptance value |
| --- | --- |
| Energy intensity | `145 kWh/m2` |
| Retrofit savings fraction | `0.25` |
| Grid emission factor | `0.423 kgCO2/kWh` |
| Scenario year | `2030` |

## OLDT Persistence And Authority Boundary

Simulation identity and summaries are stored in:

```text
ldt_science.simulation_runs
ldt_science.simulation_run_inventory
```

Entity-level outputs are stored in:

```text
ldt_enrichment.entity_model_outputs
ldt_science.entity_simulation_outputs
```

Every output carries model/version, workflow run, simulation run, generated
time, source, warnings, and `authority_status = simulated`.

Canonical geometry is joined by entity ID at read time. The workflow never
creates a fake building and never overwrites an observed canonical property.
The verified canonical entity count remained `157547` before and after the
round trip.

## World Comparison Contract

Read APIs:

```text
GET /api/live/:cityId/simulation-worlds
GET /api/live/:cityId/simulation-worlds/:simulationRunId/geojson
GET /api/live/:cityId/analysis-selections/:selectionId/geojson
```

The viewer workspace accepts three world kinds:

- current query: live interpretation of the current canonical state;
- saved selection: timestamped materialized answer from a prior reality;
- simulation: timestamped, modelled values over canonical entity identity.

The compare control is inside Analytical Map and City 3D. It is not a new
primary menu module. MapLibre and Cesium consume the same world contract.

## Acceptance Evidence

Full acceptance command:

```text
npm run test:eu-ldt-ai-notebook-ucs-full-acceptance
```

World contract command:

```text
npm run test:world-comparison-smoke
```

Passing identifiers:

```text
acceptance_run_id: 05612221-4d58-40aa-9aed-f94d0f644fd6
workflow_run_id:   3408b477-4eb8-415e-81fb-f7b5e8d2f40c
ucs_case_id:       1ed69b47-4fcc-4fd9-9240-1c39c77c4a9f
selection_set_id:  60120d5c-225a-41bf-8a92-082b9d37ded8
baseline_run_id:   822d6a0b-a513-4e1d-8af9-3398b4674f42
intervention_id:   27c9e33c-17ba-4483-ac2f-f392a8da28c6
result:            7/7 passed
```

Measured evidence:

| Evidence | Result |
| --- | ---: |
| Entities per branch | 300 |
| Output keys per entity | 7 |
| Outputs per branch | 2,100 |
| Total persisted outputs | 4,200 |
| Baseline energy | 7,068,962.742550 kWh |
| Intervention energy | 5,301,722.056915 kWh |
| Baseline CO2 | 2,990,171.240093 kg |
| Intervention CO2 | 2,242,628.430072 kg |
| Reduction | 25% |
| Canvas Compare worlds | 2 x 300 |
| Canvas Delta entities | 300 |

Browser verification confirmed:

- Canvas defaults to the newest baseline/intervention pair and displays both
  simulation timestamps;
- Compare renders two worlds of 300 features each;
- Delta uses `simulated_co2_kg` and reports 300 decreased, 0 unchanged, and 0
  increased entities for the tested intervention;
- the numeric filter can reduce both worlds to zero without leaving stale
  semantic-class totals;
- a saved road snapshot can act as a selection mask, reducing both building
  simulation worlds to zero while retaining the 300 road features;
- Analytical Map, City 3D, and Civic XR expose no compare/overlay controller;
  Analytical Map and City 3D retain **Canvas** as a query-answer target.

## World Semantics Boundary

Simulation outputs are durable evidence, but they are not current city facts.
Migration `066_world_semantics_boundary.sql` enforces that distinction:

- `ldt_enrichment.entity_model_outputs` retains all simulation outputs;
- `ldt_enrichment.entity_model_output_current` excludes rows with a
  `simulation_run_id`;
- `ldt_query.city_objects_enriched` therefore cannot expose simulated values
  as current enrichment;
- new saved selections persist their geometry in
  `ldt_analysis.selection_set_members.geometry_snapshot`;
- older saved selections remain readable with explicit `current-fallback`
  geometry status instead of being misrepresented as historical geometry.

Verified state on the Guanajuato lab:

```text
simulation outputs preserved:       13600
simulation outputs in current view: 0
current entities with simulation:   0
canonical entities:                 157547
new snapshot geometry:              captured
```

Regression commands:

```text
npm run test:world-semantics-boundary-smoke
npm run test:world-surface-boundary-smoke
npm run test:world-comparison-smoke
```

## Known Issues And Repairs

### Namespace inventory warning

The UCS general `/api/v1/ai-notebook/namespaces` route can return HTTP 502 in
the local bundle. The configured model metadata and readiness endpoints work,
and the named model completed both real inferences. Acceptance therefore
records the inventory warning but requires readiness of the exact model.

### AI Notebook network policy

The upstream namespace policy blocked Kubernetes API access required by
Kubeflow components. The bundle allows TCP 6443 for the required control-plane
path. The KServe proxy remains authenticated; the namespace was not opened to
anonymous inference.

### Airflow-to-KServe network path

The workflow worker originally could not resolve the Kind control-plane name.
The authenticated KServe proxy now has a local-only NodePort (`31880`), and
both the UCS backend and Airflow join the external `kind` network in addition
to their normal networks. Airflow remains isolated from the UCS default
network, avoiding the duplicate `postgres` DNS name.

### Long-running token renewal

The first user JWT can expire while Airflow is waiting or retrying. The UCS
backend and Airflow now receive the `tool2-workflow` service-account settings
from private configuration. The DAG requests a fresh client-credentials token
when the user token is expired or close to expiry. OLDT also retries one UCS
request after refreshing its profile token. The refresh smoke confirms two
attempts and one refresh without storing a secret in source control.

### Shared workflow permissions

UCS writes generated DAGs and staged Data Platform payloads while Airflow reads
and updates the same host directories. The backend joins Airflow's shared
group, and `airflow-init` enforces group-write plus `setgid` on `dags` and
`data-stage`. A restart can no longer turn those paths into read-only inputs
for UCS.

### Service authentication and logs

UCS, Data Platform, and AI Notebook use the local Identity Management service
for machine-to-machine tokens. Proxy logs redact authorization, cookies, API
keys, and token-bearing query values. No secret is committed to this repo or
included in acceptance artifacts.

### Browser console warning

A load-time `MutationObserver` type error can recur in the browser session. No
`MutationObserver` call exists in OLDT application source. It did not prevent
Canvas, Analytical Map, City 3D, or Civic XR from reaching their verified
states. It remains recorded as a non-blocking browser/dependency warning
rather than being hidden or misreported as an OLDT simulation failure.

## Reproduction Preconditions

1. Data Platform, UCS, Airflow, Identity Management, and AI Notebook are up.
2. The specific KServe InferenceService is Ready.
3. OLDT has an enabled UCS profile and Data Platform profile.
4. Machine credentials are configured outside source control.
5. The saved selection contains canonical buildings with geometry.
6. The operator approves the external workflow run.

If any external profile is absent or disabled, OLDT remains standalone. Local
queries, saved answers, indicators, maps, City 3D, and canonical data continue
to work; only the selected external workflow becomes unavailable.
