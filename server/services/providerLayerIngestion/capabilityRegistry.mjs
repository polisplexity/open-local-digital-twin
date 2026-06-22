import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const CAPABILITY_DEFINITIONS = [
  {
    key: 'geojson',
    label: 'GeoJSON import',
    status: 'ready',
    category: 'vector',
    requiredTools: [],
    writes: ['provider layer features', 'source artifacts', 'validation summary'],
  },
  {
    key: 'csv',
    label: 'CSV import',
    status: 'ready',
    category: 'vector',
    requiredTools: [],
    writes: ['provider layer features', 'source artifacts', 'validation summary'],
  },
  {
    key: 'ogc-features',
    label: 'OGC API Features import',
    status: 'ready',
    category: 'vector',
    requiredTools: [],
    writes: ['provider layer features', 'source artifacts', 'validation summary'],
  },
  {
    key: 'stac',
    label: 'STAC item footprint import',
    status: 'ready',
    category: 'raster-catalog',
    requiredTools: [],
    writes: ['provider layer footprints', 'STAC source artifact', 'validation summary'],
  },
  {
    key: 'cityjson',
    label: 'CityJSON package registration',
    status: 'ready',
    category: '3d-package',
    requiredTools: [],
    writes: ['package metadata', 'source artifact', 'validation summary'],
  },
  {
    key: 'ifc',
    label: 'IFC package registration',
    status: 'ready',
    category: 'bim-package',
    requiredTools: [],
    writes: ['package metadata', 'source artifact', 'validation summary'],
  },
  {
    key: 'overture-buildings',
    label: 'Overture buildings import',
    status: 'tool-dependent',
    category: 'open-data-connector',
    requiredTools: ['python3', 'python-overturemaps'],
    writes: ['provider layer features', 'source artifact', 'validation summary'],
  },
  {
    key: 'overture-roads',
    label: 'Overture roads import',
    status: 'tool-dependent',
    category: 'open-data-connector',
    requiredTools: ['python3', 'python-overturemaps'],
    writes: ['provider layer features', 'source artifact', 'validation summary'],
  },
  {
    key: 'shapefile',
    label: 'Shapefile conversion',
    status: 'tool-dependent',
    category: 'native-vector',
    requiredTools: ['ogr2ogr'],
    writes: ['provider layer features', 'source artifact', 'validation summary'],
  },
  {
    key: 'geopackage',
    label: 'GeoPackage conversion',
    status: 'tool-dependent',
    category: 'native-vector',
    requiredTools: ['ogr2ogr'],
    writes: ['provider layer features', 'source artifact', 'validation summary'],
  },
  {
    key: 'raster-cog',
    label: 'COG/raster catalog registration',
    status: 'metadata-only',
    category: 'raster',
    requiredTools: [],
    writes: ['package metadata', 'source artifact'],
  },
  {
    key: 'osm-local-extract',
    label: 'Local OSM extract promotion',
    status: 'ready',
    category: 'open-data-bootstrap',
    requiredTools: [],
    writes: ['promoted open layers', 'provenance records', 'catalog records'],
  },
  {
    key: 'mvt-cache-refresh',
    label: 'Viewer aggregate and MVT refresh',
    status: 'ready',
    category: 'viewer-cache',
    requiredTools: [],
    writes: ['viewer summary cache', 'density grid cache', 'MVT version metadata'],
  },
]

async function commandAvailable(command) {
  try {
    await execFileAsync('which', [command], { timeout: 3000, windowsHide: true })
    return true
  } catch {
    return false
  }
}

async function pythonModuleAvailable(moduleName) {
  try {
    await execFileAsync('python3', ['-c', `import ${moduleName}`], { timeout: 5000, windowsHide: true })
    return true
  } catch {
    return false
  }
}

async function inspectTool(tool) {
  if (tool === 'python-overturemaps') {
    return {
      tool,
      available: await pythonModuleAvailable('overturemaps'),
      probe: 'python3 -c import overturemaps',
    }
  }
  return {
    tool,
    available: await commandAvailable(tool),
    probe: `which ${tool}`,
  }
}

function capabilityRuntimeStatus(capability, tools) {
  if (capability.status === 'pending-adapter') return 'pending-adapter'
  if (capability.status === 'metadata-only') return 'metadata-only'
  const required = capability.requiredTools ?? []
  const missing = required.filter((tool) => tools.find((entry) => entry.tool === tool)?.available !== true)
  if (missing.length) return 'tool-missing'
  return 'ready'
}

export async function inspectProviderIngestionCapabilities() {
  const toolKeys = Array.from(new Set(CAPABILITY_DEFINITIONS.flatMap((capability) => capability.requiredTools ?? [])))
  const tools = await Promise.all(toolKeys.map(inspectTool))
  const capabilities = CAPABILITY_DEFINITIONS.map((capability) => {
    const requiredTools = capability.requiredTools ?? []
    const capabilityTools = requiredTools.map((tool) => tools.find((entry) => entry.tool === tool)).filter(Boolean)
    const runtimeStatus = capabilityRuntimeStatus(capability, capabilityTools)
    return {
      ...capability,
      runtimeStatus,
      tools: capabilityTools,
      canExecute: runtimeStatus === 'ready',
      canRegister: ['ready', 'metadata-only', 'tool-missing'].includes(runtimeStatus),
    }
  })
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    tools,
    capabilities,
    supportedActions: capabilities.filter((capability) => capability.canExecute).map((capability) => capability.key),
    metadataOnlyActions: capabilities.filter((capability) => capability.runtimeStatus === 'metadata-only').map((capability) => capability.key),
    pendingAdapters: capabilities.filter((capability) => capability.runtimeStatus === 'pending-adapter').map((capability) => capability.key),
    missingToolActions: capabilities.filter((capability) => capability.runtimeStatus === 'tool-missing').map((capability) => capability.key),
  }
}
