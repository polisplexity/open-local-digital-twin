import { createOfflineDataFactoryBundlePackage } from '../services/ldtOps/dataFactoryProviderPackageService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function usage() {
  return [
    'Usage:',
    '  npm run ops:package-offline-data-factory-bundle -- --dispatch=/path/to/dispatch-external-worker.json --out=/tmp/offline-bundle',
    '',
    'Options:',
    '  --dispatch=<file>                 Required dispatch-external-worker.json.',
    '  --result-template=<file>          Optional result template to include.',
    '  --artifact-manifest=<file>        Optional artifact manifest to include.',
    '  --out=<directory>                 Output directory.',
    '  --package-name=<name>             Package key/name.',
    '  --submitted-by=<name>             Audit label.',
  ].join('\n')
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(usage())
  process.exit(0)
}

try {
  const result = createOfflineDataFactoryBundlePackage({
    dispatchFile: argValue('dispatch') || argValue('dispatch-file'),
    resultTemplateFile: argValue('result-template') || argValue('resultTemplate'),
    artifactManifestFile: argValue('artifact-manifest') || argValue('artifactManifest'),
    outputDir: argValue('out') || argValue('output'),
    packageName: argValue('package-name') || argValue('packageName'),
    submittedBy: argValue('submitted-by') || argValue('submittedBy') || 'offline-bundle-cli',
  })
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message ?? 'OFFLINE_BUNDLE_PACKAGE_FAILED'),
  }, null, 2))
  process.exit(1)
}
