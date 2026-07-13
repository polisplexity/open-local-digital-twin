import { createCloudBatchProviderPackage } from '../services/ldtOps/dataFactoryProviderPackageService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function usage() {
  return [
    'Usage:',
    '  npm run ops:generate-data-factory-cloud-batch -- --dispatch=/path/to/dispatch-external-worker.json --provider=generic-cloud --storage-uri=s3://bucket/prefix',
    '',
    'Options:',
    '  --dispatch=<file>             Required dispatch-external-worker.json.',
    '  --provider=<name>             Generic provider key. Default: generic-cloud.',
    '  --image-ref=<ref>             Runtime image reference.',
    '  --storage-uri=<uri>           Object storage prefix for dispatch/result/artifacts.',
    '  --logs-uri=<uri>              Optional log prefix.',
    '  --result-callback-url=<url>   Optional callback URL handled by a provider adapter.',
    '  --out=<directory>             Output directory.',
  ].join('\n')
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(usage())
  process.exit(0)
}

try {
  const result = createCloudBatchProviderPackage({
    dispatchFile: argValue('dispatch') || argValue('dispatch-file'),
    outputDir: argValue('out') || argValue('output'),
    provider: argValue('provider') || 'generic-cloud',
    imageRef: argValue('image-ref') || argValue('imageRef'),
    storageUri: argValue('storage-uri') || argValue('storageUri'),
    logsUri: argValue('logs-uri') || argValue('logsUri'),
    resultCallbackUrl: argValue('result-callback-url') || argValue('resultCallbackUrl'),
    submittedBy: argValue('submitted-by') || argValue('submittedBy') || 'cloud-batch-cli',
  })
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message ?? 'CLOUD_BATCH_PACKAGE_FAILED'),
  }, null, 2))
  process.exit(1)
}
