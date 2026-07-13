import { Alert, Badge, Button } from 'react-bootstrap'
import { compactList, formatCount, formatDate, productLifecycleState, statusVariant, titleize } from '../ldtWorkspaceModel'
import { ReadinessList } from '../WorkspacePanelPrimitives'

export default function OperationsWorkflowsPanel({
  activeCityId,
  adapterRows,
  approveRun,
  boundaryGate,
  checksByCategory,
  citySourcePlan,
  citySourcePreset,
  controlledWorkflowRuns,
  createCityBootstrapRun,
  createEuLdtDataPlatformImportRun,
  createEuLdtDataPlatformPublishRun,
  createEuLdtDataModellerFixtureImportRun,
  createEuLdtDataModellerPrepareSchemaRun,
  createEuLdtPlayVisualiseRegisterLayerRun,
  createPhase14Run,
  euLdtWorkflowDraft,
  euLdtDataModellerDraft,
  euLdtVisualiseDraft,
  executeRun,
  ingestionRows,
  inspectRun,
  layerOptions,
  loadWorkflowControl,
  manualLayerKey,
  operationsReport,
  phase14Workflow,
  promoteIngestionJob,
  registerViewerArtifacts,
  repairBoundaryGate,
  saveCitySourcePlan,
  selectedLayer,
  setEuLdtWorkflowDraft,
  setEuLdtDataModellerDraft,
  setEuLdtVisualiseDraft,
  setManualLayerKey,
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
  workflowRuns,
}) {
  const selectedRun = workflowControl.selectedRun
  const selectedRunManifest = workflowControl.selectedRunManifest
  const selectedRunTrace = workflowControl.selectedRunTrace
  const selectedRunOutput = selectedRun?.output ?? {}
  const selectedRunSummary = selectedRunOutput.summary ?? {}
  const selectedRunSteps = selectedRun?.steps ?? []
  const selectedRunArtifacts = selectedRun?.artifacts ?? []
  const selectedTraceState = selectedRunTrace?.state ?? {}
  const selectedTraceJobs = selectedRunTrace?.jobs ?? {}
  const selectedTraceExtractorRuns = selectedRunTrace?.extractorRuns ?? {}
  const selectedTraceWrites = selectedRunTrace?.writes ?? []
  const selectedTraceNextActions = selectedRunTrace?.nextActions ?? []
  const workflowContracts = workflowControl.contracts?.manifests ?? []
  const workflowStatusSemantics = workflowControl.contracts?.statusSemantics ?? {}
  const workflowIntakeChecklist = workflowControl.contracts?.intakeChecklist ?? []
  const workflowChainPolicy = workflowControl.contracts?.chainPolicy ?? {}
  const workflowSourceContracts = workflowControl.sourceContracts ?? workflowControl.contracts?.sourceContracts ?? {}
  const dataFactoryStages = workflowSourceContracts?.dataFactoryStages ?? []
  const providerCapabilities = workflowSourceContracts?.providerCapabilities?.capabilities ?? workflowControl.capabilities?.capabilities ?? []
  const euLdtProfiles = workflowControl.euLdtProfiles ?? []
  const euLdtDataPlatformProfiles = euLdtProfiles.filter((profile) => profile.platformKind === 'data-platform')
  const euLdtDataModellerProfiles = euLdtProfiles.filter((profile) => profile.platformKind === 'data-modeller')
  const euLdtPlayVisualiseProfiles = euLdtProfiles.filter((profile) => profile.platformKind === 'play-visualise')
  const selectedEuLdtProfile = euLdtDataPlatformProfiles.find((profile) => profile.profileKey === euLdtWorkflowDraft.integrationProfileKey)
  const selectedDataModellerProfile = euLdtDataModellerProfiles.find((profile) => profile.profileKey === euLdtDataModellerDraft.integrationProfileKey)
  const selectedVisualiseProfile = euLdtPlayVisualiseProfiles.find((profile) => profile.profileKey === euLdtVisualiseDraft.integrationProfileKey)
  const selectedWorkflowKey = selectedRun?.canonicalWorkflowKey || selectedRun?.workflowKey || ''
  const selectedIsModelOutputRun = ['external-model-enrichment', 'external-model-enrichment-exchange', 'eu-ldt-data-platform-import-results', 'eu-ldt-data-modeller-fixture-import'].includes(selectedWorkflowKey)
  const dataModellerFrontendUrl = selectedDataModellerProfile?.endpoints?.publicFrontendUrl || selectedDataModellerProfile?.endpoints?.frontendUrl || selectedDataModellerProfile?.baseUrl || ''

  return (
    <>
          <div className="ldt-module-panel__header">
            <h3>Open Source City Builder</h3>
            <p>{workflowLabel(phase14Workflow)} - {titleize(phase14Workflow?.lifecycleStatus || 'current')}</p>
          </div>
          {workflowControl.error ? <Alert variant="warning">Workflow control is unavailable: {workflowControl.error}</Alert> : null}
          {workflowControl.message ? <Alert variant="success">{workflowControl.message}</Alert> : null}
          <div className="ldt-action-row">
            <Button variant="outline-secondary" size="sm" disabled={workflowControl.loading} onClick={() => loadWorkflowControl('Workflow control refreshed')}>
              Refresh workflows
            </Button>
            <Button variant="success" size="sm" disabled={workflowControl.loading || !citySourcePlan?.ready} onClick={createCityBootstrapRun}>
              Create city build
            </Button>
            <Button variant="primary" size="sm" disabled={workflowControl.loading || !sourcePackage.layerKey.trim()} onClick={createPhase14Run}>
              Create source package run
            </Button>
          </div>

          <div className="ldt-module-panel__header">
            <h3>Workflow contracts</h3>
            <p>Operator manifests, status meanings, chain policy, intake checklist, API commands, and source/stage contracts for adding or running workflows.</p>
          </div>
          <div className="ldt-source-flow-grid">
            <article>
              <span>Manifests</span>
              <strong>{formatCount(workflowContracts.length)}</strong>
              <p>{compactList(workflowContracts.map((manifest) => manifest.operatorName || manifest.workflowKey), 'No workflow contracts loaded')}</p>
            </article>
            <article>
              <span>Status model</span>
              <strong>{formatCount(Object.keys(workflowStatusSemantics).length)}</strong>
              <p>{compactList(Object.values(workflowStatusSemantics).map((status) => status.label), 'No status semantics loaded')}</p>
            </article>
            <article>
              <span>Chain policy</span>
              <strong>{formatCount(Object.keys(workflowChainPolicy).length)}</strong>
              <p>{compactList(Object.keys(workflowChainPolicy).map((key) => titleize(key)), 'No chain policy loaded')}</p>
            </article>
            <article>
              <span>Intake checklist</span>
              <strong>{formatCount(workflowIntakeChecklist.length)}</strong>
              <p>{compactList(workflowIntakeChecklist.slice(0, 5).map((item) => item.label), 'No intake checklist loaded')}</p>
            </article>
            <article>
              <span>Data Factory stages</span>
              <strong>{formatCount(dataFactoryStages.length)}</strong>
              <p>{compactList(dataFactoryStages.map((stage) => stage.label || stage.stageKey || stage.key), 'No stage contracts loaded')}</p>
            </article>
            <article>
              <span>Provider actions</span>
              <strong>{formatCount(providerCapabilities.length)}</strong>
              <p>{compactList(providerCapabilities.slice(0, 8).map((capability) => capability.key), 'No provider capabilities loaded')}</p>
            </article>
          </div>

          <div className="ldt-module-panel__header">
            <h3>EU LDT Data Platform workflows</h3>
            <p>Publish and import runs target the selected integration profile; run evidence stores the profile key, endpoint, and external system.</p>
          </div>
          <div className="ldt-source-flow-grid ldt-source-flow-grid--forms">
            <article>
              <span>Target profile</span>
              <label>Data Platform
                <select value={euLdtWorkflowDraft.integrationProfileKey} onChange={(event) => setEuLdtWorkflowDraft((current) => ({ ...current, integrationProfileKey: event.target.value }))}>
                  <option value="">Select Data Platform</option>
                  {euLdtDataPlatformProfiles.map((profile) => (
                    <option key={profile.profileKey} value={profile.profileKey}>{profile.displayName || profile.profileKey}</option>
                  ))}
                </select>
              </label>
              <p>{selectedEuLdtProfile ? `${selectedEuLdtProfile.profileKey} - ${titleize(selectedEuLdtProfile.status)}` : 'Register or validate a Data Platform profile first.'}</p>
            </article>
            <article>
              <span>Publish</span>
              <label>NGSI-LD type<input value={euLdtWorkflowDraft.publishType} onChange={(event) => setEuLdtWorkflowDraft((current) => ({ ...current, publishType: event.target.value }))} placeholder="optional type filter" /></label>
              <label>Limit<input type="number" min="1" max="100" value={euLdtWorkflowDraft.publishLimit} onChange={(event) => setEuLdtWorkflowDraft((current) => ({ ...current, publishLimit: event.target.value }))} /></label>
              <label><input type="checkbox" checked={euLdtWorkflowDraft.publishDryRun} onChange={(event) => setEuLdtWorkflowDraft((current) => ({ ...current, publishDryRun: event.target.checked }))} /> Dry run</label>
              <Button variant="outline-primary" size="sm" disabled={workflowControl.loading || !euLdtWorkflowDraft.integrationProfileKey} onClick={createEuLdtDataPlatformPublishRun}>Create publish run</Button>
            </article>
            <article>
              <span>Import</span>
              <label>Result type<input value={euLdtWorkflowDraft.importType} onChange={(event) => setEuLdtWorkflowDraft((current) => ({ ...current, importType: event.target.value }))} placeholder="BuildingEnergyPerformance" /></label>
              <label>Limit<input type="number" min="1" max="250" value={euLdtWorkflowDraft.importLimit} onChange={(event) => setEuLdtWorkflowDraft((current) => ({ ...current, importLimit: event.target.value }))} /></label>
              <label><input type="checkbox" checked={euLdtWorkflowDraft.allowUnmapped} onChange={(event) => setEuLdtWorkflowDraft((current) => ({ ...current, allowUnmapped: event.target.checked }))} /> Allow unmapped results</label>
              <Button variant="outline-primary" size="sm" disabled={workflowControl.loading || !euLdtWorkflowDraft.integrationProfileKey} onClick={createEuLdtDataPlatformImportRun}>Create import run</Button>
            </article>
            <article>
              <span>Import mapping</span>
              <label>Model key<input value={euLdtWorkflowDraft.modelKey} onChange={(event) => setEuLdtWorkflowDraft((current) => ({ ...current, modelKey: event.target.value }))} /></label>
              <label>Version<input value={euLdtWorkflowDraft.modelVersion} onChange={(event) => setEuLdtWorkflowDraft((current) => ({ ...current, modelVersion: event.target.value }))} /></label>
              <label>Output<input value={euLdtWorkflowDraft.outputKey} onChange={(event) => setEuLdtWorkflowDraft((current) => ({ ...current, outputKey: event.target.value }))} /></label>
              <label>Source attribute<input value={euLdtWorkflowDraft.sourceAttribute} onChange={(event) => setEuLdtWorkflowDraft((current) => ({ ...current, sourceAttribute: event.target.value }))} /></label>
            </article>
          </div>

          <div className="ldt-module-panel__header">
            <h3>EU Data Modeller exchange</h3>
            <p>Prepare a governed Synth schema from OLDT, approve it in Data Modeller, then import generated values as simulated model outputs without changing canonical entities.</p>
          </div>
          <div className="ldt-source-flow-grid ldt-source-flow-grid--forms">
            <article>
              <span>Target and sample</span>
              <label>Data Modeller
                <select value={euLdtDataModellerDraft.integrationProfileKey} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, integrationProfileKey: event.target.value }))}>
                  <option value="">Select Data Modeller</option>
                  {euLdtDataModellerProfiles.map((profile) => (
                    <option key={profile.profileKey} value={profile.profileKey}>{profile.displayName || profile.profileKey}</option>
                  ))}
                </select>
              </label>
              <label>Entity type
                <select value={euLdtDataModellerDraft.entityType} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, entityType: event.target.value }))}>
                  <option value="building">Buildings</option>
                  <option value="road">Roads</option>
                </select>
              </label>
              <label>Sample size<input type="number" min="1" max="250" value={euLdtDataModellerDraft.sampleLimit} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, sampleLimit: event.target.value }))} /></label>
              <p>{selectedDataModellerProfile ? `${selectedDataModellerProfile.profileKey} - ${titleize(selectedDataModellerProfile.status)}` : 'Optional addon: register and validate a Data Modeller profile first.'}</p>
              {dataModellerFrontendUrl ? <a className="ldt-inline-link" href={dataModellerFrontendUrl} target="_blank" rel="noreferrer">Open Data Modeller</a> : null}
            </article>
            <article>
              <span>Schema registration</span>
              <label>Name<input value={euLdtDataModellerDraft.schemaName} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, schemaName: event.target.value }))} /></label>
              <label>Reference name<input value={euLdtDataModellerDraft.referenceName} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, referenceName: event.target.value }))} /></label>
              <label>Version<input value={euLdtDataModellerDraft.version} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, version: event.target.value }))} /></label>
              <label>Ownership<input value={euLdtDataModellerDraft.ownership} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, ownership: event.target.value }))} /></label>
              <Button variant="outline-primary" size="sm" disabled={workflowControl.loading || !euLdtDataModellerDraft.integrationProfileKey} onClick={createEuLdtDataModellerPrepareSchemaRun}>Create schema run</Button>
            </article>
            <article>
              <span>Generated field</span>
              <label>Field<input value={euLdtDataModellerDraft.outputField} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, outputField: event.target.value }))} /></label>
              <label>Minimum<input type="number" value={euLdtDataModellerDraft.outputMinimum} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, outputMinimum: event.target.value }))} /></label>
              <label>Maximum<input type="number" value={euLdtDataModellerDraft.outputMaximum} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, outputMaximum: event.target.value }))} /></label>
              <p>The generated field is test data. Imported rows retain authority status <strong>simulated</strong>.</p>
            </article>
            <article>
              <span>Fixture import</span>
              <label>Approved schema ID<input value={euLdtDataModellerDraft.schemaId} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, schemaId: event.target.value }))} placeholder="Data Modeller UUID" /></label>
              <label>Record count<input type="number" min="1" max="250" value={euLdtDataModellerDraft.recordCount} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, recordCount: event.target.value }))} /></label>
              <label>Minimum score<input type="number" min="0" max="100" value={euLdtDataModellerDraft.minimumEvaluationScore} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, minimumEvaluationScore: event.target.value }))} /></label>
              <label>Model key<input value={euLdtDataModellerDraft.modelKey} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, modelKey: event.target.value }))} /></label>
              <label>Model version<input value={euLdtDataModellerDraft.modelVersion} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, modelVersion: event.target.value }))} /></label>
              <label>OLDT output key<input value={euLdtDataModellerDraft.outputKey} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, outputKey: event.target.value }))} /></label>
              <label>Unit<input value={euLdtDataModellerDraft.unit} onChange={(event) => setEuLdtDataModellerDraft((current) => ({ ...current, unit: event.target.value }))} /></label>
              <Button variant="outline-success" size="sm" disabled={workflowControl.loading || !euLdtDataModellerDraft.integrationProfileKey || !euLdtDataModellerDraft.schemaId.trim()} onClick={createEuLdtDataModellerFixtureImportRun}>Create fixture import run</Button>
            </article>
          </div>

          <div className="ldt-module-panel__header">
            <h3>EU Play & Visualise layer registration</h3>
            <p>Register an OLDT OGC collection as a Play & Visualise Map/DataSource/DataLayer and verify the configured source returns features.</p>
          </div>
          <div className="ldt-source-flow-grid ldt-source-flow-grid--forms">
            <article>
              <span>Visualizer profile</span>
              <label>Play & Visualise
                <select value={euLdtVisualiseDraft.integrationProfileKey} onChange={(event) => setEuLdtVisualiseDraft((current) => ({ ...current, integrationProfileKey: event.target.value }))}>
                  <option value="">Select Play & Visualise</option>
                  {euLdtPlayVisualiseProfiles.map((profile) => (
                    <option key={profile.profileKey} value={profile.profileKey}>{profile.displayName || profile.profileKey}</option>
                  ))}
                </select>
              </label>
              <p>{selectedVisualiseProfile ? `${selectedVisualiseProfile.profileKey} - ${titleize(selectedVisualiseProfile.status)}` : 'Register or validate a Play & Visualise profile first.'}</p>
            </article>
            <article>
              <span>OLDT source</span>
              <label>Registration mode
                <select value={euLdtVisualiseDraft.mode} onChange={(event) => setEuLdtVisualiseDraft((current) => ({
                  ...current,
                  mode: event.target.value,
                  limit: event.target.value === 'full-power' ? 1000 : current.limit,
                  mapName: event.target.value === 'full-power' ? 'OLDT Guanajuato Full Power' : current.mapName,
                }))}>
                  <option value="full-power">Full power map</option>
                  <option value="basic">Basic single layer</option>
                </select>
              </label>
              <label>Collection
                <select value={euLdtVisualiseDraft.collectionKey} onChange={(event) => setEuLdtVisualiseDraft((current) => ({ ...current, collectionKey: event.target.value }))}>
                  <option value="buildings">Buildings</option>
                  <option value="roads">Roads</option>
                </select>
              </label>
              <label>Limit<input type="number" min="1" max="1000" value={euLdtVisualiseDraft.limit} onChange={(event) => setEuLdtVisualiseDraft((current) => ({ ...current, limit: event.target.value }))} /></label>
              <label>Property field<input value={euLdtVisualiseDraft.propField} onChange={(event) => setEuLdtVisualiseDraft((current) => ({ ...current, propField: event.target.value }))} /></label>
              {euLdtVisualiseDraft.mode === 'full-power' ? <p>Full power registers buildings, roads, 2D fill, 3D extrusion, labels, a SAP histogram, and a snapshot report.</p> : null}
            </article>
            <article>
              <span>Play registry</span>
              <label>DataSource<input value={euLdtVisualiseDraft.dataSourceName} onChange={(event) => setEuLdtVisualiseDraft((current) => ({ ...current, dataSourceName: event.target.value }))} /></label>
              <label>DataLayer<input value={euLdtVisualiseDraft.layerName} onChange={(event) => setEuLdtVisualiseDraft((current) => ({ ...current, layerName: event.target.value }))} /></label>
              <label>Map<input value={euLdtVisualiseDraft.mapName} onChange={(event) => setEuLdtVisualiseDraft((current) => ({ ...current, mapName: event.target.value }))} /></label>
              <label>Layer type<select value={euLdtVisualiseDraft.layerType} onChange={(event) => setEuLdtVisualiseDraft((current) => ({ ...current, layerType: event.target.value }))}><option value="REAL_TIME">Real time</option><option value="STATIC">Static</option><option value="SCHEDULED">Scheduled</option></select></label>
            </article>
            <article>
              <span>Style</span>
              <label>Color<input value={euLdtVisualiseDraft.color} onChange={(event) => setEuLdtVisualiseDraft((current) => ({ ...current, color: event.target.value }))} /></label>
              <Button variant="outline-primary" size="sm" disabled={workflowControl.loading || !euLdtVisualiseDraft.integrationProfileKey} onClick={createEuLdtPlayVisualiseRegisterLayerRun}>Create visualise run</Button>
            </article>
          </div>

          <div className="ldt-source-flow-grid">
            <article>
              <span>City build</span>
              <strong>{titleize(citySourcePlan?.cityId || activeCityId || 'city')}</strong>
              <p>Backend-owned source plan: local OSM promotion, Overture buildings and roads, extractor registration, and viewer/query refresh.</p>
            </article>
            <article>
              <span>Open source inputs</span>
              <strong>{citySourcePreset.sourceSlug || 'No source plan loaded'}</strong>
              <p>{citySourcePreset.sourceUrl || citySourcePreset.sourcePath || 'Refresh workflow control to resolve city sources.'}</p>
            </article>
            <article>
              <span>Overture release</span>
              <strong>{citySourcePreset.overtureRelease || 'n/a'}</strong>
              <p>Buildings and roads use the active city boundary unless a worker request overrides the bbox.</p>
            </article>
            <article>
              <span>Builder readiness</span>
              <strong>{citySourcePlan?.ready ? 'Ready' : 'Needs layer targets'}</strong>
              <p>{compactList((citySourcePlan?.checks ?? []).map((item) => `${item.label}: ${item.value}`), 'No city source plan loaded')}</p>
            </article>
            <article>
              <span>Boundary quality</span>
              <strong>{boundaryGate?.code || 'Not checked'}</strong>
              <p>{boundaryGate?.detail?.areaKm2 ? `${boundaryGate.detail.areaKm2} km2, ${boundaryGate.detail.featureCount} feature(s)` : 'Boundary gate runs before city bootstrap.'}</p>
              {boundaryGate && boundaryGate.passed === false ? <Button variant="outline-warning" size="sm" disabled={workflowControl.loading} onClick={repairBoundaryGate}>Accept current bbox</Button> : null}
            </article>
          </div>

          <div className="ldt-source-flow-grid ldt-source-flow-grid--forms">
            <article>
              <span>City source plan</span>
              <label>OSM raw schema<input value={sourcePlanForm.rawSchema} onChange={(event) => setSourcePlanForm((current) => ({ ...current, rawSchema: event.target.value }))} placeholder="raw_osm_city" /></label>
              <label>OSM source slug<input value={sourcePlanForm.sourceSlug} onChange={(event) => setSourcePlanForm((current) => ({ ...current, sourceSlug: event.target.value }))} placeholder="city-osm-pbf" /></label>
            </article>
            <article>
              <span>Local extract</span>
              <label>Source path<input value={sourcePlanForm.sourcePath} onChange={(event) => setSourcePlanForm((current) => ({ ...current, sourcePath: event.target.value }))} placeholder="/app/runtime-data/extracts/city/latest.osm.pbf" /></label>
              <label>Source URL<input value={sourcePlanForm.sourceUrl} onChange={(event) => setSourcePlanForm((current) => ({ ...current, sourceUrl: event.target.value }))} placeholder="https://download...osm.pbf" /></label>
            </article>
            <article>
              <span>Overture package</span>
              <label>Release<input value={sourcePlanForm.overtureRelease} onChange={(event) => setSourcePlanForm((current) => ({ ...current, overtureRelease: event.target.value }))} placeholder="2026-04-15.0" /></label>
              <label>Notes<input value={sourcePlanForm.notes} onChange={(event) => setSourcePlanForm((current) => ({ ...current, notes: event.target.value }))} placeholder="optional operator note" /></label>
              <Button variant="outline-primary" size="sm" disabled={workflowControl.loading} onClick={saveCitySourcePlan}>Save city source plan</Button>
            </article>
            <article>
              <span>Provider override JSON</span>
              <label>Override<textarea value={sourcePlanForm.providerOverride} onChange={(event) => setSourcePlanForm((current) => ({ ...current, providerOverride: event.target.value }))} rows={5} spellCheck="false" /></label>
            </article>
          </div>

          <div className="ldt-module-panel__header">
            <h3>Viewer artifacts</h3>
            <p>MVT directories, PMTiles, and 3D Tiles registered for this city runtime.</p>
          </div>
          <div className="ldt-action-row">
            <Button variant="outline-primary" size="sm" disabled={workflowControl.loading} onClick={registerViewerArtifacts}>Register latest artifacts</Button>
            <Badge bg="light" text="dark">{viewerArtifactSummary.total || 0} artifacts</Badge>
          </div>
          <div className="ldt-source-flow-grid">
            {viewerArtifacts.length ? viewerArtifacts.slice(0, 6).map((artifact) => {
              const lifecycle = productLifecycleState(artifact.active ? 'validated' : artifact.status)
              const checksum = artifact.checksum ? String(artifact.checksum).replace(/^sha256:/, '').slice(0, 12) : 'no checksum'
              return (
                <article key={artifact.id || `${artifact.artifactKey}-${artifact.version}`}>
                  <span>{artifact.artifactType} - {artifact.transport}</span>
                  <strong>{artifact.artifactKey}</strong>
                  <p>{artifact.version} - {formatCount(artifact.byteSize || 0)} bytes</p>
                  <p>{formatDate(artifact.generatedAt || artifact.updatedAt)} - {checksum}</p>
                  <Badge bg={statusVariant(lifecycle)}>{artifact.active ? 'Active' : titleize(lifecycle)}</Badge>
                </article>
              )
            }) : (
              <article>
                <span>Viewer artifacts</span>
                <strong>None registered</strong>
                <p>Run the register action after generating MVT, PMTiles, or 3D Tiles packages.</p>
              </article>
            )}
          </div>

          <div className="ldt-source-flow-grid ldt-source-flow-grid--forms">
            <article>
              <span>Source package</span>
              <label>Target layer
                <select value={usesManualLayerKey ? '__manual__' : sourcePackage.layerKey} onChange={(event) => {
                  const value = event.target.value
                  setUsesManualLayerKey(value === '__manual__')
                  setSourcePackage((current) => ({ ...current, layerKey: value === '__manual__' ? manualLayerKey : value }))
                }}>
                  <option value="">Select a city layer</option>
                  {layerOptions.map((layer) => (
                    <option key={layer.key} value={layer.key}>{layer.label}</option>
                  ))}
                  <option value="__manual__">Manual layer key</option>
                </select>
              </label>
              {usesManualLayerKey ? (
                <label>Manual key<input value={manualLayerKey} onChange={(event) => {
                  const value = event.target.value
                  setManualLayerKey(value)
                  setSourcePackage((current) => ({ ...current, layerKey: value }))
                }} placeholder="layer key" /></label>
              ) : null}
              {selectedLayer ? <p>{selectedLayer.key}{selectedLayer.capability ? ` - ${titleize(selectedLayer.capability)}` : ''}</p> : null}
              <label>Source URI<input value={sourcePackage.sourceUri} onChange={(event) => setSourcePackage((current) => ({ ...current, sourceUri: event.target.value }))} placeholder="https://, s3://, file://, gs://" /></label>
            </article>
            <article>
              <span>Adapter</span>
              <label>Action<select value={sourcePackage.action} onChange={(event) => setSourcePackage((current) => ({ ...current, action: event.target.value, sourceFormat: event.target.value === 'ogc-features' ? 'ogc-api-features' : event.target.value }))}><option value="geojson">GeoJSON</option><option value="csv">CSV</option><option value="ogc-features">OGC API Features</option><option value="stac">STAC / raster catalog</option><option value="cityjson">CityJSON</option><option value="package">Package inspection</option><option value="overture-buildings">Overture buildings</option><option value="overture-roads">Overture roads</option><option value="osm-local-extract">Local OSM extract</option><option value="mvt-cache-refresh">Viewer/MVT refresh</option></select></label>
              <label>Version<input value={sourcePackage.sourceVersion} onChange={(event) => setSourcePackage((current) => ({ ...current, sourceVersion: event.target.value }))} placeholder="optional" /></label>
            </article>
            <article>
              <span>Execution gates</span>
              <label><input type="checkbox" checked={sourcePackage.queueForExecution} onChange={(event) => setSourcePackage((current) => ({ ...current, queueForExecution: event.target.checked }))} /> Queue when source validates</label>
              <label><input type="checkbox" checked={sourcePackage.refreshConsolidation} onChange={(event) => setSourcePackage((current) => ({ ...current, refreshConsolidation: event.target.checked }))} /> Refresh city twin records</label>
              <label><input type="checkbox" checked={sourcePackage.refreshViewerAggregates} onChange={(event) => setSourcePackage((current) => ({ ...current, refreshViewerAggregates: event.target.checked }))} /> Refresh viewer outputs</label>
              <label><input type="checkbox" checked={sourcePackage.refreshTwinQuerySurfaces} onChange={(event) => setSourcePackage((current) => ({ ...current, refreshTwinQuerySurfaces: event.target.checked }))} /> Refresh query surfaces</label>
            </article>
            <article>
              <span>Extractor runs</span>
              <label><input type="checkbox" checked={sourcePackage.extractorKeys.terrainDem} onChange={(event) => setSourcePackage((current) => ({ ...current, extractorKeys: { ...current.extractorKeys, terrainDem: event.target.checked } }))} /> Terrain</label>
              <label><input type="checkbox" checked={sourcePackage.extractorKeys.weatherField} onChange={(event) => setSourcePackage((current) => ({ ...current, extractorKeys: { ...current.extractorKeys, weatherField: event.target.checked } }))} /> Weather</label>
              <label><input type="checkbox" checked={sourcePackage.extractorKeys.hydrologyGrid} onChange={(event) => setSourcePackage((current) => ({ ...current, extractorKeys: { ...current.extractorKeys, hydrologyGrid: event.target.checked } }))} /> Hydrology</label>
            </article>
          </div>
          {workflowControl.capabilities ? (
            <div className="ldt-source-flow-grid">
              <article>
                <span>Executable adapters</span>
                <strong>{formatCount(workflowControl.capabilities.supportedActions?.length ?? 0)}</strong>
                <p>{compactList(workflowControl.capabilities.supportedActions, 'No executable adapters detected')}</p>
              </article>
              <article>
                <span>Metadata-only</span>
                <strong>{formatCount(workflowControl.capabilities.metadataOnlyActions?.length ?? 0)}</strong>
                <p>{compactList(workflowControl.capabilities.metadataOnlyActions, 'No metadata-only adapters')}</p>
              </article>
              <article>
                <span>Missing tools</span>
                <strong>{formatCount(workflowControl.capabilities.missingToolActions?.length ?? 0)}</strong>
                <p>{compactList(workflowControl.capabilities.missingToolActions, 'No missing tool-backed actions')}</p>
              </article>
              <article>
                <span>Pending adapters</span>
                <strong>{formatCount(workflowControl.capabilities.pendingAdapters?.length ?? 0)}</strong>
                <p>{compactList(workflowControl.capabilities.pendingAdapters, 'No pending adapters')}</p>
              </article>
            </div>
          ) : null}

          {adapterRows.length ? (
            <div className="ldt-inventory-table-wrap">
              <table className="ldt-inventory-table ldt-inventory-table--operations">
                <thead>
                  <tr>
                    <th>Adapter</th>
                    <th>State</th>
                    <th>Tools</th>
                    <th>Writes</th>
                  </tr>
                </thead>
                <tbody>
                  {adapterRows.map((capability) => (
                    <tr key={capability.key}>
                      <td><strong>{capability.label}</strong><span>{capability.key}</span></td>
                      <td><Badge bg={statusVariant(productLifecycleState(capability.canExecute ? 'validated' : capability.runtimeStatus === 'pending-adapter' ? 'construction' : capability.runtimeStatus))}>{titleize(productLifecycleState(capability.canExecute ? 'validated' : capability.runtimeStatus))}</Badge></td>
                      <td>{compactList((capability.tools ?? []).map((tool) => `${tool.tool}: ${tool.available ? 'ready' : 'missing'}`), 'App-native')}</td>
                      <td>{compactList(capability.writes, 'Metadata')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {selectedRun ? (
            <>
              <div className="ldt-module-panel__header">
                <h3>Selected workflow trace</h3>
                <p>{workflowLabel(selectedRun)} - {selectedRun.id}</p>
              </div>
              <div className="ldt-source-flow-grid">
                <article>
                  <span>Contract</span>
                  <strong>{selectedRunManifest?.operatorName || workflowLabel(selectedRun)}</strong>
                  <p>{selectedRunManifest?.decisionBoundary ? titleize(selectedRunManifest.decisionBoundary) : (selectedRun.workflowKey || 'Workflow run')}</p>
                </article>
                <article>
                  <span>Orchestration</span>
                  <strong>{titleize(selectedTraceState.orchestrationStatus || selectedRun.status)}</strong>
                  <p>Controller state for the workflow run.</p>
                </article>
                <article>
                  <span>Execution</span>
                  <strong>{titleize(selectedTraceState.executionStatus || 'unknown')}</strong>
                  <p>{formatCount(selectedTraceJobs.count ?? 0)} jobs, {formatCount(selectedTraceExtractorRuns.count ?? 0)} extractor runs.</p>
                </article>
                <article>
                  <span>Promotion</span>
                  <strong>{titleize(selectedTraceState.promotionStatus || 'unknown')}</strong>
                  <p>{compactList(selectedTraceWrites, 'No table writes recorded')}</p>
                </article>
                <article>
                  <span>Publication</span>
                  <strong>{titleize(selectedTraceState.publicationStatus || 'unknown')}</strong>
                  <p>{selectedTraceState.publicationStatus === 'refresh_required' ? 'Run standards publication refresh after promotion.' : 'Publication state recorded by trace.'}</p>
                </article>
                <article>
                  <span>Authority</span>
                  <strong>{titleize(selectedTraceState.authorityStatus || 'unknown')}</strong>
                  <p>{selectedRunOutput.resultChecksum || compactList(selectedRunArtifacts.map((artifact) => artifact.checksum).filter(Boolean), 'No checksum recorded')}</p>
                </article>
                <article>
                  <span>Steps</span>
                  <strong>{formatCount(selectedRunSteps.length)}</strong>
                  <p>{compactList(selectedRunSteps.map((step) => `${step.stepKey}: ${step.status}`), 'No steps loaded')}</p>
                </article>
                <article>
                  <span>Artifacts</span>
                  <strong>{formatCount(selectedRunArtifacts.length)}</strong>
                  <p>{compactList(selectedRunArtifacts.map((artifact) => `${artifact.artifactKind}${artifact.checksum ? ': checked' : ''}`), 'No artifacts loaded')}</p>
                </article>
                <article>
                  <span>Next actions</span>
                  <strong>{formatCount(selectedTraceNextActions.length)}</strong>
                  <p>{compactList(selectedTraceNextActions.map((action) => action.label), 'No next action suggested')}</p>
                </article>
              </div>
              {selectedIsModelOutputRun ? (
                <div className="ldt-model-output-run-evidence">
                  <div className="ldt-module-panel__header">
                    <h3>Model output evidence</h3>
                    <p>Derived outputs attached to OLDT entities. These values are not authority-approved unless a later review workflow accepts them.</p>
                  </div>
                  <div className="ldt-source-flow-grid">
                    <article>
                      <span>Model</span>
                      <strong>{selectedRunSummary.modelKey || selectedRunSummary.type || 'model output'}</strong>
                      <p>{selectedRunSummary.modelVersion ? `Version ${selectedRunSummary.modelVersion}` : selectedRunSummary.modelEndpoint || 'Model version not recorded'}</p>
                    </article>
                    <article>
                      <span>Route</span>
                      <strong>{selectedWorkflowKey === 'eu-ldt-data-platform-import-results' ? 'EU Data Platform roundtrip' : selectedWorkflowKey === 'eu-ldt-data-modeller-fixture-import' ? 'EU Data Modeller fixture' : 'OLDT direct KServe'}</strong>
                      <p>{selectedRunSummary.modelEndpoint || selectedRunSummary.endpoint || 'Endpoint not recorded'}</p>
                    </article>
                    <article>
                      <span>Imported</span>
                      <strong>{formatCount(selectedRunSummary.importedCount ?? selectedRunSummary.mappedCount ?? 0)}</strong>
                      <p>{formatCount(selectedRunSummary.selectedCount ?? selectedRunSummary.featureRowCount ?? 0)} selected, {formatCount(selectedRunSummary.quarantinedCount ?? selectedRunSummary.skippedCount ?? 0)} skipped/quarantined.</p>
                    </article>
                    <article>
                      <span>Output</span>
                      <strong>{selectedRunSummary.outputKey || 'model-output'}</strong>
                      <p>{selectedRunSummary.authorityStatus === 'simulated' || selectedRunSummary.featurePolicy === 'smoke-synthetic' ? 'Synthetic fixture: test evidence only.' : 'Derived model output attached to canonical entities.'}</p>
                    </article>
                    <article>
                      <span>Authority</span>
                      <strong>{titleize(selectedRunSummary.authorityStatus || 'derived-model-output')}</strong>
                      <p>{selectedRunSummary.authorityStatus === 'simulated' || selectedRunSummary.featurePolicy === 'smoke-synthetic' ? 'Not observed municipal data; generated values remain simulated.' : 'Not authority approved until accepted by a review/publication workflow.'}</p>
                    </article>
                    <article>
                      <span>Publication</span>
                      <strong>{titleize(selectedRunSummary.publicationStatus || 'refresh_required')}</strong>
                      <p>Refresh standards before claiming external/public availability.</p>
                    </article>
                  </div>
                </div>
              ) : null}
              {selectedTraceNextActions.length ? (
                <div className="ldt-inventory-table-wrap">
                  <table className="ldt-inventory-table ldt-inventory-table--operations">
                    <thead>
                      <tr>
                        <th>Next action</th>
                        <th>Why</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTraceNextActions.map((action) => (
                        <tr key={action.key || action.label}>
                          <td><strong>{action.label}</strong><span>{action.key}</span></td>
                          <td>{action.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table ldt-inventory-table--operations">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>Status</th>
                  <th>Approvals</th>
                  <th>Artifacts</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {controlledWorkflowRuns.length ? controlledWorkflowRuns.slice(0, 8).map((run) => {
                  const approvalCount = Array.isArray(run.approvals) ? run.approvals.length : run.pendingApprovals ?? 0
                  const artifactCount = Array.isArray(run.artifacts) ? run.artifacts.length : run.artifactCount ?? 0
                  const isInspecting = workflowControl.inspectingRunId === run.id
                  const isSelected = selectedRun?.id === run.id
                  const runWorkflowKey = run.canonicalWorkflowKey || run.workflowKey
                  const canExecuteFromUi = [
                    'open-source-city-builder',
                    'phase14-open-data-workflow-runner',
                    'eu-ldt-data-platform-publish',
                    'eu-ldt-data-platform-import-results',
                    'eu-ldt-data-modeller-prepare-schema',
                    'eu-ldt-data-modeller-fixture-import',
                    'eu-ldt-play-visualise-register-layer',
                  ].includes(runWorkflowKey)
                  return (
                    <tr key={run.id}>
                      <td>
                        <strong>{workflowLabel(run)}</strong>
                        <span>{run.id}</span>
                      </td>
                      <td><Badge bg={statusVariant(productLifecycleState(run.status))}>{titleize(productLifecycleState(run.status))}</Badge></td>
                      <td>{formatCount(approvalCount)}</td>
                      <td>{formatCount(artifactCount)}</td>
                      <td>{formatDate(run.updatedAt || run.createdAt)}</td>
                      <td>
                        {run.status === 'approval_required' ? (
                          <Button variant="outline-primary" size="sm" disabled={workflowControl.loading} onClick={() => approveRun(run)}>
                            Approve
                          </Button>
                        ) : null}
                        {run.status === 'queued' && canExecuteFromUi ? (
                          <Button variant="outline-success" size="sm" disabled={workflowControl.loading} onClick={() => executeRun(run)}>
                            Execute
                          </Button>
                        ) : null}
                        {run.status === 'queued' && !canExecuteFromUi ? <span>Queued</span> : null}
                        {!['approval_required', 'queued'].includes(run.status) ? <span>{titleize(run.status)}</span> : null}
                        <Button variant={isSelected ? 'primary' : 'outline-secondary'} size="sm" disabled={workflowControl.loading} onClick={() => inspectRun(run)}>
                          {isInspecting ? 'Inspecting...' : isSelected ? 'Selected' : 'Inspect'}
                        </Button>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={6}>No workflow runs loaded.</td>
                  </tr>
                )}
              </tbody>
            </table>
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

          <div className="ldt-module-panel__header">
            <h3>Workflow runs</h3>
            <p>Controlled executions that keep agents, data changes, and publication approvals separated from automatic publication.</p>
          </div>
          <div className="ldt-compact-list">
            {(operationsReport?.workflowRuns ?? workflowRuns).slice(0, 8).map((run) => (
              <div key={run.id}>
                <span>{run.workflowDomain ? titleize(run.workflowDomain) : 'Workflow'}</span>
                <strong>{run.workflowName || run.workflowKey} · {titleize(run.status)}</strong>
              </div>
            ))}
          </div>
          <ReadinessList category="operations" checksByCategory={checksByCategory} />
    </>
  )
}
