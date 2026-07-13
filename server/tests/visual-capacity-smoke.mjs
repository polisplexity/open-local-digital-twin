import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import sharp from 'sharp'
import { chromium } from 'playwright'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function boolArg(name) {
  return process.argv.includes(`--${name}`)
}

function intArg(name, fallback) {
  const parsed = Math.trunc(Number(argValue(name)))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function safeName(value) {
  return String(value || 'value').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()
}

function parseCsv(raw, fallback) {
  const values = String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return values.length ? values : fallback
}

function parsePositiveCsv(raw, fallback) {
  const values = parseCsv(raw, []).map((entry) => Math.trunc(Number(entry))).filter((value) => Number.isFinite(value) && value > 0)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort((a, b) => a - b)
  return values.length ? values : fallback
}

function parseViewports(rawValue) {
  const raw = rawValue || 'desktop:1366x768'
  return raw.split(',').map((entry) => {
    const [namePart, sizePart] = entry.includes(':') ? entry.split(':') : ['', entry]
    const [width, height] = String(sizePart).split('x').map((value) => Number(value))
    assert(Number.isFinite(width) && Number.isFinite(height), `INVALID_VIEWPORT:${entry}`)
    return {
      name: safeName(namePart || `${width}x${height}`),
      width,
      height,
    }
  })
}

async function analyzeScreenshot(buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const channels = info.channels
  const pixelCount = Math.max(1, Math.floor(data.length / channels))
  const step = Math.max(1, Math.floor(pixelCount / 80000))
  let sampled = 0
  let sum = 0
  let sumSquared = 0
  let nonWhite = 0
  let nonBlack = 0
  let chroma = 0
  let darkGeometry = 0

  for (let pixel = 0; pixel < pixelCount; pixel += step) {
    const offset = pixel * channels
    const red = data[offset] ?? 0
    const green = data[offset + 1] ?? 0
    const blue = data[offset + 2] ?? 0
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    const maxChannel = Math.max(red, green, blue)
    const minChannel = Math.min(red, green, blue)
    sampled += 1
    sum += luminance
    sumSquared += luminance * luminance
    if (luminance < 248) nonWhite += 1
    if (luminance > 8) nonBlack += 1
    if (maxChannel - minChannel > 12) chroma += 1
    if (luminance < 95 && maxChannel - minChannel < 55) darkGeometry += 1
  }

  const mean = sum / sampled
  const variance = Math.max(0, (sumSquared / sampled) - (mean * mean))
  return {
    width: info.width,
    height: info.height,
    sampled,
    mean: Number(mean.toFixed(2)),
    variance: Number(variance.toFixed(2)),
    nonWhiteRatio: Number((nonWhite / sampled).toFixed(4)),
    nonBlackRatio: Number((nonBlack / sampled).toFixed(4)),
    chromaRatio: Number((chroma / sampled).toFixed(4)),
    darkGeometryRatio: Number((darkGeometry / sampled).toFixed(4)),
  }
}

function assertRenderable(analysis, label, options = {}) {
  const minNonWhiteRatio = Number(options.minNonWhiteRatio ?? 0.08)
  const minVariance = Number(options.minVariance ?? 18)
  assert(analysis.width >= 500 && analysis.height >= 320, `SCREENSHOT_TOO_SMALL:${label}:${analysis.width}x${analysis.height}`)
  assert(analysis.nonWhiteRatio > minNonWhiteRatio, `SCREENSHOT_BLANK_WHITE:${label}:${JSON.stringify(analysis)}`)
  assert(analysis.nonBlackRatio > 0.08, `SCREENSHOT_BLANK_BLACK:${label}:${JSON.stringify(analysis)}`)
  assert(analysis.variance > minVariance, `SCREENSHOT_LOW_VARIANCE:${label}:${JSON.stringify(analysis)}`)
}

async function readJson(response, label) {
  const payload = await response.json().catch(() => null)
  assert(response.ok(), `${label}_FAILED:${response.status()}:${JSON.stringify(payload)}`)
  return payload
}

async function newAuthenticatedContext(browser, { baseUrl, viewport, email, password, cityId }) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  })
  await context.addInitScript(() => {
    window.__twinSmokeMessages = []
    window.addEventListener('message', (event) => {
      if (event.data?.source === 'twin-viewer') {
        window.__twinSmokeMessages.push({ ...event.data, receivedAt: Date.now() })
      }
    })
  })
  const response = await context.request.post(`${baseUrl}/api/auth/login`, {
    data: { email, password, cityId, rememberMe: true },
  })
  await readJson(response, 'LOGIN')
  return context
}

async function viewerFrame(page, viewerId, timeoutMs = 45000) {
  const iframe = await page.waitForSelector('iframe.dt-stage-frame', { timeout: timeoutMs })
  let frame = await iframe.contentFrame()
  const frameDeadline = Date.now() + 15000
  const viewerPath = viewerId === 'map'
    ? '/map'
    : viewerId === '3d'
      ? '/3d'
      : '/immersive'
  while (!frame && Date.now() < frameDeadline) {
    await page.waitForTimeout(250)
    frame = await iframe.contentFrame() ||
      page.frames().find((candidate) => candidate.url().includes('/live/') && candidate.url().includes(viewerPath)) ||
      null
  }
  assert(frame, `VIEWER_FRAME_MISSING:${viewerId}`)
  return frame
}

async function stageScreenshot(page) {
  const stage = page.locator('.dt-stage-map-pane').first()
  if (await stage.count()) return stage.screenshot()
  return page.screenshot({ fullPage: false })
}

async function waitForViewerReady(page, viewerId) {
  const frame = await viewerFrame(page, viewerId)
  if (viewerId === 'map') {
    await frame.waitForFunction(() => typeof mapReady !== 'undefined' && mapReady === true, null, { timeout: 60000 })
  }
  await page.waitForFunction(
    (targetViewer) => window.__twinSmokeMessages?.some((message) =>
      message.viewer === targetViewer && (message.type === 'twin:ready' || message.type === 'twin:error')),
    viewerId,
    { timeout: 60000 },
  )
  const errors = await page.evaluate((targetViewer) =>
    (window.__twinSmokeMessages ?? []).filter((message) => message.viewer === targetViewer && message.type === 'twin:error'),
  viewerId)
  assert(!errors.length, `VIEWER_ERROR:${viewerId}:${JSON.stringify(errors.slice(-3))}`)
  return frame
}

async function waitForCapacityViewport(page, viewerId, expectedModes, timeoutMs) {
  await page.waitForFunction(
    ({ targetViewer, modes }) => window.__twinSmokeMessages?.some((message) =>
      message.viewer === targetViewer && message.type === 'twin:viewport' && modes.includes(message.mode)),
    { targetViewer: viewerId, modes: expectedModes },
    { timeout: timeoutMs },
  )
  return page.evaluate((targetViewer) => {
    const messages = (window.__twinSmokeMessages ?? []).filter((message) =>
      message.viewer === targetViewer && message.type === 'twin:viewport')
    return messages.at(-1) ?? null
  }, viewerId)
}

function routeSpecsFor(rawSurfaces) {
  const specs = {
    map: {
      key: 'map',
      route: '/analytical-map',
      viewerId: 'map',
      surface: 'map',
      transport: 'mvt',
      modes: ['semantic-query-tiles', 'semantic-query-metadata'],
    },
    'city-3d': {
      key: 'city-3d',
      route: '/city-3d',
      viewerId: '3d',
      surface: 'municipal3d',
      transport: 'selection-reference',
      modes: ['semantic-query-reference'],
    },
    'civic-xr': {
      key: 'civic-xr',
      route: '/civic-xr',
      viewerId: 'immersive',
      surface: 'immersive',
      transport: 'scene-manifest',
      modes: ['semantic-query', 'base-scene'],
    },
  }
  return rawSurfaces.map((surface) => specs[surface]).filter(Boolean)
}

function queryScope(scopeMode, center, radiusMeters) {
  if (scopeMode === 'city') return { key: 'city' }
  return { key: 'radius', center, radiusMeters }
}

async function runCapacityQuery(context, baseUrl, cityId, spec, center, options) {
  const response = await context.request.post(`${baseUrl}/api/live/${encodeURIComponent(cityId)}/twin-query`, {
    data: {
      language: 'twinql-json',
      classes: options.classes,
      scope: queryScope(options.scope, center, options.radiusMeters),
      render: {
        mode: 'isolate',
        transport: spec.transport,
        maxFeatures: spec.key === 'map' ? 0 : options.maxFeatures,
      },
      surface: spec.surface,
      intent: 'visual-capacity',
      actorUserId: 'visual-capacity-smoke',
      metadata: {
        capacityStep: options.maxFeatures,
        scope: options.scope,
      },
    },
  })
  const payload = await readJson(response, `QUERY_${spec.key}_${options.maxFeatures}`)
  if (spec.key === 'map') {
    assert(payload.transport === 'mvt', `MAP_TRANSPORT_NOT_MVT:${payload.transport}`)
    assert(payload.links?.vectorTileTemplate, 'MAP_VECTOR_TILE_TEMPLATE_MISSING')
    assert(!payload.geojson, 'MAP_LEAKS_GEOJSON')
  }
  if (spec.key === 'city-3d') {
    assert(payload.transport === 'selection-reference', `CITY_3D_TRANSPORT_INVALID:${payload.transport}`)
    assert(payload.selectionReference?.kind === 'twin-query-selection-reference', 'CITY_3D_SELECTION_REFERENCE_MISSING')
    assert(!payload.geojson, 'CITY_3D_SELECTION_REFERENCE_LEAKS_GEOJSON')
  }
  if (spec.key === 'civic-xr') {
    assert(payload.transport === 'scene-manifest', `CIVIC_XR_TRANSPORT_INVALID:${payload.transport}`)
    assert(Number(payload.sceneManifest?.objects?.length ?? 0) > 0, 'CIVIC_XR_SCENE_MANIFEST_EMPTY')
  }
  return payload
}

async function applyQueryToFrame(page, spec, payload) {
  const frame = await viewerFrame(page, spec.viewerId)
  await frame.evaluate(({ targetViewer, payload }) => {
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        source: 'twin-dashboard',
        viewer: targetViewer,
        type: 'twin:set-semantic-query',
        geojson: payload.geojson,
        links: payload.links,
        primitives: payload.primitives,
        sceneManifest: payload.sceneManifest,
        summary: payload.summary,
        transport: payload.transport || payload.query?.render?.transport || '',
        vectorTileTemplate: payload.links?.vectorTileTemplate || '',
        query: payload.query,
      },
      origin: window.location.origin,
    }))
  }, { targetViewer: spec.viewerId, payload })
  return frame
}

async function waitForMapTileTraffic(page, frame, timeoutMs = 60000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const tileResponses = await page.evaluate(() => window.__twinCapacityTileResponses ?? [])
    if (tileResponses.some((entry) => entry.status > 0 && entry.status < 500)) return tileResponses
    await page.waitForTimeout(500)
  }
  await frame.evaluate(() => new Promise((resolve) => {
    if (typeof map === 'undefined' || !map?.once) {
      resolve('map-global-missing')
      return
    }
    const timer = window.setTimeout(() => resolve('idle-timeout'), 12000)
    map.once('idle', () => {
      window.clearTimeout(timer)
      resolve('idle')
    })
  })).catch(() => null)
  return page.evaluate(() => window.__twinCapacityTileResponses ?? [])
}

async function runStep(context, config, viewport, basePayload, spec, maxFeatures) {
  const page = await context.newPage()
  const pageErrors = []
  const tileResponses = []
  page.on('pageerror', (error) => pageErrors.push(String(error?.message ?? error)))
  page.on('response', (response) => {
    const url = response.url()
    if (!/\/api\/live\/[^/]+\/(twin-query-tiles|cached-tiles|tiles)\//.test(url)) return
    const entry = {
      status: response.status(),
      url,
    }
    tileResponses.push(entry)
    page.evaluate((tileEntry) => {
      window.__twinCapacityTileResponses = window.__twinCapacityTileResponses || []
      window.__twinCapacityTileResponses.push(tileEntry)
    }, entry).catch(() => {})
  })
  const started = performance.now()
  try {
    await page.goto(`${config.baseUrl}${spec.route}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitForViewerReady(page, spec.viewerId)
    const queryStarted = performance.now()
    const payload = await runCapacityQuery(
      context,
      config.baseUrl,
      config.cityId,
      spec,
      basePayload.center,
      {
        classes: config.classes,
        scope: config.scope,
        radiusMeters: config.radiusMeters,
        maxFeatures,
      },
    )
    const apiMs = Math.round(performance.now() - queryStarted)
    await applyQueryToFrame(page, spec, payload)
    const renderStarted = performance.now()
    const viewportMessage = await waitForCapacityViewport(page, spec.viewerId, spec.modes, config.renderTimeoutMs)
    let mapTileResponses = []
    if (spec.key === 'map') {
      const frame = await viewerFrame(page, spec.viewerId)
      mapTileResponses = await waitForMapTileTraffic(page, frame, Math.min(config.renderTimeoutMs, 90000))
      assert(mapTileResponses.some((entry) => entry.status > 0 && entry.status < 500), `MAP_TILE_RESPONSES_MISSING:${JSON.stringify(mapTileResponses.slice(-5))}`)
    }
    const renderMs = Math.round(performance.now() - renderStarted)
    await page.waitForTimeout(config.settleMs)
    assert(!pageErrors.length, `PAGE_ERROR:${pageErrors.join(' | ')}`)
    const screenshot = await stageScreenshot(page)
    const screenshotPath = path.join(
      config.outputDir,
      safeName(config.cityId),
      safeName(spec.key),
      `${safeName(viewport.name)}--${safeName(config.scope)}--${String(maxFeatures).padStart(6, '0')}.png`,
    )
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true })
    await fs.writeFile(screenshotPath, screenshot)
    const analysis = await analyzeScreenshot(screenshot)
    assertRenderable(analysis, `${config.cityId}:${spec.key}:${maxFeatures}`)
    const renderedCount = Number(viewportMessage?.rendered ?? viewportMessage?.returned ?? payload.summary?.returned ?? 0)
    const resultCount = Number(viewportMessage?.resultCount ?? payload.summary?.resultCount ?? renderedCount)
    assert(resultCount > 0, `VISUAL_RESULT_COUNT_EMPTY:${spec.key}:${JSON.stringify(viewportMessage)}`)
    if (spec.key !== 'map') {
      assert(renderedCount > 0, `VISUAL_RENDERED_COUNT_EMPTY:${spec.key}:${JSON.stringify(viewportMessage)}`)
    }
    return {
      ok: true,
      cityId: config.cityId,
      viewport,
      surface: spec.key,
      route: spec.route,
      scope: config.scope,
      maxFeatures,
      apiMs,
      renderMs,
      totalMs: Math.round(performance.now() - started),
      queryReturned: Number(payload.summary?.returned ?? 0),
      queryResultCount: Number(payload.summary?.resultCount ?? 0),
      truncated: Boolean(payload.summary?.truncated),
      viewportMessage,
      tileResponses: spec.key === 'map' ? mapTileResponses.slice(-20) : tileResponses.slice(-20),
      screenshot: screenshotPath,
      analysis,
    }
  } catch (error) {
    return {
      ok: false,
      cityId: config.cityId,
      viewport,
      surface: spec.key,
      route: spec.route,
      scope: config.scope,
      maxFeatures,
      totalMs: Math.round(performance.now() - started),
      error: String(error?.message ?? error),
      pageErrors,
    }
  } finally {
    await page.close().catch(() => {})
  }
}

const config = {
  baseUrl: (argValue('base-url') || process.env.TWIN_STUDIO_SMOKE_BASE_URL || 'http://127.0.0.1:4192').replace(/\/$/, ''),
  email: argValue('email') || process.env.TWIN_STUDIO_SMOKE_EMAIL,
  password: argValue('password') || process.env.TWIN_STUDIO_SMOKE_PASSWORD,
  cityId: argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || 'guanajuato',
  outputDir: argValue('output-dir') || process.env.TWIN_STUDIO_VISUAL_CAPACITY_OUTPUT_DIR || '/tmp/twin-visual-capacity-smoke',
  scope: argValue('scope') || 'city',
  radiusMeters: intArg('radius-meters', 5000),
  renderTimeoutMs: intArg('render-timeout-ms', 120000),
  settleMs: intArg('settle-ms', 2500),
  headed: boolArg('headed'),
  classes: parseCsv(argValue('classes'), ['buildings']),
}
const viewports = parseViewports(argValue('viewports'))
const maxFeatureSteps = parsePositiveCsv(argValue('max-features'), [250, 1000, 5000])
const routeSpecs = routeSpecsFor(parseCsv(argValue('surfaces'), ['map', 'city-3d', 'civic-xr']))

assert(config.email, 'SMOKE_EMAIL_REQUIRED')
assert(config.password, 'SMOKE_PASSWORD_REQUIRED')
assert(routeSpecs.length, 'NO_VALID_SURFACES')
await fs.mkdir(config.outputDir, { recursive: true })

const browser = await chromium.launch({ headless: !config.headed })
const results = []
const startedAt = new Date().toISOString()
const startedMs = performance.now()

try {
  for (const viewport of viewports) {
    const context = await newAuthenticatedContext(browser, { ...config, viewport })
    try {
      const baseResponse = await context.request.get(`${config.baseUrl}/api/live/${encodeURIComponent(config.cityId)}/base`)
      const basePayload = await readJson(baseResponse, `BASE_${viewport.name}`)
      const center = [Number(basePayload.city?.lon), Number(basePayload.city?.lat)]
      assert(center.every(Number.isFinite), `CITY_CENTER_MISSING:${viewport.name}`)
      const normalizedBasePayload = { ...basePayload, center }

      for (const spec of routeSpecs) {
        const steps = spec.key === 'map' ? [0] : maxFeatureSteps
        for (const maxFeatures of steps) {
          const result = await runStep(context, { ...config, viewport }, viewport, normalizedBasePayload, spec, maxFeatures)
          results.push(result)
        }
      }
    } finally {
      await context.close().catch(() => {})
    }
  }
} finally {
  await browser.close()
}

const payload = {
  ok: results.every((result) => result.ok),
  cityId: config.cityId,
  baseUrl: config.baseUrl,
  scope: config.scope,
  classes: config.classes,
  maxFeatureSteps,
  surfaces: routeSpecs.map((spec) => spec.key),
  startedAt,
  elapsedMs: Math.round(performance.now() - startedMs),
  outputDir: config.outputDir,
  results,
}

const resultPath = path.join(config.outputDir, safeName(config.cityId), 'visual-capacity-result.json')
await fs.mkdir(path.dirname(resultPath), { recursive: true })
await fs.writeFile(resultPath, `${JSON.stringify(payload, null, 2)}\n`)

console.log(JSON.stringify(payload, null, 2))
if (!payload.ok) process.exitCode = 1
