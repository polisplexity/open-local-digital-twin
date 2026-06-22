import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import nodemailer from 'nodemailer'
import { getCityRegistry } from './cityRegistry.mjs'
import {
  appendAuditLog,
  getDatabase,
  getRuntimeDir as getRuntimeDirFromStore,
  readJsonFile,
  readMeta,
  writeMeta,
} from './stateStore.mjs'

const USERS_FILE = 'users.json'
const SESSIONS_FILE = 'sessions.json'
const TOKENS_FILE = 'tokens.json'
const OUTBOX_DIR = 'outbox'
const SESSION_COOKIE = 'twin_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14
const SESSION_SHORT_TTL_MS = 1000 * 60 * 60 * 12
const ACTIVATION_TTL_MS = 1000 * 60 * 60 * 48
const RESET_TTL_MS = 1000 * 60 * 60 * 2
const PASSWORD_KEYLEN = 64
const AUTH_SECRET = process.env.TWIN_STUDIO_AUTH_SECRET || 'open-local-digital-twin-dev-secret'
const RAW_EMAIL_MODE = String(process.env.TWIN_STUDIO_EMAIL_MODE || 'console').trim().toLowerCase()
const ADMIN_EMAILS = String(process.env.TWIN_STUDIO_ADMIN_EMAILS || 'admin@example.org')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

let smtpTransportPromise = null

function nowIso() {
  return new Date().toISOString()
}

function plusMs(ms) {
  return new Date(Date.now() + ms).toISOString()
}

function getRuntimeDir() {
  return getRuntimeDirFromStore()
}

function getAuthDir() {
  return path.join(getRuntimeDir(), 'auth')
}

function ensureAuthDir() {
  fs.mkdirSync(getAuthDir(), { recursive: true })
  fs.mkdirSync(path.join(getAuthDir(), OUTBOX_DIR), { recursive: true })
}

function readJson(fileName, fallbackValue) {
  return readJsonFile(path.join(getAuthDir(), fileName), fallbackValue)
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function defaultUsersState() {
  return { version: 1, users: [] }
}

function defaultSessionsState() {
  return { version: 1, sessions: [] }
}

function defaultTokensState() {
  return { version: 1, activations: [], resets: [] }
}

function userFromRow(row = {}) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    status: row.status,
    role: row.role,
    roles: parseJsonArray(row.roles_json),
    primaryCityId: row.primary_city_id,
    allowedCityIds: parseJsonArray(row.allowed_city_ids_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activatedAt: row.activated_at ?? null,
    lastLoginAt: row.last_login_at ?? null,
  }
}

function sessionFromRow(row = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    cityId: row.city_id,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
  }
}

function tokenFromRow(row = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at ?? null,
  }
}

function upsertUserStatement(db) {
  return db.prepare(`
    INSERT INTO users (
      id, email, full_name, password_hash, password_salt, status, role,
      roles_json, primary_city_id, allowed_city_ids_json, created_at, updated_at,
      activated_at, last_login_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      full_name = excluded.full_name,
      password_hash = excluded.password_hash,
      password_salt = excluded.password_salt,
      status = excluded.status,
      role = excluded.role,
      roles_json = excluded.roles_json,
      primary_city_id = excluded.primary_city_id,
      allowed_city_ids_json = excluded.allowed_city_ids_json,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      activated_at = excluded.activated_at,
      last_login_at = excluded.last_login_at
  `)
}

function runUpsertUser(statement, user = {}) {
  statement.run(
    user.id,
    normalizeEmail(user.email),
    normalizeName(user.fullName),
    user.passwordHash,
    user.passwordSalt,
    user.status,
    user.role,
    JSON.stringify(user.roles ?? []),
    user.primaryCityId,
    JSON.stringify(user.allowedCityIds ?? []),
    user.createdAt ?? nowIso(),
    user.updatedAt ?? nowIso(),
    user.activatedAt ?? null,
    user.lastLoginAt ?? null,
  )
}

function insertSessionStatement(db) {
  return db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, city_id, created_at, last_seen_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      token_hash = excluded.token_hash,
      city_id = excluded.city_id,
      created_at = excluded.created_at,
      last_seen_at = excluded.last_seen_at,
      expires_at = excluded.expires_at
  `)
}

function runInsertSession(statement, session = {}) {
  statement.run(
    session.id,
    session.userId,
    session.tokenHash,
    session.cityId,
    session.createdAt,
    session.lastSeenAt,
    session.expiresAt,
  )
}

function insertTokenStatement(db) {
  return db.prepare(`
    INSERT INTO tokens (id, kind, user_id, token_hash, created_at, expires_at, consumed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      kind = excluded.kind,
      user_id = excluded.user_id,
      token_hash = excluded.token_hash,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at,
      consumed_at = excluded.consumed_at
  `)
}

function runInsertToken(statement, kind, token = {}) {
  statement.run(
    token.id,
    kind,
    token.userId,
    token.tokenHash,
    token.createdAt,
    token.expiresAt,
    token.consumedAt ?? null,
  )
}

function migrateAuthStateToDatabase() {
  if (readMeta('auth_state_migrated') === '1') {
    return
  }

  ensureAuthDir()
  const usersState = readJson(USERS_FILE, defaultUsersState())
  const sessionsState = readJson(SESSIONS_FILE, defaultSessionsState())
  const tokensState = readJson(TOKENS_FILE, defaultTokensState())
  const db = getDatabase()

  db.exec('BEGIN IMMEDIATE')
  try {
    const upsertUser = upsertUserStatement(db)
    const insertSession = insertSessionStatement(db)
    const insertToken = insertTokenStatement(db)

    for (const user of usersState.users ?? []) {
      runUpsertUser(upsertUser, user)
    }
    for (const session of sessionsState.sessions ?? []) {
      runInsertSession(insertSession, session)
    }
    for (const activation of tokensState.activations ?? []) {
      runInsertToken(insertToken, 'activation', activation)
    }
    for (const reset of tokensState.resets ?? []) {
      runInsertToken(insertToken, 'reset', reset)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  writeMeta('auth_state_migrated', '1')
  appendAuditLog({
    action: 'auth_state.migrated',
    targetType: 'auth_state',
    targetId: 'default',
    payload: {
      users: usersState.users?.length ?? 0,
      sessions: sessionsState.sessions?.length ?? 0,
      activations: tokensState.activations?.length ?? 0,
      resets: tokensState.resets?.length ?? 0,
    },
  })
}

function getUsersState() {
  migrateAuthStateToDatabase()
  const users = getDatabase()
    .prepare('SELECT * FROM users ORDER BY created_at ASC, email ASC')
    .all()
    .map(userFromRow)
  return { version: 1, users }
}

function setUsersState(state) {
  migrateAuthStateToDatabase()
  const db = getDatabase()
  db.exec('BEGIN IMMEDIATE')
  try {
    const upsertUser = upsertUserStatement(db)
    for (const user of state.users ?? []) {
      runUpsertUser(upsertUser, user)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function getSessionsState() {
  migrateAuthStateToDatabase()
  const sessions = getDatabase()
    .prepare('SELECT * FROM sessions ORDER BY created_at ASC')
    .all()
    .map(sessionFromRow)
  return { version: 1, sessions }
}

function setSessionsState(state) {
  migrateAuthStateToDatabase()
  const db = getDatabase()
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('DELETE FROM sessions').run()
    const insertSession = insertSessionStatement(db)
    for (const session of state.sessions ?? []) {
      runInsertSession(insertSession, session)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function getTokensState() {
  migrateAuthStateToDatabase()
  const rows = getDatabase()
    .prepare('SELECT * FROM tokens ORDER BY created_at ASC')
    .all()
  return {
    version: 1,
    activations: rows.filter((row) => row.kind === 'activation').map(tokenFromRow),
    resets: rows.filter((row) => row.kind === 'reset').map(tokenFromRow),
  }
}

function setTokensState(state) {
  migrateAuthStateToDatabase()
  const db = getDatabase()
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('DELETE FROM tokens').run()
    const insertToken = insertTokenStatement(db)
    for (const activation of state.activations ?? []) {
      runInsertToken(insertToken, 'activation', activation)
    }
    for (const reset of state.resets ?? []) {
      runInsertToken(insertToken, 'reset', reset)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase()
}

function normalizeName(name = '') {
  return String(name).trim().replace(/\s+/g, ' ')
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

function verifyPassword(password, hash, salt) {
  const candidate = hashPassword(password, salt)
  const expectedBuffer = Buffer.from(hash, 'hex')
  const candidateBuffer = Buffer.from(candidate, 'hex')
  if (expectedBuffer.length !== candidateBuffer.length) {
    return false
  }
  return crypto.timingSafeEqual(expectedBuffer, candidateBuffer)
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function createRawToken() {
  return crypto.randomBytes(24).toString('base64url')
}

function signValue(value) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(String(value)).digest('base64url')
}

function createSessionCookieValue(rawToken) {
  return `${rawToken}.${signValue(rawToken)}`
}

function readSessionCookieValue(cookieValue = '') {
  const [rawToken, signature] = String(cookieValue).split('.')
  if (!rawToken || !signature) {
    return null
  }
  const expected = signValue(rawToken)
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== providedBuffer.length) {
    return null
  }
  if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    return null
  }
  return rawToken
}

function parseCookies(header = '') {
  return String(header)
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((result, chunk) => {
      const separatorIndex = chunk.indexOf('=')
      if (separatorIndex === -1) {
        return result
      }
      const key = chunk.slice(0, separatorIndex).trim()
      const value = decodeURIComponent(chunk.slice(separatorIndex + 1))
      result[key] = value
      return result
    }, {})
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  parts.push(`Path=${options.path ?? '/'}`)
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`)
  }
  if (options.httpOnly !== false) {
    parts.push('HttpOnly')
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`)
  }
  if (options.secure) {
    parts.push('Secure')
  }
  return parts.join('; ')
}

function getBaseUrl(request) {
  const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const protocol = forwardedProto || (request.secure ? 'https' : 'http')
  return `${protocol}://${request.get('host')}`
}

function getEnabledCity(cityId) {
  const registry = getCityRegistry()
  return registry.cities.find((city) => city.id === cityId && city.enabled !== false) ?? null
}

function readEnv(name, fallback = '') {
  const value = process.env[name]
  return value === undefined || value === null ? fallback : String(value).trim()
}

function readBoolEnv(name, fallback) {
  const raw = readEnv(name, '')
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())
}

function resolveSmtpConfig() {
  const host = readEnv('TWIN_STUDIO_SMTP_HOST', readEnv('EMAIL_HOST', readEnv('DJANGO_EMAIL_HOST', '')))
  const portRaw = readEnv('TWIN_STUDIO_SMTP_PORT', readEnv('EMAIL_PORT', readEnv('DJANGO_EMAIL_PORT', '587')))
  const port = Number.parseInt(portRaw, 10) || 587
  const secure = readBoolEnv('TWIN_STUDIO_SMTP_SECURE', false)
  const user = readEnv(
    'TWIN_STUDIO_SMTP_USER',
    readEnv('EMAIL_HOST_USER', readEnv('DJANGO_EMAIL_HOST_USER', '')),
  )
  const pass = readEnv(
    'TWIN_STUDIO_SMTP_PASSWORD',
    readEnv('EMAIL_HOST_PASSWORD', readEnv('DJANGO_EMAIL_HOST_PASSWORD', '')),
  )
  const from = readEnv('TWIN_STUDIO_EMAIL_FROM', user || 'noreply@example.org')
  const fromName = readEnv('TWIN_STUDIO_EMAIL_FROM_NAME', 'Open Local Digital Twin')
  const replyTo = readEnv('TWIN_STUDIO_EMAIL_REPLY_TO', from)
  return { host, port, secure, user, pass, from, fromName, replyTo }
}

function hasSmtpConfig(config = resolveSmtpConfig()) {
  return Boolean(config.host && config.port && config.user && config.pass && config.from)
}

function resolveEmailMode() {
  if (RAW_EMAIL_MODE === 'smtp') return 'smtp'
  if (RAW_EMAIL_MODE === 'outbox') return 'outbox'
  return hasSmtpConfig() ? 'smtp' : 'outbox'
}

async function getSmtpTransport() {
  if (!smtpTransportPromise) {
    const config = resolveSmtpConfig()
    smtpTransportPromise = Promise.resolve(
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      }),
    )
  }
  return smtpTransportPromise
}

function resolveUserRoles(email, requestedRole) {
  const roles = [String(requestedRole || 'municipal-reviewer').trim() || 'municipal-reviewer']
  if (ADMIN_EMAILS.includes(email)) {
    roles.push('platform-admin')
  }
  return Array.from(new Set(roles))
}

function cleanupExpiredState() {
  const now = Date.now()

  const sessionsState = getSessionsState()
  const nextSessions = sessionsState.sessions.filter((session) => {
    const expiresAt = Date.parse(session.expiresAt || '')
    return Number.isFinite(expiresAt) && expiresAt > now
  })
  if (nextSessions.length !== sessionsState.sessions.length) {
    setSessionsState({ ...sessionsState, sessions: nextSessions })
  }

  const tokensState = getTokensState()
  const cleanBucket = (bucket) =>
    bucket.filter((entry) => {
      const expiresAt = Date.parse(entry.expiresAt || '')
      if (entry.consumedAt) return false
      return Number.isFinite(expiresAt) && expiresAt > now
    })
  const nextTokens = {
    ...tokensState,
    activations: cleanBucket(tokensState.activations),
    resets: cleanBucket(tokensState.resets),
  }
  if (
    nextTokens.activations.length !== tokensState.activations.length ||
    nextTokens.resets.length !== tokensState.resets.length
  ) {
    setTokensState(nextTokens)
  }
}

function writeOutboxMessage({ kind, to, subject, html, text, metadata }) {
  ensureAuthDir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const messageId = `${timestamp}-${crypto.randomBytes(4).toString('hex')}`
  const basePath = path.join(getAuthDir(), OUTBOX_DIR, `${messageId}-${kind}`)
  fs.writeFileSync(`${basePath}.html`, html)
  fs.writeFileSync(`${basePath}.txt`, text)
  fs.writeFileSync(
    `${basePath}.json`,
    `${JSON.stringify(
      {
        id: messageId,
        kind,
        to,
        subject,
        createdAt: nowIso(),
        metadata,
      },
      null,
      2,
    )}\n`,
  )
  return {
    id: messageId,
    htmlPath: `${basePath}.html`,
    textPath: `${basePath}.txt`,
    jsonPath: `${basePath}.json`,
  }
}

async function deliverEmailMessage({ kind, to, subject, html, text, metadata }) {
  const outbox = writeOutboxMessage({ kind, to, subject, html, text, metadata })
  const mode = resolveEmailMode()
  if (mode !== 'smtp') {
    return {
      delivery: 'outbox',
      outbox,
      smtp: null,
    }
  }

  const smtpConfig = resolveSmtpConfig()
  if (!hasSmtpConfig(smtpConfig)) {
    throw new Error('SMTP_NOT_CONFIGURED')
  }

  try {
    const transport = await getSmtpTransport()
    const info = await transport.sendMail({
      from: smtpConfig.fromName ? `"${smtpConfig.fromName}" <${smtpConfig.from}>` : smtpConfig.from,
      to,
      replyTo: smtpConfig.replyTo || undefined,
      subject,
      text,
      html,
    })
    return {
      delivery: 'smtp',
      outbox,
      smtp: {
        accepted: info.accepted ?? [],
        rejected: info.rejected ?? [],
        response: info.response ?? '',
        messageId: info.messageId ?? null,
      },
    }
  } catch (error) {
    throw new Error(`SMTP_SEND_FAILED:${String(error?.message || error)}`)
  }
}

function buildActivationEmail({ user, city, activationLink }) {
  const subject = `Activate your ${city.twinLabel || `${city.name} Digital Twin`} workspace account`
  const text = [
    `Hello ${user.fullName},`,
    '',
    `Your account request for ${city.name}, ${city.country} is ready for activation.`,
    '',
    `Activation link: ${activationLink}`,
    '',
    'If you did not request this account, you can ignore this email.',
  ].join('\n')
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a">
      <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#0f8b9a;margin-bottom:8px">Polisplexity / Twin Base Studio</div>
      <h2 style="margin:0 0 12px 0">Activate your workspace account</h2>
      <p style="margin:0 0 12px 0">Hello ${user.fullName},</p>
      <p style="margin:0 0 12px 0">Your account request for <strong>${city.name}, ${city.country}</strong> is ready for activation.</p>
      <p style="margin:0 0 24px 0">Use the button below to activate the workspace and sign in.</p>
      <p style="margin:0 0 24px 0">
        <a href="${activationLink}" style="display:inline-block;background:#0f8b9a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Activate workspace access</a>
      </p>
      <p style="font-size:13px;color:#475569;word-break:break-word;margin:0 0 12px 0">${activationLink}</p>
      <p style="font-size:13px;color:#64748b;margin:0">If you did not request this account, you can ignore this message.</p>
    </div>
  `.trim()
  return { subject, html, text }
}

function buildResetEmail({ user, city, resetLink }) {
  const subject = `Reset your ${city.twinLabel || `${city.name} Digital Twin`} workspace password`
  const text = [
    `Hello ${user.fullName},`,
    '',
    `A password reset was requested for your ${city.name}, ${city.country} workspace account.`,
    '',
    `Reset link: ${resetLink}`,
    '',
    'If you did not request this reset, you can ignore this email.',
  ].join('\n')
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a">
      <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#0f8b9a;margin-bottom:8px">Polisplexity / Twin Base Studio</div>
      <h2 style="margin:0 0 12px 0">Reset your workspace password</h2>
      <p style="margin:0 0 12px 0">Hello ${user.fullName},</p>
      <p style="margin:0 0 12px 0">A password reset was requested for your <strong>${city.name}, ${city.country}</strong> workspace account.</p>
      <p style="margin:0 0 24px 0">
        <a href="${resetLink}" style="display:inline-block;background:#0f8b9a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Reset password</a>
      </p>
      <p style="font-size:13px;color:#475569;word-break:break-word;margin:0 0 12px 0">${resetLink}</p>
      <p style="font-size:13px;color:#64748b;margin:0">If you did not request this reset, you can ignore this message.</p>
    </div>
  `.trim()
  return { subject, html, text }
}

function publicUser(user = {}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    roles: user.roles ?? [],
    primaryCityId: user.primaryCityId,
    allowedCityIds: user.allowedCityIds ?? [],
    status: user.status,
    createdAt: user.createdAt,
    activatedAt: user.activatedAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE
}

export function setAuthCookie(response, rawToken, rememberMe = true, secure = process.env.NODE_ENV === 'production') {
  response.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, createSessionCookieValue(rawToken), {
      maxAge: rememberMe ? SESSION_TTL_MS : SESSION_SHORT_TTL_MS,
      sameSite: 'Lax',
      secure,
      httpOnly: true,
      path: '/',
    }),
  )
}

export function clearAuthCookie(response, secure = process.env.NODE_ENV === 'production') {
  response.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, '', {
      maxAge: 0,
      sameSite: 'Lax',
      secure,
      httpOnly: true,
      path: '/',
    }),
  )
}

export function getRequestSession(request) {
  cleanupExpiredState()
  const cookieHeader = request.headers.cookie || ''
  const cookies = parseCookies(cookieHeader)
  const rawToken = readSessionCookieValue(cookies[SESSION_COOKIE] || '')
  if (!rawToken) {
    return null
  }

  const sessionTokenHash = hashToken(rawToken)
  const sessionsState = getSessionsState()
  const session = sessionsState.sessions.find((entry) => entry.tokenHash === sessionTokenHash)
  if (!session) {
    return null
  }

  const usersState = getUsersState()
  const user = usersState.users.find((entry) => entry.id === session.userId && entry.status === 'active')
  if (!user) {
    return null
  }

  return {
    rawToken,
    session,
    user: publicUser(user),
  }
}

export function destroyRequestSession(request) {
  const current = getRequestSession(request)
  if (!current) {
    return false
  }
  const sessionsState = getSessionsState()
  sessionsState.sessions = sessionsState.sessions.filter((entry) => entry.tokenHash !== current.session.tokenHash)
  setSessionsState(sessionsState)
  return true
}

export async function createSignupRequest({ fullName, email, password, cityId, role, request }) {
  const normalizedEmail = normalizeEmail(email)
  const normalizedName = normalizeName(fullName)
  if (!normalizedName) {
    throw new Error('FULL_NAME_REQUIRED')
  }
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('EMAIL_REQUIRED')
  }
  if (String(password || '').length < 10) {
    throw new Error('PASSWORD_TOO_SHORT')
  }

  const city = getEnabledCity(cityId)
  if (!city) {
    throw new Error('CITY_NOT_AVAILABLE')
  }

  const usersState = getUsersState()
  const existingUser = usersState.users.find((entry) => entry.email === normalizedEmail)
  if (existingUser?.status === 'active') {
    throw new Error('ACCOUNT_ALREADY_ACTIVE')
  }

  const passwordState = createPasswordHash(password)
  const user = existingUser ?? {
    id: crypto.randomUUID(),
    createdAt: nowIso(),
  }

  user.email = normalizedEmail
  user.fullName = normalizedName
  user.passwordHash = passwordState.hash
  user.passwordSalt = passwordState.salt
  user.status = 'pending-activation'
  user.role = String(role || 'municipal-reviewer').trim() || 'municipal-reviewer'
  user.roles = resolveUserRoles(normalizedEmail, user.role)
  user.primaryCityId = city.id
  user.allowedCityIds = Array.from(new Set([city.id, ...(existingUser?.allowedCityIds ?? [])]))
  user.updatedAt = nowIso()

  if (existingUser) {
    usersState.users = usersState.users.map((entry) => (entry.id === user.id ? user : entry))
  } else {
    usersState.users.push(user)
  }
  setUsersState(usersState)

  const tokensState = getTokensState()
  tokensState.activations = tokensState.activations.filter((entry) => entry.userId !== user.id)
  const rawToken = createRawToken()
  tokensState.activations.push({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: hashToken(rawToken),
    createdAt: nowIso(),
    expiresAt: plusMs(ACTIVATION_TTL_MS),
    consumedAt: null,
  })
  setTokensState(tokensState)

  const activationLink = `${getBaseUrl(request)}/auth/activate?token=${encodeURIComponent(rawToken)}`
  const message = buildActivationEmail({ user, city, activationLink })
  const deliveryResult = await deliverEmailMessage({
    kind: 'activation',
    to: normalizedEmail,
    subject: message.subject,
    html: message.html,
    text: message.text,
    metadata: { cityId: city.id, userId: user.id, activationLink },
  })

  return {
    ok: true,
    status: 'pending-activation',
    delivery: deliveryResult.delivery,
    user: publicUser(user),
    outbox: deliveryResult.outbox,
    smtp: deliveryResult.smtp,
  }
}

export function activateUserFromToken(rawToken) {
  cleanupExpiredState()
  if (!rawToken) {
    throw new Error('TOKEN_REQUIRED')
  }

  const tokensState = getTokensState()
  const tokenHash = hashToken(rawToken)
  const activation = tokensState.activations.find((entry) => entry.tokenHash === tokenHash)
  if (!activation) {
    throw new Error('TOKEN_INVALID')
  }

  const usersState = getUsersState()
  const user = usersState.users.find((entry) => entry.id === activation.userId)
  if (!user) {
    throw new Error('USER_NOT_FOUND')
  }

  user.status = 'active'
  user.activatedAt = nowIso()
  user.updatedAt = nowIso()
  usersState.users = usersState.users.map((entry) => (entry.id === user.id ? user : entry))
  setUsersState(usersState)

  activation.consumedAt = nowIso()
  tokensState.activations = tokensState.activations.filter((entry) => entry.id !== activation.id)
  setTokensState(tokensState)

  return {
    ok: true,
    user: publicUser(user),
  }
}

export async function requestPasswordReset({ email, request }) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) {
    throw new Error('EMAIL_REQUIRED')
  }

  const usersState = getUsersState()
  const user = usersState.users.find((entry) => entry.email === normalizedEmail && entry.status === 'active')
  if (!user) {
    return { ok: true, status: 'accepted' }
  }

  const city = getCityRegistry().cities.find((entry) => entry.id === user.primaryCityId) ?? getEnabledCity(user.primaryCityId)
  const tokensState = getTokensState()
  tokensState.resets = tokensState.resets.filter((entry) => entry.userId !== user.id)

  const rawToken = createRawToken()
  tokensState.resets.push({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: hashToken(rawToken),
    createdAt: nowIso(),
    expiresAt: plusMs(RESET_TTL_MS),
    consumedAt: null,
  })
  setTokensState(tokensState)

  const resetLink = `${getBaseUrl(request)}/auth/reset-password?token=${encodeURIComponent(rawToken)}`
  const message = buildResetEmail({ user, city: city ?? { name: 'Workspace', country: '' }, resetLink })
  const deliveryResult = await deliverEmailMessage({
    kind: 'reset',
    to: normalizedEmail,
    subject: message.subject,
    html: message.html,
    text: message.text,
    metadata: { cityId: user.primaryCityId, userId: user.id, resetLink },
  })

  return {
    ok: true,
    status: 'accepted',
    delivery: deliveryResult.delivery,
    outbox: deliveryResult.outbox,
    smtp: deliveryResult.smtp,
  }
}

export function resetPasswordFromToken({ token, password }) {
  cleanupExpiredState()
  if (!token) {
    throw new Error('TOKEN_REQUIRED')
  }
  if (String(password || '').length < 10) {
    throw new Error('PASSWORD_TOO_SHORT')
  }

  const tokensState = getTokensState()
  const tokenHash = hashToken(token)
  const reset = tokensState.resets.find((entry) => entry.tokenHash === tokenHash)
  if (!reset) {
    throw new Error('TOKEN_INVALID')
  }

  const usersState = getUsersState()
  const user = usersState.users.find((entry) => entry.id === reset.userId && entry.status === 'active')
  if (!user) {
    throw new Error('USER_NOT_FOUND')
  }

  const passwordState = createPasswordHash(password)
  user.passwordHash = passwordState.hash
  user.passwordSalt = passwordState.salt
  user.updatedAt = nowIso()
  usersState.users = usersState.users.map((entry) => (entry.id === user.id ? user : entry))
  setUsersState(usersState)

  tokensState.resets = tokensState.resets.filter((entry) => entry.id !== reset.id)
  setTokensState(tokensState)

  return {
    ok: true,
    user: publicUser(user),
  }
}

export function createLoginSession({ email, password, cityId, rememberMe = true }) {
  cleanupExpiredState()
  const normalizedEmail = normalizeEmail(email)
  const usersState = getUsersState()
  const user = usersState.users.find((entry) => entry.email === normalizedEmail)

  if (!user || user.status !== 'active') {
    throw new Error('INVALID_CREDENTIALS')
  }
  if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    throw new Error('INVALID_CREDENTIALS')
  }

  const isAdmin = Boolean(user.roles?.includes('platform-admin'))
  const enabledCityIds = getCityRegistry().cities
    .filter((entry) => entry.enabled !== false)
    .map((entry) => entry.id)
  const allowedCityIds = isAdmin
    ? enabledCityIds
    : user.allowedCityIds?.length ? user.allowedCityIds : [user.primaryCityId]
  const fallbackCityId = allowedCityIds.includes(user.primaryCityId)
    ? user.primaryCityId
    : allowedCityIds[0]
  const selectedCityId = allowedCityIds.includes(cityId) ? cityId : fallbackCityId
  const city = getEnabledCity(selectedCityId)
  if (!city) {
    throw new Error('CITY_NOT_AVAILABLE')
  }

  const rawToken = createRawToken()
  const sessionsState = getSessionsState()
  sessionsState.sessions.push({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: hashToken(rawToken),
    cityId: selectedCityId,
    createdAt: nowIso(),
    lastSeenAt: nowIso(),
    expiresAt: plusMs(rememberMe ? SESSION_TTL_MS : SESSION_SHORT_TTL_MS),
  })
  setSessionsState(sessionsState)

  user.lastLoginAt = nowIso()
  user.updatedAt = nowIso()
  usersState.users = usersState.users.map((entry) => (entry.id === user.id ? user : entry))
  setUsersState(usersState)

  return {
    rawToken,
    session: {
      cityId: selectedCityId,
      expiresAt: plusMs(rememberMe ? SESSION_TTL_MS : SESSION_SHORT_TTL_MS),
    },
    user: publicUser(user),
  }
}

export function getPlatformAuthContext(request) {
  const current = getRequestSession(request)
  if (!current) {
    return {
      authenticated: false,
      currentUser: null,
      allowedCityIds: [],
    }
  }

  return {
    authenticated: true,
    currentUser: current.user,
    allowedCityIds: current.user.allowedCityIds ?? [],
  }
}

export function requireAdmin(request) {
  const current = getRequestSession(request)
  if (!current) return null
  if (!current.user.roles?.includes('platform-admin')) return null
  return current
}

export function requireCityAccess(request, requestedCityId = 'current') {
  const current = getRequestSession(request)
  if (!current) return null

  const registry = getCityRegistry()
  const isAdmin = Boolean(current.user.roles?.includes('platform-admin'))
  const normalizedCityId = String(requestedCityId || 'current').trim()
  const cityId =
    !normalizedCityId || normalizedCityId === 'current'
      ? current.session.cityId || registry.activeCityId
      : normalizedCityId
  const city = registry.cities.find((entry) => entry.id === cityId)

  if (!city) return null
  if (city.enabled === false && !isAdmin) return null
  if (isAdmin) {
    return {
      ...current,
      city,
      cityId,
    }
  }

  const allowedCityIds = current.user.allowedCityIds?.length
    ? current.user.allowedCityIds
    : [current.user.primaryCityId]
  if (!allowedCityIds.includes(cityId)) return null

  return {
    ...current,
    city,
    cityId,
  }
}
