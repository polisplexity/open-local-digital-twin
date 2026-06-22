import { getActiveCityConfig, getCityRegistry } from '../../server/services/cityRegistry.mjs'

export function getInitialPlatformContext() {
  const registry = getCityRegistry()
  const activeCity = getActiveCityConfig()

  return {
    workspaceName: 'Twin Base Studio',
    brandName: 'Polisplexity',
    activeCityId: registry.activeCityId,
    activeCity,
    cities: registry.cities,
  }
}

export function getInitialCityRegistry() {
  return getCityRegistry()
}
