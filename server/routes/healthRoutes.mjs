import { getProductionDatabaseStatus } from '../db/migrate.mjs'

export function registerHealthRoutes(app, { getStartupStatus }) {
  app.get('/api/health', async (_request, response) => {
    const database = await getProductionDatabaseStatus()
    const startupStatus = getStartupStatus()
    response.json({
      status: database.ok ? 'ok' : 'degraded',
      service: 'twin-base-studio',
      timestamp: new Date().toISOString(),
      database,
      migrations: startupStatus.productionDatabase,
      runtimeStore: startupStatus.runtimeStore,
    })
  })
}
