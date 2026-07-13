import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { getProcessingNode, recordProcessingNodeHeartbeat, registerProcessingNode } from './processingNodeService.mjs'

const execFileAsync = promisify(execFile)
const SIDECAR_CONTRACT_VERSION = '2026-06-27.same-server-sidecar-provider.v1'
const DEFAULT_STAGE_BINDINGS = Object.freeze([
  'ingestion-queue',
  'environmental-extractors',
  'semantic-materialization',
  'viewer-artifacts',
])

function normalizeKey(value, fallback = '') {
  const normalized = (String(value ?? '').trim() || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!/^[a-z0-9][a-z0-9._-]{1,128}$/.test(normalized)) {
    throw new Error('SAME_SERVER_SIDECAR_NODE_KEY_INVALID')
  }
  return normalized
}

function stringValue(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function splitList(values, fallback = []) {
  const source = Array.isArray(values) ? values : [values]
  const entries = source.flatMap((value) => String(value ?? '').split(','))
    .map((value) => value.trim())
    .filter(Boolean)
  return entries.length ? entries : fallback
}

function jsonFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function textFile(file, value, mode = null) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, value)
  if (mode !== null) fs.chmodSync(file, mode)
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

function sidecarCommands({ cityId = 'guanajuato' } = {}) {
  return [
    'cp .env.datafactory.example .env.datafactory',
    'docker compose --env-file .env.datafactory -f compose.datafactory.yml up -d postgis',
    'docker compose --env-file .env.datafactory -f compose.datafactory.yml --profile runner build runner',
    'docker compose --env-file .env.datafactory -f compose.datafactory.yml --profile runner run --rm runner npm run ops:datafactory:doctor -- --require-db',
    `docker compose --env-file .env.datafactory -f compose.datafactory.yml --profile runner run --rm runner ops/datafactory/run-city-export.sh ${shellQuote(cityId)}`,
  ]
}

export function buildSameServerSidecarPlan({
  nodeKey = 'same-server-sidecar',
  outputDir = '',
  cityId = 'guanajuato',
  imageRef = 'twin-base-studio-datafactory:local',
  projectName = 'twin-base-studio-datafactory',
  stageBindings = DEFAULT_STAGE_BINDINGS,
} = {}) {
  const resolvedNodeKey = normalizeKey(nodeKey, 'same-server-sidecar')
  const resolvedOutputDir = path.resolve(stringValue(outputDir, path.join('runtime-data', 'data-factory-sidecar', resolvedNodeKey)))
  const commands = sidecarCommands({ cityId: stringValue(cityId, 'guanajuato') })
  const plan = {
    schemaVersion: SIDECAR_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    providerType: 'same-server-sidecar',
    connectionMode: 'local',
    runtimeKind: 'docker-compose',
    nodeKey: resolvedNodeKey,
    projectName,
    imageRef,
    composeFile: 'compose.datafactory.yml',
    envFile: '.env.datafactory',
    stageBindings: splitList(stageBindings, DEFAULT_STAGE_BINDINGS),
    commands,
    posture: {
      appAndDataFactoryShareServer: true,
      appDoesNotRequireRemoteWorkerIngress: true,
      heavyWorkRunsOutsideViewerRequestPath: true,
    },
  }
  return {
    outputDir: resolvedOutputDir,
    planFile: path.join(resolvedOutputDir, 'same-server-sidecar-plan.json'),
    commandFile: path.join(resolvedOutputDir, 'same-server-sidecar.commands.sh'),
    plan,
  }
}

export async function runSameServerSidecarDoctor({
  requireDb = true,
  timeoutMs = 120000,
} = {}) {
  const args = ['server/tools/data-factory-runtime-doctor.mjs', requireDb ? '--require-db' : '--no-db']
  try {
    const result = await execFileAsync(process.execPath, args, {
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    })
    return parseJson(result.stdout, {
      ok: true,
      raw: String(result.stdout || result.stderr || '').trim(),
    })
  } catch (error) {
    const parsed = parseJson(error?.stdout, null)
    return parsed ?? {
      ok: false,
      error: String(error?.message ?? 'SAME_SERVER_SIDECAR_DOCTOR_FAILED'),
      stdout: String(error?.stdout ?? '').slice(0, 4000),
      stderr: String(error?.stderr ?? '').slice(0, 4000),
    }
  }
}

export async function ensureSameServerSidecarProvider({
  nodeKey = '',
  displayName = '',
  cityId = 'guanajuato',
  outputDir = '',
  imageRef = 'twin-base-studio-datafactory:local',
  runtimeVersion = 'same-server-sidecar',
  projectName = 'twin-base-studio-datafactory',
  artifactRoot = 'runtime-data/artifacts',
  stageBindings = DEFAULT_STAGE_BINDINGS,
  runDoctor = true,
  requireDb = true,
  doctorResult = null,
  registeredBy = 'same-server-sidecar-provider',
} = {}) {
  const resolvedNodeKey = normalizeKey(nodeKey, `same-server-sidecar-${os.hostname()}`)
  const stages = splitList(stageBindings, DEFAULT_STAGE_BINDINGS)
  const plan = buildSameServerSidecarPlan({
    nodeKey: resolvedNodeKey,
    outputDir,
    cityId,
    imageRef,
    projectName,
    stageBindings: stages,
  })
  const artifactStore = {
    storeKey: `${resolvedNodeKey}-artifact-store`,
    displayName: `${stringValue(displayName, 'Same Server Data Factory')} Artifact Store`,
    storeType: 'local-filesystem',
    uri: `file://${path.resolve(artifactRoot)}`,
    publicConfig: {
      root: path.resolve(artifactRoot),
    },
  }

  const registered = await registerProcessingNode({
    nodeKey: resolvedNodeKey,
    displayName: stringValue(displayName, 'Same Server Data Factory Sidecar'),
    providerType: 'same-server-sidecar',
    connectionMode: 'local',
    runtimeKind: 'docker-compose',
    runtimeVersion,
    imageRef,
    status: 'registered',
    lifecycleStatus: 'generated',
    artifactStore,
    stageBindings: stages.map((stageKey) => ({ stageKey, enabled: true, priority: 10 })),
    capabilities: {
      providerContract: SIDECAR_CONTRACT_VERSION,
      stageBindings: stages,
      commandMode: 'docker-compose',
      managedBy: 'twin-studio-control-plane',
    },
    publicConfig: {
      composeFile: 'compose.datafactory.yml',
      projectName,
      planFile: plan.planFile,
      commandFile: plan.commandFile,
    },
    metadata: {
      cityId: stringValue(cityId, 'guanajuato'),
      generatedBy: 'ensureSameServerSidecarProvider',
    },
    registeredBy,
  })
  if (!registered.ok) return registered

  const doctor = doctorResult ?? (runDoctor
    ? await runSameServerSidecarDoctor({ requireDb })
    : { ok: true, skipped: true, reason: 'SAME_SERVER_SIDECAR_DOCTOR_SKIPPED' })
  const doctorPassed = Boolean(doctor.ok && !doctor.skipped)

  const heartbeat = await recordProcessingNodeHeartbeat({
    nodeKey: resolvedNodeKey,
    requireToken: false,
    heartbeat: {
      status: doctor.ok ? 'online' : 'error',
      doctorStatus: doctorPassed ? 'passed' : doctor.ok ? 'unknown' : 'failed',
      runtimeVersion,
      imageRef,
      cpuCoreCount: os.cpus().length,
      memoryBytes: os.totalmem(),
      runningJobCount: 0,
      capabilities: {
        providerContract: SIDECAR_CONTRACT_VERSION,
        stageBindings: stages,
        commandMode: 'docker-compose',
        doctorOk: Boolean(doctor.ok),
        doctorSkipped: Boolean(doctor.skipped),
      },
      doctor,
      metrics: {
        host: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
      },
    },
  })

  jsonFile(plan.planFile, {
    ...plan.plan,
    node: heartbeat.node,
    doctor: {
      ok: Boolean(doctor.ok),
      skipped: Boolean(doctor.skipped),
    },
  })
  textFile(plan.commandFile, `#!/usr/bin/env bash
set -euo pipefail

${plan.plan.commands.join('\n')}
`, 0o700)

  const latest = await getProcessingNode(resolvedNodeKey)
  return {
    ok: Boolean(registered.ok && heartbeat.ok),
    ready: doctorPassed,
    schemaVersion: SIDECAR_CONTRACT_VERSION,
    providerType: 'same-server-sidecar',
    connectionMode: 'local',
    runtimeKind: 'docker-compose',
    node: latest.ok ? latest.node : heartbeat.node,
    doctor: {
      ok: Boolean(doctor.ok),
      skipped: Boolean(doctor.skipped),
      missingRequiredCommands: doctor.missingRequiredCommands ?? [],
      missingModules: doctor.missingModules ?? [],
    },
    heartbeat,
    planFile: plan.planFile,
    commandFile: plan.commandFile,
    commands: plan.plan.commands,
  }
}
