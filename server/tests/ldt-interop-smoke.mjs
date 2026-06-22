import pg from 'pg'
import { getProductionDatabaseUrl } from '../db/migrate.mjs'
import {
  closeLdtInteropPool,
  generateLdtInteroperability,
  getDcatCatalog,
  getJsonLdContext,
  getNgsiEntities,
  getOgcCollectionItems,
  getOgcCollections,
  getOgcConformance,
  getOgcLanding,
} from '../services/ldtInteropService.mjs'

const { Client } = pg

const DEFAULT_CITY_IDS = ['adazi', 'kharkiv']
const REQUIRED_COLLECTIONS = ['buildings', 'roads', 'facilities', 'green-blue-systems', 'places']

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function cityIdsFromArgs() {
  const cityArg = argValue('city')
  if (!cityArg) return DEFAULT_CITY_IDS
  return cityArg.split(',').map((entry) => entry.trim()).filter(Boolean)
}

const connectionString = getProductionDatabaseUrl()
assert(connectionString, 'DATABASE_URL_REQUIRED')

const cityIds = cityIdsFromArgs()
const baseUrl = argValue('base-url') || 'http://localhost:3000'
const client = new Client({ connectionString })
await client.connect()

try {
  const generated = await generateLdtInteroperability({ cityIds, baseUrl })
  assert(generated.ok, 'INTEROP_GENERATION_FAILED')
  assert(generated.cityCount === cityIds.length, 'INTEROP_GENERATED_CITY_COUNT_MISMATCH')

  const summaries = []
  const dcatContext = await getJsonLdContext('dcat')
  const ngsiContext = await getJsonLdContext('ngsi-ld')
  assert(dcatContext['@context']?.dcat, 'DCAT_CONTEXT_ALIAS_MISSING')
  assert(Array.isArray(ngsiContext['@context']), 'NGSI_CONTEXT_ALIAS_MISSING')

  for (const cityId of cityIds) {
    const dcat = await getDcatCatalog(cityId, { baseUrl })
    assert(dcat['@type'] === 'dcat:Catalog', `DCAT_CATALOG_TYPE_INVALID:${cityId}`)
    assert((dcat['dcat:dataset'] ?? []).length >= 8, `DCAT_DATASET_COUNT_LOW:${cityId}`)
    assert((dcat['dcat:service'] ?? []).length >= 2, `DCAT_SERVICES_MISSING:${cityId}`)

    const landing = await getOgcLanding(cityId, { baseUrl })
    assert(Array.isArray(landing.links) && landing.links.length >= 3, `OGC_LANDING_LINKS_MISSING:${cityId}`)
    const conformance = getOgcConformance()
    assert(conformance.conformsTo.includes('http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/core'), 'OGC_CORE_CONFORMANCE_MISSING')

    const collections = await getOgcCollections(cityId, { baseUrl })
    const collectionIds = new Set(collections.collections.map((collection) => collection.id))
    for (const collectionId of REQUIRED_COLLECTIONS) {
      assert(collectionIds.has(collectionId), `OGC_COLLECTION_MISSING:${cityId}:${collectionId}`)
    }

    const buildings = await getOgcCollectionItems(cityId, 'buildings', { baseUrl, limit: 5 })
    assert(buildings.type === 'FeatureCollection', `OGC_BUILDING_FEATURE_COLLECTION_INVALID:${cityId}`)
    assert(buildings.features.length > 0, `OGC_BUILDING_FEATURES_MISSING:${cityId}`)
    assert(buildings.features[0].geometry, `OGC_BUILDING_GEOMETRY_MISSING:${cityId}`)

    const ngsiBuildings = await getNgsiEntities(cityId, { type: 'Building', limit: 5 })
    assert(ngsiBuildings.entities.length > 0, `NGSI_BUILDINGS_MISSING:${cityId}`)
    assert(ngsiBuildings.entities[0].id?.startsWith('urn:ngsi-ld:Building:'), `NGSI_BUILDING_ID_INVALID:${cityId}`)
    assert(ngsiBuildings.entities[0].type === 'Building', `NGSI_BUILDING_TYPE_INVALID:${cityId}`)
    assert(ngsiBuildings.entities[0].location?.type === 'GeoProperty', `NGSI_BUILDING_LOCATION_MISSING:${cityId}`)

    const dbCounts = await client.query(
      `
        SELECT
          (SELECT count(*)::int FROM ldt_interop.dcat_exports WHERE city_id = $1) AS dcat_exports,
          (SELECT count(*)::int FROM ldt_interop.ogc_collections WHERE city_id = $1) AS ogc_collections,
          (
            SELECT count(*)::int
            FROM ldt_interop.ngsi_entity_projections nep
            JOIN ldt_core.city_entities ce ON ce.id = nep.entity_id
            WHERE ce.city_id = $1
          ) AS ngsi_projections
      `,
      [cityId],
    )
    assert(dbCounts.rows[0].dcat_exports > 0, `DCAT_EXPORT_ROW_MISSING:${cityId}`)
    assert(dbCounts.rows[0].ogc_collections >= REQUIRED_COLLECTIONS.length, `OGC_COLLECTION_ROWS_LOW:${cityId}`)
    assert(dbCounts.rows[0].ngsi_projections > 0, `NGSI_PROJECTION_ROWS_MISSING:${cityId}`)

    summaries.push({
      cityId,
      dcatDatasets: dcat['dcat:dataset'].length,
      ogcCollections: dbCounts.rows[0].ogc_collections,
      ngsiProjections: dbCounts.rows[0].ngsi_projections,
      sampleNgsiType: ngsiBuildings.entities[0].type,
      sampleOgcCollection: buildings.features[0].properties.entityType,
    })
  }

  console.log(JSON.stringify({
    ok: true,
    cityCount: summaries.length,
    cities: summaries,
  }, null, 2))
} finally {
  await client.end()
  await closeLdtInteropPool()
}
