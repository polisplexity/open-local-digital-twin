import { useState } from 'react'
import { Alert, Badge, Button } from 'react-bootstrap'
import { compactList, formatCount, productLifecycleState, statusVariant, titleize } from '../ldtWorkspaceModel'
import { ReadinessList } from '../WorkspacePanelPrimitives'
import OperationsDataFactoryControlPanel from './OperationsDataFactoryControlPanel'

export default function OperationsIngestionPanel({
  checksByCategory,
  createOfflineDataFactoryHandoff,
  dataFactory,
  ensureSameServerSidecarProvider,
  importOfflineDataFactoryResult,
  ingestionRows,
  offlineResultDraft,
  prepareCityInputPackage,
  prepareDataFactoryProviderRun,
  prepareOfflineResultImport,
  processingNodes,
  promoteIngestionJob,
  refreshDataFactoryControl,
  runOfflineDataFactoryHandoff,
  runOfflineDataFactoryStage,
  providerAssist,
  saveDataFactoryStageMode,
  setOfflineResultDraft,
  setOfflineResultPromotionMode,
  viewerArtifacts,
  viewerArtifactSummary,
  workflowControl,
  workflowRuns,
}) {
  const factoryStages = dataFactory?.stages ?? []
  const executionModes = dataFactory?.executionModes ?? []
  const offlineCandidateStages = new Set(dataFactory?.offlineCandidateStages ?? dataFactory?.externalComputeCandidateStages ?? [])
  const offlineHandoffs = dataFactory?.offlineHandoffs ?? []
  const providerGates = providerAssist?.machineGates ?? []
  const providerCapabilities = (providerAssist?.capabilities ?? []).slice(0, 8)
  const [runnerOptionsByStage, setRunnerOptionsByStage] = useState({})
  const [runnerProfileByStage, setRunnerProfileByStage] = useState({})
  const stageModeValue = (stage) => (
    stage.execution?.operatorOverride
      ? (stage.execution?.selectedMode ?? stage.execution?.preferredMode ?? 'interactive-backend')
      : 'recommended'
  )
  const stageRecommendedMode = (stage) => stage.execution?.recommendedMode ?? stage.execution?.preferredMode ?? 'interactive-backend'
  const stageSelectedMode = (stage) => stage.execution?.selectedMode ?? stage.execution?.preferredMode ?? 'interactive-backend'
  const stageAvailableModes = (stage) => {
    const modes = stage.execution?.availableModes ?? ['interactive-backend']
    return Array.isArray(modes) && modes.length ? modes : ['interactive-backend']
  }
  const updateRunnerOption = (stageKey, key, value) => {
    setRunnerOptionsByStage((current) => ({
      ...current,
      [stageKey]: {
        ...(current[stageKey] ?? {}),
        [key]: value,
      },
    }))
  }
  const runnerProfileForStage = (stageKey) => runnerProfileByStage[stageKey] ?? 'local-process'
  const updateRunnerProfile = (stageKey, value) => {
    setRunnerProfileByStage((current) => ({
      ...current,
      [stageKey]: value === 'external-worker' ? 'external-worker' : 'local-process',
    }))
  }
  const runnerOptionsForStage = (stageKey) => {
    const options = runnerOptionsByStage[stageKey] ?? {}
    if (stageKey !== 'environmental-extractors') return {}
    return {
      environmentalMode: options.environmentalMode ?? 'source-plan-only',
      scenarioKey: options.scenarioKey ?? 'baseline',
      surfaceRunoff: options.surfaceRunoff ?? true,
    }
  }

  return (
    <>
          <div className="ldt-module-panel__header">
            <h3>Data Factory</h3>
            <p>The backend path that validates sources, writes PostGIS, and publishes versioned viewer artifacts for the active city.</p>
          </div>
          {workflowControl.error ? <Alert variant="warning">{workflowControl.error}</Alert> : null}
          {workflowControl.message ? <Alert variant="success">{workflowControl.message}</Alert> : null}
          <OperationsDataFactoryControlPanel
            dataFactory={dataFactory}
            ensureSameServerSidecarProvider={ensureSameServerSidecarProvider}
            ingestionRows={ingestionRows}
            prepareCityInputPackage={prepareCityInputPackage}
            prepareDataFactoryProviderRun={prepareDataFactoryProviderRun}
            processingNodes={processingNodes}
            refreshDataFactoryControl={refreshDataFactoryControl}
            viewerArtifacts={viewerArtifacts}
            viewerArtifactSummary={viewerArtifactSummary}
            workflowControl={workflowControl}
            workflowRuns={workflowRuns}
          />
          <div className="ldt-source-flow-grid">
            {executionModes.map((mode) => (
              <article key={mode.key}>
                <span>{mode.label}</span>
                <strong>{titleize(mode.state)}</strong>
                <p>{mode.description}</p>
                <small>{mode.operatorUse}</small>
              </article>
            ))}
          </div>
          <div className="ldt-source-flow-grid">
            {factoryStages.map((stage) => (
              <article key={stage.key}>
                <span>{stage.label}</span>
                <strong>{titleize(stage.state)}</strong>
                <Badge bg={offlineCandidateStages.has(stage.key) ? 'info' : 'secondary'}>
                  {titleize(stageSelectedMode(stage))}
                </Badge>
                {stage.execution?.operatorOverride ? (
                  <small>Recommended: {titleize(stageRecommendedMode(stage))}</small>
                ) : null}
                <p>{stage.evidence}</p>
                <small>{stage.operatorNext}</small>
                {stage.execution?.reason ? <small>{stage.execution.reason}</small> : null}
                <label>
                  Execution mode
                  <select
                    value={stageModeValue(stage)}
                    disabled={workflowControl.loading || !saveDataFactoryStageMode}
                    onChange={(event) => saveDataFactoryStageMode?.(stage.key, event.target.value)}
                  >
                    <option value="recommended">Use recommendation ({titleize(stageRecommendedMode(stage))})</option>
                    {stageAvailableModes(stage).map((mode) => (
                      <option key={mode} value={mode}>{titleize(mode)}</option>
                    ))}
                  </select>
                </label>
                {offlineCandidateStages.has(stage.key) ? (
                  <label>
                    Runner profile
                    <select
                      value={runnerProfileForStage(stage.key)}
                      disabled={workflowControl.loading}
                      onChange={(event) => updateRunnerProfile(stage.key, event.target.value)}
                    >
                      <option value="local-process">Local process</option>
                      <option value="external-worker">External worker</option>
                    </select>
                  </label>
                ) : null}
                {offlineCandidateStages.has(stage.key) && stage.key === 'environmental-extractors' ? (
                  <>
                    <label>
                      Environmental run
                      <select
                        value={runnerOptionsForStage(stage.key).environmentalMode}
                        disabled={workflowControl.loading}
                        onChange={(event) => updateRunnerOption(stage.key, 'environmentalMode', event.target.value)}
                      >
                        <option value="source-plan-only">Source plan only</option>
                        <option value="execute-existing-adapters">Execute existing adapters</option>
                      </select>
                    </label>
                    <label>
                      Scenario
                      <input
                        value={runnerOptionsForStage(stage.key).scenarioKey}
                        disabled={workflowControl.loading}
                        onChange={(event) => updateRunnerOption(stage.key, 'scenarioKey', event.target.value)}
                      />
                    </label>
                    {runnerOptionsForStage(stage.key).environmentalMode === 'execute-existing-adapters' ? (
                      <label className="ldt-inline-check">
                        <input
                          type="checkbox"
                          checked={runnerOptionsForStage(stage.key).surfaceRunoff}
                          disabled={workflowControl.loading}
                          onChange={(event) => updateRunnerOption(stage.key, 'surfaceRunoff', event.target.checked)}
                        />
                        Surface runoff
                      </label>
                    ) : null}
                  </>
                ) : null}
                {offlineCandidateStages.has(stage.key) && createOfflineDataFactoryHandoff ? (
                  <div className="ldt-action-row">
                    <Button
                      variant="outline-info"
                      size="sm"
                      disabled={workflowControl.loading}
                      onClick={() => createOfflineDataFactoryHandoff(stage.key)}
                    >
                      Create handoff
                    </Button>
                    {runOfflineDataFactoryStage ? (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={workflowControl.loading}
                        onClick={() => runOfflineDataFactoryStage(
                          stage.key,
                          runnerOptionsForStage(stage.key),
                          runnerProfileForStage(stage.key),
                        )}
                      >
                        {runnerProfileForStage(stage.key) === 'external-worker' ? 'Prepare dispatch' : 'Run locally'}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          {offlineHandoffs.length ? (
            <div className="ldt-inventory-table-wrap">
              <table className="ldt-inventory-table">
                <thead>
                  <tr>
                    <th>Offline handoff</th>
                    <th>Stage</th>
                    <th>Status</th>
                    <th>Artifact</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {offlineHandoffs.map((handoff) => (
                    <tr key={handoff.runId}>
                      <td><strong>{handoff.runId}</strong></td>
                      <td>{titleize(handoff.stageKey)}</td>
                      <td>
                        <Badge bg={statusVariant(productLifecycleState(handoff.status))}>{titleize(handoff.status)}</Badge>
                        {handoff.resultStatus ? <span>Result: {titleize(handoff.resultStatus)}</span> : null}
                        {handoff.dispatchStatus ? <span>Dispatch: {titleize(handoff.dispatchStatus)}</span> : null}
                        {handoff.dispatchReturnStatus ? <span>Return: {titleize(handoff.dispatchReturnStatus)}</span> : null}
                        {handoff.externalRunStatus ? <span>External run: {titleize(handoff.externalRunStatus)}</span> : null}
                        {handoff.postgisPromotionStatus ? <span>PostGIS: {titleize(handoff.postgisPromotionStatus)}</span> : null}
                        {handoff.viewerPromotionStatus ? <span>Artifacts: {titleize(handoff.viewerPromotionStatus)}</span> : null}
                      </td>
                      <td>
                        <strong>{handoff.artifactUri || 'Handoff artifact pending'}</strong>
                        <span>{handoff.checksum || handoff.localPath || 'No handoff checksum yet'}</span>
                        {handoff.resultArtifactUri ? (
                          <>
                            <strong>Result: {handoff.resultArtifactUri}</strong>
                            <span>{handoff.resultChecksum || handoff.resultLocalPath || 'No result checksum yet'}</span>
                          </>
                        ) : null}
                        {handoff.dispatchArtifactUri ? (
                          <>
                            <strong>Dispatch: {handoff.dispatchArtifactUri}</strong>
                            <span>{handoff.dispatchChecksum || handoff.dispatchLocalPath || 'No dispatch checksum yet'}</span>
                          </>
                        ) : null}
                        {handoff.resultExecutorProfile ? <span>Runner: {titleize(handoff.resultExecutorProfile)}{handoff.externalRunRunnerId ? ` / ${handoff.externalRunRunnerId}` : ''}</span> : null}
                      </td>
                      <td>
                        <div className="ldt-action-row">
                          {runOfflineDataFactoryHandoff && !handoff.resultStatus ? (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={workflowControl.loading || !handoff.artifactUri}
                              onClick={() => runOfflineDataFactoryHandoff(
                                handoff,
                                runnerOptionsForStage(handoff.stageKey),
                                runnerProfileForStage(handoff.stageKey),
                              )}
                            >
                              {runnerProfileForStage(handoff.stageKey) === 'external-worker' ? 'Prepare dispatch' : 'Run locally'}
                            </Button>
                          ) : null}
                          <Button
                            variant="outline-primary"
                            size="sm"
                            disabled={workflowControl.loading || !handoff.artifactUri}
                            onClick={() => prepareOfflineResultImport(handoff)}
                          >
                            Import result
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {offlineResultDraft?.runId ? (
            <div className="ldt-source-flow-grid ldt-source-flow-grid--forms">
              <article>
                <span>Offline result</span>
                <strong>{offlineResultDraft.stageKey ? titleize(offlineResultDraft.stageKey) : 'Selected handoff'}</strong>
                <p>{offlineResultDraft.runId}</p>
                <label>
                  Promotion mode
                  <select
                    value={offlineResultDraft.promotionMode || 'operations-ledger'}
                    onChange={(event) => setOfflineResultPromotionMode(event.target.value)}
                  >
                    <option value="operations-ledger">Operations ledger</option>
                    <option value="stage-applicator">Stage applicator</option>
                  </select>
                </label>
                <label>
                  Result package
                  <textarea
                    value={offlineResultDraft.payload}
                    onChange={(event) => setOfflineResultDraft((current) => ({ ...current, payload: event.target.value, error: '' }))}
                    rows={14}
                    spellCheck="false"
                  />
                </label>
                {offlineResultDraft.error ? <Alert variant="warning">{offlineResultDraft.error}</Alert> : null}
                <Button
                  variant="primary"
                  size="sm"
                  disabled={workflowControl.loading || !offlineResultDraft.payload.trim()}
                  onClick={importOfflineDataFactoryResult}
                >
                  Import and verify
                </Button>
              </article>
            </div>
          ) : null}

          <div className="ldt-module-panel__header">
            <h3>Provider Assist</h3>
            <p>Machine guardrails for deciding whether a source can be registered, queued, validated, and promoted without breaking the city twin.</p>
          </div>
          <div className="ldt-source-flow-grid">
            {providerGates.map((gate) => (
              <article key={gate.key}>
                <span>{gate.label}</span>
                <strong>{titleize(gate.state)}</strong>
                <p>{gate.evidence}</p>
              </article>
            ))}
          </div>
          <div className="ldt-source-flow-grid">
            {providerCapabilities.map((capability) => (
              <article key={capability.key}>
                <span>{capability.label}</span>
                <strong>{titleize(capability.state)}</strong>
                <p>{capability.machineHelp}</p>
                <small>{compactList(capability.requiredTools, capability.category)}</small>
              </article>
            ))}
          </div>

          <div className="ldt-module-panel__header">
            <h3>Ingestion jobs</h3>
            <p>Open-data and provider-layer jobs registered for this city, including validation report counts and queue state.</p>
          </div>
          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table">
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Provider</th>
                  <th>Format</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Reports</th>
                  <th>Source</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {ingestionRows.length ? ingestionRows.map((row) => (
                  <tr key={row.key}>
                    <td><strong>{row.layer}</strong></td>
                    <td>{row.provider}</td>
                    <td>{row.format}</td>
                    <td><Badge bg={statusVariant(productLifecycleState(row.status))}>{titleize(productLifecycleState(row.status))}</Badge></td>
                    <td>{formatCount(row.attempts)}</td>
                    <td>{formatCount(row.reports)}</td>
                    <td>
                      <strong>{titleize(row.sourceState)}</strong>
                      <span>{row.validationSummary}</span>
                    </td>
                    <td>{row.updatedAt}</td>
                    <td>
                      {row.status === 'registered' && row.canQueue ? (
                        <Button variant="outline-success" size="sm" disabled={workflowControl.loading} onClick={() => promoteIngestionJob(row)}>
                          Queue
                        </Button>
                      ) : <span>{row.status === 'registered' ? 'Registered' : titleize(row.status)}</span>}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={9}>No ingestion jobs recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <ReadinessList category="operations" checksByCategory={checksByCategory} />
    </>
  )
}
