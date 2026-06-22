import {
  ingestNativeVectorPackageLayer,
  ingestProviderCsvLayer,
  ingestProviderGeoJsonLayer,
  ingestProviderOgcFeaturesLayer,
} from './providerLayerIngestion/vectorLayerActions.mjs'
import {
  ingestOvertureBuildingsLayer,
  ingestOvertureRoadsLayer,
} from './providerLayerIngestion/buildingLayerActions.mjs'
import {
  ingestProviderCityJsonLayer,
  ingestProviderIfcLayer,
} from './providerLayerIngestion/modelLayerActions.mjs'
import {
  ingestProviderStacLayer,
  inspectAndRegisterProviderPackageLayer,
  registerProviderPackageMetadataLayer,
} from './providerLayerIngestion/packageLayerActions.mjs'
import { ingestOsmLocalExtractLayer } from './providerLayerIngestion/osmLocalExtractActions.mjs'
import { refreshMvtCacheLayer } from './providerLayerIngestion/mvtCacheRefreshActions.mjs'
import {
  enqueueProviderLayerIngestionJob as enqueueProviderLayerIngestionJobCore,
  listProviderLayerIngestionJobReport as listProviderLayerIngestionJobReportCore,
  runProviderLayerIngestionJob as runProviderLayerIngestionJobCore,
  runQueuedProviderLayerIngestionJobs as runQueuedProviderLayerIngestionJobsCore,
} from './providerLayerIngestion/jobOrchestration.mjs'
import { inspectProviderIngestionCapabilities } from './providerLayerIngestion/capabilityRegistry.mjs'

const providerIngestionHandlers = {
  geojson: ingestProviderGeoJsonLayer,
  csv: ingestProviderCsvLayer,
  ogcFeatures: ingestProviderOgcFeaturesLayer,
  stac: ingestProviderStacLayer,
  cityJson: ingestProviderCityJsonLayer,
  overtureBuildings: ingestOvertureBuildingsLayer,
  overtureRoads: ingestOvertureRoadsLayer,
  osmLocalExtract: ingestOsmLocalExtractLayer,
  mvtCacheRefresh: refreshMvtCacheLayer,
  nativeVectorPackage: ingestNativeVectorPackageLayer,
  ifc: ingestProviderIfcLayer,
  inspectPackage: inspectAndRegisterProviderPackageLayer,
}

export {
  ingestNativeVectorPackageLayer,
  ingestOvertureBuildingsLayer,
  ingestOvertureRoadsLayer,
  ingestOsmLocalExtractLayer,
  refreshMvtCacheLayer,
  ingestProviderCityJsonLayer,
  ingestProviderCsvLayer,
  ingestProviderGeoJsonLayer,
  ingestProviderIfcLayer,
  ingestProviderOgcFeaturesLayer,
  ingestProviderStacLayer,
  inspectAndRegisterProviderPackageLayer,
  registerProviderPackageMetadataLayer,
}

export async function enqueueProviderLayerIngestionJob(cityConfig, layerKey, body = {}) {
  return enqueueProviderLayerIngestionJobCore(cityConfig, layerKey, body)
}

export async function runProviderLayerIngestionJob(jobId, options = {}) {
  return runProviderLayerIngestionJobCore(jobId, options, providerIngestionHandlers)
}

export async function listProviderLayerIngestionJobReport(jobId, limit = 250) {
  return listProviderLayerIngestionJobReportCore(jobId, limit)
}

export async function runQueuedProviderLayerIngestionJobs(options = {}) {
  return runQueuedProviderLayerIngestionJobsCore(options, providerIngestionHandlers)
}

export { inspectProviderIngestionCapabilities }
