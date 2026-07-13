'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from 'react-bootstrap'
import IndicatorCatalogPanel from '../../standards/IndicatorCatalogPanel'
import { formatCount, formatDate, statusVariant, titleize } from '../ldtWorkspaceModel'

const SMART_DATA_MODEL_TYPES = {
  building: 'Building',
  road: 'Road',
  facility: 'CivicStructure',
  place: 'PointOfInterest',
}

function endpointFromDistribution(distribution) {
  return distribution?.['dcat:downloadURL'] || distribution?.['dcat:accessURL'] || ''
}

function sameOriginUrl(url) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}`
    }
    return url
  } catch {
    return url
  }
}

function findDistribution(distributions, predicate) {
  return distributions.find((distribution) => predicate({
    title: String(distribution?.['dct:title'] ?? ''),
    mediaType: String(distribution?.['dcat:mediaType'] ?? ''),
    format: String(distribution?.['dct:format'] ?? ''),
  }))
}

function compactVersion(version) {
  const text = String(version || '').trim()
  if (!text) return 'unversioned'
  return text.length > 34 ? `${text.slice(0, 31)}...` : text
}

function modelOutputTotals(modelOutputs) {
  return modelOutputs.reduce((totals, model) => ({
    entityCount: totals.entityCount + model.entityCount,
    outputCount: totals.outputCount + model.outputCount,
  }), { entityCount: 0, outputCount: 0 })
}

function uniqueList(values) {
  return Array.from(new Set((values ?? []).filter(Boolean))).sort()
}

function joinOrFallback(values, fallback = 'none') {
  const list = uniqueList(values)
  return list.length ? list.join(', ') : fallback
}

function modelOutputRows(dcatCatalog) {
  const datasets = dcatCatalog?.['dcat:dataset'] ?? []
  return datasets
    .filter((dataset) => (
      String(dataset?.['dct:identifier'] ?? '').includes('model-enrichment') ||
      dataset?.['tbs:metadata']?.sourceTable === 'ldt_enrichment.entity_model_outputs'
    ))
    .map((dataset) => {
      const metadata = dataset?.['tbs:metadata'] ?? {}
      const distributions = dataset?.['dcat:distribution'] ?? []
      const entityTypes = metadata.entityTypes ?? []
      const collectionKeys = metadata.collectionKeys ?? []
      const outputKeys = metadata.outputKeys ?? []
      const confidenceStatuses = metadata.confidenceStatuses ?? []
      const authorityStatuses = metadata.authorityStatuses ?? []
      const modelKey = metadata.modelKey ?? dataset?.['dct:identifier'] ?? 'model-output'
      const modelVersion = metadata.modelVersion ?? ''
      const viewerPresetId = metadata.viewerPresetId || metadata.queryPresetId || ''
      const collectionKey = collectionKeys[0]
      const ngsiType = SMART_DATA_MODEL_TYPES[entityTypes[0]] ?? ''
      const csvDistribution = findDistribution(distributions, ({ mediaType, format }) => (
        mediaType.includes('text/csv') || format.toLowerCase() === 'csv'
      ))
      const ogcDistribution = findDistribution(distributions, ({ title, mediaType }) => (
        title.toLowerCase().includes('ogc') || mediaType.includes('geo+json')
      ))
      const ngsiDistribution = findDistribution(distributions, ({ title, mediaType }) => (
        title.toLowerCase().includes('ngsi') || mediaType.includes('ld+json')
      ))
      const csvUrl = sameOriginUrl(endpointFromDistribution(csvDistribution))
      const ogcUrl = collectionKey
        ? `/api/live/current/standards/ogc/collections/${collectionKey}/items?limit=1000`
        : sameOriginUrl(endpointFromDistribution(ogcDistribution))
      const ogcSampleUrl = collectionKey
        ? `/api/live/current/standards/ogc/collections/${collectionKey}/items?limit=1`
        : sameOriginUrl(endpointFromDistribution(ogcDistribution))
      const ngsiSampleUrl = ngsiType
        ? `/api/live/current/standards/ngsi-ld/entities?type=${encodeURIComponent(ngsiType)}&limit=1`
        : sameOriginUrl(endpointFromDistribution(ngsiDistribution)) || '/api/live/current/standards/ngsi-ld/entities?limit=1'
      return {
        id: dataset?.['dct:identifier'] ?? modelKey,
        title: dataset?.['dct:title'] ?? modelKey,
        modelKey,
        modelVersion,
        viewerPresetId,
        entityTypes,
        collectionKeys,
        outputKeys,
        confidenceStatuses,
        authorityStatuses,
        entityCount: Number(metadata.entityCount ?? 0),
        outputCount: Number(metadata.outputCount ?? 0),
        csvUrl,
        ogcUrl,
        ogcSampleUrl,
        ngsiSampleUrl,
        mapUrl: viewerPresetId ? `/analytical-map?queryPreset=${encodeURIComponent(viewerPresetId)}&run=1` : '',
        quality: dataset?.['tbs:quality']?.[0]?.statement ?? '',
        workflowRunIds: metadata.workflowRunIds ?? [],
        sourceArtifactIds: metadata.sourceArtifactIds ?? [],
        latestGeneratedAt: metadata.latestGeneratedAt ?? dataset?.['dct:modified'] ?? '',
        latestIngestedAt: metadata.latestIngestedAt ?? dataset?.['dct:modified'] ?? '',
      }
    })
}

function modelContractRows(modelOutputs) {
  const contracts = new Map()
  modelOutputs.forEach((model) => {
    const current = contracts.get(model.modelKey) ?? {
      modelKey: model.modelKey,
      versions: [],
      entityTypes: [],
      collectionKeys: [],
      outputKeys: [],
      confidenceStatuses: [],
      authorityStatuses: [],
      workflowRunIds: [],
      sourceArtifactIds: [],
      entityCount: 0,
      outputCount: 0,
      latestGeneratedAt: '',
      outputRows: [],
    }
    current.versions.push(model.modelVersion)
    current.entityTypes.push(...(model.entityTypes ?? []))
    current.collectionKeys.push(...(model.collectionKeys ?? []))
    current.outputKeys.push(...(model.outputKeys ?? []))
    current.confidenceStatuses.push(...(model.confidenceStatuses ?? []))
    current.authorityStatuses.push(...(model.authorityStatuses ?? []))
    current.workflowRunIds.push(...(model.workflowRunIds ?? []))
    current.sourceArtifactIds.push(...(model.sourceArtifactIds ?? []))
    current.entityCount += Number(model.entityCount ?? 0)
    current.outputCount += Number(model.outputCount ?? 0)
    current.outputRows.push(model)
    if (!current.latestGeneratedAt || String(model.latestGeneratedAt ?? '') > String(current.latestGeneratedAt)) {
      current.latestGeneratedAt = model.latestGeneratedAt
    }
    contracts.set(model.modelKey, current)
  })
  return Array.from(contracts.values()).map((contract) => ({
    ...contract,
    versions: uniqueList(contract.versions),
    entityTypes: uniqueList(contract.entityTypes),
    collectionKeys: uniqueList(contract.collectionKeys),
    outputKeys: uniqueList(contract.outputKeys),
    confidenceStatuses: uniqueList(contract.confidenceStatuses),
    authorityStatuses: uniqueList(contract.authorityStatuses),
    workflowRunIds: uniqueList(contract.workflowRunIds),
    sourceArtifactIds: uniqueList(contract.sourceArtifactIds),
  })).sort((a, b) => a.modelKey.localeCompare(b.modelKey))
}

function modelContractState(contract) {
  if (contract.confidenceStatuses.includes('smoke-synthetic')) {
    return {
      label: 'Test contract',
      variant: 'danger',
      summary: 'Visible for debugging, but not a client or authority deliverable.',
    }
  }
  if (contract.authorityStatuses.includes('authority-approved')) {
    return {
      label: 'Authority approved',
      variant: 'success',
      summary: 'Approved output can be treated as an authority-backed product.',
    }
  }
  return {
    label: 'External model contract',
    variant: 'warning',
    text: 'dark',
    summary: 'External or derived model integration. Published through OLDT standards with explicit provenance.',
  }
}

function modelPolicyBadges(model) {
  const confidenceStatuses = model.confidenceStatuses?.length ? model.confidenceStatuses : ['unknown-confidence']
  const authorityStatuses = model.authorityStatuses?.length ? model.authorityStatuses : ['derived-model-output']
  return [
    ...authorityStatuses.map((status) => ({
      key: `authority:${status}`,
      label: status === 'derived-model-output' ? 'Derived model output' : titleize(status),
      variant: status === 'authority-approved' ? 'success' : 'warning',
      text: status === 'authority-approved' ? undefined : 'dark',
    })),
    ...confidenceStatuses.map((status) => ({
      key: `confidence:${status}`,
      label: status === 'smoke-synthetic'
        ? 'Smoke-synthetic features'
        : status === 'external-platform-derived'
          ? 'External platform derived'
          : titleize(status),
      variant: status === 'smoke-synthetic' ? 'danger' : status === 'external-platform-derived' ? 'info' : 'secondary',
      text: status === 'external-platform-derived' ? 'dark' : undefined,
    })),
  ]
}

function modelPolicySummary(model) {
  const confidenceStatuses = model.confidenceStatuses ?? []
  if (confidenceStatuses.includes('smoke-synthetic')) return 'Test output only. Input energy and CO2 features were synthetic.'
  if (confidenceStatuses.includes('external-platform-derived')) return 'Imported from EU Data Platform and reconciled to OLDT entities.'
  return 'Review method, confidence, warnings, and authority before publication claims.'
}

function StandardsActionButton({ children, href, download }) {
  if (!href) return null
  return (
    <a className="btn btn-outline-secondary btn-sm" download={download} href={href}>
      {children}
    </a>
  )
}

function standardsStatusLabel(status) {
  const value = String(status ?? '').toLowerCase()
  if (value === 'construction') return 'Planned'
  if (value === 'blocked') return 'Needs setup'
  return titleize(status)
}

function standardsReadinessSummary(row) {
  const count = Number(row.count ?? 0)
  const countText = count > 0 ? `${formatCount(count)} ${row.output.toLowerCase()}` : 'No generated output yet'
  return `${countText}. ${row.coverage} Next: ${row.next}`
}

function openApiTagRows(openApiDocument) {
  const tagCounts = new Map()
  Object.values(openApiDocument?.paths ?? {}).forEach((pathItem) => {
    Object.values(pathItem ?? {}).forEach((operation) => {
      if (!operation || typeof operation !== 'object') return
      const tags = Array.isArray(operation.tags) && operation.tags.length ? operation.tags : ['untagged']
      tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1))
    })
  })
  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, count]) => ({ tag, count }))
}

function dcatDatasetRows(dcatCatalog) {
  return (dcatCatalog?.['dcat:dataset'] ?? [])
    .slice(0, 6)
    .map((dataset) => ({
      id: dataset?.['dct:identifier'] ?? dataset?.['@id'] ?? dataset?.['dct:title'] ?? 'dataset',
      title: dataset?.['dct:title'] ?? dataset?.['dct:identifier'] ?? 'Untitled dataset',
      license: dataset?.['dct:license'] ?? dataset?.['tbs:licenses']?.[0]?.licenseName ?? 'license not declared',
    }))
}

function ChannelPreviewPanel({
  card,
  copiedKey,
  dcatCatalog,
  onCopy,
  openApiDocument,
  standardsRows,
}) {
  if (!card) return null
  const row = standardsRows.find((item) => item.key === card.rowKey)
  const rowCount = Number(row?.count ?? 0)
  const openApiTags = card.key === 'openapi' ? openApiTagRows(openApiDocument) : []
  const dcatRows = card.key === 'dcat' ? dcatDatasetRows(dcatCatalog) : []

  return (
    <section className="ldt-channel-preview" aria-live="polite">
      <div className="ldt-channel-preview__header">
        <div>
          <span>{card.eyebrow}</span>
          <h3>{card.title}</h3>
          <p>{card.previewSummary}</p>
        </div>
        <div className="ldt-action-row ldt-action-row--compact">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => onCopy(`${card.key}:raw`, card.href)}
            type="button"
          >
            {copiedKey === `${card.key}:raw` ? 'Copied' : 'Copy URL'}
          </button>
          <a className="btn btn-outline-secondary btn-sm" href={card.href} rel="noreferrer" target="_blank">
            Raw endpoint
          </a>
        </div>
      </div>

      {card.key === 'openapi' ? (
        <div className="ldt-channel-preview__grid">
          <div>
            <span>Contract</span>
            <strong>{openApiDocument?.info?.title ?? 'Twin Base Studio City API'}</strong>
            <p>{formatCount(Object.keys(openApiDocument?.paths ?? {}).length)} paths, OpenAPI {openApiDocument?.openapi ?? '3.1'}.</p>
          </div>
          <div>
            <span>Main groups</span>
            <ul>
              {openApiTags.map((item) => (
                <li key={item.tag}>{item.tag}: {formatCount(item.count)} operations</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {card.key === 'dcat' ? (
        <div className="ldt-channel-preview__grid">
          <div>
            <span>Catalog contents</span>
            <strong>{formatCount(dcatCatalog?.['dcat:dataset']?.length ?? 0)} datasets</strong>
            <p>Discovery metadata for datasets, licenses, distributions, quality statements, and source posture.</p>
          </div>
          <div>
            <span>Sample datasets</span>
            <ul>
              {dcatRows.map((dataset) => (
                <li key={dataset.id}>{dataset.title}: {dataset.license}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {card.key === 'ogc' ? (
        <div className="ldt-channel-preview__grid">
          <div>
            <span>Collections</span>
            <strong>{formatCount(rowCount)} feature collections</strong>
            <p>{row?.coverage ?? 'Queryable GeoJSON feature collections for city objects.'}</p>
          </div>
          <div>
            <span>Useful samples</span>
            <div className="ldt-action-row ldt-action-row--compact">
              <a className="btn btn-outline-secondary btn-sm" href="/api/live/current/standards/ogc/collections/buildings/items?limit=25" rel="noreferrer" target="_blank">Buildings GeoJSON</a>
              <a className="btn btn-outline-secondary btn-sm" href="/api/live/current/standards/ogc/collections/roads/items?limit=25" rel="noreferrer" target="_blank">Roads GeoJSON</a>
            </div>
          </div>
        </div>
      ) : null}

      {card.key === 'ngsi' ? (
        <div className="ldt-channel-preview__grid">
          <div>
            <span>Context entities</span>
            <strong>{formatCount(rowCount)} projections</strong>
            <p>{row?.coverage ?? 'NGSI-LD entities for brokers and downstream integrations.'}</p>
          </div>
          <div>
            <span>Useful samples</span>
            <div className="ldt-action-row ldt-action-row--compact">
              <a className="btn btn-outline-secondary btn-sm" href="/api/live/current/standards/ngsi-ld/entities?type=Building&limit=25" rel="noreferrer" target="_blank">Building entities</a>
              <a className="btn btn-outline-secondary btn-sm" href="/api/live/current/standards/ngsi-ld/entities?limit=25" rel="noreferrer" target="_blank">All entity sample</a>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default function StandardsWorkspacePanel({
  capabilityLoading = false,
  cityId,
  counts,
  dcatCatalog,
  openApiDocument,
  standardsRows,
  technicalDefaultOpen = false,
}) {
  const [copiedKey, setCopiedKey] = useState('')
  const [activeChannel, setActiveChannel] = useState('')
  const modelOutputs = useMemo(() => modelOutputRows(dcatCatalog), [dcatCatalog])
  const modelContracts = useMemo(() => modelContractRows(modelOutputs), [modelOutputs])
  const modelTotals = useMemo(() => modelOutputTotals(modelOutputs), [modelOutputs])
  const contractReadinessRows = useMemo(() => standardsRows.map((row) => ({
    ...row,
    summary: standardsReadinessSummary(row),
  })), [standardsRows])
  const apiPathCount = useMemo(() => (
    Object.keys(openApiDocument?.paths ?? {}).length
  ), [openApiDocument])
  const dcatDatasetCount = dcatCatalog?.['dcat:dataset']?.length ?? counts.datasets

  function countMetric(value, label, loading = capabilityLoading) {
    if (loading && (value === undefined || value === null)) return 'Loading...'
    return `${formatCount(value ?? 0)} ${label}`
  }

  const contractCards = [
    {
      key: 'openapi',
      rowKey: 'openapi',
      eyebrow: 'Core channel',
      title: 'OpenAPI 3.1',
      description: 'Developer contract for city APIs, workflows, standards outputs, and operations endpoints.',
      previewSummary: 'Human-readable summary of the city API contract, plus a raw OpenAPI endpoint for tools.',
      metric: openApiDocument ? `${formatCount(apiPathCount)} paths` : 'Loading...',
      href: '/api/live/current/openapi.json',
    },
    {
      key: 'dcat',
      rowKey: 'dcat',
      eyebrow: 'Discovery channel',
      title: 'DCAT JSON-LD',
      description: 'Dataset discovery package with licenses, distributions, quality signals, and city-level metadata.',
      previewSummary: 'Catalog preview for datasets and licenses, with raw DCAT JSON-LD available for portals.',
      metric: countMetric(dcatDatasetCount, 'datasets', capabilityLoading && !dcatCatalog),
      href: '/api/live/current/standards/dcat',
    },
    {
      key: 'ogc',
      rowKey: 'ogc',
      eyebrow: 'Geospatial channel',
      title: 'OGC API Features',
      description: 'GeoJSON collections for GIS tools, analytics clients, viewers, and external data teams.',
      previewSummary: 'GIS-facing feature collection preview with links to sample GeoJSON features.',
      metric: countMetric(counts.ogcCollections, 'collections'),
      href: '/api/live/current/standards/ogc/collections',
    },
    {
      key: 'ngsi',
      rowKey: 'ngsi',
      eyebrow: 'Context channel',
      title: 'NGSI-LD / FIWARE',
      description: 'Context-entity projection for brokers and downstream systems that consume smart data models.',
      previewSummary: 'Context-entity preview for FIWARE-style consumers and broker integration checks.',
      metric: countMetric(counts.ngsiProjections, 'projections'),
      href: '/api/live/current/standards/ngsi-ld/entities?limit=25',
    },
  ]
  const selectedChannel = contractCards.find((card) => card.key === activeChannel)

  async function copyEndpoint(key, url) {
    if (!url || typeof navigator === 'undefined' || !navigator.clipboard) return
    const fullUrl = url.startsWith('http')
      ? url
      : `${window.location.origin}${url}`
    await navigator.clipboard.writeText(fullUrl)
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey(''), 1600)
  }

  return (
    <section className="ldt-module-panel ldt-standards-home">
      <div className="ldt-module-panel__header">
        <h2>Core publication channels</h2>
        <p>
          These are the stable rails for publishing Guanajuato twin data. Model outputs and
          country-specific standards profiles map onto these channels instead of becoming new
          top-level interfaces by default.
        </p>
      </div>

      <div className="ldt-standards-action-grid">
        {contractCards.map((card) => (
          <article className={`ldt-standards-action-card${activeChannel === card.key ? ' is-active' : ''}`} key={card.key}>
            <div className="ldt-standards-action-card__head">
              <span>{card.eyebrow}</span>
              <strong>{card.title}</strong>
            </div>
            <p>{card.description}</p>
            <div className="ldt-standards-action-card__footer">
              <small>{card.metric}</small>
              <div className="ldt-standards-action-card__actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveChannel(card.key)}
                  type="button"
                >
                  {activeChannel === card.key ? 'Previewing' : 'Preview'}
                </button>
                <a className="btn btn-outline-secondary btn-sm" href={card.href} rel="noreferrer" target="_blank">Raw</a>
              </div>
            </div>
          </article>
        ))}
      </div>

      <ChannelPreviewPanel
        card={selectedChannel}
        copiedKey={copiedKey}
        dcatCatalog={dcatCatalog}
        onCopy={copyEndpoint}
        openApiDocument={openApiDocument}
        standardsRows={standardsRows}
      />

      <IndicatorCatalogPanel cityId={cityId} />

      <div className="ldt-technical-stack">
        <details className="ldt-technical-section" open={modelOutputs.length > 0}>
          <summary>
            <span>External model contracts and outputs</span>
            <Badge bg={modelContracts.length ? 'warning' : 'secondary'} text={modelContracts.length ? 'dark' : undefined}>
              {formatCount(modelContracts.length)}
            </Badge>
          </summary>
          {modelOutputs.length ? (
            <div className="ldt-model-output-section">
              <p className="ldt-technical-note">
                External model contracts define the integration surface: which city objects are sent or reconciled,
                which outputs come back, which standards expose them, and which policy says whether they are tests,
                derived outputs, or authority-approved products.
              </p>
              <div className="ldt-model-output-summary">
                <div><span>Model contracts</span><strong>{formatCount(modelContracts.length)}</strong></div>
                <div><span>Published versions</span><strong>{formatCount(modelOutputs.length)}</strong></div>
                <div><span>Objects touched</span><strong>{formatCount(modelTotals.entityCount)}</strong></div>
                <div><span>Output values</span><strong>{formatCount(modelTotals.outputCount)}</strong></div>
              </div>
              <div className="ldt-inventory-table-wrap ldt-model-output-table-wrap">
                <table className="ldt-inventory-table ldt-model-output-table">
                  <thead>
                    <tr>
                      <th>External model contract</th>
                      <th>Scope</th>
                      <th>Returned outputs</th>
                      <th>Published via</th>
                      <th>Policy</th>
                      <th>Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelContracts.map((contract) => {
                      const contractState = modelContractState(contract)
                      return (
                        <tr key={contract.modelKey}>
                          <td>
                            <strong>{contract.modelKey}</strong>
                            <span>{formatCount(contract.versions.length)} versions: {joinOrFallback(contract.versions, 'unversioned')}</span>
                          </td>
                          <td>
                            <span>{joinOrFallback(contract.collectionKeys)}</span>
                            <small>{joinOrFallback(contract.entityTypes, 'unknown entity')}</small>
                          </td>
                          <td>
                            <div className="ldt-model-output-tags">
                              {contract.outputKeys.map((key) => <Badge bg="light" text="dark" key={key}>{key}</Badge>)}
                            </div>
                          </td>
                          <td>
                            <div className="ldt-model-output-tags">
                              {['DCAT', 'CSV', 'OGC', 'NGSI-LD', 'OpenAPI'].map((channel) => <Badge bg="secondary" key={channel}>{channel}</Badge>)}
                            </div>
                            <small>{formatCount(contract.entityCount)} objects, {formatCount(contract.outputCount)} values</small>
                          </td>
                          <td>
                            <Badge bg={contractState.variant} text={contractState.text}>{contractState.label}</Badge>
                            <small>{contractState.summary}</small>
                          </td>
                          <td>
                            <span>{contract.workflowRunIds.length ? `Runs: ${contract.workflowRunIds.slice(0, 2).join(', ')}${contract.workflowRunIds.length > 2 ? '...' : ''}` : 'No workflow run linked'}</span>
                            <small>{contract.sourceArtifactIds.length ? `Artifacts: ${contract.sourceArtifactIds.length}` : `Latest: ${formatDate(contract.latestGeneratedAt)}`}</small>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="ldt-inventory-table-wrap ldt-model-output-table-wrap">
                <table className="ldt-inventory-table ldt-model-output-table">
                  <thead>
                    <tr>
                      <th>Published output dataset</th>
                      <th>Scope</th>
                      <th>Outputs</th>
                      <th>Counts</th>
                      <th>Policy</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelOutputs.map((model) => (
                      <tr key={model.id}>
                        <td>
                          <strong>{model.modelKey}</strong>
                          <span>{compactVersion(model.modelVersion)}</span>
                          <small>{model.workflowRunIds?.length ? `Run ${model.workflowRunIds[0]}` : `Generated ${formatDate(model.latestGeneratedAt)}`}</small>
                        </td>
                        <td>
                          <span>{model.collectionKeys.join(', ') || 'none'}</span>
                          <small>{model.entityTypes.join(', ') || 'unknown entity'}</small>
                        </td>
                        <td>
                          <div className="ldt-model-output-tags">
                            {model.outputKeys.map((key) => <Badge bg="light" text="dark" key={key}>{key}</Badge>)}
                          </div>
                        </td>
                        <td>
                          <span>{formatCount(model.entityCount)} objects</span>
                          <small>{formatCount(model.outputCount)} values</small>
                        </td>
                        <td>
                          <div className="ldt-model-output-tags">
                            {modelPolicyBadges(model).map((badge) => (
                              <Badge bg={badge.variant} key={badge.key} text={badge.text}>{badge.label}</Badge>
                            ))}
                            {!model.authorityStatuses?.includes('authority-approved') ? <Badge bg="secondary">Not authority approved</Badge> : null}
                          </div>
                          <small>{modelPolicySummary(model)}</small>
                        </td>
                        <td>
                          <div className="ldt-action-row ldt-action-row--compact">
                            <StandardsActionButton download href={model.csvUrl}>Download CSV</StandardsActionButton>
                            <StandardsActionButton download href={model.ogcUrl}>Download GeoJSON</StandardsActionButton>
                            <StandardsActionButton href={model.ngsiSampleUrl}>NGSI sample</StandardsActionButton>
                            <StandardsActionButton href={model.ogcSampleUrl}>OGC sample</StandardsActionButton>
                            {model.mapUrl ? <Link className="btn btn-outline-secondary btn-sm" href={model.mapUrl}>Open map preset</Link> : null}
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => copyEndpoint(`${model.id}:csv`, model.csvUrl)}
                              type="button"
                            >
                              {copiedKey === `${model.id}:csv` ? 'Copied' : 'Copy CSV URL'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="ldt-technical-note">No derived model-output datasets are currently published for this city.</p>
          )}
        </details>

        <details className="ldt-technical-section">
          <summary>
            <span>Profile adapters</span>
            <Badge bg="secondary">0</Badge>
          </summary>
          <div className="ldt-profile-empty">
            <strong>No jurisdiction or client-specific adapters are configured for this city.</strong>
            <p>
              Add EU, Chile, Argentina, Mexico, procurement, or client profiles only when there
              is a concrete schema, validation rule, or delivery contract. Each adapter should map
              onto the publication channels above instead of creating another visible silo.
            </p>
          </div>
        </details>

        <details className="ldt-technical-section" open={technicalDefaultOpen}>
          <summary>
            <span>Endpoint inventory</span>
            <Badge bg="secondary">{formatCount(standardsRows.length)}</Badge>
          </summary>
          <div className="ldt-inventory-table-wrap">
            <table className="ldt-inventory-table">
              <thead>
                <tr>
                  <th>Standard</th>
                  <th>Output</th>
                  <th>Count</th>
                  <th>Endpoint</th>
                  <th>Coverage</th>
                  <th>State</th>
                  <th>Next</th>
                </tr>
              </thead>
              <tbody>
                {standardsRows.map((row) => (
                  <tr key={row.key}>
                    <td><strong>{row.name}</strong></td>
                    <td>{row.output}</td>
                    <td>{formatCount(row.count)}</td>
                    <td>
                      {row.endpoint.startsWith('/') && !row.endpoint.includes('{') ? (
                        <Link className="ldt-inline-link" href={row.endpoint}>{row.endpoint}</Link>
                      ) : (
                        <span>{row.endpoint}</span>
                      )}
                    </td>
                    <td>{row.coverage}</td>
                    <td><Badge bg={statusVariant(row.status)}>{standardsStatusLabel(row.status)}</Badge></td>
                    <td>{row.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <details className="ldt-technical-section" open={technicalDefaultOpen}>
          <summary>
            <span>Contract readiness</span>
            <Badge bg="secondary">{formatCount(contractReadinessRows.length)}</Badge>
          </summary>
          {contractReadinessRows.length ? (
            <div className="ldt-status-list">
              {contractReadinessRows.map((row) => (
                <div className="ldt-status-list__item" key={row.key}>
                  <Badge bg={statusVariant(row.status)}>{standardsStatusLabel(row.status)}</Badge>
                  <div>
                    <strong>{row.name}</strong>
                    <span>{row.summary}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="ldt-technical-note">
              {capabilityLoading ? 'Loading standards contract readiness.' : 'No standards contract readiness rows available.'}
            </p>
          )}
        </details>
      </div>
    </section>
  )
}
