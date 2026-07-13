import fs from 'node:fs'

import { closeProductionPool } from '../db/postgisPool.mjs'
import { stageDataFactoryArtifactManifest } from '../services/ldtOps/artifactTransferService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function booleanArg(name, fallback = false) {
  if (process.argv.includes(`--${name}`)) return true
  const value = argValue(name)
  if (!value) return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function usage() {
  return [
    'Usage:',
    '  node server/tools/stage-data-factory-artifacts.mjs --dispatch-id=<uuid> --file=/path/to/result-or-artifacts.json',
    '',
    'The file may be either a full offline Data Factory result package or an array',
    'of artifact references. Large payload bytes are not accepted in JSON.',
  ].join('\n')
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(usage())
    return
  }
  const dispatchId = argValue('dispatch-id') || argValue('dispatch')
  const file = argValue('file')
  if (!dispatchId || !file) throw new Error('DATA_FACTORY_ARTIFACT_STAGE_ARGS_REQUIRED')
  const payload = readJsonFile(file)
  const result = await stageDataFactoryArtifactManifest({
    dispatchId,
    resultPackage: Array.isArray(payload) ? {} : payload,
    artifacts: Array.isArray(payload) ? payload : null,
    copyLocal: booleanArg('copy-local', true),
    submittedBy: argValue('submitted-by') || 'stage-data-factory-artifacts-cli',
  })
  console.log(JSON.stringify(result, null, 2))
  if (!result.ok) process.exitCode = 1
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: String(error?.message ?? 'DATA_FACTORY_ARTIFACT_STAGE_FAILED'),
    }, null, 2))
    process.exitCode = 1
  }).finally(async () => {
    await closeProductionPool()
  })
}
