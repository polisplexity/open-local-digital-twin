import { requireLiveAccess } from '../liveRouteHelpers.mjs'
import {
  getCitySelectionSnapshotGeojson,
  getCitySimulationWorldGeojson,
  listCitySimulationWorlds,
} from '../../services/worldComparisonService.mjs'

async function sendSimulationWorlds(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const result = await listCitySimulationWorlds(access.cityId, request.query)
    response.status(result.ok ? 200 : 502).json(result)
  } catch (error) {
    response.status(502).json({
      ok: false,
      error: 'LIVE_SIMULATION_WORLDS_UNAVAILABLE',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendSimulationWorldGeojson(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const result = await getCitySimulationWorldGeojson(access.cityId, request.params.simulationRunId)
    response.status(result.ok ? 200 : result.error === 'SIMULATION_WORLD_NOT_FOUND' ? 404 : 502).json(result)
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: 'LIVE_SIMULATION_WORLD_INVALID',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

async function sendSelectionSnapshotGeojson(request, response, { requireLiveCityAccess, requestedCityId }) {
  try {
    const access = requireLiveAccess(request, response, requireLiveCityAccess, requestedCityId)
    if (!access) return
    const result = await getCitySelectionSnapshotGeojson(access.cityId, request.params.selectionId)
    response.status(result.ok ? 200 : result.error === 'SELECTION_SNAPSHOT_NOT_FOUND' ? 404 : 502).json(result)
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: 'LIVE_SELECTION_SNAPSHOT_INVALID',
      detail: String(error?.message ?? 'UNKNOWN_ERROR'),
    })
  }
}

export function registerWorldComparisonRoutes(app, { requireLiveCityAccess }) {
  app.get('/api/live/current/simulation-worlds', (request, response) => sendSimulationWorlds(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))
  app.get('/api/live/:cityId/simulation-worlds', (request, response) => sendSimulationWorlds(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))
  app.get('/api/live/current/simulation-worlds/:simulationRunId/geojson', (request, response) => sendSimulationWorldGeojson(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))
  app.get('/api/live/:cityId/simulation-worlds/:simulationRunId/geojson', (request, response) => sendSimulationWorldGeojson(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))
  app.get('/api/live/current/analysis-selections/:selectionId/geojson', (request, response) => sendSelectionSnapshotGeojson(request, response, {
    requireLiveCityAccess,
    requestedCityId: 'current',
  }))
  app.get('/api/live/:cityId/analysis-selections/:selectionId/geojson', (request, response) => sendSelectionSnapshotGeojson(request, response, {
    requireLiveCityAccess,
    requestedCityId: request.params.cityId,
  }))
}
