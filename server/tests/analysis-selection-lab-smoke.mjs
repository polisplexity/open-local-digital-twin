import assert from 'node:assert/strict'
import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured } from '../db/migrate.mjs'
import { findCityConfig, getActiveCityConfig } from '../services/cityRegistry.mjs'
import {
  compareCityAnalysisSelections,
  getCityAnalysisSelection,
  listCityAnalysisSelectionMembers,
  listCityAnalysisSelections,
  runCityAnalysisSelection,
} from '../services/analysisSelection/selectionLabService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function cityFromArgs() {
  const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID
  return cityId ? findCityConfig(cityId) : getActiveCityConfig()
}

if (!productionDatabaseConfigured()) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'DATABASE_URL_NOT_CONFIGURED' }, null, 2))
  process.exit(0)
}

const city = cityFromArgs()
assert.ok(city?.id, 'CITY_NOT_FOUND')

try {
  const center = [Number(city.lon), Number(city.lat)]
  assert.ok(Number.isFinite(center[0]) && Number.isFinite(center[1]), 'CITY_CENTER_INVALID')

  const roads = await runCityAnalysisSelection(city.id, {
    title: `Smoke roads ${Date.now()}`,
    maxSelectionMembers: 300,
    actorUserId: 'analysis-selection-smoke',
    query: {
      language: 'twinql-json',
      classes: ['roads'],
      scope: {
        key: 'radius',
        center,
        radiusMeters: 3500,
      },
      where: {
        field: 'object_id',
        operator: 'exists',
        value: true,
      },
      surface: 'map',
      intent: 'analysis',
    },
  })

  assert.equal(roads.ok, true, `ROADS_SELECTION_FAILED:${roads.error ?? 'unknown'}`)
  assert.ok(roads.selection?.id, 'ROADS_SELECTION_ID_MISSING')
  assert.ok(roads.summary.resultCount > 0, 'ROADS_SELECTION_EMPTY')
  assert.ok(roads.selection.returnedCount > 0, 'ROADS_SELECTION_MEMBERS_EMPTY')
  assert.ok(roads.selection.semanticClasses.includes('roads'), 'ROADS_SELECTION_CLASS_MISSING')
  assert.ok(roads.selection.queryHash, 'ROADS_SELECTION_QUERY_HASH_MISSING')

  const loadedRoads = await getCityAnalysisSelection(city.id, roads.selection.id)
  assert.equal(loadedRoads.ok, true, `ROADS_SELECTION_GET_FAILED:${loadedRoads.error ?? 'unknown'}`)
  assert.equal(loadedRoads.selection.id, roads.selection.id, 'ROADS_SELECTION_GET_ID_MISMATCH')

  const roadMembers = await listCityAnalysisSelectionMembers(city.id, roads.selection.id, { limit: 25 })
  assert.equal(roadMembers.ok, true, `ROADS_SELECTION_MEMBERS_FAILED:${roadMembers.error ?? 'unknown'}`)
  assert.ok(roadMembers.members.length > 0, 'ROADS_SELECTION_MEMBERS_NOT_LISTED')
  assert.ok(roadMembers.members.every((member) => member.semanticClass === 'roads'), 'ROADS_MEMBER_CLASS_MISMATCH')

  const buildings = await runCityAnalysisSelection(city.id, {
    title: `Smoke buildings ${Date.now()}`,
    maxSelectionMembers: 300,
    actorUserId: 'analysis-selection-smoke',
    query: {
      language: 'cql2-json',
      classes: ['buildings'],
      scope: {
        key: 'radius',
        center,
        radiusMeters: 2500,
      },
      where: {
        op: 'exists',
        args: [{ property: 'object_id' }],
      },
      surface: 'city3d',
      intent: 'inspection',
    },
  })

  assert.equal(buildings.ok, true, `BUILDINGS_SELECTION_FAILED:${buildings.error ?? 'unknown'}`)
  assert.ok(buildings.selection?.id, 'BUILDINGS_SELECTION_ID_MISSING')
  assert.ok(buildings.selection.returnedCount > 0, 'BUILDINGS_SELECTION_MEMBERS_EMPTY')
  assert.ok(buildings.selection.semanticClasses.includes('buildings'), 'BUILDINGS_SELECTION_CLASS_MISSING')

  const compared = await compareCityAnalysisSelections(city.id, {
    leftSelectionId: roads.selection.id,
    rightSelectionId: buildings.selection.id,
    operation: 'union',
    actorUserId: 'analysis-selection-smoke',
  })
  assert.equal(compared.ok, true, `SELECTION_COMPARISON_FAILED:${compared.error ?? 'unknown'}`)
  assert.ok(compared.comparison.resultCount >= roads.selection.returnedCount, 'SELECTION_COMPARISON_TOO_SMALL')

  const listed = await listCityAnalysisSelections(city.id, { limit: 20 })
  assert.equal(listed.ok, true, `SELECTION_LIST_FAILED:${listed.error ?? 'unknown'}`)
  assert.ok(listed.selections.some((selection) => selection.id === roads.selection.id), 'ROADS_SELECTION_NOT_LISTED')
  assert.ok(listed.groups.some((group) => group.queryHash === roads.selection.queryHash), 'SELECTION_QUERY_GROUP_MISSING')

  console.log(JSON.stringify({
    ok: true,
    cityId: city.id,
    selections: {
      roads: {
        id: roads.selection.id,
        resultCount: roads.summary.resultCount,
        returnedCount: roads.selection.returnedCount,
        truncated: roads.selection.truncated,
      },
      buildings: {
        id: buildings.selection.id,
        resultCount: buildings.summary.resultCount,
        returnedCount: buildings.selection.returnedCount,
        truncated: buildings.selection.truncated,
      },
    },
    comparison: {
      id: compared.comparison.id,
      operation: compared.comparison.operation,
      resultCount: compared.comparison.resultCount,
    },
  }, null, 2))
} finally {
  await closeProductionPool()
}
