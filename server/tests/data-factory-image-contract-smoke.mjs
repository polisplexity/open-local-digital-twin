import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const dockerfile = await readFile('Dockerfile.datafactory', 'utf8')
const compose = await readFile('compose.datafactory.yml', 'utf8')
const doctor = await readFile('server/tools/data-factory-runtime-doctor.mjs', 'utf8')
const runScript = await readFile('ops/datafactory/run-city-export.sh', 'utf8')
const bundleScript = await readFile('ops/datafactory/create-bundle.sh', 'utf8')
const imageTarballScript = await readFile('ops/datafactory/create-image-tarball.sh', 'utf8')
const packageJson = JSON.parse(await readFile('package.json', 'utf8'))

assert.match(dockerfile, /FROM node:22-bookworm-slim/, 'DATAFACTORY_NODE_IMAGE_MISSING')
assert.match(dockerfile, /gdal-bin/, 'DATAFACTORY_GDAL_MISSING')
assert.match(dockerfile, /postgresql-client/, 'DATAFACTORY_PSQL_CLIENT_MISSING')
assert.match(dockerfile, /postgresql-client-16/, 'DATAFACTORY_PG16_CLIENT_MISSING')
assert.match(dockerfile, /overturemaps==1\.0\.0/, 'DATAFACTORY_OVERTURE_PYTHON_MISSING')
assert.match(dockerfile, /protomaps\/go-pmtiles/, 'DATAFACTORY_PMTILES_INSTALL_MISSING')
assert.doesNotMatch(dockerfile, /npm run build/, 'DATAFACTORY_MUST_NOT_BUILD_NEXT_UI')
assert.doesNotMatch(dockerfile, /COPY src /, 'DATAFACTORY_MUST_NOT_COPY_FRONTEND_SOURCE')
assert.match(compose, /profiles:\n\s+- runner/, 'DATAFACTORY_RUNNER_PROFILE_MISSING')
assert.match(compose, /TWIN_STUDIO_DATABASE_URL/, 'DATAFACTORY_DATABASE_URL_MISSING')
assert.match(compose, /Dockerfile\.datafactory/, 'DATAFACTORY_COMPOSE_DOCKERFILE_MISSING')
assert.match(doctor, /PMTILES_BIN/, 'DATAFACTORY_DOCTOR_PMTILES_CHECK_MISSING')
assert.match(doctor, /overturemaps/, 'DATAFACTORY_DOCTOR_OVERTURE_CHECK_MISSING')
assert.match(doctor, /postgis_full_version/, 'DATAFACTORY_DOCTOR_POSTGIS_CHECK_MISSING')
assert.match(doctor, /pg_dump/, 'DATAFACTORY_DOCTOR_PG_DUMP_CHECK_MISSING')
assert.match(doctor, /pg_restore/, 'DATAFACTORY_DOCTOR_PG_RESTORE_CHECK_MISSING')
assert.match(runScript, /ops:datafactory:doctor/, 'DATAFACTORY_RUN_SCRIPT_DOCTOR_MISSING')
assert.match(runScript, /build-city-3d-tiles-partitioned/, 'DATAFACTORY_RUN_SCRIPT_3D_TILES_MISSING')
assert.match(runScript, /export-city-mvt-package/, 'DATAFACTORY_RUN_SCRIPT_MVT_MISSING')
assert.match(runScript, /ops:pack-pmtiles/, 'DATAFACTORY_RUN_SCRIPT_PMTILES_MISSING')
assert.match(runScript, /ops:package-data-factory-city-input/, 'DATAFACTORY_RUN_SCRIPT_CITY_INPUT_PACKAGE_MISSING')
assert.match(bundleScript, /Dockerfile\.datafactory/, 'DATAFACTORY_BUNDLE_DOCKERFILE_MISSING')
assert.match(bundleScript, /compose\.datafactory\.yml/, 'DATAFACTORY_BUNDLE_COMPOSE_MISSING')
assert.match(bundleScript, /\.env\.datafactory\.example/, 'DATAFACTORY_BUNDLE_ENV_EXAMPLE_MISSING')
assert.match(bundleScript, /--exclude='runtime-data'/, 'DATAFACTORY_BUNDLE_RUNTIME_DATA_EXCLUSION_MISSING')
assert.match(bundleScript, /--exclude='node_modules'/, 'DATAFACTORY_BUNDLE_NODE_MODULES_EXCLUSION_MISSING')
assert.match(imageTarballScript, /docker build/, 'DATAFACTORY_IMAGE_TARBALL_BUILD_MISSING')
assert.match(imageTarballScript, /docker save/, 'DATAFACTORY_IMAGE_TARBALL_SAVE_MISSING')
assert.match(imageTarballScript, /sha256sum/, 'DATAFACTORY_IMAGE_TARBALL_CHECKSUM_MISSING')
assert.equal(packageJson.scripts['ops:datafactory:doctor'], 'node server/tools/data-factory-runtime-doctor.mjs')
assert.equal(packageJson.scripts['ops:package-data-factory-city-input'], 'node server/tools/package-data-factory-city-input.mjs')
assert.equal(packageJson.scripts['ops:restore-data-factory-city-input'], 'node server/tools/restore-data-factory-city-input.mjs')
assert.equal(packageJson.scripts['test:data-factory-image-contract-smoke'], 'node server/tests/data-factory-image-contract-smoke.mjs')

console.log(JSON.stringify({
  ok: true,
  contract: 'twin-base-studio-datafactory-image.v1',
  files: [
    'Dockerfile.datafactory',
    'compose.datafactory.yml',
    'server/tools/data-factory-runtime-doctor.mjs',
    'ops/datafactory/run-city-export.sh',
    'ops/datafactory/create-bundle.sh',
    'ops/datafactory/create-image-tarball.sh',
  ],
}, null, 2))
