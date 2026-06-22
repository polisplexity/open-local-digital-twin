# Contributing

Open Local Digital Twin welcomes public-interest contributions that improve
local digital twin adoption, open-data workflows, interoperability, privacy, and
responsible civic intelligence.

## Useful Contributions

- documentation improvements;
- reproducible non-sensitive city examples;
- standards mappings for DCAT, OGC API Features, NGSI-LD, FIWARE, and related
  civic-data models;
- ingestion adapters for open public datasets;
- privacy, safety, and data-governance improvements;
- tests for public-data baseline workflows;
- issue reports that clearly separate bugs, feature requests, and deployment
  questions.

## Contribution Rules

Do not contribute:

- private city, provider, or customer data;
- credentials, tokens, keys, dumps, or internal operator notes;
- personal microdata or datasets that could identify individuals;
- claims that a dataset is authority-grade without documented review;
- proprietary material that cannot be released under this repository's license.

## Development Setup

```bash
git clone https://github.com/polisplexity/open-local-digital-twin.git
cd open-local-digital-twin
npm ci
cp .env.example .env
npm run db:migrate
npm run test:ldt-schema-smoke
```

## Pull Request Checklist

- The change is compatible with Apache-2.0 licensing.
- No secrets, private data, or internal deployment details are included.
- Public-data examples use non-sensitive or clearly public sources.
- Documentation is updated when behavior or APIs change.
- Relevant smoke tests or reproducible validation steps are included.

## Governance

Polisplexity Ltd maintains the open runtime. Hadox Research Labs and Nodo
Guanajuato A.C. contribute research, civic technology, and local digital twin
methodology. Maintainers may reject contributions that create privacy risk,
misrepresent public data as official truth, or weaken the public-good boundary.
