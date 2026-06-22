import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const migrationsDir = path.join(__dirname, 'migrations')

export function getProductionDatabaseUrl() {
  return process.env.TWIN_STUDIO_DATABASE_URL || process.env.DATABASE_URL || ''
}

export function productionDatabaseConfigured() {
  return Boolean(getProductionDatabaseUrl())
}

function createPool() {
  const connectionString = getProductionDatabaseUrl()
  if (!connectionString) return null
  return new Pool({
    connectionString,
    max: Number(process.env.TWIN_STUDIO_DATABASE_POOL_SIZE ?? 5),
    connectionTimeoutMillis: Number(process.env.TWIN_STUDIO_DATABASE_CONNECT_TIMEOUT_MS ?? 5000),
  })
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

function listMigrationFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

export async function runProductionMigrations() {
  const pool = createPool()
  if (!pool) {
    return {
      configured: false,
      ok: true,
      applied: [],
      pending: [],
      error: null,
    }
  }

  const client = await pool.connect()
  const applied = []
  try {
    await ensureMigrationTable(client)
    const migrations = listMigrationFiles()
    for (const file of migrations) {
      const id = file.replace(/\.sql$/, '')
      const existing = await client.query('SELECT id FROM schema_migrations WHERE id = $1', [id])
      if (existing.rowCount > 0) continue

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id])
        await client.query('COMMIT')
        applied.push(id)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }

    const result = {
      configured: true,
      ok: true,
      applied,
      pending: [],
      error: null,
    }
    return result
  } finally {
    client.release()
    await pool.end()
  }
}

export async function getProductionDatabaseStatus() {
  const pool = createPool()
  if (!pool) {
    return {
      configured: false,
      ok: true,
      postgis: false,
      migrationCount: 0,
      error: null,
    }
  }

  try {
    const [health, migrations] = await Promise.all([
      pool.query('SELECT postgis_version() AS postgis_version'),
      pool.query('SELECT count(*)::int AS count FROM schema_migrations'),
    ])
    return {
      configured: true,
      ok: true,
      postgis: Boolean(health.rows[0]?.postgis_version),
      postgisVersion: health.rows[0]?.postgis_version ?? null,
      migrationCount: migrations.rows[0]?.count ?? 0,
      error: null,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      postgis: false,
      migrationCount: 0,
      error: String(error?.message ?? 'UNKNOWN_DATABASE_ERROR'),
    }
  } finally {
    await pool.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runProductionMigrations()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2))
      process.exit(result.ok ? 0 : 1)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

