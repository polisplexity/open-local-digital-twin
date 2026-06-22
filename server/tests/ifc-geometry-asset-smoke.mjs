import fs from 'node:fs'
import path from 'node:path'
import {
  getCityLayerBimPayload,
  upsertCityProviderLayer,
  upsertRegisteredProvider,
} from '../db/productionTwinStore.mjs'
import { findCityConfig, getActiveCityConfig } from '../services/cityRegistry.mjs'
import { ingestProviderIfcLayer } from '../services/providerLayerIngestionService.mjs'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function cityFromArgs() {
  const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID
  return cityId ? findCityConfig(cityId) : getActiveCityConfig()
}

function ifcPathFromArgs() {
  return argValue('ifc') || process.env.TWIN_STUDIO_IFC_GEOMETRY_SAMPLE_PATH || ''
}

const city = cityFromArgs()
assert(city?.id, 'CITY_NOT_FOUND')

const samplePath = ifcPathFromArgs()
assert(samplePath, 'IFC_GEOMETRY_SAMPLE_PATH_REQUIRED')
assert(fs.existsSync(samplePath), `IFC_GEOMETRY_SAMPLE_NOT_FOUND:${samplePath}`)

const providerId = 'e2e-ifc-geometry-provider'
const layerKey = 'e2e-ifc-geometry-assets'
const ifcText = fs.readFileSync(samplePath, 'utf8')

await upsertRegisteredProvider({
  id: providerId,
  name: 'E2E IFC Geometry Provider',
  providerType: 'bim-provider',
  metadata: {
    purpose: 'repeatable IFC native geometry and mesh asset smoke test',
  },
  connectors: [
    {
      connectorKey: 'ifc-package',
      displayName: 'IFC package connector',
      connectorType: 'api',
      status: 'active',
      supportedFormats: ['ifc'],
      authMode: 'test',
    },
  ],
})

await upsertCityProviderLayer(city, {
  key: layerKey,
  name: 'E2E IFC Geometry Assets',
  layerFamily: 'bim',
  geometryType: 'Point',
  authorityStatus: 'provider-supplied',
  accessLevel: 'city-private',
  providerId,
})

const directResult = await ingestProviderIfcLayer(city, layerKey, {
  sourceName: path.basename(samplePath),
  sourceFormat: 'ifc',
  connectorKey: 'ifc-package',
  submittedBy: 'e2e-ifc-geometry-smoke',
  ifcText,
  lat: city.lat,
  lon: city.lon,
  metadata: {
    e2e: true,
    mode: 'direct-native-geometry',
    samplePath,
  },
})
assert(directResult.ok, `IFC_GEOMETRY_INGEST_FAILED:${directResult.error ?? 'unknown'}`)

const bimPayload = await getCityLayerBimPayload(city.id, layerKey)
assert(bimPayload.ok, `IFC_GEOMETRY_BIM_PAYLOAD_FAILED:${bimPayload.error ?? 'unknown'}`)
assert(bimPayload.anchor?.recordType === 'model-anchor', 'IFC_GEOMETRY_ANCHOR_MISSING')
assert(
  bimPayload.nativeGeometry?.state === 'inspected-native-ifc-geometry',
  `IFC_GEOMETRY_STATE_UNEXPECTED:${bimPayload.nativeGeometry?.state ?? 'missing'}`,
)
assert(Number(bimPayload.nativeGeometry?.elementMeshCount ?? 0) > 0, 'IFC_GEOMETRY_ELEMENT_MESHES_MISSING')
assert(Number(bimPayload.nativeGeometry?.geometryReferenceCount ?? 0) > 0, 'IFC_GEOMETRY_REFERENCES_MISSING')
assert(Number(bimPayload.nativeGeometry?.vertexBufferValueCount ?? 0) > 0, 'IFC_GEOMETRY_VERTEX_BUFFER_EMPTY')
assert(Number(bimPayload.nativeGeometry?.indexValueCount ?? 0) > 0, 'IFC_GEOMETRY_INDEX_BUFFER_EMPTY')

const bundle = bimPayload.nativeGeometry?.meshAssetBundle
assert(bundle?.state === 'mesh-assets-written', `IFC_GEOMETRY_ASSET_STATE_UNEXPECTED:${bundle?.state ?? 'missing'}`)
assert(bundle?.manifest?.href, 'IFC_GEOMETRY_MANIFEST_HREF_MISSING')
assert(Number(bundle?.totalBytes ?? 0) > 0, 'IFC_GEOMETRY_ASSET_BYTES_EMPTY')
assert(Number(bundle?.geometryReferenceCount ?? 0) > 0, 'IFC_GEOMETRY_ASSET_REFERENCES_MISSING')

console.log(JSON.stringify({
  ok: true,
  cityId: city.id,
  providerId,
  layerKey,
  samplePath,
  direct: {
    featureCount: directResult.stats.featuresInserted,
    sourceFormat: directResult.stats.sourceFormat,
  },
  bimPayload: {
    payloadType: bimPayload.payloadType,
    recordCounts: bimPayload.recordCounts,
    nativeGeometry: {
      state: bimPayload.nativeGeometry.state,
      elementMeshCount: bimPayload.nativeGeometry.elementMeshCount,
      elementsWithGeometry: bimPayload.nativeGeometry.elementsWithGeometry,
      geometryReferenceCount: bimPayload.nativeGeometry.geometryReferenceCount,
      vertexBufferValueCount: bimPayload.nativeGeometry.vertexBufferValueCount,
      indexValueCount: bimPayload.nativeGeometry.indexValueCount,
      meshAssetBytes: bimPayload.nativeGeometry.meshAssetBytes,
      assetBundleState: bundle.state,
      bundleId: bundle.bundleId,
      totalBytes: bundle.totalBytes,
      manifestHref: bundle.manifest.href,
    },
  },
}, null, 2))
