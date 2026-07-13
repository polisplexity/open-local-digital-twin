import { getProductionPool } from '../db/postgisPool.mjs'
import { registerExistingViewerArtifacts } from '../services/viewerArtifacts/viewerArtifactScanner.mjs'

function argValue(name, fallback = null) {
  const prefix = `--${name}=`
  const entry = process.argv.find((item) => item.startsWith(prefix))
  return entry ? entry.slice(prefix.length) : fallback
}

const cityId = String(argValue('city', process.env.TWIN_STUDIO_SMOKE_CITY_ID || 'guanajuato')).trim()
const activateLatest = process.argv.includes('--activate-latest')

const registered = await registerExistingViewerArtifacts(cityId, { activateLatest })
console.log(JSON.stringify({
  ok: true,
  cityId,
  activateLatest,
  artifactCount: registered.length,
  artifacts: registered,
}, null, 2))

const pool = getProductionPool()
if (pool) await pool.end()
