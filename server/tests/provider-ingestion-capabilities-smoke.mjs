import assert from 'node:assert/strict'
import { inspectProviderIngestionCapabilities } from '../services/providerLayerIngestionService.mjs'

const capabilities = await inspectProviderIngestionCapabilities()
assert.equal(capabilities.ok, true, 'CAPABILITIES_NOT_OK')
assert.ok(Array.isArray(capabilities.capabilities), 'CAPABILITIES_LIST_MISSING')
assert.ok(capabilities.capabilities.some((entry) => entry.key === 'geojson' && entry.canExecute === true), 'GEOJSON_CAPABILITY_NOT_READY')
assert.ok(capabilities.capabilities.some((entry) => entry.key === 'shapefile'), 'SHAPEFILE_CAPABILITY_MISSING')
assert.ok(capabilities.capabilities.some((entry) => entry.key === 'osm-local-extract' && entry.canExecute === true), 'OSM_LOCAL_EXTRACT_CAPABILITY_NOT_READY')
assert.ok(capabilities.capabilities.some((entry) => entry.key === 'mvt-cache-refresh' && entry.canExecute === true), 'MVT_CACHE_REFRESH_CAPABILITY_NOT_READY')
assert.ok(Array.isArray(capabilities.pendingAdapters), 'PENDING_ADAPTERS_MISSING')

console.log(JSON.stringify({
  ok: true,
  executable: capabilities.supportedActions,
  metadataOnly: capabilities.metadataOnlyActions,
  missingTools: capabilities.missingToolActions,
  pendingAdapters: capabilities.pendingAdapters,
}, null, 2))
