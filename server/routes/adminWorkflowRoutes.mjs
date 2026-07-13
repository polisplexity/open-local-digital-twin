import { requireRateLimit } from '../http/rateLimit.mjs'
import { requireAdmin } from '../services/authService.mjs'
import {
  buildOfflineDataFactoryResultTemplate,
  createOfflineDataFactoryHandoff,
  createDataFactoryRunIntent,
  createWorkflowRun,
  decideWorkflowApproval,
  evaluateCityBoundaryQualityGate,
  executeWorkflowRunOnce,
  createRegisteredCityInputPackage,
  claimServerToServerPullDispatch,
  getEuLdtIntegrationProfile,
  getWorkflowContracts,
  getWorkflowRunTrace,
  getWorkflowSourceContracts,
  getCitySourcePlan,
  getProcessingNode,
  ensureSameServerSidecarProvider,
  repairCityBoundaryFromCurrentGate,
  receiveServerToServerPullRuntimeArtifactBundle,
  listProcessingNodes,
  recordProcessingNodeHeartbeat,
  registerProcessingNode,
  runOfflineDataFactoryJob,
  saveCityDataFactoryExecutionMode,
  saveCitySourcePlanOverride,
  stageDataFactoryArtifactManifest,
  submitServerToServerPullDispatchResult,
  getWorkflowRun,
  importOfflineDataFactoryResult,
  listAgenticWorkflowDefinitions,
  linkCipInitiativeSelection,
  listCipExchangeState,
  listUcsExchangeState,
  listDataSpaceAssetPackages,
  listEuLdtIntegrationProfiles,
  listIndicatorDefinitions,
  importIndicatorCatalog,
  listIndicatorCatalogs,
  listIndicatorThresholdProfiles,
  queryIndicatorEntityValues,
  upsertIndicatorCatalog,
  upsertIndicatorObservation,
  upsertIndicatorThresholdProfile,
  validateIndicatorCatalog,
  upsertIndicatorDefinition,
  computeIndicatorObservation,
  syncCipIndicatorObservations,
  listWorkflowRuns,
  testEuLdtIntegrationProfile,
  upsertEuLdtIntegrationProfile,
  workflowIntakeChecklist,
  workflowManifestFor,
} from '../services/ldtOpsService.mjs'

function requireAdminResponse(request, response) {
  const admin = requireAdmin(request)
  if (!admin) {
    response.status(403).json({ error: 'ADMIN_REQUIRED' })
    return null
  }
  return admin
}

function extractProcessingNodeToken(request) {
  const authorization = String(request.headers.authorization ?? '').trim()
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice('bearer '.length).trim()
  }
  return String(request.headers['x-data-factory-token'] ?? '').trim()
}

export function registerAdminWorkflowRoutes(app) {
  app.get('/api/admin/indicator-catalogs', async (request, response) => {
    try {
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.json(await listIndicatorCatalogs({
        cityId: request.query.cityId ?? request.query.city_id,
        catalogKey: request.query.catalogKey ?? request.query.catalog_key,
        includeDefinitions: request.query.includeDefinitions !== 'false',
      }))
    } catch (error) {
      response.status(400).json({ error: 'INDICATOR_CATALOGS_READ_FAILED', detail: String(error?.message ?? 'UNKNOWN_ERROR') })
    }
  })

  app.post('/api/admin/indicator-catalogs', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:indicator-catalog-upsert', { limit: 30, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.status(201).json(await upsertIndicatorCatalog(request.body?.catalog ?? request.body ?? {}))
    } catch (error) {
      response.status(400).json({ error: 'INDICATOR_CATALOG_UPSERT_FAILED', detail: String(error?.message ?? 'UNKNOWN_ERROR') })
    }
  })

  app.post('/api/admin/indicator-catalogs/import', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:indicator-catalog-import', { limit: 15, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.status(201).json(await importIndicatorCatalog({
        ...(request.body ?? {}),
        requestedBy: request.body?.requestedBy ?? request.body?.requested_by ?? admin?.user?.id ?? admin?.user?.email ?? 'operations-admin',
      }))
    } catch (error) {
      response.status(400).json({ error: 'INDICATOR_CATALOG_IMPORT_FAILED', detail: String(error?.message ?? 'UNKNOWN_ERROR') })
    }
  })

  app.post('/api/admin/indicator-catalogs/:catalogKey/validate', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:indicator-catalog-validate', { limit: 30, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.json(await validateIndicatorCatalog({
        cityId: request.body?.cityId ?? request.body?.city_id,
        catalogKey: request.params.catalogKey,
        requestedBy: request.body?.requestedBy ?? request.body?.requested_by ?? admin?.user?.id ?? admin?.user?.email ?? 'operations-admin',
      }))
    } catch (error) {
      response.status(400).json({ error: 'INDICATOR_CATALOG_VALIDATION_FAILED', detail: String(error?.message ?? 'UNKNOWN_ERROR') })
    }
  })

  app.get('/api/admin/indicators', async (request, response) => {
    try {
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.json(await listIndicatorDefinitions({ cityId: request.query.cityId ?? request.query.city_id, active: request.query.active }))
    } catch (error) {
      response.status(400).json({ error: 'INDICATOR_CATALOG_READ_FAILED', detail: String(error?.message ?? 'UNKNOWN_ERROR') })
    }
  })

  app.post('/api/admin/indicators', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:indicator-upsert', { limit: 60, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.status(201).json(await upsertIndicatorDefinition(request.body?.indicator ?? request.body ?? {}))
    } catch (error) {
      response.status(400).json({ error: 'INDICATOR_CATALOG_UPSERT_FAILED', detail: String(error?.message ?? 'UNKNOWN_ERROR') })
    }
  })

  app.get('/api/admin/indicators/:indicatorKey/entity-values', async (request, response) => {
    try {
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.json(await queryIndicatorEntityValues({
        cityId: request.query.cityId ?? request.query.city_id,
        indicatorKey: request.params.indicatorKey,
        comparison: request.query.comparison,
        value: request.query.value,
        high: request.query.high,
        thresholdProfileKey: request.query.thresholdProfileKey ?? request.query.threshold_profile_key,
        includeCandidate: request.query.includeCandidate ?? request.query.include_candidate,
        limit: request.query.limit,
      }))
    } catch (error) {
      response.status(400).json({ error: 'INDICATOR_ENTITY_VALUES_READ_FAILED', detail: String(error?.message ?? 'UNKNOWN_ERROR') })
    }
  })

  app.post('/api/admin/indicators/:indicatorKey/observations', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:indicator-observation-upsert', { limit: 120, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.status(201).json(await upsertIndicatorObservation({
        ...(request.body ?? {}),
        indicatorKey: request.params.indicatorKey,
      }))
    } catch (error) {
      response.status(400).json({ error: 'INDICATOR_OBSERVATION_UPSERT_FAILED', detail: String(error?.message ?? 'UNKNOWN_ERROR') })
    }
  })

  app.get('/api/admin/indicator-thresholds', async (request, response) => {
    try {
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.json(await listIndicatorThresholdProfiles({
        cityId: request.query.cityId ?? request.query.city_id,
        indicatorKey: request.query.indicatorKey ?? request.query.indicator_key,
      }))
    } catch (error) {
      response.status(400).json({ error: 'INDICATOR_THRESHOLDS_READ_FAILED', detail: String(error?.message ?? 'UNKNOWN_ERROR') })
    }
  })

  app.post('/api/admin/indicator-thresholds', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:indicator-threshold-upsert', { limit: 60, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.status(201).json(await upsertIndicatorThresholdProfile(request.body ?? {}))
    } catch (error) {
      response.status(400).json({ error: 'INDICATOR_THRESHOLD_UPSERT_FAILED', detail: String(error?.message ?? 'UNKNOWN_ERROR') })
    }
  })

  app.post('/api/admin/indicators/:indicatorKey/compute', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:indicator-compute', { limit: 60, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.json(await computeIndicatorObservation({ cityId: request.body?.cityId ?? request.body?.city_id, indicatorKey: request.params.indicatorKey, observedAt: request.body?.observedAt ?? request.body?.observed_at }))
    } catch (error) {
      response.status(400).json({ error: 'INDICATOR_COMPUTE_FAILED', detail: String(error?.message ?? 'UNKNOWN_ERROR') })
    }
  })

  app.post('/api/admin/indicators/:indicatorKey/sync-cip', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:indicator-cip-sync', { limit: 60, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.json(await syncCipIndicatorObservations({ cityId: request.body?.cityId ?? request.body?.city_id, indicatorKey: request.params.indicatorKey }))
    } catch (error) {
      response.status(400).json({ error: 'INDICATOR_CIP_SYNC_FAILED', detail: String(error?.message ?? 'UNKNOWN_ERROR') })
    }
  })

  app.get('/api/admin/eu-ldt/integrations', async (request, response) => {
    try {
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.json(await listEuLdtIntegrationProfiles({
        platformKind: request.query.platformKind ?? request.query.platform_kind,
        status: request.query.status,
        cityId: request.query.cityId ?? request.query.city_id,
      }))
    } catch (error) {
      response.status(500).json({
        error: 'EU_LDT_INTEGRATIONS_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/eu-ldt/integrations', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:eu-ldt-integration-upsert', { limit: 30, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      const result = await upsertEuLdtIntegrationProfile({
        ...(request.body?.profile ?? request.body ?? {}),
        registeredBy: request.body?.registeredBy ?? request.body?.registered_by ?? admin?.user?.id ?? admin?.user?.email ?? 'operations-admin',
      })
      response.status(result.ok ? 201 : 400).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'EU_LDT_INTEGRATION_UPSERT_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/eu-ldt/integrations/:profileKey', async (request, response) => {
    try {
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      const result = await getEuLdtIntegrationProfile(request.params.profileKey)
      response.status(result.ok ? 200 : 404).json(result)
    } catch (error) {
      response.status(500).json({
        error: 'EU_LDT_INTEGRATION_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/eu-ldt/integrations/:profileKey/test', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:eu-ldt-integration-test', { limit: 60, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      const result = await testEuLdtIntegrationProfile(request.params.profileKey)
      response.status(result.profile ? 200 : 404).json(result)
    } catch (error) {
      response.status(500).json({
        error: 'EU_LDT_INTEGRATION_TEST_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/eu-ldt/cip/state', async (request, response) => {
    try {
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.json(await listCipExchangeState({
        cityId: request.query.cityId ?? request.query.city_id,
        cipProfileKey: request.query.cipProfileKey ?? request.query.cip_profile_key ?? request.query.profileKey,
        limit: request.query.limit,
      }))
    } catch (error) {
      response.status(500).json({
        error: 'CIP_EXCHANGE_STATE_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/eu-ldt/cip/initiative-links', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:eu-ldt-cip-initiative-link', { limit: 60, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      const result = await linkCipInitiativeSelection({
        ...(request.body ?? {}),
        linkedBy: request.body?.linkedBy ?? request.body?.linked_by ?? admin?.user?.id ?? admin?.user?.email ?? 'operations-admin',
      })
      response.status(200).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'CIP_INITIATIVE_LINK_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/eu-ldt/ucs/state', async (request, response) => {
    try {
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.json(await listUcsExchangeState({
        cityId: request.query.cityId ?? request.query.city_id,
        ucsProfileKey: request.query.ucsProfileKey ?? request.query.ucs_profile_key ?? request.query.profileKey,
        limit: request.query.limit,
      }))
    } catch (error) {
      response.status(500).json({
        error: 'UCS_EXCHANGE_STATE_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/eu-ldt/data-space/packages', async (request, response) => {
    try {
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      response.json(await listDataSpaceAssetPackages({
        cityId: request.query.cityId ?? request.query.city_id,
        limit: request.query.limit,
      }))
    } catch (error) {
      response.status(500).json({
        error: 'DATA_SPACE_PACKAGES_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/data-factory/processing-nodes', async (request, response) => {
    try {
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      const nodes = await listProcessingNodes({
        providerType: request.query.providerType ?? request.query.provider_type ?? '',
        status: request.query.status ?? '',
        limit: request.query.limit ?? 50,
      })
      response.status(nodes.ok ? 200 : 502).json(nodes)
    } catch (error) {
      response.status(500).json({
        error: 'PROCESSING_NODES_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/data-factory/processing-nodes', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:data-factory-processing-node-register', { limit: 20, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      const result = await registerProcessingNode({
        ...(request.body ?? {}),
        registeredBy: request.body?.registeredBy ?? request.body?.registered_by ?? admin?.user?.id ?? admin?.user?.email ?? 'operations-admin',
      })
      response.status(result.ok ? 201 : 400).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'PROCESSING_NODE_REGISTER_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/data-factory/processing-nodes/:nodeKey', async (request, response) => {
    try {
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      const node = await getProcessingNode(request.params.nodeKey)
      response.status(node.ok ? 200 : 404).json(node)
    } catch (error) {
      response.status(500).json({
        error: 'PROCESSING_NODE_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/data-factory/processing-nodes/:nodeKey/heartbeats', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:data-factory-processing-node-heartbeat', { limit: 60, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      const result = await recordProcessingNodeHeartbeat({
        nodeKey: request.params.nodeKey,
        requireToken: false,
        heartbeat: request.body?.heartbeat ?? request.body ?? {},
      })
      response.status(result.ok ? 201 : 400).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'PROCESSING_NODE_HEARTBEAT_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/data-factory/processing-nodes/:nodeKey/heartbeat', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'data-factory-processing-node-heartbeat', { limit: 120, windowMs: 5 * 60_000 })) return
      const result = await recordProcessingNodeHeartbeat({
        nodeKey: request.params.nodeKey,
        rawToken: extractProcessingNodeToken(request),
        requireToken: true,
        heartbeat: request.body?.heartbeat ?? request.body ?? {},
      })
      const status = result.ok ? 201 : result.error === 'PROCESSING_NODE_TOKEN_REQUIRED' || result.error === 'PROCESSING_NODE_TOKEN_INVALID' ? 401 : 400
      response.status(status).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'PROCESSING_NODE_RUNTIME_HEARTBEAT_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/data-factory/providers/same-server-sidecar/ensure', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:data-factory-same-server-sidecar-ensure', { limit: 10, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      const result = await ensureSameServerSidecarProvider({
        ...(request.body ?? {}),
        registeredBy: request.body?.registeredBy ?? request.body?.registered_by ?? admin?.user?.id ?? admin?.user?.email ?? 'operations-admin',
      })
      response.status(result.ok ? 201 : 400).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'SAME_SERVER_SIDECAR_ENSURE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/data-factory/processing-nodes/:nodeKey/dispatches/claim', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'data-factory-pull-dispatch-claim', { limit: 120, windowMs: 5 * 60_000 })) return
      const result = await claimServerToServerPullDispatch({
        nodeKey: request.params.nodeKey,
        rawToken: extractProcessingNodeToken(request),
        cityId: request.body?.cityId ?? request.body?.city_id ?? '',
        stageKey: request.body?.stageKey ?? request.body?.stage_key ?? '',
        runId: request.body?.runId ?? request.body?.run_id ?? '',
        runnerId: request.body?.runnerId ?? request.body?.runner_id ?? 'server-to-server-pull-worker',
      })
      const status = result.ok
        ? 200
        : ['PROCESSING_NODE_TOKEN_REQUIRED', 'PROCESSING_NODE_TOKEN_INVALID'].includes(result.error)
          ? 401
          : 400
      response.status(status).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'PULL_DISPATCH_CLAIM_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/data-factory/processing-nodes/:nodeKey/dispatches/:dispatchId/result', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'data-factory-pull-dispatch-result', { limit: 120, windowMs: 5 * 60_000 })) return
      const result = await submitServerToServerPullDispatchResult({
        nodeKey: request.params.nodeKey,
        rawToken: extractProcessingNodeToken(request),
        dispatchId: request.params.dispatchId,
        resultPackage: request.body?.resultPackage ?? request.body?.result_package ?? request.body,
        submittedBy: request.body?.submittedBy ?? request.body?.submitted_by ?? 'server-to-server-pull-worker',
      })
      const status = result.ok
        ? 200
        : ['PROCESSING_NODE_TOKEN_REQUIRED', 'PROCESSING_NODE_TOKEN_INVALID'].includes(result.error)
          ? 401
          : 400
      response.status(status).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'PULL_DISPATCH_RESULT_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/data-factory/processing-nodes/:nodeKey/dispatches/:dispatchId/artifacts/runtime-bundle', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'data-factory-pull-runtime-artifact-bundle', { limit: 40, windowMs: 5 * 60_000 })) return
      const result = await receiveServerToServerPullRuntimeArtifactBundle({
        nodeKey: request.params.nodeKey,
        rawToken: extractProcessingNodeToken(request),
        dispatchId: request.params.dispatchId,
        uploadStream: request,
        contentLength: request.headers['content-length'] ?? 0,
        checksum: request.headers['x-data-factory-artifact-checksum'] ?? request.headers['x-artifact-checksum'] ?? '',
        fileName: request.headers['x-data-factory-artifact-name'] ?? request.headers['x-artifact-name'] ?? 'runtime-artifacts-bundle.tgz',
        submittedBy: request.headers['x-data-factory-submitted-by'] ?? 'server-to-server-pull-worker',
      })
      const status = result.ok
        ? 200
        : ['PROCESSING_NODE_TOKEN_REQUIRED', 'PROCESSING_NODE_TOKEN_INVALID'].includes(result.error)
          ? 401
          : 400
      response.status(status).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'PULL_RUNTIME_ARTIFACT_BUNDLE_UPLOAD_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/data-factory/dispatches/:dispatchId/artifacts/stage', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:data-factory-artifacts-stage', { limit: 20, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      const result = await stageDataFactoryArtifactManifest({
        dispatchId: request.params.dispatchId,
        resultPackage: request.body?.resultPackage ?? request.body?.result_package ?? {},
        artifacts: request.body?.artifacts ?? null,
        copyLocal: request.body?.copyLocal ?? request.body?.copy_local ?? true,
        submittedBy: request.body?.submittedBy ?? request.body?.submitted_by ?? admin?.user?.id ?? admin?.user?.email ?? 'operations-admin',
      })
      response.status(result.ok ? 200 : 400).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'DATA_FACTORY_ARTIFACT_STAGE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/cities/:cityId/data-factory/city-input-packages', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:data-factory-city-input-package', { limit: 5, windowMs: 60 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      const result = await createRegisteredCityInputPackage({
        cityId: request.params.cityId,
        packageName: request.body?.packageName ?? request.body?.package_name ?? '',
        dumpMode: request.body?.dumpMode ?? request.body?.dump_mode ?? 'city-scoped-jsonl',
        inputScope: request.body?.inputScope ?? request.body?.input_scope ?? 'viewer-runtime',
        allowBoundaryGateBypass: request.body?.allowBoundaryGateBypass === true || request.body?.allow_boundary_gate_bypass === true,
        submittedBy: request.body?.submittedBy ?? request.body?.submitted_by ?? admin?.user?.id ?? admin?.user?.email ?? 'operations-ingestion-ui',
      })
      response.status(result.ok ? 201 : 400).json({
        ok: result.ok,
        schemaVersion: result.schemaVersion,
        packageKind: result.packageKind,
        cityId: result.cityId,
        packageKey: result.packageKey,
        artifact: result.artifact,
        tarball: result.tarball,
        databaseDump: result.manifest?.databaseDump,
        sourceSummary: result.manifest?.sourceSummary,
      })
    } catch (error) {
      response.status(400).json({
        error: 'DATA_FACTORY_CITY_INPUT_PACKAGE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/cities/:cityId/data-factory/runs', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:data-factory-run-intent', { limit: 10, windowMs: 5 * 60_000 })) return
      const admin = requireAdminResponse(request, response)
      if (!admin) return
      const body = request.body ?? {}
      const result = await createDataFactoryRunIntent({
        cityId: request.params.cityId,
        stageKey: body.stageKey ?? body.stage_key ?? 'viewer-artifacts',
        providerType: body.providerType ?? body.provider_type ?? 'server-to-server-pull',
        nodeKey: body.nodeKey ?? body.node_key ?? '',
        cityInputPolicy: body.cityInputPolicy ?? body.city_input_policy ?? body.inputPackagePolicy ?? body.input_package_policy ?? 'reuse-latest-or-create',
        artifactTransferPolicy: body.artifactTransferPolicy ?? body.artifact_transfer_policy ?? {},
        promotionPolicy: body.promotionPolicy ?? body.promotion_policy ?? 'stage-applicator',
        runPolicy: body.runPolicy ?? body.run_policy ?? 'dispatch-only',
        runnerOptions: body.runnerOptions ?? body.runner_options ?? {},
        twinStudioUrl: body.twinStudioUrl ?? body.twin_studio_url ?? '',
        requestedBy: admin?.user?.id ?? admin?.user?.email ?? null,
        submittedBy: body.submittedBy ?? body.submitted_by ?? 'operations-ingestion-ui',
      })
      response.status(result.ok ? 201 : 400).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'DATA_FACTORY_RUN_INTENT_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/cities/:cityId/source-plan', async (request, response) => {
    try {
      requireAdmin(request)
      const plan = await getCitySourcePlan(request.params.cityId, {
        planKind: request.query.planKind,
      })
      response.json(plan)
    } catch (error) {
      response.status(500).json({
        error: 'CITY_SOURCE_PLAN_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/cities/:cityId/workflow-source-contracts', async (request, response) => {
    try {
      requireAdmin(request)
      const contracts = await getWorkflowSourceContracts({ cityId: request.params.cityId })
      response.status(contracts.ok ? 200 : 502).json(contracts)
    } catch (error) {
      response.status(500).json({
        error: 'WORKFLOW_SOURCE_CONTRACTS_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })



  app.get('/api/admin/cities/:cityId/boundary-quality-gate', async (request, response) => {
    try {
      requireAdmin(request)
      const gate = await evaluateCityBoundaryQualityGate(request.params.cityId)
      response.status(gate.passed ? 200 : 409).json(gate)
    } catch (error) {
      response.status(500).json({
        error: 'CITY_BOUNDARY_QUALITY_GATE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })


  app.post('/api/admin/cities/:cityId/data-factory/offline-handoffs', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:data-factory-offline-handoff', { limit: 20, windowMs: 5 * 60_000 })) return
      const admin = requireAdmin(request)
      const result = await createOfflineDataFactoryHandoff({
        cityId: request.params.cityId,
        stageKey: request.body?.stageKey ?? request.body?.stage_key,
        requestedBy: admin?.user?.id ?? admin?.user?.email ?? null,
        submittedBy: request.body?.submittedBy ?? request.body?.submitted_by ?? 'operations-ingestion-ui',
      })
      response.status(result.ok ? 201 : 400).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'OFFLINE_DATA_FACTORY_HANDOFF_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/cities/:cityId/data-factory/offline-runs', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:data-factory-offline-run', { limit: 10, windowMs: 5 * 60_000 })) return
      const admin = requireAdmin(request)
      const result = await runOfflineDataFactoryJob({
        cityId: request.params.cityId,
        stageKey: request.body?.stageKey ?? request.body?.stage_key,
        executorProfile: request.body?.executorProfile ?? request.body?.executor_profile ?? 'local-process',
        requestedBy: admin?.user?.id ?? admin?.user?.email ?? null,
        submittedBy: request.body?.submittedBy ?? request.body?.submitted_by ?? 'operations-ingestion-ui',
        runnerOptions: request.body?.runnerOptions ?? request.body?.runner_options ?? {},
      })
      response.status(result.ok ? 201 : 400).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'OFFLINE_DATA_FACTORY_RUN_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/cities/:cityId/data-factory/offline-handoffs/:runId/run', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:data-factory-offline-handoff-run', { limit: 10, windowMs: 5 * 60_000 })) return
      const admin = requireAdmin(request)
      const result = await runOfflineDataFactoryJob({
        cityId: request.params.cityId,
        runId: request.params.runId,
        executorProfile: request.body?.executorProfile ?? request.body?.executor_profile ?? 'local-process',
        submittedBy: request.body?.submittedBy ?? request.body?.submitted_by ?? admin?.user?.id ?? admin?.user?.email ?? 'operations-ingestion-ui',
        runnerOptions: request.body?.runnerOptions ?? request.body?.runner_options ?? {},
      })
      response.status(result.ok ? 200 : 400).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'OFFLINE_DATA_FACTORY_HANDOFF_RUN_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/cities/:cityId/data-factory/offline-handoffs/:runId/result-template', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:data-factory-offline-result-template', { limit: 60, windowMs: 5 * 60_000 })) return
      const admin = requireAdmin(request)
      const result = await buildOfflineDataFactoryResultTemplate({
        cityId: request.params.cityId,
        runId: request.params.runId,
        promotionMode: request.query.promotionMode ?? request.query.promotion_mode ?? 'operations-ledger',
        submittedBy: admin?.user?.id ?? admin?.user?.email ?? 'operations-ingestion-ui',
      })
      response.json(result)
    } catch (error) {
      response.status(400).json({
        error: 'OFFLINE_DATA_FACTORY_RESULT_TEMPLATE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/cities/:cityId/data-factory/offline-handoffs/:runId/result', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:data-factory-offline-result', { limit: 20, windowMs: 5 * 60_000 })) return
      const admin = requireAdmin(request)
      const result = await importOfflineDataFactoryResult({
        cityId: request.params.cityId,
        runId: request.params.runId,
        resultPackage: request.body?.resultPackage ?? request.body?.result_package ?? request.body,
        submittedBy: request.body?.submittedBy ?? request.body?.submitted_by ?? admin?.user?.id ?? admin?.user?.email ?? 'operations-ingestion-ui',
      })
      response.status(result.ok ? 200 : 400).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'OFFLINE_DATA_FACTORY_RESULT_IMPORT_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.patch('/api/admin/cities/:cityId/data-factory/stages/:stageKey/execution-mode', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:data-factory-execution-mode-save', { limit: 60, windowMs: 5 * 60_000 })) return
      const admin = requireAdmin(request)
      const saved = await saveCityDataFactoryExecutionMode({
        cityId: request.params.cityId,
        stageKey: request.params.stageKey,
        executionMode: request.body?.executionMode ?? request.body?.execution_mode ?? request.body?.mode,
        updatedBy: request.body?.updatedBy ?? request.body?.updated_by ?? admin?.user?.id ?? admin?.user?.email ?? 'operations-ingestion-ui',
      })
      response.json(saved)
    } catch (error) {
      response.status(400).json({
        error: 'DATA_FACTORY_EXECUTION_MODE_SAVE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })


  app.post('/api/admin/cities/:cityId/boundary-quality-gate/repair', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:city-boundary-repair', { limit: 10, windowMs: 5 * 60_000 })) return
      requireAdmin(request)
      const repair = await repairCityBoundaryFromCurrentGate(request.params.cityId, request.body ?? {})
      const plan = await getCitySourcePlan(request.params.cityId, { planKind: request.query.planKind })
      response.status(repair.repaired ? 201 : 200).json({ ...repair, sourcePlan: plan })
    } catch (error) {
      response.status(400).json({
        error: 'CITY_BOUNDARY_REPAIR_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.patch('/api/admin/cities/:cityId/source-plan', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:city-source-plan-save', { limit: 30, windowMs: 5 * 60_000 })) return
      requireAdmin(request)
      const saved = await saveCitySourcePlanOverride(request.params.cityId, request.body ?? {})
      const plan = await getCitySourcePlan(request.params.cityId, {
        planKind: request.query.planKind,
      })
      response.json({ ...saved, sourcePlan: plan })
    } catch (error) {
      response.status(400).json({
        error: 'CITY_SOURCE_PLAN_SAVE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/workflows', async (request, response) => {
    try {
      requireAdmin(request)
      const workflows = await listAgenticWorkflowDefinitions()
      response.status(workflows.ok ? 200 : 502).json(workflows)
    } catch (error) {
      response.status(500).json({
        error: 'WORKFLOW_DEFINITIONS_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/workflow-contracts', async (request, response) => {
    try {
      requireAdmin(request)
      const contracts = await getWorkflowContracts({
        cityId: request.query.cityId ?? request.query.city_id ?? '',
      })
      response.status(contracts.ok ? 200 : 502).json(contracts)
    } catch (error) {
      response.status(500).json({
        error: 'WORKFLOW_CONTRACTS_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/workflow-intake-checklist', async (request, response) => {
    try {
      requireAdmin(request)
      response.json({
        ok: true,
        schemaVersion: '2026-07-06.workflow-intake-checklist.v1',
        checklist: workflowIntakeChecklist(),
      })
    } catch (error) {
      response.status(500).json({
        error: 'WORKFLOW_INTAKE_CHECKLIST_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/workflows/:workflowKey/contract', async (request, response) => {
    try {
      requireAdmin(request)
      const manifest = workflowManifestFor(request.params.workflowKey, {
        cityId: request.query.cityId ?? request.query.city_id ?? '',
      })
      response.status(manifest ? 200 : 404).json({
        ok: Boolean(manifest),
        manifest,
        error: manifest ? null : 'WORKFLOW_CONTRACT_NOT_FOUND',
      })
    } catch (error) {
      response.status(500).json({
        error: 'WORKFLOW_CONTRACT_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/workflow-runs', async (request, response) => {
    try {
      requireAdmin(request)
      const runs = await listWorkflowRuns({
        cityId: request.query.cityId,
        workflowKey: request.query.workflowKey,
        status: request.query.status,
        limit: request.query.limit,
        includeInactive: ['1', 'true', 'yes'].includes(String(request.query.includeInactive ?? '').toLowerCase()),
      })
      response.status(runs.ok ? 200 : 502).json(runs)
    } catch (error) {
      response.status(500).json({
        error: 'WORKFLOW_RUNS_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/workflows/:workflowKey/runs', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:workflow-run-create', { limit: 20, windowMs: 5 * 60_000 })) return
      const admin = requireAdmin(request)
      const run = await createWorkflowRun({
        workflowKey: request.params.workflowKey,
        cityId: request.body?.cityId ?? request.body?.city_id,
        input: request.body?.input ?? {},
        requestedBy: admin?.user?.id ?? admin?.user?.email ?? null,
        requestedByKind: 'human',
        triggerKind: request.body?.triggerKind ?? request.body?.trigger_kind ?? 'manual',
      })
      response.status(run.ok ? 201 : 400).json(run)
    } catch (error) {
      response.status(400).json({
        error: 'WORKFLOW_RUN_CREATE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/workflow-runs/:runId', async (request, response) => {
    try {
      requireAdmin(request)
      const run = await getWorkflowRun(request.params.runId)
      response.status(run.ok ? 200 : 404).json(run)
    } catch (error) {
      response.status(500).json({
        error: 'WORKFLOW_RUN_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.get('/api/admin/workflow-runs/:runId/trace', async (request, response) => {
    try {
      requireAdmin(request)
      const trace = await getWorkflowRunTrace(request.params.runId)
      response.status(trace.ok ? 200 : 404).json(trace)
    } catch (error) {
      response.status(500).json({
        error: 'WORKFLOW_RUN_TRACE_READ_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })


  app.post('/api/admin/workflow-runs/:runId/execute', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:workflow-run-execute', { limit: 20, windowMs: 5 * 60_000 })) return
      const admin = requireAdmin(request)
      const result = await executeWorkflowRunOnce({
        runId: request.params.runId,
        workerId: request.body?.workerId ?? request.body?.worker_id ?? admin?.user?.id ?? admin?.user?.email ?? 'admin-workflow-runner',
      })
      response.status(result.ok ? 200 : 400).json(result)
    } catch (error) {
      response.status(400).json({
        error: 'WORKFLOW_RUN_EXECUTE_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })

  app.post('/api/admin/workflow-runs/:runId/approvals/:approvalKey/decision', async (request, response) => {
    try {
      if (!requireRateLimit(request, response, 'admin:workflow-approval-decision', { limit: 40, windowMs: 5 * 60_000 })) return
      const admin = requireAdmin(request)
      const decision = await decideWorkflowApproval({
        runId: request.params.runId,
        approvalKey: request.params.approvalKey,
        decision: request.body?.decision,
        decidedBy: admin?.user?.id ?? admin?.user?.email ?? null,
        reason: request.body?.reason ?? '',
      })
      response.status(decision.ok ? 200 : 400).json(decision)
    } catch (error) {
      response.status(400).json({
        error: 'WORKFLOW_APPROVAL_DECISION_FAILED',
        detail: String(error?.message ?? 'UNKNOWN_ERROR'),
      })
    }
  })
}
