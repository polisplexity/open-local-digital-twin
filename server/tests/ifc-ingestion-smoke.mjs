import pg from 'pg'
import {
  getCityLayerBimPayload,
  getLayerIngestionJob,
  listCityLayerRegistry,
  upsertCityProviderLayer,
  upsertRegisteredProvider,
} from '../db/productionTwinStore.mjs'
import { findCityConfig, getActiveCityConfig } from '../services/cityRegistry.mjs'
import {
  enqueueProviderLayerIngestionJob,
  ingestProviderIfcLayer,
  runProviderLayerIngestionJob,
} from '../services/providerLayerIngestionService.mjs'

const { Pool } = pg

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function cityFromArgs() {
  const cityArg = process.argv.find((arg) => arg.startsWith('--city='))
  const cityId = cityArg ? cityArg.slice('--city='.length) : process.env.TWIN_STUDIO_E2E_CITY_ID
  return cityId ? findCityConfig(cityId) : getActiveCityConfig()
}

const city = cityFromArgs()
assert(city?.id, 'CITY_NOT_FOUND')

const providerId = 'e2e-ifc-provider'
const layerKey = 'e2e-ifc-anchor'
const runNonce = String(Date.now())
const ifcText = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('e2e.ifc','2026-05-10T00:00:00',('Twin Base Studio'),('Polisplexity'),'Twin Base Studio','Twin Base Studio','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1= IFCPROJECT('0ProjectGuid',$,'E2E IFC Project',$,$,$,$,$);
#2= IFCBUILDING('0BuildingGuid',$,'E2E Municipal Building',$,$,$,$,$,$,$,$,$);
#3= IFCSITE('0SiteGuid',$,'E2E IFC Site',$,$,$,$,$,.ELEMENT.,(57,4,32,160000),(24,20,14,640000),12.5,$,$);
#4= IFCBUILDINGSTOREY('0StoreyGuid',$,'Ground floor',$,$,$,$,$,$);
#5= IFCSPACE('0SpaceGuid',$,'Public service room',$,$,$,$,$,$,$);
#6= IFCRELAGGREGATES('0RelProjectSite',$,$,$,#1,(#3));
#7= IFCRELAGGREGATES('0RelSiteBuilding',$,$,$,#3,(#2));
#8= IFCRELAGGREGATES('0RelBuildingStorey',$,$,$,#2,(#4));
#9= IFCRELCONTAINEDINSPATIALSTRUCTURE('0RelStoreySpace',$,$,$,(#5),#4);
#10= IFCPROPERTYSINGLEVALUE('IsExternal',$,IFCBOOLEAN(.F.),$);
#11= IFCPROPERTYSINGLEVALUE('OccupancyType',$,IFCLABEL('Public service'),$);
#12= IFCPROPERTYSET('0SpacePsetGuid',$,'Pset_SpaceCommon',$,(#10,#11));
#13= IFCRELDEFINESBYPROPERTIES('0SpacePropsRel',$,$,$,(#5),#12);
ENDSEC;
END-ISO-10303-21;`

await upsertRegisteredProvider({
  id: providerId,
  name: 'E2E IFC Provider',
  providerType: 'bim-provider',
  metadata: {
    purpose: 'repeatable IFC ingestion smoke test',
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
  name: 'E2E IFC Anchor',
  layerFamily: 'bim',
  geometryType: 'Point',
  authorityStatus: 'provider-supplied',
  accessLevel: 'city-private',
  providerId,
})

const directResult = await ingestProviderIfcLayer(city, layerKey, {
  sourceName: 'e2e-ifc-inline-direct',
  sourceFormat: 'ifc',
  connectorKey: 'ifc-package',
  submittedBy: 'e2e-ifc-smoke',
  ifcText,
  metadata: {
    e2e: true,
    mode: 'direct',
  },
})
assert(directResult.ok, `IFC_DIRECT_INGEST_FAILED:${directResult.error ?? 'unknown'}`)
assert(Number(directResult.stats?.featuresInserted ?? 0) === 4, 'IFC_DIRECT_BIM_RECORDS_NOT_INSERTED')

const queueResult = await enqueueProviderLayerIngestionJob(city, layerKey, {
  action: 'package',
  sourceFormat: 'ifc',
  sourceVersion: runNonce,
  sourceName: 'e2e-ifc-inline-queued',
  submittedBy: 'e2e-ifc-smoke',
  connectorKey: 'ifc-package',
  ifcText,
  metadata: {
    e2e: true,
    mode: 'queued',
    nonce: runNonce,
  },
})
assert(queueResult.ok, `IFC_QUEUE_FAILED:${queueResult.error ?? 'unknown'}`)

const runResult = await runProviderLayerIngestionJob(queueResult.jobId, {
  workerId: 'e2e-ifc-smoke',
  submittedBy: 'e2e-ifc-smoke',
})
assert(runResult.ok, `IFC_JOB_RUN_FAILED:${runResult.error ?? 'unknown'}`)

const job = await getLayerIngestionJob(queueResult.jobId)
assert(job.ok && job.job?.status === 'completed', `IFC_JOB_NOT_COMPLETED:${job.job?.status ?? job.error}`)

const registry = await listCityLayerRegistry(city.id)
const ifcLayer = registry.layers.find((layer) => layer.key === layerKey)
assert(Number(ifcLayer?.featureCount ?? 0) >= 4, 'IFC_LAYER_FEATURE_NOT_STORED')

const bimPayload = await getCityLayerBimPayload(city.id, layerKey)
assert(bimPayload.ok, `IFC_BIM_PAYLOAD_FAILED:${bimPayload.error ?? 'unknown'}`)
assert(bimPayload.anchor?.recordType === 'model-anchor', 'IFC_BIM_PAYLOAD_ANCHOR_MISSING')
assert(bimPayload.nativeGeometry?.tool === 'web-ifc', 'IFC_NATIVE_GEOMETRY_TOOL_MISSING')
assert(
  bimPayload.nativeGeometry?.state === 'inspected-no-native-element-geometry',
  `IFC_NATIVE_GEOMETRY_STATE_UNEXPECTED:${bimPayload.nativeGeometry?.state ?? 'missing'}`,
)
assert(
  bimPayload.nativeGeometry?.meshAssetBundle?.state === 'no-native-element-geometry-assets',
  `IFC_MESH_ASSET_BUNDLE_STATE_UNEXPECTED:${bimPayload.nativeGeometry?.meshAssetBundle?.state ?? 'missing'}`,
)
assert(Number(bimPayload.recordCounts?.space ?? 0) >= 1, 'IFC_BIM_PAYLOAD_SPACE_MISSING')
assert(
  bimPayload.nodes.some((node) => node.propertySets?.Pset_SpaceCommon?.properties?.OccupancyType === 'Public service'),
  'IFC_BIM_PAYLOAD_PROPERTY_SET_MISSING',
)

const pool = new Pool({ connectionString: process.env.TWIN_STUDIO_DATABASE_URL })
try {
  const propertyResult = await pool.query(
    `
      SELECT properties
      FROM city_features
      WHERE city_id = $1
        AND feature_type = $2
        AND properties->>'ifc_record_type' = 'space'
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [city.id, layerKey],
  )
  const spaceProperties = propertyResult.rows[0]?.properties ?? {}
  assert(
    spaceProperties.ifc_property_sets?.Pset_SpaceCommon?.properties?.OccupancyType === 'Public service',
    'IFC_PROPERTY_SET_NOT_STORED',
  )
} finally {
  await pool.end()
}

console.log(JSON.stringify({
  ok: true,
  cityId: city.id,
  providerId,
  layerKey,
  direct: {
    featureCount: directResult.stats.featuresInserted,
    sourceFormat: directResult.stats.sourceFormat,
  },
  queued: {
    jobId: queueResult.jobId,
    status: job.job.status,
    featureCount: ifcLayer.featureCount,
  },
  bimPayload: {
    payloadType: bimPayload.payloadType,
    recordCounts: bimPayload.recordCounts,
    nativeGeometry: {
      state: bimPayload.nativeGeometry.state,
      geometryReferenceCount: bimPayload.nativeGeometry.geometryReferenceCount,
      assetBundleState: bimPayload.nativeGeometry.meshAssetBundle.state,
    },
  },
}, null, 2))
