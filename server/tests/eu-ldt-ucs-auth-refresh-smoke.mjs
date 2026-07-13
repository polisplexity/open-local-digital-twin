import assert from 'node:assert/strict'
import http from 'node:http'

import { requestUcsJson } from '../services/ldtOps/euLdtUseCaseScenariosService.mjs'

let attempts = 0
let refreshes = 0
const server = http.createServer((request, response) => {
  attempts += 1
  response.setHeader('Content-Type', 'application/json')
  if (request.headers.authorization !== 'Bearer fresh-token') {
    response.statusCode = 401
    response.end(JSON.stringify({ message: 'Authorization token expired' }))
    return
  }
  response.statusCode = 200
  response.end(JSON.stringify({ ok: true, attempts }))
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
try {
  const address = server.address()
  const result = await requestUcsJson(`http://127.0.0.1:${address.port}/resource`, {
    headers: { Authorization: 'Bearer expired-token' },
    refreshHeaders: async () => {
      refreshes += 1
      return { Authorization: 'Bearer fresh-token' }
    },
  })
  assert.equal(result.status, 200)
  assert.equal(result.body.ok, true)
  assert.equal(attempts, 2)
  assert.equal(refreshes, 1)
  console.log(JSON.stringify({ ok: true, attempts, refreshes }, null, 2))
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
}
