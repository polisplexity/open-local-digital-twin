import {
  getTwinQueryContract,
  getTwinQueryMvtTile,
  listCityTwinQueryEvents,
  runCityTwinQuery,
} from '../../db/productionTwinStore/twinQueryRepository.mjs'
import { exportCityTwinQuery as exportCityTwinQueryResult } from './twinQueryExportService.mjs'

export function getCityTwinQueryContract() {
  return getTwinQueryContract()
}

export async function executeCityTwinQuery(cityId, payload = {}) {
  return runCityTwinQuery(cityId, payload)
}

export async function exportCityTwinQuery(cityId, payload = {}) {
  return exportCityTwinQueryResult(cityId, payload)
}

export async function getCityTwinQueryTile(cityId, input = {}) {
  return getTwinQueryMvtTile(cityId, input)
}

export async function listCityTwinQueryRunEvents(cityId, options = {}) {
  return listCityTwinQueryEvents(cityId, options)
}
