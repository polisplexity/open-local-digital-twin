import { chromium } from 'playwright'

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

async function readJson(response, label) {
  const payload = await response.json().catch(() => null)
  assert(response.ok(), `${label}_FAILED:${response.status()}:${JSON.stringify(payload)}`)
  return payload
}

async function authenticatedContext(browser, {
  baseUrl,
  email,
  password,
  cityId,
}) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  })
  await context.addInitScript(() => {
    window.__twinSmokeMessages = []
    window.addEventListener('message', (event) => {
      if (event.data?.source === 'twin-viewer') {
        window.__twinSmokeMessages.push({ ...event.data, receivedAt: Date.now() })
      }
    })
  })
  const loginResponse = await context.request.post(`${baseUrl}/api/auth/login`, {
    data: {
      email,
      password,
      cityId,
      rememberMe: true,
    },
  })
  await readJson(loginResponse, 'LOGIN')
  return context
}

async function waitForCity3dReady(page) {
  const iframe = await page.waitForSelector('iframe.dt-stage-frame', { timeout: 45000 })
  const frame = await iframe.contentFrame()
  assert(frame, 'CITY_3D_FRAME_MISSING')
  await page.waitForFunction(
    () => window.__twinSmokeMessages?.some((message) =>
      message.viewer === '3d' && message.type === 'twin:ready'),
    null,
    { timeout: 45000 },
  )
  return frame
}

async function applyQueryToCity3d(frame, payload) {
  await frame.evaluate((queryPayload) => {
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        source: 'twin-dashboard',
        viewer: '3d',
        type: 'twin:set-semantic-query',
        geojson: queryPayload.geojson,
        links: queryPayload.links,
        primitives: queryPayload.primitives,
        sceneManifest: queryPayload.sceneManifest,
        summary: queryPayload.summary,
        transport: queryPayload.transport || queryPayload.query?.render?.transport || '',
        vectorTileTemplate: queryPayload.links?.vectorTileTemplate || '',
        query: queryPayload.query,
      },
      origin: window.location.origin,
    }))
  }, payload)
}

async function sceneDataset(frame) {
  return await frame.evaluate(() => {
    const node = document.getElementById('scene3d')
    return node ? { ...node.dataset } : {}
  })
}

const baseUrl = (argValue('base-url') || process.env.TWIN_STUDIO_SMOKE_BASE_URL || 'http://127.0.0.1:4192').replace(/\/$/, '')
const email = argValue('email') || process.env.TWIN_STUDIO_SMOKE_EMAIL
const password = argValue('password') || process.env.TWIN_STUDIO_SMOKE_PASSWORD
const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || 'kharkiv'

assert(email, 'SMOKE_EMAIL_REQUIRED')
assert(password, 'SMOKE_PASSWORD_REQUIRED')

const browser = await chromium.launch({ headless: true })
const environmentalRequests = []

try {
  const context = await authenticatedContext(browser, { baseUrl, email, password, cityId })
  const baseResponse = await context.request.get(`${baseUrl}/api/live/${encodeURIComponent(cityId)}/base`)
  const basePayload = await readJson(baseResponse, 'BASE')
  const center = [Number(basePayload.city?.lon), Number(basePayload.city?.lat)]
  assert(center.every(Number.isFinite), 'CITY_CENTER_MISSING')

  const queryResponse = await context.request.post(`${baseUrl}/api/live/${encodeURIComponent(cityId)}/twin-query`, {
    data: {
      language: 'twinql-json',
      classes: ['buildings'],
      scope: {
        key: 'radius',
        center,
        radiusMeters: 1800,
      },
      render: {
        mode: 'isolate',
        maxFeatures: 250,
      },
      surface: 'municipal3d',
      intent: 'city-3d-phenomena-smoke',
      actorUserId: 'city-3d-phenomena-smoke',
    },
  })
  const queryPayload = await readJson(queryResponse, 'QUERY')
  assert(Number(queryPayload.summary?.returned ?? 0) > 0, 'QUERY_RETURNED_EMPTY')

  const page = await context.newPage()
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('/environmental-cells')) environmentalRequests.push(url)
  })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(String(error?.message ?? error)))

  await page.goto(`${baseUrl}/city-3d`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  const frame = await waitForCity3dReady(page)
  let dataset = await sceneDataset(frame)
  assert(dataset.terrainProvider !== 'source-backed-heightmap', `TERRAIN_INSTALLED_BEFORE_QUERY:${JSON.stringify(dataset)}`)
  assert(dataset.phenomenaMode !== 'terrainElevation', `TERRAIN_MODE_BEFORE_QUERY:${JSON.stringify(dataset)}`)

  await applyQueryToCity3d(frame, queryPayload)
  await page.waitForFunction(
    () => window.__twinSmokeMessages?.some((message) =>
      message.viewer === '3d' &&
      message.type === 'twin:viewport' &&
      message.mode === 'semantic-query'),
    null,
    { timeout: 30000 },
  )

  await frame.locator('[data-phenomena-mode="terrainElevation"]').click({ timeout: 30000 })
  await frame.waitForFunction(
    () => {
      const dataset = document.getElementById('scene3d')?.dataset || {}
      return dataset.terrainProvider === 'source-backed-heightmap' &&
        dataset.phenomenaMode === 'terrainElevation' &&
        dataset.phenomenaScope === 'active-query'
    },
    null,
    { timeout: 45000 },
  )

  dataset = await sceneDataset(frame)
  assert(dataset.phenomenaRendering === 'terrain-provider-query-scope', `TERRAIN_RENDERING_WRONG:${JSON.stringify(dataset)}`)
  assert(String(dataset.phenomenaMeshTriangles || '0') === '0', `TRIANGULATED_MESH_RETURNED:${JSON.stringify(dataset)}`)
  assert(Number(dataset.terrainSamples || 0) > 0, `TERRAIN_SAMPLES_MISSING:${JSON.stringify(dataset)}`)
  const terrainDataset = dataset
  assert(environmentalRequests.some((url) => url.includes('layerKey=terrain_elevation_m') && url.includes('radiusMeters=')), `TERRAIN_REQUEST_NOT_QUERY_SCOPED:${JSON.stringify(environmentalRequests)}`)

  await frame.locator('[data-phenomena-mode="builtIntensity"]').click({ timeout: 30000 })
  await frame.waitForFunction(
    () => {
      const dataset = document.getElementById('scene3d')?.dataset || {}
      return dataset.phenomenaMode === 'builtIntensity' &&
        dataset.phenomenaScope === 'active-query' &&
        dataset.terrainProvider === 'ellipsoid'
    },
    null,
    { timeout: 45000 },
  )
  dataset = await sceneDataset(frame)
  assert(String(dataset.phenomenaMeshTriangles || '0') === '0', `BUILT_FORM_MESH_TRIANGLES_PRESENT:${JSON.stringify(dataset)}`)

  await frame.locator('[data-phenomena-mode="airTemperature"]').click({ timeout: 30000 })
  await frame.waitForFunction(
    () => {
      const dataset = document.getElementById('scene3d')?.dataset || {}
      return dataset.phenomenaMode === 'airTemperature' &&
        dataset.phenomenaScope === 'active-query' &&
        dataset.terrainProvider === 'ellipsoid' &&
        Number(dataset.phenomenaSamples || 0) > 0
    },
    null,
    { timeout: 45000 },
  )
  const temperatureDataset = await sceneDataset(frame)
  assert(environmentalRequests.some((url) => url.includes('layerKey=weather_air_temperature_c') && url.includes('radiusMeters=')), `TEMPERATURE_REQUEST_NOT_QUERY_SCOPED:${JSON.stringify(environmentalRequests)}`)

  await frame.locator('[data-phenomena-mode="surfaceWater"]').click({ timeout: 30000 })
  await frame.waitForFunction(
    () => {
      const dataset = document.getElementById('scene3d')?.dataset || {}
      return dataset.phenomenaMode === 'surfaceWater' &&
        dataset.phenomenaScope === 'active-query' &&
        dataset.terrainProvider === 'ellipsoid' &&
        Number(dataset.phenomenaSamples || 0) > 0
    },
    null,
    { timeout: 45000 },
  )
  const hydrologyDataset = await sceneDataset(frame)
  assert(environmentalRequests.some((url) => url.includes('layerKey=hydrology_surface_water_signal') && url.includes('radiusMeters=')), `HYDROLOGY_REQUEST_NOT_QUERY_SCOPED:${JSON.stringify(environmentalRequests)}`)

  await frame.locator('[data-phenomena-mode="surfaceRunoff"]').click({ timeout: 30000 })
  await frame.waitForFunction(
    () => {
      const dataset = document.getElementById('scene3d')?.dataset || {}
      return dataset.phenomenaMode === 'surfaceRunoff' &&
        dataset.phenomenaScope === 'active-query' &&
        dataset.terrainProvider === 'ellipsoid' &&
        dataset.phenomenaRendering === 'query-scope-local-runoff' &&
        Number(dataset.phenomenaSamples || 0) > 0 &&
        Number(dataset.runoffFlowParticles || 0) > 0
    },
    null,
    { timeout: 45000 },
  )
  const runoffDataset = await sceneDataset(frame)
  assert(environmentalRequests.some((url) => url.includes('layerKey=surface_runoff_screening') && url.includes('radiusMeters=')), `RUNOFF_REQUEST_NOT_QUERY_SCOPED:${JSON.stringify(environmentalRequests)}`)

  assert(pageErrors.length === 0, `PAGE_ERRORS:${pageErrors.join(' | ')}`)

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    cityId,
    queryReturned: Number(queryPayload.summary?.returned ?? 0),
    queryResultCount: Number(queryPayload.summary?.resultCount ?? 0),
    terrainSamples: Number(terrainDataset.terrainSamples ?? 0),
    builtFormSamples: Number(dataset.phenomenaSamples ?? 0),
    temperatureSamples: Number(temperatureDataset.phenomenaSamples ?? 0),
    hydrologySamples: Number(hydrologyDataset.phenomenaSamples ?? 0),
    runoffSamples: Number(runoffDataset.phenomenaSamples ?? 0),
    runoffFlowParticles: Number(runoffDataset.runoffFlowParticles ?? 0),
    environmentalRequests: environmentalRequests.length,
    terrainRequests: environmentalRequests.filter((url) => url.includes('terrain_elevation_m')).length,
    temperatureRequests: environmentalRequests.filter((url) => url.includes('weather_air_temperature_c')).length,
    hydrologyRequests: environmentalRequests.filter((url) => url.includes('hydrology_surface_water_signal')).length,
    runoffRequests: environmentalRequests.filter((url) => url.includes('surface_runoff_screening')).length,
  }, null, 2))

  await page.close().catch(() => {})
  await context.close().catch(() => {})
} finally {
  await browser.close()
}
