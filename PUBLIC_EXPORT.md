# Public Export Policy

This GitHub repository is a curated public build of the active Open Local
Digital Twin development workspace. The private workspace and this public Git
history are intentionally separate.

## Included

- application source under `src/` and `server/`;
- database migrations and executable contract tests;
- public installation, architecture, user, standards, and integration
  documentation;
- license, governance, privacy, security, and DPG-readiness material;
- public CI and dependency-maintenance configuration.

## Excluded

- `.env` files and runtime credentials;
- runtime databases, generated city artifacts, uploads, dumps, caches, and
  model binaries;
- private city/provider data and authority-only evidence;
- internal operations, deployment hosts, partner notes, delivery trackers, and
  commercial support material;
- local EU LDT Toolbox source checkouts and their runtime state.

## Publication Gates

Every export must pass all of the following before publication:

1. reproducible allowlist export into an empty staging directory;
2. absolute-path, credential, private-data, and unexpected-binary review;
3. Gitleaks directory scan with redacted output;
4. clean `npm ci` and zero-result `npm audit --audit-level=low`;
5. production build and bounded contract/acceptance tests;
6. full Git diff review against the current public repository;
7. branch publication, pull-request review, and release verification.

The generated `public-export-manifest.json` records the high-level scope of the
export. It contains no private source path or credentials.

## Claims Boundary

Laboratory acceptance demonstrates that a bounded scenario ran against the
documented local components. It does not certify an upstream project, guarantee
production availability, or grant authority to municipal data or decisions.
Production promotion remains an explicit local governance action.
