import { getTwinQueryContract } from '../db/productionTwinStore.mjs'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { findCityConfig, getActiveCityConfig } from '../services/cityRegistry.mjs'
import { exportCityTwinQuery } from '../services/twinQuery/twinQueryUseCaseService.mjs'

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
  const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_SMOKE_CITY_ID
  return cityId ? findCityConfig(cityId) : getActiveCityConfig()
}

function baseQuery(city) {
  return {
    language: 'twinql-json',
    classes: ['roads'],
    scope: { key: 'city' },
    render: { mode: 'isolate', transport: 'mvt', maxFeatures: 10 },
    surface: 'api',
    intent: 'export',
    actorUserId: 'twin-query-export-smoke',
    metadata: {
      source: 'twin-query-export-smoke',
      center: [city.lon, city.lat],
    },
  }
}

const city = cityFromArgs()
assert(city?.id, 'CITY_NOT_FOUND')

try {
  const contract = getTwinQueryContract()
  assert(contract.renderTransports.includes('table'), 'TABLE_TRANSPORT_MISSING')
  assert(contract.transports?.queryExport?.includes('/twin-query/export'), 'QUERY_EXPORT_ENDPOINT_MISSING')
  assert(contract.exportFormats.some((entry) => entry.format === 'csv' && entry.available !== false), 'CSV_EXPORT_CONTRACT_MISSING')
  assert(contract.exportFormats.some((entry) => entry.format === 'cityjson' && entry.available !== false), 'CITYJSON_EXPORT_CONTRACT_MISSING')
  assert(contract.exportFormats.some((entry) => entry.format === 'ifc' && entry.available === false), 'IFC_EXPORT_SHOULD_BE_DECLARED_UNAVAILABLE')

  const query = baseQuery(city)
  const csv = await exportCityTwinQuery(city.id, { query, format: 'csv', limit: 15 })
  assert(csv.ok, `CSV_EXPORT_FAILED:${csv.error ?? csv.detail ?? 'unknown'}`)
  assert(csv.contentType.includes('text/csv'), 'CSV_CONTENT_TYPE_INVALID')
  assert(csv.body.includes('object_id'), 'CSV_HEADER_MISSING_OBJECT_ID')
  assert(csv.rowCount > 0, 'CSV_EXPORT_EMPTY')

  const jsonl = await exportCityTwinQuery(city.id, { query, format: 'jsonl', limit: 5 })
  assert(jsonl.ok, `JSONL_EXPORT_FAILED:${jsonl.error ?? jsonl.detail ?? 'unknown'}`)
  assert(jsonl.contentType.includes('application/x-ndjson'), 'JSONL_CONTENT_TYPE_INVALID')
  assert(jsonl.body.trim().split('\n').every((line) => JSON.parse(line).object_id), 'JSONL_ROWS_INVALID')

  const json = await exportCityTwinQuery(city.id, { query, format: 'json', limit: 5 })
  assert(json.ok, `JSON_EXPORT_FAILED:${json.error ?? json.detail ?? 'unknown'}`)
  const envelope = JSON.parse(json.body)
  assert(envelope.ok === true && Array.isArray(envelope.rows), 'JSON_EXPORT_ENVELOPE_INVALID')
  assert(envelope.rows.length > 0, 'JSON_EXPORT_EMPTY')

  const geojson = await exportCityTwinQuery(city.id, { query, format: 'geojson', limit: 5 })
  assert(geojson.ok, `GEOJSON_EXPORT_FAILED:${geojson.error ?? geojson.detail ?? 'unknown'}`)
  const featureCollection = JSON.parse(geojson.body)
  assert(featureCollection.type === 'FeatureCollection', 'GEOJSON_EXPORT_TYPE_INVALID')
  assert(Array.isArray(featureCollection.features) && featureCollection.features.length > 0, 'GEOJSON_EXPORT_EMPTY')

  const cityjson = await exportCityTwinQuery(city.id, { query, format: 'cityjson', limit: 5 })
  assert(cityjson.ok, `CITYJSON_EXPORT_FAILED:${cityjson.error ?? cityjson.detail ?? 'unknown'}`)
  const cityModel = JSON.parse(cityjson.body)
  assert(cityModel.type === 'CityJSON', 'CITYJSON_TYPE_INVALID')
  assert(Array.isArray(cityModel.vertices), 'CITYJSON_VERTICES_MISSING')
  assert(cityModel.CityObjects && Object.keys(cityModel.CityObjects).length > 0, 'CITYJSON_OBJECTS_EMPTY')

  const ifc = await exportCityTwinQuery(city.id, { query, format: 'ifc', limit: 5 })
  assert(ifc.ok === false, 'IFC_EXPORT_SHOULD_NOT_BE_AVAILABLE')
  assert(ifc.status === 422, 'IFC_EXPORT_STATUS_INVALID')
  assert(String(ifc.detail || '').includes('native BIM'), 'IFC_EXPORT_DETAIL_MISSING')

  const citygml = await exportCityTwinQuery(city.id, { query, format: 'citygml', limit: 5 })
  assert(citygml.ok === false, 'CITYGML_EXPORT_SHOULD_NOT_BE_AVAILABLE')
  assert(citygml.status === 422, 'CITYGML_EXPORT_STATUS_INVALID')

  console.log(JSON.stringify({
    ok: true,
    cityId: city.id,
    csvRows: csv.rowCount,
    jsonRows: envelope.rows.length,
    geojsonFeatures: featureCollection.features.length,
    cityjsonObjects: Object.keys(cityModel.CityObjects).length,
  }, null, 2))
} finally {
  await closeProductionPool()
}
