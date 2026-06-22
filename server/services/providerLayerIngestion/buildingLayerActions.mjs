import { ingestGeoJsonProviderLayer } from '../../db/productionTwinStore.mjs'
import {
  queryOvertureBuildings,
  queryOvertureRoads,
} from './sourceAdapters.mjs'

export async function ingestOvertureBuildingsLayer(cityConfig, layerKey, body = {}) {
  const queried = await queryOvertureBuildings(cityConfig, body)

  return ingestGeoJsonProviderLayer(cityConfig, {
    ...body,
    layerKey,
    geojson: queried.geojson,
    sourceFormat: 'overture-buildings',
    sourceKind: 'provider-overture-buildings',
    sourceName: body.sourceName ?? body.source_name ?? `${layerKey}-overture-buildings`,
    sourceUri: queried.sourceUri,
    sourceArtifactPayload: {
      sourceFormat: 'overture-buildings',
      sourceUri: queried.sourceUri,
      bbox: queried.bbox,
      extractedAt: new Date().toISOString(),
      stats: queried.stats,
    },
    sourceArtifactMetadata: {
      ...queried.stats,
      extractionMode: 'overturemaps-cli-bbox',
    },
    validationSummary: {
      state: 'passed-overture-buildings-extraction',
      ...queried.stats,
      extractionMode: 'overturemaps-cli-bbox',
      ...(body.validationSummary ?? body.validation_summary ?? {}),
    },
    metadata: {
      ...(body.metadata ?? {}),
      overture: {
        theme: 'buildings',
        type: 'building',
        sourceUri: queried.sourceUri,
        bbox: queried.bbox,
        extractionMode: 'overturemaps-cli-bbox',
        license: 'ODbL',
      },
    },
    authorityStatus: body.authorityStatus ?? body.authority_status ?? 'open-candidate',
    confidence: body.confidence ?? 'candidate',
  })
}

export async function ingestOvertureRoadsLayer(cityConfig, layerKey, body = {}) {
  const queried = await queryOvertureRoads(cityConfig, body)

  return ingestGeoJsonProviderLayer(cityConfig, {
    ...body,
    layerKey,
    geojson: queried.geojson,
    sourceFormat: 'overture-roads',
    sourceKind: 'provider-overture-roads',
    sourceName: body.sourceName ?? body.source_name ?? `${layerKey}-overture-roads`,
    sourceUri: queried.sourceUri,
    sourceArtifactPayload: {
      sourceFormat: 'overture-roads',
      sourceUri: queried.sourceUri,
      bbox: queried.bbox,
      extractedAt: new Date().toISOString(),
      stats: queried.stats,
    },
    sourceArtifactMetadata: {
      ...queried.stats,
      extractionMode: 'overturemaps-cli-bbox',
    },
    validationSummary: {
      state: 'passed-overture-roads-extraction',
      ...queried.stats,
      extractionMode: 'overturemaps-cli-bbox',
      ...(body.validationSummary ?? body.validation_summary ?? {}),
    },
    metadata: {
      ...(body.metadata ?? {}),
      overture: {
        theme: 'transportation',
        type: 'segment',
        sourceUri: queried.sourceUri,
        bbox: queried.bbox,
        extractionMode: 'overturemaps-cli-bbox',
        license: 'ODbL',
      },
    },
    authorityStatus: body.authorityStatus ?? body.authority_status ?? 'open-candidate',
    confidence: body.confidence ?? 'candidate',
  })
}
