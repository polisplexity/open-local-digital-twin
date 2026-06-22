import { executePhase14WorkflowRunOnce } from '../services/ldtOpsService.mjs'

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length).trim() : null
}

const runId = argValue('run-id') ?? argValue('runId')
const workerId = argValue('worker-id') ?? argValue('workerId') ?? 'phase14-workflow-runner-cli'

if (!runId) {
  console.error('Usage: npm run ops:phase14-run-once -- --run-id=<workflow-run-id>')
  process.exit(1)
}

const result = await executePhase14WorkflowRunOnce({ runId, workerId })
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  run: {
    id: result.run.id,
    workflowKey: result.run.workflowKey,
    cityId: result.run.cityId,
    status: result.run.status,
    steps: result.run.steps.map((step) => ({
      stepKey: step.stepKey,
      status: step.status,
    })),
  },
  extractorRuns: result.extractorRuns.map((entry) => ({
    extractorKey: entry.extractorKey,
    status: entry.status,
    sourceStatus: entry.sourceStatus,
  })),
  artifacts: result.artifacts.map((artifact) => ({
    artifactKind: artifact.artifactKind,
    artifactUri: artifact.artifactUri,
  })),
}, null, 2))
