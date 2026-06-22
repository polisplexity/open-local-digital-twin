import pg from 'pg'
import { getProductionDatabaseUrl } from '../db/migrate.mjs'
import {
  closeLdtViewerAggregatePool,
  getLdtDensityGrid,
  getLdtViewerSummary,
  refreshLdtViewerAggregates,
} from '../services/ldtViewerAggregateService.mjs'

const { Client } = pg

const DEFAULT_CITY_IDS = ['adazi', 'kharkiv']

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
  const refreshed = await refreshLdtViewerAggregates({ cityIds, cellSizeM: 2000 })
  assert(refreshed.ok, 'VIEWER_AGGREGATE_REFRESH_FAILED')
  assert(refreshed.cityCount === cityIds.length, 'VIEWER_AGGREGATE_CITY_COUNT_MISMATCH')

  const summaries = []
  for (const cityId of cityIds) {
    const summary = await getLdtViewerSummary(cityId)
    assert(summary.ok, `VIEWER_SUMMARY_MISSING:${cityId}`)
    assert(Number(summary.payload.areaKm2) > 0, `VIEWER_SUMMARY_AREA_MISSING:${cityId}`)
    assert(Number(summary.payload.inventory?.buildings) > 0, `VIEWER_SUMMARY_BUILDINGS_MISSING:${cityId}`)
    assert(Array.isArray(summary.payload.indicators), `VIEWER_SUMMARY_INDICATORS_MISSING:${cityId}`)
    assert(summary.payload.indicators.length >= 5, `VIEWER_SUMMARY_INDICATORS_LOW:${cityId}`)

    const grid = await getLdtDensityGrid(cityId, { limit: 10 })
    assert(grid.type === 'FeatureCollection', `VIEWER_GRID_TYPE_INVALID:${cityId}`)
    assert(grid.features.length > 0, `VIEWER_GRID_FEATURES_MISSING:${cityId}`)
    assert(grid.features[0].properties.cellSizeM === 2000, `VIEWER_GRID_CELL_SIZE_INVALID:${cityId}`)
    assert(Number.isFinite(Number(grid.features[0].properties.heatProxy)), `VIEWER_GRID_HEAT_PROXY_MISSING:${cityId}`)
    assert(Number.isFinite(Number(grid.features[0].properties.airflowFriction)), `VIEWER_GRID_AIRFLOW_PROXY_MISSING:${cityId}`)
    assert(Number.isFinite(Number(grid.features[0].properties.greenBlueCooling)), `VIEWER_GRID_COOLING_PROXY_MISSING:${cityId}`)
    assert(grid.features[0].properties.phenomena?.reproducible === true, `VIEWER_GRID_PHENOMENA_METADATA_MISSING:${cityId}`)

    const dbState = await client.query(
      `
        SELECT
          (SELECT count(*)::int FROM ldt_viewer.city_summary_cache WHERE city_id = $1) AS summaries,
          (SELECT count(*)::int FROM ldt_viewer.density_grids WHERE city_id = $1 AND grid_key = 'city-density-2km') AS cells
      `,
      [cityId],
    )
    assert(dbState.rows[0].summaries === 1, `VIEWER_SUMMARY_ROW_MISSING:${cityId}`)
    assert(dbState.rows[0].cells > 0, `VIEWER_GRID_ROWS_MISSING:${cityId}`)

    summaries.push({
      cityId,
      areaKm2: summary.payload.areaKm2,
      buildings: summary.payload.inventory.buildings,
      roads: summary.payload.inventory.roads,
      indicators: summary.payload.indicators.length,
      gridCells: dbState.rows[0].cells,
    })
  }

  console.log(JSON.stringify({
    ok: true,
    cityCount: summaries.length,
    cities: summaries,
  }, null, 2))
} finally {
  await client.end()
  await closeLdtViewerAggregatePool()
}
