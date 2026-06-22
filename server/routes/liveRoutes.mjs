import { registerLiveAnalyticsRoutes } from './liveAnalyticsRoutes.mjs'
import { registerLive3dTilesRoutes } from './live3dTilesRoutes.mjs'
import { registerLiveBaseRoutes } from './liveBaseRoutes.mjs'
import { registerLiveBimRoutes } from './liveBimRoutes.mjs'
import { registerLiveFeatureRoutes } from './liveFeatureRoutes.mjs'
import { registerLiveOperationsRoutes } from './liveOperationsRoutes.mjs'

export function registerLiveRoutes(app, { requireLiveCityAccess, requireAdminRefreshAccess }) {
  registerLiveBaseRoutes(app, { requireLiveCityAccess, requireAdminRefreshAccess })
  registerLiveOperationsRoutes(app, { requireLiveCityAccess })
  registerLiveFeatureRoutes(app, { requireLiveCityAccess })
  registerLiveAnalyticsRoutes(app, { requireLiveCityAccess })
  registerLiveBimRoutes(app, { requireLiveCityAccess })
  registerLive3dTilesRoutes(app, { requireLiveCityAccess })
}
