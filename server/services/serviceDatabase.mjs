import { closeProductionPool, getProductionPool } from '../db/postgisPool.mjs'

const DEFAULT_MISSING_DATABASE_RESULT = {
  configured: false,
  ok: false,
  error: 'DATABASE_URL_REQUIRED',
}

export function getServicePool() {
  return getProductionPool()
}

export async function withProductionClient(callback, options = {}) {
  const pool = getServicePool()
  if (!pool) {
    if (options.returnMissingDatabaseResult) {
      return options.missingDatabaseResult ?? DEFAULT_MISSING_DATABASE_RESULT
    }
    throw new Error('DATABASE_URL_REQUIRED')
  }

  const client = await pool.connect()
  try {
    return await callback(client)
  } finally {
    client.release()
  }
}

export async function closeSharedProductionPool() {
  await closeProductionPool()
}
