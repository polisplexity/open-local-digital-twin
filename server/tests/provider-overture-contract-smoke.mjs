import assert from 'node:assert/strict'
import { findCityConfig } from '../services/cityRegistry.mjs'
import { buildOvertureQueryContract } from '../services/providerLayerIngestion/sourceAdapters.mjs'

const city = findCityConfig('kharkiv')
assert.ok(city, 'KHARKIV_CITY_CONFIG_MISSING')

const release = '2026-04-15.0'
const buildings = await buildOvertureQueryContract(city, { release }, 'buildings')
const roads = await buildOvertureQueryContract(city, { release }, 'roads')

assert.equal(buildings.cityId, 'kharkiv', 'OVERTURE_BUILDINGS_CITY_ID_MISMATCH')
assert.equal(buildings.release, release, 'OVERTURE_BUILDINGS_RELEASE_NOT_PARAMETRIC')
assert.equal(buildings.sourceUri, `overturemaps-cli:buildings/building:${release}`, 'OVERTURE_BUILDINGS_SOURCE_URI_MISMATCH')
assert.equal(buildings.theme, 'buildings', 'OVERTURE_BUILDINGS_THEME_MISMATCH')
assert.equal(buildings.overtureType, 'building', 'OVERTURE_BUILDINGS_TYPE_MISMATCH')
assert.equal(buildings.bbox.length, 4, 'OVERTURE_BUILDINGS_BBOX_MISSING')
assert.ok(buildings.bbox.every(Number.isFinite), 'OVERTURE_BUILDINGS_BBOX_INVALID')

assert.equal(roads.cityId, 'kharkiv', 'OVERTURE_ROADS_CITY_ID_MISMATCH')
assert.equal(roads.release, release, 'OVERTURE_ROADS_RELEASE_NOT_PARAMETRIC')
assert.equal(roads.sourceUri, `overturemaps-cli:transportation/segment:${release}`, 'OVERTURE_ROADS_SOURCE_URI_MISMATCH')
assert.equal(roads.theme, 'transportation', 'OVERTURE_ROADS_THEME_MISMATCH')
assert.equal(roads.overtureType, 'segment', 'OVERTURE_ROADS_TYPE_MISMATCH')
assert.deepEqual(roads.bbox, buildings.bbox, 'OVERTURE_ROADS_BUILDINGS_BBOX_DIVERGED')

const explicitBbox = [36.1, 49.8, 36.4, 50.1]
const explicit = await buildOvertureQueryContract(city, { bbox: explicitBbox, overtureRelease: 'latest' }, 'buildings')
assert.deepEqual(explicit.bbox, explicitBbox, 'OVERTURE_EXPLICIT_BBOX_OVERRIDE_FAILED')
assert.equal(explicit.release, 'latest', 'OVERTURE_RELEASE_OVERRIDE_FAILED')

const sourceVersionContract = await buildOvertureQueryContract(city, { sourceVersion: '2026-04-15.0' }, 'roads')
assert.equal(sourceVersionContract.release, '2026-04-15.0', 'OVERTURE_SOURCE_VERSION_RELEASE_FAILED')

console.log(JSON.stringify({
  ok: true,
  cityId: city.id,
  buildings,
  roads,
  explicitOverride: explicit,
}, null, 2))
