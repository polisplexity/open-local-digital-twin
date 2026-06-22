# Society, Economy, And Culture Standard

Updated: 2026-05-14

This is the first Twin Base Studio standard for social, economic, cultural, and
participation observations. It is designed to keep city analysis useful while
protecting privacy and avoiding false demographic claims.

## Standard Identity

- standard key: `society-culture-core`
- version: `0.1.0`
- schema: `ldt_society`
- generator: `npm run db:ldt:generate-society`
- report API: `/api/live/:cityId/society/report`

## Purpose

The standard adds a safe social layer to the Local Digital Twin:

- aggregate demographic readiness;
- health, education, emergency, civic, cultural, and daily-economy open-data
  anchors;
- cultural assets from open public tags;
- participation-process readiness;
- source-quality rules for open social/economic/cultural signals;
- privacy policies before public visualization.

It does not expose personal data. It does not infer population, household,
income, vulnerability, or equity from building footprints alone.

## Database Objects

Phase 8 extends `ldt_society` with:

- `observation_series`
- `observations`
- `privacy_policies`
- `source_quality_rules`
- `domain_profiles`
- `social_vulnerability_scores`
- `equity_gap_results`
- `cultural_assets`
- `participation_events`

The current vulnerability and equity rows are explicit placeholders with
`not-computable` quality until population, demographic, service-catchment, and
subarea inputs are connected.

## First Observation Set

The first city-level observation series are:

- `demographic_data_readiness`
- `health_anchor_density`
- `education_anchor_density`
- `emergency_anchor_density`
- `daily_economy_anchor_density`
- `cultural_anchor_density`
- `civic_anchor_density`
- `place_identity_anchor_count`
- `open_society_data_readiness`
- `public_participation_readiness`

These are city-level aggregate or public-open observations. They are not
person-level records.

## Privacy Rules

Seeded policies:

- `aggregate-public-city`: city-level aggregate observations can be public when
  no personal microdata is exposed.
- `public-open-anchor`: public open-data anchors can be shown with provenance.
- `restricted-sensitive-social`: sensitive household, health, survey,
  vulnerability, or demographic microdata must not be exposed in the
  open-source viewer.

Privacy posture for the current reports:

```text
aggregate and public-open anchors only; no personal microdata
```

## Source Quality Rules

Seeded rules:

- OSM facility tags are service anchors, not official registries.
- OSM shops and amenities are daily-economy signals, not a complete business
  census.
- Vulnerability and equity require population or demographic denominators.
- Participation readiness requires actual city process records before it can be
  treated as participation evidence.

## Kharkiv Current Reading

After Phase 8 local generation:

- 10 social/economic/cultural observations;
- 41 cultural public-open assets;
- 21 health anchors;
- 15 education anchors;
- 20 emergency anchors;
- 117 daily-economy anchors;
- 1 planned participation-review record;
- no personal data;
- demographic readiness remains `0%` because no official/open population
  dataset is connected.

This gives the Kharkiv conversation an honest social layer: the platform can
hold social/economic/cultural analysis, but it will not fake demographics or
vulnerability without the right data.

## Operation

Generate reports:

```bash
npm run db:ldt:generate-society -- --city=kharkiv
```

Validate reports:

```bash
npm run test:ldt-society-smoke -- --city=kharkiv
```

Read report through the live API:

```text
GET /api/live/kharkiv/society/report
```

## Next Work

- Add population grid or official demographic datasets.
- Add district/subarea geography.
- Add service catchments and travel-time accessibility.
- Add official facility registries.
- Add public-participation event imports.
- Add survey aggregation rules and strict public/private boundaries.
- Add cultural heritage datasets where authoritative sources exist.
