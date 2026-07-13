import { createHpcBatchProviderPackage } from '../services/ldtOps/dataFactoryProviderPackageService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function usage() {
  return [
    'Usage:',
    '  npm run ops:generate-data-factory-hpc-batch -- --dispatch=/path/to/dispatch-external-worker.json --scheduler=slurm --out=/tmp/hpc-plan',
    '',
    'Options:',
    '  --dispatch=<file>       Required dispatch-external-worker.json.',
    '  --scheduler=slurm|pbs   Scheduler script type. Default: slurm.',
    '  --image-ref=<ref>       Apptainer/Singularity image ref. Default: ${DATAFACTORY_IMAGE:-datafactory.sif}.',
    '  --job-name=<name>       Job/package name.',
    '  --cpus=<n>              CPU request. Default: 4.',
    '  --memory=<size>         Memory request. Default: 16G.',
    '  --time=<hh:mm:ss>       Wall time. Default: 02:00:00.',
    '  --partition=<name>      Optional Slurm partition.',
    '  --account=<name>        Optional Slurm account.',
    '  --queue=<name>          Optional PBS queue.',
    '  --out=<directory>       Output directory.',
  ].join('\n')
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(usage())
  process.exit(0)
}

try {
  const result = createHpcBatchProviderPackage({
    dispatchFile: argValue('dispatch') || argValue('dispatch-file'),
    outputDir: argValue('out') || argValue('output'),
    scheduler: argValue('scheduler') || 'slurm',
    imageRef: argValue('image-ref') || argValue('imageRef') || '${DATAFACTORY_IMAGE:-datafactory.sif}',
    jobName: argValue('job-name') || argValue('jobName'),
    submittedBy: argValue('submitted-by') || argValue('submittedBy') || 'hpc-batch-cli',
    schedulerOptions: {
      cpus: argValue('cpus'),
      memory: argValue('memory'),
      time: argValue('time'),
      partition: argValue('partition'),
      account: argValue('account'),
      queue: argValue('queue'),
    },
  })
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message ?? 'HPC_BATCH_PACKAGE_FAILED'),
  }, null, 2))
  process.exit(1)
}
