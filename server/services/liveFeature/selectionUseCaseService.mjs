import {
  getCitySelectionAreaSummary,
  getCitySelectionUnits,
} from '../../db/productionTwinStore.mjs'

export function getCitySelectionUnitsForViewer(cityId, query) {
  return getCitySelectionUnits(cityId, query)
}

export function getCitySelectionSummaryForViewer(cityId, query) {
  return getCitySelectionAreaSummary(cityId, query)
}
