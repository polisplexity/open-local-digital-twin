# EU LDT Tool Acceptance Matrices

This document records executable acceptance evidence for the EU LDT tools whose
integration was hardened on 2026-07-12. It separates external-system evidence
from contract checks and from OLDT-only regression tests.

## Scope

The hardened tools are:

1. Play & Visualise
2. Marketplace, using two independent Marketplace Agents
3. Identity Management, using standalone login, two mock OIDC providers, and the
   real local EU LDT Keycloak
4. Use Case & Scenarios, using the real local Data Platform, Airflow execution,
   and AI Notebook adapter paths for baseline/intervention comparison

The shared evidence store is:

```text
ldt_interop.eu_ldt_acceptance_runs
ldt_interop.eu_ldt_acceptance_cases
ldt_interop.eu_ldt_acceptance_latest
```

Migrations:

```text
server/db/migrations/062_eu_ldt_tool_acceptance.sql
server/db/migrations/063_eu_ldt_use_case_scenarios_exchange.sql
```

Acceptance service: `server/services/ldtOps/euLdtAcceptanceService.mjs`

Every case records expected values, actual values, evidence, duration, optional
workflow run ID, and any error. A suite is not marked `passed` when a case is
failed, blocked, or still running.

## Runtime Under Test

```text
OLDT:                 http://localhost:4292
Play & Visualise:     http://localhost:4300
Marketplace:          http://marketplace.127.0.0.1.nip.io:4314
Marketplace Agent A:  http://marketplace-agent.127.0.0.1.nip.io:4314
Marketplace Agent B:  http://marketplace-agent2.127.0.0.1.nip.io:4317
EU LDT Keycloak:      http://host.docker.internal:9080/realms/LDT
Use Case & Scenarios: http://localhost:5002
UCS backend:          http://localhost:3001
Airflow:              http://localhost:8085
Data Platform:        http://localhost:8080
```

The OLDT web and worker containers use the same image and configuration. The
runtime OIDC configuration is passed with `--env-file` so JSON quoting is not
altered by PowerShell or shell interpolation.

## Play & Visualise

Suite: `eu-ldt-play-visualise-acceptance-v1`

Command:

```text
npm run test:eu-ldt-play-visualise-acceptance
```

Passing run on the unified runtime:

```text
run_id: 75de9f3d-b355-4e53-b547-50de2685cbc4
result: 6/6 passed
```

| Case | Real operation | Acceptance condition |
| --- | --- | --- |
| Profile and OGC contract | Test the configured Play API and read OLDT OGC collections | Profile is validated; OLDT exposes canonical `buildings` and `roads` collections |
| Building consumption | Register an OLDT OGC source and read it back through Play | 125 polygon features; stable IDs and semantic/provenance fields preserved |
| Road consumption | Register an OLDT road source and read it back through Play | 125 line features; stable IDs and semantic/provenance fields preserved |
| Full-power composition | Build a Play map from 500 OLDT objects | Two data sources, four layers (`fill`, `fill-extrusion`, `line`, `symbol`), one plot, and one report |
| Idempotent registration | Repeat the same composition | Map, source, and layer IDs remain stable rather than duplicating assets |
| Failure isolation | Execute a workflow with a missing profile | Only that workflow fails; standalone OLDT and canonical entities remain available |

This proves that Play consumes live OLDT sources and creates usable visual
assets. It is stronger than checking API documentation or registering an empty
URL.

Recovery issue found:

- The Play frontend had a stale Docker Desktop bind mount and did not reflect
  the expected source. Recreating only `play_visualise_frontend` with the
  official compose file restored the UI without replacing the backend or data.

## Marketplace

Suite: `eu-ldt-marketplace-acceptance-v1`

Command:

```text
npm run test:eu-ldt-marketplace-acceptance
```

Passing run on the unified runtime:

```text
run_id: 295ac5cc-6ee3-4d40-bdec-3665ca586921
result: 8/8 passed

asset_a: 9a8b769b-e862-47d8-8ab1-ef53befdbaed
asset_b: 1b3e2fa4-be77-498b-8491-e916d9db5599
offering_a: urn:ngsi-ld:product-offering:8a972132-e75d-4020-8476-c07d5ef189e3
offering_b: urn:ngsi-ld:product-offering:bee76133-b64a-4076-86f5-2d313cd141d2
```

| Case | Real operation | Acceptance condition |
| --- | --- | --- |
| Two-agent M2M connectivity | Authenticate to two independent agents using OAuth2 client credentials | Both profiles validate, base URLs differ, and credentials are renewable |
| Agent A publication | Package and publish 25 real OLDT building polygons | Upload, publish, and launch all succeed |
| Agent B publication | Package and publish a real 15-road saved-query fragment | Upload, publish, and launch all succeed |
| Hub discovery | Search the central Marketplace | Both launched offering IDs are discoverable |
| Agent A readback | Request the orchestrated download and read the package | Byte count and SHA-256 match the published package |
| Agent B readback | Request the second download and read the package | Byte count and SHA-256 match the published package |
| Security and storage isolation | Attempt unauthenticated and cross-agent reads | Anonymous download is rejected and one agent cannot read the other agent's object |
| Failure isolation | Execute a workflow with a missing profile | Only that workflow fails; standalone OLDT remains available |

OLDT uses three auth purposes per profile:

```text
default          local Marketplace Agent upload and metadata
marketplaceHub   central Marketplace launch and discovery
download         central orchestrator download URL
```

The public integration-profile response exposes only
`clientSecretConfigured: true`. It does not expose `clientSecret`, including in
nested `marketplaceHub` and `download` auth profiles.

### Full local stack

The Marketplace is not represented by the Agent alone. The recovered local lab
uses the official source at:

```text
<eu-ldt-lab>/EU_LDT_Marketplace
```

The active Compose project uses these twelve upstream compose files plus one
local override:

```text
docker-compose-mailpit.yaml
docker-compose-scorpio.yaml
docker-compose-keycloak.yaml
docker-compose-keycloak-agent.yaml
docker-compose-minio.yaml
docker-compose-charging-backend.yaml
docker-compose-tmforum.yaml
docker-compose-marketplace-site.yaml
docker-compose-marketplace-agent.yaml
docker-compose-marketplace.yaml
docker-compose-reverse-proxy.yaml
docker-compose-search.yaml
C:/Users/usuario/Documents/Codex/eu-ldt-marketplace-compose-lab-override.yaml
```

Agent B is defined by:

```text
C:/Users/usuario/Documents/Codex/eu-ldt-marketplace-agent2-lab-compose.yaml
```

Recovery issues found:

- Starting only a Marketplace Agent did not expose the Marketplace business
  cycle. The complete stack was required.
- Agent B originally generated presigned object URLs through its private
  frontend host. `PUBLIC_BASE_URL` was changed to the shared Agent reverse
  proxy so `/storage` downloads work from OLDT.
- Each Agent required a configured organization party through its backoffice.
- Local and central Keycloak clients required explicit service-account roles,
  audience mapping, and `fullScopeAllowed` configuration.
- OLDT runtime containers require host aliases for the Marketplace virtual
  hosts because `*.127.0.0.1.nip.io` otherwise resolves to the container itself.

Boundary: this suite proves provider publication, central launch/discovery,
orchestrated download, checksum verification, authentication, and isolation. A
paid buyer order and the Marketplace operator's manual launch governance remain
Marketplace-owned processes; OLDT does not bypass them.

## Identity Management

Suite: `eu-ldt-identity-management-acceptance-v1`

Command:

```text
npm run test:oidc-identity-provider-acceptance
```

Passing run on the unified runtime:

```text
run_id: 2cb3ff27-ff90-475d-afa9-52cd30fe67cb
result: 7/7 passed
```

| Case | Real operation | Acceptance condition |
| --- | --- | --- |
| Standalone session | Local login, session read, logout, and second session read | Local mode authenticates and logout invalidates the session |
| Two provider profiles | Run discovery, authorization redirects, and logout for Mexico and Pipitlan mock issuers | Both providers remain independent and no client secret appears publicly |
| Identity mapping | Exchange signed ID/access tokens from both providers | External roles and city groups map to OLDT roles and `guanajuato` |
| JWT negative matrix | Submit nine invalid signed/forged tokens | Expiry, issuer, audience, nonce, unknown `kid`, signature, `nbf`, future `iat`, and missing subject are rejected |
| Provider isolation | Configure malformed JSON and one unreachable provider | Bad configuration is rejected; a valid provider and standalone OLDT remain usable |
| Real EU Keycloak | Create/update the `oldt` client and acceptance user, obtain real tokens, verify JWKS signatures, and map claims | Discovery, token grant, signature, role mapping, and city mapping pass |
| Live runtime routes | Call provider list/test/login/callback/logout on deployed OLDT | Login redirects to EU Keycloak, state cookie is issued, expired state is rejected, and federated logout redirects correctly |

The diagnostic run before redeployment was:

```text
run_id: 3ba19211-8608-4d73-a8fc-734bcaf2e3d2
result: 6/7 passed
failure: OIDC_PROVIDER_PROFILES_JSON_INVALID on the deployed runtime
```

The cause was an unquoted JSON value injected directly into the container
environment. The fix is the validated env file:

```text
C:/Users/usuario/Documents/Codex/eu-ldt-identity-management-lab/oldt-runtime-oidc.env
```

The reusable, secret-free template is:

```text
ops/eu-ldt/identity/oldt-oidc.env.example
```

## Use Case & Scenarios

Suite: `eu-ldt-use-case-scenarios-acceptance-v1`

Command:

```text
npm run test:eu-ldt-use-case-scenarios-acceptance
```

Passing run against the real local multi-tool path:

```text
acceptance_run_id: b8bc4ce2-d4fa-4a6d-be18-286364363702
workflow_run_id:   b0318ffb-e222-4692-971a-34acf0a93cb2
case_id:           66ca0df0-9580-4edd-8fe0-f1c71ef79751
result:            5/5 passed
```

The tested comparison used a baseline of `20177` objects and an intervention
of `16141.6` objects (`-20%`).

| Case | Real operation | Acceptance condition |
| --- | --- | --- |
| Profile and dependency reachability | Test UCS health, OpenAPI, Cases, Data Platform scopes, and AI namespaces | All five external capabilities answer through the configured profile |
| OLDT to Data Platform | Publish distinct baseline and intervention `OldtScenarioMetric` NGSI-LD entities | Both entities are readable and preserve value, metric, scope, and provenance |
| UCS domain chain | Create Case, Scope, Problem, Objective, Key Metric, two Scenarios, two Data Sources, two model snapshots, and two Experiments | Both branches are complete, associated with the Case, and point to their respective source entity |
| Airflow and AI execution | Execute baseline and intervention serially through UCS | Executions `d579bec2-4a92-42a8-a06b-47ed1b420142` and `b87f5e42-4009-4703-af5d-ba971e528c44` both finish `COMPLETED` with effective source IDs in their output |
| OLDT readback and provenance | Persist all external identifiers, values, outputs, and workflow run | `ldt_interop.ucs_case_bindings` contains a durable, queryable binding to the OLDT source selection |

This is a real orchestration acceptance, not an API-schema check. The local
`echo-model` proves transport, staging, Airflow, inference invocation, readback,
and provenance; it does not claim scientific or causal validity.

Recovery issues found:

- The first UCS database was partially bootstrapped with application tables but
  no migration history. It was backed up before a clean migration.
- Raw Data Platform tenant IDs were converted to `undefined`, and a valid scope
  was split twice. Both defects were repaired in the UCS service layer.
- UCS AI endpoint placeholders and mock response shapes did not match the
  backend contract.
- Airflow lacked the UCS callback URL and shared staging path.
- The initial service client lacked the `tool2` and `tool0` audiences required
  across UCS and Data Platform. The official `tool2-workflow` account is now
  used with the required roles.
- Airflow must not join the UCS default network because both stacks expose a
  `postgres` DNS alias. The UCS backend joins `workflow_default` instead.
- UCS applies global uniqueness to several domain names. OLDT appends a
  workflow-run suffix so repeated comparisons do not collide with earlier
  Cases.

Detailed topology, fixes, and operator instructions are recorded in
`docs/EU_LDT_USE_CASE_SCENARIOS_INTEGRATION.md`.

The diagnostic rerun immediately before this passing run is also retained:

```text
acceptance_run_id: 76142947-cbac-4f16-bf0a-fb2cbc9998c3
result:            failed after 1/5 cases
cause:             case_scope_name_key global uniqueness collision
```

Keeping both records proves that the repeated-execution defect was observed,
fixed, and then re-tested against the same populated UCS database.

## Security Checks Added

OIDC token verification now enforces:

- RS256 signature against the provider JWKS
- exact issuer
- expiration with bounded clock tolerance
- `nbf` and future `iat`
- non-empty subject
- audience and authorized party rules
- nonce for ID-token exchange
- one-time JWKS refresh for an unknown `kid`, followed by hard failure
- rejection of no-`kid` tokens when the provider publishes multiple keys

OIDC callback state expires after ten minutes. Federated logout clears the local
OLDT session before redirecting to the provider's end-session endpoint.

## Regression Evidence

After deploying the unified image:

```text
npm audit: 0 vulnerabilities
U4SSC local query acceptance: 91/91
U4SSC Data Platform acceptance: 91/91
U4SSC CIP acceptance: 91/91
U4SSC roundtrip acceptance: 91/91
U4SSC external sync workflow: 82329455-f58e-48c9-8e38-767461425eaf
LDT operations smoke: passed
TwinQuery smoke: passed
Query library boundary smoke: passed
Generic OIDC smoke: passed
Use Case & Scenarios acceptance: 5/5 passed
City Innovation Planner exchange smoke: passed after paginating all measurement pages
```

The full `test:city-contract-smoke` is a long-running destructive-to-cache
regression, not a deployment smoke. On the real Guanajuato dataset it began a
fresh semantic materialization for 157,547 entities and exceeded the five-minute
command limit. Its uncommitted query was cancelled and PostgreSQL rolled the
transaction back; `entity_semantic_tags` remained unchanged. Focused LDT ops,
TwinQuery, query-library, indicator, and external-tool regressions passed.

## Reading Latest Evidence

```sql
SELECT
  tool_kind,
  suite_key,
  id,
  status,
  started_at,
  completed_at,
  summary->'counts' AS counts
FROM ldt_interop.eu_ldt_acceptance_latest
WHERE city_id = 'guanajuato'
ORDER BY tool_kind;
```

For one run and all its cases:

```sql
SELECT *
FROM ldt_interop.eu_ldt_acceptance_cases
WHERE acceptance_run_id = '<run-id>'
ORDER BY started_at, case_key;
```
