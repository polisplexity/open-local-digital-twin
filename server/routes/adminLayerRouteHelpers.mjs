import { findCityConfig } from '../services/cityRegistry.mjs'

export function requireAdminCity(response, cityId) {
  const city = findCityConfig(cityId)
  if (!city) {
    response.status(404).json({ error: 'CITY_NOT_FOUND' })
    return null
  }
  return city
}
