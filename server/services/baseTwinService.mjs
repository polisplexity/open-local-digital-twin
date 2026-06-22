import {
  getBaseTwinRecordFromProductionStore,
  getCityBuildingCoverageSummary,
  mirrorBaseTwinPayloadToProductionStore,
} from '../db/productionTwinStore.mjs'
import { getCityConfig } from './cityRegistry.mjs'
import {
  payloadHasExpectedShape,
  payloadLooksSparse,
  readCache,
  writeCache,
} from './baseTwin/cacheStore.mjs'
import { buildOpenDataBasePayload } from './baseTwin/openDataPayloadBuilder.mjs'
import { buildPostgisBasePayload } from './baseTwin/postgisPayloadBuilder.mjs'
import { buildPayloadFromProductionRecord } from './baseTwin/productionPayloadBuilder.mjs'

export {
  getCityCacheStatus,
  listCityCacheStatuses,
  readCachedCityBasePayload,
} from './baseTwin/cacheStore.mjs'

async function augmentBuildingCoverageLayers(payload, cityId) {
  if (!payload?.inventory?.layerDefinitions) return payload
  try {
    const coverage = await getCityBuildingCoverageSummary(cityId)
    if (!coverage.ok || !coverage.coverage?.conflation) return payload
    const newCandidateCount = Number(coverage.coverage.conflation.newCandidateCount ?? 0)
    const matchedCandidateCount = Number(coverage.coverage.conflation.matchedCandidateCount ?? 0)
    payload.inventory.totals.buildingCandidateNew = newCandidateCount
    payload.inventory.totals.buildingCandidateMatched = matchedCandidateCount
    payload.inventory.layerDefinitions = payload.inventory.layerDefinitions.map((definition) => {
      if (definition.key === 'buildings') {
        const openRendered = payload.layers.buildings?.features?.length ?? Number(definition.renderedCount ?? definition.count ?? 0)
        const openDiscovered = Number(payload.inventory.totals.buildingsDiscovered ?? definition.discoveredCount ?? definition.count ?? openRendered)
        return {
          ...definition,
          count: openRendered,
          renderedCount: openRendered,
          discoveredCount: openDiscovered,
          description: 'Consolidated open building footprints from the available public building sources.',
          transportStatus:
            `Public building inventory normalized in the local twin payload. ${matchedCandidateCount.toLocaleString('en-US')} matched source footprints are retained as evidence for reports, not rendered as duplicate buildings.`,
        }
      }
      return definition
    })
  } catch {
    return payload
  }
  return payload
}

async function readProductionBasePayload(cityId) {
  const result = await getBaseTwinRecordFromProductionStore(cityId)
  if (!result.configured || !result.ok || !result.record) return null
  const payload = buildPayloadFromProductionRecord(result.record)
  return payloadHasExpectedShape(payload) && !payloadLooksSparse(payload) ? payload : null
}

export async function getCityBasePayload({ cityId = 'current', forceRefresh = false } = {}) {
  const city = getCityConfig(cityId)
  const staleCache = readCache(city.id, { allowStale: true })

  if (!forceRefresh) {
    const stored = await readProductionBasePayload(city.id)
    if (stored) return augmentBuildingCoverageLayers(stored, city.id)

    const cached = readCache(city.id, { allowStale: false })
    if (cached && !payloadLooksSparse(cached)) return augmentBuildingCoverageLayers(cached, city.id)
    if (staleCache && !payloadLooksSparse(staleCache)) {
      return augmentBuildingCoverageLayers(staleCache, city.id)
    }

    const postgisPayload = await buildPostgisBasePayload(city)
    if (postgisPayload) return augmentBuildingCoverageLayers(postgisPayload, city.id)
  }

  let payload
  try {
    payload = await buildOpenDataBasePayload(city, { payloadLooksSparse })
  } catch (error) {
    if (String(error?.message ?? '').startsWith(`LIVE_PAYLOAD_INCOMPLETE:${city.id}:`) && staleCache && !payloadLooksSparse(staleCache)) {
      return augmentBuildingCoverageLayers(staleCache, city.id)
    }
    throw error
  }

  const storage = await mirrorBaseTwinPayloadToProductionStore(payload)
  if (storage.configured && !storage.ok) {
    console.error('base twin production-store mirror failed', storage.error)
  }
  if (storage.configured && storage.ok) {
    const stored = await readProductionBasePayload(city.id)
    if (stored) {
      const augmented = await augmentBuildingCoverageLayers(stored, city.id)
      writeCache(city.id, augmented)
      return augmented
    }
  }
  const augmented = await augmentBuildingCoverageLayers(payload, city.id)
  writeCache(city.id, augmented)
  return augmented
}

export {
  renderCity3dPage,
  renderCityImmersivePage,
  renderCityMapLibrePage,
} from './baseTwin/viewerPageRenderers.mjs'
