function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function cookieHeaderFrom(response) {
  const setCookie = response.headers.getSetCookie?.() ?? []
  if (setCookie.length) {
    return setCookie.map((entry) => entry.split(';')[0]).join('; ')
  }
  const singleCookie = response.headers.get('set-cookie')
  return singleCookie ? singleCookie.split(',').map((entry) => entry.split(';')[0]).join('; ') : ''
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    redirect: 'manual',
    ...options,
    headers: {
      ...(options.headers ?? {}),
    },
  })
  const body = await response.text().catch(() => '')
  return { response, body }
}

const baseUrl = (argValue('base-url') || process.env.TWIN_STUDIO_SMOKE_BASE_URL || 'http://127.0.0.1:4192').replace(/\/$/, '')
const email = argValue('email') || process.env.TWIN_STUDIO_SMOKE_EMAIL
const password = argValue('password') || process.env.TWIN_STUDIO_SMOKE_PASSWORD
const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || 'guanajuato'

assert(email, 'SMOKE_EMAIL_REQUIRED')
assert(password, 'SMOKE_PASSWORD_REQUIRED')

const productRoutes = ['/cockpit', '/analytical-map', '/city-3d', '/civic-xr', '/docs']
const protectedRoutes = [...productRoutes, '/docs/reference/user-manual', '/live/current/map', '/live/current/3d', '/live/current/immersive']
const retiredRoutes = ['/dashboard', '/map', '/municipal', '/public', '/civic-view']

for (const route of retiredRoutes) {
  const { response } = await fetchText(`${baseUrl}${route}`)
  assert(response.status === 404, `RETIRED_ROUTE_SHOULD_404:${route}:${response.status}`)
}

for (const route of protectedRoutes) {
  const { response } = await fetchText(`${baseUrl}${route}`)
  assert(response.status === 302, `UNAUTH_ROUTE_SHOULD_REDIRECT:${route}:${response.status}`)
  assert(
    String(response.headers.get('location') ?? '').startsWith('/auth/login'),
    `UNAUTH_ROUTE_REDIRECT_TARGET_INVALID:${route}:${response.headers.get('location')}`,
  )
}

const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  redirect: 'manual',
  body: JSON.stringify({
    email,
    password,
    cityId,
    rememberMe: true,
  }),
})

const loginPayload = await loginResponse.json().catch(() => ({}))
assert(loginResponse.ok, `LOGIN_FAILED:${loginResponse.status}:${loginPayload.error ?? 'unknown'}`)
const cookie = cookieHeaderFrom(loginResponse)
assert(cookie.includes('twin_session='), 'LOGIN_SESSION_COOKIE_MISSING')

const routeChecks = [
  {
    route: '/cockpit',
    includes: ['/_next/static/', 'Twin Base Studio'],
  },
  {
    route: '/analytical-map',
    includes: ['/_next/static/', 'Analytical Map'],
  },
  {
    route: '/city-3d',
    includes: ['/_next/static/'],
  },
  {
    route: '/civic-xr',
    includes: ['/_next/static/'],
  },
  {
    route: '/docs',
    includes: ['/_next/static/', 'OLDT User Manual', 'Native OLDT', 'EU LDT integrations'],
  },
  {
    route: '/docs/reference/user-manual',
    includes: ['/_next/static/', 'USER_MANUAL.md', 'OLDT User Manual', 'Back to manual'],
    contentType: 'text/html',
  },
  {
    route: '/live/current/map',
    includes: ['/vendor/maplibre-gl/maplibre-gl.js', 'function addBaseSources()', "map.addSource('boundary'", "broadcast('twin:error'", 'id="map-basemap-switcher"', 'data-basemap="street"', 'data-basemap="satellite"'],
    excludes: ['/vendor/leaflet/leaflet.js'],
  },
  {
    route: '/live/current/3d',
    includes: [
      '#scene3d',
      'async function loadBimLayers',
      '/bim-layers',
      "broadcast('twin:error'",
      'data-phenomena-mode="builtIntensity"',
      'data-phenomena-mode="terrainElevation"',
      'data-phenomena-mode="terrainSlope"',
      'data-phenomena-mode="airTemperature"',
      'data-phenomena-mode="surfaceWater"',
      'data-phenomena-mode="surfaceRunoff"',
      'id="scene-basemap-switcher"',
      'data-basemap="street"',
      'data-basemap="satellite"',
    ],
    excludes: [
      '/vendor/leaflet/leaflet.js',
      '/vendor/three',
      'import * as THREE',
      'data-phenomena-mode="greenBlueCooling"',
      'data-phenomena-mode="airflowFriction"',
      'data-phenomena-mode="solarExposureProxy"',
      'data-phenomena-mode="waterFlowProxy"',
    ],
  },
  {
    route: '/live/current/immersive',
    includes: [
      'data-civic-xr-runtime="babylon-webxr"',
      'id="civic-xr-canvas"',
      '/vendor/babylonjs/core/Engines/engine.js',
      'createDefaultXRExperienceAsync',
      'twin:set-xr-mode',
      'data-civic-xr-session="desktop"',
      'data-civic-xr-session="vr"',
      'data-civic-xr-session="ar"',
      'data-civic-xr-fullscreen',
      'twin:set-visible-layers',
      "broadcast('twin:ready'",
    ],
    excludes: [
      'aframe.io',
      'AFRAME_RUNTIME_UNAVAILABLE',
      'immersive-light-stage',
      'data-civic-xr-mode=',
    ],
  },
]

const results = []

for (const check of routeChecks) {
  const { response, body } = await fetchText(`${baseUrl}${check.route}`, {
    headers: {
      Cookie: cookie,
    },
  })
  assert(response.status === 200, `ROUTE_NOT_OK:${check.route}:${response.status}`)
  if (check.contentType) {
    assert(
      String(response.headers.get('content-type') ?? '').startsWith(check.contentType),
      `ROUTE_CONTENT_TYPE_INVALID:${check.route}:${response.headers.get('content-type')}`,
    )
  }
  assert(!body.includes('Application error: a client-side exception'), `ROUTE_CLIENT_ERROR_MARKER:${check.route}`)
  assert(!body.includes('Could not load live city data'), `ROUTE_LIVE_DATA_ERROR_MARKER:${check.route}`)
  for (const marker of check.includes ?? []) {
    assert(body.includes(marker), `ROUTE_MARKER_MISSING:${check.route}:${marker}`)
  }
  for (const marker of check.excludes ?? []) {
    assert(!body.includes(marker), `ROUTE_MARKER_SHOULD_NOT_EXIST:${check.route}:${marker}`)
  }
  results.push({
    route: check.route,
    status: response.status,
    bytes: body.length,
  })
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  cityId,
  routes: results,
}, null, 2))
