import { runQueuedProviderLayerIngestionJobs } from '../services/providerLayerIngestionService.mjs'

const once = process.argv.includes('--once') || process.env.TWIN_STUDIO_WORKER_ONCE === '1'
const intervalMs = Number(process.env.TWIN_STUDIO_WORKER_INTERVAL_MS ?? 10_000)
const workerId = process.env.TWIN_STUDIO_WORKER_ID ?? `provider-worker-${process.pid}`
const batchSize = Number(process.env.TWIN_STUDIO_WORKER_BATCH_SIZE ?? 5)

async function tick() {
  const result = await runQueuedProviderLayerIngestionJobs({
    workerId,
    limit: batchSize,
  })
  console.log(JSON.stringify({
    workerId,
    at: new Date().toISOString(),
    ...result,
  }))
}

async function main() {
  if (once) {
    await tick()
    return
  }

  let running = false
  const runLoop = async () => {
    if (running) return
    running = true
    try {
      await tick()
    } catch (error) {
      console.error(JSON.stringify({
        workerId,
        at: new Date().toISOString(),
        ok: false,
        error: String(error?.message ?? 'PROVIDER_INGESTION_WORKER_FAILED'),
      }))
    } finally {
      running = false
    }
  }

  await runLoop()
  setInterval(runLoop, Math.max(1000, intervalMs))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
