import { closeProductionPool } from './postgisPool.mjs'
import { buildCity3dBuildingTileset } from '../services/city3dTiles/buildCityTilesetService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

const cityId = argValue('city') || process.env.TWIN_STUDIO_E2E_CITY_ID || process.env.TWIN_STUDIO_CITY_ID || 'kharkiv'
const tilesetKey = argValue('tileset-key') || process.env.TWIN_STUDIO_3D_TILESET_KEY || 'base-buildings'
const version = argValue('version') || process.env.TWIN_STUDIO_3D_TILESET_VERSION || ''
const limit = argValue('limit') || process.env.TWIN_STUDIO_3D_TILES_BUILDING_LIMIT || ''

try {
  const result = await buildCity3dBuildingTileset({
    cityId,
    tilesetKey,
    version,
    limit: limit || undefined,
  })
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await closeProductionPool()
}

