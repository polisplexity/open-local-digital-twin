import {
  getCityBuildingCoverageSummary,
  getCityFeatureMvtTile,
  getCityFeatureViewport,
  getCityLayerCapabilities,
} from '../../db/productionTwinStore.mjs'

export function getCityBuildingCoverage(cityId) {
  return getCityBuildingCoverageSummary(cityId)
}

export function getCityViewportFeatures(cityId, query) {
  return getCityFeatureViewport(cityId, query)
}

export function getCityLayerCapabilitiesForViewer(cityId) {
  return getCityLayerCapabilities(cityId)
}

export function getCityFeatureVectorTile(cityId, tileRequest) {
  return getCityFeatureMvtTile(cityId, tileRequest)
}
