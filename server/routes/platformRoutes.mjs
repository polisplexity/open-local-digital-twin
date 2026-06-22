import { getActiveCityConfig, getCityRegistry } from '../services/cityRegistry.mjs'
import { getPlatformAuthContext, getRequestSession } from '../services/authService.mjs'

function buildPlatformPayload(request) {
  const registry = getCityRegistry()
  const auth = getPlatformAuthContext(request)
  const currentSession = getRequestSession(request)
  const isAdmin = Boolean(auth.currentUser?.roles?.includes('platform-admin'))
  const allowedCityIds = auth.allowedCityIds ?? []
  const visibleCities =
    auth.authenticated && !isAdmin
      ? registry.cities.filter((city) => city.enabled !== false && allowedCityIds.includes(city.id))
      : registry.cities.filter((city) => city.enabled !== false)
  const activeCityId = currentSession?.session?.cityId || registry.activeCityId
  const activeCity = registry.cities.find((city) => city.id === activeCityId) ?? getActiveCityConfig()

  return {
    workspaceName: 'Twin Base Studio',
    brandName: 'Polisplexity',
    activeCityId,
    activeCity,
    cities: visibleCities,
    authenticated: auth.authenticated,
    currentUser: auth.currentUser,
    allowedCityIds,
  }
}

export function registerPlatformRoutes(app) {
  app.get('/api/platform/context', (request, response) => {
    response.json(buildPlatformPayload(request))
  })
}
