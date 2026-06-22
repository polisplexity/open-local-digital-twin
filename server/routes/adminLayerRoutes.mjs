import { registerAdminLayerAuthorityRoutes } from './adminLayerAuthorityRoutes.mjs'
import { registerAdminLayerIngestRoutes } from './adminLayerIngestRoutes.mjs'
import { registerAdminLayerJobRoutes } from './adminLayerJobRoutes.mjs'
import { registerAdminLayerRegistryRoutes } from './adminLayerRegistryRoutes.mjs'

export function registerAdminLayerRoutes(app) {
  registerAdminLayerRegistryRoutes(app)
  registerAdminLayerAuthorityRoutes(app)
  registerAdminLayerJobRoutes(app)
  registerAdminLayerIngestRoutes(app)
}
