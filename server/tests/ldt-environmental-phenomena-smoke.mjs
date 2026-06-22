import pg from 'pg'
import { getProductionDatabaseUrl } from '../db/migrate.mjs'
import {
  closeLdtEnvironmentalPool,
  getLdtEnvironmentalCells,
  getLdtEnvironmentalLayers,
  getLdtObjectEnvironmentalObservations,
  refreshLdtEnvironmentalPhenomena,
} from '../services/ldtEnvironmentalService.mjs'
import {
  closeLdtViewerAggregatePool,
  refreshLdtViewerAggregates,
} from '../services/ldtViewerAggregateService.mjs'

const { Client } = pg

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
  if (!cityArg) return ['kharkiv']
  return cityArg.split(',').map((entry) => entry.trim()).filter(Boolean)
}

const connectionString = getProductionDatabaseUrl()
assert(connectionString, 'DATABASE_URL_REQUIRED')

const cityIds = cityIdsFromArgs()
const client = new Client({ connectionString })
await client.connect()

try {
  const aggregateRefresh = await refreshLdtViewerAggregates({ cityIds, cellSizeM: 2000 })
  assert(aggregateRefresh.ok, 'VIEWER_AGGREGATE_REFRESH_FAILED')

  const environmentalRefresh = await refreshLdtEnvironmentalPhenomena({ cityIds })
  assert(environmentalRefresh.ok, 'ENVIRONMENTAL_REFRESH_FAILED')

  const cities = []
  for (const cityId of cityIds) {
    const layers = await getLdtEnvironmentalLayers(cityId)
    assert(layers.ok, `ENVIRONMENTAL_LAYERS_FAILED:${cityId}`)
    assert(layers.layers.length >= 6, `ENVIRONMENTAL_LAYER_COUNT_LOW:${cityId}`)
    for (const layerKey of [
      'built_form_proxy',
      'heat_proxy',
      'air_roughness_proxy',
      'green_blue_cooling_proxy',
      'solar_exposure_proxy',
      'water_flow_proxy',
    ]) {
      assert(layers.layers.some((layer) => layer.key === layerKey), `ENVIRONMENTAL_LAYER_MISSING:${cityId}:${layerKey}`)
    }

    const heatCells = await getLdtEnvironmentalCells(cityId, { layerKey: 'heat_proxy', limit: 10 })
    assert(heatCells.type === 'FeatureCollection', `ENVIRONMENTAL_CELLS_TYPE_INVALID:${cityId}`)
    assert(heatCells.features.length > 0, `ENVIRONMENTAL_CELLS_EMPTY:${cityId}`)
    assert(Number.isFinite(Number(heatCells.features[0].properties.value)), `ENVIRONMENTAL_CELL_VALUE_INVALID:${cityId}`)

    const dbState = await client.query(
      `
        SELECT
          (SELECT count(*)::int FROM ldt_environment.phenomenon_cells WHERE city_id = $1) AS cells,
          (SELECT count(*)::int FROM ldt_environment.object_observations WHERE city_id = $1) AS observations,
          (SELECT count(*)::int FROM ldt_environment.object_observation_summary WHERE city_id = $1) AS summaries,
          (
            SELECT object_id
            FROM ldt_environment.object_environment_observations
            WHERE city_id = $1
            LIMIT 1
          ) AS object_id
      `,
      [cityId],
    )
    assert(dbState.rows[0].cells > 0, `ENVIRONMENTAL_DB_CELLS_EMPTY:${cityId}`)
    assert(dbState.rows[0].observations > 0, `ENVIRONMENTAL_OBJECT_OBSERVATIONS_EMPTY:${cityId}`)
    assert(dbState.rows[0].summaries > 0, `ENVIRONMENTAL_OBJECT_SUMMARIES_EMPTY:${cityId}`)
    assert(dbState.rows[0].object_id, `ENVIRONMENTAL_OBJECT_ID_MISSING:${cityId}`)

    const observations = await getLdtObjectEnvironmentalObservations(cityId, {
      objectId: dbState.rows[0].object_id,
    })
    assert(observations.ok, `ENVIRONMENTAL_OBJECT_LOOKUP_FAILED:${cityId}`)
    assert(observations.observations.length > 0, `ENVIRONMENTAL_OBJECT_LOOKUP_EMPTY:${cityId}`)

    cities.push({
      cityId,
      layerCount: layers.layers.length,
      cells: dbState.rows[0].cells,
      objectObservations: dbState.rows[0].observations,
      objectSummaries: dbState.rows[0].summaries,
      sampledObjectId: dbState.rows[0].object_id,
      sampledObjectObservationCount: observations.observations.length,
    })
  }

  console.log(JSON.stringify({
    ok: true,
    cityCount: cities.length,
    cities,
  }, null, 2))
} finally {
  await client.end()
  await closeLdtEnvironmentalPool()
  await closeLdtViewerAggregatePool()
}
