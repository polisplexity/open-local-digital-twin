import fs from 'node:fs'
import path from 'node:path'
import { getRuntimeDir } from '../stateStore.mjs'

const SAFE_SEGMENT_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,96}$/
const SAFE_ASSET_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,160}$/

function safeSegment(value, label) {
  const segment = String(value ?? '').trim()
  if (!SAFE_SEGMENT_PATTERN.test(segment)) {
    throw new Error(`${label}_UNSAFE`)
  }
  return segment
}

function safeAssetName(value) {
  const assetName = String(value ?? '').trim()
  if (!SAFE_ASSET_PATTERN.test(assetName) || assetName.includes('..')) {
    throw new Error('ASSET_NAME_UNSAFE')
  }
  return assetName
}

export function getThreeDTilesRootDir() {
  return path.join(getRuntimeDir(), '3d-tiles')
}

export function getThreeDTilesPackageDir({ cityId, tilesetKey, version }) {
  return path.join(
    getThreeDTilesRootDir(),
    safeSegment(cityId, 'CITY_ID'),
    safeSegment(tilesetKey, 'TILESET_KEY'),
    safeSegment(version, 'TILESET_VERSION'),
  )
}

export function getThreeDTilesAssetPath({ cityId, tilesetKey, version, assetName }) {
  const packageDir = getThreeDTilesPackageDir({ cityId, tilesetKey, version })
  const resolvedPath = path.resolve(packageDir, safeAssetName(assetName))
  if (!resolvedPath.startsWith(path.resolve(packageDir))) {
    throw new Error('ASSET_PATH_OUTSIDE_PACKAGE')
  }
  return resolvedPath
}

export function threeDTilesTilesetUrl({ cityId, tilesetKey, version }) {
  return `/api/live/${encodeURIComponent(cityId)}/3d-tiles/${encodeURIComponent(tilesetKey)}/${encodeURIComponent(version)}/tileset.json`
}

export function writeThreeDTilesPackage({ cityId, tilesetKey, version, files }) {
  const packageDir = getThreeDTilesPackageDir({ cityId, tilesetKey, version })
  fs.rmSync(packageDir, { recursive: true, force: true })
  fs.mkdirSync(packageDir, { recursive: true })

  const written = {}
  for (const [assetName, payload] of Object.entries(files)) {
    const targetPath = getThreeDTilesAssetPath({ cityId, tilesetKey, version, assetName })
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.writeFileSync(targetPath, payload)
    written[assetName] = targetPath
  }

  return {
    packageDir,
    written,
    byteSize: Object.values(written).reduce((total, filePath) => {
      try {
        return total + fs.statSync(filePath).size
      } catch {
        return total
      }
    }, 0),
  }
}

