import { createCityInputPackage } from '../services/ldtOps/cityInputPackageService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function usage() {
  return [
    'Usage:',
    '  npm run ops:package-data-factory-city-input -- --city=<city-id> --out=exports/city-input-packages',
    '',
    'Options:',
    '  --city=<city-id>                  Required city id.',
    '  --out=<directory>                 Output directory.',
    '  --package-name=<name>             Package key/name.',
    '  --database-url=<url>              Source PostGIS URL. Defaults to TWIN_STUDIO_DATABASE_URL.',
    '  --dump-mode=<mode>                Default: city-scoped-jsonl. Legacy: workspace-postgis.',
    '  --input-scope=<scope>             Default: viewer-runtime. Options: viewer-runtime, semantic, provenance, environmental, full-city.',
    '  --allow-boundary-gate-bypass      Operator/smoke bypass for boundary gate.',
    '  --submitted-by=<label>            Audit label.',
  ].join('\n')
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(usage())
  process.exit(0)
}

try {
  const result = await createCityInputPackage({
    cityId: argValue('city') || argValue('city-id') || argValue('cityId'),
    outputDir: argValue('out') || argValue('output'),
    packageName: argValue('package-name') || argValue('packageName'),
    databaseUrl: argValue('database-url') || argValue('databaseUrl'),
    dumpMode: argValue('dump-mode') || argValue('dumpMode') || 'city-scoped-jsonl',
    inputScope: argValue('input-scope') || argValue('inputScope') || 'viewer-runtime',
    allowBoundaryGateBypass: process.argv.includes('--allow-boundary-gate-bypass') || process.argv.includes('--allowBoundaryGateBypass'),
    submittedBy: argValue('submitted-by') || argValue('submittedBy') || 'city-input-package-cli',
  })
  console.log(JSON.stringify({
    ok: result.ok,
    schemaVersion: result.schemaVersion,
    packageKind: result.packageKind,
    cityId: result.cityId,
    packageKey: result.packageKey,
    packageRoot: result.packageRoot,
    manifestPath: result.manifestPath,
    tarball: result.tarball,
    checksumFile: result.checksumFile,
    databaseDump: result.manifest.databaseDump,
    inputScope: result.manifest.databaseDump?.inputScope ?? null,
    sourceSummary: result.manifest.sourceSummary,
  }, null, 2))
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message ?? 'CITY_INPUT_PACKAGE_FAILED'),
  }, null, 2))
  process.exit(1)
}
