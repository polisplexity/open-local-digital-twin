import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import pg from 'pg'

import { getProductionDatabaseUrl, runProductionMigrationsForDatabaseUrl } from '../../db/migrate.mjs'
import { getRuntimeDir } from '../stateStore.mjs'
import { evaluateCityBoundaryQualityGate } from './citySourcePlanService.mjs'
import { withClient } from './dbUtils.mjs'

const { Pool } = pg

export const DATA_FACTORY_CITY_INPUT_PACKAGE_SCHEMA_VERSION = '2026-06-27.data-factory-city-input-package.v1'

const SENSITIVE_TABLE_DATA_EXCLUDES = [
  'public.app_auth_*',
  'public.app_audit_log',
  'ldt_ops.artifact_stores',
  'ldt_ops.processing_nodes',
  'ldt_ops.processing_node_heartbeats',
  'ldt_ops.processing_node_tokens',
  'ldt_ops.processing_node_stage_bindings',
  'ldt_ops.data_factory_dispatches',
]

const REFERENCE_TABLE_EXPORTS = [
  { table: 'ldt_core.entity_type_registry', sql: 'SELECT * FROM ldt_core.entity_type_registry', deleteSql: '' },
  { table: 'ldt_core.identifier_namespaces', sql: 'SELECT * FROM ldt_core.identifier_namespaces', deleteSql: '' },
  { table: 'ldt_prov.agents', sql: 'SELECT * FROM ldt_prov.agents', deleteSql: '' },
  { table: 'ldt_semantic.semantic_class_registry', sql: 'SELECT * FROM ldt_semantic.semantic_class_registry', deleteSql: '' },
  { table: 'ldt_semantic.semantic_tag_definitions', sql: 'SELECT * FROM ldt_semantic.semantic_tag_definitions', deleteSql: '' },
  { table: 'ldt_semantic.semantic_class_entity_type_map', sql: 'SELECT * FROM ldt_semantic.semantic_class_entity_type_map', deleteSql: '' },
  { table: 'ldt_semantic.pack_registry', sql: 'SELECT * FROM ldt_semantic.pack_registry', deleteSql: '' },
]

const CITY_SCOPED_TABLE_EXPORTS = [
  {
    table: 'ldt_core.cities',
    sql: 'SELECT * FROM ldt_core.cities WHERE id = $1',
    deleteSql: 'DELETE FROM ldt_core.cities WHERE id = $1',
  },
  {
    table: 'public.cities',
    sql: 'SELECT * FROM public.cities WHERE id = $1',
    deleteSql: 'DELETE FROM public.cities WHERE id = $1',
  },
  {
    table: 'ldt_core.city_boundaries',
    sql: 'SELECT * FROM ldt_core.city_boundaries WHERE city_id = $1',
    deleteSql: 'DELETE FROM ldt_core.city_boundaries WHERE city_id = $1',
  },
  {
    table: 'public.city_boundaries',
    sql: 'SELECT * FROM public.city_boundaries WHERE city_id = $1',
    deleteSql: 'DELETE FROM public.city_boundaries WHERE city_id = $1',
  },
  {
    table: 'ldt_catalog.datasets',
    sql: 'SELECT * FROM ldt_catalog.datasets WHERE city_id = $1',
    deleteSql: 'DELETE FROM ldt_catalog.datasets WHERE city_id = $1',
    scope: 'provenance',
  },
  {
    table: 'ldt_core.city_entities',
    sql: 'SELECT * FROM ldt_core.city_entities WHERE city_id = $1',
    deleteSql: 'DELETE FROM ldt_core.city_entities WHERE city_id = $1',
  },
  {
    table: 'ldt_core.building_entities',
    sql: 'SELECT child.* FROM ldt_core.building_entities child JOIN ldt_core.city_entities entity ON entity.id = child.entity_id WHERE entity.city_id = $1',
    deleteSql: 'DELETE FROM ldt_core.building_entities child USING ldt_core.city_entities entity WHERE entity.id = child.entity_id AND entity.city_id = $1',
  },
  {
    table: 'ldt_core.road_entities',
    sql: 'SELECT child.* FROM ldt_core.road_entities child JOIN ldt_core.city_entities entity ON entity.id = child.entity_id WHERE entity.city_id = $1',
    deleteSql: 'DELETE FROM ldt_core.road_entities child USING ldt_core.city_entities entity WHERE entity.id = child.entity_id AND entity.city_id = $1',
  },
  {
    table: 'ldt_core.facility_entities',
    sql: 'SELECT child.* FROM ldt_core.facility_entities child JOIN ldt_core.city_entities entity ON entity.id = child.entity_id WHERE entity.city_id = $1',
    deleteSql: 'DELETE FROM ldt_core.facility_entities child USING ldt_core.city_entities entity WHERE entity.id = child.entity_id AND entity.city_id = $1',
  },
  {
    table: 'ldt_core.place_entities',
    sql: 'SELECT child.* FROM ldt_core.place_entities child JOIN ldt_core.city_entities entity ON entity.id = child.entity_id WHERE entity.city_id = $1',
    deleteSql: 'DELETE FROM ldt_core.place_entities child USING ldt_core.city_entities entity WHERE entity.id = child.entity_id AND entity.city_id = $1',
  },
  {
    table: 'ldt_core.green_blue_entities',
    sql: 'SELECT child.* FROM ldt_core.green_blue_entities child JOIN ldt_core.city_entities entity ON entity.id = child.entity_id WHERE entity.city_id = $1',
    deleteSql: 'DELETE FROM ldt_core.green_blue_entities child USING ldt_core.city_entities entity WHERE entity.id = child.entity_id AND entity.city_id = $1',
  },
  {
    table: 'ldt_core.land_use_entities',
    sql: 'SELECT child.* FROM ldt_core.land_use_entities child JOIN ldt_core.city_entities entity ON entity.id = child.entity_id WHERE entity.city_id = $1',
    deleteSql: 'DELETE FROM ldt_core.land_use_entities child USING ldt_core.city_entities entity WHERE entity.id = child.entity_id AND entity.city_id = $1',
  },
  {
    table: 'ldt_core.mobility_entities',
    sql: 'SELECT child.* FROM ldt_core.mobility_entities child JOIN ldt_core.city_entities entity ON entity.id = child.entity_id WHERE entity.city_id = $1',
    deleteSql: 'DELETE FROM ldt_core.mobility_entities child USING ldt_core.city_entities entity WHERE entity.id = child.entity_id AND entity.city_id = $1',
  },
  {
    table: 'ldt_core.entity_identifiers',
    sql: 'SELECT child.* FROM ldt_core.entity_identifiers child JOIN ldt_core.city_entities entity ON entity.id = child.entity_id WHERE entity.city_id = $1',
    deleteSql: 'DELETE FROM ldt_core.entity_identifiers child USING ldt_core.city_entities entity WHERE entity.id = child.entity_id AND entity.city_id = $1',
  },
  {
    table: 'ldt_prov.activities',
    sql: 'SELECT * FROM ldt_prov.activities WHERE city_id = $1',
    deleteSql: 'DELETE FROM ldt_prov.activities WHERE city_id = $1',
    scope: 'provenance',
  },
  {
    table: 'ldt_prov.source_features',
    sql: 'SELECT * FROM ldt_prov.source_features WHERE city_id = $1',
    deleteSql: 'DELETE FROM ldt_prov.source_features WHERE city_id = $1',
    scope: 'provenance',
  },
  {
    table: 'ldt_prov.entity_source_evidence',
    sql: 'SELECT evidence.* FROM ldt_prov.entity_source_evidence evidence JOIN ldt_core.city_entities entity ON entity.id = evidence.entity_id WHERE entity.city_id = $1',
    deleteSql: 'DELETE FROM ldt_prov.entity_source_evidence evidence USING ldt_core.city_entities entity WHERE entity.id = evidence.entity_id AND entity.city_id = $1',
    scope: 'provenance',
  },
  {
    table: 'ldt_prov.entity_match_groups',
    sql: 'SELECT * FROM ldt_prov.entity_match_groups WHERE city_id = $1',
    deleteSql: 'DELETE FROM ldt_prov.entity_match_groups WHERE city_id = $1',
    scope: 'provenance',
  },
  {
    table: 'ldt_prov.entity_match_group_members',
    sql: 'SELECT member.* FROM ldt_prov.entity_match_group_members member JOIN ldt_prov.entity_match_groups match_group ON match_group.id = member.match_group_id WHERE match_group.city_id = $1',
    deleteSql: 'DELETE FROM ldt_prov.entity_match_group_members member USING ldt_prov.entity_match_groups match_group WHERE match_group.id = member.match_group_id AND match_group.city_id = $1',
    scope: 'provenance',
  },
  {
    table: 'ldt_semantic.entity_semantic_tags',
    sql: 'SELECT tag.* FROM ldt_semantic.entity_semantic_tags tag JOIN ldt_core.city_entities entity ON entity.id = tag.entity_id WHERE entity.city_id = $1',
    deleteSql: 'DELETE FROM ldt_semantic.entity_semantic_tags tag USING ldt_core.city_entities entity WHERE entity.id = tag.entity_id AND entity.city_id = $1',
    scope: 'semantic',
  },
  {
    table: 'ldt_semantic.source_semantic_mappings',
    sql: 'SELECT * FROM ldt_semantic.source_semantic_mappings WHERE city_id = $1 OR city_id IS NULL',
    deleteSql: 'DELETE FROM ldt_semantic.source_semantic_mappings WHERE city_id = $1',
    scope: 'semantic',
  },
  {
    table: 'ldt_semantic.city_pack_bindings',
    sql: 'SELECT * FROM ldt_semantic.city_pack_bindings WHERE city_id = $1',
    deleteSql: 'DELETE FROM ldt_semantic.city_pack_bindings WHERE city_id = $1',
    scope: 'semantic',
  },
  {
    table: 'ldt_environment.object_observation_summary',
    sql: 'SELECT * FROM ldt_environment.object_observation_summary WHERE city_id = $1',
    deleteSql: 'DELETE FROM ldt_environment.object_observation_summary WHERE city_id = $1',
    scope: 'environmental',
  },
]

const LEGACY_WORKSPACE_DUMP_MODE = 'workspace-postgis'
const CITY_SCOPED_DUMP_MODE = 'city-scoped-jsonl'
const DEFAULT_CITY_INPUT_SCOPE = 'viewer-runtime'

function normalizeInputScope(value) {
  const normalized = normalizeKey(value, DEFAULT_CITY_INPUT_SCOPE)
  if (['viewer-runtime', 'semantic', 'provenance', 'environmental', 'full-city'].includes(normalized)) return normalized
  throw new Error(`CITY_INPUT_SCOPE_INVALID:${normalized}`)
}

function scopedExportSpecs(inputScope = DEFAULT_CITY_INPUT_SCOPE) {
  if (inputScope === 'full-city') return [...REFERENCE_TABLE_EXPORTS, ...CITY_SCOPED_TABLE_EXPORTS]
  const allowedScopes = new Set([undefined, null, '', inputScope])
  if (inputScope === 'semantic') allowedScopes.add('provenance')
  return [
    ...REFERENCE_TABLE_EXPORTS,
    ...CITY_SCOPED_TABLE_EXPORTS.filter((entry) => allowedScopes.has(entry.scope ?? '')),
  ]
}

function requireText(value, errorCode) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(errorCode)
  return text
}

function optionalText(value) {
  return String(value ?? '').trim()
}

function normalizeKey(value, fallback = 'city-input') {
  const normalized = (String(value ?? '').trim() || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{0,128}$/.test(normalized)) throw new Error('CITY_INPUT_PACKAGE_KEY_INVALID')
  return normalized
}

function timestampKey() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return `sha256:${hash.digest('hex')}`
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function writeTextFile(filePath, content, mode = null) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
  if (mode !== null) fs.chmodSync(filePath, mode)
}

function safeDatabaseDescriptor(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl)
    return {
      protocol: parsed.protocol.replace(/:$/, ''),
      host: parsed.hostname,
      port: parsed.port || null,
      database: parsed.pathname.replace(/^\//, '') || null,
    }
  } catch {
    return {
      protocol: 'unknown',
      host: 'unknown',
      port: null,
      database: null,
    }
  }
}

function runCommand(command, args, {
  env = process.env,
  maxBuffer = 1024 * 1024 * 80,
  errorCode = 'CITY_INPUT_COMMAND_FAILED',
} = {}) {
  const result = spawnSync(command, args, {
    env,
    encoding: 'utf8',
    maxBuffer,
  })
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || result.status).slice(-4000)
    throw new Error(`${errorCode}:${command}:${detail}`)
  }
  return {
    status: result.status,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
  }
}

function tarPackage({ packageRoot, tarballPath }) {
  fs.rmSync(tarballPath, { force: true })
  fs.mkdirSync(path.dirname(tarballPath), { recursive: true })
  runCommand('tar', ['-czf', tarballPath, '-C', packageRoot, '.'], {
    errorCode: 'CITY_INPUT_PACKAGE_TAR_FAILED',
  })
  return {
    uri: `file://${tarballPath}`,
    localPath: tarballPath,
    byteSize: fs.statSync(tarballPath).size,
    checksum: sha256File(tarballPath),
  }
}

function restoreScript() {
  return `#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"
: "\${TWIN_STUDIO_DATABASE_URL:?TWIN_STUDIO_DATABASE_URL is required}"

npm run ops:restore-data-factory-city-input -- \\
  --manifest="\${ROOT}/manifest.json" \\
  --target-database-url="\${TWIN_STUDIO_DATABASE_URL}" \\
  "$@"
`
}

function runtimeRelativePath(filePath) {
  const runtimeDir = getRuntimeDir()
  const relative = path.relative(runtimeDir, filePath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null
  return relative.split(path.sep).join('/')
}

function artifactFromPackageResult(packageResult, artifactRow = null) {
  const relativePath = runtimeRelativePath(packageResult.tarball.localPath)
  return {
    id: artifactRow?.id ?? null,
    artifactKind: 'data-factory-city-input-package',
    artifactUri: artifactRow?.artifact_uri ?? (relativePath ? `runtime://${relativePath}` : packageResult.tarball.uri),
    mediaType: artifactRow?.media_type ?? 'application/gzip',
    byteSize: Number(artifactRow?.byte_size ?? packageResult.tarball.byteSize ?? 0),
    checksum: artifactRow?.checksum ?? packageResult.tarball.checksum,
    localPath: packageResult.tarball.localPath,
    relativePath,
    createdAt: artifactRow?.created_at ?? null,
  }
}

async function collectSourceSummary({ databaseUrl, cityId }) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: Number(process.env.TWIN_STUDIO_DATABASE_CONNECT_TIMEOUT_MS ?? 10000),
  })
  try {
    const city = await pool.query('SELECT id, name, country, metadata FROM ldt_core.cities WHERE id = $1', [cityId])
    if (city.rowCount === 0) throw new Error(`CITY_INPUT_SOURCE_CITY_NOT_FOUND:${cityId}`)
    const entityCounts = await pool.query(`
      SELECT entity_type, count(*)::int AS count
      FROM ldt_core.city_entities
      WHERE city_id = $1
      GROUP BY entity_type
      ORDER BY entity_type
    `, [cityId])
    const sourceCounts = await pool.query(`
      SELECT source_layer, count(*)::int AS count
      FROM ldt_prov.source_features
      WHERE city_id = $1
      GROUP BY source_layer
      ORDER BY source_layer
    `, [cityId])
    return {
      city: city.rows[0],
      counts: {
        entityTypes: Object.fromEntries(entityCounts.rows.map((row) => [row.entity_type, row.count])),
        sourceLayers: Object.fromEntries(sourceCounts.rows.map((row) => [row.source_layer, row.count])),
      },
    }
  } finally {
    await pool.end()
  }
}

async function tableExists(client, table) {
  const result = await client.query('SELECT to_regclass($1) AS table_name', [table])
  return Boolean(result.rows[0]?.table_name)
}

function tableFileName(table) {
  return `${table.replace('.', '__')}.jsonl`
}

function sqlLiteral(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`
}

function sqlWithCityLiteral(sql, cityId) {
  return sql.replace(/\$1/g, sqlLiteral(cityId))
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`
}

async function primaryKeyOrderClause(client, table) {
  const result = await client.query(
    `
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a
        ON a.attrelid = i.indrelid
       AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass
        AND i.indisprimary
      ORDER BY array_position(i.indkey, a.attnum)
    `,
    [table],
  )
  if (result.rowCount > 0) {
    return result.rows.map((row) => `q.${quoteIdentifier(row.attname)}`).join(', ')
  }
  return 'row_to_json(q)::text'
}

async function copyQueryToJsonlFile({ client, sql, filePath, orderBy, chunkSize = 5000 }) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const stream = fs.createWriteStream(filePath, { encoding: 'utf8' })
  try {
    for (let offset = 0; ; offset += chunkSize) {
      const result = await client.query(
        `SELECT row_to_json(q)::text AS json FROM (${sql}) q ORDER BY ${orderBy} LIMIT $1 OFFSET $2`,
        [chunkSize, offset],
      )
      if (result.rowCount === 0) break
      for (const row of result.rows) {
        stream.write(`${row.json}\n`)
      }
    }
  } finally {
    await new Promise((resolve, reject) => {
      stream.end((error) => (error ? reject(error) : resolve()))
    })
  }
}

async function exportLogicalTable(client, exportSpec, cityId, dataDir) {
  if (!await tableExists(client, exportSpec.table)) {
    return {
      table: exportSpec.table,
      skipped: true,
      reason: 'table-not-found',
      rows: 0,
      relativePath: null,
    }
  }
  const relativePath = `data/${tableFileName(exportSpec.table)}`
  const params = exportSpec.sql.includes('$1') ? [cityId] : []
  const countSql = `SELECT count(*)::int AS count FROM (${exportSpec.sql}) scoped`
  const countResult = await client.query(countSql, params)
  const rowCount = Number(countResult.rows[0]?.count ?? 0)
  const orderBy = await primaryKeyOrderClause(client, exportSpec.table)
  await copyQueryToJsonlFile({
    client,
    sql: exportSpec.sql.includes('$1') ? sqlWithCityLiteral(exportSpec.sql, cityId) : exportSpec.sql,
    filePath: path.join(dataDir, tableFileName(exportSpec.table)),
    orderBy,
  })
  return {
    table: exportSpec.table,
    relativePath,
    rows: rowCount,
    skipped: false,
  }
}

async function createCityScopedLogicalInput({
  databaseUrl,
  cityId,
  packageRoot,
  inputScope = DEFAULT_CITY_INPUT_SCOPE,
}) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: Number(process.env.TWIN_STUDIO_DATABASE_CONNECT_TIMEOUT_MS ?? 10000),
  })
  const client = await pool.connect()
  try {
    const dataDir = path.join(packageRoot, 'data')
    fs.mkdirSync(dataDir, { recursive: true })
    const exports = []
    for (const exportSpec of scopedExportSpecs(inputScope)) {
      exports.push(await exportLogicalTable(client, exportSpec, cityId, dataDir))
    }
    const dataManifest = {
      kind: 'data-factory-city-scoped-logical-input',
      version: 1,
      cityId,
      inputScope,
      generatedAt: new Date().toISOString(),
      format: 'jsonl-per-table',
      exports,
      counts: {
        tables: exports.filter((entry) => !entry.skipped).length,
        rows: exports.reduce((total, entry) => total + Number(entry.rows ?? 0), 0),
      },
    }
    writeJsonFile(path.join(dataDir, 'manifest.json'), dataManifest)
    return {
      relativePath: 'data/manifest.json',
      localPath: path.join(dataDir, 'manifest.json'),
      manifest: dataManifest,
      byteSize: fs.statSync(path.join(dataDir, 'manifest.json')).size,
      checksum: sha256File(path.join(dataDir, 'manifest.json')),
    }
  } finally {
    client.release()
    await pool.end()
  }
}

async function assertCityBoundaryReady(cityId, { allowBoundaryGateBypass = false } = {}) {
  const boundaryGate = await evaluateCityBoundaryQualityGate(cityId)
  if (boundaryGate.passed === true || allowBoundaryGateBypass) {
    return {
      ...boundaryGate,
      bypassed: boundaryGate.passed !== true && allowBoundaryGateBypass,
    }
  }
  throw new Error(`DATA_FACTORY_CITY_BOUNDARY_GATE_BLOCKED:${boundaryGate.code}`)
}

export function packageExistingCityInputDump({
  cityId,
  dumpFile,
  outputDir = '',
  packageName = '',
  submittedBy = 'city-input-packager',
  sourceSummary = {},
  sourceDatabase = {},
  generatedAt = new Date().toISOString(),
} = {}) {
  const normalizedCityId = normalizeKey(cityId, '')
  const resolvedDumpFile = path.resolve(requireText(dumpFile, 'CITY_INPUT_DUMP_FILE_REQUIRED'))
  if (!fs.existsSync(resolvedDumpFile)) throw new Error(`CITY_INPUT_DUMP_FILE_NOT_FOUND:${resolvedDumpFile}`)

  const resolvedOutputDir = path.resolve(outputDir || path.join(process.cwd(), 'exports', 'city-input-packages'))
  const packageKey = normalizeKey(packageName, `${normalizedCityId}-postgis-input-${timestampKey()}`)
  const packageRoot = path.join(resolvedOutputDir, packageKey)
  const tarballPath = path.join(resolvedOutputDir, `${packageKey}.tgz`)
  const dumpRelativePath = 'dump/postgis.dump'
  const dumpDestination = path.join(packageRoot, dumpRelativePath)

  fs.rmSync(packageRoot, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(dumpDestination), { recursive: true })
  fs.copyFileSync(resolvedDumpFile, dumpDestination)

  writeTextFile(path.join(packageRoot, 'bin', 'restore-city-input.sh'), restoreScript(), 0o755)

  const dumpStats = fs.statSync(dumpDestination)
  const manifest = {
    schemaVersion: DATA_FACTORY_CITY_INPUT_PACKAGE_SCHEMA_VERSION,
    packageKind: 'postgis-city-input',
    packageKey,
    cityId: normalizedCityId,
    submittedBy,
    generatedAt,
    sourceDatabase,
    sourceSummary,
    databaseDump: {
      relativePath: dumpRelativePath,
      format: 'postgresql-custom',
      dumpMode: 'workspace-postgis',
      byteSize: dumpStats.size,
      checksum: sha256File(dumpDestination),
      restoreTool: 'pg_restore',
    },
    files: [
      {
        key: 'postgis-dump',
        relativePath: dumpRelativePath,
        byteSize: dumpStats.size,
        checksum: sha256File(dumpDestination),
      },
      {
        key: 'restore-script',
        relativePath: 'bin/restore-city-input.sh',
        byteSize: fs.statSync(path.join(packageRoot, 'bin', 'restore-city-input.sh')).size,
        checksum: sha256File(path.join(packageRoot, 'bin', 'restore-city-input.sh')),
      },
    ],
    restore: {
      cleanTargetRecommended: true,
      requiresPostgisDatabase: true,
      targetDatabaseEnv: 'TWIN_STUDIO_DATABASE_URL',
      command: 'npm run ops:restore-data-factory-city-input -- --package=<package.tgz> --clean',
    },
    boundaries: {
      containsSecrets: false,
      privateOperationalPackage: true,
      excludedSensitiveTableData: SENSITIVE_TABLE_DATA_EXCLUDES,
      cityScopedLogicalIntent: true,
      databaseDumpScope: 'workspace-postgis',
      note: 'This package is the portable PostGIS input for a Data Factory node. Use a clean processing database or explicit --clean restore.',
    },
  }
  writeJsonFile(path.join(packageRoot, 'manifest.json'), manifest)

  const tarball = tarPackage({ packageRoot, tarballPath })
  fs.writeFileSync(`${tarballPath}.sha256`, `${tarball.checksum.replace(/^sha256:/, '')}  ${path.basename(tarballPath)}\n`)

  return {
    ok: true,
    schemaVersion: DATA_FACTORY_CITY_INPUT_PACKAGE_SCHEMA_VERSION,
    packageKind: manifest.packageKind,
    cityId: normalizedCityId,
    packageKey,
    packageRoot,
    manifestPath: path.join(packageRoot, 'manifest.json'),
    manifest,
    tarball,
    checksumFile: `${tarballPath}.sha256`,
  }
}

export async function createCityInputPackage({
  cityId,
  outputDir = '',
  packageName = '',
  databaseUrl = '',
  submittedBy = 'city-input-packager',
  dumpMode = CITY_SCOPED_DUMP_MODE,
  inputScope = DEFAULT_CITY_INPUT_SCOPE,
  allowBoundaryGateBypass = false,
} = {}) {
  const normalizedCityId = normalizeKey(cityId, '')
  const sourceDatabaseUrl = optionalText(databaseUrl) || getProductionDatabaseUrl()
  if (!sourceDatabaseUrl) throw new Error('CITY_INPUT_SOURCE_DATABASE_URL_REQUIRED')
  const normalizedDumpMode = normalizeKey(dumpMode, CITY_SCOPED_DUMP_MODE)
  if (![CITY_SCOPED_DUMP_MODE, LEGACY_WORKSPACE_DUMP_MODE].includes(normalizedDumpMode)) {
    throw new Error(`CITY_INPUT_DUMP_MODE_INVALID:${normalizedDumpMode}`)
  }
  const normalizedInputScope = normalizeInputScope(inputScope)

  const resolvedOutputDir = path.resolve(outputDir || path.join(process.cwd(), 'exports', 'city-input-packages'))
  const packageKey = normalizeKey(packageName, `${normalizedCityId}-postgis-input-${timestampKey()}`)
  const scratchDir = path.join(resolvedOutputDir, `${packageKey}.scratch`)
  const dumpFile = path.join(scratchDir, 'postgis.dump')
  fs.rmSync(scratchDir, { recursive: true, force: true })
  fs.mkdirSync(scratchDir, { recursive: true })

  const boundaryGate = await assertCityBoundaryReady(normalizedCityId, { allowBoundaryGateBypass })
  const sourceSummary = await collectSourceSummary({ databaseUrl: sourceDatabaseUrl, cityId: normalizedCityId })
  if (normalizedDumpMode === CITY_SCOPED_DUMP_MODE) {
    const packageRoot = path.join(resolvedOutputDir, packageKey)
    const tarballPath = path.join(resolvedOutputDir, `${packageKey}.tgz`)
    fs.rmSync(packageRoot, { recursive: true, force: true })
    fs.mkdirSync(packageRoot, { recursive: true })
    writeTextFile(path.join(packageRoot, 'bin', 'restore-city-input.sh'), restoreScript(), 0o755)
    const logicalInput = await createCityScopedLogicalInput({
      databaseUrl: sourceDatabaseUrl,
      cityId: normalizedCityId,
      packageRoot,
      inputScope: normalizedInputScope,
    })
    const restoreScriptPath = path.join(packageRoot, 'bin', 'restore-city-input.sh')
    const generatedAt = new Date().toISOString()
    const manifest = {
      schemaVersion: DATA_FACTORY_CITY_INPUT_PACKAGE_SCHEMA_VERSION,
      packageKind: 'postgis-city-input',
      packageKey,
      cityId: normalizedCityId,
      submittedBy,
      generatedAt,
      sourceDatabase: safeDatabaseDescriptor(sourceDatabaseUrl),
      sourceSummary,
      databaseDump: {
        relativePath: logicalInput.relativePath,
        format: CITY_SCOPED_DUMP_MODE,
        dumpMode: CITY_SCOPED_DUMP_MODE,
        inputScope: normalizedInputScope,
        byteSize: logicalInput.byteSize,
        checksum: logicalInput.checksum,
        restoreTool: 'twin-city-input-jsonl-importer',
      },
      cityScopedLogicalInput: logicalInput.manifest,
      files: [
        {
          key: 'city-scoped-logical-input',
          relativePath: logicalInput.relativePath,
          byteSize: logicalInput.byteSize,
          checksum: logicalInput.checksum,
        },
        {
          key: 'restore-script',
          relativePath: 'bin/restore-city-input.sh',
          byteSize: fs.statSync(restoreScriptPath).size,
          checksum: sha256File(restoreScriptPath),
        },
      ],
      restore: {
        cleanTargetRecommended: true,
        requiresPostgisDatabase: true,
        requiresMigratedSchema: true,
        targetDatabaseEnv: 'TWIN_STUDIO_DATABASE_URL',
        command: 'npm run ops:restore-data-factory-city-input -- --package=<package.tgz> --clean',
      },
      boundaries: {
        containsSecrets: false,
        privateOperationalPackage: true,
        excludedSensitiveTableData: SENSITIVE_TABLE_DATA_EXCLUDES,
        cityScopedLogicalIntent: true,
        databaseDumpScope: CITY_SCOPED_DUMP_MODE,
        inputScope: normalizedInputScope,
        boundaryGate,
        note: 'This package contains only city-scoped logical rows plus small reference tables. The target Data Factory database is migrated before import.',
      },
    }
    writeJsonFile(path.join(packageRoot, 'manifest.json'), manifest)
    const tarball = tarPackage({ packageRoot, tarballPath })
    fs.writeFileSync(`${tarballPath}.sha256`, `${tarball.checksum.replace(/^sha256:/, '')}  ${path.basename(tarballPath)}\n`)
    return {
      ok: true,
      schemaVersion: DATA_FACTORY_CITY_INPUT_PACKAGE_SCHEMA_VERSION,
      packageKind: manifest.packageKind,
      cityId: normalizedCityId,
      packageKey,
      packageRoot,
      manifestPath: path.join(packageRoot, 'manifest.json'),
      manifest,
      tarball,
      checksumFile: `${tarballPath}.sha256`,
    }
  }

  const dumpArgs = [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--file',
    dumpFile,
    ...SENSITIVE_TABLE_DATA_EXCLUDES.flatMap((pattern) => ['--exclude-table-data', pattern]),
    sourceDatabaseUrl,
  ]
  runCommand('pg_dump', dumpArgs, {
    errorCode: 'CITY_INPUT_PG_DUMP_FAILED',
  })

  return packageExistingCityInputDump({
    cityId: normalizedCityId,
    dumpFile,
    outputDir: resolvedOutputDir,
    packageName: packageKey,
    submittedBy,
    sourceSummary,
    sourceDatabase: safeDatabaseDescriptor(sourceDatabaseUrl),
  })
}

export async function createRegisteredCityInputPackage({
  cityId,
  outputDir = '',
  packageName = '',
  databaseUrl = '',
  submittedBy = 'operations-data-factory-ui',
  dumpMode = CITY_SCOPED_DUMP_MODE,
  inputScope = DEFAULT_CITY_INPUT_SCOPE,
  allowBoundaryGateBypass = false,
} = {}) {
  const normalizedCityId = normalizeKey(cityId, '')
  const resolvedOutputDir = path.resolve(
    outputDir || path.join(getRuntimeDir(), 'artifacts', normalizedCityId, 'data-factory', 'city-input-packages'),
  )
  const packageResult = await createCityInputPackage({
    cityId: normalizedCityId,
    outputDir: resolvedOutputDir,
    packageName,
    databaseUrl,
    submittedBy,
    dumpMode,
    inputScope,
    allowBoundaryGateBypass,
  })
  const artifact = artifactFromPackageResult(packageResult)
  const inserted = await withClient(async (client) => {
    const result = await client.query(
      `
        INSERT INTO ldt_ops.workflow_artifacts (
          city_id,
          artifact_kind,
          artifact_uri,
          media_type,
          byte_size,
          checksum,
          metadata
        )
        VALUES ($1, 'data-factory-city-input-package', $2, 'application/gzip', $3, $4, $5::jsonb)
        RETURNING *
      `,
      [
        normalizedCityId,
        artifact.artifactUri,
        artifact.byteSize,
        artifact.checksum,
        JSON.stringify({
          schemaVersion: packageResult.schemaVersion,
          packageKind: packageResult.packageKind,
          packageKey: packageResult.packageKey,
          packageRoot: packageResult.packageRoot,
          manifestPath: packageResult.manifestPath,
          checksumFile: packageResult.checksumFile,
          localPath: packageResult.tarball.localPath,
          relativePath: artifact.relativePath,
          cityId: normalizedCityId,
          submittedBy,
          generatedAt: packageResult.manifest.generatedAt,
          sourceSummary: packageResult.manifest.sourceSummary,
          databaseDump: packageResult.manifest.databaseDump,
          restore: packageResult.manifest.restore,
          boundaries: packageResult.manifest.boundaries,
          dataPlane: {
            inputMode: 'restored-postgis-dump',
            inputScope: packageResult.manifest.databaseDump?.inputScope ?? DEFAULT_CITY_INPUT_SCOPE,
            restoreCommand: packageResult.manifest.restore.command,
          },
        }),
      ],
    )
    return result.rows[0]
  })

  return {
    ...packageResult,
    artifact: artifactFromPackageResult(packageResult, inserted),
  }
}

function assertSafeTarMembers(packageFile) {
  const list = spawnSync('tar', ['-tzf', packageFile], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 80,
  })
  if (list.status !== 0) throw new Error(`CITY_INPUT_PACKAGE_LIST_FAILED:${list.stderr || list.stdout || list.status}`)
  const members = list.stdout
    .split('\n')
    .map((entry) => entry.trim().replace(/^\.\//, ''))
    .filter(Boolean)
  if (!members.includes('manifest.json')) throw new Error('CITY_INPUT_PACKAGE_MANIFEST_MISSING')
  for (const member of members) {
    if (
      member.startsWith('/')
      || member.includes('\0')
      || member.split('/').includes('..')
    ) {
      throw new Error(`CITY_INPUT_PACKAGE_UNSAFE_MEMBER:${member}`)
    }
  }
  return members
}

function extractPackage(packageFile) {
  const resolvedPackage = path.resolve(requireText(packageFile, 'CITY_INPUT_PACKAGE_FILE_REQUIRED'))
  if (!fs.existsSync(resolvedPackage)) throw new Error(`CITY_INPUT_PACKAGE_FILE_NOT_FOUND:${resolvedPackage}`)
  assertSafeTarMembers(resolvedPackage)
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'twin-city-input-'))
  runCommand('tar', ['-xzf', resolvedPackage, '-C', tempDir], {
    errorCode: 'CITY_INPUT_PACKAGE_EXTRACT_FAILED',
  })
  return {
    cleanupDir: tempDir,
    packageRoot: tempDir,
    manifestPath: path.join(tempDir, 'manifest.json'),
  }
}

function resolvePackage({ packageFile = '', manifestFile = '' } = {}) {
  if (manifestFile) {
    const manifestPath = path.resolve(manifestFile)
    return {
      cleanupDir: '',
      packageRoot: path.dirname(manifestPath),
      manifestPath,
    }
  }
  return extractPackage(packageFile)
}

export function validateCityInputPackage({
  packageFile = '',
  manifestFile = '',
  cityId = '',
} = {}) {
  const resolved = resolvePackage({ packageFile, manifestFile })
  try {
    if (!fs.existsSync(resolved.manifestPath)) throw new Error('CITY_INPUT_PACKAGE_MANIFEST_NOT_FOUND')
    const manifest = JSON.parse(fs.readFileSync(resolved.manifestPath, 'utf8'))
    if (manifest.schemaVersion !== DATA_FACTORY_CITY_INPUT_PACKAGE_SCHEMA_VERSION) throw new Error('CITY_INPUT_PACKAGE_SCHEMA_INVALID')
    const expectedCityId = optionalText(cityId)
    if (expectedCityId && manifest.cityId !== expectedCityId) throw new Error(`CITY_INPUT_PACKAGE_CITY_MISMATCH:${manifest.cityId}:${expectedCityId}`)

    const dumpRelativePath = requireText(manifest.databaseDump?.relativePath, 'CITY_INPUT_PACKAGE_DUMP_PATH_REQUIRED')
    const dumpPath = path.join(resolved.packageRoot, dumpRelativePath)
    if (!fs.existsSync(dumpPath)) throw new Error(`CITY_INPUT_PACKAGE_DUMP_NOT_FOUND:${dumpRelativePath}`)
    const byteSize = fs.statSync(dumpPath).size
    if (byteSize !== Number(manifest.databaseDump.byteSize ?? -1)) throw new Error('CITY_INPUT_PACKAGE_DUMP_BYTE_SIZE_MISMATCH')
    const checksum = sha256File(dumpPath)
    if (checksum !== manifest.databaseDump.checksum) throw new Error('CITY_INPUT_PACKAGE_DUMP_CHECKSUM_MISMATCH')

    return {
      ok: true,
      packageRoot: resolved.packageRoot,
      manifestPath: resolved.manifestPath,
      cleanupDir: resolved.cleanupDir,
      manifest,
      dumpPath,
      dump: {
        byteSize,
        checksum,
      },
    }
  } catch (error) {
    if (resolved.cleanupDir) fs.rmSync(resolved.cleanupDir, { recursive: true, force: true })
    throw error
  }
}

async function assertTargetRestorePolicy({ databaseUrl, clean, allowNonEmpty }) {
  if (clean || allowNonEmpty) return { checked: true, nonSystemTableCount: null }
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: Number(process.env.TWIN_STUDIO_DATABASE_CONNECT_TIMEOUT_MS ?? 10000),
  })
  try {
    const result = await pool.query(`
      SELECT count(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_type = 'BASE TABLE'
    `)
    const nonSystemTableCount = Number(result.rows[0]?.count ?? 0)
    if (nonSystemTableCount > 0) throw new Error(`CITY_INPUT_RESTORE_TARGET_NOT_EMPTY:${nonSystemTableCount}`)
    return { checked: true, nonSystemTableCount }
  } finally {
    await pool.end()
  }
}

async function verifyRestoredCity({ databaseUrl, cityId }) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: Number(process.env.TWIN_STUDIO_DATABASE_CONNECT_TIMEOUT_MS ?? 10000),
  })
  try {
    const city = await pool.query('SELECT id, name, country FROM ldt_core.cities WHERE id = $1', [cityId])
    if (city.rowCount === 0) throw new Error(`CITY_INPUT_RESTORE_CITY_NOT_FOUND:${cityId}`)
    const entities = await pool.query('SELECT count(*)::int AS count FROM ldt_core.city_entities WHERE city_id = $1', [cityId])
    return {
      city: city.rows[0],
      entityCount: Number(entities.rows[0]?.count ?? 0),
    }
  } finally {
    await pool.end()
  }
}

function cityScopedExportSpecsFromManifest(manifest = {}) {
  const exportedTables = new Set((manifest.cityScopedLogicalInput?.exports ?? [])
    .filter((entry) => !entry.skipped)
    .map((entry) => entry.table))
  return [...REFERENCE_TABLE_EXPORTS, ...CITY_SCOPED_TABLE_EXPORTS]
    .filter((entry) => exportedTables.has(entry.table))
}

async function cleanCityScopedRows(client, manifest) {
  const cityId = manifest.cityId
  const specs = cityScopedExportSpecsFromManifest(manifest)
    .filter((entry) => entry.deleteSql)
    .reverse()
  for (const spec of specs) {
    if (await tableExists(client, spec.table)) {
      await client.query(spec.deleteSql, [cityId])
    }
  }
}

async function importJsonlTable(client, { table, filePath }) {
  if (!await tableExists(client, table)) {
    return { table, skipped: true, reason: 'table-not-found', rows: 0 }
  }
  if (!fs.existsSync(filePath)) throw new Error(`CITY_INPUT_LOGICAL_TABLE_FILE_NOT_FOUND:${table}`)
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  let rows = 0
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    rows += 1
    try {
      await client.query(
        `INSERT INTO ${table} SELECT * FROM json_populate_record(NULL::${table}, $1::json) ON CONFLICT DO NOTHING`,
        [trimmed],
      )
    } catch (error) {
      throw new Error(`CITY_INPUT_LOGICAL_IMPORT_FAILED:${table}:row-${rows}:${String(error?.message ?? error)}:${trimmed.slice(0, 800)}`)
    }
  }
  return { table, skipped: false, rows }
}

async function restoreCityScopedLogicalInput({ targetUrl, validated, clean }) {
  const migration = await runProductionMigrationsForDatabaseUrl(targetUrl)
  if (!migration.ok) throw new Error(`CITY_INPUT_TARGET_MIGRATION_FAILED:${migration.error ?? 'unknown'}`)
  const pool = new Pool({
    connectionString: targetUrl,
    max: 2,
    connectionTimeoutMillis: Number(process.env.TWIN_STUDIO_DATABASE_CONNECT_TIMEOUT_MS ?? 10000),
  })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (clean) await cleanCityScopedRows(client, validated.manifest)
    const imports = []
    for (const entry of validated.manifest.cityScopedLogicalInput?.exports ?? []) {
      if (entry.skipped || !entry.relativePath) {
        imports.push({ table: entry.table, skipped: true, reason: entry.reason ?? 'not-exported', rows: 0 })
        continue
      }
      imports.push(await importJsonlTable(client, {
        table: entry.table,
        filePath: path.join(validated.packageRoot, entry.relativePath),
      }))
    }
    await client.query('COMMIT')
    return {
      migration,
      imports,
      rowCount: imports.reduce((total, entry) => total + Number(entry.rows ?? 0), 0),
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

export async function restoreCityInputPackage({
  packageFile = '',
  manifestFile = '',
  targetDatabaseUrl = '',
  cityId = '',
  clean = false,
  allowNonEmpty = false,
  validateOnly = false,
  submittedBy = 'city-input-restorer',
} = {}) {
  const targetUrl = optionalText(targetDatabaseUrl) || getProductionDatabaseUrl()
  if (!targetUrl && !validateOnly) throw new Error('CITY_INPUT_TARGET_DATABASE_URL_REQUIRED')
  const validated = validateCityInputPackage({ packageFile, manifestFile, cityId })
  try {
    if (validateOnly) {
      return {
        ok: true,
        validateOnly: true,
        cityId: validated.manifest.cityId,
        manifest: validated.manifest,
        dump: validated.dump,
      }
    }

    await assertTargetRestorePolicy({ databaseUrl: targetUrl, clean, allowNonEmpty })
    const dumpFormat = validated.manifest.databaseDump?.format
    const logicalRestore = dumpFormat === CITY_SCOPED_DUMP_MODE
      ? await restoreCityScopedLogicalInput({ targetUrl, validated, clean })
      : null
    if (!logicalRestore) {
      const args = [
        '--exit-on-error',
        '--no-owner',
        '--no-privileges',
        '--dbname',
        targetUrl,
      ]
      if (clean) args.splice(1, 0, '--clean', '--if-exists')
      args.push(validated.dumpPath)
      runCommand('pg_restore', args, {
        errorCode: 'CITY_INPUT_PG_RESTORE_FAILED',
      })
    }
    const restored = await verifyRestoredCity({
      databaseUrl: targetUrl,
      cityId: validated.manifest.cityId,
    })
    return {
      ok: true,
      validateOnly: false,
      cityId: validated.manifest.cityId,
      submittedBy,
      restoredAt: new Date().toISOString(),
      clean,
      allowNonEmpty,
      sourcePackage: {
        schemaVersion: validated.manifest.schemaVersion,
        packageKey: validated.manifest.packageKey,
        dumpFormat,
        dumpChecksum: validated.dump.checksum,
        dumpByteSize: validated.dump.byteSize,
      },
      targetDatabase: safeDatabaseDescriptor(targetUrl),
      logicalRestore,
      restored,
    }
  } finally {
    if (validated.cleanupDir) fs.rmSync(validated.cleanupDir, { recursive: true, force: true })
  }
}
