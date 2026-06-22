import {
  ingestGeoJsonProviderLayer,
  registerProviderLayerPackage,
} from '../../db/productionTwinStore.mjs'
import { stacDocumentToGeoJson } from './formatConverters.mjs'
import {
  fetchTextFromUri,
  inspectProviderPackage,
  parseJsonText,
} from './sourceAdapters.mjs'
import {
  DEFAULT_MAX_STAC_BYTES,
  PACKAGE_FORMATS,
  numberEnv,
} from './actionConfig.mjs'

export async function ingestProviderStacLayer(cityConfig, layerKey, body = {}) {
  const sourceUri = String(body.sourceUri ?? body.source_uri ?? '').trim()
  if (!body.stac && !sourceUri) {
    throw new Error('STAC_OR_SOURCE_URI_REQUIRED')
  }

  const maxBytes = numberEnv('TWIN_STUDIO_STAC_MAX_BYTES', DEFAULT_MAX_STAC_BYTES)
  const stac = body.stac ?? parseJsonText(
    await fetchTextFromUri(sourceUri, {
      accept: 'application/geo+json, application/json;q=0.9, */*;q=0.1',
      maxBytes,
      errorPrefix: 'STAC',
    }),
    'STAC_PARSE_FAILED',
  )
  const converted = stacDocumentToGeoJson(stac)

  return ingestGeoJsonProviderLayer(cityConfig, {
    ...body,
    layerKey,
    geojson: converted.geojson,
    sourceFormat: 'stac',
    sourceKind: 'provider-stac',
    sourceName: body.sourceName ?? body.source_name ?? `${layerKey}-stac`,
    sourceUri: sourceUri || null,
    sourceArtifactPayload: stac,
    sourceArtifactMetadata: {
      ...converted.stats,
      extractionMode: 'stac-item-footprints',
    },
    validationSummary: {
      state: 'passed-basic-stac-validation',
      ...converted.stats,
      extractionMode: 'stac-item-footprints',
      ...(body.validationSummary ?? body.validation_summary ?? {}),
    },
    metadata: {
      ...(body.metadata ?? {}),
      stac: {
        stacType: stac.type ?? null,
        stacVersion: stac.stac_version ?? null,
        extractionMode: 'stac-item-footprints',
      },
    },
  })
}

export async function registerProviderPackageMetadataLayer(cityConfig, layerKey, body = {}) {
  const sourceFormat = String(body.sourceFormat ?? body.source_format ?? '').trim()
  if (!sourceFormat || !PACKAGE_FORMATS.has(sourceFormat)) {
    throw new Error('PACKAGE_SOURCE_FORMAT_UNSUPPORTED')
  }

  const sourceUri = String(body.sourceUri ?? body.source_uri ?? '').trim()
  const metadata = body.metadata ?? {}
  if (!sourceUri && !Object.keys(metadata).length) {
    throw new Error('PACKAGE_SOURCE_URI_OR_METADATA_REQUIRED')
  }

  return registerProviderLayerPackage(cityConfig, {
    ...body,
    layerKey,
    sourceFormat,
    sourceKind: `provider-${sourceFormat}`,
    sourceName: body.sourceName ?? body.source_name ?? `${layerKey}-${sourceFormat}`,
    sourceUri: sourceUri || null,
    payload: {
      sourceFormat,
      sourceUri: sourceUri || null,
      metadata,
      declaredAt: new Date().toISOString(),
    },
    validationSummary: {
      state: 'metadata-registered',
      sourceFormat,
      hasSourceUri: Boolean(sourceUri),
      ...(body.validationSummary ?? body.validation_summary ?? {}),
    },
  })
}

export async function inspectAndRegisterProviderPackageLayer(cityConfig, layerKey, body = {}) {
  const sourceFormat = String(body.sourceFormat ?? body.source_format ?? '').trim()
  if (!sourceFormat || !PACKAGE_FORMATS.has(sourceFormat)) {
    throw new Error('PACKAGE_SOURCE_FORMAT_UNSUPPORTED')
  }

  const sourceUri = String(body.sourceUri ?? body.source_uri ?? '').trim()
  const baseMetadata = body.metadata ?? {}
  const inspection = await inspectProviderPackage(sourceFormat, sourceUri, baseMetadata)
  return registerProviderLayerPackage(cityConfig, {
    ...body,
    layerKey,
    sourceFormat,
    sourceKind: `provider-${sourceFormat}`,
    sourceName: body.sourceName ?? body.source_name ?? `${layerKey}-${sourceFormat}`,
    sourceUri: sourceUri || null,
    metadata: {
      ...baseMetadata,
      inspection,
    },
    payload: {
      sourceFormat,
      sourceUri: sourceUri || null,
      metadata: baseMetadata,
      inspection,
      inspectedAt: new Date().toISOString(),
    },
    validationSummary: {
      state: inspection.state,
      sourceFormat,
      hasSourceUri: Boolean(sourceUri),
      warnings: inspection.warnings ?? [],
      ...(body.validationSummary ?? body.validation_summary ?? {}),
    },
  })
}
