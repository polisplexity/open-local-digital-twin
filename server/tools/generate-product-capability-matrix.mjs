import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  buildStaticCapabilityContract,
  extractRouteInventory,
  summarizeRouteInventory,
} from './product-capability-contract.mjs'
import { getCityCapabilityState } from '../services/ldtOpsService.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '../..')

function parseArgs(argv) {
  const args = {
    cityIds: [],
    output: path.join(repoRoot, 'docs/generated/capability_matrix.json'),
  }
  for (const arg of argv) {
    if (arg.startsWith('--city=')) {
      args.cityIds = arg.slice('--city='.length).split(',').map((cityId) => cityId.trim()).filter(Boolean)
    } else if (arg.startsWith('--output=')) {
      args.output = path.resolve(repoRoot, arg.slice('--output='.length))
    }
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const routes = await extractRouteInventory()
  const routeSummary = summarizeRouteInventory(routes)
  const capabilities = buildStaticCapabilityContract(routes)
  const cityCapabilities = {}

  for (const cityId of args.cityIds) {
    cityCapabilities[cityId] = await getCityCapabilityState(cityId)
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      routeFile: 'server/index.mjs + server/routes/*.mjs',
      contractFile: 'server/tools/product-capability-contract.mjs',
      documentation: 'docs/PRODUCT_CAPABILITY_MATRIX_2026-05-16.md',
    },
    routeSummary,
    routes,
    capabilities,
    cityCapabilities,
    phaseOrder: [
      {
        phase: 10,
        title: 'Product Capability Contract',
        status: 'accepted-with-known-partials',
      },
      {
        phase: 11,
        title: 'LDT-Native UI Rebuild',
        status: 'mostly-implemented',
      },
      {
        phase: 12,
        title: 'API Governance And Observability',
        status: 'closed-for-implementation',
      },
      {
        phase: 13,
        title: 'Visual Surfaces Rebuild',
        status: 'in-progress',
      },
      {
        phase: 14,
        title: 'Open-Data Workflow Runner',
        status: 'pending',
      },
      {
        phase: 15,
        title: 'One-City Open-Source Production Package',
        status: 'pending',
      },
      {
        phase: 16,
        title: 'Agentic Operations Layer',
        status: 'blocked-until-workflow-gates',
      },
    ],
  }

  await fs.mkdir(path.dirname(args.output), { recursive: true })
  await fs.writeFile(args.output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    ok: true,
    output: path.relative(repoRoot, args.output),
    routes: routeSummary.total,
    capabilities: capabilities.length,
    cities: Object.keys(cityCapabilities),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
