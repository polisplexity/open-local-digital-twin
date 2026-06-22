import { reingestOpenDataSources } from '../../db/ldt-open-data-reingest.mjs'
import { consolidateLdtInventory } from '../../db/ldt-consolidate-inventory.mjs'
import {
  closeLdtViewerAggregatePool,
  refreshLdtViewerAggregates,
} from '../ldtViewerAggregateService.mjs'
import { withClient } from '../ldtOps/dbUtils.mjs'

const FEATURE_PRODUCING_ACTIONS = new Set([
  'geojson',
  'csv',
  'ogc-features',
  'overture-buildings',
  'overture-roads',
  'osm-local-extract',
])

const DEPRECATED_DIRECT_BRIDGE_PHASES = [
  'guanajuato-demo-bridge',
  'provider-city-features-bridge',
]

function shouldBridgeAction(action) {
  return FEATURE_PRODUCING_ACTIONS.has(String(action ?? '').trim().toLowerCase())
}

function bridgeDisabled(body = {}) {
  if (body.refreshLdt === false || body.refresh_ldt === false) return true
  if (body.skipLdtBridge === true || body.skip_ldt_bridge === true) return true
  return String(process.env.TWIN_STUDIO_SKIP_LDT_POST_INGESTION_BRIDGE ?? '').trim() === '1'
}

async function clearDeprecatedDirectBridgeRows(cityId) {
  await withClient(async (client) => {
    await client.query(
      `DELETE FROM ldt_core.city_entities
       WHERE city_id = $1
         AND properties->>'phase' = ANY($2::text[])`,
      [cityId, DEPRECATED_DIRECT_BRIDGE_PHASES],
    )
  })
}

export async function refreshLdtAfterProviderIngestion({ cityId, action, body = {} } = {}) {
  const normalizedCityId = String(cityId ?? '').trim()
  const normalizedAction = String(action ?? '').trim().toLowerCase()
  if (!normalizedCityId || !shouldBridgeAction(normalizedAction) || bridgeDisabled(body)) {
    return {
      skipped: true,
      cityId: normalizedCityId || null,
      action: normalizedAction || null,
      reason: !normalizedCityId
        ? 'city-required'
        : !shouldBridgeAction(normalizedAction)
          ? 'non-feature-producing-action'
          : 'disabled',
    }
  }

  try {
    await clearDeprecatedDirectBridgeRows(normalizedCityId)
    const reingest = await reingestOpenDataSources({ cityIds: [normalizedCityId] })
    const consolidate = await consolidateLdtInventory({ cityIds: [normalizedCityId] })
    const viewerAggregates = await refreshLdtViewerAggregates({ cityIds: [normalizedCityId] })
    return {
      skipped: false,
      cityId: normalizedCityId,
      action: normalizedAction,
      reingest,
      consolidate,
      viewerAggregates,
    }
  } finally {
    await closeLdtViewerAggregatePool()
  }
}
