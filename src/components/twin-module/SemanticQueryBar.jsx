'use client'

import classNames from 'classnames'
import { SEMANTIC_QUERY_PRESETS, semanticQueryResultLabel } from './semanticQueryClient'

const STATUS_LABELS = {
  idle: 'Ready',
  running: 'Querying',
  ready: 'Result',
  error: 'Query error',
}

const SemanticQueryBar = ({
  error = '',
  onChange,
  onClear,
  onPreset,
  onSubmit,
  result,
  status = 'idle',
  value = '',
}) => {
  const running = status === 'running'
  const hasResult = status === 'ready' && result

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit?.()
  }

  return (
    <form className="dt-semantic-query" onSubmit={handleSubmit}>
      <div className="dt-semantic-query__main">
        <label className="dt-semantic-query__input">
          <i className="bi bi-search" aria-hidden="true" />
          <input
            aria-label="Semantic city query"
            disabled={running}
            onChange={(event) => onChange?.(event.target.value)}
            placeholder="buildings taller than 10 m"
            type="search"
            value={value}
          />
        </label>
        <button className="dt-semantic-query__run" disabled={running} type="submit">
          <i className="bi bi-play-fill" aria-hidden="true" />
          <span>{running ? 'Running' : 'Run'}</span>
        </button>
        <button className="dt-semantic-query__clear" disabled={running && !hasResult} onClick={onClear} type="button">
          <i className="bi bi-x-lg" aria-hidden="true" />
          <span>Clear</span>
        </button>
      </div>
      <div className="dt-semantic-query__secondary">
        <div className="dt-semantic-query__presets" aria-label="Semantic query presets">
          {SEMANTIC_QUERY_PRESETS.map((preset) => (
            <button
              disabled={running}
              key={preset.key}
              onClick={() => onPreset?.(preset)}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div
          className={classNames('dt-semantic-query__status', {
            'is-error': status === 'error',
            'is-running': running,
            'is-ready': hasResult,
          })}
          aria-live="polite"
        >
          <span>{STATUS_LABELS[status] ?? STATUS_LABELS.idle}</span>
          <strong>{error || (hasResult ? semanticQueryResultLabel(result) : 'Semantic selector')}</strong>
        </div>
      </div>
    </form>
  )
}

export default SemanticQueryBar

