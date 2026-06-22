import {
  getTwinQueryContract,
  getTwinQueryMvtTile,
  listCityTwinQueryEvents,
  runCityTwinQuery,
} from '../../db/productionTwinStore/twinQueryRepository.mjs'

export function getCityTwinQueryContract() {
  return getTwinQueryContract()
}

export async function executeCityTwinQuery(cityId, payload = {}) {
  return runCityTwinQuery(cityId, payload)
}

export async function getCityTwinQueryTile(cityId, input = {}) {
  return getTwinQueryMvtTile(cityId, input)
}

export async function listCityTwinQueryRunEvents(cityId, options = {}) {
  return listCityTwinQueryEvents(cityId, options)
}
