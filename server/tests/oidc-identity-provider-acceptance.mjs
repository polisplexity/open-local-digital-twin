import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import http from 'node:http'

import {
  finishEuLdtAcceptanceRun,
  getEuLdtAcceptanceRun,
  recordEuLdtAcceptanceCase,
  startEuLdtAcceptanceRun,
} from '../services/ldtOps/euLdtAcceptanceService.mjs'
import {
  buildOidcAuthorizationRedirect,
  buildOidcLogoutRedirect,
  exchangeOidcCodeForIdentity,
  extractOldtIdentityFromClaims,
  getOidcIdentityProviderProfile,
  listOidcIdentityProviderProfiles,
  publicOidcIdentityProviderProfile,
  testOidcIdentityProviderProfile,
  verifyOidcJwt,
} from '../services/oidcIdentityProviderService.mjs'

const SUITE_KEY = 'eu-ldt-identity-management-acceptance-v1'
const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
const cityId = cityArg ? cityArg.split('=').slice(1).join('=').trim() : 'guanajuato'
const oldtBaseUrl = String(process.env.OLDT_ACCEPTANCE_BASE_URL ?? 'http://host.docker.internal:4292').replace(/\/+$/, '')
const smokeEmail = process.env.TWIN_STUDIO_SMOKE_EMAIL ?? 'smoke@polisplexity.test'
const smokePassword = process.env.TWIN_STUDIO_SMOKE_PASSWORD ?? 'local-smoke-password-change-me'
const keycloakBaseUrl = String(process.env.EU_LDT_KEYCLOAK_BASE_URL ?? 'http://host.docker.internal:9080').replace(/\/+$/, '')
const keycloakRealm = process.env.EU_LDT_KEYCLOAK_REALM ?? 'LDT'
const keycloakAdminUser = process.env.EU_LDT_KEYCLOAK_ADMIN_USER ?? 'admin'
const keycloakAdminPassword = process.env.EU_LDT_KEYCLOAK_ADMIN_PASSWORD ?? 'admin'
const keycloakAcceptanceUser = process.env.EU_LDT_KEYCLOAK_ACCEPTANCE_USER ?? 'oldt-acceptance@polisplexity.test'
const keycloakAcceptancePassword = process.env.EU_LDT_KEYCLOAK_ACCEPTANCE_PASSWORD ?? 'oldt-acceptance-password-change-me'
const realProviderKey = process.env.EU_LDT_IDENTITY_PROFILE_KEY ?? 'eu-toolbox-mexico'
const originalProfilesJson = process.env.OIDC_PROVIDER_PROFILES

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function signJwt({ privateKey, kid, claims, alg = 'RS256' }) {
  const encodedHeader = base64UrlJson({ alg, typ: 'JWT', kid })
  const encodedPayload = base64UrlJson(claims)
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(`${encodedHeader}.${encodedPayload}`)
  signer.end()
  const signature = signer.sign(privateKey).toString('base64url')
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

async function startMockProvider({ realm, clientId, kid, role, group }) {
  const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const foreignKeyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = keyPair.publicKey.export({ format: 'jwk' })
  Object.assign(jwk, { kid, alg: 'RS256', use: 'sig' })
  const counters = { discovery: 0, jwks: 0, token: 0 }

  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    const issuer = `http://127.0.0.1:${server.address().port}/realms/${realm}`
    if (url.pathname === `/realms/${realm}/.well-known/openid-configuration`) {
      counters.discovery += 1
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({
        issuer,
        authorization_endpoint: `${issuer}/protocol/openid-connect/auth`,
        token_endpoint: `${issuer}/protocol/openid-connect/token`,
        jwks_uri: `${issuer}/protocol/openid-connect/certs`,
        end_session_endpoint: `${issuer}/protocol/openid-connect/logout`,
      }))
      return
    }
    if (url.pathname === `/realms/${realm}/protocol/openid-connect/certs`) {
      counters.jwks += 1
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ keys: [jwk] }))
      return
    }
    if (url.pathname === `/realms/${realm}/protocol/openid-connect/token`) {
      counters.token += 1
      let body = ''
      request.on('data', (chunk) => { body += chunk })
      request.on('end', () => {
        const form = new URLSearchParams(body)
        const now = Math.floor(Date.now() / 1000)
        const nonce = `${realm}-nonce`
        const commonClaims = {
          iss: issuer,
          sub: `${realm}-user`,
          azp: form.get('client_id'),
          exp: now + 300,
          iat: now,
          email: `${realm}@polisplexity.test`,
          name: `${realm.toUpperCase()} Acceptance User`,
          realm_access: { roles: [role] },
          resource_access: { [form.get('client_id')]: { roles: ['oldt_admin'] } },
          groups: [group],
        }
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({
          token_type: 'Bearer',
          expires_in: 300,
          id_token: signJwt({
            privateKey: keyPair.privateKey,
            kid,
            claims: { ...commonClaims, aud: form.get('client_id'), nonce },
          }),
          access_token: signJwt({
            privateKey: keyPair.privateKey,
            kid,
            claims: { ...commonClaims, aud: 'account' },
          }),
        }))
      })
      return
    }
    response.statusCode = 404
    response.end('not found')
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const issuer = `http://127.0.0.1:${server.address().port}/realms/${realm}`
  return {
    server,
    issuer,
    clientId,
    kid,
    counters,
    sign(overrides = {}, { signingKey = keyPair.privateKey, headerKid = kid } = {}) {
      const now = Math.floor(Date.now() / 1000)
      const claims = {
        iss: issuer,
        sub: `${realm}-user`,
        aud: clientId,
        azp: clientId,
        exp: now + 300,
        iat: now,
        nonce: `${realm}-nonce`,
        email: `${realm}@polisplexity.test`,
        realm_access: { roles: [role] },
        groups: [group],
        ...overrides,
      }
      for (const [key, value] of Object.entries(claims)) {
        if (value === undefined) delete claims[key]
      }
      return signJwt({ privateKey: signingKey, kid: headerKid, claims })
    },
    foreignPrivateKey: foreignKeyPair.privateKey,
  }
}

function requestStub(host = 'localhost:4292') {
  return {
    secure: false,
    headers: {},
    get(name) {
      assert.equal(String(name).toLowerCase(), 'host')
      return host
    },
  }
}

function configuredProfile(mock, key, name) {
  return {
    key,
    name,
    issuerUrl: mock.issuer,
    clientId: mock.clientId,
    clientSecret: `${key}-secret`,
    redirectUri: `http://localhost:4292/api/auth/oidc/${key}/callback`,
    postLogoutRedirectUri: 'http://localhost:4292/auth/login',
    scopes: ['openid', 'profile', 'email', 'roles'],
    roleMapping: {
      oldt_admin: 'platform-admin',
      oldt_operator: 'municipal-operator',
      oldt_reviewer: 'municipal-reviewer',
    },
    cityMapping: { guanajuato: cityId },
    defaultCityId: cityId,
  }
}

async function responseBody(response) {
  const raw = await response.text()
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return { raw: raw.slice(0, 1000) }
  }
}

async function fetchJson(url, options = {}, expectedStatus = 200) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers ?? {}) },
    signal: options.signal ?? AbortSignal.timeout(15000),
  })
  const body = await responseBody(response)
  assert.equal(response.status, expectedStatus, `${url}:${response.status}:${JSON.stringify(body).slice(0, 500)}`)
  return { response, body }
}

function sessionCookie(response) {
  const cookie = String(response.headers.get('set-cookie') ?? '').split(';')[0]
  assert.match(cookie, /^twin_session=/, 'OLDT_SESSION_COOKIE_MISSING')
  return cookie
}

async function keycloakAdminToken() {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: keycloakAdminUser,
    password: keycloakAdminPassword,
  })
  const result = await fetchJson(`${keycloakBaseUrl}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  assert.ok(result.body.access_token, 'KEYCLOAK_ADMIN_TOKEN_MISSING')
  return result.body.access_token
}

async function keycloakAdminRequest(path, { method = 'GET', body, expectedStatus = 200, token } = {}) {
  const response = await fetch(`${keycloakBaseUrl}/admin/realms/${encodeURIComponent(keycloakRealm)}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  const responsePayload = await responseBody(response)
  assert.equal(response.status, expectedStatus, `KEYCLOAK_ADMIN_${method}_${path}:${response.status}:${JSON.stringify(responsePayload).slice(0, 500)}`)
  return { response, body: responsePayload }
}

async function ensureKeycloakAcceptanceFixture() {
  const token = await keycloakAdminToken()
  const clientResult = await keycloakAdminRequest(`/clients?clientId=${encodeURIComponent('oldt')}`, { token })
  let client = clientResult.body?.[0]
  const clientPayload = {
    clientId: 'oldt',
    name: 'OLDT Identity Acceptance',
    description: 'Open Local Digital Twin OIDC acceptance client.',
    enabled: true,
    protocol: 'openid-connect',
    publicClient: true,
    bearerOnly: false,
    standardFlowEnabled: true,
    directAccessGrantsEnabled: true,
    implicitFlowEnabled: false,
    serviceAccountsEnabled: false,
    redirectUris: [
      'http://localhost:4292/api/auth/oidc/eu-toolbox-mexico/callback',
      'http://host.docker.internal:4292/api/auth/oidc/eu-toolbox-mexico/callback',
    ],
    webOrigins: ['http://localhost:4292', 'http://host.docker.internal:4292'],
    attributes: {
      ...(client?.attributes ?? {}),
      'post.logout.redirect.uris': 'http://localhost:4292/auth/login##http://host.docker.internal:4292/auth/login',
      'pkce.code.challenge.method': 'S256',
    },
  }
  if (!client) {
    await keycloakAdminRequest('/clients', { method: 'POST', body: clientPayload, expectedStatus: 201, token })
    const created = await keycloakAdminRequest(`/clients?clientId=${encodeURIComponent('oldt')}`, { token })
    client = created.body?.[0]
  } else {
    await keycloakAdminRequest(`/clients/${client.id}`, {
      method: 'PUT',
      body: { ...client, ...clientPayload },
      expectedStatus: 204,
      token,
    })
  }
  assert.ok(client?.id, 'KEYCLOAK_OLDT_CLIENT_NOT_CREATED')

  let roleResponse = await fetch(`${keycloakBaseUrl}/admin/realms/${encodeURIComponent(keycloakRealm)}/roles/oldt_operator`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  })
  if (roleResponse.status === 404) {
    await keycloakAdminRequest('/roles', {
      method: 'POST',
      body: { name: 'oldt_operator', description: 'OLDT municipal operator acceptance role.' },
      expectedStatus: 201,
      token,
    })
    roleResponse = await fetch(`${keycloakBaseUrl}/admin/realms/${encodeURIComponent(keycloakRealm)}/roles/oldt_operator`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    })
  }
  assert.equal(roleResponse.status, 200, `KEYCLOAK_ROLE_LOOKUP_FAILED:${roleResponse.status}`)
  const role = await roleResponse.json()

  const userResult = await keycloakAdminRequest(`/users?username=${encodeURIComponent(keycloakAcceptanceUser)}&exact=true`, { token })
  let user = userResult.body?.[0]
  if (!user) {
    await keycloakAdminRequest('/users', {
      method: 'POST',
      body: {
        username: keycloakAcceptanceUser,
        email: keycloakAcceptanceUser,
        firstName: 'OLDT',
        lastName: 'Acceptance',
        enabled: true,
        emailVerified: true,
      },
      expectedStatus: 201,
      token,
    })
    const created = await keycloakAdminRequest(`/users?username=${encodeURIComponent(keycloakAcceptanceUser)}&exact=true`, { token })
    user = created.body?.[0]
  }
  assert.ok(user?.id, 'KEYCLOAK_ACCEPTANCE_USER_NOT_CREATED')
  await keycloakAdminRequest(`/users/${user.id}/reset-password`, {
    method: 'PUT',
    body: { type: 'password', value: keycloakAcceptancePassword, temporary: false },
    expectedStatus: 204,
    token,
  })
  await keycloakAdminRequest(`/users/${user.id}/role-mappings/realm`, {
    method: 'POST',
    body: [role],
    expectedStatus: 204,
    token,
  })
  return { clientId: client.id, userId: user.id, role: role.name }
}

async function keycloakPasswordGrant() {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'oldt',
    username: keycloakAcceptanceUser,
    password: keycloakAcceptancePassword,
    scope: 'openid profile email roles',
  })
  const result = await fetchJson(`${keycloakBaseUrl}/realms/${encodeURIComponent(keycloakRealm)}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  assert.ok(result.body.id_token, 'KEYCLOAK_ID_TOKEN_MISSING')
  assert.ok(result.body.access_token, 'KEYCLOAK_ACCESS_TOKEN_MISSING')
  return result.body
}

const mockMexico = await startMockProvider({
  realm: 'mexico',
  clientId: 'oldt-mexico',
  kid: 'mexico-signing-key',
  role: 'oldt_operator',
  group: '/mexico/guanajuato',
})
const mockPipitlan = await startMockProvider({
  realm: 'pipitlan',
  clientId: 'oldt-pipitlan',
  kid: 'pipitlan-signing-key',
  role: 'oldt_reviewer',
  group: '/pipitlan/guanajuato',
})
const mockProfiles = [
  configuredProfile(mockMexico, 'mexico-lab', 'Mexico Identity Lab'),
  configuredProfile(mockPipitlan, 'pipitlan-lab', 'Pipitlan Identity Lab'),
]
process.env.OIDC_PROVIDER_PROFILES = JSON.stringify(mockProfiles)

const acceptanceRun = await startEuLdtAcceptanceRun({
  cityId,
  suiteKey: SUITE_KEY,
  toolKind: 'identity-management',
  environment: {
    oldtBaseUrl,
    realIssuer: `${keycloakBaseUrl}/realms/${keycloakRealm}`,
    mockProviderCount: mockProfiles.length,
    executionMode: 'standalone-multi-provider-and-real-keycloak',
  },
})

const failures = []
async function acceptanceCase({ caseKey, category, title, expected = {} }, execute) {
  const startedAt = new Date().toISOString()
  const started = Date.now()
  try {
    const result = await execute()
    await recordEuLdtAcceptanceCase({
      acceptanceRunId: acceptanceRun.id,
      caseKey,
      category,
      title,
      status: 'passed',
      durationMs: Date.now() - started,
      expected,
      actual: result?.actual ?? {},
      evidence: result?.evidence ?? {},
      startedAt,
    })
    return result?.value ?? result
  } catch (error) {
    failures.push({ caseKey, error: String(error?.message ?? error) })
    await recordEuLdtAcceptanceCase({
      acceptanceRunId: acceptanceRun.id,
      caseKey,
      category,
      title,
      status: 'failed',
      durationMs: Date.now() - started,
      expected,
      error: String(error?.stack ?? error?.message ?? error),
      startedAt,
    })
    return null
  }
}

try {
  await acceptanceCase({
    caseKey: 'standalone-local-session',
    category: 'standalone',
    title: 'OLDT local login, session, and logout remain functional without federation',
    expected: { loginStatus: 200, authenticatedBeforeLogout: true, authenticatedAfterLogout: false },
  }, async () => {
    const login = await fetchJson(`${oldtBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: smokeEmail, password: smokePassword, cityId, rememberMe: true }),
    })
    const cookie = sessionCookie(login.response)
    const active = await fetchJson(`${oldtBaseUrl}/api/auth/session`, { headers: { Cookie: cookie } })
    assert.equal(active.body.authenticated, true, 'OLDT_LOCAL_SESSION_NOT_AUTHENTICATED')
    const logout = await fetchJson(`${oldtBaseUrl}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie } })
    assert.equal(logout.body.ok, true, 'OLDT_LOCAL_LOGOUT_FAILED')
    const inactive = await fetchJson(`${oldtBaseUrl}/api/auth/session`, { headers: { Cookie: cookie } })
    assert.equal(inactive.body.authenticated, false, 'OLDT_LOCAL_SESSION_SURVIVED_LOGOUT')
    return {
      actual: {
        loginStatus: login.response.status,
        authenticatedBeforeLogout: active.body.authenticated,
        authenticatedAfterLogout: inactive.body.authenticated,
      },
      evidence: { userEmail: active.body.currentUser?.email, cityIds: active.body.allowedCityIds },
    }
  })

  await acceptanceCase({
    caseKey: 'two-independent-provider-profiles',
    category: 'multi-provider',
    title: 'Two independent identity providers expose discovery, login, and federated logout contracts',
    expected: { profileCount: 2, distinctIssuers: 2, discoveryChecksPassed: 2, federatedLogoutChecksPassed: 2 },
  }, async () => {
    process.env.OIDC_PROVIDER_PROFILES = JSON.stringify(mockProfiles)
    const profiles = listOidcIdentityProviderProfiles()
    assert.equal(profiles.length, 2, 'OIDC_MULTI_PROVIDER_COUNT_MISMATCH')
    assert.equal(new Set(profiles.map((profile) => profile.issuerUrl)).size, 2, 'OIDC_MULTI_PROVIDER_ISSUERS_NOT_DISTINCT')
    const checks = []
    for (const profile of profiles) {
      const checked = await testOidcIdentityProviderProfile(profile.key)
      assert.equal(checked.ok, true, `OIDC_PROVIDER_CHECK_FAILED:${profile.key}`)
      const authorization = await buildOidcAuthorizationRedirect({
        profile,
        request: requestStub(),
        state: `${profile.key}-state`,
        nonce: `${profile.key === 'mexico-lab' ? 'mexico' : 'pipitlan'}-nonce`,
        next: '/cockpit',
      })
      const logout = await buildOidcLogoutRedirect({ profile, request: requestStub() })
      assert.match(authorization.url, new RegExp(`client_id=${encodeURIComponent(profile.clientId)}`))
      assert.equal(logout.federated, true, `OIDC_FEDERATED_LOGOUT_MISSING:${profile.key}`)
      assert.equal(publicOidcIdentityProviderProfile(profile).clientSecret, undefined, `OIDC_PUBLIC_SECRET_EXPOSED:${profile.key}`)
      checks.push({ key: profile.key, issuer: checked.discovery.issuer, authorizationUrl: authorization.url, logoutUrl: logout.url })
    }
    return {
      actual: {
        profileCount: profiles.length,
        distinctIssuers: new Set(profiles.map((profile) => profile.issuerUrl)).size,
        discoveryChecksPassed: checks.length,
        federatedLogoutChecksPassed: checks.filter((entry) => entry.logoutUrl.includes('/logout')).length,
      },
      evidence: { providers: checks },
    }
  })

  await acceptanceCase({
    caseKey: 'provider-specific-identity-mapping',
    category: 'claims',
    title: 'Both providers exchange signed tokens and map external roles and cities into OLDT identity',
    expected: { exchanges: 2, mappedCity: cityId, roles: ['municipal-operator', 'municipal-reviewer'] },
  }, async () => {
    process.env.OIDC_PROVIDER_PROFILES = JSON.stringify(mockProfiles)
    const identities = []
    for (const profile of listOidcIdentityProviderProfiles()) {
      const realm = profile.key === 'mexico-lab' ? 'mexico' : 'pipitlan'
      const exchanged = await exchangeOidcCodeForIdentity({
        profile,
        request: requestStub(),
        code: `valid-${realm}`,
        expectedNonce: `${realm}-nonce`,
      })
      assert.equal(exchanged.identity.primaryCityId, cityId, `OIDC_MAPPED_CITY_MISMATCH:${profile.key}`)
      assert.ok(exchanged.identity.roles.includes(profile.key === 'mexico-lab' ? 'municipal-operator' : 'municipal-reviewer'))
      assert.ok(exchanged.identity.roles.includes('platform-admin'), `OIDC_RESOURCE_ROLE_NOT_MAPPED:${profile.key}`)
      identities.push({
        providerKey: exchanged.identity.providerKey,
        subject: exchanged.identity.subject,
        email: exchanged.identity.email,
        roles: exchanged.identity.roles,
        allowedCityIds: exchanged.identity.allowedCityIds,
      })
    }
    return { actual: { exchanges: identities.length, identities }, evidence: { tokenEndpointCalls: [mockMexico.counters.token, mockPipitlan.counters.token] } }
  })

  await acceptanceCase({
    caseKey: 'jwt-negative-security-matrix',
    category: 'security',
    title: 'OIDC JWT verification rejects expired, forged, misissued, premature, and replay-risk tokens',
    expected: {
      rejected: 9,
      errorCodes: [
        'OIDC_TOKEN_EXPIRED',
        'OIDC_TOKEN_ISSUER_INVALID',
        'OIDC_TOKEN_AUDIENCE_INVALID',
        'OIDC_TOKEN_NONCE_INVALID',
        'OIDC_JWK_NOT_FOUND',
        'OIDC_JWT_SIGNATURE_INVALID',
        'OIDC_TOKEN_NOT_ACTIVE',
        'OIDC_TOKEN_ISSUED_IN_FUTURE',
        'OIDC_TOKEN_SUBJECT_MISSING',
      ],
    },
  }, async () => {
    process.env.OIDC_PROVIDER_PROFILES = JSON.stringify(mockProfiles)
    const profile = getOidcIdentityProviderProfile('mexico-lab')
    const now = Math.floor(Date.now() / 1000)
    const scenarios = [
      ['expired', mockMexico.sign({ exp: now - 120 }), 'OIDC_TOKEN_EXPIRED'],
      ['issuer', mockMexico.sign({ iss: 'https://issuer.invalid/realms/wrong' }), 'OIDC_TOKEN_ISSUER_INVALID'],
      ['audience', mockMexico.sign({ aud: 'wrong-client', azp: 'wrong-client' }), 'OIDC_TOKEN_AUDIENCE_INVALID'],
      ['nonce', mockMexico.sign({ nonce: 'wrong-nonce' }), 'OIDC_TOKEN_NONCE_INVALID'],
      ['unknown-kid', mockMexico.sign({}, { headerKid: 'unknown-key-id' }), 'OIDC_JWK_NOT_FOUND'],
      ['bad-signature', mockMexico.sign({}, { signingKey: mockMexico.foreignPrivateKey }), 'OIDC_JWT_SIGNATURE_INVALID'],
      ['not-before', mockMexico.sign({ nbf: now + 120 }), 'OIDC_TOKEN_NOT_ACTIVE'],
      ['future-issued-at', mockMexico.sign({ iat: now + 120 }), 'OIDC_TOKEN_ISSUED_IN_FUTURE'],
      ['missing-subject', mockMexico.sign({ sub: undefined }), 'OIDC_TOKEN_SUBJECT_MISSING'],
    ]
    const rejected = []
    for (const [name, token, expectedError] of scenarios) {
      await assert.rejects(
        () => verifyOidcJwt(token, profile, { expectedNonce: 'mexico-nonce' }),
        new RegExp(expectedError),
      )
      rejected.push({ name, error: expectedError })
    }
    assert.equal(rejected.length, scenarios.length, 'OIDC_NEGATIVE_MATRIX_INCOMPLETE')
    return { actual: { rejected: rejected.length, scenarios: rejected }, evidence: { jwksRefreshes: mockMexico.counters.jwks } }
  })

  await acceptanceCase({
    caseKey: 'provider-failure-isolation',
    category: 'resilience',
    title: 'Malformed or unreachable OIDC providers do not disable valid providers or standalone OLDT',
    expected: { malformedRejected: true, goodProviderAvailable: true, unreachableProviderRejected: true, oldtAvailable: true },
  }, async () => {
    process.env.OIDC_PROVIDER_PROFILES = '[{invalid-json]'
    assert.throws(() => listOidcIdentityProviderProfiles(), /OIDC_PROVIDER_PROFILES_JSON_INVALID/)
    const unavailable = {
      key: 'unreachable-lab',
      name: 'Unreachable Identity Lab',
      issuerUrl: 'http://127.0.0.1:9/realms/unreachable',
      clientId: 'oldt-unreachable',
      defaultCityId: cityId,
    }
    process.env.OIDC_PROVIDER_PROFILES = JSON.stringify([mockProfiles[0], unavailable])
    const profiles = listOidcIdentityProviderProfiles()
    assert.equal(profiles.length, 2, 'OIDC_ISOLATION_PROFILE_LIST_FAILED')
    const good = await testOidcIdentityProviderProfile('mexico-lab')
    assert.equal(good.ok, true, 'OIDC_GOOD_PROVIDER_FAILED_WITH_BAD_NEIGHBOR')
    await assert.rejects(() => testOidcIdentityProviderProfile('unreachable-lab'))
    const session = await fetchJson(`${oldtBaseUrl}/api/auth/session`)
    assert.equal(session.response.status, 200, 'OLDT_UNAVAILABLE_AFTER_OIDC_FAILURE')
    return {
      actual: { malformedRejected: true, goodProviderAvailable: good.ok, unreachableProviderRejected: true, oldtAvailable: true },
      evidence: { configuredProviders: profiles.map((profile) => profile.key), oldtAuthenticated: session.body.authenticated },
    }
  })

  await acceptanceCase({
    caseKey: 'real-eu-toolbox-keycloak',
    category: 'external-system',
    title: 'Real EU LDT Keycloak issues signed tokens that OLDT validates and maps',
    expected: { discovery: true, jwks: true, tokenGrant: true, signatureVerified: true, mappedCity: cityId },
  }, async () => {
    const fixture = await ensureKeycloakAcceptanceFixture()
    const realProfileConfig = {
      key: realProviderKey,
      name: 'EU Toolbox Mexico Lab',
      issuerUrl: `${keycloakBaseUrl}/realms/${keycloakRealm}`,
      clientId: 'oldt',
      redirectUri: 'http://localhost:4292/api/auth/oidc/eu-toolbox-mexico/callback',
      postLogoutRedirectUri: 'http://localhost:4292/auth/login',
      scopes: ['openid', 'profile', 'email', 'roles'],
      roleMapping: { oldt_operator: 'municipal-operator' },
      defaultCityId: cityId,
    }
    process.env.OIDC_PROVIDER_PROFILES = JSON.stringify([realProfileConfig])
    const profile = getOidcIdentityProviderProfile(realProviderKey)
    const checked = await testOidcIdentityProviderProfile(realProviderKey)
    assert.equal(checked.ok, true, 'EU_KEYCLOAK_DISCOVERY_FAILED')
    assert.ok(checked.jwks.keyCount > 0, 'EU_KEYCLOAK_JWKS_EMPTY')
    const tokens = await keycloakPasswordGrant()
    const idClaims = await verifyOidcJwt(tokens.id_token, profile)
    const accessClaims = await verifyOidcJwt(tokens.access_token, profile, { allowAuthorizedPartyAudience: true })
    const identity = extractOldtIdentityFromClaims({ ...idClaims, ...accessClaims }, profile)
    assert.equal(identity.primaryCityId, cityId, 'EU_KEYCLOAK_DEFAULT_CITY_MAPPING_FAILED')
    assert.ok(identity.roles.includes('municipal-operator'), 'EU_KEYCLOAK_ROLE_MAPPING_FAILED')
    const authorization = await buildOidcAuthorizationRedirect({
      profile,
      request: requestStub(),
      state: 'eu-keycloak-state',
      nonce: 'eu-keycloak-nonce',
      next: '/cockpit',
    })
    const logout = await buildOidcLogoutRedirect({ profile, request: requestStub() })
    assert.equal(logout.federated, true, 'EU_KEYCLOAK_LOGOUT_ENDPOINT_MISSING')
    return {
      actual: {
        discovery: checked.ok,
        jwksKeyCount: checked.jwks.keyCount,
        tokenGrant: Boolean(tokens.id_token && tokens.access_token),
        signatureVerified: Boolean(idClaims.sub && accessClaims.sub),
        mappedCity: identity.primaryCityId,
        mappedRoles: identity.roles,
      },
      evidence: {
        issuer: checked.discovery.issuer,
        authorizationEndpoint: checked.discovery.authorizationEndpoint,
        logoutEndpoint: new URL(logout.url).origin + new URL(logout.url).pathname,
        clientResourceId: fixture.clientId,
        userResourceId: fixture.userId,
        role: fixture.role,
        authorizationHost: new URL(authorization.url).host,
      },
    }
  })

  await acceptanceCase({
    caseKey: 'live-runtime-oidc-routes',
    category: 'runtime',
    title: 'Deployed OLDT exposes valid provider, login, state expiry, test, and federated logout routes',
    expected: { providersStatus: 200, profileTestStatus: 200, loginStatus: 302, expiredStateRejected: true, logoutStatus: 302 },
  }, async () => {
    const providers = await fetchJson(`${oldtBaseUrl}/api/auth/oidc/providers`)
    assert.equal(providers.body.ok, true, `OLDT_LIVE_OIDC_CONFIG_INVALID:${providers.body.detail}`)
    assert.ok(providers.body.providers.some((provider) => provider.key === realProviderKey), 'OLDT_LIVE_OIDC_PROVIDER_MISSING')
    const checked = await fetchJson(`${oldtBaseUrl}/api/auth/oidc/${encodeURIComponent(realProviderKey)}/test`)
    assert.equal(checked.body.ok, true, 'OLDT_LIVE_OIDC_TEST_FAILED')
    const loginResponse = await fetch(`${oldtBaseUrl}/api/auth/oidc/${encodeURIComponent(realProviderKey)}/login?next=%2Fcockpit`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    })
    assert.equal(loginResponse.status, 302, `OLDT_LIVE_OIDC_LOGIN_STATUS:${loginResponse.status}`)
    const loginLocation = loginResponse.headers.get('location') ?? ''
    assert.match(loginLocation, /\/realms\/LDT\/protocol\/openid-connect\/auth/)
    assert.match(String(loginResponse.headers.get('set-cookie') ?? ''), /oldt_oidc_state_eu-toolbox-mexico=/)

    const expiredState = 'expired-state-acceptance'
    const expiredPayload = encodeURIComponent(JSON.stringify({
      state: expiredState,
      nonce: 'expired-nonce',
      next: '/cockpit',
      createdAt: new Date(Date.now() - 11 * 60_000).toISOString(),
    }))
    const callbackResponse = await fetch(
      `${oldtBaseUrl}/api/auth/oidc/${encodeURIComponent(realProviderKey)}/callback?state=${encodeURIComponent(expiredState)}&code=unused-code`,
      {
        headers: { Cookie: `oldt_oidc_state_eu-toolbox-mexico=${expiredPayload}` },
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
      },
    )
    assert.equal(callbackResponse.status, 302, `OLDT_LIVE_OIDC_EXPIRED_STATE_STATUS:${callbackResponse.status}`)
    assert.match(callbackResponse.headers.get('location') ?? '', /OIDC_STATE_EXPIRED/)

    const logoutResponse = await fetch(`${oldtBaseUrl}/api/auth/oidc/${encodeURIComponent(realProviderKey)}/logout`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    })
    assert.equal(logoutResponse.status, 302, `OLDT_LIVE_OIDC_LOGOUT_STATUS:${logoutResponse.status}`)
    assert.match(logoutResponse.headers.get('location') ?? '', /\/protocol\/openid-connect\/logout/)
    return {
      actual: {
        providersStatus: providers.response.status,
        profileTestStatus: checked.response.status,
        loginStatus: loginResponse.status,
        expiredStateRejected: true,
        logoutStatus: logoutResponse.status,
      },
      evidence: {
        providerKeys: providers.body.providers.map((provider) => provider.key),
        issuer: checked.body.discovery?.issuer,
        authorizationLocation: loginLocation,
        callbackErrorLocation: callbackResponse.headers.get('location'),
        logoutLocation: logoutResponse.headers.get('location'),
      },
    }
  })
} finally {
  process.env.OIDC_PROVIDER_PROFILES = originalProfilesJson
  await Promise.all([
    new Promise((resolve) => mockMexico.server.close(resolve)),
    new Promise((resolve) => mockPipitlan.server.close(resolve)),
  ])
}

const finished = await finishEuLdtAcceptanceRun({
  acceptanceRunId: acceptanceRun.id,
  status: failures.length ? 'failed' : 'passed',
  summary: {
    oldtBaseUrl,
    keycloakIssuer: `${keycloakBaseUrl}/realms/${keycloakRealm}`,
    testedProviderKeys: ['mexico-lab', 'pipitlan-lab', realProviderKey],
    failures,
  },
})
const detail = await getEuLdtAcceptanceRun(acceptanceRun.id)

console.log(JSON.stringify({
  ok: failures.length === 0,
  acceptanceRunId: acceptanceRun.id,
  suiteKey: SUITE_KEY,
  cityId,
  status: finished.status,
  counts: finished.summary.counts,
  cases: detail.cases.map((entry) => ({
    caseKey: entry.caseKey,
    status: entry.status,
    durationMs: entry.durationMs,
  })),
  failures,
}, null, 2))

assert.equal(failures.length, 0, `IDENTITY_MANAGEMENT_ACCEPTANCE_FAILED:${failures.map((entry) => entry.caseKey).join(',')}`)
