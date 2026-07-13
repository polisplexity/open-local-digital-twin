import fs from 'node:fs'
import path from 'node:path'
import { listCity3dTilesetRecords } from '../db/productionTwinStore/city3dTilesetRepository.mjs'
import { getThreeDTilesAssetPath } from '../services/city3dTiles/assetStore.mjs'
import {
  listDeliverableThreeDTilesArtifacts,
  resolveThreeDTilesArtifactAsset,
  viewerArtifactResponseHeaders,
} from '../services/viewerArtifacts/viewerArtifactDelivery.mjs'

function assetContentType(assetName) {
  const extension = path.extname(assetName).toLowerCase()
  if (extension === '.json') return 'application/json'
  if (extension === '.glb') return 'model/gltf-binary'
  return 'application/octet-stream'
}

function assetCacheHeader(assetName) {
  return assetName === 'tileset.json' ? 'no-cache' : 'public, max-age=31536000, immutable'
}

function isSmokeTileset(record) {
  return String(record?.tilesetKey ?? '').startsWith('smoke-')
}

function hasTilesetAsset(cityId, record) {
  try {
    const filePath = getThreeDTilesAssetPath({
      cityId,
      tilesetKey: record.tilesetKey,
      version: record.version,
      assetName: 'tileset.json',
    })
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

function setArtifactHeaders(response, artifact) {
  for (const [key, value] of Object.entries(viewerArtifactResponseHeaders(artifact))) {
    response.setHeader(key, value)
  }
}

export function registerLive3dTilesRoutes(app, { requireLiveCityAccess }) {
  app.get('/api/live/:cityId/3d-tilesets', async (req, res) => {
    try {
      const access = await requireLiveCityAccess(req, res)
      if (!access) return
      const requestedLimit = Math.min(100, Math.max(1, Math.trunc(Number(req.query.limit ?? 20)) || 20))
      const deliverableArtifacts = await listDeliverableThreeDTilesArtifacts(access.cityId, {
        tilesetKey: req.query.tilesetKey,
        limit: requestedLimit,
      })
      const legacyRecords = deliverableArtifacts.length ? [] : await listCity3dTilesetRecords(access.cityId, {
        tilesetKey: req.query.tilesetKey,
        status: req.query.status ?? 'ready',
        limit: 100,
      })
      const legacyDeliverableRecords = legacyRecords
        .filter((record) => !isSmokeTileset(record))
        .filter((record) => hasTilesetAsset(access.cityId, record))
      const availableRecords = (deliverableArtifacts.length ? deliverableArtifacts : legacyDeliverableRecords)
        .slice(0, requestedLimit)
      res.json({
        cityId: access.cityId,
        source: deliverableArtifacts.length ? 'viewer-artifact-registry' : 'legacy-city-3d-tilesets',
        tilesets: availableRecords,
      })
    } catch (error) {
      res.status(500).json({
        error: 'CITY_3D_TILESETS_FAILED',
        message: String(error?.message ?? error),
      })
    }
  })

  app.get('/api/live/:cityId/3d-tiles/:tilesetKey/:version/:assetName', async (req, res) => {
    try {
      const access = await requireLiveCityAccess(req, res)
      if (!access) return
      const assetName = String(req.params.assetName ?? '')
      const registeredAsset = await resolveThreeDTilesArtifactAsset({
        cityId: access.cityId,
        tilesetKey: req.params.tilesetKey,
        version: req.params.version,
        assetName,
      })
      const filePath = registeredAsset?.filePath ?? getThreeDTilesAssetPath({
        cityId: access.cityId,
        tilesetKey: req.params.tilesetKey,
        version: req.params.version,
        assetName,
      })
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.status(404).json({ error: 'CITY_3D_TILE_ASSET_NOT_FOUND' })
        return
      }
      res.setHeader('Cache-Control', assetCacheHeader(assetName))
      if (registeredAsset?.artifact) {
        setArtifactHeaders(res, registeredAsset.artifact)
        res.setHeader('X-Twin-3D-Tiles-Source', 'viewer-artifact-registry')
      } else {
        res.setHeader('X-Twin-3D-Tiles-Source', 'legacy-city-3d-tileset')
      }
      res.type(assetContentType(assetName))
      res.sendFile(filePath)
    } catch (error) {
      res.status(500).json({
        error: 'CITY_3D_TILE_ASSET_FAILED',
        message: String(error?.message ?? error),
      })
    }
  })
}
