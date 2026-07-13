# OLDT Identity Provider Profiles

OLDT stays standalone by default. Local users, local passwords, and the `twin_session`
cookie remain the base runtime contract.

External identity is an optional layer. When configured, an external Identity
Manager authenticates the user through OpenID Connect and OLDT creates the same
internal `twin_session` used by the rest of the product.

## Design

```text
Identity Manager
  Keycloak / Entra ID / Auth0 / another OIDC provider
        |
        | OIDC authorization code flow
        v
OLDT OIDC provider profile
        |
        | validated issuer + JWKS + audience/azp + nonce
        v
OLDT user/session mapping
        |
        | same twin_session cookie as standalone mode
        v
OLDT roles, city access, workflows, viewers, EU LDT integrations
```

The Identity Manager is not hardcoded. EU LDT Identity Management is only one
profile used for validation.

## Configuration

Multiple providers can be configured with `OIDC_PROVIDER_PROFILES`:

```json
[
  {
    "key": "eu-toolbox-mexico",
    "name": "EU Toolbox Mexico Lab",
    "issuerUrl": "http://host.docker.internal:9080/realms/LDT",
    "clientId": "oldt",
    "redirectUri": "http://localhost:4292/api/auth/oidc/eu-toolbox-mexico/callback",
    "postLogoutRedirectUri": "http://localhost:4292/auth/login",
    "scopes": ["openid", "profile", "email", "roles"],
    "roleMapping": {
      "oldt_admin": "platform-admin",
      "oldt_operator": "municipal-operator",
      "oldt_viewer": "municipal-reviewer"
    },
    "cityMapping": {
      "guanajuato": "guanajuato"
    },
    "defaultCityId": "guanajuato"
  }
]
```

Single-provider deployment can also use:

```text
OIDC_ENABLED=true
OIDC_PROVIDER_KEY=eu-toolbox-mexico
OIDC_ISSUER_URL=http://host.docker.internal:9080/realms/LDT
OIDC_CLIENT_ID=oldt
OIDC_CLIENT_SECRET=
OIDC_REDIRECT_URI=http://localhost:4292/api/auth/oidc/eu-toolbox-mexico/callback
OIDC_SCOPES=openid profile email roles
OIDC_ROLE_MAPPING={"oldt_admin":"platform-admin","oldt_operator":"municipal-operator","oldt_viewer":"municipal-reviewer"}
OIDC_CITY_MAPPING={"guanajuato":"guanajuato"}
OIDC_DEFAULT_CITY_ID=guanajuato
```

If `roleMapping` is provided, only mapped external roles become OLDT internal
roles. This prevents provider-specific roles such as `offline_access` from
leaking into OLDT authorization.

For Docker deployments, pass JSON profiles through an `--env-file`. Directly
embedding JSON in a PowerShell or shell command can remove quotes and produce
`OIDC_PROVIDER_PROFILES_JSON_INVALID`.

Reusable template:

```text
ops/eu-ldt/identity/oldt-oidc.env.example
```

## Token Validation

OLDT validates the RS256 signature, issuer, expiration, `nbf`, future `iat`,
subject, audience, authorized party, and nonce. An unknown `kid` triggers one
JWKS refresh and then fails. Tokens without `kid` are accepted only when the
provider publishes exactly one signing key.

## Routes

```text
GET /api/auth/oidc/providers
GET /api/auth/oidc/:providerKey/test
GET /api/auth/oidc/:providerKey/login
GET /api/auth/oidc/:providerKey/callback
GET /api/auth/oidc/:providerKey/logout
```

The normal standalone routes remain unchanged:

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session
```

## Login UI

`/auth/login` discovers configured providers with:

```text
GET /api/auth/oidc/providers
```

If no provider is configured, the login screen remains standalone and only
shows the local OLDT account form.

If one or more providers are configured, the screen adds provider buttons after
the local login button:

```text
Continue with EU Toolbox Mexico Lab
```

The button starts:

```text
GET /api/auth/oidc/eu-toolbox-mexico/login?next=/cockpit
```

The callback creates the normal OLDT `twin_session`, so the rest of OLDT does
not need provider-specific code.

## EU Toolbox Mexico Lab

For the local EU LDT Identity Management lab, the `oldt` client was registered
in the local `LDT` realm with:

```text
client_id: oldt
redirect_uris:
  http://localhost:4292/api/auth/oidc/eu-toolbox-mexico/callback
  http://host.docker.internal:4292/api/auth/oidc/eu-toolbox-mexico/callback
web_origins:
  http://localhost:4292
  http://host.docker.internal:4292
default client scopes: profile, email, roles
realm acceptance role: oldt_operator
```

The acceptance suite creates or updates a dedicated acceptance user and assigns
`oldt_operator`. Passwords are supplied only at runtime and are not written to
this document.

Validation result:

```text
issuer: http://host.docker.internal:9080/realms/LDT
client_id: oldt
token validation: issuer/JWKS/audience/azp passed
external role: oldt_operator
mapped OLDT role: municipal-operator
mapped city: guanajuato
```

## Tests

Generic mock OIDC provider smoke:

```text
npm run test:oidc-identity-provider-smoke
```

This smoke starts a local mock OIDC provider, signs RS256 JWTs, validates
discovery/JWKS/token exchange, and verifies role/city mapping.

Full persistent acceptance matrix:

```text
npm run test:oidc-identity-provider-acceptance
```

The suite proves local standalone auth, two independent providers, role/city
mapping, nine negative JWT scenarios, bad-provider isolation, the real EU LDT
Keycloak, and deployed login/callback/logout routes. The passing run is recorded
in `docs/EU_LDT_TOOL_ACCEPTANCE_MATRICES.md`.

Standalone login smoke used during this pass:

```text
GET  http://localhost:4292/api/auth/session
GET  http://localhost:4292/api/auth/dev-login-defaults
POST http://localhost:4292/api/auth/login
GET  http://localhost:4292/api/auth/session
```

Result: standalone login still works and returns an authenticated
`twin_session`.

UI validation runtime:

```text
OLDT test URL: http://localhost:4292/auth/login?next=/cockpit
Identity Manager: http://host.docker.internal:9080/realms/LDT
Test user: dedicated acceptance user created by the suite
```

Browser validation result:

```text
login UI rendered provider button: Continue with EU Toolbox Mexico Lab
OIDC authorization URL: /realms/LDT/protocol/openid-connect/auth?client_id=oldt
callback URL: http://localhost:4292/api/auth/oidc/eu-toolbox-mexico/callback
final URL: http://localhost:4292/cockpit
authenticated: true
external user: EU LDT acceptance account
mapped OLDT role: municipal-operator
mapped OLDT city: guanajuato
```

The single active OLDT evaluation source is `http://localhost:4292`. Standalone
local login remains present when no provider is configured or an optional
provider is unavailable.
