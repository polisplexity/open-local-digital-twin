import { pathToFileURL } from 'node:url'

import { closeProductionPool } from '../db/postgisPool.mjs'
import { productionDatabaseConfigured, runProductionMigrations } from '../db/migrate.mjs'
import { ensureSameServerSidecarProvider } from '../services/ldtOps/sameServerSidecarProviderService.mjs'

function argValues(name, argv = process.argv.slice(2)) {
  const prefix = `--${name}=`
  return argv
    .filter((entry) => entry.startsWith(prefix))
    .map((entry) => entry.slice(prefix.length))
    .filter(Boolean)
}

function argValue(name, argv = process.argv.slice(2)) {
  return argValues(name, argv)[0] ?? ''
}

function booleanArg(name, argv = process.argv.slice(2)) {
  return argv.includes(`--${name}`) || argv.includes(`--${name}=true`)
}

function cliUsage() {
  return [
    'Usage:',
    '  npm run ops:ensure-same-server-sidecar -- [options]',
    '',
    'Options:',
    '  --node-key=<key>             Stable same-server processing node key.',
    '  --city=<city-id>             City id for command hints. Default: guanajuato.',
    '  --out=<directory>            Output directory for sidecar plan and command file.',
    '  --image-ref=<image>          Data Factory image ref. Default: twin-base-studio-datafactory:local.',
    '  --runtime-version=<version>  Runtime version label.',
    '  --stage=<stage-key>          Repeat or comma-separate stage bindings.',
    '  --skip-doctor                Register/refresh node without running runtime doctor.',
    '  --no-require-db              Run doctor without requiring DB connectivity.',
  ].join('\n')
}

function inputFromCli(argv = process.argv.slice(2)) {
  return {
    nodeKey: argValue('node-key', argv) || argValue('nodeKey', argv),
    displayName: argValue('display-name', argv) || argValue('displayName', argv),
    cityId: argValue('city', argv) || argValue('city-id', argv) || argValue('cityId', argv),
    outputDir: argValue('out', argv) || argValue('output', argv) || argValue('output-dir', argv),
    imageRef: argValue('image-ref', argv) || argValue('imageRef', argv),
    runtimeVersion: argValue('runtime-version', argv) || argValue('runtimeVersion', argv),
    projectName: argValue('project-name', argv) || argValue('projectName', argv),
    artifactRoot: argValue('artifact-root', argv) || argValue('artifactRoot', argv),
    stageBindings: [
      ...argValues('stage', argv),
      ...argValues('stage-key', argv),
      ...argValues('stageKey', argv),
    ],
    runDoctor: !booleanArg('skip-doctor', argv),
    requireDb: !booleanArg('no-require-db', argv),
    registeredBy: argValue('registered-by', argv) || argValue('registeredBy', argv) || 'same-server-sidecar-cli',
  }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(cliUsage())
    return
  }

  if (!productionDatabaseConfigured()) {
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      reason: 'DATABASE_URL_NOT_CONFIGURED',
      providerType: 'same-server-sidecar',
    }, null, 2))
    return
  }

  try {
    await runProductionMigrations()
    const result = await ensureSameServerSidecarProvider(inputFromCli(argv))
    console.log(JSON.stringify(result, null, 2))
    process.exit(result.ok ? 0 : 1)
  } finally {
    await closeProductionPool()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: String(error?.message ?? 'SAME_SERVER_SIDECAR_CLI_FAILED'),
    }, null, 2))
    process.exit(1)
  })
}
