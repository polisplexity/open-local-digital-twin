# Urban Science Standard

Updated: 2026-05-14

This is the first Twin Base Studio urban science standard. It turns the Local
Digital Twin inventory into reproducible city analysis, instead of leaving
indicators as UI-only numbers.

## Standard Identity

- standard key: `urban-science-core`
- version: `0.1.0`
- schema: `ldt_science`
- generator: `npm run db:ldt:generate-urban-science`
- report API: `/api/live/:cityId/science/urban-report`

## Purpose

The standard gives a city analyst a first scientific reading of the base twin:

- urban form and morphology;
- mobility network proxies;
- green-blue and land-use coverage;
- service/access seed density;
- open-source building coverage uplift;
- interoperability readiness.

It is not yet a calibrated predictive model. It is a reproducible baseline
analysis produced from the consolidated LDT inventory.

## Database Objects

Phase 7 extends `ldt_science` with:

- `indicator_definitions`
- `indicator_observations`
- `indicator_quality`
- `network_layers`
- `network_metrics`
- `simulation_models`
- `simulation_runs`
- `scaling_model_definitions`
- `scaling_model_fits`
- `scaling_residuals`
- `scenario_definitions`
- `scenario_inputs`
- `scenario_outputs`
- `model_calibrations`

The important rule is that every indicator must have:

- a definition;
- a unit;
- a model family;
- a method JSON;
- a city/geography level;
- a quality class;
- source-quality notes;
- an uncertainty field, even when uncertainty is only qualitative.

## First Indicator Set

The first city-level indicators are:

- `built_fabric_density`: buildings per km2.
- `building_footprint_intensity`: building footprint area as share of municipal
  area.
- `road_granularity`: road geometries per km2.
- `road_length_density`: road length per km2.
- `green_blue_coverage`: green-blue polygon area as share of municipal area.
- `land_use_coverage_gap`: municipal area missing thematic land-use or
  green-blue polygon coverage.
- `service_seed_density`: facility and place seeds per km2.
- `open_provider_building_uplift`: provider-only building candidates compared
  with base or matched buildings.
- `standards_projection_coverage`: consolidated entities projected to NGSI-LD.
- `boundary_compactness`: isoperimetric compactness of the municipal boundary.

## Model Families

Registered model families in Phase 7:

- descriptive indicator model;
- road network proxy model;
- service access seed model;
- urban scaling power-law definitions;
- network-density scaling definitions.

The scaling models are definitions only until the platform has comparable
multi-city population and indicator observations. A single city should not be
treated as calibrated Bettencourt-style evidence.

## Scenario Contracts

Registered scenario contracts:

- `service-access-baseline`: service reach once population, official services,
  and routable network inputs exist.
- `reconstruction-priority-seed`: reconstruction prioritization once damage,
  critical facilities, buildings, and access layers arrive.
- `provider-risk-overlay`: flood, fire, satellite, or emergency provider output
  attached as a semantic layer without replacing the base twin.

These are contracts, not completed operational simulations.

## Kharkiv Current Reading

The current Kharkiv report is useful for the meeting because it demonstrates
the analytical pipeline on a large Ukrainian city:

- 10 scientific indicator observations;
- 2 road-network proxy metrics;
- 1 idempotent baseline diagnostic run;
- quality notes flag the current road extraction as capped/partial;
- quality notes flag the building inventory as dominated by open-provider
  evidence pending authority validation.

This is exactly the distinction the product needs: the twin can analyze open
data now, while still being honest about source quality and authority status.

## Operation

Generate reports:

```bash
npm run db:ldt:generate-urban-science -- --city=kharkiv
```

Validate reports:

```bash
npm run test:ldt-urban-science-smoke -- --city=kharkiv
```

Read report through the live API:

```text
GET /api/live/kharkiv/science/urban-report
```

## Next Scientific Work

- Add official population or open population grid ingestion.
- Add subarea/district observations.
- Build a routable network graph instead of road geometry proxies.
- Add service-area accessibility calculations.
- Add comparable multi-city calibration for scaling models.
- Add uncertainty ranges once repeated extractions and official validation
  sources are available.
- Connect `ldt_society` observations so social, economic, and cultural analysis
  can be modeled alongside physical urban form.
