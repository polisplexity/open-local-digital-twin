import { createHash } from 'node:crypto'
import {
  ingestGeoJsonProviderLayer,
  registerProviderLayerPackage,
} from '../../db/productionTwinStore.mjs'
import { cityJsonToGeoJson } from './formatConverters.mjs'
import {
  ifcSummaryToGeoJson,
  summarizeIfcNativeGeometry,
  summarizeIfcText,
} from './ifcIngestion.mjs'
import {
  fetchTextFromUri,
  parseJsonText,
} from './sourceAdapters.mjs'
import {
  DEFAULT_MAX_CITYJSON_BYTES,
  DEFAULT_MAX_IFC_BYTES,
  numberEnv,
} from './actionConfig.mjs'

export async function ingestProviderCityJsonLayer(cityConfig, layerKey, body = {}) {
  const sourceUri = String(body.sourceUri ?? body.source_uri ?? '').trim()
  if (!body.cityjson && !body.cityJson && !body.city_json && !sourceUri) {
    throw new Error('CITYJSON_OR_SOURCE_URI_REQUIRED')
  }

  const maxBytes = numberEnv('TWIN_STUDIO_CITYJSON_MAX_BYTES', DEFAULT_MAX_CITYJSON_BYTES)
  const cityjson = body.cityjson ?? body.cityJson ?? body.city_json ?? parseJsonText(
    await fetchTextFromUri(sourceUri, {
      accept: 'application/city+json, application/json;q=0.9, */*;q=0.1',
      maxBytes,
      errorPrefix: 'CITYJSON',
    }),
    'CITYJSON_PARSE_FAILED',
  )
  const converted = cityJsonToGeoJson(cityjson, body)

  return ingestGeoJsonProviderLayer(cityConfig, {
    ...body,
    layerKey,
    geojson: converted.geojson,
    sourceFormat: 'cityjson',
    sourceKind: 'provider-cityjson',
    sourceName: body.sourceName ?? body.source_name ?? `${layerKey}-cityjson`,
    sourceUri: sourceUri || null,
    sourceArtifactPayload: cityjson,
    sourceArtifactMetadata: {
      ...converted.stats,
      extractionMode: 'cityobject-centroid',
    },
    validationSummary: {
      state: 'passed-basic-cityjson-validation',
      ...converted.stats,
      extractionMode: 'cityobject-centroid',
      ...(body.validationSummary ?? body.validation_summary ?? {}),
    },
    metadata: {
      ...(body.metadata ?? {}),
      cityjson: {
        version: cityjson.version ?? null,
        referenceSystem: cityjson?.metadata?.referenceSystem ?? null,
        extractionMode: 'cityobject-centroid',
      },
    },
  })
}

export async function ingestProviderIfcLayer(cityConfig, layerKey, body = {}) {
  const sourceUri = String(body.sourceUri ?? body.source_uri ?? '').trim()
  const ifcText = String(body.ifcText ?? body.ifc_text ?? body.ifc ?? '').trim()
  if (!ifcText && !sourceUri) {
    throw new Error('IFC_TEXT_OR_SOURCE_URI_REQUIRED')
  }

  const maxBytes = numberEnv('TWIN_STUDIO_IFC_MAX_BYTES', DEFAULT_MAX_IFC_BYTES)
  const sourceText = ifcText || await fetchTextFromUri(sourceUri, {
    accept: 'application/x-step, application/step, text/plain, application/octet-stream;q=0.8, */*;q=0.1',
    maxBytes,
    errorPrefix: 'IFC',
  })
  const summary = summarizeIfcText(sourceText, body)
  const sourceHash = createHash('sha256').update(sourceText).digest('hex')
  summary.sourceHash = sourceHash
  summary.nativeGeometry = await summarizeIfcNativeGeometry(sourceText, {
    cityId: cityConfig.id,
    layerKey,
    sourceHash,
  })
  const geojson = ifcSummaryToGeoJson(summary, layerKey)
  const validationState = geojson.features.length
    ? 'passed-basic-ifc-bim-record-extraction'
    : 'passed-basic-ifc-metadata-extraction-no-anchor'

  if (!geojson.features.length) {
    return registerProviderLayerPackage(cityConfig, {
      ...body,
      layerKey,
      sourceFormat: 'ifc',
      sourceKind: 'provider-ifc',
      sourceName: body.sourceName ?? body.source_name ?? `${layerKey}-ifc`,
      sourceUri: sourceUri || null,
      metadata: {
        ...(body.metadata ?? {}),
        ifc: summary,
      },
      payload: {
        sourceFormat: 'ifc',
        sourceUri: sourceUri || null,
        summary,
        extractedAt: new Date().toISOString(),
      },
      validationSummary: {
        state: validationState,
        sourceFormat: 'ifc',
        hasSourceUri: Boolean(sourceUri),
        entityCount: summary.entityCount,
        spatialRecordCount: summary.spatialRecords.length,
        propertySetCount: summary.propertySetStats.propertySetCount,
        propertyCount: summary.propertySetStats.propertyCount,
        schema: summary.schema,
        nativeGeometry: summary.nativeGeometry,
        warnings: ['IFC_GEOREFERENCE_NOT_FOUND'],
        ...(body.validationSummary ?? body.validation_summary ?? {}),
      },
    })
  }

  return ingestGeoJsonProviderLayer(cityConfig, {
    ...body,
    layerKey,
    geojson,
    sourceFormat: 'ifc',
    sourceKind: 'provider-ifc',
    sourceName: body.sourceName ?? body.source_name ?? `${layerKey}-ifc`,
    sourceUri: sourceUri || null,
    sourceArtifactPayload: {
      sourceFormat: 'ifc',
      sourceUri: sourceUri || null,
      summary,
      extractedAt: new Date().toISOString(),
    },
    sourceArtifactMetadata: {
      extractionMode: 'ifc-step-site-anchor',
      entityCount: summary.entityCount,
      spatialRecordCount: summary.spatialRecords.length,
      propertySetCount: summary.propertySetStats.propertySetCount,
      propertyCount: summary.propertySetStats.propertyCount,
      schema: summary.schema,
      hasIfcSiteGeoreference: summary.hasIfcSiteGeoreference,
      hasDeclaredAnchor: summary.hasDeclaredAnchor,
      nativeGeometry: summary.nativeGeometry,
    },
    validationSummary: {
      state: validationState,
      sourceFormat: 'ifc',
      entityCount: summary.entityCount,
      spatialRecordCount: summary.spatialRecords.length,
      propertySetCount: summary.propertySetStats.propertySetCount,
      propertyCount: summary.propertySetStats.propertyCount,
      schema: summary.schema,
      nativeGeometry: summary.nativeGeometry,
      extractionMode: 'ifc-step-site-anchor',
      ...(body.validationSummary ?? body.validation_summary ?? {}),
    },
    metadata: {
      ...(body.metadata ?? {}),
      ifc: summary,
    },
  })
}
