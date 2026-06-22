# UI And Observability Rebuild Plan

Updated: 2026-05-17

The current UI should be treated as under construction while the data layer,
API contracts, and viewer architecture are hardened. The goal is not to keep
adding controls to the current cockpit. The goal is to expose the product that
already exists in the database: a standards-native open city twin with source
evidence, consolidated inventory, provider layers, scientific indicators,
semantic packs, and interoperability outputs.

## Product Position During Rebuild

The UI should explicitly communicate:

- the platform is in construction,
- the data layer is becoming production-grade before analytics are expanded,
- some cities have strong base coverage while others have partial open-data
  coverage,
- source evidence and authority validation are different things,
- semantic packs are service logic and workflows, not magic city truth.

## Rebuild Principle

Every route should consume one city capability contract:

```text
city
capabilities
datasets
consolidatedEntities
viewerAggregates
scienceIndicators
societyCulture
semanticPacks
standards
fiware
providerLayers
jobs
apiVersions
observability
```

The UI should not ask each viewer to discover this independently. The same
contract should power the map, 3D, immersive, indicators, semantic-pack,
sources, and standards surfaces.

## Target UI Modules

1. **Overview**
   - city status
   - data readiness
   - open-data coverage
   - missing source warnings
   - current construction state

2. **Map**
   - primary analytical map
   - consolidated base inventory
   - provider layers
   - inferred seeds
   - selected-feature inspection
   - source/provenance link-out

3. **3D**
   - municipal validation view
   - buildings, roads, BIM anchors, 3D packages
   - fewer controls than the map
   - same city capability contract as the map

4. **Immersive**
   - public/stakeholder story mode
   - simplified public-safe explanation
   - no advanced source or admin controls by default

5. **Indicators**
   - `ldt_viewer` cached summaries
   - `ldt_science` observations
   - `ldt_society` aggregate observations
   - quality flags and uncertainty visible

6. **Semantic Packs**
   - `reconstruction-service-core`
   - future flood, fire, waste, mobility, planning/BIM, and public-service packs
   - pack rules, required data, blocked claims, workflows, and exports

7. **Sources And Evidence**
   - datasets
   - source features
   - source quality
   - matching/conflict evidence
   - review and authority decisions

8. **Interoperability**
   - DCAT
   - OGC API Features
   - NGSI-LD
   - FIWARE sync
   - future LDES/RDF/GeoPackage where needed

9. **API Operations**
   - API catalog
   - endpoint status
   - versioning
   - usage metrics
   - API tests/explorer
   - ingestion and sync jobs

## Observability And API Governance Stack

### Metrics And Dashboards

Open-source core baseline:

- `ldt_ops.api_usage_events` records request ID, route family, method, route
  template, status, latency, city, role, version, consumer key, and errors.
- `/api/live/current/operations/metrics-summary` publishes JSON metrics for
  request count, latency, error rate, city inventory, ingestion jobs, workflow
  runs, and approval queues.
- `/cockpit?module=operations` consumes the same JSON summary so the default
  city install only requires the application and PostGIS.

Optional operator pack:

- Prometheus-compatible metrics endpoint over the same `ldt_ops` and runtime
  counters.
- Grafana dashboards for:
  - API usage by city,
  - slow endpoints,
  - failing endpoints,
  - viewer endpoint load,
  - provider ingestion jobs,
  - FIWARE sync jobs,
  - database health,
  - worker health,
  - data refresh freshness.

Grafana should not become the city analyst UI and should not be required for a
small city installation. It is an optional operator/engineering observability
layer.

### Logs And Traces

Recommended baseline:

- structured JSON logs with request IDs,
- OpenTelemetry traces for live viewer requests, ingestion jobs, standards
  exports, and FIWARE syncs,
- Loki or another log backend later if the VPS/runtime needs centralized logs.

### API Explorer And Contract Testing

Recommended baseline:

- OpenAPI 3.1 document generated or maintained from the Express routes.
- Scalar or Swagger UI/ReDoc as an authenticated API explorer, similar in spirit
  to Django REST Framework's browsable API.
- Schemathesis or Dredd-style contract tests later, after the OpenAPI contract
  is stable.
- Versioned API surface:
  - `/api/live/v1/...`
  - `/api/admin/v1/...`
  - `/api/provider/v1/...`
  - keep current non-versioned routes as compatibility aliases during the
    transition.

### API Gateway Decision

Do not add a full API gateway immediately unless deployment requirements force
it. The first production step should be app-native metrics and OpenAPI docs.

Possible future gateway options:

- Kong Gateway
- Apache APISIX
- Gravitee
- Tyk

Use a gateway when we need external developer access, rate limiting, API keys,
tenant isolation, and public partner onboarding. Until then, adding a gateway
would create operational complexity before the contracts are stable.

## Required Data Engineering Before Analytics

1. Create a city capability API that reads from LDT-native schemas.
2. Make UI pages consume `ldt_core`, `ldt_catalog`, `ldt_prov`, `ldt_viewer`,
   `ldt_science`, `ldt_society`, `ldt_semantic`, `ldt_interop`, and
   `ldt_fiware` through explicit APIs.
3. Stop using `public.city_features` as the product truth. Keep it as a
   compatibility layer until the UI is fully migrated.
4. Add data freshness and source-quality summaries per city.
5. Add API usage metrics before increasing public/provider API exposure.
6. Add versioned API docs before presenting this as open-source installable
   infrastructure for cities.

## First Implementation Phases

### Phase 1: Data Capability And Inventory API

- Add `/api/live/:cityId/capabilities`.
- Include available modules, source coverage, loaded datasets, entity counts,
  standards outputs, semantic packs, science indicators, society indicators,
  FIWARE state, provider layers, BIM/raster/3D capabilities, and warnings.
- Use this endpoint to drive construction-state UI.

### Phase 2: API Observability Foundation

- Add request middleware with request ID, route family, method, status, latency,
  city ID, user role, and error code.
- Store short-term API events in Postgres.
- Add `/api/live/current/operations/metrics-summary` as the app-native JSON
  metrics contract.
- Keep `/metrics` scraping and Grafana dashboard JSON as optional ops-pack work,
  not the default open-source install path.

### Phase 3: OpenAPI And API Explorer

- Add OpenAPI 3.1 specification for live, admin, provider, standards, FIWARE,
  science, society, and semantic-pack endpoints.
- Add an authenticated docs/explorer page.
- Mark unstable endpoints clearly.
- Introduce `/v1` route aliases.

### Phase 4: UI Recomposition

- Replace the current page-first viewer layout with a city workspace shell.
- Expose phases 4-9 as visible modules, not hidden APIs.
- Keep map, 3D, and immersive as viewer surfaces inside the same city workspace.

### Phase 5: Visual Surfaces Rebuild

This is now the next product phase after API governance hardening.

The map, 3D, and immersive views must stop behaving like three independent
experiments. They should consume the same city contracts and differ only by
audience and visualization mode:

- common inputs:
  - `/api/live/current/capabilities`
  - `/api/live/current/viewer-summary`
  - `/api/live/current/layer-capabilities`
  - bounded viewer feature APIs / vector tiles
  - semantic-pack reports where a view needs domain meaning
- common concepts:
  - base inventory,
  - provider layers,
  - inferred seeds,
  - semantic packs,
  - source/provenance evidence,
  - authority status,
  - construction state.

Analytical map:

- primary analyst surface,
- city-scale coverage control and bounded feature loading,
- clear layer families instead of raw source-provider toggles,
- selected-feature inspection with provenance and semantic context,
- indicator/evidence panel that helps a city analyst decide what to review.

Municipal 3D:

- validation surface for municipal teams,
- base buildings/roads/terrain context plus BIM/provider anchors,
- stable loading/error states,
- lower feature density than the map,
- selection inspection that exposes whether the selected object is base,
  provider-supplied, inferred, or semantic-pack derived.

Public immersive:

- stakeholder/public story surface,
- public-safe language and simplified controls,
- no admin or advanced provenance controls by default,
- honest distinction between known open data, inferred context, and pending
  authority validation.

Acceptance criteria:

- Kharkiv loads without blank/black long-running viewer states.
- Large-city views never attempt to push the full city inventory into the
  browser at startup.
- The three surfaces share one conceptual layer model.
- Visual failure states are visible and actionable.
- Desktop/laptop visual checks cover Kharkiv and the preserved Ādaži dump.

Initial implementation:

- `/cockpit` now starts Phase 11 as a contract-driven Kharkiv LDT workspace.
- `/cockpit` keeps Analysis/Cockpit as the parent product surface. Inventory,
  Sources, Standards, Science + Society, Semantic Packs, and Operations are
  internal cockpit modules, not top-level app surfaces.
- `/api/live/current/operations/report` is now the first operations contract:
  it combines the canonical API catalog, API usage events, ingestion jobs,
  workflow runs, pending approvals, readiness checks, and usage gaps. The
  Operations module consumes this report as a lightweight API/governance
  explorer.
- `/api/live/current/openapi.json` is now the first OpenAPI 3.1 publication
  contract for the single-city runtime. It is generated from the same operations
  catalog, keeps city/admin routes session-scoped, and is displayed inside the
  Operations module.
- `/api/live/current/operations/metrics-summary` is now the app-native
  observability contract. It keeps the default open-source stack light while
  still making API health, ingestion health, workflow health, and inventory
  counts available to operators, UI modules, and agents.
- The cockpit consumes `/api/live/current/capabilities` for readiness, module
  availability, indicators, and gaps.
- The cockpit now exposes the capability contract through visible modules:
  Overview, Inventory, Sources/Evidence, Standards, Science/Society, Semantic
  Packs, and Operations.
- Module navigation now belongs to the primary workspace rail. The secondary
  rail is a control surface for refresh, readiness, capability-contract access,
  and visual-surface actions.
- The Inventory module now also consumes `/api/live/current/layer-capabilities`
  and shows runtime layer readiness, feature counts, source/provider evidence,
  license, standards transport, authority state, and latest activity.
- The Sources module now shows the catalog/provenance/inventory chain, source
  roles, evidence counts, license posture, standards path, and links to DCAT and
  layer-capability APIs.
- The Standards module now shows publication posture for DCAT, NGSI-LD/FIWARE,
  OGC API Features, MVT, raster metadata, BIM/3D packages, JSON-LD contexts, and
  the pending OpenAPI explorer, with canonical endpoint links and next gaps.
- The Science + Society module now consumes live urban-science and
  society/culture reports, exposing indicator values, method formulas, source
  quality, privacy posture, density-grid access, and caveats for analyst review.
- The Semantic Packs module now consumes the live `reconstruction-service-core`
  report, exposing the city binding, authority posture, indicators, explicit
  rules, service-feature summaries, workflows, and blocked claims.
- Semantic report rendering now normalizes scalar, array, and object report
  fields before display. This keeps future packs from crashing the cockpit when
  they declare workflow inputs, outputs, or quality values differently.
- Map, 3D, and immersive are still reachable, but are presented as construction
  visualization surfaces rather than the source of product truth.
- Navigation architecture is now explicitly hierarchical: the primary rail is
  for product surfaces, the Analysis/Cockpit page has its own internal module
  switcher, and the secondary rail is reserved for controls for the active
  module. The Overview module keeps the hero and summary indicators; other
  modules open directly into their operational panels.

### Phase 5: Data Quality And Freshness UX

- Show data coverage, freshness, source quality, and blocked claims.
- For Kharkiv, explicitly show that buildings are strong but OSM roads,
  facilities, places, and green-blue data are still partial.

## Immediate Product Decision

For the next build step, prioritize the data capability API and observability
foundation before redesigning more analytics cards. The UI should first show
what exists, what is missing, which APIs are live, and which data is safe to use.
