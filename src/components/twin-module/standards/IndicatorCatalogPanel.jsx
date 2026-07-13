'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Spinner } from 'react-bootstrap'
import { CheckCircle, Filter, RefreshCw, Search, Shield, Target } from 'react-feather'

const stateMeta = {
  ready: { label: 'Ready', variant: 'success' },
  partial: { label: 'Partial', variant: 'warning', text: 'dark' },
  blocked: { label: 'Blocked', variant: 'danger' },
  'not-applicable': { label: 'N/A', variant: 'secondary' },
}

function number(value) {
  return new Intl.NumberFormat('en-US').format(Number(value ?? 0))
}

async function responseJson(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body?.ok === false) throw new Error(body?.detail || body?.error || `HTTP_${response.status}`)
  return body
}

function definitionMatches(definition, query, state) {
  if (state !== 'all' && definition.validation?.state !== state) return false
  if (!query) return true
  const haystack = [
    definition.externalCode,
    definition.name,
    definition.definition,
    definition.dimension,
    definition.subdimension,
    definition.indicatorKey,
  ].join(' ').toLowerCase()
  return haystack.includes(query.toLowerCase())
}

function requirementSummary(definition) {
  const missing = definition.validation?.missingRequirements ?? []
  if (missing.length) return missing[0].label || missing[0].detail || 'Required evidence is missing'
  const warnings = definition.validation?.warnings ?? []
  if (warnings.length) return warnings[0]
  if (definition.validation?.valueReady) return 'Validated city value available'
  if (definition.validation?.calculationReady) return 'Formula inputs available'
  return 'Run validation to assess this city'
}

export default function IndicatorCatalogPanel({ cityId }) {
  const [state, setState] = useState({ loading: true, error: '', data: null })
  const [catalogKey, setCatalogKey] = useState('')
  const [query, setQuery] = useState('')
  const [validationState, setValidationState] = useState('all')
  const [action, setAction] = useState({ loading: false, error: '', message: '' })
  const [threshold, setThreshold] = useState({ indicatorKey: '', comparison: 'gte', value: '', high: '' })
  const [thresholdResult, setThresholdResult] = useState({ loading: false, error: '', data: null })

  const loadCatalogs = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const data = await fetch('/api/live/current/standards/indicator-catalogs', { credentials: 'same-origin' }).then(responseJson)
      setState({ loading: false, error: '', data })
      setCatalogKey((current) => {
        if (current && data.catalogs?.some((catalog) => catalog.catalogKey === current)) return current
        return data.catalogs?.find((catalog) => catalog.catalogKey === 'u4ssc')?.catalogKey
          || data.catalogs?.[0]?.catalogKey
          || ''
      })
    } catch (error) {
      setState({ loading: false, error: String(error?.message ?? 'INDICATOR_CATALOGS_UNAVAILABLE'), data: null })
    }
  }, [])

  useEffect(() => {
    loadCatalogs()
  }, [cityId, loadCatalogs])

  const selectedCatalog = useMemo(() => (
    state.data?.catalogs?.find((catalog) => catalog.catalogKey === catalogKey) ?? null
  ), [catalogKey, state.data])
  const definitions = useMemo(() => (
    (selectedCatalog?.definitions ?? []).filter((definition) => definitionMatches(definition, query, validationState))
  ), [query, selectedCatalog, validationState])
  const mapIndicators = useMemo(() => (
    (state.data?.catalogs ?? []).flatMap((catalog) => catalog.definitions ?? [])
      .filter((definition) => definition.validation?.mapReady)
  ), [state.data])
  const summary = selectedCatalog?.validation ?? {
    total: selectedCatalog?.indicatorCount ?? 0,
    ready: 0,
    partial: 0,
    blocked: 0,
    withValidatedValue: 0,
    mapQueryable: 0,
    calculablePercent: 0,
  }

  useEffect(() => {
    setThreshold((current) => {
      if (current.indicatorKey && mapIndicators.some((indicator) => indicator.indicatorKey === current.indicatorKey)) return current
      return { ...current, indicatorKey: mapIndicators[0]?.indicatorKey ?? '' }
    })
  }, [mapIndicators])

  async function runCatalogAction(kind) {
    if (!cityId) return
    setAction({ loading: true, error: '', message: '' })
    try {
      const response = kind === 'sync-u4ssc'
        ? await fetch('/api/admin/indicator-catalogs/import', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityId, adapterKey: 'cip-u4ssc', catalogKey: 'u4ssc', validate: true }),
        })
        : await fetch(`/api/admin/indicator-catalogs/${encodeURIComponent(catalogKey)}/validate`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cityId }),
        })
      const result = await responseJson(response)
      await loadCatalogs()
      const resultSummary = result.validation ?? result.summary
      setAction({
        loading: false,
        error: '',
        message: resultSummary
          ? `${number(resultSummary.ready)} ready, ${number(resultSummary.partial)} partial, ${number(resultSummary.blocked)} blocked.`
          : 'Catalog updated.',
      })
    } catch (error) {
      setAction({ loading: false, error: String(error?.message ?? 'INDICATOR_CATALOG_ACTION_FAILED'), message: '' })
    }
  }

  async function runThresholdQuery(event) {
    event.preventDefault()
    if (!threshold.indicatorKey || threshold.value === '') return
    setThresholdResult({ loading: true, error: '', data: null })
    try {
      const params = new URLSearchParams({
        comparison: threshold.comparison,
        value: threshold.value,
        limit: '250',
      })
      if (['between', 'outside'].includes(threshold.comparison)) params.set('high', threshold.high)
      const result = await fetch(
        `/api/live/current/standards/indicators/${encodeURIComponent(threshold.indicatorKey)}/entity-values?${params}`,
        { credentials: 'same-origin' },
      ).then(responseJson)
      setThresholdResult({ loading: false, error: '', data: result })
    } catch (error) {
      setThresholdResult({ loading: false, error: String(error?.message ?? 'INDICATOR_THRESHOLD_QUERY_FAILED'), data: null })
    }
  }

  return (
    <section className="ldt-indicator-catalog" aria-labelledby="indicator-catalog-title">
      <div className="ldt-indicator-catalog__header">
        <div>
          <span>Indicator compatibility</span>
          <h2 id="indicator-catalog-title">Catalog and city readiness</h2>
        </div>
        <div className="ldt-action-row ldt-action-row--compact">
          <button className="btn btn-outline-secondary btn-sm" disabled={action.loading || state.loading} onClick={loadCatalogs} title="Refresh indicator catalogs" type="button">
            <RefreshCw aria-hidden="true" size={15} /> Refresh
          </button>
          <button className="btn btn-outline-secondary btn-sm" disabled={action.loading || !catalogKey} onClick={() => runCatalogAction('validate')} type="button">
            <Shield aria-hidden="true" size={15} /> Validate
          </button>
          <button className="btn btn-primary btn-sm" disabled={action.loading} onClick={() => runCatalogAction('sync-u4ssc')} type="button">
            {action.loading ? <Spinner animation="border" size="sm" /> : <RefreshCw aria-hidden="true" size={15} />} Sync U4SSC
          </button>
        </div>
      </div>

      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      {action.error ? <Alert variant="danger">{action.error}</Alert> : null}
      {action.message ? <Alert variant="success">{action.message}</Alert> : null}

      <div className="ldt-indicator-catalog__metrics">
        <div><span>Indicators</span><strong>{state.loading ? '...' : number(summary.total)}</strong></div>
        <div><span>Ready</span><strong>{state.loading ? '...' : number(summary.ready)}</strong></div>
        <div><span>Partial</span><strong>{state.loading ? '...' : number(summary.partial)}</strong></div>
        <div><span>Blocked</span><strong>{state.loading ? '...' : number(summary.blocked)}</strong></div>
        <div><span>Validated values</span><strong>{state.loading ? '...' : number(summary.withValidatedValue)}</strong></div>
        <div><span>Map queryable</span><strong>{state.loading ? '...' : number(summary.mapQueryable)}</strong></div>
        <div><span>Calculable</span><strong>{state.loading ? '...' : `${Number(summary.calculablePercent ?? 0).toFixed(1)}%`}</strong></div>
      </div>

      <div className="ldt-indicator-catalog__toolbar">
        <label>
          <span>Catalog</span>
          <select className="form-select form-select-sm" onChange={(event) => setCatalogKey(event.target.value)} value={catalogKey}>
            {(state.data?.catalogs ?? []).map((catalog) => (
              <option key={catalog.catalogKey} value={catalog.catalogKey}>{catalog.title} ({catalog.indicatorCount})</option>
            ))}
          </select>
        </label>
        <label className="ldt-indicator-catalog__search">
          <span>Find indicator</span>
          <div><Search aria-hidden="true" size={15} /><input className="form-control form-control-sm" onChange={(event) => setQuery(event.target.value)} placeholder="Code, name or dimension" type="search" value={query} /></div>
        </label>
        <label>
          <span><Filter aria-hidden="true" size={14} /> State</span>
          <select className="form-select form-select-sm" onChange={(event) => setValidationState(event.target.value)} value={validationState}>
            <option value="all">All states</option>
            <option value="ready">Ready</option>
            <option value="partial">Partial</option>
            <option value="blocked">Blocked</option>
            <option value="not-applicable">Not applicable</option>
          </select>
        </label>
      </div>

      <div className="ldt-indicator-catalog__table-wrap">
        <table className="ldt-indicator-catalog__table">
          <thead>
            <tr><th>Indicator</th><th>Dimension</th><th>Difficulty</th><th>State</th><th>City evidence</th><th>Value</th></tr>
          </thead>
          <tbody>
            {definitions.map((definition) => {
              const status = stateMeta[definition.validation?.state] ?? { label: 'Not validated', variant: 'secondary' }
              return (
                <tr key={definition.membershipId}>
                  <td><strong>{definition.externalCode}</strong><span>{definition.name}</span></td>
                  <td><strong>{definition.dimension}</strong><span>{definition.subdimension || 'General'}</span></td>
                  <td><Badge bg="light" text="dark">{definition.difficulty}</Badge><span>{definition.implementationTier}</span></td>
                  <td><Badge bg={status.variant} text={status.text}>{status.label}</Badge><span>{Math.round(Number(definition.validation?.readinessScore ?? 0) * 100)}%</span></td>
                  <td><span>{requirementSummary(definition)}</span><small>{definition.requirements.length} requirements</small></td>
                  <td>
                    {definition.observation ? <strong>{definition.observation.value ?? 'JSON'} {definition.observation.unit ?? definition.unit ?? ''}</strong> : <span>No current value</span>}
                    <small>{definition.validation?.mapReady ? 'Map queryable' : definition.observation?.validationStatus ?? 'No observation'}</small>
                  </td>
                </tr>
              )
            })}
            {!state.loading && !definitions.length ? <tr><td className="ldt-indicator-catalog__empty" colSpan="6">No indicators match the current filters.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <form className="ldt-indicator-threshold" onSubmit={runThresholdQuery}>
        <div className="ldt-indicator-threshold__title"><Target aria-hidden="true" size={17} /><div><strong>Entity threshold query</strong><span>Validated values inside the active municipal boundary</span></div></div>
        <label><span>Indicator</span><select className="form-select form-select-sm" disabled={!mapIndicators.length} onChange={(event) => setThreshold((current) => ({ ...current, indicatorKey: event.target.value }))} value={threshold.indicatorKey}>{mapIndicators.map((indicator) => <option key={indicator.indicatorKey} value={indicator.indicatorKey}>{indicator.name}</option>)}</select></label>
        <label><span>Operator</span><select className="form-select form-select-sm" onChange={(event) => setThreshold((current) => ({ ...current, comparison: event.target.value }))} value={threshold.comparison}><option value="gte">At least</option><option value="gt">Greater than</option><option value="lte">At most</option><option value="lt">Less than</option><option value="eq">Equal</option><option value="between">Between</option><option value="outside">Outside</option></select></label>
        <label><span>Value</span><input className="form-control form-control-sm" disabled={!mapIndicators.length} onChange={(event) => setThreshold((current) => ({ ...current, value: event.target.value }))} step="any" type="number" value={threshold.value} /></label>
        {['between', 'outside'].includes(threshold.comparison) ? <label><span>High</span><input className="form-control form-control-sm" onChange={(event) => setThreshold((current) => ({ ...current, high: event.target.value }))} step="any" type="number" value={threshold.high} /></label> : null}
        <button className="btn btn-primary btn-sm" disabled={!mapIndicators.length || thresholdResult.loading || threshold.value === ''} type="submit">{thresholdResult.loading ? <Spinner animation="border" size="sm" /> : <CheckCircle aria-hidden="true" size={15} />} Run query</button>
        {!mapIndicators.length ? <span className="ldt-indicator-threshold__status">No validated entity values are available.</span> : null}
        {thresholdResult.error ? <span className="ldt-indicator-threshold__status is-error">{thresholdResult.error}</span> : null}
        {thresholdResult.data ? <span className="ldt-indicator-threshold__status">{number(thresholdResult.data.values?.length)} entities matched.</span> : null}
      </form>
    </section>
  )
}
