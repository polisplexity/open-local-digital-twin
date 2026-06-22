import { withProductionClient } from '../serviceDatabase.mjs'

export async function withClient(callback) {
  return withProductionClient(callback, { returnMissingDatabaseResult: true })
}

export async function countRows(client, sql, params = []) {
  const result = await client.query(sql, params)
  return Number(result.rows[0]?.count ?? 0)
}

export function moduleAvailable(count) {
  return Number(count ?? 0) > 0
}
