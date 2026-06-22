import {
  createVisualShareManifest,
  getVisualShareManifest,
  listVisualShareManifests,
  updateVisualShareManifestPublication,
} from '../../db/productionTwinStore.mjs'

export function listCityVisualShareManifests(cityId, query) {
  return listVisualShareManifests(cityId, query)
}

export function createCityVisualShareManifest(cityId, payload) {
  return createVisualShareManifest(cityId, payload)
}

export function getCityVisualShareManifest(cityId, shareKey) {
  return getVisualShareManifest(cityId, shareKey)
}

export function publishCityVisualShareManifest(cityId, shareKey, payload) {
  return updateVisualShareManifestPublication(cityId, shareKey, payload)
}
