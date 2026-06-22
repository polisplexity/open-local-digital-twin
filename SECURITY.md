# Security Policy

## Supported Version

The current public release line is `v0.1.x`.

This repository is an early public release candidate. Deployments used by public
authorities, civic labs, universities, or commercial teams should perform their
own security review before production use.

## Reporting A Vulnerability

Please report suspected security or privacy issues by email:

edgar@hadox.org

Please include:

- affected version or commit;
- affected component or route;
- steps to reproduce;
- expected impact;
- whether any personal, private, or city-sensitive data may be involved.

Do not open a public issue if the report includes credentials, private data,
exploitable details, or information that could increase risk for a deployment.

## Public Baseline Security Position

Open Local Digital Twin is designed to work from public-data baselines without
requiring personal microdata. Production deployments are responsible for:

- replacing all development secrets;
- configuring HTTPS and secure cookies;
- restricting administrative routes;
- setting retention and publication controls for any private/provider layers;
- separating public, provider, and authority-grade datasets;
- reviewing all outputs before they are treated as official decisions.

## Not In Scope

This repository does not include private Polisplexity deployments, private city
data, server credentials, customer operations, or paid hosted infrastructure.
