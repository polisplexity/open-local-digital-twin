import fs from 'node:fs'
import path from 'node:path'
import { listCity3dTilesetRecords } from '../db/productionTwinStore/city3dTilesetRepository.mjs'
import { getThreeDTilesAssetPath } from '../services/city3dTiles/assetStore.mjs'

function assetContentType(assetName) {
  const extension = path.extname(assetName).toLowerCase()
  if (extension === '.json') return 'application/json'
  if (extension === '.glb') return 'model/gltf-binary'
  return 'application/octet-stream'
}

function assetCacheHeader(assetName) {
  return assetName === 'tileset.json' ? 'no-cache' : 'public, max-age=31536000, immutable'
}

export function registerLive3dTilesRoutes(app, { requireLiveCityAccess }) {
  app.get('/api/live/:cityId/3d-tilesets', async (req, res) => {
    try {
      const access = await requireLiveCityAccess(req, res)
      if (!access) return
      const records = await listCity3dTilesetRecords(access.cityId, {
        tilesetKey: req.query.tilesetKey,
        status: req.query.status ?? 'ready',
        limit: req.query.limit ?? 20,
      })
      res.json({
        cityId: access.cityId,
        tilesets: records,
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
      const filePath = getThreeDTilesAssetPath({
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

