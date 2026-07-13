import Link from 'next/link'
import { Alert } from 'react-bootstrap'
import { operationViewTabs } from '../ldtWorkspaceModel'
import { MetricTile } from '../WorkspacePanelPrimitives'
import OperationsApiPanel from './OperationsApiPanel'
import OperationsEuLdtPanel from './OperationsEuLdtPanel'
import OperationsIngestionPanel from './OperationsIngestionPanel'
import OperationsOverviewPanel from './OperationsOverviewPanel'
import OperationsTelemetryPanel from './OperationsTelemetryPanel'
import OperationsWorkflowsPanel from './OperationsWorkflowsPanel'
import useOperationsControl from './operations/useOperationsControl'

export default function OperationsWorkspacePanel({
  apiCatalogRows,
  apiUsageRows,
  checksByCategory,
  counts = {},
  ingestionRows,
  layerCapabilities,
  metricsError,
  metricsSummary,
  metricsFamilyRows,
  openApiDocument,
  openApiError,
  openApiRows,
  operationsError,
  operationsReport,
  operationsView,
  setOperationsView,
  slowRouteRows,
  workflowRuns,
  activeCityId = '',
  refreshWorkspace,
}) {
  const operationsCounts = operationsReport?.counts ?? {}
  const operationsReadiness = operationsReport?.readiness ?? []
  const apiMetrics = metricsSummary?.api ?? {}
  const ingestionMetrics = metricsSummary?.ingestion ?? {}
  const workflowMetrics = metricsSummary?.workflows ?? {}

  const {
    adapterRows,
    approveRun,
    boundaryGate,
    citySourcePlan,
    citySourcePreset,
    controlledWorkflowRuns,
    createCityBootstrapRun,
    createEuLdtDataPlatformImportRun,
    createEuLdtDataPlatformPublishRun,
    createEuLdtDataModellerFixtureImportRun,
    createEuLdtDataModellerPrepareSchemaRun,
    createEuLdtPlayVisualiseRegisterLayerRun,
    createOfflineDataFactoryHandoff,
    createPhase14Run,
    euLdtWorkflowDraft,
    euLdtDataModellerDraft,
    euLdtVisualiseDraft,
    executeRun,
    ensureSameServerSidecarProvider,
    importOfflineDataFactoryResult,
    inspectRun,
    layerOptions,
    loadWorkflowControl,
    manualLayerKey,
    offlineResultDraft,
    phase14Workflow,
    prepareCityInputPackage,
    prepareDataFactoryProviderRun,
    prepareOfflineResultImport,
    promoteIngestionJob,
    processingNodes,
    registerViewerArtifacts,
    repairBoundaryGate,
    runOfflineDataFactoryHandoff,
    runOfflineDataFactoryStage,
    saveCitySourcePlan,
    saveDataFactoryStageMode,
    selectedLayer,
    setManualLayerKey,
    setOfflineResultDraft,
    setOfflineResultPromotionMode,
    setEuLdtWorkflowDraft,
    setEuLdtDataModellerDraft,
    setEuLdtVisualiseDraft,
    setSourcePackage,
    setSourcePlanForm,
    setUsesManualLayerKey,
    sourcePackage,
    sourcePlanForm,
    usesManualLayerKey,
    viewerArtifacts,
    viewerArtifactSummary,
    workflowControl,
    workflowLabel,
  } = useOperationsControl({
    activeCityId,
    layerCapabilities,
    operationsReport,
    operationsView,
    refreshWorkspace,
    workflowRuns,
  })

  return (
    <section className="ldt-module-panel">
      <div className="ldt-module-panel__header">
        <h2>Operations</h2>
        <p>Data factory, provider assist, API telemetry, workflow runs, and operator approvals for the active city backend.</p>
      </div>
      {operationsError ? <Alert variant="warning">Operations report is unavailable: {operationsError}</Alert> : null}
      {metricsError ? <Alert variant="warning">Metrics summary is unavailable: {metricsError}</Alert> : null}
      <div className="ldt-metric-grid">
        <MetricTile label="API catalog" value={operationsCounts.catalogEntries ?? 0} tone="Published routes" />
        <MetricTile label="API events" value={operationsCounts.apiEvents ?? counts.apiEvents} tone={`${operationsCounts.apiFamilies ?? 0} families observed`} />
        <MetricTile label="Ingestion jobs" value={operationsCounts.ingestionJobs ?? counts.ingestionJobs} tone={`${operationsCounts.activeIngestionJobs ?? 0} active`} />
        <MetricTile label="Pending approvals" value={operationsCounts.pendingApprovals ?? counts.pendingWorkflowApprovals} tone="Governance queue" />
      </div>

      <nav className="ldt-ops-switcher" aria-label="Operations sections">
        {operationViewTabs.map((tab) => (
          <Link
            className={operationsView === tab.key ? 'is-active' : ''}
            href={tab.href}
            key={tab.key}
            onClick={() => setOperationsView(tab.key)}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {operationsView === 'overview' ? (
        <OperationsOverviewPanel
          apiMetrics={apiMetrics}
          counts={counts}
          ingestionMetrics={ingestionMetrics}
          metricsSummary={metricsSummary}
          operationsReadiness={operationsReadiness}
          workflowMetrics={workflowMetrics}
        />
      ) : null}

      {operationsView === 'apis' ? <OperationsApiPanel apiCatalogRows={apiCatalogRows} openApiDocument={openApiDocument} openApiError={openApiError} openApiRows={openApiRows} /> : null}

      {operationsView === 'telemetry' ? <OperationsTelemetryPanel apiUsageRows={apiUsageRows} metricsFamilyRows={metricsFamilyRows} slowRouteRows={slowRouteRows} /> : null}

      {operationsView === 'eu-ldt' ? <OperationsEuLdtPanel /> : null}

      {operationsView === 'workflows' ? (
        <OperationsWorkflowsPanel
          activeCityId={activeCityId}
          adapterRows={adapterRows}
          approveRun={approveRun}
          boundaryGate={boundaryGate}
          checksByCategory={checksByCategory}
          citySourcePlan={citySourcePlan}
          citySourcePreset={citySourcePreset}
          controlledWorkflowRuns={controlledWorkflowRuns}
          createCityBootstrapRun={createCityBootstrapRun}
          createEuLdtDataPlatformImportRun={createEuLdtDataPlatformImportRun}
          createEuLdtDataPlatformPublishRun={createEuLdtDataPlatformPublishRun}
          createEuLdtDataModellerFixtureImportRun={createEuLdtDataModellerFixtureImportRun}
          createEuLdtDataModellerPrepareSchemaRun={createEuLdtDataModellerPrepareSchemaRun}
          createEuLdtPlayVisualiseRegisterLayerRun={createEuLdtPlayVisualiseRegisterLayerRun}
          createPhase14Run={createPhase14Run}
          euLdtWorkflowDraft={euLdtWorkflowDraft}
          euLdtDataModellerDraft={euLdtDataModellerDraft}
          euLdtVisualiseDraft={euLdtVisualiseDraft}
          executeRun={executeRun}
          ingestionRows={ingestionRows}
          inspectRun={inspectRun}
          layerOptions={layerOptions}
          loadWorkflowControl={loadWorkflowControl}
          manualLayerKey={manualLayerKey}
          operationsReport={operationsReport}
          phase14Workflow={phase14Workflow}
          promoteIngestionJob={promoteIngestionJob}
          registerViewerArtifacts={registerViewerArtifacts}
          repairBoundaryGate={repairBoundaryGate}
          saveCitySourcePlan={saveCitySourcePlan}
          selectedLayer={selectedLayer}
          setManualLayerKey={setManualLayerKey}
          setEuLdtWorkflowDraft={setEuLdtWorkflowDraft}
          setEuLdtDataModellerDraft={setEuLdtDataModellerDraft}
          setEuLdtVisualiseDraft={setEuLdtVisualiseDraft}
          setSourcePackage={setSourcePackage}
          setSourcePlanForm={setSourcePlanForm}
          setUsesManualLayerKey={setUsesManualLayerKey}
          sourcePackage={sourcePackage}
          sourcePlanForm={sourcePlanForm}
          usesManualLayerKey={usesManualLayerKey}
          viewerArtifacts={viewerArtifacts}
          viewerArtifactSummary={viewerArtifactSummary}
          workflowControl={workflowControl}
          workflowLabel={workflowLabel}
          workflowRuns={workflowRuns}
        />
      ) : null}

      {operationsView === 'ingestion' ? (
        <OperationsIngestionPanel
          checksByCategory={checksByCategory}
          createOfflineDataFactoryHandoff={createOfflineDataFactoryHandoff}
          dataFactory={operationsReport?.dataFactory}
          ensureSameServerSidecarProvider={ensureSameServerSidecarProvider}
          importOfflineDataFactoryResult={importOfflineDataFactoryResult}
          ingestionRows={ingestionRows}
          offlineResultDraft={offlineResultDraft}
          prepareCityInputPackage={prepareCityInputPackage}
          prepareDataFactoryProviderRun={prepareDataFactoryProviderRun}
          prepareOfflineResultImport={prepareOfflineResultImport}
          processingNodes={processingNodes}
          promoteIngestionJob={promoteIngestionJob}
          refreshDataFactoryControl={loadWorkflowControl}
          runOfflineDataFactoryHandoff={runOfflineDataFactoryHandoff}
          runOfflineDataFactoryStage={runOfflineDataFactoryStage}
          providerAssist={operationsReport?.providerAssist}
          saveDataFactoryStageMode={saveDataFactoryStageMode}
          setOfflineResultDraft={setOfflineResultDraft}
          setOfflineResultPromotionMode={setOfflineResultPromotionMode}
          viewerArtifacts={viewerArtifacts}
          viewerArtifactSummary={viewerArtifactSummary}
          workflowControl={workflowControl}
          workflowRuns={controlledWorkflowRuns}
        />
      ) : null}
    </section>
  )
}
