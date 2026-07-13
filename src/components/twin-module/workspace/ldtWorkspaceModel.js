import {
  Activity,
  Archive,
  BarChart2,
  Box,
  Database,
  GitBranch,
  Globe,
  Layers,
  Map,
  Server,
  Shield,
  Sliders,
  Zap,
} from 'react-feather'

export function formatCount(value) {
  const next = Number(value ?? 0)
  if (!Number.isFinite(next)) return '0'
  return new Intl.NumberFormat('en-US').format(next)
}

export function formatByteSize(value) {
  const bytes = Number(value ?? 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const scaled = bytes / (1024 ** exponent)
  const formatted = scaled >= 100 || exponent === 0
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(scaled)
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(scaled)
  return `${formatted} ${units[exponent]}`
}

export function titleize(value) {
  return String(value ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function productLifecycleState(status) {
  const value = String(status ?? '').toLowerCase()
  if (['authority-approved', 'authority approved', 'official', 'city-authority'].includes(value)) return 'authority-approved'
  if (['federated', 'fiware-synced', 'broker-synced'].includes(value)) return 'federated'
  if (['validated', 'succeeded', 'completed', 'ready', 'pass', 'passed'].includes(value)) return 'validated'
  if (['generated', 'registered', 'queued', 'partial', 'source-required', 'source-plan-only'].includes(value)) return 'generated'
  if (['blocked', 'failed', 'error', 'missing'].includes(value)) return 'blocked'
  if (value === 'construction') return 'construction'
  if (value === 'lab') return 'lab'
  return value || 'generated'
}

export function statusVariant(status) {
  const value = productLifecycleState(status)
  if (['validated', 'federated', 'authority-approved'].includes(value)) return 'success'
  if (value === 'blocked') return 'danger'
  if (value === 'construction') return 'secondary'
  if (value === 'lab') return 'info'
  return 'warning'
}

export function formatDate(value) {
  if (!value) return 'No recent run'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No recent run'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatMetricValue(value, unit = '') {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value ?? '0')
  const formatted = Math.abs(numeric) >= 100
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(numeric)
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(numeric)
  return unit ? `${formatted} ${unit}` : formatted
}

export function compactList(values, fallback = 'None') {
  const rawValues = Array.isArray(values)
    ? values
    : values && typeof values === 'object'
      ? Object.values(values).flat()
      : values !== undefined && values !== null
        ? [values]
        : []
  const list = Array.from(new Set(rawValues.map((value) => String(value ?? '').trim()).filter(Boolean)))
  return list.length ? list.join(', ') : fallback
}

export function keyList(value, fallback = 'None') {
  if (Array.isArray(value)) return compactList(value, fallback)
  if (value && typeof value === 'object') return compactList(Object.keys(value), fallback)
  return compactList(value, fallback)
}

export function qualityStatus(value) {
  const quality = String(value ?? '').toLowerCase()
  if (quality.includes('missing') || quality.includes('blocked') || quality.includes('unavailable')) return 'blocked'
  if (quality.includes('partial') || quality.includes('candidate') || quality.includes('review')) return 'partial'
  if (quality.includes('ready') || quality.includes('open') || quality.includes('accepted')) return 'ready'
  return 'lab'
}

export function semanticBindingSummary(summary) {
  if (!summary) return 'City binding keeps semantic interpretation separate from base inventory.'
  if (typeof summary === 'string') return summary
  if (typeof summary !== 'object') return String(summary)
  const readiness = summary.readiness !== undefined ? `${summary.readiness}% ready` : 'readiness not scored'
  const canShow = compactList(summary.canShow, 'declared pack outputs')
  const gaps = compactList(summary.sourceGaps, 'no declared source gaps')
  return `${readiness}. Shows ${canShow}. Missing ${gaps}.`
}

export function standardForLayer(layer = {}) {
  const transports = layer.recommendedTransports ?? []
  if (layer.capabilities?.bim?.available) return 'BIM / asset payload'
  if (layer.capabilities?.rasterCatalog?.available) return 'STAC / raster catalog'
  if (layer.capabilities?.threeDPackage?.available) return '3D package metadata'
  if (layer.capabilities?.vectorTile?.available && transports.includes('mvt')) return 'OGC API + MVT'
  if (layer.capabilities?.geojsonWindow?.available) return 'OGC API Features'
  return 'Catalog metadata'
}

export function layerReadiness(layer = {}) {
  if (layer.featureCount > 0 && layer.authorityStatus === 'accepted') return 'ready'
  if (layer.featureCount > 0) return 'partial'
  if (layer.catalogCount > 0 || layer.latestPackage) return 'construction'
  return 'blocked'
}

export function buildInventoryRows({ layerCapabilities, entityItems, sourceItems }) {
  const runtimeRows = (layerCapabilities?.layers ?? []).map((layer) => ({
    key: layer.key,
    name: layer.name || titleize(layer.key),
    family: titleize(layer.layerFamily || 'provider layer'),
    geometryType: layer.geometryType || 'Geometry',
    count: layer.featureCount ?? 0,
    source: layer.provider?.name || compactList(layer.sourceFormats, 'Open/public source'),
    license: layer.sourceLicense || 'Not declared',
    authority: titleize(layer.authorityStatus || 'not reviewed'),
    semantic: titleize(layer.semanticStatus || 'base'),
    standard: standardForLayer(layer),
    latest: formatDate(layer.latestFeatureAt || layer.latestJobAt || layer.updatedAt),
    status: layerReadiness(layer),
  }))

  const existingKeys = new Set(runtimeRows.map((row) => row.key))
  const entityRows = entityItems
    .filter((item) => !existingKeys.has(item.label.toLowerCase().replace(/\s+/g, '-')))
    .map((item) => ({
      key: `entity-${item.label}`,
      name: item.label,
      family: 'Consolidated inventory',
      geometryType: 'Mixed',
      count: item.value,
      source: 'Core inventory',
      license: 'Derived evidence',
      authority: 'Open data',
      semantic: 'Base entity',
      standard: 'NGSI-LD / OGC',
      latest: 'Capability contract',
      status: Number(item.value) > 0 ? 'partial' : 'blocked',
    }))

  const sourceRows = sourceItems
    .filter((item) => runtimeRows.length < 1)
    .map((item) => ({
      key: `source-${item.label}`,
      name: item.label,
      family: 'Source evidence',
      geometryType: 'Source geometry',
      count: item.value,
      source: 'Provenance store',
      license: 'Open source',
      authority: 'Evidence',
      semantic: 'Raw evidence',
      standard: 'DCAT / PROV',
      latest: 'Capability contract',
      status: Number(item.value) > 0 ? 'partial' : 'blocked',
    }))

  return [...runtimeRows, ...entityRows, ...sourceRows].sort((a, b) => Number(b.count) - Number(a.count))
}

export function methodSummary(method = {}) {
  if (typeof method === 'string') return method
  if (!method || typeof method !== 'object') return 'Documented method'
  if (method.formula) return method.formula
  if (method.modelFamily) return titleize(method.modelFamily)
  if (method.source) return String(method.source)
  return 'Documented method'
}

export function buildAnalysisRows({ scienceReport, societyReport }) {
  const scienceRows = (scienceReport?.indicators ?? []).map((indicator) => ({
    key: `science-${indicator.key}`,
    name: indicator.name || titleize(indicator.key),
    domain: titleize(indicator.dimension || 'urban science'),
    family: titleize(indicator.modelFamily || 'indicator'),
    value: formatMetricValue(indicator.value, indicator.unit),
    quality: indicator.quality || 'not reviewed',
    sourceQuality: indicator.sourceQuality || 'not declared',
    method: methodSummary(indicator.method),
    standard: `${scienceReport?.standardKey ?? 'urban-science-core'} ${scienceReport?.standardVersion ?? ''}`.trim(),
  }))

  const societyRows = (societyReport?.observations ?? []).map((observation) => ({
    key: `society-${observation.key}`,
    name: observation.title || titleize(observation.key),
    domain: titleize(observation.dataDomain || 'society'),
    family: titleize(observation.observationType || 'aggregate observation'),
    value: formatMetricValue(observation.value, observation.unit),
    quality: observation.quality || observation.privacyClass || 'aggregate',
    sourceQuality: observation.sourceQuality || 'open-data',
    method: methodSummary(observation.method),
    standard: `${societyReport?.standardKey ?? 'society-culture-core'} ${societyReport?.standardVersion ?? ''}`.trim(),
  }))

  return [...scienceRows, ...societyRows].sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name))
}

export function buildAnalysisModelRows({ counts, scienceReport, societyReport }) {
  return [
    {
      key: 'urban-science',
      name: 'Urban science core',
      standard: scienceReport?.standardKey || 'urban-science-core',
      count: counts.scienceObservations,
      endpoint: '/api/live/current/science/urban-report',
      purpose: 'City morphology, network proxy, source-quality, and standards-coverage indicators.',
      status: Number(counts.scienceObservations ?? 0) > 0 ? 'ready' : 'partial',
      caveat: 'Scaling and scenario contracts exist, but are not calibrated from one city alone.',
    },
    {
      key: 'society-culture',
      name: 'Society and culture core',
      standard: societyReport?.standardKey || 'society-culture-core',
      count: counts.societyObservations,
      endpoint: '/api/live/current/society/report',
      purpose: 'Aggregate social, economic, cultural, service-anchor, and open-data readiness signals.',
      status: Number(counts.societyObservations ?? 0) > 0 ? 'ready' : 'partial',
      caveat: societyReport?.privacyPosture || 'Aggregate/public-open posture only; no personal microdata.',
    },
    {
      key: 'density-grid',
      name: 'Viewer density grid',
      standard: 'ldt_viewer aggregate grid',
      count: counts.densityCells,
      endpoint: '/api/live/current/density-grid',
      purpose: 'Precomputed city-scale density cells for large-city visualization and spatial reading.',
      status: Number(counts.densityCells ?? 0) > 0 ? 'ready' : 'partial',
      caveat: 'Useful for visual triage; not a replacement for authority validation.',
    },
    {
      key: 'semantic-service',
      name: 'Service semantic indicators',
      standard: 'reconstruction-service-core',
      count: counts.semanticIndicators,
      endpoint: '/api/live/current/semantic-packs/reconstruction-service-core/report',
      purpose: 'Service-readiness scaffold for reconstruction, waste, and future operational packs.',
      status: Number(counts.semanticIndicators ?? 0) > 0 ? 'ready' : 'partial',
      caveat: 'Damage and population demand are still missing required sources.',
    },
  ]
}

export function buildSemanticRows(semanticReport) {
  return (semanticReport?.indicators ?? []).map((indicator) => ({
    key: indicator.key,
    name: indicator.label || titleize(indicator.key),
    value: indicator.value === null ? 'Not connected' : formatMetricValue(indicator.value, indicator.unit),
    quality: indicator.quality || 'not reviewed',
    method: methodSummary(indicator.method),
    updatedAt: formatDate(indicator.updatedAt),
  }))
}

export function buildSemanticRuleRows(semanticReport) {
  return (semanticReport?.rules ?? []).map((rule) => ({
    key: rule.key,
    type: titleize(rule.type),
    inputs: compactList(rule.inputEntityTypes, 'No input entities'),
    output: titleize(rule.outputRole || 'service feature'),
    quality: titleize(rule.sourceQuality || 'not declared'),
    confidence: methodSummary(rule.confidenceRule),
  }))
}

export function apiStatusTone(statusCode) {
  const code = Number(statusCode ?? 0)
  if (!code) return 'partial'
  if (code >= 500) return 'blocked'
  if (code >= 400) return 'partial'
  return 'ready'
}

export function buildApiCatalogRows(operationsReport) {
  return (operationsReport?.apiCatalog ?? []).map((entry) => ({
    key: entry.key,
    family: titleize(entry.family),
    method: entry.method,
    path: entry.path,
    standard: entry.standard,
    version: entry.version,
    access: titleize(entry.access),
    state: entry.state,
    purpose: entry.purpose,
    versionedPath: entry.versionedPath,
    testHref: entry.testHref,
  }))
}

export function buildApiUsageRows(operationsReport) {
  return (operationsReport?.apiUsageSummary ?? []).map((row, index) => ({
    key: `${row.method}-${row.pathTemplate}-${index}`,
    family: titleize(row.routeFamily),
    method: row.method,
    path: row.pathTemplate,
    events: row.events,
    errors: row.errors,
    lastStatusCode: row.lastStatusCode,
    avgLatencyMs: row.avgLatencyMs,
    lastSeenAt: formatDate(row.lastSeenAt),
  }))
}

export function buildIngestionRows(operationsReport) {
  return (operationsReport?.ingestionJobs ?? []).map((job) => {
    const validationIssues = Array.isArray(job.validationSummary?.issues)
      ? job.validationSummary.issues
      : Array.isArray(job.validationSummary?.validationReport)
        ? job.validationSummary.validationReport
        : []
    const validationErrors = validationIssues.filter((issue) => issue?.severity === 'error').length
    const validationWarnings = validationIssues.filter((issue) => issue?.severity === 'warning').length
    return {
      key: job.id,
      layer: job.layerName || job.layerKey || titleize(job.jobKind),
      provider: job.providerName || 'Platform',
      format: titleize(job.sourceFormat),
      status: job.status,
      attempts: job.attemptCount,
      reports: job.validationReports,
      sourceState: job.validationSummary?.sourceState || job.validationSummary?.state || 'registered',
      canQueue: job.validationSummary?.canQueue === true,
      validationErrors,
      validationWarnings,
      validationSummary: validationIssues.length
        ? `${validationErrors} errors / ${validationWarnings} warnings`
        : job.validationSummary?.canQueue === true
          ? 'Worker-ready source'
          : 'No executable source gate',
      sourceUri: job.sourceUri || '',
      updatedAt: formatDate(job.updatedAt),
    }
  })
}

export function buildOpenApiRows(openApiDocument) {
  const paths = openApiDocument?.paths ?? {}
  return Object.entries(paths).flatMap(([path, methods]) =>
    Object.entries(methods ?? {}).map(([method, operation]) => ({
      key: `${method}-${path}`,
      method: method.toUpperCase(),
      path,
      tag: compactList(operation.tags, 'API'),
      summary: operation.summary || operation.operationId || 'API operation',
      operationId: operation.operationId || '',
      security: Array.isArray(operation.security) && operation.security.length ? 'Session' : 'Public',
      requestBody: operation.requestBody ? 'Documented' : 'None',
      aliasFor: operation['x-alias-for'] || '',
      response: Object.keys(operation.responses ?? {}).join(', '),
    })),
  )
}

export function buildMetricsFamilyRows(metricsSummary) {
  return (metricsSummary?.byFamily ?? []).map((row) => ({
    key: row.routeFamily || 'unknown',
    family: titleize(row.routeFamily || 'unknown'),
    events: row.events,
    errors: row.errors,
    errorRate: row.errorRate,
    avgLatencyMs: row.avgLatencyMs,
    p95LatencyMs: row.p95LatencyMs,
    latestEventAt: formatDate(row.latestEventAt),
  }))
}

export function buildSlowRouteRows(metricsSummary) {
  return (metricsSummary?.slowRoutes ?? []).map((row, index) => ({
    key: `${row.method}-${row.pathTemplate}-${index}`,
    method: row.method,
    path: row.pathTemplate,
    events: row.events,
    avgLatencyMs: row.avgLatencyMs,
    p95LatencyMs: row.p95LatencyMs,
    latestEventAt: formatDate(row.latestEventAt),
  }))
}

export function buildSemanticWorkflowRows(semanticReport) {
  return (semanticReport?.workflows ?? []).map((workflow) => ({
    key: workflow.key,
    title: workflow.title || titleize(workflow.key),
    status: workflow.status || 'queued',
    priority: workflow.priority || 'medium',
    actionItems: Array.isArray(workflow.actionItems) ? workflow.actionItems.length : 0,
    inputs: keyList(workflow.inputs, 'No declared inputs'),
    outputs: keyList(workflow.outputs, 'No declared outputs'),
    updatedAt: formatDate(workflow.updatedAt),
  }))
}

export function buildSemanticFeatureRows(semanticReport) {
  return (semanticReport?.serviceFeatureSummary ?? []).map((feature) => ({
    key: `${feature.role}-${feature.quality}`,
    role: titleize(feature.role),
    quality: feature.quality || 'not reviewed',
    count: feature.count,
  }))
}

export function sourceRole(sourceKey) {
  const key = String(sourceKey ?? '').toLowerCase()
  if (key.includes('overture')) return 'Open building enrichment'
  if (key.includes('building')) return 'Observed building base'
  if (key.includes('road')) return 'Mobility network base'
  if (key.includes('green') || key.includes('land')) return 'Land and environment base'
  if (key.includes('facility')) return 'Civic and service anchors'
  if (key.includes('place') || key.includes('center')) return 'Territorial reference'
  return 'Open evidence layer'
}

export function sourceLicense(sourceKey) {
  const key = String(sourceKey ?? '').toLowerCase()
  if (key.includes('overture')) return 'Open provider terms'
  if (['buildings', 'roads', 'facilities', 'greenblue', 'places', 'center'].includes(key)) return 'OpenStreetMap / Overpass'
  return 'Declared in catalog'
}

export function sourceFeeds(sourceKey) {
  const key = String(sourceKey ?? '').toLowerCase()
  if (key.includes('overture') || key.includes('building')) return 'Buildings'
  if (key.includes('road')) return 'Roads'
  if (key.includes('facility')) return 'Facilities'
  if (key.includes('green') || key.includes('land')) return 'Land use / green-blue systems'
  if (key.includes('place') || key.includes('center')) return 'Places'
  return 'Source evidence'
}

export function buildSourceRows({ sourceItems, layerCapabilities }) {
  const runtimeLayers = layerCapabilities?.layers ?? []
  return sourceItems.map((item) => {
    const key = String(item.key ?? item.label ?? '').toLowerCase()
    const relatedLayer = runtimeLayers.find((layer) => {
      const layerKey = String(layer.key ?? '').toLowerCase()
      return layerKey === key || layerKey.includes(key) || key.includes(layerKey)
    })
    const latest = relatedLayer?.latestFeatureAt || relatedLayer?.latestJobAt || relatedLayer?.updatedAt
    return {
      key: item.key,
      name: item.label,
      role: sourceRole(item.key),
      evidenceCount: item.value,
      license: relatedLayer?.sourceLicense || sourceLicense(item.key),
      feeds: sourceFeeds(item.key),
      standard: 'DCAT + PROV + OGC',
      status: Number(item.value) > 0 ? 'ready' : 'blocked',
      latest: formatDate(latest),
    }
  }).sort((a, b) => Number(b.evidenceCount) - Number(a.evidenceCount))
}

export function buildStandardsRows({ counts, layerCapabilities }) {
  const layerSummary = layerCapabilities?.summary ?? {}
  const entityCount = Number(counts.entities ?? 0)
  const ngsiCount = Number(counts.ngsiProjections ?? 0)
  const dcatCount = Number(counts.datasets ?? 0)
  const modelOutputDatasetCount = Number(counts.modelOutputDatasets ?? 0)
  const ogcCount = Number(counts.ogcCollections ?? 0)
  const vectorCount = Number(layerSummary.vectorTileLayerCount ?? 0)
  const rasterCount = Number(layerSummary.rasterMetadataLayerCount ?? 0)
  const bimCount = Number(layerSummary.bimLayerCount ?? 0) + Number(layerSummary.threeDMetadataLayerCount ?? 0)

  return [
    {
      key: 'dcat',
      name: 'DCAT catalog',
      output: 'Dataset catalog',
      count: dcatCount,
      endpoint: '/api/live/current/standards/dcat',
      coverage: 'Datasets, licenses, distributions, quality reports, and service references.',
      next: 'Publish versioned catalog metadata with public/private data policy.',
      status: dcatCount > 0 ? 'ready' : 'blocked',
    },
    {
      key: 'ngsi',
      name: 'NGSI-LD entities',
      output: 'FIWARE context projection',
      count: ngsiCount,
      endpoint: '/api/live/current/standards/ngsi-ld/entities?limit=25',
      coverage: 'Smart Data Models style entities generated from the durable city inventory.',
      next: 'Connect a real Orion-LD or Scorpio broker profile when deployment requires it.',
      status: ngsiCount >= entityCount && entityCount > 0 ? 'ready' : ngsiCount > 0 ? 'partial' : 'blocked',
    },
    {
      key: 'model-output-csv',
      name: 'Model output CSV',
      output: 'Derived model table',
      count: modelOutputDatasetCount,
      endpoint: '/api/live/current/standards/model-outputs.csv?modelKey=eu-ldt-ecobuild&modelVersion=code-europa-bb710aa-simulated',
      coverage: 'Tabular export of model outputs attached to canonical city entities.',
      next: 'Add per-model filters and persistent export packages when more models are attached.',
      status: modelOutputDatasetCount > 0 ? 'ready' : 'construction',
    },
    {
      key: 'ogc',
      name: 'OGC API Features',
      output: 'Feature collections',
      count: ogcCount,
      endpoint: '/api/live/current/standards/ogc/collections',
      coverage: 'Queryable feature collections for consolidated city entities and layers.',
      next: 'Add OpenAPI conformance links, schemas, pagination limits, and examples.',
      status: ogcCount > 0 ? 'ready' : 'blocked',
    },
    {
      key: 'mvt',
      name: 'Vector tiles',
      output: 'MVT delivery',
      count: vectorCount,
      endpoint: '/api/live/current/tiles/{z}/{x}/{y}.mvt',
      coverage: 'Viewer-grade tiled delivery for large spatial layers and radius-filtered maps.',
      next: 'Add cache headers, tile invalidation by ingestion version, and tile usage telemetry.',
      status: vectorCount > 0 ? 'ready' : 'partial',
    },
    {
      key: 'raster',
      name: 'Raster metadata',
      output: 'STAC / COG / WMS posture',
      count: rasterCount,
      endpoint: '/api/live/current/layer-capabilities',
      coverage: 'Catalog-level raster readiness for flood, satellite, and environmental layers.',
      next: 'Define object storage and external tile-service adapters for binary payloads.',
      status: rasterCount > 0 ? 'partial' : 'construction',
    },
    {
      key: 'bim',
      name: 'BIM and 3D packages',
      output: 'IFC / CityJSON / 3D Tiles posture',
      count: bimCount,
      endpoint: '/api/live/current/bim-layers',
      coverage: 'Asset package metadata linked to the city inventory and municipal validation surface.',
      next: 'Replace the broken 3D route with a standards-native 3D streaming adapter.',
      status: bimCount > 0 ? 'partial' : 'construction',
    },
    {
      key: 'jsonld',
      name: 'JSON-LD contexts',
      output: 'Context documents',
      count: 2,
      endpoint: '/api/live/current/standards/context/dcat',
      coverage: 'DCAT and NGSI-LD context aliases used by standards exports.',
      next: 'Publish immutable, versioned context URLs for external consumers.',
      status: 'ready',
    },
    {
      key: 'openapi',
      name: 'OpenAPI explorer',
      output: 'Browsable API contract',
      count: 0,
      endpoint: 'Not published yet',
      coverage: 'Planned self-test surface for city APIs, versions, examples, and access scopes.',
      next: 'Generate OpenAPI 3.1 and expose an API explorer before city handoff.',
      status: 'blocked',
    },
  ]
}

export function ldtStateVariant(state) {
  const value = String(state ?? '').toLowerCase()
  if (value === 'authority-approved') return 'success'
  if (value === 'federated') return 'primary'
  if (value === 'validated') return 'info'
  if (value === 'generated') return 'warning'
  if (value === 'implemented') return 'dark'
  return 'secondary'
}

export const ldtStateDefinitions = [
  {
    key: 'implemented',
    label: 'Implemented',
    rule: 'The platform has code, route wiring, schema, or a model for the capability, but the active city may not have generated evidence yet.',
    evidence: 'Source code, API contract, registry entry, or configured module.',
  },
  {
    key: 'generated',
    label: 'Generated',
    rule: 'The active city produced a dataset, artifact, projection, endpoint payload, or workflow output.',
    evidence: 'Runtime counts, registered artifacts, endpoint response, workflow run, or database rows.',
  },
  {
    key: 'validated',
    label: 'Validated',
    rule: 'The generated output passed a repeatable smoke, conformance check, checksum, quality gate, or operator review form.',
    evidence: 'Named test case, quality-gate result, checksum, schema validation, or review record.',
  },
  {
    key: 'federated',
    label: 'Federated',
    rule: 'The output is proven to interoperate with an external standard runtime, broker, catalog, or data-space integration.',
    evidence: 'Broker sync, external catalog publication, OGC/DCAT/NGSI-LD conformance result, or federation job.',
  },
  {
    key: 'authority-approved',
    label: 'Authority-approved',
    rule: 'A city authority, accountable operator, or project owner has formally approved the data, state, or publication posture.',
    evidence: 'Approval record, signed form, official source note, or restricted governance artifact.',
  },
]

export function buildLdtComplianceRows({ counts, layerCapabilities, openApiDocument }) {
  const layerSummary = layerCapabilities?.summary ?? {}
  const standards = buildStandardsRows({ counts, layerCapabilities })
  const hasOpenApi = Boolean(openApiDocument?.openapi)
  const openApiPathCount = Object.keys(openApiDocument?.paths ?? {}).length
  return [
    {
      key: 'dcat-catalog',
      kind: 'Capability',
      domain: 'Data catalog',
      standard: 'DCAT JSON-LD',
      euMapping: 'Dataset discoverability for Local Digital Twin data spaces and public handoff.',
      currentState: Number(counts.datasets ?? 0) > 0 ? 'generated' : 'implemented',
      evidence: `${formatCount(counts.datasets)} catalog datasets`,
      qualityGate: 'DCAT endpoint returns JSON-LD, every distribution has source, license, format, city, version, and visibility class.',
      visibility: 'Public metadata by default; restricted distributions allowed per deployment policy.',
      endpoint: '/api/live/current/standards/dcat',
      next: 'Add versioned distributions, access policy classes, and catalog smoke coverage.',
    },
    {
      key: 'ogc-features',
      kind: 'Capability',
      domain: 'Geospatial API',
      standard: 'OGC API Features',
      euMapping: 'Standards-native spatial access for city objects and source layers.',
      currentState: Number(counts.ogcCollections ?? 0) > 0 ? 'generated' : 'implemented',
      evidence: `${formatCount(counts.ogcCollections)} feature collections`,
      qualityGate: 'Collections, items, bbox, pagination, CRS posture, and non-empty sample queries pass contract tests.',
      visibility: 'Public for open-data collections; internal for sensitive provider layers.',
      endpoint: '/api/live/current/standards/ogc/collections',
      next: 'Add formal conformance assertions, examples, and pagination smoke coverage.',
    },
    {
      key: 'ngsi-ld',
      kind: 'Capability',
      domain: 'Context data',
      standard: 'NGSI-LD / FIWARE',
      euMapping: 'Context broker projection for LDT federation and smart-city app reuse.',
      currentState: Number(counts.ngsiProjections ?? 0) > 0 ? 'generated' : 'implemented',
      evidence: `${formatCount(counts.ngsiProjections)} context projections`,
      qualityGate: 'Entity ids, @context, properties, relationships, observedAt, source metadata, and sample import validate against a broker profile.',
      visibility: 'Internal until broker sync and publication rules are reviewed.',
      endpoint: '/api/live/current/standards/ngsi-ld/entities?limit=25',
      next: 'Connect an Orion-LD or Scorpio broker profile before claiming federation.',
    },
    {
      key: 'json-ld',
      kind: 'Capability',
      domain: 'Semantic context',
      standard: 'JSON-LD contexts',
      euMapping: 'Linked-data semantics for catalog and context payloads.',
      currentState: standards.find((row) => row.key === 'jsonld')?.status === 'ready' ? 'generated' : 'implemented',
      evidence: 'DCAT and NGSI-LD context aliases',
      qualityGate: 'Context URLs are stable, versioned, dereferenceable, and used consistently by DCAT and NGSI-LD exports.',
      visibility: 'Public when vocabulary ownership is stable.',
      endpoint: '/api/live/current/standards/context/dcat',
      next: 'Publish immutable context URLs and align external vocabulary ownership.',
    },
    {
      key: 'openapi',
      kind: 'Capability',
      domain: 'API contract',
      standard: 'OpenAPI 3.1',
      euMapping: 'Machine-readable API contract for integrators and public handoff.',
      currentState: hasOpenApi ? 'generated' : 'implemented',
      evidence: hasOpenApi ? `${formatCount(openApiPathCount)} documented paths` : 'Runtime endpoint planned or unavailable',
      qualityGate: 'OpenAPI document validates, covers public routes, includes examples, and route smoke tests prove advertised endpoints.',
      visibility: 'Public for open APIs; internal for admin/operator routes.',
      endpoint: '/api/live/current/openapi.json',
      next: 'Expose explorer, examples, and route-level smoke validation.',
    },
    {
      key: 'viewer-artifacts',
      kind: 'Capability',
      domain: 'Viewer delivery',
      standard: 'MVT / PMTiles / 3D Tiles',
      euMapping: 'Efficient spatial delivery for map, 3D, and XR city surfaces.',
      currentState: Number(layerSummary.vectorTileLayerCount ?? 0) > 0 ? 'generated' : 'implemented',
      evidence: `${formatCount(layerSummary.vectorTileLayerCount)} vector tile layers`,
      qualityGate: 'MVT, PMTiles, and 3D Tiles artifacts are registered with checksum, version, active flag, URI, and smoke-tested reachability.',
      visibility: 'Public or internal by artifact policy; raw source files remain controlled.',
      endpoint: '/api/live/current/layer-capabilities',
      next: 'Use the artifact registry as the single release ledger for viewer packages.',
    },
    {
      key: 'mims-plus',
      kind: 'Assessment',
      domain: 'EU interoperability',
      standard: 'MIMs Plus',
      euMapping: 'Minimal interoperability mechanisms: APIs, data models, marketplaces, and portability.',
      currentState: 'implemented',
      evidence: 'Readiness model, standards endpoints, and state ladder are represented in the product.',
      qualityGate: 'A scored MIMs checklist links every claim to API, data-model, marketplace, or portability evidence.',
      visibility: 'Public summary; detailed evidence may be internal in production.',
      endpoint: '/operations/compliance',
      next: 'Turn the mapping into a scored checklist with evidence links and exceptions.',
    },
    {
      key: 'lordimas',
      kind: 'Assessment',
      domain: 'EU digital maturity',
      standard: 'LORDIMAS',
      euMapping: 'Municipal digital maturity posture for governance, services, data, and interoperability.',
      currentState: 'implemented',
      evidence: 'Assessment placeholder with lifecycle states and authority-review boundary.',
      qualityGate: 'Operator fills review fields, attaches evidence, records reviewer, date, scope, and publication visibility.',
      visibility: 'Internal by default; public only when the city approves publication.',
      endpoint: '/operations/compliance',
      next: 'Add review forms and keep authority-approved separate from automated validation.',
    },
    {
      key: 'fiware-federation',
      kind: 'Assessment',
      domain: 'Federation readiness',
      standard: 'FIWARE broker readiness',
      euMapping: 'Practical readiness for Orion-LD or Scorpio context-broker operation.',
      currentState: 'implemented',
      evidence: 'NGSI-LD projections exist as product capability; no live broker sync is claimed here.',
      qualityGate: 'Sample entities import into a broker, update, query, and round-trip source metadata without losing geometry or semantics.',
      visibility: 'Internal until a deployment chooses a broker and data-sharing policy.',
      endpoint: '/api/live/current/standards/ngsi-ld/entities?limit=25',
      next: 'Add broker profile configuration and sync-job evidence before using federated state.',
    },
  ]
}

function moduleIcon(key) {
  const icons = {
    baseInventory: Database,
    catalog: Archive,
    provenance: GitBranch,
    interop: Globe,
    fiware: Server,
    viewerAggregates: Map,
    urbanScience: BarChart2,
    societyCulture: Activity,
    semanticPacks: Zap,
    providerLayers: Layers,
    agenticWorkflows: Sliders,
    apiObservability: Shield,
  }
  return icons[key] ?? Box
}

export function buildPrimaryIndicators(payload) {
  const counts = payload?.counts ?? {}
  const entityCounts = payload?.entityCounts ?? {}
  const sourceLayerCounts = payload?.sourceLayerCounts ?? {}
  return [
    {
      label: 'City inventory',
      value: formatCount(counts.entities),
      detail: `${formatCount(entityCounts.building)} buildings, ${formatCount(entityCounts.road)} roads`,
      status: 'Consolidated base',
    },
    {
      label: 'Source evidence',
      value: formatCount(counts.sourceFeatures),
      detail: `${formatCount(counts.datasets)} catalog datasets, ${formatCount(Object.keys(sourceLayerCounts).length)} source layers`,
      status: 'Open-data trace',
    },
    {
      label: 'Standards outputs',
      value: formatCount(counts.ngsiProjections),
      detail: `${formatCount(counts.ogcCollections)} OGC collections, DCAT and NGSI-LD available`,
      status: 'LDT interop',
    },
    {
      label: 'Analysis records',
      value: formatCount(Number(counts.scienceObservations ?? 0) + Number(counts.societyObservations ?? 0)),
      detail: `${formatCount(counts.semanticIndicators)} semantic indicators and ${formatCount(counts.densityCells)} density cells`,
      status: 'Analyst layer',
    },
  ]
}

export function buildModuleRows(payload) {
  return Object.entries(payload?.modules ?? {}).map(([key, available]) => {
    const Icon = moduleIcon(key)
    return {
      key,
      label: titleize(key),
      available: Boolean(available),
      Icon,
    }
  })
}

export const cityModuleTabs = [
  {
    key: 'overview',
    label: 'Overview',
    domain: 'workspace',
    domainLabel: 'Workspace',
    description: 'Readiness, open gaps, and product-level city twin state.',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    domain: 'data-factory',
    domainLabel: 'Data factory',
    description: 'Consolidated entities, runtime layers, source evidence, and readiness.',
  },
  {
    key: 'sources',
    label: 'Sources',
    domain: 'data-factory',
    domainLabel: 'Data factory',
    description: 'Open datasets, provenance, licenses, and evidence flow.',
  },
  {
    key: 'standards',
    label: 'Standards',
    domain: 'data-factory',
    domainLabel: 'Data factory',
    description: 'DCAT, OGC, NGSI-LD, FIWARE, vector delivery, and API handoff outputs.',
  },
  {
    key: 'analysis',
    label: 'Science + society',
    domain: 'city-analysis',
    domainLabel: 'City analysis',
    description: 'Urban science indicators, social/economic/cultural signals, and model caveats.',
  },
  {
    key: 'semantic',
    label: 'Semantic packs',
    domain: 'city-analysis',
    domainLabel: 'City analysis',
    description: 'Domain packs, rules, service indicators, workflows, and authority boundaries.',
  },
]

export const workspaceDomainGroups = [
  {
    key: 'workspace',
    label: 'Workspace',
    summary: 'Control room',
  },
  {
    key: 'data-factory',
    label: 'Data factory',
    summary: 'Inventory, sources, standards, artifacts',
  },
  {
    key: 'city-analysis',
    label: 'City analysis',
    summary: 'Models, indicators, semantic services',
  },
]

export const operationViewTabs = [
  { key: 'overview', label: 'Overview', href: '/operations' },
  { key: 'apis', label: 'APIs', href: '/operations/apis' },
  { key: 'telemetry', label: 'Telemetry', href: '/operations/telemetry' },
  { key: 'ingestion', label: 'Data Factory', href: '/operations/ingestion' },
  { key: 'eu-ldt', label: 'EU LDT', href: '/operations/eu-ldt' },
  { key: 'workflows', label: 'Workflows', href: '/operations/workflows' },
  { key: 'compliance', label: 'LDT Compliance', href: '/operations/compliance' },
]

export const visualSurfaces = [
  {
    title: 'Analytical Map',
    href: '/analytical-map',
    status: 'ready',
    summary: 'Map module with its own city coverage, layer, selection, and source-context controls.',
  },
  {
    title: 'City 3D',
    href: '/city-3d',
    status: 'construction',
    summary: 'Cesium spatial inspection surface for query-scoped objects, BIM anchors, and attached provider evidence.',
  },
  {
    title: 'Civic XR',
    href: '/civic-xr',
    status: 'construction',
    summary: 'Open browser XR surface for public-safe city context and stakeholder review.',
  },
]
