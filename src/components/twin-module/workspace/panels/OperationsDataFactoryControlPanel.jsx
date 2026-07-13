import { Badge, Button } from 'react-bootstrap'
import {
  compactList,
  formatByteSize,
  formatCount,
  formatDate,
  productLifecycleState,
  statusVariant,
  titleize,
} from '../ldtWorkspaceModel'

function nodeStatusVariant(status) {
  const value = String(status ?? '').toLowerCase()
  if (value === 'online') return 'success'
  if (value === 'busy') return 'info'
  if (['error', 'failed'].includes(value)) return 'danger'
  if (['offline', 'disabled', 'draining'].includes(value)) return 'dark'
  return 'warning'
}

function doctorStatusVariant(status) {
  const value = String(status ?? '').toLowerCase()
  if (value === 'passed') return 'success'
  if (value === 'failed') return 'danger'
  if (value === 'warning') return 'warning'
  return 'secondary'
}

function shortChecksum(value) {
  const checksum = String(value ?? '').trim()
  if (!checksum) return 'No checksum'
  return checksum.replace(/^sha256:/, '').slice(0, 16)
}

function stageSummary(stages = []) {
  return stages.reduce((summary, stage) => {
    const state = productLifecycleState(stage.state)
    return {
      ...summary,
      [state]: Number(summary[state] ?? 0) + 1,
    }
  }, {})
}

function promotionState(handoff = {}) {
  const postgis = handoff.postgisPromotionStatus || 'pending'
  const viewer = handoff.viewerPromotionStatus || 'pending'
  if (postgis === 'succeeded' || viewer === 'succeeded') return 'validated'
  if ([postgis, viewer, handoff.resultStatus, handoff.externalRunStatus].includes('failed')) return 'blocked'
  if (handoff.resultStatus || handoff.dispatchReturnStatus) return 'generated'
  return 'generated'
}

function buildRecentLogRows({ offlineHandoffs = [], ingestionRows = [], workflowRuns = [] }) {
  const handoffRows = offlineHandoffs.map((handoff) => ({
    key: `handoff-${handoff.runId}`,
    label: `Data Factory ${handoff.stageKey || 'stage'}`,
    status: handoff.resultStatus || handoff.dispatchStatus || handoff.status || handoff.workflowStatus,
    detail: compactList([
      handoff.dispatchStatus ? `dispatch ${handoff.dispatchStatus}` : null,
      handoff.dispatchReturnStatus ? `return ${handoff.dispatchReturnStatus}` : null,
      handoff.postgisPromotionStatus ? `PostGIS ${handoff.postgisPromotionStatus}` : null,
      handoff.viewerPromotionStatus ? `artifacts ${handoff.viewerPromotionStatus}` : null,
    ], 'Handoff recorded'),
    updatedAt: handoff.updatedAt || handoff.createdAt,
  }))

  const ingestionLogRows = ingestionRows.slice(0, 6).map((row) => ({
    key: `ingestion-${row.key}`,
    label: `Ingestion ${row.layer}`,
    status: row.status,
    detail: `${row.provider || 'Provider'} / ${row.format || 'format pending'}`,
    updatedAt: row.updatedAt,
  }))

  const workflowRows = workflowRuns.slice(0, 6).map((run) => ({
    key: `workflow-${run.id}`,
    label: run.workflowName || run.workflowKey || 'Workflow',
    status: run.status,
    detail: compactList([
      run.workflowDomain,
      run.approvals?.length ? `${run.approvals.length} approvals` : null,
      run.artifacts?.length ? `${run.artifacts.length} artifacts` : null,
    ], 'Workflow run'),
    updatedAt: run.updatedAt || run.createdAt,
  }))

  return [...handoffRows, ...ingestionLogRows, ...workflowRows]
    .filter((row) => row.updatedAt)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10)
}

export default function OperationsDataFactoryControlPanel({
  dataFactory,
  ensureSameServerSidecarProvider,
  ingestionRows = [],
  prepareCityInputPackage,
  prepareDataFactoryProviderRun,
  processingNodes = [],
  refreshDataFactoryControl,
  viewerArtifacts = [],
  viewerArtifactSummary = {},
  workflowControl,
  workflowRuns = [],
}) {
  const stages = dataFactory?.stages ?? []
  const offlineHandoffs = dataFactory?.offlineHandoffs ?? []
  const cityInputPackages = dataFactory?.cityInputPackages ?? []
  const cityInputSummary = dataFactory?.cityInputPackageSummary ?? {}
  const latestCityInputPackage = cityInputSummary.latest ?? cityInputPackages[0] ?? null
  const stageCounts = stageSummary(stages)
  const onlineNodes = processingNodes.filter((node) => node.status === 'online')
  const passedDoctors = processingNodes.filter((node) => node.latestHeartbeat?.doctorStatus === 'passed')
  const activeIngestionRows = ingestionRows.filter((row) => ['queued', 'running', 'registered'].includes(row.status))
  const promotionRows = offlineHandoffs.filter((handoff) => (
    handoff.resultStatus
    || handoff.dispatchReturnStatus
    || handoff.postgisPromotionStatus
    || handoff.viewerPromotionStatus
  ))
  const recentLogRows = buildRecentLogRows({ offlineHandoffs, ingestionRows, workflowRuns })
  const artifactTypes = Object.entries(viewerArtifactSummary.byType ?? {})
    .map(([type, count]) => `${type}: ${formatCount(count)}`)

  return (
    <>
      <div className="ldt-module-panel__header">
        <h3>Data Factory control plane</h3>
        <p>Processing nodes, runtime health, jobs, artifact publication, and promotion evidence for the active city.</p>
      </div>
      <div className="ldt-action-row">
        <Button
          variant="outline-primary"
          size="sm"
          disabled={workflowControl.loading}
          onClick={() => refreshDataFactoryControl?.('Data Factory control refreshed')}
        >
          Refresh control plane
        </Button>
        <Button
          variant="outline-success"
          size="sm"
          disabled={workflowControl.loading || !ensureSameServerSidecarProvider}
          onClick={ensureSameServerSidecarProvider}
        >
          Ensure same-server node
        </Button>
        <Button
          variant="outline-info"
          size="sm"
          disabled={workflowControl.loading || !prepareCityInputPackage}
          onClick={prepareCityInputPackage}
        >
          Prepare city input package
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={workflowControl.loading || !prepareDataFactoryProviderRun}
          onClick={() => prepareDataFactoryProviderRun?.({
            stageKey: 'viewer-artifacts',
            providerType: 'server-to-server-pull',
            cityInputPolicy: 'reuse-latest-or-create',
            artifactTransferPolicy: {
              transferMode: 'runtime-bundle',
              activationMode: 'staged',
            },
            promotionPolicy: 'stage-applicator',
            runPolicy: 'dispatch-only',
          })}
        >
          Prepare provider run
        </Button>
      </div>

      <div className="ldt-source-flow-grid">
        <article>
          <span>Processing nodes</span>
          <strong>{formatCount(processingNodes.length)} registered</strong>
          <p>{formatCount(onlineNodes.length)} online, {formatCount(passedDoctors.length)} doctor passed.</p>
        </article>
        <article>
          <span>Jobs</span>
          <strong>{formatCount(offlineHandoffs.length)} handoffs</strong>
          <p>{formatCount(activeIngestionRows.length)} active ingestion jobs and {formatCount(stages.length)} contracted stages.</p>
        </article>
        <article>
          <span>Viewer artifacts</span>
          <strong>{formatCount(viewerArtifactSummary.total || viewerArtifacts.length)}</strong>
          <p>{compactList(artifactTypes, 'No published artifact summary loaded')}</p>
        </article>
        <article>
          <span>Data input</span>
          <strong>{titleize(cityInputSummary.inputMode || 'not-packaged')}</strong>
          <p>{latestCityInputPackage ? `${formatByteSize(latestCityInputPackage.byteSize)} package ready for restore.` : 'No restorable city input package registered yet.'}</p>
        </article>
        <article>
          <span>Promotions</span>
          <strong>{formatCount(promotionRows.length)} with return evidence</strong>
          <p>{formatCount(stageCounts.validated)} validated, {formatCount(stageCounts.generated)} generated, {formatCount(stageCounts.blocked)} blocked stages.</p>
        </article>
      </div>

      <div className="ldt-module-panel__header">
        <h3>City input packages</h3>
        <p>Restorable PostGIS input packages prepared for Data Factory processing nodes.</p>
      </div>
      <div className="ldt-inventory-table-wrap">
        <table className="ldt-inventory-table ldt-inventory-table--operations">
          <thead>
            <tr>
              <th>Package</th>
              <th>Input mode</th>
              <th>Size</th>
              <th>Checksum</th>
              <th>Generated</th>
              <th>Restore</th>
            </tr>
          </thead>
          <tbody>
            {cityInputPackages.length ? cityInputPackages.map((cityPackage) => (
              <tr key={cityPackage.id || cityPackage.artifactUri}>
                <td>
                  <strong>{cityPackage.packageKey || cityPackage.artifactUri}</strong>
                  <span>{cityPackage.artifactUri}</span>
                </td>
                <td>
                  <strong>{titleize(cityPackage.inputMode || 'restored-postgis-dump')}</strong>
                  <span>{cityPackage.mediaType || 'application/gzip'}</span>
                </td>
                <td>
                  <strong>{formatByteSize(cityPackage.byteSize)}</strong>
                  {cityPackage.dumpByteSize ? <span>Dump {formatByteSize(cityPackage.dumpByteSize)}</span> : null}
                </td>
                <td>
                  <strong>{shortChecksum(cityPackage.checksum)}</strong>
                  {cityPackage.dumpChecksum ? <span>Dump {shortChecksum(cityPackage.dumpChecksum)}</span> : null}
                </td>
                <td>{formatDate(cityPackage.generatedAt || cityPackage.createdAt)}</td>
                <td>{cityPackage.restoreCommand || 'Restore command pending'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6}>No city input package prepared yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ldt-module-panel__header">
        <h3>Processing nodes</h3>
        <p>Registered Data Factory runtimes and their latest heartbeat/doctor posture.</p>
      </div>
      <div className="ldt-inventory-table-wrap">
        <table className="ldt-inventory-table ldt-inventory-table--operations">
          <thead>
            <tr>
              <th>Node</th>
              <th>Provider</th>
              <th>Status</th>
              <th>Doctor</th>
              <th>Artifact store</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {processingNodes.length ? processingNodes.map((node) => (
              <tr key={node.id || node.nodeKey}>
                <td>
                  <strong>{node.displayName || node.nodeKey}</strong>
                  <span>{node.nodeKey}</span>
                </td>
                <td>
                  <strong>{titleize(node.providerType)}</strong>
                  <span>{titleize(node.connectionMode)} / {titleize(node.runtimeKind)}</span>
                </td>
                <td><Badge bg={nodeStatusVariant(node.status)}>{titleize(node.status)}</Badge></td>
                <td>
                  <Badge bg={doctorStatusVariant(node.latestHeartbeat?.doctorStatus)}>
                    {titleize(node.latestHeartbeat?.doctorStatus || 'unknown')}
                  </Badge>
                  <span>{node.latestHeartbeat?.runningJobCount ?? 0} running jobs</span>
                  {node.latestHeartbeat?.freeDiskBytes ? <span>{formatByteSize(node.latestHeartbeat.freeDiskBytes)} free</span> : null}
                </td>
                <td>
                  <strong>{node.artifactStore?.displayName || node.artifactStore?.storeKey || 'No store'}</strong>
                  <span>{node.artifactStore ? titleize(node.artifactStore.storeType) : 'Store not linked'}</span>
                </td>
                <td>{formatDate(node.lastSeenAt || node.latestHeartbeat?.observedAt || node.updatedAt)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6}>No Data Factory processing nodes registered yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ldt-module-panel__header">
        <h3>Artifacts and promotions</h3>
        <p>Published viewer artifacts and returned Data Factory promotion evidence.</p>
      </div>
      <div className="ldt-inventory-table-wrap">
        <table className="ldt-inventory-table ldt-inventory-table--operations">
          <thead>
            <tr>
              <th>Artifact</th>
              <th>Type</th>
              <th>Status</th>
              <th>Size</th>
              <th>Checksum</th>
              <th>Generated</th>
            </tr>
          </thead>
          <tbody>
            {viewerArtifacts.length ? viewerArtifacts.slice(0, 8).map((artifact) => {
              const lifecycle = productLifecycleState(artifact.active ? 'validated' : artifact.status)
              return (
                <tr key={artifact.id || `${artifact.artifactKey}-${artifact.version}`}>
                  <td>
                    <strong>{artifact.artifactKey}</strong>
                    <span>{artifact.version || 'version pending'}</span>
                  </td>
                  <td>
                    <strong>{artifact.artifactType}</strong>
                    <span>{artifact.transport || 'transport pending'}</span>
                  </td>
                  <td><Badge bg={statusVariant(lifecycle)}>{artifact.active ? 'Active' : titleize(lifecycle)}</Badge></td>
                  <td>{formatByteSize(artifact.byteSize)}</td>
                  <td>{shortChecksum(artifact.checksum)}</td>
                  <td>{formatDate(artifact.generatedAt || artifact.updatedAt)}</td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={6}>No viewer artifacts loaded in the control plane yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ldt-inventory-table-wrap">
        <table className="ldt-inventory-table ldt-inventory-table--operations">
          <thead>
            <tr>
              <th>Run</th>
              <th>Stage</th>
              <th>Dispatch</th>
              <th>Result</th>
              <th>PostGIS</th>
              <th>Artifacts</th>
            </tr>
          </thead>
          <tbody>
            {promotionRows.length ? promotionRows.map((handoff) => (
              <tr key={`promotion-${handoff.runId}`}>
                <td>
                  <strong>{handoff.runId}</strong>
                  <span>{formatDate(handoff.updatedAt || handoff.createdAt)}</span>
                </td>
                <td>{titleize(handoff.stageKey)}</td>
                <td>
                  <Badge bg={statusVariant(productLifecycleState(handoff.dispatchStatus || handoff.dispatchReturnStatus))}>
                    {titleize(handoff.dispatchStatus || handoff.dispatchReturnStatus || 'pending')}
                  </Badge>
                  {handoff.dispatchExecutorProfile ? <span>{titleize(handoff.dispatchExecutorProfile)}</span> : null}
                </td>
                <td>
                  <Badge bg={statusVariant(productLifecycleState(handoff.resultStatus))}>
                    {titleize(handoff.resultStatus || 'pending')}
                  </Badge>
                  {handoff.resultChecksum ? <span>{shortChecksum(handoff.resultChecksum)}</span> : null}
                </td>
                <td><Badge bg={statusVariant(promotionState(handoff))}>{titleize(handoff.postgisPromotionStatus || 'pending')}</Badge></td>
                <td><Badge bg={statusVariant(promotionState(handoff))}>{titleize(handoff.viewerPromotionStatus || 'pending')}</Badge></td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6}>No returned promotion evidence yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ldt-module-panel__header">
        <h3>Recent control log</h3>
        <p>Condensed events from handoffs, ingestion jobs, and workflow runs.</p>
      </div>
      <div className="ldt-inventory-table-wrap">
        <table className="ldt-inventory-table ldt-inventory-table--operations">
          <thead>
            <tr>
              <th>Event</th>
              <th>Status</th>
              <th>Detail</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {recentLogRows.length ? recentLogRows.map((row) => (
              <tr key={row.key}>
                <td><strong>{row.label}</strong></td>
                <td><Badge bg={statusVariant(productLifecycleState(row.status))}>{titleize(row.status || 'generated')}</Badge></td>
                <td>{row.detail}</td>
                <td>{formatDate(row.updatedAt)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4}>No recent Data Factory control events loaded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
