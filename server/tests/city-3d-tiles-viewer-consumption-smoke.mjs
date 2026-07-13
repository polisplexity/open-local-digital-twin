import { chromium } from 'playwright'

function assert(condition, message) {
  if (!condition) throw new Error(message)
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

const baseUrl = (argValue('base-url') || process.env.TWIN_STUDIO_SMOKE_BASE_URL || 'http://127.0.0.1:4192').replace(/\/$/, '')
const email = argValue('email') || process.env.TWIN_STUDIO_SMOKE_EMAIL
const password = argValue('password') || process.env.TWIN_STUDIO_SMOKE_PASSWORD
const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato'

assert(email, 'SMOKE_EMAIL_REQUIRED')
assert(password, 'SMOKE_PASSWORD_REQUIRED')

const browser = await chromium.launch({ headless: true })
const pageErrors = []

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const loginResponse = await context.request.post(`${baseUrl}/api/auth/login`, {
    data: {
      email,
      password,
      cityId,
      rememberMe: true,
    },
  })
  await readJson(loginResponse, 'LOGIN')

  const directCatalogResponse = await context.request.get(`${baseUrl}/api/live/${encodeURIComponent(cityId)}/3d-tilesets?status=ready&limit=10`)
  const directCatalog = await readJson(directCatalogResponse, 'DIRECT_3D_TILESET_CATALOG')
  assert(directCatalog.source === 'viewer-artifact-registry', `DIRECT_3D_TILESET_CATALOG_SOURCE:${directCatalog.source}`)
  assert(Array.isArray(directCatalog.tilesets) && directCatalog.tilesets.length > 0, 'DIRECT_3D_TILESET_CATALOG_EMPTY')

  const page = await context.newPage()
  page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)))

  const catalogResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/3d-tilesets') && response.status() === 200,
    { timeout: 90000 },
  )
  const tilesetResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/3d-tiles/') && response.url().endsWith('/tileset.json') && response.status() === 200,
    { timeout: 90000 },
  )

  await page.goto(`${baseUrl}/city-3d`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const iframe = await page.waitForSelector('iframe.dt-stage-frame', { timeout: 60000 })
  const frame = await iframe.contentFrame()
  assert(frame, 'CITY_3D_FRAME_MISSING')

  const [catalogResponse, tilesetResponse] = await Promise.all([
    catalogResponsePromise,
    tilesetResponsePromise,
  ])
  const catalog = await catalogResponse.json()
  assert(catalog.source === 'viewer-artifact-registry', `VIEWER_3D_TILESET_CATALOG_SOURCE:${catalog.source}`)
  assert(Array.isArray(catalog.tilesets) && catalog.tilesets.length > 0, 'VIEWER_3D_TILESET_CATALOG_EMPTY')

  await frame.waitForSelector('#scene-status', { timeout: 60000 })
  await frame.waitForFunction(
    () => /3D Tiles features loaded|3D Tiles package/.test(document.querySelector('#scene-status')?.textContent || ''),
    null,
    { timeout: 90000 },
  )
  const statusText = await frame.locator('#scene-status').innerText()
  assert(!pageErrors.length, `CITY_3D_PAGE_ERRORS:${pageErrors.join(' | ')}`)

  console.log(JSON.stringify({
    ok: true,
    cityId,
    catalogSource: catalog.source,
    catalogTilesets: catalog.tilesets.map((tileset) => ({
      tilesetKey: tileset.tilesetKey,
      version: tileset.version,
      featureCount: tileset.featureCount,
      byteSize: tileset.byteSize,
      active: tileset.active,
    })),
    viewerTilesetRequest: {
      url: tilesetResponse.url().replace(baseUrl, ''),
      status: tilesetResponse.status(),
      source: tilesetResponse.headers()['x-twin-3d-tiles-source'] || '',
      artifactKey: tilesetResponse.headers()['x-twin-viewer-artifact-key'] || '',
      artifactVersion: tilesetResponse.headers()['x-twin-viewer-artifact-version'] || '',
    },
    statusText,
  }, null, 2))
} finally {
  await browser.close()
}
