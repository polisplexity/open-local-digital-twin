import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { getProductionDatabaseUrl } from '../db/migrate.mjs'

const { Pool } = pg
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..', '..')

let pool = null
let initialized = false
let primedFromFiles = false
let persistChain = Promise.resolve()

const runtimeState = {
  meta: new Map(),
  registry: null,
  registryCities: [],
  users: [],
  sessions: [],
  tokens: [],
  auditLog: [],
}

function nowIso() {
  return new Date().toISOString()
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null))
}

function parseJson(value, fallback) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function iso(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function getPool() {
  const connectionString = getProductionDatabaseUrl()
  if (!connectionString) {
    throw new Error('POSTGRES_RUNTIME_DATABASE_REQUIRED')
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: Number(process.env.TWIN_STUDIO_RUNTIME_DATABASE_POOL_SIZE ?? process.env.TWIN_STUDIO_DATABASE_POOL_SIZE ?? 5),
      connectionTimeoutMillis: Number(process.env.TWIN_STUDIO_DATABASE_CONNECT_TIMEOUT_MS ?? 5000),
    })
  }
  return pool
}

export function getRuntimeDir() {
  return process.env.TWIN_STUDIO_RUNTIME_DIR
    ? path.resolve(process.env.TWIN_STUDIO_RUNTIME_DIR)
    : path.join(rootDir, 'runtime-data')
}

export function ensureRuntimeDir() {
  fs.mkdirSync(getRuntimeDir(), { recursive: true })
}

export function readJsonFile(filePath, fallbackValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallbackValue
  }
}

export function writeJsonFile(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`)
  fs.renameSync(temporaryPath, filePath)
}

function primeFromLegacyJsonFiles() {
  if (primedFromFiles) return
  primedFromFiles = true
  ensureRuntimeDir()
  const registry = readJsonFile(path.join(getRuntimeDir(), 'city-registry.json'), null)
  if (registry) {
    runtimeState.registry = {
      version: Number(registry.version ?? 1) || 1,
      active_city_id: String(registry.activeCityId ?? registry.active_city_id ?? 'adazi'),
      updated_at: nowIso(),
    }
    runtimeState.registryCities = Array.isArray(registry.cities)
      ? registry.cities.map((city, index) => ({
          id: String(city.id),
          payload_json: JSON.stringify(city),
          sort_order: index,
          updated_at: nowIso(),
        })).filter((city) => city.id)
      : []
  }

  const authDir = path.join(getRuntimeDir(), 'auth')
  const users = readJsonFile(path.join(authDir, 'users.json'), { users: [] })
  const sessions = readJsonFile(path.join(authDir, 'sessions.json'), { sessions: [] })
  const tokens = readJsonFile(path.join(authDir, 'tokens.json'), { activations: [], resets: [] })
  runtimeState.users = (users.users ?? []).map(userToRow)
  runtimeState.sessions = (sessions.sessions ?? []).map(sessionToRow)
  runtimeState.tokens = [
    ...(tokens.activations ?? []).map((token) => tokenToRow('activation', token)),
    ...(tokens.resets ?? []).map((token) => tokenToRow('reset', token)),
  ]
}

function userToRow(user = {}) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName ?? user.full_name,
    password_hash: user.passwordHash ?? user.password_hash,
    password_salt: user.passwordSalt ?? user.password_salt,
    status: user.status,
    role: user.role,
    roles_json: JSON.stringify(user.roles ?? parseJson(user.roles_json, [])),
    primary_city_id: user.primaryCityId ?? user.primary_city_id,
    allowed_city_ids_json: JSON.stringify(user.allowedCityIds ?? parseJson(user.allowed_city_ids_json, [])),
    created_at: iso(user.createdAt ?? user.created_at) ?? nowIso(),
    updated_at: iso(user.updatedAt ?? user.updated_at) ?? nowIso(),
    activated_at: iso(user.activatedAt ?? user.activated_at),
    last_login_at: iso(user.lastLoginAt ?? user.last_login_at),
  }
}

function sessionToRow(session = {}) {
  return {
    id: session.id,
    user_id: session.userId ?? session.user_id,
    token_hash: session.tokenHash ?? session.token_hash,
    city_id: session.cityId ?? session.city_id,
    created_at: iso(session.createdAt ?? session.created_at) ?? nowIso(),
    last_seen_at: iso(session.lastSeenAt ?? session.last_seen_at) ?? nowIso(),
    expires_at: iso(session.expiresAt ?? session.expires_at) ?? nowIso(),
  }
}

function tokenToRow(kind, token = {}) {
  return {
    id: token.id,
    kind: token.kind ?? kind,
    user_id: token.userId ?? token.user_id,
    token_hash: token.tokenHash ?? token.token_hash,
    created_at: iso(token.createdAt ?? token.created_at) ?? nowIso(),
    expires_at: iso(token.expiresAt ?? token.expires_at) ?? nowIso(),
    consumed_at: iso(token.consumedAt ?? token.consumed_at),
  }
}

function auditToRow(entry = {}) {
  return {
    id: entry.id ?? crypto.randomUUID(),
    actor_user_id: entry.actorUserId ?? entry.actor_user_id ?? null,
    action: entry.action,
    target_type: entry.targetType ?? entry.target_type,
    target_id: entry.targetId ?? entry.target_id ?? null,
    payload_json: JSON.stringify(entry.payload ?? parseJson(entry.payload_json, {})),
    created_at: iso(entry.createdAt ?? entry.created_at) ?? nowIso(),
  }
}

async function loadRuntimeStateFromPostgres() {
  const client = await getPool().connect()
  try {
    const meta = await client.query('SELECT key, value FROM app_meta')
    const registry = await client.query('SELECT version, active_city_id, updated_at FROM app_city_registry WHERE id = 1')
    const registryCities = await client.query('SELECT id, payload::text AS payload_json, sort_order, updated_at FROM app_city_registry_cities ORDER BY sort_order ASC, id ASC')
    const users = await client.query(`
        SELECT id, email, full_name, password_hash, password_salt, status, role,
               roles::text AS roles_json, primary_city_id, allowed_city_ids::text AS allowed_city_ids_json,
               created_at, updated_at, activated_at, last_login_at
        FROM app_auth_users
        ORDER BY created_at ASC, email ASC
      `)
    const sessions = await client.query('SELECT id, user_id, token_hash, city_id, created_at, last_seen_at, expires_at FROM app_auth_sessions ORDER BY created_at ASC')
    const tokens = await client.query('SELECT id, kind, user_id, token_hash, created_at, expires_at, consumed_at FROM app_auth_tokens ORDER BY created_at ASC')
    const auditLog = await client.query('SELECT id, actor_user_id, action, target_type, target_id, payload::text AS payload_json, created_at FROM app_audit_log ORDER BY created_at ASC')

    runtimeState.meta = new Map(meta.rows.map((row) => [row.key, row.value]))
    runtimeState.registry = registry.rows[0] ?? null
    runtimeState.registryCities = registryCities.rows.map(normalizeRegistryCityRow)
    runtimeState.users = users.rows.map(normalizeUserRow)
    runtimeState.sessions = sessions.rows.map(normalizeSessionRow)
    runtimeState.tokens = tokens.rows.map(normalizeTokenRow)
    runtimeState.auditLog = auditLog.rows.map(normalizeAuditRow)
  } finally {
    client.release()
  }
}

function normalizeRegistryCityRow(row) {
  return {
    id: row.id,
    payload_json: typeof row.payload_json === 'string' ? row.payload_json : JSON.stringify(row.payload_json ?? {}),
    sort_order: Number(row.sort_order ?? 0),
    updated_at: iso(row.updated_at) ?? nowIso(),
  }
}

function normalizeUserRow(row) {
  return {
    ...row,
    roles_json: typeof row.roles_json === 'string' ? row.roles_json : JSON.stringify(row.roles_json ?? []),
    allowed_city_ids_json:
      typeof row.allowed_city_ids_json === 'string'
        ? row.allowed_city_ids_json
        : JSON.stringify(row.allowed_city_ids_json ?? []),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    activated_at: iso(row.activated_at),
    last_login_at: iso(row.last_login_at),
  }
}

function normalizeSessionRow(row) {
  return {
    ...row,
    created_at: iso(row.created_at),
    last_seen_at: iso(row.last_seen_at),
    expires_at: iso(row.expires_at),
  }
}

function normalizeTokenRow(row) {
  return {
    ...row,
    created_at: iso(row.created_at),
    expires_at: iso(row.expires_at),
    consumed_at: iso(row.consumed_at),
  }
}

function normalizeAuditRow(row) {
  return {
    ...row,
    payload_json: typeof row.payload_json === 'string' ? row.payload_json : JSON.stringify(row.payload_json ?? {}),
    created_at: iso(row.created_at),
  }
}

async function persistRuntimeStateToPostgres() {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM app_meta')
    for (const [key, value] of runtimeState.meta.entries()) {
      await client.query(
        'INSERT INTO app_meta (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
        [key, value],
      )
    }

    await client.query('DELETE FROM app_city_registry_cities')
    await client.query('DELETE FROM app_city_registry')
    if (runtimeState.registry) {
      await client.query(
        'INSERT INTO app_city_registry (id, version, active_city_id, updated_at) VALUES (1, $1, $2, $3)',
        [
          runtimeState.registry.version,
          runtimeState.registry.active_city_id,
          runtimeState.registry.updated_at ?? nowIso(),
        ],
      )
      for (const city of runtimeState.registryCities) {
        await client.query(
          'INSERT INTO app_city_registry_cities (id, payload, sort_order, updated_at) VALUES ($1, $2::jsonb, $3, $4)',
          [city.id, city.payload_json, city.sort_order, city.updated_at ?? nowIso()],
        )
      }
    }

    await client.query('DELETE FROM app_auth_tokens')
    await client.query('DELETE FROM app_auth_sessions')
    await client.query('DELETE FROM app_auth_users')
    for (const user of runtimeState.users) {
      await client.query(
        `
          INSERT INTO app_auth_users (
            id, email, full_name, password_hash, password_salt, status, role,
            roles, primary_city_id, allowed_city_ids, created_at, updated_at,
            activated_at, last_login_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11, $12, $13, $14)
        `,
        [
          user.id,
          user.email,
          user.full_name,
          user.password_hash,
          user.password_salt,
          user.status,
          user.role,
          user.roles_json,
          user.primary_city_id,
          user.allowed_city_ids_json,
          user.created_at,
          user.updated_at,
          user.activated_at,
          user.last_login_at,
        ],
      )
    }
    for (const session of runtimeState.sessions) {
      await client.query(
        `
          INSERT INTO app_auth_sessions (id, user_id, token_hash, city_id, created_at, last_seen_at, expires_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          session.id,
          session.user_id,
          session.token_hash,
          session.city_id,
          session.created_at,
          session.last_seen_at,
          session.expires_at,
        ],
      )
    }
    for (const token of runtimeState.tokens) {
      await client.query(
        `
          INSERT INTO app_auth_tokens (id, kind, user_id, token_hash, created_at, expires_at, consumed_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          token.id,
          token.kind,
          token.user_id,
          token.token_hash,
          token.created_at,
          token.expires_at,
          token.consumed_at,
        ],
      )
    }

    for (const entry of runtimeState.auditLog) {
      await client.query(
        `
          INSERT INTO app_audit_log (id, actor_user_id, action, target_type, target_id, payload, created_at)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
          ON CONFLICT(id) DO NOTHING
        `,
        [
          entry.id,
          entry.actor_user_id,
          entry.action,
          entry.target_type,
          entry.target_id,
          entry.payload_json,
          entry.created_at,
        ],
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

function schedulePersist() {
  if (!initialized) return
  persistChain = persistChain
    .then(() => persistRuntimeStateToPostgres())
    .catch((error) => {
      console.error('runtime postgres persistence failed', String(error?.message ?? error))
    })
}

export async function flushRuntimeStore() {
  await persistChain
}

export async function initializeRuntimeStore() {
  primeFromLegacyJsonFiles()
  await loadRuntimeStateFromPostgres()

  const postgresEmpty =
    !runtimeState.registry &&
    runtimeState.users.length === 0 &&
    runtimeState.sessions.length === 0 &&
    runtimeState.tokens.length === 0

  if (postgresEmpty) {
    primedFromFiles = false
    primeFromLegacyJsonFiles()
    runtimeState.meta.set('app_runtime_migrated_from_legacy_json', '1')
    runtimeState.auditLog.push(auditToRow({
      action: 'app_runtime.migrated_from_legacy_json',
      targetType: 'app_runtime',
      targetId: 'default',
      payload: {
        users: runtimeState.users.length,
        sessions: runtimeState.sessions.length,
        cities: runtimeState.registryCities.length,
      },
    }))
    await persistRuntimeStateToPostgres()
  }

  initialized = true
  return {
    ok: true,
    store: 'postgres',
    users: runtimeState.users.length,
    sessions: runtimeState.sessions.length,
    cities: runtimeState.registryCities.length,
  }
}

function requirePrimedState() {
  if (!primedFromFiles && !initialized) {
    primeFromLegacyJsonFiles()
  }
}

function findSql(sql, pattern) {
  return String(sql).replace(/\s+/g, ' ').trim().toLowerCase().includes(pattern)
}

function prepareStatement(sql) {
  return {
    get(...params) {
      requirePrimedState()
      if (findSql(sql, 'select value from meta where key')) {
        const value = runtimeState.meta.get(params[0])
        return value == null ? undefined : { value }
      }
      if (findSql(sql, 'select version, active_city_id from city_registry')) {
        return runtimeState.registry ? clone(runtimeState.registry) : undefined
      }
      throw new Error(`UNSUPPORTED_RUNTIME_GET:${String(sql).slice(0, 80)}`)
    },
    all() {
      requirePrimedState()
      if (findSql(sql, 'select payload_json from cities')) {
        return clone(runtimeState.registryCities)
      }
      if (findSql(sql, 'select * from users')) {
        return clone(runtimeState.users)
      }
      if (findSql(sql, 'select * from sessions')) {
        return clone(runtimeState.sessions)
      }
      if (findSql(sql, 'select * from tokens')) {
        return clone(runtimeState.tokens)
      }
      throw new Error(`UNSUPPORTED_RUNTIME_ALL:${String(sql).slice(0, 80)}`)
    },
    run(...params) {
      requirePrimedState()
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()

      if (normalizedSql.startsWith('insert into meta')) {
        runtimeState.meta.set(params[0], String(params[1]))
        schedulePersist()
        return { changes: 1 }
      }
      if (normalizedSql.startsWith('insert into audit_log')) {
        runtimeState.auditLog.push({
          id: params[0],
          actor_user_id: params[1],
          action: params[2],
          target_type: params[3],
          target_id: params[4],
          payload_json: params[5],
          created_at: params[6],
        })
        schedulePersist()
        return { changes: 1 }
      }
      if (normalizedSql.startsWith('insert into city_registry')) {
        runtimeState.registry = {
          version: Number(params[0]),
          active_city_id: params[1],
          updated_at: params[2],
        }
        schedulePersist()
        return { changes: 1 }
      }
      if (normalizedSql.startsWith('delete from cities')) {
        runtimeState.registryCities = []
        schedulePersist()
        return { changes: 1 }
      }
      if (normalizedSql.startsWith('insert into cities')) {
        const row = {
          id: params[0],
          payload_json: params[1],
          sort_order: Number(params[2]),
          updated_at: params[3],
        }
        runtimeState.registryCities = [
          ...runtimeState.registryCities.filter((city) => city.id !== row.id),
          row,
        ].sort((left, right) => left.sort_order - right.sort_order || left.id.localeCompare(right.id))
        schedulePersist()
        return { changes: 1 }
      }
      if (normalizedSql.startsWith('insert into users')) {
        const row = {
          id: params[0],
          email: params[1],
          full_name: params[2],
          password_hash: params[3],
          password_salt: params[4],
          status: params[5],
          role: params[6],
          roles_json: params[7],
          primary_city_id: params[8],
          allowed_city_ids_json: params[9],
          created_at: params[10],
          updated_at: params[11],
          activated_at: params[12],
          last_login_at: params[13],
        }
        runtimeState.users = [
          ...runtimeState.users.filter((user) => user.id !== row.id),
          row,
        ].sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)) || left.email.localeCompare(right.email))
        schedulePersist()
        return { changes: 1 }
      }
      if (normalizedSql.startsWith('delete from sessions')) {
        runtimeState.sessions = []
        schedulePersist()
        return { changes: 1 }
      }
      if (normalizedSql.startsWith('insert into sessions')) {
        const row = {
          id: params[0],
          user_id: params[1],
          token_hash: params[2],
          city_id: params[3],
          created_at: params[4],
          last_seen_at: params[5],
          expires_at: params[6],
        }
        runtimeState.sessions = [
          ...runtimeState.sessions.filter((session) => session.id !== row.id),
          row,
        ].sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)))
        schedulePersist()
        return { changes: 1 }
      }
      if (normalizedSql.startsWith('delete from tokens')) {
        runtimeState.tokens = []
        schedulePersist()
        return { changes: 1 }
      }
      if (normalizedSql.startsWith('insert into tokens')) {
        const row = {
          id: params[0],
          kind: params[1],
          user_id: params[2],
          token_hash: params[3],
          created_at: params[4],
          expires_at: params[5],
          consumed_at: params[6],
        }
        runtimeState.tokens = [
          ...runtimeState.tokens.filter((token) => token.id !== row.id),
          row,
        ].sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)))
        schedulePersist()
        return { changes: 1 }
      }
      throw new Error(`UNSUPPORTED_RUNTIME_RUN:${String(sql).slice(0, 80)}`)
    },
  }
}

export function getDatabase() {
  requirePrimedState()
  return {
    exec() {},
    prepare: prepareStatement,
  }
}

export function readMeta(key) {
  requirePrimedState()
  return runtimeState.meta.get(key) ?? null
}

export function writeMeta(key, value) {
  requirePrimedState()
  runtimeState.meta.set(key, String(value))
  schedulePersist()
}

export function appendAuditLog({ actorUserId = null, action, targetType, targetId = null, payload = {} }) {
  requirePrimedState()
  runtimeState.auditLog.push(auditToRow({
    actorUserId,
    action,
    targetType,
    targetId,
    payload,
  }))
  schedulePersist()
}
