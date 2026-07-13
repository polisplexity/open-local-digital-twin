#!/usr/bin/env node

import { spawn } from 'node:child_process'

function printUsage() {
  console.error(`Usage:
  node server/tools/run-processing-mode.mjs --mode=normal -- <command> [args...]
  node server/tools/run-processing-mode.mjs --mode=mpi --workers=4 -- <command> [args...]

Examples:
  npm run ops:run -- --mode=normal -- node server/tools/example.js
  npm run ops:run -- --mode=mpi --workers=4 -- hostname
`)
}

function parseArgs(argv) {
  const separatorIndex = argv.indexOf('--')
  const optionArgs = separatorIndex === -1 ? argv : argv.slice(0, separatorIndex)
  const commandArgs = separatorIndex === -1 ? [] : argv.slice(separatorIndex + 1)
  const options = {
    mode: 'normal',
    workers: Math.max(1, Math.min(4, Math.floor(Number(process.env.LDT_WORKERS || 4)))),
    oversubscribe: process.env.LDT_MPI_OVERSUBSCRIBE !== '0',
  }

  for (let index = 0; index < optionArgs.length; index += 1) {
    const arg = optionArgs[index]
    if (arg === '--mode') {
      options.mode = optionArgs[index + 1]
      index += 1
    } else if (arg.startsWith('--mode=')) {
      options.mode = arg.slice('--mode='.length)
    } else if (arg === '--workers') {
      options.workers = Number(optionArgs[index + 1])
      index += 1
    } else if (arg.startsWith('--workers=')) {
      options.workers = Number(arg.slice('--workers='.length))
    } else if (arg === '--no-oversubscribe') {
      options.oversubscribe = false
    } else if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  options.workers = Math.max(1, Math.floor(options.workers || 1))

  if (!['normal', 'mpi'].includes(options.mode)) {
    throw new Error(`Unsupported mode "${options.mode}". Use "normal" or "mpi".`)
  }

  if (commandArgs.length === 0) {
    throw new Error('Missing command after --.')
  }

  return { options, commandArgs }
}

function buildCommand(options, commandArgs) {
  if (options.mode === 'normal') {
    return commandArgs
  }

  const mpiArgs = ['-np', String(options.workers)]
  if (options.oversubscribe) {
    mpiArgs.push('--oversubscribe')
  }
  return ['mpirun', ...mpiArgs, ...commandArgs]
}

try {
  const { options, commandArgs } = parseArgs(process.argv.slice(2))
  const finalCommand = buildCommand(options, commandArgs)
  const [cmd, ...args] = finalCommand

  console.error(`[processing-mode] mode=${options.mode} workers=${options.mode === 'mpi' ? options.workers : 1}`)
  console.error(`[processing-mode] command=${finalCommand.join(' ')}`)

  const child = spawn(cmd, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      LDT_PROCESSING_MODE: options.mode,
      LDT_WORKERS: String(options.mode === 'mpi' ? options.workers : 1),
    },
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[processing-mode] terminated by ${signal}`)
      process.exit(1)
    }
    process.exit(code == null ? 0 : code)
  })

  child.on('error', (error) => {
    console.error(`[processing-mode] failed to start: ${error.message}`)
    if (options.mode === 'mpi' && error.code === 'ENOENT') {
      console.error('[processing-mode] mpirun was not found. Install OpenMPI or rerun with --mode=normal.')
    }
    process.exit(127)
  })
} catch (error) {
  console.error(`[processing-mode] ${error.message}`)
  printUsage()
  process.exit(2)
}
