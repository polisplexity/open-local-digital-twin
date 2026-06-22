import fs from 'fs/promises'

const ROUTE_PATTERN = /app\.(get|post|put|patch|delete)\(\s*['`]([^'`]+)['`]/g

export const PRODUCT_CAPABILITIES = [
  {
    key: 'open-data-base-twin',
    title: 'Open-data base twin',
    phase: 10,
    status: 'partial',
    promise: 'Any city can start from public/open data.',
    standards: ['OSM/Overpass', 'Overture', 'DCAT', 'PROV', 'OGC API Features'],
    databaseSchemas: ['ldt_catalog', 'ldt_prov', 'ldt_core'],
    apiFamilies: ['live-base', 'live-features', 'live-tiles'],
    uiSurface: 'cockpit',
    productGap: 'Open-data refresh is still script/admin driven and needs a city-operable workflow with progress and quality reporting.',
  },
  {
    key: 'consolidated-city-inventory',
    title: 'Consolidated city inventory',
    phase: 10,
    status: 'implemented-partial-ui',
    promise: 'The city is one inventory enriched by source evidence, not separate OSM/Overture UI truth.',
    standards: ['PROV-O concepts', 'OGC API Features', 'NGSI-LD'],
    databaseSchemas: ['ldt_core', 'ldt_prov'],
    apiFamilies: ['live-features', 'standards-ogc', 'standards-ngsi'],
    uiSurface: 'cockpit',
    productGap: 'Dedicated inventory and entity-evidence APIs/UI are still missing.',
  },
  {
    key: 'source-catalog',
    title: 'Source catalog',
    phase: 10,
    status: 'implemented-partial-ui',
    promise: 'Every source has license, distribution, quality, attribution, and spatial metadata.',
    standards: ['DCAT', 'ODRL'],
    databaseSchemas: ['ldt_catalog', 'ldt_interop'],
    apiFamilies: ['standards-dcat'],
    uiSurface: 'missing',
    productGap: 'Need a source catalog UI and access-right/license cleanup.',
  },
  {
    key: 'provenance-evidence',
    title: 'Provenance and evidence',
    phase: 10,
    status: 'implemented-partial-api',
    promise: 'Every consolidated entity can be traced back to source evidence and review decisions.',
    standards: ['PROV-O concepts'],
    databaseSchemas: ['ldt_prov'],
    apiFamilies: ['standards-ogc', 'standards-ngsi'],
    uiSurface: 'missing',
    productGap: 'Need entity evidence endpoint and analyst evidence panel.',
  },
  {
    key: 'standards-publication',
    title: 'Standards publication',
    phase: 10,
    status: 'implemented-partial-ui',
    promise: 'The twin exposes standards-native outputs, not just internal JSON.',
    standards: ['DCAT JSON-LD', 'NGSI-LD', 'OGC API Features', 'ODRL'],
    databaseSchemas: ['ldt_interop'],
    apiFamilies: ['standards-dcat', 'standards-ngsi', 'standards-ogc'],
    uiSurface: 'missing',
    productGap: 'Need standards module with endpoint status, examples, explorer links, and versioning.',
  },
  {
    key: 'fiware-live-context',
    title: 'FIWARE live context',
    phase: 10,
    status: 'partial',
    promise: 'FIWARE is the live context/interconnection layer over durable PostGIS inventory.',
    standards: ['NGSI-LD', 'FIWARE Orion-LD/Scorpio boundary'],
    databaseSchemas: ['ldt_fiware', 'ldt_interop'],
    apiFamilies: ['admin-fiware', 'provider-fiware'],
    uiSurface: 'admin',
    productGap: 'Need real broker profile, resumable sync, auth, retries, and operator UI.',
  },
  {
    key: 'provider-connectors',
    title: 'Provider and private-data connectors',
    phase: 10,
    status: 'partial',
    promise: 'City, provider, flood, fire, satellite, IoT, BIM, and other datasets can attach through APIs.',
    standards: ['GeoJSON', 'CSV', 'OGC API Features', 'WFS', 'STAC', 'CityJSON', 'IFC', 'GeoPackage', 'Shapefile'],
    databaseSchemas: ['public', 'ldt_catalog', 'ldt_prov'],
    apiFamilies: ['admin-layers', 'provider-upload', 'provider-jobs'],
    uiSurface: 'admin',
    productGap: 'Need validation/publication gates and a product-grade provider onboarding flow.',
  },
  {
    key: 'viewer-aggregates',
    title: 'Large-city viewer aggregates',
    phase: 10,
    status: 'implemented-partial-ui',
    promise: 'Large cities use cached summaries, density grids, viewport windows, and tiles instead of full-city browser payloads.',
    standards: ['Internal viewer performance contract'],
    databaseSchemas: ['ldt_viewer'],
    apiFamilies: ['viewer-summary', 'density-grid', 'live-features', 'live-tiles'],
    uiSurface: 'cockpit',
    productGap: 'Cockpit indicators still need to come only from LDT-native summaries/science reports.',
  },
  {
    key: 'urban-science',
    title: 'Urban science',
    phase: 10,
    status: 'partial',
    promise: 'City analytics are reproducible observations with methods, quality, uncertainty, and model contracts.',
    standards: ['Urban science standard', 'Scaling models', 'Network metrics', 'Simulation/scenario contracts'],
    databaseSchemas: ['ldt_science'],
    apiFamilies: ['science-report'],
    uiSurface: 'missing',
    productGap: 'Need UI module and better population, district, graph, and calibration datasets.',
  },
  {
    key: 'society-culture',
    title: 'Social, economic, and cultural layer',
    phase: 10,
    status: 'partial',
    promise: 'Social/cultural analysis is aggregate, privacy-safe, and source-quality explicit.',
    standards: ['Privacy policy', 'Source-quality rules', 'Aggregate observation standard'],
    databaseSchemas: ['ldt_society'],
    apiFamilies: ['society-report'],
    uiSurface: 'missing',
    productGap: 'Need UI module, population grids, district aggregation, and privacy-aware public/private modes.',
  },
  {
    key: 'semantic-packs',
    title: 'Semantic packs',
    phase: 10,
    status: 'partial',
    promise: 'Domain logic attaches as explicit service packs with rules, blocked claims, features, workflows, and exports.',
    standards: ['Semantic pack manifest', 'Rules', 'Workflow/export contract'],
    databaseSchemas: ['ldt_semantic'],
    apiFamilies: ['semantic-pack-report'],
    uiSurface: 'missing',
    productGap: 'Need semantic-pack UI with review workflows and blocked operational claims.',
  },
  {
    key: 'api-observability',
    title: 'API observability',
    phase: 12,
    status: 'schema-only',
    promise: 'Operators can see API usage, latency, errors, route family, city, and role.',
    standards: ['Prometheus/Grafana-ready metrics', 'Request IDs'],
    databaseSchemas: ['ldt_ops'],
    apiFamilies: ['missing'],
    uiSurface: 'missing',
    productGap: 'Need middleware, metrics endpoint, Grafana dashboard, and API usage panel.',
  },
  {
    key: 'open-source-install',
    title: 'One-city open-source install',
    phase: 14,
    status: 'documented-partial',
    promise: 'A city can install one backend and lightweight UI for its own base twin.',
    standards: ['Docker Compose', 'PostGIS', 'Migration/runbook contract'],
    databaseSchemas: ['all-runtime-schemas'],
    apiFamilies: ['health', 'admin', 'live'],
    uiSurface: 'not-packaged',
    productGap: 'Need clean one-city setup, env template, create-city, backup/restore, smoke tests, and wiki.',
  },
]

export function classifyRoute(path) {
  if (path === '/api/health') return 'health'
  if (path.includes('/standards/dcat')) return 'standards-dcat'
  if (path.includes('/standards/ngsi-ld')) return 'standards-ngsi'
  if (path.includes('/standards/ogc')) return 'standards-ogc'
  if (path.includes('/science/urban-report')) return 'science-report'
  if (path.includes('/society/report')) return 'society-report'
  if (path.includes('/semantic-packs/')) return 'semantic-pack-report'
  if (path.includes('/viewer-summary')) return 'viewer-summary'
  if (path.includes('/density-grid')) return 'density-grid'
  if (path.includes('/tiles/')) return 'live-tiles'
  if (path.includes('/features')) return 'live-features'
  if (path.includes('/base')) return 'live-base'
  if (path.includes('/capabilities')) return 'capabilities'
  if (path.includes('/fiware')) return path.startsWith('/api/provider') ? 'provider-fiware' : 'admin-fiware'
  if (path.includes('/upload')) return 'provider-upload'
  if (path.includes('/ingestion-jobs') || path.includes('/jobs')) return 'provider-jobs'
  if (path.includes('/layers')) return 'admin-layers'
  if (path.startsWith('/api/admin')) return 'admin'
  if (path.startsWith('/api/provider')) return 'provider'
  if (path.startsWith('/api/live')) return 'live'
  if (path.startsWith('/live/')) return 'viewer-shell'
  if (path.startsWith('/api/auth') || path.startsWith('/auth')) return 'auth'
  return 'app'
}

async function defaultRouteSourceFiles() {
  const routeFiles = [new URL('../index.mjs', import.meta.url)]
  const routesDir = new URL('../routes/', import.meta.url)
  try {
    const entries = await fs.readdir(routesDir)
    entries
      .filter((entry) => entry.endsWith('.mjs'))
      .sort()
      .forEach((entry) => routeFiles.push(new URL(`../routes/${entry}`, import.meta.url)))
  } catch {
    // Older builds did not have server/routes yet.
  }
  return routeFiles
}

export async function extractRouteInventory(routeSources = null) {
  const sourceFiles = routeSources
    ? (Array.isArray(routeSources) ? routeSources : [routeSources])
    : await defaultRouteSourceFiles()
  const routes = []
  const seen = new Set()
  for (const sourceFile of sourceFiles) {
    const source = await fs.readFile(sourceFile, 'utf8')
    for (const match of source.matchAll(ROUTE_PATTERN)) {
      const method = match[1].toUpperCase()
      const path = match[2]
      const routeKey = `${method}:${path}`
      if (seen.has(routeKey)) continue
      seen.add(routeKey)
      routes.push({
        method,
        path,
        family: classifyRoute(path),
        authenticated: !['/api/health', '/api/platform/context'].includes(path)
          && !path.startsWith('/auth')
          && !path.startsWith('/api/auth'),
      })
    }
  }
  return routes.sort((a, b) => `${a.family}:${a.path}:${a.method}`.localeCompare(`${b.family}:${b.path}:${b.method}`))
}

export function summarizeRouteInventory(routes) {
  const byFamily = {}
  const byMethod = {}
  for (const route of routes) {
    byFamily[route.family] = (byFamily[route.family] ?? 0) + 1
    byMethod[route.method] = (byMethod[route.method] ?? 0) + 1
  }
  return {
    total: routes.length,
    byFamily,
    byMethod,
  }
}

export function buildStaticCapabilityContract(routes = []) {
  const routeFamilies = new Set(routes.map((route) => route.family))
  return PRODUCT_CAPABILITIES.map((capability) => ({
    ...capability,
    apiCoverage: capability.apiFamilies.map((family) => ({
      family,
      present: family !== 'missing' && routeFamilies.has(family),
      routeCount: routes.filter((route) => route.family === family).length,
    })),
  }))
}
