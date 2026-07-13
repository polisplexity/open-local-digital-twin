import { restoreCityInputPackage } from '../services/ldtOps/cityInputPackageService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function booleanArg(name) {
  return process.argv.includes(`--${name}`) || process.argv.includes(`--${name}=true`)
}

function usage() {
  return [
    'Usage:',
    '  npm run ops:restore-data-factory-city-input -- --package=/path/to/city-input.tgz --clean',
    '',
    'Options:',
    '  --package=<file>                  City input package tarball.',
    '  --manifest=<file>                 Extracted manifest.json alternative.',
    '  --target-database-url=<url>       Target PostGIS URL. Defaults to TWIN_STUDIO_DATABASE_URL.',
    '  --city=<city-id>                  Optional expected city id guard.',
    '  --clean                           Run pg_restore with --clean --if-exists.',
    '  --allow-non-empty                 Allow restore into a non-empty target without --clean.',
    '  --validate-only                   Validate manifest/checksum without touching PostGIS.',
    '  --submitted-by=<label>            Audit label.',
  ].join('\n')
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(usage())
  process.exit(0)
}

try {
  const result = await restoreCityInputPackage({
    packageFile: argValue('package') || argValue('package-file') || argValue('packageFile'),
    manifestFile: argValue('manifest') || argValue('manifest-file') || argValue('manifestFile'),
    targetDatabaseUrl: argValue('target-database-url') || argValue('targetDatabaseUrl') || argValue('database-url') || argValue('databaseUrl'),
    cityId: argValue('city') || argValue('city-id') || argValue('cityId'),
    clean: booleanArg('clean'),
    allowNonEmpty: booleanArg('allow-non-empty') || booleanArg('allowNonEmpty'),
    validateOnly: booleanArg('validate-only') || booleanArg('validateOnly'),
    submittedBy: argValue('submitted-by') || argValue('submittedBy') || 'city-input-restore-cli',
  })
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message ?? 'CITY_INPUT_RESTORE_FAILED'),
  }, null, 2))
  process.exit(1)
}
