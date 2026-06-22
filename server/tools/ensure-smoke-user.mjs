import crypto from 'node:crypto'
import process from 'node:process'
import pg from 'pg'

const { Client } = pg

const DEFAULT_EMAIL = 'smoke@polisplexity.test'
const DEFAULT_PASSWORD = 'local-smoke-password-change-me'
const DEFAULT_CITY_ID = 'kharkiv'
const PASSWORD_KEYLEN = 64

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.slice(2).find((item) => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : null
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, PASSWORD_KEYLEN).toString('hex')
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  return {
    salt,
    hash: hashPassword(password, salt),
  }
}

function databaseUrl() {
  return process.env.TWIN_STUDIO_DATABASE_URL
    || 'postgresql://twin_base_studio:twin_base_studio_dev@127.0.0.1:45432/twin_base_studio'
}

const email = normalizeEmail(argValue('email') || process.env.TWIN_STUDIO_SMOKE_EMAIL || DEFAULT_EMAIL)
const password = argValue('password') || process.env.TWIN_STUDIO_SMOKE_PASSWORD || DEFAULT_PASSWORD
const cityId = String(argValue('city') || process.env.TWIN_STUDIO_SMOKE_CITY_ID || DEFAULT_CITY_ID).trim()

if (!email || !password || !cityId) {
  throw new Error('SMOKE_USER_INPUT_REQUIRED')
}

const client = new Client({ connectionString: databaseUrl() })

await client.connect()

try {
  const cityResult = await client.query(
    'SELECT id FROM app_city_registry_cities WHERE id = $1 LIMIT 1',
    [cityId],
  )
  if (cityResult.rowCount === 0) {
    throw new Error(`SMOKE_CITY_NOT_FOUND:${cityId}`)
  }

  const existingResult = await client.query(
    'SELECT id, created_at FROM app_auth_users WHERE email = $1 LIMIT 1',
    [email],
  )
  const userId = existingResult.rows[0]?.id || crypto.randomUUID()
  const createdAt = existingResult.rows[0]?.created_at || new Date()
  const { salt, hash } = createPasswordHash(password)

  await client.query('BEGIN')
  await client.query(
    `
      INSERT INTO app_auth_users (
        id, email, full_name, password_hash, password_salt, status, role, roles,
        primary_city_id, allowed_city_ids, created_at, updated_at, activated_at, last_login_at
      )
      VALUES (
        $1, $2, $3, $4, $5, 'active', 'platform-admin', $6::jsonb,
        $7, $8::jsonb, $9, now(), now(), null
      )
      ON CONFLICT (email) DO UPDATE SET
        full_name = excluded.full_name,
        password_hash = excluded.password_hash,
        password_salt = excluded.password_salt,
        status = excluded.status,
        role = excluded.role,
        roles = excluded.roles,
        primary_city_id = excluded.primary_city_id,
        allowed_city_ids = excluded.allowed_city_ids,
        updated_at = now(),
        activated_at = now()
    `,
    [
      userId,
      email,
      'Smoke Test Operator',
      hash,
      salt,
      JSON.stringify(['platform-admin']),
      cityId,
      JSON.stringify([cityId]),
      createdAt,
    ],
  )
  await client.query('DELETE FROM app_auth_sessions WHERE user_id = $1', [userId])
  await client.query('DELETE FROM app_auth_tokens WHERE user_id = $1', [userId])
  await client.query('COMMIT')

  console.log(JSON.stringify({
    ok: true,
    email,
    cityId,
    userId,
    passwordSource: process.env.TWIN_STUDIO_SMOKE_PASSWORD ? 'env' : 'default-dev',
  }, null, 2))
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  throw error
} finally {
  await client.end()
}
