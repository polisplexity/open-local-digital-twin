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
    key: 'model-output-csv',
    family: 'standards',
    method: 'GET',
    path: '/api/live/current/standards/model-outputs.csv?modelKey=eu-ldt-ecobuild&modelVersion=code-europa-bb710aa-simulated',
    standard: 'Model-output CSV',
    version: '0.1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Tabular export of derived model outputs attached to canonical city entities.',
  },
  {
    key: 'indicator-catalogs',
    family: 'standards',
    method: 'GET',
    path: '/api/live/current/standards/indicator-catalogs',
    standard: 'OLDT indicator compatibility',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Versioned indicator catalogs, current governed values, evidence requirements, and per-city readiness results.',
  },
  {
    key: 'indicator-entity-values',
    family: 'analysis',
    method: 'GET',
    path: '/api/live/current/standards/indicators/:indicatorKey/entity-values?comparison=gte&value=0',
    standard: 'OLDT governed indicator query',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Threshold query over current validated entity indicator values inside the active municipal boundary.',
  },
  {
    key: 'indicator-thresholds',
    family: 'analysis',
    method: 'GET',
    path: '/api/live/current/standards/indicator-thresholds',
    standard: 'OLDT governed indicator query',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Reusable city-specific threshold profiles for indicator-driven analytical queries.',
  },
  {
    key: 'subject-query-contract',
    family: 'analysis',
    method: 'GET',
    path: '/api/live/current/subject-query-contract',
    standard: 'OLDT contextual subject query',
    version: '2026-07-12',
    access: 'city-session',
    state: 'ready',
    purpose: 'Queryable contextual subject types, governed indicator measures, typed relations, renderer capabilities, and privacy guarantees.',
  },
  {
    key: 'subject-query',
    family: 'analysis',
    method: 'POST',
    path: '/api/live/current/subject-query',
    standard: 'OLDT contextual subject query',
    version: '2026-07-12',
    access: 'city-session',
    state: 'ready',
    purpose: 'Query city, contextual, or physical subjects at their honest observation grain and return a map/chart/table result manifest.',
  },
  {
    key: 'subject-query-blueprints',
    family: 'analysis',
    method: 'GET|POST',
    path: '/api/live/current/subject-query-blueprints',
    standard: 'OLDT portable semantic question',
    version: '2026-07-12',
    access: 'city-session',
    state: 'ready',
    purpose: 'List or save reusable semantic questions with renderer intent, standard references, portability scope, and city bindings.',
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
    key: 'semantic-pack-catalog',
    family: 'semantic',
    method: 'GET',
    path: '/api/live/current/semantic-packs/catalog',
    standard: 'Semantic pack catalog',
    version: '0.1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Registered semantic-pack definitions available to the active city runtime.',
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
    key: 'entity-semantic-context',
    family: 'semantic',
    method: 'GET',
    path: '/api/live/current/entities/:entityId/semantic-context',
    standard: 'LDT entity semantic context',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Entity-level semantic tags, source evidence, mapping provenance, authority and review states, and related rule checks.',
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
    key: 'analysis-selection-members',
    family: 'analysis',
    method: 'GET',
    path: '/api/live/current/analysis-selections/:selectionId/members?includeSemanticContext=1',
    standard: 'LDT analysis selection member context',
    version: 'v1',
    access: 'city-session',
    state: 'ready',
    purpose: 'Persisted TwinQL/CQL2 selection members with semantic-context links and optional compact PostGIS-backed entity context.',
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
  {
    key: 'data-factory-stage-mode',
    family: 'data-factory',
    method: 'PATCH',
    path: '/api/admin/cities/:cityId/data-factory/stages/:stageKey/execution-mode',
    standard: 'Offline Data Factory contract',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'Persist the operator-selected execution mode for a Data Factory stage.',
  },
  {
    key: 'data-factory-handoff-create',
    family: 'data-factory',
    method: 'POST',
    path: '/api/admin/cities/:cityId/data-factory/offline-handoffs',
    standard: 'Offline Data Factory contract',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'Create an auditable offline Data Factory handoff package for an eligible stage.',
  },
  {
    key: 'data-factory-city-input-package-create',
    family: 'data-factory',
    method: 'POST',
    path: '/api/admin/cities/:cityId/data-factory/city-input-packages',
    standard: 'Data Factory city input package contract',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'Prepare a private restorable PostGIS city input package for a Data Factory processing node and register it as an operational artifact.',
  },
  {
    key: 'data-factory-run-intent',
    family: 'data-factory',
    method: 'POST',
    path: '/api/admin/cities/:cityId/data-factory/runs',
    standard: 'Data Factory execution provider contract',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'Create a canonical Data Factory run intent that binds city, provider, stage, portable city input, artifact transfer policy, promotion policy, and dispatch state.',
  },
  {
    key: 'data-factory-local-run',
    family: 'data-factory',
    method: 'POST',
    path: '/api/admin/cities/:cityId/data-factory/offline-runs',
    standard: 'Offline Data Factory contract',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'Create and process an eligible Data Factory stage with an approved runner profile. The local-process profile executes immediately; the external-worker profile prepares a dispatch package.',
  },
  {
    key: 'data-factory-handoff-run',
    family: 'data-factory',
    method: 'POST',
    path: '/api/admin/cities/:cityId/data-factory/offline-handoffs/:runId/run',
    standard: 'Offline Data Factory contract',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'Process an existing offline Data Factory handoff with an approved runner profile. The local-process profile executes immediately; the external-worker profile prepares a dispatch package.',
  },
  {
    key: 'data-factory-result-import',
    family: 'data-factory',
    method: 'POST',
    path: '/api/admin/cities/:cityId/data-factory/offline-handoffs/:runId/result',
    standard: 'Offline Data Factory contract',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'Import, validate, and promote an offline Data Factory result package. If a dispatch artifact exists, the result must prove the matching dispatch checksum and external executor profile.',
  },
  {
    key: 'data-factory-processing-nodes',
    family: 'data-factory',
    method: 'GET',
    path: '/api/admin/data-factory/processing-nodes',
    standard: 'Data Factory processing node registry',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'List registered same-server, server-to-server, offline, HPC, cloud, and manual Data Factory processing nodes with latest heartbeat posture.',
  },
  {
    key: 'data-factory-processing-node-register',
    family: 'data-factory',
    method: 'POST',
    path: '/api/admin/data-factory/processing-nodes',
    standard: 'Data Factory processing node registry',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'Register or update a Data Factory processing node, optional artifact store, stage bindings, and one-time runtime token.',
  },
  {
    key: 'data-factory-processing-node-admin-heartbeat',
    family: 'data-factory',
    method: 'POST',
    path: '/api/admin/data-factory/processing-nodes/:nodeKey/heartbeats',
    standard: 'Data Factory processing node heartbeat',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'Record a processing-node heartbeat from an admin/operator path for controlled tests and same-server operations.',
  },
  {
    key: 'data-factory-processing-node-runtime-heartbeat',
    family: 'data-factory',
    method: 'POST',
    path: '/api/data-factory/processing-nodes/:nodeKey/heartbeat',
    standard: 'Data Factory processing node heartbeat',
    version: 'v1',
    access: 'node-token',
    state: 'controlled',
    purpose: 'Let a registered Data Factory runtime report doctor status, capabilities, disk/CPU/RAM posture, and running job count using a node token instead of a user session.',
  },
  {
    key: 'data-factory-same-server-sidecar-ensure',
    family: 'data-factory',
    method: 'POST',
    path: '/api/admin/data-factory/providers/same-server-sidecar/ensure',
    standard: 'Data Factory execution provider',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'Register or refresh the same-server Data Factory sidecar provider, write its local Docker Compose command plan, run or record doctor status, and store a heartbeat.',
  },
  {
    key: 'data-factory-pull-dispatch-claim',
    family: 'data-factory',
    method: 'POST',
    path: '/api/data-factory/processing-nodes/:nodeKey/dispatches/claim',
    standard: 'Data Factory server-to-server pull provider',
    version: 'v1',
    access: 'node-token',
    state: 'controlled',
    purpose: 'Let a registered server-to-server-pull node claim one pending external-worker dispatch for an enabled stage binding.',
  },
  {
    key: 'data-factory-pull-dispatch-result',
    family: 'data-factory',
    method: 'POST',
    path: '/api/data-factory/processing-nodes/:nodeKey/dispatches/:dispatchId/result',
    standard: 'Data Factory server-to-server pull provider',
    version: 'v1',
    access: 'node-token',
    state: 'controlled',
    purpose: 'Let a registered server-to-server-pull node submit the result package for a claimed dispatch and have Twin Studio validate/import it.',
  },
  {
    key: 'data-factory-pull-runtime-artifact-bundle',
    family: 'data-factory',
    method: 'POST',
    path: '/api/data-factory/processing-nodes/:nodeKey/dispatches/:dispatchId/artifacts/runtime-bundle',
    standard: 'Data Factory heavy artifact transfer',
    version: 'v1',
    access: 'node-token',
    state: 'controlled',
    purpose: 'Let a registered pull node upload a checksummed runtime artifact bundle containing PMTiles, MVT directories, 3D Tiles, dumps, or other heavy outputs before it submits the result package.',
  },
  {
    key: 'data-factory-artifacts-stage',
    family: 'data-factory',
    method: 'POST',
    path: '/api/admin/data-factory/dispatches/:dispatchId/artifacts/stage',
    standard: 'Data Factory artifact transfer manifest',
    version: 'v1',
    access: 'admin-session',
    state: 'controlled',
    purpose: 'Stage or reference heavy Data Factory artifacts such as PMTiles, MVT directories, 3D Tiles, source extracts, PostGIS dumps, and runtime tarballs through a configured artifact store.',
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
  { name: 'Data Factory', description: 'Offline Data Factory execution-mode, handoff, runner, result-import, and promotion endpoints.' },
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
    'data-factory': 'Data Factory',
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
  if (entry.key === 'model-output-csv') {
    return {
      'text/csv': {
        schema: {
          type: 'string',
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
            sqlWhere: {
              type: 'string',
              description: 'Optional expert read-only SQL WHERE expression for this clause over ldt_query.city_objects as alias co.',
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
              enum: ['twinql-json', 'cql2-json', 'postgis-sql'],
              description: 'Structured TwinQL/CQL2 JSON or expert PostGIS SQL WHERE mode.',
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
            sqlWhere: {
              type: 'string',
              description: 'Expert mode read-only SQL WHERE expression over ldt_query.city_objects as alias co. Full SELECT/JOIN/DDL/DML statements are rejected.',
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
              examples: ['current', 'guanajuato'],
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
