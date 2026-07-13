import { runCitySemanticQuery } from '../../db/productionTwinStore.mjs'
import { getSemanticRegistrySnapshot } from '../../db/productionTwinStore/semanticRegistryRepository.mjs'
import { buildSemanticQueryContract } from '../baseTwin/viewerContracts/semanticQueryContract.mjs'
import { getCityLayerCapabilitiesForViewer } from './viewportFeatureUseCaseService.mjs'

export async function getCitySemanticQueryContract(cityId, { surface = 'map', mode = 'cockpit' } = {}) {
  const [layerCapabilities, semanticRegistry] = await Promise.all([
    getCityLayerCapabilitiesForViewer(cityId),
    getSemanticRegistrySnapshot({ cityId }),
  ])
  return {
    ok: layerCapabilities.ok,
    cityId,
    contract: buildSemanticQueryContract({
      cityId,
      surface,
      mode,
      layerCapabilities: layerCapabilities.layers ?? [],
      semanticRegistry,
    }),
    semanticRegistry: {
      ok: semanticRegistry.ok,
      available: semanticRegistry.available,
      summary: semanticRegistry.summary,
      error: semanticRegistry.error,
    },
    layerCapabilities: {
      ok: layerCapabilities.ok,
      summary: layerCapabilities.summary,
      error: layerCapabilities.error,
    },
  }
}

export function executeCitySemanticQuery(cityId, payload) {
  return runCitySemanticQuery(cityId, payload)
}
