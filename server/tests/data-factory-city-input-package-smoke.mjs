import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  DATA_FACTORY_CITY_INPUT_PACKAGE_SCHEMA_VERSION,
  packageExistingCityInputDump,
  restoreCityInputPackage,
  validateCityInputPackage,
} from '../services/ldtOps/cityInputPackageService.mjs'

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
assert.equal(
  packageJson.scripts['ops:package-data-factory-city-input'],
  'node server/tools/package-data-factory-city-input.mjs',
  'CITY_INPUT_PACKAGE_SCRIPT_MISSING',
)
assert.equal(
  packageJson.scripts['ops:restore-data-factory-city-input'],
  'node server/tools/restore-data-factory-city-input.mjs',
  'CITY_INPUT_RESTORE_SCRIPT_MISSING',
)
assert.equal(
  packageJson.scripts['test:data-factory-city-input-package-smoke'],
  'node server/tests/data-factory-city-input-package-smoke.mjs',
  'CITY_INPUT_PACKAGE_SMOKE_SCRIPT_MISSING',
)

const doctorSource = fs.readFileSync('server/tools/data-factory-runtime-doctor.mjs', 'utf8')
assert.match(doctorSource, /pg_dump/, 'CITY_INPUT_DOCTOR_PG_DUMP_MISSING')
assert.match(doctorSource, /pg_restore/, 'CITY_INPUT_DOCTOR_PG_RESTORE_MISSING')

const serviceIndexSource = fs.readFileSync('server/services/ldtOpsService.mjs', 'utf8')
assert.ok(serviceIndexSource.includes('createRegisteredCityInputPackage'), 'CITY_INPUT_REGISTERED_SERVICE_EXPORT_MISSING')

const routesSource = fs.readFileSync('server/routes/adminWorkflowRoutes.mjs', 'utf8')
assert.ok(
  routesSource.includes('/api/admin/cities/:cityId/data-factory/city-input-packages'),
  'CITY_INPUT_PACKAGE_ADMIN_ROUTE_MISSING',
)
assert.ok(routesSource.includes('createRegisteredCityInputPackage'), 'CITY_INPUT_PACKAGE_ADMIN_ROUTE_HANDLER_MISSING')

const reportSource = fs.readFileSync('server/services/ldtOps/operationsReportService.mjs', 'utf8')
assert.ok(reportSource.includes('data-factory-city-input-package'), 'CITY_INPUT_PACKAGE_OPERATIONS_REPORT_MISSING')
assert.ok(reportSource.includes('cityInputPackages'), 'CITY_INPUT_PACKAGE_REPORT_FIELD_MISSING')

const uiSource = fs.readFileSync('src/components/twin-module/workspace/panels/OperationsDataFactoryControlPanel.jsx', 'utf8')
assert.ok(uiSource.includes('Prepare city input package'), 'CITY_INPUT_PACKAGE_UI_ACTION_MISSING')
assert.ok(uiSource.includes('City input packages'), 'CITY_INPUT_PACKAGE_UI_TABLE_MISSING')

const workerSource = fs.readFileSync('server/tools/server-to-server-pull-worker.mjs', 'utf8')
for (const expected of [
  'restore-city-input',
  'city-input-package',
  'city-input-clean',
  'restoreCityInputPackage',
]) {
  assert.ok(workerSource.includes(expected), `PULL_WORKER_CITY_INPUT_OPTION_MISSING:${expected}`)
}

const packageCliSource = fs.readFileSync('server/tools/package-data-factory-city-input.mjs', 'utf8')
assert.ok(packageCliSource.includes('input-scope'), 'CITY_INPUT_PACKAGE_CLI_INPUT_SCOPE_MISSING')
assert.ok(packageCliSource.includes('city-scoped-jsonl'), 'CITY_INPUT_PACKAGE_CLI_CITY_SCOPED_DEFAULT_MISSING')

const packageServiceSource = fs.readFileSync('server/services/ldtOps/cityInputPackageService.mjs', 'utf8')
for (const expected of [
  'DEFAULT_CITY_INPUT_SCOPE',
  'viewer-runtime',
  'workspace-postgis',
  'primaryKeyOrderClause',
  'ORDER BY ${orderBy}',
  'DATA_FACTORY_CITY_BOUNDARY_GATE_BLOCKED',
  'CITY_INPUT_LOGICAL_IMPORT_FAILED',
]) {
  assert.ok(packageServiceSource.includes(expected), `CITY_INPUT_PACKAGE_SERVICE_CONTRACT_MISSING:${expected}`)
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tbs-city-input-smoke-'))
const dumpFile = path.join(root, 'postgis.dump')
fs.writeFileSync(dumpFile, 'fake-postgis-custom-dump-for-contract-smoke')

const packaged = packageExistingCityInputDump({
  cityId: 'guanajuato',
  dumpFile,
  outputDir: path.join(root, 'out'),
  packageName: 'guanajuato-input-smoke',
  submittedBy: 'data-factory-city-input-package-smoke',
  sourceSummary: {
    city: { id: 'guanajuato', name: 'Guanajuato' },
    counts: {
      entityTypes: { building: 1 },
      sourceLayers: { smoke: 1 },
    },
  },
  sourceDatabase: {
    protocol: 'postgresql',
    host: 'source.example.invalid',
    database: 'twin_base_studio',
  },
})

assert.equal(packaged.ok, true, 'CITY_INPUT_PACKAGE_NOT_OK')
assert.equal(packaged.schemaVersion, DATA_FACTORY_CITY_INPUT_PACKAGE_SCHEMA_VERSION, 'CITY_INPUT_PACKAGE_SCHEMA_INVALID')
assert.equal(packaged.packageKind, 'postgis-city-input', 'CITY_INPUT_PACKAGE_KIND_INVALID')
assert.ok(fs.existsSync(packaged.tarball.localPath), 'CITY_INPUT_TARBALL_MISSING')
assert.ok(packaged.tarball.checksum.startsWith('sha256:'), 'CITY_INPUT_TARBALL_CHECKSUM_MISSING')
assert.ok(fs.existsSync(packaged.checksumFile), 'CITY_INPUT_TARBALL_CHECKSUM_FILE_MISSING')
assert.equal(packaged.manifest.databaseDump.format, 'postgresql-custom', 'CITY_INPUT_DUMP_FORMAT_INVALID')
assert.equal(packaged.manifest.boundaries.containsSecrets, false, 'CITY_INPUT_SECRETS_BOUNDARY_INVALID')

const validated = validateCityInputPackage({
  packageFile: packaged.tarball.localPath,
  cityId: 'guanajuato',
})
assert.equal(validated.ok, true, 'CITY_INPUT_VALIDATE_NOT_OK')
assert.equal(validated.manifest.cityId, 'guanajuato', 'CITY_INPUT_VALIDATE_CITY_INVALID')
assert.equal(validated.dump.byteSize, fs.statSync(dumpFile).size, 'CITY_INPUT_VALIDATE_DUMP_SIZE_INVALID')
if (validated.cleanupDir) fs.rmSync(validated.cleanupDir, { recursive: true, force: true })

const validateOnly = await restoreCityInputPackage({
  packageFile: packaged.tarball.localPath,
  cityId: 'guanajuato',
  validateOnly: true,
})
assert.equal(validateOnly.ok, true, 'CITY_INPUT_RESTORE_VALIDATE_ONLY_NOT_OK')
assert.equal(validateOnly.validateOnly, true, 'CITY_INPUT_RESTORE_VALIDATE_ONLY_FLAG_MISSING')
assert.equal(validateOnly.dump.checksum, packaged.manifest.databaseDump.checksum, 'CITY_INPUT_RESTORE_VALIDATE_CHECKSUM_MISMATCH')

console.log(JSON.stringify({
  ok: true,
  contract: DATA_FACTORY_CITY_INPUT_PACKAGE_SCHEMA_VERSION,
  tarball: packaged.tarball.localPath,
  checksum: packaged.tarball.checksum,
  cityId: packaged.cityId,
}, null, 2))
