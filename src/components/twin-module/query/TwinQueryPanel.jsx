'use client'

import { useState } from 'react'
import { Button } from 'react-bootstrap'
import { ChevronDown, Database, Download, Search, Share2, X } from 'react-feather'
import { DEFAULT_QUERY_RADIUS_PERCENT, geojsonTransportNotice, semanticQueryResultLabel } from '../semanticQueryClient'
import {
  createTwinQueryClause,
  emptyIndicatorCondition,
  emptyPredicate,
  indicatorOperatorOptions,
  normalizeQueryClauses,
  normalizeQueryPredicates,
  queryClassOptions,
  queryFieldOption,
  queryFieldsForClass,
  queryHasRequiredValue,
  queryNeedsValue,
  queryOperatorOptions,
} from './queryPanelModel'

const DEFAULT_SQL_TWIN_QUERY = `semantic_class = 'buildings'
AND ST_Area(co.geom::geography) > 150`

const EXPORT_FORMAT_OPTIONS = [
  { label: 'CSV', value: 'csv' },
  { label: 'JSONL', value: 'jsonl' },
  { label: 'JSON', value: 'json' },
  { label: 'GeoJSON', value: 'geojson' },
  { label: 'CityJSON', value: 'cityjson' },
]

function sqlQueryValidation(sqlText = '') {
  const text = String(sqlText ?? '').trim()
  if (!text) return 'Enter a SQL expression.'
  if (/[;]|--|\/\*|\*\//.test(text)) return 'Only one read-only SQL expression is allowed.'
  const isSelect = /^(select|with)\b/i.test(text)
  const writeTokens = /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|execute|call|do|set|reset|vacuum|analyze|merge|into)\b/i
  if (writeTokens.test(text) || /\b(pg_|information_schema|current_setting|pg_sleep|dblink|lo_|http_|file|program)\b/i.test(text)) {
    return 'Only read-only city SQL is allowed.'
  }
  if (!isSelect && /\b(select|from|join|union|with)\b/i.test(text)) {
    return 'Use SELECT/WITH for full SQL, or a plain WHERE expression.'
  }
  return ''
}

function indicatorValueKind(indicator = {}) {
  const unit = String(indicator.unit || '').toLowerCase()
  if (unit.includes('yes/no')) return 'boolean'
  if (unit.includes('qualitative')) return 'categorical'
  return 'numeric'
}

function IndicatorConditionEditor({
  condition,
  indicatorOptions,
  onChange,
  running,
  showSubjectMode = true,
}) {
  const valueKind = condition.valueKind || 'numeric'
  const operators = indicatorOperatorOptions(valueKind)
  const operator = operators.some((entry) => entry.key === condition.operator) ? condition.operator : 'exists'
  const needsValue = Boolean(condition.indicatorKey) && operator !== 'exists'
  return (
    <div className="dt-twin-query__indicator-condition">
      {showSubjectMode ? (
        <label>
          <span>Applies to</span>
          <select
            disabled={running}
            onChange={(event) => onChange({ subjectMode: event.target.value })}
            value={condition.subjectMode === 'city' ? 'city' : 'self'}
          >
            <option value="self">Each object</option>
            <option value="city">Whole city</option>
          </select>
        </label>
      ) : null}
      <label>
        <span>Indicator</span>
        <select
          disabled={running}
          onChange={(event) => {
            const indicator = indicatorOptions.find((entry) => entry.indicatorKey === event.target.value)
            onChange({
              indicatorKey: event.target.value,
              valueKind: indicatorValueKind(indicator),
              operator: event.target.value ? 'exists' : '',
              value: '',
              valueMax: '',
            })
          }}
          value={condition.indicatorKey || ''}
        >
          <option value="">Select indicator...</option>
          {indicatorOptions.map((indicator) => (
            <option key={indicator.indicatorKey} value={indicator.indicatorKey}>
              {indicator.name} ({indicator.unit || 'value'})
            </option>
          ))}
        </select>
      </label>
      {condition.indicatorKey ? (
        <>
          <label>
            <span>Value type</span>
            <select
              disabled={running}
              onChange={(event) => onChange({ valueKind: event.target.value, operator: 'exists', value: '', valueMax: '' })}
              value={valueKind}
            >
              <option value="numeric">Numeric</option>
              <option value="boolean">Boolean</option>
              <option value="categorical">Category</option>
              <option value="ordinal">Ordinal</option>
            </select>
          </label>
          <label>
            <span>Operator</span>
            <select
              disabled={running}
              onChange={(event) => onChange({ operator: event.target.value, value: '', valueMax: '' })}
              value={operator}
            >
              {operators.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
            </select>
          </label>
        </>
      ) : null}
      {needsValue ? (
        <div className="dt-twin-query__value-row">
          <label>
            <span>Value</span>
            {valueKind === 'boolean' ? (
              <select
                disabled={running}
                onChange={(event) => onChange({ value: event.target.value === 'true' })}
                value={String(condition.value ?? '')}
              >
                <option value="">Select...</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : (
              <input
                disabled={running}
                onChange={(event) => onChange({ value: event.target.value })}
                type={valueKind === 'categorical' ? 'text' : 'number'}
                value={condition.value ?? ''}
              />
            )}
          </label>
          {operator === 'between' ? (
            <label>
              <span>To</span>
              <input
                disabled={running}
                onChange={(event) => onChange({ valueMax: event.target.value })}
                type="number"
                value={condition.valueMax ?? ''}
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function RelatedSubjectConditionEditor({
  indicatorOptions,
  onChange,
  predicate,
  relationOptions,
  running,
  subjectTypeOptions,
}) {
  const indicators = Array.isArray(predicate.indicators) && predicate.indicators.length
    ? predicate.indicators
    : [emptyIndicatorCondition(`${predicate.id}-related-indicator-1`)]
  const updateIndicator = (id, patch) => onChange({
    indicators: indicators.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
  })
  return (
    <div className="dt-twin-query__related-subject">
      <label>
        <span>Related area</span>
        <select
          disabled={running}
          onChange={(event) => onChange({ subjectTypes: event.target.value ? [event.target.value] : [] })}
          value={predicate.subjectTypes?.[0] || ''}
        >
          <option value="">Select area type...</option>
          {subjectTypeOptions.map((entry) => (
            <option key={entry.subjectType} value={entry.subjectType}>
              {entry.subjectType} ({Number(entry.count || 0).toLocaleString('en-US')})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Relationship</span>
        <select
          disabled={running}
          onChange={(event) => onChange({ relationMode: event.target.value })}
          value={predicate.relationMode || 'spatial'}
        >
          <option value="spatial">Inside / intersects</option>
          <option value="explicit">Explicit semantic link</option>
          <option value="any">Spatial or explicit</option>
        </select>
      </label>
      {predicate.relationMode === 'explicit' || predicate.relationMode === 'any' ? (
        <label>
          <span>Link type</span>
          <select
            disabled={running}
            onChange={(event) => onChange({ relationType: event.target.value })}
            value={predicate.relationType || ''}
          >
            <option value="">Any link</option>
            {relationOptions.map((entry) => (
              <option key={entry.relationType} value={entry.relationType}>{entry.relationType}</option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        <span>Indicator logic</span>
        <select
          disabled={running}
          onChange={(event) => onChange({ indicatorMode: event.target.value })}
          value={predicate.indicatorMode || 'and'}
        >
          <option value="and">All indicators</option>
          <option value="or">Any indicator</option>
        </select>
      </label>
      <div className="dt-twin-query__related-indicators">
        {indicators.map((indicator, index) => (
          <div className="dt-twin-query__related-indicator" key={indicator.id}>
            <div className="dt-twin-query__predicate-head">
              <strong>{index === 0 ? 'Area indicator' : predicate.indicatorMode === 'or' ? 'Or' : 'And'}</strong>
              {indicators.length > 1 ? (
                <button
                  disabled={running}
                  onClick={() => onChange({ indicators: indicators.filter((entry) => entry.id !== indicator.id) })}
                  type="button"
                >
                  <X size={12} />
                </button>
              ) : null}
            </div>
            <IndicatorConditionEditor
              condition={indicator}
              indicatorOptions={indicatorOptions}
              onChange={(patch) => updateIndicator(indicator.id, patch)}
              running={running}
              showSubjectMode={false}
            />
          </div>
        ))}
        <Button
          className="dt-twin-query__add"
          disabled={running || indicators.length >= 4}
          onClick={() => onChange({
            indicators: [...indicators, emptyIndicatorCondition(`${predicate.id}-related-indicator-${Date.now()}`)],
          })}
          size="sm"
          type="button"
          variant="outline-secondary"
        >
          Add area indicator
        </Button>
      </div>
    </div>
  )
}

export default function TwinQueryPanel({
  cityCoverage,
  onChange,
  onClear,
  onDataSpaceProfilesLoad,
  onDataSpacePublish,
  onExport,
  onPresetApply,
  onRun,
  onSelectionSave,
  queryBuilder = {},
  queryContract,
  queryDataSpace = { status: 'idle', profiles: [], result: null, error: '' },
  queryError = '',
  queryExport = { status: 'idle', format: 'csv', error: '' },
  queryPresets = { status: 'idle', presets: [], error: '' },
  queryResult = null,
  querySelections = { status: 'idle', selections: [], groups: [], active: null, saved: null, error: '' },
  queryStatus = 'idle',
  supportsCityScale,
}) {
  const [exportFormat, setExportFormat] = useState('csv')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [dataSpaceOpen, setDataSpaceOpen] = useState(false)
  const [dataSpaceForm, setDataSpaceForm] = useState({
    providerIntegrationProfileKey: '',
    title: '',
    description: 'Bounded OLDT TwinQuery package published as a governed EDC offer.',
    licence: 'CC-BY-4.0',
    format: 'geojson',
    limit: 500,
  })
  const classOptions = queryClassOptions(queryContract)
  const clauses = normalizeQueryClauses(queryBuilder, supportsCityScale)
  const running = queryStatus === 'running'
  const exporting = queryExport.status === 'running'
  const queryMode = queryBuilder.mode === 'sql' ? 'sql' : 'builder'
  const sqlText = typeof queryBuilder.sqlText === 'string' ? queryBuilder.sqlText : ''
  const subjectContract = queryContract?.subjectQuery ?? {}
  const subjectInventory = Array.isArray(subjectContract.inventory?.subjects) ? subjectContract.inventory.subjects : []
  const subjectIndicators = Array.isArray(subjectContract.inventory?.indicators) ? subjectContract.inventory.indicators : []
  const subjectRelations = Array.isArray(subjectContract.inventory?.relations) ? subjectContract.inventory.relations : []
  const subjectQuery = queryBuilder.subjectQuery && typeof queryBuilder.subjectQuery === 'object'
    ? queryBuilder.subjectQuery
    : {}
  const subjectFilter = subjectQuery.subject && typeof subjectQuery.subject === 'object' ? subjectQuery.subject : {}
  const subjectKind = subjectFilter.kinds?.[0] || 'context'
  const subjectType = subjectFilter.types?.[0] || ''
  const subjectTypeOptions = subjectInventory
    .filter((entry) => entry.subjectKind === 'context' && Number(entry.spatialCount || 0) > 0)
    .filter((entry, index, values) => values.findIndex((candidate) => candidate.subjectType === entry.subjectType) === index)
  const subjectIndicator = subjectQuery.indicator && typeof subjectQuery.indicator === 'object' ? subjectQuery.indicator : null
  const subjectRelation = subjectQuery.relation && typeof subjectQuery.relation === 'object' ? subjectQuery.relation : null
  const subjectResultRows = []
  const subjectResultMaximum = 1
  const presets = Array.isArray(queryPresets.presets) ? queryPresets.presets : []
  const activePresetId = typeof queryBuilder.presetId === 'string' ? queryBuilder.presetId : ''
  const sqlError = queryMode === 'sql' ? sqlQueryValidation(sqlText) : ''
  const canRun = !running && (queryMode === 'sql'
    ? !sqlError
    : clauses.every(queryHasRequiredValue))
  const canSave = !running && querySelections.status !== 'saving' && canRun
  const canExport = !running && !exporting && canRun
  const dataSpacePublishing = queryDataSpace.status === 'publishing'
  const dataSpaceProfiles = Array.isArray(queryDataSpace.profiles) ? queryDataSpace.profiles : []
  const providerProfiles = dataSpaceProfiles.filter((profile) => profile.capabilities?.role === 'provider')
  const canPublishDataSpace = canRun && !dataSpacePublishing && Boolean(dataSpaceForm.providerIntegrationProfileKey)
  const canClear = !(running && !queryResult)
  const resultLabel = queryResult ? semanticQueryResultLabel(queryResult) : 'Waiting for query'
  const geojsonNotice = queryStatus === 'ready' ? geojsonTransportNotice(queryResult) : ''
  const queryModeLabel = queryMode === 'sql'
    ? 'PostGIS SQL'
    : `${clauses.length} ${clauses.length === 1 ? 'clause' : 'clauses'} by union`
  const exportStatusLabel = queryExport.status === 'ready'
    ? `${String(queryExport.format || exportFormat).toUpperCase()} export ready`
    : queryExport.status === 'error'
      ? queryExport.error
      : ''

  const setQueryMode = (nextMode) => {
    const mode = nextMode === 'sql' ? 'sql' : 'builder'
    onChange?.({
      ...queryBuilder,
      mode,
      sqlText: mode === 'sql' && !sqlText ? DEFAULT_SQL_TWIN_QUERY : sqlText,
    })
  }
  const updateSqlText = (nextSqlText) => {
    onChange?.({
      ...queryBuilder,
      mode: 'sql',
      presetId: '',
      presetTitle: '',
      sqlText: nextSqlText,
    })
  }
  const updateClauses = (nextClauses) => {
    onChange?.({
      ...queryBuilder,
      mode: 'builder',
      operation: 'union',
      clauses: nextClauses,
    })
  }
  const updateSubjectQuery = (patch) => {
    onChange?.({
      ...queryBuilder,
      mode: 'builder',
      subjectQuery: { ...subjectQuery, ...patch },
    })
  }
  const updateClause = (clauseId, patch) => {
    updateClauses(clauses.map((clause) => (clause.id === clauseId ? { ...clause, ...patch } : clause)))
  }
  const addClause = () => {
    if (clauses.length >= 4) return
    const nextIndex = clauses.length + 1
    const nextClass = nextIndex === 2 ? 'roads' : nextIndex === 3 ? 'greenBlue' : 'accessSeeds'
    updateClauses([
      ...clauses,
      createTwinQueryClause({
        classKey: nextClass,
        id: `clause-${Date.now()}`,
        label: `Clause ${nextIndex}`,
        supportsCityScale,
      }),
    ])
  }
  const removeClause = (clauseId) => {
    if (clauses.length <= 1) return
    updateClauses(clauses.filter((clause) => clause.id !== clauseId))
  }
  const runExport = (format) => {
    setExportFormat(format)
    setExportMenuOpen(false)
    onExport?.(format)
  }
  const openDataSpace = async () => {
    const nextOpen = !dataSpaceOpen
    setDataSpaceOpen(nextOpen)
    if (!nextOpen) return
    const profiles = await onDataSpaceProfilesLoad?.()
    const nextProfiles = Array.isArray(profiles) ? profiles : dataSpaceProfiles
    const provider = nextProfiles.find((profile) => profile.capabilities?.role === 'provider')
    setDataSpaceForm((current) => ({
      ...current,
      providerIntegrationProfileKey: current.providerIntegrationProfileKey || provider?.profileKey || '',
      title: current.title || `${queryBuilder.presetTitle || 'OLDT query'} data-space package`,
    }))
  }
  const updateDataSpaceForm = (key, value) => {
    setDataSpaceForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="dt-twin-query">
      {presets.length ? (
        <label className="dt-twin-query__preset">
          <span>Saved preset</span>
          <select
            disabled={running || queryPresets.status === 'loading'}
            onChange={(event) => {
              const preset = presets.find((entry) => entry.id === event.target.value || entry.key === event.target.value)
              if (preset) onPresetApply?.(preset)
            }}
            value={activePresetId}
          >
            <option value="">Select a saved query...</option>
            {presets.map((preset) => (
              <option key={preset.id || preset.key} value={preset.id || preset.key}>
                {preset.title || preset.label || preset.id}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="dt-twin-query__mode" role="tablist" aria-label="Query mode">
        <button
          aria-selected={queryMode === 'builder'}
          className={queryMode === 'builder' ? 'is-active' : ''}
          disabled={running}
          onClick={() => setQueryMode('builder')}
          role="tab"
          type="button"
        >
          Builder
        </button>
        <button
          aria-selected={queryMode === 'sql'}
          className={queryMode === 'sql' ? 'is-active' : ''}
          disabled={running}
          onClick={() => setQueryMode('sql')}
          role="tab"
          type="button"
        >
          SQL
        </button>
      </div>
      {queryMode === 'builder' ? (
        <div className="dt-twin-query__grid">
          <div className="dt-twin-query__operation">
            <span>Composition</span>
            <strong>{clauses.length} {clauses.length === 1 ? 'clause' : 'clauses'}</strong>
          </div>
          <div className="dt-twin-query__clauses">
            {clauses.map((clause, clauseIndex) => {
              const classKey = clause.classKey || classOptions[0]?.key || 'buildings'
              const fields = queryFieldsForClass(classKey)
              const predicates = normalizeQueryPredicates(clause)
              const scopeKey = clause.scopeKey || (supportsCityScale ? 'radius' : 'city')
              const radiusPercent = Math.min(100, Math.max(0, Number(clause.radiusPercent ?? cityCoverage ?? DEFAULT_QUERY_RADIUS_PERCENT) || 0))
              const updatePredicate = (id, patch) => {
                updateClause(clause.id, {
                  predicates: predicates.map((predicate) =>
                    predicate.id === id ? { ...predicate, ...patch } : predicate,
                  ),
                })
              }
              const addPredicate = () => {
                if (predicates.length >= 4) return
                updateClause(clause.id, {
                  predicates: [
                    ...predicates,
                    emptyPredicate(`${clause.id}-predicate-${Date.now()}`),
                  ],
                })
              }
              const removePredicate = (id) => {
                updateClause(clause.id, {
                  predicates: predicates.length > 1
                    ? predicates.filter((predicate) => predicate.id !== id)
                    : predicates,
                })
              }
              return (
                <div className="dt-twin-query__clause" key={clause.id}>
                  <div className="dt-twin-query__predicate-head">
                    <strong>{clause.label || `Clause ${clauseIndex + 1}`}</strong>
                    {clauses.length > 1 ? (
                      <button
                        disabled={running}
                        onClick={() => removeClause(clause.id)}
                        type="button"
                      >
                        <X size={12} />
                      </button>
                    ) : null}
                  </div>
                  <label>
                    <span>Class</span>
                    <select
                      disabled={running}
                      onChange={(event) => updateClause(clause.id, {
                        classKey: event.target.value,
                        predicates: [emptyPredicate(`${clause.id}-predicate-1`)],
                      })}
                      value={classKey}
                    >
                      {classOptions.map((option) => (
                        <option key={option.key} value={option.key}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Scope</span>
                    <select
                      disabled={running}
                      onChange={(event) => updateClause(clause.id, { scopeKey: event.target.value })}
                      value={scopeKey}
                    >
                      {supportsCityScale ? <option value="radius">Radius</option> : null}
                      {!supportsCityScale ? <option value="city">City boundary</option> : null}
                    </select>
                  </label>
                  {supportsCityScale && scopeKey === 'radius' ? (
                    <div className="dt-twin-query__scope">
                      <label>
                        <span>Radius percent</span>
                        <input
                          disabled={running}
                          max="100"
                          min="0"
                          onChange={(event) => updateClause(clause.id, { radiusPercent: Number(event.target.value), radiusMeters: '' })}
                          onInput={(event) => updateClause(clause.id, { radiusPercent: Number(event.currentTarget.value), radiusMeters: '' })}
                          step="1"
                          type="range"
                          value={radiusPercent}
                        />
                      </label>
                      <label>
                        <span>Meters</span>
                        <input
                          disabled={running}
                          min="0"
                          onChange={(event) => updateClause(clause.id, { radiusMeters: event.target.value })}
                          placeholder="Auto"
                          step="100"
                          type="number"
                          value={clause.radiusMeters ?? ''}
                        />
                      </label>
                    </div>
                  ) : null}
                  <label>
                    <span>Logic</span>
                    <select
                      disabled={running}
                      onChange={(event) => updateClause(clause.id, { predicateMode: event.target.value })}
                      value={clause.predicateMode || 'and'}
                    >
                      <option value="and">All conditions</option>
                      <option value="or">Any condition</option>
                    </select>
                  </label>
                  <div className="dt-twin-query__predicates">
                    {predicates.map((predicate, index) => {
                      const kind = ['property', 'indicator', 'related-subject'].includes(predicate.kind) ? predicate.kind : 'property'
                      const field = fields.some((option) => option.key === predicate.field) ? predicate.field : ''
                      const fieldMeta = queryFieldOption(field)
                      const operators = queryOperatorOptions(field)
                      const operator = operators.some((option) => option.key === predicate.operator)
                        ? predicate.operator
                        : 'exists'
                      const needsValue = queryNeedsValue({ ...predicate, field, operator })
                      return (
                        <div className="dt-twin-query__predicate" key={predicate.id}>
                          <div className="dt-twin-query__predicate-head">
                            <strong>{index === 0 ? 'Condition' : clause.predicateMode === 'or' ? 'Or' : 'And'}</strong>
                            {predicates.length > 1 ? (
                              <button
                                disabled={running}
                                onClick={() => removePredicate(predicate.id)}
                                type="button"
                              >
                                <X size={12} />
                              </button>
                            ) : null}
                          </div>
                          <label>
                            <span>Condition type</span>
                            <select
                              disabled={running}
                              onChange={(event) => updatePredicate(predicate.id, {
                                ...emptyPredicate(predicate.id),
                                kind: event.target.value,
                                ...(event.target.value === 'related-subject' ? {
                                  relationMode: 'spatial',
                                  subjectTypes: [],
                                  indicatorMode: 'and',
                                  indicators: [emptyIndicatorCondition(`${predicate.id}-related-indicator-1`)],
                                } : {}),
                              })}
                              value={kind}
                            >
                              <option value="property">Object property</option>
                              <option value="indicator">Indicator value</option>
                              <option value="related-subject">Related area</option>
                            </select>
                          </label>
                          {kind === 'property' ? (
                            <>
                              <label>
                                <span>Field</span>
                                <select
                                  disabled={running}
                                  onChange={(event) => updatePredicate(predicate.id, {
                                    field: event.target.value,
                                    operator: event.target.value ? 'exists' : '',
                                    value: '',
                                    valueMax: '',
                                  })}
                                  value={field}
                                >
                                  {fields.map((option) => (
                                    <option key={option.key || 'any'} value={option.key}>{option.label}</option>
                                  ))}
                                </select>
                              </label>
                              {field ? (
                                <label>
                                  <span>Operator</span>
                                  <select
                                    disabled={running}
                                    onChange={(event) => updatePredicate(predicate.id, { operator: event.target.value, value: '', valueMax: '' })}
                                    value={operator}
                                  >
                                    {operators.map((option) => (
                                      <option key={option.key} value={option.key}>{option.label}</option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}
                              {needsValue ? (
                                <div className="dt-twin-query__value-row">
                                  <label>
                                    <span>Value</span>
                                    <input
                                      disabled={running}
                                      onChange={(event) => updatePredicate(predicate.id, { value: event.target.value })}
                                      type={fieldMeta.type === 'number' ? 'number' : 'text'}
                                      value={predicate.value ?? ''}
                                    />
                                  </label>
                                  {operator === 'between' ? (
                                    <label>
                                      <span>To</span>
                                      <input
                                        disabled={running}
                                        onChange={(event) => updatePredicate(predicate.id, { valueMax: event.target.value })}
                                        type="number"
                                        value={predicate.valueMax ?? ''}
                                      />
                                    </label>
                                  ) : null}
                                </div>
                              ) : null}
                            </>
                          ) : kind === 'indicator' ? (
                            <IndicatorConditionEditor
                              condition={predicate}
                              indicatorOptions={subjectIndicators}
                              onChange={(patch) => updatePredicate(predicate.id, patch)}
                              running={running}
                            />
                          ) : (
                            <RelatedSubjectConditionEditor
                              indicatorOptions={subjectIndicators}
                              onChange={(patch) => updatePredicate(predicate.id, patch)}
                              predicate={predicate}
                              relationOptions={subjectRelations}
                              running={running}
                              subjectTypeOptions={subjectTypeOptions}
                            />
                          )}
                        </div>
                      )
                    })}
                    <Button
                      className="dt-twin-query__add"
                      disabled={running || predicates.length >= 4}
                      onClick={addPredicate}
                      size="sm"
                      type="button"
                      variant="outline-secondary"
                    >
                      Add condition
                    </Button>
                  </div>
                </div>
              )
            })}
            <Button
              className="dt-twin-query__add"
              disabled={running || clauses.length >= 4}
              onClick={addClause}
              size="sm"
              type="button"
              variant="outline-primary"
            >
              Add clause
            </Button>
          </div>
        </div>
      ) : queryMode === 'subject' ? (
        <div className="dt-twin-query__grid">
          <div className="dt-twin-query__operation">
            <span>Semantic grain</span>
            <strong>{subjectType || subjectKind}</strong>
          </div>
          <div className="dt-twin-query__clauses">
            <div className="dt-twin-query__clause">
              <label>
                <span>Subject kind</span>
                <select
                  disabled={running}
                  onChange={(event) => updateSubjectQuery({
                    subject: {
                      ...subjectFilter,
                      kinds: [event.target.value],
                      types: [],
                      privacyClasses: ['public', 'aggregate'],
                    },
                  })}
                  value={subjectKind}
                >
                  {(subjectContract.subjectKinds ?? ['context', 'city', 'physical']).map((kind) => (
                    <option key={kind} value={kind}>{kind}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Subject type</span>
                <select
                  disabled={running}
                  onChange={(event) => updateSubjectQuery({
                    subject: { ...subjectFilter, types: event.target.value ? [event.target.value] : [] },
                  })}
                  value={subjectType}
                >
                  <option value="">All {subjectKind} subjects</option>
                  {subjectTypeOptions.map((entry) => (
                    <option key={`${entry.subjectKind}:${entry.subjectType}`} value={entry.subjectType}>
                      {entry.subjectType} ({Number(entry.count ?? 0).toLocaleString('en-US')})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Indicator</span>
                <select
                  disabled={running}
                  onChange={(event) => updateSubjectQuery({
                    indicator: event.target.value
                      ? {
                        key: event.target.value,
                        operator: 'exists',
                        valueKind: 'numeric',
                        value: '',
                        valueMax: '',
                        validationStatuses: ['validated'],
                      }
                      : null,
                  })}
                  value={subjectIndicator?.key || ''}
                >
                  <option value="">No indicator filter</option>
                  {subjectIndicators.map((indicator) => (
                    <option key={indicator.indicatorKey} value={indicator.indicatorKey}>
                      {indicator.name} ({indicator.indicatorKey})
                    </option>
                  ))}
                </select>
              </label>
              {subjectIndicator ? (
                <>
                  <label>
                    <span>Value type</span>
                    <select
                      disabled={running}
                      onChange={(event) => updateSubjectQuery({
                        indicator: { ...subjectIndicator, valueKind: event.target.value, value: '', valueMax: '' },
                      })}
                      value={subjectIndicator.valueKind || 'numeric'}
                    >
                      <option value="numeric">Numeric</option>
                      <option value="boolean">Boolean</option>
                      <option value="categorical">Category</option>
                      <option value="ordinal">Ordinal</option>
                    </select>
                  </label>
                  <label>
                    <span>Operator</span>
                    <select
                      disabled={running}
                      onChange={(event) => updateSubjectQuery({
                        indicator: { ...subjectIndicator, operator: event.target.value, value: '', valueMax: '' },
                      })}
                      value={subjectIndicator.operator || 'exists'}
                    >
                      <option value="exists">Has validated value</option>
                      <option value="gte">&gt;=</option>
                      <option value="lte">&lt;=</option>
                      <option value="gt">&gt;</option>
                      <option value="lt">&lt;</option>
                      <option value="eq">Equals</option>
                      <option value="neq">Not equal</option>
                      {subjectIndicator.valueKind === 'numeric' || subjectIndicator.valueKind === 'ordinal'
                        ? <option value="between">Between</option>
                        : null}
                    </select>
                  </label>
                  {subjectIndicator.operator !== 'exists' ? (
                    <div className="dt-twin-query__value-row">
                      <label>
                        <span>Value</span>
                        {subjectIndicator.valueKind === 'boolean' ? (
                          <select
                            disabled={running}
                            onChange={(event) => updateSubjectQuery({
                              indicator: { ...subjectIndicator, value: event.target.value === 'true' },
                            })}
                            value={String(subjectIndicator.value ?? '')}
                          >
                            <option value="">Select...</option>
                            <option value="true">True</option>
                            <option value="false">False</option>
                          </select>
                        ) : (
                          <input
                            disabled={running}
                            onChange={(event) => updateSubjectQuery({
                              indicator: { ...subjectIndicator, value: event.target.value },
                            })}
                            type={subjectIndicator.valueKind === 'categorical' ? 'text' : 'number'}
                            value={subjectIndicator.value ?? ''}
                          />
                        )}
                      </label>
                      {subjectIndicator.operator === 'between' ? (
                        <label>
                          <span>To</span>
                          <input
                            disabled={running}
                            onChange={(event) => updateSubjectQuery({
                              indicator: { ...subjectIndicator, valueMax: event.target.value },
                            })}
                            type="number"
                            value={subjectIndicator.valueMax ?? ''}
                          />
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
              <label>
                <span>Relationship</span>
                <select
                  disabled={running}
                  onChange={(event) => updateSubjectQuery({
                    relation: event.target.value
                      ? { type: event.target.value, direction: 'outgoing', targetKinds: [], targetTypes: [], minimumCount: 1 }
                      : null,
                  })}
                  value={subjectRelation?.type || ''}
                >
                  <option value="">No relationship filter</option>
                  {subjectRelations.map((relation) => (
                    <option key={relation.relationType} value={relation.relationType}>
                      {relation.relationType} ({Number(relation.count ?? 0).toLocaleString('en-US')})
                    </option>
                  ))}
                </select>
              </label>
              {subjectRelation ? (
                <div className="dt-twin-query__value-row">
                  <label>
                    <span>Direction</span>
                    <select
                      disabled={running}
                      onChange={(event) => updateSubjectQuery({ relation: { ...subjectRelation, direction: event.target.value } })}
                      value={subjectRelation.direction || 'outgoing'}
                    >
                      <option value="outgoing">Outgoing</option>
                      <option value="incoming">Incoming</option>
                    </select>
                  </label>
                  <label>
                    <span>Minimum links</span>
                    <input
                      disabled={running}
                      min="1"
                      onChange={(event) => updateSubjectQuery({
                        relation: { ...subjectRelation, minimumCount: Number(event.target.value) },
                      })}
                      type="number"
                      value={subjectRelation.minimumCount ?? 1}
                    />
                  </label>
                </div>
              ) : null}
              <label>
                <span>View</span>
                <select
                  disabled={running}
                  onChange={(event) => updateSubjectQuery({
                    render: { ...(subjectQuery.render ?? {}), mode: event.target.value, maxFeatures: 500 },
                  })}
                  value={subjectQuery.render?.mode || 'auto'}
                >
                  <option value="auto">Auto</option>
                  <option value="map">Map</option>
                  <option value="choropleth">Choropleth</option>
                  <option value="network">Network</option>
                  <option value="chart">Chart</option>
                  <option value="table">Table</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      ) : (
        <div className="dt-twin-query__sql">
          <label>
            <span>PostGIS SQL</span>
            <textarea
              disabled={running}
              onChange={(event) => updateSqlText(event.target.value)}
              spellCheck="false"
              value={sqlText}
            />
          </label>
          {sqlError ? <small className="is-error">{sqlError}</small> : null}
        </div>
      )}
      <div className="dt-twin-query__actions">
        <Button
          className="dt-sidebar-button"
          disabled={!canRun}
          onClick={onRun}
          variant="primary"
        >
          <Search size={14} />
          <span>{running ? 'Running' : 'Run query'}</span>
        </Button>
      </div>
      <div className={queryStatus === 'error' ? 'dt-twin-query__status is-error' : 'dt-twin-query__status'}>
        <span>{queryStatus === 'ready' ? resultLabel : queryStatus === 'running' ? 'Running query' : queryError || 'Waiting for query'}</span>
        <small>{queryModeLabel}</small>
      </div>
      {queryMode === 'subject' && queryStatus === 'ready' && queryResult?.manifest ? (
        <div className="dt-subject-query-result">
          <div className="dt-subject-query-result__head">
            <span>{queryResult.manifest.selectedRenderer}</span>
            <strong>{Number(queryResult.summary?.resultCount ?? 0).toLocaleString('en-US')}</strong>
          </div>
          {subjectResultRows.map((row) => {
            const rawNumericValue = row.value ?? (subjectRelation ? row.relationCount : null)
            const numericValue = Number(rawNumericValue)
            const hasNumericValue = rawNumericValue !== null && rawNumericValue !== undefined && Number.isFinite(numericValue)
            const displayValue = row.valueText ?? (row.booleanValue == null ? null : String(row.booleanValue))
              ?? (hasNumericValue ? `${numericValue.toLocaleString('en-US')}${row.unit ? ` ${row.unit}` : ''}` : row.subjectType || 'No value')
            const width = hasNumericValue ? Math.max(2, Math.round((Math.abs(numericValue) / subjectResultMaximum) * 100)) : 0
            return (
              <div className="dt-subject-query-result__row" key={row.subjectKey}>
                <div>
                  <span>{row.label || row.subjectKey}</span>
                  <strong>{displayValue}</strong>
                </div>
                {hasNumericValue ? <i aria-hidden="true" style={{ width: `${width}%` }} /> : null}
              </div>
            )
          })}
        </div>
      ) : null}
      <div className="dt-twin-query__toolbar" aria-label="Query result actions">
        <button
          aria-label={querySelections.status === 'saving' ? 'Saving answer' : queryMode === 'subject' ? 'Save semantic question' : 'Save answer'}
          className="dt-query-action"
          disabled={!canSave}
          onClick={onSelectionSave}
          title={querySelections.status === 'saving' ? 'Saving answer' : queryMode === 'subject' ? 'Save semantic question' : 'Save answer'}
          type="button"
        >
          <Database size={14} />
          <span className="visually-hidden">{querySelections.status === 'saving' ? 'Saving' : 'Save'}</span>
        </button>
        <div className="dt-twin-query__export-menu">
          <button
            aria-label={exporting ? 'Downloading query export' : 'Download query export'}
            aria-expanded={exportMenuOpen}
            className="dt-query-action dt-query-action--download"
            disabled={!canExport}
            onClick={() => setExportMenuOpen((current) => !current)}
            title={exporting ? 'Downloading query export' : 'Download query export'}
            type="button"
          >
            <Download size={14} />
            <span className="visually-hidden">{exporting ? 'Downloading' : 'Download'}</span>
            <ChevronDown size={12} />
          </button>
          {exportMenuOpen ? (
            <div className="dt-twin-query__export-options" role="menu">
              {EXPORT_FORMAT_OPTIONS.map((option) => (
                <button
                  className={exportFormat === option.value ? 'is-active' : ''}
                  key={option.value}
                  onClick={() => runExport(option.value)}
                  role="menuitem"
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          aria-expanded={dataSpaceOpen}
          aria-label={dataSpacePublishing ? 'Publishing query to data space' : 'Publish query to data space'}
          className="dt-query-action dt-query-action--icon"
          disabled={queryMode === 'subject' || !canRun || dataSpacePublishing}
          onClick={openDataSpace}
          title={dataSpacePublishing ? 'Publishing to data space' : 'Publish to data space'}
          type="button"
        >
          <Share2 size={14} />
          <span className="visually-hidden">Data space</span>
        </button>
        <button
          aria-label="Clear query"
          className="dt-query-action dt-query-action--icon"
          disabled={!canClear}
          onClick={onClear}
          title="Clear query"
          type="button"
        >
          <X size={14} />
        </button>
      </div>
      {dataSpaceOpen ? (
        <div className="dt-twin-query__data-space">
          <div className="dt-twin-query__data-space-head">
            <strong>Publish to data space</strong>
            <button aria-label="Close data-space publication" onClick={() => setDataSpaceOpen(false)} type="button">
              <X size={13} />
            </button>
          </div>
          <label>
            <span>Provider</span>
            <select
              disabled={dataSpacePublishing || queryDataSpace.status === 'loading'}
              onChange={(event) => updateDataSpaceForm('providerIntegrationProfileKey', event.target.value)}
              value={dataSpaceForm.providerIntegrationProfileKey}
            >
              <option value="">Select provider...</option>
              {providerProfiles.map((profile) => (
                <option key={profile.profileKey} value={profile.profileKey}>{profile.displayName}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Title</span>
            <input
              disabled={dataSpacePublishing}
              onChange={(event) => updateDataSpaceForm('title', event.target.value)}
              value={dataSpaceForm.title}
            />
          </label>
          <div className="dt-twin-query__data-space-row">
            <label>
              <span>Format</span>
              <select
                disabled={dataSpacePublishing}
                onChange={(event) => updateDataSpaceForm('format', event.target.value)}
                value={dataSpaceForm.format}
              >
                <option value="geojson">GeoJSON</option>
                <option value="cityjson">CityJSON</option>
                <option value="json">JSON</option>
                <option value="jsonl">JSONL</option>
                <option value="csv">CSV</option>
              </select>
            </label>
            <label>
              <span>Rows</span>
              <input
                disabled={dataSpacePublishing}
                max="5000"
                min="1"
                onChange={(event) => updateDataSpaceForm('limit', Number(event.target.value))}
                type="number"
                value={dataSpaceForm.limit}
              />
            </label>
          </div>
          <label>
            <span>Licence</span>
            <input
              disabled={dataSpacePublishing}
              onChange={(event) => updateDataSpaceForm('licence', event.target.value)}
              value={dataSpaceForm.licence}
            />
          </label>
          <Button
            className="dt-sidebar-button"
            disabled={!canPublishDataSpace}
            onClick={() => onDataSpacePublish?.(dataSpaceForm)}
            size="sm"
            type="button"
            variant="primary"
          >
            <Share2 size={14} />
            <span>{dataSpacePublishing ? 'Publishing' : 'Publish offer'}</span>
          </Button>
          {queryDataSpace.status === 'loading' ? <small>Loading configured participants...</small> : null}
          {queryDataSpace.error ? <small className="is-error">{queryDataSpace.error}</small> : null}
          {queryDataSpace.result ? (
            <div className="dt-twin-query__data-space-result">
              <strong>Published</strong>
              <span>{queryDataSpace.result.assetId}</span>
              <small>{queryDataSpace.result.rowCount} rows / {queryDataSpace.result.publicationStatus} / awaiting consumer</small>
              <small>Provider: {queryDataSpace.result.providerParticipantId}</small>
              {queryDataSpace.result.catalogExplorerUrl ? (
                <a href={queryDataSpace.result.catalogExplorerUrl} rel="noreferrer" target="_blank">
                  Open consumer catalog
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {exportStatusLabel ? (
        <div className={queryExport.status === 'error' ? 'dt-twin-query__export-status is-error' : 'dt-twin-query__export-status'}>
          <span>{exportStatusLabel}</span>
        </div>
      ) : null}
      {geojsonNotice ? (
        <div className="dt-twin-query__status is-warning">
          <span>GeoJSON preview limit active</span>
          <small>{geojsonNotice}</small>
        </div>
      ) : null}
    </div>
  )
}
