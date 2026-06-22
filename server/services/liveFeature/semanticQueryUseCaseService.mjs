import { runCitySemanticQuery } from '../../db/productionTwinStore.mjs'
import { buildSemanticQueryContract } from '../baseTwin/viewerContracts/semanticQueryContract.mjs'
import { getCityLayerCapabilitiesForViewer } from './viewportFeatureUseCaseService.mjs'

export async function getCitySemanticQueryContract(cityId, { surface = 'map', mode = 'cockpit' } = {}) {
  const layerCapabilities = await getCityLayerCapabilitiesForViewer(cityId)
  return {
    ok: layerCapabilities.ok,
    cityId,
    contract: buildSemanticQueryContract({
      cityId,
      surface,
      mode,
      layerCapabilities: layerCapabilities.layers ?? [],
    }),
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
