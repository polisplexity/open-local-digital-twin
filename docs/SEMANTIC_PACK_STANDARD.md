# Semantic Pack Standard

Phase 9 turns inferred meaning into explicit, inspectable city-service packs.

The base twin remains the public/open city inventory. A semantic pack is a
separate product layer that says:

- what inputs it needs,
- what rules it applies,
- what it can claim,
- what it cannot claim yet,
- what indicators it produces,
- what service workflow the city should review next.

## Database Model

The native schema is `ldt_semantic`.

- `pack_registry`: pack manifest, version, domain, lifecycle, standards mapping.
- `pack_rules`: inspectable rules and validation requirements.
- `city_pack_bindings`: city-specific activation and quality posture.
- `service_indicators`: pack-specific city indicators.
- `service_features`: service features created by the pack, such as critical
  anchors or access-spine candidates.
- `service_workflows`: operational review steps for the city analyst.
- `pack_exports`: machine-readable JSON exports for meetings, reports, and
  future API federation.
- `review_decisions`: future city decisions about pack results.

The legacy `public.semantic_packs` registry is still populated for backward
compatibility, but the production model is `ldt_semantic`.

## First Reference Pack

`reconstruction-service-core` is the first reference semantic pack.

It is designed for Kharkiv-style conversations where the city needs a serious
starting point but may not yet be ready to share official damage, population,
or project-priority data.

The pack currently does not claim:

- damaged buildings,
- affected population,
- formal reconstruction priority,
- budget priority,
- official critical infrastructure status.

It does provide:

- open building inventory count,
- critical service anchor count,
- emergency/health/education anchor counts,
- major road access-spine length,
- explicit blockers for missing damage and population-demand data,
- a review workflow for city validation.

Current Kharkiv generated output:

- readiness: 75%
- indicators: 10
- service features: 179
- critical service anchors: 48
- major access-spine candidates: 30.86 km
- workflows: 4

## Operation

Run migrations:

```bash
npm run db:migrate
```

Generate the reference pack:

```bash
npm run db:ldt:generate-semantic-packs -- --city=kharkiv
```

Validate:

```bash
npm run test:ldt-semantic-packs-smoke -- --city=kharkiv
```

Read through the authenticated live API:

```text
GET /api/live/kharkiv/semantic-packs/reconstruction-service-core/report
GET /api/live/current/semantic-packs/reconstruction-service-core/report
```

## Product Meaning

This phase creates the line between:

- base twin: what the city openly has,
- inferred seed: what we can infer from public tags,
- semantic pack: a transparent service interpretation with rules,
- authority workflow: what the city must confirm before the platform presents
  operational conclusions.

For Kharkiv, this lets us say: the platform can already prepare a reconstruction
readiness layer from open data, but it will not pretend to know damage or human
impact until the city or an authority-grade provider connects that source.
