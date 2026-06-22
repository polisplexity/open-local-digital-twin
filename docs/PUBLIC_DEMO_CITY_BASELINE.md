# Public Demo City Baseline

This document describes the recommended non-sensitive example for Digital Public
Goods review and public demonstrations.

## Purpose

The public demo city baseline shows how Open Local Digital Twin can create a
city twin from public sources without requiring personal microdata, private city
records, or proprietary provider datasets.

The demo should demonstrate:

- source registration and provenance;
- open-data ingestion;
- consolidated city inventory;
- viewer summaries and bounded map payloads;
- standards projections through DCAT, OGC API Features, NGSI-LD, and
  FIWARE-compatible workflows;
- aggregate reports for urban science, society/culture, and environmental
  phenomena;
- clear separation between public evidence, inferred layers, provider layers,
  and authority-grade decisions.

## Recommended Demo Inputs

Use public, non-sensitive city-scale sources such as:

- OpenStreetMap extracts;
- Overture Maps buildings and places where permitted by license;
- public administrative boundaries;
- public elevation or terrain datasets;
- public weather or climate summaries;
- open statistical aggregates that do not identify individuals.

Do not include:

- personal microdata;
- private provider datasets;
- unpublished city records;
- credentials or internal deployment details;
- security-sensitive infrastructure layers unless a public authority has already
  published them for reuse.

## Example Workflow

```bash
npm run db:ldt:reingest-open -- --city=demo-city
npm run db:ldt:consolidate -- --city=demo-city
npm run db:ldt:generate-interop -- --city=demo-city
npm run db:ldt:refresh-viewer-aggregates -- --city=demo-city --cell-size-m=2000
npm run db:ldt:generate-urban-science -- --city=demo-city
npm run db:ldt:generate-society -- --city=demo-city
npm run db:ldt:generate-semantic-packs -- --city=demo-city
```

## Expected Public Outputs

```text
GET /api/live/demo-city/base
GET /api/live/demo-city/features
GET /api/live/demo-city/standards/dcat
GET /api/live/demo-city/standards/ogc
GET /api/live/demo-city/standards/ngsi-ld/entities
GET /api/live/demo-city/science/urban-report
GET /api/live/demo-city/society/report
```

## Review Note

The public demo is evidence of reusable methodology and open technical
infrastructure. It should not be interpreted as an official municipal digital
twin unless a competent public authority reviews, approves, and governs the
result.
