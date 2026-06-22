import pg from 'pg'
import { getProductionDatabaseUrl } from './migrate.mjs'

const { Pool } = pg

let activePool = null
let activeConnectionString = null

function positiveIntegerEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

export function getProductionPool() {
  const connectionString = getProductionDatabaseUrl()
  if (!connectionString) return null

  if (activePool && activeConnectionString === connectionString) {
    return activePool
  }

  if (activePool) {
    const closingPool = activePool
    void closingPool.end().catch(() => {})
  }

  activeConnectionString = connectionString
  activePool = new Pool({
    connectionString,
    max: positiveIntegerEnv('TWIN_STUDIO_DATABASE_POOL_SIZE', 12),
    connectionTimeoutMillis: positiveIntegerEnv('TWIN_STUDIO_DATABASE_CONNECT_TIMEOUT_MS', 15000),
    allowExitOnIdle: true,
  })

  return activePool
}

export async function closeProductionPool() {
  const pool = activePool
  activePool = null
  activeConnectionString = null
  if (pool) await pool.end()
}
