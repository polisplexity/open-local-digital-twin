'use client'

import { useId } from 'react'
import { Button } from 'react-bootstrap'
import { ChevronDown, Database, Search, X } from 'react-feather'
import { semanticQueryResultLabel } from '../semanticQueryClient'
import {
  createTwinQueryClause,
  emptyPredicate,
  normalizeQueryClauses,
  normalizeQueryPredicates,
  queryClassOptions,
  queryFieldOption,
  queryFieldsForClass,
  queryHasRequiredValue,
  queryNeedsValue,
  queryOperatorOptions,
} from './queryPanelModel'

function QueryPanelSection({ children, defaultOpen = true, icon: Icon, id, title }) {
  const reactId = useId().replaceAll(':', '')
  const panelId = `${id}-${reactId}-panel`
  const toggleId = `${id}-${reactId}-toggle`

  return (
    <section className="dt-query-section">
      <input
        className="dt-query-section__toggle"
        defaultChecked={defaultOpen}
        id={toggleId}
        type="checkbox"
      />
      <label className="dt-query-section__header" htmlFor={toggleId}>
        {Icon ? <Icon size={14} /> : null}
        <span>{title}</span>
        <ChevronDown className="dt-query-section__chevron" size={14} />
      </label>
      <div className="dt-query-section__body" id={panelId}>
        {children}
      </div>
    </section>
  )
}

export default function TwinQueryPanel({
  cityCoverage,
  onChange,
  onClear,
  onRun,
  onSelectionSave,
  queryBuilder = {},
  queryContract,
  queryError = '',
  queryResult = null,
  querySelections = { status: 'idle', selections: [], groups: [], active: null, saved: null, error: '' },
  queryStatus = 'idle',
  supportsCityScale,
}) {
  const classOptions = queryClassOptions(queryContract)
  const clauses = normalizeQueryClauses(queryBuilder, supportsCityScale)
  const running = queryStatus === 'running'
  const canRun = !running && clauses.every(queryHasRequiredValue)
  const resultLabel = queryResult ? semanticQueryResultLabel(queryResult) : 'Waiting for query'

  const updateClauses = (nextClauses) => {
    onChange?.({
      ...queryBuilder,
      operation: 'union',
      clauses: nextClauses,
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

  return (
    <div className="dt-twin-query">
      <QueryPanelSection icon={Search} id="twin-query-builder" title="Query">
        <div className="dt-twin-query__grid">
          <div className="dt-twin-query__operation">
            <span>Union query</span>
            <strong>{clauses.length} {clauses.length === 1 ? 'clause' : 'clauses'}</strong>
          </div>
          <div className="dt-twin-query__clauses">
            {clauses.map((clause, clauseIndex) => {
              const classKey = clause.classKey || classOptions[0]?.key || 'buildings'
              const fields = queryFieldsForClass(classKey)
              const predicates = normalizeQueryPredicates(clause)
              const scopeKey = clause.scopeKey || (supportsCityScale ? 'radius' : 'city')
              const radiusPercent = Math.min(100, Math.max(0, Number(clause.radiusPercent ?? cityCoverage ?? 35) || 0))
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
                      <option value="city">Whole city</option>
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
                          placeholder={`${radiusPercent}%`}
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
          <Button
            className="dt-sidebar-button"
            disabled={running || querySelections.status === 'saving' || !canRun}
            onClick={onSelectionSave}
            variant="outline-primary"
          >
            <Database size={14} />
            <span>{querySelections.status === 'saving' ? 'Saving fragment' : 'Save fragment'}</span>
          </Button>
          <Button
            className="dt-sidebar-button"
            disabled={running && !queryResult}
            onClick={onClear}
            variant="outline-secondary"
          >
            <X size={14} />
            <span>Clear</span>
          </Button>
        </div>
        <div className={queryStatus === 'error' ? 'dt-twin-query__status is-error' : 'dt-twin-query__status'}>
          <span>{queryStatus === 'ready' ? resultLabel : queryStatus === 'running' ? 'Running query' : queryError || 'Waiting for query'}</span>
          <small>{clauses.length} {clauses.length === 1 ? 'clause' : 'clauses'} combined by union</small>
        </div>
      </QueryPanelSection>
    </div>
  )
}
