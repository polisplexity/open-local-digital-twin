import { closeSharedProductionPool, withProductionClient as withClient } from './serviceDatabase.mjs'

const DEFAULT_CITY_IDS = []
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000

const COLLECTION_KEYS_BY_ENTITY_TYPE = new Map([
  ['building', 'buildings'],
  ['road', 'roads'],
  ['facility', 'facilities'],
  ['place', 'places'],
  ['land_use', 'land-use'],
  ['green_blue_system', 'green-blue-systems'],
  ['mobility_asset', 'mobility-assets'],
  ['sensor', 'sensors'],
])

const JSONLD_CONTEXT_ALIASES = new Map([
  ['dcat', 'twin-base-studio-dcat'],
  ['ngsi-ld', 'twin-base-studio-ngsi-ld'],
])

export async function closeLdtInteropPool() {
  await closeSharedProductionPool()
}

function parsePositiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(parsed, max)
}

function parseLimit(value) {
  return parsePositiveInteger(value, DEFAULT_LIMIT, MAX_LIMIT)
}

function collectionKeyForEntityType(entityType) {
  return COLLECTION_KEYS_BY_ENTITY_TYPE.get(entityType) ?? String(entityType).replaceAll('_', '-')
}

function entityTypeForCollection(collectionKey) {
  for (const [entityType, key] of COLLECTION_KEYS_BY_ENTITY_TYPE.entries()) {
    if (key === collectionKey) return entityType
  }
  return String(collectionKey ?? '').replaceAll('-', '_')
}

function normalizedBaseUrl(baseUrl) {
  return String(baseUrl || 'http://localhost:3000').replace(/\/+$/, '')
}

function parseBbox(raw) {
  if (!raw) return null
  const parts = String(raw).split(',').map((part) => Number(part.trim()))
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error('INVALID_BBOX')
  }
  const [minx, miny, maxx, maxy] = parts
  if (minx >= maxx || miny >= maxy) throw new Error('INVALID_BBOX')
  return { minx, miny, maxx, maxy }
}

function modelDatasetIdentifier(cityId, modelKey, modelVersion) {
  return [
    'tbs:model-enrichment',
    cityId,
    String(modelKey ?? 'model').replace(/[^A-Za-z0-9._~-]+/g, '-'),
    String(modelVersion ?? 'unknown').replace(/[^A-Za-z0-9._~-]+/g, '-'),
  ].join(':')
}

function csvCell(value) {
  if (value == null) return ''
  const normalized = value instanceof Date ? value.toISOString() : value
  const text = typeof normalized === 'object' ? JSON.stringify(normalized) : String(normalized)
  return `"${text.replaceAll('"', '""')}"`
}

function outputCellValue(output) {
  if (!output || typeof output !== 'object') return ''
  if (output.valueNumeric != null) return output.valueNumeric
  if (output.valueText != null) return output.valueText
  if (output.value?.value != null) return output.value.value
  if (output.value != null && Object.keys(output.value).length > 0) return output.value
  return ''
}

async function listCityIds(client, requestedCityIds) {
  if (requestedCityIds.length > 0) return requestedCityIds
  const result = await client.query('SELECT id FROM ldt_core.cities ORDER BY id')
  return result.rows.map((row) => row.id)
}

async function cityRecord(client, cityId) {
  const result = await client.query(
    `
      SELECT
        id,
        name,
        country,
        country_code,
        region,
        canonical_uri,
        ST_AsGeoJSON(centroid)::jsonb AS centroid
      FROM ldt_core.cities
      WHERE id = $1
    `,
    [cityId],
  )
  if (result.rowCount === 0) throw new Error(`LDT_CITY_NOT_FOUND:${cityId}`)
  return result.rows[0]
}

async function cityBbox(client, cityId) {
  const result = await client.query(
    `
      SELECT
        jsonb_build_array(
          ST_XMin(extent),
          ST_YMin(extent),
          ST_XMax(extent),
          ST_YMax(extent)
        ) AS bbox
      FROM (
        SELECT ST_Extent(geom)::box2d AS extent
        FROM ldt_core.city_boundaries
        WHERE city_id = $1
      ) scoped
      WHERE extent IS NOT NULL
    `,
    [cityId],
  )
  return result.rows[0]?.bbox ?? null
}

async function ensureOgcCollections(client, cityId) {
  await client.query(
    `
      INSERT INTO ldt_interop.ogc_collections (
        city_id,
        collection_key,
        title,
        entity_type,
        schema,
        metadata
      )
      SELECT
        $1,
        CASE et.entity_type
          WHEN 'building' THEN 'buildings'
          WHEN 'road' THEN 'roads'
          WHEN 'facility' THEN 'facilities'
          WHEN 'place' THEN 'places'
          WHEN 'land_use' THEN 'land-use'
          WHEN 'green_blue_system' THEN 'green-blue-systems'
          WHEN 'mobility_asset' THEN 'mobility-assets'
          WHEN 'sensor' THEN 'sensors'
          ELSE replace(et.entity_type, '_', '-')
        END,
        et.display_name,
        et.entity_type,
        jsonb_build_object(
          'type', 'object',
          'geometryModel', et.geometry_model,
          'standardsMapping', et.standards_mapping,
          'modelEnrichmentProperties', COALESCE(enrichment_counts.output_keys, ARRAY[]::text[])
        ),
        jsonb_build_object(
          'phase', 'phase-4-interop',
          'entityFamily', et.entity_family,
          'description', et.description,
          'featureCount', counts.feature_count,
          'modelEnrichmentEntityCount', COALESCE(enrichment_counts.entity_count, 0),
          'modelKeys', COALESCE(enrichment_counts.model_keys, ARRAY[]::text[]),
          'modelOutputKeys', COALESCE(enrichment_counts.output_keys, ARRAY[]::text[])
        )
      FROM ldt_core.entity_type_registry et
      JOIN (
        SELECT entity_type, count(*)::int AS feature_count
        FROM ldt_core.city_entities
        WHERE city_id = $1
        GROUP BY entity_type
      ) counts ON counts.entity_type = et.entity_type
      LEFT JOIN (
        SELECT
          ce.entity_type,
          count(DISTINCT summary.entity_id)::int AS entity_count,
          array_remove(array_agg(DISTINCT summary.model_key ORDER BY summary.model_key), NULL) AS model_keys,
          array_remove(array_agg(DISTINCT output_key ORDER BY output_key), NULL) AS output_keys
        FROM ldt_enrichment.entity_model_output_summary summary
        JOIN ldt_core.city_entities ce ON ce.id = summary.entity_id
        CROSS JOIN LATERAL jsonb_object_keys(summary.outputs) AS output_keys(output_key)
        WHERE summary.city_id = $1
        GROUP BY ce.entity_type
      ) enrichment_counts ON enrichment_counts.entity_type = et.entity_type
      WHERE et.enabled = true
      ON CONFLICT (city_id, collection_key) DO UPDATE SET
        title = EXCLUDED.title,
        entity_type = EXCLUDED.entity_type,
        schema = EXCLUDED.schema,
        metadata = EXCLUDED.metadata
    `,
    [cityId],
  )
}

async function buildModelEnrichmentDcatDatasets(client, cityId, baseUrl, cityName) {
  const base = normalizedBaseUrl(baseUrl)
  const result = await client.query(
    `
      SELECT
        summary.model_key,
        summary.model_version,
        count(DISTINCT summary.entity_id)::int AS entity_count,
        count(*)::int AS output_count,
        array_remove(array_agg(DISTINCT ce.entity_type ORDER BY ce.entity_type), NULL) AS entity_types,
        array_remove(
          array_agg(DISTINCT COALESCE(oc.collection_key, replace(ce.entity_type, '_', '-'))),
          NULL
        ) AS collection_keys,
        array_remove(array_agg(DISTINCT output_key ORDER BY output_key), NULL) AS output_keys,
        array_remove(array_agg(DISTINCT output_value->>'confidence' ORDER BY output_value->>'confidence'), NULL) AS confidence_statuses,
        array_remove(array_agg(DISTINCT output_value->>'authorityStatus' ORDER BY output_value->>'authorityStatus'), NULL) AS authority_statuses,
        min(summary.latest_generated_at) AS first_generated_at,
        max(summary.latest_generated_at) AS latest_generated_at,
        max(summary.latest_ingested_at) AS latest_ingested_at,
        COALESCE(run_meta.workflow_run_ids, ARRAY[]::text[]) AS workflow_run_ids,
        COALESCE(run_meta.source_artifact_ids, ARRAY[]::text[]) AS source_artifact_ids
      FROM ldt_enrichment.entity_model_output_summary summary
      JOIN ldt_core.city_entities ce ON ce.id = summary.entity_id
      LEFT JOIN ldt_interop.ogc_collections oc
        ON oc.city_id = summary.city_id
       AND oc.entity_type = ce.entity_type
      LEFT JOIN (
        SELECT
          city_id,
          model_key,
          model_version,
          array_remove(array_agg(DISTINCT workflow_run_id::text ORDER BY workflow_run_id::text), NULL) AS workflow_run_ids,
          array_remove(array_agg(DISTINCT source_artifact_id::text ORDER BY source_artifact_id::text), NULL) AS source_artifact_ids
        FROM ldt_enrichment.entity_model_outputs
        WHERE city_id = $1
        GROUP BY city_id, model_key, model_version
      ) run_meta
        ON run_meta.city_id = summary.city_id
       AND run_meta.model_key = summary.model_key
       AND run_meta.model_version = summary.model_version
      CROSS JOIN LATERAL jsonb_each(summary.outputs) AS output_keys(output_key, output_value)
      WHERE summary.city_id = $1
      GROUP BY summary.model_key, summary.model_version, run_meta.workflow_run_ids, run_meta.source_artifact_ids
      ORDER BY summary.model_key, summary.model_version
    `,
    [cityId],
  )

  return result.rows.map((row) => {
    const identifier = modelDatasetIdentifier(cityId, row.model_key, row.model_version)
    const entityTypes = Array.isArray(row.entity_types) ? row.entity_types : []
    const collectionKeys = Array.isArray(row.collection_keys) ? row.collection_keys : []
    const outputKeys = Array.isArray(row.output_keys) ? row.output_keys : []
    const confidenceStatuses = Array.isArray(row.confidence_statuses) ? row.confidence_statuses : []
    const authorityStatuses = Array.isArray(row.authority_statuses) ? row.authority_statuses : []
    const modelOutputQuery = `modelKey=${encodeURIComponent(row.model_key)}&modelVersion=${encodeURIComponent(row.model_version ?? '')}`
    return {
      '@id': `urn:polisplexity:ldt:dataset:${identifier}`,
      '@type': 'dcat:Dataset',
      'dct:identifier': identifier,
      'dct:title': `${cityName} ${row.model_key} model enrichment outputs`,
      'dct:description': `Derived entity-level model outputs published from ldt_enrichment for ${entityTypes.join(', ') || 'city entities'}.`,
      'dct:publisher': 'Polisplexity / Twin Base Studio',
      'dct:license': 'model-output-contract-review-required',
      'dct:accessRights': 'city-session',
      'dct:accrualPeriodicity': 'as-needed',
      'dct:issued': row.first_generated_at,
      'dct:modified': row.latest_ingested_at ?? row.latest_generated_at,
      'dcat:theme': ['model-enrichment', 'external-model-output', row.model_key].filter(Boolean),
      'dcat:keyword': outputKeys,
      'dcat:distribution': [
        {
          '@type': 'dcat:Distribution',
          'dct:title': 'Model enrichment outputs CSV',
          'dct:format': 'CSV',
          'dcat:mediaType': 'text/csv',
          'dcat:accessURL': `${base}/api/live/${cityId}/standards/model-outputs.csv?${modelOutputQuery}`,
          'dcat:downloadURL': `${base}/api/live/${cityId}/standards/model-outputs.csv?${modelOutputQuery}`,
        },
        {
          '@type': 'dcat:Distribution',
          'dct:title': 'NGSI-LD entities with model enrichment properties',
          'dct:format': 'JSON-LD',
          'dcat:mediaType': 'application/ld+json',
          'dcat:accessURL': `${base}/api/live/${cityId}/standards/ngsi-ld/entities?limit=100`,
        },
        ...collectionKeys.map((collectionKey) => ({
          '@type': 'dcat:Distribution',
          'dct:title': `OGC API Features ${collectionKey} items with model enrichment properties`,
          'dct:format': 'GeoJSON',
          'dcat:mediaType': 'application/geo+json',
          'dcat:accessURL': `${base}/api/live/${cityId}/standards/ogc/collections/${collectionKey}/items?limit=100`,
        })),
        {
          '@type': 'dcat:Distribution',
          'dct:title': 'TwinQuery model-output query endpoint',
          'dct:format': 'JSON',
          'dcat:mediaType': 'application/json',
          'dcat:accessURL': `${base}/api/live/${cityId}/twin-query`,
        },
      ],
      'tbs:quality': [
        {
          dimension: 'method',
          score: null,
          statement: 'Derived model output. Review model version, warnings, confidence, and source artifact before treating as authoritative.',
        },
      ],
      'tbs:metadata': {
        sourceTable: 'ldt_enrichment.entity_model_outputs',
        readModel: 'ldt_enrichment.entity_model_output_summary',
        modelKey: row.model_key,
        modelVersion: row.model_version,
        entityTypes,
        collectionKeys,
        outputKeys,
        confidenceStatuses,
        authorityStatuses,
        entityCount: Number(row.entity_count ?? 0),
        outputCount: Number(row.output_count ?? 0),
        workflowRunIds: Array.isArray(row.workflow_run_ids) ? row.workflow_run_ids : [],
        sourceArtifactIds: Array.isArray(row.source_artifact_ids) ? row.source_artifact_ids : [],
        latestGeneratedAt: row.latest_generated_at,
        latestIngestedAt: row.latest_ingested_at,
      },
    }
  })
}

export async function getModelOutputCsv(
  cityId,
  { modelKey, modelVersion = '', limit } = {},
) {
  if (!modelKey) throw new Error('MODEL_KEY_REQUIRED')
  return await withClient(async (client) => {
    const rowLimit = parseLimit(limit ?? 1000)
    const result = await client.query(
      `
        SELECT
          ce.stable_id,
          ce.entity_type,
          ce.label,
          ce.canonical_uri,
          summary.model_key,
          summary.model_version,
          summary.outputs,
          summary.latest_generated_at,
          summary.latest_ingested_at
        FROM ldt_enrichment.entity_model_output_summary summary
        JOIN ldt_core.city_entities ce ON ce.id = summary.entity_id
        WHERE summary.city_id = $1
          AND summary.model_key = $2
          AND summary.model_version = $3
        ORDER BY ce.entity_type, ce.stable_id
        LIMIT $4
      `,
      [cityId, modelKey, modelVersion, rowLimit],
    )
    const outputKeys = Array.from(new Set(
      result.rows.flatMap((row) => Object.keys(row.outputs ?? {})),
    )).sort()
    const headers = [
      'stable_id',
      'entity_type',
      'label',
      'canonical_uri',
      'model_key',
      'model_version',
      'latest_generated_at',
      'latest_ingested_at',
      ...outputKeys,
    ]
    const lines = [
      headers.map(csvCell).join(','),
      ...result.rows.map((row) => headers.map((header) => {
        if (outputKeys.includes(header)) return csvCell(outputCellValue(row.outputs?.[header]))
        return csvCell(row[header])
      }).join(',')),
    ]
    return {
      ok: true,
      cityId,
      modelKey,
      modelVersion,
      rowCount: result.rowCount,
      headers,
      csv: `${lines.join('\n')}\n`,
    }
  })
}

async function buildDcatCatalog(client, cityId, baseUrl) {
  const base = normalizedBaseUrl(baseUrl)
  const city = await cityRecord(client, cityId)
  const bbox = await cityBbox(client, cityId)
  await ensureOgcCollections(client, cityId)
  const modelEnrichmentDatasets = await buildModelEnrichmentDcatDatasets(client, cityId, baseUrl, city.name)
  const datasets = await client.query(
    `
      SELECT
        d.id,
        d.identifier,
        d.title,
        d.description,
        d.publisher,
        d.license,
        d.access_rights,
        d.update_frequency,
        d.issued_at,
        d.modified_at,
        d.metadata,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              '@type', 'dcat:Distribution',
              'dct:title', dd.title,
              'dct:format', dd.format,
              'dcat:mediaType', dd.media_type,
              'dcat:accessURL', dd.access_url,
              'dcat:downloadURL', dd.download_url,
              'dcat:byteSize', dd.byte_size
            )
            ORDER BY dd.title
          ) FILTER (WHERE dd.id IS NOT NULL),
          '[]'::jsonb
        ) AS distributions,
        COALESCE(
          jsonb_agg(
            DISTINCT jsonb_build_object(
              'licenseName', dl.license_name,
              'spdxId', dl.spdx_id,
              'licenseUrl', dl.license_url,
              'attributionRequired', dl.attribution_required,
              'shareAlikeRequired', dl.share_alike_required,
              'commercialUseAllowed', dl.commercial_use_allowed
            )
          ) FILTER (WHERE dl.id IS NOT NULL),
          '[]'::jsonb
        ) AS licenses,
        COALESCE(
          jsonb_agg(
            DISTINCT jsonb_build_object(
              'dimension', dqr.quality_dimension,
              'score', dqr.score,
              'statement', dqr.statement
            )
          ) FILTER (WHERE dqr.id IS NOT NULL),
          '[]'::jsonb
        ) AS quality
      FROM ldt_catalog.datasets d
      LEFT JOIN ldt_catalog.dataset_distributions dd ON dd.dataset_id = d.id
      LEFT JOIN ldt_catalog.dataset_licenses dl ON dl.dataset_id = d.id
      LEFT JOIN ldt_catalog.dataset_quality_reports dqr ON dqr.dataset_id = d.id
      WHERE d.city_id = $1
      GROUP BY d.id
      ORDER BY d.identifier
    `,
    [cityId],
  )

  const catalog = {
    '@context': [
      'http://www.w3.org/ns/dcat.jsonld',
      `${base}/api/live/${cityId}/standards/context/dcat`,
    ],
    '@id': `${base}/api/live/${cityId}/standards/dcat`,
    '@type': 'dcat:Catalog',
    'dct:title': `${city.name} Twin Base Studio catalog`,
    'dct:description': 'Open-data source evidence, consolidated city inventory, and standards projections for the city base twin.',
    'dct:publisher': {
      '@type': 'foaf:Organization',
      'foaf:name': 'Polisplexity / Twin Base Studio',
    },
    'dct:spatial': {
      '@id': city.canonical_uri ?? `urn:polisplexity:ldt:city:${city.id}`,
      'locn:geometry': bbox,
      name: city.name,
      country: city.country,
      region: city.region,
    },
    'dcat:dataset': [
      ...datasets.rows.map((dataset) => ({
        '@id': `urn:polisplexity:ldt:dataset:${dataset.identifier}`,
        '@type': 'dcat:Dataset',
        'dct:identifier': dataset.identifier,
        'dct:title': dataset.title,
        'dct:description': dataset.description,
        'dct:publisher': dataset.publisher,
        'dct:license': dataset.license,
        'dct:accessRights': dataset.access_rights,
        'dct:accrualPeriodicity': dataset.update_frequency,
        'dct:issued': dataset.issued_at,
        'dct:modified': dataset.modified_at,
        'dcat:distribution': dataset.distributions,
        'tbs:licenses': dataset.licenses,
        'tbs:quality': dataset.quality,
        'tbs:metadata': dataset.metadata,
      })),
      ...modelEnrichmentDatasets,
    ],
    'dcat:service': [
      {
        '@type': 'dcat:DataService',
        'dct:title': 'OGC API Features endpoint',
        'dcat:endpointURL': `${base}/api/live/${cityId}/standards/ogc`,
      },
      {
        '@type': 'dcat:DataService',
        'dct:title': 'NGSI-LD entity endpoint',
        'dcat:endpointURL': `${base}/api/live/${cityId}/standards/ngsi-ld/entities`,
      },
    ],
    'odrl:hasPolicy': 'open-baseline-attribution-required',
    generatedAt: new Date().toISOString(),
  }

  await client.query(
    `
      INSERT INTO ldt_interop.dcat_exports (
        city_id,
        export_key,
        jsonld,
        generated_at
      )
      VALUES ($1, 'city-catalog', $2::jsonb, now())
      ON CONFLICT (city_id, export_key) DO UPDATE SET
        jsonld = EXCLUDED.jsonld,
        generated_at = now()
    `,
    [cityId, JSON.stringify(catalog)],
  )
  return catalog
}

async function refreshNgsiProjections(client, cityId) {
  await client.query(
    `
      DELETE FROM ldt_interop.ngsi_entity_projections nep
      USING ldt_core.city_entities ce
      WHERE nep.entity_id = ce.id
        AND ce.city_id = $1
    `,
    [cityId],
  )

  const result = await client.query(
    `
      WITH evidence_counts AS (
        SELECT
          ese.entity_id,
          count(*)::int AS evidence_count
        FROM ldt_prov.entity_source_evidence ese
        JOIN ldt_core.city_entities ce ON ce.id = ese.entity_id
        WHERE ce.city_id = $1
        GROUP BY ese.entity_id
      ),
      model_enrichments AS (
        SELECT
          summary.entity_id,
          jsonb_object_agg(summary.model_key, summary.outputs ORDER BY summary.model_key) AS model_enrichments,
          max(NULLIF(summary.outputs #>> '{sap_score,valueNumeric}', '')::numeric)
            FILTER (WHERE summary.model_key = 'eu-ldt-ecobuild') AS sap_score,
          max(NULLIF(summary.outputs #>> '{energy_label,valueText}', ''))
            FILTER (WHERE summary.model_key = 'eu-ldt-ecobuild') AS energy_label
        FROM ldt_enrichment.entity_model_output_summary summary
        WHERE summary.city_id = $1
        GROUP BY summary.entity_id
      ),
      projected AS (
        SELECT
          ce.id AS entity_id,
          nem.id AS mapping_id,
          'urn:ngsi-ld:' || nem.ngsi_type || ':' || ce.city_id || ':' ||
            regexp_replace(ce.stable_id, '[^A-Za-z0-9._~-]+', '-', 'g') AS ngsi_id,
          jsonb_strip_nulls(
            jsonb_build_object(
              '@context', jsonb_build_array(
                'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld',
                'https://polisplexity.org/ns/twin-base-studio/ngsi-ld-context.jsonld'
              ),
              'id', 'urn:ngsi-ld:' || nem.ngsi_type || ':' || ce.city_id || ':' ||
                regexp_replace(ce.stable_id, '[^A-Za-z0-9._~-]+', '-', 'g'),
              'type', nem.ngsi_type,
              'name', jsonb_build_object('type', 'Property', 'value', COALESCE(NULLIF(ce.label, ''), ce.stable_id)),
              'category', jsonb_build_object('type', 'Property', 'value', ce.entity_type),
              'authorityStatus', jsonb_build_object('type', 'Property', 'value', ce.authority_status),
              'confidence', jsonb_build_object('type', 'Property', 'value', ce.confidence),
              'lifecycleStatus', jsonb_build_object('type', 'Property', 'value', ce.lifecycle_status),
              'sourceCoverageStatus', jsonb_build_object(
                'type',
                'Property',
                'value',
                COALESCE(be.source_coverage_status, ce.properties->>'sourceCoverageStatus', 'source-evidence')
              ),
              'evidenceCount', jsonb_build_object('type', 'Property', 'value', COALESCE(ec.evidence_count, 0)),
              'dateModified', jsonb_build_object('type', 'Property', 'value', ce.updated_at),
              'refTwinEntity', jsonb_build_object(
                'type',
                'Relationship',
                'object',
                COALESCE(ce.canonical_uri, 'urn:polisplexity:ldt:' || ce.city_id || ':entity:' || ce.stable_id)
              )
            )
          ) ||
          CASE
            WHEN ce.geom IS NULL THEN '{}'::jsonb
            ELSE jsonb_build_object(
              'location',
              jsonb_build_object(
                'type',
                'GeoProperty',
                'value',
                ST_AsGeoJSON(ce.geom)::jsonb
              )
            )
          END ||
          CASE
            WHEN ce.entity_type = 'building' THEN jsonb_strip_nulls(jsonb_build_object(
              'buildingType', jsonb_build_object('type', 'Property', 'value', be.building_type),
              'useClass', jsonb_build_object('type', 'Property', 'value', be.use_class),
              'height', jsonb_build_object('type', 'Property', 'value', be.height_m),
              'floorsAboveGround', jsonb_build_object('type', 'Property', 'value', be.levels),
              'footprintArea', jsonb_build_object('type', 'Property', 'value', be.footprint_area_m2)
            ))
            WHEN ce.entity_type = 'road' THEN jsonb_strip_nulls(jsonb_build_object(
              'roadClass', jsonb_build_object('type', 'Property', 'value', re.road_class),
              'maxSpeed', jsonb_build_object('type', 'Property', 'value', re.maxspeed),
              'lanes', jsonb_build_object('type', 'Property', 'value', re.lanes),
              'oneway', jsonb_build_object('type', 'Property', 'value', re.oneway)
            ))
            ELSE '{}'::jsonb
          END ||
          CASE
            WHEN me.model_enrichments IS NULL THEN '{}'::jsonb
            ELSE jsonb_build_object(
              'modelEnrichments',
              jsonb_build_object(
                'type', 'Property',
                'value', me.model_enrichments
              )
            )
          END ||
          CASE
            WHEN me.sap_score IS NULL THEN '{}'::jsonb
            ELSE jsonb_build_object(
              'sapScore',
              jsonb_build_object(
                'type', 'Property',
                'value', me.sap_score,
                'unitCode', 'score_0_100'
              )
            )
          END ||
          CASE
            WHEN me.energy_label IS NULL THEN '{}'::jsonb
            ELSE jsonb_build_object(
              'energyLabel',
              jsonb_build_object(
                'type', 'Property',
                'value', me.energy_label
              )
            )
          END AS ngsi_payload
        FROM ldt_core.city_entities ce
        JOIN ldt_interop.ngsi_entity_mappings nem
          ON nem.entity_type = ce.entity_type
         AND nem.version = '0.1.0'
        LEFT JOIN ldt_core.building_entities be ON be.entity_id = ce.id
        LEFT JOIN ldt_core.road_entities re ON re.entity_id = ce.id
        LEFT JOIN evidence_counts ec ON ec.entity_id = ce.id
        LEFT JOIN model_enrichments me ON me.entity_id = ce.id
        WHERE ce.city_id = $1
      )
      INSERT INTO ldt_interop.ngsi_entity_projections (
        entity_id,
        mapping_id,
        ngsi_id,
        ngsi_payload,
        projected_at
      )
      SELECT
        entity_id,
        mapping_id,
        ngsi_id,
        ngsi_payload,
        now()
      FROM projected
      ON CONFLICT (entity_id, ngsi_id) DO UPDATE SET
        mapping_id = EXCLUDED.mapping_id,
        ngsi_payload = EXCLUDED.ngsi_payload,
        projected_at = now()
      RETURNING entity_id
    `,
    [cityId],
  )
  return result.rowCount
}

async function summarizeInterop(client, cityId, projectedCount, dcatCatalog) {
  const ogcCollections = await client.query(
    `
      SELECT count(*)::int AS count
      FROM ldt_interop.ogc_collections
      WHERE city_id = $1
    `,
    [cityId],
  )
  const ngsiTypes = await client.query(
    `
      SELECT nem.ngsi_type, count(*)::int AS count
      FROM ldt_interop.ngsi_entity_projections nep
      JOIN ldt_interop.ngsi_entity_mappings nem ON nem.id = nep.mapping_id
      JOIN ldt_core.city_entities ce ON ce.id = nep.entity_id
      WHERE ce.city_id = $1
      GROUP BY nem.ngsi_type
      ORDER BY nem.ngsi_type
    `,
    [cityId],
  )
  return {
    cityId,
    dcatDatasetCount: dcatCatalog['dcat:dataset'].length,
    ogcCollectionCount: ogcCollections.rows[0].count,
    ngsiProjectionCount: projectedCount,
    ngsiTypes: Object.fromEntries(ngsiTypes.rows.map((row) => [row.ngsi_type, row.count])),
  }
}

export async function generateLdtInteroperability({ cityIds = DEFAULT_CITY_IDS, baseUrl = 'http://localhost:3000' } = {}) {
  return await withClient(async (client) => {
    const targetCityIds = await listCityIds(client, cityIds)
    const cities = []
    for (const cityId of targetCityIds) {
      await ensureOgcCollections(client, cityId)
      const dcatCatalog = await buildDcatCatalog(client, cityId, baseUrl)
      const projectedCount = await refreshNgsiProjections(client, cityId)
      cities.push(await summarizeInterop(client, cityId, projectedCount, dcatCatalog))
    }
    return {
      ok: true,
      cityCount: cities.length,
      cities,
    }
  })
}

export async function getJsonLdContext(contextKey) {
  const resolvedContextKey = JSONLD_CONTEXT_ALIASES.get(contextKey) ?? contextKey
  return await withClient(async (client) => {
    const result = await client.query(
      `
        SELECT context_body
        FROM ldt_interop.jsonld_contexts
        WHERE context_key = $1
      `,
      [resolvedContextKey],
    )
    if (result.rowCount === 0) throw new Error(`JSONLD_CONTEXT_NOT_FOUND:${contextKey}`)
    return result.rows[0].context_body
  })
}

export async function getDcatCatalog(cityId, { baseUrl = 'http://localhost:3000', refresh = false } = {}) {
  return await withClient(async (client) => {
    if (refresh) return await buildDcatCatalog(client, cityId, baseUrl)
    const result = await client.query(
      `
        SELECT jsonld
        FROM ldt_interop.dcat_exports
        WHERE city_id = $1
          AND export_key = 'city-catalog'
      `,
      [cityId],
    )
    if (result.rowCount > 0) return result.rows[0].jsonld
    return await buildDcatCatalog(client, cityId, baseUrl)
  })
}

export async function getNgsiEntities(cityId, { type = '', limit, offset } = {}) {
  return await withClient(async (client) => {
    const rowLimit = parseLimit(limit)
    const rowOffset = parsePositiveInteger(offset, 0)
    const params = [cityId, rowLimit, rowOffset]
    const typeClause = type ? 'AND nem.ngsi_type = $4' : ''
    if (type) params.push(type)
    const result = await client.query(
      `
        SELECT
          nep.ngsi_payload
        FROM ldt_interop.ngsi_entity_projections nep
        JOIN ldt_interop.ngsi_entity_mappings nem ON nem.id = nep.mapping_id
        JOIN ldt_core.city_entities ce ON ce.id = nep.entity_id
        WHERE ce.city_id = $1
          ${typeClause}
        ORDER BY nem.ngsi_type, ce.stable_id
        LIMIT $2
        OFFSET $3
      `,
      params,
    )
    return {
      ok: true,
      cityId,
      type: type || null,
      limit: rowLimit,
      offset: rowOffset,
      returned: result.rowCount,
      entities: result.rows.map((row) => row.ngsi_payload),
    }
  })
}

export async function getOgcLanding(cityId, { baseUrl = 'http://localhost:3000' } = {}) {
  return await withClient(async (client) => {
    const city = await cityRecord(client, cityId)
    const base = normalizedBaseUrl(baseUrl)
    return {
      title: `${city.name} Twin Base Studio OGC API Features`,
      description: 'OGC API Features compatible access to consolidated Local Digital Twin city entities.',
      links: [
        { href: `${base}/api/live/${cityId}/standards/ogc`, rel: 'self', type: 'application/json', title: 'Landing page' },
        { href: `${base}/api/live/${cityId}/standards/ogc/conformance`, rel: 'conformance', type: 'application/json', title: 'Conformance' },
        { href: `${base}/api/live/${cityId}/standards/ogc/collections`, rel: 'data', type: 'application/json', title: 'Collections' },
        { href: `${base}/api/live/${cityId}/standards/dcat`, rel: 'service-desc', type: 'application/ld+json', title: 'DCAT catalog' },
      ],
    }
  })
}

export function getOgcConformance() {
  return {
    conformsTo: [
      'http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/core',
      'http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/oas30',
      'http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/geojson',
    ],
  }
}

export async function getOgcCollections(cityId, { baseUrl = 'http://localhost:3000' } = {}) {
  return await withClient(async (client) => {
    await ensureOgcCollections(client, cityId)
    const base = normalizedBaseUrl(baseUrl)
    const result = await client.query(
      `
        SELECT
          oc.collection_key,
          oc.title,
          oc.entity_type,
          oc.schema,
          oc.metadata,
          jsonb_build_array(
            ST_XMin(extent),
            ST_YMin(extent),
            ST_XMax(extent),
            ST_YMax(extent)
          ) AS bbox
        FROM ldt_interop.ogc_collections oc
        LEFT JOIN LATERAL (
          SELECT ST_Extent(ce.geom)::box2d AS extent
          FROM ldt_core.city_entities ce
          WHERE ce.city_id = oc.city_id
            AND ce.entity_type = oc.entity_type
            AND ce.geom IS NOT NULL
        ) scoped ON true
        WHERE oc.city_id = $1
        ORDER BY oc.collection_key
      `,
      [cityId],
    )
    return {
      links: [
        { href: `${base}/api/live/${cityId}/standards/ogc/collections`, rel: 'self', type: 'application/json', title: 'Collections' },
      ],
      collections: result.rows.map((row) => ({
        id: row.collection_key,
        title: row.title,
        description: row.metadata?.description ?? '',
        itemType: 'feature',
        extent: row.bbox ? { spatial: { bbox: [row.bbox], crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' } } : undefined,
        links: [
          {
            href: `${base}/api/live/${cityId}/standards/ogc/collections/${row.collection_key}/items`,
            rel: 'items',
            type: 'application/geo+json',
            title: `${row.title} items`,
          },
        ],
        schema: row.schema,
        metadata: row.metadata,
      })),
    }
  })
}

export async function getOgcCollectionItems(
  cityId,
  collectionKey,
  { baseUrl = 'http://localhost:3000', bbox, limit, offset } = {},
) {
  return await withClient(async (client) => {
    const rowLimit = parseLimit(limit)
    const rowOffset = parsePositiveInteger(offset, 0)
    const parsedBbox = parseBbox(bbox)
    const entityType = entityTypeForCollection(collectionKey)
    const base = normalizedBaseUrl(baseUrl)
    const params = [cityId, entityType, rowLimit, rowOffset]
    const bboxClause = parsedBbox
      ? 'AND co.geom && ST_MakeEnvelope($5, $6, $7, $8, 4326) AND ST_Intersects(co.geom, ST_MakeEnvelope($5, $6, $7, $8, 4326))'
      : ''
    if (parsedBbox) params.push(parsedBbox.minx, parsedBbox.miny, parsedBbox.maxx, parsedBbox.maxy)

    const result = await client.query(
      `
        SELECT
          co.id,
          co.stable_id,
          co.entity_type,
          co.label,
          co.authority_status,
          co.confidence,
          ce.lifecycle_status,
          ce.canonical_uri,
          co.properties,
          co.model_enrichments,
          co.sap_score,
          co.energy_label,
          ST_AsGeoJSON(co.geom)::jsonb AS geometry
        FROM ldt_query.city_objects_enriched co
        JOIN ldt_core.city_entities ce ON ce.id = co.id
        WHERE co.city_id = $1
          AND co.entity_type = $2
          AND co.geom IS NOT NULL
          ${bboxClause}
        ORDER BY co.stable_id
        LIMIT $3
        OFFSET $4
      `,
      params,
    )

    return {
      type: 'FeatureCollection',
      links: [
        {
          href: `${base}/api/live/${cityId}/standards/ogc/collections/${collectionKey}/items`,
          rel: 'self',
          type: 'application/geo+json',
          title: `${collectionKey} items`,
        },
      ],
      numberReturned: result.rowCount,
      timeStamp: new Date().toISOString(),
      features: result.rows.map((row) => ({
        type: 'Feature',
        id: row.stable_id,
        geometry: row.geometry,
        properties: {
          id: row.id,
          stableId: row.stable_id,
          entityType: row.entity_type,
          label: row.label,
          canonicalUri: row.canonical_uri,
          authorityStatus: row.authority_status,
          confidence: row.confidence,
          lifecycleStatus: row.lifecycle_status,
          modelEnrichments: row.model_enrichments ?? {},
          sapScore: row.sap_score == null ? undefined : Number(row.sap_score),
          energyLabel: row.energy_label ?? undefined,
          ...row.properties,
        },
      })),
    }
  })
}
