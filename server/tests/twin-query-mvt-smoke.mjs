import {
  getTwinQueryMvtTile,
} from '../db/productionTwinStore.mjs'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { findCityConfig, getActiveCityConfig } from '../services/cityRegistry.mjs'

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
  const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID
  return cityId ? findCityConfig(cityId) : getActiveCityConfig()
}

function lonLatToTile(lon, lat, zoom) {
  const latRad = lat * Math.PI / 180
  const scale = 2 ** zoom
  return {
    z: zoom,
    x: Math.floor(((lon + 180) / 360) * scale),
    y: Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * scale),
  }
}

const city = cityFromArgs()
assert(city?.id, 'CITY_NOT_FOUND')

const center = [Number(city.lon), Number(city.lat)]
assert(Number.isFinite(center[0]) && Number.isFinite(center[1]), 'CITY_CENTER_REQUIRED')

const tile = lonLatToTile(center[0], center[1], 13)

const cqlTile = await getTwinQueryMvtTile(city.id, {
  ...tile,
  limit: 50000,
  query: {
    language: 'cql2-json',
    classes: ['buildings', 'roads'],
    scope: {
      key: 'radius',
      center,
      radiusMeters: 5000,
    },
    where: {
      op: 'in',
      args: [{ property: 'semantic_class' }, ['buildings', 'roads']],
    },
    render: { mode: 'isolate', maxFeatures: 0 },
    surface: 'map',
    intent: 'analysis',
  },
})

assert(cqlTile.ok, `CQL_TILE_FAILED:${cqlTile.error ?? 'unknown'}`)
assert(cqlTile.byteLength > 0, 'CQL_TILE_EMPTY')
assert(cqlTile.summary.tileFeatureCount > 0, 'CQL_TILE_FEATURE_COUNT_EMPTY')
assert(
  Number(cqlTile.summary.countsBySemanticClass.buildings ?? 0) > 0 ||
    Number(cqlTile.summary.countsBySemanticClass.roads ?? 0) > 0,
  'CQL_TILE_CLASS_COUNTS_MISSING',
)

const multiClauseTile = await getTwinQueryMvtTile(city.id, {
  ...tile,
  limit: 50000,
  query: {
    language: 'twinql-json',
    operation: 'union',
    clauses: [
      {
        id: 'central-buildings',
        label: 'Central buildings',
        classes: ['buildings'],
        scope: {
          key: 'radius',
          center,
          radiusMeters: 3000,
        },
      },
      {
        id: 'arterial-roads',
        label: 'Arterial roads',
        classes: ['roads'],
        scope: {
          key: 'radius',
          center,
          radiusMeters: 6000,
        },
        where: {
          field: 'road_class',
          operator: 'in',
          value: ['primary', 'secondary', 'tertiary'],
        },
      },
    ],
    render: { mode: 'isolate', maxFeatures: 0 },
    surface: 'map',
    intent: 'analysis',
  },
})

assert(multiClauseTile.ok, `MULTI_CLAUSE_TILE_FAILED:${multiClauseTile.error ?? 'unknown'}`)
assert(multiClauseTile.byteLength > 0, 'MULTI_CLAUSE_TILE_EMPTY')
assert(multiClauseTile.summary.tileFeatureCount > 0, 'MULTI_CLAUSE_TILE_FEATURE_COUNT_EMPTY')
assert(
  Object.keys(multiClauseTile.summary.countsByClause ?? {}).length > 0,
  'MULTI_CLAUSE_TILE_COUNTS_MISSING',
)

await closeProductionPool()

console.log(JSON.stringify({
  ok: true,
  cityId: city.id,
  tile,
  cqlTile: {
    byteLength: cqlTile.byteLength,
    tileFeatureCount: cqlTile.summary.tileFeatureCount,
    countsBySemanticClass: cqlTile.summary.countsBySemanticClass,
  },
  multiClauseTile: {
    byteLength: multiClauseTile.byteLength,
    tileFeatureCount: multiClauseTile.summary.tileFeatureCount,
    countsBySemanticClass: multiClauseTile.summary.countsBySemanticClass,
    countsByClause: multiClauseTile.summary.countsByClause,
  },
}, null, 2))
