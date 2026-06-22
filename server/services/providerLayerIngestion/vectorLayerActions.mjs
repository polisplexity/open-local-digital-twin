import { ingestGeoJsonProviderLayer } from '../../db/productionTwinStore.mjs'
import {
  csvRowsToGeoJson,
  parseCsv,
} from './formatConverters.mjs'
import {
  assertGeoJsonFeatureCollection,
  fetchGeoJsonFromUri,
  fetchOgcFeatureCollection,
  fetchTextFromUri,
  nativeVectorPackageToGeoJson,
} from './sourceAdapters.mjs'
import {
  DEFAULT_MAX_CSV_BYTES,
  numberEnv,
} from './actionConfig.mjs'

export async function ingestProviderGeoJsonLayer(cityConfig, layerKey, body = {}) {
  const sourceUri = String(body.sourceUri ?? body.source_uri ?? '').trim()
  if (!body.geojson && !sourceUri) {
    throw new Error('GEOJSON_OR_SOURCE_URI_REQUIRED')
  }
  const geojson = body.geojson
    ? assertGeoJsonFeatureCollection(body.geojson)
    : await fetchGeoJsonFromUri(sourceUri)

  return ingestGeoJsonProviderLayer(cityConfig, {
    ...body,
    layerKey,
    geojson,
    sourceUri: sourceUri || body.sourceUri || body.source_uri || null,
    validationSummary: {
      state: 'passed-basic-geojson-validation',
      featureCount: geojson.features.length,
      ...(body.validationSummary ?? body.validation_summary ?? {}),
    },
  })
}

export async function ingestProviderCsvLayer(cityConfig, layerKey, body = {}) {
  const sourceUri = String(body.sourceUri ?? body.source_uri ?? '').trim()
  const csvText = String(body.csvText ?? body.csv_text ?? body.csv ?? '').trim()
  if (!csvText && !sourceUri) {
    throw new Error('CSV_OR_SOURCE_URI_REQUIRED')
  }

  const maxBytes = numberEnv('TWIN_STUDIO_CSV_MAX_BYTES', DEFAULT_MAX_CSV_BYTES)
  const sourceText = csvText || await fetchTextFromUri(sourceUri, {
    accept: 'text/csv, application/csv, text/plain;q=0.8, */*;q=0.1',
    maxBytes,
    errorPrefix: 'CSV',
  })
  if (Buffer.byteLength(sourceText, 'utf8') > maxBytes) {
    throw new Error(`CSV_SOURCE_TOO_LARGE:${maxBytes}`)
  }

  const rows = parseCsv(sourceText, body.delimiter || ',')
  const converted = csvRowsToGeoJson(rows, body)

  return ingestGeoJsonProviderLayer(cityConfig, {
    ...body,
    layerKey,
    geojson: converted.geojson,
    sourceFormat: 'csv',
    sourceKind: 'provider-csv',
    sourceName: body.sourceName ?? body.source_name ?? `${layerKey}-csv`,
    sourceUri: sourceUri || null,
    sourceArtifactPayload: sourceText,
    sourceArtifactMetadata: {
      rowsRead: converted.stats.rowsRead,
      rowsConverted: converted.stats.rowsConverted,
      rowsSkipped: converted.stats.rowsSkipped,
    },
    validationSummary: {
      state: 'passed-basic-csv-validation',
      ...converted.stats,
      ...(body.validationSummary ?? body.validation_summary ?? {}),
    },
    metadata: {
      ...(body.metadata ?? {}),
      csv: {
        delimiter: body.delimiter || ',',
        geometryMode: converted.geojson.features[0]?.geometry?.type === 'Point' ? 'point' : 'geometry-field',
      },
    },
  })
}

export async function ingestProviderOgcFeaturesLayer(cityConfig, layerKey, body = {}) {
  const sourceUri = String(body.sourceUri ?? body.source_uri ?? '').trim()
  if (!sourceUri) {
    throw new Error('OGC_SOURCE_URI_REQUIRED')
  }

  const fetched = await fetchOgcFeatureCollection(sourceUri)
  return ingestGeoJsonProviderLayer(cityConfig, {
    ...body,
    layerKey,
    geojson: fetched.geojson,
    sourceFormat: body.sourceFormat ?? body.source_format ?? 'ogc-api-features',
    sourceKind: 'provider-ogc-features',
    sourceName: body.sourceName ?? body.source_name ?? `${layerKey}-ogc-features`,
    sourceUri,
    validationSummary: {
      state: 'passed-basic-ogc-feature-validation',
      featureCount: fetched.geojson.features.length,
      pagesFetched: fetched.pagesFetched,
      ...(body.validationSummary ?? body.validation_summary ?? {}),
    },
    metadata: {
      ...(body.metadata ?? {}),
      ogc: {
        pagesFetched: fetched.pagesFetched,
      },
    },
  })
}

export async function ingestNativeVectorPackageLayer(cityConfig, layerKey, body = {}) {
  const sourceFormat = String(body.sourceFormat ?? body.source_format ?? '').trim()
  if (!['shapefile', 'geopackage'].includes(sourceFormat)) {
    throw new Error('NATIVE_VECTOR_SOURCE_FORMAT_UNSUPPORTED')
  }
  const sourceUri = String(body.sourceUri ?? body.source_uri ?? '').trim()
  const converted = await nativeVectorPackageToGeoJson(sourceFormat, sourceUri, body)

  return ingestGeoJsonProviderLayer(cityConfig, {
    ...body,
    layerKey,
    geojson: converted.geojson,
    sourceFormat,
    sourceKind: `provider-${sourceFormat}`,
    sourceName: body.sourceName ?? body.source_name ?? `${layerKey}-${sourceFormat}`,
    sourceUri,
    sourceArtifactPayload: {
      sourceFormat,
      sourceUri,
      extraction: converted.stats,
    },
    sourceArtifactMetadata: {
      ...converted.stats,
      extractionMode: 'gdal-ogr2ogr-vector',
    },
    validationSummary: {
      state: 'passed-native-vector-extraction',
      ...converted.stats,
      extractionMode: 'gdal-ogr2ogr-vector',
      ...(body.validationSummary ?? body.validation_summary ?? {}),
    },
    metadata: {
      ...(body.metadata ?? {}),
      nativeVector: {
        sourceFormat,
        tool: 'ogr2ogr',
        extractionMode: 'gdal-ogr2ogr-vector',
      },
    },
  })
}
