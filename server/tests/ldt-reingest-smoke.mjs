import pg from 'pg'
import { getProductionDatabaseUrl } from '../db/migrate.mjs'

const { Client } = pg

const DEFAULT_CITY_IDS = ['adazi', 'kharkiv']
const OPEN_LAYER_KEYS = [
  'boundary',
  'buildings',
  'center',
  'facilities',
  'greenBlue',
  'overture-buildings',
  'places',
  'roads',
]
const SOURCE_FEATURE_LAYERS = OPEN_LAYER_KEYS.filter((layer) => layer !== 'boundary')
const DERIVED_LAYERS = ['buildingCandidateNew', 'buildingCandidateMatched']

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
const client = new Client({ connectionString })
await client.connect()

try {
  const summaries = []

  for (const cityId of cityIds) {
    const city = await client.query('SELECT id, name FROM ldt_core.cities WHERE id = $1', [cityId])
    assert(city.rowCount === 1, `LDT_CITY_MISSING:${cityId}`)

    const boundary = await client.query('SELECT count(*)::int AS count FROM ldt_core.city_boundaries WHERE city_id = $1', [cityId])
    assert(boundary.rows[0].count > 0, `LDT_BOUNDARY_MISSING:${cityId}`)

    const datasets = await client.query(
      `
        SELECT
          identifier,
          split_part(identifier, ':', 4) AS layer_key
        FROM ldt_catalog.datasets
        WHERE city_id = $1
          AND identifier LIKE $2
      `,
      [cityId, `tbs:open-data:${cityId}:%`],
    )
    const datasetLayers = new Set(datasets.rows.map((row) => row.layer_key))
    for (const layer of OPEN_LAYER_KEYS) {
      assert(datasetLayers.has(layer), `OPEN_DATASET_MISSING:${cityId}:${layer}`)
    }

    const derivedSourceFeatures = await client.query(
      `
        SELECT count(*)::int AS count
        FROM ldt_prov.source_features
        WHERE city_id = $1
          AND source_layer = ANY($2::text[])
      `,
      [cityId, DERIVED_LAYERS],
    )
    assert(derivedSourceFeatures.rows[0].count === 0, `DERIVED_LAYER_IMPORTED_AS_SOURCE:${cityId}`)

    const sourceCounts = await client.query(
      `
        SELECT
          sf.source_layer,
          count(*)::int AS count
        FROM ldt_prov.source_features sf
        JOIN ldt_catalog.datasets d ON d.id = sf.dataset_id
        WHERE sf.city_id = $1
          AND d.identifier LIKE $2
        GROUP BY sf.source_layer
      `,
      [cityId, `tbs:open-data:${cityId}:%`],
    )
    const countByLayer = new Map(sourceCounts.rows.map((row) => [row.source_layer, row.count]))
    for (const layer of SOURCE_FEATURE_LAYERS) {
      assert((countByLayer.get(layer) ?? 0) > 0, `SOURCE_FEATURES_MISSING:${cityId}:${layer}`)
    }

    const catalogCompleteness = await client.query(
      `
        SELECT
          count(distinct d.id)::int AS datasets,
          count(distinct dl.id)::int AS licenses,
          count(distinct dd.id)::int AS distributions,
          count(distinct dqr.id)::int AS quality_reports
        FROM ldt_catalog.datasets d
        LEFT JOIN ldt_catalog.dataset_licenses dl ON dl.dataset_id = d.id
        LEFT JOIN ldt_catalog.dataset_distributions dd ON dd.dataset_id = d.id
        LEFT JOIN ldt_catalog.dataset_quality_reports dqr ON dqr.dataset_id = d.id
        WHERE d.city_id = $1
          AND d.identifier LIKE $2
      `,
      [cityId, `tbs:open-data:${cityId}:%`],
    )
    const catalog = catalogCompleteness.rows[0]
    assert(catalog.datasets >= OPEN_LAYER_KEYS.length, `DATASET_COUNT_LOW:${cityId}`)
    assert(catalog.licenses >= OPEN_LAYER_KEYS.length, `DATASET_LICENSES_LOW:${cityId}`)
    assert(catalog.distributions >= OPEN_LAYER_KEYS.length, `DATASET_DISTRIBUTIONS_LOW:${cityId}`)
    assert(catalog.quality_reports >= OPEN_LAYER_KEYS.length, `DATASET_QUALITY_LOW:${cityId}`)

    const entityCount = await client.query('SELECT count(*)::int AS count FROM ldt_core.city_entities WHERE city_id = $1', [cityId])

    summaries.push({
      cityId,
      name: city.rows[0].name,
      boundaryCount: boundary.rows[0].count,
      datasetCount: catalog.datasets,
      consolidatedEntityCount: entityCount.rows[0].count,
      sourceFeatureCount: Array.from(countByLayer.values()).reduce((sum, count) => sum + count, 0),
      sourceLayers: Object.fromEntries([...countByLayer.entries()].sort(([a], [b]) => a.localeCompare(b))),
    })
  }

  console.log(JSON.stringify({
    ok: true,
    cityCount: summaries.length,
    cities: summaries,
  }, null, 2))
} finally {
  await client.end()
}
