import express from 'express'
import next from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApiObservabilityMiddleware } from './http/apiObservability.mjs'
import { createAuthGuard } from './http/authGuard.mjs'
import {
  applySecurityHeaders,
  rejectCrossOriginUnsafeRequests,
} from './http/security.mjs'
import { registerAdminRoutes } from './routes/adminRoutes.mjs'
import { registerAuthRoutes } from './routes/authRoutes.mjs'
import { registerHealthRoutes } from './routes/healthRoutes.mjs'
import { registerLiveRoutes } from './routes/liveRoutes.mjs'
import { registerPlatformRoutes } from './routes/platformRoutes.mjs'
import { registerProviderRoutes } from './routes/providerRoutes.mjs'
import { registerStandardsRoutes } from './routes/standardsRoutes.mjs'
import { registerViewerShellRoutes } from './routes/viewerShellRoutes.mjs'
import { getCityRegistry } from './services/cityRegistry.mjs'
import { recordApiUsageEvent } from './services/ldtOpsService.mjs'
import {
  getRequestSession,
  requireAdmin,
  requireCityAccess,
} from './services/authService.mjs'
import { initializeRuntimeStore } from './services/stateStore.mjs'
import { runProductionMigrations } from './db/migrate.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const dev = process.env.NODE_ENV !== 'production'
const port = Number(process.env.PORT ?? 3000)
let productionDatabaseStartupStatus = {
  configured: false,
  ok: true,
  applied: [],
  pending: [],
  error: null,
}
let runtimeStoreStartupStatus = {
  configured: false,
  ok: true,
  store: null,
  error: null,
}

const PUBLIC_PREFIXES = [
  '/_next',
  '/auth',
  '/vendor/cesium',
  '/vendor/babylonjs/core',
  '/vendor/maplibre-gl',
  '/api/health',
  '/api/platform/context',
  '/api/auth',
  '/api/provider',
]

const PROTECTED_PREFIXES = [
  '/apps',
  '/cockpit',
  '/analytical-map',
  '/city-3d',
  '/civic-xr',
  '/civic-view',
  '/map',
  '/municipal',
  '/public',
  '/theory',
  '/docs',
  '/profile',
  '/admin',
  '/live',
  '/api/live',
  '/api/admin',
]

function requireLiveCityAccess(request, response, cityId) {
  const access = requireCityAccess(request, cityId)
  if (!access) {
    response.status(403).json({ error: 'CITY_ACCESS_DENIED' })
    return null
  }
  return access
}

function requireAdminRefreshAccess(request, response, forceRefresh) {
  if (!forceRefresh || requireAdmin(request)) {
    return true
  }
  response.status(403).json({ error: 'REFRESH_REQUIRES_ADMIN' })
  return false
}

async function bootstrap() {
  try {
    productionDatabaseStartupStatus = await runProductionMigrations()
    runtimeStoreStartupStatus = {
      configured: true,
      ...(await initializeRuntimeStore()),
      error: null,
    }
  } catch (error) {
    const message = String(error?.message ?? 'UNKNOWN_DATABASE_MIGRATION_ERROR')
    if (!productionDatabaseStartupStatus.ok) {
      productionDatabaseStartupStatus.error = message
    } else {
      runtimeStoreStartupStatus = {
        configured: true,
        ok: false,
        store: 'postgres',
        error: message,
      }
    }
    console.error('production database/runtime startup failed', message)
  }

  const nextApp = next({ dev, dir: rootDir })
  const handle = nextApp.getRequestHandler()
  await nextApp.prepare()

  const app = express()

  app.use(express.json({ limit: process.env.TWIN_STUDIO_JSON_BODY_LIMIT ?? '25mb' }))
  app.use((request, _response, next) => {
    if (request.url.startsWith('/api/live/v1/')) {
      request.url = request.url.replace('/api/live/v1/', '/api/live/')
    }
    next()
  })
  app.use(applySecurityHeaders)
  app.use(createApiObservabilityMiddleware({
    getRequestSession,
    getCityRegistry,
    recordApiUsageEvent,
  }))
  app.use(rejectCrossOriginUnsafeRequests)
  app.use('/vendor/cesium', express.static(path.join(rootDir, 'node_modules', 'cesium', 'Build', 'Cesium')))
  app.use('/vendor/babylonjs/core', express.static(path.join(rootDir, 'node_modules', '@babylonjs', 'core')))
  app.use('/vendor/maplibre-gl', express.static(path.join(rootDir, 'node_modules', 'maplibre-gl', 'dist')))

  app.get('/', (_request, response) => {
    response.redirect(302, '/cockpit')
  })

  app.get('/dashboard', (_request, response) => {
    response.redirect(302, '/cockpit')
  })

  app.get('/map', (_request, response) => {
    response.redirect(302, '/analytical-map')
  })

  app.get('/municipal', (_request, response) => {
    response.redirect(302, '/city-3d')
  })

  app.get('/public', (_request, response) => {
    response.redirect(302, '/civic-xr')
  })

  registerHealthRoutes(app, {
    getStartupStatus: () => ({
      productionDatabase: productionDatabaseStartupStatus,
      runtimeStore: runtimeStoreStartupStatus,
    }),
  })
  registerPlatformRoutes(app)
  registerAuthRoutes(app)
  registerProviderRoutes(app)

  app.use(createAuthGuard({
    publicPrefixes: PUBLIC_PREFIXES,
    protectedPrefixes: PROTECTED_PREFIXES,
    getRequestSession,
    requireAdmin,
  }))

  registerAdminRoutes(app)

  registerStandardsRoutes(app, { requireLiveCityAccess })
  registerLiveRoutes(app, { requireLiveCityAccess, requireAdminRefreshAccess })

  registerViewerShellRoutes(app, { requireLiveCityAccess })

  app.all('*splat', (request, response) => handle(request, response))

  const server = app.listen(port, () => {
    console.log(`twin-base-studio listening on http://localhost:${port}`)
  })

  function shutdown() {
    server.close(() => process.exit(0))
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

bootstrap().catch((error) => {
  console.error('twin-base-studio failed to start', error)
  process.exit(1)
})
