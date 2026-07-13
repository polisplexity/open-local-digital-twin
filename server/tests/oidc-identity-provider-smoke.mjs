import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import http from 'node:http'

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function signJwt({ privateKey, kid, issuer, audience, nonce }) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT', kid }
  const payload = {
    iss: issuer,
    sub: 'oidc-smoke-user-1',
    aud: audience,
    azp: audience,
    exp: now + 300,
    iat: now,
    nonce,
    email: 'oidc-smoke@polisplexity.test',
    name: 'OIDC Smoke User',
    realm_access: { roles: ['oldt_operator'] },
    resource_access: { [audience]: { roles: ['oldt_admin'] } },
    groups: ['/mexico/guanajuato'],
  }
  const encodedHeader = base64UrlJson(header)
  const encodedPayload = base64UrlJson(payload)
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(`${encodedHeader}.${encodedPayload}`)
  signer.end()
  const signature = signer.sign(privateKey).toString('base64url')
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

async function startMockProvider() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const kid = 'oldt-oidc-smoke-key'
  const jwk = publicKey.export({ format: 'jwk' })
  jwk.kid = kid
  jwk.alg = 'RS256'
  jwk.use = 'sig'

  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    if (url.pathname === '/realms/mx/.well-known/openid-configuration') {
      const issuer = `http://127.0.0.1:${server.address().port}/realms/mx`
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({
        issuer,
        authorization_endpoint: `${issuer}/protocol/openid-connect/auth`,
        token_endpoint: `${issuer}/protocol/openid-connect/token`,
        jwks_uri: `${issuer}/protocol/openid-connect/certs`,
      }))
      return
    }
    if (url.pathname === '/realms/mx/protocol/openid-connect/certs') {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ keys: [jwk] }))
      return
    }
    if (url.pathname === '/realms/mx/protocol/openid-connect/token') {
      let body = ''
      request.on('data', (chunk) => { body += chunk })
      request.on('end', () => {
        const form = new URLSearchParams(body)
        const nonce = form.get('code') === 'valid-code' ? 'nonce-123' : 'bad-nonce'
        const issuer = `http://127.0.0.1:${server.address().port}/realms/mx`
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({
          token_type: 'Bearer',
          expires_in: 300,
          id_token: signJwt({ privateKey, kid, issuer, audience: form.get('client_id'), nonce }),
          access_token: signJwt({ privateKey, kid, issuer, audience: form.get('client_id'), nonce }),
        }))
      })
      return
    }
    response.statusCode = 404
    response.end('not found')
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    server,
    issuer: `http://127.0.0.1:${server.address().port}/realms/mx`,
  }
}

const mock = await startMockProvider()
try {
  process.env.OIDC_PROVIDER_PROFILES = JSON.stringify([
    {
      key: 'mx-toolbox',
      name: 'MX Toolbox OIDC',
      issuerUrl: mock.issuer,
      clientId: 'oldt',
      clientSecret: 'secret',
      redirectUri: 'http://localhost:4292/api/auth/oidc/mx-toolbox/callback',
      scopes: ['openid', 'profile', 'email', 'roles'],
      roleMapping: {
        oldt_admin: 'platform-admin',
        oldt_operator: 'municipal-operator',
      },
      cityMapping: {
        guanajuato: 'guanajuato',
      },
      defaultCityId: 'guanajuato',
    },
  ])

  const {
    buildOidcAuthorizationRedirect,
    exchangeOidcCodeForIdentity,
    getOidcIdentityProviderProfile,
    listOidcIdentityProviderProfiles,
    testOidcIdentityProviderProfile,
  } = await import('../services/oidcIdentityProviderService.mjs')

  const validProfilesJson = process.env.OIDC_PROVIDER_PROFILES
  process.env.OIDC_PROVIDER_PROFILES = '[{invalid-json]'
  assert.throws(
    () => listOidcIdentityProviderProfiles(),
    /OIDC_PROVIDER_PROFILES_JSON_INVALID/,
  )
  process.env.OIDC_PROVIDER_PROFILES = validProfilesJson

  const profile = getOidcIdentityProviderProfile('mx-toolbox')
  const check = await testOidcIdentityProviderProfile('mx-toolbox')
  assert.equal(check.ok, true)
  assert.equal(check.discovery.issuer, mock.issuer)
  assert.equal(check.jwks.keyCount, 1)

  const request = {
    secure: false,
    headers: {},
    get(name) {
      assert.equal(name, 'host')
      return 'localhost:4292'
    },
  }
  const redirect = await buildOidcAuthorizationRedirect({
    profile,
    request,
    state: 'state-123',
    nonce: 'nonce-123',
    next: '/cockpit',
  })
  assert.match(redirect.url, /client_id=oldt/)
  assert.match(redirect.url, /state=state-123/)
  assert.match(redirect.url, /nonce=nonce-123/)

  const exchanged = await exchangeOidcCodeForIdentity({
    profile,
    request,
    code: 'valid-code',
    expectedNonce: 'nonce-123',
  })
  assert.equal(exchanged.identity.email, 'oidc-smoke@polisplexity.test')
  assert.equal(exchanged.identity.primaryCityId, 'guanajuato')
  assert(exchanged.identity.allowedCityIds.includes('guanajuato'))
  assert(exchanged.identity.roles.includes('platform-admin'))

  console.log(JSON.stringify({
    ok: true,
    provider: profile.key,
    issuer: mock.issuer,
    mappedRoles: exchanged.identity.roles,
    mappedCities: exchanged.identity.allowedCityIds,
  }, null, 2))
} finally {
  await new Promise((resolve) => mock.server.close(resolve))
}
