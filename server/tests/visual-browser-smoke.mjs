import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
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

function boolArg(name) {
  return process.argv.includes(`--${name}`)
}

function safeName(value) {
  return String(value || 'surface').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()
}

function parseViewports(rawValue) {
  if (!rawValue) {
    return [
      { name: 'laptop', width: 1366, height: 768 },
      { name: 'desktop', width: 1600, height: 900 },
    ]
  }

  return rawValue.split(',').map((entry) => {
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
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const channels = info.channels
  const pixelCount = Math.max(1, Math.floor(data.length / channels))
  const step = Math.max(1, Math.floor(pixelCount / 50000))
  let sampled = 0
  let sum = 0
  let sumSquared = 0
  let nonWhite = 0
  let nonBlack = 0
  let chroma = 0

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

async function expectNoVisibleCrash(page, route) {
  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
  const forbidden = [
    'Application error:',
    'client-side exception',
    'Could not load live city data',
    'is not defined',
    'Cannot read properties of undefined',
  ]
  for (const marker of forbidden) {
    assert(!bodyText.includes(marker), `VISIBLE_APP_ERROR:${route}:${marker}`)
  }
}

async function waitForViewerReady(page, viewerId) {
  const iframe = await page.waitForSelector('iframe.dt-stage-frame', { timeout: 30000 })
  let frame = await iframe.contentFrame()
  const frameDeadline = Date.now() + 10000
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
  if (viewerId === 'map') {
    await frame.waitForFunction(
      () => typeof mapReady !== 'undefined' && mapReady === true,
      null,
      { timeout: 45000 },
    )
  }
  await page.waitForFunction(
    (targetViewer) => window.__twinSmokeMessages?.some((message) =>
      message.viewer === targetViewer && (message.type === 'twin:ready' || message.type === 'twin:error')),
    viewerId,
    { timeout: 45000 },
  )
  const messages = await page.evaluate(() => window.__twinSmokeMessages ?? [])
  const viewerErrors = messages.filter((message) => message.type === 'twin:error')
  assert(viewerErrors.length === 0, `VIEWER_ERROR:${viewerId}:${JSON.stringify(viewerErrors.slice(-2))}`)
  assert(messages.some((message) => message.viewer === viewerId && message.type === 'twin:ready'), `VIEWER_READY_MISSING:${viewerId}`)
  return frame
}

async function stageScreenshot(page) {
  const stage = page.locator('.dt-stage-map-pane').first()
  if (await stage.count()) {
    return stage.screenshot()
  }
  return page.screenshot({ fullPage: false })
}

async function readJson(response, label) {
  const payload = await response.json().catch(() => null)
  assert(response.ok(), `${label}_FAILED:${response.status()}:${JSON.stringify(payload)}`)
  return payload
}

async function runQuery(context, baseUrl, cityId, surface, center) {
  const transport = surface === 'immersive' ? 'scene-manifest' : ''
  const response = await context.request.post(`${baseUrl}/api/live/${encodeURIComponent(cityId)}/twin-query`, {
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
        ...(transport ? { transport } : {}),
        maxFeatures: 250,
      },
      surface,
      intent: 'visual-smoke',
      actorUserId: 'visual-browser-smoke',
    },
  })
  const payload = await readJson(response, `QUERY_${surface}`)
  if (surface === 'immersive') {
    assert(payload.transport === 'scene-manifest', `QUERY_SCENE_MANIFEST_TRANSPORT_MISSING:${surface}`)
    assert(!payload.geojson, `QUERY_SCENE_MANIFEST_LEAKS_GEOJSON:${surface}`)
    assert(payload.sceneManifest?.objects?.length > 0, `QUERY_SCENE_MANIFEST_OBJECTS_EMPTY:${surface}`)
  } else {
    assert(payload.geojson?.type === 'FeatureCollection', `QUERY_GEOJSON_MISSING:${surface}`)
  }
  assert(Number(payload.summary?.returned ?? 0) > 0, `QUERY_RETURNED_EMPTY:${surface}`)
  return payload
}

async function applyQueryToFrame(page, viewerId, payload) {
  const iframe = await page.waitForSelector('iframe.dt-stage-frame', { timeout: 30000 })
  const frame = await iframe.contentFrame()
  assert(frame, `VIEWER_FRAME_MISSING:${viewerId}`)
  await frame.evaluate(({ targetViewer, geojson, links, primitives, query, sceneManifest, summary, transport, vectorTileTemplate }) => {
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        source: 'twin-dashboard',
        viewer: targetViewer,
        type: 'twin:set-semantic-query',
        geojson,
        links,
        primitives,
        sceneManifest,
        summary,
        transport,
        vectorTileTemplate,
        query,
      },
      origin: window.location.origin,
    }))
  }, {
    targetViewer: viewerId,
    geojson: payload.geojson,
    links: payload.links,
    primitives: payload.primitives,
    sceneManifest: payload.sceneManifest,
    summary: payload.summary,
    transport: payload.transport || payload.query?.render?.transport || '',
    vectorTileTemplate: payload.links?.vectorTileTemplate || '',
    query: payload.query,
  })
  return frame
}

async function waitForQueryViewport(page, viewerId, allowedModes = ['semantic-query']) {
  try {
    await page.waitForFunction(
      ({ targetViewer, modes }) => window.__twinSmokeMessages?.some((message) =>
        message.viewer === targetViewer &&
        message.type === 'twin:viewport' &&
        modes.includes(message.mode)),
      { targetViewer: viewerId, modes: allowedModes },
      { timeout: 30000 },
    )
  } catch (error) {
    const recentMessages = await page.evaluate((targetViewer) =>
      (window.__twinSmokeMessages ?? [])
        .filter((message) => message.viewer === targetViewer)
        .slice(-8)
        .map((message) => ({
          type: message.type,
          mode: message.mode,
          label: message.label,
          returned: message.returned,
          loading: message.loading,
        })), viewerId)
    throw new Error(`QUERY_VIEWPORT_TIMEOUT:${viewerId}:${JSON.stringify(recentMessages)}`)
  }
}

async function verify3dQuerySurvivesCameraMove(page, frame) {
  const beforeCount = await page.evaluate(() =>
    (window.__twinSmokeMessages ?? []).filter((message) =>
      message.viewer === '3d' && message.type === 'twin:viewport' && message.mode === 'semantic-query').length)
  assert(beforeCount > 0, 'MUNICIPAL_3D_QUERY_VIEWPORT_MISSING_BEFORE_CAMERA_MOVE')

  const canvas = frame.locator('canvas').first()
  await canvas.waitFor({ state: 'visible', timeout: 30000 })
  const box = await canvas.boundingBox()
  assert(box, 'MUNICIPAL_3D_CANVAS_BOX_MISSING')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, -700)
  await page.waitForTimeout(1600)

  const latestViewport = await page.evaluate(() => {
    const viewports = (window.__twinSmokeMessages ?? []).filter((message) =>
      message.viewer === '3d' && message.type === 'twin:viewport')
    return viewports.at(-1) ?? null
  })
  assert(latestViewport?.mode === 'semantic-query', `MUNICIPAL_3D_QUERY_RESET_AFTER_CAMERA_MOVE:${JSON.stringify(latestViewport)}`)
}

async function newAuthenticatedContext(browser, { baseUrl, viewport, email, password, cityId }) {
  const context = await browser.newContext({
    viewport: {
      width: viewport.width,
      height: viewport.height,
    },
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
  await readJson(loginResponse, `LOGIN_${viewport.name}`)
  const cookies = await context.cookies(baseUrl)
  assert(cookies.some((cookie) => cookie.name === 'twin_session'), `LOGIN_SESSION_COOKIE_MISSING:${viewport.name}`)
  return context
}

const baseUrl = (argValue('base-url') || process.env.TWIN_STUDIO_SMOKE_BASE_URL || 'http://127.0.0.1:4192').replace(/\/$/, '')
const email = argValue('email') || process.env.TWIN_STUDIO_SMOKE_EMAIL
const password = argValue('password') || process.env.TWIN_STUDIO_SMOKE_PASSWORD
const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || 'kharkiv'
const outputDir = argValue('output-dir') || process.env.TWIN_STUDIO_VISUAL_SMOKE_OUTPUT_DIR || '/tmp/twin-visual-browser-smoke'
const headed = boolArg('headed')
const viewports = parseViewports(argValue('viewports'))

assert(email, 'SMOKE_EMAIL_REQUIRED')
assert(password, 'SMOKE_PASSWORD_REQUIRED')

await fs.mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: !headed })
const results = []

try {
  for (const viewport of viewports) {
    const bootstrapContext = await newAuthenticatedContext(browser, {
      baseUrl,
      viewport,
      email,
      password,
      cityId,
    })
    const baseResponse = await bootstrapContext.request.get(`${baseUrl}/api/live/${encodeURIComponent(cityId)}/base`)
    const basePayload = await readJson(baseResponse, `BASE_${viewport.name}`)
    await bootstrapContext.close()
    const center = [Number(basePayload.city?.lon), Number(basePayload.city?.lat)]
    assert(center.every(Number.isFinite), `CITY_CENTER_MISSING:${viewport.name}`)

    const routes = [
      { route: '/analytical-map', viewerId: 'map', surface: 'map', queryModes: ['semantic-query', 'semantic-query-tiles'] },
      {
        route: '/city-3d',
        viewerId: '3d',
        surface: 'municipal3d',
        verifyCameraQueryGuard: true,
        initialRenderCheck: { minNonWhiteRatio: 0.025, minVariance: 60 },
        renderCheck: { minNonWhiteRatio: 0.04, minVariance: 60 },
      },
      { route: '/civic-xr', viewerId: 'immersive', surface: 'immersive' },
    ]

    for (const routeSpec of routes) {
      const context = await newAuthenticatedContext(browser, {
        baseUrl,
        viewport,
        email,
        password,
        cityId,
      })
      const page = await context.newPage()
      const pageErrors = []
      page.on('pageerror', (error) => pageErrors.push(String(error?.message ?? error)))
      try {
        await page.goto(`${baseUrl}${routeSpec.route}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
        await expectNoVisibleCrash(page, routeSpec.route)
        await waitForViewerReady(page, routeSpec.viewerId)

        const initialBuffer = await stageScreenshot(page)
        const initialAnalysis = await analyzeScreenshot(initialBuffer)
        assertRenderable(initialAnalysis, `${viewport.name}:${routeSpec.route}:initial`, routeSpec.initialRenderCheck || {})

        const queryPayload = await runQuery(context, baseUrl, cityId, routeSpec.surface, center)
        const frame = await applyQueryToFrame(page, routeSpec.viewerId, queryPayload)
        await waitForQueryViewport(page, routeSpec.viewerId, routeSpec.queryModes || ['semantic-query'])

        if (routeSpec.verifyCameraQueryGuard) {
          await verify3dQuerySurvivesCameraMove(page, frame)
        }

        await page.waitForTimeout(800)
        await expectNoVisibleCrash(page, routeSpec.route)
        assert(pageErrors.length === 0, `PAGE_ERROR:${routeSpec.route}:${pageErrors.join(' | ')}`)

        const screenshot = await stageScreenshot(page)
        const screenshotPath = path.join(outputDir, `${safeName(viewport.name)}-${safeName(routeSpec.route)}.png`)
        await fs.writeFile(screenshotPath, screenshot)
        const analysis = await analyzeScreenshot(screenshot)
        assertRenderable(analysis, `${viewport.name}:${routeSpec.route}:query`, routeSpec.renderCheck || {})

        const messages = await page.evaluate(() => window.__twinSmokeMessages ?? [])
        results.push({
          viewport,
          route: routeSpec.route,
          viewerId: routeSpec.viewerId,
          queryReturned: Number(queryPayload.summary?.returned ?? 0),
          queryResultCount: Number(queryPayload.summary?.resultCount ?? 0),
          screenshot: screenshotPath,
          analysis,
          messageTypes: Array.from(new Set(messages.map((message) => message.type).filter(Boolean))),
        })
      } finally {
        await page.close().catch(() => {})
        await context.close().catch(() => {})
      }
    }
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  cityId,
  outputDir,
  viewports,
  results,
}, null, 2))
