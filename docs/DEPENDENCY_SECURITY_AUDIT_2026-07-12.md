# Dependency Security Audit - 2026-07-12

## Status

Remediated. The active OLDT image was rebuilt from a lockfile for which both
`npm ci` and `npm audit` report zero known vulnerabilities.

## Scope

Repository:

```text
<oldt-source>
```

Initial runtime image after remediation:

```text
31-twin-base-studio-guanajuato-test:subject-query-20260712-r6
```

Active image after adding the mandatory Docker build gate:

```text
31-twin-base-studio-guanajuato-test:eu-ldt-ucs-20260712-r8
```

The audit covered production and development dependencies. No `--force`
operation was used.

## Initial Result

The first complete install reported:

```text
moderate: 9
high: 9
critical: 1
total: 19
```

The production-only audit reported:

```text
moderate: 6
high: 6
critical: 1
total: 13
```

The critical issue was prototype pollution in `swiper`, tracked as
[CVE-2026-27212 / GHSA-hmx5-qpq5-p643](https://github.com/advisories/GHSA-hmx5-qpq5-p643).
OLDT used Swiper only for a static profile carousel. It did not process
attacker-controlled carousel configuration, but the vulnerable package was
still shipped to the browser and therefore was removed.

## Remediation

- Removed `swiper` from the dependency graph.
- Replaced the profile carousel with the existing React Bootstrap carousel.
- Updated Next.js from `15.5.7` to patched `15.5.20`.
- Updated `eslint-config-next` to `15.5.20`.
- Updated Nodemailer from `6.10.1` to `9.0.3`.
- Updated styled-components from `6.1.19` to `6.4.3`.
- Updated compatible transitive dependencies through the lockfile without
  using `npm audit fix --force`.
- Overrode Next.js's pinned PostCSS with patched PostCSS `8.5.17` and verified
  compatibility through a complete production build.

The automated audit suggestion to downgrade Next.js to `9.3.3` was rejected
because it was a breaking and technically invalid remediation for this stack.

## Verification Evidence

The clean Docker build reported:

```text
added 702 packages, and audited 703 packages
found 0 vulnerabilities
Next.js 15.5.20
Compiled successfully
```

The deployed container also passed:

```bash
npm audit
# found 0 vulnerabilities
```

Runtime checks completed after the upgrade:

- application health, PostGIS, and all 60 migrations;
- Nodemailer 9 stream-transport compatibility;
- OIDC provider and role/city mapping smoke;
- profile route load with no browser errors and no Swiper nodes;
- context-subject query framework smoke;
- map, City 3D, and Civic XR transport-boundary smoke;
- 33 visual contract checks;
- cleanup of all subject-query smoke fixtures.

## Required Gate

Run this gate whenever `package.json` or `package-lock.json` changes:

```bash
npm ci
npm audit --audit-level=low
npm run build
```

The production `Dockerfile` runs `npm run security:audit` immediately after
`npm ci`. A new image therefore fails before compilation when any known npm
advisory is present, including low-severity findings.

Do not use `npm audit fix --force` without reviewing every proposed direct
dependency change and running the complete OLDT regression set.

## Non-Security Warnings

The build still emits Sass deprecation warnings, one Autoprefixer compatibility
warning, and two Gantt lint warnings. They are maintenance debt, not known npm
security vulnerabilities, and should be handled in a separate scoped change.
