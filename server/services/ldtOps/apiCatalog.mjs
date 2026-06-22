const API_CATALOG = [
  {
    key: 'capability-contract',
    family: 'capabilities',
    method: 'GET',
    path: '/api/live/current/capabilities',
    standard: 'LDT capability contract',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Single-city readiness, module state, counts, workflows, and product capability posture.',
  },
  {
    key: 'operations-report',
    family: 'operations',
    method: 'GET',
    path: '/api/live/current/operations/report',
    standard: 'LDT operations contract',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'API catalog, usage events, ingestion jobs, workflows, approvals, and operational readiness.',
  },
  {
    key: 'operations-metrics-summary',
    family: 'operations',
    method: 'GET',
    path: '/api/live/current/operations/metrics-summary',
    standard: 'LDT lightweight observability',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Core JSON metrics for API traffic, ingestion, workflows, and city inventory without requiring Grafana or Prometheus.',
  },
  {
    key: 'layer-capabilities',
    family: 'inventory',
    method: 'GET',
    path: '/api/live/current/layer-capabilities',
    standard: 'LDT layer capability contract',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Published city layers, source posture, authority state, and viewer availability.',
  },
  {
    key: 'dcat-catalog',
    family: 'standards',
    method: 'GET',
    path: '/api/live/current/standards/dcat',
    standard: 'DCAT',
    version: '3-compatible',
    access: 'city-session',
    state: 'ready',
    purpose: 'Dataset catalog publication for open-data discovery and evidence review.',
  },
  {
    key: 'ngsi-ld-entities',
    family: 'standards',
    method: 'GET',
    path: '/api/live/current/standards/ngsi-ld/entities?limit=25',
    standard: 'NGSI-LD / FIWARE',
    version: '1.6-compatible',
    access: 'city-session',
    state: 'ready',
    purpose: 'Context-entity projection for FIWARE-compatible consumers.',
  },
  {
    key: 'ogc-landing',
    family: 'standards',
    method: 'GET',
    path: '/api/live/current/standards/ogc',
    standard: 'OGC API - Features',
    version: 'part-1',
    access: 'city-session',
    state: 'ready',
    purpose: 'OGC landing document for feature collections.',
  },
  {
    key: 'ogc-collections',
    family: 'standards',
    method: 'GET',
    path: '/api/live/current/standards/ogc/collections',
    standard: 'OGC API - Features',
    version: 'part-1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Collection index for standards-native city features.',
  },
  {
    key: 'urban-science',
    family: 'analysis',
    method: 'GET',
    path: '/api/live/current/science/urban-report',
    standard: 'Urban science core',
    version: '0.1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Scientific indicators, model families, formulas, source quality, and caveats.',
  },
  {
    key: 'society-culture',
    family: 'analysis',
    method: 'GET',
    path: '/api/live/current/society/report',
    standard: 'Society and culture core',
    version: '0.1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Aggregate social, economic, service, and cultural observations.',
  },
  {
    key: 'semantic-pack-report',
    family: 'semantic',
    method: 'GET',
    path: '/api/live/current/semantic-packs/reconstruction-service-core/report',
    standard: 'Semantic pack manifest',
    version: '0.1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Semantic-pack binding, indicators, rules, and authority caveats.',
  },
  {
    key: 'density-grid',
    family: 'viewer',
    method: 'GET',
    path: '/api/live/current/density-grid',
    standard: 'LDT viewer aggregate',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Precomputed density cells for city-scale map rendering.',
  },
  {
    key: 'viewer-manifest',
    family: 'viewer',
    method: 'GET',
    path: '/api/live/current/viewer-manifest?surface=map',
    standard: 'LDT visual surface manifest',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Allowed layers, controls, selection scopes, and host commands for map, 3D, or immersive embeds.',
  },
  {
    key: 'semantic-query-contract',
    family: 'viewer',
    method: 'GET',
    path: '/api/live/current/semantic-query-contract?surface=map',
    standard: 'LDT semantic query contract',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Semantic classes, fields, operators, scopes, render modes, and transports shared by map, 3D, and immersive views.',
  },
  {
    key: 'semantic-query',
    family: 'viewer',
    method: 'POST',
    path: '/api/live/current/semantic-query',
    standard: 'LDT semantic query execution',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Execute a class, scope, filter, and render query against the current city inventory and record usage intent.',
  },
  {
    key: 'twin-query-contract',
    family: 'viewer',
    method: 'GET',
    path: '/api/live/current/twin-query-contract',
    standard: 'LDT TwinQL/CQL2 query contract',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'SQL-grade read-only semantic query contract over the canonical PostGIS city-object inventory.',
  },
  {
    key: 'twin-query-events',
    family: 'viewer',
    method: 'GET',
    path: '/api/live/current/twin-query-events?surface=map&limit=10',
    standard: 'LDT TwinQL/CQL2 query telemetry',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Recent TwinQL/CQL2 visual query executions for replay, audit, and demand observability.',
  },
  {
    key: 'twin-query',
    family: 'viewer',
    method: 'POST',
    path: '/api/live/current/twin-query',
    standard: 'LDT TwinQL/CQL2 query execution',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Execute allowlisted TwinQL/CQL2 JSON predicates and multi-clause unions against ldt_query.city_objects.',
  },
  {
    key: 'twin-query-tiles',
    family: 'viewer',
    method: 'GET',
    path: '/api/live/current/twin-query-tiles/:z/:x/:y.mvt?query={encodedTwinQuery}',
    standard: 'LDT TwinQL/CQL2 vector-tile query execution',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Stream large TwinQL/CQL2 visual query results as predicate-aware Mapbox Vector Tiles.',
  },
  {
    key: 'selection-units',
    family: 'viewer',
    method: 'GET',
    path: '/api/live/current/selection-units?scope=available',
    standard: 'LDT viewer selection contract',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Available city, grid, and future district/block/custom selection units for viewer surfaces.',
  },
  {
    key: 'selection-summary',
    family: 'viewer',
    method: 'GET',
    path: '/api/live/current/selection-summary?scope=city',
    standard: 'LDT selected-area summary',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Counts, evidence, authority posture, and derived indicators for a selected city area.',
  },
  {
    key: 'workflow-definitions',
    family: 'workflows',
    method: 'GET',
    path: '/api/admin/workflows',
    standard: 'Controlled workflow contract',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'Agentic and operator workflow definitions with input/output contracts.',
  },
  {
    key: 'workflow-runs',
    family: 'workflows',
    method: 'GET',
    path: '/api/admin/workflow-runs?cityId=current',
    standard: 'Controlled workflow contract',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'Workflow execution history, approvals, steps, and artifacts.',
  },
  {
    key: 'workflow-run-create',
    family: 'workflows',
    method: 'POST',
    path: '/api/admin/workflows/:workflowKey/runs',
    standard: 'Controlled workflow contract',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'Create an approval-gated workflow run for the active city runtime.',
  },
  {
    key: 'workflow-approval-decision',
    family: 'workflows',
    method: 'POST',
    path: '/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision',
    standard: 'Controlled workflow contract',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'Approve or reject a pending workflow approval checkpoint.',
  },
]

const OPENAPI_TAGS = [
  { name: 'Capabilities', description: 'City capability, readiness, and product-contract endpoints.' },
  { name: 'Operations', description: 'API governance, observability, workflow, and ingestion-control endpoints.' },
  { name: 'Inventory', description: 'City layers, entity inventory, source posture, and viewer capability endpoints.' },
  { name: 'Standards', description: 'DCAT, NGSI-LD/FIWARE, and OGC API Features publication endpoints.' },
  { name: 'Analysis', description: 'Urban science, society/culture, density, and semantic-pack analysis endpoints.' },
  { name: 'Viewer', description: 'Viewer aggregate endpoints for map and visualization surfaces.' },
  { name: 'Workflows', description: 'Controlled admin workflow definitions, runs, approvals, and artifacts.' },
]

function openApiTagForFamily(family) {
  const tags = {
    capabilities: 'Capabilities',
    operations: 'Operations',
    inventory: 'Inventory',
    standards: 'Standards',
    analysis: 'Analysis',
    semantic: 'Analysis',
    viewer: 'Viewer',
    workflows: 'Workflows',
  }
  return tags[family] ?? 'Operations'
}

function openApiOperationId(entry) {
  return entry.key
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part, index) => {
      const lower = part.toLowerCase()
      if (index === 0) return lower
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
    })
    .join('')
}

function openApiPathAndParameters(entry) {
  const [pathname, queryString] = String(entry.path).split('?')
  const parameters = []
  if (queryString) {
    for (const pair of new URLSearchParams(queryString)) {
      parameters.push({
        name: pair[0],
        in: 'query',
        required: false,
        schema: { type: 'string', default: pair[1] },
      })
    }
  }
  for (const match of pathname.matchAll(/:([a-zA-Z0-9_]+)/g)) {
    parameters.push({
      name: match[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    })
  }
  return {
    pathname: pathname.replace(/:([a-zA-Z0-9_]+)/g, '{$1}'),
    parameters,
  }
}

function openApiResponseSchema(entry) {
  if (entry.key === 'operations-report') {
    return { $ref: '#/components/schemas/OperationsReport' }
  }
  if (entry.key === 'operations-metrics-summary') {
    return { $ref: '#/components/schemas/MetricsSummary' }
  }
  if (entry.key === 'capability-contract') {
    return { $ref: '#/components/schemas/CapabilityContract' }
  }
  return { $ref: '#/components/schemas/JsonDocument' }
}

function openApiResponseContent(entry) {
  if (entry.key === 'twin-query-tiles') {
    return {
      'application/vnd.mapbox-vector-tile': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    }
  }
  return {
    'application/json': {
      schema: openApiResponseSchema(entry),
    },
  }
}

function openApiRequestBody(entry) {
  if (entry.key === 'workflow-run-create') {
    return {
      required: false,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/WorkflowRunCreateRequest' },
          examples: {
            currentCityDryRun: {
              value: {
                cityId: 'current',
                triggerKind: 'manual',
                input: {
                  scope: 'standards-publication-refresh',
                  dryRun: true,
                },
              },
            },
          },
        },
      },
    }
  }
  if (entry.key === 'workflow-approval-decision') {
    return {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/WorkflowApprovalDecisionRequest' },
          examples: {
            approve: {
              value: {
                decision: 'approved',
                reason: 'Reviewed against the current city data contract.',
              },
            },
          },
        },
      },
    }
  }
  if (entry.key === 'semantic-query') {
    return {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/SemanticQueryRequest' },
          examples: {
            tallBuildingsInRadius: {
              value: {
                surface: 'map',
                intent: 'analysis',
                classes: ['buildings'],
                scope: {
                  key: 'radius',
                  center: [36.2304, 49.9935],
                  radiusMeters: 1000,
                },
                filters: [
                  { field: 'heightMeters', operator: 'gte', value: 10 },
                ],
                render: {
                  mode: 'isolate',
                  maxFeatures: 5000,
                },
              },
            },
          },
        },
      },
    }
  }
  if (entry.key === 'twin-query') {
    return {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/TwinQueryRequest' },
          examples: {
            centralBuildingsAndArterialRoads: {
              value: {
                language: 'twinql-json',
                operation: 'union',
                clauses: [
                  {
                    id: 'central-buildings',
                    label: 'Central buildings',
                    classes: ['buildings'],
                    scope: {
                      key: 'radius',
                      center: [36.2304, 49.9935],
                      radiusMeters: 2500,
                    },
                  },
                  {
                    id: 'arterial-roads',
                    label: 'Arterial roads',
                    classes: ['roads'],
                    scope: {
                      key: 'radius',
                      center: [36.2304, 49.9935],
                      radiusMeters: 5000,
                    },
                    where: {
                      field: 'road_class',
                      operator: 'in',
                      value: ['primary', 'secondary', 'tertiary'],
                    },
                  },
                ],
                render: {
                  mode: 'isolate',
                  maxFeatures: 12000,
                },
              },
            },
          },
        },
      },
    }
  }
  return null
}

function liveVersionedPath(pathname) {
  if (pathname.startsWith('/api/live/')) {
    return pathname.replace('/api/live/', '/api/live/v1/')
  }
  return null
}

function buildOpenApiPaths(catalog) {
  return catalog.reduce((paths, entry) => {
    const { pathname, parameters } = openApiPathAndParameters(entry)
    const method = String(entry.method ?? 'GET').toLowerCase()
    const requestBody = openApiRequestBody(entry)
    const operation = {
      tags: [openApiTagForFamily(entry.family)],
      operationId: openApiOperationId(entry),
      summary: entry.standard,
      description: entry.purpose,
      parameters,
      security: entry.access === 'city-session' || entry.access === 'admin-session'
        ? [{ cookieSession: [] }]
        : [],
      responses: {
        200: {
          description: `${entry.standard} response`,
          content: openApiResponseContent(entry),
        },
        401: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        403: {
          description: 'Access denied',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        502: {
          description: 'Upstream city data unavailable',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
      ...(requestBody ? { requestBody } : {}),
    }
    paths[pathname] = {
      ...(paths[pathname] ?? {}),
      [method]: operation,
    }
    const versionedPath = liveVersionedPath(pathname)
    if (versionedPath) {
      paths[versionedPath] = {
        ...(paths[versionedPath] ?? {}),
        [method]: {
          ...operation,
          operationId: `${operation.operationId}V1Alias`,
          description: `${operation.description} Versioned live API alias for clients that require stable v1 URLs.`,
          'x-alias-for': pathname,
        },
      }
    }
    return paths
  }, {})
}

function catalogRow(row) {
  const [pathname, queryString] = String(row.path).split('?')
  const versionedPath = liveVersionedPath(pathname)
  return {
    ...row,
    versionedPath: versionedPath ? `${versionedPath}${queryString ? `?${queryString}` : ''}` : null,
    testHref: row.method === 'GET' && row.access === 'city-session' ? row.path : null,
  }
}

export function getCityOpenApiDocument({ cityId = 'current', baseUrl = '' } = {}) {
  const catalog = API_CATALOG.map(catalogRow)
  return {
    openapi: '3.1.0',
    info: {
      title: 'Twin Base Studio City API',
      summary: 'Single-city Local Digital Twin API contract for open-data city inventory, standards publication, analysis, semantic packs, workflows, and operations.',
      version: '0.1.0',
    },
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    servers: [
      {
        url: baseUrl || '/',
        description: `Active city deployment (${cityId})`,
      },
    ],
    tags: OPENAPI_TAGS,
    'x-city-id': cityId,
    'x-product-posture': 'single-city-open-source-runtime',
    paths: buildOpenApiPaths(catalog),
    components: {
      securitySchemes: {
        cookieSession: {
          type: 'apiKey',
          in: 'cookie',
          name: 'twin_base_session',
          description: 'Authenticated city workspace session cookie.',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            detail: { type: 'string' },
          },
          required: ['error'],
        },
        JsonDocument: {
          type: 'object',
          additionalProperties: true,
        },
        CapabilityContract: {
          type: 'object',
          properties: {
            configured: { type: 'boolean' },
            ok: { type: 'boolean' },
            cityId: { type: 'string' },
            generatedAt: { type: 'string', format: 'date-time' },
            readiness: { type: 'string' },
            counts: { type: 'object', additionalProperties: { type: 'integer' } },
            modules: { type: 'object', additionalProperties: { type: 'boolean' } },
            readinessChecks: {
              type: 'array',
              items: { $ref: '#/components/schemas/ReadinessCheck' },
            },
          },
          required: ['configured', 'ok', 'cityId'],
          additionalProperties: true,
        },
        OperationsReport: {
          type: 'object',
          properties: {
            configured: { type: 'boolean' },
            ok: { type: 'boolean' },
            cityId: { type: 'string' },
            generatedAt: { type: 'string', format: 'date-time' },
            counts: { type: 'object', additionalProperties: { type: 'integer' } },
            apiCatalog: {
              type: 'array',
              items: { $ref: '#/components/schemas/ApiCatalogEntry' },
            },
            apiUsageSummary: {
              type: 'array',
              items: { $ref: '#/components/schemas/ApiUsageSummary' },
            },
            ingestionJobs: {
              type: 'array',
              items: { $ref: '#/components/schemas/IngestionJob' },
            },
            workflowRuns: {
              type: 'array',
              items: { type: 'object', additionalProperties: true },
            },
            pendingApprovals: {
              type: 'array',
              items: { type: 'object', additionalProperties: true },
            },
          },
          required: ['configured', 'ok', 'cityId', 'apiCatalog'],
          additionalProperties: true,
        },
        MetricsSummary: {
          type: 'object',
          properties: {
            configured: { type: 'boolean' },
            ok: { type: 'boolean' },
            cityId: { type: 'string' },
            generatedAt: { type: 'string', format: 'date-time' },
            posture: { type: 'object', additionalProperties: true },
            api: { type: 'object', additionalProperties: true },
            ingestion: { type: 'object', additionalProperties: true },
            workflows: { type: 'object', additionalProperties: true },
            inventory: { type: 'object', additionalProperties: true },
            readiness: {
              type: 'array',
              items: { type: 'object', additionalProperties: true },
            },
          },
          required: ['configured', 'ok', 'cityId', 'posture', 'api'],
          additionalProperties: true,
        },
        SemanticQueryRequest: {
          type: 'object',
          properties: {
            surface: {
              type: 'string',
              enum: ['map', 'municipal3d', 'immersive', 'api'],
            },
            intent: {
              type: 'string',
              enum: ['inspection', 'analysis', 'simulation', 'operations', 'embed', 'export', 'unknown'],
            },
            classes: {
              type: 'array',
              items: { type: 'string' },
            },
            scope: {
              type: 'object',
              properties: {
                key: {
                  type: 'string',
                  enum: ['city', 'viewport', 'radius', 'customPolygon'],
                },
                mode: {
                  type: 'string',
                  enum: ['city', 'viewport', 'radius', 'customPolygon'],
                  description: 'Viewer alias normalized to scope.key.',
                },
                type: {
                  type: 'string',
                  enum: ['city', 'viewport', 'radius', 'customPolygon'],
                  description: 'Viewer alias normalized to scope.key.',
                },
                center: {
                  type: 'array',
                  items: { type: 'number' },
                  minItems: 2,
                  maxItems: 2,
                },
                radiusMeters: { type: 'number' },
                bbox: {
                  type: 'array',
                  items: { type: 'number' },
                  minItems: 4,
                  maxItems: 4,
                },
                geometry: { type: 'object', additionalProperties: true },
              },
              required: ['key'],
              additionalProperties: true,
            },
            filters: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  operator: {
                    type: 'string',
                    enum: ['eq', 'neq', 'in', 'contains', 'gte', 'lte', 'between', 'exists'],
                  },
                  value: {},
                },
                required: ['field', 'operator'],
                additionalProperties: true,
              },
            },
            combine: {
              type: 'string',
              enum: ['and', 'or'],
            },
            render: {
              type: 'object',
              properties: {
                mode: {
                  type: 'string',
                  enum: ['show', 'isolate', 'count', 'inspect'],
                },
                maxFeatures: { type: 'integer' },
              },
              additionalProperties: true,
            },
          },
          required: ['classes', 'scope'],
          additionalProperties: true,
        },
        TwinQueryPredicate: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            operator: {
              type: 'string',
              enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'between', 'exists'],
            },
            value: {},
          },
          required: ['field', 'operator'],
          additionalProperties: true,
        },
        TwinQueryExpression: {
          type: 'object',
          properties: {
            op: {
              type: 'string',
              enum: ['and', 'or', 'not', '=', '==', '!=', '<>', '>', '>=', '<', '<=', 'in', 'between', 'like', 'ilike', 'isNull', 'isNotNull', 'exists'],
            },
            args: {
              type: 'array',
              items: {},
            },
            field: { type: 'string' },
            operator: { type: 'string' },
            value: {},
          },
          additionalProperties: true,
        },
        TwinQueryScope: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              enum: ['city', 'radius', 'viewport', 'customPolygon'],
            },
            center: {
              type: 'array',
              items: { type: 'number' },
              minItems: 2,
              maxItems: 2,
            },
            radiusMeters: { type: 'number' },
            bbox: {
              type: 'array',
              items: { type: 'number' },
              minItems: 4,
              maxItems: 4,
            },
            geometry: { type: 'object', additionalProperties: true },
          },
          required: ['key'],
          additionalProperties: true,
        },
        TwinQueryClause: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            classes: {
              type: 'array',
              items: { type: 'string' },
            },
            scope: { $ref: '#/components/schemas/TwinQueryScope' },
            where: {
              oneOf: [
                { $ref: '#/components/schemas/TwinQueryPredicate' },
                { $ref: '#/components/schemas/TwinQueryExpression' },
              ],
            },
          },
          required: ['classes', 'scope'],
          additionalProperties: true,
        },
        TwinQueryRequest: {
          type: 'object',
          properties: {
            language: {
              type: 'string',
              enum: ['twinql-json', 'cql2-json'],
            },
            operation: {
              type: 'string',
              enum: ['union'],
            },
            classes: {
              type: 'array',
              items: { type: 'string' },
            },
            scope: { $ref: '#/components/schemas/TwinQueryScope' },
            where: {
              oneOf: [
                { $ref: '#/components/schemas/TwinQueryPredicate' },
                { $ref: '#/components/schemas/TwinQueryExpression' },
              ],
            },
            clauses: {
              type: 'array',
              maxItems: 8,
              items: { $ref: '#/components/schemas/TwinQueryClause' },
            },
            render: {
              type: 'object',
              properties: {
                mode: {
                  type: 'string',
                  enum: ['count', 'isolate', 'highlight', 'table'],
                },
                maxFeatures: { type: 'integer' },
              },
              additionalProperties: true,
            },
          },
          additionalProperties: true,
        },
        ReadinessCheck: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            label: { type: 'string' },
            category: { type: 'string' },
            status: { type: 'string' },
            summary: { type: 'string' },
            evidence: { type: 'object', additionalProperties: true },
            action: { type: ['string', 'null'] },
          },
          additionalProperties: true,
        },
        ApiCatalogEntry: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            family: { type: 'string' },
            method: { type: 'string' },
            path: { type: 'string' },
            standard: { type: 'string' },
            version: { type: 'string' },
            access: { type: 'string' },
            state: { type: 'string' },
            purpose: { type: 'string' },
            versionedPath: { type: ['string', 'null'] },
            testHref: { type: ['string', 'null'] },
          },
          required: ['key', 'family', 'method', 'path'],
          additionalProperties: true,
        },
        ApiUsageSummary: {
          type: 'object',
          properties: {
            routeFamily: { type: 'string' },
            method: { type: 'string' },
            pathTemplate: { type: 'string' },
            events: { type: 'integer' },
            errors: { type: 'integer' },
            lastStatusCode: { type: 'integer' },
            avgLatencyMs: { type: ['number', 'null'] },
            lastSeenAt: { type: ['string', 'null'], format: 'date-time' },
          },
          additionalProperties: true,
        },
        IngestionJob: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            jobKind: { type: 'string' },
            requestedAction: { type: ['string', 'null'] },
            sourceFormat: { type: 'string' },
            status: { type: 'string' },
            attemptCount: { type: 'integer' },
            providerName: { type: ['string', 'null'] },
            layerKey: { type: ['string', 'null'] },
            layerName: { type: ['string', 'null'] },
            validationReports: { type: 'integer' },
            updatedAt: { type: ['string', 'null'], format: 'date-time' },
          },
          additionalProperties: true,
        },
        WorkflowRunCreateRequest: {
          type: 'object',
          properties: {
            cityId: {
              type: 'string',
              description: 'City id or current for the active city.',
              examples: ['current', 'kharkiv'],
            },
            triggerKind: {
              type: 'string',
              enum: ['manual', 'agent', 'schedule', 'api'],
              default: 'manual',
            },
            input: {
              type: 'object',
              additionalProperties: true,
              description: 'Workflow-specific input payload.',
            },
          },
          additionalProperties: true,
        },
        WorkflowApprovalDecisionRequest: {
          type: 'object',
          properties: {
            decision: {
              type: 'string',
              enum: ['approved', 'rejected'],
            },
            reason: { type: 'string' },
          },
          required: ['decision'],
          additionalProperties: false,
        },
      },
    },
  }
}

export {
  API_CATALOG,
  catalogRow,
}
