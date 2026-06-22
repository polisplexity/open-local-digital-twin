import {
  renderCity3dPage,
  renderCityImmersivePage,
  renderCityMapLibrePage,
} from '../services/baseTwinService.mjs'

const VIEWER_RENDERERS = {
  map: renderCityMapLibrePage,
  '3d': renderCity3dPage,
  immersive: renderCityImmersivePage,
}

function sendViewerShell(response, render, cityId) {
  response.type('html').send(render({ cityId, embed: true }))
}

export function registerViewerShellRoutes(app, { requireLiveCityAccess }) {
  app.get('/live/current/map', (request, response) => {
    const access = requireLiveCityAccess(request, response, 'current')
    if (!access) return
    sendViewerShell(response, VIEWER_RENDERERS.map, access.cityId)
  })

  app.get('/live/current/3d', (request, response) => {
    const access = requireLiveCityAccess(request, response, 'current')
    if (!access) return
    sendViewerShell(response, VIEWER_RENDERERS['3d'], access.cityId)
  })

  app.get('/live/current/immersive', (request, response) => {
    const access = requireLiveCityAccess(request, response, 'current')
    if (!access) return
    sendViewerShell(response, VIEWER_RENDERERS.immersive, access.cityId)
  })

  app.get('/live/:cityId/map', (request, response) => {
    const access = requireLiveCityAccess(request, response, request.params.cityId)
    if (!access) return
    sendViewerShell(response, VIEWER_RENDERERS.map, access.cityId)
  })

  app.get('/live/:cityId/3d', (request, response) => {
    const access = requireLiveCityAccess(request, response, request.params.cityId)
    if (!access) return
    sendViewerShell(response, VIEWER_RENDERERS['3d'], access.cityId)
  })

  app.get('/live/:cityId/immersive', (request, response) => {
    const access = requireLiveCityAccess(request, response, request.params.cityId)
    if (!access) return
    sendViewerShell(response, VIEWER_RENDERERS.immersive, access.cityId)
  })

  app.get('/live/adazi/map', (request, response) => {
    const access = requireLiveCityAccess(request, response, 'adazi')
    if (!access) return
    sendViewerShell(response, VIEWER_RENDERERS.map, 'adazi')
  })

  app.get('/live/adazi/3d', (request, response) => {
    const access = requireLiveCityAccess(request, response, 'adazi')
    if (!access) return
    sendViewerShell(response, VIEWER_RENDERERS['3d'], 'adazi')
  })

  app.get('/live/adazi/immersive', (request, response) => {
    const access = requireLiveCityAccess(request, response, 'adazi')
    if (!access) return
    sendViewerShell(response, VIEWER_RENDERERS.immersive, 'adazi')
  })
}
