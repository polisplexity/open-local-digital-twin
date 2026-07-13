import AnalysisWorkspacePanel from './panels/AnalysisWorkspacePanel'
import InventoryWorkspacePanel from './panels/InventoryWorkspacePanel'
import SemanticPacksWorkspacePanel from './panels/SemanticPacksWorkspacePanel'
import SourcesWorkspacePanel from './panels/SourcesWorkspacePanel'
import StandardsWorkspacePanel from './panels/StandardsWorkspacePanel'
import WorkspaceOverviewPanel from './panels/WorkspaceOverviewPanel'

export default function WorkspaceModulePanel({
  activeCityId,
  activeTab,
  analysisModelRows,
  analysisRows,
  apiCatalogRows,
  apiUsageRows,
  checksByCategory,
  counts,
  ingestionRows,
  inventoryRows,
  layerCapabilities,
  metricsFamilyRows,
  moduleRows,
  openApiRows,
  operationsView,
  readyModules,
  semanticFeatureRows,
  semanticRows,
  semanticRuleRows,
  semanticWorkflowRows,
  refreshWorkspace,
  setOperationsView,
  slowRouteRows,
  sourceItems,
  sourceRows,
  standardsRows,
  state,
  workflowRuns,
}) {
  if (!state.payload) return null

  if (activeTab === 'inventory') {
    return (
      <InventoryWorkspacePanel
        checksByCategory={checksByCategory}
        counts={counts}
        inventoryRows={inventoryRows}
        layerCapabilities={layerCapabilities}
        layerError={state.layerError}
      />
    )
  }

  if (activeTab === 'sources') {
    return (
      <SourcesWorkspacePanel
        checksByCategory={checksByCategory}
        counts={counts}
        sourceItems={sourceItems}
        sourceRows={sourceRows}
      />
    )
  }

  if (activeTab === 'standards') {
    return (
      <StandardsWorkspacePanel
        checksByCategory={checksByCategory}
        counts={counts}
        standardsRows={standardsRows}
      />
    )
  }

  if (activeTab === 'analysis') {
    return (
      <AnalysisWorkspacePanel
        analysisModelRows={analysisModelRows}
        analysisRows={analysisRows}
        checksByCategory={checksByCategory}
        counts={counts}
        scienceError={state.scienceError}
        scienceReport={state.scienceReport}
        societyError={state.societyError}
        societyReport={state.societyReport}
      />
    )
  }

  if (activeTab === 'semantic') {
    return (
      <SemanticPacksWorkspacePanel
        checksByCategory={checksByCategory}
        counts={counts}
        semanticError={state.semanticError}
        semanticFeatureRows={semanticFeatureRows}
        semanticReport={state.semanticReport}
        semanticRows={semanticRows}
        semanticRuleRows={semanticRuleRows}
        semanticWorkflowRows={semanticWorkflowRows}
      />
    )
  }

  return (
    <WorkspaceOverviewPanel
      checksByCategory={checksByCategory}
      moduleRows={moduleRows}
      readyModules={readyModules}
    />
  )
}
