import { execFile } from 'node:child_process'
import fs from 'node:fs'
import { promisify } from 'node:util'
import pg from 'pg'
import { getProductionDatabaseUrl } from '../db/migrate.mjs'

const execFileAsync = promisify(execFile)
const { Pool } = pg

const args = new Set(process.argv.slice(2))
const requireDb = args.has('--require-db')
const skipDb = args.has('--no-db')

async function commandProbe(command, args = ['--version']) {
  try {
    const result = await execFileAsync(command, args, {
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    })
    return {
      ok: true,
      command,
      detail: String(result.stdout || result.stderr || '').split('\n')[0].trim(),
    }
  } catch (error) {
    return {
      ok: false,
      command,
      error: error?.code === 'ENOENT' ? 'not-found' : String(error?.message ?? error),
    }
  }
}

async function pythonModuleProbe(moduleName) {
  try {
    await execFileAsync('python3', ['-c', `import ${moduleName}`], {
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    })
    return { ok: true, module: moduleName }
  } catch (error) {
    return { ok: false, module: moduleName, error: String(error?.message ?? error) }
  }
}

async function dbProbe() {
  const connectionString = getProductionDatabaseUrl()
  if (!connectionString) {
    return { ok: false, configured: false, error: 'DATABASE_URL_REQUIRED' }
  }
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: Number(process.env.TWIN_STUDIO_DATABASE_CONNECT_TIMEOUT_MS ?? 5000),
  })
  try {
    const result = await pool.query('SELECT postgis_full_version() AS postgis_version')
    return {
      ok: true,
      configured: true,
      postgis: String(result.rows[0]?.postgis_version ?? '').split(' ').slice(0, 4).join(' '),
    }
  } catch (error) {
    return { ok: false, configured: true, error: String(error?.message ?? error) }
  } finally {
    await pool.end()
  }
}

const commandChecks = await Promise.all([
  commandProbe('node', ['--version']),
  commandProbe('npm', ['--version']),
  commandProbe('python3', ['--version']),
  commandProbe('ogr2ogr', ['--version']),
  commandProbe('psql', ['--version']),
  commandProbe('pg_dump', ['--version']),
  commandProbe('pg_restore', ['--version']),
  commandProbe(process.env.PMTILES_BIN || 'pmtiles', ['--help']),
  commandProbe('mpirun', ['--version']),
  commandProbe('osmium', ['--version']),
])
const moduleChecks = await Promise.all([
  pythonModuleProbe('overturemaps'),
])

const paths = [
  process.env.TWIN_STUDIO_RUNTIME_DIR || 'runtime-data',
  '/app/exports',
].map((path) => ({ path, exists: fs.existsSync(path) }))

const db = skipDb ? { ok: true, skipped: true } : await dbProbe()
const requiredCommands = new Set(['node', 'npm', 'python3', 'ogr2ogr', 'psql', 'pg_dump', 'pg_restore', process.env.PMTILES_BIN || 'pmtiles'])
const missingRequiredCommands = commandChecks
  .filter((check) => requiredCommands.has(check.command) && !check.ok)
  .map((check) => check.command)
const missingModules = moduleChecks.filter((check) => !check.ok).map((check) => check.module)
const ok = missingRequiredCommands.length === 0
  && missingModules.length === 0
  && (!requireDb || db.ok)
  && paths.every((entry) => entry.exists)

const result = {
  ok,
  mode: 'offline-data-factory',
  imageContract: 'twin-base-studio-datafactory.v1',
  generatedAt: new Date().toISOString(),
  commands: commandChecks,
  pythonModules: moduleChecks,
  paths,
  database: db,
  missingRequiredCommands,
  missingModules,
}

console.log(JSON.stringify(result, null, 2))
if (!ok) process.exit(1)
